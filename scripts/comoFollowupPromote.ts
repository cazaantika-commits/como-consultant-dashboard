import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";

const SOURCE_SYSTEM = "como_followup_desk";
const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const batchId = valueAfter("--batch");
const outputPath = resolve(valueAfter("--output") || `migration-results/${batchId || "unknown"}/PROMOTION_RESULT.json`);
const apply = args.includes("--apply");

if (!batchId) throw new Error("--batch is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const jsonParse = <T>(value: unknown): T => JSON.parse(String(value || "{}")) as T;
const dbTime = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${String(value)}`);
  return date.toISOString().slice(0, 19).replace("T", " ");
};
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const stringId = (value: unknown) => String(value ?? "");
const safeText = (value: unknown) => value == null ? null : String(value);

interface StageRow extends RowDataPacket {
  id: number;
  source_table: string;
  source_record_id: string;
  source_project_id: string | null;
  source_consultant_id: string | null;
  disposition: string;
  target_id: number | null;
  stage_status: string;
  payload_json: string;
}

function priorityOf(value: unknown): "normal" | "important" | "urgent" {
  if (value === "critical") return "urgent";
  if (value === "high") return "important";
  return "normal";
}

function workFileStatusOf(value: unknown) {
  if (value === "completed") return "closed";
  if (value === "waiting") return "waiting";
  if (value === "decision" || value === "action_required") return "open";
  return "open";
}

function governingQuestionOf(status: unknown) {
  if (status === "waiting") return "ما الرد أو المستند المنتظر، ومتى يجب المتابعة إذا لم يصل؟";
  if (status === "decision") return "ما القرار المطلوب من عبد الرحمن، وما دليله وآثاره قبل أي إجراء خارجي؟";
  if (status === "completed") return "ما النتيجة التي أغلقت هذا الموضوع، وما الدليل الذي يبرر إعادة فتحه؟";
  return "ما الإجراء الحقيقي التالي المطلوب لإكمال هذا الملف دون التزام غير معتمد؟";
}

function actionStatusOf(value: unknown) {
  if (value === "done") return "verified";
  if (value === "waiting") return "waiting_external";
  if (value === "archived") return "cancelled";
  return "in_progress";
}

function ownerTypeOf(value: unknown): "human" | "manus" | "team" {
  const owner = String(value || "").toLowerCase();
  const hasHuman = /abdalrahman|abdulrahman|عبدالرحمن|عبد الرحمن/.test(owner);
  const hasManus = /manus|sara|سارة/.test(owner);
  if (hasHuman && hasManus) return "team";
  if (hasManus) return "manus";
  if (hasHuman) return "human";
  return "team";
}

function meetingStatusOf(value: unknown) {
  if (value === "closed") return "completed";
  if (value === "confirmed") return "confirmed";
  if (value === "cancelled") return "cancelled";
  return "planned";
}

async function selectId(connection: PoolConnection, query: string, params: unknown[]) {
  const [rows] = await connection.query<RowDataPacket[]>(query, params);
  if (!rows[0]?.id) throw new Error(`Unable to resolve inserted record for ${query}`);
  return Number(rows[0].id);
}

async function updateStageTarget(connection: PoolConnection, batchPk: number, sourceTable: string, sourceRecordId: string, targetId: number) {
  await connection.execute(
    `UPDATE como_next_import_rows SET target_id = ? WHERE import_batch_id = ? AND source_table = ? AND source_record_id = ?`,
    [targetId, batchPk, sourceTable, sourceRecordId],
  );
}

async function main() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 1 });
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(`SELECT GET_LOCK(?, 10) AS acquired`, [`como-followup-promote:${batchId}`]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error("Could not acquire the promotion lock");

    const [batchRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM como_next_import_batches WHERE batch_id = ? LIMIT 1`,
      [batchId],
    );
    const batch = batchRows[0];
    if (!batch) throw new Error(`Staged batch not found: ${batchId}`);

    const [rows] = await connection.query<StageRow[]>(
      `SELECT * FROM como_next_import_rows WHERE import_batch_id = ? ORDER BY source_table, source_record_id`,
      [Number(batch.id)],
    );
    const stagedRows = rows.filter(row => row.stage_status === "staged");
    const byTable = new Map<string, StageRow[]>();
    for (const row of stagedRows) {
      const list = byTable.get(row.source_table) || [];
      list.push(row);
      byTable.set(row.source_table, list);
    }

    const projectMap = new Map(
      (byTable.get("projects") || [])
        .filter(row => row.disposition === "map_existing" && row.target_id)
        .map(row => [row.source_record_id, Number(row.target_id)]),
    );
    const userMap = new Map(
      (byTable.get("users") || [])
        .filter(row => row.disposition === "map_existing" && row.target_id)
        .map(row => [row.source_record_id, Number(row.target_id)]),
    );
    const ownerUserId = userMap.get("750001") || 1;
    const eligibleTaskRows = (byTable.get("followUpTasks") || [])
      .filter(row => row.disposition === "create_work_file" && projectMap.has(stringId(row.source_project_id)));
    const eligibleTaskIds = new Set(eligibleTaskRows.map(row => row.source_record_id));
    const eligibleChildRows = (table: string) => (byTable.get(table) || []).filter(row => {
      const payload = jsonParse<any>(row.payload_json);
      return eligibleTaskIds.has(stringId(payload.taskId));
    });

    const expected = {
      projects: projectMap.size,
      parties: (byTable.get("projectConsultants") || []).filter(row => projectMap.has(stringId(row.source_project_id))).length,
      workFiles: eligibleTaskRows.length,
      decisions: eligibleTaskRows.filter(row => jsonParse<any>(row.payload_json).status === "decision").length,
      workEntries: eligibleChildRows("workEntries").length,
      events: eligibleChildRows("taskActivities").length,
      meetings: (byTable.get("meetings") || []).filter(row => projectMap.has(stringId(row.source_project_id))).length,
    };

    if (!apply) {
      mkdirSync(dirname(outputPath), { recursive: true });
      const report = { mode: "plan", batchId, batchStatus: batch.batch_status, expected, writesExecuted: 0 };
      writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Keep the batch hidden from operational queries until the final status
    // becomes `promoted`. Each idempotent write commits independently so the
    // live application is never held behind one long foreign-key transaction.
    await connection.execute(
      `UPDATE como_next_import_batches SET batch_status = 'reviewed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND batch_status <> 'promoted'`,
      [Number(batch.id)],
    );
    const stats: Record<string, { resolved: number; created: number }> = {};
    const bump = (key: string, created: boolean) => {
      stats[key] ||= { resolved: 0, created: 0 };
      stats[key].resolved += 1;
      if (created) stats[key].created += 1;
    };

    const rowBy = (table: string, id: unknown) => (byTable.get(table) || []).find(row => row.source_record_id === stringId(id));
    const payloadBy = <T>(table: string, id: unknown): T | null => {
      const row = rowBy(table, id);
      return row ? jsonParse<T>(row.payload_json) : null;
    };

    const consultantRows = byTable.get("consultants") || [];
    const projectConsultantRows = (byTable.get("projectConsultants") || []).filter(row => projectMap.has(stringId(row.source_project_id)));
    const usedConsultants = new Set(projectConsultantRows.map(row => stringId(row.source_consultant_id)));
    for (const row of byTable.get("followUpTasks") || []) {
      if (row.disposition === "create_work_file" && projectMap.has(stringId(row.source_project_id)) && row.source_consultant_id) usedConsultants.add(row.source_consultant_id);
    }

    const partyMap = new Map<string, number>();
    for (const row of consultantRows.filter(item => usedConsultants.has(item.source_record_id))) {
      const payload = jsonParse<any>(row.payload_json);
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_parties WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
        [SOURCE_SYSTEM, row.source_record_id],
      );
      let partyId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!partyId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_parties
            (user_id, party_type, display_name, legal_name, jurisdiction, party_status, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, 'organization', ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
          [ownerUserId, String(payload.name), safeText(payload.uaeOffice), Number(payload.isActive) === 0 ? "inactive" : "active", SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        partyId = Number(result.insertId);
        created = true;
      }
      partyMap.set(row.source_record_id, partyId);
      await updateStageTarget(connection, Number(batch.id), "consultants", row.source_record_id, partyId);
      bump("parties", created);
    }

    const contactRows = byTable.get("consultantContacts") || [];
    for (const row of contactRows.filter(item => partyMap.has(stringId(item.source_consultant_id)))) {
      const payload = jsonParse<any>(row.payload_json);
      const partyId = partyMap.get(stringId(row.source_consultant_id))!;
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_party_contacts WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
        [SOURCE_SYSTEM, row.source_record_id],
      );
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_party_contacts
            (party_id, display_name, email, phone, job_title, is_primary, notes, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [partyId, String(payload.name), safeText(payload.email), safeText(payload.phone), safeText(payload.jobTitle), Number(payload.isPrimary) ? 1 : 0, safeText(payload.notes), SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      await updateStageTarget(connection, Number(batch.id), "consultantContacts", row.source_record_id, targetId);
      bump("contacts", created);
    }
    console.log(`[promotion] parties=${partyMap.size} contacts=${stats.contacts?.resolved || 0}`);

    const projectPartyMap = new Map<string, number>();
    for (const row of projectConsultantRows) {
      const payload = jsonParse<any>(row.payload_json);
      const projectId = projectMap.get(stringId(row.source_project_id));
      const partyId = partyMap.get(stringId(row.source_consultant_id));
      if (!projectId || !partyId) throw new Error(`Missing project or party mapping for projectConsultants/${row.source_record_id}`);
      const roleCode = payload.status === "appointed" ? "appointed_consultant" : "consultant_candidate";
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_project_parties WHERE project_id = ? AND party_id = ? AND role_code = ? LIMIT 1`,
        [projectId, partyId, roleCode],
      );
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_project_parties
            (project_id, party_id, role_code, relationship_status, source_system, source_record_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, partyId, roleCode, payload.status === "not_selected" ? "inactive" : "active", SOURCE_SYSTEM, row.source_record_id, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      projectPartyMap.set(`${row.source_project_id}:${row.source_consultant_id}`, targetId);
      await updateStageTarget(connection, Number(batch.id), "projectConsultants", row.source_record_id, targetId);
      bump("projectParties", created);
    }

    const workFileMap = new Map<string, number>();
    const workFileRows = eligibleTaskRows;
    for (const row of workFileRows) {
      const payload = jsonParse<any>(row.payload_json);
      const projectId = projectMap.get(stringId(row.source_project_id))!;
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_work_files WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
        [SOURCE_SYSTEM, row.source_record_id],
      );
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const status = workFileStatusOf(payload.status);
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_work_files
            (user_id, project_id, title, governing_question, desired_outcome, work_file_status, priority, owner_user_id, closure_evidence_ref, source_system, source_record_id, import_batch_id, opened_at, closed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ownerUserId, projectId, String(payload.title), governingQuestionOf(payload.status), String(payload.nextAction || payload.summary || "توثيق النتيجة التالية للملف."), status, priorityOf(payload.priority), ownerUserId, status === "closed" ? `مغلق في Follow-up Desk وفق الحالة المصدرية بتاريخ ${String(payload.completedAt || payload.updatedAt || "غير محدد")}.` : null, SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), status === "closed" ? dbTime(payload.completedAt || payload.updatedAt) : null, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      workFileMap.set(row.source_record_id, targetId);
      await updateStageTarget(connection, Number(batch.id), "followUpTasks", row.source_record_id, targetId);
      bump("workFiles", created);

      const consultantId = stringId(row.source_consultant_id);
      const projectPartyId = projectPartyMap.get(`${row.source_project_id}:${consultantId}`);
      if (projectPartyId) {
        const [linkRows] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM como_next_work_file_parties WHERE work_file_id = ? AND project_party_id = ? LIMIT 1`,
          [targetId, projectPartyId],
        );
        if (!linkRows[0]?.id) {
          await connection.execute(
            `INSERT INTO como_next_work_file_parties (project_id, work_file_id, project_party_id, relationship_role) VALUES (?, ?, ?, 'counterparty')`,
            [projectId, targetId, projectPartyId],
          );
        }
      }
    }
    console.log(`[promotion] work-files=${workFileMap.size}`);

    for (const row of eligibleTaskRows) {
      const payload = jsonParse<any>(row.payload_json);
      if (payload.status !== "decision") continue;
      const workFileId = workFileMap.get(row.source_record_id);
      const projectId = projectMap.get(stringId(row.source_project_id));
      if (!workFileId || !projectId) throw new Error(`Missing work file mapping for decision task ${row.source_record_id}`);
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_decisions WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
        [SOURCE_SYSTEM, row.source_record_id],
      );
      let created = false;
      if (!existing[0]?.id) {
        await connection.execute(
          `INSERT INTO como_next_decisions
            (user_id, project_id, work_file_id, title, question, context_summary, recommendation, decision_status, decision_authority, due_at, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'required', 'abdulrahman', ?, ?, ?, ?, ?, ?)`,
          [ownerUserId, projectId, workFileId, `حسم التقييم الداخلي — ${String(payload.title)}`, String(payload.nextAction || "ما القرار المطلوب اعتماده قبل أي إجراء خارجي؟"), safeText(payload.summary), dbTime(payload.dueAt), SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        created = true;
      }
      bump("decisions", created);
    }
    console.log(`[promotion] decisions=${stats.decisions?.resolved || 0}`);

    for (const row of eligibleChildRows("workEntries")) {
      const payload = jsonParse<any>(row.payload_json);
      const workFileId = workFileMap.get(stringId(payload.taskId));
      const parentTask = rowBy("followUpTasks", payload.taskId);
      const projectId = parentTask ? projectMap.get(stringId(parentTask.source_project_id)) : null;
      if (!workFileId || !projectId) throw new Error(`Missing work file mapping for workEntries/${row.source_record_id}`);
      if (payload.section === "action") {
        const [existing] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM como_next_actions WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
          [SOURCE_SYSTEM, row.source_record_id],
        );
        let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
        let created = false;
        if (!targetId) {
          const status = actionStatusOf(payload.status);
          const ownerType = ownerTypeOf(payload.assignedTo);
          const [result] = await connection.execute<any>(
            `INSERT INTO como_next_actions
              (user_id, project_id, work_file_id, title, description, acceptance_criteria, owner_type, owner_user_id, action_status, priority, due_at, follow_up_at, attention_at, evidence_reference, source_system, source_record_id, import_batch_id, completed_at, verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ownerUserId, projectId, workFileId, String(payload.title), safeText(payload.content), "توثيق النتيجة وربط دليلها بملف العمل قبل اعتبار الإجراء مكتملاً.", ownerType, ownerType === "human" ? ownerUserId : null, status, "normal", dbTime(payload.dueAt), null, dbTime(payload.dueAt), status === "verified" ? `مكتمل بحسب السجل المصدر workEntries/${row.source_record_id}; يُراجع مضمونه داخل ذاكرة الملف.` : null, SOURCE_SYSTEM, row.source_record_id, batchId, status === "verified" ? dbTime(payload.updatedAt) : null, status === "verified" ? dbTime(payload.updatedAt) : null, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
          );
          targetId = Number(result.insertId);
          created = true;
        }
        bump("actions", created);
      } else {
        const memoryType = ["material", "work_product", "decision"].includes(payload.section) ? payload.section : "note";
        const [existing] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM como_next_work_memory WHERE source_system = ? AND source_record_id = ? LIMIT 1`,
          [SOURCE_SYSTEM, row.source_record_id],
        );
        let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
        let created = false;
        if (!targetId) {
          const [result] = await connection.execute<any>(
            `INSERT INTO como_next_work_memory
              (project_id, work_file_id, memory_type, entry_type, title, body, source_status, source_url, source_file_key, source_file_name, mime_type, is_current, source_system, source_record_id, import_batch_id, occurred_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, workFileId, memoryType, safeText(payload.entryType), String(payload.title), safeText(payload.content), safeText(payload.status), safeText(payload.url), safeText(payload.fileKey), safeText(payload.fileName), safeText(payload.mimeType), payload.status === "archived" ? 0 : 1, SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.updatedAt || payload.createdAt), dbTime(payload.createdAt), dbTime(payload.updatedAt)],
          );
          targetId = Number(result.insertId);
          created = true;
        }
        bump("memory", created);
      }
    }
    console.log(`[promotion] actions=${stats.actions?.resolved || 0} memory=${stats.memory?.resolved || 0}`);

    const activityRows = eligibleChildRows("taskActivities");
    const activitiesByTask = new Map<string, StageRow[]>();
    for (const row of activityRows) {
      const payload = jsonParse<any>(row.payload_json);
      const key = stringId(payload.taskId);
      const list = activitiesByTask.get(key) || [];
      list.push(row);
      activitiesByTask.set(key, list);
    }
    for (const [taskId, taskRows] of activitiesByTask) {
      const workFileId = workFileMap.get(taskId);
      const taskRow = rowBy("followUpTasks", taskId);
      const projectId = taskRow ? projectMap.get(stringId(taskRow.source_project_id)) : null;
      if (!workFileId || !projectId) continue;
      taskRows.sort((a, b) => String(jsonParse<any>(a.payload_json).createdAt).localeCompare(String(jsonParse<any>(b.payload_json).createdAt)));
      for (const [activityIndex, row] of taskRows.entries()) {
        const idempotencyKey = `followup:event:${row.source_record_id}`;
        const payload = jsonParse<any>(row.payload_json);
        const [result] = await connection.execute<any>(
            `INSERT IGNORE INTO como_next_work_file_events
              (user_id, project_id, work_file_id, action_id, sequence_no, actor_type, actor_user_id, event_type, summary, payload_json, idempotency_key, occurred_at, created_at)
             VALUES (?, ?, ?, NULL, ?, 'system', ?, ?, ?, ?, ?, ?, ?)`,
            [ownerUserId, projectId, workFileId, activityIndex + 1, ownerUserId, `legacy_${String(payload.eventType || "note")}`.slice(0, 80), String(payload.description || "سجل تاريخي من Follow-up Desk").slice(0, 1000), JSON.stringify({ sourceTable: "taskActivities", sourceRecordId: row.source_record_id }), idempotencyKey, dbTime(payload.createdAt), dbTime(payload.createdAt)],
          );
        bump("events", Number(result.affectedRows || 0) > 0);
      }
    }
    console.log(`[promotion] events=${stats.events?.resolved || 0}`);

    const meetingMap = new Map<string, number>();
    for (const row of (byTable.get("meetings") || []).filter(item => projectMap.has(stringId(item.source_project_id)))) {
      const payload = jsonParse<any>(row.payload_json);
      const projectId = projectMap.get(stringId(row.source_project_id))!;
      const workFileId = workFileMap.get(stringId(payload.followUpTaskId)) || null;
      const projectPartyId = payload.consultantId ? projectPartyMap.get(`${row.source_project_id}:${payload.consultantId}`) || null : null;
      const [existing] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_meetings WHERE source_system = ? AND source_record_id = ? LIMIT 1`, [SOURCE_SYSTEM, row.source_record_id]);
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_meetings
            (project_id, work_file_id, project_party_id, title, objective, meeting_type, meeting_format, meeting_status, starts_at, ends_at, timezone, location, meeting_link, outcome_summary, closed_at, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, workFileId, projectPartyId, String(payload.title), safeText(payload.objective), safeText(payload.meetingType), safeText(payload.meetingFormat), meetingStatusOf(payload.status), dbTime(payload.startsAt), dbTime(payload.endsAt), String(payload.timezone || "Asia/Dubai"), safeText(payload.location), safeText(payload.meetingLink), safeText(payload.closeSummary), dbTime(payload.closedAt), SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      meetingMap.set(row.source_record_id, targetId);
      await updateStageTarget(connection, Number(batch.id), "meetings", row.source_record_id, targetId);
      bump("meetings", created);
    }

    for (const row of byTable.get("meetingParticipants") || []) {
      const payload = jsonParse<any>(row.payload_json);
      const meetingId = meetingMap.get(stringId(payload.meetingId));
      if (!meetingId) continue;
      const [existing] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_meeting_participants WHERE source_system = ? AND source_record_id = ? LIMIT 1`, [SOURCE_SYSTEM, row.source_record_id]);
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_meeting_participants
            (meeting_id, display_name, email, organization_name, participant_role, attendance, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [meetingId, String(payload.name), safeText(payload.email), safeText(payload.company), safeText(payload.role), safeText(payload.attendance), SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      await updateStageTarget(connection, Number(batch.id), "meetingParticipants", row.source_record_id, targetId);
      bump("meetingParticipants", created);
    }

    for (const row of byTable.get("meetingAgendaItems") || []) {
      const payload = jsonParse<any>(row.payload_json);
      const meetingId = meetingMap.get(stringId(payload.meetingId));
      if (!meetingId) continue;
      const [existing] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_meeting_agenda_items WHERE source_system = ? AND source_record_id = ? LIMIT 1`, [SOURCE_SYSTEM, row.source_record_id]);
      let targetId = existing[0]?.id ? Number(existing[0].id) : 0;
      let created = false;
      if (!targetId) {
        const [result] = await connection.execute<any>(
          `INSERT INTO como_next_meeting_agenda_items
            (meeting_id, item_kind, category, prompt_ar, prompt_en, response, is_checked, is_required, sort_order, briefing_note, desired_outcome, audience, priority, source_evidence, source_system, source_record_id, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [meetingId, safeText(payload.kind), safeText(payload.category), safeText(payload.promptAr), safeText(payload.promptEn), safeText(payload.response), Number(payload.checked) ? 1 : 0, Number(payload.isRequired) ? 1 : 0, Number(payload.sortOrder || 0), safeText(payload.briefingNote), safeText(payload.desiredOutcome), safeText(payload.audience), safeText(payload.priority), safeText(payload.sourceEvidence), SOURCE_SYSTEM, row.source_record_id, batchId, dbTime(payload.createdAt), dbTime(payload.updatedAt)],
        );
        targetId = Number(result.insertId);
        created = true;
      }
      await updateStageTarget(connection, Number(batch.id), "meetingAgendaItems", row.source_record_id, targetId);
      bump("meetingAgendaItems", created);
    }
    console.log(`[promotion] meetings=${stats.meetings?.resolved || 0} agenda=${stats.meetingAgendaItems?.resolved || 0}`);

    for (const [taskId, workFileId] of workFileMap) {
      const taskRow = rowBy("followUpTasks", taskId);
      if (!taskRow) continue;
      const taskPayload = jsonParse<any>(taskRow.payload_json);
      const projectId = projectMap.get(stringId(taskRow.source_project_id));
      if (!projectId) continue;
      const idempotencyKey = `followup:promotion:${batchId}:${taskId}`;
      const hasRequiredDecision = taskPayload.status === "decision";
      if (hasRequiredDecision) {
        const decisionEventKey = `followup:decision:${batchId}:${taskId}`;
        const [decisionEventRows] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM como_next_work_file_events WHERE idempotency_key = ? LIMIT 1`,
          [decisionEventKey],
        );
        if (!decisionEventRows[0]?.id) {
          const [sequenceRows] = await connection.query<RowDataPacket[]>(
            `SELECT COALESCE(MAX(sequence_no), 0) AS sequenceNo FROM como_next_work_file_events WHERE work_file_id = ?`,
            [workFileId],
          );
          await connection.execute(
            `INSERT INTO como_next_work_file_events
              (user_id, project_id, work_file_id, action_id, sequence_no, actor_type, actor_user_id, event_type, summary, payload_json, idempotency_key, occurred_at, created_at)
             VALUES (?, ?, ?, NULL, ?, 'system', ?, 'decision_required', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [ownerUserId, projectId, workFileId, Number(sequenceRows[0]?.sequenceNo || 0) + 1, ownerUserId, `قرار مطلوب: ${String(taskPayload.title)}`, JSON.stringify({ batchId, sourceTaskId: taskId }), decisionEventKey],
          );
        }
      }
      const [promotionEventRows] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM como_next_work_file_events WHERE idempotency_key = ? LIMIT 1`,
        [idempotencyKey],
      );
      if (!promotionEventRows[0]?.id) {
        const [sequenceRows] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(MAX(sequence_no), 0) AS sequenceNo FROM como_next_work_file_events WHERE work_file_id = ?`,
          [workFileId],
        );
        await connection.execute(
          `INSERT INTO como_next_work_file_events
            (user_id, project_id, work_file_id, action_id, sequence_no, actor_type, actor_user_id, event_type, summary, payload_json, idempotency_key, occurred_at, created_at)
           VALUES (?, ?, ?, NULL, ?, 'system', ?, 'import_promoted', 'تمت ترقية الملف من Follow-up Desk إلى نواة COMO Next التشغيلية دون تنفيذ أي إجراء خارجي.', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [ownerUserId, projectId, workFileId, Number(sequenceRows[0]?.sequenceNo || 0) + 1, ownerUserId, JSON.stringify({ batchId, sourceTaskId: taskId }), idempotencyKey],
        );
      }
    }

    await connection.execute(`UPDATE como_next_import_batches SET batch_status = 'promoted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [Number(batch.id)]);

    const result = {
      mode: "apply",
      batchId,
      sourceFingerprint: String(batch.source_fingerprint),
      promotionFingerprint: sha256(JSON.stringify({ batchId, expected, stats })),
      expected,
      stats,
      skippedProjectIds: ["30001"],
      externalSideEffects: 0,
      secretsImported: 0,
      documentFilesPendingStorageCopy: 34,
      completedAt: new Date().toISOString(),
    };
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    throw error;
  } finally {
    if (lockAcquired) {
      try { await connection.query(`SELECT RELEASE_LOCK(?)`, [`como-followup-promote:${batchId}`]); } catch {}
    }
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
