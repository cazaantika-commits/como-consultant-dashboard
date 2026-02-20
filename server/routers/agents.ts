import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents, chatHistory, modelUsageLog, agentAssignments } from "../../drizzle/schema";
import { getAgentAssignments, getAssignmentStats } from "../agentTools";
import { eq, desc, sql } from "drizzle-orm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

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

  // Voice transcription - upload audio and get text
  transcribeVoice: publicProcedure
    .input(z.object({
      audioBase64: z.string(), // Base64 encoded audio
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional().default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Decode base64 to buffer
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      
      // Check size (16MB limit)
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الملف الصوتي يتجاوز 16 ميجابايت" });
      }

      // Upload to S3
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp4") ? "m4a" : "wav";
      const fileKey = `voice/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

      // Transcribe
      const result = await transcribeAudio({
        audioUrl,
        language: input.language,
        prompt: "تحويل الكلام العربي إلى نص",
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return { text: result.text, language: result.language, duration: result.duration };
    }),

  // Text-to-Speech - convert agent response to audio
  textToSpeech: publicProcedure
    .input(z.object({
      text: z.string().min(1).max(4096),
      agent: z.enum(["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OpenAI API key not configured" });

      // Unique voice per agent - OpenAI TTS voices:
      // alloy (neutral), ash (warm male), coral (warm female), echo (male), 
      // fable (British), nova (female energetic), onyx (deep male), sage (calm), shimmer (soft female)
      const AGENT_VOICES: Record<string, string> = {
        salwa: "nova",      // Female, energetic, warm - perfect for coordinator
        farouq: "onyx",     // Deep male, authoritative - perfect for senior legal expert
        khazen: "ash",      // Warm male - good for organized young tech guy
        buraq: "echo",      // Male, clear - good for timeline monitor
        khaled: "sage",     // Calm, precise - perfect for quality auditor
        alina: "shimmer",   // Soft female - good for financial director
        baz: "fable",       // Expressive - good for strategic advisor
        joelle: "coral",    // Warm female - perfect for market analyst
      };

      const voice = AGENT_VOICES[input.agent] || "alloy";

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: input.text,
          voice: voice,
          response_format: "mp3",
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[TTS] Error:", response.status, errorText);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحويل النص إلى صوت" });
      }

      // Convert audio to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return { audioBase64: base64, mimeType: "audio/mpeg", voice };
    }),

  // Model usage statistics
  modelUsageStats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { byModel: [], byAgent: [], recentActivity: [], totals: { totalCalls: 0, avgResponseTime: 0, successRate: 0 } };
    const db = await getDb();
    if (!db) return { byModel: [], byAgent: [], recentActivity: [], totals: { totalCalls: 0, avgResponseTime: 0, successRate: 0 } };

    try {
      // Stats by model
      const byModelResult = await db.execute(
        sql`SELECT model, COUNT(*) as totalCalls, AVG(responseTimeMs) as avgResponseTime, 
            SUM(CASE WHEN success = 'true' THEN 1 ELSE 0 END) as successCount,
            SUM(CASE WHEN isFallback = 'true' THEN 1 ELSE 0 END) as fallbackCount
            FROM modelUsageLog GROUP BY model ORDER BY totalCalls DESC`
      );

      // Stats by agent
      const byAgentResult = await db.execute(
        sql`SELECT agent, model, COUNT(*) as totalCalls, AVG(responseTimeMs) as avgResponseTime
            FROM modelUsageLog WHERE success = 'true' GROUP BY agent, model ORDER BY totalCalls DESC`
      );

      // Recent activity (last 24h, hourly)
      const recentResult = await db.execute(
        sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d %H:00') as hour, model, COUNT(*) as calls
            FROM modelUsageLog WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY hour, model ORDER BY hour ASC`
      );

      // Overall totals
      const totalsResult = await db.execute(
        sql`SELECT COUNT(*) as totalCalls, AVG(responseTimeMs) as avgResponseTime,
            SUM(CASE WHEN success = 'true' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as successRate
            FROM modelUsageLog`
      );

      const byModel = (byModelResult[0] as unknown as any[]) || [];
      const byAgent = (byAgentResult[0] as unknown as any[]) || [];
      const recentActivity = (recentResult[0] as unknown as any[]) || [];
      const totals = (totalsResult[0] as unknown as any[])?.[0] || { totalCalls: 0, avgResponseTime: 0, successRate: 0 };

      return { byModel, byAgent, recentActivity, totals };
    } catch (err) {
      console.error("[ModelUsage] Stats query failed:", err);
      return { byModel: [], byAgent: [], recentActivity: [], totals: { totalCalls: 0, avgResponseTime: 0, successRate: 0 } };
    }
  }),

  // ═══════════════════════════════════════════════════
  // Agent Assignments (تكليفات الوكلاء)
  // ═══════════════════════════════════════════════════

  listAssignments: publicProcedure
    .input(z.object({
      agent: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      return getAgentAssignments(input || {});
    }),

  assignmentStats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { total: 0, completed: 0, failed: 0, executing: 0, byAgent: {} };
    return getAssignmentStats();
  }),

  deleteAssignment: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(agentAssignments).where(eq(agentAssignments.id, input));
      return { success: true };
    }),
});
