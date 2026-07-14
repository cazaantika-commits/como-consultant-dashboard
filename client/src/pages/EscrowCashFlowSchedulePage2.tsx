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
interface CostRow {
  label: string;
  totalCost: number;
  escrowAmount: number;
  openingBalance: number; // الرصيد الافتتاحي (20%)
  remainingToSpend: number; // المتبقي صرفه
  section: string;
  isRevenue?: boolean;
  designMonths: number[];
  constructionMonths: number[];
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function EscrowCashFlowSchedulePage2() {
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

  const emptyDesign = () => new Array(designDuration).fill(0);
  const emptyConstruction = () => new Array(constructionDuration).fill(0);

  // ═══════════════════════════════════════════
  // الرصيد الافتتاحي = 20% من تكلفة الإنشاء
  // ═══════════════════════════════════════════
  const constructionCost = pf.constructionCost;
  const escrowDeposit = constructionCost * RATES.escrowDeposit; // 20%

  // ═══════════════════════════════════════════
  // BUILD ROWS — بنود المصروفات من الضمان
  // ═══════════════════════════════════════════
  const rows: CostRow[] = [];

  // ─── أتعاب الإشراف ───
  rows.push({
    label: "أتعاب الإشراف",
    totalCost: costs.supervisionFee,
    escrowAmount: costs.supervisionFee,
    openingBalance: 0,
    remainingToSpend: costs.supervisionFee,
    section: "التصاميم والإشراف",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── رسوم الجهات الحكومية (90% من الضمان) ───
  rows.push({
    label: "رسوم الجهات الحكومية",
    totalCost: PROJECT_INPUTS.govFeesTotal,
    escrowAmount: costs.govFeesEscrow,
    openingBalance: 0,
    remainingToSpend: costs.govFeesEscrow,
    section: "الرسوم الحكومية والتنظيمية",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── رسوم المساح ───
  rows.push({
    label: "رسوم المساح",
    totalCost: PROJECT_INPUTS.surveyorFee,
    escrowAmount: PROJECT_INPUTS.surveyorFee,
    openingBalance: 0,
    remainingToSpend: PROJECT_INPUTS.surveyorFee,
    section: "الدراسات والمسوحات",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── تقرير مدقق ريرا ───
  rows.push({
    label: "تقرير مدقق ريرا",
    totalCost: PROJECT_INPUTS.reraAuditorReport,
    escrowAmount: PROJECT_INPUTS.reraAuditorReport,
    openingBalance: 0,
    remainingToSpend: PROJECT_INPUTS.reraAuditorReport,
    section: "ريرا (التنظيم العقاري)",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── فحص ريرا ───
  rows.push({
    label: "فحص ريرا",
    totalCost: PROJECT_INPUTS.reraInspection,
    escrowAmount: PROJECT_INPUTS.reraInspection,
    openingBalance: 0,
    remainingToSpend: PROJECT_INPUTS.reraInspection,
    section: "ريرا (التنظيم العقاري)",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── عمولة المبيعات ───
  rows.push({
    label: "عمولة المبيعات",
    totalCost: costs.salesCommission,
    escrowAmount: costs.salesCommission,
    openingBalance: 0,
    remainingToSpend: costs.salesCommission,
    section: "المبيعات والتسويق",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ─── تكلفة الإنشاء (70% من الضمان) ───
  rows.push({
    label: "تكلفة الإنشاء",
    totalCost: constructionCost,
    escrowAmount: costs.constructionEscrow,
    openingBalance: 0,
    remainingToSpend: costs.constructionEscrow,
    section: "الإنشاء",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  });

  // ═══════════════════════════════════════════
  // REVENUE ROW — الإيرادات
  // ═══════════════════════════════════════════
  const revenueRow: CostRow = {
    label: "إيرادات المبيعات",
    totalCost: pr.totalRevenue,
    escrowAmount: pr.totalRevenue,
    openingBalance: 0,
    remainingToSpend: pr.totalRevenue,
    section: "الإيرادات",
    isRevenue: true,
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
  };

  // ═══════════════════════════════════════════
  // TOTALS
  // ═══════════════════════════════════════════
  const totalEscrowExpenses = rows.reduce((s, r) => s + r.escrowAmount, 0);
  const totalRevenue = pr.totalRevenue;

  // ═══════════════════════════════════════════
  // GROUP BY SECTION
  // ═══════════════════════════════════════════
  const sections: { title: string; rows: CostRow[] }[] = [];
  const sectionOrder = [
    "الإيرادات",
    "التصاميم والإشراف",
    "الدراسات والمسوحات",
    "الرسوم الحكومية والتنظيمية",
    "ريرا (التنظيم العقاري)",
    "المبيعات والتسويق",
    "الإنشاء",
  ];

  // Add revenue section first
  sections.push({ title: "الإيرادات", rows: [revenueRow] });

  for (const sec of sectionOrder) {
    if (sec === "الإيرادات") continue;
    const sectionRows = rows.filter((r) => r.section === sec);
    if (sectionRows.length > 0) {
      sections.push({ title: sec, rows: sectionRows });
    }
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 p-4" dir="rtl">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-indigo-900">
          تدفقات حساب الضمان – مجان متعدد الاستخدامات (G+4P+25)
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          توزيع المصروفات والإيرادات على المراحل الزمنية | المبالغ بالدرهم الإماراتي
        </p>
      </div>

      {/* Scenario Buttons */}
      <div className="flex justify-center gap-3 mb-6 flex-wrap">
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow">
          أوف بلان مع إيداع في حساب الضمان
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700">
          أوف بلان بعد إنجاز 20% من الإنشاء
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700">
          تطوير بدون بيع على الخارطة
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-xl shadow bg-white">
        <table className="w-full text-xs border-collapse min-w-[1800px]">
          {/* Header Row 1 */}
          <thead>
            <tr className="bg-indigo-900 text-white">
              <th className="border border-indigo-700 px-2 py-2 sticky right-0 bg-indigo-900 z-10 min-w-[180px]">
                الوصف
              </th>
              <th className="border border-indigo-700 px-2 py-2 min-w-[110px]">إجمالي التكاليف</th>
              <th className="border border-indigo-700 px-2 py-2 min-w-[110px]">من الضمان</th>
              <th className="border border-indigo-700 px-2 py-2 min-w-[110px] bg-green-800">الرصيد الافتتاحي</th>
              <th className="border border-indigo-700 px-2 py-2 min-w-[110px] bg-red-800">المتبقي صرفه</th>
              {/* Design months header */}
              <th
                className="border border-indigo-700 px-2 py-2 bg-purple-800"
                colSpan={designDuration}
              >
                التصاميم ({designDuration} أشهر)
              </th>
              {/* Construction months header */}
              <th
                className="border border-indigo-700 px-2 py-2 bg-green-700"
                colSpan={constructionDuration}
              >
                الإنشاء ({constructionDuration} شهر)
              </th>
            </tr>
            {/* Header Row 2 — month numbers */}
            <tr className="bg-gray-100 text-gray-700 font-medium">
              <th className="border px-2 py-1 sticky right-0 bg-gray-100 z-10"></th>
              <th className="border px-2 py-1"></th>
              <th className="border px-2 py-1"></th>
              <th className="border px-2 py-1"></th>
              <th className="border px-2 py-1"></th>
              {Array.from({ length: designDuration }, (_, i) => (
                <th key={`d${i}`} className="border px-1 py-1 text-center bg-purple-50">
                  ش{i + 1}
                </th>
              ))}
              {Array.from({ length: constructionDuration }, (_, i) => (
                <th key={`c${i}`} className="border px-1 py-1 text-center bg-green-50">
                  ش{i + 1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sections.map((section) => (
              <>
                {/* Section Header */}
                <tr key={`sec-${section.title}`} className="bg-gray-50">
                  <td
                    className="border px-2 py-2 font-bold text-indigo-900 sticky right-0 bg-gray-50 z-10"
                    colSpan={5 + designDuration + constructionDuration}
                  >
                    {section.title}
                  </td>
                </tr>
                {/* Section Rows */}
                {section.rows.map((row, idx) => (
                  <tr
                    key={`row-${section.title}-${idx}`}
                    className={`hover:bg-blue-50 ${row.isRevenue ? "bg-green-50" : ""}`}
                  >
                    <td className="border px-2 py-1.5 font-medium sticky right-0 bg-white z-10">
                      {row.label}
                    </td>
                    <td className="border px-2 py-1.5 text-center font-semibold">
                      {fmt(row.totalCost)}
                    </td>
                    <td className="border px-2 py-1.5 text-center text-indigo-700 font-semibold">
                      {fmt(row.escrowAmount)}
                    </td>
                    <td className="border px-2 py-1.5 text-center text-green-700 font-semibold">
                      {row.openingBalance > 0 ? fmt(row.openingBalance) : "–"}
                    </td>
                    <td className="border px-2 py-1.5 text-center text-red-700 font-semibold">
                      {fmt(row.remainingToSpend)}
                    </td>
                    {/* Design months */}
                    {row.designMonths.map((val, i) => (
                      <td key={`d${i}`} className="border px-1 py-1.5 text-center text-[10px]">
                        {fmt(val)}
                      </td>
                    ))}
                    {/* Construction months */}
                    {row.constructionMonths.map((val, i) => (
                      <td key={`c${i}`} className="border px-1 py-1.5 text-center text-[10px]">
                        {fmt(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}

            {/* ═══ TOTALS ROW ═══ */}
            <tr className="bg-indigo-100 font-bold border-t-2 border-indigo-400">
              <td className="border px-2 py-2 sticky right-0 bg-indigo-100 z-10">
                إجمالي المصروفات
              </td>
              <td className="border px-2 py-2 text-center">{fmt(totalEscrowExpenses)}</td>
              <td className="border px-2 py-2 text-center text-indigo-700">
                {fmt(totalEscrowExpenses)}
              </td>
              <td className="border px-2 py-2 text-center text-green-700">
                {fmt(escrowDeposit)}
              </td>
              <td className="border px-2 py-2 text-center text-red-700">
                {fmt(totalEscrowExpenses)}
              </td>
              {emptyDesign().map((_, i) => (
                <td key={`td${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
              {emptyConstruction().map((_, i) => (
                <td key={`tc${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
            </tr>

            {/* Revenue Total */}
            <tr className="bg-green-100 font-bold">
              <td className="border px-2 py-2 sticky right-0 bg-green-100 z-10">
                إجمالي الإيرادات
              </td>
              <td className="border px-2 py-2 text-center">{fmt(totalRevenue)}</td>
              <td className="border px-2 py-2 text-center text-green-700">
                {fmt(totalRevenue)}
              </td>
              <td className="border px-2 py-2 text-center">–</td>
              <td className="border px-2 py-2 text-center">–</td>
              {emptyDesign().map((_, i) => (
                <td key={`rd${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
              {emptyConstruction().map((_, i) => (
                <td key={`rc${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
            </tr>

            {/* Net (Revenue - Expenses) */}
            <tr className="bg-yellow-50 font-bold border-t-2 border-yellow-400">
              <td className="border px-2 py-2 sticky right-0 bg-yellow-50 z-10">
                صافي التدفق (إيرادات - مصروفات)
              </td>
              <td className="border px-2 py-2 text-center">
                {fmt(totalRevenue - totalEscrowExpenses)}
              </td>
              <td className="border px-2 py-2 text-center">–</td>
              <td className="border px-2 py-2 text-center">–</td>
              <td className="border px-2 py-2 text-center">–</td>
              {emptyDesign().map((_, i) => (
                <td key={`nd${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
              {emptyConstruction().map((_, i) => (
                <td key={`nc${i}`} className="border px-1 py-2 text-center text-[10px]">
                  –
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="bg-white rounded-xl p-4 shadow border-r-4 border-indigo-500">
          <p className="text-xs text-gray-500">صافي التدفق</p>
          <p className="text-lg font-bold text-indigo-700">
            {fmt(totalRevenue - totalEscrowExpenses)} د.إ
          </p>
        </div>
      </div>
    </div>
  );
}
