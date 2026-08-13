import { describe, expect, it } from "vitest";
import {
  clampMarketingDistributionToStart,
  getProjectDesignTiming,
  getProjectMarketingTiming,
} from "../client/src/lib/projectTiming";

describe("Settings-driven design duration", () => {
  it("derives months only from saved design-stage weeks, not legacy preConMonths", () => {
    const project = {
      preConMonths: 12,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: {
            mobilization: { durationWeeks: 2 },
            concept: { durationWeeks: 4 },
            schematic: { durationWeeks: 4 },
            dd: { durationWeeks: 6 },
            authorities: { durationWeeks: 4 },
            tender: { durationWeeks: 4 },
            ifc: { durationWeeks: 2 },
          },
        },
      }),
    };

    const timing = getProjectDesignTiming(project);
    expect(timing.totalWeeks).toBe(26);
    expect(timing.designMonths).toBe(7);
    expect(timing.schematicCompletionMonth).toBe(3);
  });
});

describe("Settings-driven marketing start", () => {
  const project = {
    constructionMonths: 30,
    marketingPrepMonths: 2,
    reraLeadMonths: 2,
    constructionScheduleJson: JSON.stringify({
      settings: { designPayments: {
        mobilization: { durationWeeks: 2 }, concept: { durationWeeks: 4 }, schematic: { durationWeeks: 4 },
        dd: { durationWeeks: 6 }, authorities: { durationWeeks: 4 }, tender: { durationWeeks: 4 }, ifc: { durationWeeks: 2 },
      } },
    }),
  };

  it("derives marketing start after the saved schematic and preparation periods", () => {
    const timing = getProjectMarketingTiming(project);
    expect(timing.schematicCompletionMonth).toBe(3);
    expect(timing.materialsStartMonth).toBe(4);
    expect(timing.marketingStartMonth).toBe(6);
    expect(timing.projectEndMonth).toBe(37);
  });

  it("drops saved allocations that precede the permitted marketing month", () => {
    expect(clampMarketingDistributionToStart({ digital: [100, 200, 300, 400] }, 4, 6))
      .toEqual({ digital: [300, 400] });
  });
});
