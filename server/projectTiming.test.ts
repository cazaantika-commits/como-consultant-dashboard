import { describe, expect, it } from "vitest";
import {
  clampMarketingDistributionToStart,
  getBuildForSaleSalesTimelineWindow,
  getProjectDesignTiming,
  getMarketingTimelineWindow,
  getProjectMarketingTiming,
  getSalesTimelineWindow,
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

  it("uses saved Settings design weeks for build-for-sale regardless of legacy duration fields", () => {
    const project = {
      financingScenario: "build_for_sale",
      preConMonths: 24,
      constructionMonths: 14,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: {
            mobilization: { durationWeeks: 2 }, concept: { durationWeeks: 2 }, schematic: { durationWeeks: 2 },
            dd: { durationWeeks: 4 }, authorities: { durationWeeks: 4 }, tender: { durationWeeks: 4 }, ifc: { durationWeeks: 2 },
          },
          projectPhases: {
            marketingPrep: { durationMonths: 2, startOffsetMonths: 0 },
            reraApprovals: { durationMonths: 2, startOffsetMonths: 1 },
            marketingLaunch: { durationMonths: 0, startOffsetMonths: 0 },
            salesStart: { durationMonths: 0, startOffsetMonths: 1 },
            construction: { durationMonths: 0, startOffsetMonths: 1 },
          },
        },
      }),
    };

    const timing = getProjectMarketingTiming(project);
    expect(timing.designMonths).toBe(5);
    expect(timing.constructionStartMonth).toBe(6);
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

describe("Settings-driven phase offsets and durations", () => {
  it("uses saved phase timing instead of legacy General Inputs timing fields", () => {
    const project = {
      constructionMonths: 18,
      marketingPrepMonths: 9,
      reraLeadMonths: 9,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: {
            mobilization: { durationWeeks: 1 }, concept: { durationWeeks: 1 }, schematic: { durationWeeks: 2 },
            dd: { durationWeeks: 4 }, authorities: { durationWeeks: 4 }, tender: { durationWeeks: 4 }, ifc: { durationWeeks: 4 },
          },
          projectPhases: {
            marketingPrep: { durationMonths: 3, startOffsetMonths: 0 },
            reraApprovals: { durationMonths: 1, startOffsetMonths: 1 },
            marketingLaunch: { durationMonths: 0, startOffsetMonths: 0 },
            salesStart: { durationMonths: 0, startOffsetMonths: 1 },
            construction: { durationMonths: 0, startOffsetMonths: 1 },
          },
        },
      }),
    };

    const timing = getProjectMarketingTiming(project);
    expect(timing.designMonths).toBe(5);
    expect(timing.materialsStartMonth).toBe(2);
    expect(timing.materialsEndMonth).toBe(4);
    expect(timing.marketingStartMonth).toBe(5);
    expect(timing.reraStartMonth).toBe(3);
    expect(timing.reraEndMonth).toBe(3);
    expect(timing.salesStartMonth).toBe(5);
    expect(timing.constructionStartMonth).toBe(6);
  });
});

describe("Timeline saved activity windows", () => {
  it("uses the Marketing page end month without allowing an earlier-than-Settings start", () => {
    expect(getMarketingTimelineWindow({
      settingsStartMonth: 6,
      projectEndMonth: 37,
      savedStartMonth: 4,
      savedEndMonth: 21,
    })).toEqual({ startMonth: 6, endMonth: 21, hasSavedActivity: true });
  });

  it("derives the Sales bar from the first and last positive saved sale months", () => {
    expect(getSalesTimelineWindow({
      settingsStartMonth: 8,
      projectEndMonth: 37,
      salesDistribution: [0, 12, 0, 8, 0],
    })).toEqual({ startMonth: 9, endMonth: 11, hasSavedActivity: true });
  });

  it("anchors build-for-sale direct sale units after completion instead of treating relative indexes as project months", () => {
    expect(getBuildForSaleSalesTimelineWindow({
      projectEndMonth: 18,
      directSalesUnits: [0, 4, 0, 6],
    })).toEqual({ startMonth: 20, endMonth: 22, hasSavedActivity: true });
  });
});

describe("Project-relative phase dependencies", () => {
  function projectWithWeeks(weeks: number[]) {
    const ids = ["mobilization", "concept", "schematic", "dd", "authorities", "tender", "ifc"];
    return {
      constructionMonths: 18,
      marketingPrepMonths: 2,
      reraLeadMonths: 2,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: Object.fromEntries(ids.map((id, index) => [id, { durationWeeks: weeks[index] }])),
        },
      }),
    };
  }

  it("calculates dependencies from a five-month design schedule without fixed project months", () => {
    const timing = getProjectMarketingTiming(projectWithWeeks([1, 1, 2, 4, 4, 4, 4]));
    expect(timing.designMonths).toBe(5);
    expect(timing.schematicCompletionMonth).toBe(1);
    expect(timing.materialsStartMonth).toBe(2);
    expect(timing.marketingStartMonth).toBe(4);
    expect(timing.reraStartMonth).toBe(3);
    expect(timing.salesStartMonth).toBe(6);
    expect(timing.constructionStartMonth).toBe(6);
  });

  it("calculates different phase months from a longer design schedule using the same rules", () => {
    const timing = getProjectMarketingTiming(projectWithWeeks([1, 2, 3, 4, 4, 4, 4]));
    expect(timing.designMonths).toBe(6);
    expect(timing.schematicCompletionMonth).toBe(2);
    expect(timing.materialsStartMonth).toBe(3);
    expect(timing.marketingStartMonth).toBe(5);
    expect(timing.reraStartMonth).toBe(4);
    expect(timing.salesStartMonth).toBe(7);
    expect(timing.constructionStartMonth).toBe(7);
  });
});
