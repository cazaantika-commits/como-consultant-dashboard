import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import {
  comoNextActions,
  comoNextEmailAnalyses,
  comoNextEmailAttachments,
  comoNextEmailMessages,
  comoNextIntakeProposals,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
  comoNextWorkMemory,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { appendEvent, deriveAttentionAt, requireProjectAccess, toSqlUtcTimestamp } from "./comoNextCommands";

const RECONCILIATION_MODEL = "gpt-5-mini";
const ACTIVE_ACTION_STATUSES = ["open", "in_progress", "waiting_external", "completed_pending_verification"] as const;
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const asUtcDate = (value?: string | null) => value ? new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`) : null;

export type ReconciliationAction = {
  actionId: number;
  resolution: "keep" | "verified" | "cancelled";
  confidence: number;
  reason: string;
  evidenceQuote: string;
};

export type ReconciliationNextAction = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  ownerType: "manus" | "human" | "team";
  priority: "normal" | "important" | "urgent";
  dueAt: string | null;
};

export type EvidenceReconciliationPlan = {
  evidenceOutcome: string;
  actionResolutions: ReconciliationAction[];
  nextAction: ReconciliationNextAction | null;
};

const reconciliationSchema = {
  type: "object",
  properties: {
    evidenceOutcome: { type: "string" },
    actionResolutions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          actionId: { type: "integer" },
          resolution: { type: "string", enum: ["keep", "verified", "cancelled"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          evidenceQuote: { type: "string" },
        },
        required: ["actionId", "resolution", "confidence", "reason", "evidenceQuote"],
        additionalProperties: false,
      },
    },
    nextAction: {
      anyOf: [
        {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            acceptanceCriteria: { type: "string" },
            ownerType: { type: "string", enum: ["manus", "human", "team"] },
            priority: { type: "string", enum: ["normal", "important", "urgent"] },
            dueAt: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["title", "description", "acceptanceCriteria", "ownerType", "priority", "dueAt"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
  },
  required: ["evidenceOutcome", "actionResolutions", "nextAction"],
  additionalProperties: false,
} as const;

function clean(value: unknown, max = 5_000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeReconciliationPlan(raw: unknown, activeActionIds: number[]): EvidenceReconciliationPlan {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const allowed = new Set(activeActionIds);
  const seen = new Set<number>();
  const actionResolutions: ReconciliationAction[] = [];
  for (const item of Array.isArray(source.actionResolutions) ? source.actionResolutions : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const actionId = Number(row.actionId);
    const resolution = String(row.resolution || "keep") as ReconciliationAction["resolution"];
    const confidence = Math.max(0, Math.min(100, Math.round(Number(row.confidence) || 0)));
    if (!allowed.has(actionId) || seen.has(actionId) || !["keep", "verified", "cancelled"].includes(resolution)) continue;
    seen.add(actionId);
    actionResolutions.push({
      actionId,
      resolution,
      confidence,
      reason: clean(row.reason, 2_000),
      evidenceQuote: clean(row.evidenceQuote, 2_000),
    });
  }
  for (const actionId of activeActionIds) {
    if (!seen.has(actionId)) actionResolutions.push({ actionId, resolution: "keep", confidence: 0, reason: "لم يصدر حكم موثق على الإجراء.", evidenceQuote: "" });
  }

  let nextAction: ReconciliationNextAction | null = null;
  const rawNext = source.nextAction;
  if (rawNext && typeof rawNext === "object") {
    const row = rawNext as Record<string, unknown>;
    const ownerType = String(row.ownerType || "") as ReconciliationNextAction["ownerType"];
    const priority = String(row.priority || "normal") as ReconciliationNextAction["priority"];
    const title = clean(row.title, 500);
    const acceptanceCriteria = clean(row.acceptanceCriteria, 5_000);
    if (title && acceptanceCriteria && ["manus", "human", "team"].includes(ownerType) && ["normal", "important", "urgent"].includes(priority)) {
      nextAction = {
        title,
        description: clean(row.description, 5_000),
        acceptanceCriteria,
        ownerType,
        priority,
        dueAt: row.dueAt ? clean(row.dueAt, 80) : null,
      };
    }
  }
  return { evidenceOutcome: clean(source.evidenceOutcome, 3_000), actionResolutions, nextAction };
}

export function buildEvidenceReconciliationPrompt(input: {
  workFile: { title: string; governingQuestion: string; desiredOutcome: string; status: string };
  triggerEmail: { id: number; folderName: string; subject: string; fromText: string; receivedAt: string; bodyText: string; attachmentCount: number; attachmentNames: string[]; analysisSummary?: string | null; suggestedNextStep?: string | null };
  activeActions: Array<{ id: number; title: string; description?: string | null; acceptanceCriteria: string; actionStatus: string; ownerType: string; createdAt: string; dueAt?: string | null; evidenceReference?: string | null }>;
  recentEmails: Array<{ direction: string; receivedAt: string; subject: string; excerpt: string }>;
  currentOutputs: Array<{ title: string; entryType?: string | null; occurredAt?: string | null }>;
}) {
  const actions = input.activeActions.map(item => `- #${item.id} · ${item.actionStatus} · ${item.ownerType} · ${item.title}\n  الوصف: ${item.description || "—"}\n  معيار الإقفال: ${item.acceptanceCriteria}\n  أنشئ: ${item.createdAt}${item.dueAt ? ` · يستحق: ${item.dueAt}` : ""}${item.evidenceReference ? ` · دليل سابق: ${item.evidenceReference}` : ""}`).join("\n");
  const emails = input.recentEmails.map(item => `- ${item.receivedAt} · ${item.direction}: ${item.subject} — ${item.excerpt}`).join("\n");
  const outputs = input.currentOutputs.map(item => `- ${item.occurredAt || "دون تاريخ"}: ${item.title}${item.entryType ? ` · ${item.entryType}` : ""}`).join("\n");
  return `ملف الموضوع: ${input.workFile.title}\nحالته: ${input.workFile.status}\nالسؤال الحاكم: ${input.workFile.governingQuestion}\nالنتيجة المطلوبة: ${input.workFile.desiredOutcome}\n\nالدليل الجديد المراد مصالحته:\n- رقم البريد: ${input.triggerEmail.id}\n- الاتجاه: ${input.triggerEmail.folderName === "INBOX" ? "وارد" : "صادر"}\n- التاريخ: ${input.triggerEmail.receivedAt}\n- من: ${input.triggerEmail.fromText}\n- الموضوع: ${input.triggerEmail.subject}\n- عدد المرفقات: ${input.triggerEmail.attachmentCount}\n- أسماء المرفقات: ${input.triggerEmail.attachmentNames.join("، ") || "لا توجد"}\n- نص البريد: ${input.triggerEmail.bodyText.slice(0, 12_000)}\n- تحليل البريد المحفوظ: ${input.triggerEmail.analysisSummary || "لا يوجد"}\n- الخطوة المقترحة المحفوظة: ${input.triggerEmail.suggestedNextStep || "لا توجد"}\n\nالإجراءات النشطة قبل الدليل:\n${actions || "لا توجد"}\n\nأحدث المراسلات في الملف:\n${emails || "لا توجد"}\n\nالمخرجات الحالية:\n${outputs || "لا توجد"}\n\nالمطلوب: طابق الدليل الجديد مع كل إجراء نشط. إن أثبت الدليل تحقق انتظار موضوعي، فحوّل الإجراء إلى verified. إن جعل الدليل الإجراء غير صالح أو استبدله بواقع جديد، فحوّله إلى cancelled. وإلا أبقه keep. لا تعتبر وعدًا أو عبارة عامة أو رسالة صادرة من عبد الرحمن دليلاً على تنفيذ الطرف الآخر. اعتماد صرف لا يثبت تنفيذ الدفع. إرسال طلب لا يثبت استلام المطلوب. لا تُغلق إجراءً إلا باقتباس صريح من الدليل الحالي.\n\nأسماء المرفقات المسجلة أعلاه تعني أن البريد ومرفقاته التُقطت وحُفظت داخل الملف؛ لا تقترح استيعابها أو ربطها أو أرشفتها مرة أخرى. بعد ذلك اقترح خطوة واحدة فقط إذا أصبحت هناك خطوة جديدة فعلًا. تحليل مستند أو عرض أو مرفق، واستخراج مقارنة أو تقرير، هو عمل Manus وليس عبد الرحمن. لا تطلب من عبد الرحمن مراجعة المادة الخام قبل أن يُنجز Manus التحليل. إذا كان الإجراء التالي نفسه قائمًا فعلاً ومبنيًا على هذا الدليل، اجعل nextAction=null. إذا كان إجراء بشري قديم مبنيًا على نسخة سابقة وأصبح التحليل الجديد شرطًا قبله، ألغِ القديم وأنشئ خطوة Manus أولًا. اكتب عنوان الخطوة ووصفها ومعيار قبولها بالعربية المهنية المختصرة، ولا تبدأ العنوان بكلمة Manus. لا تنشئ إرسالًا أو قبولًا أو قرارًا أو دفعًا. أخرج JSON فقط.`;
}

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

export async function reconcileWorkFileEvidenceCommand(input: { userId: number; workFileId: number; triggerEmailId: number; dryRun?: boolean }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, input.workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.workFileStatus)) return { skipped: "closed_work_file", changed: 0, nextActionId: null, externalSideEffect: false as const };

  const [triggerEmail] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, input.triggerEmailId),
    eq(comoNextEmailMessages.userId, input.userId),
    eq(comoNextEmailMessages.linkedWorkFileId, input.workFileId),
  )).limit(1);
  if (!triggerEmail || triggerEmail.folderName !== "INBOX") return { skipped: "not_linked_inbound_evidence", changed: 0, nextActionId: null, externalSideEffect: false as const };

  const key = `evidence-reconcile:v1:w${input.workFileId}:e${input.triggerEmailId}`;
  const [existingEvent] = await db.select({ id: comoNextWorkFileEvents.id }).from(comoNextWorkFileEvents).where(eq(comoNextWorkFileEvents.idempotencyKey, key)).limit(1);
  if (existingEvent && !input.dryRun) return { replayed: true as const, changed: 0, nextActionId: null, externalSideEffect: false as const };

  const activeActions = await db.select().from(comoNextActions).where(and(
    eq(comoNextActions.workFileId, input.workFileId),
    inArray(comoNextActions.actionStatus, [...ACTIVE_ACTION_STATUSES]),
  )).orderBy(desc(comoNextActions.updatedAt), desc(comoNextActions.id));
  if (!activeActions.length) return { skipped: "no_active_actions", changed: 0, nextActionId: null, externalSideEffect: false as const };

  const [analysis] = await db.select({ summaryAr: comoNextEmailAnalyses.summaryAr, suggestedNextStep: comoNextEmailAnalyses.suggestedNextStep })
    .from(comoNextEmailAnalyses)
    .where(and(eq(comoNextEmailAnalyses.emailMessageId, input.triggerEmailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")))
    .orderBy(desc(comoNextEmailAnalyses.id)).limit(1);
  const attachments = await db.select({ fileName: comoNextEmailAttachments.fileName }).from(comoNextEmailAttachments)
    .where(eq(comoNextEmailAttachments.emailMessageId, input.triggerEmailId)).orderBy(comoNextEmailAttachments.ordinal);
  const recentEmails = await db.select({ folderName: comoNextEmailMessages.folderName, receivedAt: comoNextEmailMessages.receivedAt, subject: comoNextEmailMessages.subject, bodyText: comoNextEmailMessages.bodyText })
    .from(comoNextEmailMessages)
    .where(eq(comoNextEmailMessages.linkedWorkFileId, input.workFileId))
    .orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(8);
  const outputs = await db.select({ title: comoNextWorkMemory.title, entryType: comoNextWorkMemory.entryType, occurredAt: comoNextWorkMemory.occurredAt })
    .from(comoNextWorkMemory)
    .where(and(eq(comoNextWorkMemory.workFileId, input.workFileId), eq(comoNextWorkMemory.memoryType, "work_product"), eq(comoNextWorkMemory.isCurrent, 1)))
    .orderBy(desc(comoNextWorkMemory.occurredAt), desc(comoNextWorkMemory.id)).limit(12);

  const response = await invokeLLM({
    model: RECONCILIATION_MODEL,
    messages: [
      { role: "system", content: "أنت حارس اتساق تشغيلي داخل COMO. مهمتك مصالحة دليل وارد موثق مع الإجراءات النشطة فقط. استخدم أحدث دليل، وطبّق الحسم المحافظ: لا إغلاق بلا اقتباس صريح، ولا إنشاء قرار أو إرسال أو التزام. أخرج JSON مطابقًا للمخطط." },
      { role: "user", content: buildEvidenceReconciliationPrompt({
        workFile: { title: workFile.title, governingQuestion: workFile.governingQuestion, desiredOutcome: workFile.desiredOutcome, status: workFile.workFileStatus },
        triggerEmail: {
          id: Number(triggerEmail.id), folderName: triggerEmail.folderName, subject: triggerEmail.subject,
          fromText: triggerEmail.fromName ? `${triggerEmail.fromName} <${triggerEmail.fromEmail}>` : triggerEmail.fromEmail,
          receivedAt: triggerEmail.receivedAt, bodyText: triggerEmail.bodyText, attachmentCount: triggerEmail.attachmentCount,
          attachmentNames: attachments.map(item => item.fileName), analysisSummary: analysis?.summaryAr || null, suggestedNextStep: analysis?.suggestedNextStep || null,
        },
        activeActions: activeActions.map(action => ({ ...action, id: Number(action.id) })),
        recentEmails: recentEmails.map(email => ({ direction: email.folderName === "INBOX" ? "وارد" : "صادر", receivedAt: email.receivedAt, subject: email.subject, excerpt: clean(email.bodyText, 900) })),
        currentOutputs: outputs,
      }) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_action_reconciliation", strict: true, schema: reconciliationSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم تُرجع المصالحة نتيجة قابلة للقراءة" });
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة نتيجة مصالحة الإجراءات" }); }
  const plan = normalizeReconciliationPlan(parsed, activeActions.map(action => Number(action.id)));
  if (input.dryRun) return { dryRun: true as const, plan, changed: 0, nextActionId: null, externalSideEffect: false as const };

  const evidenceReference = `بريد وارد #${triggerEmail.id} · ${triggerEmail.receivedAt} · ${triggerEmail.subject}`;
  const actionById = new Map(activeActions.map(action => [Number(action.id), action]));
  const applicable = plan.actionResolutions.filter(item => item.resolution !== "keep" && item.evidenceQuote.length >= 3 && (
    item.resolution === "verified" ? item.confidence >= 90 : item.confidence >= 85
  ));
  const nextKey = `evidence-reconcile:${input.triggerEmailId}:next`;
  return db.transaction(async tx => {
    const [replay] = await tx.select({ id: comoNextWorkFileEvents.id }).from(comoNextWorkFileEvents).where(eq(comoNextWorkFileEvents.idempotencyKey, key)).limit(1);
    if (replay) return { replayed: true as const, changed: 0, nextActionId: null, externalSideEffect: false as const };
    const now = nowSql();
    let changed = 0;
    for (const resolution of applicable) {
      const action = actionById.get(resolution.actionId);
      if (!action) continue;
      await tx.update(comoNextActions).set({
        actionStatus: resolution.resolution,
        evidenceReference: `${evidenceReference}\nالاقتباس: ${resolution.evidenceQuote}\nالمصالحة: ${resolution.reason}`,
        completedAt: action.completedAt || now,
        verifiedAt: resolution.resolution === "verified" ? now : null,
      }).where(and(eq(comoNextActions.id, action.id), inArray(comoNextActions.actionStatus, [...ACTIVE_ACTION_STATUSES])));
      await appendEvent(tx, {
        userId: input.userId,
        projectId: workFile.projectId,
        workFileId: workFile.id,
        actionId: action.id,
        actorType: "system",
        eventType: resolution.resolution === "verified" ? "action_verified_from_linked_evidence" : "action_cancelled_from_superseding_evidence",
        summary: `${resolution.resolution === "verified" ? "تحقق" : "استُبدل"} الإجراء بالدليل الوارد: ${action.title}`,
        payload: { emailId: Number(triggerEmail.id), from: action.actionStatus, to: resolution.resolution, confidence: resolution.confidence, externalSideEffect: false },
      });
      changed += 1;
    }

    if (applicable.length) {
      await tx.update(comoNextIntakeProposals).set({
        reviewStatus: "dismissed",
        reviewNote: `استُبدل بالمصالحة التشغيلية للدليل ${evidenceReference}`,
        reviewedByUserId: input.userId,
        reviewedAt: now,
      }).where(and(
        eq(comoNextIntakeProposals.workFileId, workFile.id),
        eq(comoNextIntakeProposals.reviewStatus, "pending"),
        eq(comoNextIntakeProposals.sourceEmailId, triggerEmail.id),
      ));
    }

    let nextActionId: number | null = null;
    if (plan.nextAction && applicable.length) {
      const normalizedTitle = clean(plan.nextAction.title, 500).toLowerCase();
      const duplicate = activeActions.find(action => !applicable.some(item => item.actionId === Number(action.id)) && clean(action.title, 500).toLowerCase() === normalizedTitle);
      if (duplicate) nextActionId = Number(duplicate.id);
      else {
        const [existing] = await tx.select({ id: comoNextActions.id }).from(comoNextActions)
          .where(and(eq(comoNextActions.sourceSystem, "evidence_reconciliation"), eq(comoNextActions.sourceRecordId, nextKey))).limit(1);
        if (existing) nextActionId = Number(existing.id);
        else {
          const dueAt = plan.nextAction.dueAt ? toSqlUtcTimestamp(plan.nextAction.dueAt) : null;
          const result = await tx.insert(comoNextActions).values({
            userId: input.userId,
            projectId: workFile.projectId,
            workFileId: workFile.id,
            title: plan.nextAction.title,
            description: plan.nextAction.description || null,
            acceptanceCriteria: plan.nextAction.acceptanceCriteria,
            ownerType: plan.nextAction.ownerType,
            ownerUserId: plan.nextAction.ownerType === "human" ? input.userId : null,
            actionStatus: "open",
            priority: plan.nextAction.priority,
            dueAt,
            attentionAt: deriveAttentionAt(dueAt, null),
            sourceSystem: "evidence_reconciliation",
            sourceRecordId: nextKey,
          });
          nextActionId = Number(result[0].insertId);
          await appendEvent(tx, {
            userId: input.userId,
            projectId: workFile.projectId,
            workFileId: workFile.id,
            actionId: nextActionId,
            actorType: "system",
            eventType: "next_action_opened_from_linked_evidence",
            summary: `فتح الخطوة التالية بعد مصالحة الدليل: ${plan.nextAction.title}`,
            payload: { emailId: Number(triggerEmail.id), ownerType: plan.nextAction.ownerType, externalSideEffect: false },
          });
        }
      }
    }

    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      actorType: "system",
      eventType: "linked_evidence_actions_reconciled",
      summary: plan.evidenceOutcome || `مصالحة البريد الوارد #${triggerEmail.id} مع الإجراءات النشطة`,
      payload: { emailId: Number(triggerEmail.id), changed, nextActionId, externalSideEffect: false },
      idempotencyKey: key,
    });
    return { replayed: false as const, changed, nextActionId, plan, externalSideEffect: false as const };
  });
}

export async function reconcileLatestEvidenceForOpenFilesCommand(input: { userId: number; limit?: number; dryRun?: boolean }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ workFileId: comoNextWorkFiles.id, emailId: comoNextEmailMessages.id })
    .from(comoNextWorkFiles)
    .innerJoin(comoNextEmailMessages, eq(comoNextEmailMessages.linkedWorkFileId, comoNextWorkFiles.id))
    .where(and(
      eq(comoNextWorkFiles.userId, input.userId),
      notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled"]),
      eq(comoNextEmailMessages.folderName, "INBOX"),
    ))
    .orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id))
    .limit(Math.max(1, Math.min(input.limit || 20, 50)));
  const unique = new Map<number, number>();
  for (const row of rows) if (!unique.has(Number(row.workFileId))) unique.set(Number(row.workFileId), Number(row.emailId));
  const results = [];
  for (const [workFileId, triggerEmailId] of unique) {
    try { results.push({ workFileId, ...(await reconcileWorkFileEvidenceCommand({ userId: input.userId, workFileId, triggerEmailId, dryRun: input.dryRun })) }); }
    catch (error) { results.push({ workFileId, error: error instanceof Error ? error.message : String(error), changed: 0, nextActionId: null, externalSideEffect: false as const }); }
  }
  return { files: results.length, changed: results.reduce((sum, item) => sum + Number(item.changed || 0), 0), results, externalSideEffect: false as const };
}
