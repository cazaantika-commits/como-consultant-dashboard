import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { upsertFinancialData } from "../db";
import {
  cpaEvaluationResults, cpaProjectConsultants, cpaProjects, cpaTrueCostReportApproval,
  financialData, projectConsultants,
} from "../../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireLegacyProjectRead, requireLegacyProjectWrite } from "../services/comoLegacyProjectAccess";
import { requireFinanceDatabase } from "../services/financeAccess";

const idInput = z.number().int().positive();
async function qRows<T>(db: Awaited<ReturnType<typeof requireFinanceDatabase>>, query: ReturnType<typeof sql>): Promise<T[]> {
  const result: unknown = await db.execute(query);
  const rows = Array.isArray(result) ? result[0] : result;
  if (!Array.isArray(rows)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة المصدر المالي" });
  return rows as T[];
}

async function requireUnlockedProject(projectId: number) {
  const db = await requireFinanceDatabase();
  const approvals = await db.select({ approved: cpaTrueCostReportApproval.isApproved })
    .from(cpaTrueCostReportApproval).innerJoin(cpaProjects, eq(cpaProjects.id, cpaTrueCostReportApproval.cpaProjectId))
    .where(eq(cpaProjects.projectId, projectId));
  if (approvals.some(row => row.approved !== 0)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "التقرير المالي معتمد ومقفل؛ لا يمكن تعديل مصدره" });
  }
}

async function getScopedCpaConsultant(projectConsultantId: number) {
  const db = await requireFinanceDatabase();
  const [record] = await db.select({ projectId: cpaProjects.projectId, cpaProjectId: cpaProjects.id })
    .from(cpaProjectConsultants).innerJoin(cpaProjects, eq(cpaProjects.id, cpaProjectConsultants.cpaProjectId))
    .where(eq(cpaProjectConsultants.id, projectConsultantId)).limit(1);
  if (!record) throw new TRPCError({ code: "FORBIDDEN", message: "المكتب خارج نطاق المشروع" });
  return record;
}

export const financialRouter = router({
  getByProject: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    await requireLegacyProjectRead(ctx.user, input);
    const db = await requireFinanceDatabase();
    const baseData = await db.select().from(financialData).where(eq(financialData.projectId, input));
    // Read the saved evaluation only. The legacy db helper runs a writing CPA engine on GET.
    const saved = await db.select({
      consultantId: cpaProjectConsultants.consultantId,
      projectConsultantId: cpaProjectConsultants.id, cpaProjectId: cpaProjects.id,
      evaluationId: cpaEvaluationResults.id,
      gap: cpaEvaluationResults.designScopeGapCost, supervisionGap: cpaEvaluationResults.supervisionGapCost,
      trueFee: cpaEvaluationResults.trueDesignFee,
    }).from(cpaProjects).innerJoin(cpaProjectConsultants, eq(cpaProjectConsultants.cpaProjectId, cpaProjects.id))
      .leftJoin(cpaEvaluationResults, eq(cpaEvaluationResults.projectConsultantId, cpaProjectConsultants.id))
      .where(eq(cpaProjects.projectId, input)).orderBy(desc(cpaEvaluationResults.id), desc(cpaProjects.id));
    return baseData.map(fd => {
      const source = saved.find(row => row.consultantId === fd.consultantId);
      const cpaDesignGap = source?.gap == null ? null : Number(source.gap);
      const cpaSupervisionGap = source?.supervisionGap == null ? null : Number(source.supervisionGap);
      return {
        ...fd,
        designScopeGapCost: fd.designGapOverride == null ? cpaDesignGap : Number(fd.designGapOverride),
        supervisionScopeGapCost: fd.supervisionGapOverride == null ? cpaSupervisionGap : Number(fd.supervisionGapOverride),
        trueDesignFee: source?.trueFee == null ? null : Number(source.trueFee),
        cpaDesignGap, cpaSupervisionGap,
        projectConsultantId: source?.projectConsultantId ?? null, cpaProjectId: source?.cpaProjectId ?? null,
        evaluationSource: source?.evaluationId ? "saved_evaluation" as const : "missing_evaluation" as const,
      };
    });
  }),

  upsert: protectedProcedure.input(z.object({
    projectId: idInput, consultantId: idInput,
    designType: z.enum(["pct", "lump", "lumpsum"]).optional(),
    designValue: z.number().finite().nonnegative().optional(),
    supervisionType: z.enum(["pct", "lump", "lumpsum", "monthly_rate"]).optional(),
    supervisionValue: z.number().finite().nonnegative().optional(),
    proposalLink: z.string().max(500).optional(),
    designGapOverride: z.number().finite().nonnegative().nullable().optional(),
    supervisionGapOverride: z.number().finite().nonnegative().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    await requireLegacyProjectWrite(ctx.user, input.projectId);
    await requireUnlockedProject(input.projectId);
    const db = await requireFinanceDatabase();
    const [legacy] = await db.select({ id: projectConsultants.id }).from(projectConsultants)
      .where(and(eq(projectConsultants.projectId, input.projectId), eq(projectConsultants.consultantId, input.consultantId))).limit(1);
    const [cpa] = await db.select({ id: cpaProjectConsultants.id }).from(cpaProjectConsultants)
      .innerJoin(cpaProjects, eq(cpaProjects.id, cpaProjectConsultants.cpaProjectId))
      .where(and(eq(cpaProjects.projectId, input.projectId), eq(cpaProjectConsultants.consultantId, input.consultantId))).limit(1);
    if (!legacy && !cpa) throw new TRPCError({ code: "FORBIDDEN", message: "المكتب غير مرتبط بالمشروع" });
    const { projectId, consultantId, designValue, supervisionValue, designGapOverride, supervisionGapOverride, ...data } = input;
    return upsertFinancialData(projectId, consultantId, {
      ...data,
      ...(designValue === undefined ? {} : { designValue: String(designValue) }),
      ...(supervisionValue === undefined ? {} : { supervisionValue: String(supervisionValue) }),
      ...(designGapOverride === undefined ? {} : { designGapOverride: designGapOverride === null ? null : String(designGapOverride) }),
      ...(supervisionGapOverride === undefined ? {} : { supervisionGapOverride: supervisionGapOverride === null ? null : String(supervisionGapOverride) }),
    });
  }),

  getProjectSupervisionRoles: protectedProcedure
    .input(z.object({ cpaProjectId: idInput, projectConsultantId: idInput }))
    .query(async ({ ctx, input }) => {
      const scope = await getScopedCpaConsultant(input.projectConsultantId);
      await requireLegacyProjectRead(ctx.user, scope.projectId);
      if (scope.cpaProjectId !== input.cpaProjectId) throw new TRPCError({ code: "FORBIDDEN", message: "المكتب لا يتبع المشروع المحدد" });
      const db = await requireFinanceDatabase();
      return qRows<{
        id: number; code: string; label: string; team_type: string; reference_rate: string;
        required_allocation_pct: string; proposed_monthly_rate: string | null; proposed_allocation_pct: string | null;
      }>(db, sql`SELECT sr.id, sr.code, sr.label, sr.team_type, sr.monthly_rate_aed as reference_rate,
                   COALESCE(NULLIF(pcr.allocation_pct, 0), 100) as required_allocation_pct,
                   cst.proposed_monthly_rate, cst.proposed_allocation_pct
            FROM cpa_projects cp
            JOIN project_consultant_requirement_sets prs
              ON prs.id = (
                SELECT current_set.id FROM project_consultant_requirement_sets current_set
                WHERE current_set.project_id = cp.project_id AND current_set.status IN ('DRAFT', 'APPROVED')
                ORDER BY current_set.revision_no DESC, current_set.id DESC LIMIT 1
              )
            JOIN project_consultant_requirements pcr ON pcr.requirement_set_id = prs.id AND pcr.is_required = 1
            JOIN consultant_requirement_reference_items ref ON ref.id = pcr.reference_item_id AND ref.source_type = 'LEGACY_SUPERVISION'
            JOIN cpa_supervision_roles sr ON sr.id = ref.legacy_supervision_role_id
            LEFT JOIN cpa_consultant_supervision_team cst ON cst.supervision_role_id = sr.id AND cst.project_consultant_id = ${input.projectConsultantId}
            WHERE cp.id = ${input.cpaProjectId} ORDER BY pcr.sort_order, pcr.id`);
    }),

  saveSupervisionMonthlyRate: protectedProcedure.input(z.object({
    projectConsultantId: idInput, supervisionRoleId: idInput,
    proposedMonthlyRate: z.number().finite().nonnegative().nullable(),
  })).mutation(async ({ ctx, input }) => {
    const scope = await getScopedCpaConsultant(input.projectConsultantId);
    await requireLegacyProjectWrite(ctx.user, scope.projectId);
    await requireUnlockedProject(scope.projectId);
    const db = await requireFinanceDatabase();
    const roles = await qRows<{ id: number }>(db, sql`SELECT id FROM cpa_supervision_roles WHERE id = ${input.supervisionRoleId} LIMIT 1`);
    if (!roles.length) throw new TRPCError({ code: "BAD_REQUEST", message: "دور الإشراف غير موجود" });
    await db.execute(sql`INSERT INTO cpa_consultant_supervision_team
      (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate)
      VALUES (${input.projectConsultantId}, ${input.supervisionRoleId}, 0, ${input.proposedMonthlyRate})
      ON DUPLICATE KEY UPDATE proposed_monthly_rate = VALUES(proposed_monthly_rate)`);
    return { ok: true };
  }),
});
