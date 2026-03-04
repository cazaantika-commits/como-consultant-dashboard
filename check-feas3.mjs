import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, projectId, projectName, scenarioName, landPrice, constructionCostPerSqft, estimatedBua, plotArea, numberOfUnits, gfaResidential, gfaRetail, gfaOffices, residentialSalePrice, retailSalePrice, officesSalePrice, designFeePct, supervisionFeePct, authoritiesFee, soilInvestigation, topographySurvey, marketingPct, agentCommissionSalePct, developerFeePct, contingenciesPct FROM feasibilityStudies WHERE projectId = 4');
console.log(JSON.stringify(rows, null, 2));
await conn.end();
