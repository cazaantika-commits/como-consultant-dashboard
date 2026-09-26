import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = {
  app: readFileSync("client/src/App.tsx", "utf8"),
  home: readFileSync("client/src/pages/Home.tsx", "utf8"),
  management: readFileSync("client/src/pages/ProjectManagementPage.tsx", "utf8"),
  financial: readFileSync("client/src/pages/BateekhaPage.tsx", "utf8"),
  project: readFileSync("client/src/pages/ComoNextProjectPage.tsx", "utf8"),
  tour: readFileSync("client/src/pages/DevelopmentPhasesPage.tsx", "utf8"),
  foundation: readFileSync("client/src/pages/ProjectLaunchGatePage.tsx", "utf8"),
};

describe("unified project-management hub", () => {
  it("provides one canonical project-first route from the homepage", () => {
    expect(files.app).toContain('<Route path="/project-management" component={ProjectManagementPage} />');
    expect(files.home).toContain('id: "project-management"');
    expect(files.home).toContain('path: "/project-management"');
    expect(files.management).toContain("اختر المشروع");
    expect(files.management).toContain("مشروع واحد في كل مرة");
  });

  it("keeps the four agreed project-management cards and points to existing protected modules", () => {
    expect(files.management).toContain('id: "executive-file"');
    expect(files.management).toContain('id: "feasibility"');
    expect(files.management).toContain('id: "cash-flow"');
    expect(files.management).toContain('id: "development-tour"');
    expect(files.management).toContain("/como-next/projects/${projectId}");
    expect(files.management).toContain("/bateekha?projectId=${projectId}&tab=feasibility");
    expect(files.management).toContain("/development-phases?projectId=${projectId}");
    expect(files.management).not.toContain("invokeLLM");
    expect(files.management).not.toContain("mutation(");
  });

  it("preserves the selected project across Financial Studies and the executive file", () => {
    expect(files.financial).toContain('new URLSearchParams(window.location.search).get("projectId")');
    expect(files.financial).toContain("setSelectedProjectId(requestedProjectId)");
    expect(files.financial).toContain("/bateekha?projectId=${selectedProjectId}&tab=${tab.id}");
    expect(files.project).toContain("/project-management?projectId=${projectId}");
    expect(files.project).toContain("/bateekha?projectId=${projectId}");
  });

  it("makes the preserved development tour share one project and fixes its embedded foundation card", () => {
    expect(files.tour).toContain("<ProjectSelector selectedId={sharedProjectId} onSelect={chooseProject} />");
    expect(files.tour).toContain("disabled={!sharedProjectId}");
    expect(files.tour).toContain("<ProjectLaunchGatePage embedded initialProjectId={sharedProjectId} />");
    expect(files.foundation).toContain("initialProjectId = null");
    expect(files.foundation).toContain("routeProjectId");
    expect(files.foundation).toContain("Number(initialProjectId)");
  });

  it("does not duplicate or replace the protected financial engines", () => {
    expect(files.financial).toContain('const V2InvestorCashFlow = lazy(() => import("./V2InvestorCashFlow"))');
    expect(files.financial).toContain('const V2EscrowCashFlow = lazy(() => import("./V2EscrowCashFlow"))');
    expect(files.financial).toContain('const V2Feasibility = lazy(() => import("./V2Feasibility"))');
    expect(files.management).not.toContain("financialData");
    expect(files.management).not.toContain("cashFlow");
    expect(files.management).not.toContain("feasibilityStudies");
  });
});
