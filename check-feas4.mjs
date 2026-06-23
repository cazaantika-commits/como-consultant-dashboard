import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, projectId, projectName FROM feasibilityStudies');
console.log('Count:', rows.length);
for (const r of rows) console.log(JSON.stringify(r));
await conn.end();
