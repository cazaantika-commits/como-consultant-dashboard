import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pricingSource = readFileSync("client/src/pages/PricingPage.tsx", "utf8");
const timelineSource = readFileSync("client/src/pages/TimelinePage.tsx", "utf8");
const investorSource = readFileSync("client/src/pages/V2InvestorCashFlow.tsx", "utf8");
const capitalSource = readFileSync("client/src/pages/V2CapitalPortfolio.tsx", "utf8");
const unifiedSource = readFileSync("client/src/pages/V2UnifiedGroupCashFlow.tsx", "utf8");
const studiesSource = readFileSync("client/src/pages/BateekhaPage.tsx", "utf8");

describe("Financial Studies visual system", () => {
  it("keeps a single prominent return control in Financial Studies tabs", () => {
    expect(studiesSource).toContain("العودة إلى دليل الدراسات");
    expect(studiesSource).toContain("bg-teal-700");
    expect(studiesSource).toContain("<V2InvestorCashFlow embedded />");
    expect(studiesSource).toContain("<V2CapitalPortfolio embedded />");
    expect(studiesSource).toContain("<V2UnifiedGroupCashFlow />");
    expect(studiesSource).not.toContain("V2PortfolioMonthly");
    expect(investorSource).toContain("{!embedded && <button");
    expect(capitalSource).toContain("{!embedded && <button");
  });

  it("uses compact, gridded tables with explicit total treatments", () => {
    expect(pricingSource).toContain("border-indigo-300");
    expect(timelineSource).toContain("border-slate-300");
    expect(timelineSource).toContain("bg-slate-900");
    expect(investorSource).toContain("min-w-[860px]");
    expect(investorSource).toContain("border-slate-400");
    expect(unifiedSource).toContain("w-max min-w-[820px]");
    expect(unifiedSource).toContain("border-r-2 border-slate-400");
    expect(capitalSource).toContain("w-max min-w-[860px]");
    expect(capitalSource).toContain("bg-slate-800");
  });
});
