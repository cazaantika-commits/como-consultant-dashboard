import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get SMALL category id
const [cats] = await conn.execute("SELECT id, code, label FROM cpa_building_categories WHERE code = 'SMALL'");
console.log('SMALL cat:', JSON.stringify(cats[0]));
const catId = cats[0]?.id;

// Get supervision baseline for SMALL
const [baseline] = await conn.execute(`
  SELECT sb.supervision_role_id, sb.required_allocation_pct, sb.building_category_id,
         sr.code, sr.label, sr.monthly_rate_aed 
  FROM cpa_supervision_baseline sb 
  JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id 
  WHERE sb.building_category_id = ?
`, [catId]);
console.log('\nBaseline for SMALL:');
baseline.forEach(r => console.log(`  ${r.code} (${r.label}): required=${r.required_allocation_pct}%, rate=${r.monthly_rate_aed}`));

// Check what the settings page saves - look at the updateSupervisionSettings procedure
const [allBaseline] = await conn.execute(`
  SELECT sb.supervision_role_id, sb.building_category_id, sb.required_allocation_pct,
         sr.code, sr.label, bc.code as cat_code
  FROM cpa_supervision_baseline sb
  JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
  JOIN cpa_building_categories bc ON bc.id = sb.building_category_id
  ORDER BY bc.code, sr.code
`);
console.log('\nAll baseline entries:');
allBaseline.forEach(r => console.log(`  [${r.cat_code}] ${r.code}: ${r.required_allocation_pct}%`));

await conn.end();
process.exit(0);
