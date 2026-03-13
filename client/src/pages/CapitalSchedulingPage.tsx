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

// Phase colors — professional dark palette
const PHASE_BG: Record<string, string> = {
  preCon:       "#1e3a5f", // deep navy
  construction: "#14532d", // deep green
  handover:     "#7c2d12", // deep burnt orange
};
const PHASE_TEXT: Record<string, string> = {
  preCon:       "#93c5fd", // light blue text on dark navy
  construction: "#86efac", // light green text on dark green
  handover:     "#fdba74", // light orange text on dark burnt
};

// Row background — dark slate alternating
const ROW_BG_EVEN = "#1e293b";
const ROW_BG_ODD  = "#0f172a";

// Pillar inner background — dark card on dark row
const PILLAR_INACTIVE = "rgba(255,255,255,0.04)";

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
  const GAP         = 3;   // gap between project pillars (px)

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

      {/* Summary cards — total / paid / remaining per project */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length + 1, 4)}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <div key={col.id} className="rounded-xl border border-border p-3 bg-card shadow-sm space-y-1.5">
            <p className="text-[11px] text-muted-foreground truncate font-semibold" title={col.name}>{col.name}</p>
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">إجمالي رأس المال</span>
              <span className="text-[12px] font-bold text-foreground">
                {col.totalCapital > 0 ? `${(col.totalCapital / 1_000_000).toFixed(2)}M` : "—"}
              </span>
            </div>
            {/* Paid */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-green-400">المدفوع</span>
              <span className="text-[12px] font-bold text-green-500">
                {col.paidCapital > 0 ? `${(col.paidCapital / 1_000_000).toFixed(2)}M` : "—"}
              </span>
            </div>
            {/* Remaining */}
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-[10px] text-amber-400 font-semibold">المطلوب سداده</span>
              <span className="text-[13px] font-extrabold text-amber-400">
                {col.remainingCapital > 0 ? `${(col.remainingCapital / 1_000_000).toFixed(2)}M` : "—"}
              </span>
            </div>
            {/* Phase badges */}
            <div className="flex gap-1 flex-wrap pt-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: PHASE_BG.preCon, color: PHASE_TEXT.preCon }}>{col.preConMonths}ش قبل</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: PHASE_BG.construction, color: PHASE_TEXT.construction }}>{col.constructionMonths}ش إنشاء</span>
            </div>
          </div>
        ))}
        {/* Grand total card */}
        <div className="rounded-xl border-2 border-amber-400 p-3 bg-amber-950/30 shadow-sm space-y-1.5">
          <p className="text-[11px] text-amber-400 font-semibold">الإجمالي الكلي — جميع المشاريع</p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">إجمالي رأس المال</span>
            <span className="text-[12px] font-bold text-foreground">
              {columns.reduce((s,c) => s+c.totalCapital,0) > 0
                ? `${(columns.reduce((s,c) => s+c.totalCapital,0)/1_000_000).toFixed(2)}M` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-green-400">المدفوع</span>
            <span className="text-[12px] font-bold text-green-500">
              {columns.reduce((s,c) => s+c.paidCapital,0) > 0
                ? `${(columns.reduce((s,c) => s+c.paidCapital,0)/1_000_000).toFixed(2)}M` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-amber-400/30 pt-1.5">
            <span className="text-[10px] text-amber-400 font-semibold">المطلوب سداده</span>
            <span className="text-[14px] font-extrabold text-amber-400">
              {columns.reduce((s,c) => s+c.remainingCapital,0) > 0
                ? `${(columns.reduce((s,c) => s+c.remainingCapital,0)/1_000_000).toFixed(2)}M` : "—"}
            </span>
          </div>
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
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "8px 4px",
                    textAlign: "center",
                    borderLeft: ci < columns.length - 1 ? `${GAP}px solid #1e293b` : "none",
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
                  background: "#1e293b",
                  color: "#94a3b8",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "8px 6px",
                  textAlign: "center",
                  borderLeft: "2px solid #334155",
                  borderRight: "2px solid #334155",
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
                  color: "#f59e0b",
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
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#94a3b8",
                      padding: "0 6px",
                      textAlign: "center",
                      borderLeft: "2px solid #334155",
                      borderRight: "2px solid #334155",
                      background: absIdx % 2 === 0 ? "#1e293b" : "#172032",
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
                      background: total > 0 ? "#292524" : rowBg,
                      borderRight: "2px solid #f59e0b",
                      padding: "0 6px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: total > 0 ? 800 : 400,
                      color: total > 0 ? "#f59e0b" : "transparent",
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
