import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { buildProjectReference } from "./routers/projectReference";
import { buildProjectFoundation } from "./services/comoNextProjectFoundation";

const routerSource = readFileSync("server/routers/projectReference.ts", "utf8");
const commandCenterSource = readFileSync("server/routers/commandCenter.ts", "utf8");
const schemaSource = readFileSync("drizzle/schema.ts", "utf8");

function foundation(activeContractCount = 0) {
  return buildProjectFoundation({
    project: { id: 4, name: "مشروع تجريبي", plotNumber: "12", titleDeedNumber: "TD-1", permittedUse: "سكني", gfaSqft: 50000, ownershipType: "أرض مملوكة", financingScenario: "build_for_sale" },
    protectedDocumentCount: 1,
    indexedDocumentCount: 1,
    hasMarketProfile: true,
    verifiedEvidenceCount: 2,
    hasApprovedMarketDecision: true,
    projectStageCount: 2,
    plannedServices: 3,
    proposalCount: 1,
    activeContractCount,
  });
}

describe("project reference and baseline", () => {
  it("builds a preparing baseline from the unified project foundation", () => {
    const reference = buildProjectReference({
      project: { id: 4, name: "مشروع تجريبي", plotNumber: "12", titleDeedNumber: "TD-1", permittedUse: "سكني", gfaSqft: 50000 },
      foundation: foundation(),
      officialDocuments: [{ sourceName: "سند الملكية.pdf", category: "official_land_document", updatedAt: "2026-08-20", sourceType: "legacy_index", sourceId: "legacy-1", sourcePath: null }],
      approvedMarketDecision: { decidedAt: "2026-08-21", notes: null },
      verifiedEvidenceCount: 2,
      plannedServices: 3,
      legalRecord: undefined,
      permitRecord: undefined,
      activeContracts: [],
    });
    expect(reference.readOnly).toBe(true);
    expect(reference.baseline.status).toBe("waiting_for_appointment");
    expect(reference.sources.find(source => source.id === "market")?.status).toBe("ready");
    expect(reference.foundation.evidence.totalDocumentReferences).toBe(2);
    expect(reference.sources.find(source => source.id === "documents")?.source).toContain("COMO");
    expect(reference.officialDocuments[0]?.gate.label).toBe("حقائق الأرض والوثائق");
  });

  it("keeps source records read-only and scopes baseline/change writes to project access", () => {
    expect(routerSource).toContain("projectReferenceRouter = router");
    expect(routerSource).toContain("approveBaseline");
    expect(routerSource).toContain("createChangeRequest");
    expect(routerSource).toContain("projectBaselines");
    expect(routerSource).toContain("projectChangeRequests");
    expect(routerSource).toContain("requireProjectAccess");
    expect(routerSource).toContain("foundation: reference.foundation");
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

  it("maps the existing live baseline status column without generating a schema migration", async () => {
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [columns] = await connection.query<any[]>("SHOW COLUMNS FROM project_baselines");
      expect(columns.some(column => column.Field === "status")).toBe(true);
      expect(columns.some(column => column.Field === "baseline_status")).toBe(false);
      expect(schemaSource).toContain('status: mysqlEnum("status", ["active", "superseded"])');
    } finally {
      await connection.end();
    }
  });
});
