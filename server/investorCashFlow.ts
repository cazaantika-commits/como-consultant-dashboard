/**
 * investorCashFlow.ts — Server-side mirror of ExcelCashFlowPage logic
 *
 * 4-Phase Structure:
 *  Phase 1: "land"         — المبالغ المدفوعة (الأرض) — fixed, already paid
 *  Phase 2: "design"       — التصاميم والموافقات — design + building permit
 *  Phase 3: "offplan"      — تسجيل أوف بلان — off-plan registration (2 months, starts ≥ month 3 of design)
 *  Phase 4: "construction" — الإنشاء — construction phase
 *  Phase 5: "handover"     — التسليم — handover (kept for surveyor/NOC split payments)
 *
 * Key rules:
 *  - offplan duration = always 2 months
 *  - offplan cannot start before month 3 of design phase
 *  - offplan cannot start after construction ends
 *  - In normal flow: offplan starts at design month 3, overlaps with design, both end together
 *  - Developer fee: 30% design, 10% offplan, 60% construction
 *  - Marketing: 25% offplan, 75% construction (of which 75% in first 4 months, 25% in next 6)
 *  - Contractor advance: month 1 of construction (NOT end of preCon)
 */

// ─── DEFAULT AREA FALLBACKS (from shared/feasibilityUtils) ───────────────────
const DEFAULT_AVG_AREAS: Record<string, { defaultArea: number }> = {
  residentialStudioPct: { defaultArea: 450 },
  residential1brPct: { defaultArea: 750 },
  residential2brPct: { defaultArea: 1100 },
  residential3brPct: { defaultArea: 1600 },
  retailSmallPct: { defaultArea: 300 },
  retailMediumPct: { defaultArea: 800 },
  retailLargePct: { defaultArea: 2000 },
  officeSmallPct: { defaultArea: 500 },
  officeMediumPct: { defaultArea: 1200 },
  officeLargePrice: { defaultArea: 3000 },
};

function getAvg(pctKey: string, avgVal: number | null | undefined): number {
  const v = Number(avgVal) || 0;
  if (v > 0) return v;
  const mapping = DEFAULT_AVG_AREAS[pctKey];
  return mapping ? mapping.defaultArea : 0;
}

// ─── PROJECT COSTS (mirrors projectCostsCalc.ts) ─────────────────────────────
export interface ProjectCosts {
  landPrice: number;
  agentCommissionLand: number;
  landRegistration: number;
  soilTestFee: number;
  topographicSurveyFee: number;
  officialBodiesFees: number;
  designFee: number;
  supervisionFee: number;
  separationFee: number;
  constructionCost: number;
  communityFees: number;
  contingencies: number;
  developerFee: number;
  salesCommission: number;
  marketingCost: number;
  reraUnitRegFee: number;
  reraProjectRegFee: number;
  developerNocFee: number;
  escrowAccountFee: number;
  bankFees: number;
  surveyorFees: number;
  reraAuditReportFee: number;
  reraInspectionReportFee: number;
  totalRevenue: number;
  totalCosts: number;
}

export function calculateProjectCosts(
  project: any,
  marketOverview: any,
  competitionPricing: any,
): ProjectCosts | null {
  if (!project) return null;
  const p = project;
  const mo = marketOverview;
  const cp = competitionPricing;
  const activeScenario = (cp?.activeScenario || "base") as "optimistic" | "base" | "conservative";

  const landPrice = parseFloat(p.landPrice || "0");
  const agentCommissionLandPct = parseFloat(p.agentCommissionLandPct || "0");
  const manualBuaSqft = parseFloat(p.manualBuaSqft || "0");
  const estimatedConstructionPricePerSqft = parseFloat(p.estimatedConstructionPricePerSqft || "0");
  const soilTestFee = parseFloat(p.soilTestFee || "0");
  const topographicSurveyFee = parseFloat(p.topographicSurveyFee || "0");
  const officialBodiesFees = parseFloat(p.officialBodiesFees || "0");
  const reraUnitRegFee = parseFloat(p.reraUnitRegFee || "0");
  const reraProjectRegFee = parseFloat(p.reraProjectRegFee || "0");
  const developerNocFee = parseFloat(p.developerNocFee || "0");
  const escrowAccountFee = parseFloat(p.escrowAccountFee || "0");
  const bankFees = parseFloat(p.bankFees || "0");
  const communityFees = parseFloat(p.communityFees || "0");
  const surveyorFees = parseFloat(p.surveyorFees || "0");
  const reraAuditReportFee = parseFloat(p.reraAuditReportFee || "0");
  const reraInspectionReportFee = parseFloat(p.reraInspectionReportFee || "0");
  const designFeePct = parseFloat(p.designFeePct ?? "2");
  const supervisionFeePct = parseFloat(p.supervisionFeePct ?? "2");
  const separationFeePerM2 = parseFloat(p.separationFeePerM2 ?? "40");
  const salesCommissionPct = parseFloat(p.salesCommissionPct ?? "5");
  const marketingPct = parseFloat(p.marketingPct ?? "2");
  const developerFeePct = parseFloat(p.developerFeePct ?? "5");

  const bua = manualBuaSqft;
  const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
  const saleableRes = gfaResSqft * 0.95;
  const saleableRet = gfaRetSqft * 0.97;
  const saleableOff = gfaOffSqft * 0.95;

  const getPrices = () => {
    if (!cp) return { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 };
    if (activeScenario === "optimistic") return {
      studioPrice: cp.optStudioPrice || 0, oneBrPrice: cp.opt1brPrice || 0, twoBrPrice: cp.opt2brPrice || 0, threeBrPrice: cp.opt3brPrice || 0,
      retailSmallPrice: cp.optRetailSmallPrice || 0, retailMediumPrice: cp.optRetailMediumPrice || 0, retailLargePrice: cp.optRetailLargePrice || 0,
      officeSmallPrice: cp.optOfficeSmallPrice || 0, officeMediumPrice: cp.optOfficeMediumPrice || 0, officeLargePrice: cp.optOfficeLargePrice || 0,
    };
    if (activeScenario === "conservative") return {
      studioPrice: cp.consStudioPrice || 0, oneBrPrice: cp.cons1brPrice || 0, twoBrPrice: cp.cons2brPrice || 0, threeBrPrice: cp.cons3brPrice || 0,
      retailSmallPrice: cp.consRetailSmallPrice || 0, retailMediumPrice: cp.consRetailMediumPrice || 0, retailLargePrice: cp.consRetailLargePrice || 0,
      officeSmallPrice: cp.consOfficeSmallPrice || 0, officeMediumPrice: cp.consOfficeMediumPrice || 0, officeLargePrice: cp.consOfficeLargePrice || 0,
    };
    return {
      studioPrice: cp.baseStudioPrice || 0, oneBrPrice: cp.base1brPrice || 0, twoBrPrice: cp.base2brPrice || 0, threeBrPrice: cp.base3brPrice || 0,
      retailSmallPrice: cp.baseRetailSmallPrice || 0, retailMediumPrice: cp.baseRetailMediumPrice || 0, retailLargePrice: cp.baseRetailLargePrice || 0,
      officeSmallPrice: cp.baseOfficeSmallPrice || 0, officeMediumPrice: cp.baseOfficeMediumPrice || 0, officeLargePrice: cp.baseOfficeLargePrice || 0,
    };
  };
  const prices = getPrices();

  const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
    const allocated = saleable * (pct / 100);
    const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
    return avgArea * pricePerSqft * units;
  };

  let revenueRes = 0, revenueRet = 0, revenueOff = 0;
  if (mo) {
    revenueRes += calcTypeRevenue(parseFloat(mo.residentialStudioPct || "0"), getAvg("residentialStudioPct", mo.residentialStudioAvgArea), prices.studioPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential1brPct || "0"), getAvg("residential1brPct", mo.residential1brAvgArea), prices.oneBrPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential2brPct || "0"), getAvg("residential2brPct", mo.residential2brAvgArea), prices.twoBrPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential3brPct || "0"), getAvg("residential3brPct", mo.residential3brAvgArea), prices.threeBrPrice, saleableRes);
    revenueRet += calcTypeRevenue(parseFloat(mo.retailSmallPct || "0"), getAvg("retailSmallPct", mo.retailSmallAvgArea), prices.retailSmallPrice, saleableRet);
    revenueRet += calcTypeRevenue(parseFloat(mo.retailMediumPct || "0"), getAvg("retailMediumPct", mo.retailMediumAvgArea), prices.retailMediumPrice, saleableRet);
    revenueRet += calcTypeRevenue(parseFloat(mo.retailLargePct || "0"), getAvg("retailLargePct", mo.retailLargeAvgArea), prices.retailLargePrice, saleableRet);
    revenueOff += calcTypeRevenue(parseFloat(mo.officeSmallPct || "0"), getAvg("officeSmallPct", mo.officeSmallAvgArea), prices.officeSmallPrice, saleableOff);
    revenueOff += calcTypeRevenue(parseFloat(mo.officeMediumPct || "0"), getAvg("officeMediumPct", mo.officeMediumAvgArea), prices.officeMediumPrice, saleableOff);
    revenueOff += calcTypeRevenue(parseFloat(mo.officeLargePct || "0"), getAvg("officeLargePct", mo.officeLargeAvgArea), prices.officeLargePrice, saleableOff);
  }
  const calculatedRevenue = revenueRes + revenueRet + revenueOff;
  // Use approvedRevenue if the user has explicitly approved a scenario, otherwise use calculated
  const approvedRev = cp?.approvedRevenue ? Number(cp.approvedRevenue) : 0;
  const totalRevenue = (approvedRev > 0) ? approvedRev : calculatedRevenue;

  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = constructionCost * (designFeePct / 100);
  const supervisionFee = constructionCost * (supervisionFeePct / 100);
  const totalGfaSqft = gfaResSqft + gfaRetSqft + gfaOffSqft;
  const separationFee = totalGfaSqft * separationFeePerM2;
  const contingencies = constructionCost * 0.02;
  const developerFee = totalRevenue * (developerFeePct / 100);
  const salesCommission = totalRevenue * (salesCommissionPct / 100);
  const marketingCost = totalRevenue * (marketingPct / 100);
  const totalRegulatory = reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;
  const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + communityFees + contingencies + developerFee + salesCommission + marketingCost + totalRegulatory;

  const revenueSource: "approved" | "calculated" = (approvedRev > 0) ? "approved" : "calculated";
  const scenarioLabel = activeScenario === "optimistic" ? "متفائل" : activeScenario === "conservative" ? "متحفظ" : "أساسي";

  return {
    landPrice, agentCommissionLand, landRegistration, soilTestFee, topographicSurveyFee,
    officialBodiesFees, designFee, supervisionFee, separationFee, constructionCost,
    communityFees, contingencies, developerFee, salesCommission, marketingCost,
    reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee, bankFees,
    surveyorFees, reraAuditReportFee, reraInspectionReportFee, totalRevenue, totalCosts,
    revenueSource, activeScenario, scenarioLabel, calculatedRevenue, approvedRevenue: approvedRev,
  };
}

// ─── PHASE TYPES (4-phase + handover) ───────────────────────────────────────
export type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

// Keep old type for backward compatibility with client-side code that still uses "preCon"
export type LegacyPhaseType = "land" | "preCon" | "construction" | "handover";

export interface PhaseConfig {
  type: PhaseType;
  duration: number;
  startMonth: number;
}

export interface PhaseDurations {
  design: number;
  offplan: number;       // always 2 months
  construction: number;
  handover: number;
}

// Legacy interface for backward compatibility
export interface LegacyPhaseDurations {
  preCon: number;
  construction: number;
  handover: number;
}

/**
 * Convert legacy 2-phase durations to new 4-phase durations.
 * design = preCon months, offplan = 2 (fixed), offplan overlaps with design.
 */
export function legacyToNewDurations(legacy: LegacyPhaseDurations): PhaseDurations {
  return {
    design: legacy.preCon,
    offplan: 2,
    construction: legacy.construction,
    handover: legacy.handover,
  };
}

/**
 * Calculate phase configs for the 4-phase structure.
 *
 * Scenario rules:
 *  - O1 (offplan_escrow): offplan starts at month 3 (overlaps with design from month 3)
 *    construction starts after design ends (offplan runs in parallel with design)
 *  - O2 (offplan_construction): offplan starts at month 1 of construction
 *    (offplan runs in parallel with construction start)
 *  - O3 (no_offplan): no offplan phase, construction starts after design
 *
 * offplanDelay: extra months to delay offplan start beyond its earliest possible start.
 */
export function calculatePhases(
  d: PhaseDurations,
  offplanDelay = 0,
  scenario: "offplan_escrow" | "offplan_construction" | "no_offplan" = "offplan_escrow"
): PhaseConfig[] {
  const designStart = 1;
  const designEnd = designStart + d.design - 1;

  let offplanStart: number;
  let offplanEnd: number;
  let constructionStart: number;

  if (scenario === "offplan_escrow") {
    // O1: offplan starts at month 3 (overlaps with design), construction starts after design ends
    offplanStart = 3 + offplanDelay;
    offplanEnd = offplanStart + d.offplan - 1;
    constructionStart = designEnd + 1; // construction starts right after design
  } else if (scenario === "offplan_construction") {
    // O2: construction starts after design, offplan starts at month 1 of construction
    constructionStart = designEnd + 1;
    offplanStart = constructionStart + offplanDelay;
    offplanEnd = offplanStart + d.offplan - 1;
  } else {
    // O3: no offplan, construction starts after design
    offplanStart = designEnd + 1;
    offplanEnd = offplanStart + d.offplan - 1;
    constructionStart = designEnd + 1;
  }

  const constructionEnd = constructionStart + d.construction - 1;
  const handoverStart = constructionEnd + 1;

  return [
    { type: "land", duration: 0, startMonth: 0 },
    { type: "design", duration: d.design, startMonth: designStart },
    { type: "offplan", duration: d.offplan, startMonth: offplanStart },
    { type: "construction", duration: d.construction, startMonth: constructionStart },
    { type: "handover", duration: d.handover, startMonth: handoverStart },
  ];
}

/**
 * Calculate total months for the project.
 * Since offplan can overlap with design, total = design + construction + handover
 * (offplan doesn't extend the timeline in normal flow)
 */
export function getTotalMonths(d: PhaseDurations): number {
  return d.design + d.offplan + d.construction + d.handover;
}

export function getPhaseMonthRange(phases: PhaseConfig[], phaseType: PhaseType): { start: number; end: number } {
  const phase = phases.find(p => p.type === phaseType);
  if (!phase || phase.duration === 0) return { start: 0, end: 0 };
  return { start: phase.startMonth, end: phase.startMonth + phase.duration - 1 };
}

// ─── EXPENSE ITEM ───────────────────────────────────────────────────────────
export interface ExpenseItem {
  id: string;
  name: string;
  total: number;
  behavior: "FIXED_ABSOLUTE" | "FIXED_RELATIVE" | "DISTRIBUTED" | "PERIODIC" | "SALES_LINKED" | "CUSTOM";
  phase: PhaseType;
  relativeMonth?: number;
  distributeAcross?: PhaseType[];
  splitRatio?: { phase: PhaseType; ratio: number }[];
  periodicInterval?: number;
  periodicAmount?: number;
  multiPayments?: { phase: PhaseType; relativeMonth: number; amount: number }[];
  /** Custom distribution for marketing: weighted months */
  customDistribution?: { phase: PhaseType; months: number; ratio: number }[];
  table: "investor" | "escrow";
}

// ─── GET INVESTOR EXPENSES (4-phase structure) ──────────────────────────────
// Includes ONLY items that appear in the رأس المال المطلوب table.
export type FinancingScenario = "offplan_escrow" | "offplan_construction" | "no_offplan";

export const SCENARIO_LABELS: Record<FinancingScenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20% من الإنشاء",
  no_offplan: "تطوير بدون بيع على الخارطة",
};

export function getInvestorExpenses(costs: ProjectCosts, scenario: FinancingScenario = "offplan_escrow"): ExpenseItem[] {
  const c = costs;
  const constructionCost = c.constructionCost;
  return [
    // ═══ المرحلة 1: الأرض (المبالغ المدفوعة) ═══
    { id: "land_cost", name: "سعر الأرض", total: c.landPrice, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },
    { id: "land_broker", name: "عمولة وسيط الأرض", total: c.agentCommissionLand, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },
    { id: "land_registration", name: "رسوم تسجيل الأرض (4%)", total: c.landRegistration, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },

    // ═══ المرحلة 2: التصاميم والموافقات ═══
    { id: "soil_test", name: "فحص التربة", total: c.soilTestFee, behavior: "FIXED_RELATIVE", phase: "design", relativeMonth: 1, table: "investor" },
    { id: "survey", name: "المسح الطبوغرافي", total: c.topographicSurveyFee, behavior: "FIXED_RELATIVE", phase: "design", relativeMonth: 1, table: "investor" },
    // أتعاب المطور: 30% تصاميم، 10% أوف بلان، 60% إنشاء
    {
      id: "developer_fee", name: "أتعاب المطور (5%)", total: c.developerFee, behavior: "DISTRIBUTED", phase: "design",
      splitRatio: [
        { phase: "design", ratio: 0.3 },
        { phase: "offplan", ratio: 0.1 },
        { phase: "construction", ratio: 0.6 },
      ],
      table: "investor",
    },
    // أتعاب الاستشاري — التصاميم: موزعة على مرحلة التصاميم فقط
    { id: "design_fee", name: "أتعاب الاستشاري — التصاميم (2%)", total: c.designFee, behavior: "DISTRIBUTED", phase: "design", distributeAcross: ["design"], table: "investor" },

    // ═══ المرحلة 3: تسجيل أوف بلان — يتغير حسب السيناريو ═══
    ...(scenario === "no_offplan" ? [
      { id: "fraz_fee", name: "رسوم الفرز (40 د/قدم²)", total: c.separationFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
    ] : scenario === "offplan_construction" ? [
      { id: "fraz_fee", name: "رسوم الفرز (40 د/قدم²)", total: c.separationFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
      { id: "rera_registration", name: "تسجيل بيع على الخارطة - ريرا", total: c.reraProjectRegFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
      { id: "rera_units", name: "تسجيل الوحدات - ريرا", total: c.reraUnitRegFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
      { id: "surveyor_fee", name: "رسوم المساح", total: c.surveyorFees, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const,
        multiPayments: [
          { phase: "construction" as const, relativeMonth: 3, amount: c.surveyorFees / 2 },
          { phase: "handover" as const, relativeMonth: 1, amount: c.surveyorFees / 2 },
        ], table: "investor" as const },
      { id: "noc_fee", name: "رسوم NOC للبيع", total: c.developerNocFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const,
        multiPayments: [
          { phase: "construction" as const, relativeMonth: 3, amount: c.developerNocFee * 0.45 },
          { phase: "handover" as const, relativeMonth: 1, amount: c.developerNocFee * 0.55 },
        ], table: "investor" as const },
      { id: "escrow_fee", name: "رسوم حساب الضمان", total: c.escrowAccountFee, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
      { id: "community_fee", name: "رسوم المجتمع", total: c.communityFees, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 4, table: "investor" as const },
    ] : [
      // السيناريو 1 (الاعتيادي): كل الرسوم في مرحلة الأوف بلان
      { id: "fraz_fee", name: "رسوم الفرز (40 د/قدم²)", total: c.separationFee, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 1, table: "investor" as const },
      { id: "rera_registration", name: "تسجيل بيع على الخارطة - ريرا", total: c.reraProjectRegFee, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 1, table: "investor" as const },
      { id: "rera_units", name: "تسجيل الوحدات - ريرا", total: c.reraUnitRegFee, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 1, table: "investor" as const },
      { id: "surveyor_fee", name: "رسوم المساح", total: c.surveyorFees, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const,
        multiPayments: [
          { phase: "offplan" as const, relativeMonth: 1, amount: c.surveyorFees / 2 },
          { phase: "handover" as const, relativeMonth: 1, amount: c.surveyorFees / 2 },
        ], table: "investor" as const },
      { id: "noc_fee", name: "رسوم NOC للبيع", total: c.developerNocFee, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const,
        multiPayments: [
          { phase: "offplan" as const, relativeMonth: 1, amount: c.developerNocFee * 0.45 },
          { phase: "handover" as const, relativeMonth: 1, amount: c.developerNocFee * 0.55 },
        ], table: "investor" as const },
      { id: "escrow_fee", name: "رسوم حساب الضمان", total: c.escrowAccountFee, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 1, table: "investor" as const },
      { id: "community_fee", name: "رسوم المجتمع", total: c.communityFees, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 2, table: "investor" as const },
    ]),

    // إيداع حساب الضمان أو دفعات المقاول — يتغير حسب السيناريو
    ...(scenario === "offplan_escrow" ? [
      { id: "escrow_deposit", name: "إيداع حساب الضمان (20%)", total: constructionCost * 0.20, behavior: "FIXED_RELATIVE" as const, phase: "offplan" as const, relativeMonth: 2, table: "investor" as const },
    ] : scenario === "offplan_construction" ? [
      { id: "contractor_20pct_m1", name: "دفعة إنجاز 20% للمقاول — شهر 1", total: constructionCost * 0.20 / 3, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 1, table: "investor" as const },
      { id: "contractor_20pct_m2", name: "دفعة إنجاز 20% للمقاول — شهر 2", total: constructionCost * 0.20 / 3, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 2, table: "investor" as const },
      { id: "contractor_20pct_m3", name: "دفعة إنجاز 20% للمقاول — شهر 3", total: constructionCost * 0.20 / 3, behavior: "FIXED_RELATIVE" as const, phase: "construction" as const, relativeMonth: 3, table: "investor" as const },
    ] : []),

    { id: "bank_fees_offplan", name: "رسوم بنكية", total: c.bankFees, behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction", "handover"], table: "investor" },

    // ═══ المرحلة 4: الإنشاء ═══
    { id: "contractor_advance", name: "دفعة مقدمة للمقاول (10%)", total: constructionCost * 0.10, behavior: "FIXED_RELATIVE", phase: "construction", relativeMonth: 1, table: "investor" },
    { id: "contingency", name: "احتياطي وطوارئ (2%)", total: c.contingencies, behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction"], table: "investor" },
    // التسويق والإعلان — يُلغى في السيناريو 3
    ...(scenario === "no_offplan" ? [] : [{
      id: "marketing", name: "التسويق والإعلان (2%)", total: c.marketingCost, behavior: "CUSTOM" as const, phase: "offplan" as const,
      customDistribution: [
        { phase: "offplan" as const, months: 2, ratio: 0.25 },
        { phase: "construction" as const, months: 4, ratio: 0.75 * 0.75 },
        { phase: "construction" as const, months: 6, ratio: 0.75 * 0.25 },
      ],
      table: "investor" as const,
    }]),

    // NOTE: The following are EXCLUDED (not in رأس المال المطلوب):
    // - officialBodiesFees (رسوم الجهات الحكومية) → paid from escrow
    // - supervisionFee (أتعاب الاستشاري — الإشراف) → paid from escrow
    // - salesCommission (عمولة وكيل المبيعات) → paid from sales revenue
    // - reraAuditReportFee, reraInspectionReportFee → paid from escrow
    // - 70% of constructionCost → paid from escrow
  ];
}

// ─── DISTRIBUTE EXPENSE ─────────────────────────────────────────────────────
export function distributeExpense(
  item: ExpenseItem,
  phases: PhaseConfig[],
  durations: PhaseDurations,
  totalMonths: number,
  shift = 0,
): Record<number, number> {
  const result: Record<number, number> = {};

  switch (item.behavior) {
    case "FIXED_ABSOLUTE": {
      result[0] = item.total;
      break;
    }
    case "FIXED_RELATIVE": {
      if (item.multiPayments) {
        for (const payment of item.multiPayments) {
          const range = getPhaseMonthRange(phases, payment.phase);
          if (range.start === 0 && range.end === 0) continue;
          let month: number;
          if (payment.relativeMonth < 0) {
            month = range.end + payment.relativeMonth + 1;
          } else {
            month = range.start + payment.relativeMonth - 1;
          }
          month += shift;
          if (month >= 0 && month <= totalMonths + 10) { // allow overflow for shifted offplan
            result[month] = (result[month] || 0) + payment.amount;
          }
        }
      } else {
        const range = getPhaseMonthRange(phases, item.phase);
        if (range.start === 0 && range.end === 0) break;
        let month: number;
        if ((item.relativeMonth || 1) < 0) {
          month = range.end + (item.relativeMonth || -1) + 1;
        } else {
          month = range.start + (item.relativeMonth || 1) - 1;
        }
        month += shift;
        if (month >= 0 && month <= totalMonths + 10) {
          result[month] = item.total;
        }
      }
      break;
    }
    case "DISTRIBUTED": {
      if (item.splitRatio) {
        for (const split of item.splitRatio) {
          const range = getPhaseMonthRange(phases, split.phase);
          if (range.start === 0 && range.end === 0) continue;
          const phaseConfig = phases.find(p => p.type === split.phase);
          if (!phaseConfig || phaseConfig.duration === 0) continue;
          const splitTotal = item.total * split.ratio;
          const monthly = splitTotal / phaseConfig.duration;
          for (let m = range.start; m <= range.end; m++) {
            const shifted = m + shift;
            if (shifted >= 1 && shifted <= totalMonths + 10) {
              result[shifted] = (result[shifted] || 0) + monthly;
            }
          }
        }
      } else if (item.distributeAcross) {
        let totalDuration = 0;
        for (const pt of item.distributeAcross) {
          const phaseConfig = phases.find(p => p.type === pt);
          if (phaseConfig) totalDuration += phaseConfig.duration;
        }
        if (totalDuration === 0) break;
        const monthly = item.total / totalDuration;
        for (const pt of item.distributeAcross) {
          const range = getPhaseMonthRange(phases, pt);
          for (let m = range.start; m <= range.end; m++) {
            const shifted = m + shift;
            if (shifted >= 1 && shifted <= totalMonths + 10) {
              result[shifted] = (result[shifted] || 0) + monthly;
            }
          }
        }
      } else {
        const range = getPhaseMonthRange(phases, item.phase);
        const phaseConfig = phases.find(p => p.type === item.phase);
        if (!phaseConfig || phaseConfig.duration === 0) break;
        const monthly = item.total / phaseConfig.duration;
        for (let m = range.start; m <= range.end; m++) {
          const shifted = m + shift;
          if (shifted >= 1 && shifted <= totalMonths + 10) {
            result[shifted] = (result[shifted] || 0) + monthly;
          }
        }
      }
      break;
    }
    case "CUSTOM": {
      // Custom distribution for marketing with weighted month blocks
      if (item.customDistribution) {
        for (const block of item.customDistribution) {
          const range = getPhaseMonthRange(phases, block.phase);
          if (range.start === 0 && range.end === 0) continue;
          const blockTotal = item.total * block.ratio;

          // For offplan: distribute across all offplan months
          if (block.phase === "offplan") {
            const phaseConfig = phases.find(p => p.type === block.phase);
            if (!phaseConfig || phaseConfig.duration === 0) continue;
            const monthly = blockTotal / phaseConfig.duration;
            for (let m = range.start; m <= range.end; m++) {
              const shifted = m + shift;
              if (shifted >= 1 && shifted <= totalMonths + 10) {
                result[shifted] = (result[shifted] || 0) + monthly;
              }
            }
          } else {
            // For construction: use block.months to determine how many months to distribute across
            // First block = first N months, second block = next N months
            const phaseConfig = phases.find(p => p.type === block.phase);
            if (!phaseConfig || phaseConfig.duration === 0) continue;

            // Determine start offset within the construction phase
            // Check if this is the "first 4 months" or "next 6 months" block
            const isFirstBlock = block.ratio === 0.75 * 0.75; // 56.25%
            const blockStart = isFirstBlock ? range.start : range.start + 4;
            const blockEnd = isFirstBlock
              ? Math.min(range.start + block.months - 1, range.end)
              : Math.min(blockStart + block.months - 1, range.end);

            const actualMonths = blockEnd - blockStart + 1;
            if (actualMonths <= 0) continue;
            const monthly = blockTotal / actualMonths;
            for (let m = blockStart; m <= blockEnd; m++) {
              const shifted = m + shift;
              if (shifted >= 1 && shifted <= totalMonths + 10) {
                result[shifted] = (result[shifted] || 0) + monthly;
              }
            }
          }
        }
      }
      break;
    }
    default:
      break;
  }
  return result;
}

// ─── MAIN: compute monthly investor outflow for one project ──────────────────
export interface ProjectCapitalData {
  projectId: number;
  name: string;
  startDate: string;       // "YYYY-MM"
  designMonths: number;
  offplanMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  /** For backward compat: preDevMonths = designMonths */
  preDevMonths: number;
  /** Index 0 = land month (before project start), index 1..N = months 1..N */
  monthlyAmounts: number[];
  /** Per-phase monthly amounts for the scheduling page */
  phaseMonthlyAmounts: Record<PhaseType, Record<number, number>>;
  grandTotal: number;
  paidTotal: number;
  upcomingTotal: number;
  /** Per-phase totals */
  phaseTotals: Record<PhaseType, number>;
  /** Per-month item-level breakdown: month → [{name, amount}] */
  itemBreakdown: Record<number, { name: string; amount: number }[]>;
}

export function computeProjectCapital(
  project: any,
  marketOverview: any,
  competitionPricing: any,
  cfProject: { startDate: string; preDevMonths: number; constructionMonths: number; handoverMonths: number },
  today: Date,
  scenario: FinancingScenario = "offplan_escrow",
): ProjectCapitalData | null {
  const costs = calculateProjectCosts(project, marketOverview, competitionPricing);
  if (!costs) return null;

  // Convert legacy durations to new 4-phase durations
  const legacyDurations: LegacyPhaseDurations = {
    preCon: cfProject.preDevMonths || 6,
    construction: cfProject.constructionMonths || 16,
    handover: cfProject.handoverMonths || 2,
  };
  const durations = legacyToNewDurations(legacyDurations);
  const phases = calculatePhases(durations);
  const totalMonths = getTotalMonths(durations);
  const expenses = getInvestorExpenses(costs, scenario);

  // Build monthly array: index 0 = land (FIXED_ABSOLUTE), index 1..totalMonths = project months
  const monthly: number[] = new Array(totalMonths + 1).fill(0);

  // Track per-phase monthly amounts
  const phaseMonthlyAmounts: Record<PhaseType, Record<number, number>> = {
    land: {}, design: {}, offplan: {}, construction: {}, handover: {},
  };

  // Track per-month item-level breakdown for tooltips
  const itemBreakdown: Record<number, { name: string; amount: number }[]> = {};

  // Track per-phase totals
  const phaseTotals: Record<PhaseType, number> = {
    land: 0, design: 0, offplan: 0, construction: 0, handover: 0,
  };

  // Helper: determine which phase a given month belongs to
  function getPhaseForMonth(m: number): PhaseType {
    if (m === 0) return "land";
    // Check offplan first (it overlaps with design)
    const offplanRange = getPhaseMonthRange(phases, "offplan");
    if (offplanRange.start > 0 && m >= offplanRange.start && m <= offplanRange.end) return "offplan";
    const designRange = getPhaseMonthRange(phases, "design");
    if (designRange.start > 0 && m >= designRange.start && m <= designRange.end) return "design";
    const constructionRange = getPhaseMonthRange(phases, "construction");
    if (constructionRange.start > 0 && m >= constructionRange.start && m <= constructionRange.end) return "construction";
    const handoverRange = getPhaseMonthRange(phases, "handover");
    if (handoverRange.start > 0 && m >= handoverRange.start && m <= handoverRange.end) return "handover";
    return "construction"; // fallback
  }

  for (const item of expenses) {
    const dist = distributeExpense(item, phases, durations, totalMonths);

    // For items with splitRatio or customDistribution, assign amounts to the actual phase
    // based on which month range the amount falls in, not just item.phase
    const hasSplitDistribution = item.splitRatio || item.customDistribution || item.multiPayments;

    for (const [mStr, val] of Object.entries(dist)) {
      const m = parseInt(mStr);
      if (m >= 0 && m <= totalMonths) {
        monthly[m] = (monthly[m] || 0) + val;

        // Determine the correct phase for tracking
        let trackPhase: PhaseType;
        if (hasSplitDistribution) {
          trackPhase = getPhaseForMonth(m);
        } else {
          trackPhase = item.phase;
        }

        phaseMonthlyAmounts[trackPhase][m] = (phaseMonthlyAmounts[trackPhase][m] || 0) + val;
        phaseTotals[trackPhase] += val;

        // Track item-level breakdown for tooltip
        if (!itemBreakdown[m]) itemBreakdown[m] = [];
        itemBreakdown[m].push({ name: item.name, amount: val });
      }
    }
  }

  // Parse start date
  const [startYear, startMonth] = cfProject.startDate.split('-').map(Number);
  const projectStartYear = startYear || 2026;
  const projectStartMonth = startMonth || 4;

  // Compute paid total
  let paidTotal = monthly[0]; // land is always "paid"

  for (let m = 1; m <= totalMonths; m++) {
    const calYear = projectStartYear + Math.floor((projectStartMonth - 1 + m - 1) / 12);
    const calMonth = ((projectStartMonth - 1 + m - 1) % 12) + 1;
    const endOfMonth = new Date(calYear, calMonth - 1 + 1, 1);
    if (endOfMonth <= today) {
      paidTotal += monthly[m];
    }
  }

  const grandTotal = monthly.reduce((s, v) => s + v, 0);
  const upcomingTotal = grandTotal - paidTotal;

  return {
    projectId: project.id,
    name: project.name,
    startDate: cfProject.startDate,
    designMonths: durations.design,
    offplanMonths: durations.offplan,
    constructionMonths: durations.construction,
    handoverMonths: durations.handover,
    preDevMonths: durations.design, // backward compat
    monthlyAmounts: monthly,
    phaseMonthlyAmounts,
    grandTotal,
    paidTotal,
    upcomingTotal,
    phaseTotals,
    itemBreakdown,
  };
}
