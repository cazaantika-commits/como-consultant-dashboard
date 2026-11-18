import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import type { LegacyProjectActor } from "./services/comoLegacyProjectAccess";

type FixtureRow = Map<AnyColumn, unknown>;
type Predicate = (row: FixtureRow) => boolean;
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), upsert: vi.fn(), read: vi.fn(), write: vi.fn(), ids: vi.fn(),
  llm: vi.fn(() => { throw new Error("No LLM runtime"); }),
  forbidden: vi.fn(() => { throw new Error("External/writing runtime forbidden"); }),
  predicates: new WeakMap<SQL, Predicate>(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb, upsertFinancialData: mocks.upsert, getProjectFinancialData: mocks.forbidden }));
vi.mock("./services/comoLegacyProjectAccess", () => ({
  requireLegacyProjectRead: mocks.read, requireLegacyProjectWrite: mocks.write,
  deriveAuthorizedProjectIds: mocks.ids,
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./storage", () => ({ storagePut: mocks.forbidden }));
vi.mock("./investorCashFlow", () => ({ computeProjectCapital: mocks.forbidden }));
vi.mock("./emailMonitor", () => ({ saveComoMailboxDraft: mocks.forbidden }));
vi.mock("./routers/cpa", () => ({ runCalculationEngine: mocks.forbidden }));
vi.mock("drizzle-orm", async importOriginal => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  const evaluate = (condition: SQL | undefined, row: FixtureRow) => !condition || mocks.predicates.get(condition)?.(row) === true;
  return {
    ...actual,
    eq(column: AnyColumn, value: unknown) {
      const expression = actual.eq(column, value);
      mocks.predicates.set(expression, row => row.get(column) === (row.has(value as AnyColumn) ? row.get(value as AnyColumn) : value));
      return expression;
    },
    and(...conditions: (SQL | undefined)[]) {
      const expression = actual.and(...conditions);
      if (expression) mocks.predicates.set(expression, row => conditions.every(condition => evaluate(condition, row)));
      return expression;
    },
    or(...conditions: (SQL | undefined)[]) {
      const expression = actual.or(...conditions);
      if (expression) mocks.predicates.set(expression, row => conditions.some(condition => evaluate(condition, row)));
      return expression;
    },
    inArray(column: AnyColumn, values: unknown[]) {
      const expression = actual.inArray(column, values);
      mocks.predicates.set(expression, row => values.includes(row.get(column)));
      return expression;
    },
    isNull(column: AnyColumn) {
      const expression = actual.isNull(column);
      mocks.predicates.set(expression, row => row.get(column) == null);
      return expression;
    },
  };
});
import { TRPCError } from "@trpc/server";
import { getTableColumns } from "drizzle-orm";
import {
  cfProjects, cfCostItems, feasibilityStudies, projectPhases, phaseActivities, phaseCostLinks,
  financialData, projectConsultants, cpaProjects, cpaProjectConsultants, cpaEvaluationResults, cpaTrueCostReportApproval,
} from "../drizzle/schema";
import { financialRouter } from "./routers/financial";
import { phaseManagementRouter } from "./routers/phaseManagement";
import { feasibilityRouter } from "./routers/feasibility";
import { cashFlowProgramRouter } from "./routers/cashFlowProgram";
import { requireFinanceCfProject } from "./services/financeAccess";

type Table = Parameters<typeof getTableColumns>[0];
const fixtures = new Map<Table, Record<string, unknown>[]>();
const calls: { operation: string; values: unknown }[] = [];
const owner: NonNullable<TrpcContext["user"]> = {
  id: 1, openId: "fixture", role: "user", name: null, email: null, loginMethod: null,
  createdAt: "2020-01-01", updatedAt: "2020-01-01", lastSignedIn: "2020-01-01",
};
const context = (actor: TrpcContext["user"] = owner): TrpcContext => ({
  user: actor, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
});
function fixtureDb() {
  const fixtureRows = (table: Table) => (fixtures.get(table) ?? []).map(record => new Map<AnyColumn, unknown>(
    Object.entries(getTableColumns(table)).map(([key, column]) => [column, record[key]]),
  ));
  const select = (selection?: Record<string, AnyColumn>) => {
    let rows: FixtureRow[] = [];
    let columns = selection;
    const result = () => rows.map(row => Object.fromEntries(Object.entries(columns ?? {}).map(([key, column]) => [key, row.get(column)])));
    const query = {
      from(table: Table) { rows = fixtureRows(table); columns ??= getTableColumns(table); return query; },
      where(condition: SQL | undefined) {
        if (condition && !mocks.predicates.has(condition)) throw new Error("Unsupported predicate");
        rows = rows.filter(row => !condition || mocks.predicates.get(condition)?.(row)); return query;
      },
      innerJoin(table: Table, condition: SQL) {
        rows = rows.flatMap(row => fixtureRows(table).map(other => new Map<AnyColumn, unknown>([...Array.from(row.entries()), ...Array.from(other.entries())])))
          .filter(row => mocks.predicates.get(condition)?.(row)); return query;
      },
      leftJoin(table: Table, condition: SQL) {
        rows = rows.flatMap(row => {
          const matching = fixtureRows(table).map(other => new Map<AnyColumn, unknown>([...Array.from(row.entries()), ...Array.from(other.entries())]))
            .filter(candidate => mocks.predicates.get(condition)?.(candidate));
          return matching.length ? matching : [row];
        }); return query;
      },
      orderBy() { return query; },
      async limit(count: number) { return result().slice(0, count); },
      then(resolve: (rows: Record<string, unknown>[]) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return query;
  };
  return {
    select: vi.fn(select),
    insert: vi.fn(() => ({ values: async (values: unknown) => { calls.push({ operation: "insert", values }); return [{ insertId: 100 }]; } })),
    update: vi.fn(() => ({ set: (values: unknown) => ({ where: async () => { calls.push({ operation: "update", values }); return []; } }) })),
    delete: vi.fn(() => ({ where: async () => { calls.push({ operation: "delete", values: null }); return []; } })),
    execute: vi.fn(mocks.forbidden), transaction: mocks.forbidden,
  };
}
function guard(actor: LegacyProjectActor, projectId: number, mode: "read" | "write") {
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (projectId !== 2 || actor.id === 8 || (mode === "write" && actor.id === 3)) throw new TRPCError({ code: "FORBIDDEN" });
  return { project: { id: projectId }, role: actor.id === 3 ? "viewer" : "manager" };
}
let database: ReturnType<typeof fixtureDb>;
beforeEach(() => {
  vi.clearAllMocks(); fixtures.clear(); calls.length = 0;
  fixtures.set(cfProjects, [{ id: 90002, projectId: 2 }, { id: 2, projectId: 77 }, { id: 90077, projectId: null }]);
  fixtures.set(projectPhases, Array.from({ length: 5 }, (_, index) => ({ id: 10 + index, projectId: 2, phaseNumber: index + 1, startDate: "2028-01", durationMonths: 1 })));
  fixtures.set(phaseActivities, [{ id: 100, phaseId: 10, activityNumber: 1 }, { id: 101, phaseId: 11 }]);
  fixtures.set(cfCostItems, [{ id: 200, cfProjectId: 90002, totalAmount: 100 }, { id: 201, cfProjectId: 2, totalAmount: 100 }]);
  fixtures.set(feasibilityStudies, [{ id: 300, userId: 1, projectId: 2, projectName: "Owned", updatedAt: "2028" }, { id: 301, userId: 8, projectId: 2 }, { id: 302, userId: 1, projectId: 77 }, { id: 303, userId: 1, projectId: null }]);
  fixtures.set(financialData, [{ id: 400, projectId: 2, consultantId: 500, designGapOverride: null, supervisionGapOverride: null }]);
  fixtures.set(projectConsultants, [{ id: 401, projectId: 2, consultantId: 500 }]);
  fixtures.set(cpaProjects, [{ id: 600, projectId: 2 }]);
  fixtures.set(cpaProjectConsultants, [{ id: 601, cpaProjectId: 600, consultantId: 500 }]);
  database = fixtureDb(); mocks.getDb.mockResolvedValue(database); mocks.upsert.mockResolvedValue({ ok: true });
  mocks.read.mockImplementation((actor: LegacyProjectActor, projectId: number) => guard(actor, projectId, "read"));
  mocks.write.mockImplementation((actor: LegacyProjectActor, projectId: number) => guard(actor, projectId, "write"));
  mocks.ids.mockResolvedValue([2]);
});

describe("finance first approved implementation — isolated behavior", () => {
  it("rejects anonymous callers before database work across all modified routers", async () => {
    await expect(financialRouter.createCaller(context(null)).getByProject(2)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(phaseManagementRouter.createCaller(context(null)).listActivities(10)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(feasibilityRouter.createCaller(context(null)).getById(300)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(cashFlowProgramRouter.createCaller(context(null)).listPhases(90002)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("reads saved finance without recalculation and preserves missing-source nulls", async () => {
    const result = await financialRouter.createCaller(context()).getByProject(2);
    expect(result[0]).toMatchObject({ evaluationSource: "missing_evaluation", designScopeGapCost: null, trueDesignFee: null });
    expect(database.insert).not.toHaveBeenCalled(); expect(database.update).not.toHaveBeenCalled(); expect(mocks.forbidden).not.toHaveBeenCalled();
  });
  it("preserves intentional zero override and stored evaluation source", async () => {
    fixtures.set(financialData, [{ id: 400, projectId: 2, consultantId: 500, designGapOverride: "0", supervisionGapOverride: null }]);
    fixtures.set(cpaEvaluationResults, [{ id: 700, projectConsultantId: 601, designScopeGapCost: "55", supervisionGapCost: "0", trueDesignFee: "100" }]);
    expect((await financialRouter.createCaller(context()).getByProject(2))[0]).toMatchObject({ designScopeGapCost: 0, cpaDesignGap: 55, cpaSupervisionGap: 0, evaluationSource: "saved_evaluation" });
  });
  it("blocks locked report sources before financial upsert", async () => {
    fixtures.set(cpaTrueCostReportApproval, [{ id: 1, cpaProjectId: 600, isApproved: 1 }]);
    await expect(financialRouter.createCaller(context()).upsert({ projectId: 2, consultantId: 500, designValue: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("blocks viewer, unauthorized project, unrelated office and invalid money", async () => {
    const viewer = context({ ...owner, id: 3 });
    await expect(financialRouter.createCaller(viewer).upsert({ projectId: 2, consultantId: 500 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(financialRouter.createCaller(context()).upsert({ projectId: 77, consultantId: 500 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(financialRouter.createCaller(context()).upsert({ projectId: 2, consultantId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const designValue of [-1, Infinity, NaN]) await expect(financialRouter.createCaller(context()).upsert({ projectId: 2, consultantId: 500, designValue })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("passes decimal fields with contract types, preserving zero and null", async () => {
    await financialRouter.createCaller(context()).upsert({ projectId: 2, consultantId: 500, designValue: 0, supervisionValue: 5.5, designGapOverride: null });
    expect(mocks.upsert).toHaveBeenCalledWith(2, 500, { designValue: "0", supervisionValue: "5.5", designGapOverride: null });
  });
  it("lists owned studies in authorized projects plus owned unlinked studies only", async () => {
    expect((await feasibilityRouter.createCaller(context()).list()).map(study => study.id)).toEqual([300, 303]);
    expect((await feasibilityRouter.createCaller(context()).listByProject(2)).map(study => study.id)).toEqual([300]);
  });
  it("rejects foreign and unknown study IDs, even when the project is shared", async () => {
    for (const id of [301, 302, 999]) await expect(feasibilityRouter.createCaller(context()).getById(id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await feasibilityRouter.createCaller(context()).getById(303)).id).toBe(303);
  });
  it("checks ownership before every AI, duplicate and delete branch", async () => {
    const caller = feasibilityRouter.createCaller(context());
    for (const operation of [() => caller.generateAiSummary(301), () => caller.generateMarketAnalysis({ studyId: 301, community: "x" }), () => caller.generateComprehensiveReport({ id: 301 }), () => caller.generateExecutiveReport({ id: 301 }), () => caller.duplicateAsScenario({ studyId: 301, scenarioName: "x" }), () => caller.delete(301)]) {
      await expect(operation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mocks.llm).not.toHaveBeenCalled(); expect(calls).toEqual([]);
  });
  it("does not let an update retarget the pinned study relation", async () => {
    await expect(feasibilityRouter.createCaller(context()).update({ id: 300, projectId: 77 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toEqual([]);
  });
  it("resolves five canonical phases from cf_projects.projectId, not a number heuristic", async () => {
    const phases = await cashFlowProgramRouter.createCaller(context()).listPhases(90002);
    expect(phases.map(phase => phase.phaseNumber)).toEqual([1, 2, 3, 4, 5]);
    await expect(requireFinanceCfProject(owner, 2, "read")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireFinanceCfProject(owner, 90077, "read")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toEqual([]);
  });
  it("creates a phase only under the resolved canonical ID in mocked storage", async () => {
    await cashFlowProgramRouter.createCaller(context()).createPhase({ cfProjectId: 90002, phaseName: "Next", startDate: "2028-01", durationMonths: 1 });
    expect(calls[0]?.values).toMatchObject({ projectId: 2 });
  });
  it("rejects an unscoped link listing and combines phase/activity predicates", async () => {
    const caller = phaseManagementRouter.createCaller(context());
    await expect(caller.getPhaseLinkedCosts({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.getPhaseLinkedCosts({ phaseId: 10, activityId: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    fixtures.set(phaseCostLinks, [{ id: 1, phaseId: 10, activityId: 100 }, { id: 2, phaseId: 10, activityId: 101 }, { id: 3, phaseId: 11, activityId: 100 }]);
    expect((await caller.getPhaseLinkedCosts({ phaseId: 10, activityId: 100 })).map(link => link.id)).toEqual([1]);
  });
  it("rejects cross-project costs, wrong activity, duplicates and over-allocation before insert", async () => {
    const caller = phaseManagementRouter.createCaller(context());
    const input = { phaseId: 10, costItemId: 200, allocatedAmount: 40, startMonth: "2028-01", endMonth: "2028-02" };
    await expect(caller.linkCostToPhase({ ...input, costItemId: 201 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.linkCostToPhase({ ...input, activityId: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    fixtures.set(phaseCostLinks, [{ id: 1, phaseId: 10, activityId: null, costItemId: 200, allocatedAmount: "20" }]);
    await expect(caller.linkCostToPhase(input)).rejects.toMatchObject({ code: "CONFLICT" });
    fixtures.set(phaseCostLinks, [{ id: 1, phaseId: 11, activityId: null, costItemId: 200, allocatedAmount: "80" }]);
    await expect(caller.linkCostToPhase(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toEqual([]);
  });
  it("accepts exact remaining allocation without changing source amount", async () => {
    fixtures.set(phaseCostLinks, [{ id: 1, phaseId: 11, activityId: null, costItemId: 200, allocatedAmount: "60" }]);
    await phaseManagementRouter.createCaller(context()).linkCostToPhase({ phaseId: 10, costItemId: 200, allocatedAmount: 40, startMonth: "2028-01", endMonth: "2028-02", allocationPercentage: 0 });
    expect(calls[0]?.values).toMatchObject({ allocatedAmount: "40", allocationPercentage: "0" });
    expect(fixtures.get(cfCostItems)?.[0]?.totalAmount).toBe(100);
  });
  it("blocks viewer activity writes and unknown activities or links", async () => {
    await expect(phaseManagementRouter.createCaller(context({ ...owner, id: 3 })).updateActivity({ id: 100, progress: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(phaseManagementRouter.createCaller(context()).deleteActivity(999)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(phaseManagementRouter.createCaller(context()).unlinkCostFromPhase(999)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toEqual([]); expect(mocks.forbidden).not.toHaveBeenCalled();
  });
});
