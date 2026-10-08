import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  comoNextContextualAcknowledgmentLedger,
  comoNextContextualAcknowledgmentSettings,
  comoNextEmailMessages,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import {
  applyComoCcPolicy,
  fetchReadonlySentSince,
  getConfiguredMailboxAddress,
  type EmailMessage,
} from "../emailMonitor";
import { getDb } from "../db";
import { createCommunicationDraftCommand, requireProjectAccess } from "./comoNextCommands";
import { createIntakeProposalsCommand } from "./comoNextIntake";

/**
 * Conservative contextual-acknowledgment planner.
 *
 * The planner below decides what a Draft-only integration MAY do after a durable
 * claim and a fresh read-only Sent review. In particular, an
 * `auto_ack_candidate` is not a delivery instruction and must never be wired to
 * legacy SMTP helpers.
 */

export type SystemSignal = "known_non_system" | "known_system" | "unknown";
export type ProjectLinkStatus = "verified" | "suggested" | "unlinked" | "ambiguous";
export type SentReviewOutcome = "no_relevant_owner_reply" | "owner_reply_present" | "ambiguous" | "not_reviewed";
export type AcknowledgmentDisposition = "auto_ack_candidate" | "draft_and_notify_sara" | "manual_review" | "skip";
export type AcknowledgmentReason =
  | "eligible_contextual_courtesy"
  | "request_or_commitment_requires_draft"
  | "high_stakes_requires_draft"
  | "unknown_or_ambiguous_content"
  | "not_new_inbox_message"
  | "historical_message"
  | "system_or_unverified_sender"
  | "project_not_verified"
  | "sent_history_not_safe";

export type ContextualAcknowledgmentMessage = {
  id: number;
  userId: number;
  messageIdentitySha256: string;
  folderName: string;
  fromEmail: string;
  fromName?: string | null;
  toText?: string | null;
  ccText?: string | null;
  subject: string;
  bodyText: string;
  messageId?: string | null;
  receivedAt: string;
  /**
   * The future adapter must derive this from raw headers (for example
   * Auto-Submitted/Precedence) as well as sender/domain signals. Unknown is
   * intentionally not eligible for automation.
   */
  systemSignal: SystemSignal;
};

export type VerifiedProjectBinding = {
  status: ProjectLinkStatus;
  projectId?: number | null;
  workFileId?: number | null;
  projectName?: string | null;
  /** Confirms the user still has write access and that file belongs to project. */
  accessVerified: boolean;
  /** Mia is added only when this was independently verified by the integration. */
  verifiedWaelAppointment?: boolean;
};

export type ReadonlySentReview = {
  reviewedAt?: string | null;
  outcome: SentReviewOutcome;
  /** True only after a fresh read-only Sent/thread lookup for this message. */
  isFreshReadonlyReview: boolean;
  matchedAcknowledgmentIdempotencyKey?: string | null;
};

export type ContextualAcknowledgmentInput = {
  message: ContextualAcknowledgmentMessage;
  project: VerifiedProjectBinding;
  sentReview: ReadonlySentReview;
  /**
   * A persisted activation watermark. Messages received before it are historic,
   * even if the next importer happens to see them for the first time.
   */
  activationStartedAt: string;
  now?: Date;
};

export type AcknowledgmentDraft = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  draftKey: string;
};

export type SaraAlert = {
  title: string;
  message: string;
  idempotencyKey: string;
  emailId: number;
  projectId: number;
  workFileId: number;
};

export type ContextualAcknowledgmentPlan = {
  idempotencyKey: string;
  disposition: AcknowledgmentDisposition;
  reason: AcknowledgmentReason;
  externalDeliveryAuthorized: false;
  messageId: number;
  projectId: number | null;
  workFileId: number | null;
  draft: AcknowledgmentDraft | null;
  saraAlert: SaraAlert | null;
  audit: {
    sentHistoryReviewed: boolean;
    noHistoricalReply: boolean;
    projectVerified: boolean;
    systemSignal: SystemSignal;
    classifications: string[];
  };
};

/**
 * Explicit integration contract for a future implementation. A production
 * adapter must first durably claim `idempotencyKey`, then save a Draft or tell
 * Sara. It has no method for live delivery by design.
 */
export interface ContextualAcknowledgmentIntegration {
  claimIdempotencyKey(input: { idempotencyKey: string; emailId: number }): Promise<{ claimed: boolean }>;
  saveReviewDraft?(draft: AcknowledgmentDraft): Promise<{ folder: string; uid: number | null; created: boolean }>;
  notifySara?(alert: SaraAlert): Promise<void>;
}

/**
 * Runtime activation stays dormant until an operator has applied the additive
 * ledger migration and provisioned a persisted activation watermark. A runner
 * must never infer the watermark from a mailbox sync cursor.
 */
export const CONTEXTUAL_ACKNOWLEDGMENT_ACTIVATION_BLOCKERS = [
  "additive_database_ledger_with_unique_idempotency_key_required",
  "persisted_activation_watermark_required_to_exclude_history",
  "fresh_readonly_sent_thread_review_required",
  "verified_project_binding_and_access_required",
  "explicit_draft_and_sara_adapters_required_for_requests_or_commitments",
  "no_live_smtp_or_general_outbound_unlock",
] as const;

function parseUtc(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalize(value: string | null | undefined) {
  return String(value || "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function normalizedLower(value: string | null | undefined) {
  return normalize(value).toLocaleLowerCase();
}

function recipientAddress(value: string) {
  return value.match(/<([^>]+@[^>]+)>/)?.[1]?.trim().toLowerCase()
    || value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()
    || value.trim().toLowerCase();
}

function replyAllCc(message: ContextualAcknowledgmentMessage) {
  const sender = recipientAddress(message.fromEmail);
  const owner = (process.env.EMAIL_USER || "a.zaqout@comodevelopments.com").trim().toLowerCase();
  const recipients = [message.toText, message.ccText]
    .flatMap(value => String(value || "").split(/[;,]/))
    .map(value => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return recipients.filter(recipient => {
    const address = recipientAddress(recipient);
    if (!address || address === sender || address === owner || seen.has(address)) return false;
    seen.add(address);
    return true;
  }).join(", ");
}

function replySubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, " ").trim() || "(no subject)";
  return /^\s*re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function containsArabic(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function acknowledgementBody(message: ContextualAcknowledgmentMessage, mode: "courtesy" | "review") {
  const source = `${message.subject}\n${message.bodyText}`;
  if (containsArabic(source)) {
    return mode === "courtesy"
      ? "شكرًا لتأكيدكم. تم الاطلاع على رسالتكم.\n\nمع التحية،\nAbdalrahman Zaqout"
      : "شكرًا لرسالتكم. تم استلامها وستتم مراجعة الطلب داخليًا قبل تأكيد أي خطوة تالية.\n\nمع التحية،\nAbdalrahman Zaqout";
  }
  return mode === "courtesy"
    ? "Thank you for confirming. Your message has been noted.\n\nKind regards,\nAbdalrahman Zaqout"
    : "Thank you for your message. We have received it and will review the request internally before confirming any next step.\n\nKind regards,\nAbdalrahman Zaqout";
}

/** The key is stable for a mailbox message and suitable for a future unique DB ledger. */
export function contextualAcknowledgmentIdempotencyKey(message: Pick<ContextualAcknowledgmentMessage, "userId" | "id" | "messageIdentitySha256">) {
  const identity = String(message.messageIdentitySha256 || "").trim() || String(message.id);
  return `como-contextual-ack:v1:${createHash("sha256").update(`${message.userId}:${identity}`).digest("hex")}`;
}

export type AcknowledgmentClassification = {
  hasRequestOrCommitment: boolean;
  highStakes: boolean;
  uncertain: boolean;
  labels: string[];
};

/**
 * Deterministic deny-list classification. The allow-list is deliberately tiny:
 * only a clear, non-question courtesy/confirmation can reach a candidate.
 */
export function classifyContextualAcknowledgment(message: Pick<ContextualAcknowledgmentMessage, "subject" | "bodyText" | "fromEmail">): AcknowledgmentClassification {
  const subject = normalizedLower(message.subject);
  const body = normalizedLower(message.bodyText).slice(0, 20_000);
  const text = `${subject}\n${body}`;
  const labels: string[] = [];
  const mark = (label: string, matches: boolean) => { if (matches) labels.push(label); return matches; };

  const appointment = mark("appointment", /\b(meeting|appointment|calendar|schedule|reschedul|invite)\b|موعد|اجتماع|تقويم|جدول/.test(text));
  const financial = mark("financial", /\b(invoice|payment|paid|payable|bank|transfer|fee|budget|financial|money|aed|usd)\b|فاتورة|دفع|سداد|تحويل|بنك|مالية|أتعاب|درهم/.test(text));
  const contract = mark("contract", /\b(contract|agreement|legal|signature|sign-off|terms)\b|عقد|اتفاقية|قانوني|توقيع|بنود/.test(text));
  const change = mark("change", /\b(change|changed|revise|revision|amend|update|replace|cancel|postpone)\b|تعديل|تغيير|مراجعة|نسخة جديدة|تحديث|إلغاء|تأجيل/.test(text));
  const question = mark("practical_question", /[?؟]|\b(please|could you|can you|would you|when|where|how|who|which|kindly)\b|(?:هل|متى|أين|كيف|من|يرجى|يرجى التكرم|نرجو)/.test(text));
  const request = mark("request", /\b(request|need|require|ask|please|kindly|confirm|approve|send|provide|submit|arrange)\b|(?:طلب|يرجى|نرجو|أكد|اعتمد|أرسل|زو[ّ]?د|قد[ّ]?م|رتب)/.test(text));
  const commitment = mark("commitment", /\b(i will|we will|shall|commit|confirm|approve|accept|agree|proceed|promise)\b|(?:سوف|سنقوم|ألتزم|نلتزم|أؤكد|نؤكد|أوافق|نعتمد|نقبل|نتابع)/.test(text));
  const deliveryOrAuto = mark("automation_signal", /(?:no[ -]?reply|do[ -]?not[ -]?reply|mailer-daemon|postmaster|automatic reply|out of office|delivery status|undeliverable|unsubscribe|إشعار تلقائي|لا ترد|خارج المكتب)/.test(`${message.fromEmail}\n${text}`));

  const clearCourtesy = /\b(thank you|thanks|noted|acknowledged|received with thanks|much appreciated)\b|(?:شكرًا|شكرا|تم الاطلاع|تم الاستلام|ممتن)/.test(text);
  const substantiveWords = body.replace(/\b(thank you|thanks|noted|acknowledged|received with thanks|much appreciated)\b|(?:شكرًا|شكرا|تم الاطلاع|تم الاستلام|ممتن)|[\s.,!،؛:]+/g, "").length;
  const uncertain = deliveryOrAuto || !clearCourtesy || substantiveWords > 180;
  if (uncertain) labels.push("uncertain");

  return {
    hasRequestOrCommitment: request || commitment,
    highStakes: appointment || financial || contract || change || question,
    uncertain,
    labels: [...new Set(labels)],
  };
}

function projectIsVerified(project: VerifiedProjectBinding) {
  return project.status === "verified" && project.accessVerified && Boolean(project.projectId && project.workFileId);
}

function canBeNewInboxMessage(message: ContextualAcknowledgmentMessage, activationStartedAt: string) {
  const receivedAt = parseUtc(message.receivedAt);
  const activation = parseUtc(activationStartedAt);
  return message.folderName === "INBOX" && Boolean(receivedAt && activation && receivedAt.getTime() >= activation.getTime());
}

function sentReviewIsSafe(review: ReadonlySentReview) {
  return review.isFreshReadonlyReview
    && review.outcome === "no_relevant_owner_reply"
    && Boolean(parseUtc(review.reviewedAt));
}

function makeDraft(message: ContextualAcknowledgmentMessage, project: VerifiedProjectBinding, key: string, mode: "courtesy" | "review"): AcknowledgmentDraft {
  const existingCc = replyAllCc(message);
  const cc = applyComoCcPolicy({
    to: message.fromEmail,
    cc: existingCc || undefined,
    waelAppointment: project.verifiedWaelAppointment === true,
  });
  return {
    to: message.fromEmail.trim(),
    cc,
    subject: replySubject(message.subject),
    body: acknowledgementBody(message, mode),
    inReplyTo: message.messageId?.trim() || undefined,
    draftKey: key,
  };
}

function makeSaraAlert(message: ContextualAcknowledgmentMessage, project: VerifiedProjectBinding, key: string, reason: AcknowledgmentReason): SaraAlert {
  return {
    title: "مراجعة بريد COMO مطلوبة",
    message: `الرسالة «${message.subject}» من ${message.fromEmail} تحتاج مسودة ومراجعة قبل أي إرسال (${reason}).`,
    idempotencyKey: `${key}:sara`,
    emailId: message.id,
    projectId: Number(project.projectId),
    workFileId: Number(project.workFileId),
  };
}

function plan(input: ContextualAcknowledgmentInput, disposition: AcknowledgmentDisposition, reason: AcknowledgmentReason, classification: AcknowledgmentClassification, draft: AcknowledgmentDraft | null, saraAlert: SaraAlert | null): ContextualAcknowledgmentPlan {
  const key = contextualAcknowledgmentIdempotencyKey(input.message);
  return {
    idempotencyKey: key,
    disposition,
    reason,
    externalDeliveryAuthorized: false,
    messageId: input.message.id,
    projectId: input.project.projectId ? Number(input.project.projectId) : null,
    workFileId: input.project.workFileId ? Number(input.project.workFileId) : null,
    draft,
    saraAlert,
    audit: {
      sentHistoryReviewed: sentReviewIsSafe(input.sentReview),
      noHistoricalReply: canBeNewInboxMessage(input.message, input.activationStartedAt),
      projectVerified: projectIsVerified(input.project),
      systemSignal: input.message.systemSignal,
      classifications: classification.labels,
    },
  };
}

/**
 * Produces a review-only plan. Callers must persist/claim the idempotency key
 * before executing Draft/Sara intents. A result never authorizes live delivery.
 */
export function planContextualAcknowledgment(input: ContextualAcknowledgmentInput): ContextualAcknowledgmentPlan {
  const key = contextualAcknowledgmentIdempotencyKey(input.message);
  const classification = classifyContextualAcknowledgment(input.message);
  const generic = (disposition: AcknowledgmentDisposition, reason: AcknowledgmentReason) => plan(input, disposition, reason, classification, null, null);

  if (input.message.folderName !== "INBOX") return generic("skip", "not_new_inbox_message");
  if (!canBeNewInboxMessage(input.message, input.activationStartedAt)) return generic("skip", "historical_message");
  if (input.message.systemSignal !== "known_non_system") return generic("skip", "system_or_unverified_sender");
  if (!projectIsVerified(input.project)) return generic("manual_review", "project_not_verified");
  if (!sentReviewIsSafe(input.sentReview)) return generic("manual_review", "sent_history_not_safe");

  if (classification.hasRequestOrCommitment || classification.highStakes) {
    const reason: AcknowledgmentReason = classification.highStakes
      ? "high_stakes_requires_draft"
      : "request_or_commitment_requires_draft";
    const draft = makeDraft(input.message, input.project, key, "review");
    return plan(input, "draft_and_notify_sara", reason, classification, draft, makeSaraAlert(input.message, input.project, key, reason));
  }
  if (classification.uncertain) return generic("manual_review", "unknown_or_ambiguous_content");

  // This remains a candidate only. The current application has no adapter that
  // can deliver it, and this module deliberately exposes no live-send function.
  return plan(input, "auto_ack_candidate", "eligible_contextual_courtesy", classification, makeDraft(input.message, input.project, key, "courtesy"), null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Durable execution adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * This is intentionally not an SMTP feature flag.  No implementation in this
 * module sends mail.  A candidate is saved as a normal Private Email Draft so
 * the owner can inspect, amend, and send it from their mail client.  Keeping the
 * mode as a literal rather than an environment switch prevents a deployment
 * configuration error from silently turning a courtesy acknowledgment into live
 * external delivery.
 */
export const CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE = "draft_only" as const;

export type ContextualAcknowledgmentLedgerStatus =
  | "claimed"
  | "skipped"
  | "manual_review"
  | "draft_ready"
  | "draft_and_sara_ready"
  | "failed";

export type ContextualAcknowledgmentLedgerRecord = {
  id: number;
  status: ContextualAcknowledgmentLedgerStatus;
  idempotencyKey: string;
  claimToken?: string | null;
  communicationId?: number | null;
  saraProposalId?: number | null;
};

export type ContextualAcknowledgmentActivation = {
  activationStartedAt: string;
  deliveryMode: typeof CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE;
};

export type ContextualAcknowledgmentDraftResult = {
  communicationId: number | null;
  mailboxDraftRef: string | null;
};

export type ContextualAcknowledgmentSaraResult = {
  proposalId: number | null;
};

export type ContextualAcknowledgmentAdapter = {
  /** Atomically claim or reclaim one durable ledger row; no work follows an in-progress claim. */
  claim(input: {
    idempotencyKey: string;
    userId: number;
    emailId: number;
    activationStartedAt: string;
    projectId: number | null;
    workFileId: number | null;
  }): Promise<{ claimed: boolean; record: ContextualAcknowledgmentLedgerRecord }>;
  /** A new review is required before the first Draft is allowed. */
  reviewSent(message: ContextualAcknowledgmentMessage): Promise<ReadonlySentReview>;
  /** This may create a mailbox Draft, but must never use SMTP delivery. */
  saveDraft(input: { draft: AcknowledgmentDraft; plan: ContextualAcknowledgmentPlan }): Promise<ContextualAcknowledgmentDraftResult>;
  /** A review-only record visible in Sara's existing COMO Next proposal queue. */
  recordSaraReview(input: { alert: SaraAlert; plan: ContextualAcknowledgmentPlan }): Promise<ContextualAcknowledgmentSaraResult>;
  complete(input: {
    ledgerId: number;
    status: ContextualAcknowledgmentLedgerStatus;
    plan: ContextualAcknowledgmentPlan;
    sentReview?: ReadonlySentReview | null;
    communicationId?: number | null;
    mailboxDraftRef?: string | null;
    saraProposalId?: number | null;
    lastError?: string | null;
    claimToken: string;
  }): Promise<void>;
};

export type ContextualAcknowledgmentExecutionInput = {
  message: ContextualAcknowledgmentMessage;
  project: VerifiedProjectBinding;
  activation: ContextualAcknowledgmentActivation;
};

export type ContextualAcknowledgmentExecutionResult = {
  status: "disabled" | "in_progress" | "skipped" | "manual_review" | "draft_ready" | "draft_and_sara_ready" | "replayed";
  plan: ContextualAcknowledgmentPlan | null;
  ledgerId: number | null;
  communicationId: number | null;
  saraProposalId: number | null;
  externalDeliveryAuthorized: false;
};

const FINAL_LEDGER_STATUSES = new Set<ContextualAcknowledgmentLedgerStatus>([
  "skipped",
  "manual_review",
  "draft_ready",
  "draft_and_sara_ready",
]);

function asSqlUtc(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function compactError(error: unknown) {
  const value = error instanceof Error ? error.message : String(error || "unknown_error");
  return value.replace(/[\r\n]+/g, " ").slice(0, 1_000);
}

/**
 * Executes exactly one imported message after a durable claim.  The adapter is
 * deliberately injectable: tests exercise retry/idempotency behavior without a
 * database, mailbox, SMTP transport, or credentials.
 */
export async function processContextualAcknowledgmentWithAdapter(
  input: ContextualAcknowledgmentExecutionInput,
  adapter: ContextualAcknowledgmentAdapter,
): Promise<ContextualAcknowledgmentExecutionResult> {
  if (input.activation.deliveryMode !== CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE) {
    return { status: "disabled", plan: null, ledgerId: null, communicationId: null, saraProposalId: null, externalDeliveryAuthorized: false };
  }

  const idempotencyKey = contextualAcknowledgmentIdempotencyKey(input.message);
  const claim = await adapter.claim({
    idempotencyKey,
    userId: input.message.userId,
    emailId: input.message.id,
    activationStartedAt: input.activation.activationStartedAt,
    projectId: input.project.projectId ? Number(input.project.projectId) : null,
    workFileId: input.project.workFileId ? Number(input.project.workFileId) : null,
  });

  if (!claim.claimed && FINAL_LEDGER_STATUSES.has(claim.record.status)) {
    return {
      status: "replayed",
      plan: null,
      ledgerId: claim.record.id,
      communicationId: claim.record.communicationId ?? null,
      saraProposalId: claim.record.saraProposalId ?? null,
      externalDeliveryAuthorized: false,
    };
  }
  if (!claim.claimed) {
    return {
      status: "in_progress",
      plan: null,
      ledgerId: claim.record.id,
      communicationId: claim.record.communicationId ?? null,
      saraProposalId: claim.record.saraProposalId ?? null,
      externalDeliveryAuthorized: false,
    };
  }
  const claimToken = claim.record.claimToken;
  if (!claimToken) throw new Error("contextual_acknowledgment_claim_token_missing");

  // A Sent inspection is intentionally delayed until after the durable claim,
  // but it is still completed before a Draft can be written.  Messages that are
  // already structurally ineligible cannot cause any external mailbox action.
  const structuralEligible = input.message.folderName === "INBOX"
    && input.message.systemSignal === "known_non_system"
    && projectIsVerified(input.project)
    && canBeNewInboxMessage(input.message, input.activation.activationStartedAt);
  const sentReview: ReadonlySentReview = structuralEligible
    ? await adapter.reviewSent(input.message)
    : { outcome: "not_reviewed", isFreshReadonlyReview: false, reviewedAt: null };
  const plan = planContextualAcknowledgment({
    message: input.message,
    project: input.project,
    activationStartedAt: input.activation.activationStartedAt,
    sentReview,
  });

  try {
    if (plan.disposition === "skip") {
      await adapter.complete({ ledgerId: claim.record.id, status: "skipped", plan, sentReview, claimToken });
      return { status: "skipped", plan, ledgerId: claim.record.id, communicationId: null, saraProposalId: null, externalDeliveryAuthorized: false };
    }
    if (plan.disposition === "manual_review" || !plan.draft) {
      await adapter.complete({ ledgerId: claim.record.id, status: "manual_review", plan, sentReview, claimToken });
      return { status: "manual_review", plan, ledgerId: claim.record.id, communicationId: null, saraProposalId: null, externalDeliveryAuthorized: false };
    }

    // Both a benign courtesy candidate and a risky message stop at a Draft.
    // There is deliberately no branch that can call SMTP from this adapter.
    const draft = await adapter.saveDraft({ draft: plan.draft, plan });
    if (!plan.saraAlert) {
      await adapter.complete({
        ledgerId: claim.record.id,
        status: "draft_ready",
        plan,
        sentReview,
        communicationId: draft.communicationId,
        mailboxDraftRef: draft.mailboxDraftRef,
        claimToken,
      });
      return {
        status: "draft_ready",
        plan,
        ledgerId: claim.record.id,
        communicationId: draft.communicationId,
        saraProposalId: null,
        externalDeliveryAuthorized: false,
      };
    }

    const sara = await adapter.recordSaraReview({ alert: plan.saraAlert, plan });
    await adapter.complete({
      ledgerId: claim.record.id,
      status: "draft_and_sara_ready",
      plan,
      sentReview,
      communicationId: draft.communicationId,
      mailboxDraftRef: draft.mailboxDraftRef,
      saraProposalId: sara.proposalId,
      claimToken,
    });
    return {
      status: "draft_and_sara_ready",
      plan,
      ledgerId: claim.record.id,
      communicationId: draft.communicationId,
      saraProposalId: sara.proposalId,
      externalDeliveryAuthorized: false,
    };
  } catch (error) {
    await adapter.complete({
      ledgerId: claim.record.id,
      status: "failed",
      plan,
      sentReview,
      lastError: compactError(error),
      claimToken,
    }).catch(() => undefined);
    throw error;
  }
}

function normalizedThreadSubject(value: string) {
  return normalizedLower(value).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/, "").trim();
}

function addresses(value: string | null | undefined) {
  return String(value || "").split(/[;,]/).map(recipientAddress).filter(Boolean);
}

/**
 * A fresh, read-only check of Sent is a guard, not proof that a message may be
 * sent.  The mailbox projection does not preserve References/In-Reply-To, so
 * the matcher is conservative: same recipient, normalized thread subject, and
 * Sent date at or after the incoming date.  A saturated bounded query is marked
 * ambiguous rather than assumed safe.
 */
export async function reviewContextualAcknowledgmentSentHistory(
  message: ContextualAcknowledgmentMessage,
  now = new Date(),
): Promise<ReadonlySentReview> {
  const receivedAt = parseUtc(message.receivedAt);
  if (!receivedAt) return { outcome: "not_reviewed", isFreshReadonlyReview: false, reviewedAt: null };
  const hours = Math.max(1, Math.min(24 * 365, Math.ceil((now.getTime() - receivedAt.getTime()) / (60 * 60 * 1_000)) + 2));
  const maxMessages = 250;
  try {
    const batch = await fetchReadonlySentSince(hours, maxMessages);
    const owner = getConfiguredMailboxAddress();
    const sender = recipientAddress(message.fromEmail);
    const sourceSubject = normalizedThreadSubject(message.subject);
    const relevantOwnerReply = batch.messages.some((sent: EmailMessage) => {
      const sentAt = sent.date.getTime();
      return recipientAddress(sent.from) === owner
        && addresses(sent.to).includes(sender)
        && normalizedThreadSubject(sent.subject) === sourceSubject
        && sentAt >= receivedAt.getTime();
    });
    return {
      reviewedAt: now.toISOString(),
      isFreshReadonlyReview: true,
      outcome: relevantOwnerReply ? "owner_reply_present" : batch.messages.length >= maxMessages ? "ambiguous" : "no_relevant_owner_reply",
    };
  } catch {
    return { outcome: "not_reviewed", isFreshReadonlyReview: false, reviewedAt: null };
  }
}

function mapStoredEmailToAcknowledgmentMessage(email: typeof comoNextEmailMessages.$inferSelect, systemSignal: SystemSignal): ContextualAcknowledgmentMessage {
  return {
    id: Number(email.id),
    userId: Number(email.userId),
    messageIdentitySha256: email.messageIdSha256,
    folderName: email.folderName,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    toText: email.toText,
    ccText: email.ccText,
    subject: email.subject,
    bodyText: email.bodyText,
    messageId: email.messageId,
    receivedAt: email.receivedAt,
    // The readonly projection does not yet retain raw Auto-Submitted or
    // Precedence headers.  Callers therefore must explicitly attest the signal;
    // omitted input remains unknown and is never eligible for a Draft.
    systemSignal,
  };
}

async function resolveVerifiedProjectBinding(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: typeof comoNextEmailMessages.$inferSelect) {
  if (email.inboxStatus !== "linked" || !email.linkedProjectId || !email.linkedWorkFileId) {
    return { status: "unlinked", accessVerified: false } satisfies VerifiedProjectBinding;
  }
  try {
    await requireProjectAccess(db, Number(email.linkedProjectId), Number(email.userId), "write");
    const [workFile] = await db.select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId })
      .from(comoNextWorkFiles)
      .where(and(
        eq(comoNextWorkFiles.id, Number(email.linkedWorkFileId)),
        eq(comoNextWorkFiles.projectId, Number(email.linkedProjectId)),
        eq(comoNextWorkFiles.userId, Number(email.userId)),
      )).limit(1);
    if (!workFile) return { status: "ambiguous", accessVerified: false } satisfies VerifiedProjectBinding;
    return {
      status: "verified",
      projectId: Number(email.linkedProjectId),
      workFileId: Number(workFile.id),
      accessVerified: true,
      // Appointment status is never inferred from an email acknowledgment.
      verifiedWaelAppointment: false,
    } satisfies VerifiedProjectBinding;
  } catch {
    return { status: "ambiguous", accessVerified: false } satisfies VerifiedProjectBinding;
  }
}

function storedLedgerRecord(row: typeof comoNextContextualAcknowledgmentLedger.$inferSelect): ContextualAcknowledgmentLedgerRecord {
  return {
    id: Number(row.id),
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    claimToken: row.claimToken,
    communicationId: row.communicationId == null ? null : Number(row.communicationId),
    saraProposalId: row.saraProposalId == null ? null : Number(row.saraProposalId),
  };
}

async function durableClaimContextualAcknowledgment(input: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  idempotencyKey: string;
  userId: number;
  emailId: number;
  activationStartedAt: string;
  projectId: number | null;
  workFileId: number | null;
}) {
  const activationStartedAt = asSqlUtc(new Date(input.activationStartedAt));
  const claimToken = randomUUID();
  const result = await input.db.execute(sql`
    INSERT IGNORE INTO como_next_contextual_acknowledgment_ledger
      (idempotency_key, user_id, email_message_id, project_id, work_file_id, activation_started_at, status, claim_token, claimed_at)
    VALUES (${input.idempotencyKey}, ${input.userId}, ${input.emailId}, ${input.projectId}, ${input.workFileId}, ${activationStartedAt}, 'claimed', ${claimToken}, UTC_TIMESTAMP())
  `);
  const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
  let [row] = await input.db.select().from(comoNextContextualAcknowledgmentLedger)
    .where(eq(comoNextContextualAcknowledgmentLedger.idempotencyKey, input.idempotencyKey)).limit(1);
  if (!row) throw new Error("contextual_acknowledgment_claim_not_persisted");
  if (Number(header.affectedRows || 0) === 1) return { claimed: true, record: storedLedgerRecord(row) };

  // A worker that dies after a Draft is written is safe to retry: Draft and
  // Sara writes carry their own stable keys.  A live worker is never stolen;
  // only an explicit failure or an abandoned 10-minute claim can be reclaimed.
  const recovery = await input.db.execute(sql`
    UPDATE como_next_contextual_acknowledgment_ledger
    SET status='claimed', claim_token=${claimToken}, claimed_at=UTC_TIMESTAMP(), last_error=NULL
    WHERE id=${row.id}
      AND (status='failed' OR (status='claimed' AND claimed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)))
  `);
  const recoveryHeader = (Array.isArray(recovery) ? recovery[0] : recovery) as { affectedRows?: number };
  if (Number(recoveryHeader.affectedRows || 0) === 1) {
    [row] = await input.db.select().from(comoNextContextualAcknowledgmentLedger)
      .where(eq(comoNextContextualAcknowledgmentLedger.idempotencyKey, input.idempotencyKey)).limit(1);
    if (!row) throw new Error("contextual_acknowledgment_reclaim_not_persisted");
    return { claimed: true, record: storedLedgerRecord(row) };
  }
  return { claimed: false, record: storedLedgerRecord(row) };
}

/**
 * Real database/mailbox adapter for one imported message.  It does not activate
 * itself: an operator must first provision an enabled, Draft-only setting with a
 * persisted watermark.  No migration is applied and no setting is created here.
 */
export async function processContextualAcknowledgmentMessage(input: {
  userId: number;
  emailId: number;
  /** Must come from a raw-header-aware integration; defaults to ineligible. */
  systemSignal?: SystemSignal;
  now?: Date;
}): Promise<ContextualAcknowledgmentExecutionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for contextual acknowledgment");
  const [email] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, input.emailId),
    eq(comoNextEmailMessages.userId, input.userId),
  )).limit(1);
  if (!email) throw new Error("Contextual acknowledgment source email was not found");
  const [settings] = await db.select().from(comoNextContextualAcknowledgmentSettings).where(and(
    eq(comoNextContextualAcknowledgmentSettings.userId, input.userId),
    eq(comoNextContextualAcknowledgmentSettings.mailboxKey, email.mailboxKey),
    eq(comoNextContextualAcknowledgmentSettings.isEnabled, 1),
  )).limit(1);
  if (!settings || settings.deliveryMode !== CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE) {
    return { status: "disabled", plan: null, ledgerId: null, communicationId: null, saraProposalId: null, externalDeliveryAuthorized: false };
  }

  const message = mapStoredEmailToAcknowledgmentMessage(email, input.systemSignal || "unknown");
  const project = await resolveVerifiedProjectBinding(db, email);
  const now = input.now || new Date();
  return processContextualAcknowledgmentWithAdapter({
    message,
    project,
    activation: {
      activationStartedAt: settings.activationStartedAt,
      deliveryMode: CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE,
    },
  }, {
    claim: claimInput => durableClaimContextualAcknowledgment({ db, ...claimInput }),
    reviewSent: sourceMessage => reviewContextualAcknowledgmentSentHistory(sourceMessage, now),
    saveDraft: async ({ draft, plan }) => {
      if (!plan.workFileId) throw new Error("A verified work file is required for a contextual acknowledgment Draft");
      const result = await createCommunicationDraftCommand({
        userId: input.userId,
        workFileId: plan.workFileId,
        channel: "email",
        subject: draft.subject,
        body: draft.body,
        toText: draft.to,
        ccText: draft.cc || null,
        sourceEmailId: plan.messageId,
        idempotencyKey: draft.draftKey,
      });
      return {
        communicationId: Number(result.id),
        mailboxDraftRef: "mailboxDraft" in result && result.mailboxDraft
          ? result.mailboxDraft.uid ? `${result.mailboxDraft.folder} UID ${result.mailboxDraft.uid}` : result.mailboxDraft.folder
          : null,
      };
    },
    recordSaraReview: async ({ alert, plan }) => {
      if (!plan.projectId || !plan.workFileId) throw new Error("A verified project/work file is required for Sara review");
      const result = await createIntakeProposalsCommand({
        userId: input.userId,
        projectId: plan.projectId,
        workFileId: plan.workFileId,
        sourceKind: "email",
        sourcePrefix: alert.idempotencyKey,
        sourceEmailId: plan.messageId,
        proposals: [{
          kind: "communication_draft",
          title: alert.title,
          content: alert.message,
          acceptanceCriteria: "راجع مسودة الإقرار قبل أي إرسال. المسودة ليست إرسالًا ولا تتضمن قبولًا أو التزامًا.",
          ownerType: "human",
          priority: "important",
          channel: "email",
          toText: message.fromEmail,
          evidenceExcerpt: `رسالة COMO #${plan.messageId}: ${message.subject}`,
        }],
      });
      return { proposalId: result.ids[0] ?? null };
    },
    complete: async completion => {
      const completionResult = await db.update(comoNextContextualAcknowledgmentLedger).set({
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
        lastError: completion.lastError ?? null,
        completedAt: ["skipped", "manual_review", "draft_ready", "draft_and_sara_ready"].includes(completion.status) ? asSqlUtc(now) : null,
      }).where(and(
        eq(comoNextContextualAcknowledgmentLedger.id, completion.ledgerId),
        eq(comoNextContextualAcknowledgmentLedger.claimToken, completion.claimToken),
      ));
      const header = (Array.isArray(completionResult) ? completionResult[0] : completionResult) as { affectedRows?: number };
      if (Number(header.affectedRows || 0) !== 1) throw new Error("contextual_acknowledgment_claim_lost_before_completion");
    },
  });
}
