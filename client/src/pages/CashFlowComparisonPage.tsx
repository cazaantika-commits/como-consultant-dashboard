/**
 * CashFlowComparisonPage.tsx
 * Compares monthly cash flows across all three financing scenarios side by side.
 */
import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (!v || Math.abs(v) < 1) return "–";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}م`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}ك`;
  return Math.round(v).toLocaleString();
}

function fmtFull(v: number): string {
  return Math.round(v).toLocaleString() + " د.إ";
}

function getPhaseForMonth(month: number, phaseInfo: PhaseInfo): string {
  if (month <= phaseInfo.design.end) return "design";
  if (phaseInfo.offplan && month >= phaseInfo.offplan.start && month <= phaseInfo.offplan.end) return "offplan";
  if (month >= phaseInfo.construction.start && month <= phaseInfo.construction.end) return "construction";
  if (month > phaseInfo.construction.end) return "handover";
  return "construction";
}

interface PhaseInfo {
  design: { start: number; end: number; duration: number };
  offplan: { start: number; end: number; duration: number };
  construction: { start: number; end: number; duration: number };
  handover: { start: number; end: number; duration: number };
}

const PHASE_COLORS: Record<string, { header: string; cell: string; bg: string }> = {
  design:       { header: "bg-amber-700 text-white",    cell: "bg-amber-50",    bg: "bg-amber-100" },
  offplan:      { header: "bg-violet-700 text-white",   cell: "bg-violet-50",   bg: "bg-violet-100" },
  construction: { header: "bg-sky-700 text-white",      cell: "bg-sky-50",      bg: "bg-sky-100" },
  handover:     { header: "bg-emerald-700 text-white",  cell: "bg-emerald-50",  bg: "bg-emerald-100" },
};

const SCENARIO_COLORS = {
  offplan_escrow:      { bg: "bg-violet-600", text: "text-white", light: "bg-violet-50", border: "border-violet-300", badge: "bg-violet-100 text-violet-800" },
  offplan_construction:{ bg: "bg-sky-600",    text: "text-white", light: "bg-sky-50",    border: "border-sky-300",    badge: "bg-sky-100 text-sky-800" },
  no_offplan:          { bg: "bg-slate-600",  text: "text-white", light: "bg-slate-50",  border: "border-slate-300",  badge: "bg-slate-100 text-slate-800" },
};

type ScenarioKey = "offplan_escrow" | "offplan_construction" | "no_offplan";

// ─── View mode ───────────────────────────────────────────────────────────────
type ViewMode = "grand" | "investor" | "escrow";

// ─── Component ───────────────────────────────────────────────────────────────

export default function CashFlowComparisonPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("investor");
  const tableRef = useRef<HTMLDivElement>(null);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { staleTime: 60_000 });
  const comparisonQuery = trpc.cashFlowSettings.getComparisonData.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 30_000 }
  );

  const data = comparisonQuery.data;

  // Build rows: for each month, show all 3 scenarios + diff columns
  const rows = useMemo(() => {
    if (!data) return [];
    const { totalMonths, scenarios } = data;
    const s1 = scenarios.offplan_escrow;
    const s2 = scenarios.offplan_construction;
    const s3 = scenarios.no_offplan;

    return Array.from({ length: totalMonths }, (_, i) => {
      const v1 = viewMode === "investor" ? s1.investorMonthly[i] : viewMode === "escrow" ? s1.escrowMonthly[i] : s1.grandMonthly[i];
      const v2 = viewMode === "investor" ? s2.investorMonthly[i] : viewMode === "escrow" ? s2.escrowMonthly[i] : s2.grandMonthly[i];
      const v3 = viewMode === "investor" ? s3.investorMonthly[i] : viewMode === "escrow" ? s3.escrowMonthly[i] : s3.grandMonthly[i];
      return { month: i + 1, v1, v2, v3, diff12: v1 - v2, diff13: v1 - v3 };
    });
  }, [data, viewMode]);

  // Cumulative totals
  const cumulative = useMemo(() => {
    if (!rows.length) return [];
    let c1 = 0, c2 = 0, c3 = 0;
    return rows.map(r => {
      c1 += r.v1; c2 += r.v2; c3 += r.v3;
      return { c1, c2, c3 };
    });
  }, [rows]);

  // Summary cards
  const summary = useMemo(() => {
    if (!data) return null;
    const s1 = data.scenarios.offplan_escrow;
    const s2 = data.scenarios.offplan_construction;
    const s3 = data.scenarios.no_offplan;
    const getTotal = (s: typeof s1) =>
      viewMode === "investor" ? s.investorMonthly.reduce((a, b) => a + b, 0)
      : viewMode === "escrow" ? s.escrowMonthly.reduce((a, b) => a + b, 0)
      : s.grandMonthly.reduce((a, b) => a + b, 0);
    return {
      t1: getTotal(s1), t2: getTotal(s2), t3: getTotal(s3),
      rev1: s1.totalRevenue, rev2: s2.totalRevenue, rev3: s3.totalRevenue,
      cost1: s1.totalCosts, cost2: s2.totalCosts, cost3: s3.totalCosts,
    };
  }, [data, viewMode]);

  // Export CSV
  function handleExport() {
    if (!data) return;
    const { monthLabels, scenarios } = data;
    const s1 = scenarios.offplan_escrow;
    const s2 = scenarios.offplan_construction;
    const s3 = scenarios.no_offplan;

    const getArr = (s: typeof s1) =>
      viewMode === "investor" ? s.investorMonthly
      : viewMode === "escrow" ? s.escrowMonthly
      : s.grandMonthly;

    const a1 = getArr(s1), a2 = getArr(s2), a3 = getArr(s3);

    const rows2: string[][] = [
      ["الشهر", "التاريخ", s1.label, s2.label, s3.label, "الفرق (ضمان - إنجاز)", "الفرق (ضمان - بدون)"],
      ...Array.from({ length: data.totalMonths }, (_, i) => [
        `ش${i + 1}`, monthLabels[i],
        Math.round(a1[i] || 0).toString(),
        Math.round(a2[i] || 0).toString(),
        Math.round(a3[i] || 0).toString(),
        Math.round((a1[i] || 0) - (a2[i] || 0)).toString(),
        Math.round((a1[i] || 0) - (a3[i] || 0)).toString(),
      ]),
    ];

    const csv = rows2.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-comparison-${selectedProjectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const getColPhase = (monthIdx: number) => {
    if (!data?.phaseInfo) return "construction";
    return getPhaseForMonth(monthIdx + 1, data.phaseInfo);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/cashflow-reflection">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowRight className="w-4 h-4" />
              جدول الانعكاس
            </button>
          </Link>
          <div className="w-px h-5 bg-gray-300" />
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-base font-bold text-gray-900">مقارنة السيناريوهات</h1>
            <p className="text-xs text-gray-500">مقارنة التدفق النقدي بين السيناريوهات الثلاثة</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={!data}
          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          تصدير CSV
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">المشروع</span>
            <Select
              value={selectedProjectId?.toString() || ""}
              onValueChange={(v) => setSelectedProjectId(Number(v))}
            >
              <SelectTrigger className="w-64 h-8 text-xs">
                <SelectValue placeholder="اختر المشروع..." />
              </SelectTrigger>
              <SelectContent>
                {(projectsQuery.data || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["investor", "escrow", "grand"] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "investor" ? "المستثمر" : m === "escrow" ? "الضمان" : "الكل"}
              </button>
            ))}
          </div>
        </div>

        {!selectedProjectId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">اختر مشروعاً لعرض مقارنة السيناريوهات</p>
          </div>
        )}

        {comparisonQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">جاري تحميل البيانات...</p>
          </div>
        )}

        {data && summary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {(["offplan_escrow", "offplan_construction", "no_offplan"] as ScenarioKey[]).map(sk => {
                const sc = data.scenarios[sk];
                const col = SCENARIO_COLORS[sk];
                const total = sk === "offplan_escrow" ? summary.t1 : sk === "offplan_construction" ? summary.t2 : summary.t3;
                const rev = sk === "offplan_escrow" ? summary.rev1 : sk === "offplan_construction" ? summary.rev2 : summary.rev3;
                const cost = sk === "offplan_escrow" ? summary.cost1 : sk === "offplan_construction" ? summary.cost2 : summary.cost3;
                return (
                  <div key={sk} className={`bg-white rounded-xl border-2 ${col.border} shadow-sm overflow-hidden`}>
                    <div className={`${col.bg} ${col.text} px-4 py-2.5`}>
                      <p className="text-xs font-semibold opacity-90">{sc.label}</p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">إجمالي التدفق ({viewMode === "investor" ? "المستثمر" : viewMode === "escrow" ? "الضمان" : "الكل"})</span>
                        <span className="text-sm font-bold text-gray-900">{(total / 1_000_000).toFixed(2)}م د.إ</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">إجمالي التكاليف</span>
                        <span className="text-xs font-semibold text-red-700">{(cost / 1_000_000).toFixed(2)}م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">إجمالي الإيرادات</span>
                        <span className="text-xs font-semibold text-emerald-700">{(rev / 1_000_000).toFixed(2)}م</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                        <span className="text-xs text-gray-500">صافي الربح</span>
                        <span className={`text-xs font-bold ${rev - cost > 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {((rev - cost) / 1_000_000).toFixed(2)}م
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-800">جدول المقارنة الشهرية</span>
                <span className="text-xs text-gray-400 mr-auto">
                  {viewMode === "investor" ? "التدفق النقدي للمستثمر" : viewMode === "escrow" ? "التدفق من حساب الضمان" : "إجمالي التدفق النقدي"}
                </span>
              </div>
              <div ref={tableRef} className="overflow-x-auto">
                <table
                  className="text-xs border-collapse"
                  style={{ minWidth: `${Math.max(900, data.totalMonths * 60 + 400)}px` }}
                >
                  <thead>
                    {/* Phase header */}
                    <tr>
                      <th className="sticky right-0 z-20 bg-gray-800 text-white px-3 py-2 text-right font-semibold min-w-[80px] border-b border-gray-700">
                        الشهر
                      </th>
                      <th className="sticky right-[80px] z-20 bg-gray-800 text-white px-2 py-2 text-right font-semibold min-w-[90px] border-b border-gray-700">
                        التاريخ
                      </th>
                      {/* S1 */}
                      <th colSpan={1} className="bg-violet-700 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-violet-600 border-l border-violet-500">
                        {data.scenarios.offplan_escrow.labelShort}
                      </th>
                      {/* S2 */}
                      <th colSpan={1} className="bg-sky-700 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-sky-600 border-l border-sky-500">
                        {data.scenarios.offplan_construction.labelShort}
                      </th>
                      {/* S3 */}
                      <th colSpan={1} className="bg-slate-700 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-slate-600 border-l border-slate-500">
                        {data.scenarios.no_offplan.labelShort}
                      </th>
                      {/* Diff columns */}
                      <th className="bg-orange-700 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-orange-600">
                        فرق (1-2)
                      </th>
                      <th className="bg-rose-700 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-rose-600">
                        فرق (1-3)
                      </th>
                      {/* Monthly columns */}
                      {Array.from({ length: data.totalMonths }, (_, i) => {
                        const phase = getColPhase(i);
                        const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                        return (
                          <th
                            key={i}
                            className={`${pc.header} px-1 py-2 text-center font-medium min-w-[55px] border-b border-gray-600`}
                          >
                            <div className="text-xs opacity-80">ش{i + 1}</div>
                            <div className="text-xs truncate max-w-[52px]" title={data.monthLabels[i]}>
                              {data.monthLabels[i]?.split(" ")[0]}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* S1 row */}
                    <tr className="border-b border-violet-100 bg-violet-50/40 hover:bg-violet-50 transition-all">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-violet-800 border-l border-gray-200 bg-violet-50/80 min-w-[80px]">
                        س1
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-violet-700 font-medium border-l border-gray-200 bg-violet-50/80 min-w-[90px]">
                        {data.scenarios.offplan_escrow.labelShort}
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-violet-800 bg-violet-100 border-l border-violet-200">
                        {fmtFull(rows.reduce((s, r) => s + r.v1, 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      {rows.map((r, i) => {
                        const phase = getColPhase(i);
                        const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                        const hasVal = r.v1 && Math.abs(r.v1) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 ${hasVal ? `${pc.cell} font-medium text-violet-800` : "text-gray-200"}`}
                            title={hasVal ? `${data.monthLabels[i]}: ${Math.round(r.v1).toLocaleString()} د.إ` : undefined}>
                            {fmt(r.v1)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* S2 row */}
                    <tr className="border-b border-sky-100 bg-sky-50/40 hover:bg-sky-50 transition-all">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-sky-800 border-l border-gray-200 bg-sky-50/80 min-w-[80px]">
                        س2
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-sky-700 font-medium border-l border-gray-200 bg-sky-50/80 min-w-[90px]">
                        {data.scenarios.offplan_construction.labelShort}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center font-bold text-sky-800 bg-sky-100 border-l border-sky-200">
                        {fmtFull(rows.reduce((s, r) => s + r.v2, 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      {rows.map((r, i) => {
                        const phase = getColPhase(i);
                        const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                        const hasVal = r.v2 && Math.abs(r.v2) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 ${hasVal ? `${pc.cell} font-medium text-sky-800` : "text-gray-200"}`}
                            title={hasVal ? `${data.monthLabels[i]}: ${Math.round(r.v2).toLocaleString()} د.إ` : undefined}>
                            {fmt(r.v2)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* S3 row */}
                    <tr className="border-b border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-all">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-slate-700 border-l border-gray-200 bg-slate-50/80 min-w-[80px]">
                        س3
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-slate-600 font-medium border-l border-gray-200 bg-slate-50/80 min-w-[90px]">
                        {data.scenarios.no_offplan.labelShort}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-700 bg-slate-100 border-l border-slate-200">
                        {fmtFull(rows.reduce((s, r) => s + r.v3, 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      {rows.map((r, i) => {
                        const phase = getColPhase(i);
                        const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                        const hasVal = r.v3 && Math.abs(r.v3) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 ${hasVal ? `${pc.cell} font-medium text-slate-700` : "text-gray-200"}`}
                            title={hasVal ? `${data.monthLabels[i]}: ${Math.round(r.v3).toLocaleString()} د.إ` : undefined}>
                            {fmt(r.v3)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Diff row: S1 - S2 */}
                    <tr className="border-b border-orange-100 bg-orange-50/30 hover:bg-orange-50 transition-all">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-orange-700 border-l border-gray-200 bg-orange-50/80 min-w-[80px]">
                        فرق
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-orange-600 font-medium border-l border-gray-200 bg-orange-50/80 min-w-[90px]">
                        س1 – س2
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center font-bold text-orange-700 bg-orange-100 border-l border-orange-200">
                        {fmtFull(rows.reduce((s, r) => s + r.diff12, 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      {rows.map((r, i) => {
                        const hasVal = r.diff12 && Math.abs(r.diff12) >= 1;
                        const isPos = r.diff12 > 0;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 ${hasVal ? (isPos ? "bg-orange-50 text-orange-700 font-medium" : "bg-blue-50 text-blue-700 font-medium") : "text-gray-200"}`}
                            title={hasVal ? `${data.monthLabels[i]}: ${Math.round(r.diff12).toLocaleString()} د.إ` : undefined}>
                            {hasVal ? (
                              <span className="flex items-center justify-center gap-0.5">
                                {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                {fmt(Math.abs(r.diff12))}
                              </span>
                            ) : "–"}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Diff row: S1 - S3 */}
                    <tr className="border-b border-rose-100 bg-rose-50/30 hover:bg-rose-50 transition-all">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-rose-700 border-l border-gray-200 bg-rose-50/80 min-w-[80px]">
                        فرق
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-rose-600 font-medium border-l border-gray-200 bg-rose-50/80 min-w-[90px]">
                        س1 – س3
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center text-gray-400 bg-gray-50 border-l border-gray-200">–</td>
                      <td className="px-2 py-1.5 text-center font-bold text-rose-700 bg-rose-100 border-l border-rose-200">
                        {fmtFull(rows.reduce((s, r) => s + r.diff13, 0))}
                      </td>
                      {rows.map((r, i) => {
                        const hasVal = r.diff13 && Math.abs(r.diff13) >= 1;
                        const isPos = r.diff13 > 0;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 ${hasVal ? (isPos ? "bg-rose-50 text-rose-700 font-medium" : "bg-blue-50 text-blue-700 font-medium") : "text-gray-200"}`}
                            title={hasVal ? `${data.monthLabels[i]}: ${Math.round(r.diff13).toLocaleString()} د.إ` : undefined}>
                            {hasVal ? (
                              <span className="flex items-center justify-center gap-0.5">
                                {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                {fmt(Math.abs(r.diff13))}
                              </span>
                            ) : "–"}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Cumulative S1 */}
                    <tr className="border-b-2 border-violet-300 bg-violet-100/50">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-bold text-violet-900 border-l border-gray-200 bg-violet-100 min-w-[80px]">
                        تراكمي
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-violet-700 font-bold border-l border-gray-200 bg-violet-100 min-w-[90px]">
                        س1 تراكمي
                      </td>
                      <td colSpan={5} className="bg-violet-50 border-l border-gray-200" />
                      {cumulative.map((c, i) => {
                        const hasVal = c.c1 && Math.abs(c.c1) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 font-semibold ${hasVal ? "bg-violet-100 text-violet-800" : "text-gray-200"}`}>
                            {fmt(c.c1)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Cumulative S2 */}
                    <tr className="border-b-2 border-sky-300 bg-sky-100/50">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-bold text-sky-900 border-l border-gray-200 bg-sky-100 min-w-[80px]">
                        تراكمي
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-sky-700 font-bold border-l border-gray-200 bg-sky-100 min-w-[90px]">
                        س2 تراكمي
                      </td>
                      <td colSpan={5} className="bg-sky-50 border-l border-gray-200" />
                      {cumulative.map((c, i) => {
                        const hasVal = c.c2 && Math.abs(c.c2) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 font-semibold ${hasVal ? "bg-sky-100 text-sky-800" : "text-gray-200"}`}>
                            {fmt(c.c2)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Cumulative S3 */}
                    <tr className="border-b-2 border-slate-300 bg-slate-100/50">
                      <td className="sticky right-0 z-10 px-3 py-1.5 font-bold text-slate-800 border-l border-gray-200 bg-slate-100 min-w-[80px]">
                        تراكمي
                      </td>
                      <td className="sticky right-[80px] z-10 px-2 py-1.5 text-xs text-slate-600 font-bold border-l border-gray-200 bg-slate-100 min-w-[90px]">
                        س3 تراكمي
                      </td>
                      <td colSpan={5} className="bg-slate-50 border-l border-gray-200" />
                      {cumulative.map((c, i) => {
                        const hasVal = c.c3 && Math.abs(c.c3) >= 1;
                        return (
                          <td key={i} className={`px-1 py-1.5 text-center border-l border-gray-100 font-semibold ${hasVal ? "bg-slate-100 text-slate-700" : "text-gray-200"}`}>
                            {fmt(c.c3)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" /> س1: أوف بلان مع إيداع في حساب الضمان</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" /> س2: أوف بلان بعد 20% إنجاز</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" /> س3: بدون أوف بلان</div>
              <div className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-orange-600" /> فرق موجب: السيناريو الأول أعلى تكلفة</div>
              <div className="flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-blue-600" /> فرق سالب: السيناريو الثاني/الثالث أعلى تكلفة</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
