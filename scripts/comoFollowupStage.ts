import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import mysql from "mysql2/promise";

type JsonRecord = Record<string, unknown> & { id: number | string };
type PlanRow = {
  sourceTable: string;
  sourceId: string;
  disposition: string;
  targetType: string;
  targetId: number | null;
  reason: string;
  blockedBy: string | null;
};
type PlanFile = {
  summary: {
    batchId: string;
    sourceSystem: string;
    sourceCount: number;
    exportedRecordCount: number;
    blockingConflictCount: number;
    mappingApproved: boolean;
    readyForApply: boolean;
  };
  rows: PlanRow[];
};

type MappingFile = { version: number; approved: boolean };

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || value == null) throw new Error(`Invalid argument near ${key ?? "end"}`);
  args.set(key.slice(2), value);
}

const packagePath = resolve(args.get("package") || "");
const planPath = resolve(args.get("plan") || "");
const mappingPath = resolve(args.get("mapping") || "migration/como-followup-candidate-mapping.json");
const batchId = args.get("batch") || "";
const fingerprint = args.get("fingerprint") || "";
const resultPath = resolve(args.get("result") || `migration-results/${batchId}/STAGE_RESULT.json`);
if (!existsSync(packagePath) || !existsSync(planPath) || !existsSync(mappingPath)) throw new Error("Package, plan, and mapping paths are required");
if (!/^[A-Za-z0-9._-]{8,100}$/.test(batchId)) throw new Error("Invalid batch identifier");
if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error("A verified SHA-256 package fingerprint is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const canonical = (value: unknown) => JSON.stringify(value);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const planText = readFileSync(planPath, "utf8");
const mappingText = readFileSync(mappingPath, "utf8");
const plan = JSON.parse(planText) as PlanFile;
const mapping = JSON.parse(mappingText) as MappingFile;
if (plan.summary.batchId !== batchId) throw new Error("Plan batch does not match --batch");
if (!mapping.approved || !plan.summary.mappingApproved || !plan.summary.readyForApply || plan.summary.blockingConflictCount !== 0) {
  throw new Error("Only an owner-approved, zero-conflict dry-run plan may enter staging");
}
if (plan.rows.length !== plan.summary.exportedRecordCount) throw new Error("Plan row count does not match the exported record count");
if (plan.rows.some(row => row.disposition === "blocked" || row.blockedBy)) throw new Error("Plan still contains blocked rows");

const jsonDir = join(packagePath, "database", "json");
const sourceByKey = new Map<string, JsonRecord>();
for (const row of plan.rows) {
  const key = `${row.sourceTable}:${row.sourceId}`;
  if (sourceByKey.has(key)) continue;
  const tablePath = join(jsonDir, `${row.sourceTable}.json`);
  if (!existsSync(tablePath)) throw new Error(`Missing source table export: ${row.sourceTable}`);
  const records = JSON.parse(readFileSync(tablePath, "utf8")) as JsonRecord[];
  for (const record of records) sourceByKey.set(`${row.sourceTable}:${String(record.id)}`, record);
}
for (const row of plan.rows) {
  if (!sourceByKey.has(`${row.sourceTable}:${row.sourceId}`)) throw new Error(`Source payload missing for ${row.sourceTable}:${row.sourceId}`);
}

const manifest = JSON.parse(readFileSync(join(packagePath, "storage", "manifest.json"), "utf8")) as Array<Record<string, unknown>>;
const stagedFiles = manifest.map((entry, index) => {
  const storedName = String(entry.storedName || "");
  const expectedSha = String(entry.sha256 || "");
  const exported = entry.exported === true;
  const sourceFile = join(packagePath, "storage", storedName);
  if (exported && !existsSync(sourceFile)) throw new Error(`Exported file is missing: ${storedName}`);
  const actualSha = exported ? sha256(readFileSync(sourceFile)) : "";
  if (exported && actualSha !== expectedSha) throw new Error(`Checksum mismatch: ${storedName}`);
  return { index: index + 1, entry, exported, actualSha };
});

const firstBySha = new Map<string, string>();
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [existingRows] = await connection.query("SELECT id, source_fingerprint AS sourceFingerprint, mapping_sha256 AS mappingSha256, plan_sha256 AS planSha256, staged_record_count AS stagedRecordCount, skipped_record_count AS skippedRecordCount, staged_file_count AS stagedFileCount FROM como_next_import_batches WHERE batch_id = ? LIMIT 1", [batchId]) as unknown as [Array<Record<string, unknown>>, unknown];
const mappingHash = sha256(mappingText);
const planHash = sha256(planText);
if (existingRows.length) {
  const existing = existingRows[0];
  if (existing.sourceFingerprint !== fingerprint || existing.mappingSha256 !== mappingHash || existing.planSha256 !== planHash) throw new Error("Batch ID already exists with different inputs");
  console.log(JSON.stringify({ batchId, status: "already_staged", idempotent: true, stagedRecordCount: Number(existing.stagedRecordCount), skippedRecordCount: Number(existing.skippedRecordCount), stagedFileCount: Number(existing.stagedFileCount), writesExecuted: 0, externalSideEffects: 0 }, null, 2));
  await connection.end();
  process.exit(0);
}

let batchDbId = 0;
let stagedRecordCount = 0;
let skippedRecordCount = 0;
let stagedFileCount = 0;
await connection.beginTransaction();
try {
  const [batchResult] = await connection.execute(
    "INSERT INTO como_next_import_batches (batch_id, source_system, source_fingerprint, mapping_version, mapping_sha256, plan_sha256, batch_status, source_record_count) VALUES (?, ?, ?, ?, ?, ?, 'staged', ?)",
    [batchId, plan.summary.sourceSystem, fingerprint, mapping.version, mappingHash, planHash, plan.summary.sourceCount],
  ) as unknown as [{ insertId: number }, unknown];
  batchDbId = Number(batchResult.insertId);

  for (const row of plan.rows) {
    const payload = sourceByKey.get(`${row.sourceTable}:${row.sourceId}`)!;
    const payloadJson = canonical(payload);
    const stageStatus = row.disposition === "skip_reference" ? "skipped" : row.disposition === "reject_secret" ? "rejected" : "staged";
    const sourceProjectId = payload.projectId == null ? null : String(payload.projectId);
    const sourceConsultantId = payload.consultantId == null ? null : String(payload.consultantId);
    await connection.execute(
      "INSERT INTO como_next_import_rows (import_batch_id, source_table, source_record_id, source_project_id, source_consultant_id, disposition, target_type, target_id, stage_status, disposition_reason, payload_sha256, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [batchDbId, row.sourceTable, row.sourceId, sourceProjectId, sourceConsultantId, row.disposition, row.targetType, row.targetId, stageStatus, row.reason, sha256(payloadJson), payloadJson],
    );
    if (stageStatus === "staged") stagedRecordCount += 1;
    else skippedRecordCount += 1;
  }

  for (const file of stagedFiles) {
    const entry = file.entry;
    const storedName = String(entry.storedName || "");
    const manifestSha = String(entry.sha256 || "");
    let fileStatus: "verified_unique" | "verified_duplicate" | "reference_only" | "skipped" = "reference_only";
    let canonicalStoredName = "";
    if (file.exported) {
      if (firstBySha.has(manifestSha)) {
        fileStatus = "verified_duplicate";
        canonicalStoredName = firstBySha.get(manifestSha)!;
      } else {
        fileStatus = "verified_unique";
        canonicalStoredName = storedName;
        firstBySha.set(manifestSha, storedName);
      }
    }
    await connection.execute(
      "INSERT INTO como_next_import_files (import_batch_id, source_index, original_name, stored_name, source_url, byte_size, sha256, canonical_stored_name, file_status, staged_storage_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
      [batchDbId, file.index, String(entry.originalName || "") || null, storedName, String(entry.sourceUrl || "") || null, Number(entry.bytes || 0), manifestSha || null, canonicalStoredName || null, fileStatus],
    );
    stagedFileCount += 1;
  }

  await connection.execute(
    "UPDATE como_next_import_batches SET staged_record_count = ?, skipped_record_count = ?, staged_file_count = ? WHERE id = ?",
    [stagedRecordCount, skippedRecordCount, stagedFileCount, batchDbId],
  );
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
}

const [verificationRows] = await connection.query(
  "SELECT b.id, b.batch_id AS batchId, b.batch_status AS batchStatus, b.source_record_count AS sourceRecordCount, b.staged_record_count AS stagedRecordCount, b.skipped_record_count AS skippedRecordCount, b.staged_file_count AS stagedFileCount, (SELECT COUNT(*) FROM como_next_import_rows r WHERE r.import_batch_id = b.id) AS actualRowCount, (SELECT COUNT(*) FROM como_next_import_files f WHERE f.import_batch_id = b.id) AS actualFileCount FROM como_next_import_batches b WHERE b.id = ?",
  [batchDbId],
) as unknown as [Array<Record<string, unknown>>, unknown];
await connection.end();
const verification = verificationRows[0];
if (!verification || Number(verification.actualRowCount) !== plan.rows.length || Number(verification.actualFileCount) !== manifest.length) throw new Error("Post-stage reconciliation failed");
const result = {
  batchId,
  batchDbId,
  batchStatus: verification.batchStatus,
  sourceRecordCount: Number(verification.sourceRecordCount),
  stagedRecordCount,
  skippedRecordCount,
  stagedFileCount,
  actualRowCount: Number(verification.actualRowCount),
  actualFileCount: Number(verification.actualFileCount),
  uniqueFilePayloads: firstBySha.size,
  writesExecuted: 1 + plan.rows.length + manifest.length + 1,
  writesLimitedTo: ["como_next_import_batches", "como_next_import_rows", "como_next_import_files"],
  operationalRecordsPromoted: 0,
  externalSideEffects: 0,
  reversibleByBatchDelete: true,
};
writeFileSync(resultPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
