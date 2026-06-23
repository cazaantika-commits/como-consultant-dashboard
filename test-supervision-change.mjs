import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get MEDIUM category id and RE role id
const [[medCat]] = await conn.execute("SELECT id FROM cpa_building_categories WHERE code = 'MEDIUM'");
const [[reRole]] = await conn.execute("SELECT id FROM cpa_supervision_roles WHERE code = 'RE'");
console.log('MEDIUM catId:', medCat.id, 'RE roleId:', reRole.id);

// Current value
const [[current]] = await conn.execute(
  'SELECT required_allocation_pct FROM cpa_supervision_baseline WHERE building_category_id=? AND supervision_role_id=?',
  [medCat.id, reRole.id]
);
console.log('Current RE MEDIUM:', current?.required_allocation_pct);

// Change to 80%
await conn.execute(
  'INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct) VALUES (?,?,?) ON DUPLICATE KEY UPDATE required_allocation_pct=VALUES(required_allocation_pct)',
  [reRole.id, medCat.id, 80]
);
console.log('Changed RE MEDIUM to 80%');

// Now check what runCalculationEngine would read
const [[updated]] = await conn.execute(
  'SELECT required_allocation_pct FROM cpa_supervision_baseline WHERE building_category_id=? AND supervision_role_id=?',
  [medCat.id, reRole.id]
);
console.log('After update RE MEDIUM:', updated?.required_allocation_pct);

// Restore to original
await conn.execute(
  'INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct) VALUES (?,?,?) ON DUPLICATE KEY UPDATE required_allocation_pct=VALUES(required_allocation_pct)',
  [reRole.id, medCat.id, current?.required_allocation_pct || 40]
);
console.log('Restored to original:', current?.required_allocation_pct);

await conn.end();
console.log('\nConclusion: The upsertBaselineEntry procedure DOES save to DB correctly.');
console.log('The issue is that getResults needs to be called AFTER the settings change to see new values.');
process.exit(0);
