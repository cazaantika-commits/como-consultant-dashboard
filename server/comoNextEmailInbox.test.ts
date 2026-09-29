import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertMailboxWritesEnabled, assertOutboundEmailEnabled } from "./emailMonitor";
import { assertReadonlyEmailArchitecture, buildEmailAnalysisPrompt, mailboxKeyFor, messageIdentitySha, scoreEmailSuggestionCandidate } from "./services/comoNextEmailInbox";

const migration = readFileSync("drizzle/0086_como_next_readonly_email_inbox.sql", "utf8");
const service = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const outbox = readFileSync("server/services/comoNextEmailOutbox.ts", "utf8");
const mailService = readFileSync("server/emailMonitor.ts", "utf8");
const router = readFileSync("server/routers/comoNextEmail.ts", "utf8");
const ui = readFileSync("client/src/components/ComoNextEmailInbox.tsx", "utf8");
const commands = readFileSync("server/services/comoNextCommands.ts", "utf8");
const agentTools = readFileSync("server/agentTools.ts", "utf8");
const serverStartup = readFileSync("server/_core/index.ts", "utf8");

describe("COMO Next read-only email inbox", () => {
  it("uses additive tables and never mutates legacy schema in migration 0086", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_email_messages`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_email_attachments`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_email_analyses`");
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)\b/im);
  });

  it("deduplicates by a masked mailbox identity plus message-id and by UIDVALIDITY plus IMAP UID", () => {
    expect(mailboxKeyFor(" Owner@ComoDevelopments.com ")).toHaveLength(64);
    expect(messageIdentitySha({ messageId: "<abc@example.com>", uid: 7, date: new Date("2026-09-25T10:00:00Z"), from: "a@example.com", subject: "x" }, "100")).toEqual(
      messageIdentitySha({ messageId: "<abc@example.com>", uid: 99, date: new Date("2026-09-26T10:00:00Z"), from: "b@example.com", subject: "y" }, "200"),
    );
    expect(migration).toContain("como_next_email_mailbox_uid_uq");
    expect(migration).toContain("como_next_email_mailbox_message_uq");
  });

  it("keeps inbox synchronization read-only and saves replies to the real mailbox Drafts", () => {
    expect(() => assertReadonlyEmailArchitecture(service)).not.toThrow();
    expect(service).not.toMatch(/sendReply\s*\(|sendMail\s*\(|markAsSeen\s*\(|addFlags\s*\(/i);
    expect(outbox).toContain("saveComoMailboxDraft");
    expect(outbox).not.toContain("sendApprovedComoReply");
    expect(router).not.toContain("sendReplyDraft:");
    expect(router).toContain("assertOwner(ctx.user.role)");
    expect(ui).not.toContain("recordCommunicationSent");
  });

  it("opens INBOX and Sent read-only and verifies UIDVALIDITY before attachment retrieval", () => {
    expect(mailService).toContain('fetchReadonlyFolderSince("INBOX"');
    expect(mailService).toContain('fetchReadonlyFolderSince("Sent"');
    expect(mailService).toContain('imap.openBox(folderName, true');
    expect(mailService).toContain("markSeen: false");
    expect(mailService).toContain("Mailbox UIDVALIDITY changed");
    expect(mailService).toContain("assertMailboxWritesEnabled");
  });

  it("defaults mailbox writes and outbound email to locked", () => {
    const oldWrite = process.env.COMO_MAILBOX_WRITE_ENABLED;
    const oldSend = process.env.COMO_OUTBOUND_EMAIL_ENABLED;
    delete process.env.COMO_MAILBOX_WRITE_ENABLED;
    delete process.env.COMO_OUTBOUND_EMAIL_ENABLED;
    try {
      expect(() => assertMailboxWritesEnabled()).toThrow(/disabled/);
      expect(() => assertOutboundEmailEnabled()).toThrow(/disabled/);
    } finally {
      if (oldWrite === undefined) delete process.env.COMO_MAILBOX_WRITE_ENABLED; else process.env.COMO_MAILBOX_WRITE_ENABLED = oldWrite;
      if (oldSend === undefined) delete process.env.COMO_OUTBOUND_EMAIL_ENABLED; else process.env.COMO_OUTBOUND_EMAIL_ENABLED = oldSend;
    }
    expect(agentTools).toContain('process.env.COMO_OUTBOUND_EMAIL_ENABLED !== "true"');
    expect(serverStartup).toContain('process.env.COMO_AUTOMATIC_EMAIL_POLLING_ENABLED === "true"');
    expect(serverStartup).toContain('process.env.COMO_OUTBOUND_EMAIL_ENABLED === "true"');
    expect(serverStartup).toContain('process.env.COMO_TELEGRAM_ENABLED === "true"');
  });

  it("stores attachment bytes only through the protected linking command, never in the raw import", () => {
    const importBlock = service.slice(service.indexOf("export async function importReadonlyBatch"), service.indexOf("export async function syncReadonlyInboxCommand"));
    expect(importBlock).not.toContain("storagePut(");
    expect(service).toContain("await fetchEmailByUID(email.imapUid, email.uidValidity, email.folderName)");
    expect(service).toContain("storagePut(storageKey, attachment.content");
    expect(service).toContain("/api/como-next/documents/");
  });

  it("auto-links only a unique very-high-confidence work-file match and leaves weaker matches reviewable", () => {
    const strong = scoreEmailSuggestionCandidate({
      projectName: "Majan",
      plotNumber: "RT.040",
      workFileTitle: "Design International revised proposal",
      partyName: "Design International",
      contactEmail: "paolo@designinternational.com",
      partyLinkedToFile: 1,
    }, {
      from: "paolo@designinternational.com",
      to: "owner@como.ae",
      cc: "",
      subject: "Design International revised proposal for Majan RT.040",
      textBody: "Please find attached the revised proposal.",
    } as any);
    expect(strong.score).toBeGreaterThanOrEqual(130);
    expect(service).toContain("suggestion.confidenceScore >= 130");
    expect(service).toContain("await linkEmailToWorkFileCommand");
    expect(service).toContain("Keep the message as a reviewable suggestion");
  });

  it("keeps narrative proposals as drafts but reconciles linked inbound evidence through the guarded service", () => {
    const analysisBlock = service.slice(service.indexOf("export async function analyzeEmailCommand"), service.indexOf("export async function createReplyDraftFromEmailCommand"));
    expect(analysisBlock).toContain('analysisStatus: "draft"');
    expect(analysisBlock).toContain("operationalRecordsCreated: 0");
    expect(analysisBlock).not.toMatch(/createActionCommand|createDecisionCommand|recordCommunicationSentCommand/);
    expect(analysisBlock).toContain("reconcileWorkFileEvidenceCommand");
    expect(analysisBlock).toContain('email.folderName === "INBOX" && email.linkedWorkFileId');
    expect(service).not.toMatch(/sendReply\s*\(|sendMail\s*\(/i);
  });

  it("forces email analysis to reconcile a later sent approval before proposing a next step", () => {
    const prompt = buildEmailAnalysisPrompt({
      folderName: "INBOX",
      fromName: "Colliers",
      fromEmail: "consultant@example.com",
      toText: "owner@example.com",
      ccText: null,
      subject: "Second invoice",
      receivedAt: "2026-09-21 13:02:35",
      bodyText: "Please confirm when the invoice will be ready for collection.",
    }, {
      workFile: { id: 60017, title: "فاتورة كولييرز", status: "waiting", governingQuestion: "هل نُفذ الدفع؟", desiredOutcome: "تأكيد التنفيذ" },
      mailboxMessages: [{ direction: "outbound", folderName: "Sent", subject: "Payment approval", excerpt: "Approved and sent to Wael", receivedAt: "2026-09-22 10:25:04", inboxStatus: "suggested" }],
      communications: [{ direction: "outbound", status: "sent", subject: "طلب صرف", excerpt: "اعتمد عبد الرحمن الصرف وأرسله لوائل", occurredAt: "2026-09-22 10:25:04", evidenceReference: "Sent UID 173" }],
      actions: [{ title: "انتظار تأكيد تنفيذ الدفع", status: "waiting_external", description: "الاعتماد أُرسل والمتبقي إثبات الدفع", evidenceReference: "Sent UID 173", updatedAt: "2026-09-24 15:08:53" }],
    });
    expect(prompt).toContain("الأحدث زمنيًا ينسخ الحالة الأقدم");
    expect(prompt).toContain("Sent UID 173");
    expect(prompt).toContain("فلا تقل إن الاعتماد ما زال معلقًا");
    expect(prompt).toContain("لا تعتبر الدفع منفذًا بلا تأكيد صريح");
  });

  it("prefers the linked Colliers file over a generic design-title match", () => {
    const message = { from: "owner@example.com", to: "wael@example.com", cc: "", subject: "Colliers Report Acceptance", textBody: "Please process Colliers invoice 7314002290." };
    const correct = scoreEmailSuggestionCandidate({ projectName: "Majan", plotNumber: "", workFileTitle: "كولييرز — التحليل المالي", partyName: "Colliers", contactEmail: null, partyLinkedToFile: 1 }, message as any);
    const generic = scoreEmailSuggestionCandidate({ projectName: "Majan", plotNumber: "", workFileTitle: "Design International review", partyName: "Colliers", contactEmail: null, partyLinkedToFile: 0 }, message as any);
    expect(correct.score).toBeGreaterThan(generic.score);
    expect(correct.reasons.join(" ")).toContain("Colliers");
  });

  it("creates a linked outbound draft automatically while keeping the inbox analysis draft available before linking", () => {
    const draftBlock = service.slice(service.indexOf("export async function createReplyDraftFromEmailCommand"), service.indexOf("export async function dismissEmailCommand"));
    expect(draftBlock).toContain("اربط الرسالة بملف العمل قبل إنشاء مسودة الرد");
    expect(draftBlock).toContain('email.folderName !== "INBOX"');
    expect(draftBlock).toContain("createCommunicationDraftCommand");
    expect(draftBlock).toContain("sent: false");
    expect(service).toContain("replyDraftId");
    expect(service).toContain("كل رسالة واردة بشرية/مهنية من طرف مشروع تحتاج ردًا مهنيًا");
    expect(commands).toContain('communicationStatus: "draft"');
    expect(commands).toContain("externalSideEffect: false");
  });

  it("saves any analyzed inbox reply in Drafts and leaves sending to the email client", () => {
    expect(outbox).toContain("updateReplyDraftFromEmailCommand");
    expect(outbox).toContain("saveComoMailboxDraft");
    expect(outbox).toContain("externalSideEffect: false");
    expect(ui).toContain("المراجعة والتعديل والإرسال تتم من تطبيق البريد نفسه");
    expect(ui).not.toContain("sendDraftMutation.mutateAsync");
    expect(ui).toContain("حفظ في Drafts");
  });

  it("makes the inbox owner-only and gives unmatched mail its own review state", () => {
    expect(router).toContain("صندوق بريد عبد الرحمن متاح للمالك فقط");
    expect(migration).toContain("enum('unmatched','suggested','linked','dismissed')");
    expect(ui).toContain("تحتاج مراجعة");
    expect(ui).toContain("صادر موثق");
    expect(ui).toContain("غير مطابق");
    expect(ui).toContain("مغلقة/مستبعدة");
  });
});
