import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n========================================');
console.log('  COMO DEVELOPMENTS - FULL FEASIBILITY AUDIT');
console.log('========================================\n');

// Get all projects
const [projects] = await conn.execute('SELECT * FROM projects ORDER BY id');
console.log(`Found ${projects.length} projects\n`);

for (const proj of projects) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PROJECT ${proj.id}: ${proj.name}`);
  console.log(`${'='.repeat(60)}`);
  
  // Get market overview (unit mix)
  const [moRows] = await conn.execute(
    'SELECT * FROM marketOverview WHERE projectId = ?', [proj.id]
  );
  
  // Get competition pricing
  const [cpRows] = await conn.execute(
    'SELECT * FROM competition_pricing WHERE projectId = ?', [proj.id]
  );
  
  // Get feasibility study
  const [fsRows] = await conn.execute(
    'SELECT * FROM feasibilityStudies WHERE projectId = ?', [proj.id]
  );
  
  const fs = fsRows[0] || null;
  
  // --- Project card data ---
  console.log('\n📋 PROJECT CARD DATA:');
  console.log(`  Land Price: ${proj.landPrice?.toLocaleString() || 'NULL'} AED`);
  console.log(`  GFA Residential: ${proj.gfaResidentialSqft?.toLocaleString() || 'NULL'} sqft`);
  console.log(`  GFA Retail: ${proj.gfaRetailSqft?.toLocaleString() || 'NULL'} sqft`);
  console.log(`  GFA Offices: ${proj.gfaOfficesSqft?.toLocaleString() || 'NULL'} sqft`);
  console.log(`  Construction Cost/sqft: ${proj.estimatedConstructionPricePerSqft || 'NULL'} AED`);
  
  // --- Market Overview (Unit Mix) ---
  if (moRows.length === 0) {
    console.log('\n⚠️  NO MARKET OVERVIEW DATA');
  } else {
    const mo = moRows[0];
    console.log('\n📊 MARKET OVERVIEW (Unit Mix):');
    
    // Residential
    const resPcts = [
      mo.studioPercentage || 0,
      mo.oneBedPercentage || 0,
      mo.twoBedPercentage || 0,
      mo.threeBedPercentage || 0,
    ];
    const resPctSum = resPcts.reduce((a, b) => a + b, 0);
    const resAvgAreas = [
      mo.studioAvgArea || 0,
      mo.oneBedAvgArea || 0,
      mo.twoBedAvgArea || 0,
      mo.threeBedAvgArea || 0,
    ];
    console.log(`  Residential Unit Mix (sum=${resPctSum}%):`);
    console.log(`    Studio: ${mo.studioPercentage}% | avg ${mo.studioAvgArea} sqft`);
    console.log(`    1BR: ${mo.oneBedPercentage}% | avg ${mo.oneBedAvgArea} sqft`);
    console.log(`    2BR: ${mo.twoBedPercentage}% | avg ${mo.twoBedAvgArea} sqft`);
    console.log(`    3BR: ${mo.threeBedPercentage}% | avg ${mo.threeBedAvgArea} sqft`);
    
    if (Math.abs(resPctSum - 100) > 0.1 && resPctSum > 0) {
      console.log(`  ❌ RESIDENTIAL PCT SUM = ${resPctSum}% (should be 100%)`);
    } else if (resPctSum > 0) {
      console.log(`  ✅ Residential pct sum = ${resPctSum}%`);
    }
    
    // Retail
    const retailPcts = [
      mo.retailSmallPercentage || 0,
      mo.retailMediumPercentage || 0,
      mo.retailLargePercentage || 0,
    ];
    const retailPctSum = retailPcts.reduce((a, b) => a + b, 0);
    if (retailPctSum > 0) {
      console.log(`  Retail Unit Mix (sum=${retailPctSum}%):`);
      console.log(`    Small: ${mo.retailSmallPercentage}% | avg ${mo.retailSmallAvgArea} sqft`);
      console.log(`    Medium: ${mo.retailMediumPercentage}% | avg ${mo.retailMediumAvgArea} sqft`);
      console.log(`    Large: ${mo.retailLargePercentage}% | avg ${mo.retailLargeAvgArea} sqft`);
      if (Math.abs(retailPctSum - 100) > 0.1) {
        console.log(`  ❌ RETAIL PCT SUM = ${retailPctSum}% (should be 100%)`);
      } else {
        console.log(`  ✅ Retail pct sum = ${retailPctSum}%`);
      }
    }
    
    // Offices
    const officePcts = [
      mo.officeSmallPercentage || 0,
      mo.officeMediumPercentage || 0,
      mo.officeLargePercentage || 0,
    ];
    const officePctSum = officePcts.reduce((a, b) => a + b, 0);
    if (officePctSum > 0) {
      console.log(`  Office Unit Mix (sum=${officePctSum}%):`);
      if (Math.abs(officePctSum - 100) > 0.1) {
        console.log(`  ❌ OFFICE PCT SUM = ${officePctSum}% (should be 100%)`);
      } else {
        console.log(`  ✅ Office pct sum = ${officePctSum}%`);
      }
    }
  }
  
  // --- Competition Pricing ---
  if (cpRows.length === 0) {
    console.log('\n⚠️  NO COMPETITION PRICING DATA');
  } else {
    const cp = cpRows[0];
    console.log('\n💰 COMPETITION PRICING (Base scenario):');
    if (cp.residentialBasePrice) {
      console.log(`  Residential: ${cp.residentialBasePrice} AED/sqft`);
    }
    if (cp.retailBasePrice) {
      console.log(`  Retail: ${cp.retailBasePrice} AED/sqft`);
    }
    if (cp.officesBasePrice) {
      console.log(`  Offices: ${cp.officesBasePrice} AED/sqft`);
    }
  }
  
  // --- Revenue Calculation ---
  if (moRows.length > 0 && cpRows.length > 0 && proj.gfaResidentialSqft) {
    const mo = moRows[0];
    const cp = cpRows[0];
    
    console.log('\n🧮 REVENUE CALCULATION:');
    
    // Residential revenue
    let totalResRevenue = 0;
    const gfaRes = proj.gfaResidentialSqft || 0;
    const resPrice = cp.residentialBasePrice || 0;
    
    if (gfaRes > 0 && resPrice > 0) {
      // Calculate number of units per type
      const resPcts = [
        { type: 'Studio', pct: (mo.studioPercentage || 0) / 100, avgArea: mo.studioAvgArea || 0 },
        { type: '1BR', pct: (mo.oneBedPercentage || 0) / 100, avgArea: mo.oneBedAvgArea || 0 },
        { type: '2BR', pct: (mo.twoBedPercentage || 0) / 100, avgArea: mo.twoBedAvgArea || 0 },
        { type: '3BR', pct: (mo.threeBedPercentage || 0) / 100, avgArea: mo.threeBedAvgArea || 0 },
      ].filter(r => r.pct > 0 && r.avgArea > 0);
      
      // Total units = GFA / weighted avg area
      const weightedAvgArea = resPcts.reduce((sum, r) => sum + r.pct * r.avgArea, 0);
      const totalUnits = weightedAvgArea > 0 ? Math.round(gfaRes / weightedAvgArea) : 0;
      
      for (const r of resPcts) {
        const units = Math.round(totalUnits * r.pct);
        const unitPrice = r.avgArea * resPrice;
        const revenue = units * unitPrice;
        totalResRevenue += revenue;
        console.log(`  ${r.type}: ${units} units × ${r.avgArea} sqft × ${resPrice} AED/sqft = ${revenue.toLocaleString()} AED`);
      }
      console.log(`  → Total Residential Revenue: ${totalResRevenue.toLocaleString()} AED`);
    }
    
    // Retail revenue
    let totalRetailRevenue = 0;
    const gfaRetail = proj.gfaRetailSqft || 0;
    const retailPrice = cp.retailBasePrice || 0;
    
    if (gfaRetail > 0 && retailPrice > 0) {
      const retailPcts = [
        { type: 'Small', pct: (mo.retailSmallPercentage || 0) / 100, avgArea: mo.retailSmallAvgArea || 0 },
        { type: 'Medium', pct: (mo.retailMediumPercentage || 0) / 100, avgArea: mo.retailMediumAvgArea || 0 },
        { type: 'Large', pct: (mo.retailLargePercentage || 0) / 100, avgArea: mo.retailLargeAvgArea || 0 },
      ].filter(r => r.pct > 0 && r.avgArea > 0);
      
      const weightedAvgAreaRetail = retailPcts.reduce((sum, r) => sum + r.pct * r.avgArea, 0);
      const totalRetailUnits = weightedAvgAreaRetail > 0 ? Math.round(gfaRetail / weightedAvgAreaRetail) : 0;
      
      for (const r of retailPcts) {
        const units = Math.round(totalRetailUnits * r.pct);
        const unitPrice = r.avgArea * retailPrice;
        const revenue = units * unitPrice;
        totalRetailRevenue += revenue;
        console.log(`  Retail ${r.type}: ${units} units × ${r.avgArea} sqft × ${retailPrice} AED/sqft = ${revenue.toLocaleString()} AED`);
      }
      console.log(`  → Total Retail Revenue: ${totalRetailRevenue.toLocaleString()} AED`);
    }
    
    // Office revenue
    let totalOfficeRevenue = 0;
    const gfaOffice = proj.gfaOfficesSqft || 0;
    const officePrice = cp.officesBasePrice || 0;
    
    if (gfaOffice > 0 && officePrice > 0) {
      const officePcts = [
        { type: 'Small', pct: (mo.officeSmallPercentage || 0) / 100, avgArea: mo.officeSmallAvgArea || 0 },
        { type: 'Medium', pct: (mo.officeMediumPercentage || 0) / 100, avgArea: mo.officeMediumAvgArea || 0 },
        { type: 'Large', pct: (mo.officeLargePercentage || 0) / 100, avgArea: mo.officeLargeAvgArea || 0 },
      ].filter(r => r.pct > 0 && r.avgArea > 0);
      
      if (officePcts.length > 0) {
        const weightedAvgAreaOffice = officePcts.reduce((sum, r) => sum + r.pct * r.avgArea, 0);
        const totalOfficeUnits = weightedAvgAreaOffice > 0 ? Math.round(gfaOffice / weightedAvgAreaOffice) : 0;
        
        for (const r of officePcts) {
          const units = Math.round(totalOfficeUnits * r.pct);
          const unitPrice = r.avgArea * officePrice;
          const revenue = units * unitPrice;
          totalOfficeRevenue += revenue;
          console.log(`  Office ${r.type}: ${units} units × ${r.avgArea} sqft × ${officePrice} AED/sqft = ${revenue.toLocaleString()} AED`);
        }
        console.log(`  → Total Office Revenue: ${totalOfficeRevenue.toLocaleString()} AED`);
      }
    }
    
    const totalRevenue = totalResRevenue + totalRetailRevenue + totalOfficeRevenue;
    console.log(`\n  ✅ TOTAL REVENUE: ${totalRevenue.toLocaleString()} AED`);
    
    // Construction cost
    const constructionCost = (proj.gfaResidentialSqft || 0) * (proj.estimatedConstructionPricePerSqft || 0)
      + (proj.gfaRetailSqft || 0) * (proj.estimatedConstructionPricePerSqft || 0)
      + (proj.gfaOfficesSqft || 0) * (proj.estimatedConstructionPricePerSqft || 0);
    const landCost = proj.landPrice || 0;
    
    console.log(`  Construction Cost: ${constructionCost.toLocaleString()} AED`);
    console.log(`  Land Cost: ${landCost.toLocaleString()} AED`);
    
    if (totalRevenue > 0 && constructionCost > 0) {
      const grossProfit = totalRevenue - constructionCost - landCost;
      const margin = (grossProfit / totalRevenue * 100).toFixed(1);
      console.log(`  Gross Profit (excl. fees): ${grossProfit.toLocaleString()} AED (${margin}%)`);
    }
  }
}

// Check for any NULL critical fields
console.log('\n\n========================================');
console.log('  CRITICAL DATA GAPS SUMMARY');
console.log('========================================');

for (const proj of projects) {
  const issues = [];
  if (!proj.landPrice) issues.push('landPrice=NULL');
  if (!proj.gfaResidentialSqft && !proj.gfaRetailSqft && !proj.gfaOfficesSqft) issues.push('all GFA=NULL');
  if (!proj.estimatedConstructionPricePerSqft) issues.push('constructionCost/sqft=NULL');
  
  const [moRows] = await conn.execute('SELECT COUNT(*) as cnt FROM marketOverview WHERE projectId = ?', [proj.id]);
  const [cpRows] = await conn.execute('SELECT COUNT(*) as cnt FROM competition_pricing WHERE projectId = ?', [proj.id]);
  
  if (moRows[0].cnt === 0) issues.push('no marketOverview');
  if (cpRows[0].cnt === 0) issues.push('no competition_pricing');
  
  if (issues.length > 0) {
    console.log(`\n❌ Project ${proj.id} (${proj.name}):`);
    issues.forEach(i => console.log(`   - ${i}`));
  } else {
    console.log(`✅ Project ${proj.id} (${proj.name}): All data complete`);
  }
}

await conn.end();
console.log('\n========================================');
console.log('  AUDIT COMPLETE');
console.log('========================================\n');
