import { describe, expect, it } from "vitest";
import { registrationMilestoneRequirements } from "./registrationMilestoneRequirements";

describe("registration milestone supplemental requirements", () => {
  it("adds evidence only to the four existing registration-flow services", () => {
    const allowedServices = new Set([
      "SRV-RERA-PROJ-REG",
      "SRV-RERA-ESCROW-OPEN",
      "SRV-RERA-PROJ-PLAN",
      "SRV-RERA-MKT-PERMIT",
    ]);

    expect(registrationMilestoneRequirements.length).toBeGreaterThanOrEqual(15);
    expect(registrationMilestoneRequirements.every((item) => allowedServices.has(item.serviceCode))).toBe(true);
    expect(new Set(registrationMilestoneRequirements.map((item) => item.requirementCode)).size)
      .toBe(registrationMilestoneRequirements.length);
  });

  it("keeps every supplemental item non-blocking so existing project schedules cannot change", () => {
    expect(registrationMilestoneRequirements.every((item) => item.isMandatory === false)).toBe(true);
  });
});
