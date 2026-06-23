import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  const rows = await db.execute(sql`
    SELECT cpa_project_id, consultant_id, COUNT(*) as cnt 
    FROM cpa_project_consultants 
    GROUP BY cpa_project_id, consultant_id 
    HAVING cnt > 1
  `);
  console.log("Duplicate consultants in same project:", JSON.stringify(rows[0]));
  
  const rows2 = await db.execute(sql`
    SELECT id, cpa_project_id, consultant_id FROM cpa_project_consultants 
    WHERE consultant_id IN (210003, 210004, 210005) OR id IN (210003, 210004, 210005)
    ORDER BY cpa_project_id, consultant_id
  `);
  console.log("Rows with IDs 210003-210005:", JSON.stringify(rows2[0]));
  
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
