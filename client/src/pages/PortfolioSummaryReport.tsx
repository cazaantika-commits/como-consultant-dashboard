import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowRight, Printer } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CHART_START_YEAR = 2026;
const CHART_START_MONTH = 4; // April 2026
const REPORT_START_YEAR = 2026;
const REPORT_START_MONTH = 8; // August 2026 as requested
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function formatAED(amount: number): string {
  if (amount === 0) return "—";
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function projectMonthToChartIndex(startDate: string, relativeMonth: number): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const absYear = sy + Math.floor((sm - 1 + relativeMonth) / 12);
  const absMonth = ((sm - 1 + relativeMonth) % 12) + 1;
  return (absYear - CHART_START_YEAR) * 12 + (absMonth - CHART_START_MONTH);
}

function getMonthLabel(chartIdx: number): string {
  const totalMonth = CHART_START_MONTH - 1 + chartIdx;
  const year = CHART_START_YEAR + Math.floor(totalMonth / 12);
  const month = totalMonth % 12;
  return `${ARABIC_MONTHS[month]} ${year}`;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PortfolioSummaryReport() {
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioAllScenarios.useQuery();
  const data = portfolioQuery.data;

  const reportData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // For each project, use its financingScenario
    const projects = data.map((p: any) => {
      const scKey = p.financingScenario || "offplan_escrow";
      const sc = p.scenarios[scKey];
      const paid = sc.sectionTotals?.paid || 0;
      const investorTotal = sc.investorTotal || 0;
      const escrowTotal = sc.escrowTotal || 0;
      const remaining = investorTotal - paid;
      const totalRevenue = p.totalRevenue || 0;
      const totalCosts = p.totalCosts || 0;
      const profit = totalRevenue - totalCosts;
      const profitMarginRevenue = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const profitMarginCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
      const profitMarginCapital = investorTotal > 0 ? (profit / investorTotal) * 100 : 0;

      // Monthly investor amounts aligned to global timeline
      const monthlyInvestor: number[] = sc.monthlyInvestor || [];
      
      return {
        id: p.projectId,
        name: p.name,
        startDate: p.startDate,
        totalMonths: p.totalMonths,
        totalRevenue,
        totalCosts,
        profit,
        profitMarginRevenue,
        profitMarginCost,
        profitMarginCapital,
        investorTotal,
        escrowTotal,
        paid,
        remaining,
        monthlyInvestor,
      };
    });

    // Calculate totals
    const totals = {
      totalRevenue: projects.reduce((s: number, p: any) => s + p.totalRevenue, 0),
      totalCosts: projects.reduce((s: number, p: any) => s + p.totalCosts, 0),
      profit: projects.reduce((s: number, p: any) => s + p.profit, 0),
      investorTotal: projects.reduce((s: number, p: any) => s + p.investorTotal, 0),
      escrowTotal: projects.reduce((s: number, p: any) => s + p.escrowTotal, 0),
      paid: projects.reduce((s: number, p: any) => s + p.paid, 0),
      remaining: projects.reduce((s: number, p: any) => s + p.remaining, 0),
      profitMarginRevenue: 0,
      profitMarginCost: 0,
      profitMarginCapital: 0,
    };
    totals.profitMarginRevenue = totals.totalRevenue > 0 ? (totals.profit / totals.totalRevenue) * 100 : 0;
    totals.profitMarginCost = totals.totalCosts > 0 ? (totals.profit / totals.totalCosts) * 100 : 0;
    totals.profitMarginCapital = totals.investorTotal > 0 ? (totals.profit / totals.investorTotal) * 100 : 0;

    // Build monthly distribution starting from August 2026
    // Report start index relative to chart start (April 2026)
    const reportStartIdx = (REPORT_START_YEAR - CHART_START_YEAR) * 12 + (REPORT_START_MONTH - CHART_START_MONTH); // = 4 (Aug is 4 months after April)
    
    // Find the latest month across all projects
    let maxChartIdx = 0;
    for (const p of data) {
      const lastIdx = projectMonthToChartIndex(p.startDate, p.totalMonths - 1);
      if (lastIdx > maxChartIdx) maxChartIdx = lastIdx;
    }
    
    // Build monthly rows from reportStartIdx to maxChartIdx
    const monthlyRows: { chartIdx: number; label: string; amounts: number[]; total: number }[] = [];
    for (let ci = reportStartIdx; ci <= maxChartIdx; ci++) {
      const amounts: number[] = [];
      let total = 0;
      for (const p of data) {
        const scKey = (p as any).financingScenario || "offplan_escrow";
        const sc = (p as any).scenarios[scKey];
        const monthly: number[] = sc.monthlyInvestor || [];
        // Convert chartIdx to project-relative month
        const projStartIdx = projectMonthToChartIndex(p.startDate, 0);
        const relMonth = ci - projStartIdx;
        const val = (relMonth >= 0 && relMonth < monthly.length) ? monthly[relMonth] : 0;
        amounts.push(val);
        total += val;
      }
      // Only include months that have some activity
      if (total > 0 || ci <= maxChartIdx) {
        monthlyRows.push({ chartIdx: ci, label: getMonthLabel(ci), amounts, total });
      }
    }

    return { projects, totals, monthlyRows };
  }, [data]);

  if (portfolioQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">جاري تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">لا توجد بيانات</p>
      </div>
    );
  }

  const { projects, totals, monthlyRows } = reportData;

  // Summary rows definition
  const summaryRows = [
    { label: "الإيرادات", key: "totalRevenue", format: "number" as const, color: "bg-emerald-50" },
    { label: "تكلفة المشروع", key: "totalCosts", format: "number" as const, color: "bg-red-50" },
    { label: "الربح", key: "profit", format: "number" as const, color: "bg-blue-50 font-bold" },
    { label: "نسبة الربح من الإيرادات", key: "profitMarginRevenue", format: "pct" as const, color: "" },
    { label: "نسبة الربح من التكلفة", key: "profitMarginCost", format: "pct" as const, color: "" },
    { label: "نسبة الربح من رأس المال", key: "profitMarginCapital", format: "pct" as const, color: "" },
    { label: "المبلغ المطلوب من المستثمر", key: "investorTotal", format: "number" as const, color: "bg-amber-50" },
    { label: "المبلغ المطلوب من حساب الضمان", key: "escrowTotal", format: "number" as const, color: "bg-purple-50" },
    { label: "المبلغ المدفوع من المستثمر", key: "paid", format: "number" as const, color: "bg-green-50" },
    { label: "المبلغ المتبقي على المستثمر", key: "remaining", format: "number" as const, color: "bg-orange-100 font-bold" },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white p-4 print:p-2" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 print:mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">تقرير المحفظة المالية</h1>
          <p className="text-xs text-gray-500 mt-0.5">{projects.length} مشاريع · السيناريو المعتمد لكل مشروع</p>
        </div>
        <button
          onClick={handlePrint}
          className="print:hidden flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          طباعة
        </button>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-2 py-1.5 text-right font-bold border-l border-gray-600 sticky right-0 bg-gray-800 z-10 min-w-[160px]">التفاصيل</th>
              {projects.map((p: any) => (
                <th key={p.id} className="px-2 py-1.5 text-center font-medium border-l border-gray-600 min-w-[110px] whitespace-nowrap">
                  {p.name.length > 20 ? p.name.substring(0, 20) + "…" : p.name}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-bold min-w-[110px] bg-gray-900">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.key} className={`border-b border-gray-100 ${row.color}`}>
                <td className={`px-2 py-1 text-right font-medium text-gray-800 border-l border-gray-200 sticky right-0 z-10 ${row.color || 'bg-white'}`}>
                  {row.label}
                </td>
                {projects.map((p: any) => (
                  <td key={p.id} className="px-2 py-1 text-center text-gray-700 border-l border-gray-100 tabular-nums">
                    {row.format === "pct"
                      ? `${(p as any)[row.key].toFixed(1)}%`
                      : formatAED((p as any)[row.key])}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-bold text-gray-900 bg-gray-50 tabular-nums">
                  {row.format === "pct"
                    ? `${(totals as any)[row.key].toFixed(1)}%`
                    : formatAED((totals as any)[row.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-2 mb-3 print:mb-2">
        <ArrowRight className="w-4 h-4 text-amber-600 rotate-180" />
        <h2 className="text-sm font-bold text-gray-800">التوزيع الشهري للمبالغ المطلوبة من المستثمر</h2>
        <span className="text-[10px] text-gray-400">(ابتداءً من أغسطس 2026)</span>
      </div>

      {/* Monthly Distribution Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="px-2 py-1 text-right font-bold border-l border-gray-500 sticky right-0 bg-gray-700 z-10 min-w-[100px]">الشهر</th>
              {projects.map((p: any) => (
                <th key={p.id} className="px-1.5 py-1 text-center font-medium border-l border-gray-500 min-w-[95px] whitespace-nowrap">
                  {p.name.length > 15 ? p.name.substring(0, 15) + "…" : p.name}
                </th>
              ))}
              <th className="px-2 py-1 text-center font-bold min-w-[95px] bg-gray-800">الإجمالي</th>
              <th className="px-2 py-1 text-center font-bold min-w-[95px] bg-gray-900">التراكمي</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let cumulative = 0;
              return monthlyRows.map((row, idx) => {
                cumulative += row.total;
                const isEvenYear = idx % 2 === 0;
                return (
                  <tr key={row.chartIdx} className={`border-b border-gray-50 ${isEvenYear ? '' : 'bg-gray-50/50'} hover:bg-amber-50/30`}>
                    <td className={`px-2 py-0.5 text-right font-medium text-gray-700 border-l border-gray-200 sticky right-0 z-10 ${isEvenYear ? 'bg-white' : 'bg-gray-50/50'}`}>
                      {row.label}
                    </td>
                    {row.amounts.map((val, pi) => (
                      <td key={pi} className="px-1.5 py-0.5 text-center text-gray-600 border-l border-gray-50 tabular-nums">
                        {val > 0 ? formatAED(val) : "—"}
                      </td>
                    ))}
                    <td className="px-2 py-0.5 text-center font-semibold text-gray-800 bg-gray-50 tabular-nums">
                      {row.total > 0 ? formatAED(row.total) : "—"}
                    </td>
                    <td className="px-2 py-0.5 text-center font-semibold text-amber-800 bg-amber-50/50 tabular-nums">
                      {formatAED(cumulative)}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800 text-white font-bold">
              <td className="px-2 py-1 text-right sticky right-0 bg-gray-800 z-10">الإجمالي</td>
              {projects.map((p: any) => (
                <td key={p.id} className="px-1.5 py-1 text-center border-l border-gray-600 tabular-nums">
                  {formatAED(p.remaining)}
                </td>
              ))}
              <td className="px-2 py-1 text-center bg-gray-900 tabular-nums">{formatAED(totals.remaining)}</td>
              <td className="px-2 py-1 text-center bg-gray-900 tabular-nums">{formatAED(totals.remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
