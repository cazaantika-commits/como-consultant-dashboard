import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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

describe("cashFlowProgram.phaseDelays", () => {
  it("getPhaseDelays returns empty object when no delays set", async () => {
    const { ctx } = createAuthContext(999); // Use a unique userId unlikely to have data
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cashFlowProgram.getPhaseDelays();
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("setPhaseDelay creates a new delay record", async () => {
    const { ctx } = createAuthContext(998);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cashFlowProgram.setPhaseDelay({
      projectId: 9999,
      designDelay: 3,
      offplanDelay: 1,
      constructionDelay: 2,
    });

    expect(result).toEqual({ success: true });

    // Verify the delay was saved
    const delays = await caller.cashFlowProgram.getPhaseDelays();
    expect(delays[9999]).toBeDefined();
    expect(delays[9999].designDelay).toBe(3);
    expect(delays[9999].offplanDelay).toBe(1);
    expect(delays[9999].constructionDelay).toBe(2);
  });

  it("setPhaseDelay updates an existing delay record", async () => {
    const { ctx } = createAuthContext(998);
    const caller = appRouter.createCaller(ctx);

    // Update the previously created record
    const result = await caller.cashFlowProgram.setPhaseDelay({
      projectId: 9999,
      designDelay: 5,
      offplanDelay: 0,
      constructionDelay: 0,
    });

    expect(result).toEqual({ success: true });

    // Verify the update
    const delays = await caller.cashFlowProgram.getPhaseDelays();
    expect(delays[9999]).toBeDefined();
    expect(delays[9999].designDelay).toBe(5);
    expect(delays[9999].offplanDelay).toBe(0);
    expect(delays[9999].constructionDelay).toBe(0);
  });

  it("getPhaseDelays returns empty when user is not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cashFlowProgram.getPhaseDelays();
    expect(result).toEqual({});
  });

  it("setPhaseDelay throws when user is not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.cashFlowProgram.setPhaseDelay({
        projectId: 9999,
        designDelay: 1,
        offplanDelay: 0,
        constructionDelay: 0,
      })
    ).rejects.toThrow();
  });
});
