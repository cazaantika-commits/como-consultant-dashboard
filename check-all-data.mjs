import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);

// Market overview data
const [mo] = await conn.execute('SELECT residentialStudioPct, residentialStudioAvgArea, residential1brpct, residential1bravgarea, residential2brpct, residential2bravgarea FROM marketOverview WHERE projectId = 4');
console.log('=== Market Overview ===');
console.log(JSON.stringify(mo[0], null, 2));

// Competition pricing
const [cp] = await conn.execute('SELECT baseStudioPrice, base1brPrice, base2brPrice, base3brPrice, activeScenario FROM competition_pricing WHERE projectId = 4');
console.log('\n=== Competition Pricing ===');
console.log(JSON.stringify(cp[0], null, 2));

// Project GFA
const [p] = await conn.execute('SELECT gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, manualBuaSqft, landPrice, estimatedConstructionPricePerSqft, plotAreaSqft FROM projects WHERE id = 4');
console.log('\n=== Project GFA & Costs ===');
console.log(JSON.stringify(p[0], null, 2));

await conn.end();
