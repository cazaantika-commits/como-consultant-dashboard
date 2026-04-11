// Test script to run the full calculation engine from server code
// This simulates what getResults does

import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

async function qRows(query, params = []) {
  const [rows] = await conn.execute(query, params);
  return rows;
}

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

async function runCalculationEngine(cpaProjectId) {
  console.log(`\n=== Running calculation for project ${cpaProjectId} ===`);
  
  const projects = await qRows(
    `SELECT p.*, bc.id as cat_id, bc.code as cat_code, bc.label as cat_label,
            bc.supervision_duration_months as cat_supervision_months
     FROM cpa_projects p
     LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
     WHERE p.id = ?`, [cpaProjectId]
  );
  if (!projects[0]) throw new Error("CPA project not found");
  const proj = projects[0];
  let catId = proj.building_category_id ?? proj.cat_id;
  const totalConstructionCost = toNum(proj.bua_sqft) * toNum(proj.construction_cost_per_sqft);
  const durationMonths = toNum(proj.duration_months);
  console.log(`catId=${catId}, totalCC=${totalConstructionCost}, duration=${durationMonths}`);

  // allRequiredItems
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

  const supervisionBaseline = catId ? await qRows(
    `SELECT sb.supervision_role_id, sb.required_allocation_pct,
            sr.code, sr.label, sr.monthly_rate_aed
     FROM cpa_supervision_baseline sb
     JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
     WHERE sb.building_category_id = ? AND sb.required_allocation_pct > 0`, [catId]
  ) : [];

  const consultants = await qRows(
    `SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code
     FROM cpa_project_consultants pc
     JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
     WHERE pc.cpa_project_id = ? AND pc.status IN ('DRAFT','CONFIRMED','EVALUATED')`, [cpaProjectId]
  );

  const results = [];
  for (const consultant of consultants) {
    const pcId = consultant.id;
    const notes = { scopeGaps: [], supervisionGaps: [] };

    let quotedDesignFee = 0;
    if (consultant.design_fee_method === "LUMP_SUM") {
      quotedDesignFee = toNum(consultant.design_fee_amount);
    } else if (consultant.design_fee_method === "PERCENTAGE") {
      quotedDesignFee = (totalConstructionCost * toNum(consultant.design_fee_percentage)) / 100;
    }

    const scopeCoverage = await qRows(
      `SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?`, [pcId]
    );
    const coverageMap = {};
    for (const row of scopeCoverage) {
      coverageMap[Number(row.scope_item_id)] = String(row.coverage_status);
    }

    let designScopeGapCost = 0;
    for (const item of allRequiredItems) {
      const status = coverageMap[item.id] ?? "NOT_MENTIONED";
      if (status === "INCLUDED") continue;
      if (item.status === "NOT_REQUIRED") continue;
      const gap = toNum(item.ref_cost);
      designScopeGapCost += gap;
      if (gap > 0) {
        notes.scopeGaps.push({ itemCode: item.code, gapCost: gap });
      }
    }

    const trueDesignFee = quotedDesignFee + designScopeGapCost;
    console.log(`${consultant.trade_name}: quoted=${quotedDesignFee}, gap=${designScopeGapCost}, true=${trueDesignFee}`);

    // Now persist to DB
    const notesJson = JSON.stringify(notes);
    await conn.execute(`DELETE FROM cpa_evaluation_results WHERE project_consultant_id = ?`, [pcId]);
    await conn.execute(
      `INSERT INTO cpa_evaluation_results
        (project_consultant_id, quoted_design_fee, design_scope_gap_cost, true_design_fee,
         quoted_supervision_fee, supervision_gap_cost, adjusted_supervision_fee,
         total_true_cost, eval_rank, can_rank, calculation_notes, calculated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, ?, NOW())`,
      [pcId, quotedDesignFee, designScopeGapCost, trueDesignFee, notesJson]
    );
    console.log(`  -> Saved to DB`);
  }
}

try {
  await runCalculationEngine(240001);
  
  // Verify
  console.log('\n=== Verifying DB values ===');
  const [results] = await conn.execute(`
    SELECT er.design_scope_gap_cost, er.true_design_fee, cm.trade_name, er.calculation_notes
    FROM cpa_evaluation_results er
    JOIN cpa_project_consultants pc ON pc.id = er.project_consultant_id
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    WHERE pc.cpa_project_id = 240001
  `);
  for (const r of results) {
    const notes = r.calculation_notes ? JSON.parse(r.calculation_notes) : {};
    console.log(`${r.trade_name}: gap=${r.design_scope_gap_cost}, gaps=[${notes.scopeGaps?.map(g => g.itemCode).join(',')}]`);
  }
} catch (e) {
  console.error('Error:', e.message, e.stack);
}

await conn.end();
