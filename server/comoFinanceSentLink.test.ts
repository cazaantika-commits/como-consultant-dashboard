import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getDb } from "./db";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { findValidatedSentLineage, type SentLineageMessage } from "./services/comoMailboxDraftLedger";

const mockedGetDb = vi.mocked(getDb);
const dialect = new MySqlDialect();
const mailboxKey = "mailbox-sha";
const ownerMailbox = "owner@comodevelopments.com";
const messageDate = new Date("2026-10-10T10:00:00.000Z");

function sent(overrides: Partial<SentLineageMessage> = {}): SentLineageMessage {
  return {
    uid: 88,
    messageId: "",
    from: "Owner <owner@comodevelopments.com>",
    to: "Wael <wael@zooma.ae>",
    cc: "accounts <account.mrt@zooma.ae>",
    subject: "Fw: Consultant invoice",
    textBody: "Please review the attached consultant invoice.",
    date: messageDate,
    ...overrides,
  };
}

function ledgerRow(overrides: Record<string, unknown> = {}) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    id: 501,
    mailbox_key: mailboxKey,
    draft_key: "private-email:91",
    user_id: 7,
    project_id: 11,
    work_file_id: 13,
    communication_id: 91,
    message_id: "<stable@example.test>",
    subject_sha256: hash("Fw: Consultant invoice"),
    body_sha256: hash("Please review the attached consultant invoice."),
    to_envelope_sha256: hash("wael@zooma.ae"),
    cc_envelope_sha256: hash("account.mrt@zooma.ae"),
    state: "draft_saved",
    claim_token: null,
    claim_expires_at: null,
    draft_folder: "Drafts",
    draft_uid: 1,
    sent_folder: null,
    sent_uid: null,
    created_at: "2026-10-10 09:00:00",
    ...overrides,
  };
}

function mockRows(rows: Array<Record<string, unknown>>) {
  const execute = vi.fn().mockImplementation(async (query: unknown) => {
    const rendered = dialect.sqlToQuery(query as any);
    return [rows];
  });
  mockedGetDb.mockResolvedValue({ execute } as any);
  return execute;
}

function sqlOf(execute: ReturnType<typeof mockRows>) {
  return dialect.sqlToQuery(execute.mock.calls[0]![0] as any);
}

describe("findValidatedSentLineage finance fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is wired to the private-email communication key and validates one actual finance invoice communication", async () => {
    const execute = mockRows([ledgerRow()]);
    await expect(findValidatedSentLineage({ userId: 7, mailboxKey, ownerMailbox, message: sent() })).resolves.toEqual({
      kind: "validated", ledgerId: 501, projectId: 11, workFileId: 13, communicationId: 91,
    });
    const query = sqlOf(execute);
    expect(query.sql).toContain("finance_communication.id = l.communication_id");
    expect(query.sql).toContain("finance_communication.source_system = ?");
    expect(query.sql).toContain("finance_communication.source_record_id LIKE ?");
    expect(query.params).toContain("como_next");
    expect(query.params).toContain("finance_invoice_draft:attachment:%");
    expect(query.sql).not.toContain("l.draft_key LIKE");
  });

  it("does not fall back when a stable Message-ID is present but has no ledger match", async () => {
    const execute = mockRows([]);
    await expect(findValidatedSentLineage({
      userId: 7, mailboxKey, ownerMailbox, message: sent({ messageId: "<unknown@example.test>" }),
    })).resolves.toEqual({ kind: "none" });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(sqlOf(execute).sql).toContain("l.message_id = ?");
  });

  it("requires the actual sent owner mailbox before querying", async () => {
    const execute = mockRows([ledgerRow()]);
    await expect(findValidatedSentLineage({
      userId: 7, mailboxKey, ownerMailbox, message: sent({ from: "attacker@example.test" }),
    })).resolves.toEqual({ kind: "none" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a unique fallback row owned by another user", async () => {
    mockRows([ledgerRow({ user_id: 8 })]);
    await expect(findValidatedSentLineage({ userId: 7, mailboxKey, ownerMailbox, message: sent() })).resolves.toEqual({
      kind: "review", reason: "sent_binding_validation_failed",
    });
  });

  it("rejects a unique fallback row when envelope hashes do not exactly match", async () => {
    mockRows([ledgerRow({ to_envelope_sha256: "wrong" })]);
    await expect(findValidatedSentLineage({ userId: 7, mailboxKey, ownerMailbox, message: sent() })).resolves.toEqual({
      kind: "review", reason: "sent_binding_validation_failed",
    });
  });

  it("rejects a Sent message dated before its candidate ledger row", async () => {
    mockRows([ledgerRow({ created_at: "2026-10-10 11:00:00" })]);
    await expect(findValidatedSentLineage({ userId: 7, mailboxKey, ownerMailbox, message: sent() })).resolves.toEqual({
      kind: "review", reason: "sent_binding_validation_failed",
    });
  });

  it("sends multiple exact fallback matches to review", async () => {
    mockRows([ledgerRow(), ledgerRow({ id: 502, communication_id: 92 })]);
    await expect(findValidatedSentLineage({ userId: 7, mailboxKey, ownerMailbox, message: sent() })).resolves.toEqual({
      kind: "review", reason: "finance_sent_fallback_ambiguous",
    });
  });

  it("treats repeated or malformed draft-key headers as reviewable rather than falling back", async () => {
    const execute = mockRows([ledgerRow()]);
    await expect(findValidatedSentLineage({
      userId: 7, mailboxKey, ownerMailbox, message: sent({ headers: { "X-COMO-Draft-Key": ["private-email:91", "private-email:92"] } }),
    })).resolves.toEqual({ kind: "review", reason: "multiple_draft_keys_in_sent_message" });
    await expect(findValidatedSentLineage({
      userId: 7, mailboxKey, ownerMailbox, message: sent({ headers: { "X-COMO-Draft-Key": "  " } }),
    })).resolves.toEqual({ kind: "review", reason: "malformed_draft_key_in_sent_message" });
    expect(execute).not.toHaveBeenCalled();
  });
});
