import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getDb } from "../db";
import { storageGet } from "../storage";
import { resolveOwnerUserIdForSara } from "./comoNextIntake";
import { presentSaraDubaiTimes } from "./saraDubaiTimes";

export type SaraWorkFileFocus = "overview" | "analysis" | "meetings" | "communications" | "history" | "full";

type SaraReaderMember = { memberId: string; nameAr: string; role: string };

type LinkedDocument = {
  documentId: number;
  memoryId: number;
  memoryType: string;
  memoryTitle: string;
  memoryBody: string | null;
  isCurrent: number;
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
};

const documentTextCache = new Map<number, string>();
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_CONTEXT_CHARS = 24_000;

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function clean(value: unknown, max = 20_000) {
  return String(value || "").replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
}

function words(value: string) {
  return [...new Set(value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(word => word.length >= 3))];
}

function selectRelevantText(text: string, question: string | null) {
  const normalized = clean(text, 300_000);
  if (normalized.length <= MAX_DOCUMENT_CONTEXT_CHARS) return { text: normalized, truncated: false };
  const terms = words(question || "");
  if (!terms.length) {
    const head = normalized.slice(0, 17_000);
    const tail = normalized.slice(-5_000);
    return { text: `${head}\n\n… [اقتُطع وسط التقرير لطوله] …\n\n${tail}`, truncated: true };
  }
  const paragraphs = normalized.split(/\n{2,}/).map((value, index) => ({ value: value.trim(), index })).filter(item => item.value);
  const ranked = paragraphs.map(item => ({
    ...item,
    score: terms.reduce((sum, term) => sum + (item.value.toLowerCase().includes(term) ? 1 : 0), 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = new Map<number, string>();
  for (const item of paragraphs.slice(0, 5)) selected.set(item.index, item.value);
  let used = [...selected.values()].join("\n\n").length;
  for (const item of ranked) {
    if (selected.has(item.index)) continue;
    if (used + item.value.length > MAX_DOCUMENT_CONTEXT_CHARS - 1_000) continue;
    selected.set(item.index, item.value);
    used += item.value.length + 2;
  }
  const excerpt = [...selected.entries()].sort(([a], [b]) => a - b).map(([, value]) => value).join("\n\n");
  return { text: excerpt.slice(0, MAX_DOCUMENT_CONTEXT_CHARS), truncated: true };
}

async function downloadVerifiedDocument(document: LinkedDocument) {
  if (document.byteSize > MAX_DOCUMENT_BYTES) throw new Error("التقرير كبير للقراءة الصوتية المباشرة؛ استخدمي ملخص Manus المحفوظ في الملف");
  const { url } = await storageGet(document.storageKey);
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`تعذر فتح التقرير (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== document.byteSize) throw new Error("حجم التقرير لا يطابق السجل");
  if (createHash("sha256").update(bytes).digest("hex") !== document.sha256) throw new Error("بصمة التقرير لا تطابق السجل");
  return bytes;
}

async function extractDocumentText(document: LinkedDocument) {
  const cached = documentTextCache.get(document.documentId);
  if (cached !== undefined) return cached;
  const bytes = await downloadVerifiedDocument(document);
  let text = "";
  const mime = document.mimeType.toLowerCase();
  const name = document.fileName.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try { text = (await parser.getText()).text || ""; }
    finally { await parser.destroy(); }
  } else if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer: bytes })).value || "";
  } else if (mime.startsWith("text/") || name.endsWith(".md") || name.endsWith(".txt")) {
    text = bytes.toString("utf8");
  } else {
    throw new Error("صيغة هذا المستند غير مدعومة للقراءة الصوتية المباشرة");
  }
  const normalized = clean(text, 300_000);
  if (documentTextCache.size >= 20) documentTextCache.delete(documentTextCache.keys().next().value as number);
  documentTextCache.set(document.documentId, normalized);
  return normalized;
}

export function documentScore(document: LinkedDocument, question: string | null, focus: SaraWorkFileFocus = "analysis") {
  const haystack = `${document.memoryTitle} ${document.title} ${document.fileName} ${clean(document.memoryBody, 800)}`.toLowerCase();
  // The beginning of a source email contains its own message. Later quoted threads and
  // work-product comparisons must not be mistaken for this attachment's signature.
  const directEvidence = `${document.memoryTitle} ${document.title} ${document.fileName} ${clean(document.memoryBody, 350)}`.toLowerCase();
  const q = (question || "").toLowerCase();
  const termScore = words(q).reduce((sum, term) => sum + (haystack.includes(term) ? 5 : 0), 0);
  // Search both languages: the owner's question is often Arabic while the source letter is English.
  const asksAboutSignature = /وقّع|وقع|موقّع|موقع|توقيع|signed|signature/.test(q);
  const unsigned = /\bunsigned\b|\bnot signed\b|غير\s+موق[ّع]*|غير\s+موقع|لم\s+يوق[ّع]*/.test(directEvidence);
  const sourceSigned = asksAboutSignature && document.memoryType === "material" && !unsigned
    // "for signature" / "للتوقيع" requests an action; neither proves execution.
    && /\bsigned\b|موقّع|موقع(?=\s|$)|تم\s+التوقيع/.test(directEvidence);
  const subjectScore = (/تعيين|appointment|\bloa\b/.test(q) && /تعيين|appointment|\bloa\b/.test(haystack) ? 20 : 0)
    + (/عقد|اتفاقية|agreement|contract/.test(q) && /عقد|اتفاقية|agreement|contract/.test(haystack) ? 16 : 0)
    + (sourceSigned ? 65 : 0)
    - (asksAboutSignature && unsigned ? 25 : 0);
  const workProductScore = focus === "analysis" && !asksAboutSignature && document.memoryType === "work_product" ? 20 : 0;
  const currentScore = Number(document.isCurrent) === 1 ? 10 : 0;
  const analysisScore = focus === "analysis" && !asksAboutSignature && /تحليل|analysis|comparison|مقارنة|review|مراجعة/i.test(haystack) ? 8 : 0;
  const readableScore = /pdf|wordprocessingml|text\//i.test(document.mimeType) ? 3 : 0;
  return termScore + subjectScore + workProductScore + currentScore + analysisScore + readableScore;
}

export function buildSaraRecentDocumentaryEvidence(memory: Array<{ id: number; memoryType: string; isCurrent: boolean; title: string; body: string; occurredAt?: string | null }>, documents: LinkedDocument[]) {
  return memory.filter(item => item.isCurrent && (item.memoryType === "material" || item.memoryType === "note"))
    .slice(0, 15)
    .map(item => ({
      memoryId: item.id,
      title: item.title,
      occurredAt: item.occurredAt ?? null,
      excerpt: clean(item.body, 1_300),
      documents: documents.filter(document => document.memoryId === item.id)
        .map(document => ({ documentId: document.documentId, fileName: document.fileName, title: document.title })),
    }));
}

export async function readExecutiveWorkFile(member: SaraReaderMember, rawArguments: string) {
  if (member.memberId !== "abdulrahman") return { found: false, reason: "ملفات COMO التنفيذية خاصة بعبد الرحمن." };
  let parsed: { work_file_id?: number; focus?: SaraWorkFileFocus; question?: string | null; document_id?: number | null };
  try { parsed = JSON.parse(rawArguments || "{}"); }
  catch { throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة طلب قراءة ملف الموضوع غير صالحة" }); }
  const workFileId = Number(parsed.work_file_id);
  if (!Number.isInteger(workFileId) || workFileId <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "لم تحدد سارة ملف الموضوع" });
  const focus: SaraWorkFileFocus = ["overview", "analysis", "meetings", "communications", "history", "full"].includes(String(parsed.focus)) ? parsed.focus! : "overview";
  const question = clean(parsed.question, 2_000) || null;
  const requestedDocumentId = parsed.document_id == null ? null : Number(parsed.document_id);

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const userId = await resolveOwnerUserIdForSara(member.memberId);
  const workFileResult = await db.execute(sql`
    SELECT wf.id AS workFileId, wf.project_id AS projectId, p.name AS project, wf.title,
      wf.governing_question AS governingQuestion, wf.desired_outcome AS desiredOutcome,
      wf.work_file_status AS status, wf.priority, wf.updated_at AS updatedAt
    FROM como_next_work_files wf
    JOIN projects p ON p.id=wf.project_id AND p.is_test_project=0
    LEFT JOIN como_next_import_batches batch ON batch.batch_id=wf.import_batch_id
    WHERE wf.id=${workFileId} AND wf.user_id=${userId}
      AND (wf.import_batch_id IS NULL OR batch.batch_status='promoted')
    LIMIT 1
  `);
  const workFile = rows<any>(workFileResult)[0];
  if (!workFile) return { found: false, reason: "لم يُعثر على ملف الموضوع ضمن ملفات عبد الرحمن الحالية." };

  const [actionsResult, decisionsResult, updatesResult, memoryResult, documentsResult, meetingsResult, communicationsResult, eventsResult] = await Promise.all([
    db.execute(sql`SELECT id,title,description,acceptance_criteria AS acceptanceCriteria,action_status AS status,priority,owner_type AS ownerType,due_at AS dueAt,attention_at AS attentionAt,follow_up_at AS followUpAt,updated_at AS updatedAt FROM como_next_actions WHERE work_file_id=${workFileId} ORDER BY updated_at DESC,id DESC LIMIT 30`),
    db.execute(sql`SELECT id,title,question,context_summary AS contextSummary,recommendation,decision_status AS status,decision_authority AS authority,decision_text AS decisionText,evidence_reference AS evidenceReference,due_at AS dueAt,decided_at AS decidedAt,updated_at AS updatedAt FROM como_next_decisions WHERE work_file_id=${workFileId} ORDER BY updated_at DESC,id DESC LIMIT 25`),
    db.execute(sql`SELECT id,source_channel AS sourceChannel,update_text AS updateText,occurred_at AS occurredAt,analysis_status AS analysisStatus,analysis_summary AS analysisSummary,target_action_id AS targetActionId FROM como_next_work_file_updates WHERE work_file_id=${workFileId} ORDER BY occurred_at DESC,id DESC LIMIT 30`),
    db.execute(sql`SELECT id,memory_type AS memoryType,entry_type AS entryType,title,body,source_status AS sourceStatus,is_current AS isCurrent,occurred_at AS occurredAt,updated_at AS updatedAt FROM como_next_work_memory WHERE work_file_id=${workFileId} ORDER BY is_current DESC,occurred_at DESC,id DESC LIMIT 60`),
    db.execute(sql`SELECT link.memory_id AS memoryId,memory.memory_type AS memoryType,memory.title AS memoryTitle,LEFT(memory.body,800) AS memoryBody,memory.is_current AS isCurrent,doc.id AS documentId,doc.title,doc.file_name AS fileName,doc.mime_type AS mimeType,doc.byte_size AS byteSize,doc.sha256,doc.storage_key AS storageKey FROM como_next_work_memory_documents link JOIN como_next_work_memory memory ON memory.id=link.memory_id JOIN como_next_documents doc ON doc.id=link.document_id WHERE link.work_file_id=${workFileId} ORDER BY memory.is_current DESC,memory.id DESC,doc.id DESC LIMIT 80`),
    db.execute(sql`SELECT m.id,m.title,m.objective,m.meeting_status AS status,m.starts_at AS startsAt,m.ends_at AS endsAt,m.timezone,m.location,m.outcome_summary AS outcomeSummary,m.updated_at AS updatedAt FROM como_next_meetings m WHERE m.work_file_id=${workFileId} ORDER BY m.starts_at DESC,m.id DESC LIMIT 20`),
    db.execute(sql`SELECT id,channel,direction,communication_status AS status,approval_status AS approvalStatus,subject,body,from_text AS fromText,to_text AS toText,cc_text AS ccText,evidence_reference AS evidenceReference,occurred_at AS occurredAt FROM como_next_communications WHERE work_file_id=${workFileId} ORDER BY occurred_at DESC,id DESC LIMIT 30`),
    db.execute(sql`SELECT id,sequence_no AS sequenceNo,actor_type AS actorType,event_type AS eventType,summary,occurred_at AS occurredAt FROM como_next_work_file_events WHERE work_file_id=${workFileId} ORDER BY sequence_no DESC LIMIT 40`),
  ]);

  const meetings = rows<any>(meetingsResult);
  const meetingIds = meetings.map(item => Number(item.id));
  let agenda: any[] = [];
  let sources: any[] = [];
  let analyses: any[] = [];
  let minutes: any[] = [];
  let participants: any[] = [];
  if (meetingIds.length) {
    const ids = sql.join(meetingIds.map(id => sql`${id}`), sql`, `);
    const [agendaResult, sourcesResult, analysesResult, minutesResult, participantsResult] = await Promise.all([
      db.execute(sql`SELECT id,meeting_id AS meetingId,category,prompt_ar AS promptAr,response,is_checked AS isChecked,is_required AS isRequired,briefing_note AS briefingNote,desired_outcome AS desiredOutcome,priority,updated_at AS updatedAt FROM como_next_meeting_agenda_items WHERE meeting_id IN (${ids}) ORDER BY meeting_id DESC,sort_order ASC`),
      db.execute(sql`SELECT id,meeting_id AS meetingId,source_kind AS sourceKind,visibility,title,raw_text AS rawText,source_status AS sourceStatus,source_document_id AS sourceDocumentId,updated_at AS updatedAt FROM como_next_meeting_sources WHERE meeting_id IN (${ids}) ORDER BY meeting_id DESC,id DESC LIMIT 40`),
      db.execute(sql`SELECT id,meeting_id AS meetingId,analysis_type AS analysisType,analysis_status AS status,summary,open_questions_json AS openQuestionsJson,created_at AS createdAt FROM como_next_meeting_analyses WHERE meeting_id IN (${ids}) ORDER BY meeting_id DESC,id DESC LIMIT 30`),
      db.execute(sql`SELECT id,meeting_id AS meetingId,version,minutes_status AS status,summary,content,review_note AS reviewNote,updated_at AS updatedAt FROM como_next_meeting_minutes WHERE meeting_id IN (${ids}) ORDER BY meeting_id DESC,version DESC LIMIT 20`),
      db.execute(sql`SELECT id,meeting_id AS meetingId,display_name AS displayName,organization_name AS organizationName,participant_role AS participantRole,attendance FROM como_next_meeting_participants WHERE meeting_id IN (${ids}) ORDER BY meeting_id DESC,id ASC`),
    ]);
    agenda = rows<any>(agendaResult);
    sources = rows<any>(sourcesResult);
    analyses = rows<any>(analysesResult);
    minutes = rows<any>(minutesResult);
    participants = rows<any>(participantsResult);
  }

  const linkedDocuments = rows<LinkedDocument>(documentsResult).map(item => ({ ...item, documentId: Number(item.documentId), memoryId: Number(item.memoryId), byteSize: Number(item.byteSize), isCurrent: Number(item.isCurrent) }));
  const readableDocuments = linkedDocuments.filter(item => /pdf|wordprocessingml|text\//i.test(item.mimeType));
  const selectedDocument = requestedDocumentId
    ? readableDocuments.find(item => item.documentId === requestedDocumentId) || null
    : (focus === "analysis" || Boolean(question))
      ? [...readableDocuments].sort((a, b) => documentScore(b, question, focus) - documentScore(a, question, focus))[0] || null
      : null;
  let documentExcerpt: Record<string, unknown> | null = null;
  if (selectedDocument) {
    try {
      const extracted = selectRelevantText(await extractDocumentText(selectedDocument), question);
      documentExcerpt = {
        documentId: selectedDocument.documentId,
        title: selectedDocument.title,
        fileName: selectedDocument.fileName,
        sourceMemoryId: selectedDocument.memoryId,
        text: extracted.text,
        truncated: extracted.truncated,
      };
    } catch (error) {
      documentExcerpt = {
        documentId: selectedDocument.documentId,
        title: selectedDocument.title,
        fileName: selectedDocument.fileName,
        text: null,
        error: error instanceof Error ? error.message : "تعذر استخراج نص التقرير",
      };
    }
  }

  const memory = rows<any>(memoryResult).map(item => ({ ...item, id: Number(item.id), isCurrent: Number(item.isCurrent) === 1, body: clean(item.body, focus === "analysis" || focus === "full" ? 20_000 : 6_000) }));
  const base = {
    found: true,
    source: "COMO Next work-file dossier",
    generatedAt: new Date().toISOString(),
    question,
    workFile,
    // Place fresh source evidence before historical summaries. A recent signed attachment
    // must never be silently displaced by an earlier unsigned template or analysis.
    recentDocumentaryEvidence: buildSaraRecentDocumentaryEvidence(memory, linkedDocuments),
    currentState: {
      actions: rows<any>(actionsResult),
      decisions: rows<any>(decisionsResult),
      recentUpdates: rows<any>(updatesResult),
    },
  };
  const documentIndex = linkedDocuments.map(item => ({ documentId: item.documentId, memoryId: item.memoryId, memoryTitle: item.memoryTitle, title: item.title, fileName: item.fileName, mimeType: item.mimeType, byteSize: item.byteSize, isCurrent: item.isCurrent === 1 }));
  if (focus === "overview") return presentSaraDubaiTimes({ ...base, currentMemory: memory.filter(item => item.isCurrent).slice(0, 15), meetings, documents: documentIndex.slice(0, 30), documentExcerpt });
  if (focus === "analysis") return presentSaraDubaiTimes({ ...base, currentWorkProducts: memory.filter(item => item.isCurrent && item.memoryType === "work_product"), documents: documentIndex, documentExcerpt });
  if (focus === "meetings") return presentSaraDubaiTimes({ ...base, meetings, participants, agenda, sources, analyses, minutes });
  if (focus === "communications") return presentSaraDubaiTimes({ ...base, communications: rows<any>(communicationsResult), documents: documentIndex, documentExcerpt });
  if (focus === "history") return presentSaraDubaiTimes({ ...base, memory, events: rows<any>(eventsResult) });
  return presentSaraDubaiTimes({ ...base, memory, documents: documentIndex, documentExcerpt, meetings, participants, agenda, sources, analyses, minutes, communications: rows<any>(communicationsResult), events: rows<any>(eventsResult) });
}
