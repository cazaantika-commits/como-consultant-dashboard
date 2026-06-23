/**
 * DEFINITIVE FEASIBILITY AUDIT
 * Replicates the exact calculation logic from CostsCashFlowTab.tsx
 * 
 * Key formulas:
 * - saleableRes = GFA_residential * 0.95
 * - saleableRet = GFA_retail * 0.97
 * - saleableOff = GFA_offices * 0.95
 * - allocated = saleable * (pct/100)
 * - units = Math.floor(allocated / avgArea)
 * - revenue = avgArea * pricePerSqft * units
 * - constructionCost = BUA * constructionCostPerSqft
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Default avg areas (from CostsCashFlowTab DEFAULT_AVG_AREAS)
const DEFAULT_AVG_AREAS = {
  residentialStudioPct: 450,
  residential1brPct: 750,
  residential2brPct: 1100,
  residential3brPct: 1600,
  retailSmallPct: 300,
  retailMediumPct: 600,
  retailLargePct: 1200,
  officeSmallPct: 500,
  officeMediumPct: 1500,
  officeLargePct: 3000,
};

function getAvg(pctKey, storedVal) {
  const v = storedVal || 0;
  if (v > 0) return v;
  return DEFAULT_AVG_AREAS[pctKey] || 0;
}

function calcTypeRevenue(pct, avgArea, pricePerSqft, saleable) {
  const allocated = saleable * (pct / 100);
  const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
  return { revenue: avgArea * pricePerSqft * units, units };
}

const projectIds = [1, 2, 3, 4, 5, 6];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     COMO DEVELOPMENTS - DEFINITIVE FEASIBILITY AUDIT    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const auditResults = [];

for (const pid of projectIds) {
  const [[proj]] = await conn.execute(
    `SELECT * FROM projects WHERE id = ?`, [pid]
  );
  if (!proj) continue;

  const [moRows] = await conn.execute('SELECT * FROM marketOverview WHERE projectId = ?', [pid]);
  const [cpRows] = await conn.execute('SELECT * FROM competition_pricing WHERE projectId = ?', [pid]);

  const mo = moRows[0] || null;
  const cp = cpRows[0] || null;

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  PROJECT ${pid}: ${proj.name}`);
  console.log(`${'═'.repeat(62)}`);

  const issues = [];
  const warnings = [];

  // --- Project Card Data ---
  const landPrice = parseFloat(proj.landPrice || '0');
  const bua = parseFloat(proj.manualBuaSqft || '0');
  const constructionCostPerSqft = parseFloat(proj.estimatedConstructionPricePerSqft || '0');
  const gfaRes = parseFloat(proj.gfaResidentialSqft || '0');
  const gfaRet = parseFloat(proj.gfaRetailSqft || '0');
  const gfaOff = parseFloat(proj.gfaOfficesSqft || '0');
  const plotAreaSqft = parseFloat(proj.plotAreaSqft || '0');
  const plotAreaM2 = plotAreaSqft * 0.0929;

  console.log(`  Land Price:          ${landPrice.toLocaleString()} AED`);
  console.log(`  BUA (for costs):     ${bua > 0 ? bua.toLocaleString() + ' sqft' : '❌ NULL'}`);
  console.log(`  GFA Residential:     ${gfaRes.toLocaleString()} sqft`);
  console.log(`  GFA Retail:          ${gfaRet.toLocaleString()} sqft`);
  console.log(`  GFA Offices:         ${gfaOff.toLocaleString()} sqft`);
  console.log(`  Construction/sqft:   ${constructionCostPerSqft > 0 ? constructionCostPerSqft + ' AED' : '❌ NULL'}`);

  if (!bua) issues.push('BUA (manualBuaSqft) is NULL — construction cost will be 0');
  if (!constructionCostPerSqft) issues.push('Construction cost/sqft is NULL');
  if (!mo) issues.push('No marketOverview data');
  if (!cp) issues.push('No competition_pricing data');

  if (!mo || !cp) {
    issues.forEach(i => console.log(`  ❌ ${i}`));
    auditResults.push({ pid, name: proj.name, issues, revenue: 0, totalCosts: 0, profit: 0, margin: 'N/A' });
    continue;
  }

  // --- Revenue Calculation (exact replica of UI logic) ---
  const saleableRes = gfaRes * 0.95;
  const saleableRet = gfaRet * 0.97;
  const saleableOff = gfaOff * 0.95;

  const activeScenario = cp.activeScenario || 'base';
  const prices = {
    studioPrice: parseFloat(cp.baseStudioPrice || '0'),
    oneBrPrice: parseFloat(cp.base1brPrice || '0'),
    twoBrPrice: parseFloat(cp.base2brPrice || '0'),
    threeBrPrice: parseFloat(cp.base3brPrice || '0'),
    retailSmallPrice: parseFloat(cp.baseRetailSmallPrice || '0'),
    retailMediumPrice: parseFloat(cp.baseRetailMediumPrice || '0'),
    retailLargePrice: parseFloat(cp.baseRetailLargePrice || '0'),
    officeSmallPrice: parseFloat(cp.baseOfficeSmallPrice || '0'),
    officeMediumPrice: parseFloat(cp.baseOfficeMediumPrice || '0'),
    officeLargePrice: parseFloat(cp.baseOfficeLargePrice || '0'),
  };

  // Residential
  const resPctSum = (parseFloat(mo.residentialStudioPct||0)) + (parseFloat(mo.residential1brPct||0)) + (parseFloat(mo.residential2brPct||0)) + (parseFloat(mo.residential3brPct||0));
  
  const resCalcs = [
    { name: 'Studio', pct: parseFloat(mo.residentialStudioPct||0), avgArea: getAvg('residentialStudioPct', mo.residentialStudioAvgArea), price: prices.studioPrice },
    { name: '1BR',    pct: parseFloat(mo.residential1brPct||0),    avgArea: getAvg('residential1brPct', mo.residential1brAvgArea),    price: prices.oneBrPrice },
    { name: '2BR',    pct: parseFloat(mo.residential2brPct||0),    avgArea: getAvg('residential2brPct', mo.residential2brAvgArea),    price: prices.twoBrPrice },
    { name: '3BR',    pct: parseFloat(mo.residential3brPct||0),    avgArea: getAvg('residential3brPct', mo.residential3brAvgArea),    price: prices.threeBrPrice },
  ].filter(t => t.pct > 0);

  let totalResRevenue = 0;
  let totalResUnits = 0;

  if (gfaRes > 0) {
    console.log(`\n  RESIDENTIAL (saleable=${saleableRes.toLocaleString()} sqft, pct sum=${resPctSum}%):`);
    for (const t of resCalcs) {
      const { revenue, units } = calcTypeRevenue(t.pct, t.avgArea, t.price, saleableRes);
      totalResRevenue += revenue;
      totalResUnits += units;
      console.log(`    ${t.name}: ${t.pct}% | ${t.avgArea} sqft | ${t.price} AED/sqft | ${units} units → ${revenue.toLocaleString()} AED`);
    }
    if (Math.abs(resPctSum - 100) > 0.5 && resPctSum > 0) {
      issues.push(`Residential pct sum = ${resPctSum}% (not 100%)`);
      console.log(`    ❌ PCT SUM = ${resPctSum}% (NOT 100%)`);
    }
    console.log(`    → Residential Revenue: ${totalResRevenue.toLocaleString()} AED (${totalResUnits} units)`);
  }

  // Retail
  const retailPctSum = (parseFloat(mo.retailSmallPct||0)) + (parseFloat(mo.retailMediumPct||0)) + (parseFloat(mo.retailLargePct||0));
  
  const retCalcs = [
    { name: 'Small',  pct: parseFloat(mo.retailSmallPct||0),  avgArea: getAvg('retailSmallPct', mo.retailSmallAvgArea),  price: prices.retailSmallPrice },
    { name: 'Medium', pct: parseFloat(mo.retailMediumPct||0), avgArea: getAvg('retailMediumPct', mo.retailMediumAvgArea), price: prices.retailMediumPrice },
    { name: 'Large',  pct: parseFloat(mo.retailLargePct||0),  avgArea: getAvg('retailLargePct', mo.retailLargeAvgArea),  price: prices.retailLargePrice },
  ].filter(t => t.pct > 0);

  let totalRetRevenue = 0;
  let totalRetUnits = 0;

  if (gfaRet > 0 && retCalcs.length > 0) {
    console.log(`\n  RETAIL (saleable=${saleableRet.toLocaleString()} sqft, pct sum=${retailPctSum}%):`);
    for (const t of retCalcs) {
      const { revenue, units } = calcTypeRevenue(t.pct, t.avgArea, t.price, saleableRet);
      totalRetRevenue += revenue;
      totalRetUnits += units;
      console.log(`    ${t.name}: ${t.pct}% | ${t.avgArea} sqft | ${t.price} AED/sqft | ${units} units → ${revenue.toLocaleString()} AED`);
    }
    if (Math.abs(retailPctSum - 100) > 0.5) {
      issues.push(`Retail pct sum = ${retailPctSum}% (not 100%)`);
      console.log(`    ❌ RETAIL PCT SUM = ${retailPctSum}% (NOT 100%)`);
    }
    console.log(`    → Retail Revenue: ${totalRetRevenue.toLocaleString()} AED (${totalRetUnits} units)`);
  }

  // Offices
  const officePctSum = (parseFloat(mo.officeSmallPct||0)) + (parseFloat(mo.officeMediumPct||0)) + (parseFloat(mo.officeLargePct||0));
  
  const offCalcs = [
    { name: 'Small',  pct: parseFloat(mo.officeSmallPct||0),  avgArea: getAvg('officeSmallPct', mo.officeSmallAvgArea),  price: prices.officeSmallPrice },
    { name: 'Medium', pct: parseFloat(mo.officeMediumPct||0), avgArea: getAvg('officeMediumPct', mo.officeMediumAvgArea), price: prices.officeMediumPrice },
    { name: 'Large',  pct: parseFloat(mo.officeLargePct||0),  avgArea: getAvg('officeLargePct', mo.officeLargeAvgArea),  price: prices.officeLargePrice },
  ].filter(t => t.pct > 0);

  let totalOffRevenue = 0;
  let totalOffUnits = 0;

  if (gfaOff > 0 && offCalcs.length > 0) {
    console.log(`\n  OFFICES (saleable=${saleableOff.toLocaleString()} sqft, pct sum=${officePctSum}%):`);
    for (const t of offCalcs) {
      const { revenue, units } = calcTypeRevenue(t.pct, t.avgArea, t.price, saleableOff);
      totalOffRevenue += revenue;
      totalOffUnits += units;
      console.log(`    ${t.name}: ${t.pct}% | ${t.avgArea} sqft | ${t.price} AED/sqft | ${units} units → ${revenue.toLocaleString()} AED`);
    }
    if (Math.abs(officePctSum - 100) > 0.5 && officePctSum > 0) {
      issues.push(`Office pct sum = ${officePctSum}% (not 100%)`);
      console.log(`    ❌ OFFICE PCT SUM = ${officePctSum}% (NOT 100%)`);
    }
    console.log(`    → Office Revenue: ${totalOffRevenue.toLocaleString()} AED (${totalOffUnits} units)`);
  }

  const totalRevenue = totalResRevenue + totalRetRevenue + totalOffRevenue;
  const totalUnits = totalResUnits + totalRetUnits + totalOffUnits;

  // --- Cost Calculation (exact replica of UI logic) ---
  const agentCommissionLand = landPrice * (parseFloat(proj.agentCommissionLandPct || '0') / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * constructionCostPerSqft;
  const designFee = constructionCost * (parseFloat(proj.designFeePct ?? '2') / 100);
  const supervisionFee = constructionCost * (parseFloat(proj.supervisionFeePct ?? '2') / 100);
  const separationFee = plotAreaM2 * parseFloat(proj.separationFeePerM2 ?? '40');
  const contingencies = constructionCost * 0.02;
  const salesCommission = totalRevenue * (parseFloat(proj.salesCommissionPct ?? '5') / 100);
  const marketing = totalRevenue * (parseFloat(proj.marketingPct ?? '2') / 100);
  const developerFee = totalRevenue * (parseFloat(proj.developerFeePct ?? '5') / 100);
  const soilTestFee = parseFloat(proj.soilTestFee || '0');
  const topographicSurveyFee = parseFloat(proj.topographicSurveyFee || '0');
  const officialBodiesFees = parseFloat(proj.officialBodiesFees || '0');
  const reraUnitRegFee = parseFloat(proj.reraUnitRegFee || '0');
  const reraProjectRegFee = parseFloat(proj.reraProjectRegFee || '0');
  const developerNocFee = parseFloat(proj.developerNocFee || '0');
  const escrowAccountFee = parseFloat(proj.escrowAccountFee || '0');
  const bankFees = parseFloat(proj.bankFees || '0');
  const communityFees = parseFloat(proj.communityFees || '0');
  const surveyorFees = parseFloat(proj.surveyorFees || '0');
  const reraAuditReportFee = parseFloat(proj.reraAuditReportFee || '0');
  const reraInspectionReportFee = parseFloat(proj.reraInspectionReportFee || '0');

  const totalCosts = landPrice + agentCommissionLand + landRegistration +
    constructionCost + designFee + supervisionFee + separationFee + contingencies +
    salesCommission + marketing + developerFee +
    soilTestFee + topographicSurveyFee + officialBodiesFees +
    reraUnitRegFee + reraProjectRegFee + developerNocFee +
    escrowAccountFee + bankFees + communityFees +
    surveyorFees + reraAuditReportFee + reraInspectionReportFee;

  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue * 100).toFixed(1) : 'N/A';
  const roi = totalCosts > 0 ? (profit / totalCosts * 100).toFixed(1) : 'N/A';

  console.log(`\n  COST BREAKDOWN:`);
  console.log(`    Land:                ${landPrice.toLocaleString()} AED`);
  console.log(`    Agent comm (land):   ${agentCommissionLand.toLocaleString()} AED`);
  console.log(`    Land registration:   ${landRegistration.toLocaleString()} AED`);
  console.log(`    Construction (BUA×rate): ${constructionCost.toLocaleString()} AED  [${bua.toLocaleString()} × ${constructionCostPerSqft}]`);
  console.log(`    Design fee:          ${designFee.toLocaleString()} AED`);
  console.log(`    Supervision fee:     ${supervisionFee.toLocaleString()} AED`);
  console.log(`    Separation fee:      ${separationFee.toLocaleString()} AED`);
  console.log(`    Contingencies (2%):  ${contingencies.toLocaleString()} AED`);
  console.log(`    Sales commission:    ${salesCommission.toLocaleString()} AED`);
  console.log(`    Marketing:           ${marketing.toLocaleString()} AED`);
  console.log(`    Developer fee:       ${developerFee.toLocaleString()} AED`);
  const fixedFees = soilTestFee + topographicSurveyFee + officialBodiesFees + reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + communityFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;
  console.log(`    Fixed fees:          ${fixedFees.toLocaleString()} AED`);

  console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
  console.log(`  │  TOTAL REVENUE:   ${totalRevenue.toLocaleString().padStart(20)} AED  (${totalUnits} units) │`);
  console.log(`  │  TOTAL COSTS:     ${totalCosts.toLocaleString().padStart(20)} AED              │`);
  console.log(`  │  NET PROFIT:      ${profit.toLocaleString().padStart(20)} AED              │`);
  console.log(`  │  MARGIN:          ${(margin + '%').padStart(20)}                   │`);
  console.log(`  │  ROI:             ${(roi + '%').padStart(20)}                   │`);
  console.log(`  └─────────────────────────────────────────────────────┘`);

  if (issues.length > 0) {
    console.log(`\n  ❌ ISSUES FOUND:`);
    issues.forEach(i => console.log(`     • ${i}`));
  }
  if (warnings.length > 0) {
    console.log(`\n  ⚠️  WARNINGS:`);
    warnings.forEach(w => console.log(`     • ${w}`));
  }
  if (issues.length === 0 && totalRevenue > 0) {
    console.log(`\n  ✅ All data complete and calculations verified`);
  }

  auditResults.push({ pid, name: proj.name, issues, revenue: totalRevenue, totalCosts, profit, margin, roi, totalUnits });
}

// Summary table
console.log('\n\n╔══════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                           AUDIT SUMMARY TABLE                                  ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
console.log('║  #  │ Project                          │ Revenue AED    │ Profit AED    │ Margin ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');

for (const r of auditResults) {
  const name = r.name.substring(0, 30).padEnd(30);
  const rev = r.revenue > 0 ? r.revenue.toLocaleString().padStart(14) : '         N/A  ';
  const prof = r.profit !== 0 ? r.profit.toLocaleString().padStart(13) : '        N/A  ';
  const mar = (r.margin + '%').padStart(6);
  const status = r.issues.length > 0 ? '❌' : '✅';
  console.log(`║  ${r.pid}  │ ${name} │ ${rev} │ ${prof} │ ${mar} ${status} ║`);
}
console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');

// Issues summary
const projectsWithIssues = auditResults.filter(r => r.issues.length > 0);
if (projectsWithIssues.length > 0) {
  console.log('\n❌ PROJECTS REQUIRING ATTENTION:');
  for (const r of projectsWithIssues) {
    console.log(`\n  Project ${r.pid} (${r.name}):`);
    r.issues.forEach(i => console.log(`    • ${i}`));
  }
} else {
  console.log('\n✅ ALL PROJECTS PASSED AUDIT');
}

await conn.end();
console.log('\n════════════════════════════════════════════════════════════\n');
