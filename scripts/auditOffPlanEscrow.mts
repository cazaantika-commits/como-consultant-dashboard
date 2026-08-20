import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildPricingUnits, computeInvestorCashFlow, type Scenario, type SalesResult } from "../client/src/lib/investorCashFlowEngine";
import { calculateEscrowMonthlyBalance } from "../client/src/lib/escrowSettlement";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { calculatePricingFormulas, dbProjectToInputs } from "../client/src/lib/projectData";
import { getProjectMarketingTiming } from "../client/src/lib/projectTiming";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");

const offPlanProjects = await db
  .select()
  .from(projects)
  .where(eq(projects.financingScenario, "offplan_escrow"));

function createWorkspaceDefaultSalesResult(project: any): SalesResult {
  const inputs = dbProjectToInputs(project);
  const pricing = calculatePricingFormulas(buildPricingUnits(project, inputs));
  const totalRevenue = pricing.totalRevenue;
  const totalUnits = pricing.totalUnits;
  const averageUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
  const timing = getProjectMarketingTiming(project);
  const salesStartMonth = timing.salesStartMonth;
  const salesMonths = Math.max(1, timing.projectEndMonth - salesStartMonth + 1);
  const offPlanUnits = Math.round(totalUnits * 0.8);
  const speed = 50;
  const mid = salesMonths * (1 - speed / 100) + (salesMonths / 2) * (speed / 100);
  const sigma = salesMonths / (3 + (speed / 100) * 3);
  const raw = Array.from({ length: salesMonths }, (_, index) => Math.exp(-0.5 * Math.pow((index - mid + salesMonths / 2) / sigma, 2)));
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const salesDistribution = raw.map((value) => Math.max(1, Math.round((value / rawTotal) * offPlanUnits)));
  const distributionDifference = offPlanUnits - salesDistribution.reduce((sum, value) => sum + value, 0);
  salesDistribution[Math.floor(salesMonths / 2)] += distributionDifference;

  const ppDownPct = 10;
  const ppSecondPct = 10;
  const ppSecondAfterMonths = 1;
  const ppDuringTotal = 40;
  const ppInstallmentEveryMonths = 6;
  const ppHandoverPct = 40;
  const totalMonths = timing.projectEndMonth;
  const constructionEndMonth = timing.constructionStartMonth + inputs.constructionMonths - 1;
  const cashPerMonth = new Array(totalMonths + 14).fill(0);
  const escrowData = salesDistribution.map((units, index) => ({
    month: salesStartMonth + index,
    units,
    income: 0,
    downPayment: 0,
    installments: 0,
    withdrawal: 0,
    balance: 0,
    cumulativeSold: salesDistribution.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
  }));

  salesDistribution.forEach((units, index) => {
    const saleMonth = salesStartMonth + index;
    const saleAmount = units * averageUnitPrice;
    const downAmount = saleAmount * (ppDownPct / 100);
    cashPerMonth[saleMonth] += downAmount;
    const secondMonth = saleMonth + ppSecondAfterMonths;
    cashPerMonth[secondMonth] += saleAmount * (ppSecondPct / 100);
    const installmentMonths: number[] = [];
    for (let month = saleMonth + ppInstallmentEveryMonths + ppSecondAfterMonths; month <= constructionEndMonth; month += ppInstallmentEveryMonths) {
      installmentMonths.push(month);
    }
    const installmentTotal = saleAmount * (ppDuringTotal / 100);
    if (installmentMonths.length) {
      installmentMonths.forEach((month) => { cashPerMonth[month] += installmentTotal / installmentMonths.length; });
    } else {
      cashPerMonth[Math.min(constructionEndMonth, totalMonths)] += installmentTotal;
    }
    cashPerMonth[Math.min(constructionEndMonth, totalMonths)] += saleAmount * (ppHandoverPct / 100);
  });
  const actualCashInflow = Array.from({ length: totalMonths + 13 }, (_, index) => cashPerMonth[index + 1] || 0);
  escrowData.forEach((entry) => { entry.income = actualCashInflow[entry.month - 1] || 0; });

  return {
    escrowData,
    salesDistribution,
    actualCashInflow,
    offplanPct: 80,
    ppDownPct,
    paymentPlan: {
      downPct: ppDownPct,
      secondPct: ppSecondPct,
      secondAfterMonths: ppSecondAfterMonths,
      duringTotalPct: ppDuringTotal,
      installmentEveryMonths: ppInstallmentEveryMonths,
      handoverPct: ppHandoverPct,
    },
  };
}

const audit = [];
for (const project of offPlanProjects) {
  const [plan] = await db
    .select()
    .from(waelSalesPlans)
    .where(eq(waelSalesPlans.projectId, project.id))
    .orderBy(desc(waelSalesPlans.updatedAt));
  const scenario = "offplan_escrow" as Scenario;
  const savedSalesResult = plan ? buildSalesResultFromSavedPlan(plan, project, scenario) : undefined;
  const reportCashFlow = computeInvestorCashFlow(project, scenario, undefined, savedSalesResult);
  const reportBalance = calculateEscrowMonthlyBalance({
    rows: reportCashFlow.rows,
    designDuration: reportCashFlow.designDuration,
    constructionDuration: reportCashFlow.constructionDuration,
    postDuration: reportCashFlow.postDuration,
    salesResult: reportCashFlow.usedSalesResult || savedSalesResult,
  });
  const workspaceSalesResult = savedSalesResult || createWorkspaceDefaultSalesResult(project);
  const workspaceCashFlow = computeInvestorCashFlow(project, scenario, undefined, workspaceSalesResult);
  const workspaceBalance = calculateEscrowMonthlyBalance({
    rows: workspaceCashFlow.rows,
    designDuration: workspaceCashFlow.designDuration,
    constructionDuration: workspaceCashFlow.constructionDuration,
    postDuration: workspaceCashFlow.postDuration,
    salesResult: workspaceCashFlow.usedSalesResult || workspaceSalesResult,
  });
  const firstReceiptIndex = reportBalance.salesIncomeValues.findIndex((amount) => amount > 0);
  const firstFundingIndex = reportBalance.inflowTotals.findIndex((amount) => amount > 0);
  const workingEndIndex = reportCashFlow.designDuration + reportCashFlow.constructionDuration + 2;
  const workingBalances = reportBalance.cumulative.slice(Math.max(0, firstFundingIndex), Math.min(reportBalance.cumulative.length, workingEndIndex + 1));
  const minimumBalance = workingBalances.length ? Math.min(...workingBalances) : 0;
  const minimumIndex = workingBalances.length ? reportBalance.cumulative.indexOf(minimumBalance, Math.max(0, firstFundingIndex)) : -1;
  const balanceDifferences = Array.from({ length: Math.max(reportBalance.cumulative.length, workspaceBalance.cumulative.length) }, (_, index) => ({
    month: index + 1,
    reportBalance: reportBalance.cumulative[index] || 0,
    workspaceBalance: workspaceBalance.cumulative[index] || 0,
    difference: (workspaceBalance.cumulative[index] || 0) - (reportBalance.cumulative[index] || 0),
  })).filter((row) => Math.abs(row.difference) > 0.5);
  audit.push({
    projectId: project.id,
    projectName: project.name,
    hasSavedSalesPlan: Boolean(plan),
    totalMonths: reportBalance.cumulative.length,
    firstBuyerReceiptMonth: firstReceiptIndex >= 0 ? firstReceiptIndex + 1 : null,
    firstBuyerReceiptAmount: firstReceiptIndex >= 0 ? reportBalance.salesIncomeValues[firstReceiptIndex] : 0,
    workspaceFirstBuyerReceiptMonth: workspaceBalance.salesIncomeValues.findIndex((amount) => amount > 0) + 1 || null,
    workspaceFirstBuyerReceiptAmount: workspaceBalance.salesIncomeValues.find((amount) => amount > 0) || 0,
    minimumWorkingBalance: minimumBalance,
    minimumWorkingBalanceMonth: minimumIndex >= 0 ? minimumIndex + 1 : null,
    finalBalance: reportBalance.cumulative.at(-1) || 0,
    workspaceMatchesReport: balanceDifferences.length === 0,
    firstWorkspaceDifference: balanceDifferences[0] || null,
    maximumWorkspaceDifference: balanceDifferences.reduce((maximum, row) => Math.max(maximum, Math.abs(row.difference)), 0),
    monthlyBalances: reportBalance.cumulative,
  });
}

console.log(JSON.stringify(audit, null, 2));
process.exit(0);
