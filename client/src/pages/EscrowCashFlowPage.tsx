import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { exportProjectCashFlowHTML } from "@/lib/projectCashFlowReport";

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

  // Separate expense items from revenue items
  const { expenseItems, revenueItems } = useMemo(() => {
    if (!report) return { expenseItems: [], revenueItems: [] };
    const expenses = report.items.filter((i: any) => i.category !== "revenue");
    const revenues = report.items.filter((i: any) => i.category === "revenue");
    return { expenseItems: expenses, revenueItems: revenues };
  }, [report]);

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
  const totalRevenue = report ? (report as any).grandRevenue || 0 : 0;
  const settlement = report ? (report as any).settlement : null;

  // Revenue per month and expense per month
  const revenuePerMonth = useMemo(() => {
    if (!report) return [];
    return (report as any).revenuePerMonth || [];
  }, [report]);

  const expensePerMonth = useMemo(() => {
    if (!report) return [];
    return (report as any).expensePerMonth || report.totalPerMonth || [];
  }, [report]);

  // Running balance: revenue - expenses (cumulative)
  const runningBalance = useMemo(() => {
    if (!report) return [];
    const balances: number[] = [];
    let cumulative = 0;
    for (let m = 0; m < report.totalMonths; m++) {
      const rev = revenuePerMonth[m] || 0;
      const exp = expensePerMonth[m] || 0;
      cumulative += rev - exp;
      balances.push(cumulative);
    }
    return balances;
  }, [report, revenuePerMonth, expensePerMonth]);

  // Net monthly (revenue - expense per month)
  const netPerMonth = useMemo(() => {
    if (!report) return [];
    return Array.from({ length: report.totalMonths }, (_, m) => (revenuePerMonth[m] || 0) - (expensePerMonth[m] || 0));
  }, [report, revenuePerMonth, expensePerMonth]);

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
        total += expensePerMonth[m] || 0;
      }
    }
    const e = new Date(now);
    e.setMonth(e.getMonth() + 2);
    const label = `${months[now.getMonth()]} - ${months[e.getMonth()]} ${e.getFullYear()}`;
    return { total, label };
  }, [report, expensePerMonth]);

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
          <h2 className="text-xl font-bold text-gray-400 mb-2">اختر مشروع لعرض حساب الضمان</h2>
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
          <p className="text-sm text-gray-400">لم يتم العثور على إعدادات التدفق النقدي لهذا المشروع.</p>
        </div>
      ) : (
        <div>
          {/* Title + Export Button */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {selectedProject?.name || report.projectName} — حساب الضمان (Escrow Account)
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                السيناريو: {report.scenario === "no_offplan" ? "تطوير بدون بيع على الخارطة" : report.scenario === "offplan_escrow" ? "أوف بلان مع حساب ضمان" : report.scenario === "offplan_construction" ? "أوف بلان بعد إنجاز 20%" : report.scenario}
                {" | "}المدة: {report.totalMonths} شهر
                {" | "}البداية: {report.monthLabels[0]}
              </p>
            </div>
            <button
              onClick={() => exportProjectCashFlowHTML(report as any)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-all hover:shadow-md"
            >
              <span>🖨️</span>
              <span>تصدير HTML</span>
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border-2 border-emerald-200 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-emerald-600 font-medium">إجمالي الإيرادات المودعة</div>
              <div className="text-sm font-bold text-emerald-700">{fmt(totalRevenue)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
            <div className="bg-white rounded-lg border-2 border-red-200 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-red-600 font-medium">إجمالي المصروفات</div>
              <div className="text-sm font-bold text-red-700">{fmt(totalExpenses)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
            <div className={`bg-white rounded-lg border-2 px-3 py-2 shadow-sm ${(totalRevenue - totalExpenses) >= 0 ? "border-emerald-300" : "border-red-300"}`}>
              <div className="text-[10px] text-gray-600 font-medium">الفائض الصافي</div>
              <div className={`text-sm font-bold ${(totalRevenue - totalExpenses) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {fmtSigned(totalRevenue - totalExpenses)} <span className="text-[10px] font-normal text-gray-400">درهم</span>
              </div>
            </div>
            <div className="bg-white rounded-lg border-2 border-orange-300 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-orange-600 font-medium">مصاريف الـ 3 أشهر القادمة</div>
              <div className="text-[9px] text-orange-400">{next3MonthsInfo.label}</div>
              <div className="text-sm font-bold text-orange-700">{fmt(next3MonthsInfo.total)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
          </div>

          {/* Settlement Summary (RERA Law 8/2007) */}
          {settlement && settlement.netSurplus > 0 && (
            <div className="mb-4 bg-gradient-to-l from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 shadow-sm p-4">
              <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                <span>🏛️</span>
                <span>التسوية عند التسليم (قانون رقم 8 لسنة 2007 — المادة 14)</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/80 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500">إجمالي المودع في الضمان</div>
                  <div className="text-sm font-bold text-gray-800">{fmt(settlement.totalDeposited)}</div>
                </div>
                <div className="bg-white/80 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500">إجمالي المصروفات</div>
                  <div className="text-sm font-bold text-red-700">{fmt(settlement.totalExpenses)}</div>
                </div>
                <div className="bg-white/80 rounded-lg px-3 py-2 border-2 border-emerald-300">
                  <div className="text-[10px] text-emerald-600 font-medium">المستلم عند التسليم (95%)</div>
                  <div className="text-sm font-bold text-emerald-800">{fmt(settlement.releasedAtHandover)}</div>
                </div>
                <div className="bg-white/80 rounded-lg px-3 py-2 border border-amber-300">
                  <div className="text-[10px] text-amber-600 font-medium">محجوز 5% — يُفرج بعد 12 شهر</div>
                  <div className="text-sm font-bold text-amber-800">{fmt(settlement.releasedAfter12Months)}</div>
                </div>
              </div>
              <div className="mt-2 text-[9px] text-gray-500">
                * الحجز 5% من إجمالي المبالغ المودعة في حساب الضمان — يُفرج بعد 12 شهراً من تسجيل الوحدات (فترة ضمان العيوب)
              </div>
            </div>
          )}

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
                  {report.monthLabels.map((label: string, mi: number) => (
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
                {/* ═══ Revenue Section ═══ */}
                {revenueItems.length > 0 && (
                  <>
                    <tr className="bg-emerald-50/70">
                      <td colSpan={2 + report.totalMonths} className="px-2 py-1.5 text-right font-bold text-emerald-800 text-[10px] border-b border-emerald-200">
                        📥 الإيرادات (المبالغ المودعة في حساب الضمان)
                      </td>
                    </tr>
                    {revenueItems.map((item: any, idx: number) => (
                      <tr key={item.itemKey} className={`${idx % 2 === 0 ? "bg-emerald-50/30" : "bg-white"} hover:bg-emerald-50/50 transition-colors`}>
                        <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-emerald-800 text-[10px] sticky right-0 z-10 bg-inherit">
                          {item.nameAr}
                        </td>
                        <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-emerald-700 tabular-nums text-[10px]">
                          {fmt(item.totalAmount)}
                        </td>
                        {item.monthlyAmounts.map((val: number, mi: number) => (
                          <td key={mi} className={`px-1 py-1 text-center border-l border-gray-100 tabular-nums text-[10px] ${
                            mi === currentMonthIndex ? "bg-yellow-50" : ""
                          } ${val > 0 ? "text-emerald-700" : "text-gray-300"}`}>
                            {val > 0 ? fmt(val) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Revenue Total Row */}
                    <tr className="bg-emerald-100 border-t border-emerald-200 font-bold">
                      <td className="px-1 py-1.5 text-right border-l border-emerald-200 text-emerald-800 text-[10px] sticky right-0 z-10 bg-emerald-100">إجمالي الإيرادات</td>
                      <td className="px-1 py-1.5 text-center border-l border-emerald-200 text-emerald-800 tabular-nums text-[10px]">{fmt(totalRevenue)}</td>
                      {revenuePerMonth.map((val: number, mi: number) => (
                        <td key={mi} className={`px-1 py-1.5 text-center border-l border-emerald-200 tabular-nums text-emerald-700 text-[10px] ${
                          mi === currentMonthIndex ? "bg-yellow-50" : ""
                        }`}>
                          {val > 0 ? fmt(val) : "-"}
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* ═══ Expense Section ═══ */}
                <tr className="bg-red-50/70">
                  <td colSpan={2 + report.totalMonths} className="px-2 py-1.5 text-right font-bold text-red-800 text-[10px] border-b border-red-200">
                    📤 المصروفات (المبالغ المصروفة من حساب الضمان)
                  </td>
                </tr>
                {expenseItems.map((item: any, idx: number) => (
                  <tr key={item.itemKey} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-inherit">
                      {item.nameAr}
                    </td>
                    <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                      {fmt(item.totalAmount)}
                    </td>
                    {item.monthlyAmounts.map((val: number, mi: number) => (
                      <td key={mi} className={`px-1 py-1 text-center border-l border-gray-100 tabular-nums text-[10px] ${
                        mi === currentMonthIndex ? "bg-yellow-50" : ""
                      } ${val > 0 ? "text-gray-700" : "text-gray-300"}`}>
                        {val > 0 ? fmt(val) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Total Expenses Row */}
                <tr className="bg-red-100 border-t-2 border-red-200 font-bold">
                  <td className="px-1 py-1.5 text-right border-l border-red-200 text-red-800 text-[10px] sticky right-0 z-10 bg-red-100">إجمالي المصروفات</td>
                  <td className="px-1 py-1.5 text-center border-l border-red-200 text-red-800 tabular-nums text-[10px]">{fmt(totalExpenses)}</td>
                  {expensePerMonth.map((val: number, mi: number) => (
                    <td key={mi} className={`px-1 py-1.5 text-center border-l border-red-200 tabular-nums text-red-700 text-[10px] ${
                      mi === currentMonthIndex ? "bg-yellow-50" : ""
                    }`}>
                      {val > 0 ? `(${fmt(val)})` : "-"}
                    </td>
                  ))}
                </tr>

                {/* ═══ Net Monthly (Revenue - Expenses) ═══ */}
                <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                  <td className="px-1 py-1.5 text-right border-l border-blue-200 text-blue-800 text-[10px] sticky right-0 z-10 bg-blue-50">الصافي الشهري</td>
                  <td className="px-1 py-1.5 text-center border-l border-blue-200 text-blue-800 tabular-nums text-[10px]">{fmtSigned(totalRevenue - totalExpenses)}</td>
                  {netPerMonth.map((val: number, mi: number) => (
                    <td key={mi} className={`px-1 py-1.5 text-center border-l border-blue-200 tabular-nums text-[10px] ${
                      mi === currentMonthIndex ? "bg-yellow-50" : ""
                    } ${val > 0 ? "text-emerald-700" : val < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {val !== 0 ? fmtSigned(val) : "-"}
                    </td>
                  ))}
                </tr>

                {/* Running Balance (Cumulative) */}
                <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                  <td className="px-2 py-2 text-right border-l border-gray-600 text-xs sticky right-0 z-10 bg-gray-800">الرصيد التراكمي</td>
                  <td className="px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs">-</td>
                  {runningBalance.map((val: number, mi: number) => (
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
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 bg-emerald-100 rounded-sm border border-emerald-300 inline-block"></span> إيرادات
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-100 rounded-sm border border-red-300 inline-block"></span> مصروفات
            </div>
          </div>

          <div className="mt-2 text-[9px] text-gray-400">
            📊 المصدر: جدول الامتصاص — 80% خلال الإنشاء (11 شهر) + 20% بعد التسليم | جدول الدفع: 10% حجز + 50% أقساط إنشاء + 40% تسليم (قابل للتعديل)
          </div>
          <div className="mt-1 text-[9px] text-gray-400">
            🏛️ حجز 5% من إجمالي المودع وفقاً لقانون رقم 8 لسنة 2007 (المادة 14) — يُفرج بعد 12 شهراً من تسجيل الوحدات
          </div>
        </div>
      )}
    </div>
  );
}
