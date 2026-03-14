/**
 * Seed script: injects consultant JSON data directly into the DB
 * for CPA Project ID 30004 (Plot 6457879 - Majan Mega)
 * Data sourced from COMO_Consultancy_Evaluation_March2026_v2.docx
 */
import { createConnection } from 'mysql2/promise';

const CPA_PROJECT_ID = 30004;

// Consultant data from the evaluation document
const consultants = [
  {
    consultant_code: "LACASA",
    proposal_date: "2026-03-01",
    proposal_reference: "LACASA-2026-001",
    design_fee: {
      method: "LUMP_SUM",
      amount: 8279700
    },
    supervision_fee: {
      submitted: false,
      method: null,
      amount: null,
      stated_duration_months: null
    },
    scope_coverage: [
      { item_code: "GREEN_BUILDING", status: "EXCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "EXCLUDED" },
      { item_code: "SECURITY_SIRA", status: "INCLUDED" },
      { item_code: "VERTICAL_TRANSPORT", status: "INCLUDED" },
      { item_code: "BMU", status: "INCLUDED" },
      { item_code: "FACADE_ENGINEERING", status: "INCLUDED" },
      { item_code: "WIND_TUNNEL", status: "EXCLUDED" },
      { item_code: "AV_ELV", status: "INCLUDED" },
      { item_code: "FLS_SPECIALIST", status: "INCLUDED" },
      { item_code: "FACADE_LIGHTING", status: "INCLUDED" },
      { item_code: "TRAFFIC_IMPACT", status: "INCLUDED" },
      { item_code: "ACOUSTIC", status: "INCLUDED" },
      { item_code: "SUSTAINABILITY_LEED", status: "EXCLUDED" },
      { item_code: "COST_MANAGEMENT", status: "INCLUDED" }
    ]
  },
  {
    consultant_code: "DEC",
    proposal_date: "2026-03-01",
    proposal_reference: "DATUM-2026-001",
    design_fee: {
      method: "LUMP_SUM",
      amount: 5350000
    },
    supervision_fee: {
      submitted: true,
      method: "LUMP_SUM",
      amount: 8860000,
      stated_duration_months: 22
    },
    scope_coverage: [
      { item_code: "GREEN_BUILDING", status: "EXCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "EXCLUDED" },
      { item_code: "SECURITY_SIRA", status: "INCLUDED" },
      { item_code: "VERTICAL_TRANSPORT", status: "INCLUDED" },
      { item_code: "BMU", status: "INCLUDED" },
      { item_code: "FACADE_ENGINEERING", status: "INCLUDED" },
      { item_code: "WIND_TUNNEL", status: "EXCLUDED" },
      { item_code: "AV_ELV", status: "INCLUDED" },
      { item_code: "FLS_SPECIALIST", status: "EXCLUDED" },
      { item_code: "FACADE_LIGHTING", status: "INCLUDED" },
      { item_code: "TRAFFIC_IMPACT", status: "INCLUDED" },
      { item_code: "ACOUSTIC", status: "INCLUDED" },
      { item_code: "SUSTAINABILITY_LEED", status: "EXCLUDED" },
      { item_code: "COST_MANAGEMENT", status: "INCLUDED" }
    ]
  },
  {
    consultant_code: "AAEC",
    proposal_date: "2026-03-01",
    proposal_reference: "ARTEC-2026-001",
    design_fee: {
      method: "PERCENTAGE",
      percentage: 1.8
    },
    supervision_fee: {
      submitted: true,
      method: "LUMP_SUM",
      amount: 8753000,
      stated_duration_months: 30
    },
    scope_coverage: [
      { item_code: "GREEN_BUILDING", status: "EXCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "EXCLUDED" },
      { item_code: "SECURITY_SIRA", status: "EXCLUDED" },
      { item_code: "VERTICAL_TRANSPORT", status: "EXCLUDED" },
      { item_code: "BMU", status: "EXCLUDED" },
      { item_code: "FACADE_ENGINEERING", status: "EXCLUDED" },
      { item_code: "WIND_TUNNEL", status: "EXCLUDED" },
      { item_code: "AV_ELV", status: "EXCLUDED" },
      { item_code: "FLS_SPECIALIST", status: "EXCLUDED" },
      { item_code: "FACADE_LIGHTING", status: "EXCLUDED" },
      { item_code: "TRAFFIC_IMPACT", status: "EXCLUDED" },
      { item_code: "ACOUSTIC", status: "EXCLUDED" },
      { item_code: "SUSTAINABILITY_LEED", status: "EXCLUDED" },
      { item_code: "COST_MANAGEMENT", status: "EXCLUDED" }
    ]
  },
  {
    consultant_code: "XYZ",
    proposal_date: "2026-03-01",
    proposal_reference: "XYZ-2026-001",
    design_fee: {
      method: "LUMP_SUM",
      amount: 9840000
    },
    supervision_fee: {
      submitted: false,
      method: null,
      amount: null,
      stated_duration_months: null
    },
    scope_coverage: [
      { item_code: "GREEN_BUILDING", status: "EXCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "EXCLUDED" },
      { item_code: "SECURITY_SIRA", status: "INCLUDED" },
      { item_code: "VERTICAL_TRANSPORT", status: "EXCLUDED" },
      { item_code: "BMU", status: "INCLUDED" },
      { item_code: "FACADE_ENGINEERING", status: "INCLUDED" },
      { item_code: "WIND_TUNNEL", status: "EXCLUDED" },
      { item_code: "AV_ELV", status: "INCLUDED" },
      { item_code: "FLS_SPECIALIST", status: "EXCLUDED" },
      { item_code: "FACADE_LIGHTING", status: "INCLUDED" },
      { item_code: "TRAFFIC_IMPACT", status: "INCLUDED" },
      { item_code: "ACOUSTIC", status: "EXCLUDED" },
      { item_code: "SUSTAINABILITY_LEED", status: "EXCLUDED" },
      { item_code: "COST_MANAGEMENT", status: "EXCLUDED" }
    ]
  },
  {
    consultant_code: "KIEFERLE",
    proposal_date: "2026-03-01",
    proposal_reference: "KP-2026-001",
    design_fee: {
      method: "LUMP_SUM",
      amount: 7856068
    },
    supervision_fee: {
      submitted: true,
      method: "LUMP_SUM",
      amount: 9488397,
      stated_duration_months: 30
    },
    scope_coverage: [
      { item_code: "GREEN_BUILDING", status: "INCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "EXCLUDED" },
      { item_code: "SECURITY_SIRA", status: "INCLUDED" },
      { item_code: "VERTICAL_TRANSPORT", status: "INCLUDED" },
      { item_code: "BMU", status: "INCLUDED" },
      { item_code: "FACADE_ENGINEERING", status: "INCLUDED" },
      { item_code: "WIND_TUNNEL", status: "INCLUDED" },
      { item_code: "AV_ELV", status: "INCLUDED" },
      { item_code: "FLS_SPECIALIST", status: "INCLUDED" },
      { item_code: "FACADE_LIGHTING", status: "INCLUDED" },
      { item_code: "TRAFFIC_IMPACT", status: "INCLUDED" },
      { item_code: "ACOUSTIC", status: "INCLUDED" },
      { item_code: "SUSTAINABILITY_LEED", status: "INCLUDED" },
      { item_code: "COST_MANAGEMENT", status: "INCLUDED" }
    ]
  }
];

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('Connected to DB');

  for (const c of consultants) {
    console.log(`\nProcessing: ${c.consultant_code}`);
    
    // Get consultant master ID
    const [masterRows] = await conn.execute(
      'SELECT id FROM cpa_consultants_master WHERE code = ? AND is_active = 1',
      [c.consultant_code]
    );
    if (!masterRows[0]) {
      console.log(`  ❌ Consultant ${c.consultant_code} not found in master`);
      continue;
    }
    const consultantId = masterRows[0].id;
    
    // Get or create project_consultant record
    const [existing] = await conn.execute(
      'SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ? AND consultant_id = ?',
      [CPA_PROJECT_ID, consultantId]
    );
    
    const designMethod = c.design_fee.method;
    const designAmount = designMethod === 'PERCENTAGE' ? null : c.design_fee.amount;
    const designPct = c.design_fee.percentage ?? null;
    const supSubmitted = c.supervision_fee.submitted ? 1 : 0;
    const supMethod = c.supervision_fee.method;
    const supAmount = supMethod === 'PERCENTAGE' ? null : c.supervision_fee.amount;
    const supPct = c.supervision_fee.percentage ?? null;
    const supDuration = c.supervision_fee.stated_duration_months ?? null;
    const jsonText = JSON.stringify(c);
    
    let pcId;
    if (existing[0]) {
      pcId = existing[0].id;
      await conn.execute(
        `UPDATE cpa_project_consultants SET
          proposal_date=?, proposal_reference=?,
          design_fee_amount=?, design_fee_method=?, design_fee_percentage=?,
          supervision_fee_amount=?, supervision_fee_method=?, supervision_fee_percentage=?,
          supervision_stated_duration_months=?, supervision_submitted=?,
          import_json=?, status='CONFIRMED'
        WHERE id=?`,
        [c.proposal_date, c.proposal_reference,
         designAmount, designMethod, designPct,
         supAmount, supMethod, supPct,
         supDuration, supSubmitted,
         jsonText, pcId]
      );
      console.log(`  ✅ Updated existing record ID ${pcId}`);
    } else {
      const [result] = await conn.execute(
        `INSERT INTO cpa_project_consultants
          (cpa_project_id, consultant_id, proposal_date, proposal_reference,
           design_fee_amount, design_fee_method, design_fee_percentage,
           supervision_fee_amount, supervision_fee_method, supervision_fee_percentage,
           supervision_stated_duration_months, supervision_submitted, import_json, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'CONFIRMED')`,
        [CPA_PROJECT_ID, consultantId, c.proposal_date, c.proposal_reference,
         designAmount, designMethod, designPct,
         supAmount, supMethod, supPct,
         supDuration, supSubmitted, jsonText]
      );
      pcId = result.insertId;
      console.log(`  ✅ Inserted new record ID ${pcId}`);
    }
    
    // Delete old scope coverage
    await conn.execute('DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?', [pcId]);
    
    // Insert scope coverage
    let included = 0, excluded = 0, notMentioned = 0;
    for (const sc of c.scope_coverage) {
      const [scopeRows] = await conn.execute(
        'SELECT id FROM cpa_scope_items WHERE code = ?',
        [sc.item_code]
      );
      if (!scopeRows[0]) {
        console.log(`    ⚠️  Scope item not found: ${sc.item_code}`);
        continue;
      }
      await conn.execute(
        'INSERT INTO cpa_consultant_scope_coverage (project_consultant_id, scope_item_id, coverage_status) VALUES (?,?,?)',
        [pcId, scopeRows[0].id, sc.status]
      );
      if (sc.status === 'INCLUDED') included++;
      else if (sc.status === 'EXCLUDED') excluded++;
      else notMentioned++;
    }
    console.log(`  📋 Scope: ${included} included, ${excluded} excluded, ${notMentioned} not mentioned`);
  }
  
  await conn.end();
  console.log('\n✅ All consultants seeded successfully!');
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
