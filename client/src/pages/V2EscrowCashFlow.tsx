import { useState, useMemo } from "react";
import { Download, Loader2 } from "lucide-react";
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
export default function V2EscrowCashFlow() {
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

  // ─── Separate escrow rows: outflows (funder=escrow) and inflows ────────
  const escrowOutflows = rows.filter((r) => r.funder === "escrow" && !r.isRevenue);

  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  // ─── Escrow outflow totals per month ───────────────────────────────────
  const outflowTotals = Array.from({ length: totalMonths }, (_, i) =>
    escrowOutflows.reduce((s, r) => s + getRowValues(r)[i], 0)
  );

  // ─── Escrow inflows: deposit + sales income ────────────────────────────
  const constructionCostFromProject = useMemo(() => {
    if (!projectQuery.data) return 0;
    const p = projectQuery.data as any;
    const gfa = parseFloat(p.gfaSqft || p.manualBuaSqft || "0") || 0;
    const pricePerSqft = parseFloat(p.estimatedConstructionPricePerSqft || "0") || 350;
    return gfa * pricePerSqft;
  }, [projectQuery.data]);

  const escrowDeposit = constructionCostFromProject * 0.20;

  const depositRow = useMemo(() => {
    const values = new Array(totalMonths).fill(0);
    if (designDuration < totalMonths) {
      values[designDuration] = escrowDeposit;
    }
    return { label: "إيداع المستثمر (20%)", values };
  }, [totalMonths, designDuration, escrowDeposit]);

  const salesIncomeRow = useMemo(() => {
    const values = new Array(totalMonths).fill(0);
    if (salesResult && salesResult.escrowData.length > 0) {
      for (const entry of salesResult.escrowData) {
        const idx = entry.month - 1;
        if (idx >= 0 && idx < totalMonths) {
          values[idx] = entry.income;
        }
      }
    }
    return { label: "مبيعات أوف بلان (أقساط المشترين)", values };
  }, [totalMonths, salesResult]);

  const inflowRows = [depositRow, salesIncomeRow];
  const inflowTotals = Array.from({ length: totalMonths }, (_, i) =>
    inflowRows.reduce((s, r) => s + r.values[i], 0)
  );

  // ─── Net flow and cumulative balance ───────────────────────────────────
  const netFlow = outflowTotals.map((d, i) => inflowTotals[i] - d);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] || 0) + v);
    return acc;
  }, []);

  const totalOutflow = outflowTotals.reduce((s, v) => s + v, 0);
  const totalInflow = inflowTotals.reduce((s, v) => s + v, 0);
  const finalBalance = cumulative[cumulative.length - 1] || 0;

  // ─── Liquidation rows ──────────────────────────────────────────────────
  const liquidationRows = rows.filter((r) => r.isRevenue);

  // ─── Month headers ─────────────────────────────────────────────────────
  const months: { label: string; date: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[i] || "", phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + i] || "", phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + constructionDuration + i] || "", phase: "post" });

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-slate-500 mb-1">المشروع</div>
          <div className="text-xs font-bold text-slate-800 truncate">{projectName}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-red-500 mb-1">إجمالي المصروفات</div>
          <div className="text-xs font-bold text-red-600">{fmtM(totalOutflow)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-emerald-500 mb-1">إجمالي الإيرادات</div>
          <div className="text-xs font-bold text-emerald-600">{fmtM(totalInflow)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-blue-500 mb-1">الرصيد النهائي</div>
          <div className={`text-xs font-bold ${finalBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtM(finalBalance)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] text-amber-500 mb-1">إيداع الضمان (20%)</div>
          <div className="text-xs font-bold text-amber-600">{fmtM(escrowDeposit)}</div>
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
            <h2 className="text-sm font-bold text-slate-800">التدفقات النقدية — حساب الضمان (Escrow)</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">حركة الأموال داخل حساب الضمان شهرياً</p>
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
                <th className="sticky right-0 bg-slate-50 z-20 text-right py-2 px-3 border-b border-slate-200 text-slate-400 font-normal min-w-[180px] text-[8px]">
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
                <th className="sticky right-0 bg-slate-50 z-20 text-right py-2 px-3 border-b border-slate-200 text-slate-600 font-semibold min-w-[180px]">
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
              {/* ─── المصروفات (Outflows) ─── */}
              <tr className="bg-red-50/50">
                <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-red-700 text-[9px] border-b border-red-100">
                  المصروفات من حساب الضمان
                </td>
              </tr>
              {escrowOutflows.map((item, i) => {
                const values = getRowValues(item);
                const rowTotal = values.reduce((s, v) => s + v, 0);
                return (
                  <tr key={`out-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-800 font-medium border-l border-slate-100 min-w-[180px]">
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
              {/* Total Outflows */}
              <tr className="bg-red-50 font-bold border-t border-red-200">
                <td className="sticky right-0 z-10 bg-red-50 py-2.5 px-3 text-red-800 border-l border-red-200 min-w-[180px]">
                  إجمالي المصروفات
                </td>
                {outflowTotals.map((v, i) => (
                  <td key={i} className="px-1 py-2.5 text-center tabular-nums text-red-700">
                    {v > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className="py-2.5 px-2 text-center tabular-nums text-red-800 font-bold bg-red-100/50">
                  {fmt(totalOutflow)}
                </td>
              </tr>

              {/* ─── الإيرادات (Inflows) ─── */}
              <tr className="bg-emerald-50/50">
                <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-emerald-700 text-[9px] border-b border-emerald-100">
                  الإيرادات إلى حساب الضمان
                </td>
              </tr>
              {inflowRows.map((item, i) => {
                const rowTotal = item.values.reduce((s, v) => s + v, 0);
                return (
                  <tr key={`in-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-800 font-medium border-l border-slate-100 min-w-[180px]">
                      {item.label}
                    </td>
                    {item.values.map((v, j) => (
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
              {/* Total Inflows */}
              <tr className="bg-emerald-50 font-bold border-t border-emerald-200">
                <td className="sticky right-0 z-10 bg-emerald-50 py-2.5 px-3 text-emerald-800 border-l border-emerald-200 min-w-[180px]">
                  إجمالي الإيرادات
                </td>
                {inflowTotals.map((v, i) => (
                  <td key={i} className="px-1 py-2.5 text-center tabular-nums text-emerald-700">
                    {v > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className="py-2.5 px-2 text-center tabular-nums text-emerald-800 font-bold bg-emerald-100/50">
                  {fmt(totalInflow)}
                </td>
              </tr>

              {/* ─── صافي الشهر ─── */}
              <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-200">
                <td className="sticky right-0 z-10 bg-blue-50 py-2.5 px-3 text-blue-800 border-l border-blue-200 min-w-[180px]">
                  صافي الشهر
                </td>
                {netFlow.map((v, i) => (
                  <td key={i} className={`px-1 py-2.5 text-center tabular-nums font-medium ${v >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {Math.abs(v) > 0 ? fmt(v) : "–"}
                  </td>
                ))}
                <td className={`py-2.5 px-2 text-center tabular-nums font-bold bg-blue-50/50 ${finalBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(finalBalance)}
                </td>
              </tr>

              {/* ─── الرصيد التراكمي ─── */}
              <tr className="bg-slate-100 font-bold">
                <td className="sticky right-0 z-10 bg-slate-100 py-2.5 px-3 text-slate-900 border-l border-slate-200 min-w-[180px]">
                  الرصيد التراكمي
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

              {/* ─── التصفية (بعد الإنجاز) ─── */}
              {liquidationRows.length > 0 && (
                <>
                  <tr className="bg-purple-50/50">
                    <td colSpan={totalMonths + 2} className="px-3 py-2 font-bold text-purple-700 text-[9px] border-b border-purple-100 border-t-2 border-t-purple-200">
                      التصفية (تحويل للمالك بعد الإنجاز)
                    </td>
                  </tr>
                  {liquidationRows.map((item, i) => {
                    const values = getRowValues(item);
                    const rowTotal = values.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={`liq-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="sticky right-0 z-10 bg-white py-2 px-3 text-slate-800 font-medium border-l border-slate-100 min-w-[180px]">
                          {item.label}
                        </td>
                        {values.map((v, j) => (
                          <td key={j} className={`px-1 py-2 text-center tabular-nums ${v > 0 ? "text-purple-600" : "text-slate-300"}`}>
                            {v > 0 ? fmt(v) : "–"}
                          </td>
                        ))}
                        <td className="py-2 px-2 text-center tabular-nums text-purple-600 font-medium bg-purple-50/30">
                          {rowTotal > 0 ? fmt(rowTotal) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-800 text-white z-10">
              <tr>
                <td className="sticky right-0 bg-slate-800 py-3 px-3 font-bold min-w-[180px]">الإجمالي</td>
                {outflowTotals.map((_, i) => (
                  <td key={i} className="py-3 px-1 text-center font-bold text-[9px]">
                    {Math.abs(netFlow[i]) > 0 ? fmtM(netFlow[i]) : "–"}
                  </td>
                ))}
                <td className={`py-3 px-2 text-center font-bold ${finalBalance >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {fmtM(finalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
