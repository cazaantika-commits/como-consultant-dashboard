import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== SUPERVISION ROLES ===");
const [roles] = await conn.query("SELECT id, code, label, grade, team_type, monthly_rate_aed, sort_order, is_active FROM cpa_supervision_roles ORDER BY id");
console.table(roles);

console.log("\n=== BUILDING CATEGORIES ===");
const [cats] = await conn.query("SELECT id, code, label FROM cpa_building_categories ORDER BY id");
console.table(cats);

console.log("\n=== BASELINE COLUMNS ===");
const [bcols] = await conn.query("DESCRIBE cpa_supervision_baseline");
console.table(bcols);

console.log("\n=== BASELINE (ALL) ===");
const [baseline] = await conn.query(`
  SELECT b.id, b.building_category_id as catId, c.code as catCode, 
         b.supervision_role_id as roleId, r.code as roleCode, r.label, r.team_type,
         b.required_allocation_pct as allocPct, b.monthly_salary_aed as salary
  FROM cpa_supervision_baseline b 
  JOIN cpa_supervision_roles r ON b.supervision_role_id = r.id
  JOIN cpa_building_categories c ON b.building_category_id = c.id
  ORDER BY c.id, r.id
`);
console.table(baseline);

await conn.end();
