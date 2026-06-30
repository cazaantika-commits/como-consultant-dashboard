'use strict';
const mysql = require('mysql2/promise');

// Shopping Center baseline allocations (from cpa_supervision_baseline)
const baselineAlloc = {
  'PD': 90.00, 'HO_ARCH': 50.00, 'HO_STRUCTURAL': 30.00,
  'CIVIL_INSPECTOR': 100.00, 'CIVIL_INSPECTOR_2': 70.00,
  'SENIOR_MECH': 80.00, 'MECH_INSPECTOR': 76.70, 'MECH_INSPECTOR_2': 60.00,
  'SENIOR_ELEC': 50.00, 'ELEC_INSPECTOR': 76.70, 'ELEC_INSPECTOR_2': 60.00,
  'HSE_OFFICER': 60.00, 'ADMIN_OFFICER': 100.00,
  'ARCH_INSPECTOR': 70.00, 'BIM_COORD': 30.00,
  'ID_INSPECTOR': 60.00, 'INTERIOR_DESIGNER': 26.70,
};

// Role IDs from cpa_supervision_roles
const roleMap = {
  'PD': 90001, 'HO_STRUCTURAL': 90005, 'CIVIL_INSPECTOR': 90007,
  'HO_ARCH': 90009, 'ARCH_INSPECTOR': 90010, 'INTERIOR_DESIGNER': 90012,
  'ID_INSPECTOR': 90013, 'HSE_OFFICER': 90015, 'SENIOR_MECH': 90016,
  'MECH_INSPECTOR': 90017, 'SENIOR_ELEC': 90018, 'ELEC_INSPECTOR': 90019,
  'ADMIN_OFFICER': 90032, 'BIM_COORD': 90034,
  'CIVIL_INSPECTOR_2': 150001, 'MECH_INSPECTOR_2': 150002, 'ELEC_INSPECTOR_2': 150003,
};

// K&P rates: actual from proposal + estimated at 1.05x A&B ref for missing roles
const kpTeam = [
  // Actual from K&P proposal
  { code: 'PD',                rate: 69938.00,  note: 'Resident Engineer - K&P proposal' },
  { code: 'HO_ARCH',           rate: 43197.00,  note: 'Sr. Architect - K&P proposal' },
  { code: 'HO_STRUCTURAL',     rate: 46282.50,  note: 'Structure Engineer - K&P proposal' },
  { code: 'CIVIL_INSPECTOR',   rate: 22627.00,  note: 'Civil/Structure Inspector - K&P proposal' },
  { code: 'SENIOR_MECH',       rate: 43197.00,  note: 'Sr. Mechanical Engineer - K&P proposal' },
  { code: 'MECH_INSPECTOR',    rate: 22627.00,  note: 'Mechanical Inspector - K&P proposal' },
  { code: 'SENIOR_ELEC',       rate: 43197.00,  note: 'Sr. Electrical Engineer - K&P proposal' },
  { code: 'ELEC_INSPECTOR',    rate: 22627.00,  note: 'Electrical Inspector - K&P proposal' },
  { code: 'HSE_OFFICER',       rate: 26741.00,  note: 'HSE Officer - K&P proposal' },
  { code: 'ADMIN_OFFICER',     rate: 13370.50,  note: 'Document Controller - K&P proposal' },
  // Estimated at 1.05x A&B baseline ref rate (avg K&P/A&B ratio = 1.05)
  { code: 'ARCH_INSPECTOR',    rate: 25203.00,  note: 'Estimated 1.05x A&B ref 24,000' },
  { code: 'BIM_COORD',         rate: 44106.00,  note: 'Estimated 1.05x A&B ref 42,000' },
  { code: 'CIVIL_INSPECTOR_2', rate: 44106.00,  note: 'Estimated 1.05x A&B ref 42,000' },
  { code: 'ELEC_INSPECTOR_2',  rate: 25203.00,  note: 'Estimated 1.05x A&B ref 24,000' },
  { code: 'ID_INSPECTOR',      rate: 18902.00,  note: 'Estimated 1.05x A&B ref 18,000' },
  { code: 'INTERIOR_DESIGNER', rate: 26253.00,  note: 'Estimated 1.05x A&B ref 25,000' },
  { code: 'MECH_INSPECTOR_2',  rate: 25203.00,  note: 'Estimated 1.05x A&B ref 24,000' },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const KP_PC_ID = 300002;
  const DURATION = 30;

  await conn.execute('DELETE FROM cpa_consultant_supervision_team WHERE project_consultant_id = ?', [KP_PC_ID]);
  console.log('Deleted old K&P team rows');

  let inserted = 0;
  let totalFee = 0;

  for (const row of kpTeam) {
    const roleId = roleMap[row.code];
    const alloc = baselineAlloc[row.code];
    if (!roleId || alloc === undefined) {
      console.log('SKIP - missing roleId or alloc for', row.code);
      continue;
    }
    await conn.execute(
      'INSERT INTO cpa_consultant_supervision_team (project_consultant_id, supervision_role_id, proposed_monthly_rate, proposed_allocation_pct, notes) VALUES (?, ?, ?, ?, ?)',
      [KP_PC_ID, roleId, row.rate, alloc, row.note]
    );
    const contrib = row.rate * DURATION * (alloc / 100);
    totalFee += contrib;
    console.log(row.code, '| rate:', row.rate, '| alloc:', alloc + '%', '| contrib:', Math.round(contrib).toLocaleString());
    inserted++;
  }

  console.log('---');
  console.log('Inserted:', inserted, 'rows');
  console.log('Calculated K&P total supervision fee: AED', Math.round(totalFee).toLocaleString());

  await conn.execute(
    'UPDATE cpa_project_consultants SET supervision_fee_method=?, supervision_fee_amount=NULL WHERE id=?',
    ['MONTHLY_RATE', KP_PC_ID]
  );
  console.log('Updated K&P supervision method to MONTHLY_RATE');

  await conn.end();
}

main().then(() => process.exit(0)).catch(function(e) { console.error(e.message); process.exit(1); });
