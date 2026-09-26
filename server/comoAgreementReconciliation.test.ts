import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    id: "specialist-test",
    created: Date.now(),
    model: "claude-sonnet-4-6",
    choices: [{
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content: JSON.stringify({
          executiveSummary: "مسودة اختبار موثقة لا يترتب عليها تنفيذ.",
          riskLevel: "attention",
          facts: [{ statement: "يوجد ملف عمل مرتبط بالمشروع.", evidenceRef: "work_file:test", confidence: "high" }],
          findings: [{ title: "متابعة مطلوبة", detail: "ملاحظة اختبارية مرتبطة بالدليل.", severity: "attention", evidenceRefs: ["work_file:test"] }],
          openQuestions: [{ question: "ما الموعد المعتمد؟", whyItMatters: "لأن المصدر لا يحسمه." }],
          proposedNextSteps: [{ title: "مراجعة الموعد", description: "مقترح فقط.", kind: "action", priority: "normal", ownerType: "human", acceptanceCriteria: null, evidenceRefs: ["work_file:test"] }],
        }),
      },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })),
}));

import { ENV } from "./_core/env";
import {
  assertSpecialistDraftBoundary,
  assertSpecialistOwner,
  reviewSpecialistDraftCommand,
  runSpecialistReviewCommand,
} from "./services/comoNextSpecialists";

const files = {
  app: readFileSync("client/src/App.tsx", "utf8"),
  home: readFileSync("client/src/pages/Home.tsx", "utf8"),
  tour: readFileSync("client/src/pages/DevelopmentPhasesPage.tsx", "utf8"),
  lifecycle: readFileSync("client/src/pages/ProjectLifecyclePage.tsx", "utf8"),
  consultant: readFileSync("client/src/pages/ConsultantPortalPage.tsx", "utf8"),
  specialists: readFileSync("client/src/components/ComoNextSpecialistDesks.tsx", "utf8"),
  specialistService: readFileSync("server/services/comoNextSpecialists.ts", "utf8"),
  agents: readFileSync("server/routers/agents.ts", "utf8"),
  meetings: readFileSync("server/routers/meetings.ts", "utf8"),
  sentEmails: readFileSync("server/routers/sentEmails.ts", "utf8"),
  contracts: readFileSync("server/routers/contracts.ts", "utf8"),
  joelle: readFileSync("server/routers/joelleEngine.ts", "utf8"),
  migration: readFileSync("drizzle/0089_como_next_specialist_capabilities.sql", "utf8"),
};

function count(source: string, token: string) {
  return source.split(token).length - 1;
}

let connection: mysql.Connection | null = null;
async function db() {
  if (!connection) connection = await mysql.createConnection(process.env.DATABASE_URL!);
  return connection;
}

afterAll(async () => { await connection?.end(); });

describe("COMO agreement reconciliation", () => {
  it("restores the protected development tour and technical evaluation routes", () => {
    expect(files.home).toContain('title: "جولة مراحل التطوير"');
    expect(files.home).toContain('path: "/development-phases"');
    expect(files.app).toContain('<Route path="/development-phases" component={DevelopmentPhasesPage} />');
    expect(files.app).toContain('<Route path="/project-lifecycle" component={ProjectLifecyclePage} />');
    expect(files.app).toContain('<Route path="/consultant-evaluation" component={ConsultantEvaluationPage} />');
    expect(files.consultant).toContain('href: "/consultant-evaluation"');
    expect(files.tour).toContain("projectId");
    expect(files.lifecycle).toContain("URLSearchParams");
    expect(files.tour).not.toContain("قيد الإعداد");
  });

  it("default-denies every legacy named-agent and meeting mutation", () => {
    expect(count(files.agents, ".mutation(")).toBe(count(files.agents, "rejectLegacyAgentMutation();"));
    expect(count(files.meetings, ".mutation(")).toBe(count(files.meetings, "rejectLegacyMeetingMutation();"));
    expect(files.sentEmails).toContain("rejectLegacyOutboundEmail();");
    expect(files.contracts).toContain("rejectLegacyContractAnalysis();");
    expect(files.joelle).toContain("rejectUngovernedFeasibilityWrite();");
  });

  it("defines exactly the two approved specialists as on-demand review-only capabilities", async () => {
    const c = await db();
    const [rows] = await c.query<any[]>("SELECT capability_code, operating_mode, authority_mode, is_enabled FROM como_next_specialist_capabilities ORDER BY capability_code");
    expect(rows).toEqual([
      { capability_code: "contract_manager", operating_mode: "on_demand_only", authority_mode: "draft_review_only", is_enabled: 1 },
      { capability_code: "project_monitor", operating_mode: "on_demand_only", authority_mode: "draft_review_only", is_enabled: 1 },
    ]);
    expect(files.specialists).toContain("إعداد مسودة مراجعة");
    expect(files.specialists).toContain("لا مراقبة في الخلفية");
    expect(files.specialistService).not.toContain("setInterval(");
    expect(files.specialistService).not.toContain("sendMail(");
    expect(files.specialistService).not.toContain("storagePut(");
  });

  it("rejects non-owner specialist use and enforces the draft-only invariant", () => {
    expect(() => assertSpecialistOwner({ openId: "not-owner", role: "admin" })).toThrow(/عبد الرحمن فقط/);
    expect(() => assertSpecialistDraftBoundary({ reviewStatus: "reviewed", operationalRecordsCreated: 0, externalSideEffect: false })).toThrow();
    expect(() => assertSpecialistDraftBoundary({ reviewStatus: "draft", operationalRecordsCreated: 1, externalSideEffect: false })).toThrow();
    expect(() => assertSpecialistDraftBoundary({ reviewStatus: "draft", operationalRecordsCreated: 0, externalSideEffect: true })).toThrow();
    expect(() => assertSpecialistDraftBoundary({ reviewStatus: "draft", operationalRecordsCreated: 0, externalSideEffect: false })).not.toThrow();
  });

  it("creates one evidence-bound specialist draft, replays idempotently, and creates no operational record", async () => {
    const c = await db();
    const [[owner]] = await c.query<any[]>("SELECT id, openId, role FROM users WHERE openId = ? AND role = 'admin' LIMIT 1", [ENV.ownerOpenId]);
    expect(owner).toBeTruthy();
    const [[target]] = await c.query<any[]>("SELECT wf.id AS workFileId, wf.project_id AS projectId FROM como_next_work_files wf JOIN projects p ON p.id = wf.project_id WHERE p.userId = ? AND p.is_test_project = 0 ORDER BY wf.id LIMIT 1", [owner.id]);
    expect(target).toBeTruthy();
    const tables = ["como_next_actions", "como_next_decisions", "como_next_communications", "como_next_meetings"];
    const before: Record<string, number> = {};
    for (const table of tables) {
      const [[row]] = await c.query<any[]>(`SELECT COUNT(*) AS count FROM ${table}`);
      before[table] = Number(row.count);
    }
    const requestKey = `specialist:test:${Date.now()}`;
    let reviewId = 0;
    try {
      const first = await runSpecialistReviewCommand({
        user: owner,
        projectId: Number(target.projectId),
        workFileId: Number(target.workFileId),
        capabilityCode: "project_monitor",
        requestText: "اختبار محكوم لمسودة مراقب المشروع من السياق الحالي فقط.",
        requestKey,
      });
      reviewId = first.id;
      expect(first).toMatchObject({ replayed: false, status: "draft", operationalRecordsCreated: 0, externalSideEffect: false });
      const replay = await runSpecialistReviewCommand({
        user: owner,
        projectId: Number(target.projectId),
        workFileId: Number(target.workFileId),
        capabilityCode: "project_monitor",
        requestText: "اختبار محكوم لمسودة مراقب المشروع من السياق الحالي فقط.",
        requestKey,
      });
      expect(replay).toMatchObject({ id: reviewId, replayed: true, status: "draft" });
      const reviewed = await reviewSpecialistDraftCommand({ user: owner, reviewId, decision: "reviewed", reviewNote: "مراجعة اختبارية" });
      expect(reviewed).toMatchObject({ status: "reviewed", operationalRecordsCreated: 0, externalSideEffect: false });
      const replayReview = await reviewSpecialistDraftCommand({ user: owner, reviewId, decision: "reviewed" });
      expect(replayReview).toMatchObject({ replayed: true, status: "reviewed", externalSideEffect: false });
      for (const table of tables) {
        const [[row]] = await c.query<any[]>(`SELECT COUNT(*) AS count FROM ${table}`);
        expect(Number(row.count), table).toBe(before[table]);
      }
      const [[stored]] = await c.query<any[]>("SELECT review_status, context_sha256, output_json FROM como_next_specialist_reviews WHERE id = ?", [reviewId]);
      expect(stored.review_status).toBe("reviewed");
      expect(stored.context_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.parse(stored.output_json).proposedNextSteps).toHaveLength(1);
    } finally {
      if (reviewId) {
        await c.query("DELETE FROM como_next_work_file_events WHERE idempotency_key IN (?, ?)", [`event:specialist-review:${reviewId}`, `event:specialist-review-decision:${reviewId}`]);
        await c.query("DELETE FROM como_next_specialist_reviews WHERE id = ?", [reviewId]);
      }
      await c.query("DELETE FROM como_next_specialist_reviews WHERE request_key = ?", [requestKey]);
    }
  }, 30_000);

  it("keeps migration 0089 additive-only", () => {
    expect(files.migration).toContain("CREATE TABLE IF NOT EXISTS como_next_specialist_capabilities");
    expect(files.migration).toContain("CREATE TABLE IF NOT EXISTS como_next_specialist_reviews");
    expect(files.migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
  });
});
