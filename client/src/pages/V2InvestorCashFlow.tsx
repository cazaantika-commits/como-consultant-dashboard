import React, { useMemo } from "react";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import { buildSalesResultFromSavedPlan } from "@/lib/salesPlanCashFlow";
import { calculateInvestorMonthlyNet } from "@/lib/investorCashFlowNet";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "-";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return Math.round(n).toLocaleString("en-US");
}

function formatDate(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${monthNames[parseInt(m) - 1]} ${y}`;
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2InvestorCashFlow() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const scenario = ((projectQuery.data as any)?.financingScenario || "offplan_escrow") as Scenario;

  // ─── Parse salesResult from saved plan ─────────────────────────────────
  const salesResult = useMemo(
    () => buildSalesResultFromSavedPlan(plansQuery.data?.[0] as any, projectQuery.data, scenario),
    [plansQuery.data, projectQuery.data, scenario],
  );

  // ─── Compute cash flow from engine ─────────────────────────────────────
  const data = useMemo(() => {
    return computeInvestorCashFlow(projectQuery.data || null, scenario, undefined, salesResult);
  }, [projectQuery.data, scenario, salesResult]);

  const {
    rows,
    designDuration,
    constructionDuration,
    postDuration,
    designMonthlyTotals,
    constructionMonthlyTotals,
    postMonthlyTotals,
    revenuePostTotals,
    cumulativeDesign,
    cumulativeConstruction,
    cumulativePost,
    grandPaid,
    grandInvestor,
    totalRevenue,
    monthDates,
  } = data;

  const totalMonths = designDuration + constructionDuration + postDuration;
  const projectName = projectQuery.data?.name || "—";

  // ─── Build flat monthly arrays for each row ────────────────────────────
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  const { debitRows, creditRows, paidRows, debitTotals, creditTotals, netFlow, cumulative } = calculateInvestorMonthlyNet(data, salesResult);

  const totalDebit = debitTotals.reduce((s, v) => s + v, 0);
  const totalCredit = creditTotals.reduce((s, v) => s + v, 0);
  const profit = totalCredit - totalDebit;

  // ─── Month headers with phase info ─────────────────────────────────────
  const months: { label: string; date: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[i] || "", phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + i] || "", phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + constructionDuration + i] || "", phase: "post" });

  const phaseColors = {
    design: "bg-blue-50 text-blue-700",
    construction: "bg-amber-50 text-amber-700",
    post: "bg-emerald-50 text-emerald-700",
  };

  // ─── Loading state ─────────────────────────────────────────────────────
  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="mr-2 text-gray-500 text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/v2")} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900">التدفقات النقدية للمستثمر</h1>
              <p className="text-xs text-gray-500 truncate">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-red-600 font-semibold">مطلوب من المستثمر: {fmt(totalDebit)}</span>
              <span className="text-green-600 font-semibold">مستلم للمستثمر: {fmt(totalCredit)}</span>
              <span className="text-blue-700 font-bold">الصافي: {fmt(profit)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold">
              <Download className="w-3.5 h-3.5" /> تصدير
            </button>
          </div>
        </div>
      </div>



      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-4 text-xs font-medium text-gray-700">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-200"></span> تصميم ({designDuration} أشهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({constructionDuration} شهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({postDuration} شهر)</span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="bg-white shadow-sm">
            {/* Date row */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-3 py-1.5 text-right w-[220px] min-w-[220px] text-[10px] text-gray-500">التاريخ</th>
              {months.map((m, i) => (
                <th key={i} className="px-1 py-1 text-center border-b border-gray-100 text-[9px] text-gray-500 font-medium whitespace-nowrap">
                  {m.date ? m.date.split("-")[1] + "/" + m.date.split("-")[0].slice(2) : ""}
                </th>
              ))}
            </tr>
            {/* Phase band */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-3 py-1.5 text-right w-[220px] min-w-[220px]"></th>
              {months.map((m, i) => (
                <th key={i} className={`px-1.5 py-1 text-center border-b border-gray-200 ${phaseColors[m.phase]} font-semibold text-[11px]`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── مدفوع سابقاً ─── */}
            {paidRows.length > 0 && (
              <>
                <tr className="bg-gray-100">
                  <td colSpan={totalMonths + 1} className="px-3 py-2 font-bold text-gray-700 text-[11px] border-b border-gray-200">
                    مدفوع سابقاً (لا يؤثر على التدفقات)
                  </td>
                </tr>
                {paidRows.map((item, i) => (
                  <tr key={`paid-${i}`} className="border-b border-gray-100 bg-gray-50">
                    <td className="sticky right-0 z-10 bg-gray-50 px-3 py-2 text-gray-700 font-semibold border-l border-gray-200 w-[220px] min-w-[220px]">
                      {item.label}
                    </td>
                    <td className="px-1.5 py-2 text-center text-gray-600 font-medium" colSpan={totalMonths}>
                      {fmt(item.paid)} (مدفوع)
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* ─── المصروفات (Debit) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المبالغ المطلوبة من المستثمر
              </td>
            </tr>
            {debitRows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`debit-${i}`} className={`border-b border-gray-100 hover:bg-red-50/30 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                  <td className="sticky right-0 z-10 bg-inherit px-3 py-2 text-gray-800 font-semibold border-l border-gray-100 w-[220px] min-w-[220px]">
                    {item.label}
                  </td>
                  {values.map((v, j) => (
                    <td key={j} className={`px-1.5 py-2 text-center tabular-nums ${v > 0 ? "text-red-600 font-medium" : "text-gray-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Debit */}
            <tr className="bg-red-100/50 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-3 py-2 text-red-800 border-l border-red-200 w-[220px] min-w-[220px]">
                إجمالي المصروفات
              </td>
              {debitTotals.map((v, i) => (
                <td key={i} className="px-1.5 py-2 text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Credit) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                المبالغ المستلمة للمستثمر
              </td>
            </tr>
            {creditRows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`credit-${i}`} className={`border-b border-gray-100 hover:bg-green-50/30 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                  <td className="sticky right-0 z-10 bg-inherit px-3 py-2 text-gray-800 font-semibold border-l border-gray-100 w-[220px] min-w-[220px]">
                    {item.label}
                  </td>
                  {values.map((v, j) => (
                    <td key={j} className={`px-1.5 py-2 text-center tabular-nums ${v > 0 ? "text-green-600 font-medium" : "text-gray-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Credit */}
            <tr className="bg-green-100/50 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-3 py-2 text-green-800 border-l border-green-200 w-[220px] min-w-[220px]">
                إجمالي الإيرادات
              </td>
              {creditTotals.map((v, i) => (
                <td key={i} className="px-1.5 py-2 text-center tabular-nums text-green-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-200">
              <td className="sticky right-0 z-10 bg-blue-50 px-3 py-2 text-blue-800 border-l border-blue-200 w-[220px] min-w-[220px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-1.5 py-2 text-center tabular-nums font-semibold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التراكمي ─── */}
            <tr className="bg-blue-100/50 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-3 py-2 text-blue-900 border-l border-blue-200 w-[220px] min-w-[220px]">
                التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-1.5 py-2 text-center tabular-nums font-bold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
