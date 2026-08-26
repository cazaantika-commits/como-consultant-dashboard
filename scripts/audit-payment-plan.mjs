import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects, waelSalesPlans } from "../drizzle/schema.ts";
import { normalizeFlexiblePaymentPlan } from "../client/src/lib/flexiblePaymentPlan.ts";
import {
  buildPaymentCalendar,
  buyerDueCalendar,
  calendarEntriesFromPlan,
  expandPaymentCalendarEntries,
  paymentCalendarTotal,
} from "../client/src/lib/paymentPlanCalendar.ts";
import { validatePaymentCalendarLogic } from "../client/src/lib/paymentPlanRules.ts";
import { getProjectMarketingTiming } from "../client/src/lib/projectTiming.ts";

const projectId = Number(process.argv[2] || 5);
const db = await getDb();
if (!db) throw new Error("Database unavailable");

const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
const [saved] = await db.select().from(waelSalesPlans)
  .where(eq(waelSalesPlans.projectId, projectId))
  .orderBy(desc(waelSalesPlans.updatedAt), desc(waelSalesPlans.id))
  .limit(1);
if (!project || !saved) throw new Error(`Project or payment plan unavailable for project ${projectId}`);

const plan = normalizeFlexiblePaymentPlan(JSON.parse(saved.paymentPlanJson || "{}"));
const timing = getProjectMarketingTiming(project);
const context = {
  projectSalesStartMonth: timing.salesStartMonth,
  constructionStartMonth: timing.constructionStartMonth,
  constructionEndMonth: timing.projectEndMonth,
  projectStartDate: project.startDate,
};
const entries = expandPaymentCalendarEntries(calendarEntriesFromPlan(plan), context);
const calendar = buildPaymentCalendar(entries, context);
let results = {};
try { results = JSON.parse(saved.resultsJson || "{}"); } catch { results = {}; }
const salesDistribution = Array.isArray(results.salesDistribution)
  ? results.salesDistribution.map((value) => Math.max(0, Number(value) || 0))
  : [];
const totalSoldUnits = salesDistribution.reduce((sum, value) => sum + value, 0);
const averageUnitRevenue = totalSoldUnits > 0 ? Number(saved.totalRevenue || 0) / totalSoldUnits : 0;
const currentEscrowReceipts = [];
salesDistribution.forEach((units, index) => {
  const saleMonth = timing.salesStartMonth + index;
  const saleRevenue = units * averageUnitRevenue;
  buyerDueCalendar(calendar, saleMonth).forEach((event) => {
    if (event.recipient !== "escrow") return;
    currentEscrowReceipts[event.month - 1] = (currentEscrowReceipts[event.month - 1] || 0) + saleRevenue * event.percentage / 100;
  });
});
const savedEscrowReceipts = Array.isArray(results.actualEscrowCashInflow)
  ? results.actualEscrowCashInflow.map((value) => Math.max(0, Number(value) || 0))
  : [];
const startMatch = String(project.startDate || "").match(/^(\d{4})-(\d{2})/);
const monthLabel = (month) => {
  if (!startMatch) return `Month ${month}`;
  const date = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1 + month - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

console.log(JSON.stringify({
  project: {
    id: project.id,
    name: project.name,
    startDate: project.startDate,
    designMonths: timing.designMonths,
    constructionMonths: Number(project.constructionMonths),
    salesStartMonth: timing.salesStartMonth,
    salesStartDate: monthLabel(timing.salesStartMonth),
    constructionStartMonth: timing.constructionStartMonth,
    constructionStartDate: monthLabel(timing.constructionStartMonth),
    handoverMonth: timing.projectEndMonth,
    handoverDate: monthLabel(timing.projectEndMonth),
  },
  savedPlan: {
    id: saved.id,
    totalPercentage: paymentCalendarTotal(entries),
    legacyFields: {
      bookingPct: Number(saved.paymentBookingPct),
      spaPct: Number(saved.paymentSpaPct),
      constructionPct: Number(saved.paymentConstructionPct),
      handoverPct: Number(saved.paymentHandoverPct),
      constructionFrequency: saved.paymentConstructionFrequency,
    },
  },
  rows: calendar.map((row) => ({
    sequence: row.sequence,
    label: row.label,
    percentage: row.percentage,
    recipient: row.recipient,
    timingRule: row.timingRule,
    month: row.month,
    date: monthLabel(row.month),
    phase: row.month > timing.projectEndMonth
      ? "post_handover"
      : row.month === timing.projectEndMonth
        ? "handover"
        : "pre_handover",
  })),
  resultComparison: {
    salesDistribution,
    currentCalendarPostHandoverReceipts: currentEscrowReceipts
      .map((amount, index) => ({ month: index + 1, date: monthLabel(index + 1), amount: amount || 0 }))
      .filter((item) => item.month > timing.projectEndMonth && item.amount > 0),
    savedResultsPostHandoverReceipts: savedEscrowReceipts
      .map((amount, index) => ({ month: index + 1, date: monthLabel(index + 1), amount: amount || 0 }))
      .filter((item) => item.month > timing.projectEndMonth && item.amount > 0),
    currentCalendarTotal: currentEscrowReceipts.reduce((sum, value) => sum + (value || 0), 0),
    savedResultsTotal: savedEscrowReceipts.reduce((sum, value) => sum + (value || 0), 0),
  },
  issues: validatePaymentCalendarLogic(entries, context),
}, null, 2));
process.exit(0);
