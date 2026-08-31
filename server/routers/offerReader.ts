import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";

const OFFER_READER_MODEL = "gemini-3.1-pro-preview";
const coverageStatusSchema = z.enum(["INCLUDED", "PARTIAL", "EXCLUDED", "NOT_MENTIONED"]);

const reviewedExtractionSchema = z.object({
  proposal_date: z.string().nullable().optional(),
  proposal_reference: z.string().nullable().optional(),
  design_fee: z.object({
    method: z.enum(["LUMP_SUM", "PERCENTAGE", "NOT_STATED"]),
    amount: z.number().nonnegative().nullable(),
    percentage: z.number().min(0).max(1).nullable(),
    evidence: z.string(),
    confidence: z.number().min(0).max(100),
  }),
  coverage: z.array(z.object({
    requirement_id: z.number().int().positive(),
    requirement_label: z.string(),
    status: coverageStatusSchema,
    evidence: z.string(),
    note: z.string(),
    confidence: z.number().min(0).max(100),
  })),
  overall_notes: z.string(),
  needs_review: z.boolean(),
});

type ReviewedExtraction = z.infer<typeof reviewedExtractionSchema>;

const assistantOutputSchema = {
  name: "consultant_design_offer_reading",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      proposal_date: { anyOf: [{ type: "string" }, { type: "null" }] },
      proposal_reference: { anyOf: [{ type: "string" }, { type: "null" }] },
      design_fee: {
        type: "object",
        additionalProperties: false,
        properties: {
          method: { type: "string", enum: ["LUMP_SUM", "PERCENTAGE", "NOT_STATED"] },
          amount: { anyOf: [{ type: "number" }, { type: "null" }] },
          percentage: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }] },
          evidence: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["method", "amount", "percentage", "evidence", "confidence"],
      },
      coverage: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            requirement_id: { type: "integer" },
            requirement_label: { type: "string" },
            status: { type: "string", enum: ["INCLUDED", "PARTIAL", "EXCLUDED", "NOT_MENTIONED"] },
            evidence: { type: "string" },
            note: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["requirement_id", "requirement_label", "status", "evidence", "note", "confidence"],
        },
      },
      overall_notes: { type: "string" },
      needs_review: { type: "boolean" },
    },
    required: ["proposal_date", "proposal_reference", "design_fee", "coverage", "overall_notes", "needs_review"],
  },
};

async function qRows<T = Record<string, unknown>>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

function responseText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part: any) => part?.type === "text").map((part: any) => String(part.text || "")).join("\n");
}

function normalizeExtraction(raw: unknown, requirements: any[]): ReviewedExtraction {
  const parsed = reviewedExtractionSchema.parse(raw);
  const byId = new Map(parsed.coverage.map((item) => [Number(item.requirement_id), item]));
  const coverage = requirements.map((requirement) => {
    const id = Number(requirement.id);
    const item = byId.get(id);
    if (!item) {
      return { requirement_id: id, requirement_label: String(requirement.label), status: "NOT_MENTIONED" as const, evidence: "", note: "لم يُرجع التحليل نتيجة لهذا البند؛ يلزم التحقق", confidence: 0 };
    }
    return { ...item, requirement_id: id, requirement_label: String(requirement.label) };
  });
  const method = parsed.design_fee.method;
  const designFee = {
    ...parsed.design_fee,
    amount: method === "LUMP_SUM" ? parsed.design_fee.amount : null,
    percentage: method === "PERCENTAGE" ? parsed.design_fee.percentage : null,
  };
  return {
    ...parsed,
    design_fee: designFee,
    coverage,
    needs_review: parsed.needs_review || coverage.some((item) => item.confidence < 75),
  };
}

async function applyReviewedDesignInput(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, source: any, extraction: ReviewedExtraction) {
  const snapshot = JSON.parse(String(source.input_snapshot || "{}"));
  const requirements = Array.isArray(snapshot.requirements) ? snapshot.requirements : [];
  const validIds = new Set(requirements.map((item: any) => Number(item.id)));
  if (extraction.coverage.length !== requirements.length || extraction.coverage.some((item) => !validIds.has(Number(item.requirement_id)))) {
    throw new Error("مراجعة العرض لا تطابق نطاق التصميم المعتمد للمشروع");
  }
  if (extraction.design_fee.method === "NOT_STATED") throw new Error("لا يمكن إرسال العرض للتقييم قبل تحديد أتعاب التصميم من مصدر واضح");

  const designAmount = extraction.design_fee.method === "LUMP_SUM" ? extraction.design_fee.amount : null;
  const designPercentage = extraction.design_fee.method === "PERCENTAGE" ? extraction.design_fee.percentage : null;
  if (designAmount === null && designPercentage === null) throw new Error("قيمة أتعاب التصميم غير مكتملة");

  await db.execute(sql`
    UPDATE cpa_project_consultants
    SET proposal_date = ${extraction.proposal_date ?? null},
        proposal_reference = ${extraction.proposal_reference ?? null},
        design_fee_method = ${extraction.design_fee.method},
        design_fee_amount = ${designAmount},
        design_fee_percentage = ${designPercentage},
        status = 'CONFIRMED'
    WHERE id = ${source.project_consultant_id}
  `);

  await db.execute(sql`
    DELETE coverage
    FROM cpa_consultant_scope_coverage coverage
    JOIN cpa_scope_items scope_item ON scope_item.id = coverage.scope_item_id
    JOIN cpa_scope_sections section ON section.id = scope_item.section_id
    WHERE coverage.project_consultant_id = ${source.project_consultant_id}
      AND section.code LIKE 'ENC_%'
  `);

  for (const item of extraction.coverage) {
    const rows = await qRows<any>(db, sql`
      SELECT ref.legacy_scope_item_id
      FROM project_consultant_requirements requirement
      JOIN consultant_requirement_reference_items ref ON ref.id = requirement.reference_item_id
      WHERE requirement.id = ${item.requirement_id}
        AND requirement.requirement_set_id = ${source.project_requirement_set_id}
        AND requirement.workstream = 'DESIGN'
        AND requirement.is_required = 1
        AND ref.legacy_scope_item_id IS NOT NULL
      LIMIT 1
    `);
    const scopeItemId = rows[0]?.legacy_scope_item_id ? Number(rows[0].legacy_scope_item_id) : null;
    if (!scopeItemId) throw new Error(`تعذر ربط بند التصميم رقم ${item.requirement_id} بمحرك التقييم الحالي`);
    const evaluationStatus = item.status === "INCLUDED" ? "INCLUDED" : item.status === "NOT_MENTIONED" ? "NOT_MENTIONED" : "EXCLUDED";
    const noteParts = [item.status === "PARTIAL" ? "الحالة الأصلية: مشمول جزئيًا" : null, item.evidence || null, item.note || null].filter(Boolean);
    await db.execute(sql`
      INSERT INTO cpa_consultant_scope_coverage
        (project_consultant_id, scope_item_id, coverage_status, notes)
      VALUES (${source.project_consultant_id}, ${scopeItemId}, ${evaluationStatus}, ${noteParts.join(" | ") || null})
    `);
  }
}

export const offerReaderRouter = router({
  getUploadContext: protectedProcedure
    .input(z.object({ cpaProjectId: z.number(), projectConsultantId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await qRows<any>(db, sql`
        SELECT consultant_id
        FROM cpa_project_consultants
        WHERE id = ${input.projectConsultantId}
          AND cpa_project_id = ${input.cpaProjectId}
        LIMIT 1
      `);
      return rows[0]?.consultant_id ? { consultantId: Number(rows[0].consultant_id) } : null;
    }),

  listSources: protectedProcedure
    .input(z.object({ systemProjectId: z.number(), projectConsultantId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const consultantRows = await qRows<any>(db, sql`SELECT consultant_id FROM cpa_project_consultants WHERE id = ${input.projectConsultantId} LIMIT 1`);
      const consultantId = consultantRows[0]?.consultant_id;
      if (!consultantId) return [];
      return qRows(db, sql`
        SELECT id, title, fileName, fileUrl, mimeType, createdAt
        FROM consultantProposals
        WHERE projectId = ${input.systemProjectId} AND consultantId = ${consultantId}
        ORDER BY createdAt DESC
      `);
    }),

  listReadings: protectedProcedure
    .input(z.object({ projectConsultantId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return qRows(db, sql`SELECT * FROM consultant_offer_readings WHERE project_consultant_id = ${input.projectConsultantId} ORDER BY created_at DESC`);
    }),

  analyzeProposal: protectedProcedure
    .input(z.object({ cpaProjectId: z.number(), projectConsultantId: z.number(), systemProjectId: z.number(), proposalId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const requirementSets = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirement_sets WHERE project_id = ${input.systemProjectId} AND status = 'APPROVED' AND notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%' ORDER BY revision_no DESC LIMIT 1`);
      const set = requirementSets[0];
      if (!set) throw new Error("اعتمد نطاق التصميم النهائي للمشروع أولًا قبل تحليل أي عرض");
      const consultantRows = await qRows<any>(db, sql`SELECT consultant_id FROM cpa_project_consultants WHERE id = ${input.projectConsultantId} AND cpa_project_id = ${input.cpaProjectId} LIMIT 1`);
      const consultantId = consultantRows[0]?.consultant_id;
      if (!consultantId) throw new Error("الاستشاري غير مرتبط بهذا المشروع");
      const proposalRows = await qRows<any>(db, sql`SELECT id, title, fileUrl, fileName, mimeType FROM consultantProposals WHERE id = ${input.proposalId} AND projectId = ${input.systemProjectId} AND consultantId = ${consultantId} LIMIT 1`);
      const proposal = proposalRows[0];
      if (!proposal) throw new Error("ملف العرض المختار لا يخص هذا المشروع أو هذا الاستشاري");
      if (proposal.mimeType !== "application/pdf") throw new Error("تحليل المساعد في هذه المرحلة يقبل ملف PDF الأصلي فقط");
      const requirements = await qRows<any>(db, sql`SELECT id, code, label, description, requirement_group, sort_order FROM project_consultant_requirements WHERE requirement_set_id = ${set.id} AND is_required = 1 AND workstream = 'DESIGN' ORDER BY sort_order, id`);
      if (!requirements.length) throw new Error("لا توجد بنود تصميم مطلوبة في نطاق المشروع المعتمد");
      const snapshot = { requirementSetId: set.id, projectConsultantId: input.projectConsultantId, proposal: { id: proposal.id, title: proposal.title, fileName: proposal.fileName }, requirements };
      await db.execute(sql`UPDATE consultant_offer_readings SET status = 'SUPERSEDED' WHERE project_consultant_id = ${input.projectConsultantId} AND project_requirement_set_id = ${set.id} AND status = 'DRAFT'`);
      const insertResult = await db.execute(sql`INSERT INTO consultant_offer_readings (project_consultant_id, project_requirement_set_id, source_proposal_id, status, model_id, input_snapshot) VALUES (${input.projectConsultantId}, ${set.id}, ${proposal.id}, 'DRAFT', ${OFFER_READER_MODEL}, ${JSON.stringify(snapshot)})`);
      const readingId = Number((insertResult[0] as any).insertId);
      const scopeText = requirements.map((item: any) => `${item.id} | ${item.code} | ${item.label} | ${item.description || ""}`).join("\n");
      const prompt = `اقرأ عرض الاستشاري الأصلي المرفق بوصفه مصدرًا وحيدًا. المطلوب تحليل نطاق التصميم فقط؛ تجاهل البنود القانونية والتعاقدية والإشراف والموارد البشرية ولا تستخرجها.\n\nاستخرج تاريخ العرض ومرجعه وأتعاب التصميم كما وردت: مبلغ مقطوع أو نسبة فقط، ولا تحوّل النسبة إلى مبلغ. إذا كانت النسبة 1.8% فأرجع percentage بالقيمة العشرية 0.018 حتى تطابق عقد التقييم الحالي. ثم قارن العرض ببنود نطاق المشروع التالية. INCLUDED عند وجود دليل صريح، EXCLUDED عند الاستثناء الصريح، PARTIAL عند التغطية الجزئية الصريحة، وNOT_MENTIONED عند غياب الدليل. لا تحسب فجوات أو تكاليف. لكل بند اذكر الصفحة أو القسم واقتباسًا قصيرًا إن وجد. أعد نتيجة لكل معرّف دون إضافة بنود جديدة.\n\nبنود المشروع المعتمدة:\n${scopeText}`;
      try {
        const response = await invokeLLM({
          model: OFFER_READER_MODEL,
          messages: [
            { role: "system", content: "أنت محلل عروض استشارية هندسية دقيق ومحايد. لا تخمّن ولا تضف معلومات غير موجودة في الملف. أخرج JSON مطابقًا للمخطط فقط." },
            { role: "user", content: [{ type: "text", text: prompt }, { type: "file_url", file_url: { url: proposal.fileUrl, mime_type: "application/pdf" } }] },
          ],
          response_format: { type: "json_schema", json_schema: assistantOutputSchema },
        });
        const raw = JSON.parse(responseText(response.choices[0]?.message?.content) || "{}");
        const extraction = normalizeExtraction(raw, requirements);
        await db.execute(sql`UPDATE consultant_offer_readings SET extraction_json = ${JSON.stringify(extraction)}, error_message = NULL WHERE id = ${readingId}`);
        return { success: true, readingId, modelId: OFFER_READER_MODEL, extraction };
      } catch (error: any) {
        await db.execute(sql`UPDATE consultant_offer_readings SET status = 'FAILED', error_message = ${String(error?.message || "تعذر تحليل العرض")} WHERE id = ${readingId}`);
        throw new Error(`تعذر تحليل العرض: ${String(error?.message || "خطأ غير معروف")}`);
      }
    }),

  approveForEvaluation: protectedProcedure
    .input(z.object({ readingId: z.number(), extraction: reviewedExtractionSchema }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await qRows<any>(db, sql`SELECT * FROM consultant_offer_readings WHERE id = ${input.readingId} AND status = 'DRAFT' AND extraction_json IS NOT NULL LIMIT 1`);
      const source = rows[0];
      if (!source) throw new Error("لا توجد نتيجة تحليل جاهزة للمراجعة والاعتماد");
      const extraction = reviewedExtractionSchema.parse(input.extraction);
      await applyReviewedDesignInput(db, source, extraction);
      await db.execute(sql`UPDATE consultant_offer_readings SET status = 'REVIEWED', extraction_json = ${JSON.stringify(extraction)} WHERE id = ${input.readingId} AND status = 'DRAFT'`);
      return { success: true };
    }),

  saveOwnerCorrection: protectedProcedure
    .input(z.object({ readingId: z.number(), extraction: reviewedExtractionSchema }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await qRows<any>(db, sql`SELECT * FROM consultant_offer_readings WHERE id = ${input.readingId} AND status = 'REVIEWED' LIMIT 1`);
      const source = rows[0];
      if (!source) throw new Error("لا توجد مراجعة مكتملة قابلة لتصحيح المالك");
      const extraction = reviewedExtractionSchema.parse(input.extraction);
      await applyReviewedDesignInput(db, source, extraction);
      await db.execute(sql`INSERT INTO consultant_offer_readings (project_consultant_id, project_requirement_set_id, source_proposal_id, status, model_id, input_snapshot, extraction_json) VALUES (${source.project_consultant_id}, ${source.project_requirement_set_id}, ${source.source_proposal_id}, 'REVIEWED', 'OWNER_CORRECTION', ${source.input_snapshot}, ${JSON.stringify(extraction)})`);
      return { success: true };
    }),
});
