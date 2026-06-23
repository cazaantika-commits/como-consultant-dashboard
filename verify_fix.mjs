// verify_fix.mjs — Check what the DB shows for Cost Management in cpa_scope_category_matrix
import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Check what building categories exist
const [cats] = await db.query('SELECT id, code, label FROM cpa_building_categories ORDER BY sort_order');
console.log('\n=== Building Categories ===');
console.table(cats);

// 2. Check Cost Management status per category
const [costMgmt] = await db.query(`
  SELECT bc.code as category, bc.label as cat_label, si.code as item_code, si.label as item_label, scm.status
  FROM cpa_scope_category_matrix scm
  JOIN cpa_scope_items si ON si.id = scm.scope_item_id
  JOIN cpa_building_categories bc ON bc.id = scm.building_category_id
  WHERE si.code IN ('COST_MANAGEMENT', 'VALUE_ENGINEERING', 'LEED')
  ORDER BY si.code, bc.sort_order
`);
console.log('\n=== Cost Management / Value Engineering / LEED Status per Category ===');
console.table(costMgmt);

// 3. Check what project "ند الشبا" uses as building_category_id
const [projects] = await db.query(`
  SELECT p.id, p.plot_number, p.building_category_id, bc.code as cat_code, bc.label as cat_label
  FROM cpa_projects p
  LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
  ORDER BY p.id
`);
console.log('\n=== CPA Projects with their Building Categories ===');
console.table(projects);

// 4. Check what mandatoryItems the calculation engine would use for the first project
if (projects[0]) {
  const catId = projects[0].building_category_id;
  if (catId) {
    const [required] = await db.query(`
      SELECT si.id, si.code, si.label, scm.status
      FROM cpa_scope_category_matrix scm
      JOIN cpa_scope_items si ON si.id = scm.scope_item_id
      WHERE scm.building_category_id = ?
        AND scm.status != 'NOT_REQUIRED'
        AND si.item_number NOT IN (10, 11, 12, 13, 44, 45, 46, 47)
      ORDER BY si.item_number
    `, [catId]);
    console.log(`\n=== allRequiredItems for project ${projects[0].plot_number} (catId=${catId}) ===`);
    console.table(required);
  } else {
    console.log('\n⚠️ Project has no building_category_id set!');
  }
}

await db.end();
