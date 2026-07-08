import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {} as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
}

describe("cashFlowSettings.getProjectMonthlyReport", () => {
  it("should return monthly report for Majan Mall (project 1)", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const report = await caller.cashFlowSettings.getProjectMonthlyReport({ projectId: 1 });

    // Basic structure checks
    expect(report).toBeDefined();
    expect(report.projectId).toBe(1);
    expect(report.projectName).toContain("مجان");
    expect(report.scenario).toBe("no_offplan");

    // Should have month labels
    expect(report.monthLabels.length).toBeGreaterThan(0);
    expect(report.totalMonths).toBeGreaterThan(30); // 7 design + 30 construction + 2 handover = 39

    // Should have items (from saved settings)
    expect(report.items.length).toBeGreaterThan(0);

    // Should NOT have RERA items (they were disabled)
    const reraItems = report.items.filter(i => i.itemKey.includes("rera"));
    expect(reraItems.length).toBe(0);

    // Should NOT have sales commission (no offplan)
    const salesItems = report.items.filter(i => i.itemKey === "sales_commission");
    expect(salesItems.length).toBe(0);

    // Should have construction cost
    const constructionItem = report.items.find(i => i.itemKey === "contractor_advance" || i.itemKey === "construction_cost");
    expect(constructionItem).toBeDefined();

    // Grand total should be reasonable (around 458M based on our settings)
    expect(report.grandTotal).toBeGreaterThan(400_000_000);
    expect(report.grandTotal).toBeLessThan(500_000_000);

    // Monthly amounts array should match totalMonths
    for (const item of report.items) {
      expect(item.monthlyAmounts.length).toBe(report.totalMonths);
    }

    // totalPerMonth should sum to grandTotal
    const sumOfMonthly = report.totalPerMonth.reduce((s, v) => s + v, 0);
    expect(Math.abs(sumOfMonthly - report.grandTotal)).toBeLessThan(1); // floating point tolerance

    // Phases should include design and construction
    const phaseTypes = report.phases.map(p => p.type);
    expect(phaseTypes).toContain("design");
    expect(phaseTypes).toContain("construction");
  });

  it("should return empty items for non-existent project", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // Should throw or return null for non-existent project
    await expect(
      caller.cashFlowSettings.getProjectMonthlyReport({ projectId: 99999 })
    ).rejects.toThrow();
  });
});
