import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Unit tests for Portfolio Capital Planning Simulation
// ═══════════════════════════════════════════════════════════════

describe('Portfolio Capital Planning - Utility Functions', () => {
  describe('Number formatting', () => {
    const formatAED = (amount: number): string => {
      if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
      if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
      if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
      return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    it('formats billions correctly', () => {
      expect(formatAED(1_500_000_000)).toBe('1.50B');
    });

    it('formats millions correctly', () => {
      expect(formatAED(736_900_000)).toBe('736.9M');
      expect(formatAED(100_000_000)).toBe('100.0M');
    });

    it('formats thousands correctly', () => {
      expect(formatAED(50_000)).toBe('50K');
    });

    it('formats small numbers correctly', () => {
      expect(formatAED(500)).toBe('500');
    });
  });

  describe('Funding gap calculation', () => {
    it('calculates funding gap when exposure exceeds capital', () => {
      const availableCapital = 100_000_000;
      const peakExposure = 427_600_000;
      const fundingGap = Math.max(0, peakExposure - availableCapital);
      expect(fundingGap).toBe(327_600_000);
    });

    it('returns zero gap when capital covers exposure', () => {
      const availableCapital = 500_000_000;
      const peakExposure = 427_600_000;
      const fundingGap = Math.max(0, peakExposure - availableCapital);
      expect(fundingGap).toBe(0);
    });

    it('identifies months with funding shortfall', () => {
      const cumulativeExposure = [50, 120, 180, 250, 300, 280, 200, 100];
      const availableCapital = 200;
      const gapMonths = cumulativeExposure
        .map((v, i) => ({ month: i + 1, gap: v - availableCapital }))
        .filter(m => m.gap > 0);
      expect(gapMonths.length).toBe(3);
      expect(gapMonths[0].month).toBe(4);
    });
  });

  describe('Delay adjustment', () => {
    it('adjusts project start date forward by delay months', () => {
      const startDate = '2025-06';
      const delayMonths = 3;
      const [year, month] = startDate.split('-').map(Number);
      const totalMonths = year * 12 + month + delayMonths;
      const newYear = Math.floor((totalMonths - 1) / 12);
      const newMonth = ((totalMonths - 1) % 12) + 1;
      expect(`${newYear}-${String(newMonth).padStart(2, '0')}`).toBe('2025-09');
    });

    it('adjusts project start date backward', () => {
      const startDate = '2025-06';
      const delayMonths = -3;
      const [year, month] = startDate.split('-').map(Number);
      const totalMonths = year * 12 + month + delayMonths;
      const newYear = Math.floor((totalMonths - 1) / 12);
      const newMonth = ((totalMonths - 1) % 12) + 1;
      expect(`${newYear}-${String(newMonth).padStart(2, '0')}`).toBe('2025-03');
    });

    it('clamps delay between -12 and +24', () => {
      const adjustDelay = (current: number, delta: number) =>
        Math.max(-12, Math.min(24, current + delta));

      expect(adjustDelay(0, 3)).toBe(3);
      expect(adjustDelay(22, 5)).toBe(24);
      expect(adjustDelay(-10, -5)).toBe(-12);
    });
  });

  describe('Portfolio aggregation', () => {
    const projects = [
      { totalCost: 72_500_000, totalSales: 83_700_000, developerExposure: 40_200_000 },
      { totalCost: 66_100_000, totalSales: 0, developerExposure: 66_100_000 },
      { totalCost: 530_100_000, totalSales: 622_500_000, developerExposure: 284_200_000 },
      { totalCost: 68_100_000, totalSales: 76_800_000, developerExposure: 37_000_000 },
    ];

    it('sums total portfolio cost', () => {
      const total = projects.reduce((s, p) => s + p.totalCost, 0);
      expect(total).toBe(736_800_000);
    });

    it('sums total portfolio sales', () => {
      const total = projects.reduce((s, p) => s + p.totalSales, 0);
      expect(total).toBe(783_000_000);
    });

    it('calculates portfolio profit', () => {
      const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);
      const totalSales = projects.reduce((s, p) => s + p.totalSales, 0);
      expect(totalSales - totalCost).toBe(46_200_000);
    });

    it('calculates ROI correctly', () => {
      const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);
      const totalSales = projects.reduce((s, p) => s + p.totalSales, 0);
      const maxExposure = projects.reduce((s, p) => s + p.developerExposure, 0);
      const profit = totalSales - totalCost;
      const roi = (profit / maxExposure) * 100;
      expect(roi).toBeCloseTo(10.8, 0);
    });
  });

  describe('Project exclusion', () => {
    it('filters excluded projects correctly', () => {
      const allProjects = [
        { id: 1, name: 'A', excluded: false },
        { id: 2, name: 'B', excluded: true },
        { id: 3, name: 'C', excluded: false },
        { id: 4, name: 'D', excluded: true },
      ];
      const active = allProjects.filter(p => !p.excluded);
      expect(active.length).toBe(2);
      expect(active.map(p => p.name)).toEqual(['A', 'C']);
    });

    it('toggles project exclusion', () => {
      let excludeIds: number[] = [];
      const toggleProject = (id: number) => {
        excludeIds = excludeIds.includes(id)
          ? excludeIds.filter(x => x !== id)
          : [...excludeIds, id];
      };

      toggleProject(2);
      expect(excludeIds).toEqual([2]);

      toggleProject(4);
      expect(excludeIds).toEqual([2, 4]);

      toggleProject(2);
      expect(excludeIds).toEqual([4]);
    });
  });

  describe('Cumulative exposure calculation', () => {
    it('calculates cumulative sums correctly', () => {
      const monthly = [10, 20, 30, 15, 5];
      const cumulative = monthly.reduce((acc: number[], val) => {
        acc.push((acc[acc.length - 1] || 0) + val);
        return acc;
      }, []);
      expect(cumulative).toEqual([10, 30, 60, 75, 80]);
    });

    it('finds peak exposure month', () => {
      const cumulative = [10, 30, 60, 75, 80, 70, 50, 20];
      let peakMonth = 0;
      let peakValue = 0;
      cumulative.forEach((v, i) => {
        if (v > peakValue) {
          peakValue = v;
          peakMonth = i + 1;
        }
      });
      expect(peakMonth).toBe(5);
      expect(peakValue).toBe(80);
    });
  });

  describe('Month label generation', () => {
    it('generates correct Arabic month labels', () => {
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

      const generateLabel = (year: number, month: number) =>
        `${monthNames[month - 1]} ${year}`;

      expect(generateLabel(2025, 6)).toBe('يونيو 2025');
      expect(generateLabel(2026, 1)).toBe('يناير 2026');
      expect(generateLabel(2028, 12)).toBe('ديسمبر 2028');
    });
  });
});
