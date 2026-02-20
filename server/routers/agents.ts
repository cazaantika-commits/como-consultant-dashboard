import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const agentsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    const result = await db.select().from(agents).orderBy(agents.id);
    return result.map((a) => ({
      ...a,
      capabilities: a.capabilities ? JSON.parse(a.capabilities) : [],
    }));
  }),

  getByName: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(agents).where(eq(agents.name, input));
    if (result.length === 0) return null;
    const a = result[0];
    return {
      ...a,
      capabilities: a.capabilities ? JSON.parse(a.capabilities) : [],
    };
  }),

  updateStatus: publicProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "inactive", "maintenance"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(agents).set({ status: input.status }).where(eq(agents.id, input.id));
      return { success: true };
    }),

  // Get agent activity stats from agentActivityLog
  activityStats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    try {
      const result = await db.execute(
        sql`SELECT agentName, COUNT(*) as totalActions, MAX(createdAt) as lastActivity FROM agentActivityLog GROUP BY agentName`
      );
      const rows = result[0] as unknown as any[];
      return rows || [];
    } catch {
      return [];
    }
  }),

  // Chat with an agent
  chat: publicProcedure
    .input(z.object({
      agent: z.enum(["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"]),
      message: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("غير مصرح");
      
      // Import agent handlers
      const { handleAgentChat } = await import("../agentChat");
      
      const response = await handleAgentChat({
        agent: input.agent,
        message: input.message,
        userId: ctx.user.id,
        conversationHistory: input.conversationHistory
      });

      return { response };
    }),
});
