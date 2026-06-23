import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Delete O2 settings for projects 1 and 5 (wrong data)
// They will regenerate from correct defaults when user opens the settings page
const result1 = await db.execute(sql`
  DELETE FROM project_cash_flow_settings 
  WHERE project_id = 1 AND scenario = 'offplan_construction'
`);
console.log('Deleted O2 for project 1 (مجان):', result1[0].affectedRows, 'rows');

const result5 = await db.execute(sql`
  DELETE FROM project_cash_flow_settings 
  WHERE project_id = 5 AND scenario = 'offplan_construction'
`);
console.log('Deleted O2 for project 5 (ند الشبا 2):', result5[0].affectedRows, 'rows');

// Verify
const check = await db.execute(sql`
  SELECT project_id, scenario, COUNT(*) as cnt
  FROM project_cash_flow_settings
  WHERE project_id IN (1, 5) AND scenario = 'offplan_construction'
  GROUP BY project_id, scenario
`);
console.log('\nRemaining O2 rows for projects 1,5:', check[0]);

await connection.end();
