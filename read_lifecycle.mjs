import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/home/ubuntu/como-consultant-dashboard/.env' });

// Try to get DATABASE_URL from environment or common locations
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

console.log('\n=== LIFECYCLE STAGES ===');
const [stages] = await conn.execute(
  'SELECT id, stageCode, nameAr, nameEn, category, isActive, sortOrder FROM lifecycle_stages ORDER BY sortOrder, id'
);
for (const s of stages) {
  console.log(`[${s.stageCode}] ${s.nameAr} | active=${s.isActive} | sort=${s.sortOrder}`);
}

console.log('\n=== LIFECYCLE SERVICES (per stage) ===');
const [services] = await conn.execute(
  'SELECT id, serviceCode, stageCode, nameAr, isMandatory, sortOrder FROM lifecycle_services ORDER BY stageCode, sortOrder, id'
);
let lastStage = '';
for (const sv of services) {
  if (sv.stageCode !== lastStage) {
    console.log(`\n  -- ${sv.stageCode} --`);
    lastStage = sv.stageCode;
  }
  console.log(`    [${sv.serviceCode}] ${sv.nameAr} | sort=${sv.sortOrder}`);
}

console.log('\n=== LIFECYCLE REQUIREMENTS count per service ===');
const [reqs] = await conn.execute(
  'SELECT serviceCode, reqType, COUNT(*) as cnt FROM lifecycle_requirements GROUP BY serviceCode, reqType ORDER BY serviceCode'
);
for (const r of reqs) {
  console.log(`  ${r.serviceCode} | ${r.reqType} | count=${r.cnt}`);
}

console.log('\n=== STAGE FIELD DEFINITIONS count per service ===');
const [fields] = await conn.execute(
  'SELECT serviceCode, COUNT(*) as cnt FROM stage_field_definitions GROUP BY serviceCode ORDER BY serviceCode'
);
for (const f of fields) {
  console.log(`  ${f.serviceCode} | fields=${f.cnt}`);
}

await conn.end();
