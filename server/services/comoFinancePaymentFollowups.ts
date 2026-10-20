import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextEmailMessages,
  comoNextEmailSyncSettings,
  comoNextOwnerPreferences,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { appendEvent, createCommunicationDraftCommand } from "./comoNextCommands";
import { invoiceKeys } from "./comoWorkFileLifecycle";

/**
 * This service is intentionally narrow.  It watches only future, persisted Sent
 * messages from the configured COMO mailbox and writes a Draft to that mailbox;
 * it never sends SMTP mail, mutates IMAP flags, or creates an external reminder.
 */
export const FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM = "finance_payment_watch";
export const FINANCE_PAYMENT_WATCH_ACTIVATION_AT = "2026-10-10T05:23:28.000Z";
export const FINANCE_PAYMENT_POLICY_KEY = "finance_disbursement_policy";
export const FINANCE_PAYMENT_POLICY_SOURCE_RECORD_ID = "owner-finance-policy-20261010";
export const FINANCE_PAYMENT_MAILBOX_KEY = "8f9b29e32c80ee32489cff2bedaac59a19c26d0996d245bbd8c5c3ee554f168f";

const OWNER_EMAIL = "a.zaqout@comodevelopments.com";
const WAEL_EMAIL = "wael@zooma.ae";
const FINANCE_CC = ["shahid@zooma.ae", "account.mrt@zooma.ae"] as const;
const THREAD_SENDERS = [WAEL_EMAIL, "shahid@zooma.ae", "account.mrt@zooma.ae"] as const;
const ACTIVE_WORK_FILE_STATUSES = ["open", "waiting", "blocked"] as const;
const OPEN_WATCH_STATUSES = ["open", "waiting_external"] as const;
const MAX_ITEMS_PER_INVOCATION = 3;
const MAX_CANDIDATE_SCAN = 60;
const MAX_THREAD_SCAN = 500;

type FinanceActionStatus = "open" | "waiting_external" | "completed_pending_verification" | "verified" | "cancelled";

export type FinancePaymentSent = {
  id: number;
  userId: number;
  projectId: number | null;
  workFileId: number | null;
  workFileStatus: string | null;
  mailboxKey: string;
  folderName: string;
  fromEmail: string;
  toText: string | null;
  ccText: string | null;
  subject: string;
  bodyText: string;
  sentAt: string;
  messageId: string | null;
  action?: FinancePaymentAction | null;
};

export type FinancePaymentAction = {
  id: number;
  userId: number;
  projectId: number;
  workFileId: number;
  actionStatus: FinanceActionStatus;
  evidenceReference?: string | null;
};

export type FinanceThreadReply = {
  id: number;
  fromEmail: string;
  subject: string;
  bodyText: string;
  /** Present when read from the mailbox projection; openFinanceReview re-reads it under lock. */
  bodySha256?: string;
  receivedAt: string;
  linkedWorkFileId: number | null;
};

export type FinancePaymentPlan = {
  sentEmailId: number;
  userId: number;
  projectId: number;
  workFileId: number;
  sentAt: string;
  dueAt: string;
  sourceRecordId: string;
  draftKey: string;
};

export type FinancePaymentSkipReason =
  | "before_activation"
  | "invalid_sent_timestamp"
  | "not_configured_como_sent"
  | "not_owner_sent"
  | "not_active_linked_work_file"
  | "not_exact_finance_envelope"
  | "not_explicit_payment_request";

export type FinancePaymentTerminalReason = FinancePaymentSkipReason | "invoice_paid_recorded";
export type FinancePaymentDeferredReason = "reply_scan_incomplete" | "not_due" | "mailbox_import_or_processing_not_fresh";

export type FinancePaymentFollowupStore = {
  isPolicyEnabled(): Promise<boolean>;
  isInvoicePaidRecorded?(sent: FinancePaymentSent): Promise<boolean>;
  hasFreshCompletedImportAndProcessing(input: { userId: number; now: string; maxAgeMinutes: number }): Promise<boolean>;
  listCandidates(input: { userId: number; limit: number }): Promise<FinancePaymentSent[]>;
  recordTerminalDisposition(input: { sent: FinancePaymentSent; reason: FinancePaymentTerminalReason }): Promise<void>;
  recordPendingWatchExamined(input: {
    action: FinancePaymentAction;
    plan: FinancePaymentPlan;
    reason: FinancePaymentDeferredReason;
  }): Promise<void>;
  ensureWatchIfAbsent(input: FinancePaymentPlan): Promise<{ action: FinancePaymentAction; replayed: boolean }>;
  findThreadReplies(input: FinancePaymentPlan): Promise<{ replies: FinanceThreadReply[]; complete: boolean }>;
  // Existing stores may return void after opening. A false result is the
  // explicit replay signal: every supplied reply already has a trusted receipt.
  openFinanceReview(input: { action: FinancePaymentAction; plan: FinancePaymentPlan; replies: FinanceThreadReply[] }): Promise<void | false>;
  saveThreadDraft(input: { plan: FinancePaymentPlan; sent: FinancePaymentSent; subject: string; body: string }): Promise<{ folder: string; uid: number | null; created: boolean }>;
  completeWatchAfterDraft(input: { action: FinancePaymentAction; plan: FinancePaymentPlan; evidenceReference: string }): Promise<void>;
};

function parseUtc(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed.replace(" ", "T")}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sqlUtc(value: string): string | null {
  const date = parseUtc(value);
  return date ? date.toISOString().slice(0, 19).replace("T", " ") : null;
}

function isoUtc(value: string): string | null {
  const date = parseUtc(value);
  return date ? date.toISOString() : null;
}

function emailAddresses(value: string | null | undefined) {
  const matches = String(value || "").match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [];
  return [...new Set(matches.map(item => item.toLowerCase()))].sort();
}

/** Removes quoted history so an old request cannot activate a new watch. */
export function currentFinanceEmailText(value: string) {
  const lines: string[] = [];
  for (const line of String(value || "").split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*(?:from|sent|to|subject|من|المرسل|تاريخ)\s*:/i.test(line)
      || /^\s*(?:on\s+.+\s+wrote:|[-_]{2,}\s*original message\s*[-_]{2,})/i.test(line)) break;
    lines.push(line);
  }
  return lines.join("\n").replace(/\s+/g, " ").trim().slice(0, 20_000);
}

/** Exact To/CC envelope prevents this rule from spilling into ordinary mail. */
export function hasExactFinancePaymentEnvelope(input: { toText: string | null; ccText: string | null }) {
  const to = emailAddresses(input.toText);
  const cc = emailAddresses(input.ccText);
  return to.length === 1 && to[0] === WAEL_EMAIL
    && cc.length === FINANCE_CC.length
    && cc.every((address, index) => address === FINANCE_CC.slice().sort()[index]);
}

/**
 * Conservative, explicit request detector.  English phrases additionally need
 * an invoice/facture cue; quoted history and boilerplate contract-payment terms
 * are deliberately excluded.
 */
export function isFinancePaymentRequest(input: { subject?: string | null; bodyText: string | null }) {
  const body = currentFinanceEmailText(input.bodyText || "");
  if (!body) return false;
  if (/payments?\s+will\s+be\s+(?:made|processed)\s+in\s+accordance(?:\s+with)?|(?:سيتم|تتم)\s+(?:الدفعات|المدفوعات)\s+وفق/i.test(body)) return false;

  const arabicExplicit = /(?:طلب\s+صرف|يرجى\s+صرف|يرجى\s+سداد\s+الفاتورة)/i.test(body);
  if (arabicExplicit) return true;

  const englishExplicit = /\b(?:payment\s+request|(?:kindly|please)\s+(?:arrange|process)\s+payment|please\s+review\b[\s\S]{0,300}\band\s+arrange\s+payment\s+if\s+due)\b/i.test(body);
  const invoiceCue = /\b(?:invoice|tax\s+invoice|inv\.?\s*(?:no\.?|#)?\s*[a-z0-9-]+|facture)\b|فاتور(?:ة|ه)/i.test(body);
  return englishExplicit && invoiceCue;
}

export function normalizeFinanceThreadSubject(subject: string) {
  return String(subject || "")
    .replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/[\s\-–—_]+/g, " ")
    .trim()
    .toLowerCase();
}

export function financePaymentSourceRecordId(sentEmailId: number) {
  return `sent-email-${sentEmailId}`;
}

export function financePaymentDraftKey(sentEmailId: number) {
  return `finance-payment-followup:${sentEmailId}`;
}

function financePaymentTerminalDispositionEventKey(sentEmailId: number) {
  return `finance-payment-watch:terminal:${financePaymentSourceRecordId(sentEmailId)}`;
}

/** Four calendar days are exactly 96 hours from the persisted Sent UTC timestamp. */
export function fourCalendarDaysAfter(sentAt: string) {
  const parsed = parseUtc(sentAt);
  return parsed ? new Date(parsed.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString() : null;
}

export function policyBodySupportsGeneralFinanceFollowup(body: string | null | undefined) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const general = /\bgeneral\b|عام(?:ة|اً)?|(?:جميع|كل)\s+(?:المشاريع|طلبات\s+الصرف)|المشاريع\s+الرسمية|all\s+(?:official\s+)?projects/i.test(text);
  const fourCalendarDays = /\b(?:four|4)\s*calendar\s*days\b|(?:أربع(?:ة)?|[4٤])\s+أيام\s*\(?\s*تقويمية\s*\)?/i.test(text);
  return general && fourCalendarDays;
}

export function planFinancePaymentFollowup(sent: FinancePaymentSent): { plan: FinancePaymentPlan } | { skip: FinancePaymentSkipReason } {
  const sentAt = isoUtc(sent.sentAt);
  if (!sentAt) return { skip: "invalid_sent_timestamp" };
  if (new Date(sentAt).getTime() <= new Date(FINANCE_PAYMENT_WATCH_ACTIVATION_AT).getTime()) return { skip: "before_activation" };
  if (sent.mailboxKey !== FINANCE_PAYMENT_MAILBOX_KEY || sent.folderName !== "Sent") return { skip: "not_configured_como_sent" };
  if (sent.fromEmail.trim().toLowerCase() !== OWNER_EMAIL) return { skip: "not_owner_sent" };
  if (!sent.workFileId || !sent.projectId || !sent.workFileStatus || !ACTIVE_WORK_FILE_STATUSES.includes(sent.workFileStatus as (typeof ACTIVE_WORK_FILE_STATUSES)[number])) {
    return { skip: "not_active_linked_work_file" };
  }
  if (!hasExactFinancePaymentEnvelope(sent)) return { skip: "not_exact_finance_envelope" };
  if (!isFinancePaymentRequest({ subject: sent.subject, bodyText: sent.bodyText })) return { skip: "not_explicit_payment_request" };
  const dueAt = fourCalendarDaysAfter(sentAt);
  if (!dueAt) return { skip: "invalid_sent_timestamp" };
  return {
    plan: {
      sentEmailId: sent.id,
      userId: sent.userId,
      projectId: sent.projectId,
      workFileId: sent.workFileId,
      sentAt,
      dueAt,
      sourceRecordId: financePaymentSourceRecordId(sent.id),
      draftKey: financePaymentDraftKey(sent.id),
    },
  };
}

export function isHumanFinanceThreadReply(input: { sent: FinancePaymentSent; reply: FinanceThreadReply }) {
  const sentAt = parseUtc(input.sent.sentAt);
  const receivedAt = parseUtc(input.reply.receivedAt);
  if (!sentAt || !receivedAt || receivedAt.getTime() <= sentAt.getTime()) return false;
  if (!THREAD_SENDERS.includes(input.reply.fromEmail.trim().toLowerCase() as (typeof THREAD_SENDERS)[number])) return false;
  if (input.reply.linkedWorkFileId && input.reply.linkedWorkFileId !== input.sent.workFileId) return false;
  if (normalizeFinanceThreadSubject(input.reply.subject) !== normalizeFinanceThreadSubject(input.sent.subject)) return false;
  if (/^\s*(?:automatic reply|out of office|auto:|undeliverable|delivery status)/i.test(input.reply.subject)) return false;
  return currentFinanceEmailText(input.reply.bodyText).length > 2;
}

export function financePaymentFollowupDraft(input: { subject: string }) {
  const subject = String(input.subject || "").trim();
  return {
    subject: /^\s*re\s*:/i.test(subject) ? subject : `Re: ${subject}`,
    body: [
      "Dear Wael,",
      "",
      "I hope you are well. Could you please provide an update on the payment request below and let us know if any further documents or action are required from our side?",
      "",
      "Kind regards,",
      "",
      "Abdalrahman Zaqout",
      "Development Director",
      "COMO Real Estate Development L.L.C.",
      "M: +971 55 106 2668",
      "E: a.zaqout@comodevelopments.com",
    ].join("\n"),
  };
}

type FinanceReviewOpenInput = {
  action: FinancePaymentAction;
  plan: FinancePaymentPlan;
  replies: FinanceThreadReply[];
};

type JsonObject = Record<string, unknown>;

function databaseRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return Array.isArray(result) ? result as T[] : [];
}

function jsonObject(value: unknown): JsonObject | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : null;
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function sha256(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

type DispatchOutputRow = {
  directiveId: number;
  dispatchState: string;
  workProductId: number | null;
  userId: number;
  projectId: number;
  workFileId: number;
  memoryId: number;
  memoryProjectId: number;
  memoryWorkFileId: number;
  memorySourceSystem: string;
  memorySourceRecordId: string | null;
  memoryType: string;
  memorySourceStatus: string;
  resultJson?: unknown;
  payloadJson?: unknown;
};

function hasTrustedDispatchOutput(input: {
  row: DispatchOutputRow;
  plan: FinancePaymentPlan;
  sourceSystem: string;
  sourceRecordPrefix: string;
}) {
  const directiveId = positiveInteger(input.row.directiveId);
  return directiveId != null
    && input.row.dispatchState === "completed"
    && Number(input.row.workProductId) === Number(input.row.memoryId)
    && Number(input.row.userId) === input.plan.userId
    && Number(input.row.projectId) === input.plan.projectId
    && Number(input.row.workFileId) === input.plan.workFileId
    && Number(input.row.memoryProjectId) === input.plan.projectId
    && Number(input.row.memoryWorkFileId) === input.plan.workFileId
    && input.row.memorySourceSystem === input.sourceSystem
    && input.row.memoryType === 'work_product'
    && input.row.memorySourceStatus === 'reviewed'
    && input.row.memorySourceRecordId === `${input.sourceRecordPrefix}${directiveId}`;
}

/**
 * A prior review is suppressive only when it is anchored to a completed Manus
 * dispatch and its persisted output on this exact user/project/work-file. The
 * e-mail is locked and its current SHA-256 is compared below, so an edited or
 * relinked source is always reviewable again.
 */
async function trustedFinanceReviewReplyIds(tx: { execute(query: unknown): Promise<unknown> }, input: FinanceReviewOpenInput) {
  const replyIds = Array.from(new Set(input.replies.map(reply => reply.id).filter(id => Number.isSafeInteger(id) && id > 0)));
  if (!replyIds.length) return new Set<number>();
  const replyIdList = sql.join(replyIds.map(id => sql`${id}`), sql`, `);
  const currentReplies = databaseRows<{ id: number; bodySha256: string; linkedWorkFileId: number | null }>(await tx.execute(sql`
    SELECT id, body_sha256 AS bodySha256, linked_work_file_id AS linkedWorkFileId
    FROM como_next_email_messages
    WHERE user_id=${input.plan.userId} AND folder_name='INBOX' AND linked_work_file_id=${input.plan.workFileId} AND id IN (${replyIdList})
    FOR UPDATE
  `));
  const currentShaByReplyId = new Map<number, string>();
  for (const reply of currentReplies) {
    const id = positiveInteger(Number(reply.id));
    const bodySha = sha256(reply.bodySha256);
    if (id != null && Number(reply.linkedWorkFileId) === input.plan.workFileId && bodySha) currentShaByReplyId.set(id, bodySha);
  }
  if (!currentShaByReplyId.size) return new Set<number>();

  const completedMailReviews = databaseRows<DispatchOutputRow>(await tx.execute(sql`
    SELECT d.directive_id AS directiveId, d.state AS dispatchState, d.work_product_id AS workProductId, d.result_json AS resultJson,
      sd.user_id AS userId, sd.project_id AS projectId, sd.work_file_id AS workFileId,
      m.id AS memoryId, m.project_id AS memoryProjectId, m.work_file_id AS memoryWorkFileId,
      m.source_system AS memorySourceSystem, m.source_record_id AS memorySourceRecordId,
      m.memory_type AS memoryType, m.source_status AS memorySourceStatus
    FROM como_manus_dispatches d
    INNER JOIN como_next_staged_directives sd ON sd.id=d.directive_id
    INNER JOIN como_next_work_memory m ON m.id=d.work_product_id
    WHERE d.state='completed' AND sd.user_id=${input.plan.userId} AND sd.project_id=${input.plan.projectId} AND sd.work_file_id=${input.plan.workFileId}
      AND m.project_id=${input.plan.projectId} AND m.work_file_id=${input.plan.workFileId}
      AND m.source_system='como_mail_execution' AND m.source_record_id=CONCAT('dispatch-review:', d.directive_id)
  `));
  const reviewedIds = new Set<number>();
  for (const review of completedMailReviews) {
    if (!hasTrustedDispatchOutput({ row: review, plan: input.plan, sourceSystem: "como_mail_execution", sourceRecordPrefix: "dispatch-review:" })) continue;
    const receipt = jsonObject(review.resultJson);
    const sourceEmailId = receipt ? positiveInteger(receipt.sourceEmailId) : null;
    const receiptSha = receipt ? sha256(receipt.bodySha256) : null;
    // responseHandling proves this was a completed handling of the inbound,
    // not merely a dispatch that happened to preserve a work product.
    const handling = jsonObject(receipt?.responseHandling);
    if (receipt?.completedNow !== true || positiveInteger(receipt?.workProductId) !== Number(review.memoryId)
      || !handling || !['draft_saved','already_replied','no_reply_needed'].includes(String(handling.kind))
      || typeof handling.evidence !== 'string' || handling.evidence.length < 30
      || typeof handling.nextStep !== 'string' || handling.nextStep.length < 30
      || sourceEmailId == null || !receiptSha) continue;
    if (currentShaByReplyId.get(sourceEmailId) === receiptSha) reviewedIds.add(sourceEmailId);
  }

  const completedFinanceReviewEvents = databaseRows<DispatchOutputRow>(await tx.execute(sql`
    SELECT d.directive_id AS directiveId, d.state AS dispatchState, d.work_product_id AS workProductId,
      sd.user_id AS userId, sd.project_id AS projectId, sd.work_file_id AS workFileId,
      m.id AS memoryId, m.project_id AS memoryProjectId, m.work_file_id AS memoryWorkFileId,
      m.source_system AS memorySourceSystem, m.source_record_id AS memorySourceRecordId,
      m.memory_type AS memoryType, m.source_status AS memorySourceStatus,
      e.payload_json AS payloadJson
    FROM como_manus_dispatches d
    INNER JOIN como_next_staged_directives sd ON sd.id=d.directive_id
    INNER JOIN como_next_work_memory m ON m.id=d.work_product_id
    INNER JOIN como_next_work_file_events e ON e.user_id=sd.user_id AND e.project_id=sd.project_id AND e.work_file_id=sd.work_file_id AND e.action_id=sd.action_id
    WHERE d.state='completed' AND sd.user_id=${input.plan.userId} AND sd.project_id=${input.plan.projectId} AND sd.work_file_id=${input.plan.workFileId}
      AND m.project_id=${input.plan.projectId} AND m.work_file_id=${input.plan.workFileId}
      AND m.source_system='como_finance_payment_review' AND m.source_record_id=CONCAT('dispatch-finance-watch:', d.directive_id)
      AND e.event_type='finance_payment_review_recorded'
      AND e.actor_type='manus' AND e.idempotency_key=CONCAT('finance-payment-review-recorded:', d.directive_id)
  `));
  for (const review of completedFinanceReviewEvents) {
    if (!hasTrustedDispatchOutput({ row: review, plan: input.plan, sourceSystem: "como_finance_payment_review", sourceRecordPrefix: "dispatch-finance-watch:" })) continue;
    const payload = jsonObject(review.payloadJson);
    if (positiveInteger(payload?.directiveId) !== Number(review.directiveId) || positiveInteger(payload?.workProductId) !== Number(review.memoryId)
      || payload?.reviewCompleted !== true || positiveInteger(payload?.sentEmailId) !== input.plan.sentEmailId || !Array.isArray(payload?.reviewedReplies)) continue;
    for (const reply of payload.reviewedReplies) {
      const reviewedReply = jsonObject(reply);
      const emailId = positiveInteger(reviewedReply?.emailId);
      const bodySha = sha256(reviewedReply?.sha256);
      if (emailId != null && bodySha && currentShaByReplyId.get(emailId) === bodySha) reviewedIds.add(emailId);
    }
  }
  return reviewedIds;
}

export class FinancePaymentFollowupReconciler {
  constructor(private readonly store: FinancePaymentFollowupStore) {}

  async reconcile(input: { userId: number; now?: string; limit?: number }) {
    const now = isoUtc(input.now || new Date().toISOString());
    if (!now) throw new Error("invalid_now_timestamp");
    if (!await this.store.isPolicyEnabled()) {
      return { examined: 0, created: 0, reviewOpened: 0, draftsPrepared: 0, skipped: ["policy_disabled"], externalSideEffects: false as const };
    }

    const limit = Math.min(Math.max(input.limit || MAX_ITEMS_PER_INVOCATION, 1), MAX_ITEMS_PER_INVOCATION);
    // Scan a bounded, larger window and validate every item before capacity is
    // applied.  This prevents ordinary Sent mail at the head of the list from
    // starving later finance requests.
    const candidates = await this.store.listCandidates({ userId: input.userId, limit: MAX_CANDIDATE_SCAN });
    let created = 0;
    let reviewOpened = 0;
    let draftsPrepared = 0;
    const skipped: Array<string | { sentEmailId: number; reason: string }> = [];
    const plannedCandidates: Array<{ sent: FinancePaymentSent; plan: FinancePaymentPlan }> = [];

    for (const sent of candidates) {
      const planned = planFinancePaymentFollowup(sent);
      if ("skip" in planned) {
        await this.store.recordTerminalDisposition({ sent, reason: planned.skip });
        skipped.push({ sentEmailId: sent.id, reason: planned.skip });
        continue;
      }
      if (await this.store.isInvoicePaidRecorded?.(sent)) {
        await this.store.recordTerminalDisposition({ sent, reason: "invoice_paid_recorded" });
        skipped.push({ sentEmailId: sent.id, reason: "invoice_paid_recorded" });
        continue;
      }
      plannedCandidates.push({ sent, plan: planned.plan });
    }

    // The database returns fresh requests first and pending watches second.
    // Always reserve one work slot for a pending watch when one exists. That
    // prevents a steady fresh stream from starving a watch that needs a later
    // retry; unfilled fresh capacity is still given back below.
    const fresh = plannedCandidates.filter(candidate => !candidate.sent.action);
    const pending = plannedCandidates.filter(candidate => candidate.sent.action);
    const pendingQuota = pending.length ? 1 : 0;
    const freshQuota = limit - pendingQuota;
    const selected = [
      ...fresh.slice(0, freshQuota),
      ...pending.slice(0, pendingQuota),
      ...fresh.slice(freshQuota),
      ...pending.slice(pendingQuota),
    ].slice(0, limit);

    for (const { sent, plan } of selected) {
      const { action, replayed } = await this.store.ensureWatchIfAbsent(plan);
      if (!replayed) created += 1;
      if (!OPEN_WATCH_STATUSES.includes(action.actionStatus as (typeof OPEN_WATCH_STATUSES)[number])) continue;

      const responseScan = await this.store.findThreadReplies(plan);
      const replies = responseScan.replies.filter(reply => isHumanFinanceThreadReply({ sent, reply }));
      if (replies.length) {
        const opened = await this.store.openFinanceReview({ action, plan, replies });
        // false is deliberately distinct from legacy void stores. A reviewed
        // reply is still a reply: leave the watch waiting and never fall
        // through to the no-reply reminder path.
        if (opened !== false) reviewOpened += 1;
        continue;
      }
      if (!responseScan.complete) {
        // This records an append-only examined cursor for queue fairness only.
        // It intentionally never changes dueAt, followUpAt, or attentionAt:
        // the payment deadline remains Sent + exactly 96 hours.
        await this.store.recordPendingWatchExamined({ action, plan, reason: "reply_scan_incomplete" });
        skipped.push({ sentEmailId: sent.id, reason: "reply_scan_incomplete" });
        continue;
      }
      if (new Date(now).getTime() < new Date(plan.dueAt).getTime()) {
        await this.store.recordPendingWatchExamined({ action, plan, reason: "not_due" });
        skipped.push({ sentEmailId: sent.id, reason: "not_due" });
        continue;
      }
      if (!await this.store.hasFreshCompletedImportAndProcessing({ userId: input.userId, now, maxAgeMinutes: 90 })) {
        await this.store.recordPendingWatchExamined({ action, plan, reason: "mailbox_import_or_processing_not_fresh" });
        skipped.push({ sentEmailId: sent.id, reason: "mailbox_import_or_processing_not_fresh" });
        continue;
      }

      // saveComoMailboxDraft searches X-COMO-Draft-Key before append, so retries
      // reuse the same Draft rather than creating a second reminder.
      const draft = financePaymentFollowupDraft({ subject: sent.subject });
      const saved = await this.store.saveThreadDraft({ plan, sent, ...draft });
      const evidenceReference = saved.uid == null
        ? `Private Email ${saved.folder}; draftKey=${plan.draftKey}`
        : `Private Email ${saved.folder} UID ${saved.uid}; draftKey=${plan.draftKey}`;
      await this.store.completeWatchAfterDraft({ action, plan, evidenceReference });
      draftsPrepared += 1;
    }

    return { examined: candidates.length, created, reviewOpened, draftsPrepared, skipped, externalSideEffects: false as const };
  }
}

/**
 * A coarse SQL prefilter keeps ordinary Sent traffic out of the bounded scan.
 * planFinancePaymentFollowup remains the authoritative check for the exact
 * envelope, current-message text, timestamps, and linked work-file state.
 */
function sqlLikelyFinancePaymentRequest() {
  const body = sql`LOWER(${comoNextEmailMessages.bodyText})`;
  return and(
    sql`${body} NOT REGEXP ${"payments?[[:space:]]+will[[:space:]]+be[[:space:]]+(made|processed)[[:space:]]+in[[:space:]]+accordance"}`,
    or(
      sql`${body} REGEXP ${"طلب[[:space:]]+صرف|يرجى[[:space:]]+صرف|يرجى[[:space:]]+سداد[[:space:]]+الفاتورة"}`,
      and(
        sql`${body} REGEXP ${"payment[[:space:]]+request|(kindly|please)[[:space:]]+(arrange|process)[[:space:]]+payment|arrange[[:space:]]+payment[[:space:]]+if[[:space:]]+due"}`,
        sql`${body} REGEXP ${"invoice|tax[[:space:]]+invoice|inv\\.?[[:space:]]*(no\\.?|#)?[[:space:]]*[a-z0-9-]+|facture"}`,
      ),
    ),
  );
}

export class DatabaseFinancePaymentFollowupStore implements FinancePaymentFollowupStore {
  async isInvoicePaidRecorded(sent: FinancePaymentSent) {
    if (!sent.workFileId) return false;
    const keys = invoiceKeys(`${sent.subject} ${currentFinanceEmailText(sent.bodyText)}`);
    if (keys.length !== 1) return false;
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const result = await db.execute(sql`SELECT id FROM como_next_lifecycle_lanes WHERE work_file_id=${sent.workFileId} AND user_id=${sent.userId} AND lane_key=${`invoice:${keys[0]}`} AND kind='payment' AND status IN ('paid_owner_reported','paid_document_verified') LIMIT 1`);
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return Array.isArray(rows) && rows.length > 0;
  }
  async isPolicyEnabled() {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const [policy] = await db.select({ body: comoNextOwnerPreferences.body })
      .from(comoNextOwnerPreferences)
      .where(and(
        eq(comoNextOwnerPreferences.memberId, "abdulrahman"),
        eq(comoNextOwnerPreferences.preferenceKey, FINANCE_PAYMENT_POLICY_KEY),
        eq(comoNextOwnerPreferences.sourceRecordId, FINANCE_PAYMENT_POLICY_SOURCE_RECORD_ID),
        eq(comoNextOwnerPreferences.isCurrent, 1),
      )).limit(1);
    return Boolean(policy && policyBodySupportsGeneralFinanceFollowup(policy.body));
  }

  async hasFreshCompletedImportAndProcessing(input: { userId: number; now: string; maxAgeMinutes: number }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const now = parseUtc(input.now);
    if (!now) return false;
    const rows = await db.select({ mailboxKey: comoNextEmailSyncSettings.mailboxKey, lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt, lastStatus: comoNextEmailSyncSettings.lastStatus })
      .from(comoNextEmailSyncSettings)
      .where(and(
        eq(comoNextEmailSyncSettings.userId, input.userId),
        inArray(comoNextEmailSyncSettings.mailboxKey, ["owner-primary", "owner-primary-processing"]),
        eq(comoNextEmailSyncSettings.lastStatus, "success"),
      ));
    const freshnessFloor = now.getTime() - input.maxAgeMinutes * 60 * 1000;
    return ["owner-primary", "owner-primary-processing"].every(mailboxKey => {
      const row = rows.find(item => item.mailboxKey === mailboxKey);
      const completedAt = row?.lastSuccessAt ? parseUtc(row.lastSuccessAt) : null;
      return Boolean(completedAt && completedAt.getTime() >= freshnessFloor && completedAt.getTime() <= now.getTime());
    });
  }

  async listCandidates(input: { userId: number; limit: number }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const scanLimit = Math.min(Math.max(input.limit, 1), MAX_CANDIDATE_SCAN);
    const pendingScanLimit = Math.floor(scanLimit / 2);
    const freshScanLimit = scanLimit - pendingScanLimit;
    // A retryable pending watch receives a new append-only examined event each
    // time it cannot progress. Sort those events oldest-first (with never
    // examined watches first) so the first old Sent row cannot monopolize the
    // reserved pending slot. This is deliberately independent of the action's
    // scheduling timestamps.
    const pendingLastExaminedAt = sql<string | null>`(
      SELECT MAX(examined.occurred_at)
      FROM como_next_work_file_events examined
      WHERE examined.action_id = ${comoNextActions.id}
        AND examined.event_type = ${"finance_payment_watch_examined"}
    )`;
    const mapRow = (row: any): FinancePaymentSent => ({
      id: Number(row.id), userId: Number(row.userId), projectId: row.projectId == null ? null : Number(row.projectId),
      workFileId: row.workFileId == null ? null : Number(row.workFileId), workFileStatus: row.workFileStatus,
      mailboxKey: row.mailboxKey, folderName: row.folderName, fromEmail: row.fromEmail, toText: row.toText,
      ccText: row.ccText, subject: row.subject, bodyText: row.bodyText, sentAt: row.sentAt, messageId: row.messageId,
      action: row.actionId == null ? null : {
        id: Number(row.actionId), userId: Number(row.actionUserId), projectId: Number(row.actionProjectId), workFileId: Number(row.actionWorkFileId),
        actionStatus: row.actionStatus as FinanceActionStatus, evidenceReference: row.evidenceReference,
      },
    });
    const actionRows = await db.select({
      id: comoNextEmailMessages.id, userId: comoNextEmailMessages.userId, projectId: comoNextEmailMessages.linkedProjectId,
      workFileId: comoNextEmailMessages.linkedWorkFileId, workFileStatus: comoNextWorkFiles.workFileStatus,
      mailboxKey: comoNextEmailMessages.mailboxKey, folderName: comoNextEmailMessages.folderName, fromEmail: comoNextEmailMessages.fromEmail,
      toText: comoNextEmailMessages.toText, ccText: comoNextEmailMessages.ccText, subject: comoNextEmailMessages.subject,
      bodyText: comoNextEmailMessages.bodyText, sentAt: comoNextEmailMessages.receivedAt, messageId: comoNextEmailMessages.messageId,
      actionId: comoNextActions.id, actionUserId: comoNextActions.userId, actionProjectId: comoNextActions.projectId,
      actionWorkFileId: comoNextActions.workFileId, actionStatus: comoNextActions.actionStatus, evidenceReference: comoNextActions.evidenceReference,
      lastExaminedAt: pendingLastExaminedAt,
    }).from(comoNextActions)
      .innerJoin(comoNextEmailMessages, sql`${comoNextActions.sourceRecordId} = CONCAT('sent-email-', ${comoNextEmailMessages.id})`)
      .innerJoin(comoNextWorkFiles, eq(comoNextEmailMessages.linkedWorkFileId, comoNextWorkFiles.id))
      .where(and(
        eq(comoNextActions.userId, input.userId),
        eq(comoNextActions.sourceSystem, FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM),
        // open is reserved for finance_review.  Keep that action visible in the
        // kitchen, but do not repeatedly select it as a pending mailbox watch.
        eq(comoNextActions.actionStatus, "waiting_external"),
        eq(comoNextEmailMessages.userId, input.userId),
        eq(comoNextEmailMessages.mailboxKey, FINANCE_PAYMENT_MAILBOX_KEY),
        eq(comoNextEmailMessages.folderName, "Sent"),
        inArray(comoNextWorkFiles.workFileStatus, ACTIVE_WORK_FILE_STATUSES),
      )).orderBy(
        sql`CASE WHEN ${pendingLastExaminedAt} IS NULL THEN 0 ELSE 1 END`,
        asc(pendingLastExaminedAt),
        asc(comoNextEmailMessages.receivedAt),
        asc(comoNextEmailMessages.id),
      ).limit(pendingScanLimit);

    const newRows = await db.select({
      id: comoNextEmailMessages.id, userId: comoNextEmailMessages.userId, projectId: comoNextEmailMessages.linkedProjectId,
      workFileId: comoNextEmailMessages.linkedWorkFileId, workFileStatus: comoNextWorkFiles.workFileStatus,
      mailboxKey: comoNextEmailMessages.mailboxKey, folderName: comoNextEmailMessages.folderName, fromEmail: comoNextEmailMessages.fromEmail,
      toText: comoNextEmailMessages.toText, ccText: comoNextEmailMessages.ccText, subject: comoNextEmailMessages.subject,
      bodyText: comoNextEmailMessages.bodyText, sentAt: comoNextEmailMessages.receivedAt, messageId: comoNextEmailMessages.messageId,
      actionId: sql<number | null>`NULL`, actionUserId: sql<number | null>`NULL`, actionProjectId: sql<number | null>`NULL`,
      actionWorkFileId: sql<number | null>`NULL`, actionStatus: sql<string | null>`NULL`, evidenceReference: sql<string | null>`NULL`,
    }).from(comoNextEmailMessages)
      .innerJoin(comoNextWorkFiles, eq(comoNextEmailMessages.linkedWorkFileId, comoNextWorkFiles.id))
      .leftJoin(comoNextActions, and(
        eq(comoNextActions.sourceSystem, FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM),
        sql`${comoNextActions.sourceRecordId} = CONCAT('sent-email-', ${comoNextEmailMessages.id})`,
      ))
      .where(and(
        eq(comoNextEmailMessages.userId, input.userId),
        eq(comoNextEmailMessages.mailboxKey, FINANCE_PAYMENT_MAILBOX_KEY),
        eq(comoNextEmailMessages.folderName, "Sent"),
        gt(comoNextEmailMessages.receivedAt, sqlUtc(FINANCE_PAYMENT_WATCH_ACTIVATION_AT)!),
        eq(comoNextEmailMessages.fromEmail, OWNER_EMAIL),
        inArray(comoNextWorkFiles.workFileStatus, ACTIVE_WORK_FILE_STATUSES),
        isNull(comoNextActions.id),
        sqlLikelyFinancePaymentRequest(),
        sql`NOT EXISTS (
          SELECT 1 FROM como_next_work_file_events terminal_disposition
          WHERE terminal_disposition.idempotency_key = CONCAT('finance-payment-watch:terminal:sent-email-', ${comoNextEmailMessages.id})
        )`,
      )).orderBy(asc(comoNextEmailMessages.receivedAt), asc(comoNextEmailMessages.id)).limit(freshScanLimit);
    // Advance the oldest fresh request first. Once it has a durable watch, it
    // leaves this fresh query, so bounded invocations drain a large backlog
    // instead of forever preferring the latest 30 Sent messages.
    return [...newRows, ...actionRows].map(mapRow);
  }

  async recordTerminalDisposition(input: { sent: FinancePaymentSent; reason: FinancePaymentTerminalReason }) {
    const workFileId = input.sent.workFileId;
    const projectId = input.sent.projectId;
    // listCandidates is inner-joined to an active work file. Guard anyway so a
    // malformed store never turns an unlinked message into a cursor event.
    if (!workFileId || !projectId) throw new Error("finance_payment_terminal_disposition_missing_work_file");
    const eventKey = financePaymentTerminalDispositionEventKey(input.sent.id);
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id = ${workFileId} FOR UPDATE`);
      const [existing] = await tx.select({ id: comoNextWorkFileEvents.id }).from(comoNextWorkFileEvents)
        .where(eq(comoNextWorkFileEvents.idempotencyKey, eventKey)).limit(1);
      if (existing) return;
      await appendEvent(tx, {
        userId: input.sent.userId,
        projectId,
        workFileId,
        actorType: "system",
        actorUserId: null,
        eventType: "finance_payment_watch_terminal_disposition",
        summary: `حسم عدم إنشاء متابعة صرف للرسالة Sent #${input.sent.id}: ${input.reason}`,
        payload: { sentEmailId: input.sent.id, disposition: "terminal", reason: input.reason },
        idempotencyKey: eventKey,
      });
    });
  }

  async recordPendingWatchExamined(input: {
    action: FinancePaymentAction;
    plan: FinancePaymentPlan;
    reason: FinancePaymentDeferredReason;
  }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    await db.transaction(async tx => {
      // Serialize with the action's work file before recording the retry cursor.
      // No idempotency key is used: the newest examined event is the durable
      // last-checked timestamp used by the pending-query ordering above.
      await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id = ${input.plan.workFileId} FOR UPDATE`);
      const [current] = await tx.select({ actionStatus: comoNextActions.actionStatus, sourceSystem: comoNextActions.sourceSystem })
        .from(comoNextActions).where(eq(comoNextActions.id, input.action.id)).limit(1);
      if (!current
        || current.sourceSystem !== FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM
        || current.actionStatus !== "waiting_external") return;
      await appendEvent(tx, {
        userId: input.plan.userId,
        projectId: input.plan.projectId,
        workFileId: input.plan.workFileId,
        actionId: input.action.id,
        actorType: "system",
        actorUserId: null,
        eventType: "finance_payment_watch_examined",
        summary: `فُحصت متابعة طلب الصرف #${input.plan.sentEmailId} وستعاد المحاولة عند توفر الشرط: ${input.reason}`,
        payload: {
          sentEmailId: input.plan.sentEmailId,
          reason: input.reason,
          dueAt: sqlUtc(input.plan.dueAt),
          externalSideEffect: false,
        },
      });
    });
  }

  async ensureWatchIfAbsent(plan: FinancePaymentPlan) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const dueAt = sqlUtc(plan.dueAt);
    if (!dueAt) throw new Error("invalid_due_at");
    return db.transaction(async tx => {
      const [workFile] = await tx.select({ projectId: comoNextWorkFiles.projectId, userId: comoNextWorkFiles.userId, workFileStatus: comoNextWorkFiles.workFileStatus })
        .from(comoNextWorkFiles).where(and(eq(comoNextWorkFiles.id, plan.workFileId), eq(comoNextWorkFiles.projectId, plan.projectId))).limit(1);
      if (!workFile || Number(workFile.userId) !== plan.userId || !ACTIVE_WORK_FILE_STATUSES.includes(workFile.workFileStatus as (typeof ACTIVE_WORK_FILE_STATUSES)[number])) {
        throw new Error("finance_watch_work_file_not_active");
      }
      const [existing] = await tx.select().from(comoNextActions).where(and(
        eq(comoNextActions.sourceSystem, FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM),
        eq(comoNextActions.sourceRecordId, plan.sourceRecordId),
      )).limit(1);
      if (existing) return { action: actionFromRow(existing), replayed: true };
      const inserted = await tx.insert(comoNextActions).values({
        userId: plan.userId, projectId: plan.projectId, workFileId: plan.workFileId,
        title: `متابعة طلب صرف إلى وائل (Sent #${plan.sentEmailId})`,
        description: `مراقبة داخلية لطلب صرف صريح مرسل إلى وائل في ${plan.sentAt}. لا يوجد إرسال آلي؛ لا تُنشأ مسودة إلا بعد أربعة أيام تقويمية ومسح ردود كامل.`,
        acceptanceCriteria: "عند رد بشري مناسب: افتح مراجعة مالية داخلية. عند عدم الرد ومسح بريد حديث كامل: احفظ مسودة متابعة فقط؛ لا تعتبر الصرف مدفوعًا أو متحققًا.",
        ownerType: "manus", ownerUserId: null, actionStatus: "waiting_external", priority: "important",
        dueAt, followUpAt: dueAt, attentionAt: dueAt,
        sourceSystem: FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM, sourceRecordId: plan.sourceRecordId,
      }).onDuplicateKeyUpdate({ set: { id: sql`LAST_INSERT_ID(${comoNextActions.id})` } });
      const [created] = await tx.select().from(comoNextActions).where(and(
        eq(comoNextActions.sourceSystem, FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM),
        eq(comoNextActions.sourceRecordId, plan.sourceRecordId),
      )).limit(1);
      if (!created) throw new Error("finance_payment_watch_not_persisted");
      const replayed = Number((inserted[0] as { affectedRows?: number }).affectedRows) !== 1;
      if (!replayed) {
        await appendEvent(tx, {
          userId: plan.userId, projectId: plan.projectId, workFileId: plan.workFileId, actionId: Number(created.id), actorType: "system", actorUserId: null,
          eventType: "finance_payment_watch_created", summary: `تسجيل متابعة داخلية لطلب صرف مرسل #${plan.sentEmailId}`,
          payload: { sentEmailId: plan.sentEmailId, dueAt, externalSideEffect: false }, idempotencyKey: `finance-payment-watch:${plan.sourceRecordId}`,
        });
      }
      return { action: actionFromRow(created), replayed };
    });
  }

  async findThreadReplies(plan: FinancePaymentPlan) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    const sentAt = sqlUtc(plan.sentAt);
    if (!sentAt) throw new Error("invalid_sent_at");
    const rows = await db.select({
      id: comoNextEmailMessages.id, fromEmail: comoNextEmailMessages.fromEmail, subject: comoNextEmailMessages.subject,
      bodyText: comoNextEmailMessages.bodyText, bodySha256: comoNextEmailMessages.bodySha256,
      receivedAt: comoNextEmailMessages.receivedAt, linkedWorkFileId: comoNextEmailMessages.linkedWorkFileId,
    }).from(comoNextEmailMessages).where(and(
      eq(comoNextEmailMessages.userId, plan.userId), eq(comoNextEmailMessages.mailboxKey, FINANCE_PAYMENT_MAILBOX_KEY),
      eq(comoNextEmailMessages.folderName, "INBOX"), gt(comoNextEmailMessages.receivedAt, sentAt),
      inArray(comoNextEmailMessages.fromEmail, THREAD_SENDERS),
    )).orderBy(asc(comoNextEmailMessages.receivedAt), asc(comoNextEmailMessages.id)).limit(MAX_THREAD_SCAN + 1);
    return {
      replies: rows.slice(0, MAX_THREAD_SCAN).map(row => ({ ...row, id: Number(row.id), linkedWorkFileId: row.linkedWorkFileId == null ? null : Number(row.linkedWorkFileId) })),
      complete: rows.length <= MAX_THREAD_SCAN,
    };
  }

  async openFinanceReview(input: { action: FinancePaymentAction; plan: FinancePaymentPlan; replies: FinanceThreadReply[] }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    if (!input.replies.length) return false;
    return db.transaction(async tx => {
      // Match the file-before-action lock order used by receipt completion.
      await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${input.plan.workFileId} AND user_id=${input.plan.userId} FOR UPDATE`);
      // Lock the watch first. Besides serializing two monitor runs, the scope
      // check makes a stale action object unable to affect another user's file.
      const currentRows = databaseRows<{ actionStatus: string; evidenceReference: string | null; sourceSystem: string }>(await tx.execute(sql`
        SELECT action_status AS actionStatus, evidence_reference AS evidenceReference, source_system AS sourceSystem
        FROM como_next_actions
        WHERE id=${input.action.id} AND user_id=${input.plan.userId} AND project_id=${input.plan.projectId} AND work_file_id=${input.plan.workFileId}
        FOR UPDATE
      `));
      const current = currentRows[0];
      if (!current
        || current.sourceSystem !== FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM
        || !OPEN_WATCH_STATUSES.includes(current.actionStatus as (typeof OPEN_WATCH_STATUSES)[number])) return false;
      // A scheduler retry must leave an already-open finance review untouched:
      // the event key is unique and this review is intentionally never auto-closed.
      if (current.actionStatus === "open" && String(current.evidenceReference || "").startsWith("finance_review:")) return false;

      const reviewedReplyIds = await trustedFinanceReviewReplyIds(tx, input);
      const unreviewedReplies = input.replies.filter(reply => !reviewedReplyIds.has(reply.id));
      // Do not reinterpret a reviewed human reply as silence. Keeping the
      // action waiting prevents a later reminder Draft while preserving the
      // reply itself in the mailbox projection.
      if (!unreviewedReplies.length) return false;

      const refs = unreviewedReplies.slice(0, 10).map(reply => `INBOX #${reply.id} (${reply.fromEmail}, ${reply.receivedAt})`).join("؛ ");
      const evidenceReference = `finance_review: Sent #${input.plan.sentEmailId}; ${refs}`.slice(0, 5000);
      await tx.execute(sql`
        UPDATE como_next_actions
        SET title=${`finance_review: طلب صرف إلى وائل (Sent #${input.plan.sentEmailId})`}, action_status='open', attention_at=NULL, follow_up_at=NULL,
          description=${`توجد رسالة/تحديث بشري مناسب في خيط طلب الصرف. يلزم مراجعة مالية داخلية؛ لا تُعتبر دفعة ولا تُغلق المتابعة تلقائيًا. المراجع: ${refs}`.slice(0, 20_000)},
          acceptance_criteria=${"راجع الردود والمستندات يدويًا، ووثّق فقط التحقق الصريح من الحالة. لا تغلق الإجراء تلقائيًا."}, evidence_reference=${evidenceReference}
        WHERE id=${input.action.id} AND user_id=${input.plan.userId} AND project_id=${input.plan.projectId} AND work_file_id=${input.plan.workFileId}
          AND source_system=${FINANCE_PAYMENT_WATCH_SOURCE_SYSTEM} AND action_status IN ('open', 'waiting_external')
      `);
      await appendEvent(tx, {
        userId: input.plan.userId, projectId: input.plan.projectId, workFileId: input.plan.workFileId, actionId: input.action.id,
        actorType: "system", actorUserId: null, eventType: "finance_payment_review_opened", summary: `فتح مراجعة مالية داخلية لرد على طلب صرف #${input.plan.sentEmailId}`,
        payload: { sentEmailId: input.plan.sentEmailId, replyEmailId: unreviewedReplies[0]!.id, externalSideEffect: false },
        idempotencyKey: `finance-payment-review:${input.plan.sentEmailId}:${unreviewedReplies[0]!.id}`,
      });
    });
  }

  async saveThreadDraft(input: { plan: FinancePaymentPlan; sent: FinancePaymentSent; subject: string; body: string }) {
    if (await this.isInvoicePaidRecorded(input.sent)) throw new Error("invoice_paid_no_reminder");
    const created = await createCommunicationDraftCommand({
      userId: input.plan.userId,
      workFileId: input.plan.workFileId,
      channel: "email",
      toText: WAEL_EMAIL,
      ccText: FINANCE_CC.join(", "),
      subject: input.subject,
      body: input.body,
      sourceEmailId: input.sent.id,
      idempotencyKey: input.plan.draftKey,
    });
    const mailbox = "mailboxDraft" in created ? created.mailboxDraft : null;
    if (mailbox?.uid) return { folder: mailbox.folder, uid: mailbox.uid, created: !created.replayed };
    // A replay already confirmed in Sent is not a reason to recreate a Draft.
    if (created.communicationStatus === "sent") return { folder: "Sent", uid: null, created: false };
    throw new Error("finance_payment_followup_draft_not_observable");
  }

  async completeWatchAfterDraft(input: { action: FinancePaymentAction; plan: FinancePaymentPlan; evidenceReference: string }) {
    const db = await getDb();
    if (!db) throw new Error("database_unavailable");
    await db.transaction(async tx => {
      const [current] = await tx.select().from(comoNextActions).where(eq(comoNextActions.id, input.action.id)).limit(1);
      if (!current || current.actionStatus === "completed_pending_verification" || current.actionStatus === "verified" || current.actionStatus === "cancelled") return;
      if (!OPEN_WATCH_STATUSES.includes(current.actionStatus as (typeof OPEN_WATCH_STATUSES)[number])) return;
      await tx.update(comoNextActions).set({
        actionStatus: "completed_pending_verification", completedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        evidenceReference: input.evidenceReference,
        description: `حُفظت مسودة متابعة داخل خيط طلب الصرف بعد مسح مكتمل بلا رد. ${input.evidenceReference}. لا يعني ذلك أن الصرف مدفوع أو متحقق؛ يلزم تحقق يدوي.`,
        acceptanceCriteria: "راجع المسودة في البريد وتحقق يدويًا من حالة الصرف؛ لا تعيّن الحالة verified إلا بدليل صريح.",
      }).where(eq(comoNextActions.id, input.action.id));
      await appendEvent(tx, {
        userId: input.plan.userId, projectId: input.plan.projectId, workFileId: input.plan.workFileId, actionId: input.action.id,
        actorType: "manus", actorUserId: null, eventType: "finance_payment_followup_draft_saved", summary: `حفظ مسودة متابعة لطلب الصرف #${input.plan.sentEmailId}`,
        payload: { sentEmailId: input.plan.sentEmailId, draftKey: input.plan.draftKey, sent: false },
        idempotencyKey: `finance-payment-draft:${input.plan.sentEmailId}`,
      });
    });
  }
}

function actionFromRow(row: typeof comoNextActions.$inferSelect): FinancePaymentAction {
  return {
    id: Number(row.id), userId: Number(row.userId), projectId: Number(row.projectId), workFileId: Number(row.workFileId),
    actionStatus: row.actionStatus as FinanceActionStatus, evidenceReference: row.evidenceReference,
  };
}

/** Production entrypoint. Register only after the readonly import and process phases succeed. */
export async function reconcileFinancePaymentFollowups(input: { userId: number; now?: string; limit?: number }) {
  return new FinancePaymentFollowupReconciler(new DatabaseFinancePaymentFollowupStore()).reconcile(input);
}
