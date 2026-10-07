import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyComoCcPolicy } from "./emailMonitor";

const inbox = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const outbox = readFileSync("server/services/comoNextEmailOutbox.ts", "utf8");
const emailMonitor = readFileSync("server/emailMonitor.ts", "utf8");
const commands = readFileSync("server/services/comoNextCommands.ts", "utf8");
const router = readFileSync("server/routers/comoNextEmail.ts", "utf8");
const emailUi = readFileSync("client/src/components/ComoNextEmailInbox.tsx", "utf8");
const kitchenUi = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");

function mailboxDraftFunction() {
  return emailMonitor.slice(
    emailMonitor.indexOf("export async function saveComoMailboxDraft"),
    emailMonitor.indexOf("function saveSentEmailToIMAP"),
  );
}

describe("COMO Next mailbox drafts", () => {
  it("keeps mailbox synchronization read-only", () => {
    expect(inbox).toContain("assertReadonlyEmailArchitecture");
    expect(inbox).not.toContain('import { sendApprovedComoReply');
    expect(inbox).not.toMatch(/sendApprovedComoReply\s*\(/);
  });

  it("saves a reviewed draft in the authenticated mailbox without SMTP delivery", () => {
    expect(outbox).toContain("eq(comoNextEmailMessages.userId, input.userId)");
    expect(outbox).toContain('analysisStatus, "draft"');
    expect(outbox).toContain("saveComoMailboxDraft");
    expect(outbox).toContain("email.replyDraftCommunicationId");
    expect(mailboxDraftFunction()).toContain('flags: ["\\\\Draft"]');
    expect(mailboxDraftFunction()).toContain('"X-COMO-Draft-Key"');
    expect(mailboxDraftFunction()).not.toContain("smtpTransport");
  });

  it("embeds a verified document in the MIME draft instead of just mentioning an attachment", () => {
    expect(mailboxDraftFunction()).toContain("attachments?: Array<{ filename: string; content: Buffer; contentType: string }>");
    expect(mailboxDraftFunction()).toContain("attachments: input.attachments");
    expect(commands).toContain("attachments: input.attachments");
    expect(commands).toContain("attachmentNames: input.attachments?.map");
    expect(mailboxDraftFunction()).toContain("streamTransport: true");
    expect(mailboxDraftFunction()).toContain("imap.append(raw");
  });

  it("preserves reply-thread headers and never schedules outbound email", () => {
    expect(mailboxDraftFunction()).toContain("inReplyTo: input.inReplyTo, references: input.inReplyTo");
    expect(mailboxDraftFunction()).toContain("imap.append");
    expect(outbox).not.toMatch(/cron|schedule/i);
    expect(commands).toContain("input.sourceEmailId");
    expect(commands).toContain("inReplyTo = sourceEmail?.messageId");
  });

  it("always copies Wael, or Mia when Wael is the primary recipient", () => {
    expect(applyComoCcPolicy({ to: "consultant@example.com" })).toBe("wael@zooma.ae");
    expect(applyComoCcPolicy({ to: "consultant@example.com", cc: "team@example.com, Wael <wael@zooma.ae>" })).toBe("team@example.com, Wael <wael@zooma.ae>");
    expect(applyComoCcPolicy({ to: "Wael <wael@zooma.ae>" })).toBe("pa@zooma.ae");
    expect(applyComoCcPolicy({ to: "wael@zooma.ae", cc: "pa@zooma.ae" })).toBe("pa@zooma.ae");
  });

  it("exposes Drafts saving only and removes direct send buttons and mutations", () => {
    expect(router).toContain("updateReplyDraft: protectedProcedure");
    expect(router).not.toContain("sendReplyDraft: protectedProcedure");
    expect(emailMonitor).not.toContain("sendApprovedComoReply");
    expect(emailUi).toContain("حفظ في Drafts");
    expect(emailUi).not.toContain("إرسال الآن");
    expect(kitchenUi).toContain("يحفظ Manus الرسالة في Drafts داخل بريدك الحقيقي");
    expect(kitchenUi).not.toContain("sendCommunicationDraft.useMutation");
  });
});
