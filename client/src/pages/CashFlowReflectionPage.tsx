/**
 * CashFlowReflectionPage — التكاليف الكلية للمشروع والجدول الزمني
 *
 * Displays the monthly cash flow reflection table: a horizontal Excel-like
 * matrix where rows = cost/revenue items and columns = months.
 *
 * Data is fetched from the server using the saved settings (or defaults).
 */

import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table2, Settings2, Building2, ArrowLeft, Download, Info, BarChart3
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";
type Category = "land" | "design" | "offplan_reg" | "construction" | "marketing_sales" | "admin" | "developer_fee" | "revenue" | "other";
type FundingSource = "investor" | "escrow";

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20% من الإنشاء",
  no_offplan: "تطوير بدون بيع على الخارطة",
};

const CATEGORY_LABELS: Record<Category, string> = {
  land: "الأرض",
  design: "التصاميم",
  offplan_reg: "تسجيل أوف بلان",
  construction: "الإنشاء",
  marketing_sales: "التسويق والمبيعات",
  admin: "إدارية",
  developer_fee: "أتعاب المطور",
  revenue: "الإيرادات",
  other: "أخرى",
};

const PHASE_COLORS: Record<string, { header: string; cell: string; border: string }> = {
  land:         { header: "bg-stone-700 text-white",    cell: "bg-stone-50",    border: "border-stone-300" },
  design:       { header: "bg-amber-700 text-white",    cell: "bg-amber-50",    border: "border-amber-200" },
  offplan:      { header: "bg-violet-700 text-white",   cell: "bg-violet-50",   border: "border-violet-200" },
  construction: { header: "bg-sky-800 text-white",      cell: "bg-sky-50",      border: "border-sky-200" },
  handover:     { header: "bg-emerald-700 text-white",  cell: "bg-emerald-50",  border: "border-emerald-200" },
};

const CATEGORY_ROW_COLORS: Record<Category, string> = {
  land: "bg-stone-50",
  design: "bg-amber-50/60",
  offplan_reg: "bg-violet-50/60",
  construction: "bg-sky-50/60",
  marketing_sales: "bg-pink-50/60",
  admin: "bg-slate-50/60",
  developer_fee: "bg-orange-50/60",
  revenue: "bg-emerald-50/60",
  other: "bg-gray-50/60",
};

function fmt(n: number): string {
  if (!n || isNaN(n) || Math.abs(n) < 1) return "";
  return Math.round(n).toLocaleString("ar-AE");
}

function fmtHeader(n: number): string {
  if (!n || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "ك";
  return Math.round(n).toString();
}

function getPhaseForMonth(
  m: number, // 1-based
  phaseInfo: { design: any; offplan: any; construction: any; handover: any }
): string {
  if (m === 0) return "land";
  const { design, offplan, construction, handover } = phaseInfo;
  // offplan overlaps with design — check offplan first
  if (m >= offplan.start && m <= offplan.end) return "offplan";
  if (m >= design.start && m <= design.end) return "design";
  if (m >= construction.start && m <= construction.end) return "construction";
  if (m >= handover.start && m <= handover.end) return "handover";
  return "construction";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CashFlowReflectionPage({
  embedded,
  initialProjectId,
  onNavigateToSettings,
}: {
  embedded?: boolean;
  initialProjectId?: number | null;
  onNavigateToSettings?: () => void;
} = {}) {
  const { isAuthenticated } = useAuth();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const [viewMode, setViewMode] = useState<"all" | "investor" | "escrow">("all");
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialProjectId != null) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  const reflectionQuery = trpc.cashFlowSettings.getReflectionData.useQuery(
    { projectId: selectedProjectId!, scenario },
    { enabled: !!selectedProjectId, staleTime: 0 }
  );

  const data = reflectionQuery.data;
  const items = data?.items || [];
  const monthLabels = data?.monthLabels || [];
  const totalMonths = data?.totalMonths || 0;
  const phaseInfo = data?.phaseInfo;

  // Filter items by view mode
  const visibleItems = items.filter(item => {
    if (viewMode === "investor") return item.fundingSource === "investor";
    if (viewMode === "escrow") return item.fundingSource === "escrow";
    return true;
  });

  // Group visible items by section (not category) to avoid duplication of split items
  type Section = "paid" | "design" | "offplan" | "construction" | "escrow" | "revenue";
  const SECTION_LABELS: Record<string, string> = {
    paid:         "القسم الأول — المبالغ المدفوعة (الأرض)",
    design:       "القسم الثاني — التصاميم وترخيص البناء",
    offplan:      "القسم الثالث — ريرا والبيع أوف بلان",
    construction: "القسم الرابع — الإنشاء (حصة المستثمر فقط)",
    escrow:       "القسم الخامس — من حساب الضمان",
    revenue:      "الإيرادات",
  };
  const SECTION_ROW_COLORS: Record<string, string> = {
    paid:         "bg-stone-50/60",
    design:       "bg-amber-50/60",
    offplan:      "bg-violet-50/60",
    construction: "bg-sky-50/60",
    escrow:       "bg-teal-50/60",
    revenue:      "bg-emerald-50/60",
  };
  const sectionOrder: string[] = ["paid", "design", "offplan", "construction", "escrow", "revenue"];
  const groupedBySection: Record<string, typeof items> = {};
  for (const sec of sectionOrder) {
    groupedBySection[sec] = visibleItems.filter(i => (i as any).section === sec);
  }
  // Fallback: items with unknown section go to construction
  const allSectioned = new Set(sectionOrder);
  const unsectioned = visibleItems.filter(i => !allSectioned.has((i as any).section || ""));
  if (unsectioned.length > 0) groupedBySection["construction"].push(...unsectioned);

  // Build column phases for header coloring
  function getColPhase(monthIdx: number): string {
    if (!phaseInfo) return "construction";
    return getPhaseForMonth(monthIdx + 1, phaseInfo);
  }

  // Export to CSV
  function handleExport() {
    if (!data) return;
    const rows: string[][] = [];
    // Header
    rows.push(["البند", "الفئة", "مصدر التمويل", "الإجمالي", ...monthLabels]);
    // Items
    for (const item of items) {
      rows.push([
        item.nameAr,
        CATEGORY_LABELS[item.category as Category] || item.category,
        item.fundingSource === "investor" ? "المستثمر" : "حساب الضمان",
        item.totalAmount.toString(),
        ...item.monthlyAmounts.map(v => v ? Math.round(v).toString() : ""),
      ]);
    }
    // Totals
    rows.push(["إجمالي المستثمر", "", "", data.investorMonthlyTotals.reduce((s, v) => s + v, 0).toString(), ...data.investorMonthlyTotals.map(v => v ? Math.round(v).toString() : "")]);
    rows.push(["إجمالي الضمان", "", "", data.escrowMonthlyTotals.reduce((s, v) => s + v, 0).toString(), ...data.escrowMonthlyTotals.map(v => v ? Math.round(v).toString() : "")]);
    rows.push(["الإجمالي الكلي", "", "", data.grandMonthlyTotals.reduce((s, v) => s + v, 0).toString(), ...data.grandMonthlyTotals.map(v => v ? Math.round(v).toString() : "")]);

    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-reflection-${selectedProjectId}-${scenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3">
              <Table2 className="w-6 h-6 text-emerald-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">التكاليف الكلية للمشروع والجدول الزمني</h1>
                <p className="text-sm text-gray-500">توزيع التكاليف والإيرادات الشهري</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToSettings && (
                <Button variant="outline" size="sm" onClick={onNavigateToSettings} className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  جدول الإعدادات
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!data} className="gap-2">
                <Download className="w-4 h-4" />
                تصدير CSV
              </Button>
              <Link href="/cashflow-comparison">
                <Button variant="outline" size="sm" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  <BarChart3 className="w-4 h-4" />
                  مقارنة السيناريوهات
                </Button>
              </Link>
              <Link href="/excel-cashflow">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  التدفق النقدي
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-4">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Project */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">المشروع</Label>
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(v) => setSelectedProjectId(Number(v))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="اختر المشروع..." />
                </SelectTrigger>
                <SelectContent>
                  {(projectsQuery.data || []).map((p: any) => (
                    <SelectItem key={`proj-${p.id}`} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scenario */}
            <div className="flex-1 min-w-[280px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">سيناريو التمويل</Label>
              <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SCENARIO_LABELS) as [Scenario, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">عرض</Label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {[
                  { value: "all", label: "الكل" },
                  { value: "investor", label: "المستثمر" },
                  { value: "escrow", label: "الضمان" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setViewMode(opt.value as any)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase Legend */}
            {phaseInfo && (
              <div className="flex flex-wrap gap-1.5 mr-auto">
                {[
                  { label: "الأرض", phase: "land" },
                  { label: "التصاميم", phase: "design" },
                  { label: "أوف بلان", phase: "offplan" },
                  { label: "الإنشاء", phase: "construction" },
                  { label: "التسليم", phase: "handover" },
                ].map(ph => (
                  <div key={ph.phase} className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                    ph.phase === "land" ? "bg-stone-600" :
                    ph.phase === "design" ? "bg-amber-600" :
                    ph.phase === "offplan" ? "bg-violet-600" :
                    ph.phase === "construction" ? "bg-sky-700" :
                    "bg-emerald-600"
                  }`}>
                    {ph.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {reflectionQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">جارٍ حساب التدفق النقدي...</p>
          </div>
        )}

        {/* No project */}
        {!selectedProjectId && !reflectionQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">اختر مشروعاً لعرض التكاليف الكلية والجدول الزمني</p>
          </div>
        )}

        {/* Main Table */}
        {selectedProjectId && !reflectionQuery.isLoading && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">إجمالي التكاليف</p>
                <p className="text-base font-bold text-gray-900">
                  {(data.totalCosts / 1_000_000).toFixed(2)}م د.إ
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 shadow-sm text-center">
                <p className="text-xs text-blue-600 mb-1">تكاليف المستثمر</p>
                <p className="text-base font-bold text-blue-700">
                  {(data.investorMonthlyTotals.reduce((s, v) => s + v, 0) / 1_000_000).toFixed(2)}م د.إ
                </p>
              </div>
              <div className="bg-violet-50 rounded-xl border border-violet-100 p-3 shadow-sm text-center">
                <p className="text-xs text-violet-600 mb-1">تكاليف الضمان</p>
                <p className="text-base font-bold text-violet-700">
                  {(data.escrowMonthlyTotals.reduce((s, v) => s + v, 0) / 1_000_000).toFixed(2)}م د.إ
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 shadow-sm text-center">
                <p className="text-xs text-emerald-600 mb-1">إجمالي الإيرادات</p>
                <p className="text-base font-bold text-emerald-700">
                  {(data.totalRevenue / 1_000_000).toFixed(2)}م د.إ
                </p>
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div ref={tableRef} className="overflow-x-auto">
                <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(800, totalMonths * 70 + 280)}px` }}>
                  <thead>
                    {/* Phase header row */}
                    <tr>
                      <th className="sticky right-0 z-20 bg-gray-800 text-white px-3 py-2 text-right font-semibold min-w-[180px] border-b border-gray-700">
                        البند
                      </th>
                      <th className="bg-gray-800 text-white px-2 py-2 text-center font-semibold min-w-[90px] border-b border-gray-700">
                        الإجمالي
                      </th>
                      {/* Month columns */}
                      {Array.from({ length: totalMonths }, (_, i) => {
                        const phase = getColPhase(i);
                        const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                        return (
                          <th
                            key={`hdr-${i}`}
                            className={`${pc.header} px-1 py-2 text-center font-medium min-w-[65px] border-b border-gray-600`}
                          >
                            <div className="text-xs opacity-80">ش{i + 1}</div>
                            <div className="text-xs truncate max-w-[60px]" title={monthLabels[i]}>
                              {monthLabels[i]?.split(" ")[0]}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sectionOrder.map(section => {
                      const secItems = groupedBySection[section];
                      if (!secItems || secItems.length === 0) return null;
                      const rowBg = SECTION_ROW_COLORS[section] || "";

                      return (
                        <React.Fragment key={section}>
                          {/* Section separator row */}
                          <tr className="bg-gray-100">
                            <td
                              colSpan={totalMonths + 2}
                              className="sticky right-0 z-10 px-3 py-1.5 font-semibold text-gray-700 text-xs border-b border-gray-200"
                            >
                              {SECTION_LABELS[section]}
                            </td>
                          </tr>

                          {/* Item rows */}
                          {secItems.map((item) => {
                            return (
                              <tr
                                key={item.itemKey}
                                className={`border-b border-gray-100 hover:brightness-95 transition-all ${rowBg}`}
                              >
                                {/* Item name — sticky */}
                                <td className={`sticky right-0 z-10 px-3 py-1.5 font-medium text-gray-800 border-l border-gray-200 ${rowBg}`}>
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.nameAr}</span>
                                    {item.fundingSource === "escrow" && (
                                      <span className="text-xs text-violet-600 bg-violet-50 px-1 rounded">ضمان</span>
                                    )}
                                  </div>
                                </td>

                                {/* Total */}
                                <td className="px-2 py-1.5 text-center font-semibold text-gray-700 border-l border-gray-200 bg-gray-50">
                                  {fmtHeader(item.totalAmount)}
                                </td>

                                {/* Monthly amounts */}
                                {item.monthlyAmounts.map((val, mIdx) => {
                                  const phase = getColPhase(mIdx);
                                  const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                                  const hasValue = val && Math.abs(val) >= 1;
                                  return (
                                    <td
                                      key={`cell-${item.itemKey}-${mIdx}`}
                                      className={`px-1 py-1.5 text-center border-l border-gray-100 ${
                                        hasValue ? `${pc.cell} font-medium text-gray-800` : "text-gray-200"
                                      }`}
                                      title={hasValue ? `${monthLabels[mIdx]}: ${Math.round(val).toLocaleString()} د.إ` : undefined}
                                    >
                                      {fmt(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}

                          {/* Section subtotal */}
                          <tr className="border-b-2 border-gray-300">
                            <td className={`sticky right-0 z-10 px-3 py-1.5 font-bold text-gray-700 text-xs border-l border-gray-200 ${
                              section === "revenue" ? "bg-emerald-100" : "bg-gray-100"
                            }`}>
                              إجمالي {SECTION_LABELS[section]}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold text-gray-800 bg-gray-100 border-l border-gray-200">
                              {fmtHeader(secItems.reduce((s, i) => s + i.totalAmount, 0))}
                            </td>
                            {Array.from({ length: totalMonths }, (_, mIdx) => {
                              const total = secItems.reduce((s, i) => s + (i.monthlyAmounts[mIdx] || 0), 0);
                              const hasValue = total && Math.abs(total) >= 1;
                              const phase = getColPhase(mIdx);
                              const pc = PHASE_COLORS[phase] || PHASE_COLORS.construction;
                              return (
                                <td
                                  key={`sub-${section}-${mIdx}`}
                                  className={`px-1 py-1.5 text-center font-bold border-l border-gray-200 ${
                                    hasValue
                                      ? section === "revenue"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : `${pc.cell} text-gray-800`
                                      : "bg-gray-50 text-gray-200"
                                  }`}
                                >
                                  {fmt(total)}
                                </td>
                              );
                            })}
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    {/* Grand Totals */}
                    {viewMode !== "escrow" && (
                      <tr className="bg-blue-700 text-white font-bold border-t-2 border-blue-800">
                        <td className="sticky right-0 z-10 px-3 py-2 bg-blue-700 border-l border-blue-600">
                          إجمالي المستثمر الشهري
                        </td>
                        <td className="px-2 py-2 text-center bg-blue-700 border-l border-blue-600">
                          {fmtHeader(data.investorMonthlyTotals.reduce((s, v) => s + v, 0))}
                        </td>
                        {data.investorMonthlyTotals.map((val, mIdx) => (
                          <td
                            key={`inv-${mIdx}`}
                            className="px-1 py-2 text-center bg-blue-700 border-l border-blue-600"
                          >
                            {fmt(val)}
                          </td>
                        ))}
                      </tr>
                    )}

                    {viewMode !== "investor" && (
                      <tr className="bg-violet-700 text-white font-bold">
                        <td className="sticky right-0 z-10 px-3 py-2 bg-violet-700 border-l border-violet-600">
                          إجمالي الضمان الشهري
                        </td>
                        <td className="px-2 py-2 text-center bg-violet-700 border-l border-violet-600">
                          {fmtHeader(data.escrowMonthlyTotals.reduce((s, v) => s + v, 0))}
                        </td>
                        {data.escrowMonthlyTotals.map((val, mIdx) => (
                          <td
                            key={`esc-${mIdx}`}
                            className="px-1 py-2 text-center bg-violet-700 border-l border-violet-600"
                          >
                            {fmt(val)}
                          </td>
                        ))}
                      </tr>
                    )}

                    {viewMode === "all" && (
                      <tr className="bg-gray-900 text-white font-bold text-sm">
                        <td className="sticky right-0 z-10 px-3 py-2.5 bg-gray-900 border-l border-gray-700">
                          الإجمالي الكلي الشهري
                        </td>
                        <td className="px-2 py-2.5 text-center bg-gray-900 border-l border-gray-700">
                          {fmtHeader(data.grandMonthlyTotals.reduce((s, v) => s + v, 0))}
                        </td>
                        {data.grandMonthlyTotals.map((val, mIdx) => (
                          <td
                            key={`all-${mIdx}`}
                            className="px-1 py-2.5 text-center bg-gray-900 border-l border-gray-700"
                          >
                            {fmt(val)}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Cumulative Investor Row */}
                    {viewMode !== "escrow" && (
                      <tr className="bg-blue-50 text-blue-900 font-medium">
                        <td className="sticky right-0 z-10 px-3 py-1.5 bg-blue-50 border-l border-blue-100 text-xs">
                          تراكمي المستثمر
                        </td>
                        <td className="px-2 py-1.5 text-center bg-blue-50 border-l border-blue-100 text-xs">—</td>
                        {(() => {
                          let cum = 0;
                          return data.investorMonthlyTotals.map((val, mIdx) => {
                            cum += val;
                            return (
                              <td key={`cum-inv-${mIdx}`} className="px-1 py-1.5 text-center text-xs border-l border-blue-100">
                                {fmtHeader(cum)}
                              </td>
                            );
                          });
                        })()}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
              <div>
                <span className="font-medium">ملاحظة:</span> الأرقام بالدرهم الإماراتي. الإجماليات المعروضة بالآلاف (ك) أو الملايين (م).
                يمكنك تعديل توزيع البنود من{" "}
                <button
                  onClick={onNavigateToSettings}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  جدول الإعدادات
                </button>.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
