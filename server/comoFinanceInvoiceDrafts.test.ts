import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ComoFinanceInvoiceDraftService,
  FINANCE_INVOICE_CC,
  FINANCE_INVOICE_POLICY_KEY,
  FINANCE_INVOICE_POLICY_SOURCE_RECORD_ID,
  FINANCE_INVOICE_TO,
  FULL_OWNER_SIGNATURE,
  financeInvoiceDispositionKey,
  financeInvoiceDraftBody,
  financeInvoiceMailboxKey,
  selectInvoiceDocuments,
  type FinanceContractFinanceEvidence,
  type FinanceInvoiceDraftCreated,
  type FinanceInvoiceDraftRequest,
  type FinanceInvoiceDraftStore,
  type FinanceInvoicePolicyRecord,
  type FinanceInvoiceSourceRecord,
  type FinanceInvoiceMailbox,
} from "./services/comoFinanceInvoiceDrafts";
import type { EmailMessage, ReadonlyMailboxBatch } from "./emailMonitor";

const USER_ID = 44;
const MAILBOX = "owner@example.test";
const UID_VALIDITY = "77";
const DELEGATION_DATE = new Date("2026-10-10T06:00:00Z");

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function invoicePdf(filename = "Consultant Invoice INV-77.pdf") {
  return {
    filename,
    contentType: "application/pdf",
    size: 56,
    content: Buffer.from("%PDF-1.7\nTax Invoice INV-77\n", "utf8"),
    contentId: null,
    disposition: "attachment",
  };
}

function email(overrides: Partial<EmailMessage> = {}): EmailMessage {
  const messageId = overrides.messageId ?? "<invoice-77@example.test>";
  return {
    uid: 123,
    messageId,
    from: "consultant@example.test",
    fromName: "Consultant",
    to: MAILBOX,
    cc: "",
    subject: "Tax Invoice INV-77",
    date: DELEGATION_DATE,
    textBody:
      "Hello,\nPlease find attached our tax invoice INV-77 for Project Villa 390001.",
    htmlBody: "",
    attachments: [invoicePdf()],
    isRead: false,
    ...overrides,
  };
}

function batch(message: EmailMessage): ReadonlyMailboxBatch {
  return {
    mailbox: MAILBOX,
    folderName: "INBOX",
    uidValidity: UID_VALIDITY,
    messages: [message],
  };
}

function sourceFor(
  message: EmailMessage,
  overrides: Partial<FinanceInvoiceSourceRecord> = {}
): FinanceInvoiceSourceRecord {
  return {
    emailId: 91,
    userId: USER_ID,
    mailboxKey: financeInvoiceMailboxKey(MAILBOX),
    folderName: "INBOX",
    uidValidity: UID_VALIDITY,
    imapUid: message.uid,
    messageId: message.messageId,
    messageIdSha256: sha256(message.messageId),
    fromEmail: message.from,
    subject: message.subject,
    bodyText: message.textBody,
    linkedPartyContactMatch: 1,
    knownArtecSender: 0,
    inboxStatus: "linked",
    receivedAt: "2026-10-10 06:00:00",
    linkedProjectId: 6,
    linkedWorkFileId: 19,
    projectId: 6,
    projectName: "Villa 390001",
    projectUserId: USER_ID,
    projectIsTest: 0,
    workFileId: 19,
    workFileUserId: USER_ID,
    workFileStatus: "open",
    ...overrides,
  };
}

const currentPolicy: FinanceInvoicePolicyRecord = {
  memberId: "abdulrahman",
  preferenceKey: FINANCE_INVOICE_POLICY_KEY,
  sourceRecordId: FINANCE_INVOICE_POLICY_SOURCE_RECORD_ID,
  isCurrent: 1,
};

class FakeInvoiceStore implements FinanceInvoiceDraftStore {
  policy: FinanceInvoicePolicyRecord | null = currentPolicy;
  source: FinanceInvoiceSourceRecord | null;
  sources: FinanceInvoiceSourceRecord[];
  evidence: FinanceContractFinanceEvidence[] = [];
  draftKeys = new Set<string>();
  drafts: FinanceInvoiceDraftRequest[] = [];
  finalDispositions = new Map<
    number,
    {
      disposition: string;
      reason: string;
      idempotencyKey: string;
      summary: string;
    }
  >();
  retries = new Map<number, { retryAfterUnixMs: number; reason: string }>();

  constructor(
    message: EmailMessage,
    sourceOverrides: Partial<FinanceInvoiceSourceRecord> = {}
  ) {
    this.source = sourceFor(message, sourceOverrides);
    this.sources = this.source ? [this.source] : [];
  }

  async loadCurrentPolicy() {
    return this.policy;
  }
  async listPendingIncomingSources(input: { limit: number }) {
    const now = Date.now();
    return this.sources
      .filter(source => !this.finalDispositions.has(source.emailId))
      .filter(
        source =>
          (this.retries.get(source.emailId)?.retryAfterUnixMs ?? 0) <= now
      )
      .sort(
        (left, right) =>
          left.receivedAt.localeCompare(right.receivedAt) ||
          left.emailId - right.emailId
      )
      .slice(0, input.limit);
  }
  async hasArchivedDraft(input: { userId: number; createDraftKey: string }) {
    expect(input.userId).toBe(USER_ID);
    return this.draftKeys.has(input.createDraftKey);
  }
  async listActualSentContractFinanceEvidence() {
    return this.evidence;
  }
  async createDraft(
    input: FinanceInvoiceDraftRequest
  ): Promise<FinanceInvoiceDraftCreated> {
    this.drafts.push(input);
    this.draftKeys.add(input.createDraftKey);
    return {
      communicationId: 801,
      mailboxDraftFolder: "Drafts",
      mailboxDraftUid: 991,
    };
  }
  async recordFinalDisposition(input: {
    source: FinanceInvoiceSourceRecord;
    idempotencyKey: string;
    disposition:
      | "draft_saved"
      | "duplicate"
      | "review_required"
      | "not_eligible";
    reason: string;
    summary: string;
  }) {
    if (!this.finalDispositions.has(input.source.emailId)) {
      this.finalDispositions.set(input.source.emailId, {
        disposition: input.disposition,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        summary: input.summary,
      });
    }
  }
  async recordRetry(input: {
    source: FinanceInvoiceSourceRecord;
    retryAfterUnixMs: number;
    reason: string;
  }) {
    this.retries.set(input.source.emailId, {
      retryAfterUnixMs: input.retryAfterUnixMs,
      reason: input.reason,
    });
  }
}

function fakeMailbox(message: EmailMessage): FinanceInvoiceMailbox {
  return {
    getConfiguredMailboxAddress: () => MAILBOX,
    refreshInbox: async () => batch(message),
    fetchEmailByUID: async (uid, expectedUidValidity, folderName) => {
      expect(uid).toBe(message.uid);
      expect(expectedUidValidity).toBe(UID_VALIDITY);
      expect(folderName).toBe("INBOX");
      return message;
    },
  };
}

function service(
  message: EmailMessage,
  sourceOverrides: Partial<FinanceInvoiceSourceRecord> = {}
) {
  const store = new FakeInvoiceStore(message, sourceOverrides);
  return {
    store,
    runner: new ComoFinanceInvoiceDraftService(store, fakeMailbox(message)),
  };
}

describe("COMO incoming finance invoice private-mail drafts", () => {
  it("creates exactly one private draft only for a newly received, verified, linked invoice and uses the approved recipients", async () => {
    const message = email({
      attachments: [
        invoicePdf(),
        {
          filename: "invoice-support.xlsx",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 8,
          content: Buffer.from("data"),
          disposition: "attachment",
          contentId: null,
        },
        {
          filename: "logo.png",
          contentType: "image/png",
          size: 5,
          content: Buffer.from("logo"),
          disposition: "inline",
          contentId: "logo@cid",
        },
        {
          filename: "Signed Contract.pdf",
          contentType: "application/pdf",
          size: 8,
          content: Buffer.from("contract"),
          disposition: "attachment",
          contentId: null,
        },
      ],
    });
    const { store, runner } = service(message);

    const result = await runner.run({ userId: USER_ID });

    expect(result).toMatchObject({
      status: "draft_created",
      sourceEmailId: 91,
      externalSideEffect: false,
    });
    expect(store.drafts).toHaveLength(1);
    const draft = store.drafts[0]!;
    expect(draft).toMatchObject({
      userId: USER_ID,
      workFileId: 19,
      toText: FINANCE_INVOICE_TO,
      ccText: FINANCE_INVOICE_CC,
      subject: "Fw: Tax Invoice INV-77",
    });
    expect(draft.body).toContain(
      "Please review the attached Villa 390001 consultant invoice against the agreed contract payment terms and arrange payment if due."
    );
    expect(draft.body).not.toContain(
      "The contract reference was shared with Finance separately."
    );
    expect(draft.body).toContain(FULL_OWNER_SIGNATURE);
    expect(draft.body).toContain("Development Director");
    expect(draft.body).toContain("COMO Real Estate Development L.L.C");
    expect(draft.body).toContain("+971 55 106 2668");
    expect(draft.body).toContain("a.zaqout@comodevelopments.com");
    expect(draft.attachments.map(item => item.filename)).toEqual([
      "Consultant Invoice INV-77.pdf",
      "invoice-support.xlsx",
    ]);
    expect(draft.attachments.map(item => item.filename)).not.toContain(
      "logo.png"
    );
    expect(draft.attachments.map(item => item.filename)).not.toContain(
      "Signed Contract.pdf"
    );
  });

  it("uses the stronger contract-reference sentence only when actual Sent evidence proves exact Shahid, Wael, and account.mrt recipients", async () => {
    const message = email();
    const { store, runner } = service(message);
    store.evidence = [
      {
        userId: USER_ID,
        projectId: 6,
        direction: "outbound",
        communicationStatus: "sent",
        sentAt: "2026-10-10 05:50:00",
        sourceSystem: "imap",
        subject: "Signed consultant contract",
        body: "Contract appointment shared with Finance.",
        toText: "shahid@zooma.ae",
        ccText: "Wael <wael@zooma.ae>, Accounts <account.mrt@zooma.ae>",
      },
    ];

    await runner.run({ userId: USER_ID });

    expect(store.drafts[0]!.body).toContain(
      "The contract reference was shared with Finance separately."
    );
    expect(store.drafts[0]!.body).toContain("arrange payment if due.");
    expect(financeInvoiceDraftBody("Villa 390001", false)).not.toContain(
      "shared with Finance separately"
    );
  });

  it("does not claim Finance received the contract when display names merely resemble the approved recipient addresses", async () => {
    const message = email();
    const { store, runner } = service(message);
    store.evidence = [
      {
        userId: USER_ID,
        projectId: 6,
        direction: "outbound",
        communicationStatus: "sent",
        sentAt: "2026-10-10 05:50:00",
        sourceSystem: "imap",
        subject: "Signed consultant contract",
        body: "Contract appointment shared with Finance.",
        toText: "Shahid Finance <unrelated@example.test>",
        ccText:
          "Wael Team <wael.team@example.test>, Accounts <accounts@example.test>",
      },
    ];

    await runner.run({ userId: USER_ID });

    expect(store.drafts[0]!.body).not.toContain(
      "The contract reference was shared with Finance separately."
    );
    expect(store.drafts[0]!.body).toContain("arrange payment if due.");
  });

  it("creates no operational draft for a quotation/proforma even when a PDF filename says invoice", async () => {
    const message = email({
      subject: "Quotation and Proforma Invoice INV-77",
      textBody:
        "Please see the attached quotation and proforma invoice for review.",
    });
    const { store, runner } = service(message);

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "skipped",
      reason: "ambiguous_invoice_or_proforma_quote",
    });
    expect(store.drafts).toHaveLength(0);
  });

  it("ignores mail from before delegation even when it has an otherwise valid invoice attachment", async () => {
    const message = email({ date: new Date("2026-10-10T05:23:28Z") });
    const { store, runner } = service(message);

    await expect(runner.run({ userId: USER_ID })).resolves.toEqual({
      status: "skipped",
      reason: "before_delegation_cutoff",
      externalSideEffect: false,
    });
    expect(store.drafts).toHaveLength(0);
  });

  it("rejects a source record bound to a different mailbox, user, project ownership, or closed work file", async () => {
    const message = email();
    const variants: Array<Partial<FinanceInvoiceSourceRecord>> = [
      { mailboxKey: financeInvoiceMailboxKey("other@example.test") },
      { userId: 999 },
      { projectUserId: 999 },
      { workFileStatus: "closed" },
    ];
    for (const override of variants) {
      const { store, runner } = service(message, override);
      await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
        status: "error",
        reason: "finance_invoice_draft_failed",
      });
      expect(store.drafts).toHaveLength(0);
    }
  });

  it("does not create a payment-facing draft when the invoice sender is not a linked party/contact or a verified ARTEC project sender", async () => {
    const message = email({ from: "unverified-supplier@example.test" });
    const { store, runner } = service(message, {
      fromEmail: message.from,
      linkedPartyContactMatch: 0,
      knownArtecSender: 0,
    });

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "skipped",
      reason: "invoice_sender_not_verified",
    });
    expect(store.drafts).toHaveLength(0);
  });

  it("continues past an ambiguous newest row in the bounded persisted queue and drafts the next verified invoice only", async () => {
    const ambiguous = email({
      uid: 124,
      messageId: "<proforma@example.test>",
      subject: "Proforma invoice INV-78",
      textBody: "Please review the proforma invoice.",
      date: new Date("2026-10-10T06:10:00Z"),
    });
    const valid = email({
      uid: 123,
      messageId: "<valid-invoice@example.test>",
      date: new Date("2026-10-10T06:00:00Z"),
    });
    const { store } = service(valid);
    store.sources = [sourceFor(ambiguous), sourceFor(valid)];
    const queuedMailbox: FinanceInvoiceMailbox = {
      getConfiguredMailboxAddress: () => MAILBOX,
      refreshInbox: async () => batch(ambiguous),
      fetchEmailByUID: async uid => (uid === valid.uid ? valid : ambiguous),
    };
    const runner = new ComoFinanceInvoiceDraftService(store, queuedMailbox);

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "draft_created",
      sourceEmailId: 91,
    });
    expect(store.drafts).toHaveLength(1);
    expect(store.drafts[0]!.subject).toBe("Fw: Tax Invoice INV-77");
  });

  it("deduplicates a retried message and a forwarded/re-imported copy by attachment SHA-256", async () => {
    const firstMessage = email();
    const { store, runner } = service(firstMessage);
    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "draft_created",
    });

    // A saved source has a terminal ledger disposition, so a heartbeat replay
    // never keeps returning the same source header.
    await expect(runner.run({ userId: USER_ID })).resolves.toEqual({
      status: "no_candidate",
      externalSideEffect: false,
    });

    const forwarded = email({
      uid: 124,
      messageId: "<forwarded-invoice@example.test>",
      subject: "Fwd: Tax Invoice INV-77",
    });
    store.source = sourceFor(forwarded, { emailId: 92 });
    store.sources = [store.source];
    const forwardedRunner = new ComoFinanceInvoiceDraftService(
      store,
      fakeMailbox(forwarded)
    );
    await expect(
      forwardedRunner.run({ userId: USER_ID })
    ).resolves.toMatchObject({
      status: "duplicate",
      reason: "duplicate_invoice_attachment",
    });
    expect(store.drafts).toHaveLength(1);
    expect(store.finalDispositions.get(92)).toMatchObject({
      disposition: "duplicate",
      reason: "duplicate_invoice_attachment",
      idempotencyKey: financeInvoiceDispositionKey(92),
    });
  });

  it("advances oldest-first beyond the first 20 permanently evaluated sources across heartbeat invocations", async () => {
    const valid = email({
      uid: 999,
      messageId: "<invoice-after-page@example.test>",
      date: new Date("2026-10-10T07:00:00Z"),
    });
    const { store } = service(valid);
    const reviewed = Array.from({ length: 24 }, (_, index) => {
      const item = email({
        uid: 200 + index,
        messageId: `<quote-${index}@example.test>`,
        subject: `Quotation ${index}`,
        textBody: "Please review this quotation; it is not an invoice.",
        date: new Date(Date.UTC(2026, 9, 10, 6, index, 0)),
      });
      return sourceFor(item, {
        emailId: 1_000 + index,
        receivedAt: `2026-10-10 06:${String(index).padStart(2, "0")}:00`,
      });
    });
    const validSource = sourceFor(valid, {
      emailId: 2_000,
      receivedAt: "2026-10-10 07:00:00",
    });
    store.sources = [...reviewed, validSource];
    const messages = new Map<number, EmailMessage>([
      ...reviewed.map(
        source =>
          [
            source.imapUid,
            email({
              uid: source.imapUid,
              messageId: source.messageId!,
              subject: source.subject,
              textBody: source.bodyText,
              date: new Date(source.receivedAt.replace(" ", "T") + "Z"),
            }),
          ] as const
      ),
      [valid.uid, valid],
    ]);
    const runner = new ComoFinanceInvoiceDraftService(store, {
      getConfiguredMailboxAddress: () => MAILBOX,
      refreshInbox: async () => batch(valid),
      fetchEmailByUID: async uid => messages.get(uid) ?? null,
    });

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "skipped",
      reason: "ambiguous_invoice_or_proforma_quote",
    });
    expect(store.drafts).toHaveLength(0);
    expect(store.finalDispositions).toHaveLength(20);

    // The second page contains the remaining four reviews and then the oldest
    // eligible invoice; no earlier source is reconsidered.
    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "draft_created",
      sourceEmailId: 2_000,
    });
    expect(store.drafts).toHaveLength(1);
    expect(store.finalDispositions).toHaveLength(25);
    for (const source of [...reviewed, validSource]) {
      expect(store.finalDispositions.get(source.emailId)?.idempotencyKey).toBe(
        financeInvoiceDispositionKey(source.emailId)
      );
    }

    await expect(runner.run({ userId: USER_ID })).resolves.toEqual({
      status: "no_candidate",
      externalSideEffect: false,
    });
    expect(store.drafts).toHaveLength(1);
    expect(store.finalDispositions).toHaveLength(25);
    expect(
      [...store.finalDispositions.values()].filter(
        item => item.disposition === "review_required"
      )
    ).toHaveLength(24);
  });

  it("records a temporary attachment-unavailable retry and still drafts the next source", async () => {
    const unavailable = email({
      uid: 400,
      messageId: "<attachment-unavailable@example.test>",
      date: new Date("2026-10-10T06:00:00Z"),
      attachments: [
        {
          filename: "invoice.pdf",
          contentType: "application/pdf",
          size: 10,
          content: undefined,
          disposition: "attachment",
          contentId: null,
        },
      ],
    });
    const ready = email({
      uid: 401,
      messageId: "<ready-after-retry@example.test>",
      date: new Date("2026-10-10T06:01:00Z"),
    });
    const { store } = service(ready);
    const unavailableSource = sourceFor(unavailable, {
      emailId: 400,
      receivedAt: "2026-10-10 06:00:00",
    });
    const readySource = sourceFor(ready, {
      emailId: 401,
      receivedAt: "2026-10-10 06:01:00",
    });
    store.sources = [unavailableSource, readySource];
    const runner = new ComoFinanceInvoiceDraftService(store, {
      getConfiguredMailboxAddress: () => MAILBOX,
      refreshInbox: async () => batch(ready),
      fetchEmailByUID: async uid =>
        uid === unavailable.uid ? unavailable : ready,
    });

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "draft_created",
      sourceEmailId: 401,
    });
    expect(store.drafts).toHaveLength(1);
    expect(store.retries.get(400)).toMatchObject({
      reason: "invoice_attachment_unavailable",
    });
    expect(store.finalDispositions.has(400)).toBe(false);
    expect(store.finalDispositions.get(401)).toMatchObject({
      disposition: "draft_saved",
    });
  });

  it("caps one heartbeat at three MIME fetches and advances after deferred retry sources", async () => {
    const unavailable = (index: number) =>
      email({
        uid: 500 + index,
        messageId: `<unavailable-${index}@example.test>`,
        date: new Date(Date.UTC(2026, 9, 10, 6, index, 0)),
        attachments: [
          {
            filename: "invoice.pdf",
            contentType: "application/pdf",
            size: 10,
            content: undefined,
            disposition: "attachment",
            contentId: null,
          },
        ],
      });
    const unavailableMessages = [
      unavailable(0),
      unavailable(1),
      unavailable(2),
      unavailable(3),
    ];
    const ready = email({
      uid: 504,
      messageId: "<ready-after-mime-budget@example.test>",
      date: new Date("2026-10-10T06:05:00Z"),
    });
    const { store } = service(ready);
    store.sources = [
      ...unavailableMessages.map((message, index) =>
        sourceFor(message, {
          emailId: 500 + index,
          receivedAt: `2026-10-10 06:0${index}:00`,
        })
      ),
      sourceFor(ready, { emailId: 504, receivedAt: "2026-10-10 06:05:00" }),
    ];
    const byUid = new Map(
      [...unavailableMessages, ready].map(message => [message.uid, message])
    );
    const fetches: number[] = [];
    const runner = new ComoFinanceInvoiceDraftService(store, {
      getConfiguredMailboxAddress: () => MAILBOX,
      refreshInbox: async () => batch(ready),
      fetchEmailByUID: async uid => {
        fetches.push(uid);
        return byUid.get(uid) ?? null;
      },
    });

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "error",
      reason: "finance_invoice_draft_failed",
    });
    expect(fetches).toEqual([500, 501, 502]);
    expect(store.retries).toHaveLength(3);
    expect(store.drafts).toHaveLength(0);

    await expect(runner.run({ userId: USER_ID })).resolves.toMatchObject({
      status: "draft_created",
      sourceEmailId: 504,
    });
    expect(fetches).toEqual([500, 501, 502, 503, 504]);
    expect(store.drafts).toHaveLength(1);
  });

  it("requires one identifiable invoice PDF, excludes inline logos, and never promotes a signed contract as an invoice document", () => {
    expect(
      selectInvoiceDocuments([
        {
          filename: "invoice.pdf",
          contentType: "application/pdf",
          size: 8,
          content: Buffer.from("%PDF Invoice"),
          disposition: "attachment",
        },
        {
          filename: "invoice copy.pdf",
          contentType: "application/pdf",
          size: 8,
          content: Buffer.from("%PDF Invoice"),
          disposition: "attachment",
        },
      ])
    ).toMatchObject({ kind: "skip", reason: "ambiguous_invoice_document" });
    expect(
      selectInvoiceDocuments([
        {
          filename: "signed contract.pdf",
          contentType: "application/pdf",
          size: 8,
          content: Buffer.from("%PDF Invoice"),
          disposition: "attachment",
        },
      ])
    ).toMatchObject({ kind: "skip", reason: "invoice_pdf_not_identified" });
  });
});
