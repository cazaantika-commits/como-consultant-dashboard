import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check stage_field_definitions for SRV-RERA-PROJ-REG
const [fields] = await conn.execute(
  'SELECT * FROM stage_field_definitions WHERE serviceCode = ? LIMIT 10',
  ['SRV-RERA-PROJ-REG']
);
console.log('stage_field_definitions for SRV-RERA-PROJ-REG:', JSON.stringify(fields, null, 2));

// Check total count
const [cnt] = await conn.execute('SELECT COUNT(*) as cnt FROM stage_field_definitions');
console.log('Total stage_field_definitions:', cnt[0].cnt);

// Check if lifecycle_requirements data (reqType=data) can be used to populate stage_field_definitions
const [dataReqs] = await conn.execute(
  "SELECT * FROM lifecycle_requirements WHERE serviceCode = ? AND reqType = 'data'",
  ['SRV-RERA-PROJ-REG']
);
console.log('lifecycle_requirements data for SRV-RERA-PROJ-REG:', JSON.stringify(dataReqs, null, 2));

await conn.end();
