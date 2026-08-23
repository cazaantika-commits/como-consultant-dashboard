import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { marketDecisionApprovals, projectMarketEvidence, projectMarketSearchProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const evidenceInput = z.object({
  projectId: z.number().int().positive(),
  evidenceType: z.enum(["comparable", "market_report", "transaction", "regulatory", "assumption", "other"]),
  transactionPurpose: z.enum(["sale", "rent"]),
  sourceType: z.enum(["DLD", "market_report", "broker", "developer", "listing_portal", "manual", "other"]),
  sourceName: z.string().trim().min(2).max(255),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  confidenceGrade: z.enum(["high", "medium", "low"]),
  comparableName: z.string().trim().max(255).optional().or(z.literal("")),
  community: z.string().trim().max(255).optional().or(z.literal("")),
  assetClass: z.enum(["residential", "retail", "office", "mixed_use", "land", "other"]),
  productForm: z.enum(["apartment", "villa", "townhouse", "plot", "retail_unit", "office_unit", "mixed_use_unit", "other"]),
  developmentStatus: z.enum(["offplan", "ready", "any"]),
  unitType: z.string().trim().max(100).optional().or(z.literal("")),
  unitAreaSqft: z.number().positive().optional(),
  pricePerSqft: z.number().positive().optional(),
  transactionValue: z.number().positive().optional(),
  paymentPlanSummary: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

const profileInput = z.object({
  projectId: z.number().int().positive(),
  transactionPurpose: z.enum(["sale", "rent"]),
  evidenceMode: z.enum(["active_listing", "closed_transaction", "new_project", "market_report", "mixed"]),
  assetClass: z.enum(["residential", "retail", "office", "mixed_use", "land", "other"]),
  productForm: z.enum(["apartment", "villa", "townhouse", "plot", "retail_unit", "office_unit", "mixed_use_unit", "other"]),
  unitTypes: z.array(z.string().trim().min(1).max(100)).max(10),
  primaryCommunity: z.string().trim().min(2).max(255),
  alternativeCommunities: z.array(z.string().trim().min(2).max(255)).max(12),
  developmentStatus: z.enum(["offplan", "ready", "any"]),
  minAreaSqft: z.number().positive().optional(),
  maxAreaSqft: z.number().positive().optional(),
  minPricePerSqft: z.number().positive().optional(),
  maxPricePerSqft: z.number().positive().optional(),
  transactionDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  transactionDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (value.minAreaSqft && value.maxAreaSqft && value.minAreaSqft > value.maxAreaSqft) ctx.addIssue({ code: "custom", message: "الحد الأدنى للمساحة أكبر من الحد الأعلى.", path: ["maxAreaSqft"] });
  if (value.minPricePerSqft && value.maxPricePerSqft && value.minPricePerSqft > value.maxPricePerSqft) ctx.addIssue({ code: "custom", message: "الحد الأدنى للسعر أكبر من الحد الأعلى.", path: ["maxPricePerSqft"] });
});

const normalize = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase();
const parseJsonList = (value: string | null | undefined): string[] => {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []; } catch { return []; }
};

export function getEvidenceMismatchReasons(profile: any, evidence: any): string[] {
  if (!profile) return ["لم تُحدد بطاقة فلترة السوق لهذا المشروع بعد."];
  const reasons: string[] = [];
  if (evidence.transactionPurpose !== profile.transactionPurpose) reasons.push("غرض المعاملة مختلف عن البحث المحدد.");
  if (evidence.assetClass !== profile.assetClass) reasons.push("فئة الأصل مختلفة عن السوق المطلوب.");
  if (profile.productForm !== "other" && evidence.productForm !== profile.productForm) reasons.push("شكل المنتج مختلف؛ لا يمكن مقارنة الشقق بالفلل أو الأراضي.");
  if (profile.developmentStatus !== "any" && evidence.developmentStatus !== "any" && evidence.developmentStatus !== profile.developmentStatus) reasons.push("حالة المشروع مختلفة بين جاهز وأوف بلان.");
  const allowedCommunities = [profile.primaryCommunity, ...parseJsonList(profile.alternativeCommunitiesJson)].map(normalize).filter(Boolean);
  if (allowedCommunities.length && evidence.community && !allowedCommunities.includes(normalize(evidence.community))) reasons.push("المنطقة خارج نطاق المقارنة المحدد.");
  const allowedUnitTypes = parseJsonList(profile.unitTypesJson).map(normalize);
  if (allowedUnitTypes.length && evidence.unitType && !allowedUnitTypes.includes(normalize(evidence.unitType))) reasons.push("نوع الوحدة خارج نطاق المقارنة المحدد.");
  const area = Number(evidence.unitAreaSqft || 0);
  if (profile.minAreaSqft && area > 0 && area < Number(profile.minAreaSqft)) reasons.push("المساحة أقل من نطاق المقارنة.");
  if (profile.maxAreaSqft && area > 0 && area > Number(profile.maxAreaSqft)) reasons.push("المساحة أعلى من نطاق المقارنة.");
  const price = Number(evidence.pricePerSqft || 0);
  if (profile.minPricePerSqft && price > 0 && price < Number(profile.minPricePerSqft)) reasons.push("السعر لكل قدم² أدنى من نطاق المقارنة.");
  if (profile.maxPricePerSqft && price > 0 && price > Number(profile.maxPricePerSqft)) reasons.push("السعر لكل قدم² أعلى من نطاق المقارنة.");
  if (profile.transactionDateFrom && evidence.sourceDate && evidence.sourceDate < profile.transactionDateFrom) reasons.push("تاريخ الدليل أقدم من الفترة المحددة.");
  if (profile.transactionDateTo && evidence.sourceDate && evidence.sourceDate > profile.transactionDateTo) reasons.push("تاريخ الدليل أحدث من الفترة المحددة.");
  return reasons;
}

export const marketEvidenceRouter = router({
  getSearchProfile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const result = await db.select().from(projectMarketSearchProfiles)
        .where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1);
      return result[0] || null;
    }),

  saveSearchProfile: protectedProcedure
    .input(profileInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const values = {
        transactionPurpose: input.transactionPurpose,
        evidenceMode: input.evidenceMode,
        assetClass: input.assetClass,
        productForm: input.productForm,
        unitTypesJson: JSON.stringify(input.unitTypes),
        primaryCommunity: input.primaryCommunity,
        alternativeCommunitiesJson: JSON.stringify(input.alternativeCommunities),
        developmentStatus: input.developmentStatus,
        minAreaSqft: input.minAreaSqft?.toString() ?? null,
        maxAreaSqft: input.maxAreaSqft?.toString() ?? null,
        minPricePerSqft: input.minPricePerSqft?.toString() ?? null,
        maxPricePerSqft: input.maxPricePerSqft?.toString() ?? null,
        transactionDateFrom: input.transactionDateFrom || null,
        transactionDateTo: input.transactionDateTo || null,
      };
      const existing = await db.select({ id: projectMarketSearchProfiles.id }).from(projectMarketSearchProfiles)
        .where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1);
      if (existing[0]) {
        await db.update(projectMarketSearchProfiles).set(values).where(eq(projectMarketSearchProfiles.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }
      const result = await db.insert(projectMarketSearchProfiles).values({ projectId: input.projectId, userId: ctx.user.id, ...values });
      return { id: result[0].insertId, updated: false };
    }),

  getProjectEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      const [evidence, approvals, profiles] = await Promise.all([
        db.select().from(projectMarketEvidence)
          .where(eq(projectMarketEvidence.projectId, input.projectId))
          .orderBy(desc(projectMarketEvidence.sourceDate), desc(projectMarketEvidence.createdAt)),
        db.select().from(marketDecisionApprovals)
          .where(eq(marketDecisionApprovals.projectId, input.projectId))
          .orderBy(desc(marketDecisionApprovals.decidedAt)),
        db.select().from(projectMarketSearchProfiles)
          .where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
      ]);

      const profile = profiles[0] || null;
      return {
        profile,
        evidence: evidence.map((item) => {
          const mismatchReasons = getEvidenceMismatchReasons(profile, item);
          return { ...item, isCompatible: mismatchReasons.length === 0, mismatchReasons };
        }),
        approvals,
      };
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
        transactionPurpose: input.transactionPurpose,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl || null,
        sourceDate: input.sourceDate || null,
        confidenceGrade: input.confidenceGrade,
        comparableName: input.comparableName || null,
        community: input.community || null,
        assetClass: input.assetClass,
        productForm: input.productForm,
        developmentStatus: input.developmentStatus,
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

      const [evidenceRows, profileRows] = await Promise.all([
        db.select().from(projectMarketEvidence).where(and(eq(projectMarketEvidence.id, input.evidenceId), eq(projectMarketEvidence.projectId, input.projectId))).limit(1),
        db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
      ]);
      if (!evidenceRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على سجل الدليل." });
      if (input.verificationStatus === "verified") {
        const reasons = getEvidenceMismatchReasons(profileRows[0], evidenceRows[0]);
        if (reasons.length) throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن توثيق هذه المقارنة: ${reasons[0]}` });
      }
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

      const [verifiedEvidence, profileRows] = await Promise.all([
        db.select().from(projectMarketEvidence)
        .where(and(
          eq(projectMarketEvidence.projectId, input.projectId),
          eq(projectMarketEvidence.verificationStatus, "verified"),
        )),
        db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
      ]);

      if (input.decisionStatus === "approved" && verifiedEvidence.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد القرار قبل توثيق دليل سوقي واحد على الأقل." });
      }
      if (input.decisionStatus === "approved" && getEvidenceMismatchReasons(profileRows[0], verifiedEvidence[0]).length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد القرار قبل تحديد فلترة سوق المقارنة." });
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
