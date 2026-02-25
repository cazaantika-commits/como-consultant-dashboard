import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
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

describe("activityMonitor router", () => {
  // ─── Activity Log ───
  describe("getActivityLog", () => {
    it("returns activity log with activities array and total count", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getActivityLog({
        limit: 10,
        offset: 0,
      });
      expect(result).toHaveProperty("activities");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.activities)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("accepts agentName filter", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getActivityLog({
        agentName: "salwa",
        limit: 5,
      });
      expect(result).toHaveProperty("activities");
      expect(Array.isArray(result.activities)).toBe(true);
    });

    it("accepts since date filter", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getActivityLog({
        since: new Date(Date.now() - 86400000).toISOString(),
        limit: 5,
      });
      expect(result).toHaveProperty("activities");
    });
  });

  // ─── Agent Stats ───
  describe("getAgentStats", () => {
    it("returns an array of agent stats", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getAgentStats({});
      expect(Array.isArray(result)).toBe(true);
      // Each item should have agentName, totalActions, successCount, failureCount
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("agentName");
        expect(first).toHaveProperty("totalActions");
        expect(first).toHaveProperty("successCount");
        expect(first).toHaveProperty("failureCount");
        expect(first).toHaveProperty("avgDurationMs");
      }
    });

    it("accepts optional since parameter", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getAgentStats({
        since: new Date(Date.now() - 3600000).toISOString(),
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Document Index Stats ───
  describe("getIndexStats", () => {
    it("returns index statistics with byType and byAgent arrays", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getIndexStats();
      // Can be null if DB not available
      if (result) {
        expect(result).toHaveProperty("totalDocs");
        expect(result).toHaveProperty("byType");
        expect(result).toHaveProperty("byAgent");
        expect(Array.isArray(result.byType)).toBe(true);
        expect(Array.isArray(result.byAgent)).toBe(true);
      }
    });
  });

  // ─── Document Search ───
  describe("searchDocuments", () => {
    it("returns an array of matching documents", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.searchDocuments({
        query: "test",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("accepts category and fileType filters", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.searchDocuments({
        query: "consultant",
        category: "evaluation",
        fileType: "pdf",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Knowledge Stats ───
  describe("getKnowledgeStats", () => {
    it("returns knowledge statistics with byDomain array and totals", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getKnowledgeStats();
      if (result) {
        expect(result).toHaveProperty("byDomain");
        expect(result).toHaveProperty("totalEntries");
        expect(result).toHaveProperty("totalUses");
        expect(Array.isArray(result.byDomain)).toBe(true);
      }
    });
  });

  // ─── Knowledge Search ───
  describe("searchKnowledge", () => {
    it("returns matching knowledge entries", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.searchKnowledge({
        query: "RERA",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("title");
        expect(first).toHaveProperty("domain");
        expect(first).toHaveProperty("content");
      }
    });

    it("accepts domain filter", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.searchKnowledge({
        query: "قانون",
        domain: "rera_law",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Knowledge by Domain ───
  describe("getKnowledgeByDomain", () => {
    it("returns knowledge entries for a specific domain", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.getKnowledgeByDomain({
        domain: "como_context",
        limit: 10,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Seed Knowledge ───
  describe("seedKnowledge", () => {
    it("seeds the knowledge base and returns success/failed counts", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.seedKnowledge();
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("number");
      expect(result.success).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty("failed");
      expect(typeof result.failed).toBe("number");
      expect(result).toHaveProperty("errors");
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // ─── Add Knowledge ───
  describe("addKnowledge", () => {
    it("adds a new knowledge entry", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.activityMonitor.addKnowledge({
        domain: "general",
        category: "test",
        title: "Test Knowledge Entry",
        content: "This is a test knowledge entry for vitest",
        keywords: ["test", "vitest"],
        source: "automated_test",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });
  });
});
