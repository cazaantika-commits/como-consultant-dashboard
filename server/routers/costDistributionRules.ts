/**
 * Cost Distribution Rules Router
 * قواعد توزيع التكاليف — CRUD procedures
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { costDistributionRules } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

const ruleInput = z.object({
  sortOrder: z.number().int().default(0),
  itemKey: z.string().min(1).max(100),
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional().nullable(),
  amountType: z.enum(["fixed", "pct_construction", "pct_revenue", "pct_land"]),
  fixedAmount: z.number().nullable().optional(),
  pctValue: z.number().nullable().optional(),
  source: z.enum(["investor", "escrow"]),
  primaryPhase: z.enum(["land", "design", "offplan", "construction", "handover"]),
  distributionMethod: z.enum([
    "lump_sum", "equal_spread", "split_ratio", "sales_linked", "periodic", "custom"
  ]),
  relativeMonth: z.number().int().nullable().optional(),
  splitRatioJson: z.string().nullable().optional(),
  periodicIntervalMonths: z.number().int().nullable().optional(),
  periodicAmount: z.number().nullable().optional(),
  customJson: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.number().int().min(0).max(1).default(1),
});

export const costDistributionRulesRouter = router({

  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(costDistributionRules).orderBy(asc(costDistributionRules.sortOrder));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(costDistributionRules).where(eq(costDistributionRules.id, input.id));
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(ruleInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(costDistributionRules).values({
        sortOrder: input.sortOrder,
        itemKey: input.itemKey,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? null,
        amountType: input.amountType,
        fixedAmount: input.fixedAmount != null ? String(input.fixedAmount) : null,
        pctValue: input.pctValue != null ? String(input.pctValue) : null,
        source: input.source,
        primaryPhase: input.primaryPhase,
        distributionMethod: input.distributionMethod,
        relativeMonth: input.relativeMonth ?? 1,
        splitRatioJson: input.splitRatioJson ?? null,
        periodicIntervalMonths: input.periodicIntervalMonths ?? null,
        periodicAmount: input.periodicAmount != null ? String(input.periodicAmount) : null,
        customJson: input.customJson ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(ruleInput))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...rest } = input;
      await db.update(costDistributionRules).set({
        sortOrder: rest.sortOrder,
        itemKey: rest.itemKey,
        nameAr: rest.nameAr,
        nameEn: rest.nameEn ?? null,
        amountType: rest.amountType,
        fixedAmount: rest.fixedAmount != null ? String(rest.fixedAmount) : null,
        pctValue: rest.pctValue != null ? String(rest.pctValue) : null,
        source: rest.source,
        primaryPhase: rest.primaryPhase,
        distributionMethod: rest.distributionMethod,
        relativeMonth: rest.relativeMonth ?? 1,
        splitRatioJson: rest.splitRatioJson ?? null,
        periodicIntervalMonths: rest.periodicIntervalMonths ?? null,
        periodicAmount: rest.periodicAmount != null ? String(rest.periodicAmount) : null,
        customJson: rest.customJson ?? null,
        notes: rest.notes ?? null,
        isActive: rest.isActive,
      }).where(eq(costDistributionRules.id, id));
      return { success: true };
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(costDistributionRules).set({ isActive: 0 }).where(eq(costDistributionRules.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(costDistributionRules).where(eq(costDistributionRules.id, input.id));
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const item of input) {
        await db.update(costDistributionRules).set({ sortOrder: item.sortOrder }).where(eq(costDistributionRules.id, item.id));
      }
      return { success: true };
    }),
});
