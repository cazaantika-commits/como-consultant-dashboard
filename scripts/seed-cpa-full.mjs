/**
 * seed-cpa-full.mjs
 * Complete authoritative seed for CPA module.
 * Source: Supplementary Data Document (March 2026) — SOI verified.
 * Uses integer FK IDs as required by the actual DB schema.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run() {
  console.log("Starting full CPA seed...");

  // ── 1. Clear old data in FK-safe order ────────────────────────────────────
  await conn.execute("DELETE FROM cpa_supervision_baseline");
  await conn.execute("DELETE FROM cpa_scope_reference_costs");
  await conn.execute("DELETE FROM cpa_scope_category_matrix");
  await conn.execute("DELETE FROM cpa_supervision_roles");
  await conn.execute("DELETE FROM cpa_scope_items");
  await conn.execute("DELETE FROM cpa_scope_sections");
  await conn.execute("DELETE FROM cpa_building_categories");
  console.log("Old data cleared");

  // ── 2. Building Categories ─────────────────────────────────────────────────
  await conn.execute(`
    INSERT INTO cpa_building_categories (code, label, bua_min_sqft, bua_max_sqft, sort_order, is_active) VALUES
    ('VILLA',   'Villa',   NULL,    39999,  1, 1),
    ('SMALL',   'Small',   40000,   120000, 2, 1),
    ('MEDIUM',  'Medium',  120001,  300000, 3, 1),
    ('LARGE',   'Large',   300001,  600000, 4, 1),
    ('MEGA',    'Mega',    600001,  NULL,   5, 1)
  `);
  // Fetch IDs by code for FK use
  const [catRows] = await conn.execute("SELECT id, code FROM cpa_building_categories ORDER BY sort_order");
  const catId = {};
  catRows.forEach(r => catId[r.code] = r.id);
  console.log("Building categories seeded (5):", catId);

  // ── 3. Scope Sections ──────────────────────────────────────────────────────
  await conn.execute(`
    INSERT INTO cpa_scope_sections (code, label, sort_order) VALUES
    ('CORE_DESIGN',       'Section 1 — Core Design Services',          1),
    ('DOCUMENTATION',     'Section 1 — Documentation & Deliverables',  2),
    ('CONTRACT',          'Section 1 — Contract Framework',            3),
    ('GREEN_SPECIALIZED', 'Section 2 — Specialized Mandatory GREEN',   4),
    ('RED_SPECIALIZED',   'Section 3 — Mandatory RED',                 5)
  `);
  const [secRows] = await conn.execute("SELECT id, code FROM cpa_scope_sections ORDER BY sort_order");
  const secId = {};
  secRows.forEach(r => secId[r.code] = r.id);
  console.log("Scope sections seeded (5)");

  // ── 4. Scope Items (47) ────────────────────────────────────────────────────
  const scopeItems = [
    [1,  'CONCEPT_DESIGN',       'Concept Design',                                'CORE_DESIGN',       'CORE'],
    [2,  'SCHEMATIC_DESIGN',     'Schematic Design',                              'CORE_DESIGN',       'CORE'],
    [3,  'DETAILED_DESIGN',      'Detailed Design',                               'CORE_DESIGN',       'CORE'],
    [4,  'ARCH_DESIGN',          'Architectural Design',                          'CORE_DESIGN',       'CORE'],
    [5,  'STRUCTURAL_CIVIL',     'Structural / Civil Engineering',                'CORE_DESIGN',       'CORE'],
    [6,  'MEP_ENGINEERING',      'MEP Engineering',                               'CORE_DESIGN',       'CORE'],
    [7,  'FLS',                  'Fire Protection & Life Safety (FLS)',           'CORE_DESIGN',       'CORE'],
    [8,  'BIM',                  'BIM Modeling',                                  'CORE_DESIGN',       'CORE'],
    [9,  'QS_BOQ',               'Quantity Survey (QS) — BOQ',                   'CORE_DESIGN',       'CORE'],
    [10, 'PARKING_STRATEGY',     'Parking Strategy',                              'CORE_DESIGN',       'CORE'],
    [11, 'WASTE_MANAGEMENT',     'Waste Management',                              'CORE_DESIGN',       'CORE'],
    [12, 'SIGNAGE_WAYFINDING',   'Signage & Wayfinding',                          'CORE_DESIGN',       'CORE'],
    [13, 'INFRASTRUCTURE',       'Infrastructure & Utilities (within plot)',      'CORE_DESIGN',       'CORE'],
    [14, 'AUTHORITY_SUBMISSIONS','Authority Submissions & NOCs',                  'DOCUMENTATION',     'CORE'],
    [15, 'BUILDING_PERMIT',      'Building Permit',                               'DOCUMENTATION',     'CORE'],
    [16, 'IFC_PACKAGE',          'IFC Package (Issued for Construction)',         'DOCUMENTATION',     'CORE'],
    [17, 'TENDER_DOCS',          'Tender Documents + BOQ + Specifications',       'DOCUMENTATION',     'CORE'],
    [18, 'TENDER_EVAL',          'Tender Evaluation Report',                      'DOCUMENTATION',     'CORE'],
    [19, 'FIDIC_CONTRACT',       'FIDIC Based Contract',                          'CONTRACT',          'CORE'],
    [20, 'DIAC',                 'Dispute Resolution — DIAC',                    'CONTRACT',          'CORE'],
    [21, 'PI_INSURANCE',         'PI Insurance — Professional Indemnity',        'CONTRACT',          'CORE'],
    [22, 'PL_INSURANCE',         'PL Insurance — Public Liability',              'CONTRACT',          'CORE'],
    [23, 'GOVERNING_LAW',        'Governing Law — Dubai Courts',                 'CONTRACT',          'CORE'],
    [24, 'RETENTION',            'Retention 5%',                                  'CONTRACT',          'CORE'],
    [25, 'FEE_CAP',              'Fee Cap on Percentage Fees',                    'CONTRACT',          'CORE'],
    [26, 'CONFIDENTIALITY',      'Confidentiality Clause',                        'CONTRACT',          'CORE'],
    [27, 'IP',                   'IP — Intellectual Property',                   'CONTRACT',          'CORE'],
    [28, 'TERMINATION',          'Termination Clause',                            'CONTRACT',          'CORE'],
    [29, 'GREEN_BUILDING',       'Green Building / Sustainability Certification', 'GREEN_SPECIALIZED', 'GREEN'],
    [30, 'STRUCTURAL_AUDIT',     '3rd Party Structural Audit',                   'GREEN_SPECIALIZED', 'GREEN'],
    [31, 'SECURITY_SIRA',        'Security Design / SIRA Approval',              'GREEN_SPECIALIZED', 'GREEN'],
    [32, 'VERTICAL_TRANSPORT',   'Vertical Transportation',                       'GREEN_SPECIALIZED', 'GREEN'],
    [33, 'BMU',                  'BMU — Facade Maintenance System',              'GREEN_SPECIALIZED', 'GREEN'],
    [34, 'FACADE_ENGINEERING',   'Facade Engineering',                            'GREEN_SPECIALIZED', 'GREEN'],
    [35, 'WIND_TUNNEL',          'Wind Tunnel Study',                             'GREEN_SPECIALIZED', 'GREEN'],
    [36, 'AV_ELV',               'AV & ELV Design',                              'GREEN_SPECIALIZED', 'GREEN'],
    [37, 'FLS_SPECIALIST',       'FLS Specialist (separate from MEP)',            'GREEN_SPECIALIZED', 'GREEN'],
    [38, 'FACADE_LIGHTING',      'Facade Lighting',                               'GREEN_SPECIALIZED', 'GREEN'],
    [39, 'TIS',                  'Traffic Impact Study (TIS)',                    'GREEN_SPECIALIZED', 'GREEN'],
    [40, 'ACOUSTIC',             'Acoustic & Vibration Design',                   'GREEN_SPECIALIZED', 'GREEN'],
    [41, 'LEED',                 'Sustainability / LEED Certification',           'GREEN_SPECIALIZED', 'GREEN'],
    [42, 'COST_MANAGEMENT',      'Cost Management',                               'GREEN_SPECIALIZED', 'GREEN'],
    [43, 'VALUE_ENGINEERING',    'Value Engineering',                             'GREEN_SPECIALIZED', 'GREEN'],
    [44, 'ID_COMMON_AREAS',      'Interior Design — Common Areas',               'RED_SPECIALIZED',   'RED'],
    [45, 'ID_UNIT_PROTOTYPES',   'Interior Design — Unit Prototypes',            'RED_SPECIALIZED',   'RED'],
    [46, 'LANDSCAPE',            'Landscape & Irrigation',                        'RED_SPECIALIZED',   'RED'],
    [47, 'WATER_FEATURES',       'Water Features & Swimming Pools',               'RED_SPECIALIZED',   'RED'],
  ];

  for (const [num, code, label, sectionCode, defType] of scopeItems) {
    await conn.execute(
      `INSERT INTO cpa_scope_items (item_number, code, label, section_id, default_type, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [num, code, label, secId[sectionCode], defType, num]
    );
  }
  const [itemRows] = await conn.execute("SELECT id, code FROM cpa_scope_items ORDER BY item_number");
  const itemId = {};
  itemRows.forEach(r => itemId[r.code] = r.id);
  console.log(`Scope items seeded (${itemRows.length})`);

  // ── 5. Scope Category Matrix (235 cells) ───────────────────────────────────
  const cats = ['VILLA', 'SMALL', 'MEDIUM', 'LARGE', 'MEGA'];
  const matrix = [
    // Items 1-28: INCLUDED for all
    ['CONCEPT_DESIGN',       'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['SCHEMATIC_DESIGN',     'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['DETAILED_DESIGN',      'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['ARCH_DESIGN',          'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['STRUCTURAL_CIVIL',     'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['MEP_ENGINEERING',      'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['FLS',                  'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['BIM',                  'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['QS_BOQ',               'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['PARKING_STRATEGY',     'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['WASTE_MANAGEMENT',     'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['SIGNAGE_WAYFINDING',   'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['INFRASTRUCTURE',       'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['AUTHORITY_SUBMISSIONS','INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['BUILDING_PERMIT',      'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['IFC_PACKAGE',          'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['TENDER_DOCS',          'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['TENDER_EVAL',          'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['FIDIC_CONTRACT',       'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['DIAC',                 'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['PI_INSURANCE',         'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['PL_INSURANCE',         'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['GOVERNING_LAW',        'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['RETENTION',            'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['FEE_CAP',              'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['CONFIDENTIALITY',      'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['IP',                   'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    ['TERMINATION',          'INCLUDED','INCLUDED','INCLUDED','INCLUDED','INCLUDED'],
    // Items 29-43: GREEN_SPECIALIZED
    ['GREEN_BUILDING',       'GREEN',        'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['STRUCTURAL_AUDIT',     'NOT_REQUIRED', 'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['SECURITY_SIRA',        'GREEN',        'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['VERTICAL_TRANSPORT',   'NOT_REQUIRED', 'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['BMU',                  'NOT_REQUIRED', 'CONTRACTOR',   'CONTRACTOR',   'CONTRACTOR',   'GREEN'],
    ['FACADE_ENGINEERING',   'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['WIND_TUNNEL',          'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['AV_ELV',               'NOT_REQUIRED', 'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['FLS_SPECIALIST',       'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['FACADE_LIGHTING',      'NOT_REQUIRED', 'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['TIS',                  'NOT_REQUIRED', 'GREEN',        'GREEN',        'GREEN',        'GREEN'],
    ['ACOUSTIC',             'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['LEED',                 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['COST_MANAGEMENT',      'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    ['VALUE_ENGINEERING',    'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'NOT_REQUIRED', 'GREEN'],
    // Items 44-47: RED_SPECIALIZED
    ['ID_COMMON_AREAS',      'NOT_REQUIRED', 'RED',          'RED',          'RED',          'RED'],
    ['ID_UNIT_PROTOTYPES',   'RED',          'RED',          'RED',          'RED',          'RED'],
    ['LANDSCAPE',            'NOT_REQUIRED', 'RED',          'RED',          'RED',          'RED'],
    ['WATER_FEATURES',       'NOT_REQUIRED', 'RED',          'RED',          'RED',          'RED'],
  ];

  for (const row of matrix) {
    const [itemCode, ...statuses] = row;
    for (let i = 0; i < cats.length; i++) {
      await conn.execute(
        `INSERT INTO cpa_scope_category_matrix (scope_item_id, building_category_id, status) VALUES (?, ?, ?)`,
        [itemId[itemCode], catId[cats[i]], statuses[i]]
      );
    }
  }
  console.log("Scope category matrix seeded (235 cells)");

  // ── 6. Scope Reference Costs ───────────────────────────────────────────────
  // [item_code, VILLA, SMALL, MEDIUM, LARGE, MEGA] — null = not applicable
  const refCosts = [
    ['GREEN_BUILDING',     20000,  35000,  40000,  40000,  75900],
    ['STRUCTURAL_AUDIT',   null,   45000,  60000,  60000,  150000],
    ['SECURITY_SIRA',      20000,  40000,  50000,  50000,  100000],
    ['VERTICAL_TRANSPORT', null,   40000,  50000,  50000,  149500],
    ['BMU',                null,   null,   null,   null,   81560],
    ['FACADE_ENGINEERING', null,   null,   null,   null,   469208],
    ['WIND_TUNNEL',        null,   null,   null,   null,   138000],
    ['AV_ELV',             null,   55000,  65000,  65000,  200000],
    ['FLS_SPECIALIST',     null,   null,   null,   null,   172500],
    ['FACADE_LIGHTING',    null,   70000,  70000,  70000,  98000],
    ['TIS',                null,   null,   null,   null,   255300],
    ['ACOUSTIC',           null,   null,   null,   null,   59800],
    ['LEED',               null,   null,   null,   null,   100000],
    ['COST_MANAGEMENT',    null,   null,   null,   null,   442750],
    ['VALUE_ENGINEERING',  null,   null,   null,   null,   null],
  ];

  let refCount = 0;
  for (const row of refCosts) {
    const [itemCode, ...costs] = row;
    for (let i = 0; i < cats.length; i++) {
      if (costs[i] !== null) {
        await conn.execute(
          `INSERT INTO cpa_scope_reference_costs (scope_item_id, building_category_id, cost_aed) VALUES (?, ?, ?)`,
          [itemId[itemCode], catId[cats[i]], costs[i]]
        );
        refCount++;
      }
    }
  }
  console.log(`Scope reference costs seeded (${refCount} non-null entries)`);

  // ── 7. Supervision Roles ───────────────────────────────────────────────────
  const roles = [
    ['RE',             'Resident Engineer',              'Senior',    'SITE',        45000, 1],
    ['DEPUTY_RE',      'Deputy Resident Engineer',       'Senior',    'SITE',        40000, 2],
    ['CIVIL_INSPECTOR','Civil Inspector',                'Mid',       'SITE',        18000, 3],
    ['MEP_INSPECTOR',  'MEP Inspector',                  'Mid',       'SITE',        20000, 4],
    ['HSE_OFFICER',    'HSE Officer',                    'Mid',       'SITE',        18000, 5],
    ['DOC_CONTROLLER', 'Document Controller',            'Junior/Mid','SITE',        12000, 6],
    ['QA_QC',          'QA/QC Engineer',                 'Mid/Senior','SITE',        28000, 7],
    ['HO_STRUCTURAL',  'Structural Engineer (H/O)',      'Senior',    'HEAD_OFFICE', 35000, 8],
    ['HO_ARCH',        'Architectural Engineer (H/O)',   'Senior',    'HEAD_OFFICE', 32000, 9],
    ['HO_MECHANICAL',  'Mechanical Engineer (H/O)',      'Senior',    'HEAD_OFFICE', 35000, 10],
    ['HO_ELECTRICAL',  'Electrical Engineer (H/O)',      'Senior',    'HEAD_OFFICE', 35000, 11],
  ];
  for (const [code, label, grade, teamType, rate, sortOrder] of roles) {
    await conn.execute(
      `INSERT INTO cpa_supervision_roles (code, label, grade, team_type, monthly_rate_aed, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [code, label, grade, teamType, rate, sortOrder]
    );
  }
  const [roleRows] = await conn.execute("SELECT id, code FROM cpa_supervision_roles ORDER BY sort_order");
  const roleId = {};
  roleRows.forEach(r => roleId[r.code] = r.id);
  console.log("Supervision roles seeded (11)");

  // ── 8. Supervision Baseline ────────────────────────────────────────────────
  // [role_code, VILLA%, SMALL%, MEDIUM%, LARGE%, MEGA%] — 0 = not required
  const baseline = [
    ['RE',             100, 100, 100, 100, 100],
    ['DEPUTY_RE',        0,   0,   0, 100, 100],
    ['CIVIL_INSPECTOR', 40,  70, 100, 100, 100],
    ['MEP_INSPECTOR',   30,  60, 100, 100, 100],
    ['HSE_OFFICER',     30, 100, 100, 100, 100],
    ['DOC_CONTROLLER',   0,  50, 100, 100, 100],
    ['QA_QC',            0,  40, 100, 100, 100],
    ['HO_STRUCTURAL',   20,  30,  40,  40,  40],
    ['HO_ARCH',         20,  30,  40,  40,  40],
    ['HO_MECHANICAL',   20,  30,  40,  40,  40],
    ['HO_ELECTRICAL',   20,  30,  40,  40,  40],
  ];

  for (const row of baseline) {
    const [roleCode, ...pcts] = row;
    for (let i = 0; i < cats.length; i++) {
      await conn.execute(
        `INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct) VALUES (?, ?, ?)`,
        [roleId[roleCode], catId[cats[i]], pcts[i]]
      );
    }
  }
  console.log("Supervision baseline seeded (55 cells)");

  await conn.end();
  console.log("\n Full CPA seed completed successfully!");
  console.log("   Building categories: 5");
  console.log("   Scope sections:      5");
  console.log("   Scope items:         47");
  console.log("   Matrix cells:        235");
  console.log("   Reference costs:     " + refCount + " non-null entries");
  console.log("   Supervision roles:   11");
  console.log("   Baseline cells:      55");
}

run().catch(err => {
  console.error("Seed failed:", err.message);
  console.error(err);
  process.exit(1);
});
