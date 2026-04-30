import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  // Check all project_consultants for consultant_ids 4, 8, 9
  const rows = await db.execute(sql`
    SELECT pc.id, pc.cpa_project_id, pc.consultant_id, cm.trade_name
    FROM cpa_project_consultants pc
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    WHERE pc.consultant_id IN (4, 8, 9)
    ORDER BY pc.consultant_id, pc.cpa_project_id
  `);
  console.log("All entries for consultants 4,8,9:", JSON.stringify(rows[0], null, 2));
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
