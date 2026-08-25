import { describe, expect, it } from "vitest";
import { getConstructionProgressMilestones } from "./projectTiming";

describe("construction progress milestones", () => {
  it("turns approved monthly construction progress into cumulative due-date milestones", () => {
    const milestones = getConstructionProgressMilestones({
      constructionMonths: 3,
      constructionScheduleJson: JSON.stringify({
        monthlyProgress: [10, 20, 70],
        settings: {
          designPayments: {
            mobilization: { durationWeeks: 1 }, concept: { durationWeeks: 1 }, schematic: { durationWeeks: 1 }, dd: { durationWeeks: 1 }, authorities: { durationWeeks: 1 }, tender: { durationWeeks: 1 }, ifc: { durationWeeks: 1 },
          },
        },
      }),
    });
    expect(milestones.map((item) => item.progressPct)).toEqual([10, 30, 100]);
    expect(milestones[1].month).toBe(milestones[0].month + 1);
  });
});
