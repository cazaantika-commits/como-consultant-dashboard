import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

const alterStatements = [
  // Add projectId column (FK to projects)
  `ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS project_id INT NULL AFTER project_name`,
  // Add partnerId column (FK to business_partners)
  `ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS partner_id INT NULL AFTER related_party`,
  // Add unified multi-file attachments JSON
  `ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS attachments_json TEXT NULL AFTER additional_attachments`,
  // Add approval document URL
  `ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS approval_document_url TEXT NULL AFTER finance_email_sent_at`,
];

for (const sql of alterStatements) {
  try {
    await connection.execute(sql);
    console.log(`✅ OK: ${sql.slice(0, 80)}...`);
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log(`⏭️  Already exists: ${sql.slice(0, 80)}...`);
    } else {
      console.error(`❌ Error: ${err.message}`);
      console.error(`   SQL: ${sql}`);
    }
  }
}

await connection.end();
console.log("\nMigration complete.");
