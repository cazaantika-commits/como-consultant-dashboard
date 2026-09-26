import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const lifecycleSource = readFileSync("server/routers/lifecycle.ts", "utf8");
const stageDataSource = readFileSync("server/routers/stageData.ts", "utf8");
const legacyStagesSource = readFileSync("server/routers/stages.ts", "utf8");
const apiSource = readFileSync("server/lifecycleApiRoute.ts", "utf8");
const reportSource = readFileSync("server/complianceReport.ts", "utf8");
const proxySource = readFileSync("server/lifecycleDocumentRoute.ts", "utf8");
const serverSource = readFileSync("server/_core/index.ts", "utf8");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUnauthorizedContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 999_999_991,
    openId: "lifecycle-cross-project-test",
    email: "lifecycle-cross-project@example.com",
    name: "Cross Project Test",
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

describe("Lifecycle program and document security", () => {
  it("rejects cross-project lifecycle reads and writes on the real router", async () => {
    const caller = appRouter.createCaller(createUnauthorizedContext());
    await expect(caller.lifecycle.getProjectProgramState({ projectId: 4 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.lifecycle.upsertServiceInstance({ projectId: 4, serviceCode: "SRV-DES-CNSLT-APPT", stageCode: "STG-10", plannedStartDate: "2026-10-01", plannedDueDate: "2026-10-15" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.stageData.getDocuments({ projectId: 4, serviceCode: "SRV-DES-CNSLT-APPT" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires project access across lifecycle and stage-data project procedures", () => {
    expect((lifecycleSource.match(/requireProjectAccess\(/g) || []).length).toBeGreaterThanOrEqual(11);
    expect((stageDataSource.match(/requireProjectAccess\(/g) || []).length).toBeGreaterThanOrEqual(8);
    expect(lifecycleSource).toContain("requireLifecycleService");
    expect(lifecycleSource).toContain("requireLifecycleRequirement");
  });

  it("closes the legacy public stage writer and its automatic task side effects", () => {
    expect(legacyStagesSource).not.toContain("publicProcedure");
    expect((legacyStagesSource.match(/rejectLegacyStageWrite\(\);/g) || []).length).toBeGreaterThanOrEqual(8);
    expect(legacyStagesSource).toContain("/api/lifecycle/legacy-documents/");
  });

  it("authenticates HTTP lifecycle data and serves documents only through a project proxy", () => {
    expect(apiSource).toContain("sdk.authenticateRequest");
    expect(apiSource).toContain("requireProjectAccess");
    expect(apiSource).not.toContain("allow all requests");
    expect(reportSource).toContain("sdk.authenticateRequest");
    expect(reportSource).toContain("requireProjectAccess");
    expect(reportSource).not.toContain("doc.fileUrl");
    expect(proxySource).toContain("requireProjectAccess");
    expect(proxySource).toContain('Cache-Control", "private, no-store');
    expect(stageDataSource).toContain("downloadUrl");
    expect(stageDataSource).not.toContain("return { success: true, url }");
  });

  it("keeps lifecycle deadline automation disabled unless explicitly enabled", () => {
    expect(serverSource).toContain('process.env.COMO_LIFECYCLE_DEADLINE_SCHEDULER_ENABLED === "true"');
    expect(serverSource).toContain("[LifecycleScheduler] Disabled by COMO control policy");
  });
});
