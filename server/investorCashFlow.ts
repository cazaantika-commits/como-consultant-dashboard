/**
 * investorCashFlow.ts — Server-side mirror of ExcelCashFlowPage logic
 *
 * Mirrors exactly:
 *  - client/src/lib/projectCostsCalc.ts  → calculateProjectCosts()
 *  - client/src/lib/cashFlowEngine.ts    → getInvestorExpenses() + distributeExpense()
 *
 * Used by getCapitalScheduleData procedure so CapitalSchedulingPage shows
 * the same numbers as the "رأس المال المطلوب" page.
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
  const totalRevenue = revenueRes + revenueRet + revenueOff;

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

  return {
    landPrice, agentCommissionLand, landRegistration, soilTestFee, topographicSurveyFee,
    officialBodiesFees, designFee, supervisionFee, separationFee, constructionCost,
    communityFees, contingencies, developerFee, salesCommission, marketingCost,
    reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee, bankFees,
    surveyorFees, reraAuditReportFee, reraInspectionReportFee, totalRevenue, totalCosts,
  };
}

// ─── PHASE TYPES ─────────────────────────────────────────────────────────────
export type PhaseType = "land" | "preCon" | "construction" | "handover";

export interface PhaseConfig {
  type: PhaseType;
  duration: number;
  startMonth: number;
}

export interface PhaseDurations {
  preCon: number;
  construction: number;
  handover: number;
}

export function calculatePhases(d: PhaseDurations): PhaseConfig[] {
  return [
    { type: "land", duration: 0, startMonth: 0 },
    { type: "preCon", duration: d.preCon, startMonth: 1 },
    { type: "construction", duration: d.construction, startMonth: 1 + d.preCon },
    { type: "handover", duration: d.handover, startMonth: 1 + d.preCon + d.construction },
  ];
}

export function getTotalMonths(d: PhaseDurations): number {
  return d.preCon + d.construction + d.handover;
}

export function getPhaseMonthRange(phases: PhaseConfig[], phaseType: PhaseType): { start: number; end: number } {
  const phase = phases.find(p => p.type === phaseType);
  if (!phase || phase.duration === 0) return { start: 0, end: 0 };
  return { start: phase.startMonth, end: phase.startMonth + phase.duration - 1 };
}

// ─── EXPENSE ITEM (mirrors cashFlowEngine.ts) ────────────────────────────────
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
  table: "investor" | "escrow";
}

// ─── GET INVESTOR EXPENSES (mirrors ExcelCashFlowPage رأس المال المطلوب exactly) ─
// Includes ONLY items that appear in the رأس المال المطلوب table.
// Excluded: officialBodiesFees, supervisionFee, salesCommission, reraAuditReportFee,
//           reraInspectionReportFee, and 70% of constructionCost (paid via escrow).
export function getInvestorExpenses(costs: ProjectCosts): ExpenseItem[] {
  const c = costs;
  const constructionCost = c.constructionCost;
  return [
    // شراء الأرض
    { id: "land_cost", name: "سعر الأرض", total: c.landPrice, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },
    { id: "land_broker", name: "عمولة وسيط الأرض", total: c.agentCommissionLand, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },
    { id: "land_registration", name: "رسوم تسجيل الأرض (4%)", total: c.landRegistration, behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor" },
    // ما قبل البناء
    { id: "soil_test", name: "فحص التربة", total: c.soilTestFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 1, table: "investor" },
    { id: "survey", name: "المسح الطبوغرافي", total: c.topographicSurveyFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 1, table: "investor" },
    {
      id: "developer_fee", name: "أتعاب المطور", total: c.developerFee, behavior: "DISTRIBUTED", phase: "preCon",
      splitRatio: [{ phase: "preCon", ratio: 0.4 }, { phase: "construction", ratio: 0.5 }, { phase: "handover", ratio: 0.1 }],
      table: "investor",
    },
    { id: "design_fee", name: "أتعاب التصميم", total: c.designFee, behavior: "DISTRIBUTED", phase: "preCon", distributeAcross: ["preCon"], table: "investor" },
    { id: "fraz_fee", name: "رسوم الفرز", total: c.separationFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 2, table: "investor" },
    { id: "rera_registration", name: "تسجيل بيع على الخارطة - ريرا", total: c.reraProjectRegFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 4, table: "investor" },
    { id: "rera_units", name: "تسجيل الوحدات - ريرا", total: c.reraUnitRegFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 5, table: "investor" },
    {
      id: "surveyor_fee", name: "رسوم المساح", total: c.surveyorFees, behavior: "FIXED_RELATIVE", phase: "preCon",
      multiPayments: [
        { phase: "preCon", relativeMonth: 4, amount: c.surveyorFees / 2 },
        { phase: "handover", relativeMonth: 1, amount: c.surveyorFees / 2 },
      ],
      table: "investor",
    },
    {
      id: "noc_fee", name: "رسوم NOC للبيع", total: c.developerNocFee, behavior: "FIXED_RELATIVE", phase: "preCon",
      multiPayments: [
        { phase: "preCon", relativeMonth: 5, amount: c.developerNocFee * 0.45 },
        { phase: "handover", relativeMonth: 1, amount: c.developerNocFee * 0.55 },
      ],
      table: "investor",
    },
    { id: "escrow_fee", name: "رسوم حساب الضمان", total: c.escrowAccountFee, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: 4, table: "investor" },
    // إيداع حساب الضمان (20% من تكلفة الإنشاء) — يدفعه المطور قبل نهاية ما قبل البناء
    { id: "escrow_deposit", name: "إيداع حساب الضمان (20%)", total: constructionCost * 0.20, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: -2, table: "investor" },
    // دفعة مقدمة للمقاول (10% من تكلفة الإنشاء) — يدفعها المطور
    { id: "contractor_advance", name: "دفعة مقدمة للمقاول (10%)", total: constructionCost * 0.10, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: -1, table: "investor" },
    { id: "community_fee", name: "رسوم المجتمع", total: c.communityFees, behavior: "FIXED_RELATIVE", phase: "preCon", relativeMonth: -1, table: "investor" },
    // البناء — المطور لا يدفع 70% من تكلفة الإنشاء (تُدفع من حساب الضمان)
    { id: "contingency", name: "احتياطي وطوارئ (2%)", total: c.contingencies, behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction"], table: "investor" },
    { id: "marketing", name: "التسويق والإعلان", total: c.marketingCost, behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction"], table: "investor" },
    { id: "bank_fees", name: "رسوم بنكية", total: c.bankFees, behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction", "handover"], table: "investor" },
    // NOTE: The following are EXCLUDED (not in رأس المال المطلوب):
    // - officialBodiesFees (رسوم الجهات الحكومية) → paid from escrow
    // - supervisionFee (أتعاب الإشراف) → paid from escrow
    // - salesCommission (عمولة وكيل المبيعات) → paid from sales revenue
    // - reraAuditReportFee, reraInspectionReportFee → paid from escrow
    // - 70% of constructionCost → paid from escrow
  ];
}

// ─── DISTRIBUTE EXPENSE (mirrors cashFlowEngine.ts distributeExpense) ─────────
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
      // Land items: placed at month 0 (before project start)
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
          if (month >= 1 && month <= totalMonths) {
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
        if (month >= 1 && month <= totalMonths) {
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
            if (shifted >= 1 && shifted <= totalMonths) {
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
            if (shifted >= 1 && shifted <= totalMonths) {
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
          if (shifted >= 1 && shifted <= totalMonths) {
            result[shifted] = (result[shifted] || 0) + monthly;
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
  preDevMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  /** Index 0 = land month (before project start), index 1..N = months 1..N */
  monthlyAmounts: number[];
  grandTotal: number;
  paidTotal: number;
  upcomingTotal: number;
}

export function computeProjectCapital(
  project: any,
  marketOverview: any,
  competitionPricing: any,
  cfProject: { startDate: string; preDevMonths: number; constructionMonths: number; handoverMonths: number },
  today: Date,
): ProjectCapitalData | null {
  const costs = calculateProjectCosts(project, marketOverview, competitionPricing);
  if (!costs) return null;

  const durations: PhaseDurations = {
    preCon: cfProject.preDevMonths || 6,
    construction: cfProject.constructionMonths || 16,
    handover: cfProject.handoverMonths || 2,
  };
  const phases = calculatePhases(durations);
  const totalMonths = getTotalMonths(durations);
  const expenses = getInvestorExpenses(costs);

  // Build monthly array: index 0 = land (FIXED_ABSOLUTE), index 1..totalMonths = project months
  const monthly: number[] = new Array(totalMonths + 1).fill(0);

  for (const item of expenses) {
    const dist = distributeExpense(item, phases, durations, totalMonths);
    for (const [mStr, val] of Object.entries(dist)) {
      const m = parseInt(mStr);
      if (m >= 0 && m <= totalMonths) {
        monthly[m] = (monthly[m] || 0) + val;
      }
    }
  }

  // Parse start date
  const [startYear, startMonth] = cfProject.startDate.split('-').map(Number);
  const projectStartYear = startYear || 2026;
  const projectStartMonth = startMonth || 4; // April default

  // Compute paid total: land (index 0) is always "paid" (it's the opening payment),
  // then for months 1..N check if that calendar month has passed
  let paidTotal = monthly[0]; // land is always in "paid" column (qi=0 rule from ExcelCashFlowPage)

  for (let m = 1; m <= totalMonths; m++) {
    // Calendar date for end of this month
    const calYear = projectStartYear + Math.floor((projectStartMonth - 1 + m - 1) / 12);
    const calMonth = ((projectStartMonth - 1 + m - 1) % 12) + 1;
    // isMonthPaid: end of month (day 28+1 = next month start) <= today
    const endOfMonth = new Date(calYear, calMonth - 1 + 1, 1); // first day of next month
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
    preDevMonths: durations.preCon,
    constructionMonths: durations.construction,
    handoverMonths: durations.handover,
    monthlyAmounts: monthly,
    grandTotal,
    paidTotal,
    upcomingTotal,
  };
}
