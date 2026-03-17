import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsTicker } from "../../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";

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
