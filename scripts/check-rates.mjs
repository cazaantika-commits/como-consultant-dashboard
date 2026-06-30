import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [rows] = await connection.execute(
    `SELECT code, label, monthly_rate_aed FROM cpa_supervision_roles 
     WHERE code IN ('BIM_COORD','DOC_CONTROLLER','ADMIN_OFFICER','CIVIL_INSPECTOR','CIVIL_INSPECTOR_2','MECH_INSPECTOR','MECH_INSPECTOR_2','ELEC_INSPECTOR','ELEC_INSPECTOR_2') 
     ORDER BY code`
  );
  
  console.log('Current rates:');
  for (const r of rows) {
    console.log(`  ${r.code}: ${r.monthly_rate_aed} AED`);
  }
  
  // Update BIM_COORD to 42000 AED (same as other senior engineers)
  // DOC_CONTROLLER already has ADMIN_OFFICER at 12000 AED
  const [bimRow] = rows.filter(r => r.code === 'BIM_COORD');
  if (bimRow && parseFloat(bimRow.monthly_rate_aed) === 0) {
    await connection.execute(
      "UPDATE cpa_supervision_roles SET monthly_rate_aed = 42000 WHERE code = 'BIM_COORD'"
    );
    console.log('\nUpdated BIM_COORD: 0 -> 42000 AED');
  }
  
  // Check DOC_CONTROLLER
  const [docRow] = rows.filter(r => r.code === 'DOC_CONTROLLER');
  if (docRow && parseFloat(docRow.monthly_rate_aed) === 0) {
    await connection.execute(
      "UPDATE cpa_supervision_roles SET monthly_rate_aed = 12000 WHERE code = 'DOC_CONTROLLER'"
    );
    console.log('Updated DOC_CONTROLLER: 0 -> 12000 AED');
  }
  
} finally {
  await connection.end();
  process.exit(0);
}
