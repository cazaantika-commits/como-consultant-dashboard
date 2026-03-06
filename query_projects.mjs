import { db } from './server/_core/db.js';
import { projects } from './drizzle/schema.js';

const result = await db.select({
  id: projects.id,
  name: projects.name,
  landPrice: projects.landPrice,
  agentCommissionLandPct: projects.agentCommissionLandPct,
  separationFeePerM2: projects.separationFeePerM2,
  plotAreaM2: projects.plotAreaM2,
}).from(projects).limit(6);

console.log(JSON.stringify(result, null, 2));
