import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

async function qRows<T = Record<string, unknown>>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

export const offerReaderRouter = router({
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

  requestAssistantReview: protectedProcedure
    .input(z.object({ cpaProjectId: z.number(), projectConsultantId: z.number(), systemProjectId: z.number(), proposalId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const requirementSets = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirement_sets WHERE project_id = ${input.systemProjectId} AND status = 'APPROVED' ORDER BY revision_no DESC LIMIT 1`);
      const set = requirementSets[0];
      if (!set) throw new Error("اعتمد متطلبات المشروع أولًا قبل قراءة أي عرض للمقارنة");
      const consultantRows = await qRows<any>(db, sql`SELECT consultant_id FROM cpa_project_consultants WHERE id = ${input.projectConsultantId} AND cpa_project_id = ${input.cpaProjectId} LIMIT 1`);
      const consultantId = consultantRows[0]?.consultant_id;
      if (!consultantId) throw new Error("الاستشاري غير مرتبط بهذا المشروع");
      const proposalRows = await qRows<any>(db, sql`SELECT id, title, fileUrl, fileName, mimeType, extractedText FROM consultantProposals WHERE id = ${input.proposalId} AND projectId = ${input.systemProjectId} AND consultantId = ${consultantId} LIMIT 1`);
      const proposal = proposalRows[0];
      if (!proposal) throw new Error("ملف العرض المختار لا يخص هذا المشروع أو هذا الاستشاري");
      const requirements = await qRows<any>(db, sql`SELECT id, label, description, workstream, requirement_group, pricing_basis, gap_value_aed, duration_months, allocation_pct FROM project_consultant_requirements WHERE requirement_set_id = ${set.id} AND is_required = 1 ORDER BY sort_order, id`);
      if (!requirements.length) throw new Error("لا توجد بنود مطلوبة في معيار المشروع المعتمد");
      const snapshot = { requirementSetId: set.id, projectConsultantId: input.projectConsultantId, proposal: { id: proposal.id, title: proposal.title, fileName: proposal.fileName }, requirements };
      await db.execute(sql`UPDATE consultant_offer_readings SET status = 'SUPERSEDED' WHERE project_consultant_id = ${input.projectConsultantId} AND project_requirement_set_id = ${set.id} AND status = 'DRAFT'`);
      await db.execute(sql`INSERT INTO consultant_offer_readings (project_consultant_id, project_requirement_set_id, source_proposal_id, status, model_id, input_snapshot) VALUES (${input.projectConsultantId}, ${set.id}, ${proposal.id}, 'DRAFT', 'ASSISTANT_MANUAL_REVIEW', ${JSON.stringify(snapshot)})`);
      return { success: true, message: "تم إرسال العرض إلى قائمة مراجعة المساعد" };
    }),

  saveAssistantReview: protectedProcedure
    .input(z.object({ readingId: z.number(), extraction: z.record(z.string(), z.any()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await qRows<any>(db, sql`SELECT input_snapshot FROM consultant_offer_readings WHERE id = ${input.readingId} AND status = 'DRAFT' LIMIT 1`);
      if (!rows[0]) throw new Error("لا توجد مراجعة معلقة قابلة للحفظ");
      const snapshot = JSON.parse(String(rows[0].input_snapshot || "{}"));
      const validIds = new Set((snapshot.requirements || []).map((item: any) => Number(item.id)));
      const coverage = Array.isArray(input.extraction.coverage) ? input.extraction.coverage : [];
      if (coverage.some((item: any) => !validIds.has(Number(item.requirement_id)))) throw new Error("تحتوي المراجعة على بند خارج متطلبات المشروع المعتمدة");
      await db.execute(sql`UPDATE consultant_offer_readings SET status = 'REVIEWED', model_id = 'ASSISTANT_MANUAL_REVIEW', extraction_json = ${JSON.stringify(input.extraction)} WHERE id = ${input.readingId} AND status = 'DRAFT'`);
      return { success: true };
    }),

  saveOwnerCorrection: protectedProcedure
    .input(z.object({ readingId: z.number(), extraction: z.record(z.string(), z.any()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await qRows<any>(db, sql`SELECT * FROM consultant_offer_readings WHERE id = ${input.readingId} AND status = 'REVIEWED' LIMIT 1`);
      const source = rows[0];
      if (!source) throw new Error("لا توجد مراجعة مكتملة قابلة لتصحيح المالك");
      const snapshot = JSON.parse(String(source.input_snapshot || "{}"));
      const validIds = new Set((snapshot.requirements || []).map((item: any) => Number(item.id)));
      const coverage = Array.isArray(input.extraction.coverage) ? input.extraction.coverage : [];
      if (coverage.some((item: any) => !validIds.has(Number(item.requirement_id)))) throw new Error("يحتوي تصحيح المالك على بند خارج متطلبات المشروع المعتمدة");
      await db.execute(sql`INSERT INTO consultant_offer_readings (project_consultant_id, project_requirement_set_id, source_proposal_id, status, model_id, input_snapshot, extraction_json) VALUES (${source.project_consultant_id}, ${source.project_requirement_set_id}, ${source.source_proposal_id}, 'REVIEWED', 'OWNER_CORRECTION', ${source.input_snapshot}, ${JSON.stringify(input.extraction)})`);
      return { success: true };
    }),
});
