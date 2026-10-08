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
  syncAndAnalyzeReadonlyMailboxCommand,
} from "../services/comoNextEmailInbox";
import { updateReplyDraftFromEmailCommand } from "../services/comoNextEmailOutbox";
import { runExecutiveControlLoopCommand } from "../services/comoNextExecutiveControl";

function assertOwner(role?: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "صندوق بريد عبد الرحمن متاح للمالك فقط" });
}

const statusSchema = z.enum(["unmatched", "suggested", "linked", "dismissed"]);

export const comoNextEmailRouter = router({
  scheduledStatus: protectedProcedure.query(async ({ ctx }) => {
    assertOwner(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    const settingsRows = await db.select({
      mailboxKey: comoNextEmailSyncSettings.mailboxKey,
      isEnabled: comoNextEmailSyncSettings.isEnabled,
      cronExpression: comoNextEmailSyncSettings.cronExpression,
      lastRunAt: comoNextEmailSyncSettings.lastRunAt,
      lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
      lastStatus: comoNextEmailSyncSettings.lastStatus,
      lastScanned: comoNextEmailSyncSettings.lastScanned,
      lastImported: comoNextEmailSyncSettings.lastImported,
      lastDuplicates: comoNextEmailSyncSettings.lastDuplicates,
    }).from(comoNextEmailSyncSettings).where(eq(comoNextEmailSyncSettings.userId, ctx.user.id));
    const importing = settingsRows.find(row => row.mailboxKey === "owner-primary");
    const processing = settingsRows.find(row => row.mailboxKey === "owner-primary-processing");
    const executive = settingsRows.find(row => row.mailboxKey === "owner-primary-executive");
    return {
      isEnabled: importing?.isEnabled ?? 0,
      cronExpression: importing?.cronExpression ?? "0 0 2,7,13 * * *",
      lastRunAt: importing?.lastRunAt ?? null,
      lastSuccessAt: importing?.lastSuccessAt ?? null,
      lastStatus: importing?.lastStatus ?? "never",
      lastScanned: importing?.lastScanned ?? 0,
      lastImported: importing?.lastImported ?? 0,
      lastDuplicates: importing?.lastDuplicates ?? 0,
      processingEnabled: processing?.isEnabled ?? 0,
      processingLastSuccessAt: processing?.lastSuccessAt ?? null,
      processingLastStatus: processing?.lastStatus ?? "never",
      executiveEnabled: executive?.isEnabled ?? 0,
      executiveLastSuccessAt: executive?.lastSuccessAt ?? null,
      executiveLastStatus: executive?.lastStatus ?? "never",
    };
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
      return syncAndAnalyzeReadonlyMailboxCommand({ userId: ctx.user.id, ...input, analysisLimit: 10 });
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
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.user.role);
      const result = await analyzeEmailCommand({ userId: ctx.user.id, ...input });
      const executiveControl = await runExecutiveControlLoopCommand({ userId: ctx.user.id, trigger: "email_sync", scanPending: true, maxItems: 2 });
      return { ...result, executiveControl };
    }),

  createReplyDraft: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive(), body: z.string().trim().min(3).max(100_000), ccText: z.string().trim().max(5000).optional().nullable() }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return createReplyDraftFromEmailCommand({ userId: ctx.user.id, ...input });
    }),

  updateReplyDraft: protectedProcedure
    .input(z.object({
      emailId: z.number().int().positive(),
      subject: z.string().trim().min(1).max(1000),
      body: z.string().trim().min(1).max(100_000),
      toText: z.string().trim().min(3).max(5000),
      ccText: z.string().trim().max(5000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return updateReplyDraftFromEmailCommand({ userId: ctx.user.id, ...input });
    }),

  dismiss: protectedProcedure
    .input(z.object({ emailId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      assertOwner(ctx.user.role);
      return dismissEmailCommand({ userId: ctx.user.id, ...input });
    }),
});
