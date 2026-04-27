import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { 
  getProjectFinancialData,
  upsertFinancialData,
  getDb
} from "../db";
import { sql } from "drizzle-orm";

function qRows<T = any>(db: any, query: any): Promise<T[]> {
  return db.execute(query).then((res: any) => {
    const rows = Array.isArray(res) ? res[0] : res;
    return Array.isArray(rows) ? rows : (rows?.rows ?? []);
  });
}

export const financialRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectFinancialData(input);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
        designType: z.enum(["pct", "lump", "lumpsum"]).optional(),
        designValue: z.number().optional(),
        supervisionType: z.enum(["pct", "lump", "lumpsum", "monthly_rate"]).optional(),
        supervisionValue: z.number().optional(),
        proposalLink: z.string().optional(),
        designGapOverride: z.number().nullable().optional(),
        supervisionGapOverride: z.number().nullable().optional(),
      })
    )
    .mutation(({ input }) => {
      const { projectId, consultantId, ...data } = input;
      return upsertFinancialData(projectId, consultantId, data as any);
    }),

  // Get required supervision roles for a project + consultant (from baseline matrix)
  getProjectSupervisionRoles: publicProcedure
    .input(z.object({ cpaProjectId: z.number(), projectConsultantId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Get building category for this project
      const projects = await qRows<any>(
        db,
        sql`SELECT p.building_category_id FROM cpa_projects p WHERE p.id = ${input.cpaProjectId}`
      );
      const catId = projects[0]?.building_category_id;
      if (!catId) return [];
      // Get required roles from baseline for this category, with consultant's proposed rates
      const roles = await qRows<any>(
        db,
        sql`SELECT sr.id, sr.code, sr.label, sr.team_type, sr.monthly_rate_aed as reference_rate,
                   sb.required_allocation_pct,
                   cst.proposed_monthly_rate, cst.proposed_allocation_pct
            FROM cpa_supervision_roles sr
            JOIN cpa_supervision_baseline sb ON sb.supervision_role_id = sr.id AND sb.building_category_id = ${catId}
            LEFT JOIN cpa_consultant_supervision_team cst 
                   ON cst.supervision_role_id = sr.id AND cst.project_consultant_id = ${input.projectConsultantId}
            WHERE sb.required_allocation_pct > 0
            ORDER BY sr.sort_order`
      );
      return roles;
    }),

  // Save a single role's monthly rate for a consultant
  saveSupervisionMonthlyRate: protectedProcedure
    .input(z.object({
      projectConsultantId: z.number(),
      supervisionRoleId: z.number(),
      proposedMonthlyRate: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.execute(
        sql`INSERT INTO cpa_consultant_supervision_team
              (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate)
            VALUES (${input.projectConsultantId}, ${input.supervisionRoleId}, 0, ${input.proposedMonthlyRate ?? null})
            ON DUPLICATE KEY UPDATE
              proposed_monthly_rate = VALUES(proposed_monthly_rate)`
      );
      return { ok: true };
    }),
});
