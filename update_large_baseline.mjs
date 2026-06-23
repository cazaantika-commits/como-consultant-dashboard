import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, 'como-consultant-dashboard/.env') });

const LARGE_CATEGORY_ID = 30009;

// Mapping from Excel roles to DB role IDs with calculated percentages
// Percentage = total_months / 24 * 100
const roleAllocations = [
  { roleId: 90003, pct: 89.5 },   // RE - Resident Engineer (21.49/24)
  { roleId: 90007, pct: 37.5 },   // CIVIL_INSPECTOR - Civil Engineer (9/24)
  { roleId: 90008, pct: 62.5 },   // SENIOR_ARCH - Senior Architect (15/24)
  { roleId: 90010, pct: 91.7 },   // ARCH_INSPECTOR - Architectural/Civil Inspector (22/24)
  { roleId: 90016, pct: 66.7 },   // SENIOR_MECH - Senior Mechanical Engineer (16/24)
  { roleId: 90017, pct: 75.0 },   // MECH_INSPECTOR - Mechanical Inspector (18/24)
  { roleId: 90018, pct: 58.3 },   // SENIOR_ELEC - Senior Electrical Engineer (14/24)
  { roleId: 90019, pct: 66.7 },   // ELEC_INSPECTOR - Electrical Inspector (16/24)
  { roleId: 90011, pct: 45.8 },   // SENIOR_ID - ID Architect (11/24)
  { roleId: 90029, pct: 25.0 },   // LANDSCAPE_ENG - Landscape Architect (6/24)
  { roleId: 90033, pct: 100.0 },  // DOC_CONTROLLER - Document Controller (24/24)
  { roleId: 90032, pct: 100.0 },  // ADMIN_OFFICER - Office Support (24/24)
];

// All other roles get 0%
const allRoleIds = [
  90001, 90002, 90003, 90004, 90005, 90006, 90007, 90008, 90009, 90010,
  90011, 90012, 90013, 90014, 90015, 90016, 90017, 90018, 90019, 90020,
  90021, 90022, 90023, 90024, 90025, 90026, 90027, 90028, 90029, 90030,
  90031, 90032, 90033, 90034
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('Updating supervision baseline for LARGE category (id=30009)...\n');
  
  let updated = 0;
  let inserted = 0;
  
  for (const roleId of allRoleIds) {
    const allocation = roleAllocations.find(r => r.roleId === roleId);
    const pct = allocation ? allocation.pct : 0;
    
    // Check if record exists
    const [existing] = await conn.execute(
      'SELECT id FROM cpa_supervision_baseline WHERE supervision_role_id = ? AND building_category_id = ?',
      [roleId, LARGE_CATEGORY_ID]
    );
    
    if (existing.length > 0) {
      await conn.execute(
        'UPDATE cpa_supervision_baseline SET required_allocation_pct = ?, updated_at = NOW() WHERE supervision_role_id = ? AND building_category_id = ?',
        [pct, roleId, LARGE_CATEGORY_ID]
      );
      updated++;
    } else {
      await conn.execute(
        'INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [roleId, LARGE_CATEGORY_ID, pct]
      );
      inserted++;
    }
    
    if (pct > 0) {
      console.log(`  ✓ Role ${roleId}: ${pct}%`);
    }
  }
  
  console.log(`\nDone: ${updated} updated, ${inserted} inserted`);
  
  // Verify
  const [result] = await conn.execute(`
    SELECT r.code, r.label, sb.required_allocation_pct 
    FROM cpa_supervision_baseline sb 
    JOIN cpa_supervision_roles r ON r.id = sb.supervision_role_id 
    WHERE sb.building_category_id = ? AND sb.required_allocation_pct > 0
    ORDER BY sb.required_allocation_pct DESC
  `, [LARGE_CATEGORY_ID]);
  
  console.log('\n=== LARGE BASELINE (non-zero only) ===');
  result.forEach(r => console.log(`  ${r.label}: ${r.required_allocation_pct}%`));
  
  await conn.end();
}

main().catch(console.error);
