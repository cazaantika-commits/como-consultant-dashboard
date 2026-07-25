import { useState } from "react";
import { ArrowRight, Settings2, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== STRUCTURE ONLY — correct names from reference =====
const DESIGN_MONTHS = 8;
const CONSTRUCTION_MONTHS = 24;
const POST_MONTHS = 13;

// Escrow Inflows
const INFLOW_ITEMS = [
  { id: "offplan_collections", name: "تحصيلات أوف بلان (من المشترين)" },
  { id: "post_to_escrow", name: "تحصيلات ما بعد الإنجاز → الضمان" },
  { id: "escrow_deposit", name: "إيداع الضمان (20% من الإنشاء)" },
  { id: "deficit_funding", name: "تمويل عجز الإسكرو" },
];

// Escrow Outflows (escrow-funded costs)
const OUTFLOW_ITEMS = [
  { id: "contract_progress", name: "مستخلصات المقاول (80% من الإنشاء)" },
  { id: "offplan_comm", name: "عمولة مبيعات أوف بلان (5%)" },
  { id: "rera_audit", name: "تدقيق ريرا" },
  { id: "rera_inspect", name: "تفتيش ريرا" },
  { id: "retention_escrow", name: "احتجاز المقاول — إسكرو (5%)" },
];

// Balance section
const BALANCE_ITEMS = [
  { id: "balance_before", name: "الرصيد قبل التحرير" },
  { id: "regulatory_retention", name: "الاحتجاز التنظيمي (5% من مبيعات أوف بلان)" },
  { id: "first_release", name: "التحرير الأول (شهر 3 بعد الإنجاز)" },
  { id: "final_release", name: "التحرير النهائي (شهر 13 بعد الإنجاز)" },
];

function dummyRow(totalMonths: number, startFrom?: number): number[] {
  return Array.from({ length: totalMonths }, (_, i) => {
    if (startFrom !== undefined && i < startFrom) return 0;
    return Math.round(Math.random() * 3_000_000);
  });
}

export default function V2EscrowCashFlow() {
  const [, navigate] = useLocation();
  const totalMonths = DESIGN_MONTHS + CONSTRUCTION_MONTHS + POST_MONTHS;

  const [inflowData] = useState(() =>
    INFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, item.id === "post_to_escrow" ? DESIGN_MONTHS + CONSTRUCTION_MONTHS : DESIGN_MONTHS),
    }))
  );

  const [outflowData] = useState(() =>
    OUTFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, DESIGN_MONTHS),
    }))
  );

  const [balanceData] = useState(() =>
    BALANCE_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, item.id.includes("release") ? DESIGN_MONTHS + CONSTRUCTION_MONTHS : 0),
    }))
  );

  const monthlyInflowTotals = Array.from({ length: totalMonths }, (_, m) =>
    inflowData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyOutflowTotals = Array.from({ length: totalMonths }, (_, m) =>
    outflowData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyNet = monthlyInflowTotals.map((inflow, i) => inflow - monthlyOutflowTotals[i]);
  const cumulative = monthlyNet.reduce<number[]>((acc, val) => {
    acc.push((acc[acc.length - 1] || 0) + val);
    return acc;
  }, []);

  const totalInflow = monthlyInflowTotals.reduce((a, b) => a + b, 0);
  const totalOutflow = monthlyOutflowTotals.reduce((a, b) => a + b, 0);

  const fmt = (n: number) => {
    if (n === 0) return "—";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">تدفقات الإسكرو (حساب الضمان)</h1>
              <p className="text-xs text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-700">
              <Settings2 className="w-3.5 h-3.5" /> إعدادات
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              <Download className="w-3.5 h-3.5" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-green-100 shadow-sm">
            <p className="text-xs text-green-600 mb-0.5">إجمالي الداخل</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalInflow)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-red-100 shadow-sm">
            <p className="text-xs text-red-600 mb-0.5">إجمالي الخارج (صرفيات)</p>
            <p className="text-lg font-bold text-red-700">{fmt(totalOutflow)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-indigo-100 shadow-sm">
            <p className="text-xs text-indigo-600 mb-0.5">الرصيد النهائي</p>
            <p className={`text-lg font-bold ${(cumulative[cumulative.length - 1] || 0) >= 0 ? "text-indigo-700" : "text-red-700"}`}>
              {fmt(cumulative[cumulative.length - 1] || 0)}
            </p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: totalMonths * 70 + 200 }}>
              <thead>
                {/* Phase color bar */}
                <tr>
                  <th className="sticky right-0 z-10 bg-white border-b border-l border-gray-200 min-w-[200px]"></th>
                  {Array.from({ length: DESIGN_MONTHS }, (_, i) => (
                    <th key={`dp-${i}`} className="h-1.5 bg-blue-500 border-b border-blue-600"></th>
                  ))}
                  {Array.from({ length: CONSTRUCTION_MONTHS }, (_, i) => (
                    <th key={`cp-${i}`} className="h-1.5 bg-amber-500 border-b border-amber-600"></th>
                  ))}
                  {Array.from({ length: POST_MONTHS }, (_, i) => (
                    <th key={`pp-${i}`} className="h-1.5 bg-emerald-500 border-b border-emerald-600"></th>
                  ))}
                </tr>
                {/* Month numbers */}
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-3 py-1.5 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[200px] text-xs">
                    البند
                  </th>
                  {Array.from({ length: DESIGN_MONTHS }, (_, i) => (
                    <th key={`d-${i}`} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-blue-700 bg-blue-50/50 whitespace-nowrap">
                      الشهر {i + 1}
                    </th>
                  ))}
                  {Array.from({ length: CONSTRUCTION_MONTHS }, (_, i) => (
                    <th key={`c-${i}`} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-amber-700 bg-amber-50/50 whitespace-nowrap">
                      الشهر {i + 1}
                    </th>
                  ))}
                  {Array.from({ length: POST_MONTHS }, (_, i) => (
                    <th key={`p-${i}`} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-emerald-700 bg-emerald-50/50 whitespace-nowrap">
                      الشهر {i + 1}
                    </th>
                  ))}
                </tr>
                {/* Phase labels */}
                <tr>
                  <th className="sticky right-0 z-10 bg-white px-3 py-1 text-right text-[10px] text-gray-400 border-b border-l border-gray-200">المرحلة</th>
                  <th colSpan={DESIGN_MONTHS} className="py-1 text-center text-[10px] font-bold text-blue-600 bg-blue-50/30 border-b border-gray-200">تصميم</th>
                  <th colSpan={CONSTRUCTION_MONTHS} className="py-1 text-center text-[10px] font-bold text-amber-600 bg-amber-50/30 border-b border-gray-200">إنشاء</th>
                  <th colSpan={POST_MONTHS} className="py-1 text-center text-[10px] font-bold text-emerald-600 bg-emerald-50/30 border-b border-gray-200">ما بعد الإنجاز</th>
                </tr>
              </thead>

              <tbody>
                {/* === INFLOWS === */}
                <tr className="bg-green-50/40">
                  <td colSpan={totalMonths + 1} className="px-3 py-1 font-bold text-green-800 text-[11px] border-b border-green-100">
                    الداخل (Inflows)
                  </td>
                </tr>
                {inflowData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                    <td className="sticky right-0 z-10 bg-white px-3 py-[5px] text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-1.5 py-[5px] text-center text-gray-600 tabular-nums">{fmt(val)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold border-b-2 border-green-200">
                  <td className="sticky right-0 z-10 bg-green-50 px-3 py-[5px] text-right text-green-800 border-l border-green-200">إجمالي الداخل</td>
                  {monthlyInflowTotals.map((val, i) => (
                    <td key={i} className="px-1.5 py-[5px] text-center text-green-800 tabular-nums">{fmt(val)}</td>
                  ))}
                </tr>

                {/* === OUTFLOWS === */}
                <tr className="bg-red-50/40">
                  <td colSpan={totalMonths + 1} className="px-3 py-1 font-bold text-red-800 text-[11px] border-b border-red-100">
                    الخارج (Outflows) — صرفيات من الإسكرو
                  </td>
                </tr>
                {outflowData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                    <td className="sticky right-0 z-10 bg-white px-3 py-[5px] text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-1.5 py-[5px] text-center text-gray-600 tabular-nums">{fmt(val)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold border-b-2 border-red-200">
                  <td className="sticky right-0 z-10 bg-red-50 px-3 py-[5px] text-right text-red-800 border-l border-red-200">إجمالي الخارج</td>
                  {monthlyOutflowTotals.map((val, i) => (
                    <td key={i} className="px-1.5 py-[5px] text-center text-red-800 tabular-nums">{fmt(val)}</td>
                  ))}
                </tr>

                {/* === BALANCE === */}
                <tr className="bg-indigo-50/40">
                  <td colSpan={totalMonths + 1} className="px-3 py-1 font-bold text-indigo-800 text-[11px] border-b border-indigo-100">
                    الرصيد والتحرير
                  </td>
                </tr>
                {balanceData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                    <td className="sticky right-0 z-10 bg-white px-3 py-[5px] text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-1.5 py-[5px] text-center text-gray-600 tabular-nums">{fmt(val)}</td>
                    ))}
                  </tr>
                ))}

                {/* === NET === */}
                <tr className="bg-gray-100 font-bold border-b border-gray-300">
                  <td className="sticky right-0 z-10 bg-gray-100 px-3 py-[5px] text-right text-gray-800 border-l border-gray-200 text-[11px]">صافي الشهر</td>
                  {monthlyNet.map((val, i) => (
                    <td key={i} className={`px-1.5 py-[5px] text-center tabular-nums ${val >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(val)}</td>
                  ))}
                </tr>

                {/* === CUMULATIVE === */}
                <tr className="bg-indigo-50 font-bold">
                  <td className="sticky right-0 z-10 bg-indigo-50 px-3 py-1.5 text-right text-indigo-800 border-l border-indigo-200 text-[11px]">الرصيد التراكمي</td>
                  {cumulative.map((val, i) => (
                    <td key={i} className={`px-1.5 py-1.5 text-center tabular-nums ${val >= 0 ? "text-indigo-700" : "text-red-700"}`}>{fmt(val)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-blue-500"></div> تصميم ({DESIGN_MONTHS} أشهر)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-amber-500"></div> إنشاء ({CONSTRUCTION_MONTHS} شهر)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-emerald-500"></div> ما بعد الإنجاز ({POST_MONTHS} شهر)</div>
        </div>
      </div>
    </div>
  );
}
