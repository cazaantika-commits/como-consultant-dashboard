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

// Neutral base with subtle tints matching vertical view
const PHASE_BG: Record<string, string> = {
  design:       "#dce4f0", // soft blue tint
  offplan:      "#ede9de", // soft warm tint
  construction: "#d8e8df", // soft green tint
  handover:     "#e5dce3", // soft mauve tint
};

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
          background: "#1e293b", color: "#f8fafc", borderRadius: 8,
          padding: "6px 10px", fontSize: 11, fontWeight: 600,
          lineHeight: 1.6, whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          pointerEvents: "none", direction: "rtl", textAlign: "right",
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{ opacity: i === 0 ? 1 : 0.85 }}>{line}</div>
          ))}
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
            borderTop: "5px solid #1e293b",
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

  const ROW_H = 34;
  const HEADER_W = 160;
  const CELL_W = groupBy === 1 ? 52 : groupBy === 3 ? 68 : 85;

  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: "75vh",
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
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
              background: "#f9fafb", padding: "8px 10px",
              textAlign: "right", fontWeight: 700, fontSize: 10,
              color: "#374151", borderBottom: "1px solid #e5e7eb",
              borderLeft: "1px solid #e5e7eb",
            }}>
              المشروع
            </th>

            {/* Paid column header */}
            <th style={{
              width: CELL_W, minWidth: CELL_W,
              background: "#f3f4f6", padding: "6px 2px",
              textAlign: "center", fontWeight: 700, fontSize: 9,
              color: "#6b7280", borderBottom: "1px solid #e5e7eb",
              borderLeft: "1px solid #e5e7eb",
            }}>
              المدفوع
            </th>

            {/* Month column headers */}
            {groupedMonths.map((gm) => (
              <th key={gm.gi} style={{
                width: CELL_W, minWidth: CELL_W,
                background: "#f9fafb",
                padding: "4px 1px", textAlign: "center",
                fontWeight: 500, fontSize: groupBy === 1 ? 8 : 7,
                color: "#9ca3af", borderBottom: "1px solid #e5e7eb",
                borderLeft: "1px solid #f3f4f6",
                whiteSpace: groupBy === 1 ? "nowrap" : "normal",
                lineHeight: 1.2,
              }}>
                {gm.label}
              </th>
            ))}

            {/* Total header */}
            <th style={{
              width: CELL_W + 5, minWidth: CELL_W + 5,
              background: "#f3f4f6", padding: "6px 2px",
              textAlign: "center", fontWeight: 700, fontSize: 9,
              color: "#6b7280", borderBottom: "1px solid #e5e7eb",
              borderRight: "1px solid #e5e7eb",
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
                  background: isEven ? "#ffffff" : "#fafbfc",
                  padding: "4px 8px", fontWeight: 600, fontSize: 9,
                  color: "#374151", borderBottom: "1px solid #f3f4f6",
                  borderLeft: "1px solid #e5e7eb",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: HEADER_W,
                }}>
                  <CellTooltip lines={[
                    col.name,
                    `الإجمالي: ${fmtTooltipNum(col.grandTotal)}`,
                    `المطلوب: ${fmtTooltipNum(col.upcomingTotal)}`,
                    `المدفوع: ${fmtTooltipNum(col.paidTotal)}`,
                  ]}>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {col.name.length > 22 ? col.name.slice(0, 22) + "…" : col.name}
                      </div>
                      <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 1 }}>
                        {fmtCell(col.grandTotal)} · {fmtCell(col.upcomingTotal)}
                      </div>
                    </div>
                  </CellTooltip>
                </td>

                {/* Paid cell */}
                <td style={{
                  width: CELL_W, minWidth: CELL_W, height: ROW_H,
                  background: col.paidTotal > 0 ? "#f3f4f6" : "#fafbfc",
                  textAlign: "center", fontSize: 9, fontWeight: 700,
                  color: col.paidTotal > 0 ? "#374151" : "#d1d5db",
                  borderBottom: "1px solid #f3f4f6",
                  borderLeft: "1px solid #e5e7eb",
                }}>
                  {col.paidTotal > 0 ? fmtCell(col.paidTotal) : ""}
                </td>

                {/* Month cells */}
                {groupedMonths.map((gm) => {
                  let amount = 0;
                  for (let i = gm.startIdx; i <= gm.endIdx; i++) {
                    amount += col.chartAmounts[i] || 0;
                  }
                  const midIdx = gm.startIdx + Math.floor((gm.endIdx - gm.startIdx) / 2);
                  const phase = getPhaseAtIndex(col, midIdx);

                  let bg = "#ffffff";
                  if (phase && PHASE_BG[phase]) {
                    bg = PHASE_BG[phase];
                  }

                  return (
                    <td key={gm.gi} style={{
                      width: CELL_W, minWidth: CELL_W, height: ROW_H,
                      padding: 0,
                      background: bg,
                      borderBottom: "1px solid #f3f4f6",
                      borderLeft: "1px solid #f3f4f6",
                      textAlign: "center",
                      fontSize: 9, fontWeight: amount > 0 ? 700 : 400,
                      color: amount > 0 ? "#1f2937" : "transparent",
                    }}>
                      <CellTooltip lines={amount > 0 ? [
                        `${fmtTooltipNum(amount)}`,
                        `${col.name.split(" ").slice(0, 3).join(" ")}`,
                        `${gm.label}`,
                      ] : []}>
                        <div style={{
                          width: "100%", height: "100%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {amount > 0 ? fmtCell(amount) : ""}
                        </div>
                      </CellTooltip>
                    </td>
                  );
                })}

                {/* Project total */}
                <td style={{
                  width: CELL_W + 5, minWidth: CELL_W + 5, height: ROW_H,
                  background: "#f9fafb", textAlign: "center",
                  fontSize: 9, fontWeight: 700, color: "#374151",
                  borderBottom: "1px solid #f3f4f6",
                  borderRight: "1px solid #e5e7eb",
                }}>
                  {fmtCell(col.upcomingTotal)}
                </td>
              </tr>
            );
          })}

          {/* Monthly totals row */}
          <tr>
            <td style={{
              width: HEADER_W, minWidth: HEADER_W,
              position: "sticky", right: 0, zIndex: 20,
              background: "#f3f4f6", padding: "6px 8px",
              fontWeight: 700, fontSize: 10, color: "#374151",
              borderTop: "2px solid #e5e7eb",
              borderLeft: "1px solid #e5e7eb",
            }}>
              الإجمالي الشهري
            </td>
            <td style={{
              width: CELL_W, minWidth: CELL_W, height: ROW_H,
              background: "#f3f4f6", textAlign: "center",
              fontSize: 9, fontWeight: 700, color: "#374151",
              borderTop: "2px solid #e5e7eb",
              borderLeft: "1px solid #e5e7eb",
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
                  background: "#f3f4f6",
                  textAlign: "center", fontSize: 9, fontWeight: total > 0 ? 700 : 400,
                  color: total > 0 ? "#374151" : "#d1d5db",
                  borderTop: "2px solid #e5e7eb",
                  borderLeft: "1px solid #f3f4f6",
                }}>
                  {total > 0 ? fmtCell(total) : ""}
                </td>
              );
            })}
            <td style={{
              width: CELL_W + 5, minWidth: CELL_W + 5, height: ROW_H,
              background: "#e5e7eb", textAlign: "center",
              fontSize: 9, fontWeight: 800, color: "#1f2937",
              borderTop: "2px solid #e5e7eb",
              borderRight: "1px solid #e5e7eb",
            }}>
              {fmtCell(effectiveColumns.reduce((s, c) => s + c.upcomingTotal, 0))}
            </td>
          </tr>

          {/* Cumulative row */}
          <tr>
            <td style={{
              width: HEADER_W, minWidth: HEADER_W,
              position: "sticky", right: 0, zIndex: 20,
              background: "#f9fafb", padding: "6px 8px",
              fontWeight: 700, fontSize: 10, color: "#6b7280",
              borderLeft: "1px solid #e5e7eb",
            }}>
              التراكمي
            </td>
            <td style={{
              width: CELL_W, minWidth: CELL_W, height: ROW_H,
              background: "#f9fafb",
              borderLeft: "1px solid #e5e7eb",
            }} />
            {groupedMonths.map((gm, gi) => (
              <td key={gm.gi} style={{
                width: CELL_W, minWidth: CELL_W, height: ROW_H,
                background: "#f9fafb",
                textAlign: "center", fontSize: 9, fontWeight: cumulativeTotals[gi] > 0 ? 600 : 400,
                color: cumulativeTotals[gi] > 0 ? "#6b7280" : "#d1d5db",
                borderLeft: "1px solid #f3f4f6",
              }}>
                {cumulativeTotals[gi] > 0 ? fmtCell(cumulativeTotals[gi]) : ""}
              </td>
            ))}
            <td style={{
              width: CELL_W + 5, minWidth: CELL_W + 5, height: ROW_H,
              background: "#e5e7eb", textAlign: "center",
              fontSize: 9, fontWeight: 800, color: "#374151",
              borderRight: "1px solid #e5e7eb",
            }}>
              {cumulativeTotals.length > 0 ? fmtCell(cumulativeTotals[cumulativeTotals.length - 1]) : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
