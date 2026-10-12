import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
  comoNextStagedDirectives,
  comoNextWorkFileEvents,
  comoNextWorkFileUpdates,
  comoNextWorkFiles,
  comoNextWorkMemory,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { appendEvent, requireProjectAccess } from "./comoNextCommands";
import {
  assertDirectiveNotPreviouslyExecuted,
  claimSubmittingAndQueueManusDispatch,
  deliverQueuedManusDispatch,
  readDispatchesForUser,
  readDispatchForDirective,
  recoverDispatchFromAppliedReceipt,
} from "./comoManusDispatch";

type DirectiveSource = "sara" | "manual";
type DirectiveStatus = "pending" | "submitting" | "submitted" | "cancelled" | "failed";

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function asNumber(value: unknown) {
  return value == null ? null : Number(value);
}

function parseResult(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
}

function publicDirective(row: typeof comoNextStagedDirectives.$inferSelect, dispatch?: unknown) {
  const receipt = parseResult(row.resultJson);
  return {
    id: Number(row.id),
    source: row.source,
    sourceMemberId: row.sourceMemberId,
    status: row.status,
    directiveText: row.directiveText,
    actionId: asNumber(row.actionId),
    currentDecisionId: asNumber(row.currentDecisionId),
    updateId: asNumber(row.updateId),
    communicationDraftId: asNumber(row.communicationDraftId),
    mailboxDraftRef: row.mailboxDraftRef,
    workProductId: asNumber(row.workProductId),
    executionSummary: row.executionSummary,
    failureMessage: row.failureMessage,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    receipt,
    dispatch: dispatch || null,
  };
}

async function loadAuthorizedWorkFile(userId: number, workFileId: number, required: "read" | "write") {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select({
    id: comoNextWorkFiles.id,
    projectId: comoNextWorkFiles.projectId,
    status: comoNextWorkFiles.workFileStatus,
    title: comoNextWorkFiles.title,
  }).from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف الموضوع" });
  await requireProjectAccess(db, workFile.projectId, userId, required);
  if (required === "write" && ["closed", "cancelled"].includes(workFile.status)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن توجيه Manus داخل ملف مغلق" });
  }
  return { db, workFile };
}

async function assertScopedReferences(input: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  projectId: number;
  workFileId: number;
  actionId?: number | null;
  currentDecisionId?: number | null;
}) {
  if (input.actionId) {
    const [action] = await input.db.select({ id: comoNextActions.id }).from(comoNextActions)
      .where(and(
        eq(comoNextActions.id, input.actionId),
        eq(comoNextActions.projectId, input.projectId),
        eq(comoNextActions.workFileId, input.workFileId),
      )).limit(1);
    if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "الإجراء لا يتبع ملف الموضوع" });
  }
  if (input.currentDecisionId) {
    const [decision] = await input.db.select({ id: comoNextDecisions.id }).from(comoNextDecisions)
      .where(and(
        eq(comoNextDecisions.id, input.currentDecisionId),
        eq(comoNextDecisions.projectId, input.projectId),
        eq(comoNextDecisions.workFileId, input.workFileId),
      )).limit(1);
    if (!decision) throw new TRPCError({ code: "NOT_FOUND", message: "القرار لا يتبع ملف الموضوع" });
  }
}

export async function stageExecutiveDirectiveCommand(input: {
  userId: number;
  workFileId: number;
  directiveText: string;
  source: DirectiveSource;
  sourceMemberId?: string | null;
  actionId?: number | null;
  currentDecisionId?: number | null;
  stageKey: string;
}) {
  const { db, workFile } = await loadAuthorizedWorkFile(input.userId, input.workFileId, "write");
  await assertScopedReferences({ db, projectId: workFile.projectId, workFileId: workFile.id, actionId: input.actionId, currentDecisionId: input.currentDecisionId });
  const text = input.directiveText.trim();
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب التوجيه أولًا" });

  return db.transaction(async tx => {
    const [existing] = await tx.select().from(comoNextStagedDirectives)
      .where(and(eq(comoNextStagedDirectives.userId, input.userId), eq(comoNextStagedDirectives.stageKey, input.stageKey)))
      .limit(1);
    if (existing) return { directive: publicDirective(existing), replayed: true as const };

    const result = await tx.insert(comoNextStagedDirectives).values({
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actionId: input.actionId || null,
      currentDecisionId: input.currentDecisionId || null,
      source: input.source,
      sourceMemberId: input.sourceMemberId?.trim() || null,
      stageKey: input.stageKey,
      directiveText: text,
      status: "pending",
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actionId: input.actionId || null,
      actorType: input.source === "sara" ? "system" : "human",
      actorUserId: input.source === "sara" ? null : input.userId,
      eventType: "executive_directive_staged",
      summary: `${input.source === "sara" ? "سارة سجلت" : "حُفظ"} توجيهًا لمراجعة المالك قبل تسليمه إلى Manus`,
      payload: { stagedDirectiveId: id, externalSideEffect: false },
      idempotencyKey: `staged-directive:${input.stageKey}`.slice(0, 128),
    });
    const [directive] = await tx.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id, id)).limit(1);
    if (!directive) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ التوجيه للمراجعة" });
    return { directive: publicDirective(directive), replayed: false as const };
  });
}

export async function listWorkFileStagedDirectives(input: { userId: number; workFileId: number; includeHistory?: boolean }) {
  const { db } = await loadAuthorizedWorkFile(input.userId, input.workFileId, "read");
  const activeStatuses: DirectiveStatus[] = ["pending", "submitting", "failed"];
  const active = await db.select().from(comoNextStagedDirectives)
    .where(and(
      eq(comoNextStagedDirectives.userId, input.userId),
      eq(comoNextStagedDirectives.workFileId, input.workFileId),
      inArray(comoNextStagedDirectives.status, activeStatuses),
    ))
    .orderBy(desc(comoNextStagedDirectives.updatedAt), desc(comoNextStagedDirectives.id))
    .limit(100);
  if (!input.includeHistory) {
    const dispatches = await readDispatchesForUser({ userId: input.userId, directiveIds: active.map(row => Number(row.id)) });
    const byDirectiveId = new Map(dispatches.map(dispatch => [dispatch.directiveId, dispatch]));
    return active.map(row => publicDirective(row, byDirectiveId.get(Number(row.id))));
  }
  const delivered = await db.select().from(comoNextStagedDirectives)
    .where(and(
      eq(comoNextStagedDirectives.userId, input.userId),
      eq(comoNextStagedDirectives.workFileId, input.workFileId),
      eq(comoNextStagedDirectives.status, "submitted"),
    ))
    .orderBy(desc(comoNextStagedDirectives.submittedAt), desc(comoNextStagedDirectives.id))
    .limit(4);
  const directives = [...active, ...delivered];
  const dispatches = await readDispatchesForUser({ userId: input.userId, directiveIds: directives.map(row => Number(row.id)) });
  const byDirectiveId = new Map(dispatches.map(dispatch => [dispatch.directiveId, dispatch]));
  return directives.map(row => publicDirective(row, byDirectiveId.get(Number(row.id))));
}

export async function updateStagedExecutiveDirectiveCommand(input: { userId: number; directiveId: number; directiveText: string }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [directive] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!directive) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  await loadAuthorizedWorkFile(input.userId, Number(directive.workFileId), "write");
  if (!["pending", "failed"].includes(directive.status)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تعديل نص تم تسليمه إلى Manus" });
  }
  await assertDirectiveNotPreviouslyExecuted({ userId: input.userId, directiveId: input.directiveId });
  const text = input.directiveText.trim();
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب التوجيه أولًا" });
  await db.update(comoNextStagedDirectives).set({
    directiveText: text,
    status: "pending",
    failureMessage: null,
    submissionClaimedAt: null,
  }).where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, input.userId), inArray(comoNextStagedDirectives.status, ["pending", "failed"])));
  const [updated] = await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id, directive.id)).limit(1);
  if (!updated || updated.directiveText !== text || updated.status !== "pending") {
    throw new TRPCError({ code: "CONFLICT", message: "تغيّرت حالة التوجيه قبل حفظ تعديلك؛ لم يُسلَّم النص المعدّل إلى Manus" });
  }
  return publicDirective(updated);
}

export async function cancelStagedExecutiveDirectiveCommand(input: { userId: number; directiveId: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [directive] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!directive) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  await loadAuthorizedWorkFile(input.userId, Number(directive.workFileId), "write");
  if (!["pending", "failed"].includes(directive.status)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إلغاء توجيه تم تسليمه إلى Manus" });
  }
  await assertDirectiveNotPreviouslyExecuted({ userId: input.userId, directiveId: input.directiveId });
  await db.update(comoNextStagedDirectives).set({ status: "cancelled", failureMessage: null })
    .where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, input.userId), inArray(comoNextStagedDirectives.status, ["pending", "failed"])));
  return { id: Number(directive.id), status: "cancelled" as const };
}

export async function submitStagedExecutiveDirectiveCommand(input: { userId: number; directiveId: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [initial] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!initial) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  await loadAuthorizedWorkFile(input.userId, Number(initial.workFileId), "write");

  if (initial.status === "submitted") {
    const dispatch = await readDispatchForDirective({ directiveId: input.directiveId });
    return { directive: publicDirective(initial, dispatch), dispatch, replayed: true as const };
  }
  if (["failed", "submitting"].includes(initial.status)) {
    const recovered = await recoverDispatchFromAppliedReceipt(input);
    if (recovered) {
      const [updated] = await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id, initial.id)).limit(1);
      return { directive: publicDirective(updated, recovered), dispatch: recovered, replayed: true as const };
    }
  }
  const claimed = await claimSubmittingAndQueueManusDispatch({
    directiveId: input.directiveId,
    userId: input.userId,
    workFileId: Number(initial.workFileId),
  });
  if (claimed.kind === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  if (claimed.kind === "not_submittable") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "هذا التوجيه لم يعد قابلًا للتسليم" });
  }
  if (claimed.kind === "delivery_unknown") {
    throw new TRPCError({ code: "CONFLICT", message: "تعذر تأكيد التسليم السابق إلى Manus؛ لن نعيد المحاولة تلقائيًا" });
  }

  const dispatch = claimed.shouldDeliver
    ? await deliverQueuedManusDispatch({ directiveId: input.directiveId })
    : claimed.dispatch;
  const [directive] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!directive) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  return {
    directive: publicDirective(directive, dispatch),
    dispatch,
    replayed: claimed.kind !== "queued",
  };
}
