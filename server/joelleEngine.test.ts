import { describe, expect, it } from "vitest";
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

describe("joelleEngine", () => {
  describe("getStageDefinitions", () => {
    it("returns all 12 stage definitions", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getStageDefinitions();

      expect(result).toHaveLength(12);
      expect(result[0]).toMatchObject({
        number: 1,
        name: "Data Acquisition",
        nameAr: "جمع البيانات",
      });
      expect(result[11]).toMatchObject({
        number: 12,
        name: "Report Generation",
        nameAr: "توليد التقارير",
      });
    });
  });

  describe("getReportTypes", () => {
    it("returns all 7 report types as objects with type and titleAr", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getReportTypes();

      expect(result).toHaveLength(7);
      // Result is array of { type, titleAr } objects
      const types = result.map((r: any) => r.type);
      expect(types).toContain("market_intelligence");
      expect(types).toContain("competitive_analysis");
      expect(types).toContain("product_strategy");
      expect(types).toContain("pricing_strategy");
      expect(types).toContain("demand_forecast");
      expect(types).toContain("risk_analysis");
      expect(types).toContain("executive_summary");
    });
  });

  describe("getStages", () => {
    it("returns an array for a project query", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getStages(99999);

      // May return existing data or empty array depending on DB state
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getReports", () => {
    it("returns an array for a project query", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getReports(99999);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getStage", () => {
    it("returns stage or null for a query", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getStage({ projectId: 99999, stageNumber: 99 });

      // Should return null or a stage object
      if (result !== null) {
        expect(result).toHaveProperty("stageNumber");
        expect(result).toHaveProperty("status");
      }
    });
  });

  describe("getReport", () => {
    it("returns report or null for a query", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.joelleEngine.getReport({ projectId: 99999, reportType: "market_intelligence" });

      if (result !== null) {
        expect(result).toHaveProperty("reportType");
        expect(result).toHaveProperty("content");
      }
    });
  });

  describe("runEngine1 (Data Acquisition)", () => {
    it("throws error for non-existent project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.joelleEngine.runEngine1(99999)).rejects.toThrow();
    });
  });

  describe("router structure", () => {
    it("has all expected procedures", () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Verify all engine procedures exist
      expect(typeof caller.joelleEngine.runEngine1).toBe("function");
      expect(typeof caller.joelleEngine.runEngine2).toBe("function");
      expect(typeof caller.joelleEngine.runEngine3).toBe("function");
      expect(typeof caller.joelleEngine.runEngine4).toBe("function");
      expect(typeof caller.joelleEngine.runEngine5).toBe("function");
      expect(typeof caller.joelleEngine.runEngine6).toBe("function");
      expect(typeof caller.joelleEngine.runEngine7).toBe("function");
      expect(typeof caller.joelleEngine.runEngine8).toBe("function");
      expect(typeof caller.joelleEngine.runEngine9).toBe("function");
      expect(typeof caller.joelleEngine.runEngine10).toBe("function");
      expect(typeof caller.joelleEngine.runEngine11).toBe("function");
      expect(typeof caller.joelleEngine.runEngine12).toBe("function");

      // Verify query procedures exist
      expect(typeof caller.joelleEngine.getStages).toBe("function");
      expect(typeof caller.joelleEngine.getReports).toBe("function");
      expect(typeof caller.joelleEngine.getStage).toBe("function");
      expect(typeof caller.joelleEngine.getReport).toBe("function");
      expect(typeof caller.joelleEngine.getStageDefinitions).toBe("function");
      expect(typeof caller.joelleEngine.getReportTypes).toBe("function");
      expect(typeof caller.joelleEngine.runAllEngines).toBe("function");
    });
  });
});
