import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, name, category, totalAmount, paymentType, fundingSource, escrowEligible, phaseTag, paymentParams FROM cf_cost_items ORDER BY sortOrder');
for (const r of rows) {
  console.log(JSON.stringify(r));
}
await conn.end();
