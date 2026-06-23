/**
 * Activity Monitor Router - واجهة API لمراقبة نشاط الوكلاء
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getActivityLog, getAgentStats, getRecentAgentActivity } from "../activityLogger";
import { getIndexStats, searchDocuments } from "../documentIndexService";
import { getKnowledgeStats, searchKnowledge, getKnowledgeByDomain, addKnowledge } from "../knowledgeService";
import { seedKnowledgeBase } from "../seedKnowledge";

export const activityMonitorRouter = router({
  // --- Activity Log ---
  getActivityLog: protectedProcedure
    .input(z.object({
      agentName: z.string().optional(),
      actionType: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
      since: z.string().optional(), // ISO date string
    }))
    .query(async ({ input }) => {
      return getActivityLog({
        agentName: input.agentName || undefined,
        actionType: input.actionType as any,
        status: input.status as any,
        limit: input.limit,
        offset: input.offset,
        since: input.since ? new Date(input.since) : undefined,
      });
    }),

  getAgentStats: protectedProcedure
    .input(z.object({
      since: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const since = input?.since ? new Date(input.since) : undefined;
      return getAgentStats(since);
    }),

  getRecentActivity: protectedProcedure
    .input(z.object({
      agentName: z.string(),
      limit: z.number().optional().default(10),
    }))
    .query(async ({ input }) => {
      return getRecentAgentActivity(input.agentName, input.limit);
    }),

  // --- Document Index ---
  getIndexStats: protectedProcedure
    .query(async () => {
      return getIndexStats();
    }),

  searchDocuments: protectedProcedure
    .input(z.object({
      query: z.string(),
      projectId: z.number().optional(),
      consultantId: z.number().optional(),
      category: z.string().optional(),
      fileType: z.string().optional(),
      limit: z.number().optional().default(10),
    }))
    .query(async ({ input }) => {
      return searchDocuments(input.query, {
        projectId: input.projectId,
        consultantId: input.consultantId,
        category: input.category,
        fileType: input.fileType,
        limit: input.limit,
      });
    }),

  // --- Knowledge Base ---
  getKnowledgeStats: protectedProcedure
    .query(async () => {
      return getKnowledgeStats();
    }),

  searchKnowledge: protectedProcedure
    .input(z.object({
      query: z.string(),
      domain: z.string().optional(),
      limit: z.number().optional().default(5),
    }))
    .query(async ({ input }) => {
      return searchKnowledge(input.query, {
        domain: input.domain as any,
        limit: input.limit,
      });
    }),

  getKnowledgeByDomain: protectedProcedure
    .input(z.object({
      domain: z.string(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return getKnowledgeByDomain(input.domain as any, input.limit);
    }),

  seedKnowledge: protectedProcedure
    .mutation(async () => {
      return seedKnowledgeBase();
    }),

  addKnowledge: protectedProcedure
    .input(z.object({
      domain: z.string(),
      category: z.string(),
      title: z.string(),
      content: z.string(),
      keywords: z.array(z.string()).optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return addKnowledge({
        domain: input.domain as any,
        category: input.category,
        title: input.title,
        content: input.content,
        keywords: input.keywords,
        source: input.source,
        addedBy: 'admin',
      });
    }),
});
