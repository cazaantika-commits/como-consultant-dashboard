// Test script to run calculation engine directly
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function qRows(query, params = []) {
  const [rows] = await conn.execute(query, params);
  return rows;
}

async function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

async function runCalculationEngine(cpaProjectId) {
  const projects = await qRows(
    `SELECT p.*, bc.id as cat_id, bc.code as cat_code
     FROM cpa_projects p
     LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
     WHERE p.id = ?`, [cpaProjectId]
  );
  if (!projects[0]) throw new Error("CPA project not found");
  const proj = projects[0];
  const catId = proj.building_category_id ?? proj.cat_id;
  console.log(`Project ${cpaProjectId}: catId=${catId}, cat_code=${proj.cat_code}`);

  // allRequiredItems (same query as in runCalculationEngine)
  const allRequiredItems = catId ? await qRows(
    `SELECT si.id, si.code, si.label, scm.status,
            COALESCE(src.cost_aed, 0) as ref_cost
     FROM cpa_scope_category_matrix scm
     JOIN cpa_scope_items si ON si.id = scm.scope_item_id
     LEFT JOIN cpa_scope_reference_costs src
       ON src.scope_item_id = scm.scope_item_id
       AND src.building_category_id = scm.building_category_id
     WHERE scm.building_category_id = ?
       AND scm.status != 'NOT_REQUIRED'
       AND si.item_number NOT IN (10, 11, 12, 13, 44, 45, 46, 47)`, [catId]
  ) : [];

  console.log('allRequiredItems count:', allRequiredItems.length);
  console.log('allRequiredItems with cost > 0:', allRequiredItems.filter(i => Number(i.ref_cost) > 0).map(i => `${i.code}:${i.ref_cost}`));

  // Get consultants
  const consultants = await qRows(
    `SELECT pc.*, cm.trade_name FROM cpa_project_consultants pc
     JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
     WHERE pc.cpa_project_id = ? AND pc.status IN ('DRAFT','CONFIRMED','EVALUATED')`, [cpaProjectId]
  );
  console.log('Consultants:', consultants.map(c => c.trade_name));

  for (const consultant of consultants) {
    const pcId = consultant.id;
    const scopeCoverage = await qRows(
      `SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?`, [pcId]
    );
    const coverageMap = {};
    for (const row of scopeCoverage) {
      coverageMap[Number(row.scope_item_id)] = String(row.coverage_status);
    }

    let designScopeGapCost = 0;
    const gaps = [];
    for (const item of allRequiredItems) {
      const status = coverageMap[item.id] ?? "NOT_MENTIONED";
      if (status === "INCLUDED") continue;
      if (item.status === "NOT_REQUIRED") continue;
      const gap = Number(item.ref_cost);
      designScopeGapCost += gap;
      if (gap > 0) gaps.push(`${item.code}:${gap}`);
    }
    console.log(`\n${consultant.trade_name}: gap=${designScopeGapCost}, gaps=[${gaps.join(', ')}]`);
  }
}

try {
  await runCalculationEngine(240001);
} catch (e) {
  console.error('Error:', e.message);
}

await conn.end();
