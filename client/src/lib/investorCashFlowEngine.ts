/**
 * investorCashFlowEngine.ts
 * ═══════════════════════════════════════════
 * Shared computation engine for Investor Cash Flow Schedule.
 * Used by both InvestorCashFlowSchedulePage and ConsolidatedInvestorCashFlowPage
 * to guarantee identical numbers.
 * ═══════════════════════════════════════════
 */

import {
  PROJECT_INPUTS,
  RATES,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
export type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan" | "rental";
export type Funder = "investor" | "escrow" | "split";

export interface CostRow {
  label: string;
  totalCost: number;
  investorAmount: number;
  paid: number;
  unpaid: number;
  funder: Funder;
  section: string;
  designMonths: number[];
  constructionMonths: number[];
  postConstructionMonths: number[];
  isRevenue?: boolean;
  isTransfer?: boolean;
}

export interface TimingRules {
  developerFeePct: number;
  developerFeeRetentionPct: number;
  developerFeeDelayMonths: number;
  developerFeeRetentionMonth: number;
  sortingFeeMonth: number;
  sortingFeePerSqft: number;
  salesCommissionPct: number;
  salesCommissionTriggerPct: number;
  surveyorAsbuiltMonthFromEnd: number;
  // Configurable per-payment amounts from settings
  reraAuditorQuarterlyFee: number;
  reraInspectionQuarterlyFee: number;
  communityFeePerSqft: number;
  communityFeeFrequency: number;
}

export const DEFAULT_TIMING_RULES: TimingRules = {
  developerFeePct: 15,
  developerFeeRetentionPct: 15,
  developerFeeDelayMonths: 1,
  developerFeeRetentionMonth: 13,
  sortingFeeMonth: 1,
  sortingFeePerSqft: 40,
  salesCommissionPct: 5,
  salesCommissionTriggerPct: 20,
  surveyorAsbuiltMonthFromEnd: 1,
  reraAuditorQuarterlyFee: 3500,
  reraInspectionQuarterlyFee: 15020,
  communityFeePerSqft: 0.25,
  communityFeeFrequency: 6,
};

export interface SalesResult {
  escrowData: Array<{
    month: number;
    units: number;
    income: number;
    downPayment: number;
    installments: number;
    withdrawal: number;
    balance: number;
    cumulativeSold: number;
  }>;
  salesDistribution: number[];
  marketingMonthlyAmounts?: number[]; // Monthly marketing amounts from marketing page (indexed from project month 1)
  ppDownPct?: number; // Down payment percentage from payment plan
  paymentPlan?: {
    downPct: number;
    secondPct: number;
    secondAfterMonths: number;
    duringTotalPct: number;
    installmentEveryMonths: number;
    handoverPct: number;
  }; // Exact buyer payment schedule saved from Sales Plan
  actualCashInflow?: number[]; // Actual monthly cash inflow from payment plan (indexed from project month 1)
  offplanPct?: number; // Share of project revenue sold during construction and received through escrow
  directSalesStartMonth?: number; // Post-completion month for the first direct sale receipt
  directSalesInstallmentCount?: number; // Number of equal direct-sale receipts
}

export interface CashFlowResult {
  rows: CostRow[];
  sections: string[];
  grandTotalCost: number;
  grandInvestor: number;
  grandPaid: number;
  grandUnpaid: number;
  designMonthlyTotals: number[];
  constructionMonthlyTotals: number[];
  postMonthlyTotals: number[];
  revenuePostTotals: number[];
  cumulativeDesign: number[];
  cumulativeConstruction: number[];
  cumulativePost: number[];
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
  totalRevenue: number;
  monthDates: string[];
  startDate: string;
  usedSalesResult?: SalesResult;
}

// ═══════════════════════════════════════════
// DISTRIBUTION HELPERS
// ═══════════════════════════════════════════

/**
 * S-Curve distribution
 */
export function generateSCurve(months: number): number[] {
  const k = 6;
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-k * (t - 0.5)));
  const cumValues: number[] = [];
  for (let i = 0; i <= months; i++) {
    cumValues.push(sigmoid(i / months));
  }
  const raw: number[] = [];
  for (let i = 1; i <= months; i++) {
    raw.push(cumValues[i] - cumValues[i - 1]);
  }
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => v / sum);
}

/**
 * توزيع أتعاب التصاميم على المدة الفعلية
 * 7 مراحل: 10%, 15%, 20%, 35%, 10%, 5%, 5%
 */
export function distributeDesignFee(totalFee: number, months: number): number[] {
  const stages = [0.10, 0.15, 0.20, 0.35, 0.10, 0.05, 0.05];
  const result = new Array(months).fill(0);

  if (months >= 7) {
    const extraMonths = months - 6;
    result[0] = totalFee * stages[0];
    result[1] = totalFee * stages[1];
    result[2] = totalFee * stages[2];
    const detailedPerMonth = (totalFee * stages[3]) / extraMonths;
    for (let i = 3; i < 3 + extraMonths; i++) {
      result[i] = detailedPerMonth;
    }
    result[months - 3] += totalFee * stages[4];
    result[months - 2] += totalFee * stages[5];
    result[months - 1] += totalFee * stages[6];
  } else {
    for (let i = 0; i < months - 1 && i < stages.length; i++) {
      result[i] = totalFee * stages[i];
    }
    let remaining = 0;
    for (let i = months - 1; i < stages.length; i++) {
      remaining += stages[i];
    }
    result[months - 1] = totalFee * remaining;
  }

  return result;
}

/**
 * توزيع بالتساوي على عدد أشهر محدد
 */
export function distributeEqual(total: number, months: number, arr: number[], startIndex: number = 0) {
  const perMonth = total / months;
  for (let i = startIndex; i < startIndex + months && i < arr.length; i++) {
    arr[i] = perMonth;
  }
}

/**
 * توزيع رسوم المجتمع: كل 6 أشهر بدءاً من شهر 1
 */
export function distributeCommunityFee(
  total: number,
  designMonths: number,
  constructionMonths: number
): { design: number[]; construction: number[] } {
  const totalMonths = designMonths + constructionMonths;
  const paymentMonths: number[] = [];
  for (let m = 0; m < totalMonths; m += 6) {
    paymentMonths.push(m);
  }
  const paymentAmount = total / paymentMonths.length;

  const design = new Array(designMonths).fill(0);
  const construction = new Array(constructionMonths).fill(0);

  for (const m of paymentMonths) {
    if (m < designMonths) {
      design[m] = paymentAmount;
    } else {
      construction[m - designMonths] = paymentAmount;
    }
  }

  return { design, construction };
}

// ═══════════════════════════════════════════
// PRICING UNITS BUILDER
// ═══════════════════════════════════════════
const DEF_AREAS = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
const DEF_PRICES = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };

export function buildPricingUnits(project: any, inputs: ProjectInputs) {
  const p = project;
  const hasSavedCounts = [p.residential1brCount, p.residential2brCount, p.residential3brCount, p.retailSmallCount, p.retailMediumCount, p.retailLargeCount, p.officeSmallCount, p.officeMediumCount, p.officeLargeCount].some((v: any) => Number(v) > 0);
  let c1 = Number(p?.residential1brCount) || 0;
  let c2 = Number(p?.residential2brCount) || 0;
  let c3 = Number(p?.residential3brCount) || 0;
  let cRS = Number(p?.retailSmallCount) || 0;
  let cRM = Number(p?.retailMediumCount) || 0;
  let cRL = Number(p?.retailLargeCount) || 0;
  let cOS = Number(p?.officeSmallCount) || 0;
  let cOM = Number(p?.officeMediumCount) || 0;
  let cOL = Number(p?.officeLargeCount) || 0;
  if (!hasSavedCounts) {
    const sellRes = inputs.gfaResidential * inputs.efficiencyResidential;
    const sellRet = inputs.gfaRetail * inputs.efficiencyRetail;
    const sellOff = inputs.gfaOffice * inputs.efficiencyOffice;
    if (sellRes > 0) { c1 = Math.round(sellRes * 0.4 / DEF_AREAS.res1); c2 = Math.round(sellRes * 0.4 / DEF_AREAS.res2); c3 = Math.round(sellRes * 0.2 / DEF_AREAS.res3); }
    if (sellRet > 0) { cRS = Math.round(sellRet * 0.4 / DEF_AREAS.retS); cRM = Math.round(sellRet * 0.4 / DEF_AREAS.retM); cRL = Math.round(sellRet * 0.2 / DEF_AREAS.retL); }
    if (sellOff > 0) { cOS = Math.round(sellOff * 0.4 / DEF_AREAS.offS); cOM = Math.round(sellOff * 0.4 / DEF_AREAS.offM); cOL = Math.round(sellOff * 0.2 / DEF_AREAS.offL); }
  }
  return [
    { name: "غرفة وصالة", category: "residential" as const, area: Number(p?.residential1brArea) || DEF_AREAS.res1, price: Number(p?.residential1brPrice) || DEF_PRICES.res1, count: c1 },
    { name: "غرفتين وصالة", category: "residential" as const, area: Number(p?.residential2brArea) || DEF_AREAS.res2, price: Number(p?.residential2brPrice) || DEF_PRICES.res2, count: c2 },
    { name: "ثلاث غرف وصالة", category: "residential" as const, area: Number(p?.residential3brArea) || DEF_AREAS.res3, price: Number(p?.residential3brPrice) || DEF_PRICES.res3, count: c3 },
    { name: "تجزئة / صغير", category: "retail" as const, area: Number(p?.retailSmallArea) || DEF_AREAS.retS, price: Number(p?.retailSmallPrice) || DEF_PRICES.retS, count: cRS },
    { name: "تجزئة / متوسط", category: "retail" as const, area: Number(p?.retailMediumArea) || DEF_AREAS.retM, price: Number(p?.retailMediumPrice) || DEF_PRICES.retM, count: cRM },
    { name: "تجزئة / كبير", category: "retail" as const, area: Number(p?.retailLargeArea) || DEF_AREAS.retL, price: Number(p?.retailLargePrice) || DEF_PRICES.retL, count: cRL },
    { name: "مكاتب / صغير", category: "office" as const, area: Number(p?.officeSmallArea) || DEF_AREAS.offS, price: Number(p?.officeSmallPrice) || DEF_PRICES.offS, count: cOS },
    { name: "مكاتب / متوسط", category: "office" as const, area: Number(p?.officeMediumArea) || DEF_AREAS.offM, price: Number(p?.officeMediumPrice) || DEF_PRICES.offM, count: cOM },
    { name: "مكاتب / كبير", category: "office" as const, area: Number(p?.officeLargeArea) || DEF_AREAS.offL, price: Number(p?.officeLargePrice) || DEF_PRICES.offL, count: cOL },
  ];
}

// ═══════════════════════════════════════════
// MAIN COMPUTATION FUNCTION
// ═══════════════════════════════════════════

/**
 * Computes the full investor cash flow schedule for a given project and scenario.
 * This is the single source of truth used by both the individual investor page
 * and the consolidated page.
 *
 * @param projectData - The raw project record from DB (or null for defaults)
 * @param scenario - The financing scenario to compute
 * @returns CashFlowResult with all rows, totals, and monthly distributions
 */
export function computeInvestorCashFlow(projectData: any, scenario: Scenario, timingRules?: TimingRules, salesResult?: SalesResult): CashFlowResult {
  const tr = timingRules || DEFAULT_TIMING_RULES;
  const i: ProjectInputs = projectData ? dbProjectToInputs(projectData) : PROJECT_INPUTS;
  const r: ProjectRates = projectData ? dbProjectToRates(projectData) : RATES;
  const projectFormulas = calculateProjectFormulas(i, r);

  const pricingUnits = buildPricingUnits(projectData || {}, i);
  const pricingFormulas = calculatePricingFormulas(pricingUnits);
  const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

  const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
  const { totalRevenue, totalUnits } = pricingFormulas;
  const designDuration = i.designDuration;
  const constructionDuration = i.constructionDuration;
  const marketingPrepMonths = Number(projectData?.marketingPrepMonths) || 2;
  const reraLeadMonths = Number(projectData?.reraLeadMonths) || 2;
  const penultimateDesign = designDuration - 2;
  const penultimateConstruction = constructionDuration - 2;

  const isScenario2 = scenario === "offplan_construction";
  const isScenario3 = scenario === "no_offplan";
  const isScenario4 = scenario === "rental";

  // Post-construction months:
  // All scenarios: 13 months post-construction
  // Month 2: 5% completion payment to contractor
  // Month 13: 5% retention payment to contractor
  // S1/S2: also 12 months of 20% direct revenue
  // S3: revenue split in months 2-3
  const postDuration = 13;

  // Helper: empty month arrays
  const emptyDesign = () => new Array(designDuration).fill(0);
  const emptyConstruction = () => new Array(constructionDuration).fill(0);
  const emptyPost = () => new Array(postDuration).fill(0);

  // ─── Generate default salesResult when not provided or empty (for offplan scenarios) ───
  // This ensures commission distribution and revenue inflows work even without a saved V2WaelSales plan
  const hasValidSalesData = salesResult && salesResult.escrowData && salesResult.escrowData.length > 0 && salesResult.escrowData.some(e => e.income > 0);
  if (!hasValidSalesData && !isScenario3 && !isScenario4 && totalUnits > 0 && totalRevenue > 0) {
    const offPlanPct = 80; // default 80% offplan
    const offPlanUnits = Math.round(totalUnits * offPlanPct / 100);
    const salesStart = Math.max(1, designDuration); // sales start at first month of construction (1-indexed)
    const salesMonths = constructionDuration; // sales period = construction duration
    // Generate uniform sales distribution
    const unitsPerMonth = Math.floor(offPlanUnits / salesMonths);
    const remainderUnits = offPlanUnits - (unitsPerMonth * salesMonths);
    const defaultSalesDist: number[] = new Array(salesMonths).fill(unitsPerMonth);
    for (let rm = 0; rm < remainderUnits; rm++) defaultSalesDist[rm]++;
    // Compute escrowData (same logic as V2WaelSales)
    const avgUnitPrice = totalRevenue / totalUnits;
    const ppDownPct = 10; // default 10% down payment
    const ppHandoverPct = 40; // default 40% at handover
    const duringConstructionPct = 100 - ppDownPct - ppHandoverPct; // 50%
    const monthlyInstPerUnit = avgUnitPrice * (duringConstructionPct / 100) / (constructionDuration || 1);
    let cumSold = 0;
    const defaultEscrowData = defaultSalesDist.map((units, idx) => {
      const dpIncome = units * avgUnitPrice * (ppDownPct / 100);
      cumSold += units;
      const instIncome = cumSold * monthlyInstPerUnit;
      const totalIncome = dpIncome + instIncome;
      return {
        month: idx + salesStart, // 1-indexed absolute month
        units,
        income: totalIncome,
        downPayment: dpIncome,
        installments: instIncome,
        withdrawal: 0,
        balance: 0,
        cumulativeSold: cumSold,
      };
    });
    salesResult = {
      escrowData: defaultEscrowData,
      salesDistribution: defaultSalesDist,
      ppDownPct,
      // Preserve marketing data from original salesResult (saved from MarketingPage)
      marketingMonthlyAmounts: salesResult?.marketingMonthlyAmounts,
    };
  }

  // ═════════════════════════════════════════════
  // BUILD ROWS
  // ═════════════════════════════════════════════
  const rows: CostRow[] = [];

  // ─── الأرض (مدفوعة — لا توزيع) ───
  rows.push({
    label: "سعر الأرض",
    totalCost: landPrice,
    investorAmount: landPrice,
    paid: landPrice,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  rows.push({
    label: "رسوم تسجيل الأرض",
    totalCost: landRegistration,
    investorAmount: landRegistration,
    paid: landRegistration,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  rows.push({
    label: "عمولة وسيط الأرض",
    totalCost: landBroker,
    investorAmount: landBroker,
    paid: landBroker,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── أتعاب التصاميم (توزيع حسب المراحل) ───
  const designFeeDistribution = distributeDesignFee(costs.designFee, designDuration);
  rows.push({
    label: "أتعاب التصاميم",
    totalCost: costs.designFee,
    investorAmount: costs.designFee,
    paid: 0,
    unpaid: costs.designFee,
    funder: "investor",
    section: "التصاميم والإشراف",
    designMonths: designFeeDistribution,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // أتعاب الإشراف — تتبع نسبة الإنجاز (نفس توزيع المستخلصات)
  // Will be filled after construction section where monthlyProgressPcts is available
  // Placeholder: push later after construction progress is computed
  const supervisionFeeTotal = costs.supervisionFee;
  const supervisionFunder = (isScenario3 || isScenario4) ? "investor" : "escrow";
  const supervisionInvestorAmount = (isScenario3 || isScenario4) ? supervisionFeeTotal : 0;

  // ─── فحص التربة (شهر 2 تصاميم) ───
  const soilDesign = emptyDesign();
  soilDesign[1] = i.soilTest;
  rows.push({
    label: "فحص التربة",
    totalCost: i.soilTest,
    investorAmount: i.soilTest,
    paid: 0,
    unpaid: i.soilTest,
    funder: "investor",
    section: "الدراسات والمسوحات",
    designMonths: soilDesign,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── المسح الطبوغرافي (شهر 2 تصاميم) ───
  const topoDesign = emptyDesign();
  topoDesign[1] = i.topography;
  rows.push({
    label: "المسح الطبوغرافي",
    totalCost: i.topography,
    investorAmount: i.topography,
    paid: 0,
    unpaid: i.topography,
    funder: "investor",
    section: "الدراسات والمسوحات",
    designMonths: topoDesign,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم المساح DWG (مستثمر — شهر 1 من مرحلة تسجيل المشروع) ───
  const surveyorDwgDesign = emptyDesign();
  const surveyorDwgMonth = Math.max(0, designDuration - reraLeadMonths);
  surveyorDwgDesign[surveyorDwgMonth] = i.surveyorDwgFee;
  rows.push({
    label: "رسوم المساح (DWG)",
    totalCost: i.surveyorDwgFee,
    investorAmount: i.surveyorDwgFee,
    paid: 0,
    unpaid: i.surveyorDwgFee,
    funder: "investor",
    section: "الدراسات والمسوحات",
    designMonths: surveyorDwgDesign,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });
  // ─── رسوم المساح As-Built (ضمان — شهر قبل الأخير من الإنشاء) ───
  const surveyorAsbuiltConst = emptyConstruction();
  surveyorAsbuiltConst[penultimateConstruction] = i.surveyorFee;
  rows.push({
    label: "رسوم المساح (As-Built)",
    totalCost: i.surveyorFee,
    investorAmount: 0,
    paid: 0,
    unpaid: 0,
    funder: "escrow",
    section: "الدراسات والمسوحات",
    designMonths: emptyDesign(),
    constructionMonths: surveyorAsbuiltConst,
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم المجتمع (كل 6 أشهر من بدء التصاميم حتى الإنجاز) — GFA × المعدل لكل دفعة ───
  const communityFeePerPayment = (gfaTotal || 0) * tr.communityFeePerSqft;
  const communityTotalMonths = designDuration + constructionDuration;
  const communityPaymentMonths: number[] = [];
  for (let m = 0; m < communityTotalMonths; m += tr.communityFeeFrequency) {
    communityPaymentMonths.push(m);
  }
  const communityTotal = communityFeePerPayment * communityPaymentMonths.length;
  const communityDesign = new Array(designDuration).fill(0);
  const communityConstruction = new Array(constructionDuration).fill(0);
  for (const m of communityPaymentMonths) {
    if (m < designDuration) {
      communityDesign[m] = communityFeePerPayment;
    } else {
      communityConstruction[m - designDuration] = communityFeePerPayment;
    }
  }
  rows.push({
    label: "رسوم المجتمع",
    totalCost: communityTotal,
    investorAmount: communityTotal,
    paid: 0,
    unpaid: communityTotal,
    funder: "investor",
    section: "الرسوم الحكومية والتنظيمية",
    designMonths: communityDesign,
    constructionMonths: communityConstruction,
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم الجهات الحكومية ───
  if (isScenario3 || isScenario4) {
    const govConst = emptyConstruction();
    const half = i.govFeesTotal / 2;
    govConst[2] = half;
    govConst[7] = half;
    rows.push({
      label: "رسوم الجهات الحكومية",
      totalCost: i.govFeesTotal,
      investorAmount: i.govFeesTotal,
      paid: 0,
      unpaid: i.govFeesTotal,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: govConst,
      postConstructionMonths: emptyPost(),
    });
  } else {
    // Investor portion: 10% at completion of schematic design
    const govDesign = emptyDesign();
    govDesign[2] = costs.govFeesInvestor;
    rows.push({
      label: "رسوم الجهات الحكومية (10%)",
      totalCost: costs.govFeesInvestor,
      investorAmount: costs.govFeesInvestor,
      paid: 0,
      unpaid: costs.govFeesInvestor,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: govDesign,
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });

    // Escrow portion: 45% at 80% completion + 45% at 90% completion
    const govEscrowConst = emptyConstruction();
    const govEscrowPortion = i.govFeesTotal * r.govFeesEscrowShare; // 90% total
    const govEscrowHalf = govEscrowPortion / 2; // 45% each
    const month80pct = Math.max(0, Math.round(constructionDuration * 0.8) - 1);
    const month90pct = Math.max(0, Math.round(constructionDuration * 0.9) - 1);
    govEscrowConst[month80pct] = govEscrowHalf;
    govEscrowConst[month90pct] += govEscrowHalf;
    rows.push({
      label: "رسوم الجهات الحكومية (45%+45%)",
      totalCost: govEscrowPortion,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: govEscrowConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم الفرز ───
  {
    const sortingDesign = emptyDesign();
    const sortingConstruction = emptyConstruction();
    // Sorting happens at same time as RERA registration
    const sortingMonthInDesign = Math.max(0, designDuration - reraLeadMonths);
    if (isScenario3 || isScenario4) {
      sortingConstruction[penultimateConstruction] = costs.sortingFee;
    } else if (isScenario2) {
      sortingConstruction[reraLeadMonths] = costs.sortingFee;
    } else {
      sortingDesign[sortingMonthInDesign] = costs.sortingFee;
    }
    rows.push({
      label: "رسوم الفرز",
      totalCost: costs.sortingFee,
      investorAmount: costs.sortingFee,
      paid: 0,
      unpaid: costs.sortingFee,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: sortingDesign,
      constructionMonths: sortingConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم NOC ───
  {
    const nocDesign = emptyDesign();
    const nocConstruction = emptyConstruction();
    // NOC happens at same time as RERA registration
    const nocMonthInDesign = Math.max(0, designDuration - reraLeadMonths);
    if (isScenario3 || isScenario4) {
      nocConstruction[penultimateConstruction] = i.nocSale;
    } else if (isScenario2) {
      nocConstruction[reraLeadMonths] = i.nocSale;
    } else {
      nocDesign[nocMonthInDesign] = i.nocSale;
    }
    rows.push({
      label: "رسوم NOC المطور",
      totalCost: i.nocSale,
      investorAmount: i.nocSale,
      paid: 0,
      unpaid: i.nocSale,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: nocDesign,
      constructionMonths: nocConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── تسجيل المشروع — ريرا (س3 و س4: محذوف) ───
  if (!isScenario3 && !isScenario4) {
    const reraRegDesign = emptyDesign();
    const reraRegConstruction = emptyConstruction();
    // RERA registration happens at month 2 of RERA phase = (designDuration - reraLeadMonths + 1)
    const reraMonthInDesign = Math.min(designDuration - 1, Math.max(0, designDuration - reraLeadMonths + 1));
    if (isScenario2) {
      reraRegConstruction[Math.min(reraLeadMonths + 1, constructionDuration - 1)] = i.reraProjectReg;
    } else {
      reraRegDesign[reraMonthInDesign] = i.reraProjectReg;
    }
    rows.push({
      label: "تسجيل المشروع — ريرا",
      totalCost: i.reraProjectReg,
      investorAmount: i.reraProjectReg,
      paid: 0,
      unpaid: i.reraProjectReg,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: reraRegDesign,
      constructionMonths: reraRegConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── تسجيل الوحدات — ريرا ───
  {
    const reraUnitsDesign = emptyDesign();
    const reraUnitsConstruction = emptyConstruction();
    // RERA unit registration at month 2 of RERA phase = (designDuration - reraLeadMonths + 1)
    const reraMonthInDesign2 = Math.min(designDuration - 1, Math.max(0, designDuration - reraLeadMonths + 1));
    if (isScenario3 || isScenario4) {
      reraUnitsConstruction[penultimateConstruction] = costs.reraUnits;
    } else if (isScenario2) {
      reraUnitsConstruction[Math.min(reraLeadMonths + 1, constructionDuration - 1)] = costs.reraUnits;
    } else {
      reraUnitsDesign[reraMonthInDesign2] = costs.reraUnits;
    }
    rows.push({
      label: "تسجيل الوحدات — ريرا",
      totalCost: costs.reraUnits,
      investorAmount: costs.reraUnits,
      paid: 0,
      unpaid: costs.reraUnits,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: reraUnitsDesign,
      constructionMonths: reraUnitsConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── حساب الضمان (رسوم فتح) — س3 و س4: محذوف ───
  if (!isScenario3 && !isScenario4) {
    const escrowFeeDesign = emptyDesign();
    const escrowFeeConstruction = emptyConstruction();
    // Escrow account opens at month 2 of RERA phase (same as RERA registration)
    const escrowMonthInDesign = Math.min(designDuration - 1, Math.max(0, designDuration - reraLeadMonths + 1));
    if (isScenario2) {
      escrowFeeConstruction[Math.min(reraLeadMonths + 1, constructionDuration - 1)] = i.escrowAccountFee;
    } else {
      escrowFeeDesign[escrowMonthInDesign] = i.escrowAccountFee;
    }
    rows.push({
      label: "حساب الضمان (رسوم فتح)",
      totalCost: i.escrowAccountFee,
      investorAmount: i.escrowAccountFee,
      paid: 0,
      unpaid: i.escrowAccountFee,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: escrowFeeDesign,
      constructionMonths: escrowFeeConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم البنك — س3 و س4: محذوف ───
  if (!isScenario3 && !isScenario4) {
    const bankDesign = emptyDesign();
    const bankConstruction = emptyConstruction();
    // Bank fees distributed from month 2 of RERA phase until end of construction
    const bankStartInDesign = Math.min(designDuration - 1, Math.max(0, designDuration - reraLeadMonths + 1));
    const remainingDesignMonths = designDuration - bankStartInDesign;
    const totalBankMonths = remainingDesignMonths + constructionDuration;
    const bankPerMonth = i.bankFees / totalBankMonths;
    for (let m = bankStartInDesign; m < designDuration; m++) {
      bankDesign[m] = bankPerMonth;
    }
    for (let m = 0; m < constructionDuration; m++) {
      bankConstruction[m] = bankPerMonth;
    }
    rows.push({
      label: "رسوم البنك",
      totalCost: i.bankFees,
      investorAmount: i.bankFees,
      paid: 0,
      unpaid: i.bankFees,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: bankDesign,
      constructionMonths: bankConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

    // ─── تقرير مدقق ريرا (ربع سنوي من بداية الإنشاء) — س3 و س4: محذوف ───
  if (!isScenario3 && !isScenario4) {
    const auditorConst = emptyConstruction();
    // Per-payment amount from settings (default 3500 AED)
    const auditorPerPayment = tr.reraAuditorQuarterlyFee;
    const auditorPayments: number[] = [];
    for (let m = 0; m < constructionDuration; m += 3) {
      auditorPayments.push(m);
    }
    for (const m of auditorPayments) {
      auditorConst[m] = auditorPerPayment;
    }
    const auditorTotal = auditorPerPayment * auditorPayments.length;
    rows.push({
      label: "تقرير مدقق ريرا",
      totalCost: auditorTotal,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: auditorConst,
      postConstructionMonths: emptyPost(),
    });
  }
  // ─── فحص ريرا (ربع سنوي من بداية الإنشاء) — س٣ و س٤: محذوف ───
  if (!isScenario3 && !isScenario4) {
    const inspConst = emptyConstruction();
    // Per-payment amount from settings (default 15020 AED)
    const inspPerPayment = tr.reraInspectionQuarterlyFee;
    const inspPayments: number[] = [];
    for (let m = 0; m < constructionDuration; m += 3) {
      inspPayments.push(m);
    }
    for (const m of inspPayments) {
      inspConst[m] = inspPerPayment;
    }
    const inspTotal = inspPerPayment * inspPayments.length;
    rows.push({
      label: "فحص ريرا",
      totalCost: inspTotal,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: inspConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── عمولة المبيعات (نسبة العمولة × مبيعات كل شهر، تُصرف عند سداد المشتري 20%) ───
  if (!isScenario4) {
    const commDesign = emptyDesign();
    const commConst = emptyConstruction();
    const commPost = emptyPost();
    let commTotal = 0;

    if (salesResult && salesResult.escrowData.length > 0) {
      // A sales commission becomes payable only in the month where the buyer's
      // actual receipts for that unit batch reach the configured trigger.
      // The dates and percentages come from the exact Sales Plan payment schedule.
      const paymentPlan = salesResult.paymentPlan;
      const triggerPct = tr.salesCommissionTriggerPct; // 20%
      const commPct = r.salesCommission; // e.g. 0.05
      const avgUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
      const constructionEndMonth = designDuration + constructionDuration - 1;
      
      for (const entry of salesResult.escrowData) {
        if (entry.units <= 0) continue;
        const saleMonth = entry.month - 1; // convert from 1-indexed (V2WaelSales) to 0-indexed array position
        const commAmount = entry.units * avgUnitPrice * commPct; // commission = units sold × avg price × rate

        const receiptEvents: Array<{ month: number; pct: number }> = [];
        if (paymentPlan) {
          receiptEvents.push({ month: saleMonth, pct: paymentPlan.downPct });
          receiptEvents.push({ month: saleMonth + paymentPlan.secondAfterMonths, pct: paymentPlan.secondPct });

          const installmentMonths: number[] = [];
          const every = Math.max(1, paymentPlan.installmentEveryMonths);
          for (let month = saleMonth + every + paymentPlan.secondAfterMonths; month <= constructionEndMonth; month += every) {
            installmentMonths.push(month);
          }
          if (installmentMonths.length > 0) {
            const installmentPct = paymentPlan.duringTotalPct / installmentMonths.length;
            installmentMonths.forEach((month) => receiptEvents.push({ month, pct: installmentPct }));
          } else if (paymentPlan.duringTotalPct > 0) {
            receiptEvents.push({ month: constructionEndMonth, pct: paymentPlan.duringTotalPct });
          }
          receiptEvents.push({ month: constructionEndMonth, pct: paymentPlan.handoverPct });
        } else {
          // Legacy plans without paymentPlanJson retain a transparent fallback.
          receiptEvents.push({ month: saleMonth, pct: salesResult.ppDownPct || 10 });
        }

        let cumulativeReceiptsPct = 0;
        let paymentMonth: number | undefined;
        for (const event of receiptEvents.sort((a, b) => a.month - b.month)) {
          cumulativeReceiptsPct += event.pct;
          if (cumulativeReceiptsPct + 1e-9 >= triggerPct) {
            paymentMonth = event.month;
            break;
          }
        }
        if (paymentMonth === undefined) continue;
        
        // Place commission in the correct phase array
        if (paymentMonth < designDuration) {
          commDesign[paymentMonth] = (commDesign[paymentMonth] || 0) + commAmount;
        } else if (paymentMonth - designDuration < constructionDuration) {
          commConst[paymentMonth - designDuration] = (commConst[paymentMonth - designDuration] || 0) + commAmount;
        } else {
          const postIdx = paymentMonth - designDuration - constructionDuration;
          if (postIdx < commPost.length) {
            commPost[postIdx] = (commPost[postIdx] || 0) + commAmount;
          }
        }
        commTotal += commAmount;
      }
    } else {
      // Fallback: total commission at month 3 of construction
      commTotal = costs.salesCommission;
      const commMonth = Math.min(2, constructionDuration - 1);
      commConst[commMonth] = commTotal;
    }

    if (commTotal > 0) {
      rows.push({
        label: "عمولة المبيعات",
        totalCost: commTotal,
        investorAmount: 0,
        paid: 0,
        unpaid: 0,
        funder: "escrow",
        section: "المبيعات والتسويق",
        designMonths: commDesign,
        constructionMonths: commConst,
        postConstructionMonths: commPost,
      });
    }
  }

  // ─── التسويق (يُنسخ مباشرة من صفحة التسويق) ───
  {
    const marketingDesign = emptyDesign();
    const marketingConstruction = emptyConstruction();
    let marketingTotal = 0;

    if (salesResult?.marketingMonthlyAmounts && salesResult.marketingMonthlyAmounts.length > 0) {
      // Use the monthly amounts directly from marketing page
      // marketingMonthlyAmounts is indexed by project month (0 = month 1 of design)
      const amounts = salesResult.marketingMonthlyAmounts;
      for (let m = 0; m < amounts.length; m++) {
        if (amounts[m] && amounts[m] > 0) {
          if (m < designDuration) {
            marketingDesign[m] = amounts[m];
          } else if (m - designDuration < constructionDuration) {
            marketingConstruction[m - designDuration] = amounts[m];
          }
          marketingTotal += amounts[m];
        }
      }
    } else {
      // Fallback: use costs.marketing distributed equally over 12 months starting from marketingPrepMonths before construction
      marketingTotal = costs.marketing;
      if (marketingTotal > 0) {
        const marketingPerMonth = marketingTotal / 12;
        let placed = 0;
        const marketingStartInDesign = Math.max(0, designDuration - marketingPrepMonths);
        for (let idx = marketingStartInDesign; idx < designDuration && placed < 12; idx++) {
          marketingDesign[idx] = marketingPerMonth;
          placed++;
        }
        for (let idx = 0; idx < constructionDuration && placed < 12; idx++) {
          marketingConstruction[idx] = marketingPerMonth;
          placed++;
        }
      }
    }

    if (marketingTotal > 0) {
      rows.push({
        label: "التسويق",
        totalCost: marketingTotal,
        investorAmount: marketingTotal,
        paid: 0,
        unpaid: marketingTotal,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: marketingDesign,
        constructionMonths: marketingConstruction,
        postConstructionMonths: emptyPost(),
      });
    }
  }

  // ─── أتعاب المطور (40% تصميم + 60% إنشاء) ───
  {
    const devFeeDesign = emptyDesign();
    const devFeeConstruction = emptyConstruction();
    const totalDevFee = costs.developerFee;
    const devFeeDesignTotal = totalDevFee * 0.4;
    const devFeeConstructionTotal = totalDevFee * 0.6;
    distributeEqual(devFeeDesignTotal, designDuration, devFeeDesign, 0);
    distributeEqual(devFeeConstructionTotal, constructionDuration, devFeeConstruction, 0);
    rows.push({
      label: "أتعاب المطور",
      totalCost: totalDevFee,
      investorAmount: totalDevFee,
      paid: 0,
      unpaid: totalDevFee,
      funder: "investor",
      section: "أتعاب المطور",
      designMonths: devFeeDesign,
      constructionMonths: devFeeConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── الإنشاء (5 بنود مستقلة حسب الإعدادات) ───
  {
    // Parse monthly progress from constructionScheduleJson if available
    let monthlyProgressPcts: number[] | null = null;
    if (projectData?.constructionScheduleJson) {
      try {
        const schedule = JSON.parse(projectData.constructionScheduleJson);
        if (schedule.monthlyProgress && schedule.monthlyProgress.length === constructionDuration) {
          monthlyProgressPcts = schedule.monthlyProgress;
        }
      } catch {}
    }

    // 1. دفعة مقدمة المقاول (10%) — المستثمر — شهر 1 من الإنشاء
    const mobDesign = emptyDesign();
    const mobConst = emptyConstruction();
    const mobPost = emptyPost();
    const mobilizationAmount = constructionCost * r.advancePayment;
    mobConst[0] = mobilizationAmount;
    rows.push({
      label: "دفعة مقدمة المقاول (10%)",
      totalCost: mobilizationAmount,
      investorAmount: mobilizationAmount,
      paid: 0,
      unpaid: mobilizationAmount,
      funder: "investor",
      section: "الإنشاء",
      designMonths: mobDesign,
      constructionMonths: mobConst,
      postConstructionMonths: mobPost,
    });

    // 2. إيداع حساب الضمان (20%) — تحويل (ليس مصروف) — المستثمر يحوّل للضمان
    const depositDesign = emptyDesign();
    const depositConst = emptyConstruction();
    const depositPost = emptyPost();
    const escrowDepositAmount = constructionCost * r.escrowDeposit;
    // Escrow deposit happens at month 2 of RERA phase (same as RERA registration and escrow account opening)
    const escrowDepositMonth = Math.min(designDuration - 1, Math.max(0, designDuration - reraLeadMonths + 1));
    depositDesign[escrowDepositMonth] = escrowDepositAmount;
    rows.push({
      label: "إيداع حساب الضمان (20%)",
      totalCost: escrowDepositAmount,
      investorAmount: escrowDepositAmount,
      paid: 0,
      unpaid: escrowDepositAmount,
      funder: "investor",
      section: "الإنشاء",
      designMonths: depositDesign,
      constructionMonths: depositConst,
      postConstructionMonths: depositPost,
      isTransfer: true,
    });

    // 3. مستخلصات المقاول (80%) — الضمان — شهرياً حسب نسبة الإنجاز
    const progressDesign = emptyDesign();
    const progressConst = emptyConstruction();
    const progressPost = emptyPost();
    const progressTotal = constructionCost * 0.80;
    if (monthlyProgressPcts) {
      // Use actual progress percentages from ConstructionInputsPage
      const totalPct = monthlyProgressPcts.reduce((s, v) => s + v, 0);
      for (let m = 0; m < constructionDuration; m++) {
        const pct = monthlyProgressPcts[m] || 0;
        progressConst[m] = totalPct > 0 ? progressTotal * (pct / totalPct) : 0;
      }
    } else {
      // Fallback: S-Curve distribution
      const sCurveWeights = generateSCurve(constructionDuration);
      for (let m = 0; m < constructionDuration; m++) {
        progressConst[m] = progressTotal * sCurveWeights[m];
      }
    }
    rows.push({
      label: "مستخلصات المقاول (80%)",
      totalCost: progressTotal,
      investorAmount: 0,
      paid: 0,
      unpaid: progressTotal,
      funder: "escrow",
      section: "الإنشاء",
      designMonths: progressDesign,
      constructionMonths: progressConst,
      postConstructionMonths: progressPost,
    });

    // 4. ريتنشن المقاول الأولى (5%) — الضمان — شهر +2 بعد الإنجاز
    const ret1Design = emptyDesign();
    const ret1Const = emptyConstruction();
    const ret1Post = emptyPost();
    const retention1Amount = constructionCost * 0.05;
    ret1Post[1] = retention1Amount;
    rows.push({
      label: "ريتنشن المقاول الأولى (5%)",
      totalCost: retention1Amount,
      investorAmount: 0,
      paid: 0,
      unpaid: retention1Amount,
      funder: "escrow",
      section: "الإنشاء",
      designMonths: ret1Design,
      constructionMonths: ret1Const,
      postConstructionMonths: ret1Post,
    });

    // 5. ريتنشن أخيرة المقاول (5%) — المستثمر — شهر +13 بعد الإنجاز
    const ret2Design = emptyDesign();
    const ret2Const = emptyConstruction();
    const ret2Post = emptyPost();
    const retentionFinalAmount = constructionCost * 0.05;
    ret2Post[12] = retentionFinalAmount;
    rows.push({
      label: "ريتنشن أخيرة المقاول (5%)",
      totalCost: retentionFinalAmount,
      investorAmount: retentionFinalAmount,
      paid: 0,
      unpaid: retentionFinalAmount,
      funder: "investor",
      section: "الإنشاء",
      designMonths: ret2Design,
      constructionMonths: ret2Const,
      postConstructionMonths: ret2Post,
    });
  }

  // ─── أتعاب الإشراف — تتبع نسبة الإنجاز (نفس توزيع المستخلصات) ───
  {
    const supervisionConst = emptyConstruction();
    // Parse monthly progress (same logic as contractor payments)
    let supProgressPcts: number[] | null = null;
    if (projectData?.constructionScheduleJson) {
      try {
        const schedule = JSON.parse(projectData.constructionScheduleJson);
        if (schedule.monthlyProgress && schedule.monthlyProgress.length === constructionDuration) {
          supProgressPcts = schedule.monthlyProgress;
        }
      } catch {}
    }
    if (supProgressPcts) {
      const totalPct = supProgressPcts.reduce((s: number, v: number) => s + v, 0);
      for (let m = 0; m < constructionDuration; m++) {
        const pct = supProgressPcts[m] || 0;
        supervisionConst[m] = totalPct > 0 ? supervisionFeeTotal * (pct / totalPct) : 0;
      }
    } else {
      // Fallback: S-Curve distribution (same as contractor)
      const sCurveW = generateSCurve(constructionDuration);
      for (let m = 0; m < constructionDuration; m++) {
        supervisionConst[m] = supervisionFeeTotal * sCurveW[m];
      }
    }
    rows.push({
      label: "أتعاب الإشراف",
      totalCost: supervisionFeeTotal,
      investorAmount: supervisionInvestorAmount,
      paid: 0,
      unpaid: supervisionFeeTotal,
      funder: supervisionFunder as "investor" | "escrow",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: supervisionConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // Pre-compute revenue variables for S1/S2 (needed by profit share section)
  let directRevenue = 0;
  let escrowLiquidation = 0;
  let month13ToInvestor = 0;

  // ─── الإيرادات ───
  if (isScenario3) {
    const revenuePost = emptyPost();
    revenuePost[1] = totalRevenue / 2;
    revenuePost[2] = totalRevenue / 2;
    rows.push({
      label: "إيرادات المبيعات",
      totalCost: totalRevenue,
      investorAmount: totalRevenue,
      paid: 0,
      unpaid: totalRevenue,
      funder: "investor",
      section: "الإيرادات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: revenuePost,
      isRevenue: true,
    });
  } else if (!isScenario4) {
    // S1/S2: Revenue comes from sales
    // When salesResult is provided, use actual monthly income from escrowData
    // Otherwise fall back to the simplified 20%/80% split
    
    if (salesResult && salesResult.escrowData.length > 0) {
      // ─── إيرادات من خطة المبيعات الفعلية ───
      // Direct revenue to investor = down payments (20% of each sale)
      // These flow during sales months (design + construction period)
      const revenueDesign = emptyDesign();
      const revenueConstruction = emptyConstruction();
      const revenuePost = emptyPost();
      
      let totalDirectToInvestor = 0;
      for (const entry of salesResult.escrowData) {
        // entry.month is absolute month from project start (1-indexed)
        // entry.downPayment = amount paid directly by buyer at signing (goes to investor as advance)
        // For S1: down payment goes to escrow, but 20% of total revenue goes directly to investor
        // Actually in the escrow model: ALL buyer payments go to escrow account
        // Investor gets money back only at liquidation
        // So "direct revenue" in S1 = 0 during construction
        // Revenue comes back at liquidation (month 3 post) and retention (month 13 post)
      }
      
      // Buyer payments for units sold during construction go to escrow. The remaining
      // unsold share is sold after completion and is a direct investor credit, spread
      // over the project-specific post-completion receipt schedule.
      const totalSalesIncome = salesResult.escrowData.reduce((s, e) => s + e.income, 0);
      const offplanPct = Math.max(0, Math.min(100, salesResult.offplanPct ?? 80));
      directRevenue = totalRevenue * ((100 - offplanPct) / 100);
      const directRevenuePost = emptyPost();
      const directSalesStartMonth = Math.max(1, Math.min(postDuration, salesResult.directSalesStartMonth ?? 4));
      const directSalesInstallmentCount = Math.max(1, Math.min(postDuration - directSalesStartMonth + 1, salesResult.directSalesInstallmentCount ?? 6));
      const directRevenuePerMonth = directRevenue / directSalesInstallmentCount;
      for (let idx = directSalesStartMonth - 1; idx < directSalesStartMonth - 1 + directSalesInstallmentCount; idx++) {
        directRevenuePost[idx] = directRevenuePerMonth;
      }
      rows.push({
        label: `مبيعات مباشرة بعد الإنجاز (${100 - offplanPct}%)`,
        totalCost: directRevenue,
        investorAmount: directRevenue,
        paid: 0,
        unpaid: directRevenue,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: directRevenuePost,
        isRevenue: true,
      });
      const directSalesCommission = directRevenue * r.salesCommission;
      const directSalesCommissionPost = emptyPost();
      const directSalesCommissionPerMonth = directSalesCommission / directSalesInstallmentCount;
      for (let idx = directSalesStartMonth - 1; idx < directSalesStartMonth - 1 + directSalesInstallmentCount; idx++) {
        directSalesCommissionPost[idx] = directSalesCommissionPerMonth;
      }
      rows.push({
        label: "عمولة مبيعات مباشرة بعد الإنجاز",
        totalCost: directSalesCommission,
        investorAmount: directSalesCommission,
        paid: 0,
        unpaid: directSalesCommission,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: directSalesCommissionPost,
      });

      // ─── تصفية حساب الضمان (دفعة 1: شهر 3 بعد الإنجاز) ───
      const escrowRevenue = totalSalesIncome; // Total collected from buyers through escrow
      const revenueRetention = escrowRevenue * 0.05; // Retention applies only to receipts held in escrow
      const completionPayment = constructionCost * 0.05;
      const openingBalance = constructionCost * 0.20;
      const actualEscrowExpenses = (constructionCost * 0.80) + costs.supervisionFee +
        (i.govFeesTotal * r.govFeesEscrowShare) + costs.salesCommission +
        i.reraAuditorReport + i.reraInspection + i.surveyorFee;
      escrowLiquidation = openingBalance + escrowRevenue - actualEscrowExpenses - revenueRetention - completionPayment;
      const escrowLiqPost = emptyPost();
      escrowLiqPost[2] = escrowLiquidation; // شهر 3 (index 2)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 1)",
        totalCost: escrowLiquidation,
        investorAmount: escrowLiquidation,
        paid: 0,
        unpaid: escrowLiquidation,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowLiqPost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 2: شهر 13 بعد الإنجاز) ───
      const constructionRetention = constructionCost * 0.05;
      month13ToInvestor = revenueRetention - constructionRetention;
      const escrowRetPost = emptyPost();
      escrowRetPost[12] = month13ToInvestor; // شهر 13 (index 12)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 2 - صافي الاحتجاز)",
        totalCost: month13ToInvestor,
        investorAmount: month13ToInvestor,
        paid: 0,
        unpaid: month13ToInvestor,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowRetPost,
        isRevenue: true,
      });
    } else {
      // ─── Fallback: simplified revenue (no salesResult) ───
      directRevenue = totalRevenue * 0.20;
      const revenuePost = emptyPost();
      const perMonth = directRevenue / 6;
      for (let idx = 3; idx < 9; idx++) {
        revenuePost[idx] = perMonth;
      }
      rows.push({
        label: "إيرادات مباشرة (20%)",
        totalCost: directRevenue,
        investorAmount: directRevenue,
        paid: 0,
        unpaid: directRevenue,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: revenuePost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 1: شهر 3 بعد الإنجاز) ───
      const escrowRevenue = totalRevenue * 0.80;
      const revenueRetention = escrowRevenue * 0.05; // Retention applies only to receipts held in escrow
      const completionPayment = constructionCost * 0.05;
      const openingBalance = constructionCost * 0.20;
      const actualEscrowExpenses = (constructionCost * 0.80) + costs.supervisionFee +
        (i.govFeesTotal * r.govFeesEscrowShare) + costs.salesCommission +
        i.reraAuditorReport + i.reraInspection + i.surveyorFee;
      escrowLiquidation = openingBalance + escrowRevenue - actualEscrowExpenses - revenueRetention - completionPayment;
      const escrowLiqPost = emptyPost();
      escrowLiqPost[2] = escrowLiquidation; // شهر 3 (index 2)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 1)",
        totalCost: escrowLiquidation,
        investorAmount: escrowLiquidation,
        paid: 0,
        unpaid: escrowLiquidation,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowLiqPost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 2: شهر 13 بعد الإنجاز) ───
      const constructionRetention = constructionCost * 0.05;
      month13ToInvestor = revenueRetention - constructionRetention;
      const escrowRetPost = emptyPost();
      escrowRetPost[12] = month13ToInvestor; // شهر 13 (index 12)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 2 - صافي الاحتجاز)",
        totalCost: month13ToInvestor,
        investorAmount: month13ToInvestor,
        paid: 0,
        unpaid: month13ToInvestor,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowRetPost,
        isRevenue: true,
      });
    }
  }

  // ─── حصة المطور من الأرباح (15%) ───
  if (!isScenario3 && !isScenario4) {
    // رأس مال المستثمر = كل ما دفعه (مصاريف المستثمر + وديعة الضمان)
    const investorCapital = costs.totalInvestor;
    
    // الدفعة 1: الشهر 3 بعد الإنجاز
    // المستثمر يستلم: إيرادات مباشرة (20%) + تصفية الإسكرو
    const totalReceivedByLiq1 = directRevenue + escrowLiquidation;
    const surplus1 = Math.max(0, totalReceivedByLiq1 - investorCapital);
    const devProfitShare1 = surplus1 * (tr.developerFeePct / 100);
    const devProfitRetention1 = devProfitShare1 * (tr.developerFeeRetentionPct / 100);
    const devProfitPaid1 = devProfitShare1 - devProfitRetention1;
    
    // الدفعة 2: الشهر 13 بعد الإنجاز
    // المبلغ المحتجز يدخل — يُخصم منه retention المقاول — الباقي ربح
    const surplus2 = Math.max(0, month13ToInvestor);
    const devProfitShare2 = surplus2 * (tr.developerFeePct / 100);
    // يُضاف المحتجز من الدفعة الأولى
    const devProfitMonth13 = devProfitShare2 + devProfitRetention1;
    
    const devProfitPost = emptyPost();
    // تُصرف في نفس شهر التصفية
    devProfitPost[2] = devProfitPaid1; // شهر 3
    devProfitPost[12] = devProfitMonth13; // شهر 13
    
    const totalDevProfit = devProfitPaid1 + devProfitMonth13;
    rows.push({
      label: "حصة المطور من الأرباح (15%)",
      totalCost: totalDevProfit,
      investorAmount: totalDevProfit,
      paid: 0,
      unpaid: totalDevProfit,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: devProfitPost,
    });
  }

  // ═══════════════════════════════════════════
  // TOTALS
  // ═══════════════════════════════════════════
  const expenseRows = rows.filter(r => !r.isRevenue);
  const revenueRows = rows.filter(r => r.isRevenue);

  const grandTotalCost = (isScenario3 || isScenario4)
    ? expenseRows.reduce((s, r) => s + r.investorAmount, 0)
    : costs.totalCosts;
  const grandInvestor = (isScenario3 || isScenario4)
    ? expenseRows.reduce((s, r) => s + r.investorAmount, 0)
    : costs.totalInvestor;
  const grandPaid = expenseRows.reduce((s, r) => s + r.paid, 0);
  const grandUnpaid = grandInvestor - grandPaid;

  // Monthly totals (investor only, expenses)
  const designMonthlyTotals = new Array(designDuration).fill(0);
  const constructionMonthlyTotals = new Array(constructionDuration).fill(0);
  const postMonthlyTotals = new Array(postDuration).fill(0);
  for (const row of expenseRows) {
    if (row.funder === "escrow") continue;
    for (let idx = 0; idx < designDuration; idx++) designMonthlyTotals[idx] += row.designMonths[idx];
    for (let idx = 0; idx < constructionDuration; idx++) constructionMonthlyTotals[idx] += row.constructionMonths[idx];
    for (let idx = 0; idx < postDuration; idx++) postMonthlyTotals[idx] += row.postConstructionMonths[idx];
  }

  // Revenue monthly totals
  const revenuePostTotals = new Array(postDuration).fill(0);
  for (const row of revenueRows) {
    for (let idx = 0; idx < postDuration; idx++) revenuePostTotals[idx] += row.postConstructionMonths[idx];
  }

  // Cumulative (investor) — revenue reduces net withdrawals
  const cumulativeDesign = new Array(designDuration).fill(0);
  const cumulativeConstruction = new Array(constructionDuration).fill(0);
  const cumulativePost = new Array(postDuration).fill(0);
  let running = grandPaid;
  for (let idx = 0; idx < designDuration; idx++) {
    running += designMonthlyTotals[idx];
    cumulativeDesign[idx] = running;
  }
  for (let idx = 0; idx < constructionDuration; idx++) {
    running += constructionMonthlyTotals[idx];
    cumulativeConstruction[idx] = running;
  }
  for (let idx = 0; idx < postDuration; idx++) {
    running += postMonthlyTotals[idx] - revenuePostTotals[idx];
    cumulativePost[idx] = running;
  }

  // Sections
  const sections = isScenario4
    ? [
        "الأرض",
        "التصاميم والإشراف",
        "الدراسات والمسوحات",
        "الرسوم الحكومية والتنظيمية",
        "ريرا (التنظيم العقاري)",
        "أتعاب المطور",
        "الإنشاء",
      ]
    : [
        "الأرض",
        "التصاميم والإشراف",
        "الدراسات والمسوحات",
        "الرسوم الحكومية والتنظيمية",
        "ريرا (التنظيم العقاري)",
        "المبيعات والتسويق",
        "الإنشاء",
        "الإيرادات",
      ];

  // ─── حساب التواريخ الحقيقية ───
  const startDateStr = i.startDate || "2026-08";
  const monthDates: string[] = [];
  const totalMonthCount = designDuration + constructionDuration + postDuration;
  const [startY, startMo] = startDateStr.split("-").map(Number);
  for (let idx = 0; idx < totalMonthCount; idx++) {
    const absMonth = (startY * 12 + (startMo - 1)) + idx;
    const y = Math.floor(absMonth / 12);
    const m = (absMonth % 12) + 1;
    monthDates.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return {
    rows,
    sections,
    grandTotalCost,
    grandInvestor,
    grandPaid,
    grandUnpaid,
    designMonthlyTotals,
    constructionMonthlyTotals,
    postMonthlyTotals,
    revenuePostTotals,
    cumulativeDesign,
    cumulativeConstruction,
    cumulativePost,
    designDuration,
    constructionDuration,
    postDuration,
    totalRevenue,
    monthDates,
    startDate: startDateStr,
    usedSalesResult: salesResult,
  };
}
