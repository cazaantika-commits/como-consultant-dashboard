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

const TIMEOUT = 30000;

describe("Unified Data Source: Financial Planning Report vs Dynamic Portfolio", () => {
  it("should return the same grand total for Majan Mall from both procedures", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // Get the single-project report (Financial Planning)
    const report = await caller.cashFlowSettings.getProjectMonthlyReport({ projectId: 1 });

    // Get the portfolio data (Dynamic Portfolio)
    const portfolio = await caller.cashFlowSettings.getPortfolioCapitalData();
    const majanPortfolio = portfolio.find((p: any) => p.projectId === 1);

    expect(majanPortfolio).toBeDefined();
    expect(report.grandTotal).toBeGreaterThan(0);
    expect(majanPortfolio!.grandTotal).toBeGreaterThan(0);

    // Both should have the same grand total (same source, same computation)
    expect(Math.abs(report.grandTotal - majanPortfolio!.grandTotal)).toBeLessThan(1);
  }, TIMEOUT);

  it("should return the same number of active items from both procedures", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const report = await caller.cashFlowSettings.getProjectMonthlyReport({ projectId: 1 });
    const portfolio = await caller.cashFlowSettings.getPortfolioCapitalData();
    const majanPortfolio = portfolio.find((p: any) => p.projectId === 1);

    // Count unique items in report
    const reportItemCount = report.items.length;

    // Count unique item names in portfolio (itemBreakdown groups items by phase, each entry is {name, amount})
    // Multiple phases may contain the same item name, so we count unique names
    const uniqueItemNames = new Set<string>();
    if (majanPortfolio?.itemBreakdown) {
      for (const phaseItems of Object.values(majanPortfolio.itemBreakdown)) {
        for (const item of phaseItems as any[]) {
          uniqueItemNames.add(item.name);
        }
      }
    }

    // Both should have same number of unique active items
    expect(reportItemCount).toBe(uniqueItemNames.size);
  }, TIMEOUT);

  it("should return the same monthly distribution from both procedures", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const report = await caller.cashFlowSettings.getProjectMonthlyReport({ projectId: 1 });
    const portfolio = await caller.cashFlowSettings.getPortfolioCapitalData();
    const majanPortfolio = portfolio.find((p: any) => p.projectId === 1);

    expect(majanPortfolio).toBeDefined();

    // Both should have the same totalMonths
    expect(report.totalPerMonth.length).toBe(majanPortfolio!.monthlyAmounts.length);

    // Monthly amounts should match
    for (let i = 0; i < report.totalPerMonth.length; i++) {
      expect(Math.abs(report.totalPerMonth[i] - majanPortfolio!.monthlyAmounts[i])).toBeLessThan(1);
    }
  }, TIMEOUT);
});
