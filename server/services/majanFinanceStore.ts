import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { MAJAN_ORIGINAL_BASELINE } from "../../shared/majanBaselineSnapshot";
import { calculateMajanModel } from "../../shared/majanModel";
import { createDefaultMajanInputs } from "../../shared/majanDefaults";
import type {
  MajanBaseline,
  MajanInputs,
  MajanModelResult,
  SavedMajanCase,
} from "../../shared/majanFinanceTypes";

/** The Majan workspace is deliberately confined to the approved project and plot. */
export const MAJAN_PROJECT_ID = 1 as const;
export const MAJAN_PLOT = "6457956" as const;

export type MajanActor = { id: number; role: "admin" | "user" };

type SqlExecutor = {
  execute(query: unknown): Promise<unknown>;
};

type TransactionalSqlExecutor = SqlExecutor & {
  transaction?<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T>;
};

type ModelCalculator = (inputs: MajanInputs, baseline: MajanBaseline) => MajanModelResult | Promise<MajanModelResult>;
type DefaultInputsFactory = (baseline: MajanBaseline) => MajanInputs | Promise<MajanInputs>;

export type MajanCaseSummary = {
  id: number;
  caseName: string;
  revision: number;
  updatedAt: string;
};

export type MajanCaseHistory = {
  revision: number;
  createdAt: string;
  inputHash: string;
  inputs: MajanInputs;
};

export type MajanLoadPayload = {
  case: SavedMajanCase | null;
  inputs: MajanInputs;
  baseline: MajanBaseline;
  result: MajanModelResult;
  cases: MajanCaseSummary[];
};

export type MajanSavePayload = {
  id: number;
  revision: number;
  inputs: MajanInputs;
  baseline: MajanBaseline;
  result: MajanModelResult;
  updatedAt: string;
};

export type MajanStoreDependencies = {
  /** Test seam only; production resolves the configured Drizzle database lazily. */
  db?: TransactionalSqlExecutor | null;
  getDb?: () => Promise<TransactionalSqlExecutor | null>;
  baseline?: MajanBaseline;
  calculate?: ModelCalculator;
  createDefaults?: DefaultInputsFactory;
  now?: () => Date;
};

export type MajanStoreErrorCode =
  | "DATABASE_UNAVAILABLE"
  | "INVALID_SCOPE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CORRUPT_SNAPSHOT";

export class MajanStoreError extends Error {
  constructor(
    public readonly code: MajanStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MajanStoreError";
  }
}

/** Stable JSON canonicalisation avoids object-key order changing a scenario hash. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function sha256Snapshot(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

export function buildMajanInputHash(inputs: MajanInputs, baseline: MajanBaseline): string {
  return sha256Snapshot({
    baselineId: baseline.id,
    baselineSourceHash: baseline.sourceHash,
    inputs,
  });
}

export function assertMajanProjectScope(projectId: number): asserts projectId is typeof MAJAN_PROJECT_ID {
  if (projectId !== MAJAN_PROJECT_ID) {
    throw new MajanStoreError("INVALID_SCOPE", "Majan finance is available only for Project 1, Plot 6457956.");
  }
}

/** Pure guard used by the store and deterministic tests; admins are still limited to Project 1. */
export function assertMajanProjectAccess(
  actor: MajanActor,
  project: { id: number; userId: number; plotNumber?: string | null },
): void {
  assertMajanProjectScope(project.id);
  if (project.plotNumber != null && project.plotNumber !== MAJAN_PLOT) {
    throw new MajanStoreError("INVALID_SCOPE", "Project 1 does not match the approved Majan plot.");
  }
  if (actor.role !== "admin" && actor.id !== project.userId) {
    throw new MajanStoreError("FORBIDDEN", "You do not have access to the Majan finance scenarios.");
  }
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

function firstInsertId(result: unknown): number | null {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (candidate && typeof candidate === "object") {
    const value = (candidate as { insertId?: unknown }).insertId;
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return null;
}

function readString(row: Record<string, unknown>, camel: string, snake = camel): string | null {
  const value = row[camel] ?? row[snake];
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function readNumber(row: Record<string, unknown>, camel: string, snake = camel): number | null {
  const value = row[camel] ?? row[snake];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function readUtcTimestamp(row: Record<string, unknown>, key: string, alternate: string): string | null {
  const raw = row[key] ?? row[alternate];
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw !== "string") return null;
  const explicit = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw) ? raw.replace(" ", "T") + "Z" : raw;
  const date = new Date(explicit);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function assertInputScope(inputs: MajanInputs): void {
  if (inputs.projectId !== MAJAN_PROJECT_ID || inputs.plot !== MAJAN_PLOT) {
    throw new MajanStoreError("INVALID_SCOPE", "Inputs must belong to Project 1, Plot 6457956.");
  }
}

function parseSnapshot<T>(raw: string | null, label: string): T {
  if (!raw) throw new MajanStoreError("CORRUPT_SNAPSHOT", `Saved Majan ${label} snapshot is missing.`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new MajanStoreError("CORRUPT_SNAPSHOT", `Saved Majan ${label} snapshot is invalid.`);
  }
}

async function defaultCalculator(inputs: MajanInputs, baseline: MajanBaseline): Promise<MajanModelResult> {
  return calculateMajanModel(inputs, baseline);
}

async function defaultInputsFactory(baseline: MajanBaseline): Promise<MajanInputs> {
  return createDefaultMajanInputs(baseline);
}

type CaseRow = Record<string, unknown>;

/**
 * Additive persistence only. It never updates legacy project, cash-flow, or cost tables.
 * Every save writes an immutable input/result revision after locking the current case row.
 */
export class MajanFinanceStore {
  private readonly baseline: MajanBaseline;
  private readonly calculate: ModelCalculator;
  private readonly createDefaults: DefaultInputsFactory;
  private readonly now: () => Date;

  constructor(private readonly dependencies: MajanStoreDependencies = {}) {
    this.baseline = dependencies.baseline ?? MAJAN_ORIGINAL_BASELINE;
    this.calculate = dependencies.calculate ?? defaultCalculator;
    this.createDefaults = dependencies.createDefaults ?? defaultInputsFactory;
    this.now = dependencies.now ?? (() => new Date());
  }

  private async database(): Promise<TransactionalSqlExecutor> {
    const db = this.dependencies.db !== undefined
      ? this.dependencies.db
      : await (this.dependencies.getDb ?? (getDb as unknown as () => Promise<TransactionalSqlExecutor | null>))();
    if (!db) throw new MajanStoreError("DATABASE_UNAVAILABLE", "Majan scenario storage is unavailable because the database is not configured.");
    return db;
  }

  private async withTransaction<T>(db: TransactionalSqlExecutor, operation: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (!db.transaction) {
      throw new MajanStoreError("DATABASE_UNAVAILABLE", "Majan scenario storage requires database transactions.");
    }
    return db.transaction(operation);
  }

  private async assertAccess(db: SqlExecutor, actor: MajanActor, projectId: number): Promise<void> {
    assertMajanProjectScope(projectId);
    const rows = rowsOf<Record<string, unknown>>(await db.execute(sql`
      SELECT id, userId AS userId, plotNumber AS plotNumber
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `));
    const row = rows[0];
    const id = row ? readNumber(row, "id") : null;
    const userId = row ? readNumber(row, "userId", "user_id") : null;
    if (id == null || userId == null) {
      throw new MajanStoreError("NOT_FOUND", "The approved Majan project was not found.");
    }
    assertMajanProjectAccess(actor, {
      id,
      userId,
      plotNumber: readString(row, "plotNumber", "plot_number"),
    });
  }

  private async listCasesWith(db: SqlExecutor, projectId: number): Promise<MajanCaseSummary[]> {
    const rows = rowsOf<CaseRow>(await db.execute(sql`
      SELECT id, caseName, revision, updatedAt
      FROM majan_finance_cases
      WHERE projectId = ${projectId}
      ORDER BY updatedAt DESC, id DESC
    `));
    return rows.map(row => {
      const id = readNumber(row, "id");
      const revision = readNumber(row, "revision");
      const caseName = readString(row, "caseName", "case_name");
      const updatedAt = readUtcTimestamp(row, "updatedAt", "updated_at");
      if (id == null || revision == null || !caseName || !updatedAt) {
        throw new MajanStoreError("CORRUPT_SNAPSHOT", "A saved Majan case has invalid metadata.");
      }
      return { id, caseName, revision, updatedAt };
    });
  }

  private mapSavedCase(row: CaseRow, result?: MajanModelResult): SavedMajanCase {
    const id = readNumber(row, "id");
    const revision = readNumber(row, "revision");
    const updatedBy = readNumber(row, "updatedBy", "updated_by");
    const updatedAt = readUtcTimestamp(row, "updatedAt", "updated_at");
    if (id == null || revision == null || updatedBy == null || !updatedAt) {
      throw new MajanStoreError("CORRUPT_SNAPSHOT", "A saved Majan case has invalid metadata.");
    }
    const inputs = parseSnapshot<MajanInputs>(readString(row, "inputJson", "input_json"), "input");
    const baseline = parseSnapshot<MajanBaseline>(readString(row, "baselineJson", "baseline_json"), "baseline");
    return { id, revision, inputs, baseline, updatedAt, updatedBy, result };
  }

  /** Return a saved case when selected; otherwise return an unsaved preview without writing to the database. */
  async loadMajanCase(actor: MajanActor, caseId?: number): Promise<MajanLoadPayload> {
    const db = await this.database();
    await this.assertAccess(db, actor, MAJAN_PROJECT_ID);
    const cases = await this.listCasesWith(db, MAJAN_PROJECT_ID);

    if (caseId == null) {
      const inputs = await this.createDefaults(this.baseline);
      const result = await this.calculate(inputs, this.baseline);
      return { case: null, inputs, baseline: this.baseline, result, cases };
    }

    const rows = rowsOf<CaseRow>(await db.execute(sql`
      SELECT c.id, c.projectId, c.caseName, c.revision,
             c.inputJson, c.baselineJson, c.inputHash, c.updatedBy, c.updatedAt,
             r.resultJson
      FROM majan_finance_cases c
      LEFT JOIN majan_finance_revisions r ON r.caseId = c.id AND r.revision = c.revision
      WHERE c.id = ${caseId} AND c.projectId = ${MAJAN_PROJECT_ID}
      LIMIT 1
    `));
    if (!rows[0]) throw new MajanStoreError("NOT_FOUND", "The requested Majan scenario was not found.");
    const savedResult = parseSnapshot<MajanModelResult>(readString(rows[0], "resultJson", "result_json"), "result");
    const saved = this.mapSavedCase(rows[0], savedResult);
    // A saved report is an immutable issued snapshot. Only an unsaved preview is calculated live.
    const result = savedResult;
    return { case: saved, inputs: saved.inputs, baseline: saved.baseline, result, cases };
  }

  async listMajanCases(actor: MajanActor, projectId = MAJAN_PROJECT_ID): Promise<MajanCaseSummary[]> {
    const db = await this.database();
    await this.assertAccess(db, actor, projectId);
    return this.listCasesWith(db, projectId);
  }

  async createMajanCase(actor: MajanActor, inputs: MajanInputs, baseline = this.baseline): Promise<MajanSavePayload> {
    assertInputScope(inputs);
    const db = await this.database();
    await this.assertAccess(db, actor, MAJAN_PROJECT_ID);
    const inputHash = buildMajanInputHash(inputs, baseline);
    const result = { ...await this.calculate(inputs, baseline), inputHash };
    const updatedAt = this.now().toISOString();

    try {
      return await this.withTransaction(db, async tx => {
        const inserted = await tx.execute(sql`
          INSERT INTO majan_finance_cases
            (projectId, caseName, revision, inputJson, baselineJson, inputHash, updatedBy)
          VALUES
            (${MAJAN_PROJECT_ID}, ${inputs.caseName}, 1, ${JSON.stringify(inputs)}, ${JSON.stringify(baseline)}, ${inputHash}, ${actor.id})
        `);
        const id = firstInsertId(inserted);
        if (id == null) throw new MajanStoreError("CORRUPT_SNAPSHOT", "Majan scenario creation did not return an identifier.");
        await tx.execute(sql`
          INSERT INTO majan_finance_revisions
            (caseId, revision, inputJson, baselineJson, inputHash, resultJson, createdBy)
          VALUES
            (${id}, 1, ${JSON.stringify(inputs)}, ${JSON.stringify(baseline)}, ${inputHash}, ${JSON.stringify(result)}, ${actor.id})
        `);
        return { id, revision: 1, inputs, baseline, result, updatedAt };
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new MajanStoreError("CONFLICT", "A Majan scenario with this name already exists for Project 1.");
      }
      throw error;
    }
  }

  async updateMajanCase(
    actor: MajanActor,
    caseId: number,
    expectedRevision: number,
    inputs: MajanInputs,
  ): Promise<MajanSavePayload> {
    assertInputScope(inputs);
    const db = await this.database();
    await this.assertAccess(db, actor, MAJAN_PROJECT_ID);

    try {
      return await this.withTransaction(db, async tx => {
        const rows = rowsOf<CaseRow>(await tx.execute(sql`
          SELECT id, projectId, revision, baselineJson
          FROM majan_finance_cases
          WHERE id = ${caseId} AND projectId = ${MAJAN_PROJECT_ID}
          FOR UPDATE
        `));
        const row = rows[0];
        if (!row) throw new MajanStoreError("NOT_FOUND", "The requested Majan scenario was not found.");
        const actualRevision = readNumber(row, "revision");
        if (actualRevision == null) throw new MajanStoreError("CORRUPT_SNAPSHOT", "Saved Majan scenario revision is invalid.");
        if (actualRevision !== expectedRevision) {
          throw new MajanStoreError("CONFLICT", "This Majan scenario was changed by another user. Reload before saving.");
        }

        const baseline = parseSnapshot<MajanBaseline>(readString(row, "baselineJson", "baseline_json"), "baseline");
        const revision = actualRevision + 1;
        const inputHash = buildMajanInputHash(inputs, baseline);
        const result = { ...await this.calculate(inputs, baseline), inputHash };
        const updatedAt = this.now().toISOString();
        await tx.execute(sql`
          UPDATE majan_finance_cases
          SET caseName = ${inputs.caseName}, revision = ${revision}, inputJson = ${JSON.stringify(inputs)},
              baselineJson = ${JSON.stringify(baseline)}, inputHash = ${inputHash}, updatedBy = ${actor.id},
              updatedAt = CURRENT_TIMESTAMP
          WHERE id = ${caseId} AND projectId = ${MAJAN_PROJECT_ID}
        `);
        await tx.execute(sql`
          INSERT INTO majan_finance_revisions
            (caseId, revision, inputJson, baselineJson, inputHash, resultJson, createdBy)
          VALUES
            (${caseId}, ${revision}, ${JSON.stringify(inputs)}, ${JSON.stringify(baseline)}, ${inputHash}, ${JSON.stringify(result)}, ${actor.id})
        `);
        return { id: caseId, revision, inputs, baseline, result, updatedAt };
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new MajanStoreError("CONFLICT", "A Majan scenario with this name already exists for Project 1.");
      }
      throw error;
    }
  }

  async getMajanCaseHistory(actor: MajanActor, caseId: number): Promise<MajanCaseHistory[]> {
    const db = await this.database();
    await this.assertAccess(db, actor, MAJAN_PROJECT_ID);
    const rows = rowsOf<CaseRow>(await db.execute(sql`
      SELECT revision, createdAt, inputHash, inputJson
      FROM majan_finance_revisions
      WHERE caseId = ${caseId}
        AND EXISTS (
          SELECT 1 FROM majan_finance_cases c
          WHERE c.id = majan_finance_revisions.caseId AND c.projectId = ${MAJAN_PROJECT_ID}
        )
      ORDER BY revision DESC
    `));
    if (rows.length === 0) {
      const exists = rowsOf<CaseRow>(await db.execute(sql`
        SELECT id FROM majan_finance_cases WHERE id = ${caseId} AND projectId = ${MAJAN_PROJECT_ID} LIMIT 1
      `));
      if (!exists[0]) throw new MajanStoreError("NOT_FOUND", "The requested Majan scenario was not found.");
    }
    return rows.map(row => {
      const revision = readNumber(row, "revision");
      const createdAt = readUtcTimestamp(row, "createdAt", "created_at");
      const inputHash = readString(row, "inputHash", "input_hash");
      if (revision == null || !createdAt || !inputHash) {
        throw new MajanStoreError("CORRUPT_SNAPSHOT", "A Majan scenario revision has invalid metadata.");
      }
      return { revision, createdAt, inputHash, inputs: parseSnapshot<MajanInputs>(readString(row, "inputJson", "input_json"), "input") };
    });
  }
}

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "ER_DUP_ENTRY" || (typeof candidate.message === "string" && /duplicate entry/i.test(candidate.message));
}

export const majanFinanceStore = new MajanFinanceStore();
