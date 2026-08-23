import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildProjectReference } from "./routers/projectReference";

const routerSource = readFileSync("server/routers/projectReference.ts", "utf8");
const commandCenterSource = readFileSync("server/routers/commandCenter.ts", "utf8");

describe("project reference and baseline", () => {
  it("builds a read-only preparing baseline before an active contract exists", () => {
    const reference = buildProjectReference({
      project: { id: 4, name: "مشروع تجريبي", plotNumber: "12", titleDeedNumber: "TD-1", permittedUse: "سكني", gfaSqft: 50000, driveFolderId: "folder" },
      officialDocuments: [{ sourceName: "سند الملكية.pdf", category: "official_land_document", updatedAt: "2026-08-20", sourceType: "google_drive", sourceId: "drive-file-1", sourcePath: null }],
      approvedMarketDecision: { decidedAt: "2026-08-21", notes: null },
      verifiedEvidenceCount: 2,
      plannedServices: 3,
      legalRecord: undefined,
      permitRecord: undefined,
      activeContracts: [],
    });
    expect(reference.readOnly).toBe(true);
    expect(reference.baseline.status).toBe("waiting_for_appointment");
    expect(reference.sources.find((source) => source.id === "market")?.status).toBe("ready");
    expect(reference.driveFolder.url).toContain("drive.google.com/drive/folders/folder");
    expect(reference.officialDocuments[0]?.driveUrl).toContain("drive.google.com/open?id=drive-file-1");
    expect(reference.officialDocuments[0]?.gate.label).toBe("حقائق الأرض والوثائق");
  });

  it("keeps source records read-only while isolating baseline and change writes in dedicated tables", () => {
    expect(routerSource).toContain("projectReferenceRouter = router");
    expect(routerSource).toContain("approveBaseline");
    expect(routerSource).toContain("createChangeRequest");
    expect(routerSource).toContain("projectBaselines");
    expect(routerSource).toContain("projectChangeRequests");
    expect(routerSource).toContain('reference.baseline.status !== "ready_to_confirm"');
    expect(routerSource).toContain("لا يمكن إنشاء طلب تغيير قبل اعتماد خط أساس للمشروع.");
    expect(routerSource).not.toContain("db.update(projects)");
    expect(routerSource).not.toContain("db.update(projectContracts)");
    expect(routerSource).not.toContain("db.update(marketDecisionApprovals)");
    expect(routerSource).not.toContain("db.update(projectServiceInstances)");
    expect(routerSource).not.toContain("db.update(documentIndex)");
  });

  it("allows Command Center to read approved changes without changing source financial records", () => {
    expect(commandCenterSource).toContain("getApprovedProjectChanges");
    expect(commandCenterSource).toContain("projectChangeRequests.decisionStatus, 'approved'");
    expect(commandCenterSource).not.toContain("UPDATE financialData");
    expect(commandCenterSource).not.toContain("db.update(financialData)");
  });
});
