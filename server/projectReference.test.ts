import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildProjectReference } from "./routers/projectReference";

const routerSource = readFileSync("server/routers/projectReference.ts", "utf8");

describe("project reference and baseline", () => {
  it("builds a read-only preparing baseline before an active contract exists", () => {
    const reference = buildProjectReference({
      project: { id: 4, name: "مشروع تجريبي", plotNumber: "12", titleDeedNumber: "TD-1", permittedUse: "سكني", gfaSqft: 50000, driveFolderId: "folder" },
      officialDocuments: [{ sourceName: "سند الملكية.pdf", category: "official_land_document", updatedAt: "2026-08-20" }],
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
  });

  it("never adds a write procedure to the reference router", () => {
    expect(routerSource).toContain("projectReferenceRouter = router");
    expect(routerSource).toContain(".query(async");
    expect(routerSource).not.toContain(".mutation(");
    expect(routerSource).not.toContain("db.insert(");
    expect(routerSource).not.toContain("db.update(");
    expect(routerSource).not.toContain("db.delete(");
  });
});
