import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

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

function getShortMonthLabel(offset: number): string {
  const d = new Date(CHART_START);
  d.setMonth(d.getMonth() + offset);
  return `${ARABIC_MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear().toString().slice(2)}`;
}

function fmtCell(n: number): string {
  if (n === 0) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtTooltipNum(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M AED`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K AED`;
  return `${n.toFixed(0)} AED`;
}

// Phase colors (same as vertical view)
const PHASE_COLORS = {
  land:         { solid: "#4a5568", light: "#f7fafc", text: "#2d3748" },
  design:       { solid: "#5b6abf", light: "#eef0f8", text: "#3c4a8a" },
  offplan:      { solid: "#b8860b", light: "#faf5eb", text: "#8b6508" },
  construction: { solid: "#2d6a4f", light: "#edf5f1", text: "#1b4332" },
  handover:     { solid: "#9b2c4d", light: "#f8eff2", text: "#7b2240" },
} as const;

type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

// Tooltip component
function CellTooltip({ children, lines }: { children: React.ReactNode; lines: string[] }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setShow(true);
  }, []);

  if (!lines.length) return <>{children}</>;

  return (
    <div onMouseEnter={onEnter} onMouseLeave={() => setShow(false)} style={{ width: "100%", height: "100%" }}>
      {children}
      {show && createPortal(
        <div style={{
          position: "fixed", left: pos.x, top: pos.y,
          transform: "translate(-50%, -100%)", zIndex: 99999,
          background: "#1e293b", color: "#f8fafc", borderRadius: 10,
          padding: "8px 12px", fontSize: 11, fontWeight: 600,
          lineHeight: 1.7, whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          pointerEvents: "none", direction: "rtl", textAlign: "right",
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{ opacity: i === 0 ? 1 : 0.85 }}>{line}</div>
          ))}
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid #1e293b",
          }} />
        </div>,
        document.body
      )}
    </div>
  );
}

function projectMonthToChartIndex(startDate: string, relativeMonth: number): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const chartStartYear = 2026;
  const chartStartMonth = 4;
  const absYear = sy + Math.floor((sm - 1 + relativeMonth) / 12);
  const absMonth = ((sm - 1 + relativeMonth) % 12) + 1;
  return (absYear - chartStartYear) * 12 + (absMonth - chartStartMonth);
}

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
  itemBreakdown?: Record<string, { name: string; amount: number }[]>;
}

interface DelayState {
  designDelay: number;
  offplanDelay: number;
  constructionDelay: number;
}

interface HorizontalProps {
  baseColumns: ProjectColumn[];
  delays: Record<number, DelayState>;
  hiddenProjects: Set<number>;
  groupBy: 1 | 3 | 6;
}

export default function CapitalSchedulingHorizontal({ baseColumns, delays, hiddenProjects, groupBy }: HorizontalProps) {
  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
  }

  function getMonthPaidStatus(col: ProjectColumn): boolean[] {
    const today = new Date();
    const parts = col.startDate.split("-").map(Number);
    const sy = parts[0];
    const sm = parts[1] || 4;
    const totalMonths = col.monthlyAmounts.length;
    const paidStatus: boolean[] = [];
    paidStatus.push(true);
    for (let m = 1; m < totalMonths; m++) {
      const calYear = sy + Math.floor((sm - 1 + m - 1) / 12);
      const calMonth = ((sm - 1 + m - 1) % 12) + 1;
      const endOfMonth = new Date(calYear, calMonth, 1);
      paidStatus.push(endOfMonth <= today);
    }
    return paidStatus;
  }

  const effectiveColumns = useMemo(() => {
    return baseColumns.filter(col => !hiddenProjects.has(col.projectId)).map((col) => {
      const delay = getDelay(col.projectId);
      const hasDelay = delay.designDelay > 0 || delay.offplanDelay > 0 || delay.constructionDelay > 0;
      const paidStatus = getMonthPaidStatus(col);

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
            chartIdx = projectMonthToChartIndex(col.startDate, 0) - 1;
          } else if (phase === "design") {
            chartIdx = projectMonthToChartIndex(col.startDate, m - 1) + delay.designDelay;
          } else if (phase === "offplan") {
            chartIdx = projectMonthToChartIndex(col.startDate, m - 1) + delay.designDelay + delay.offplanDelay;
          } else {
            chartIdx = projectMonthToChartIndex(col.startDate, m - 1) + delay.designDelay + delay.constructionDelay;
          }
          if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
            phaseChartAmounts[phase][chartIdx] = (phaseChartAmounts[phase][chartIdx] || 0) + val;
          }
        }
      }

      const chartAmounts: Record<number, number> = {};
      for (const phase of phaseTypes) {
        if (phase === "land") continue;
        for (const [idx, val] of Object.entries(phaseChartAmounts[phase])) {
          const i = parseInt(idx);
          chartAmounts[i] = (chartAmounts[i] || 0) + val;
        }
      }

      // Phase ranges
      const baseStart = projectMonthToChartIndex(col.startDate, 0);
      const designStart = baseStart + delay.designDelay;
      const designEnd = designStart + col.designMonths - 1;
      const offplanNormalStart = designStart + 2;
      const offplanStart = offplanNormalStart + delay.offplanDelay;
      const offplanEnd = offplanStart + (col.offplanMonths || 2) - 1;
      const constructionNormalStart = designEnd + 1;
      const constructionStart = constructionNormalStart + delay.constructionDelay;
      const constructionEnd = constructionStart + col.constructionMonths - 1;
      const handoverStart = constructionEnd + 1;
      const handoverEnd = handoverStart + col.handoverMonths - 1;

      const phaseRanges = {
        land: { start: baseStart - 1, end: baseStart - 1 },
        design: { start: designStart, end: designEnd },
        offplan: { start: offplanStart, end: offplanEnd },
        construction: { start: constructionStart, end: constructionEnd },
        handover: { start: handoverStart, end: handoverEnd },
      };

      return { ...col, chartAmounts, phaseChartAmounts, phaseRanges, ...delay };
    });
  }, [baseColumns, delays, hiddenProjects]);

  // Group months
  const groupedMonths = useMemo(() => {
    const numGroups = Math.ceil(TOTAL_MONTHS / groupBy);
    return Array.from({ length: numGroups }, (_, gi) => {
      const startIdx = gi * groupBy;
      const endIdx = Math.min(startIdx + groupBy - 1, TOTAL_MONTHS - 1);
      const label = groupBy === 1
        ? getMonthLabel(startIdx)
        : `${getShortMonthLabel(startIdx)} — ${getShortMonthLabel(endIdx)}`;
      return { gi, startIdx, endIdx, label };
    });
  }, [groupBy]);

  // Get phase at chart index for a project
  function getPhaseAtIndex(col: typeof effectiveColumns[0], chartIdx: number): PhaseType | null {
    const basePhases: PhaseType[] = ["design", "construction", "handover"];
    for (const phase of basePhases) {
      const amt = col.phaseChartAmounts[phase]?.[chartIdx] || 0;
      if (amt > 0) return phase;
    }
    const offplanAmt = col.phaseChartAmounts.offplan?.[chartIdx] || 0;
    if (offplanAmt > 0) {
      const { phaseRanges } = col;
      if (chartIdx >= phaseRanges.design.start && chartIdx <= phaseRanges.design.end) return "design";
      if (chartIdx >= phaseRanges.construction.start && chartIdx <= phaseRanges.construction.end) return "construction";
      return "offplan";
    }
    const { phaseRanges } = col;
    if (chartIdx >= phaseRanges.design.start && chartIdx <= phaseRanges.design.end) return "design";
    if (chartIdx >= phaseRanges.construction.start && chartIdx <= phaseRanges.construction.end) return "construction";
    if (chartIdx >= phaseRanges.handover.start && chartIdx <= phaseRanges.handover.end) return "handover";
    if (chartIdx >= phaseRanges.offplan.start && chartIdx <= phaseRanges.offplan.end && col.offplanMonths > 0) return "offplan";
    return null;
  }

  function hasOffplanAtIndex(col: typeof effectiveColumns[0], chartIdx: number): boolean {
    const offplanAmt = col.phaseChartAmounts.offplan?.[chartIdx] || 0;
    if (offplanAmt > 0) return true;
    const { phaseRanges } = col;
    return chartIdx >= phaseRanges.offplan.start && chartIdx <= phaseRanges.offplan.end && col.offplanMonths > 0;
  }

  // Monthly totals
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

  // Cumulative totals
  const cumulativeTotals = useMemo(() => {
    const cumulative: number[] = [];
    let running = 0;
    for (const gm of groupedMonths) {
      let groupTotal = 0;
      for (let i = gm.startIdx; i <= gm.endIdx; i++) {
        groupTotal += monthlyTotals[i] || 0;
      }
      running += groupTotal;
      cumulative.push(running);
    }
    return cumulative;
  }, [groupedMonths, monthlyTotals]);

  const ROW_H = 38;
  const HEADER_W = 180;
  const CELL_W = groupBy === 1 ? 70 : groupBy === 3 ? 90 : 110;
  const GAP = 3;

  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: "75vh",
        borderRadius: 16,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <table
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: "fixed",
          direction: "rtl",
        }}
      >
        <thead>
          <tr style={{ position: "sticky", top: 0, zIndex: 30 }}>
            {/* Project name header */}
            <th style={{
              width: HEADER_W, minWidth: HEADER_W,
              position: "sticky", right: 0, zIndex: 40,
              background: "#f8fafc", padding: "10px 12px",
              textAlign: "right", fontWeight: 800, fontSize: 11,
              color: "#0f172a", borderBottom: "2px solid #e5e7eb",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }}>
              المشروع
            </th>

            {/* Paid column header */}
            <th style={{
              width: CELL_W, minWidth: CELL_W,
              background: "#374151", padding: "8px 4px",
              textAlign: "center", fontWeight: 800, fontSize: 10,
              color: "#ffffff", borderBottom: "2px solid #4b5563",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }}>
              المدفوع
            </th>

            {/* Month column headers */}
            {groupedMonths.map((gm) => (
              <th key={gm.gi} style={{
                width: CELL_W, minWidth: CELL_W,
                background: gm.gi % 2 === 0 ? "#f8fafc" : "#ffffff",
                padding: "6px 2px", textAlign: "center",
                fontWeight: 600, fontSize: groupBy === 1 ? 9 : 8,
                color: "#475569", borderBottom: "2px solid #e5e7eb",
                whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                lineHeight: 1.2,
              }}>
                {gm.label}
              </th>
            ))}

            {/* Total row header */}
            <th style={{
              width: CELL_W + 10, minWidth: CELL_W + 10,
              background: "#c2410c", padding: "8px 4px",
              textAlign: "center", fontWeight: 800, fontSize: 10,
              color: "#ffffff", borderBottom: "2px solid #c2410c",
              borderRight: `${GAP}px solid #f3f4f6`,
            }}>
              الإجمالي
            </th>
          </tr>
        </thead>

        <tbody>
          {/* Project rows */}
          {effectiveColumns.map((col, ri) => {
            const isEven = ri % 2 === 0;
            return (
              <tr key={col.projectId}>
                {/* Project name cell - sticky */}
                <td style={{
                  width: HEADER_W, minWidth: HEADER_W,
                  position: "sticky", right: 0, zIndex: 20,
                  background: isEven ? "#ffffff" : "#f8fafc",
                  padding: "6px 10px", fontWeight: 700, fontSize: 10,
                  color: "#1e293b", borderBottom: "1px solid #f1f5f9",
                  borderLeft: `${GAP}px solid #f3f4f6`,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: HEADER_W,
                }}>
                  <CellTooltip lines={[
                    col.name,
                    `الإجمالي: ${fmtTooltipNum(col.grandTotal)}`,
                    `المطلوب: ${fmtTooltipNum(col.upcomingTotal)}`,
                    `المدفوع: ${fmtTooltipNum(col.paidTotal)}`,
                  ]}>
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {col.name.length > 25 ? col.name.slice(0, 25) + "..." : col.name}
                      </div>
                      <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>
                        <span style={{ color: "#c2410c", fontWeight: 700 }}>{fmtCell(col.grandTotal)}</span>
                        {" · "}
                        <span style={{ color: "#2d6a4f", fontWeight: 600 }}>{fmtCell(col.upcomingTotal)}</span>
                      </div>
                    </div>
                  </CellTooltip>
                </td>

                {/* Paid cell */}
                <td style={{
                  width: CELL_W, minWidth: CELL_W, height: ROW_H,
                  background: col.paidTotal > 0 ? "#374151" : "#fafbfc",
                  textAlign: "center", fontSize: 10, fontWeight: 800,
                  color: col.paidTotal > 0 ? "#ffffff" : "#cbd5e1",
                  borderBottom: "1px solid #f1f5f9",
                  borderLeft: `${GAP}px solid #f3f4f6`,
                }}>
                  {col.paidTotal > 0 ? fmtCell(col.paidTotal) : ""}
                </td>

                {/* Month cells */}
                {groupedMonths.map((gm) => {
                  // Sum amounts for this group
                  let amount = 0;
                  for (let i = gm.startIdx; i <= gm.endIdx; i++) {
                    amount += col.chartAmounts[i] || 0;
                  }
                  // Determine phase at midpoint
                  const midIdx = gm.startIdx + Math.floor((gm.endIdx - gm.startIdx) / 2);
                  const phase = getPhaseAtIndex(col, midIdx);
                  const offplanOverlay = hasOffplanAtIndex(col, midIdx) && phase !== "offplan";

                  let bg = "#fafbfc";
                  let textColor = "#cbd5e1";
                  let fontW = 400;

                  if (phase && PHASE_COLORS[phase]) {
                    const colors = PHASE_COLORS[phase];
                    bg = amount > 0 ? colors.solid : colors.light;
                    textColor = amount > 0 ? "#000000" : colors.text;
                    fontW = amount > 0 ? 800 : 500;
                  }

                  // Phase position for rounded corners (horizontal: left/right instead of top/bottom)
                  const prevPhase = gm.startIdx > 0 ? getPhaseAtIndex(col, gm.startIdx - 1) : null;
                  const nextPhase = gm.endIdx < TOTAL_MONTHS - 1 ? getPhaseAtIndex(col, gm.endIdx + 1) : null;
                  const isFirst = prevPhase !== phase;
                  const isLast = nextPhase !== phase;
                  const CURVE = 10;
                  // RTL: right is start, left is end
                  const tr = isFirst ? CURVE : 0;
                  const br = isFirst ? CURVE : 0;
                  const tl = isLast ? CURVE : 0;
                  const bl = isLast ? CURVE : 0;
                  const borderRadiusStyle = `${tl}px ${tr}px ${br}px ${bl}px`;

                  return (
                    <td key={gm.gi} style={{
                      width: CELL_W, minWidth: CELL_W, height: ROW_H,
                      padding: 0, background: "#f3f4f6",
                      borderBottom: "1px solid #f3f4f6",
                    }}>
                      <CellTooltip lines={amount > 0 ? [
                        `💰 ${fmtTooltipNum(amount)}`,
                        `${col.name.split(" ").slice(0, 3).join(" ")}`,
                        `${gm.label}`,
                      ] : []}>
                        <div style={{
                          width: "100%", height: "100%",
                          background: bg, borderRadius: borderRadiusStyle,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: fontW, color: textColor,
                          position: "relative", overflow: "hidden",
                        }}>
                          {amount > 0 ? fmtCell(amount) : ""}
                          {offplanOverlay && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(245, 158, 11, 0.2)",
                              borderRadius: borderRadiusStyle,
                              pointerEvents: "none",
                            }} />
                          )}
                        </div>
                      </CellTooltip>
                    </td>
                  );
                })}

                {/* Project total */}
                <td style={{
                  width: CELL_W + 10, minWidth: CELL_W + 10, height: ROW_H,
                  background: "#c2410c", textAlign: "center",
                  fontSize: 10, fontWeight: 800, color: "#000000",
                  borderBottom: "1px solid #ea580c",
                  borderRight: `${GAP}px solid #f3f4f6`,
                }}>
                  {fmtCell(col.upcomingTotal)}
                </td>
              </tr>
            );
          })}

          {/* Separator */}
          <tr>
            <td colSpan={groupedMonths.length + 3} style={{ height: 4, background: "#f3f4f6" }} />
          </tr>

          {/* Monthly totals row */}
          <tr>
            <td style={{
              width: HEADER_W, minWidth: HEADER_W,
              position: "sticky", right: 0, zIndex: 20,
              background: "#c2410c", padding: "8px 10px",
              fontWeight: 800, fontSize: 11, color: "#ffffff",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }}>
              الإجمالي الشهري
            </td>
            <td style={{
              width: CELL_W, minWidth: CELL_W, height: ROW_H,
              background: "#374151", textAlign: "center",
              fontSize: 10, fontWeight: 800, color: "#ffffff",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }}>
              {fmtCell(effectiveColumns.reduce((s, c) => s + c.paidTotal, 0))}
            </td>
            {groupedMonths.map((gm) => {
              let total = 0;
              for (let i = gm.startIdx; i <= gm.endIdx; i++) {
                total += monthlyTotals[i] || 0;
              }
              return (
                <td key={gm.gi} style={{
                  width: CELL_W, minWidth: CELL_W, height: ROW_H,
                  background: total > 0 ? "#c2410c" : "#fafbfc",
                  textAlign: "center", fontSize: 10, fontWeight: total > 0 ? 800 : 400,
                  color: total > 0 ? "#000000" : "#94a3b8",
                }}>
                  {total > 0 ? fmtCell(total) : ""}
                </td>
              );
            })}
            <td style={{
              width: CELL_W + 10, minWidth: CELL_W + 10, height: ROW_H,
              background: "#c2410c", textAlign: "center",
              fontSize: 10, fontWeight: 800, color: "#ffffff",
              borderRight: `${GAP}px solid #f3f4f6`,
              border: "2px solid #ea580c",
            }}>
              {fmtCell(effectiveColumns.reduce((s, c) => s + c.upcomingTotal, 0))}
            </td>
          </tr>

          {/* Cumulative row */}
          <tr>
            <td style={{
              width: HEADER_W, minWidth: HEADER_W,
              position: "sticky", right: 0, zIndex: 20,
              background: "#1e3a5f", padding: "8px 10px",
              fontWeight: 800, fontSize: 11, color: "#ffffff",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }}>
              التراكمي
            </td>
            <td style={{
              width: CELL_W, minWidth: CELL_W, height: ROW_H,
              background: "#f3f4f6",
              borderLeft: `${GAP}px solid #f3f4f6`,
            }} />
            {groupedMonths.map((gm, gi) => (
              <td key={gm.gi} style={{
                width: CELL_W, minWidth: CELL_W, height: ROW_H,
                background: cumulativeTotals[gi] > 0 ? "#1e3a5f" : "#fafbfc",
                textAlign: "center", fontSize: 10, fontWeight: cumulativeTotals[gi] > 0 ? 800 : 400,
                color: cumulativeTotals[gi] > 0 ? "#000000" : "#94a3b8",
              }}>
                {cumulativeTotals[gi] > 0 ? fmtCell(cumulativeTotals[gi]) : ""}
              </td>
            ))}
            <td style={{
              width: CELL_W + 10, minWidth: CELL_W + 10, height: ROW_H,
              background: "#1e3a5f", textAlign: "center",
              fontSize: 10, fontWeight: 800, color: "#ffffff",
              borderRight: `${GAP}px solid #f3f4f6`,
              border: "2px solid #2d5a8a",
            }}>
              {cumulativeTotals.length > 0 ? fmtCell(cumulativeTotals[cumulativeTotals.length - 1]) : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
