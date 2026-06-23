import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { portfolioScenarios } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const portfolioScenariosRouter = router({
  // List all scenarios for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(portfolioScenarios)
      .where(eq(portfolioScenarios.userId, ctx.user.id))
      .orderBy(portfolioScenarios.updatedAt);
  }),

  // Save or update a scenario (upsert by name)
  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        settings: z.string(), // JSON string
        isDefault: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Check if scenario with this name already exists for this user
      const existing = await db
        .select()
        .from(portfolioScenarios)
        .where(
          and(
            eq(portfolioScenarios.userId, ctx.user.id),
            eq(portfolioScenarios.name, input.name)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(portfolioScenarios)
          .set({
            settings: input.settings,
            isDefault: input.isDefault ? 1 : 0,
          })
          .where(eq(portfolioScenarios.id, existing[0].id));
        return { id: existing[0].id, action: "updated" };
      } else {
        // Insert new
        const result = await db.insert(portfolioScenarios).values({
          userId: ctx.user.id,
          name: input.name,
          settings: input.settings,
          isDefault: input.isDefault ? 1 : 0,
        });
        return { id: Number((result as any).insertId), action: "created" };
      }
    }),

  // Load a specific scenario by id
  load: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(portfolioScenarios)
        .where(
          and(
            eq(portfolioScenarios.id, input.id),
            eq(portfolioScenarios.userId, ctx.user.id)
          )
        )
        .limit(1);
      return rows[0] ?? null;
    }),

  // Set a scenario as default (auto-load on page open)
  setDefault: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Clear all defaults for this user
      await db
        .update(portfolioScenarios)
        .set({ isDefault: 0 })
        .where(eq(portfolioScenarios.userId, ctx.user.id));
      // Set the new default
      await db
        .update(portfolioScenarios)
        .set({ isDefault: 1 })
        .where(
          and(
            eq(portfolioScenarios.id, input.id),
            eq(portfolioScenarios.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // Delete a scenario
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(portfolioScenarios)
        .where(
          and(
            eq(portfolioScenarios.id, input.id),
            eq(portfolioScenarios.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // Get the default scenario for auto-load
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(portfolioScenarios)
      .where(
        and(
          eq(portfolioScenarios.userId, ctx.user.id),
          eq(portfolioScenarios.isDefault, 1)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }),
});
