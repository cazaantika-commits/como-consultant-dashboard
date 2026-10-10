import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  fetchEmailByUID,
  fetchReadonlyFolderSince,
  getConfiguredMailboxAddress,
  type EmailAttachment,
  type EmailMessage,
  type ReadonlyMailboxBatch,
} from "../emailMonitor";
import { createCommunicationDraftCommand } from "./comoNextCommands";

/**
 * Narrow, draft-only handling for a verified incoming consultant invoice.
 *
 * This service deliberately does not import messages, change IMAP flags, upload
 * files, create payment records, or send mail. The heartbeat owner must call it
 * after the existing read-only mailbox import/linking flow has completed.
 */
export const FINANCE_INVOICE_DELEGATION_STARTED_AT = "2026-10-10T05:23:28Z";
export const FINANCE_INVOICE_POLICY_KEY = "finance_disbursement_policy";
export const FINANCE_INVOICE_POLICY_SOURCE_RECORD_ID =
  "owner-finance-policy-20261010";
export const FINANCE_INVOICE_DRAFT_SOURCE_PREFIX = "finance_invoice_draft";
export const FINANCE_INVOICE_TO = "wael@zooma.ae";
export const FINANCE_INVOICE_CC = "shahid@zooma.ae, account.mrt@zooma.ae";
export const FULL_OWNER_SIGNATURE =
  "Abdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com";

const REFRESH_HOURS = 2;
const REFRESH_MAX_MESSAGES = 12;
/** A page, not a newest-first ceiling: durable dispositions let later pages advance. */
const INVOICE_SOURCE_PAGE_SIZE = 20;
/** Heartbeat has a two-minute deadline; keep potentially slow MIME fetches bounded. */
const MAX_MIME_FETCHES_PER_RUN = 3;
const MAX_INVOICE_DOCUMENTS = 5;
const MAX_INVOICE_DOCUMENT_BYTES = 15 * 1024 * 1024;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const FINANCE_INVOICE_DISPOSITION_EVENT_TYPE =
  "finance_invoice_draft_disposition";
const FINANCE_INVOICE_RETRY_EVENT_TYPE = "finance_invoice_draft_retry";
const delegationStartedAtMs = Date.parse(FINANCE_INVOICE_DELEGATION_STARTED_AT);

export type FinanceInvoicePolicyRecord = {
  memberId: string;
  preferenceKey: string;
  sourceRecordId: string;
  isCurrent: number | boolean;
};

export type FinanceInvoiceSourceRecord = {
  emailId: number;
  userId: number;
  mailboxKey: string;
  folderName: string;
  uidValidity: string;
  imapUid: number;
  messageId: string | null;
  messageIdSha256: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  linkedPartyContactMatch: number | boolean;
  knownArtecSender: number | boolean;
  inboxStatus: string;
  receivedAt: string;
  linkedProjectId: number | null;
  linkedWorkFileId: number | null;
  projectId: number | null;
  projectName: string | null;
  projectUserId: number | null;
  projectIsTest: number | boolean | null;
  workFileId: number | null;
  workFileUserId: number | null;
  workFileStatus: string | null;
};

export type FinanceContractFinanceEvidence = {
  userId: number;
  projectId: number;
  direction: string;
  communicationStatus: string;
  sentAt: string | null;
  sourceSystem: string;
  subject: string;
  body: string;
  toText: string | null;
  ccText: string | null;
};

export type FinanceInvoiceDraftAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type FinanceInvoiceDraftRequest = {
  userId: number;
  workFileId: number;
  toText: string;
  ccText: string;
  subject: string;
  body: string;
  attachments: FinanceInvoiceDraftAttachment[];
  /** The create-draft command persists this as its private-mail Draft key. */
  createDraftKey: string;
};

export type FinanceInvoiceDraftCreated = {
  communicationId: number;
  mailboxDraftFolder: string;
  mailboxDraftUid: number;
};

/**
 * These final dispositions are written once to como_next_work_file_events for
 * the linked source email. They are intentionally terminal: the source query
 * removes them from subsequent heartbeat pages.
 */
export type FinanceInvoiceFinalDisposition =
  | "draft_saved"
  | "duplicate"
  | "review_required"
  | "not_eligible";

export type FinanceInvoiceFinalReason =
  | "before_delegation_cutoff"
  | "invoice_sender_not_verified"
  | "missing_explicit_invoice_cue"
  | "ambiguous_invoice_or_proforma_quote"
  | "invoice_pdf_not_identified"
  | "ambiguous_invoice_document"
  | "attachment_limit_exceeded"
  | "duplicate_invoice_attachment"
  | "draft_saved";

/**
 * The pure service depends on this narrow port. Tests use an in-memory fake;
 * only the adapter below reads the live database or calls the draft command.
 */
export interface FinanceInvoiceDraftStore {
  loadCurrentPolicy(): Promise<FinanceInvoicePolicyRecord | null>;
  listPendingIncomingSources(input: {
    userId: number;
    mailboxKey: string;
    uidValidity: string;
    after: string;
    limit: number;
  }): Promise<FinanceInvoiceSourceRecord[]>;
  hasArchivedDraft(input: {
    userId: number;
    createDraftKey: string;
  }): Promise<boolean>;
  listActualSentContractFinanceEvidence(input: {
    userId: number;
    projectId: number;
  }): Promise<FinanceContractFinanceEvidence[]>;
  createDraft(
    input: FinanceInvoiceDraftRequest
  ): Promise<FinanceInvoiceDraftCreated>;
  recordFinalDisposition(input: {
    source: FinanceInvoiceSourceRecord;
    idempotencyKey: string;
    disposition: FinanceInvoiceFinalDisposition;
    reason: FinanceInvoiceFinalReason;
    summary: string;
  }): Promise<void>;
  recordRetry(input: {
    source: FinanceInvoiceSourceRecord;
    retryAfterUnixMs: number;
    reason:
      | Extract<
          FinanceInvoiceDraftSkipReason,
          | "source_record_mismatch"
          | "source_message_changed"
          | "invoice_attachment_unavailable"
        >
      | "finance_invoice_draft_failed";
  }): Promise<void>;
}

export interface FinanceInvoiceMailbox {
  getConfiguredMailboxAddress(): string;
  refreshInbox(): Promise<ReadonlyMailboxBatch>;
  fetchEmailByUID(
    uid: number,
    expectedUidValidity: string,
    folderName: "INBOX"
  ): Promise<EmailMessage | null>;
}

export type FinanceInvoiceDraftSkipReason =
  | "finance_disbursement_policy_not_current"
  | "mailbox_not_configured"
  | "source_record_mismatch"
  | "before_delegation_cutoff"
  | "source_message_changed"
  | "invoice_sender_not_verified"
  | "missing_explicit_invoice_cue"
  | "ambiguous_invoice_or_proforma_quote"
  | "invoice_pdf_not_identified"
  | "ambiguous_invoice_document"
  | "invoice_attachment_unavailable"
  | "attachment_limit_exceeded";

export type FinanceInvoiceDraftRunResult =
  | { status: "no_candidate"; externalSideEffect: false }
  | {
      status: "skipped";
      reason: FinanceInvoiceDraftSkipReason;
      externalSideEffect: false;
    }
  | {
      status: "duplicate";
      reason: "duplicate_message" | "duplicate_invoice_attachment";
      createDraftKey: string;
      externalSideEffect: false;
    }
  | {
      status: "draft_created";
      communicationId: number;
      mailboxDraft: { folder: string; uid: number };
      sourceEmailId: number;
      createDraftKey: string;
      externalSideEffect: false;
    }
  | {
      status: "error";
      reason: "finance_invoice_draft_failed";
      externalSideEffect: false;
    };

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeMailbox(value: string) {
  return value.trim().toLowerCase();
}

/** The same SHA-256 mailbox binding used by the read-only email projection. */
export function financeInvoiceMailboxKey(address: string) {
  return sha256(normalizeMailbox(address));
}

function normalizedText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\r/g, "")
    .trim();
}

/** Only the top-level sender text is eligible; quoted / forwarded history is not. */
export function ownTopInvoiceText(body: string) {
  const lines: string[] = [];
  for (const line of normalizedText(body).split("\n")) {
    if (/^\s*>/.test(line)) continue;
    if (
      /^\s*-{2,}\s*(?:forwarded message|original message)\s*-{2,}/i.test(line)
    )
      break;
    if (/^\s*on\s+.+\s+wrote:\s*$/i.test(line)) break;
    if (/^\s*(?:from|sent|to|subject)\s*:/i.test(line) && lines.length > 0)
      break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

export function classifyIncomingInvoice(
  subject: string,
  body: string
): "invoice" | "missing" | "ambiguous" {
  const ownText =
    `${normalizedText(subject)}\n${ownTopInvoiceText(body)}`.toLowerCase();
  const hasInvoiceCue =
    /\b(?:tax\s+invoice|invoice)(?:\s*(?:no\.?|number|#|:|-))?\b|فاتورة/u.test(
      ownText
    );
  const hasAmbiguousCommercialDocument =
    /\b(?:pro\s*-?\s*forma|proforma|quotation|quote|estimate|proposal)\b|عرض\s*سعر|عرض\s*تجاري/u.test(
      ownText
    );
  if (hasAmbiguousCommercialDocument) return "ambiguous";
  return hasInvoiceCue ? "invoice" : "missing";
}

function attachmentName(attachment: Pick<EmailAttachment, "filename">) {
  return String(attachment.filename || "").trim();
}

function attachmentBytes(
  attachment: Pick<EmailAttachment, "size" | "content">
) {
  return (
    attachment.content?.byteLength ?? Math.max(0, Number(attachment.size || 0))
  );
}

function isInlineOrLogo(attachment: EmailAttachment) {
  const name = attachmentName(attachment).toLowerCase();
  const contentType = String(attachment.contentType || "").toLowerCase();
  return (
    attachment.disposition === "inline" ||
    Boolean(attachment.contentId) ||
    /^image\//.test(contentType) ||
    /(?:^|[_ .-])(?:logo|signature|sig|image\d*|icon)(?:[_ .-]|$)/i.test(name)
  );
}

function isContractDocument(attachment: EmailAttachment) {
  return /\b(?:signed\s+)?(?:contract|agreement|appointment)\b|عقد|اتفاقية/iu.test(
    attachmentName(attachment)
  );
}

function isPdf(attachment: EmailAttachment) {
  return (
    /\.pdf$/i.test(attachmentName(attachment)) ||
    /application\/pdf/i.test(String(attachment.contentType || ""))
  );
}

function bufferContainsInvoiceText(content: Buffer | undefined) {
  if (!content?.length) return false;
  // This is intentionally conservative: it recognizes uncompressed PDF text
  // only; a non-recognized PDF never becomes an automatic draft candidate.
  return /\b(?:tax\s+invoice|invoice)\b|فاتورة/iu.test(
    content.subarray(0, 1_000_000).toString("latin1")
  );
}

function hasInvoiceFilename(attachment: EmailAttachment) {
  return /(?:^|[_ .-])invoice(?:[_ .-]|$)|فاتورة/iu.test(
    attachmentName(attachment)
  );
}

function isInvoicePdf(attachment: EmailAttachment) {
  return (
    !isInlineOrLogo(attachment) &&
    !isContractDocument(attachment) &&
    isPdf(attachment) &&
    (hasInvoiceFilename(attachment) ||
      bufferContainsInvoiceText(attachment.content))
  );
}

function isRelevantInvoiceDocument(attachment: EmailAttachment) {
  if (isInlineOrLogo(attachment) || isContractDocument(attachment))
    return false;
  if (isInvoicePdf(attachment)) return true;
  const name = attachmentName(attachment);
  return (
    /\b(?:invoice|billing|payment|milestone|tax)\b|فاتورة|دفعة/iu.test(name) &&
    /\.(?:pdf|xlsx?|csv|docx?)$/i.test(name)
  );
}

export function selectInvoiceDocuments(attachments: EmailAttachment[]):
  | {
      kind: "ok";
      invoice: EmailAttachment;
      documents: FinanceInvoiceDraftAttachment[];
      invoiceSha256: string;
    }
  | {
      kind: "skip";
      reason: Extract<
        FinanceInvoiceDraftSkipReason,
        | "invoice_pdf_not_identified"
        | "ambiguous_invoice_document"
        | "invoice_attachment_unavailable"
        | "attachment_limit_exceeded"
      >;
    } {
  const invoicePdfs = attachments.filter(isInvoicePdf);
  if (!invoicePdfs.length) {
    const missingInvoiceContent = attachments.some(
      attachment =>
        !isInlineOrLogo(attachment) &&
        isPdf(attachment) &&
        hasInvoiceFilename(attachment) &&
        !attachment.content
    );
    return {
      kind: "skip",
      reason: missingInvoiceContent
        ? "invoice_attachment_unavailable"
        : "invoice_pdf_not_identified",
    };
  }
  if (invoicePdfs.length !== 1)
    return { kind: "skip", reason: "ambiguous_invoice_document" };

  const relevant = attachments.filter(isRelevantInvoiceDocument);
  if (relevant.some(attachment => !attachment.content))
    return { kind: "skip", reason: "invoice_attachment_unavailable" };
  const totalBytes = relevant.reduce(
    (total, attachment) => total + attachmentBytes(attachment),
    0
  );
  if (
    relevant.length > MAX_INVOICE_DOCUMENTS ||
    totalBytes > MAX_INVOICE_DOCUMENT_BYTES
  ) {
    return { kind: "skip", reason: "attachment_limit_exceeded" };
  }

  const invoice = invoicePdfs[0]!;
  if (!invoice.content)
    return { kind: "skip", reason: "invoice_attachment_unavailable" };
  return {
    kind: "ok",
    invoice,
    documents: relevant.map(attachment => ({
      filename: attachmentName(attachment),
      content: attachment.content!,
      contentType: String(attachment.contentType || "application/octet-stream"),
    })),
    invoiceSha256: sha256(invoice.content),
  };
}

function isRequiredCurrentPolicy(policy: FinanceInvoicePolicyRecord | null) {
  return Boolean(
    policy &&
      policy.memberId === "abdulrahman" &&
      policy.preferenceKey === FINANCE_INVOICE_POLICY_KEY &&
      policy.sourceRecordId === FINANCE_INVOICE_POLICY_SOURCE_RECORD_ID &&
      Number(policy.isCurrent) === 1
  );
}

function afterDelegationCutoff(value: string | Date) {
  const at =
    value instanceof Date
      ? value.getTime()
      : Date.parse(
          value.replace(" ", "T") +
            (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? "" : "Z")
        );
  return Number.isFinite(at) && at > delegationStartedAtMs;
}

function sourceRecordMatches(input: {
  source: FinanceInvoiceSourceRecord | null;
  userId: number;
  mailboxKey: string;
  uidValidity: string;
  message: EmailMessage;
}) {
  const { source, userId, mailboxKey, uidValidity, message } = input;
  if (!source || !message.messageId.trim()) return false;
  return (
    source.userId === userId &&
    source.mailboxKey === mailboxKey &&
    source.folderName === "INBOX" &&
    source.uidValidity === uidValidity &&
    source.imapUid === message.uid &&
    source.messageId === message.messageId.trim() &&
    source.messageIdSha256 === sha256(message.messageId.trim()) &&
    source.inboxStatus === "linked" &&
    source.linkedProjectId != null &&
    source.linkedWorkFileId != null &&
    source.projectId === source.linkedProjectId &&
    source.workFileId === source.linkedWorkFileId &&
    source.projectUserId === userId &&
    source.workFileUserId === userId &&
    Number(source.projectIsTest) === 0 &&
    !["closed", "cancelled"].includes(
      String(source.workFileStatus || "").toLowerCase()
    )
  );
}

function verifiedInvoiceSender(
  source: FinanceInvoiceSourceRecord,
  message: EmailMessage
) {
  return (
    normalizeMailbox(source.fromEmail) === normalizeMailbox(message.from) &&
    (Number(source.linkedPartyContactMatch) === 1 ||
      Number(source.knownArtecSender) === 1)
  );
}

function extractedEmails(value: string | null | undefined) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []
  );
}

function hasActualSentContractFinanceEvidence(
  rows: FinanceContractFinanceEvidence[],
  userId: number,
  projectId: number
) {
  return rows.some(row => {
    const details = `${row.subject}\n${row.body}`;
    const to = extractedEmails(row.toText);
    const cc = extractedEmails(row.ccText);
    return (
      row.userId === userId &&
      row.projectId === projectId &&
      row.direction === "outbound" &&
      row.communicationStatus === "sent" &&
      Boolean(row.sentAt) &&
      // An IMAP-promoted Sent record is the actual-mail proof; a draft/manual
      // communications record alone must not trigger the stronger assertion.
      row.sourceSystem === "imap" &&
      /\b(?:contract|agreement|appointment)\b|عقد|اتفاقية/iu.test(details) &&
      to.has("shahid@zooma.ae") &&
      cc.has("wael@zooma.ae") &&
      cc.has("account.mrt@zooma.ae")
    );
  });
}

function displayProjectName(value: string | null) {
  const compact = String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return compact || "project";
}

export function forwardedInvoiceSubject(sourceSubject: string) {
  const clean = String(sourceSubject || "Invoice")
    .replace(/[\r\n]+/g, " ")
    .trim();
  return /^\s*(?:fw|fwd)\s*:/i.test(clean)
    ? clean
    : `Fw: ${clean || "Invoice"}`;
}

export function financeInvoiceDraftBody(
  projectName: string,
  contractReferenceActuallySent: boolean
) {
  const invoiceDescription = `${displayProjectName(projectName)} consultant invoice`;
  const instruction = contractReferenceActuallySent
    ? `Please review the attached ${invoiceDescription} against the agreed contract payment terms and arrange payment if due.\nThe contract reference was shared with Finance separately.`
    : `Please review the attached ${invoiceDescription} against the agreed contract payment terms and arrange payment if due.`;
  return `Hi Wael,\n\n${instruction}\n\nKind regards,\n${FULL_OWNER_SIGNATURE}`;
}

function messageDraftKey(messageId: string) {
  return `${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:message:${sha256(messageId.trim())}`;
}

function attachmentDraftKey(invoiceSha256: string) {
  return `${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:attachment:${invoiceSha256}`;
}

/** One durable terminal ledger entry per source email, independent of MIME retries. */
export function financeInvoiceDispositionKey(sourceEmailId: number) {
  return `${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:source:${sourceEmailId}`;
}

function financeInvoiceRetryKey(
  sourceEmailId: number,
  retryAfterUnixMs: number
) {
  return `${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:retry:${sourceEmailId}:${Math.floor(retryAfterUnixMs / RETRY_DELAY_MS)}`;
}

function retryAfterUnixMs(now = Date.now()) {
  // The bucket makes two overlapping heartbeats idempotently share one retry
  // marker while allowing an expired source to receive a later retry window.
  return (Math.floor(now / RETRY_DELAY_MS) + 1) * RETRY_DELAY_MS;
}

function finalDispositionSummary(
  disposition: FinanceInvoiceFinalDisposition,
  reason: FinanceInvoiceFinalReason
) {
  if (disposition === "draft_saved")
    return "تم حفظ مسودة طلب صرف للفاتورة الواردة بعد التحقق.";
  if (disposition === "duplicate")
    return "لم تُنشأ مسودة جديدة: الفاتورة مكررة بالنسبة إلى مسودة طلب الصرف المحفوظة.";
  if (disposition === "review_required") {
    return `مراجعة داخلية مطلوبة قبل أي طلب صرف: ${reason === "ambiguous_invoice_or_proforma_quote" ? "الرسالة تبدو عرض سعر/فاتورة أولية أو غير حاسمة." : "وثيقة الفاتورة غير حاسمة."}`;
  }
  return `لن تُنشأ مسودة طلب صرف تلقائيًا: ${reason}.`;
}

/** Error responses are intentionally stable and contain no IMAP/DB/provider data. */
export function sanitizeFinanceInvoiceDraftError(_error: unknown) {
  return "finance_invoice_draft_failed" as const;
}

export class ComoFinanceInvoiceDraftService {
  constructor(
    private readonly store: FinanceInvoiceDraftStore,
    private readonly mailbox: FinanceInvoiceMailbox
  ) {}

  private async recordFinal(
    source: FinanceInvoiceSourceRecord,
    disposition: FinanceInvoiceFinalDisposition,
    reason: FinanceInvoiceFinalReason
  ) {
    await this.store.recordFinalDisposition({
      source,
      idempotencyKey: financeInvoiceDispositionKey(source.emailId),
      disposition,
      reason,
      summary: finalDispositionSummary(disposition, reason),
    });
  }

  private async recordRetry(
    source: FinanceInvoiceSourceRecord,
    reason:
      | Extract<
          FinanceInvoiceDraftSkipReason,
          | "source_record_mismatch"
          | "source_message_changed"
          | "invoice_attachment_unavailable"
        >
      | "finance_invoice_draft_failed"
  ) {
    try {
      await this.store.recordRetry({
        source,
        reason,
        retryAfterUnixMs: retryAfterUnixMs(),
      });
    } catch {
      // A retry marker is an optimization. A later heartbeat can safely retry
      // the source if the durable ledger itself is temporarily unavailable.
    }
  }

  /**
   * Creates at most one Draft. Terminal outcomes are durably dispositioned so
   * subsequent calls page past them; temporary source/MIME failures are delayed
   * rather than allowed to pin the oldest page.
   */
  async run(input: { userId: number }): Promise<FinanceInvoiceDraftRunResult> {
    try {
      const policy = await this.store.loadCurrentPolicy();
      if (!isRequiredCurrentPolicy(policy)) {
        return {
          status: "skipped",
          reason: "finance_disbursement_policy_not_current",
          externalSideEffect: false,
        };
      }

      const configuredMailboxKey = financeInvoiceMailboxKey(
        this.mailbox.getConfiguredMailboxAddress()
      );
      const refreshed = await this.mailbox.refreshInbox();
      if (
        refreshed.folderName !== "INBOX" ||
        financeInvoiceMailboxKey(refreshed.mailbox) !== configuredMailboxKey
      ) {
        return {
          status: "skipped",
          reason: "mailbox_not_configured",
          externalSideEffect: false,
        };
      }

      // The actual UIDVALIDITY comes from the short read-only refresh, while
      // candidate identity comes from the durable inbox projection. This lets a
      // bounded queue recover a verified invoice imported before a short outage.
      const sources = await this.store.listPendingIncomingSources({
        userId: input.userId,
        mailboxKey: configuredMailboxKey,
        uidValidity: refreshed.uidValidity,
        after: FINANCE_INVOICE_DELEGATION_STARTED_AT,
        limit: INVOICE_SOURCE_PAGE_SIZE,
      });
      if (!sources.length)
        return { status: "no_candidate", externalSideEffect: false };

      let lastSkipped: FinanceInvoiceDraftSkipReason | null = null;
      let lastDuplicate: Extract<
        FinanceInvoiceDraftRunResult,
        { status: "duplicate" }
      > | null = null;
      let hadTemporaryError = false;
      let mimeFetches = 0;
      for (const source of sources) {
        try {
          if (!afterDelegationCutoff(source.receivedAt)) {
            await this.recordFinal(
              source,
              "not_eligible",
              "before_delegation_cutoff"
            );
            lastSkipped = "before_delegation_cutoff";
            continue;
          }

          // Ordinary non-financial mail and quotation/proforma cues are already
          // represented in the durable, linked source projection. Resolve them
          // without opening MIME so they cannot consume the heartbeat budget.
          const storedClassification = classifyIncomingInvoice(
            source.subject,
            source.bodyText
          );
          if (storedClassification === "missing") {
            await this.recordFinal(
              source,
              "not_eligible",
              "missing_explicit_invoice_cue"
            );
            lastSkipped = "missing_explicit_invoice_cue";
            continue;
          }
          if (storedClassification === "ambiguous") {
            await this.recordFinal(
              source,
              "review_required",
              "ambiguous_invoice_or_proforma_quote"
            );
            lastSkipped = "ambiguous_invoice_or_proforma_quote";
            continue;
          }
          if (!source.messageId?.trim()) {
            await this.recordRetry(source, "source_record_mismatch");
            hadTemporaryError = true;
            lastSkipped = "source_record_mismatch";
            continue;
          }
          if (mimeFetches >= MAX_MIME_FETCHES_PER_RUN) break;
          mimeFetches += 1;

          // The expected UIDVALIDITY is from the just-refreshed INBOX snapshot;
          // fetchEmailByUID verifies it before returning MIME bodies/attachments.
          const full = await this.mailbox.fetchEmailByUID(
            source.imapUid,
            refreshed.uidValidity,
            "INBOX"
          );
          if (
            !full ||
            full.uid !== source.imapUid ||
            source.messageId !== full.messageId.trim() ||
            source.messageIdSha256 !== sha256(full.messageId.trim())
          ) {
            await this.recordRetry(source, "source_message_changed");
            hadTemporaryError = true;
            lastSkipped = "source_message_changed";
            continue;
          }
          if (
            !sourceRecordMatches({
              source,
              userId: input.userId,
              mailboxKey: configuredMailboxKey,
              uidValidity: refreshed.uidValidity,
              message: full,
            })
          ) {
            await this.recordRetry(source, "source_record_mismatch");
            hadTemporaryError = true;
            lastSkipped = "source_record_mismatch";
            continue;
          }
          if (!afterDelegationCutoff(full.date)) {
            await this.recordFinal(
              source,
              "not_eligible",
              "before_delegation_cutoff"
            );
            lastSkipped = "before_delegation_cutoff";
            continue;
          }
          if (!verifiedInvoiceSender(source, full)) {
            await this.recordFinal(
              source,
              "not_eligible",
              "invoice_sender_not_verified"
            );
            lastSkipped = "invoice_sender_not_verified";
            continue;
          }

          const invoiceClassification = classifyIncomingInvoice(
            full.subject,
            full.textBody
          );
          if (invoiceClassification === "missing") {
            await this.recordFinal(
              source,
              "not_eligible",
              "missing_explicit_invoice_cue"
            );
            lastSkipped = "missing_explicit_invoice_cue";
            continue;
          }
          if (invoiceClassification === "ambiguous") {
            await this.recordFinal(
              source,
              "review_required",
              "ambiguous_invoice_or_proforma_quote"
            );
            lastSkipped = "ambiguous_invoice_or_proforma_quote";
            continue;
          }

          const documents = selectInvoiceDocuments(full.attachments);
          if (documents.kind === "skip") {
            if (documents.reason === "invoice_attachment_unavailable") {
              await this.recordRetry(source, documents.reason);
              hadTemporaryError = true;
            } else if (documents.reason === "ambiguous_invoice_document") {
              await this.recordFinal(
                source,
                "review_required",
                documents.reason
              );
            } else {
              await this.recordFinal(source, "not_eligible", documents.reason);
            }
            lastSkipped = documents.reason;
            continue;
          }
          const createDraftKey = attachmentDraftKey(documents.invoiceSha256);
          // Attachment SHA-256 is the durable cross-forward/re-import boundary.
          // On a duplicate, disposition it and continue to another source.
          if (
            await this.store.hasArchivedDraft({
              userId: input.userId,
              createDraftKey,
            })
          ) {
            await this.recordFinal(
              source,
              "duplicate",
              "duplicate_invoice_attachment"
            );
            lastDuplicate = {
              status: "duplicate",
              reason: "duplicate_invoice_attachment",
              createDraftKey,
              externalSideEffect: false,
            };
            continue;
          }

          const sentEvidence =
            await this.store.listActualSentContractFinanceEvidence({
              userId: input.userId,
              projectId: source.projectId!,
            });
          const contractReferenceActuallySent =
            hasActualSentContractFinanceEvidence(
              sentEvidence,
              input.userId,
              source.projectId!
            );
          const created = await this.store.createDraft({
            userId: input.userId,
            workFileId: source.workFileId!,
            toText: FINANCE_INVOICE_TO,
            ccText: FINANCE_INVOICE_CC,
            subject: forwardedInvoiceSubject(full.subject),
            body: financeInvoiceDraftBody(
              source.projectName || "project",
              contractReferenceActuallySent
            ),
            attachments: documents.documents,
            createDraftKey,
          });
          // The central Draft command is the authoritative create lock. If its
          // follow-up audit event is temporarily unavailable, return now (never
          // create another Draft this invocation); the next invocation sees the
          // archived Draft, writes a duplicate disposition, and advances.
          try {
            await this.recordFinal(source, "draft_saved", "draft_saved");
          } catch {
            // Intentionally retained by the central Draft idempotency boundary.
          }
          return {
            status: "draft_created",
            communicationId: created.communicationId,
            mailboxDraft: {
              folder: created.mailboxDraftFolder,
              uid: created.mailboxDraftUid,
            },
            sourceEmailId: source.emailId,
            createDraftKey,
            externalSideEffect: false,
          };
        } catch {
          hadTemporaryError = true;
          await this.recordRetry(source, "finance_invoice_draft_failed");
          // One provider/database error must not pin later ready invoices.
          continue;
        }
      }
      if (hadTemporaryError)
        return {
          status: "error",
          reason: "finance_invoice_draft_failed",
          externalSideEffect: false,
        };
      if (lastSkipped)
        return {
          status: "skipped",
          reason: lastSkipped,
          externalSideEffect: false,
        };
      if (lastDuplicate) return lastDuplicate;
      return { status: "no_candidate", externalSideEffect: false };
    } catch (error) {
      return {
        status: "error",
        reason: sanitizeFinanceInvoiceDraftError(error),
        externalSideEffect: false,
      };
    }
  }
}

type SqlExecutor = { execute(query: unknown): Promise<unknown> };
type TransactionalSqlExecutor = SqlExecutor & {
  transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T>;
};
type DbProvider = () => Promise<SqlExecutor | null>;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0]))
    return result[0] as T[];
  return Array.isArray(result) ? (result as T[]) : [];
}

function numberOrNull(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown) {
  return value == null ? null : String(value);
}

function mapPolicy(row: Record<string, unknown>): FinanceInvoicePolicyRecord {
  return {
    memberId: String(row.memberId ?? row.member_id ?? ""),
    preferenceKey: String(row.preferenceKey ?? row.preference_key ?? ""),
    sourceRecordId: String(row.sourceRecordId ?? row.source_record_id ?? ""),
    isCurrent: Number(row.isCurrent ?? row.is_current ?? 0),
  };
}

function mapSource(row: Record<string, unknown>): FinanceInvoiceSourceRecord {
  return {
    emailId: Number(row.emailId ?? row.email_id),
    userId: Number(row.userId ?? row.user_id),
    mailboxKey: String(row.mailboxKey ?? row.mailbox_key ?? ""),
    folderName: String(row.folderName ?? row.folder_name ?? ""),
    uidValidity: String(row.uidValidity ?? row.uid_validity ?? ""),
    imapUid: Number(row.imapUid ?? row.imap_uid),
    messageId: stringOrNull(row.messageId ?? row.message_id),
    messageIdSha256: String(row.messageIdSha256 ?? row.message_id_sha256 ?? ""),
    fromEmail: String(row.fromEmail ?? row.from_email ?? ""),
    subject: String(row.subject ?? ""),
    bodyText: String(row.bodyText ?? row.body_text ?? ""),
    linkedPartyContactMatch: Number(
      row.linkedPartyContactMatch ?? row.linked_party_contact_match ?? 0
    ),
    knownArtecSender: Number(
      row.knownArtecSender ?? row.known_artec_sender ?? 0
    ),
    inboxStatus: String(row.inboxStatus ?? row.inbox_status ?? ""),
    receivedAt: String(row.receivedAt ?? row.received_at ?? ""),
    linkedProjectId: numberOrNull(row.linkedProjectId ?? row.linked_project_id),
    linkedWorkFileId: numberOrNull(
      row.linkedWorkFileId ?? row.linked_work_file_id
    ),
    projectId: numberOrNull(row.projectId ?? row.project_id),
    projectName: stringOrNull(row.projectName ?? row.project_name),
    projectUserId: numberOrNull(row.projectUserId ?? row.project_user_id),
    projectIsTest: numberOrNull(row.projectIsTest ?? row.project_is_test),
    workFileId: numberOrNull(row.workFileId ?? row.work_file_id),
    workFileUserId: numberOrNull(row.workFileUserId ?? row.work_file_user_id),
    workFileStatus: stringOrNull(row.workFileStatus ?? row.work_file_status),
  };
}

function mapContractEvidence(
  row: Record<string, unknown>
): FinanceContractFinanceEvidence {
  return {
    userId: Number(row.userId ?? row.user_id),
    projectId: Number(row.projectId ?? row.project_id),
    direction: String(row.direction ?? ""),
    communicationStatus: String(
      row.communicationStatus ?? row.communication_status ?? ""
    ),
    sentAt: stringOrNull(row.sentAt ?? row.sent_at),
    sourceSystem: String(row.sourceSystem ?? row.source_system ?? ""),
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    toText: stringOrNull(row.toText ?? row.to_text),
    ccText: stringOrNull(row.ccText ?? row.cc_text),
  };
}

/**
 * Production adapter. Its SQL is read-only except for createDraft(), which is
 * intentionally delegated to createCommunicationDraftCommand so the only
 * mailbox write remains the existing private-mail Draft implementation.
 */
export class DrizzleFinanceInvoiceDraftStore
  implements FinanceInvoiceDraftStore
{
  constructor(private readonly db: SqlExecutor) {}

  async loadCurrentPolicy() {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
      SELECT member_id AS memberId, preference_key AS preferenceKey,
        source_record_id AS sourceRecordId, is_current AS isCurrent
      FROM como_next_owner_preferences
      WHERE member_id = ${"abdulrahman"}
        AND preference_key = ${FINANCE_INVOICE_POLICY_KEY}
        AND source_record_id = ${FINANCE_INVOICE_POLICY_SOURCE_RECORD_ID}
        AND is_current = 1
      LIMIT 2
    `)
    );
    // More than one result would be an unexpected policy ambiguity, not an
    // invitation to choose one. The pure gate treats null as disabled.
    return rows.length === 1 ? mapPolicy(rows[0]!) : null;
  }

  async listPendingIncomingSources(input: {
    userId: number;
    mailboxKey: string;
    uidValidity: string;
    after: string;
    limit: number;
  }) {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
      SELECT e.id AS emailId, e.user_id AS userId, e.mailbox_key AS mailboxKey,
        e.folder_name AS folderName, e.uid_validity AS uidValidity, e.imap_uid AS imapUid,
        e.message_id AS messageId, e.message_id_sha256 AS messageIdSha256, e.from_email AS fromEmail,
        e.subject AS subject, e.body_text AS bodyText,
        e.inbox_status AS inboxStatus, e.received_at AS receivedAt,
        e.linked_project_id AS linkedProjectId, e.linked_work_file_id AS linkedWorkFileId,
        p.id AS projectId, p.name AS projectName, p.userId AS projectUserId,
        p.is_test_project AS projectIsTest,
        wf.id AS workFileId, wf.user_id AS workFileUserId, wf.work_file_status AS workFileStatus,
        EXISTS(
          SELECT 1
          FROM como_next_work_file_parties wfp
          JOIN como_next_project_parties linked_pp
            ON linked_pp.id = wfp.project_party_id
            AND linked_pp.project_id = e.linked_project_id
            AND linked_pp.relationship_status = 'active'
          JOIN como_next_parties linked_party ON linked_party.id = linked_pp.party_id
          JOIN como_next_party_contacts linked_contact ON linked_contact.party_id = linked_party.id
          WHERE wfp.work_file_id = e.linked_work_file_id
            AND LOWER(linked_contact.email) = LOWER(e.from_email)
        ) AS linkedPartyContactMatch,
        EXISTS(
          SELECT 1
          FROM como_next_work_file_parties artec_wfp
          JOIN como_next_project_parties artec_pp
            ON artec_pp.id = artec_wfp.project_party_id
            AND artec_pp.project_id = e.linked_project_id
            AND artec_pp.relationship_status = 'active'
          JOIN como_next_parties artec_party ON artec_party.id = artec_pp.party_id
          JOIN como_next_party_contacts artec_contact ON artec_contact.party_id = artec_party.id
          WHERE artec_wfp.work_file_id = e.linked_work_file_id
            AND LOWER(artec_party.display_name) LIKE '%artec%'
            AND LOWER(artec_contact.email) = LOWER(e.from_email)
        ) AS knownArtecSender
      FROM como_next_email_messages e
      JOIN projects p ON p.id = e.linked_project_id
      JOIN como_next_work_files wf ON wf.id = e.linked_work_file_id AND wf.project_id = p.id
      WHERE e.user_id = ${input.userId}
        AND e.mailbox_key = ${input.mailboxKey}
        AND e.folder_name = ${"INBOX"}
        AND e.uid_validity = ${input.uidValidity}
        AND e.inbox_status = ${"linked"}
        AND e.received_at > ${input.after.slice(0, 19).replace("T", " ")}
        AND p.is_test_project = 0
        AND p.userId = ${input.userId}
        AND wf.user_id = ${input.userId}
        AND wf.work_file_status NOT IN ('closed', 'cancelled')
        AND e.message_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM como_next_work_file_events disposition
          WHERE disposition.work_file_id = e.linked_work_file_id
            AND disposition.event_type = ${FINANCE_INVOICE_DISPOSITION_EVENT_TYPE}
            AND disposition.idempotency_key = CONCAT(${`${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:source:`}, e.id)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM como_next_work_file_events retry
          WHERE retry.work_file_id = e.linked_work_file_id
            AND retry.event_type = ${FINANCE_INVOICE_RETRY_EVENT_TYPE}
            AND retry.idempotency_key LIKE CONCAT(${`${FINANCE_INVOICE_DRAFT_SOURCE_PREFIX}:retry:`}, e.id, ':%')
            AND CAST(JSON_UNQUOTE(JSON_EXTRACT(retry.payload_json, '$.retryAfterUnixMs')) AS UNSIGNED) > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        )
      ORDER BY e.received_at ASC, e.id ASC
      LIMIT ${Math.max(1, Math.min(input.limit, INVOICE_SOURCE_PAGE_SIZE))}
    `)
    );
    return rows.map(mapSource);
  }

  async hasArchivedDraft(input: { userId: number; createDraftKey: string }) {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
      SELECT id
      FROM como_next_communications
      WHERE user_id = ${input.userId}
        AND source_system = ${"como_next"}
        AND source_record_id = ${input.createDraftKey}
        AND communication_status = ${"archived"}
        AND external_message_ref IS NOT NULL
      LIMIT 1
    `)
    );
    return rows.length > 0;
  }

  async listActualSentContractFinanceEvidence(input: {
    userId: number;
    projectId: number;
  }) {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
      SELECT user_id AS userId, project_id AS projectId, direction,
        communication_status AS communicationStatus, sent_at AS sentAt,
        source_system AS sourceSystem, subject, body, to_text AS toText, cc_text AS ccText
      FROM como_next_communications
      WHERE user_id = ${input.userId}
        AND project_id = ${input.projectId}
        AND direction = ${"outbound"}
        AND communication_status = ${"sent"}
        AND sent_at IS NOT NULL
      ORDER BY sent_at DESC, id DESC
      LIMIT 30
    `)
    );
    return rows.map(mapContractEvidence);
  }

  async createDraft(
    input: FinanceInvoiceDraftRequest
  ): Promise<FinanceInvoiceDraftCreated> {
    // Do NOT supply sourceEmailId: this must be a new forward to Wael, never a
    // reply thread to the consultant/supplier invoice.
    const created = await createCommunicationDraftCommand({
      userId: input.userId,
      workFileId: input.workFileId,
      channel: "email",
      toText: input.toText,
      ccText: input.ccText,
      subject: input.subject,
      body: input.body,
      idempotencyKey: input.createDraftKey,
      attachments: input.attachments,
    });
    const mailbox = "mailboxDraft" in created ? created.mailboxDraft : null;
    if (!mailbox?.uid)
      throw new Error(
        "finance invoice draft was not archived in Private Email Drafts"
      );
    // Keep createCommunicationDraftCommand's source_system untouched. It owns
    // the unique source lookup on a retry; finance_invoice_draft is the stable
    // sourceRecordId prefix and attachment SHA-256 idempotency namespace.
    return {
      communicationId: Number(created.id),
      mailboxDraftFolder: mailbox.folder,
      mailboxDraftUid: Number(mailbox.uid),
    };
  }

  private async appendLedgerEvent(input: {
    source: FinanceInvoiceSourceRecord;
    eventType:
      | typeof FINANCE_INVOICE_DISPOSITION_EVENT_TYPE
      | typeof FINANCE_INVOICE_RETRY_EVENT_TYPE;
    idempotencyKey: string;
    summary: string;
    payload: Record<string, string | number>;
  }) {
    const transactional = this.db as TransactionalSqlExecutor;
    if (typeof transactional.transaction !== "function") {
      throw new Error(
        "finance invoice disposition ledger requires a database transaction"
      );
    }
    await transactional.transaction(async tx => {
      // Match appendEvent's work-file serialization so the unique per-file
      // sequence stays correct even when heartbeats overlap.
      const locked = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
        SELECT id
        FROM como_next_work_files
        WHERE id = ${input.source.workFileId}
          AND project_id = ${input.source.projectId}
        FOR UPDATE
      `)
      );
      if (!locked.length)
        throw new Error("invoice source is no longer linked to its work file");

      const existing = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
        SELECT id
        FROM como_next_work_file_events
        WHERE idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `)
      );
      if (existing.length) return;

      // A required review must be actionable in the kitchen, not only a
      // timeline event. Persist it atomically with the disposition so retries
      // cannot suppress or duplicate the unresolved finance work.
      if (input.payload.disposition === "review_required") {
        await tx.execute(sql`
          INSERT INTO como_next_actions (
            user_id, project_id, work_file_id, title, description,
            acceptance_criteria, owner_type, action_status, priority,
            source_system, source_record_id
          ) VALUES (
            ${input.source.userId}, ${input.source.projectId}, ${input.source.workFileId},
            ${`مراجعة وثيقة مالية واردة: ${input.source.subject}`.slice(0, 300)},
            ${`${input.summary} المرجع: INBOX #${input.source.emailId}. لا طلب صرف أو إرسال تلقائي.`},
            ${"راجع المصدر والعقد وحدد هل هي فاتورة مستحقة أو عرض سعر؛ لا تعتبرها مدفوعة ولا تحوّلها إلى طلب صرف دون تحقق."},
            ${"manus"}, ${"open"}, ${"important"},
            ${"finance_invoice_review"}, ${`source-email-${input.source.emailId}`}
          ) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        `);
      }

      const sequenceRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
        SELECT COALESCE(MAX(sequence_no), 0) AS sequenceNo
        FROM como_next_work_file_events
        WHERE work_file_id = ${input.source.workFileId}
      `)
      );
      const sequenceNo = Number(sequenceRows[0]?.sequenceNo ?? 0) + 1;
      await tx.execute(sql`
        INSERT INTO como_next_work_file_events (
          user_id, project_id, work_file_id, action_id, sequence_no,
          actor_type, actor_user_id, event_type, summary, payload_json,
          idempotency_key
        ) VALUES (
          ${input.source.userId}, ${input.source.projectId}, ${input.source.workFileId}, NULL, ${sequenceNo},
          ${"system"}, NULL, ${input.eventType}, ${input.summary.slice(0, 1000)}, ${JSON.stringify(input.payload)},
          ${input.idempotencyKey}
        )
      `);
    });
  }

  async recordFinalDisposition(input: {
    source: FinanceInvoiceSourceRecord;
    idempotencyKey: string;
    disposition: FinanceInvoiceFinalDisposition;
    reason: FinanceInvoiceFinalReason;
    summary: string;
  }) {
    await this.appendLedgerEvent({
      source: input.source,
      eventType: FINANCE_INVOICE_DISPOSITION_EVENT_TYPE,
      idempotencyKey: input.idempotencyKey,
      summary: input.summary,
      payload: {
        sourceEmailId: input.source.emailId,
        disposition: input.disposition,
        reason: input.reason,
      },
    });
  }

  async recordRetry(input: {
    source: FinanceInvoiceSourceRecord;
    retryAfterUnixMs: number;
    reason:
      | Extract<
          FinanceInvoiceDraftSkipReason,
          | "source_record_mismatch"
          | "source_message_changed"
          | "invoice_attachment_unavailable"
        >
      | "finance_invoice_draft_failed";
  }) {
    await this.appendLedgerEvent({
      source: input.source,
      eventType: FINANCE_INVOICE_RETRY_EVENT_TYPE,
      idempotencyKey: financeInvoiceRetryKey(
        input.source.emailId,
        input.retryAfterUnixMs
      ),
      summary: `تعذرت إعادة تقييم فاتورة واردة مؤقتًا؛ ستعاد المحاولة بعد وقت الاستحقاق. (${input.reason})`,
      payload: {
        sourceEmailId: input.source.emailId,
        reason: input.reason,
        retryAfterUnixMs: input.retryAfterUnixMs,
      },
    });
  }
}

export function productionFinanceInvoiceMailbox(): FinanceInvoiceMailbox {
  return {
    getConfiguredMailboxAddress,
    // Short, read-only INBOX refresher. The mail monitor opens the folder
    // read-only and uses markSeen:false; this service never changes flags.
    refreshInbox: () =>
      fetchReadonlyFolderSince("INBOX", REFRESH_HOURS, REFRESH_MAX_MESSAGES),
    fetchEmailByUID: (uid, expectedUidValidity, folderName) =>
      fetchEmailByUID(uid, expectedUidValidity, folderName),
  };
}

/** Parent heartbeat integration point: one candidate / one potential Draft per call. */
export async function runComoFinanceInvoiceDraftsCommand(input: {
  userId: number;
}): Promise<FinanceInvoiceDraftRunResult> {
  const database = await (getDb as unknown as DbProvider)();
  if (!database)
    return {
      status: "error",
      reason: "finance_invoice_draft_failed",
      externalSideEffect: false,
    };
  return new ComoFinanceInvoiceDraftService(
    new DrizzleFinanceInvoiceDraftStore(database),
    productionFinanceInvoiceMailbox()
  ).run(input);
}
