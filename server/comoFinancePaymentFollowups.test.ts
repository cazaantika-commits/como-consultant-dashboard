import { describe, expect, it } from "vitest";
import {
  FINANCE_PAYMENT_MAILBOX_KEY,
  FinancePaymentFollowupReconciler,
  type FinancePaymentAction,
  type FinancePaymentFollowupStore,
  type FinancePaymentPlan,
  type FinancePaymentSent,
  type FinanceThreadReply,
  financePaymentFollowupDraft,
  fourCalendarDaysAfter,
  hasExactFinancePaymentEnvelope,
  isHumanFinanceThreadReply,
  isFinancePaymentRequest,
  normalizeFinanceThreadSubject,
  planFinancePaymentFollowup,
  policyBodySupportsGeneralFinanceFollowup,
} from "./services/comoFinancePaymentFollowups";

const baseSent = (overrides: Partial<FinancePaymentSent> = {}): FinancePaymentSent => ({
  id: 41,
  userId: 7,
  projectId: 11,
  workFileId: 19,
  workFileStatus: "open",
  mailboxKey: FINANCE_PAYMENT_MAILBOX_KEY,
  folderName: "Sent",
  fromEmail: "a.zaqout@comodevelopments.com",
  toText: "Wael <wael@zooma.ae>",
  ccText: "Shahid <shahid@zooma.ae>, account.mrt@zooma.ae",
  subject: "Payment request — invoice INV-448",
  bodyText: "Kindly arrange payment for attached invoice INV-448.",
  sentAt: "2026-10-10 06:00:00",
  messageId: "<sent-41@comodevelopments.com>",
  ...overrides,
});

class FakeFinanceStore implements FinancePaymentFollowupStore {
  policyEnabled = true;
  fresh = true;
  candidates: FinancePaymentSent[] = [];
  replies: FinanceThreadReply[] = [];
  complete = true;
  actions = new Map<string, FinancePaymentAction>();
  terminal = new Map<string, string>();
  reviewCalls: Array<{ action: FinancePaymentAction; plan: FinancePaymentPlan; replies: FinanceThreadReply[] }> = [];
  draftCalls: Array<{ plan: FinancePaymentPlan; sent: FinancePaymentSent; subject: string; body: string }> = [];
  completed: string[] = [];
  examined: Array<{ sentEmailId: number; reason: string }> = [];
  private examinedSequence = new Map<number, number>();

  async isPolicyEnabled() { return this.policyEnabled; }
  async hasFreshCompletedImportAndProcessing() { return this.fresh; }
  async listCandidates(input: { limit: number }) {
    // Mirror the database projection: a completed watch is no longer fresh or
    // pending, while a still-waiting watch reappears as the pending queue.
    const rows = this.candidates.flatMap(sent => {
      const action = this.actions.get(`sent-email-${sent.id}`);
      if (this.terminal.has(`sent-email-${sent.id}`) || action?.actionStatus === "completed_pending_verification" || action?.actionStatus === "verified" || action?.actionStatus === "cancelled") return [];
      return [{ ...sent, action: action ?? null }];
    });
    // Mirror the production pending queue: never-examined watches go first,
    // then the least-recently examined retry, independent of their due time.
    return rows.sort((left, right) => {
      if (!left.action || !right.action) return 0;
      const leftSeen = this.examinedSequence.get(left.id);
      const rightSeen = this.examinedSequence.get(right.id);
      if (leftSeen == null) return rightSeen == null ? 0 : -1;
      if (rightSeen == null) return 1;
      return leftSeen - rightSeen;
    }).slice(0, Math.ceil(input.limit / 2));
  }
  async recordTerminalDisposition(input: { sent: FinancePaymentSent; reason: string }) {
    this.terminal.set(`sent-email-${input.sent.id}`, input.reason);
  }
  async recordPendingWatchExamined(input: { plan: FinancePaymentPlan; reason: string }) {
    this.examined.push({ sentEmailId: input.plan.sentEmailId, reason: input.reason });
    this.examinedSequence.set(input.plan.sentEmailId, this.examined.length);
  }
  async ensureWatchIfAbsent(plan: FinancePaymentPlan) {
    const existing = this.actions.get(plan.sourceRecordId);
    if (existing) return { action: existing, replayed: true };
    const action: FinancePaymentAction = {
      id: this.actions.size + 1, userId: plan.userId, projectId: plan.projectId, workFileId: plan.workFileId, actionStatus: "waiting_external",
    };
    this.actions.set(plan.sourceRecordId, action);
    return { action, replayed: false };
  }
  async findThreadReplies() { return { replies: this.replies, complete: this.complete }; }
  async openFinanceReview(input: { action: FinancePaymentAction; plan: FinancePaymentPlan; replies: FinanceThreadReply[] }) {
    input.action.actionStatus = "open";
    this.reviewCalls.push(input);
  }
  async saveThreadDraft(input: { plan: FinancePaymentPlan; sent: FinancePaymentSent; subject: string; body: string }) {
    this.draftCalls.push(input);
    return { folder: "Drafts", uid: 301, created: this.draftCalls.length === 1 };
  }
  async completeWatchAfterDraft(input: { action: FinancePaymentAction; plan: FinancePaymentPlan }) {
    input.action.actionStatus = "completed_pending_verification";
    this.completed.push(input.plan.sourceRecordId);
  }
}

describe("como finance payment followups", () => {
  it("requires the exact Wael-only To and the two exact finance CC recipients", () => {
    expect(hasExactFinancePaymentEnvelope(baseSent())).toBe(true);
    expect(hasExactFinancePaymentEnvelope(baseSent({ toText: "wael@zooma.ae, other@zooma.ae" }))).toBe(false);
    expect(hasExactFinancePaymentEnvelope(baseSent({ ccText: "shahid@zooma.ae" }))).toBe(false);
  });

  it("classifies only explicit payment requests and excludes quoted/contract boilerplate", () => {
    expect(isFinancePaymentRequest({ bodyText: "يرجى صرف مستحقات الفاتورة المرفقة." })).toBe(true);
    expect(isFinancePaymentRequest({ bodyText: "Please process payment for invoice INV-88." })).toBe(true);
    expect(isFinancePaymentRequest({ bodyText: "Payment request: please review." })).toBe(false);
    expect(isFinancePaymentRequest({ bodyText: "Payments will be made in accordance with the agreement." })).toBe(false);
    expect(isFinancePaymentRequest({ bodyText: "Payments will be processed in accordance with the contract." })).toBe(false);
    expect(isFinancePaymentRequest({ bodyText: "Thanks\n\nOn Tuesday wrote:\nKindly arrange payment for invoice INV-22." })).toBe(false);
    expect(planFinancePaymentFollowup(baseSent({
      bodyText: "Payments will be processed in accordance with the contract.",
    }))).toEqual({ skip: "not_explicit_payment_request" });
  });

  it("recognizes account.mrt replies, but not the retired nasrin sender", () => {
    const sent = baseSent();
    const reply = (fromEmail: string): FinanceThreadReply => ({
      id: 88, fromEmail, subject: "Re: Payment request — invoice INV-448",
      bodyText: "We are reviewing the invoice.", receivedAt: "2026-10-11 08:00:00", linkedWorkFileId: 19,
    });
    expect(isHumanFinanceThreadReply({ sent, reply: reply("account.mrt@zooma.ae") })).toBe(true);
    expect(isHumanFinanceThreadReply({ sent, reply: reply("nasrin@zooma.ae") })).toBe(false);
  });

  it("writes a concise, polite English-only reminder with the complete signature", () => {
    const draft = financePaymentFollowupDraft({ subject: "Payment request — invoice INV-448" });
    expect(draft.subject).toBe("Re: Payment request — invoice INV-448");
    expect(draft.body).toContain("Dear Wael,");
    expect(draft.body).toContain("Could you please provide an update");
    expect(draft.body).toContain("Abdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C.\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com");
    expect(draft.body).not.toMatch(/[\u0600-\u06FF]/);
  });

  it("plans only future configured COMO Sent messages and sets exactly four calendar days", () => {
    const plan = planFinancePaymentFollowup(baseSent());
    expect("plan" in plan).toBe(true);
    if ("plan" in plan) {
      expect(plan.plan.dueAt).toBe("2026-10-14T06:00:00.000Z");
      expect(plan.plan.sourceRecordId).toBe("sent-email-41");
    }
    expect(planFinancePaymentFollowup(baseSent({ sentAt: "2026-10-10 05:23:28" }))).toEqual({ skip: "before_activation" });
    expect(planFinancePaymentFollowup(baseSent({ mailboxKey: "owner-primary" }))).toEqual({ skip: "not_configured_como_sent" });
    expect(planFinancePaymentFollowup(baseSent({ workFileStatus: "closed" }))).toEqual({ skip: "not_active_linked_work_file" });
    expect(fourCalendarDaysAfter("2026-10-10T06:00:00Z")).toBe("2026-10-14T06:00:00.000Z");
  });

  it("requires a current general four-calendar-day policy body", () => {
    expect(policyBodySupportsGeneralFinanceFollowup("قاعدة عامة لكل المشاريع الرسمية: أربعة أيام تقويمية من وقت Sent UTC.")).toBe(true);
    expect(policyBodySupportsGeneralFinanceFollowup("أربعة أيام تقويمية لمشروع واحد فقط.")).toBe(false);
    expect(policyBodySupportsGeneralFinanceFollowup("General rule: three business days.")).toBe(false);
  });

  it("does nothing at all when the owner policy is absent or not current", async () => {
    const store = new FakeFinanceStore();
    store.policyEnabled = false;
    store.candidates = [baseSent()];
    const result = await new FinancePaymentFollowupReconciler(store).reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });
    expect(result).toMatchObject({ examined: 0, created: 0, reviewOpened: 0, draftsPrepared: 0, skipped: ["policy_disabled"] });
    expect(store.actions).toHaveLength(0);
    expect(store.draftCalls).toHaveLength(0);
  });

  it("scans a bounded window and filters it before applying the three-item work cap", async () => {
    const store = new FakeFinanceStore();
    const ordinarySent = (id: number) => baseSent({
      id, subject: `Project update ${id}`, bodyText: "Please find the project update attached.",
    });
    store.candidates = [ordinarySent(1), ordinarySent(2), ordinarySent(3), baseSent({ id: 44 })];

    const result = await new FinancePaymentFollowupReconciler(store).reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });

    expect(result).toMatchObject({ examined: 4, created: 1, draftsPrepared: 1 });
    expect(store.actions.has("sent-email-44")).toBe(true);
    expect(store.draftCalls.map(call => call.plan.sentEmailId)).toEqual([44]);
  });

  it("drains an old fresh-payment backlog across bounded invocations instead of repeatedly preferring later Sent mail", async () => {
    const store = new FakeFinanceStore();
    store.candidates = [101, 102, 103, 104, 105, 106, 107].map((id, index) => baseSent({
      id,
      sentAt: `2026-10-10 ${String(6 + index).padStart(2, "0")}:00:00`,
      subject: `Payment request — invoice INV-${id}`,
      bodyText: `Kindly arrange payment for attached invoice INV-${id}.`,
    }));
    const reconciler = new FinancePaymentFollowupReconciler(store);

    const first = await reconciler.reconcile({ userId: 7, now: "2026-10-15T20:00:00Z", limit: 3 });
    const second = await reconciler.reconcile({ userId: 7, now: "2026-10-15T20:05:00Z", limit: 3 });
    const third = await reconciler.reconcile({ userId: 7, now: "2026-10-15T20:10:00Z", limit: 3 });

    expect(first).toMatchObject({ created: 3, draftsPrepared: 3 });
    expect(second).toMatchObject({ created: 3, draftsPrepared: 3 });
    expect(third).toMatchObject({ created: 1, draftsPrepared: 1 });
    expect(store.draftCalls.map(call => call.plan.sentEmailId)).toEqual([101, 102, 103, 104, 105, 106, 107]);
    expect([...store.actions.values()].every(action => action.actionStatus === "completed_pending_verification")).toBe(true);
  });

  it("records terminal coarse-filter false positives so they cannot starve an older bounded finance backlog", async () => {
    const store = new FakeFinanceStore();
    const falsePositives = Array.from({ length: 30 }, (_, index) => baseSent({
      id: 200 + index,
      toText: `other-${index}@zooma.ae`,
      subject: `Payment request — invoice INV-${index}`,
      bodyText: `Kindly arrange payment for attached invoice INV-${index}.`,
    }));
    const eligible = baseSent({ id: 299, subject: "Payment request — invoice INV-299", bodyText: "Kindly arrange payment for attached invoice INV-299." });
    store.candidates = [...falsePositives, eligible];
    const reconciler = new FinancePaymentFollowupReconciler(store);

    const first = await reconciler.reconcile({ userId: 7, now: "2026-10-15T20:00:00Z" });
    const second = await reconciler.reconcile({ userId: 7, now: "2026-10-15T20:05:00Z" });

    expect(first).toMatchObject({ created: 0, draftsPrepared: 0 });
    expect(store.terminal).toHaveLength(30);
    expect([...store.terminal.values()]).toEqual(Array(30).fill("not_exact_finance_envelope"));
    expect(second).toMatchObject({ created: 1, draftsPrepared: 1 });
    expect(store.draftCalls.map(call => call.plan.sentEmailId)).toEqual([299]);
  });

  it("opens an internal review on a matching human thread reply and never drafts", async () => {
    const store = new FakeFinanceStore();
    const sent = baseSent();
    store.candidates = [sent];
    store.replies = [{
      id: 88, fromEmail: "wael@zooma.ae", subject: "Re: Payment request — invoice INV-448",
      bodyText: "Please hold while we verify the invoice.", receivedAt: "2026-10-11 08:00:00", linkedWorkFileId: 19,
    }];
    const result = await new FinancePaymentFollowupReconciler(store).reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });
    expect(result).toMatchObject({ created: 1, reviewOpened: 1, draftsPrepared: 0 });
    expect(store.reviewCalls).toHaveLength(1);
    expect(store.draftCalls).toHaveLength(0);
    expect(store.actions.get("sent-email-41")?.actionStatus).toBe("open");
  });

  it("does not draft if the bounded reply scan is incomplete or sync freshness is unproven", async () => {
    const incomplete = new FakeFinanceStore();
    incomplete.candidates = [baseSent()];
    incomplete.complete = false;
    const incompleteResult = await new FinancePaymentFollowupReconciler(incomplete).reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });
    expect(incompleteResult.draftsPrepared).toBe(0);
    expect(incompleteResult.skipped).toContainEqual({ sentEmailId: 41, reason: "reply_scan_incomplete" });

    const stale = new FakeFinanceStore();
    stale.candidates = [baseSent()];
    stale.fresh = false;
    const staleResult = await new FinancePaymentFollowupReconciler(stale).reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });
    expect(staleResult.draftsPrepared).toBe(0);
    expect(staleResult.skipped).toContainEqual({ sentEmailId: 41, reason: "mailbox_import_or_processing_not_fresh" });
  });

  it("rotates pending retries past not-due and incomplete watches so a later due watch drafts", async () => {
    const store = new FakeFinanceStore();
    const notDue = baseSent({ id: 501, sentAt: "2026-10-14T06:00:00Z", subject: "Payment request — invoice INV-501" });
    const incomplete = baseSent({ id: 502, sentAt: "2026-10-10T06:00:00Z", subject: "Payment request — invoice INV-502" });
    const due = baseSent({ id: 503, sentAt: "2026-10-10T07:00:00Z", subject: "Payment request — invoice INV-503" });
    store.candidates = [notDue, incomplete, due];
    for (const item of store.candidates) {
      store.actions.set(`sent-email-${item.id}`, {
        id: item.id, userId: item.userId, projectId: item.projectId!, workFileId: item.workFileId!, actionStatus: "waiting_external",
      });
    }
    const originalFind = store.findThreadReplies.bind(store);
    store.findThreadReplies = async plan => plan.sentEmailId === 502
      ? { replies: [], complete: false }
      : originalFind();
    const reconciler = new FinancePaymentFollowupReconciler(store);

    const first = await reconciler.reconcile({ userId: 7, now: "2026-10-15T08:00:00Z", limit: 1 });
    const second = await reconciler.reconcile({ userId: 7, now: "2026-10-15T08:05:00Z", limit: 1 });
    const third = await reconciler.reconcile({ userId: 7, now: "2026-10-15T08:10:00Z", limit: 1 });

    expect(first.skipped).toContainEqual({ sentEmailId: 501, reason: "not_due" });
    expect(second.skipped).toContainEqual({ sentEmailId: 502, reason: "reply_scan_incomplete" });
    expect(third).toMatchObject({ draftsPrepared: 1 });
    expect(store.draftCalls.map(call => call.plan.sentEmailId)).toEqual([503]);
    expect(store.examined).toEqual([
      { sentEmailId: 501, reason: "not_due" },
      { sentEmailId: 502, reason: "reply_scan_incomplete" },
    ]);
  });

  it("creates one idempotent watch and one draft completion without marking payment verified", async () => {
    const store = new FakeFinanceStore();
    store.candidates = [baseSent()];
    const reconciler = new FinancePaymentFollowupReconciler(store);
    const first = await reconciler.reconcile({ userId: 7, now: "2026-10-15T08:00:00Z" });
    const second = await reconciler.reconcile({ userId: 7, now: "2026-10-15T08:05:00Z" });
    expect(first).toMatchObject({ created: 1, draftsPrepared: 1 });
    expect(second).toMatchObject({ created: 0, draftsPrepared: 0 });
    expect(store.actions).toHaveLength(1);
    expect(store.draftCalls).toHaveLength(1);
    expect(store.actions.get("sent-email-41")?.actionStatus).toBe("completed_pending_verification");
  });

  it("normalizes reply prefixes exactly for a same-thread comparison", () => {
    expect(normalizeFinanceThreadSubject(" Re: Fwd: Payment Request — INV-2 ")).toBe("payment request inv 2");
  });
});
