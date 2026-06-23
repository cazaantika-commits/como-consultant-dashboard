import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

await conn.execute(
  "INSERT INTO approval_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
  ["sheikh_email", "essaabuseif@gmail.com", "essaabuseif@gmail.com"]
);
console.log("✅ sheikh_email updated to essaabuseif@gmail.com");

// Verify
const [rows] = await conn.execute("SELECT * FROM approval_settings WHERE `key` = 'sheikh_email'");
console.log("DB value:", rows);

await conn.end();
