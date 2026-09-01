import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { waelSalesPlans, projects } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  getSavedProjectUnitCount,
  rebuildOffPlanSalesResultsFromPaymentPlan,
} from "../../client/src/lib/salesPlanCashFlow";

const workspacePricingSchema = z.object({
	studioPrice: z.number().int().min(0).optional(),
	residential1brPrice: z.number().int().min(0).optional(),
	residential2brPrice: z.number().int().min(0).optional(),
	residential2brMaidPrice: z.number().int().min(0).optional(),
	residential3brPrice: z.number().int().min(0).optional(),
	residential3brMaidPrice: z.number().int().min(0).optional(),
  villaPrice: z.number().int().min(0).optional(),
  townhousePrice: z.number().int().min(0).optional(),
  retailSmallPrice: z.number().int().min(0).optional(),
  retailMediumPrice: z.number().int().min(0).optional(),
  retailLargePrice: z.number().int().min(0).optional(),
  officeSmallPrice: z.number().int().min(0).optional(),
  officeMediumPrice: z.number().int().min(0).optional(),
  officeLargePrice: z.number().int().min(0).optional(),
});

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
      marketingPct: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
      commissionPct: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
      salesCommissionPct: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
      salesAbsorptionJson: z.string().optional(),
      marketingDistJson: z.string().optional(),
      channelsJson: z.string().optional(),
      paymentPlanJson: z.string().optional(),
      resultsJson: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (!ctx.user) throw new Error("Unauthorized");

      const data: any = {
        projectId: input.projectId,
        userId: ctx.user.id,
        name: input.name || "السيناريو الافتراضي",
        status: input.status || "draft",
        t03: input.t03 ?? 3,
        t04: input.t04 ?? 0,
        t05: input.t05 ?? 5,
        t06: input.t06 ?? 3,
        designMonths: input.designMonths ?? 8,
        constructionMonths: input.constructionMonths ?? 30,
        postCompletionMonths: input.postCompletionMonths ?? 12,
        offplanPct: input.offplanPct ?? 80,
      };
      if (input.t12Date !== undefined) data.t12Date = input.t12Date;
      if (input.totalRevenue !== undefined) data.totalRevenue = input.totalRevenue;
      if (input.marketingPct !== undefined) data.marketingBudgetPct = input.marketingPct;
      if (input.commissionPct !== undefined) data.salesCommissionPct = input.commissionPct;
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
        const result = await db.insert(waelSalesPlans).values(data);
        // MySQL/TiDB: result[0].insertId is the correct way
        const insertedId = Number((result as any)[0]?.insertId);
        if (!insertedId) {
          // Fallback: query the latest record for this project
          const [latest] = await db.select({ id: waelSalesPlans.id })
            .from(waelSalesPlans)
            .where(eq(waelSalesPlans.projectId, input.projectId))
            .orderBy(desc(waelSalesPlans.id))
            .limit(1);
          return { id: latest?.id || 0, action: "created" as const };
        }
        return { id: insertedId, action: "created" as const };
      }
    }),

  saveWorkspace: protectedProcedure
    .input(z.object({
      planId: z.number().optional(),
      projectId: z.number(),
      pricing: workspacePricingSchema,
      marketingPct: z.number().min(0).max(20),
      salesCommissionPct: z.number().min(0).max(20),
      totalRevenue: z.number().min(0),
      offplanPct: z.number().min(0).max(100),
      designMonths: z.number().int().min(0),
      constructionMonths: z.number().int().min(0),
      salesAbsorptionJson: z.string(),
      marketingDistJson: z.string(),
      channelsJson: z.string(),
      paymentPlanJson: z.string(),
      resultsJson: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (!ctx.user) throw new Error("Unauthorized");

      const projectValues = {
        ...input.pricing,
        marketingPct: String(input.marketingPct),
        salesCommissionPct: String(input.salesCommissionPct),
      };
      const planValues: any = {
        projectId: input.projectId,
        userId: ctx.user.id,
        name: "سيناريو وائل المعتمد",
        status: "approved",
        designMonths: input.designMonths,
        constructionMonths: input.constructionMonths,
        offplanPct: input.offplanPct,
        totalRevenue: input.totalRevenue,
        marketingBudgetPct: String(input.marketingPct),
        salesCommissionPct: String(input.salesCommissionPct),
        salesAbsorptionJson: input.salesAbsorptionJson,
        marketingDistJson: input.marketingDistJson,
        channelsJson: input.channelsJson,
        paymentPlanJson: input.paymentPlanJson,
        resultsJson: input.resultsJson,
      };

      const persist = async (tx: any) => {
        await tx.update(projects)
          .set(projectValues)
          .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id)));
        if (input.planId) {
          await tx.update(waelSalesPlans).set(planValues).where(eq(waelSalesPlans.id, input.planId));
          return input.planId;
        }
        const result = await tx.insert(waelSalesPlans).values(planValues);
        return Number((result as any)[0]?.insertId || 0);
      };

      const id = typeof (db as any).transaction === "function"
        ? await (db as any).transaction(persist)
        : await persist(db);
      return { id, action: input.planId ? "updated" as const : "created" as const };
    }),

  savePaymentCalendar: protectedProcedure
    .input(z.object({
      planId: z.number().optional(),
      projectId: z.number(),
      paymentPlanJson: z.string().min(2),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (!ctx.user) throw new Error("Unauthorized");

      if (input.planId) {
        const [currentPlan] = await db.select().from(waelSalesPlans).where(and(
          eq(waelSalesPlans.id, input.planId),
          eq(waelSalesPlans.projectId, input.projectId),
          eq(waelSalesPlans.userId, ctx.user.id),
        )).limit(1);
        const [project] = await db.select().from(projects).where(and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.user.id),
        )).limit(1);
        if (!currentPlan || !project) throw new Error("Payment plan or project not found");

        const isOffPlan = ["offplan_escrow", "offplan_construction", "joint_venture_land_for_units"].includes(String(project.financingScenario || ""));
        const canRebuild = isOffPlan
          && getSavedProjectUnitCount(project) > 0
          && Number(currentPlan.totalRevenue) > 0;
        const rebuilt = canRebuild
          ? rebuildOffPlanSalesResultsFromPaymentPlan({
              project,
              totalRevenue: Number(currentPlan.totalRevenue),
              offplanPct: Number(currentPlan.offplanPct ?? 80),
              salesAbsorptionJson: currentPlan.salesAbsorptionJson,
              paymentPlanJson: input.paymentPlanJson,
              existingResultsJson: currentPlan.resultsJson,
            })
          : null;
        await db.update(waelSalesPlans)
          .set({
            paymentPlanJson: input.paymentPlanJson,
            salesAbsorptionJson: rebuilt?.salesAbsorptionJson ?? currentPlan.salesAbsorptionJson,
            resultsJson: rebuilt?.resultsJson ?? null,
            offplanPct: project.financingScenario === "joint_venture_land_for_units" ? 100 : currentPlan.offplanPct,
            status: "draft",
          })
          .where(and(
            eq(waelSalesPlans.id, input.planId),
            eq(waelSalesPlans.projectId, input.projectId),
            eq(waelSalesPlans.userId, ctx.user.id),
          ));
        return {
          id: input.planId,
          action: "updated" as const,
          resultsRebuilt: Boolean(rebuilt),
          requiresApproval: true,
        };
      }

      const result = await db.insert(waelSalesPlans).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        name: "خطة سداد المشترين",
        status: "draft",
        paymentPlanJson: input.paymentPlanJson,
      });
      return {
        id: Number((result as any)[0]?.insertId || 0),
        action: "created" as const,
        resultsRebuilt: false,
        requiresApproval: true,
      };
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
