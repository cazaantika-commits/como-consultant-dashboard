import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents, chatHistory } from "../../drizzle/schema";
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

  // Get chat history for an agent
  getChatHistory: publicProcedure
    .input(z.object({
      agent: z.enum(["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"]),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      const history = await db.select().from(chatHistory)
        .where(sql`${chatHistory.userId} = ${ctx.user.id} AND ${chatHistory.agent} = ${input.agent}`)
        .orderBy(chatHistory.createdAt)
        .limit(input.limit);
      return history;
    }),

  // Clear chat history for an agent
  clearChatHistory: publicProcedure
    .input(z.object({
      agent: z.enum(["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"])
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("غير مصرح");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(chatHistory).where(
        sql`${chatHistory.userId} = ${ctx.user.id} AND ${chatHistory.agent} = ${input.agent}`
      );
      return { success: true };
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
      
      const db = await getDb();
      
      // Load conversation history from DB if not provided
      let conversationHistory = input.conversationHistory;
      if (!conversationHistory && db) {
        const dbHistory = await db.select().from(chatHistory)
          .where(sql`${chatHistory.userId} = ${ctx.user.id} AND ${chatHistory.agent} = ${input.agent}`)
          .orderBy(chatHistory.createdAt)
          .limit(30);
        conversationHistory = dbHistory.map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content
        }));
      }

      // Import agent handlers
      const { handleAgentChat } = await import("../agentChat");
      
      const result = await handleAgentChat({
        agent: input.agent,
        message: input.message,
        userId: ctx.user.id,
        conversationHistory
      });

      // Save both user message and agent response to DB
      if (db) {
        try {
          await db.insert(chatHistory).values([
            { userId: ctx.user.id, agent: input.agent, role: "user", content: input.message },
            { userId: ctx.user.id, agent: input.agent, role: "assistant", content: result.text }
          ]);
        } catch (err) {
          console.error("[ChatHistory] Failed to save:", err);
        }
      }

      return { response: result.text, model: result.model };
    }),
});
