import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getEvidenceMismatchReasons } from "./routers/marketEvidence";

const routerSource = readFileSync("server/routers/marketEvidence.ts", "utf8");
const panelSource = readFileSync("client/src/components/feasibility/MarketEvidencePanel.tsx", "utf8");
const decisionSource = readFileSync("client/src/components/feasibility/MarketDecisionTab.tsx", "utf8");
const profilePanelSource = readFileSync("client/src/components/feasibility/MarketSearchProfilePanel.tsx", "utf8");

describe("project market evidence register", () => {
  it("records evidence with source date, confidence, and a reviewable verification state", () => {
    expect(routerSource).toContain('sourceDate: z.string().regex');
    expect(routerSource).toContain('confidenceGrade: z.enum(["high", "medium", "low"])');
    expect(routerSource).toContain('verificationStatus: z.enum(["draft", "verified", "excluded"])');
    expect(panelSource).toContain('function freshness(sourceDate?: string | null)');
    expect(panelSource).toContain('يلزم توثيق دليل واحد على الأقل');
  });

  it("requires verified evidence before approval and never writes to pricing or cash flows", () => {
    expect(routerSource).toContain('if (input.decisionStatus === "approved" && verifiedEvidence.length === 0)');
    expect(routerSource).not.toContain('competitionPricing');
    expect(routerSource).not.toContain('cashFlow');
    expect(decisionSource).toContain('<MarketEvidencePanel');
  });

  it("locks the comparison context before evidence and excludes incompatible product forms", () => {
    expect(routerSource).toContain('export function getEvidenceMismatchReasons(profile: any, evidence: any): string[]');
    expect(routerSource).toContain('evidence.productForm !== profile.productForm');
    expect(routerSource).toContain('لا يمكن مقارنة الشقق بالفلل أو الأراضي');
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
});
