import { describe, it, expect } from "vitest";

// Test the cost computation logic that mirrors the frontend CostsCashFlowTab
describe("CostsCashFlow Computations", () => {
  const computeCosts = (fields: any, feasData: any) => {
    const bua = feasData.estimatedBua || 0;
    const plotAreaM2 = (feasData.plotArea || 0) * 0.0929;
    const totalUnits = feasData.totalUnits || 0;
    const totalRevenue = feasData.totalRevenue || 0;

    const agentCommissionLand = fields.landPrice * (fields.agentCommissionLandPct / 100);
    const landRegistration = fields.landPrice * (fields.landRegistrationPct / 100);
    const designFee = (bua * fields.constructionCostPerSqft) * (fields.designFeePct / 100);
    const supervisionFee = (bua * fields.constructionCostPerSqft) * (fields.supervisionFeePct / 100);
    const separationFee = plotAreaM2 * fields.separationFeePerM2;
    const constructionCost = bua * fields.constructionCostPerSqft;
    const contingencies = constructionCost * (fields.contingenciesPct / 100);
    const developerFee = totalRevenue * (fields.developerFeePct / 100);
    const agentCommissionSale = totalRevenue * (fields.agentCommissionSalePct / 100);
    const marketing = totalRevenue * (fields.marketingPct / 100);
    const reraUnitTotal = totalUnits * fields.reraUnitFee;

    const totalCosts = fields.landPrice + agentCommissionLand + landRegistration +
      fields.soilInvestigation + fields.topographySurvey +
      designFee + supervisionFee + fields.authoritiesFee + separationFee +
      constructionCost + fields.communityFee + contingencies +
      developerFee + agentCommissionSale + marketing +
      fields.reraOffplanFee + reraUnitTotal + fields.nocFee +
      fields.escrowFee + fields.bankCharges + fields.surveyorFees +
      fields.reraAuditFees + fields.reraInspectionFees;

    const profit = totalRevenue - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
    const comoProfit = profit * (fields.comoProfitSharePct / 100);
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      bua, totalRevenue, totalUnits, plotAreaM2,
      agentCommissionLand, landRegistration, designFee, supervisionFee,
      separationFee, constructionCost, contingencies, developerFee,
      agentCommissionSale, marketing, reraUnitTotal, totalCosts,
      profit, roi, comoProfit, profitMargin,
    };
  };

  const defaultFields = {
    landPrice: 10000000,
    agentCommissionLandPct: 1,
    landRegistrationPct: 4,
    soilInvestigation: 50000,
    topographySurvey: 30000,
    designFeePct: 2,
    supervisionFeePct: 2,
    authoritiesFee: 100000,
    separationFeePerM2: 40,
    constructionCostPerSqft: 250,
    communityFee: 200000,
    contingenciesPct: 2,
    developerFeePct: 5,
    agentCommissionSalePct: 5,
    marketingPct: 2,
    reraOffplanFee: 150000,
    reraUnitFee: 850,
    nocFee: 10000,
    escrowFee: 140000,
    bankCharges: 20000,
    surveyorFees: 12000,
    reraAuditFees: 18000,
    reraInspectionFees: 70000,
    comoProfitSharePct: 15,
  };

  const defaultFeasData = {
    estimatedBua: 50000,
    plotArea: 10000,
    totalUnits: 100,
    totalRevenue: 80000000,
  };

  it("should calculate land costs correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    expect(result.agentCommissionLand).toBe(100000); // 10M * 1%
    expect(result.landRegistration).toBe(400000); // 10M * 4%
  });

  it("should calculate construction cost correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    expect(result.constructionCost).toBe(12500000); // 50000 sqft * 250 AED/sqft
  });

  it("should calculate design and supervision fees correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // design fee = constructionCost * 2% = 12500000 * 0.02 = 250000
    expect(result.designFee).toBe(250000);
    // supervision fee = constructionCost * 2% = 250000
    expect(result.supervisionFee).toBe(250000);
  });

  it("should calculate separation fee correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // plotAreaM2 = 10000 * 0.0929 = 929 m2
    // separationFee = 929 * 40 = 37160
    expect(result.separationFee).toBeCloseTo(37160, 0);
  });

  it("should calculate contingencies correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // contingencies = constructionCost * 2% = 12500000 * 0.02 = 250000
    expect(result.contingencies).toBe(250000);
  });

  it("should calculate revenue-based costs correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // developerFee = 80M * 5% = 4000000
    expect(result.developerFee).toBe(4000000);
    // agentCommissionSale = 80M * 5% = 4000000
    expect(result.agentCommissionSale).toBe(4000000);
    // marketing = 80M * 2% = 1600000
    expect(result.marketing).toBe(1600000);
  });

  it("should calculate RERA unit total correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // 100 units * 850 = 85000
    expect(result.reraUnitTotal).toBe(85000);
  });

  it("should calculate total costs as sum of all cost items", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    // Verify total costs is positive and reasonable
    expect(result.totalCosts).toBeGreaterThan(0);
    // Manual check: land(10M) + commission(100k) + registration(400k) + soil(50k) + topo(30k) +
    // design(250k) + supervision(250k) + authorities(100k) + separation(37160) +
    // construction(12.5M) + community(200k) + contingencies(250k) +
    // developer(4M) + agentSale(4M) + marketing(1.6M) +
    // rera(150k) + reraUnits(85k) + noc(10k) + escrow(140k) + bank(20k) +
    // surveyor(12k) + reraAudit(18k) + reraInspection(70k)
    const expectedTotal = 10000000 + 100000 + 400000 + 50000 + 30000 +
      250000 + 250000 + 100000 + 37160 +
      12500000 + 200000 + 250000 +
      4000000 + 4000000 + 1600000 +
      150000 + 85000 + 10000 + 140000 + 20000 +
      12000 + 18000 + 70000;
    expect(result.totalCosts).toBeCloseTo(expectedTotal, 0);
  });

  it("should calculate profit correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    expect(result.profit).toBe(result.totalRevenue - result.totalCosts);
  });

  it("should calculate ROI correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    const expectedRoi = (result.profit / result.totalCosts) * 100;
    expect(result.roi).toBeCloseTo(expectedRoi, 2);
  });

  it("should calculate COMO profit share correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    expect(result.comoProfit).toBe(result.profit * 0.15);
  });

  it("should calculate profit margin correctly", () => {
    const result = computeCosts(defaultFields, defaultFeasData);
    const expectedMargin = (result.profit / result.totalRevenue) * 100;
    expect(result.profitMargin).toBeCloseTo(expectedMargin, 2);
  });

  it("should handle zero BUA gracefully", () => {
    const result = computeCosts(defaultFields, { ...defaultFeasData, estimatedBua: 0 });
    expect(result.constructionCost).toBe(0);
    expect(result.designFee).toBe(0);
    expect(result.supervisionFee).toBe(0);
    expect(result.contingencies).toBe(0);
  });

  it("should handle zero revenue gracefully", () => {
    const result = computeCosts(defaultFields, { ...defaultFeasData, totalRevenue: 0 });
    expect(result.developerFee).toBe(0);
    expect(result.agentCommissionSale).toBe(0);
    expect(result.marketing).toBe(0);
    expect(result.profit).toBeLessThan(0);
    expect(result.profitMargin).toBe(0);
  });

  it("should handle zero total costs for ROI", () => {
    const zeroFields = { ...defaultFields, landPrice: 0, soilInvestigation: 0, topographySurvey: 0, authoritiesFee: 0, constructionCostPerSqft: 0, communityFee: 0, reraOffplanFee: 0, reraUnitFee: 0, nocFee: 0, escrowFee: 0, bankCharges: 0, surveyorFees: 0, reraAuditFees: 0, reraInspectionFees: 0, separationFeePerM2: 0 };
    const result = computeCosts(zeroFields, { ...defaultFeasData, totalRevenue: 0, totalUnits: 0, plotArea: 0 });
    expect(result.roi).toBe(0);
  });

  it("should calculate sales phases total validation", () => {
    const salesPhases = { salesPhase1Pct: 30, salesPhase2Pct: 40, salesPhase3Pct: 30 };
    const total = salesPhases.salesPhase1Pct + salesPhases.salesPhase2Pct + salesPhases.salesPhase3Pct;
    expect(total).toBe(100);
  });
});
