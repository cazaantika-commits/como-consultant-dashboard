import { desc } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { computeInvestorCashFlow, calculateInvestorCapitalSummary, calculateInvestorMonthlyFundingRequirements } from "../client/src/lib/investorCashFlowEngine";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";
import { calculateEscrowMonthlyBalance, summarizeEscrowLiquidity } from "../client/src/lib/escrowSettlement";

const db = await getDb();
if (!db) throw new Error("Database is unavailable");
const [projectRows, plans] = await Promise.all([
  db.select().from(projects),
  db.select().from(waelSalesPlans).orderBy(desc(waelSalesPlans.updatedAt)),
]);

const planByProject = new Map<number, any>();
for (const plan of plans) if (!planByProject.has(Number(plan.projectId))) planByProject.set(Number(plan.projectId), plan);

const calculated = projectRows.map((project) => {
  const scenario = project.financingScenario || "offplan_escrow";
  const savedPlan = planByProject.get(Number(project.id));
  const sales = buildSalesResultFromSavedPlan(savedPlan, project, scenario as any);
  const cashFlow = computeInvestorCashFlow(project, scenario as any, undefined, sales);
  const investorNet = calculateInvestorMonthlyNet(cashFlow, sales);
  const monthlyFunding = calculateInvestorMonthlyFundingRequirements(cashFlow);
  const capital = calculateInvestorCapitalSummary(cashFlow);
  const peakInclusive = capital.peakMonthIndex + 1;
  const debitToPeak = investorNet.debitTotals.slice(0, peakInclusive).reduce((sum, value) => sum + value, 0);
  const creditToPeak = investorNet.creditTotals.slice(0, peakInclusive).reduce((sum, value) => sum + value, 0);
  const debitAfterPeak = investorNet.debitTotals.slice(peakInclusive).reduce((sum, value) => sum + value, 0);
  const creditAfterPeak = investorNet.creditTotals.slice(peakInclusive).reduce((sum, value) => sum + value, 0);
  const escrowBalance = scenario === "offplan_escrow"
    ? calculateEscrowMonthlyBalance({
        rows: cashFlow.rows,
        designDuration: cashFlow.designDuration,
        constructionDuration: cashFlow.constructionDuration,
        postDuration: cashFlow.postDuration,
        salesResult: cashFlow.usedSalesResult || sales,
      })
    : null;
  const escrowLiquidity = escrowBalance ? summarizeEscrowLiquidity(escrowBalance.cumulative) : null;
  const paymentPlan = savedPlan?.paymentPlanJson ? JSON.parse(savedPlan.paymentPlanJson) : null;
  const calendar = Array.isArray(paymentPlan?.calendarEntries) ? paymentPlan.calendarEntries : [];
  const paymentTotal = calendar.reduce((sum: number, entry: any) => sum + (Number(entry.percentage) || 0), 0);

  return {
    projectId: Number(project.id),
    name: project.name,
    scenario,
    startDate: cashFlow.startDate,
    hasSavedPlan: Boolean(savedPlan),
    paymentTotal,
    paymentRows: calendar.length,
    paymentLabels: calendar.map((entry: any) => entry.label),
    investorNetTotal: investorNet.netFlow.reduce((sum: number, value: number) => sum + value, 0),
    investorNetMonths: investorNet.netFlow.length,
    investorNetByMonth: cashFlow.monthDates.slice(0, investorNet.netFlow.length).map((date: string, index: number) => ({
      date,
      value: investorNet.netFlow[index] || 0,
    })),
    fundingTotal: monthlyFunding.reduce((sum: number, value: number) => sum + value, 0),
    fundingMonths: monthlyFunding.length,
    requiredCapital: capital.requiredCapital,
    paidCapital: capital.paidCapital,
    remainingCapital: capital.remainingCapital,
    capitalPeakDate: capital.peakMonthDate,
    debitToCapitalPeak: debitToPeak,
    creditToCapitalPeak: creditToPeak,
    debitAfterCapitalPeak: debitAfterPeak,
    creditAfterCapitalPeak: creditAfterPeak,
    totalRevenue: cashFlow.totalRevenue,
    totalCosts: cashFlow.rows
      .filter((row: any) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
      .reduce((sum: number, row: any) => sum + row.totalCost, 0),
    escrowMinimumBalance: escrowLiquidity?.minimumBalance ?? null,
    escrowFirstDeficit: escrowLiquidity?.firstDeficit ?? null,
    escrowMonths: escrowBalance?.cumulative.length ?? 0,
  };
});

const offplan = calculated.filter((item) => item.scenario === "offplan_escrow");
const capitalPortfolio = calculated.filter((item) => item.scenario !== "build_for_rent");
const sum = (items: typeof calculated, field: keyof (typeof calculated)[number]) => items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
const capitalPortfolioMonthlyNet = new Map<string, number>();
for (const project of capitalPortfolio) {
  capitalPortfolioMonthlyNet.set(project.startDate, (capitalPortfolioMonthlyNet.get(project.startDate) || 0) - project.paidCapital);
  for (const item of project.investorNetByMonth) {
    capitalPortfolioMonthlyNet.set(item.date, (capitalPortfolioMonthlyNet.get(item.date) || 0) + item.value);
  }
}
let portfolioRunningNet = 0;
let portfolioMinimumNet = 0;
let portfolioPeakCapitalDate = "";
for (const [date, value] of [...capitalPortfolioMonthlyNet.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  portfolioRunningNet += value;
  if (portfolioRunningNet < portfolioMinimumNet) {
    portfolioMinimumNet = portfolioRunningNet;
    portfolioPeakCapitalDate = date;
  }
}
const summary = {
  investorNetPortfolio: {
    projectCount: calculated.length,
    totalNet: sum(calculated, "investorNetTotal"),
  },
  capitalPortfolio: {
    projectCount: capitalPortfolio.length,
    totalRevenue: sum(capitalPortfolio, "totalRevenue"),
    totalCosts: sum(capitalPortfolio, "totalCosts"),
    grossProfitBeforeDeveloperShare: sum(capitalPortfolio, "totalRevenue") - sum(capitalPortfolio, "totalCosts"),
    totalRequiredCapital: sum(capitalPortfolio, "requiredCapital"),
    totalPaidCapital: sum(capitalPortfolio, "paidCapital"),
    totalRemainingCapital: sum(capitalPortfolio, "remainingCapital"),
    totalFutureFundingSchedule: sum(capitalPortfolio, "fundingTotal"),
    requiredCapitalIdentityDifference: sum(capitalPortfolio, "requiredCapital") - sum(capitalPortfolio, "paidCapital") - sum(capitalPortfolio, "remainingCapital"),
    sumOfIndividualCapitalPeaks: sum(capitalPortfolio, "requiredCapital"),
    calendarAlignedNetCapitalPeak: -portfolioMinimumNet,
    calendarAlignedNetCapitalPeakDate: portfolioPeakCapitalDate,
  },
  escrowLiquidityPortfolio: {
    projectCount: offplan.length,
    projectsWithSavedPlan: offplan.filter((item) => item.hasSavedPlan).length,
    paymentPlansAt100: offplan.filter((item) => item.paymentTotal === 100).length,
    deficitProjects: offplan.filter((item) => (item.escrowFirstDeficit ?? 0) < 0).map((item) => item.name),
  },
};

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary, projects: calculated }, null, 2));
process.exit(0);
