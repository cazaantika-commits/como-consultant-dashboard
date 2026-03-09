import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { projectRiskScores, projects, joelleAnalysisStages } from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const riskDashboardRouter = router({
  // Get risk scores for all projects
  getAllProjectRisks: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get all projects with their latest risk scores
      const userProjects = await db.select({
        id: projects.id,
        name: projects.name,
        community: projects.community,
        projectType: projects.projectType,
      })
        .from(projects)
        .where(eq(projects.userId, ctx.user.id));

      const projectIds = userProjects.map(p => p.id);
      if (projectIds.length === 0) return { projects: [], summary: null };

      // Get latest risk scores for each project
      const riskScores = await db.select()
        .from(projectRiskScores)
        .where(and(
          eq(projectRiskScores.userId, ctx.user.id),
          inArray(projectRiskScores.projectId, projectIds)
        ))
        .orderBy(desc(projectRiskScores.createdAt));

      // Group by project (latest score per project)
      const latestScores = new Map<number, typeof riskScores[0]>();
      for (const score of riskScores) {
        if (!latestScores.has(score.projectId)) {
          latestScores.set(score.projectId, score);
        }
      }

      const projectsWithRisk = userProjects.map(p => ({
        ...p,
        riskScore: latestScores.get(p.id) || null,
      }));

      // Calculate summary
      const scored = projectsWithRisk.filter(p => p.riskScore);
      const avgPmri = scored.length > 0
        ? scored.reduce((sum, p) => sum + Number(p.riskScore?.pmriScore || 0), 0) / scored.length
        : 0;

      const riskDistribution = {
        low: scored.filter(p => p.riskScore?.riskLevel === 'low').length,
        medium: scored.filter(p => p.riskScore?.riskLevel === 'medium').length,
        high: scored.filter(p => p.riskScore?.riskLevel === 'high').length,
        critical: scored.filter(p => p.riskScore?.riskLevel === 'critical').length,
      };

      return {
        projects: projectsWithRisk,
        summary: {
          totalProjects: userProjects.length,
          assessedProjects: scored.length,
          avgPmri: Math.round(avgPmri * 100) / 100,
          riskDistribution,
          highRiskProjects: scored.filter(p => 
            p.riskScore?.riskLevel === 'high' || p.riskScore?.riskLevel === 'critical'
          ).map(p => ({ id: p.id, name: p.name, pmri: Number(p.riskScore?.pmriScore) })),
        },
      };
    }),

  // Get detailed risk for a single project
  getProjectRisk: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get project info
      const project = await db.select().from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id)))
        .limit(1);

      if (!project[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      // Get all risk scores (history)
      const scores = await db.select()
        .from(projectRiskScores)
        .where(and(
          eq(projectRiskScores.userId, ctx.user.id),
          eq(projectRiskScores.projectId, input.projectId)
        ))
        .orderBy(desc(projectRiskScores.createdAt));

      // Get Engine 9 stage data if available
      const engine9 = await db.select()
        .from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.projectId, input.projectId),
          eq(joelleAnalysisStages.stageNumber, 9)
        ))
        .limit(1);

      return {
        project: project[0],
        latestScore: scores[0] || null,
        history: scores,
        engine9Data: engine9[0] || null,
      };
    }),

  // Save risk score (called by Engine 9 or manually)
  saveRiskScore: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      pmriScore: z.number().min(0).max(100),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
      marketRisk: z.number().min(0).max(100).optional(),
      financialRisk: z.number().min(0).max(100).optional(),
      competitiveRisk: z.number().min(0).max(100).optional(),
      regulatoryRisk: z.number().min(0).max(100).optional(),
      executionRisk: z.number().min(0).max(100).optional(),
      marketRiskDetails: z.string().optional(),
      financialRiskDetails: z.string().optional(),
      competitiveRiskDetails: z.string().optional(),
      regulatoryRiskDetails: z.string().optional(),
      executionRiskDetails: z.string().optional(),
      mitigationStrategies: z.string().optional(),
      dataSourcesUsed: z.string().optional(),
      confidenceLevel: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await db.insert(projectRiskScores).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        pmriScore: String(input.pmriScore),
        riskLevel: input.riskLevel,
        marketRisk: input.marketRisk ? String(input.marketRisk) : null,
        financialRisk: input.financialRisk ? String(input.financialRisk) : null,
        competitiveRisk: input.competitiveRisk ? String(input.competitiveRisk) : null,
        regulatoryRisk: input.regulatoryRisk ? String(input.regulatoryRisk) : null,
        executionRisk: input.executionRisk ? String(input.executionRisk) : null,
        marketRiskDetails: input.marketRiskDetails || null,
        financialRiskDetails: input.financialRiskDetails || null,
        competitiveRiskDetails: input.competitiveRiskDetails || null,
        regulatoryRiskDetails: input.regulatoryRiskDetails || null,
        executionRiskDetails: input.executionRiskDetails || null,
        mitigationStrategies: input.mitigationStrategies || null,
        analysisDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        dataSourcesUsed: input.dataSourcesUsed || null,
        confidenceLevel: input.confidenceLevel ? String(input.confidenceLevel) : null,
        notes: input.notes || null,
      });

      return { success: true, id: result[0].insertId };
    }),

  // Compare risks between projects
  compareProjects: protectedProcedure
    .input(z.object({ projectIds: z.array(z.number()).min(2).max(6) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const results = [];
      for (const projectId of input.projectIds) {
        const project = await db.select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.userId, ctx.user.id)))
          .limit(1);

        const score = await db.select()
          .from(projectRiskScores)
          .where(and(
            eq(projectRiskScores.userId, ctx.user.id),
            eq(projectRiskScores.projectId, projectId)
          ))
          .orderBy(desc(projectRiskScores.createdAt))
          .limit(1);

        if (project[0]) {
          results.push({
            project: project[0],
            riskScore: score[0] || null,
          });
        }
      }

      return results;
    }),

  // Get risk alerts (high/critical projects)
  getAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const highRisk = await db.select({
        scoreId: projectRiskScores.id,
        projectId: projectRiskScores.projectId,
        pmriScore: projectRiskScores.pmriScore,
        riskLevel: projectRiskScores.riskLevel,
        marketRisk: projectRiskScores.marketRisk,
        financialRisk: projectRiskScores.financialRisk,
        competitiveRisk: projectRiskScores.competitiveRisk,
        regulatoryRisk: projectRiskScores.regulatoryRisk,
        executionRisk: projectRiskScores.executionRisk,
        analysisDate: projectRiskScores.analysisDate,
        projectName: projects.name,
      })
        .from(projectRiskScores)
        .innerJoin(projects, eq(projectRiskScores.projectId, projects.id))
        .where(and(
          eq(projectRiskScores.userId, ctx.user.id),
          sql`${projectRiskScores.riskLevel} IN ('high', 'critical')`
        ))
        .orderBy(desc(projectRiskScores.pmriScore))
        .limit(20);

      // Generate alerts
      const alerts = highRisk.map(r => {
        const categories: string[] = [];
        if (Number(r.marketRisk) >= 70) categories.push("مخاطر السوق");
        if (Number(r.financialRisk) >= 70) categories.push("مخاطر مالية");
        if (Number(r.competitiveRisk) >= 70) categories.push("مخاطر تنافسية");
        if (Number(r.regulatoryRisk) >= 70) categories.push("مخاطر تنظيمية");
        if (Number(r.executionRisk) >= 70) categories.push("مخاطر تنفيذية");

        return {
          projectId: r.projectId,
          projectName: r.projectName,
          pmriScore: Number(r.pmriScore),
          riskLevel: r.riskLevel,
          highRiskCategories: categories,
          analysisDate: r.analysisDate,
        };
      });

      return alerts;
    }),
});
