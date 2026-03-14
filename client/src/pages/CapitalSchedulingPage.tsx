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

// ── 2 phase colors only ──────────────────────────────────────────────────────
const PRE_CON_COLOR      = "#3b82f6"; // blue-500
const PRE_CON_LIGHT      = "#dbeafe"; // blue-100
const CONSTRUCTION_COLOR = "#ec4899"; // pink-500
const CONSTRUCTION_LIGHT = "#fce7f3"; // pink-100
const INACTIVE_COLOR     = "#f1f5f9"; // slate-100

const HEADER_BG   = "#1e3a5f";
const HEADER_TEXT = "#ffffff";

interface ProjectColumn {
  cfProjectId: number;
  projectId: number | null;
  name: string;
  startDate: string;
  preDevMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  /**
   * Monthly investor outflow from getCapitalScheduleData:
   * index 0 = land purchase (FIXED_ABSOLUTE, placed 1 month before project start)
   * index 1..N = project months 1..N (month 1 = first pre-dev month)
   */
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

// Convert a project's relative month index (0-based) to an absolute chart index (0 = Apr 2026)
function projectMonthToChartIndex(
  startDate: string,
  relativeMonth: number
): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const chartStartYear = 2026;
  const chartStartMonth = 4; // April
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

  function getDelay(cfProjectId: number): DelayState {
    return delays[cfProjectId] || { fullDelay: 0, constructionDelay: 0 };
  }

  function adjustFullDelay(cfProjectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[cfProjectId] || { fullDelay: 0, constructionDelay: 0 };
      return { ...prev, [cfProjectId]: { ...cur, fullDelay: Math.max(0, cur.fullDelay + delta) } };
    });
  }

  function adjustConstructionDelay(cfProjectId: number, delta: number) {
    setDelays(prev => {
      const cur = prev[cfProjectId] || { fullDelay: 0, constructionDelay: 0 };
      return { ...prev, [cfProjectId]: { ...cur, constructionDelay: Math.max(0, cur.constructionDelay + delta) } };
    });
  }

  function resetDelay(cfProjectId: number) {
    setDelays(prev => ({ ...prev, [cfProjectId]: { fullDelay: 0, constructionDelay: 0 } }));
  }

  // Build effective columns with delay applied
  // monthlyAmounts from API:
  //   index 0 = land (FIXED_ABSOLUTE) → placed 1 month before project start
  //   index 1..N = project months 1..N (relIdx 0..N-1)
  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const { fullDelay, constructionDelay } = getDelay(col.cfProjectId);
      const chartAmounts: Record<number, number> = {};

      col.monthlyAmounts.forEach((val, idx) => {
        if (val <= 0) return;
        let chartIdx: number;
        if (idx === 0) {
          // Land: 1 month before project start, shift by fullDelay only
          const baseChartIdx = projectMonthToChartIndex(col.startDate, 0) - 1;
          chartIdx = baseChartIdx + fullDelay;
        } else {
          // idx 1..N → relIdx 0..(N-1)
          const relIdx = idx - 1;
          if (relIdx < col.preDevMonths) {
            // Pre-dev: shift by fullDelay only
            const baseChartIdx = projectMonthToChartIndex(col.startDate, relIdx);
            chartIdx = baseChartIdx + fullDelay;
          } else {
            // Construction/handover: shift by fullDelay + constructionDelay
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

  // Determine phase for a given chart index, considering delays
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
        return { colId: col.cfProjectId, amount, phase };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [effectiveColumns, monthlyTotals, groupBy]);

  const isLoading = scheduleQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-blue-400 border-t-transparent animate-spin mx-auto" />
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

  const COL_W       = 130;
  const DATE_COL_W  = 110;
  const TOTAL_COL_W = 110;
  const GAP         = 16;
  const ROW_H       = groupBy === 1 ? 36 : groupBy === 3 ? 48 : 58;

  const tableW = TOTAL_COL_W + GAP + DATE_COL_W + GAP + effectiveColumns.length * COL_W + (effectiveColumns.length - 1) * GAP;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100%",
        background: "#ffffff",
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
                background: "#f1f5f9", border: "1px solid #e2e8f0",
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
              background: HEADER_BG,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(30,58,95,0.3)",
            }}
          >
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.3px" }}>
              مشاريع كومو — جدولة رأس المال
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
              {TOTAL_MONTHS} شهراً · أبريل 2026 — {getMonthLabel(TOTAL_MONTHS - 1)} · {baseColumns.length} مشاريع
            </p>
          </div>
        </div>

        {/* Grouping + Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "ما قبل التنفيذ", color: PRE_CON_COLOR },
              { label: "مرحلة الإنشاء",  color: CONSTRUCTION_COLOR },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{label}</span>
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
                  border: groupBy === g ? "none" : "1px solid #e2e8f0",
                  background: groupBy === g ? HEADER_BG : "#f8fafc",
                  color: groupBy === g ? "#fff" : "#64748b",
                  boxShadow: groupBy === g ? "0 4px 12px rgba(30,58,95,0.3)" : "none",
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
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
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
                const delay    = getDelay(col.cfProjectId);
                const hasDelay = delay.fullDelay > 0 || delay.constructionDelay > 0;
                return (
                  <th
                    key={col.cfProjectId}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      background: HEADER_BG,
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #ffffff` : "none",
                      padding: "10px 8px 8px",
                      verticalAlign: "top",
                      position: "relative",
                    }}
                  >
                    {/* Project name */}
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: HEADER_TEXT,
                      textAlign: "center", lineHeight: 1.4,
                      marginBottom: 6, padding: "0 2px",
                      wordBreak: "break-word",
                    }}>
                      {col.name}
                    </div>

                    {/* Capital summary: grandTotal / paidTotal / upcomingTotal */}
                    <div style={{
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 6, padding: "4px 6px", marginBottom: 6,
                      fontSize: 9, color: "#e2e8f0", lineHeight: 1.6,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                        <span style={{ color: "#94a3b8" }}>الإجمالي:</span>
                        <span style={{ fontWeight: 800, color: "#fbbf24" }}>{fmtFull(col.grandTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                        <span style={{ color: "#94a3b8" }}>المدفوع:</span>
                        <span style={{ fontWeight: 700, color: "#4ade80" }}>{fmtFull(col.paidTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 4, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 3, marginTop: 2 }}>
                        <span style={{ color: "#94a3b8" }}>المطلوب:</span>
                        <span style={{ fontWeight: 800, color: "#f87171" }}>{fmtFull(col.upcomingTotal)}</span>
                      </div>
                    </div>

                    {/* Delay info badge */}
                    {hasDelay && (
                      <div style={{
                        background: "rgba(251,191,36,0.2)", borderRadius: 6,
                        padding: "2px 6px", marginBottom: 4, textAlign: "center",
                        fontSize: 9, color: "#fbbf24", fontWeight: 700,
                      }}>
                        {delay.fullDelay > 0 && `كامل +${delay.fullDelay}ش`}
                        {delay.fullDelay > 0 && delay.constructionDelay > 0 && " · "}
                        {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                      </div>
                    )}

                    {/* Full project delay controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 3 }}>
                      <button
                        onClick={() => adjustFullDelay(col.cfProjectId, -3)}
                        disabled={delay.fullDelay === 0}
                        title="تقديم المشروع 3 أشهر"
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: delay.fullDelay === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
                          border: "none", cursor: delay.fullDelay === 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: delay.fullDelay === 0 ? "rgba(255,255,255,0.25)" : "#1e3a5f",
                        }}
                      >
                        <ChevronUp style={{ width: 11, height: 11 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", minWidth: 28, textAlign: "center", fontWeight: 700 }}>
                        المشروع
                      </span>
                      <button
                        onClick={() => adjustFullDelay(col.cfProjectId, 3)}
                        title="تأجيل المشروع 3 أشهر"
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: "rgba(255,255,255,0.85)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#1e3a5f",
                        }}
                      >
                        <ChevronDown style={{ width: 11, height: 11 }} />
                      </button>
                    </div>

                    {/* Construction delay controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 3 }}>
                      <button
                        onClick={() => adjustConstructionDelay(col.cfProjectId, -3)}
                        disabled={delay.constructionDelay === 0}
                        title="تقديم الإنشاء 3 أشهر"
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: delay.constructionDelay === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
                          border: "none", cursor: delay.constructionDelay === 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: delay.constructionDelay === 0 ? "rgba(255,255,255,0.25)" : "#1e3a5f",
                        }}
                      >
                        <ChevronUp style={{ width: 11, height: 11 }} />
                      </button>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", minWidth: 28, textAlign: "center", fontWeight: 700 }}>
                        الإنشاء
                      </span>
                      <button
                        onClick={() => adjustConstructionDelay(col.cfProjectId, 3)}
                        title="تأجيل الإنشاء 3 أشهر"
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: "rgba(255,255,255,0.85)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#1e3a5f",
                        }}
                      >
                        <ChevronDown style={{ width: 11, height: 11 }} />
                      </button>
                    </div>

                    {/* Reset button */}
                    {hasDelay && (
                      <div style={{ textAlign: "center" }}>
                        <button
                          onClick={() => resetDelay(col.cfProjectId)}
                          title="إعادة ضبط"
                          style={{
                            background: "rgba(255,255,255,0.15)", border: "none",
                            borderRadius: 5, padding: "2px 8px", cursor: "pointer",
                            fontSize: 8, color: "#fff", fontWeight: 700,
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
                  background: "#334155",
                  color: "#f1f5f9",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "16px 6px",
                  textAlign: "center",
                  borderLeft: `${GAP}px solid #ffffff`,
                  borderRight: `${GAP}px solid #ffffff`,
                  letterSpacing: "0.5px",
                  verticalAlign: "middle",
                }}
              >
                📅 الشهر
              </th>

              {/* Total column header */}
              <th
                style={{
                  width: TOTAL_COL_W,
                  minWidth: TOTAL_COL_W,
                  background: "#1e3a5f",
                  color: "#fbbf24",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "16px 6px",
                  textAlign: "center",
                  letterSpacing: "0.5px",
                  verticalAlign: "middle",
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
                    let bg        = INACTIVE_COLOR;
                    let textColor = "#94a3b8";
                    let fontW     = 400;

                    if (cd.phase === "preCon") {
                      bg        = cd.amount > 0 ? PRE_CON_COLOR : PRE_CON_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : "#3b82f6";
                      fontW     = cd.amount > 0 ? 800 : 500;
                    } else if (cd.phase === "construction" || cd.phase === "handover") {
                      bg        = cd.amount > 0 ? CONSTRUCTION_COLOR : CONSTRUCTION_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : "#ec4899";
                      fontW     = cd.amount > 0 ? 800 : 500;
                    }

                    return (
                      <td
                        key={cd.colId}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          height: ROW_H,
                          background: bg,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #ffffff` : "none",
                          borderTop: "1px solid rgba(255,255,255,0.6)",
                          padding: "0 6px",
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: fontW,
                          color: textColor,
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
                      color: "#334155",
                      padding: "0 6px",
                      textAlign: "center",
                      borderLeft: `${GAP}px solid #ffffff`,
                      borderRight: `${GAP}px solid #ffffff`,
                      background: isEven ? "#f8fafc" : "#f1f5f9",
                      whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                      lineHeight: 1.3,
                      borderTop: "1px solid #e2e8f0",
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
                      background: row.total > 0 ? "#1e3a5f" : (isEven ? "#f8fafc" : "#f1f5f9"),
                      padding: "0 8px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#fbbf24" : "#94a3b8",
                      borderTop: "1px solid #e2e8f0",
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
