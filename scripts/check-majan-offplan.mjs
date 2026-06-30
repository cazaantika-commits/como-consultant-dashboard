import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Check offplan items for Majan (id=2) O1
const [rows] = await conn.query(
  "SELECT item_key, section, is_active, start_month, end_month, distribution_method FROM project_cash_flow_settings WHERE project_id = 2 AND scenario = 'offplan_escrow' AND section = 'offplan'"
);
console.log('=== Majan O1 offplan items ===', rows.length);
rows.forEach(r => console.log(r.item_key, 'active:', r.is_active, 'start:', r.start_month, 'end:', r.end_month));

// Check construction start month
const [cRows] = await conn.query(
  "SELECT item_key, section, start_month, end_month FROM project_cash_flow_settings WHERE project_id = 2 AND scenario = 'offplan_escrow' AND section = 'construction' LIMIT 3"
);
console.log('\n=== Construction start months ===');
cRows.forEach(r => console.log(r.item_key, 'start:', r.start_month, 'end:', r.end_month));

await conn.end();
