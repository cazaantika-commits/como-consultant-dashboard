import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLEXIBLE_PAYMENT_PLAN,
  buildPaymentReceiptEvents,
  getPaymentPlanMilestone,
  normalizeFlexiblePaymentPlan,
  paymentPlanTotalPercentage,
} from "./flexiblePaymentPlan";

describe("milestone payment plans", () => {
  it("classifies the default plan as booking, contract, construction, and handover", () => {
    const milestones = DEFAULT_FLEXIBLE_PAYMENT_PLAN.stages.map(getPaymentPlanMilestone);
    expect(milestones).toEqual(["booking", "contract", "construction", "handover"]);
    expect(paymentPlanTotalPercentage(DEFAULT_FLEXIBLE_PAYMENT_PLAN)).toBe(100);
  });

  it("keeps construction installments inside an 18-month construction period", () => {
    const events = buildPaymentReceiptEvents({ plan: DEFAULT_FLEXIBLE_PAYMENT_PLAN, saleMonth: 7, constructionStartMonth: 10, constructionEndMonth: 27 });
    const construction = events.filter((event) => event.stageId === "construction");
    expect(construction.length).toBeGreaterThan(0);
    expect(Math.max(...construction.map((event) => event.month))).toBeLessThanOrEqual(27);
    expect(events.find((event) => event.stageId === "handover")?.month).toBe(27);
  });

  it("adapts the same construction milestone to a 30-month project without crossing handover", () => {
    const events = buildPaymentReceiptEvents({ plan: DEFAULT_FLEXIBLE_PAYMENT_PLAN, saleMonth: 7, constructionStartMonth: 10, constructionEndMonth: 39 });
    const construction = events.filter((event) => event.stageId === "construction");
    expect(Math.max(...construction.map((event) => event.month))).toBeLessThanOrEqual(39);
    expect(events.find((event) => event.stageId === "handover")?.month).toBe(39);
  });

  it("upgrades legacy second payment wording to an explicit contract milestone", () => {
    const plan = normalizeFlexiblePaymentPlan({ version: 2, stages: [{ id: "second", label: "دفعة بعد الحجز", trigger: "months_after_sale", percentage: 10, recipient: "escrow", offsetMonths: 1 }] });
    expect(getPaymentPlanMilestone(plan.stages[0]!)).toBe("contract");
  });
});
