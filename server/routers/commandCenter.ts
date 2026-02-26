import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  commandCenterMembers,
  commandCenterItems,
  commandCenterResponses,
  commandCenterEvaluations,
  evaluationSessions,
  commandCenterNotifications,
  commandCenterChat,
  projects,
  consultants,
  projectConsultants,
} from "../../drizzle/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { invokeLLM } from "../_core/llm";

// ─── Helper: Verify Command Center access token ───
async function verifyToken(token: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  
  const [member] = await db.select().from(commandCenterMembers)
    .where(and(eq(commandCenterMembers.accessToken, token), eq(commandCenterMembers.isActive, 1)));
  
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز الدخول غير صالح" });
  
  // Update last access
  await db.update(commandCenterMembers)
    .set({ lastAccessAt: new Date() })
    .where(eq(commandCenterMembers.id, member.id));
  
  return member;
}

// ─── Helper: Generate secure token ───
function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export const commandCenterRouter = router({
  // ═══ Authentication ═══
  
  // Verify access token and get member info
  verifyAccess: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      return {
        id: member.id,
        name: member.name,
        nameAr: member.nameAr,
        role: member.role,
        memberId: member.memberId,
        greeting: member.greeting,
        avatarUrl: member.avatarUrl,
      };
    }),

  // Admin: Initialize the 3 members (run once)
  initializeMembers: publicProcedure
    .input(z.object({ adminSecret: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only admin can initialize
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check if already initialized
      const existing = await db.select().from(commandCenterMembers);
      if (existing.length > 0) {
        return { 
          success: true, 
          message: "Members already initialized",
          members: existing.map(m => ({ 
            name: m.name, 
            memberId: m.memberId, 
            token: m.accessToken,
            role: m.role 
          }))
        };
      }
      
      const members = [
        {
          name: "Abdalrahman",
          nameAr: "عبدالرحمن",
          role: "admin" as const,
          memberId: "abdulrahman",
          accessToken: generateToken(),
          greeting: "مرحباً عبدالرحمن، مركز القيادة جاهز لخدمتك",
        },
        {
          name: "Wael",
          nameAr: "وائل",
          role: "executive" as const,
          memberId: "wael",
          accessToken: generateToken(),
          greeting: "مرحباً وائل، أهلاً بك في مركز القيادة",
        },
        {
          name: "Sheikh Issa",
          nameAr: "الشيخ عيسى",
          role: "executive" as const,
          memberId: "sheikh_issa",
          accessToken: generateToken(),
          greeting: "مرحباً شيخ عيسى، أهلاً بك في مركز القيادة",
        },
      ];
      
      await db.insert(commandCenterMembers).values(members);
      
      return {
        success: true,
        message: "Members initialized successfully",
        members: members.map(m => ({ 
          name: m.name, 
          memberId: m.memberId, 
          token: m.accessToken,
          role: m.role 
        })),
      };
    }),

  // Admin: List all members with tokens
  listMembers: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    return db.select().from(commandCenterMembers).orderBy(commandCenterMembers.id);
  }),

  // Admin: Regenerate token for a member
  regenerateToken: publicProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const newToken = generateToken();
      await db.update(commandCenterMembers)
        .set({ accessToken: newToken })
        .where(eq(commandCenterMembers.memberId, input.memberId));
      
      return { token: newToken };
    }),

  // ═══ Smart Bubble Items ═══
  
  // Get items for a specific bubble type (filtered by member access)
  getItems: publicProcedure
    .input(z.object({
      token: z.string(),
      bubbleType: z.enum(["reports", "requests", "meeting_minutes", "evaluations", "announcements"]).optional(),
      status: z.enum(["active", "archived", "pending_response", "resolved"]).optional(),
    }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      
      let query = db.select().from(commandCenterItems)
        .orderBy(desc(commandCenterItems.createdAt));
      
      // Build conditions
      const conditions: any[] = [];
      if (input.bubbleType) {
        conditions.push(eq(commandCenterItems.bubbleType, input.bubbleType));
      }
      if (input.status) {
        conditions.push(eq(commandCenterItems.status, input.status));
      }
      
      const items = conditions.length > 0 
        ? await db.select().from(commandCenterItems).where(and(...conditions)).orderBy(desc(commandCenterItems.createdAt))
        : await db.select().from(commandCenterItems).orderBy(desc(commandCenterItems.createdAt));
      
      // Filter by target member access
      return items.filter(item => {
        if (!item.targetMemberIds) return true; // visible to all
        try {
          const targets = JSON.parse(item.targetMemberIds) as string[];
          return targets.includes(member.memberId) || item.createdByMemberId === member.memberId;
        } catch {
          return true;
        }
      });
    }),

  // Get bubble counts for dashboard
  getBubbleCounts: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return { reports: 0, requests: 0, meeting_minutes: 0, evaluations: 0, announcements: 0, unread: 0 };
      
      const [items, notifications] = await Promise.all([
        db.select().from(commandCenterItems).where(eq(commandCenterItems.status, "active")),
        db.select().from(commandCenterNotifications)
          .where(and(eq(commandCenterNotifications.memberId, member.memberId), eq(commandCenterNotifications.isRead, 0))),
      ]);
      
      // Filter by member access
      const accessible = items.filter(item => {
        if (!item.targetMemberIds) return true;
        try {
          const targets = JSON.parse(item.targetMemberIds) as string[];
          return targets.includes(member.memberId) || item.createdByMemberId === member.memberId;
        } catch { return true; }
      });
      
      const counts = { reports: 0, requests: 0, meeting_minutes: 0, evaluations: 0, announcements: 0, unread: notifications.length };
      accessible.forEach(item => {
        counts[item.bubbleType as keyof typeof counts]++;
      });
      
      return counts;
    }),

  // Admin: Create a new item in a bubble
  createItem: publicProcedure
    .input(z.object({
      token: z.string(),
      bubbleType: z.enum(["reports", "requests", "meeting_minutes", "evaluations", "announcements"]),
      title: z.string(),
      content: z.string().optional(),
      summary: z.string().optional(),
      priority: z.enum(["normal", "important", "urgent"]).default("normal"),
      targetMemberIds: z.array(z.string()).optional(), // null = all
      requiresResponse: z.boolean().default(false),
      responseDeadline: z.string().optional(), // ISO date
      projectId: z.number().optional(),
      consultantId: z.number().optional(),
      attachments: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })).optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const [inserted] = await db.insert(commandCenterItems).values({
        bubbleType: input.bubbleType,
        title: input.title,
        content: input.content || null,
        summary: input.summary || null,
        priority: input.priority,
        status: "active",
        createdByMemberId: member.memberId,
        targetMemberIds: input.targetMemberIds ? JSON.stringify(input.targetMemberIds) : null,
        requiresResponse: input.requiresResponse ? 1 : 0,
        responseDeadline: input.responseDeadline ? new Date(input.responseDeadline) : null,
        projectId: input.projectId || null,
        consultantId: input.consultantId || null,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
      });
      
      // Notify target members
      const targets = input.targetMemberIds || ["abdulrahman", "wael", "sheikh_issa"];
      const notifyTargets = targets.filter(t => t !== member.memberId);
      
      if (notifyTargets.length > 0) {
        await db.insert(commandCenterNotifications).values(
          notifyTargets.map(t => ({
            memberId: t,
            title: input.title,
            message: input.summary || `عنصر جديد في ${input.bubbleType === "reports" ? "التقارير" : input.bubbleType === "requests" ? "الطلبات" : input.bubbleType === "meeting_minutes" ? "محاضر الاجتماعات" : input.bubbleType === "evaluations" ? "التقييمات" : "الإعلانات"}`,
            type: input.priority === "urgent" ? "urgent" as const : "new_item" as const,
            relatedItemId: null,
          }))
        );
      }
      
      return { success: true, id: inserted.insertId };
    }),

  // Respond to an item
  respondToItem: publicProcedure
    .input(z.object({
      token: z.string(),
      itemId: z.number(),
      responseText: z.string(),
      responseType: z.enum(["approval", "rejection", "comment", "question"]).default("comment"),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      await db.insert(commandCenterResponses).values({
        itemId: input.itemId,
        memberId: member.memberId,
        responseText: input.responseText,
        responseType: input.responseType,
      });
      
      // Get the item to notify the creator
      const [item] = await db.select().from(commandCenterItems).where(eq(commandCenterItems.id, input.itemId));
      if (item && item.createdByMemberId !== member.memberId) {
        await db.insert(commandCenterNotifications).values({
          memberId: item.createdByMemberId,
          title: `رد جديد من ${member.nameAr}`,
          message: input.responseText.substring(0, 200),
          type: "response",
          relatedItemId: input.itemId,
        });
      }
      
      return { success: true };
    }),

  // Get responses for an item
  getResponses: publicProcedure
    .input(z.object({ token: z.string(), itemId: z.number() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(commandCenterResponses)
        .where(eq(commandCenterResponses.itemId, input.itemId))
        .orderBy(commandCenterResponses.createdAt);
    }),

  // ═══ Notifications ═══
  
  getNotifications: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(commandCenterNotifications)
        .where(eq(commandCenterNotifications.memberId, member.memberId))
        .orderBy(desc(commandCenterNotifications.createdAt))
        .limit(50);
    }),

  markNotificationRead: publicProcedure
    .input(z.object({ token: z.string(), notificationId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(commandCenterNotifications)
        .set({ isRead: 1 })
        .where(eq(commandCenterNotifications.id, input.notificationId));
      return { success: true };
    }),

  markAllNotificationsRead: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(commandCenterNotifications)
        .set({ isRead: 1 })
        .where(eq(commandCenterNotifications.memberId, member.memberId));
      return { success: true };
    }),

  // ═══ Evaluation System (Blind) ═══
  
  // Get available evaluation sessions
  getEvaluationSessions: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      
      const sessions = await db.select().from(evaluationSessions)
        .orderBy(desc(evaluationSessions.createdAt));
      
      // For each session, check if this member has completed their evaluation
      const sessionsWithStatus = await Promise.all(sessions.map(async (session) => {
        const myEval = await db.select().from(commandCenterEvaluations)
          .where(and(
            eq(commandCenterEvaluations.sessionId, session.sessionId),
            eq(commandCenterEvaluations.memberId, member.memberId)
          ));
        
        return {
          ...session,
          myEvaluationComplete: myEval.length > 0 && myEval[0].isComplete === 1,
          canViewResults: session.isRevealed === 1,
        };
      }));
      
      return sessionsWithStatus;
    }),

  // Admin: Create evaluation session
  createEvaluationSession: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number(),
      consultantId: z.number(),
      title: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      if (member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المشرف يمكنه إنشاء جلسات التقييم" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const sessionId = `eval_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      
      await db.insert(evaluationSessions).values({
        sessionId,
        projectId: input.projectId,
        consultantId: input.consultantId,
        title: input.title,
        description: input.description || null,
        createdByMemberId: member.memberId,
      });
      
      // Notify all members
      await db.insert(commandCenterNotifications).values(
        ["abdulrahman", "wael", "sheikh_issa"].map(m => ({
          memberId: m,
          title: `جلسة تقييم جديدة: ${input.title}`,
          message: "يرجى تقييم الاستشاري بشكل مستقل",
          type: "evaluation" as const,
        }))
      );
      
      // Also create a command center item in evaluations bubble
      await db.insert(commandCenterItems).values({
        bubbleType: "evaluations",
        title: input.title,
        summary: `جلسة تقييم جديدة - يرجى التقييم بشكل مستقل`,
        priority: "important",
        status: "active",
        createdByMemberId: member.memberId,
        projectId: input.projectId,
        consultantId: input.consultantId,
      });
      
      return { success: true, sessionId };
    }),

  // Submit evaluation (blind - can't see others until all complete)
  submitEvaluation: publicProcedure
    .input(z.object({
      token: z.string(),
      sessionId: z.string(),
      scores: z.record(z.string(), z.number()), // {criterionId: score}
      totalScore: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Get session
      const [session] = await db.select().from(evaluationSessions)
        .where(eq(evaluationSessions.sessionId, input.sessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة التقييم غير موجودة" });
      
      // Check if already submitted
      const existing = await db.select().from(commandCenterEvaluations)
        .where(and(
          eq(commandCenterEvaluations.sessionId, input.sessionId),
          eq(commandCenterEvaluations.memberId, member.memberId)
        ));
      
      if (existing.length > 0 && existing[0].isComplete === 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لقد أكملت التقييم مسبقاً" });
      }
      
      // Upsert evaluation
      if (existing.length > 0) {
        await db.update(commandCenterEvaluations)
          .set({
            scoresJson: JSON.stringify(input.scores),
            totalScore: String(input.totalScore),
            notes: input.notes || null,
            isComplete: 1,
          })
          .where(eq(commandCenterEvaluations.id, existing[0].id));
      } else {
        await db.insert(commandCenterEvaluations).values({
          sessionId: input.sessionId,
          projectId: session.projectId,
          consultantId: session.consultantId,
          memberId: member.memberId,
          scoresJson: JSON.stringify(input.scores),
          totalScore: String(input.totalScore),
          notes: input.notes || null,
          isComplete: 1,
        });
      }
      
      // Check if all 3 have completed
      const allEvals = await db.select().from(commandCenterEvaluations)
        .where(and(
          eq(commandCenterEvaluations.sessionId, input.sessionId),
          eq(commandCenterEvaluations.isComplete, 1)
        ));
      
      const completedCount = allEvals.length;
      
      // Update session
      await db.update(evaluationSessions)
        .set({
          completedCount,
          isRevealed: completedCount >= session.requiredCount ? 1 : 0,
        })
        .where(eq(evaluationSessions.sessionId, input.sessionId));
      
      // If all completed, notify everyone
      if (completedCount >= session.requiredCount) {
        await db.insert(commandCenterNotifications).values(
          ["abdulrahman", "wael", "sheikh_issa"].map(m => ({
            memberId: m,
            title: `اكتملت تقييمات: ${session.title}`,
            message: "جميع الأعضاء أكملوا التقييم - النتائج متاحة الآن",
            type: "evaluation" as const,
          }))
        );
      }
      
      return { success: true, completedCount, isRevealed: completedCount >= session.requiredCount };
    }),

  // Get evaluation results (only if revealed)
  getEvaluationResults: publicProcedure
    .input(z.object({ token: z.string(), sessionId: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const [session] = await db.select().from(evaluationSessions)
        .where(eq(evaluationSessions.sessionId, input.sessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Always return own evaluation
      const myEval = await db.select().from(commandCenterEvaluations)
        .where(and(
          eq(commandCenterEvaluations.sessionId, input.sessionId),
          eq(commandCenterEvaluations.memberId, member.memberId)
        ));
      
      // If not revealed, only return own
      if (session.isRevealed !== 1) {
        return {
          session,
          myEvaluation: myEval[0] || null,
          allEvaluations: null,
          isRevealed: false,
          completedCount: session.completedCount,
        };
      }
      
      // If revealed, return all
      const allEvals = await db.select().from(commandCenterEvaluations)
        .where(eq(commandCenterEvaluations.sessionId, input.sessionId));
      
      // Get member names
      const members = await db.select().from(commandCenterMembers);
      const memberMap = Object.fromEntries(members.map(m => [m.memberId, m.nameAr]));
      
      return {
        session,
        myEvaluation: myEval[0] || null,
        allEvaluations: allEvals.map(e => ({
          ...e,
          memberName: memberMap[e.memberId] || e.memberId,
          scores: JSON.parse(e.scoresJson),
        })),
        isRevealed: true,
        completedCount: session.completedCount,
      };
    }),

  // ═══ Salwa Chat (Command Center specific) ═══
  
  chatWithSalwa: publicProcedure
    .input(z.object({
      token: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Save user message
      await db.insert(commandCenterChat).values({
        memberId: member.memberId,
        role: "member",
        content: input.message,
      });
      
      // Load recent chat history
      const history = await db.select().from(commandCenterChat)
        .where(eq(commandCenterChat.memberId, member.memberId))
        .orderBy(desc(commandCenterChat.createdAt))
        .limit(10);
      
      // Reverse to chronological order
      const chronological = history.reverse();
      
      // Get platform context
      const [projectsList, consultantsList, recentItems] = await Promise.all([
        db.select({ id: projects.id, name: projects.name }).from(projects).limit(20),
        db.select({ id: consultants.id, name: consultants.name, specialization: consultants.specialization }).from(consultants).limit(30),
        db.select().from(commandCenterItems).where(eq(commandCenterItems.status, "active")).orderBy(desc(commandCenterItems.createdAt)).limit(10),
      ]);
      
      const systemPrompt = `أنتِ سلوى، السكرتيرة التنفيذية الذكية في مركز القيادة لشركة COMO Developments.
      
دورك: قناة تواصل ذكية بين عبدالرحمن (المشرف) ووائل والشيخ عيسى (الشركاء التنفيذيون).

العضو الحالي: ${member.nameAr} (${member.role === "admin" ? "المشرف" : "شريك تنفيذي"})

مهامك:
1. إذا كان العضو هو عبدالرحمن (المشرف): تنفذين أوامره لإضافة محتوى للفقاعات، إرسال رسائل للشركاء، إنشاء جلسات تقييم
2. إذا كان العضو شريكاً تنفيذياً: تجيبين على استفساراتهم، تنقلين طلباتهم لعبدالرحمن، تساعدينهم في التقييمات
3. تقدمين معلومات عن المشاريع والاستشاريين بذكاء وسرعة

المشاريع الحالية: ${projectsList.map(p => `${p.name} (${p.id})`).join(", ") || "لا توجد مشاريع"}
الاستشاريون: ${consultantsList.map(c => `${c.name} - ${c.specialization || ""}`).join(", ") || "لا يوجد استشاريون"}

العناصر النشطة في مركز القيادة: ${recentItems.length} عنصر
${recentItems.map(i => `- [${i.bubbleType}] ${i.title}`).join("\n")}

قواعد مهمة:
- ردي بشكل رسمي ومهني يليق بمركز قيادة تنفيذي
- كوني مختصرة وواضحة
- استخدمي اللغة العربية الفصحى
- لا تستخدمي إيموجي كثيرة
- إذا طلب العضو شيئاً خارج صلاحياتك، وجهيه بأدب`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...chronological.map(m => ({
          role: (m.role === "member" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
      ];
      
      try {
        const response = await invokeLLM({ messages, max_tokens: 1024 });
        const salwaResponse = response.choices?.[0]?.message?.content || "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.";
        
        // Save Salwa's response
        await db.insert(commandCenterChat).values({
          memberId: member.memberId,
          role: "salwa",
          content: salwaResponse,
        });
        
        return { response: salwaResponse };
      } catch (err: any) {
        console.error("[CommandCenter Salwa] Error:", err);
        return { response: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى." };
      }
    }),

  // Get chat history
  getChatHistory: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(commandCenterChat)
        .where(eq(commandCenterChat.memberId, member.memberId))
        .orderBy(commandCenterChat.createdAt)
        .limit(100);
    }),

  // Clear chat history
  clearChatHistory: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(commandCenterChat).where(eq(commandCenterChat.memberId, member.memberId));
      return { success: true };
    }),

  // ═══ Data for evaluation form ═══
  
  // Get projects with consultants (for evaluation session creation)
  getProjectsWithConsultants: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      
      const allProjects = await db.select().from(projects);
      const allPc = await db.select().from(projectConsultants);
      const allConsultants = await db.select().from(consultants);
      
      const consultantMap = Object.fromEntries(allConsultants.map(c => [c.id, c]));
      
      return allProjects.map(p => ({
        id: p.id,
        name: p.name,
        consultants: allPc
          .filter(pc => pc.projectId === p.id)
          .map(pc => consultantMap[pc.consultantId])
          .filter(Boolean)
          .map(c => ({ id: c!.id, name: c!.name, specialization: c!.specialization })),
      }));
    }),
});
