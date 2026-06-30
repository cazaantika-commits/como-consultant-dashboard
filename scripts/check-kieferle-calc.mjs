import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config({ path: "/home/ubuntu/como-consultant-dashboard/.env" });

const db = await createConnection(process.env.DATABASE_URL);

// 1. Get the CPA project for Majan
const [projects] = await db.execute(`SELECT cp.* FROM cpa_projects cp WHERE cp.id IN (SELECT cpa_project_id FROM cpa_project_consultants WHERE id = 210005)`);
console.log("CPA Project:", JSON.stringify(projects[0], null, 2));

// 2. Get KIEFERLE supervision team
const [team] = await db.execute(`SELECT cst.*, sr.code, sr.label FROM cpa_consultant_supervision_team cst JOIN cpa_supervision_roles sr ON sr.id = cst.supervision_role_id WHERE cst.project_consultant_id = 210005`);
console.log("\nKIEFERLE Team:");
team.forEach(r => console.log(` - ${r.code}: rate=${r.proposed_monthly_rate}, alloc=${r.proposed_allocation_pct}`));

// 3. Get building category for this project
const [pc] = await db.execute(`SELECT pc.*, cp.building_category_id FROM cpa_project_consultants pc JOIN cpa_projects cp ON cp.id = pc.cpa_project_id WHERE pc.id = 210005`);
console.log("\nBuilding category_id:", pc[0]?.building_category_id);

// 4. Get supervision baseline for this category
const [baseline] = await db.execute(`SELECT sb.*, sr.code FROM cpa_supervision_baseline sb JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id WHERE sb.building_category_id = ?`, [pc[0]?.building_category_id]);
console.log("\nBaseline for category:");
baseline.forEach(b => console.log(` - ${b.code}: required_alloc=${b.required_allocation_pct}`));

await db.end();
