/**
 * Add Shopping Center scope items based on Artec invitation letter
 * Checks existing items, adds missing ones, and links all to Shopping Center category
 */
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. Get existing scope items
  const [existingItems] = await connection.execute(
    'SELECT id, code, label_en, label_ar, section_id, sort_order FROM cpa_scope_items ORDER BY sort_order'
  );
  console.log(`\nExisting scope items (${existingItems.length} total):`);
  for (const item of existingItems) {
    console.log(`  [${item.id}] ${item.code}: ${item.label_en}`);
  }

  // 2. Get existing scope sections
  const [sections] = await connection.execute(
    'SELECT id, code, label_en FROM cpa_scope_sections ORDER BY sort_order'
  );
  console.log(`\nExisting sections (${sections.length}):`);
  for (const s of sections) {
    console.log(`  [${s.id}] ${s.code}: ${s.label_en}`);
  }

  // 3. Get Shopping Center category ID
  const [cats] = await connection.execute(
    "SELECT id FROM cpa_building_categories WHERE code = 'SHOPPING_CENTER'"
  );
  const catId = cats[0]?.id;
  console.log(`\nShopping Center category ID: ${catId}`);

  // 4. Check existing scope_category_matrix for Shopping Center
  const [existingMatrix] = await connection.execute(
    'SELECT scope_item_id FROM cpa_scope_category_matrix WHERE building_category_id = ?',
    [catId]
  );
  const existingMatrixIds = new Set(existingMatrix.map(r => r.scope_item_id));
  console.log(`\nExisting matrix entries for Shopping Center: ${existingMatrixIds.size}`);

  // 5. Check table structure
  const [descItems] = await connection.execute('DESCRIBE cpa_scope_items');
  console.log('\ncpa_scope_items columns:', descItems.map(c => c.Field).join(', '));

  const [descMatrix] = await connection.execute('DESCRIBE cpa_scope_category_matrix');
  console.log('cpa_scope_category_matrix columns:', descMatrix.map(c => c.Field).join(', '));

  // Force flush
  await new Promise(r => setTimeout(r, 100));
} finally {
  await connection.end();
  process.exit(0);
}
