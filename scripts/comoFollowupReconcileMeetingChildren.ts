import mysql, { type RowDataPacket } from "mysql2/promise";

const mappings = [
  { sourceTable: "meetingParticipants", targetTable: "como_next_meeting_participants" },
  { sourceTable: "meetingAgendaItems", targetTable: "como_next_meeting_agenda_items" },
] as const;

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    await connection.beginTransaction();
    const results: Record<string, { reviewed: number; updated: number; remaining: number }> = {};
    for (const mapping of mappings) {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT import_row.id AS importRowId, import_row.target_id AS existingTargetId,
                target_row.id AS resolvedTargetId
           FROM como_next_import_rows import_row
           JOIN ${mapping.targetTable} target_row
             ON target_row.source_system = 'como_followup_desk'
            AND target_row.source_record_id = import_row.source_record_id
          WHERE import_row.source_table = ?
            AND import_row.disposition = 'create_child'`,
        [mapping.sourceTable],
      );
      if (!rows.length) throw new Error(`No staged rows found for ${mapping.sourceTable}`);
      let updated = 0;
      for (const row of rows) {
        const existingTargetId = row.existingTargetId === null ? null : Number(row.existingTargetId);
        const resolvedTargetId = Number(row.resolvedTargetId);
        if (existingTargetId !== null && existingTargetId !== resolvedTargetId) {
          throw new Error(`Conflicting target for ${mapping.sourceTable} import row ${row.importRowId}`);
        }
        if (existingTargetId === null) {
          const [result] = await connection.execute<any>(
            `UPDATE como_next_import_rows SET target_id = ? WHERE id = ? AND target_id IS NULL`,
            [resolvedTargetId, Number(row.importRowId)],
          );
          updated += Number(result.affectedRows || 0);
        }
      }
      const [remainingRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count
           FROM como_next_import_rows
          WHERE source_table = ? AND disposition = 'create_child' AND target_id IS NULL`,
        [mapping.sourceTable],
      );
      const remaining = Number(remainingRows[0]?.count || 0);
      if (remaining !== 0) throw new Error(`Unresolved staged targets remain for ${mapping.sourceTable}`);
      results[mapping.sourceTable] = { reviewed: rows.length, updated, remaining };
    }
    await connection.commit();
    console.log(JSON.stringify({ success: true, ...results }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
