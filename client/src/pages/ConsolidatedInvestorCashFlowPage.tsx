import { useState, useMemo } from "react";
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
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan" | "rental";

interface ProjectCashFlow {
  id: number;
  name: string;
  scenario: Scenario;
  startMonthOffset: number; // offset from global start (0 = Aug 2026)
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
  totalMonths: number;
  monthlyExpenses: number[]; // flat timeline (design + construction + post)
  monthlyRevenue: number[]; // flat timeline
  monthlyNet: number[]; // revenue - expenses
  totalExpenses: number;
  totalRevenue: number;
  escrowSurplusMonth3: number; // amount recovered at month 3 post (S1/S2 only)
  escrowSurplusMonth13: number; // amount recovered at month 13 post (S1/S2 only)
}

// ═══════════════════════════════════════════
// HELPERS (same as InvestorCashFlowSchedulePage)
// ═══════════════════════════════════════════
function generateSCurve(months: number): number[] {
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

function distributeDesignFee(totalFee: number, months: number): number[] {
  const stages = [0.10, 0.15, 0.20, 0.35, 0.10, 0.05, 0.05];
  const result = new Array(months).fill(0);
  if (months >= 7) {
    const extraMonths = months - 6;
    result[0] = totalFee * stages[0];
    result[1] = totalFee * stages[1];
    result[2] = totalFee * stages[2];
    const detailedPerMonth = (totalFee * stages[3]) / extraMonths;
    for (let i = 3; i < 3 + extraMonths; i++) result[i] = detailedPerMonth;
    result[months - 3] += totalFee * stages[4];
    result[months - 2] += totalFee * stages[5];
    result[months - 1] += totalFee * stages[6];
  } else {
    for (let i = 0; i < months - 1 && i < stages.length; i++) result[i] = totalFee * stages[i];
    let remaining = 0;
    for (let i = months - 1; i < stages.length; i++) remaining += stages[i];
    result[months - 1] = totalFee * remaining;
  }
  return result;
}

function distributeEqual(total: number, months: number, arr: number[], startIndex: number = 0) {
  const perMonth = total / months;
  for (let i = startIndex; i < startIndex + months && i < arr.length; i++) arr[i] = perMonth;
}

function distributeCommunityFee(total: number, designMonths: number, constructionMonths: number): { design: number[]; construction: number[] } {
  const totalMonths = designMonths + constructionMonths;
  const paymentMonths: number[] = [];
  for (let m = 0; m < totalMonths; m += 6) paymentMonths.push(m);
  const paymentAmount = total / paymentMonths.length;
  const design = new Array(designMonths).fill(0);
  const construction = new Array(constructionMonths).fill(0);
  for (const m of paymentMonths) {
    if (m < designMonths) design[m] = paymentAmount;
    else construction[m - designMonths] = paymentAmount;
  }
  return { design, construction };
}

// ═══════════════════════════════════════════
// COMPUTE PROJECT CASH FLOW (same logic as InvestorCashFlowSchedulePage)
// ═══════════════════════════════════════════
function computeProjectCashFlow(project: any, scenario: Scenario): ProjectCashFlow {
  const i: ProjectInputs = dbProjectToInputs(project);
  const r: ProjectRates = dbProjectToRates(project);
  const projectFormulas = calculateProjectFormulas(i, r);

  // Pricing
  const defAreas = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
  const defPrices = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };
  const p = project as any;
  const hasSavedCounts = [p.residential1brCount, p.residential2brCount, p.residential3brCount, p.retailSmallCount, p.retailMediumCount, p.retailLargeCount, p.officeSmallCount, p.officeMediumCount, p.officeLargeCount].some((v: any) => Number(v) > 0);
  let c1 = Number(p?.residential1brCount) || 0, c2 = Number(p?.residential2brCount) || 0, c3 = Number(p?.residential3brCount) || 0;
  let cRS = Number(p?.retailSmallCount) || 0, cRM = Number(p?.retailMediumCount) || 0, cRL = Number(p?.retailLargeCount) || 0;
  let cOS = Number(p?.officeSmallCount) || 0, cOM = Number(p?.officeMediumCount) || 0, cOL = Number(p?.officeLargeCount) || 0;
  if (!hasSavedCounts) {
    const sellRes = i.gfaResidential * i.efficiencyResidential;
    const sellRet = i.gfaRetail * i.efficiencyRetail;
    const sellOff = i.gfaOffice * i.efficiencyOffice;
    if (sellRes > 0) { c1 = Math.round(sellRes * 0.4 / defAreas.res1); c2 = Math.round(sellRes * 0.4 / defAreas.res2); c3 = Math.round(sellRes * 0.2 / defAreas.res3); }
    if (sellRet > 0) { cRS = Math.round(sellRet * 0.4 / defAreas.retS); cRM = Math.round(sellRet * 0.4 / defAreas.retM); cRL = Math.round(sellRet * 0.2 / defAreas.retL); }
    if (sellOff > 0) { cOS = Math.round(sellOff * 0.4 / defAreas.offS); cOM = Math.round(sellOff * 0.4 / defAreas.offM); cOL = Math.round(sellOff * 0.2 / defAreas.offL); }
  }
  const pricingUnits = [
    { name: "غرفة وصالة", category: "residential" as const, area: Number(p?.residential1brArea) || defAreas.res1, price: Number(p?.residential1brPrice) || defPrices.res1, count: c1 },
    { name: "غرفتين وصالة", category: "residential" as const, area: Number(p?.residential2brArea) || defAreas.res2, price: Number(p?.residential2brPrice) || defPrices.res2, count: c2 },
    { name: "ثلاث غرف وصالة", category: "residential" as const, area: Number(p?.residential3brArea) || defAreas.res3, price: Number(p?.residential3brPrice) || defPrices.res3, count: c3 },
    { name: "تجزئة / صغير", category: "retail" as const, area: Number(p?.retailSmallArea) || defAreas.retS, price: Number(p?.retailSmallPrice) || defPrices.retS, count: cRS },
    { name: "تجزئة / متوسط", category: "retail" as const, area: Number(p?.retailMediumArea) || defAreas.retM, price: Number(p?.retailMediumPrice) || defPrices.retM, count: cRM },
    { name: "تجزئة / كبير", category: "retail" as const, area: Number(p?.retailLargeArea) || defAreas.retL, price: Number(p?.retailLargePrice) || defPrices.retL, count: cRL },
    { name: "مكاتب / صغير", category: "office" as const, area: Number(p?.officeSmallArea) || defAreas.offS, price: Number(p?.officeSmallPrice) || defPrices.offS, count: cOS },
    { name: "مكاتب / متوسط", category: "office" as const, area: Number(p?.officeMediumArea) || defAreas.offM, price: Number(p?.officeMediumPrice) || defPrices.offM, count: cOM },
    { name: "مكاتب / كبير", category: "office" as const, area: Number(p?.officeLargeArea) || defAreas.offL, price: Number(p?.officeLargePrice) || defPrices.offL, count: cOL },
  ];
  const pricingFormulas = calculatePricingFormulas(pricingUnits);
  const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

  const { landPrice, landRegistration, landBroker, constructionCost } = projectFormulas;
  const { totalRevenue } = pricingFormulas;
  const designDuration = i.designDuration;
  const constructionDuration = i.constructionDuration;
  const penultimateDesign = designDuration - 2;
  const penultimateConstruction = constructionDuration - 2;
  const isScenario2 = scenario === "offplan_construction";
  const isScenario3 = scenario === "no_offplan";
  const isScenario4 = scenario === "rental";

  // Post-construction duration
  // S1/S2: need 13 months for escrow recovery (month 3 + month 13)
  // S3: 3 months for revenue
  // S4: 3 months for completion/retention
  const postDuration = (isScenario3 || isScenario4) ? 3 : 13;

  const emptyDesign = () => new Array(designDuration).fill(0);
  const emptyConstruction = () => new Array(constructionDuration).fill(0);
  const emptyPost = () => new Array(postDuration).fill(0);

  // ─── Build expense arrays ───
  const designExpenses = new Array(designDuration).fill(0);
  const constructionExpenses = new Array(constructionDuration).fill(0);
  const postExpenses = new Array(postDuration).fill(0);
  const postRevenue = new Array(postDuration).fill(0);

  // ─── الأرض (مدفوعة — لا توزيع شهري) ───
  // Land is pre-paid, not in monthly flow

  // ─── أتعاب التصاميم ───
  const designFeeArr = distributeDesignFee(costs.designFee, designDuration);
  for (let idx = 0; idx < designDuration; idx++) designExpenses[idx] += designFeeArr[idx];

  // ─── أتعاب الإشراف ───
  if (isScenario3 || isScenario4) {
    // المستثمر يدفع بالتساوي على أشهر الإنشاء
    const perMonth = costs.supervisionFee / constructionDuration;
    for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += perMonth;
  }
  // S1/S2: from escrow, not investor

  // ─── فحص التربة ───
  designExpenses[0] += i.soilTest;

  // ─── المسح الطبوغرافي ───
  designExpenses[0] += i.topography;

  // ─── رسوم المساح ───
  if (isScenario3 || isScenario4) {
    constructionExpenses[penultimateConstruction] += i.surveyorFee;
  }
  // S1/S2: from escrow

  // ─── رسوم المجتمع ───
  const communityResult = distributeCommunityFee(i.communityFee, designDuration, constructionDuration);
  for (let idx = 0; idx < designDuration; idx++) designExpenses[idx] += communityResult.design[idx];
  for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += communityResult.construction[idx];

  // ─── رسوم الجهات الحكومية ───
  if (isScenario3 || isScenario4) {
    // 100% from investor (half month 3 + half month 8)
    const govTotal = i.govFeesTotal;
    const half = govTotal / 2;
    if (constructionDuration > 2) constructionExpenses[2] += half;
    if (constructionDuration > 7) constructionExpenses[7] += half;
    else constructionExpenses[constructionDuration - 1] += half;
  } else {
    // 10% from investor
    const govInvestor = costs.govFeesInvestor;
    const half = govInvestor / 2;
    if (constructionDuration > 2) constructionExpenses[2] += half;
    if (constructionDuration > 7) constructionExpenses[7] += half;
    else constructionExpenses[constructionDuration - 1] += half;
  }

  // ─── رسوم الفرز ───
  if (isScenario3 || isScenario4) {
    constructionExpenses[penultimateConstruction] += costs.sortingFee;
  } else if (isScenario2) {
    constructionExpenses[3] += costs.sortingFee;
  } else {
    designExpenses[penultimateDesign] += costs.sortingFee;
  }

  // ─── رسوم NOC ───
  if (isScenario3 || isScenario4) {
    constructionExpenses[penultimateConstruction] += i.nocSale;
  } else if (isScenario2) {
    constructionExpenses[3] += i.nocSale;
  } else {
    designExpenses[penultimateDesign] += i.nocSale;
  }

  // ─── تسجيل المشروع — ريرا (S3/S4: deleted) ───
  if (!isScenario3 && !isScenario4) {
    if (isScenario2) {
      constructionExpenses[3] += i.reraProjectReg;
    } else {
      designExpenses[penultimateDesign] += i.reraProjectReg;
    }
  }

  // ─── تسجيل الوحدات — ريرا ───
  if (isScenario3 || isScenario4) {
    constructionExpenses[penultimateConstruction] += costs.reraUnits;
  } else if (isScenario2) {
    constructionExpenses[3] += costs.reraUnits;
  } else {
    designExpenses[penultimateDesign] += costs.reraUnits;
  }

  // ─── حساب الضمان (رسوم فتح) — S3/S4: deleted ───
  if (!isScenario3 && !isScenario4) {
    if (isScenario2) {
      constructionExpenses[3] += i.escrowAccountFee;
    } else {
      designExpenses[penultimateDesign] += i.escrowAccountFee;
    }
  }

  // ─── رسوم البنك — S3/S4: deleted ───
  if (!isScenario3 && !isScenario4) {
    const bankPerMonth = i.bankFees / constructionDuration;
    for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += bankPerMonth;
  }

  // ─── عمولة المبيعات ───
  if (isScenario3) {
    const commissionAmount = totalRevenue * r.salesCommissionPostCompletion; // 2%
    postExpenses[1] += commissionAmount / 2;
    postExpenses[2] += commissionAmount / 2;
  }
  // S1/S2: from escrow | S4: no commission

  // ─── التسويق ───
  if (isScenario4) {
    // deleted
  } else if (isScenario3) {
    const marketingAmount = totalRevenue * 0.005; // 0.5%
    constructionExpenses[constructionDuration - 1] += marketingAmount;
  } else {
    const marketingTotal = costs.marketing;
    const marketingPerMonth = marketingTotal / 12;
    if (isScenario2) {
      let placed = 0;
      for (let idx = 3; idx < constructionDuration && placed < 12; idx++) {
        constructionExpenses[idx] += marketingPerMonth;
        placed++;
      }
    } else {
      let placed = 0;
      if (penultimateDesign >= 0 && placed < 12) {
        designExpenses[penultimateDesign] += marketingPerMonth;
        placed++;
      }
      if (designDuration - 1 > penultimateDesign && placed < 12) {
        designExpenses[designDuration - 1] += marketingPerMonth;
        placed++;
      }
      for (let idx = 0; idx < constructionDuration && placed < 12; idx++) {
        constructionExpenses[idx] += marketingPerMonth;
        placed++;
      }
    }
  }

  // ─── أتعاب المطور ───
  if (isScenario4) {
    const devDesign = constructionCost * 0.01;
    const devConst = constructionCost * 0.02;
    const perDesign = devDesign / designDuration;
    const perConst = devConst / constructionDuration;
    for (let idx = 0; idx < designDuration; idx++) designExpenses[idx] += perDesign;
    for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += perConst;
  } else if (isScenario3) {
    const devDesign = totalRevenue * 0.01;
    const devConst = totalRevenue * 0.02;
    const perDesign = devDesign / designDuration;
    const perConst = devConst / constructionDuration;
    for (let idx = 0; idx < designDuration; idx++) designExpenses[idx] += perDesign;
    for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += perConst;
  } else {
    const devDesign = totalRevenue * 0.02;
    const devConst = totalRevenue * 0.03;
    const perDesign = devDesign / designDuration;
    const perConst = devConst / constructionDuration;
    for (let idx = 0; idx < designDuration; idx++) designExpenses[idx] += perDesign;
    for (let idx = 0; idx < constructionDuration; idx++) constructionExpenses[idx] += perConst;
  }

  // ─── الإنشاء ───
  if (isScenario3 || isScenario4) {
    // 100% from investor
    constructionExpenses[0] += constructionCost * 0.10;
    constructionExpenses[1] += constructionCost * 0.04;
    constructionExpenses[2] += constructionCost * 0.07;
    constructionExpenses[3] += constructionCost * 0.09;
    const sCurveTotal = constructionCost * 0.60;
    const remainingMonths = constructionDuration - 4;
    const sCurveWeights = generateSCurve(remainingMonths);
    for (let idx = 0; idx < remainingMonths; idx++) {
      constructionExpenses[4 + idx] += sCurveTotal * sCurveWeights[idx];
    }
    postExpenses[1] += constructionCost * 0.05; // 5% completion
    postExpenses[2] += constructionCost * 0.05; // 5% retention
  } else if (isScenario2) {
    // 30% from investor (10%+4%+7%+9%)
    constructionExpenses[0] += constructionCost * 0.10;
    constructionExpenses[1] += constructionCost * 0.04;
    constructionExpenses[2] += constructionCost * 0.07;
    constructionExpenses[3] += constructionCost * 0.09;
  } else {
    // S1: 20% deposit + 10% advance = 30%
    designExpenses[penultimateDesign] += constructionCost * r.escrowDeposit; // 20%
    constructionExpenses[0] += constructionCost * r.advancePayment; // 10%
  }

  // ─── الإيرادات ───
  if (isScenario3) {
    // 100% split equally month 2 & 3 post
    postRevenue[1] += totalRevenue / 2;
    postRevenue[2] += totalRevenue / 2;
  } else if (!isScenario4) {
    // S1/S2: 20% direct to investor over 12 months post
    const directRevenue = totalRevenue * 0.20;
    const perMonth = directRevenue / 12;
    for (let idx = 0; idx < 12; idx++) postRevenue[idx] += perMonth;
  }
  // S4: no revenue

  // ─── Escrow surplus recovery (S1/S2 only) ───
  let escrowSurplusMonth3 = 0;
  let escrowSurplusMonth13 = 0;
  if (!isScenario3 && !isScenario4) {
    // Calculate what escrow received (80% of revenue via S-Curve + 20% deposit in S1)
    const escrowReceived80 = totalRevenue * 0.80;
    const escrowDepositAmt = isScenario2 ? 0 : constructionCost * r.escrowDeposit; // 20% of construction in S1
    const totalEscrowIn = escrowReceived80 + escrowDepositAmt;

    // Calculate what escrow paid out
    let escrowPaidOut = 0;
    // Construction from escrow
    if (isScenario2) {
      // S2: escrow pays from month 5 (60% S-Curve + 5% + 5% = 70%)
      escrowPaidOut += constructionCost * 0.70;
    } else {
      // S1: escrow pays from month 2 (4%+7%+9%+60%+5%+5% = 90%)
      escrowPaidOut += constructionCost * 0.90;
    }
    // Supervision from escrow
    escrowPaidOut += costs.supervisionFee;
    // Surveyor from escrow
    escrowPaidOut += i.surveyorFee;
    // Gov fees 90% from escrow
    escrowPaidOut += i.govFeesTotal * 0.90;
    // Sales commission from escrow
    escrowPaidOut += costs.salesCommission;
    // RERA auditor from escrow
    escrowPaidOut += i.reraAuditorReport;
    // RERA inspection from escrow
    escrowPaidOut += i.reraInspection;

    const escrowSurplus = totalEscrowIn - escrowPaidOut;
    const retention5pct = totalRevenue * 0.05;

    // Month 3 post: surplus minus 5% retention
    escrowSurplusMonth3 = Math.max(0, escrowSurplus - retention5pct);
    // Month 13 post: the 5% retention
    escrowSurplusMonth13 = retention5pct;

    // Add to revenue timeline
    if (postDuration > 2) postRevenue[2] += escrowSurplusMonth3; // month 3 post (index 2)
    if (postDuration > 12) postRevenue[12] += escrowSurplusMonth13; // month 13 post (index 12)
  }

  // ─── Flatten to single timeline ───
  const totalMonths = designDuration + constructionDuration + postDuration;
  const monthlyExpenses = new Array(totalMonths).fill(0);
  const monthlyRevenue2 = new Array(totalMonths).fill(0);

  for (let idx = 0; idx < designDuration; idx++) monthlyExpenses[idx] = designExpenses[idx];
  for (let idx = 0; idx < constructionDuration; idx++) monthlyExpenses[designDuration + idx] = constructionExpenses[idx];
  for (let idx = 0; idx < postDuration; idx++) monthlyExpenses[designDuration + constructionDuration + idx] = postExpenses[idx];

  for (let idx = 0; idx < postDuration; idx++) monthlyRevenue2[designDuration + constructionDuration + idx] = postRevenue[idx];

  const monthlyNet = monthlyRevenue2.map((rev, idx) => rev - monthlyExpenses[idx]);

  // Calculate start month offset from global start (Aug 2026)
  const startDate = i.startDate || "2026-08";
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const globalStartYear = 2026;
  const globalStartMonth = 8; // August
  const startMonthOffset = (startYear - globalStartYear) * 12 + (startMonth - globalStartMonth);

  return {
    id: project.id,
    name: project.name || "مشروع بدون اسم",
    scenario,
    startMonthOffset,
    designDuration,
    constructionDuration,
    postDuration,
    totalMonths,
    monthlyExpenses,
    monthlyRevenue: monthlyRevenue2,
    monthlyNet,
    totalExpenses: monthlyExpenses.reduce((s, v) => s + v, 0),
    totalRevenue: monthlyRevenue2.reduce((s, v) => s + v, 0),
    escrowSurplusMonth3,
    escrowSurplusMonth13,
  };
}

// ═══════════════════════════════════════════
// FORMAT
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (Math.abs(n) < 1) return "–";
  return Math.round(n).toLocaleString("en-US");
}

function getMonthLabel(offset: number): string {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const globalMonth = 8 + offset; // Aug 2026 = month 8
  const year = 2026 + Math.floor((globalMonth - 1) / 12);
  const monthIdx = ((globalMonth - 1) % 12);
  return `${months[monthIdx]} ${year}`;
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ConsolidatedInvestorCashFlowPage() {
  const { user } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  // Per-project scenario overrides (what-if)
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<number, Scenario>>({});

  const getScenario = (project: any): Scenario => {
    if (scenarioOverrides[project.id]) return scenarioOverrides[project.id];
    // Default from DB
    const dbScenario = project.financingScenario || "offplan_escrow";
    if (dbScenario === "rental") return "rental";
    if (dbScenario === "no_offplan") return "no_offplan";
    if (dbScenario === "offplan_construction") return "offplan_construction";
    return "offplan_escrow";
  };

  const consolidated = useMemo(() => {
    if (!projectsQuery.data || projectsQuery.data.length === 0) return null;

    const projectFlows: ProjectCashFlow[] = projectsQuery.data.map((proj: any) => {
      const scenario = getScenario(proj);
      return computeProjectCashFlow(proj, scenario);
    });

    // Find global timeline range
    let maxGlobalMonth = 0;
    for (const pf of projectFlows) {
      const end = pf.startMonthOffset + pf.totalMonths;
      if (end > maxGlobalMonth) maxGlobalMonth = end;
    }

    // Build consolidated arrays
    const totalMonths = maxGlobalMonth;
    const consolidatedExpenses = new Array(totalMonths).fill(0);
    const consolidatedRevenue = new Array(totalMonths).fill(0);
    const consolidatedNet = new Array(totalMonths).fill(0);
    const perProjectMonthly: Record<number, number[]> = {};

    for (const pf of projectFlows) {
      perProjectMonthly[pf.id] = new Array(totalMonths).fill(0);
      for (let m = 0; m < pf.totalMonths; m++) {
        const globalIdx = pf.startMonthOffset + m;
        if (globalIdx >= 0 && globalIdx < totalMonths) {
          consolidatedExpenses[globalIdx] += pf.monthlyExpenses[m];
          consolidatedRevenue[globalIdx] += pf.monthlyRevenue[m];
          consolidatedNet[globalIdx] += pf.monthlyNet[m];
          perProjectMonthly[pf.id][globalIdx] = pf.monthlyNet[m];
        }
      }
    }

    // Cumulative
    const cumulative = new Array(totalMonths).fill(0);
    let running = 0;
    for (let idx = 0; idx < totalMonths; idx++) {
      running += consolidatedNet[idx];
      cumulative[idx] = running;
    }

    // Month labels
    const monthLabels = Array.from({ length: totalMonths }, (_, idx) => getMonthLabel(idx));

    return {
      projectFlows,
      totalMonths,
      consolidatedExpenses,
      consolidatedRevenue,
      consolidatedNet,
      cumulative,
      monthLabels,
      perProjectMonthly,
    };
  }, [projectsQuery.data, scenarioOverrides]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">يرجى تسجيل الدخول</p>
      </div>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (!consolidated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">لا توجد مشاريع</p>
      </div>
    );
  }

  const totalExpenses = consolidated.consolidatedExpenses.reduce((s, v) => s + v, 0);
  const totalRevenue = consolidated.consolidatedRevenue.reduce((s, v) => s + v, 0);
  const peakExpense = Math.max(...consolidated.cumulative.map(v => Math.abs(v)));
  const peakMonth = consolidated.cumulative.indexOf(-peakExpense) >= 0
    ? consolidated.monthLabels[consolidated.cumulative.indexOf(-peakExpense)]
    : consolidated.monthLabels[consolidated.cumulative.indexOf(Math.min(...consolidated.cumulative))];

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            التدفقات النقدية المجمّعة — جميع المشاريع
          </h1>
          <p className="text-sm text-gray-500">
            بداية أغسطس 2026 | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-xs text-red-600 mb-1">إجمالي المصروفات</div>
            <div className="text-lg font-bold text-red-700">{fmt(totalExpenses)}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs text-green-600 mb-1">إجمالي الإيرادات</div>
            <div className="text-lg font-bold text-green-700">{fmt(totalRevenue)}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-600 mb-1">صافي الاستثمار</div>
            <div className="text-lg font-bold text-blue-700">{fmt(totalExpenses - totalRevenue)}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs text-amber-600 mb-1">ذروة رأس المال</div>
            <div className="text-lg font-bold text-amber-700">{fmt(peakExpense)}</div>
            <div className="text-[10px] text-amber-500">{peakMonth}</div>
          </div>
        </div>

        {/* Project Scenario Selector */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <h2 className="text-sm font-bold text-gray-700 mb-2">اختيار السيناريو لكل مشروع</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {consolidated.projectFlows.map((pf) => (
              <div key={pf.id} className="flex items-center gap-2 bg-white rounded p-2 border">
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{pf.name}</span>
                <select
                  value={pf.scenario}
                  onChange={(e) => setScenarioOverrides(prev => ({ ...prev, [pf.id]: e.target.value as Scenario }))}
                  className="text-[10px] border rounded px-1 py-0.5 bg-white"
                >
                  <option value="offplan_escrow">س1 — أوف بلان + ضمان</option>
                  <option value="offplan_construction">س2 — أوف بلان بدون إيداع</option>
                  <option value="no_offplan">س3 — بيع بعد الإنجاز</option>
                  <option value="rental">س4 — تطوير للتأجير</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Projects Summary Table */}
        <div className="bg-gray-50 border rounded-lg overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-3 border-b">ملخص المشاريع</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-right py-2 px-3 text-gray-600">المشروع</th>
                  <th className="text-center py-2 px-3 text-gray-600">السيناريو</th>
                  <th className="text-center py-2 px-3 text-gray-600">مدة التصميم</th>
                  <th className="text-center py-2 px-3 text-gray-600">مدة الإنشاء</th>
                  <th className="text-left py-2 px-3 text-red-600">المصروفات</th>
                  <th className="text-left py-2 px-3 text-green-600">الإيرادات</th>
                  <th className="text-left py-2 px-3 text-blue-600">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.projectFlows.map((pf) => (
                  <tr key={pf.id} className="border-b hover:bg-white">
                    <td className="py-2 px-3 font-medium text-gray-800">{pf.name}</td>
                    <td className="py-2 px-3 text-center text-gray-500">
                      {pf.scenario === "offplan_escrow" ? "س1" : pf.scenario === "offplan_construction" ? "س2" : pf.scenario === "no_offplan" ? "س3" : "س4"}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-500">{pf.designDuration} شهر</td>
                    <td className="py-2 px-3 text-center text-gray-500">{pf.constructionDuration} شهر</td>
                    <td className="py-2 px-3 text-red-600">{fmt(pf.totalExpenses)}</td>
                    <td className="py-2 px-3 text-green-600">{fmt(pf.totalRevenue)}</td>
                    <td className="py-2 px-3 text-blue-600 font-medium">{fmt(pf.totalRevenue - pf.totalExpenses)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2">
                  <td className="py-2 px-3 text-gray-800">الإجمالي</td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-red-700">{fmt(totalExpenses)}</td>
                  <td className="py-2 px-3 text-green-700">{fmt(totalRevenue)}</td>
                  <td className="py-2 px-3 text-blue-700">{fmt(totalRevenue - totalExpenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Monthly Cash Flow Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-3 border-b">التدفقات النقدية الشهرية</h2>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="sticky right-0 bg-gray-50 z-20 text-right py-2 px-2 border-b text-gray-600 min-w-[100px]">
                    الشهر
                  </th>
                  {consolidated.projectFlows.map((pf) => (
                    <th key={pf.id} className="text-center py-2 px-1 border-b text-gray-600 min-w-[80px]">
                      {pf.name.length > 12 ? pf.name.substring(0, 12) + "…" : pf.name}
                    </th>
                  ))}
                  <th className="text-center py-2 px-1 border-b text-red-600 min-w-[80px] font-bold">المصروفات</th>
                  <th className="text-center py-2 px-1 border-b text-green-600 min-w-[80px] font-bold">الإيرادات</th>
                  <th className="text-center py-2 px-1 border-b text-blue-600 min-w-[80px] font-bold">صافي الشهر</th>
                  <th className="text-center py-2 px-1 border-b text-amber-600 min-w-[90px] font-bold">التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.monthLabels.map((label, idx) => {
                  // Skip empty months
                  const hasData = consolidated.consolidatedExpenses[idx] !== 0 || consolidated.consolidatedRevenue[idx] !== 0;
                  if (!hasData && idx > 0 && Math.abs(consolidated.cumulative[idx] - consolidated.cumulative[idx - 1]) < 1) return null;

                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="sticky right-0 bg-white py-1 px-2 text-gray-700 font-medium border-l text-[10px]">
                        {label}
                      </td>
                      {consolidated.projectFlows.map((pf) => {
                        const val = consolidated.perProjectMonthly[pf.id]?.[idx] || 0;
                        return (
                          <td key={pf.id} className={`text-center py-1 px-1 ${val > 0 ? "text-green-600" : val < 0 ? "text-red-600" : "text-gray-300"}`}>
                            {Math.abs(val) > 1 ? fmt(val) : "–"}
                          </td>
                        );
                      })}
                      <td className="text-center py-1 px-1 text-red-600 font-medium">
                        {consolidated.consolidatedExpenses[idx] > 1 ? fmt(consolidated.consolidatedExpenses[idx]) : "–"}
                      </td>
                      <td className="text-center py-1 px-1 text-green-600 font-medium">
                        {consolidated.consolidatedRevenue[idx] > 1 ? fmt(consolidated.consolidatedRevenue[idx]) : "–"}
                      </td>
                      <td className="text-center py-1 px-1 text-blue-600 font-medium">
                        {Math.abs(consolidated.consolidatedNet[idx]) > 1 ? fmt(consolidated.consolidatedNet[idx]) : "–"}
                      </td>
                      <td className={`text-center py-1 px-1 font-bold ${consolidated.cumulative[idx] >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {fmt(consolidated.cumulative[idx])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100">
                <tr className="border-t-2 border-gray-400">
                  <td className="sticky right-0 bg-gray-100 py-2 px-2 font-bold text-gray-800">الإجمالي</td>
                  {consolidated.projectFlows.map((pf) => (
                    <td key={pf.id} className="text-center py-2 px-1 font-bold text-gray-700">
                      {fmt(pf.totalRevenue - pf.totalExpenses)}
                    </td>
                  ))}
                  <td className="text-center py-2 px-1 font-bold text-red-700">{fmt(totalExpenses)}</td>
                  <td className="text-center py-2 px-1 font-bold text-green-700">{fmt(totalRevenue)}</td>
                  <td className="text-center py-2 px-1 font-bold text-blue-700">{fmt(totalRevenue - totalExpenses)}</td>
                  <td className="text-center py-2 px-1 font-bold text-amber-700">
                    {fmt(consolidated.cumulative[consolidated.cumulative.length - 1] || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
