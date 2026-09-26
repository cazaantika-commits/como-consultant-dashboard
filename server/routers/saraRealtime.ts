import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { commandCenterChat } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { SARA_LIVE_AVATAR_ID, createSaraLiveAvatarToken } from "../liveAvatar";
import { loadLaylaCommandCenterSnapshot, runLaylaCommandCenterTool } from "../laylaCommandCenterContext";
import { verifyToken } from "./commandCenter";
import {
  createSaraRealtimeClientSecret,
  lookupExecutiveWorkspace,
  SARA_REALTIME_MODEL,
  SARA_REALTIME_VOICE,
} from "../services/saraRealtime";

const tokenInput = z.object({ token: z.string().trim().min(1).max(256) });
const realtimeToolName = z.enum(["lookup_command_center", "lookup_executive_workspace"]);

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
      realtimeConfigured: Boolean(process.env.OPENAI_API_KEY),
      liveAvatarConfigured: Boolean(ENV.liveAvatarApiKey),
      avatarId: SARA_LIVE_AVATAR_ID,
      model: SARA_REALTIME_MODEL,
      voice: SARA_REALTIME_VOICE,
      externalActionsEnabled: false,
      manusDelegationConfigured: false,
    };
  }),

  createSession: publicProcedure.input(tokenInput).mutation(async ({ input }) => {
    const member = await verifyToken(input.token);
    try {
      return await createSaraRealtimeClientSecret(process.env.OPENAI_API_KEY || "", {
        memberId: member.memberId,
        nameAr: member.nameAr,
        role: member.role,
      });
    } catch (reason) {
      publicFailure(reason, "تعذر تجهيز جلسة سارة الصوتية");
    }
  }),

  runTool: publicProcedure
    .input(tokenInput.extend({ toolName: realtimeToolName, arguments: z.string().max(4_000) }))
    .mutation(async ({ input }) => {
      const member = await verifyToken(input.token);
      const normalizedMember = { memberId: member.memberId, nameAr: member.nameAr, role: member.role };
      if (input.toolName === "lookup_executive_workspace") {
        return lookupExecutiveWorkspace(normalizedMember, input.arguments);
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const snapshot = await loadLaylaCommandCenterSnapshot(db, normalizedMember, schema);
      return runLaylaCommandCenterTool(snapshot, input.arguments);
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
