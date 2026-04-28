import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("No DATABASE_URL"); process.exit(1); }

const db = drizzle(dbUrl);

async function qRows(db, query) {
  const result = await db.execute(query);
  return result.rows || result[0] || result;
}

async function main() {
  const cats = await qRows(db, sql`SELECT id, code, label FROM cpa_building_categories ORDER BY id`);
  console.log("=== Building Categories ===");
  for (const c of cats) console.log(`  ${c.id}: ${c.code} - ${c.label}`);
  
  const roles = await qRows(db, sql`SELECT id, code, label, monthly_rate_aed FROM cpa_supervision_roles ORDER BY sort_order`);
  console.log("\n=== Supervision Roles ===");
  for (const r of roles) console.log(`  ${r.id}: ${r.code} (${r.label}) - AED ${r.monthly_rate_aed}/month`);
  
  const allBaseline = await qRows(db, sql`
    SELECT sb.supervision_role_id, sb.building_category_id, sb.required_allocation_pct, 
           sr.code, sr.label, sr.monthly_rate_aed, bc.label as cat_label
    FROM cpa_supervision_baseline sb
    JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
    JOIN cpa_building_categories bc ON bc.id = sb.building_category_id
    WHERE sb.required_allocation_pct > 0
    ORDER BY bc.id, sr.sort_order
  `);
  
  const byCat = {};
  for (const b of allBaseline) {
    const key = `${b.building_category_id}: ${b.cat_label}`;
    if (!byCat[key]) byCat[key] = [];
    byCat[key].push(b);
  }
  
  for (const [cat, entries] of Object.entries(byCat)) {
    console.log(`\n=== Baseline for ${cat} ===`);
    for (const b of entries) {
      console.log(`  ${b.code}: ${b.required_allocation_pct}% | Ref Rate: AED ${b.monthly_rate_aed}/month`);
    }
  }
  
  // Get ALL consultants for the project that has Kieferle
  const kieferle = await qRows(db, sql`
    SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code
    FROM cpa_project_consultants pc
    JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
    WHERE cm.code = 'KIEFERLE' OR cm.trade_name LIKE '%Kieferle%'
  `);
  console.log("\n=== Kieferle Project Consultant Records ===");
  for (const k of kieferle) {
    console.log(`  PC ID: ${k.id}, Project: ${k.cpa_project_id}`);
    console.log(`  Supervision method: ${k.supervision_fee_method}`);
    console.log(`  Supervision amount: ${k.supervision_fee_amount}`);
    console.log(`  Supervision submitted: ${k.supervision_submitted}`);
    console.log(`  Stated duration: ${k.supervision_stated_duration_months}`);
  }
  
  if (kieferle.length > 0) {
    const team = await qRows(db, sql`
      SELECT cst.supervision_role_id, sr.code, sr.label, cst.proposed_allocation_pct, cst.proposed_monthly_rate
      FROM cpa_consultant_supervision_team cst
      JOIN cpa_supervision_roles sr ON sr.id = cst.supervision_role_id
      WHERE cst.project_consultant_id = ${kieferle[0].id}
      ORDER BY sr.sort_order
    `);
    console.log(`\n=== Kieferle Supervision Team (PC ID: ${kieferle[0].id}) ===`);
    for (const t of team) {
      console.log(`  ${t.code}: allocation=${t.proposed_allocation_pct}%, rate=AED ${t.proposed_monthly_rate}/month`);
    }
    
    const proj = await qRows(db, sql`SELECT * FROM cpa_projects WHERE id = ${kieferle[0].cpa_project_id}`);
    console.log("\n=== CPA Project ===");
    for (const p of proj) {
      console.log(`  Duration: ${p.construction_duration_months} months`);
      console.log(`  Category ID: ${p.building_category_id}`);
      console.log(`  Construction Cost/sqft: ${p.construction_cost_per_sqft}`);
    }
  }
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
