import { createConnection } from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await createConnection(url);
const [rows] = await conn.execute('SELECT id, name, category, totalAmount, paymentType, paymentParams, fundingSource, escrowEligible, phaseTag FROM cf_cost_items ORDER BY sortOrder');
for (const r of rows) {
  console.log(JSON.stringify(r));
}
await conn.end();
