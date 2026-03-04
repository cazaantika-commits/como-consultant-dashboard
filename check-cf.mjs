import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);
const [rows] = await conn.execute('SELECT id, name, projectId FROM cf_projects ORDER BY id');
console.log(JSON.stringify(rows, null, 2));
const [items] = await conn.execute('SELECT id, cfProjectId, name, totalAmount FROM cf_cost_items ORDER BY cfProjectId, sortOrder');
console.log('Cost items:', JSON.stringify(items, null, 2));

// Also check feasibility studies
const [feas] = await conn.execute('SELECT id, projectId, projectName FROM feasibility_studies ORDER BY id');
console.log('Feasibility studies:', JSON.stringify(feas, null, 2));
await conn.end();
