import { useMemo, useState, useRef } from "react";
import {
  PROJECT_INPUTS,
  RATES,
  PRICING_DEFAULTS,
  calculateProjectFormulas,
  calculatePricingFormulas,
} from "@/lib/projectData";

// ═══════════════════════════════════════════
// أنواع السيناريوهات
// ═══════════════════════════════════════════
type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "تطوير بدون بيع على الخارطة", // Offplan with 20% construction completion
  no_offplan: "تطوير بدون بيع على الخارطة",
};

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
  paid: number; // مدفوع
  unpaid: number; // غير مدفوع
  funder: Funder;
  section: string;
  // Monthly distribution: index 0 = month 1 of design, etc.
  designMonths: number[]; // length = designDuration
  constructionMonths: number[]; // length = constructionDuration
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

    const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
    const { totalRevenue, totalUnits } = pricingFormulas;
    const designDuration = PROJECT_INPUTS.designDuration;
    const constructionDuration = PROJECT_INPUTS.constructionDuration;

    // Helper: create empty month arrays
    const emptyDesign = () => new Array(designDuration).fill(0);
    const emptyConstruction = () => new Array(constructionDuration).fill(0);

    // Helper: distribute evenly over design months
    const spreadDesign = (amount: number, startMonth = 0, endMonth = designDuration - 1) => {
      const arr = emptyDesign();
      const months = endMonth - startMonth + 1;
      for (let i = startMonth; i <= endMonth; i++) arr[i] = amount / months;
      return arr;
    };

    // Helper: distribute evenly over construction months
    const spreadConstruction = (amount: number, startMonth = 0, endMonth = constructionDuration - 1) => {
      const arr = emptyConstruction();
      const months = endMonth - startMonth + 1;
      for (let i = startMonth; i <= endMonth; i++) arr[i] = amount / months;
      return arr;
    };

    // Helper: single month in design
    const singleDesign = (amount: number, month: number) => {
      const arr = emptyDesign();
      if (month >= 0 && month < designDuration) arr[month] = amount;
      return arr;
    };

    // Helper: single month in construction
    const singleConstruction = (amount: number, month: number) => {
      const arr = emptyConstruction();
      if (month >= 0 && month < constructionDuration) arr[month] = amount;
      return arr;
    };

    // ═══════════════════════════════════════════
    // BUILD ROWS
    // ═══════════════════════════════════════════
    const rows: CostRow[] = [];

    // ─── القسم الأول — المبالغ المدفوعة (الأرض) ───
    rows.push({
      label: "سعر الأرض",
      totalCost: landPrice,
      investorAmount: landPrice,
      paid: landPrice,
      unpaid: 0,
      funder: "investor",
      section: "القسم الأول — المبالغ المدفوعة (الأرض)",
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
      section: "القسم الأول — المبالغ المدفوعة (الأرض)",
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
      section: "القسم الأول — المبالغ المدفوعة (الأرض)",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // ─── القسم الثاني — التصاميم ورخصة البناء ───
    const govFeesInvestor = PROJECT_INPUTS.govFeesTotal * RATES.govFeesInvestorShare;
    rows.push({
      label: "رسوم الجهات الحكومية (10%)",
      totalCost: PROJECT_INPUTS.govFeesTotal,
      investorAmount: govFeesInvestor,
      paid: 0,
      unpaid: govFeesInvestor,
      funder: "split",
      section: "القسم الثاني — التصاميم ورخصة البناء",
      designMonths: spreadDesign(govFeesInvestor),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "فحص تربة",
      totalCost: PROJECT_INPUTS.soilTest,
      investorAmount: PROJECT_INPUTS.soilTest,
      paid: 0,
      unpaid: PROJECT_INPUTS.soilTest,
      funder: "investor",
      section: "القسم الثاني — التصاميم ورخصة البناء",
      designMonths: singleDesign(PROJECT_INPUTS.soilTest, 0),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "المسح الطبوغرافي",
      totalCost: PROJECT_INPUTS.topography,
      investorAmount: PROJECT_INPUTS.topography,
      paid: 0,
      unpaid: PROJECT_INPUTS.topography,
      funder: "investor",
      section: "القسم الثاني — التصاميم ورخصة البناء",
      designMonths: singleDesign(PROJECT_INPUTS.topography, 0),
      constructionMonths: emptyConstruction(),
    });

    // أتعاب التصاميم — milestones: 30% شهر 2, 30% شهر 4, 20% شهر 6, 20% شهر 8
    const designFee = constructionCost * RATES.designFee;
    const designFeeMonths = emptyDesign();
    designFeeMonths[1] = designFee * 0.30; // شهر 2
    designFeeMonths[3] = designFee * 0.30; // شهر 4
    designFeeMonths[5] = designFee * 0.20; // شهر 6
    designFeeMonths[7] = designFee * 0.20; // شهر 8
    rows.push({
      label: "أتعاب الاستشاري — التصاميم (1.8%)",
      totalCost: designFee,
      investorAmount: designFee,
      paid: 0,
      unpaid: designFee,
      funder: "investor",
      section: "القسم الثاني — التصاميم ورخصة البناء",
      designMonths: designFeeMonths,
      constructionMonths: emptyConstruction(),
    });

    const devFeeDesign = totalRevenue * RATES.developerFeeDesign;
    rows.push({
      label: "أتعاب المطور — التصاميم (1%)",
      totalCost: devFeeDesign,
      investorAmount: devFeeDesign,
      paid: 0,
      unpaid: devFeeDesign,
      funder: "investor",
      section: "القسم الثاني — التصاميم ورخصة البناء",
      designMonths: spreadDesign(devFeeDesign),
      constructionMonths: emptyConstruction(),
    });

    // ─── القسم الثالث — ريرا والبيع أوف بلان ───
    // هذه البنود تُدفع في آخر شهرين من التصاميم (أوف بلان = شهر 7 و 8)
    const offplanStartMonth = designDuration - 2; // شهر 7 (index 6)

    const devFeeOffplan = totalRevenue * RATES.developerFeeOffplan;
    rows.push({
      label: "أتعاب المطور — أوف بلان (1%)",
      totalCost: devFeeOffplan,
      investorAmount: devFeeOffplan,
      paid: 0,
      unpaid: devFeeOffplan,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(devFeeOffplan, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    const sortingFee = gfaTotal * RATES.sortingFeePerSqft;
    rows.push({
      label: "رسوم الفرز (40 د/قدم²)",
      totalCost: sortingFee,
      investorAmount: sortingFee,
      paid: 0,
      unpaid: sortingFee,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(sortingFee, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "تسجيل بيع على الخارطة — ريرا",
      totalCost: PROJECT_INPUTS.reraProjectReg,
      investorAmount: PROJECT_INPUTS.reraProjectReg,
      paid: 0,
      unpaid: PROJECT_INPUTS.reraProjectReg,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(PROJECT_INPUTS.reraProjectReg, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    const reraUnits = totalUnits * RATES.reraUnitFee;
    rows.push({
      label: "تسجيل الوحدات — ريرا",
      totalCost: reraUnits,
      investorAmount: reraUnits,
      paid: 0,
      unpaid: reraUnits,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(reraUnits, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم NOC للبيع",
      totalCost: PROJECT_INPUTS.nocSale,
      investorAmount: PROJECT_INPUTS.nocSale,
      paid: 0,
      unpaid: PROJECT_INPUTS.nocSale,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(PROJECT_INPUTS.nocSale, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    rows.push({
      label: "رسوم حساب الضمان",
      totalCost: PROJECT_INPUTS.escrowAccountFee,
      investorAmount: PROJECT_INPUTS.escrowAccountFee,
      paid: 0,
      unpaid: PROJECT_INPUTS.escrowAccountFee,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(PROJECT_INPUTS.escrowAccountFee, offplanStartMonth),
      constructionMonths: emptyConstruction(),
    });

    const communityOffplan = PROJECT_INPUTS.communityFee * RATES.communityOffplanShare;
    rows.push({
      label: "رسوم المجتمع (25%)",
      totalCost: PROJECT_INPUTS.communityFee,
      investorAmount: communityOffplan,
      paid: 0,
      unpaid: communityOffplan,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(communityOffplan, offplanStartMonth + 1),
      constructionMonths: emptyConstruction(),
    });

    const marketingOffplan = totalRevenue * RATES.marketingTotal * RATES.marketingOffplanShare;
    rows.push({
      label: "التسويق والإعلان — أوف بلان (25%)",
      totalCost: marketingOffplan,
      investorAmount: marketingOffplan,
      paid: 0,
      unpaid: marketingOffplan,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: (() => {
        const arr = emptyDesign();
        arr[offplanStartMonth] = marketingOffplan / 2;
        arr[offplanStartMonth + 1] = marketingOffplan / 2;
        return arr;
      })(),
      constructionMonths: emptyConstruction(),
    });

    // إيداع حساب الضمان (20%)
    const escrowDeposit = constructionCost * RATES.escrowDeposit;
    rows.push({
      label: "إيداع حساب الضمان (20%)",
      totalCost: escrowDeposit,
      investorAmount: escrowDeposit,
      paid: 0,
      unpaid: escrowDeposit,
      funder: "investor",
      section: "القسم الثالث — ريرا والبيع أوف بلان",
      designMonths: singleDesign(escrowDeposit, designDuration - 1), // آخر شهر تصاميم
      constructionMonths: emptyConstruction(),
    });

    // ─── القسم الرابع — الإنشاء ───
    // دفعة مقدمة 10% — أول شهر إنشاء
    const advancePayment = constructionCost * RATES.advancePayment;
    rows.push({
      label: "دفعة مقدمة للمقاول (10%)",
      totalCost: advancePayment,
      investorAmount: advancePayment,
      paid: 0,
      unpaid: advancePayment,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: singleConstruction(advancePayment, 0),
    });

    // احتياطي 2% — موزع على الإنشاء
    const contingency = constructionCost * RATES.contingency;
    rows.push({
      label: "احتياطي وطوارئ (2%)",
      totalCost: contingency,
      investorAmount: contingency,
      paid: 0,
      unpaid: contingency,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(contingency),
    });

    // رسوم بنكية
    rows.push({
      label: "رسوم بنكية",
      totalCost: PROJECT_INPUTS.bankFees,
      investorAmount: PROJECT_INPUTS.bankFees,
      paid: 0,
      unpaid: PROJECT_INPUTS.bankFees,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(PROJECT_INPUTS.bankFees),
    });

    // رسوم الجهات الحكومية (90%) — من الضمان
    const govFeesEscrow = PROJECT_INPUTS.govFeesTotal * RATES.govFeesEscrowShare;
    rows.push({
      label: "رسوم الجهات الحكومية (90%)",
      totalCost: govFeesEscrow,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(govFeesEscrow),
    });

    // دفعات المقاول (70% — من الضمان)
    const contractorEscrow = constructionCost * RATES.constructionEscrowShare;
    rows.push({
      label: "دفعات المقاول (70% — من الضمان)",
      totalCost: contractorEscrow,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(contractorEscrow),
    });

    // رسوم المجتمع (75%)
    const communityConstruction = PROJECT_INPUTS.communityFee * RATES.communityConstructionShare;
    rows.push({
      label: "رسوم المجتمع (75%)",
      totalCost: communityConstruction,
      investorAmount: communityConstruction,
      paid: 0,
      unpaid: communityConstruction,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: singleConstruction(communityConstruction, 2),
    });

    // أتعاب المطور — الإشراف (3%)
    const devFeeSupervision = totalRevenue * RATES.developerFeeSupervision;
    rows.push({
      label: "أتعاب المطور — الإشراف (3%)",
      totalCost: devFeeSupervision,
      investorAmount: devFeeSupervision,
      paid: 0,
      unpaid: devFeeSupervision,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(devFeeSupervision),
    });

    // أتعاب الإشراف — من الضمان
    const supervisionFee = constructionCost * RATES.supervisionFee;
    rows.push({
      label: "أتعاب الاستشاري — الإشراف",
      totalCost: supervisionFee,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(supervisionFee),
    });

    // رسوم المساح — من الضمان
    rows.push({
      label: "رسوم المساح",
      totalCost: PROJECT_INPUTS.surveyorFee,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // تقرير مدقق ريرا — من الضمان
    rows.push({
      label: "تقرير مدقق ريرا",
      totalCost: PROJECT_INPUTS.reraAuditorReport,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // تقرير فحص ريرا — من الضمان
    rows.push({
      label: "تقرير فحص ريرا",
      totalCost: PROJECT_INPUTS.reraInspection,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
    });

    // التسويق والإعلان — الإنشاء (75%)
    const marketingConstruction = totalRevenue * RATES.marketingTotal * RATES.marketingConstructionShare;
    rows.push({
      label: "التسويق والإعلان — الإنشاء (75%)",
      totalCost: marketingConstruction,
      investorAmount: marketingConstruction,
      paid: 0,
      unpaid: marketingConstruction,
      funder: "investor",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(marketingConstruction),
    });

    // عمولة وكيل المبيعات (5%) — من الضمان
    const salesCommission = totalRevenue * RATES.salesCommission;
    rows.push({
      label: "عمولة وكيل المبيعات (5%)",
      totalCost: salesCommission,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "القسم الرابع — الإنشاء",
      designMonths: emptyDesign(),
      constructionMonths: spreadConstruction(salesCommission),
    });

    // ═══════════════════════════════════════════
    // TOTALS
    // ═══════════════════════════════════════════
    const grandTotalCost = rows.reduce((s, r) => s + r.totalCost, 0);
    const grandInvestor = rows.reduce((s, r) => s + r.investorAmount, 0);
    const grandPaid = rows.reduce((s, r) => s + r.paid, 0);
    const grandUnpaid = rows.reduce((s, r) => s + r.unpaid, 0);

    // Monthly totals (investor only — what the investor actually pays each month)
    const designMonthlyTotals = emptyDesign();
    const constructionMonthlyTotals = emptyConstruction();
    for (const row of rows) {
      if (row.funder === "escrow") continue; // الضمان لا يُحسب في تدفق المستثمر
      for (let i = 0; i < designDuration; i++) designMonthlyTotals[i] += row.designMonths[i];
      for (let i = 0; i < constructionDuration; i++) constructionMonthlyTotals[i] += row.constructionMonths[i];
    }

    // Cumulative (investor)
    const cumulativeDesign = emptyDesign();
    const cumulativeConstruction = emptyConstruction();
    let running = grandPaid; // start with paid (land)
    for (let i = 0; i < designDuration; i++) {
      running += designMonthlyTotals[i];
      cumulativeDesign[i] = running;
    }
    for (let i = 0; i < constructionDuration; i++) {
      running += constructionMonthlyTotals[i];
      cumulativeConstruction[i] = running;
    }

    // Sections for grouping
    const sections = [
      "القسم الأول — المبالغ المدفوعة (الأرض)",
      "القسم الثاني — التصاميم ورخصة البناء",
      "القسم الثالث — ريرا والبيع أوف بلان",
      "القسم الرابع — الإنشاء",
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
