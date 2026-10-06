import { describe, expect, it } from "vitest";
import { dbProjectToRates, dbProjectToInputs, calculateProjectFormulas, calculatePricingFormulas, calculateCosts } from "./projectData";
import { calculateProjectCosts } from "./projectCostsCalc";
import { buildPricingUnits, computeInvestorCashFlow } from "./investorCashFlowEngine";

const project = {
  financingScenario: "build_for_sale",
  landPrice: "13000000",
  manualBuaSqft: "44584",
  estimatedConstructionPricePerSqft: "375",
  gfaSqft: "27606.09",
  gfaResidentialSqft: "25902.94",
  gfaRetailSqft: "1703.15",
  gfaOfficesSqft: "0",
  saleableResidentialPct: "98",
  saleableRetailPct: "96",
  saleableOfficesPct: "0",
  residential1brCount: 1,
  residential1brArea: "750",
  residential1brPrice: "1550",
  startDate: "2026-11",
  constructionMonths: 16,
  developerFeePct: "0.00",
};

function cardCosts(fee: string) {
  const record = { ...project, developerFeePct: fee };
  const inputs = dbProjectToInputs(record);
  const rates = dbProjectToRates(record);
  const pricing = calculatePricingFormulas(buildPricingUnits(record, inputs));
  return { pricing, rates, costs: calculateCosts(calculateProjectFormulas(inputs, rates), pricing, inputs, rates) };
}

describe("editable developer fee in the isolated build-for-sale study", () => {
  it("keeps the saved zero in card, feasibility cost model and investor cash flow", () => {
    const card = cardCosts("0.00");
    const feasibility = calculateProjectCosts(project)!;
    const cashFlow = computeInvestorCashFlow(project, "build_for_sale");
    const feeRow = cashFlow.rows.find(row => row.label === "أتعاب المطور");

    expect(card.pricing.totalRevenue).toBeGreaterThan(0);
    expect(card.rates.developerFeeRate).toBe(0);
    expect(card.rates.developerFeeDesign).toBe(0);
    expect(card.rates.developerFeeSupervision).toBe(0);
    expect(card.costs.developerFee).toBe(0);
    expect(feasibility.totalRevenue).toBeGreaterThan(0);
    expect(feasibility.developerFee).toBe(0);
    expect(feeRow?.totalCost).toBe(0);
  });

  it("uses an arbitrary percentage instead of forcing 3%", () => {
    const card = cardCosts("2.50");
    const feasibility = calculateProjectCosts({ ...project, developerFeePct: "2.50" })!;
    expect(card.rates.developerFeeRate).toBeCloseTo(0.025, 10);
    expect(card.costs.developerFee).toBeCloseTo(card.pricing.totalRevenue * 0.025, 4);
    expect(feasibility.developerFee).toBeCloseTo(feasibility.totalRevenue * 0.025, 4);
  });

  it("uses the original 3% default only when the input is actually absent", () => {
    const { developerFeePct: _omitted, ...missing } = project;
    expect(dbProjectToRates(missing).developerFeeRate).toBeCloseTo(0.03, 10);
    expect(dbProjectToRates({ ...project, developerFeePct: "" }).developerFeeRate).toBeCloseTo(0.03, 10);
    expect(calculateProjectCosts(missing)!.developerFee).toBeCloseTo(calculateProjectCosts(missing)!.totalRevenue * 0.03, 4);
  });
});
