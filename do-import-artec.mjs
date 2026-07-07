import fs from 'fs';
import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await getDb();

  // Find CPA project for Majan Mall (project id=1 in projects table, code 270001)
  const cpaProjects = await db.execute(
    sql`SELECT id, project_id FROM cpa_projects ORDER BY id`
  );
  // drizzle mysql2 execute returns [rows, fields] tuple
  const cpaRows = Array.isArray(cpaProjects[0]) ? cpaProjects[0] : (Array.isArray(cpaProjects) ? cpaProjects : []);
  console.log('CPA Projects:');
  cpaRows.forEach(r => console.log(' -', r.id, '| project_id:', r.project_id));

  // Find the one linked to project id=1 (مركز مجان التجاري)
  const majanCpa = cpaRows.find(r => r.project_id == 1);
  if (!majanCpa) {
    console.log('\nNo CPA project linked to project_id=1.');
    process.exit(0);
  }

  console.log('\nFound CPA project for Majan Mall:', majanCpa.id, majanCpa.name);

  // Now import the JSON
  const jsonText = fs.readFileSync('/home/ubuntu/ARTEC_AAEC_MajanMall_import.json', 'utf8');

  const body = JSON.stringify({
    "0": {
      json: {
        cpaProjectId: Number(majanCpa.id),
        jsonText
      }
    }
  });

  const res = await fetch('http://localhost:3000/api/trpc/cpa.importJson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpaProjectId: Number(majanCpa.id), jsonText })
  });

  const data = await res.json();
  console.log('\nImport Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
