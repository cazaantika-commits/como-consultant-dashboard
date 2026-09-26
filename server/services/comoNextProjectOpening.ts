import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  comoNextDocuments,
  comoNextProjectAccess,
  comoNextProjectDocumentExtractions,
  comoNextProjectDossiers,
  comoNextProjectOpportunities,
  comoNextProjectOpportunityDocuments,
  comoNextProjectOpportunityEvents,
  comoNextProjectOpportunityFacts,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
  comoNextWorkMemory,
  comoNextWorkMemoryDocuments,
  projects,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { storageGet } from "../storage";

export type ProjectOpeningUser = { id: number; openId?: string | null; role?: string | null };
export type OpportunityDocumentRole = "land_document" | "developer_contract" | "fact_sheet" | "other_land_evidence";

const EXTRACTION_MODEL = "gemini-3-flash-preview";
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const OWNER_RELATIONSHIP_LABELS: Record<string, string> = {
  owned: "أرض مملوكة للشركة",
  potential_purchase: "أرض قيد الشراء أو الاستحواذ",
  land_for_units: "شراكة أرض مقابل وحدات",
  other_partnership: "شراكة تطوير أخرى",
  development_management: "إدارة تطوير لصالح المالك",
};

const FACT_DEFINITIONS = {
  projectName: { label: "اسم المشروع المقترح", type: "text", projectColumn: "name" },
  plotNumber: { label: "رقم القطعة", type: "text", projectColumn: "plotNumber" },
  areaCode: { label: "المنطقة / الرمز", type: "text", projectColumn: "areaCode" },
  titleDeedNumber: { label: "رقم سند الملكية", type: "text", projectColumn: "titleDeedNumber" },
  ddaNumber: { label: "رقم DDA / الجهة", type: "text", projectColumn: "ddaNumber" },
  masterDevRef: { label: "مرجع المطور الرئيسي", type: "text", projectColumn: "masterDevRef" },
  plotAreaSqm: { label: "مساحة الأرض م²", type: "number", projectColumn: "plotAreaSqm" },
  plotAreaSqft: { label: "مساحة الأرض قدم²", type: "number", projectColumn: "plotAreaSqft" },
  gfaSqm: { label: "المساحة البنائية GFA م²", type: "number", projectColumn: "gfaSqm" },
  gfaSqft: { label: "المساحة البنائية GFA قدم²", type: "number", projectColumn: "gfaSqft" },
  permittedUse: { label: "الاستخدام المسموح", type: "text", projectColumn: "permittedUse" },
  ownershipType: { label: "نوع الملكية", type: "text", projectColumn: "ownershipType" },
  subdivisionRestrictions: { label: "قيود التقسيم", type: "text", projectColumn: "subdivisionRestrictions" },
  masterDevName: { label: "المطور الرئيسي", type: "text", projectColumn: "masterDevName" },
  registrationAuthority: { label: "جهة التسجيل", type: "text", projectColumn: "registrationAuthority" },
  sellerName: { label: "البائع / مالك الأرض", type: "text", projectColumn: "sellerName" },
  buyerName: { label: "المشتري / المطور", type: "text", projectColumn: "buyerName" },
  effectiveDate: { label: "تاريخ النفاذ", type: "date", projectColumn: "effectiveDate" },
  constructionPeriod: { label: "مدة البناء", type: "text", projectColumn: "constructionPeriod" },
  constructionStartDate: { label: "تاريخ بدء البناء", type: "date", projectColumn: "constructionStartDate" },
  completionDate: { label: "تاريخ الإنجاز", type: "date", projectColumn: "completionDate" },
  constructionConditions: { label: "شروط البناء", type: "text", projectColumn: "constructionConditions" },
  saleRestrictions: { label: "قيود البيع", type: "text", projectColumn: "saleRestrictions" },
  resaleConditions: { label: "شروط إعادة البيع", type: "text", projectColumn: "resaleConditions" },
  communityCharges: { label: "رسوم المجتمع", type: "text", projectColumn: "communityCharges" },
  electricityAllocation: { label: "تخصيص الكهرباء", type: "text", projectColumn: "electricityAllocation" },
  waterAllocation: { label: "تخصيص المياه", type: "text", projectColumn: "waterAllocation" },
  sewageAllocation: { label: "تخصيص الصرف", type: "text", projectColumn: "sewageAllocation" },
} as const;

type FactKey = keyof typeof FACT_DEFINITIONS;
const ALLOWED_FACT_KEYS = Object.keys(FACT_DEFINITIONS) as FactKey[];

const extractionSchema = {
  type: "object",
  properties: {
    proposedName: { type: ["string", "null"] },
    executiveSummary: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fieldKey: { type: "string", enum: ALLOWED_FACT_KEYS },
          value: { type: ["string", "null"] },
          evidenceExcerpt: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["fieldKey", "value", "evidenceExcerpt", "confidence"],
        additionalProperties: false,
      },
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          detail: { type: "string" },
          evidenceExcerpt: { type: "string" },
        },
        required: ["topic", "detail", "evidenceExcerpt"],
        additionalProperties: false,
      },
    },
    missingRequirements: { type: "array", items: { type: "string" } },
  },
  required: ["proposedName", "executiveSummary", "facts", "conflicts", "missingRequirements"],
  additionalProperties: false,
} as const;

export function assertProjectOpeningOwner(user: ProjectOpeningUser) {
  if (!ENV.ownerOpenId || user.openId !== ENV.ownerOpenId || user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "بوابة فتح المشاريع متاحة لعبد الرحمن فقط" });
  }
}

function safeJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}

function normalizeNumeric(value: unknown) {
  const text = clean(value, 120).replace(/,/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : null;
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function extractText(buffer: Buffer, mimeType: string, fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf" || ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return clean(result.text, 140_000);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
  if (mime.startsWith("text/") || [".txt", ".csv", ".json", ".xml"].includes(ext)) {
    return clean(buffer.toString("utf8"), 140_000);
  }
  if (ext === ".docx" || mime.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return clean(result.value, 140_000);
  }
  if ([".xlsx", ".xls"].includes(ext) || mime.includes("spreadsheet") || mime.includes("ms-excel")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return clean(workbook.SheetNames.map(name => `\n## ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n"), 140_000);
  }
  if (ext === ".pptx" || mime.includes("presentationml")) {
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const slides: string[] = [];
    for (const name of slideNames) {
      const xml = await zip.files[name].async("string");
      const parts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match => decodeXmlEntities(match[1]));
      slides.push(parts.join(" "));
    }
    return clean(slides.join("\n\n"), 140_000);
  }
  return "";
}

async function fetchDocumentBytes(document: { storageKey: string; sha256: string; byteSize: number }) {
  const { url } = await storageGet(document.storageKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`تعذر قراءة الوثيقة المحمية (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== Number(document.byteSize) || sha256(buffer) !== document.sha256) {
    throw new Error("فشل تحقق حجم أو بصمة الوثيقة المحمية");
  }
  return { buffer, signedUrl: url };
}

async function appendOpportunityEvent(tx: any, input: {
  opportunityId: number; actorType: "human" | "manus" | "system"; actorUserId?: number | null;
  eventType: string; summary: string; payload?: unknown; idempotencyKey?: string | null;
}) {
  if (input.idempotencyKey) {
    const [existing] = await tx.select({ id: comoNextProjectOpportunityEvents.id }).from(comoNextProjectOpportunityEvents)
      .where(eq(comoNextProjectOpportunityEvents.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing) return Number(existing.id);
  }
  const [sequence] = await tx.select({ max: sql<number>`COALESCE(MAX(${comoNextProjectOpportunityEvents.sequenceNo}), 0)` })
    .from(comoNextProjectOpportunityEvents).where(eq(comoNextProjectOpportunityEvents.opportunityId, input.opportunityId));
  const inserted = await tx.insert(comoNextProjectOpportunityEvents).values({
    opportunityId: input.opportunityId,
    sequenceNo: Number(sequence?.max || 0) + 1,
    actorType: input.actorType,
    actorUserId: input.actorUserId || null,
    eventType: clean(input.eventType, 80),
    summary: clean(input.summary, 1000),
    payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
    idempotencyKey: input.idempotencyKey ? clean(input.idempotencyKey, 128) : null,
  });
  return Number(inserted[0].insertId);
}

async function requireOwnedOpportunity(db: any, opportunityId: number, userId: number) {
  const [opportunity] = await db.select().from(comoNextProjectOpportunities)
    .where(and(eq(comoNextProjectOpportunities.id, opportunityId), eq(comoNextProjectOpportunities.userId, userId))).limit(1);
  if (!opportunity) throw new TRPCError({ code: "NOT_FOUND", message: "فرصة المشروع غير موجودة" });
  return opportunity;
}

export async function createOpportunityWithDocument(input: {
  user: ProjectOpeningUser;
  provisionalName?: string | null;
  objective?: string | null;
  document: { id: number; title: string; sha256: string };
  documentRole: OpportunityDocumentRole;
}) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  return db.transaction(async tx => {
    const result = await tx.insert(comoNextProjectOpportunities).values({
      userId: input.user.id,
      provisionalName: clean(input.provisionalName, 255) || null,
      objective: clean(input.objective, 4000) || null,
      opportunityStatus: "under_study",
    });
    const opportunityId = Number(result[0].insertId);
    const documentResult = await tx.insert(comoNextProjectOpportunityDocuments).values({
      opportunityId,
      documentId: input.document.id,
      documentRole: input.documentRole,
      analysisStatus: "pending",
      uploadedByUserId: input.user.id,
    });
    const opportunityDocumentId = Number(documentResult[0].insertId);
    await appendOpportunityEvent(tx, {
      opportunityId,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: "opportunity_opened",
      summary: "فُتحت فرصة مشروع تحت الدراسة بوثيقة أرض واحدة على الأقل",
      payload: { documentId: input.document.id, documentRole: input.documentRole, sha256: input.document.sha256 },
      idempotencyKey: `opportunity:${opportunityId}:opened`,
    });
    return { opportunityId, opportunityDocumentId };
  });
}

export async function attachOpportunityDocument(input: {
  user: ProjectOpeningUser; opportunityId: number; documentId: number; documentRole: OpportunityDocumentRole; sha256: string;
}) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(comoNextProjectOpportunityDocuments)
      .where(and(eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId), eq(comoNextProjectOpportunityDocuments.documentId, input.documentId))).limit(1);
    if (existing) return { opportunityDocumentId: Number(existing.id), replayed: true as const };
    const result = await tx.insert(comoNextProjectOpportunityDocuments).values({
      opportunityId: input.opportunityId,
      documentId: input.documentId,
      documentRole: input.documentRole,
      analysisStatus: "pending",
      uploadedByUserId: input.user.id,
    });
    const opportunityDocumentId = Number(result[0].insertId);
    await appendOpportunityEvent(tx, {
      opportunityId: input.opportunityId,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: "document_attached",
      summary: "أضيفت وثيقة أخرى إلى فرصة المشروع",
      payload: { documentId: input.documentId, documentRole: input.documentRole, sha256: input.sha256 },
      idempotencyKey: `opportunity:${input.opportunityId}:document:${input.documentId}`,
    });
    return { opportunityDocumentId, replayed: false as const };
  });
}

export async function listProjectOpportunities(user: ProjectOpeningUser) {
  assertProjectOpeningOwner(user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const result = await db.execute(sql`
    SELECT opportunity.id, opportunity.opportunity_status AS opportunityStatus,
      opportunity.provisional_name AS provisionalName, opportunity.owner_relationship AS ownerRelationship,
      opportunity.development_strategy AS developmentStrategy, opportunity.objective,
      opportunity.approved_project_id AS approvedProjectId, opportunity.created_at AS createdAt,
      opportunity.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM como_next_project_opportunity_documents d WHERE d.opportunity_id = opportunity.id) AS documentCount,
      (SELECT COUNT(*) FROM como_next_project_opportunity_documents d WHERE d.opportunity_id = opportunity.id AND d.analysis_status IN ('reviewed','manual_reviewed')) AS reviewedDocumentCount,
      (SELECT COUNT(*) FROM como_next_project_opportunity_facts f WHERE f.opportunity_id = opportunity.id AND f.review_status IN ('proposed','conflict')) AS pendingFactCount
    FROM como_next_project_opportunities opportunity
    WHERE opportunity.user_id = ${user.id} AND opportunity.opportunity_status <> 'archived'
    ORDER BY CASE opportunity.opportunity_status WHEN 'ready_for_approval' THEN 0 WHEN 'under_review' THEN 1 WHEN 'under_study' THEN 2 ELSE 3 END,
      opportunity.updated_at DESC
  `);
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return (rows as any[]).map(row => ({ ...row, id: Number(row.id), approvedProjectId: row.approvedProjectId ? Number(row.approvedProjectId) : null, documentCount: Number(row.documentCount), reviewedDocumentCount: Number(row.reviewedDocumentCount), pendingFactCount: Number(row.pendingFactCount) }));
}

export async function getProjectOpportunity(input: { user: ProjectOpeningUser; opportunityId: number }) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const opportunity = await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  const [documents, extractions, facts, events] = await Promise.all([
    db.select({
      id: comoNextProjectOpportunityDocuments.id,
      documentId: comoNextProjectOpportunityDocuments.documentId,
      documentRole: comoNextProjectOpportunityDocuments.documentRole,
      analysisStatus: comoNextProjectOpportunityDocuments.analysisStatus,
      fileName: comoNextDocuments.fileName,
      title: comoNextDocuments.title,
      mimeType: comoNextDocuments.mimeType,
      byteSize: comoNextDocuments.byteSize,
      sha256: comoNextDocuments.sha256,
      createdAt: comoNextProjectOpportunityDocuments.createdAt,
    }).from(comoNextProjectOpportunityDocuments)
      .innerJoin(comoNextDocuments, eq(comoNextDocuments.id, comoNextProjectOpportunityDocuments.documentId))
      .where(eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId))
      .orderBy(desc(comoNextProjectOpportunityDocuments.createdAt)),
    db.select().from(comoNextProjectDocumentExtractions)
      .where(eq(comoNextProjectDocumentExtractions.opportunityId, input.opportunityId))
      .orderBy(desc(comoNextProjectDocumentExtractions.createdAt)),
    db.select().from(comoNextProjectOpportunityFacts)
      .where(eq(comoNextProjectOpportunityFacts.opportunityId, input.opportunityId))
      .orderBy(comoNextProjectOpportunityFacts.id),
    db.select().from(comoNextProjectOpportunityEvents)
      .where(eq(comoNextProjectOpportunityEvents.opportunityId, input.opportunityId))
      .orderBy(desc(comoNextProjectOpportunityEvents.sequenceNo)).limit(40),
  ]);
  return {
    opportunity: { ...opportunity, id: Number(opportunity.id), approvedProjectId: opportunity.approvedProjectId ? Number(opportunity.approvedProjectId) : null },
    documents: documents.map(document => ({ ...document, id: Number(document.id), documentId: Number(document.documentId), byteSize: Number(document.byteSize), downloadUrl: `/api/como-next/documents/${Number(document.documentId)}` })),
    extractions: extractions.map(extraction => ({
      ...extraction,
      id: Number(extraction.id),
      opportunityDocumentId: Number(extraction.opportunityDocumentId),
      facts: safeJson(extraction.factsJson, []),
      conflicts: safeJson(extraction.conflictsJson, []),
      missingRequirements: safeJson(extraction.missingRequirementsJson, []),
      factsJson: undefined,
      conflictsJson: undefined,
      missingRequirementsJson: undefined,
    })),
    facts: facts.map(fact => ({ ...fact, id: Number(fact.id), sourceExtractionId: fact.sourceExtractionId ? Number(fact.sourceExtractionId) : null, sourceDocumentId: fact.sourceDocumentId ? Number(fact.sourceDocumentId) : null })),
    events: events.map(event => ({ ...event, id: Number(event.id) })),
  };
}

export async function analyzeOpportunityDocument(input: { user: ProjectOpeningUser; opportunityId: number; opportunityDocumentId: number }) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const opportunity = await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  if (opportunity.opportunityStatus === "approved" || opportunity.opportunityStatus === "archived") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تحليل وثيقة لفرصة مغلقة" });
  }
  const [record] = await db.select({
    id: comoNextProjectOpportunityDocuments.id,
    documentId: comoNextProjectOpportunityDocuments.documentId,
    analysisStatus: comoNextProjectOpportunityDocuments.analysisStatus,
    fileName: comoNextDocuments.fileName,
    mimeType: comoNextDocuments.mimeType,
    byteSize: comoNextDocuments.byteSize,
    sha256: comoNextDocuments.sha256,
    storageKey: comoNextDocuments.storageKey,
  }).from(comoNextProjectOpportunityDocuments)
    .innerJoin(comoNextDocuments, eq(comoNextDocuments.id, comoNextProjectOpportunityDocuments.documentId))
    .where(and(eq(comoNextProjectOpportunityDocuments.id, input.opportunityDocumentId), eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId))).limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "الوثيقة لا تتبع فرصة المشروع" });

  const requestKey = `project-opening:v1:${record.sha256}`;
  const [existing] = await db.select().from(comoNextProjectDocumentExtractions)
    .where(eq(comoNextProjectDocumentExtractions.requestKey, requestKey)).limit(1);
  if (existing) return { extractionId: Number(existing.id), replayed: true as const, status: existing.extractionStatus };

  const insert = await db.insert(comoNextProjectDocumentExtractions).values({
    opportunityId: input.opportunityId,
    opportunityDocumentId: input.opportunityDocumentId,
    requestKey,
    inputSha256: record.sha256,
    extractionStatus: "processing",
    requestedByUserId: input.user.id,
  });
  const extractionId = Number(insert[0].insertId);
  await db.update(comoNextProjectOpportunityDocuments).set({ analysisStatus: "processing" })
    .where(eq(comoNextProjectOpportunityDocuments.id, input.opportunityDocumentId));

  try {
    const { buffer, signedUrl } = await fetchDocumentBytes({ storageKey: record.storageKey, sha256: record.sha256, byteSize: Number(record.byteSize) });
    const rawText = await extractText(buffer, record.mimeType, record.fileName);
    const content: any[] = [{
      type: "text",
      text: `اقرأ وثيقة الأرض التالية لاستخراج حقائق تأسيس مشروع عقاري. لا تخمّن. القيمة غير الموجودة تكون null. اقتبس نصًا قصيرًا لكل حقيقة. افصل التعارضات والمتطلبات الناقصة.\n\nالنص المستخرج إن وجد:\n${rawText || "[لا يوجد نص قابل للاستخراج؛ افحص الملف بصريًا]"}`,
    }];
    if ((record.mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(record.fileName))) {
      content.push({ type: "image_url", image_url: { url: signedUrl, detail: "high" } });
    } else if ((record.mimeType === "application/pdf" || record.fileName.toLowerCase().endsWith(".pdf")) && rawText.length < 200) {
      content.push({ type: "file_url", file_url: { url: signedUrl, mime_type: "application/pdf" } });
    } else if (!rawText) {
      throw new Error("نوع الوثيقة محفوظ بأمان لكنه غير قابل للقراءة الآلية حاليًا؛ يلزم إكماله يدويًا");
    }

    const response = await invokeLLM({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: "أنت محلل وثائق تأسيس مشاريع عقارية. استخرج فقط ما يثبته المستند، واربط كل حقيقة باقتباس. لا تنشئ مشروعًا ولا قرارًا ولا إجراءً." },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: { name: "project_opening_extract", strict: true, schema: extractionSchema as any } },
    });
    const rawContent = response.choices[0]?.message?.content;
    const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
    const normalizedFacts = (Array.isArray(parsed.facts) ? parsed.facts : []).filter((fact: any) => ALLOWED_FACT_KEYS.includes(fact.fieldKey) && clean(fact.value, 2000));

    await db.transaction(async tx => {
      await tx.update(comoNextProjectDocumentExtractions).set({
        extractionStatus: "draft",
        proposedName: clean(parsed.proposedName, 255) || null,
        executiveSummary: clean(parsed.executiveSummary, 8000),
        factsJson: JSON.stringify(normalizedFacts),
        conflictsJson: JSON.stringify(Array.isArray(parsed.conflicts) ? parsed.conflicts : []),
        missingRequirementsJson: JSON.stringify(Array.isArray(parsed.missingRequirements) ? parsed.missingRequirements : []),
        rawTextSha256: rawText ? sha256(rawText) : null,
        rawTextLength: rawText.length,
        modelId: response.model || EXTRACTION_MODEL,
      }).where(eq(comoNextProjectDocumentExtractions.id, extractionId));
      await tx.update(comoNextProjectOpportunityDocuments).set({ analysisStatus: "draft" })
        .where(eq(comoNextProjectOpportunityDocuments.id, input.opportunityDocumentId));
      await tx.update(comoNextProjectOpportunities).set({
        opportunityStatus: "under_review",
        provisionalName: opportunity.provisionalName || clean(parsed.proposedName, 255) || null,
      }).where(eq(comoNextProjectOpportunities.id, input.opportunityId));

      for (const fact of normalizedFacts) {
        const definition = FACT_DEFINITIONS[fact.fieldKey as FactKey];
        const value = definition.type === "number" ? normalizeNumeric(fact.value) : clean(fact.value, 8000);
        if (!value) continue;
        const [existingFact] = await tx.select().from(comoNextProjectOpportunityFacts)
          .where(and(eq(comoNextProjectOpportunityFacts.opportunityId, input.opportunityId), eq(comoNextProjectOpportunityFacts.fieldKey, fact.fieldKey))).limit(1);
        if (!existingFact) {
          await tx.insert(comoNextProjectOpportunityFacts).values({
            opportunityId: input.opportunityId,
            fieldKey: fact.fieldKey,
            fieldLabel: definition.label,
            currentValue: value,
            valueType: definition.type,
            sourceExtractionId: extractionId,
            sourceDocumentId: Number(record.documentId),
            sourceExcerpt: clean(fact.evidenceExcerpt, 4000),
            confidence: fact.confidence,
            reviewStatus: "proposed",
          });
        } else if (clean(existingFact.currentValue, 8000) === value) {
          await tx.update(comoNextProjectOpportunityFacts).set({
            sourceExtractionId: extractionId,
            sourceDocumentId: Number(record.documentId),
            sourceExcerpt: clean(fact.evidenceExcerpt, 4000),
            confidence: fact.confidence,
          }).where(eq(comoNextProjectOpportunityFacts.id, existingFact.id));
        } else {
          await tx.update(comoNextProjectOpportunityFacts).set({
            reviewStatus: "conflict",
            reviewNote: clean(`قيمة إضافية من ${record.fileName}: ${value}`, 4000),
          }).where(eq(comoNextProjectOpportunityFacts.id, existingFact.id));
        }
      }
      await appendOpportunityEvent(tx, {
        opportunityId: input.opportunityId,
        actorType: "manus",
        actorUserId: input.user.id,
        eventType: "document_extraction_drafted",
        summary: "أعد Manus مسودة استخراج من وثيقة المشروع؛ لم تُعتمد أي حقيقة تلقائيًا",
        payload: { extractionId, documentId: Number(record.documentId), factCount: normalizedFacts.length, modelId: response.model || EXTRACTION_MODEL },
        idempotencyKey: `opportunity:${input.opportunityId}:extraction:${extractionId}`,
      });
    });
    return { extractionId, replayed: false as const, status: "draft" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحليل الوثيقة";
    await db.transaction(async tx => {
      await tx.update(comoNextProjectDocumentExtractions).set({ extractionStatus: "failed", errorMessage: clean(message, 4000) })
        .where(eq(comoNextProjectDocumentExtractions.id, extractionId));
      await tx.update(comoNextProjectOpportunityDocuments).set({ analysisStatus: "failed" })
        .where(eq(comoNextProjectOpportunityDocuments.id, input.opportunityDocumentId));
      await appendOpportunityEvent(tx, {
        opportunityId: input.opportunityId,
        actorType: "system",
        actorUserId: input.user.id,
        eventType: "document_extraction_failed",
        summary: "تعذر الاستخراج الآلي؛ بقيت الوثيقة محفوظة ولم يُفتح مشروع رسمي",
        payload: { extractionId, message: clean(message, 2000) },
        idempotencyKey: `opportunity:${input.opportunityId}:extraction-failed:${extractionId}`,
      });
    });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
}

export async function reviewProjectOpportunity(input: {
  user: ProjectOpeningUser;
  opportunityId: number;
  provisionalName: string;
  ownerRelationship: "owned" | "potential_purchase" | "land_for_units" | "other_partnership" | "development_management" | "undecided";
  developmentStrategy: "offplan_escrow" | "offplan_construction" | "build_for_sale" | "build_for_rent" | "joint_venture_land_for_units" | "undecided";
  objective?: string | null;
  facts: Array<{ id: number; value?: string | null; reviewStatus: "approved" | "edited" | "rejected"; reviewNote?: string | null }>;
  manuallyReviewedDocumentIds?: number[];
}) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const opportunity = await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  if (opportunity.opportunityStatus === "approved" || opportunity.opportunityStatus === "archived") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الفرصة مغلقة" });
  }
  return db.transaction(async tx => {
    for (const fact of input.facts) {
      const [existing] = await tx.select().from(comoNextProjectOpportunityFacts)
        .where(and(eq(comoNextProjectOpportunityFacts.id, fact.id), eq(comoNextProjectOpportunityFacts.opportunityId, input.opportunityId))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "حقيقة المراجعة لا تتبع هذه الفرصة" });
      const normalizedValue = existing.valueType === "number" ? normalizeNumeric(fact.value ?? existing.currentValue) : clean(fact.value ?? existing.currentValue, 8000);
      if (fact.reviewStatus !== "rejected" && !normalizedValue) throw new TRPCError({ code: "BAD_REQUEST", message: `قيمة ${existing.fieldLabel} فارغة` });
      await tx.update(comoNextProjectOpportunityFacts).set({
        currentValue: fact.reviewStatus === "rejected" ? existing.currentValue : normalizedValue,
        reviewStatus: fact.reviewStatus,
        reviewNote: clean(fact.reviewNote, 4000) || null,
        reviewedByUserId: input.user.id,
        reviewedAt: nowSql(),
      }).where(eq(comoNextProjectOpportunityFacts.id, fact.id));
    }
    await tx.update(comoNextProjectOpportunityDocuments).set({ analysisStatus: "reviewed" })
      .where(and(eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId), eq(comoNextProjectOpportunityDocuments.analysisStatus, "draft")));
    const manualIds = [...new Set(input.manuallyReviewedDocumentIds || [])];
    if (manualIds.length) {
      await tx.update(comoNextProjectOpportunityDocuments).set({ analysisStatus: "manual_reviewed" })
        .where(and(
          eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId),
          inArray(comoNextProjectOpportunityDocuments.id, manualIds),
          inArray(comoNextProjectOpportunityDocuments.analysisStatus, ["pending", "failed"]),
        ));
    }
    await tx.update(comoNextProjectOpportunities).set({
      provisionalName: clean(input.provisionalName, 255),
      ownerRelationship: input.ownerRelationship,
      developmentStrategy: input.developmentStrategy,
      objective: clean(input.objective, 4000) || null,
      opportunityStatus: "under_review",
    }).where(eq(comoNextProjectOpportunities.id, input.opportunityId));

    const [documentStats] = await tx.select({
      total: sql<number>`COUNT(*)`,
      reviewed: sql<number>`SUM(CASE WHEN ${comoNextProjectOpportunityDocuments.analysisStatus} IN ('reviewed','manual_reviewed') THEN 1 ELSE 0 END)`,
      unresolved: sql<number>`SUM(CASE WHEN ${comoNextProjectOpportunityDocuments.analysisStatus} IN ('pending','processing','draft','failed') THEN 1 ELSE 0 END)`,
    }).from(comoNextProjectOpportunityDocuments).where(eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId));
    const [factStats] = await tx.select({ unresolved: sql<number>`SUM(CASE WHEN ${comoNextProjectOpportunityFacts.reviewStatus} IN ('proposed','conflict') THEN 1 ELSE 0 END)` })
      .from(comoNextProjectOpportunityFacts).where(eq(comoNextProjectOpportunityFacts.opportunityId, input.opportunityId));
    const ready = Number(documentStats?.total || 0) >= 1 && Number(documentStats?.reviewed || 0) >= 1 && Number(documentStats?.unresolved || 0) === 0
      && Number(factStats?.unresolved || 0) === 0 && Boolean(clean(input.provisionalName, 255))
      && input.ownerRelationship !== "undecided" && input.developmentStrategy !== "undecided";
    await tx.update(comoNextProjectOpportunities).set({ opportunityStatus: ready ? "ready_for_approval" : "under_review" })
      .where(eq(comoNextProjectOpportunities.id, input.opportunityId));
    await appendOpportunityEvent(tx, {
      opportunityId: input.opportunityId,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: ready ? "opportunity_ready_for_approval" : "opportunity_review_saved",
      summary: ready ? "اكتملت مراجعة الوثائق والحقائق وأصبحت الفرصة جاهزة لاعتماد فتح المشروع" : "حُفظت مراجعة الفرصة وبقيت نقاط تمنع الاعتماد",
      payload: { ready },
    });
    return { ready };
  });
}

function projectValue(valueType: string, value: string | null) {
  if (!value) return null;
  if (valueType === "number") return normalizeNumeric(value);
  return clean(value, 8000);
}

export async function approveProjectOpportunity(input: { user: ProjectOpeningUser; opportunityId: number }) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const opportunity = await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  if (opportunity.approvedProjectId) {
    const [existingFile] = await db.select({ id: comoNextWorkFiles.id }).from(comoNextWorkFiles)
      .where(and(eq(comoNextWorkFiles.projectId, Number(opportunity.approvedProjectId)), eq(comoNextWorkFiles.sourceSystem, "como_next_project_opportunity"), eq(comoNextWorkFiles.sourceRecordId, `opportunity:${input.opportunityId}:opening-file`)))
      .limit(1);
    return { projectId: Number(opportunity.approvedProjectId), workFileId: existingFile ? Number(existingFile.id) : null, replayed: true as const };
  }
  if (opportunity.opportunityStatus !== "ready_for_approval") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "راجِع الوثائق والحقائق والعلاقة والاستراتيجية قبل فتح المشروع رسميًا" });
  }

  const documents = await db.select().from(comoNextProjectOpportunityDocuments)
    .where(eq(comoNextProjectOpportunityDocuments.opportunityId, input.opportunityId));
  if (!documents.length || documents.some(document => !["reviewed", "manual_reviewed"].includes(document.analysisStatus))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يفتح المشروع قبل مراجعة وثيقة واحدة على الأقل وحسم جميع الوثائق المرفوعة" });
  }
  const facts = await db.select().from(comoNextProjectOpportunityFacts)
    .where(eq(comoNextProjectOpportunityFacts.opportunityId, input.opportunityId));
  if (facts.some(fact => ["proposed", "conflict"].includes(fact.reviewStatus))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا تزال هناك حقائق أو تعارضات غير محسومة" });
  }
  const acceptedFacts = facts.filter(fact => ["approved", "edited"].includes(fact.reviewStatus));
  const factMap = Object.fromEntries(acceptedFacts.map(fact => [fact.fieldKey, projectValue(fact.valueType, fact.currentValue)]));
  const projectName = clean(opportunity.provisionalName || factMap.projectName, 255);
  if (!projectName) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اسم المشروع مطلوب للاعتماد" });
  if (!opportunity.ownerRelationship || opportunity.ownerRelationship === "undecided" || !opportunity.developmentStrategy || opportunity.developmentStrategy === "undecided") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب حسم علاقتنا بالأرض واستراتيجية التطوير قبل الاعتماد" });
  }

  return db.transaction(async tx => {
    const [locked] = await tx.select().from(comoNextProjectOpportunities)
      .where(eq(comoNextProjectOpportunities.id, input.opportunityId)).limit(1);
    if (locked?.approvedProjectId) {
      const [existingFile] = await tx.select({ id: comoNextWorkFiles.id }).from(comoNextWorkFiles)
        .where(and(eq(comoNextWorkFiles.projectId, Number(locked.approvedProjectId)), eq(comoNextWorkFiles.sourceSystem, "como_next_project_opportunity"), eq(comoNextWorkFiles.sourceRecordId, `opportunity:${input.opportunityId}:opening-file`)))
        .limit(1);
      return { projectId: Number(locked.approvedProjectId), workFileId: existingFile ? Number(existingFile.id) : null, replayed: true as const };
    }

    const allowedProjectValues: Record<string, unknown> = {};
    for (const [fieldKey, definition] of Object.entries(FACT_DEFINITIONS)) {
      if (fieldKey === "projectName") continue;
      const value = factMap[fieldKey];
      if (value !== undefined && value !== null && value !== "") allowedProjectValues[definition.projectColumn] = value;
    }
    if (!allowedProjectValues.ownershipType) {
      allowedProjectValues.ownershipType = OWNER_RELATIONSHIP_LABELS[opportunity.ownerRelationship] || opportunity.ownerRelationship;
    }
    const projectResult = await tx.insert(projects).values({
      userId: input.user.id,
      name: projectName,
      isTestProject: 0,
      description: clean(opportunity.objective, 8000) || "فُتح من بوابة مشروع COMO Next بعد مراجعة وثائق الأرض.",
      financingScenario: opportunity.developmentStrategy,
      ...allowedProjectValues,
    } as any);
    const projectId = Number(projectResult[0].insertId);
    await tx.insert(comoNextProjectAccess).values({ projectId, userId: input.user.id, accessRole: "manager", grantedByUserId: input.user.id });

    const workFileResult = await tx.insert(comoNextWorkFiles).values({
      userId: input.user.id,
      projectId,
      title: `فتح المشروع وتثبيت بياناته — ${projectName}`,
      governingQuestion: "هل أصبحت بطاقة المشروع الرسمية كاملة ومسنودة بوثائق الأرض المعتمدة؟",
      desiredOutcome: "بطاقة مشروع معتمدة، وثائق محمية، وفجوات معرفة واضحة للمتابعة.",
      workFileStatus: "open",
      priority: "important",
      ownerUserId: input.user.id,
      sourceSystem: "como_next_project_opportunity",
      sourceRecordId: `opportunity:${input.opportunityId}:opening-file`,
    });
    const workFileId = Number(workFileResult[0].insertId);

    const evidenceBody = acceptedFacts.map(fact => `${fact.fieldLabel}: ${fact.currentValue}${fact.sourceExcerpt ? `\nالدليل: ${fact.sourceExcerpt}` : ""}`).join("\n\n");
    const memoryResult = await tx.insert(comoNextWorkMemory).values({
      projectId,
      workFileId,
      memoryType: "material",
      entryType: "project_opening_evidence",
      title: "حقائق تأسيس المشروع من وثائق الأرض",
      body: evidenceBody || "لم تعتمد حقائق حقلية إضافية؛ تحفظ الوثائق كمرجع المشروع الأول.",
      sourceStatus: "owner_reviewed",
      isCurrent: 1,
      sourceSystem: "como_next_project_opportunity",
      sourceRecordId: `opportunity:${input.opportunityId}:facts`,
      occurredAt: nowSql(),
    });
    const memoryId = Number(memoryResult[0].insertId);
    for (const document of documents) {
      await tx.insert(comoNextWorkMemoryDocuments).values({ projectId, workFileId, memoryId, documentId: Number(document.documentId) });
    }

    const latestExtraction = await tx.select().from(comoNextProjectDocumentExtractions)
      .where(and(eq(comoNextProjectDocumentExtractions.opportunityId, input.opportunityId), eq(comoNextProjectDocumentExtractions.extractionStatus, "draft")))
      .orderBy(desc(comoNextProjectDocumentExtractions.createdAt)).limit(1);
    const missingRequirements = latestExtraction[0] ? safeJson<string[]>(latestExtraction[0].missingRequirementsJson, []) : [];
    const sourceSha = sha256(JSON.stringify({ opportunityId: input.opportunityId, projectName, acceptedFacts: acceptedFacts.map(fact => ({ key: fact.fieldKey, value: fact.currentValue })), documentSha: documents.map(document => document.documentId) }));
    await tx.insert(comoNextProjectDossiers).values({
      projectId,
      executiveContext: clean(opportunity.objective, 8000) || `مشروع ${projectName} فُتح رسميًا من بوابة الفرص بعد مراجعة وثائق الأرض.`,
      currentPosition: "تم فتح المشروع رسميًا، وتبدأ الآن مرحلة استكمال بطاقة التعريف والفجوات قبل الدراسات والتكليف.",
      lifecyclePhasesJson: JSON.stringify(["تعريف المشروع", "استكمال المتطلبات", "الدراسات والتكليف"]),
      keyPartiesJson: JSON.stringify([]),
      dependenciesJson: JSON.stringify(missingRequirements),
      openThreadsJson: JSON.stringify(missingRequirements),
      memoryGapsJson: JSON.stringify(missingRequirements),
      briefStatus: "reviewed",
      sourceSystem: "como_next_project_opportunity",
      sourceRecordId: `opportunity:${input.opportunityId}`,
      sourceSha256: sourceSha,
      reviewedAt: nowSql(),
    });
    await tx.insert(comoNextWorkFileEvents).values({
      userId: input.user.id,
      projectId,
      workFileId,
      sequenceNo: 1,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: "project_opened_from_opportunity",
      summary: "اعتمد عبد الرحمن فتح المشروع بعد مراجعة وثائق الأرض والحقائق المستخرجة",
      payloadJson: JSON.stringify({ opportunityId: input.opportunityId, documentCount: documents.length, acceptedFactCount: acceptedFacts.length }),
      idempotencyKey: `opportunity:${input.opportunityId}:project:${projectId}`,
      occurredAt: nowSql(),
    });
    await tx.update(comoNextProjectOpportunities).set({
      opportunityStatus: "approved",
      approvedProjectId: projectId,
      approvedByUserId: input.user.id,
      approvedAt: nowSql(),
    }).where(eq(comoNextProjectOpportunities.id, input.opportunityId));
    await appendOpportunityEvent(tx, {
      opportunityId: input.opportunityId,
      actorType: "human",
      actorUserId: input.user.id,
      eventType: "official_project_created",
      summary: "اعتمد عبد الرحمن الفرصة وأصبحت مشروعًا رسميًا بملف تنفيذي موحد",
      payload: { projectId, workFileId, memoryId },
      idempotencyKey: `opportunity:${input.opportunityId}:approved`,
    });
    return { projectId, workFileId, replayed: false as const };
  });
}

export async function archiveProjectOpportunity(input: { user: ProjectOpeningUser; opportunityId: number }) {
  assertProjectOpeningOwner(input.user);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const opportunity = await requireOwnedOpportunity(db, input.opportunityId, input.user.id);
  if (opportunity.approvedProjectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن أرشفة فرصة أصبحت مشروعًا رسميًا" });
  await db.transaction(async tx => {
    await tx.update(comoNextProjectOpportunities).set({ opportunityStatus: "archived" }).where(eq(comoNextProjectOpportunities.id, input.opportunityId));
    await appendOpportunityEvent(tx, { opportunityId: input.opportunityId, actorType: "human", actorUserId: input.user.id, eventType: "opportunity_archived", summary: "أرشف عبد الرحمن فرصة المشروع دون إنشاء مشروع رسمي" });
  });
  return { success: true as const };
}
