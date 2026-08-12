import { describe, expect, it } from "vitest";
import { calculateEscrowSettlement } from "../client/src/lib/escrowSettlement";

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
});
