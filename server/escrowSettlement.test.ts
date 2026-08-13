import { describe, expect, it } from "vitest";
import { calculateEscrowSettlement } from "../client/src/lib/escrowSettlement";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";

describe("calculateEscrowSettlement", () => {
  it("retains five percent of buyer collections, covers later obligations, and closes at zero in month thirteen", () => {
    const baseline = [0, 500, 700, 685, 670];
    const result = calculateEscrowSettlement({
      cumulativeWithoutLiquidation: baseline,
      firstLiquidationIndex: 2,
      finalLiquidationIndex: 4,
      actualSalesCashInflow: [800],
    });

    expect(result.retainedSalesAmount).toBe(40);
    expect(result.firstLiquidation).toBe(660);
    expect(result.finalLiquidation).toBe(10);
    expect(baseline[4] - result.firstLiquidation - result.finalLiquidation).toBe(0);
  });

  it("does not classify buyer collections held in escrow as direct investor revenue before settlement", () => {
    const result = computeInvestorCashFlow(null, "offplan_escrow", undefined, {
      escrowData: [{ month: 1, units: 1, income: 100, downPayment: 10, installments: 90, withdrawal: 0, balance: 0, cumulativeSold: 1 }],
      salesDistribution: [1],
      actualCashInflow: [100],
      offplanPct: 80,
    });

    expect(result.rows.some((row) => row.label.startsWith("Monthly Revenue M"))).toBe(false);
    expect(result.rows.filter((row) => row.label.includes("تصفية حساب الضمان"))).toHaveLength(2);
    const directSalesRow = result.rows.find((row) => row.label.includes("مبيعات مباشرة بعد الإنجاز"));
    const expectedMonthlyDirectSale = (directSalesRow?.totalCost || 0) / 6;
    expect(directSalesRow?.postConstructionMonths.slice(0, 3)).toEqual([0, 0, 0]);
    expect(directSalesRow?.postConstructionMonths.slice(3, 9)).toEqual([
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
    ]);
    const directSalesCommission = result.rows.find((row) => row.label === "عمولة مبيعات مباشرة بعد الإنجاز");
    expect(directSalesCommission?.totalCost).toBe((directSalesRow?.totalCost || 0) * 0.05);
    expect(directSalesCommission?.postConstructionMonths.slice(3, 9)).toEqual(
      Array(6).fill((directSalesCommission?.totalCost || 0) / 6)
    );
  });
});
