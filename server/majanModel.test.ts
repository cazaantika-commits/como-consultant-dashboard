import { describe, expect, it } from "vitest";
import { createDefaultMajanInputs, createMajanOriginalBaseline } from "../shared/majanDefaults";
import { calculateMajanModel, getMajanPeriods, getMajanStabilisedYear, stableMajanHash } from "../shared/majanModel";

describe("Majan canonical model", () => {
  it("runs a complete no-finance indicative planning model without an approval gate", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    const result = calculateMajanModel(inputs, baseline);

    expect(result.development.totalCost).toBeCloseTo(555_794_315.7425, 6);
    expect(result.financing.totalDraw).toBe(0);
    expect(result.financing.months.every(month => month.draw === 0)).toBe(true);
    expect(result.leasing.totalGla).toBe(325_069);
    expect(result.annual.length).toBeGreaterThan(1);
    expect(result.sensitivity).toHaveLength(3);
    expect(result.sensitivity[0]!.annualCfads).not.toBe(result.sensitivity[2]!.annualCfads);
    expect(getMajanStabilisedYear(inputs)).toBe("2032");
    expect(result.sensitivity[1]!.annualCfads).toBe(result.annual.find(row => row.year === "2032")?.cfads);
    expect(result.issues.some(issue => ["PRETAX_INDICATIVE_MODEL", "CASH_TAX_NOT_YET_ESTIMATED"].includes(issue.code))).toBe(true);
    expect(result.checks.find(item => item.code === "no_finance_overlay_equality")?.status).toBe("pass");
  });

  it("uses a deterministic portable input hash while keeping run dates non-deterministic", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    const first = calculateMajanModel(inputs, baseline);
    const second = calculateMajanModel(inputs, baseline);

    expect(first.inputHash).toHaveLength(64);
    expect(first.inputHash).toBe(second.inputHash);
    expect(stableMajanHash({ b: 1, a: [null, 0] })).toBe(stableMajanHash({ a: [null, 0], b: 1 }));
    expect(first.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("preserves unrelated base outputs when a rent input is missing and blocks only dependent rent metrics", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.leasing[0]!.annualRentPsf = null;
    const result = calculateMajanModel(inputs, baseline);
    const openingIndex = result.leasing.months.findIndex(month => month.period === inputs.operations.openingMonth);

    expect(result.development.uses.reduce((sum, value) => sum + value, 0)).toBeCloseTo(490_694_315.7425, 6);
    expect(result.leasing.totalGla).toBe(325_069);
    expect(result.leasing.months[openingIndex]!.billedRent).toBeNull();
    expect(result.issues.some(issue => issue.code === "RENT_INPUT_MISSING")).toBe(true);
  });

  it("aggregates annual DSCR as annual same-period sums and supports an enabled illustrative overlay", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.finance.enabled = true;
    const result = calculateMajanModel(inputs, baseline);
    const annualWithService = result.annual.find(row => (row.debtService ?? 0) > 0 && row.cfads !== null);

    expect(result.financing.totalDraw).not.toBeNull();
    expect(result.issues.some(issue => issue.code === "FINANCE_INDICATIVE_NOT_APPROVED")).toBe(true);
    expect(annualWithService?.dscr).toBeCloseTo((annualWithService?.cfads ?? 0) / (annualWithService?.debtService ?? 1), 8);
    expect(result.checks.find(item => item.code === "annual_dscr_same_period_ratio")?.status).toBe("pass");
  });

  it("enforces the inclusive 360-month horizon limit", () => {
    expect(getMajanPeriods("2026-09", "2026-09")).toEqual(["2026-09"]);
    expect(getMajanPeriods("2026-01", "2055-12")).toHaveLength(360);
    expect(() => getMajanPeriods("2026-01", "2056-01")).toThrow(/360/);
    expect(() => getMajanPeriods("2026-02", "2026-01")).toThrow(/cannot end/);
  });
});
