import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MAJAN_ORIGINAL_BASELINE } from "../shared/majanBaselineSnapshot";
import type { MajanBaseline, MajanInputs, MajanModelResult } from "../shared/majanFinanceTypes";
import {
  assertMajanProjectAccess,
  buildMajanInputHash,
  MajanFinanceStore,
  MajanStoreError,
  stableJson,
  type MajanStoreDependencies,
} from "./services/majanFinanceStore";

const source = { source: "Deterministic test assumption", asOf: "2026-10-09", status: "assumption" as const };

function testInputs(caseName = "Base planning case"): MajanInputs {
  return {
    schemaVersion: 1, projectId: 1, plot: "6457956", caseName, asOf: "2026-10-09", horizonMonth: "2042-12",
    development: {
      buaSqft: 1_000_000, constructionRate: 500,
      designFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      supervisionFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      source,
    },
    leasing: [], opex: [],
    operations: {
      openingMonth: "2029-12", maintenanceCapexAnnual: 1_500_000, capexEscalationPct: 0,
      reserveAnnual: 500_000, reserveReleaseAnnual: 0, cashTaxAnnual: 0,
      taxRationale: "Pre-tax planning scenario.", otherIncomeAnnual: 0, vatMode: "excluded_net_model", source,
    },
    finance: {
      enabled: false, status: "terms_pending", structure: "istisna_forward_ijara", lender: "",
      commitment: null, financeSharePct: null, profitRatePct: null,
      drawStartMonth: "2027-04", drawEndMonth: "2029-09", repaymentStartMonth: "2029-12", repaymentMonths: null,
      repaymentMode: "level_payment", constructionProfit: "capitalise", arrangementFeePct: 0, dsraMonths: 0,
      targetDscr: null, balloonPct: 0, eligibleCategories: [], source,
    },
    notes: "Draft planning assumption; not a financing approval.",
  };
}

function model(inputs: MajanInputs): MajanModelResult {
  return {
    version: "test-model", inputHash: buildMajanInputHash(inputs, MAJAN_ORIGINAL_BASELINE), generatedAt: "2026-10-09T00:00:00.000Z",
    development: { periods: [], uses: [], rows: [], totalCost: 0, taggedPaid: 0, constructionCost: 0, designFee: 0, supervisionFee: 0, issues: [], baselineDelta: 0 },
    leasing: { months: [], issues: [], totalGla: 0, blendedRentPsf: null, floorGla: {} },
    financing: { months: [], issues: [], totalDraw: 0, totalProfit: 0, totalFees: 0, closingBalance: 0, peakOwnerFunding: 0, minDscr: null, financeComplete: true, maturityMonth: null },
    annual: [], issues: [], checks: [], sensitivity: [],
  };
}

type FakeCall = { kind: "project" | "cases" | "load" | "insertCase" | "insertRevision" | "lock" | "update" | "history" | "exists"; payload?: unknown };

/** A tiny deterministic SQL boundary: it records every operation but contains no database. */
class FakeDatabase {
  calls: FakeCall[] = [];
  cases: Array<{ id: number; caseName: string; revision: number; inputJson: string; baselineJson: string; inputHash: string; updatedBy: number; updatedAt: string }> = [];
  revisions: Array<{ caseId: number; revision: number; inputJson: string; baselineJson: string; inputHash: string; createdAt: string }> = [];
  private expected: FakeCall["kind"][] = [];

  expect(...operations: FakeCall["kind"][]) {
    this.expected.push(...operations);
  }

  async execute(_query: unknown): Promise<unknown> {
    const kind = this.expected.shift();
    if (!kind) throw new Error("Unexpected SQL operation");
    this.calls.push({ kind });
    if (kind === "project") return [[{ id: 1, userId: 7, plotNumber: "6457956" }], undefined];
    if (kind === "cases") return [this.cases.map(({ id, caseName, revision, updatedAt }) => ({ id, caseName, revision, updatedAt })), undefined];
    if (kind === "load") {
      const saved = this.cases[0];
      return saved ? [[{
        ...saved,
        projectId: 1,
        resultJson: JSON.stringify(model(testInputs("Snapshot at revision one"))),
      }], undefined] : [[], undefined];
    }
    if (kind === "insertCase") {
      const id = this.cases.length + 100;
      this.cases.push({
        id, caseName: "Base planning case", revision: 1, inputJson: JSON.stringify(testInputs()),
        baselineJson: JSON.stringify(MAJAN_ORIGINAL_BASELINE), inputHash: "placeholder", updatedBy: 7, updatedAt: "2026-10-09T03:00:00.000Z",
      });
      return [{ insertId: id }, undefined];
    }
    if (kind === "insertRevision") return [{ affectedRows: 1 }, undefined];
    if (kind === "lock") {
      const saved = this.cases[0];
      return saved ? [[{ id: saved.id, projectId: 1, revision: saved.revision, baselineJson: saved.baselineJson }], undefined] : [[], undefined];
    }
    if (kind === "update") {
      const saved = this.cases[0];
      if (saved) saved.revision += 1;
      return [{ affectedRows: 1 }, undefined];
    }
    if (kind === "history") return [this.revisions, undefined];
    return this.cases[0] ? [[{ id: this.cases[0].id }], undefined] : [[], undefined];
  }

  async transaction<T>(callback: (tx: { execute(query: unknown): Promise<unknown> }) => Promise<T>): Promise<T> {
    return callback({ execute: query => this.execute(query) });
  }
}

function storeFor(db: FakeDatabase, baseline: MajanBaseline = MAJAN_ORIGINAL_BASELINE): MajanFinanceStore {
  const dependencies: MajanStoreDependencies = {
    db,
    baseline,
    createDefaults: () => testInputs("Unsaved preview"),
    calculate: inputs => model(inputs),
    now: () => new Date("2026-10-09T03:00:00.000Z"),
  };
  return new MajanFinanceStore(dependencies);
}

describe("Majan finance persistence", () => {
  it("creates a preview without an automatic database write", async () => {
    const db = new FakeDatabase();
    db.expect("project", "cases");
    const result = await storeFor(db).loadMajanCase({ id: 7, role: "user" });

    expect(result.case).toBeNull();
    expect(result.inputs.caseName).toBe("Unsaved preview");
    expect(result.baseline).toBe(MAJAN_ORIGINAL_BASELINE);
    expect(db.calls.map(call => call.kind)).toEqual(["project", "cases"]);
  });

  it("returns the immutable result snapshot for a selected saved revision", async () => {
    const db = new FakeDatabase();
    db.cases.push({
      id: 100, caseName: "Base planning case", revision: 1, inputJson: JSON.stringify(testInputs()),
      baselineJson: JSON.stringify(MAJAN_ORIGINAL_BASELINE), inputHash: "snapshot-hash", updatedBy: 7, updatedAt: "2026-10-09T02:00:00.000Z",
    });
    db.expect("project", "cases", "load");
    const loaded = await storeFor(db).loadMajanCase({ id: 7, role: "user" }, 100);

    expect(loaded.case).toMatchObject({ id: 100, revision: 1, updatedBy: 7 });
    expect(loaded.result.version).toBe("test-model");
    expect(loaded.result.inputHash).toBe(buildMajanInputHash(testInputs("Snapshot at revision one"), MAJAN_ORIGINAL_BASELINE));
    expect(db.calls.map(call => call.kind)).toEqual(["project", "cases", "load"]);
  });

  it("creates immutable revision one and does not use a legacy project write", async () => {
    const db = new FakeDatabase();
    db.expect("project", "insertCase", "insertRevision");
    const inputs = testInputs();
    const saved = await storeFor(db).createMajanCase({ id: 7, role: "user" }, inputs);

    expect(saved).toMatchObject({ id: 100, revision: 1, updatedAt: "2026-10-09T03:00:00.000Z" });
    expect(saved.baseline.sourceHash).toBe(MAJAN_ORIGINAL_BASELINE.sourceHash);
    expect(db.calls.map(call => call.kind)).toEqual(["project", "insertCase", "insertRevision"]);
    expect(buildMajanInputHash(inputs, MAJAN_ORIGINAL_BASELINE)).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.result.inputHash).toBe(buildMajanInputHash(inputs, MAJAN_ORIGINAL_BASELINE));
  });

  it("locks a case, enforces expected revision, and appends a new immutable revision", async () => {
    const db = new FakeDatabase();
    db.cases.push({
      id: 100, caseName: "Base planning case", revision: 1, inputJson: JSON.stringify(testInputs()),
      baselineJson: JSON.stringify(MAJAN_ORIGINAL_BASELINE), inputHash: "old", updatedBy: 7, updatedAt: "2026-10-09T02:00:00.000Z",
    });
    db.expect("project", "lock", "update", "insertRevision");
    const altered = testInputs("Base planning case");
    altered.development.costOverrides = [{ rowId: MAJAN_ORIGINAL_BASELINE.rows[0]!.id, amount: 1, source }];
    const saved = await storeFor(db).updateMajanCase({ id: 7, role: "user" }, 100, 1, altered);

    expect(saved.revision).toBe(2);
    expect(saved.baseline).toEqual(MAJAN_ORIGINAL_BASELINE);
    expect(db.calls.map(call => call.kind)).toEqual(["project", "lock", "update", "insertRevision"]);

    const conflictDb = new FakeDatabase();
    conflictDb.cases.push({ ...db.cases[0]!, revision: 3 });
    conflictDb.expect("project", "lock");
    await expect(storeFor(conflictDb).updateMajanCase({ id: 7, role: "user" }, 100, 1, altered))
      .rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<MajanStoreError>);
  });

  it("restricts access to the owner or an admin and never expands scope beyond Project 1", () => {
    expect(() => assertMajanProjectAccess({ id: 8, role: "user" }, { id: 1, userId: 7, plotNumber: "6457956" }))
      .toThrow(/do not have access/);
    expect(() => assertMajanProjectAccess({ id: 7, role: "user" }, { id: 2, userId: 7, plotNumber: "6457956" }))
      .toThrow(/Project 1/);
    expect(() => assertMajanProjectAccess({ id: 99, role: "admin" }, { id: 1, userId: 7, plotNumber: "6457956" }))
      .not.toThrow();
  });

  it("hashes object keys deterministically and includes newly issued development overrides", () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
    const original = testInputs();
    const changed = testInputs();
    changed.development.startMonth = "2026-10";
    changed.development.costOverrides = [{ rowId: MAJAN_ORIGINAL_BASELINE.rows[0]!.id, amount: 1, source }];
    expect(buildMajanInputHash(changed, MAJAN_ORIGINAL_BASELINE)).not.toBe(buildMajanInputHash(original, MAJAN_ORIGINAL_BASELINE));
  });

  it("qualifies overlapping SQL columns and bundles the engines for production", () => {
    const sourceText = readFileSync(new URL("./services/majanFinanceStore.ts", import.meta.url), "utf8");
    expect(sourceText).toContain("SELECT c.id, c.projectId, c.caseName, c.revision,");
    expect(sourceText).toContain("r.resultJson");
    expect(sourceText).toContain('import { calculateMajanModel } from "../../shared/majanModel"');
    expect(sourceText).not.toContain("import(modulePath)");
  });

  it("rejects mis-scoped inputs before any storage operation", async () => {
    const db = new FakeDatabase();
    const inputs = { ...testInputs(), projectId: 2 } as unknown as MajanInputs;
    await expect(storeFor(db).createMajanCase({ id: 7, role: "user" }, inputs)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
    await expect(storeFor(db).updateMajanCase({ id: 7, role: "user" }, 100, 1, inputs)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
    expect(db.calls).toEqual([]);
  });

  it("returns database timestamps with an explicit UTC offset", async () => {
    const db = new FakeDatabase();
    db.cases.push({ id: 100, caseName: "Base planning case", revision: 1, inputJson: JSON.stringify(testInputs()), baselineJson: JSON.stringify(MAJAN_ORIGINAL_BASELINE), inputHash: "hash", updatedBy: 7, updatedAt: "2026-10-09 04:55:18" });
    db.expect("project", "cases", "load");
    const payload = await storeFor(db).loadMajanCase({ id: 7, role: "user" }, 100);
    expect(payload.case?.updatedAt).toBe("2026-10-09T04:55:18.000Z");
    expect(payload.cases[0].updatedAt).toBe("2026-10-09T04:55:18.000Z");
  });
});
