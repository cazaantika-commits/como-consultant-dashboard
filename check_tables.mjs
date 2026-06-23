import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.execute("SHOW TABLES LIKE 'project_%'");
console.log('project_* tables:', tables.map(t => Object.values(t)[0]));
const [lc] = await conn.execute("SHOW TABLES LIKE 'lifecycle_%'");
console.log('lifecycle_* tables:', lc.map(t => Object.values(t)[0]));
await conn.end();
