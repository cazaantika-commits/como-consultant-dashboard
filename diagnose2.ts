/**
 * Diagnostic: run getCostSettingsComparison logic for ند الشبا قطعة 2
 * and print month 7 (construction month 1) totals
 * Run: npx tsx diagnose2.ts
 */
import { getDb } from "./server/_core/db";
import { projects, marketOverview, competitionPricing, projectCashFlowSettings } from "./drizzle/schema";
import { eq, and } from "drizzle-orm";
import { calculateProjectCosts } from "./server/cashFlowProgram";
import { distributeAmount, computeItemAmountByKey, computeItemAmount, getDefaultItemDefs, phaseRelativeToAbsolute, getPhaseRange, calculatePhases, legacyToNewDurations, getTotalMonths } from "./server/routers/cashFlowSettings";

const db = await getDb();
if (!db) { console.error("No DB"); process.exit(1); }

// Find ند الشبا قطعة 2
const projectRows = await db.select().from(projects).where(eq(projects.id, 5));
const project = projectRows[0];
if (!project) { console.error("Project not found"); process.exit(1); }
console.log(`Project: ${project.name}`);

const moRows = await db.select().from(marketOverview).where(eq(marketOverview.projectId, project.id));
const cpRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, project.id));
const mo = moRows[0] || null;
const cp = cpRows[0] || null;

const costs = calculateProjectCosts(project, mo, cp);
console.log("\ncosts object keys:", costs ? Object.keys(costs) : "null");
if (costs) {
  console.log("contractor_cost:", (costs as any).contractorCost || (costs as any).contractor_cost || "N/A");
  console.log("totalCosts:", (costs as any).totalCosts);
}

const legacyDurations = {
  preCon: project.preConMonths || 6,
  construction: project.constructionMonths || 16,
  handover: project.handoverMonths || 2,
};
const durations = legacyToNewDurations(legacyDurations);
const totalMonths = getTotalMonths(durations);
const phases = calculatePhases(durations, 0, "offplan_escrow");
console.log("\nPhases:", phases.map(p => `${p.type}: ${p.startMonth}-${p.endMonth}`));
console.log("totalMonths:", totalMonths);

// Get saved settings for O1
const savedSettings = await db.select().from(projectCashFlowSettings).where(
  and(eq(projectCashFlowSettings.projectId, project.id), eq(projectCashFlowSettings.scenario, "offplan_escrow"))
);
console.log(`\nSaved settings: ${savedSettings.length}`);

// Compute month 7 total (construction month 1)
const targetMonth = 7;
let totalAtMonth7 = 0;
console.log(`\nItems at month ${targetMonth}:`);

for (const s of savedSettings) {
  if (!s.isActive) continue;
  const amount = s.amountOverride ? parseFloat(s.amountOverride) : (costs ? computeItemAmountByKey(s.itemKey, costs, "offplan_escrow") : 0);
  const monthly = distributeAmount(amount, s.distributionMethod as any, s.lumpSumMonth, s.startMonth, s.endMonth, s.customJson, totalMonths);
  const atMonth7 = monthly[targetMonth - 1] || 0;
  if (atMonth7 > 0) {
    console.log(`  ${s.itemKey}: amount=${amount.toFixed(0)} monthly[${targetMonth}]=${atMonth7.toFixed(0)}`);
    totalAtMonth7 += atMonth7;
  }
}
console.log(`\nTotal at month ${targetMonth}: ${totalAtMonth7.toFixed(0)}`);
console.log(`Expected (O1 page): 7,585,854`);
console.log(`Shown in portfolio: 10,550,000 approx`);

process.exit(0);
