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
export function computeInvestorCashFlow(projectData: any, scenario: Scenario): CashFlowResult {
  const i: ProjectInputs = projectData ? dbProjectToInputs(projectData) : PROJECT_INPUTS;
  const r: ProjectRates = projectData ? dbProjectToRates(projectData) : RATES;
  const projectFormulas = calculateProjectFormulas(i, r);

  const pricingUnits = buildPricingUnits(projectData || {}, i);
  const pricingFormulas = calculatePricingFormulas(pricingUnits);
  const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

  const { landPrice, landRegistration, landBroker, constructionCost } = projectFormulas;
  const { totalRevenue, totalUnits } = pricingFormulas;
  const designDuration = i.designDuration;
  const constructionDuration = i.constructionDuration;
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

  // ═══════════════════════════════════════════
  // BUILD ROWS
  // ═══════════════════════════════════════════
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

  // أتعاب الإشراف
  if (isScenario3 || isScenario4) {
    const supervisionConst = emptyConstruction();
    distributeEqual(costs.supervisionFee, constructionDuration, supervisionConst, 0);
    rows.push({
      label: "أتعاب الإشراف",
      totalCost: costs.supervisionFee,
      investorAmount: costs.supervisionFee,
      paid: 0,
      unpaid: costs.supervisionFee,
      funder: "investor",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: supervisionConst,
      postConstructionMonths: emptyPost(),
    });
  } else {
    rows.push({
      label: "أتعاب الإشراف",
      totalCost: costs.supervisionFee,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── فحص التربة (شهر 1 تصاميم) ───
  const soilDesign = emptyDesign();
  soilDesign[0] = i.soilTest;
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

  // ─── المسح الطبوغرافي (شهر 1 تصاميم) ───
  const topoDesign = emptyDesign();
  topoDesign[0] = i.topography;
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

  // ─── رسوم المساح ───
  if (isScenario3 || isScenario4) {
    const surveyorConst = emptyConstruction();
    surveyorConst[penultimateConstruction] = i.surveyorFee;
    rows.push({
      label: "رسوم المساح",
      totalCost: i.surveyorFee,
      investorAmount: i.surveyorFee,
      paid: 0,
      unpaid: i.surveyorFee,
      funder: "investor",
      section: "الدراسات والمسوحات",
      designMonths: emptyDesign(),
      constructionMonths: surveyorConst,
      postConstructionMonths: emptyPost(),
    });
  } else {
    rows.push({
      label: "رسوم المساح",
      totalCost: i.surveyorFee,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "الدراسات والمسوحات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم المجتمع (كل 6 أشهر من شهر 1) ───
  const communityDist = distributeCommunityFee(i.communityFee, designDuration, constructionDuration);
  rows.push({
    label: "رسوم المجتمع",
    totalCost: i.communityFee,
    investorAmount: i.communityFee,
    paid: 0,
    unpaid: i.communityFee,
    funder: "investor",
    section: "الرسوم الحكومية والتنظيمية",
    designMonths: communityDist.design,
    constructionMonths: communityDist.construction,
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
    const govDesign = emptyDesign();
    govDesign[1] = costs.govFeesInvestor;
    rows.push({
      label: "رسوم الجهات الحكومية",
      totalCost: i.govFeesTotal,
      investorAmount: costs.govFeesInvestor,
      paid: 0,
      unpaid: costs.govFeesInvestor,
      funder: "split",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: govDesign,
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم الفرز ───
  {
    const sortingDesign = emptyDesign();
    const sortingConstruction = emptyConstruction();
    if (isScenario3 || isScenario4) {
      sortingConstruction[penultimateConstruction] = costs.sortingFee;
    } else if (isScenario2) {
      sortingConstruction[3] = costs.sortingFee;
    } else {
      sortingDesign[penultimateDesign] = costs.sortingFee;
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
    if (isScenario3 || isScenario4) {
      nocConstruction[penultimateConstruction] = i.nocSale;
    } else if (isScenario2) {
      nocConstruction[3] = i.nocSale;
    } else {
      nocDesign[penultimateDesign] = i.nocSale;
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
    if (isScenario2) {
      reraRegConstruction[3] = i.reraProjectReg;
    } else {
      reraRegDesign[penultimateDesign] = i.reraProjectReg;
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
    if (isScenario3 || isScenario4) {
      reraUnitsConstruction[penultimateConstruction] = costs.reraUnits;
    } else if (isScenario2) {
      reraUnitsConstruction[3] = costs.reraUnits;
    } else {
      reraUnitsDesign[penultimateDesign] = costs.reraUnits;
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
    if (isScenario2) {
      escrowFeeConstruction[3] = i.escrowAccountFee;
    } else {
      escrowFeeDesign[penultimateDesign] = i.escrowAccountFee;
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
    const bankConstruction = emptyConstruction();
    distributeEqual(i.bankFees, constructionDuration, bankConstruction, 0);
    rows.push({
      label: "رسوم البنك",
      totalCost: i.bankFees,
      investorAmount: i.bankFees,
      paid: 0,
      unpaid: i.bankFees,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: bankConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── تقرير مدقق ريرا — س3 و س4: محذوف ───
  if (!isScenario3 && !isScenario4) {
    rows.push({
      label: "تقرير مدقق ريرا",
      totalCost: i.reraAuditorReport,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── فحص ريرا — س3 و س4: محذوف ───
  if (!isScenario3 && !isScenario4) {
    rows.push({
      label: "فحص ريرا",
      totalCost: i.reraInspection,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── عمولة المبيعات ───
  if (isScenario4) {
    // سيناريو 4: لا يوجد عمولة مبيعات
  } else if (isScenario3) {
    const commissionAmount = totalRevenue * r.salesCommissionPostCompletion; // 2%
    const commissionPost = emptyPost();
    commissionPost[1] = commissionAmount / 2;
    commissionPost[2] = commissionAmount / 2;
    rows.push({
      label: "عمولة المبيعات (2%)",
      totalCost: commissionAmount,
      investorAmount: commissionAmount,
      paid: 0,
      unpaid: commissionAmount,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: commissionPost,
    });
  } else {
    rows.push({
      label: "عمولة المبيعات",
      totalCost: costs.salesCommission,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── التسويق ───
  if (!isScenario4) {
    const marketingDesign = emptyDesign();
    const marketingConstruction = emptyConstruction();

    if (isScenario3) {
      const marketingAmount = totalRevenue * 0.005; // 0.5%
      marketingConstruction[constructionDuration - 1] = marketingAmount;
      rows.push({
        label: "التسويق (0.5%)",
        totalCost: marketingAmount,
        investorAmount: marketingAmount,
        paid: 0,
        unpaid: marketingAmount,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: marketingDesign,
        constructionMonths: marketingConstruction,
        postConstructionMonths: emptyPost(),
      });
    } else {
      const marketingTotal = costs.marketing;
      const marketingPerMonth = marketingTotal / 12;

      if (isScenario2) {
        let placed = 0;
        for (let idx = 3; idx < constructionDuration && placed < 12; idx++) {
          marketingConstruction[idx] = marketingPerMonth;
          placed++;
        }
      } else {
        let placed = 0;
        if (penultimateDesign >= 0 && placed < 12) {
          marketingDesign[penultimateDesign] = marketingPerMonth;
          placed++;
        }
        if (designDuration - 1 > penultimateDesign && placed < 12) {
          marketingDesign[designDuration - 1] = marketingPerMonth;
          placed++;
        }
        for (let idx = 0; idx < constructionDuration && placed < 12; idx++) {
          marketingConstruction[idx] = marketingPerMonth;
          placed++;
        }
      }
      rows.push({
        label: "التسويق (2%)",
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

  // ─── أتعاب المطور ───
  {
    const devFeeDesign = emptyDesign();
    const devFeeConstruction = emptyConstruction();

    if (isScenario4) {
      const devFeeDesignTotal = constructionCost * 0.01;
      const devFeeConstructionTotal = constructionCost * 0.02;
      distributeEqual(devFeeDesignTotal, designDuration, devFeeDesign, 0);
      distributeEqual(devFeeConstructionTotal, constructionDuration, devFeeConstruction, 0);
      const totalDevFee = devFeeDesignTotal + devFeeConstructionTotal;
      rows.push({
        label: "أتعاب المطور (3%)",
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
    } else if (isScenario3) {
      const devFeeDesignTotal = totalRevenue * 0.01;
      const devFeeConstructionTotal = totalRevenue * 0.02;
      distributeEqual(devFeeDesignTotal, designDuration, devFeeDesign, 0);
      distributeEqual(devFeeConstructionTotal, constructionDuration, devFeeConstruction, 0);
      const totalDevFee = devFeeDesignTotal + devFeeConstructionTotal;
      rows.push({
        label: "أتعاب المطور (3%)",
        totalCost: totalDevFee,
        investorAmount: totalDevFee,
        paid: 0,
        unpaid: totalDevFee,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: devFeeDesign,
        constructionMonths: devFeeConstruction,
        postConstructionMonths: emptyPost(),
      });
    } else {
      const devFeeDesignTotal = totalRevenue * 0.02;
      const devFeeConstructionTotal = totalRevenue * 0.03;
      distributeEqual(devFeeDesignTotal, designDuration, devFeeDesign, 0);
      distributeEqual(devFeeConstructionTotal, constructionDuration, devFeeConstruction, 0);
      rows.push({
        label: "أتعاب المطور",
        totalCost: costs.developerFee,
        investorAmount: costs.developerFee,
        paid: 0,
        unpaid: costs.developerFee,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: devFeeDesign,
        constructionMonths: devFeeConstruction,
        postConstructionMonths: emptyPost(),
      });
    }
  }

  // ─── الإنشاء ───
  {
    const constructionDesign = emptyDesign();
    const constructionConst = emptyConstruction();
    const constructionPost = emptyPost();

    if (isScenario3 || isScenario4) {
      // 100% from investor
      constructionConst[0] = constructionCost * 0.10;
      constructionConst[1] = constructionCost * 0.04;
      constructionConst[2] = constructionCost * 0.07;
      constructionConst[3] = constructionCost * 0.09;
      // 60% S-Curve from month 5
      const sCurveTotal = constructionCost * 0.60;
      const remainingMonths = constructionDuration - 4;
      const sCurveWeights = generateSCurve(remainingMonths);
      for (let idx = 0; idx < remainingMonths; idx++) {
        constructionConst[4 + idx] = sCurveTotal * sCurveWeights[idx];
      }
      // 5% إتمام (شهر 2 بعد الإنجاز) + 5% احتجاز (شهر 13 بعد الإنجاز)
      constructionPost[1] = constructionCost * 0.05;
      constructionPost[12] = constructionCost * 0.05;

      rows.push({
        label: "تكلفة الإنشاء",
        totalCost: constructionCost,
        investorAmount: constructionCost,
        paid: 0,
        unpaid: constructionCost,
        funder: "investor",
        section: "الإنشاء",
        designMonths: constructionDesign,
        constructionMonths: constructionConst,
        postConstructionMonths: constructionPost,
      });
    } else if (isScenario2) {
      // س2: لا إيداع، المستثمر يدفع 10%+4%+7%+9% في أشهر 1-4
      constructionConst[0] = constructionCost * 0.10;
      constructionConst[1] = constructionCost * 0.04;
      constructionConst[2] = constructionCost * 0.07;
      constructionConst[3] = constructionCost * 0.09;
      // 5% إتمام + 5% احتجاز تُدفع من حساب الضمان (ليست من المستثمر)
      rows.push({
        label: "تكلفة الإنشاء",
        totalCost: constructionCost,
        investorAmount: costs.constructionInvestor,
        paid: 0,
        unpaid: costs.constructionInvestor,
        funder: "split",
        section: "الإنشاء",
        designMonths: constructionDesign,
        constructionMonths: constructionConst,
        postConstructionMonths: constructionPost,
      });
    } else {
      // س1: إيداع 20% + دفعة مقدمة 10%
      const escrowDeposit = constructionCost * r.escrowDeposit;
      constructionDesign[penultimateDesign] = escrowDeposit;
      constructionConst[0] = constructionCost * r.advancePayment;
      // 5% إتمام + 5% احتجاز تُدفع من حساب الضمان (ليست من المستثمر)
      rows.push({
        label: "تكلفة الإنشاء",
        totalCost: constructionCost,
        investorAmount: costs.constructionInvestor,
        paid: 0,
        unpaid: costs.constructionInvestor,
        funder: "split",
        section: "الإنشاء",
        designMonths: constructionDesign,
        constructionMonths: constructionConst,
        postConstructionMonths: constructionPost,
      });
    }
  }

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
    // S1/S2: 20% of revenue goes directly to investor over 12 months
    const directRevenue = totalRevenue * 0.20;
    const revenuePost = emptyPost();
    const perMonth = directRevenue / 12;
    for (let idx = 0; idx < 12; idx++) {
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
    // الضمان يدفع 80% من الإنشاء أثناء البناء
    // عند التصفية: يُدفع 5% إنجاز للمقاول + يُحجز 5% إيرادات + الباقي للمستثمر
    const escrowRevenue = totalRevenue * 0.80;
    const revenueRetention = escrowRevenue * 0.05;
    const completionPayment = constructionCost * 0.05;
    const openingBalance = constructionCost * 0.20;
    const actualEscrowExpenses = (constructionCost * 0.80) + costs.supervisionFee +
      (i.govFeesTotal * r.govFeesEscrowShare) + costs.salesCommission +
      i.reraAuditorReport + i.reraInspection + i.surveyorFee;
    const escrowLiquidation = openingBalance + escrowRevenue - actualEscrowExpenses - revenueRetention - completionPayment;
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
    // 5% احتجاز إيرادات يُحرر — لكن يُخصم منه 5% احتجاز المقاول (تُدفع للمقاول من الضمان)
    // المستثمر يستلم: revenueRetention - constructionRetention
    const constructionRetention = constructionCost * 0.05;
    const month13ToInvestor = revenueRetention - constructionRetention;
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
  };
}
