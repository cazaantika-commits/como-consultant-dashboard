import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  // Check getResults query for project 180001 - does it return duplicates?
  const rows = await db.execute(sql`
    WITH latest_er AS (
      SELECT er2.* FROM cpa_evaluation_results er2
      INNER JOIN (
        SELECT project_consultant_id, MAX(id) as max_id
        FROM cpa_evaluation_results GROUP BY project_consultant_id
      ) mx ON er2.id = mx.max_id
    )
    SELECT pc.id as project_consultant_id, cm.trade_name, ler.can_rank, ler.total_true_cost
    FROM cpa_project_consultants pc
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    LEFT JOIN latest_er ler ON ler.project_consultant_id = pc.id
    WHERE pc.cpa_project_id = 180001
  `);
  console.log("Results for 180001:", JSON.stringify(rows[0], null, 2));
  const pcIds = (rows[0] as any[]).map((r: any) => r.project_consultant_id);
  const dupes = pcIds.filter((id: any, idx: number) => pcIds.indexOf(id) !== idx);
  console.log("Duplicate project_consultant_ids:", dupes);
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
