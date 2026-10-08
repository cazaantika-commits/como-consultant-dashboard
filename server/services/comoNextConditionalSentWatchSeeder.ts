import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { comoNextActions, comoNextEmailMessages, comoNextWorkFiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { appendEvent } from "./comoNextCommands";
import {
  addDubaiBusinessDays,
  type DubaiBusinessCalendar,
} from "./comoNextEmailFollowups";
import { isRelevantWatchReply } from "./comoNextConditionalSentWatches";

/**
 * This is deliberately a one-way activation boundary at the owner's explicit
 * start instruction. Older Sent imports remain evidence, never new watches.
 */
export const CONDITIONAL_SENT_WATCH_ACTIVATION_AT = "2026-10-08T01:43:29.000Z";
export const CONDITIONAL_SENT_WATCH_SOURCE_SYSTEM = "conditional_sent_watch";
const MAX_INBOUND_REPLY_CANDIDATES = 500;

export type ConditionalSentWatchClassification = {
  kind: "reply_request" | "quotation_request" | "clear_offer";
  cue: string;
};

export type ConditionalSentWatchSent = {
  id: number;
  folderName: string;
  linkedWorkFileId: number | null;
  workFileStatus: string | null;
  projectId: number | null;
  toText: string | null;
  ccText?: string | null;
  subject: string;
  bodyText: string;
  receivedAt: string;
};

export type ConditionalSentWatchInbound = {
  id: number;
  fromEmail: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
  linkedWorkFileId: number | null;
};

export type ConditionalSentWatchPlan = {
  sentEmailId: number;
  workFileId: number;
  projectId: number;
  recipientEmail: string;
  sentAt: string;
  followUpAt: string;
  sourceRecordId: string;
  classification: ConditionalSentWatchClassification;
};

export type ConditionalSentWatchSkipReason =
  | "before_activation"
  | "invalid_sent_timestamp"
  | "not_sent"
  | "work_file_not_open"
  | "not_single_to_recipient"
  | "not_whitelisted_reply_or_quotation_request"
  | "reply_already_present"
  | "reply_scan_incomplete";

export type ConditionalSentWatchSeedStore = {
  listUnwatchedSentCandidates(input: {
    userId: number;
    activationAt: string;
    limit: number;
  }): Promise<ConditionalSentWatchSent[]>;
  findInboundCandidates(input: {
    userId: number;
    recipientEmail: string;
    sentAt: string;
  }): Promise<{ messages: ConditionalSentWatchInbound[]; complete: boolean }>;
  createWaitingWatchIfAbsent(input: ConditionalSentWatchPlan & { userId: number }): Promise<{ actionId: number; replayed: boolean }>;
};

function parseUtcTimestamp(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
    ? trimmed
    : `${trimmed.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcSqlTimestamp(value: string): string | null {
  const date = parseUtcTimestamp(value);
  return date ? date.toISOString().slice(0, 19).replace("T", " ") : null;
}

function utcIsoTimestamp(value: string): string | null {
  const date = parseUtcTimestamp(value);
  return date ? date.toISOString() : null;
}

function visibleOutboundText(value: string) {
  return String(value || "")
    .split(/(?:^|\n)\s*(?:>{1,}|From:|-----Original Message-----|On .+ wrote:)/i, 1)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

/**
 * Only addresses in To count.  CC is intentionally excluded: a copied owner
 * (for example Wael) neither makes a second recipient nor becomes the person
 * from whom the system waits for a reply.
 *
 * Unicode mailbox syntax is intentionally not guessed. Punycode/ASCII mailbox
 * addresses work; non-ASCII address forms skip rather than risking a bad watch.
 */
export function extractSingleToRecipient(toText: string | null | undefined) {
  const matches = String(toText || "").match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [];
  const recipients = Array.from(new Set(matches.map(value => value.toLowerCase())));
  return recipients.length === 1 ? recipients[0] : null;
}

/**
 * Conservative deterministic allow-list.  This intentionally does not attempt
 * a general semantic reading of email. A message is eligible only when its own
 * visible text explicitly asks the recipient to reply/confirm or to supply a
 * quotation/proposal. Ambiguous wording therefore produces no operational row.
 */
export function classifyConditionalSentWatchRequest(input: { subject: string; bodyText: string }): ConditionalSentWatchClassification | null {
  const text = `${String(input.subject || "")}\n${visibleOutboundText(input.bodyText)}`.trim();
  if (!text) return null;

  // A closing, rejection, or final offer is not a request for a further reply.
  if (/\b(?:best\s+and\s+final|final\s+(?:offer|quotation|quote|proposal)|we\s+(?:regret|are\s+unable|decline)|unfortunately)\b|(?:عرضنا|العرض)\s+النهائي|أفضل\s+عرض\s+نهائي|نعتذر|للأسف|لا\s+يمكننا|نرفض/i.test(text)) {
    return null;
  }

  const quotationCues: Array<[RegExp, string]> = [
    [/\b(?:please|kindly)\s+(?:submit|provide|send|share)\b[\s\S]{0,160}\b(?:quotation|quote|proposal|offer)\b/i, "explicit_english_quotation_request"],
    [/\b(?:we\s+(?:look\s+forward\s+to|await)|awaiting)\s+(?:your\s+)?(?:quotation|quote|proposal|offer)\b/i, "english_quotation_expected"],
    [/(?:يرجى|نرجو)\s+[\s\S]{0,100}(?:تزويدنا|موافاتنا|إرسال|تقديم)[\s\S]{0,100}(?:عرض(?:كم)?|عرض\s+سعر|تسعير(?:كم)?|مقترح(?:كم)?)/i, "explicit_arabic_quotation_request"],
    [/(?:ننتظر|بانتظار)[\s\S]{0,80}(?:عرضكم|عرض\s+السعر|تسعيركم|مقترحكم)/i, "arabic_quotation_expected"],
  ];
  for (const [pattern, cue] of quotationCues) {
    if (pattern.test(text)) return { kind: "quotation_request", cue };
  }

  // A non-final offer/proposal can be a genuine decision point. Require an
  // explicit first-person offer plus an invitation to discuss/accept/respond;
  // merely mentioning an offer is deliberately not enough.
  const clearOfferCues: Array<[RegExp, string]> = [
    [/\b(?:please\s+find\s+(?:attached|enclosed)|we\s+(?:hereby\s+)?(?:submit|present|offer))\b[\s\S]{0,180}\b(?:our\s+)?(?:quotation|quote|proposal|offer)\b[\s\S]{0,180}\b(?:acceptance|approval|comments?|feedback|discussion|response)\b/i, "explicit_english_offer_with_response_context"],
    [/(?:نرفق|نقدم|يسعدنا\s+تقديم)[\s\S]{0,140}(?:عرضنا|عرض\s+السعر|مقترحنا)[\s\S]{0,180}(?:موافقتكم|ملاحظاتكم|ردكم|مناقشت|اعتمادكم)/i, "explicit_arabic_offer_with_response_context"],
  ];
  for (const [pattern, cue] of clearOfferCues) {
    if (pattern.test(text)) return { kind: "clear_offer", cue };
  }

  const replyCues: Array<[RegExp, string]> = [
    [/\b(?:please|kindly)\s+(?:reply|respond|confirm)\b/i, "explicit_english_reply_request"],
    [/\b(?:we\s+(?:look\s+forward\s+to|await)|awaiting)\s+(?:your\s+)?(?:reply|response|confirmation)\b/i, "english_reply_expected"],
    [/\b(?:please|kindly)\s+(?:provide|send|share)\b[\s\S]{0,120}\b(?:reply|response|confirmation|comments?|feedback)\b/i, "english_response_material_requested"],
    [/(?:يرجى|نرجو)\s+[\s\S]{0,100}(?:الرد|التأكيد|موافاتنا|إفادتنا|تزويدنا)[\s\S]{0,100}(?:ردكم|تأكيدكم|ملاحظاتكم|إفادتكم|موافقتكم)?/i, "explicit_arabic_reply_request"],
    [/(?:ننتظر|بانتظار)[\s\S]{0,80}(?:ردكم|تأكيدكم|موافقتكم|إفادتكم)/i, "arabic_reply_expected"],
  ];
  for (const [pattern, cue] of replyCues) {
    if (pattern.test(text)) return { kind: "reply_request", cue };
  }
  return null;
}

export function sourceRecordIdForConditionalSentWatch(sentEmailId: number) {
  return `sent-email-${sentEmailId}`;
}

/** Builds a plan only for a future, linked Sent message that matches the strict allow-list. */
export function planConditionalSentWatch(
  sent: ConditionalSentWatchSent,
  calendar?: DubaiBusinessCalendar,
): { plan: ConditionalSentWatchPlan } | { skip: ConditionalSentWatchSkipReason } {
  const sentAt = utcIsoTimestamp(sent.receivedAt);
  if (!sentAt) return { skip: "invalid_sent_timestamp" };
  if (new Date(sentAt).getTime() <= new Date(CONDITIONAL_SENT_WATCH_ACTIVATION_AT).getTime()) return { skip: "before_activation" };
  if (sent.folderName !== "Sent") return { skip: "not_sent" };
  if (!sent.linkedWorkFileId || !sent.projectId || sent.workFileStatus !== "open") return { skip: "work_file_not_open" };
  const recipientEmail = extractSingleToRecipient(sent.toText);
  if (!recipientEmail) return { skip: "not_single_to_recipient" };
  const classification = classifyConditionalSentWatchRequest({ subject: sent.subject, bodyText: sent.bodyText });
  if (!classification) return { skip: "not_whitelisted_reply_or_quotation_request" };

  return {
    plan: {
      sentEmailId: sent.id,
      workFileId: sent.linkedWorkFileId,
      projectId: sent.projectId,
      recipientEmail,
      sentAt,
      followUpAt: addDubaiBusinessDays(sentAt, 3, calendar),
      sourceRecordId: sourceRecordIdForConditionalSentWatch(sent.id),
      classification,
    },
  };
}

/**
 * An answer is suitable only when it is a post-Sent, strict sender+subject
 * thread response and has not been linked to a different work file. It does
 * not infer answer quality from arbitrary keywords.
 */
export function isSuitableInboundReplyForConditionalWatch(input: {
  plan: ConditionalSentWatchPlan;
  sent: ConditionalSentWatchSent;
  inbound: ConditionalSentWatchInbound;
}) {
  if (input.inbound.linkedWorkFileId && input.inbound.linkedWorkFileId !== input.plan.workFileId) return false;
  const sentAt = utcSqlTimestamp(input.sent.receivedAt);
  const receivedAt = utcSqlTimestamp(input.inbound.receivedAt);
  if (!sentAt || !receivedAt) return false;
  return isRelevantWatchReply({
    sentTo: input.sent.toText,
    sentSubject: input.sent.subject,
    sentAt,
    receivedFrom: input.inbound.fromEmail,
    receivedSubject: input.inbound.subject,
    receivedAt,
    receivedBody: input.inbound.bodyText,
  });
}

export class ConditionalSentWatchSeeder {
  constructor(private readonly store: ConditionalSentWatchSeedStore) {}

  async seed(input: { userId: number; limit?: number; calendar?: DubaiBusinessCalendar }) {
    const limit = Math.max(1, Math.min(input.limit || 40, 100));
    const sentRows = await this.store.listUnwatchedSentCandidates({
      userId: input.userId,
      activationAt: CONDITIONAL_SENT_WATCH_ACTIVATION_AT,
      limit,
    });
    const skipped: Array<{ emailId: number; reason: ConditionalSentWatchSkipReason }> = [];
    let created = 0;
    let replayed = 0;
    let replyAlreadyPresent = 0;

    for (const sent of sentRows) {
      const planned = planConditionalSentWatch(sent, input.calendar);
      if ("skip" in planned) {
        skipped.push({ emailId: sent.id, reason: planned.skip });
        continue;
      }
      const inbound = await this.store.findInboundCandidates({
        userId: input.userId,
        recipientEmail: planned.plan.recipientEmail,
        sentAt: planned.plan.sentAt,
      });
      const replyExists = inbound.messages.some(message => isSuitableInboundReplyForConditionalWatch({ plan: planned.plan, sent, inbound: message }));
      if (replyExists) {
        replyAlreadyPresent += 1;
        skipped.push({ emailId: sent.id, reason: "reply_already_present" });
        continue;
      }
      // Do not create a late watch when bounded reply discovery cannot prove that
      // all potential replies were examined; the next invocation may retry.
      if (!inbound.complete) {
        skipped.push({ emailId: sent.id, reason: "reply_scan_incomplete" });
        continue;
      }
      const result = await this.store.createWaitingWatchIfAbsent({ ...planned.plan, userId: input.userId });
      if (result.replayed) replayed += 1;
      else created += 1;
    }

    return {
      examined: sentRows.length,
      created,
      replayed,
      replyAlreadyPresent,
      skipped,
      externalSideEffects: false as const,
    };
  }
}

class DatabaseConditionalSentWatchSeedStore implements ConditionalSentWatchSeedStore {
  async listUnwatchedSentCandidates(input: { userId: number; activationAt: string; limit: number }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const activationAt = utcSqlTimestamp(input.activationAt);
    if (!activationAt) throw new Error("invalid_activation_timestamp");
    return db.select({
      id: comoNextEmailMessages.id,
      folderName: comoNextEmailMessages.folderName,
      linkedWorkFileId: comoNextEmailMessages.linkedWorkFileId,
      workFileStatus: comoNextWorkFiles.workFileStatus,
      projectId: comoNextWorkFiles.projectId,
      toText: comoNextEmailMessages.toText,
      ccText: comoNextEmailMessages.ccText,
      subject: comoNextEmailMessages.subject,
      bodyText: comoNextEmailMessages.bodyText,
      receivedAt: comoNextEmailMessages.receivedAt,
    }).from(comoNextEmailMessages)
      .innerJoin(comoNextWorkFiles, eq(comoNextEmailMessages.linkedWorkFileId, comoNextWorkFiles.id))
      .where(and(
        eq(comoNextEmailMessages.userId, input.userId),
        eq(comoNextEmailMessages.folderName, "Sent"),
        eq(comoNextWorkFiles.workFileStatus, "open"),
        isNotNull(comoNextEmailMessages.linkedWorkFileId),
        gt(comoNextEmailMessages.receivedAt, activationAt),
        sql`NOT EXISTS (
          SELECT 1 FROM como_next_actions existing_watch
          WHERE existing_watch.source_system = ${CONDITIONAL_SENT_WATCH_SOURCE_SYSTEM}
            AND existing_watch.source_record_id = CONCAT('sent-email-', ${comoNextEmailMessages.id})
        )`,
      ))
      .orderBy(asc(comoNextEmailMessages.receivedAt), asc(comoNextEmailMessages.id))
      .limit(input.limit)
      .then(rows => rows.map(row => ({ ...row, id: Number(row.id), linkedWorkFileId: row.linkedWorkFileId == null ? null : Number(row.linkedWorkFileId), projectId: row.projectId == null ? null : Number(row.projectId) })));
  }

  async findInboundCandidates(input: { userId: number; recipientEmail: string; sentAt: string }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const sentAt = utcSqlTimestamp(input.sentAt);
    if (!sentAt) throw new Error("invalid_sent_timestamp");
    const rows = await db.select({
      id: comoNextEmailMessages.id,
      fromEmail: comoNextEmailMessages.fromEmail,
      subject: comoNextEmailMessages.subject,
      bodyText: comoNextEmailMessages.bodyText,
      receivedAt: comoNextEmailMessages.receivedAt,
      linkedWorkFileId: comoNextEmailMessages.linkedWorkFileId,
    }).from(comoNextEmailMessages).where(and(
      eq(comoNextEmailMessages.userId, input.userId),
      eq(comoNextEmailMessages.folderName, "INBOX"),
      gt(comoNextEmailMessages.receivedAt, sentAt),
      eq(comoNextEmailMessages.fromEmail, input.recipientEmail),
    )).orderBy(asc(comoNextEmailMessages.receivedAt), asc(comoNextEmailMessages.id)).limit(MAX_INBOUND_REPLY_CANDIDATES + 1);
    return {
      messages: rows.slice(0, MAX_INBOUND_REPLY_CANDIDATES).map(row => ({
        ...row,
        id: Number(row.id),
        linkedWorkFileId: row.linkedWorkFileId == null ? null : Number(row.linkedWorkFileId),
      })),
      complete: rows.length <= MAX_INBOUND_REPLY_CANDIDATES,
    };
  }

  async createWaitingWatchIfAbsent(input: ConditionalSentWatchPlan & { userId: number }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const subject = input.sourceRecordId;
    const title = `انتظار رد من ${input.recipientEmail} بشأن الرسالة ${subject}`.slice(0, 500);
    const followUpAt = utcSqlTimestamp(input.followUpAt);
    if (!followUpAt) throw new Error("invalid_follow_up_timestamp");

    return db.transaction(async tx => {
      const [alreadyCreated] = await tx.select({ id: comoNextActions.id }).from(comoNextActions).where(and(
        eq(comoNextActions.sourceSystem, CONDITIONAL_SENT_WATCH_SOURCE_SYSTEM),
        eq(comoNextActions.sourceRecordId, input.sourceRecordId),
      )).limit(1);
      if (alreadyCreated) return { actionId: Number(alreadyCreated.id), replayed: true };

      // The unique source key remains the final idempotency guard under concurrent
      // sync retries. LAST_INSERT_ID returns the existing ID without creating an
      // extra action or audit event on the duplicate path.
      const inserted = await tx.insert(comoNextActions).values({
        userId: input.userId,
        projectId: input.projectId,
        workFileId: input.workFileId,
        title,
        description: `انتظار داخلي لرد على رسالة Sent #${input.sentEmailId}. التصنيف المحدد: ${input.classification.kind}/${input.classification.cue}. لا يُنشئ هذا الإجراء مسودة أو تذكيرًا أو إرسالًا.`,
        acceptanceCriteria: "تحقق من وصول رد مناسب في الخيط بعد موعد المراجعة؛ ألغِ الانتظار عند وجوده، ولا تنشئ أو ترسل تذكيرًا تلقائيًا.",
        ownerType: "manus",
        ownerUserId: null,
        actionStatus: "waiting_external",
        priority: "normal",
        dueAt: null,
        followUpAt,
        attentionAt: followUpAt,
        sourceSystem: CONDITIONAL_SENT_WATCH_SOURCE_SYSTEM,
        sourceRecordId: input.sourceRecordId,
      }).onDuplicateKeyUpdate({
        set: { id: sql`LAST_INSERT_ID(${comoNextActions.id})` },
      });
      const header = inserted[0] as { insertId?: number; affectedRows?: number };
      const [watch] = await tx.select({ id: comoNextActions.id }).from(comoNextActions).where(and(
        eq(comoNextActions.sourceSystem, CONDITIONAL_SENT_WATCH_SOURCE_SYSTEM),
        eq(comoNextActions.sourceRecordId, input.sourceRecordId),
      )).limit(1);
      if (!watch) throw new Error("conditional_sent_watch_not_persisted");
      const replayed = Number(header.affectedRows) !== 1;
      if (!replayed) {
        await appendEvent(tx, {
          userId: input.userId,
          projectId: input.projectId,
          workFileId: input.workFileId,
          actionId: Number(watch.id),
          actorType: "system",
          actorUserId: null,
          eventType: "conditional_sent_watch_created",
          summary: `تسجيل انتظار رد داخلي على الرسالة Sent #${input.sentEmailId}`,
          payload: { sentEmailId: input.sentEmailId, followUpAt, recipientEmail: input.recipientEmail },
          idempotencyKey: `conditional-sent-watch:${input.sourceRecordId}`,
        });
      }
      return { actionId: Number(watch.id), replayed };
    });
  }
}

/**
 * Production API for the integration owner. Call only after the read-only Sent
 * and INBOX imports are durable, then call reconcileConditionalSentWatches to
 * resolve/mature already-created watches. This function never sends mail,
 * writes a mailbox Draft, or invokes an LLM.
 */
export async function seedConditionalSentWatches(input: {
  userId: number;
  limit?: number;
  /** Optional, fact-backed exceptional Dubai calendar; omit for the default. */
  calendar?: DubaiBusinessCalendar;
}) {
  return new ConditionalSentWatchSeeder(new DatabaseConditionalSentWatchSeedStore()).seed(input);
}
