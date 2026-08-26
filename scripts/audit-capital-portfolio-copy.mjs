import { desc } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects, waelSalesPlans } from "../drizzle/schema.ts";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet.ts";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine.ts";
import { alignPortfolioMonthlyNetFlows } from "../client/src/lib/portfolioAggregation.ts";
import { isCapitalPortfolioEligibleScenario } from "../client/src/lib/portfolioReportRules.ts";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow.ts";

const FILS = 0.001;
const db = await getDb();
if (!db) throw new Error("Database unavailable");

const [allProjects, allPlans] = await Promise.all([
  db.select().from(projects),
  db.select().from(waelSalesPlans).orderBy(desc(waelSalesPlans.updatedAt)),
]);
const newestPlanByProject = new Map();
for (const plan of allPlans) if (!newestPlanByProject.has(plan.projectId)) newestPlanByProject.set(plan.projectId, plan);

const sources = allProjects
  .filter((project) => isCapitalPortfolioEligibleScenario(project.financingScenario || "offplan_escrow"))
  .map((project) => {
    const scenario = project.financingScenario || "offplan_escrow";
    const salesResult = buildSalesResultFromSavedPlan(newestPlanByProject.get(project.id), project, scenario);
    const cashFlow = computeInvestorCashFlow(project, scenario, undefined, salesResult);
    const investorNet = calculateInvestorMonthlyNet(cashFlow, salesResult);
    const capital = calculateInvestorCapitalSummary(cashFlow);
    const totalCosts = cashFlow.rows
      .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
      .reduce((sum, row) => sum + row.totalCost, 0);
    return {
      projectId: project.id,
      name: project.name,
      financingScenario: scenario,
      startDate: cashFlow.startDate,
      monthDates: cashFlow.monthDates.slice(0, investorNet.netFlow.length),
      monthlyDebit: investorNet.debitTotals,
      monthlyCredit: investorNet.creditTotals,
      monthlyNet: investorNet.netFlow,
      paidBeforeSchedule: investorNet.paidBeforeSchedule,
      requiredCapital: capital.requiredCapital,
      paidCapital: capital.paidCapital,
      remainingCapital: capital.remainingCapital,
      totalRevenue: cashFlow.totalRevenue,
      totalCosts,
    };
  });

const portfolio = alignPortfolioMonthlyNetFlows(sources);
const transposedMatrix = portfolio.monthDates.map((date, monthIndex) => ({
  date,
  values: sources.map((source) => portfolio.rows.find((row) => row.projectId === source.projectId)?.values[monthIndex] || 0),
  total: portfolio.totals[monthIndex] || 0,
}));
const transposedCellChecks = transposedMatrix.flatMap((period, monthIndex) => period.values.map((value, projectIndex) => {
  const projectId = sources[projectIndex].projectId;
  const standardValue = portfolio.rows.find((row) => row.projectId === projectId)?.values[monthIndex] || 0;
  return {
    date: period.date,
    projectId,
    standardValue,
    transposedValue: value,
    difference: value - standardValue,
  };
}));
const maxTransposedCellDifference = transposedCellChecks.reduce((max, item) => Math.max(max, Math.abs(item.difference)), 0);
const projectChecks = sources.map((source) => {
  const row = portfolio.rows.find((candidate) => candidate.projectId === source.projectId);
  const sourceByDate = new Map(source.monthDates.map((date, index) => [date, source.monthlyNet[index] || 0]));
  const monthDifferences = portfolio.monthDates.map((date, index) => ({
    date,
    source: sourceByDate.get(date) || 0,
    portfolio: row?.values[index] || 0,
    difference: (row?.values[index] || 0) - (sourceByDate.get(date) || 0),
  }));
  const sourceNonZeroOutsidePortfolio = source.monthDates
    .map((date, index) => ({ date, value: source.monthlyNet[index] || 0 }))
    .filter(({ date, value }) => Math.abs(value) > 0.000001 && !portfolio.monthDates.includes(date));
  const individualProfit = -source.paidBeforeSchedule + source.monthlyNet.reduce((sum, value) => sum + value, 0);
  const portfolioProfit = -source.paidCapital + (row?.values || []).reduce((sum, value) => sum + value, 0);
  const maxMonthDifference = monthDifferences.reduce((max, item) => Math.max(max, Math.abs(item.difference)), 0);
  return {
    projectId: source.projectId,
    name: source.name,
    scenario: source.financingScenario,
    capital: {
      required: source.requiredCapital,
      paid: source.paidCapital,
      remaining: source.remainingCapital,
      paidVsOpeningDifference: source.paidCapital - source.paidBeforeSchedule,
    },
    totals: {
      revenue: source.totalRevenue,
      costs: source.totalCosts,
      individualProfit,
      portfolioProfit,
      profitDifference: portfolioProfit - individualProfit,
    },
    copiedMonths: portfolio.monthDates.length,
    maxMonthDifference,
    differingMonths: monthDifferences.filter((item) => Math.abs(item.difference) >= FILS),
    sourceNonZeroOutsidePortfolio,
    passes: maxMonthDifference < FILS
      && sourceNonZeroOutsidePortfolio.length === 0
      && Math.abs(source.paidCapital - source.paidBeforeSchedule) < FILS
      && Math.abs(portfolioProfit - individualProfit) < FILS,
  };
});

const monthTotalChecks = portfolio.monthDates.map((date, index) => {
  const summedRows = portfolio.rows.reduce((sum, row) => sum + (row.values[index] || 0), 0);
  return { date, summedRows, portfolioTotal: portfolio.totals[index] || 0, difference: (portfolio.totals[index] || 0) - summedRows };
});
const maxTotalDifference = monthTotalChecks.reduce((max, item) => Math.max(max, Math.abs(item.difference)), 0);
const totalPaidFromRows = sources.reduce((sum, source) => sum + source.paidCapital, 0);
const portfolioGrandProfit = -totalPaidFromRows + portfolio.totals.reduce((sum, value) => sum + value, 0);
const summedProjectProfit = projectChecks.reduce((sum, project) => sum + project.totals.portfolioProfit, 0);

const result = {
  asOf: new Date().toISOString(),
  excludedScenarios: ["build_for_rent"],
  projectCount: projectChecks.length,
  projects: projectChecks,
  portfolioTotals: {
    monthCount: portfolio.monthDates.length,
    maxMonthlySummationDifference: maxTotalDifference,
    grandProfit: portfolioGrandProfit,
    summedProjectProfit,
    profitDifference: portfolioGrandProfit - summedProjectProfit,
  },
  transposedView: {
    projectOrder: sources.map((source) => ({ projectId: source.projectId, name: source.name })),
    monthCount: transposedMatrix.length,
    checkedCellCount: transposedCellChecks.length,
    maxCellDifference: maxTransposedCellDifference,
    differingCells: transposedCellChecks.filter((item) => Math.abs(item.difference) >= FILS),
  },
  acceptance: {
    everyProjectRowCopiesInvestorNet: projectChecks.every((project) => project.passes),
    everyMonthTotalEqualsSumOfRows: maxTotalDifference < FILS,
    grandProfitEqualsSumOfProjectProfits: Math.abs(portfolioGrandProfit - summedProjectProfit) < FILS,
    transposedViewEqualsStandardCellByCell: maxTransposedCellDifference < FILS,
  },
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.acceptance.everyProjectRowCopiesInvestorNet
  && result.acceptance.everyMonthTotalEqualsSumOfRows
  && result.acceptance.grandProfitEqualsSumOfProjectProfits
  && result.acceptance.transposedViewEqualsStandardCellByCell ? 0 : 1);
