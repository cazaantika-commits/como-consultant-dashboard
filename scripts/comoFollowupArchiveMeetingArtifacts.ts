import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { storagePut } from "../server/storage";

const PACKAGE = "/home/ubuntu/reports/como-followup-transfer-review/COMO-Follow-up-Desk-Discovery-and-Transfer-Package";
const SOURCE_SYSTEM = "como_followup_archive";

function readJson(name: string) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE, "database/json", `${name}.json`), "utf8"));
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const logEntries = readJson("meetingLogEntries");
  const preparationSources = readJson("meetingPreparationSources");
  const versions = readJson("meetingVersions");
  if (logEntries.length !== 1 || preparationSources.length !== 1 || versions.length !== 2) {
    throw new Error("Unexpected historical meeting artifact counts");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  let uploaded: { key: string; url: string } | null = null;
  try {
    const [meetingRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, project_id AS projectId, work_file_id AS workFileId, source_record_id AS sourceRecordId
         FROM como_next_meetings
        WHERE source_system = 'como_followup_desk'`,
    );
    const meetings = new Map(meetingRows.map(row => [String(row.sourceRecordId), row]));
    for (const sourceId of ["1", "30001", "60001"]) {
      if (!meetings.has(sourceId)) throw new Error(`Promoted meeting ${sourceId} is missing`);
    }

    const preparation = preparationSources[0];
    const pdfPath = path.join(PACKAGE, "storage/referenced-files/06aaaba0cba2_Design_International_Contract_Meeting_Pack_EN_2026-09-22_30bf2367.pdf");
    const pdf = fs.readFileSync(pdfPath);
    if (pdf.byteLength !== Number(preparation.bytes)) throw new Error("Meeting preparation PDF size mismatch");
    const pdfSha = sha256(pdf);
    let documentId: number;
    const [existingDocuments] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_documents WHERE sha256 = ? LIMIT 1`, [pdfSha]);
    if (existingDocuments[0]?.id) {
      documentId = Number(existingDocuments[0].id);
    } else {
      const storageKey = `como-next/private/meeting-preparation/${randomUUID()}.pdf`;
      uploaded = await storagePut(storageKey, pdf, "application/pdf");
      const [documentResult] = await connection.execute<any>(
        `INSERT INTO como_next_documents
          (title, file_name, mime_type, byte_size, sha256, storage_key, storage_url, source_system, source_key, source_url, import_batch_id, created_at)
         VALUES (?, ?, 'application/pdf', ?, ?, ?, 'protected-proxy-only', ?, ?, NULL, NULL, NOW())`,
        ["حزمة تحضير اجتماع Design International", preparation.fileName, pdf.byteLength, pdfSha, storageKey, SOURCE_SYSTEM, `meetingPreparationSources:${preparation.id}`],
      );
      documentId = Number(documentResult.insertId);
    }

    const sourceRows = [
      {
        meetingSourceId: String(preparation.meetingId),
        sourceRecordId: `meetingPreparationSources:${preparation.id}`,
        sourceKind: "preparation",
        visibility: "internal_only",
        title: `حزمة التحضير التاريخية — ${preparation.fileName}`,
        rawText: typeof preparation.analysisDraft === "string" ? preparation.analysisDraft : JSON.stringify(preparation.analysisDraft || {}, null, 2),
        sourceDocumentId: documentId,
        createdAt: preparation.createdAt,
      },
      ...logEntries.map((entry: any) => ({
        meetingSourceId: String(entry.meetingId),
        sourceRecordId: `meetingLogEntries:${entry.id}`,
        sourceKind: "notes",
        visibility: "internal_only",
        title: "سجل اجتماع تاريخي",
        rawText: String(entry.content || "سجل تاريخي بلا محتوى"),
        sourceDocumentId: null,
        createdAt: entry.createdAt,
      })),
      ...versions.map((version: any) => ({
        meetingSourceId: String(version.meetingId),
        sourceRecordId: `meetingVersions:${version.id}`,
        sourceKind: "notes",
        visibility: "meeting_record",
        title: `نسخة اجتماع تاريخية مغلقة — الإصدار ${version.version}`,
        rawText: `${String(version.reason || "")}`.trim() + `\n\n---\nلقطة المصدر التاريخية:\n${String(version.snapshot || "")}`,
        sourceDocumentId: null,
        createdAt: version.createdAt,
      })),
    ];

    await connection.beginTransaction();
    let created = 0;
    for (const source of sourceRows) {
      const meeting = meetings.get(source.meetingSourceId)!;
      const [projectRows] = await connection.query<RowDataPacket[]>(`SELECT userId FROM projects WHERE id = ? LIMIT 1`, [Number(meeting.projectId)]);
      const userId = Number(projectRows[0]?.userId || 0);
      if (!userId) throw new Error(`Project owner unavailable for meeting ${source.meetingSourceId}`);
      const textHash = sha256(source.rawText);
      const [result] = await connection.execute<any>(
        `INSERT IGNORE INTO como_next_meeting_sources
          (meeting_id, source_kind, visibility, title, raw_text, source_document_id, consent_id,
           source_sha256, source_status, created_by_user_id, source_system, source_record_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'archived', ?, ?, ?, ?, ?)`,
        [Number(meeting.id), source.sourceKind, source.visibility, source.title, source.rawText, source.sourceDocumentId, textHash, userId, SOURCE_SYSTEM, source.sourceRecordId, source.createdAt, source.createdAt],
      );
      created += Number(result.affectedRows || 0);
    }
    await connection.commit();

    const [verifyRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count, SUM(source_document_id IS NOT NULL) AS documentCount
         FROM como_next_meeting_sources
        WHERE source_system = ?`,
      [SOURCE_SYSTEM],
    );
    const archived = Number(verifyRows[0]?.count || 0);
    if (archived !== sourceRows.length) throw new Error(`Expected ${sourceRows.length} archived sources, found ${archived}`);
    console.log(JSON.stringify({ success: true, created, archived, documentCount: Number(verifyRows[0]?.documentCount || 0), pdfSha256: pdfSha, storageExposure: "proxy-only" }, null, 2));
  } catch (error) {
    try { await connection.rollback(); } catch { /* no active transaction */ }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
