import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT openId, name, email, role FROM users ORDER BY createdAt DESC LIMIT 20');
console.table(rows);
await conn.end();
