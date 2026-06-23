import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS agentActivityLog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agentName VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      project VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log("✅ agentActivityLog table created successfully");
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
