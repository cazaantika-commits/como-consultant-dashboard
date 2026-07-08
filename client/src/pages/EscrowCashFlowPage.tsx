import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PHASE_COLORS: Record<string, { bg: string; header: string; text: string }> = {
  design: { bg: "bg-purple-50", header: "bg-purple-700 text-white", text: "text-purple-900" },
  offplan: { bg: "bg-blue-50", header: "bg-blue-700 text-white", text: "text-blue-900" },
  construction: { bg: "bg-sky-50", header: "bg-sky-800 text-white", text: "text-sky-900" },
  handover: { bg: "bg-emerald-50", header: "bg-emerald-700 text-white", text: "text-emerald-900" },
  land: { bg: "bg-amber-50", header: "bg-amber-700 text-white", text: "text-amber-900" },
};

const PHASE_LABELS: Record<string, string> = {
  design: "التصاميم",
  offplan: "أوف بلان",
  construction: "الإنشاء",
  handover: "التسليم",
  land: "الأرض",
};

function fmt(n: number): string {
  if (!n || n === 0) return "-";
  return Math.round(n).toLocaleString("ar-AE");
}

function fmtSigned(n: number): string {
  if (n === 0) return "-";
  const formatted = Math.abs(Math.round(n)).toLocaleString("ar-AE");
  return n < 0 ? `(${formatted})` : formatted;
}

export default function EscrowCashFlowPage({ embedded, initialProjectId }: { embedded?: boolean; initialProjectId?: number | null } = {}) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);

  useEffect(() => {
    if (initialProjectId != null) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  // Fetch the monthly report from the server (unified source: project_cash_flow_settings)
  const reportQuery = trpc.cashFlowSettings.getProjectMonthlyReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && isAuthenticated, staleTime: 10000 }
  );

  const report = reportQuery.data;

  // Build phase spans for the table header
  const phaseSpans = useMemo(() => {
    if (!report) return [];
    const spans: { phase: string; label: string; startCol: number; count: number }[] = [];
    for (const p of report.phases) {
      spans.push({
        phase: p.type,
        label: PHASE_LABELS[p.type] || p.type,
        startCol: p.startMonth,
        count: p.duration,
      });
    }
    return spans;
  }, [report]);

  // Compute totals
  const totalExpenses = report ? report.grandTotal : 0;

  // Next 3 months forecast
  const next3MonthsInfo = useMemo(() => {
    if (!report) return { total: 0, label: "" };
    const now = new Date();
    const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const startDate = new Date(report.startDate);
    let total = 0;
    for (let m = 0; m < report.totalMonths; m++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + m);
      const diffMonths = (monthDate.getFullYear() - now.getFullYear()) * 12 + (monthDate.getMonth() - now.getMonth());
      if (diffMonths >= 0 && diffMonths < 3) {
        total += report.totalPerMonth[m] || 0;
      }
    }
    const e = new Date(now);
    e.setMonth(e.getMonth() + 2);
    const label = `${months[now.getMonth()]} - ${months[e.getMonth()]} ${e.getFullYear()}`;
    return { total, label };
  }, [report]);

  // Running balance (cumulative expenses as negative)
  const runningBalance = useMemo(() => {
    if (!report) return [];
    const balances: number[] = [];
    let cumulative = 0;
    for (let m = 0; m < report.totalMonths; m++) {
      cumulative -= report.totalPerMonth[m] || 0;
      balances.push(cumulative);
    }
    return balances;
  }, [report]);

  // Determine current month index
  const currentMonthIndex = useMemo(() => {
    if (!report) return -1;
    const now = new Date();
    const startDate = new Date(report.startDate);
    const diff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    return diff >= 0 && diff < report.totalMonths ? diff : -1;
  }, [report]);

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gray-50 p-4`} dir="rtl">
      {/* Project Selector */}
      {!initialProjectId && (
        <div className="mb-3 bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-gray-500">اختر المشروع</label>
              <select
                className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium"
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— اختر مشروع —</option>
                {(projectsQuery.data || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {!selectedProjectId ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-30">🏦</div>
          <h2 className="text-xl font-bold text-gray-400 mb-2">اختر مشروع لعرض التدفقات النقدية</h2>
          <p className="text-sm text-gray-400">اختر مشروع من القائمة أعلاه</p>
        </div>
      ) : reportQuery.isLoading ? (
        <div className="text-center py-20">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-sm text-gray-500">جاري تحميل البيانات...</p>
        </div>
      ) : !report ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-30">⚠️</div>
          <h2 className="text-xl font-bold text-gray-400 mb-2">لا توجد بيانات</h2>
          <p className="text-sm text-gray-400">لم يتم العثور على إعدادات التدفق النقدي لهذا المشروع. يرجى إعداد خطة رأس المال أولاً.</p>
        </div>
      ) : (
        <div>
          {/* Title */}
          <div className="mb-3">
            <h1 className="text-base font-bold text-gray-900">
              {selectedProject?.name || report.projectName} — التدفقات النقدية
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              السيناريو: {report.scenario === "no_offplan" ? "تطوير بدون بيع على الخارطة" : report.scenario === "offplan_escrow" ? "أوف بلان مع حساب ضمان" : report.scenario === "offplan_20pct" ? "أوف بلان بعد إنجاز 20%" : report.scenario}
              {" | "}المدة: {report.totalMonths} شهر
              {" | "}البداية: {report.monthLabels[0]}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-lg border-2 border-red-200 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-red-600">إجمالي المصاريف</div>
              <div className="text-sm font-bold text-red-700">{fmt(totalExpenses)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
            <div className={`bg-white rounded-lg border px-3 py-2 shadow-sm ${(runningBalance[runningBalance.length - 1] || 0) >= 0 ? "border-emerald-300" : "border-red-300"}`}>
              <div className="text-[10px] text-gray-600">الرصيد النهائي</div>
              <div className={`text-sm font-bold ${(runningBalance[runningBalance.length - 1] || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {fmtSigned(runningBalance[runningBalance.length - 1] || 0)} <span className="text-[10px] font-normal text-gray-400">درهم</span>
              </div>
            </div>
            <div className="bg-white rounded-lg border-2 border-orange-300 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-orange-600 font-medium">مصاريف الـ 3 أشهر القادمة</div>
              <div className="text-[9px] text-orange-400">{next3MonthsInfo.label}</div>
              <div className="text-sm font-bold text-orange-700">{fmt(next3MonthsInfo.total)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                {/* Phase header row */}
                <tr>
                  <th className="bg-gray-800 text-white px-1 py-1.5 text-right font-medium border-l border-gray-600 w-[140px] text-[10px] sticky right-0 z-10">البند</th>
                  <th className="bg-gray-800 text-white px-1 py-1.5 text-center font-medium border-l border-gray-600 w-[80px] text-[10px]">الإجمالي</th>
                  {phaseSpans.map((span, i) => (
                    <th key={i} colSpan={span.count}
                      className={`${PHASE_COLORS[span.phase]?.header || "bg-gray-700 text-white"} px-1 py-1.5 text-center font-medium border-l border-gray-600 text-[10px]`}>
                      {span.label}
                    </th>
                  ))}
                </tr>
                {/* Month labels row */}
                <tr className="bg-gray-100">
                  <th className="bg-gray-100 px-1 py-1 text-right text-gray-500 border-l border-gray-200 text-[9px] sticky right-0 z-10">الفترة</th>
                  <th className="bg-gray-100 px-1 py-1 text-center text-gray-500 border-l border-gray-200 text-[9px]">(درهم)</th>
                  {report.monthLabels.map((label, mi) => (
                    <th key={mi} className={`px-1 py-1 text-center border-l border-gray-200 text-[9px] ${
                      mi === currentMonthIndex ? "bg-yellow-100 font-bold text-yellow-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {label}
                      {mi === currentMonthIndex && <div className="text-[8px] text-yellow-600">◄ الآن</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Expense rows */}
                {report.items.map((item, idx) => (
                  <tr key={item.itemKey} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-inherit">
                      {item.nameAr}
                    </td>
                    <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                      {fmt(item.totalAmount)}
                    </td>
                    {item.monthlyAmounts.map((val, mi) => (
                      <td key={mi} className={`px-1 py-1 text-center border-l border-gray-100 tabular-nums text-[10px] ${
                        mi === currentMonthIndex ? "bg-yellow-50" : ""
                      } ${val > 0 ? "text-gray-700" : "text-gray-300"}`}>
                        {val > 0 ? fmt(val) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Total Expenses Row */}
                <tr className="bg-red-50 border-t-2 border-red-200 font-bold">
                  <td className="px-1 py-1.5 text-right border-l border-red-200 text-red-800 text-[10px] sticky right-0 z-10 bg-red-50">إجمالي المصاريف</td>
                  <td className="px-1 py-1.5 text-center border-l border-red-200 text-red-800 tabular-nums text-[10px]">{fmt(totalExpenses)}</td>
                  {report.totalPerMonth.map((val, mi) => (
                    <td key={mi} className={`px-1 py-1.5 text-center border-l border-red-200 tabular-nums text-red-700 text-[10px] ${
                      mi === currentMonthIndex ? "bg-yellow-50" : ""
                    }`}>
                      {val > 0 ? `(${fmt(val)})` : "-"}
                    </td>
                  ))}
                </tr>

                {/* Running Balance (Cumulative) */}
                <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                  <td className="px-2 py-2 text-right border-l border-gray-600 text-xs sticky right-0 z-10 bg-gray-800">الرصيد التراكمي</td>
                  <td className="px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs">-</td>
                  {runningBalance.map((val, mi) => (
                    <td key={mi} className={`px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs ${
                      val < 0 ? "text-red-300" : "text-emerald-300"
                    }`}>
                      {fmtSigned(val)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
            {phaseSpans.map(span => (
              <div key={span.phase} className="flex items-center gap-1">
                <span className={`w-3 h-3 ${PHASE_COLORS[span.phase]?.bg || "bg-gray-100"} rounded-sm border inline-block`}></span>
                {span.label}
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 bg-yellow-100 rounded-sm border border-yellow-300 inline-block"></span> الفترة الحالية
            </div>
          </div>

          <div className="mt-2 text-[9px] text-gray-400">
            📊 المصدر: إعدادات التدفق النقدي المحفوظة (project_cash_flow_settings) — نفس المصدر المستخدم في المحفظة الديناميكية
          </div>
        </div>
      )}
    </div>
  );
}
