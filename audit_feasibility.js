const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const projects = [
    { id:1, name:'مركز مجان التجاري (G+4)', gfaRes:0, gfaRetail:493894.71, gfaOffices:0, bua:null, landPrice:62000000, constPerSqft:null },
    { id:2, name:'مجان متعدد الاستخدامات (G+4P+25)', gfaRes:93623, gfaRetail:74903, gfaOffices:299534, bua:875300, landPrice:125000000, constPerSqft:345 },
    { id:3, name:'مبنى الجداف السكني (G+7)', gfaRes:50570.04, gfaRetail:0, gfaOffices:0, bua:110000, landPrice:15500000, constPerSqft:350 },
    { id:4, name:'ند الشبا قطعة 1 (6185392)', gfaRes:46736.20, gfaRetail:4090.30, gfaOffices:0, bua:114284, landPrice:18000000, constPerSqft:345 },
    { id:5, name:'ند الشبا قطعة 2 (6182776)', gfaRes:90061.20, gfaRetail:0, gfaOffices:0, bua:205000, landPrice:40000000, constPerSqft:345 },
    { id:6, name:'ند الشبا قطعة 3 الفلل (6180578)', gfaRes:0, gfaRetail:0, gfaOffices:0, bua:null, landPrice:6222000, constPerSqft:null },
  ];

  const mo = {
    1: null,
    2: { studioPct:10, oneBrPct:45, twoBrPct:35, threeBrPct:10, studioArea:450, oneBrArea:750, twoBrArea:1100, threeBrArea:1500, retailSmallPct:40, retailMediumPct:30, retailLargePct:20, officeSmallPct:40, officeMediumPct:40, officeLargePct:20 },
    3: { studioPct:20, oneBrPct:50, twoBrPct:30, threeBrPct:0, studioArea:400, oneBrArea:750, twoBrArea:1350, threeBrArea:0, retailSmallPct:0, retailMediumPct:0, retailLargePct:0, officeSmallPct:0, officeMediumPct:0, officeLargePct:0 },
    4: { studioPct:14, oneBrPct:36, twoBrPct:30, threeBrPct:20, studioArea:400, oneBrArea:650, twoBrArea:950, threeBrArea:1300, retailSmallPct:50, retailMediumPct:50, retailLargePct:0, officeSmallPct:0, officeMediumPct:0, officeLargePct:0 },
    5: { studioPct:10, oneBrPct:40, twoBrPct:30, threeBrPct:20, studioArea:350, oneBrArea:550, twoBrArea:850, threeBrArea:1200, retailSmallPct:0, retailMediumPct:0, retailLargePct:0, officeSmallPct:0, officeMediumPct:0, officeLargePct:0 },
    6: null,
  };

  const cp = {
    1: null,
    2: { studioP:1450, oneBrP:1500, twoBrP:1550, threeBrP:1600, retailSmP:3250, retailMdP:3250, retailLgP:3250, offSmP:1800, offMdP:1800, offLgP:1800 },
    3: { studioP:1610, oneBrP:1560, twoBrP:1510, threeBrP:1460, retailSmP:0, retailMdP:0, retailLgP:0, offSmP:0, offMdP:0, offLgP:0 },
    4: { studioP:3150, oneBrP:3150, twoBrP:3150, threeBrP:3150, retailSmP:2900, retailMdP:2900, retailLgP:2900, offSmP:0, offMdP:0, offLgP:0 },
    5: { studioP:1650, oneBrP:1760, twoBrP:1815, threeBrP:1870, retailSmP:0, retailMdP:0, retailLgP:0, offSmP:0, offMdP:0, offLgP:0 },
    6: null,
  };

  // Retail avg areas (assumed standard)
  const RETAIL_SM_AREA = 300;
  const RETAIL_MD_AREA = 600;
  const RETAIL_LG_AREA = 1200;
  const OFF_SM_AREA = 300;
  const OFF_MD_AREA = 600;
  const OFF_LG_AREA = 1200;

  function calcRes(gfa, pct, avgArea, price) {
    if (!gfa || !pct || !avgArea || !price) return { units: 0, revenue: 0 };
    const saleable = gfa * 0.95;
    const allocated = saleable * (pct / 100);
    const units = Math.floor(allocated / avgArea);
    return { units, revenue: units * avgArea * price };
  }

  function calcRetail(gfa, pct, avgArea, price) {
    if (!gfa || !pct || !avgArea || !price) return { units: 0, revenue: 0 };
    const saleable = gfa * 0.97;
    const allocated = saleable * (pct / 100);
    const units = Math.floor(allocated / avgArea);
    return { units, revenue: units * avgArea * price };
  }

  console.log('='.repeat(80));
  console.log('FULL FEASIBILITY AUDIT - ALL PROJECTS');
  console.log('='.repeat(80));

  for (const p of projects) {
    const m = mo[p.id];
    const c = cp[p.id];

    console.log('\n--- PROJECT ' + p.id + ': ' + p.name + ' ---');

    const issues = [];

    if (!m) issues.push('NO MARKET OVERVIEW DATA');
    if (!c) issues.push('NO COMPETITION PRICING DATA');
    if (!p.bua && p.constPerSqft) issues.push('BUA IS NULL - construction cost cannot be calculated');
    if (!p.constPerSqft && p.bua) issues.push('Construction price/sqft is NULL');
    if (!p.gfaRes && !p.gfaRetail && !p.gfaOffices) issues.push('ALL GFA VALUES ARE ZERO - no revenue possible');

    if (m) {
      const resPctSum = (m.studioPct||0) + (m.oneBrPct||0) + (m.twoBrPct||0) + (m.threeBrPct||0);
      if (resPctSum !== 100 && p.gfaRes > 0) issues.push('Residential pct sum = ' + resPctSum + '% (should be 100%)');

      const retailPctSum = (m.retailSmallPct||0) + (m.retailMediumPct||0) + (m.retailLargePct||0);
      if (retailPctSum !== 100 && p.gfaRetail > 0) issues.push('Retail pct sum = ' + retailPctSum + '% (should be 100%)');

      const offPctSum = (m.officeSmallPct||0) + (m.officeMediumPct||0) + (m.officeLargePct||0);
      if (offPctSum !== 100 && p.gfaOffices > 0) issues.push('Office pct sum = ' + offPctSum + '% (should be 100%)');
    }

    let totalRevenue = 0;

    if (m && c && p.gfaRes > 0) {
      const studio = calcRes(p.gfaRes, m.studioPct, m.studioArea, c.studioP);
      const oneBr  = calcRes(p.gfaRes, m.oneBrPct,  m.oneBrArea,  c.oneBrP);
      const twoBr  = calcRes(p.gfaRes, m.twoBrPct,  m.twoBrArea,  c.twoBrP);
      const threeBr= calcRes(p.gfaRes, m.threeBrPct, m.threeBrArea, c.threeBrP);
      const resRev = studio.revenue + oneBr.revenue + twoBr.revenue + threeBr.revenue;
      const resUnits = studio.units + oneBr.units + twoBr.units + threeBr.units;
      totalRevenue += resRev;
      console.log('  Residential: ' + resRev.toLocaleString() + ' AED | ' + resUnits + ' units (Studio:' + studio.units + ' 1BR:' + oneBr.units + ' 2BR:' + twoBr.units + ' 3BR:' + threeBr.units + ')');
    }

    if (m && c && p.gfaRetail > 0) {
      const sm = calcRetail(p.gfaRetail, m.retailSmallPct,  RETAIL_SM_AREA, c.retailSmP);
      const md = calcRetail(p.gfaRetail, m.retailMediumPct, RETAIL_MD_AREA, c.retailMdP);
      const lg = calcRetail(p.gfaRetail, m.retailLargePct,  RETAIL_LG_AREA, c.retailLgP);
      const retailRev = sm.revenue + md.revenue + lg.revenue;
      totalRevenue += retailRev;
      console.log('  Retail: ' + retailRev.toLocaleString() + ' AED | ' + (sm.units+md.units+lg.units) + ' units');
    }

    if (m && c && p.gfaOffices > 0) {
      const sm = calcRes(p.gfaOffices, m.officeSmallPct,  OFF_SM_AREA, c.offSmP);
      const md = calcRes(p.gfaOffices, m.officeMediumPct, OFF_MD_AREA, c.offMdP);
      const lg = calcRes(p.gfaOffices, m.officeLargePct,  OFF_LG_AREA, c.offLgP);
      const offRev = sm.revenue + md.revenue + lg.revenue;
      totalRevenue += offRev;
      console.log('  Offices: ' + offRev.toLocaleString() + ' AED | ' + (sm.units+md.units+lg.units) + ' units');
    }

    const constCost = (p.bua && p.constPerSqft) ? p.bua * p.constPerSqft : null;
    if (constCost) console.log('  Construction Cost: ' + constCost.toLocaleString() + ' AED (BUA ' + p.bua + ' x ' + p.constPerSqft + ' AED/sqft)');
    console.log('  Land Price: ' + p.landPrice.toLocaleString() + ' AED');

    if (totalRevenue > 0) {
      console.log('  TOTAL REVENUE: ' + totalRevenue.toLocaleString() + ' AED');
      if (constCost) {
        const grossProfit = totalRevenue - constCost - p.landPrice;
        const margin = ((grossProfit / totalRevenue) * 100).toFixed(1);
        console.log('  Gross Profit: ' + grossProfit.toLocaleString() + ' AED (' + margin + '%)');
        if (parseFloat(margin) < 0) issues.push('NEGATIVE GROSS PROFIT MARGIN: ' + margin + '%');
        if (parseFloat(margin) < 15) issues.push('LOW MARGIN BELOW 15%: ' + margin + '%');
      }
    }

    if (issues.length > 0) {
      console.log('  ISSUES (' + issues.length + '):');
      issues.forEach(i => console.log('    [!] ' + i));
    } else {
      console.log('  STATUS: OK - Data complete, numbers look reasonable');
    }
  }

  await conn.end();
}
main().catch(console.error);
