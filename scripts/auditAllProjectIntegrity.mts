import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildPricingUnits, computeInvestorCashFlow, type Scenario } from "../client/src/lib/investorCashFlowEngine";
import { calculateEscrowMonthlyBalance } from "../client/src/lib/escrowSettlement";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { calculatePricingFormulas, dbProjectToInputs } from "../client/src/lib/projectData";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");

const allProjects = await db.select().from(projects).orderBy(projects.id);

const currency = (amount: number) => Math.round(Number(amount || 0));
const rowValues = (row: any) => [
  ...(row.designMonths || []),
  ...(row.constructionMonths || []),
  ...(row.postConstructionMonths || []),
];
const sumRawCounts = (project: any) => [
  "residential1brCount", "residential2brCount", "residential3brCount", "villaCount", "townhouseCount",
  "retailSmallCount", "retailMediumCount", "retailLargeCount", "officeSmallCount", "officeMediumCount", "officeLargeCount",
].reduce((total, key) => total + Math.max(0, Number(project[key]) || 0), 0);

const audit = [];
for (const project of allProjects) {
  const scenario = (project.financingScenario || "offplan_escrow") as Scenario;
  const [plan] = await db
    .select()
    .from(waelSalesPlans)
    .where(eq(waelSalesPlans.projectId, project.id))
    .orderBy(desc(waelSalesPlans.updatedAt));

  const inputs = dbProjectToInputs(project);
  const pricingUnits = buildPricingUnits(project, inputs);
  const pricing = calculatePricingFormulas(pricingUnits);
  const savedSales = plan ? buildSalesResultFromSavedPlan(plan, project, scenario) : undefined;
  const cashFlow = computeInvestorCashFlow(project, scenario, undefined, savedSales);
  const applicableForSale = scenario !== "build_for_rent";
  const rawUnitCount = sumRawCounts(project);
  const generatedUnitCount = pricing.totalUnits;
  const saleableGfa = inputs.gfaResidential * inputs.efficiencyResidential
    + inputs.gfaRetail * inputs.efficiencyRetail
    + inputs.gfaOffice * inputs.efficiencyOffice;
  const monthlySalesRevenue = cashFlow.rows
    .filter((row: any) => /مبيعات الوحدات|إيرادات البيع|مبيعات مباشرة/.test(row.label || ""))
    .reduce((total: number, row: any) => total + rowValues(row).reduce((sum: number, amount: number) => sum + Number(amount || 0), 0), 0);
  const investorNetTotal = cashFlow.rows
    .filter((row: any) => row.party === "investor")
    .reduce((total: number, row: any) => total + rowValues(row).reduce((sum: number, amount: number) => sum + Number(amount || 0), 0), 0);

  let escrow: Record<string, unknown> = { applicable: false };
  if (scenario === "offplan_escrow") {
    const balance = calculateEscrowMonthlyBalance({
      rows: cashFlow.rows,
      designDuration: cashFlow.designDuration,
      constructionDuration: cashFlow.constructionDuration,
      postDuration: cashFlow.postDuration,
      salesResult: cashFlow.usedSalesResult || savedSales,
    });
    const firstReceipt = balance.salesIncomeValues.findIndex((value) => value > 0);
    escrow = {
      applicable: true,
      firstBuyerReceiptMonth: firstReceipt >= 0 ? firstReceipt + 1 : null,
      firstBuyerReceiptAmount: firstReceipt >= 0 ? currency(balance.salesIncomeValues[firstReceipt]) : 0,
      finalBalance: currency(balance.cumulative.at(-1) || 0),
      lowestWorkingBalance: currency(Math.min(...balance.cumulative)),
      settlementRowPresent: cashFlow.rows.some((row: any) => /تصفية|تسوية/.test(row.label || "")),
    };
  }

  const statuses = {
    unitSource: applicableForSale && saleableGfa > 0 && generatedUnitCount === 0
      ? "FAIL"
      : rawUnitCount === 0 && generatedUnitCount > 0
        ? "AUTO_GENERATED"
        : "PASS",
    pricing: applicableForSale && saleableGfa > 0 && pricing.totalRevenue <= 0 ? "FAIL" : applicableForSale ? "PASS" : "NOT_APPLICABLE",
    sales: scenario === "build_for_rent" ? "NOT_APPLICABLE" : savedSales ? "PASS" : "MISSING_PLAN",
    escrow: scenario === "offplan_escrow" ? (escrow.applicable ? "PASS" : "FAIL") : "NOT_APPLICABLE",
    cashFlow: cashFlow.rows.length > 0 && Number.isFinite(investorNetTotal) ? "PASS" : "FAIL",
  };

  audit.push({
    projectId: project.id,
    projectName: project.name,
    financingScenario: scenario,
    hasSavedWaelPlan: Boolean(plan),
    rawUnitCount,
    generatedUnitCount,
    saleableGfa: currency(saleableGfa),
    pricingRevenue: currency(pricing.totalRevenue),
    monthlySalesRevenue: currency(monthlySalesRevenue),
    investorNetTotal: currency(investorNetTotal),
    statuses,
    escrow,
  });
}

console.log(JSON.stringify(audit, null, 2));
process.exit(0);
