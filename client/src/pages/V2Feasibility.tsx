import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA =====
const PROJECT_INFO = {
  name: "مجان متعدد الاستخدامات",
  type: "G+4P+25",
  plotArea: 30000,
  builtUpArea: 250000,
  units: 350,
};

const REVENUE_ITEMS = [
  { name: "شقق استوديو (45 وحدة)", area: "22,500 قدم²", pricePerFt: 1450, total: 32_625_000 },
  { name: "شقق غرفة واحدة (120 وحدة)", area: "84,000 قدم²", pricePerFt: 1350, total: 113_400_000 },
  { name: "شقق غرفتين (100 وحدة)", area: "95,000 قدم²", pricePerFt: 1300, total: 123_500_000 },
  { name: "شقق 3 غرف (50 وحدة)", area: "70,000 قدم²", pricePerFt: 1250, total: 87_500_000 },
  { name: "بنتهاوس (10 وحدات)", area: "25,000 قدم²", pricePerFt: 1800, total: 45_000_000 },
  { name: "تجاري (25 وحدة)", area: "15,000 قدم²", pricePerFt: 2200, total: 33_000_000 },
  { name: "مواقف مدفوعة (50)", area: "—", pricePerFt: 0, total: 7_500_000 },
];

const COST_ITEMS = [
  { name: "الأرض", amount: 125_000_000, pct: 0 },
  { name: "رسوم التسجيل (4%)", amount: 5_000_000, pct: 0 },
  { name: "عمولة الأرض (2%)", amount: 2_500_000, pct: 0 },
  { name: "أتعاب الاستشاري", amount: 12_500_000, pct: 5 },
  { name: "رسوم الاعتمادات والتصاريح", amount: 5_000_000, pct: 2 },
  { name: "المقاول (بناء)", amount: 100_000_000, pct: 40 },
  { name: "إشراف هندسي", amount: 5_000_000, pct: 2 },
  { name: "تسويق ومبيعات (3%)", amount: 13_275_000, pct: 3 },
  { name: "أتعاب المطور (15%)", amount: 15_000_000, pct: 15 },
  { name: "رسوم تسجيل أوف بلان", amount: 3_500_000, pct: 0 },
  { name: "تأمين", amount: 2_000_000, pct: 0 },
  { name: "إدارية ومصاريف عامة", amount: 4_000_000, pct: 0 },
];

const totalRevenue = REVENUE_ITEMS.reduce((a, b) => a + b.total, 0);
const totalCost = COST_ITEMS.reduce((a, b) => a + b.amount, 0);
const profit = totalRevenue - totalCost;
const profitPct = ((profit / totalRevenue) * 100).toFixed(1);
const roi = ((profit / totalCost) * 100).toFixed(1);

const fmtFull = (n: number) => n.toLocaleString("en-US");
const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  return n.toLocaleString("en-US");
};

export default function V2Feasibility() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">دراسة الجدوى</h1>
              <p className="text-sm text-gray-500">{PROJECT_INFO.name} — {PROJECT_INFO.type}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
            <Download className="w-4 h-4" />
            تصدير PDF
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Project Quick Info */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">مساحة الأرض</p>
            <p className="text-lg font-bold text-gray-800">{fmtFull(PROJECT_INFO.plotArea)} قدم²</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">المساحة المبنية</p>
            <p className="text-lg font-bold text-gray-800">{fmtFull(PROJECT_INFO.builtUpArea)} قدم²</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">عدد الوحدات</p>
            <p className="text-lg font-bold text-gray-800">{PROJECT_INFO.units}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">النوع</p>
            <p className="text-lg font-bold text-gray-800">{PROJECT_INFO.type}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">المدة الكلية</p>
            <p className="text-lg font-bold text-gray-800">32 شهر</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-green-100 shadow-sm">
            <p className="text-sm text-green-600 mb-1">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold text-green-700">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
            <p className="text-sm text-red-600 mb-1">إجمالي التكاليف</p>
            <p className="text-2xl font-bold text-red-700">{fmt(totalCost)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-emerald-100 shadow-sm">
            <p className="text-sm text-emerald-600 mb-1">صافي الربح</p>
            <p className="text-2xl font-bold text-emerald-700">{fmt(profit)}</p>
            <p className="text-xs text-gray-400 mt-1">هامش {profitPct}%</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-amber-100 shadow-sm">
            <p className="text-sm text-amber-600 mb-1">العائد على الاستثمار</p>
            <p className="text-2xl font-bold text-amber-700">{roi}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Revenue Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-green-50 border-b border-green-100">
              <h3 className="font-bold text-green-800">الإيرادات</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-right font-medium text-gray-600">البند</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">المساحة</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">سعر/قدم²</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {REVENUE_ITEMS.map((item) => (
                  <tr key={item.name} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-right text-gray-800 font-medium">{item.name}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{item.area}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{item.pricePerFt > 0 ? fmtFull(item.pricePerFt) : "—"}</td>
                    <td className="px-4 py-2.5 text-left text-green-700 font-medium tabular-nums">{fmtFull(item.total)}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="px-4 py-3 text-right text-green-800" colSpan={3}>الإجمالي</td>
                  <td className="px-4 py-3 text-left text-green-800 tabular-nums">{fmtFull(totalRevenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cost Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100">
              <h3 className="font-bold text-red-800">التكاليف</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-right font-medium text-gray-600">البند</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">النسبة</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {COST_ITEMS.map((item) => (
                  <tr key={item.name} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-right text-gray-800 font-medium">{item.name}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{item.pct > 0 ? item.pct + "%" : "—"}</td>
                    <td className="px-4 py-2.5 text-left text-red-700 font-medium tabular-nums">{fmtFull(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold">
                  <td className="px-4 py-3 text-right text-red-800" colSpan={2}>الإجمالي</td>
                  <td className="px-4 py-3 text-left text-red-800 tabular-nums">{fmtFull(totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
