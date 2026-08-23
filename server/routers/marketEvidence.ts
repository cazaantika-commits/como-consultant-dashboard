import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { marketDecisionApprovals, projectMarketEvidence } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const evidenceInput = z.object({
  projectId: z.number().int().positive(),
  evidenceType: z.enum(["comparable", "market_report", "transaction", "regulatory", "assumption", "other"]),
  sourceType: z.enum(["DLD", "market_report", "broker", "developer", "listing_portal", "manual", "other"]),
  sourceName: z.string().trim().min(2).max(255),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  confidenceGrade: z.enum(["high", "medium", "low"]),
  comparableName: z.string().trim().max(255).optional().or(z.literal("")),
  community: z.string().trim().max(255).optional().or(z.literal("")),
  assetClass: z.enum(["residential", "retail", "office", "mixed_use", "land", "other"]),
  unitType: z.string().trim().max(100).optional().or(z.literal("")),
  unitAreaSqft: z.number().positive().optional(),
  pricePerSqft: z.number().positive().optional(),
  transactionValue: z.number().positive().optional(),
  paymentPlanSummary: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const marketEvidenceRouter = router({
  getProjectEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      const [evidence, approvals] = await Promise.all([
        db.select().from(projectMarketEvidence)
          .where(eq(projectMarketEvidence.projectId, input.projectId))
          .orderBy(desc(projectMarketEvidence.sourceDate), desc(projectMarketEvidence.createdAt)),
        db.select().from(marketDecisionApprovals)
          .where(eq(marketDecisionApprovals.projectId, input.projectId))
          .orderBy(desc(marketDecisionApprovals.decidedAt)),
      ]);

      return { evidence, approvals };
    }),

  addEvidence: protectedProcedure
    .input(evidenceInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      const result = await db.insert(projectMarketEvidence).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        evidenceType: input.evidenceType,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl || null,
        sourceDate: input.sourceDate || null,
        confidenceGrade: input.confidenceGrade,
        comparableName: input.comparableName || null,
        community: input.community || null,
        assetClass: input.assetClass,
        unitType: input.unitType || null,
        unitAreaSqft: input.unitAreaSqft?.toString() ?? null,
        pricePerSqft: input.pricePerSqft?.toString() ?? null,
        transactionValue: input.transactionValue?.toString() ?? null,
        paymentPlanSummary: input.paymentPlanSummary || null,
        notes: input.notes || null,
      });

      return { id: result[0].insertId };
    }),

  setVerificationStatus: protectedProcedure
    .input(z.object({
      evidenceId: z.number().int().positive(),
      projectId: z.number().int().positive(),
      verificationStatus: z.enum(["draft", "verified", "excluded"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      await db.update(projectMarketEvidence)
        .set({ verificationStatus: input.verificationStatus })
        .where(and(
          eq(projectMarketEvidence.id, input.evidenceId),
          eq(projectMarketEvidence.projectId, input.projectId),
        ));

      return { success: true };
    }),

  recordDecision: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      decisionStatus: z.enum(["reviewed", "approved", "rejected"]),
      decisionSnapshot: z.record(z.string(), z.unknown()),
      notes: z.string().trim().max(4000).optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      const verifiedEvidence = await db.select().from(projectMarketEvidence)
        .where(and(
          eq(projectMarketEvidence.projectId, input.projectId),
          eq(projectMarketEvidence.verificationStatus, "verified"),
        ));

      if (input.decisionStatus === "approved" && verifiedEvidence.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد القرار قبل توثيق دليل سوقي واحد على الأقل." });
      }

      const result = await db.insert(marketDecisionApprovals).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        decisionStatus: input.decisionStatus,
        decisionSnapshotJson: JSON.stringify(input.decisionSnapshot),
        evidenceSnapshotJson: JSON.stringify(verifiedEvidence),
        notes: input.notes || null,
      });

      return { id: result[0].insertId };
    }),
});
