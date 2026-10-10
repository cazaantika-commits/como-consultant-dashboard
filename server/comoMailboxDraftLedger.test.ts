import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import {
  DatabaseMailboxDraftLedger,
  InMemoryMailboxDraftLedger,
  MailboxDraftBusyError,
  MailboxDraftHumanReviewRequired,
  saveMailboxDraftExactlyOnce,
  type MailboxDraftClaimInput,
  type MailboxDraftLookup,
} from "./services/comoMailboxDraftLedger";

const mockedGetDb = vi.mocked(getDb);

const claim: MailboxDraftClaimInput = {
  mailboxKey: "mailbox-sha",
  draftKey: "private-email:42",
  messageId: "<draft-42@example.test>",
  subject: "Invoice review",
  body: "Please review the invoice.",
  to: "wael@zooma.ae",
  cc: "account.mrt@zooma.ae",
  lineage: { userId: 7, projectId: 11, workFileId: 13, communicationId: 42 },
};

const foundDraft: MailboxDraftLookup = { kind: "found", folder: "Drafts", uid: 101, sent: false };

function mailbox(input: {
  find?: () => Promise<MailboxDraftLookup>;
  append?: () => Promise<void>;
} = {}) {
  return {
    findByStableIdentity: vi.fn(input.find || (async () => foundDraft)),
    appendDraft: vi.fn(input.append || (async () => undefined)),
  };
}

describe("Mailbox Draft ledger exactly-once boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves concurrent calls with one append only", async () => {
    const ledger = new InMemoryMailboxDraftLedger();
    let releaseFirstLookup!: () => void;
    const firstLookupStarted = new Promise<void>(resolve => { releaseFirstLookup = resolve; });
    let firstLookupEntered!: () => void;
    const firstLookupEnteredPromise = new Promise<void>(resolve => { firstLookupEntered = resolve; });
    let lookupCalls = 0;
    const port = mailbox({
      find: async () => {
        lookupCalls += 1;
        if (lookupCalls === 1) {
          firstLookupEntered();
          await firstLookupStarted;
          return { kind: "missing" };
        }
        return foundDraft;
      },
    });

    const first = saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port });
    await firstLookupEnteredPromise;
    const second = saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port });
    await expect(second).rejects.toBeInstanceOf(MailboxDraftBusyError);
    releaseFirstLookup();

    await expect(first).resolves.toMatchObject({ created: true, observedInSent: false });
    expect(port.appendDraft).toHaveBeenCalledTimes(1);
  });

  it("reports a live pre-append lease as retryable and permits a later retry after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T00:00:00.000Z"));
    const ledger = new InMemoryMailboxDraftLedger();
    await ledger.claim(claim);
    let lookups = 0;
    const port = mailbox({
      find: async () => (++lookups === 1 ? { kind: "missing" } : foundDraft),
    });

    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).rejects.toBeInstanceOf(MailboxDraftBusyError);
    expect(port.appendDraft).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-10-10T00:05:01.000Z"));
    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).resolves.toMatchObject({ created: true });
    expect(port.appendDraft).toHaveBeenCalledTimes(1);
  });

  it("never takes over append_started even after the original lease would have expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T00:00:00.000Z"));
    const ledger = new InMemoryMailboxDraftLedger();
    const acquired = await ledger.claim(claim);
    expect(acquired.kind).toBe("winner");
    if (acquired.kind !== "winner") throw new Error("test setup failed");
    await expect(ledger.beginAppend({ id: acquired.row.id, claimToken: acquired.claimToken })).resolves.toMatchObject({ state: "append_started" });

    vi.setSystemTime(new Date("2026-10-11T00:00:00.000Z"));
    await expect(ledger.claim(claim)).resolves.toMatchObject({ kind: "blocked", row: { state: "append_started" } });
    const port = mailbox({ find: async () => ({ kind: "missing" }) });
    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).rejects.toBeInstanceOf(MailboxDraftHumanReviewRequired);
    expect(port.appendDraft).not.toHaveBeenCalled();
  });

  it("treats a failed append with no observable message as ambiguous and never repeats it", async () => {
    const ledger = new InMemoryMailboxDraftLedger();
    const port = mailbox({
      find: async () => ({ kind: "missing" }),
      append: async () => { throw new Error("IMAP disconnected after append request"); },
    });

    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).rejects.toBeInstanceOf(MailboxDraftHumanReviewRequired);
    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).rejects.toBeInstanceOf(MailboxDraftHumanReviewRequired);
    expect(port.appendDraft).toHaveBeenCalledTimes(1);
  });

  it("does not recreate a Draft when the completed ledger observation is in Sent", async () => {
    const ledger = new InMemoryMailboxDraftLedger();
    const acquired = await ledger.claim(claim);
    expect(acquired.kind).toBe("winner");
    if (acquired.kind !== "winner") throw new Error("test setup failed");
    await ledger.confirmMailboxObservation({ id: acquired.row.id, folder: "Sent", uid: 202, sent: true });
    const port = mailbox({ find: async () => ({ kind: "found", folder: "Sent", uid: 202, sent: true }) });

    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).resolves.toEqual({
      folder: "Sent", uid: 202, created: false, observedInSent: true,
    });
    expect(port.appendDraft).not.toHaveBeenCalled();
  });

  it("does not demote a completed Sent delivery when only a stale Draft is later found", async () => {
    const ledger = new InMemoryMailboxDraftLedger();
    const acquired = await ledger.claim(claim);
    expect(acquired.kind).toBe("winner");
    if (acquired.kind !== "winner") throw new Error("test setup failed");
    await ledger.confirmMailboxObservation({ id: acquired.row.id, folder: "Sent", uid: 202, sent: true });
    const port = mailbox({ find: async () => foundDraft });

    await expect(saveMailboxDraftExactlyOnce({ ledger, claim, mailbox: port })).rejects.toBeInstanceOf(MailboxDraftHumanReviewRequired);
    expect(port.appendDraft).not.toHaveBeenCalled();
  });

  it("preserves sent_confirmed when a stale Draft observation arrives later", async () => {
    const ledger = new InMemoryMailboxDraftLedger();
    const acquired = await ledger.claim(claim);
    expect(acquired.kind).toBe("winner");
    if (acquired.kind !== "winner") throw new Error("test setup failed");
    await ledger.confirmMailboxObservation({ id: acquired.row.id, folder: "Sent", uid: 202, sent: true });
    await ledger.confirmMailboxObservation({ id: acquired.row.id, folder: "Drafts", uid: 101, sent: false });

    await expect(ledger.claim(claim)).resolves.toMatchObject({
      kind: "completed", row: { state: "sent_confirmed", sentFolder: "Sent", sentUid: 202 },
    });
  });
});

describe("DatabaseMailboxDraftLedger.beginAppend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for the production affectedRows=0 loser result without selecting or appending", async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 0 }]);
    mockedGetDb.mockResolvedValue({
      transaction: async <T>(callback: (tx: { execute(query: unknown): Promise<unknown> }) => Promise<T>) => callback({ execute }),
    } as any);

    await expect(new DatabaseMailboxDraftLedger().beginAppend({ id: 77, claimToken: "losing-claim" })).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
