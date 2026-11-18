import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyColumn, SQL } from "drizzle-orm";
import { getTableColumns, getTableName } from "drizzle-orm";
import { MySqlDialect, type MySqlTable } from "drizzle-orm/mysql-core";

const h = vi.hoisted(() => ({ getDb: vi.fn(), saveDraft: vi.fn(), predicates: new WeakMap<SQL, (row: Map<AnyColumn, unknown>) => boolean>() }));
vi.mock("./db", () => ({ getDb: h.getDb }));
vi.mock("./emailMonitor", () => ({ saveComoMailboxDraft: h.saveDraft }));
vi.mock("./storage", () => ({ storageGet: vi.fn(() => { throw new Error("No storage network in regression"); }) }));
vi.mock("./services/comoNextStagedDirectives", () => ({ listWorkFileStagedDirectives: vi.fn(async () => []) }));
vi.mock("./services/comoWorkFileLifecycle", () => ({ readWorkFileLifecycle: vi.fn(async () => []) }));
vi.mock("drizzle-orm", async original => {
  const actual = await original<typeof import("drizzle-orm")>();
  return { ...actual,
    eq(column: AnyColumn, value: unknown) {
      const expr = actual.eq(column, value);
      h.predicates.set(expr, row => row.get(column) === value);
      return expr;
    },
    and(...conditions: (SQL | undefined)[]) {
      const expr = actual.and(...conditions);
      if (expr) h.predicates.set(expr, row => conditions.every(condition => !condition || h.predicates.get(condition)?.(row) === true));
      return expr;
    },
  };
});

import { comoAppOwnerIdentity, comoNextActions, comoNextCommunications, comoNextDecisions, comoNextIntakeProposals, comoNextProjectAccess, comoNextWorkFileEvents, comoNextWorkFiles, comoNextWorkMemory, projects, users } from "../drizzle/schema";
import { assertActionTransition, changeActionStatusCommand, createCommunicationDraftCommand, recordCommunicationSentCommand, resolveDecisionCommand, reviewCommunicationDraftCommand, updateCommunicationDraftCommand, type ComoNextActionStatus } from "./services/comoNextCommands";
import { createIntakeProposalsCommand, requireBoundSaraOwnerUserId, resolveOwnerUserIdForSara, reviewIntakeProposalCommand, type IntakeProposalKind } from "./services/comoNextIntake";
import { buildComoKitchenSendEvidenceProjection, extractComoSendEvidenceEventLinks, projectComoKitchenSendEvidence, selectAcceptedComoSendEvidenceRows } from "./services/comoKitchenSendEvidence";
import { presentSaraWorkFileGoal, readExecutiveWorkFile } from "./services/saraWorkFileReader";

type Row = Record<string, unknown>;
const dialect = new MySqlDialect();
function fixtureDatabase() {
  const store = new Map<MySqlTable, Row[]>();
  const records = (table: MySqlTable) => { if (!store.has(table)) store.set(table, []); return store.get(table)!; };
  records(projects).push({ id: 6, userId: 1, name: "Official", isTestProject: 0 });
  records(comoNextWorkFiles).push({ id: 13, projectId: 6, userId: 1, workFileStatus: "open", title: "Work", desiredOutcome: "Goal" });
  const columnRow = (table: MySqlTable, row: Row) => new Map<AnyColumn, unknown>(Object.entries(getTableColumns(table)).map(([key, column]) => [column, row[key]]));
  const matches = (table: MySqlTable, row: Row, condition?: SQL) => {
    if (!condition) return true;
    const predicate = h.predicates.get(condition);
    if (!predicate) throw new Error("Unsupported fixture predicate");
    return predicate(columnRow(table, row));
  };
  const select = vi.fn((selection?: Record<string, AnyColumn>) => {
    let table: MySqlTable, condition: SQL | undefined, count = Infinity;
    const results = () => records(table).filter(row => matches(table, row, condition)).slice(0, count).map(row => selection
      ? Object.fromEntries(Object.entries(selection).map(([key, column]) => [key, columnRow(table, row).get(column)])) : { ...row });
    const query = {
      from(value: MySqlTable) { table = value; return query; },
      where(value: SQL) { condition = value; return query; },
      limit(value: number) { count = value; return query; },
      for(value: string) { if (value !== "update") throw new Error("Unexpected lock"); return query; },
      then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(results()).then(resolve, reject); },
    };
    return query;
  });
  const insert = vi.fn((table: MySqlTable) => ({ values: async (value: Row) => {
    const id = Math.max(500, ...records(table).map(row => Number(row.id))) + 1;
    records(table).push({ id, ...value }); return [{ insertId: id }];
  } }));
  let race: ((table: MySqlTable) => void) | undefined;
  const update = vi.fn((table: MySqlTable) => ({ set: (changes: Row) => ({ where: async (condition: SQL) => {
    race?.(table); race = undefined;
    const targets = records(table).filter(row => matches(table, row, condition));
    targets.forEach(row => Object.assign(row, changes)); return [{ affectedRows: targets.length }];
  } }) }));
  const execute = vi.fn(async (query: SQL) => {
    const { sql: text, params } = dialect.sqlToQuery(query);
    if (/SELECT id FROM como_next_work_files .*FOR UPDATE/i.test(text)) return [[{ id: 13 }], []];
    if (/SELECT id FROM como_next_work_file_events/i.test(text)) {
      return [records(comoNextWorkFileEvents).filter(row => row.userId === params[0] && row.idempotencyKey === params[1]), []];
    }
    if (/SELECT sequence_no/i.test(text)) return [[{ sequenceNo: records(comoNextWorkFileEvents).length }], []];
    if (/FROM como_next_work_files wf/.test(text)) {
      const file = records(comoNextWorkFiles).find(row => row.id === params[0] && row.userId === params[1]);
      const project = records(projects).find(row => row.id === file?.projectId && row.userId === params[2] && row.isTestProject === 0);
      return [file && project ? [{ ...file, workFileId: file.id, desiredOutcomeCharacters: String(file.desiredOutcome).length }] : [], []];
    }
    if (/^\s*SELECT/i.test(text)) return [[], []];
    throw new Error("Only fixture SELECT allowed");
  });
  let gate = Promise.resolve();
  const tx = { select, insert, update, execute, rollback: () => { throw new Error("explicit rollback"); } };
  const transaction = vi.fn(async <T>(callback: (inner: typeof tx) => Promise<T>) => {
    const previous = gate; let release!: () => void;
    gate = new Promise<void>(resolve => { release = resolve; }); await previous;
    const snapshot = new Map(Array.from(store.entries()).map(([table, rows]) => [table, structuredClone(rows)]));
    try { return await callback(tx); }
    catch (error) { store.clear(); snapshot.forEach((rows, table) => store.set(table, rows)); throw error; }
    finally { release(); }
  });
  return { ...tx, transaction, records, setRace: (callback: (table: MySqlTable) => void) => { race = callback; } };
}
let db: ReturnType<typeof fixtureDatabase>;
const action = (status = "open") => ({ id: 501, projectId: 6, workFileId: 13, userId: 1, actionStatus: status, title: "Action", evidenceReference: "old-proof", completedAt: null, verifiedAt: null });
const proposal = (kind: IntakeProposalKind) => ({ id: 401, projectId: 6, workFileId: 13, userId: 1, proposalKind: kind, sourceKind: "email", sourceRecordId: "source:1", title: "Proposal", content: "Reviewed content", acceptanceCriteria: "Verify receipt", ownerType: "human", priority: "normal", dueAt: null, channel: "internal", toText: null, evidenceExcerpt: "Source only", reviewStatus: "pending", targetId: null });
beforeEach(() => { vi.clearAllMocks(); db = fixtureDatabase(); h.getDb.mockResolvedValue(db); h.saveDraft.mockResolvedValue({ folder: "Drafts", uid: 1036, created: true, observedInSent: false }); });

describe("actual command cancellation/CAS behavior", () => {
  it.each(["open", "in_progress", "waiting_external", "completed_pending_verification", "verified"] as const)("cancelled cannot transition to %s", async nextStatus => {
    db.records(comoNextActions).push(action("cancelled"));
    await expect(changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus, actorType: "system", evidenceReference: "proof" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.update).not.toHaveBeenCalled(); expect(db.insert).not.toHaveBeenCalled();
  });
  it("cancelled replay is a no-op preserving evidence and no event", async () => {
    db.records(comoNextActions).push(action("cancelled"));
    await expect(changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "cancelled" })).resolves.toMatchObject({ replayed: true });
    expect(db.update).not.toHaveBeenCalled(); expect(db.records(comoNextActions)[0].evidenceReference).toBe("old-proof");
  });
  it("actual old-status predicate detects a race and never appends a success event", async () => {
    db.records(comoNextActions).push(action());
    db.setRace(table => { if (table === comoNextActions) db.records(table)[0].actionStatus = "cancelled"; });
    await expect(changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "in_progress" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("serialized competing changes never reopen a committed cancellation", async () => {
    db.records(comoNextActions).push(action());
    const results = await Promise.allSettled([changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "cancelled" }), changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "in_progress" })]);
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(db.records(comoNextActions)[0].actionStatus).toBe("cancelled");
    expect(db.records(comoNextWorkFileEvents)).toHaveLength(1);
  });
  it.each(["closed", "cancelled"])("does not reactivate a child of %s work file", async status => {
    db.records(comoNextWorkFiles)[0].workFileStatus = status; db.records(comoNextActions).push(action());
    await expect(changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "in_progress" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("requires verification evidence, rejects unknown statuses, denies unknown project", async () => {
    db.records(comoNextActions).push(action("completed_pending_verification"));
    await expect(changeActionStatusCommand({ userId: 1, actionId: 501, nextStatus: "verified", evidenceReference: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(() => assertActionTransition("bogus" as ComoNextActionStatus, "bogus" as ComoNextActionStatus)).toThrow("غير معروفة");
    await expect(changeActionStatusCommand({ userId: 99, actionId: 501, nextStatus: "cancelled" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeActionStatusCommand({ userId: 1, actionId: 999, nextStatus: "cancelled" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("atomic review and typed intake target", () => {
  it.each(["action", "decision", "note", "communication_draft"] as const)("only actual action kind enters actionIds: %s", async kind => {
    db.records(comoNextIntakeProposals).push(proposal(kind));
    const result = await reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" });
    expect(result.target).toMatchObject({ kind, projectId: 6, workFileId: 13, id: 501 });
    expect(result.actionIds).toEqual(kind === "action" ? [501] : []);
    expect(result.targetId).toBe(kind === "action" ? 501 : null);
    expect(db.transaction).toHaveBeenCalledTimes(1); expect(h.saveDraft).not.toHaveBeenCalled();
    const replay = await reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply", content: "new payload" });
    expect(replay.replayed).toBe(true); expect(replay.actionIds).toEqual([]);
    expect(replay.targetId).toBeNull();
    expect(db.records(comoNextWorkFileEvents).filter(row => row.eventType === "intake_proposal_applied")).toHaveLength(1);
  });
  it("apply/dismiss race produces one persisted judgement and one target", async () => {
    db.records(comoNextIntakeProposals).push(proposal("note"));
    const results = await Promise.all([reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "dismiss" }), reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" })]);
    expect(results.map(row => row.replayed)).toEqual([false, true]);
    expect(db.records(comoNextWorkMemory)).toHaveLength(0); expect(db.records(comoNextWorkFileEvents)).toHaveLength(1);
    expect(db.records(comoNextIntakeProposals)[0].reviewStatus).toBe("dismissed");
  });
  it("losing review CAS rolls back target and its creation event", async () => {
    db.records(comoNextIntakeProposals).push(proposal("action"));
    db.setRace(table => { if (table === comoNextIntakeProposals) db.records(table)[0].reviewStatus = "dismissed"; });
    await expect(reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.records(comoNextActions)).toEqual([]); expect(db.records(comoNextWorkFileEvents)).toEqual([]);
  });
  it("duplicate source returns existing pending proposal without promoting it", async () => {
    const input = { userId: 1, projectId: 6, workFileId: 13, sourceKind: "email" as const, sourcePrefix: "same-source", proposals: [{ kind: "note" as const, title: "Note", evidenceExcerpt: "Evidence" }] };
    await createIntakeProposalsCommand(input); const repeat = await createIntakeProposalsCommand(input);
    expect(repeat).toMatchObject({ created: 0, duplicates: 1 }); expect(db.records(comoNextIntakeProposals)).toHaveLength(1);
    expect(db.records(comoNextIntakeProposals)[0]).toMatchObject({ reviewStatus: "pending" }); expect(h.saveDraft).not.toHaveBeenCalled();
  });
  it("rejects outsider/unknown proposal and closed file before target creation", async () => {
    db.records(comoNextIntakeProposals).push(proposal("note"));
    await expect(reviewIntakeProposalCommand({ userId: 99, proposalId: 401, decision: "apply" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reviewIntakeProposalCommand({ userId: 1, proposalId: 999, decision: "apply" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    db.records(comoNextWorkFiles)[0].workFileStatus = "closed";
    await expect(reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("rejects a duplicate source bound to a different work file", async () => {
    db.records(comoNextIntakeProposals).push({ ...proposal("note"), workFileId: 99, sourceRecordId: "same:1" });
    await expect(createIntakeProposalsCommand({ userId: 1, projectId: 6, workFileId: 13, sourceKind: "email", sourcePrefix: "same", proposals: [{ kind: "note", title: "Note", evidenceExcerpt: "Evidence" }] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("email target commits with judgement before mailbox I/O; saved is not sent", async () => {
    db.records(comoNextIntakeProposals).push({ ...proposal("communication_draft"), channel: "email" });
    h.saveDraft.mockImplementation(async () => {
      expect(db.records(comoNextIntakeProposals)[0].reviewStatus).toBe("applied");
      expect(db.records(comoNextWorkFileEvents).some(row => row.eventType === "intake_proposal_applied")).toBe(true);
      return { folder: "Drafts", uid: 1036, created: true, observedInSent: false };
    });
    const result = await reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" });
    expect(result).toMatchObject({ targetKind: "communication_draft", actionIds: [], mailboxWrite: true, sent: false, externalSideEffect: false });
    expect(db.records(comoNextCommunications)[0]).toMatchObject({ communicationStatus: "archived", sentAt: null });
  });
  it("mailbox failure retains atomic target/judgement and retry uses saved text only", async () => {
    db.records(comoNextIntakeProposals).push({ ...proposal("communication_draft"), channel: "email" });
    h.saveDraft.mockRejectedValueOnce(new Error("mocked ambiguous mailbox observation"));
    await expect(reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply" })).rejects.toThrow("mocked ambiguous");
    expect(db.records(comoNextIntakeProposals)[0].reviewStatus).toBe("applied");
    expect(db.records(comoNextCommunications)).toHaveLength(1);
    const retry = await reviewIntakeProposalCommand({ userId: 1, proposalId: 401, decision: "apply", content: "attempted overwrite" });
    expect(retry).toMatchObject({ replayed: true, actionIds: [], sent: false });
    expect(db.records(comoNextCommunications)).toHaveLength(1);
    expect(h.saveDraft.mock.calls[1][0].body).toBe("Reviewed content");
    expect(db.records(comoNextWorkFileEvents).filter(row => row.eventType === "intake_proposal_applied")).toHaveLength(1);
  });
});

describe("locked decisions and draft boundaries", () => {
  it.each(["approved", "rejected", "superseded"])("does not resolve %s decision twice", async status => {
    db.records(comoNextDecisions).push({ id: 601, projectId: 6, workFileId: 13, decisionStatus: status });
    await expect(resolveDecisionCommand({ userId: 1, decisionId: 601, nextStatus: "approved", decisionAuthority: "abdulrahman", decisionText: "Decision" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it.each(["archived", "cancelled", "sent", "approved_for_send"])("does not edit or approve %s communication", async status => {
    db.records(comoNextCommunications).push({ id: 601, projectId: 6, workFileId: 13, communicationStatus: status, approvalStatus: "pending" });
    await expect(updateCommunicationDraftCommand({ userId: 1, communicationId: 601, subject: "New", body: "New", toText: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(reviewCommunicationDraftCommand({ userId: 1, communicationId: 601, decision: "approve" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.update).not.toHaveBeenCalled(); expect(h.saveDraft).not.toHaveBeenCalled();
  });
  it("approval race cannot overwrite cancellation", async () => {
    db.records(comoNextCommunications).push({ id: 601, projectId: 6, workFileId: 13, communicationStatus: "draft", approvalStatus: "pending" });
    db.setRace(table => { db.records(table)[0].communicationStatus = "cancelled"; });
    await expect(reviewCommunicationDraftCommand({ userId: 1, communicationId: 601, decision: "approve" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("sent/cancelled producer replay never calls mailbox", async () => {
    for (const status of ["cancelled", "sent"]) {
      db.records(comoNextCommunications).splice(0, Infinity, { id: 601, projectId: 6, workFileId: 13, sourceSystem: "como_next", sourceRecordId: "same", communicationStatus: status });
      const call = createCommunicationDraftCommand({ userId: 1, workFileId: 13, channel: "email", subject: "Old", body: "Old", idempotencyKey: "same" });
      if (status === "cancelled") await expect(call).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      else await expect(call).resolves.toMatchObject({ mailboxWrite: false, sent: false, observedInSent: true });
    }
    expect(h.saveDraft).not.toHaveBeenCalled();
  });
  it("cannot record sent with no evidence or locked approval", async () => {
    db.records(comoNextCommunications).push({ id: 601, projectId: 6, workFileId: 13, communicationStatus: "approved_for_send", approvalStatus: "approved" });
    await expect(recordCommunicationSentCommand({ userId: 1, communicationId: 601, evidenceReference: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    db.records(comoNextCommunications)[0].communicationStatus = "cancelled";
    await expect(recordCommunicationSentCommand({ userId: 1, communicationId: 601, evidenceReference: "Sent UID 1" })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(db.update).not.toHaveBeenCalled();
  });
});

describe("fail-closed send event types and source-specific historic proof", () => {
  it.each([undefined, "decision_recorded", "noc_approved", "mail_review_completed", "executive_directive_completed", "unknown_sent_type"])("ignores non-send raw event %s even with IDs", async eventType => {
    const row = { eventType, eventActionId: 501, payloadActionId: 501, communicationId: 601 };
    expect(selectAcceptedComoSendEvidenceRows([row])).toEqual([]);
    db.execute.mockResolvedValueOnce([[row], []]);
    const result = await projectComoKitchenSendEvidence({ userId: 1, actions: [{ id: 501, userId: 1, projectId: 6, workFileId: 13, title: "Review", actionStatus: "open" }] });
    expect(result.actions[0].actionStatus).toBe("open"); expect(db.execute).toHaveBeenCalledTimes(1);
  });
  it("retains documented historical sender link without changing the finance audit action", () => {
    const rows = selectAcceptedComoSendEvidenceRows([{ eventType: "bank_debit_advice_reviewed", eventActionId: 900001, humanActionId: 501, communicationDraftId: 601 }]);
    expect(extractComoSendEvidenceEventLinks(rows)).toEqual([{ actionId: 501, communicationId: 601 }]);
    expect(selectAcceptedComoSendEvidenceRows([{ eventType: "bank_debit_advice_reviewed", eventActionId: 900001, communicationDraftId: 601 }])).toEqual([]);
  });
  it("draft-prepared receipt links only its sender, never the report action", () => {
    expect(extractComoSendEvidenceEventLinks([{ eventType: "report_followup_draft_prepared", eventActionId: 900001, nextActionId: 501, communicationId: 601 }])).toEqual([{ actionId: 501, communicationId: 601 }]);
    expect(extractComoSendEvidenceEventLinks([{ eventType: "report_followup_draft_prepared", eventActionId: 900001, communicationId: 601 }])).toEqual([]);
    expect(extractComoSendEvidenceEventLinks([{ eventType: "communication_sent_source_reconciled", eventActionId: 501, communicationId: 601, humanActionId: "bad-id" }])).toEqual([]);
    expect(extractComoSendEvidenceEventLinks([{ eventType: "mail_review_completed", eventActionId: 501, communicationId: 601 }])).toEqual([]);
  });
  it.each([true, false, "1e3", " 601", "0601", "601.0", 0, -1, NaN, Number.MAX_SAFE_INTEGER + 1])("invalid structured ID fails closed: %s", communicationId => {
    expect(extractComoSendEvidenceEventLinks([{ eventType: "communication_sent_source_reconciled", eventActionId: 501, communicationId }])).toEqual([]);
  });
  it("even an accepted sent event cannot turn an archived saved draft into Sent", () => {
    const original = { id: 501, userId: 1, projectId: 6, workFileId: 13, title: "Send", ownerType: "human", actionStatus: "open" };
    const events = extractComoSendEvidenceEventLinks(selectAcceptedComoSendEvidenceRows([{ eventType: "communication_sent_source_reconciled", eventActionId: 501, communicationId: 601 }]));
    const result = buildComoKitchenSendEvidenceProjection({ actions: [original], events, communications: [{ id: 601, userId: 1, projectId: 6, workFileId: 13, channel: "email", direction: "outbound", communicationStatus: "archived", evidenceReference: "Drafts UID 1036", externalMessageRef: null }], ledgers: [{ id: 701, userId: 1, projectId: 6, workFileId: 13, communicationId: 601, state: "draft_saved", sentFolder: null, sentUid: null }], sentMessages: [] });
    expect(result.actions[0]).toEqual(original); expect(result.diagnostics).toEqual([]);
  });
});

describe("Sara bound owner and bounded read-only source", () => {
  it("accepts only the provisioned exact active admin identity", () => {
    const binding = { userId: 1, openId: "bound", isActive: 1 };
    expect(requireBoundSaraOwnerUserId(binding, { id: 1, openId: "bound", role: "admin" })).toBe(1);
    for (const candidate of [null, { id: 2, openId: "bound", role: "admin" }, { id: 1, openId: "other", role: "admin" }, { id: 1, openId: "bound", role: "user" }]) expect(() => requireBoundSaraOwnerUserId(binding, candidate)).toThrow();
    expect(() => requireBoundSaraOwnerUserId({ ...binding, isActive: 0 }, { id: 1, openId: "bound", role: "admin" })).toThrow();
    expect(() => requireBoundSaraOwnerUserId(null, { id: 1, openId: "bound", role: "admin" })).toThrow();
  });
  it("resolver refuses admin-only fallback and wrong member before DB", async () => {
    db.records(users).push({ id: 1, openId: "admin", role: "admin" });
    await expect(resolveOwnerUserIdForSara("abdulrahman")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    h.getDb.mockClear(); await expect(resolveOwnerUserIdForSara("salwa")).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(h.getDb).not.toHaveBeenCalled();
  });
  it("reader refuses a project not owned by the bound account and performs no relay", async () => {
    db.records(comoAppOwnerIdentity).push({ id: 1, userId: 1, openId: "bound", isActive: 1 }); db.records(users).push({ id: 1, openId: "bound", role: "admin" });
    db.records(projects)[0].userId = 2;
    await expect(readExecutiveWorkFile({ memberId: "abdulrahman", nameAr: "Owner", role: "owner" }, '{"work_file_id":13}')).resolves.toMatchObject({ found: false });
    expect(db.insert).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled(); expect(h.saveDraft).not.toHaveBeenCalled();
  });
  it("bounds the returned view and marks source/history boundaries without mutation", () => {
    const file = { desiredOutcome: "x".repeat(35_994) };
    const view = presentSaraWorkFileGoal(file);
    expect(view.desiredOutcome).toHaveLength(4000); expect(file.desiredOutcome).toHaveLength(35_994);
    expect(view.desiredOutcomeView).toMatchObject({ truncated: true, sourceUnchanged: true, sourceCharacters: 35_994 });
    expect(presentSaraWorkFileGoal({ desiredOutcome: "Goal" }).desiredOutcomeView.truncated).toBe(false);
  });
});
