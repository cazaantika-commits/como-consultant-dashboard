import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(`ALTER TABLE payment_requests MODIFY COLUMN sheikh_decision ENUM('approved','rejected','needs_revision')`);
  console.log("✅ sheikh_decision enum updated");
} catch(e) {
  console.log("Result:", e.message);
}
await conn.end();
