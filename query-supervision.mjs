import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Get all supervision roles with their baseline for building_category_id = 90001 (retail/mall)
const [roles] = await conn.execute(`
  SELECT r.id, r.code, r.label, r.grade, r.monthly_rate_aed, r.sort_order,
         b.id as baseline_id, b.building_category_id, b.required_allocation_pct
  FROM cpa_supervision_roles r
  LEFT JOIN cpa_supervision_baseline b ON r.id = b.supervision_role_id AND b.building_category_id = 90001
  WHERE r.is_active = 1
  ORDER BY r.sort_order
`);

console.log('=== SUPERVISION ROLES + BASELINE (building_category=90001) ===');
for (const r of roles) {
  console.log(`ID:${r.id} | ${r.code} | ${r.label} | rate:${r.monthly_rate_aed} | baseline_alloc:${r.required_allocation_pct ?? 'NULL'}`);
}

// Also get building categories
const [cats] = await conn.execute(`SELECT id, name FROM cpa_building_categories ORDER BY id`);
console.log('\n=== BUILDING CATEGORIES ===');
for (const c of cats) console.log(`ID:${c.id} | ${c.name}`);

await conn.end();
