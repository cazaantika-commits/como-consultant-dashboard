import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  // Check for duplicate IDs in the listByProject query for project 180001 (Majan)
  const rows = await db.execute(sql`
    WITH latest_er AS (
      SELECT er2.id, er2.project_consultant_id, er2.total_true_cost, er2.eval_rank,
             er2.can_rank, er2.quoted_design_fee, er2.design_scope_gap_cost, er2.true_design_fee,
             er2.quoted_supervision_fee, er2.supervision_gap_cost, er2.adjusted_supervision_fee
      FROM cpa_evaluation_results er2
      INNER JOIN (
        SELECT project_consultant_id, MAX(id) as max_id
        FROM cpa_evaluation_results
        GROUP BY project_consultant_id
      ) mx ON er2.id = mx.max_id
    )
    SELECT pc.id, pc.consultant_id, cm.trade_name
    FROM cpa_project_consultants pc
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    LEFT JOIN latest_er ler ON ler.project_consultant_id = pc.id
    WHERE pc.cpa_project_id = 180001
    ORDER BY COALESCE(ler.eval_rank, 999), pc.created_at
  `);
  console.log("Consultants for Majan (180001):", JSON.stringify(rows[0], null, 2));
  console.log("Count:", (rows[0] as any[]).length);
  
  // Check for actual duplicates
  const ids = (rows[0] as any[]).map((r: any) => r.id);
  const dupes = ids.filter((id: any, idx: number) => ids.indexOf(id) !== idx);
  console.log("Duplicate IDs:", dupes);
  
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
