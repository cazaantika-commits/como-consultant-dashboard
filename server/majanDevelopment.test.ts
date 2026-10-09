import { describe, expect, it } from "vitest";
import { createDefaultMajanInputs, createMajanOriginalBaseline } from "../shared/majanDefaults";
import { calculateMajanDevelopment } from "../shared/majanDevelopment";

describe("Majan development schedule", () => {
  it("preserves the recorded default baseline exactly and surfaces its raw exceptions", () => {
    const baseline = createMajanOriginalBaseline();
    const result = calculateMajanDevelopment(createDefaultMajanInputs(baseline), baseline);

    expect(result.periods).toEqual(baseline.periods);
    expect(result.totalCost).toBeCloseTo(555_794_315.7425, 6);
    expect(result.taggedPaid).toBe(65_100_000);
    expect(result.uses.reduce((total, value) => total + value, 0)).toBeCloseTo(490_694_315.7425, 6);
    expect(result.baselineDelta).toBeCloseTo(0, 6);
    expect(result.designFee).toBe(11_250_000);
    expect(result.supervisionFee).toBe(11_250_000);
    expect(result.issues.some(item => item.code === "fee_path_gap_recorded")).toBe(true);
    expect(result.rows.find(row => row.nameEn === "As-built survey")?.monthly[35]).toBe(45_000);
  });

  it("scales only dynamic development rows when an explicit construction basis is edited", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.development.buaSqft = 1_100_000;
    inputs.development.constructionRate = 500;
    inputs.development.designFee = { mode: "amount", amount: 12_000_000, percentage: null, minimum: null };
    inputs.development.supervisionFee = { mode: "none", amount: null, percentage: null, minimum: null };

    const result = calculateMajanDevelopment(inputs, baseline);
    const ratio = 550_000_000 / 450_000_000;
    const construction = result.rows.filter(row => row.category === "construction");
    const originalConstruction = baseline.rows.filter(row => row.category === "construction");
    construction.forEach((row, index) => expect(row.total).toBeCloseTo(originalConstruction[index]!.total * ratio, 6));
    expect(result.rows.find(row => row.category === "developer_fee")?.total).toBeCloseTo(9_000_000 * ratio, 6);
    expect(result.rows.find(row => row.category === "design")?.total).toBe(12_000_000);
    expect(result.rows.find(row => row.category === "supervision")?.total).toBe(0);
    expect(result.rows.find(row => row.nameEn === "Authority fees")?.total).toBe(8_000_000);
    expect(result.totalCost - result.taggedPaid).toBeCloseTo(result.uses.reduce((total, value) => total + value, 0), 6);
  });

  it("accepts an explicit zero fee but rejects invalid negative development values", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.development.designFee = { mode: "amount", amount: 0, percentage: null, minimum: null };
    inputs.development.constructionRate = -1;
    const result = calculateMajanDevelopment(inputs, baseline);

    expect(result.designFee).toBe(0);
    expect(result.constructionCost).toBe(baseline.constructionCost);
    expect(result.issues.some(item => item.code === "invalid_construction_rate")).toBe(true);
  });

  it("resamples only on an explicit time edit and preserves the retention offsets", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.development.startMonth = "2027-01";
    inputs.development.designMonths = 6;
    inputs.development.constructionMonths = 24;
    inputs.development.handoverMonths = 3;
    const result = calculateMajanDevelopment(inputs, baseline);

    expect(result.periods).toHaveLength(43); // 6 design + 24 construction + recorded 13-month retention tail
    expect(result.periods[0]).toBe("2027-01");
    const firstRetention = result.rows.find(row => row.nameEn.includes("First contractor retention"))!;
    const finalRetention = result.rows.find(row => row.nameEn.includes("Final contractor retention"))!;
    expect(firstRetention.monthly[31]).toBe(22_500_000); // completion index 30 + one month
    expect(finalRetention.monthly[42]).toBe(22_500_000); // completion index 30 + twelve months
    expect(result.issues.some(item => item.code === "timeline_resampled")).toBe(true);
  });

  it("allows an explicit zero other-row override but does not allow dynamic-row overrides", () => {
    const baseline = createMajanOriginalBaseline();
    const inputs = createDefaultMajanInputs(baseline);
    inputs.development.costOverrides = [
      { rowId: "legacy-8", amount: 0, source: inputs.development.source },
      { rowId: "legacy-10", amount: 0, source: inputs.development.source },
    ];
    const result = calculateMajanDevelopment(inputs, baseline);

    expect(result.rows.find(row => row.id === "legacy-8")?.total).toBe(0);
    expect(result.rows.find(row => row.id === "legacy-10")?.total).toBe(45_000_000);
    expect(result.issues.some(item => item.code === "override_not_permitted_for_dynamic_row")).toBe(true);
  });
});
