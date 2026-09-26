import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import {
  approveProjectOpportunity,
  attachOpportunityDocument,
  createOpportunityWithDocument,
  getProjectOpportunity,
  reviewProjectOpportunity,
} from "./services/comoNextProjectOpening";

const migration = readFileSync("drizzle/0090_como_next_project_opening.sql", "utf8");
const projectsRouter = readFileSync("server/routers/projects.ts", "utf8");
const agentTools = readFileSync("server/agentTools.ts", "utf8");
const emailIntegration = readFileSync("server/emailIntegration.ts", "utf8");
const openingRoute = readFileSync("server/comoNextProjectOpportunityRoute.ts", "utf8");
const openingPage = readFileSync("client/src/pages/ComoNextProjectOpeningPage.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");

describe("COMO Next document-first project opening", () => {
  let connection: mysql.Connection;
  let owner: { id: number; openId: string; name: string | null; email: string | null; role: string };
  let documentId = 0;
  let opportunityId = 0;
  let projectId = 0;
  let workFileId = 0;
  let projectsBefore = 0;

  beforeAll(async () => {
    connection = await mysql.createConnection(process.env.DATABASE_URL!);
    const [rows] = await connection.query<any[]>("SELECT id, openId, name, email, role FROM users WHERE openId = ? LIMIT 1", [ENV.ownerOpenId]);
    if (!rows[0]) throw new Error("Owner user missing for project-opening test");
    owner = rows[0];
    const [counts] = await connection.query<any[]>("SELECT COUNT(*) AS count FROM projects WHERE is_test_project = 0");
    projectsBefore = Number(counts[0].count);
  });

  afterAll(async () => {
    if (!connection) return;
    try {
      if (opportunityId) await connection.query("UPDATE como_next_project_opportunities SET approved_project_id = NULL, approved_by_user_id = NULL WHERE id = ?", [opportunityId]);
      if (projectId) {
        await connection.query("DELETE FROM como_next_memory_annotations WHERE memory_id IN (SELECT id FROM como_next_work_memory WHERE project_id = ?)", [projectId]);
        await connection.query("DELETE FROM como_next_work_memory_documents WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM como_next_work_memory WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM como_next_work_file_events WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM como_next_project_dossiers WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM como_next_project_access WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM como_next_work_files WHERE project_id = ?", [projectId]);
        await connection.query("DELETE FROM projects WHERE id = ?", [projectId]);
      }
      if (opportunityId) {
        await connection.query("DELETE FROM como_next_project_opportunity_events WHERE opportunity_id = ?", [opportunityId]);
        await connection.query("DELETE FROM como_next_project_opportunity_facts WHERE opportunity_id = ?", [opportunityId]);
        await connection.query("DELETE FROM como_next_project_document_extractions WHERE opportunity_id = ?", [opportunityId]);
        await connection.query("DELETE FROM como_next_project_opportunity_documents WHERE opportunity_id = ?", [opportunityId]);
        await connection.query("DELETE FROM como_next_project_opportunities WHERE id = ?", [opportunityId]);
      }
      if (documentId) await connection.query("DELETE FROM como_next_documents WHERE id = ?", [documentId]);
    } finally {
      await connection.end();
    }
  }, 30_000);

  it("keeps migration 0090 additive and evidence bound", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_project_opportunities`");
    expect(migration).toContain("como_next_project_opportunity_documents");
    expect(migration).toContain("como_next_project_document_extractions");
    expect(migration).toContain("como_next_project_opportunity_facts");
    expect(migration).toContain("como_next_project_opportunity_events");
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+)/im);
  });

  it("blocks every runtime shortcut around the reviewed document gate", () => {
    const guard = "فتح المشروع الرسمي محصور ببوابة الوثيقة والمراجعة في COMO Next";
    expect(projectsRouter).toContain(guard);
    expect(agentTools).toContain(guard);
    expect(emailIntegration).toContain("لن ينشئ البريد مشروعًا رسميًا");
    expect(openingRoute).toContain("لا يمكن فتح فرصة مشروع دون وثيقة واحدة على الأقل");
    expect(openingRoute).toContain("protected-proxy-only");
    expect(openingRoute).not.toContain("storageUrl: url");
  });

  it("exposes a complete Arabic review flow without automatic analysis or approval", () => {
    expect(appSource).toContain('path="/como-next/project-opening"');
    expect(openingPage).toContain("لا مشروع رسمي");
    expect(openingPage).toContain("قراءة Manus");
    expect(openingPage).toContain("حفظ مراجعتي");
    expect(openingPage).toContain("اعتماد وفتح المشروع");
    expect(openingPage).not.toContain("useEffect(() => analyzeMutation");
  });

  it("creates no project before review, promotes once after explicit approval, and cleans safely", async () => {
    const digest = createHash("sha256").update(`opening-test-${randomUUID()}`).digest("hex");
    const [docResult] = await connection.query<any>(
      `INSERT INTO como_next_documents
       (title, file_name, mime_type, byte_size, sha256, storage_key, storage_url, source_system)
       VALUES (?, ?, 'text/plain', 16, ?, ?, 'protected-proxy-only', 'project_opening_test')`,
      ["وثيقة اختبار بوابة المشروع", "opening-test.txt", digest, `test/project-opening/${randomUUID()}`],
    );
    documentId = Number(docResult.insertId);

    const created = await createOpportunityWithDocument({
      user: owner as any,
      provisionalName: "مشروع اختبار بوابة الفتح",
      objective: "اختبار قابل للعكس",
      document: { id: documentId, title: "وثيقة اختبار", sha256: digest },
      documentRole: "land_document",
    });
    opportunityId = created.opportunityId;
    const replay = await attachOpportunityDocument({ user: owner as any, opportunityId, documentId, documentRole: "land_document", sha256: digest });
    expect(replay.replayed).toBe(true);

    const [beforeApproval] = await connection.query<any[]>("SELECT COUNT(*) AS count FROM projects WHERE is_test_project = 0");
    expect(Number(beforeApproval[0].count)).toBe(projectsBefore);

    const detail = await getProjectOpportunity({ user: owner as any, opportunityId });
    expect(detail.documents).toHaveLength(1);
    const reviewed = await reviewProjectOpportunity({
      user: owner as any,
      opportunityId,
      provisionalName: "مشروع اختبار بوابة الفتح",
      ownerRelationship: "owned",
      developmentStrategy: "build_for_sale",
      objective: "اختبار قابل للعكس",
      facts: [],
      manuallyReviewedDocumentIds: [detail.documents[0].id],
    });
    expect(reviewed.ready).toBe(true);

    const approved = await approveProjectOpportunity({ user: owner as any, opportunityId });
    projectId = approved.projectId;
    workFileId = approved.workFileId;
    expect(approved.replayed).toBe(false);
    const approvedReplay = await approveProjectOpportunity({ user: owner as any, opportunityId });
    expect(approvedReplay).toMatchObject({ replayed: true, projectId, workFileId });

    const [projects] = await connection.query<any[]>("SELECT name, is_test_project FROM projects WHERE id = ?", [projectId]);
    expect(projects[0]).toMatchObject({ name: "مشروع اختبار بوابة الفتح", is_test_project: 0 });
    const [files] = await connection.query<any[]>("SELECT work_file_status, source_system FROM como_next_work_files WHERE id = ? AND project_id = ?", [workFileId, projectId]);
    expect(files[0]).toMatchObject({ work_file_status: "open", source_system: "como_next_project_opportunity" });
    const [links] = await connection.query<any[]>("SELECT COUNT(*) AS count FROM como_next_work_memory_documents WHERE project_id = ? AND work_file_id = ? AND document_id = ?", [projectId, workFileId, documentId]);
    expect(Number(links[0].count)).toBe(1);
  }, 40_000);
});
