import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { comoNextEmailAnalyses, comoNextEmailMessages } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendApprovedComoReply } from "../emailMonitor";
import {
  sendCommunicationDraftCommand,
  updateCommunicationDraftCommand,
} from "./comoNextCommands";
import { createReplyDraftFromEmailCommand } from "./comoNextEmailInbox";

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
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
  if (email.replyDraftCommunicationId) {
    await updateCommunicationDraftCommand({
      userId: input.userId,
      communicationId: Number(email.replyDraftCommunicationId),
      subject: input.subject,
      body: input.body,
      toText: input.toText,
      ccText: input.ccText,
    });
  }
  return { success: true, externalSideEffect: false as const };
}

export async function sendReplyDraftFromEmailCommand(input: {
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
  if (email.folderName !== "INBOX") throw new TRPCError({ code: "BAD_REQUEST", message: "الرسالة الصادرة لا تحتاج ردًا" });
  const [analysis] = await db.select({ id: comoNextEmailAnalyses.id }).from(comoNextEmailAnalyses)
    .where(and(eq(comoNextEmailAnalyses.emailMessageId, input.emailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")))
    .orderBy(desc(comoNextEmailAnalyses.id)).limit(1);
  if (!analysis) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد مسودة رد لهذه الرسالة" });

  const toText = input.toText.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!toText.includes("@") || !subject || !body) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "أكمل المستلم والعنوان والنص قبل الإرسال" });
  }

  let messageId: string | null = null;
  if (email.replyDraftCommunicationId) {
    const result = await sendCommunicationDraftCommand({
      userId: input.userId,
      communicationId: Number(email.replyDraftCommunicationId),
      subject,
      body,
      toText,
      ccText: input.ccText,
    });
    messageId = result.messageId;
  } else if (email.linkedWorkFileId && email.linkedProjectId) {
    const draft = await createReplyDraftFromEmailCommand({ userId: input.userId, emailId: input.emailId, body, ccText: input.ccText });
    const result = await sendCommunicationDraftCommand({
      userId: input.userId,
      communicationId: Number(draft.id),
      subject,
      body,
      toText,
      ccText: input.ccText,
    });
    messageId = result.messageId;
  } else {
    const result = await sendApprovedComoReply({
      to: toText,
      subject,
      body,
      inReplyTo: email.messageId || undefined,
      cc: input.ccText?.trim() || undefined,
    });
    messageId = result.messageId;
  }

  const sentAt = nowSql();
  await db.update(comoNextEmailAnalyses).set({ replyDraftText: body }).where(eq(comoNextEmailAnalyses.id, analysis.id));
  await db.update(comoNextEmailMessages).set({
    inboxStatus: email.linkedWorkFileId ? "linked" : "dismissed",
    dismissedAt: email.linkedWorkFileId ? email.dismissedAt : sentAt,
    suggestionReason: `تم الرد من COMO بتاريخ ${sentAt}${messageId ? ` · ${messageId}` : ""}`.slice(0, 4000),
  }).where(eq(comoNextEmailMessages.id, input.emailId));
  return { success: true, messageId, sentAt, externalSideEffect: true as const };
}
