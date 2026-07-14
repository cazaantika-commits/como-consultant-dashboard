import { PROJECT_INPUTS, RATES, PRICING_DEFAULTS, calculateProjectFormulas, calculatePricingFormulas, calculateCosts } from './client/src/lib/projectData.ts';

const pf = calculateProjectFormulas(PROJECT_INPUTS);
console.log("pf.constructionCost:", pf.constructionCost);
console.log("pf.gfaTotal:", pf.gfaTotal);
console.log("pf.landPrice:", pf.landPrice);

const units = PRICING_DEFAULTS.map((u) => ({
  ...u,
  pricePerSqft: u.pricePerSqft,
  count: u.count,
}));
const pr = calculatePricingFormulas(units);
console.log("pr.totalRevenue:", pr.totalRevenue);

const costs = calculateCosts(pf, pr);
console.log("costs:", JSON.stringify(costs, null, 2));
