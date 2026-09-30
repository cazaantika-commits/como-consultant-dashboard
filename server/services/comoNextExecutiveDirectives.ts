import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
  comoNextWorkFileEvents,
  comoNextWorkFileUpdates,
  comoNextWorkFiles,
  comoNextWorkMemory,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  appendEvent,
  changeActionStatusCommand,
  createActionCommand,
  createDecisionCommand,
  requireProjectAccess,
  resolveDecisionCommand,
} from "./comoNextCommands";
import { recordWorkFileUpdateCommand, type KitchenUpdateChannel } from "./comoNextKitchen";

const DIRECTIVE_MODEL = "gpt-5";

const directiveResultSchema = {
  type: "object",
  properties: {
    acknowledgement: { type: "string" },
    executionSummary: { type: "string" },
    relatedWorkFileIds: { type: "array", items: { type: "integer" }, maxItems: 12 },
    completedNow: { type: "boolean" },
    workProductTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
    workProductBody: { anyOf: [{ type: "string" }, { type: "null" }] },
    nextActionRequired: { type: "boolean" },
    nextActionTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
    nextActionDescription: { anyOf: [{ type: "string" }, { type: "null" }] },
    nextActionAcceptanceCriteria: { anyOf: [{ type: "string" }, { type: "null" }] },
    nextActionPriority: { anyOf: [{ type: "string", enum: ["normal", "important", "urgent"] }, { type: "null" }] },
    decisionRequiredAfterExecution: { type: "boolean" },
    decisionTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
    decisionQuestion: { anyOf: [{ type: "string" }, { type: "null" }] },
    decisionRecommendation: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "acknowledgement",
    "executionSummary",
    "relatedWorkFileIds",
    "completedNow",
    "workProductTitle",
    "workProductBody",
    "nextActionRequired",
    "nextActionTitle",
    "nextActionDescription",
    "nextActionAcceptanceCriteria",
    "nextActionPriority",
    "decisionRequiredAfterExecution",
    "decisionTitle",
    "decisionQuestion",
    "decisionRecommendation",
  ],
  additionalProperties: false,
} as const;

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function compact(value: unknown, max = 4_000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function loadDirectiveContext(userId: number, workFileId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف الموضوع" });
  await requireProjectAccess(db, workFile.projectId, userId, "write");
  if (["closed", "cancelled"].includes(workFile.workFileStatus)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن توجيه Manus داخل ملف مغلق" });
  }

  const [projectFiles, actions, decisions, communications, memory] = await Promise.all([
    db.select({ id: comoNextWorkFiles.id, title: comoNextWorkFiles.title, status: comoNextWorkFiles.workFileStatus, governingQuestion: comoNextWorkFiles.governingQuestion, desiredOutcome: comoNextWorkFiles.desiredOutcome })
      .from(comoNextWorkFiles)
      .where(and(eq(comoNextWorkFiles.projectId, workFile.projectId), notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled"])))
      .orderBy(desc(comoNextWorkFiles.updatedAt)),
    db.select({ id: comoNextActions.id, workFileId: comoNextActions.workFileId, title: comoNextActions.title, description: comoNextActions.description, acceptanceCriteria: comoNextActions.acceptanceCriteria, ownerType: comoNextActions.ownerType, status: comoNextActions.actionStatus })
      .from(comoNextActions)
      .where(and(eq(comoNextActions.projectId, workFile.projectId), notInArray(comoNextActions.actionStatus, ["verified", "cancelled"])))
      .orderBy(desc(comoNextActions.updatedAt))
      .limit(30),
    db.select({ id: comoNextDecisions.id, workFileId: comoNextDecisions.workFileId, title: comoNextDecisions.title, question: comoNextDecisions.question, recommendation: comoNextDecisions.recommendation, status: comoNextDecisions.decisionStatus })
      .from(comoNextDecisions)
      .where(and(eq(comoNextDecisions.projectId, workFile.projectId), inArray(comoNextDecisions.decisionStatus, ["required", "deferred"])))
      .orderBy(desc(comoNextDecisions.updatedAt))
      .limit(20),
    db.select({ workFileId: comoNextCommunications.workFileId, direction: comoNextCommunications.direction, status: comoNextCommunications.communicationStatus, subject: comoNextCommunications.subject, body: comoNextCommunications.body, occurredAt: comoNextCommunications.occurredAt })
      .from(comoNextCommunications)
      .where(eq(comoNextCommunications.projectId, workFile.projectId))
      .orderBy(desc(comoNextCommunications.occurredAt), desc(comoNextCommunications.id))
      .limit(24),
    db.select({ id: comoNextWorkMemory.id, workFileId: comoNextWorkMemory.workFileId, memoryType: comoNextWorkMemory.memoryType, entryType: comoNextWorkMemory.entryType, title: comoNextWorkMemory.title, body: comoNextWorkMemory.body, sourceStatus: comoNextWorkMemory.sourceStatus, occurredAt: comoNextWorkMemory.occurredAt })
      .from(comoNextWorkMemory)
      .where(and(eq(comoNextWorkMemory.projectId, workFile.projectId), eq(comoNextWorkMemory.isCurrent, 1)))
      .orderBy(desc(comoNextWorkMemory.occurredAt), desc(comoNextWorkMemory.id))
      .limit(40),
  ]);
  return { db, workFile, projectFiles, actions, decisions, communications, memory };
}

function buildDirectivePrompt(input: {
  directiveText: string;
  currentDecisionId?: number | null;
  context: Awaited<ReturnType<typeof loadDirectiveContext>>;
}) {
  const { workFile, projectFiles, actions, decisions, communications, memory } = input.context;
  const fileName = new Map(projectFiles.map(file => [Number(file.id), file.title]));
  return `أنت Manus، المدير التنفيذي العامل داخل COMO. عبد الرحمن لا يطلب منك أن تشرح له ما يفعله؛ هو يعطيك توجيهًا أو يصحح مسارك، وأنت تنفذ كل العمل الداخلي الممكن وتعيده فقط لمراجعة مخرج أو قرار حقيقي.

قواعد حاكمة:
1) افهم التوجيه الحر حتى لو جمع عدة شركات أو ملفات. لا تطلب منه تعبئة حقول أو إعادة صياغة.
2) إذا كان العمل تحليلاً/مقارنة/صياغة/تنظيم معرفة ويمكن إنجازه من المعلومات أدناه، أنجزه الآن داخل workProductBody، لا تنشئ مجرد مهمة تقول "حلّل".
3) إذا احتاج العمل وثائق أو بيانات غير موجودة، أنشئ خطوة Manus واحدة محددة تجمع الناقص وتنتج مخرجًا واضحًا؛ لا تجعل المستخدم مسؤولاً عن عمل يستطيع Manus فعله.
4) اذكر ملفات الموضوع المرتبطة التي يجب تعليق خطواتها المنفردة إلى أن يكتمل العمل الموحد، باستعمال المعرفات المتاحة فقط.
5) لا ترسل بريدًا، ولا تقبل عرضًا، ولا تعيّن استشاريًا، ولا تنشئ التزامًا أو دفعًا. المسودة أو التقرير الداخلي مسموحان.
6) لا تخترع أسعارًا أو نطاقًا. أي رقم غير مثبت يبقى TBD، واذكر عدم قابلية المقارنة إذا اختلف نطاق الخدمة.
7) اكتب بالعربية المهنية الواضحة. اجعل المخرج قابلاً للقراءة لا JSON خامًا.

التوجيه الحالي من عبد الرحمن:
${input.directiveText}

ملف الموضوع المفتوح:
- المعرف: ${workFile.id}
- العنوان: ${workFile.title}
- السؤال الحاكم: ${workFile.governingQuestion}
- النتيجة المطلوبة: ${workFile.desiredOutcome}
${input.currentDecisionId ? `- القرار المفتوح الذي جاء التوجيه من داخله: ${input.currentDecisionId}` : ""}

ملفات المشروع المفتوحة المتاحة للربط:
${projectFiles.map(file => `- ${file.id}: ${file.title} [${file.status}]`).join("\n")}

الإجراءات الحالية:
${actions.length ? actions.map(item => `- ملف ${item.workFileId} (${fileName.get(Number(item.workFileId)) || ""}): ${item.title} · ${item.ownerType}/${item.status} · معيار القبول: ${compact(item.acceptanceCriteria, 700)}`).join("\n") : "لا توجد."}

القرارات المفتوحة:
${decisions.length ? decisions.map(item => `- قرار ${item.id} في ملف ${item.workFileId}: ${item.title} · ${compact(item.question, 900)} · التوصية: ${compact(item.recommendation, 700)}`).join("\n") : "لا توجد."}

أحدث المخرجات والمواد الحالية:
${memory.length ? memory.map(item => `- ملف ${item.workFileId} (${fileName.get(Number(item.workFileId)) || ""}) · ${item.memoryType}/${item.entryType || ""} · ${item.title}\n${compact(item.body, 3_000)}`).join("\n\n") : "لا توجد."}

أحدث المراسلات:
${communications.length ? communications.map(item => `- ملف ${item.workFileId} · ${item.direction}/${item.status} · ${item.subject}\n${compact(item.body, 1_200)}`).join("\n\n") : "لا توجد."}`;
}

export async function executeExecutiveDirectiveCommand(input: {
  userId: number;
  workFileId: number;
  actionId?: number | null;
  currentDecisionId?: number | null;
  sourceChannel?: KitchenUpdateChannel;
  directiveText: string;
  executionSource?: "owner" | "sara" | "executive_control";
}) {
  const context = await loadDirectiveContext(input.userId, input.workFileId);
  if (input.currentDecisionId) {
    const decision = context.decisions.find(item => Number(item.id) === input.currentDecisionId && Number(item.workFileId) === input.workFileId);
    if (!decision) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "القرار لم يعد مفتوحًا داخل هذا الملف" });
  }
  const saved = await recordWorkFileUpdateCommand({
    userId: input.userId,
    workFileId: input.workFileId,
    actionId: input.actionId || null,
    sourceChannel: input.sourceChannel || "internal",
    updateText: input.directiveText,
    actorType: input.executionSource === "executive_control" ? "manus" : "human",
    actorUserId: input.executionSource === "executive_control" ? null : input.userId,
  });

  const response = await invokeLLM({
    model: DIRECTIVE_MODEL,
    messages: [
      { role: "system", content: "أخرج نتيجة تنفيذية منظمة مطابقة للمخطط فقط. نفّذ العمل الداخلي المتاح، ولا تحوّل توجيه عبد الرحمن إلى أسئلة أو نماذج إضافية." },
      { role: "user", content: buildDirectivePrompt({ directiveText: input.directiveText, currentDecisionId: input.currentDecisionId, context }) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_executive_directive", strict: true, schema: directiveResultSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم يُرجع Manus نتيجة قابلة للتنفيذ" });
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة نتيجة Manus" }); }

  const allowedRelatedIds = new Set(context.projectFiles.map(file => Number(file.id)));
  const relatedWorkFileIds = input.executionSource === "executive_control"
    ? []
    : [...new Set((Array.isArray(parsed.relatedWorkFileIds) ? parsed.relatedWorkFileIds : [])
      .map(Number)
      .filter((id: number) => id !== input.workFileId && allowedRelatedIds.has(id)))];
  const sourceRecordId = `executive-directive:${saved.id}`;
  let workProductId: number | null = null;
  let nextActionId: number | null = null;
  let nextDecisionId: number | null = null;

  if (parsed.completedNow && String(parsed.workProductTitle || "").trim() && String(parsed.workProductBody || "").trim()) {
    const [existing] = await context.db.select({ id: comoNextWorkMemory.id }).from(comoNextWorkMemory)
      .where(and(eq(comoNextWorkMemory.sourceSystem, "como_directive"), eq(comoNextWorkMemory.sourceRecordId, sourceRecordId))).limit(1);
    if (existing) workProductId = Number(existing.id);
    else {
      const result = await context.db.insert(comoNextWorkMemory).values({
        projectId: context.workFile.projectId,
        workFileId: input.workFileId,
        memoryType: "work_product",
        entryType: "executive_directive_output",
        title: String(parsed.workProductTitle).trim().slice(0, 1000),
        body: String(parsed.workProductBody).trim(),
        sourceStatus: "done",
        isCurrent: 1,
        sourceSystem: "como_directive",
        sourceRecordId,
        occurredAt: nowSql(),
      });
      workProductId = Number(result[0].insertId);
      await context.db.transaction(tx => appendEvent(tx, {
        userId: input.userId,
        projectId: context.workFile.projectId,
        workFileId: input.workFileId,
        actorType: "manus",
        actorUserId: null,
        eventType: "executive_directive_completed",
        summary: `أنجز Manus التوجيه: ${String(parsed.workProductTitle).trim().slice(0, 700)}`,
        payload: { updateId: Number(saved.id), workProductId, externalSideEffect: false },
        idempotencyKey: `event:${sourceRecordId}`,
      }));
    }
  }

  if (!workProductId && parsed.nextActionRequired && String(parsed.nextActionTitle || "").trim() && String(parsed.nextActionAcceptanceCriteria || "").trim()) {
    const created = await createActionCommand({
      userId: input.userId,
      workFileId: input.workFileId,
      title: String(parsed.nextActionTitle).trim(),
      description: String(parsed.nextActionDescription || parsed.executionSummary || "").trim() || undefined,
      acceptanceCriteria: String(parsed.nextActionAcceptanceCriteria).trim(),
      ownerType: "manus",
      priority: ["normal", "important", "urgent"].includes(parsed.nextActionPriority) ? parsed.nextActionPriority : "important",
      idempotencyKey: `action:${sourceRecordId}`,
      actorType: "manus",
      actorUserId: null,
    });
    nextActionId = Number(created.id);
  }

  if (workProductId && parsed.decisionRequiredAfterExecution && String(parsed.decisionTitle || "").trim() && String(parsed.decisionQuestion || "").trim()) {
    const created = await createDecisionCommand({
      userId: input.userId,
      workFileId: input.workFileId,
      title: String(parsed.decisionTitle).trim(),
      question: String(parsed.decisionQuestion).trim(),
      contextSummary: String(parsed.executionSummary || "").trim() || null,
      recommendation: String(parsed.decisionRecommendation || "").trim() || null,
      decisionAuthority: "abdulrahman",
      idempotencyKey: `decision:${sourceRecordId}`,
      actorType: "manus",
      actorUserId: null,
    });
    nextDecisionId = Number(created.id);
  }

  for (const relatedId of relatedWorkFileIds) {
    await context.db.transaction(async tx => {
      await tx.update(comoNextWorkFiles).set({ workFileStatus: "waiting" }).where(and(eq(comoNextWorkFiles.id, relatedId), eq(comoNextWorkFiles.projectId, context.workFile.projectId)));
      await appendEvent(tx, {
        userId: input.userId,
        projectId: context.workFile.projectId,
        workFileId: relatedId,
        actorType: "manus",
        actorUserId: null,
        eventType: "work_file_joined_to_directive",
        summary: `تعليق الخطوة المنفردة مؤقتًا: الملف مشمول في تنفيذ موحد يقوده Manus من ملف #${input.workFileId}`,
        payload: { directiveUpdateId: Number(saved.id), coordinatorWorkFileId: input.workFileId, externalSideEffect: false },
        idempotencyKey: `directive-related:${saved.id}:${relatedId}`,
      });
    });
  }

  if (input.actionId) {
    const action = context.actions.find(item => Number(item.id) === input.actionId && Number(item.workFileId) === input.workFileId);
    if (action?.ownerType === "human" && ["open", "in_progress"].includes(action.status) && action.title.trim().startsWith("أخبر Manus")) {
      await changeActionStatusCommand({ userId: input.userId, actionId: Number(action.id), nextStatus: "completed_pending_verification" });
      await changeActionStatusCommand({ userId: input.userId, actionId: Number(action.id), nextStatus: "verified", evidenceReference: `توجيه تنفيذي #${saved.id}` });
    }
  }

  if (input.currentDecisionId) {
    await resolveDecisionCommand({
      userId: input.userId,
      decisionId: input.currentDecisionId,
      nextStatus: "approved",
      decisionAuthority: "abdulrahman",
      decisionText: input.directiveText.trim(),
      evidenceReference: `توجيه تنفيذي #${saved.id}`,
    });
  }

  await context.db.update(comoNextWorkFileUpdates).set({
    analysisStatus: "applied",
    analysisSummary: `${String(parsed.acknowledgement || "تم فهم التوجيه.").trim()}\n\n${String(parsed.executionSummary || "").trim()}`.trim(),
    suggestedActionTitle: nextActionId ? String(parsed.nextActionTitle).trim().slice(0, 500) : null,
    suggestedActionDescription: nextActionId ? String(parsed.nextActionDescription || "").trim().slice(0, 5000) || null : null,
    suggestedAcceptanceCriteria: nextActionId ? String(parsed.nextActionAcceptanceCriteria || "").trim().slice(0, 5000) : null,
    suggestedPriority: nextActionId ? (["normal", "important", "urgent"].includes(parsed.nextActionPriority) ? parsed.nextActionPriority : "important") : null,
    targetActionId: nextActionId,
    modelId: response.model || DIRECTIVE_MODEL,
    reviewedByUserId: input.userId,
    reviewedAt: nowSql(),
  }).where(eq(comoNextWorkFileUpdates.id, saved.id));

  return {
    updateId: Number(saved.id),
    acknowledgement: String(parsed.acknowledgement || "تم فهم التوجيه.").trim(),
    executionSummary: String(parsed.executionSummary || "").trim(),
    workProductId,
    nextActionId,
    nextDecisionId,
    relatedWorkFileIds,
    completedNow: Boolean(workProductId),
    externalSideEffect: false as const,
  };
}
