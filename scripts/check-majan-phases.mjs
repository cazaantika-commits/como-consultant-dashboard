import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Check design items for Majan (id=2) O1
const [rows] = await conn.query(
  "SELECT item_key, section, is_active, funding_source, start_month, end_month, distribution_method FROM project_cash_flow_settings WHERE project_id = 2 AND scenario = 'offplan_escrow' AND section IN ('design', 'offplan') ORDER BY section, sort_order"
);
console.log('=== Majan O1 design+offplan items ===', rows.length);
rows.forEach(r => console.log(`[${r.section}] ${r.item_key} | active:${r.is_active} | source:${r.funding_source} | ${r.start_month}-${r.end_month} | ${r.distribution_method}`));

// Check if any design items are investor-funded
const investorDesign = rows.filter(r => r.section === 'design' && r.funding_source === 'investor' && r.is_active);
const investorOffplan = rows.filter(r => r.section === 'offplan' && r.funding_source === 'investor' && r.is_active);
console.log('\n=== Investor-funded design items ===', investorDesign.length);
investorDesign.forEach(r => console.log(r.item_key, r.start_month, r.end_month));
console.log('\n=== Investor-funded offplan items ===', investorOffplan.length);
investorOffplan.forEach(r => console.log(r.item_key, r.start_month, r.end_month));

await conn.end();
