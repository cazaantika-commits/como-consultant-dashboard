import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("approved Financial Studies navigation consolidation", () => {
  const homeSource = readSource("client/src/pages/Home.tsx");
  const routerSource = readSource("client/src/App.tsx");

  it("removes only the approved V2 duplicate icon from the main dashboard", () => {
    expect(homeSource).not.toContain('id: "main-v2"');
    expect(homeSource).toContain('id: "main-bateekha"');
    expect(homeSource).not.toContain('id: "main-portfolio"');
    expect(homeSource).not.toContain('id: "tool-wael-sales"');
  });

  it("moves Knowledge and Analysis into the main dashboard while removing the retired Strategic Studies launcher", () => {
    expect(homeSource).toContain('id: "main-kb", label: "المعرفة والتحليل"');
    expect(homeSource).toContain('path: "/knowledge-analysis"');
    expect(homeSource).not.toContain('id: "main-projects"');
    expect(routerSource).not.toContain('path="/project-management"');
    expect(routerSource).not.toContain('path="/fact-sheet"');
  });

  it("retains legacy V2 routes and the unified Financial Studies route", () => {
    expect(routerSource).toContain('<Route path="/v2" component={V2Hub} />');
    expect(routerSource).toContain('<Route path="/v2/investor-cashflow" component={V2InvestorCashFlow} />');
    expect(routerSource).toContain('<Route path="/bateekha" component={BateekhaPage} />');
  });
});
