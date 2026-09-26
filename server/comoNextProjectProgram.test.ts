import { describe, expect, it } from "vitest";
import {
  deriveProjectProgramState,
  hashProgramValue,
  inspectProgramSources,
  normalizeProgramDate,
  PROJECT_PROGRAM_SCHEMA_VERSION,
} from "./services/comoNextProjectProgram";

const definitions = [
  { serviceCode: "SRV-A", stageCode: "STG-01" },
  { serviceCode: "SRV-B", stageCode: "STG-02" },
];

const completeRows = [
  { projectId: 4, serviceCode: "SRV-B", stageCode: "STG-02", plannedStartDate: "10-Sep-26", plannedDueDate: "2026-10-15" },
  { projectId: 4, serviceCode: "SRV-A", stageCode: "STG-01", plannedStartDate: "2026-08-01", plannedDueDate: "31-08-2026" },
];

function approved(source: ReturnType<typeof inspectProgramSources>, overrides: Record<string, unknown> = {}) {
  return {
    id: 91,
    decisionStatus: "approved" as const,
    sourceSchemaVersion: PROJECT_PROGRAM_SCHEMA_VERSION,
    programHash: source.programHash,
    serviceCount: source.serviceCount,
    stageCount: source.stageCount,
    earliestStartDate: source.earliestStartDate,
    latestDueDate: source.latestDueDate,
    notes: null,
    decidedAt: "2026-09-26 12:00:00",
    ...overrides,
  };
}

describe("COMO Next project program governance", () => {
  it("normalizes supported dates and rejects impossible calendar values", () => {
    expect(normalizeProgramDate("2026-09-07")).toBe("2026-09-07");
    expect(normalizeProgramDate("07-09-2026")).toBe("2026-09-07");
    expect(normalizeProgramDate("7-Sep-26")).toBe("2026-09-07");
    expect(normalizeProgramDate("31-02-2026")).toBeNull();
    expect(normalizeProgramDate("NULL")).toBeNull();
  });

  it("builds a stable full-set hash independent of source row order", () => {
    const first = inspectProgramSources(completeRows, definitions);
    const second = inspectProgramSources([...completeRows].reverse(), definitions);
    expect(first.isSourceComplete).toBe(true);
    expect(first.programHash).toBe(second.programHash);
    expect(first.serviceCount).toBe(2);
    expect(first.stageCount).toBe(2);
    expect(first.earliestStartDate).toBe("2026-08-01");
    expect(first.latestDueDate).toBe("2026-10-15");
    expect(hashProgramValue(first.snapshot)).toBe(first.programHash);
  });

  it("requires every selected service to have a valid ordered date pair", () => {
    const missing = inspectProgramSources([{ ...completeRows[0], plannedStartDate: null }], definitions);
    expect(missing.isSourceComplete).toBe(false);
    expect(missing.issues).toContainEqual({ serviceCode: "SRV-B", reason: "missing_start" });

    const reversed = inspectProgramSources([{ ...completeRows[0], plannedStartDate: "2026-11-01" }], definitions);
    expect(reversed.isSourceComplete).toBe(false);
    expect(reversed.issues).toContainEqual({ serviceCode: "SRV-B", reason: "start_after_due" });
  });

  it("rejects unknown services and stage mismatches", () => {
    const source = inspectProgramSources([
      { ...completeRows[0], stageCode: "STG-01" },
      { projectId: 4, serviceCode: "SRV-X", stageCode: "STG-09", plannedStartDate: "2026-08-01", plannedDueDate: "2026-08-02" },
    ], definitions);
    expect(source.isSourceComplete).toBe(false);
    expect(source.issues.map(issue => issue.reason)).toEqual(expect.arrayContaining(["stage_mismatch", "unknown_service"]));
  });

  it("keeps a complete program blocked until owner approval", () => {
    const source = inspectProgramSources(completeRows, definitions);
    const state = deriveProjectProgramState({ source, approvals: [] });
    expect(state.status).toBe("no_approved_program");
    expect(state.isValid).toBe(false);
  });

  it("treats only a matching latest approval as current", () => {
    const source = inspectProgramSources(completeRows, definitions);
    const state = deriveProjectProgramState({ source, approvals: [approved(source)] });
    expect(state.status).toBe("current_valid");
    expect(state.isValid).toBe(true);
  });

  it("invalidates historical approval after any service or date change", () => {
    const approvedSource = inspectProgramSources(completeRows, definitions);
    const changedSource = inspectProgramSources([
      completeRows[0],
      { ...completeRows[1], plannedDueDate: "2026-09-01" },
    ], definitions);
    const state = deriveProjectProgramState({ source: changedSource, approvals: [approved(approvedSource)] });
    expect(state.status).toBe("needs_reapproval");
    expect(state.isValid).toBe(false);
  });

  it("lets a later review or rejection supersede an older approval", () => {
    const source = inspectProgramSources(completeRows, definitions);
    const latestReview = { ...approved(source), id: 92, decisionStatus: "reviewed" as const, decidedAt: "2026-09-27 12:00:00" };
    const state = deriveProjectProgramState({ source, approvals: [latestReview, approved(source)] });
    expect(state.status).toBe("no_approved_program");
    expect(state.isValid).toBe(false);
  });
});
