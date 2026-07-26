import { useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== STRUCTURE ONLY — exact names from the existing system =====
const DESIGN_MONTHS = 8;
const CONSTRUCTION_MONTHS = 30;
const POST_MONTHS = 13;

// ─── بنود المصروفات (Outflows) — فقط ما يخرج من حساب الضمان ───
const OUTFLOW_ITEMS = [
  { id: "construction", name: "مستخلصات المقاول", section: "الإنشاء" },
  { id: "supervision", name: "أتعاب الإشراف", section: "الإشراف" },
  { id: "surveyor_asbuilt", name: "رسوم المساح As-Built", section: "المسوحات" },
  { id: "gov_fees", name: "رسوم الجهات الحكومية", section: "الرسوم الحكومية" },
  { id: "rera_audit", name: "تقرير مدقق ريرا", section: "ريرا" },
  { id: "rera_inspect", name: "فحص ريرا", section: "ريرا" },
  { id: "sales_commission", name: "عمولة المبيعات", section: "المبيعات" },
];

// ─── الإيرادات (Inflows) — ما يدخل حساب الضمان ───
const INFLOW_ITEMS = [
  { id: "sales_revenue", name: "مبيعات أوف بلان", section: "الإيرادات" },
  { id: "investor_deposit", name: "إيداع المستثمر", section: "الإيرادات" },
];

// ─── التصفية (Liquidation) ───
const LIQUIDATION_ITEMS = [
  { id: "contractor_completion", name: "دفعة إنجاز المقاول", section: "التصفية" },
  { id: "transfer_owner_1", name: "تحويل للمالك (دفعة 1)", section: "التصفية" },
  { id: "transfer_owner_2", name: "صافي الاحتجاز (دفعة 2)", section: "التصفية" },
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

  const [outflowData] = useState(() =>
    OUTFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, DESIGN_MONTHS),
    }))
  );

  const [inflowData] = useState(() =>
    INFLOW_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, DESIGN_MONTHS + 3),
    }))
  );

  const [liquidationData] = useState(() =>
    LIQUIDATION_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths, DESIGN_MONTHS + CONSTRUCTION_MONTHS),
    }))
  );

  // Totals
  const outflowTotals = Array.from({ length: totalMonths }, (_, i) =>
    outflowData.reduce((s, r) => s + r.values[i], 0)
  );
  const inflowTotals = Array.from({ length: totalMonths }, (_, i) =>
    inflowData.reduce((s, r) => s + r.values[i], 0)
  );
  const netFlow = outflowTotals.map((d, i) => inflowTotals[i] - d);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] || 0) + v);
    return acc;
  }, []);

  const totalOutflow = outflowTotals.reduce((s, v) => s + v, 0);
  const totalInflow = inflowTotals.reduce((s, v) => s + v, 0);

  const fmt = (n: number) => {
    if (n === 0) return "-";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toLocaleString();
  };

  // Generate month headers
  const months: { label: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < DESIGN_MONTHS; i++) months.push({ label: `${i + 1}`, phase: "design" });
  for (let i = 0; i < CONSTRUCTION_MONTHS; i++) months.push({ label: `${i + 1}`, phase: "construction" });
  for (let i = 0; i < POST_MONTHS; i++) months.push({ label: `${i + 1}`, phase: "post" });

  const phaseColors = {
    design: "bg-blue-50 text-blue-700",
    construction: "bg-amber-50 text-amber-700",
    post: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className=" bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 ">
        <div className="max-w-full mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-[10px] font-bold text-gray-900">التدفقات النقدية — حساب الضمان (Escrow)</h1>
              <p className="text-[10px] text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalOutflow)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalInflow)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-1 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> تصميم ({DESIGN_MONTHS} أشهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({CONSTRUCTION_MONTHS} شهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({POST_MONTHS} شهر)</span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-max">
          <thead className=" bg-white shadow-sm">
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-1 text-right w-[200px] min-w-[200px]"></th>
              {months.map((m, i) => (
                <th key={i} className={`px-1 py-0.5 text-center border-b border-gray-200 ${phaseColors[m.phase]} font-normal`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── المصروفات (Outflows) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المصروفات (Outflows)
              </td>
            </tr>
            {outflowData.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-red-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                  {item.name}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
            {/* Total Outflows */}
            <tr className="bg-red-100/50 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-2 py-[3px] text-red-800 border-l border-red-200 w-[200px] min-w-[200px]">
                إجمالي المصروفات
              </td>
              {outflowTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Inflows) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                الإيرادات (Inflows)
              </td>
            </tr>
            {inflowData.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-green-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                  {item.name}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
            {/* Total Inflows */}
            <tr className="bg-green-100/50 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[3px] text-green-800 border-l border-green-200 w-[200px] min-w-[200px]">
                إجمالي الإيرادات
              </td>
              {inflowTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-green-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-200">
              <td className="sticky right-0 z-10 bg-blue-50 px-2 py-[3px] text-blue-800 border-l border-blue-200 w-[200px] min-w-[200px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-medium ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── الرصيد التراكمي ─── */}
            <tr className="bg-blue-100/50 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-2 py-[3px] text-blue-900 border-l border-blue-200 w-[200px] min-w-[200px]">
                الرصيد التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-bold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التصفية ─── */}
            <tr className="bg-purple-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-purple-700 text-[9px] border-b border-purple-100 border-t-2 border-t-purple-200">
                التصفية (بعد الإنجاز)
              </td>
            </tr>
            {liquidationData.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-purple-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                  {item.name}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-purple-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
