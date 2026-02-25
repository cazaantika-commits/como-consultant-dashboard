import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { 
  addKnowledge, 
  updateKnowledge, 
  searchKnowledge, 
  getKnowledgeByDomain, 
  getKnowledgeStats,
  KnowledgeDomain
} from "../knowledgeService";
import { getDb } from "../db";
import { specialistKnowledge } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const DOMAINS = [
  'rera_law', 'dubai_municipality', 'building_codes', 'market_prices',
  'como_context', 'como_people', 'como_preferences', 'como_workflow',
  'consultant_info', 'project_standards', 'general'
] as const;

export const specialistKnowledgeRouter = router({
  // List all specialist knowledge with optional filters
  list: protectedProcedure
    .input(z.object({
      domain: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      if (input?.search && input.search.length > 1) {
        return searchKnowledge(input.search, {
          domain: input.domain as KnowledgeDomain | undefined,
          limit: input.limit || 50,
        });
      }

      if (input?.domain) {
        return getKnowledgeByDomain(input.domain as KnowledgeDomain, input.limit || 50);
      }

      // Return all active items
      return db.select()
        .from(specialistKnowledge)
        .where(eq(specialistKnowledge.isActive, 1))
        .orderBy(desc(specialistKnowledge.updatedAt))
        .limit(input?.limit || 100);
    }),

  // Get stats
  stats: protectedProcedure
    .query(async () => {
      return getKnowledgeStats();
    }),

  // Create new knowledge item
  create: protectedProcedure
    .input(z.object({
      domain: z.enum(DOMAINS),
      category: z.string().min(1),
      title: z.string().min(1),
      content: z.string().min(1),
      keywords: z.array(z.string()).optional(),
      source: z.string().optional(),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return addKnowledge({
        ...input,
        addedBy: ctx.user.name || 'admin',
      });
    }),

  // Update existing knowledge item
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return updateKnowledge(id, updates);
    }),

  // Deactivate (soft delete) a knowledge item
  deactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return updateKnowledge(input.id, { isActive: 0 });
    }),

  // Reactivate a knowledge item
  activate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return updateKnowledge(input.id, { isActive: 1 });
    }),
});
