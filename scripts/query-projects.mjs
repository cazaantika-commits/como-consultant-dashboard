import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);

// Check columns
const [cols] = await conn.query('DESCRIBE projects');
console.log('=== Projects columns ===');
cols.forEach(r => console.log(r.Field, r.Type));

// Get all projects
const [rows] = await conn.query('SELECT id, name FROM projects LIMIT 20');
console.log('\n=== Projects ===');
rows.forEach(r => console.log(r.id, r.name));

await conn.end();
