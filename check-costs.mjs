import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);

// Check costs_cash_flow table
const [costs] = await conn.execute('SELECT * FROM costs_cash_flow WHERE projectId = 4');
console.log('=== costs_cash_flow for project 4 ===');
console.log('Count:', costs.length);
for (const c of costs) console.log(JSON.stringify(c));

// Also check the projects table for project 4 cost fields
const [proj] = await conn.execute('SELECT id, name, landPrice, constructionCostPerSqft, bua, plotArea, numberOfUnits, gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, pricePerSqft FROM projects WHERE id = 4');
console.log('\n=== Project 4 fields ===');
console.log(JSON.stringify(proj[0], null, 2));

await conn.end();
