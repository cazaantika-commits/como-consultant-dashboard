import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const PREAPPEND_LEASE_SECONDS = 5 * 60;

export type MailboxDraftLedgerState =
  | "preappend_claimed"
  | "append_started"
  | "draft_saved"
  | "sent_confirmed"
  | "human_review";

export type MailboxDraftLedgerRow = {
  id: number;
  mailboxKey: string;
  draftKey: string;
  userId: number | null;
  projectId: number | null;
  workFileId: number | null;
  communicationId: number | null;
  messageId: string;
  subjectSha256: string;
  bodySha256: string;
  toEnvelopeSha256: string;
  ccEnvelopeSha256: string;
  state: MailboxDraftLedgerState;
  claimToken: string | null;
  claimExpiresAt: string | null;
  draftFolder: string | null;
  draftUid: number | null;
  sentFolder: string | null;
  sentUid: number | null;
  createdAt: string;
};

export type MailboxDraftClaim =
  | { kind: "winner"; row: MailboxDraftLedgerRow; claimToken: string }
  | { kind: "completed"; row: MailboxDraftLedgerRow }
  | { kind: "blocked"; row: MailboxDraftLedgerRow };

export type MailboxDraftLookup =
  | { kind: "missing" }
  | { kind: "found"; folder: string; uid: number; sent: boolean }
  | { kind: "ambiguous"; folders: Array<{ folder: string; uid: number; sent: boolean }> };

export type MailboxDraftAppendPort = {
  findByStableIdentity(input: { draftKey: string; messageId: string }): Promise<MailboxDraftLookup>;
  appendDraft(): Promise<void>;
};

export interface MailboxDraftLedgerPort {
  claim(input: MailboxDraftClaimInput): Promise<MailboxDraftClaim>;
  beginAppend(input: { id: number; claimToken: string }): Promise<MailboxDraftLedgerRow | null>;
  confirmMailboxObservation(input: { id: number; folder: string; uid: number; sent: boolean }): Promise<void>;
  markHumanReview(input: { id: number; reason: string }): Promise<void>;
}

export type MailboxDraftClaimInput = {
  mailboxKey: string;
  draftKey: string;
  messageId: string;
  subject: string;
  body: string;
  to: string;
  cc?: string | null;
  /** Supplied after the established communication command authorizes the file. */
  lineage?: { userId: number; projectId: number; workFileId: number; communicationId: number } | null;
};

export type LedgerBackedMailboxDraftResult = {
  folder: string;
  uid: number;
  created: boolean;
  observedInSent: boolean;
};

export class MailboxDraftHumanReviewRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailboxDraftHumanReviewRequired";
  }
}

/** A different worker owns a still-valid pre-append lease; callers may retry. */
export class MailboxDraftBusyError extends Error {
  constructor() {
    super("Private Email Draft is being prepared by another worker; retry after its pre-append lease");
    this.name = "MailboxDraftBusyError";
  }
}

export function mailboxKeyForDraftLedger(address: string) {
  return sha256(normalizeAddress(address));
}

export function deterministicDraftMessageId(input: { mailboxKey: string; draftKey: string; domain?: string }) {
  const domain = String(input.domain || "comodevelopments.com").trim().toLowerCase().replace(/[^a-z0-9.-]/g, "") || "comodevelopments.com";
  return `<como-draft-${sha256(`${input.mailboxKey}|${input.draftKey}`).slice(0, 48)}@${domain}>`;
}

/**
 * The append boundary.  A durable claim is acquired before any IMAP append and
 * append_started is intentionally terminal until the mailbox is inspected: a
 * timeout must never cause another worker to append the same draft.
 */
export async function saveMailboxDraftExactlyOnce(input: {
  ledger: MailboxDraftLedgerPort;
  claim: MailboxDraftClaimInput;
  mailbox: MailboxDraftAppendPort;
}): Promise<LedgerBackedMailboxDraftResult> {
  const claim = await input.ledger.claim(input.claim);
  if (claim.kind === "completed") {
    return resolveExistingOrRequireReview(input.ledger, claim.row, input.mailbox);
  }
  if (claim.kind === "blocked") {
    if (claim.row.state === "preappend_claimed") throw new MailboxDraftBusyError();
    return resolveExistingOrRequireReview(input.ledger, claim.row, input.mailbox);
  }

  // A previous application may have created the message before this ledger was
  // introduced, or an owner may have moved/sent it. Search before append.
  const beforeAppend = await input.mailbox.findByStableIdentity({
    draftKey: input.claim.draftKey,
    messageId: input.claim.messageId,
  });
  if (beforeAppend.kind !== "missing") {
    return recordLookupOrRequireReview(input.ledger, claim.row, beforeAppend, false);
  }

  const appendRow = await input.ledger.beginAppend({ id: claim.row.id, claimToken: claim.claimToken });
  if (!appendRow) {
    // A lease holder may have reached append_started immediately before us.
    // Inspect, but never append as a fallback.
    return resolveExistingOrRequireReview(input.ledger, claim.row, input.mailbox);
  }

  try {
    await input.mailbox.appendDraft();
  } catch (error) {
    const afterFailure = await safeLookup(input.mailbox, input.claim);
    if (afterFailure && afterFailure.kind !== "missing") {
      return recordLookupOrRequireReview(input.ledger, appendRow, afterFailure, true);
    }
    await input.ledger.markHumanReview({ id: appendRow.id, reason: "imap_append_outcome_ambiguous" });
    throw new MailboxDraftHumanReviewRequired("Private Email append outcome is ambiguous; review Drafts and Sent before retrying");
  }

  const afterAppend = await safeLookup(input.mailbox, input.claim);
  if (afterAppend && afterAppend.kind !== "missing") {
    return recordLookupOrRequireReview(input.ledger, appendRow, afterAppend, true);
  }
  await input.ledger.markHumanReview({ id: appendRow.id, reason: "imap_append_not_observable" });
  throw new MailboxDraftHumanReviewRequired("Private Email append was not observable; review Drafts and Sent before retrying");
}

async function resolveExistingOrRequireReview(ledger: MailboxDraftLedgerPort, row: MailboxDraftLedgerRow, mailbox: MailboxDraftAppendPort) {
  const observed = await safeLookup(mailbox, { draftKey: row.draftKey, messageId: row.messageId });
  if (observed && observed.kind !== "missing") return recordLookupOrRequireReview(ledger, row, observed, false);
  await ledger.markHumanReview({ id: row.id, reason: row.state === "append_started" ? "append_started_unresolved" : "completed_delivery_not_found" });
  throw new MailboxDraftHumanReviewRequired("A prior draft delivery exists in the ledger but was not found in Drafts or Sent; review before retrying");
}

async function safeLookup(mailbox: MailboxDraftAppendPort, identity: { draftKey: string; messageId: string }) {
  try {
    return await mailbox.findByStableIdentity(identity);
  } catch {
    return null;
  }
}

async function recordLookupOrRequireReview(
  ledger: MailboxDraftLedgerPort,
  row: MailboxDraftLedgerRow,
  lookup: Exclude<MailboxDraftLookup, { kind: "missing" }>,
  created: boolean,
): Promise<LedgerBackedMailboxDraftResult> {
  if (lookup.kind === "ambiguous") {
    await ledger.markHumanReview({ id: row.id, reason: "multiple_stable_mailbox_matches" });
    throw new MailboxDraftHumanReviewRequired("Multiple Drafts/Sent messages match this draft identity; review before retrying");
  }
  if (row.state === "sent_confirmed" && !lookup.sent) {
    // Never let an old Draft match demote an observed Sent delivery. The caller
    // must not recreate/archive it merely because Sent is currently unavailable.
    await ledger.markHumanReview({ id: row.id, reason: "sent_confirmed_not_found_in_sent" });
    throw new MailboxDraftHumanReviewRequired("A prior Sent delivery is not currently observable in Sent; review before retrying");
  }
  await ledger.confirmMailboxObservation({ id: row.id, folder: lookup.folder, uid: lookup.uid, sent: lookup.sent });
  // A Sent match is a completed delivery, not a signal to recreate a Draft.
  return { folder: lookup.folder, uid: lookup.uid, created, observedInSent: lookup.sent };
}

/** A small deterministic fake used by focused tests; production uses the DB port below. */
export class InMemoryMailboxDraftLedger implements MailboxDraftLedgerPort {
  private rows = new Map<string, MailboxDraftLedgerRow>();

  async claim(input: MailboxDraftClaimInput): Promise<MailboxDraftClaim> {
    const key = `${input.mailboxKey}:${input.draftKey}`;
    const current = this.rows.get(key);
    if (!current) {
      const claimToken = randomUUID();
      const row = memoryRow(input, claimToken);
      this.rows.set(key, row);
      return { kind: "winner", row: clone(row), claimToken };
    }
    if (["draft_saved", "sent_confirmed"].includes(current.state)) return { kind: "completed", row: clone(current) };
    if (current.state === "preappend_claimed" && isExpired(current.claimExpiresAt)) {
      const claimToken = randomUUID();
      current.claimToken = claimToken;
      current.claimExpiresAt = plusSeconds(PREAPPEND_LEASE_SECONDS);
      return { kind: "winner", row: clone(current), claimToken };
    }
    return { kind: "blocked", row: clone(current) };
  }

  async beginAppend(input: { id: number; claimToken: string }) {
    const row = Array.from(this.rows.values()).find(item => item.id === input.id);
    if (!row || row.state !== "preappend_claimed" || row.claimToken !== input.claimToken || isExpired(row.claimExpiresAt)) return null;
    row.state = "append_started";
    row.claimExpiresAt = null;
    return clone(row);
  }

  async confirmMailboxObservation(input: { id: number; folder: string; uid: number; sent: boolean }) {
    const row = Array.from(this.rows.values()).find(item => item.id === input.id);
    if (!row) throw new Error("ledger_row_not_found");
    if (!input.sent && row.state === "sent_confirmed") return;
    row.state = input.sent ? "sent_confirmed" : "draft_saved";
    row.claimToken = null;
    row.claimExpiresAt = null;
    if (input.sent) { row.sentFolder = input.folder; row.sentUid = input.uid; }
    else { row.draftFolder = input.folder; row.draftUid = input.uid; }
  }

  async markHumanReview(input: { id: number; reason: string }) {
    const row = Array.from(this.rows.values()).find(item => item.id === input.id);
    if (row && !["draft_saved", "sent_confirmed"].includes(row.state)) {
      row.state = "human_review";
      row.claimExpiresAt = null;
    }
  }
}

/**
 * DB-backed claim/transition port.  All mutation paths lock one unique
 * (mailbox_key, draft_key) row.  If the migration is absent or DB unavailable,
 * callers fail before touching IMAP rather than losing exactly-once protection.
 */
export class DatabaseMailboxDraftLedger implements MailboxDraftLedgerPort {
  async claim(input: MailboxDraftClaimInput): Promise<MailboxDraftClaim> {
    const db = await getDb();
    if (!db) throw new Error("mailbox_draft_ledger_database_unavailable");
    const association = input.lineage || await resolveCommunicationAssociation(db, input.draftKey);
    return db.transaction(async tx => {
      // The unique mailbox/key index elects the only candidate permitted to
      // reach IMAP. INSERT IGNORE makes that election atomic across retries.
      const claimToken = randomUUID();
      const inserted = await tx.execute(sql`
        INSERT IGNORE INTO como_mailbox_draft_ledger (
          mailbox_key, draft_key, user_id, project_id, work_file_id, communication_id,
          message_id, subject_sha256, body_sha256, to_envelope_sha256, cc_envelope_sha256,
          state, claim_token, claim_expires_at
        ) VALUES (
          ${input.mailboxKey}, ${input.draftKey}, ${association?.userId ?? null}, ${association?.projectId ?? null},
          ${association?.workFileId ?? null}, ${association?.communicationId ?? null}, ${input.messageId},
          ${sha256(normalizeText(input.subject))}, ${sha256(normalizeText(input.body))},
          ${sha256(normalizeEnvelope(input.to))}, ${sha256(normalizeEnvelope(input.cc || ""))},
          ${"preappend_claimed"}, ${claimToken}, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${PREAPPEND_LEASE_SECONDS} SECOND)
        )
      `);
      const existing = await selectLedgerByKey(tx, input.mailboxKey, input.draftKey, true);
      if (!existing) throw new Error("mailbox_draft_ledger_insert_missing");
      if (Number((inserted as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows || 0) === 1) {
        return { kind: "winner", row: existing, claimToken };
      }
      if (["draft_saved", "sent_confirmed"].includes(existing.state)) return { kind: "completed", row: existing };
      if (existing.state === "preappend_claimed" && isExpired(existing.claimExpiresAt)) {
        const claimToken = randomUUID();
        await tx.execute(sql`
          UPDATE como_mailbox_draft_ledger
          SET claim_token = ${claimToken}, claim_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${PREAPPEND_LEASE_SECONDS} SECOND),
              updated_at = UTC_TIMESTAMP()
          WHERE id = ${existing.id} AND state = ${"preappend_claimed"} AND claim_expires_at < UTC_TIMESTAMP()
        `);
        const reclaimed = await selectLedgerByKey(tx, input.mailboxKey, input.draftKey, true);
        if (reclaimed?.state === "preappend_claimed" && reclaimed.claimToken === claimToken) {
          return { kind: "winner", row: reclaimed, claimToken };
        }
        return { kind: "blocked", row: reclaimed || existing };
      }
      return { kind: "blocked", row: existing };
    });
  }

  async beginAppend(input: { id: number; claimToken: string }) {
    const db = await getDb();
    if (!db) throw new Error("mailbox_draft_ledger_database_unavailable");
    return db.transaction(async tx => {
      const changed = await tx.execute(sql`
        UPDATE como_mailbox_draft_ledger
        SET state = ${"append_started"}, append_started_at = UTC_TIMESTAMP(), claim_expires_at = NULL, updated_at = UTC_TIMESTAMP()
        WHERE id = ${input.id} AND state = ${"preappend_claimed"} AND claim_token = ${input.claimToken}
          AND claim_expires_at >= UTC_TIMESTAMP()
      `);
      if (Number((changed as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows || 0) !== 1) return null;
      const row = await selectLedgerById(tx, input.id, true);
      return row?.state === "append_started" && row.claimToken === input.claimToken ? row : null;
    });
  }

  async confirmMailboxObservation(input: { id: number; folder: string; uid: number; sent: boolean }) {
    const db = await getDb();
    if (!db) throw new Error("mailbox_draft_ledger_database_unavailable");
    await db.execute(input.sent ? sql`
      UPDATE como_mailbox_draft_ledger
      SET state = ${"sent_confirmed"}, sent_folder = ${input.folder}, sent_uid = ${input.uid},
        confirmed_at = UTC_TIMESTAMP(), claim_token = NULL, claim_expires_at = NULL, updated_at = UTC_TIMESTAMP()
      WHERE id = ${input.id}
    ` : sql`
      UPDATE como_mailbox_draft_ledger
      SET state = ${"draft_saved"}, draft_folder = ${input.folder}, draft_uid = ${input.uid},
        confirmed_at = UTC_TIMESTAMP(), claim_token = NULL, claim_expires_at = NULL, updated_at = UTC_TIMESTAMP()
      WHERE id = ${input.id} AND state <> ${"sent_confirmed"}
    `);
  }

  async markHumanReview(input: { id: number; reason: string }) {
    const db = await getDb();
    if (!db) throw new Error("mailbox_draft_ledger_database_unavailable");
    await db.execute(sql`
      UPDATE como_mailbox_draft_ledger
      SET state = ${"human_review"}, review_reason = ${input.reason.slice(0, 255)}, claim_expires_at = NULL, updated_at = UTC_TIMESTAMP()
      WHERE id = ${input.id} AND state NOT IN (${"draft_saved"}, ${"sent_confirmed"})
    `);
  }
}

export type SentLineageMessage = {
  uid: number;
  messageId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  textBody: string;
  date: Date;
  headers?: Readonly<Record<string, readonly string[] | string | undefined>>;
};

export type ValidatedSentLineage =
  | { kind: "none" }
  | { kind: "review"; reason: string }
  | { kind: "validated"; ledgerId: number; projectId: number; workFileId: number; communicationId: number | null };

/**
 * Finds a work-file target only when the stored draft and the read-only Sent
 * message prove the same owner, exact envelope and authorized lineage.  The
 * stripped-header fallback is intentionally finance-only and exact/unique.
 */
export async function findValidatedSentLineage(input: {
  userId: number;
  mailboxKey: string;
  ownerMailbox: string;
  message: SentLineageMessage;
}): Promise<ValidatedSentLineage> {
  if (normalizeAddress(input.message.from) !== normalizeAddress(input.ownerMailbox)) return { kind: "none" };
  const db = await getDb();
  if (!db) throw new Error("mailbox_draft_ledger_database_unavailable");
  const draftKeyHeader = draftKeyHeaderStatus(input.message.headers, "x-como-draft-key");
  if (draftKeyHeader.kind === "malformed") return { kind: "review", reason: "malformed_draft_key_in_sent_message" };
  if (draftKeyHeader.kind === "multiple") return { kind: "review", reason: "multiple_draft_keys_in_sent_message" };
  const messageId = input.message.messageId.trim();
  let candidates: MailboxDraftLedgerRow[] = [];
  let bindingKind: "header" | "message_id" | "fallback" | null = null;
  if (draftKeyHeader.kind === "single") {
    candidates = await findLedgerRows(db, sql`l.mailbox_key = ${input.mailboxKey} AND l.draft_key = ${draftKeyHeader.value}`);
    bindingKind = "header";
  } else if (messageId) {
    candidates = await findLedgerRows(db, sql`l.mailbox_key = ${input.mailboxKey} AND l.message_id = ${messageId}`);
    bindingKind = "message_id";
  }

  if (!candidates.length && draftKeyHeader.kind === "absent") {
    candidates = await findLedgerRows(db, sql`
      l.mailbox_key = ${input.mailboxKey}
      AND l.subject_sha256 = ${sha256(normalizeText(input.message.subject))}
      AND l.body_sha256 = ${sha256(normalizeText(input.message.textBody))}
      AND l.to_envelope_sha256 = ${sha256(normalizeEnvelope(input.message.to))}
      AND l.cc_envelope_sha256 = ${sha256(normalizeEnvelope(input.message.cc))}
      AND l.created_at <= ${toSqlTimestamp(input.message.date)}
      AND EXISTS (
        SELECT 1
        FROM como_next_communications finance_communication
        WHERE finance_communication.id = l.communication_id
          AND finance_communication.user_id = l.user_id
          AND finance_communication.project_id = l.project_id
          AND finance_communication.work_file_id = l.work_file_id
          AND finance_communication.channel = ${"email"}
          AND finance_communication.direction = ${"outbound"}
          AND finance_communication.source_system = ${"como_next"}
          AND finance_communication.source_record_id LIKE ${"finance_invoice_draft:attachment:%"}
      )
    `);
    bindingKind = "fallback";
  }
  if (!candidates.length) return { kind: "none" };
  if (candidates.length !== 1) return { kind: "review", reason: bindingKind === "fallback" ? "finance_sent_fallback_ambiguous" : "sent_binding_ambiguous" };

  const candidate = candidates[0]!;
  if (!candidate.userId || !candidate.projectId || !candidate.workFileId
    || candidate.userId !== input.userId
    || candidate.toEnvelopeSha256 !== sha256(normalizeEnvelope(input.message.to))
    || candidate.ccEnvelopeSha256 !== sha256(normalizeEnvelope(input.message.cc))
    || new Date(toSqlTimestamp(input.message.date).replace(" ", "T") + "Z").getTime() < new Date(candidate.createdAt.replace(" ", "T") + "Z").getTime()) {
    return { kind: "review", reason: "sent_binding_validation_failed" };
  }
  return { kind: "validated", ledgerId: candidate.id, projectId: candidate.projectId, workFileId: candidate.workFileId, communicationId: candidate.communicationId };
}

export async function confirmSentLineageObservation(input: { ledgerId: number; folder: string; uid: number }) {
  return new DatabaseMailboxDraftLedger().confirmMailboxObservation({ id: input.ledgerId, folder: input.folder, uid: input.uid, sent: true });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function normalizeAddress(value: string | null | undefined) {
  const addresses = String(value || "").toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi);
  return addresses?.[0]?.trim() || String(value || "").trim().toLowerCase();
}

function normalizeEnvelope(value: string | null | undefined) {
  const addresses = String(value || "").toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [];
  return Array.from(new Set(addresses.map(item => item.trim()).filter(Boolean))).sort().join(",");
}

function draftKeyHeaderStatus(headers: SentLineageMessage["headers"], name: string):
  | { kind: "absent" }
  | { kind: "single"; value: string }
  | { kind: "multiple" }
  | { kind: "malformed" } {
  const rawValues = Object.entries(headers || {})
    .filter(([headerName]) => headerName.toLowerCase() === name.toLowerCase())
    .flatMap(([, value]) => Array.isArray(value) ? value : [value]);
  if (!rawValues.length) return { kind: "absent" };
  if (rawValues.some(value => typeof value !== "string" || !value.trim())) return { kind: "malformed" };
  if (rawValues.length !== 1) return { kind: "multiple" };
  return { kind: "single", value: rawValues[0]!.trim() };
}

function toSqlTimestamp(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function plusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isExpired(value: string | null) {
  return !value || new Date(value.replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? "" : "Z")).getTime() < Date.now();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let memoryId = 1;
function memoryRow(input: MailboxDraftClaimInput, claimToken: string): MailboxDraftLedgerRow {
  return {
    id: memoryId++, mailboxKey: input.mailboxKey, draftKey: input.draftKey, userId: null, projectId: null, workFileId: null,
    communicationId: null, messageId: input.messageId, subjectSha256: sha256(normalizeText(input.subject)), bodySha256: sha256(normalizeText(input.body)),
    toEnvelopeSha256: sha256(normalizeEnvelope(input.to)), ccEnvelopeSha256: sha256(normalizeEnvelope(input.cc || "")), state: "preappend_claimed",
    claimToken, claimExpiresAt: plusSeconds(PREAPPEND_LEASE_SECONDS), draftFolder: null, draftUid: null, sentFolder: null, sentUid: null,
    createdAt: new Date().toISOString(),
  };
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return Array.isArray(result) ? result as T[] : [];
}

function numberOrNull(value: unknown) {
  const number = value == null ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapLedger(row: Record<string, unknown>): MailboxDraftLedgerRow {
  return {
    id: Number(row.id), mailboxKey: String(row.mailboxKey ?? row.mailbox_key ?? ""), draftKey: String(row.draftKey ?? row.draft_key ?? ""),
    userId: numberOrNull(row.userId ?? row.user_id), projectId: numberOrNull(row.projectId ?? row.project_id),
    workFileId: numberOrNull(row.workFileId ?? row.work_file_id), communicationId: numberOrNull(row.communicationId ?? row.communication_id),
    messageId: String(row.messageId ?? row.message_id ?? ""), subjectSha256: String(row.subjectSha256 ?? row.subject_sha256 ?? ""),
    bodySha256: String(row.bodySha256 ?? row.body_sha256 ?? ""), toEnvelopeSha256: String(row.toEnvelopeSha256 ?? row.to_envelope_sha256 ?? ""),
    ccEnvelopeSha256: String(row.ccEnvelopeSha256 ?? row.cc_envelope_sha256 ?? ""), state: String(row.state) as MailboxDraftLedgerState,
    claimToken: row.claimToken == null && row.claim_token == null ? null : String(row.claimToken ?? row.claim_token),
    claimExpiresAt: row.claimExpiresAt == null && row.claim_expires_at == null ? null : String(row.claimExpiresAt ?? row.claim_expires_at),
    draftFolder: row.draftFolder == null && row.draft_folder == null ? null : String(row.draftFolder ?? row.draft_folder),
    draftUid: numberOrNull(row.draftUid ?? row.draft_uid), sentFolder: row.sentFolder == null && row.sent_folder == null ? null : String(row.sentFolder ?? row.sent_folder),
    sentUid: numberOrNull(row.sentUid ?? row.sent_uid), createdAt: String(row.createdAt ?? row.created_at ?? ""),
  };
}

async function selectLedgerByKey(db: { execute(query: unknown): Promise<unknown> }, mailboxKey: string, draftKey: string, forUpdate: boolean) {
  const result = await db.execute(forUpdate ? sql`
    SELECT * FROM como_mailbox_draft_ledger WHERE mailbox_key = ${mailboxKey} AND draft_key = ${draftKey} LIMIT 1 FOR UPDATE
  ` : sql`SELECT * FROM como_mailbox_draft_ledger WHERE mailbox_key = ${mailboxKey} AND draft_key = ${draftKey} LIMIT 1`);
  const row = rowsOf<Record<string, unknown>>(result)[0];
  return row ? mapLedger(row) : null;
}

async function selectLedgerById(db: { execute(query: unknown): Promise<unknown> }, id: number, forUpdate: boolean) {
  const result = await db.execute(forUpdate ? sql`
    SELECT * FROM como_mailbox_draft_ledger WHERE id = ${id} LIMIT 1 FOR UPDATE
  ` : sql`SELECT * FROM como_mailbox_draft_ledger WHERE id = ${id} LIMIT 1`);
  const row = rowsOf<Record<string, unknown>>(result)[0];
  return row ? mapLedger(row) : null;
}

async function resolveCommunicationAssociation(db: { execute(query: unknown): Promise<unknown> }, draftKey: string) {
  const privateEmailId = /^private-email:(\d+)$/.exec(draftKey)?.[1] || null;
  const rows = rowsOf<Record<string, unknown>>(await db.execute(sql`
    SELECT c.id AS communicationId, c.user_id AS userId, c.project_id AS projectId, c.work_file_id AS workFileId
    FROM como_next_communications c
    WHERE c.channel = ${"email"} AND c.direction = ${"outbound"}
      AND (c.source_record_id = ${draftKey} OR (${privateEmailId} IS NOT NULL AND c.id = ${privateEmailId}))
    ORDER BY c.id DESC
    LIMIT 2
  `));
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  return { communicationId: Number(row.communicationId), userId: Number(row.userId), projectId: Number(row.projectId), workFileId: Number(row.workFileId) };
}

async function findLedgerRows(db: { execute(query: unknown): Promise<unknown> }, where: ReturnType<typeof sql>) {
  const rows = rowsOf<Record<string, unknown>>(await db.execute(sql`
    SELECT l.*
    FROM como_mailbox_draft_ledger l
    JOIN projects p ON p.id = l.project_id
    JOIN como_next_work_files wf ON wf.id = l.work_file_id AND wf.project_id = p.id
    LEFT JOIN como_next_project_access access_row ON access_row.project_id = p.id AND access_row.user_id = l.user_id
    WHERE ${where}
      AND l.state IN (${"append_started"}, ${"draft_saved"}, ${"sent_confirmed"})
      AND p.userId = l.user_id AND wf.user_id = l.user_id
      AND (p.userId = l.user_id OR access_row.user_id = l.user_id)
    ORDER BY l.id DESC
    LIMIT 3
  `));
  return rows.map(mapLedger);
}
