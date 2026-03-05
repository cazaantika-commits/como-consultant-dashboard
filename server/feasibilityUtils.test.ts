import { describe, expect, it } from "vitest";
import { autoPopulateAvgAreas, DEFAULT_AVG_AREAS } from "../shared/feasibilityUtils";

describe("autoPopulateAvgAreas", () => {
  it("populates default avg area when pct > 0 but avgArea is 0", () => {
    const fields = {
      residentialStudioPct: 0,
      residentialStudioAvgArea: 0,
      residential1brPct: 50,
      residential1brAvgArea: 700,
      residential2brPct: 40,
      residential2brAvgArea: 1000,
      residential3brPct: 10,
      residential3brAvgArea: 0, // BUG: pct > 0 but avgArea is 0
      retailSmallPct: 0,
      retailSmallAvgArea: 0,
      retailMediumPct: 0,
      retailMediumAvgArea: 0,
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    // 3BR should get default 1400
    expect(result.residential3brAvgArea).toBe(1400);
    // 1BR and 2BR should keep their existing values
    expect(result.residential1brAvgArea).toBe(700);
    expect(result.residential2brAvgArea).toBe(1000);
    // Studio should remain 0 since pct is 0
    expect(result.residentialStudioAvgArea).toBe(0);
  });

  it("does not overwrite existing avg areas", () => {
    const fields = {
      residentialStudioPct: 25,
      residentialStudioAvgArea: 350, // custom value, not default
      residential1brPct: 40,
      residential1brAvgArea: 650, // custom value, not default
      residential2brPct: 35,
      residential2brAvgArea: 950, // custom value, not default
      residential3brPct: 0,
      residential3brAvgArea: 0,
      retailSmallPct: 0,
      retailSmallAvgArea: 0,
      retailMediumPct: 0,
      retailMediumAvgArea: 0,
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    // Custom values should be preserved
    expect(result.residentialStudioAvgArea).toBe(350);
    expect(result.residential1brAvgArea).toBe(650);
    expect(result.residential2brAvgArea).toBe(950);
    // 3BR should remain 0 since pct is 0
    expect(result.residential3brAvgArea).toBe(0);
  });

  it("populates multiple missing avg areas at once", () => {
    const fields = {
      residentialStudioPct: 25,
      residentialStudioAvgArea: 0, // missing
      residential1brPct: 40,
      residential1brAvgArea: 0, // missing
      residential2brPct: 35,
      residential2brAvgArea: 0, // missing
      residential3brPct: 10,
      residential3brAvgArea: 0, // missing
      retailSmallPct: 50,
      retailSmallAvgArea: 0, // missing
      retailMediumPct: 50,
      retailMediumAvgArea: 0, // missing
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    expect(result.residentialStudioAvgArea).toBe(400);
    expect(result.residential1brAvgArea).toBe(700);
    expect(result.residential2brAvgArea).toBe(1000);
    expect(result.residential3brAvgArea).toBe(1400);
    expect(result.retailSmallAvgArea).toBe(300);
    expect(result.retailMediumAvgArea).toBe(600);
    // Large retail and all offices should remain 0
    expect(result.retailLargeAvgArea).toBe(0);
    expect(result.officeSmallAvgArea).toBe(0);
  });

  it("handles null/undefined avg areas as missing", () => {
    const fields: Record<string, any> = {
      residentialStudioPct: 25,
      residentialStudioAvgArea: null,
      residential1brPct: 40,
      residential1brAvgArea: undefined,
      residential2brPct: 0,
      residential2brAvgArea: 0,
      residential3brPct: 0,
      residential3brAvgArea: 0,
      retailSmallPct: 0,
      retailSmallAvgArea: 0,
      retailMediumPct: 0,
      retailMediumAvgArea: 0,
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    expect(result.residentialStudioAvgArea).toBe(400);
    expect(result.residential1brAvgArea).toBe(700);
  });

  it("does not mutate the original object", () => {
    const fields = {
      residentialStudioPct: 25,
      residentialStudioAvgArea: 0,
      residential1brPct: 0,
      residential1brAvgArea: 0,
      residential2brPct: 0,
      residential2brAvgArea: 0,
      residential3brPct: 0,
      residential3brAvgArea: 0,
      retailSmallPct: 0,
      retailSmallAvgArea: 0,
      retailMediumPct: 0,
      retailMediumAvgArea: 0,
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    // Original should not be modified
    expect(fields.residentialStudioAvgArea).toBe(0);
    // Result should have the populated value
    expect(result.residentialStudioAvgArea).toBe(400);
  });

  it("populates office avg areas correctly", () => {
    const fields = {
      residentialStudioPct: 0,
      residentialStudioAvgArea: 0,
      residential1brPct: 0,
      residential1brAvgArea: 0,
      residential2brPct: 0,
      residential2brAvgArea: 0,
      residential3brPct: 0,
      residential3brAvgArea: 0,
      retailSmallPct: 0,
      retailSmallAvgArea: 0,
      retailMediumPct: 0,
      retailMediumAvgArea: 0,
      retailLargePct: 0,
      retailLargeAvgArea: 0,
      officeSmallPct: 30,
      officeSmallAvgArea: 0,
      officeMediumPct: 50,
      officeMediumAvgArea: 0,
      officeLargePct: 20,
      officeLargeAvgArea: 0,
    };

    const result = autoPopulateAvgAreas(fields);

    expect(result.officeSmallAvgArea).toBe(400);
    expect(result.officeMediumAvgArea).toBe(800);
    expect(result.officeLargeAvgArea).toBe(1500);
  });
});

describe("DEFAULT_AVG_AREAS", () => {
  it("contains all expected unit type mappings", () => {
    const expectedKeys = [
      "residentialStudioPct",
      "residential1brPct",
      "residential2brPct",
      "residential3brPct",
      "retailSmallPct",
      "retailMediumPct",
      "retailLargePct",
      "officeSmallPct",
      "officeMediumPct",
      "officeLargePct",
    ];

    for (const key of expectedKeys) {
      expect(DEFAULT_AVG_AREAS).toHaveProperty(key);
      expect(DEFAULT_AVG_AREAS[key]).toHaveProperty("avgKey");
      expect(DEFAULT_AVG_AREAS[key]).toHaveProperty("defaultArea");
      expect(typeof DEFAULT_AVG_AREAS[key].defaultArea).toBe("number");
      expect(DEFAULT_AVG_AREAS[key].defaultArea).toBeGreaterThan(0);
    }
  });

  it("maps pct keys to correct avg area keys", () => {
    expect(DEFAULT_AVG_AREAS.residentialStudioPct.avgKey).toBe("residentialStudioAvgArea");
    expect(DEFAULT_AVG_AREAS.residential1brPct.avgKey).toBe("residential1brAvgArea");
    expect(DEFAULT_AVG_AREAS.residential2brPct.avgKey).toBe("residential2brAvgArea");
    expect(DEFAULT_AVG_AREAS.residential3brPct.avgKey).toBe("residential3brAvgArea");
    expect(DEFAULT_AVG_AREAS.retailSmallPct.avgKey).toBe("retailSmallAvgArea");
    expect(DEFAULT_AVG_AREAS.retailMediumPct.avgKey).toBe("retailMediumAvgArea");
    expect(DEFAULT_AVG_AREAS.retailLargePct.avgKey).toBe("retailLargeAvgArea");
    expect(DEFAULT_AVG_AREAS.officeSmallPct.avgKey).toBe("officeSmallAvgArea");
    expect(DEFAULT_AVG_AREAS.officeMediumPct.avgKey).toBe("officeMediumAvgArea");
    expect(DEFAULT_AVG_AREAS.officeLargePct.avgKey).toBe("officeLargeAvgArea");
  });
});
