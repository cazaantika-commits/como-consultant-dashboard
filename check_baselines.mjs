import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const cats = [
  {id: 30006, name: 'VILLA'},
  {id: 30007, name: 'SMALL'},
  {id: 30008, name: 'MEDIUM'},
  {id: 30009, name: 'LARGE'},
  {id: 30010, name: 'MEGA'}
];

for (const cat of cats) {
  const [rows] = await conn.query(`
    SELECT r.code, r.label, r.monthly_rate_aed as rate, b.required_allocation_pct as pct
    FROM cpa_supervision_baseline b
    JOIN cpa_supervision_roles r ON r.id = b.supervision_role_id
    WHERE b.building_category_id = ? AND b.required_allocation_pct > 0 AND r.is_active = 1
    ORDER BY r.sort_order, r.id
  `, [cat.id]);
  console.log(`\n=== ${cat.name} (${cat.id}) — ${rows.length} roles ===`);
  for (const r of rows) {
    console.log(`  ${r.code.padEnd(20)} ${r.label.padEnd(35)} rate=${String(r.rate).padStart(8)}  pct=${String(r.pct).padStart(7)}`);
  }
}

await conn.end();
