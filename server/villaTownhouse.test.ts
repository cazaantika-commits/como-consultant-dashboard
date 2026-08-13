import { describe, expect, it } from "vitest";
import { buildPricingUnits } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { PROJECT_INPUTS } from "../client/src/lib/projectData";

describe("Villa and Townhouse Financial Studies support", () => {
  const project = {
    financingScenario: "build_for_sale",
    villaCount: 2,
    villaArea: 4000,
    villaPrice: 2000,
    townhouseCount: 3,
    townhouseArea: 2000,
    townhousePrice: 1500,
    constructionScheduleJson: "{}",
    constructionMonths: 12,
    landPrice: "0",
    agentCommissionLandPct: "0",
    manualBuaSqft: "0",
    estimatedConstructionPricePerSqft: "0",
    soilTestFee: "0",
    topographicSurveyFee: "0",
    officialBodiesFees: "0",
    reraUnitRegFee: "0",
    reraProjectRegFee: "0",
    developerNocFee: "0",
    escrowAccountFee: "0",
    bankFees: "0",
    designFeePct: "0",
    supervisionFeePct: "0",
    separationFeePerSqft: "0",
    salesCommissionPct: "0",
    marketingPct: "0",
    developerFeePct: "0",
    plotAreaSqft: "0",
    gfaResidentialSqft: "0",
    gfaRetailSqft: "0",
    gfaOfficesSqft: "0",
    saleableResidentialPct: "95",
    saleableRetailPct: "97",
    saleableOfficesPct: "95",
    surveyorFees: "0",
    surveyorDwgFees: "0",
    communityFees: "0",
  };

  it("includes both types in the shared unit-sales source", () => {
    const units = buildPricingUnits(project, PROJECT_INPUTS);
    expect(units.find((unit) => unit.name === "فيلا")).toMatchObject({ count: 2, area: 4000, price: 2000 });
    expect(units.find((unit) => unit.name === "تاون هاوس")).toMatchObject({ count: 3, area: 2000, price: 1500 });
  });

  it("includes both types in Feasibility Study revenue", () => {
    const costs = calculateProjectCosts(project);
    expect(costs?.revenueRes).toBe(25_000_000);
    expect(costs?.totalRevenue).toBe(25_000_000);
  });
});
