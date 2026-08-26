import { describe, expect, it } from "vitest";
import {
  calculateCompleteInvestorCashFlowProfit,
  calculateFinalCashFlowProfit,
  calculateProfitPercentage,
  calculateProfitReconciliationDifference,
  compactCapitalProjectName,
  formatCashFlowAmount,
  transposeLiteralMatrix,
} from "../pages/V2CapitalPortfolio";

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

  it("includes paid investor capital before the visible monthly sequence instead of copying feasibility profit", () => {
    const futureMonthlyNet = [24_450_660];
    const cashFlowProfit = calculateCompleteInvestorCashFlowProfit(18_900_000, futureMonthlyNet);
    expect(cashFlowProfit).toBe(5_550_660);
    expect(calculateProfitReconciliationDifference(cashFlowProfit, 5_550_660)).toBe(0);
  });

  it("calculates investor profit percentages on cost and required capital without changing profit", () => {
    const investorProfit = 164_777_749.24044985;
    expect(calculateProfitPercentage(investorProfit, 900_646_474.423)).toBeCloseTo(18.295497059, 6);
    expect(calculateProfitPercentage(investorProfit, 466_450_553.3723883)).toBeCloseTo(35.3258771051, 6);
    expect(calculateProfitPercentage(investorProfit, 0)).toBe(0);
  });

  it("literally transposes the original full-value cells without introducing or abbreviating values", () => {
    const original = [
      ["أوف بلان", "726,067,550", "−2,845,422"],
      ["الإجمالي", "1,094,502,650", "−4,651,375"],
    ];
    const values = transposeLiteralMatrix(original);
    expect(values).toEqual([
      ["أوف بلان", "الإجمالي"],
      ["726,067,550", "1,094,502,650"],
      ["−2,845,422", "−4,651,375"],
    ]);
    expect(values.flat().sort()).toEqual(original.flat().sort());
    expect(values.flat().join(" ")).not.toMatch(/\d+(?:\.\d+)?[KM]\b/);
    expect(compactCapitalProjectName("مجان متعدد الاستخدامات (G+4P+25)")).toBe("مجان");
    expect(compactCapitalProjectName("ند الشبا — قطعة 2 المدمجة (6182776)")).toBe("ند الشبا 2");
    expect(compactCapitalProjectName("ند الشبا — قطعة 3 الفلل (6180578)")).toBe("الفلل");
  });
});
