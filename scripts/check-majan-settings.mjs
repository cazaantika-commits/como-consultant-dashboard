import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Check columns first
const [cols] = await conn.query('DESCRIBE project_cash_flow_settings');
console.log('=== Columns ===');
cols.forEach(c => console.log(c.Field));

// Check saved settings for Majan (id=2) O1
const [rows] = await conn.query(
  "SELECT * FROM project_cash_flow_settings WHERE project_id = 2 AND scenario = 'offplan_escrow' LIMIT 30"
);
console.log('\n=== Majan O1 saved settings ===', rows.length, 'rows');
rows.forEach(r => {
  const keys = Object.keys(r);
  console.log(keys.map(k => `${k}=${r[k]}`).join(' | '));
});

await conn.end();
