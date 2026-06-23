import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const projects = await db.execute(sql`SELECT id, name FROM projects WHERE name LIKE '%مجان%'`);
console.log('Projects:', JSON.stringify(projects[0]));

if (projects[0].length > 0) {
  const projectId = projects[0][0].id;
  console.log('Project ID:', projectId);
  
  const settings = await db.execute(sql`
    SELECT item_key, distribution_method, start_month, end_month, lump_sum_month, funding_source 
    FROM project_cash_flow_settings 
    WHERE project_id = ${projectId} AND scenario = 'offplan_escrow'
    ORDER BY sort_order
  `);
  console.log('\nCost Settings:');
  for (const row of settings[0]) {
    console.log(JSON.stringify(row));
  }
}

await connection.end();
