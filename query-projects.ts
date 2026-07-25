import { getDb } from "./server/db";
import { projects, cfProjects, feasibilityStudies } from "./drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  console.log("=== PROJECTS ===");
  const allProjects = await db.select().from(projects);
  for (const p of allProjects) {
    console.log(JSON.stringify({
      id: p.id,
      name: p.name,
      plotNumber: p.plotNumber,
      areaCode: p.areaCode,
      bua: p.bua,
      pricePerSqft: p.pricePerSqft,
      plotAreaSqft: p.plotAreaSqft,
      gfaSqft: p.gfaSqft,
      permittedUse: p.permittedUse,
      description: p.description,
    }));
  }

  console.log("\n=== CF PROJECTS ===");
  const allCfProjects = await db.select().from(cfProjects);
  for (const cf of allCfProjects) {
    console.log(JSON.stringify(cf));
  }

  console.log("\n=== FEASIBILITY STUDIES ===");
  const allFeasibility = await db.select().from(feasibilityStudies);
  for (const f of allFeasibility) {
    console.log(JSON.stringify({
      id: f.id,
      projectName: f.projectName,
      community: f.community,
      plotNumber: f.plotNumber,
      plotArea: f.plotArea,
      totalGfa: f.totalGfa,
      estimatedBua: f.estimatedBua,
      numberOfUnits: f.numberOfUnits,
      landPrice: f.landPrice,
      constructionCostPerSqft: f.constructionCostPerSqft,
      residentialSalePrice: f.residentialSalePrice,
      retailSalePrice: f.retailSalePrice,
      officesSalePrice: f.officesSalePrice,
      gfaResidential: f.gfaResidential,
      gfaRetail: f.gfaRetail,
      gfaOffices: f.gfaOffices,
      designFeePct: f.designFeePct,
      supervisionFeePct: f.supervisionFeePct,
      developerFeePct: f.developerFeePct,
      marketingPct: f.marketingPct,
      agentCommissionSalePct: f.agentCommissionSalePct,
      comoProfitSharePct: f.comoProfitSharePct,
      scenarioName: f.scenarioName,
      projectId: f.projectId,
    }));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
