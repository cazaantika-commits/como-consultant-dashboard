import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildProjectFoundation } from "./services/comoNextProjectFoundation";

const routerSource = readFileSync("server/routers/projectLaunchGate.ts", "utf8");
const serviceSource = readFileSync("server/services/comoNextProjectFoundation.ts", "utf8");
const launchPageSource = readFileSync("client/src/pages/ProjectLaunchGatePage.tsx", "utf8");
const phasesPageSource = readFileSync("client/src/pages/DevelopmentPhasesPage.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");

const completeSeed = {
  project: {
    id: 7,
    name: "مشروع تجريبي",
    plotNumber: "6185392",
    titleDeedNumber: "TD-7",
    permittedUse: "Residential",
    gfaSqft: "50000",
    ownershipType: "أرض مملوكة للشركة",
    financingScenario: "build_for_sale",
  },
  protectedDocumentCount: 1,
  indexedDocumentCount: 1,
  hasMarketProfile: true,
  verifiedEvidenceCount: 2,
  hasApprovedMarketDecision: true,
  projectStageCount: 4,
  plannedServices: 3,
  proposalCount: 1,
  activeContractCount: 0,
};

describe("Unified Project Foundation Gate", () => {
  it("derives readiness from project-scoped evidence without Drive or global-stage assumptions", () => {
    const gate = buildProjectFoundation(completeSeed);
    expect(gate.readyForTender).toBe(true);
    expect(gate.gates.map(item => item.status)).toEqual(["complete", "complete", "complete", "partial"]);
    expect(gate.nextDecision).toContain("راجع عروض الاستشاريين");
    expect(gate.gates[0].detail).toContain("وثيقة محمية");
    expect(serviceSource).not.toContain("driveFolderId");
    expect(serviceSource).toContain("projectServiceInstances.projectId");
  });

  it("blocks later preparation when identity, evidence, and strategy are incomplete", () => {
    const gate = buildProjectFoundation({
      project: { id: 8, name: "فرصة غير مكتملة" },
      protectedDocumentCount: 0,
      indexedDocumentCount: 0,
      hasMarketProfile: false,
      verifiedEvidenceCount: 0,
      hasApprovedMarketDecision: false,
      projectStageCount: 0,
      plannedServices: 0,
      proposalCount: 0,
      activeContractCount: 0,
    });
    expect(gate.readyForTender).toBe(false);
    expect(gate.gates[0].status).toBe("missing");
    expect(gate.nextDecision).toContain("أساس المشروع");
    expect(gate.gates[0].reason).toContain("رقم الأرض");
    expect(gate.gates[0].reason).toContain("وثيقة مشروع محفوظة");
  });

  it("keeps the gate read-only and enforces project access", () => {
    expect(routerSource).toContain("requireProjectAccess");
    expect(routerSource).toContain('.query(async');
    expect(routerSource).not.toContain(".mutation(");
    expect(routerSource).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("uses a canonical project-scoped route and stays responsive", () => {
    expect(appSource).toContain('<Route path="/project-launch/:projectId" component={ProjectLaunchGatePage} />');
    expect(launchPageSource).toContain("useParams");
    expect(launchPageSource).toContain("w-full min-w-0 max-w-full overflow-x-hidden");
    expect(phasesPageSource).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
  });

  it("shows a reason, evidence checks, and concrete next action for every gate", () => {
    const gate = buildProjectFoundation(completeSeed);
    expect(gate.gates.every(item => Boolean(item.reason) && Boolean(item.nextAction) && item.items.length > 0)).toBe(true);
    expect(launchPageSource).toContain("سبب الحالة");
    expect(launchPageSource).toContain("الإجراء التالي");
    expect(launchPageSource).toContain("مصادر المشروع الفعلية");
  });
});
