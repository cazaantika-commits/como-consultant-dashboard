/**
 * Direct DB recalculation for all CPA projects
 * Calls the calculation engine logic directly without HTTP
 */
import mysql from 'mysql2/promise';

const PROJECT_IDS = [180001, 210001, 240001, 240002, 270001, 300001];

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

async function runEngine(conn, cpaProjectId) {
  // Get project
  const [projects] = await conn.query(
    `SELECT p.*, bc.id as cat_id, bc.code as cat_code, bc.label as cat_label,
            bc.supervision_duration_months as cat_supervision_months
     FROM cpa_projects p
     LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
     WHERE p.id = ?`, [cpaProjectId]
  );
  if (!projects[0]) throw new Error('Project not found: ' + cpaProjectId);
  const proj = projects[0];
  const catId = proj.building_category_id || proj.cat_id;
  const totalCC = toNum(proj.bua_sqft) * toNum(proj.construction_cost_per_sqft);
  const durationMonths = toNum(proj.duration_months);

  // Get all required scope items (with GROUP BY to prevent duplicates)
  const [allRequiredItems] = catId ? await conn.query(
    `SELECT si.id, si.code, si.label, scm.status,
            COALESCE(MAX(src.cost_aed), 0) as ref_cost
     FROM cpa_scope_category_matrix scm
     JOIN cpa_scope_items si ON si.id = scm.scope_item_id
     LEFT JOIN cpa_scope_reference_costs src
       ON src.scope_item_id = scm.scope_item_id
       AND src.building_category_id = scm.building_category_id
     WHERE scm.building_category_id = ?
       AND scm.status != 'NOT_REQUIRED'
     GROUP BY si.id, si.code, si.label, scm.status`, [catId]
  ) : [[]];

  // Get supervision baseline
  const [supervisionBaseline] = catId ? await conn.query(
    `SELECT sb.supervision_role_id, sb.required_allocation_pct,
            sr.code, sr.label, sr.monthly_rate_aed
     FROM cpa_supervision_baseline sb
     JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
     WHERE sb.building_category_id = ?
       AND sb.required_allocation_pct > 0
       AND sr.is_active = 1`, [catId]
  ) : [[]];

  // Get role aliases
  const [roleAliases] = await conn.query(
    `SELECT a.alias_code, a.canonical_role_id FROM cpa_supervision_role_aliases a`
  );
  const aliasMap = {};
  for (const a of roleAliases) aliasMap[a.alias_code] = a.canonical_role_id;

  // Get all project consultants
  const [consultants] = await conn.query(
    `SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code
     FROM cpa_project_consultants pc
     JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
     WHERE pc.cpa_project_id = ?`, [cpaProjectId]
  );

  let updated = 0;
  for (const pc of consultants) {
    const pcId = pc.id;

    // Get scope coverage
    const [scopeRows] = await conn.query(
      `SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?`, [pcId]
    );
    const coverageMap = {};
    for (const row of scopeRows) coverageMap[row.scope_item_id] = row.coverage_status;

    // Calculate design gap
    let designGap = 0;
    for (const item of allRequiredItems) {
      const status = coverageMap[item.id] || 'NOT_MENTIONED';
      if (status === 'INCLUDED') continue;
      if (item.status === 'NOT_REQUIRED') continue;
      designGap += toNum(item.ref_cost);
    }

    // Quoted design fee
    let quotedDesign = 0;
    if (pc.design_fee_method === 'LUMP_SUM') {
      quotedDesign = toNum(pc.design_fee_amount);
    } else if (pc.design_fee_method === 'PERCENTAGE') {
      quotedDesign = totalCC * toNum(pc.design_fee_percentage) / 100;
    }
    const trueDesign = quotedDesign + designGap;

    // Supervision fee
    let adjSup = 0;
    if (pc.supervision_submitted) {
      if (pc.supervision_fee_method === 'LUMP_SUM') {
        const statedMonths = toNum(pc.supervision_stated_duration_months) || durationMonths;
        const quotedSup = toNum(pc.supervision_fee_amount);
        // Get supervision team
        const [supTeam] = await conn.query(
          `SELECT cst.supervision_role_id, cst.proposed_allocation_pct, cst.proposed_monthly_rate
           FROM cpa_consultant_supervision_team cst
           WHERE cst.project_consultant_id = ?`, [pcId]
        );
        const teamMap = {};
        for (const row of supTeam) teamMap[row.supervision_role_id] = row;

        let supGap = 0;
        for (const baseline of supervisionBaseline) {
          const roleId = baseline.supervision_role_id;
          const reqPct = toNum(baseline.required_allocation_pct);
          const stdRate = toNum(baseline.monthly_rate_aed);
          const teamEntry = teamMap[roleId];
          const propPct = teamEntry ? toNum(teamEntry.proposed_allocation_pct) : 0;
          const propRate = teamEntry ? toNum(teamEntry.proposed_monthly_rate) : 0;
          if (propPct < reqPct) {
            const missingPct = reqPct - propPct;
            supGap += (stdRate * missingPct / 100) * durationMonths;
          }
        }
        // Adjust for duration difference
        const monthRatio = statedMonths > 0 ? durationMonths / statedMonths : 1;
        adjSup = quotedSup * monthRatio + supGap;
      } else if (pc.supervision_fee_method === 'PERCENTAGE') {
        adjSup = totalCC * toNum(pc.supervision_fee_percentage) / 100;
      }
    } else {
      // Not submitted — calculate full supervision from baseline
      for (const baseline of supervisionBaseline) {
        adjSup += toNum(baseline.monthly_rate_aed) * toNum(baseline.required_allocation_pct) / 100 * durationMonths;
      }
    }

    const totalTrueCost = trueDesign + adjSup;

    // Upsert evaluation result
    await conn.query(
      `INSERT INTO cpa_evaluation_results
         (project_consultant_id, quoted_design_fee, design_scope_gap_cost, true_design_fee,
          adjusted_supervision_fee, total_true_cost, can_rank, calculation_notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, '{}', NOW())
       ON DUPLICATE KEY UPDATE
         quoted_design_fee = VALUES(quoted_design_fee),
         design_scope_gap_cost = VALUES(design_scope_gap_cost),
         true_design_fee = VALUES(true_design_fee),
         adjusted_supervision_fee = VALUES(adjusted_supervision_fee),
         total_true_cost = VALUES(total_true_cost),
         can_rank = 1,
         updated_at = NOW()`,
      [pcId, quotedDesign, designGap, trueDesign, adjSup, totalTrueCost]
    );
    updated++;
  }

  // Update ranks
  const [allResults] = await conn.query(
    `SELECT er.id, er.total_true_cost FROM cpa_evaluation_results er
     JOIN cpa_project_consultants pc ON pc.id = er.project_consultant_id
     WHERE pc.cpa_project_id = ? AND er.can_rank = 1
     ORDER BY er.total_true_cost ASC`, [cpaProjectId]
  );
  for (let i = 0; i < allResults.length; i++) {
    await conn.query(
      `UPDATE cpa_evaluation_results SET eval_rank = ? WHERE id = ?`,
      [i + 1, allResults[i].id]
    );
  }

  return { updated, consultants: consultants.length };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  for (const pid of PROJECT_IDS) {
    try {
      const r = await runEngine(conn, pid);
      console.log(`Project ${pid}: OK — ${r.updated}/${r.consultants} consultants recalculated`);
    } catch (e) {
      console.error(`Project ${pid}: ERROR — ${e.message}`);
    }
  }
  await conn.end();
  console.log('All projects recalculated.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
