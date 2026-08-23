import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync("server/routers/marketEvidence.ts", "utf8");
const panelSource = readFileSync("client/src/components/feasibility/MarketEvidencePanel.tsx", "utf8");
const decisionSource = readFileSync("client/src/components/feasibility/MarketDecisionTab.tsx", "utf8");

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
});
