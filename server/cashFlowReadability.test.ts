import { describe, expect, it } from "vitest";
import { formatCashFlowMonthYear, sumCashFlowPeriod } from "../client/src/lib/cashFlowReadability";

describe("Cash-flow readability helpers", () => {
  it("renders a full Arabic calendar month and year from an engine month key", () => {
    expect(formatCashFlowMonthYear("2027-04")).toEqual({ month: "أبريل", year: "2027" });
  });

  it("keeps an invalid or missing engine month visibly empty rather than inventing a date", () => {
    expect(formatCashFlowMonthYear("")).toEqual({ month: "—", year: "" });
    expect(formatCashFlowMonthYear("2027-13")).toEqual({ month: "—", year: "" });
  });

  it("sums the existing cash-flow values without rounding or altering a zero value", () => {
    expect(sumCashFlowPeriod([12_500, 0, -2_500])).toBe(10_000);
  });
});
