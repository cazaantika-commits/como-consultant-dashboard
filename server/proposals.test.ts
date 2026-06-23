import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@como.ae",
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

describe("proposals router", () => {
  it("list returns an array (no filters)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const proposals = await caller.proposals.list({});
    expect(Array.isArray(proposals)).toBe(true);
  });

  it("list returns an array with projectId filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const proposals = await caller.proposals.list({ projectId: 1 });
    expect(Array.isArray(proposals)).toBe(true);
  });

  it("list returns an array with consultantId filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const proposals = await caller.proposals.list({ consultantId: 1 });
    expect(Array.isArray(proposals)).toBe(true);
  });

  it("getById returns null for non-existent proposal", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const proposal = await caller.proposals.getById({ id: 99999 });
    expect(proposal).toBeNull();
  });

  it("listComparisons returns an array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const comparisons = await caller.proposals.listComparisons({});
    expect(Array.isArray(comparisons)).toBe(true);
  });

  it("getComparisonById returns null for non-existent comparison", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const comparison = await caller.proposals.getComparisonById({ id: 99999 });
    expect(comparison).toBeNull();
  });

  it("compare rejects with less than 2 proposals", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.proposals.compare({
        title: "Test comparison",
        proposalIds: [1],
      })
    ).rejects.toThrow();
  });

  it("proposals list items have expected parsed fields when returned", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const proposals = await caller.proposals.list({});
    
    // If there are proposals, verify parsed fields exist
    for (const p of proposals) {
      expect(p).toHaveProperty("aiKeyPoints");
      expect(p).toHaveProperty("aiStrengths");
      expect(p).toHaveProperty("aiWeaknesses");
      expect(Array.isArray(p.aiKeyPoints)).toBe(true);
      expect(Array.isArray(p.aiStrengths)).toBe(true);
      expect(Array.isArray(p.aiWeaknesses)).toBe(true);
    }
  });
});
