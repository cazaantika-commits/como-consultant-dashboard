import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { taskExecutionLogs, tasks, meetings } from "../../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const executionDashboardRouter = router({
  // Get execution overview stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allLogs = await db.select().from(taskExecutionLogs).orderBy(desc(taskExecutionLogs.createdAt));

    const total = allLogs.length;
    const completed = allLogs.filter(l => l.status === "completed").length;
    const partial = allLogs.filter(l => l.status === "partial").length;
    const failed = allLogs.filter(l => l.status === "failed").length;
    const executing = allLogs.filter(l => l.status === "executing" || l.status === "planning" || l.status === "verifying").length;

    // Tool usage stats
    let totalToolCalls = 0;
    let totalWriteTools = 0;
    const toolUsageMap: Record<string, number> = {};
    
    for (const log of allLogs) {
      totalToolCalls += log.toolCallCount;
      totalWriteTools += log.writeToolCount;
      if (log.toolsUsedJson) {
        try {
          const tools = JSON.parse(log.toolsUsedJson) as string[];
          for (const t of tools) {
            toolUsageMap[t] = (toolUsageMap[t] || 0) + 1;
          }
        } catch {}
      }
    }

    // Agent performance
    const agentStats: Record<string, { total: number; completed: number; failed: number; avgDuration: number }> = {};
    for (const log of allLogs) {
      if (!agentStats[log.agent]) {
        agentStats[log.agent] = { total: 0, completed: 0, failed: 0, avgDuration: 0 };
      }
      agentStats[log.agent].total++;
      if (log.status === "completed") agentStats[log.agent].completed++;
      if (log.status === "failed") agentStats[log.agent].failed++;
      if (log.durationMs) {
        agentStats[log.agent].avgDuration = 
          (agentStats[log.agent].avgDuration * (agentStats[log.agent].total - 1) + log.durationMs) / agentStats[log.agent].total;
      }
    }

    // Average duration
    const durationsMs = allLogs.filter(l => l.durationMs && l.durationMs > 0).map(l => l.durationMs!);
    const avgDurationMs = durationsMs.length > 0 ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length) : 0;

    // Success rate
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Verification rate
    const verifiedCount = allLogs.filter(l => l.verified === 1).length;
    const verificationRate = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

    return {
      total,
      completed,
      partial,
      failed,
      executing,
      successRate,
      verificationRate,
      totalToolCalls,
      totalWriteTools,
      avgDurationMs,
      topTools: Object.entries(toolUsageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      agentStats: Object.entries(agentStats).map(([agent, stats]) => ({
        agent,
        ...stats,
        successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      })),
    };
  }),

  // Get recent execution logs
  getRecentLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(["all", "completed", "partial", "failed", "executing"]).default("all"),
      agent: z.string().optional(),
      meetingId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const limit = input?.limit || 20;
      const conditions = [];

      if (input?.status && input.status !== "all") {
        conditions.push(eq(taskExecutionLogs.status, input.status as any));
      }
      if (input?.agent) {
        conditions.push(eq(taskExecutionLogs.agent, input.agent));
      }
      if (input?.meetingId) {
        conditions.push(eq(taskExecutionLogs.meetingId, input.meetingId));
      }

      const logs = conditions.length > 0
        ? await db.select().from(taskExecutionLogs)
            .where(and(...conditions))
            .orderBy(desc(taskExecutionLogs.createdAt))
            .limit(limit)
        : await db.select().from(taskExecutionLogs)
            .orderBy(desc(taskExecutionLogs.createdAt))
            .limit(limit);

      return logs.map(log => ({
        ...log,
        actionPlan: log.actionPlanJson ? JSON.parse(log.actionPlanJson) : null,
        toolsUsed: log.toolsUsedJson ? JSON.parse(log.toolsUsedJson) : [],
        stepResults: log.stepResultsJson ? JSON.parse(log.stepResultsJson) : [],
        dataChanges: log.dataChangesJson ? JSON.parse(log.dataChangesJson) : [],
      }));
    }),

  // Get single execution log detail
  getLogDetail: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: logId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [log] = await db.select().from(taskExecutionLogs).where(eq(taskExecutionLogs.id, logId));
      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      // Get related task and meeting info
      let task = null;
      let meeting = null;
      if (log.taskId) {
        const [t] = await db.select().from(tasks).where(eq(tasks.id, log.taskId));
        task = t || null;
      }
      if (log.meetingId) {
        const [m] = await db.select().from(meetings).where(eq(meetings.id, log.meetingId));
        meeting = m ? { id: m.id, title: m.title } : null;
      }

      return {
        ...log,
        actionPlan: log.actionPlanJson ? JSON.parse(log.actionPlanJson) : null,
        toolsUsed: log.toolsUsedJson ? JSON.parse(log.toolsUsedJson) : [],
        stepResults: log.stepResultsJson ? JSON.parse(log.stepResultsJson) : [],
        dataChanges: log.dataChangesJson ? JSON.parse(log.dataChangesJson) : [],
        task,
        meeting,
      };
    }),
});
