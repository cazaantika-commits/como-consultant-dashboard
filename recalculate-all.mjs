// Script to recalculate all CPA projects using the correct settings
// Run with: node recalculate-all.mjs

import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

async function qRows(query, params = []) {
  const [rows] = await conn.execute(query, params);
  return rows;
}

async function runCalculationEngine(cpaProjectId) {
  const projects = await qRows(
    `SELECT p.*, bc.id as cat_id, bc.code as cat_code,
            bc.supervision_duration_months as cat_supervision_months
     FROM cpa_projects p
     LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
     WHERE p.id = ?`, [cpaProjectId]
  );
  if (!projects[0]) throw new Error(`Project ${cpaProjectId} not found`);
  const proj = projects[0];
  let catId = proj.building_category_id ?? proj.cat_id;

  if (!catId) {
    const cats = await qRows(
      `SELECT id FROM cpa_building_categories
       WHERE is_active = 1
         AND (bua_min_sqft IS NULL OR bua_min_sqft <= ?)
         AND (bua_max_sqft IS NULL OR bua_max_sqft >= ?)
       ORDER BY sort_order LIMIT 1`, [proj.bua_sqft, proj.bua_sqft]
    );
    catId = cats[0]?.id ?? null;
  }

  const totalConstructionCost = toNum(proj.bua_sqft) * toNum(proj.construction_cost_per_sqft);
  const durationMonths = toNum(proj.duration_months);

  // allRequiredItems - EXCLUDE NOT_REQUIRED
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

  if (consultants.length === 0) {
    console.log(`  No consultants for project ${cpaProjectId}`);
    return;
  }

  const results = [];
  for (const consultant of consultants) {
    const pcId = consultant.id;
    const notes = { scopeGaps: [], supervisionGaps: [] };

    // Design fee
    let quotedDesignFee = 0;
    if (consultant.design_fee_method === "LUMP_SUM") {
      quotedDesignFee = toNum(consultant.design_fee_amount);
    } else if (consultant.design_fee_method === "PERCENTAGE") {
      quotedDesignFee = (totalConstructionCost * toNum(consultant.design_fee_percentage)) / 100;
    } else if (consultant.design_fee_method === "MONTHLY_RATE") {
      quotedDesignFee = toNum(consultant.design_fee_amount);
    }

    // Scope coverage
    const scopeCoverage = await qRows(
      `SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?`, [pcId]
    );
    const coverageMap = {};
    for (const row of scopeCoverage) {
      coverageMap[Number(row.scope_item_id)] = String(row.coverage_status);
    }

    // Design gap - SKIP NOT_REQUIRED
    let designScopeGapCost = 0;
    for (const item of allRequiredItems) {
      const status = coverageMap[item.id] ?? "NOT_MENTIONED";
      if (status === "INCLUDED") continue;
      if (item.status === "NOT_REQUIRED") continue;
      const gap = toNum(item.ref_cost);
      designScopeGapCost += gap;
      if (gap > 0) {
        notes.scopeGaps.push({ itemCode: item.code, itemLabel: item.label, status, gapCost: gap });
      }
    }

    // Supervision
    let quotedSupervisionFee = 0;
    let canRank = 1;
    const statedDuration = consultant.supervision_stated_duration_months
      ? toNum(consultant.supervision_stated_duration_months) : null;
    const durationAdjustmentFactor =
      statedDuration !== null && statedDuration > 0 && statedDuration < durationMonths
        ? durationMonths / statedDuration : 1;

    if (!consultant.supervision_submitted) {
      canRank = 0;
    } else {
      const supTeam = await qRows(
        `SELECT cst.supervision_role_id, cst.proposed_allocation_pct, cst.proposed_monthly_rate
         FROM cpa_consultant_supervision_team cst
         WHERE cst.project_consultant_id = ?`, [pcId]
      );
      const teamMap = {};
      for (const row of supTeam) {
        teamMap[Number(row.supervision_role_id)] = row;
      }

      if (consultant.supervision_fee_method === "LUMP_SUM") {
        quotedSupervisionFee = toNum(consultant.supervision_fee_amount) * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === "PERCENTAGE") {
        quotedSupervisionFee = (totalConstructionCost * toNum(consultant.supervision_fee_percentage) / 100) * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === "MONTHLY_RATE") {
        for (const row of supTeam) {
          if (row.proposed_monthly_rate) {
            const roleId = Number(row.supervision_role_id);
            const baselineEntry = supervisionBaseline.find(b => Number(b.supervision_role_id) === roleId);
            const effectiveAlloc = toNum(row.proposed_allocation_pct) > 0
              ? toNum(row.proposed_allocation_pct)
              : (baselineEntry ? toNum(baselineEntry.required_allocation_pct) : 100);
            quotedSupervisionFee += toNum(row.proposed_monthly_rate) * durationMonths * (effectiveAlloc / 100);
          }
        }
      }

      // Supervision gaps
      let supervisionGapCost = 0;
      for (const baseline of supervisionBaseline) {
        const roleId = Number(baseline.supervision_role_id);
        const required = toNum(baseline.required_allocation_pct);
        const teamEntry = teamMap[roleId];
        const rawProposed = toNum(teamEntry?.proposed_allocation_pct ?? 0);
        const proposed = (rawProposed === 0 && teamEntry?.proposed_monthly_rate) ? required : rawProposed;
        if (proposed < required) {
          const gapPct = required - proposed;
          const rateToUse = consultant.supervision_fee_method === "MONTHLY_RATE" && teamEntry?.proposed_monthly_rate
            ? toNum(teamEntry.proposed_monthly_rate)
            : toNum(baseline.monthly_rate_aed);
          const gapCost = rateToUse * durationMonths * (gapPct / 100);
          supervisionGapCost += gapCost;
          notes.supervisionGaps.push({ roleCode: baseline.code, roleLabel: baseline.label, required, proposed, gapPct, gapCost });
        }
      }

      const adjustedSupervisionFee = quotedSupervisionFee + supervisionGapCost;
      const trueDesignFee = quotedDesignFee + designScopeGapCost;
      const totalTrueCost = trueDesignFee + adjustedSupervisionFee;
      results.push({ pcId, quotedDesignFee, designScopeGapCost, trueDesignFee, quotedSupervisionFee, supervisionGapCost, adjustedSupervisionFee, totalTrueCost, canRank: 1, notes });
      continue;
    }

    // No supervision
    const trueDesignFee = quotedDesignFee + designScopeGapCost;
    results.push({ pcId, quotedDesignFee, designScopeGapCost, trueDesignFee, quotedSupervisionFee: null, supervisionGapCost: null, adjustedSupervisionFee: null, totalTrueCost: null, canRank: 0, notes });
  }

  // Rank
  const rankable = results.filter(r => r.canRank === 1).sort((a, b) => a.totalTrueCost - b.totalTrueCost);
  rankable.forEach((r, i) => { r.resultRank = i + 1; });
  results.filter(r => r.canRank === 0).forEach(r => { r.resultRank = null; });

  // Persist
  for (const r of results) {
    const notesJson = JSON.stringify(r.notes);
    await conn.execute(`DELETE FROM cpa_evaluation_results WHERE project_consultant_id = ?`, [r.pcId]);
    await conn.execute(
      `INSERT INTO cpa_evaluation_results
        (project_consultant_id, quoted_design_fee, design_scope_gap_cost, true_design_fee,
         quoted_supervision_fee, supervision_gap_cost, adjusted_supervision_fee,
         total_true_cost, eval_rank, can_rank, calculation_notes, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [r.pcId, r.quotedDesignFee, r.designScopeGapCost, r.trueDesignFee,
       r.quotedSupervisionFee, r.supervisionGapCost, r.adjustedSupervisionFee,
       r.totalTrueCost, r.resultRank, r.canRank, notesJson]
    );
    await conn.execute(`UPDATE cpa_project_consultants SET status = 'EVALUATED' WHERE id = ?`, [r.pcId]);
    console.log(`  pcId=${r.pcId}: gap=${r.designScopeGapCost}, gaps=[${r.notes.scopeGaps.map(g => g.itemCode).join(',')}]`);
  }
}

// Get all CPA projects
const [projects] = await conn.execute(`SELECT id FROM cpa_projects`);
console.log(`Found ${projects.length} projects to recalculate`);

for (const proj of projects) {
  console.log(`\nProject ${proj.id}:`);
  try {
    await runCalculationEngine(proj.id);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }
}

console.log('\n=== Done! Verifying results ===');
const [allResults] = await conn.execute(`
  SELECT er.design_scope_gap_cost, cm.trade_name, pc.cpa_project_id, er.calculated_at,
         er.calculation_notes
  FROM cpa_evaluation_results er
  JOIN cpa_project_consultants pc ON pc.id = er.project_consultant_id
  JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
  ORDER BY pc.cpa_project_id, er.design_scope_gap_cost DESC
`);
for (const r of allResults) {
  const notes = r.calculation_notes ? JSON.parse(r.calculation_notes) : {};
  console.log(`Proj ${r.cpa_project_id} | ${r.trade_name} | gap=${r.design_scope_gap_cost} | [${notes.scopeGaps?.map(g => g.itemCode).join(',') ?? ''}]`);
}

await conn.end();
