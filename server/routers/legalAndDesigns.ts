import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { legalSetupRecords, designsAndPermits, projects } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════
// Legal Setup Router
// ═══════════════════════════════════════════════════════════════

const legalSetupInput = z.object({
  projectId: z.number(),
  titleDeedStatus: z.string().optional().nullable(),
  titleDeedNumber: z.string().optional().nullable(),
  titleDeedDate: z.string().optional().nullable(),
  ddaRegistrationStatus: z.string().optional().nullable(),
  ddaRegistrationNumber: z.string().optional().nullable(),
  ddaRegistrationDate: z.string().optional().nullable(),
  municipalityApprovalStatus: z.string().optional().nullable(),
  municipalityApprovalNumber: z.string().optional().nullable(),
  municipalityApprovalDate: z.string().optional().nullable(),
  legalObligations: z.string().optional().nullable(),
  restrictionsAndConditions: z.string().optional().nullable(),
  registrationFees: z.number().optional().nullable(),
  legalConsultationFees: z.number().optional().nullable(),
  governmentFeesTotal: z.number().optional().nullable(),
  legalNotes: z.string().optional().nullable(),
  farouqAnalysis: z.string().optional().nullable(),
  completionStatus: z.string().optional().nullable(),
});

export const legalSetupRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(legalSetupRecords)
      .where(eq(legalSetupRecords.userId, ctx.user.id))
      .orderBy(desc(legalSetupRecords.updatedAt));
  }),

  listByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(legalSetupRecords)
        .where(and(
          eq(legalSetupRecords.userId, ctx.user.id),
          eq(legalSetupRecords.projectId, input)
        ))
        .orderBy(desc(legalSetupRecords.updatedAt));
    }),

  getById: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(legalSetupRecords).where(
      and(eq(legalSetupRecords.id, input), eq(legalSetupRecords.userId, ctx.user.id))
    );
    return results[0] || null;
  }),

  create: publicProcedure
    .input(legalSetupInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(legalSetupRecords).values({
        userId: ctx.user.id,
        ...input,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: publicProcedure
    .input(z.object({ id: z.number(), ...legalSetupInput.shape }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(legalSetupRecords)
        .set(data)
        .where(and(eq(legalSetupRecords.id, id), eq(legalSetupRecords.userId, ctx.user.id)));
      return { id };
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(legalSetupRecords)
        .where(and(eq(legalSetupRecords.id, input), eq(legalSetupRecords.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ═══════════════════════════════════════════════════════════════
// Designs & Permits Router
// ═══════════════════════════════════════════════════════════════

const designsAndPermitsInput = z.object({
  projectId: z.number(),
  architecturalDesignStatus: z.string().optional().nullable(),
  architecturalDesignDate: z.string().optional().nullable(),
  architecturalDesignFileUrl: z.string().optional().nullable(),
  architecturalDesignFileKey: z.string().optional().nullable(),
  engineeringDesignStatus: z.string().optional().nullable(),
  engineeringDesignDate: z.string().optional().nullable(),
  engineeringDesignFileUrl: z.string().optional().nullable(),
  engineeringDesignFileKey: z.string().optional().nullable(),
  buildingPermitStatus: z.string().optional().nullable(),
  buildingPermitNumber: z.string().optional().nullable(),
  buildingPermitDate: z.string().optional().nullable(),
  buildingPermitExpiryDate: z.string().optional().nullable(),
  buildingPermitFileUrl: z.string().optional().nullable(),
  buildingPermitFileKey: z.string().optional().nullable(),
  municipalityDesignApprovalStatus: z.string().optional().nullable(),
  municipalityDesignApprovalDate: z.string().optional().nullable(),
  designRequirements: z.string().optional().nullable(),
  buildingConditions: z.string().optional().nullable(),
  designConsultationFees: z.number().optional().nullable(),
  buildingPermitFees: z.number().optional().nullable(),
  municipalityDesignReviewFees: z.number().optional().nullable(),
  designNotes: z.string().optional().nullable(),
  consultantAnalysis: z.string().optional().nullable(),
  completionStatus: z.string().optional().nullable(),
});

export const designsAndPermitsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(designsAndPermits)
      .where(eq(designsAndPermits.userId, ctx.user.id))
      .orderBy(desc(designsAndPermits.updatedAt));
  }),

  listByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(designsAndPermits)
        .where(and(
          eq(designsAndPermits.userId, ctx.user.id),
          eq(designsAndPermits.projectId, input)
        ))
        .orderBy(desc(designsAndPermits.updatedAt));
    }),

  getById: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(designsAndPermits).where(
      and(eq(designsAndPermits.id, input), eq(designsAndPermits.userId, ctx.user.id))
    );
    return results[0] || null;
  }),

  create: publicProcedure
    .input(designsAndPermitsInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(designsAndPermits).values({
        userId: ctx.user.id,
        ...input,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: publicProcedure
    .input(z.object({ id: z.number(), ...designsAndPermitsInput.shape }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(designsAndPermits)
        .set(data)
        .where(and(eq(designsAndPermits.id, id), eq(designsAndPermits.userId, ctx.user.id)));
      return { id };
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(designsAndPermits)
        .where(and(eq(designsAndPermits.id, input), eq(designsAndPermits.userId, ctx.user.id)));
      return { success: true };
    }),
});
