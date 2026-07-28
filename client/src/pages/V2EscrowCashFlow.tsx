import { useMemo } from "react";
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

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2EscrowCashFlow() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const scenario: Scenario = "offplan_escrow";

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

    // Parse marketing monthly amounts from salesAbsorptionJson (saved from MarketingPage)
    // marketingDistribution arrays are indexed from 0 = marketingActualStart month
    // Engine expects marketingMonthlyAmounts indexed from 0 = project month 1
    // So we offset by (marketingActualStart - 1)
    let marketingMonthlyAmounts: number[] | undefined;
    let ppDownPct: number | undefined;
    if (plan.salesAbsorptionJson) {
      try {
        const absorption = JSON.parse(plan.salesAbsorptionJson);
        ppDownPct = absorption.ppDownPct;
        if (absorption.marketingDistribution) {
          const channels = Object.values(absorption.marketingDistribution) as number[][];
          const startOffset = (absorption.marketingActualStart || 1) - 1; // convert 1-indexed to 0-indexed
          if (channels.length > 0) {
            const maxLen = Math.max(...channels.map((c: number[]) => c.length));
            // Total array length = offset + channel length
            marketingMonthlyAmounts = new Array(startOffset + maxLen).fill(0);
            for (const ch of channels) {
              for (let m = 0; m < ch.length; m++) {
                marketingMonthlyAmounts[startOffset + m] += (ch[m] || 0);
              }
            }
          }
        }
      } catch {}
    }

    // If resultsJson exists, use escrowData and salesDistribution from it
    if (plan.resultsJson) {
      try {
        const parsed = JSON.parse(plan.resultsJson);
        if (parsed.escrowData && parsed.salesDistribution) {
          return {
            escrowData: parsed.escrowData,
            salesDistribution: parsed.salesDistribution,
            marketingMonthlyAmounts,
            ppDownPct,
          };
        }
      } catch {}
    }

    // Even without resultsJson, return marketing data so engine can use it
    if (marketingMonthlyAmounts && marketingMonthlyAmounts.length > 0) {
      return {
        escrowData: [],
        salesDistribution: [],
        marketingMonthlyAmounts,
        ppDownPct,
      };
    }

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
  // Escrow outflows = items paid FROM escrow (funder=escrow, not revenue)
  const escrowOutflows = rows.filter((r) => r.funder === "escrow" && !r.isRevenue);
  // Escrow inflows = investor deposit (20% construction) + buyer payments from sales
  // The engine doesn't have a separate "escrow inflow" row, so we compute it:
  // - Opening deposit: 20% of construction cost at start of construction
  // - Sales income: from salesResult escrowData (monthly income during sales)

  // Build flat monthly arrays for each row
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
  // Use the engine's isTransfer row for deposit timing (consistent with investor cash flow)
  const depositRow = useMemo(() => {
    const transferRow = rows.find((r) => r.isTransfer);
    const values = new Array(totalMonths).fill(0);
    if (transferRow) {
      const rowValues = [...transferRow.designMonths, ...transferRow.constructionMonths, ...transferRow.postConstructionMonths];
      for (let i = 0; i < totalMonths && i < rowValues.length; i++) {
        values[i] = rowValues[i];
      }
    }
    return { label: "إيداع المستثمر (20%)", values };
  }, [rows, totalMonths]);

  // Sales income from escrowData (monthly buyer payments flowing into escrow)
  // Use the engine's usedSalesResult which includes the default generated data when no saved plan exists
  const effectiveSalesResult = data.usedSalesResult || salesResult;
  const salesIncomeRow = useMemo(() => {
    const values = new Array(totalMonths).fill(0);
    if (effectiveSalesResult && effectiveSalesResult.escrowData.length > 0) {
      for (const entry of effectiveSalesResult.escrowData) {
        // entry.month is 1-indexed absolute month from project start (from V2WaelSales: i + timeline.salesStart)
        // Flat array is 0-indexed, so subtract 1
        const idx = entry.month - 1;
        if (idx >= 0 && idx < totalMonths) {
          values[idx] += entry.income;
        }
      }
    }
    return { label: "مبيعات أوف بلان (أقساط المشترين)", values };
  }, [totalMonths, effectiveSalesResult]);

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

  // ─── Liquidation rows (escrow liquidation items transferred to investor post-construction) ───
  // Exclude "إيرادات مباشرة (20%)" - that goes directly to investor, not through escrow
  const liquidationRows = rows.filter((r) => r.isRevenue && !r.label.includes("إيرادات مباشرة"));

  // ─── Month headers ─────────────────────────────────────────────────────
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
        <div className="max-w-full mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-[10px] font-bold text-gray-900">التدفقات النقدية — حساب الضمان (Escrow)</h1>
              <p className="text-[10px] text-gray-500">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalOutflow)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalInflow)}</span>
              <span className={`font-bold ${finalBalance >= 0 ? "text-green-700" : "text-red-600"}`}>الرصيد: {fmt(finalBalance)}</span>
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
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-0.5 text-right w-[200px] min-w-[200px] text-[8px] text-gray-400">التاريخ</th>
              {months.map((m, i) => (
                <th key={i} className="px-0.5 py-0 text-center border-b border-gray-100 text-[7px] text-gray-400 font-normal whitespace-nowrap">
                  {m.date ? m.date.split("-")[1] + "/" + m.date.split("-")[0].slice(2) : ""}
                </th>
              ))}
            </tr>
            {/* Phase band */}
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
                المصروفات من حساب الضمان (Outflows)
              </td>
            </tr>
            {escrowOutflows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`out-${i}`} className="border-b border-gray-50 hover:bg-red-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
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
                الإيرادات إلى حساب الضمان (Inflows)
              </td>
            </tr>
            {inflowRows.map((item, i) => (
              <tr key={`in-${i}`} className="border-b border-gray-50 hover:bg-green-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                  {item.label}
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

            {/* ─── التصفية (بعد الإنجاز) ─── */}
            {liquidationRows.length > 0 && (
              <>
                <tr className="bg-purple-50">
                  <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-purple-700 text-[9px] border-b border-purple-100 border-t-2 border-t-purple-200">
                    التصفية (تحويل للمالك بعد الإنجاز)
                  </td>
                </tr>
                {liquidationRows.map((item, i) => {
                  const values = getRowValues(item);
                  return (
                    <tr key={`liq-${i}`} className="border-b border-gray-50 hover:bg-purple-50/30">
                      <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                        {item.label}
                      </td>
                      {values.map((v, j) => (
                        <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-purple-600" : "text-gray-300"}`}>
                          {v > 0 ? fmt(v) : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
