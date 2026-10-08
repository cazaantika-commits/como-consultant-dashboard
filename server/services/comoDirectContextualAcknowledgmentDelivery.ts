import { createHash, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { and, eq, sql } from "drizzle-orm";
import {
  comoNextCommunications,
  comoNextDirectContextualAckDeliveryLedger,
  comoNextDirectContextualAckDeliverySettings,
  comoNextEmailMessages,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  fetchReadonlyAutomationSignalByUID,
  getConfiguredMailboxAddress,
} from "../emailMonitor";
import { createCommunicationDraftCommand, requireProjectAccess } from "./comoNextCommands";
import { createIntakeProposalsCommand } from "./comoNextIntake";
import {
  DIRECT_CONTEXTUAL_ACK_CLASSIFIER_MODEL,
  classifyDirectContextualAcknowledgementWithLLM,
  directContextualAcknowledgementIdempotencyKey,
  planDirectContextualAcknowledgement,
  proposedNonCommittingAcknowledgementText,
  reviewDirectContextualAcknowledgementSentHistory,
  type DirectAcknowledgementClassification,
  type DirectAckReason,
  type DirectContextualAcknowledgementMessage,
  type DirectReadonlySentReview,
  type DirectVerifiedProjectBinding,
} from "./comoDirectContextualAcknowledgments";
import { mailboxKeyFor } from "./comoNextEmailInbox";

/**
 * Dedicated, narrow live-delivery path for ONLY a verified human courtesy.
 *
 * This module intentionally bypasses the legacy SMTP helper and its general
 * feature gate. The path needs its own local lock AND an enabled,
 * persisted, mailbox-scoped setting; both are disabled by default.
 */
export const DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE = "direct_courtesy_only" as const;
export const DIRECT_CONTEXTUAL_ACK_DELIVERY_LOCAL_LOCK_ENV = "COMO_DIRECT_CONTEXTUAL_ACK_DELIVERY_ENABLED";
export const DIRECT_CONTEXTUAL_ACK_DELIVERY_CLASSIFIER_MODEL = DIRECT_CONTEXTUAL_ACK_CLASSIFIER_MODEL;

export const DIRECT_CONTEXTUAL_ACK_DELIVERY_ACTIVATION_BLOCKERS = [
  "independent_local_delivery_lock_required",
  "persisted_mailbox_scoped_direct_courtesy_setting_required",
  "persisted_activation_watermark_required_to_exclude_history",
  "verified_como_mailbox_and_raw_header_signal_required",
  "verified_project_and_work_file_access_required",
  "fresh_readonly_sent_review_required",
  "durable_unique_claim_and_pre_send_message_id_required",
  "smtp_attempt_must_never_be_automatically_retried",
  "draft_and_sara_adapter_required_for_non_sendable_human_messages",
] as const;

export type DirectDeliveryLedgerStatus =
  | "claimed"
  | "skipped"
  | "manual_review"
  | "draft_ready"
  | "draft_and_sara_ready"
  | "sending"
  | "sent"
  | "send_uncertain"
  | "failed";

export type DirectDeliveryDisposition = "direct_send_courtesy" | "draft_and_notify_sara" | "manual_review" | "skip";

export type DirectDeliveryReply = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  idempotencyKey: string;
};

export type DirectDeliverySaraIntent = {
  idempotencyKey: string;
  title: string;
  message: string;
  emailId: number;
  projectId: number;
  workFileId: number;
};

export type DirectDeliveryPlan = {
  idempotencyKey: string;
  userId: number;
  disposition: DirectDeliveryDisposition;
  reason: DirectAckReason;
  messageId: number;
  projectId: number | null;
  workFileId: number | null;
  reply: DirectDeliveryReply | null;
  saraIntent: DirectDeliverySaraIntent | null;
  audit: {
    mailboxVerified: boolean;
    projectVerified: boolean;
    rawHeaderSystemSignal: DirectContextualAcknowledgementMessage["systemSignal"];
    fromSignalVerified: boolean;
    sentHistoryReviewed: boolean;
    postWatermark: boolean;
    classifier: DirectAcknowledgementClassification;
  };
};

export type DirectDeliveryLedgerRecord = {
  id: number;
  idempotencyKey: string;
  status: DirectDeliveryLedgerStatus;
  claimToken?: string | null;
  communicationId?: number | null;
  saraProposalId?: number | null;
  outboundMessageId?: string | null;
};

export type DirectDeliveryActivation = {
  activationStartedAt: string;
  deliveryMode: typeof DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE;
  localDeliveryLockEnabled: boolean;
};

export type DirectDeliveryExecutionInput = {
  message: DirectContextualAcknowledgementMessage;
  project: DirectVerifiedProjectBinding;
  activation: DirectDeliveryActivation;
};

export type DirectDeliveryExecutionResult = {
  status: "disabled" | "in_progress" | "replayed" | "skipped" | "manual_review" | "draft_ready" | "draft_and_sara_ready" | "sent" | "send_uncertain";
  plan: DirectDeliveryPlan | null;
  ledgerId: number | null;
  communicationId: number | null;
  saraProposalId: number | null;
  outboundMessageId: string | null;
  externalDeliveryAuthorized: boolean;
};

export type DirectDeliverySendResult = {
  providerMessageId: string | null;
  response: string | null;
  accepted: string[];
  rejected: string[];
};

export type DirectContextualAcknowledgementDeliveryAdapter = {
  claim(input: {
    idempotencyKey: string;
    userId: number;
    emailId: number;
    activationStartedAt: string;
    projectId: number | null;
    workFileId: number | null;
  }): Promise<{ claimed: boolean; record: DirectDeliveryLedgerRecord }>;
  reviewSent(message: DirectContextualAcknowledgementMessage): Promise<DirectReadonlySentReview>;
  classify(message: DirectContextualAcknowledgementMessage): Promise<DirectAcknowledgementClassification>;
  saveDraft(input: { reply: DirectDeliveryReply; plan: DirectDeliveryPlan }): Promise<{ communicationId: number | null; mailboxDraftRef: string | null }>;
  recordSaraReview(input: { intent: DirectDeliverySaraIntent; plan: DirectDeliveryPlan }): Promise<{ proposalId: number | null }>;
  complete(input: {
    ledgerId: number;
    status: Exclude<DirectDeliveryLedgerStatus, "claimed" | "sending" | "sent" | "send_uncertain" | "failed">;
    plan: DirectDeliveryPlan;
    sentReview: DirectReadonlySentReview | null;
    communicationId?: number | null;
    mailboxDraftRef?: string | null;
    saraProposalId?: number | null;
    claimToken: string;
  }): Promise<void>;
  beginSend(input: { ledgerId: number; claimToken: string; outboundMessageId: string; plan: DirectDeliveryPlan }): Promise<void>;
  send(message: { from: string; to: string; cc: string; subject: string; text: string; html: string; inReplyTo?: string; messageId: string }): Promise<DirectDeliverySendResult>;
  recordSent(input: { ledgerId: number; claimToken: string; outboundMessageId: string; plan: DirectDeliveryPlan; smtp: DirectDeliverySendResult }): Promise<{ communicationId: number | null; sentRecordRef: string | null }>;
  markSendUncertain(input: { ledgerId: number; claimToken: string; outboundMessageId: string; error: string }): Promise<void>;
};

const FINAL_STATUSES = new Set<DirectDeliveryLedgerStatus>([
  "skipped",
  "manual_review",
  "draft_ready",
  "draft_and_sara_ready",
  "sent",
  "send_uncertain",
]);

function parseUtc(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asSqlUtc(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function compactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "unknown_error")).replace(/[\r\n]+/g, " ").slice(0, 1_000);
}

function normalize(value: string | null | undefined) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function recipientAddress(value: string) {
  return value.match(/<([^>\r\n]+@[^>\r\n]+)>/)?.[1]?.trim().toLowerCase()
    || value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i)?.[0]?.toLowerCase()
    || "";
}

function safeAddresses(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const values = raw.split(/[;,]/).map(part => part.trim()).filter(Boolean);
  const addresses = values.map(recipientAddress);
  if (!addresses.length || addresses.some(address => !address)) return null;
  const seen = new Set<string>();
  return addresses.filter(address => {
    if (seen.has(address)) return false;
    seen.add(address);
    return true;
  }).join(", ");
}

function validProject(project: DirectVerifiedProjectBinding) {
  return project.status === "verified"
    && project.accessVerified
    && Number.isInteger(project.projectId)
    && Number(project.projectId) > 0
    && Number.isInteger(project.workFileId)
    && Number(project.workFileId) > 0;
}

function postWatermark(message: DirectContextualAcknowledgementMessage, activationStartedAt: string) {
  const received = parseUtc(message.receivedAt);
  const watermark = parseUtc(activationStartedAt);
  return message.folderName === "INBOX" && Boolean(received && watermark && received.getTime() >= watermark.getTime());
}

function safeSentReview(review: DirectReadonlySentReview) {
  return review.isFreshReadonlyReview
    && review.outcome === "no_relevant_owner_reply"
    && Boolean(parseUtc(review.reviewedAt));
}

function emptyClassification(): DirectAcknowledgementClassification {
  return {
    hasRequestOrCommitment: false,
    hasFinancialLegalScheduleDecision: false,
    isClearCourtesyOnly: false,
    isAmbiguous: true,
    confidence: 0,
  };
}

function replySubject(subject: string) {
  const clean = normalize(subject) || "(no subject)";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function fallbackReviewReply(message: DirectContextualAcknowledgementMessage, key: string): DirectDeliveryReply {
  return {
    to: normalize(message.fromEmail),
    cc: "",
    subject: replySubject(message.subject),
    body: proposedNonCommittingAcknowledgementText(message, "review"),
    inReplyTo: normalize(message.messageId) || undefined,
    idempotencyKey: key,
  };
}

function fallbackSaraIntent(message: DirectContextualAcknowledgementMessage, project: DirectVerifiedProjectBinding, key: string, reason: DirectAckReason): DirectDeliverySaraIntent {
  return {
    idempotencyKey: `${key}:sara`,
    title: "مراجعة بريد COMO مطلوبة",
    message: `الرسالة «${normalize(message.subject)}» من ${normalize(message.fromEmail)} تحتاج مسودة ومراجعة سارة قبل أي إرسال (${reason}).`,
    emailId: message.id,
    projectId: Number(project.projectId),
    workFileId: Number(project.workFileId),
  };
}

function fromShadowPlan(input: {
  message: DirectContextualAcknowledgementMessage;
  project: DirectVerifiedProjectBinding;
  activationStartedAt: string;
  sentReview: DirectReadonlySentReview;
  classification: DirectAcknowledgementClassification;
}): DirectDeliveryPlan {
  const shadow = planDirectContextualAcknowledgement(input);
  const directDisposition: DirectDeliveryDisposition = shadow.disposition === "shadow_courtesy_candidate"
    ? "direct_send_courtesy"
    : shadow.disposition === "shadow_draft_and_notify_sara"
      ? "draft_and_notify_sara"
      : shadow.disposition;
  return {
    idempotencyKey: shadow.idempotencyKey,
    userId: input.message.userId,
    disposition: directDisposition,
    reason: shadow.reason,
    messageId: shadow.messageId,
    projectId: shadow.projectId,
    workFileId: shadow.workFileId,
    reply: shadow.shadowReply && {
      to: shadow.shadowReply.to,
      cc: shadow.shadowReply.cc,
      subject: shadow.shadowReply.subject,
      body: shadow.shadowReply.body,
      inReplyTo: shadow.shadowReply.inReplyTo,
      idempotencyKey: shadow.shadowReply.idempotencyKey,
    },
    saraIntent: shadow.saraShadowIntent && {
      idempotencyKey: shadow.saraShadowIntent.idempotencyKey.replace(/:sara-shadow$/, ":sara"),
      title: shadow.saraShadowIntent.title,
      message: shadow.saraShadowIntent.message,
      emailId: shadow.saraShadowIntent.emailId,
      projectId: shadow.saraShadowIntent.projectId,
      workFileId: shadow.saraShadowIntent.workFileId,
    },
    audit: shadow.audit,
  };
}

/**
 * Drafting is permitted for a verified project/file when a human sender cannot
 * safely receive direct SMTP. This covers uncertain headers and a prior owner
 * reply without treating either as evidence that delivery occurred. System mail,
 * malformed senders, wrong mailboxes, and history are never drafted here.
 */
function upgradeHumanNonSendToDraft(plan: DirectDeliveryPlan, input: DirectDeliveryExecutionInput): DirectDeliveryPlan {
  const canDraft = input.message.mailboxVerified
    && input.message.folderName === "INBOX"
    && postWatermark(input.message, input.activation.activationStartedAt)
    && input.message.systemSignal !== "known_system"
    && input.message.fromSignalVerified
    && validProject(input.project);
  if (!canDraft || plan.disposition === "direct_send_courtesy" || plan.disposition === "draft_and_notify_sara") return plan;
  return {
    ...plan,
    disposition: "draft_and_notify_sara",
    reply: fallbackReviewReply(input.message, plan.idempotencyKey),
    saraIntent: fallbackSaraIntent(input.message, input.project, plan.idempotencyKey, plan.reason),
  };
}

export function isDirectContextualAcknowledgementDeliveryEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env[DIRECT_CONTEXTUAL_ACK_DELIVERY_LOCAL_LOCK_ENV] === "true";
}

/** Stable Message-ID reserved in the ledger before the single SMTP attempt. */
export function directContextualAcknowledgementOutboundMessageId(message: Pick<DirectContextualAcknowledgementMessage, "userId" | "id" | "messageIdentitySha256">, mailboxAddress = getConfiguredMailboxAddress()) {
  const domain = mailboxAddress.trim().toLowerCase().split("@")[1];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("direct_contextual_ack_invalid_mailbox_message_id_domain");
  const key = directContextualAcknowledgementIdempotencyKey(message);
  const digest = createHash("sha256").update(`${key}:smtp-message-id:v1`).digest("hex");
  return `<como-direct-contextual-ack.${digest}@${domain}>`;
}

function safeDirectSendReply(reply: DirectDeliveryReply | null) {
  if (!reply) return null;
  const to = safeAddresses(reply.to);
  const cc = safeAddresses(reply.cc);
  const subject = normalize(reply.subject).slice(0, 998);
  const body = String(reply.body || "").replace(/\r/g, "").trim();
  const inReplyTo = reply.inReplyTo && !/[\r\n]/.test(reply.inReplyTo) ? reply.inReplyTo.trim().slice(0, 998) : undefined;
  // No trustworthy inbound Message-ID means no safe contextual/thread reply.
  // Do not manufacture or guess an In-Reply-To value for a live send.
  if (!to || cc === null || !subject || !body || !inReplyTo || !/^<[^<>\r\n@]+@[^<>\r\n@]+>$/.test(inReplyTo)) return null;
  return { to, cc, subject, body, inReplyTo };
}

function asHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br>");
}

/**
 * The injected adapter makes the one-shot SMTP boundary testable without a
 * mailbox, real credentials, or a production DB. The `sending` state is final
 * for retry purposes: once `beginSend` succeeds, this function never calls
 * `send` again for the same ledger record.
 */
export async function processDirectContextualAcknowledgementDeliveryWithAdapter(
  input: DirectDeliveryExecutionInput,
  adapter: DirectContextualAcknowledgementDeliveryAdapter,
): Promise<DirectDeliveryExecutionResult> {
  const disabled = (): DirectDeliveryExecutionResult => ({
    status: "disabled", plan: null, ledgerId: null, communicationId: null, saraProposalId: null, outboundMessageId: null, externalDeliveryAuthorized: false,
  });
  if (input.activation.deliveryMode !== DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE || !input.activation.localDeliveryLockEnabled) return disabled();

  const idempotencyKey = directContextualAcknowledgementIdempotencyKey(input.message);
  const claim = await adapter.claim({
    idempotencyKey,
    userId: input.message.userId,
    emailId: input.message.id,
    activationStartedAt: input.activation.activationStartedAt,
    projectId: input.project.projectId ? Number(input.project.projectId) : null,
    workFileId: input.project.workFileId ? Number(input.project.workFileId) : null,
  });
  if (!claim.claimed && FINAL_STATUSES.has(claim.record.status)) {
    return {
      status: "replayed", plan: null, ledgerId: claim.record.id,
      communicationId: claim.record.communicationId ?? null,
      saraProposalId: claim.record.saraProposalId ?? null,
      outboundMessageId: claim.record.outboundMessageId ?? null,
      externalDeliveryAuthorized: false,
    };
  }
  if (!claim.claimed) {
    return {
      status: "in_progress", plan: null, ledgerId: claim.record.id,
      communicationId: claim.record.communicationId ?? null,
      saraProposalId: claim.record.saraProposalId ?? null,
      outboundMessageId: claim.record.outboundMessageId ?? null,
      externalDeliveryAuthorized: false,
    };
  }
  if (!claim.record.claimToken) throw new Error("direct_contextual_ack_delivery_claim_token_missing");
  const claimToken = claim.record.claimToken;

  let sentReview: DirectReadonlySentReview = { reviewedAt: null, outcome: "not_reviewed", isFreshReadonlyReview: false };
  const eligibleForSentReview = input.message.mailboxVerified
    && input.message.folderName === "INBOX"
    && postWatermark(input.message, input.activation.activationStartedAt)
    && input.message.systemSignal === "known_non_system"
    && input.message.fromSignalVerified
    && validProject(input.project);
  if (eligibleForSentReview) sentReview = await adapter.reviewSent(input.message);

  let classification = emptyClassification();
  if (eligibleForSentReview && safeSentReview(sentReview)) {
    try { classification = await adapter.classify(input.message); } catch { /* fail closed below */ }
  }
  let plan = fromShadowPlan({
    message: input.message,
    project: input.project,
    activationStartedAt: input.activation.activationStartedAt,
    sentReview,
    classification,
  });
  plan = upgradeHumanNonSendToDraft(plan, input);

  try {
    if (plan.disposition === "skip") {
      await adapter.complete({ ledgerId: claim.record.id, status: "skipped", plan, sentReview, claimToken });
      return { status: "skipped", plan, ledgerId: claim.record.id, communicationId: null, saraProposalId: null, outboundMessageId: null, externalDeliveryAuthorized: false };
    }
    if (plan.disposition === "manual_review" || !plan.reply) {
      await adapter.complete({ ledgerId: claim.record.id, status: "manual_review", plan, sentReview, claimToken });
      return { status: "manual_review", plan, ledgerId: claim.record.id, communicationId: null, saraProposalId: null, outboundMessageId: null, externalDeliveryAuthorized: false };
    }
    if (plan.disposition === "draft_and_notify_sara") {
      const draft = await adapter.saveDraft({ reply: plan.reply, plan });
      const sara = plan.saraIntent ? await adapter.recordSaraReview({ intent: plan.saraIntent, plan }) : { proposalId: null };
      const status = plan.saraIntent ? "draft_and_sara_ready" : "draft_ready";
      await adapter.complete({
        ledgerId: claim.record.id, status, plan, sentReview,
        communicationId: draft.communicationId, mailboxDraftRef: draft.mailboxDraftRef,
        saraProposalId: sara.proposalId, claimToken,
      });
      return {
        status, plan, ledgerId: claim.record.id, communicationId: draft.communicationId,
        saraProposalId: sara.proposalId, outboundMessageId: null, externalDeliveryAuthorized: false,
      };
    }

    const safeReply = safeDirectSendReply(plan.reply);
    if (!safeReply) {
      const fallback = upgradeHumanNonSendToDraft({ ...plan, disposition: "manual_review", reply: null, saraIntent: null }, input);
      if (fallback.disposition === "draft_and_notify_sara" && fallback.reply && fallback.saraIntent) {
        const draft = await adapter.saveDraft({ reply: fallback.reply, plan: fallback });
        const sara = await adapter.recordSaraReview({ intent: fallback.saraIntent, plan: fallback });
        await adapter.complete({ ledgerId: claim.record.id, status: "draft_and_sara_ready", plan: fallback, sentReview, communicationId: draft.communicationId, mailboxDraftRef: draft.mailboxDraftRef, saraProposalId: sara.proposalId, claimToken });
        return { status: "draft_and_sara_ready", plan: fallback, ledgerId: claim.record.id, communicationId: draft.communicationId, saraProposalId: sara.proposalId, outboundMessageId: null, externalDeliveryAuthorized: false };
      }
      await adapter.complete({ ledgerId: claim.record.id, status: "manual_review", plan, sentReview, claimToken });
      return { status: "manual_review", plan, ledgerId: claim.record.id, communicationId: null, saraProposalId: null, outboundMessageId: null, externalDeliveryAuthorized: false };
    }

    const outboundMessageId = directContextualAcknowledgementOutboundMessageId(input.message);
    await adapter.beginSend({ ledgerId: claim.record.id, claimToken, outboundMessageId, plan });
    try {
      const smtp = await adapter.send({
        from: getConfiguredMailboxAddress(),
        to: safeReply.to,
        cc: safeReply.cc,
        subject: safeReply.subject,
        text: safeReply.body,
        html: `<div dir="auto" style="line-height:1.7">${asHtml(safeReply.body)}</div>`,
        inReplyTo: safeReply.inReplyTo,
        messageId: outboundMessageId,
      });
      if (smtp.rejected.length || !smtp.accepted.length) throw new Error("direct_contextual_ack_smtp_not_accepted");
      const sent = await adapter.recordSent({ ledgerId: claim.record.id, claimToken, outboundMessageId, plan, smtp });
      return {
        status: "sent", plan, ledgerId: claim.record.id, communicationId: sent.communicationId,
        saraProposalId: null, outboundMessageId, externalDeliveryAuthorized: true,
      };
    } catch (error) {
      await adapter.markSendUncertain({ ledgerId: claim.record.id, claimToken, outboundMessageId, error: compactError(error) }).catch(() => undefined);
      return {
        status: "send_uncertain", plan, ledgerId: claim.record.id, communicationId: null,
        saraProposalId: null, outboundMessageId, externalDeliveryAuthorized: false,
      };
    }
  } catch (error) {
    await adapter.complete({ ledgerId: claim.record.id, status: "manual_review", plan, sentReview, claimToken }).catch(() => undefined);
    throw error;
  }
}

function databaseLedgerRecord(row: typeof comoNextDirectContextualAckDeliveryLedger.$inferSelect): DirectDeliveryLedgerRecord {
  return {
    id: Number(row.id),
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    claimToken: row.claimToken,
    communicationId: row.communicationId == null ? null : Number(row.communicationId),
    saraProposalId: row.saraProposalId == null ? null : Number(row.saraProposalId),
    outboundMessageId: row.outboundMessageId,
  };
}

function smtpAdapter() {
  const mailbox = getConfiguredMailboxAddress();
  const password = process.env.EMAIL_PASSWORD || "";
  return async (message: { from: string; to: string; cc: string; subject: string; text: string; html: string; inReplyTo?: string; messageId: string }): Promise<DirectDeliverySendResult> => {
    if (!password) throw new Error("direct_contextual_ack_email_password_not_configured");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "mail.privateemail.com",
      port: 465,
      secure: true,
      auth: { user: mailbox, pass: password },
    });
    const info = await transporter.sendMail({
      from: { name: "Abdalrahman Zaqout", address: mailbox },
      to: message.to,
      cc: message.cc || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
      messageId: message.messageId,
      ...(message.inReplyTo ? { inReplyTo: message.inReplyTo, references: message.inReplyTo } : {}),
    });
    return {
      providerMessageId: info.messageId || null,
      response: info.response || null,
      accepted: (info.accepted || []).map(value => String(value).toLowerCase()),
      rejected: (info.rejected || []).map(value => String(value).toLowerCase()),
    };
  };
}

function deliveryAdapter(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, now: Date): DirectContextualAcknowledgementDeliveryAdapter {
  return {
    claim: async input => {
      const claimToken = randomUUID();
      const result = await db.execute(sql`
        INSERT IGNORE INTO como_next_direct_contextual_ack_delivery_ledger
          (idempotency_key, user_id, email_message_id, project_id, work_file_id, activation_started_at, status, claim_token, claimed_at)
        VALUES (${input.idempotencyKey}, ${input.userId}, ${input.emailId}, ${input.projectId}, ${input.workFileId}, ${asSqlUtc(new Date(input.activationStartedAt))}, 'claimed', ${claimToken}, UTC_TIMESTAMP())
      `);
      const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
      let [row] = await db.select().from(comoNextDirectContextualAckDeliveryLedger)
        .where(eq(comoNextDirectContextualAckDeliveryLedger.idempotencyKey, input.idempotencyKey)).limit(1);
      if (!row) {
        [row] = await db.select().from(comoNextDirectContextualAckDeliveryLedger)
          .where(eq(comoNextDirectContextualAckDeliveryLedger.emailMessageId, input.emailId)).limit(1);
      }
      if (!row) throw new Error("direct_contextual_ack_delivery_claim_not_persisted");
      if (Number(header.affectedRows || 0) === 1) return { claimed: true, record: databaseLedgerRecord(row) };
      if (row.idempotencyKey !== input.idempotencyKey) return { claimed: false, record: databaseLedgerRecord(row) };
      // Only pre-send failures and abandoned pre-send claims can be recovered.
      // `sending` and `send_uncertain` are deliberately excluded to prevent a
      // second SMTP attempt after the first one may have escaped the provider.
      const recovered = await db.execute(sql`
        UPDATE como_next_direct_contextual_ack_delivery_ledger
        SET status='claimed', claim_token=${claimToken}, claimed_at=UTC_TIMESTAMP(), last_error=NULL
        WHERE id=${row.id}
          AND (status='failed' OR (status='claimed' AND claimed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)))
      `);
      const recoveryHeader = (Array.isArray(recovered) ? recovered[0] : recovered) as { affectedRows?: number };
      if (Number(recoveryHeader.affectedRows || 0) === 1) {
        [row] = await db.select().from(comoNextDirectContextualAckDeliveryLedger)
          .where(eq(comoNextDirectContextualAckDeliveryLedger.id, row.id)).limit(1);
        if (!row) throw new Error("direct_contextual_ack_delivery_reclaim_not_persisted");
        return { claimed: true, record: databaseLedgerRecord(row) };
      }
      return { claimed: false, record: databaseLedgerRecord(row) };
    },
    reviewSent: message => reviewDirectContextualAcknowledgementSentHistory(message, now),
    classify: message => classifyDirectContextualAcknowledgementWithLLM(message, DIRECT_CONTEXTUAL_ACK_DELIVERY_CLASSIFIER_MODEL),
    saveDraft: async ({ reply, plan }) => {
      if (!plan.workFileId) throw new Error("direct_contextual_ack_draft_requires_verified_work_file");
      const result = await createCommunicationDraftCommand({
        userId: plan.userId,
        workFileId: plan.workFileId,
        channel: "email",
        subject: reply.subject,
        body: reply.body,
        toText: reply.to,
        ccText: reply.cc || null,
        sourceEmailId: plan.messageId,
        idempotencyKey: `${plan.idempotencyKey}:draft`,
      });
      return {
        communicationId: Number(result.id),
        mailboxDraftRef: "mailboxDraft" in result && result.mailboxDraft
          ? result.mailboxDraft.uid ? `${result.mailboxDraft.folder} UID ${result.mailboxDraft.uid}` : result.mailboxDraft.folder
          : null,
      };
    },
    recordSaraReview: async ({ intent, plan }) => {
      if (!plan.projectId || !plan.workFileId) throw new Error("direct_contextual_ack_sara_requires_verified_project_file");
      const [email] = await db.select({ userId: comoNextEmailMessages.userId, fromEmail: comoNextEmailMessages.fromEmail, subject: comoNextEmailMessages.subject })
        .from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id, plan.messageId)).limit(1);
      if (!email) throw new Error("direct_contextual_ack_sara_source_missing");
      const result = await createIntakeProposalsCommand({
        userId: Number(email.userId),
        projectId: plan.projectId,
        workFileId: plan.workFileId,
        sourceKind: "email",
        sourcePrefix: intent.idempotencyKey,
        sourceEmailId: plan.messageId,
        proposals: [{
          kind: "communication_draft",
          title: intent.title,
          content: intent.message,
          acceptanceCriteria: "راجع مسودة الإقرار قبل أي إرسال. المسودة ليست إرسالًا ولا تتضمن قبولًا أو التزامًا.",
          ownerType: "human",
          priority: "important",
          channel: "email",
          toText: email.fromEmail,
          evidenceExcerpt: `رسالة COMO #${plan.messageId}: ${email.subject}`,
        }],
      });
      return { proposalId: result.ids[0] ?? null };
    },
    complete: async completion => {
      const result = await db.update(comoNextDirectContextualAckDeliveryLedger).set({
        status: completion.status,
        disposition: completion.plan.disposition,
        reason: completion.plan.reason,
        projectId: completion.plan.projectId,
        workFileId: completion.plan.workFileId,
        sentReviewedAt: completion.sentReview?.reviewedAt ? asSqlUtc(new Date(completion.sentReview.reviewedAt)) : null,
        sentReviewOutcome: completion.sentReview?.outcome || "not_reviewed",
        communicationId: completion.communicationId ?? null,
        mailboxDraftRef: completion.mailboxDraftRef ?? null,
        saraProposalId: completion.saraProposalId ?? null,
        completedAt: asSqlUtc(now),
      }).where(and(
        eq(comoNextDirectContextualAckDeliveryLedger.id, completion.ledgerId),
        eq(comoNextDirectContextualAckDeliveryLedger.claimToken, completion.claimToken),
        eq(comoNextDirectContextualAckDeliveryLedger.status, "claimed"),
      ));
      const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
      if (Number(header.affectedRows || 0) !== 1) throw new Error("direct_contextual_ack_delivery_claim_lost_before_completion");
    },
    beginSend: async input => {
      const result = await db.update(comoNextDirectContextualAckDeliveryLedger).set({
        status: "sending",
        disposition: input.plan.disposition,
        reason: input.plan.reason,
        outboundMessageId: input.outboundMessageId,
        sendStartedAt: asSqlUtc(now),
      }).where(and(
        eq(comoNextDirectContextualAckDeliveryLedger.id, input.ledgerId),
        eq(comoNextDirectContextualAckDeliveryLedger.claimToken, input.claimToken),
        eq(comoNextDirectContextualAckDeliveryLedger.status, "claimed"),
      ));
      const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
      if (Number(header.affectedRows || 0) !== 1) throw new Error("direct_contextual_ack_delivery_claim_lost_before_send");
    },
    send: smtpAdapter(),
    recordSent: async input => {
      const sentAt = asSqlUtc(now);
      const smtpResponse = normalize(input.smtp.response).slice(0, 4_000) || null;
      const responseRecord = `SMTP accepted; Message-ID ${input.outboundMessageId}${smtpResponse ? `; ${smtpResponse}` : ""}`.slice(0, 500);
      const [source] = await db.select({ userId: comoNextEmailMessages.userId, fromEmail: comoNextEmailMessages.fromEmail })
        .from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id, input.plan.messageId)).limit(1);
      if (!source || !input.plan.projectId || !input.plan.workFileId || !input.plan.reply) throw new Error("direct_contextual_ack_sent_record_source_or_binding_missing");
      const reply = input.plan.reply;
      const projectId = input.plan.projectId;
      const workFileId = input.plan.workFileId;
      await db.transaction(async tx => {
        const [existing] = await tx.select({ id: comoNextCommunications.id }).from(comoNextCommunications).where(and(
          eq(comoNextCommunications.sourceSystem, "como_direct_contextual_ack"),
          eq(comoNextCommunications.sourceRecordId, input.plan.idempotencyKey),
        )).limit(1);
        const communicationId = existing ? Number(existing.id) : Number((await tx.insert(comoNextCommunications).values({
          userId: Number(source.userId),
          projectId,
          workFileId,
          channel: "email",
          direction: "outbound",
          communicationStatus: "sent",
          approvalStatus: "not_required",
          subject: reply.subject,
          body: reply.body,
          fromText: getConfiguredMailboxAddress(),
          toText: reply.to,
          ccText: reply.cc || null,
          externalMessageRef: input.outboundMessageId,
          evidenceReference: responseRecord,
          occurredAt: sentAt,
          sentAt,
          sourceSystem: "como_direct_contextual_ack",
          sourceRecordId: input.plan.idempotencyKey,
        }))[0].insertId);
        const update = await tx.update(comoNextDirectContextualAckDeliveryLedger).set({
          status: "sent",
          communicationId,
          smtpAcceptedAt: sentAt,
          smtpResponse,
          sentRecordRef: `communication:${communicationId}`,
          completedAt: sentAt,
          lastError: null,
        }).where(and(
          eq(comoNextDirectContextualAckDeliveryLedger.id, input.ledgerId),
          eq(comoNextDirectContextualAckDeliveryLedger.claimToken, input.claimToken),
          eq(comoNextDirectContextualAckDeliveryLedger.status, "sending"),
          eq(comoNextDirectContextualAckDeliveryLedger.outboundMessageId, input.outboundMessageId),
        ));
        const header = (Array.isArray(update) ? update[0] : update) as { affectedRows?: number };
        if (Number(header.affectedRows || 0) !== 1) throw new Error("direct_contextual_ack_delivery_claim_lost_after_smtp");
      });
      const [ledger] = await db.select({ communicationId: comoNextDirectContextualAckDeliveryLedger.communicationId, sentRecordRef: comoNextDirectContextualAckDeliveryLedger.sentRecordRef })
        .from(comoNextDirectContextualAckDeliveryLedger).where(eq(comoNextDirectContextualAckDeliveryLedger.id, input.ledgerId)).limit(1);
      return { communicationId: ledger?.communicationId == null ? null : Number(ledger.communicationId), sentRecordRef: ledger?.sentRecordRef || null };
    },
    markSendUncertain: async input => {
      await db.update(comoNextDirectContextualAckDeliveryLedger).set({
        status: "send_uncertain",
        outboundMessageId: input.outboundMessageId,
        lastError: input.error,
        completedAt: asSqlUtc(now),
      }).where(and(
        eq(comoNextDirectContextualAckDeliveryLedger.id, input.ledgerId),
        eq(comoNextDirectContextualAckDeliveryLedger.claimToken, input.claimToken),
        eq(comoNextDirectContextualAckDeliveryLedger.status, "sending"),
      ));
    },
  };
}

async function resolveVerifiedBinding(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: typeof comoNextEmailMessages.$inferSelect): Promise<DirectVerifiedProjectBinding> {
  if (email.inboxStatus !== "linked" || !email.linkedProjectId || !email.linkedWorkFileId) return { status: "unlinked", accessVerified: false };
  try {
    await requireProjectAccess(db, Number(email.linkedProjectId), Number(email.userId), "write");
    const [file] = await db.select({ id: comoNextWorkFiles.id }).from(comoNextWorkFiles).where(and(
      eq(comoNextWorkFiles.id, Number(email.linkedWorkFileId)),
      eq(comoNextWorkFiles.projectId, Number(email.linkedProjectId)),
      eq(comoNextWorkFiles.userId, Number(email.userId)),
    )).limit(1);
    return file
      ? { status: "verified", projectId: Number(email.linkedProjectId), workFileId: Number(file.id), accessVerified: true }
      : { status: "ambiguous", accessVerified: false };
  } catch {
    return { status: "ambiguous", accessVerified: false };
  }
}

function storedMessage(email: typeof comoNextEmailMessages.$inferSelect, systemSignal: DirectContextualAcknowledgementMessage["systemSignal"]): DirectContextualAcknowledgementMessage {
  const configuredMailboxKey = mailboxKeyFor(getConfiguredMailboxAddress());
  const fromEmail = normalize(email.fromEmail).toLowerCase();
  return {
    id: Number(email.id), userId: Number(email.userId), messageIdentitySha256: email.messageIdSha256,
    mailboxKey: email.mailboxKey, mailboxVerified: email.mailboxKey === configuredMailboxKey,
    folderName: email.folderName, uidValidity: email.uidValidity, imapUid: Number(email.imapUid),
    fromEmail, fromName: email.fromName, toText: email.toText, ccText: email.ccText,
    subject: email.subject, bodyText: email.bodyText, messageId: email.messageId, receivedAt: email.receivedAt,
    systemSignal,
    fromSignalVerified: Boolean(recipientAddress(fromEmail)) && !/\b(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon|postmaster)\b/i.test(fromEmail),
  };
}

/**
 * Concrete entry point, called only for IDs created by the current read-only
 * INBOX import. It remains dormant unless its independent local lock is set;
 * it never reads or changes the legacy general outbound-email setting.
 */
export async function processDirectContextualAcknowledgementDelivery(input: {
  userId: number;
  emailId: number;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<DirectDeliveryExecutionResult> {
  const disabled = (): DirectDeliveryExecutionResult => ({
    status: "disabled", plan: null, ledgerId: null, communicationId: null, saraProposalId: null, outboundMessageId: null, externalDeliveryAuthorized: false,
  });
  if (!isDirectContextualAcknowledgementDeliveryEnabled(input.env || process.env)) return disabled();
  const db = await getDb();
  if (!db) throw new Error("direct_contextual_ack_delivery_database_unavailable");
  const [email] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, input.emailId),
    eq(comoNextEmailMessages.userId, input.userId),
  )).limit(1);
  if (!email) throw new Error("direct_contextual_ack_delivery_source_missing");
  const [setting] = await db.select().from(comoNextDirectContextualAckDeliverySettings).where(and(
    eq(comoNextDirectContextualAckDeliverySettings.userId, input.userId),
    eq(comoNextDirectContextualAckDeliverySettings.mailboxKey, email.mailboxKey),
    eq(comoNextDirectContextualAckDeliverySettings.isEnabled, 1),
  )).limit(1);
  if (!setting || setting.deliveryMode !== DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE || !parseUtc(setting.activationStartedAt)) return disabled();
  const signal = email.folderName === "INBOX"
    ? await fetchReadonlyAutomationSignalByUID({ uid: Number(email.imapUid), uidValidity: email.uidValidity, folderName: email.folderName })
    : "unknown";
  const message = storedMessage(email, signal);
  const project = await resolveVerifiedBinding(db, email);
  return processDirectContextualAcknowledgementDeliveryWithAdapter({
    message,
    project,
    activation: {
      activationStartedAt: setting.activationStartedAt,
      deliveryMode: DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE,
      localDeliveryLockEnabled: true,
    },
  }, deliveryAdapter(db, input.now || new Date()));
}

/**
 * Separate processing-heartbeat hook. The independent lock is checked before
 * touching the new tables, so deployment ahead of the additive migration stays
 * inert. Eligible rows are explicitly scoped to this mailbox's persisted
 * activation watermark and to INBOX: this cannot retrospectively act on old
 * imports or Sent/Drafts rows.
 */
export async function processPendingDirectContextualAcknowledgementDeliveries(input: {
  userId: number;
  limit?: number;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}) {
  if (!isDirectContextualAcknowledgementDeliveryEnabled(input.env || process.env)) {
    return { attempted: 0, sent: 0, draftAndSara: 0, draft: 0, manualReview: 0, uncertain: 0, disabled: true as const };
  }
  const db = await getDb();
  if (!db) throw new Error("direct_contextual_ack_delivery_database_unavailable");
  const settings = await db.select().from(comoNextDirectContextualAckDeliverySettings).where(and(
    eq(comoNextDirectContextualAckDeliverySettings.userId, input.userId),
    eq(comoNextDirectContextualAckDeliverySettings.isEnabled, 1),
    eq(comoNextDirectContextualAckDeliverySettings.deliveryMode, DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE),
  ));
  const limit = Math.max(1, Math.min(input.limit || 1, 3));
  const ids: number[] = [];
  for (const setting of settings) {
    if (!parseUtc(setting.activationStartedAt)) continue;
    const rows = await db.execute(sql`
      SELECT inbound.id
      FROM como_next_email_messages inbound
      WHERE inbound.user_id = ${input.userId}
        AND inbound.mailbox_key = ${setting.mailboxKey}
        AND inbound.folder_name = 'INBOX'
        AND inbound.received_at >= ${asSqlUtc(new Date(setting.activationStartedAt))}
        AND NOT EXISTS (
          SELECT 1 FROM como_next_direct_contextual_ack_delivery_ledger ledger
          WHERE ledger.email_message_id = inbound.id
        )
      ORDER BY inbound.received_at ASC, inbound.id ASC
      LIMIT ${limit}
    `);
    const resultRows = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] as Array<{ id: number }> : rows as unknown as Array<{ id: number }>;
    for (const row of resultRows) {
      if (ids.length >= limit) break;
      ids.push(Number(row.id));
    }
    if (ids.length >= limit) break;
  }
  const uniqueIds = Array.from(new Set(ids)).slice(0, limit);
  const results: DirectDeliveryExecutionResult[] = [];
  for (const emailId of uniqueIds) {
    results.push(await processDirectContextualAcknowledgementDelivery({
      userId: input.userId,
      emailId,
      now: input.now,
      env: input.env,
    }));
  }
  return {
    attempted: results.length,
    sent: results.filter(result => result.status === "sent").length,
    draftAndSara: results.filter(result => result.status === "draft_and_sara_ready").length,
    draft: results.filter(result => result.status === "draft_ready").length,
    manualReview: results.filter(result => result.status === "manual_review").length,
    uncertain: results.filter(result => result.status === "send_uncertain").length,
    disabled: false as const,
  };
}
