import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inbox = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const outbox = readFileSync("server/services/comoNextEmailOutbox.ts", "utf8");
const emailMonitor = readFileSync("server/emailMonitor.ts", "utf8");
const router = readFileSync("server/routers/comoNextEmail.ts", "utf8");
const emailUi = readFileSync("client/src/components/ComoNextEmailInbox.tsx", "utf8");
const kitchenUi = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");

describe("COMO Next explicit owner email outbox", () => {
  it("keeps mailbox synchronization read-only", () => {
    expect(inbox).toContain("assertReadonlyEmailArchitecture");
    expect(inbox).not.toContain('import { sendApprovedComoReply');
    expect(inbox).not.toMatch(/sendApprovedComoReply\s*\(/);
  });

  it("sends only a reviewed draft owned by the authenticated user", () => {
    expect(outbox).toContain("eq(comoNextEmailMessages.userId, input.userId)");
    expect(outbox).toContain('analysisStatus, "draft"');
    expect(outbox).toContain("sendCommunicationDraftCommand");
    expect(outbox).toContain("sendApprovedComoReply");
    expect(outbox).toContain("email.replyDraftCommunicationId");
  });

  it("preserves reply-thread headers and does not schedule outbound email", () => {
    expect(emailMonitor).toContain("inReplyTo: input.inReplyTo, references: input.inReplyTo");
    expect(emailMonitor).toContain("In-Reply-To: ${inReplyTo}");
    expect(outbox).not.toMatch(/cron|schedule/i);
  });

  it("exposes editing and sending only behind protected mutations and explicit buttons", () => {
    expect(router).toContain("updateReplyDraft: protectedProcedure");
    expect(router).toContain("sendReplyDraft: protectedProcedure");
    expect(emailUi).toContain("إرسال الآن");
    expect(emailUi).toContain("حفظ التعديل");
    expect(kitchenUi).toContain("هذه هي الرسالة كاملة. يمكنك تعديلها، ثم الضغط على إرسال؛ لا يرسل Manus شيئًا قبل ضغطك.");
  });
});
