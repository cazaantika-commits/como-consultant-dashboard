/**
 * Seed script: Insert consultant fee data for all 5 consultants
 * Based on COMO_Consultancy_Evaluation_March2026_v2.docx
 * Project: Plot 6457879 — Majan Mixed Use (G+4P+25) — MEGA category
 * BUA: 835,000 sqft | Construction Cost: AED 283,900,000 | Duration: 30 months
 */
import { createConnection } from 'mysql2/promise';

const db = await createConnection(process.env.DATABASE_URL);

const PROJECT_ID = 60001;

// Fix project data first
await db.execute(`
  UPDATE cpa_projects SET 
    bua_sqft = 835000,
    construction_cost_per_sqft = 340.0,
    duration_months = 30,
    building_category_id = 30010
  WHERE id = ?
`, [PROJECT_ID]);
console.log('✅ Project data fixed: BUA=835000, cost/sqft=340, duration=30m');

// Scope item IDs for MEGA (from DB query above)
// GREEN items that consultants may include/exclude:
// 29=30047(Green/Sustain,75900) 30=30048(3rdPartyStruct,150000) 31=30049(Security/SIRA,100000)
// 32=30050(VT,149500) 33=30051(BMU,81560) 34=30052(Facade Eng,469208) 35=30053(Wind,138000)
// 36=30054(AV&ELV,200000) 37=30055(FLS Spec,172500) 38=30056(Facade Light,98000)
// 39=30057(TIS,255300) 40=30058(Acoustic,59800) 41=30059(LEED,100000) 42=30060(CostMgmt,442750)
// 43=30061(ValueEng,0)

// ============================================================
// CONSULTANT DATA FROM DOCUMENT
// ============================================================

const consultants = [
  // ── LACASA ──────────────────────────────────────────────
  {
    pcId: 90001,
    code: 'LACASA',
    designFeeMethod: 'LUMP_SUM',
    designFeeAmount: 5500000,
    supervisionSubmitted: false,
    supervisionMethod: null,
    supervisionAmount: null,
    supervisionDuration: null,
    // Scope: all INCLUDED items 1-28 included, GREEN items coverage per doc
    scopeCoverage: [
      // GREEN items — LACASA excluded most specialist items
      { itemId: 30047, status: 'EXCLUDED' },  // #29 Green/Sustain
      { itemId: 30048, status: 'EXCLUDED' },  // #30 3rd Party Structural
      { itemId: 30049, status: 'EXCLUDED' },  // #31 Security/SIRA
      { itemId: 30050, status: 'INCLUDED' },  // #32 Vertical Transportation
      { itemId: 30051, status: 'EXCLUDED' },  // #33 BMU
      { itemId: 30052, status: 'EXCLUDED' },  // #34 Facade Engineering
      { itemId: 30053, status: 'EXCLUDED' },  // #35 Wind Tunnel
      { itemId: 30054, status: 'EXCLUDED' },  // #36 AV & ELV
      { itemId: 30055, status: 'EXCLUDED' },  // #37 FLS Specialist
      { itemId: 30056, status: 'EXCLUDED' },  // #38 Facade Lighting
      { itemId: 30057, status: 'EXCLUDED' },  // #39 TIS
      { itemId: 30058, status: 'EXCLUDED' },  // #40 Acoustic
      { itemId: 30059, status: 'EXCLUDED' },  // #41 LEED
      { itemId: 30060, status: 'EXCLUDED' },  // #42 Cost Management
      { itemId: 30061, status: 'EXCLUDED' },  // #43 Value Engineering
    ]
  },

  // ── DATUM (DEC) ──────────────────────────────────────────
  {
    pcId: 90002,
    code: 'DEC',
    designFeeMethod: 'LUMP_SUM',
    designFeeAmount: 7131950,
    supervisionSubmitted: true,
    supervisionMethod: 'LUMP_SUM',
    supervisionAmount: 8860000,
    supervisionDuration: 30,  // 30 months = matches project duration, no adjustment needed
    scopeCoverage: [
      { itemId: 30047, status: 'INCLUDED' },  // #29 Green/Sustain ✅
      { itemId: 30048, status: 'INCLUDED' },  // #30 3rd Party Structural ✅
      { itemId: 30049, status: 'INCLUDED' },  // #31 Security/SIRA ✅
      { itemId: 30050, status: 'INCLUDED' },  // #32 Vertical Transportation ✅
      { itemId: 30051, status: 'INCLUDED' },  // #33 BMU ✅
      { itemId: 30052, status: 'INCLUDED' },  // #34 Facade Engineering ✅
      { itemId: 30053, status: 'EXCLUDED' },  // #35 Wind Tunnel ❌
      { itemId: 30054, status: 'INCLUDED' },  // #36 AV & ELV ✅
      { itemId: 30055, status: 'EXCLUDED' },  // #37 FLS Specialist ❌
      { itemId: 30056, status: 'INCLUDED' },  // #38 Facade Lighting ✅
      { itemId: 30057, status: 'INCLUDED' },  // #39 TIS ✅
      { itemId: 30058, status: 'INCLUDED' },  // #40 Acoustic ✅
      { itemId: 30059, status: 'EXCLUDED' },  // #41 LEED ❌
      { itemId: 30060, status: 'EXCLUDED' },  // #42 Cost Management ❌
      { itemId: 30061, status: 'INCLUDED' },  // #43 Value Engineering ✅
    ]
  },

  // ── ARTEC (AAEC) ─────────────────────────────────────────
  {
    pcId: 90003,
    code: 'AAEC',
    designFeeMethod: 'LUMP_SUM',
    designFeeAmount: 7131950,
    supervisionSubmitted: true,
    supervisionMethod: 'LUMP_SUM',
    supervisionAmount: 9223768,
    supervisionDuration: 30,  // 30 months
    scopeCoverage: [
      { itemId: 30047, status: 'INCLUDED' },  // #29 Green/Sustain ✅
      { itemId: 30048, status: 'INCLUDED' },  // #30 3rd Party Structural ✅
      { itemId: 30049, status: 'INCLUDED' },  // #31 Security/SIRA ✅
      { itemId: 30050, status: 'INCLUDED' },  // #32 Vertical Transportation ✅
      { itemId: 30051, status: 'INCLUDED' },  // #33 BMU ✅
      { itemId: 30052, status: 'INCLUDED' },  // #34 Facade Engineering ✅
      { itemId: 30053, status: 'EXCLUDED' },  // #35 Wind Tunnel ❌
      { itemId: 30054, status: 'INCLUDED' },  // #36 AV & ELV ✅
      { itemId: 30055, status: 'EXCLUDED' },  // #37 FLS Specialist ❌
      { itemId: 30056, status: 'INCLUDED' },  // #38 Facade Lighting ✅
      { itemId: 30057, status: 'INCLUDED' },  // #39 TIS ✅
      { itemId: 30058, status: 'INCLUDED' },  // #40 Acoustic ✅
      { itemId: 30059, status: 'EXCLUDED' },  // #41 LEED ❌
      { itemId: 30060, status: 'EXCLUDED' },  // #42 Cost Management ❌
      { itemId: 30061, status: 'INCLUDED' },  // #43 Value Engineering ✅
    ]
  },

  // ── XYZ ──────────────────────────────────────────────────
  {
    pcId: 90004,
    code: 'XYZ',
    designFeeMethod: 'LUMP_SUM',
    designFeeAmount: 5200000,
    supervisionSubmitted: false,
    supervisionMethod: null,
    supervisionAmount: null,
    supervisionDuration: null,
    scopeCoverage: [
      { itemId: 30047, status: 'EXCLUDED' },
      { itemId: 30048, status: 'EXCLUDED' },
      { itemId: 30049, status: 'EXCLUDED' },
      { itemId: 30050, status: 'INCLUDED' },
      { itemId: 30051, status: 'EXCLUDED' },
      { itemId: 30052, status: 'EXCLUDED' },
      { itemId: 30053, status: 'EXCLUDED' },
      { itemId: 30054, status: 'EXCLUDED' },
      { itemId: 30055, status: 'EXCLUDED' },
      { itemId: 30056, status: 'EXCLUDED' },
      { itemId: 30057, status: 'EXCLUDED' },
      { itemId: 30058, status: 'EXCLUDED' },
      { itemId: 30059, status: 'EXCLUDED' },
      { itemId: 30060, status: 'EXCLUDED' },
      { itemId: 30061, status: 'EXCLUDED' },
    ]
  },

  // ── Kieferle & Partner (KIEFERLE) ────────────────────────
  {
    pcId: 90005,
    code: 'KIEFERLE',
    designFeeMethod: 'LUMP_SUM',
    designFeeAmount: 7131950,
    supervisionSubmitted: true,
    supervisionMethod: 'LUMP_SUM',
    supervisionAmount: 10362515,
    supervisionDuration: 30,  // 30 months
    scopeCoverage: [
      { itemId: 30047, status: 'INCLUDED' },  // #29 Green/Sustain ✅
      { itemId: 30048, status: 'INCLUDED' },  // #30 3rd Party Structural ✅
      { itemId: 30049, status: 'INCLUDED' },  // #31 Security/SIRA ✅
      { itemId: 30050, status: 'INCLUDED' },  // #32 Vertical Transportation ✅
      { itemId: 30051, status: 'INCLUDED' },  // #33 BMU ✅
      { itemId: 30052, status: 'INCLUDED' },  // #34 Facade Engineering ✅
      { itemId: 30053, status: 'EXCLUDED' },  // #35 Wind Tunnel ❌
      { itemId: 30054, status: 'INCLUDED' },  // #36 AV & ELV ✅
      { itemId: 30055, status: 'EXCLUDED' },  // #37 FLS Specialist ❌
      { itemId: 30056, status: 'INCLUDED' },  // #38 Facade Lighting ✅
      { itemId: 30057, status: 'INCLUDED' },  // #39 TIS ✅
      { itemId: 30058, status: 'INCLUDED' },  // #40 Acoustic ✅
      { itemId: 30059, status: 'EXCLUDED' },  // #41 LEED ❌
      { itemId: 30060, status: 'EXCLUDED' },  // #42 Cost Management ❌
      { itemId: 30061, status: 'INCLUDED' },  // #43 Value Engineering ✅
    ]
  },
];

// Insert data for each consultant
for (const c of consultants) {
  // Update project_consultant fee data
  await db.execute(`
    UPDATE cpa_project_consultants SET
      design_fee_method = ?,
      design_fee_amount = ?,
      design_fee_percentage = NULL,
      supervision_submitted = ?,
      supervision_fee_method = ?,
      supervision_fee_amount = ?,
      supervision_fee_percentage = NULL,
      supervision_stated_duration_months = ?,
      status = 'CONFIRMED'
    WHERE id = ?
  `, [
    c.designFeeMethod,
    c.designFeeAmount,
    c.supervisionSubmitted ? 1 : 0,
    c.supervisionMethod,
    c.supervisionAmount,
    c.supervisionDuration,
    c.pcId
  ]);

  // Delete old scope coverage
  await db.execute(`DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?`, [c.pcId]);

  // Insert scope coverage for GREEN items only (INCLUDED items 1-28 are handled by absence = INCLUDED)
  for (const sc of c.scopeCoverage) {
    await db.execute(`
      INSERT INTO cpa_consultant_scope_coverage (project_consultant_id, scope_item_id, coverage_status)
      VALUES (?, ?, ?)
    `, [c.pcId, sc.itemId, sc.status]);
  }

  console.log(`✅ ${c.code}: design=${c.designFeeAmount?.toLocaleString()} | sup=${c.supervisionAmount?.toLocaleString() ?? 'N/A'} | scope items=${c.scopeCoverage.length}`);
}

// Delete old evaluation results to force fresh recalculation
await db.execute(`DELETE FROM cpa_evaluation_results WHERE project_consultant_id IN (90001,90002,90003,90004,90005)`);
console.log('✅ Old evaluation results cleared');

// Verify
const [verify] = await db.execute(`
  SELECT pc.id, cm.code, pc.design_fee_amount, pc.supervision_submitted, pc.supervision_fee_amount, pc.status
  FROM cpa_project_consultants pc JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
  WHERE pc.cpa_project_id = ?
`, [PROJECT_ID]);
console.log('\n📊 Verification:');
verify.forEach(r => console.log(`  ${r.code}: design=${r.design_fee_amount} sup=${r.supervision_fee_amount} status=${r.status}`));

await db.end();
console.log('\n✅ Done! All consultant data inserted correctly.');
