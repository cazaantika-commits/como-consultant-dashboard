import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getDb } from "./db";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import {
  confirmValidatedSentLineageCommand,
  planValidatedSentLineageConfirmation,
  type SentReviewEmail,
} from "./services/comoNextEmailInbox";

const mockedGetDb = vi.mocked(getDb);
const dialect = new MySqlDialect();
const mailboxKey = "a".repeat(64);
const ownerMailbox = "owner@comodevelopments.com";

function email(overrides: Partial<SentReviewEmail> = {}): SentReviewEmail {
  return {
    id: 2160001,
    userId: 7,
    mailboxKey,
    folderName: "Sent",
    uidValidity: "23124",
    imapUid: 965,
    messageId: "<sent-965@example.test>",
    fromEmail: "Owner <owner@comodevelopments.com>",
    toText: "consultant@example.test",
    ccText: null,
    subject: "Approved reply",
    bodyText: "Please proceed.",
    bodySha256: "b".repeat(64),
    receivedAt: "2026-10-24 11:17:05",
    inboxStatus: "linked",
    linkedProjectId: 11,
    linkedWorkFileId: 13,
    communicationId: 3090001,
    ...overrides,
  };
}

const lineage = { kind:"validated", ledgerId: 501, projectId: 11, workFileId: 13, communicationId: 3060001 } as const;

function sourceRecord(row: SentReviewEmail) {
  return `imap:${row.mailboxKey.slice(0, 24)}:${row.folderName}:${row.uidValidity}:${row.imapUid}`;
}

function rows(result: Record<string, unknown>[]) {
  return [result];
}

function createTx(input: {
  email?: SentReviewEmail;
  workFile?: Record<string, unknown> | null;
  ledger?: Record<string, unknown> | null;
  canonical?: Record<string, unknown> | null;
  shadow?: Record<string, unknown> | null;
  eventExists?: boolean;
}) {
  const statements: ReturnType<MySqlDialect["sqlToQuery"]>[] = [];
  const current = input.email || email();
  const execute = vi.fn(async (query: unknown) => {
    const rendered = dialect.sqlToQuery(query as any);
    statements.push(rendered);
    const sql = rendered.sql;
    if (sql.includes("FROM como_next_work_files")) return rows(input.workFile === undefined ? [{ id: 13, userId: 7, projectId: 11, workFileStatus: "open" }] : input.workFile ? [input.workFile] : []);
    if (sql.includes("FROM como_next_email_messages")) return rows([{ ...current }]);
    if (sql.includes("FROM como_mailbox_draft_ledger")) return rows(input.ledger === undefined ? [{
      id: 501, mailboxKey, userId: 7, projectId: 11, workFileId: 13,
      communicationId: 3060001, state: "draft_saved", sentFolder: null, sentUid: null,
    }] : input.ledger ? [input.ledger] : []);
    if (sql.includes("FROM como_next_communications")) {
      const id = Number(rendered.params.find(value => Number(value) === 3090001 || Number(value) === 3060001));
      if (id === 3090001) return rows(input.shadow === undefined ? [{
        id: 3090001, userId: 7, projectId: 11, workFileId: 13, communicationStatus: "sent",
        sourceSystem: "imap", sourceRecordId: sourceRecord(current),
      }] : input.shadow ? [input.shadow] : []);
      return rows(input.canonical === undefined ? [{
        id: 3060001, userId: 7, projectId: 11, workFileId: 13, channel: "email", direction: "outbound",
        communicationStatus: "draft", sourceSystem: "como_next", sourceRecordId: "private-email:3060001",
      }] : input.canonical ? [input.canonical] : []);
    }
    if (sql.includes("FROM como_next_work_file_events")) return rows(input.eventExists ? [{ id: 1 }] : []);
    return [{ affectedRows: 1 }];
  });
  const insert = vi.fn(() => ({ values: vi.fn(async () => [{ insertId: 1 }]) }));
  return { execute, insert, statements };
}

function useMockDb(tx: ReturnType<typeof createTx>) {
  mockedGetDb.mockResolvedValue({
    transaction: async <T>(callback: (value: typeof tx) => Promise<T>) => callback(tx),
  } as any);
}

describe("canonical readonly Sent review", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the original canonical communication and never inserts a competing IMAP communication", async () => {
    const tx = createTx({});
    useMockDb(tx);

    await expect(confirmValidatedSentLineageCommand({ userId: 7, mailboxKey, ownerMailbox, email: email(), lineage })).resolves.toEqual({
      kind: "confirmed", communicationId: 3060001, replayed: false,
    });

    const sql = tx.statements.map(statement => statement.sql).join("\n");
    expect(sql).toContain("UPDATE como_next_communications");
    expect(sql).toContain("UPDATE como_next_email_messages");
    expect(sql).toContain("UPDATE como_mailbox_draft_ledger");
    expect(sql).not.toContain("INSERT INTO `como_next_communications`");
    expect(sql).not.toContain("INSERT INTO como_next_communications");
    expect(sql).toContain("FOR UPDATE");
  });

  it("corrects only a legacy IMAP shadow proven by the exact stored Sent provenance", async () => {
    const tx = createTx({});
    useMockDb(tx);
    await expect(confirmValidatedSentLineageCommand({ userId: 7, mailboxKey, ownerMailbox, email: email(), lineage })).resolves.toMatchObject({ kind: "confirmed" });

    const sourceLookup = tx.statements.find(statement => statement.sql.includes("WHERE id = ?") && statement.params.includes(3090001));
    expect(sourceLookup?.sql).toContain("source_system AS sourceSystem");
    expect(sourceLookup?.sql).toContain("source_record_id AS sourceRecordId");
  });

  it("leaves a non-proven existing communication in review rather than rebinding it", async () => {
    const tx = createTx({ shadow: {
      id: 3090001, userId: 7, projectId: 11, workFileId: 13, communicationStatus: "sent",
      sourceSystem: "imap", sourceRecordId: "imap:other:Sent:other:1",
    } });
    useMockDb(tx);

    await expect(confirmValidatedSentLineageCommand({ userId: 7, mailboxKey, ownerMailbox, email: email(), lineage })).resolves.toEqual({
      kind: "review", reason: "legacy_imap_shadow_not_proven",
    });
    expect(tx.statements.map(statement => statement.sql).join("\n")).not.toContain("UPDATE como_next_email_messages");
  });

  it("does not apply a stale validation after the stored source changed",async()=>{
    const tx=createTx({email:email({bodyText:"Different source text",bodySha256:"c".repeat(64)})});
    useMockDb(tx);
    await expect(confirmValidatedSentLineageCommand({userId:7,mailboxKey,ownerMailbox,email:email(),lineage})).resolves.toEqual({kind:"review",reason:"stored_sent_source_changed_since_validation"});
    expect(tx.statements.map(s=>s.sql).join("\n")).not.toContain("UPDATE como_next_");
  });

  it("is idempotent when the canonical evidence is already confirmed", async () => {
    const current = email({ communicationId: 3060001 });
    const tx = createTx({
      email: current,
      ledger: { id: 501, mailboxKey, userId: 7, projectId: 11, workFileId: 13, communicationId: 3060001, state: "sent_confirmed", sentFolder: "Sent", sentUid: 965 },
      canonical: { id: 3060001, userId: 7, projectId: 11, workFileId: 13, channel: "email", direction: "outbound", communicationStatus: "sent", sourceSystem: "como_next", sourceRecordId: "private-email:3060001" },
      shadow: null,
      eventExists: true,
    });
    useMockDb(tx);

    await expect(confirmValidatedSentLineageCommand({ userId: 7, mailboxKey, ownerMailbox, email: current, lineage })).resolves.toEqual({
      kind: "confirmed", communicationId: 3060001, replayed: true,
    });
    const sql = tx.statements.map(statement => statement.sql).join("\n");
    expect(sql).not.toContain("UPDATE como_next_communications");
    expect(sql).not.toContain("UPDATE como_next_email_messages");
    expect(sql).not.toContain("UPDATE como_mailbox_draft_ledger");
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("rejects mismatched stored project/file identity and cancelled work files before any mutation", async () => {
    const mismatch = planValidatedSentLineageConfirmation({
      userId: 7, mailboxKey, ownerMailbox, expectedUidValidity: "23124", expectedUid: 965,
      email: email({ linkedProjectId: 99, linkedWorkFileId: 100 }), lineage,
    });
    expect(mismatch).toEqual({ kind: "review", reason: "email_already_linked_elsewhere" });

    const tx = createTx({ workFile: { id: 13, userId: 7, projectId: 11, workFileStatus: "cancelled" } });
    useMockDb(tx);
    await expect(confirmValidatedSentLineageCommand({ userId: 7, mailboxKey, ownerMailbox, email: email({ communicationId: null, linkedProjectId: null, linkedWorkFileId: null }), lineage })).resolves.toEqual({
      kind: "review", reason: "canonical_work_file_unavailable",
    });
    expect(tx.statements.map(statement => statement.sql).join("\n")).not.toContain("UPDATE como_next_");
  });

  it("requires the exact actual Sent UID and UIDVALIDITY, never a fabricated observation", () => {
    expect(planValidatedSentLineageConfirmation({
      userId: 7, mailboxKey, ownerMailbox, expectedUidValidity: "23124", expectedUid: 966,
      email: email(), lineage,
    })).toEqual({ kind: "review", reason: "stored_sent_identity_mismatch" });
    expect(planValidatedSentLineageConfirmation({
      userId: 7, mailboxKey, ownerMailbox, expectedUidValidity: "", expectedUid: 965,
      email: email(), lineage,
    })).toEqual({ kind: "review", reason: "stored_sent_identity_mismatch" });
  });
});
