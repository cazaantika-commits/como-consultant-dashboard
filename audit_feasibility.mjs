import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get actual project data from DB - using correct column names
  const [projects_db] = await conn.execute(`
    SELECT id, name, 
      gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, 
      bua, manualBuaSqft, landPrice, estimatedConstructionPricePerSqft,
      plotAreaSqft, gfaSqft
    FROM projects 
    WHERE id IN (1,2,3,4,5,6)
    ORDER BY id
  `);
  
  console.log('='.repeat(80));
  console.log('DATABASE PROJECTS (key fields):');
  projects_db.forEach(p => {
    console.log('Project ' + p.id + ': ' + p.name);
    console.log('  gfaRes=' + p.gfaResidentialSqft + ' gfaRetail=' + p.gfaRetailSqft + ' gfaOffices=' + p.gfaOfficesSqft);
    console.log('  bua=' + p.bua + ' manualBua=' + p.manualBuaSqft + ' landPrice=' + p.landPrice + ' constPerSqft=' + p.estimatedConstructionPricePerSqft);
    console.log('  plotArea=' + p.plotAreaSqft + ' gfaSqft=' + p.gfaSqft);
  });
  console.log('='.repeat(80));

  // Get market overview data
  const [mo_rows] = await conn.execute(`
    SELECT projectId, 
      residentialStudioPct, residential1brPct, residential2brPct, residential3brPct,
      residentialStudioAvgArea, residential1brAvgArea, residential2brAvgArea, residential3brAvgArea,
      retailSmallPct, retailMediumPct, retailLargePct,
      officeSmallPct, officeMediumPct, officeLargePct
    FROM marketOverview 
    WHERE projectId IN (1,2,3,4,5,6)
    ORDER BY projectId
  `);

  // Get competition pricing
  const [cp_rows] = await conn.execute(`
    SELECT projectId, activeScenario,
      baseStudioPrice, base1brPrice, base2brPrice, base3brPrice,
      baseRetailSmallPrice, baseRetailMediumPrice, baseRetailLargePrice,
      baseOfficeSmallPrice, baseOfficeMediumPrice, baseOfficeLargePrice
    FROM competition_pricing 
    WHERE projectId IN (1,2,3,4,5,6)
    ORDER BY projectId
  `);

  // Get feasibility studies
  const [fs_rows] = await conn.execute(`
    SELECT * FROM feasibilityStudies 
    WHERE projectId IN (1,2,3,4,5,6)
    ORDER BY projectId
  `);

  // Build lookup maps
  const mo = {};
  mo_rows.forEach(r => { mo[r.projectId] = r; });
  
  const cp = {};
  cp_rows.forEach(r => { cp[r.projectId] = r; });

  const fs = {};
  fs_rows.forEach(r => { fs[r.projectId] = r; });

  const RETAIL_SM_AREA = 300;
  const RETAIL_MD_AREA = 600;
  const RETAIL_LG_AREA = 1200;
  const OFF_SM_AREA = 300;
  const OFF_MD_AREA = 600;
  const OFF_LG_AREA = 1200;

  function calcRes(gfa, pct, avgArea, price) {
    if (!gfa || !pct || !avgArea || !price) return { units: 0, revenue: 0 };
    const saleable = gfa * 0.95;
    const allocated = saleable * (parseFloat(pct) / 100);
    const units = Math.floor(allocated / avgArea);
    return { units, revenue: units * avgArea * parseFloat(price) };
  }

  function calcRetail(gfa, pct, avgArea, price) {
    if (!gfa || !pct || !avgArea || !price) return { units: 0, revenue: 0 };
    const saleable = gfa * 0.97;
    const allocated = saleable * (parseFloat(pct) / 100);
    const units = Math.floor(allocated / avgArea);
    return { units, revenue: units * avgArea * parseFloat(price) };
  }

  console.log('\n' + '='.repeat(80));
  console.log('FULL FEASIBILITY AUDIT - ALL PROJECTS');
  console.log('='.repeat(80));

  for (const p of projects_db) {
    const m = mo[p.id];
    const c = cp[p.id];
    const f = fs[p.id];

    const gfaRes = parseFloat(p.gfaResidentialSqft) || 0;
    const gfaRetail = parseFloat(p.gfaRetailSqft) || 0;
    const gfaOffices = parseFloat(p.gfaOfficesSqft) || 0;
    const bua = parseFloat(p.manualBuaSqft) || parseFloat(p.bua) || 0;
    const landPrice = parseFloat(p.landPrice) || 0;
    const constPerSqft = parseFloat(p.estimatedConstructionPricePerSqft) || 0;

    console.log('\n--- PROJECT ' + p.id + ': ' + p.name + ' ---');
    console.log('  GFA Res: ' + gfaRes.toLocaleString() + ' sqft | GFA Retail: ' + gfaRetail.toLocaleString() + ' sqft | GFA Offices: ' + gfaOffices.toLocaleString() + ' sqft');
    console.log('  BUA: ' + bua.toLocaleString() + ' sqft | Land: ' + landPrice.toLocaleString() + ' AED | Const/sqft: ' + constPerSqft + ' AED');

    const issues = [];

    if (!m) issues.push('NO MARKET OVERVIEW DATA');
    if (!c) issues.push('NO COMPETITION PRICING DATA');
    if (!bua && constPerSqft) issues.push('BUA IS NULL/ZERO - construction cost cannot be calculated');
    if (!constPerSqft && bua) issues.push('Construction price/sqft is NULL/ZERO');
    if (!gfaRes && !gfaRetail && !gfaOffices) issues.push('ALL GFA VALUES ARE ZERO - no revenue possible');

    if (m) {
      const resPctSum = (parseFloat(m.residentialStudioPct)||0) + (parseFloat(m.residential1brPct)||0) + (parseFloat(m.residential2brPct)||0) + (parseFloat(m.residential3brPct)||0);
      if (Math.abs(resPctSum - 100) > 0.5 && gfaRes > 0) issues.push('Residential pct sum = ' + resPctSum.toFixed(2) + '% (should be 100%)');
      else if (gfaRes > 0) console.log('  Res unit mix: Studio=' + parseFloat(m.residentialStudioPct).toFixed(0) + '% 1BR=' + parseFloat(m.residential1brPct).toFixed(0) + '% 2BR=' + parseFloat(m.residential2brPct).toFixed(0) + '% 3BR=' + parseFloat(m.residential3brPct).toFixed(0) + '% (sum=' + resPctSum.toFixed(0) + '%)');

      const retailPctSum = (parseFloat(m.retailSmallPct)||0) + (parseFloat(m.retailMediumPct)||0) + (parseFloat(m.retailLargePct)||0);
      if (Math.abs(retailPctSum - 100) > 0.5 && gfaRetail > 0) issues.push('Retail pct sum = ' + retailPctSum.toFixed(2) + '% (should be 100%)');

      const offPctSum = (parseFloat(m.officeSmallPct)||0) + (parseFloat(m.officeMediumPct)||0) + (parseFloat(m.officeLargePct)||0);
      if (Math.abs(offPctSum - 100) > 0.5 && gfaOffices > 0) issues.push('Office pct sum = ' + offPctSum.toFixed(2) + '% (should be 100%)');
    }

    let totalRevenue = 0;

    if (m && c && gfaRes > 0) {
      const studio = calcRes(gfaRes, m.residentialStudioPct, m.residentialStudioAvgArea, c.baseStudioPrice);
      const oneBr  = calcRes(gfaRes, m.residential1brPct,   m.residential1brAvgArea,   c.base1brPrice);
      const twoBr  = calcRes(gfaRes, m.residential2brPct,   m.residential2brAvgArea,   c.base2brPrice);
      const threeBr= calcRes(gfaRes, m.residential3brPct,   m.residential3brAvgArea,   c.base3brPrice);
      const resRev = studio.revenue + oneBr.revenue + twoBr.revenue + threeBr.revenue;
      const resUnits = studio.units + oneBr.units + twoBr.units + threeBr.units;
      totalRevenue += resRev;
      console.log('  Residential Revenue: ' + Math.round(resRev).toLocaleString() + ' AED | ' + resUnits + ' units (Studio:' + studio.units + ' 1BR:' + oneBr.units + ' 2BR:' + twoBr.units + ' 3BR:' + threeBr.units + ')');
    }

    if (m && c && gfaRetail > 0) {
      const sm = calcRetail(gfaRetail, m.retailSmallPct,  RETAIL_SM_AREA, c.baseRetailSmallPrice);
      const md = calcRetail(gfaRetail, m.retailMediumPct, RETAIL_MD_AREA, c.baseRetailMediumPrice);
      const lg = calcRetail(gfaRetail, m.retailLargePct,  RETAIL_LG_AREA, c.baseRetailLargePrice);
      const retailRev = sm.revenue + md.revenue + lg.revenue;
      totalRevenue += retailRev;
      console.log('  Retail Revenue: ' + Math.round(retailRev).toLocaleString() + ' AED | ' + (sm.units+md.units+lg.units) + ' units');
    }

    if (m && c && gfaOffices > 0) {
      const sm = calcRes(gfaOffices, m.officeSmallPct,  OFF_SM_AREA, c.baseOfficeSmallPrice);
      const md = calcRes(gfaOffices, m.officeMediumPct, OFF_MD_AREA, c.baseOfficeMediumPrice);
      const lg = calcRes(gfaOffices, m.officeLargePct,  OFF_LG_AREA, c.baseOfficeLargePrice);
      const offRev = sm.revenue + md.revenue + lg.revenue;
      totalRevenue += offRev;
      console.log('  Office Revenue: ' + Math.round(offRev).toLocaleString() + ' AED | ' + (sm.units+md.units+lg.units) + ' units');
    }

    const constCost = (bua && constPerSqft) ? bua * constPerSqft : 0;
    if (constCost) console.log('  Construction Cost: ' + constCost.toLocaleString() + ' AED');

    if (totalRevenue > 0) {
      console.log('  TOTAL REVENUE (calculated): ' + Math.round(totalRevenue).toLocaleString() + ' AED');
      if (constCost) {
        const grossProfit = totalRevenue - constCost - landPrice;
        const margin = ((grossProfit / totalRevenue) * 100).toFixed(1);
        console.log('  Gross Profit: ' + Math.round(grossProfit).toLocaleString() + ' AED (' + margin + '%)');
        if (parseFloat(margin) < 0) issues.push('NEGATIVE GROSS PROFIT MARGIN: ' + margin + '%');
        else if (parseFloat(margin) < 15) issues.push('LOW MARGIN BELOW 15%: ' + margin + '%');
      }
    }

    // Compare with stored feasibility study
    if (f) {
      console.log('  Stored in feasibilityStudies: totalRevenue=' + f.totalRevenue + ' totalCost=' + f.totalCost + ' netProfit=' + f.netProfit + ' roi=' + f.roi);
      if (totalRevenue > 0 && f.totalRevenue) {
        const storedRev = parseFloat(f.totalRevenue);
        const diff = Math.abs(totalRevenue - storedRev);
        const diffPct = (diff / totalRevenue * 100).toFixed(1);
        if (diff > 1000000) {
          issues.push('REVENUE MISMATCH: calculated=' + Math.round(totalRevenue).toLocaleString() + ' stored=' + storedRev.toLocaleString() + ' diff=' + diffPct + '%');
        }
      }
    } else {
      issues.push('NO FEASIBILITY STUDY RECORD IN DB');
    }

    if (issues.length > 0) {
      console.log('  ISSUES (' + issues.length + '):');
      issues.forEach(i => console.log('    [!] ' + i));
    } else {
      console.log('  STATUS: OK - Data complete');
    }
  }

  // Check cfProjects table
  console.log('\n' + '='.repeat(80));
  console.log('CASH FLOW PROJECTS TABLE:');
  const [cf_rows] = await conn.execute(`SELECT id, projectId, name, totalRevenue, totalCost, netProfit FROM cfProjects WHERE projectId IN (1,2,3,4,5,6) ORDER BY projectId`);
  cf_rows.forEach(r => {
    console.log('Project ' + r.projectId + ': totalRevenue=' + r.totalRevenue + ' totalCost=' + r.totalCost + ' netProfit=' + r.netProfit);
  });

  await conn.end();
}
main().catch(console.error);
