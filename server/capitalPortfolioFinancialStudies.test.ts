import { describe, expect, it } from "vitest";
import {
  calculateInvestorMonthlyFundingRequirements,
  type CashFlowResult,
  type CostRow,
} from "../client/src/lib/investorCashFlowEngine";
import { isCapitalPortfolioEligibleScenario } from "../client/src/lib/portfolioReportRules";

function row(overrides: Partial<CostRow>): CostRow {
  return {
    label: "بند",
    totalCost: 0,
    investorAmount: 0,
    paid: 0,
    unpaid: 0,
    funder: "investor",
    section: "اختبار",
    designMonths: [0, 0],
    constructionMonths: [0],
    postConstructionMonths: [0],
    ...overrides,
  };
}

function fixture(rows: CostRow[]): CashFlowResult {
  return {
    rows,
    sections: [],
    grandTotalCost: 0,
    grandInvestor: 0,
    grandPaid: 0,
    grandUnpaid: 0,
    designMonthlyTotals: [],
    constructionMonthlyTotals: [],
    postMonthlyTotals: [],
    revenuePostTotals: [],
    cumulativeDesign: [],
    cumulativeConstruction: [],
    cumulativePost: [],
    designDuration: 2,
    constructionDuration: 1,
    postDuration: 1,
    totalRevenue: 0,
    monthDates: ["2026-08", "2026-09", "2026-10", "2026-11"],
    startDate: "2026-08",
  };
}

describe("Financial Studies Capital Portfolio source rules", () => {
  it("uses only unpaid investor funding rows for future monthly capital", () => {
    const cashFlow = fixture([
      row({ label: "تكلفة التصميم", totalCost: 30, unpaid: 30, designMonths: [10, 20] }),
      row({ label: "مدفوع سابقاً", totalCost: 50, paid: 50, unpaid: 0, designMonths: [50, 0] }),
      row({ label: "إيرادات المبيعات", isRevenue: true, totalCost: 300, designMonths: [0, 100] }),
      row({ label: "حصة كومو", isProfitAllocation: true, totalCost: 15, designMonths: [15, 0] }),
      row({ label: "مصروف إسكرو", funder: "escrow", totalCost: 40, constructionMonths: [40] }),
    ]);

    expect(calculateInvestorMonthlyFundingRequirements(cashFlow)).toEqual([10, 20, 0, 0]);
  });

  it("excludes build-for-rent from the detailed investment capital portfolio only", () => {
    expect(isCapitalPortfolioEligibleScenario("offplan_escrow")).toBe(true);
    expect(isCapitalPortfolioEligibleScenario("build_for_sale")).toBe(true);
    expect(isCapitalPortfolioEligibleScenario("build_for_rent")).toBe(false);
  });
});
