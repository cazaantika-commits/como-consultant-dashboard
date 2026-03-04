import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { phaseActivities, phaseCostLinks, projectPhases } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const phaseManagementRouter = router({
  // ═══════════════════════════════════════════════════════════════
  // Phase Activities Management
  // ═══════════════════════════════════════════════════════════════

  listActivities: publicProcedure
    .input(z.number())
    .query(async ({ input: phaseId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const activities = await db.select().from(phaseActivities)
        .where(eq(phaseActivities.phaseId, phaseId))
        .orderBy(phaseActivities.activityNumber);
      
      return activities;
    }),

  createActivity: publicProcedure
    .input(z.object({
      phaseId: z.number(),
      activityNumber: z.number(),
      activityName: z.string(),
      description: z.string().optional(),
      startDate: z.string(),
      durationMonths: z.number(),
      endDate: z.string().optional(),
      estimatedCost: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const result = await db.insert(phaseActivities).values(input);
      return { id: result[0].insertId, ...input };
    }),

  updateActivity: publicProcedure
    .input(z.object({
      id: z.number(),
      activityName: z.string().optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      durationMonths: z.number().optional(),
      endDate: z.string().optional(),
      estimatedCost: z.number().optional(),
      progress: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...updates } = input;
      await db.update(phaseActivities)
        .set(updates)
        .where(eq(phaseActivities.id, id));
      
      return { success: true };
    }),

  deleteActivity: publicProcedure
    .input(z.number())
    .mutation(async ({ input: activityId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.delete(phaseActivities).where(eq(phaseActivities.id, activityId));
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // Phase Cost Links Management
  // ═══════════════════════════════════════════════════════════════

  linkCostToPhase: publicProcedure
    .input(z.object({
      phaseId: z.number(),
      activityId: z.number().optional(),
      costItemId: z.number(),
      allocatedAmount: z.number(),
      allocationPercentage: z.number().optional(),
      startMonth: z.string(),
      endMonth: z.string(),
      distributionType: z.enum(['lump_sum', 'linear', 'milestone', 'custom']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const result = await db.insert(phaseCostLinks).values({
        ...input,
        distributionType: input.distributionType || 'linear',
      });
      
      return { id: result[0].insertId, ...input };
    }),

  unlinkCostFromPhase: publicProcedure
    .input(z.number())
    .mutation(async ({ input: linkId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.delete(phaseCostLinks).where(eq(phaseCostLinks.id, linkId));
      return { success: true };
    }),

  getPhaseLinkedCosts: publicProcedure
    .input(z.object({
      phaseId: z.number().optional(),
      activityId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let query = db.select().from(phaseCostLinks);
      
      if (input.phaseId) {
        query = query.where(eq(phaseCostLinks.phaseId, input.phaseId));
      }
      
      if (input.activityId) {
        query = query.where(eq(phaseCostLinks.activityId, input.activityId));
      }
      
      const links = await query;
      return links;
    }),
});
