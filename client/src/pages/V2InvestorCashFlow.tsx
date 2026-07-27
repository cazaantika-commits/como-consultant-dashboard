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
  if (Math.abs(n) < 1) return "–";
  return Math.round(n).toLocaleString("en-US");
}

function fmtM(n: number): string {
  if (Math.abs(n) < 1000) return fmt(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return (n / 1e3).toFixed(0) + "K";
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
  const profitPct = totalDebit > 0 ? (profit / totalDebit * 100) : 0;

  // ─── Month headers with phase info ─────────────────────────────────────
  const months: { label: string; date: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[i] || "", phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + i] || "", phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + constructionDuration + i] || "", phase: "post" });

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
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="mr-2 text-slate-500 text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" dir="rtl">
      {/* ═══ SUMMARY CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-slate-500 mb-1">المشروع</div>
          <div className="text-xs font-bold text-slate-800 truncate">{projectName}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-red-500 mb-1">إجمالي المصروفات</div>
          <div className="text-xs font-bold text-red-600">{fmtM(totalDebit)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-emerald-500 mb-1">إجمالي الإيرادات</div>
          <div className="text-xs font-bold text-emerald-600">{fmtM(totalCredit)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-blue-500 mb-1">صافي الأرباح</div>
          <div className="text-xs font-bold text-blue-600">{fmtM(profit)}</div>
          <div className="text-[9px] text-slate-400">{profitPct.toFixed(0)}% من التكلفة</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-slate-500 mb-1">المدة الإجمالية</div>
          <div className="text-xs font-bold text-slate-800">{totalMonths} شهر</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-amber-500 mb-1">ذروة رأس المال</div>
          <div className="text-xs font-bold text-amber-600">{fmtM(Math.abs(Math.min(...cumulative)))}</div>
        </div>
      </div>

      {/* ═══ PHASE LEGEND ═══ */}
      <div className="flex items-center gap-4 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span> تصميم ({designDuration} أشهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span> إنشاء ({constructionDuration} شهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span> ما بعد الإنجاز ({postDuration} شهر)</span>
      </div>

      {/* ═══ MAIN TABLE ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">التدفقات النقدية للمستثمر</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">جدول شهري تفصيلي للمصروفات والإيرادات</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[10px] transition">
            <Download className="w-3 h-3" /> تصدير
          </button>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              {/* Date row */}
              <tr>
                <th className="sticky right-0 bg-slate-50 z-20 text-right py-2 px-3 border-b border-slate-200 text-slate-400 font-normal min-w-[160px] text-[8px]">
                  التاريخ
                </th>
                {months.map((m, i) => (
                  <th key={i} className="px-1 py-1 text-center border-b border-slate-100 text-[8px] text-slate-400 font-normal whitespace-nowrap min-w-[65px]">
                    {m.date ? formatDate(m.date) : ""}
                  </th>
                ))}
                <th className="text-center py-2 px-2 border-b border-slate-200 text-slate-600 font-bold min-w-[75px] bg-slate-100 text-[9px]">الإجمالي</th>
              </tr>
              {/* Phase band */}
              <tr>
                <th className="sticky right-0 bg-slate-50 z-20 text-right py-2 px-3 border-b border-slate-200 text-slate-600 font-semibold min-w-[160px]">
                  البند
                </th>
                {months.map((m, i) => {
                  const phaseColors = {
                    design: "bg-blue-50 text-blue-700 border-b border-blue-200",
                    construction: "bg-amber-50 text-amber-700 border-b border-amber-200",
                    post: "bg-emerald-50 text-emerald-700 border-b border-emerald-200",
                  };
                  return (
                    <th key={i} className={`px-1 py-1.5 text-center font-semibold min-w-[65px] ${phaseColors[m.phase]}`}>
                      {m.label}
                    </th>
                  );
                })}
                <th className="text-center py-2 px-2 border-b border-slate-200 text-slate-800 font-bold min-w-[75px] bg-slate-100"></th>
              </tr>
            </thead>
            <tbody>
              {/* ─── مدفوع سابقاً ─── */}
              {paidRows.length > 0 && (
                <>
                  <tr className="bg-slate-50">
                    <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-slate-600 text-[9px] border-b border-slate-200">
                      مدفوع سابقاً (لا يؤثر على التدفقات)
                    </td>
                  </tr>
                  {paidRows.map((item, i) => (
                    <tr key={`paid-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-700 font-medium border-l border-slate-100 min-w-[160px]">
                        {item.label}
                      </td>
                      <td className="py-2 px-1 text-center text-slate-500 font-medium" colSpan={totalMonths}>
                        {fmt(item.paid)} (مدفوع)
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600 font-medium bg-slate-50/50">{fmt(item.paid)}</td>
                    </tr>
                  ))}
                </>
              )}

              {/* ─── المصروفات (Debit) ─── */}
              <tr className="bg-red-50/50">
                <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-red-700 text-[9px] border-b border-red-100">
                  المصروفات
                </td>
              </tr>
              {sections.map((section, si) => (
                <React.Fragment key={`section-${si}`}>
                  <tr className="bg-slate-50/60">
                    <td colSpan={totalMonths + 2} className="px-4 py-1.5 text-[9px] font-bold text-slate-500 border-b border-slate-100">
                      {section.name}
                    </td>
                  </tr>
                  {section.items.map((item, ii) => {
                    const values = getRowValues(item);
                    const rowTotal = values.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={`debit-${si}-${ii}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-800 font-medium border-l border-slate-100 min-w-[160px]">
                          {item.label}
                        </td>
                        {values.map((v, j) => (
                          <td key={j} className={`px-1 py-2 text-center tabular-nums ${v > 0 ? "text-red-600" : "text-slate-300"}`}>
                            {v > 0 ? fmt(v) : "–"}
                          </td>
                        ))}
                        <td className="py-2 px-2 text-center tabular-nums text-red-600 font-medium bg-red-50/30">
                          {rowTotal > 0 ? fmt(rowTotal) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {/* Total Debit */}
              <tr className="bg-red-50 font-bold border-t border-red-200">
                <td className="sticky right-0 z-10 bg-red-50 py-2.5 px-3 text-red-800 border-l border-red-200 min-w-[160px]">
                  إجمالي المصروفات
                </td>
                {debitTotals.map((v, i) => (
                  <td key={i} className="px-1 py-2.5 text-center tabular-nums text-red-700">
                    {v > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className="py-2.5 px-2 text-center tabular-nums text-red-800 font-bold bg-red-100/50">
                  {fmt(totalDebit)}
                </td>
              </tr>

              {/* ─── الإيرادات (Credit) ─── */}
              <tr className="bg-emerald-50/50">
                <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-emerald-700 text-[9px] border-b border-emerald-100">
                  الإيرادات
                </td>
              </tr>
              {creditRows.map((item, i) => {
                const values = getRowValues(item);
                const rowTotal = values.reduce((s, v) => s + v, 0);
                return (
                  <tr key={`credit-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-800 font-medium border-l border-slate-100 min-w-[160px]">
                      {item.label}
                    </td>
                    {values.map((v, j) => (
                      <td key={j} className={`px-1 py-2 text-center tabular-nums ${v > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                        {v > 0 ? fmt(v) : "–"}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center tabular-nums text-emerald-600 font-medium bg-emerald-50/30">
                      {rowTotal > 0 ? fmt(rowTotal) : "–"}
                    </td>
                  </tr>
                );
              })}
              {/* Total Credit */}
              <tr className="bg-emerald-50 font-bold border-t border-emerald-200">
                <td className="sticky right-0 z-10 bg-emerald-50 py-2.5 px-3 text-emerald-800 border-l border-emerald-200 min-w-[160px]">
                  إجمالي الإيرادات
                </td>
                {creditTotals.map((v, i) => (
                  <td key={i} className="px-1 py-2.5 text-center tabular-nums text-emerald-700">
                    {v > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className="py-2.5 px-2 text-center tabular-nums text-emerald-800 font-bold bg-emerald-100/50">
                  {fmt(totalCredit)}
                </td>
              </tr>

              {/* ─── صافي الشهر ─── */}
              <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-200">
                <td className="sticky right-0 z-10 bg-blue-50 py-2.5 px-3 text-blue-800 border-l border-blue-200 min-w-[160px]">
                  صافي الشهر
                </td>
                {netFlow.map((v, i) => (
                  <td key={i} className={`px-1 py-2.5 text-center tabular-nums font-medium ${v >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {Math.abs(v) > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className={`py-2.5 px-2 text-center tabular-nums font-bold bg-blue-50/50 ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(profit)}
                </td>
              </tr>

              {/* ─── التراكمي ─── */}
              <tr className="bg-slate-100 font-bold">
                <td className="sticky right-0 z-10 bg-slate-100 py-2.5 px-3 text-slate-900 border-l border-slate-200 min-w-[160px]">
                  التراكمي
                </td>
                {cumulative.map((v, i) => (
                  <td key={i} className={`px-1 py-2.5 text-center tabular-nums font-bold ${v >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className="py-2.5 px-2 text-center tabular-nums font-bold bg-slate-100 text-slate-800">
                  {fmt(cumulative[cumulative.length - 1] || 0)}
                </td>
              </tr>
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-800 text-white z-10">
              <tr>
                <td className="sticky right-0 bg-slate-800 py-3 px-3 font-bold min-w-[160px]">الإجمالي</td>
                {debitTotals.map((_, i) => (
                  <td key={i} className="py-3 px-1 text-center font-bold text-[9px]">
                    {Math.abs(netFlow[i]) > 0 ? fmtM(netFlow[i]) : "–"}
                  </td>
                ))}
                <td className={`py-3 px-2 text-center font-bold ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {fmtM(profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
