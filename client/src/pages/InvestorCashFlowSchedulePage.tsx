import { useProjectContext } from "@/contexts/ProjectContext";
import { useState, useMemo, useRef } from "react";
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
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ═══════════════════════════════════════════
// أنواع السيناريوهات
// ═══════════════════════════════════════════
type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "–";
  return Math.round(n).toLocaleString("en-US");
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
type Funder = "investor" | "escrow" | "split";

interface CostRow {
  label: string;
  totalCost: number;
  investorAmount: number;
  paid: number;
  unpaid: number;
  funder: Funder;
  section: string;
  designMonths: number[];
  constructionMonths: number[];
}

// ═══════════════════════════════════════════
// DISTRIBUTION HELPERS
// ═══════════════════════════════════════════

/**
 * توزيع أتعاب التصاميم على المدة الفعلية
 * 7 مراحل: 10%, 15%, 20%, 35%, 10%, 5%, 5%
 * لو المدة >= 7: كل مرحلة في شهر، Detailed يُقسم على الأشهر الإضافية
 * لو المدة < 7: تُدمج المراحل الأخيرة
 */
function distributeDesignFee(totalFee: number, months: number): number[] {
  const stages = [0.10, 0.15, 0.20, 0.35, 0.10, 0.05, 0.05];
  const result = new Array(months).fill(0);

  if (months >= 7) {
    // كل مرحلة في شهر، Detailed (35%) يُقسم على الأشهر الإضافية
    const extraMonths = months - 6; // أشهر إضافية بعد أول 3 مراحل + Tender + 2 Approvals
    // ش1=10%, ش2=15%, ش3=20%, ش4..ش(3+extra)=35%/extra, ش(months-2)=10%, ش(months-1)=5%, ش(months)=5%
    result[0] = totalFee * stages[0]; // 10%
    result[1] = totalFee * stages[1]; // 15%
    result[2] = totalFee * stages[2]; // 20%
    // Detailed Design split across extra months
    const detailedPerMonth = (totalFee * stages[3]) / extraMonths;
    for (let i = 3; i < 3 + extraMonths; i++) {
      result[i] = detailedPerMonth;
    }
    result[months - 3] += totalFee * stages[4]; // Tender 10%
    result[months - 2] += totalFee * stages[5]; // Preliminary Approval 5%
    result[months - 1] += totalFee * stages[6]; // Final Approval 5%
  } else {
    // المدة < 7: أول (months-1) مراحل كل واحدة في شهر، الباقي يُدمج في الشهر الأخير
    for (let i = 0; i < months - 1 && i < stages.length; i++) {
      result[i] = totalFee * stages[i];
    }
    // باقي المراحل تُدمج في الشهر الأخير
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
function distributeEqual(total: number, months: number, arr: number[], startIndex: number = 0) {
  const perMonth = total / months;
  for (let i = startIndex; i < startIndex + months && i < arr.length; i++) {
    arr[i] = perMonth;
  }
}

/**
 * توزيع رسوم المجتمع: كل 6 أشهر بدءاً من شهر 1
 * المبلغ الإجمالي يُقسم على عدد الدفعات
 */
function distributeCommunityFee(
  total: number,
  designMonths: number,
  constructionMonths: number
): { design: number[]; construction: number[] } {
  const totalMonths = designMonths + constructionMonths;
  // حساب عدد الدفعات (كل 6 أشهر من شهر 1)
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
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function InvestorCashFlowSchedulePage() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const tableRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const i: ProjectInputs = projectQuery.data ? dbProjectToInputs(projectQuery.data) : PROJECT_INPUTS;
    const r: ProjectRates = projectQuery.data ? dbProjectToRates(projectQuery.data) : RATES;
    const projectFormulas = calculateProjectFormulas(i, r);
    // === Read actual pricing data from project record (same as ProjectCard) ===
    const p = projectQuery.data as any;
    const defAreas = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
    const defPrices = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };
    const hasSavedCounts = p && [p.residential1brCount, p.residential2brCount, p.residential3brCount, p.retailSmallCount, p.retailMediumCount, p.retailLargeCount, p.officeSmallCount, p.officeMediumCount, p.officeLargeCount].some((v: any) => Number(v) > 0);
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

    const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
    const { totalRevenue, totalUnits } = pricingFormulas;
    const designDuration = i.designDuration;
    const constructionDuration = i.constructionDuration;
    const penultimateDesign = designDuration - 2; // الشهر قبل الأخير (0-indexed)

    // Helper: empty month arrays
    const emptyDesign = () => new Array(designDuration).fill(0);
    const emptyConstruction = () => new Array(constructionDuration).fill(0);

    // ═══════════════════════════════════════════
    // BUILD ROWS — نفس بنود البطاقة بالضبط + التوزيع
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
    });

    // أتعاب الإشراف — من الضمان
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
    });

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
    });

    // ─── رسوم المساح — من الضمان ───
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
    });

    // ─── رسوم المجتمع (كل 6 أشهر من شهر 1) ───
    const communityDist = distributeCommunityFee(
      i.communityFee,
      designDuration,
      constructionDuration
    );
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
    });

    // ─── رسوم الجهات الحكومية (10% مستثمر — شهر 2 تصاميم) ───
    const govDesign = emptyDesign();
    govDesign[1] = costs.govFeesInvestor; // شهر 2 (index 1)
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
    });

    // ─── رسوم الفرز (الشهر قبل الأخير من التصميم) ───
    const sortingDesign = emptyDesign();
    sortingDesign[penultimateDesign] = costs.sortingFee;
    rows.push({
      label: "رسوم الفرز",
      totalCost: costs.sortingFee,
      investorAmount: costs.sortingFee,
      paid: 0,
      unpaid: costs.sortingFee,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: sortingDesign,
      constructionMonths: emptyConstruction(),
    });

    // ─── رسوم NOC ───
    const nocDesign = emptyDesign();
    nocDesign[penultimateDesign] = i.nocSale;
    rows.push({
      label: "رسوم NOC المطور",
      totalCost: i.nocSale,
      investorAmount: i.nocSale,
      paid: 0,
      unpaid: i.nocSale,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: nocDesign,
      constructionMonths: emptyConstruction(),
    });

    // ─── تسجيل المشروع — ريرا ───
    const reraRegDesign = emptyDesign();
    reraRegDesign[penultimateDesign] = i.reraProjectReg;
    rows.push({
      label: "تسجيل المشروع — ريرا",
      totalCost: i.reraProjectReg,
      investorAmount: i.reraProjectReg,
      paid: 0,
      unpaid: i.reraProjectReg,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: reraRegDesign,
      constructionMonths: emptyConstruction(),
    });

    // ─── تسجيل الوحدات — ريرا ───
    const reraUnitsDesign = emptyDesign();
    reraUnitsDesign[penultimateDesign] = costs.reraUnits;
    rows.push({
      label: "تسجيل الوحدات — ريرا",
      totalCost: costs.reraUnits,
      investorAmount: costs.reraUnits,
      paid: 0,
      unpaid: costs.reraUnits,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: reraUnitsDesign,
      constructionMonths: emptyConstruction(),
    });

    // ─── حساب الضمان (رسوم فتح) — الشهر قبل الأخير ───
    const escrowFeeDesign = emptyDesign();
    escrowFeeDesign[penultimateDesign] = i.escrowAccountFee;
    rows.push({
      label: "حساب الضمان (رسوم فتح)",
      totalCost: i.escrowAccountFee,
      investorAmount: i.escrowAccountFee,
      paid: 0,
      unpaid: i.escrowAccountFee,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: escrowFeeDesign,
      constructionMonths: emptyConstruction(),
    });

    // ─── رسوم البنك (شهرياً من شهر 1 إنشاء) ───
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
    });

    // ─── تقرير مدقق ريرا — من الضمان ───
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
    });

    // ─── فحص ريرا — من الضمان ───
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
    });

    // ─── عمولة المبيعات — من الضمان ───
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
    });

    // ─── التسويق (25% شهر قبل الأخير تصاميم + 75% أول 6 أشهر إنشاء) ───
    const marketingDesign = emptyDesign();
    const marketingConstruction = emptyConstruction();
    const marketing25 = costs.marketing * 0.25;
    const marketing75 = costs.marketing * 0.75;
    marketingDesign[penultimateDesign] = marketing25;
    const marketingMonths = Math.min(6, constructionDuration);
    const marketing75PerMonth = marketing75 / marketingMonths;
    for (let i = 0; i < marketingMonths; i++) {
      marketingConstruction[i] = marketing75PerMonth;
    }
    rows.push({
      label: "التسويق",
      totalCost: costs.marketing,
      investorAmount: costs.marketing,
      paid: 0,
      unpaid: costs.marketing,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: marketingDesign,
      constructionMonths: marketingConstruction,
    });

    // ─── أتعاب المطور (2% تصميم بالتساوي + 3% إنشاء بالتساوي) ───
    const devFeeDesign = emptyDesign();
    const devFeeConstruction = emptyConstruction();
    const devFee2pct = totalRevenue * r.developerFeeDesign; // 1% — لكن المستخدم قال 2%
    // المستخدم قال: 2% مرحلة التصميم + 3% مرحلة الإنشاء = 5% إجمالي
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
    });

    // ─── الإنشاء ───
    // إيداع حساب الضمان (20%) — الشهر قبل الأخير تصاميم
    // دفعة مقدمة مقاول (10%) — شهر 1 إنشاء
    // المجموع من المستثمر = 30% من تكلفة الإنشاء
    const constructionDesign = emptyDesign();
    const constructionConst = emptyConstruction();
    const escrowDeposit = constructionCost * r.escrowDeposit; // 20%
    const advancePayment = constructionCost * r.advancePayment; // 10%
    constructionDesign[penultimateDesign] = escrowDeposit;
    constructionConst[0] = advancePayment;
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
    });

    // ═══════════════════════════════════════════
    // TOTALS
    // ═══════════════════════════════════════════
    const grandTotalCost = costs.totalCosts;
    const grandInvestor = costs.totalInvestor;
    const grandPaid = rows.reduce((s, r) => s + r.paid, 0);
    const grandUnpaid = grandInvestor - grandPaid;

    // Monthly totals (investor only)
    const designMonthlyTotals = new Array(designDuration).fill(0);
    const constructionMonthlyTotals = new Array(constructionDuration).fill(0);
    for (const row of rows) {
      if (row.funder === "escrow") continue;
      for (let i = 0; i < designDuration; i++) designMonthlyTotals[i] += row.designMonths[i];
      for (let i = 0; i < constructionDuration; i++) constructionMonthlyTotals[i] += row.constructionMonths[i];
    }

    // Cumulative (investor)
    const cumulativeDesign = new Array(designDuration).fill(0);
    const cumulativeConstruction = new Array(constructionDuration).fill(0);
    let running = grandPaid;
    for (let i = 0; i < designDuration; i++) {
      running += designMonthlyTotals[i];
      cumulativeDesign[i] = running;
    }
    for (let i = 0; i < constructionDuration; i++) {
      running += constructionMonthlyTotals[i];
      cumulativeConstruction[i] = running;
    }

    // Sections
    const sections = [
      "الأرض",
      "التصاميم والإشراف",
      "الدراسات والمسوحات",
      "الرسوم الحكومية والتنظيمية",
      "ريرا (التنظيم العقاري)",
      "المبيعات والتسويق",
      "الإنشاء",
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
      cumulativeDesign,
      cumulativeConstruction,
      designDuration,
      constructionDuration,
    };
  }, [scenario, projectQuery.data]);

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">

        {/* Project Selector */}
        <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            جدولة رأس المال – {projectQuery.data?.name || 'مجان متعدد الاستخدامات'}
          </h1>
          <p className="text-sm text-gray-500">
            توزيع المصاريف على المراحل الزمنية حسب إعدادات التدفق | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Scenario Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setScenario("offplan_escrow")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "offplan_escrow"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            أوف بلان مع إيداع في حساب الضمان
          </button>
          <button
            onClick={() => setScenario("offplan_construction")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "offplan_construction"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            أوف بلان بعد إنجاز 20% من الإنشاء
          </button>
          <button
            onClick={() => setScenario("no_offplan")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "no_offplan"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            تطوير بدون بيع على الخارطة
          </button>
        </div>

        {/* Table */}
        <div ref={tableRef} className="overflow-x-auto border rounded-lg">
          <table className="w-max min-w-full text-xs border-collapse">
            <thead>
              {/* Header Row 1 — Groups */}
              <tr className="bg-gray-800 text-white">
                <th className="sticky right-0 z-30 bg-gray-800 border border-gray-600 px-2 py-2 text-right min-w-[180px]" rowSpan={2}>
                  الوصف
                </th>
                <th className="border border-gray-600 px-2 py-2 text-center" rowSpan={2}>إجمالي التكاليف</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-blue-900" rowSpan={2}>إجمالي المستثمر</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-green-900" rowSpan={2}>مدفوع</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-red-900" rowSpan={2}>غير مدفوع</th>
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-purple-800"
                  colSpan={data.designDuration}
                >
                  التصاميم ({data.designDuration} أشهر)
                </th>
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-green-800"
                  colSpan={data.constructionDuration}
                >
                  الإنشاء ({data.constructionDuration} شهر)
                </th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-yellow-700" rowSpan={2}>تحقق</th>
              </tr>
              {/* Header Row 2 — Month Numbers */}
              <tr className="bg-gray-700 text-white">
                {Array.from({ length: data.designDuration }, (_, i) => (
                  <th key={`dh${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-purple-700">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: data.constructionDuration }, (_, i) => (
                  <th key={`ch${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-green-700">
                    ش{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sections.map((section) => {
                const sectionRows = data.rows.filter(r => r.section === section);
                if (sectionRows.length === 0) return null;
                return (
                  <SectionGroup
                    key={section}
                    title={section}
                    rows={sectionRows}
                    designDuration={data.designDuration}
                    constructionDuration={data.constructionDuration}
                  />
                );
              })}
            </tbody>
            {/* Footer — Totals + Cumulative */}
            <tfoot>
              <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-300">
                <td className="sticky right-0 z-20 bg-indigo-50 border border-gray-200 px-2 py-2 text-right text-indigo-900">إجمالي</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-indigo-900">{fmt(data.grandTotalCost)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-blue-800">{fmt(data.grandInvestor)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-800">{fmt(data.grandPaid)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-800">{fmt(data.grandUnpaid)}</td>
                {data.designMonthlyTotals.map((v, i) => (
                  <td key={`dt${i}`} className="border border-gray-200 px-1 py-2 text-center text-indigo-800">{fmt(v)}</td>
                ))}
                {data.constructionMonthlyTotals.map((v, i) => (
                  <td key={`ct${i}`} className="border border-gray-200 px-1 py-2 text-center text-indigo-800">{fmt(v)}</td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="sticky right-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-right text-gray-700">إجمالي تراكمي (مستثمر)</td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                {data.cumulativeDesign.map((v, i) => (
                  <td key={`cd${i}`} className="border border-gray-200 px-1 py-2 text-center text-gray-700">{fmt(v)}</td>
                ))}
                {data.cumulativeConstruction.map((v, i) => (
                  <td key={`cc${i}`} className="border border-gray-200 px-1 py-2 text-center text-gray-700">{fmt(v)}</td>
                ))}
                <td className="border border-gray-200"></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SECTION GROUP COMPONENT
// ═══════════════════════════════════════════
function SectionGroup({
  title,
  rows,
  designDuration,
  constructionDuration,
}: {
  title: string;
  rows: CostRow[];
  designDuration: number;
  constructionDuration: number;
}) {
  return (
    <>
      {/* Section Rows */}
      {rows.map((row, idx) => (
        <tr key={idx} className="hover:bg-blue-50/30">
          <td className="sticky right-0 z-10 bg-white border border-gray-200 px-2 py-1.5 text-right text-gray-800 whitespace-nowrap">
            {row.label}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-800">{fmt(row.totalCost)}</td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-blue-700">
            {row.funder === "escrow" ? (
              <span className="text-gray-400">من الضمان</span>
            ) : (
              fmt(row.investorAmount)
            )}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-green-700">
            {row.paid > 0 ? fmt(row.paid) : "–"}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-red-700">
            {row.funder === "escrow" ? (
              <span className="text-gray-400">من الضمان</span>
            ) : row.unpaid > 0 ? (
              fmt(row.unpaid)
            ) : (
              "–"
            )}
          </td>
          {/* Design Months */}
          {row.designMonths.map((v, i) => (
            <td key={`d${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
              {row.funder === "escrow" ? (
                <span className="text-gray-300">–</span>
              ) : v > 0 ? (
                fmt(v)
              ) : (
                "–"
              )}
            </td>
          ))}
          {/* Construction Months */}
          {row.constructionMonths.map((v, i) => (
            <td key={`c${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
              {row.funder === "escrow" ? (
                <span className="text-gray-300">–</span>
              ) : v > 0 ? (
                fmt(v)
              ) : (
                "–"
              )}
            </td>
          ))}
          {/* Validation Column */}
          {(() => {
            // For escrow items or fully paid items (no distribution needed), show dash
            if (row.funder === "escrow" || row.paid >= row.totalCost) {
              return <td className="border border-gray-200 px-1 py-1.5 text-center text-gray-400">–</td>;
            }
            const distributedSum = row.designMonths.reduce((s, v) => s + v, 0) + row.constructionMonths.reduce((s, v) => s + v, 0);
            // Compare with investorAmount (the actual amount being distributed)
            const expected = row.investorAmount;
            const diff = Math.abs(distributedSum - expected);
            const isMatch = diff < 1;
            return (
              <td className={`border border-gray-200 px-1 py-1.5 text-center font-bold ${isMatch ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-100'}`}>
                {isMatch ? "✓" : <span title={`الفرق: ${fmt(diff)}`}>✗ {fmt(diff)}</span>}
              </td>
            );
          })()}
        </tr>
      ))}
    </>
  );
}
