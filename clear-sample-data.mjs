import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// Delete all payment requests first (foreign key dependency)
const [prResult] = await conn.execute("DELETE FROM payment_requests");
console.log(`✅ Deleted ${prResult.affectedRows} payment requests`);

// Delete all business partners
const [bpResult] = await conn.execute("DELETE FROM business_partners");
console.log(`✅ Deleted ${bpResult.affectedRows} business partners`);

// Verify
const [[{ prCount }]] = await conn.execute("SELECT COUNT(*) as prCount FROM payment_requests");
const [[{ bpCount }]] = await conn.execute("SELECT COUNT(*) as bpCount FROM business_partners");
console.log(`\n📊 Remaining: ${prCount} payment requests, ${bpCount} business partners`);

await conn.end();
console.log("\n✅ All sample data cleared successfully.");
