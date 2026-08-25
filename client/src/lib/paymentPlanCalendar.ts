import {
  getPaymentPlanMilestone,
  type FlexiblePaymentPlan,
  type PaymentCalendarEntry,
  type PaymentCalendarTimingRule,
  type PaymentRecipient,
} from "./flexiblePaymentPlan";

export type PaymentCalendarContext = {
  projectSalesStartMonth: number;
  constructionStartMonth: number;
  constructionEndMonth: number;
  projectStartDate?: string;
};

export type PaymentCalendarRow = {
  id: string;
  sequence: number;
  label: string;
  percentage: number;
  recipient: PaymentRecipient;
  timingRule: PaymentCalendarTimingRule;
  month: number;
  automatic: boolean;
};

function projectMonthFromDate(value: string | undefined, projectStartDate: string | undefined): number | null {
  if (!value || !projectStartDate) return null;
  const due = String(value).match(/^(\d{4})-(\d{2})/);
  const start = String(projectStartDate).match(/^(\d{4})-(\d{2})/);
  if (!due || !start) return null;
  return ((Number(due[1]) - Number(start[1])) * 12) + Number(due[2]) - Number(start[2]) + 1;
}

/** Turns saved milestone data into an editable project calendar without rewriting it. */
export function calendarEntriesFromPlan(plan: FlexiblePaymentPlan): PaymentCalendarEntry[] {
  if (plan.calendarEntries?.length) {
    return plan.calendarEntries
      .map((entry, index) => ({ ...entry, sequence: Math.max(1, Number(entry.sequence) || index + 1) }))
      .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  }
  return plan.stages.map((stage, index) => {
    const milestone = getPaymentPlanMilestone(stage);
    const timingRule: PaymentCalendarTimingRule = milestone === "booking"
      ? "booking"
      : milestone === "contract"
        ? "after_previous"
        : milestone === "construction"
          ? "construction_progress"
          : milestone === "handover"
            ? "handover"
            : "post_handover";
    return {
      id: stage.id || `payment-${index + 1}`,
      sequence: index + 1,
      label: stage.label || `دفعة ${index + 1}`,
      percentage: Math.max(0, Number(stage.percentage) || 0),
      recipient: stage.recipient,
      timingRule,
      offsetMonths: Math.max(0, Number(stage.offsetMonths) || (timingRule === "after_previous" ? 1 : 0)),
      progressPct: Math.min(100, Math.max(0, Number(stage.progressPct) || 0)),
    };
  });
}

/** Calculates project-wide due months. A manual date locks only that one row. */
export function buildPaymentCalendar(entries: PaymentCalendarEntry[], context: PaymentCalendarContext): PaymentCalendarRow[] {
  const ordered = entries.slice().sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const constructionMonths = Math.max(1, context.constructionEndMonth - context.constructionStartMonth + 1);
  let previousMonth = context.projectSalesStartMonth;
  return ordered.map((entry, index) => {
    const rule = entry.timingRule;
    const manualMonth = rule === "manual_date" ? projectMonthFromDate(entry.manualDate, context.projectStartDate) : null;
    let month = context.projectSalesStartMonth;
    if (rule === "after_previous") month = previousMonth + Math.max(0, Number(entry.offsetMonths) || 0);
    if (rule === "construction_progress") {
      const progress = Math.min(100, Math.max(0, Number(entry.progressPct) || 0));
      month = context.constructionStartMonth + Math.max(0, Math.ceil((progress / 100) * constructionMonths) - 1);
    }
    if (rule === "handover") month = context.constructionEndMonth;
    if (rule === "post_handover") month = context.constructionEndMonth + Math.max(1, Number(entry.offsetMonths) || 1);
    if (manualMonth !== null) month = manualMonth;
    month = Math.max(1, month);
    previousMonth = month;
    return {
      id: entry.id,
      sequence: Math.max(1, Number(entry.sequence) || index + 1),
      label: entry.label || `دفعة ${index + 1}`,
      percentage: Math.max(0, Number(entry.percentage) || 0),
      recipient: entry.recipient === "investor" ? "investor" : "escrow",
      timingRule: rule,
      month,
      automatic: rule !== "manual_date",
    };
  });
}

/** A buyer pays every installment already due when the purchase takes place. */
export function buyerDueCalendar(rows: PaymentCalendarRow[], purchaseMonth: number): PaymentCalendarRow[] {
  return rows.map((row) => ({ ...row, month: Math.max(Math.max(1, purchaseMonth), row.month) }));
}

export function paymentCalendarTotal(entries: PaymentCalendarEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.percentage) || 0), 0);
}
