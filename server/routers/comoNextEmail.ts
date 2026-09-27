import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { eq } from "drizzle-orm";
import { comoNextEmailSyncSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  analyzeEmailCommand,
  createReplyDraftFromEmailCommand,
  dismissEmailCommand,
  getEmailMessage,
  linkEmailToWorkFileCommand,
  listEmailInbox,
  listEmailLinkingOptions,
  syncReadonlyInboxCommand,
} from "../services/comoNextEmailInbox";

function assertOwner(role?: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "صندوق بريد عبد الرحمن متاح للمالك فقط" });
}

const statusSchema = z.enum(["unmatched", "suggested", "linked", "dismissed"]);

export const comoNextEmailRouter = router({
  scheduledStatus: protectedProcedure.query(async ({ ctx }) => {
    assertOwner(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    const [settings] = await db.select({
      isEnabled: comoNextEmailSyncSettings.isEnabled,
      cronExpression: comoNextEmailSyncSettings.cronExpression,
      lastRunAt: comoNextEmailSyncSettings.lastRunAt,
      lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
      lastStatus: comoNextEmailSyncSettings.lastStatus,
      lastScanned: comoNextEmailSyncSettings.lastScanned,
      lastImported: comoNextEmailSyncSettings.lastImported,
      lastDuplicates: comoNextEmailSyncSettings.lastDuplicates,
    }).from(comoNextEmailSyncSettings).where(eq(comoNextEmailSyncSettings.userId, ctx.user.id)).limit(1);
    return settings || { isEnabled: 0, cronExpression: "0 0 * * * *", lastRunAt: null, lastSuccessAt: null, lastStatus: "never" as const, lastScanned: 0, lastImported: 0, lastDuplicates: 0 };
  }),

  list: protectedProcedure
    .input(z.object({ status: statusSchema.optional() }).optional())
    .query(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return listEmailInbox(ctx.user.id, input?.status);
    }),

  get: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive() }))
    .query(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return getEmailMessage(input.emailId, ctx.user.id);
    }),

  linkingOptions: protectedProcedure.query(({ ctx }) => {
    assertOwner(ctx.user.role);
    return listEmailLinkingOptions(ctx.user.id);
  }),

  syncReadonly: protectedProcedure
    .input(z.object({ hours: z.number().int().min(1).max(8760).default(168), maxMessages: z.number().int().min(1).max(250).default(100) }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return syncReadonlyInboxCommand({ userId: ctx.user.id, ...input });
    }),

  linkToWorkFile: protectedProcedure
    .input(z.object({
      emailId: z.number().int().positive(),
      projectId: z.number().int().positive(),
      workFileId: z.number().int().positive(),
      projectPartyId: z.number().int().positive().optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return linkEmailToWorkFileCommand({ userId: ctx.user.id, ...input });
    }),

  analyze: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive(), requestKey: z.string().trim().min(8).max(128) }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return analyzeEmailCommand({ userId: ctx.user.id, ...input });
    }),

  createReplyDraft: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive(), body: z.string().trim().min(3).max(100_000), ccText: z.string().trim().max(5000).optional().nullable() }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return createReplyDraftFromEmailCommand({ userId: ctx.user.id, ...input });
    }),

  dismiss: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return dismissEmailCommand({ userId: ctx.user.id, ...input });
    }),
});
