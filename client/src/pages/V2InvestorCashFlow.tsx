import React, { useState, useMemo } from "react";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
  type SalesResult,
} from "@/lib/investorCashFlowEngine";

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
  const [scenario] = useState<Scenario>("offplan_escrow");

  // ─── DB Queries ─────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );

  // ─── Parse salesResult from saved plan ─────────────────────────────────
  const salesResult: SalesResult | undefined = useMemo(() => {
    if (!plansQuery.data || plansQuery.data.length === 0) return undefined;
    const plan = plansQuery.data[0] as any;
    if (!plan.resultsJson) return undefined;
    try {
      const parsed = JSON.parse(plan.resultsJson);
      if (parsed.escrowData && parsed.salesDistribution) {
        return {
          escrowData: parsed.escrowData,
          salesDistribution: parsed.salesDistribution,
        };
      }
    } catch {}
    return undefined;
  }, [plansQuery.data]);

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

  // ─── Separate rows into debit (investor costs) and credit (revenue) ────
  const debitRows = rows.filter((r) => !r.isRevenue && r.funder === "investor");
  const creditRows = rows.filter((r) => r.isRevenue);
  const paidRows = rows.filter((r) => r.paid > 0 && !r.isRevenue);

  // ─── Build flat monthly arrays for each row ────────────────────────────
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  // ─── Debit totals per month ────────────────────────────────────────────
  const debitTotals = Array.from({ length: totalMonths }, (_, i) =>
    debitRows.reduce((s, r) => s + getRowValues(r)[i], 0)
  );
  // ─── Credit totals per month ───────────────────────────────────────────
  const creditTotals = Array.from({ length: totalMonths }, (_, i) =>
    creditRows.reduce((s, r) => s + getRowValues(r)[i], 0)
  );
  // ─── Net flow and cumulative ───────────────────────────────────────────
  const netFlow = debitTotals.map((d, i) => creditTotals[i] - d);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] || 0) + v);
    return acc;
  }, []);

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

  // ─── Group debit items by section ──────────────────────────────────────
  const sections: { name: string; items: CostRow[] }[] = [];
  let currentSection = "";
  for (const item of debitRows) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ name: currentSection, items: [] });
    }
    sections[sections.length - 1].items.push(item);
  }

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
        <div className="max-w-full mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-[10px] font-bold text-gray-900">التدفقات النقدية للمستثمر</h1>
              <p className="text-[10px] text-gray-500">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalDebit)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalCredit)}</span>
              <span className="text-blue-700 font-bold">الأرباح: {fmt(profit)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-1 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> تصميم ({designDuration} أشهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({constructionDuration} شهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({postDuration} شهر)</span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-max">
          <thead className="bg-white shadow-sm">
            {/* Date row */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-0.5 text-right w-[180px] min-w-[180px] text-[8px] text-gray-400">التاريخ</th>
              {months.map((m, i) => (
                <th key={i} className="px-0.5 py-0 text-center border-b border-gray-100 text-[7px] text-gray-400 font-normal whitespace-nowrap">
                  {m.date ? m.date.split("-")[1] + "/" + m.date.split("-")[0].slice(2) : ""}
                </th>
              ))}
            </tr>
            {/* Phase band */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-1 text-right w-[180px] min-w-[180px]"></th>
              {months.map((m, i) => (
                <th key={i} className={`px-1 py-0.5 text-center border-b border-gray-200 ${phaseColors[m.phase]} font-normal`}>
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
                  <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-gray-600 text-[9px] border-b border-gray-200">
                    مدفوع سابقاً (لا يؤثر على التدفقات)
                  </td>
                </tr>
                {paidRows.map((item, i) => (
                  <tr key={`paid-${i}`} className="border-b border-gray-100 bg-gray-50">
                    <td className="sticky right-0 z-10 bg-gray-50 px-2 py-[3px] text-gray-700 font-medium border-l border-gray-200 w-[180px] min-w-[180px]">
                      {item.label}
                    </td>
                    <td className="px-1 py-[3px] text-center text-gray-500 font-medium" colSpan={totalMonths}>
                      {fmt(item.paid)} (مدفوع)
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* ─── المصروفات (Debit) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المصروفات (Debit)
              </td>
            </tr>
            {sections.map((section, si) => (
              <React.Fragment key={`section-${si}`}>
                <tr className="bg-gray-50/80">
                  <td colSpan={totalMonths + 1} className="px-2 py-[2px] text-[9px] font-bold text-gray-500 border-b border-gray-100 pr-4">
                    {section.name}
                  </td>
                </tr>
                {section.items.map((item, ii) => {
                  const values = getRowValues(item);
                  return (
                    <tr key={`debit-${si}-${ii}`} className="border-b border-gray-50 hover:bg-red-50/30">
                      <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[180px] min-w-[180px]">
                        {item.label}
                      </td>
                      {values.map((v, j) => (
                        <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                          {v > 0 ? fmt(v) : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {/* Total Debit */}
            <tr className="bg-red-100/50 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-2 py-[3px] text-red-800 border-l border-red-200 w-[180px] min-w-[180px]">
                إجمالي المصروفات
              </td>
              {debitTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Credit) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                الإيرادات (Credit)
              </td>
            </tr>
            {creditRows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`credit-${i}`} className="border-b border-gray-50 hover:bg-green-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[180px] min-w-[180px]">
                    {item.label}
                  </td>
                  {values.map((v, j) => (
                    <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Credit */}
            <tr className="bg-green-100/50 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[3px] text-green-800 border-l border-green-200 w-[180px] min-w-[180px]">
                إجمالي الإيرادات
              </td>
              {creditTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-green-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-200">
              <td className="sticky right-0 z-10 bg-blue-50 px-2 py-[3px] text-blue-800 border-l border-blue-200 w-[180px] min-w-[180px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-medium ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التراكمي ─── */}
            <tr className="bg-blue-100/50 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-2 py-[3px] text-blue-900 border-l border-blue-200 w-[180px] min-w-[180px]">
                التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-bold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
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
