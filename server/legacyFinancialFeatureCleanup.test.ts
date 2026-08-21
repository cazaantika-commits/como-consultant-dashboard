import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("legacy financial feature cleanup", () => {
  const appSource = readSource("client/src/App.tsx");
  const homeSource = readSource("client/src/pages/Home.tsx");
  const commandCenterSource = readSource("client/src/pages/CommandCenterPage.tsx");

  it("removes the retired Strategic Studies launcher while retaining Knowledge and Analysis", () => {
    expect(homeSource).not.toContain('id: "main-projects"');
    expect(homeSource).toContain('id: "main-kb", label: "المعرفة والتحليل"');
    expect(appSource).not.toContain('path="/project-management"');
    expect(appSource).not.toContain('path="/fact-sheet"');
  });

  it("removes legacy financial planning and dynamic portfolio routes while retaining Financial Studies", () => {
    expect(appSource).not.toContain('path="/financial-command-center"');
    expect(appSource).not.toContain('path="/portfolio-scenarios"');
    expect(appSource).not.toContain('path="/capital-portfolio"');
    expect(appSource).toContain('path="/bateekha"');
  });

  it("removes the legacy feature launchers rather than merely hiding their cards", () => {
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/FinancialPlanningHubPage.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/FinancialCommandCenter.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/CapitalPortfolioPage.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/PortfolioAllScenariosPage.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/CashFlowHub.tsx"))).toBe(false);
  });

  it("removes obsolete financial bubbles from Command Center", () => {
    expect(commandCenterSource).not.toContain('type: "financial_reports"');
    expect(commandCenterSource).not.toContain('type: "capital_portfolio"');
    expect(commandCenterSource).not.toContain('type: "capital_schedule"');
    expect(commandCenterSource).not.toContain('type: "feasibility_study"');
    expect(commandCenterSource).toContain('type: "payment_requests"');
    expect(commandCenterSource).toContain('type: "milestones_kpis"');
  });
});
