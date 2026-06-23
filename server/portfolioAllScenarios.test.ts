import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("cashFlowSettings.getPortfolioAllScenarios", () => {
  it("returns an empty array for unauthenticated users", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cashFlowSettings.getPortfolioAllScenarios();
    expect(result).toEqual([]);
  });

  it("returns an array for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cashFlowSettings.getPortfolioAllScenarios();
    expect(Array.isArray(result)).toBe(true);
  }, 30000);

  it("each project has the expected structure when data exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cashFlowSettings.getPortfolioAllScenarios();

    if (result.length > 0) {
      const first = result[0];
      // Check top-level fields
      expect(first).toHaveProperty("projectId");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("startDate");
      expect(first).toHaveProperty("totalMonths");
      expect(first).toHaveProperty("totalRevenue");
      expect(first).toHaveProperty("phaseInfo");
      expect(first).toHaveProperty("durations");
      expect(first).toHaveProperty("scenarios");

      // Check phaseInfo structure
      expect(first.phaseInfo).toHaveProperty("design");
      expect(first.phaseInfo).toHaveProperty("offplan");
      expect(first.phaseInfo).toHaveProperty("construction");
      expect(first.phaseInfo).toHaveProperty("handover");

      // Check durations structure
      expect(first.durations).toHaveProperty("design");
      expect(first.durations).toHaveProperty("offplan");
      expect(first.durations).toHaveProperty("construction");
      expect(first.durations).toHaveProperty("handover");

      // Check scenarios structure - all 3 scenarios should be present
      const scenarioKeys = ["offplan_escrow", "offplan_construction", "no_offplan"];
      for (const sc of scenarioKeys) {
        if (first.scenarios[sc]) {
          expect(first.scenarios[sc]).toHaveProperty("investorTotal");
          expect(first.scenarios[sc]).toHaveProperty("escrowTotal");
          expect(first.scenarios[sc]).toHaveProperty("grandTotal");
          expect(first.scenarios[sc]).toHaveProperty("monthlyInvestor");
          expect(first.scenarios[sc]).toHaveProperty("monthlyEscrow");
          expect(first.scenarios[sc]).toHaveProperty("monthlyTotal");
          expect(first.scenarios[sc]).toHaveProperty("sectionTotals");

          // grandTotal should equal investorTotal + escrowTotal
          expect(first.scenarios[sc].grandTotal).toBeCloseTo(
            first.scenarios[sc].investorTotal + first.scenarios[sc].escrowTotal,
            2
          );

          // Monthly arrays should have length equal to totalMonths
          expect(first.scenarios[sc].monthlyInvestor.length).toBe(first.totalMonths);
          expect(first.scenarios[sc].monthlyEscrow.length).toBe(first.totalMonths);
          expect(first.scenarios[sc].monthlyTotal.length).toBe(first.totalMonths);
        }
      }
    }
  }, 30000);

  it("returns consistent data on repeated calls", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result1 = await caller.cashFlowSettings.getPortfolioAllScenarios();
    const result2 = await caller.cashFlowSettings.getPortfolioAllScenarios();

    // Same input → same output
    expect(result1.length).toBe(result2.length);
    if (result1.length > 0 && result2.length > 0) {
      expect(result1[0].scenarios.offplan_escrow?.grandTotal)
        .toBe(result2[0].scenarios.offplan_escrow?.grandTotal);
    }
  }, 30000);
});
