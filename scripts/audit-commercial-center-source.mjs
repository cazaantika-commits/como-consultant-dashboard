import { eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects } from "../drizzle/schema.ts";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet.ts";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine.ts";

const FILS = 0.001;
const db = await getDb();
if (!db) throw new Error("Database unavailable");

const [commercialCenter] = await db
  .select()
  .from(projects)
  .where(eq(projects.financingScenario, "build_for_rent"));

if (!commercialCenter) throw new Error("No build-for-rent project found");

const cashFlow = computeInvestorCashFlow(commercialCenter, "build_for_rent");
const investorNet = calculateInvestorMonthlyNet(cashFlow);
const rowMonthlyValues = (row) => [
  ...row.designMonths,
  ...row.constructionMonths,
  ...row.postConstructionMonths,
].slice(0, investorNet.netFlow.length);
const isRentalRow = (row) => /إيجار|تأجير|rent/i.test(row.label);
const isOperatingRow = (row) => /تشغيل|إدارة المرافق|operat/i.test(row.label);
const rows = cashFlow.rows.map((row) => ({
  label: row.label,
  section: row.section,
  isRevenue: Boolean(row.isRevenue),
  investorAmount: row.investorAmount,
  totalCost: row.totalCost,
  nonZeroMonthCount: rowMonthlyValues(row).filter((value) => Math.abs(value) >= FILS).length,
}));
const rentalRows = cashFlow.rows.filter(isRentalRow);
const operatingRows = cashFlow.rows.filter(isOperatingRow);
const revenueRows = cashFlow.rows.filter((row) => row.isRevenue);
const postStartIndex = cashFlow.designDuration + cashFlow.constructionDuration;
const netMonthlyFlow = investorNet.netFlow;
const debitMonthlyFlow = investorNet.debitTotals;
const creditMonthlyFlow = investorNet.creditTotals;
const cumulative = [];
let running = -investorNet.paidBeforeSchedule;
for (const value of netMonthlyFlow) {
  running += value;
  cumulative.push(running);
}
const postCompletionRows = cashFlow.rows.map((row) => ({
  label: row.label,
  values: rowMonthlyValues(row).slice(postStartIndex),
})).filter((row) => row.values.some((value) => Math.abs(value) >= FILS));

const audit = {
  project: {
    id: commercialCenter.id,
    name: commercialCenter.name,
    financingScenario: commercialCenter.financingScenario,
    startDate: cashFlow.startDate,
    designMonths: cashFlow.designDuration,
    constructionMonths: cashFlow.constructionDuration,
    postCompletionMonths: cashFlow.postDuration,
  },
  finalMonthlySource: {
    monthDates: cashFlow.monthDates.slice(0, netMonthlyFlow.length),
    debitMonthlyFlow,
    creditMonthlyFlow,
    netMonthlyFlow,
    cumulative,
    paidBeforeSchedule: investorNet.paidBeforeSchedule,
  },
  sourceRows: rows,
  postCompletionRows,
  sourceAudit: {
    developmentOutflowRowsPresent: cashFlow.rows.some((row) => !row.isRevenue && row.investorAmount > FILS),
    rentalRevenueRowsPresent: rentalRows.length > 0 && rentalRows.some((row) => row.isRevenue && row.totalCost > FILS),
    operatingExpenseRowsPresent: operatingRows.length > 0 && operatingRows.some((row) => row.totalCost > FILS),
    genericRevenueRowsPresent: revenueRows.length > 0,
    totalRentalRevenue: rentalRows.reduce((sum, row) => sum + row.totalCost, 0),
    totalOperatingExpense: operatingRows.reduce((sum, row) => sum + row.totalCost, 0),
    totalCredits: creditMonthlyFlow.reduce((sum, value) => sum + value, 0),
    postCompletionCreditCount: creditMonthlyFlow.slice(postStartIndex).filter((value) => Math.abs(value) >= FILS).length,
  },
};

audit.sourceAudit.acceptedForUnifiedGroupCashFlow = audit.sourceAudit.developmentOutflowRowsPresent
  && audit.sourceAudit.rentalRevenueRowsPresent
  && audit.sourceAudit.operatingExpenseRowsPresent
  && audit.sourceAudit.postCompletionCreditCount > 0;

console.log(JSON.stringify(audit, null, 2));
process.exit(audit.sourceAudit.acceptedForUnifiedGroupCashFlow ? 0 : 2);
