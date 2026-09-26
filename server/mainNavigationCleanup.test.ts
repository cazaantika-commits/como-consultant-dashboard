import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const unifiedProjectCardSource = readFileSync("client/src/pages/UnifiedProjectCardPage.tsx", "utf8");

describe("rebuilt executive homepage navigation", () => {
  it("keeps six deliberate destinations including project management and the protected development tour", () => {
    const projectManagementIndex = homeSource.indexOf('id: "project-management"');
    const executiveIndex = homeSource.indexOf('id: "executive-office"');
    const financialIndex = homeSource.indexOf('id: "financial-studies"');
    const consultantsIndex = homeSource.indexOf('id: "consultants"');
    const knowledgeIndex = homeSource.indexOf('id: "knowledge"');
    const tourIndex = homeSource.indexOf('id: "development-tour"');
    expect(projectManagementIndex).toBeGreaterThan(-1);
    expect(executiveIndex).toBeGreaterThan(projectManagementIndex);
    expect(financialIndex).toBeGreaterThan(executiveIndex);
    expect(consultantsIndex).toBeGreaterThan(financialIndex);
    expect(knowledgeIndex).toBeGreaterThan(consultantsIndex);
    expect(tourIndex).toBeGreaterThan(knowledgeIndex);
    expect(homeSource).toContain('path: "/como-next"');
    expect(homeSource).toContain('path: "/bateekha"');
    expect(homeSource).toContain('path: "/consultant-portal"');
    expect(homeSource).toContain('path: "/knowledge-analysis"');
    expect(homeSource).toContain('path: "/development-phases"');
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

  it("keeps the new project-management orchestrator while preserving the document-derived project card", () => {
    expect(appSource).toContain('<Route path="/project-management" component={ProjectManagementPage} />');
    expect(appSource).not.toContain('path="/fact-sheet"');
    expect(appSource).toContain('<Route path="/knowledge-analysis"');
    expect(appSource).toContain('<Route path="/sara" component={SaraPage} />');
    expect(unifiedProjectCardSource).toContain('<FactSheetPage embedded documentOnly />');
  });
});
