import { describe, expect, it } from "vitest";
import { createConstructionSeries, createPostHandoverSeries, validatePaymentCalendarLogic } from "./paymentPlanRules";

const context = {
  projectSalesStartMonth: 7,
  constructionStartMonth: 6,
  constructionEndMonth: 23,
  projectStartDate: "2026-10-01",
};

describe("payment plan logic guards", () => {
  it("rejects four six-month construction installments when an 18-month project has no room before handover", () => {
    const result = createConstructionSeries({ totalPercentage: 40, installmentPercentage: 10, firstAfterMonths: 6, everyMonths: 6, previousMonth: 8, nextSequence: 3 }, context);
    expect(result.error).toContain("غير واقعي");
  });

  it("creates four realistic construction installments when the chosen cadence fits before the two-month handover buffer", () => {
    const result = createConstructionSeries({ totalPercentage: 40, installmentPercentage: 10, firstAfterMonths: 3, everyMonths: 3, previousMonth: 8, nextSequence: 3 }, context);
    expect(result.entries?.map((entry) => entry.offsetMonths)).toEqual([3, 3, 3, 3]);
    expect(result.entries?.map((entry) => entry.percentage)).toEqual([10, 10, 10, 10]);
  });

  it("flags construction before a contract and construction inside the handover buffer", () => {
    const issues = validatePaymentCalendarLogic([
      { id: "booking", sequence: 1, label: "الحجز", percentage: 10, recipient: "escrow", milestone: "booking", timingRule: "booking" },
      { id: "construction", sequence: 2, label: "الإنشاء", percentage: 40, recipient: "escrow", milestone: "construction", timingRule: "after_previous", offsetMonths: 20 },
    ], context);
    expect(issues.map((issue) => issue.message).join(" ")).toContain("بعد توقيع العقد");
    expect(issues.map((issue) => issue.message).join(" ")).toContain("قبل التسليم بشهرين");
  });

  it("creates every post-handover payment for a 24-month term with a six-month cadence", () => {
    const result = createPostHandoverSeries({ totalPercentage: 20, termMonths: 24, everyMonths: 6, nextSequence: 6 });
    expect(result.entries).toHaveLength(4);
    expect(result.entries?.map((entry) => entry.offsetMonths)).toEqual([6, 12, 18, 24]);
    expect(result.entries?.map((entry) => entry.percentage)).toEqual([5, 5, 5, 5]);
  });
});
