import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers, ChevronDown, ChevronUp } from "lucide-react";
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

function fmtCell(n: number): string {
  if (n === 0) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

interface ProjectColumn {
  id: number;
  name: string;
  baseStartOffset: number;   // original start (always 0 = April 2026)
  preConMonths: number;
  constructionMonths: number;
  relativeMonthly: Record<number, number>; // relative month → amount (before any delay)
  durations: PhaseDurations;
}

// ── Colors ─────────────────────────────────────────────────────────────────
// Phase colors
const PHASE_BG: Record<string, string> = {
  preCon:       "#c8e6c9", // light green
  construction: "#f8bbd0", // pink
  handover:     "#ffe082", // amber
};
const PHASE_TEXT: Record<string, string> = {
  preCon:       "#1b5e20",
  construction: "#880e4f",
  handover:     "#4e2500",
};
// Column header: yellow-green gradient
const COL_HEADER_BG = "linear-gradient(135deg, #d4e157, #aed581)";
const COL_HEADER_TEXT = "#1b5e20";
// Row backgrounds
const ROW_BG_EVEN = "#ffffff";
const ROW_BG_ODD  = "#f9f9f9";
// Inactive pillar cell
const PILLAR_INACTIVE = "rgba(255,255,255,0.85)";
// Gap color: white
const GAP_COLOR = "#ffffff";

// ── Delay state ─────────────────────────────────────────────────────────────
// delayMode: 'full' = shift entire project, 'construction' = shift construction phase only
interface DelayState {
  fullDelay: number;        // extra months added to entire project start
  constructionDelay: number; // extra months added to construction start (on top of fullDelay)
}

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

  // Build base columns (without delay)
  const baseColumns = useMemo<ProjectColumn[]>(() => {
    return projects.map((project) => {
      const mo    = allMo.find((m: any) => m.projectId === project.id);
      const cp    = allCp.find((c: any) => c.projectId === project.id);
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

      return {
        id: project.id,
        name: project.name,
        baseStartOffset: 0, // all projects start April 2026
        preConMonths,
        constructionMonths,
        relativeMonthly,
        durations,
      };
    });
  }, [projects, allMo, allCp]);

  // Delay state per project
  const [delays, setDelays] = useState<Record<number, DelayState>>({});

  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { fullDelay: 0, constructionDelay: 0 };
  }

  function adjustFullDelay(projectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[projectId] || { fullDelay: 0, constructionDelay: 0 };
      const newFull = Math.max(0, cur.fullDelay + delta);
      return { ...prev, [projectId]: { ...cur, fullDelay: newFull } };
    });
  }

  function adjustConstructionDelay(projectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[projectId] || { fullDelay: 0, constructionDelay: 0 };
      const newConst = Math.max(0, cur.constructionDelay + delta);
      return { ...prev, [projectId]: { ...cur, constructionDelay: newConst } };
    });
  }

  // Build effective monthly amounts applying delays
  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const { fullDelay, constructionDelay } = getDelay(col.id);
      const preConEnd = col.preConMonths;
      const constrStart = preConEnd + 1;

      const monthlyAmounts: Record<number, number> = {};
      for (const [relStr, val] of Object.entries(col.relativeMonthly)) {
        const rel = parseInt(relStr);
        let absIdx: number;
        if (rel <= preConEnd) {
          // Pre-construction: shift by fullDelay only
          absIdx = col.baseStartOffset + fullDelay + rel - 1;
        } else {
          // Construction + handover: shift by fullDelay + constructionDelay
          absIdx = col.baseStartOffset + fullDelay + constructionDelay + rel - 1;
        }
        if (absIdx >= 0 && absIdx < TOTAL_MONTHS) {
          monthlyAmounts[absIdx] = (monthlyAmounts[absIdx] || 0) + val;
        }
      }

      return { ...col, monthlyAmounts, fullDelay, constructionDelay };
    });
  }, [baseColumns, delays]);

  // Monthly totals across all projects
  const monthlyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const col of effectiveColumns) {
      for (const [absIdx, val] of Object.entries(col.monthlyAmounts)) {
        const idx = parseInt(absIdx);
        totals[idx] = (totals[idx] || 0) + val;
      }
    }
    return totals;
  }, [effectiveColumns]);

  // Get phase for a given absolute month index, considering delays
  function getPhase(col: typeof effectiveColumns[0], absIdx: number): string | null {
    const { fullDelay, constructionDelay } = col;
    const preConStart  = col.baseStartOffset + fullDelay;
    const preConEnd    = preConStart + col.preConMonths - 1;
    const constrStart  = col.baseStartOffset + fullDelay + constructionDelay + col.preConMonths;
    const constrEnd    = constrStart + col.constructionMonths - 1;
    const handoverEnd  = constrEnd + 2;

    if (absIdx >= preConStart && absIdx <= preConEnd) return "preCon";
    if (absIdx >= constrStart && absIdx <= constrEnd) return "construction";
    if (absIdx > constrEnd && absIdx <= handoverEnd) return "handover";
    return null;
  }

  // Column widths
  const TOTAL_COL_W = 90;
  const DATE_COL_W  = 90;
  const COL_W       = 90;
  const ROW_H       = 34;
  const GAP         = 24;

  // Grouping: 1 = monthly, 3 = quarterly, 6 = semi-annual
  const [groupBy, setGroupBy] = useState<1 | 3 | 6>(1);

  // Build grouped rows
  const groupedRows = useMemo(() => {
    const numGroups = Math.ceil(TOTAL_MONTHS / groupBy);
    return Array.from({ length: numGroups }, (_, gi) => {
      const startIdx = gi * groupBy;
      const endIdx   = Math.min(startIdx + groupBy - 1, TOTAL_MONTHS - 1);
      const label = groupBy === 1
        ? getMonthLabel(startIdx)
        : `${getMonthLabel(startIdx)} — ${getMonthLabel(endIdx)}`;
      const total = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => monthlyTotals[startIdx + i] || 0)
        .reduce((s, v) => s + v, 0);
      const colData = effectiveColumns.map((col) => {
        const amount = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => col.monthlyAmounts[startIdx + i] || 0)
          .reduce((s, v) => s + v, 0);
        const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);
        const phase  = getPhase(col, midIdx);
        return { colId: col.id, amount, phase };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [effectiveColumns, monthlyTotals, groupBy]);

  const isLoading = projectsQuery.isLoading || allMoQuery.isLoading || allCpQuery.isLoading;

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

  // Table total width
  const tableW = TOTAL_COL_W + DATE_COL_W + effectiveColumns.length * (COL_W + GAP) + GAP * 2;

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

      {/* Gantt chart table */}
      <div
        className="overflow-auto rounded-xl border border-border shadow-sm"
        style={{ maxHeight: "70vh" }}
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
            {/* Row 1: project names + delay controls */}
            <tr style={{ position: "sticky", top: 0, zIndex: 20 }}>
              {effectiveColumns.map((col, ci) => {
                const delay = getDelay(col.id);
                return (
                  <th
                    key={col.id}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      background: COL_HEADER_BG,
                      color: COL_HEADER_TEXT,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "4px 2px 2px",
                      textAlign: "center",
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid ${GAP_COLOR}` : "none",
                      overflow: "hidden",
                      verticalAlign: "top",
                    }}
                    title={col.name}
                  >
                    {/* Project name */}
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                      {col.name}
                    </div>
                    {/* Delay controls: Full project */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 2 }}>
                      <button
                        onClick={() => adjustFullDelay(col.id, -3)}
                        disabled={delay.fullDelay === 0}
                        title="تقديم المشروع 3 أشهر"
                        style={{
                          width: 16, height: 16, borderRadius: 3, border: "1px solid #558b2f",
                          background: delay.fullDelay === 0 ? "#e8f5e9" : "#558b2f",
                          color: delay.fullDelay === 0 ? "#aaa" : "#fff",
                          cursor: delay.fullDelay === 0 ? "default" : "pointer",
                          fontSize: 10, lineHeight: 1, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronUp style={{ width: 10, height: 10 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "#33691e", minWidth: 28, textAlign: "center" }}>
                        {delay.fullDelay > 0 ? `+${delay.fullDelay}ش` : "كامل"}
                      </span>
                      <button
                        onClick={() => adjustFullDelay(col.id, 3)}
                        title="تأجيل المشروع 3 أشهر"
                        style={{
                          width: 16, height: 16, borderRadius: 3, border: "1px solid #558b2f",
                          background: "#558b2f", color: "#fff",
                          cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronDown style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                    {/* Delay controls: Construction only */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      <button
                        onClick={() => adjustConstructionDelay(col.id, -3)}
                        disabled={delay.constructionDelay === 0}
                        title="تقديم الإنشاء 3 أشهر"
                        style={{
                          width: 16, height: 16, borderRadius: 3, border: "1px solid #880e4f",
                          background: delay.constructionDelay === 0 ? "#fce4ec" : "#880e4f",
                          color: delay.constructionDelay === 0 ? "#aaa" : "#fff",
                          cursor: delay.constructionDelay === 0 ? "default" : "pointer",
                          fontSize: 10, lineHeight: 1, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronUp style={{ width: 10, height: 10 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "#880e4f", minWidth: 28, textAlign: "center" }}>
                        {delay.constructionDelay > 0 ? `+${delay.constructionDelay}ش` : "إنشاء"}
                      </span>
                      <button
                        onClick={() => adjustConstructionDelay(col.id, 3)}
                        title="تأجيل الإنشاء 3 أشهر"
                        style={{
                          width: 16, height: 16, borderRadius: 3, border: "1px solid #880e4f",
                          background: "#880e4f", color: "#fff",
                          cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronDown style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  </th>
                );
              })}

              {/* Date column header */}
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
                  borderLeft: `${GAP}px solid ${GAP_COLOR}`,
                  borderRight: `${GAP}px solid ${GAP_COLOR}`,
                }}
              >
                الشهر
              </th>
              {/* Total column header */}
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
                    const borderColor = cd.phase ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.04)";
                    return (
                      <td
                        key={cd.colId}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          background: pillarBg,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid ${GAP_COLOR}` : "none",
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
                      borderLeft: `${GAP}px solid ${GAP_COLOR}`,
                      borderRight: `${GAP}px solid ${GAP_COLOR}`,
                      background: row.gi % 2 === 0 ? "#e2e8f0" : "#cbd5e1",
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
                      color: row.total > 0 ? "#b45309" : "transparent",
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
