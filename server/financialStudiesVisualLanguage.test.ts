import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Financial Studies approved outlined-card visual language", () => {
  const styles = source("client/src/index.css");
  const board = source("client/src/pages/BateekhaPage.tsx");
  const construction = source("client/src/pages/ConstructionInputsPage.tsx");
  const investor = source("client/src/pages/V2InvestorCashFlow.tsx");
  const escrow = source("client/src/pages/V2EscrowCashFlow.tsx");
  const feasibility = source("client/src/pages/V2Feasibility.tsx");
  const pricing = source("client/src/pages/PricingPage.tsx");
  const timeline = source("client/src/pages/TimelinePage.tsx");
  const settings = source("client/src/pages/SettingsRulesPage.tsx");
  const capitalPortfolio = source("client/src/pages/V2CapitalPortfolio.tsx");
  const unifiedGroupCashFlow = source("client/src/pages/V2UnifiedGroupCashFlow.tsx");

  it("defines reusable light outlined cards and clean colored pills", () => {
    expect(styles).toContain("FINANCIAL STUDIES — APPROVED OUTLINED CARD LANGUAGE");
    expect(styles).toContain(".fs-card {");
    expect(styles).toContain("border: 1.5px solid var(--fs-outline)");
    expect(styles).toContain(".fs-card :is(input, select, textarea)");
    expect(styles).toContain(".fs-pill {");
    expect(styles).toContain(".fs-pill-emerald");
    expect(styles).toContain(".fs-pill-rose");
  });

  it("applies the language to the Financial Studies board, input pages, planning canvas, and reports", () => {
    [board, construction, investor, escrow, feasibility, pricing, timeline, settings, capitalPortfolio]
      .forEach((page) => expect(page).toContain("fs-card"));
    expect(board).toContain("financial-studies-language");
    expect(construction).toContain("fs-pill fs-pill-teal");
    expect(investor).not.toContain('rounded-2xl bg-slate-950 p-5 text-white');
    expect(escrow).not.toContain('rounded-2xl bg-slate-950 p-5 text-white');
    expect(timeline).toContain("fs-pill fs-pill-blue");
    expect(settings).toContain("fs-pill fs-pill-emerald");
    expect(unifiedGroupCashFlow).toContain("التدفقات النقدية الموحدة للمجموعة");
    expect(unifiedGroupCashFlow).toContain("تطوير قبل التشغيل");
  });
});
