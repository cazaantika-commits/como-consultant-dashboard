import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get ARTEC (AAEC) pc_id in project 180001
  const [pcRows] = await conn.query(`SELECT pc.id as pc_id FROM cpa_project_consultants pc JOIN cpa_consultants_master cm ON pc.consultant_id = cm.id WHERE pc.cpa_project_id = 180001 AND cm.code = 'AAEC'`);
  const pcId = pcRows[0].pc_id;
  console.log('AAEC PC ID:', pcId);
  
  // Get stored evaluation results
  const [results] = await conn.query(`SELECT design_scope_gap_cost, true_design_fee, quoted_design_fee, total_true_cost FROM cpa_evaluation_results WHERE project_consultant_id = ?`, [pcId]);
  console.log('Stored results:', JSON.stringify(results[0]));
  
  // Get project category
  const [project] = await conn.query('SELECT building_category_id FROM cpa_projects WHERE id = 180001');
  const catId = project[0].building_category_id;
  console.log('Category ID:', catId);
  
  // Get required items for this category (same query as runCalculationEngine)
  const [required] = await conn.query(`SELECT si.id, si.code, si.label, si.item_number, scm.status,
       COALESCE(MAX(src.cost_aed), 0) as ref_cost, ss.code as section_code
    FROM cpa_scope_category_matrix scm
    JOIN cpa_scope_items si ON si.id = scm.scope_item_id
    LEFT JOIN cpa_scope_reference_costs src ON src.scope_item_id = scm.scope_item_id AND src.building_category_id = scm.building_category_id
    LEFT JOIN cpa_scope_sections ss ON ss.id = si.section_id
    WHERE scm.building_category_id = ? AND scm.status != 'NOT_REQUIRED' AND (ss.code IS NULL OR ss.code != 'CONTRACT') AND si.item_number > 11 AND si.is_active = 1
    GROUP BY si.id, si.code, si.label, si.item_number, scm.status, ss.code`, [catId]);
  console.log('Required items:', required.length, required.map(r => r.code));
  
  // Get AAEC's coverage from cpa_consultant_scope_coverage
  const [coverage] = await conn.query('SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?', [pcId]);
  console.log('Coverage records:', coverage.length);
  
  // Find gaps (same logic as runCalculationEngine)
  const coveredMap = {};
  coverage.forEach(c => { coveredMap[c.scope_item_id] = c.coverage_status; });
  
  let designScopeGapCost = 0;
  const gaps = [];
  for (const item of required) {
    const status = coveredMap[item.id] || 'NOT_MENTIONED';
    if (status === 'INCLUDED') continue;
    if (item.status === 'NOT_REQUIRED') continue;
    if (item.item_number && item.item_number <= 11) continue;
    const gap = Number(item.ref_cost);
    designScopeGapCost += gap;
    if (gap > 0) gaps.push({ code: item.code, status, cost: gap });
  }
  
  console.log('\nGap items:');
  gaps.forEach(g => console.log('  ', g.code, ':', g.status, '=', g.cost));
  console.log('\nTotal gap (live calc):', designScopeGapCost);
  console.log('Stored gap:', results[0]?.design_scope_gap_cost);
  console.log('MATCH:', designScopeGapCost === Number(results[0]?.design_scope_gap_cost));
  
  await conn.end();
}
main();
