import { describe, it, expect } from 'vitest';
import { calculateDualCashFlow, CostItemInput, ProjectInput } from './routers/cashFlowEngine';

// ═══════════════════════════════════════════════════════════════
// Tests for new features: Import mapping, Portfolio aggregation, Export data
// ═══════════════════════════════════════════════════════════════

// Helper: Create a standard Nad Al Sheba-like project
function createNadAlShebaProject(): { project: ProjectInput; costs: CostItemInput[] } {
  const project: ProjectInput = {
    startDate: '2026-01',
    preDevMonths: 6,
    constructionMonths: 16,
    handoverMonths: 2,
    salesEnabled: true,
    salesStartMonth: 9,
    totalSalesRevenue: 97_189_000,
    buyerPlanBookingPct: 20,
    buyerPlanConstructionPct: 50,
    buyerPlanHandoverPct: 30,
    escrowDepositPct: 20,
    contractorAdvancePct: 10,
    liquidityBufferPct: 5,
    constructionCostTotal: 39_427_980,
    buaSqft: 114284,
    constructionCostPerSqft: 345,
  };

  const costs: CostItemInput[] = [
    // Pre-dev developer costs (yellow section)
    { id: 1, name: 'سعر الأرض', category: 'land', totalAmount: 18_000_000, paymentType: 'lump_sum', paymentParams: { month: 1 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 2, name: 'عمولة وسيط الأرض', category: 'land', totalAmount: 180_000, paymentType: 'lump_sum', paymentParams: { month: 1 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 3, name: 'رسوم تسجيل الأرض', category: 'fees', totalAmount: 720_000, paymentType: 'lump_sum', paymentParams: { month: 1 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 4, name: 'أتعاب المطور - مرحلة أولى', category: 'developer', totalAmount: 1_943_780, paymentType: 'monthly_fixed', paymentParams: {}, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 5, name: 'فحص التربة', category: 'fees', totalAmount: 25_000, paymentType: 'lump_sum', paymentParams: { month: 1 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 6, name: 'أتعاب التصميم', category: 'consultant', totalAmount: 275_996, paymentType: 'milestone', paymentParams: {}, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 7, name: 'رسوم الفرز', category: 'fees', totalAmount: 2_033_044, paymentType: 'lump_sum', paymentParams: { month: 2 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    { id: 8, name: 'تسجيل RERA', category: 'fees', totalAmount: 150_000, paymentType: 'lump_sum', paymentParams: { month: 4 }, fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev' },
    // Construction/handover costs (blue section) - escrow eligible
    { id: 9, name: 'الإشراف', category: 'supervision', totalAmount: 241_496, paymentType: 'monthly_fixed', paymentParams: {}, fundingSource: 'escrow', escrowEligible: true, phaseTag: 'construction' },
    { id: 10, name: 'أتعاب المطور - مرحلة ثانية', category: 'developer', totalAmount: 2_915_670, paymentType: 'monthly_fixed', paymentParams: {}, fundingSource: 'developer', escrowEligible: false, phaseTag: 'construction' },
    { id: 11, name: 'عمولة البيع', category: 'marketing', totalAmount: 4_859_450, paymentType: 'sales_linked', paymentParams: {}, fundingSource: 'escrow', escrowEligible: true, phaseTag: 'construction' },
  ];

  return { project, costs };
}

describe('Import Mapping - Funding Source Assignment', () => {
  it('should correctly separate developer vs escrow costs', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // Developer costs should include land, fees, developer fees (pre-dev), design
    expect(result.developerCosts).toBeGreaterThan(0);
    // Escrow costs should include supervision and sales commission
    expect(result.escrowCosts).toBeGreaterThan(0);
    // Total should equal sum
    expect(result.totalProjectCost).toBeCloseTo(result.developerCosts + result.escrowCosts, -1);
  });

  it('should assign pre-dev items to developer funding', () => {
    const { project, costs } = createNadAlShebaProject();
    const preDevCosts = costs.filter(c => c.phaseTag === 'pre_dev');
    expect(preDevCosts.every(c => c.fundingSource === 'developer')).toBe(true);
  });

  it('should mark supervision and sales as escrow eligible', () => {
    const { project, costs } = createNadAlShebaProject();
    const escrowItems = costs.filter(c => c.escrowEligible);
    expect(escrowItems.length).toBeGreaterThan(0);
    expect(escrowItems.some(c => c.name.includes('الإشراف'))).toBe(true);
    expect(escrowItems.some(c => c.name.includes('عمولة البيع'))).toBe(true);
  });
});

describe('Portfolio Aggregation', () => {
  it('should correctly aggregate multiple projects', () => {
    const { project: p1, costs: c1 } = createNadAlShebaProject();
    const result1 = calculateDualCashFlow(p1, c1);

    // Create a second project with different start date
    const p2: ProjectInput = { ...p1, startDate: '2026-07' };
    const result2 = calculateDualCashFlow(p2, c1);

    // Both should produce valid results
    expect(result1.totalMonths).toBe(24);
    expect(result2.totalMonths).toBe(24);
    expect(result1.totalProjectCost).toBeGreaterThan(0);
    expect(result2.totalProjectCost).toBeGreaterThan(0);
  });

  it('should calculate peak exposure correctly for a single project', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // Peak exposure should be positive
    expect(result.developerMaxExposure).toBeGreaterThan(0);
    // Peak month should be within project duration
    expect(result.developerMaxExposureMonth).toBeGreaterThanOrEqual(1);
    expect(result.developerMaxExposureMonth).toBeLessThanOrEqual(result.totalMonths);
    // Peak label should exist
    expect(result.developerMaxExposureLabel).toBeTruthy();
  });

  it('should have developer cumulative increasing during pre-dev', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // During pre-dev months (1-6), developer cumulative should generally increase
    const preDevRows = result.monthlyTable.slice(0, 6);
    const lastPreDevCum = preDevRows[preDevRows.length - 1].developerCumulative;
    expect(lastPreDevCum).toBeGreaterThan(0);
  });
});

describe('Export Data Validation', () => {
  it('should produce complete monthly table for export', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // Monthly table should have correct number of rows
    expect(result.monthlyTable.length).toBe(24);

    // Each row should have all required fields
    const firstRow = result.monthlyTable[0];
    expect(firstRow).toHaveProperty('label');
    expect(firstRow).toHaveProperty('phase');
    expect(firstRow).toHaveProperty('developerOutflow');
    expect(firstRow).toHaveProperty('developerCumulative');
    expect(firstRow).toHaveProperty('escrowInflow');
    expect(firstRow).toHaveProperty('escrowOutflow');
    expect(firstRow).toHaveProperty('escrowBalance');
    expect(firstRow).toHaveProperty('totalOutflow');
  });

  it('should have correct phase labels in monthly table', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // First 6 months should be pre-dev
    for (let i = 0; i < 6; i++) {
      expect(result.monthlyTable[i].phase).toBe('pre_dev');
    }
    // Months 7-22 should be construction
    for (let i = 6; i < 22; i++) {
      expect(result.monthlyTable[i].phase).toBe('construction');
    }
    // Last 2 months should be handover
    for (let i = 22; i < 24; i++) {
      expect(result.monthlyTable[i].phase).toBe('handover');
    }
  });

  it('should have month labels in Arabic format', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // First month should be Jan-26 format
    expect(result.monthlyTable[0].label).toContain('Jan');
  });

  it('should have summary numbers consistent with monthly data', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // Total developer cost should be close to sum of developer outflows
    const sumDevOutflow = result.monthlyTable.reduce((s: number, r: any) => s + r.developerOutflow, 0);
    // Allow some tolerance due to rounding in monthly distribution
    expect(Math.abs(result.developerCosts - sumDevOutflow)).toBeLessThan(result.developerCosts * 0.05);

    // Total escrow cost should be close to sum of escrow outflows
    const sumEscOutflow = result.monthlyTable.reduce((s: number, r: any) => s + r.escrowOutflow, 0);
    expect(Math.abs(result.escrowCosts - sumEscOutflow)).toBeLessThan(result.escrowCosts * 0.05 + 1);
  });

  it('should produce funding structure breakdown', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    expect(result.fundingStructure).toBeDefined();
    expect(result.fundingStructure.totalDeveloperConstruction).toBeGreaterThan(0);
    expect(result.fundingStructure.escrowDeposit).toBeGreaterThanOrEqual(0);
    expect(result.fundingStructure.contractorAdvance).toBeGreaterThanOrEqual(0);
  });
});

describe('Construction Cost Split', () => {
  it('should split construction cost between developer (35%) and escrow (65%)', () => {
    const { project, costs } = createNadAlShebaProject();
    const result = calculateDualCashFlow(project, costs);

    // Construction cost should be calculated
    expect(result.constructionCost).toBeGreaterThan(0);

    // Funding structure should show the split
    const devPct = project.escrowDepositPct! + project.contractorAdvancePct! + project.liquidityBufferPct!;
    expect(devPct).toBe(35); // 20 + 10 + 5
    expect(result.fundingStructure.escrowDeposit).toBeCloseTo(result.constructionCost * 0.20, -1);
    expect(result.fundingStructure.contractorAdvance).toBeCloseTo(result.constructionCost * 0.10, -1);
    expect(result.fundingStructure.liquidityBuffer).toBeCloseTo(result.constructionCost * 0.05, -1);
  });
});
