import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getUnreadNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from "../db";

/**
 * Notifications Router - إشعارات الإيميل الفورية
 */
export const notificationsRouter = router({
  // Get unread notification count (for the bell badge)
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getUnreadNotificationCount(ctx.user.id);
    return { count };
  }),

  // Get list of notifications
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const notifications = await getUnreadNotifications(ctx.user.id, input?.limit || 20);
      return notifications.map(n => ({
        id: n.id,
        emailUid: n.emailUid,
        fromEmail: n.fromEmail,
        fromName: n.fromName,
        subject: n.subject,
        preview: n.preview,
        receivedAt: n.receivedAt,
        isRead: n.isRead === 1,
        createdAt: n.createdAt,
      }));
    }),

  // Mark a single notification as read
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await markNotificationRead(input.id, ctx.user.id);
      return { success };
    }),

  // Mark all notifications as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const success = await markAllNotificationsRead(ctx.user.id);
    return { success };
  }),

  // Dismiss a notification
  dismiss: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await dismissNotification(input.id, ctx.user.id);
      return { success };
    }),
});
