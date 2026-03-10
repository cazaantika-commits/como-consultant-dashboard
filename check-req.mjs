import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT requirementCode, reqType, nameAr, isMandatory FROM lifecycle_requirements WHERE serviceCode = ? ORDER BY sortOrder',
  ['SRV-RERA-PROJ-REG']
);
console.log('Requirements for SRV-RERA-PROJ-REG:', JSON.stringify(rows, null, 2));

// Also check what the UI shows - the service has "0/10 متطلبات"
// Let's check all requirements for this service
const [all] = await conn.execute(
  'SELECT COUNT(*) as cnt, reqType FROM lifecycle_requirements WHERE serviceCode = ? GROUP BY reqType',
  ['SRV-RERA-PROJ-REG']
);
console.log('Count by reqType:', JSON.stringify(all));

await conn.end();
