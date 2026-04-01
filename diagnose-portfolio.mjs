/**
 * Diagnostic script: compare getCostSettingsComparison vs getPortfolioAllScenarios
 * for ند الشبا قطعة 2 (projectId to be found from DB)
 * Run: node diagnose-portfolio.mjs
 */
import { createRequire } from 'module';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL);

// 1. Find ند الشبا قطعة 2
const [projects] = await conn.query(`SELECT id, name, preConMonths, constructionMonths, handoverMonths FROM projects WHERE name LIKE '%6182776%' LIMIT 10`);
console.log('Projects found:');
projects.forEach(p => console.log(`  id=${p.id} name=${p.name} preCon=${p.preConMonths} constr=${p.constructionMonths} handover=${p.handoverMonths}`));

if (projects.length === 0) {
  // Try all projects
  const [all] = await conn.query(`SELECT id, name FROM projects LIMIT 20`);
  console.log('All projects:');
  all.forEach(p => console.log(`  id=${p.id} name=${p.name}`));
  await conn.end();
  process.exit(0);
}

const project = projects[0];
const projectId = project.id;
console.log(`\nUsing project: id=${projectId} name=${project.name}`);

// 2. Get saved settings for O1 (offplan_escrow)
const [savedSettings] = await conn.query(
  `SELECT item_key as itemKey, distribution_method as distributionMethod, lump_sum_month as lumpSumMonth, start_month as startMonth, end_month as endMonth, amount_override as amountOverride, funding_source as fundingSource, section, is_active as isActive FROM project_cash_flow_settings WHERE project_id=? AND scenario='offplan_escrow'`,
  [projectId]
);

console.log(`\nSaved settings for O1 (offplan_escrow): ${savedSettings.length} items`);
savedSettings.forEach(s => {
  if (!s.isActive) return;
  console.log(`  ${s.itemKey}: method=${s.distributionMethod} lump=${s.lumpSumMonth} start=${s.startMonth} end=${s.endMonth} amount=${s.amountOverride || '(computed)'} source=${s.fundingSource} section=${s.section}`);
});

// 3. Calculate totalMonths
const design = 2;
const offplan = 4;
const construction = project.constructionMonths || 16;
const handover = project.handoverMonths || 2;
const totalMonths = design + offplan + construction + handover;
console.log(`\ntotalMonths = ${totalMonths} (design=${design} offplan=${offplan} construction=${construction} handover=${handover})`);

// 4. Show what month 1 of construction is (absolute)
const constructionStartMonth = design + offplan + 1; // month 7 for 2+4
console.log(`Construction starts at absolute month: ${constructionStartMonth}`);

// 5. For each active saved item, show what amount goes into construction month 1
console.log(`\nItems contributing to month ${constructionStartMonth} (construction month 1):`);
let totalAtConstructionMonth1 = 0;
for (const s of savedSettings) {
  if (!s.isActive) continue;
  const amount = s.amountOverride ? parseFloat(s.amountOverride) : null;
  if (s.distributionMethod === 'lump_sum' && s.lumpSumMonth === constructionStartMonth) {
    console.log(`  LUMP_SUM: ${s.itemKey} amount=${amount} at month ${s.lumpSumMonth}`);
    if (amount) totalAtConstructionMonth1 += amount;
  } else if (s.distributionMethod === 'equal_spread' && s.startMonth <= constructionStartMonth && s.endMonth >= constructionStartMonth) {
    const months = s.endMonth - s.startMonth + 1;
    const monthly = amount ? amount / months : 0;
    console.log(`  EQUAL_SPREAD: ${s.itemKey} amount=${amount} spread over months ${s.startMonth}-${s.endMonth} (${months} months) => monthly=${monthly.toFixed(0)}`);
    totalAtConstructionMonth1 += monthly;
  }
}
console.log(`\nTotal at construction month 1 (month ${constructionStartMonth}): ${totalAtConstructionMonth1.toFixed(0)}`);
console.log(`Expected from O1 page: 7,585,854`);
console.log(`Shown in portfolio: 10.55M`);

await conn.end();
