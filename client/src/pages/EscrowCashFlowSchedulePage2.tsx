import React, { useMemo, useRef } from "react";
import {
  PROJECT_INPUTS,
  RATES,
  PRICING_DEFAULTS,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
} from "@/lib/projectData";

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
/**
 * S-Curve: توزيع بمنحنى S (بطيء-سريع-بطيء)
 * cumulative(i) = 1 / (1 + e^(-k*(t-0.5)))
 * k=6, t=i/n
 * Returns array of monthly fractions that sum to 1
 */
function generateSCurve(months: number): number[] {
  const k = 6;
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-k * (t - 0.5)));
  const cumValues: number[] = [];
  for (let i = 0; i <= months; i++) {
    cumValues.push(sigmoid(i / months));
  }
  // Monthly increments (normalized)
  const raw: number[] = [];
  for (let i = 1; i <= months; i++) {
    raw.push(cumValues[i] - cumValues[i - 1]);
  }
  // Normalize to exactly sum to 1
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
  const tableRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const pf = calculateProjectFormulas();
    const units = PRICING_DEFAULTS.map((u) => ({
      name: u.name,
      category: u.category,
      area: u.defaultArea,
      price: u.defaultPrice,
      count: u.defaultCount,
    }));
    const pr = calculatePricingFormulas(units);
    const costs = calculateCosts(pf, pr);

    const designDuration = PROJECT_INPUTS.designDuration;
    const constructionDuration = PROJECT_INPUTS.constructionDuration;
    const postDuration = POST_CONSTRUCTION_MONTHS;

    const emptyDesign = () => new Array(designDuration).fill(0);
    const emptyConstruction = () => new Array(constructionDuration).fill(0);
    const emptyPost = () => new Array(postDuration).fill(0);

    // ═══════════════════════════════════════════
    // KEY AMOUNTS
    // ═══════════════════════════════════════════
    const constructionCost = pf.constructionCost;
    const escrowDeposit = constructionCost * RATES.escrowDeposit; // 20%
    const constructionEscrow90 = constructionCost * 0.90; // 90% total from escrow (80% S-Curve + 5% + 5%)

    // ═══════════════════════════════════════════
    // S-CURVE for construction months
    // ═══════════════════════════════════════════
    const sCurve = generateSCurve(constructionDuration);

    // ═══════════════════════════════════════════
    // BUILD ROWS
    // ═══════════════════════════════════════════
    const rows: CostRow[] = [];

    // ─── 1. تكلفة الإنشاء ───
    // escrowAmount = 90% of constructionCost (315,108,000)
    // openingBalance = 20% (70,024,000) — investor deposit into escrow
    // remaining = 70% (245,084,000) — what escrow needs from revenue
    // Monthly distribution: 80% S-Curve over construction + 5% at post month 2 + 5% at post month 12
    {
      const escrowAmount = constructionEscrow90; // 90%
      const openingBal = escrowDeposit; // 20%
      const remaining = constructionCost * RATES.constructionEscrowShare; // 70%
      const sCurveTotal = constructionCost * 0.80;
      const completionPayment = constructionCost * 0.05;
      const retentionPayment = constructionCost * 0.05;

      const cMonths = emptyConstruction();
      for (let i = 0; i < constructionDuration; i++) {
        cMonths[i] = sCurveTotal * sCurve[i];
      }

      const pMonths = emptyPost();
      pMonths[1] = completionPayment; // post-construction month 2 (index 1)
      pMonths[11] = retentionPayment; // post-construction month 12 (index 11)

      rows.push({
        label: "تكلفة الإنشاء",
        totalCost: constructionCost,
        escrowAmount,
        openingBalance: openingBal,
        remainingToSpend: remaining,
        section: "الإنشاء",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: pMonths,
      });
    }

    // ─── 2. أتعاب الإشراف ───
    // Equally over construction months
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
        postConstructionMonths: emptyPost(),
      });
    }

    // ─── 3. رسوم المساح ───
    // Penultimate construction month (month 29 of 30 = index 28)
    {
      const amount = PROJECT_INPUTS.surveyorFee;
      const cMonths = emptyConstruction();
      const penultimateIndex = constructionDuration - 2; // 0-indexed
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
        postConstructionMonths: emptyPost(),
      });
    }

    // ─── 4. رسوم الجهات الحكومية (90%) ───
    // 45% at construction month 3 (index 2) + 45% at construction month 8 (index 7)
    {
      const amount = costs.govFeesEscrow;
      const cMonths = emptyConstruction();
      const half = amount / 2;
      cMonths[2] = half; // month 3
      cMonths[7] = half; // month 8

      rows.push({
        label: "رسوم الجهات الحكومية",
        totalCost: PROJECT_INPUTS.govFeesTotal,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "الرسوم الحكومية والتنظيمية",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyPost(),
      });
    }

    // ─── 5. تقرير مدقق ريرا ───
    // 3 times evenly during construction
    {
      const amount = PROJECT_INPUTS.reraAuditorReport;
      const cMonths = emptyConstruction();
      const perPayment = amount / 3;
      const m1 = Math.floor(constructionDuration / 3) - 1; // ~month 10 (index 9)
      const m2 = Math.floor((2 * constructionDuration) / 3) - 1; // ~month 20 (index 19)
      const m3 = constructionDuration - 1; // last month (index 29)
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
        postConstructionMonths: emptyPost(),
      });
    }

    // ─── 6. فحص ريرا ───
    // Every 3 months during construction (months 3,6,9,...,30 = indices 2,5,8,...,29)
    {
      const amount = PROJECT_INPUTS.reraInspection;
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
        postConstructionMonths: emptyPost(),
      });
    }

    // ─── 7. عمولة المبيعات ───
    // Equally over first 12 construction months
    {
      const amount = costs.salesCommission;
      const cMonths = emptyConstruction();
      const salesMonths = Math.min(12, constructionDuration);
      const perMonth = amount / salesMonths;
      for (let i = 0; i < salesMonths; i++) {
        cMonths[i] = perMonth;
      }

      rows.push({
        label: "عمولة المبيعات",
        totalCost: amount,
        escrowAmount: amount,
        openingBalance: 0,
        remainingToSpend: amount,
        section: "المبيعات والتسويق",
        designMonths: emptyDesign(),
        constructionMonths: cMonths,
        postConstructionMonths: emptyPost(),
      });
    }

    // ═══════════════════════════════════════════
    // REVENUE ROW — إيرادات المبيعات
    // 80% S-Curve during construction + 20% equally over 12 post-construction months
    // ═══════════════════════════════════════════
    const revenueRow: CostRow = (() => {
      const totalRevenue = pr.totalRevenue;
      const constructionRevenue = totalRevenue * 0.80;
      const postRevenue = totalRevenue * 0.20;

      const cMonths = emptyConstruction();
      for (let i = 0; i < constructionDuration; i++) {
        cMonths[i] = constructionRevenue * sCurve[i];
      }

      const pMonths = emptyPost();
      const postPerMonth = postRevenue / postDuration;
      for (let i = 0; i < postDuration; i++) {
        pMonths[i] = postPerMonth;
      }

      return {
        label: "إيرادات المبيعات",
        totalCost: totalRevenue,
        escrowAmount: totalRevenue,
        openingBalance: 0,
        remainingToSpend: totalRevenue,
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
    const postMonthlyTotals = new Array(postDuration).fill(0);
    for (const row of rows) {
      for (let i = 0; i < designDuration; i++) designMonthlyTotals[i] += row.designMonths[i];
      for (let i = 0; i < constructionDuration; i++) constructionMonthlyTotals[i] += row.constructionMonths[i];
      for (let i = 0; i < postDuration; i++) postMonthlyTotals[i] += row.postConstructionMonths[i];
    }

    // Revenue monthly totals
    const revenueDesignTotals = revenueRow.designMonths;
    const revenueConstructionTotals = revenueRow.constructionMonths;
    const revenuePostTotals = revenueRow.postConstructionMonths;

    // Net flow (revenue - expenses) per month
    const netDesign = designMonthlyTotals.map((v, i) => revenueDesignTotals[i] - v);
    const netConstruction = constructionMonthlyTotals.map((v, i) => revenueConstructionTotals[i] - v);
    const netPost = postMonthlyTotals.map((v, i) => revenuePostTotals[i] - v);

    // Cumulative balance (starting with opening balance = escrow deposit)
    const cumulativeDesign = new Array(designDuration).fill(0);
    const cumulativeConstruction = new Array(constructionDuration).fill(0);
    const cumulativePost = new Array(postDuration).fill(0);
    let running = escrowDeposit; // start with opening balance
    for (let i = 0; i < designDuration; i++) {
      running += netDesign[i];
      cumulativeDesign[i] = running;
    }
    for (let i = 0; i < constructionDuration; i++) {
      running += netConstruction[i];
      cumulativeConstruction[i] = running;
    }
    for (let i = 0; i < postDuration; i++) {
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
      escrowDeposit,
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
    };
  }, []);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  const {
    rows,
    revenueRow,
    sectionOrder,
    totalEscrowExpenses,
    totalRevenue,
    escrowDeposit,
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

  const totalColumns = 5 + designDuration + constructionDuration + postDuration;

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">
        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            تدفقات حساب الضمان – {PROJECT_INPUTS.name}
          </h1>
          <p className="text-sm text-gray-500">
            توزيع المصروفات والإيرادات على المراحل الزمنية | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Scenario Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button className="px-4 py-2 rounded text-sm font-medium bg-blue-700 text-white">
            أوف بلان مع إيداع في حساب الضمان
          </button>
          <button className="px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
            أوف بلان بعد إنجاز 20% من الإنشاء
          </button>
          <button className="px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
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
                    {/* Section Header */}
                    <tr className="bg-gray-100">
                      <td
                        colSpan={totalColumns}
                        className="sticky right-0 z-10 px-2 py-1.5 text-right font-bold text-gray-800 text-xs border border-gray-200"
                      >
                        {section}
                      </td>
                    </tr>
                    {/* Section Rows */}
                    {sectionRows.map((row, idx) => (
                      <tr
                        key={`${section}-${idx}`}
                        className={`hover:bg-blue-50/30 ${row.isRevenue ? "bg-green-50/50" : ""}`}
                      >
                        <td className="sticky right-0 z-10 bg-white border border-gray-200 px-2 py-1.5 text-right text-gray-800 whitespace-nowrap">
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
                  {fmt(escrowDeposit)}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-700">
                  {fmt(totalEscrowExpenses - escrowDeposit)}
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
              </tr>

              {/* Cumulative Balance Row */}
              <tr className="bg-indigo-50 font-semibold">
                <td className="sticky right-0 z-20 bg-indigo-50 border border-gray-200 px-2 py-2 text-right text-indigo-900">
                  الرصيد التراكمي
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-indigo-900">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center">–</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-700">
                  {fmt(escrowDeposit)}
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
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-green-500">
            <p className="text-xs text-gray-500">الرصيد الافتتاحي (إيداع 20%)</p>
            <p className="text-lg font-bold text-green-700">{fmt(escrowDeposit)} د.إ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-r-4 border-red-500">
            <p className="text-xs text-gray-500">إجمالي المصروفات من الضمان</p>
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
            <p className={`text-lg font-bold ${cumulativePost[postDuration - 1] >= 0 ? "text-indigo-700" : "text-red-700"}`}>
              {fmt(cumulativePost[postDuration - 1])} د.إ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
