import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

// Find Majan 25 project
const [projects] = await conn.execute(
  "SELECT * FROM projects WHERE id = 2"
);

if (projects.length === 0) {
  // Try all projects to find it
  const [allP] = await conn.execute("SELECT id, name FROM projects");
  console.log("All projects:", JSON.stringify(allP, null, 2));
  await conn.end();
  process.exit(0);
}

const project = projects[0];
const projectId = project.id;
console.log("=== PROJECT CARD (بطاقة المشروع) ===");
console.log(JSON.stringify(project, null, 2));

// Get market overview
const [mo] = await conn.execute(
  "SELECT * FROM marketOverview WHERE projectId = ?", [projectId]
);
console.log("\n=== MARKET OVERVIEW (نظرة السوق) ===");
console.log(JSON.stringify(mo[0] || {}, null, 2));

// Get competition pricing
const [cp] = await conn.execute(
  "SELECT * FROM competition_pricing WHERE projectId = ?", [projectId]
);
console.log("\n=== COMPETITION PRICING (التسعير) ===");
console.log(JSON.stringify(cp[0] || {}, null, 2));

// Get cash flow settings
const [cfs] = await conn.execute(
  "SELECT * FROM project_cash_flow_settings WHERE project_id = ?", [projectId]
);
console.log("\n=== CASH FLOW SETTINGS (إعدادات التدفق النقدي) ===");
console.log(JSON.stringify(cfs, null, 2));

await conn.end();
