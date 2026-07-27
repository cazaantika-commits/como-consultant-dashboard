import { useMemo, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useProjectContext } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  computeInvestorCashFlow,
  type CashFlowResult,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import { ProjectSelector } from "@/components/ProjectSelector";

// ═══════════════════════════════════════════
// SCENARIO TYPES
// ═══════════════════════════════════════════
type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan" | "rental";

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان + إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20%",
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

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2EscrowCashFlow({ embedded }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");

  const result: CashFlowResult | null = useMemo(() => {
    if (!projectQuery.data) return null;
    return computeInvestorCashFlow(projectQuery.data, scenario);
  }, [projectQuery.data, scenario]);

  if (!user) {
    return <div className="p-8 text-center text-gray-500">يرجى تسجيل الدخول</div>;
  }

  if (!result) {
    return (
      <div className="p-6 space-y-4" dir="rtl">
        {!embedded && (
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />
        )}
        <div className="text-center text-gray-500 py-12">
          {!selectedProjectId ? "اختر مشروعاً لعرض كشف الضمان" : "جاري التحميل..."}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // EXTRACT ESCROW DATA FROM ENGINE RESULT
  // ═══════════════════════════════════════════
  const { rows, designDuration, constructionDuration, postDuration } = result;

  // Filter escrow-funded expense rows (outflows from escrow)
  const escrowExpenseRows = rows.filter(
    (r) => r.funder === "escrow" && !r.isRevenue
  );

  // Revenue rows (inflows into escrow)
  const revenueRows = rows.filter((r) => r.isRevenue);

  // Opening balance = 20% of construction cost (investor deposit)
  // This is the first inflow that starts the escrow account
  const constructionCost = rows.find((r) => r.label.includes("تكلفة الإنشاء"))?.totalCost || 0;
  const openingBalance = constructionCost * 0.20;

  // Build month arrays for escrow expenses
  const totalMonths = designDuration + constructionDuration + postDuration;

  // Helper to flatten a row's 3 phase arrays into one
  const flattenRow = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  // Compute outflow totals per month
  const outflowMonthly = Array.from({ length: totalMonths }, (_, i) =>
    escrowExpenseRows.reduce((sum, row) => sum + flattenRow(row)[i], 0)
  );

  // Compute inflow totals per month (revenue rows)
  const inflowMonthly = Array.from({ length: totalMonths }, (_, i) =>
    revenueRows.reduce((sum, row) => sum + flattenRow(row)[i], 0)
  );

  // Net flow and cumulative balance (starting with opening balance)
  const netFlow = outflowMonthly.map((out, i) => inflowMonthly[i] - out);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : openingBalance;
    acc.push(prev + v);
    return acc;
  }, []);

  const totalOutflow = outflowMonthly.reduce((s, v) => s + v, 0);
  const totalInflow = inflowMonthly.reduce((s, v) => s + v, 0);

  // Generate month headers
  const months: { label: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `${i + 1}`, phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `${i + 1}`, phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `${i + 1}`, phase: "post" });

  const phaseColors = {
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
            {!embedded && (
              <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                <ArrowRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-[11px] font-bold text-gray-900">التدفقات النقدية — حساب الضمان (Escrow)</h1>
              <p className="text-[10px] text-gray-500">{(projectQuery.data as any)?.name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                رصيد افتتاحي: {fmt(openingBalance)}
              </span>
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalOutflow)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalInflow)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Project Selector & Scenario */}
      {!embedded && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-4">
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
            className="text-[10px] border border-gray-200 rounded px-2 py-1 bg-white"
          >
            {Object.entries(SCENARIO_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}

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
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-1 text-right w-[200px] min-w-[200px]">
                البند
              </th>
              <th className="bg-gray-100 border-b border-gray-200 px-2 py-1 text-center w-[70px] min-w-[70px]">
                الإجمالي
              </th>
              {months.map((m, i) => (
                <th key={i} className={`px-1 py-0.5 text-center border-b border-gray-200 ${phaseColors[m.phase]} font-normal`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── الرصيد الافتتاحي ─── */}
            <tr className="bg-blue-100/70 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-2 py-[3px] text-blue-900 border-l border-blue-200 w-[200px] min-w-[200px]">
                الرصيد الافتتاحي (إيداع 20%)
              </td>
              <td className="px-2 py-[3px] text-center tabular-nums text-blue-800 font-bold">
                {fmt(openingBalance)}
              </td>
              {months.map((_, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-blue-700">
                  {i === 0 ? fmt(openingBalance) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── المصروفات (Outflows) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المصروفات (Outflows) — ما يخرج من حساب الضمان
              </td>
            </tr>
            {escrowExpenseRows.map((row, idx) => {
              const flat = flattenRow(row);
              const rowTotal = flat.reduce((s, v) => s + v, 0);
              return (
                <tr key={idx} className="border-b border-gray-50 hover:bg-red-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                    {row.label}
                  </td>
                  <td className="px-2 py-[3px] text-center tabular-nums text-red-600 font-medium">
                    {fmt(rowTotal)}
                  </td>
                  {flat.map((v, j) => (
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
              <td className="px-2 py-[3px] text-center tabular-nums text-red-700 font-bold">
                {fmt(totalOutflow)}
              </td>
              {outflowMonthly.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Inflows) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                الإيرادات (Inflows) — ما يدخل حساب الضمان
              </td>
            </tr>
            {revenueRows.map((row, idx) => {
              const flat = flattenRow(row);
              const rowTotal = flat.reduce((s, v) => s + v, 0);
              return (
                <tr key={idx} className="border-b border-gray-50 hover:bg-green-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                    {row.label}
                  </td>
                  <td className="px-2 py-[3px] text-center tabular-nums text-green-600 font-medium">
                    {fmt(rowTotal)}
                  </td>
                  {flat.map((v, j) => (
                    <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Inflows */}
            <tr className="bg-green-100/50 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[3px] text-green-800 border-l border-green-200 w-[200px] min-w-[200px]">
                إجمالي الإيرادات
              </td>
              <td className="px-2 py-[3px] text-center tabular-nums text-green-700 font-bold">
                {fmt(totalInflow)}
              </td>
              {inflowMonthly.map((v, i) => (
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
              <td className="px-2 py-[3px] text-center tabular-nums text-blue-700 font-bold">
                {fmt(netFlow.reduce((s, v) => s + v, 0))}
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
              <td className="px-2 py-[3px] text-center tabular-nums text-blue-800 font-bold">
                {fmt(cumulative[cumulative.length - 1] || 0)}
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
