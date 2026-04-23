import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Test the raw SQL that getProjectFinancialData uses
const [rows] = await conn.execute(`
  SELECT 
    cpc.consultant_id as consultantId,
    cer.design_scope_gap_cost as designScopeGapCost
  FROM cpa_projects cp
  JOIN cpa_project_consultants cpc ON cpc.cpa_project_id = cp.id
  LEFT JOIN cpa_evaluation_results cer ON cer.project_consultant_id = cpc.id
  WHERE cp.project_id = 2
`);

console.log('Gap results for project 2 (مجان G+4P+25):');
console.log(JSON.stringify(rows, null, 2));

// Also check the financial data
const [fin] = await conn.execute(`SELECT consultant_id, design_type, design_value FROM financial_data WHERE project_id = 2`);
console.log('\nFinancial data for project 2:');
console.log(JSON.stringify(fin, null, 2));

await conn.end();
