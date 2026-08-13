import { describe, expect, it } from "vitest";
import { getProjectDesignTiming } from "../client/src/lib/projectTiming";

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
