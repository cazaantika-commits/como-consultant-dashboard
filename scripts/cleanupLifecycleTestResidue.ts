import fs from "node:fs/promises";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";

type StageRow = RowDataPacket & {
  id: number;
  stageCode: string;
  nameAr: string;
  nameEn: string | null;
  isActive: number;
  sortOrder: number;
  createdAt: string;
};

const expectedNames = new Set(["مرحلة اختبارية", "مرحلة معدّلة", "مرحلة للإيقاف"]);
const expectedCount = 39;
const reportPath = "/home/ubuntu/reports/como-agreement-reconciliation/lifecycle-test-residue-backup.json";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [candidates] = await connection.query<StageRow[]>(`
      SELECT id, stageCode, nameAr, nameEn, isActive, sortOrder, createdAt
      FROM lifecycle_stages
      WHERE stageCode LIKE 'STG-CUSTOM-%'
        AND isActive = 0
      ORDER BY id
    `);

    if (candidates.length !== expectedCount) {
      throw new Error(`Refusing cleanup: expected ${expectedCount} inactive custom stages, found ${candidates.length}`);
    }
    for (const row of candidates) {
      if (!expectedNames.has(row.nameAr)) {
        throw new Error(`Refusing cleanup: unexpected custom stage ${row.stageCode} / ${row.nameAr}`);
      }
    }

    const codes = candidates.map(row => row.stageCode);
    const placeholders = codes.map(() => "?").join(",");
    const [referenceRows] = await connection.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM lifecycle_services WHERE stageCode IN (${placeholders})) AS serviceCount,
        (SELECT COUNT(*) FROM project_service_instances WHERE stageCode IN (${placeholders})) AS instanceCount,
        (SELECT COUNT(*) FROM project_stage_status WHERE stageCode IN (${placeholders})) AS projectStatusCount
    `, [...codes, ...codes, ...codes]);
    const refs = referenceRows[0];
    if (Number(refs.serviceCount) || Number(refs.instanceCount) || Number(refs.projectStatusCount)) {
      throw new Error(`Refusing cleanup: lifecycle residue still has references ${JSON.stringify(refs)}`);
    }

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      reason: "Confirmed inactive lifecycle settings smoke-test residue with zero operational references",
      expectedCanonicalStageCountAfterCleanup: 9,
      rows: candidates,
    }, null, 2) + "\n", "utf8");

    await connection.beginTransaction();
    const [result] = await connection.query(`
      DELETE FROM lifecycle_stages
      WHERE stageCode LIKE 'STG-CUSTOM-%'
        AND isActive = 0
        AND nameAr IN ('مرحلة اختبارية', 'مرحلة معدّلة', 'مرحلة للإيقاف')
    `);
    if ((result as { affectedRows: number }).affectedRows !== expectedCount) {
      throw new Error(`Refusing commit: expected to delete ${expectedCount}, deleted ${(result as { affectedRows: number }).affectedRows}`);
    }
    await connection.commit();

    const [[remaining]] = await connection.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS count,
        SUM(CASE WHEN stageCode LIKE 'STG-CUSTOM-%' THEN 1 ELSE 0 END) AS customCount
      FROM lifecycle_stages
    `);
    console.log(JSON.stringify({
      deleted: expectedCount,
      remainingStages: Number(remaining.count),
      remainingCustomStages: Number(remaining.customCount || 0),
      backup: reportPath,
    }, null, 2));
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
