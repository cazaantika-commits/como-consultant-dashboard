import mysql from "mysql2/promise";

const BATCH_ID = "COMO-FUD-2026-09-25-02";
const SOURCE_SYSTEM = "como-follow-up-desk";
const apply = process.argv.includes("--apply");

const directCommunicationTypes = new Set([
  "بريد مرسل",
  "بريد وارد",
  "مسودة بريد",
  "مسودة رد",
  "بريد صادر",
  "بريد",
  "email_sent",
  "email_draft",
  "email_received",
  "إشعار آلي",
  "اقتراح موعد مرسل",
  "رابط اجتماع مرسل",
  "رد بريد مرسل",
  "طلب موقف داخلي مرسل",
  "قرار مرسل",
  "مشاركة عرض مرسلة",
]);

type Direction = "inbound" | "outbound" | "internal";
type Status = "received" | "draft" | "approved_for_send" | "sent" | "cancelled" | "archived";
type Approval = "not_required" | "pending" | "approved" | "rejected";

function includesAny(value: string, parts: string[]) {
  return parts.some(part => value.includes(part));
}

function classify(entryType: string, title: string, body: string): { direction: Direction; status: Status; approval: Approval; channel: "email" | "internal" } {
  const text = `${title}\n${body}`;
  const normalizedType = entryType.toLowerCase();
  if (entryType === "طلب موقف داخلي مرسل") {
    return { direction: "internal", status: "sent", approval: "not_required", channel: "internal" };
  }
  if (includesAny(normalizedType, ["وارد", "received"]) || entryType === "إشعار آلي" || entryType === "بريد") {
    return { direction: "inbound", status: "received", approval: "not_required", channel: "email" };
  }
  if (includesAny(normalizedType, ["مسودة", "draft"])) {
    if (includesAny(text, ["لم تُرسل", "لم ترسل", "حُذفت", "حذفت", "غير لازمة", "متجاوزة"])) {
      return { direction: "outbound", status: "cancelled", approval: "rejected", channel: "email" };
    }
    if (includesAny(text, ["أُرسلت", "أُرسل", "أرسل عبدالرحمن", "تحقق الإرسال", "سُجلت في Sent", "سجلت في Sent", "ثم أرسلها", "Sent UID"])) {
      return { direction: "outbound", status: "sent", approval: "approved", channel: "email" };
    }
    return { direction: "outbound", status: "draft", approval: "pending", channel: "email" };
  }
  return { direction: "outbound", status: "sent", approval: "not_required", channel: "email" };
}

function extractHeader(body: string, label: string) {
  const match = body.match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
}

function externalReference(title: string, body: string) {
  const text = `${title}\n${body}`;
  const match = text.match(/\b(Inbox|Sent|Draft|IMAP)\s+UID\s*[:#-]?\s*(\d+)/i);
  return match ? `${match[1]} UID ${match[2]}` : null;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [batchRows] = await connection.query<any[]>(
      "SELECT id, batch_status AS batchStatus FROM como_next_import_batches WHERE batch_id = ? LIMIT 1",
      [BATCH_ID],
    );
    const batch = batchRows[0];
    if (!batch || batch.batchStatus !== "promoted") throw new Error("The approved promoted batch is unavailable");

    const [memoryRows] = await connection.query<any[]>(`
      SELECT memory.id, memory.project_id AS projectId, memory.work_file_id AS workFileId,
        memory.entry_type AS entryType, memory.title, memory.body,
        memory.source_record_id AS sourceRecordId, memory.occurred_at AS occurredAt,
        work_file.user_id AS userId
      FROM como_next_work_memory memory
      JOIN como_next_work_files work_file ON work_file.id = memory.work_file_id AND work_file.project_id = memory.project_id
      WHERE memory.import_batch_id = ?
      ORDER BY memory.id
    `, [BATCH_ID]);

    const candidates = memoryRows
      .filter(row => directCommunicationTypes.has(String(row.entryType || "")))
      .map(row => {
        const body = String(row.body || "");
        const classification = classify(String(row.entryType || ""), String(row.title || ""), body);
        return {
          ...row,
          ...classification,
          fromText: extractHeader(body, "From"),
          toText: extractHeader(body, "To"),
          ccText: extractHeader(body, "CC"),
          externalMessageRef: externalReference(String(row.title || ""), body),
        };
      });

    const summary = candidates.reduce<Record<string, number>>((acc, row) => {
      const key = `${row.direction}:${row.status}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    if (!apply) {
      console.log(JSON.stringify({ mode: "plan", batchId: BATCH_ID, candidateCount: candidates.length, summary, externalSideEffects: 0 }, null, 2));
      return;
    }

    let inserted = 0;
    for (const row of candidates) {
      const [result] = await connection.execute<any>(`
        INSERT IGNORE INTO como_next_communications (
          user_id, project_id, work_file_id, source_memory_id,
          channel, direction, communication_status, approval_status,
          subject, body, from_text, to_text, cc_text, external_message_ref,
          occurred_at, sent_at, source_system, source_record_id, import_batch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        Number(row.userId), Number(row.projectId), Number(row.workFileId), Number(row.id),
        row.channel, row.direction, row.status, row.approval,
        String(row.title || "مراسلة بلا عنوان"), String(row.body || ""), row.fromText, row.toText, row.ccText, row.externalMessageRef,
        row.occurredAt, row.status === "sent" ? row.occurredAt : null,
        SOURCE_SYSTEM, `work-memory:${row.sourceRecordId || row.id}`, BATCH_ID,
      ]);
      inserted += Number(result.affectedRows || 0);
    }

    const [countRows] = await connection.query<any[]>(
      "SELECT COUNT(*) AS total FROM como_next_communications WHERE import_batch_id = ?",
      [BATCH_ID],
    );
    console.log(JSON.stringify({ mode: "apply", batchId: BATCH_ID, candidateCount: candidates.length, inserted, total: Number(countRows[0]?.total || 0), summary, externalSideEffects: 0 }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
