import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find project in old system
const [projects] = await conn.execute(
  "SELECT id, name, bua FROM projects WHERE name LIKE '%25%' OR name LIKE '%ارضي%'"
);
console.log('=== projects (old system) ===');
console.log(JSON.stringify(projects, null, 2));

// Find project in CPA system
const [cpaProjects] = await conn.execute(
  "SELECT id, project_id, project_name, building_category FROM cpa_projects WHERE project_name LIKE '%25%' OR project_name LIKE '%ارضي%'"
);
console.log('\n=== cpa_projects (CPA system) ===');
console.log(JSON.stringify(cpaProjects, null, 2));

if (cpaProjects.length > 0) {
  const cpaId = cpaProjects[0].id;
  
  // Get consultants for this CPA project
  const [cpaConsultants] = await conn.execute(
    `SELECT pc.id, pc.consultant_id, cm.name, pc.design_fee_method, pc.design_fee_amount, pc.design_fee_pct, pc.supervision_fee_method, pc.supervision_fee_amount, pc.supervision_fee_pct
     FROM cpa_project_consultants pc
     JOIN cpa_consultants_master cm ON pc.consultant_id = cm.id
     WHERE pc.cpa_project_id = ?`, [cpaId]
  );
  console.log('\n=== cpa_project_consultants (CPA fees) ===');
  console.log(JSON.stringify(cpaConsultants, null, 2));
  
  // Get evaluation results
  const pcIds = cpaConsultants.map(c => c.id);
  if (pcIds.length > 0) {
    const [evalResults] = await conn.execute(
      `SELECT er.project_consultant_id, cm.name, er.quoted_design_fee, er.design_scope_gap_cost, er.true_design_fee, er.quoted_supervision_fee, er.supervision_gap_cost, er.total_true_cost, er.eval_rank
       FROM cpa_evaluation_results er
       JOIN cpa_project_consultants pc ON er.project_consultant_id = pc.id
       JOIN cpa_consultants_master cm ON pc.consultant_id = cm.id
       WHERE er.project_consultant_id IN (${pcIds.join(',')})
       ORDER BY er.eval_rank`
    );
    console.log('\n=== cpa_evaluation_results (analysis) ===');
    console.log(JSON.stringify(evalResults, null, 2));
  }
}

if (projects.length > 0) {
  const projId = projects[0].id;
  
  // Get financial data from old system
  const [financialData] = await conn.execute(
    `SELECT fd.consultant_id, c.name, fd.design_type, fd.design_value, fd.design_amount, fd.supervision_type, fd.supervision_value, fd.supervision_amount
     FROM financial_data fd
     JOIN consultants c ON fd.consultant_id = c.id
     WHERE fd.project_id = ?`, [projId]
  );
  console.log('\n=== financial_data (old system fees) ===');
  console.log(JSON.stringify(financialData, null, 2));
}

await conn.end();
