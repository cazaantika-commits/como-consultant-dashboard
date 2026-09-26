import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const unifiedProjectCardSource = readFileSync("client/src/pages/UnifiedProjectCardPage.tsx", "utf8");

describe("rebuilt executive homepage navigation", () => {
  it("keeps only four deliberate daily destinations on the authenticated homepage", () => {
    const executiveIndex = homeSource.indexOf('id: "executive-office"');
    const financialIndex = homeSource.indexOf('id: "financial-studies"');
    const consultantsIndex = homeSource.indexOf('id: "consultants"');
    const knowledgeIndex = homeSource.indexOf('id: "knowledge"');
    expect(executiveIndex).toBeGreaterThan(-1);
    expect(financialIndex).toBeGreaterThan(executiveIndex);
    expect(consultantsIndex).toBeGreaterThan(financialIndex);
    expect(knowledgeIndex).toBeGreaterThan(consultantsIndex);
    expect(homeSource).toContain('path: "/como-next"');
    expect(homeSource).toContain('path: "/bateekha"');
    expect(homeSource).toContain('path: "/consultant-portal"');
    expect(homeSource).toContain('path: "/knowledge-analysis"');
  });

  it("removes legacy draggable dashboards, news, agents, and old records from Home", () => {
    expect(homeSource).not.toContain("DndContext");
    expect(homeSource).not.toContain("NewsTicker");
    expect(homeSource).not.toContain("فريق الوكلاء");
    expect(homeSource).not.toContain("السجلات والأرشيف");
    expect(homeSource).not.toContain('path: "/tasks"');
    expect(homeSource).not.toContain('path: "/news-manage"');
    expect(homeSource).not.toContain('path: "/agent-dashboard"');
  });

  it("keeps retired strategic routes absent while preserving the document-derived project card", () => {
    expect(appSource).not.toContain('path="/project-management"');
    expect(appSource).not.toContain('path="/fact-sheet"');
    expect(appSource).toContain('<Route path="/knowledge-analysis"');
    expect(appSource).toContain('<Route path="/sara" component={SaraPage} />');
    expect(unifiedProjectCardSource).toContain('<FactSheetPage embedded documentOnly />');
  });
});
