import { describe, expect, it } from "vitest";
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
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("lifecycle stage settings", () => {
  it("getAllStages returns the preserved lifecycle catalogue", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stages = await caller.lifecycle.getAllStages();
    expect(Array.isArray(stages)).toBe(true);
    expect(stages.length).toBeGreaterThanOrEqual(9);
    for (const stage of stages) {
      expect(stage).toHaveProperty("id");
      expect(stage).toHaveProperty("stageCode");
      expect(stage).toHaveProperty("nameAr");
      expect(stage).toHaveProperty("sortOrder");
      expect(stage).toHaveProperty("isActive");
    }
  });

  it("getStages returns only active stages", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stages = await caller.lifecycle.getStages();
    expect(Array.isArray(stages)).toBe(true);
    for (const stage of stages) expect(stage.isActive).toBe(1);
  });

  it("getStages returns stages in sortOrder", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stages = await caller.lifecycle.getStages();
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].sortOrder).toBeGreaterThanOrEqual(stages[i - 1].sortOrder);
    }
  });

  it("default-denies creation of unscoped global lifecycle stages", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.lifecycle.createStage({
      nameAr: "مرحلة اختبارية لا يجوز إنشاؤها",
      nameEn: "Blocked test stage",
      category: "Test",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("default-denies unscoped lifecycle stage edits", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.lifecycle.updateStage({ id: 1, nameAr: "تعديل محظور" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("default-denies global lifecycle stage reordering", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.lifecycle.reorderStages({ stages: [{ id: 1, sortOrder: 999 }] }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
