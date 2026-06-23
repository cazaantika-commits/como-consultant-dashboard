import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log("=== STARTING BASELINE UPDATE ===\n");

  // ─────────────────────────────────────────────
  // 1. DELETE HEAD_OFFICE roles (deactivate + set allocation to 0)
  // ─────────────────────────────────────────────
  const rolesToDelete = [
    90005, // HO_STRUCTURAL
    90009, // HO_ARCH
    90012, // INTERIOR_DESIGNER
    90034, // BIM_COORD
    90032, // ADMIN_OFFICER (merged into OFFICE_SUPPORT)
  ];

  console.log("1. Deactivating roles:", rolesToDelete);
  
  // Deactivate the roles
  await conn.query(
    `UPDATE cpa_supervision_roles SET is_active = 0 WHERE id IN (?)`,
    [rolesToDelete]
  );
  
  // Set their baseline allocation to 0 for ALL categories
  await conn.query(
    `UPDATE cpa_supervision_baseline SET required_allocation_pct = 0 WHERE supervision_role_id IN (?)`,
    [rolesToDelete]
  );
  
  console.log("   ✓ Deactivated 5 roles and zeroed their allocations\n");

  // ─────────────────────────────────────────────
  // 2. Change SENIOR_* roles from HEAD_OFFICE to SITE
  // ─────────────────────────────────────────────
  const rolesToChangeSite = [
    90008, // SENIOR_ARCH
    90011, // SENIOR_ID
    90016, // SENIOR_MECH
    90018, // SENIOR_ELEC
  ];

  console.log("2. Changing team_type to SITE:", rolesToChangeSite);
  await conn.query(
    `UPDATE cpa_supervision_roles SET team_type = 'SITE' WHERE id IN (?)`,
    [rolesToChangeSite]
  );
  console.log("   ✓ Changed 4 SENIOR roles to SITE type\n");

  // ─────────────────────────────────────────────
  // 3. Update monthly rates for specific roles
  // ─────────────────────────────────────────────
  console.log("3. Updating monthly rates...");
  
  // CIVIL_INSPECTOR → rename to Civil Engineer and set rate to 42,000
  await conn.query(
    `UPDATE cpa_supervision_roles SET label = 'Civil Engineer', monthly_rate_aed = 42000.00 WHERE id = 90007`
  );
  console.log("   ✓ CIVIL_INSPECTOR → Civil Engineer, rate=42,000");

  // HSE_OFFICER → update rate to 26,741
  await conn.query(
    `UPDATE cpa_supervision_roles SET monthly_rate_aed = 26741.00, label = 'HSE Officer' WHERE id = 90015`
  );
  console.log("   ✓ HSE_OFFICER rate=26,741");

  // DOC_CONTROLLER → rate = 0 (by Contractor)
  await conn.query(
    `UPDATE cpa_supervision_roles SET monthly_rate_aed = 0.00 WHERE id = 90033`
  );
  console.log("   ✓ DOC_CONTROLLER rate=0 (by Contractor)");

  // LANDSCAPE_ENG → rename to Landscape Architect
  await conn.query(
    `UPDATE cpa_supervision_roles SET label = 'Landscape Architect' WHERE id = 90029`
  );
  console.log("   ✓ LANDSCAPE_ENG → Landscape Architect\n");

  // ─────────────────────────────────────────────
  // 4. Add OFFICE_SUPPORT role
  // ─────────────────────────────────────────────
  console.log("4. Adding OFFICE_SUPPORT role...");
  
  const [insertResult] = await conn.query(
    `INSERT INTO cpa_supervision_roles (code, label, grade, team_type, monthly_rate_aed, sort_order, is_active)
     VALUES ('OFFICE_SUPPORT', 'Office Support', '', 'SITE', 30000.00, 35, 1)`
  );
  const offSupportId = insertResult.insertId;
  console.log("   ✓ OFFICE_SUPPORT created with id:", offSupportId);

  // Add baseline allocations for OFFICE_SUPPORT (100% for ALL categories)
  const categories = [30006, 30007, 30008, 30009, 30010]; // VILLA, SMALL, MEDIUM, LARGE, MEGA
  for (const catId of categories) {
    await conn.query(
      `INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct)
       VALUES (?, ?, 100.00)`,
      [offSupportId, catId]
    );
  }
  console.log("   ✓ OFFICE_SUPPORT baseline set to 100% for all 5 categories\n");

  // ─────────────────────────────────────────────
  // 5. Update HSE_OFFICER baseline for LARGE = 15%
  // ─────────────────────────────────────────────
  console.log("5. Updating HSE_OFFICER baseline for LARGE...");
  
  // HSE_OFFICER roleId = 90015, LARGE catId = 30009
  const [hseUpdate] = await conn.query(
    `UPDATE cpa_supervision_baseline SET required_allocation_pct = 15.00 
     WHERE supervision_role_id = 90015 AND building_category_id = 30009`
  );
  
  if (hseUpdate.affectedRows === 0) {
    // Insert if doesn't exist
    await conn.query(
      `INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct)
       VALUES (90015, 30009, 15.00)`
    );
    console.log("   ✓ HSE_OFFICER baseline INSERTED for LARGE = 15%");
  } else {
    console.log("   ✓ HSE_OFFICER baseline UPDATED for LARGE = 15%");
  }

  // ─────────────────────────────────────────────
  // 6. Verify final state
  // ─────────────────────────────────────────────
  console.log("\n=== VERIFICATION: LARGE Category Baseline (non-zero) ===");
  const [finalBaseline] = await conn.query(`
    SELECT r.id as roleId, r.code, r.label, r.team_type, r.monthly_rate_aed as rate, 
           b.required_allocation_pct as pct, r.is_active
    FROM cpa_supervision_baseline b 
    JOIN cpa_supervision_roles r ON b.supervision_role_id = r.id
    WHERE b.building_category_id = 30009 AND b.required_allocation_pct > 0 AND r.is_active = 1
    ORDER BY r.id
  `);
  console.table(finalBaseline);

  console.log("\n=== DEACTIVATED ROLES ===");
  const [deactivated] = await conn.query(`
    SELECT id, code, label, is_active FROM cpa_supervision_roles WHERE is_active = 0
  `);
  console.table(deactivated);

  console.log("\n=== ALL SITE ROLES (active) ===");
  const [siteRoles] = await conn.query(`
    SELECT id, code, label, team_type, monthly_rate_aed FROM cpa_supervision_roles 
    WHERE is_active = 1 AND team_type = 'SITE' ORDER BY id
  `);
  console.table(siteRoles);

  console.log("\n=== ALL HEAD_OFFICE ROLES (active) ===");
  const [hoRoles] = await conn.query(`
    SELECT id, code, label, team_type, monthly_rate_aed FROM cpa_supervision_roles 
    WHERE is_active = 1 AND team_type = 'HEAD_OFFICE' ORDER BY id
  `);
  console.table(hoRoles);

  console.log("\n=== BASELINE UPDATE COMPLETE ===");

} catch (err) {
  console.error("ERROR:", err.message);
  throw err;
} finally {
  await conn.end();
}
