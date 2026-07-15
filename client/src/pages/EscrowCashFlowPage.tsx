import { useProjectContext } from "@/contexts/ProjectContext";
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
  const { selectedProjectId: ctxProjectId, setSelectedProjectId } = useProjectContext();
  const selectedProjectId = initialProjectId ?? ctxProjectId;

  const reportQuery = trpc.cashFlowSettings.getProjectMonthlyReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && isAuthenticated, staleTime: 10000 }
  );

  const report = reportQuery.data;

  // Build phase spans for the table header (only design + construction)
  const phaseSpans = useMemo(() => {
    if (!report) return [];
    const spans: { phase: string; label: string; startCol: number; count: number }[] = [];
    for (const p of report.phases) {
      // Only show design and construction as timeline phases
      if (p.type === "offplan" || p.type === "handover" || p.type === "land") continue;
      if (p.duration <= 0) continue;
      spans.push({
        phase: p.type,
        label: PHASE_LABELS[p.type] || p.type,
        startCol: p.startMonth,
        count: p.duration,
      });
    }
    return spans;
  }, [report]);

  // Totals
  const totalExpenses = report ? report.grandTotal : 0;
  const totalRevenue = report?.totalRevenueInflow || 0;
  const escrowExpenseTotal = report?.escrowExpensePerMonth?.reduce((s: number, v: number) => s + v, 0) || 0;
  const escrowOpeningBalance = report?.escrowOpeningBalance || 0;

  // Escrow balance at end
  const finalEscrowBalance = report?.escrowBalancePerMonth?.[report.escrowBalancePerMonth.length - 1] || 0;

  // Determine current month index
  const currentMonthIndex = useMemo(() => {
    if (!report) return -1;
    const now = new Date();
    const startDate = new Date(report.startDate);
    const diff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    return diff >= 0 && diff < report.totalMonths ? diff : -1;
  }, [report]);

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const isOffplan = report?.scenario === "offplan_escrow" || report?.scenario === "offplan_construction";

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
          <p className="text-sm text-gray-400">لم يتم العثور على إعدادات التدفق النقدي لهذا المشروع.</p>
        </div>
      ) : (
        <div>
          {/* Title + Export */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {selectedProject?.name || report.projectName} — التدفقات النقدية وحساب الضمان
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                السيناريو: {report.scenario === "no_offplan" ? "تطوير بدون بيع على الخارطة" : report.scenario === "offplan_escrow" ? "أوف بلان مع حساب ضمان" : report.scenario === "offplan_20pct" ? "أوف بلان بعد إنجاز 20%" : report.scenario}
                {" | "}المدة: {report.totalMonths} شهر
                {" | "}البداية: {report.monthLabels[0]}
                {isOffplan && report.paymentPlan && (
                  <> {" | "}خطة السداد: {report.paymentPlan.bookingPct}% حجز + {report.paymentPlan.constructionPct}% أقساط + {report.paymentPlan.handoverPct}% تسليم</>
                )}
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
          <div className={`grid ${isOffplan ? "grid-cols-5" : "grid-cols-2"} gap-3 mb-4`}>
            {isOffplan && escrowOpeningBalance > 0 && (
              <div className="bg-white rounded-lg border-2 border-purple-200 px-3 py-2 shadow-sm">
                <div className="text-[10px] text-purple-600">الرصيد الافتتاحي (إيداع 20%)</div>
                <div className="text-sm font-bold text-purple-700">{fmt(escrowOpeningBalance)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
              </div>
            )}
            <div className="bg-white rounded-lg border-2 border-red-200 px-3 py-2 shadow-sm">
              <div className="text-[10px] text-red-600">إجمالي مصاريف الضمان</div>
              <div className="text-sm font-bold text-red-700">{fmt(escrowExpenseTotal)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
            </div>
            {isOffplan && (
              <>
                <div className="bg-white rounded-lg border-2 border-emerald-200 px-3 py-2 shadow-sm">
                  <div className="text-[10px] text-emerald-600">إجمالي الإيرادات (من المبيعات)</div>
                  <div className="text-sm font-bold text-emerald-700">{fmt(totalRevenue)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
                </div>
                <div className="bg-white rounded-lg border-2 border-amber-200 px-3 py-2 shadow-sm">
                  <div className="text-[10px] text-amber-600">إجمالي الداخل (إيداع + إيرادات)</div>
                  <div className="text-sm font-bold text-amber-700">{fmt(escrowOpeningBalance + totalRevenue)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
                </div>
                <div className={`bg-white rounded-lg border-2 px-3 py-2 shadow-sm ${finalEscrowBalance >= 0 ? "border-emerald-300" : "border-red-300"}`}>
                  <div className="text-[10px] text-gray-600">رصيد الضمان النهائي</div>
                  <div className={`text-sm font-bold ${finalEscrowBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmtSigned(finalEscrowBalance)} <span className="text-[10px] font-normal text-gray-400">درهم</span>
                  </div>
                </div>
              </>
            )}
            {!isOffplan && (
              <div className="bg-white rounded-lg border-2 border-orange-300 px-3 py-2 shadow-sm">
                <div className="text-[10px] text-orange-600 font-medium">إجمالي الإيرادات المعتمدة</div>
                <div className="text-sm font-bold text-orange-700">{fmt(report.totalRevenue || 0)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
              </div>
            )}
          </div>

          {/* Absorption Info */}
          {isOffplan && report.absorption && (
            <div className="mb-4 bg-blue-50 rounded-lg border border-blue-200 px-4 py-2">
              <div className="text-xs font-bold text-blue-800 mb-1">جدول الامتصاص (Absorption Schedule)</div>
              <div className="text-[10px] text-blue-700">
                فترة البيع: من الشهر {report.absorption.salesStartMonth + 1} إلى الشهر {report.absorption.salesEndMonth + 1}
                {" | "}عدد أشهر البيع: {report.absorption.salesMonths} شهر
                {" | "}نموذج: امتصاص خطي (Linear Absorption)
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
                {/* ═══ REVENUE SECTION (only for offplan) ═══ */}
                {isOffplan && report.revenuePerMonth && (
                  <>
                    <tr className="bg-emerald-100 border-t-2 border-emerald-300">
                      <td colSpan={2 + report.totalMonths} className="px-2 py-1.5 text-right font-bold text-emerald-800 text-[11px]">
                        الإيرادات — حساب الضمان (من بيع الوحدات)
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 font-bold">
                      <td className="px-1 py-1.5 text-right border-l border-emerald-200 text-emerald-800 text-[10px] sticky right-0 z-10 bg-emerald-50">
                        إيرادات المبيعات الشهرية
                      </td>
                      <td className="px-1 py-1.5 text-center border-l border-emerald-200 text-emerald-800 tabular-nums text-[10px]">
                        {fmt(totalRevenue)}
                      </td>
                      {report.revenuePerMonth.map((val: number, mi: number) => (
                        <td key={mi} className={`px-1 py-1.5 text-center border-l border-emerald-200 tabular-nums text-emerald-700 text-[10px] ${
                          mi === currentMonthIndex ? "bg-yellow-50" : ""
                        }`}>
                          {val > 0 ? fmt(val) : "-"}
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* ═══ ESCROW EXPENSE SECTION (only escrow-funded items) ═══ */}
                <tr className="bg-red-100 border-t-2 border-red-300">
                  <td colSpan={2 + report.totalMonths} className="px-2 py-1.5 text-right font-bold text-red-800 text-[11px]">
                    المصاريف — حساب الضمان فقط
                  </td>
                </tr>
                {report.items.filter((item: any) => item.fundingSource === "escrow").map((item: any, idx: number) => (
                  <tr key={item.itemKey} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-inherit">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 bg-blue-500"></span>
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

                {/* Total Escrow Expenses Row */}
                <tr className="bg-red-50 border-t-2 border-red-200 font-bold">
                  <td className="px-1 py-1.5 text-right border-l border-red-200 text-red-800 text-[10px] sticky right-0 z-10 bg-red-50">إجمالي مصاريف الضمان</td>
                  <td className="px-1 py-1.5 text-center border-l border-red-200 text-red-800 tabular-nums text-[10px]">{fmt(escrowExpenseTotal)}</td>
                  {(report.escrowExpensePerMonth || report.totalPerMonth).map((val: number, mi: number) => (
                    <td key={mi} className={`px-1 py-1.5 text-center border-l border-red-200 tabular-nums text-red-700 text-[10px] ${
                      mi === currentMonthIndex ? "bg-yellow-50" : ""
                    }`}>
                      {val > 0 ? `(${fmt(val)})` : "-"}
                    </td>
                  ))}
                </tr>

                {/* ═══ ESCROW BALANCE SECTION (only for offplan) ═══ */}
                {isOffplan && report.escrowExpensePerMonth && report.escrowBalancePerMonth && (
                  <>
                    <tr className="bg-blue-100 border-t-2 border-blue-300">
                      <td colSpan={2 + report.totalMonths} className="px-2 py-1.5 text-right font-bold text-blue-800 text-[11px]">
                        حساب الضمان — الرصيد (إيداع 20% + إيرادات - مصاريف)
                      </td>
                    </tr>
                    {/* Opening balance row */}
                    {escrowOpeningBalance > 0 && (
                      <tr className="bg-purple-50">
                        <td className="px-1 py-1 text-right border-l border-purple-100 text-purple-700 text-[10px] sticky right-0 z-10 bg-purple-50 font-bold">
                          الرصيد الافتتاحي (إيداع المستثمر 20% من تكلفة الإنشاء)
                        </td>
                        <td className="px-1 py-1 text-center border-l border-purple-100 text-purple-700 tabular-nums text-[10px] font-bold">
                          {fmt(escrowOpeningBalance)}
                        </td>
                        {report.escrowBalancePerMonth.map((_: number, mi: number) => (
                          <td key={mi} className="px-1 py-1 text-center border-l border-purple-100 tabular-nums text-purple-400 text-[10px]">
                            {mi === 0 ? fmt(escrowOpeningBalance) : "-"}
                          </td>
                        ))}
                      </tr>
                    )}
                    {/* Escrow expenses only */}
                    <tr className="bg-blue-50/50">
                      <td className="px-1 py-1 text-right border-l border-blue-100 text-blue-700 text-[10px] sticky right-0 z-10 bg-blue-50/50 font-medium">
                        مصاريف الضمان الشهرية
                      </td>
                      <td className="px-1 py-1 text-center border-l border-blue-100 text-blue-700 tabular-nums text-[10px] font-bold">
                        {fmt(escrowExpenseTotal)}
                      </td>
                      {report.escrowExpensePerMonth.map((val: number, mi: number) => (
                        <td key={mi} className={`px-1 py-1 text-center border-l border-blue-100 tabular-nums text-blue-600 text-[10px] ${
                          mi === currentMonthIndex ? "bg-yellow-50" : ""
                        }`}>
                          {val > 0 ? `(${fmt(val)})` : "-"}
                        </td>
                      ))}
                    </tr>
                    {/* Net escrow flow per month */}
                    <tr className="bg-blue-50/80">
                      <td className="px-1 py-1 text-right border-l border-blue-100 text-blue-700 text-[10px] sticky right-0 z-10 bg-blue-50/80 font-medium">
                        صافي التدفق الشهري (إيرادات - مصاريف)
                      </td>
                      <td className="px-1 py-1 text-center border-l border-blue-100 text-blue-700 tabular-nums text-[10px] font-bold">
                        {fmt(totalRevenue - escrowExpenseTotal)}
                      </td>
                      {report.revenuePerMonth.map((rev: number, mi: number) => {
                        const net = rev - (report.escrowExpensePerMonth?.[mi] || 0);
                        return (
                          <td key={mi} className={`px-1 py-1 text-center border-l border-blue-100 tabular-nums text-[10px] ${
                            mi === currentMonthIndex ? "bg-yellow-50" : ""
                          } ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {net !== 0 ? fmtSigned(net) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Cumulative escrow balance */}
                    <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                      <td className="px-2 py-2 text-right border-l border-gray-600 text-xs sticky right-0 z-10 bg-gray-800">رصيد حساب الضمان التراكمي</td>
                      <td className="px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs">-</td>
                      {report.escrowBalancePerMonth.map((val: number, mi: number) => (
                        <td key={mi} className={`px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs ${
                          val < 0 ? "text-red-300" : "text-emerald-300"
                        }`}>
                          {fmtSigned(val)}
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* For non-offplan: simple cumulative expense balance */}
                {!isOffplan && (
                  <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                    <td className="px-2 py-2 text-right border-l border-gray-600 text-xs sticky right-0 z-10 bg-gray-800">الرصيد التراكمي</td>
                    <td className="px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs">-</td>
                    {report.totalPerMonth.map((_: number, mi: number) => {
                      let cum = 0;
                      for (let i = 0; i <= mi; i++) cum -= report.totalPerMonth[i] || 0;
                      return (
                        <td key={mi} className={`px-2 py-2 text-center border-l border-gray-600 tabular-nums text-xs ${
                          cum < 0 ? "text-red-300" : "text-emerald-300"
                        }`}>
                          {fmtSigned(cum)}
                        </td>
                      );
                    })}
                  </tr>
                )}
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
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> مموّل من الضمان
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> مموّل من المستثمر
            </div>
          </div>

          <div className="mt-2 text-[9px] text-gray-400">
            📊 المصدر: إعدادات التدفق النقدي + خطة السداد من التسعير + جدول الامتصاص الخطي
          </div>
        </div>
      )}
    </div>
  );
}
