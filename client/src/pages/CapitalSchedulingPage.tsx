import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculatePhases,
  getInvestorExpenses,
  distributeExpense,
  getDefaultCustomDistribution,
  getTotalMonths,
  isMonthPaid,
  type PhaseDurations,
  type ExpenseItem,
} from "@/lib/cashFlowEngine";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";

const TOTAL_MONTHS = 40;
const CHART_START = new Date(2026, 3, 1); // April 2026

const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function getMonthLabel(offset: number): string {
  const d = new Date(CHART_START);
  d.setMonth(d.getMonth() + offset);
  return `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthOffset(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const diffMs = d.getTime() - CHART_START.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
}

function fmtCell(n: number): string {
  if (n === 0) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

interface ProjectColumn {
  id: number;
  name: string;
  startOffset: number;
  preConMonths: number;
  constructionMonths: number;
  monthlyAmounts: Record<number, number>;
  // Capital summary (from cashflow engine)
  totalCapital: number;
  paidCapital: number;
  remainingCapital: number;
}

// Phase colors — attractive olive/earthy palette
const PHASE_BG: Record<string, string> = {
  preCon:       "#8fbc5a", // olive green — ما قبل التنفيذ
  construction: "#4a7c59", // deep forest green — الإنشاء
  handover:     "#c9a84c", // warm gold — التسليم
};
const PHASE_TEXT: Record<string, string> = {
  preCon:       "#1a2e0a",
  construction: "#ffffff",
  handover:     "#1a1000",
};
// Row background — warm cream alternating (earthy tone to complement olive)
const ROW_BG_EVEN = "#f5f0e8";
const ROW_BG_ODD  = "#ede7d9";
// Pillar inner background — soft warm white
const PILLAR_INACTIVE = "rgba(255,252,245,0.7)";

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

export default function CapitalSchedulingPage({ onBack }: Props) {
  const { isAuthenticated } = useAuth();

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const allMoQuery    = trpc.marketOverview.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60000 });
  const allCpQuery    = trpc.competitionPricing.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60000 });
  // Real capital data from cf_cost_items (أيقونة رأس المال المطلوب)
  const capitalSummaryQuery = trpc.cashFlowProgram.getCapitalSummaryAllProjects.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30000 });

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);
  const allMo    = useMemo(() => allMoQuery.data || [], [allMoQuery.data]);
  const allCp    = useMemo(() => allCpQuery.data || [], [allCpQuery.data]);
  const capitalSummary = useMemo(() => capitalSummaryQuery.data || [], [capitalSummaryQuery.data]);

  const columns = useMemo<ProjectColumn[]>(() => {
    return projects.map((project) => {
      const mo   = allMo.find((m: any) => m.projectId === project.id);
      const cp   = allCp.find((c: any) => c.projectId === project.id);
      const costs = calculateProjectCosts(project, mo, cp);

      const preConMonths       = project.preConMonths ?? 6;
      const constructionMonths = project.constructionMonths ?? 16;
      const handoverMonths     = 2;

      const durations: PhaseDurations = { preCon: preConMonths, construction: constructionMonths, handover: handoverMonths };
      const phases   = calculatePhases(durations);
      const expenses = getInvestorExpenses(costs || undefined);

      const relativeMonthly: Record<number, number> = {};
      for (const item of expenses) {
        if (item.phase === "land") continue;
        let dist: Record<number, number>;
        if (item.behavior === "CUSTOM") {
          dist = getDefaultCustomDistribution(item.id, phases, durations, costs || undefined);
        } else {
          dist = distributeExpense(item as ExpenseItem, phases, durations);
        }
        for (const [m, v] of Object.entries(dist)) {
          const mn = parseInt(m);
          relativeMonthly[mn] = (relativeMonthly[mn] || 0) + v;
        }
      }

      const startOffset = getMonthOffset((project as any).constructionStartDate || null);
      const monthlyAmounts: Record<number, number> = {};
      for (const [rel, val] of Object.entries(relativeMonthly)) {
        const absIdx = startOffset + parseInt(rel) - 1;
        if (absIdx >= 0 && absIdx < TOTAL_MONTHS) {
          monthlyAmounts[absIdx] = (monthlyAmounts[absIdx] || 0) + val;
        }
      }

      // Capital summary: total, paid (months already passed), remaining
      const projectStart = new Date(CHART_START);
      projectStart.setMonth(projectStart.getMonth() + startOffset);
      const totalMonths = getTotalMonths(durations);
      let totalCapital = 0;
      let paidCapital = 0;
      for (let relM = 1; relM <= totalMonths; relM++) {
        const monthAmt = relativeMonthly[relM] || 0;
        totalCapital += monthAmt;
        if (isMonthPaid(relM, projectStart)) {
          paidCapital += monthAmt;
        }
      }
      const remainingCapital = totalCapital - paidCapital;

      return { id: project.id, name: project.name, startOffset, preConMonths, constructionMonths, monthlyAmounts, totalCapital, paidCapital, remainingCapital };
    });
  }, [projects, allMo, allCp]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const col of columns) {
      for (const [absIdx, val] of Object.entries(col.monthlyAmounts)) {
        const idx = parseInt(absIdx);
        totals[idx] = (totals[idx] || 0) + val;
      }
    }
    return totals;
  }, [columns]);

  function getPhase(col: ProjectColumn, absIdx: number): string | null {
    const rel = absIdx - col.startOffset + 1;
    if (rel < 1) return null;
    if (rel <= col.preConMonths) return "preCon";
    if (rel <= col.preConMonths + col.constructionMonths) return "construction";
    if (rel <= col.preConMonths + col.constructionMonths + 2) return "handover";
    return null;
  }

  // Column widths — compact
  const TOTAL_COL_W = 90;  // leftmost: الإجمالي الشهري
  const DATE_COL_W  = 90;  // second from left: الشهر
  const COL_W       = 90;  // each project
  const ROW_H       = 34;
  const GAP         = 24;  // gap between project pillars (px) — wide enough to show background

  // Grouping: 1 = monthly, 3 = quarterly, 6 = semi-annual
  const [groupBy, setGroupBy] = useState<1 | 3 | 6>(1);

  // Build grouped rows: each row covers `groupBy` months
  const groupedRows = useMemo(() => {
    const numGroups = Math.ceil(TOTAL_MONTHS / groupBy);
    return Array.from({ length: numGroups }, (_, gi) => {
      const startIdx = gi * groupBy;
      const endIdx   = Math.min(startIdx + groupBy - 1, TOTAL_MONTHS - 1);
      // Label: first month label (if groupBy=1) or range
      const label = groupBy === 1
        ? getMonthLabel(startIdx)
        : `${getMonthLabel(startIdx)} — ${getMonthLabel(endIdx)}`;
      // Aggregate totals
      const total = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => monthlyTotals[startIdx + i] || 0)
        .reduce((s, v) => s + v, 0);
      // Per-project aggregated amounts and dominant phase
      const colData = columns.map((col) => {
        const amount = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => col.monthlyAmounts[startIdx + i] || 0)
          .reduce((s, v) => s + v, 0);
        // Dominant phase: pick phase of middle month in group
        const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);
        const phase  = getPhase(col, midIdx);
        return { colId: col.id, amount, phase };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [columns, monthlyTotals, groupBy]);

  const isLoading = projectsQuery.isLoading || allMoQuery.isLoading || allCpQuery.isLoading;
  const grandTotal = Object.values(monthlyTotals).reduce((s, v) => s + v, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground" dir="rtl">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>جاري تحميل بيانات المشاريع...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground" dir="rtl">
        <Layers className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">لا توجد مشاريع مسجلة</p>
        <p className="text-sm">أضف مشاريع من بطاقة المشروع لتظهر هنا</p>
      </div>
    );
  }

  // Table total width: total col + date col + (n projects * col width) + gaps
  const tableW = TOTAL_COL_W + DATE_COL_W + columns.length * (COL_W + GAP);

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowRight className="w-4 h-4" />
              رجوع
            </Button>
          )}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
          >
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">مشاريع كومو — جدولة رأس المال</h1>
            <p className="text-xs text-muted-foreground">
              {TOTAL_MONTHS} شهراً · ابتداءً من أبريل 2026 · {projects.length} مشروع
            </p>
          </div>
        </div>

        {/* Grouping buttons */}
        <div className="flex items-center gap-2">
          {([1, 3, 6] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: groupBy === g ? "2px solid #f97316" : "2px solid #cbd5e1",
                background: groupBy === g ? "#f97316" : "#f8fafc",
                color: groupBy === g ? "#fff" : "#475569",
                transition: "all 0.15s",
              }}
            >
              {g === 1 ? "شهري" : g === 3 ? "ربع سنوي" : "نصف سنوي"}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          {[
            { phase: "preCon", label: "ما قبل التنفيذ" },
            { phase: "construction", label: "الإنشاء" },
            { phase: "handover", label: "التسليم" },
          ].map(({ phase, label }) => (
            <div key={phase} className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded"
                style={{ background: PHASE_BG[phase], border: "1px solid rgba(0,0,0,0.15)" }}
              />
              <span style={{ color: PHASE_TEXT[phase], fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gantt chart table
          Column order (RTL): projects... | الشهر | الإجمالي الشهري
          The full row has a background color; each project column is a "pillar" on top of it.
      */}
      <div
        className="overflow-auto rounded-xl border border-border shadow-sm"
        style={{ maxHeight: "65vh" }}
      >
        <table
          style={{
            width: tableW,
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
            direction: "rtl",
          }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 20 }}>
              {/* Project column headers — rightmost group */}
              {columns.map((col, ci) => (
                <th
                  key={col.id}
                  style={{
                    width: COL_W,
                    minWidth: COL_W,
                    background: "#1e293b",
                    color: "#f8fafc",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "8px 4px",
                    textAlign: "center",
                    borderLeft: ci < columns.length - 1 ? `${GAP}px solid #94a3b8` : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={col.name}
                >
                  {col.name}
                </th>
              ))}

              {/* Date column header — between projects and total */}
              <th
                style={{
                  width: DATE_COL_W,
                  minWidth: DATE_COL_W,
                  background: "#334155",
                  color: "#e2e8f0",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "8px 6px",
                  textAlign: "center",
                  borderLeft: `${GAP}px solid #94a3b8`,
                  borderRight: `${GAP}px solid #94a3b8`,
                }}
              >
                الشهر
              </th>
              {/* Total column header — leftmost */}
              <th
                style={{
                  width: TOTAL_COL_W,
                  minWidth: TOTAL_COL_W,
                  background: "#1e293b",
                  color: "#fbbf24",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                الإجمالي
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((row) => {
              const rowBg = row.gi % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD;
              const rowH  = groupBy === 1 ? ROW_H : groupBy === 3 ? 44 : 52;
              return (
                <tr key={row.gi} style={{ height: rowH, background: rowBg }}>
                  {/* Project pillar cells */}
                  {row.colData.map((cd, ci) => {
                    const pillarBg  = cd.phase ? PHASE_BG[cd.phase] : PILLAR_INACTIVE;
                    const textColor = cd.phase ? PHASE_TEXT[cd.phase] : "#475569";
                    const borderColor = cd.phase ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)";
                    return (
                      <td
                        key={cd.colId}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          background: pillarBg,
                          borderLeft: ci < columns.length - 1 ? `${GAP}px solid ${rowBg}` : "none",
                          borderTop: `1px solid ${borderColor}`,
                          borderBottom: `1px solid ${borderColor}`,
                          padding: "0 6px",
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: cd.amount > 0 ? 700 : 400,
                          color: cd.amount > 0 ? textColor : (cd.phase ? "rgba(0,0,0,0.25)" : "transparent"),
                        }}
                      >
                        {cd.amount > 0 ? fmtCell(cd.amount) : (cd.phase ? "—" : "")}
                      </td>
                    );
                  })}

                  {/* Date cell */}
                  <td
                    style={{
                      width: DATE_COL_W,
                      minWidth: DATE_COL_W,
                      fontSize: groupBy === 1 ? 10 : 9,
                      fontWeight: 600,
                      color: "#1e293b",
                      padding: "0 4px",
                      textAlign: "center",
                      borderLeft: `${GAP}px solid ${rowBg}`,
                      borderRight: `${GAP}px solid ${rowBg}`,
                      background: row.gi % 2 === 0 ? "#cbd5e1" : "#b0bec5",
                      whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                      lineHeight: 1.3,
                    }}
                  >
                    {row.label}
                  </td>

                  {/* Total cell */}
                  <td
                    style={{
                      width: TOTAL_COL_W,
                      minWidth: TOTAL_COL_W,
                      background: row.total > 0 ? "#fef3c7" : rowBg,
                      borderRight: "3px solid #f59e0b",
                      padding: "0 6px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#f59e0b" : "transparent",
                    }}
                  >
                    {row.total > 0 ? fmtCell(row.total) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
