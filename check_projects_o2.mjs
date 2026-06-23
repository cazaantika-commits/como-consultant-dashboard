import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// List all projects
const projects = await db.execute(sql`SELECT id, name FROM projects ORDER BY id`);
console.log('=== All Projects ===');
for (const p of projects[0]) {
  console.log(`ID=${p.id} | ${p.name}`);
}

// Check O2 design_fee per project
console.log('\n=== O2 design_fee per project ===');
const o2design = await db.execute(sql`
  SELECT p.id, p.name, s.start_month, s.end_month
  FROM project_cash_flow_settings s
  JOIN projects p ON p.id = s.project_id
  WHERE s.scenario = 'offplan_construction' AND s.item_key = 'design_fee'
  ORDER BY p.id
`);
for (const row of o2design[0]) {
  console.log(`Project ${row.id} (${row.name}): start=${row.start_month} end=${row.end_month}`);
}

// Check O1 design_fee per project
console.log('\n=== O1 design_fee per project ===');
const o1design = await db.execute(sql`
  SELECT p.id, p.name, s.start_month, s.end_month
  FROM project_cash_flow_settings s
  JOIN projects p ON p.id = s.project_id
  WHERE s.scenario = 'offplan_escrow' AND s.item_key = 'design_fee'
  ORDER BY p.id
`);
for (const row of o1design[0]) {
  console.log(`Project ${row.id} (${row.name}): start=${row.start_month} end=${row.end_month}`);
}

// Check O3 design_fee per project
console.log('\n=== O3 design_fee per project ===');
const o3design = await db.execute(sql`
  SELECT p.id, p.name, s.start_month, s.end_month
  FROM project_cash_flow_settings s
  JOIN projects p ON p.id = s.project_id
  WHERE s.scenario = 'no_offplan' AND s.item_key = 'design_fee'
  ORDER BY p.id
`);
for (const row of o3design[0]) {
  console.log(`Project ${row.id} (${row.name}): start=${row.start_month} end=${row.end_month}`);
}

await connection.end();
