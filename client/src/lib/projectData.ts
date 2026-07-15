
// PROJECT DATA — SINGLE SOURCE OF TRUTH (مثل الإكسل)
// ═══════════════════════════════════════════════════════════════════
// البطاقة هي المصدر. كل الصفحات تقرأ من هنا.
// غيّر رقم هنا → يتغير في البطاقة + التدفقات + التسعير تلقائياً.
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// القسم 1: واجهة إدخالات المشروع (INPUTS INTERFACE)
// ─────────────────────────────────────────
export interface ProjectInputs {
  name: string;
  landArea: number; // مساحة الأرض (قدم²)
  bua: number; // مساحة البناء BUA (قدم²)
  constructionCostPerSqft: number;
  landPricePerSqft: number;
  designDuration: number; // مدة التصاميم (شهور)
  constructionDuration: number; // مدة الإنشاء (شهر)
  startDate: string;
  gfaResidential: number;
  gfaRetail: number;
  gfaOffice: number;
  efficiencyResidential: number;
  efficiencyRetail: number;
  efficiencyOffice: number;
  soilTest: number;
  topography: number;
  surveyorFee: number;
  nocSale: number;
  escrowAccountFee: number;
  bankFees: number;
  communityFee: number;
  reraProjectReg: number;
  reraAuditorReport: number;
  reraInspection: number;
  govFeesTotal: number;
}

export interface ProjectRates {
  landRegistration: number;
  landBroker: number;
  designFee: number;
  supervisionFee: number;
  sortingFeePerSqft: number;
  reraUnitFee: number;
  developerFeeRate: number;
  developerFeeDesign: number;
  developerFeeOffplan: number;
  developerFeeSupervision: number;
  marketingRate: number;
  marketingOffplanShare: number;
  marketingConstructionShare: number;
  salesCommission: number;
  salesCommissionPostCompletion: number;
  constructionInvestorShare: number;
  constructionEscrowShare: number;
  govFeesInvestorShare: number;
  govFeesEscrowShare: number;
  advancePayment: number;
  escrowDeposit: number;
  contingency: number;
  communityOffplanShare: number;
  communityConstructionShare: number;
}

// ─────────────────────────────────────────
// القسم 1b: القيم الافتراضية (DEFAULT — مجان متعدد الاستخدامات)
// ─────────────────────────────────────────
export const PROJECT_INPUTS: ProjectInputs = {
  name: "مجان متعدد الاستخدامات (G+4P+25)",
  landArea: 66879.19,
  bua: 875300,
  constructionCostPerSqft: 400,
  landPricePerSqft: 262,
  designDuration: 8,
  constructionDuration: 30,
  startDate: "2026-08",
  gfaResidential: 93631,
  gfaRetail: 74904.84,
  gfaOffice: 299618.38,
  efficiencyResidential: 0.95,
  efficiencyRetail: 0.80,
  efficiencyOffice: 0.90,
  soilTest: 45000,
  topography: 12000,
  surveyorFee: 35000,
  nocSale: 10000,
  escrowAccountFee: 180000,
  bankFees: 35000,
  communityFee: 80000,
  reraProjectReg: 150000,
  reraAuditorReport: 24000,
  reraInspection: 150000,
  govFeesTotal: 7000000,
};

export const RATES: ProjectRates = {
  landRegistration: 0.04,
  landBroker: 0.01,
  designFee: 0.018,
  supervisionFee: 0.02,
  sortingFeePerSqft: 40,
  reraUnitFee: 520,
  developerFeeRate: 0.05,
  developerFeeDesign: 0.01,
  developerFeeOffplan: 0.01,
  developerFeeSupervision: 0.03,
  marketingRate: 0.02,
  marketingOffplanShare: 0.25,
  marketingConstructionShare: 0.75,
  salesCommission: 0.05,
  salesCommissionPostCompletion: 0.02,
  constructionInvestorShare: 0.30,
  constructionEscrowShare: 0.70,
  govFeesInvestorShare: 0.10,
  govFeesEscrowShare: 0.90,
  advancePayment: 0.10,
  escrowDeposit: 0.20,
  contingency: 0.02,
  communityOffplanShare: 0.25,
  communityConstructionShare: 0.75,
};

// ─────────────────────────────────────────
// القسم 1c: تحويل بيانات DB إلى ProjectInputs + ProjectRates
// ─────────────────────────────────────────
export function dbProjectToInputs(dbProject: any): ProjectInputs {
  const gfaRes = parseFloat(dbProject.gfaResidentialSqft || '0') || 0;
  const gfaRet = parseFloat(dbProject.gfaRetailSqft || '0') || 0;
  const gfaOff = parseFloat(dbProject.gfaOfficesSqft || '0') || 0;
  const gfaTotal = parseFloat(dbProject.gfaSqft || '0') || (gfaRes + gfaRet + gfaOff);
  const bua = parseFloat(dbProject.manualBuaSqft || '0') || dbProject.bua || 0;
  const plotArea = parseFloat(dbProject.plotAreaSqft || '0') || 0;
  const landPrice = parseFloat(dbProject.landPrice || '0') || 0;
  const constPricePerSqft = parseFloat(dbProject.estimatedConstructionPricePerSqft || '0') || 400;

  // حساب سعر القدم أرض = سعر الأرض / GFA
  const landPricePerSqft = gfaTotal > 0 ? landPrice / gfaTotal : 0;

  return {
    name: dbProject.name || 'مشروع',
    landArea: plotArea,
    bua,
    constructionCostPerSqft: constPricePerSqft,
    landPricePerSqft: Math.round(landPricePerSqft),
    designDuration: dbProject.preConMonths || 6,
    constructionDuration: dbProject.constructionMonths || 18,
    startDate: dbProject.startDate || '2026-08',
    gfaResidential: gfaRes,
    gfaRetail: gfaRet,
    gfaOffice: gfaOff,
    efficiencyResidential: dbProject.saleableResidentialPct ? parseFloat(dbProject.saleableResidentialPct) / 100 : 0.95,
    efficiencyRetail: dbProject.saleableRetailPct ? parseFloat(dbProject.saleableRetailPct) / 100 : 0.80,
    efficiencyOffice: dbProject.saleableOfficesPct ? parseFloat(dbProject.saleableOfficesPct) / 100 : 0.90,
    soilTest: parseFloat(dbProject.soilTestFee || '0') || 45000,
    topography: parseFloat(dbProject.topographicSurveyFee || '0') || 12000,
    surveyorFee: parseFloat(dbProject.surveyorFees || '0') || 35000,
    nocSale: parseFloat(dbProject.developerNocFee || '0') || 10000,
    escrowAccountFee: parseFloat(dbProject.escrowAccountFee || '0') || 180000,
    bankFees: parseFloat(dbProject.bankFees || '0') || 35000,
    communityFee: parseFloat(dbProject.communityFees || '0') || 80000,
    reraProjectReg: parseFloat(dbProject.reraProjectRegFee || '0') || 150000,
    reraAuditorReport: parseFloat(dbProject.reraAuditReportFee || '0') || 24000,
    reraInspection: parseFloat(dbProject.reraInspectionReportFee || '0') || 150000,
    govFeesTotal: parseFloat(dbProject.officialBodiesFees || '0') || 7000000,
  };
}

export function dbProjectToRates(dbProject: any): ProjectRates {
  const designPct = parseFloat(dbProject.designFeePct || '0') || 1.8;
  const supervisionPct = parseFloat(dbProject.supervisionFeePct || '0') || 2;
  const salesPct = parseFloat(dbProject.salesCommissionPct || '0') || 5;
  const marketingPct = parseFloat(dbProject.marketingPct || '0') || 2;
  const developerPct = parseFloat(dbProject.developerFeePct || '0') || 5;
  const sortingPerSqft = parseFloat(dbProject.separationFeePerSqft || '0') || 40;
  const landBrokerPct = parseFloat(dbProject.agentCommissionLandPct || '0') || 1;

  return {
    landRegistration: 0.04,
    landBroker: landBrokerPct / 100,
    designFee: designPct / 100,
    supervisionFee: supervisionPct / 100,
    sortingFeePerSqft: sortingPerSqft,
    reraUnitFee: 520,
    developerFeeRate: developerPct / 100,
    developerFeeDesign: 0.01,
    developerFeeOffplan: 0.01,
    developerFeeSupervision: (developerPct / 100) - 0.02,
    marketingRate: marketingPct / 100,
    marketingOffplanShare: 0.25,
    marketingConstructionShare: 0.75,
    salesCommission: salesPct / 100,
    salesCommissionPostCompletion: 0.02,
    constructionInvestorShare: 0.30,
    constructionEscrowShare: 0.70,
    govFeesInvestorShare: 0.10,
    govFeesEscrowShare: 0.90,
    advancePayment: 0.10,
    escrowDeposit: 0.20,
    contingency: 0.02,
    communityOffplanShare: 0.25,
    communityConstructionShare: 0.75,
  };
}

// ─────────────────────────────────────────
// القسم 3: إدخالات التسعير (PRICING INPUTS)
// ─────────────────────────────────────────
export interface UnitType {
  name: string;
  category: "residential" | "retail" | "office";
  defaultArea: number;
  defaultPrice: number;
  defaultCount: number;
}

export const PRICING_DEFAULTS: UnitType[] = [
  // سكني
  { name: "استوديو", category: "residential", defaultArea: 400, defaultPrice: 1800, defaultCount: 0 },
  { name: "غرفة وصالة", category: "residential", defaultArea: 750, defaultPrice: 1650, defaultCount: 30 },
  { name: "غرفتين وصالة", category: "residential", defaultArea: 1300, defaultPrice: 1550, defaultCount: 30 },
  { name: "ثلاث غرف وصالة", category: "residential", defaultArea: 1650, defaultPrice: 1450, defaultCount: 15 },
  // تجزئة
  { name: "تجزئة / صغير", category: "retail", defaultArea: 850, defaultPrice: 3000, defaultCount: 18 },
  { name: "تجزئة / متوسط", category: "retail", defaultArea: 1200, defaultPrice: 2500, defaultCount: 12 },
  { name: "تجزئة / كبير", category: "retail", defaultArea: 1800, defaultPrice: 2000, defaultCount: 4 },
  // مكاتب
  { name: "مكاتب / صغير", category: "office", defaultArea: 1200, defaultPrice: 1900, defaultCount: 49 },
  { name: "مكاتب / متوسط", category: "office", defaultArea: 2000, defaultPrice: 1800, defaultCount: 51 },
  { name: "مكاتب / كبير", category: "office", defaultArea: 3500, defaultPrice: 1700, defaultCount: 20 },
];

// ─────────────────────────────────────────
// القسم 4: الفورمولات المحسوبة (FORMULAS)
// ─────────────────────────────────────────

// فورمولات المشروع الأساسية
export function calculateProjectFormulas(inputs: ProjectInputs = PROJECT_INPUTS, rates: ProjectRates = RATES) {
  const gfaTotal = inputs.gfaResidential + inputs.gfaRetail + inputs.gfaOffice;
  const sellableResidential = inputs.gfaResidential * inputs.efficiencyResidential;
  const sellableRetail = inputs.gfaRetail * inputs.efficiencyRetail;
  const sellableOffice = inputs.gfaOffice * inputs.efficiencyOffice;
  const sellableTotal = sellableResidential + sellableRetail + sellableOffice;

  const landPrice = inputs.landPricePerSqft * gfaTotal;
  const landRegistration = landPrice * rates.landRegistration;
  const landBroker = landPrice * rates.landBroker;
  const constructionCost = inputs.bua * inputs.constructionCostPerSqft;

  return {
    gfaTotal,
    sellableResidential,
    sellableRetail,
    sellableOffice,
    sellableTotal,
    landPrice,
    landRegistration,
    landBroker,
    constructionCost,
  };
}

// فورمولات التسعير — تحسب الإيرادات وعدد الوحدات
export interface PricingUnit {
  name: string;
  category: "residential" | "retail" | "office";
  area: number;
  price: number;
  count: number;
}

export function calculatePricingFormulas(units: PricingUnit[]) {
  const residential = units.filter(u => u.category === "residential");
  const retail = units.filter(u => u.category === "retail");
  const office = units.filter(u => u.category === "office");

  const revenueResidential = residential.reduce((s, u) => s + u.count * u.area * u.price, 0);
  const revenueRetail = retail.reduce((s, u) => s + u.count * u.area * u.price, 0);
  const revenueOffice = office.reduce((s, u) => s + u.count * u.area * u.price, 0);
  const totalRevenue = revenueResidential + revenueRetail + revenueOffice;

  const totalUnits = units.reduce((s, u) => s + u.count, 0);

  // حساب المواقف
  const parkingResidential = residential.reduce((s, u) => {
    const parkingPerUnit = u.area < 1500 ? 1 : 2;
    return s + u.count * parkingPerUnit;
  }, 0);
  const parkingRetail = retail.reduce((s, u) => s + u.count * Math.ceil(u.area / 500), 0);
  const parkingOffice = office.reduce((s, u) => s + u.count * Math.ceil(u.area / 500), 0);
  const totalParking = parkingResidential + parkingRetail + parkingOffice;

  const totalAreaUsed = units.reduce((s, u) => s + u.count * u.area, 0);

  return {
    revenueResidential,
    revenueRetail,
    revenueOffice,
    totalRevenue,
    totalUnits,
    totalParking,
    parkingResidential,
    parkingRetail,
    parkingOffice,
    totalAreaUsed,
  };
}

// ─────────────────────────────────────────
// القسم 5: حساب التكاليف (نفس بنود البطاقة بالضبط)
// ─────────────────────────────────────────
export function calculateCosts(
  projectFormulas: ReturnType<typeof calculateProjectFormulas>,
  pricingFormulas: ReturnType<typeof calculatePricingFormulas>,
  inputs: ProjectInputs = PROJECT_INPUTS,
  rates: ProjectRates = RATES
) {
  const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
  const { totalRevenue, totalUnits } = pricingFormulas;

  // ─── بنود التكاليف (نفس ترتيب البطاقة) ───
  const designFee = constructionCost * rates.designFee;
  const supervisionFee = constructionCost * rates.supervisionFee;
  const sortingFee = gfaTotal * rates.sortingFeePerSqft;
  const reraUnits = totalUnits * rates.reraUnitFee;
  const salesCommission = totalRevenue * rates.salesCommission;
  const marketing = totalRevenue * rates.marketingRate;
  const developerFee = totalRevenue * rates.developerFeeRate;
  const constructionInvestor = constructionCost * rates.constructionInvestorShare;
  const constructionEscrow = constructionCost * rates.constructionEscrowShare;
  const govFeesInvestor = inputs.govFeesTotal * rates.govFeesInvestorShare;
  const govFeesEscrow = inputs.govFeesTotal * rates.govFeesEscrowShare;  // ─── إجمالي المستثمر (نفس معادلة البطاقة بالضبط) ───
  const totalInvestor = landPrice + landRegistration + landBroker + designFee +
    inputs.soilTest + inputs.topography + inputs.communityFee + govFeesInvestor +
    sortingFee + inputs.nocSale + inputs.reraProjectReg + reraUnits +
    inputs.escrowAccountFee + inputs.bankFees + marketing + developerFee +
    constructionInvestor;
  // ─── إجمالي الضمان (نفس معادلة البطاقة بالضبط) ───
  const totalEscrow = supervisionFee + govFeesEscrow + salesCommission +
    inputs.reraAuditorReport + inputs.reraInspection + inputs.surveyorFee + constructionEscrow;

  const totalCosts = totalInvestor + totalEscrow;
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    // بنود فردية
    designFee,
    supervisionFee,
    sortingFee,
    reraUnits,
    salesCommission,
    marketing,
    developerFee,
    constructionInvestor,
    constructionEscrow,
    govFeesInvestor,
    govFeesEscrow,
    // الإجماليات
    totalInvestor,
    totalEscrow,
    totalCosts,
    profit,
    margin,
  };
}
