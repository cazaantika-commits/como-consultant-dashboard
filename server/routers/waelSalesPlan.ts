import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { waelSalesPlans } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const waelSalesPlanRouter = router({
  getByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const plans = await db
        .select()
        .from(waelSalesPlans)
        .where(eq(waelSalesPlans.projectId, input.projectId))
        .orderBy(desc(waelSalesPlans.updatedAt));
      return plans;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [plan] = await db
        .select()
        .from(waelSalesPlans)
        .where(eq(waelSalesPlans.id, input.id));
      return plan || null;
    }),

  save: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      projectId: z.number(),
      name: z.string().optional(),
      status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
      t12Date: z.string().optional(),
      t03: z.number().optional(),
      t04: z.number().optional(),
      t05: z.number().optional(),
      t06: z.number().optional(),
      designMonths: z.number().optional(),
      constructionMonths: z.number().optional(),
      postCompletionMonths: z.number().optional(),
      totalRevenue: z.number().optional(),
      offplanPct: z.number().optional(),
      marketingBudgetPct: z.string().optional(),
      salesCommissionPct: z.string().optional(),
      salesAbsorptionJson: z.string().optional(),
      marketingDistJson: z.string().optional(),
      channelsJson: z.string().optional(),
      paymentPlanJson: z.string().optional(),
      resultsJson: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const data: any = {
        projectId: input.projectId,
        userId: ctx.user.id,
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.status !== undefined) data.status = input.status;
      if (input.t12Date !== undefined) data.t12Date = input.t12Date;
      if (input.t03 !== undefined) data.t03 = input.t03;
      if (input.t04 !== undefined) data.t04 = input.t04;
      if (input.t05 !== undefined) data.t05 = input.t05;
      if (input.t06 !== undefined) data.t06 = input.t06;
      if (input.designMonths !== undefined) data.designMonths = input.designMonths;
      if (input.constructionMonths !== undefined) data.constructionMonths = input.constructionMonths;
      if (input.postCompletionMonths !== undefined) data.postCompletionMonths = input.postCompletionMonths;
      if (input.totalRevenue !== undefined) data.totalRevenue = input.totalRevenue;
      if (input.offplanPct !== undefined) data.offplanPct = input.offplanPct;
      if (input.marketingBudgetPct !== undefined) data.marketingBudgetPct = input.marketingBudgetPct;
      if (input.salesCommissionPct !== undefined) data.salesCommissionPct = input.salesCommissionPct;
      if (input.salesAbsorptionJson !== undefined) data.salesAbsorptionJson = input.salesAbsorptionJson;
      if (input.marketingDistJson !== undefined) data.marketingDistJson = input.marketingDistJson;
      if (input.channelsJson !== undefined) data.channelsJson = input.channelsJson;
      if (input.paymentPlanJson !== undefined) data.paymentPlanJson = input.paymentPlanJson;
      if (input.resultsJson !== undefined) data.resultsJson = input.resultsJson;

      if (input.id) {
        await db.update(waelSalesPlans).set(data).where(eq(waelSalesPlans.id, input.id));
        return { id: input.id, action: "updated" as const };
      } else {
        const [result] = await db.insert(waelSalesPlans).values(data);
        return { id: result.insertId, action: "created" as const };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(waelSalesPlans).where(eq(waelSalesPlans.id, input.id));
      return { success: true };
    }),
});
