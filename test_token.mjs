import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT accessToken, memberId FROM commandCenterMembers LIMIT 3');
console.log('Members:', JSON.stringify(rows));
await conn.end();
