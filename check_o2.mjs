import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Check O2 settings for project 1
const o2 = await db.execute(sql`
  SELECT item_key, distribution_method, start_month, end_month, lump_sum_month, funding_source 
  FROM project_cash_flow_settings 
  WHERE project_id = 1 AND scenario = 'offplan_construction'
  ORDER BY sort_order
`);
console.log('\n=== O2 (offplan_construction) ===');
for (const row of o2[0]) {
  console.log(JSON.stringify(row));
}

// Check O3 settings for project 1
const o3 = await db.execute(sql`
  SELECT item_key, distribution_method, start_month, end_month, lump_sum_month, funding_source 
  FROM project_cash_flow_settings 
  WHERE project_id = 1 AND scenario = 'no_offplan'
  ORDER BY sort_order
`);
console.log('\n=== O3 (no_offplan) ===');
for (const row of o3[0]) {
  console.log(JSON.stringify(row));
}

await connection.end();
