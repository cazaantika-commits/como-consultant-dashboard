import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
  comoNextMeetingAgendaItems,
  comoNextMeetingAnalyses,
  comoNextMeetingConsents,
  comoNextMeetingMinutes,
  comoNextMeetingParticipants,
  comoNextMeetingProposals,
  comoNextMeetingSources,
  comoNextMeetings,
  comoNextWorkFiles,
  comoNextWorkMemory,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { appendEvent, requireProjectAccess, toSqlUtcTimestamp } from "./comoNextCommands";

export type MeetingSourceKind = "preparation" | "notes" | "transcript";
export type MeetingProposalKind = "question" | "check" | "decision" | "action" | "external_commitment" | "risk" | "note";
export type MeetingProposalTarget = "agenda_item" | "decision" | "action" | "external_commitment" | "risk" | "note" | "communication_draft";

const MEETING_ANALYSIS_MODEL = "gpt-5-mini";
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const rowsOf = <T>(result: unknown): T[] => Array.isArray(result) && Array.isArray(result[0]) ? result[0] as T[] : result as T[];

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

async function requireMeetingAccess(meetingId: number, userId: number, required: "read" | "write" = "read") {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [meeting] = await db.select().from(comoNextMeetings).where(eq(comoNextMeetings.id, meetingId)).limit(1);
  if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الاجتماع" });
  const access = await requireProjectAccess(db, meeting.projectId, userId, required);
  if (!meeting.workFileId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الاجتماع غير مرتبط بملف عمل" });
  return { db, meeting, access };
}

export function assertTranscriptConsent(status?: string | null) {
  if (status !== "granted") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن حفظ تفريغ قبل تسجيل موافقة صريحة على التفريغ" });
  }
}

const allowedApplications: Record<MeetingProposalKind, ReadonlySet<MeetingProposalTarget>> = {
  question: new Set(["agenda_item", "note"]),
  check: new Set(["agenda_item", "note"]),
  decision: new Set(["decision", "note"]),
  action: new Set(["action", "note"]),
  external_commitment: new Set(["external_commitment", "communication_draft", "action", "note"]),
  risk: new Set(["risk", "action", "note"]),
  note: new Set(["note", "agenda_item"]),
};

export function assertProposalApplication(kind: MeetingProposalKind, target: MeetingProposalTarget, audience: string) {
  if (!allowedApplications[kind]?.has(target)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نوع التطبيق المختار لا يناسب هذا المقترح" });
  }
  if (audience === "internal_only" && target === "communication_draft") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "النقطة الداخلية لا يجوز تحويلها إلى مسودة خارجية" });
  }
}

export function assertMeetingClosable(input: { unresolvedRequired: number; pendingProposals: number }) {
  if (input.unresolvedRequired > 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إعداد المحضر قبل معالجة المحاور المطلوبة" });
  }
  if (input.pendingProposals > 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إعداد المحضر قبل مراجعة كل مقترحات Manus أو استبعادها" });
  }
}

export function composeReviewedMinutes(input: {
  title: string;
  objective?: string | null;
  startsAt?: string | null;
  meetingFormat?: string | null;
  participants: Array<{ displayName: string; organizationName?: string | null; attendance?: string | null }>;
  agenda: Array<{ category?: string | null; promptAr?: string | null; response?: string | null; audience?: string | null; isChecked: number | boolean }>;
  proposals: Array<{ proposalKind: string; title: string; content?: string | null; audience: string; reviewStatus: string }>;
  summary: string;
}) {
  const participantLines = input.participants.map(item => `- ${item.displayName}${item.organizationName ? ` — ${item.organizationName}` : ""}${item.attendance ? ` (${item.attendance})` : ""}`);
  const agendaLines = input.agenda
    .filter(item => item.audience !== "internal_only" && Boolean(item.isChecked) && Boolean(item.response?.trim()))
    .map(item => `- **${item.category || "محور"}:** ${item.promptAr || ""}\n  - ${item.response}`);
  const outcomeLines = input.proposals
    .filter(item => item.audience !== "internal_only" && item.reviewStatus === "applied")
    .map(item => `- **${item.title}** (${item.proposalKind})${item.content ? `: ${item.content}` : ""}`);
  return [
    `# محضر اجتماع — ${input.title}`,
    input.startsAt ? `**الموعد:** ${input.startsAt}` : null,
    input.meetingFormat ? `**الصيغة:** ${input.meetingFormat}` : null,
    input.objective ? `\n## الهدف\n${input.objective}` : null,
    `\n## المشاركون\n${participantLines.length ? participantLines.join("\n") : "لم تُسجّل أسماء المشاركين."}`,
    `\n## الخلاصة التنفيذية\n${input.summary.trim()}`,
    agendaLines.length ? `\n## المحاور التي نوقشت\n${agendaLines.join("\n")}` : null,
    outcomeLines.length ? `\n## النتائج التي راجعها عبد الرحمن\n${outcomeLines.join("\n")}` : null,
    "\n> هذا المحضر سجل داخلي داخل COMO. لا يؤدي اعتماده إلى إرسال أو التزام خارجي تلقائي.",
  ].filter(Boolean).join("\n\n");
}

export async function createMeetingCommand(input: {
  userId: number;
  workFileId: number;
  title: string;
  objective?: string | null;
  meetingType?: string | null;
  meetingFormat?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  participantNames?: string[];
  idempotencyKey?: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, input.workFileId)).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
  await requireProjectAccess(db, workFile.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.workFileStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إضافة اجتماع إلى ملف مغلق" });
  const startsAt = toSqlUtcTimestamp(input.startsAt);
  const endsAt = toSqlUtcTimestamp(input.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "نهاية الاجتماع يجب أن تكون بعد بدايته" });

  return db.transaction(async tx => {
    if (input.idempotencyKey) {
      const [existing] = await tx.select({ id: comoNextMeetings.id }).from(comoNextMeetings)
        .where(and(eq(comoNextMeetings.sourceSystem, "como_next"), eq(comoNextMeetings.sourceRecordId, input.idempotencyKey))).limit(1);
      if (existing) return { id: existing.id, replayed: true as const };
    }
    const result = await tx.insert(comoNextMeetings).values({
      projectId: workFile.projectId,
      workFileId: workFile.id,
      title: input.title.trim(),
      objective: input.objective?.trim() || null,
      meetingType: input.meetingType?.trim() || null,
      meetingFormat: input.meetingFormat?.trim() || null,
      meetingStatus: "planned",
      startsAt,
      endsAt,
      location: input.location?.trim() || null,
      sourceSystem: "como_next",
      sourceRecordId: input.idempotencyKey ?? null,
    });
    const id = Number(result[0].insertId);
    const participantNames = [...new Set((input.participantNames || []).map(value => value.trim()).filter(Boolean))];
    if (participantNames.length) {
      await tx.insert(comoNextMeetingParticipants).values(participantNames.map(displayName => ({ meetingId: id, displayName, attendance: "expected" })));
    }
    await appendEvent(tx, {
      userId: input.userId,
      projectId: workFile.projectId,
      workFileId: workFile.id,
      eventType: "meeting_created",
      summary: `إنشاء مساحة الاجتماع: ${input.title.trim()}`,
      payload: { meetingId: id, participantCount: participantNames.length, externalSideEffect: false },
      idempotencyKey: input.idempotencyKey ? `event:${input.idempotencyKey}` : null,
    });
    return { id, replayed: false as const };
  });
}

export async function addMeetingAgendaItemCommand(input: {
  userId: number;
  meetingId: number;
  itemKind: string;
  category?: string | null;
  promptAr: string;
  briefingNote?: string | null;
  desiredOutcome?: string | null;
  audience: "discuss" | "internal_only" | "reference";
  priority: "critical" | "high" | "normal";
  isRequired: boolean;
  sourceEvidence?: string | null;
}) {
  const { db, meeting } = await requireMeetingAccess(input.meetingId, input.userId, "write");
  if (meeting.meetingStatus === "completed" || meeting.meetingStatus === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "الاجتماع مغلق ولا يقبل محاور جديدة" });
  const raw = await db.execute(sql`SELECT COALESCE(MAX(sort_order), 0) AS sortOrder FROM como_next_meeting_agenda_items WHERE meeting_id = ${input.meetingId}`);
  const sortOrder = Number(rowsOf<any>(raw)[0]?.sortOrder || 0) + 1;
  return db.transaction(async tx => {
    const result = await tx.insert(comoNextMeetingAgendaItems).values({
      meetingId: input.meetingId,
      itemKind: input.itemKind,
      category: input.category?.trim() || null,
      promptAr: input.promptAr.trim(),
      briefingNote: input.briefingNote?.trim() || null,
      desiredOutcome: input.desiredOutcome?.trim() || null,
      audience: input.audience,
      priority: input.priority,
      isRequired: input.isRequired ? 1 : 0,
      sourceEvidence: input.sourceEvidence?.trim() || null,
      sortOrder,
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: "meeting_agenda_item_added",
      summary: `إضافة محور اجتماع: ${input.promptAr.trim()}`,
      payload: { meetingId: meeting.id, agendaItemId: id, required: input.isRequired, audience: input.audience },
    });
    return { id };
  });
}

export async function updateMeetingAgendaItemCommand(input: { userId: number; agendaItemId: number; response?: string | null; isChecked: boolean }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rowResult = await db.execute(sql`SELECT ai.*, m.project_id AS projectId, m.work_file_id AS workFileId, m.meeting_status AS meetingStatus FROM como_next_meeting_agenda_items ai JOIN como_next_meetings m ON m.id = ai.meeting_id WHERE ai.id = ${input.agendaItemId} LIMIT 1`);
  const row = rowsOf<any>(rowResult)[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على محور الاجتماع" });
  await requireProjectAccess(db, Number(row.projectId), input.userId, "write");
  if (["completed", "cancelled"].includes(String(row.meetingStatus))) throw new TRPCError({ code: "BAD_REQUEST", message: "الاجتماع مغلق" });
  if (input.isChecked && Number(row.is_required) === 1 && !input.response?.trim()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المحور المطلوب يحتاج نتيجة أو إجابة قبل اعتباره معالجًا" });
  return db.transaction(async tx => {
    await tx.update(comoNextMeetingAgendaItems).set({ response: input.response?.trim() || null, isChecked: input.isChecked ? 1 : 0 }).where(eq(comoNextMeetingAgendaItems.id, input.agendaItemId));
    await appendEvent(tx, {
      userId: input.userId,
      projectId: Number(row.projectId),
      workFileId: Number(row.workFileId),
      eventType: "meeting_agenda_item_updated",
      summary: `${input.isChecked ? "معالجة" : "تحديث"} محور الاجتماع: ${String(row.prompt_ar || "محور")}`,
      payload: { meetingId: Number(row.meeting_id), agendaItemId: input.agendaItemId, checked: input.isChecked },
    });
    return { success: true };
  });
}

export async function recordMeetingConsentCommand(input: {
  userId: number;
  meetingId: number;
  consentScope: "recording" | "transcription";
  consentStatus: "granted" | "declined" | "not_required";
  consentBasis?: string | null;
  evidenceReference?: string | null;
}) {
  const { db, meeting } = await requireMeetingAccess(input.meetingId, input.userId, "write");
  if (input.consentStatus === "granted" && (!input.consentBasis?.trim() || !input.evidenceReference?.trim())) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الموافقة تحتاج أساسًا واضحًا ومرجع دليل" });
  }
  const now = nowSql();
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(comoNextMeetingConsents)
      .where(and(eq(comoNextMeetingConsents.meetingId, input.meetingId), eq(comoNextMeetingConsents.consentScope, input.consentScope))).limit(1);
    let id: number;
    if (existing) {
      id = Number(existing.id);
      await tx.update(comoNextMeetingConsents).set({
        consentStatus: input.consentStatus,
        consentBasis: input.consentBasis?.trim() || null,
        evidenceReference: input.evidenceReference?.trim() || null,
        recordedByUserId: input.userId,
        recordedAt: now,
      }).where(eq(comoNextMeetingConsents.id, existing.id));
    } else {
      const result = await tx.insert(comoNextMeetingConsents).values({
        meetingId: input.meetingId,
        consentScope: input.consentScope,
        consentStatus: input.consentStatus,
        consentBasis: input.consentBasis?.trim() || null,
        evidenceReference: input.evidenceReference?.trim() || null,
        recordedByUserId: input.userId,
        recordedAt: now,
      });
      id = Number(result[0].insertId);
    }
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: "meeting_consent_recorded",
      summary: `تسجيل حالة موافقة ${input.consentScope === "transcription" ? "التفريغ" : "التسجيل"}: ${input.consentStatus}`,
      payload: { meetingId: meeting.id, consentId: id, scope: input.consentScope, status: input.consentStatus, recordingStarted: false },
    });
    return { id, recordingStarted: false, transcriptionStarted: false };
  });
}

export async function addMeetingSourceCommand(input: {
  userId: number;
  meetingId: number;
  sourceKind: MeetingSourceKind;
  visibility: "meeting_record" | "internal_only";
  title: string;
  rawText: string;
  idempotencyKey?: string;
}) {
  const { db, meeting } = await requireMeetingAccess(input.meetingId, input.userId, "write");
  if (["completed", "cancelled"].includes(meeting.meetingStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "الاجتماع مغلق ولا يقبل مواد جديدة" });
  let consentId: number | null = null;
  if (input.sourceKind === "transcript") {
    const [consent] = await db.select().from(comoNextMeetingConsents)
      .where(and(eq(comoNextMeetingConsents.meetingId, input.meetingId), eq(comoNextMeetingConsents.consentScope, "transcription"))).limit(1);
    assertTranscriptConsent(consent?.consentStatus);
    consentId = Number(consent!.id);
  }
  const sourceSha256 = createHash("sha256").update(input.rawText.trim(), "utf8").digest("hex");
  return db.transaction(async tx => {
    if (input.idempotencyKey) {
      const [existing] = await tx.select({ id: comoNextMeetingSources.id }).from(comoNextMeetingSources)
        .where(and(eq(comoNextMeetingSources.sourceSystem, "como_next"), eq(comoNextMeetingSources.sourceRecordId, input.idempotencyKey))).limit(1);
      if (existing) return { id: Number(existing.id), replayed: true as const };
    }
    const result = await tx.insert(comoNextMeetingSources).values({
      meetingId: input.meetingId,
      sourceKind: input.sourceKind,
      visibility: input.visibility,
      title: input.title.trim(),
      rawText: input.rawText.trim(),
      consentId,
      sourceSha256,
      sourceStatus: "captured",
      createdByUserId: input.userId,
      sourceSystem: "como_next",
      sourceRecordId: input.idempotencyKey ?? null,
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: "meeting_source_captured",
      summary: `حفظ مادة اجتماع: ${input.title.trim()}`,
      payload: { meetingId: meeting.id, sourceId: id, sourceKind: input.sourceKind, visibility: input.visibility, sourceSha256, externalSideEffect: false },
      idempotencyKey: input.idempotencyKey ? `event:${input.idempotencyKey}` : null,
    });
    return { id, replayed: false as const };
  });
}

const analysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    openQuestions: { type: "array", items: { type: "string" } },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["question", "check", "decision", "action", "external_commitment", "risk", "note"] },
          title: { type: "string" },
          content: { anyOf: [{ type: "string" }, { type: "null" }] },
          assignedTo: { anyOf: [{ type: "string" }, { type: "null" }] },
          dueAt: { anyOf: [{ type: "string" }, { type: "null" }] },
          evidenceExcerpt: { type: "string" },
          audience: { type: "string", enum: ["meeting_record", "internal_only"] },
          priority: { type: "string", enum: ["critical", "high", "normal"] },
          required: { type: "boolean" },
        },
        required: ["kind", "title", "content", "assignedTo", "dueAt", "evidenceExcerpt", "audience", "priority", "required"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "openQuestions", "proposals"],
  additionalProperties: false,
} as const;

function analysisPrompt(source: typeof comoNextMeetingSources.$inferSelect) {
  if (source.sourceKind === "preparation") {
    return `حلل مادة التحضير التالية لبناء إحاطة عملية للاجتماع. استخدم النص فقط ولا تخترع معلومة. رتّب النقاط ضمن: الافتتاح، الأمور الحرجة، النطاق، التجاري، التعاقدي، التنفيذ، والإغلاق. كل ناتج يبقى مقترحًا للمراجعة ولا تنشئ أي قرار أو إجراء أو رسالة. اجعل audience=internal_only لأي نقطة لا ينبغي أن تظهر في المحضر أو المراسلات. evidenceExcerpt اقتباس قصير حرفي من المصدر.\n\nالمصدر:\n${source.rawText}`;
  }
  return `حلل مادة الاجتماع التالية اعتمادًا على الدليل الموجود فيها فقط. لا تنفذ إجراءً، ولا تنشئ مهمة أو قرارًا معتمدًا أو مراسلة، ولا تستنتج ما لا تدعمه المادة. صنّف النتائج المقترحة إلى decision أو action أو external_commitment أو risk أو note، وأبقِ الأسئلة غير المحسومة ضمن openQuestions. evidenceExcerpt يجب أن يكون اقتباسًا حرفيًا قصيرًا. كل النتائج مسودات بانتظار مراجعة عبد الرحمن الانتقائية. اجعل audience=internal_only لأي نقطة داخلية لا يجوز أن تظهر تلقائيًا في المحضر أو رسالة خارجية.\n\nالمصدر:\n${source.rawText}`;
}

export async function analyzeMeetingSourceCommand(input: { userId: number; sourceId: number; requestKey: string }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [source] = await db.select().from(comoNextMeetingSources).where(eq(comoNextMeetingSources.id, input.sourceId)).limit(1);
  if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على مادة الاجتماع" });
  const { meeting } = await requireMeetingAccess(source.meetingId, input.userId, "write");
  const [existing] = await db.select({ id: comoNextMeetingAnalyses.id }).from(comoNextMeetingAnalyses).where(eq(comoNextMeetingAnalyses.requestKey, input.requestKey)).limit(1);
  if (existing) return { id: Number(existing.id), replayed: true as const };
  if (source.sourceKind === "transcript") {
    const [consent] = await db.select().from(comoNextMeetingConsents).where(eq(comoNextMeetingConsents.id, source.consentId!)).limit(1);
    assertTranscriptConsent(consent?.consentStatus);
  }

  const response = await invokeLLM({
    model: MEETING_ANALYSIS_MODEL,
    messages: [
      { role: "system", content: "أنت Manus داخل مكتب عبد الرحمن التنفيذي. أخرج JSON مطابقًا للمخطط فقط. التحليل مسودة مرتبطة بالدليل ولا يترتب عليه أي تنفيذ تلقائي." },
      { role: "user", content: analysisPrompt(source) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_meeting_analysis", strict: true, schema: analysisSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم يُرجع Manus تحليلاً قابلاً للمراجعة" });
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة مسودة تحليل Manus" }); }
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];

  return db.transaction(async tx => {
    const [replay] = await tx.select({ id: comoNextMeetingAnalyses.id }).from(comoNextMeetingAnalyses).where(eq(comoNextMeetingAnalyses.requestKey, input.requestKey)).limit(1);
    if (replay) return { id: Number(replay.id), replayed: true as const };
    const result = await tx.insert(comoNextMeetingAnalyses).values({
      meetingId: source.meetingId,
      sourceId: source.id,
      analysisType: source.sourceKind === "preparation" ? "preparation" : "evidence_extraction",
      analysisStatus: "draft",
      summary: String(parsed.summary || "").trim() || "لا توجد خلاصة مدعومة بالدليل.",
      openQuestionsJson: JSON.stringify(Array.isArray(parsed.openQuestions) ? parsed.openQuestions : []),
      modelId: response.model || MEETING_ANALYSIS_MODEL,
      evidenceBound: 1,
      requestKey: input.requestKey,
      requestedByUserId: input.userId,
    });
    const id = Number(result[0].insertId);
    if (proposals.length) {
      await tx.insert(comoNextMeetingProposals).values(proposals.map((proposal: any, index: number) => ({
        analysisId: id,
        meetingId: source.meetingId,
        ordinal: index + 1,
        proposalKind: proposal.kind as MeetingProposalKind,
        title: String(proposal.title || "مقترح للمراجعة").trim(),
        content: proposal.content ? String(proposal.content).trim() : null,
        assignedTo: proposal.assignedTo ? String(proposal.assignedTo).trim() : null,
        dueAt: proposal.dueAt ? toSqlUtcTimestamp(String(proposal.dueAt)) : null,
        evidenceExcerpt: String(proposal.evidenceExcerpt || "").trim(),
        audience: source.visibility === "internal_only" ? "internal_only" : proposal.audience,
        priority: proposal.priority,
        isRequired: proposal.required ? 1 : 0,
        reviewStatus: "pending",
      })));
    }
    await tx.update(comoNextMeetingSources).set({ sourceStatus: "ready_for_analysis" }).where(eq(comoNextMeetingSources.id, source.id));
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      actorType: "manus",
      eventType: "meeting_analysis_drafted",
      summary: `أعد Manus مسودة تحليل لمادة: ${source.title}`,
      payload: { meetingId: meeting.id, sourceId: source.id, analysisId: id, proposalCount: proposals.length, outcomesApplied: 0, externalSideEffect: false },
      idempotencyKey: `meeting-analysis:${input.requestKey}`,
    });
    return { id, replayed: false as const };
  });
}

export async function reviewMeetingProposalCommand(input: {
  userId: number;
  proposalId: number;
  decision: "apply" | "dismiss";
  applyAs?: MeetingProposalTarget;
  reviewNote?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [proposal] = await db.select().from(comoNextMeetingProposals).where(eq(comoNextMeetingProposals.id, input.proposalId)).limit(1);
  if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المقترح" });
  const { meeting } = await requireMeetingAccess(proposal.meetingId, input.userId, "write");
  if (proposal.reviewStatus !== "pending") return { targetId: proposal.targetId ? Number(proposal.targetId) : null, replayed: true as const, externalSideEffect: false };
  if (input.decision === "apply") {
    if (!input.applyAs) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد أين يطبق المقترح" });
    assertProposalApplication(proposal.proposalKind, input.applyAs, proposal.audience);
  }
  const now = nowSql();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM como_next_meeting_proposals WHERE id = ${proposal.id} FOR UPDATE`);
    let targetId: number | null = null;
    if (input.decision === "apply") {
      const sourceRecordId = `meeting-proposal:${proposal.id}`;
      if (input.applyAs === "agenda_item") {
        const maxResult = await tx.execute(sql`SELECT COALESCE(MAX(sort_order), 0) AS sortOrder FROM como_next_meeting_agenda_items WHERE meeting_id = ${meeting.id}`);
        const result = await tx.insert(comoNextMeetingAgendaItems).values({
          meetingId: meeting.id,
          itemKind: proposal.proposalKind,
          category: "مقترح راجعه عبد الرحمن",
          promptAr: proposal.title,
          briefingNote: proposal.content,
          desiredOutcome: proposal.content,
          audience: proposal.audience === "internal_only" ? "internal_only" : "discuss",
          priority: proposal.priority,
          isRequired: proposal.isRequired,
          sourceEvidence: proposal.evidenceExcerpt,
          sortOrder: Number(rowsOf<any>(maxResult)[0]?.sortOrder || 0) + 1,
          sourceSystem: "como_next_meeting",
          sourceRecordId,
        });
        targetId = Number(result[0].insertId);
      } else if (input.applyAs === "decision") {
        const result = await tx.insert(comoNextDecisions).values({
          userId: input.userId,
          projectId: meeting.projectId,
          workFileId: meeting.workFileId!,
          title: proposal.title,
          question: proposal.content || proposal.title,
          contextSummary: `مقترح من تحليل اجتماع «${meeting.title}». الدليل: ${proposal.evidenceExcerpt}`,
          decisionAuthority: "abdulrahman",
          decisionStatus: "required",
          dueAt: proposal.dueAt,
          sourceSystem: "como_next_meeting",
          sourceRecordId,
        });
        targetId = Number(result[0].insertId);
      } else if (input.applyAs === "action") {
        const result = await tx.insert(comoNextActions).values({
          userId: input.userId,
          projectId: meeting.projectId,
          workFileId: meeting.workFileId!,
          title: proposal.title,
          description: proposal.content,
          acceptanceCriteria: `التحقق من النتيجة وربط الدليل الأصلي: ${proposal.evidenceExcerpt}`,
          ownerType: proposal.assignedTo?.toLowerCase().includes("manus") ? "manus" : "human",
          ownerUserId: proposal.assignedTo?.toLowerCase().includes("manus") ? null : input.userId,
          priority: proposal.priority === "critical" ? "urgent" : proposal.priority === "high" ? "important" : "normal",
          dueAt: proposal.dueAt,
          attentionAt: proposal.dueAt,
          actionStatus: "open",
          sourceSystem: "como_next_meeting",
          sourceRecordId,
        });
        targetId = Number(result[0].insertId);
      } else if (input.applyAs === "communication_draft") {
        const result = await tx.insert(comoNextCommunications).values({
          userId: input.userId,
          projectId: meeting.projectId,
          workFileId: meeting.workFileId!,
          channel: "email",
          direction: "outbound",
          communicationStatus: "draft",
          approvalStatus: "pending",
          subject: proposal.title,
          body: proposal.content || proposal.title,
          reviewNote: `مسودة مستخرجة بعد مراجعة مقترح اجتماع. الدليل: ${proposal.evidenceExcerpt}`,
          occurredAt: now,
          sourceSystem: "como_next_meeting",
          sourceRecordId,
        });
        targetId = Number(result[0].insertId);
      } else {
        const memoryType = input.applyAs === "external_commitment" ? "work_product" : "note";
        const result = await tx.insert(comoNextWorkMemory).values({
          projectId: meeting.projectId,
          workFileId: meeting.workFileId!,
          memoryType,
          entryType: `meeting_${input.applyAs}`,
          title: proposal.title,
          body: `${proposal.content || ""}\n\nالدليل الحرفي: ${proposal.evidenceExcerpt}`.trim(),
          sourceStatus: "reviewed",
          sourceSystem: "como_next_meeting",
          sourceRecordId,
          occurredAt: now,
        });
        targetId = Number(result[0].insertId);
      }
    }
    await tx.update(comoNextMeetingProposals).set({
      reviewStatus: input.decision === "apply" ? "applied" : "dismissed",
      appliedAs: input.decision === "apply" ? input.applyAs : null,
      targetId,
      reviewNote: input.reviewNote?.trim() || null,
      reviewedByUserId: input.userId,
      reviewedAt: now,
    }).where(eq(comoNextMeetingProposals.id, proposal.id));
    const pendingResult = await tx.execute(sql`SELECT COUNT(*) AS pendingCount FROM como_next_meeting_proposals WHERE analysis_id = ${proposal.analysisId} AND review_status = 'pending' AND id <> ${proposal.id}`);
    if (Number(rowsOf<any>(pendingResult)[0]?.pendingCount || 0) === 0) {
      await tx.update(comoNextMeetingAnalyses).set({ analysisStatus: input.decision === "apply" ? "applied" : "reviewed", reviewedByUserId: input.userId, reviewedAt: now }).where(eq(comoNextMeetingAnalyses.id, proposal.analysisId));
    }
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: input.decision === "apply" ? "meeting_proposal_applied" : "meeting_proposal_dismissed",
      summary: `${input.decision === "apply" ? "تطبيق" : "استبعاد"} مقترح الاجتماع: ${proposal.title}`,
      payload: { meetingId: meeting.id, proposalId: Number(proposal.id), appliedAs: input.applyAs || null, targetId, externalSideEffect: false },
      idempotencyKey: `meeting-proposal-review:${proposal.id}`,
    });
    return { targetId, replayed: false as const, externalSideEffect: false };
  });
}

export async function prepareMeetingMinutesCommand(input: { userId: number; meetingId: number; summary: string }) {
  const { db, meeting } = await requireMeetingAccess(input.meetingId, input.userId, "write");
  if (meeting.meetingStatus === "completed" || meeting.meetingStatus === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "الاجتماع مغلق بالفعل" });
  const [agenda, participants, proposals, countersResult, versionResult] = await Promise.all([
    db.select().from(comoNextMeetingAgendaItems).where(eq(comoNextMeetingAgendaItems.meetingId, input.meetingId)).orderBy(asc(comoNextMeetingAgendaItems.sortOrder), asc(comoNextMeetingAgendaItems.id)),
    db.select().from(comoNextMeetingParticipants).where(eq(comoNextMeetingParticipants.meetingId, input.meetingId)).orderBy(asc(comoNextMeetingParticipants.id)),
    db.select().from(comoNextMeetingProposals).where(eq(comoNextMeetingProposals.meetingId, input.meetingId)).orderBy(asc(comoNextMeetingProposals.id)),
    db.execute(sql`SELECT (SELECT COUNT(*) FROM como_next_meeting_agenda_items WHERE meeting_id = ${input.meetingId} AND is_required = 1 AND is_checked = 0) AS unresolvedRequired, (SELECT COUNT(*) FROM como_next_meeting_proposals WHERE meeting_id = ${input.meetingId} AND review_status = 'pending') AS pendingProposals`),
    db.execute(sql`SELECT COALESCE(MAX(version), 0) AS version FROM como_next_meeting_minutes WHERE meeting_id = ${input.meetingId}`),
  ]);
  const counters = rowsOf<any>(countersResult)[0];
  assertMeetingClosable({ unresolvedRequired: Number(counters?.unresolvedRequired || 0), pendingProposals: Number(counters?.pendingProposals || 0) });
  const content = composeReviewedMinutes({
    title: meeting.title,
    objective: meeting.objective,
    startsAt: meeting.startsAt,
    meetingFormat: meeting.meetingFormat,
    participants,
    agenda,
    proposals,
    summary: input.summary,
  });
  const version = Number(rowsOf<any>(versionResult)[0]?.version || 0) + 1;
  return db.transaction(async tx => {
    await tx.update(comoNextMeetingMinutes).set({ minutesStatus: "superseded" }).where(and(eq(comoNextMeetingMinutes.meetingId, meeting.id), eq(comoNextMeetingMinutes.minutesStatus, "draft")));
    const result = await tx.insert(comoNextMeetingMinutes).values({
      meetingId: meeting.id,
      version,
      minutesStatus: "draft",
      summary: input.summary.trim(),
      content,
      preparedByUserId: input.userId,
    });
    const id = Number(result[0].insertId);
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: "meeting_minutes_drafted",
      summary: `إعداد مسودة محضر: ${meeting.title}`,
      payload: { meetingId: meeting.id, minutesId: id, version, externalSideEffect: false },
    });
    return { id, version, externalSideEffect: false };
  });
}

export async function reviewMeetingMinutesCommand(input: { userId: number; minutesId: number; decision: "approve" | "reject"; reviewNote?: string | null }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [minutes] = await db.select().from(comoNextMeetingMinutes).where(eq(comoNextMeetingMinutes.id, input.minutesId)).limit(1);
  if (!minutes) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المحضر" });
  const { meeting } = await requireMeetingAccess(minutes.meetingId, input.userId, "write");
  if (minutes.minutesStatus !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا المحضر لم يعد مسودة للمراجعة" });
  if (input.decision === "approve") {
    const counts = rowsOf<any>(await db.execute(sql`SELECT (SELECT COUNT(*) FROM como_next_meeting_agenda_items WHERE meeting_id = ${meeting.id} AND is_required = 1 AND is_checked = 0) AS unresolvedRequired, (SELECT COUNT(*) FROM como_next_meeting_proposals WHERE meeting_id = ${meeting.id} AND review_status = 'pending') AS pendingProposals`))[0];
    assertMeetingClosable({ unresolvedRequired: Number(counts?.unresolvedRequired || 0), pendingProposals: Number(counts?.pendingProposals || 0) });
  }
  const now = nowSql();
  return db.transaction(async tx => {
    await tx.update(comoNextMeetingMinutes).set({
      minutesStatus: input.decision === "approve" ? "approved" : "rejected",
      reviewedByUserId: input.userId,
      reviewNote: input.reviewNote?.trim() || null,
      approvedAt: input.decision === "approve" ? now : null,
    }).where(eq(comoNextMeetingMinutes.id, minutes.id));
    if (input.decision === "approve") {
      await tx.update(comoNextMeetings).set({ meetingStatus: "completed", outcomeSummary: minutes.content, closedAt: now }).where(eq(comoNextMeetings.id, meeting.id));
    }
    await appendEvent(tx, {
      userId: input.userId,
      projectId: meeting.projectId,
      workFileId: meeting.workFileId!,
      eventType: input.decision === "approve" ? "meeting_minutes_approved" : "meeting_minutes_rejected",
      summary: `${input.decision === "approve" ? "اعتماد" : "رفض"} محضر الاجتماع: ${meeting.title}`,
      payload: { meetingId: meeting.id, minutesId: Number(minutes.id), externalSideEffect: false },
    });
    return { success: true, externalSideEffect: false };
  });
}

export async function getMeetingWorkspace(meetingId: number, userId: number) {
  const { db, meeting } = await requireMeetingAccess(meetingId, userId, "read");
  const [participants, agenda, consents, sources, analyses, proposals, minutes] = await Promise.all([
    db.select().from(comoNextMeetingParticipants).where(eq(comoNextMeetingParticipants.meetingId, meetingId)).orderBy(asc(comoNextMeetingParticipants.id)),
    db.select().from(comoNextMeetingAgendaItems).where(eq(comoNextMeetingAgendaItems.meetingId, meetingId)).orderBy(asc(comoNextMeetingAgendaItems.sortOrder), asc(comoNextMeetingAgendaItems.id)),
    db.select().from(comoNextMeetingConsents).where(eq(comoNextMeetingConsents.meetingId, meetingId)).orderBy(asc(comoNextMeetingConsents.id)),
    db.select({ id: comoNextMeetingSources.id, meetingId: comoNextMeetingSources.meetingId, sourceKind: comoNextMeetingSources.sourceKind, visibility: comoNextMeetingSources.visibility, title: comoNextMeetingSources.title, rawText: comoNextMeetingSources.rawText, sourceSha256: comoNextMeetingSources.sourceSha256, sourceStatus: comoNextMeetingSources.sourceStatus, createdAt: comoNextMeetingSources.createdAt }).from(comoNextMeetingSources).where(eq(comoNextMeetingSources.meetingId, meetingId)).orderBy(desc(comoNextMeetingSources.createdAt), desc(comoNextMeetingSources.id)),
    db.select().from(comoNextMeetingAnalyses).where(eq(comoNextMeetingAnalyses.meetingId, meetingId)).orderBy(desc(comoNextMeetingAnalyses.createdAt), desc(comoNextMeetingAnalyses.id)),
    db.select().from(comoNextMeetingProposals).where(eq(comoNextMeetingProposals.meetingId, meetingId)).orderBy(desc(comoNextMeetingProposals.createdAt), asc(comoNextMeetingProposals.ordinal)),
    db.select().from(comoNextMeetingMinutes).where(eq(comoNextMeetingMinutes.meetingId, meetingId)).orderBy(desc(comoNextMeetingMinutes.version)),
  ]);
  return {
    meeting,
    participants,
    agenda,
    consents,
    sources,
    analyses: analyses.map(item => ({ ...item, openQuestions: item.openQuestionsJson ? JSON.parse(item.openQuestionsJson) : [] })),
    proposals,
    minutes,
    safeguards: { automaticOutcomeCreation: false, externalSending: false, recordingActive: false, transcriptionActive: false },
  };
}
