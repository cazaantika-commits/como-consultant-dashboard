import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n========================================');
console.log('  COMO DEVELOPMENTS - FULL FEASIBILITY AUDIT v2');
console.log('========================================\n');

const projectIds = [1, 2, 3, 4, 5, 6];

for (const pid of projectIds) {
  const [[proj]] = await conn.execute(
    'SELECT id, name, gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, landPrice, estimatedConstructionPricePerSqft FROM projects WHERE id = ?',
    [pid]
  );
  if (!proj) continue;

  const [moRows] = await conn.execute('SELECT * FROM marketOverview WHERE projectId = ?', [pid]);
  const [cpRows] = await conn.execute('SELECT * FROM competition_pricing WHERE projectId = ?', [pid]);

  const mo = moRows[0] || null;
  const cp = cpRows[0] || null;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PROJECT ${pid}: ${proj.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Land Price: ${Number(proj.landPrice || 0).toLocaleString()} AED`);
  console.log(`  GFA Residential: ${Number(proj.gfaResidentialSqft || 0).toLocaleString()} sqft`);
  console.log(`  GFA Retail: ${Number(proj.gfaRetailSqft || 0).toLocaleString()} sqft`);
  console.log(`  GFA Offices: ${Number(proj.gfaOfficesSqft || 0).toLocaleString()} sqft`);
  console.log(`  Construction Cost/sqft: ${proj.estimatedConstructionPricePerSqft || 'NULL'} AED`);

  if (!mo) { console.log('  ❌ NO MARKET OVERVIEW'); continue; }
  if (!cp) { console.log('  ❌ NO COMPETITION PRICING'); continue; }

  // Residential unit mix
  const resTypes = [
    { name: 'Studio', pct: Number(mo.residentialStudioPct || 0), area: Number(mo.residentialStudioAvgArea || 0), price: Number(cp.baseStudioPrice || 0) },
    { name: '1BR',    pct: Number(mo.residential1brPct || 0),    area: Number(mo.residential1brAvgArea || 0),    price: Number(cp.base1brPrice || 0) },
    { name: '2BR',    pct: Number(mo.residential2brPct || 0),    area: Number(mo.residential2brAvgArea || 0),    price: Number(cp.base2brPrice || 0) },
    { name: '3BR',    pct: Number(mo.residential3brPct || 0),    area: Number(mo.residential3brAvgArea || 0),    price: Number(cp.base3brPrice || 0) },
  ].filter(t => t.pct > 0 && t.area > 0);

  const resPctSum = resTypes.reduce((s, t) => s + t.pct, 0);
  const resWeightedAvg = resTypes.reduce((s, t) => s + (t.pct / 100) * t.area, 0);
  const gfaRes = Number(proj.gfaResidentialSqft || 0);
  const totalResUnits = resWeightedAvg > 0 ? Math.round(gfaRes / resWeightedAvg) : 0;

  let totalResRevenue = 0;
  console.log(`\n  RESIDENTIAL (pct sum=${resPctSum}%, GFA=${gfaRes.toLocaleString()} sqft, ~${totalResUnits} units):`);
  for (const t of resTypes) {
    const units = Math.round(totalResUnits * t.pct / 100);
    const rev = units * t.area * t.price;
    totalResRevenue += rev;
    console.log(`    ${t.name}: ${t.pct}% | ${t.area} sqft | ${t.price} AED/sqft | ${units} units → ${rev.toLocaleString()} AED`);
  }
  if (Math.abs(resPctSum - 100) > 0.5 && resPctSum > 0) {
    console.log(`    ❌ PCT SUM = ${resPctSum}% (NOT 100%)`);
  } else if (resPctSum > 0) {
    console.log(`    ✅ Pct sum = ${resPctSum}%`);
  }
  console.log(`    → Total Residential Revenue: ${totalResRevenue.toLocaleString()} AED`);

  // Retail unit mix
  const retailTypes = [
    { name: 'Small',  pct: Number(mo.retailSmallPct || 0),  area: Number(mo.retailSmallAvgArea || 0),  price: Number(cp.baseRetailSmallPrice || 0) },
    { name: 'Medium', pct: Number(mo.retailMediumPct || 0), area: Number(mo.retailMediumAvgArea || 0), price: Number(cp.baseRetailMediumPrice || 0) },
    { name: 'Large',  pct: Number(mo.retailLargePct || 0),  area: Number(mo.retailLargeAvgArea || 0),  price: Number(cp.baseRetailLargePrice || 0) },
  ].filter(t => t.pct > 0 && t.area > 0);

  const gfaRetail = Number(proj.gfaRetailSqft || 0);
  let totalRetailRevenue = 0;

  if (gfaRetail > 0 && retailTypes.length > 0) {
    const retailPctSum = retailTypes.reduce((s, t) => s + t.pct, 0);
    const retailWeightedAvg = retailTypes.reduce((s, t) => s + (t.pct / 100) * t.area, 0);
    const totalRetailUnits = retailWeightedAvg > 0 ? Math.round(gfaRetail / retailWeightedAvg) : 0;

    console.log(`\n  RETAIL (pct sum=${retailPctSum}%, GFA=${gfaRetail.toLocaleString()} sqft, ~${totalRetailUnits} units):`);
    for (const t of retailTypes) {
      const units = Math.round(totalRetailUnits * t.pct / 100);
      const rev = units * t.area * t.price;
      totalRetailRevenue += rev;
      console.log(`    ${t.name}: ${t.pct}% | ${t.area} sqft | ${t.price} AED/sqft | ${units} units → ${rev.toLocaleString()} AED`);
    }
    if (Math.abs(retailPctSum - 100) > 0.5) {
      console.log(`    ❌ RETAIL PCT SUM = ${retailPctSum}% (NOT 100%)`);
    } else {
      console.log(`    ✅ Retail pct sum = ${retailPctSum}%`);
    }
    console.log(`    → Total Retail Revenue: ${totalRetailRevenue.toLocaleString()} AED`);
  }

  // Office unit mix
  const officeTypes = [
    { name: 'Small',  pct: Number(mo.officeSmallPct || 0),  area: Number(mo.officeSmallAvgArea || 0),  price: Number(cp.baseOfficeSmallPrice || 0) },
    { name: 'Medium', pct: Number(mo.officeMediumPct || 0), area: Number(mo.officeMediumAvgArea || 0), price: Number(cp.baseOfficeMediumPrice || 0) },
    { name: 'Large',  pct: Number(mo.officeLargePct || 0),  area: Number(mo.officeLargeAvgArea || 0),  price: Number(cp.baseOfficeLargePrice || 0) },
  ].filter(t => t.pct > 0 && t.area > 0);

  const gfaOffice = Number(proj.gfaOfficesSqft || 0);
  let totalOfficeRevenue = 0;

  if (gfaOffice > 0 && officeTypes.length > 0) {
    const officePctSum = officeTypes.reduce((s, t) => s + t.pct, 0);
    const officeWeightedAvg = officeTypes.reduce((s, t) => s + (t.pct / 100) * t.area, 0);
    const totalOfficeUnits = officeWeightedAvg > 0 ? Math.round(gfaOffice / officeWeightedAvg) : 0;

    console.log(`\n  OFFICES (pct sum=${officePctSum}%, GFA=${gfaOffice.toLocaleString()} sqft, ~${totalOfficeUnits} units):`);
    for (const t of officeTypes) {
      const units = Math.round(totalOfficeUnits * t.pct / 100);
      const rev = units * t.area * t.price;
      totalOfficeRevenue += rev;
      console.log(`    ${t.name}: ${t.pct}% | ${t.area} sqft | ${t.price} AED/sqft | ${units} units → ${rev.toLocaleString()} AED`);
    }
    if (Math.abs(officePctSum - 100) > 0.5) {
      console.log(`    ❌ OFFICE PCT SUM = ${officePctSum}% (NOT 100%)`);
    } else {
      console.log(`    ✅ Office pct sum = ${officePctSum}%`);
    }
    console.log(`    → Total Office Revenue: ${totalOfficeRevenue.toLocaleString()} AED`);
  }

  // Summary
  const totalRevenue = totalResRevenue + totalRetailRevenue + totalOfficeRevenue;
  const totalGFA = gfaRes + gfaRetail + gfaOffice;
  const constructionCost = totalGFA * Number(proj.estimatedConstructionPricePerSqft || 0);
  const landCost = Number(proj.landPrice || 0);
  const totalCosts = constructionCost + landCost;
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue * 100).toFixed(1) : 'N/A';

  console.log(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  TOTAL REVENUE:        ${totalRevenue.toLocaleString()} AED`);
  console.log(`  Construction Cost:    ${constructionCost.toLocaleString()} AED`);
  console.log(`  Land Cost:            ${landCost.toLocaleString()} AED`);
  console.log(`  Total Costs (basic):  ${totalCosts.toLocaleString()} AED`);
  console.log(`  Gross Profit:         ${profit.toLocaleString()} AED`);
  console.log(`  Gross Margin:         ${margin}%`);
  
  if (totalRevenue === 0) {
    console.log(`  ❌ REVENUE = 0 — check unit mix and pricing data`);
  } else if (Number(margin) < 0) {
    console.log(`  ❌ NEGATIVE MARGIN — project is not viable`);
  } else if (Number(margin) < 10) {
    console.log(`  ⚠️  LOW MARGIN (< 10%)`);
  } else {
    console.log(`  ✅ Margin looks reasonable`);
  }
}

await conn.end();
console.log('\n\n========================================');
console.log('  AUDIT COMPLETE');
console.log('========================================\n');
