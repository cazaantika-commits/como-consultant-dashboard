import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  marketDecisionApprovals,
  projectMarketEvidence,
  projectMarketSearchProfiles,
} from "../../drizzle/schema";

export const MARKET_DECISION_SCHEMA_VERSION = "como.market-decision.v1";
export const MARKET_PROFILE_SCHEMA_VERSION = "como.market-profile.v1";

export type MarketDecisionStatus =
  | "current_valid"
  | "needs_reapproval"
  | "no_approved_decision"
  | "no_profile"
  | "no_eligible_evidence"
  | "incompatible_verified_evidence";

function normalizedText(value: unknown) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || null;
}

function normalizedDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : normalizedText(value);
}

function normalizedList(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map(normalizedText).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b, "ar"));
  } catch {
    return [];
  }
}

function normalizeForCanonicalJson(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForCanonicalJson(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

export function canonicalHash(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function buildMarketProfileSnapshot(profile: any) {
  return {
    schemaVersion: MARKET_PROFILE_SCHEMA_VERSION,
    projectId: Number(profile.projectId),
    transactionPurpose: profile.transactionPurpose,
    evidenceMode: profile.evidenceMode,
    assetClass: profile.assetClass,
    productForm: profile.productForm,
    unitTypes: normalizedList(profile.unitTypesJson),
    primaryCommunity: normalizedText(profile.primaryCommunity),
    alternativeCommunities: normalizedList(profile.alternativeCommunitiesJson),
    developmentStatus: profile.developmentStatus,
    minAreaSqft: normalizedDecimal(profile.minAreaSqft),
    maxAreaSqft: normalizedDecimal(profile.maxAreaSqft),
    minPricePerSqft: normalizedDecimal(profile.minPricePerSqft),
    maxPricePerSqft: normalizedDecimal(profile.maxPricePerSqft),
    transactionDateFrom: normalizedText(profile.transactionDateFrom),
    transactionDateTo: normalizedText(profile.transactionDateTo),
  };
}

export function getMarketProfileHash(profile: any) {
  return canonicalHash(buildMarketProfileSnapshot(profile));
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? normalizedText(value) : date.toISOString();
}

export function getEvidenceMismatchReasons(profile: any, evidence: any): string[] {
	if (!profile) return ["لم تُحدد بطاقة فلترة السوق لهذا المشروع بعد."];
  const reasons: string[] = [];
  if (evidence.transactionPurpose !== profile.transactionPurpose) reasons.push("نوع العملية مختلف عن فلترة السوق.");
  if (evidence.assetClass !== profile.assetClass) reasons.push("فئة الأصل مختلفة عن السوق المطلوب.");
  if (evidence.productForm !== profile.productForm) reasons.push("شكل المنتج مختلف؛ لا يمكن مقارنة الشقق بالفلل أو الأراضي.");
  if (profile.developmentStatus !== "any" && evidence.developmentStatus !== "any" && evidence.developmentStatus !== profile.developmentStatus) reasons.push("حالة التطوير لا تطابق الفلترة.");

  const allowedCommunities = [profile.primaryCommunity, ...normalizedList(profile.alternativeCommunitiesJson)]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  if (evidence.community && allowedCommunities.length && !allowedCommunities.includes(String(evidence.community).trim().toLowerCase())) reasons.push("المجتمع خارج مناطق المقارنة المحددة.");

  const allowedUnitTypes = normalizedList(profile.unitTypesJson).map((item) => item.toLowerCase());
  if (evidence.unitType && allowedUnitTypes.length && !allowedUnitTypes.includes(String(evidence.unitType).trim().toLowerCase())) reasons.push("نوع الوحدة خارج قائمة الوحدات المحددة.");

  const area = Number(evidence.unitAreaSqft || 0);
  if (area > 0 && Number(profile.minAreaSqft || 0) > 0 && area < Number(profile.minAreaSqft)) reasons.push("المساحة أقل من الحد الأدنى.");
  if (area > 0 && Number(profile.maxAreaSqft || 0) > 0 && area > Number(profile.maxAreaSqft)) reasons.push("المساحة أعلى من الحد الأقصى.");

  const ppsf = Number(evidence.pricePerSqft || 0);
  if (ppsf > 0 && Number(profile.minPricePerSqft || 0) > 0 && ppsf < Number(profile.minPricePerSqft)) reasons.push("سعر القدم أقل من نطاق الفلترة.");
  if (ppsf > 0 && Number(profile.maxPricePerSqft || 0) > 0 && ppsf > Number(profile.maxPricePerSqft)) reasons.push("سعر القدم أعلى من نطاق الفلترة.");

  if (evidence.sourceDate && profile.transactionDateFrom && String(evidence.sourceDate) < String(profile.transactionDateFrom)) reasons.push("تاريخ الدليل أقدم من الفترة المحددة.");
  if (evidence.sourceDate && profile.transactionDateTo && String(evidence.sourceDate) > String(profile.transactionDateTo)) reasons.push("تاريخ الدليل أحدث من الفترة المحددة.");
  return reasons;
}

export function buildMarketEvidenceSnapshot(evidence: any) {
  return {
    evidenceId: Number(evidence.id),
    projectId: Number(evidence.projectId),
    sourceRevisionAt: parseDate(evidence.updatedAt),
    sourceType: evidence.sourceType,
    sourceName: normalizedText(evidence.sourceName),
    sourceDate: normalizedText(evidence.sourceDate),
		sourceUrl: normalizedText(evidence.sourceUrl),
		marketReportId: evidence.marketReportId ? Number(evidence.marketReportId) : null,
    confidenceGrade: evidence.confidenceGrade,
    verificationStatus: evidence.verificationStatus,
    transactionPurpose: evidence.transactionPurpose,
    assetClass: evidence.assetClass,
    productForm: evidence.productForm,
    unitType: normalizedText(evidence.unitType),
    developmentStatus: evidence.developmentStatus,
		comparableName: normalizedText(evidence.comparableName),
    community: normalizedText(evidence.community),
    unitAreaSqft: normalizedDecimal(evidence.unitAreaSqft),
		transactionValue: normalizedDecimal(evidence.transactionValue),
    pricePerSqft: normalizedDecimal(evidence.pricePerSqft),
		paymentPlanSummary: normalizedText(evidence.paymentPlanSummary),
    notes: normalizedText(evidence.notes),
  };
}

export function buildEvidenceSetSnapshot(evidenceRows: any[]) {
  return evidenceRows
    .map(buildMarketEvidenceSnapshot)
    .sort((left, right) => left.evidenceId - right.evidenceId);
}

export function getEvidenceSetHash(evidenceRows: any[]) {
  return canonicalHash(buildEvidenceSetSnapshot(evidenceRows));
}

export function buildMarketDecisionSourceSnapshot(input: { profile: any; evidenceRows: any[]; recommendation: Record<string, unknown> }) {
  const profileSnapshot = buildMarketProfileSnapshot(input.profile);
  const evidenceSnapshot = buildEvidenceSetSnapshot(input.evidenceRows);
  return {
    schemaVersion: MARKET_DECISION_SCHEMA_VERSION,
    profile: {
      version: Number(input.profile.profileVersion || 1),
      hash: getMarketProfileHash(input.profile),
      snapshot: profileSnapshot,
    },
    evidence: {
      count: evidenceSnapshot.length,
      setHash: canonicalHash(evidenceSnapshot),
      items: evidenceSnapshot,
    },
    recommendation: normalizeForCanonicalJson(input.recommendation),
  };
}

export function isMeaningfulMarketRecommendation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const recommendation = value as Record<string, unknown>;
	const hasMeaningfulValue = (item: unknown): boolean => {
		if (typeof item === "number") return Number.isFinite(item) && item !== 0;
		if (typeof item === "string") return item.trim().length > 0;
		if (typeof item === "boolean") return item;
		if (Array.isArray(item)) return item.some(hasMeaningfulValue);
		if (item && typeof item === "object") return Object.values(item as Record<string, unknown>).some(hasMeaningfulValue);
		return false;
	};
	return [recommendation.product, recommendation.pricing].some(hasMeaningfulValue);
}

function stateCopy(status: MarketDecisionStatus, reason: string, nextAction: string) {
  return { status, reason, nextAction, isValid: status === "current_valid" };
}

export function deriveMarketDecisionValidity(input: {
	profile: any | null;
	verifiedEvidence: any[];
	latestApproved: any | null;
	latestDecision?: any | null;
}) {
	const effectiveApproved = input.latestDecision && input.latestDecision.decisionStatus !== "approved" ? null : input.latestApproved;
	const profileVersion = Number(input.profile?.profileVersion || 1);
	const profileHash = input.profile ? getMarketProfileHash(input.profile) : null;
	const evidenceSetHash = getEvidenceSetHash(input.verifiedEvidence);
	const incompatibleEvidence = input.profile
		? input.verifiedEvidence.map((evidence: any) => ({ id: evidence.id, reasons: getEvidenceMismatchReasons(input.profile, evidence) })).filter((item: any) => item.reasons.length > 0)
		: [];

	let status = stateCopy("no_approved_decision", "لم يُسجل قرار سوق معتمد لهذا المشروع.", "راجع التوصية وسجل الاعتماد بعد اكتمال الدليل.");
	if (!input.profile) status = stateCopy("no_profile", "لم تُحفظ فلترة سوق معتمدة لهذا المشروع.", "حدّد نطاق المقارنة واحفظه أولًا.");
	else if (input.verifiedEvidence.length === 0) status = stateCopy("no_eligible_evidence", "لا يوجد دليل سوق موثق ضمن الفلترة الحالية.", "أضف الدليل وتحقق منه قبل اعتماد القرار.");
	else if (incompatibleEvidence.length > 0) status = stateCopy("incompatible_verified_evidence", `يوجد ${incompatibleEvidence.length} دليل موثق لا يطابق الفلترة الحالية.`, "صحح الدليل أو استبعده ثم أعد مراجعة قرار السوق.");
	else if (!effectiveApproved) status = stateCopy("no_approved_decision", input.latestDecision?.decisionStatus === "rejected" ? "آخر قرار مسجل رفض التوصية الحالية؛ لا يوجد اعتماد ساري." : "الدليل جاهز، لكن قرار السوق لم يُعتمد بعد.", "راجع التوصية وسجل الاعتماد الصريح.");
  else {
		const sameSource = effectiveApproved.sourceSchemaVersion === MARKET_DECISION_SCHEMA_VERSION
			&& Number(effectiveApproved.profileId) === Number(input.profile.id)
			&& Number(effectiveApproved.profileVersion) === profileVersion
			&& effectiveApproved.profileHash === profileHash
			&& effectiveApproved.evidenceSetHash === evidenceSetHash
			&& Number(effectiveApproved.verifiedEvidenceCount) === input.verifiedEvidence.length;
		status = sameSource
			? stateCopy("current_valid", "القرار مطابق للإصدار الحالي من الفلترة ولكامل مجموعة الأدلة الموثقة.", "يمكن متابعة بوابة التأسيس؛ تسليم السعر يبقى إجراءً منفصلًا وصريحًا.")
			: stateCopy("needs_reapproval", "تغيّرت الفلترة أو مجموعة الأدلة منذ آخر اعتماد؛ بقي القرار محفوظًا كتاريخ لكنه لم يعد ساريًا.", "راجع المصدر الحالي وسجل اعتمادًا جديدًا قبل أي RFP أو تسليم سعر.");
	}

	return { ...status, profileVersion, profileHash, evidenceSetHash, incompatibleEvidence };
}

export async function loadMarketDecisionState(db: any, projectId: number) {
	const [profileRows, verifiedEvidence, latestDecisionRows, approvedRows] = await Promise.all([
    db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, projectId)).limit(2),
    db.select().from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, projectId), eq(projectMarketEvidence.verificationStatus, "verified"))).orderBy(projectMarketEvidence.id),
		db.select().from(marketDecisionApprovals).where(eq(marketDecisionApprovals.projectId, projectId)).orderBy(desc(marketDecisionApprovals.decidedAt), desc(marketDecisionApprovals.id)).limit(1),
    db.select().from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).orderBy(desc(marketDecisionApprovals.decidedAt), desc(marketDecisionApprovals.id)).limit(1),
  ]);

  const profile = profileRows[0] ?? null;
	const latestDecision = latestDecisionRows[0] ?? null;
  const latestApproved = approvedRows[0] ?? null;
	const validity = deriveMarketDecisionValidity({ profile, verifiedEvidence, latestApproved, latestDecision });

  return {
		...validity,
    projectId,
		profile: profile ? { id: profile.id, version: validity.profileVersion, hash: validity.profileHash, snapshot: buildMarketProfileSnapshot(profile) } : null,
    verifiedEvidenceCount: verifiedEvidence.length,
		evidenceSetHash: validity.evidenceSetHash,
		incompatibleEvidence: validity.incompatibleEvidence,
    latestApproved: latestApproved ? {
      id: latestApproved.id,
      decidedAt: latestApproved.decidedAt,
      notes: latestApproved.notes,
      sourceSchemaVersion: latestApproved.sourceSchemaVersion,
      profileId: latestApproved.profileId,
      profileVersion: latestApproved.profileVersion,
      profileHash: latestApproved.profileHash,
      evidenceSetHash: latestApproved.evidenceSetHash,
      verifiedEvidenceCount: latestApproved.verifiedEvidenceCount,
    } : null,
		latestDecision: latestDecision ? { id: latestDecision.id, decisionStatus: latestDecision.decisionStatus, decidedAt: latestDecision.decidedAt, notes: latestDecision.notes } : null,
    source: { profile, verifiedEvidence },
  };
}

export type MarketDecisionState = Awaited<ReturnType<typeof loadMarketDecisionState>>;
