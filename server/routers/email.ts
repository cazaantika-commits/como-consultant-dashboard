import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { fetchRecentEmails, testConnection, sendReply } from "../emailMonitor";

/**
 * Email Router - إدارة البريد الإلكتروني
 */
export const emailRouter = router({
  // Test email connection
  testConnection: protectedProcedure.query(async () => {
    return await testConnection();
  }),

  // Get recent emails
  getRecent: protectedProcedure
    .input(z.object({ count: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      try {
        const emails = await fetchRecentEmails(input.count);
        return emails.map(e => ({
          ...e,
          attachments: e.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
        }));
      } catch (error: any) {
        throw new Error(`فشل جلب الإيميلات: ${error.message}`);
      }
    }),

  // Send a reply
  reply: protectedProcedure
    .input(z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
      inReplyTo: z.string().optional(),
      cc: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await sendReply(
        input.to,
        input.subject,
        input.body,
        input.inReplyTo,
        input.cc
      );
      return { success };
    }),
});
