import { useState, useMemo } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ProjectSelector } from "@/components/ProjectSelector";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
  type CashFlowResult,
} from "@/lib/investorCashFlowEngine";

// ═══════════════════════════════════════════
// SCENARIO LABELS
// ═══════════════════════════════════════════
const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان + إسكرو",
  offplan_construction: "أوف بلان + إنجاز 20%",
  no_offplan: "بدون بيع على الخارطة",
  rental: "تطوير للتأجير",
};

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "-";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return Math.round(n).toLocaleString();
}

function fmtFull(n: number): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("en-US");
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2InvestorCashFlow() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");

  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });

  // Compute cash flow from engine
  const data: CashFlowResult | null = useMemo(() => {
    if (!projectQuery.data) return null;
    return computeInvestorCashFlow(projectQuery.data, scenario);
  }, [projectQuery.data, scenario]);

  // If no data yet, show loading/empty state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500" dir="rtl">
        يرجى تسجيل الدخول
      </div>
    );
  }

  if (!selectedProjectId) {
    return (
      <div className="p-6" dir="rtl">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h2 className="text-lg font-bold text-gray-800">التدفقات النقدية للمستثمر</h2>
          <p className="text-sm text-gray-500">اختر مشروعاً لعرض التدفقات النقدية</p>
          <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
        </div>
      </div>
    );
  }

  if (projectQuery.isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500" dir="rtl">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2"></div>
        جاري تحميل البيانات...
      </div>
    );
  }

  // ─── Prepare table data ───
  const { rows, designDuration, constructionDuration, postDuration } = data;
  const totalMonths = designDuration + constructionDuration + postDuration;

  // Build month labels
  const months: { label: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `ت${i + 1}`, phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `ن${i + 1}`, phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `ب${i + 1}`, phase: "post" });

  // Separate expense rows and revenue rows
  const expenseRows = rows.filter(r => !r.isRevenue);
  const revenueRows = rows.filter(r => r.isRevenue);

  // Group expense rows by section
  const sectionGroups: { name: string; items: CostRow[] }[] = [];
  let currentSection = "";
  for (const row of expenseRows) {
    if (row.section !== currentSection) {
      currentSection = row.section;
      sectionGroups.push({ name: currentSection, items: [] });
    }
    sectionGroups[sectionGroups.length - 1].items.push(row);
  }

  // Get monthly value for a row at a given absolute month index
  const getMonthValue = (row: CostRow, monthIdx: number): number => {
    if (monthIdx < designDuration) {
      return row.designMonths[monthIdx] || 0;
    } else if (monthIdx < designDuration + constructionDuration) {
      return row.constructionMonths[monthIdx - designDuration] || 0;
    } else {
      return row.postConstructionMonths[monthIdx - designDuration - constructionDuration] || 0;
    }
  };

  // Monthly totals for expenses (investor only, skip escrow-funded)
  const expenseMonthlyTotals = Array.from({ length: totalMonths }, (_, i) =>
    expenseRows.filter(r => r.funder !== "escrow").reduce((s, row) => s + getMonthValue(row, i), 0)
  );

  // Monthly totals for revenue
  const revenueMonthlyTotals = Array.from({ length: totalMonths }, (_, i) =>
    revenueRows.reduce((s, row) => s + getMonthValue(row, i), 0)
  );

  // Net flow and cumulative
  const netFlow = expenseMonthlyTotals.map((d, i) => revenueMonthlyTotals[i] - d);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] || 0) + v);
    return acc;
  }, []);

  const totalExpenses = expenseMonthlyTotals.reduce((s, v) => s + v, 0);
  const totalRevenueCalc = revenueMonthlyTotals.reduce((s, v) => s + v, 0);
  const profit = totalRevenueCalc - totalExpenses;

  const phaseColors: Record<string, string> = {
    design: "bg-blue-50 text-blue-700",
    construction: "bg-amber-50 text-amber-700",
    post: "bg-emerald-50 text-emerald-700",
  };

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
              <h1 className="text-sm font-bold text-gray-900">التدفقات النقدية للمستثمر</h1>
              <p className="text-[10px] text-gray-500">{projectQuery.data?.name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Scenario selector */}
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              className="text-[10px] border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {Object.entries(SCENARIO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {/* Project selector */}
            <div className="w-40">
              <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} className="text-[10px]" />
            </div>
            {/* Summary KPIs */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalExpenses)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalRevenueCalc)}</span>
              <span className={`font-bold ${profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                {profit >= 0 ? "الأرباح" : "الخسارة"}: {fmt(Math.abs(profit))}
              </span>
            </div>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> تصميم ({designDuration} أشهر)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({constructionDuration} شهر)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({postDuration} شهر)
        </span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-max">
          <thead className="bg-white shadow-sm">
            {/* Phase band */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-1 text-right w-[180px] min-w-[180px]">البند</th>
              <th className="bg-gray-100 border-b border-gray-200 px-1 py-1 text-center w-[80px] min-w-[80px]">الإجمالي</th>
              {months.map((m, i) => (
                <th key={i} className={`px-1 py-0.5 text-center border-b border-gray-200 ${phaseColors[m.phase]} font-normal`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── المصروفات (Debit) — grouped by section ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المصروفات (من حساب المستثمر)
              </td>
            </tr>
            {sectionGroups.map((section) => (
              <SectionBlock
                key={section.name}
                section={section}
                totalMonths={totalMonths}
                getMonthValue={getMonthValue}
              />
            ))}

            {/* Total Expenses */}
            <tr className="bg-red-100/50 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-2 py-[3px] text-red-800 border-l border-red-200 w-[180px] min-w-[180px]">
                إجمالي المصروفات
              </td>
              <td className="bg-red-50 px-1 py-[3px] text-center tabular-nums text-red-800 font-bold border-l border-red-200">
                {fmtFull(totalExpenses)}
              </td>
              {expenseMonthlyTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Credit) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                الإيرادات
              </td>
            </tr>
            {revenueRows.map((row) => {
              const rowTotal = Array.from({ length: totalMonths }, (_, i) => getMonthValue(row, i)).reduce((s, v) => s + v, 0);
              return (
                <tr key={row.label} className="border-b border-gray-50 hover:bg-green-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[180px] min-w-[180px]">
                    {row.label}
                  </td>
                  <td className="bg-white px-1 py-[3px] text-center tabular-nums text-green-700 font-medium border-l border-gray-100">
                    {fmtFull(rowTotal)}
                  </td>
                  {Array.from({ length: totalMonths }, (_, i) => {
                    const v = getMonthValue(row, i);
                    return (
                      <td key={i} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                        {v > 0 ? fmt(v) : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Total Revenue */}
            <tr className="bg-green-100/50 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[3px] text-green-800 border-l border-green-200 w-[180px] min-w-[180px]">
                إجمالي الإيرادات
              </td>
              <td className="bg-green-50 px-1 py-[3px] text-center tabular-nums text-green-800 font-bold border-l border-green-200">
                {fmtFull(totalRevenueCalc)}
              </td>
              {revenueMonthlyTotals.map((v, i) => (
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
              <td className="bg-blue-50 px-1 py-[3px] text-center tabular-nums text-blue-800 font-bold border-l border-blue-200">
                {fmtFull(profit)}
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
              <td className="bg-blue-100 px-1 py-[3px] text-center tabular-nums text-blue-900 font-bold border-l border-blue-200">
                —
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

// ═══════════════════════════════════════════
// SECTION BLOCK COMPONENT
// ═══════════════════════════════════════════
function SectionBlock({
  section,
  totalMonths,
  getMonthValue,
}: {
  section: { name: string; items: CostRow[] };
  totalMonths: number;
  getMonthValue: (row: CostRow, monthIdx: number) => number;
}) {
  return (
    <>
      <tr className="bg-gray-50/80">
        <td colSpan={totalMonths + 2} className="px-2 py-[2px] text-[9px] font-bold text-gray-500 border-b border-gray-100 pr-4">
          {section.name}
        </td>
      </tr>
      {section.items.map((row) => {
        const isPaid = row.paid > 0 && row.unpaid === 0;
        const isEscrow = row.funder === "escrow";
        const rowTotal = isEscrow ? 0 : row.investorAmount;
        return (
          <tr key={row.label} className={`border-b border-gray-50 ${isEscrow ? "opacity-40" : "hover:bg-red-50/30"}`}>
            <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[180px] min-w-[180px]">
              {row.label}
              {isEscrow && <span className="text-[8px] text-gray-400 mr-1">(إسكرو)</span>}
              {isPaid && <span className="text-[8px] text-green-500 mr-1">(مدفوع)</span>}
            </td>
            <td className="bg-white px-1 py-[3px] text-center tabular-nums text-gray-700 font-medium border-l border-gray-100">
              {rowTotal > 0 ? fmtFull(rowTotal) : "-"}
            </td>
            {isPaid ? (
              <td className="px-1 py-[3px] text-center text-gray-400 font-medium" colSpan={totalMonths}>
                مدفوع سابقاً
              </td>
            ) : isEscrow ? (
              <td className="px-1 py-[3px] text-center text-gray-400 font-medium" colSpan={totalMonths}>
                يُدفع من حساب الضمان
              </td>
            ) : (
              Array.from({ length: totalMonths }, (_, i) => {
                const v = getMonthValue(row, i);
                return (
                  <td key={i} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                );
              })
            )}
          </tr>
        );
      })}
    </>
  );
}
