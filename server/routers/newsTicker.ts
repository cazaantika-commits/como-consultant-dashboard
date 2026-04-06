import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsTicker } from "../../drizzle/schema";
import { eq, asc, desc, sql } from "drizzle-orm";

export const newsTickerRouter = router({
  // Get all active news items (for homepage ticker)
  getActive: publicProcedure.query(async () => {
    const db = await getDb();
    const items = await db
      .select()
      .from(newsTicker)
      .where(eq(newsTicker.isActive, 1))
      .orderBy(asc(newsTicker.sortOrder));
    return items;
  }),

  // Get live events from Command Center (messages, payment requests, general requests)
  getLiveEvents: publicProcedure.query(async () => {
    const db = await getDb();
    const events: Array<{ id: string; title: string; color: string; createdAt: string }> = [];

    try {
      // 1. Recent internal messages (last 5)
      const msgResult = await db.execute(
        sql`SELECT id, subject, from_member, to_member, priority, created_at
            FROM internal_messages
            ORDER BY created_at DESC
            LIMIT 5`
      );
      const msgs = (msgResult[0] as unknown as any[]) || [];
      const memberNames: Record<string, string> = {
        abdulrahman: "عبدالرحمن",
        wael: "وائل",
        sheikh_issa: "الشيخ عيسى",
      };
      for (const m of msgs) {
        const from = memberNames[m.from_member] || m.from_member;
        const to = memberNames[m.to_member] || m.to_member;
        events.push({
          id: `msg-${m.id}`,
          title: `💬 رسالة من ${from} إلى ${to}: ${m.subject}`,
          color: m.priority === "urgent" ? "#ef4444" : m.priority === "important" ? "#f59e0b" : "#6366f1",
          createdAt: m.created_at,
        });
      }
    } catch { /* table may not exist */ }

    try {
      // 2. Recent payment requests (last 5)
      const payResult = await db.execute(
        sql`SELECT pr.id, pr.request_number, pr.description, pr.amount, pr.currency, pr.status, pr.created_at,
                   bp.name as partner_name
            FROM payment_requests pr
            LEFT JOIN business_partners bp ON bp.id = pr.partner_id
            WHERE pr.is_archived = 0
            ORDER BY pr.created_at DESC
            LIMIT 5`
      );
      const pays = (payResult[0] as unknown as any[]) || [];
      const statusLabel: Record<string, string> = {
        new: "جديد", pending_wael: "بانتظار وائل", pending_sheikh: "بانتظار الشيخ عيسى",
        approved: "تمت الموافقة", rejected: "مرفوض", needs_revision: "يحتاج مراجعة", disbursed: "تم الصرف",
      };
      const statusColor: Record<string, string> = {
        new: "#3b82f6", pending_wael: "#f59e0b", pending_sheikh: "#f59e0b",
        approved: "#10b981", rejected: "#ef4444", needs_revision: "#f97316", disbursed: "#8b5cf6",
      };
      for (const p of pays) {
        const amount = parseFloat(p.amount || 0).toLocaleString("ar-AE");
        events.push({
          id: `pay-${p.id}`,
          title: `💰 طلب صرف ${p.request_number} — ${p.partner_name || ""} — ${amount} ${p.currency} — ${statusLabel[p.status] || p.status}`,
          color: statusColor[p.status] || "#3b82f6",
          createdAt: p.created_at,
        });
      }
    } catch { /* table may not exist */ }

    try {
      // 3. Recent general requests (last 5)
      const genResult = await db.execute(
        sql`SELECT id, request_number, request_type, subject, status, created_at
            FROM general_requests
            WHERE is_archived = 0
            ORDER BY created_at DESC
            LIMIT 5`
      );
      const gens = (genResult[0] as unknown as any[]) || [];
      const typeLabel: Record<string, string> = {
        proposal_approval: "اعتماد عرض", contract_approval: "اعتماد عقد",
        meeting_request: "طلب اجتماع", zoom_meeting: "اجتماع زووم",
        inquiry: "استفسار", decision_request: "طلب قرار", other: "أخرى",
      };
      const genStatusColor: Record<string, string> = {
        new: "#3b82f6", pending_wael: "#f59e0b", pending_sheikh: "#f59e0b",
        approved: "#10b981", rejected: "#ef4444", needs_revision: "#f97316",
      };
      for (const g of gens) {
        events.push({
          id: `gen-${g.id}`,
          title: `📋 ${typeLabel[g.request_type] || g.request_type}: ${g.subject} (${g.request_number})`,
          color: genStatusColor[g.status] || "#3b82f6",
          createdAt: g.created_at,
        });
      }
    } catch { /* table may not exist */ }

    // Sort all events by date descending, return latest 15
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return events.slice(0, 15);
  }),

  // Get all news items (for admin management)
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    const items = await db
      .select()
      .from(newsTicker)
      .orderBy(asc(newsTicker.sortOrder));
    return items;
  }),

  // Create a new news item
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        color: z.string().default("#f59e0b"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      // Get max sort order
      const existing = await db
        .select({ sortOrder: newsTicker.sortOrder })
        .from(newsTicker)
        .orderBy(desc(newsTicker.sortOrder))
        .limit(1);
      const nextOrder = (existing[0]?.sortOrder ?? 0) + 1;

      await db.insert(newsTicker).values({
        title: input.title,
        color: input.color,
        isActive: 1,
        sortOrder: nextOrder,
      });
      return { success: true };
    }),

  // Update a news item
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        color: z.string().optional(),
        isActive: z.number().min(0).max(1).optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

      await db.update(newsTicker).set(updateData).where(eq(newsTicker.id, id));
      return { success: true };
    }),

  // Delete a news item
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(newsTicker).where(eq(newsTicker.id, input.id));
      return { success: true };
    }),

  // Toggle active status
  toggleActive: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [item] = await db
        .select({ isActive: newsTicker.isActive })
        .from(newsTicker)
        .where(eq(newsTicker.id, input.id));
      if (item) {
        await db
          .update(newsTicker)
          .set({ isActive: item.isActive === 1 ? 0 : 1 })
          .where(eq(newsTicker.id, input.id));
      }
      return { success: true };
    }),
});
