import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";

const PROJECT_ID = 6;
const db = await getDb();
if (!db) throw new Error("Database is unavailable");

const [project] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID));
if (!project) throw new Error(`Project ${PROJECT_ID} not found`);
const [plan] = await db.select().from(waelSalesPlans).where(eq(waelSalesPlans.projectId, PROJECT_ID));
if (!plan) throw new Error("Saved sales plan not found for Nad Al Sheba plot 3 villas");

const scenario = project.financingScenario || "build_for_sale";
const sales = buildSalesResultFromSavedPlan(plan, project, scenario as any);
const cashFlow = computeInvestorCashFlow(project, scenario as any, undefined, sales);
const investor = calculateInvestorMonthlyNet(cashFlow, sales);
const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
const sum = (values: number[]) => values.reduce((total, value) => total + (value || 0), 0);
const values = (row: any) => [
  ...row.designMonths,
  ...row.constructionMonths,
  ...row.postConstructionMonths,
].slice(0, totalMonths);
const rowBy = (fragment: string) => cashFlow.rows.find((row) => row.label.includes(fragment));
const salesRow = rowBy("إيرادات المبيعات");
const commissionRow = rowBy("عمولة المبيعات");
const comoRow = rowBy("حصة كومو");
const retentionRow = rowBy("ريتنشن أخيرة المقاول");
const costBeforeComo = cashFlow.rows
  .filter((row) => !row.isRevenue && !row.isProfitAllocation)
  .reduce((total, row) => total + row.totalCost, 0);
const grossProjectProfit = cashFlow.totalRevenue - costBeforeComo;
const expectedComo = Math.max(0, grossProjectProfit * 0.15);
const investorProfit = sum(investor.netFlow.slice(0, totalMonths));

const monthlySales = values(salesRow || { designMonths: [], constructionMonths: [], postConstructionMonths: [] });
const monthlyCommission = values(commissionRow || { designMonths: [], constructionMonths: [], postConstructionMonths: [] });
const monthlyComo = values(comoRow || { designMonths: [], constructionMonths: [], postConstructionMonths: [] });
const monthlyRetention = values(retentionRow || { designMonths: [], constructionMonths: [], postConstructionMonths: [] });

console.log(JSON.stringify({
  project: { id: project.id, name: project.name, scenario },
  totals: {
    revenue: cashFlow.totalRevenue,
    costBeforeComo,
    grossProjectProfit,
    expectedComo,
    scheduledComo: comoRow?.totalCost || 0,
    investorProfit,
    investorProfitExpected: grossProjectProfit - expectedComo,
    comoDifference: (comoRow?.totalCost || 0) - expectedComo,
    investorDifference: investorProfit - (grossProjectProfit - expectedComo),
  },
  directReceipts: cashFlow.monthDates.slice(0, totalMonths).map((date, index) => ({
    date,
    saleReceipt: monthlySales[index] || 0,
    brokerCommission: monthlyCommission[index] || 0,
    contractorRetention: monthlyRetention[index] || 0,
    comoShare: monthlyComo[index] || 0,
    investorNet: investor.netFlow[index] || 0,
    cumulative: investor.cumulativeNet?.[index] || 0,
  })).filter((month) => month.saleReceipt || month.brokerCommission || month.contractorRetention || month.comoShare),
}, null, 2));
