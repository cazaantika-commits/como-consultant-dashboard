export type PaymentStageTrigger = "sale" | "months_after_sale" | "construction_progress" | "handover" | "post_handover";
export type PaymentRecipient = "escrow" | "investor";

export interface PaymentPlanStage {
  id: string;
  label: string;
  trigger: PaymentStageTrigger;
  percentage: number;
  recipient: PaymentRecipient;
  offsetMonths?: number;
  everyMonths?: number;
  installmentCount?: number;
  untilHandover?: boolean;
  progressPct?: number;
}

export interface FlexiblePaymentPlan {
  version: 2;
  stages: PaymentPlanStage[];
}

export interface LegacyPaymentPlan {
  downPct: number;
  secondPct: number;
  secondAfterMonths: number;
  duringTotalPct: number;
  installmentEveryMonths: number;
  handoverPct: number;
}

export interface PaymentReceiptEvent {
  month: number;
  pct: number;
  recipient: PaymentRecipient;
  stageId: string;
  stageLabel: string;
}

export const DEFAULT_FLEXIBLE_PAYMENT_PLAN: FlexiblePaymentPlan = {
  version: 2,
  stages: [
    { id: "booking", label: "مقدم الحجز", trigger: "sale", percentage: 10, recipient: "escrow", installmentCount: 1 },
    { id: "second", label: "دفعة بعد الحجز", trigger: "months_after_sale", percentage: 10, recipient: "escrow", offsetMonths: 1, installmentCount: 1 },
    { id: "construction", label: "أقساط أثناء الإنشاء", trigger: "months_after_sale", percentage: 40, recipient: "escrow", offsetMonths: 7, everyMonths: 6, untilHandover: true },
    { id: "handover", label: "دفعة التسليم", trigger: "handover", percentage: 40, recipient: "escrow", installmentCount: 1 },
  ],
};

export function cloneFlexiblePaymentPlan(plan: FlexiblePaymentPlan = DEFAULT_FLEXIBLE_PAYMENT_PLAN): FlexiblePaymentPlan {
  return { version: 2, stages: plan.stages.map((stage) => ({ ...stage })) };
}

export function isFlexiblePaymentPlan(value: unknown): value is FlexiblePaymentPlan {
  return !!value
    && typeof value === "object"
    && (value as FlexiblePaymentPlan).version === 2
    && Array.isArray((value as FlexiblePaymentPlan).stages);
}

export function paymentPlanTotalPercentage(plan: FlexiblePaymentPlan): number {
  return plan.stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.percentage) || 0), 0);
}

export function legacyPaymentPlanToFlexible(plan: Partial<LegacyPaymentPlan> | undefined): FlexiblePaymentPlan {
  const downPct = Math.max(0, Number(plan?.downPct ?? 10));
  const secondPct = Math.max(0, Number(plan?.secondPct ?? 10));
  const duringTotalPct = Math.max(0, Number(plan?.duringTotalPct ?? 40));
  const handoverPct = Math.max(0, Number(plan?.handoverPct ?? 40));
  const secondAfterMonths = Math.max(0, Math.floor(Number(plan?.secondAfterMonths ?? 1)));
  const every = Math.max(1, Math.floor(Number(plan?.installmentEveryMonths ?? 6)));
  return {
    version: 2,
    stages: [
      { id: "booking", label: "مقدم الحجز", trigger: "sale", percentage: downPct, recipient: "escrow", installmentCount: 1 },
      { id: "second", label: "دفعة بعد الحجز", trigger: "months_after_sale", percentage: secondPct, recipient: "escrow", offsetMonths: secondAfterMonths, installmentCount: 1 },
      { id: "construction", label: "أقساط أثناء الإنشاء", trigger: "months_after_sale", percentage: duringTotalPct, recipient: "escrow", offsetMonths: secondAfterMonths + every, everyMonths: every, installmentCount: 1 },
      { id: "handover", label: "دفعة التسليم", trigger: "handover", percentage: handoverPct, recipient: "escrow", installmentCount: 1 },
    ],
  };
}

export function normalizeFlexiblePaymentPlan(value: unknown): FlexiblePaymentPlan {
  if (isFlexiblePaymentPlan(value)) {
    return {
      version: 2,
      stages: value.stages.map((stage, index) => ({
        id: stage.id || `stage-${index + 1}`,
        label: stage.label || `دفعة ${index + 1}`,
        trigger: ["sale", "months_after_sale", "construction_progress", "handover", "post_handover"].includes(stage.trigger)
          ? stage.trigger
          : "sale",
        percentage: Math.max(0, Number(stage.percentage) || 0),
        recipient: stage.recipient === "investor" ? "investor" : "escrow",
        offsetMonths: Math.max(0, Math.floor(Number(stage.offsetMonths) || 0)),
        everyMonths: Math.max(1, Math.floor(Number(stage.everyMonths) || 1)),
        installmentCount: Math.max(1, Math.floor(Number(stage.installmentCount) || 1)),
        untilHandover: Boolean(stage.untilHandover),
        progressPct: Math.min(100, Math.max(0, Number(stage.progressPct) || 0)),
      })),
    };
  }
  return legacyPaymentPlanToFlexible(value as Partial<LegacyPaymentPlan>);
}

export function getPaymentPlanPostHandoverMonths(plan: FlexiblePaymentPlan): number {
  return plan.stages.reduce((maximum, stage) => {
    if (stage.trigger !== "post_handover") return maximum;
    const offset = Math.max(1, Number(stage.offsetMonths) || 1);
    const count = Math.max(1, Number(stage.installmentCount) || 1);
    const every = Math.max(1, Number(stage.everyMonths) || 1);
    return Math.max(maximum, offset + ((count - 1) * every));
  }, 0);
}

export function buildPaymentReceiptEvents({
  plan,
  saleMonth,
  constructionStartMonth,
  constructionEndMonth,
}: {
  plan: FlexiblePaymentPlan;
  saleMonth: number;
  constructionStartMonth: number;
  constructionEndMonth: number;
}): PaymentReceiptEvent[] {
  const events: PaymentReceiptEvent[] = [];
  for (const stage of plan.stages) {
    const every = Math.max(1, Math.floor(Number(stage.everyMonths) || 1));
    let startMonth = saleMonth;
    if (stage.trigger === "months_after_sale") {
      startMonth = saleMonth + Math.max(0, Number(stage.offsetMonths) || 0);
    } else if (stage.trigger === "construction_progress") {
      const progress = Math.min(100, Math.max(0, Number(stage.progressPct) || 0));
      const constructionMonths = Math.max(1, constructionEndMonth - constructionStartMonth + 1);
      startMonth = Math.max(saleMonth, constructionStartMonth + Math.ceil((progress / 100) * constructionMonths) - 1);
    } else if (stage.trigger === "handover") {
      startMonth = constructionEndMonth + Math.max(0, Number(stage.offsetMonths) || 0);
    } else if (stage.trigger === "post_handover") {
      startMonth = constructionEndMonth + Math.max(1, Number(stage.offsetMonths) || 1);
    }
    // A buyer who purchases near completion must not have an "until handover"
    // installment drift into the post-handover calendar. Any construction-stage
    // portion that cannot form its normal cadence is due no later than handover.
    if (stage.untilHandover) {
      startMonth = Math.min(startMonth, constructionEndMonth);
    }
    const count = stage.untilHandover
      ? Math.max(1, Math.floor((constructionEndMonth - startMonth) / every) + 1)
      : Math.max(1, Math.floor(Number(stage.installmentCount) || 1));
    const portion = Math.max(0, Number(stage.percentage) || 0) / count;
    for (let index = 0; index < count; index++) {
      events.push({
        month: startMonth + (index * every),
        pct: portion,
        recipient: stage.recipient,
        stageId: stage.id,
        stageLabel: stage.label,
      });
    }
  }
  return events.filter((event) => event.pct > 0 && event.month > 0).sort((a, b) => a.month - b.month);
}
