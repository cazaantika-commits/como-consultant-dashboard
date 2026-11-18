import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), read: vi.fn(), write: vi.fn(), owner: vi.fn(),
  decision: vi.fn(), saveDecision: vi.fn(), scores: vi.fn(), writeScores: vi.fn(),
  aggregate: vi.fn(), writeAggregate: vi.fn(), offices: vi.fn(), addOffice: vi.fn(), removeOffice: vi.fn(),
  llm: vi.fn(() => { throw new Error("LLM forbidden in isolated regression"); }),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb, getCommitteeDecision: mocks.decision, upsertCommitteeDecision: mocks.saveDecision, getProjectEvaluatorScores: mocks.scores, upsertEvaluatorScore: mocks.writeScores, getProjectEvaluationScores: mocks.aggregate, upsertEvaluationScore: mocks.writeAggregate, getProjectConsultants: mocks.offices, addConsultantToProject: mocks.addOffice, removeConsultantFromProject: mocks.removeOffice, getAiAdvisoryScores: vi.fn(), upsertAiAdvisoryScore: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./services/comoLegacyProjectAccess", () => ({ requireLegacyProjectRead: mocks.read, requireLegacyProjectWrite: mocks.write, requireLegacyProjectOwner: mocks.owner }));

import { feePercentagePoints, importedFeePercentage, storedDesignPercentage, evaluatorMatrixStatus, threeEvaluatorMatrixReady, readApprovedCostSnapshot, offerGapState, EVALUATORS, TECHNICAL_CRITERIA } from "../shared/consultantContracts";
import { requireConsultantLink, requireSessionEvaluator, assertCostReportUnlocked } from "./services/consultantAccess";
import { cpaRouter } from "./routers/cpa";
import { evaluatorScoresRouter } from "./routers/evaluatorScores";
import { committeeRouter } from "./routers/committee";
import { projectConsultantsRouter } from "./routers/projectConsultants";
import { offerReaderRouter } from "./routers/offerReader";

const user: NonNullable<TrpcContext["user"]> = { id: 1, openId: "bound", role: "admin", name: "Owner", email: null, loginMethod: "test", createdAt: "1970-01-01", updatedAt: "1970-01-01", lastSignedIn: "1970-01-01" };
const ctx: TrpcContext = { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
const dialect = new MySqlDialect();
let approved: number;
let snapshot: unknown;
let latestFee: number;
let linkedCpaId: number;
const selectedQueries: string[] = [];
const fixtures = {
  project: { id: 100, project_id: 10, description: "Original", bua_sqft: 1000, construction_cost_per_sqft: 100, duration_months: 12 },
  result: { project_consultant_id: 500, pc_id: 500, consultant_id: 7, trade_name: "Office", consultant_code: "A", design_fee_method: "PERCENTAGE", design_fee_percentage: 1.4, supervision_fee_method: "LUMP_SUM", supervision_submitted: 1, can_rank: 1, eval_rank: 1, quoted_design_fee: 1400, true_design_fee: 1400, design_scope_gap_cost: 0, quoted_supervision_fee: 500, adjusted_supervision_fee: 500, supervision_gap_cost: 0, total_true_cost: 1900 },
};
function database() {
  return {
    async execute(query: SQL) {
      const compiled = dialect.sqlToQuery(query);
      const text = compiled.sql.replace(/\s+/g, " ").trim();
      selectedQueries.push(text);
      if (!/^SELECT\b/i.test(text)) throw new Error("Only SELECT fixture execution allowed");
      if (text.includes("SELECT cpa_project_id FROM cpa_project_consultants")) return [[{ cpa_project_id: linkedCpaId }], []];
      if (text.includes("SELECT project_id FROM cpa_projects")) return [[{ project_id: 10 }], []];
      if (text.includes("FROM cpa_true_cost_report_approval")) return [[{ is_approved: approved, report_snapshot: snapshot, approved_by: "owner_binding:1", approved_at: "frozen", approval_notes: null }], []];
      if (text.includes("SELECT * FROM cpa_projects")) return [[{ ...fixtures.project, bua_sqft: 9000 }], []];
      if (text.includes("SELECT name FROM projects")) return [[{ name: "Project" }], []];
      if (text.includes("FROM project_consultant_requirement_sets")) return [[{ id: 30, title: "Scope" }], []];
      if (text.includes("FROM cpa_evaluation_results")) return [[{ ...fixtures.result, total_true_cost: latestFee }], []];
      if (text.includes("FROM consultant_offer_readings")) return [[{ id: 8, project_consultant_id: 500, project_requirement_set_id: 30, source_proposal_id: 2, input_snapshot: JSON.stringify({ requirements: [{ id: 9, label: "A" }, { id: 10, label: "B" }] }), extraction_json: "{}" }], []];
      return [[], []];
    },
    select() {
      const chain = { from() { return chain; }, where() { return chain; }, limit() { return Promise.resolve([]); }, then(resolve: (rows: unknown[]) => unknown) { return Promise.resolve([]).then(resolve); } };
      return chain;
    },
    insert() { throw new Error("INSERT forbidden"); }, update() { throw new Error("UPDATE forbidden"); }, delete() { throw new Error("DELETE forbidden"); }, transaction() { throw new Error("transaction forbidden"); },
  };
}
function cells(): { evaluatorName: string; consultantId: number; criterionId: number; score: number | null; sessionId: number | null }[] {
  return EVALUATORS.flatMap(evaluatorName => [7, 8].flatMap(consultantId => TECHNICAL_CRITERIA.map(criterionId => ({ evaluatorName, consultantId, criterionId, score: 80, sessionId: null }))));
}
const approvals = EVALUATORS.map(evaluatorName => ({ evaluatorName, isApproved: 1 }));
beforeEach(() => {
  vi.clearAllMocks(); selectedQueries.length = 0; approved = 0; latestFee = 99999; linkedCpaId = 100;
  snapshot = JSON.stringify({ results: [fixtures.result], overrides: [{ project_consultant_id: 500, total_true_cost_override: 2000 }], project: fixtures.project, approvedAt: "frozen" });
  mocks.getDb.mockResolvedValue(database()); mocks.read.mockResolvedValue({}); mocks.write.mockResolvedValue({}); mocks.owner.mockResolvedValue({}); mocks.decision.mockResolvedValue(null);
});

describe("explicit fee units", () => {
  it("fractional reader 0.014 and legacy 1.4 yield identical fee amounts", () => {
    expect(feePercentagePoints(0.014, "FRACTION")).toBeCloseTo(1.4);
    expect((feePercentagePoints(0.014, "FRACTION") ?? 0) / 100 * 100000).toBeCloseTo((feePercentagePoints(1.4) ?? 0) / 100 * 100000);
  });
  it("legacy 0.5 means 0.5%, never 50%", () => expect(importedFeePercentage(0.5, undefined)).toBe(0.5));
  it("fractional imports require a declared unit", () => expect(importedFeePercentage(0.014, "FRACTION")).toBeCloseTo(1.4));
  it.each([NaN, Infinity, -1, 101])("rejects invalid percent %s", value => expect(() => feePercentagePoints(value)).toThrow());
  it.each([1.01, -0.01, Infinity])("rejects invalid fraction %s", value => expect(() => feePercentagePoints(value, "FRACTION")).toThrow());
  it("retains explicit zero and missing as different states", () => { expect(feePercentagePoints(0)).toBe(0); expect(feePercentagePoints(null)).toBeNull(); expect(feePercentagePoints("")).toBeNull(); });
  it("rejects unknown units", () => expect(() => importedFeePercentage(0.5, "GUESS")).toThrow());
  it("converts a provenance-matched legacy reviewed fraction only", () => {
    const source = JSON.stringify({ design_fee: { method: "PERCENTAGE", percentage: 0.014 } });
    expect(storedDesignPercentage("0.0140", source)).toBeCloseTo(1.4);
    expect(storedDesignPercentage(0.5, source)).toBe(0.5);
    expect(storedDesignPercentage(1.4, source)).toBe(1.4);
    expect(storedDesignPercentage(0.014, null)).toBe(0.014);
  });
});

describe("nine cells x offices x three independent evaluators", () => {
  it("requires exact complete matrices and three approvals", () => expect(threeEvaluatorMatrixReady(cells(), [7, 8], approvals)).toBe(true));
  it("equal COUNT with a duplicate replacing a missing cell is not complete", () => { const data = cells(); data[0] = data[1]; expect(evaluatorMatrixStatus(data, [7, 8], "sheikh_issa").isComplete).toBe(false); });
  it("a missing office/criterion cannot be covered by another office", () => { const data = cells(); data[0] = { ...data[0], consultantId: 99 }; expect(threeEvaluatorMatrixReady(data, [7, 8], approvals)).toBe(false); });
  it("one evaluator approval cannot represent the other two", () => expect(threeEvaluatorMatrixReady(cells(), [7, 8], [approvals[0]])).toBe(false));
  it("duplicate approvals fail closed", () => expect(threeEvaluatorMatrixReady(cells(), [7, 8], [...approvals, approvals[0]])).toBe(false));
  it("mixed session versions cannot complete a single matrix", () => { const data = cells(); data[0] = { ...data[0], sessionId: 9 }; expect(threeEvaluatorMatrixReady(data, [7, 8], approvals)).toBe(false); });
  it("zero scores are valid, null/NaN are not", () => { const data = cells().map(cell => ({ ...cell, score: 0 })); expect(threeEvaluatorMatrixReady(data, [7, 8], approvals)).toBe(true); data[0].score = NaN; expect(threeEvaluatorMatrixReady(data, [7, 8], approvals)).toBe(false); });
  it("empty and unknown evaluator matrices never complete", () => { expect(evaluatorMatrixStatus([], [], "wael").isComplete).toBe(false); expect(evaluatorMatrixStatus(cells(), [7, 8], "outsider").isComplete).toBe(false); });
});

describe("missing evidence is not included/free", () => {
  it.each(["NOT_MENTIONED", "NOT_REVIEWED", "UNKNOWN"])("keeps %s unresolved even with a price", status => expect(offerGapState(status, 100)).toEqual({ needsGap: true, gapValue: 100, unresolved: true }));
  it("EXCLUDED with missing fee is unresolved, explicit zero differs", () => { expect(offerGapState("EXCLUDED", null).unresolved).toBe(true); expect(offerGapState("EXCLUDED", 0)).toEqual({ needsGap: true, gapValue: 0, unresolved: false }); });
  it("INCLUDED alone is covered", () => expect(offerGapState("INCLUDED", null)).toEqual({ needsGap: false, gapValue: null, unresolved: false }));
});

describe("immutable approved snapshot and scoped routers", () => {
  it("approved report reads frozen amounts, overrides and basis only, without writes", async () => {
    approved = 1;
    const report = await cpaRouter.createCaller(ctx).evaluation.getFullReport({ cpaProjectId: 100 });
    expect(report.sourceMode).toBe("APPROVED_SNAPSHOT"); expect(report.bua).toBe(1000);
    expect(report.consultants[0].calc.totalTrueCost).toBe(1900); expect(report.consultants[0].override?.totalTrueCost).toBe(2000);
    expect(selectedQueries.some(text => text.includes("FROM cpa_evaluation_results"))).toBe(false);
    expect(selectedQueries.every(text => text.startsWith("SELECT"))).toBe(true);
  });
  it("invalid approved snapshot never falls back to live computation", async () => { approved = 1; snapshot = "bad"; await expect(cpaRouter.createCaller(ctx).evaluation.getFullReport({ cpaProjectId: 100 })).rejects.toThrow("لقطة"); expect(selectedQueries.some(text => text.includes("FROM cpa_evaluation_results"))).toBe(false); });
  it("rejects duplicate snapshot source offices", () => expect(() => readApprovedCostSnapshot({ results: [fixtures.result, fixtures.result], overrides: [] })).toThrow());
  it("saved draft GET remains SELECT-only", async () => { const report = await cpaRouter.createCaller(ctx).evaluation.getFullReport({ cpaProjectId: 100 }); expect(report.sourceMode).toBe("SAVED_DRAFT"); expect(report.consultants[0].calc.totalTrueCost).toBe(latestFee); });
  it("unauthenticated request fails before DB", async () => { await expect(cpaRouter.createCaller({ ...ctx, user: null }).evaluation.getFullReport({ cpaProjectId: 100 })).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.getDb).not.toHaveBeenCalled(); });
  it("unauthorized project cannot reveal snapshot", async () => { mocks.read.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" })); await expect(cpaRouter.createCaller(ctx).evaluation.getFullReport({ cpaProjectId: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(selectedQueries.some(text => text.includes("report_approval"))).toBe(false); });
  it("link must belong to the exact CPA project", async () => { linkedCpaId = 999; await expect(requireConsultantLink(user, 500, "write", 100)).rejects.toMatchObject({ code: "FORBIDDEN" }); });
  it("locked report rejects source fee/override edits", async () => { approved = 1; await expect(assertCostReportUnlocked(100)).rejects.toMatchObject({ code: "FORBIDDEN" }); await expect(cpaRouter.createCaller(ctx).evaluation.saveOverride({ cpaProjectId: 100, projectConsultantId: 500, field: "totalTrueCost", value: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" }); });
  it("unknown assignment fails closed even for the fixed owner", async () => { await expect(requireSessionEvaluator(user, 10)).rejects.toMatchObject({ code: "FORBIDDEN" }); await expect(evaluatorScoresRouter.createCaller(ctx).upsert({ projectId: 10, consultantId: 7, criterionId: 0, evaluatorName: "sheikh_issa", score: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.writeScores).not.toHaveBeenCalled(); });
  it("read route uses authenticated actor/project, not evaluator payload", async () => { mocks.scores.mockResolvedValue([]); await evaluatorScoresRouter.createCaller(ctx).getByProject(10); expect(mocks.read).toHaveBeenCalledWith(user, 10); });
  it("committee lock rejects editing and roster changes", async () => { mocks.decision.mockResolvedValue({ isConfirmed: 1 }); await expect(committeeRouter.createCaller(ctx).upsert({ projectId: 10, justification: "rewrite" })).rejects.toMatchObject({ code: "FORBIDDEN" }); await expect(projectConsultantsRouter.createCaller(ctx).remove({ projectId: 10, consultantId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.saveDecision).not.toHaveBeenCalled(); expect(mocks.removeOffice).not.toHaveBeenCalled(); });
  it("committee approval flags cannot be smuggled through upsert", async () => { const unknownInput: unknown = { projectId: 10, isConfirmed: 0, confirmedBy: "fake" }; await expect(committeeRouter.createCaller(ctx).upsert(unknownInput as { projectId: number })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(mocks.saveDecision).not.toHaveBeenCalled(); });
  it("arbitrary admin cannot correct an approved offer source", async () => { mocks.owner.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" })); const extraction = { design_fee: { method: "PERCENTAGE" as const, amount: null, percentage: 0.014, evidence: "page 1", confidence: 100 }, coverage: [], overall_notes: "", needs_review: false }; await expect(offerReaderRouter.createCaller(ctx).saveOwnerCorrection({ readingId: 8, extraction })).rejects.toMatchObject({ code: "FORBIDDEN" }); });
  it("duplicate reviewed requirement IDs fail before any write", async () => { const item = { requirement_id: 9, requirement_label: "A", status: "INCLUDED" as const, evidence: "page 1", note: "", confidence: 100 }; const extraction = { design_fee: { method: "PERCENTAGE" as const, amount: null, percentage: 0.014, evidence: "page 1", confidence: 100 }, coverage: [item, item], overall_notes: "", needs_review: false }; await expect(offerReaderRouter.createCaller(ctx).approveForEvaluation({ readingId: 8, extraction })).rejects.toThrow("نطاق التصميم"); expect(selectedQueries.every(text => text.startsWith("SELECT"))).toBe(true); });
});
