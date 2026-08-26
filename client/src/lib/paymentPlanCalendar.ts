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

/**
 * Version one of the calendar persisted a 0%-progress construction row. That
 * represented a construction start, but it incorrectly became a buyer due date
 * before booking whenever construction preceded sales. Keep the record, but
 * turn it into the first construction installment after the contract.
 */
export function normalizePaymentCalendarEntries(entries: PaymentCalendarEntry[]): PaymentCalendarEntry[] {
  return entries
    .map((entry, index) => {
      const base = { ...entry, sequence: Math.max(1, Number(entry.sequence) || index + 1) };
      if (base.timingRule === "construction_progress" && Number(base.progressPct) <= 0) {
        return {
          ...base,
          timingRule: "after_previous" as const,
          offsetMonths: Math.max(1, Number(base.offsetMonths) || 3),
        };
      }
      return base;
    })
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}

function isConstructionSeries(entry: PaymentCalendarEntry): boolean {
  const label = entry.label || "";
  return entry.percentage > 0
    && (entry.timingRule === "construction_progress" || entry.timingRule === "after_previous")
    && (/دفعات.*إنشاء|أقساط.*إنشاء|أثناء الإنشاء/.test(label) || (entry.timingRule === "construction_progress" && Number(entry.progressPct) <= 0));
}

/**
 * A periodic construction allocation is never shown as one opaque total. It is
 * expanded into the actual installments that a buyer will see and pay. The
 * final construction installment stays before handover; handover has its own row.
 */
export function expandPaymentCalendarEntries(entries: PaymentCalendarEntry[], context: PaymentCalendarContext): PaymentCalendarEntry[] {
  const normalized = normalizePaymentCalendarEntries(entries);
  const expanded: PaymentCalendarEntry[] = [];
  let previousMonth = context.projectSalesStartMonth;

  for (const entry of normalized) {
    const plannedPrevious = buildPaymentCalendar(expanded, context).at(-1)?.month ?? previousMonth;
    previousMonth = plannedPrevious;
    if (!isConstructionSeries(entry)) {
      expanded.push({ ...entry, sequence: expanded.length + 1 });
      previousMonth = buildPaymentCalendar(expanded, context).at(-1)?.month ?? previousMonth;
      continue;
    }

    const everyMonths = Math.max(1, Number(entry.offsetMonths) || 3);
    const firstMonth = Math.max(context.projectSalesStartMonth, context.constructionStartMonth, previousMonth + everyMonths);
    const lastConstructionCollectionMonth = Math.max(firstMonth, context.constructionEndMonth - 1);
    const count = Math.max(1, Math.floor((lastConstructionCollectionMonth - firstMonth) / everyMonths) + 1);
    const installmentPct = Math.round((entry.percentage / count) * 100) / 100;
    const labelBase = entry.label.includes("دفعات") || entry.label.includes("أقساط") ? "قسط الإنشاء" : entry.label;
    for (let index = 0; index < count; index += 1) {
      const portion = index === count - 1
        ? Math.round((entry.percentage - installmentPct * (count - 1)) * 100) / 100
        : installmentPct;
      expanded.push({
        id: `${entry.id}-installment-${index + 1}`,
        sequence: expanded.length + 1,
        label: `${labelBase} ${index + 1}`,
        percentage: portion,
        recipient: entry.recipient,
        timingRule: "after_previous",
        offsetMonths: index === 0 ? Math.max(1, firstMonth - previousMonth) : everyMonths,
      });
    }
    previousMonth = buildPaymentCalendar(expanded, context).at(-1)?.month ?? previousMonth;
  }
  return expanded.map((entry, index) => ({ ...entry, sequence: index + 1 }));
}

/** Turns saved milestone data into an editable project calendar without rewriting it. */
export function calendarEntriesFromPlan(plan: FlexiblePaymentPlan): PaymentCalendarEntry[] {
  if (plan.calendarEntries?.length) {
    return normalizePaymentCalendarEntries(plan.calendarEntries);
  }
  return plan.stages.map((stage, index) => {
    const milestone = getPaymentPlanMilestone(stage);
    const timingRule: PaymentCalendarTimingRule = milestone === "booking"
      ? "booking"
      : milestone === "contract"
        ? "after_previous"
        : milestone === "construction"
          // A legacy 0% construction trigger means the project broke ground,
          // not that a buyer owes money before booking. Convert it into the
          // first scheduled construction installment after the contract.
          ? (Number(stage.progressPct) > 0 ? "construction_progress" : "after_previous")
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
      offsetMonths: Math.max(0, Number(stage.offsetMonths) || (timingRule === "after_previous" ? Math.max(1, Number(stage.everyMonths) || 1) : 0)),
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
    // The page is a chronological buyer commitment. Manual changes remain
    // possible, but a row can never become due before its predecessor.
    month = Math.max(1, index === 0 ? context.projectSalesStartMonth : previousMonth, month);
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
