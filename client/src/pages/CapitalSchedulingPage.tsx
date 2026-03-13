import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculatePhases,
  getInvestorExpenses,
  distributeExpense,
  getDefaultCustomDistribution,
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
}

// Phase colors for the pillar cells
const PHASE_BG: Record<string, string> = {
  preCon: "#bfdbfe",       // blue-200
  construction: "#bbf7d0", // green-200
  handover: "#fef08a",     // yellow-200
};
const PHASE_TEXT: Record<string, string> = {
  preCon: "#1e40af",
  construction: "#166534",
  handover: "#854d0e",
};

// Row background — alternating subtle stripes for the full row
const ROW_BG_EVEN = "#f0f4f8";
const ROW_BG_ODD  = "#e8edf3";

// Pillar inner background — slightly lighter than row so pillar stands out
const PILLAR_INACTIVE = "rgba(255,255,255,0.55)"; // inside pillar, no phase active

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

export default function CapitalSchedulingPage({ onBack }: Props) {
  const { isAuthenticated } = useAuth();

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const allMoQuery    = trpc.marketOverview.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60000 });
  const allCpQuery    = trpc.competitionPricing.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60000 });

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);
  const allMo    = useMemo(() => allMoQuery.data || [], [allMoQuery.data]);
  const allCp    = useMemo(() => allCpQuery.data || [], [allCpQuery.data]);

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

      return { id: project.id, name: project.name, startOffset, preConMonths, constructionMonths, monthlyAmounts };
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

  // Column widths
  const TOTAL_COL_W = 130; // leftmost: الإجمالي الشهري
  const DATE_COL_W  = 120; // second from left: الشهر
  const COL_W       = 150; // each project
  const ROW_H       = 38;
  const GAP         = 4;   // gap between project pillars (px)

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

      {/* Summary cards */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length + 1, 6)}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => {
          const total = Object.values(col.monthlyAmounts).reduce((s, v) => s + v, 0);
          return (
            <div key={col.id} className="rounded-xl border border-border p-3 bg-card shadow-sm">
              <p className="text-[11px] text-muted-foreground truncate font-medium" title={col.name}>{col.name}</p>
              <p className="text-base font-bold text-foreground mt-0.5">
                {total > 0 ? `${(total / 1_000_000).toFixed(2)}M` : "—"}
              </p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: PHASE_BG.preCon, color: PHASE_TEXT.preCon }}>{col.preConMonths}ش قبل</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: PHASE_BG.construction, color: PHASE_TEXT.construction }}>{col.constructionMonths}ش إنشاء</span>
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border-2 border-amber-400 p-3 bg-amber-50 dark:bg-amber-950 shadow-sm">
          <p className="text-[11px] text-amber-700 font-semibold">الإجمالي الكلي</p>
          <p className="text-base font-bold text-amber-800 mt-0.5">
            {grandTotal > 0 ? `${(grandTotal / 1_000_000).toFixed(2)}M` : "—"}
          </p>
          <p className="text-[10px] text-amber-600 mt-1">جميع المشاريع</p>
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
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "10px 6px",
                    textAlign: "center",
                    borderLeft: ci < columns.length - 1 ? `${GAP}px solid #0f172a` : "none",
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
                  color: "#cbd5e1",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "10px 8px",
                  textAlign: "center",
                  borderLeft: "3px solid #0f172a",
                  borderRight: "3px solid #0f172a",
                }}
              >
                الشهر
              </th>

              {/* Total column header — leftmost */}
              <th
                style={{
                  width: TOTAL_COL_W,
                  minWidth: TOTAL_COL_W,
                  background: "#0f172a",
                  color: "#fbbf24",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                الإجمالي الشهري
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TOTAL_MONTHS }, (_, absIdx) => {
              const total   = monthlyTotals[absIdx] || 0;
              const rowBg   = absIdx % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD;

              return (
                <tr key={absIdx} style={{ height: ROW_H, background: rowBg }}>
                  {/* Project pillar cells */}
                  {columns.map((col, ci) => {
                    const phase  = getPhase(col, absIdx);
                    const amount = col.monthlyAmounts[absIdx] || 0;

                    // Pillar background: phase color if active, else semi-transparent white
                    const pillarBg    = phase ? PHASE_BG[phase] : PILLAR_INACTIVE;
                    const textColor   = phase ? PHASE_TEXT[phase] : "#94a3b8";
                    const borderColor = phase ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.6)";

                    return (
                      <td
                        key={col.id}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          background: pillarBg,
                          // Gap between pillars via right border (RTL: right = next sibling)
                          borderLeft: ci < columns.length - 1 ? `${GAP}px solid ${rowBg}` : "none",
                          borderTop: `1px solid ${borderColor}`,
                          borderBottom: `1px solid ${borderColor}`,
                          padding: "0 6px",
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: amount > 0 ? 700 : 400,
                          color: amount > 0 ? textColor : (phase ? "rgba(0,0,0,0.2)" : "transparent"),
                        }}
                      >
                        {amount > 0 ? fmtCell(amount) : (phase ? "—" : "")}
                      </td>
                    );
                  })}

                  {/* Date cell */}
                  <td
                    style={{
                      width: DATE_COL_W,
                      minWidth: DATE_COL_W,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#334155",
                      padding: "0 8px",
                      textAlign: "center",
                      borderLeft: "3px solid #94a3b8",
                      borderRight: "3px solid #94a3b8",
                      background: absIdx % 2 === 0 ? "#dde3ea" : "#d0d8e2",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getMonthLabel(absIdx)}
                  </td>

                  {/* Total cell */}
                  <td
                    style={{
                      width: TOTAL_COL_W,
                      minWidth: TOTAL_COL_W,
                      background: total > 0 ? "#fef3c7" : rowBg,
                      borderRight: "3px solid #fbbf24",
                      padding: "0 8px",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: total > 0 ? 800 : 400,
                      color: total > 0 ? "#92400e" : "transparent",
                    }}
                  >
                    {total > 0 ? fmtCell(total) : ""}
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
