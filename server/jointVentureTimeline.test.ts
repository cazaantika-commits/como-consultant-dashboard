import { describe, expect, it } from "vitest";
import { deriveJointVentureTimelineFromSavedPlan } from "../client/src/lib/jointVentureTimeline";

describe("Joint Venture timeline from Wael's saved indicator", () => {
  it("starts sales from the first saved Wael sale month and never rebases it after completion", () => {
    const result = deriveJointVentureTimelineFromSavedPlan({
      plan: {
        salesAbsorptionJson: JSON.stringify({ marketingActualStart: 6 }),
        resultsJson: JSON.stringify({
          escrowData: [
            { month: 7, units: 0 },
            { month: 8, units: 3 },
            { month: 18, units: 2 },
          ],
          actualEscrowCashInflow: [0, 0, 0, 0, 0, 0, 0, 1_175_386],
        }),
      },
      fallback: {
        designMonths: 5,
        materialsStartMonth: 3,
        reraStartMonth: 5,
        marketingStartMonth: 5,
        salesStartMonth: 6,
        constructionStartMonth: 6,
        projectEndMonth: 23,
      },
      designMonths: 7,
      constructionMonths: 17,
      marketingPrepMonths: 3,
      reraLeadMonths: 2,
    });

    expect(result.designMonths).toBe(7);
    expect(result.constructionStartMonth).toBe(8);
    expect(result.projectEndMonth).toBe(24);
    expect(result.marketingStartMonth).toBe(6);
    expect(result.salesStartMonth).toBe(8);
    expect(result.salesStartMonth).toBeLessThan(result.projectEndMonth);
  });
});
