import { inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";

const ELIGIBLE_PROJECT_IDS = [2, 3, 4, 5, 6];

const db = await getDb();
if (!db) throw new Error("Database is unavailable");

const eligibleProjects = await db
  .select()
  .from(projects)
  .where(inArray(projects.id, ELIGIBLE_PROJECT_IDS));
const plans = await db
  .select()
  .from(waelSalesPlans)
  .where(inArray(waelSalesPlans.projectId, ELIGIBLE_PROJECT_IDS));
const plansByProject = new Map(plans.map((plan) => [plan.projectId, plan]));

const audits = eligibleProjects.map((project) => {
  const plan = plansByProject.get(project.id);
  if (!plan) {
    return {
      projectId: project.id,
      projectName: project.name,
      status: "needs_review",
      reason: "لا توجد خطة وائل محفوظة للمشروع",
    };
  }

  const scenario = project.financingScenario || "offplan_escrow";
  const sales = buildSalesResultFromSavedPlan(plan, project, scenario as any);
  const cashFlow = computeInvestorCashFlow(project, scenario as any, undefined, sales);
  const investor = calculateInvestorMonthlyNet(cashFlow, sales);
  const capital = calculateInvestorCapitalSummary(cashFlow);
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const dates = cashFlow.monthDates.slice(0, totalMonths);
  const debits = investor.debitTotals.slice(0, totalMonths);
  const credits = investor.creditTotals.slice(0, totalMonths);
  const firstCreditIndex = credits.findIndex((value) => value > 0.000001);
  const lastDebitIndex = debits.reduce((last, value, index) => value > 0.000001 ? index : last, -1);
  const timelineNet = investor.netFlow.slice(0, totalMonths);
  const sum = (values: number[]) => values.reduce((total, value) => total + (value || 0), 0);
  const rowValues = (row: any) => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ].slice(0, totalMonths);
  const summarizeRows = (rows: any[]) => rows
    .map((row) => {
      const values = rowValues(row);
      const total = sum(values);
      const firstIndex = values.findIndex((value) => value > 0.000001);
      const lastIndex = values.reduce((last, value, index) => value > 0.000001 ? index : last, -1);
      return {
        label: row.label,
        total,
        firstMonth: firstIndex >= 0 ? dates[firstIndex] : null,
        lastMonth: lastIndex >= 0 ? dates[lastIndex] : null,
      };
    })
    .filter((row) => row.total > 0.000001);
  const futureDebitTotal = sum(debits);
  const creditTotal = sum(credits);
  const timelineNetTotal = sum(timelineNet);
  const arithmeticDelta = timelineNetTotal - (creditTotal - futureDebitTotal);
  const debitRows = summarizeRows(investor.debitRows);
  const creditRows = summarizeRows(investor.creditRows);
  const debitRowsDelta = futureDebitTotal - sum(debitRows.map((row) => row.total));
  const creditRowsDelta = creditTotal - sum(creditRows.map((row) => row.total));

  return {
    projectId: project.id,
    projectName: project.name,
    projectType: project.projectType,
    scenario,
    status: Math.abs(arithmeticDelta) < 0.01 ? "calculation_matched" : "needs_review",
    capital: {
      paid: capital.paidCapital,
      remaining: capital.remainingCapital,
      required: capital.requiredCapital,
      peakMonth: capital.peakMonthDate,
    },
    investorFlow: {
      futureDebitTotal,
      creditTotal,
      netTotal: timelineNetTotal,
      firstCreditMonth: firstCreditIndex >= 0 ? dates[firstCreditIndex] : null,
      lastDebitMonth: lastDebitIndex >= 0 ? dates[lastDebitIndex] : null,
      arithmeticDelta,
      debitRowsDelta,
      creditRowsDelta,
    },
    debitRows,
    creditRows,
  };
});

console.log(JSON.stringify({ projectIds: ELIGIBLE_PROJECT_IDS, audits }, null, 2));
process.exit(0);
