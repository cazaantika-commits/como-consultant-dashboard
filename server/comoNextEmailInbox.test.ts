import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertMailboxWritesEnabled, assertOutboundEmailEnabled } from "./emailMonitor";
import { assertReadonlyEmailArchitecture, mailboxKeyFor, messageIdentitySha } from "./services/comoNextEmailInbox";

const migration = readFileSync("drizzle/0086_como_next_readonly_email_inbox.sql", "utf8");
const service = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
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

  it("keeps the inbox service free of send, reply, server-flag, and mailbox-write calls", () => {
    expect(() => assertReadonlyEmailArchitecture(service)).not.toThrow();
    expect(service).not.toMatch(/sendReply\s*\(|sendMail\s*\(|markAsSeen\s*\(|addFlags\s*\(/i);
    expect(router).not.toMatch(/\b(send|reply|forward|markSeen|deleteRemote)\s*:/i);
    expect(ui).not.toContain("recordCommunicationSent");
  });

  it("opens INBOX read-only and verifies UIDVALIDITY before attachment retrieval", () => {
    expect(mailService).toContain('imap.openBox("INBOX", true');
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

  it("stores only attachment metadata during sync and bytes only after owner-approved linking", () => {
    const importBlock = service.slice(service.indexOf("export async function importReadonlyBatch"), service.indexOf("export async function syncReadonlyInboxCommand"));
    expect(importBlock).not.toContain("storagePut(");
    expect(service).toContain("await fetchEmailByUID(email.imapUid, email.uidValidity)");
    expect(service).toContain("storagePut(storageKey, attachment.content");
    expect(service).toContain("/api/como-next/documents/");
  });

  it("keeps Manus analysis as a draft and creates no operational outcome automatically", () => {
    const analysisBlock = service.slice(service.indexOf("export async function analyzeEmailCommand"), service.indexOf("export async function createReplyDraftFromEmailCommand"));
    expect(analysisBlock).toContain('analysisStatus: "draft"');
    expect(analysisBlock).toContain("operationalRecordsCreated: 0");
    expect(analysisBlock).not.toMatch(/createActionCommand|createDecisionCommand|recordCommunicationSentCommand/);
  });

  it("creates an outbound draft only after the inbound email is linked and never sends it", () => {
    const draftBlock = service.slice(service.indexOf("export async function createReplyDraftFromEmailCommand"), service.indexOf("export async function dismissEmailCommand"));
    expect(draftBlock).toContain("اربط الرسالة بملف العمل قبل إنشاء مسودة الرد");
    expect(draftBlock).toContain("createCommunicationDraftCommand");
    expect(draftBlock).toContain("sent: false");
    expect(commands).toContain('communicationStatus: "draft"');
    expect(commands).toContain("externalSideEffect: false");
  });

  it("makes the inbox owner-only and gives unmatched mail its own review state", () => {
    expect(router).toContain("صندوق بريد عبد الرحمن متاح للمالك فقط");
    expect(migration).toContain("enum('unmatched','suggested','linked','dismissed')");
    expect(ui).toContain("تحتاج مراجعة");
    expect(ui).toContain("غير مطابق");
    expect(ui).toContain("لا يوجد زر إرسال في هذا الصندوق");
  });
});
