import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
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

function fmtCell(n: number): string {
  if (n === 0) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

// ── Per-project gradient palettes (cylindrical feel) ──────────────────────
const PROJECT_PALETTES = [
  { preCon: ["#667eea","#764ba2"], construction: ["#f093fb","#f5576c"], handover: ["#4facfe","#00f2fe"], header: ["#667eea","#764ba2"] },
  { preCon: ["#43e97b","#38f9d7"], construction: ["#fa709a","#fee140"], handover: ["#30cfd0","#667eea"], header: ["#43e97b","#38f9d7"] },
  { preCon: ["#f7971e","#ffd200"], construction: ["#fc466b","#3f5efb"], handover: ["#11998e","#38ef7d"], header: ["#f7971e","#ffd200"] },
  { preCon: ["#a18cd1","#fbc2eb"], construction: ["#fd7043","#ff8a65"], handover: ["#26c6da","#00acc1"], header: ["#a18cd1","#fbc2eb"] },
  { preCon: ["#84fab0","#8fd3f4"], construction: ["#f6d365","#fda085"], handover: ["#89f7fe","#66a6ff"], header: ["#84fab0","#8fd3f4"] },
  { preCon: ["#d4fc79","#96e6a1"], construction: ["#f093fb","#f5576c"], handover: ["#ffecd2","#fcb69f"], header: ["#d4fc79","#96e6a1"] },
];

function getPalette(idx: number) {
  return PROJECT_PALETTES[idx % PROJECT_PALETTES.length];
}

function gradientStyle(colors: string[], angle = 160): string {
  return `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`;
}

interface ProjectColumn {
  id: number;
  name: string;
  preConMonths: number;
  constructionMonths: number;
  relativeMonthly: Record<number, number>;
  durations: PhaseDurations;
  paletteIdx: number;
}

interface DelayState {
  fullDelay: number;
  constructionDelay: number;
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

  const baseColumns = useMemo<ProjectColumn[]>(() => {
    return projects.map((project, idx) => {
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

      return { id: project.id, name: project.name, preConMonths, constructionMonths, relativeMonthly, durations, paletteIdx: idx };
    });
  }, [projects, allMo, allCp]);

  const [delays, setDelays] = useState<Record<number, DelayState>>({});

  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { fullDelay: 0, constructionDelay: 0 };
  }

  function adjustFullDelay(projectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[projectId] || { fullDelay: 0, constructionDelay: 0 };
      return { ...prev, [projectId]: { ...cur, fullDelay: Math.max(0, cur.fullDelay + delta) } };
    });
  }

  function adjustConstructionDelay(projectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[projectId] || { fullDelay: 0, constructionDelay: 0 };
      return { ...prev, [projectId]: { ...cur, constructionDelay: Math.max(0, cur.constructionDelay + delta) } };
    });
  }

  function resetDelay(projectId: number) {
    setDelays(prev => ({ ...prev, [projectId]: { fullDelay: 0, constructionDelay: 0 } }));
  }

  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const { fullDelay, constructionDelay } = getDelay(col.id);
      const preConEnd = col.preConMonths;

      const monthlyAmounts: Record<number, number> = {};
      for (const [relStr, val] of Object.entries(col.relativeMonthly)) {
        const rel = parseInt(relStr);
        let absIdx: number;
        if (rel <= preConEnd) {
          absIdx = fullDelay + rel - 1;
        } else {
          absIdx = fullDelay + constructionDelay + rel - 1;
        }
        if (absIdx >= 0 && absIdx < TOTAL_MONTHS) {
          monthlyAmounts[absIdx] = (monthlyAmounts[absIdx] || 0) + val;
        }
      }

      return { ...col, monthlyAmounts, fullDelay, constructionDelay };
    });
  }, [baseColumns, delays]);

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

  function getPhase(col: typeof effectiveColumns[0], absIdx: number): string | null {
    const { fullDelay, constructionDelay } = col;
    const preConStart = fullDelay;
    const preConEnd   = preConStart + col.preConMonths - 1;
    const constrStart = fullDelay + constructionDelay + col.preConMonths;
    const constrEnd   = constrStart + col.constructionMonths - 1;
    const handoverEnd = constrEnd + 2;

    if (absIdx >= preConStart && absIdx <= preConEnd) return "preCon";
    if (absIdx >= constrStart && absIdx <= constrEnd) return "construction";
    if (absIdx > constrEnd && absIdx <= handoverEnd) return "handover";
    return null;
  }

  const [groupBy, setGroupBy] = useState<1 | 3 | 6>(1);

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
        return { colId: col.id, amount, phase, paletteIdx: col.paletteIdx };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [effectiveColumns, monthlyTotals, groupBy]);

  const isLoading = projectsQuery.isLoading || allMoQuery.isLoading || allCpQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-purple-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل بيانات المشاريع...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400" dir="rtl">
        <Layers className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">لا توجد مشاريع مسجلة</p>
      </div>
    );
  }

  // Layout constants
  const COL_W      = 120;
  const DATE_COL_W = 100;
  const TOTAL_COL_W = 100;
  const GAP        = 12;   // white gap between columns
  const ROW_H      = groupBy === 1 ? 36 : groupBy === 3 ? 48 : 58;

  // Total table width
  const tableW = TOTAL_COL_W + GAP + DATE_COL_W + GAP + effectiveColumns.length * COL_W + (effectiveColumns.length - 1) * GAP;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100%",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        padding: "20px 16px",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10, padding: "6px 14px", color: "#e2e8f0", fontSize: 13,
                cursor: "pointer", backdropFilter: "blur(8px)",
              }}
            >
              <ArrowRight style={{ width: 14, height: 14 }} />
              رجوع
            </button>
          )}
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(249,115,22,0.5)",
            }}
          >
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
              مشاريع كومو — جدولة رأس المال
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
              {TOTAL_MONTHS} شهراً · أبريل 2026 — {getMonthLabel(TOTAL_MONTHS - 1)} · {projects.length} مشاريع
            </p>
          </div>
        </div>

        {/* Grouping + Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "ما قبل التنفيذ", colors: ["#667eea","#764ba2"] },
              { label: "الإنشاء",        colors: ["#f093fb","#f5576c"] },
              { label: "التسليم",        colors: ["#4facfe","#00f2fe"] },
            ].map(({ label, colors }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4,
                  background: gradientStyle(colors),
                  boxShadow: `0 2px 6px ${colors[0]}66`,
                }} />
                <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Grouping buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {([1, 3, 6] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s",
                  border: groupBy === g ? "none" : "1px solid rgba(255,255,255,0.2)",
                  background: groupBy === g
                    ? "linear-gradient(135deg, #f97316, #ea580c)"
                    : "rgba(255,255,255,0.08)",
                  color: groupBy === g ? "#fff" : "#94a3b8",
                  boxShadow: groupBy === g ? "0 4px 12px rgba(249,115,22,0.4)" : "none",
                }}
              >
                {g === 1 ? "شهري" : g === 3 ? "ربع سنوي" : "نصف سنوي"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gantt Table ──────────────────────────────────────────────────── */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "72vh",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
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
            <tr style={{ position: "sticky", top: 0, zIndex: 30 }}>
              {/* Project column headers */}
              {effectiveColumns.map((col, ci) => {
                const palette = getPalette(col.paletteIdx);
                const delay   = getDelay(col.id);
                const hasDelay = delay.fullDelay > 0 || delay.constructionDelay > 0;
                return (
                  <th
                    key={col.id}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      background: gradientStyle(palette.header, 135),
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid transparent` : "none",
                      padding: "10px 6px 8px",
                      verticalAlign: "top",
                      position: "relative",
                    }}
                  >
                    {/* Cylindrical top cap */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 8,
                      background: "rgba(255,255,255,0.25)",
                      borderRadius: "8px 8px 0 0",
                    }} />

                    {/* Project name */}
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: "#fff",
                      textAlign: "center", lineHeight: 1.4,
                      textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      marginBottom: 8, padding: "0 2px",
                      wordBreak: "break-word",
                    }}>
                      {col.name}
                    </div>

                    {/* Delay info badge */}
                    {hasDelay && (
                      <div style={{
                        background: "rgba(0,0,0,0.3)", borderRadius: 6,
                        padding: "2px 6px", marginBottom: 6, textAlign: "center",
                        fontSize: 9, color: "#fde68a", fontWeight: 700,
                      }}>
                        {delay.fullDelay > 0 && `كامل +${delay.fullDelay}ش`}
                        {delay.fullDelay > 0 && delay.constructionDelay > 0 && " · "}
                        {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                      </div>
                    )}

                    {/* Full project delay controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                      <button
                        onClick={() => adjustFullDelay(col.id, -3)}
                        disabled={delay.fullDelay === 0}
                        title="تقديم المشروع 3 أشهر"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: delay.fullDelay === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)",
                          border: "none", cursor: delay.fullDelay === 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: delay.fullDelay === 0 ? "rgba(255,255,255,0.3)" : "#334155",
                          boxShadow: delay.fullDelay === 0 ? "none" : "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        <ChevronUp style={{ width: 12, height: 12 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", minWidth: 30, textAlign: "center", fontWeight: 700 }}>
                        المشروع
                      </span>
                      <button
                        onClick={() => adjustFullDelay(col.id, 3)}
                        title="تأجيل المشروع 3 أشهر"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: "rgba(255,255,255,0.9)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#334155",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        <ChevronDown style={{ width: 12, height: 12 }} />
                      </button>
                    </div>

                    {/* Construction delay controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                      <button
                        onClick={() => adjustConstructionDelay(col.id, -3)}
                        disabled={delay.constructionDelay === 0}
                        title="تقديم الإنشاء 3 أشهر"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: delay.constructionDelay === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)",
                          border: "none", cursor: delay.constructionDelay === 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: delay.constructionDelay === 0 ? "rgba(255,255,255,0.3)" : "#334155",
                          boxShadow: delay.constructionDelay === 0 ? "none" : "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        <ChevronUp style={{ width: 12, height: 12 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", minWidth: 30, textAlign: "center", fontWeight: 700 }}>
                        الإنشاء
                      </span>
                      <button
                        onClick={() => adjustConstructionDelay(col.id, 3)}
                        title="تأجيل الإنشاء 3 أشهر"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: "rgba(255,255,255,0.9)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#334155",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        <ChevronDown style={{ width: 12, height: 12 }} />
                      </button>
                    </div>

                    {/* Reset button */}
                    {hasDelay && (
                      <div style={{ textAlign: "center" }}>
                        <button
                          onClick={() => resetDelay(col.id)}
                          title="إعادة ضبط"
                          style={{
                            background: "rgba(255,255,255,0.2)", border: "none",
                            borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                            fontSize: 9, color: "#fff", fontWeight: 700,
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}
                        >
                          <RotateCcw style={{ width: 8, height: 8 }} />
                          إعادة
                        </button>
                      </div>
                    )}
                  </th>
                );
              })}

              {/* Date column header */}
              <th
                style={{
                  width: DATE_COL_W,
                  minWidth: DATE_COL_W,
                  background: "linear-gradient(135deg, #1e293b, #334155)",
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "16px 6px",
                  textAlign: "center",
                  borderLeft: `${GAP}px solid transparent`,
                  borderRight: `${GAP}px solid transparent`,
                  letterSpacing: "0.5px",
                }}
              >
                📅 الشهر
              </th>

              {/* Total column header */}
              <th
                style={{
                  width: TOTAL_COL_W,
                  minWidth: TOTAL_COL_W,
                  background: "linear-gradient(135deg, #b45309, #d97706)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "16px 6px",
                  textAlign: "center",
                  letterSpacing: "0.5px",
                  boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.2)",
                }}
              >
                💰 الإجمالي
              </th>
            </tr>
          </thead>

          <tbody>
            {groupedRows.map((row) => {
              const isEven = row.gi % 2 === 0;
              return (
                <tr key={row.gi}>
                  {/* Project pillar cells */}
                  {row.colData.map((cd, ci) => {
                    const palette = getPalette(cd.paletteIdx);
                    let bg = "rgba(255,255,255,0.04)";
                    let textColor = "rgba(255,255,255,0.2)";
                    let shadow = "none";

                    if (cd.phase === "preCon") {
                      bg = gradientStyle(palette.preCon, 160);
                      textColor = "#fff";
                      shadow = `0 2px 8px ${palette.preCon[0]}55`;
                    } else if (cd.phase === "construction") {
                      bg = gradientStyle(palette.construction, 160);
                      textColor = "#fff";
                      shadow = `0 2px 8px ${palette.construction[0]}55`;
                    } else if (cd.phase === "handover") {
                      bg = gradientStyle(palette.handover, 160);
                      textColor = "#1e293b";
                      shadow = `0 2px 8px ${palette.handover[0]}55`;
                    }

                    return (
                      <td
                        key={cd.colId}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          height: ROW_H,
                          background: bg,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid transparent` : "none",
                          borderTop: "1px solid rgba(255,255,255,0.04)",
                          borderBottom: "1px solid rgba(0,0,0,0.1)",
                          padding: "0 6px",
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: cd.amount > 0 ? 800 : 400,
                          color: textColor,
                          textShadow: cd.amount > 0 ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                          boxShadow: shadow,
                          transition: "all 0.15s",
                        }}
                      >
                        {cd.amount > 0 ? fmtCell(cd.amount) : (cd.phase ? "·" : "")}
                      </td>
                    );
                  })}

                  {/* Date cell */}
                  <td
                    style={{
                      width: DATE_COL_W,
                      minWidth: DATE_COL_W,
                      height: ROW_H,
                      fontSize: groupBy === 1 ? 10 : 9,
                      fontWeight: 700,
                      color: "#e2e8f0",
                      padding: "0 6px",
                      textAlign: "center",
                      borderLeft: `${GAP}px solid transparent`,
                      borderRight: `${GAP}px solid transparent`,
                      background: isEven ? "rgba(51,65,85,0.8)" : "rgba(30,41,59,0.8)",
                      whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                      lineHeight: 1.3,
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {row.label}
                  </td>

                  {/* Total cell */}
                  <td
                    style={{
                      width: TOTAL_COL_W,
                      minWidth: TOTAL_COL_W,
                      height: ROW_H,
                      background: row.total > 0
                        ? "linear-gradient(135deg, rgba(180,83,9,0.6), rgba(217,119,6,0.6))"
                        : "rgba(255,255,255,0.02)",
                      padding: "0 6px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#fde68a" : "transparent",
                      textShadow: row.total > 0 ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      borderRight: "3px solid rgba(217,119,6,0.5)",
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
