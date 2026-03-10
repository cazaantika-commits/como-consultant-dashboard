import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [projects] = await conn.execute('SELECT id, name, gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, manualBuaSqft, bua, landPrice, estimatedConstructionPricePerSqft FROM projects WHERE id IN (1,2,3,4,5,6) ORDER BY id');
  const [moRows] = await conn.execute('SELECT * FROM marketOverview WHERE projectId IN (1,2,3,4,5,6) ORDER BY projectId');
  const [cpRows] = await conn.execute('SELECT projectId, baseStudioPrice, base1brPrice, base2brPrice, base3brPrice, baseRetailSmallPrice, baseRetailMediumPrice, baseRetailLargePrice, baseOfficeSmallPrice, baseOfficeMediumPrice, baseOfficeLargePrice FROM competition_pricing WHERE projectId IN (1,2,3,4,5,6) ORDER BY projectId');

  const mo = {};
  moRows.forEach(r => { mo[r.projectId] = r; });
  const cp = {};
  cpRows.forEach(r => { cp[r.projectId] = r; });

  function calcType(gfa, pct, avgArea, price, saleableFactor) {
    if (!gfa || !pct || !avgArea || !price) return { units: 0, rev: 0 };
    const saleable = gfa * saleableFactor;
    const allocated = saleable * (parseFloat(pct) / 100);
    const units = Math.floor(allocated / avgArea);
    return { units, rev: units * avgArea * parseFloat(price) };
  }

  console.log('='.repeat(80));
  console.log('FINAL REVENUE AUDIT - ALL PROJECTS');
  console.log('='.repeat(80));

  for (const p of projects) {
    const m = mo[p.id];
    const c = cp[p.id];
    const gfaRes = parseFloat(p.gfaResidentialSqft) || 0;
    const gfaRet = parseFloat(p.gfaRetailSqft) || 0;
    const gfaOff = parseFloat(p.gfaOfficesSqft) || 0;
    const bua = parseFloat(p.manualBuaSqft) || parseFloat(p.bua) || 0;
    const land = parseFloat(p.landPrice) || 0;
    const constPsf = parseFloat(p.estimatedConstructionPricePerSqft) || 0;

    console.log('\nProject ' + p.id + ': ' + p.name);
    console.log('  GFA: res=' + gfaRes.toLocaleString() + ' ret=' + gfaRet.toLocaleString() + ' off=' + gfaOff.toLocaleString() + ' | BUA=' + bua.toLocaleString() + ' | Land=' + land.toLocaleString() + ' | Const=' + constPsf + '/sqft');

    if (!m || !c) {
      console.log('  MISSING DATA: mo=' + (m ? 'ok' : 'MISSING') + ' cp=' + (c ? 'ok' : 'MISSING'));
      continue;
    }

    // Residential
    const studio = calcType(gfaRes, m.residentialStudioPct, m.residentialStudioAvgArea, c.baseStudioPrice, 0.95);
    const oneBr  = calcType(gfaRes, m.residential1brPct,   m.residential1brAvgArea,   c.base1brPrice,    0.95);
    const twoBr  = calcType(gfaRes, m.residential2brPct,   m.residential2brAvgArea,   c.base2brPrice,    0.95);
    const threeBr= calcType(gfaRes, m.residential3brPct,   m.residential3brAvgArea,   c.base3brPrice,    0.95);
    const resRev = studio.rev + oneBr.rev + twoBr.rev + threeBr.rev;
    const resUnits = studio.units + oneBr.units + twoBr.units + threeBr.units;

    // Retail
    const retSm = calcType(gfaRet, m.retailSmallPct,  m.retailSmallAvgArea,  c.baseRetailSmallPrice,  0.97);
    const retMd = calcType(gfaRet, m.retailMediumPct, m.retailMediumAvgArea, c.baseRetailMediumPrice, 0.97);
    const retLg = calcType(gfaRet, m.retailLargePct,  m.retailLargeAvgArea,  c.baseRetailLargePrice,  0.97);
    const retRev = retSm.rev + retMd.rev + retLg.rev;
    const retUnits = retSm.units + retMd.units + retLg.units;

    // Offices
    const offSm = calcType(gfaOff, m.officeSmallPct,  m.officeSmallAvgArea,  c.baseOfficeSmallPrice,  0.95);
    const offMd = calcType(gfaOff, m.officeMediumPct, m.officeMediumAvgArea, c.baseOfficeMediumPrice, 0.95);
    const offLg = calcType(gfaOff, m.officeLargePct,  m.officeLargeAvgArea,  c.baseOfficeLargePrice,  0.95);
    const offRev = offSm.rev + offMd.rev + offLg.rev;
    const offUnits = offSm.units + offMd.units + offLg.units;

    const totalRev = resRev + retRev + offRev;
    const constCost = bua * constPsf;
    const grossProfit = totalRev - constCost - land;
    const margin = totalRev > 0 ? (grossProfit / totalRev * 100).toFixed(1) : 'N/A';

    if (gfaRes > 0) console.log('  Residential: ' + Math.round(resRev).toLocaleString() + ' AED | ' + resUnits + ' units (Studio:' + studio.units + ' 1BR:' + oneBr.units + ' 2BR:' + twoBr.units + ' 3BR:' + threeBr.units + ')');
    if (gfaRet > 0) console.log('  Retail: ' + Math.round(retRev).toLocaleString() + ' AED | ' + retUnits + ' units (Sm:' + retSm.units + ' Md:' + retMd.units + ' Lg:' + retLg.units + ')');
    if (gfaOff > 0) console.log('  Offices: ' + Math.round(offRev).toLocaleString() + ' AED | ' + offUnits + ' units (Sm:' + offSm.units + ' Md:' + offMd.units + ' Lg:' + offLg.units + ')');
    console.log('  TOTAL REVENUE: ' + Math.round(totalRev).toLocaleString() + ' AED');
    if (constCost) console.log('  Construction: ' + constCost.toLocaleString() + ' AED | Land: ' + land.toLocaleString() + ' AED');
    if (constCost && totalRev > 0) console.log('  Gross Profit: ' + Math.round(grossProfit).toLocaleString() + ' AED (' + margin + '%)');

    // Check pct sums
    const resPctSum = (parseFloat(m.residentialStudioPct) || 0) + (parseFloat(m.residential1brPct) || 0) + (parseFloat(m.residential2brPct) || 0) + (parseFloat(m.residential3brPct) || 0);
    const retPctSum = (parseFloat(m.retailSmallPct) || 0) + (parseFloat(m.retailMediumPct) || 0) + (parseFloat(m.retailLargePct) || 0);
    const offPctSum = (parseFloat(m.officeSmallPct) || 0) + (parseFloat(m.officeMediumPct) || 0) + (parseFloat(m.officeLargePct) || 0);

    const issues = [];
    if (gfaRes > 0 && Math.abs(resPctSum - 100) > 0.5) issues.push('Res pct sum = ' + resPctSum);
    if (gfaRet > 0 && Math.abs(retPctSum - 100) > 0.5) issues.push('Retail pct sum = ' + retPctSum);
    if (gfaOff > 0 && Math.abs(offPctSum - 100) > 0.5) issues.push('Office pct sum = ' + offPctSum);
    if (!constPsf && bua > 0) issues.push('No construction cost per sqft');
    if (totalRev > 0 && constCost && parseFloat(margin) < 15) issues.push('Low margin: ' + margin + '%');
    if (totalRev > 0 && constCost && parseFloat(margin) < 0) issues.push('NEGATIVE MARGIN: ' + margin + '%');

    if (issues.length > 0) {
      console.log('  ISSUES: ' + issues.join('; '));
    } else if (totalRev > 0) {
      console.log('  STATUS: OK');
    } else {
      console.log('  STATUS: No revenue (missing data)');
    }
  }

  await conn.end();
}
main().catch(console.error);
