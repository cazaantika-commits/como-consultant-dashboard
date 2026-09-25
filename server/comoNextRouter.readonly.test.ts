import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { comoNextRouter } from "./routers/comoNext";

function context(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `como-next-test-${userId}`,
      email: `como-next-${userId}@example.com`,
      name: "COMO Next Test",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("COMO Next read-only router", () => {
  it("returns only the authenticated user's official projects", async () => {
    const caller = comoNextRouter.createCaller(context(1));
    const projects = await caller.listProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.some(project => project.name.includes("المشروع التجريبي"))).toBe(false);
  });

  it("does not expose another user's projects or work files", async () => {
    const caller = comoNextRouter.createCaller(context(999_999_999));
    expect(await caller.listProjects()).toEqual([]);
    const overview = await caller.getOverview();
    expect(overview.workFiles).toEqual([]);
    expect(overview.decisions).toEqual([]);
    expect(overview.today.summary.dueToday).toBe(0);
  });

  it("exposes the imported required decision only inside its authorized work file", async () => {
    const caller = comoNextRouter.createCaller(context(1));
    const overview = await caller.getOverview();
    expect(overview.decisions).toHaveLength(1);
    expect(overview.decisions[0]).toMatchObject({
      decisionStatus: "required",
      decisionAuthority: "abdulrahman",
      projectId: 1,
    });
    const detail = await caller.getWorkFile({ workFileId: overview.decisions[0].workFileId });
    expect(detail.decisions.some(decision => decision.id === overview.decisions[0].id)).toBe(true);
  });

  it("exposes the completed transfer review to the system owner", async () => {
    const caller = comoNextRouter.createCaller(context(1));
    const review = await caller.getImportReview();
    expect(review.available).toBe(true);
    if (!review.available) return;
    expect(review.batch).toMatchObject({
      batchId: "COMO-FUD-2026-09-25-02",
      batchStatus: "promoted",
      sourceRecordCount: 1193,
      stagedRecordCount: 1163,
      skippedRecordCount: 29,
      stagedFileCount: 87,
    });
    expect(review.projects.find(project => project.sourceRecordId === "1")).toMatchObject({ targetId: 1, stageStatus: "staged" });
    expect(review.projects.find(project => project.sourceRecordId === "30001")).toMatchObject({ targetId: null, stageStatus: "skipped" });
    expect(review.promotion).toMatchObject({ workFiles: 11, actions: 78, decisions: 1, memoryEntries: 147, meetings: 4, documentsStored: 34, documentLinks: 37, documentChunks: 20 });
    expect(review.safeguards).toEqual({ operationalRecordsPromoted: 1100, externalSideEffects: 0, secretsImported: 0 });
  });
});
