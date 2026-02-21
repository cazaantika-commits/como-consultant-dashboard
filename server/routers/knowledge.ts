import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { 
  createKnowledgeItem, 
  getKnowledgeItems, 
  getKnowledgeItemById,
  searchKnowledgeBase 
} from "../db";

export const knowledgeRouter = router({
  // Create a new knowledge item
  create: protectedProcedure
    .input(z.object({
      type: z.enum(['decision', 'evaluation', 'pattern', 'insight', 'lesson']),
      title: z.string(),
      content: z.string(),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      relatedProjectId: z.number().optional(),
      relatedConsultantId: z.number().optional(),
      relatedAgentAssignmentId: z.number().optional(),
      sourceAgent: z.string().optional(),
      importance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await createKnowledgeItem({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Get all knowledge items with optional filters
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      importance: z.string().optional(),
      sourceAgent: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await getKnowledgeItems(ctx.user.id, input);
    }),

  // Get a single knowledge item by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getKnowledgeItemById(input.id, ctx.user.id);
    }),

  // Search knowledge base
  search: protectedProcedure
    .input(z.object({
      searchTerm: z.string(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await searchKnowledgeBase(ctx.user.id, input.searchTerm, input.limit);
    }),
});
