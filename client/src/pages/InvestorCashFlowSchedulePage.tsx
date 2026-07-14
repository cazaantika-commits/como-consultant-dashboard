import { useState, useMemo, useRef } from "react";
import {
  PROJECT_INPUTS,
  RATES,
  PRICING_DEFAULTS,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
} from "@/lib/projectData";

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
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function InvestorCashFlowSchedulePage() {
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const tableRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const projectFormulas = calculateProjectFormulas();
    const pricingUnits = PRICING_DEFAULTS.map(u => ({
      name: u.name,
      category: u.category,
      area: u.defaultArea,
      price: u.defaultPrice,
      count: u.defaultCount,
    }));
    const pricingFormulas = calculatePricingFormulas(pricingUnits);
    const costs = calculateCosts(projectFormulas, pricingFormulas);

    const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
    const { totalRevenue, totalUnits } = pricingFormulas;
    const designDuration = PROJECT_INPUTS.designDuration;
    const constructionDuration = PROJECT_INPUTS.constructionDuration;

    // Helper: empty month arrays
    const emptyDesign = () => new Array(designDuration).fill(0);
    const emptyConstruction = () => new Array(constructionDuration).fill(0);

    // ═══════════════════════════════════════════
    // BUILD ROWS — نفس بنود البطاقة بالضبط
    // ═══════════════════════════════════════════
    const rows: CostRow[] = [];

    // ─── الأرض ───
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
      label: "رسوم تسجيل الأرض (4%)",
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
      label: "عمولة وسيط الأرض (1%)",
      totalCost: landBroker,
      investorAmount: landBroker,
      paid: landBroker,
      unpaid: 0,
      funder: "investor",
      section: "الأرض",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── التصاميم والإشراف ───
    rows.push({
      label: "أتعاب التصاميم (1.8%)",
      totalCost: costs.designFee,
      investorAmount: costs.designFee,
      paid: 0,
      unpaid: costs.designFee,
      funder: "investor",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "أتعاب الإشراف (2%)",
      totalCost: costs.supervisionFee,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── الدراسات والمسوحات ───
    rows.push({
      label: "فحص التربة",
      totalCost: PROJECT_INPUTS.soilTest,
      investorAmount: PROJECT_INPUTS.soilTest,
      paid: 0,
      unpaid: PROJECT_INPUTS.soilTest,
      funder: "investor",
      section: "الدراسات والمسوحات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "المسح الطبوغرافي",
      totalCost: PROJECT_INPUTS.topography,
      investorAmount: PROJECT_INPUTS.topography,
      paid: 0,
      unpaid: PROJECT_INPUTS.topography,
      funder: "investor",
      section: "الدراسات والمسوحات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم المساح",
      totalCost: PROJECT_INPUTS.surveyorFee,
      investorAmount: PROJECT_INPUTS.surveyorFee,
      paid: 0,
      unpaid: PROJECT_INPUTS.surveyorFee,
      funder: "investor",
      section: "الدراسات والمسوحات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── الرسوم الحكومية والتنظيمية ───
    rows.push({
      label: "رسوم المجتمع",
      totalCost: PROJECT_INPUTS.communityFee,
      investorAmount: PROJECT_INPUTS.communityFee,
      paid: 0,
      unpaid: PROJECT_INPUTS.communityFee,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم الجهات الحكومية",
      totalCost: PROJECT_INPUTS.govFeesTotal,
      investorAmount: costs.govFeesInvestor,
      paid: 0,
      unpaid: costs.govFeesInvestor,
      funder: "split",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم الفرز (40 د/قدم²)",
      totalCost: costs.sortingFee,
      investorAmount: costs.sortingFee,
      paid: 0,
      unpaid: costs.sortingFee,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم NOC المطور",
      totalCost: PROJECT_INPUTS.nocSale,
      investorAmount: PROJECT_INPUTS.nocSale,
      paid: 0,
      unpaid: PROJECT_INPUTS.nocSale,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── ريرا (التنظيم العقاري) ───
    rows.push({
      label: "تسجيل المشروع — ريرا",
      totalCost: PROJECT_INPUTS.reraProjectReg,
      investorAmount: PROJECT_INPUTS.reraProjectReg,
      paid: 0,
      unpaid: PROJECT_INPUTS.reraProjectReg,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "تسجيل الوحدات — ريرا",
      totalCost: costs.reraUnits,
      investorAmount: costs.reraUnits,
      paid: 0,
      unpaid: costs.reraUnits,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "حساب الضمان (رسوم فتح)",
      totalCost: PROJECT_INPUTS.escrowAccountFee,
      investorAmount: PROJECT_INPUTS.escrowAccountFee,
      paid: 0,
      unpaid: PROJECT_INPUTS.escrowAccountFee,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم البنك",
      totalCost: PROJECT_INPUTS.bankFees,
      investorAmount: PROJECT_INPUTS.bankFees,
      paid: 0,
      unpaid: PROJECT_INPUTS.bankFees,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "تقرير مدقق ريرا",
      totalCost: PROJECT_INPUTS.reraAuditorReport,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "فحص ريرا",
      totalCost: PROJECT_INPUTS.reraInspection,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── المبيعات والتسويق ───
    rows.push({
      label: "عمولة المبيعات (5%)",
      totalCost: costs.salesCommission,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "التسويق (2%)",
      totalCost: costs.marketing,
      investorAmount: costs.marketing,
      paid: 0,
      unpaid: costs.marketing,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "أتعاب المطور (5%)",
      totalCost: costs.developerFee,
      investorAmount: costs.developerFee,
      paid: 0,
      unpaid: costs.developerFee,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── الإنشاء ───
    rows.push({
      label: "تكلفة الإنشاء",
      totalCost: constructionCost,
      investorAmount: costs.constructionInvestor,
      paid: 0,
      unpaid: costs.constructionInvestor,
      funder: "split",
      section: "الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ═══════════════════════════════════════════
    // TOTALS — نفس معادلة البطاقة بالضبط
    // ═══════════════════════════════════════════
    const grandTotalCost = costs.totalCosts;
    const grandInvestor = costs.totalInvestor;
    const grandPaid = rows.reduce((s, r) => s + r.paid, 0);
    const grandUnpaid = grandInvestor - grandPaid;

    // Monthly totals (فارغة حالياً — سيتم التوزيع لاحقاً)
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
  }, [scenario]);

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            جدولة رأس المال – {PROJECT_INPUTS.name}
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
        <div ref={tableRef} className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-max min-w-full text-xs border-collapse">
            {/* Header Row 1 — Phase Groups */}
            <thead>
              <tr>
                <th className="sticky right-0 z-20 bg-white border border-gray-200 px-2 py-2 min-w-[180px]"></th>
                <th className="bg-indigo-900 text-white border border-gray-300 px-2 py-2 text-center font-bold">إجمالي التكاليف</th>
                <th className="bg-indigo-900 text-white border border-gray-300 px-2 py-2 text-center font-bold">إجمالي المستثمر</th>
                <th className="bg-green-700 text-white border border-gray-300 px-2 py-2 text-center font-bold">مدفوع</th>
                <th className="bg-red-700 text-white border border-gray-300 px-2 py-2 text-center font-bold">غير مدفوع</th>
                <th
                  colSpan={data.designDuration}
                  className="bg-purple-700 text-white border border-gray-300 px-2 py-2 text-center font-bold"
                >
                  التصاميم ({data.designDuration} أشهر)
                </th>
                <th
                  colSpan={data.constructionDuration}
                  className="bg-green-800 text-white border border-gray-300 px-2 py-2 text-center font-bold"
                >
                  الإنشاء ({data.constructionDuration} شهر)
                </th>
              </tr>
              {/* Header Row 2 — Individual Months */}
              <tr>
                <th className="sticky right-0 z-20 bg-gray-50 border border-gray-200 px-2 py-1.5 text-right font-semibold text-gray-700">الوصف</th>
                <th className="bg-gray-50 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">الإجمالي</th>
                <th className="bg-gray-50 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">من المستثمر</th>
                <th className="bg-gray-50 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">مدفوع</th>
                <th className="bg-gray-50 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">غير مدفوع</th>
                {Array.from({ length: data.designDuration }, (_, i) => (
                  <th key={`d${i}`} className="bg-purple-50 border border-gray-200 px-1 py-1.5 text-center font-medium text-purple-900 min-w-[70px]">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: data.constructionDuration }, (_, i) => (
                  <th key={`c${i}`} className="bg-green-50 border border-gray-200 px-1 py-1.5 text-center font-medium text-green-900 min-w-[70px]">
                    ش{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sections.map((section) => {
                const sectionRows = data.rows.filter(r => r.section === section);
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
      {/* Section Header */}
      <tr className="bg-gray-100">
        <td
          colSpan={5 + designDuration + constructionDuration}
          className="sticky right-0 z-10 px-2 py-1.5 text-right font-bold text-gray-800 text-xs border border-gray-200"
        >
          {title}
        </td>
      </tr>
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
              {v > 0 ? fmt(v) : "–"}
            </td>
          ))}
          {/* Construction Months */}
          {row.constructionMonths.map((v, i) => (
            <td key={`c${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
              {v > 0 ? fmt(v) : "–"}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
