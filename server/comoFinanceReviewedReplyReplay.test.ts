import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const state = vi.hoisted(() => ({
  currentReplyId: 1_950_001,
  currentReplySha: "a".repeat(64),
  receipt: null as Record<string, unknown> | null,
  financeEvent: null as Record<string, unknown> | null,
  updates: 0,
  events: [] as Array<Record<string, unknown>>,
}));

const dialect = new MySqlDialect();
const row = (value: unknown) => [[value], []] as any;

async function executeQuery(statement: any) {
  const { sql } = dialect.sqlToQuery(statement);
  if (sql.includes('FROM como_next_work_files')) return row({id:19});
  if (sql.includes("SELECT action_status AS actionStatus") && sql.includes("FROM como_next_actions")) {
    return row({ actionStatus: "waiting_external", evidenceReference: null, sourceSystem: "finance_payment_watch" });
  }
  if (sql.includes("FROM como_next_email_messages")) {
    return row({ id: state.currentReplyId, bodySha256: state.currentReplySha, linkedWorkFileId: 19 });
  }
  if (sql.includes("m.source_system='como_mail_execution'")) {
    return state.receipt ? row(state.receipt) : [[], []];
  }
  if (sql.includes("m.source_system='como_finance_payment_review'")) {
    return state.financeEvent ? row(state.financeEvent) : [[], []];
  }
  if (sql.trimStart().startsWith("UPDATE como_next_actions")) {
    state.updates += 1;
    return [{ affectedRows: 1 }, []];
  }
  throw new Error(`unexpected mocked SQL: ${sql}`);
}

vi.mock("./db", () => ({
  getDb: async () => ({ execute: executeQuery, transaction: async (fn: any) => fn({ execute: executeQuery }) }),
}));
vi.mock("./services/comoNextCommands", () => ({
  appendEvent: async (_tx: unknown, event: Record<string, unknown>) => { state.events.push(event); },
  createCommunicationDraftCommand: async () => { throw new Error("draft must not be created"); },
}));

import {
  DatabaseFinancePaymentFollowupStore,
  FINANCE_PAYMENT_MAILBOX_KEY,
  FinancePaymentFollowupReconciler,
  type FinancePaymentAction,
  type FinancePaymentFollowupStore,
  type FinancePaymentPlan,
  type FinancePaymentSent,
  type FinanceThreadReply,
} from "./services/comoFinancePaymentFollowups";

const plan: FinancePaymentPlan = {
  sentEmailId: 1_110_002,
  userId: 7,
  projectId: 11,
  workFileId: 19,
  sentAt: "2026-10-15T06:00:00.000Z",
  dueAt: "2026-10-19T06:00:00.000Z",
  sourceRecordId: "sent-email-1110002",
  draftKey: "finance-payment-followup:1110002",
};
const action: FinancePaymentAction = { id: 900_001, userId: 7, projectId: 11, workFileId: 19, actionStatus: "waiting_external" };
const reply = (id = 1_950_001): FinanceThreadReply => ({
  id,
  fromEmail: "shahid@zooma.ae",
  subject: "Re: Payment request — invoice INV-448",
  bodyText: "The invoice is under review.",
  receivedAt: "2026-10-19T08:00:00.000Z",
  linkedWorkFileId: 19,
});

function mailReceipt(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    directiveId: 930_001,
    dispatchState: "completed",
    workProductId: 3_990_001,
    userId: 7,
    projectId: 11,
    workFileId: 19,
    memoryId: 3_990_001,
    memoryProjectId: 11,
    memoryWorkFileId: 19,
    memorySourceSystem: "como_mail_execution",
    memorySourceRecordId: "dispatch-review:930001",
    memoryType: 'work_product',
    memorySourceStatus: 'reviewed',
    resultJson: JSON.stringify({
      completedNow: true,
      workProductId: 3_990_001,
      sourceEmailId: 1_950_001,
      bodySha256: HASH_A,
      responseHandling: {kind:'no_reply_needed',evidence:'A trusted receipt reviewed this exact source message.',nextStep:'Keep the existing payment confirmation watch waiting.'},
    }),
    ...overrides,
  };
}

function financeEventReceipt() {
  return {
    directiveId: 930_002,
    dispatchState: "completed",
    workProductId: 3_990_002,
    userId: 7,
    projectId: 11,
    workFileId: 19,
    memoryId: 3_990_002,
    memoryProjectId: 11,
    memoryWorkFileId: 19,
    memorySourceSystem: "como_finance_payment_review",
    memorySourceRecordId: "dispatch-finance-watch:930002",
    memoryType: 'work_product',
    memorySourceStatus: 'reviewed',
    payloadJson: JSON.stringify({
      directiveId: 930_002,
      workProductId: 3_990_002,
      reviewCompleted: true,
      sentEmailId: 1_110_002,
      reviewedReplies: [{ emailId: 1_950_001, sha256: HASH_A }],
    }),
  };
}

beforeEach(() => {
  state.currentReplyId = 1_950_001;
  state.currentReplySha = HASH_A;
  state.receipt = null;
  state.financeEvent = null;
  state.updates = 0;
  state.events = [];
});

async function open(replies = [reply()]) {
  return new DatabaseFinancePaymentFollowupStore().openFinanceReview({ action, plan, replies });
}

describe("COMO finance reviewed-reply replay protection", () => {
  it("keeps a waiting watch waiting when every reply is covered by its trusted completed mail receipt", async () => {
    state.receipt = mailReceipt();

    await expect(open()).resolves.toBe(false);
    expect(state.updates).toBe(0);
    expect(state.events).toHaveLength(0);
  });

  it("opens for a new reply even when an earlier reply has a trusted receipt", async () => {
    state.receipt = mailReceipt();
    state.currentReplyId = 1_950_002;

    await expect(open([reply(1_950_002)])).resolves.toBeUndefined();
    expect(state.updates).toBe(1);
    expect(state.events[0]).toMatchObject({ eventType: "finance_payment_review_opened", payload: { replyEmailId: 1_950_002 } });
  });

  it("opens when the current reply body has changed since the receipt", async () => {
    state.receipt = mailReceipt();
    state.currentReplySha = HASH_B;

    await expect(open()).resolves.toBeUndefined();
    expect(state.updates).toBe(1);
  });

  it.each([
    ["another user", mailReceipt({ userId: 8 })],
    ["another work file", mailReceipt({ workFileId: 20, memoryWorkFileId: 20 })],
    ["an incomplete receipt", mailReceipt({ resultJson: JSON.stringify({ completedNow: false, sourceEmailId: 1_950_001, bodySha256: HASH_A, responseHandling: {} }) })],
    ['another project',mailReceipt({projectId:12})],
    ['a failed dispatch',mailReceipt({dispatchState:'failed'})],
    ['a mismatched output',mailReceipt({workProductId:3_990_002})],
    ['an unreviewed output',mailReceipt({memorySourceStatus:'received'})],
    ['a wrong output lineage',mailReceipt({memorySourceRecordId:'dispatch-review:930002'})],
    ['an invalid response receipt',mailReceipt({resultJson:JSON.stringify({completedNow:true,workProductId:3_990_001,sourceEmailId:1_950_001,bodySha256:HASH_A,responseHandling:{}})})],
  ])("does not suppress from %s", async (_case, untrustedReceipt) => {
    state.receipt = untrustedReceipt;

    await expect(open()).resolves.toBeUndefined();
    expect(state.updates).toBe(1);
  });

  it("accepts only the named completed finance-review event as an alternate trusted receipt", async () => {
    state.financeEvent = financeEventReceipt();

    await expect(open()).resolves.toBe(false);
    expect(state.updates).toBe(0);
  });

  it("never drafts when all matching replies are already reviewed", async () => {
    state.receipt = mailReceipt();
    const sent: FinancePaymentSent = {
      id: plan.sentEmailId,
      userId: plan.userId,
      projectId: plan.projectId,
      workFileId: plan.workFileId,
      workFileStatus: "open",
      mailboxKey: FINANCE_PAYMENT_MAILBOX_KEY,
      folderName: "Sent",
      fromEmail: "a.zaqout@comodevelopments.com",
      toText: "wael@zooma.ae",
      ccText: "shahid@zooma.ae, account.mrt@zooma.ae",
      subject: "Payment request — invoice INV-448",
      bodyText: "Kindly arrange payment for attached invoice INV-448.",
      sentAt: plan.sentAt,
      messageId: "<sent-1110002@comodevelopments.com>",
      action,
    };
    let draftCalls = 0;
    const store: FinancePaymentFollowupStore = {
      isPolicyEnabled: async () => true,
      isInvoicePaidRecorded: async () => false,
      hasFreshCompletedImportAndProcessing: async () => true,
      listCandidates: async () => [sent],
      recordTerminalDisposition: async () => undefined,
      recordPendingWatchExamined: async () => undefined,
      ensureWatchIfAbsent: async () => ({ action, replayed: true }),
      findThreadReplies: async () => ({ replies: [reply()], complete: true }),
      openFinanceReview: input => new DatabaseFinancePaymentFollowupStore().openFinanceReview(input),
      saveThreadDraft: async () => { draftCalls += 1; return { folder: "Drafts", uid: 1, created: true }; },
      completeWatchAfterDraft: async () => undefined,
    };

    const result = await new FinancePaymentFollowupReconciler(store).reconcile({ userId: 7, now: "2026-10-20T08:00:00.000Z", limit: 1 });

    expect(result).toMatchObject({ reviewOpened: 0, draftsPrepared: 0 });
    expect(draftCalls).toBe(0);
    expect(state.updates).toBe(0);
  });
});
