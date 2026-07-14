// ═══════════════════════════════════════════════════════════════════
// PROJECT DATA — SINGLE SOURCE OF TRUTH (مثل الإكسل)
// ═══════════════════════════════════════════════════════════════════
// البطاقة هي المصدر. كل الصفحات تقرأ من هنا.
// غيّر رقم هنا → يتغير في البطاقة + التدفقات + التسعير تلقائياً.
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// القسم 1: إدخالات بطاقة المشروع (INPUTS)
// ─────────────────────────────────────────
export const PROJECT_INPUTS = {
  // البيانات الأساسية
  name: "مجان متعدد الاستخدامات (G+4P+25)",
  landArea: 66879.19, // مساحة الأرض (قدم²)
  bua: 875300, // مساحة البناء BUA (قدم²)
  constructionCostPerSqft: 400, // تكلفة الإنشاء (درهم/قدم)
  landPricePerSqft: 262, // سعر القدم أرض (درهم)
  designDuration: 8, // مدة التصاميم (شهور)
  constructionDuration: 30, // مدة الإنشاء (شهر)
  startDate: "2026-08", // تاريخ البدء

  // GFA لكل فئة
  gfaResidential: 93631,
  gfaRetail: 74904.84,
  gfaOffice: 299618.38,

  // نسب الكفاءة (المساحة القابلة للبيع)
  efficiencyResidential: 0.95,
  efficiencyRetail: 0.80,
  efficiencyOffice: 0.90,

  // رسوم ثابتة (مبالغ مقطوعة)
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
  govFeesTotal: 7000000, // رسوم الجهات الحكومية الإجمالية (ثابت)
};

// ─────────────────────────────────────────
// القسم 2: النسب والمعدلات (RATES)
// نفس النسب الموجودة في البطاقة بالضبط
// ─────────────────────────────────────────
export const RATES = {
  // الأرض
  landRegistration: 0.04, // رسوم تسجيل الأرض (4%)
  landBroker: 0.01, // عمولة وسيط الأرض (1%)

  // التصاميم والإشراف (من تكلفة الإنشاء)
  designFee: 0.018, // أتعاب التصاميم (1.8%)
  supervisionFee: 0.02, // أتعاب الإشراف (2%)

  // رسوم الفرز وريرا
  sortingFeePerSqft: 40, // رسوم الفرز (40 درهم/قدم²)
  reraUnitFee: 520, // رسوم تسجيل الوحدة — ريرا

  // أتعاب المطور (5% من الإيرادات — إجمالي)
  developerFeeRate: 0.05, // 5% إجمالي
  // تقسيم أتعاب المطور على المراحل (للتدفقات الشهرية)
  developerFeeDesign: 0.01, // 1% تصاميم
  developerFeeOffplan: 0.01, // 1% أوف بلان
  developerFeeSupervision: 0.03, // 3% إشراف

  // التسويق (2% من الإيرادات)
  marketingRate: 0.02, // 2% إجمالي
  marketingOffplanShare: 0.25, // 25% في مرحلة أوف بلان
  marketingConstructionShare: 0.75, // 75% في مرحلة الإنشاء

  // عمولة المبيعات (5% من الإيرادات)
  salesCommission: 0.05,
  salesCommissionPostCompletion: 0.02, // 2% بيع بعد الإنجاز

  // تقسيم الإنشاء (مستثمر / ضمان)
  constructionInvestorShare: 0.30, // 30% من المستثمر
  constructionEscrowShare: 0.70, // 70% من الضمان

  // تقسيم رسوم الجهات الحكومية
  govFeesInvestorShare: 0.10, // 10% مستثمر
  govFeesEscrowShare: 0.90, // 90% ضمان

  // الإنشاء — نسب إضافية للتدفقات
  advancePayment: 0.10, // 10% دفعة مقدمة
  escrowDeposit: 0.20, // 20% إيداع ضمان
  contingency: 0.02, // 2% احتياطي

  // تقسيم رسوم المجتمع
  communityOffplanShare: 0.25,
  communityConstructionShare: 0.75,
};

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
export function calculateProjectFormulas(inputs = PROJECT_INPUTS, rates = RATES) {
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
  inputs = PROJECT_INPUTS,
  rates = RATES
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
  const govFeesEscrow = inputs.govFeesTotal * rates.govFeesEscrowShare;

  // ─── إجمالي المستثمر (نفس معادلة البطاقة بالضبط) ───
  const totalInvestor = landPrice + landRegistration + landBroker + designFee +
    inputs.soilTest + inputs.topography + inputs.communityFee + govFeesInvestor +
    sortingFee + inputs.nocSale + inputs.reraProjectReg + reraUnits +
    inputs.escrowAccountFee + inputs.bankFees + marketing + developerFee + inputs.surveyorFee +
    constructionInvestor;

  // ─── إجمالي الضمان (نفس معادلة البطاقة بالضبط) ───
  const totalEscrow = supervisionFee + govFeesEscrow + salesCommission +
    inputs.reraAuditorReport + inputs.reraInspection + constructionEscrow;

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
