import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { comoNextRouter } from "./routers/comoNext";
import {
  assertMeetingRecordingFile,
  assertMeetingClosable,
  assertProposalApplication,
  assertRecordingConsent,
  assertTranscriptConsent,
  composeReviewedMinutes,
} from "./services/comoNextMeetings";

const migration = readFileSync(new URL("../drizzle/0084_como_next_meeting_workspace.sql", import.meta.url), "utf8");
const metadataMigration = readFileSync(new URL("../drizzle/0085_como_next_meeting_proposal_metadata.sql", import.meta.url), "utf8");
const recordingsMigration = readFileSync(new URL("../drizzle/0095_como_next_meeting_recordings.sql", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./services/comoNextMeetings.ts", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../client/src/components/ComoNextMeetingWorkspace.tsx", import.meta.url), "utf8");
const documentRouteSource = readFileSync(new URL("./comoNextDocumentRoute.ts", import.meta.url), "utf8");

function context(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `meeting-test-${userId}`,
      email: `meeting-${userId}@example.com`,
      name: "Meeting Test",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("COMO Next meeting safety invariants", () => {
  it("requires explicit transcription consent before accepting a transcript", () => {
    expect(() => assertTranscriptConsent("granted")).not.toThrow();
    expect(() => assertTranscriptConsent("pending")).toThrow(TRPCError);
    expect(() => assertTranscriptConsent(null)).toThrow("لا يمكن حفظ تفريغ");
  });

  it("requires explicit recording consent and enforces the transcription size boundary", () => {
    expect(() => assertRecordingConsent("granted")).not.toThrow();
    expect(() => assertRecordingConsent("pending")).toThrow("لا يمكن بدء أو رفع تسجيل");
    expect(() => assertMeetingRecordingFile({ mimeType: "audio/webm", byteSize: 1024 })).not.toThrow();
    expect(() => assertMeetingRecordingFile({ mimeType: "application/octet-stream", byteSize: 1024 })).toThrow("صيغة التسجيل غير مدعومة");
    expect(() => assertMeetingRecordingFile({ mimeType: "audio/webm", byteSize: 17 * 1024 * 1024 })).toThrow("16MB");
  });

  it("keeps internal-only findings out of external correspondence", () => {
    expect(() => assertProposalApplication("external_commitment", "communication_draft", "meeting_record")).not.toThrow();
    expect(() => assertProposalApplication("external_commitment", "communication_draft", "internal_only")).toThrow(TRPCError);
  });

  it("permits only semantically reviewed proposal applications", () => {
    expect(() => assertProposalApplication("decision", "decision", "meeting_record")).not.toThrow();
    expect(() => assertProposalApplication("decision", "communication_draft", "meeting_record")).toThrow(TRPCError);
  });

  it("does not close a meeting with required agenda or pending proposals", () => {
    expect(() => assertMeetingClosable({ unresolvedRequired: 0, pendingProposals: 0 })).not.toThrow();
    expect(() => assertMeetingClosable({ unresolvedRequired: 1, pendingProposals: 0 })).toThrow("المحاور المطلوبة");
    expect(() => assertMeetingClosable({ unresolvedRequired: 0, pendingProposals: 1 })).toThrow("مقترحات Manus");
  });

  it("composes minutes from reviewed public material only", () => {
    const minutes = composeReviewedMinutes({
      title: "اختبار اجتماع",
      summary: "خلاصة مراجعة",
      participants: [{ displayName: "عبد الرحمن" }],
      agenda: [
        { category: "خارجي", promptAr: "سؤال ظاهر", response: "إجابة ظاهرة", audience: "discuss", isChecked: 1 },
        { category: "داخلي", promptAr: "سؤال سري", response: "إجابة سرية", audience: "internal_only", isChecked: 1 },
      ],
      proposals: [
        { proposalKind: "action", title: "نتيجة مطبقة", content: "محتوى ظاهر", audience: "meeting_record", reviewStatus: "applied" },
        { proposalKind: "note", title: "نقطة داخلية", content: "محتوى سري", audience: "internal_only", reviewStatus: "applied" },
        { proposalKind: "risk", title: "غير مراجع", content: "لا يظهر", audience: "meeting_record", reviewStatus: "pending" },
      ],
    });
    expect(minutes).toContain("إجابة ظاهرة");
    expect(minutes).toContain("نتيجة مطبقة");
    expect(minutes).not.toContain("إجابة سرية");
    expect(minutes).not.toContain("محتوى سري");
    expect(minutes).not.toContain("غير مراجع");
  });

  it("uses additive tables, advances safe internal outcomes, and keeps external effects at zero", () => {
    expect([...migration.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_meeting_consents",
      "como_next_meeting_sources",
      "como_next_meeting_analyses",
      "como_next_meeting_proposals",
      "como_next_meeting_minutes",
    ]);
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(metadataMigration).toMatch(/ALTER TABLE `como_next_meeting_proposals`/);
    expect(metadataMigration).not.toMatch(/ALTER TABLE `(?!como_next_meeting_proposals`)/);
    expect(recordingsMigration).toContain("CREATE TABLE IF NOT EXISTS `como_next_meeting_recordings`");
    expect(recordingsMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(serviceSource).toContain("outcomesApplied: 0");
    expect(serviceSource).toContain("AUTO_MANUS:");
    expect(serviceSource).toContain("autoApplied");
    expect(serviceSource).toContain('normalized.includes("مانوس")');
    expect(serviceSource).toContain("externalSideEffect: false");
    expect(serviceSource).toContain("sourceSystem: comoNextMeetingSources.sourceSystem");
    expect(serviceSource).toContain('meetingStatus: input.meetingStatus ?? "planned"');
    expect(serviceSource).not.toMatch(/sendMail|nodemailer|smtpTransport|notifyOwner/);
  });

  it("presents one meeting path with recording and Zoom import instead of a stacked wall", () => {
    expect(workspaceSource).toContain('before: { title: "قبل الاجتماع"');
    expect(workspaceSource).toContain('during: { title: "أثناء الاجتماع"');
    expect(workspaceSource).toContain('after: { title: "بعد الاجتماع"');
    expect(workspaceSource).toContain("navigator.mediaDevices.getUserMedia");
    expect(workspaceSource).toContain("uploadMeetingRecording");
    expect(workspaceSource).toContain("importMeetingTranscript");
    expect(workspaceSource).toContain("رفع تسجيل أو تفريغ Zoom");
    expect(workspaceSource).toContain('params.get("focusKind") !== "meeting"');
    expect(workspaceSource).toContain("function MeetingAgendaNavigator");
    expect(workspaceSource).toContain("function MeetingReferenceStrip");
    expect(workspaceSource).toContain("فتح تحليل Manus");
    expect(workspaceSource).toContain("نقطة واحدة في كل مرة");
    expect(workspaceSource).toContain("النقطة {safeCursor + 1} من {items.length}");
    expect(workspaceSource).toContain('source.sourceSystem === "manus_analysis"');
    expect(workspaceSource).toContain("تحليل Manus مكتمل");
    expect(documentRouteSource).toContain("comoNextMeetingRecordings");
  });
});

describe("COMO Next meeting workspace reads", () => {
  it("returns the promoted participants and agenda inside an authorized work file", async () => {
    const caller = comoNextRouter.createCaller(context(1));
    const workspace = await caller.getMeetingWorkspace({ meetingId: 2 });
    expect(workspace.meeting).toMatchObject({ projectId: 1, workFileId: 60017, meetingStatus: "completed" });
    expect(workspace.participants).toHaveLength(2);
    expect(workspace.agenda).toHaveLength(7);
    expect(workspace.sources).toHaveLength(2);
    expect(workspace.sources.every(source => source.sourceStatus === "archived")).toBe(true);
    expect(workspace.sources.map(source => source.visibility).sort()).toEqual(["internal_only", "meeting_record"]);
    expect(workspace.safeguards).toEqual({ automaticOutcomeCreation: true, externalSending: false, recordingActive: false, transcriptionActive: false, recordingAvailable: true, zoomAutomaticImport: false });
  }, 15_000);

  it("hides an existing meeting from a user without project access", async () => {
    const caller = comoNextRouter.createCaller(context(999_999_999));
    await expect(caller.getMeetingWorkspace({ meetingId: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
