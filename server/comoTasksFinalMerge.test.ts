import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { getProjectExecutiveFile } from "./services/comoNextProjectDossier";

const projectDossierSource = readFileSync("server/services/comoNextProjectDossier.ts", "utf8");
const contractsSource = readFileSync("server/routers/contracts.ts", "utf8");
const deliverablesSource = readFileSync("server/routers/consultantProcurement.ts", "utf8");
const lifecycleSource = readFileSync("server/routers/lifecycle.ts", "utf8");
const internalMessagesSource = readFileSync("server/routers/internalMessages.ts", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const documentRouteSource = readFileSync("server/comoNextDocumentRoute.ts", "utf8");
const meetingServiceSource = readFileSync("server/services/comoNextMeetings.ts", "utf8");
const promotionSource = readFileSync("scripts/comoFollowupPromote.ts", "utf8");

function connection() {
  return mysql.createConnection(process.env.DATABASE_URL!);
}

describe("final COMO Tasks merge", () => {
  it("projects live operational sources into the executive file without writes or protected financial reads", () => {
    expect(projectDossierSource).toContain("sourceRegister");
    expect(projectDossierSource).toContain("projectContracts");
    expect(projectDossierSource).toContain("contract_deliverables");
    expect(projectDossierSource).toContain("project_consultant_requirement_sets");
    expect(projectDossierSource).toContain("designsAndPermits");
    expect(projectDossierSource).toContain("project_service_instances");
    expect(projectDossierSource).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE)\b/i);
    expect(projectDossierSource).not.toMatch(/feasibilityStudies|financialData|costs_cash_flow|competition_pricing|cf_projects|project_cash_flow_settings|wael_sales_plans|portfolio_scenarios/);
  });

  it("keeps contract and lifecycle records scoped to their real project", async () => {
    const majan = await getProjectExecutiveFile({ userId: 1, projectId: 1 });
    const contractProject = await getProjectExecutiveFile({ userId: 1, projectId: 4 });
    const villas = await getProjectExecutiveFile({ userId: 1, projectId: 6 });

    expect(majan.sourceRegister.contracts).toHaveLength(0);
    expect(contractProject.sourceRegister.contracts.map(item => item.id)).toEqual([1]);
    expect(majan.sourceRegister.consultantScope.currentRequirementSet?.id).toBe(60001);
    expect(majan.sourceRegister.consultantScope.currentRequirementSet?.status).toBe("APPROVED");
    expect(majan.sourceRegister.lifecycle.services).toHaveLength(14);
    expect(villas.sourceRegister.lifecycle.services).toHaveLength(0);
    expect(JSON.stringify(contractProject.sourceRegister)).not.toContain("fileUrl");
    expect(JSON.stringify(contractProject.sourceRegister)).not.toContain("storageUrl");
  }, 20_000);

  it("uses declared contract fields and exact deliverable project-contract guards", () => {
    expect(contractsSource).toContain("projectContracts.contractStatus");
    expect(contractsSource).toContain("contractAnalysisStatus");
    expect(contractsSource).not.toContain("projectContracts.status");
    expect(contractsSource).not.toContain("projectContracts.analysisStatus");
    expect(deliverablesSource).toContain("eq(contractDeliverables.projectId, input.projectId)");
    expect(deliverablesSource).toContain("eq(contractDeliverables.contractId, input.contractId)");
  });

  it("default-denies every unscoped lifecycle catalogue mutation", () => {
    const guardCalls = lifecycleSource.match(/rejectUnscopedCatalogueWrite\(\);/g) || [];
    expect(guardCalls.length).toBeGreaterThanOrEqual(10);
    expect(lifecycleSource).toContain("PRECONDITION_FAILED");
  });

  it("retires parallel task, agent, meeting, activity, sent-email, and command-center routes", () => {
    expect(appSource).toContain('<Route path="/tasks" component={() => <Redirect to="/como-next?tab=work-files" />} />');
    expect(appSource).toContain('<Route path="/agent-dashboard" component={() => <Redirect to="/sara" />} />');
    expect(appSource).toContain('<Route path="/command-center" component={() => <Redirect to="/sara" />} />');
    expect(appSource).toContain('<Route path="/sent-emails" component={() => <Redirect to="/como-next?tab=email" />} />');
    expect(internalMessagesSource).not.toContain("INSERT INTO tasks");
    expect(internalMessagesSource).toContain("أُلغي مسار المهام القديم");
  });

  it("keeps archived meeting documents behind the authenticated proxy", () => {
    expect(documentRouteSource).toContain("comoNextMeetingSources");
    expect(documentRouteSource).toContain("requireProjectAccess");
    expect(meetingServiceSource).toContain("sourceDocumentId");
    expect(promotionSource).toContain('updateStageTarget(connection, Number(batch.id), "meetingParticipants"');
    expect(promotionSource).toContain('updateStageTarget(connection, Number(batch.id), "meetingAgendaItems"');
  });

  it("reconciled all meeting child targets and archived exactly four historical artifacts", async () => {
    const db = await connection();
    try {
      const [unresolved] = await db.query<any[]>(`SELECT COUNT(*) AS count FROM como_next_import_rows WHERE source_table IN ('meetingParticipants','meetingAgendaItems') AND target_id IS NULL`);
      const [archived] = await db.query<any[]>(`SELECT COUNT(*) AS count, SUM(source_document_id IS NOT NULL) AS documentCount FROM como_next_meeting_sources WHERE source_system = 'como_followup_archive'`);
      const [document] = await db.query<any[]>(`SELECT storage_url AS storageUrl, source_url AS sourceUrl FROM como_next_documents WHERE source_system = 'como_followup_archive' LIMIT 1`);
      const [allDocuments] = await db.query<any[]>(`SELECT COUNT(*) AS count, SUM(storage_url = 'protected-proxy-only') AS protectedCount, SUM(source_url IS NOT NULL) AS sourceUrlCount FROM como_next_documents`);
      const [allChunks] = await db.query<any[]>(`SELECT COUNT(*) AS count, SUM(storage_url = 'protected-proxy-only') AS protectedCount FROM como_next_document_chunks`);
      expect(Number(unresolved[0].count)).toBe(0);
      expect(Number(archived[0].count)).toBe(4);
      expect(Number(archived[0].documentCount)).toBe(1);
      expect(document[0].storageUrl).toBe("protected-proxy-only");
      expect(document[0].sourceUrl).toBeNull();
      expect(Number(allDocuments[0].protectedCount)).toBe(Number(allDocuments[0].count));
      expect(Number(allDocuments[0].sourceUrlCount)).toBe(0);
      expect(Number(allChunks[0].protectedCount)).toBe(Number(allChunks[0].count));
    } finally {
      await db.end();
    }
  });
});
