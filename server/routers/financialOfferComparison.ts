import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { requireLegacyProjectRead } from "../services/comoLegacyProjectAccess";
import { requireConsultantProject, requireConsultantLink, assertCostReportUnlocked } from "../services/consultantAccess";
import { offerGapState, feePercentagePoints } from "../../shared/consultantContracts";

async function qRows<T = Record<string, unknown>>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

type Coverage = { requirement_id: number; status: "INCLUDED" | "PARTIAL" | "EXCLUDED" | "NOT_MENTIONED"; evidence: string; confidence: number };

function parseExtraction(raw: unknown) {
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

export const financialOfferComparisonRouter = router({
  getEvidenceStatus: protectedProcedure
    .input(z.object({ systemProjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLegacyProjectRead(ctx.user, input.systemProjectId);
      const db = await getDb();
      if (!db) return { linked: false, cpaProjectId: null, approved: false, revisionNo: null, reviewed: 0, total: 0 };
      const cpaProjects = await qRows<any>(db, sql`SELECT id FROM cpa_projects WHERE project_id = ${input.systemProjectId} ORDER BY id DESC LIMIT 1`);
      const cpaProjectId = cpaProjects[0]?.id ? Number(cpaProjects[0].id) : null;
      if (!cpaProjectId) return { linked: false, cpaProjectId: null, approved: false, revisionNo: null, reviewed: 0, total: 0 };
      const sets = await qRows<any>(db, sql`SELECT id, revision_no FROM project_consultant_requirement_sets WHERE project_id = ${input.systemProjectId} AND status = 'APPROVED' ORDER BY revision_no DESC LIMIT 1`);
      const set = sets[0];
      const totalRows = await qRows<any>(db, sql`SELECT COUNT(*) AS total FROM cpa_project_consultants WHERE cpa_project_id = ${cpaProjectId}`);
      if (!set) return { linked: true, cpaProjectId, approved: false, revisionNo: null, reviewed: 0, total: Number(totalRows[0]?.total ?? 0) };
      const reviewedRows = await qRows<any>(db, sql`SELECT COUNT(DISTINCT project_consultant_id) AS reviewed FROM consultant_offer_readings WHERE project_requirement_set_id = ${set.id} AND status = 'REVIEWED'`);
      return { linked: true, cpaProjectId, approved: true, revisionNo: Number(set.revision_no), reviewed: Number(reviewedRows[0]?.reviewed ?? 0), total: Number(totalRows[0]?.total ?? 0) };
    }),

  getReport: protectedProcedure
    .input(z.object({ cpaProjectId: z.number(), systemProjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLegacyProjectRead(ctx.user, input.systemProjectId);
      const projectId = await requireConsultantProject(ctx.user, input.cpaProjectId);
      if (projectId !== input.systemProjectId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { requirementSet: null, requirements: [], consultants: [], readiness: { reviewed: 0, total: 0 } };
      const sets = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirement_sets WHERE project_id = ${input.systemProjectId} AND status = 'APPROVED' ORDER BY revision_no DESC LIMIT 1`);
      const requirementSet = sets[0] ?? null;
      if (!requirementSet) return { requirementSet: null, requirements: [], consultants: [], readiness: { reviewed: 0, total: 0 } };
      const requirements = await qRows<any>(db, sql`
        SELECT * FROM project_consultant_requirements
        WHERE requirement_set_id = ${requirementSet.id} AND is_required = 1
          AND workstream IN ('DESIGN', 'ENGINEERING', 'GENERAL')
        ORDER BY workstream, requirement_group, sort_order, id
      `);
      const consultantRows = await qRows<any>(db, sql`
        SELECT pc.id AS project_consultant_id, cm.trade_name, cm.legal_name, cm.code AS consultant_code,
          (SELECT cor.id FROM consultant_offer_readings cor WHERE cor.project_consultant_id = pc.id AND cor.project_requirement_set_id = ${requirementSet.id} AND cor.status = 'REVIEWED' ORDER BY cor.id DESC LIMIT 1) AS reviewed_reading_id,
          (SELECT cor.extraction_json FROM consultant_offer_readings cor WHERE cor.project_consultant_id = pc.id AND cor.project_requirement_set_id = ${requirementSet.id} AND cor.status = 'REVIEWED' ORDER BY cor.id DESC LIMIT 1) AS extraction_json
        FROM cpa_project_consultants pc
        JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
        WHERE pc.cpa_project_id = ${input.cpaProjectId}
        ORDER BY cm.trade_name, cm.legal_name
      `);
      const overrides = await qRows<any>(db, sql`SELECT * FROM consultant_offer_gap_overrides WHERE project_requirement_set_id = ${requirementSet.id}`);
      const overrideMap = new Map(overrides.map((row: any) => [`${row.project_consultant_id}:${row.project_requirement_id}`, row]));
      const consultants = consultantRows.map((consultant: any) => {
        const extracted = parseExtraction(consultant.extraction_json);
        const coverage = Array.isArray(extracted.coverage) ? extracted.coverage as Coverage[] : [];
        const coverageMap = new Map(coverage.map((row) => [Number(row.requirement_id), row]));
        const items = requirements.map((requirement: any) => {
          const reading = coverageMap.get(Number(requirement.id));
          const override = overrideMap.get(`${consultant.project_consultant_id}:${requirement.id}`);
          const status = reading?.status ?? "NOT_REVIEWED";
          const gap = offerGapState(status, requirement.gap_value_aed, override?.gap_value_aed);
          const { needsGap, gapValue, unresolved } = gap;
          return { requirementId: Number(requirement.id), status, evidence: reading?.evidence ?? "", confidence: reading?.confidence ?? null, gapValue, hasOverride: Boolean(override), needsGap, unresolved };
        });
        const designAmount = Number(extracted.design_fee?.amount);
        const quotedDesignFee = Number.isFinite(designAmount) && designAmount > 0 ? designAmount : null;
        const unresolvedGaps = items.filter((item) => item.unresolved).length;
        const gapTotal = items.reduce((sum, item) => sum + (item.needsGap && item.gapValue !== null ? item.gapValue : 0), 0);
        return {
          id: Number(consultant.project_consultant_id),
          name: consultant.trade_name || consultant.legal_name || "استشاري",
          code: consultant.consultant_code,
          reviewedReadingId: consultant.reviewed_reading_id ? Number(consultant.reviewed_reading_id) : null,
          quotedDesignFee,
          quotedDesignPercentage: extracted.design_fee?.method === "PERCENTAGE" ? feePercentagePoints(extracted.design_fee?.percentage, "FRACTION") : null,
          missingFee: quotedDesignFee === null,
          feeAmountBasis: extracted.design_fee?.method === "PERCENTAGE" ? "APPROVED_CONSTRUCTION_COST_REQUIRED" : "SOURCE_AMOUNT",
          gapTotal,
          unresolvedGaps,
          adjustedDesignFee: quotedDesignFee === null || unresolvedGaps > 0 ? null : quotedDesignFee + gapTotal,
          items,
        };
      });
      return { requirementSet, requirements, consultants, readiness: { reviewed: consultants.filter((item: any) => item.reviewedReadingId).length, total: consultants.length } };
    }),

  getSupervisionReport: protectedProcedure
    .input(z.object({ cpaProjectId: z.number(), systemProjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLegacyProjectRead(ctx.user, input.systemProjectId);
      const projectId = await requireConsultantProject(ctx.user, input.cpaProjectId);
      if (projectId !== input.systemProjectId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { requirementSet: null, requirements: [], consultants: [] };
      const sets = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirement_sets WHERE project_id = ${input.systemProjectId} AND status = 'APPROVED' ORDER BY revision_no DESC LIMIT 1`);
      const requirementSet = sets[0] ?? null;
      if (!requirementSet) return { requirementSet: null, requirements: [], consultants: [] };
      const requirements = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirements WHERE requirement_set_id = ${requirementSet.id} AND is_required = 1 AND workstream = 'SUPERVISION' ORDER BY requirement_group, sort_order, id`);
      const consultantRows = await qRows<any>(db, sql`
        SELECT pc.id AS project_consultant_id, cm.trade_name, cm.legal_name,
          (SELECT cor.id FROM consultant_offer_readings cor WHERE cor.project_consultant_id = pc.id AND cor.project_requirement_set_id = ${requirementSet.id} AND cor.status = 'REVIEWED' ORDER BY cor.id DESC LIMIT 1) AS reviewed_reading_id,
          (SELECT cor.extraction_json FROM consultant_offer_readings cor WHERE cor.project_consultant_id = pc.id AND cor.project_requirement_set_id = ${requirementSet.id} AND cor.status = 'REVIEWED' ORDER BY cor.id DESC LIMIT 1) AS extraction_json
        FROM cpa_project_consultants pc JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
        WHERE pc.cpa_project_id = ${input.cpaProjectId} ORDER BY cm.trade_name, cm.legal_name
      `);
      const overrides = await qRows<any>(db, sql`SELECT * FROM consultant_offer_gap_overrides WHERE project_requirement_set_id = ${requirementSet.id}`);
      const overrideMap = new Map(overrides.map((row: any) => [`${row.project_consultant_id}:${row.project_requirement_id}`, row]));
      const consultants = consultantRows.map((consultant: any) => {
        const extracted = parseExtraction(consultant.extraction_json);
        const coverageMap = new Map<number, Coverage>((Array.isArray(extracted.coverage) ? extracted.coverage as Coverage[] : []).map((item: Coverage) => [Number(item.requirement_id), item]));
        const items = requirements.map((requirement: any) => {
          const reading = coverageMap.get(Number(requirement.id));
          const status = reading?.status ?? "NOT_REVIEWED";
          const override = overrideMap.get(`${consultant.project_consultant_id}:${requirement.id}`);
          const { needsGap, gapValue, unresolved } = offerGapState(status, requirement.gap_value_aed, override?.gap_value_aed);
          return { requirementId: Number(requirement.id), status, evidence: reading?.evidence ?? "", gapValue, needsGap, unresolved };
        });
        const submitted = Number(extracted.supervision_fee?.amount);
        const quotedSupervisionFee = Number.isFinite(submitted) && submitted > 0 ? submitted : null;
        const unresolvedGaps = items.filter((item) => item.unresolved).length;
        const gapTotal = items.reduce((sum, item) => sum + (item.needsGap && item.gapValue !== null ? item.gapValue : 0), 0);
        return { id: Number(consultant.project_consultant_id), name: consultant.trade_name || consultant.legal_name || "استشاري", reviewedReadingId: consultant.reviewed_reading_id ? Number(consultant.reviewed_reading_id) : null, quotedSupervisionFee, gapTotal, unresolvedGaps, adjustedSupervisionFee: quotedSupervisionFee === null || unresolvedGaps > 0 ? null : quotedSupervisionFee + gapTotal, items };
      });
      return { requirementSet, requirements, consultants };
    }),

  setGapOverride: protectedProcedure
    .input(z.object({ projectConsultantId: z.number(), projectRequirementSetId: z.number(), projectRequirementId: z.number(), gapValueAed: z.number().min(0).nullable(), note: z.string().trim().max(2000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const setRows = await qRows<{ status: string; project_id: number }>(db, sql`SELECT status, project_id FROM project_consultant_requirement_sets WHERE id = ${input.projectRequirementSetId} LIMIT 1`);
      const link = await requireConsultantLink(ctx.user, input.projectConsultantId, "write");
      if (Number(setRows[0]?.project_id) !== link.projectId) throw new TRPCError({ code: "FORBIDDEN" });
      await assertCostReportUnlocked(link.cpaProjectId);
      const requirement = await qRows<{ id: number }>(db, sql`SELECT id FROM project_consultant_requirements WHERE id = ${input.projectRequirementId} AND requirement_set_id = ${input.projectRequirementSetId} LIMIT 1`);
      if (!requirement.length) throw new TRPCError({ code: "FORBIDDEN" });
      if (!setRows[0] || setRows[0].status !== 'APPROVED') throw new Error("اعتمد متطلبات المشروع أولًا قبل تعديل قيمة فجوة العرض");
      await db.execute(sql`
        INSERT INTO consultant_offer_gap_overrides (project_consultant_id, project_requirement_set_id, project_requirement_id, gap_value_aed, note)
        VALUES (${input.projectConsultantId}, ${input.projectRequirementSetId}, ${input.projectRequirementId}, ${input.gapValueAed}, ${input.note ?? null})
        ON DUPLICATE KEY UPDATE gap_value_aed = VALUES(gap_value_aed), note = VALUES(note), updated_at = CURRENT_TIMESTAMP
      `);
      return { success: true };
    }),
});
