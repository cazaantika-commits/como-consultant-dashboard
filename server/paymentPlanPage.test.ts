import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/V2PaymentPlan.tsx"), "utf8");

describe("V2PaymentPlan page", () => {
  it("uses the current construction-series builder without referencing the removed legacy callback", () => {
    expect(source).toContain("createConstructionSeries({");
    expect(source).toContain('value="construction_series"');
    expect(source).not.toContain("addPeriodicSeries");
  });
});
