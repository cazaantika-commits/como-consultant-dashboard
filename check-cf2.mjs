import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.execute("SHOW TABLES LIKE '%feasib%'");
console.log('Feasibility tables:', JSON.stringify(tables));
const [tables2] = await conn.execute("SHOW TABLES LIKE '%feas%'");
console.log('Feas tables:', JSON.stringify(tables2));
// Check the schema for the table name
const [allTables] = await conn.execute("SHOW TABLES");
console.log('All tables:', JSON.stringify(allTables));
await conn.end();
