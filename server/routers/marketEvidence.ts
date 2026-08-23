import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { competitionPricing, marketDecisionApprovals, marketPricingHandoffs, marketReports, projectMarketEvidence, projectMarketReportLinks, projectMarketSearchProfiles } from "../../drizzle/schema";
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

const dldTransactionInput = z.object({
	transactionNumber: z.string().trim().min(1).max(120),
	transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	community: z.string().trim().min(1).max(255),
	projectName: z.string().trim().max(255).optional().or(z.literal("")),
	masterProject: z.string().trim().max(255).optional().or(z.literal("")),
	assetClass: z.enum(["residential", "retail", "office", "mixed_use", "land", "other"]),
	productForm: z.enum(["apartment", "villa", "townhouse", "plot", "retail_unit", "office_unit", "mixed_use_unit", "other"]),
	developmentStatus: z.enum(["offplan", "ready", "any"]),
	unitType: z.string().trim().max(100).optional().or(z.literal("")),
	unitAreaSqft: z.number().positive().optional(),
	transactionValue: z.number().positive().optional(),
	pricePerSqft: z.number().positive().optional(),
});

const dldImportInput = z.object({
	projectId: z.number().int().positive(),
	transactions: z.array(dldTransactionInput).min(1).max(2000),
});

const normalize = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase();
const parseJsonList = (value: string | null | undefined): string[] => {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []; } catch { return []; }
};

function toDldEvidence(projectId: number, transaction: z.infer<typeof dldTransactionInput>) {
	return {
		projectId,
		transactionPurpose: "sale" as const,
		sourceType: "DLD" as const,
		sourceName: `DLD Transaction ${transaction.transactionNumber}`,
		sourceUrl: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
		sourceDate: transaction.transactionDate,
		confidenceGrade: "high" as const,
		comparableName: transaction.projectName || transaction.masterProject || `معاملة DLD ${transaction.transactionNumber}`,
		community: transaction.community,
		assetClass: transaction.assetClass,
		productForm: transaction.productForm,
		developmentStatus: transaction.developmentStatus,
		unitType: transaction.unitType || null,
		unitAreaSqft: transaction.unitAreaSqft?.toString() ?? null,
		pricePerSqft: transaction.pricePerSqft?.toString() ?? null,
		transactionValue: transaction.transactionValue?.toString() ?? null,
		paymentPlanSummary: null,
		notes: `رقم معاملة DLD: ${transaction.transactionNumber}`,
	};
}

export function buildPricingPatch(snapshot: Record<string, any>) {
	const scenarios = snapshot?.pricing?.scenarios || snapshot?.scenarios || {};
	const data: Record<string, any> = { isApproved: 1, approvedAt: new Date() };
	const scenarioMap = [["base", "base"], ["conservative", "cons"], ["optimistic", "opt"]] as const;
	const sections: Array<[string, Record<string, string>]> = [
		["residential", { studio: "StudioPrice", oneBr: "1brPrice", twoBr: "2brPrice", threeBr: "3brPrice" }],
		["retail", { small: "RetailSmallPrice", medium: "RetailMediumPrice", large: "RetailLargePrice" }],
		["office", { small: "OfficeSmallPrice", medium: "OfficeMediumPrice", large: "OfficeLargePrice" }],
	];
	for (const [scenarioKey, targetPrefix] of scenarioMap) {
		for (const [sectionKey, unitMap] of sections) {
			const section = scenarios?.[scenarioKey]?.[sectionKey] || {};
			for (const [sourceKey, targetSuffix] of Object.entries(unitMap)) {
				const value = Number(section[sourceKey] || 0);
				if (Number.isFinite(value) && value > 0) data[`${targetPrefix}${targetSuffix}`] = Math.round(value);
			}
		}
	}
	const plan = snapshot?.pricing?.paymentPlan || snapshot?.paymentPlan || {};
	for (const [sourceKey, targetSuffix] of [["booking", "Booking"], ["construction", "Construction"], ["handover", "Handover"], ["deferred", "Deferred"]]) {
		const value = Number(plan?.[sourceKey]?.pct || 0);
		if (Number.isFinite(value) && value > 0) data[`payment${targetSuffix}Pct`] = value.toString();
	}
	if (!Object.keys(data).some((key) => key.endsWith("Price"))) throw new TRPCError({ code: "BAD_REQUEST", message: "لا تحتوي مسودة القرار المعتمدة على أسعار قابلة للتسليم إلى صفحة التسعير." });
	return data;
}

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

  previewDldImport: protectedProcedure
    .input(dldImportInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const profileRows = await db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1);
      const profile = profileRows[0];
      if (!profile) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد فلترة سوق المقارنة قبل معاينة ملف DLD." });
      const rows = input.transactions.map((transaction) => {
        const evidence = toDldEvidence(input.projectId, transaction);
        const mismatchReasons = getEvidenceMismatchReasons(profile, evidence);
        return { transaction, isCompatible: mismatchReasons.length === 0, mismatchReasons };
      });
      return { total: rows.length, compatible: rows.filter((row) => row.isCompatible).length, excluded: rows.filter((row) => !row.isCompatible).length, rows };
    }),

  importDldTransactions: protectedProcedure
    .input(dldImportInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const [profileRows, existingRows] = await Promise.all([
        db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
        db.select({ sourceName: projectMarketEvidence.sourceName }).from(projectMarketEvidence).where(eq(projectMarketEvidence.projectId, input.projectId)),
      ]);
      const profile = profileRows[0];
      if (!profile) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد فلترة سوق المقارنة قبل إدراج ملف DLD." });
      const existingNames = new Set(existingRows.map((row) => row.sourceName));
      const records = input.transactions.map((transaction) => {
        const evidence = toDldEvidence(input.projectId, transaction);
        return { evidence, mismatchReasons: getEvidenceMismatchReasons(profile, evidence) };
      }).filter(({ evidence }) => !existingNames.has(evidence.sourceName));
      if (records.length) {
        await db.insert(projectMarketEvidence).values(records.map(({ evidence, mismatchReasons }) => ({
          ...evidence,
          userId: ctx.user.id,
          verificationStatus: mismatchReasons.length ? "excluded" as const : "draft" as const,
        })));
      }
      return {
        imported: records.filter(({ mismatchReasons }) => !mismatchReasons.length).length,
        excluded: records.filter(({ mismatchReasons }) => mismatchReasons.length).length,
        duplicates: input.transactions.length - records.length,
      };
    }),

  getMarketReportLinks: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      return db.select({ link: projectMarketReportLinks, report: marketReports })
        .from(projectMarketReportLinks)
        .innerJoin(marketReports, eq(projectMarketReportLinks.reportId, marketReports.id))
        .where(eq(projectMarketReportLinks.projectId, input.projectId))
        .orderBy(desc(projectMarketReportLinks.createdAt));
    }),

  linkMarketReport: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), reportId: z.number().int().positive(), relevanceNote: z.string().trim().max(1000).optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const [profileRows, reportRows, existingRows] = await Promise.all([
        db.select({ id: projectMarketSearchProfiles.id }).from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
        db.select({ id: marketReports.id }).from(marketReports).where(eq(marketReports.id, input.reportId)).limit(1),
        db.select({ id: projectMarketReportLinks.id }).from(projectMarketReportLinks).where(and(eq(projectMarketReportLinks.projectId, input.projectId), eq(projectMarketReportLinks.reportId, input.reportId))).limit(1),
      ]);
      if (!profileRows[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد فلترة سوق المقارنة قبل ربط تقرير." });
      if (!reportRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على تقرير السوق." });
      if (existingRows[0]) return { id: existingRows[0].id, existing: true };
      const result = await db.insert(projectMarketReportLinks).values({ projectId: input.projectId, reportId: input.reportId, userId: ctx.user.id, relevanceNote: input.relevanceNote || null });
      return { id: result[0].insertId, existing: false };
    }),

  unlinkMarketReport: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), linkId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      await db.delete(projectMarketReportLinks).where(and(eq(projectMarketReportLinks.id, input.linkId), eq(projectMarketReportLinks.projectId, input.projectId)));
      return { success: true };
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

  getPricingHandoffStatus: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const result = await db.select().from(marketPricingHandoffs)
        .where(eq(marketPricingHandoffs.projectId, input.projectId))
        .orderBy(desc(marketPricingHandoffs.handedOffAt)).limit(1);
      return result[0] || null;
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

  handoffApprovedPricing: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), approvalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const approvalRows = await db.select().from(marketDecisionApprovals)
        .where(and(
          eq(marketDecisionApprovals.id, input.approvalId),
          eq(marketDecisionApprovals.projectId, input.projectId),
          eq(marketDecisionApprovals.decisionStatus, "approved"),
        )).limit(1);
      const approval = approvalRows[0];
      if (!approval) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر قرار سوق معتمدًا قبل التسليم إلى التسعير." });
      const snapshot = JSON.parse(approval.decisionSnapshotJson || "{}");
      const pricingPatch = buildPricingPatch(snapshot);
      const existingRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId)).limit(1);
      if (existingRows[0]) await db.update(competitionPricing).set(pricingPatch).where(eq(competitionPricing.id, existingRows[0].id));
      else await db.insert(competitionPricing).values({ userId: ctx.user.id, projectId: input.projectId, ...pricingPatch });
      const handoff = await db.insert(marketPricingHandoffs).values({
        projectId: input.projectId,
        approvalId: approval.id,
        userId: ctx.user.id,
        pricingSnapshotJson: JSON.stringify({ approvalId: approval.id, pricingPatch, sourceSnapshot: snapshot }),
      });
      return { id: handoff[0].insertId, fieldsUpdated: Object.keys(pricingPatch).filter((key) => key.endsWith("Price")) };
    }),
});
