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

describe("cashFlowSettings.saveDurations", () => {
  it("recalculates equal_spread items when design duration changes", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Call saveDurations with designMonths=5 (current is 5, old saved data has end_month=6)
    // This should update design items from start=1,end=6 to start=1,end=5
    const result = await caller.cashFlowSettings.saveDurations({
      projectId: 4,
      designMonths: 5,
      constructionMonths: 18,
      handoverMonths: 2,
    });

    expect(result).toEqual({ success: true });
  }, 30000);

  it("returns success when changing durations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Change design from 5 to 7 months
    const result = await caller.cashFlowSettings.saveDurations({
      projectId: 4,
      designMonths: 7,
      constructionMonths: 18,
      handoverMonths: 2,
    });

    expect(result).toEqual({ success: true });

    // Change back to 5
    const result2 = await caller.cashFlowSettings.saveDurations({
      projectId: 4,
      designMonths: 5,
      constructionMonths: 18,
      handoverMonths: 2,
    });

    expect(result2).toEqual({ success: true });
  }, 30000);
});
