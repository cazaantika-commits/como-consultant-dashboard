import { describe, expect, it } from "vitest";
import {
  buildPaymentReceiptEvents,
  getPaymentPlanPostHandoverMonths,
  normalizeFlexiblePaymentPlan,
} from "../client/src/lib/flexiblePaymentPlan";

describe("flexible Dubai-style payment plans", () => {
  it("splits a construction-stage percentage into quarterly receipts through handover", () => {
    const plan = normalizeFlexiblePaymentPlan({
      version: 2,
      stages: [{
        id: "construction",
        label: "دفعات كل 4 أشهر أثناء الإنشاء",
        trigger: "months_after_sale",
        percentage: 40,
        recipient: "escrow",
        offsetMonths: 4,
        everyMonths: 4,
        untilHandover: true,
      }],
    });
    const events = buildPaymentReceiptEvents({ plan, saleMonth: 8, constructionStartMonth: 8, constructionEndMonth: 30 });
    expect(events.map((event) => event.month)).toEqual([12, 16, 20, 24, 28]);
    expect(events.every((event) => event.recipient === "escrow")).toBe(true);
    expect(events.reduce((sum, event) => sum + event.pct, 0)).toBeCloseTo(40, 8);
  });

  it("keeps a late buyer's until-handover installment at handover instead of leaking it into post-handover escrow months", () => {
    const plan = normalizeFlexiblePaymentPlan({
      version: 2,
      stages: [{
        id: "construction",
        label: "دفعات كل 4 أشهر أثناء الإنشاء",
        trigger: "months_after_sale",
        percentage: 40,
        recipient: "escrow",
        offsetMonths: 6,
        everyMonths: 4,
        untilHandover: true,
      }],
    });
    const events = buildPaymentReceiptEvents({ plan, saleMonth: 29, constructionStartMonth: 8, constructionEndMonth: 30 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ month: 30, pct: 40, recipient: "escrow" });
  });

  it("supports forty-eight monthly post-handover installments routed directly to the investor", () => {
    const plan = normalizeFlexiblePaymentPlan({
      version: 2,
      stages: [{
        id: "post-handover",
        label: "40% بعد التسليم على أربع سنوات",
        trigger: "post_handover",
        percentage: 40,
        recipient: "investor",
        offsetMonths: 1,
        everyMonths: 1,
        installmentCount: 48,
      }],
    });
    const events = buildPaymentReceiptEvents({ plan, saleMonth: 8, constructionStartMonth: 8, constructionEndMonth: 30 });
    expect(getPaymentPlanPostHandoverMonths(plan)).toBe(48);
    expect(events).toHaveLength(48);
    expect(events[0]).toMatchObject({ month: 31, recipient: "investor" });
    expect(events[47]).toMatchObject({ month: 78, recipient: "investor" });
    expect(events.reduce((sum, event) => sum + event.pct, 0)).toBeCloseTo(40, 8);
  });

  it("supports twelve quarterly post-handover installments across the same four-year horizon", () => {
    const plan = normalizeFlexiblePaymentPlan({
      version: 2,
      stages: [{
        id: "quarterly-post-handover",
        label: "40% بعد التسليم كل 4 أشهر",
        trigger: "post_handover",
        percentage: 40,
        recipient: "investor",
        offsetMonths: 4,
        everyMonths: 4,
        installmentCount: 12,
      }],
    });
    const events = buildPaymentReceiptEvents({ plan, saleMonth: 8, constructionStartMonth: 8, constructionEndMonth: 30 });
    expect(getPaymentPlanPostHandoverMonths(plan)).toBe(48);
    expect(events).toHaveLength(12);
    expect(events[0]?.month).toBe(34);
    expect(events[11]?.month).toBe(78);
    expect(events.reduce((sum, event) => sum + event.pct, 0)).toBeCloseTo(40, 8);
  });
});
