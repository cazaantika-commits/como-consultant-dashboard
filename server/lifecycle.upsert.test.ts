import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for the upsertServiceInstance server-side logic.
 *
 * The critical bug was: when only `operationalStatus` was sent (e.g. status
 * cycling), the mutation would overwrite `plannedStartDate` / `plannedDueDate`
 * with `undefined` → `NULL`, wiping existing dates.
 *
 * The fix: only include date fields in the update `data` object when they are
 * explicitly provided (not `undefined`).
 */

// We test the data-building logic in isolation rather than hitting the DB.
// This mirrors the exact logic in server/routers/lifecycle.ts upsertServiceInstance.

function buildUpsertData(input: {
  projectId: number;
  serviceCode: string;
  stageCode: string;
  plannedStartDate?: string;
  plannedDueDate?: string;
  actualStartDate?: string;
  actualCloseDate?: string;
  notes?: string;
  operationalStatus?: string;
}): Record<string, any> {
  const data: Record<string, any> = {
    projectId: input.projectId,
    serviceCode: input.serviceCode,
    stageCode: input.stageCode,
  };
  if (input.plannedStartDate !== undefined) data.plannedStartDate = input.plannedStartDate;
  if (input.plannedDueDate !== undefined) data.plannedDueDate = input.plannedDueDate;
  if (input.actualStartDate !== undefined) data.actualStartDate = input.actualStartDate;
  if (input.actualCloseDate !== undefined) data.actualCloseDate = input.actualCloseDate;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.operationalStatus) data.operationalStatus = input.operationalStatus;
  return data;
}

describe("upsertServiceInstance data builder", () => {
  it("includes date fields when explicitly provided", () => {
    const data = buildUpsertData({
      projectId: 1,
      serviceCode: "SRV-DEV-REG",
      stageCode: "STG-DEV-REG",
      plannedStartDate: "2026-03-10",
      plannedDueDate: "2026-05-10",
      operationalStatus: "in_progress",
    });

    expect(data.plannedStartDate).toBe("2026-03-10");
    expect(data.plannedDueDate).toBe("2026-05-10");
    expect(data.operationalStatus).toBe("in_progress");
  });

  it("does NOT include date fields when they are undefined (status-only update)", () => {
    // This is the critical test: when cycleStatus only sends operationalStatus
    // without dates, the data object should NOT contain date keys at all.
    const data = buildUpsertData({
      projectId: 1,
      serviceCode: "SRV-DEV-REG",
      stageCode: "STG-DEV-REG",
      operationalStatus: "completed",
      // No date fields provided — simulates cycleStatus
    });

    expect(data).not.toHaveProperty("plannedStartDate");
    expect(data).not.toHaveProperty("plannedDueDate");
    expect(data).not.toHaveProperty("actualStartDate");
    expect(data).not.toHaveProperty("actualCloseDate");
    expect(data).not.toHaveProperty("notes");
    expect(data.operationalStatus).toBe("completed");
    expect(data.projectId).toBe(1);
    expect(data.serviceCode).toBe("SRV-DEV-REG");
    expect(data.stageCode).toBe("STG-DEV-REG");
  });

  it("includes notes when explicitly provided", () => {
    const data = buildUpsertData({
      projectId: 2,
      serviceCode: "SRV-PROJ-REG",
      stageCode: "STG-PROJ-REG",
      notes: "Some notes here",
    });

    expect(data.notes).toBe("Some notes here");
    expect(data).not.toHaveProperty("plannedStartDate");
    expect(data).not.toHaveProperty("operationalStatus");
  });

  it("allows explicit empty string for dates (clearing a date)", () => {
    const data = buildUpsertData({
      projectId: 1,
      serviceCode: "SRV-DEV-REG",
      stageCode: "STG-DEV-REG",
      plannedStartDate: "",
      plannedDueDate: "",
    });

    // Empty strings should be included (user explicitly cleared the date)
    expect(data).toHaveProperty("plannedStartDate");
    expect(data).toHaveProperty("plannedDueDate");
    expect(data.plannedStartDate).toBe("");
    expect(data.plannedDueDate).toBe("");
  });

  it("includes all fields when a full save is performed", () => {
    const data = buildUpsertData({
      projectId: 3,
      serviceCode: "SRV-DESIGN",
      stageCode: "STG-DESIGN",
      plannedStartDate: "2026-04-01",
      plannedDueDate: "2026-08-22",
      actualStartDate: "2026-04-05",
      actualCloseDate: "2026-08-20",
      notes: "Design phase complete",
      operationalStatus: "completed",
    });

    expect(data.plannedStartDate).toBe("2026-04-01");
    expect(data.plannedDueDate).toBe("2026-08-22");
    expect(data.actualStartDate).toBe("2026-04-05");
    expect(data.actualCloseDate).toBe("2026-08-20");
    expect(data.notes).toBe("Design phase complete");
    expect(data.operationalStatus).toBe("completed");
  });
});
