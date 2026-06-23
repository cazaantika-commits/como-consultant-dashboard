import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, projectId, projectName, scenarioName, landPrice, agentCommissionLandPct, soilInvestigation, topographySurvey, authoritiesFee, constructionCostPerSqft, estimatedBua, plotArea, designFeePct, supervisionFeePct, marketingPct, agentCommissionSalePct, developerFeePct, contingenciesPct, reraOffplanFee, reraUnitFee, nocFee, escrowFee, bankCharges, surveyorFees, reraAuditFees, reraInspectionFees, separationFeePerM2, communityFee, numberOfUnits, gfaResidential, gfaRetail, gfaOffices, saleableResidentialPct, saleableRetailPct, saleableOfficesPct, residentialSalePrice, retailSalePrice, officesSalePrice FROM feasibility_studies WHERE projectId = 4');
console.log(JSON.stringify(rows[0], null, 2));
await conn.end();
