import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { cfCostItems, phaseActivities, phaseCostLinks } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  requireFinanceActivity, requireFinanceCfProject, requireFinanceDatabase, requireFinancePhase,
} from "../services/financeAccess";
import type { LegacyProjectActor } from "../services/comoLegacyProjectAccess";

const id = z.number().int().positive();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/);
const money = z.number().finite().nonnegative();

async function linkedScope(actor: LegacyProjectActor, linkId: number, mode: "read" | "write") {
  const db = await requireFinanceDatabase();
  const [link] = await db.select().from(phaseCostLinks).where(eq(phaseCostLinks.id, linkId)).limit(1);
  if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "الرابط خارج نطاق الصلاحية" });
  await requireFinancePhase(actor, link.phaseId, mode);
  return link;
}

export const phaseManagementRouter = router({
  listActivities: protectedProcedure.input(id).query(async ({ ctx, input: phaseId }) => {
    await requireFinancePhase(ctx.user, phaseId, "read");
    const db = await requireFinanceDatabase();
    return db.select().from(phaseActivities).where(eq(phaseActivities.phaseId, phaseId)).orderBy(phaseActivities.activityNumber);
  }),
  createActivity: protectedProcedure.input(z.object({
    phaseId: id, activityNumber: id, activityName: z.string().min(1).max(255),
    description: z.string().optional(), startDate: month, durationMonths: id,
    endDate: month.optional(), estimatedCost: money.optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await requireFinancePhase(ctx.user, input.phaseId, "write");
    const db = await requireFinanceDatabase();
    const { estimatedCost, ...data } = input;
    const result = await db.insert(phaseActivities).values({ ...data, estimatedCost: estimatedCost === undefined ? undefined : String(estimatedCost) });
    return { id: result[0].insertId, ...input };
  }),
  updateActivity: protectedProcedure.input(z.object({
    id, activityName: z.string().min(1).max(255).optional(), description: z.string().optional(),
    startDate: month.optional(), durationMonths: id.optional(), endDate: month.optional(),
    estimatedCost: money.optional(), progress: z.number().int().min(0).max(100).optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await requireFinanceActivity(ctx.user, input.id, "write");
    const db = await requireFinanceDatabase();
    const { id: activityId, estimatedCost, ...updates } = input;
    await db.update(phaseActivities).set({ ...updates, ...(estimatedCost === undefined ? {} : { estimatedCost: String(estimatedCost) }) })
      .where(eq(phaseActivities.id, activityId));
    return { success: true };
  }),
  deleteActivity: protectedProcedure.input(id).mutation(async ({ ctx, input: activityId }) => {
    await requireFinanceActivity(ctx.user, activityId, "write");
    const db = await requireFinanceDatabase();
    await db.delete(phaseActivities).where(eq(phaseActivities.id, activityId));
    return { success: true };
  }),
  linkCostToPhase: protectedProcedure.input(z.object({
    phaseId: id, activityId: id.optional(), costItemId: id, allocatedAmount: money,
    allocationPercentage: z.number().finite().min(0).max(100).optional(), startMonth: month, endMonth: month,
    distributionType: z.enum(["lump_sum", "linear", "milestone", "custom"]).optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const phase = await requireFinancePhase(ctx.user, input.phaseId, "write");
    if (input.activityId !== undefined) {
      const { activity } = await requireFinanceActivity(ctx.user, input.activityId, "write");
      if (activity.phaseId !== phase.id) throw new TRPCError({ code: "BAD_REQUEST", message: "النشاط لا يتبع المرحلة المحددة" });
    }
    const db = await requireFinanceDatabase();
    const [cost] = await db.select().from(cfCostItems).where(eq(cfCostItems.id, input.costItemId)).limit(1);
    if (!cost) throw new TRPCError({ code: "FORBIDDEN", message: "مصدر التكلفة غير موجود" });
    const scope = await requireFinanceCfProject(ctx.user, cost.cfProjectId, "write");
    if (scope.projectId !== phase.projectId) throw new TRPCError({ code: "FORBIDDEN", message: "التكلفة لا تتبع مشروع المرحلة" });
    if (input.startMonth > input.endMonth) throw new TRPCError({ code: "BAD_REQUEST", message: "نهاية التوزيع تسبق البداية" });
    const existing = await db.select().from(phaseCostLinks).where(eq(phaseCostLinks.costItemId, cost.id));
    if (existing.some(link => link.phaseId === phase.id && link.activityId === (input.activityId ?? null))) {
      throw new TRPCError({ code: "CONFLICT", message: "مصدر التكلفة مربوط بهذه المرحلة أو النشاط بالفعل" });
    }
    const allocated = existing.reduce((sum, link) => sum + Number(link.allocatedAmount), 0);
    if (!Number.isFinite(allocated) || allocated + input.allocatedAmount > cost.totalAmount) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "التوزيعات تتجاوز قيمة مصدر التكلفة" });
    }
    const { allocatedAmount, allocationPercentage, ...data } = input;
    const result = await db.insert(phaseCostLinks).values({
      ...data, allocatedAmount: String(allocatedAmount),
      allocationPercentage: allocationPercentage === undefined ? undefined : String(allocationPercentage),
      distributionType: input.distributionType ?? "linear",
    });
    return { id: result[0].insertId, ...input };
  }),
  unlinkCostFromPhase: protectedProcedure.input(id).mutation(async ({ ctx, input: linkId }) => {
    await linkedScope(ctx.user, linkId, "write");
    const db = await requireFinanceDatabase();
    await db.delete(phaseCostLinks).where(eq(phaseCostLinks.id, linkId));
    return { success: true };
  }),
  getPhaseLinkedCosts: protectedProcedure.input(z.object({ phaseId: id.optional(), activityId: id.optional() })
    .refine(input => input.phaseId !== undefined || input.activityId !== undefined, "يجب تحديد مرحلة أو نشاط"))
    .query(async ({ ctx, input }) => {
      const phase = input.phaseId === undefined ? null : await requireFinancePhase(ctx.user, input.phaseId, "read");
      const activityScope = input.activityId === undefined ? null : await requireFinanceActivity(ctx.user, input.activityId, "read");
      if (phase && activityScope && activityScope.activity.phaseId !== phase.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "النشاط لا يتبع المرحلة المحددة" });
      }
      const db = await requireFinanceDatabase();
      return db.select().from(phaseCostLinks).where(and(
        eq(phaseCostLinks.phaseId, phase?.id ?? activityScope!.phase.id),
        input.activityId === undefined ? undefined : eq(phaseCostLinks.activityId, input.activityId),
      ));
    }),
});
