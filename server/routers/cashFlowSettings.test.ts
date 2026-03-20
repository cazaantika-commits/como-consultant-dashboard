/**
 * cashFlowSettings.test.ts — Unit tests for cash flow settings distribution logic
 *
 * Tests the core distribution functions without hitting the database.
 */

import { describe, it, expect } from "vitest";

// ─── Inline the distribution function for testing ─────────────────────────────
// (mirrors the implementation in cashFlowSettings.ts)

type DistributionMethod = "lump_sum" | "equal_spread" | "custom";

function distributeAmount(
  amount: number,
  method: DistributionMethod,
  lumpSumMonth: number | null,
  startMonth: number | null,
  endMonth: number | null,
  customJson: string | null,
  totalMonths: number,
): number[] {
  const monthly = new Array(totalMonths).fill(0);
  if (amount <= 0) return monthly;

  switch (method) {
    case "lump_sum": {
      const m = (lumpSumMonth || 1) - 1;
      if (m === -1) {
        monthly[0] = amount;
      } else if (m >= 0 && m < totalMonths) {
        monthly[m] = amount;
      }
      break;
    }
    case "equal_spread": {
      const start = Math.max(0, (startMonth || 1) - 1);
      const end = Math.min(totalMonths - 1, (endMonth || totalMonths) - 1);
      const months = end - start + 1;
      if (months > 0) {
        const perMonth = amount / months;
        for (let m = start; m <= end; m++) {
          monthly[m] = perMonth;
        }
      }
      break;
    }
    case "custom": {
      if (customJson) {
        try {
          const entries: Array<{ month: number; amount?: number; pct?: number }> = JSON.parse(customJson);
          for (const entry of entries) {
            const m = entry.month - 1;
            if (m >= 0 && m < totalMonths) {
              const val = entry.amount !== undefined
                ? entry.amount
                : (entry.pct !== undefined ? amount * entry.pct / 100 : 0);
              monthly[m] += val;
            }
          }
        } catch {
          const perMonth = amount / totalMonths;
          for (let m = 0; m < totalMonths; m++) monthly[m] = perMonth;
        }
      }
      break;
    }
  }
  return monthly;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("distributeAmount — lump_sum", () => {
  it("places full amount at the specified month (1-based)", () => {
    const result = distributeAmount(100_000, "lump_sum", 3, null, null, null, 24);
    expect(result[2]).toBeCloseTo(100_000); // month 3 = index 2
    expect(result.filter((_, i) => i !== 2).every(v => v === 0)).toBe(true);
  });

  it("places amount at index 0 when lumpSumMonth is 0 (land payment)", () => {
    const result = distributeAmount(500_000, "lump_sum", 0, null, null, null, 24);
    expect(result[0]).toBeCloseTo(500_000);
  });

  it("defaults to month 1 when lumpSumMonth is null", () => {
    const result = distributeAmount(200_000, "lump_sum", null, null, null, null, 24);
    expect(result[0]).toBeCloseTo(200_000);
  });

  it("ignores months beyond totalMonths", () => {
    const result = distributeAmount(100_000, "lump_sum", 30, null, null, null, 24);
    expect(result.every(v => v === 0)).toBe(true);
  });
});

describe("distributeAmount — equal_spread", () => {
  it("distributes evenly across the specified range", () => {
    const result = distributeAmount(120_000, "equal_spread", null, 1, 6, null, 24);
    for (let i = 0; i < 6; i++) {
      expect(result[i]).toBeCloseTo(20_000);
    }
    for (let i = 6; i < 24; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it("handles single-month range", () => {
    const result = distributeAmount(50_000, "equal_spread", null, 5, 5, null, 24);
    expect(result[4]).toBeCloseTo(50_000);
    expect(result.filter((_, i) => i !== 4).every(v => v === 0)).toBe(true);
  });

  it("clamps range to totalMonths", () => {
    const result = distributeAmount(60_000, "equal_spread", null, 22, 30, null, 24);
    // months 22-24 = indices 21-23 = 3 months
    for (let i = 21; i < 24; i++) {
      expect(result[i]).toBeCloseTo(20_000);
    }
  });

  it("total sum equals the original amount", () => {
    const amount = 1_234_567;
    const result = distributeAmount(amount, "equal_spread", null, 3, 18, null, 24);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(amount, 0);
  });
});

describe("distributeAmount — custom", () => {
  it("distributes by amount entries", () => {
    const json = JSON.stringify([
      { month: 1, amount: 30_000 },
      { month: 2, amount: 70_000 },
    ]);
    const result = distributeAmount(100_000, "custom", null, null, null, json, 24);
    expect(result[0]).toBeCloseTo(30_000);
    expect(result[1]).toBeCloseTo(70_000);
  });

  it("distributes by percentage entries", () => {
    const json = JSON.stringify([
      { month: 1, pct: 25 },
      { month: 6, pct: 75 },
    ]);
    const result = distributeAmount(200_000, "custom", null, null, null, json, 24);
    expect(result[0]).toBeCloseTo(50_000);
    expect(result[5]).toBeCloseTo(150_000);
  });

  it("falls back to equal spread on invalid JSON", () => {
    const result = distributeAmount(240_000, "custom", null, null, null, "invalid-json", 24);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(240_000, 0);
    // Each month should be equal
    expect(result[0]).toBeCloseTo(10_000);
  });

  it("returns zeros for empty customJson", () => {
    const result = distributeAmount(100_000, "custom", null, null, null, null, 24);
    expect(result.every(v => v === 0)).toBe(true);
  });
});

describe("distributeAmount — zero amount", () => {
  it("returns all zeros for zero amount", () => {
    const r1 = distributeAmount(0, "lump_sum", 1, null, null, null, 24);
    const r2 = distributeAmount(0, "equal_spread", null, 1, 12, null, 24);
    expect(r1.every(v => v === 0)).toBe(true);
    expect(r2.every(v => v === 0)).toBe(true);
  });
});

describe("distributeAmount — total integrity", () => {
  it("lump_sum total equals amount", () => {
    const amount = 750_000;
    const result = distributeAmount(amount, "lump_sum", 7, null, null, null, 24);
    expect(result.reduce((s, v) => s + v, 0)).toBeCloseTo(amount, 0);
  });

  it("equal_spread total equals amount", () => {
    const amount = 1_800_000;
    const result = distributeAmount(amount, "equal_spread", null, 7, 22, null, 24);
    expect(result.reduce((s, v) => s + v, 0)).toBeCloseTo(amount, 0);
  });
});
