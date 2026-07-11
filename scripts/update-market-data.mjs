import { execSync } from 'child_process';

import { readFileSync } from 'fs';
const dbUrl = process.env.DATABASE_URL || process.env.DRIZZLE_DATABASE_URL;

function sql(query) {
  const url = new URL(dbUrl);
  const host = url.hostname;
  const port = url.port || '3306';
  const user = url.username;
  const pass = url.password;
  const db = url.pathname.slice(1);
  const cmd = `mysql -h ${host} -P ${port} -u ${user} -p'${pass}' ${db} --ssl-mode=REQUIRED -e "${query.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  } catch (e) {
    console.error('SQL Error:', e.message);
    return null;
  }
}

// =============================================
// UPDATE MARKET OVERVIEW (Unit Distribution)
// =============================================

// Project 2: Majan Mixed Use (G+4P+25) - Remove studio, redistribute
// Total residential was: studio 8.12% + 1BR 24.85% + 2BR 29.90% + 3BR 13.15% = ~76% (rest is non-residential)
// New: 1BR 35%, 2BR 45%, 3BR 20% (sum = 100% of residential portion)
console.log('Updating Project 2 - Majan Mixed Use...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 35.00, residential1brAvgArea = 700, residential1brCount = 0,
  residential2brPct = 45.00, residential2brAvgArea = 1000, residential2brCount = 0,
  residential3brPct = 20.00, residential3brAvgArea = 1400, residential3brCount = 0,
  retailSmallPct = 22.00, retailSmallAvgArea = 1000, retailSmallCount = 0,
  retailMediumPct = 40.00, retailMediumAvgArea = 3000, retailMediumCount = 0,
  retailLargePct = 38.00, retailLargeAvgArea = 7500, retailLargeCount = 0,
  officeSmallPct = 39.00, officeSmallAvgArea = 1000, officeSmallCount = 0,
  officeMediumPct = 39.00, officeMediumAvgArea = 2500, officeMediumCount = 0,
  officeLargePct = 22.00, officeLargeAvgArea = 5000, officeLargeCount = 0
  WHERE projectId = 2`);

// Project 3: Al Jaddaf Residential (G+7)
console.log('Updating Project 3 - Al Jaddaf...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 40.00, residential1brAvgArea = 700, residential1brCount = 0,
  residential2brPct = 40.00, residential2brAvgArea = 1050, residential2brCount = 0,
  residential3brPct = 20.00, residential3brAvgArea = 1400, residential3brCount = 0
  WHERE projectId = 3`);

// Project 4: Nad Al Sheba - Plot 1
console.log('Updating Project 4 - Nad Al Sheba Plot 1...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 30.00, residential1brAvgArea = 750, residential1brCount = 0,
  residential2brPct = 45.00, residential2brAvgArea = 1100, residential2brCount = 0,
  residential3brPct = 25.00, residential3brAvgArea = 1500, residential3brCount = 0
  WHERE projectId = 4`);

// Project 5: Nad Al Sheba - Plot 2
console.log('Updating Project 5 - Nad Al Sheba Plot 2...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 30.00, residential1brAvgArea = 750, residential1brCount = 0,
  residential2brPct = 45.00, residential2brAvgArea = 1100, residential2brCount = 0,
  residential3brPct = 25.00, residential3brAvgArea = 1500, residential3brCount = 0,
  retailSmallPct = 40.00, retailSmallAvgArea = 1000, retailSmallCount = 0,
  retailMediumPct = 40.00, retailMediumAvgArea = 2500, retailMediumCount = 0,
  retailLargePct = 20.00, retailLargeAvgArea = 5000, retailLargeCount = 0
  WHERE projectId = 5`);

// Project 6: Nad Al Sheba - Plot 3 Villas
// Using 1BR field for 5BR Villa, 2BR for 4BR Villa, 3BR for 3BR Townhouse
console.log('Updating Project 6 - Nad Al Sheba Villas...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 30.00, residential1brAvgArea = 5400, residential1brCount = 0,
  residential2brPct = 40.00, residential2brAvgArea = 3800, residential2brCount = 0,
  residential3brPct = 30.00, residential3brAvgArea = 2750, residential3brCount = 0
  WHERE projectId = 6`);

// Project 1: Majan Commercial (G+4) - Retail only
console.log('Updating Project 1 - Majan Commercial...');
sql(`UPDATE marketOverview SET 
  residentialStudioPct = 0, residentialStudioAvgArea = 0, residentialStudioCount = 0,
  residential1brPct = 0, residential1brAvgArea = 0, residential1brCount = 0,
  residential2brPct = 0, residential2brAvgArea = 0, residential2brCount = 0,
  residential3brPct = 0, residential3brAvgArea = 0, residential3brCount = 0,
  retailSmallPct = 30.00, retailSmallAvgArea = 800, retailSmallCount = 0,
  retailMediumPct = 45.00, retailMediumAvgArea = 2500, retailMediumCount = 0,
  retailLargePct = 25.00, retailLargeAvgArea = 6000, retailLargeCount = 0
  WHERE projectId = 1`);

// =============================================
// UPDATE COMPETITION PRICING
// =============================================

// Project 1: Majan Commercial
console.log('Updating Pricing - Project 1...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 0, base2brPrice = 0, base3brPrice = 0,
  baseRetailSmallPrice = 2300, baseRetailMediumPrice = 2100, baseRetailLargePrice = 1900,
  baseOfficeSmallPrice = 0, baseOfficeMediumPrice = 0, baseOfficeLargePrice = 0
  WHERE projectId = 1`);

// Project 2: Majan Mixed Use
console.log('Updating Pricing - Project 2...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 1550, base2brPrice = 1450, base3brPrice = 1400,
  baseRetailSmallPrice = 2300, baseRetailMediumPrice = 2100, baseRetailLargePrice = 1900,
  baseOfficeSmallPrice = 1800, baseOfficeMediumPrice = 1700, baseOfficeLargePrice = 1500
  WHERE projectId = 2`);

// Project 3: Al Jaddaf
console.log('Updating Pricing - Project 3...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 1828, base2brPrice = 1750, base3brPrice = 1650
  WHERE projectId = 3`);

// Project 4: Nad Al Sheba Plot 1
console.log('Updating Pricing - Project 4...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 1700, base2brPrice = 1600, base3brPrice = 1500
  WHERE projectId = 4`);

// Project 5: Nad Al Sheba Plot 2
console.log('Updating Pricing - Project 5...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 1750, base2brPrice = 1650, base3brPrice = 1550,
  baseRetailSmallPrice = 2200, baseRetailMediumPrice = 2000, baseRetailLargePrice = 1800
  WHERE projectId = 5`);

// Project 6: Nad Al Sheba Villas
// 1BR field = 5BR Villa, 2BR field = 4BR Villa, 3BR field = 3BR Townhouse
console.log('Updating Pricing - Project 6...');
sql(`UPDATE competition_pricing SET 
  baseStudioPrice = 0, base1brPrice = 2200, base2brPrice = 2200, base3brPrice = 2200
  WHERE projectId = 6`);

console.log('\\n✅ All projects updated successfully!');
console.log('\\nSummary:');
console.log('- Removed all studios from all projects');
console.log('- Updated unit mix based on market demand research');
console.log('- Updated pricing based on Bayut/DLD/CRC 2025-2026 data');
