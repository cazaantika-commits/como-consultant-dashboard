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
  projectMilestones,
  projectKpis,
  financialData,
  evaluatorScores,
  committeeDecisions,
  aiAdvisoryScores,
  evaluationApprovals,
} from "../../drizzle/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";

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
        conditions.push(eq(commandCenterItems.itemStatus, input.status));
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
      if (!db) return { reports: 0, requests: 0, meeting_minutes: 0, evaluations: 0, announcements: 0, milestones_kpis: 0, unread: 0 };
      
      const [items, notifications] = await Promise.all([
        db.select().from(commandCenterItems).where(eq(commandCenterItems.itemStatus, "active")),
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
      
      // Count milestones and KPIs
      const [milestones, kpis] = await Promise.all([
        db.select().from(projectMilestones),
        db.select().from(projectKpis),
      ]);
      
      const counts: Record<string, number> = { reports: 0, requests: 0, meeting_minutes: 0, evaluations: 0, announcements: 0, milestones_kpis: milestones.length + kpis.length, unread: notifications.length };
      accessible.forEach(item => {
        if (counts[item.bubbleType] !== undefined) counts[item.bubbleType]++;
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

  deleteItem: publicProcedure
    .input(z.object({
      token: z.string(),
      itemId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const item = await db.select().from(commandCenterItems)
        .where(eq(commandCenterItems.id, input.itemId))
        .limit(1);
      
      if (item.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      
      if (item[0].createdByMemberId !== member.memberId && member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete items you created" });
      }
      
      await db.delete(commandCenterItems)
        .where(eq(commandCenterItems.id, input.itemId));
      
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
      
      // For each session, check completion status
      const sessionsWithStatus = await Promise.all(sessions.map(async (session) => {
        const myEval = await db.select().from(commandCenterEvaluations)
          .where(and(
            eq(commandCenterEvaluations.sessionId, session.sessionId),
            eq(commandCenterEvaluations.memberId, member.memberId)
          ));
        
        // Count total completed evaluations
        const allEvals = await db.select().from(commandCenterEvaluations)
          .where(and(
            eq(commandCenterEvaluations.sessionId, session.sessionId),
            eq(commandCenterEvaluations.isComplete, 1)
          ));
        
        // Get project and consultant names
        let projectName = '';
        let consultantName = '';
        if (session.projectId) {
          const proj = await db.select().from(projects).where(eq(projects.id, session.projectId));
          if (proj.length > 0) projectName = proj[0].name;
        }
        if (session.consultantId) {
          const cons = await db.select().from(consultants).where(eq(consultants.id, session.consultantId));
          if (cons.length > 0) consultantName = cons[0].name;
        }
        
        return {
          ...session,
          projectName,
          consultantName,
          myEvaluationComplete: myEval.length > 0 && myEval[0].isComplete === 1,
          completedCount: allEvals.length,
          requiredCount: 3,
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
        db.select().from(commandCenterItems).where(eq(commandCenterItems.itemStatus, "active")).orderBy(desc(commandCenterItems.createdAt)).limit(10),
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

  // ═══ Milestones & KPIs ═══

  // Get milestones for a project
  getMilestones: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      
      if (input.projectId) {
        return db.select().from(projectMilestones)
          .where(eq(projectMilestones.projectId, input.projectId))
          .orderBy(projectMilestones.sortOrder, projectMilestones.plannedStartDate);
      }
      return db.select().from(projectMilestones)
        .orderBy(projectMilestones.sortOrder, projectMilestones.plannedStartDate);
    }),

  // Get milestones summary across all projects (for bubble dashboard)
  getMilestonesSummary: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return { total: 0, completed: 0, inProgress: 0, delayed: 0, notStarted: 0, onHold: 0, projects: [] };
      
      const allMilestones = await db.select().from(projectMilestones);
      const allProjects = await db.select({ id: projects.id, name: projects.name }).from(projects);
      const projectMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]));
      
      const total = allMilestones.length;
      const completed = allMilestones.filter(m => m.status === 'completed').length;
      const inProgress = allMilestones.filter(m => m.status === 'in_progress').length;
      const delayed = allMilestones.filter(m => m.status === 'delayed').length;
      const notStarted = allMilestones.filter(m => m.status === 'not_started').length;
      const onHold = allMilestones.filter(m => m.status === 'on_hold').length;
      
      // Group by project
      const projectGroups: Record<number, { name: string; milestones: typeof allMilestones; progress: number }> = {};
      allMilestones.forEach(m => {
        if (!projectGroups[m.projectId]) {
          projectGroups[m.projectId] = { name: projectMap[m.projectId] || 'Unknown', milestones: [], progress: 0 };
        }
        projectGroups[m.projectId].milestones.push(m);
      });
      
      // Calculate average progress per project
      Object.values(projectGroups).forEach(g => {
        g.progress = g.milestones.length > 0
          ? Math.round(g.milestones.reduce((sum, m) => sum + m.progressPercent, 0) / g.milestones.length)
          : 0;
      });
      
      return {
        total,
        completed,
        inProgress,
        delayed,
        notStarted,
        onHold,
        overallProgress: total > 0 ? Math.round(allMilestones.reduce((sum, m) => sum + m.progressPercent, 0) / total) : 0,
        projects: Object.entries(projectGroups).map(([id, g]) => ({
          projectId: Number(id),
          projectName: g.name,
          milestoneCount: g.milestones.length,
          progress: g.progress,
          delayed: g.milestones.filter(m => m.status === 'delayed').length,
        })),
      };
    }),

  // Create a milestone
  createMilestone: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number(),
      title: z.string(),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['planning', 'design', 'permits', 'construction', 'handover', 'sales', 'other']).default('other'),
      plannedStartDate: z.string().optional(),
      plannedEndDate: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      assignedTo: z.string().optional(),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      
      const [inserted] = await db.insert(projectMilestones).values({
        projectId: input.projectId,
        title: input.title,
        titleAr: input.titleAr || null,
        description: input.description || null,
        category: input.category,
        plannedStartDate: input.plannedStartDate || null,
        plannedEndDate: input.plannedEndDate || null,
        priority: input.priority,
        assignedTo: input.assignedTo || null,
        sortOrder: input.sortOrder,
        createdByMemberId: member.memberId,
      });
      
      return { id: inserted.insertId, success: true };
    }),

  // Update a milestone
  updateMilestone: publicProcedure
    .input(z.object({
      token: z.string(),
      id: z.number(),
      title: z.string().optional(),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['planning', 'design', 'permits', 'construction', 'handover', 'sales', 'other']).optional(),
      plannedStartDate: z.string().optional(),
      plannedEndDate: z.string().optional(),
      actualStartDate: z.string().optional(),
      actualEndDate: z.string().optional(),
      progressPercent: z.number().min(0).max(100).optional(),
      status: z.enum(['not_started', 'in_progress', 'delayed', 'completed', 'on_hold', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      
      const { token, id, ...updates } = input;
      // Filter out undefined values
      const cleanUpdates: Record<string, any> = {};
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined) cleanUpdates[key] = val;
      });
      
      if (Object.keys(cleanUpdates).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }
      
      await db.update(projectMilestones).set(cleanUpdates).where(eq(projectMilestones.id, id));
      return { success: true };
    }),

  // Delete a milestone
  deleteMilestone: publicProcedure
    .input(z.object({ token: z.string(), id: z.number() }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(projectMilestones).where(eq(projectMilestones.id, input.id));
      return { success: true };
    }),

  // ─── KPIs ───

  // Get KPIs for a project
  getKpis: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      
      if (input.projectId) {
        return db.select().from(projectKpis)
          .where(eq(projectKpis.projectId, input.projectId))
          .orderBy(projectKpis.category, projectKpis.name);
      }
      return db.select().from(projectKpis)
        .orderBy(projectKpis.category, projectKpis.name);
    }),

  // Get KPIs summary across all projects (for bubble dashboard)
  getKpisSummary: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return { total: 0, onTrack: 0, atRisk: 0, offTrack: 0, achieved: 0, categories: {} };
      
      const allKpis = await db.select().from(projectKpis);
      
      return {
        total: allKpis.length,
        onTrack: allKpis.filter(k => k.status === 'on_track').length,
        atRisk: allKpis.filter(k => k.status === 'at_risk').length,
        offTrack: allKpis.filter(k => k.status === 'off_track').length,
        achieved: allKpis.filter(k => k.status === 'achieved').length,
        notStarted: allKpis.filter(k => k.status === 'not_started').length,
        categories: allKpis.reduce((acc, k) => {
          acc[k.category] = (acc[k.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    }),

  // Create a KPI
  createKpi: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number(),
      name: z.string(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['financial', 'timeline', 'quality', 'safety', 'sales', 'customer', 'operational']).default('operational'),
      targetValue: z.string().optional(),
      currentValue: z.string().optional(),
      unit: z.string().optional(),
      status: z.enum(['on_track', 'at_risk', 'off_track', 'achieved', 'not_started']).default('not_started'),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      
      const [inserted] = await db.insert(projectKpis).values({
        projectId: input.projectId,
        name: input.name,
        nameAr: input.nameAr || null,
        description: input.description || null,
        category: input.category,
        targetValue: input.targetValue || null,
        currentValue: input.currentValue || null,
        unit: input.unit || null,
        status: input.status,
        createdByMemberId: member.memberId,
      });
      
      return { id: inserted.insertId, success: true };
    }),

  // Update a KPI
  updateKpi: publicProcedure
    .input(z.object({
      token: z.string(),
      id: z.number(),
      name: z.string().optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['financial', 'timeline', 'quality', 'safety', 'sales', 'customer', 'operational']).optional(),
      targetValue: z.string().optional(),
      currentValue: z.string().optional(),
      unit: z.string().optional(),
      trend: z.enum(['up', 'down', 'stable', 'na']).optional(),
      status: z.enum(['on_track', 'at_risk', 'off_track', 'achieved', 'not_started']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      
      const { token, id, ...updates } = input;
      const cleanUpdates: Record<string, any> = {};
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined) cleanUpdates[key] = val;
      });
      cleanUpdates.lastUpdatedBy = member.nameAr || member.name;
      
      if (Object.keys(cleanUpdates).length <= 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }
      
      await db.update(projectKpis).set(cleanUpdates).where(eq(projectKpis.id, id));
      return { success: true };
    }),

  // Delete a KPI
  deleteKpi: publicProcedure
    .input(z.object({ token: z.string(), id: z.number() }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(projectKpis).where(eq(projectKpis.id, input.id));
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

  // ─── Voice Transcription for Command Center ───
  transcribeVoice: publicProcedure
    .input(z.object({
      token: z.string(),
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional().default("ar"),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });

      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الملف الصوتي يتجاوز 16 ميجابايت" });
      }

      // Handle various audio formats from different browsers/devices
      const mimeClean = input.mimeType.split(";")[0].trim();
      const extMap: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mpeg": "mp3", "audio/x-m4a": "m4a", "video/webm": "webm" };
      const ext = extMap[mimeClean] || "webm";
      console.log(`[Voice] Transcribe: mime=${input.mimeType}, ext=${ext}, size=${sizeMB.toFixed(2)}MB`);
      
      const fileKey = `cc-voice/${member.memberId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const contentType = mimeClean || "audio/webm";
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, contentType);
      console.log(`[Voice] Uploaded to S3: ${audioUrl.substring(0, 80)}...`);

      const result = await transcribeAudio({
        audioUrl,
        language: input.language,
        prompt: "تحويل الكلام العربي إلى نص",
      });
      console.log(`[Voice] Whisper result:`, JSON.stringify(result).substring(0, 300));

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (result as any).error });
      }

      return { text: (result as any).text || "", language: (result as any).language || "ar", duration: (result as any).duration || 0 };
    }),

  // ─── Text-to-Speech for Command Center ───
  textToSpeech: publicProcedure
    .input(z.object({
      token: z.string(),
      text: z.string().min(1).max(4096),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OpenAI API key not configured" });

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: input.text,
          voice: "nova",
          response_format: "mp3",
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحويل النص إلى صوت" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return { audioBase64: base64, mimeType: "audio/mpeg" };
    }),

  // ═══ Project-based Evaluation for Command Center ═══
  
  getProjectsForEvaluation: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return [];
      const allProjects = await db.select().from(projects);
      const allPc = await db.select().from(projectConsultants);
      const allConsultants = await db.select().from(consultants);
      const allFinancial = await db.select().from(financialData);
      const allEvalScores = await db.select().from(evaluatorScores);
      const allDecisions = await db.select().from(committeeDecisions);
      const consultantMap = Object.fromEntries(allConsultants.map(c => [c.id, c]));
      const projectsWithConsultants = allProjects.filter(p => allPc.some(pc => pc.projectId === p.id));
      return projectsWithConsultants.map(p => {
        const pConsultants = allPc.filter(pc => pc.projectId === p.id).map(pc => consultantMap[pc.consultantId]).filter(Boolean);
        const hasFinancial = allFinancial.some(f => f.projectId === p.id);
        const projectScores = allEvalScores.filter(s => s.projectId === p.id);
        const evaluatorNames = ['sheikh_issa', 'wael', 'abdulrahman'];
        const totalCriteria = 9;
        const totalNeeded = pConsultants.length * totalCriteria;
        const evaluatorStatus = evaluatorNames.map(name => {
          const evScores = projectScores.filter(s => s.evaluatorName === name && s.score !== null);
          return { name, completed: evScores.length, total: totalNeeded, isComplete: evScores.length >= totalNeeded && totalNeeded > 0 };
        });
        const allEvaluatorsComplete = evaluatorStatus.every(e => e.isComplete);
        const anyEvaluatorStarted = evaluatorStatus.some(e => e.completed > 0);
        const decision = allDecisions.find(d => d.projectId === p.id);
        let status: 'not_started' | 'in_progress' | 'evaluation_complete' | 'decided' = 'not_started';
        if (decision?.isConfirmed === 1) status = 'decided';
        else if (allEvaluatorsComplete) status = 'evaluation_complete';
        else if (anyEvaluatorStarted || hasFinancial) status = 'in_progress';
        return { id: p.id, name: p.name, description: p.description, consultantCount: pConsultants.length, status, hasFinancial, evaluatorStatus, allEvaluatorsComplete, hasDecision: !!decision, isDecisionConfirmed: decision?.isConfirmed === 1 };
      });
    }),

  getProjectFinancialEvaluation: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return { consultants: [], project: null };
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
      if (!project) return { consultants: [], project: null };
      const pcs = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, input.projectId));
      const allConsultants = await db.select().from(consultants);
      const fins = await db.select().from(financialData).where(eq(financialData.projectId, input.projectId));
      const consultantMap = Object.fromEntries(allConsultants.map(c => [c.id, c]));
      const constructionCost = (project.bua || 0) * (project.pricePerSqft || 0);
      const consultantData = pcs.map(pc => {
        const c = consultantMap[pc.consultantId];
        const fin = fins.find(f => f.consultantId === pc.consultantId);
        let designAmount = 0, supervisionAmount = 0;
        if (fin) {
          const dVal = Number(fin.designValue) || 0;
          const sVal = Number(fin.supervisionValue) || 0;
          designAmount = fin.designType === 'pct' ? constructionCost * (dVal / 100) : dVal;
          supervisionAmount = fin.supervisionType === 'pct' ? constructionCost * (sVal / 100) : sVal;
        }
        const totalFees = Number(designAmount) + Number(supervisionAmount);
        return { id: c?.id || pc.consultantId, name: c?.name || '\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641', designType: fin?.designType || 'pct', designValue: Number(fin?.designValue) || 0, supervisionType: fin?.supervisionType || 'pct', supervisionValue: Number(fin?.supervisionValue) || 0, designAmount: Number(designAmount), supervisionAmount: Number(supervisionAmount), totalFees: Number(totalFees), proposalLink: (fin as any)?.proposalLink || null, financialScore: 0 as number };
      });
      const sortedByFees = [...consultantData].filter(c => c.totalFees > 0).sort((a, b) => a.totalFees - b.totalFees);
      const lowestFee = sortedByFees[0]?.totalFees || 1;
      consultantData.forEach(c => {
        c.financialScore = c.totalFees > 0 ? Math.round((lowestFee / c.totalFees) * 100 * 100) / 100 : 0;
      });
      return { project: { id: project.id, name: project.name, bua: project.bua, pricePerSqft: project.pricePerSqft, constructionCost }, consultants: consultantData };
    }),

  getProjectTechnicalEvaluation: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) return null;
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
      if (!project) return null;
      const pcs = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, input.projectId));
      const allConsultants = await db.select().from(consultants);
      const allScores = await db.select().from(evaluatorScores).where(eq(evaluatorScores.projectId, input.projectId));
      const consultantMap = Object.fromEntries(allConsultants.map(c => [c.id, c]));
      const evaluatorNames = ['sheikh_issa', 'wael', 'abdulrahman'];
      const totalCriteria = 9;
      const totalNeeded = pcs.length * totalCriteria;
      const myEvaluatorName = member.memberId;
      const evaluatorStatus = evaluatorNames.map(name => {
        const evScores = allScores.filter(s => s.evaluatorName === name && s.score !== null);
        return { name, nameAr: name === 'sheikh_issa' ? '\u0627\u0644\u0634\u064a\u062e \u0639\u064a\u0633\u0649' : name === 'wael' ? '\u0648\u0627\u0626\u0644' : '\u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646', completed: evScores.length, total: totalNeeded, isComplete: evScores.length >= totalNeeded && totalNeeded > 0 };
      });
      const allComplete = evaluatorStatus.every(e => e.isComplete);
      const myStatus = evaluatorStatus.find(e => e.name === myEvaluatorName);
      const myScores = allScores.filter(s => s.evaluatorName === myEvaluatorName);
      const consultantData = pcs.map(pc => {
        const c = consultantMap[pc.consultantId];
        const myConsScores = myScores.filter(s => s.consultantId === pc.consultantId);
        return { id: c?.id || pc.consultantId, name: c?.name || '\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641', myScores: myConsScores.map(s => ({ criterionId: s.criterionId, score: s.score })) };
      });
      let allEvaluatorData: any = null;
      if (allComplete) {
        allEvaluatorData = evaluatorNames.map(name => {
          const nameAr = name === 'sheikh_issa' ? '\u0627\u0644\u0634\u064a\u062e \u0639\u064a\u0633\u0649' : name === 'wael' ? '\u0648\u0627\u0626\u0644' : '\u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646';
          const evScores = allScores.filter(s => s.evaluatorName === name);
          return { evaluatorName: name, nameAr, scores: evScores.map(s => ({ consultantId: s.consultantId, criterionId: s.criterionId, score: s.score })) };
        });
      }
      // Check approval status for this evaluator
      const approvals = await db.select().from(evaluationApprovals).where(eq(evaluationApprovals.projectId, input.projectId));
      const myApproval = approvals.find(a => a.evaluatorName === myEvaluatorName);
      const isMyEvaluationApproved = myApproval?.isApproved === 1;
      const allApprovals = evaluatorNames.map(name => {
        const a = approvals.find(ap => ap.evaluatorName === name);
        return { name, isApproved: a?.isApproved === 1, approvedAt: a?.approvedAt };
      });
      return { project: { id: project.id, name: project.name }, consultants: consultantData, evaluatorStatus, allComplete, myEvaluatorName, myStatus, allEvaluatorData, isMyEvaluationApproved, allApprovals };
    }),

  // اعتماد التقييم الفني - بعد الاعتماد لا يمكن التعديل
  approveTechnicalEvaluation: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const evaluatorName = member.memberId;
      // Check if already approved
      const existing = await db.select().from(evaluationApprovals)
        .where(and(eq(evaluationApprovals.projectId, input.projectId), eq(evaluationApprovals.evaluatorName, evaluatorName)))
        .limit(1);
      if (existing.length > 0 && existing[0].isApproved === 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'التقييم معتمد بالفعل ولا يمكن تعديله' });
      }
      if (existing.length > 0) {
        await db.update(evaluationApprovals).set({ isApproved: 1, approvedAt: new Date() })
          .where(and(eq(evaluationApprovals.projectId, input.projectId), eq(evaluationApprovals.evaluatorName, evaluatorName)));
      } else {
        await db.insert(evaluationApprovals).values({ projectId: input.projectId, evaluatorName, isApproved: 1, approvedAt: new Date() });
      }
      return { success: true };
    }),

  submitTechnicalScore: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number(), consultantId: z.number(), criterionId: z.number(), score: z.number().min(0).max(100) }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const evaluatorName = member.memberId;
      // التحقق من الاعتماد - إذا معتمد لا يمكن التعديل
      const approvalCheck = await db.select().from(evaluationApprovals)
        .where(and(eq(evaluationApprovals.projectId, input.projectId), eq(evaluationApprovals.evaluatorName, evaluatorName)))
        .limit(1);
      if (approvalCheck.length > 0 && approvalCheck[0].isApproved === 1) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'التقييم معتمد ولا يمكن تعديله' });
      }
      const existing = await db.select().from(evaluatorScores)
        .where(and(eq(evaluatorScores.projectId, input.projectId), eq(evaluatorScores.consultantId, input.consultantId), eq(evaluatorScores.criterionId, input.criterionId), eq(evaluatorScores.evaluatorName, evaluatorName)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(evaluatorScores).set({ score: input.score })
          .where(and(eq(evaluatorScores.projectId, input.projectId), eq(evaluatorScores.consultantId, input.consultantId), eq(evaluatorScores.criterionId, input.criterionId), eq(evaluatorScores.evaluatorName, evaluatorName)));
      } else {
        await db.insert(evaluatorScores).values({ projectId: input.projectId, consultantId: input.consultantId, criterionId: input.criterionId, evaluatorName, score: input.score });
      }
      return { success: true };
    }),

  getComprehensiveReport: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return null;
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
      if (!project) return null;
      const pcs = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, input.projectId));
      const allConsultants = await db.select().from(consultants);
      const allScores = await db.select().from(evaluatorScores).where(eq(evaluatorScores.projectId, input.projectId));
      const fins = await db.select().from(financialData).where(eq(financialData.projectId, input.projectId));
      const consultantMap = Object.fromEntries(allConsultants.map(c => [c.id, c]));
      const evaluatorNames = ['sheikh_issa', 'wael', 'abdulrahman'];
      const totalCriteria = 9;
      const totalNeeded = pcs.length * totalCriteria;
      const allComplete = evaluatorNames.every(name => {
        const evScores = allScores.filter(s => s.evaluatorName === name && s.score !== null);
        return evScores.length >= totalNeeded && totalNeeded > 0;
      });
      if (!allComplete) return { isReady: false, project: { id: project.id, name: project.name } };
      const constructionCost = (project.bua || 0) * (project.pricePerSqft || 0);
      const CRITERIA_WEIGHTS = [{ id: 0, weight: 14.6 }, { id: 1, weight: 14.6 }, { id: 3, weight: 13.6 }, { id: 4, weight: 10.7 }, { id: 5, weight: 9.7 }, { id: 6, weight: 9.7 }, { id: 7, weight: 9.7 }, { id: 8, weight: 9.2 }, { id: 9, weight: 8.2 }];
      const results = pcs.map(pc => {
        const c = consultantMap[pc.consultantId];
        const fin = fins.find(f => f.consultantId === pc.consultantId);
        let designAmount = 0, supervisionAmount = 0;
        if (fin) {
          const dVal = Number(fin.designValue) || 0;
          const sVal = Number(fin.supervisionValue) || 0;
          designAmount = fin.designType === 'pct' ? constructionCost * (dVal / 100) : dVal;
          supervisionAmount = fin.supervisionType === 'pct' ? constructionCost * (sVal / 100) : sVal;
        }
        const totalFees = Number(designAmount) + Number(supervisionAmount);
        const consScores = allScores.filter(s => s.consultantId === pc.consultantId);
        let technicalWeighted = 0;
        CRITERIA_WEIGHTS.forEach(cw => {
          const evScoresForCriterion = evaluatorNames.map(name => {
            const s = consScores.find(s => s.evaluatorName === name && s.criterionId === cw.id);
            return s?.score || 0;
          });
          const avg = evScoresForCriterion.reduce((a, b) => a + b, 0) / evaluatorNames.length;
          technicalWeighted += (avg * cw.weight) / 100;
        });
        return { id: c?.id || pc.consultantId, name: c?.name || '\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641', totalFees, technicalScore: Math.round(technicalWeighted * 100) / 100, financialScore: 0 as number, finalScore: 0 as number, rank: 0 as number };
      });
      const feesArr = results.filter(r => r.totalFees > 0).map(r => r.totalFees);
      const lowestFee = Math.min(...feesArr) || 1;
      results.forEach(r => {
        r.financialScore = r.totalFees > 0 ? Math.round((lowestFee / r.totalFees) * 100 * 100) / 100 : 0;
        r.finalScore = Math.round((r.technicalScore * 0.2 + r.financialScore * 0.8) * 100) / 100;
      });
      results.sort((a, b) => b.finalScore - a.finalScore);
      results.forEach((r, i) => { r.rank = i + 1; });
      return { isReady: true, project: { id: project.id, name: project.name }, results };
    }),

  getProjectCommitteeDecision: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) return null;
      const [decision] = await db.select().from(committeeDecisions).where(eq(committeeDecisions.projectId, input.projectId));
      const aiScores = await db.select().from(aiAdvisoryScores).where(eq(aiAdvisoryScores.projectId, input.projectId));
      return { decision: decision || null, aiScores };
    }),

  saveCommitteeDecision: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number(), selectedConsultantId: z.number().optional(), decisionType: z.string(), decisionBasis: z.string().optional(), justification: z.string().optional(), committeeNotes: z.string().optional(), negotiationTarget: z.string().optional(), negotiationConditions: z.string().optional(), aiAnalysis: z.string().optional(), aiRecommendation: z.string().optional() }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updateData: any = { selectedConsultantId: input.selectedConsultantId || null, decisionType: input.decisionType, justification: input.justification || null, committeeNotes: input.committeeNotes || null };
      if (input.decisionBasis !== undefined) updateData.decisionBasis = input.decisionBasis;
      if (input.negotiationTarget !== undefined) updateData.negotiationTarget = input.negotiationTarget;
      if (input.negotiationConditions !== undefined) updateData.negotiationConditions = input.negotiationConditions;
      if (input.aiAnalysis !== undefined) updateData.aiAnalysis = input.aiAnalysis;
      if (input.aiRecommendation !== undefined) updateData.aiRecommendation = input.aiRecommendation;
      const [existing] = await db.select().from(committeeDecisions).where(eq(committeeDecisions.projectId, input.projectId));
      if (existing) {
        await db.update(committeeDecisions).set(updateData).where(eq(committeeDecisions.projectId, input.projectId));
      } else {
        await db.insert(committeeDecisions).values({ projectId: input.projectId, ...updateData });
      }
      return { success: true };
    }),

  confirmDecision: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      if (member.memberId !== 'sheikh_issa') throw new TRPCError({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0634\u064a\u062e \u0639\u064a\u0633\u0649 \u064a\u0645\u0643\u0646\u0647 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0642\u0631\u0627\u0631" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(committeeDecisions).set({ isConfirmed: 1, confirmedAt: new Date(), confirmedBy: '\u0627\u0644\u0634\u064a\u062e \u0639\u064a\u0633\u0649' }).where(eq(committeeDecisions.projectId, input.projectId));
      await db.insert(commandCenterNotifications).values(['abdulrahman', 'wael', 'sheikh_issa'].map(m => ({ memberId: m, title: '\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0642\u0631\u0627\u0631 \u0627\u0644\u0644\u062c\u0646\u0629', message: '\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0642\u0631\u0627\u0631 \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0627\u0633\u062a\u0634\u0627\u0631\u064a \u0644\u0644\u0645\u0634\u0631\u0648\u0639', type: 'evaluation' as const })));
      return { success: true };
    }),
});
