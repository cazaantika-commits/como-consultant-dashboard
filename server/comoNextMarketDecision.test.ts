import { describe, expect, it } from "vitest";
import {
  buildMarketDecisionSourceSnapshot,
  deriveMarketDecisionValidity,
  getEvidenceSetHash,
  getMarketProfileHash,
  isMeaningfulMarketRecommendation,
  MARKET_DECISION_SCHEMA_VERSION,
} from "./services/comoNextMarketDecision";

const profile = {
  id: 7,
  projectId: 4,
  profileVersion: 2,
  transactionPurpose: "sale",
  evidenceMode: "closed_transaction",
  assetClass: "residential",
  productForm: "apartment",
  unitTypesJson: JSON.stringify(["2BR", "1BR"]),
  primaryCommunity: "مجان",
  alternativeCommunitiesJson: JSON.stringify(["أرجان"]),
  developmentStatus: "offplan",
  minAreaSqft: "600.00",
  maxAreaSqft: "1400.00",
  minPricePerSqft: "1200.00",
  maxPricePerSqft: "2200.00",
  transactionDateFrom: "2025-01-01",
  transactionDateTo: "2026-12-31",
};

const evidence = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  projectId: 4,
  evidenceType: "transaction",
  transactionPurpose: "sale",
  sourceType: "DLD",
  sourceName: `DLD ${id}`,
  sourceUrl: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
  sourceDate: "2026-06-01",
  confidenceGrade: "high",
  verificationStatus: "verified",
  marketReportId: null,
  comparableName: `Comparable ${id}`,
  community: "مجان",
  assetClass: "residential",
  productForm: "apartment",
  developmentStatus: "offplan",
  unitType: "1BR",
  unitAreaSqft: "850.00",
  pricePerSqft: "1800.00",
  transactionValue: "1530000.00",
  paymentPlanSummary: null,
  notes: null,
  updatedAt: "2026-09-20 10:00:00",
  ...overrides,
});

function approvalFor(currentProfile = profile, evidenceRows = [evidence(1), evidence(2)]) {
  return {
    id: 21,
    sourceSchemaVersion: MARKET_DECISION_SCHEMA_VERSION,
    profileId: currentProfile.id,
    profileVersion: currentProfile.profileVersion,
    profileHash: getMarketProfileHash(currentProfile),
    evidenceSetHash: getEvidenceSetHash(evidenceRows),
    verifiedEvidenceCount: evidenceRows.length,
  };
}

describe("canonical market decision governance", () => {
  it("keeps profile hashes stable for equivalent list order and changes them for a scope change", () => {
    const reordered = { ...profile, unitTypesJson: JSON.stringify(["1BR", "2BR"]) };
    expect(getMarketProfileHash(reordered)).toBe(getMarketProfileHash(profile));
    expect(getMarketProfileHash({ ...profile, primaryCommunity: "ند الشبا" })).not.toBe(getMarketProfileHash(profile));
  });

  it("builds the approval source snapshot from every verified evidence row supplied by the server", () => {
    const rows = [evidence(2), evidence(1)];
    const snapshot = buildMarketDecisionSourceSnapshot({ profile, evidenceRows: rows, recommendation: { product: { unitMix: { oneBr: 60 } }, pricing: {} } });
    expect(snapshot.schemaVersion).toBe(MARKET_DECISION_SCHEMA_VERSION);
    expect(snapshot.evidence.items.map(item => item.evidenceId)).toEqual([1, 2]);
    expect(snapshot.evidence.count).toBe(2);
    expect(snapshot.evidence.setHash).toBe(getEvidenceSetHash(rows));
    expect((snapshot as any).selectedEvidenceIds).toBeUndefined();
  });

  it("invalidates an approval when the profile version or full evidence set changes", () => {
    const rows = [evidence(1), evidence(2)];
    const approved = approvalFor(profile, rows);
    expect(deriveMarketDecisionValidity({ profile, verifiedEvidence: rows, latestApproved: approved }).status).toBe("current_valid");
		expect(deriveMarketDecisionValidity({ profile: { ...profile, profileVersion: 3, maxPricePerSqft: "2300.00" }, verifiedEvidence: rows, latestApproved: approved }).status).toBe("needs_reapproval");
    expect(deriveMarketDecisionValidity({ profile, verifiedEvidence: [...rows, evidence(3)], latestApproved: approved }).status).toBe("needs_reapproval");
    expect(deriveMarketDecisionValidity({ profile, verifiedEvidence: [evidence(1, { updatedAt: "2026-09-21 10:00:00" }), evidence(2)], latestApproved: approved }).status).toBe("needs_reapproval");
  });

  it("blocks approval readiness when any verified evidence is incompatible", () => {
    const rows = [evidence(1), evidence(2, { productForm: "villa" })];
    const state = deriveMarketDecisionValidity({ profile, verifiedEvidence: rows, latestApproved: approvalFor(profile, rows) });
    expect(state.status).toBe("incompatible_verified_evidence");
    expect(state.isValid).toBe(false);
    expect(state.incompatibleEvidence).toHaveLength(1);
  });

	it("does not fall back to an older approval after a later rejection", () => {
		const rows = [evidence(1), evidence(2)];
		const state = deriveMarketDecisionValidity({ profile, verifiedEvidence: rows, latestApproved: approvalFor(profile, rows), latestDecision: { id: 22, decisionStatus: "rejected" } });
		expect(state.status).toBe("no_approved_decision");
		expect(state.isValid).toBe(false);
		expect(state.reason).toContain("رفض");
	});

  it("requires a substantive structured recommendation", () => {
    expect(isMeaningfulMarketRecommendation({ product: {}, pricing: {} })).toBe(false);
		expect(isMeaningfulMarketRecommendation({ product: { unitMix: {} }, pricing: { scenarios: {} } })).toBe(false);
    expect(isMeaningfulMarketRecommendation({ product: { unitMix: { oneBr: 50 } }, pricing: {} })).toBe(true);
  });
});
