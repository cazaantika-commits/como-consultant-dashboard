import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { buildPricingPatch, getEvidenceMismatchReasons, marketEvidenceRouter } from "./routers/marketEvidence";

const routerSource = readFileSync("server/routers/marketEvidence.ts", "utf8");
const governanceSource = readFileSync("server/services/comoNextMarketDecision.ts", "utf8");
const panelSource = readFileSync("client/src/components/feasibility/MarketEvidencePanel.tsx", "utf8");
const decisionSource = readFileSync("client/src/components/feasibility/MarketDecisionTab.tsx", "utf8");
const profilePanelSource = readFileSync("client/src/components/feasibility/MarketSearchProfilePanel.tsx", "utf8");
const dldImportSource = readFileSync("client/src/components/feasibility/DldCsvImportPanel.tsx", "utf8");
const knowledgeHubSource = readFileSync("client/src/pages/KnowledgeHubPage.tsx", "utf8");

function context(userId: number): TrpcContext {
	return {
		user: { id: userId, openId: `market-test-${userId}`, email: `market-${userId}@example.com`, name: "Market Test", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
		req: { protocol: "https", headers: {} } as TrpcContext["req"],
		res: {} as TrpcContext["res"],
	};
}

describe("project market evidence register", () => {
  it("records evidence with source date, confidence, and a reviewable verification state", () => {
    expect(routerSource).toContain('sourceDate: z.string().regex');
    expect(routerSource).toContain('confidenceGrade: z.enum(["high", "medium", "low"])');
    expect(routerSource).toContain('verificationStatus: z.enum(["draft", "verified", "excluded"])');
    expect(panelSource).toContain('function freshness(sourceDate?: string | null)');
    expect(panelSource).toContain('يلزم توثيق دليل واحد على الأقل');
  });

  it("requires verified evidence before approval; the approval record itself never writes to pricing or cash flows", () => {
		expect(routerSource).toContain('input.decisionStatus === "approved" && state.verifiedEvidenceCount === 0');
    const approvalBlock = routerSource.slice(routerSource.indexOf("recordDecision: protectedProcedure"), routerSource.indexOf("handoffApprovedPricing: protectedProcedure"));
    expect(approvalBlock).not.toContain("competitionPricing");
    expect(approvalBlock).not.toContain("cashFlow");
		expect(approvalBlock).toContain("buildMarketDecisionSourceSnapshot");
		expect(approvalBlock).not.toContain("JSON.stringify(input.decisionSnapshot)");
    expect(decisionSource).toContain('<MarketEvidencePanel');
  });

  it("locks the comparison context before evidence and excludes incompatible product forms", () => {
		expect(governanceSource).toContain('export function getEvidenceMismatchReasons(profile: any, evidence: any): string[]');
		expect(governanceSource).toContain('evidence.productForm !== profile.productForm');
		expect(governanceSource).toContain('لا يمكن مقارنة الشقق بالفلل أو الأراضي');
    expect(routerSource).toContain('if (input.verificationStatus === "verified")');
    expect(routerSource).toContain('getEvidenceMismatchReasons(profileRows[0], evidenceRows[0])');
    expect(profilePanelSource).toContain('فلترة سوق المقارنة');
    expect(panelSource).toContain('خارج الفلترة');
  });

  it("accepts only apartment-sale evidence for an apartment-sale market profile", () => {
    const profile = {
      transactionPurpose: "sale", assetClass: "residential", productForm: "apartment", developmentStatus: "offplan",
      primaryCommunity: "ند الشبا جاردينز", alternativeCommunitiesJson: JSON.stringify(["مجان"]), unitTypesJson: JSON.stringify(["1BR", "2BR"]),
      minAreaSqft: "500", maxAreaSqft: "1500", minPricePerSqft: "1200", maxPricePerSqft: "2500", transactionDateFrom: "2025-01-01", transactionDateTo: "2026-12-31",
    };
    const apartment = { transactionPurpose: "sale", assetClass: "residential", productForm: "apartment", developmentStatus: "offplan", community: "ند الشبا جاردينز", unitType: "1BR", unitAreaSqft: "850", pricePerSqft: "1800", sourceDate: "2026-06-01" };
    const villa = { ...apartment, productForm: "villa" };
    const land = { ...apartment, assetClass: "land", productForm: "plot" };
    expect(getEvidenceMismatchReasons(profile, apartment)).toEqual([]);
    expect(getEvidenceMismatchReasons(profile, villa)).toContain("شكل المنتج مختلف؛ لا يمكن مقارنة الشقق بالفلل أو الأراضي.");
    expect(getEvidenceMismatchReasons(profile, land)).toContain("فئة الأصل مختلفة عن السوق المطلوب.");
  });

  it("previews and imports DLD sale rows through the locked market profile instead of bypassing it", () => {
    expect(routerSource).toContain("previewDldImport: protectedProcedure");
    expect(routerSource).toContain("importDldTransactions: protectedProcedure");
    expect(routerSource).toContain('transactionPurpose: "sale" as const');
    expect(routerSource).toContain("verificationStatus: mismatchReasons.length ? \"excluded\"");
    expect(dldImportSource).toContain('row["Transaction Number"]');
    expect(dldImportSource).toContain('row["Property Type"]');
    expect(dldImportSource).toContain("إدراج المعاملات المتوافقة");
  });

  it("maps only approved decision prices to competition pricing and never constructs a cash-flow update", () => {
    const patch = buildPricingPatch({ pricing: { scenarios: {
      base: { residential: { studio: 1450, oneBr: 1650 }, retail: {}, office: {} },
      conservative: { residential: { studio: 1300 }, retail: {}, office: {} },
      optimistic: { residential: { studio: 1600 }, retail: {}, office: {} },
    }, paymentPlan: { booking: { pct: 20 }, construction: { pct: 50 }, handover: { pct: 30 } } } });
    expect(patch).toMatchObject({ baseStudioPrice: 1450, base1brPrice: 1650, consStudioPrice: 1300, optStudioPrice: 1600, paymentBookingPct: "20", paymentConstructionPct: "50", paymentHandoverPct: "30", isApproved: 1 });
    expect(Object.keys(patch).some((key) => key.toLowerCase().includes("cashflow"))).toBe(false);
    expect(routerSource).toContain("handoffApprovedPricing: protectedProcedure");
		expect(routerSource).toContain("marketPricingHandoffs");
		expect(routerSource).toContain("decisionState.isValid");
  });

	it("enforces project access on every market project procedure and keeps decisions in their source register", () => {
		expect((routerSource.match(/requireProjectAccess\(/g) || []).length).toBeGreaterThanOrEqual(11);
		expect(routerSource).toContain("assertMarketDecisionOwner(ctx.user)");
		expect(routerSource).not.toContain("comoNextDecisions");
		expect(governanceSource).toContain("verifiedEvidence.map");
		expect(knowledgeHubSource).toContain('new URLSearchParams(window.location.search).get("projectId")');
		expect(knowledgeHubSource).toContain("routeProjectApplied");
	});

	it("rejects cross-project market reads and writes before touching the source register", async () => {
		const caller = marketEvidenceRouter.createCaller(context(999_999_999));
		await expect(caller.getSearchProfile({ projectId: 4 })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(caller.addEvidence({ projectId: 4, evidenceType: "transaction", transactionPurpose: "sale", sourceType: "manual", sourceName: "Unauthorized test", sourceDate: "2026-09-01", confidenceGrade: "high", assetClass: "residential", productForm: "apartment", developmentStatus: "offplan" })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
