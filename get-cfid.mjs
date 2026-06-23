import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT id, name FROM cf_projects");
rows.forEach(r => console.log(JSON.stringify(r)));
await conn.end();
