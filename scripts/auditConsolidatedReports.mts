import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import {
  calculateInvestorCapitalSummary,
  calculateInvestorMonthlyFundingRequirements,
  computeInvestorCashFlow,
  type Scenario,
} from "../client/src/lib/investorCashFlowEngine";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { alignPortfolioMonthlyNetFlows, groupCalendarAlignedPortfolio, type PortfolioProjectMonthlyNet } from "../client/src/lib/portfolioAggregation";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { isCapitalPortfolioEligibleScenario } from "../client/src/lib/portfolioReportRules";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");

const [allProjects, allPlans] = await Promise.all([
  db.select().from(projects).orderBy(projects.id),
  db.select().from(waelSalesPlans).orderBy(desc(waelSalesPlans.updatedAt)),
]);
const newestPlanByProject = new Map<number, typeof allPlans[number]>();
for (const plan of allPlans) if (!newestPlanByProject.has(plan.projectId)) newestPlanByProject.set(plan.projectId, plan);

const round = (value: number) => Math.round(Number(value || 0) * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + Number(value || 0), 0);
const rowValues = (row: any) => [...(row.designMonths || []), ...(row.constructionMonths || []), ...(row.postConstructionMonths || [])];

const individual = allProjects.map((project) => {
  const scenario = (project.financingScenario || "offplan_escrow") as Scenario;
  const sales = buildSalesResultFromSavedPlan(newestPlanByProject.get(project.id), project, scenario);
  const cashFlow = computeInvestorCashFlow(project, scenario, undefined, sales);
  const investorNet = calculateInvestorMonthlyNet(cashFlow, sales);
  const engineProjectCost = cashFlow.rows
    .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
    .reduce((total, row) => total + row.totalCost, 0);
  return { project, scenario, sales, cashFlow, investorNet, engineProjectCost };
});

const portfolioSource: PortfolioProjectMonthlyNet[] = individual.map(({ project, scenario, cashFlow, investorNet }) => ({
  projectId: project.id,
  name: project.name,
  financingScenario: scenario,
  startDate: cashFlow.startDate,
  monthDates: cashFlow.monthDates.slice(0, investorNet.netFlow.length),
  monthlyNet: investorNet.netFlow,
}));
const aligned = alignPortfolioMonthlyNetFlows(portfolioSource);
const monthDiscrepancies = aligned.monthDates.map((monthDate, index) => ({
  monthDate,
  displayedTotal: round(aligned.totals[index]),
  recomputedTotal: round(sum(aligned.rows.map((row) => row.values[index] || 0))),
})).filter((row) => Math.abs(row.displayedTotal - row.recomputedTotal) > 0.01);
const groupingChecks = ([1, 3, 4, 6] as const).map((groupSize) => {
  const grouped = groupCalendarAlignedPortfolio(aligned, groupSize);
  return {
    groupSize,
    sourceNetTotal: round(sum(aligned.totals)),
    groupedNetTotal: round(sum(grouped.totals)),
    periodMismatchCount: grouped.periods.filter((period, index) => Math.abs(sum(period.values) - (grouped.totals[index] || 0)) > 0.01).length,
  };
});

const capitalRows = individual
  .filter(({ scenario }) => isCapitalPortfolioEligibleScenario(scenario))
  .map(({ project, scenario, cashFlow, engineProjectCost }) => {
    const costs = calculateProjectCosts(project);
    const capital = calculateInvestorCapitalSummary(cashFlow);
    const monthlyFunding = calculateInvestorMonthlyFundingRequirements(cashFlow);
    const endpointTotalCosts = engineProjectCost;
    const endpointRevenue = cashFlow.totalRevenue;
    return {
      projectId: project.id,
      name: project.name,
      scenario,
      endpointRevenue: round(endpointRevenue),
      engineRevenue: round(cashFlow.totalRevenue),
      revenueDifference: round(endpointRevenue - cashFlow.totalRevenue),
      endpointTotalCosts: round(endpointTotalCosts),
      engineProjectCost: round(engineProjectCost),
      costDifference: round(endpointTotalCosts - engineProjectCost),
      requiredCapital: round(capital.requiredCapital),
      fundingScheduleTotal: round(sum(monthlyFunding)),
      fundingDifference: round(sum(monthlyFunding) - capital.remainingCapital),
    };
  });

console.log(JSON.stringify({
  portfolioInvestorNet: {
    projects: portfolioSource.map((project) => ({ projectId: project.projectId, name: project.name, netTotal: round(sum(project.monthlyNet)), monthlyCount: project.monthlyNet.length })),
    displayedMonthDiscrepancies: monthDiscrepancies,
    groupingChecks,
  },
  capitalPortfolio: {
    includedProjectIds: capitalRows.map((row) => row.projectId),
    excludedProjectIds: individual.filter(({ scenario }) => !isCapitalPortfolioEligibleScenario(scenario)).map(({ project }) => project.id),
    rows: capitalRows,
  },
}, null, 2));
process.exit(0);
