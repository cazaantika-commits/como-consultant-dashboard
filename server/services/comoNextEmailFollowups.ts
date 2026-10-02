import { createHash } from "node:crypto";
import { saveComoMailboxDraft } from "../emailMonitor";

/**
 * COMO Next email follow-ups deliberately keep delivery confirmation, outcome
 * classification, persistence, and mailbox I/O behind explicit boundaries.
 *
 * The current schema has no dedicated follow-up table and no trustworthy field
 * that joins a mailbox Sent item back to an owner directive. The integration
 * adapter must therefore establish `authenticatedSentRecord` from a read-only
 * IMAP Sent import plus its linked communication/work-file record before it
 * calls this service. A Draft, an `approved_for_send` communication, or a bare
 * "Sent" label is never sufficient input here.
 */

export const COMO_NEXT_FOLLOWUP_TIMEZONE = "Asia/Dubai" as const;
export const DEFAULT_DUBAI_WEEKEND = ["saturday", "sunday"] as const;

export type DubaiWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type FollowupResolutionKind = "reply" | "analysis" | "deliverable" | "invoice_paid";
export type FollowupEvidenceKind = FollowupResolutionKind | "invoice_approved";
export type FollowupStatus = "scheduled" | "drafting" | "draft_ready" | "owner_review" | "cancelled";

export type DubaiBusinessCalendar = {
  /** Use only when verified facts establish a different weekend for this item. */
  weekendDays?: readonly DubaiWeekday[];
};

/**
 * Immutable proof supplied by the read-only Sent importer. Subject, recipients,
 * a bare Draft record, and a communication status never establish this link.
 */
export type SystemDraftSentCorrelation = {
  /** X-COMO-Draft-Key assigned to the original system Draft. */
  systemDraftKey: string;
  /** The same header observed on the imported Sent item, when retained. */
  observedSentDraftKey?: string | null;
  /** Original Message-ID permitted as a deterministic thread anchor. */
  expectedThreadMessageId?: string | null;
  /** Parsed In-Reply-To/References IDs on the imported Sent item. */
  observedThreadMessageIds?: readonly string[];
};

export type ConfirmedSentReminder = {
  userId: number;
  workFileId: number;
  /** Immutable IMAP or provider message identity, not a mailbox UID alone. */
  sentMessageId: string;
  /** Stable reference to the read-only imported Sent record, used in audit keys. */
  sentMessageRef: string;
  sentAt: string;
  toText: string;
  ccText?: string | null;
  subject: string;
  /**
   * Evidence pointer supplied by the adapter. It may be a staged-directive ID
   * or a human-recorded owner direction. The service never guesses it from
  * message text.
  */
  ownerDirectiveRef: string;
  /** Explicit owner approval recorded on the originating directive only. */
  ownerDirectiveExplicitlyApproved: boolean;
  /** Read-only Sent-to-system-Draft proof, never inferred from text. */
  sentCorrelation: SystemDraftSentCorrelation;
  /** The adapter must prove this through a Sent-import/linked-work-file join. */
  authenticatedSentRecord: boolean;
  /** Must be the actual Sent folder, exactly; Drafts and any other folder fail closed. */
  sourceFolder: string;
  /** Must be false. A draft message is never a follow-up trigger. */
  sourceIsDraft: boolean;
  /**
   * The only outcomes allowed to cancel this reminder. `invoice_approved` is
   * intentionally absent: approval of an invoice is never evidence of payment.
   */
  expectedResolutionKinds: readonly FollowupResolutionKind[];
  followUpAtOverride?: string | null;
  calendar?: DubaiBusinessCalendar;
};

export type FollowupResolutionEvidence = {
  workFileId: number;
  sourceSentMessageRef: string;
  kind: FollowupEvidenceKind;
  occurredAt: string;
  /** Must come from an explicit reviewer/model decision, never keyword matching. */
  explicitlyAdequate: boolean;
  evidenceReference: string;
};

export type ComoNextEmailFollowup = {
  id: string;
  idempotencyKey: string;
  userId: number;
  workFileId: number;
  sentMessageId: string;
  sentMessageRef: string;
  sentAt: string;
  toText: string;
  ccText: string | null;
  subject: string;
  ownerDirectiveRef: string;
  ownerDirectiveExplicitlyApproved: boolean;
  sentCorrelation: SystemDraftSentCorrelation;
  expectedResolutionKinds: readonly FollowupResolutionKind[];
  followUpAt: string;
  status: FollowupStatus;
  mailboxDraftRef: string | null;
  /** Lease token returned only to the worker that owns a drafting claim. */
  draftClaimToken: string | null;
};

export type FollowupScheduleResult = {
  followup: ComoNextEmailFollowup;
  replayed: boolean;
};

export type FollowupScheduleInput = Omit<
  ComoNextEmailFollowup,
  "id" | "status" | "mailboxDraftRef" | "draftClaimToken"
>;

export type FollowupDraft = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo: string;
  /** Stable across retries, so the real Draft mailbox write is idempotent too. */
  draftKey: string;
};

export type MailboxDraftReceipt = {
  folder: string;
  uid: number | null;
  created: boolean;
};

/**
 * Persistence requirements for the adapter:
 * - `scheduleIfAbsent` has a database unique constraint on `idempotencyKey`.
 * - `claimDueForDraft`, `cancelIfActive`, and `markDraftPrepared` are compare-
 *   and-swap operations. A stale drafting claim may be reclaimed safely.
 * - `findResolutionEvidence` returns only evidence scoped to both the work file
 *   and the original Sent message reference; this service applies the final
 *   adequacy/time/invoice checks.
 */
export interface ComoNextEmailFollowupStore {
  scheduleIfAbsent(followup: FollowupScheduleInput): Promise<FollowupScheduleResult>;
  rescheduleDueAt(input: { followupId: string; followUpAt: string }): Promise<ComoNextEmailFollowup>;
  listActive(): Promise<ComoNextEmailFollowup[]>;
  findResolutionEvidence(followup: ComoNextEmailFollowup): Promise<FollowupResolutionEvidence[]>;
  cancelIfActive(input: {
    followupId: string;
    resolution: FollowupResolutionEvidence;
    reason: string;
  }): Promise<boolean>;
  /** Atomically changes a due scheduled/reclaimable record into `drafting`. */
  claimDueForDraft(input: { followupId: string; now: string }): Promise<ComoNextEmailFollowup | null>;
  markDraftPrepared(input: { followupId: string; draftClaimToken: string; mailboxDraftRef: string }): Promise<boolean>;
  /** Restores retryability when the mailbox Draft write fails. */
  releaseDraftClaim(input: { followupId: string; draftClaimToken: string; error: string }): Promise<void>;
  /** Records a due item for an owner; it must never create a mailbox Draft. */
  markOwnerReview(input: { followupId: string; reason: string }): Promise<boolean>;
}

export interface ComoNextEmailFollowupDraftGateway {
  /** Must create only an IMAP Draft; SMTP delivery is prohibited. */
  saveReviewDraft(draft: FollowupDraft): Promise<MailboxDraftReceipt>;
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function asDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid UTC timestamp`);
  return date;
}

function utcSql(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isoUtc(date: Date) {
  return date.toISOString();
}

function dubaiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMO_NEXT_FOLLOWUP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  const weekday = String(parts.find(part => part.type === "weekday")?.value || "").toLowerCase() as DubaiWeekday;
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
    weekday,
  };
}

/** Dubai has no DST. This preserves the original Asia/Dubai wall-clock time. */
function fromDubaiParts(parts: Omit<ReturnType<typeof dubaiParts>, "weekday">) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour - 4, parts.minute, parts.second));
}

function nextDubaiCalendarDay(parts: ReturnType<typeof dubaiParts>) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, parts.hour, parts.minute, parts.second));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: next.getUTCHours(),
    minute: next.getUTCMinutes(),
    second: next.getUTCSeconds(),
  };
}

function weekdayForDubaiDate(parts: Omit<ReturnType<typeof dubaiParts>, "weekday">): DubaiWeekday {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: COMO_NEXT_FOLLOWUP_TIMEZONE,
    weekday: "long",
  }).format(fromDubaiParts(parts)).toLowerCase() as DubaiWeekday;
}

function normalizedWeekend(calendar?: DubaiBusinessCalendar) {
  const weekend = calendar?.weekendDays?.length ? calendar.weekendDays : DEFAULT_DUBAI_WEEKEND;
  const allowed = new Set<DubaiWeekday>(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  if (weekend.some(day => !allowed.has(day))) throw new Error("calendar.weekendDays contains an invalid weekday");
  return new Set(weekend);
}

/**
 * Adds business days in Asia/Dubai. Saturday/Sunday are skipped by default;
 * callers may provide a fact-backed calendar override for an exceptional case.
 */
export function addDubaiBusinessDays(sentAt: string, businessDays = 3, calendar?: DubaiBusinessCalendar) {
  if (!Number.isInteger(businessDays) || businessDays < 0) throw new Error("businessDays must be a non-negative integer");
  const start = asDate(sentAt, "sentAt");
  let parts = dubaiParts(start);
  const weekend = normalizedWeekend(calendar);
  let added = 0;
  while (added < businessDays) {
    const next = nextDubaiCalendarDay(parts);
    parts = { ...next, weekday: weekdayForDubaiDate(next) };
    if (!weekend.has(parts.weekday)) added += 1;
  }
  return isoUtc(fromDubaiParts(parts));
}

export function computeComoNextEmailFollowupAt(input: Pick<ConfirmedSentReminder, "sentAt" | "followUpAtOverride" | "calendar">) {
  const sentAt = asDate(input.sentAt, "sentAt");
  if (clean(input.followUpAtOverride)) {
    const override = asDate(clean(input.followUpAtOverride), "followUpAtOverride");
    if (override.getTime() <= sentAt.getTime()) throw new Error("followUpAtOverride must be after sentAt");
    return isoUtc(override);
  }
  return addDubaiBusinessDays(isoUtc(sentAt), 3, input.calendar);
}

export function comoNextEmailFollowupIdempotencyKey(input: Pick<ConfirmedSentReminder, "userId" | "workFileId" | "sentMessageRef">) {
  return createHash("sha256")
    .update(["como-next-email-followup-v1", input.userId, input.workFileId, clean(input.sentMessageRef)].join("|"))
    .digest("hex");
}

function canonicalMessageId(value: string | null | undefined) {
  return clean(value).replace(/^<|>$/g, "").toLowerCase();
}

/**
 * Only a preserved X-COMO-Draft-Key or an immutable Message-ID thread anchor
 * may bind an imported Sent item to a system Draft. Recipient/subject matching
 * is intentionally excluded to prevent accidental follow-up scheduling.
 */
export function hasAuthenticatedSystemDraftCorrelation(correlation: SystemDraftSentCorrelation) {
  const systemDraftKey = clean(correlation.systemDraftKey);
  if (!systemDraftKey) return false;
  if (clean(correlation.observedSentDraftKey) === systemDraftKey) return true;
  const expectedThreadId = canonicalMessageId(correlation.expectedThreadMessageId);
  if (!expectedThreadId) return false;
  return (correlation.observedThreadMessageIds || []).some(messageId => canonicalMessageId(messageId) === expectedThreadId);
}

export function assertConfirmedSentReminder(input: ConfirmedSentReminder) {
  if (!Number.isInteger(input.userId) || input.userId <= 0) throw new Error("userId is required");
  if (!Number.isInteger(input.workFileId) || input.workFileId <= 0) throw new Error("workFileId is required");
  if (input.authenticatedSentRecord !== true) throw new Error("A follow-up requires authenticated Sent evidence");
  if (input.sourceFolder !== "Sent") throw new Error("Only the exact Sent folder may trigger a follow-up");
  if (input.sourceIsDraft) throw new Error("A Draft can never trigger a follow-up");
  if (!clean(input.sentMessageId) || !clean(input.sentMessageRef)) throw new Error("A stable Sent message identity is required");
  if (!clean(input.ownerDirectiveRef)) throw new Error("An owner-directive reference is required");
  if (!hasAuthenticatedSystemDraftCorrelation(input.sentCorrelation)) {
    throw new Error("A follow-up requires X-COMO-Draft-Key or immutable thread correlation to a system Draft");
  }
  if (!clean(input.toText) || !clean(input.subject)) throw new Error("Recipient and subject are required");
  asDate(input.sentAt, "sentAt");
  const expected = [...new Set(input.expectedResolutionKinds)];
  if (!expected.length) throw new Error("At least one expected resolution kind is required");
  if (expected.some(kind => !["reply", "analysis", "deliverable", "invoice_paid"].includes(kind))) {
    throw new Error("Unsupported expected resolution kind");
  }
}

/** `invoice_approved` deliberately never resolves a payment follow-up. */
export function isQualifyingFollowupResolution(followup: ComoNextEmailFollowup, evidence: FollowupResolutionEvidence) {
  if (!evidence.explicitlyAdequate) return false;
  if (evidence.workFileId !== followup.workFileId) return false;
  if (clean(evidence.sourceSentMessageRef) !== clean(followup.sentMessageRef)) return false;
  if (!clean(evidence.evidenceReference)) return false;
  if (evidence.kind === "invoice_approved") return false;
  if (!followup.expectedResolutionKinds.includes(evidence.kind)) return false;
  const occurredAt = asDate(evidence.occurredAt, "resolution.occurredAt").getTime();
  const sentAt = asDate(followup.sentAt, "followup.sentAt").getTime();
  const dueAt = asDate(followup.followUpAt, "followup.followUpAt").getTime();
  return occurredAt >= sentAt && occurredAt < dueAt;
}

function draftSubject(subject: string) {
  return /^\s*re\s*:/i.test(subject) ? subject.trim() : `Re: ${subject.trim()}`;
}

export function composeComoNextFollowupDraft(followup: ComoNextEmailFollowup): FollowupDraft {
  const requested = followup.expectedResolutionKinds.includes("deliverable")
    ? "التسليم أو تحديث الحالة المطلوب"
    : followup.expectedResolutionKinds.includes("analysis")
      ? "التحليل أو تحديث الحالة المطلوب"
      : followup.expectedResolutionKinds.includes("invoice_paid")
        ? "تأكيد السداد أو تحديث الحالة المطلوب"
        : "الرد أو تحديث الحالة المطلوب";
  return {
    to: followup.toText,
    cc: followup.ccText || undefined,
    subject: draftSubject(followup.subject),
    body: [
      "السادة الكرام،",
      "",
      `نود التذكير برسالتنا السابقة بخصوص «${followup.subject}».`,
      `نرجو التكرم بموافاتنا بـ${requested}.`,
      "",
      "مع الشكر،",
      "عبد الرحمن زقوت",
    ].join("\n"),
    inReplyTo: followup.sentMessageId,
    draftKey: `como-next-followup:${followup.idempotencyKey}`,
  };
}

/** Production gateway: creates an authenticated IMAP Draft and never sends it. */
export const realMailboxReviewDraftGateway: ComoNextEmailFollowupDraftGateway = {
  async saveReviewDraft(draft) {
    return saveComoMailboxDraft(draft);
  },
};

export class ComoNextEmailFollowupService {
  constructor(
    private readonly store: ComoNextEmailFollowupStore,
    private readonly draftGateway: ComoNextEmailFollowupDraftGateway = realMailboxReviewDraftGateway,
  ) {}

  async scheduleAfterConfirmedSentReminder(input: ConfirmedSentReminder): Promise<FollowupScheduleResult> {
    assertConfirmedSentReminder(input);
    const followUpAt = computeComoNextEmailFollowupAt(input);
    const idempotencyKey = comoNextEmailFollowupIdempotencyKey(input);
    return this.store.scheduleIfAbsent({
      idempotencyKey,
      userId: input.userId,
      workFileId: input.workFileId,
      sentMessageId: clean(input.sentMessageId),
      sentMessageRef: clean(input.sentMessageRef),
      sentAt: isoUtc(asDate(input.sentAt, "sentAt")),
      toText: clean(input.toText),
      ccText: clean(input.ccText) || null,
      subject: clean(input.subject),
      ownerDirectiveRef: clean(input.ownerDirectiveRef),
      ownerDirectiveExplicitlyApproved: input.ownerDirectiveExplicitlyApproved === true,
      sentCorrelation: {
        systemDraftKey: clean(input.sentCorrelation.systemDraftKey),
        observedSentDraftKey: clean(input.sentCorrelation.observedSentDraftKey) || null,
        expectedThreadMessageId: clean(input.sentCorrelation.expectedThreadMessageId) || null,
        observedThreadMessageIds: [...new Set((input.sentCorrelation.observedThreadMessageIds || [])
          .map(messageId => clean(messageId)).filter(Boolean))],
      },
      expectedResolutionKinds: [...new Set(input.expectedResolutionKinds)],
      followUpAt,
    });
  }

  /** UI/API integrations call this after an explicit owner edit of the due date. */
  async reschedule(input: { followup: Pick<ComoNextEmailFollowup, "id" | "sentAt">; followUpAt: string }) {
    const sentAt = asDate(input.followup.sentAt, "followup.sentAt");
    const dueAt = asDate(input.followUpAt, "followUpAt");
    if (dueAt.getTime() <= sentAt.getTime()) throw new Error("followUpAt must be after sentAt");
    return this.store.rescheduleDueAt({ followupId: input.followup.id, followUpAt: isoUtc(dueAt) });
  }

  /**
   * Run after read-only mailbox import and after approved internal evidence is
   * recorded. It rechecks evidence immediately after claiming a due item to
   * close the race between a reply import and Draft preparation.
   */
  async reconcile(input: { now?: string } = {}) {
    const now = isoUtc(asDate(input.now || new Date().toISOString(), "now"));
    const active = await this.store.listActive();
    const summary = {
      examined: active.length,
      cancelled: 0,
      draftPrepared: 0,
      skipped: 0,
      failures: [] as Array<{ followupId: string; error: string }>,
    };

    for (const followup of active) {
      const evidence = await this.store.findResolutionEvidence(followup);
      const qualifying = evidence.find(item => isQualifyingFollowupResolution(followup, item));
      if (qualifying) {
        const cancelled = await this.store.cancelIfActive({
          followupId: followup.id,
          resolution: qualifying,
          reason: `Resolved before follow-up deadline by ${qualifying.kind}: ${qualifying.evidenceReference}`,
        });
        if (cancelled) summary.cancelled += 1;
        else summary.skipped += 1;
        continue;
      }

      if (asDate(now, "now").getTime() < asDate(followup.followUpAt, "followup.followUpAt").getTime()) {
        summary.skipped += 1;
        continue;
      }

      // A Sent confirmation establishes timing, not new drafting authority.
      // Do not reconstruct approval from a communication state, invoice approval,
      // or email text: keep the due item explicitly with the owner instead.
      if (!followup.ownerDirectiveExplicitlyApproved) {
        await this.store.markOwnerReview({
          followupId: followup.id,
          reason: "Due follow-up requires explicit owner approval on the original directive",
        });
        summary.skipped += 1;
        continue;
      }

      const claimed = await this.store.claimDueForDraft({ followupId: followup.id, now });
      if (!claimed) {
        summary.skipped += 1;
        continue;
      }

      const postClaimEvidence = await this.store.findResolutionEvidence(claimed);
      const postClaimResolution = postClaimEvidence.find(item => isQualifyingFollowupResolution(claimed, item));
      if (postClaimResolution) {
        const cancelled = await this.store.cancelIfActive({
          followupId: claimed.id,
          resolution: postClaimResolution,
          reason: `Resolved before follow-up deadline by ${postClaimResolution.kind}: ${postClaimResolution.evidenceReference}`,
        });
        if (cancelled) summary.cancelled += 1;
        else summary.skipped += 1;
        continue;
      }

      try {
        const receipt = await this.draftGateway.saveReviewDraft(composeComoNextFollowupDraft(claimed));
        const mailboxDraftRef = receipt.uid ? `${receipt.folder} UID ${receipt.uid}` : receipt.folder;
        if (!claimed.draftClaimToken) throw new Error("Claimed follow-up is missing its drafting lease token");
        const recorded = await this.store.markDraftPrepared({ followupId: claimed.id, draftClaimToken: claimed.draftClaimToken, mailboxDraftRef });
        if (recorded) summary.draftPrepared += 1;
        else summary.skipped += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (claimed.draftClaimToken) {
          await this.store.releaseDraftClaim({ followupId: claimed.id, draftClaimToken: claimed.draftClaimToken, error: message.slice(0, 4000) });
        }
        summary.failures.push({ followupId: claimed.id, error: message });
      }
    }
    return summary;
  }
}

/** Useful for adapters that persist MySQL DATETIME values rather than ISO text. */
export function followupUtcSqlTimestamp(value: string) {
  return utcSql(asDate(value, "timestamp"));
}
