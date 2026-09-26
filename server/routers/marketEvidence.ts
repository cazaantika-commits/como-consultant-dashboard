import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { competitionPricing, marketDecisionApprovals, marketPricingHandoffs, marketReports, projectMarketEvidence, projectMarketReportLinks, projectMarketSearchProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { requireProjectAccess } from "../services/comoNextCommands";
import {
	buildMarketDecisionSourceSnapshot,
	getEvidenceMismatchReasons as getCanonicalEvidenceMismatchReasons,
	getMarketProfileHash,
	isMeaningfulMarketRecommendation,
	loadMarketDecisionState,
	MARKET_DECISION_SCHEMA_VERSION,
} from "../services/comoNextMarketDecision";

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

function toDldEvidence(projectId: number, transaction: z.infer<typeof dldTransactionInput>) {
	return {
		projectId,
		evidenceType: "transaction" as const,
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

export const getEvidenceMismatchReasons = getCanonicalEvidenceMismatchReasons;

function assertMarketDecisionOwner(user: { openId?: string | null; role?: string | null }) {
	if (!ENV.ownerOpenId || user.openId !== ENV.ownerOpenId || user.role !== "admin") {
		throw new TRPCError({ code: "FORBIDDEN", message: "اعتماد قرار السوق وتسليم السعر متاحان لعبد الرحمن فقط." });
	}
}

export const marketEvidenceRouter = router({
  getSearchProfile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      const result = await db.select().from(projectMarketSearchProfiles)
        .where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1);
			if (!result[0]) return null;
			return { ...result[0], profileHash: getMarketProfileHash(result[0]), profileVersion: Number(result[0].profileVersion || 1) };
    }),

  saveSearchProfile: protectedProcedure
    .input(profileInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
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
			const existing = await db.select().from(projectMarketSearchProfiles)
        .where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1);
      if (existing[0]) {
				const nextHash = getMarketProfileHash({ ...existing[0], ...values, projectId: input.projectId });
				const currentHash = getMarketProfileHash(existing[0]);
				const profileVersion = Number(existing[0].profileVersion || 1) + (currentHash === nextHash ? 0 : 1);
				await db.update(projectMarketSearchProfiles).set({ ...values, userId: ctx.user.id, profileVersion, profileHash: nextHash }).where(eq(projectMarketSearchProfiles.id, existing[0].id));
				return { id: existing[0].id, updated: true, profileVersion, profileHash: nextHash };
      }
			const profileVersion = 1;
			const profileHash = getMarketProfileHash({ projectId: input.projectId, ...values });
			const result = await db.insert(projectMarketSearchProfiles).values({ projectId: input.projectId, userId: ctx.user.id, profileVersion, profileHash, ...values });
			return { id: result[0].insertId, updated: false, profileVersion, profileHash };
    }),

  getProjectEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");

			const [evidence, approvals, profiles, decisionState] = await Promise.all([
        db.select().from(projectMarketEvidence)
          .where(eq(projectMarketEvidence.projectId, input.projectId))
          .orderBy(desc(projectMarketEvidence.sourceDate), desc(projectMarketEvidence.createdAt)),
        db.select().from(marketDecisionApprovals)
          .where(eq(marketDecisionApprovals.projectId, input.projectId))
          .orderBy(desc(marketDecisionApprovals.decidedAt)),
				db.select().from(projectMarketSearchProfiles)
					.where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
				loadMarketDecisionState(db, input.projectId),
      ]);

      const profile = profiles[0] || null;
      return {
        profile,
        evidence: evidence.map((item) => {
          const mismatchReasons = getEvidenceMismatchReasons(profile, item);
          return { ...item, isCompatible: mismatchReasons.length === 0, mismatchReasons };
				}),
				approvals,
				decisionState: { ...decisionState, source: undefined },
      };
    }),

  previewDldImport: protectedProcedure
    .input(dldImportInput)
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
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
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
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
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
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
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
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
		.mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      await db.delete(projectMarketReportLinks).where(and(eq(projectMarketReportLinks.id, input.linkId), eq(projectMarketReportLinks.projectId, input.projectId)));
      return { success: true };
    }),

  addEvidence: protectedProcedure
    .input(evidenceInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");

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
		.mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");

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
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      const result = await db.select().from(marketPricingHandoffs)
        .where(eq(marketPricingHandoffs.projectId, input.projectId))
        .orderBy(desc(marketPricingHandoffs.handedOffAt)).limit(1);
      return result[0] || null;
    }),

  recordDecision: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      decisionStatus: z.enum(["reviewed", "approved", "rejected"]),
			recommendation: z.object({
				product: z.record(z.string(), z.unknown()).default({}),
				pricing: z.record(z.string(), z.unknown()).default({}),
			}).strict(),
      notes: z.string().trim().max(4000).optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
			assertMarketDecisionOwner(ctx.user);

			const state = await loadMarketDecisionState(db, input.projectId);
			if (!state.profile) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تسجيل القرار قبل حفظ فلترة سوق المشروع." });
			if (input.decisionStatus === "approved" && state.verifiedEvidenceCount === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد القرار قبل توثيق دليل سوقي واحد على الأقل." });
			if (input.decisionStatus === "approved" && state.incompatibleEvidence.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن الاعتماد ما دام أحد الأدلة الموثقة خارج فلترة السوق الحالية." });
			if (input.decisionStatus === "approved" && !isMeaningfulMarketRecommendation(input.recommendation)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد قرار سوق دون توصية منظمة للمنتج أو التسعير." });
			const sourceSnapshot = buildMarketDecisionSourceSnapshot({ profile: state.source.profile, evidenceRows: state.source.verifiedEvidence, recommendation: input.recommendation });

      const result = await db.insert(marketDecisionApprovals).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        decisionStatus: input.decisionStatus,
				sourceSchemaVersion: MARKET_DECISION_SCHEMA_VERSION,
				profileId: state.profile.id,
				profileVersion: state.profile.version,
				profileHash: state.profile.hash,
				evidenceSetHash: state.evidenceSetHash,
				verifiedEvidenceCount: state.verifiedEvidenceCount,
				decisionSnapshotJson: JSON.stringify(sourceSnapshot),
				evidenceSnapshotJson: JSON.stringify(sourceSnapshot.evidence),
        notes: input.notes || null,
      });

      return { id: result[0].insertId };
    }),

  handoffApprovedPricing: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), approvalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
			await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
			assertMarketDecisionOwner(ctx.user);
			const decisionState = await loadMarketDecisionState(db, input.projectId);
			if (!decisionState.isValid || decisionState.latestApproved?.id !== input.approvalId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تسليم السعر لأن قرار السوق غير ساري على الفلترة والأدلة الحالية." });
      const approvalRows = await db.select().from(marketDecisionApprovals)
        .where(and(
          eq(marketDecisionApprovals.id, input.approvalId),
          eq(marketDecisionApprovals.projectId, input.projectId),
          eq(marketDecisionApprovals.decisionStatus, "approved"),
        )).limit(1);
      const approval = approvalRows[0];
      if (!approval) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر قرار سوق معتمدًا قبل التسليم إلى التسعير." });
      const snapshot = JSON.parse(approval.decisionSnapshotJson || "{}");
			const pricingPatch = buildPricingPatch(snapshot.recommendation || {});
			const existingHandoff = await db.select().from(marketPricingHandoffs).where(eq(marketPricingHandoffs.approvalId, approval.id)).limit(1);
			if (existingHandoff[0]) return { id: existingHandoff[0].id, existing: true, fieldsUpdated: Object.keys(pricingPatch).filter((key) => key.endsWith("Price")) };
      const existingRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId)).limit(1);
      if (existingRows[0]) await db.update(competitionPricing).set(pricingPatch).where(eq(competitionPricing.id, existingRows[0].id));
      else await db.insert(competitionPricing).values({ userId: ctx.user.id, projectId: input.projectId, ...pricingPatch });
      const handoff = await db.insert(marketPricingHandoffs).values({
        projectId: input.projectId,
        approvalId: approval.id,
        userId: ctx.user.id,
        pricingSnapshotJson: JSON.stringify({ approvalId: approval.id, pricingPatch, sourceSnapshot: snapshot }),
      });
			return { id: handoff[0].insertId, existing: false, fieldsUpdated: Object.keys(pricingPatch).filter((key) => key.endsWith("Price")) };
    }),
});
