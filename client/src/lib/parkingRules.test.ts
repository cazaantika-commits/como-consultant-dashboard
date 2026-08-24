import { describe, expect, it } from "vitest";
import { calculateParkingSummary, parseDocumentParkingRules } from "./parkingRules";

describe("document parking-rule parsing", () => {
  it("calculates the documented Nad Al Sheba rule from the extracted source text without a default rule", () => {
    const rules = parseDocumentParkingRules("For apartment, one bay for each unit less than or equal to 150 sq.m gfa and two bays for each unit exceeding 150 sq.m gfa; for retail, one bay for each 70 sq.m of retail net area.");
    const summary = calculateParkingSummary([
      { category: "residential", areaSqft: 743, count: 24 },
      { category: "residential", areaSqft: 1250, count: 6 },
      { category: "residential", areaSqft: 1450, count: 6 },
      { category: "residential", areaSqft: 1650, count: 6 },
      { category: "retail", areaSqft: 922, count: 3 },
      { category: "retail", areaSqft: 1201, count: 1 },
    ], rules, null);

    expect(rules?.residential?.thresholdSqft).toBeCloseTo(1614.59, 2);
    expect(summary.perCategory.residential).toBe(48);
    expect(summary.perCategory.retail).toBe(6);
    expect(summary.totalRequired).toBe(54);
    expect(summary.available).toBeNull();
  });

  it("refuses unrecognized source text rather than inventing a parking rule", () => {
    expect(parseDocumentParkingRules("Parking to be confirmed later.")).toBeNull();
  });
});
