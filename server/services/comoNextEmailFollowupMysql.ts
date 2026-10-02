import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  followupUtcSqlTimestamp,
  isQualifyingFollowupResolution,
  type ComoNextEmailFollowup,
  type ComoNextEmailFollowupStore,
  type FollowupEvidenceKind,
  type FollowupResolutionEvidence,
  type FollowupResolutionKind,
  type FollowupScheduleInput,
  type FollowupScheduleResult,
} from "./comoNextEmailFollowups";

/**
 * MySQL persistence for COMO Next email follow-ups.
 *
 * This module is deliberately not wired to IMAP import, inbox processing, a
 * scheduled route, or a mailbox gateway. A parent integration must provide a
 * verified Sent-to-system-Draft correlation and explicitly invoke the domain
 * service after the read-only import has committed.
 */

type SqlExecutor = { execute(query: unknown): Promise<unknown> };
type Row = Record<string, unknown>;

const ACTIVE_STATUSES = ["scheduled", "drafting"] as const;
const RESOLUTION_KINDS = new Set<FollowupEvidenceKind>([
  "reply", "analysis", "deliverable", "invoice_paid", "invoice_approved",
]);
const FOLLOWUP_STATUSES = new Set<ComoNextEmailFollowup["status"]>([
  "scheduled", "drafting", "draft_ready", "owner_review", "cancelled",
]);

function rowsOf<T extends Row>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return Array.isArray(result) ? result as T[] : [];
}

function affectedRows(result: unknown) {
  const header = Array.isArray(result) && !Array.isArray(result[0]) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  return Number((header as { affectedRows?: unknown }).affectedRows || 0);
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function nullableText(value: unknown) {
  const cleaned = text(value);
  return cleaned || null;
}

function isoUtc(value: unknown) {
  const raw = text(value);
  if (!raw) throw new Error("MySQL follow-up row is missing a timestamp");
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`MySQL follow-up row has an invalid timestamp: ${raw}`);
  return date.toISOString();
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function resolutionKinds(value: unknown): FollowupResolutionKind[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((kind): kind is FollowupResolutionKind =>
    kind === "reply" || kind === "analysis" || kind === "deliverable" || kind === "invoice_paid",
  );
}

function correlation(value: unknown, fallbackKey: unknown) {
  const parsed = parseJson(value);
  const row = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const ids = Array.isArray(row.observedThreadMessageIds)
    ? row.observedThreadMessageIds.map(item => text(item)).filter(Boolean)
    : [];
  return {
    systemDraftKey: text(row.systemDraftKey) || text(fallbackKey),
    observedSentDraftKey: nullableText(row.observedSentDraftKey),
    expectedThreadMessageId: nullableText(row.expectedThreadMessageId),
    observedThreadMessageIds: ids,
  };
}

function mapFollowup(row: Row): ComoNextEmailFollowup {
  const status = text(row.status) as ComoNextEmailFollowup["status"];
  if (!FOLLOWUP_STATUSES.has(status)) throw new Error(`MySQL follow-up row has an unsupported status: ${status}`);
  return {
    id: text(row.id),
    idempotencyKey: text(row.idempotencyKey),
    userId: Number(row.userId),
    workFileId: Number(row.workFileId),
    sentMessageId: text(row.sentMessageId),
    sentMessageRef: text(row.sentMessageRef),
    sentAt: isoUtc(row.sentAt),
    toText: text(row.toText),
    ccText: nullableText(row.ccText),
    subject: text(row.subject),
    ownerDirectiveRef: text(row.ownerDirectiveRef),
    ownerDirectiveExplicitlyApproved: Number(row.ownerDirectiveExplicitlyApproved) === 1,
    sentCorrelation: correlation(row.sentCorrelationJson, row.systemDraftKey),
    expectedResolutionKinds: resolutionKinds(row.expectedResolutionKinds),
    followUpAt: isoUtc(row.followUpAt),
    status,
    mailboxDraftRef: nullableText(row.mailboxDraftRef),
    draftClaimToken: nullableText(row.draftClaimToken),
  };
}

function selectColumns() {
  return sql`id, idempotency_key AS idempotencyKey, user_id AS userId, work_file_id AS workFileId,
    sent_message_id AS sentMessageId, sent_message_ref AS sentMessageRef, sent_at AS sentAt,
    to_text AS toText, cc_text AS ccText, subject, owner_directive_ref AS ownerDirectiveRef,
    owner_directive_explicitly_approved AS ownerDirectiveExplicitlyApproved,
    system_draft_key AS systemDraftKey, sent_correlation_json AS sentCorrelationJson,
    expected_resolution_kinds AS expectedResolutionKinds, follow_up_at AS followUpAt, status,
    mailbox_draft_ref AS mailboxDraftRef, draft_claim_token AS draftClaimToken`;
}

/** A 15-minute lease can be reclaimed; mailbox draftKey still prevents duplicates. */
const DRAFT_CLAIM_LEASE_MINUTES = 15;

export class ComoNextEmailFollowupMysqlStore implements ComoNextEmailFollowupStore {
  constructor(private readonly db: SqlExecutor) {}

  async scheduleIfAbsent(input: FollowupScheduleInput): Promise<FollowupScheduleResult> {
    const result = await this.db.execute(sql`
      INSERT IGNORE INTO como_next_email_followups (
        idempotency_key, user_id, work_file_id, sent_message_id, sent_message_ref, sent_at,
        to_text, cc_text, subject, owner_directive_ref, owner_directive_explicitly_approved,
        system_draft_key, sent_correlation_json, expected_resolution_kinds, follow_up_at, status
      ) VALUES (
        ${input.idempotencyKey}, ${input.userId}, ${input.workFileId}, ${input.sentMessageId}, ${input.sentMessageRef}, ${followupUtcSqlTimestamp(input.sentAt)},
        ${input.toText}, ${input.ccText}, ${input.subject}, ${input.ownerDirectiveRef}, ${input.ownerDirectiveExplicitlyApproved ? 1 : 0},
        ${input.sentCorrelation.systemDraftKey}, ${JSON.stringify(input.sentCorrelation)}, ${JSON.stringify(input.expectedResolutionKinds)}, ${followupUtcSqlTimestamp(input.followUpAt)}, 'scheduled'
      )
    `);
    const rows = rowsOf<Row>(await this.db.execute(sql`
      SELECT ${selectColumns()} FROM como_next_email_followups WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1
    `));
    if (!rows[0]) throw new Error("Follow-up insert succeeded but its row could not be read");
    return { followup: mapFollowup(rows[0]), replayed: affectedRows(result) === 0 };
  }

  async rescheduleDueAt(input: { followupId: string; followUpAt: string }) {
    const result = await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET follow_up_at = ${followupUtcSqlTimestamp(input.followUpAt)}, status = 'scheduled',
          draft_claim_token = NULL, draft_claimed_at = NULL, owner_review_reason = NULL, last_error = NULL
      WHERE id = ${input.followupId} AND status IN ('scheduled', 'owner_review')
    `);
    if (!affectedRows(result)) throw new Error("Follow-up is no longer reschedulable");
    return this.getRequired(input.followupId);
  }

  async listActive() {
    const rows = rowsOf<Row>(await this.db.execute(sql`
      SELECT ${selectColumns()} FROM como_next_email_followups
      WHERE status IN ('scheduled', 'drafting')
      ORDER BY follow_up_at ASC, id ASC
    `));
    return rows.map(mapFollowup);
  }

  async findResolutionEvidence(followup: ComoNextEmailFollowup) {
    const rows = rowsOf<Row>(await this.db.execute(sql`
      SELECT resolution_kind AS kind, resolution_occurred_at AS occurredAt,
        resolution_explicitly_adequate AS explicitlyAdequate,
        resolution_evidence_ref AS evidenceReference
      FROM como_next_email_followups
      WHERE id = ${followup.id} AND work_file_id = ${followup.workFileId}
        AND sent_message_ref = ${followup.sentMessageRef} AND resolution_kind IS NOT NULL
      LIMIT 1
    `));
    const row = rows[0];
    if (!row || !RESOLUTION_KINDS.has(text(row.kind) as FollowupEvidenceKind)) return [];
    return [{
      workFileId: followup.workFileId,
      sourceSentMessageRef: followup.sentMessageRef,
      kind: text(row.kind) as FollowupEvidenceKind,
      occurredAt: isoUtc(row.occurredAt),
      explicitlyAdequate: Number(row.explicitlyAdequate) === 1,
      evidenceReference: text(row.evidenceReference),
    } satisfies FollowupResolutionEvidence];
  }

  async cancelIfActive(input: { followupId: string; resolution: FollowupResolutionEvidence; reason: string }) {
    const result = await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), cancellation_reason = ${input.reason.slice(0, 4000)},
        resolution_kind = ${input.resolution.kind}, resolution_occurred_at = ${followupUtcSqlTimestamp(input.resolution.occurredAt)},
        resolution_explicitly_adequate = ${input.resolution.explicitlyAdequate ? 1 : 0},
        resolution_evidence_ref = ${input.resolution.evidenceReference.slice(0, 1000)},
        draft_claim_token = NULL, draft_claimed_at = NULL
      WHERE id = ${input.followupId} AND status IN ('scheduled', 'drafting')
    `);
    return affectedRows(result) === 1;
  }

  async claimDueForDraft(input: { followupId: string; now: string }) {
    const claimToken = randomUUID();
    const now = followupUtcSqlTimestamp(input.now);
    const result = await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET status = 'drafting', draft_claim_token = ${claimToken}, draft_claimed_at = ${now}, last_error = NULL
      WHERE id = ${input.followupId}
        AND (
          (status = 'scheduled' AND follow_up_at <= ${now})
          OR (status = 'drafting' AND draft_claimed_at < DATE_SUB(${now}, INTERVAL ${DRAFT_CLAIM_LEASE_MINUTES} MINUTE))
        )
    `);
    if (!affectedRows(result)) return null;
    const rows = rowsOf<Row>(await this.db.execute(sql`
      SELECT ${selectColumns()} FROM como_next_email_followups
      WHERE id = ${input.followupId} AND status = 'drafting' AND draft_claim_token = ${claimToken} LIMIT 1
    `));
    return rows[0] ? mapFollowup(rows[0]) : null;
  }

  async markDraftPrepared(input: { followupId: string; draftClaimToken: string; mailboxDraftRef: string }) {
    const result = await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET status = 'draft_ready', mailbox_draft_ref = ${input.mailboxDraftRef.slice(0, 500)},
        draft_claim_token = NULL, draft_claimed_at = NULL, last_error = NULL
      WHERE id = ${input.followupId} AND status = 'drafting' AND draft_claim_token = ${input.draftClaimToken}
    `);
    return affectedRows(result) === 1;
  }

  async releaseDraftClaim(input: { followupId: string; draftClaimToken: string; error: string }) {
    await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET status = 'scheduled', draft_claim_token = NULL, draft_claimed_at = NULL, last_error = ${input.error.slice(0, 4000)}
      WHERE id = ${input.followupId} AND status = 'drafting' AND draft_claim_token = ${input.draftClaimToken}
    `);
  }

  async markOwnerReview(input: { followupId: string; reason: string }) {
    const result = await this.db.execute(sql`
      UPDATE como_next_email_followups
      SET status = 'owner_review', owner_review_reason = ${input.reason.slice(0, 4000)},
        draft_claim_token = NULL, draft_claimed_at = NULL
      WHERE id = ${input.followupId} AND status = 'scheduled'
    `);
    return affectedRows(result) === 1;
  }

  /**
   * Call only after the inbound/analysis integration records a human- or
   * policy-approved evidence decision. It never classifies text itself. The
   * conditional update makes simultaneous import/reconcile paths idempotent.
   */
  async cancelAfterQualifiedResolution(resolution: FollowupResolutionEvidence) {
    const followups = rowsOf<Row>(await this.db.execute(sql`
      SELECT ${selectColumns()} FROM como_next_email_followups
      WHERE work_file_id = ${resolution.workFileId} AND sent_message_ref = ${resolution.sourceSentMessageRef}
        AND status IN ('scheduled', 'drafting')
      ORDER BY id ASC
    `));
    let cancelled = 0;
    for (const row of followups) {
      const followup = mapFollowup(row);
      if (!isQualifyingFollowupResolution(followup, resolution)) continue;
      const didCancel = await this.cancelIfActive({
        followupId: followup.id,
        resolution,
        reason: `Resolved before follow-up deadline by ${resolution.kind}: ${resolution.evidenceReference}`,
      });
      if (didCancel) cancelled += 1;
    }
    return { cancelled, examined: followups.length };
  }

  private async getRequired(id: string) {
    const rows = rowsOf<Row>(await this.db.execute(sql`
      SELECT ${selectColumns()} FROM como_next_email_followups WHERE id = ${id} LIMIT 1
    `));
    if (!rows[0]) throw new Error("Follow-up was not found after update");
    return mapFollowup(rows[0]);
  }
}

/**
 * Explicit factory for parent wiring. It is not called by this module and does
 * not open IMAP, send email, or schedule any background work.
 */
export async function createComoNextEmailFollowupMysqlStore() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for COMO Next email follow-ups");
  return new ComoNextEmailFollowupMysqlStore(db);
}
