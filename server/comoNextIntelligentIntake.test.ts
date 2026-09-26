import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";

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

  it("gives Sara one proposal-only write and passes the owner utterance as evidence", () => {
    expect(saraService).toContain('name: "capture_intake_proposal"');
    expect(saraService).toContain("تسجل مقترحًا فقط ينتظر مراجعة عبدالرحمن");
    expect(saraRouter).toContain("createSaraIntakeProposalCommand");
    expect(intakeService).toContain('memberId !== "abdulrahman"');
    expect(saraRoom).toContain("lastMemberTextRef.current");
    expect(saraRoom).toContain('sourceText: event.name === "capture_intake_proposal"');
  });

  it("requires explicit apply or dismiss and maps each approved kind through controlled commands", () => {
    expect(intakeService).toContain('decision: "apply" | "dismiss"');
    expect(intakeService).toContain("createActionCommand");
    expect(intakeService).toContain("createDecisionCommand");
    expect(intakeService).toContain("createCommunicationDraftCommand");
    expect(intakeService).toContain("externalSideEffect: false");
    expect(reviewUi).toContain("اعتماد وتحويل إلى");
    expect(reviewUi).toContain("استبعاد المقترح دون أثر تشغيلي");
  });

  it("surfaces proposals in Today and blocks closing their work file before review", () => {
    expect(todayPage).toContain("مقترحات بانتظارك");
    expect(todayPage).toContain("hasPendingIntake");
    expect(commands).toContain("comoNextIntakeProposals");
    expect(commands).toContain("لا يمكن إغلاق الملف قبل مراجعة المقترحات الواردة من البريد أو سارة");
  });

  it("has no live proposal residue before the reversible smoke test", async () => {
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await connection.query<any[]>("SELECT COUNT(*) AS n FROM como_next_intake_proposals");
      expect(Number(rows[0].n)).toBe(0);
    } finally {
      await connection.end();
    }
  }, 20_000);
});
