import { TRPCError } from "@trpc/server";
import { and, desc, eq, lte, notInArray } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
  comoNextMeetings,
  comoNextWorkFileEvents,
  comoNextWorkFileUpdates,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  appendEvent,
  changeActionStatusCommand,
  createActionCommand,
  requireProjectAccess,
  resolveDecisionCommand,
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

export function decisionNeedsAttentionNow(decision: { decisionStatus?: string | null; dueAt?: string | Date | null }, nowMs = Date.now()) {
  if (!decision.decisionStatus || decision.decisionStatus === "required") return true;
  if (decision.decisionStatus !== "deferred" || !decision.dueAt) return false;
  const raw = decision.dueAt instanceof Date ? decision.dueAt.toISOString() : String(decision.dueAt);
  const dueMs = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`).getTime();
  return Number.isFinite(dueMs) && dueMs <= nowMs;
}

export function actionNeedsAttentionNow(action: { attentionAt?: string | Date | null }, nowMs = Date.now()) {
  if (!action.attentionAt) return true;
  const raw = action.attentionAt instanceof Date ? action.attentionAt.toISOString() : String(action.attentionAt);
  const attentionMs = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`).getTime();
  return !Number.isFinite(attentionMs) || attentionMs <= nowMs;
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
    suggestedOwnerType: { anyOf: [{ type: "string", enum: ["manus", "human", "team"] }, { type: "null" }] },
    suggestedPriority: { anyOf: [{ type: "string", enum: ["normal", "important", "urgent"] }, { type: "null" }] },
    suggestedDueAt: { anyOf: [{ type: "string" }, { type: "null" }] },
    decisionTransition: {
      anyOf: [
        {
          type: "object",
          properties: {
            decisionId: { type: "integer" },
            nextStatus: { type: "string", enum: ["approved", "rejected", "deferred"] },
            decisionText: { type: "string" },
            deferredUntil: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["decisionId", "nextStatus", "decisionText", "deferredUntil"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
  },
  required: ["summary", "nextStepRequired", "rationale", "suggestedActionTitle", "suggestedActionDescription", "suggestedAcceptanceCriteria", "suggestedOwnerType", "suggestedPriority", "suggestedDueAt", "decisionTransition"],
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
  activeDecisions?: Array<{ id: number; title: string; decisionStatus: string; dueAt: string | null }>;
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
  const activeDecisions = input.activeDecisions?.length
    ? input.activeDecisions.map(row => `${row.id}. ${row.title} · ${row.decisionStatus} · موعد العودة: ${row.dueAt || "غير محدد"}`).join("\n")
    : "لا توجد قرارات مفتوحة.";

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

القرارات المفتوحة في الملف:
${activeDecisions}

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
    if (!actionNeedsAttentionNow(action)) continue;
    const phase = action.actionStatus === "waiting_external"
      ? "waiting_external"
      : action.actionStatus === "completed_pending_verification"
        ? "verify"
        : "act_now";
    items.push({ id: `action:${action.id}`, kind: "action", phase, title: action.title, projectId: action.projectId, workFileId: action.workFileId, recordId: action.id, ownerType: action.ownerType, priority: action.priority, attentionAt: action.attentionAt });
  }
  for (const decision of input.decisions) {
    if (!decisionNeedsAttentionNow(decision)) continue;
    items.push({ id: `decision:${decision.id}`, kind: "decision", phase: "owner_review", title: decision.title, projectId: decision.projectId, workFileId: decision.workFileId, recordId: decision.id, dueAt: decision.dueAt });
  }
  for (const draft of input.draftCommunications) items.push({ id: `communication:${draft.id}`, kind: "communication", phase: "owner_review", title: draft.subject, projectId: draft.projectId, workFileId: draft.workFileId, recordId: draft.id, dueAt: draft.occurredAt });
  for (const proposal of input.intakeProposals) items.push({ id: `proposal:${proposal.id}`, kind: "proposal", phase: "owner_review", title: proposal.title, projectId: proposal.projectId, workFileId: proposal.workFileId, recordId: proposal.id, priority: proposal.priority, dueAt: proposal.dueAt });
  for (const meeting of input.meetings) {
    const startsAt = meeting.startsAt ? new Date(`${String(meeting.startsAt).replace(" ", "T")}Z`).getTime() : Number.POSITIVE_INFINITY;
    const needsOutcome = Number.isFinite(startsAt) && startsAt <= Date.now();
    items.push({
      id: `meeting:${meeting.id}`,
      kind: "meeting",
      phase: needsOutcome ? "act_now" : "scheduled",
      title: needsOutcome ? `أخبر Manus بما حدث في ${meeting.title}` : meeting.title,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId,
      recordId: meeting.id,
      dueAt: meeting.startsAt,
      ownerType: needsOutcome ? "human" : null,
      needsOutcome,
      priority: needsOutcome ? "urgent" : null,
    });
  }
  for (const email of input.emails) {
    const executiveTitle = String(email.suggestedNextStep || "").split("\n")[0].trim();
    items.push({
      id: `email:${email.id}`,
      kind: "email",
      phase: "owner_review",
      title: executiveTitle || email.subject,
      projectId: email.suggestedProjectId,
      workFileId: email.suggestedWorkFileId,
      recordId: email.id,
      priority: email.importance,
    });
  }
  for (const review of input.specialistReviews) items.push({ id: `specialist:${review.id}`, kind: "specialist", phase: "owner_review", title: review.executiveSummary || review.requestText, projectId: review.projectId, workFileId: review.workFileId, recordId: review.id });
  for (const file of input.filesWithoutNextAction) items.push({ id: `gap:${file.id}`, kind: "gap", phase: "define_next_step", title: `تحديد الخطوة التالية: ${file.title}`, projectId: file.projectId, workFileId: file.id, recordId: file.id, priority: file.priority });

  const itemRank = (item: Record<string, unknown>) => {
    if (item.kind === "meeting" && item.needsOutcome) return -1;
    if (item.kind === "decision") return 0;
    if (item.kind === "communication" || item.kind === "proposal") return 1;
    if (item.kind === "action" && item.ownerType === "human") return 2;
    if (item.kind === "meeting") return 3;
    if (item.kind === "action" && item.ownerType === "manus") return 4;
    if (item.kind === "email" || item.kind === "specialist") return 5;
    if (item.phase === "waiting_external") return 6;
    return 7;
  };
  const groupedItems: Array<Record<string, unknown>> = [];
  const groupedIndex = new Map<string, number>();
  for (const item of items) {
    const workFileId = Number(item.workFileId || 0);
    if (!workFileId) {
      groupedItems.push(item);
      continue;
    }
    const groupKey = `work-file:${workFileId}`;
    const existingIndex = groupedIndex.get(groupKey);
    if (existingIndex === undefined) {
      groupedIndex.set(groupKey, groupedItems.length);
      groupedItems.push({ ...item, id: `topic:${groupKey}`, reviewItemCount: 1, relatedReviewIds: [String(item.id)] });
      continue;
    }
    const existing = groupedItems[existingIndex];
    const existingCount = Number(existing.reviewItemCount || 1);
    const relatedReviewIds = [...((existing.relatedReviewIds as string[] | undefined) || [String(existing.id)]), String(item.id)];
    const shouldReplacePrimary = itemRank(item) < itemRank(existing);
    groupedItems[existingIndex] = {
      ...(shouldReplacePrimary ? item : existing),
      id: `topic:${groupKey}`,
      reviewItemCount: existingCount + 1,
      relatedReviewIds,
    };
  }

  const phaseRank: Record<string, number> = { owner_review: 0, verify: 1, act_now: 2, define_next_step: 3, waiting_external: 4, scheduled: 5 };
  const priorityRank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
  return groupedItems.sort((a, b) => {
    const aNeedsOutcome = a.kind === "meeting" && a.needsOutcome ? 0 : 1;
    const bNeedsOutcome = b.kind === "meeting" && b.needsOutcome ? 0 : 1;
    if (aNeedsOutcome !== bNeedsOutcome) return aNeedsOutcome - bNeedsOutcome;
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
  actorType?: "human" | "manus" | "system";
  actorUserId?: number | null;
  idempotencyKey?: string | null;
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
    if (input.idempotencyKey) {
      const [existingEvent] = await tx.select({ payloadJson: comoNextWorkFileEvents.payloadJson }).from(comoNextWorkFileEvents)
        .where(eq(comoNextWorkFileEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existingEvent) {
        let updateId = 0;
        try { updateId = Number(JSON.parse(String(existingEvent.payloadJson || "{}")).updateId || 0); } catch { /* keep zero */ }
        return { id: updateId, replayed: true as const, analysisStatus: "not_requested" as const, completedMeetingId: null, externalSideEffect: false as const };
      }
    }
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
      actorType: input.actorType ?? "human",
      actorUserId: input.actorUserId === undefined ? input.userId : input.actorUserId,
      eventType: "operational_update_recorded",
      summary: `تسجيل تحديث ${input.sourceChannel === "phone" ? "هاتفي" : input.sourceChannel === "meeting" ? "اجتماع" : "تشغيلي"}: ${text.slice(0, 180)}`,
      payload: { updateId: id, sourceChannel: input.sourceChannel, actionId: action?.id || null, externalSideEffect: false },
      idempotencyKey: input.idempotencyKey || null,
    });
    let completedMeetingId: number | null = null;
    if (input.sourceChannel === "meeting") {
      const [meeting] = await tx.select().from(comoNextMeetings).where(and(
        eq(comoNextMeetings.workFileId, workFile.id),
        lte(comoNextMeetings.startsAt, occurredAt),
        notInArray(comoNextMeetings.meetingStatus, ["completed", "cancelled"]),
      )).orderBy(desc(comoNextMeetings.startsAt), desc(comoNextMeetings.id)).limit(1);
      if (meeting) {
        completedMeetingId = Number(meeting.id);
        await tx.update(comoNextMeetings).set({ meetingStatus: "completed", outcomeSummary: text.slice(0, 20_000), closedAt: occurredAt }).where(eq(comoNextMeetings.id, meeting.id));
        await appendEvent(tx, {
          userId: input.userId,
          projectId: workFile.projectId,
          workFileId: workFile.id,
          actorType: input.actorType ?? "human",
          actorUserId: input.actorUserId === undefined ? input.userId : input.actorUserId,
          eventType: "meeting_outcome_recorded",
          summary: `إغلاق الاجتماع بنتيجته المسجلة: ${meeting.title}`,
          payload: { meetingId: meeting.id, updateId: id, externalSideEffect: false },
        });
      }
    }
    return { id, replayed: false as const, analysisStatus: "not_requested" as const, completedMeetingId, externalSideEffect: false as const };
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
  const activeDecisions = await db.select({
    id: comoNextDecisions.id,
    title: comoNextDecisions.title,
    decisionStatus: comoNextDecisions.decisionStatus,
    dueAt: comoNextDecisions.dueAt,
  }).from(comoNextDecisions)
    .where(and(eq(comoNextDecisions.workFileId, workFile.id), notInArray(comoNextDecisions.decisionStatus, ["approved", "rejected", "superseded"])))
    .orderBy(desc(comoNextDecisions.updatedAt))
    .limit(12);
  const response = await invokeLLM({
    model: UPDATE_ANALYSIS_MODEL,
    messages: [
      { role: "system", content: "أنت Manus، العقل التنفيذي لعبد الرحمن. حلل تحديثًا تشغيليًا واحدًا مع كامل الأدلة المرتبطة المعروضة، وحدد خطوة واحدة تالية فقط. نص التحديث كتبه عبد الرحمن داخل التطبيق؛ تسمية قناة المصدر لا تعني أنه نص وارد من الطرف الخارجي، فلا تنسب تعليق عبد الرحمن إلى الطرف. كل مراسلة معروضة تحت قسم المراسلات المرتبطة محفوظة ومرتبطة بالملف بالفعل، لذلك لا تقترح إرفاقها أو ربطها مرة أخرى. رتّب الحقائق زمنيًا؛ الدليل الأحدث ينسخ وصف حالة أقدم عندما يتعارضان. إذا حسم عبد الرحمن قرارًا أو رفضه أو أجله، استخدم decisionTransition لتغيير القرار القديم نفسه؛ لا تحفظ التحديث بجانب قرار required متعارض. التأجيل يحتاج تاريخ عودة صريحًا، ولا يظهر كأولوية قبل ذلك التاريخ. لا تقل إن دليلاً مفقود إذا كانت مراسلة مرتبطة في السياق تثبته. إذا أكد بريد وارد موعدًا كان منتظرًا، فصرّح بأن شرط الانتظار تحقق واقترح التحضير أو الخطوة التالية، لا إعادة طلب التأكيد. إذا كانت الخطوة التالية موجودة ضمن الإجراءات النشطة فلا تنشئ اقتراحًا مكررًا واجعل nextStepRequired=false. اجعل suggestedOwnerType=manus لكل تحليل أو مقارنة أو إعداد تقرير أو محضر أو مسودة أو متابعة معلوماتية يستطيع Manus إنجازها. استخدم human فقط لتدخل واقعي لا يستطيع Manus أداءه: حضور اجتماع، إجراء مكالمة شخصية، تزويد معلومة غير موجودة، أو قرار حقيقي بعد اكتمال التحليل. لا تجعل مراجعة اقتراح Manus خطوة مستقلة. لا ترسل ولا تعتمد ولا تقبل ولا تعيّن ولا تدفع. اكتب خطوة واحدة ومعيار قبول واضحًا إن لزم." },
      { role: "user", content: buildOperationalUpdatePrompt({ workFile, action, update, activeActions, activeDecisions, communications: recentCommunications.map(row => ({ ...row, id: Number(row.id) })) }) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_operational_update_analysis", strict: true, schema: updateAnalysisSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم يُرجع Manus تحليلًا قابلاً للمراجعة" });
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة اقتراح Manus" }); }
  let transitionedDecisionId: number | null = null;
  const decisionTransition = parsed.decisionTransition;
  if (decisionTransition) {
    const decisionId = Number(decisionTransition.decisionId);
    const currentDecision = activeDecisions.find(item => Number(item.id) === decisionId);
    const nextStatus = String(decisionTransition.nextStatus || "");
    const deferredUntil = nextStatus === "deferred" ? String(decisionTransition.deferredUntil || "").trim() : null;
    if (currentDecision && ["approved", "rejected", "deferred"].includes(nextStatus) && (nextStatus !== "deferred" || toSqlUtcTimestamp(deferredUntil))) {
      await resolveDecisionCommand({
        userId: input.userId,
        decisionId,
        nextStatus: nextStatus as "approved" | "rejected" | "deferred",
        decisionAuthority: "abdulrahman",
        decisionText: String(decisionTransition.decisionText || update.updateText).trim(),
        evidenceReference: `تحديث تشغيلي #${update.id}`,
        deferredUntil,
      });
      transitionedDecisionId = decisionId;
    }
  }
  const hasAction = Boolean(parsed.nextStepRequired && String(parsed.suggestedActionTitle || "").trim() && String(parsed.suggestedAcceptanceCriteria || "").trim());
  const suggestedOwnerType = hasAction && ["manus", "human", "team"].includes(parsed.suggestedOwnerType) ? parsed.suggestedOwnerType as "manus" | "human" | "team" : "manus";
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
  let targetActionId: number | null = null;
  if (hasAction) {
    const created = await createActionCommand({
      userId: input.userId,
      workFileId: Number(workFile.id),
      title: String(parsed.suggestedActionTitle).trim(),
      description: String(parsed.suggestedActionDescription || "").trim() || undefined,
      acceptanceCriteria: String(parsed.suggestedAcceptanceCriteria).trim(),
      ownerType: suggestedOwnerType,
      priority: ["normal", "important", "urgent"].includes(parsed.suggestedPriority) ? parsed.suggestedPriority : "normal",
      dueAt: parsed.suggestedDueAt || undefined,
      idempotencyKey: `operational-update:${update.id}`,
      actorType: "manus",
      actorUserId: null,
    });
    targetActionId = Number(created.id);
  }
  if (
    action
    && action.ownerType === "human"
    && ["open", "in_progress"].includes(action.actionStatus)
    && action.title.trim().startsWith("أخبر Manus بما حدث")
  ) {
    await changeActionStatusCommand({
      userId: input.userId,
      actionId: Number(action.id),
      nextStatus: "completed_pending_verification",
    });
    await changeActionStatusCommand({
      userId: input.userId,
      actionId: Number(action.id),
      nextStatus: "verified",
      evidenceReference: `تحديث تشغيلي #${update.id} · ${update.sourceChannel} · ${update.occurredAt}`,
    });
  }
  await db.update(comoNextWorkFileUpdates).set({
    analysisStatus: "applied",
    targetActionId,
    reviewedAt: nowSql(),
  }).where(eq(comoNextWorkFileUpdates.id, update.id));
  return {
    id: Number(update.id),
    analysisStatus: "applied" as const,
    nextStepRequired: hasAction,
    nextActionId: targetActionId,
    transitionedDecisionId,
    nextOwnerType: hasAction ? suggestedOwnerType : null,
    externalSideEffect: false as const,
    operationalRecordsCreated: hasAction ? 1 as const : 0 as const,
  };
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
