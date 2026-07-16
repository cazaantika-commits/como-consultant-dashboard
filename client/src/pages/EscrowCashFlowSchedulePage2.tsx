import { useProjectContext } from "@/contexts/ProjectContext";
import React, { useMemo, useRef, useState } from "react";
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
// SCENARIO TYPES
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
interface CostRow {
  label: string;
  totalCost: number;
  escrowAmount: number;
  openingBalance: number;
  remainingToSpend: number;
  section: string;
  isRevenue?: boolean;
  designMonths: number[];
  constructionMonths: number[];
  postConstructionMonths: number[];
}

// ═══════════════════════════════════════════
// S-CURVE DISTRIBUTION
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

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const POST_CONSTRUCTION_MONTHS = 12;

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function EscrowCashFlowSchedulePage2() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const tableRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const i: ProjectInputs = projectQuery.data ? dbProjectToInputs(projectQuery.data) : PROJECT_INPUTS;
    const r: ProjectRates = projectQuery.data ? dbProjectToRates(projectQuery.data) : RATES;
    const pf = calculateProjectFormulas(i, r);
    // === Read actual pricing data from project record (same as ProjectCard) ===
    const p = projectQuery.data as any;
    const defAreas = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
    const defPrices = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };
    const hasSavedCounts = p && [p.residential1brCount, p.residential2brCount, p.residential3brCount, p.retailSmallCount, p.retailMediumCount, p.retailLargeCount, p.officeSmallCount, p.officeMediumCount, p.officeLargeCount].some((v: any) => Number(v) > 0);
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
    const units = [
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
    const pr = calculatePricingFormulas(units);
    const costs = calculateCosts(pf, pr, i, r);

    const designDuration = i.designDuration;
    const constructionDuration = i.constructionDuration;
    const postDuration = POST_CONSTRUCTION_MONTHS;

    const emptyDesign = () => new Array(designDuration).fill(0);
    const emptyConstruction = () => new Array(constructionDuration).fill(0);
    const emptyPost = () => new Array(postDuration).fill(0);

    // ═══════════════════════════════════════════
    // KEY AMOUNTS
    // ═══════════════════════════════════════════
    const constructionCost = pf.constructionCost;
    const escrowDeposit = constructionCost * r.escrowDeposit; // 20%

    // ═══════════════════════════════════════════
    // S-CURVE for construction months
    // ═══════════════════════════════════════════
    const sCurve = generateSCurve(constructionDuration);

    // ═══════════════════════════════════════════
    // SCENARIO-SPECIFIC PARAMETERS
    // ═══════════════════════════════════════════
    // Scenario 1: Opening balance = 20% deposit (penultimate design month), investor pays 10% month 1
    //             Revenue from construction month 4, commission from month 6
    //             Marketing from penultimate design month, sorting/RERA/NOC/escrow fee in penultimate design month
    // Scenario 2: No deposit, investor pays 10% month 1 + 20% (4%+7%+9%) months 2-3-4
    //             Revenue from construction month 6, commission from month 9
    //             Marketing from construction month 4, sorting/RERA/NOC/escrow fee in construction month 4

    const isScenario2 = scenario === "offplan_construction";
    const isScenario3 = scenario === "no_offplan";
    const openingBalance = (isScenario2 || isScenario3) ? 0 : escrowDeposit;
    const revenueStartMonth = isScenario2 ? 5 : 3; // 0-indexed: S2=month 6(idx 5), S1=month 4(idx 3)
    const commissionStartMonth = isScenario2 ? 8 : 5; // 0-indexed: S2=month 9(idx 8), S1=month 6(idx 5)

    // Scenario 3: post-construction months = 3 (not 12)
    const effectivePostDuration = isScenario3 ? 3 : postDuration;

    // ═══════════════════════════════════════════
    // BUILD ROWS
    // ═══════════════════════════════════════════
    const rows: CostRow[] = [];

    // Helper for post arrays (respects scenario 3's shorter post period)
    const emptyEffectivePost = () => new Array(effectivePostDuration).fill(0);

    // ─── 1. تكلفة الإنشاء ───
    // Scenario 1 (escrow): 10% paid by investor directly (NOT from escrow), escrow pays:
    //   Month 2: 4%, Month 3: 7%, Month 4: 9%, Month 5+: 60% S-Curve, Post: 5% completion + 5% retention = 90%
    // Scenario 2 (escrow): Investor pays 10% + 20% (months 1-4) directly, escrow pays:
    //   Month 5+: 60% S-Curve, Post: 5% completion + 5% retention = 70%
    {
      const sCurveTotal = constructionCost * 0.60;
      const completionPayment = constructionCost * 0.05;
      const retentionPayment = constructionCost * 0.05;

      const cMonths = emptyConstruction();

      if (isScenario2) {
        // Scenario 2: investor pays 30% directly (10%+4%+7%+9%), escrow pays 60% S-Curve from month 5
        const remainingMonths = constructionDuration - 4;
        const sCurveRemaining = generateSCurve(remainingMonths);
        for (let i = 0; i < remainingMonths; i++) {
          cMonths[4 + i] = sCurveTotal * sCurveRemaining[i];
        }
      } else if (!isScenario3) {
        // Scenario 1: investor pays 10% directly (month 1), escrow pays 4%+7%+9%+60% S-Curve
        // Escrow starts paying from month 2
        cMonths[1] = constructionCost * 0.04; // Month 2
        cMonths[2] = constructionCost * 0.07; // Month 3
        cMonths[3] = constructionCost * 0.09; // Month 4
        // Month 5 onwards: 60% S-Curve
        const remainingMonths = constructionDuration - 4;
        const sCurveRemaining = generateSCurve(remainingMonths);
        for (let i = 0; i < remainingMonths; i++) {
          cMonths[4 + i] = sCurveTotal * sCurveRemaining[i];
        }
      } else {
        // Scenario 3: all construction from escrow, 80% S-Curve
        const sCurve80 = constructionCost * 0.80;
        for (let i = 0; i < constructionDuration; i++) {
          cMonths[i] = sCurve80 * sCurve[i];
        }
      }

      const pMonths = emptyEffectivePost();
      if (isScenario3) {
        pMonths[1] = completionPayment;
        if (effectivePostDuration > 2) pMonths[2] = retentionPayment;
      } else {
        pMonths[1] = completionPayment; // post-construction month 2 (index 1)
        if (effectivePostDuration > 11) pMonths[11] = retentionPayment; // post-construction month 12 (index 11)
      }

      // Escrow amount: S1 = 90% (all except 10% advance), S2 = 70% (all except 30%)
      const escrowAmount = isScenario2 
        ? constructionCost * 0.70 
        : constructionCost * 0.90;

      rows.push({
        label: "تكلفة الإنشاء",
        totalCost: constructionCost,
        escrowAmount,
        openingBalance: (isScenario2 || isScenario3) ? 0 : escrowDeposit,
        remainingToSpend: escrowAmount,
        section: "الإنشاء",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: pMonths,
      });
    }

    // ─── 2. أتعاب الإشراف ───
    {
      const amount = costs.supervisionFee;
      const cMonths = emptyConstruction();
      const perMonth = amount / constructionDuration;
      for (let i = 0; i < constructionDuration; i++) {
        cMonths[i] = perMonth;
      }

      rows.push({
        label: "أتعاب الإشراف",
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "التصاميم والإشراف",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyEffectivePost(),
      });
    }

    // ─── 3. رسوم المساح ───
    {
      const amount = i.surveyorFee;
      const cMonths = emptyConstruction();
      const penultimateIndex = constructionDuration - 2;
      cMonths[penultimateIndex] = amount;

      rows.push({
        label: "رسوم المساح",
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "الدراسات والمسوحات",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyEffectivePost(),
      });
    }

    // ─── 4. رسوم الجهات الحكومية (90%) ───
    {
      const amount = costs.govFeesEscrow;
      const cMonths = emptyConstruction();
      const half = amount / 2;
      cMonths[2] = half; // month 3
      cMonths[7] = half; // month 8

      rows.push({
        label: "رسوم الجهات الحكومية",
        totalCost: i.govFeesTotal,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "الرسوم الحكومية والتنظيمية",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyEffectivePost(),
      });
    }

    // ─── 5. تقرير مدقق ريرا (سيناريو 1 و 2 فقط) ───
    if (!isScenario3) {
      const amount = i.reraAuditorReport;
      const cMonths = emptyConstruction();
      const perPayment = amount / 3;
      const m1 = Math.floor(constructionDuration / 3) - 1;
      const m2 = Math.floor((2 * constructionDuration) / 3) - 1;
      const m3 = constructionDuration - 1;
      cMonths[m1] = perPayment;
      cMonths[m2] = perPayment;
      cMonths[m3] = perPayment;

      rows.push({
        label: "تقرير مدقق ريرا",
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "ريرا (التنظيم العقاري)",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyEffectivePost(),
      });
    }

    // ─── 6. فحص ريرا (سيناريو 1 و 2 فقط) ───
    if (!isScenario3) {
      const amount = i.reraInspection;
      const cMonths = emptyConstruction();
      const inspectionIndices: number[] = [];
      for (let i = 2; i < constructionDuration; i += 3) {
        inspectionIndices.push(i);
      }
      const perVisit = amount / inspectionIndices.length;
      for (const idx of inspectionIndices) {
        cMonths[idx] = perVisit;
      }

      rows.push({
        label: "فحص ريرا",
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "ريرا (التنظيم العقاري)",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyEffectivePost(),
      });
    }

    // ─── 7. عمولة المبيعات ───
    // Scenario 1: starts from construction month 6 (index 5) over 12 months (5%)
    // Scenario 2: starts from construction month 9 (index 8) over 12 months (5%)
    // Scenario 3: 2% over 3 post-construction months
    {
      const amount = isScenario3
        ? pr.totalRevenue * r.salesCommissionPostCompletion // 2%
        : costs.salesCommission; // 5%
      const cMonths = emptyConstruction();
      const pMonths = emptyEffectivePost();

      if (isScenario3) {
        const perMonth = amount / effectivePostDuration;
        for (let i = 0; i < effectivePostDuration; i++) {
          pMonths[i] = perMonth;
        }
      } else {
        const commissionMonths = 12;
        const perMonth = amount / commissionMonths;
        let monthsPlaced = 0;
        // Place in construction months
        for (let i = commissionStartMonth; i < constructionDuration && monthsPlaced < commissionMonths; i++) {
          cMonths[i] = perMonth;
          monthsPlaced++;
        }
        // Overflow into post-construction if needed
        for (let i = 0; i < effectivePostDuration && monthsPlaced < commissionMonths; i++) {
          pMonths[i] = perMonth;
          monthsPlaced++;
        }
      }

      rows.push({
        label: "عمولة المبيعات" + (isScenario3 ? " (2%)" : " (5%)"),
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "المبيعات والتسويق",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: pMonths,
      });
    }



    // ═══════════════════════════════════════════
    // REVENUE ROW — إيرادات المبيعات
    // Scenario 1: 80% S-Curve from construction month 4 (index 3) — 20% goes directly to investor NOT escrow
    // Scenario 2: 80% S-Curve from construction month 6 (index 5) — 20% goes directly to investor NOT escrow
    // Scenario 3: 100% equally over 3 post-construction months (no construction revenue)
    // ═══════════════════════════════════════════
    const revenueRow: CostRow = (() => {
      const totalRevenue = pr.totalRevenue;

      const cMonths = emptyConstruction();
      const pMonths = emptyEffectivePost();

      if (isScenario3) {
        const perMonth = totalRevenue / effectivePostDuration;
        for (let i = 0; i < effectivePostDuration; i++) {
          pMonths[i] = perMonth;
        }
      } else {
        // Only 80% enters escrow (S-Curve during construction)
        // 20% goes directly to investor after completion — NOT in escrow
        const constructionRevenue = totalRevenue * 0.80;

        // S1: starts from month 4 (index 3), S2: starts from month 6 (index 5)
        const remainingMonths = constructionDuration - revenueStartMonth;
        const revSCurve = generateSCurve(remainingMonths);
        for (let i = 0; i < remainingMonths; i++) {
          cMonths[revenueStartMonth + i] = constructionRevenue * revSCurve[i];
        }
        // No post-construction revenue in escrow — 20% goes to investor directly
      }

      const escrowRevenue = isScenario3 ? totalRevenue : totalRevenue * 0.80;
      return {
        label: isScenario3 ? "إيرادات المبيعات" : "إيرادات المبيعات (80%)",
        totalCost: escrowRevenue,
        escrowAmount: escrowRevenue,
        openingBalance: 0,
        remainingToSpend: escrowRevenue,
        section: "الإيرادات",
        isRevenue: true,
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: pMonths,
      };
    })();

    // ═══════════════════════════════════════════
    // TOTALS
    // ═══════════════════════════════════════════
    const totalEscrowExpenses = rows.reduce((s, r) => s + r.escrowAmount, 0);
    const totalRevenue = pr.totalRevenue;

    // Monthly totals (expenses)
    const designMonthlyTotals = new Array(designDuration).fill(0);
    const constructionMonthlyTotals = new Array(constructionDuration).fill(0);
    const postMonthlyTotals = new Array(effectivePostDuration).fill(0);
    for (const row of rows) {
      for (let i = 0; i < designDuration; i++) designMonthlyTotals[i] += row.designMonths[i];
      for (let i = 0; i < constructionDuration; i++) constructionMonthlyTotals[i] += row.constructionMonths[i];
      for (let i = 0; i < effectivePostDuration; i++) postMonthlyTotals[i] += row.postConstructionMonths[i];
    }

    // Revenue monthly totals
    const revenueDesignTotals = revenueRow.designMonths;
    const revenueConstructionTotals = revenueRow.constructionMonths;
    const revenuePostTotals = revenueRow.postConstructionMonths;

    // Net flow (revenue - expenses) per month
    const netDesign = designMonthlyTotals.map((v, i) => revenueDesignTotals[i] - v);
    const netConstruction = constructionMonthlyTotals.map((v, i) => revenueConstructionTotals[i] - v);
    const netPost = postMonthlyTotals.map((v, i) => revenuePostTotals[i] - v);

    // Cumulative balance (starting with opening balance)
    const cumulativeDesign = new Array(designDuration).fill(0);
    const cumulativeConstruction = new Array(constructionDuration).fill(0);
    const cumulativePost = new Array(effectivePostDuration).fill(0);
    let running = openingBalance;
    for (let i = 0; i < designDuration; i++) {
      running += netDesign[i];
      cumulativeDesign[i] = running;
    }
    for (let i = 0; i < constructionDuration; i++) {
      running += netConstruction[i];
      cumulativeConstruction[i] = running;
    }
    for (let i = 0; i < effectivePostDuration; i++) {
      running += netPost[i];
      cumulativePost[i] = running;
    }

    // Sections
    const sectionOrder = [
      "الإيرادات",
      "التصاميم والإشراف",
      "الدراسات والمسوحات",
      "الرسوم الحكومية والتنظيمية",
      "ريرا (التنظيم العقاري)",
      "المبيعات والتسويق",
      "الإنشاء",
    ];

    return {
      rows,
      revenueRow,
      sectionOrder,
      totalEscrowExpenses,
      totalRevenue,
      openingBalance,
      designDuration,
      constructionDuration,
      postDuration: effectivePostDuration,
      designMonthlyTotals,
      constructionMonthlyTotals,
      postMonthlyTotals,
      revenueDesignTotals,
      revenueConstructionTotals,
      revenuePostTotals,
      netDesign,
      netConstruction,
      netPost,
      cumulativeDesign,
      cumulativeConstruction,
      cumulativePost,
    };
  }, [scenario, projectQuery.data]);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  const {
    rows,
    revenueRow,
    sectionOrder,
    totalEscrowExpenses,
    totalRevenue,
    openingBalance,
    designDuration,
    constructionDuration,
    postDuration,
    designMonthlyTotals,
    constructionMonthlyTotals,
    postMonthlyTotals,
    revenueDesignTotals,
    revenueConstructionTotals,
    revenuePostTotals,
    netDesign,
    netConstruction,
    netPost,
    cumulativeDesign,
    cumulativeConstruction,
    cumulativePost,
  } = data;

  const totalColumns = 6 + designDuration + constructionDuration + postDuration;

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">
        {/* Project Selector */}
        <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            تدفقات حساب الضمان – {projectQuery.data?.name || 'مجان متعدد الاستخدامات'}
          </h1>
          <p className="text-sm text-gray-500">
            توزيع المصروفات والإيرادات على المراحل الزمنية | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Scenario Buttons */}
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

        {/* Scenario Description */}
        {scenario === "offplan_construction" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>السيناريو الثاني:</strong> لا يوجد إيداع 20% — تُدفع للمقاول في أشهر 2+3+4 مقابل إنجازه المسبق. الإيرادات وعمولة المبيعات تبدأ من الشهر 5. التسويق من الشهر 1 على 12 شهر. رسوم الفرز/ريرا/NOC/الضمان في الشهر 3.
          </div>
        )}
        {scenario === "no_offplan" && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
            <strong>السيناريو الثالث:</strong> تطوير بدون بيع على الخارطة — المطور يبني بالكامل من أمواله. الإيرادات + العمولة (2%) + التسويق (1%) + رسوم الفرز + تسجيل الوحدات + NOC كلها بعد الإنجاز خلال 3 أشهر. لا يوجد حساب ضمان ولا ريرا.
          </div>
        )}

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
                <th className="border border-gray-600 px-2 py-2 text-center bg-blue-900" rowSpan={2}>من الضمان</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-green-900" rowSpan={2}>الرصيد الافتتاحي</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-red-900" rowSpan={2}>المتبقي صرفه</th>
                {designDuration > 0 && (
                  <th
                    className="border border-gray-600 px-2 py-2 text-center bg-purple-800"
                    colSpan={designDuration}
                  >
                    التصاميم ({designDuration} أشهر)
                  </th>
                )}
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-green-800"
                  colSpan={constructionDuration}
                >
                  الإنشاء ({constructionDuration} شهر)
                </th>
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-amber-700"
                  colSpan={postDuration}
                >
                  بعد الإنجاز ({postDuration} شهر)
                </th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-yellow-700" rowSpan={2}>تحقق</th>
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>
              {/* Header Row 2 — Month Numbers */}
              <tr className="bg-gray-700 text-white">
                {Array.from({ length: designDuration }, (_, i) => (
                  <th key={`dh${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-purple-700">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: constructionDuration }, (_, i) => (
                  <th key={`ch${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-green-700">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: postDuration }, (_, i) => (
                  <th key={`ph${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-amber-600">
                    ش{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionOrder.map((section) => {
                const sectionRows =
                  section === "الإيرادات"
                    ? [revenueRow]
                    : rows.filter((r) => r.section === section);
                if (sectionRows.length === 0) return null;
                return (
                  <React.Fragment key={section}>
                    {/* Section Rows */}
                    {sectionRows.map((row, idx) => (
                      <tr
                        key={`${section}-${idx}`}
                        className={`hover:bg-blue-50/30 ${row.isRevenue ? "bg-green-100 font-bold border-t-2 border-b-2 border-green-400" : ""}`}
                      >
                        <td className={`sticky right-0 z-10 border border-gray-200 px-2 py-1.5 text-right whitespace-nowrap ${row.isRevenue ? "bg-green-100 text-green-900 font-bold" : "bg-white text-gray-800"}`}>
                          {row.label}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-800">
                          {fmt(row.totalCost)}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-blue-700 font-semibold">
                          {fmt(row.escrowAmount)}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-green-700 font-semibold">
                          {row.openingBalance > 0 ? fmt(row.openingBalance) : "–"}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-red-700 font-semibold">
                          {fmt(row.remainingToSpend)}
                        </td>
                        {/* Design Months */}
                        {row.designMonths.map((v, i) => (
                          <td key={`d${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
                            {v > 0 ? fmt(v) : "–"}
                          </td>
                        ))}
                        {/* Construction Months */}
                        {row.constructionMonths.map((v, i) => (
                          <td key={`c${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
                            {v > 0 ? fmt(v) : "–"}
                          </td>
                        ))}
                        {/* Post-Construction Months */}
                        {row.postConstructionMonths.map((v, i) => (
                          <td key={`p${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
                            {v > 0 ? fmt(v) : "–"}
                          </td>
                        ))}
                        {/* Validation Column */}
                        {(() => {
                          // Skip revenue rows or fully pre-paid items
                          if (row.isRevenue || row.openingBalance >= row.escrowAmount) {
                            return <td className="border border-gray-200 px-1 py-1.5 text-center text-gray-400">–</td>;
                          }
                          const distributedSum = row.designMonths.reduce((s, v) => s + v, 0) + row.constructionMonths.reduce((s, v) => s + v, 0) + row.postConstructionMonths.reduce((s, v) => s + v, 0);
                          const expected = row.escrowAmount;
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
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Footer — Totals + Net + Cumulative */}
            <tfoot>
              {/* Expenses Total Row */}
              <tr className="bg-red-50 font-bold border-t-2 border-red-300">
                <td className="sticky right-0 z-20 bg-red-50 border border-gray-200 px-2 py-2 text-right text-red-900">
                  إجمالي المصروفات
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-900">
                  {fmt(totalEscrowExpenses)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-800">
                  {fmt(totalEscrowExpenses)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-700">
                  {fmt(openingBalance)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-700">
                  {fmt(totalEscrowExpenses - openingBalance)}
                </td>
                {designMonthlyTotals.map((v, i) => (
                  <td key={`dt${i}`} className="border border-gray-200 px-1 py-2 text-center text-red-800">
                    {fmt(v)}
                  </td>
                ))}
                {constructionMonthlyTotals.map((v, i) => (
                  <td key={`ct${i}`} className="border border-gray-200 px-1 py-2 text-center text-red-800">
                    {fmt(v)}
                  </td>
                ))}
                {postMonthlyTotals.map((v, i) => (
                  <td key={`pt${i}`} className="border border-gray-200 px-1 py-2 text-center text-red-800">
                    {fmt(v)}
                  </td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>

              {/* Revenue Total Row */}
              <tr className="bg-green-50 font-bold">
                <td className="sticky right-0 z-20 bg-green-50 border border-gray-200 px-2 py-2 text-right text-green-900">
                  إجمالي الإيرادات
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-900">
                  {fmt(totalRevenue)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-800">
                  {fmt(totalRevenue)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                {revenueDesignTotals.map((v, i) => (
                  <td key={`rd${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">
                    {fmt(v)}
                  </td>
                ))}
                {revenueConstructionTotals.map((v, i) => (
                  <td key={`rc${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">
                    {fmt(v)}
                  </td>
                ))}
                {revenuePostTotals.map((v, i) => (
                  <td key={`rp${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">
                    {fmt(v)}
                  </td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>

              {/* Net Flow Row */}
              <tr className="bg-amber-50 font-bold border-t-2 border-amber-300">
                <td className="sticky right-0 z-20 bg-amber-50 border border-gray-200 px-2 py-2 text-right text-amber-900">
                  صافي التدفق (إيرادات - مصروفات)
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-amber-900">
                  {fmt(totalRevenue - totalEscrowExpenses)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                {netDesign.map((v, i) => (
                  <td key={`nd${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                {netConstruction.map((v, i) => (
                  <td key={`nc${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                {netPost.map((v, i) => (
                  <td key={`np${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>

              {/* Cumulative Balance Row */}
              <tr className="bg-indigo-50 font-semibold">
                <td className="sticky right-0 z-20 bg-indigo-50 border border-gray-200 px-2 py-2 text-right text-indigo-900">
                  الرصيد التراكمي
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-indigo-900">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-700">
                  {fmt(openingBalance)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                {cumulativeDesign.map((v, i) => (
                  <td key={`cd${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                {cumulativeConstruction.map((v, i) => (
                  <td key={`cc${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                {cumulativePost.map((v, i) => (
                  <td key={`cp${i}`} className={`border border-gray-200 px-1 py-2 text-center ${v >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-green-500">
            <p className="text-xs text-gray-500">
              {scenario === "offplan_escrow" ? "الرصيد الافتتاحي (إيداع 20%)" : scenario === "no_offplan" ? "الرصيد الافتتاحي (بدون حساب ضمان)" : "الرصيد الافتتاحي (بدون إيداع)"}
            </p>
            <p className="text-lg font-bold text-green-700">{fmt(openingBalance)} د.إ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-red-500">
            <p className="text-xs text-gray-500">{scenario === "no_offplan" ? "إجمالي المصروفات" : "إجمالي المصروفات من الضمان"}</p>
            <p className="text-lg font-bold text-red-700">{fmt(totalEscrowExpenses)} د.إ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-blue-500">
            <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
            <p className="text-lg font-bold text-blue-700">{fmt(totalRevenue)} د.إ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-amber-500">
            <p className="text-xs text-gray-500">صافي التدفق</p>
            <p className="text-lg font-bold text-amber-700">
              {fmt(totalRevenue - totalEscrowExpenses)} د.إ
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-indigo-500">
            <p className="text-xs text-gray-500">الرصيد النهائي</p>
            <p className={`text-lg font-bold ${(cumulativePost[postDuration - 1] ?? 0) >= 0 ? "text-indigo-700" : "text-red-700"}`}>
              {fmt(cumulativePost[postDuration - 1] ?? 0)} د.إ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
