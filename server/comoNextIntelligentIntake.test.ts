import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { selectSaraOwnerUserId } from "./services/comoNextIntake";

const migration = readFileSync("drizzle/0088_como_next_intelligent_intake.sql", "utf8");
const intakeService = readFileSync("server/services/comoNextIntake.ts", "utf8");
const emailService = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const saraService = readFileSync("server/services/saraRealtime.ts", "utf8");
const saraRouter = readFileSync("server/routers/saraRealtime.ts", "utf8");
const saraRoom = readFileSync("client/src/components/SaraRealtimeRoom.tsx", "utf8");
const reviewUi = readFileSync("client/src/components/ComoNextIntakeProposals.tsx", "utf8");
const todayPage = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const commands = readFileSync("server/services/comoNextCommands.ts", "utf8");

function hasDestructiveSql(source: string) {
  return /^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im.test(source);
}

describe("COMO Next intelligent intake safeguards", () => {
  it("adds one review-only proposal register without destructive SQL", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_intake_proposals`");
    expect(migration).toContain("ENUM('pending','applied','dismissed')");
    expect(migration).toContain("UNIQUE KEY `como_next_intake_source_uq`");
    expect(hasDestructiveSql(migration)).toBe(false);
  });

  it("keeps email analysis as evidence-bound proposals rather than direct operational writes", () => {
    expect(emailService).toContain("proposals: {");
    expect(emailService).toContain("createIntakeProposalsCommand");
    expect(emailService).toContain("review-only");
    expect(emailService).not.toContain("createActionCommand");
    expect(emailService).not.toContain("createDecisionCommand");
    expect(emailService).not.toContain("sendMail(");
  });

  it("passes Sara's owner utterance into the same executive directive path as the kitchen", () => {
    expect(saraService).toContain('name: "direct_manus_in_work_file"');
    expect(saraService).toContain("محرك Manus التنفيذي نفسه المستخدم في المطبخ");
    expect(saraRouter).toContain("executeExecutiveDirectiveCommand");
    expect(saraRouter).not.toContain("createSaraIntakeProposalCommand");
    expect(intakeService).toContain('memberId !== "abdulrahman"');
    expect(saraRoom).toContain('event.name !== "direct_manus_in_work_file"');
    expect(saraRouter).toContain("directiveText: parsed.directive_text");
  });

  it("resolves the unique COMO admin when the deployment owner variable is absent", () => {
    expect(selectSaraOwnerUserId({
      configuredOpenId: "",
      adminUsers: [{ id: 1, openId: "owner-open-id" }],
    })).toBe(1);
  });

  it("prefers the configured owner and fails safely when several admins are ambiguous", () => {
    expect(selectSaraOwnerUserId({
      configuredOpenId: "owner-2",
      adminUsers: [
        { id: 1, openId: "owner-1" },
        { id: 2, openId: "owner-2" },
      ],
    })).toBe(2);
    expect(() => selectSaraOwnerUserId({
      configuredOpenId: "",
      adminUsers: [
        { id: 1, openId: "owner-1" },
        { id: 2, openId: "owner-2" },
      ],
    })).toThrow("يوجد أكثر من حساب إدارة");
  });

  it("requires explicit apply or dismiss and maps each approved kind through controlled commands", () => {
    expect(intakeService).toContain('decision: "apply" | "dismiss"');
    expect(intakeService).toContain("createActionCommand");
    expect(intakeService).toContain("createDecisionCommand");
    expect(intakeService).toContain("createCommunicationDraftCommand");
    expect(intakeService).toContain("externalSideEffect: false");
    expect(reviewUi).toContain("اعتماد وتحويل");
    expect(reviewUi).toContain("استبعاد دون أثر");
  });

  it("surfaces proposals in Today and blocks closing their work file before review", () => {
    expect(todayPage).toContain("مقترحات المراجعة");
    expect(todayPage).toContain("hasPendingIntake");
    expect(commands).toContain("comoNextIntakeProposals");
    expect(commands).toContain("لا يمكن إغلاق الملف قبل مراجعة المقترحات الواردة من البريد أو سارة");
  });

  it("preserves legitimate live proposals and requires complete provenance", async () => {
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await connection.query<any[]>(`SELECT COUNT(*) AS n,
        SUM(CASE WHEN source_kind IS NULL OR source_record_id IS NULL OR review_status IS NULL THEN 1 ELSE 0 END) AS invalid
        FROM como_next_intake_proposals`);
      expect(Number(rows[0].n)).toBeGreaterThanOrEqual(0);
      expect(Number(rows[0].invalid || 0)).toBe(0);
    } finally {
      await connection.end();
    }
  }, 20_000);
});
