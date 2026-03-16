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

// ── Phase colors ──────────────────────────────────────────────────────
const PRE_CON_COLOR      = "#3b82f6"; // blue-500
const PRE_CON_LIGHT      = "#dbeafe"; // blue-100
const CONSTRUCTION_COLOR = "#ec4899"; // pink-500
const CONSTRUCTION_LIGHT = "#fce7f3"; // pink-100
const INACTIVE_COLOR     = "#f8fafc"; // very light

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
    // Index 0 = land month (before project start) - always considered paid
    paidStatus.push(true);
    for (let m = 1; m < totalMonths; m++) {
      const calYear = sy + Math.floor((sm - 1 + m - 1) / 12);
      const calMonth = ((sm - 1 + m - 1) % 12) + 1;
      const endOfMonth = new Date(calYear, calMonth, 1); // first day of next month
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
        // When delays are applied, skip paid amounts (only show upcoming/required)
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

  // Determine if a cell is the first or last of its phase for curved corners
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
  const GAP         = 12;
  const ROW_H       = groupBy === 1 ? 36 : groupBy === 3 ? 48 : 58;
  const CURVE       = 12; // border-radius for phase transitions

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
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
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
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#475569", alignItems: "center" }}>
            {[
              { color: PRE_CON_COLOR, label: "ما قبل التنفيذ" },
              { color: CONSTRUCTION_COLOR, label: "مرحلة الإنشاء" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                <span style={{ fontWeight: 600 }}>{item.label}</span>
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
                  background: groupBy === g ? "#1e3a5f" : "#f8fafc",
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
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
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
                const delay    = getDelay(col.projectId);
                const hasDelay = delay.fullDelay > 0 || delay.constructionDelay > 0;
                const isFirst  = ci === 0;
                const isLast   = ci === effectiveColumns.length - 1;
                return (
                  <th
                    key={col.projectId}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      borderLeft: !isLast ? `${GAP}px solid #ffffff` : "none",
                      padding: 0,
                      verticalAlign: "top",
                      position: "relative",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        background: "linear-gradient(180deg, #0f2847 0%, #1a3f6f 40%, #2563a8 100%)",
                        borderRadius: isFirst ? "0 16px 16px 0" : isLast ? "16px 0 0 16px" : "16px",
                        padding: "16px 10px 12px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Decorative glow */}
                      <div style={{
                        position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
                        width: 80, height: 80, borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(96,165,250,0.2), transparent 70%)",
                        pointerEvents: "none",
                      }} />

                      {/* Project name */}
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: "#ffffff", fontFamily: "inherit",
                        textAlign: "center", lineHeight: 1.5,
                        marginBottom: 10, padding: "0 2px",
                        wordBreak: "break-word",
                        textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        position: "relative",
                      }}>
                        {col.name}
                      </div>

                      {/* Capital summary: only grandTotal and upcomingTotal */}
                      <div style={{
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 10, padding: "8px 10px", marginBottom: 10,
                        fontSize: 9, color: "#e2e8f0", lineHeight: 1.8,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                          <span style={{ opacity: 0.7 }}>الإجمالي:</span>
                          <span style={{ fontWeight: 800, color: "#ffffff", fontSize: 10 }}>{fmtFull(col.grandTotal)}</span>
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", gap: 4,
                          borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 5, marginTop: 4,
                        }}>
                          <span style={{ opacity: 0.7 }}>المطلوب:</span>
                          <span style={{ fontWeight: 800, color: "#fbbf24", fontSize: 10 }}>{fmtFull(col.upcomingTotal)}</span>
                        </div>
                      </div>

                      {/* Delay info badge */}
                      {hasDelay && (
                        <div style={{
                          background: "rgba(251,191,36,0.2)", borderRadius: 8,
                          padding: "4px 8px", marginBottom: 8, textAlign: "center",
                          fontSize: 9, color: "#fbbf24", fontWeight: 700,
                          border: "1px solid rgba(251,191,36,0.15)",
                        }}>
                          {delay.fullDelay > 0 && `كامل +${delay.fullDelay}ش`}
                          {delay.fullDelay > 0 && delay.constructionDelay > 0 && " · "}
                          {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                        </div>
                      )}

                      {/* Full project delay controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 5 }}>
                        <button
                          onClick={() => adjustFullDelay(col.projectId, -3)}
                          disabled={delay.fullDelay === 0}
                          title="تقديم المشروع 3 أشهر"
                          style={{
                            width: 24, height: 24, borderRadius: 8,
                            background: delay.fullDelay === 0 ? "rgba(255,255,255,0.06)" : "rgba(96,165,250,0.2)",
                            border: "1px solid rgba(255,255,255,0.15)", cursor: delay.fullDelay === 0 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: delay.fullDelay === 0 ? "rgba(255,255,255,0.2)" : "#93c5fd",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronUp style={{ width: 13, height: 13 }} />
                        </button>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", minWidth: 34, textAlign: "center", fontWeight: 700 }}>
                          المشروع
                        </span>
                        <button
                          onClick={() => adjustFullDelay(col.projectId, 3)}
                          title="تأجيل المشروع 3 أشهر"
                          style={{
                            width: 24, height: 24, borderRadius: 8,
                            background: "rgba(96,165,250,0.2)",
                            border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#93c5fd",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronDown style={{ width: 13, height: 13 }} />
                        </button>
                      </div>

                      {/* Construction delay controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                        <button
                          onClick={() => adjustConstructionDelay(col.projectId, -3)}
                          disabled={delay.constructionDelay === 0}
                          title="تقديم الإنشاء 3 أشهر"
                          style={{
                            width: 24, height: 24, borderRadius: 8,
                            background: delay.constructionDelay === 0 ? "rgba(255,255,255,0.06)" : "rgba(244,114,182,0.2)",
                            border: "1px solid rgba(255,255,255,0.15)", cursor: delay.constructionDelay === 0 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: delay.constructionDelay === 0 ? "rgba(255,255,255,0.2)" : "#f9a8d4",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronUp style={{ width: 13, height: 13 }} />
                        </button>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", minWidth: 34, textAlign: "center", fontWeight: 700 }}>
                          الإنشاء
                        </span>
                        <button
                          onClick={() => adjustConstructionDelay(col.projectId, 3)}
                          title="تأجيل الإنشاء 3 أشهر"
                          style={{
                            width: 24, height: 24, borderRadius: 8,
                            background: "rgba(244,114,182,0.2)",
                            border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#f9a8d4",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronDown style={{ width: 13, height: 13 }} />
                        </button>
                      </div>

                      {/* Reset button */}
                      {hasDelay && (
                        <div style={{ textAlign: "center", marginTop: 4 }}>
                          <button
                            onClick={() => resetDelay(col.projectId)}
                            title="إعادة ضبط"
                            style={{
                              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                              borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                              fontSize: 8, color: "rgba(255,255,255,0.7)", fontWeight: 700,
                              display: "inline-flex", alignItems: "center", gap: 4,
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
                  width: DATE_COL_W,
                  minWidth: DATE_COL_W,
                  padding: 0,
                  borderLeft: `${GAP}px solid #ffffff`,
                  borderRight: `${GAP}px solid #ffffff`,
                  verticalAlign: "middle",
                  background: "#ffffff",
                }}
              >
                <div style={{
                  background: "#f1f5f9",
                  borderRadius: 12,
                  padding: "16px 6px",
                  textAlign: "center",
                  color: "#334155",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                }}>
                  📅 الشهر
                </div>
              </th>

              {/* Total column header */}
              <th
                style={{
                  width: TOTAL_COL_W,
                  minWidth: TOTAL_COL_W,
                  padding: 0,
                  verticalAlign: "middle",
                  background: "#ffffff",
                }}
              >
                <div style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderRadius: "16px 0 0 16px",
                  padding: "16px 6px",
                  textAlign: "center",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}>
                  💰 الإجمالي
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
                    let bg        = INACTIVE_COLOR;
                    let textColor = "#cbd5e1";
                    let fontW     = 400;
                    let borderRadiusStyle = "0";

                    if (cd.phase === "preCon") {
                      bg        = cd.amount > 0 ? PRE_CON_COLOR : PRE_CON_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : "#3b82f6";
                      fontW     = cd.amount > 0 ? 800 : 500;
                      // Curved corners at phase boundaries (top = first, bottom = last in RTL vertical)
                      if (cd.isFirst && cd.isLast) {
                        borderRadiusStyle = `${CURVE}px`;
                      } else if (cd.isFirst) {
                        borderRadiusStyle = `0 0 ${CURVE}px ${CURVE}px`;
                      } else if (cd.isLast) {
                        borderRadiusStyle = `${CURVE}px ${CURVE}px 0 0`;
                      }
                    } else if (cd.phase === "construction" || cd.phase === "handover") {
                      bg        = cd.amount > 0 ? CONSTRUCTION_COLOR : CONSTRUCTION_LIGHT;
                      textColor = cd.amount > 0 ? "#ffffff" : "#ec4899";
                      fontW     = cd.amount > 0 ? 800 : 500;
                      if (cd.isFirst && cd.isLast) {
                        borderRadiusStyle = `${CURVE}px`;
                      } else if (cd.isFirst) {
                        borderRadiusStyle = `0 0 ${CURVE}px ${CURVE}px`;
                      } else if (cd.isLast) {
                        borderRadiusStyle = `${CURVE}px ${CURVE}px 0 0`;
                      }
                    }

                    return (
                      <td
                        key={`col-${cd.colId}`}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          height: ROW_H,
                          padding: 0,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #ffffff` : "none",
                          background: "#ffffff",
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
                          {cd.amount > 0 ? fmtCell(cd.amount) : (cd.phase ? "·" : "")}
                        </div>
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
                      background: row.total > 0 ? "#fffbeb" : (isEven ? "#f8fafc" : "#f1f5f9"),
                      padding: "0 8px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#92400e" : "#94a3b8",
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
