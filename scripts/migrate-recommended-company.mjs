import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

try {
  // Check if columns already exist
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'general_requests' 
     AND COLUMN_NAME IN ('recommended_company_id', 'recommended_company_name')`
  );

  const existingCols = cols.map(c => c.COLUMN_NAME);

  if (!existingCols.includes("recommended_company_id")) {
    await conn.execute(
      `ALTER TABLE general_requests 
       ADD COLUMN recommended_company_id INT NULL,
       ADD COLUMN recommended_company_name VARCHAR(255) NULL`
    );
    console.log("✅ Added recommended_company_id and recommended_company_name columns");
  } else {
    console.log("ℹ️ Columns already exist, skipping");
  }
} catch (err) {
  console.error("Migration error:", err);
  process.exit(1);
} finally {
  await conn.end();
}
