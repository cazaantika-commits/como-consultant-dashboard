import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importer = readFileSync(new URL("../scripts/comoFollowupImporter.ts", import.meta.url), "utf8");
const stageLoader = readFileSync(new URL("../scripts/comoFollowupStage.ts", import.meta.url), "utf8");
const stageMigration = readFileSync(new URL("../drizzle/0078_como_next_transfer_staging.sql", import.meta.url), "utf8");
const mapping = JSON.parse(readFileSync(new URL("../migration/como-followup-candidate-mapping.json", import.meta.url), "utf8"));
const summary = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/dry-run-summary.json", import.meta.url), "utf8"));
const conflicts = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/conflicts.json", import.meta.url), "utf8"));
const stageResult = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/STAGE_RESULT.json", import.meta.url), "utf8"));

describe("Follow-up Desk importer safety boundary", () => {
  it("supports plan and dry-run only", () => {
    expect(importer).toContain('["plan", "dry-run"].includes(mode)');
    expect(importer).toContain("apply/rollback are intentionally disabled");
    expect(importer).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+[`A-Za-z]|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i);
  });

  it("rejects exported secrets and records zero side effects", () => {
    expect(importer).toContain('sourceTables.get("integrationSecrets")');
    expect(importer).toContain("Secret records are present in the export; dry-run stopped");
    expect(summary.writesExecuted).toBe(0);
    expect(summary.externalSideEffects).toBe(0);
    expect(summary.excludedSecretCount).toBe(1);
  });

  it("reconciles every exported record and verifies the file manifest", () => {
    expect(summary.sourceTableCount).toBe(23);
    expect(summary.sourceCount).toBe(1193);
    expect(summary.exportedRecordCount).toBe(1192);
    expect(summary.plannedRowCount).toBe(1192);
    expect(summary.manifestEntries).toBe(87);
    expect(summary.exportedFilesVerified).toBe(80);
    expect(summary.uniqueFilePayloads).toBe(71);
    expect(summary.sourceDuplicateFileReferences).toBe(9);
  });

  it("preserves target authority and records both approved project decisions", () => {
    expect(mapping.approved).toBe(true);
    expect(mapping.users["1"]).toMatchObject({ targetId: 3330456, status: "confirmed" });
    expect(mapping.users["750001"]).toMatchObject({ targetId: 1, status: "confirmed" });
    expect(mapping.users["10680001"]).toMatchObject({ targetId: 1890097, status: "confirmed" });
    expect(mapping.projects["1"]).toMatchObject({ targetId: 1, status: "confirmed" });
    expect(mapping.projects["2"]).toMatchObject({ targetId: 6, status: "confirmed" });
    expect(mapping.projects["30001"]).toMatchObject({ targetId: null, status: "exclude_temporarily" });
    expect(conflicts.summary).toEqual({ total: 0, blocking: 0 });
    expect(summary.readyForApply).toBe(true);
  });

  it("permits writes only to the three isolated staging tables", () => {
    const insertTargets = [...stageLoader.matchAll(/INSERT INTO ([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    const updateTargets = [...stageLoader.matchAll(/UPDATE ([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    expect(new Set(insertTargets)).toEqual(new Set(["como_next_import_batches", "como_next_import_rows", "como_next_import_files"]));
    expect(new Set(updateTargets)).toEqual(new Set(["como_next_import_batches"]));
    expect(stageLoader).not.toMatch(/storagePut|notifyOwner|sendMail|invokeLLM|createTask|schedule/i);
    expect(stageMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect([...stageMigration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_import_batches",
      "como_next_import_rows",
      "como_next_import_files",
    ]);
  });

  it("reconciles the staged batch without promoting operational records", () => {
    expect(stageResult).toMatchObject({
      batchStatus: "staged",
      sourceRecordCount: 1193,
      stagedRecordCount: 1163,
      skippedRecordCount: 29,
      stagedFileCount: 87,
      actualRowCount: 1192,
      actualFileCount: 87,
      uniqueFilePayloads: 71,
      operationalRecordsPromoted: 0,
      externalSideEffects: 0,
      reversibleByBatchDelete: true,
    });
    expect(stageResult.writesLimitedTo).toEqual([
      "como_next_import_batches",
      "como_next_import_rows",
      "como_next_import_files",
    ]);
  });
});
