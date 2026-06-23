import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, projectId, projectName FROM feasibility_studies LIMIT 10');
console.log('All feasibility studies:', JSON.stringify(rows, null, 2));
await conn.end();
