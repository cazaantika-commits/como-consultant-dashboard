import { PROJECT_INPUTS, RATES, PRICING_DEFAULTS, calculateProjectFormulas, calculatePricingFormulas, calculateCosts } from './client/src/lib/projectData.ts';

const pf = calculateProjectFormulas(PROJECT_INPUTS);
const units = PRICING_DEFAULTS.map((u) => ({
  ...u,
  pricePerSqft: u.pricePerSqft,
  count: u.count,
}));
console.log("units[0]:", units[0]);
const pr = calculatePricingFormulas(units);
console.log("pr:", pr);
