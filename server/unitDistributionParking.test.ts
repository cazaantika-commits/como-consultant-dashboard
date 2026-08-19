import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateParkingSummary, parseParkingRules } from "../client/src/lib/parkingRules";

const readProjectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Unit Distribution document-sourced parking", () => {
  it("calculates requirements only from explicit extracted rules and documented capacity", () => {
    const rules = parseParkingRules(JSON.stringify({
      residential: { thresholdSqft: 1000, spacesAtOrBelow: 1, spacesAbove: 2 },
      retail: { sqftPerSpace: 500 },
      office: { sqftPerSpace: 1000 },
      visitorPct: 10,
      accessiblePct: 5,
    }));
    const result = calculateParkingSummary([
      { category: "residential", areaSqft: 900, count: 2 },
      { category: "residential", areaSqft: 1400, count: 1 },
      { category: "retail", areaSqft: 1200, count: 1 },
      { category: "office", areaSqft: 2000, count: 1 },
    ], rules, 12);

    expect(result.baseRequired).toBe(9);
    expect(result.visitorRequired).toBe(1);
    expect(result.accessibleRequired).toBe(1);
    expect(result.totalRequired).toBe(11);
    expect(result.variance).toBe(1);
  });

  it("refuses to invent a requirement when a document rule is absent", () => {
    const result = calculateParkingSummary([
      { category: "residential", areaSqft: 900, count: 2 },
    ], null, 40);

    expect(result.totalRequired).toBeNull();
    expect(result.missingCategories).toEqual(["residential"]);
    expect(result.variance).toBeNull();
  });

  it("distinguishes missing documented capacity from a documented zero", () => {
    const rules = parseParkingRules(JSON.stringify({
      residential: { thresholdSqft: 1000, spacesAtOrBelow: 1, spacesAbove: 2 },
      visitorPct: 0,
      accessiblePct: 0,
    }));
    const missing = calculateParkingSummary([{ category: "residential", areaSqft: 900, count: 1 }], rules, null);
    const documentedZero = calculateParkingSummary([{ category: "residential", areaSqft: 900, count: 1 }], rules, 0);

    expect(missing.available).toBeNull();
    expect(missing.variance).toBeNull();
    expect(documentedZero.available).toBe(0);
    expect(documentedZero.variance).toBe(-1);
  });

  it("shows a complete base requirement when optional visitor and accessibility additions are absent", () => {
    const rules = parseParkingRules(JSON.stringify({
      residential: { thresholdSqft: 1600, spacesAtOrBelow: 1, spacesAbove: 2 },
      retail: { sqftPerSpace: 700 },
      office: { sqftPerSpace: 500 },
    }));
    const result = calculateParkingSummary([
      { category: "residential", areaSqft: 1200, count: 2 },
      { category: "retail", areaSqft: 700, count: 1 },
      { category: "office", areaSqft: 500, count: 1 },
    ], rules, null);

    expect(result.baseRequired).toBe(4);
    expect(result.totalRequired).toBe(4);
    expect(result.available).toBeNull();
    expect(result.variance).toBeNull();
  });

  it("keeps Unit Distribution focused on counts, areas, compact layout, and document-backed parking", () => {
    const source = readProjectFile("client/src/pages/PricingPage.tsx");
    expect(source).toContain("احتساب المواقف من الوثائق");
    expect(source).toContain("لن تُستخدم أي افتراضات");
    expect(source).toContain("lg:grid-cols-[minmax(0,2.1fr)_minmax(245px,0.9fr)]");
    expect(source).not.toContain("residential1brPrice");
    expect(source).not.toContain("villaPrice");
  });
});
