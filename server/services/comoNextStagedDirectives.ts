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
import { executeExecutiveDirectiveCommand } from "./comoNextExecutiveDirectives";
import { runExecutiveControlLoopCommand } from "./comoNextExecutiveControl";

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

function publicDirective(row: typeof comoNextStagedDirectives.$inferSelect) {
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
  if (!input.includeHistory) return active.map(publicDirective);
  const delivered = await db.select().from(comoNextStagedDirectives)
    .where(and(
      eq(comoNextStagedDirectives.userId, input.userId),
      eq(comoNextStagedDirectives.workFileId, input.workFileId),
      eq(comoNextStagedDirectives.status, "submitted"),
    ))
    .orderBy(desc(comoNextStagedDirectives.submittedAt), desc(comoNextStagedDirectives.id))
    .limit(4);
  return [...active, ...delivered].map(publicDirective);
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
  await db.update(comoNextStagedDirectives).set({ status: "cancelled", failureMessage: null })
    .where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, input.userId), inArray(comoNextStagedDirectives.status, ["pending", "failed"])));
  return { id: Number(directive.id), status: "cancelled" as const };
}

async function recoverAppliedSubmission(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, directive: typeof comoNextStagedDirectives.$inferSelect) {
  const idempotencyKey = `staged-directive:${directive.id}`;
  const [event] = await db.select({ payloadJson: comoNextWorkFileEvents.payloadJson }).from(comoNextWorkFileEvents)
    .where(eq(comoNextWorkFileEvents.idempotencyKey, idempotencyKey)).limit(1);
  let updateId = 0;
  try { updateId = Number(JSON.parse(String(event?.payloadJson || "{}")).updateId || 0); } catch { /* no completed update to recover */ }
  if (!updateId) return null;
  const [update] = await db.select().from(comoNextWorkFileUpdates)
    .where(and(eq(comoNextWorkFileUpdates.id, updateId), eq(comoNextWorkFileUpdates.userId, directive.userId))).limit(1);
  if (!update || update.analysisStatus !== "applied") return null;
  const sourceRecordId = `executive-directive:${updateId}`;
  const [workProduct] = await db.select({ id: comoNextWorkMemory.id }).from(comoNextWorkMemory)
    .where(and(eq(comoNextWorkMemory.sourceSystem, "como_directive"), eq(comoNextWorkMemory.sourceRecordId, sourceRecordId))).limit(1);
  const [communication] = await db.select({ id: comoNextCommunications.id, externalMessageRef: comoNextCommunications.externalMessageRef })
    .from(comoNextCommunications)
    .where(and(eq(comoNextCommunications.sourceSystem, "como_next"), eq(comoNextCommunications.sourceRecordId, `executive-directive-email-draft:${updateId}`)))
    .limit(1);
  const receipt = {
    updateId,
    acknowledgement: "استعيد إيصال تسليم مكتمل.",
    executionSummary: update.analysisSummary || "اكتملت المعالجة الداخلية وحُفظت في الملف.",
    workProductId: workProduct ? Number(workProduct.id) : null,
    communicationDraftId: communication ? Number(communication.id) : null,
    mailboxDraftRef: communication?.externalMessageRef || null,
    nextActionId: update.targetActionId ? Number(update.targetActionId) : null,
    recovered: true as const,
  };
  await db.update(comoNextStagedDirectives).set({
    status: "submitted",
    updateId,
    communicationDraftId: receipt.communicationDraftId,
    mailboxDraftRef: receipt.mailboxDraftRef,
    workProductId: receipt.workProductId,
    executionSummary: receipt.executionSummary,
    resultJson: JSON.stringify(receipt),
    failureMessage: null,
    submittedAt: directive.submittedAt || nowSql(),
  }).where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, directive.userId)));
  const [submitted] = await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id, directive.id)).limit(1);
  return submitted ? publicDirective(submitted) : null;
}

export async function submitStagedExecutiveDirectiveCommand(input: { userId: number; directiveId: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [initial] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!initial) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  await loadAuthorizedWorkFile(input.userId, Number(initial.workFileId), "write");

  if (initial.status === "submitted") return { directive: publicDirective(initial), replayed: true as const };
  if (initial.status === "failed") {
    const recovered = await recoverAppliedSubmission(db, initial);
    if (recovered) return { directive: recovered, replayed: true as const };
  }

  const claim = await db.execute(sql`
    UPDATE como_next_staged_directives
    SET status = 'submitting', submission_claimed_at = ${nowSql()}, failure_message = NULL
    WHERE id = ${input.directiveId}
      AND user_id = ${input.userId}
      AND status IN ('pending', 'failed')
  `);
  const affectedRows = Number((claim as any)[0]?.affectedRows ?? (claim as any).affectedRows ?? 0);
  const [directive] = await db.select().from(comoNextStagedDirectives)
    .where(and(eq(comoNextStagedDirectives.id, input.directiveId), eq(comoNextStagedDirectives.userId, input.userId))).limit(1);
  if (!directive) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على توجيه المراجعة" });
  if (!affectedRows) {
    if (directive.status === "submitted") return { directive: publicDirective(directive), replayed: true as const };
    if (directive.status === "submitting") throw new TRPCError({ code: "CONFLICT", message: "التوجيه قيد التسليم الآن؛ انتظر الإيصال قبل المحاولة مجددًا" });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "هذا التوجيه لم يعد قابلًا للتسليم" });
  }

  try {
    const result = await executeExecutiveDirectiveCommand({
      userId: input.userId,
      workFileId: Number(directive.workFileId),
      actionId: asNumber(directive.actionId),
      currentDecisionId: asNumber(directive.currentDecisionId),
      sourceChannel: "internal",
      directiveText: directive.directiveText,
      // The authenticated owner pressed submit. Sara/manual provenance remains on
      // the staged row, while the execution event correctly records that approval.
      executionSource: "owner",
      idempotencyKey: `staged-directive:${directive.id}`,
    });
    let executiveControl: unknown = null;
    let controlWarning: string | null = null;
    if (result.nextActionId) {
      try {
        executiveControl = await runExecutiveControlLoopCommand({ userId: input.userId, trigger: "owner_update", actionIds: [Number(result.nextActionId)], maxItems: 4 });
      } catch (error) {
        controlWarning = error instanceof Error ? error.message : "اكتمل التوجيه لكن تعذر تشغيل المتابعة التلقائية";
      }
    }
    const receipt = { ...result, executiveControl, controlWarning };
    await db.update(comoNextStagedDirectives).set({
      status: "submitted",
      updateId: result.updateId,
      communicationDraftId: result.communicationDraftId,
      mailboxDraftRef: result.mailboxDraftRef,
      workProductId: result.workProductId,
      executionSummary: result.executionSummary || result.acknowledgement,
      resultJson: JSON.stringify(receipt),
      failureMessage: null,
      submittedAt: nowSql(),
    }).where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, input.userId), eq(comoNextStagedDirectives.status, "submitting")));
    const [submitted] = await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id, directive.id)).limit(1);
    if (!submitted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ إيصال التسليم" });
    return { directive: publicDirective(submitted), replayed: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تنفيذ التوجيه بعد تسليمه إلى Manus";
    await db.update(comoNextStagedDirectives).set({ status: "failed", failureMessage: message.slice(0, 4000) })
      .where(and(eq(comoNextStagedDirectives.id, directive.id), eq(comoNextStagedDirectives.userId, input.userId), eq(comoNextStagedDirectives.status, "submitting")));
    throw error;
  }
}
