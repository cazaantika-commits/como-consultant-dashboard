import { describe, expect, it } from "vitest";
import { calculateFinalCashFlowProfit, formatCashFlowAmount } from "../pages/V2CapitalPortfolio";

describe("Capital Portfolio final cash-flow formatting", () => {
  it("keeps the debit and credit signs visible for the final investor-flow row", () => {
    expect(formatCashFlowAmount(-2_845_422.4)).toBe("−2,845,422");
    expect(formatCashFlowAmount(266_364_647.6)).toBe("+266,364,648");
    expect(formatCashFlowAmount(0)).toBe("0");
  });

  it("calculates profit from the signed sum of every monthly final cash-flow value", () => {
    expect(calculateFinalCashFlowProfit([-843_981, 266_364_648, 22_992_139, -1_210_113])).toBe(287_302_693);
    expect(calculateFinalCashFlowProfit([])).toBe(0);
  });
});
