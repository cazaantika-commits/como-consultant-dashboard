import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [feas] = await conn.execute('SELECT id, projectId, projectName FROM feasibilityStudies ORDER BY id');
console.log('Feasibility studies:', JSON.stringify(feas, null, 2));
await conn.end();
