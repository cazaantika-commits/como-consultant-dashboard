import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  comoNextSpecialistCapabilities,
  comoNextSpecialistReviews,
  comoNextWorkFiles,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { appendEvent, requireProjectAccess } from "./comoNextCommands";
import { getProjectExecutiveFile } from "./comoNextProjectDossier";

export type SpecialistCode = "project_monitor" | "contract_manager";

const SPECIALIST_MODEL = "claude-sonnet-4-6";
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const reviewSchema = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    riskLevel: { type: "string", enum: ["normal", "attention", "urgent"] },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceRef: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["statement", "evidenceRef", "confidence"],
        additionalProperties: false,
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          severity: { type: "string", enum: ["normal", "attention", "urgent"] },
          evidenceRefs: { type: "array", items: { type: "string" } },
        },
        required: ["title", "detail", "severity", "evidenceRefs"],
        additionalProperties: false,
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["question", "whyItMatters"],
        additionalProperties: false,
      },
    },
    proposedNextSteps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          kind: { type: "string", enum: ["action", "decision", "communication_draft", "note"] },
          priority: { type: "string", enum: ["normal", "important", "urgent"] },
          ownerType: { type: "string", enum: ["human", "manus", "team"] },
          acceptanceCriteria: { type: ["string", "null"] },
          evidenceRefs: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "kind", "priority", "ownerType", "acceptanceCriteria", "evidenceRefs"],
        additionalProperties: false,
      },
    },
  },
  required: ["executiveSummary", "riskLevel", "facts", "findings", "openQuestions", "proposedNextSteps"],
  additionalProperties: false,
} as const;

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export function assertSpecialistOwner(input: { openId?: string | null; role?: string | null }) {
  if (!ENV.ownerOpenId || input.openId !== ENV.ownerOpenId || input.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "التخصصات المساندة متاحة لعبد الرحمن فقط" });
  }
}

export function assertSpecialistDraftBoundary(input: { reviewStatus: string; operationalRecordsCreated?: number; externalSideEffect?: boolean }) {
  if (input.reviewStatus !== "draft" || Number(input.operationalRecordsCreated || 0) !== 0 || Boolean(input.externalSideEffect)) {
    throw new Error("Specialist output must remain a review-only draft");
  }
}

function projectMonitorContext(file: Awaited<ReturnType<typeof getProjectExecutiveFile>>) {
  return {
    project: file.project,
    executiveDossier: file.dossier,
    summary: file.summary,
    workFiles: file.workFiles,
    openActions: file.actions,
    decisions: file.decisions,
    recentCommunications: file.communications,
    meetings: file.meetings,
    activeParties: file.parties,
    reviewedMemory: file.reviewedMemory,
    lifecycle: file.sourceRegister.lifecycle,
    permits: file.sourceRegister.permits,
  };
}

function contractManagerContext(file: Awaited<ReturnType<typeof getProjectExecutiveFile>>) {
  return {
    project: file.project,
    executiveDossier: file.dossier,
    workFiles: file.workFiles,
    openActions: file.actions,
    decisions: file.decisions,
    recentCommunications: file.communications,
    activeParties: file.parties,
    reviewedMemory: file.reviewedMemory,
    contracts: file.sourceRegister.contracts,
    deliverables: file.sourceRegister.deliverables,
    consultantScope: file.sourceRegister.consultantScope,
    lifecycleExceptions: file.sourceRegister.lifecycle.scheduleExceptions,
  };
}

function specialistPrompt(code: SpecialistCode, requestText: string, contextJson: string) {
  const common = `أنت قدرة تحليلية متخصصة داخل مكتب عبد الرحمن التنفيذي. Manus هو العقل التنفيذي المركزي وأنت لا تعمل باستقلال عنه. استخدم سياق COMO المرفق فقط، ولا تخترع معلومة ولا تفترض اكتمال وثيقة لم تظهر في السياق. ناتجك مسودة داخلية للمراجعة: لا تنشئ مهمة أو قرارًا أو مراسلة، لا تعدّل عقدًا أو مشروعًا، لا ترسل شيئًا، ولا تقدّم التزامًا خارجيًا. اربط كل حقيقة أو ملاحظة بمرجع واضح داخل السياق (اسم ملف العمل، رقم العقد، عنوان المراسلة، عنوان الذاكرة، أو اسم الحقل). إذا لم يكف الدليل فضع سؤالًا مفتوحًا. المقترحات ليست معتمدة وستحوّل انتقائيًا لاحقًا عبر سجل المقترحات.`;
  const role = code === "project_monitor"
    ? "بصفتك مراقب المشروع والمتابعة التنفيذية: افحص الوضع الحالي، المتأخرات، الاعتماديات، الالتزامات، القرارات المفتوحة، نقاط المتابعة، فجوات الذاكرة، والاستعداد للخطوة التالية. لا تنشئ وكيلًا دائمًا ولا مراقبة خلفية."
    : "بصفتك مدير العقود: افحص سجل العقود والتسليمات والنطاق والمراسلات والالتزامات والتغييرات والمخاطر التجارية. لا تقدّم رأيًا قانونيًا نهائيًا ولا تفترض نصًا عقديًا غير موجود، ولا ترسل إشعارًا أو مطالبة.";
  return `${common}\n\n${role}\n\nطلب عبد الرحمن:\n${requestText}\n\nسياق المشروع من COMO:\n${contextJson}`;
}

function normalizeOutput(parsed: any) {
  return {
    executiveSummary: clean(parsed?.executiveSummary, 10_000) || "لم تتوافر خلاصة موثقة.",
    riskLevel: ["normal", "attention", "urgent"].includes(parsed?.riskLevel) ? parsed.riskLevel : "normal",
    facts: Array.isArray(parsed?.facts) ? parsed.facts.slice(0, 20) : [],
    findings: Array.isArray(parsed?.findings) ? parsed.findings.slice(0, 20) : [],
    openQuestions: Array.isArray(parsed?.openQuestions) ? parsed.openQuestions.slice(0, 20) : [],
    proposedNextSteps: Array.isArray(parsed?.proposedNextSteps) ? parsed.proposedNextSteps.slice(0, 8) : [],
  };
}

export async function listSpecialistCapabilities(user: { id: number; openId?: string | null; role?: string | null }) {
  assertSpecialistOwner(user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  return db.select().from(comoNextSpecialistCapabilities)
    .where(eq(comoNextSpecialistCapabilities.isEnabled, 1))
    .orderBy(comoNextSpecialistCapabilities.id);
}

export async function listSpecialistReviews(input: { user: { id: number; openId?: string | null; role?: string | null }; projectId: number; capabilityCode?: SpecialistCode }) {
  assertSpecialistOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  await requireProjectAccess(db, input.projectId, input.user.id, "read");
  const filters = [eq(comoNextSpecialistReviews.userId, input.user.id), eq(comoNextSpecialistReviews.projectId, input.projectId)];
  if (input.capabilityCode) filters.push(eq(comoNextSpecialistReviews.capabilityCode, input.capabilityCode));
  const reviews = await db.select().from(comoNextSpecialistReviews)
    .where(and(...filters))
    .orderBy(desc(comoNextSpecialistReviews.createdAt))
    .limit(40);
  return reviews.map(review => ({
    ...review,
    id: Number(review.id),
    output: review.outputJson ? JSON.parse(review.outputJson) : null,
    outputJson: undefined,
  }));
}

export async function runSpecialistReviewCommand(input: {
  user: { id: number; openId?: string | null; role?: string | null };
  projectId: number;
  workFileId?: number | null;
  capabilityCode: SpecialistCode;
  requestText: string;
  requestKey: string;
}) {
  assertSpecialistOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  await requireProjectAccess(db, input.projectId, input.user.id, "read");
  const [capability] = await db.select().from(comoNextSpecialistCapabilities)
    .where(and(eq(comoNextSpecialistCapabilities.capabilityCode, input.capabilityCode), eq(comoNextSpecialistCapabilities.isEnabled, 1))).limit(1);
  if (!capability) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "التخصص المطلوب غير مفعل" });
  if (input.workFileId) {
    const [workFile] = await db.select({ id: comoNextWorkFiles.id }).from(comoNextWorkFiles)
      .where(and(eq(comoNextWorkFiles.id, input.workFileId), eq(comoNextWorkFiles.projectId, input.projectId))).limit(1);
    if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "ملف العمل لا يتبع المشروع المختار" });
  }
  const [existing] = await db.select().from(comoNextSpecialistReviews)
    .where(and(eq(comoNextSpecialistReviews.userId, input.user.id), eq(comoNextSpecialistReviews.requestKey, input.requestKey))).limit(1);
  if (existing) return { id: Number(existing.id), replayed: true as const, status: existing.reviewStatus };

  const projectFile = await getProjectExecutiveFile({ userId: input.user.id, projectId: input.projectId });
  const context = input.capabilityCode === "project_monitor" ? projectMonitorContext(projectFile) : contractManagerContext(projectFile);
  const contextJson = JSON.stringify(context);
  const contextSha256 = createHash("sha256").update(contextJson).digest("hex");
  const requestText = clean(input.requestText, 20_000);
  if (!requestText) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب ما تريد من التخصص مراجعته" });

  const insert = await db.insert(comoNextSpecialistReviews).values({
    userId: input.user.id,
    projectId: input.projectId,
    workFileId: input.workFileId || null,
    capabilityCode: input.capabilityCode,
    requestText,
    requestKey: clean(input.requestKey, 128),
    contextSha256,
    reviewStatus: "requested",
  });
  const reviewId = Number(insert[0].insertId);

  try {
    const response = await invokeLLM({
      model: SPECIALIST_MODEL,
      messages: [
        { role: "system", content: "أخرج JSON مطابقًا للمخطط فقط. كل الناتج مسودة داخلية مرتبطة بالدليل ولا يترتب عليه أي تنفيذ أو إرسال." },
        { role: "user", content: specialistPrompt(input.capabilityCode, requestText, contextJson) },
      ],
      maxTokens: 4096,
      response_format: { type: "json_schema", json_schema: { name: `como_${input.capabilityCode}_review`, strict: true, schema: reviewSchema as unknown as Record<string, unknown> } },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") throw new Error("Model returned no structured content");
    const output = normalizeOutput(JSON.parse(content));
    assertSpecialistDraftBoundary({ reviewStatus: "draft", operationalRecordsCreated: 0, externalSideEffect: false });
    await db.update(comoNextSpecialistReviews).set({
      modelId: response.model || SPECIALIST_MODEL,
      reviewStatus: "draft",
      riskLevel: output.riskLevel,
      executiveSummary: output.executiveSummary,
      outputJson: JSON.stringify(output),
      errorMessage: null,
    }).where(eq(comoNextSpecialistReviews.id, reviewId));
    if (input.workFileId) {
      await appendEvent(db, {
        userId: input.user.id,
        projectId: input.projectId,
        workFileId: input.workFileId,
        actorType: "manus",
        eventType: "specialist_review_drafted",
        summary: `أعد ${capability.displayName} مسودة مراجعة داخلية`,
        payload: { reviewId, capabilityCode: input.capabilityCode, operationalRecordsCreated: 0, externalSideEffect: false },
        idempotencyKey: `event:specialist-review:${reviewId}`,
      });
    }
    return { id: reviewId, replayed: false as const, status: "draft" as const, operationalRecordsCreated: 0 as const, externalSideEffect: false as const };
  } catch (error) {
    await db.update(comoNextSpecialistReviews).set({
      reviewStatus: "failed",
      errorMessage: clean(error instanceof Error ? error.message : "تعذر إعداد المسودة", 5_000),
    }).where(eq(comoNextSpecialistReviews.id, reviewId));
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إعداد مسودة التخصص؛ لم يُنشأ أي أثر تشغيلي" });
  }
}

export async function reviewSpecialistDraftCommand(input: {
  user: { id: number; openId?: string | null; role?: string | null };
  reviewId: number;
  decision: "reviewed" | "dismissed";
  reviewNote?: string | null;
}) {
  assertSpecialistOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const [review] = await db.select().from(comoNextSpecialistReviews)
    .where(and(eq(comoNextSpecialistReviews.id, input.reviewId), eq(comoNextSpecialistReviews.userId, input.user.id))).limit(1);
  if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على مسودة التخصص" });
  await requireProjectAccess(db, review.projectId, input.user.id, "read");
  if (["reviewed", "dismissed"].includes(review.reviewStatus)) return { replayed: true as const, status: review.reviewStatus, externalSideEffect: false as const };
  if (review.reviewStatus !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن مراجعة المسودة قبل اكتمالها" });
  await db.update(comoNextSpecialistReviews).set({
    reviewStatus: input.decision,
    reviewedByUserId: input.user.id,
    reviewNote: clean(input.reviewNote, 5_000) || null,
    reviewedAt: nowSql(),
  }).where(eq(comoNextSpecialistReviews.id, review.id));
  if (review.workFileId) {
    await appendEvent(db, {
      userId: input.user.id,
      projectId: review.projectId,
      workFileId: review.workFileId,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: input.decision === "reviewed" ? "specialist_review_reviewed" : "specialist_review_dismissed",
      summary: `${input.decision === "reviewed" ? "راجع" : "استبعد"} عبد الرحمن مسودة التخصص`,
      payload: { reviewId: Number(review.id), capabilityCode: review.capabilityCode, operationalRecordsCreated: 0, externalSideEffect: false },
      idempotencyKey: `event:specialist-review-decision:${review.id}`,
    });
  }
  return { replayed: false as const, status: input.decision, operationalRecordsCreated: 0 as const, externalSideEffect: false as const };
}

export function specialistReviewToIntakeDrafts(review: { outputJson?: string | null }) {
  if (!review.outputJson) return [];
  const output = JSON.parse(review.outputJson);
  return Array.isArray(output.proposedNextSteps) ? output.proposedNextSteps.slice(0, 8) : [];
}
