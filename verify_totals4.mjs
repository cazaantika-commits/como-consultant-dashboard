import { PROJECT_INPUTS, RATES, PRICING_DEFAULTS, calculateProjectFormulas, calculatePricingFormulas, calculateCosts } from './client/src/lib/projectData.ts';

const pf = calculateProjectFormulas(PROJECT_INPUTS);
const units = PRICING_DEFAULTS.map((u) => ({
  name: u.name,
  category: u.category,
  area: u.defaultArea,
  price: u.defaultPrice,
  count: u.defaultCount,
}));
const pr = calculatePricingFormulas(units);
const costs = calculateCosts(pf, pr);

console.log("=== بطاقة المشروع ===");
console.log("إجمالي التكاليف:", costs.totalCosts?.toLocaleString());
console.log("إجمالي المستثمر:", costs.totalInvestor?.toLocaleString());
console.log("إجمالي الضمان:", costs.totalEscrow?.toLocaleString());
console.log("المستثمر + الضمان:", ((costs.totalInvestor || 0) + (costs.totalEscrow || 0)).toLocaleString());
console.log("");
console.log("=== التحقق ===");
const diff = (costs.totalCosts || 0) - (costs.totalInvestor || 0) - (costs.totalEscrow || 0);
console.log("الفرق:", diff.toLocaleString());
if (diff === 0) {
  console.log("✅ متطابق! إجمالي التكاليف = المستثمر + الضمان");
} else {
  console.log("❌ غير متطابق! الفرق =", diff);
}
