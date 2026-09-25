import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import mysql from "mysql2/promise";

type JsonRecord = Record<string, unknown> & { id?: number | string };
type MappingDecision = { targetId: number | null; status: "confirmed" | "create_candidate" | "exclude_temporarily" | "needs_approval" | "no_match"; evidence: string };
type MappingFile = {
  version: number;
  approved: boolean;
  users: Record<string, MappingDecision>;
  projects: Record<string, MappingDecision>;
  consultants: Record<string, MappingDecision>;
};
type Disposition = "map_existing" | "create_candidate" | "create_work_file" | "create_event" | "create_entry" | "create_meeting" | "create_child" | "archive_history" | "skip_reference" | "reject_secret" | "blocked";
type PlanRow = {
  sourceTable: string;
  sourceId: string;
  disposition: Disposition;
  targetType: string;
  targetId: number | null;
  reason: string;
  blockedBy: string | null;
};
type Conflict = {
  key: string;
  severity: "blocking" | "review";
  entityType: "user" | "project" | "consultant" | "record" | "file";
  sourceId: string;
  sourceLabel: string;
  candidateTargetId: number | null;
  reason: string;
  requiredDecision: string;
};

const SOURCE_SYSTEM = "como-follow-up-desk";
const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || value == null) throw new Error(`Invalid argument near ${key ?? "end"}`);
  args.set(key.slice(2), value);
}

const packagePath = resolve(args.get("package") || "");
const batchId = args.get("batch") || "";
const mode = args.get("mode") || "dry-run";
const mappingPath = resolve(args.get("mapping") || "migration/como-followup-candidate-mapping.json");
const outputPath = resolve(args.get("output") || `migration-results/${batchId || "unidentified-batch"}`);
if (!packagePath || !existsSync(packagePath)) throw new Error("--package must point to the extracted transfer package");
if (!/^[A-Za-z0-9._-]{8,100}$/.test(batchId)) throw new Error("--batch must be a stable 8-100 character identifier");
if (!["plan", "dry-run"].includes(mode)) throw new Error("This safety build supports plan and dry-run only; apply/rollback are intentionally disabled");
if (!existsSync(mappingPath)) throw new Error(`Mapping file not found: ${mappingPath}`);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for read-only target discovery");

const jsonDir = join(packagePath, "database", "json");
const manifestPath = join(packagePath, "storage", "manifest.json");
const countPath = join(packagePath, "database", "record-counts.json");
for (const required of [jsonDir, manifestPath, countPath]) {
  if (!existsSync(required)) throw new Error(`Required package path missing: ${required}`);
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const mapping = readJson<MappingFile>(mappingPath);
const expectedCounts = readJson<Array<{ table: string; exportedCount: number; excludedCount: number }>>(countPath);
const manifest = readJson<Array<Record<string, unknown>>>(manifestPath);
mkdirSync(outputPath, { recursive: true });

const sourceTables = new Map<string, JsonRecord[]>();
for (const expectation of expectedCounts) {
  const filePath = join(jsonDir, `${expectation.table}.json`);
  if (!existsSync(filePath)) throw new Error(`Missing JSON export for ${expectation.table}`);
  const records = readJson<JsonRecord[]>(filePath);
  if (records.length !== expectation.exportedCount) {
    throw new Error(`${expectation.table}: expected ${expectation.exportedCount}, found ${records.length}`);
  }
  sourceTables.set(expectation.table, records);
}
if ((sourceTables.get("integrationSecrets") || []).length !== 0) throw new Error("Secret records are present in the export; dry-run stopped");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const selectRows = async <T>(sql: string) => (await connection.query(sql))[0] as T[];
const hostUsers = await selectRows<{ id: number; email: string | null }>("SELECT id, email FROM users ORDER BY id");
const hostProjects = await selectRows<{ id: number; name: string; plotNumber: string | null; isTestProject: number }>("SELECT id, name, plotNumber, is_test_project AS isTestProject FROM projects ORDER BY id");
const hostConsultants = await selectRows<{ id: number; name: string }>("SELECT id, name FROM consultants ORDER BY id");
const protectedTables = ["projects", "feasibilityStudies", "financialData", "costs_cash_flow", "competition_pricing", "cf_projects", "project_cash_flow_settings", "wael_sales_plans", "portfolio_scenarios"];
const beforeCounts: Record<string, number> = {};
for (const table of protectedTables) {
  const rows = await selectRows<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  beforeCounts[table] = Number(rows[0]?.count ?? 0);
}

const conflicts: Conflict[] = [];
const plan: PlanRow[] = [];
const verifiedMapping: Record<string, Record<string, number>> = { users: {}, projects: {}, consultants: {} };

function sourceLabel(record: JsonRecord) {
  return String(record.name || record.title || record.email || record.projectName || `ID ${record.id ?? "?"}`);
}

function validateMapping(kind: keyof Pick<MappingFile, "users" | "projects" | "consultants">, sourceRecord: JsonRecord, hostIds: Set<number>) {
  const sourceId = String(sourceRecord.id);
  const decision = mapping[kind][sourceId];
  if (!decision) {
    conflicts.push({ key: `${kind}:${sourceId}`, severity: "blocking", entityType: kind === "consultants" ? "consultant" : kind.slice(0, -1) as "user" | "project", sourceId, sourceLabel: sourceLabel(sourceRecord), candidateTargetId: null, reason: "No mapping decision exists", requiredDecision: "Map to an existing target or approve creation as a new target entity" });
    return null;
  }
  if (decision.targetId != null && !hostIds.has(decision.targetId)) {
    conflicts.push({ key: `${kind}:${sourceId}`, severity: "blocking", entityType: kind === "consultants" ? "consultant" : kind.slice(0, -1) as "user" | "project", sourceId, sourceLabel: sourceLabel(sourceRecord), candidateTargetId: decision.targetId, reason: "Candidate target ID does not exist", requiredDecision: "Correct the target mapping" });
    return null;
  }
  if (decision.status === "confirmed" && decision.targetId != null) {
    verifiedMapping[kind][sourceId] = decision.targetId;
    return decision.targetId;
  }
  if (kind === "consultants" && decision.status === "create_candidate" && decision.targetId == null) {
    return null;
  }
  if (kind === "projects" && decision.status === "exclude_temporarily" && decision.targetId == null) {
    return null;
  }
  conflicts.push({ key: `${kind}:${sourceId}`, severity: decision.status === "no_match" ? "blocking" : "review", entityType: kind === "consultants" ? "consultant" : kind.slice(0, -1) as "user" | "project", sourceId, sourceLabel: sourceLabel(sourceRecord), candidateTargetId: decision.targetId, reason: decision.evidence, requiredDecision: decision.status === "no_match" ? "Decide whether to create a target record or archive the source entity" : "Approve or reject the proposed mapping" });
  return null;
}

const userIds = new Set(hostUsers.map(row => Number(row.id)));
const projectIds = new Set(hostProjects.filter(row => Number(row.isTestProject) === 0).map(row => Number(row.id)));
const consultantIds = new Set(hostConsultants.map(row => Number(row.id)));
for (const row of sourceTables.get("users") || []) validateMapping("users", row, userIds);
for (const row of sourceTables.get("projects") || []) validateMapping("projects", row, projectIds);
for (const row of sourceTables.get("consultants") || []) validateMapping("consultants", row, consultantIds);

const projectMap = verifiedMapping.projects;
const consultantMap = verifiedMapping.consultants;
const excludedProjectIds = new Set(Object.entries(mapping.projects).filter(([, decision]) => decision.status === "exclude_temporarily").map(([sourceId]) => sourceId));
const taskRecords = sourceTables.get("followUpTasks") || [];
const taskDisposition = new Map<string, PlanRow>();

for (const [table, records] of sourceTables) {
  for (const record of records) {
    const sourceId = String(record.id ?? `${table}-${plan.length + 1}`);
    let row: PlanRow;
    if (table === "__drizzle_migrations") row = { sourceTable: table, sourceId, disposition: "skip_reference", targetType: "migration_reference", targetId: null, reason: "Source migration history is reference-only", blockedBy: null };
    else if (table === "integrationSecrets") row = { sourceTable: table, sourceId, disposition: "reject_secret", targetType: "none", targetId: null, reason: "Secrets are never imported", blockedBy: null };
    else if (table === "users") {
      const targetId = verifiedMapping.users[sourceId] ?? null;
      row = { sourceTable: table, sourceId, disposition: targetId ? "map_existing" : "blocked", targetType: "users", targetId, reason: targetId ? "Exact approved user mapping" : "User mapping requires approval", blockedBy: targetId ? null : `users:${sourceId}` };
    } else if (table === "projects") {
      const targetId = projectMap[sourceId] ?? null;
      const excluded = excludedProjectIds.has(sourceId);
      row = { sourceTable: table, sourceId, disposition: targetId ? "map_existing" : excluded ? "skip_reference" : "blocked", targetType: "projects", targetId, reason: targetId ? "Approved project mapping" : excluded ? "Owner approved temporary exclusion; retain only in the source package" : "Project mapping requires owner decision", blockedBy: targetId || excluded ? null : `projects:${sourceId}` };
    } else if (table === "consultants") {
      const targetId = consultantMap[sourceId] ?? null;
      const isCandidate = mapping.consultants[sourceId]?.status === "create_candidate";
      row = { sourceTable: table, sourceId, disposition: targetId ? "map_existing" : isCandidate ? "create_candidate" : "blocked", targetType: "como_next_parties", targetId, reason: targetId ? "Approved consultant mapping" : isCandidate ? "Create an unverified party candidate; do not treat as an appointed consultant" : "Consultant identity mapping is unresolved", blockedBy: targetId || isCandidate ? null : `consultants:${sourceId}` };
    } else if (table === "followUpTasks") {
      const sourceProjectId = String(record.projectId ?? "");
      const projectId = projectMap[sourceProjectId] ?? null;
      const excluded = excludedProjectIds.has(sourceProjectId);
      row = { sourceTable: table, sourceId, disposition: projectId ? "create_work_file" : excluded ? "skip_reference" : "blocked", targetType: "como_next_work_files", targetId: null, reason: projectId ? `Create a staged work file under project ${projectId}` : excluded ? "Skip because the owner temporarily excluded the source project" : "Parent project mapping is not approved", blockedBy: projectId || excluded ? null : `projects:${sourceProjectId}` };
      taskDisposition.set(sourceId, row);
    } else if (table === "taskActivities" || table === "workEntries") {
      const sourceTaskId = String(record.taskId ?? "");
      const parent = taskDisposition.get(sourceTaskId);
      const valid = parent?.disposition === "create_work_file";
      const excluded = parent?.disposition === "skip_reference";
      row = { sourceTable: table, sourceId, disposition: valid ? (table === "taskActivities" ? "create_event" : "create_entry") : excluded ? "skip_reference" : "blocked", targetType: table === "taskActivities" ? "como_next_work_file_events" : "como_next_work_entries", targetId: null, reason: valid ? "Create under the staged parent work file with provenance" : excluded ? "Skip with the temporarily excluded parent project" : "Parent work file is blocked", blockedBy: valid || excluded ? null : `followUpTasks:${sourceTaskId}` };
    } else if (table === "meetings") {
      const sourceProjectId = String(record.projectId ?? "");
      const projectId = projectMap[sourceProjectId] ?? null;
      const sourceTaskId = String(record.followUpTaskId ?? "");
      const parent = taskDisposition.get(sourceTaskId);
      const valid = Boolean(projectId && parent?.disposition === "create_work_file");
      const excluded = excludedProjectIds.has(sourceProjectId) || parent?.disposition === "skip_reference";
      row = { sourceTable: table, sourceId, disposition: valid ? "create_meeting" : excluded ? "skip_reference" : "blocked", targetType: "como_next_meetings", targetId: null, reason: valid ? "Create staged meeting linked to the mapped project and work file" : excluded ? "Skip with the temporarily excluded parent project" : "Project or parent work file is blocked", blockedBy: valid || excluded ? null : (!projectId ? `projects:${sourceProjectId}` : `followUpTasks:${sourceTaskId}`) };
    } else if (["meetingParticipants", "meetingAgendaItems", "meetingLogEntries", "meetingPreparationSources", "meetingVersions", "meetingRecordings", "meetingRecordingChunks"].includes(table)) {
      row = { sourceTable: table, sourceId, disposition: "create_child", targetType: `como_next_${table}`, targetId: null, reason: "Create only after parent meeting mapping resolves", blockedBy: null };
    } else if (table === "consultantContacts" || table === "projectConsultants") {
      const sourceConsultantId = String(record.consultantId ?? "");
      const targetId = consultantMap[sourceConsultantId] ?? null;
      const isCandidate = mapping.consultants[sourceConsultantId]?.status === "create_candidate";
      const sourceProjectId = String(record.projectId ?? "");
      const excluded = table === "projectConsultants" && excludedProjectIds.has(sourceProjectId);
      row = { sourceTable: table, sourceId, disposition: excluded ? "skip_reference" : targetId || isCandidate ? "create_child" : "blocked", targetType: table === "consultantContacts" ? "organization_contacts" : "project_organizations", targetId: null, reason: excluded ? "Skip with the temporarily excluded parent project" : targetId ? "Create under approved organization mapping" : isCandidate ? "Create under the unverified party candidate with full provenance" : "Consultant identity requires approval", blockedBy: excluded || targetId || isCandidate ? null : `consultants:${sourceConsultantId}` };
    } else if (["agentRequests", "saraBriefingSnapshots", "saraBriefingDeliveries"].includes(table)) {
      row = { sourceTable: table, sourceId, disposition: "archive_history", targetType: "assistant_history", targetId: null, reason: "Historical record only; never rerun", blockedBy: null };
    } else if (["saraBriefingSchedules", "automationJobs"].includes(table)) {
      row = { sourceTable: table, sourceId, disposition: "skip_reference", targetType: "disabled_automation_reference", targetId: null, reason: "Automation remains disabled and is not copied live", blockedBy: null };
    } else {
      row = { sourceTable: table, sourceId, disposition: "blocked", targetType: "unmapped", targetId: null, reason: "No reviewed transformation rule", blockedBy: `record:${table}:${sourceId}` };
    }
    plan.push(row);
  }
}

const fileRows: Array<Record<string, unknown>> = [];
const firstByHash = new Map<string, string>();
for (const [index, entry] of manifest.entries()) {
  const sha = String(entry.sha256 || "");
  const storedName = String(entry.storedName || "");
  const exported = entry.exported === true;
  const filePath = join(packagePath, "storage", storedName);
  let actualSha = "";
  let disposition = "reference_only";
  let canonical = "";
  if (exported) {
    if (!existsSync(filePath)) {
      disposition = "missing_file";
      conflicts.push({ key: `file:${index + 1}`, severity: "blocking", entityType: "file", sourceId: String(index + 1), sourceLabel: storedName, candidateTargetId: null, reason: "Manifest says exported, but the file is missing", requiredDecision: "Repair the package before import" });
    } else {
      actualSha = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      if (actualSha !== sha) {
        disposition = "checksum_mismatch";
        conflicts.push({ key: `file:${index + 1}`, severity: "blocking", entityType: "file", sourceId: String(index + 1), sourceLabel: storedName, candidateTargetId: null, reason: "Exported file checksum does not match the manifest", requiredDecision: "Replace or re-export the file" });
      } else if (firstByHash.has(sha)) {
        disposition = "reuse_source_duplicate";
        canonical = firstByHash.get(sha)!;
      } else {
        disposition = "upload_unique_to_staging";
        firstByHash.set(sha, storedName);
        canonical = storedName;
      }
    }
  }
  fileRows.push({ sourceIndex: index + 1, originalName: entry.originalName || "", storedName, sourceUrl: entry.sourceUrl || "", bytes: Number(entry.bytes || 0), manifestSha256: sha, actualSha256: actualSha, disposition, canonicalStoredName: canonical, sideEffects: "none" });
}

const afterCounts: Record<string, number> = {};
for (const table of protectedTables) {
  const rows = await selectRows<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  afterCounts[table] = Number(rows[0]?.count ?? 0);
}
await connection.end();
if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) throw new Error("Protected table counts changed during dry-run");

const csv = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${columns.map(quote).join(",")}\n${rows.map(row => columns.map(column => quote(row[column])).join(",")).join("\n")}\n`;
};
const dispositionCounts = Object.fromEntries([...new Set(plan.map(row => row.disposition))].sort().map(key => [key, plan.filter(row => row.disposition === key).length]));
const exportedRecordCount = expectedCounts.reduce((sum, row) => sum + row.exportedCount, 0);
const sourceCount = expectedCounts.reduce((sum, row) => sum + row.exportedCount + row.excludedCount, 0);
const blockingConflicts = conflicts.filter(conflict => conflict.severity === "blocking");
const summary = {
  sourceSystem: SOURCE_SYSTEM,
  batchId,
  mode,
  generatedAt: new Date().toISOString(),
  packagePath,
  mappingPath,
  mappingApproved: mapping.approved,
  sourceTableCount: expectedCounts.length,
  sourceCount,
  exportedRecordCount,
  excludedSecretCount: expectedCounts.reduce((sum, row) => sum + row.excludedCount, 0),
  plannedRowCount: plan.length,
  dispositionCounts,
  conflictCount: conflicts.length,
  blockingConflictCount: blockingConflicts.length,
  manifestEntries: manifest.length,
  exportedFilesVerified: fileRows.filter(row => row.actualSha256 && row.actualSha256 === row.manifestSha256).length,
  uniqueFilePayloads: firstByHash.size,
  sourceDuplicateFileReferences: fileRows.filter(row => row.disposition === "reuse_source_duplicate").length,
  protectedTableCountsBefore: beforeCounts,
  protectedTableCountsAfter: afterCounts,
  writesExecuted: 0,
  externalSideEffects: 0,
  readyForApply: mapping.approved && blockingConflicts.length === 0,
};

writeFileSync(join(outputPath, "plan.json"), JSON.stringify({ summary, rows: plan }, null, 2));
writeFileSync(join(outputPath, "conflicts.json"), JSON.stringify({ summary: { total: conflicts.length, blocking: blockingConflicts.length }, conflicts }, null, 2));
writeFileSync(join(outputPath, "legacy-id-map.csv"), csv(Object.entries(verifiedMapping).flatMap(([entityType, mappings]) => Object.entries(mappings).map(([sourceId, targetId]) => ({ sourceSystem: SOURCE_SYSTEM, entityType, sourceId, targetId, status: "confirmed", batchId })))));
writeFileSync(join(outputPath, "reconciliation.csv"), csv(plan.map(row => ({ ...row, batchId, sourceSystem: SOURCE_SYSTEM }))));
writeFileSync(join(outputPath, "file-map.csv"), csv(fileRows));
writeFileSync(join(outputPath, "dry-run-summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outputPath, "DRY_RUN_REPORT.md"), `# Follow-up Desk → COMO Next dry run\n\n**Batch:** \`${batchId}\`  \n**Mode:** ${mode}  \n**Generated:** ${summary.generatedAt}\n\n## Result\n\n- Source tables checked: **${summary.sourceTableCount}**\n- Source records accounted for: **${summary.sourceCount}** (${summary.exportedRecordCount} exported + ${summary.excludedSecretCount} secret excluded)\n- Planned reconciliation rows: **${summary.plannedRowCount}**\n- Manifest entries: **${summary.manifestEntries}**\n- Exported files verified: **${summary.exportedFilesVerified}**\n- Unique file payloads: **${summary.uniqueFilePayloads}**\n- Source duplicate file references: **${summary.sourceDuplicateFileReferences}**\n- Conflicts: **${summary.conflictCount}**, blocking: **${summary.blockingConflictCount}**\n- Target writes executed: **0**\n- External side effects: **0**\n- Ready for apply: **${summary.readyForApply ? "YES" : "NO"}**\n\n## Safety conclusion\n\nThis run queried the live target only for identity and count verification. It did not insert, update, delete, upload, send, schedule, notify, or invoke Manus. Apply and rollback are intentionally unavailable in this build.\n`);

console.log(JSON.stringify(summary, null, 2));
console.log(`Outputs: ${outputPath}`);
