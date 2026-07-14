import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

const fmt = (n: number) => {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("en-US");
};

export default function ConsolidatedInvestorCashFlowPage() {
  const { data, isLoading } = trpc.cashFlowSettings.getConsolidatedInvestorCashFlow.useQuery();

  const scenarioLabel = (s: string) => {
    switch (s) {
      case "offplan_escrow": return "سيناريو 1 — أوف بلان مع ضمان";
      case "offplan_construction": return "سيناريو 2 — أوف بلان بعد 20%";
      case "no_offplan": return "سيناريو 3 — بيع بعد الإنجاز";
      case "rental": return "سيناريو 4 — تطوير للتأجير";
      default: return s;
    }
  };

  // Summary cards data
  const summary = useMemo(() => {
    if (!data) return null;
    const peakCash = Math.max(...data.consolidated.cumulativeNet);
    const peakMonth = data.consolidated.cumulativeNet.indexOf(peakCash);
    return {
      totalCapital: data.consolidated.totalCapitalRequired,
      totalSurplus: data.consolidated.totalSurplusReturned,
      netInvestment: data.consolidated.totalCapitalRequired - data.consolidated.totalSurplusReturned,
      peakCash,
      peakMonthLabel: data.monthLabels[peakMonth] || "",
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center">
        <div className="text-xl">جاري تحميل التقرير المجمّع...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center">
        <div className="text-xl text-red-400">لا توجد بيانات مشاريع</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400 mb-2">
          التدفقات النقدية المجمّعة للمستثمر
        </h1>
        <p className="text-gray-400 text-sm">
          جميع المشاريع — بداية أغسطس 2026
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">إجمالي رأس المال المطلوب</div>
            <div className="text-lg font-bold text-red-400">{fmt(summary.totalCapital)}</div>
          </div>
          <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">إجمالي العائد من الضمان</div>
            <div className="text-lg font-bold text-green-400">{fmt(summary.totalSurplus)}</div>
          </div>
          <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">صافي الاستثمار</div>
            <div className="text-lg font-bold text-cyan-400">{fmt(summary.netInvestment)}</div>
          </div>
          <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">ذروة رأس المال</div>
            <div className="text-lg font-bold text-amber-400">{fmt(summary.peakCash)}</div>
          </div>
          <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">شهر الذروة</div>
            <div className="text-lg font-bold text-amber-400">{summary.peakMonthLabel}</div>
          </div>
        </div>
      )}

      {/* Projects Summary */}
      <div className="bg-[#1a2744] rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-bold text-white mb-3">ملخص المشاريع</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-right py-2 px-3 text-gray-400">المشروع</th>
                <th className="text-center py-2 px-3 text-gray-400">السيناريو</th>
                <th className="text-left py-2 px-3 text-gray-400">رأس المال</th>
                <th className="text-left py-2 px-3 text-gray-400">فائض الضمان (95%)</th>
                <th className="text-left py-2 px-3 text-gray-400">محجوز (5%)</th>
                <th className="text-left py-2 px-3 text-gray-400">شهر الإفراج</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-700/50 hover:bg-[#0d1f3c]">
                  <td className="py-2 px-3 font-medium text-white">{p.name}</td>
                  <td className="py-2 px-3 text-center text-xs text-gray-300">{scenarioLabel(p.scenario)}</td>
                  <td className="py-2 px-3 text-red-300">{fmt(p.capitalRequired)}</td>
                  <td className="py-2 px-3 text-green-300">{fmt(p.escrowSurplusAmount)}</td>
                  <td className="py-2 px-3 text-amber-300">{fmt(p.retentionAmount)}</td>
                  <td className="py-2 px-3 text-gray-300 text-xs">
                    {p.escrowSurplusMonth ? data.monthLabels[p.escrowSurplusMonth - 1] || `شهر ${p.escrowSurplusMonth}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Cash Flow Table */}
      <div className="bg-[#1a2744] rounded-lg border border-gray-700">
        <h2 className="text-lg font-bold text-white p-4 border-b border-gray-700">
          التدفقات النقدية الشهرية المجمّعة
        </h2>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[#0d1f3c] z-10">
              <tr>
                <th className="sticky right-0 bg-[#0d1f3c] z-20 text-right py-2 px-3 border-b border-gray-600 text-gray-400 min-w-[120px]">
                  الشهر
                </th>
                {data.projects.map((p) => (
                  <th key={p.id} className="text-center py-2 px-2 border-b border-gray-600 text-gray-400 min-w-[100px]">
                    {p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name}
                  </th>
                ))}
                <th className="text-center py-2 px-2 border-b border-gray-600 text-red-400 min-w-[100px] font-bold">
                  إجمالي المصروفات
                </th>
                <th className="text-center py-2 px-2 border-b border-gray-600 text-green-400 min-w-[100px] font-bold">
                  إيرادات (فائض الضمان)
                </th>
                <th className="text-center py-2 px-2 border-b border-gray-600 text-cyan-400 min-w-[100px] font-bold">
                  صافي الشهر
                </th>
                <th className="text-center py-2 px-2 border-b border-gray-600 text-amber-400 min-w-[120px] font-bold">
                  الرصيد التراكمي
                </th>
              </tr>
            </thead>
            <tbody>
              {data.monthLabels.map((label, idx) => {
                const hasData = data.consolidated.monthlyOutflow[idx] !== 0 ||
                  data.consolidated.monthlyRevenue[idx] !== 0;
                if (!hasData && idx > 0 && data.consolidated.cumulativeNet[idx] === data.consolidated.cumulativeNet[idx - 1]) {
                  return null; // Skip empty months
                }
                return (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-[#0d1f3c]/50">
                    <td className="sticky right-0 bg-[#1a2744] py-1.5 px-3 text-gray-300 font-medium border-l border-gray-700">
                      {label}
                    </td>
                    {data.projects.map((p) => (
                      <td key={p.id} className="text-center py-1.5 px-2 text-gray-300">
                        {p.monthlyInvestor[idx] ? fmt(p.monthlyInvestor[idx]) : "-"}
                      </td>
                    ))}
                    <td className="text-center py-1.5 px-2 text-red-300 font-medium">
                      {data.consolidated.monthlyOutflow[idx] ? fmt(data.consolidated.monthlyOutflow[idx]) : "-"}
                    </td>
                    <td className="text-center py-1.5 px-2 text-green-300 font-medium">
                      {data.consolidated.monthlyRevenue[idx] ? fmt(data.consolidated.monthlyRevenue[idx]) : "-"}
                    </td>
                    <td className="text-center py-1.5 px-2 text-cyan-300 font-medium">
                      {data.consolidated.monthlyNet[idx] ? fmt(data.consolidated.monthlyNet[idx]) : "-"}
                    </td>
                    <td className="text-center py-1.5 px-2 text-amber-300 font-bold">
                      {fmt(data.consolidated.cumulativeNet[idx])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot className="sticky bottom-0 bg-[#0d1f3c]">
              <tr className="border-t-2 border-cyan-600">
                <td className="sticky right-0 bg-[#0d1f3c] py-2 px-3 font-bold text-white">
                  الإجمالي
                </td>
                {data.projects.map((p) => (
                  <td key={p.id} className="text-center py-2 px-2 font-bold text-white">
                    {fmt(p.capitalRequired)}
                  </td>
                ))}
                <td className="text-center py-2 px-2 font-bold text-red-400">
                  {fmt(data.consolidated.totalCapitalRequired)}
                </td>
                <td className="text-center py-2 px-2 font-bold text-green-400">
                  {fmt(data.consolidated.totalSurplusReturned)}
                </td>
                <td className="text-center py-2 px-2 font-bold text-cyan-400">
                  {fmt(data.consolidated.totalCapitalRequired - data.consolidated.totalSurplusReturned)}
                </td>
                <td className="text-center py-2 px-2 font-bold text-amber-400">
                  {fmt(data.consolidated.cumulativeNet[data.consolidated.cumulativeNet.length - 1] || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
