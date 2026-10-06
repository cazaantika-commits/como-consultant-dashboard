import { describe, expect, it } from "vitest";
import { calculateProjectFormulas, dbProjectToInputs } from "./projectData";

describe("project GFA calculations", () => {
  it("uses the documented gross GFA when it differs from the classified saleable programme", () => {
    const inputs = dbProjectToInputs({
      name: "Liwan 2 | Plot 6439823",
      gfaSqft: "27606.09",
      gfaResidentialSqft: "25902.94",
      gfaRetailSqft: "1703.15",
      gfaOfficesSqft: "0",
      saleableResidentialPct: "80.59145645037019",
      saleableRetailPct: "80.59145645037019",
      saleableOfficesPct: "0",
      financingScenario: "build_for_sale",
    });

    const formulas = calculateProjectFormulas(inputs);

    expect(inputs.gfaTotal).toBeCloseTo(27606.09, 2);
    expect(formulas.gfaTotal).toBeCloseTo(27606.09, 2);
    expect(formulas.sellableResidential + formulas.sellableRetail + formulas.sellableOffice)
      .toBeCloseTo(22248.15, 2);
    expect((formulas.sellableTotal / formulas.gfaTotal) * 100).toBeCloseTo(80.591456, 5);
  });

  it("falls back to the classified use areas only when no documented GFA is available", () => {
    const inputs = dbProjectToInputs({
      name: "Unclassified source",
      gfaResidentialSqft: "1200",
      gfaRetailSqft: "300",
      gfaOfficesSqft: "0",
      financingScenario: "build_for_sale",
    });

    expect(calculateProjectFormulas(inputs).gfaTotal).toBe(1500);
  });
});
