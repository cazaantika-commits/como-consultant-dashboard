import { getDb } from './server/db';
import { projects, waelSalesPlans } from './drizzle/schema';

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB connection"); process.exit(1); }
  
  // Check projects
  const allProjects = await db.select({
    id: projects.id,
    name: projects.name,
    marketingPrepMonths: projects.marketingPrepMonths,
    reraLeadMonths: projects.reraLeadMonths,
    preConMonths: projects.preConMonths,
    constructionMonths: projects.constructionMonths,
    startDate: projects.startDate,
    marketingPct: projects.marketingPct,
    salesCommissionPct: projects.salesCommissionPct,
  }).from(projects);
  
  console.log("=== PROJECTS TABLE ===");
  console.table(allProjects);
  
  // Check plans for stored marketingPrepLead in salesAbsorptionJson
  const plans = await db.select({
    id: waelSalesPlans.id,
    projectId: waelSalesPlans.projectId,
    salesAbsorptionJson: waelSalesPlans.salesAbsorptionJson,
    marketingBudgetPct: waelSalesPlans.marketingBudgetPct,
    salesCommissionPct: waelSalesPlans.salesCommissionPct,
  }).from(waelSalesPlans);
  
  console.log("\n=== PLANS - salesAbsorptionJson values ===");
  for (const p of plans) {
    if (p.salesAbsorptionJson) {
      try {
        const parsed = JSON.parse(p.salesAbsorptionJson);
        console.log(`Plan ${p.id} (project ${p.projectId}): marketingPrepLead=${parsed.marketingPrepLead}, reraLead=${parsed.reraLead}, marketingBudgetPct=${p.marketingBudgetPct}, salesCommissionPct=${p.salesCommissionPct}`);
      } catch {}
    }
  }
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
