import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importer = readFileSync(new URL("../scripts/comoFollowupImporter.ts", import.meta.url), "utf8");
const mapping = JSON.parse(readFileSync(new URL("../migration/como-followup-candidate-mapping.json", import.meta.url), "utf8"));
const summary = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-01/dry-run-summary.json", import.meta.url), "utf8"));
const conflicts = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-01/conflicts.json", import.meta.url), "utf8"));

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

  it("preserves target authority and isolates only the two real project decisions", () => {
    expect(mapping.approved).toBe(false);
    expect(mapping.users["1"]).toMatchObject({ targetId: 3330456, status: "confirmed" });
    expect(mapping.users["750001"]).toMatchObject({ targetId: 1, status: "confirmed" });
    expect(mapping.users["10680001"]).toMatchObject({ targetId: 1890097, status: "confirmed" });
    expect(mapping.projects["2"]).toMatchObject({ targetId: 6, status: "confirmed" });
    expect(conflicts.summary).toEqual({ total: 2, blocking: 1 });
    expect(conflicts.conflicts.map((conflict: { key: string }) => conflict.key)).toEqual(["projects:1", "projects:30001"]);
  });
});
