import { Fragment } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== STRUCTURE ONLY — exact names from the existing system (projectCostsCalc.ts) =====

// Revenue breakdown
const REVENUE_ITEMS = [
  { name: "شقق سكنية (1BR + 2BR + 3BR)", amount: 285_000_000 },
  { name: "محلات تجارية (صغير + متوسط + كبير)", amount: 187_500_000 },
  { name: "مكاتب (صغير + متوسط + كبير)", amount: 150_000_000 },
];

// Cost breakdown — مجموع كل البنود من كشف المستثمر + كشف الإسكرو
const COST_CATEGORIES = [
  {
    category: "الأرض",
    items: [
      { name: "سعر الأرض", amount: 125_000_000 },
      { name: "رسوم تسجيل الأرض", amount: 5_000_000 },
      { name: "عمولة وسيط الأرض", amount: 1_250_000 },
    ],
  },
  {
    category: "التصاميم والإشراف",
    items: [
      { name: "أتعاب التصاميم", amount: 6_300_000 },
      { name: "أتعاب الإشراف", amount: 7_000_000 },
    ],
  },
  {
    category: "الدراسات والمسوحات",
    items: [
      { name: "فحص التربة", amount: 12_000 },
      { name: "المسح الطبوغرافي", amount: 15_000 },
      { name: "رسوم المساح DWG", amount: 45_000 },
      { name: "رسوم المساح As-Built", amount: 45_000 },
    ],
  },
  {
    category: "الرسوم الحكومية والتنظيمية",
    items: [
      { name: "رسوم المجتمع", amount: 2_000_000 },
      { name: "رسوم الجهات الحكومية", amount: 500_000 },
      { name: "رسوم الفرز", amount: 611_772 },
      { name: "رسوم NOC المطور", amount: 10_000 },
    ],
  },
  {
    category: "ريرا (التنظيم العقاري)",
    items: [
      { name: "تسجيل المشروع — ريرا", amount: 150_000 },
      { name: "تسجيل الوحدات — ريرا", amount: 186_400 },
      { name: "حساب الضمان (رسوم فتح)", amount: 140_000 },
      { name: "رسوم البنك", amount: 35_000 },
      { name: "تقرير مدقق ريرا", amount: 24_000 },
      { name: "فحص ريرا", amount: 150_000 },
    ],
  },
  {
    category: "المبيعات والتسويق",
    items: [
      { name: "تحضير مواد التسويق", amount: 500_000 },
      { name: "التسويق", amount: 12_450_000 },
      { name: "عمولة المبيعات", amount: 31_125_000 },
      { name: "أتعاب المطور", amount: 31_125_000 },
    ],
  },
  {
    category: "الإنشاء",
    items: [
      { name: "تكلفة الإنشاء", amount: 350_000_000 },
    ],
  },
];

// KPIs
const totalRevenue = REVENUE_ITEMS.reduce((s, r) => s + r.amount, 0);
const totalCosts = COST_CATEGORIES.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0);
const netProfit = totalRevenue - totalCosts;
const investorContributions = 220_000_000;
const investorDistributions = 310_000_000;
const moic = investorDistributions / investorContributions;
const comoTotal = 31_125_000 + (netProfit * 0.15);

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
};

const fmtFull = (n: number) => n.toLocaleString("en-US");

export default function V2Feasibility() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-900">دراسة الجدوى</h1>
              <p className="text-[10px] text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
            <Download className="w-3 h-3" /> تصدير PDF
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-3 space-y-3">
        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-white rounded-lg p-2.5 border border-gray-100 shadow-sm">
            <p className="text-[9px] text-gray-500 mb-0.5">إجمالي الإيرادات</p>
            <p className="text-sm font-bold text-gray-900">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100 shadow-sm">
            <p className="text-[9px] text-gray-500 mb-0.5">إجمالي التكاليف</p>
            <p className="text-sm font-bold text-gray-900">{fmt(totalCosts)}</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-teal-100 shadow-sm">
            <p className="text-[9px] text-teal-600 mb-0.5">صافي الربح</p>
            <p className="text-sm font-bold text-teal-700">{fmt(netProfit)}</p>
            <p className="text-[8px] text-gray-400">{((netProfit / totalCosts) * 100).toFixed(1)}% من التكلفة</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-blue-100 shadow-sm">
            <p className="text-[9px] text-blue-600 mb-0.5">MOIC</p>
            <p className="text-sm font-bold text-blue-700">{moic.toFixed(2)}x</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-sm">
            <p className="text-[9px] text-purple-600 mb-0.5">أرباح COMO</p>
            <p className="text-sm font-bold text-purple-700">{fmt(comoTotal)}</p>
          </div>
        </div>

        {/* Revenue Table */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-100 bg-green-50/30">
            <h3 className="text-[10px] font-bold text-green-800">الإيرادات</h3>
          </div>
          <table className="w-full text-[10px]">
            <tbody>
              {REVENUE_ITEMS.map((item, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-[4px] text-gray-800 font-medium">{item.name}</td>
                  <td className="px-3 py-[4px] text-left text-gray-700 tabular-nums w-[120px]">{fmtFull(item.amount)}</td>
                  <td className="px-3 py-[4px] text-left text-gray-400 w-[50px]">{((item.amount / totalRevenue) * 100).toFixed(0)}%</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold">
                <td className="px-3 py-[4px] text-green-800">إجمالي الإيرادات</td>
                <td className="px-3 py-[4px] text-left text-green-800 tabular-nums">{fmtFull(totalRevenue)}</td>
                <td className="px-3 py-[4px] text-left text-green-800">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost Table */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-100 bg-red-50/30">
            <h3 className="text-[10px] font-bold text-red-800">التكاليف</h3>
          </div>
          <table className="w-full text-[10px]">
            <tbody>
              {COST_CATEGORIES.map((cat) => (
                <Fragment key={cat.category}>
                  <tr className="bg-gray-50/50">
                    <td colSpan={3} className="px-3 py-[3px] text-[9px] font-bold text-gray-600 border-b border-gray-100">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((item, j) => (
                    <tr key={`${cat.category}-${j}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-[4px] text-gray-800 font-medium pr-6">{item.name}</td>
                      <td className="px-3 py-[4px] text-left text-gray-700 tabular-nums w-[120px]">{fmtFull(item.amount)}</td>
                      <td className="px-3 py-[4px] text-left text-gray-400 w-[50px]">{((item.amount / totalCosts) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-red-50 font-bold border-t-2 border-red-200">
                <td className="px-3 py-[4px] text-red-800">إجمالي التكاليف</td>
                <td className="px-3 py-[4px] text-left text-red-800 tabular-nums">{fmtFull(totalCosts)}</td>
                <td className="px-3 py-[4px] text-left text-red-800">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Investor vs COMO Split */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-100 bg-blue-50/30">
              <h3 className="text-[10px] font-bold text-blue-800">عوائد المستثمر</h3>
            </div>
            <table className="w-full text-[10px]">
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">إجمالي المساهمات</td>
                  <td className="px-3 py-[4px] text-left tabular-nums text-red-600">{fmtFull(investorContributions)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">إجمالي التوزيعات</td>
                  <td className="px-3 py-[4px] text-left tabular-nums text-green-600">{fmtFull(investorDistributions)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">صافي ربح المستثمر (85%)</td>
                  <td className="px-3 py-[4px] text-left tabular-nums font-bold text-blue-700">{fmtFull(investorDistributions - investorContributions)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">MOIC</td>
                  <td className="px-3 py-[4px] text-left font-bold text-blue-700">{moic.toFixed(2)}x</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">IRR</td>
                  <td className="px-3 py-[4px] text-left font-bold text-blue-700">22.4%</td>
                </tr>
                <tr>
                  <td className="px-3 py-[4px] text-gray-800">تاريخ استرداد رأس المال</td>
                  <td className="px-3 py-[4px] text-left text-gray-700">الشهر 34</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-100 bg-purple-50/30">
              <h3 className="text-[10px] font-bold text-purple-800">أرباح COMO (المطور)</h3>
            </div>
            <table className="w-full text-[10px]">
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">أتعاب تصميم (2%)</td>
                  <td className="px-3 py-[4px] text-left tabular-nums">{fmtFull(12_450_000)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">أتعاب إشراف (3%)</td>
                  <td className="px-3 py-[4px] text-left tabular-nums">{fmtFull(18_675_000)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-3 py-[4px] text-gray-800">حصة الأرباح (15%)</td>
                  <td className="px-3 py-[4px] text-left tabular-nums">{fmtFull(netProfit * 0.15)}</td>
                </tr>
                <tr className="bg-purple-50 font-bold">
                  <td className="px-3 py-[4px] text-purple-800">إجمالي أرباح COMO</td>
                  <td className="px-3 py-[4px] text-left tabular-nums text-purple-800">{fmtFull(comoTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
