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
import { createSaraIntakeProposalCommand } from "../services/comoNextIntake";

const tokenInput = z.object({ token: z.string().trim().min(1).max(256) });
const realtimeToolName = z.enum(["lookup_command_center", "lookup_executive_workspace", "capture_intake_proposal"]);
const captureProposalArguments = z.object({
  project_id: z.number().int().positive(),
  work_file_id: z.number().int().positive(),
  kind: z.enum(["action", "decision", "communication_draft", "note"]),
  title: z.string().trim().min(3).max(1000),
  content: z.string().max(100_000).nullable(),
  acceptance_criteria: z.string().max(5000).nullable(),
  owner_type: z.enum(["human", "manus", "team"]).nullable(),
  priority: z.enum(["normal", "important", "urgent"]),
  due_at: z.string().nullable(),
  channel: z.enum(["email", "whatsapp", "letter", "phone_note", "internal"]).nullable(),
  to_text: z.string().max(5000).nullable(),
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
      manusDelegationConfigured: false,
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
      if (input.toolName === "capture_intake_proposal") {
        let parsed: z.infer<typeof captureProposalArguments>;
        try { parsed = captureProposalArguments.parse(JSON.parse(input.arguments || "{}")); }
        catch { throw new TRPCError({ code: "BAD_REQUEST", message: "لم تتمكن سارة من تحديد المقترح وملف العمل بدقة" }); }
        return createSaraIntakeProposalCommand({
          memberId: member.memberId,
          sessionId: input.sessionId,
          callId: input.eventId || `sara-${Date.now()}`,
          sourceText: input.sourceText || "",
          projectId: parsed.project_id,
          workFileId: parsed.work_file_id,
          kind: parsed.kind,
          title: parsed.title,
          content: parsed.content,
          acceptanceCriteria: parsed.acceptance_criteria,
          ownerType: parsed.owner_type,
          priority: parsed.priority,
          dueAt: parsed.due_at,
          channel: parsed.channel,
          toText: parsed.to_text,
        });
      }
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
