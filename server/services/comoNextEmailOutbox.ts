import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { comoNextEmailAnalyses, comoNextEmailMessages } from "../../drizzle/schema";
import { getDb } from "../db";
import { saveComoMailboxDraft } from "../emailMonitor";
import { updateCommunicationDraftCommand } from "./comoNextCommands";

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

export async function updateReplyDraftFromEmailCommand(input: {
  userId: number;
  emailId: number;
  subject: string;
  body: string;
  toText: string;
  ccText?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages)
    .where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  const [analysis] = await db.select({ id: comoNextEmailAnalyses.id }).from(comoNextEmailAnalyses)
    .where(and(eq(comoNextEmailAnalyses.emailMessageId, input.emailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")))
    .orderBy(desc(comoNextEmailAnalyses.id)).limit(1);
  if (!analysis) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد مسودة رد محللة لهذه الرسالة" });
  await db.update(comoNextEmailAnalyses).set({ replyDraftText: input.body.trim() }).where(eq(comoNextEmailAnalyses.id, analysis.id));
  let mailboxDraft: { folder: string; uid: number | null; created: boolean };
  if (email.replyDraftCommunicationId) {
    const result = await updateCommunicationDraftCommand({
      userId: input.userId,
      communicationId: Number(email.replyDraftCommunicationId),
      subject: input.subject,
      body: input.body,
      toText: input.toText,
      ccText: input.ccText,
    });
    mailboxDraft = "mailboxDraft" in result ? result.mailboxDraft : { folder: "Drafts", uid: null, created: false };
  } else {
    mailboxDraft = await saveComoMailboxDraft({
      to: input.toText,
      cc: input.ccText?.trim() || undefined,
      subject: input.subject,
      body: input.body,
      inReplyTo: email.messageId || undefined,
      draftKey: `email-reply-draft:${email.id}`,
    });
  }
  const mailboxRef = mailboxDraft.uid ? `${mailboxDraft.folder} UID ${mailboxDraft.uid}` : mailboxDraft.folder;
  await db.update(comoNextEmailMessages).set({
    suggestionReason: `مسودة الرد محفوظة في ${mailboxRef}؛ المراجعة والإرسال من تطبيق البريد.`.slice(0, 4000),
  }).where(eq(comoNextEmailMessages.id, input.emailId));
  return { success: true, externalSideEffect: false as const, mailboxDraft };
}
