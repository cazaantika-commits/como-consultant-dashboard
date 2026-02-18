import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("profiles router", () => {
  it("should have listWithProfiles procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.listWithProfiles).toBeDefined();
  });

  it("should have getDetail procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.getDetail).toBeDefined();
  });

  it("should have upsertProfile procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.upsertProfile).toBeDefined();
  });

  it("should have addNote procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.addNote).toBeDefined();
  });

  it("should have updateNote procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.updateNote).toBeDefined();
  });

  it("should have deleteNote procedure defined", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.profiles.deleteNote).toBeDefined();
  });

  it("should validate note content is required", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Empty content should fail validation
    await expect(
      caller.profiles.addNote({
        consultantId: 1,
        content: "",
        category: "general",
      })
    ).rejects.toThrow();
  });

  it("should validate consultantId is a number for getDetail", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profiles.getDetail({ consultantId: "abc" as any })
    ).rejects.toThrow();
  });
});
