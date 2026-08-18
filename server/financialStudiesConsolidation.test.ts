import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("approved Financial Studies navigation consolidation", () => {
  const homeSource = readSource("client/src/pages/Home.tsx");
  const strategicStudiesSource = readSource("client/src/pages/ProjectManagementPage.tsx");
  const routerSource = readSource("client/src/App.tsx");

  it("removes only the approved V2 duplicate icon from the main dashboard", () => {
    expect(homeSource).not.toContain('id: "main-v2"');
    expect(homeSource).toContain('id: "main-bateekha"');
    expect(homeSource).toContain('id: "main-portfolio"');
    expect(homeSource).not.toContain('id: "tool-wael-sales"');
  });

  it("retains only the independent Strategic Studies cards after legacy financial cleanup", () => {
    expect(strategicStudiesSource).not.toContain('id: "investor-study" as View');
    expect(strategicStudiesSource).toContain('id: "fact-sheet" as View');
    expect(strategicStudiesSource).toContain('id: "knowledge" as View');
    expect(strategicStudiesSource).not.toContain('id: "financial" as View');
    expect(strategicStudiesSource).not.toContain('id: "dynamic-portfolio" as View');
  });

  it("retains legacy V2 routes and the unified Financial Studies route", () => {
    expect(routerSource).toContain('<Route path="/v2" component={V2Hub} />');
    expect(routerSource).toContain('<Route path="/v2/investor-cashflow" component={V2InvestorCashFlow} />');
    expect(routerSource).toContain('<Route path="/bateekha" component={BateekhaPage} />');
  });
});
