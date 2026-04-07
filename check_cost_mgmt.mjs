import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env
const envFile = readFileSync("/home/ubuntu/como-consultant-dashboard/.env", "utf8");
const envVars = {};
for (const line of envFile.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && v.length) envVars[k.trim()] = v.join("=").trim();
}

const db = await createConnection(envVars.DATABASE_URL);

// Check Cost Management status in ALL categories
const [rows] = await db.execute(`
  SELECT bc.code as category, bc.label, si.label as service, scm.status
  FROM cpa_scope_category_matrix scm
  JOIN cpa_building_categories bc ON bc.id = scm.building_category_id
  JOIN cpa_scope_items si ON si.id = scm.scope_item_id
  WHERE si.code = 'COST_MANAGEMENT'
  ORDER BY bc.id
`);
console.log("=== COST_MANAGEMENT STATUS PER CATEGORY ===");
console.table(rows);

// Also check what project the user is looking at (25 floors = Large or Mega?)
const [projects] = await db.execute(`
  SELECT p.id, p.name, p.bua_sqft, bc.code as category, bc.label as cat_label
  FROM cpa_projects p
  JOIN cpa_building_categories bc ON bc.id = p.building_category_id
  ORDER BY p.id DESC LIMIT 10
`);
console.log("\n=== PROJECTS AND THEIR CATEGORIES ===");
console.table(projects);

await db.end();
