/**
 * Insert Shopping Center supervision baseline data
 * Based on Arif & Bintoak PDF (T4121) - 30-month supervision period
 * Allocation % = duration_months / 30 * 100
 */
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

try {
  // First, get role IDs by code
  const [roles] = await connection.execute(
    'SELECT id, code FROM cpa_supervision_roles'
  );
  
  const roleMap = {};
  for (const role of roles) {
    roleMap[role.code] = role.id;
  }
  
  console.log('Available roles:', Object.keys(roleMap).join(', '));
  
  // Check if Shopping Center category exists
  const [cats] = await connection.execute(
    "SELECT id, code, supervision_duration_months FROM cpa_building_categories WHERE code = 'SHOPPING_CENTER'"
  );
  
  if (cats.length === 0) {
    console.error('Shopping Center category not found!');
    process.exit(1);
  }
  
  const catId = cats[0].id;
  console.log(`Shopping Center category ID: ${catId}, duration: ${cats[0].supervision_duration_months} months`);
  
  // Check existing baseline rows
  const [existing] = await connection.execute(
    'SELECT COUNT(*) as cnt FROM cpa_supervision_baseline WHERE building_category_id = ?',
    [catId]
  );
  
  if (existing[0].cnt > 0) {
    console.log(`Found ${existing[0].cnt} existing baseline rows for Shopping Center. Deleting...`);
    await connection.execute(
      'DELETE FROM cpa_supervision_baseline WHERE building_category_id = ?',
      [catId]
    );
  }
  
  // Baseline data: role_code -> { allocation_pct, duration_months, sort_order }
  // Based on Arif & Bintoak PDF (30-month supervision period)
  const baselineData = [
    { code: 'PD',                alloc: 90.0,  months: 27, sort: 1  },  // Project Manager
    { code: 'HO_STRUCTURAL',     alloc: 30.0,  months: 9,  sort: 2  },  // Structural Engineer
    { code: 'BIM_COORD',         alloc: 30.0,  months: 9,  sort: 3  },  // BIM Coordinator
    { code: 'HO_ARCH',           alloc: 50.0,  months: 15, sort: 4  },  // Architect
    { code: 'INTERIOR_DESIGNER', alloc: 26.7,  months: 8,  sort: 5  },  // ID Architect
    { code: 'SENIOR_ELEC',       alloc: 50.0,  months: 15, sort: 6  },  // Electrical Engineer
    { code: 'SENIOR_MECH',       alloc: 80.0,  months: 24, sort: 7  },  // Mechanical Engineer
    { code: 'CIVIL_INSPECTOR',   alloc: 100.0, months: 30, sort: 8  },  // Civil/Arch Inspector 1
    { code: 'ARCH_INSPECTOR',    alloc: 70.0,  months: 21, sort: 9  },  // Civil/Arch Inspector 2
    { code: 'ID_INSPECTOR',      alloc: 60.0,  months: 18, sort: 10 },  // ID Architectural Inspector
    { code: 'MECH_INSPECTOR',    alloc: 76.7,  months: 23, sort: 11 },  // Mechanical Inspector 1
    { code: 'ELEC_INSPECTOR',    alloc: 76.7,  months: 23, sort: 12 },  // Electrical Inspector 1
    { code: 'HSE_OFFICER',       alloc: 60.0,  months: 18, sort: 13 },  // Safety Engineer
    { code: 'ADMIN_OFFICER',     alloc: 100.0, months: 30, sort: 14 },  // Secretary/Doc Controller
  ];
  
  let inserted = 0;
  let skipped = 0;
  
  for (const row of baselineData) {
    const roleId = roleMap[row.code];
    if (!roleId) {
      console.warn(`  SKIP: Role code '${row.code}' not found in DB`);
      skipped++;
      continue;
    }
    
    await connection.execute(
      'INSERT INTO cpa_supervision_baseline (building_category_id, supervision_role_id, required_allocation_pct) VALUES (?, ?, ?)',
      [catId, roleId, row.alloc]
    );
    
    console.log(`  OK: ${row.code} -> ${row.alloc}% (${row.months}/30 months) [sort=${row.sort}]`);
    inserted++;
  }
  
  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
  
  // Verify
  const [verify] = await connection.execute(
    `SELECT r.code, r.label, b.required_allocation_pct
     FROM cpa_supervision_baseline b
     JOIN cpa_supervision_roles r ON r.id = b.supervision_role_id
     WHERE b.building_category_id = ?
     ORDER BY r.sort_order`,
    [catId]
  );
  
  console.log('\nVerification - Inserted rows:');
  for (const v of verify) {
    console.log(`  ${v.code}: ${v.required_allocation_pct}%`);
  }
  
} finally {
  await connection.end();
}
