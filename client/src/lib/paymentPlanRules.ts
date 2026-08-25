import type { PaymentCalendarEntry, PaymentPlanMilestone } from "./flexiblePaymentPlan";
import { buildPaymentCalendar, type PaymentCalendarContext } from "./paymentPlanCalendar";

export type PaymentPlanRuleIssue = {
  entryId?: string;
  message: string;
};

export type ConstructionSeriesRequest = {
  totalPercentage: number;
  installmentPercentage: number;
  firstAfterMonths: number;
  everyMonths: number;
  previousMonth: number;
  nextSequence: number;
  recipient?: "escrow" | "investor";
};

export type PostHandoverSeriesRequest = {
  totalPercentage: number;
  termMonths: number;
  everyMonths: number;
  nextSequence: number;
  recipient?: "escrow" | "investor";
};

export function inferPaymentMilestone(entry: PaymentCalendarEntry, index = 0): PaymentPlanMilestone {
  if (entry.milestone) return entry.milestone;
  if (entry.timingRule === "booking") return "booking";
  if (entry.timingRule === "handover") return "handover";
  if (entry.timingRule === "post_handover") return "post_handover";
  const identity = `${entry.id} ${entry.label}`;
  if (/عقد|contract/i.test(identity) || index === 1) return "contract";
  return "construction";
}

/** Construction collections must finish two full calendar months before handover. */
export function constructionCollectionDeadline(context: PaymentCalendarContext): number {
  return Math.max(context.projectSalesStartMonth, context.constructionEndMonth - 2);
}

export function validatePaymentCalendarLogic(entries: PaymentCalendarEntry[], context: PaymentCalendarContext): PaymentPlanRuleIssue[] {
  const ordered = entries.slice().sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const rows = buildPaymentCalendar(ordered, context);
  const issues: PaymentPlanRuleIssue[] = [];
  let hasBooking = false;
  let hasContract = false;
  let hasHandover = false;
  const deadline = constructionCollectionDeadline(context);

  ordered.forEach((entry, index) => {
    const milestone = inferPaymentMilestone(entry, index);
    const row = rows[index];
    if (milestone === "booking") {
      if (index !== 0 || row.month !== context.projectSalesStartMonth) issues.push({ entryId: entry.id, message: "دفعة الحجز يجب أن تكون الدفعة الأولى عند تاريخ فتح البيع." });
      hasBooking = true;
      return;
    }
    if (!hasBooking) issues.push({ entryId: entry.id, message: "يجب إنشاء دفعة الحجز أولًا." });
    if (milestone === "contract") {
      if (index === 0) issues.push({ entryId: entry.id, message: "دفعة توقيع العقد تأتي بعد دفعة الحجز." });
      hasContract = true;
      return;
    }
    if (milestone === "construction") {
      if (!hasContract) issues.push({ entryId: entry.id, message: "دفعات الإنشاء تبدأ بعد توقيع العقد." });
      if (row.month > deadline) issues.push({ entryId: entry.id, message: `آخر دفعة أثناء الإنشاء يجب أن تكون قبل التسليم بشهرين على الأقل.` });
      if (hasHandover) issues.push({ entryId: entry.id, message: "لا يمكن وضع دفعة إنشاء بعد التسليم." });
      return;
    }
    if (milestone === "handover") {
      if (row.month !== context.constructionEndMonth) issues.push({ entryId: entry.id, message: "دفعة التسليم يجب أن توافق تاريخ التسليم الفعلي." });
      hasHandover = true;
      return;
    }
    if (milestone === "post_handover" && row.month <= context.constructionEndMonth) {
      issues.push({ entryId: entry.id, message: "دفعات ما بعد التسليم يجب أن تأتي بعد تاريخ التسليم." });
    }
  });

  const total = ordered.reduce((sum, entry) => sum + Math.max(0, Number(entry.percentage) || 0), 0);
  if (total > 100.001) issues.push({ message: "مجموع الدفعات لا يمكن أن يتجاوز 100%." });
  return issues;
}

export function createConstructionSeries(request: ConstructionSeriesRequest, context: PaymentCalendarContext): { entries?: PaymentCalendarEntry[]; error?: string } {
  const total = Math.max(0, Number(request.totalPercentage) || 0);
  const perInstallment = Math.max(0.01, Number(request.installmentPercentage) || 0);
  const firstAfter = Math.max(1, Math.floor(Number(request.firstAfterMonths) || 1));
  const every = Math.max(1, Math.floor(Number(request.everyMonths) || 1));
  if (total <= 0) return { error: "أدخل إجمالي نسبة دفعات الإنشاء." };
  if (perInstallment > total) return { error: "نسبة الدفعة الواحدة لا يمكن أن تتجاوز إجمالي دفعات الإنشاء." };

  const count = Math.ceil(total / perInstallment);
  const firstMonth = request.previousMonth + firstAfter;
  const lastMonth = firstMonth + ((count - 1) * every);
  const deadline = constructionCollectionDeadline(context);
  if (firstMonth > deadline) return { error: "لا توجد فترة كافية بعد الدفعة السابقة وقبل هامش التسليم لإضافة دفعة إنشاء." };
  if (lastMonth > deadline) {
    const possibleCount = Math.max(0, Math.floor((deadline - firstMonth) / every) + 1);
    const possibleTotal = Math.round(Math.min(total, possibleCount * perInstallment) * 100) / 100;
    return { error: `هذا التوزيع غير واقعي: يتسع البرنامج لـ ${possibleCount} دفعة فقط بإجمالي ${possibleTotal}% قبل هامش التسليم. قصّر الفاصل أو ابدأ أبكر أو خفف إجمالي دفعات الإنشاء.` };
  }

  let remaining = total;
  const entries: PaymentCalendarEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const percentage = Math.round(Math.min(perInstallment, remaining) * 100) / 100;
    remaining = Math.round((remaining - percentage) * 100) / 100;
    entries.push({
      id: `construction-${Date.now()}-${index + 1}`,
      sequence: request.nextSequence + index,
      label: `قسط الإنشاء ${index + 1}`,
      percentage,
      recipient: request.recipient || "escrow",
      milestone: "construction",
      timingRule: "after_previous",
      offsetMonths: index === 0 ? firstAfter : every,
    });
  }
  return { entries };
}

export function createPostHandoverSeries(request: PostHandoverSeriesRequest): { entries?: PaymentCalendarEntry[]; error?: string } {
  const total = Math.max(0, Number(request.totalPercentage) || 0);
  const term = Math.max(1, Math.floor(Number(request.termMonths) || 0));
  const every = Math.max(1, Math.floor(Number(request.everyMonths) || 0));
  if (total <= 0) return { error: "أدخل إجمالي نسبة دفعات ما بعد التسليم." };
  if (![24, 48].includes(term)) return { error: "اختر مدة 24 أو 48 شهرًا لدفعات ما بعد التسليم." };
  if (![4, 6].includes(every)) return { error: "اختر دفعة كل 4 أو 6 أشهر لما بعد التسليم." };
  const count = term / every;
  const portion = Math.round((total / count) * 100) / 100;
  let remaining = total;
  const entries: PaymentCalendarEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const percentage = index === count - 1 ? Math.round(remaining * 100) / 100 : portion;
    remaining = Math.round((remaining - percentage) * 100) / 100;
    entries.push({
      id: `post-handover-${Date.now()}-${index + 1}`,
      sequence: request.nextSequence + index,
      label: `دفعة ما بعد التسليم ${index + 1}`,
      percentage,
      recipient: request.recipient || "investor",
      milestone: "post_handover",
      timingRule: "post_handover",
      offsetMonths: every * (index + 1),
    });
  }
  return { entries };
}
