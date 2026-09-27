import { TRPCError } from "@trpc/server";
import { and, desc, eq, notInArray } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextWorkFileUpdates,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  appendEvent,
  createActionCommand,
  requireProjectAccess,
  toSqlUtcTimestamp,
} from "./comoNextCommands";

export type KitchenUpdateChannel = "phone" | "meeting" | "whatsapp" | "email" | "site_visit" | "internal";
export type KitchenPriority = "normal" | "important" | "urgent";

const UPDATE_ANALYSIS_MODEL = "gpt-5-mini";

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const updateAnalysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    nextStepRequired: { type: "boolean" },
    rationale: { type: "string" },
    suggestedActionTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
    suggestedActionDescription: { anyOf: [{ type: "string" }, { type: "null" }] },
    suggestedAcceptanceCriteria: { anyOf: [{ type: "string" }, { type: "null" }] },
    suggestedPriority: { anyOf: [{ type: "string", enum: ["normal", "important", "urgent"] }, { type: "null" }] },
    suggestedDueAt: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["summary", "nextStepRequired", "rationale", "suggestedActionTitle", "suggestedActionDescription", "suggestedAcceptanceCriteria", "suggestedPriority", "suggestedDueAt"],
  additionalProperties: false,
} as const;

type UpdateEvidenceRow = {
  id: number;
  direction: string;
  communicationStatus: string;
  subject: string;
  body: string;
  occurredAt: string | null;
  evidenceReference?: string | null;
};

export function buildOperationalUpdatePrompt(input: {
  workFile: { title: string; governingQuestion: string; desiredOutcome: string };
  action?: { title: string; actionStatus: string; acceptanceCriteria: string } | null;
  activeActions?: Array<{ title: string; actionStatus: string; acceptanceCriteria: string }>;
  update: { sourceChannel: string; occurredAt: string; updateText: string };
  communications: UpdateEvidenceRow[];
}) {
  const evidence = input.communications.length
    ? input.communications.map((row, index) => [
        `${index + 1}. ${row.direction === "inbound" ? "وارد" : row.direction === "outbound" ? "صادر" : "داخلي"} · ${row.occurredAt || "بلا تاريخ"}`,
        `الموضوع: ${row.subject}`,
        `الحالة: ${row.communicationStatus}`,
        `المحتوى: ${String(row.body || "").trim().slice(0, 2500)}`,
        row.evidenceReference ? `مرجع الدليل: ${row.evidenceReference}` : null,
      ].filter(Boolean).join("\n")).join("\n\n")
    : "لا توجد مراسلات مرتبطة بالملف.";
  const activeActions = input.activeActions?.length
    ? input.activeActions.map((row, index) => `${index + 1}. ${row.title} · ${row.actionStatus}\nمعيار القبول: ${row.acceptanceCriteria}`).join("\n\n")
    : "لا توجد إجراءات نشطة أخرى.";

  return `ملف العمل: ${input.workFile.title}
السؤال الحاكم المسجل سابقًا: ${input.workFile.governingQuestion}
النتيجة المطلوبة المسجلة سابقًا: ${input.workFile.desiredOutcome}
${input.action ? `الإجراء المرتبط: ${input.action.title}\nحالته: ${input.action.actionStatus}\nمعيار القبول: ${input.action.acceptanceCriteria}` : "لا يوجد إجراء محدد مرتبط بالتحديث."}
قناة التحديث: ${input.update.sourceChannel}
وقت الحدث: ${input.update.occurredAt}
نص التحديث:
${input.update.updateText}

الإجراءات النشطة الحالية في الملف:
${activeActions}

أحدث المراسلات المرتبطة والمحفوظة بالفعل داخل الملف، من الأحدث إلى الأقدم:
${evidence}`;
}

export function buildExecutiveKitchenQueue(input: {
  actions: any[];
  decisions: any[];
  draftCommunications: any[];
  meetings: any[];
  emails: any[];
  intakeProposals: any[];
  specialistReviews: any[];
  filesWithoutNextAction: any[];
}) {
  const items: Array<Record<string, unknown>> = [];
  for (const action of input.actions) {
    const phase = action.actionStatus === "waiting_external"
      ? "waiting_external"
      : action.actionStatus === "completed_pending_verification"
        ? "verify"
        : "act_now";
    items.push({ id: `action:${action.id}`, kind: "action", phase, title: action.title, projectId: action.projectId, workFileId: action.workFileId, recordId: action.id, priority: action.priority, attentionAt: action.attentionAt });
  }
  for (const decision of input.decisions) items.push({ id: `decision:${decision.id}`, kind: "decision", phase: "owner_review", title: decision.title, projectId: decision.projectId, workFileId: decision.workFileId, recordId: decision.id, dueAt: decision.dueAt });
  for (const draft of input.draftCommunications) items.push({ id: `communication:${draft.id}`, kind: "communication", phase: "owner_review", title: draft.subject, projectId: draft.projectId, workFileId: draft.workFileId, recordId: draft.id, dueAt: draft.occurredAt });
  for (const proposal of input.intakeProposals) items.push({ id: `proposal:${proposal.id}`, kind: "proposal", phase: "owner_review", title: proposal.title, projectId: proposal.projectId, workFileId: proposal.workFileId, recordId: proposal.id, priority: proposal.priority, dueAt: proposal.dueAt });
  for (const meeting of input.meetings) items.push({ id: `meeting:${meeting.id}`, kind: "meeting", phase: "scheduled", title: meeting.title, projectId: meeting.projectId, workFileId: meeting.workFileId, recordId: meeting.id, dueAt: meeting.startsAt });
  for (const email of input.emails) items.push({ id: `email:${email.id}`, kind: "email", phase: "owner_review", title: email.subject, projectId: email.suggestedProjectId, workFileId: email.suggestedWorkFileId, recordId: email.id, priority: email.importance });
  for (const review of input.specialistReviews) items.push({ id: `specialist:${review.id}`, kind: "specialist", phase: "owner_review", title: review.executiveSummary || review.requestText, projectId: review.projectId, workFileId: review.workFileId, recordId: review.id });
  for (const file of input.filesWithoutNextAction) items.push({ id: `gap:${file.id}`, kind: "gap", phase: "define_next_step", title: `تحديد الخطوة التالية: ${file.title}`, projectId: file.projectId, workFileId: file.id, recordId: file.id, priority: file.priority });

  const reviewKindRank: Record<string, number> = { decision: 0, proposal: 1, communication: 2, email: 3, specialist: 4 };
  const groupedItems: Array<Record<string, unknown>> = [];
  const groupedReviewIndex = new Map<string, number>();
  for (const item of items) {
    if (item.phase !== "owner_review") {
      groupedItems.push(item);
      continue;
    }
    const workFileId = Number(item.workFileId || 0);
    const normalizedTitle = String(item.title || "")
      .replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const groupKey = workFileId > 0
      ? `work-file:${workFileId}`
      : item.kind === "email" && normalizedTitle
        ? `email-thread:${normalizedTitle}`
        : String(item.id);
    const existingIndex = groupedReviewIndex.get(groupKey);
    if (existingIndex === undefined) {
      groupedReviewIndex.set(groupKey, groupedItems.length);
      groupedItems.push({ ...item, id: `review:${groupKey}`, reviewItemCount: 1, relatedReviewIds: [String(item.id)] });
      continue;
    }
    const existing = groupedItems[existingIndex];
    const existingCount = Number(existing.reviewItemCount || 1);
    const relatedReviewIds = [...((existing.relatedReviewIds as string[] | undefined) || [String(existing.id)]), String(item.id)];
    const shouldReplacePrimary = (reviewKindRank[String(item.kind)] ?? 9) < (reviewKindRank[String(existing.kind)] ?? 9);
    groupedItems[existingIndex] = {
      ...(shouldReplacePrimary ? item : existing),
      id: `review:${groupKey}`,
      reviewItemCount: existingCount + 1,
      relatedReviewIds,
    };
  }

  const phaseRank: Record<string, number> = { owner_review: 0, verify: 1, act_now: 2, define_next_step: 3, waiting_external: 4, scheduled: 5 };
  const priorityRank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
  return groupedItems.sort((a, b) => {
    const phaseDelta = (phaseRank[String(a.phase)] ?? 9) - (phaseRank[String(b.phase)] ?? 9);
    if (phaseDelta) return phaseDelta;
    const priorityDelta = (priorityRank[String(a.priority)] ?? 9) - (priorityRank[String(b.priority)] ?? 9);
    if (priorityDelta) return priorityDelta;
    return String(a.dueAt || a.attentionAt || "9999").localeCompare(String(b.dueAt || b.attentionAt || "9999"));
  });
}

async function loadUpdateContext(userId: number, updateId: number, required: "read" | "write" = "write") {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [row] = await db
    .select({ update: comoNextWorkFileUpdates, workFile: comoNextWorkFiles, action: comoNextActions })
    .from(comoNextWorkFileUpdates)
    .innerJoin(comoNextWorkFiles, and(eq(comoNextWorkFiles.id, comoNextWorkFileUpdates.workFileId), eq(comoNextWorkFiles.projectId, comoNextWorkFileUpdates.projectId)))
    .leftJoin(comoNextActions, and(eq(comoNextActions.id, comoNextWorkFileUpdates.actionId), eq(comoNextActions.projectId, comoNextWorkFileUpdates.projectId)))
    .where(and(eq(comoNextWorkFileUpdates.id, updateId), eq(comoNextWorkFileUpdates.userId, userId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على التحديث" });
  await requireProjectAccess(db, row.update.projectId, userId, required);
  return { db, ...row };
}

export async function recordWorkFileUpdateCommand(input: {
  userId: number;
  workFileId: number;
  actionId?: number | null;
  sourceChannel: KitchenUpdateChannel;
  updateText: string;
  occurredAt?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, input.workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.workFileStatus)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إضافة تحديث إلى ملف مغلق" });
  let action: typeof comoNextActions.$inferSelect | undefined;
  if (input.actionId) {
    [action] = await db.select().from(comoNextActions).where(and(eq(comoNextActions.id, input.actionId), eq(comoNextActions.projectId, workFile.projectId), eq(comoNextActions.workFileId, workFile.id))).limit(1);
    if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "الإجراء لا يتبع ملف العمل" });
  }
  const text = input.updateText.trim();
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب التحديث أولًا" });
  const occurredAt = toSqlUtcTimestamp(input.occurredAt) || nowSql();
  return db.transaction(async tx => {
    const result = await tx.insert(comoNextWorkFileUpdates).values({
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actionId: action?.id || null,
      sourceChannel: input.sourceChannel,
      updateText: text,
      occurredAt,
      analysisStatus: "not_requested",
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actionId: action?.id || null,
      actorType: "human",
      actorUserId: input.userId,
      eventType: "operational_update_recorded",
      summary: `تسجيل تحديث ${input.sourceChannel === "phone" ? "هاتفي" : input.sourceChannel === "meeting" ? "اجتماع" : "تشغيلي"}: ${text.slice(0, 180)}`,
      payload: { updateId: id, sourceChannel: input.sourceChannel, actionId: action?.id || null, externalSideEffect: false },
    });
    return { id, analysisStatus: "not_requested" as const, externalSideEffect: false as const };
  });
}

export async function analyzeWorkFileUpdateCommand(input: { userId: number; updateId: number }) {
  const { db, update, workFile, action } = await loadUpdateContext(input.userId, input.updateId, "write");
  if (update.analysisStatus === "applied" || update.analysisStatus === "dismissed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تمت مراجعة هذا التحديث بالفعل" });
  const recentCommunications = await db.select({
    id: comoNextCommunications.id,
    direction: comoNextCommunications.direction,
    communicationStatus: comoNextCommunications.communicationStatus,
    subject: comoNextCommunications.subject,
    body: comoNextCommunications.body,
    occurredAt: comoNextCommunications.occurredAt,
    evidenceReference: comoNextCommunications.evidenceReference,
  }).from(comoNextCommunications)
    .where(eq(comoNextCommunications.workFileId, workFile.id))
    .orderBy(desc(comoNextCommunications.occurredAt), desc(comoNextCommunications.id))
    .limit(8);
  const activeActions = await db.select({
    title: comoNextActions.title,
    actionStatus: comoNextActions.actionStatus,
    acceptanceCriteria: comoNextActions.acceptanceCriteria,
  }).from(comoNextActions)
    .where(and(eq(comoNextActions.workFileId, workFile.id), notInArray(comoNextActions.actionStatus, ["verified", "cancelled"])))
    .orderBy(desc(comoNextActions.updatedAt))
    .limit(12);
  const response = await invokeLLM({
    model: UPDATE_ANALYSIS_MODEL,
    messages: [
      { role: "system", content: "أنت Manus، العقل التنفيذي لعبد الرحمن. حلل تحديثًا تشغيليًا واحدًا مع كامل الأدلة المرتبطة المعروضة. نص التحديث كتبه عبد الرحمن داخل التطبيق؛ تسمية قناة المصدر لا تعني أنه نص وارد من الطرف الخارجي، فلا تنسب تعليق عبد الرحمن إلى الطرف ولا تقترح ردًا خارجيًا لمجرد أنه سأل النظام أو اشتكى من التتبع. كل مراسلة معروضة تحت قسم المراسلات المرتبطة محفوظة ومرتبطة بالملف بالفعل، لذلك لا تقترح إرفاقها أو ربطها مرة أخرى. رتّب الحقائق زمنيًا؛ الدليل الأحدث ينسخ وصف حالة أقدم عندما يتعارضان. لا تقل إن دليلاً مفقود إذا كانت مراسلة مرتبطة في السياق تثبته. إذا أكد بريد وارد موعدًا كان منتظرًا، فصرّح بأن شرط الانتظار تحقق واقترح التحضير أو الخطوة التالية، لا إعادة طلب التأكيد. إذا كانت الخطوة التالية موجودة ضمن الإجراءات النشطة فلا تنشئ اقتراحًا مكررًا واجعل nextStepRequired=false. لا تنفذ، لا ترسل، لا تعتمد قرارًا، ولا تغيّر حالة الإجراء. حدّد هل توجد خطوة عملية جديدة فعلًا، ولا تكرر إجراءً قائمًا. اكتب اقتراحًا واحدًا فقط قابلًا للمراجعة ومعيار قبول واضحًا إن لزم." },
      { role: "user", content: buildOperationalUpdatePrompt({ workFile, action, update, activeActions, communications: recentCommunications.map(row => ({ ...row, id: Number(row.id) })) }) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_operational_update_analysis", strict: true, schema: updateAnalysisSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم يُرجع Manus تحليلًا قابلاً للمراجعة" });
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة اقتراح Manus" }); }
  const hasAction = Boolean(parsed.nextStepRequired && String(parsed.suggestedActionTitle || "").trim() && String(parsed.suggestedAcceptanceCriteria || "").trim());
  await db.update(comoNextWorkFileUpdates).set({
    analysisStatus: "draft",
    analysisSummary: `${String(parsed.summary || "").trim()}\n\nالمنطق: ${String(parsed.rationale || "").trim()}`.trim(),
    suggestedActionTitle: hasAction ? String(parsed.suggestedActionTitle).trim().slice(0, 500) : null,
    suggestedActionDescription: hasAction ? String(parsed.suggestedActionDescription || "").trim().slice(0, 5000) || null : null,
    suggestedAcceptanceCriteria: hasAction ? String(parsed.suggestedAcceptanceCriteria).trim().slice(0, 5000) : null,
    suggestedPriority: hasAction && ["normal", "important", "urgent"].includes(parsed.suggestedPriority) ? parsed.suggestedPriority : null,
    suggestedDueAt: hasAction && parsed.suggestedDueAt ? toSqlUtcTimestamp(parsed.suggestedDueAt) : null,
    modelId: response.model || UPDATE_ANALYSIS_MODEL,
  }).where(eq(comoNextWorkFileUpdates.id, update.id));
  return { id: Number(update.id), analysisStatus: "draft" as const, nextStepRequired: hasAction, externalSideEffect: false as const, operationalRecordsCreated: 0 as const };
}

export async function reviewWorkFileUpdateCommand(input: { userId: number; updateId: number; decision: "apply" | "dismiss" }) {
  const { db, update } = await loadUpdateContext(input.userId, input.updateId, "write");
  if (update.analysisStatus !== "draft") {
    return { replayed: true as const, targetActionId: update.targetActionId ? Number(update.targetActionId) : null, externalSideEffect: false as const };
  }
  if (input.decision === "dismiss" || !update.suggestedActionTitle || !update.suggestedAcceptanceCriteria) {
    await db.update(comoNextWorkFileUpdates).set({ analysisStatus: "dismissed", reviewedByUserId: input.userId, reviewedAt: nowSql() }).where(eq(comoNextWorkFileUpdates.id, update.id));
    return { replayed: false as const, targetActionId: null, externalSideEffect: false as const };
  }
  const created = await createActionCommand({
    userId: input.userId,
    workFileId: update.workFileId,
    title: update.suggestedActionTitle,
    description: update.suggestedActionDescription || undefined,
    acceptanceCriteria: update.suggestedAcceptanceCriteria,
    ownerType: "human",
    priority: update.suggestedPriority || "normal",
    dueAt: update.suggestedDueAt || undefined,
    idempotencyKey: `operational-update:${update.id}`,
  });
  await db.update(comoNextWorkFileUpdates).set({
    analysisStatus: "applied",
    targetActionId: created.id,
    reviewedByUserId: input.userId,
    reviewedAt: nowSql(),
  }).where(eq(comoNextWorkFileUpdates.id, update.id));
  return { replayed: created.replayed, targetActionId: Number(created.id), externalSideEffect: false as const };
}

export async function listWorkFileUpdates(userId: number, workFileId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId }).from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, userId, "read");
  return db.select().from(comoNextWorkFileUpdates).where(and(eq(comoNextWorkFileUpdates.userId, userId), eq(comoNextWorkFileUpdates.workFileId, workFileId))).orderBy(desc(comoNextWorkFileUpdates.occurredAt), desc(comoNextWorkFileUpdates.id)).limit(100);
}
