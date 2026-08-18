import { describe, expect, it } from "vitest";
import { buildExecutivePortfolioLiquidity } from "../client/src/lib/executivePortfolioLiquidity";

describe("Executive portfolio liquidity view", () => {
  const projects = [
    {
      projectId: 1,
      name: "مشروع أ",
      financingScenario: "offplan_escrow" as const,
      startDate: "2026-09",
      monthDates: ["2026-09", "2026-10", "2026-11", "2026-12"],
      monthlyNet: [-5_000_000, 2_000_000, -1_000_000, 0],
    },
    {
      projectId: 2,
      name: "مشروع ب",
      financingScenario: "build_for_sale" as const,
      startDate: "2026-09",
      monthDates: ["2026-09", "2026-10", "2026-11", "2026-12"],
      monthlyNet: [-3_000_000, -1_000_000, 4_000_000, 0],
    },
  ];

  it("uses the approved signed portfolio rows without inventing a second cash-flow calculation", () => {
    const view = buildExecutivePortfolioLiquidity(projects, { horizon: 4, asOfMonth: "2026-09" });

    expect(view.months.map((month) => month.total)).toEqual([-8_000_000, 1_000_000, 3_000_000]);
    expect(view.summary).toEqual({ required: 8_000_000, returned: 4_000_000, netFunding: 4_000_000 });
  });

  it("identifies the largest required month and exposes its project drivers separately from returns", () => {
    const view = buildExecutivePortfolioLiquidity(projects, { horizon: 4, asOfMonth: "2026-09" });

    expect(view.peakKind).toBe("required");
    expect(view.peakMonth?.monthDate).toBe("2026-09");
    expect(view.peakMonth?.required).toBe(8_000_000);
    expect(view.peakMonth?.requiredDrivers.map((driver) => driver.name)).toEqual(["مشروع أ", "مشروع ب"]);
    expect(view.peakMonth?.returnedDrivers).toEqual([]);
  });

  it("labels a return month as the peak only when no future funding is required", () => {
    const view = buildExecutivePortfolioLiquidity([
      { ...projects[0], monthlyNet: [1_000_000, 3_000_000, 2_000_000, 0] },
    ], { horizon: 4, asOfMonth: "2026-09" });

    expect(view.peakKind).toBe("returned");
    expect(view.peakMonth?.monthDate).toBe("2026-10");
    expect(view.peakMonth?.returned).toBe(3_000_000);
  });
});
