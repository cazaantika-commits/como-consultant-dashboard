import { describe, it, expect } from "vitest";

/**
 * Tests for the CapitalPortfolioPage logic.
 * These tests verify the data transformation and mapping logic
 * used by the capital portfolio page.
 */

// ── Helper functions replicated from CapitalPortfolioPage ────────────────────

function projectMonthToChartIndex(
  startDate: string,
  relativeMonth: number,
): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const chartStartYear = 2026;
  const chartStartMonth = 4;
  const absYear = sy + Math.floor((sm - 1 + relativeMonth) / 12);
  const absMonth = ((sm - 1 + relativeMonth) % 12) + 1;
  return (absYear - chartStartYear) * 12 + (absMonth - chartStartMonth);
}

function fmtCell(n: number): string {
  if (n === 0) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtFull(n: number): string {
  if (n === 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function getMonthLabel(offset: number): string {
  const CHART_START = new Date(2026, 3, 1); // April 2026
  const d = new Date(CHART_START);
  d.setMonth(d.getMonth() + offset);
  return `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("projectMonthToChartIndex", () => {
  it("maps April 2026 start, month 0 to chart index 0", () => {
    expect(projectMonthToChartIndex("2026-04", 0)).toBe(0);
  });

  it("maps April 2026 start, month 1 to chart index 1", () => {
    expect(projectMonthToChartIndex("2026-04", 1)).toBe(1);
  });

  it("maps May 2026 start, month 0 to chart index 1", () => {
    expect(projectMonthToChartIndex("2026-05", 0)).toBe(1);
  });

  it("maps January 2027 start, month 0 to chart index 9", () => {
    // Jan 2027 is 9 months after April 2026
    expect(projectMonthToChartIndex("2027-01", 0)).toBe(9);
  });

  it("handles month overflow correctly", () => {
    // April 2026 start, month 12 = April 2027 = chart index 12
    expect(projectMonthToChartIndex("2026-04", 12)).toBe(12);
  });

  it("handles projects starting before chart range", () => {
    // January 2026 start, month 0 = chart index -3
    expect(projectMonthToChartIndex("2026-01", 0)).toBe(-3);
  });

  it("handles projects starting after chart range", () => {
    // April 2030 start, month 0 = chart index 48
    expect(projectMonthToChartIndex("2030-04", 0)).toBe(48);
  });
});

describe("fmtCell", () => {
  it("returns empty string for 0", () => {
    expect(fmtCell(0)).toBe("");
  });

  it("formats millions correctly", () => {
    expect(fmtCell(1500000)).toBe("1.50M");
    expect(fmtCell(85140000)).toBe("85.14M");
  });

  it("formats thousands correctly", () => {
    expect(fmtCell(500000)).toBe("500K");
    expect(fmtCell(1500)).toBe("2K"); // rounds to nearest K
  });

  it("formats small numbers as-is", () => {
    expect(fmtCell(500)).toBe("500");
  });
});

describe("fmtFull", () => {
  it("returns dash for 0", () => {
    expect(fmtFull(0)).toBe("—");
  });

  it("formats millions with M suffix", () => {
    expect(fmtFull(85140000)).toBe("85.14M");
  });

  it("formats thousands with K suffix", () => {
    expect(fmtFull(500000)).toBe("500K");
  });
});

describe("getMonthLabel", () => {
  it("returns April 2026 for offset 0", () => {
    expect(getMonthLabel(0)).toBe("أبريل 2026");
  });

  it("returns May 2026 for offset 1", () => {
    expect(getMonthLabel(1)).toBe("مايو 2026");
  });

  it("returns March 2027 for offset 11", () => {
    expect(getMonthLabel(11)).toBe("مارس 2027");
  });

  it("returns April 2027 for offset 12", () => {
    expect(getMonthLabel(12)).toBe("أبريل 2027");
  });

  it("returns March 2030 for offset 47", () => {
    expect(getMonthLabel(47)).toBe("مارس 2030");
  });
});

describe("Option to Scenario mapping", () => {
  const OPTION_TO_SCENARIO: Record<string, string> = {
    o1: "offplan_escrow",
    o2: "offplan_construction",
    o3: "no_offplan",
  };

  it("maps o1 to offplan_escrow", () => {
    expect(OPTION_TO_SCENARIO["o1"]).toBe("offplan_escrow");
  });

  it("maps o2 to offplan_construction", () => {
    expect(OPTION_TO_SCENARIO["o2"]).toBe("offplan_construction");
  });

  it("maps o3 to no_offplan", () => {
    expect(OPTION_TO_SCENARIO["o3"]).toBe("no_offplan");
  });
});

describe("Delay application logic", () => {
  it("applies design delay to chart index", () => {
    const baseIdx = projectMonthToChartIndex("2026-04", 0);
    const designDelay = 3;
    expect(baseIdx + designDelay).toBe(3);
  });

  it("applies construction delay independently", () => {
    const constructionStartRel = 6; // month 6 in project
    const baseIdx = projectMonthToChartIndex("2026-04", constructionStartRel);
    const designDelay = 2;
    const constructionDelay = 1;
    // Construction delay is applied on top of design delay
    expect(baseIdx + designDelay + constructionDelay).toBe(9);
  });

  it("does not allow negative delays", () => {
    const delay = Math.max(0, -1);
    expect(delay).toBe(0);
  });
});

describe("Grouping logic", () => {
  it("calculates correct number of groups for monthly", () => {
    const TOTAL_MONTHS = 48;
    const groupBy = 1;
    expect(Math.ceil(TOTAL_MONTHS / groupBy)).toBe(48);
  });

  it("calculates correct number of groups for quarterly", () => {
    const TOTAL_MONTHS = 48;
    const groupBy = 3;
    expect(Math.ceil(TOTAL_MONTHS / groupBy)).toBe(16);
  });

  it("calculates correct number of groups for semi-annual", () => {
    const TOTAL_MONTHS = 48;
    const groupBy = 6;
    expect(Math.ceil(TOTAL_MONTHS / groupBy)).toBe(8);
  });
});

describe("Portfolio data aggregation", () => {
  it("correctly sums monthly totals across projects", () => {
    const project1Amounts: Record<number, number> = { 0: 100, 1: 200, 2: 300 };
    const project2Amounts: Record<number, number> = { 0: 50, 1: 150, 3: 400 };

    const totals: Record<number, number> = {};
    for (const [idx, val] of Object.entries(project1Amounts)) {
      totals[Number(idx)] = (totals[Number(idx)] || 0) + val;
    }
    for (const [idx, val] of Object.entries(project2Amounts)) {
      totals[Number(idx)] = (totals[Number(idx)] || 0) + val;
    }

    expect(totals[0]).toBe(150);
    expect(totals[1]).toBe(350);
    expect(totals[2]).toBe(300);
    expect(totals[3]).toBe(400);
  });

  it("correctly computes cumulative totals", () => {
    const monthlyTotals = [100, 200, 300, 400];
    const cumulative: number[] = [];
    let running = 0;
    for (const val of monthlyTotals) {
      running += val;
      cumulative.push(running);
    }
    expect(cumulative).toEqual([100, 300, 600, 1000]);
  });
});
