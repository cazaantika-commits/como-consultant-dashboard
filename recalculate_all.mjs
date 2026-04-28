import 'dotenv/config';
import mysql from 'mysql2/promise';

// We'll replicate the essential calculation engine logic directly
// since we can't call the tRPC endpoint without auth

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all CPA projects
const [projects] = await conn.query('SELECT id FROM cpa_projects');
console.log(`Found ${projects.length} CPA projects to recalculate`);

for (const proj of projects) {
  const pid = proj.id;
  
  // Get project details
  const [pRows] = await conn.query(`
    SELECT p.*, bc.id as cat_id, bc.supervision_duration_months as cat_supervision_months
    FROM cpa_projects p
    LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
    WHERE p.id = ?
  `, [pid]);
  
  if (!pRows[0]) continue;
  const p = pRows[0];
  const catId = p.building_category_id;
  const totalConstructionCost = Number(p.bua_sqft || 0) * Number(p.construction_cost_per_sqft || 0);
  const durationMonths = Number(p.duration_months || 0);
  
  // Get supervision baseline (with is_active filter)
  const [baseline] = await conn.query(`
    SELECT sb.supervision_role_id, sb.required_allocation_pct,
           sr.code, sr.label, sr.monthly_rate_aed
    FROM cpa_supervision_baseline sb
    JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
    WHERE sb.building_category_id = ?
      AND sb.required_allocation_pct > 0
      AND sr.is_active = 1
  `, [catId]);
  
  // Get all required scope items
  const [allRequiredItems] = await conn.query(`
    SELECT si.id, si.code, si.label, scm.status,
           COALESCE(src.cost_aed, 0) as ref_cost
    FROM cpa_scope_category_matrix scm
    JOIN cpa_scope_items si ON si.id = scm.scope_item_id
    LEFT JOIN cpa_scope_reference_costs src
      ON src.scope_item_id = scm.scope_item_id
      AND src.building_category_id = scm.building_category_id
    WHERE scm.building_category_id = ?
      AND scm.status != 'NOT_REQUIRED'
      AND si.item_number NOT IN (10, 11, 12, 13, 44, 45, 46, 47)
  `, [catId]);
  
  // Get consultants
  const [consultants] = await conn.query(`
    SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code
    FROM cpa_project_consultants pc
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    WHERE pc.cpa_project_id = ?
      AND pc.status IN ('DRAFT', 'CONFIRMED', 'EVALUATED')
  `, [pid]);
  
  console.log(`\nProject ${pid} (cat=${catId}): ${consultants.length} consultants, ${baseline.length} baseline roles`);
  
  const results = [];
  
  for (const consultant of consultants) {
    const pcId = consultant.id;
    const notes = { scopeGaps: [], supervisionGaps: [] };
    
    // Design fee
    let quotedDesignFee = 0;
    if (consultant.design_fee_method === 'LUMP_SUM') {
      quotedDesignFee = Number(consultant.design_fee_amount || 0);
    } else if (consultant.design_fee_method === 'PERCENTAGE') {
      quotedDesignFee = (totalConstructionCost * Number(consultant.design_fee_percentage || 0)) / 100;
    } else if (consultant.design_fee_method === 'MONTHLY_RATE') {
      quotedDesignFee = Number(consultant.design_fee_amount || 0);
    }
    
    // Scope coverage
    const [scopeCoverage] = await conn.query(
      'SELECT scope_item_id, coverage_status FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?',
      [pcId]
    );
    const coverageMap = {};
    for (const row of scopeCoverage) {
      coverageMap[row.scope_item_id] = row.coverage_status;
    }
    
    let designScopeGapCost = 0;
    for (const item of allRequiredItems) {
      const status = coverageMap[item.id] || 'NOT_MENTIONED';
      if (status === 'INCLUDED') continue;
      if (item.status === 'NOT_REQUIRED') continue;
      const gap = Number(item.ref_cost || 0);
      designScopeGapCost += gap;
      if (gap > 0) {
        notes.scopeGaps.push({ itemCode: item.code, itemLabel: item.label, status, gapCost: gap });
      }
    }
    
    // Supervision
    let quotedSupervisionFee = 0;
    let originalSupervisionFeeBeforeAdj = 0;
    let canRank = 1;
    
    const statedDuration = consultant.supervision_stated_duration_months
      ? Number(consultant.supervision_stated_duration_months)
      : null;
    const durationAdjustmentFactor =
      statedDuration !== null && statedDuration > 0 && statedDuration < durationMonths
        ? durationMonths / statedDuration
        : 1;
    
    if (durationAdjustmentFactor > 1) {
      notes.durationWarning = {
        statedMonths: statedDuration,
        projectMonths: durationMonths,
        adjustmentFactor: durationAdjustmentFactor,
        message: `مدة الإشراف المقدمة ${statedDuration} شهر — مدة المشروع ${durationMonths} شهر — السعر سيُعدَّل بمعامل ${durationAdjustmentFactor.toFixed(2)}`
      };
    }
    
    if (!consultant.supervision_submitted) {
      canRank = 0;
    } else {
      const [supTeam] = await conn.query(
        'SELECT supervision_role_id, proposed_allocation_pct, proposed_monthly_rate FROM cpa_consultant_supervision_team WHERE project_consultant_id = ?',
        [pcId]
      );
      
      if (consultant.supervision_fee_method === 'LUMP_SUM') {
        originalSupervisionFeeBeforeAdj = Number(consultant.supervision_fee_amount || 0);
        quotedSupervisionFee = originalSupervisionFeeBeforeAdj * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === 'PERCENTAGE') {
        quotedSupervisionFee = (totalConstructionCost * Number(consultant.supervision_fee_percentage || 0)) / 100;
        originalSupervisionFeeBeforeAdj = quotedSupervisionFee;
        quotedSupervisionFee = quotedSupervisionFee * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === 'MONTHLY_RATE') {
        for (const row of supTeam) {
          if (row.proposed_monthly_rate) {
            const roleId = Number(row.supervision_role_id);
            const baselineEntry = baseline.find(b => Number(b.supervision_role_id) === roleId);
            const effectiveAlloc = Number(row.proposed_allocation_pct || 0) > 0
              ? Number(row.proposed_allocation_pct)
              : (baselineEntry ? Number(baselineEntry.required_allocation_pct) : 100);
            quotedSupervisionFee += Number(row.proposed_monthly_rate) * durationMonths * (effectiveAlloc / 100);
          }
        }
      }
      
      const supervisionGapCost = 0;
      const adjustedSupervisionFee = quotedSupervisionFee + supervisionGapCost;
      const trueDesignFee = quotedDesignFee + designScopeGapCost;
      const totalTrueCost = trueDesignFee + adjustedSupervisionFee;
      
      results.push({
        pcId, consultantId: consultant.consultant_id,
        consultantName: consultant.trade_name || consultant.legal_name,
        quotedDesignFee, designScopeGapCost, trueDesignFee,
        quotedSupervisionFee, supervisionGapCost, adjustedSupervisionFee,
        totalTrueCost, canRank, notes
      });
      continue;
    }
    
    // No supervision submitted
    const trueDesignFee = quotedDesignFee + designScopeGapCost;
    results.push({
      pcId, consultantId: consultant.consultant_id,
      consultantName: consultant.trade_name || consultant.legal_name,
      quotedDesignFee, designScopeGapCost, trueDesignFee,
      quotedSupervisionFee: null, supervisionGapCost: null,
      adjustedSupervisionFee: null, totalTrueCost: null, canRank: 0, notes
    });
  }
  
  // Rank
  const rankable = results.filter(r => r.canRank === 1).sort((a, b) => a.totalTrueCost - b.totalTrueCost);
  rankable.forEach((r, i) => { r.resultRank = i + 1; });
  results.filter(r => r.canRank === 0).forEach(r => { r.resultRank = null; });
  
  // Persist
  for (const pcId of [...new Set(results.map(r => r.pcId))]) {
    await conn.query('DELETE FROM cpa_evaluation_results WHERE project_consultant_id = ?', [pcId]);
  }
  
  for (const r of results) {
    await conn.query(`
      INSERT INTO cpa_evaluation_results
        (project_consultant_id, quoted_design_fee, design_scope_gap_cost, true_design_fee,
         quoted_supervision_fee, supervision_gap_cost, adjusted_supervision_fee,
         total_true_cost, result_rank, can_rank, calculation_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      r.pcId, r.quotedDesignFee, r.designScopeGapCost, r.trueDesignFee,
      r.quotedSupervisionFee, r.supervisionGapCost, r.adjustedSupervisionFee,
      r.totalTrueCost, r.resultRank, r.canRank, JSON.stringify(r.notes)
    ]);
    
    console.log(`  ${r.consultantName}: design=${r.quotedDesignFee?.toLocaleString()} supFee=${r.quotedSupervisionFee?.toLocaleString()} totalTrue=${r.totalTrueCost?.toLocaleString()} rank=${r.resultRank}`);
  }
}

console.log('\n=== RECALCULATION COMPLETE ===');
await conn.end();
