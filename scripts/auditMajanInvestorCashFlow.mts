import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";

const PROJECT_ID = 2;
const db = await getDb();
if (!db) throw new Error("Database is unavailable");

const [project] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID));
if (!project) throw new Error("Majan project not found");
const [plan] = await db.select().from(waelSalesPlans).where(eq(waelSalesPlans.projectId, PROJECT_ID));
if (!plan) throw new Error("Majan sales plan not found");

const scenario = project.financingScenario || "offplan_escrow";
const sales = buildSalesResultFromSavedPlan(plan, project, scenario as any);
const cashFlow = computeInvestorCashFlow(project, scenario as any, undefined, sales);
const investor = calculateInvestorMonthlyNet(cashFlow, sales);
const capital = calculateInvestorCapitalSummary(cashFlow);
const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
const rowValues = (row: any) => [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths].slice(0, totalMonths);
const summarizeRows = (rows: any[]) => rows.map((row) => ({
  label: row.label,
  funder: row.funder,
  total: rowValues(row).reduce((sum: number, value: number) => sum + (value || 0), 0),
  paid: Number(row.paid || 0),
  unpaid: Number(row.unpaid || 0),
})).filter((row) => Math.abs(row.total) > 0.000001 || row.paid > 0);

const timeline = cashFlow.monthDates.slice(0, totalMonths).map((date, index) => ({
  date,
  investorDebit: investor.debitTotals[index] || 0,
  investorCredit: investor.creditTotals[index] || 0,
  net: investor.netFlow[index] || 0,
  cumulativeBeforePaid: investor.cumulative[index] || 0,
}));

console.log(JSON.stringify({
  project: { id: project.id, name: project.name, scenario, startDate: cashFlow.startDate, months: totalMonths },
  capital: {
    paidCapital: capital.paidCapital,
    remainingCapital: capital.remainingCapital,
    requiredCapital: capital.requiredCapital,
    peakDate: capital.peakMonthDate,
  },
  totals: {
    futureInvestorDebits: investor.debitTotals.reduce((sum, value) => sum + value, 0),
    investorCredits: investor.creditTotals.reduce((sum, value) => sum + value, 0),
    netInvestorCashFlow: investor.netFlow.reduce((sum, value) => sum + value, 0),
  },
  paidRows: summarizeRows(investor.paidRows),
  futureDebitRows: summarizeRows(investor.debitRows),
  creditRows: summarizeRows(investor.creditRows),
  timeline,
}, null, 2));
process.exit(0);
