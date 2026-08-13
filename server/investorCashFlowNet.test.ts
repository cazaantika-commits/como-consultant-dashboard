import { describe, expect, it } from "vitest";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";
import type { CashFlowResult, CostRow } from "../client/src/lib/investorCashFlowEngine";

function row(overrides: Partial<CostRow>): CostRow {
  return {
    label: "بند",
    totalCost: 0,
    investorAmount: 0,
    paid: 0,
    unpaid: 0,
    funder: "investor",
    section: "اختبار",
    designMonths: [0],
    constructionMonths: [],
    postConstructionMonths: [0],
    ...overrides,
  };
}

describe("shared Investor Cash Flow net-month row", () => {
  it("keeps the exact Investor Cash Flow sign: required funding is negative and investor receipts are positive", () => {
    const cashFlow = {
      rows: [
        row({ label: "مصروف تصميم", totalCost: 100, investorAmount: 100, unpaid: 100, designMonths: [100] }),
        row({ label: "إيراد مباشر", totalCost: 250, investorAmount: 250, unpaid: 250, isRevenue: true, postConstructionMonths: [250] }),
      ],
      designDuration: 1,
      constructionDuration: 0,
      postDuration: 1,
      usedSalesResult: undefined,
    } as unknown as CashFlowResult;

    const result = calculateInvestorMonthlyNet(cashFlow);

    expect(result.debitTotals).toEqual([100, 0]);
    expect(result.creditTotals).toEqual([0, 250]);
    expect(result.netFlow).toEqual([-100, 250]);
    expect(result.cumulative).toEqual([-100, 150]);
  });
});
