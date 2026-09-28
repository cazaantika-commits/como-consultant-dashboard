import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { waelSalesPlanRouter } from "./waelSalesPlan";
import { getSavedProjectUnitCount, rebuildOffPlanSalesResultsFromPaymentPlan } from "../../client/src/lib/salesPlanCashFlow";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../../client/src/lib/salesPlanCashFlow", () => ({
  getSavedProjectUnitCount: vi.fn(() => 83),
  rebuildOffPlanSalesResultsFromPaymentPlan: vi.fn(() => ({
    salesAbsorptionJson: "rebuilt-absorption",
    resultsJson: "rebuilt-results",
  })),
}));

const mockedGetDb = vi.mocked(getDb);
const mockedRebuild = vi.mocked(rebuildOffPlanSalesResultsFromPaymentPlan);

function createCaller() {
  return waelSalesPlanRouter.createCaller({
    user: { id: 91 },
  } as any);
}

function queuedSelect(...responses: any[][]) {
  const queue = [...responses];
  return vi.fn().mockImplementation(() => {
    const rows = queue.shift() || [];
    const chain: any = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue(rows);
    chain.then = (resolve: (value: any[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject);
    return chain;
  });
}

describe("waelSalesPlan.save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new plan with all required defaults and saved financial JSON", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 73 }]);
    mockedGetDb.mockResolvedValue({
      select: queuedSelect([{ id: 2 }]),
      insert: vi.fn().mockReturnValue({ values }),
    } as any);

    const result = await createCaller().save({
      projectId: 2,
      totalRevenue: 804_600_000,
      salesCommissionPct: "5",
      salesAbsorptionJson: "{\"manual\":[7,8,9]}",
      paymentPlanJson: "{\"downPct\":10,\"secondPct\":10,\"secondAfterMonths\":1,\"duringTotalPct\":40,\"installmentEveryMonths\":6,\"handoverPct\":40}",
      resultsJson: "{\"actualCashInflow\":[0,2200000]}",
    });

    expect(result).toEqual({ id: 73, action: "created" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 2,
      userId: 91,
      name: "السيناريو الافتراضي",
      status: "draft",
      t03: 3,
      t04: 0,
      t05: 5,
      t06: 3,
      designMonths: 8,
      constructionMonths: 30,
      postCompletionMonths: 12,
      offplanPct: 80,
      salesCommissionPct: "5",
      paymentPlanJson: "{\"downPct\":10,\"secondPct\":10,\"secondAfterMonths\":1,\"duringTotalPct\":40,\"installmentEveryMonths\":6,\"handoverPct\":40}",
      resultsJson: "{\"actualCashInflow\":[0,2200000]}",
    }));
  });

  it("updates the existing plan instead of creating another record", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockedGetDb.mockResolvedValue({
      select: queuedSelect(
        [{ id: 2 }],
        [{ id: 73, projectId: 2, userId: 91, status: "draft" }],
        [{ id: 2 }],
      ),
      update: vi.fn().mockReturnValue({ set }),
    } as any);

    const result = await createCaller().save({
      id: 73,
      projectId: 2,
      offplanPct: 75,
      paymentPlanJson: "{\"downPct\":20,\"secondPct\":0,\"secondAfterMonths\":0,\"duringTotalPct\":40,\"installmentEveryMonths\":3,\"handoverPct\":40}",
      resultsJson: "{\"actualCashInflow\":[0,2500000]}",
    });

    expect(result).toEqual({ id: 73, action: "updated" });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 2,
      userId: 91,
      offplanPct: 75,
      paymentPlanJson: "{\"downPct\":20,\"secondPct\":0,\"secondAfterMonths\":0,\"duringTotalPct\":40,\"installmentEveryMonths\":3,\"handoverPct\":40}",
      resultsJson: "{\"actualCashInflow\":[0,2500000]}",
    }));
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("saves pricing and the approved cash-flow scenario through one workspace operation", async () => {
    const projectWhere = vi.fn().mockResolvedValue(undefined);
    const projectSet = vi.fn().mockReturnValue({ where: projectWhere });
    const planWhere = vi.fn().mockResolvedValue(undefined);
    const planSet = vi.fn().mockReturnValue({ where: planWhere });
    mockedGetDb.mockResolvedValue({
      select: queuedSelect(
        [{ id: 2 }],
        [{ id: 73, projectId: 2, userId: 91, status: "draft" }],
        [{ id: 2 }],
      ),
      update: vi.fn()
        .mockReturnValueOnce({ set: projectSet })
        .mockReturnValueOnce({ set: planSet }),
    } as any);

    const result = await createCaller().saveWorkspace({
      planId: 73,
      projectId: 2,
      pricing: {
        studioPrice: 1450,
        residential1brPrice: 1700,
        residential2brMaidPrice: 1625,
        residential3brMaidPrice: 1850,
        villaPrice: 2400,
      },
      marketingPct: 2,
      salesCommissionPct: 5,
      totalRevenue: 804_600_000,
      offplanPct: 80,
      designMonths: 8,
      constructionMonths: 30,
      salesAbsorptionJson: "{\"manual\":[7,8,9],\"marketingActualStart\":6}",
      marketingDistJson: "{\"digital\":[250000,250000]}",
      channelsJson: "{\"digital\":35}",
      paymentPlanJson: "{\"downPct\":10,\"handoverPct\":40}",
      resultsJson: "{\"actualCashInflow\":[2200000],\"actualCashInflowVersion\":2}",
    });

    expect(result).toEqual({ id: 73, action: "updated" });
    expect(projectSet).toHaveBeenCalledWith(expect.objectContaining({
      residential1brPrice: 1700,
      studioPrice: 1450,
      residential2brMaidPrice: 1625,
      residential3brMaidPrice: 1850,
      villaPrice: 2400,
      marketingPct: "2",
      salesCommissionPct: "5",
    }));
    expect(planSet).toHaveBeenCalledWith(expect.objectContaining({
      totalRevenue: 804_600_000,
      salesAbsorptionJson: "{\"manual\":[7,8,9],\"marketingActualStart\":6}",
      marketingDistJson: "{\"digital\":[250000,250000]}",
      resultsJson: "{\"actualCashInflow\":[2200000],\"actualCashInflowVersion\":2}",
    }));
  });

  it("rebuilds receipt results and returns the scenario to draft when the payment calendar changes", async () => {
    const select = queuedSelect(
      [{ id: 73, projectId: 2, userId: 91, status: "draft", totalRevenue: 152_377_100, offplanPct: 100, salesAbsorptionJson: "{}", resultsJson: "stale" }],
      [{ id: 2 }],
      [{ id: 2, userId: 91, financingScenario: "offplan_escrow" }],
    );
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockedGetDb.mockResolvedValue({
      select,
      update: vi.fn().mockReturnValue({ set }),
    } as any);

    const result = await createCaller().savePaymentCalendar({
      planId: 73,
      projectId: 2,
      paymentPlanJson: '{"version":2,"calendarEntries":[{"id":"booking"}]}',
    });

    expect(result).toEqual({ id: 73, action: "updated", resultsRebuilt: true, requiresApproval: true });
    expect(set).toHaveBeenCalledWith({
      paymentPlanJson: '{"version":2,"calendarEntries":[{"id":"booking"}]}',
      salesAbsorptionJson: "rebuilt-absorption",
      resultsJson: "rebuilt-results",
      offplanPct: 100,
      status: "draft",
    });
    expect(mockedRebuild).toHaveBeenCalledTimes(1);
    expect(getSavedProjectUnitCount).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("creates a minimal draft when the project has no prior sales scenario", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 88 }]);
    mockedGetDb.mockResolvedValue({
      select: queuedSelect([{ id: 2 }]),
      insert: vi.fn().mockReturnValue({ values }),
    } as any);

    const result = await createCaller().savePaymentCalendar({
      projectId: 2,
      paymentPlanJson: '{"version":2,"calendarEntries":[{"id":"booking"}]}',
    });

    expect(result).toEqual({ id: 88, action: "created", resultsRebuilt: false, requiresApproval: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 2,
      userId: 91,
      name: "خطة سداد المشترين",
      status: "draft",
    }));
  });

  it("returns only the latest approved plan as the official report source", async () => {
    const approved = { id: 70, projectId: 2, userId: 91, status: "approved" };
    mockedGetDb.mockResolvedValue({
      select: queuedSelect([{ id: 2 }], [approved]),
    } as any);

    await expect(createCaller().getApprovedByProject({ projectId: 2 })).resolves.toEqual(approved);
  });

  it("rejects reading plans for a project outside the current user's ownership", async () => {
    mockedGetDb.mockResolvedValue({
      select: queuedSelect([]),
    } as any);

    await expect(createCaller().getByProject({ projectId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("forks an approved payment plan into a draft and preserves the official row", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 89 }]);
    const approvedPlan = {
      id: 73,
      projectId: 2,
      userId: 91,
      name: "سيناريو وائل المعتمد",
      status: "approved",
      t12Date: null,
      t03: 3,
      t04: 0,
      t05: 5,
      t06: 3,
      designMonths: 8,
      constructionMonths: 30,
      postCompletionMonths: 12,
      totalRevenue: 152_377_100,
      offplanPct: 100,
      marketingBudgetPct: "2.00",
      salesCommissionPct: "5.00",
      salesAbsorptionJson: "{}",
      marketingDistJson: "{}",
      channelsJson: "{}",
      paymentPlanJson: "old",
      resultsJson: "stale",
    };
    mockedGetDb.mockResolvedValue({
      select: queuedSelect(
        [approvedPlan],
        [{ id: 2 }],
        [{ id: 2, userId: 91, financingScenario: "offplan_escrow" }],
      ),
      insert: vi.fn().mockReturnValue({ values }),
      update: vi.fn(),
    } as any);

    const result = await createCaller().savePaymentCalendar({
      planId: 73,
      projectId: 2,
      paymentPlanJson: '{"version":2,"calendarEntries":[{"id":"booking"}]}',
    });

    expect(result).toEqual({ id: 89, action: "created", resultsRebuilt: true, requiresApproval: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 2,
      status: "draft",
      paymentPlanJson: '{"version":2,"calendarEntries":[{"id":"booking"}]}',
      salesAbsorptionJson: "rebuilt-absorption",
      resultsJson: "rebuilt-results",
    }));
  });
});
