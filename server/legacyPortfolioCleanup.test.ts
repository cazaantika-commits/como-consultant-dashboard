import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("external portfolio consolidation", () => {
  const appSource = readSource("client/src/App.tsx");
  const homeSource = readSource("client/src/pages/Home.tsx");
  const financialStudiesSource = readSource("client/src/pages/BateekhaPage.tsx");
  const programCashFlowSource = readSource("client/src/pages/ProgramCashFlowPage.tsx");

  it("removes all external portfolio launchers and direct portfolio routes", () => {
    expect(homeSource).not.toContain('id: "main-portfolio"');
    expect(appSource).not.toContain('path="/consolidated-investor-cashflow"');
    expect(appSource).not.toContain('path="/capital-planning"');
    expect(appSource).not.toContain('path="/capital-scheduling"');
    expect(appSource).not.toContain('path="/portfolio-summary-report"');
    expect(programCashFlowSource).not.toContain("PortfolioView");
    expect(programCashFlowSource).not.toContain("محفظة المشاريع");
  });

  it("keeps all portfolio reporting inside Financial Studies", () => {
    expect(appSource).toContain('path="/bateekha"');
    expect(financialStudiesSource).toContain('id: "portfolio"');
    expect(financialStudiesSource).toContain('id: "portfolio_monthly"');
    expect(financialStudiesSource).toContain('id: "capital_portfolio"');
    expect(financialStudiesSource).toContain("V2Portfolio");
    expect(financialStudiesSource).toContain("V2CapitalPortfolio");
  });

  it("removes external legacy portfolio screen files", () => {
    [
      "client/src/pages/ConsolidatedInvestorCashFlowPage.tsx",
      "client/src/pages/CapitalPlanningDashboard.tsx",
      "client/src/pages/CapitalSchedulingPage.tsx",
      "client/src/pages/PortfolioSummaryReport.tsx",
      "client/src/pages/PortfolioView.tsx",
      "client/src/pages/WorkProgramHub.tsx",
    ].forEach((relativePath) => {
      expect(fs.existsSync(path.resolve(process.cwd(), relativePath))).toBe(false);
    });
  });
});
