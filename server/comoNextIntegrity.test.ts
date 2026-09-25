import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertActionTransition, deriveAttentionAt, toSqlUtcTimestamp } from "./services/comoNextCommands";

const migration = readFileSync(new URL("../drizzle/0077_como_next_executive_core.sql", import.meta.url), "utf8");
const decisionMigration = readFileSync(new URL("../drizzle/0082_como_next_decision_register.sql", import.meta.url), "utf8");
const communicationMigration = readFileSync(new URL("../drizzle/0083_como_next_communications.sql", import.meta.url), "utf8");
const meetingMigration = readFileSync(new URL("../drizzle/0084_como_next_meeting_workspace.sql", import.meta.url), "utf8");
const meetingMetadataMigration = readFileSync(new URL("../drizzle/0085_como_next_meeting_proposal_metadata.sql", import.meta.url), "utf8");
const commandSource = readFileSync(new URL("./services/comoNextCommands.ts", import.meta.url), "utf8");

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

  it("adds the decision register without altering legacy or financial tables", () => {
    expect(decisionMigration).toContain("CREATE TABLE IF NOT EXISTS `como_next_decisions`");
    expect(decisionMigration).toContain("FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files` (`project_id`,`id`)");
    expect(decisionMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(commandSource).toContain("لا يمكن إغلاق الملف قبل حسم القرارات المطلوبة");
  });

  it("adds a project-scoped communication register without any send capability", () => {
    expect(communicationMigration).toContain("CREATE TABLE `como_next_communications`");
    expect(communicationMigration).toContain("FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files`(`project_id`,`id`)");
    expect(communicationMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(commandSource).toContain("externalSideEffect: false");
    expect(commandSource).toContain("لا يمكن تسجيل الإرسال قبل اعتماد المسودة");
    expect(commandSource).toContain("لا يمكن إغلاق الملف وفيه مسودة أو مراسلة معتمدة لم يُسجل إرسالها");
    expect(commandSource).not.toMatch(/sendMail|nodemailer|smtpTransport|notifyOwner/);
  });

  it("adds the meeting workspace without touching protected or legacy tables", () => {
    expect([...meetingMigration.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_meeting_consents",
      "como_next_meeting_sources",
      "como_next_meeting_analyses",
      "como_next_meeting_proposals",
      "como_next_meeting_minutes",
    ]);
    expect(meetingMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(meetingMetadataMigration.match(/ALTER TABLE `como_next_meeting_proposals`/g)).toHaveLength(2);
    expect(meetingMetadataMigration).not.toMatch(/ALTER TABLE `(?!como_next_meeting_proposals`)/);
    expect(commandSource).toContain("لا يمكن إغلاق الملف وفيه اجتماع لم يُغلق بمحضر مراجَع");
    expect(commandSource).toContain("لا يمكن إغلاق الملف قبل مراجعة مقترحات الاجتماعات");
    expect(commandSource).toContain("لا يمكن إغلاق الملف وفيه مسودة محضر تنتظر المراجعة");
  });
});
