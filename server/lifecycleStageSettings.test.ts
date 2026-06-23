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
  it("getAllStages returns all stages including inactive", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stages = await caller.lifecycle.getAllStages();
    expect(Array.isArray(stages)).toBe(true);
    // Should have at least 7 seeded stages
    expect(stages.length).toBeGreaterThanOrEqual(7);
    // Each stage should have required fields
    for (const stage of stages) {
      expect(stage).toHaveProperty("id");
      expect(stage).toHaveProperty("stageCode");
      expect(stage).toHaveProperty("nameAr");
      expect(stage).toHaveProperty("sortOrder");
      expect(stage).toHaveProperty("isActive");
    }
  });

  it("getStages returns only active stages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stages = await caller.lifecycle.getStages();
    expect(Array.isArray(stages)).toBe(true);
    // All returned stages should be active
    for (const stage of stages) {
      expect(stage.isActive).toBe(1);
    }
  });

  it("getStages returns stages in sortOrder", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stages = await caller.lifecycle.getStages();
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].sortOrder).toBeGreaterThanOrEqual(stages[i - 1].sortOrder);
    }
  });

  it("createStage creates a new stage with correct fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lifecycle.createStage({
      nameAr: "مرحلة اختبارية",
      nameEn: "Test Stage",
      category: "Test",
    });
    expect(result.success).toBe(true);
    expect(result.stageCode).toMatch(/^STG-CUSTOM-/);

    // Verify it appears in getAllStages
    const allStages = await caller.lifecycle.getAllStages();
    const created = allStages.find((s) => s.stageCode === result.stageCode);
    expect(created).toBeDefined();
    expect(created?.nameAr).toBe("مرحلة اختبارية");
    expect(created?.nameEn).toBe("Test Stage");
    expect(created?.category).toBe("Test");
    expect(created?.isActive).toBe(1);

    // Cleanup: deactivate the created stage
    await caller.lifecycle.updateStage({ id: created!.id, isActive: 0 });
  });

  it("updateStage updates nameAr and nameEn", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a stage to update
    const createResult = await caller.lifecycle.createStage({
      nameAr: "مرحلة للتعديل",
      nameEn: "Stage to Edit",
    });
    const allStages = await caller.lifecycle.getAllStages();
    const stage = allStages.find((s) => s.stageCode === createResult.stageCode);
    expect(stage).toBeDefined();

    // Update it
    const updateResult = await caller.lifecycle.updateStage({
      id: stage!.id,
      nameAr: "مرحلة معدّلة",
      nameEn: "Edited Stage",
    });
    expect(updateResult.success).toBe(true);

    // Verify update
    const updatedStages = await caller.lifecycle.getAllStages();
    const updated = updatedStages.find((s) => s.id === stage!.id);
    expect(updated?.nameAr).toBe("مرحلة معدّلة");
    expect(updated?.nameEn).toBe("Edited Stage");

    // Cleanup
    await caller.lifecycle.updateStage({ id: stage!.id, isActive: 0 });
  });

  it("updateStage can toggle isActive", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a stage
    const createResult = await caller.lifecycle.createStage({ nameAr: "مرحلة للإيقاف" });
    const allStages = await caller.lifecycle.getAllStages();
    const stage = allStages.find((s) => s.stageCode === createResult.stageCode);
    expect(stage?.isActive).toBe(1);

    // Deactivate
    await caller.lifecycle.updateStage({ id: stage!.id, isActive: 0 });
    const afterDeactivate = await caller.lifecycle.getAllStages();
    const deactivated = afterDeactivate.find((s) => s.id === stage!.id);
    expect(deactivated?.isActive).toBe(0);

    // Verify it doesn't appear in getStages (active only)
    const activeStages = await caller.lifecycle.getStages();
    const notInActive = activeStages.find((s) => s.id === stage!.id);
    expect(notInActive).toBeUndefined();

    // Reactivate
    await caller.lifecycle.updateStage({ id: stage!.id, isActive: 1 });
    const afterReactivate = await caller.lifecycle.getAllStages();
    const reactivated = afterReactivate.find((s) => s.id === stage!.id);
    expect(reactivated?.isActive).toBe(1);

    // Cleanup
    await caller.lifecycle.updateStage({ id: stage!.id, isActive: 0 });
  });

  it("reorderStages swaps sortOrder between two stages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stages = await caller.lifecycle.getAllStages();
    const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
    // Take first two stages
    const first = sorted[0];
    const second = sorted[1];
    if (!first || !second) return;

    const originalFirstOrder = first.sortOrder;
    const originalSecondOrder = second.sortOrder;

    // Swap
    await caller.lifecycle.reorderStages({
      stages: [
        { id: first.id, sortOrder: originalSecondOrder },
        { id: second.id, sortOrder: originalFirstOrder },
      ],
    });

    // Verify swap
    const afterSwap = await caller.lifecycle.getAllStages();
    const swappedFirst = afterSwap.find((s) => s.id === first.id);
    const swappedSecond = afterSwap.find((s) => s.id === second.id);
    expect(swappedFirst?.sortOrder).toBe(originalSecondOrder);
    expect(swappedSecond?.sortOrder).toBe(originalFirstOrder);

    // Restore original order
    await caller.lifecycle.reorderStages({
      stages: [
        { id: first.id, sortOrder: originalFirstOrder },
        { id: second.id, sortOrder: originalSecondOrder },
      ],
    });
  });
});
