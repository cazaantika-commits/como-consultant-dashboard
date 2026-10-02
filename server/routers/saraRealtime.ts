import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { commandCenterChat } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { SARA_LIVE_AVATAR_ID, createSaraLiveAvatarToken } from "../liveAvatar";
import { verifyToken } from "./commandCenter";
import {
  createSaraRealtimeClientSecret,
  lookupExecutiveWorkspace,
  SARA_REALTIME_MODEL,
  SARA_REALTIME_VOICE,
} from "../services/saraRealtime";
import { readExecutiveWorkFile } from "../services/saraWorkFileReader";
import { resolveOwnerUserIdForSara } from "../services/comoNextIntake";
import { stageExecutiveDirectiveCommand } from "../services/comoNextStagedDirectives";
import {
  completeSaraBriefing,
  getSaraBriefingStatus,
  prepareSaraBriefing,
} from "../services/saraBriefings";

const tokenInput = z.object({ token: z.string().trim().min(1).max(256) });
const realtimeToolName = z.enum(["lookup_executive_workspace", "read_executive_work_file", "direct_manus_in_work_file"]);
const briefingMode = z.enum(["auto", "full", "today", "changes"]);
const executiveDirectiveArguments = z.object({
  work_file_id: z.number().int().positive(),
  directive_text: z.string().trim().min(3).max(10_000),
  action_id: z.number().int().positive().nullable(),
  current_decision_id: z.number().int().positive().nullable(),
});

function getSaraOpenAiKey() {
  return process.env.COMO_OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY || "";
}

function publicFailure(reason: unknown, fallback: string) {
  if (reason instanceof TRPCError) throw reason;
  const message = reason instanceof Error ? reason.message : fallback;
  throw new TRPCError({ code: "BAD_GATEWAY", message });
}

export const saraRealtimeRouter = router({
  status: publicProcedure.input(tokenInput).query(async ({ input }) => {
    const member = await verifyToken(input.token);
    return {
      identity: "Sara" as const,
      member: { memberId: member.memberId, nameAr: member.nameAr, role: member.role },
      realtimeConfigured: Boolean(getSaraOpenAiKey().trim()),
      liveAvatarConfigured: Boolean(ENV.liveAvatarApiKey),
      avatarId: SARA_LIVE_AVATAR_ID,
      model: SARA_REALTIME_MODEL,
      voice: SARA_REALTIME_VOICE,
      externalActionsEnabled: false,
      manusDelegationConfigured: true,
    };
  }),

  createSession: publicProcedure.input(tokenInput).mutation(async ({ input }) => {
    const member = await verifyToken(input.token);
    try {
      return await createSaraRealtimeClientSecret(getSaraOpenAiKey(), {
        memberId: member.memberId,
        nameAr: member.nameAr,
        role: member.role,
      });
    } catch (reason) {
      publicFailure(reason, "تعذر تجهيز جلسة سارة الصوتية");
    }
  }),

  briefingStatus: publicProcedure.input(tokenInput).query(async ({ input }) => {
    const member = await verifyToken(input.token);
    return getSaraBriefingStatus(member.memberId);
  }),

  prepareBriefing: publicProcedure
    .input(tokenInput.extend({ mode: briefingMode, sessionId: z.string().max(200).optional().nullable() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      return prepareSaraBriefing({ memberId: member.memberId, mode: input.mode, sessionId: input.sessionId });
    }),

  completeBriefing: publicProcedure
    .input(tokenInput.extend({ deliveryId: z.number().int().positive(), completed: z.boolean() }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      return completeSaraBriefing({ memberId: member.memberId, deliveryId: input.deliveryId, completed: input.completed });
    }),

  runTool: publicProcedure
    .input(tokenInput.extend({
      toolName: realtimeToolName,
      arguments: z.string().max(12_000),
      sourceText: z.string().max(10_000).optional(),
      sessionId: z.string().max(200).optional().nullable(),
      eventId: z.string().max(200).optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const normalizedMember = { memberId: member.memberId, nameAr: member.nameAr, role: member.role };
      if (input.toolName === "direct_manus_in_work_file") {
        let parsed: z.infer<typeof executiveDirectiveArguments>;
        try { parsed = executiveDirectiveArguments.parse(JSON.parse(input.arguments || "{}")); }
        catch { throw new TRPCError({ code: "BAD_REQUEST", message: "لم تتمكن سارة من تحديد التوجيه وملف الموضوع بدقة" }); }
        const userId = await resolveOwnerUserIdForSara(member.memberId);
        const stageKey = `sara:${input.sessionId || "session"}:${input.eventId || `${parsed.work_file_id}:${parsed.directive_text}`}`.slice(0, 128);
        const result = await stageExecutiveDirectiveCommand({
          userId,
          workFileId: parsed.work_file_id,
          actionId: parsed.action_id,
          currentDecisionId: parsed.current_decision_id,
          directiveText: parsed.directive_text,
          source: "sara",
          sourceMemberId: member.memberId,
          stageKey,
        });
        return {
          staged: true as const,
          executionStarted: false as const,
          directiveId: result.directive.id,
          workFileId: parsed.work_file_id,
          status: result.directive.status,
          message: "حُفظ التوجيه داخل ملف الموضوع للمراجعة. لن يبدأ Manus ولن تُنشأ مسودة بريد قبل ضغط المالك «سلّم التوجيه إلى Manus»." as const,
        };
      }
      if (input.toolName === "lookup_executive_workspace") {
        return lookupExecutiveWorkspace(normalizedMember, input.arguments);
      }
      if (input.toolName === "read_executive_work_file") {
        return readExecutiveWorkFile(normalizedMember, input.arguments);
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "مصدر سارة التشغيلي هو COMO Next فقط" });
    }),

  recordTranscript: publicProcedure
    .input(tokenInput.extend({
      role: z.enum(["member", "sara"]),
      content: z.string().trim().min(1).max(10_000),
      sessionId: z.string().max(200).nullable().optional(),
      eventId: z.string().max(200),
    }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const metadata = JSON.stringify({ source: "openai_realtime", sessionId: input.sessionId || null, eventId: input.eventId });
      const [existing] = await db.select({ id: commandCenterChat.id }).from(commandCenterChat)
        .where(and(eq(commandCenterChat.memberId, member.memberId), eq(commandCenterChat.metadata, metadata)))
        .limit(1);
      if (existing) return { success: true as const, duplicate: true as const, id: existing.id };
      const result = await db.insert(commandCenterChat).values({
        memberId: member.memberId,
        chatRole: input.role === "sara" ? "salwa" : "member",
        content: input.content,
        metadata,
      });
      return { success: true as const, duplicate: false as const, id: Number(result[0].insertId) };
    }),

  createAvatarToken: publicProcedure
    .input(tokenInput.extend({ isSandbox: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      await verifyToken(input.token);
      try {
        return await createSaraLiveAvatarToken(ENV.liveAvatarApiKey, {
          isSandbox: input.isSandbox,
          avatarId: SARA_LIVE_AVATAR_ID,
        });
      } catch (reason) {
        publicFailure(reason, "تعذر تجهيز صورة سارة الحية");
      }
    }),
});
