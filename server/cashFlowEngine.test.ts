import { describe, it, expect } from 'vitest';
import {
  buildPhaseTimeline,
  generateMonthLabels,
  calculateDualCashFlow,
  type ProjectInput,
  type CostItemInput,
} from './routers/cashFlowEngine';

// ─── Phase Timeline Tests ───

describe('buildPhaseTimeline', () => {
  it('should build correct 3-phase timeline (6+16+2)', () => {
    const phases = buildPhaseTimeline(6, 16, 2);
    expect(phases.preDev).toEqual({ start: 1, end: 6, months: 6 });
    expect(phases.construction).toEqual({ start: 7, end: 22, months: 16 });
    expect(phases.handover).toEqual({ start: 23, end: 24, months: 2 });
    expect(phases.totalMonths).toBe(24);
  });

  it('should handle different durations (8+12+4)', () => {
    const phases = buildPhaseTimeline(8, 12, 4);
    expect(phases.preDev).toEqual({ start: 1, end: 8, months: 8 });
    expect(phases.construction).toEqual({ start: 9, end: 20, months: 12 });
    expect(phases.handover).toEqual({ start: 21, end: 24, months: 4 });
    expect(phases.totalMonths).toBe(24);
  });

  it('should handle minimum durations (1+1+1)', () => {
    const phases = buildPhaseTimeline(1, 1, 1);
    expect(phases.totalMonths).toBe(3);
    expect(phases.preDev.start).toBe(1);
    expect(phases.construction.start).toBe(2);
    expect(phases.handover.start).toBe(3);
  });
});

// ─── Month Labels Tests ───

describe('generateMonthLabels', () => {
  it('should generate correct month labels starting from Jan 2026', () => {
    const labels = generateMonthLabels('2026-01', 3);
    expect(labels).toEqual(['Jan-26', 'Feb-26', 'Mar-26']);
  });

  it('should handle year rollover', () => {
    const labels = generateMonthLabels('2026-11', 4);
    expect(labels).toEqual(['Nov-26', 'Dec-26', 'Jan-27', 'Feb-27']);
  });

  it('should generate correct count', () => {
    const labels = generateMonthLabels('2026-06', 24);
    expect(labels.length).toBe(24);
    expect(labels[0]).toBe('Jun-26');
    expect(labels[23]).toBe('May-28');
  });
});

// ─── Dual Cash Flow Engine Tests ───

describe('calculateDualCashFlow', () => {
  const baseProject: ProjectInput = {
    startDate: '2026-01',
    preDevMonths: 6,
    constructionMonths: 16,
    handoverMonths: 2,
    salesEnabled: true,
    salesStartMonth: 8,
    totalSalesRevenue: 97_189_000,
    buyerPlanBookingPct: 20,
    buyerPlanConstructionPct: 30,
    buyerPlanHandoverPct: 50,
    escrowDepositPct: 20,
    contractorAdvancePct: 10,
    liquidityBufferPct: 5,
    constructionCostTotal: 39_427_980,
    buaSqft: 114_284,
    constructionCostPerSqft: 345,
  };

  it('should calculate correct total months', () => {
    const result = calculateDualCashFlow(baseProject, []);
    expect(result.totalMonths).toBe(24);
  });

  it('should calculate correct phases', () => {
    const result = calculateDualCashFlow(baseProject, []);
    expect(result.phases.preDev.months).toBe(6);
    expect(result.phases.construction.months).toBe(16);
    expect(result.phases.handover.months).toBe(2);
  });

  it('should calculate correct funding structure', () => {
    const result = calculateDualCashFlow(baseProject, []);
    // 20% of construction cost
    expect(result.fundingStructure.escrowDeposit).toBe(Math.round(39_427_980 * 0.20));
    // 10% of construction cost
    expect(result.fundingStructure.contractorAdvance).toBe(Math.round(39_427_980 * 0.10));
    // 5% of construction cost
    expect(result.fundingStructure.liquidityBuffer).toBe(Math.round(39_427_980 * 0.05));
    // 35% total
    expect(result.fundingStructure.totalDeveloperConstruction).toBe(Math.round(39_427_980 * 0.35));
    // 65% from escrow
    expect(result.fundingStructure.escrowConstruction).toBe(Math.round(39_427_980 * 0.65));
  });

  it('should calculate construction cost from BUA when total not provided', () => {
    const projectNoCost = { ...baseProject, constructionCostTotal: null };
    const result = calculateDualCashFlow(projectNoCost, []);
    expect(result.constructionCost).toBe(Math.round(114_284 * 345));
  });

  it('should distribute developer cost items correctly', () => {
    const items: CostItemInput[] = [
      {
        id: 1,
        name: 'سعر الأرض',
        category: 'land',
        totalAmount: 18_000_000,
        paymentType: 'lump_sum',
        paymentParams: { paymentMonth: 1 },
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // Land cost should appear in month 1
    expect(result.monthlyTable[0].developerOutflow).toBe(18_000_000);
    // Should be zero in other months
    expect(result.monthlyTable[1].developerOutflow).toBe(0);
    // Developer costs should equal the land cost
    expect(result.developerCosts).toBe(18_000_000);
  });

  it('should distribute monthly fixed costs across the correct phase', () => {
    const items: CostItemInput[] = [
      {
        id: 2,
        name: 'أتعاب الإشراف',
        category: 'supervision',
        totalAmount: 241_496,
        paymentType: 'monthly_fixed',
        paymentParams: {},
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'construction',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // Should be zero during pre-dev (months 1-6)
    for (let i = 0; i < 6; i++) {
      expect(result.monthlyTable[i].developerOutflow).toBe(0);
    }
    // Should be distributed during construction (months 7-22)
    const monthlyAmount = Math.round(241_496 / 16);
    expect(result.monthlyTable[6].developerOutflow).toBeGreaterThan(0);
    expect(result.monthlyTable[6].developerOutflow).toBeCloseTo(monthlyAmount, -2);
  });

  it('should handle escrow cost items separately', () => {
    const items: CostItemInput[] = [
      {
        id: 3,
        name: 'دفعات المقاول من الإسكرو',
        category: 'contractor',
        totalAmount: 25_628_187,
        paymentType: 'progress_based',
        paymentParams: {},
        fundingSource: 'escrow',
        escrowEligible: true,
        phaseTag: 'construction',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // Escrow costs should be non-zero during construction
    expect(result.escrowCosts).toBe(25_628_187);
    // Developer costs should be zero
    expect(result.developerCosts).toBe(0);
  });

  it('should calculate sales inflow when enabled', () => {
    const result = calculateDualCashFlow(baseProject, []);
    // Sales start at month 8, so months 1-7 should have zero inflow
    for (let i = 0; i < 7; i++) {
      expect(result.monthlyTable[i].escrowInflow).toBe(0);
    }
    // Month 8 onwards should have some inflow
    const totalInflow = result.monthlyTable.reduce((s, r) => s + r.escrowInflow, 0);
    expect(totalInflow).toBeGreaterThan(0);
  });

  it('should have zero sales inflow when sales disabled', () => {
    const noSales = { ...baseProject, salesEnabled: false };
    const result = calculateDualCashFlow(noSales, []);
    const totalInflow = result.monthlyTable.reduce((s, r) => s + r.escrowInflow, 0);
    expect(totalInflow).toBe(0);
  });

  it('should calculate developer max exposure correctly', () => {
    const items: CostItemInput[] = [
      {
        id: 1,
        name: 'سعر الأرض',
        category: 'land',
        totalAmount: 18_000_000,
        paymentType: 'lump_sum',
        paymentParams: { paymentMonth: 1 },
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'pre_dev',
      },
      {
        id: 2,
        name: 'أتعاب التصميم',
        category: 'design_engineering',
        totalAmount: 275_996,
        paymentType: 'monthly_fixed',
        paymentParams: {},
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // Max exposure should be at least the land cost
    expect(result.developerMaxExposure).toBeGreaterThanOrEqual(18_000_000);
    // Max exposure should be the cumulative of all developer costs
    expect(result.developerMaxExposure).toBe(18_000_000 + 275_996);
  });

  it('should calculate ROI correctly', () => {
    const items: CostItemInput[] = [
      {
        id: 1,
        name: 'تكلفة',
        category: 'land',
        totalAmount: 10_000_000,
        paymentType: 'lump_sum',
        paymentParams: { paymentMonth: 1 },
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // ROI = (revenue - cost) / cost * 100
    const expectedROI = ((97_189_000 - 10_000_000) / 10_000_000) * 100;
    expect(result.roi).toBeCloseTo(expectedROI, 0);
  });

  it('should generate correct month labels count', () => {
    const result = calculateDualCashFlow(baseProject, []);
    expect(result.monthLabels.length).toBe(24);
    expect(result.monthlyTable.length).toBe(24);
  });

  it('should assign correct phase to each monthly row', () => {
    const result = calculateDualCashFlow(baseProject, []);
    // Months 1-6 = pre_dev
    for (let i = 0; i < 6; i++) {
      expect(result.monthlyTable[i].phase).toBe('pre_dev');
    }
    // Months 7-22 = construction
    for (let i = 6; i < 22; i++) {
      expect(result.monthlyTable[i].phase).toBe('construction');
    }
    // Months 23-24 = handover
    for (let i = 22; i < 24; i++) {
      expect(result.monthlyTable[i].phase).toBe('handover');
    }
  });

  it('should handle milestone payment type', () => {
    const items: CostItemInput[] = [
      {
        id: 1,
        name: 'أتعاب التصميم',
        category: 'design_engineering',
        totalAmount: 275_996,
        paymentType: 'milestone',
        paymentParams: {
          milestones: [
            { monthOffset: 1, percent: 20 },
            { monthOffset: 3, percent: 30 },
            { monthOffset: 5, percent: 30 },
            { monthOffset: 6, percent: 20 },
          ],
        },
        fundingSource: 'developer',
        escrowEligible: false,
        phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    // Month 1: 20% of 275,996
    expect(result.monthlyTable[0].developerOutflow).toBeCloseTo(275_996 * 0.20, -1);
    // Month 3: 30% of 275,996
    expect(result.monthlyTable[2].developerOutflow).toBeCloseTo(275_996 * 0.30, -1);
    // Month 2: 0
    expect(result.monthlyTable[1].developerOutflow).toBe(0);
  });

  it('should track cost by category', () => {
    const items: CostItemInput[] = [
      {
        id: 1, name: 'أرض', category: 'land', totalAmount: 18_000_000,
        paymentType: 'lump_sum', paymentParams: { paymentMonth: 1 },
        fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev',
      },
      {
        id: 2, name: 'تصميم', category: 'design_engineering', totalAmount: 275_996,
        paymentType: 'monthly_fixed', paymentParams: {},
        fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    expect(result.costByCategory['land']).toBe(18_000_000);
    expect(result.costByCategory['design_engineering']).toBe(275_996);
  });

  it('should handle empty cost items', () => {
    const result = calculateDualCashFlow(baseProject, []);
    expect(result.developerCosts).toBe(0);
    expect(result.escrowCosts).toBe(0);
    expect(result.totalProjectCost).toBe(0);
    expect(result.developerMaxExposure).toBe(0);
  });

  it('should calculate cumulative values correctly', () => {
    const items: CostItemInput[] = [
      {
        id: 1, name: 'دفعة 1', category: 'land', totalAmount: 1_000_000,
        paymentType: 'lump_sum', paymentParams: { paymentMonth: 1 },
        fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev',
      },
      {
        id: 2, name: 'دفعة 2', category: 'land', totalAmount: 2_000_000,
        paymentType: 'lump_sum', paymentParams: { paymentMonth: 3 },
        fundingSource: 'developer', escrowEligible: false, phaseTag: 'pre_dev',
      },
    ];
    const result = calculateDualCashFlow(baseProject, items);
    expect(result.monthlyTable[0].developerCumulative).toBe(1_000_000);
    expect(result.monthlyTable[1].developerCumulative).toBe(1_000_000);
    expect(result.monthlyTable[2].developerCumulative).toBe(3_000_000);
  });
});
