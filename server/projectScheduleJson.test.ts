import { describe, expect, it } from "vitest";
import { mergeProjectScheduleJson } from "../client/src/lib/projectScheduleJson";

describe("project schedule JSON persistence", () => {
  const current = JSON.stringify({
    mobilizationPct: 10,
    monthlyProgress: [10, 20, 70],
    settings: {
      jointVenture: {
        landOwnerProjectSharePct: 35,
        developmentLicenseCost: 25000,
        waelLicenseRegistrationCost: 10000,
        landOwnerLicenseRegistrationCost: 10000,
        landOwnerUnitsRegistrationFeePct: 4,
      },
      configurableRates: { communityFeePerSqft: 0.25 },
    },
  });

  it("preserves Joint Venture terms when Settings saves other settings", () => {
    const saved = JSON.parse(mergeProjectScheduleJson(current, {
      settings: { configurableRates: { communityFeePerSqft: 0.3, communityFeeFrequency: 6 } },
    }));
    expect(saved.settings.jointVenture).toMatchObject({
      landOwnerProjectSharePct: 35,
      developmentLicenseCost: 25000,
      landOwnerUnitsRegistrationFeePct: 4,
    });
    expect(saved.settings.configurableRates.communityFeePerSqft).toBe(0.3);
  });

  it("preserves all settings when the construction curve is saved", () => {
    const saved = JSON.parse(mergeProjectScheduleJson(current, {
      mobilizationPct: 12,
      monthlyProgress: [25, 35, 40],
      curveType: "front_loaded",
    }));
    expect(saved.settings.jointVenture.developmentLicenseCost).toBe(25000);
    expect(saved.settings.configurableRates.communityFeePerSqft).toBe(0.25);
    expect(saved.monthlyProgress).toEqual([25, 35, 40]);
  });
});
