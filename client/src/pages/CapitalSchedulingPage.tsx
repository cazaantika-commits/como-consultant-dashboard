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

// ── Phase colors ─────────────────────────────────────────────────────
// 5 phases: land (green), design (cyan), offplan (pink), construction (orange), handover (yellow)
const PHASE_COLORS = {
  land:         { solid: "#4AD8A4", light: "#e6faf2", text: "#1a7a54" },
  design:       { solid: "#3AD8F0", light: "#e0f7fc", text: "#0e7490" },
  offplan:      { solid: "#F581BE", light: "#fde8f3", text: "#9d174d" },
  construction: { solid: "#FF602A", light: "#fff0eb", text: "#9a3412" },
  handover:     { solid: "#FBC53B", light: "#fef9e7", text: "#854d0e" },
} as const;

type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

interface ProjectColumn {
  cfProjectId: number | null;
  projectId: number;
  name: string;
  startDate: string;
  preDevMonths: number;
  designMonths: number;
  offplanMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  monthlyAmounts: number[];
  phaseMonthlyAmounts: Record<string, Record<string, number>>;
  phaseTotals: Record<string, number>;
  grandTotal: number;
  paidTotal: number;
  upcomingTotal: number;
}

interface DelayState {
  designDelay: number;       // delay for design phase (shifts everything)
  offplanDelay: number;      // additional delay for offplan phase
  constructionDelay: number; // additional delay for construction phase
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
    return delays[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
  }

  function adjustDelay(projectId: number, phase: keyof DelayState, delta: number) {
    setDelays(prev => {
      const cur = prev[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
      const newVal = Math.max(0, cur[phase] + delta);
      return { ...prev, [projectId]: { ...cur, [phase]: newVal } };
    });
  }

  function resetDelay(projectId: number) {
    setDelays(prev => ({ ...prev, [projectId]: { designDelay: 0, offplanDelay: 0, constructionDelay: 0 } }));
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

  /**
   * For each project, compute chart-level amounts per phase, considering delays.
   * 
   * Phase delays work as follows:
   * - designDelay: shifts design, offplan, and construction all together
   * - offplanDelay: shifts offplan independently (additional to designDelay)
   * - constructionDelay: shifts construction independently (additional to designDelay)
   * 
   * Rules:
   * - Land phase: never shifts (already paid)
   * - Design: shifts by designDelay
   * - Offplan: shifts by designDelay + offplanDelay (min start = design start + 2 months)
   * - Construction: shifts by designDelay + constructionDelay (min start = after design ends)
   */
  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const delay = getDelay(col.projectId);
      const hasDelay = delay.designDelay > 0 || delay.offplanDelay > 0 || delay.constructionDelay > 0;
      const paidStatus = getMonthPaidStatus(col);

      // Phase amounts mapped to chart indices
      const phaseChartAmounts: Record<PhaseType, Record<number, number>> = {
        land: {}, design: {}, offplan: {}, construction: {}, handover: {},
      };

      const phaseTypes: PhaseType[] = ["land", "design", "offplan", "construction", "handover"];

      for (const phase of phaseTypes) {
        const phaseData = col.phaseMonthlyAmounts?.[phase];
        if (!phaseData) continue;

        for (const [monthStr, val] of Object.entries(phaseData)) {
          const m = parseInt(monthStr);
          if (val <= 0) continue;
          if (hasDelay && paidStatus[m]) continue;

          let chartIdx: number;
          if (phase === "land") {
            // Land never shifts
            const baseChartIdx = projectMonthToChartIndex(col.startDate, 0) - 1;
            chartIdx = baseChartIdx;
          } else if (phase === "design") {
            // Design shifts by designDelay
            const baseChartIdx = projectMonthToChartIndex(col.startDate, m - 1);
            chartIdx = baseChartIdx + delay.designDelay;
          } else if (phase === "offplan") {
            // Offplan shifts by designDelay + offplanDelay
            const baseChartIdx = projectMonthToChartIndex(col.startDate, m - 1);
            chartIdx = baseChartIdx + delay.designDelay + delay.offplanDelay;
          } else {
            // Construction/handover shifts by designDelay + constructionDelay
            const baseChartIdx = projectMonthToChartIndex(col.startDate, m - 1);
            chartIdx = baseChartIdx + delay.designDelay + delay.constructionDelay;
          }

          if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
            phaseChartAmounts[phase][chartIdx] = (phaseChartAmounts[phase][chartIdx] || 0) + val;
          }
        }
      }

      // Aggregate all phases into a single chartAmounts for totals
      const chartAmounts: Record<number, number> = {};
      for (const phase of phaseTypes) {
        for (const [idx, val] of Object.entries(phaseChartAmounts[phase])) {
          const i = parseInt(idx);
          chartAmounts[i] = (chartAmounts[i] || 0) + val;
        }
      }

      // Compute phase ranges for visual display (considering delays)
      const baseStart = projectMonthToChartIndex(col.startDate, 0);

      // Design range
      const designStart = baseStart + delay.designDelay;
      const designEnd = designStart + col.designMonths - 1;

      // Offplan range (normal: starts at design month 3, but with delay it shifts)
      // In normal flow, offplan starts at design start + 2
      const offplanNormalStart = designStart + 2;
      const offplanStart = offplanNormalStart + delay.offplanDelay;
      const offplanEnd = offplanStart + (col.offplanMonths || 2) - 1;

      // Construction range (starts after design ends normally)
      const constructionNormalStart = designEnd + 1;
      const constructionStart = constructionNormalStart + delay.constructionDelay;
      const constructionEnd = constructionStart + col.constructionMonths - 1;

      // Handover
      const handoverStart = constructionEnd + 1;
      const handoverEnd = handoverStart + col.handoverMonths - 1;

      // Land: just the month before design
      const landIdx = baseStart - 1;

      const phaseRanges = {
        land: { start: landIdx, end: landIdx },
        design: { start: designStart, end: designEnd },
        offplan: { start: offplanStart, end: offplanEnd },
        construction: { start: constructionStart, end: constructionEnd },
        handover: { start: handoverStart, end: handoverEnd },
      };

      return {
        ...col,
        chartAmounts,
        phaseChartAmounts,
        phaseRanges,
        ...delay,
      };
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

  // Determine phase for a given chart index in a project column
  function getPhaseAtIndex(col: typeof effectiveColumns[0], chartIdx: number): PhaseType | null {
    const { phaseRanges } = col;
    // Check in order of priority (offplan can overlap with design)
    if (chartIdx >= phaseRanges.offplan.start && chartIdx <= phaseRanges.offplan.end && col.offplanMonths > 0) return "offplan";
    if (chartIdx >= phaseRanges.land.start && chartIdx <= phaseRanges.land.end) return "land";
    if (chartIdx >= phaseRanges.design.start && chartIdx <= phaseRanges.design.end) return "design";
    if (chartIdx >= phaseRanges.construction.start && chartIdx <= phaseRanges.construction.end) return "construction";
    if (chartIdx >= phaseRanges.handover.start && chartIdx <= phaseRanges.handover.end) return "handover";
    return null;
  }

  function getPhasePosition(col: typeof effectiveColumns[0], chartIdx: number): { isFirst: boolean; isLast: boolean } {
    const phase = getPhaseAtIndex(col, chartIdx);
    if (!phase) return { isFirst: false, isLast: false };
    const prevPhase = chartIdx > 0 ? getPhaseAtIndex(col, chartIdx - 1) : null;
    const nextPhase = chartIdx < TOTAL_MONTHS - 1 ? getPhaseAtIndex(col, chartIdx + 1) : null;
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
        const phase  = getPhaseAtIndex(col, midIdx);
        const { isFirst, isLast } = getPhasePosition(col, midIdx);
        return { colId: col.projectId, amount, phase, isFirst, isLast };
      });
      return { gi, startIdx, endIdx, label, total, colData };
    });
  }, [effectiveColumns, monthlyTotals, groupBy]);

  // Cumulative totals
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
          <div className="w-10 h-10 rounded-full border-4 border-violet-400 border-t-transparent animate-spin mx-auto" />
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

  const COL_W  = 130;
  const GAP    = 10;
  const ROW_H  = groupBy === 1 ? 34 : groupBy === 3 ? 46 : 56;
  const CURVE  = 14;

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
              background: "linear-gradient(135deg, #3AD8F0 0%, #0ea5c9 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(58,216,240,0.3)",
            }}
          >
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              مشاريع كومو — جدولة رأس المال
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              {TOTAL_MONTHS} شهراً · أبريل 2026 — مارس 2030 · {baseColumns.length} مشاريع · 4 مراحل
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#475569", alignItems: "center" }}>
            {([
              { phase: "land" as const, label: "المدفوع" },
              { phase: "design" as const, label: "التصاميم" },
              { phase: "offplan" as const, label: "أوف بلان" },
              { phase: "construction" as const, label: "الإنشاء" },
            ]).map(({ phase, label }) => (
              <div key={phase} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: PHASE_COLORS[phase].solid }} />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
            ))}
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
                  background: groupBy === g ? "#FF602A" : "transparent",
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
              {/* Project column headers */}
              {effectiveColumns.map((col, ci) => {
                const delay = getDelay(col.projectId);
                const hasDelay = delay.designDelay > 0 || delay.offplanDelay > 0 || delay.constructionDelay > 0;
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
                        padding: "12px 6px 8px",
                        border: "1px solid #e5e7eb",
                        borderTop: "3px solid #3AD8F0",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      {/* Project name */}
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: "#1e293b",
                        textAlign: "center", lineHeight: 1.5,
                        marginBottom: 6, padding: "0 2px",
                        wordBreak: "break-word",
                      }}>
                        {col.name}
                      </div>

                      {/* Capital summary */}
                      <div style={{
                        background: "#f0fdfa", borderRadius: 8,
                        padding: "4px 6px", marginBottom: 6,
                        fontSize: 8, color: "#475569", lineHeight: 1.8,
                        border: "1px solid #ccfbf1",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                          <span style={{ color: "#64748b" }}>الإجمالي:</span>
                          <span style={{ fontWeight: 800, color: "#0f172a" }}>{fmtFull(col.grandTotal)}</span>
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", gap: 4,
                          borderTop: "1px solid #ccfbf1", paddingTop: 3, marginTop: 2,
                        }}>
                          <span style={{ color: "#64748b" }}>المطلوب:</span>
                          <span style={{ fontWeight: 800, color: "#FF602A" }}>{fmtFull(col.upcomingTotal)}</span>
                        </div>
                      </div>

                      {/* Delay badge */}
                      {hasDelay && (
                        <div style={{
                          background: "#fef9e7", borderRadius: 6,
                          padding: "2px 4px", marginBottom: 4, textAlign: "center",
                          fontSize: 8, color: "#854d0e", fontWeight: 700,
                          border: "1px solid #fde68a",
                        }}>
                          {delay.designDelay > 0 && `تصاميم +${delay.designDelay}ش`}
                          {delay.designDelay > 0 && (delay.offplanDelay > 0 || delay.constructionDelay > 0) && " · "}
                          {delay.offplanDelay > 0 && `أوف +${delay.offplanDelay}ش`}
                          {delay.offplanDelay > 0 && delay.constructionDelay > 0 && " · "}
                          {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                        </div>
                      )}

                      {/* Design delay controls */}
                      <DelayControl
                        label="التصاميم"
                        color="#3AD8F0"
                        lightBg="#e0f7fc"
                        borderColor="#67e8f9"
                        value={delay.designDelay}
                        onUp={() => adjustDelay(col.projectId, "designDelay", -3)}
                        onDown={() => adjustDelay(col.projectId, "designDelay", 3)}
                      />

                      {/* Offplan delay controls */}
                      <DelayControl
                        label="أوف بلان"
                        color="#F581BE"
                        lightBg="#fde8f3"
                        borderColor="#f9a8d4"
                        value={delay.offplanDelay}
                        onUp={() => adjustDelay(col.projectId, "offplanDelay", -3)}
                        onDown={() => adjustDelay(col.projectId, "offplanDelay", 3)}
                      />

                      {/* Construction delay controls */}
                      <DelayControl
                        label="الإنشاء"
                        color="#FF602A"
                        lightBg="#fff0eb"
                        borderColor="#fdba74"
                        value={delay.constructionDelay}
                        onUp={() => adjustDelay(col.projectId, "constructionDelay", -3)}
                        onDown={() => adjustDelay(col.projectId, "constructionDelay", 3)}
                      />

                      {/* Reset button */}
                      {hasDelay && (
                        <div style={{ textAlign: "center", marginTop: 2 }}>
                          <button
                            onClick={() => resetDelay(col.projectId)}
                            title="إعادة ضبط"
                            style={{
                              background: "#f1f5f9", border: "1px solid #e2e8f0",
                              borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                              fontSize: 8, color: "#64748b", fontWeight: 700,
                              display: "inline-flex", alignItems: "center", gap: 3,
                              transition: "all 0.2s",
                            }}
                          >
                            <RotateCcw style={{ width: 8, height: 8 }} />
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
                  الشهر
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
                  background: "#fef9e7",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#854d0e",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "1px solid #fde68a",
                  borderTop: "3px solid #FBC53B",
                }}>
                  الإجمالي
                </div>
              </th>

              {/* Cumulative column header */}
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
                  background: "#fef9e7",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#78350f",
                  fontSize: 10,
                  fontWeight: 800,
                  border: "1px solid #fde68a",
                  borderTop: "3px solid #FBC53B",
                }}>
                  التراكمي
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

                    let tl = 0, tr = 0, br = 0, bl = 0;

                    const phase = cd.phase as PhaseType | null;
                    if (phase && PHASE_COLORS[phase]) {
                      const colors = PHASE_COLORS[phase];
                      bg        = cd.amount > 0 ? colors.solid : colors.light;
                      textColor = cd.amount > 0 ? "#ffffff" : colors.text;
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
                          {cd.amount > 0 ? fmtCell(cd.amount) : ""}
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
                      background: row.total > 0 ? "#fef9e7" : (isEven ? "#ffffff" : "#f8fafc"),
                      padding: "0 6px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#854d0e" : "#94a3b8",
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
                      background: cumulativeTotals[row.gi] > 0 ? "#fef9e7" : (isEven ? "#ffffff" : "#f8fafc"),
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

// ── Delay Control Component ──────────────────────────────────────────────────
function DelayControl({
  label, color, lightBg, borderColor, value, onUp, onDown,
}: {
  label: string;
  color: string;
  lightBg: string;
  borderColor: string;
  value: number;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 3 }}>
      <button
        onClick={onUp}
        disabled={value === 0}
        title={`تقديم ${label} 3 أشهر`}
        style={{
          width: 20, height: 20, borderRadius: 5,
          background: value === 0 ? "#f1f5f9" : lightBg,
          border: `1px solid ${value === 0 ? "#e2e8f0" : borderColor}`,
          cursor: value === 0 ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: value === 0 ? "#cbd5e1" : color,
          transition: "all 0.2s",
        }}
      >
        <ChevronUp style={{ width: 11, height: 11 }} />
      </button>
      <span style={{ fontSize: 7, color: "#94a3b8", minWidth: 32, textAlign: "center", fontWeight: 700 }}>
        {label}
      </span>
      <button
        onClick={onDown}
        title={`تأجيل ${label} 3 أشهر`}
        style={{
          width: 20, height: 20, borderRadius: 5,
          background: lightBg,
          border: `1px solid ${borderColor}`, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: color,
          transition: "all 0.2s",
        }}
      >
        <ChevronDown style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
}
