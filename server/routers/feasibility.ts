import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { feasibilityStudies } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const feasibilityInput = z.object({
  projectName: z.string().min(1),
  community: z.string().optional().nullable(),
  plotNumber: z.string().optional().nullable(),
  projectDescription: z.string().optional().nullable(),
  landUse: z.string().optional().nullable(),
  plotArea: z.number().optional().nullable(),
  plotAreaM2: z.number().optional().nullable(),
  gfaResidential: z.number().optional().nullable(),
  gfaRetail: z.number().optional().nullable(),
  gfaOffices: z.number().optional().nullable(),
  totalGfa: z.number().optional().nullable(),
  saleableResidentialPct: z.number().optional().nullable(),
  saleableRetailPct: z.number().optional().nullable(),
  saleableOfficesPct: z.number().optional().nullable(),
  estimatedBua: z.number().optional().nullable(),
  numberOfUnits: z.number().optional().nullable(),
  landPrice: z.number().optional().nullable(),
  agentCommissionLandPct: z.number().optional().nullable(),
  soilInvestigation: z.number().optional().nullable(),
  topographySurvey: z.number().optional().nullable(),
  authoritiesFee: z.number().optional().nullable(),
  constructionCostPerSqft: z.number().optional().nullable(),
  communityFee: z.number().optional().nullable(),
  designFeePct: z.number().optional().nullable(),
  supervisionFeePct: z.number().optional().nullable(),
  separationFeePerM2: z.number().optional().nullable(),
  contingenciesPct: z.number().optional().nullable(),
  developerFeePct: z.number().optional().nullable(),
  agentCommissionSalePct: z.number().optional().nullable(),
  marketingPct: z.number().optional().nullable(),
  reraOffplanFee: z.number().optional().nullable(),
  reraUnitFee: z.number().optional().nullable(),
  nocFee: z.number().optional().nullable(),
  escrowFee: z.number().optional().nullable(),
  bankCharges: z.number().optional().nullable(),
  surveyorFees: z.number().optional().nullable(),
  reraAuditFees: z.number().optional().nullable(),
  reraInspectionFees: z.number().optional().nullable(),
  residentialSalePrice: z.number().optional().nullable(),
  retailSalePrice: z.number().optional().nullable(),
  officesSalePrice: z.number().optional().nullable(),
  comoProfitSharePct: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const feasibilityRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(feasibilityStudies).where(eq(feasibilityStudies.userId, ctx.user.id));
  }),

  getById: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(feasibilityStudies).where(
      and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id))
    );
    return results[0] || null;
  }),

  create: publicProcedure
    .input(feasibilityInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(feasibilityStudies).values({
        userId: ctx.user.id,
        ...input,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: publicProcedure
    .input(z.object({ id: z.number() }).merge(feasibilityInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(feasibilityStudies)
        .set(data)
        .where(and(eq(feasibilityStudies.id, id), eq(feasibilityStudies.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(feasibilityStudies)
        .where(and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id)));
      return { success: true };
    }),
});
