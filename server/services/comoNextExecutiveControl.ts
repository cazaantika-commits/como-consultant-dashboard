import { and, asc, desc, eq, isNull, lte, notInArray, or } from "drizzle-orm";
import {
  comoNextActions,
  comoNextIntakeProposals,
  comoNextMeetingSources,
  comoNextMeetings,
  comoNextWorkFileUpdates,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { appendEvent, changeActionStatusCommand, requireProjectAccess } from "./comoNextCommands";
import { executeExecutiveDirectiveCommand } from "./comoNextExecutiveDirectives";
import { reviewIntakeProposalCommand } from "./comoNextIntake";
import { analyzeWorkFileUpdateCommand } from "./comoNextKitchen";
import { analyzeMeetingSourceCommand } from "./comoNextMeetings";

const activeRuns = new Set<number>();

function affectedRows(result: unknown) {
  const raw = Array.isArray(result) ? result[0] : result;
  return Number((raw as { affectedRows?: number } | undefined)?.affectedRows || 0);
}

async function claimManusAction(userId: number, actionId: number) {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  const [action] = await db.select({
    id: comoNextActions.id,
    projectId: comoNextActions.projectId,
    workFileId: comoNextActions.workFileId,
    title: comoNextActions.title,
    description: comoNextActions.description,
    acceptanceCriteria: comoNextActions.acceptanceCriteria,
    status: comoNextActions.actionStatus,
    ownerType: comoNextActions.ownerType,
  }).from(comoNextActions).where(eq(comoNextActions.id, actionId)).limit(1);
  if (!action || action.ownerType !== "manus" || action.status !== "open") return null;
  await requireProjectAccess(db, action.projectId, userId, "write");
  const result = await db.update(comoNextActions).set({ actionStatus: "in_progress" }).where(and(
    eq(comoNextActions.id, action.id),
    eq(comoNextActions.ownerType, "manus"),
    eq(comoNextActions.actionStatus, "open"),
  ));
  if (affectedRows(result) !== 1) return null;
  await db.transaction(tx => appendEvent(tx, {
    userId,
    projectId: action.projectId,
    workFileId: action.workFileId,
    actionId: action.id,
    actorType: "manus",
    actorUserId: null,
    eventType: "executive_action_started",
    summary: `بدأ Manus تنفيذ عمله تلقائيًا: ${action.title}`,
    payload: { actionId: action.id, externalSideEffect: false },
    idempotencyKey: `executive-action-started:${action.id}`,
  }));
  return action;
}

async function releaseFailedAction(userId: number, action: NonNullable<Awaited<ReturnType<typeof claimManusAction>>>, error: unknown) {
  const db = await getDb();
  if (!db) return;
  const message = error instanceof Error ? error.message.slice(0, 800) : String(error).slice(0, 800);
  await db.update(comoNextActions).set({ actionStatus: "open" }).where(and(
    eq(comoNextActions.id, action.id),
    eq(comoNextActions.actionStatus, "in_progress"),
  ));
  await db.transaction(tx => appendEvent(tx, {
    userId,
    projectId: action.projectId,
    workFileId: action.workFileId,
    actionId: action.id,
    actorType: "system",
    actorUserId: null,
    eventType: "executive_action_failed",
    summary: `تعذر إكمال عمل Manus تلقائيًا وسيعاد لاحقًا: ${action.title}`,
    payload: { actionId: action.id, error: message, externalSideEffect: false },
    idempotencyKey: `executive-action-failed:${action.id}:${Date.now()}`,
  }));
}

async function executeManusAction(userId: number, actionId: number) {
  if (activeRuns.has(actionId)) return { skipped: "already_running" as const, nextActionId: null };
  activeRuns.add(actionId);
  let action: Awaited<ReturnType<typeof claimManusAction>> = null;
  try {
    action = await claimManusAction(userId, actionId);
    if (!action) return { skipped: "not_open_manus_action" as const, nextActionId: null };
    const directive = [
      "نفّذ الآن هذا العمل المسند إلى Manus؛ لا تكتفِ بإعادة وصفه أو إنشاء مهمة تحمل الاسم نفسه.",
      `عنوان العمل: ${action.title}`,
      action.description ? `التفاصيل: ${action.description}` : "",
      `معيار الاكتمال: ${action.acceptanceCriteria}`,
      "إذا كانت مواد الملف تكفي، أنجز المخرج الآن. إذا ثبت أن قرارًا أو حضورًا أو معلومة من عبد الرحمن ضرورية بعد إنجاز عملك، أظهرها كقرار أو تدخل واحد فقط. لا تنفذ أي أثر خارجي.",
    ].filter(Boolean).join("\n");
    const result = await executeExecutiveDirectiveCommand({
      userId,
      workFileId: action.workFileId,
      actionId: action.id,
      sourceChannel: "internal",
      directiveText: directive,
      executionSource: "executive_control",
    });
    if (result.completedNow || result.nextActionId || result.nextDecisionId) {
      await changeActionStatusCommand({ userId, actionId: action.id, nextStatus: "completed_pending_verification", actorType: "manus", actorUserId: null });
      await changeActionStatusCommand({
        userId,
        actionId: action.id,
        nextStatus: "verified",
        evidenceReference: result.workProductId
          ? `مخرج Manus #${result.workProductId}`
          : result.nextActionId
            ? `انتقل التنفيذ إلى عمل Manus #${result.nextActionId}`
            : `انتقل إلى قرار #${result.nextDecisionId}`,
        actorType: "manus",
        actorUserId: null,
      });
    } else {
      await releaseFailedAction(userId, action, "لم ينتج التنفيذ مخرجًا أو خطوة تالية قابلة للتتبع");
    }
    return { result, nextActionId: result.nextActionId ? Number(result.nextActionId) : null };
  } catch (error) {
    if (action) await releaseFailedAction(userId, action, error);
    return { error: error instanceof Error ? error.message : String(error), nextActionId: null };
  } finally {
    activeRuns.delete(actionId);
  }
}

export async function runExecutiveControlLoopCommand(input: {
  userId: number;
  trigger: "email_sync" | "owner_update" | "sara_directive" | "meeting_source" | "proposal_review" | "manual";
  updateIds?: number[];
  meetingSourceIds?: number[];
  actionIds?: number[];
  scanPending?: boolean;
  maxItems?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  const maxItems = Math.max(1, Math.min(input.maxItems || 4, 8));
  const analyzedUpdateIds: number[] = [];
  const analyzedMeetingSourceIds: number[] = [];
  const appliedIntakeProposalIds: number[] = [];
  const executedActionIds: number[] = [];
  const failures: Array<{ kind: string; id: number; message: string }> = [];
  const actionQueue = [...new Set(input.actionIds || [])];
  let operationCount = 0;

  const updateIds = [...new Set(input.updateIds || [])];
  for (const updateId of updateIds) {
    if (operationCount >= maxItems) break;
    operationCount += 1;
    try {
      const result = await analyzeWorkFileUpdateCommand({ userId: input.userId, updateId });
      analyzedUpdateIds.push(updateId);
      if (result.nextActionId && result.nextOwnerType === "manus") actionQueue.push(Number(result.nextActionId));
    } catch (error) {
      failures.push({ kind: "work_file_update", id: updateId, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const meetingSourceIds = [...new Set(input.meetingSourceIds || [])];
  for (const sourceId of meetingSourceIds) {
    if (operationCount >= maxItems) break;
    operationCount += 1;
    try {
      const result = await analyzeMeetingSourceCommand({ userId: input.userId, sourceId, requestKey: `executive-control:meeting-source:${sourceId}` });
      analyzedMeetingSourceIds.push(sourceId);
      actionQueue.push(...result.autoAppliedActionIds.map(Number));
    } catch (error) {
      failures.push({ kind: "meeting_source", id: sourceId, message: error instanceof Error ? error.message : String(error) });
    }
  }

  if (input.scanPending) {
    const safeProposals = await db.select({ id: comoNextIntakeProposals.id }).from(comoNextIntakeProposals).where(and(
      eq(comoNextIntakeProposals.userId, input.userId),
      eq(comoNextIntakeProposals.reviewStatus, "pending"),
      or(
        eq(comoNextIntakeProposals.proposalKind, "note"),
        and(eq(comoNextIntakeProposals.proposalKind, "action"), eq(comoNextIntakeProposals.ownerType, "manus")),
      ),
    )).orderBy(desc(comoNextIntakeProposals.createdAt), desc(comoNextIntakeProposals.id)).limit(maxItems);
    for (const proposal of safeProposals) {
      if (operationCount >= maxItems) break;
      operationCount += 1;
      try {
        const result = await reviewIntakeProposalCommand({ userId: input.userId, proposalId: Number(proposal.id), decision: "apply", reviewNote: "AUTO_MANUS: نتيجة داخلية آمنة طبقتها حلقة الإدارة التنفيذية." });
        appliedIntakeProposalIds.push(Number(proposal.id));
        if (result.targetId) actionQueue.push(Number(result.targetId));
      } catch (error) {
        failures.push({ kind: "intake_proposal", id: Number(proposal.id), message: error instanceof Error ? error.message : String(error) });
      }
    }

    const pendingUpdates = await db.select({ id: comoNextWorkFileUpdates.id }).from(comoNextWorkFileUpdates)
      .innerJoin(comoNextWorkFiles, eq(comoNextWorkFiles.id, comoNextWorkFileUpdates.workFileId))
      .where(and(
        eq(comoNextWorkFileUpdates.userId, input.userId),
        eq(comoNextWorkFileUpdates.analysisStatus, "not_requested"),
        notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled"]),
      )).orderBy(desc(comoNextWorkFileUpdates.occurredAt), desc(comoNextWorkFileUpdates.id)).limit(maxItems);
    for (const row of pendingUpdates) {
      const updateId = Number(row.id);
      if (analyzedUpdateIds.includes(updateId)) continue;
      if (operationCount >= maxItems) break;
      operationCount += 1;
      try {
        const result = await analyzeWorkFileUpdateCommand({ userId: input.userId, updateId });
        analyzedUpdateIds.push(updateId);
        if (result.nextActionId && result.nextOwnerType === "manus") actionQueue.push(Number(result.nextActionId));
      } catch (error) {
        failures.push({ kind: "work_file_update", id: updateId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const pendingSources = await db.select({ id: comoNextMeetingSources.id }).from(comoNextMeetingSources)
      .innerJoin(comoNextMeetings, eq(comoNextMeetings.id, comoNextMeetingSources.meetingId))
      .innerJoin(comoNextWorkFiles, eq(comoNextWorkFiles.id, comoNextMeetings.workFileId))
      .where(and(
        eq(comoNextMeetingSources.sourceStatus, "captured"),
        notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled"]),
      )).orderBy(desc(comoNextMeetingSources.createdAt), desc(comoNextMeetingSources.id)).limit(maxItems);
    for (const row of pendingSources) {
      const sourceId = Number(row.id);
      if (analyzedMeetingSourceIds.includes(sourceId)) continue;
      if (operationCount >= maxItems) break;
      operationCount += 1;
      try {
        const result = await analyzeMeetingSourceCommand({ userId: input.userId, sourceId, requestKey: `executive-control:meeting-source:${sourceId}` });
        analyzedMeetingSourceIds.push(sourceId);
        actionQueue.push(...result.autoAppliedActionIds.map(Number));
      } catch (error) {
        failures.push({ kind: "meeting_source", id: sourceId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const openActions = await db.select({ id: comoNextActions.id }).from(comoNextActions)
      .innerJoin(comoNextWorkFiles, eq(comoNextWorkFiles.id, comoNextActions.workFileId))
      .where(and(
        eq(comoNextActions.userId, input.userId),
        eq(comoNextActions.ownerType, "manus"),
        eq(comoNextActions.actionStatus, "open"),
        or(isNull(comoNextActions.attentionAt), lte(comoNextActions.attentionAt, new Date().toISOString().slice(0, 19).replace("T", " "))),
        notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled"]),
      )).orderBy(asc(comoNextActions.attentionAt), asc(comoNextActions.createdAt), asc(comoNextActions.id)).limit(maxItems);
    actionQueue.push(...openActions.map(row => Number(row.id)));
  }

  const uniqueActions = [...new Set(actionQueue)].slice(0, maxItems);
  for (let index = 0; index < uniqueActions.length && operationCount < maxItems; index += 1) {
    const actionId = uniqueActions[index];
    operationCount += 1;
    const outcome = await executeManusAction(input.userId, actionId);
    if (!("skipped" in outcome) && !("error" in outcome)) executedActionIds.push(actionId);
    if ("error" in outcome) failures.push({ kind: "manus_action", id: actionId, message: outcome.error });
    if (outcome.nextActionId && !uniqueActions.includes(outcome.nextActionId) && uniqueActions.length < maxItems) uniqueActions.push(outcome.nextActionId);
  }

  return {
    trigger: input.trigger,
    analyzedUpdateIds,
    analyzedMeetingSourceIds,
    appliedIntakeProposalIds,
    executedActionIds,
    failures,
    operationCount,
    externalSideEffect: false as const,
  };
}
