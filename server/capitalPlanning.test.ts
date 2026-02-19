import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("capitalPlanning", () => {
  describe("getPhaseNames", () => {
    it("returns Arabic and English phase names", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.capitalPlanning.getPhaseNames();

      expect(result.ar).toHaveLength(5);
      expect(result.en).toHaveLength(5);
      expect(result.ar[0]).toBe("دراسة السوق والجدوى");
      expect(result.en[0]).toBe("Market & Feasibility");
      expect(result.ar[4]).toBe("البناء والتسليم");
      expect(result.en[4]).toBe("Construction & Delivery");
    });
  });

  describe("getPortfolio", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.capitalPlanning.getPortfolio()).rejects.toThrow("Unauthorized");
    });

    it("returns array of projects when authenticated", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.capitalPlanning.getPortfolio();

      expect(Array.isArray(result)).toBe(true);
      // Each project should have phases and settings properties
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("phases");
        expect(first).toHaveProperty("settings");
        expect(first).toHaveProperty("phaseNames");
        expect(first).toHaveProperty("phaseNamesEn");
        expect(Array.isArray(first.phases)).toBe(true);
      }
    });
  });

  describe("initializePhases", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.capitalPlanning.initializePhases({ projectId: 1, startDate: "2025-06" })
      ).rejects.toThrow("Unauthorized");
    });

    it("creates 5 default phases for a project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Get a project to initialize
      const portfolio = await caller.capitalPlanning.getPortfolio();
      if (portfolio.length === 0) return; // Skip if no projects

      const projectId = portfolio[0].id;
      const result = await caller.capitalPlanning.initializePhases({
        projectId,
        startDate: "2025-06",
      });

      expect(result).toEqual({ success: true });

      // Verify phases were created
      const phases = await caller.capitalPlanning.getProjectPhases(projectId);
      expect(phases.length).toBe(5);

      // Verify phase numbers
      const phaseNumbers = phases.map((p: any) => p.phaseNumber).sort();
      expect(phaseNumbers).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("updatePhase", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.capitalPlanning.updatePhase({
          projectId: 1,
          phaseNumber: 1,
          estimatedCost: "5000000",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("updates phase cost successfully", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const portfolio = await caller.capitalPlanning.getPortfolio();
      if (portfolio.length === 0) return;

      const projectId = portfolio[0].id;

      const result = await caller.capitalPlanning.updatePhase({
        projectId,
        phaseNumber: 1,
        estimatedCost: "5000000",
      });

      expect(result).toEqual({ success: true });

      // Verify the update
      const phases = await caller.capitalPlanning.getProjectPhases(projectId);
      const phase1 = phases.find((p: any) => p.phaseNumber === 1);
      expect(phase1).toBeDefined();
      if (phase1) {
        expect(phase1.estimatedCost).toBe("5000000.00");
      }
    });
  });

  describe("shiftPhase", () => {
    it("delays a phase by the specified months", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const portfolio = await caller.capitalPlanning.getPortfolio();
      if (portfolio.length === 0) return;

      const projectId = portfolio[0].id;

      const result = await caller.capitalPlanning.shiftPhase({
        projectId,
        phaseNumber: 2,
        delayMonths: 3,
      });

      expect(result).toEqual({ success: true });

      const phases = await caller.capitalPlanning.getProjectPhases(projectId);
      const phase2 = phases.find((p: any) => p.phaseNumber === 2);
      expect(phase2).toBeDefined();
      if (phase2) {
        expect(phase2.delayMonths).toBe(3);
      }
    });
  });

  describe("updateSettings", () => {
    it("updates project start date", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const portfolio = await caller.capitalPlanning.getPortfolio();
      if (portfolio.length === 0) return;

      const projectId = portfolio[0].id;

      const result = await caller.capitalPlanning.updateSettings({
        projectId,
        startDate: "2025-09",
      });

      expect(result).toEqual({ success: true });

      const settings = await caller.capitalPlanning.getProjectSettings(projectId);
      expect(settings).toBeDefined();
      if (settings) {
        expect(settings.startDate).toBe("2025-09");
      }
    });
  });

  describe("bulkUpdatePhases", () => {
    it("updates multiple phases at once", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const portfolio = await caller.capitalPlanning.getPortfolio();
      if (portfolio.length === 0) return;

      const projectId = portfolio[0].id;

      const result = await caller.capitalPlanning.bulkUpdatePhases({
        projectId,
        phases: [
          { phaseNumber: 1, startMonth: 0, durationMonths: 4, estimatedCost: "1000000", delayMonths: 0 },
          { phaseNumber: 2, startMonth: 4, durationMonths: 8, estimatedCost: "3000000", delayMonths: 0 },
          { phaseNumber: 3, startMonth: 12, durationMonths: 4, estimatedCost: "500000", delayMonths: 0 },
          { phaseNumber: 4, startMonth: 16, durationMonths: 4, estimatedCost: "2000000", delayMonths: 0 },
          { phaseNumber: 5, startMonth: 20, durationMonths: 20, estimatedCost: "50000000", delayMonths: 0 },
        ],
      });

      expect(result).toEqual({ success: true });

      // Verify all phases were updated
      const phases = await caller.capitalPlanning.getProjectPhases(projectId);
      expect(phases.length).toBe(5);

      const phase1 = phases.find((p: any) => p.phaseNumber === 1);
      expect(phase1?.durationMonths).toBe(4);
      expect(phase1?.estimatedCost).toBe("1000000.00");

      const phase5 = phases.find((p: any) => p.phaseNumber === 5);
      expect(phase5?.durationMonths).toBe(20);
      expect(phase5?.estimatedCost).toBe("50000000.00");
    });
  });
});
