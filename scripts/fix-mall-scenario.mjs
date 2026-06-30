import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

// Check current scenarios
const [rows] = await conn.query('SELECT id, name, financingScenario FROM projects');
console.log('=== Current scenarios ===');
rows.forEach(r => console.log(r.id, r.name, '->', r.financingScenario));

// Update Mall project (id=1: مركز مجان التجاري) to no_offplan
await conn.query("UPDATE projects SET financingScenario = 'no_offplan' WHERE id = 1");
console.log('\nUpdated مركز مجان التجاري (id=1) to no_offplan');

// Verify
const [updated] = await conn.query('SELECT id, name, financingScenario FROM projects WHERE id = 1');
console.log('Verified:', updated[0]);

await conn.end();
