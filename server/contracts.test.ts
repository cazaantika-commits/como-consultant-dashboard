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

describe("contracts router", () => {
  it("listTypes returns an array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const types = await caller.contracts.listTypes();
    expect(Array.isArray(types)).toBe(true);
  });

  it("list returns an array with optional filters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const contracts = await caller.contracts.list({});
    expect(Array.isArray(contracts)).toBe(true);
  });

  it("stats returns expected shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.contracts.stats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("analyzed");
    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("expired");
    expect(typeof stats.total).toBe("number");
  });

  it("seedDefaultTypes creates types and returns message", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.contracts.seedDefaultTypes();
    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("count");
    expect(result.count).toBeGreaterThanOrEqual(0);
  }, 30000);

  it("addType creates a new contract type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.contracts.addType({
      name: "عقد اختبار",
      nameEn: "Test Contract",
      code: "TST",
      category: "other",
      description: "عقد للاختبار فقط",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("listTypes includes the newly added type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const types = await caller.contracts.listTypes();
    const testType = types.find((t: any) => t.code === "TST");
    expect(testType).toBeDefined();
    expect(testType?.name).toBe("عقد اختبار");
  });
});
