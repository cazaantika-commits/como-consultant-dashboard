import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [cols] = await conn.execute("SHOW COLUMNS FROM projects");
for (const c of cols) console.log(c.Field);
console.log('\n--- Project 4 data ---');
const [rows] = await conn.execute('SELECT * FROM projects WHERE id = 4');
console.log(JSON.stringify(rows[0], null, 2));
await conn.end();
