import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// The 3 affected projects: 1 (مجان), 5 (ند الشبا 2), 6 (ند الشبا 3)
// Problem: O2 settings were saved with wrong start/end months
// The O2 settings show start=6, end=23 for many items that should follow O1 values

// Let's compare O1 vs O2 for projects 1, 5, 6
for (const projectId of [1, 5, 6]) {
  console.log(`\n=== Project ${projectId} ===`);
  
  const o1 = await db.execute(sql`
    SELECT item_key, distribution_method, start_month, end_month, lump_sum_month
    FROM project_cash_flow_settings 
    WHERE project_id = ${projectId} AND scenario = 'offplan_escrow'
    ORDER BY sort_order
  `);
  
  const o2 = await db.execute(sql`
    SELECT item_key, distribution_method, start_month, end_month, lump_sum_month
    FROM project_cash_flow_settings 
    WHERE project_id = ${projectId} AND scenario = 'offplan_construction'
    ORDER BY sort_order
  `);
  
  const o1Map = new Map(o1[0].map(r => [r.item_key, r]));
  const o2Map = new Map(o2[0].map(r => [r.item_key, r]));
  
  console.log('Items where O2 differs from O1:');
  for (const [key, o2row] of o2Map) {
    const o1row = o1Map.get(key);
    if (!o1row) continue;
    if (o1row.start_month !== o2row.start_month || o1row.end_month !== o2row.end_month || o1row.lump_sum_month !== o2row.lump_sum_month) {
      console.log(`  ${key}: O1(${o1row.start_month}-${o1row.end_month}/lump=${o1row.lump_sum_month}) vs O2(${o2row.start_month}-${o2row.end_month}/lump=${o2row.lump_sum_month})`);
    }
  }
}

await connection.end();
