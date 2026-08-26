import { describe, expect, it } from "vitest";
import { calculateInvestorMonthlyNet } from "./investorCashFlowNet";
import type { CashFlowResult, CostRow } from "./investorCashFlowEngine";

function row(overrides: Partial<CostRow>): CostRow {
  return {
    label: "بند اختبار",
    totalCost: 0,
    investorAmount: 0,
    paid: 0,
    unpaid: 0,
    funder: "investor",
    section: "اختبار",
    designMonths: [0],
    constructionMonths: [],
    postConstructionMonths: [],
    ...overrides,
  };
}

const fixture = (rows: CostRow[]): CashFlowResult => ({
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
  designDuration: 1,
  constructionDuration: 0,
  postDuration: 0,
  totalRevenue: 0,
  monthDates: ["2028-08"],
  startDate: "2028-08",
});

describe("investor monthly net", () => {
  it("carries paid-before-schedule capital into the opening debit and cumulative result", () => {
    const result = calculateInvestorMonthlyNet(fixture([
      row({ label: "الأرض", paid: 18_900_000, totalCost: 18_900_000, unpaid: 0 }),
      row({ label: "مصروف حالي", totalCost: 100, unpaid: 100, designMonths: [100] }),
      row({ label: "تحويل الضمان", isRevenue: true, totalCost: 200, designMonths: [200] }),
    ]));

    expect(result.paidBeforeSchedule).toBe(18_900_000);
    expect(result.debitTotals).toEqual([100]);
    expect(result.netFlow).toEqual([100]);
    expect(result.cumulative).toEqual([-18_899_900]);
  });
});
