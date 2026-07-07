import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Get Majan Mall project building category
const [proj] = await conn.execute(`SELECT id, project_id, building_category_id, duration_months FROM cpa_projects WHERE id = 1`);
console.log('\n=== MAJAN MALL PROJECT ===');
console.table(proj);

const catId = proj[0]?.building_category_id;
console.log('\nBuilding category ID:', catId);

// Get baseline for that category
const [baseline] = await conn.execute(`
  SELECT r.id as role_id, r.code, r.label, r.monthly_rate_aed, 
         b.id as baseline_id, b.required_allocation_pct
  FROM cpa_supervision_roles r
  LEFT JOIN cpa_supervision_baseline b ON r.id = b.supervision_role_id AND b.building_category_id = ?
  WHERE r.is_active = 1
  ORDER BY r.sort_order
`, [catId]);
console.log('\n=== SUPERVISION BASELINE FOR CATEGORY', catId, '===');
console.table(baseline);

await conn.end();
