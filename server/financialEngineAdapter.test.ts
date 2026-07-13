/**
 * Tests for the Financial Engine Adapter
 * Verifies that the new engine output maps correctly to the existing API shape.
 */
import { describe, expect, it } from "vitest";
import { adaptToPortfolioShape, buildPortfolioProjectV2 } from "./financialEngineAdapter";
import { computeFullFinancials, type ProjectInputs } from "./financialEngine";

// Real project data: Nad Al Sheba Plot 1
const NAD_AL_SHEBA_INPUTS: ProjectInputs = {
  landPrice: 21_000_000,
  agentCommissionLandPct: 2,
  buaSqft: 56_250,
  constructionPricePerSqft: 350,
  gfaResidentialSqft: 56_250,
  gfaRetailSqft: 0,
  gfaOfficesSqft: 0,
  saleableResidentialPct: 95,
  saleableRetailPct: 97,
  saleableOfficesPct: 95,
  soilTestFee: 50_000,
  topographicSurveyFee: 25_000,
  officialBodiesFees: 500_000,
  reraProjectRegFee: 100_000,
  developerNocFee: 5_100,
  escrowAccountFee: 10_000,
  bankFees: 150_000,
  surveyorFees: 50_000,
  reraAuditReportFee: 100_000,
  reraUnitFeePerUnit: 800,
  totalUnits: 50,
  communityFeeRate: 1,
  reraInspectionFeePerVisit: 15_000,
  designFeePct: 2,
  supervisionFeePct: 2,
  separationFeePerSqft: 40,
  salesCommissionPct: 5,
  marketingPct: 2,
  developerFeePct: 5,
  designFeeMethod: "percentage",
  supervisionFeeMethod: "percentage",
  designMonths: 6,
  offplanMonths: 2,
  constructionMonths: 16,
  handoverMonths: 2,
  financingScenario: "offplan_escrow",
  pricingScenario: "base",
  approvedRevenue: 93_765_000,
  startDate: "2026-04",
};

describe("adaptToPortfolioShape", () => {
  const result = computeFullFinancials(NAD_AL_SHEBA_INPUTS);
  const adapted = adaptToPortfolioShape(result, NAD_AL_SHEBA_INPUTS);

  it("should have correct investorTotal", () => {
    expect(adapted.investorTotal).toBeGreaterThan(0);
    expect(adapted.investorTotal).toBe(result.capitalRequired);
  });

  it("should have correct escrowTotal", () => {
    expect(adapted.escrowTotal).toBeGreaterThan(0);
    expect(adapted.escrowTotal).toBe(
      result.escrowCashFlow.reduce((s, item) => s + item.total, 0)
    );
  });

  it("grandTotal = investorTotal + escrowTotal", () => {
    expect(adapted.grandTotal).toBeCloseTo(
      adapted.investorTotal + adapted.escrowTotal, 2
    );
  });

  it("monthlyInvestor array has at least totalMonths length", () => {
    expect(adapted.monthlyInvestor.length).toBeGreaterThanOrEqual(result.timeline.totalMonths);
  });

  it("monthlyEscrow array has at least totalMonths length", () => {
    expect(adapted.monthlyEscrow.length).toBeGreaterThanOrEqual(result.timeline.totalMonths);
  });

  it("monthlyTotal array has at least totalMonths length", () => {
    expect(adapted.monthlyTotal.length).toBeGreaterThanOrEqual(result.timeline.totalMonths);
  });

  it("monthlyTotal[i] = monthlyInvestor[i] + monthlyEscrow[i] for all indices", () => {
    for (let i = 0; i < adapted.monthlyTotal.length; i++) {
      expect(adapted.monthlyTotal[i]).toBeCloseTo(
        adapted.monthlyInvestor[i] + adapted.monthlyEscrow[i], 2
      );
    }
  });

  it("sum of monthlyInvestor equals investorTotal", () => {
    const sum = adapted.monthlyInvestor.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(adapted.investorTotal, 0);
  });

  it("sum of monthlyEscrow equals escrowTotal", () => {
    const sum = adapted.monthlyEscrow.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(adapted.escrowTotal, 0);
  });

  it("sectionTotals has all required sections", () => {
    expect(adapted.sectionTotals).toHaveProperty("paid");
    expect(adapted.sectionTotals).toHaveProperty("design");
    expect(adapted.sectionTotals).toHaveProperty("offplan");
    expect(adapted.sectionTotals).toHaveProperty("construction");
    expect(adapted.sectionTotals).toHaveProperty("escrow");
  });

  it("sectionTotals.paid includes land costs", () => {
    // Land + broker + registration
    const expectedPaid = 21_000_000 + (21_000_000 * 0.02) + (21_000_000 * 0.04);
    expect(adapted.sectionTotals.paid).toBeCloseTo(expectedPaid, 0);
  });

  it("monthlyBySection has all sections with at least totalMonths length", () => {
    for (const section of ["paid", "design", "offplan", "construction", "escrow"]) {
      expect(adapted.monthlyBySection[section]).toBeDefined();
      expect(adapted.monthlyBySection[section].length).toBeGreaterThanOrEqual(result.timeline.totalMonths);
    }
  });

  it("monthlyInvestorBySection has all sections with at least totalMonths length", () => {
    for (const section of ["paid", "design", "offplan", "construction", "escrow"]) {
      expect(adapted.monthlyInvestorBySection[section]).toBeDefined();
      expect(adapted.monthlyInvestorBySection[section].length).toBeGreaterThanOrEqual(result.timeline.totalMonths);
    }
  });
});

describe("adaptToPortfolioShape O3 scenario", () => {
  const o3Inputs: ProjectInputs = {
    ...NAD_AL_SHEBA_INPUTS,
    financingScenario: "no_offplan",
    developerFeePct: 3,
  };
  const result = computeFullFinancials(o3Inputs);
  const adapted = adaptToPortfolioShape(result, o3Inputs);

  it("O3 should have zero escrowTotal", () => {
    expect(adapted.escrowTotal).toBe(0);
  });

  it("O3 grandTotal = investorTotal (no escrow)", () => {
    expect(adapted.grandTotal).toBe(adapted.investorTotal);
  });

  it("O3 monthlyEscrow should be all zeros", () => {
    for (const val of adapted.monthlyEscrow) {
      expect(val).toBe(0);
    }
  });
});

describe("buildPortfolioProjectV2", () => {
  // Simulate a raw DB project record
  const mockProject = {
    id: 6185392,
    name: "ند الشبا — قطعة 1",
    landPrice: "21000000",
    agentCommissionLandPct: "2",
    manualBuaSqft: "56250",
    estimatedConstructionPricePerSqft: "350",
    gfaResidentialSqft: "56250",
    gfaRetailSqft: "0",
    gfaOfficesSqft: "0",
    saleableResidentialPct: "95",
    saleableRetailPct: "97",
    saleableOfficesPct: "95",
    soilTestFee: "50000",
    topographicSurveyFee: "25000",
    officialBodiesFees: "500000",
    reraProjectRegFee: "100000",
    developerNocFee: "5100",
    escrowAccountFee: "10000",
    bankFees: "150000",
    surveyorFees: "50000",
    reraAuditReportFee: "100000",
    designFeePct: "2",
    supervisionFeePct: "2",
    separationFeePerSqft: "40",
    salesCommissionPct: "5",
    marketingPct: "2",
    developerFeePct: "5",
    preConMonths: "6",
    constructionMonths: "16",
    handoverMonths: "2",
    financingScenario: "offplan_escrow",
    startDate: "2026-04",
  };

  it("should return a valid portfolio project", () => {
    const result = buildPortfolioProjectV2(mockProject, undefined, 50, 93_765_000);
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe(6185392);
    expect(result!.name).toBe("ند الشبا — قطعة 1");
  });

  it("should have all 3 scenarios", () => {
    const result = buildPortfolioProjectV2(mockProject, undefined, 50, 93_765_000);
    expect(result!.scenarios).toHaveProperty("offplan_escrow");
    expect(result!.scenarios).toHaveProperty("offplan_construction");
    expect(result!.scenarios).toHaveProperty("no_offplan");
  });

  it("should have correct phase info", () => {
    const result = buildPortfolioProjectV2(mockProject, undefined, 50, 93_765_000);
    expect(result!.durations.design).toBe(6);
    expect(result!.durations.construction).toBe(16);
    expect(result!.durations.handover).toBe(2);
  });

  it("O1 grandTotal should be greater than O3 grandTotal", () => {
    const result = buildPortfolioProjectV2(mockProject, undefined, 50, 93_765_000);
    const o1 = result!.scenarios["offplan_escrow"];
    const o3 = result!.scenarios["no_offplan"];
    // O1 has escrow expenses, O3 doesn't
    expect(o1.grandTotal).toBeGreaterThan(o3.grandTotal);
  });

  it("each scenario grandTotal = investorTotal + escrowTotal", () => {
    const result = buildPortfolioProjectV2(mockProject, undefined, 50, 93_765_000);
    for (const sc of ["offplan_escrow", "offplan_construction", "no_offplan"]) {
      const data = result!.scenarios[sc];
      expect(data.grandTotal).toBeCloseTo(data.investorTotal + data.escrowTotal, 2);
    }
  });
});
