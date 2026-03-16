import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

const TOTAL_MONTHS = 48;
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

function fmtFull(n: number): string {
  if (n === 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

// ── Phase colors (from platform palette) ─────────────────────────────
// Teal for pre-construction, Amber/Orange for construction
const PRE_CON_SOLID  = "#0d9488"; // teal-600
const PRE_CON_LIGHT  = "#ccfbf1"; // teal-100
const PRE_CON_TEXT   = "#115e59"; // teal-800
const CONSTR_SOLID   = "#d97706"; // amber-600
const CONSTR_LIGHT   = "#fef3c7"; // amber-100
const CONSTR_TEXT    = "#92400e"; // amber-800

interface ProjectColumn {
  cfProjectId: number | null;
  projectId: number;
  name: string;
  startDate: string;
  preDevMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  monthlyAmounts: number[];
  grandTotal: number;
  paidTotal: number;
  upcomingTotal: number;
}

interface DelayState {
  fullDelay: number;
  constructionDelay: number;
}

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

function projectMonthToChartIndex(
  startDate: string,
  relativeMonth: number
): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const chartStartYear = 2026;
  const chartStartMonth = 4;
  const absYear = sy + Math.floor((sm - 1 + relativeMonth) / 12);
  const absMonth = ((sm - 1 + relativeMonth) % 12) + 1;
  return (absYear - chartStartYear) * 12 + (absMonth - chartStartMonth);
}

export default function CapitalSchedulingPage({ onBack }: Props) {
  const { isAuthenticated } = useAuth();

  const scheduleQuery = trpc.cashFlowProgram.getCapitalScheduleData.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 60000 }
  );

  const rawData = useMemo(() => scheduleQuery.data || [], [scheduleQuery.data]);
  const baseColumns = useMemo<ProjectColumn[]>(() => rawData as ProjectColumn[], [rawData]);

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

  // Determine which months are "paid" (past) based on today's date
  function getMonthPaidStatus(col: ProjectColumn): boolean[] {
    const today = new Date();
    const parts = col.startDate.split("-").map(Number);
    const sy = parts[0];
    const sm = parts[1] || 4;
    const totalMonths = col.monthlyAmounts.length;
    const paidStatus: boolean[] = [];
    paidStatus.push(true); // land month always paid
    for (let m = 1; m < totalMonths; m++) {
      const calYear = sy + Math.floor((sm - 1 + m - 1) / 12);
      const calMonth = ((sm - 1 + m - 1) % 12) + 1;
      const endOfMonth = new Date(calYear, calMonth, 1);
      paidStatus.push(endOfMonth <= today);
    }
    return paidStatus;
  }

  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const { fullDelay, constructionDelay } = getDelay(col.projectId);
      const hasDelay = fullDelay > 0 || constructionDelay > 0;
      const paidStatus = getMonthPaidStatus(col);
      const chartAmounts: Record<number, number> = {};

      col.monthlyAmounts.forEach((val, idx) => {
        if (val <= 0) return;
        if (hasDelay && paidStatus[idx]) return;

        let chartIdx: number;
        if (idx === 0) {
          const baseChartIdx = projectMonthToChartIndex(col.startDate, 0) - 1;
          chartIdx = baseChartIdx + fullDelay;
        } else {
          const relIdx = idx - 1;
          if (relIdx < col.preDevMonths) {
            const baseChartIdx = projectMonthToChartIndex(col.startDate, relIdx);
            chartIdx = baseChartIdx + fullDelay;
          } else {
            const baseChartIdx = projectMonthToChartIndex(col.startDate, relIdx);
            chartIdx = baseChartIdx + fullDelay + constructionDelay;
          }
        }
        if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
          chartAmounts[chartIdx] = (chartAmounts[chartIdx] || 0) + val;
        }
      });

      return { ...col, chartAmounts, fullDelay, constructionDelay };
    });
  }, [baseColumns, delays]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const col of effectiveColumns) {
      for (const [absIdx, val] of Object.entries(col.chartAmounts)) {
        const idx = parseInt(absIdx);
        totals[idx] = (totals[idx] || 0) + val;
      }
    }
    return totals;
  }, [effectiveColumns]);

  function getPhase(col: typeof effectiveColumns[0], chartIdx: number): string | null {
    const { fullDelay, constructionDelay } = col;
    const baseStart = projectMonthToChartIndex(col.startDate, 0);
    const preDevStart  = baseStart + fullDelay;
    const preDevEnd    = preDevStart + col.preDevMonths - 1;
    const constrStart  = preDevEnd + 1 + constructionDelay;
    const constrEnd    = constrStart + col.constructionMonths - 1;
    const handoverEnd  = constrEnd + col.handoverMonths;

    if (chartIdx >= preDevStart && chartIdx <= preDevEnd) return "preCon";
    if (chartIdx >= constrStart && chartIdx <= constrEnd) return "construction";
    if (chartIdx > constrEnd && chartIdx <= handoverEnd) return "handover";
    return null;
  }

  function getPhasePosition(col: typeof effectiveColumns[0], chartIdx: number): { isFirst: boolean; isLast: boolean } {
    const phase = getPhase(col, chartIdx);
    if (!phase) return { isFirst: false, isLast: false };
    const prevPhase = chartIdx > 0 ? getPhase(col, chartIdx - 1) : null;
    const nextPhase = chartIdx < TOTAL_MONTHS - 1 ? getPhase(col, chartIdx + 1) : null;
    return {
      isFirst: prevPhase !== phase,
      isLast: nextPhase !== phase,
    };
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
        const amount = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => col.chartAmounts[startIdx + i] || 0)
          .reduce((s, v) => s + v, 0);
        const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);
        const phase  = getPhase(col, midIdx);
        const { isFirst, isLast } = getPhasePosition(col, midIdx);
        return { colId: col.projectId, amount, phase, isFirst, isLast };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [effectiveColumns, monthlyTotals, groupBy]);

  // Compute cumulative totals for each grouped row
  const cumulativeTotals = useMemo(() => {
    const cumulative: number[] = [];
    let running = 0;
    for (const row of groupedRows) {
      running += row.total;
      cumulative.push(running);
    }
    return cumulative;
  }, [groupedRows]);

  const isLoading = scheduleQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-teal-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل بيانات المشاريع...</p>
        </div>
      </div>
    );
  }

  if (baseColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400" dir="rtl">
        <Layers className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">لا توجد مشاريع مسجلة في نظام التدفق النقدي</p>
      </div>
    );
  }

  // All columns same width
  const COL_W       = 130;
  const GAP         = 10;
  const ROW_H       = groupBy === 1 ? 34 : groupBy === 3 ? 46 : 56;
  const CURVE       = 14;

  const totalCols = effectiveColumns.length + 3; // projects + date + total + cumulative
  const tableW = totalCols * COL_W + (totalCols - 1) * GAP;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100%",
        background: "#f8fafb",
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
                background: "#ffffff", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "6px 14px", color: "#475569", fontSize: 13,
                cursor: "pointer",
              }}
            >
              <ArrowRight style={{ width: 14, height: 14 }} />
              رجوع
            </button>
          )}
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(20,184,166,0.25)",
            }}
          >
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              مشاريع كومو — جدولة رأس المال
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              {TOTAL_MONTHS} شهراً · أبريل 2026 — مارس 2030 · {baseColumns.length} مشاريع
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#475569", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 4, background: PRE_CON_SOLID }} />
              <span style={{ fontWeight: 600 }}>ما قبل التنفيذ</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 4, background: CONSTR_SOLID }} />
              <span style={{ fontWeight: 600 }}>مرحلة الإنشاء</span>
            </div>
          </div>

          {/* Grouping buttons */}
          <div style={{ display: "flex", gap: 4, background: "#ffffff", borderRadius: 12, padding: 3, border: "1px solid #e2e8f0" }}>
            {([1, 3, 6] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: "5px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s",
                  border: "none",
                  background: groupBy === g ? "#0d9488" : "transparent",
                  color: groupBy === g ? "#fff" : "#64748b",
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
          maxHeight: "75vh",
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
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
              {/* Project column headers - LIGHT style matching platform cards */}
              {effectiveColumns.map((col, ci) => {
                const delay    = getDelay(col.projectId);
                const hasDelay = delay.fullDelay > 0 || delay.constructionDelay > 0;
                return (
                  <th
                    key={col.projectId}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f8fafb` : "none",
                      padding: 0,
                      verticalAlign: "top",
                      background: "#f8fafb",
                    }}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        borderRadius: 14,
                        padding: "14px 8px 10px",
                        border: "1px solid #e5e7eb",
                        borderTop: "3px solid #0d9488",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      {/* Project name */}
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: "#1e293b",
                        textAlign: "center", lineHeight: 1.5,
                        marginBottom: 8, padding: "0 2px",
                        wordBreak: "break-word",
                      }}>
                        {col.name}
                      </div>

                      {/* Capital summary */}
                      <div style={{
                        background: "#f0fdfa", borderRadius: 10,
                        padding: "6px 8px", marginBottom: 8,
                        fontSize: 9, color: "#475569", lineHeight: 1.8,
                        border: "1px solid #ccfbf1",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                          <span style={{ color: "#64748b" }}>الإجمالي:</span>
                          <span style={{ fontWeight: 800, color: "#0f172a" }}>{fmtFull(col.grandTotal)}</span>
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", gap: 4,
                          borderTop: "1px solid #e0f2fe", paddingTop: 4, marginTop: 3,
                        }}>
                          <span style={{ color: "#64748b" }}>المطلوب:</span>
                          <span style={{ fontWeight: 800, color: "#d97706" }}>{fmtFull(col.upcomingTotal)}</span>
                        </div>
                      </div>

                      {/* Delay badge */}
                      {hasDelay && (
                        <div style={{
                          background: "#fef3c7", borderRadius: 8,
                          padding: "3px 6px", marginBottom: 6, textAlign: "center",
                          fontSize: 9, color: "#92400e", fontWeight: 700,
                          border: "1px solid #fde68a",
                        }}>
                          {delay.fullDelay > 0 && `كامل +${delay.fullDelay}ش`}
                          {delay.fullDelay > 0 && delay.constructionDelay > 0 && " · "}
                          {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                        </div>
                      )}

                      {/* Full project delay controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 4 }}>
                        <button
                          onClick={() => adjustFullDelay(col.projectId, -3)}
                          disabled={delay.fullDelay === 0}
                          title="تقديم المشروع 3 أشهر"
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: delay.fullDelay === 0 ? "#f1f5f9" : "#ccfbf1",
                            border: `1px solid ${delay.fullDelay === 0 ? "#e2e8f0" : "#99f6e4"}`,
                            cursor: delay.fullDelay === 0 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: delay.fullDelay === 0 ? "#cbd5e1" : "#0d9488",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronUp style={{ width: 12, height: 12 }} />
                        </button>
                        <span style={{ fontSize: 8, color: "#94a3b8", minWidth: 30, textAlign: "center", fontWeight: 700 }}>
                          المشروع
                        </span>
                        <button
                          onClick={() => adjustFullDelay(col.projectId, 3)}
                          title="تأجيل المشروع 3 أشهر"
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: "#ccfbf1",
                            border: "1px solid #99f6e4", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#0d9488",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronDown style={{ width: 12, height: 12 }} />
                        </button>
                      </div>

                      {/* Construction delay controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 4 }}>
                        <button
                          onClick={() => adjustConstructionDelay(col.projectId, -3)}
                          disabled={delay.constructionDelay === 0}
                          title="تقديم الإنشاء 3 أشهر"
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: delay.constructionDelay === 0 ? "#f1f5f9" : "#fef3c7",
                            border: `1px solid ${delay.constructionDelay === 0 ? "#e2e8f0" : "#fde68a"}`,
                            cursor: delay.constructionDelay === 0 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: delay.constructionDelay === 0 ? "#cbd5e1" : "#d97706",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronUp style={{ width: 12, height: 12 }} />
                        </button>
                        <span style={{ fontSize: 8, color: "#94a3b8", minWidth: 30, textAlign: "center", fontWeight: 700 }}>
                          الإنشاء
                        </span>
                        <button
                          onClick={() => adjustConstructionDelay(col.projectId, 3)}
                          title="تأجيل الإنشاء 3 أشهر"
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: "#fef3c7",
                            border: "1px solid #fde68a", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#d97706",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronDown style={{ width: 12, height: 12 }} />
                        </button>
                      </div>

                      {/* Reset button */}
                      {hasDelay && (
                        <div style={{ textAlign: "center", marginTop: 2 }}>
                          <button
                            onClick={() => resetDelay(col.projectId)}
                            title="إعادة ضبط"
                            style={{
                              background: "#f1f5f9", border: "1px solid #e2e8f0",
                              borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                              fontSize: 8, color: "#64748b", fontWeight: 700,
                              display: "inline-flex", alignItems: "center", gap: 3,
                              transition: "all 0.2s",
                            }}
                          >
                            <RotateCcw style={{ width: 9, height: 9 }} />
                            إعادة
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Date column header */}
              <th
                style={{
                  width: COL_W,
                  minWidth: COL_W,
                  padding: 0,
                  borderLeft: `${GAP}px solid #f8fafb`,
                  borderRight: `${GAP}px solid #f8fafb`,
                  verticalAlign: "bottom",
                  background: "#f8fafb",
                }}
              >
                <div style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#334155",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "1px solid #e5e7eb",
                  borderTop: "3px solid #94a3b8",
                }}>
                  📅 الشهر
                </div>
              </th>

              {/* Total column header */}
              <th
                style={{
                  width: COL_W,
                  minWidth: COL_W,
                  padding: 0,
                  verticalAlign: "bottom",
                  background: "#f8fafb",
                }}
              >
                <div style={{
                  background: "#fffbeb",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#92400e",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "1px solid #fde68a",
                  borderTop: "3px solid #f59e0b",
                }}>
                  💰 الإجمالي
                </div>
              </th>

              {/* Cumulative total column header */}
              <th
                style={{
                  width: COL_W,
                  minWidth: COL_W,
                  padding: 0,
                  paddingRight: GAP,
                  verticalAlign: "bottom",
                  background: "#f8fafb",
                }}
              >
                <div style={{
                  background: "#fef3c7",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#78350f",
                  fontSize: 10,
                  fontWeight: 800,
                  border: "1px solid #fde68a",
                  borderTop: "3px solid #d97706",
                }}>                  📊 التراكمي
                </div>
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
                    let bg        = "#fafbfc";
                    let textColor = "#cbd5e1";
                    let fontW     = 400;

                    // Build border-radius: each corner is independent
                    // In a vertical column layout (RTL):
                    // CSS border-radius order: top-left top-right bottom-right bottom-left
                    // But visually in our table: "first" = top row of phase, "last" = bottom row
                    let tl = 0, tr = 0, br = 0, bl = 0;

                    if (cd.phase === "preCon") {
                      bg        = cd.amount > 0 ? PRE_CON_SOLID : PRE_CON_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : PRE_CON_TEXT;
                      fontW     = cd.amount > 0 ? 800 : 500;
                      // First row of phase: round top-left and top-right
                      if (cd.isFirst) { tl = CURVE; tr = CURVE; }
                      // Last row of phase: round bottom-left and bottom-right
                      if (cd.isLast) { bl = CURVE; br = CURVE; }
                    } else if (cd.phase === "construction" || cd.phase === "handover") {
                      bg        = cd.amount > 0 ? CONSTR_SOLID : CONSTR_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : CONSTR_TEXT;
                      fontW     = cd.amount > 0 ? 800 : 500;
                      if (cd.isFirst) { tl = CURVE; tr = CURVE; }
                      if (cd.isLast) { bl = CURVE; br = CURVE; }
                    }

                    const borderRadiusStyle = `${tl}px ${tr}px ${br}px ${bl}px`;

                    return (
                      <td
                        key={`col-${cd.colId}`}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          height: ROW_H,
                          padding: 0,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f8fafb` : "none",
                          background: "#f8fafb",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: bg,
                            borderRadius: borderRadiusStyle,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: fontW,
                            color: textColor,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {cd.amount > 0 ? fmtCell(cd.amount) : (cd.phase ? "" : "")}
                        </div>
                      </td>
                    );
                  })}

                  {/* Date cell */}
                  <td
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      height: ROW_H,
                      fontSize: groupBy === 1 ? 10 : 9,
                      fontWeight: 600,
                      color: "#475569",
                      padding: "0 6px",
                      textAlign: "center",
                      borderLeft: `${GAP}px solid #f8fafb`,
                      borderRight: `${GAP}px solid #f8fafb`,
                      background: isEven ? "#ffffff" : "#f8fafc",
                      whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                      lineHeight: 1.3,
                    }}
                  >
                    {row.label}
                  </td>

                  {/* Total cell */}
                  <td
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      height: ROW_H,
                      background: row.total > 0 ? "#fffbeb" : (isEven ? "#ffffff" : "#f8fafc"),
                      padding: "0 6px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#92400e" : "#94a3b8",
                    }}
                  >
                    {row.total > 0 ? fmtCell(row.total) : ""}
                  </td>

                  {/* Cumulative total cell */}
                  <td
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      height: ROW_H,
                      background: cumulativeTotals[row.gi] > 0 ? "#fef3c7" : (isEven ? "#ffffff" : "#f8fafc"),
                      padding: "0 6px",
                      paddingRight: GAP,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: cumulativeTotals[row.gi] > 0 ? 800 : 400,
                      color: cumulativeTotals[row.gi] > 0 ? "#78350f" : "#94a3b8",
                    }}
                  >
                    {cumulativeTotals[row.gi] > 0 ? fmtCell(cumulativeTotals[row.gi]) : ""}
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
