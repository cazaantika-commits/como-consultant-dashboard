import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import {
  lifecycleStages,
  lifecycleServices,
  lifecycleRequirements,
  projectServiceInstances,
  projectRequirementStatus,
  projectStageStatus,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Lifecycle DB integration tests
// ─────────────────────────────────────────────────────────────

const TEST_PROJECT_ID = 99999; // Fake project ID for tests

describe("Lifecycle DB tables", () => {
  afterAll(async () => {
    // Cleanup test data
    const db = await getDb();
    await db
      .delete(projectRequirementStatus)
      .where(eq(projectRequirementStatus.projectId, TEST_PROJECT_ID));
    await db
      .delete(projectServiceInstances)
      .where(eq(projectServiceInstances.projectId, TEST_PROJECT_ID));
    await db
      .delete(projectStageStatus)
      .where(eq(projectStageStatus.projectId, TEST_PROJECT_ID));
  });

  it("should have at least 5 lifecycle stages seeded", async () => {
    const db = await getDb();
    const stages = await db.select().from(lifecycleStages);
    expect(stages.length).toBeGreaterThanOrEqual(5);
  });

  it("should have STG-02 stage with correct name", async () => {
    const db = await getDb();
    const [stg02] = await db
      .select()
      .from(lifecycleStages)
      .where(eq(lifecycleStages.stageCode, "STG-02"));
    expect(stg02).toBeDefined();
    expect(stg02.nameAr).toContain("تسجيل");
  });

  it("should have at least 4 services for STG-02", async () => {
    const db = await getDb();
    const services = await db
      .select()
      .from(lifecycleServices)
      .where(eq(lifecycleServices.stageCode, "STG-02"));
    expect(services.length).toBeGreaterThanOrEqual(4);
  });

  it("should have requirements for SRV-RERA-PROJ-REG", async () => {
    const db = await getDb();
    const reqs = await db
      .select()
      .from(lifecycleRequirements)
      .where(eq(lifecycleRequirements.serviceCode, "SRV-RERA-PROJ-REG"));
    expect(reqs.length).toBeGreaterThan(0);
  });

  it("should have mandatory requirements in SRV-RERA-PROJ-REG", async () => {
    const db = await getDb();
    const reqs = await db
      .select()
      .from(lifecycleRequirements)
      .where(eq(lifecycleRequirements.serviceCode, "SRV-RERA-PROJ-REG"));
    const mandatory = reqs.filter((r) => r.isMandatory === 1);
    expect(mandatory.length).toBeGreaterThan(0);
  });

  it("should insert and retrieve a project stage status", async () => {
    const db = await getDb();
    await db.insert(projectStageStatus).values({
      projectId: TEST_PROJECT_ID,
      stageCode: "STG-02",
      status: "in_progress",
    });
    const [result] = await db
      .select()
      .from(projectStageStatus)
      .where(
        and(
          eq(projectStageStatus.projectId, TEST_PROJECT_ID),
          eq(projectStageStatus.stageCode, "STG-02")
        )
      );
    expect(result.status).toBe("in_progress");
  });

  it("should insert and retrieve a requirement status", async () => {
    const db = await getDb();
    await db.insert(projectRequirementStatus).values({
      projectId: TEST_PROJECT_ID,
      serviceCode: "SRV-RERA-PROJ-REG",
      requirementCode: "TEST-REQ-001",
      status: "completed",
      notes: "Test note",
    });
    const [result] = await db
      .select()
      .from(projectRequirementStatus)
      .where(
        and(
          eq(projectRequirementStatus.projectId, TEST_PROJECT_ID),
          eq(projectRequirementStatus.serviceCode, "SRV-RERA-PROJ-REG"),
          eq(projectRequirementStatus.requirementCode, "TEST-REQ-001")
        )
      );
    expect(result.status).toBe("completed");
    expect(result.notes).toBe("Test note");
  });

  it("should have both document and data type requirements", async () => {
    const db = await getDb();
    const reqs = await db.select().from(lifecycleRequirements);
    const docReqs = reqs.filter((r) => r.reqType === "document");
    const dataReqs = reqs.filter((r) => r.reqType === "data");
    expect(docReqs.length).toBeGreaterThan(0);
    expect(dataReqs.length).toBeGreaterThan(0);
  });

  it("should have total of at least 20 requirements across all services", async () => {
    const db = await getDb();
    const reqs = await db.select().from(lifecycleRequirements);
    expect(reqs.length).toBeGreaterThanOrEqual(20);
  });
});
