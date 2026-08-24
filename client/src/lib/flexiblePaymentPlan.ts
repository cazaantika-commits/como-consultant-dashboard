export type PaymentRecipient = "escrow" | "investor";

export type PaymentStageTrigger =
  | "sale"
  | "months_after_sale"
  | "construction_progress"
  | "handover"
  | "post_handover";

export type PaymentPlanMilestone = "booking" | "contract" | "construction" | "handover" | "post_handover";

export interface PaymentPlanStage {
  id: string;
  label: string;
  trigger: PaymentStageTrigger;
  percentage: number;
  recipient: PaymentRecipient;
  milestone?: PaymentPlanMilestone;
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

export const PAYMENT_MILESTONE_LABELS: Record<PaymentPlanMilestone, string> = {
  booking: "دفعة الحجز",
  contract: "دفعة توقيع العقد",
  construction: "دفعات أثناء الإنشاء",
  handover: "دفعة التسليم",
  post_handover: "دفعات ما بعد التسليم",
};

export const DEFAULT_FLEXIBLE_PAYMENT_PLAN: FlexiblePaymentPlan = {
  version: 2,
  stages: [
    { id: "booking", label: "دفعة الحجز", milestone: "booking", trigger: "sale", percentage: 10, recipient: "escrow", installmentCount: 1 },
    { id: "contract", label: "دفعة توقيع العقد", milestone: "contract", trigger: "months_after_sale", percentage: 10, recipient: "escrow", offsetMonths: 1, installmentCount: 1 },
    { id: "construction", label: "دفعات أثناء الإنشاء", milestone: "construction", trigger: "construction_progress", percentage: 40, recipient: "escrow", progressPct: 0, everyMonths: 3, untilHandover: true },
    { id: "handover", label: "دفعة التسليم", milestone: "handover", trigger: "handover", percentage: 40, recipient: "escrow", installmentCount: 1 },
  ],
};

export function getPaymentPlanMilestone(stage: PaymentPlanStage): PaymentPlanMilestone {
  if (stage.milestone && Object.prototype.hasOwnProperty.call(PAYMENT_MILESTONE_LABELS, stage.milestone)) return stage.milestone;
  const identity = `${stage.id} ${stage.label}`.toLowerCase();
  if (stage.trigger === "post_handover" || identity.includes("post") || identity.includes("بعد التسليم")) return "post_handover";
  if (stage.trigger === "handover" || identity.includes("handover") || identity.includes("التسليم")) return "handover";
  if (stage.trigger === "construction_progress" || identity.includes("construction") || identity.includes("إنشاء") || identity.includes("قسط")) return "construction";
  if (identity.includes("contract") || identity.includes("second") || identity.includes("العقد") || identity.includes("بعد الحجز")) return "contract";
  return "booking";
}

export function createPaymentPlanStage(milestone: PaymentPlanMilestone, id = `${milestone}-${Date.now()}`): PaymentPlanStage {
  const base = { id, milestone, percentage: 0, recipient: "escrow" as PaymentRecipient };
  if (milestone === "booking") return { ...base, label: PAYMENT_MILESTONE_LABELS.booking, trigger: "sale", installmentCount: 1 };
  if (milestone === "contract") return { ...base, label: PAYMENT_MILESTONE_LABELS.contract, trigger: "months_after_sale", offsetMonths: 1, installmentCount: 1 };
  if (milestone === "construction") return { ...base, label: PAYMENT_MILESTONE_LABELS.construction, trigger: "construction_progress", progressPct: 0, everyMonths: 3, untilHandover: true };
  if (milestone === "handover") return { ...base, label: PAYMENT_MILESTONE_LABELS.handover, trigger: "handover", installmentCount: 1 };
  return { ...base, label: PAYMENT_MILESTONE_LABELS.post_handover, trigger: "post_handover", recipient: "investor", offsetMonths: 1, everyMonths: 3, installmentCount: 8 };
}

export function cloneFlexiblePaymentPlan(plan: FlexiblePaymentPlan = DEFAULT_FLEXIBLE_PAYMENT_PLAN): FlexiblePaymentPlan {
  return { version: 2, stages: plan.stages.map((stage) => ({ ...stage })) };
}

export function isFlexiblePaymentPlan(value: unknown): value is FlexiblePaymentPlan {
  return !!value && typeof value === "object" && (value as FlexiblePaymentPlan).version === 2 && Array.isArray((value as FlexiblePaymentPlan).stages);
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
  const every = Math.max(1, Math.floor(Number(plan?.installmentEveryMonths ?? 3)));
  return {
    version: 2,
    stages: [
      { id: "booking", label: "دفعة الحجز", milestone: "booking", trigger: "sale", percentage: downPct, recipient: "escrow", installmentCount: 1 },
      { id: "contract", label: "دفعة توقيع العقد", milestone: "contract", trigger: "months_after_sale", percentage: secondPct, recipient: "escrow", offsetMonths: secondAfterMonths, installmentCount: 1 },
      { id: "construction", label: "دفعات أثناء الإنشاء", milestone: "construction", trigger: "construction_progress", percentage: duringTotalPct, recipient: "escrow", progressPct: 0, everyMonths: every, untilHandover: true },
      { id: "handover", label: "دفعة التسليم", milestone: "handover", trigger: "handover", percentage: handoverPct, recipient: "escrow", installmentCount: 1 },
    ],
  };
}

export function normalizeFlexiblePaymentPlan(value: unknown): FlexiblePaymentPlan {
  if (isFlexiblePaymentPlan(value)) {
    return {
      version: 2,
      stages: value.stages.map((stage, index) => {
        const safeTrigger = ["sale", "months_after_sale", "construction_progress", "handover", "post_handover"].includes(stage.trigger) ? stage.trigger : "sale";
        const normalized = {
          id: stage.id || `stage-${index + 1}`,
          label: stage.label || `دفعة ${index + 1}`,
          trigger: safeTrigger as PaymentStageTrigger,
          percentage: Math.max(0, Number(stage.percentage) || 0),
          recipient: stage.recipient === "investor" ? "investor" as const : "escrow" as const,
          offsetMonths: Math.max(0, Math.floor(Number(stage.offsetMonths) || 0)),
          everyMonths: Math.max(1, Math.floor(Number(stage.everyMonths) || 1)),
          installmentCount: Math.max(1, Math.floor(Number(stage.installmentCount) || 1)),
          untilHandover: Boolean(stage.untilHandover),
          progressPct: Math.min(100, Math.max(0, Number(stage.progressPct) || 0)),
        };
        const milestone = getPaymentPlanMilestone(normalized);
        return { ...normalized, milestone, untilHandover: milestone === "construction" ? true : normalized.untilHandover };
      }),
    };
  }
  return legacyPaymentPlanToFlexible(value as Partial<LegacyPaymentPlan>);
}

export function getPaymentPlanPostHandoverMonths(plan: FlexiblePaymentPlan): number {
  return plan.stages.reduce((maximum, stage) => {
    if (getPaymentPlanMilestone(stage) !== "post_handover") return maximum;
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
    const milestone = getPaymentPlanMilestone(stage);
    const every = Math.max(1, Math.floor(Number(stage.everyMonths) || 1));
    let startMonth = saleMonth;
    if (stage.trigger === "months_after_sale") startMonth = saleMonth + Math.max(0, Number(stage.offsetMonths) || 0);
    else if (stage.trigger === "construction_progress") {
      const progress = Math.min(100, Math.max(0, Number(stage.progressPct) || 0));
      const constructionMonths = Math.max(1, constructionEndMonth - constructionStartMonth + 1);
      startMonth = Math.max(saleMonth, constructionStartMonth + Math.ceil((progress / 100) * constructionMonths) - 1);
    } else if (stage.trigger === "handover") startMonth = constructionEndMonth + Math.max(0, Number(stage.offsetMonths) || 0);
    else if (stage.trigger === "post_handover") startMonth = constructionEndMonth + Math.max(1, Number(stage.offsetMonths) || 1);

    const mustEndAtHandover = milestone === "construction" || Boolean(stage.untilHandover);
    if (mustEndAtHandover) startMonth = Math.min(startMonth, constructionEndMonth);
    const count = mustEndAtHandover
      ? Math.max(1, Math.floor((constructionEndMonth - startMonth) / every) + 1)
      : Math.max(1, Math.floor(Number(stage.installmentCount) || 1));
    const portion = Math.max(0, Number(stage.percentage) || 0) / count;
    for (let index = 0; index < count; index++) {
      const month = startMonth + (index * every);
      if (mustEndAtHandover && month > constructionEndMonth) continue;
      events.push({ month, pct: portion, recipient: stage.recipient, stageId: stage.id, stageLabel: stage.label });
    }
  }
  return events.filter((event) => event.pct > 0 && event.month > 0).sort((a, b) => a.month - b.month);
}
