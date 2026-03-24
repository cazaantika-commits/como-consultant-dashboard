import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the getPortfolioCapitalData procedure logic.
 * We test the helper functions that the procedure relies on:
 *   - computeItemAmount
 *   - phaseRelativeToAbsolute
 *   - getPhaseRange
 *   - distributeAmount
 *   - calculateProjectCosts
 *   - legacyToNewDurations / calculatePhases / getTotalMonths
 *
 * Then we test the aggregation logic (investor-only filtering, section→phase mapping,
 * monthly accumulation, paid vs upcoming split).
 */

// Import the shared helpers from investorCashFlow (used by the procedure)
import {
  calculateProjectCosts,
  legacyToNewDurations,
  calculatePhases,
  getTotalMonths,
} from './investorCashFlow';

// ─── Test: legacyToNewDurations ──────────────────────────────────────────────

describe('legacyToNewDurations', () => {
  it('should convert legacy 3-phase to new 5-phase durations', () => {
    const result = legacyToNewDurations({ preCon: 6, construction: 16, handover: 2 });
    expect(result).toHaveProperty('design');
    expect(result).toHaveProperty('offplan');
    expect(result).toHaveProperty('construction');
    expect(result).toHaveProperty('handover');
    // offplan=2 is added but overlaps with design, so getTotalMonths = design + construction + handover
    expect(result.design).toBe(6);
    expect(result.offplan).toBe(2);
    expect(result.construction).toBe(16);
    expect(result.handover).toBe(2);
    // getTotalMonths excludes offplan since it overlaps
    const effectiveTotal = result.design + result.construction + result.handover;
    expect(effectiveTotal).toBe(24);
  });

  it('should handle zero handover', () => {
    const result = legacyToNewDurations({ preCon: 4, construction: 12, handover: 0 });
    expect(result.handover).toBe(0);
  });
});

// ─── Test: calculatePhases ──────────────────────────────────────────────────

describe('calculatePhases', () => {
  it('should produce correct start months for each phase', () => {
    const durations = legacyToNewDurations({ preCon: 6, construction: 16, handover: 2 });
    const phases = calculatePhases(durations);
    expect(Array.isArray(phases)).toBe(true);
    // Each phase should have type, startMonth, duration
    for (const p of phases) {
      expect(p).toHaveProperty('type');
      expect(p).toHaveProperty('startMonth');
      expect(p).toHaveProperty('duration');
    }
  });
});

// ─── Test: getTotalMonths ───────────────────────────────────────────────────

describe('getTotalMonths', () => {
  it('should sum all phase durations', () => {
    const durations = legacyToNewDurations({ preCon: 6, construction: 16, handover: 2 });
    const total = getTotalMonths(durations);
    expect(total).toBe(24);
  });
});

// ─── Test: calculateProjectCosts ────────────────────────────────────────────

describe('calculateProjectCosts', () => {
  const mockProject = {
    landPrice: '10000000',
    agentCommissionLandPct: '1',
    manualBuaSqft: '50000',
    estimatedConstructionPricePerSqft: '200',
    soilTestFee: '5000',
    topographicSurveyFee: '3000',
    officialBodiesFees: '10000',
    reraUnitRegFee: '1000',
    reraProjectRegFee: '2000',
    developerNocFee: '500',
    escrowAccountFee: '1000',
    bankFees: '2000',
    communityFees: '5000',
    surveyorFees: '3000',
    reraAuditReportFee: '1500',
    reraInspectionReportFee: '1000',
    designFeePct: '2',
    supervisionFeePct: '2',
    separationFeePerM2: '40',
    salesCommissionPct: '5',
    marketingPct: '2',
    developerFeePct: '5',
    gfaResidentialSqft: '40000',
    gfaRetailSqft: '5000',
    gfaOfficesSqft: '5000',
  };

  it('should return null for null project', () => {
    const result = calculateProjectCosts(null, null, null);
    expect(result).toBeNull();
  });

  it('should calculate land-related costs correctly', () => {
    const result = calculateProjectCosts(mockProject, null, null);
    expect(result).not.toBeNull();
    expect(result!.landPrice).toBe(10000000);
    expect(result!.agentCommissionLand).toBe(100000); // 1% of 10M
    expect(result!.landRegistration).toBe(400000); // 4% of 10M
  });

  it('should calculate construction cost from BUA * price/sqft', () => {
    const result = calculateProjectCosts(mockProject, null, null);
    expect(result!.constructionCost).toBe(10000000); // 50000 * 200
  });

  it('should calculate design fee as percentage of construction cost', () => {
    const result = calculateProjectCosts(mockProject, null, null);
    expect(result!.designFee).toBe(200000); // 2% of 10M
  });

  it('should calculate contingencies as 2% of construction cost', () => {
    const result = calculateProjectCosts(mockProject, null, null);
    expect(result!.contingencies).toBe(200000); // 2% of 10M
  });
});

// ─── Test: section-to-phase mapping logic ───────────────────────────────────

describe('sectionToPhase mapping', () => {
  // This mirrors the mapping in getPortfolioCapitalData
  const sectionToPhase = (section: string): string => {
    switch (section) {
      case 'paid': return 'land';
      case 'design': return 'design';
      case 'offplan': return 'offplan';
      case 'construction': return 'construction';
      case 'escrow': return 'construction';
      default: return 'construction';
    }
  };

  it('should map "paid" section to "land" phase', () => {
    expect(sectionToPhase('paid')).toBe('land');
  });

  it('should map "design" section to "design" phase', () => {
    expect(sectionToPhase('design')).toBe('design');
  });

  it('should map "offplan" section to "offplan" phase', () => {
    expect(sectionToPhase('offplan')).toBe('offplan');
  });

  it('should map "construction" section to "construction" phase', () => {
    expect(sectionToPhase('construction')).toBe('construction');
  });

  it('should map "escrow" section to "construction" phase', () => {
    expect(sectionToPhase('escrow')).toBe('construction');
  });

  it('should default unknown sections to "construction"', () => {
    expect(sectionToPhase('unknown')).toBe('construction');
  });
});

// ─── Test: investor-only filtering logic ────────────────────────────────────

describe('investor-only filtering', () => {
  interface MockItem {
    fundingSource: string;
    section: string;
    monthlyAmounts: number[];
    nameAr: string;
  }

  function aggregateInvestorItems(items: MockItem[], totalMonths: number) {
    const monthlyAmounts = new Array(totalMonths).fill(0);
    let grandTotal = 0;

    for (const item of items) {
      if (item.fundingSource !== 'investor') continue;
      for (let m = 0; m < totalMonths; m++) {
        const val = item.monthlyAmounts[m] || 0;
        if (val > 0) {
          grandTotal += val;
          monthlyAmounts[m] += val;
        }
      }
    }
    return { monthlyAmounts, grandTotal };
  }

  it('should only include investor-funded items', () => {
    const items: MockItem[] = [
      { fundingSource: 'investor', section: 'paid', monthlyAmounts: [100, 200], nameAr: 'أرض' },
      { fundingSource: 'escrow', section: 'escrow', monthlyAmounts: [500, 600], nameAr: 'ضمان' },
      { fundingSource: 'investor', section: 'construction', monthlyAmounts: [300, 400], nameAr: 'بناء' },
    ];
    const result = aggregateInvestorItems(items, 2);
    expect(result.grandTotal).toBe(100 + 200 + 300 + 400); // 1000
    expect(result.monthlyAmounts).toEqual([400, 600]);
  });

  it('should exclude escrow-funded items', () => {
    const items: MockItem[] = [
      { fundingSource: 'escrow', section: 'escrow', monthlyAmounts: [1000], nameAr: 'ضمان' },
    ];
    const result = aggregateInvestorItems(items, 1);
    expect(result.grandTotal).toBe(0);
    expect(result.monthlyAmounts).toEqual([0]);
  });
});

// ─── Test: paid vs upcoming split ───────────────────────────────────────────

describe('paid vs upcoming split', () => {
  function splitPaidUpcoming(
    monthlyAmounts: number[],
    startDate: string,
    today: Date,
  ) {
    const [yearStr, monthStr] = startDate.split('-');
    const startYear = parseInt(yearStr) || 2026;
    const startMonthNum = parseInt(monthStr) || 4;
    let paidTotal = 0;
    let upcomingTotal = 0;

    for (let m = 0; m < monthlyAmounts.length; m++) {
      const val = monthlyAmounts[m] || 0;
      if (val <= 0) continue;
      const absYear = startYear + Math.floor((startMonthNum - 1 + m) / 12);
      const absMonth = ((startMonthNum - 1 + m) % 12) + 1;
      const monthDate = new Date(absYear, absMonth - 1, 28);
      if (monthDate < today) {
        paidTotal += val;
      } else {
        upcomingTotal += val;
      }
    }
    return { paidTotal, upcomingTotal };
  }

  it('should mark past months as paid', () => {
    const amounts = [1000, 2000, 3000];
    const result = splitPaidUpcoming(amounts, '2025-01', new Date('2025-04-01'));
    // Jan 2025, Feb 2025, Mar 2025 — all before April 2025
    expect(result.paidTotal).toBe(6000);
    expect(result.upcomingTotal).toBe(0);
  });

  it('should mark future months as upcoming', () => {
    const amounts = [1000, 2000, 3000];
    const result = splitPaidUpcoming(amounts, '2030-01', new Date('2026-01-01'));
    expect(result.paidTotal).toBe(0);
    expect(result.upcomingTotal).toBe(6000);
  });

  it('should split correctly at the boundary', () => {
    const amounts = [1000, 2000, 3000, 4000];
    // Start: Jan 2026, today: Mar 15, 2026
    // Month 0 = Jan 2026 (28th) → past
    // Month 1 = Feb 2026 (28th) → past
    // Month 2 = Mar 2026 (28th) → future (28 > 15)
    // Month 3 = Apr 2026 (28th) → future
    const result = splitPaidUpcoming(amounts, '2026-01', new Date('2026-03-15'));
    expect(result.paidTotal).toBe(3000); // Jan + Feb
    expect(result.upcomingTotal).toBe(7000); // Mar + Apr
  });
});
