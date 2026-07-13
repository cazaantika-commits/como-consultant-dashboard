/**
 * Financial Engine v2 — المحرك المالي الجديد
 * 
 * ملف واحد نظيف يحتوي على كل الحسابات المالية كدوال نقية (pure functions).
 * لا يستدعي قاعدة البيانات — يأخذ مدخلات ويرجع مخرجات.
 * 
 * المبدأ: أي تغيير في المدخلات ينعكس تلقائياً في كل المخرجات.
 * أولوية المصادر: costsCashFlow > بطاقة المشروع > القيمة الافتراضية
 */

// ═══════════════════════════════════════════════════════════════
// الأنواع (Types)
// ═══════════════════════════════════════════════════════════════

export type FinancingScenario = "offplan_escrow" | "offplan_construction" | "no_offplan";
export type PricingScenario = "optimistic" | "base" | "conservative";
export type FeeMethod = "percentage" | "lump_sum" | "monthly_rate";

export interface ProjectInputs {
  // === الأرض ===
  landPrice: number;
  agentCommissionLandPct: number;

  // === البناء ===
  buaSqft: number;
  constructionPricePerSqft: number;

  // === المساحات ===
  gfaResidentialSqft: number;
  gfaRetailSqft: number;
  gfaOfficesSqft: number;
  saleableResidentialPct: number; // 0-100
  saleableRetailPct: number;     // 0-100
  saleableOfficesPct: number;    // 0-100

  // === الرسوم الثابتة ===
  soilTestFee: number;
  topographicSurveyFee: number;
  officialBodiesFees: number;
  reraProjectRegFee: number;
  developerNocFee: number;
  escrowAccountFee: number;
  bankFees: number;
  surveyorFees: number;
  reraAuditReportFee: number;

  // === الرسوم المحسوبة (مدخلات) ===
  reraUnitFeePerUnit: number;       // 800 درهم/وحدة (افتراضي)
  totalUnits: number;               // عدد الوحدات
  communityFeeRate: number;         // 1 أو 0.5 درهم/قدم²
  reraInspectionFeePerVisit: number; // 15,000 درهم/زيارة

  // === النسب ===
  designFeePct: number;       // 0-100
  supervisionFeePct: number;  // 0-100
  separationFeePerSqft: number; // 40 درهم/قدم²
  salesCommissionPct: number; // 0-100
  marketingPct: number;       // 0-100
  developerFeePct: number;    // 0-100

  // === طريقة حساب الأتعاب ===
  designFeeMethod: FeeMethod;
  designFeeLumpSum?: number;
  designFeeMonthlyRate?: number;
  supervisionFeeMethod: FeeMethod;
  supervisionFeeLumpSum?: number;
  supervisionFeeMonthlyRate?: number;

  // === المدد الزمنية ===
  designMonths: number;
  offplanMonths: number;  // دائماً 2
  constructionMonths: number;
  handoverMonths: number;

  // === السيناريو ===
  financingScenario: FinancingScenario;
  pricingScenario: PricingScenario;

  // === الإيرادات ===
  approvedRevenue?: number; // إذا اعتمد المستخدم رقماً محدداً
  calculatedRevenue?: number; // محسوب من التسعير (يُمرر من الخارج)

  // === تاريخ البدء ===
  startDate: string; // "2026-04"
}

export interface CostBreakdown {
  // === تكاليف الأرض ===
  landPrice: number;
  agentCommissionLand: number;
  landRegistration: number;

  // === تكاليف ما قبل الإنشاء ===
  soilTestFee: number;
  topographicSurveyFee: number;
  officialBodiesFees: number;
  designFee: number;
  supervisionFee: number;

  // === تكاليف الإنشاء ===
  constructionCost: number;
  separationFee: number;
  contingencies: number;

  // === رسوم تنظيمية ===
  reraUnitRegFee: number;
  reraProjectRegFee: number;
  developerNocFee: number;
  escrowAccountFee: number;
  bankFees: number;
  surveyorFees: number;
  reraAuditReportFee: number;
  reraInspectionReportFee: number;
  communityFees: number;

  // === تكاليف مرتبطة بالإيرادات ===
  developerFee: number;
  salesCommission: number;
  marketingCost: number;

  // === المجاميع ===
  totalCosts: number;
  totalRevenue: number;
  grossProfit: number;
  grossProfitMargin: number; // 0-100
}

export interface PhaseTimeline {
  designStart: number;
  designEnd: number;
  offplanStart: number;
  offplanEnd: number;
  constructionStart: number;
  constructionEnd: number;
  handoverStart: number;
  handoverEnd: number;
  totalMonths: number;
}

export interface MonthlyItem {
  month: number;
  amount: number;
}

export interface CashFlowItem {
  id: string;
  name: string;
  total: number;
  table: "investor" | "escrow";
  monthly: MonthlyItem[];
}

export interface AbsorptionEntry {
  month: number;       // شهر من بداية الإنشاء
  salesPct: number;    // نسبة المبيعات (0-100)
}

export interface EscrowRevenue {
  monthly: MonthlyItem[];
  totalDeposited: number;
}

export interface Settlement {
  totalDeposited: number;
  totalExpenses: number;
  netSurplus: number;
  retentionAmount: number;      // 5% حجز ضمان العيوب
  releasedAtHandover: number;
  releasedAfter12Months: number;
}

export interface FinancialResult {
  costs: CostBreakdown;
  timeline: PhaseTimeline;
  investorCashFlow: CashFlowItem[];
  escrowCashFlow: CashFlowItem[];
  escrowRevenue: EscrowRevenue;
  settlement: Settlement;
  investorMonthlyTotal: MonthlyItem[];
  escrowMonthlyTotal: MonthlyItem[];
  capitalRequired: number; // إجمالي رأس المال المطلوب من المستثمر
}

// ═══════════════════════════════════════════════════════════════
// الثوابت
// ═══════════════════════════════════════════════════════════════

export const DEFAULTS: Partial<ProjectInputs> = {
  agentCommissionLandPct: 0,
  designFeePct: 2,
  supervisionFeePct: 2,
  separationFeePerSqft: 40,
  salesCommissionPct: 5,
  marketingPct: 2,
  developerFeePct: 5,
  saleableResidentialPct: 95,
  saleableRetailPct: 97,
  saleableOfficesPct: 95,
  designMonths: 6,
  offplanMonths: 2,
  constructionMonths: 16,
  handoverMonths: 2,
  reraUnitFeePerUnit: 800,
  communityFeeRate: 1,
  reraInspectionFeePerVisit: 15000,
  designFeeMethod: "percentage",
  supervisionFeeMethod: "percentage",
};

export const DEFAULT_ABSORPTION: AbsorptionEntry[] = [
  { month: 1, salesPct: 5 },
  { month: 2, salesPct: 8 },
  { month: 3, salesPct: 15 },
  { month: 4, salesPct: 10 },
  { month: 5, salesPct: 12 },
  { month: 6, salesPct: 5 },
  { month: 7, salesPct: 5 },
  { month: 8, salesPct: 5 },
  { month: 9, salesPct: 5 },
  { month: 10, salesPct: 5 },
  { month: 11, salesPct: 5 },
];
// 20% بعد التسليم (100% كاش)
export const POST_HANDOVER_PCT = 20;

export const DESIGN_MILESTONES = [
  { month: 1, pct: 20, label: "توقيع العقد" },
  { month: 2, pct: 20, label: "إنهاء المفهوم التصميمي" },
  { month: 4, pct: 25, label: "التصميم التفصيلي" },
  { month: 5, pct: 20, label: "حزمة المناقصة" },
  { month: 6, pct: 15, label: "رخصة البناء" },
];

// S-Curve weights for construction progress payments (16 months default)
function generateSCurve(months: number): number[] {
  // Bell-shaped distribution: slow start, peak in middle, slow end
  const weights: number[] = [];
  const midpoint = months / 2;
  const sigma = months / 4;
  let total = 0;
  for (let i = 0; i < months; i++) {
    const x = i + 0.5;
    const w = Math.exp(-0.5 * Math.pow((x - midpoint) / sigma, 2));
    weights.push(w);
    total += w;
  }
  // Normalize to sum = 1
  return weights.map(w => w / total);
}

// ═══════════════════════════════════════════════════════════════
// الدوال الأساسية
// ═══════════════════════════════════════════════════════════════

/**
 * حساب المراحل الزمنية
 */
export function calculateTimeline(inputs: ProjectInputs): PhaseTimeline {
  const designStart = 1;
  const designEnd = designStart + inputs.designMonths - 1;
  const offplanStart = designStart + 2; // بعد شهرين من التصاميم
  const offplanEnd = offplanStart + inputs.offplanMonths - 1;
  const constructionStart = designEnd + 1;
  const constructionEnd = constructionStart + inputs.constructionMonths - 1;
  const handoverStart = constructionEnd + 1;
  const handoverEnd = handoverStart + inputs.handoverMonths - 1;
  const totalMonths = inputs.designMonths + inputs.constructionMonths + inputs.handoverMonths;

  return {
    designStart,
    designEnd,
    offplanStart,
    offplanEnd,
    constructionStart,
    constructionEnd,
    handoverStart,
    handoverEnd,
    totalMonths,
  };
}

/**
 * حساب التكاليف الأساسية
 */
export function calculateCosts(inputs: ProjectInputs): CostBreakdown {
  const constructionCost = inputs.buaSqft * inputs.constructionPricePerSqft;
  const totalGFA = inputs.gfaResidentialSqft + inputs.gfaRetailSqft + inputs.gfaOfficesSqft;

  // أتعاب التصميم (حسب الطريقة المختارة)
  let designFee: number;
  switch (inputs.designFeeMethod) {
    case "lump_sum":
      designFee = inputs.designFeeLumpSum || 0;
      break;
    case "monthly_rate":
      designFee = (inputs.designFeeMonthlyRate || 0) * inputs.designMonths;
      break;
    case "percentage":
    default:
      designFee = constructionCost * (inputs.designFeePct / 100);
      break;
  }

  // أتعاب الإشراف (حسب الطريقة المختارة)
  let supervisionFee: number;
  switch (inputs.supervisionFeeMethod) {
    case "lump_sum":
      supervisionFee = inputs.supervisionFeeLumpSum || 0;
      break;
    case "monthly_rate":
      supervisionFee = (inputs.supervisionFeeMonthlyRate || 0) * inputs.constructionMonths;
      break;
    case "percentage":
    default:
      supervisionFee = constructionCost * (inputs.supervisionFeePct / 100);
      break;
  }

  // الإيرادات
  const totalRevenue = inputs.approvedRevenue && inputs.approvedRevenue > 0
    ? inputs.approvedRevenue
    : (inputs.calculatedRevenue || 0);

  // أتعاب المطور حسب السيناريو
  let effectiveDeveloperFeePct = inputs.developerFeePct;
  if (inputs.financingScenario === "no_offplan") {
    effectiveDeveloperFeePct = Math.min(inputs.developerFeePct, 3); // O3 = 3% max
  }
  const developerFee = totalRevenue * (effectiveDeveloperFeePct / 100);

  // باقي التكاليف
  const agentCommissionLand = inputs.landPrice * (inputs.agentCommissionLandPct / 100);
  const landRegistration = inputs.landPrice * 0.04; // 4% DLD ثابت
  const separationFee = totalGFA * inputs.separationFeePerSqft;
  const contingencies = constructionCost * 0.02; // 2% ثابت
  const salesCommission = totalRevenue * (inputs.salesCommissionPct / 100);
  const marketingCost = totalRevenue * (inputs.marketingPct / 100);

  // رسوم ريرا المحسوبة
  const reraUnitRegFee = inputs.totalUnits * inputs.reraUnitFeePerUnit;
  const communityFees = totalGFA * inputs.communityFeeRate;

  // عدد زيارات الفحص = كل 3 أشهر من الإنشاء + زيارة بعد الإنجاز
  const inspectionVisits = Math.floor(inputs.constructionMonths / 3) + 1;
  const reraInspectionReportFee = inspectionVisits * inputs.reraInspectionFeePerVisit;

  // إجمالي التكاليف
  const totalCosts = inputs.landPrice + agentCommissionLand + landRegistration
    + inputs.soilTestFee + inputs.topographicSurveyFee + inputs.officialBodiesFees
    + designFee + supervisionFee + separationFee
    + constructionCost + communityFees + contingencies
    + developerFee + salesCommission + marketingCost
    + reraUnitRegFee + inputs.reraProjectRegFee + inputs.developerNocFee
    + inputs.escrowAccountFee + inputs.bankFees + inputs.surveyorFees
    + inputs.reraAuditReportFee + reraInspectionReportFee;

  const grossProfit = totalRevenue - totalCosts;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    landPrice: inputs.landPrice,
    agentCommissionLand,
    landRegistration,
    soilTestFee: inputs.soilTestFee,
    topographicSurveyFee: inputs.topographicSurveyFee,
    officialBodiesFees: inputs.officialBodiesFees,
    designFee,
    supervisionFee,
    constructionCost,
    separationFee,
    contingencies,
    reraUnitRegFee,
    reraProjectRegFee: inputs.reraProjectRegFee,
    developerNocFee: inputs.developerNocFee,
    escrowAccountFee: inputs.escrowAccountFee,
    bankFees: inputs.bankFees,
    surveyorFees: inputs.surveyorFees,
    reraAuditReportFee: inputs.reraAuditReportFee,
    reraInspectionReportFee,
    communityFees,
    developerFee,
    salesCommission,
    marketingCost,
    totalCosts,
    totalRevenue,
    grossProfit,
    grossProfitMargin,
  };
}

/**
 * توزيع أتعاب التصميم على المراحل (Milestones)
 */
export function distributeDesignFee(
  designFee: number,
  timeline: PhaseTimeline
): MonthlyItem[] {
  const result: MonthlyItem[] = [];
  for (const milestone of DESIGN_MILESTONES) {
    const month = timeline.designStart + milestone.month - 1;
    if (month <= timeline.designEnd) {
      result.push({ month, amount: designFee * (milestone.pct / 100) });
    }
  }
  return result;
}

/**
 * توزيع دفعات المقاول (S-Curve + mobilization + completion + retention)
 */
export function distributeContractorPayments(
  constructionCost: number,
  timeline: PhaseTimeline,
  scenario: FinancingScenario
): { investor: MonthlyItem[]; escrow: MonthlyItem[] } {
  const investor: MonthlyItem[] = [];
  const escrow: MonthlyItem[] = [];

  // 10% دفعة مقدمة (mobilization) — المستثمر
  investor.push({
    month: timeline.constructionStart,
    amount: constructionCost * 0.10,
  });

  // 80% S-Curve — من حساب الضمان
  const sCurveMonths = timeline.constructionEnd - timeline.constructionStart + 1;
  const sCurve = generateSCurve(sCurveMonths);
  const sCurveTotal = constructionCost * 0.80;
  for (let i = 0; i < sCurveMonths; i++) {
    escrow.push({
      month: timeline.constructionStart + i,
      amount: sCurveTotal * sCurve[i],
    });
  }

  // 5% بعد إنجاز البناء (completion) — من الضمان
  escrow.push({
    month: timeline.handoverStart,
    amount: constructionCost * 0.05,
  });

  // 5% بعد سنة (retention) — من الضمان
  escrow.push({
    month: timeline.handoverEnd + 12,
    amount: constructionCost * 0.05,
  });

  // إيداع الضمان (O1 فقط) أو دفعات 20% (O2)
  if (scenario === "offplan_escrow") {
    // 20% إيداع دفعة واحدة في شهر 2 أوف بلان
    investor.push({
      month: timeline.offplanStart + 1,
      amount: constructionCost * 0.20,
    });
  } else if (scenario === "offplan_construction") {
    // 20% على 3 أشهر أولى من الإنشاء
    const perMonth = (constructionCost * 0.20) / 3;
    for (let i = 0; i < 3; i++) {
      investor.push({
        month: timeline.constructionStart + i,
        amount: perMonth,
      });
    }
  }
  // O3: لا إيداع ولا دفعات 20%

  return { investor, escrow };
}

/**
 * توزيع أتعاب المطور حسب السيناريو
 */
export function distributeDeveloperFee(
  developerFee: number,
  timeline: PhaseTimeline,
  scenario: FinancingScenario
): MonthlyItem[] {
  const result: MonthlyItem[] = [];

  if (scenario === "no_offplan") {
    // O3: 40% تصاميم + 60% إنشاء
    const designPortion = developerFee * 0.40;
    const constructionPortion = developerFee * 0.60;
    const designDuration = timeline.designEnd - timeline.designStart + 1;
    const constructionDuration = timeline.constructionEnd - timeline.constructionStart + 1;

    for (let m = timeline.designStart; m <= timeline.designEnd; m++) {
      result.push({ month: m, amount: designPortion / designDuration });
    }
    for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
      result.push({ month: m, amount: constructionPortion / constructionDuration });
    }
  } else {
    // O1/O2: 20% تصاميم + 20% أوف بلان + 60% إنشاء
    const designPortion = developerFee * 0.20;
    const offplanPortion = developerFee * 0.20;
    const constructionPortion = developerFee * 0.60;
    const designDuration = timeline.designEnd - timeline.designStart + 1;
    const offplanDuration = timeline.offplanEnd - timeline.offplanStart + 1;
    const constructionDuration = timeline.constructionEnd - timeline.constructionStart + 1;

    for (let m = timeline.designStart; m <= timeline.designEnd; m++) {
      result.push({ month: m, amount: designPortion / designDuration });
    }
    for (let m = timeline.offplanStart; m <= timeline.offplanEnd; m++) {
      result.push({ month: m, amount: offplanPortion / offplanDuration });
    }
    for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
      result.push({ month: m, amount: constructionPortion / constructionDuration });
    }
  }

  return result;
}

/**
 * حساب إيرادات حساب الضمان (جدول الامتصاص)
 */
export function calculateEscrowRevenue(
  totalRevenue: number,
  timeline: PhaseTimeline,
  absorption?: AbsorptionEntry[]
): EscrowRevenue {
  const schedule = absorption || DEFAULT_ABSORPTION;
  const monthly: MonthlyItem[] = [];
  let totalDeposited = 0;

  // الوحدات المباعة خلال الإنشاء (80%)
  for (const entry of schedule) {
    const saleMonth = timeline.constructionStart + entry.month - 1;
    const unitRevenue = totalRevenue * (entry.salesPct / 100);

    // 10% حجز — فوراً
    const booking = unitRevenue * 0.10;
    monthly.push({ month: saleMonth, amount: booking });
    totalDeposited += booking;

    // 50% أقساط إنشاء — من الشهر التالي حتى قبل التسليم
    const installStart = saleMonth + 1;
    const installEnd = timeline.handoverStart - 1;
    const installMonths = installEnd - installStart + 1;
    if (installMonths > 0) {
      const installTotal = unitRevenue * 0.50;
      const perMonth = installTotal / installMonths;
      for (let m = installStart; m <= installEnd; m++) {
        monthly.push({ month: m, amount: perMonth });
        totalDeposited += perMonth;
      }
    }

    // 40% تسليم
    const handoverPayment = unitRevenue * 0.40;
    monthly.push({ month: timeline.handoverStart, amount: handoverPayment });
    totalDeposited += handoverPayment;
  }

  // 20% بعد التسليم (كاش)
  const postHandoverRevenue = totalRevenue * (POST_HANDOVER_PCT / 100);
  monthly.push({ month: timeline.handoverEnd + 1, amount: postHandoverRevenue });
  totalDeposited += postHandoverRevenue;

  // تجميع المبالغ حسب الشهر
  const aggregated = aggregateMonthly(monthly);

  return { monthly: aggregated, totalDeposited };
}

/**
 * بناء التدفق النقدي الكامل للمستثمر
 */
export function buildInvestorCashFlow(
  inputs: ProjectInputs,
  costs: CostBreakdown,
  timeline: PhaseTimeline
): CashFlowItem[] {
  const items: CashFlowItem[] = [];
  const scenario = inputs.financingScenario;

  // === الأرض (شهر 0 = قبل البدء، نعتبره شهر 1 لأغراض العرض) ===
  items.push({
    id: "land_cost",
    name: "سعر الأرض",
    total: costs.landPrice,
    table: "investor",
    monthly: [{ month: 0, amount: costs.landPrice }],
  });
  items.push({
    id: "land_broker",
    name: "عمولة وسيط الأرض",
    total: costs.agentCommissionLand,
    table: "investor",
    monthly: [{ month: 0, amount: costs.agentCommissionLand }],
  });
  items.push({
    id: "land_registration",
    name: "رسوم تسجيل الأرض (4%)",
    total: costs.landRegistration,
    table: "investor",
    monthly: [{ month: 0, amount: costs.landRegistration }],
  });

  // === التصاميم ===
  items.push({
    id: "soil_test",
    name: "فحص التربة",
    total: costs.soilTestFee,
    table: "investor",
    monthly: [{ month: timeline.designStart, amount: costs.soilTestFee }],
  });
  items.push({
    id: "survey",
    name: "المسح الطبوغرافي",
    total: costs.topographicSurveyFee,
    table: "investor",
    monthly: [{ month: timeline.designStart, amount: costs.topographicSurveyFee }],
  });
  items.push({
    id: "official_bodies_10pct",
    name: "رسوم الجهات الحكومية (10%)",
    total: costs.officialBodiesFees * 0.10,
    table: "investor",
    monthly: [{ month: timeline.designStart, amount: costs.officialBodiesFees * 0.10 }],
  });

  // أتعاب التصميم (milestones)
  items.push({
    id: "design_fee",
    name: "أتعاب الاستشاري — التصاميم",
    total: costs.designFee,
    table: "investor",
    monthly: distributeDesignFee(costs.designFee, timeline),
  });

  // أتعاب المطور
  items.push({
    id: "developer_fee",
    name: `أتعاب المطور (${scenario === "no_offplan" ? "3%" : "5%"})`,
    total: costs.developerFee,
    table: "investor",
    monthly: distributeDeveloperFee(costs.developerFee, timeline, scenario),
  });

  // === أوف بلان / إنشاء (حسب السيناريو) ===
  const regPhaseStart = scenario === "offplan_escrow"
    ? timeline.offplanStart
    : timeline.constructionStart + 2; // شهر 3 إنشاء

  if (scenario !== "no_offplan") {
    items.push({
      id: "fraz_fee",
      name: "رسوم الفرز",
      total: costs.separationFee,
      table: "investor",
      monthly: [{ month: regPhaseStart, amount: costs.separationFee }],
    });
    items.push({
      id: "rera_registration",
      name: "تسجيل بيع على الخارطة — ريرا",
      total: costs.reraProjectRegFee,
      table: "investor",
      monthly: [{ month: regPhaseStart, amount: costs.reraProjectRegFee }],
    });
    items.push({
      id: "rera_units",
      name: "تسجيل الوحدات — ريرا",
      total: costs.reraUnitRegFee,
      table: "investor",
      monthly: [{ month: regPhaseStart, amount: costs.reraUnitRegFee }],
    });
    items.push({
      id: "noc_fee",
      name: "رسوم NOC للبيع",
      total: costs.developerNocFee,
      table: "investor",
      monthly: [{ month: regPhaseStart, amount: costs.developerNocFee }],
    });
    items.push({
      id: "escrow_fee",
      name: "رسوم حساب الضمان",
      total: costs.escrowAccountFee,
      table: "investor",
      monthly: [{ month: regPhaseStart, amount: costs.escrowAccountFee }],
    });
  }

  // رسوم المجتمع
  const communityMonth = scenario === "offplan_escrow"
    ? timeline.offplanStart + 1
    : timeline.constructionStart + 3; // شهر 4 إنشاء
  items.push({
    id: "community_fee",
    name: "رسوم المجتمع",
    total: costs.communityFees,
    table: "investor",
    monthly: [{ month: communityMonth, amount: costs.communityFees }],
  });

  // دفعات المقاول (الجزء الخاص بالمستثمر)
  const contractorPayments = distributeContractorPayments(
    costs.constructionCost, timeline, scenario
  );
  items.push({
    id: "contractor_investor",
    name: "دفعات المقاول (من المستثمر)",
    total: contractorPayments.investor.reduce((s, i) => s + i.amount, 0),
    table: "investor",
    monthly: contractorPayments.investor,
  });

  // الاحتياطي (توزيع متساوي على الإنشاء)
  const conDuration = timeline.constructionEnd - timeline.constructionStart + 1;
  const contingencyMonthly: MonthlyItem[] = [];
  for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
    contingencyMonthly.push({ month: m, amount: costs.contingencies / conDuration });
  }
  items.push({
    id: "contingency",
    name: "احتياطي وطوارئ (2%)",
    total: costs.contingencies,
    table: "investor",
    monthly: contingencyMonthly,
  });

  // رسوم بنكية (إنشاء + تسليم)
  const bankDuration = conDuration + (timeline.handoverEnd - timeline.handoverStart + 1);
  const bankMonthly: MonthlyItem[] = [];
  for (let m = timeline.constructionStart; m <= timeline.handoverEnd; m++) {
    bankMonthly.push({ month: m, amount: costs.bankFees / bankDuration });
  }
  items.push({
    id: "bank_fees",
    name: "رسوم بنكية",
    total: costs.bankFees,
    table: "investor",
    monthly: bankMonthly,
  });

  // التسويق (25% أوف بلان + 75% إنشاء) — يُلغى في O3
  if (scenario !== "no_offplan") {
    const marketingMonthly: MonthlyItem[] = [];
    const offplanPortion = costs.marketingCost * 0.25;
    const constructionPortion = costs.marketingCost * 0.75;
    const offplanDuration = timeline.offplanEnd - timeline.offplanStart + 1;
    for (let m = timeline.offplanStart; m <= timeline.offplanEnd; m++) {
      marketingMonthly.push({ month: m, amount: offplanPortion / offplanDuration });
    }
    for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
      marketingMonthly.push({ month: m, amount: constructionPortion / conDuration });
    }
    items.push({
      id: "marketing",
      name: "التسويق والإعلان",
      total: costs.marketingCost,
      table: "investor",
      monthly: marketingMonthly,
    });
  }

  return items;
}

/**
 * بناء التدفق النقدي لحساب الضمان (المصروفات)
 */
export function buildEscrowCashFlow(
  inputs: ProjectInputs,
  costs: CostBreakdown,
  timeline: PhaseTimeline
): CashFlowItem[] {
  const items: CashFlowItem[] = [];
  const scenario = inputs.financingScenario;

  if (scenario === "no_offplan") {
    // O3: لا يوجد حساب ضمان
    return items;
  }

  const conDuration = timeline.constructionEnd - timeline.constructionStart + 1;

  // رسوم الجهات الحكومية (90% من الضمان)
  const govFromEscrow = costs.officialBodiesFees * 0.90;
  const govMonthly: MonthlyItem[] = [];
  for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
    govMonthly.push({ month: m, amount: govFromEscrow / conDuration });
  }
  items.push({
    id: "gov_fees_escrow",
    name: "رسوم الجهات الحكومية (90%)",
    total: govFromEscrow,
    table: "escrow",
    monthly: govMonthly,
  });

  // دفعات المقاول (من الضمان — S-Curve)
  const contractorPayments = distributeContractorPayments(
    costs.constructionCost, timeline, scenario
  );
  items.push({
    id: "contractor_escrow",
    name: "دفعات المقاول (من الضمان)",
    total: contractorPayments.escrow.reduce((s, i) => s + i.amount, 0),
    table: "escrow",
    monthly: contractorPayments.escrow,
  });

  // أتعاب الإشراف
  const supervisionMonthly: MonthlyItem[] = [];
  for (let m = timeline.constructionStart; m <= timeline.constructionEnd; m++) {
    supervisionMonthly.push({ month: m, amount: costs.supervisionFee / conDuration });
  }
  items.push({
    id: "supervision_fee",
    name: "أتعاب الاستشاري — الإشراف",
    total: costs.supervisionFee,
    table: "escrow",
    monthly: supervisionMonthly,
  });

  // عمولة وكيل المبيعات (5%) — مرتبطة بالمبيعات
  items.push({
    id: "sales_commission",
    name: "عمولة وكيل المبيعات",
    total: costs.salesCommission,
    table: "escrow",
    monthly: [], // سيُملأ لاحقاً بناءً على إيرادات الضمان
  });

  // رسوم المساح
  items.push({
    id: "surveyor_fees",
    name: "رسوم المساح",
    total: costs.surveyorFees,
    table: "escrow",
    monthly: [
      { month: timeline.constructionStart + 2, amount: costs.surveyorFees / 2 },
      { month: timeline.handoverStart, amount: costs.surveyorFees / 2 },
    ],
  });

  // تقارير تدقيق ريرا (كل 3 أشهر)
  const auditMonthly: MonthlyItem[] = [];
  const auditInterval = 3;
  for (let m = timeline.constructionStart + auditInterval - 1; m <= timeline.constructionEnd; m += auditInterval) {
    auditMonthly.push({ month: m, amount: 0 }); // placeholder
  }
  const actualAuditVisits = auditMonthly.length;
  const auditPerVisit = costs.reraAuditReportFee / Math.max(actualAuditVisits, 1);
  for (const entry of auditMonthly) {
    entry.amount = auditPerVisit;
  }
  const actualAuditTotal = auditPerVisit * actualAuditVisits;
  items.push({
    id: "rera_audit",
    name: "تقارير تدقيق ريرا",
    total: actualAuditTotal,
    table: "escrow",
    monthly: auditMonthly,
  });

  // تقارير فحص ريرا (كل 3 أشهر + بعد الإنجاز)
  const inspectionMonthly: MonthlyItem[] = [];
  for (let m = timeline.constructionStart + 3; m <= timeline.constructionEnd; m += 3) {
    inspectionMonthly.push({ month: m, amount: inputs.reraInspectionFeePerVisit });
  }
  inspectionMonthly.push({ month: timeline.handoverStart, amount: inputs.reraInspectionFeePerVisit });
  items.push({
    id: "rera_inspection",
    name: "تقارير فحص ريرا",
    total: costs.reraInspectionReportFee,
    table: "escrow",
    monthly: inspectionMonthly,
  });

  return items;
}

/**
 * حساب التسوية النهائية (قانون ريرا — المادة 14)
 */
export function calculateSettlement(
  escrowRevenue: EscrowRevenue,
  escrowExpenses: CashFlowItem[]
): Settlement {
  const totalDeposited = escrowRevenue.totalDeposited;
  const totalExpenses = escrowExpenses.reduce((sum, item) => sum + item.total, 0);
  const netSurplus = totalDeposited - totalExpenses;
  const retentionAmount = totalDeposited * 0.05; // 5% حجز ضمان العيوب
  const releasedAtHandover = netSurplus - retentionAmount;
  const releasedAfter12Months = retentionAmount;

  return {
    totalDeposited,
    totalExpenses,
    netSurplus,
    retentionAmount,
    releasedAtHandover,
    releasedAfter12Months,
  };
}

// ═══════════════════════════════════════════════════════════════
// الدالة الرئيسية — تجمع كل شيء
// ═══════════════════════════════════════════════════════════════

/**
 * حساب كل شيء من المدخلات — الدالة الرئيسية
 * 
 * استخدام:
 * ```ts
 * const result = computeFullFinancials(inputs);
 * // result.costs — التكاليف
 * // result.timeline — المراحل الزمنية
 * // result.investorCashFlow — تدفق المستثمر
 * // result.escrowCashFlow — تدفق الضمان
 * // result.settlement — التسوية
 * // result.capitalRequired — رأس المال المطلوب
 * ```
 */
export function computeFullFinancials(inputs: ProjectInputs): FinancialResult {
  // 1. المراحل الزمنية
  const timeline = calculateTimeline(inputs);

  // 2. التكاليف
  const costs = calculateCosts(inputs);

  // 3. تدفق المستثمر
  const investorCashFlow = buildInvestorCashFlow(inputs, costs, timeline);

  // 4. تدفق الضمان (مصروفات)
  const escrowCashFlow = buildEscrowCashFlow(inputs, costs, timeline);

  // 5. إيرادات الضمان
  const escrowRevenue = inputs.financingScenario === "no_offplan"
    ? { monthly: [], totalDeposited: 0 }
    : calculateEscrowRevenue(costs.totalRevenue, timeline);

  // 6. ربط عمولة المبيعات بالإيرادات
  const salesItem = escrowCashFlow.find(i => i.id === "sales_commission");
  if (salesItem && escrowRevenue.totalDeposited > 0) {
    salesItem.monthly = escrowRevenue.monthly.map(rev => ({
      month: rev.month,
      amount: (rev.amount / escrowRevenue.totalDeposited) * salesItem.total,
    }));
  }

  // 7. التسوية
  const settlement = calculateSettlement(escrowRevenue, escrowCashFlow);

  // 8. تجميع المجاميع الشهرية
  const investorMonthlyTotal = aggregateAllItems(investorCashFlow);
  const escrowMonthlyTotal = aggregateAllItems(escrowCashFlow);

  // 9. رأس المال المطلوب = مجموع كل ما يدفعه المستثمر
  const capitalRequired = investorCashFlow.reduce((sum, item) => sum + item.total, 0);

  return {
    costs,
    timeline,
    investorCashFlow,
    escrowCashFlow,
    escrowRevenue,
    settlement,
    investorMonthlyTotal,
    escrowMonthlyTotal,
    capitalRequired,
  };
}

// ═══════════════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════════════

/**
 * تجميع المبالغ الشهرية (دمج نفس الشهر)
 */
export function aggregateMonthly(items: MonthlyItem[]): MonthlyItem[] {
  const map = new Map<number, number>();
  for (const item of items) {
    map.set(item.month, (map.get(item.month) || 0) + item.amount);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([month, amount]) => ({ month, amount }));
}

/**
 * تجميع كل بنود التدفق في مجموع شهري واحد
 */
export function aggregateAllItems(items: CashFlowItem[]): MonthlyItem[] {
  const all: MonthlyItem[] = [];
  for (const item of items) {
    all.push(...item.monthly);
  }
  return aggregateMonthly(all);
}

/**
 * تحويل الشهر الرقمي إلى تاريخ فعلي
 */
export function monthToDate(startDate: string, monthNumber: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const date = new Date(year, month - 1 + monthNumber, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * تحويل بيانات المشروع الخام إلى ProjectInputs
 * (محوّل من بيانات قاعدة البيانات)
 */
export function projectToInputs(
  project: any,
  overrides?: any,
  totalUnits?: number,
  calculatedRevenue?: number
): ProjectInputs {
  const p = project;
  return {
    landPrice: parseFloat(p.landPrice || "0"),
    agentCommissionLandPct: parseFloat(p.agentCommissionLandPct || "0"),
    buaSqft: parseFloat(p.manualBuaSqft || "0"),
    constructionPricePerSqft: parseFloat(p.estimatedConstructionPricePerSqft || "0"),
    gfaResidentialSqft: parseFloat(p.gfaResidentialSqft || "0"),
    gfaRetailSqft: parseFloat(p.gfaRetailSqft || "0"),
    gfaOfficesSqft: parseFloat(p.gfaOfficesSqft || "0"),
    saleableResidentialPct: parseFloat(p.saleableResidentialPct ?? "95"),
    saleableRetailPct: parseFloat(p.saleableRetailPct ?? "97"),
    saleableOfficesPct: parseFloat(p.saleableOfficesPct ?? "95"),
    soilTestFee: parseFloat(p.soilTestFee || "0"),
    topographicSurveyFee: parseFloat(p.topographicSurveyFee || "0"),
    officialBodiesFees: parseFloat(p.officialBodiesFees || "0"),
    reraProjectRegFee: parseFloat(p.reraProjectRegFee || "0"),
    developerNocFee: parseFloat(p.developerNocFee || "0"),
    escrowAccountFee: parseFloat(p.escrowAccountFee || "0"),
    bankFees: parseFloat(p.bankFees || "0"),
    surveyorFees: parseFloat(p.surveyorFees || "0"),
    reraAuditReportFee: parseFloat(p.reraAuditReportFee || "0"),
    reraUnitFeePerUnit: overrides?.reraUnitFeePerUnit ?? 800,
    totalUnits: totalUnits || 0,
    communityFeeRate: overrides?.communityFeeRate ?? 1,
    reraInspectionFeePerVisit: overrides?.reraInspectionFeePerVisit ?? 15000,
    designFeePct: parseFloat(p.designFeePct ?? "2"),
    supervisionFeePct: parseFloat(p.supervisionFeePct ?? "2"),
    separationFeePerSqft: parseFloat(p.separationFeePerSqft ?? "40"),
    salesCommissionPct: parseFloat(p.salesCommissionPct ?? "5"),
    marketingPct: parseFloat(p.marketingPct ?? "2"),
    developerFeePct: parseFloat(p.developerFeePct ?? "5"),
    designFeeMethod: overrides?.designFeeMethod || "percentage",
    designFeeLumpSum: overrides?.designFeeLumpSum,
    designFeeMonthlyRate: overrides?.designFeeMonthlyRate,
    supervisionFeeMethod: overrides?.supervisionFeeMethod || "percentage",
    supervisionFeeLumpSum: overrides?.supervisionFeeLumpSum,
    supervisionFeeMonthlyRate: overrides?.supervisionFeeMonthlyRate,
    designMonths: parseInt(p.preConMonths || "6"),
    offplanMonths: 2,
    constructionMonths: parseInt(p.constructionMonths || "16"),
    handoverMonths: parseInt(p.handoverMonths || "2"),
    financingScenario: (p.financingScenario || "offplan_escrow") as FinancingScenario,
    pricingScenario: (overrides?.pricingScenario || "base") as PricingScenario,
    approvedRevenue: overrides?.approvedRevenue ? parseFloat(overrides.approvedRevenue) : undefined,
    calculatedRevenue: calculatedRevenue,
    startDate: p.startDate || "2026-04",
  };
}
