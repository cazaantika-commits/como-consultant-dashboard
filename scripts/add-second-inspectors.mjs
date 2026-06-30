/**
 * Add second inspector roles for Shopping Center (Arif & Bintoak baseline)
 * Civil/Arch Inspector 2: 70% (21/30 months)
 * Mechanical Inspector 2: 60% (18/30 months)
 * Electrical Inspector 2: 60% (18/30 months)
 */
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

try {
  // Get Shopping Center category ID
  const [cats] = await connection.execute(
    "SELECT id FROM cpa_building_categories WHERE code = 'SHOPPING_CENTER'"
  );
  const catId = cats[0].id;
  console.log(`Shopping Center category ID: ${catId}`);

  // Get existing inspector roles to copy their sort_order and monthly rates
  const [existingRoles] = await connection.execute(
    "SELECT id, code, label, grade, team_type, monthly_rate_aed, sort_order FROM cpa_supervision_roles WHERE code IN ('CIVIL_INSPECTOR','MECH_INSPECTOR','ELEC_INSPECTOR')"
  );
  
  // Build a map
  const roleMap = {};
  for (const r of existingRoles) {
    roleMap[r.code] = r;
  }
  console.log('Existing inspector roles:', Object.keys(roleMap));

  // Check if second inspector roles already exist
  const [existing2] = await connection.execute(
    "SELECT code FROM cpa_supervision_roles WHERE code IN ('CIVIL_INSPECTOR_2','MECH_INSPECTOR_2','ELEC_INSPECTOR_2')"
  );
  const existing2Codes = existing2.map(r => r.code);
  console.log('Already existing second inspector roles:', existing2Codes);

  // Define second inspector roles based on Arif & Bintoak
  const secondInspectors = [
    {
      code: 'CIVIL_INSPECTOR_2',
      label: 'Civil / Arch Inspector 2',
      basedOn: 'CIVIL_INSPECTOR',
      alloc: 70.0,
      months: 21,
      sortOffset: 1, // sort right after CIVIL_INSPECTOR
    },
    {
      code: 'MECH_INSPECTOR_2',
      label: 'Mechanical Inspector 2',
      basedOn: 'MECH_INSPECTOR',
      alloc: 60.0,
      months: 18,
      sortOffset: 1,
    },
    {
      code: 'ELEC_INSPECTOR_2',
      label: 'Electrical Inspector 2',
      basedOn: 'ELEC_INSPECTOR',
      alloc: 60.0,
      months: 18,
      sortOffset: 1,
    },
  ];

  const newRoleIds = {};

  for (const insp of secondInspectors) {
    if (existing2Codes.includes(insp.code)) {
      console.log(`  SKIP: Role ${insp.code} already exists`);
      // Get its ID
      const [r] = await connection.execute(
        "SELECT id FROM cpa_supervision_roles WHERE code = ?",
        [insp.code]
      );
      newRoleIds[insp.code] = r[0].id;
      continue;
    }

    const base = roleMap[insp.basedOn];
    if (!base) {
      console.warn(`  SKIP: Base role ${insp.basedOn} not found`);
      continue;
    }

    // Insert new role with same rate as the first inspector
    const [result] = await connection.execute(
      `INSERT INTO cpa_supervision_roles (code, label, grade, team_type, monthly_rate_aed, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        insp.code,
        insp.label,
        base.grade || null,
        base.team_type || 'SITE',
        base.monthly_rate_aed || 0,
        (base.sort_order || 0) + insp.sortOffset,
      ]
    );
    newRoleIds[insp.code] = result.insertId;
    console.log(`  INSERTED role: ${insp.code} (id=${result.insertId})`);
  }

  // Now add baseline rows for Shopping Center
  for (const insp of secondInspectors) {
    const roleId = newRoleIds[insp.code];
    if (!roleId) {
      console.warn(`  SKIP baseline: No roleId for ${insp.code}`);
      continue;
    }

    // Check if baseline row already exists
    const [existBaseline] = await connection.execute(
      "SELECT id FROM cpa_supervision_baseline WHERE building_category_id = ? AND supervision_role_id = ?",
      [catId, roleId]
    );

    if (existBaseline.length > 0) {
      console.log(`  SKIP baseline: ${insp.code} already has baseline for Shopping Center`);
      continue;
    }

    await connection.execute(
      "INSERT INTO cpa_supervision_baseline (building_category_id, supervision_role_id, required_allocation_pct) VALUES (?, ?, ?)",
      [catId, roleId, insp.alloc]
    );
    console.log(`  INSERTED baseline: ${insp.code} -> ${insp.alloc}% (${insp.months}/30 months)`);
  }

  // Verify all baseline rows for Shopping Center
  const [verify] = await connection.execute(
    `SELECT r.code, r.label, b.required_allocation_pct
     FROM cpa_supervision_baseline b
     JOIN cpa_supervision_roles r ON r.id = b.supervision_role_id
     WHERE b.building_category_id = ?
     ORDER BY r.sort_order`,
    [catId]
  );

  console.log(`\nFinal baseline for Shopping Center (${verify.length} roles):`);
  for (const v of verify) {
    console.log(`  ${v.code}: ${v.required_allocation_pct}%`);
  }

} finally {
  await connection.end();
  process.exit(0);
}
