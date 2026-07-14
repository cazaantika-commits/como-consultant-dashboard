// ═══════════════════════════════════════════════════════════════════
// PROJECT DATA — SINGLE SOURCE OF TRUTH (مثل الإكسل)
// ═══════════════════════════════════════════════════════════════════
// كل الصفحات تقرأ من هنا مباشرة. غيّر رقم هنا → يتغير في كل مكان.
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// القسم 1: إدخالات بطاقة المشروع (INPUTS)
// ─────────────────────────────────────────
export const PROJECT_INPUTS = {
  name: "مجان متعدد الاستخدامات (G+4P+25)",
  landArea: 66879, // مساحة الأرض (قدم²)
  bua: 875300, // مساحة البناء BUA (قدم²)
  constructionCostPerSqft: 400, // تكلفة الإنشاء (درهم/قدم)
  landPricePerSqft: 262, // سعر القدم أرض (درهم)
  designDuration: 8, // مدة التصاميم (شهور)
  constructionDuration: 30, // مدة الإنشاء (شهر)
  startDate: "2026-08", // تاريخ البدء

  // GFA لكل فئة
  gfaResidential: 93631.06,
  gfaRetail: 74904.88,
  gfaOffice: 299618.38,

  // نسب الكفاءة (المساحة القابلة للبيع)
  efficiencyResidential: 0.95,
  efficiencyRetail: 0.80,
  efficiencyOffice: 0.89,

  // رسوم ثابتة
  soilTest: 45000,
  topography: 12000,
  surveyorFee: 35000,
  nocSale: 10000,
  escrowAccountFee: 180000,
  bankFees: 35000,
  communityFee: 80000,
  reraProjectReg: 150000,
  reraAuditorReport: 24000,
  reraInspection: 165000,
  govFeesTotal: 3500000, // رسوم الجهات الحكومية الإجمالية (ثابت)
};

// ─────────────────────────────────────────
// القسم 2: النسب والمعدلات (RATES)
// ─────────────────────────────────────────
export const RATES = {
  landRegistration: 0.04, // رسوم تسجيل الأرض
  landBroker: 0.01, // عمولة وسيط الأرض
  designFee: 0.018, // أتعاب الاستشاري — التصاميم
  supervisionFee: 0.02, // أتعاب الاستشاري — الإشراف
  sortingFeePerSqft: 40, // رسوم الفرز (درهم/قدم²)
  reraUnitFee: 520, // رسوم تسجيل الوحدة — ريرا

  // أتعاب المطور (من الإيرادات)
  developerFeeDesign: 0.01, // 1% تصاميم
  developerFeeOffplan: 0.01, // 1% أوف بلان
  developerFeeSupervision: 0.03, // 3% إشراف

  // التسويق (من الإيرادات)
  marketingTotal: 0.02, // 2% إجمالي
  marketingOffplanShare: 0.25, // 25% من التسويق في مرحلة أوف بلان
  marketingConstructionShare: 0.75, // 75% من التسويق في مرحلة الإنشاء

  // عمولة المبيعات
  salesCommission: 0.05, // 5% أوف بلان
  salesCommissionPostCompletion: 0.02, // 2% بيع بعد الإنجاز

  // تقسيم الإنشاء (مستثمر / ضمان)
  constructionInvestorShare: 0.30, // 30% من المستثمر
  constructionEscrowShare: 0.70, // 70% من الضمان

  // تقسيم رسوم الجهات الحكومية
  govFeesInvestorShare: 0.10, // 10% مستثمر
  govFeesEscrowShare: 0.90, // 90% ضمان

  // الإنشاء
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

// حساب التسعير — يأخذ الوحدات الفعلية (قد تكون معدّلة من المستخدم)
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

// حساب خطة رأس مال المستثمر
export function calculateInvestorCapitalPlan(
  projectFormulas: ReturnType<typeof calculateProjectFormulas>,
  pricingFormulas: ReturnType<typeof calculatePricingFormulas>,
  inputs = PROJECT_INPUTS,
  rates = RATES
) {
  const { landPrice, landRegistration, landBroker, constructionCost } = projectFormulas;
  const { totalRevenue, totalUnits } = pricingFormulas;

  return {
    // القسم 1: الأرض
    land: {
      landPrice,
      landBroker,
      landRegistration,
      subtotal: landPrice + landBroker + landRegistration,
    },
    // القسم 2: التصاميم
    design: {
      govFees: inputs.govFeesTotal * rates.govFeesInvestorShare,
      soilTest: inputs.soilTest,
      topography: inputs.topography,
      designFee: constructionCost * rates.designFee,
      developerFeeDesign: totalRevenue * rates.developerFeeDesign,
    },
    // القسم 3: ريرا وأوف بلان
    offplan: {
      developerFeeOffplan: totalRevenue * rates.developerFeeOffplan,
      sortingFee: projectFormulas.gfaTotal * rates.sortingFeePerSqft,
      reraProjectReg: inputs.reraProjectReg,
      reraUnits: totalUnits * rates.reraUnitFee,
      nocSale: inputs.nocSale,
      escrowAccountFee: inputs.escrowAccountFee,
      communityFee: inputs.communityFee * rates.communityOffplanShare,
      marketingOffplan: totalRevenue * rates.marketingTotal * rates.marketingOffplanShare,
      escrowDeposit: constructionCost * rates.escrowDeposit,
    },
    // القسم 4: الإنشاء
    construction: {
      advancePayment: constructionCost * rates.advancePayment,
      contingency: constructionCost * rates.contingency,
      bankFees: inputs.bankFees,
      govFeesEscrow: inputs.govFeesTotal * rates.govFeesEscrowShare,
      contractorPaymentsEscrow: constructionCost * rates.constructionEscrowShare,
      communityFee: inputs.communityFee * rates.communityConstructionShare,
      developerFeeSupervision: totalRevenue * rates.developerFeeSupervision,
      supervisionFeeEscrow: constructionCost * rates.supervisionFee,
      surveyorFeeEscrow: inputs.surveyorFee,
      reraAuditorEscrow: inputs.reraAuditorReport,
      reraInspectionEscrow: inputs.reraInspection,
      marketingConstruction: totalRevenue * rates.marketingTotal * rates.marketingConstructionShare,
      salesCommissionEscrow: totalRevenue * rates.salesCommission,
    },
  };
}
