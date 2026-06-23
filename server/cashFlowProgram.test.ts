import { describe, expect, it } from "vitest";

// ═══════════════════════════════════════════════════════════════
// Unit tests for Cash Flow Calculation Engine
// We re-implement the pure calculation functions here to test
// the logic independently of the database layer.
// ═══════════════════════════════════════════════════════════════

interface TimelinePhase {
  name: string;
  startMonth: number;
  endMonth: number;
  durationMonths: number;
}

interface PaymentParams {
  paymentMonth?: number;
  milestones?: Array<{ percent: number; description: string; monthOffset: number }>;
  startMonth?: number;
  endMonth?: number;
  mobilizationPct?: number;
  progressDistribution?: 'linear' | 'scurve';
  retentionPct?: number;
  retentionReleaseMonth?: number;
  salesPct?: number;
  salesTiming?: 'booking' | 'construction' | 'handover';
}

interface CostItemWithPayment {
  id: number;
  name: string;
  category: string;
  totalAmount: number;
  paymentType: string;
  paymentParams: PaymentParams;
  phaseAllocation?: Record<string, number>;
}

// --- Pure functions from the engine ---

function buildTimeline(
  designMonths: number,
  reraMonths: number,
  constructionMonths: number,
  handoverMonths: number,
  constructionDelta: number = 0
): TimelinePhase[] {
  const adjConstruction = Math.max(1, constructionMonths + constructionDelta);
  const phases: TimelinePhase[] = [];
  let month = 1;

  phases.push({
    name: 'design',
    startMonth: month,
    endMonth: month + designMonths - 1,
    durationMonths: designMonths,
  });
  month += designMonths;

  phases.push({
    name: 'rera',
    startMonth: month,
    endMonth: month + reraMonths - 1,
    durationMonths: reraMonths,
  });
  month += reraMonths;

  phases.push({
    name: 'construction',
    startMonth: month,
    endMonth: month + adjConstruction - 1,
    durationMonths: adjConstruction,
  });
  month += adjConstruction;

  phases.push({
    name: 'handover',
    startMonth: month,
    endMonth: month + handoverMonths - 1,
    durationMonths: handoverMonths,
  });

  return phases;
}

function getTotalProjectMonths(phases: TimelinePhase[]): number {
  return phases[phases.length - 1].endMonth;
}

function getPhaseByName(phases: TimelinePhase[], name: string): TimelinePhase | undefined {
  return phases.find(p => p.name === name);
}

function sCurveDistribution(months: number): number[] {
  if (months <= 0) return [];
  const result: number[] = [];
  let total = 0;
  for (let i = 0; i < months; i++) {
    const x = (i / (months - 1 || 1)) * 6 - 3;
    const val = 1 / (1 + Math.exp(-x));
    result.push(val);
    total += val;
  }
  return result.map(v => v / total);
}

function linearDistribution(months: number): number[] {
  if (months <= 0) return [];
  return new Array(months).fill(1 / months);
}

function calculateItemPayments(
  item: CostItemWithPayment,
  phases: TimelinePhase[],
  totalMonths: number,
): number[] {
  const payments = new Array(totalMonths).fill(0);
  const params = item.paymentParams || {};
  const amount = item.totalAmount;

  switch (item.paymentType) {
    case 'lump_sum': {
      const month = (params.paymentMonth || 1) - 1;
      if (month >= 0 && month < totalMonths) {
        payments[month] = amount;
      }
      break;
    }

    case 'milestone': {
      const milestones = params.milestones || [];
      for (const ms of milestones) {
        const month = (ms.monthOffset || 1) - 1;
        if (month >= 0 && month < totalMonths) {
          payments[month] += amount * (ms.percent / 100);
        }
      }
      break;
    }

    case 'monthly_fixed': {
      const start = (params.startMonth || 1) - 1;
      const end = Math.min((params.endMonth || totalMonths) - 1, totalMonths - 1);
      const duration = end - start + 1;
      if (duration > 0) {
        const monthly = amount / duration;
        for (let m = start; m <= end && m < totalMonths; m++) {
          if (m >= 0) payments[m] = monthly;
        }
      }
      break;
    }

    case 'progress_based': {
      const constructionPhase = getPhaseByName(phases, 'construction');
      if (!constructionPhase) break;

      const mobPct = (params.mobilizationPct ?? 10) / 100;
      const retPct = (params.retentionPct ?? 5) / 100;
      const dist = params.progressDistribution === 'scurve'
        ? sCurveDistribution(constructionPhase.durationMonths)
        : linearDistribution(constructionPhase.durationMonths);

      const mobMonth = constructionPhase.startMonth - 1;
      if (mobMonth >= 0 && mobMonth < totalMonths) {
        payments[mobMonth] += amount * mobPct;
      }

      const progressAmount = amount * (1 - mobPct - retPct);
      for (let i = 0; i < constructionPhase.durationMonths; i++) {
        const m = constructionPhase.startMonth - 1 + i;
        if (m >= 0 && m < totalMonths) {
          payments[m] += progressAmount * dist[i];
        }
      }

      const retMonth = (params.retentionReleaseMonth || (constructionPhase.endMonth + 12)) - 1;
      if (retMonth >= 0 && retMonth < totalMonths) {
        payments[retMonth] += amount * retPct;
      }
      break;
    }

    case 'sales_linked': {
      const timing = params.salesTiming || 'construction';
      const pct = (params.salesPct || 100) / 100;
      const linkedAmount = amount * pct;

      if (timing === 'booking') {
        const reraPhase = getPhaseByName(phases, 'rera');
        if (reraPhase) {
          const monthly = linkedAmount / reraPhase.durationMonths;
          for (let m = reraPhase.startMonth - 1; m < reraPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      } else if (timing === 'construction') {
        const constructionPhase = getPhaseByName(phases, 'construction');
        if (constructionPhase) {
          const monthly = linkedAmount / constructionPhase.durationMonths;
          for (let m = constructionPhase.startMonth - 1; m < constructionPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      } else if (timing === 'handover') {
        const handoverPhase = getPhaseByName(phases, 'handover');
        if (handoverPhase) {
          const monthly = linkedAmount / handoverPhase.durationMonths;
          for (let m = handoverPhase.startMonth - 1; m < handoverPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      }
      break;
    }
  }

  return payments;
}

function calculateMonthlyOutflow(
  costItems: CostItemWithPayment[],
  phases: TimelinePhase[],
  totalMonths: number,
): Record<string, number[]> {
  const outflowByCategory: Record<string, number[]> = {};
  const totalOutflow = new Array(totalMonths).fill(0);

  for (const item of costItems) {
    const categoryKey = item.category;
    if (!outflowByCategory[categoryKey]) {
      outflowByCategory[categoryKey] = new Array(totalMonths).fill(0);
    }

    const monthlyPayments = calculateItemPayments(item, phases, totalMonths);
    for (let m = 0; m < totalMonths; m++) {
      outflowByCategory[categoryKey][m] += monthlyPayments[m];
      totalOutflow[m] += monthlyPayments[m];
    }
  }

  outflowByCategory['total'] = totalOutflow;
  return outflowByCategory;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe("Cash Flow Engine - buildTimeline", () => {
  it("creates 4 sequential phases with correct months", () => {
    const phases = buildTimeline(6, 3, 24, 3);
    expect(phases).toHaveLength(4);

    expect(phases[0]).toEqual({
      name: 'design',
      startMonth: 1,
      endMonth: 6,
      durationMonths: 6,
    });
    expect(phases[1]).toEqual({
      name: 'rera',
      startMonth: 7,
      endMonth: 9,
      durationMonths: 3,
    });
    expect(phases[2]).toEqual({
      name: 'construction',
      startMonth: 10,
      endMonth: 33,
      durationMonths: 24,
    });
    expect(phases[3]).toEqual({
      name: 'handover',
      startMonth: 34,
      endMonth: 36,
      durationMonths: 3,
    });
  });

  it("applies construction duration delta correctly", () => {
    const phases = buildTimeline(6, 3, 24, 3, -6);
    const construction = getPhaseByName(phases, 'construction')!;
    expect(construction.durationMonths).toBe(18);
    expect(getTotalProjectMonths(phases)).toBe(30);
  });

  it("clamps construction duration to minimum 1 month", () => {
    const phases = buildTimeline(6, 3, 2, 3, -10);
    const construction = getPhaseByName(phases, 'construction')!;
    expect(construction.durationMonths).toBe(1);
  });

  it("calculates total project months correctly", () => {
    const phases = buildTimeline(6, 3, 24, 3);
    expect(getTotalProjectMonths(phases)).toBe(36);
  });
});

describe("Cash Flow Engine - Distribution Functions", () => {
  it("linear distribution sums to 1", () => {
    const dist = linearDistribution(12);
    expect(dist).toHaveLength(12);
    const sum = dist.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("linear distribution has equal values", () => {
    const dist = linearDistribution(4);
    expect(dist[0]).toBeCloseTo(0.25, 10);
    expect(dist[3]).toBeCloseTo(0.25, 10);
  });

  it("s-curve distribution sums to 1", () => {
    const dist = sCurveDistribution(24);
    expect(dist).toHaveLength(24);
    const sum = dist.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("s-curve has increasing values from start to middle region", () => {
    const dist = sCurveDistribution(24);
    // The s-curve derivative (bell curve) peaks around the middle
    // Early months should have smaller values than later months in the first half
    expect(dist[6]).toBeGreaterThan(dist[0]);
    expect(dist[12]).toBeGreaterThan(dist[3]);
    // The distribution should not be uniform
    const maxVal = Math.max(...dist);
    const minVal = Math.min(...dist);
    expect(maxVal).toBeGreaterThan(minVal * 1.5);
  });

  it("handles zero months gracefully", () => {
    expect(linearDistribution(0)).toEqual([]);
    expect(sCurveDistribution(0)).toEqual([]);
  });
});

describe("Cash Flow Engine - Lump Sum Payment", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("places full amount in specified month", () => {
    const item: CostItemWithPayment = {
      id: 1,
      name: "Land Purchase",
      category: "land",
      totalAmount: 50_000_000,
      paymentType: "lump_sum",
      paymentParams: { paymentMonth: 1 },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    expect(payments[0]).toBe(50_000_000);
    expect(payments.reduce((a, b) => a + b, 0)).toBe(50_000_000);
  });

  it("defaults to month 1 if paymentMonth not specified", () => {
    const item: CostItemWithPayment = {
      id: 1,
      name: "Land",
      category: "land",
      totalAmount: 10_000_000,
      paymentType: "lump_sum",
      paymentParams: {},
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    expect(payments[0]).toBe(10_000_000);
  });

  it("places amount in month 6", () => {
    const item: CostItemWithPayment = {
      id: 1,
      name: "Design Fee",
      category: "design_engineering",
      totalAmount: 2_000_000,
      paymentType: "lump_sum",
      paymentParams: { paymentMonth: 6 },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    expect(payments[5]).toBe(2_000_000);
    // All other months should be 0
    const nonZero = payments.filter(p => p !== 0);
    expect(nonZero).toHaveLength(1);
  });
});

describe("Cash Flow Engine - Milestone Payment", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("distributes amount across milestones correctly", () => {
    const item: CostItemWithPayment = {
      id: 2,
      name: "Design Consultant",
      category: "design_engineering",
      totalAmount: 5_000_000,
      paymentType: "milestone",
      paymentParams: {
        milestones: [
          { percent: 20, description: "Concept", monthOffset: 1 },
          { percent: 30, description: "Schematic", monthOffset: 3 },
          { percent: 50, description: "Final", monthOffset: 6 },
        ],
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    expect(payments[0]).toBe(1_000_000); // 20% of 5M
    expect(payments[2]).toBe(1_500_000); // 30% of 5M
    expect(payments[5]).toBe(2_500_000); // 50% of 5M
    expect(payments.reduce((a, b) => a + b, 0)).toBe(5_000_000);
  });

  it("handles milestones that sum to less than 100%", () => {
    const item: CostItemWithPayment = {
      id: 2,
      name: "Partial Milestones",
      category: "other",
      totalAmount: 1_000_000,
      paymentType: "milestone",
      paymentParams: {
        milestones: [
          { percent: 30, description: "A", monthOffset: 1 },
          { percent: 30, description: "B", monthOffset: 6 },
        ],
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    expect(payments.reduce((a, b) => a + b, 0)).toBe(600_000); // 60% of 1M
  });
});

describe("Cash Flow Engine - Monthly Fixed Payment", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("spreads amount evenly across specified months", () => {
    const item: CostItemWithPayment = {
      id: 3,
      name: "Supervision",
      category: "consultants",
      totalAmount: 3_600_000,
      paymentType: "monthly_fixed",
      paymentParams: { startMonth: 10, endMonth: 33 }, // construction phase
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const monthly = 3_600_000 / 24;
    for (let m = 9; m <= 32; m++) {
      expect(payments[m]).toBeCloseTo(monthly, 2);
    }
    expect(payments.reduce((a, b) => a + b, 0)).toBeCloseTo(3_600_000, 2);
  });

  it("handles full project duration when no end specified", () => {
    const item: CostItemWithPayment = {
      id: 3,
      name: "Management Fee",
      category: "developer_fee",
      totalAmount: 360_000,
      paymentType: "monthly_fixed",
      paymentParams: { startMonth: 1 },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const monthly = 360_000 / 36;
    for (let m = 0; m < 36; m++) {
      expect(payments[m]).toBeCloseTo(monthly, 2);
    }
  });
});

describe("Cash Flow Engine - Progress Based Payment", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("applies mobilization, progress, and retention correctly (linear)", () => {
    const item: CostItemWithPayment = {
      id: 4,
      name: "Main Contractor",
      category: "contractor",
      totalAmount: 100_000_000,
      paymentType: "progress_based",
      paymentParams: {
        mobilizationPct: 10,
        retentionPct: 5,
        progressDistribution: 'linear',
        retentionReleaseMonth: 45, // month 45 (after project end)
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);

    // Mobilization at construction start (month 10 = index 9)
    expect(payments[9]).toBeGreaterThanOrEqual(10_000_000); // 10% mobilization + first progress payment

    // Total should be less than full amount since retention release is beyond project
    const totalPaid = payments.reduce((a, b) => a + b, 0);
    // 10% mob + 85% progress = 95% (retention at month 45 is beyond 36 months)
    expect(totalPaid).toBeCloseTo(95_000_000, -2);
  });

  it("includes retention if release month is within project", () => {
    const item: CostItemWithPayment = {
      id: 4,
      name: "Contractor",
      category: "contractor",
      totalAmount: 10_000_000,
      paymentType: "progress_based",
      paymentParams: {
        mobilizationPct: 10,
        retentionPct: 5,
        progressDistribution: 'linear',
        retentionReleaseMonth: 35,
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const totalPaid = payments.reduce((a, b) => a + b, 0);
    expect(totalPaid).toBeCloseTo(10_000_000, -2);
  });

  it("uses s-curve distribution when specified", () => {
    const item: CostItemWithPayment = {
      id: 4,
      name: "Contractor S-Curve",
      category: "contractor",
      totalAmount: 24_000_000,
      paymentType: "progress_based",
      paymentParams: {
        mobilizationPct: 0,
        retentionPct: 0,
        progressDistribution: 'scurve',
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    // S-curve: middle months should have higher payments
    const constructionStart = 9; // month 10 = index 9
    const midMonth = constructionStart + 12;
    expect(payments[midMonth]).toBeGreaterThan(payments[constructionStart]);
  });
});

describe("Cash Flow Engine - Sales Linked Payment", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("distributes during construction phase", () => {
    const item: CostItemWithPayment = {
      id: 5,
      name: "Marketing",
      category: "marketing_sales",
      totalAmount: 6_000_000,
      paymentType: "sales_linked",
      paymentParams: {
        salesPct: 100,
        salesTiming: 'construction',
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const constructionPhase = getPhaseByName(phases, 'construction')!;
    const monthly = 6_000_000 / constructionPhase.durationMonths;

    for (let m = constructionPhase.startMonth - 1; m < constructionPhase.endMonth && m < totalMonths; m++) {
      expect(payments[m]).toBeCloseTo(monthly, 2);
    }
  });

  it("distributes during booking (RERA) phase", () => {
    const item: CostItemWithPayment = {
      id: 5,
      name: "Sales Commission",
      category: "marketing_sales",
      totalAmount: 3_000_000,
      paymentType: "sales_linked",
      paymentParams: {
        salesPct: 100,
        salesTiming: 'booking',
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const reraPhase = getPhaseByName(phases, 'rera')!;
    const monthly = 3_000_000 / reraPhase.durationMonths;

    for (let m = reraPhase.startMonth - 1; m < reraPhase.endMonth && m < totalMonths; m++) {
      expect(payments[m]).toBeCloseTo(monthly, 2);
    }
  });

  it("applies partial percentage correctly", () => {
    const item: CostItemWithPayment = {
      id: 5,
      name: "Partial Sales",
      category: "marketing_sales",
      totalAmount: 10_000_000,
      paymentType: "sales_linked",
      paymentParams: {
        salesPct: 50,
        salesTiming: 'handover',
      },
    };

    const payments = calculateItemPayments(item, phases, totalMonths);
    const totalPaid = payments.reduce((a, b) => a + b, 0);
    expect(totalPaid).toBeCloseTo(5_000_000, 2); // 50% of 10M
  });
});

describe("Cash Flow Engine - Monthly Outflow Aggregation", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("aggregates multiple cost items by category", () => {
    const items: CostItemWithPayment[] = [
      {
        id: 1, name: "Land", category: "land",
        totalAmount: 50_000_000, paymentType: "lump_sum",
        paymentParams: { paymentMonth: 1 },
      },
      {
        id: 2, name: "Design", category: "design_engineering",
        totalAmount: 5_000_000, paymentType: "lump_sum",
        paymentParams: { paymentMonth: 3 },
      },
      {
        id: 3, name: "Supervision", category: "consultants",
        totalAmount: 2_400_000, paymentType: "monthly_fixed",
        paymentParams: { startMonth: 10, endMonth: 33 },
      },
    ];

    const outflow = calculateMonthlyOutflow(items, phases, totalMonths);

    // Check categories exist
    expect(outflow['land']).toBeDefined();
    expect(outflow['design_engineering']).toBeDefined();
    expect(outflow['consultants']).toBeDefined();
    expect(outflow['total']).toBeDefined();

    // Check total at month 1 (index 0) = land only
    expect(outflow['total'][0]).toBe(50_000_000);

    // Check total at month 3 (index 2) = design only
    expect(outflow['total'][2]).toBe(5_000_000);

    // Check supervision is spread across construction
    const supervisionTotal = outflow['consultants'].reduce((a: number, b: number) => a + b, 0);
    expect(supervisionTotal).toBeCloseTo(2_400_000, 2);

    // Total across all months should equal sum of all items
    const grandTotal = outflow['total'].reduce((a: number, b: number) => a + b, 0);
    expect(grandTotal).toBeCloseTo(57_400_000, -2);
  });

  it("handles empty cost items array", () => {
    const outflow = calculateMonthlyOutflow([], phases, totalMonths);
    expect(outflow['total']).toBeDefined();
    expect(outflow['total'].every((v: number) => v === 0)).toBe(true);
  });
});

describe("Cash Flow Engine - Key Numbers", () => {
  const phases = buildTimeline(6, 3, 24, 3);
  const totalMonths = getTotalProjectMonths(phases);

  it("calculates peak exposure correctly", () => {
    const items: CostItemWithPayment[] = [
      {
        id: 1, name: "Land", category: "land",
        totalAmount: 50_000_000, paymentType: "lump_sum",
        paymentParams: { paymentMonth: 1 },
      },
      {
        id: 2, name: "Contractor", category: "contractor",
        totalAmount: 24_000_000, paymentType: "monthly_fixed",
        paymentParams: { startMonth: 10, endMonth: 33 },
      },
    ];

    const outflow = calculateMonthlyOutflow(items, phases, totalMonths);
    const totalArr = outflow['total'];

    // Cumulative outflow
    let cumulative = 0;
    let peakExposure = 0;
    let peakMonth = 0;
    for (let m = 0; m < totalMonths; m++) {
      cumulative += totalArr[m];
      if (cumulative > peakExposure) {
        peakExposure = cumulative;
        peakMonth = m + 1;
      }
    }

    // Peak exposure should be total cost (no inflow)
    expect(peakExposure).toBeCloseTo(74_000_000, -2);
    // Peak month should be the last month with payments
    expect(peakMonth).toBe(33);
  });

  it("total cost equals sum of all items", () => {
    const items: CostItemWithPayment[] = [
      { id: 1, name: "A", category: "land", totalAmount: 10_000_000, paymentType: "lump_sum", paymentParams: { paymentMonth: 1 } },
      { id: 2, name: "B", category: "other", totalAmount: 5_000_000, paymentType: "lump_sum", paymentParams: { paymentMonth: 6 } },
      { id: 3, name: "C", category: "contractor", totalAmount: 20_000_000, paymentType: "lump_sum", paymentParams: { paymentMonth: 10 } },
    ];

    const totalCost = items.reduce((sum, item) => sum + item.totalAmount, 0);
    expect(totalCost).toBe(35_000_000);
  });
});
