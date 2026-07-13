/**
 * Financial Engine v2 — اختبارات شاملة بأرقام حقيقية
 * 
 * مشروع مرجعي: ند الشبا — قطعة 1 (6185392)
 * - سعر الأرض: 18,000,000 درهم
 * - BUA: 87,617 قدم²
 * - تكلفة الإنشاء: 450 درهم/قدم²
 * - إيرادات معتمدة: 93,765,000 درهم
 */

import { describe, it, expect } from "vitest";
import {
  calculateTimeline,
  calculateCosts,
  computeFullFinancials,
  distributeDesignFee,
  distributeContractorPayments,
  distributeDeveloperFee,
  calculateEscrowRevenue,
  calculateSettlement,
  aggregateMonthly,
  projectToInputs,
  DESIGN_MILESTONES,
  DEFAULT_ABSORPTION,
  type ProjectInputs,
  type FinancingScenario,
} from "./financialEngine";

// ═══════════════════════════════════════════════════════════════
// بيانات مشروع حقيقي (ند الشبا — قطعة 1)
// ═══════════════════════════════════════════════════════════════

const NAD_AL_SHEBA_INPUTS: ProjectInputs = {
  landPrice: 18000000,
  agentCommissionLandPct: 1,
  buaSqft: 87617,
  constructionPricePerSqft: 450,
  gfaResidentialSqft: 50826,
  gfaRetailSqft: 0,
  gfaOfficesSqft: 0,
  saleableResidentialPct: 95,
  saleableRetailPct: 97,
  saleableOfficesPct: 95,
  soilTestFee: 25000,
  topographicSurveyFee: 8000,
  officialBodiesFees: 1000000,
  reraProjectRegFee: 150000,
  developerNocFee: 22000,
  escrowAccountFee: 140000,
  bankFees: 20000,
  surveyorFees: 24000,
  reraAuditReportFee: 18000,
  reraUnitFeePerUnit: 800,
  totalUnits: 49,
  communityFeeRate: 1,
  reraInspectionFeePerVisit: 15000,
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
  approvedRevenue: 93765000,
  startDate: "2026-04",
};

// ═══════════════════════════════════════════════════════════════
// اختبارات المراحل الزمنية
// ═══════════════════════════════════════════════════════════════

describe("calculateTimeline", () => {
  it("should calculate correct phase boundaries for standard project", () => {
    const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);

    expect(timeline.designStart).toBe(1);
    expect(timeline.designEnd).toBe(6);
    expect(timeline.offplanStart).toBe(3); // بعد شهرين من التصاميم
    expect(timeline.offplanEnd).toBe(4);
    expect(timeline.constructionStart).toBe(7);
    expect(timeline.constructionEnd).toBe(22);
    expect(timeline.handoverStart).toBe(23);
    expect(timeline.handoverEnd).toBe(24);
    expect(timeline.totalMonths).toBe(24); // 6 + 16 + 2
  });

  it("should handle different durations", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, designMonths: 8, constructionMonths: 20, handoverMonths: 3 };
    const timeline = calculateTimeline(inputs);

    expect(timeline.designEnd).toBe(8);
    expect(timeline.constructionStart).toBe(9);
    expect(timeline.constructionEnd).toBe(28);
    expect(timeline.handoverStart).toBe(29);
    expect(timeline.handoverEnd).toBe(31);
    expect(timeline.totalMonths).toBe(31); // 8 + 20 + 3
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات حساب التكاليف
// ═══════════════════════════════════════════════════════════════

describe("calculateCosts", () => {
  it("should calculate construction cost correctly", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    // 87,617 × 450 = 39,427,650
    expect(costs.constructionCost).toBeCloseTo(87617 * 450, 0);
  });

  it("should calculate land-related costs correctly", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.landPrice).toBe(18000000);
    expect(costs.agentCommissionLand).toBe(180000); // 18M × 1%
    expect(costs.landRegistration).toBe(720000); // 18M × 4%
  });

  it("should calculate design fee as percentage of construction cost", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    const expectedDesignFee = 87617 * 450 * 0.02;
    expect(costs.designFee).toBeCloseTo(expectedDesignFee, 0);
  });

  it("should calculate design fee as lump sum when method is lump_sum", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, designFeeMethod: "lump_sum" as const, designFeeLumpSum: 500000 };
    const costs = calculateCosts(inputs);
    expect(costs.designFee).toBe(500000);
  });

  it("should calculate design fee as monthly rate when method is monthly_rate", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, designFeeMethod: "monthly_rate" as const, designFeeMonthlyRate: 80000 };
    const costs = calculateCosts(inputs);
    expect(costs.designFee).toBe(80000 * 6); // 80K × 6 months
  });

  it("should calculate revenue-linked costs correctly", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.developerFee).toBe(93765000 * 0.05); // 5%
    expect(costs.salesCommission).toBe(93765000 * 0.05); // 5%
    expect(costs.marketingCost).toBe(93765000 * 0.02); // 2%
  });

  it("should use approved revenue when available", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.totalRevenue).toBe(93765000);
  });

  it("should fall back to calculated revenue when no approved revenue", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, approvedRevenue: undefined, calculatedRevenue: 85000000 };
    const costs = calculateCosts(inputs);
    expect(costs.totalRevenue).toBe(85000000);
  });

  it("should calculate RERA unit registration fee from units × 800", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.reraUnitRegFee).toBe(49 * 800); // 39,200
  });

  it("should calculate community fees from GFA × rate", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.communityFees).toBe(50826 * 1); // GFA × 1 AED/sqft
  });

  it("should calculate inspection report fee from visits × 15000", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    // 16 months / 3 = 5 visits + 1 after completion = 6
    const expectedVisits = Math.floor(16 / 3) + 1; // = 6
    expect(costs.reraInspectionReportFee).toBe(expectedVisits * 15000);
  });

  it("should calculate contingencies as 2% of construction cost", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.contingencies).toBeCloseTo(87617 * 450 * 0.02, 0);
  });

  it("should calculate gross profit correctly", () => {
    const costs = calculateCosts(NAD_AL_SHEBA_INPUTS);
    expect(costs.grossProfit).toBeCloseTo(costs.totalRevenue - costs.totalCosts, 0);
  });

  it("should reduce developer fee to 3% for O3 scenario", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, financingScenario: "no_offplan" as FinancingScenario };
    const costs = calculateCosts(inputs);
    expect(costs.developerFee).toBe(93765000 * 0.03); // 3% not 5%
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات توزيع أتعاب التصميم (Milestones)
// ═══════════════════════════════════════════════════════════════

describe("distributeDesignFee", () => {
  it("should distribute design fee across 5 milestones", () => {
    const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);
    const designFee = 788553; // 2% of construction cost
    const monthly = distributeDesignFee(designFee, timeline);

    expect(monthly.length).toBe(5);
    // 20% + 20% + 25% + 20% + 15% = 100%
    const total = monthly.reduce((s, m) => s + m.amount, 0);
    expect(total).toBeCloseTo(designFee, 0);
  });

  it("should place milestones at correct months", () => {
    const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);
    const monthly = distributeDesignFee(1000000, timeline);

    expect(monthly[0].month).toBe(1); // شهر 1
    expect(monthly[1].month).toBe(2); // شهر 2
    expect(monthly[2].month).toBe(4); // شهر 4
    expect(monthly[3].month).toBe(5); // شهر 5
    expect(monthly[4].month).toBe(6); // شهر 6
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات دفعات المقاول
// ═══════════════════════════════════════════════════════════════

describe("distributeContractorPayments", () => {
  const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);
  const constructionCost = 87617 * 450;

  it("should include 10% mobilization from investor in all scenarios", () => {
    for (const scenario of ["offplan_escrow", "offplan_construction", "no_offplan"] as FinancingScenario[]) {
      const result = distributeContractorPayments(constructionCost, timeline, scenario);
      const mobilization = result.investor.find(i => i.month === timeline.constructionStart);
      expect(mobilization).toBeDefined();
      expect(mobilization!.amount).toBeCloseTo(constructionCost * 0.10, 0);
    }
  });

  it("should include 20% escrow deposit for O1", () => {
    const result = distributeContractorPayments(constructionCost, timeline, "offplan_escrow");
    const deposit = result.investor.find(i => i.month === timeline.offplanStart + 1);
    expect(deposit).toBeDefined();
    expect(deposit!.amount).toBeCloseTo(constructionCost * 0.20, 0);
  });

  it("should split 20% into 3 months for O2", () => {
    const result = distributeContractorPayments(constructionCost, timeline, "offplan_construction");
    const o2Payments = result.investor.filter(i =>
      i.month >= timeline.constructionStart && i.month <= timeline.constructionStart + 2
      && i.amount < constructionCost * 0.15 // exclude mobilization
    );
    // mobilization is at constructionStart too, so filter by amount
    const perMonth = constructionCost * 0.20 / 3;
    const matchingPayments = result.investor.filter(i => Math.abs(i.amount - perMonth) < 1);
    expect(matchingPayments.length).toBe(3);
  });

  it("should have no 20% deposit or split for O3", () => {
    const result = distributeContractorPayments(constructionCost, timeline, "no_offplan");
    // Only mobilization (10%) should be in investor
    expect(result.investor.length).toBe(1);
    expect(result.investor[0].amount).toBeCloseTo(constructionCost * 0.10, 0);
  });

  it("should distribute 80% via S-Curve in escrow", () => {
    const result = distributeContractorPayments(constructionCost, timeline, "offplan_escrow");
    // S-Curve items (excluding completion and retention)
    const sCurveItems = result.escrow.filter(i =>
      i.month >= timeline.constructionStart && i.month <= timeline.constructionEnd
    );
    const sCurveTotal = sCurveItems.reduce((s, i) => s + i.amount, 0);
    expect(sCurveTotal).toBeCloseTo(constructionCost * 0.80, 0);
  });

  it("should include 5% completion and 5% retention", () => {
    const result = distributeContractorPayments(constructionCost, timeline, "offplan_escrow");
    const completion = result.escrow.find(i => i.month === timeline.handoverStart);
    const retention = result.escrow.find(i => i.month === timeline.handoverEnd + 12);
    expect(completion).toBeDefined();
    expect(completion!.amount).toBeCloseTo(constructionCost * 0.05, 0);
    expect(retention).toBeDefined();
    expect(retention!.amount).toBeCloseTo(constructionCost * 0.05, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات أتعاب المطور
// ═══════════════════════════════════════════════════════════════

describe("distributeDeveloperFee", () => {
  const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);
  const developerFee = 93765000 * 0.05; // 4,688,250

  it("should distribute 20/20/60 for O1", () => {
    const monthly = distributeDeveloperFee(developerFee, timeline, "offplan_escrow");
    // Note: offplan (months 3-4) overlaps with design (months 1-6)
    // So we count items by their generation order: first 6 are design, next 2 are offplan, rest are construction
    const designItems = monthly.slice(0, 6); // 6 design months
    const offplanItems = monthly.slice(6, 8); // 2 offplan months
    const constructionItems = monthly.slice(8); // 16 construction months

    const designTotal = designItems.reduce((s, m) => s + m.amount, 0);
    const offplanTotal = offplanItems.reduce((s, m) => s + m.amount, 0);
    const constructionTotal = constructionItems.reduce((s, m) => s + m.amount, 0);

    expect(designTotal).toBeCloseTo(developerFee * 0.20, 0);
    expect(offplanTotal).toBeCloseTo(developerFee * 0.20, 0);
    expect(constructionTotal).toBeCloseTo(developerFee * 0.60, 0);
  });

  it("should distribute 40/60 for O3", () => {
    const devFeeO3 = 93765000 * 0.03; // 3% for O3
    const monthly = distributeDeveloperFee(devFeeO3, timeline, "no_offplan");
    const designTotal = monthly
      .filter(m => m.month >= timeline.designStart && m.month <= timeline.designEnd)
      .reduce((s, m) => s + m.amount, 0);
    const constructionTotal = monthly
      .filter(m => m.month >= timeline.constructionStart && m.month <= timeline.constructionEnd)
      .reduce((s, m) => s + m.amount, 0);

    expect(designTotal).toBeCloseTo(devFeeO3 * 0.40, 0);
    expect(constructionTotal).toBeCloseTo(devFeeO3 * 0.60, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات إيرادات الضمان
// ═══════════════════════════════════════════════════════════════

describe("calculateEscrowRevenue", () => {
  const timeline = calculateTimeline(NAD_AL_SHEBA_INPUTS);
  const totalRevenue = 93765000;

  it("should deposit 100% of revenue eventually", () => {
    const result = calculateEscrowRevenue(totalRevenue, timeline);
    expect(result.totalDeposited).toBeCloseTo(totalRevenue, 0);
  });

  it("should have booking payments (10%) in sale months", () => {
    const result = calculateEscrowRevenue(totalRevenue, timeline);
    // First sale month = constructionStart + 0 = 7
    const firstMonthRevenue = result.monthly.find(m => m.month === 7);
    expect(firstMonthRevenue).toBeDefined();
    // 5% of revenue × 10% booking = 0.5% of total
    expect(firstMonthRevenue!.amount).toBeGreaterThan(0);
  });

  it("should have handover payments (40%) concentrated at handover", () => {
    const result = calculateEscrowRevenue(totalRevenue, timeline);
    const handoverPayments = result.monthly.filter(m => m.month === timeline.handoverStart);
    const handoverTotal = handoverPayments.reduce((s, m) => s + m.amount, 0);
    // 80% of revenue × 40% = 32% of total should be at handover
    expect(handoverTotal).toBeCloseTo(totalRevenue * 0.80 * 0.40, -3); // within 1000
  });

  it("should have post-handover cash (20%) after handover", () => {
    const result = calculateEscrowRevenue(totalRevenue, timeline);
    const postHandover = result.monthly.find(m => m.month === timeline.handoverEnd + 1);
    expect(postHandover).toBeDefined();
    expect(postHandover!.amount).toBeCloseTo(totalRevenue * 0.20, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات التسوية
// ═══════════════════════════════════════════════════════════════

describe("calculateSettlement", () => {
  it("should retain 5% of total deposited", () => {
    const escrowRevenue = { monthly: [], totalDeposited: 93765000 };
    const escrowExpenses = [
      { id: "test", name: "test", total: 30000000, table: "escrow" as const, monthly: [] },
    ];
    const settlement = calculateSettlement(escrowRevenue, escrowExpenses);

    expect(settlement.retentionAmount).toBeCloseTo(93765000 * 0.05, 0);
    expect(settlement.netSurplus).toBe(93765000 - 30000000);
    expect(settlement.releasedAtHandover).toBeCloseTo(
      (93765000 - 30000000) - (93765000 * 0.05), 0
    );
    expect(settlement.releasedAfter12Months).toBeCloseTo(93765000 * 0.05, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات التدفق الكامل
// ═══════════════════════════════════════════════════════════════

describe("computeFullFinancials", () => {
  it("should produce a complete result for O1 scenario", () => {
    const result = computeFullFinancials(NAD_AL_SHEBA_INPUTS);

    expect(result.costs.totalRevenue).toBe(93765000);
    expect(result.costs.constructionCost).toBeCloseTo(87617 * 450, 0);
    expect(result.timeline.totalMonths).toBe(24);
    expect(result.investorCashFlow.length).toBeGreaterThan(5);
    expect(result.escrowCashFlow.length).toBeGreaterThan(3);
    expect(result.capitalRequired).toBeGreaterThan(0);
    expect(result.settlement.totalDeposited).toBeCloseTo(93765000, 0);
  });

  it("should produce no escrow items for O3 scenario", () => {
    const inputs = { ...NAD_AL_SHEBA_INPUTS, financingScenario: "no_offplan" as FinancingScenario };
    const result = computeFullFinancials(inputs);

    expect(result.escrowCashFlow.length).toBe(0);
    expect(result.escrowRevenue.totalDeposited).toBe(0);
  });

  it("should have investor total matching sum of all items", () => {
    const result = computeFullFinancials(NAD_AL_SHEBA_INPUTS);
    const sumFromItems = result.investorCashFlow.reduce((s, item) => s + item.total, 0);
    expect(result.capitalRequired).toBeCloseTo(sumFromItems, 0);
  });

  it("should change output when input changes (auto-propagation)", () => {
    const result1 = computeFullFinancials(NAD_AL_SHEBA_INPUTS);
    const result2 = computeFullFinancials({
      ...NAD_AL_SHEBA_INPUTS,
      constructionPricePerSqft: 500, // زيادة سعر الإنشاء
    });

    expect(result2.costs.constructionCost).toBeGreaterThan(result1.costs.constructionCost);
    expect(result2.costs.designFee).toBeGreaterThan(result1.costs.designFee);
    expect(result2.costs.contingencies).toBeGreaterThan(result1.costs.contingencies);
    expect(result2.capitalRequired).toBeGreaterThan(result1.capitalRequired);
  });

  it("should change developer fee when revenue changes", () => {
    const result1 = computeFullFinancials(NAD_AL_SHEBA_INPUTS);
    const result2 = computeFullFinancials({
      ...NAD_AL_SHEBA_INPUTS,
      approvedRevenue: 120000000, // زيادة الإيرادات
    });

    expect(result2.costs.developerFee).toBeGreaterThan(result1.costs.developerFee);
    expect(result2.costs.salesCommission).toBeGreaterThan(result1.costs.salesCommission);
    expect(result2.costs.marketingCost).toBeGreaterThan(result1.costs.marketingCost);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات محوّل البيانات
// ═══════════════════════════════════════════════════════════════

describe("projectToInputs", () => {
  it("should convert raw project data to typed inputs", () => {
    const rawProject = {
      landPrice: "18000000",
      agentCommissionLandPct: "1",
      manualBuaSqft: "87617",
      estimatedConstructionPricePerSqft: "450",
      gfaResidentialSqft: "50826",
      gfaRetailSqft: "0",
      gfaOfficesSqft: "0",
      soilTestFee: "25000",
      topographicSurveyFee: "8000",
      officialBodiesFees: "1000000",
      reraProjectRegFee: "150000",
      developerNocFee: "22000",
      escrowAccountFee: "140000",
      bankFees: "20000",
      surveyorFees: "24000",
      reraAuditReportFee: "18000",
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

    const inputs = projectToInputs(rawProject, {}, 49, 93765000);

    expect(inputs.landPrice).toBe(18000000);
    expect(inputs.buaSqft).toBe(87617);
    expect(inputs.totalUnits).toBe(49);
    expect(inputs.financingScenario).toBe("offplan_escrow");
    expect(inputs.designMonths).toBe(6);
  });

  it("should apply overrides when provided", () => {
    const rawProject = {
      landPrice: "18000000",
      designFeePct: "2",
      financingScenario: "offplan_escrow",
      preConMonths: "6",
      constructionMonths: "16",
      handoverMonths: "2",
    };

    const overrides = {
      designFeeMethod: "lump_sum",
      designFeeLumpSum: 500000,
      communityFeeRate: 0.5,
      approvedRevenue: "100000000",
    };

    const inputs = projectToInputs(rawProject, overrides, 49);

    expect(inputs.designFeeMethod).toBe("lump_sum");
    expect(inputs.designFeeLumpSum).toBe(500000);
    expect(inputs.communityFeeRate).toBe(0.5);
    expect(inputs.approvedRevenue).toBe(100000000);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات الدوال المساعدة
// ═══════════════════════════════════════════════════════════════

describe("aggregateMonthly", () => {
  it("should merge amounts for same month", () => {
    const items = [
      { month: 1, amount: 100 },
      { month: 1, amount: 200 },
      { month: 2, amount: 300 },
    ];
    const result = aggregateMonthly(items);
    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ month: 1, amount: 300 });
    expect(result[1]).toEqual({ month: 2, amount: 300 });
  });

  it("should sort by month", () => {
    const items = [
      { month: 5, amount: 100 },
      { month: 1, amount: 200 },
      { month: 3, amount: 300 },
    ];
    const result = aggregateMonthly(items);
    expect(result[0].month).toBe(1);
    expect(result[1].month).toBe(3);
    expect(result[2].month).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات سيناريو O2
// ═══════════════════════════════════════════════════════════════

describe("O2 scenario (offplan_construction)", () => {
  const inputs: ProjectInputs = {
    ...NAD_AL_SHEBA_INPUTS,
    financingScenario: "offplan_construction",
  };

  it("should not have escrow deposit", () => {
    const result = computeFullFinancials(inputs);
    const escrowDeposit = result.investorCashFlow.find(i => i.id === "escrow_deposit");
    expect(escrowDeposit).toBeUndefined();
  });

  it("should have regulatory fees in construction phase (month 3)", () => {
    const result = computeFullFinancials(inputs);
    const reraReg = result.investorCashFlow.find(i => i.id === "rera_registration");
    expect(reraReg).toBeDefined();
    // Should be at constructionStart + 2 (month 3 of construction = absolute month 9)
    expect(reraReg!.monthly[0].month).toBe(result.timeline.constructionStart + 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// اختبارات سيناريو O3
// ═══════════════════════════════════════════════════════════════

describe("O3 scenario (no_offplan)", () => {
  const inputs: ProjectInputs = {
    ...NAD_AL_SHEBA_INPUTS,
    financingScenario: "no_offplan",
  };

  it("should have no RERA/NOC/escrow fees", () => {
    const result = computeFullFinancials(inputs);
    const reraReg = result.investorCashFlow.find(i => i.id === "rera_registration");
    const nocFee = result.investorCashFlow.find(i => i.id === "noc_fee");
    const escrowFee = result.investorCashFlow.find(i => i.id === "escrow_fee");
    expect(reraReg).toBeUndefined();
    expect(nocFee).toBeUndefined();
    expect(escrowFee).toBeUndefined();
  });

  it("should have no marketing", () => {
    const result = computeFullFinancials(inputs);
    const marketing = result.investorCashFlow.find(i => i.id === "marketing");
    expect(marketing).toBeUndefined();
  });

  it("should have developer fee at 3%", () => {
    const result = computeFullFinancials(inputs);
    expect(result.costs.developerFee).toBeCloseTo(93765000 * 0.03, 0);
  });

  it("should have empty escrow cash flow", () => {
    const result = computeFullFinancials(inputs);
    expect(result.escrowCashFlow.length).toBe(0);
  });
});
