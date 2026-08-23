import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildProjectLaunchGate } from "./routers/projectLaunchGate";

const source = readFileSync("server/routers/projectLaunchGate.ts", "utf8");
const launchPageSource = readFileSync("client/src/pages/ProjectLaunchGatePage.tsx", "utf8");
const phasesPageSource = readFileSync("client/src/pages/DevelopmentPhasesPage.tsx", "utf8");

describe("Project Launch Gate", () => {
  it("derives readiness from supplied source facts without mutating them", () => {
    const gate = buildProjectLaunchGate({
      project: { id: 7, plotNumber: "6185392", titleDeedNumber: "TD-7", permittedUse: "Residential", gfaSqft: "50000", driveFolderId: "drive-7" },
      hasMarketProfile: true,
      verifiedEvidenceCount: 2,
      hasApprovedMarketDecision: true,
      activeLifecycleStages: 4,
      plannedServices: 3,
      proposalCount: 1,
      activeContractCount: 0,
    });

    expect(gate.readyForTender).toBe(true);
    expect(gate.gates.map((item) => item.status)).toEqual(["complete", "complete", "complete", "partial"]);
    expect(gate.nextDecision).toContain("راجع عروض الاستشاريين");
  });

  it("identifies missing facts before allowing later preparation steps", () => {
    const gate = buildProjectLaunchGate({
      project: { id: 8 }, hasMarketProfile: false, verifiedEvidenceCount: 0, hasApprovedMarketDecision: false,
      activeLifecycleStages: 0, plannedServices: 0, proposalCount: 0, activeContractCount: 0,
    });
    expect(gate.readyForTender).toBe(false);
    expect(gate.gates[0].status).toBe("missing");
    expect(gate.nextDecision).toContain("بطاقة المشروع");
  });

  it("contains a read-only query only and no source-record write operation", () => {
    expect(source).toContain(".query(async");
    expect(source).not.toContain(".mutation(");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("keeps the launch entry surfaces within the mobile viewport", () => {
    expect(launchPageSource).toContain("w-full min-w-0 max-w-full overflow-x-hidden");
    expect(phasesPageSource).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
    expect(phasesPageSource).toContain("w-full max-w-full overflow-x-hidden");
  });
});
