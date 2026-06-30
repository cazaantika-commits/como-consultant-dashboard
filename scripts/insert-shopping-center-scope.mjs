/**
 * Insert Shopping Center scope items and link them in cpa_scope_category_matrix
 * Based on Artec invitation letter for Shopping Centre Majan (Plot 6457956)
 */
import mysql from 'mysql2/promise';
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const connection = await mysql.createConnection(dbUrl);
try {
  const CAT_ID = 60001; // Shopping Center

  // Step 1: Insert 3 new scope items not in existing 47
  const newItems = [
    { id: 30066, code: 'CFD_MODELLING', label: 'CFD Modelling (Atriums & Car Parking)', section_id: 4, sort_order: 48 },
    { id: 30067, code: 'CONSTRUCTION_SUPERVISION', label: 'Full Construction Supervision', section_id: 2, sort_order: 49 },
    { id: 30068, code: 'DLP_SERVICES', label: 'Services during Defects Liability Period (DLP)', section_id: 2, sort_order: 50 },
  ];

  console.log('Step 1: Inserting new scope items...');
  for (const item of newItems) {
    const [existing] = await connection.execute(
      'SELECT id FROM cpa_scope_items WHERE code = ?',
      [item.code]
    );
    if (existing.length > 0) {
      console.log(`  SKIP (exists): ${item.code}`);
    } else {
      await connection.execute(
        `INSERT INTO cpa_scope_items (id, code, label, section_id, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [item.id, item.code, item.label, item.section_id, item.sort_order]
      );
      console.log(`  INSERTED: ${item.code}`);
    }
  }

  // Step 2: Link all 28 items to Shopping Center
  const allItemIds = [
    30022, // ARCH_DESIGN
    30023, // STRUCTURAL_CIVIL
    30024, // MEP_ENGINEERING
    30025, // FLS
    30026, // BIM
    30027, // QS_BOQ
    30028, // PARKING_STRATEGY
    30029, // WASTE_MANAGEMENT
    30030, // SIGNAGE_WAYFINDING
    30031, // INFRASTRUCTURE
    30034, // IFC_PACKAGE
    30035, // TENDER_DOCS
    30047, // GREEN_BUILDING
    30049, // SECURITY_SIRA
    30050, // VERTICAL_TRANSPORT
    30051, // BMU
    30052, // FACADE_ENGINEERING
    30054, // AV_ELV
    30056, // FACADE_LIGHTING
    30057, // TIS
    30058, // ACOUSTIC
    30059, // LEED
    30062, // ID_COMMON_AREAS
    30064, // LANDSCAPE
    30065, // WATER_FEATURES
    30066, // CFD_MODELLING (new)
    30067, // CONSTRUCTION_SUPERVISION (new)
    30068, // DLP_SERVICES (new)
  ];

  console.log(`\nStep 2: Linking ${allItemIds.length} items to Shopping Center...`);
  let linked = 0;
  let skipped = 0;
  for (const itemId of allItemIds) {
    const [existing] = await connection.execute(
      'SELECT id FROM cpa_scope_category_matrix WHERE scope_item_id = ? AND building_category_id = ?',
      [itemId, CAT_ID]
    );
    if (existing.length > 0) {
      skipped++;
    } else {
      await connection.execute(
        `INSERT INTO cpa_scope_category_matrix (scope_item_id, building_category_id, status, created_at, updated_at)
         VALUES (?, ?, 'INCLUDED', NOW(), NOW())`,
        [itemId, CAT_ID]
      );
      linked++;
    }
  }
  console.log(`  Linked: ${linked} | Skipped: ${skipped}`);

  // Step 3: Verify
  const [matrixCount] = await connection.execute(
    'SELECT COUNT(*) as cnt FROM cpa_scope_category_matrix WHERE building_category_id = ?',
    [CAT_ID]
  );
  console.log(`\nTotal scope items for Shopping Center: ${matrixCount[0].cnt}`);

  // List all linked items
  const [linked_items] = await connection.execute(
    `SELECT si.code, si.label FROM cpa_scope_category_matrix m
     JOIN cpa_scope_items si ON si.id = m.scope_item_id
     WHERE m.building_category_id = ?
     ORDER BY si.sort_order`,
    [CAT_ID]
  );
  console.log('\nLinked scope items:');
  for (const item of linked_items) {
    console.log(`  ${item.code}: ${item.label}`);
  }

} finally {
  await connection.end();
  process.exit(0);
}
