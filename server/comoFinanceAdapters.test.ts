import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({ createDraft: vi.fn() }));
vi.mock("./services/comoNextCommands", () => ({ createCommunicationDraftCommand: mocks.createDraft, appendEvent: vi.fn() }));
import { DatabaseFinancePaymentFollowupStore, planFinancePaymentFollowup, FINANCE_PAYMENT_MAILBOX_KEY } from "./services/comoFinancePaymentFollowups";
import { DrizzleFinanceInvoiceDraftStore, type FinanceInvoiceSourceRecord } from "./services/comoFinanceInvoiceDrafts";

const dialect = new MySqlDialect();
const rendered = (query: any) => dialect.sqlToQuery(query);
const sent = {
  id: 41, userId: 7, projectId: 11, workFileId: 19, workFileStatus: "open",
  mailboxKey: FINANCE_PAYMENT_MAILBOX_KEY, folderName: "Sent", fromEmail: "a.zaqout@comodevelopments.com",
  toText: "wael@zooma.ae", ccText: "shahid@zooma.ae, account.mrt@zooma.ae",
  subject: "Payment request — invoice INV-448", bodyText: "Please arrange payment for invoice INV-448.",
  sentAt: "2026-10-10 06:00:00", messageId: "<sent-41@comodevelopments.com>",
};
const planned = planFinancePaymentFollowup(sent);
if (!("plan" in planned)) throw new Error("test finance plan missing");
const plan = planned.plan;

beforeEach(() => vi.clearAllMocks());

describe("finance adapters preserve actionable memory", () => {
  it("saves a payment reminder through the file command with original Sent thread", async () => {
    mocks.createDraft.mockResolvedValue({ id: 50, replayed: false, communicationStatus: "draft", mailboxDraft: { folder: "Drafts", uid: 12 } });
    const result = await new DatabaseFinancePaymentFollowupStore().saveThreadDraft({ plan, sent, subject: "Re: Payment request", body: "Polite reminder" });
    expect(result).toEqual({ folder: "Drafts", uid: 12, created: true });
    expect(mocks.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, workFileId: 19, sourceEmailId: 41, idempotencyKey: plan.draftKey,
      toText: "wael@zooma.ae", ccText: "shahid@zooma.ae, account.mrt@zooma.ae", channel: "email",
    }));
  });
  it("does not recreate a reminder already observed in Sent", async () => {
    mocks.createDraft.mockResolvedValue({ id: 50, replayed: true, communicationStatus: "sent", mailboxDraft: null });
    await expect(new DatabaseFinancePaymentFollowupStore().saveThreadDraft({ plan, sent, subject: "Re: Payment request", body: "Polite reminder" })).resolves.toEqual({ folder: "Sent", uid: null, created: false });
  });
  it("does not count an unobservable unsent mailbox result as saved", async () => {
    mocks.createDraft.mockResolvedValue({ id: 50, replayed: true, communicationStatus: "draft", mailboxDraft: null });
    await expect(new DatabaseFinancePaymentFollowupStore().saveThreadDraft({ plan, sent, subject: "Re: Payment request", body: "Polite reminder" })).rejects.toThrow("not_observable");
  });
  it("writes review action and terminal disposition atomically and skips replay", async () => {
    let exists = false;
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const tx = { execute: vi.fn(async (query: any) => {
      const q = rendered(query); queries.push(q);
      if (q.sql.includes("FOR UPDATE")) return [[{ id: 19 }]];
      if (q.sql.includes("WHERE idempotency_key")) return [exists ? [{ id: 5 }] : []];
      if (q.sql.includes("MAX(sequence_no)")) return [[{ sequenceNo: 1 }]];
      if (q.sql.includes("INSERT INTO como_next_work_file_events")) exists = true;
      return [{ affectedRows: 1 }];
    }) };
    const db = { execute: tx.execute, transaction: vi.fn(async (fn: any) => fn(tx)) };
    const store = new DrizzleFinanceInvoiceDraftStore(db);
    const source = { userId: 7, projectId: 11, workFileId: 19, emailId: 77, subject: "Invoice or quote" } as FinanceInvoiceSourceRecord;
    const input = { source, idempotencyKey: "finance_invoice_draft:source:77", disposition: "review_required" as const, reason: "ambiguous_invoice_document" as const, summary: "Review needed" };
    await store.recordFinalDisposition(input);
    await store.recordFinalDisposition(input);
    const actions = queries.filter(q => q.sql.includes("INSERT INTO como_next_actions"));
    expect(actions).toHaveLength(1);
    expect(actions[0].params).toContain("manus");
    expect(actions[0].params).toContain("open");
    expect(actions[0].params).toContain("finance_invoice_review");
    expect(queries.filter(q => q.sql.includes("INSERT INTO como_next_work_file_events"))).toHaveLength(1);
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });
});
