import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check projects table
const [projects] = await conn.execute('SELECT id, name FROM projects LIMIT 10');
console.log('=== projects table ===');
projects.forEach(p => console.log(`  id=${p.id}: ${p.name}`));

// Check cpa_projects table
const [cpaProjects] = await conn.execute('SELECT id, project_name, project_code FROM cpa_projects LIMIT 10');
console.log('\n=== cpa_projects table ===');
cpaProjects.forEach(p => console.log(`  id=${p.id}: ${p.project_name} (${p.project_code})`));

// Check consultants table
const [consultants] = await conn.execute('SELECT id, name FROM consultants LIMIT 10');
console.log('\n=== consultants table ===');
consultants.forEach(c => console.log(`  id=${c.id}: ${c.name}`));

// Check cpa_consultants_master table
const [cpaConsultants] = await conn.execute('SELECT id, code, legal_name FROM cpa_consultants_master LIMIT 10');
console.log('\n=== cpa_consultants_master table ===');
cpaConsultants.forEach(c => console.log(`  id=${c.id}: ${c.code} - ${c.legal_name}`));

// Check financialData table
const [fins] = await conn.execute('SELECT id, projectId, consultantId, designValue, supervisionValue FROM financialData LIMIT 10');
console.log('\n=== financialData table ===');
fins.forEach(f => console.log(`  projectId=${f.projectId}, consultantId=${f.consultantId}, design=${f.designValue}, supervision=${f.supervisionValue}`));

// Check cpa_evaluation_results
const [cpaResults] = await conn.execute('SELECT project_id, consultant_id, total_gap_cost FROM cpa_evaluation_results LIMIT 10');
console.log('\n=== cpa_evaluation_results (sample) ===');
cpaResults.forEach(r => console.log(`  cpa_project_id=${r.project_id}, cpa_consultant_id=${r.consultant_id}, gap=${r.total_gap_cost}`));

// Check projectConsultants
const [pcs] = await conn.execute('SELECT projectId, consultantId FROM projectConsultants LIMIT 10');
console.log('\n=== projectConsultants table ===');
pcs.forEach(pc => console.log(`  projectId=${pc.projectId}, consultantId=${pc.consultantId}`));

await conn.end();
