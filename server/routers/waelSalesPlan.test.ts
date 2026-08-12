import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { waelSalesPlanRouter } from "./waelSalesPlan";

vi.mock("../db", () => ({ getDb: vi.fn() }));

const mockedGetDb = vi.mocked(getDb);

function createCaller() {
  return waelSalesPlanRouter.createCaller({
    user: { id: 91 },
  } as any);
}

describe("waelSalesPlan.save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new plan with all required defaults and saved financial JSON", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 73 }]);
    mockedGetDb.mockResolvedValue({
      insert: vi.fn().mockReturnValue({ values }),
    } as any);

    const result = await createCaller().save({
      projectId: 2,
      totalRevenue: 804_600_000,
      salesCommissionPct: "5",
      salesAbsorptionJson: "{\"manual\":[7,8,9]}",
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
      resultsJson: "{\"actualCashInflow\":[0,2200000]}",
    }));
  });

  it("updates the existing plan instead of creating another record", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockedGetDb.mockResolvedValue({
      update: vi.fn().mockReturnValue({ set }),
    } as any);

    const result = await createCaller().save({
      id: 73,
      projectId: 2,
      offplanPct: 75,
      resultsJson: "{\"actualCashInflow\":[0,2500000]}",
    });

    expect(result).toEqual({ id: 73, action: "updated" });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 2,
      userId: 91,
      offplanPct: 75,
      resultsJson: "{\"actualCashInflow\":[0,2500000]}",
    }));
    expect(where).toHaveBeenCalledTimes(1);
  });
});
