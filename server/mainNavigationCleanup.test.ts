import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const unifiedProjectCardSource = readFileSync("client/src/pages/UnifiedProjectCardPage.tsx", "utf8");

describe("main navigation cleanup", () => {
  it("keeps Financial Studies first and places Knowledge and Analysis among the retained main cards", () => {
    const financialIndex = homeSource.indexOf('id: "main-bateekha"');
    const developmentIndex = homeSource.indexOf('id: "main-dev"');
    const knowledgeIndex = homeSource.indexOf('id: "main-kb", label: "المعرفة والتحليل"');
    expect(financialIndex).toBeGreaterThan(-1);
    expect(knowledgeIndex).toBeGreaterThan(financialIndex);
    expect(developmentIndex).toBeGreaterThan(financialIndex);
    expect(homeSource).toContain('grid grid-cols-2 gap-3 md:grid-cols-4');
  });

  it("keeps Knowledge Base as a separate lower Tools and Reports card", () => {
    expect(homeSource).toContain('id: "tool-knowledge-base", label: "قاعدة المعرفة"');
    expect(homeSource).toContain('path: "/knowledge-base"');
    expect(homeSource).toContain('id: "main-kb", label: "المعرفة والتحليل"');
  });

  it("removes only the obsolete strategic entry points while retaining the document-derived card inside Financial Studies", () => {
    expect(appSource).not.toContain('path="/project-management"');
    expect(appSource).not.toContain('path="/fact-sheet"');
    expect(appSource).toContain('path="/knowledge-analysis"');
    expect(unifiedProjectCardSource).toContain('<FactSheetPage embedded documentOnly />');
  });
});
