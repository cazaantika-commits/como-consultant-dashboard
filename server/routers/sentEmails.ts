import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { logSentEmail, getSentEmails, getSentEmailsCount, getSentEmailById } from "../db";
import { sendReply } from "../emailMonitor";
import { getPendingEmailDraft, clearPendingEmailDraft } from "../agentChat";

/**
 * Sent Emails Router - سجل الإيميلات المرسلة
 * يتضمن: عرض السجل، إرسال مع تأكيد، تفاصيل الإيميل
 */
export const sentEmailsRouter = router({
  // قائمة الإيميلات المرسلة
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const [emails, total] = await Promise.all([
        getSentEmails(ctx.user.id, limit, offset),
        getSentEmailsCount(ctx.user.id),
      ]);
      return { emails, total, limit, offset };
    }),

  // تفاصيل إيميل مرسل
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getSentEmailById(input.id, ctx.user.id);
    }),

  // الحصول على المسودة المعلقة (للتأكيد قبل الإرسال)
  getPendingDraft: protectedProcedure
    .query(async ({ ctx }) => {
      const draft = getPendingEmailDraft(ctx.user.id);
      if (!draft || Date.now() - draft.timestamp > 30 * 60 * 1000) {
        return null; // No draft or expired (30 minutes)
      }
      return {
        to: draft.to,
        fromName: draft.fromName,
        subject: draft.subject,
        body: draft.body,
        messageId: draft.messageId,
        uid: draft.uid,
      };
    }),

  // إرسال إيميل مع تسجيل في السجل (يُستخدم من واجهة التأكيد)
  sendWithConfirmation: protectedProcedure
    .input(z.object({
      to: z.string().email(),
      toName: z.string().optional(),
      subject: z.string(),
      body: z.string(),
      inReplyTo: z.string().optional(),
      originalEmailUid: z.number().optional(),
      cc: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let status: "sent" | "failed" = "sent";
      let errorMessage: string | undefined;

      try {
        const success = await sendReply(
          input.to,
          input.subject,
          input.body,
          input.inReplyTo,
          input.cc
        );
        if (!success) {
          status = "failed";
          errorMessage = "فشل إرسال الرد - لم يتم التأكيد من الخادم";
        }
      } catch (err: any) {
        status = "failed";
        errorMessage = err.message || "خطأ غير متوقع";
      }

      // تسجيل في السجل بغض النظر عن النتيجة
      const logId = await logSentEmail({
        userId: ctx.user.id,
        toEmail: input.to,
        toName: input.toName,
        subject: input.subject,
        body: input.body,
        inReplyTo: input.inReplyTo,
        originalEmailUid: input.originalEmailUid,
        cc: input.cc,
        status,
        errorMessage,
        sentBy: "user",
        agentName: "salwa",
      });

      // مسح المسودة المعلقة بعد الإرسال
      clearPendingEmailDraft(ctx.user.id);

      return {
        success: status === "sent",
        logId,
        errorMessage,
      };
    }),
});
