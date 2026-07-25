import { useState } from "react";
import { ArrowRight, Settings2, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA =====
const SALES_MONTHS = 18; // months where sales happen (during construction)
const POST_MONTHS = 14; // post-completion months (handover + retention)

const INFLOW_ITEMS = [
  { id: "booking", name: "دفعات الحجز (10%)" },
  { id: "first", name: "الدفعة الأولى (15%)" },
  { id: "second", name: "الدفعة الثانية (10%)" },
  { id: "construction_linked", name: "دفعات مرتبطة بالإنشاء (30%)" },
  { id: "handover", name: "دفعة الاستلام (30%)" },
  { id: "post_handover", name: "ما بعد الاستلام (5%)" },
];

const OUTFLOW_ITEMS = [
  { id: "contractor", name: "مستخلصات المقاول" },
  { id: "consultant", name: "أتعاب الاستشاري" },
  { id: "marketing", name: "تسويق ومبيعات" },
  { id: "rera_fees", name: "رسوم ريرا" },
  { id: "developer_fee", name: "أتعاب المطور" },
  { id: "admin", name: "مصاريف إدارية" },
];

function dummyRow(totalMonths: number, startMonth: number = 0): number[] {
  return Array.from({ length: totalMonths }, (_, i) =>
    i >= startMonth ? Math.round(Math.random() * 3_000_000 + 200_000) : 0
  );
}

export default function V2EscrowCashFlow() {
  const [, navigate] = useLocation();
  const totalMonths = SALES_MONTHS + POST_MONTHS;

  const [inflowData] = useState(() =>
    INFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, item.id === "handover" ? SALES_MONTHS : item.id === "post_handover" ? SALES_MONTHS + 1 : 0),
    }))
  );

  const [outflowData] = useState(() =>
    OUTFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, 0),
    }))
  );

  const monthlyInflows = Array.from({ length: totalMonths }, (_, m) =>
    inflowData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyOutflows = Array.from({ length: totalMonths }, (_, m) =>
    outflowData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyNet = monthlyInflows.map((inf, i) => inf - monthlyOutflows[i]);
  const balance = monthlyNet.reduce<number[]>((acc, val) => {
    acc.push((acc[acc.length - 1] || 0) + val);
    return acc;
  }, []);

  const totalInflow = monthlyInflows.reduce((a, b) => a + b, 0);
  const totalOutflow = monthlyOutflows.reduce((a, b) => a + b, 0);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };

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
              <h1 className="text-xl font-bold text-gray-900">تدفقات الإسكرو (حساب الضمان)</h1>
              <p className="text-sm text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700">
              <Settings2 className="w-4 h-4" />
              إعدادات
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-green-100 shadow-sm">
            <p className="text-sm text-green-600 mb-1">إجمالي الداخل (من المشترين)</p>
            <p className="text-2xl font-bold text-green-700">{fmt(totalInflow)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
            <p className="text-sm text-red-600 mb-1">إجمالي الخارج (صرفيات)</p>
            <p className="text-2xl font-bold text-red-700">{fmt(totalOutflow)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-indigo-100 shadow-sm">
            <p className="text-sm text-indigo-600 mb-1">الرصيد النهائي</p>
            <p className={`text-2xl font-bold ${(balance[balance.length - 1] || 0) >= 0 ? "text-indigo-700" : "text-red-700"}`}>
              {fmt(balance[balance.length - 1] || 0)}
            </p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: totalMonths * 85 + 200 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-4 py-2 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[180px]">
                    البند
                  </th>
                  {Array.from({ length: SALES_MONTHS }, (_, i) => (
                    <th key={`s-${i}`} className="px-3 py-2 text-center border-b border-gray-200 font-medium text-indigo-700 bg-indigo-50 whitespace-nowrap">
                      مبيعات {i + 1}
                    </th>
                  ))}
                  {Array.from({ length: POST_MONTHS }, (_, i) => (
                    <th key={`p-${i}`} className="px-3 py-2 text-center border-b border-gray-200 font-medium text-purple-700 bg-purple-50 whitespace-nowrap">
                      ما بعد {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* INFLOW SECTION */}
                <tr className="bg-green-50/50">
                  <td colSpan={totalMonths + 1} className="px-4 py-2 font-bold text-green-800 text-sm border-b border-green-100">
                    الداخل (من المشترين)
                  </td>
                </tr>
                {inflowData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-3 py-2 text-center text-gray-700 tabular-nums">
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold border-b-2 border-green-200">
                  <td className="sticky right-0 z-10 bg-green-50 px-4 py-2 text-right text-green-800 border-l border-green-200">
                    إجمالي الداخل
                  </td>
                  {monthlyInflows.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-green-800 tabular-nums">
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  ))}
                </tr>

                {/* OUTFLOW SECTION */}
                <tr className="bg-red-50/50">
                  <td colSpan={totalMonths + 1} className="px-4 py-2 font-bold text-red-800 text-sm border-b border-red-100">
                    الخارج (صرفيات)
                  </td>
                </tr>
                {outflowData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-3 py-2 text-center text-gray-700 tabular-nums">
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold border-b-2 border-red-200">
                  <td className="sticky right-0 z-10 bg-red-50 px-4 py-2 text-right text-red-800 border-l border-red-200">
                    إجمالي الخارج
                  </td>
                  {monthlyOutflows.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-red-800 tabular-nums">
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  ))}
                </tr>

                {/* NET */}
                <tr className="bg-gray-100 font-bold border-b border-gray-300">
                  <td className="sticky right-0 z-10 bg-gray-100 px-4 py-2 text-right text-gray-800 border-l border-gray-200">
                    صافي الشهر
                  </td>
                  {monthlyNet.map((val, i) => (
                    <td key={i} className={`px-3 py-2 text-center tabular-nums ${val >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {fmt(val)}
                    </td>
                  ))}
                </tr>

                {/* BALANCE */}
                <tr className="bg-indigo-50 font-bold">
                  <td className="sticky right-0 z-10 bg-indigo-50 px-4 py-3 text-right text-indigo-800 border-l border-indigo-200">
                    الرصيد التراكمي
                  </td>
                  {balance.map((val, i) => (
                    <td key={i} className={`px-3 py-3 text-center tabular-nums ${val >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                      {fmt(val)}
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
