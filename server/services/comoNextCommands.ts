import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextDecisions,
  comoNextProjectAccess,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type ComoNextAccessRole = "manager" | "contributor" | "viewer";
export type ComoNextActionStatus =
  | "open"
  | "in_progress"
  | "waiting_external"
  | "completed_pending_verification"
  | "verified"
  | "cancelled";
export type ComoNextDecisionStatus = "required" | "approved" | "rejected" | "deferred" | "superseded";
export type ComoNextDecisionAuthority = "abdulrahman" | "wael" | "sheikh_issa" | "joint" | "other";

const terminalActionStatuses = new Set<ComoNextActionStatus>(["verified", "cancelled"]);
const allowedTransitions: Record<ComoNextActionStatus, ReadonlySet<ComoNextActionStatus>> = {
  open: new Set<ComoNextActionStatus>(["in_progress", "waiting_external", "completed_pending_verification", "cancelled"]),
  in_progress: new Set<ComoNextActionStatus>(["open", "waiting_external", "completed_pending_verification", "cancelled"]),
  waiting_external: new Set<ComoNextActionStatus>(["open", "in_progress", "completed_pending_verification", "cancelled"]),
  completed_pending_verification: new Set<ComoNextActionStatus>(["in_progress", "verified", "cancelled"]),
  verified: new Set<ComoNextActionStatus>(["in_progress"]),
  cancelled: new Set<ComoNextActionStatus>(["open"]),
};

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

export function toSqlUtcTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة التاريخ غير صحيحة" });
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function deriveAttentionAt(dueAt?: string | null, followUpAt?: string | null) {
  return toSqlUtcTimestamp(followUpAt) ?? toSqlUtcTimestamp(dueAt);
}

export function assertActionTransition(current: ComoNextActionStatus, next: ComoNextActionStatus) {
  if (current === next) return;
  if (!allowedTransitions[current]?.has(next)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن نقل الإجراء من ${current} إلى ${next}` });
  }
}

export async function requireProjectAccess(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number,
  userId: number,
  required: "read" | "write" = "read",
) {
  const [project] = await db
    .select({ id: projects.id, userId: projects.userId, name: projects.name, isTestProject: projects.isTestProject })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.isTestProject, 0)))
    .limit(1);

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المشروع" });
  }

  if (project.userId === userId) return { project, role: "manager" as ComoNextAccessRole };

  const [access] = await db
    .select({ role: comoNextProjectAccess.accessRole })
    .from(comoNextProjectAccess)
    .where(and(eq(comoNextProjectAccess.projectId, projectId), eq(comoNextProjectAccess.userId, userId)))
    .limit(1);

  if (!access || (required === "write" && access.role === "viewer")) {
    throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المشروع" });
  }

  return { project, role: access.role };
}

async function appendEvent(
  tx: any,
  input: {
    userId: number;
    projectId: number;
    workFileId: number;
    actionId?: number | null;
    actorType?: "human" | "manus" | "system";
    actorUserId?: number | null;
    eventType: string;
    summary: string;
    payload?: Record<string, string | number | boolean | null>;
    idempotencyKey?: string | null;
  },
) {
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id = ${input.workFileId} FOR UPDATE`);
  const raw = await tx.execute(sql`
    SELECT COALESCE(MAX(sequence_no), 0) AS sequenceNo
    FROM como_next_work_file_events
    WHERE work_file_id = ${input.workFileId}
  `);
  const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
  const sequenceNo = Number((rows as any[])[0]?.sequenceNo ?? 0) + 1;

  await tx.insert(comoNextWorkFileEvents).values({
    userId: input.userId,
    projectId: input.projectId,
    workFileId: input.workFileId,
    actionId: input.actionId ?? null,
    sequenceNo,
    actorType: input.actorType ?? "human",
    actorUserId: input.actorUserId ?? input.userId,
    eventType: input.eventType,
    summary: input.summary.slice(0, 1000),
    payloadJson: input.payload ? JSON.stringify(input.payload) : null,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

export async function createWorkFileCommand(input: {
  userId: number;
  projectId: number;
  title: string;
  governingQuestion: string;
  desiredOutcome: string;
  priority: "normal" | "important" | "urgent";
  idempotencyKey?: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await requireProjectAccess(db, input.projectId, input.userId, "write");

  return db.transaction(async tx => {
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select({ workFileId: comoNextWorkFileEvents.workFileId })
        .from(comoNextWorkFileEvents)
        .where(eq(comoNextWorkFileEvents.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return { id: existing.workFileId, replayed: true as const };
    }

    const result = await tx.insert(comoNextWorkFiles).values({
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      governingQuestion: input.governingQuestion,
      desiredOutcome: input.desiredOutcome,
      priority: input.priority,
      ownerUserId: input.userId,
      workFileStatus: "open",
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: input.projectId,
      workFileId: id,
      eventType: "work_file_opened",
      summary: `فتح ملف العمل: ${input.title}`,
      payload: { priority: input.priority },
      idempotencyKey: input.idempotencyKey,
    });
    return { id, replayed: false as const };
  });
}

export async function createActionCommand(input: {
  userId: number;
  workFileId: number;
  title: string;
  description?: string;
  acceptanceCriteria: string;
  ownerType: "human" | "manus" | "team";
  priority: "normal" | "important" | "urgent";
  dueAt?: string | null;
  followUpAt?: string | null;
  idempotencyKey?: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db
    .select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId, status: comoNextWorkFiles.workFileStatus })
    .from(comoNextWorkFiles)
    .where(eq(comoNextWorkFiles.id, input.workFileId))
    .limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إضافة إجراء إلى ملف مغلق" });
  }

  const dueAt = toSqlUtcTimestamp(input.dueAt);
  const followUpAt = toSqlUtcTimestamp(input.followUpAt);
  const attentionAt = followUpAt ?? dueAt;

  return db.transaction(async tx => {
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select({ actionId: comoNextWorkFileEvents.actionId })
        .from(comoNextWorkFileEvents)
        .where(eq(comoNextWorkFileEvents.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing?.actionId) return { id: existing.actionId, replayed: true as const };
    }

    const result = await tx.insert(comoNextActions).values({
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      title: input.title,
      description: input.description ?? null,
      acceptanceCriteria: input.acceptanceCriteria,
      ownerType: input.ownerType,
      ownerUserId: input.ownerType === "human" ? input.userId : null,
      priority: input.priority,
      dueAt,
      followUpAt,
      attentionAt,
      actionStatus: "open",
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actionId: id,
      eventType: "action_created",
      summary: `إضافة الإجراء: ${input.title}`,
      payload: { ownerType: input.ownerType, priority: input.priority, attentionAt },
      idempotencyKey: input.idempotencyKey,
    });
    return { id, replayed: false as const };
  });
}

export async function createDecisionCommand(input: {
  userId: number;
  workFileId: number;
  title: string;
  question: string;
  contextSummary?: string | null;
  recommendation?: string | null;
  decisionAuthority: ComoNextDecisionAuthority;
  dueAt?: string | null;
  idempotencyKey?: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db
    .select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId, status: comoNextWorkFiles.workFileStatus })
    .from(comoNextWorkFiles)
    .where(eq(comoNextWorkFiles.id, input.workFileId))
    .limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إضافة قرار مطلوب إلى ملف مغلق" });
  }

  return db.transaction(async tx => {
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select({ id: comoNextDecisions.id })
        .from(comoNextDecisions)
        .where(and(eq(comoNextDecisions.sourceSystem, "como_next"), eq(comoNextDecisions.sourceRecordId, input.idempotencyKey)))
        .limit(1);
      if (existing) return { id: existing.id, replayed: true as const };
    }

    const dueAt = toSqlUtcTimestamp(input.dueAt);
    const result = await tx.insert(comoNextDecisions).values({
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      title: input.title,
      question: input.question,
      contextSummary: input.contextSummary?.trim() || null,
      recommendation: input.recommendation?.trim() || null,
      decisionAuthority: input.decisionAuthority,
      decisionStatus: "required",
      dueAt,
      sourceSystem: "como_next",
      sourceRecordId: input.idempotencyKey ?? null,
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      eventType: "decision_required",
      summary: `إضافة قرار مطلوب: ${input.title}`,
      payload: { decisionId: id, authority: input.decisionAuthority, dueAt },
      idempotencyKey: input.idempotencyKey ? `event:${input.idempotencyKey}` : null,
    });
    return { id, replayed: false as const };
  });
}

export async function changeActionStatusCommand(input: {
  userId: number;
  actionId: number;
  nextStatus: ComoNextActionStatus;
  evidenceReference?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [action] = await db
    .select()
    .from(comoNextActions)
    .where(eq(comoNextActions.id, input.actionId))
    .limit(1);
  if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الإجراء" });
  await requireProjectAccess(db, action.projectId, input.userId, "write");
  assertActionTransition(action.actionStatus, input.nextStatus);
  if (input.nextStatus === "verified" && !input.evidenceReference?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "التحقق يحتاج مرجع دليل واضح" });
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  return db.transaction(async tx => {
    await tx
      .update(comoNextActions)
      .set({
        actionStatus: input.nextStatus,
        evidenceReference: input.nextStatus === "verified" ? input.evidenceReference!.trim() : action.evidenceReference,
        completedAt: input.nextStatus === "completed_pending_verification" ? now : action.completedAt,
        verifiedAt: input.nextStatus === "verified" ? now : null,
      })
      .where(eq(comoNextActions.id, input.actionId));

    await appendEvent(tx, {
      userId: input.userId,
      projectId: action.projectId,
      workFileId: action.workFileId,
      actionId: action.id,
      eventType: "action_status_changed",
      summary: `تغيير حالة الإجراء من ${action.actionStatus} إلى ${input.nextStatus}`,
      payload: {
        from: action.actionStatus,
        to: input.nextStatus,
        evidenceReference: input.nextStatus === "verified" ? input.evidenceReference!.trim() : null,
      },
    });
    return { success: true };
  });
}

export async function resolveDecisionCommand(input: {
  userId: number;
  decisionId: number;
  nextStatus: "approved" | "rejected" | "deferred";
  decisionAuthority: ComoNextDecisionAuthority;
  decisionText: string;
  evidenceReference?: string | null;
  deferredUntil?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [decision] = await db.select().from(comoNextDecisions).where(eq(comoNextDecisions.id, input.decisionId)).limit(1);
  if (!decision) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على القرار" });
  await requireProjectAccess(db, decision.projectId, input.userId, "write");
  if (!["required", "deferred"].includes(decision.decisionStatus)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "هذا القرار محسوم ولا يمكن حسمه مرة أخرى" });
  }
  if (input.nextStatus === "deferred" && !input.deferredUntil) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "تأجيل القرار يحتاج موعد عودة واضح" });
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  return db.transaction(async tx => {
    await tx
      .update(comoNextDecisions)
      .set({
        decisionStatus: input.nextStatus,
        decisionAuthority: input.decisionAuthority,
        decisionText: input.decisionText.trim(),
        evidenceReference: input.evidenceReference?.trim() || null,
        dueAt: input.nextStatus === "deferred" ? toSqlUtcTimestamp(input.deferredUntil) : decision.dueAt,
        decidedByUserId: input.userId,
        decidedAt: now,
      })
      .where(eq(comoNextDecisions.id, input.decisionId));

    const statusLabel = input.nextStatus === "approved" ? "اعتماد" : input.nextStatus === "rejected" ? "رفض" : "تأجيل";
    await appendEvent(tx, {
      userId: input.userId,
      projectId: decision.projectId,
      workFileId: decision.workFileId,
      eventType: input.nextStatus === "deferred" ? "decision_deferred" : "decision_recorded",
      summary: `${statusLabel} القرار: ${decision.title}`,
      payload: {
        decisionId: decision.id,
        status: input.nextStatus,
        authority: input.decisionAuthority,
        evidenceReference: input.evidenceReference?.trim() || null,
      },
    });
    return { success: true };
  });
}

export async function closeWorkFileCommand(input: {
  userId: number;
  workFileId: number;
  closureEvidenceRef: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, input.workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");

  const actions = await db
    .select({ status: comoNextActions.actionStatus })
    .from(comoNextActions)
    .where(eq(comoNextActions.workFileId, input.workFileId));
  if (actions.some(action => !terminalActionStatuses.has(action.status))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إغلاق الملف قبل التحقق من جميع إجراءاته أو إلغائها" });
  }
  const decisions = await db
    .select({ status: comoNextDecisions.decisionStatus })
    .from(comoNextDecisions)
    .where(eq(comoNextDecisions.workFileId, input.workFileId));
  if (decisions.some(decision => ["required", "deferred"].includes(decision.status))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إغلاق الملف قبل حسم القرارات المطلوبة" });
  }
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  return db.transaction(async tx => {
    await tx
      .update(comoNextWorkFiles)
      .set({ workFileStatus: "closed", closureEvidenceRef: input.closureEvidenceRef.trim(), closedAt: now })
      .where(eq(comoNextWorkFiles.id, input.workFileId));
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      eventType: "work_file_closed",
      summary: `إغلاق ملف العمل: ${workFile.title}`,
      payload: { closureEvidenceRef: input.closureEvidenceRef.trim() },
    });
    return { success: true };
  });
}

export async function getRecentWorkFileEvents(workFileId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  return db
    .select()
    .from(comoNextWorkFileEvents)
    .where(eq(comoNextWorkFileEvents.workFileId, workFileId))
    .orderBy(desc(comoNextWorkFileEvents.sequenceNo));
}
