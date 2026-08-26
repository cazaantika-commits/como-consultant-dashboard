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
const cashFlowCostRows = cashFlow.rows
  .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
  .map((row) => ({ label: row.label, funder: row.funder, total: row.totalCost }));
const cashFlowTotalCosts = cashFlowCostRows.reduce((sum, row) => sum + row.total, 0);

console.log(JSON.stringify({
  project: { id: project.id, name: project.name, scenario },
  plan: { id: plan?.id || null, escrowReceipts: planEscrow, investorReceipts: planInvestor },
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
  },
}, null, 2));
process.exit(0);
