import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects, waelSalesPlans } from "../drizzle/schema.ts";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc.ts";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet.ts";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine.ts";
import { calculateEscrowMonthlyBalance } from "../client/src/lib/escrowSettlement.ts";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow.ts";

const db = await getDb();
if (!db) throw new Error("Database unavailable");
const projectId = Number(process.argv[2] || 2);
const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
const [plan] = await db.select().from(waelSalesPlans).where(eq(waelSalesPlans.projectId, projectId)).orderBy(desc(waelSalesPlans.updatedAt)).limit(1);
if (!project) throw new Error(`Project ${projectId} unavailable`);

const scenario = project.financingScenario || "offplan_escrow";
const salesResult = buildSalesResultFromSavedPlan(plan, project, scenario);
const cashFlow = computeInvestorCashFlow(project, scenario, undefined, salesResult);
const investorNet = calculateInvestorMonthlyNet(cashFlow, salesResult);
const capital = calculateInvestorCapitalSummary(cashFlow);
const feasibility = calculateProjectCosts(project);
const escrowBalance = calculateEscrowMonthlyBalance({
  rows: cashFlow.rows,
  designDuration: cashFlow.designDuration,
  constructionDuration: cashFlow.constructionDuration,
  postDuration: cashFlow.postDuration,
  salesResult: cashFlow.usedSalesResult || salesResult,
});
const valueAt = (row) => row ? [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths].reduce((sum, value) => sum + (value || 0), 0) : 0;
const rowByLabel = (fragment) => cashFlow.rows.find((row) => row.label.includes(fragment));
const firstSettlement = rowByLabel("تصفية حساب الضمان (دفعة 1)");
const finalSettlement = cashFlow.rows.find((row) => row.label.includes("تصفية حساب الضمان") && row.label.includes("دفعة 2"));
const directReceipts = rowByLabel("تحصيلات مبيعات مباشرة");
const directCommission = rowByLabel("عمولة مبيعات مباشرة");
const como = rowByLabel("حصة كومو من الأرباح");
const investorFinal = -investorNet.paidBeforeSchedule + investorNet.netFlow.reduce((sum, value) => sum + value, 0);
const projectProfit = feasibility.totalRevenue - feasibility.totalCosts;
const feasibilityInvestorProfit = projectProfit - Math.max(0, projectProfit * 0.15);
const planEscrow = (salesResult?.actualEscrowCashInflow || []).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
const planInvestor = (salesResult?.actualInvestorCashInflow || []).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
const salesDistributionUnits = (salesResult?.salesDistribution || []).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
const totalProjectUnits = [
  "studioCount", "residential1brCount", "residential2brCount", "residential2brMaidCount",
  "residential3brCount", "residential3brMaidCount", "villaCount", "townhouseCount",
  "retailSmallCount", "retailMediumCount", "retailLargeCount",
  "officeSmallCount", "officeMediumCount", "officeLargeCount",
].reduce((sum, key) => sum + Math.max(0, Number(project[key]) || 0), 0);
const unsoldUnits = Math.max(0, totalProjectUnits - salesDistributionUnits);
const traceableDirectRevenue = totalProjectUnits > 0 ? feasibility.totalRevenue * (unsoldUnits / totalProjectUnits) : 0;
let savedMarketingTotal = 0;
try {
  const absorption = JSON.parse(plan?.salesAbsorptionJson || "{}");
  for (const channel of Object.values(absorption.marketingDistribution || {})) {
    if (!Array.isArray(channel)) continue;
    savedMarketingTotal += channel.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }
} catch { /* reported as zero */ }
const constructionEndIndex = cashFlow.designDuration + cashFlow.constructionDuration;
const escrowReceiptsBeforeCompletion = (salesResult?.actualEscrowCashInflow || [])
  .slice(0, constructionEndIndex)
  .reduce((sum, value) => sum + Math.max(0, value || 0), 0);
const escrowReceiptsAfterCompletion = (salesResult?.actualEscrowCashInflow || [])
  .slice(constructionEndIndex)
  .reduce((sum, value) => sum + Math.max(0, value || 0), 0);
const sourceRevenueTotal = planEscrow + planInvestor + traceableDirectRevenue;
const sourceRevenueDifference = sourceRevenueTotal - feasibility.totalRevenue;
const filsTolerance = 0.001;
const cashFlowCostRows = cashFlow.rows
  .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
  .map((row) => ({ label: row.label, funder: row.funder, total: row.totalCost }));
const cashFlowTotalCosts = cashFlowCostRows.reduce((sum, row) => sum + row.total, 0);

console.log(JSON.stringify({
  project: { id: project.id, name: project.name, scenario },
  plan: {
    id: plan?.id || null,
    escrowReceipts: planEscrow,
    investorReceipts: planInvestor,
    escrowReceiptsBeforeCompletion,
    escrowReceiptsAfterCompletion,
    paymentRecipients: (salesResult?.paymentPlan?.stages || []).map((stage) => ({
      id: stage.id,
      trigger: stage.trigger,
      recipient: stage.recipient,
      percentage: stage.percentage,
    })),
    projectUnits: totalProjectUnits,
    offplanUnits: salesDistributionUnits,
    unsoldPostCompletionUnits: unsoldUnits,
    traceableDirectRevenue,
    savedMarketingTotal,
    feasibilityMarketingTotal: feasibility.marketingCost,
  },
  diagnostics: {
    hasEscrowData: Boolean(salesResult?.escrowData?.length),
    escrowReceiptMonths: salesResult?.actualEscrowCashInflow?.length || 0,
    investorReceiptMonths: salesResult?.actualInvestorCashInflow?.length || 0,
    settlementRows: cashFlow.rows
      .filter((row) => row.label.includes("تصفية حساب الضمان"))
      .map((row) => ({ label: row.label, amount: valueAt(row), post: row.postConstructionMonths })),
    escrowCumulativePost: escrowBalance.cumulative.slice(cashFlow.designDuration + cashFlow.constructionDuration),
  },
  cashMovements: {
    paidBeforeSchedule: investorNet.paidBeforeSchedule,
    totalMonthlyDebit: investorNet.debitTotals.reduce((sum, value) => sum + value, 0),
    totalMonthlyCredit: investorNet.creditTotals.reduce((sum, value) => sum + value, 0),
    totalDebit: investorNet.paidBeforeSchedule + investorNet.debitTotals.reduce((sum, value) => sum + value, 0),
    totalCredit: investorNet.creditTotals.reduce((sum, value) => sum + value, 0),
    requiredCapital: capital.requiredCapital,
    firstEscrowTransfer: valueAt(firstSettlement),
    finalEscrowTransfer: valueAt(finalSettlement),
    finalContractorRetention: valueAt(rowByLabel("ريتنشن أخيرة المقاول")),
    directBuyerReceipts: valueAt(directReceipts),
    directSalesCommission: valueAt(directCommission),
    comoShare: valueAt(como),
    investorFinal,
  },
  feasibility: {
    totalRevenue: feasibility.totalRevenue,
    totalCosts: feasibility.totalCosts,
    projectProfit,
    investorProfit: feasibilityInvestorProfit,
  },
  costAudit: {
    cashFlowTotalCosts,
    feasibilityTotalCosts: feasibility.totalCosts,
    difference: cashFlowTotalCosts - feasibility.totalCosts,
    cashFlowCostRows,
  },
  reconciliation: {
    investorDifference: investorFinal - feasibilityInvestorProfit,
    comoDifference: valueAt(como) - Math.max(0, projectProfit * 0.15),
    escrowEndingBalance: escrowBalance.cumulative[escrowBalance.cumulative.length - 1],
    sourceRevenueDifference,
    acceptance: {
      sourceRevenueReconciles: Math.abs(sourceRevenueDifference) < filsTolerance,
      investorProfitReconciles: Math.abs(investorFinal - feasibilityInvestorProfit) < filsTolerance,
      comoShareReconciles: Math.abs(valueAt(como) - Math.max(0, projectProfit * 0.15)) < filsTolerance,
      escrowClosesToZero: Math.abs(escrowBalance.cumulative[escrowBalance.cumulative.length - 1]) < filsTolerance,
      lateEscrowReceiptPreserved: escrowReceiptsAfterCompletion > 0
        ? Math.abs(escrowBalance.salesIncomeValues.slice(constructionEndIndex).reduce((sum, value) => sum + value, 0) - escrowReceiptsAfterCompletion) < filsTolerance
        : true,
    },
  },
}, null, 2));
process.exit(0);
