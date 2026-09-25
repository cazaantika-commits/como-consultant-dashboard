import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertActionTransition, deriveAttentionAt, toSqlUtcTimestamp } from "./services/comoNextCommands";

const migration = readFileSync(new URL("../drizzle/0077_como_next_executive_core.sql", import.meta.url), "utf8");

describe("COMO Next command invariants", () => {
  it("derives one canonical attention timestamp", () => {
    expect(deriveAttentionAt("2026-09-25T12:00:00.000Z", "2026-09-25T10:00:00.000Z")).toBe("2026-09-25 10:00:00");
    expect(deriveAttentionAt("2026-09-25T12:00:00.000Z", null)).toBe("2026-09-25 12:00:00");
    expect(toSqlUtcTimestamp(null)).toBeNull();
  });

  it("rejects invalid timestamps", () => {
    expect(() => toSqlUtcTimestamp("not-a-date")).toThrow(TRPCError);
  });

  it("allows verification only through the pending-verification state", () => {
    expect(() => assertActionTransition("completed_pending_verification", "verified")).not.toThrow();
    expect(() => assertActionTransition("open", "verified")).toThrow(TRPCError);
  });
});

describe("COMO Next additive migration", () => {
  it("creates exactly seven isolated COMO Next tables", () => {
    const tables = [...migration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]);
    expect(tables).toHaveLength(7);
    expect(tables.every(table => table.startsWith("como_next_"))).toBe(true);
  });

  it("does not alter or delete any existing schema or row", () => {
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
  });

  it("enforces project-scoped foreign keys and evidence checks", () => {
    expect(migration).toContain("FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files` (`project_id`,`id`)");
    expect(migration).toContain("FOREIGN KEY (`project_id`,`project_party_id`) REFERENCES `como_next_project_parties` (`project_id`,`id`)");
    expect(migration).toContain("`action_status` <> 'verified' OR `evidence_reference` IS NOT NULL");
    expect(migration).toContain("`work_file_status` <> 'closed' OR `closure_evidence_ref` IS NOT NULL");
  });
});
