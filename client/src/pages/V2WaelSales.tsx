import { useState } from "react";
import { ArrowRight, Download, Plus, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA =====
const SALES_MONTHS = 24;

const UNIT_TYPES = [
  { id: "studio", name: "استوديو", count: 45, avgPrice: 725_000 },
  { id: "1br", name: "غرفة واحدة", count: 120, avgPrice: 945_000 },
  { id: "2br", name: "غرفتين", count: 100, avgPrice: 1_235_000 },
  { id: "3br", name: "3 غرف", count: 50, avgPrice: 1_750_000 },
  { id: "penthouse", name: "بنتهاوس", count: 10, avgPrice: 4_500_000 },
  { id: "commercial", name: "تجاري", count: 25, avgPrice: 1_320_000 },
];

const TOTAL_UNITS = UNIT_TYPES.reduce((a, b) => a + b.count, 0);

// Dummy sales curve (units sold per month)
function dummySalesCurve(): number[] {
  return Array.from({ length: SALES_MONTHS }, (_, i) => {
    if (i < 3) return Math.round(Math.random() * 20 + 15);
    if (i < 8) return Math.round(Math.random() * 15 + 8);
    return Math.round(Math.random() * 8 + 2);
  });
}

const MARKETING_BUDGET = [
  { name: "إعلانات رقمية", budget: 3_500_000 },
  { name: "معارض ومؤتمرات", budget: 2_000_000 },
  { name: "وسطاء عقاريون (2%)", budget: 8_850_000 },
  { name: "مواد تسويقية", budget: 1_500_000 },
  { name: "علاقات عامة", budget: 800_000 },
];

export default function V2WaelSales() {
  const [, navigate] = useLocation();
  const [salesCurve] = useState(dummySalesCurve);

  const cumulativeSales = salesCurve.reduce<number[]>((acc, val) => {
    acc.push((acc[acc.length - 1] || 0) + val);
    return acc;
  }, []);

  const totalSold = cumulativeSales[cumulativeSales.length - 1] || 0;
  const soldPct = ((totalSold / TOTAL_UNITS) * 100).toFixed(0);
  const totalMarketingBudget = MARKETING_BUDGET.reduce((a, b) => a + b.budget, 0);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };
  const fmtFull = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">خطة المبيعات والتسويق</h1>
              <p className="text-sm text-gray-500">مجان متعدد الاستخدامات — إدارة وائل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700">
              <Plus className="w-4 h-4" />
              إضافة عملية بيع
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm">
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-orange-100 shadow-sm">
            <p className="text-sm text-orange-600 mb-1">إجمالي الوحدات</p>
            <p className="text-2xl font-bold text-orange-700">{TOTAL_UNITS}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-green-100 shadow-sm">
            <p className="text-sm text-green-600 mb-1">تم بيعها (مخطط)</p>
            <p className="text-2xl font-bold text-green-700">{totalSold}</p>
            <p className="text-xs text-gray-400 mt-1">{soldPct}% من الإجمالي</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">المتبقي</p>
            <p className="text-2xl font-bold text-gray-700">{TOTAL_UNITS - totalSold}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-purple-100 shadow-sm">
            <p className="text-sm text-purple-600 mb-1">ميزانية التسويق</p>
            <p className="text-2xl font-bold text-purple-700">{fmt(totalMarketingBudget)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Unit Types Table */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <h3 className="font-bold text-orange-800">مزيج الوحدات والتسعير</h3>
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-right font-medium text-gray-600">النوع</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">العدد</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">متوسط السعر</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">إجمالي الإيرادات</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {UNIT_TYPES.map((type) => (
                  <tr key={type.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-right text-gray-800 font-medium">{type.name}</td>
                    <td className="px-4 py-2.5 text-center text-gray-700">{type.count}</td>
                    <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums">{fmtFull(type.avgPrice)}</td>
                    <td className="px-4 py-2.5 text-center text-green-700 font-medium tabular-nums">{fmt(type.count * type.avgPrice)}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{((type.count / TOTAL_UNITS) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Marketing Budget */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
              <h3 className="font-bold text-purple-800">ميزانية التسويق</h3>
            </div>
            <div className="p-4 space-y-3">
              {MARKETING_BUDGET.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className="text-sm font-medium text-purple-700 tabular-nums">{fmt(item.budget)}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">الإجمالي</span>
                <span className="text-sm font-bold text-purple-800 tabular-nums">{fmt(totalMarketingBudget)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Curve Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-green-50 border-b border-green-100">
            <h3 className="font-bold text-green-800">منحنى المبيعات الشهري</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: SALES_MONTHS * 80 + 180 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-4 py-2 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[150px]">
                    البند
                  </th>
                  {Array.from({ length: SALES_MONTHS }, (_, i) => (
                    <th key={i} className="px-3 py-2 text-center border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap">
                      شهر {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100">
                    وحدات مباعة
                  </td>
                  {salesCurve.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-gray-700 tabular-nums">{val}</td>
                  ))}
                </tr>
                <tr className="bg-green-50 font-bold">
                  <td className="sticky right-0 z-10 bg-green-50 px-4 py-2.5 text-right text-green-800 border-l border-green-200">
                    التراكمي
                  </td>
                  {cumulativeSales.map((val, i) => (
                    <td key={i} className="px-3 py-2.5 text-center text-green-800 tabular-nums">{val}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100">
                    نسبة الإنجاز
                  </td>
                  {cumulativeSales.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-orange-700 tabular-nums">
                      {((val / TOTAL_UNITS) * 100).toFixed(0)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
