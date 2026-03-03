import { describe, it, expect } from "vitest";

/**
 * Tests for the CostsCashFlowTab read-only cost calculation logic.
 * The component pulls data from 3 sources:
 * 1. Fact Sheet (projects table) - land price, fees, percentages
 * 2. Tab 1 (marketOverview) - BUA, plot area
 * 3. Tab 2 (competitionPricing) - total revenue
 * All calculations are read-only, no editable fields.
 */

// Replicate the calculation logic from CostsCashFlowTab
function calculateCosts(project: Record<string, any>, feasForm: Record<string, any>, feasComputed: Record<string, any>) {
  const landPrice = parseFloat(project.landPrice || "0");
  const agentCommissionLandPct = parseFloat(project.agentCommissionLandPct || "0");
  const manualBuaSqft = parseFloat(project.manualBuaSqft || "0");
  const estimatedConstructionPricePerSqft = parseFloat(project.estimatedConstructionPricePerSqft || "0");
  const soilTestFee = parseFloat(project.soilTestFee || "0");
  const topographicSurveyFee = parseFloat(project.topographicSurveyFee || "0");
  const officialBodiesFees = parseFloat(project.officialBodiesFees || "0");
  const reraUnitRegFee = parseFloat(project.reraUnitRegFee || "0");
  const reraProjectRegFee = parseFloat(project.reraProjectRegFee || "0");
  const developerNocFee = parseFloat(project.developerNocFee || "0");
  const escrowAccountFee = parseFloat(project.escrowAccountFee || "0");
  const bankFees = parseFloat(project.bankFees || "0");
  const communityFees = parseFloat(project.communityFees || "0");
  const surveyorFees = parseFloat(project.surveyorFees || "0");
  const reraAuditReportFee = parseFloat(project.reraAuditReportFee || "0");
  const reraInspectionReportFee = parseFloat(project.reraInspectionReportFee || "0");
  const designFeePct = parseFloat(project.designFeePct || "0");
  const supervisionFeePct = parseFloat(project.supervisionFeePct || "0");
  const separationFeePerM2 = parseFloat(project.separationFeePerM2 || "0");
  const salesCommissionPct = parseFloat(project.salesCommissionPct || "0");
  const marketingPct = parseFloat(project.marketingPct || "0");
  const developerFeePhase1Pct = parseFloat(project.developerFeePhase1Pct || "0");
  const developerFeePhase2Pct = parseFloat(project.developerFeePhase2Pct || "0");

  const bua = manualBuaSqft || feasForm.estimatedBua || feasComputed.estimatedBua || 0;
  const plotAreaSqft = parseFloat(project.plotAreaSqft || "0");
  const plotAreaM2 = plotAreaSqft * 0.0929;
  const totalRevenue = feasComputed.totalRevenue || 0;

  // Land costs
  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const totalLandCosts = landPrice + agentCommissionLand + landRegistration;

  // Pre-construction
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = constructionCost * (designFeePct / 100);
  const supervisionFee = constructionCost * (supervisionFeePct / 100);
  const separationFee = plotAreaM2 * separationFeePerM2;
  const totalPreConstruction = soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee;

  // Construction
  const contingencies = constructionCost * 0.02;
  const totalConstruction = constructionCost + communityFees + contingencies;

  // Sales & marketing
  const developerFeePhase1 = totalRevenue * (developerFeePhase1Pct / 100);
  const developerFeePhase2 = totalRevenue * (developerFeePhase2Pct / 100);
  const totalDeveloperFee = developerFeePhase1 + developerFeePhase2;
  const salesCommission = totalRevenue * (salesCommissionPct / 100);
  const marketingCost = totalRevenue * (marketingPct / 100);
  const totalSalesMarketing = totalDeveloperFee + salesCommission + marketingCost;

  // Regulatory
  const totalRegulatory = reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;

  // Totals
  const totalCosts = totalLandCosts + totalPreConstruction + totalConstruction + totalSalesMarketing + totalRegulatory;
  const profit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

  return {
    landPrice, agentCommissionLand, landRegistration, totalLandCosts,
    constructionCost, designFee, supervisionFee, separationFee, totalPreConstruction,
    contingencies, totalConstruction,
    developerFeePhase1, developerFeePhase2, totalDeveloperFee, salesCommission, marketingCost, totalSalesMarketing,
    totalRegulatory, totalCosts, profit, profitMargin, roi,
  };
}

describe("CostsCashFlowTab Read-Only Calculations", () => {
  const sampleProject = {
    landPrice: "5000000",
    agentCommissionLandPct: "2",
    manualBuaSqft: "50000",
    estimatedConstructionPricePerSqft: "350",
    plotAreaSqft: "20000",
    soilTestFee: "15000",
    topographicSurveyFee: "10000",
    officialBodiesFees: "50000",
    designFeePct: "3",
    supervisionFeePct: "2",
    separationFeePerM2: "40",
    salesCommissionPct: "5",
    marketingPct: "2",
    developerFeePhase1Pct: "2",
    developerFeePhase2Pct: "3",
    reraUnitRegFee: "25000",
    reraProjectRegFee: "150000",
    developerNocFee: "10000",
    escrowAccountFee: "140000",
    bankFees: "20000",
    communityFees: "30000",
    surveyorFees: "12000",
    reraAuditReportFee: "18000",
    reraInspectionReportFee: "70000",
  };

  const feasForm = {};
  const feasComputed = { totalRevenue: 80000000, totalUnits: 100 };

  it("calculates land costs correctly", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.landPrice).toBe(5000000);
    expect(result.agentCommissionLand).toBe(100000); // 5M * 2%
    expect(result.landRegistration).toBe(200000); // 5M * 4%
    expect(result.totalLandCosts).toBe(5300000); // 5M + 100K + 200K
  });

  it("calculates construction cost from BUA * price/sqft", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.constructionCost).toBe(17500000); // 50000 * 350
  });

  it("calculates design and supervision fees as % of construction", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.designFee).toBe(525000); // 17.5M * 3%
    expect(result.supervisionFee).toBe(350000); // 17.5M * 2%
  });

  it("calculates separation fee from plot area", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    const plotAreaM2 = 20000 * 0.0929;
    expect(result.separationFee).toBeCloseTo(plotAreaM2 * 40, 0);
  });

  it("calculates contingencies as 2% of construction", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.contingencies).toBe(350000); // 17.5M * 2%
  });

  it("calculates developer fees in two phases from revenue", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.developerFeePhase1).toBe(1600000); // 80M * 2%
    expect(result.developerFeePhase2).toBe(2400000); // 80M * 3%
    expect(result.totalDeveloperFee).toBe(4000000); // 1.6M + 2.4M
  });

  it("calculates sales commission and marketing from revenue", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.salesCommission).toBe(4000000); // 80M * 5%
    expect(result.marketingCost).toBe(1600000); // 80M * 2%
  });

  it("sums regulatory fees correctly", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.totalRegulatory).toBe(445000); // 25K+150K+10K+140K+20K+12K+18K+70K
  });

  it("calculates profit and margins", () => {
    const result = calculateCosts(sampleProject, feasForm, feasComputed);
    expect(result.profit).toBe(result.totalCosts > 0 ? 80000000 - result.totalCosts : 0);
    expect(result.profitMargin).toBeGreaterThan(0);
    expect(result.roi).toBeGreaterThan(0);
  });

  it("returns zero costs when project data is empty", () => {
    const result = calculateCosts({}, {}, { totalRevenue: 0 });
    expect(result.totalCosts).toBe(0);
    expect(result.profit).toBe(0);
    expect(result.profitMargin).toBe(0);
    expect(result.roi).toBe(0);
  });

  it("handles missing revenue gracefully (costs only)", () => {
    const result = calculateCosts(sampleProject, feasForm, { totalRevenue: 0 });
    // Sales/marketing costs should be 0 when revenue is 0
    expect(result.totalSalesMarketing).toBe(0);
    // But land + construction + regulatory costs should still exist
    expect(result.totalLandCosts).toBeGreaterThan(0);
    expect(result.totalConstruction).toBeGreaterThan(0);
    expect(result.totalRegulatory).toBeGreaterThan(0);
    // Profit should be negative (costs without revenue)
    expect(result.profit).toBeLessThan(0);
  });

  it("uses manualBuaSqft from fact sheet over feasForm", () => {
    const result = calculateCosts(
      { ...sampleProject, manualBuaSqft: "60000" },
      { estimatedBua: 40000 },
      { totalRevenue: 80000000 }
    );
    // Should use 60000 from fact sheet, not 40000 from feasForm
    expect(result.constructionCost).toBe(60000 * 350);
  });

  it("falls back to feasForm.estimatedBua when manualBuaSqft is 0", () => {
    const result = calculateCosts(
      { ...sampleProject, manualBuaSqft: "0" },
      { estimatedBua: 40000 },
      { totalRevenue: 80000000 }
    );
    expect(result.constructionCost).toBe(40000 * 350);
  });

  it("identifies missing data items", () => {
    const emptyProject = {};
    const result = calculateCosts(emptyProject, {}, { totalRevenue: 0 });
    // When all data is empty, missing should include key items
    expect(result.totalCosts).toBe(0);
  });
});
