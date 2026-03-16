import { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Layers, ChevronDown, ChevronUp, RotateCcw, Settings, Calendar, Clock, Save, X, Eye, EyeOff } from "lucide-react";

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

// ── Phase colors (cheerful balanced palette) ──────────────────────────────
// Vibrant & balanced: sky blue design, golden yellow offplan, fresh green construction, warm pink handover
const PHASE_COLORS = {
  land:         { solid: "#6b7280", light: "#f3f4f6", text: "#374151" },
  design:       { solid: "#f472b6", light: "#fdf2f8", text: "#db2777" },
  offplan:      { solid: "#f59e0b", light: "#fef3c7", text: "#b45309" },
  construction: { solid: "#34d399", light: "#ecfdf5", text: "#059669" },
  handover:     { solid: "#ec4899", light: "#fce7f3", text: "#be185d" },
} as const;

type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

const PHASE_NAMES: Record<PhaseType, string> = {
  land: "الأرض / المدفوع",
  design: "التصاميم والاعتمادات",
  offplan: "أوف بلان",
  construction: "الإنشاء",
  handover: "التسليم",
};

function fmtTooltipNum(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M AED`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K AED`;
  return `${n.toFixed(0)} AED`;
}

// ── Lightweight hover tooltip (uses portal to escape overflow:auto) ──────
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
    <div
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
      {show && createPortal(
        <div
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translate(-50%, -100%)",
            zIndex: 99999,
            background: "#1e293b",
            color: "#f8fafc",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.7,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            pointerEvents: "none",
            direction: "rtl",
            textAlign: "right",
          }}
        >
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

  const [showSettings, setShowSettings] = useState(false);
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ startDate: string; preDevMonths: number; constructionMonths: number; handoverMonths: number }>({ startDate: '2026-04', preDevMonths: 6, constructionMonths: 16, handoverMonths: 2 });
  const [hiddenProjects, setHiddenProjects] = useState<Set<number>>(new Set());

  const updateProjectMutation = trpc.cashFlowProgram.updateProjectScheduleSettings.useMutation({
    onSuccess: () => {
      scheduleQuery.refetch();
      setEditingProject(null);
    },
  });

  // ─── DB-backed phase delays ─────────────────────────────────────
  const delaysQuery = trpc.cashFlowProgram.getPhaseDelays.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 30000 }
  );
  const setDelayMutation = trpc.cashFlowProgram.setPhaseDelay.useMutation({
    onSuccess: () => { delaysQuery.refetch(); },
  });

  // Local optimistic state layered on top of DB data
  const [localDelays, setLocalDelays] = useState<Record<number, DelayState>>({});
  const dbDelays = useMemo(() => (delaysQuery.data || {}) as Record<number, DelayState>, [delaysQuery.data]);

  // Merge: local overrides take precedence while mutation is in-flight
  const delays = useMemo(() => {
    const merged: Record<number, DelayState> = { ...dbDelays };
    for (const [k, v] of Object.entries(localDelays)) {
      merged[Number(k)] = v;
    }
    return merged;
  }, [dbDelays, localDelays]);

  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
  }

  function adjustDelay(projectId: number, phase: keyof DelayState, delta: number) {
    const cur = getDelay(projectId);
    const newVal = Math.max(0, cur[phase] + delta);
    const updated = { ...cur, [phase]: newVal };
    // Optimistic local update
    setLocalDelays(prev => ({ ...prev, [projectId]: updated }));
    // Persist to DB
    setDelayMutation.mutate({
      projectId,
      designDelay: updated.designDelay,
      offplanDelay: updated.offplanDelay,
      constructionDelay: updated.constructionDelay,
    });
  }

  function resetDelay(projectId: number) {
    const zero = { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
    setLocalDelays(prev => ({ ...prev, [projectId]: zero }));
    setDelayMutation.mutate({ projectId, ...zero });
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
    return baseColumns.filter(col => !hiddenProjects.has(col.projectId)).map((col) => {
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

      // Build item-level chart breakdown: maps chart index → [{name, amount}]
      const itemChartBreakdown: Record<number, { name: string; amount: number }[]> = {};
      if (col.itemBreakdown) {
        for (const [monthStr, items] of Object.entries(col.itemBreakdown)) {
          const m = parseInt(monthStr);
          if (hasDelay && paidStatus[m]) continue;

          // Determine which phase this month belongs to, to apply correct delay
          let chartIdx: number;
          // Check phase order: land(0), design(1..designMonths), offplan(overlaps), construction, handover
          if (m === 0) {
            chartIdx = projectMonthToChartIndex(col.startDate, 0) - 1;
          } else {
            // Find which phase this month belongs to by checking phaseMonthlyAmounts
            const phaseOrder: PhaseType[] = ["offplan", "design", "construction", "handover"];
            let foundPhase: PhaseType = "construction";
            for (const p of phaseOrder) {
              if (col.phaseMonthlyAmounts?.[p]?.[String(m)] && Number(col.phaseMonthlyAmounts[p][String(m)]) > 0) {
                foundPhase = p;
                break;
              }
            }
            const baseChartIdx = projectMonthToChartIndex(col.startDate, m - 1);
            if (foundPhase === "design") {
              chartIdx = baseChartIdx + delay.designDelay;
            } else if (foundPhase === "offplan") {
              chartIdx = baseChartIdx + delay.designDelay + delay.offplanDelay;
            } else {
              chartIdx = baseChartIdx + delay.designDelay + delay.constructionDelay;
            }
          }

          if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
            if (!itemChartBreakdown[chartIdx]) itemChartBreakdown[chartIdx] = [];
            for (const item of items) {
              if (item.amount <= 0) continue;
              // Merge with existing item of same name at same chartIdx
              const existing = itemChartBreakdown[chartIdx].find(e => e.name === item.name);
              if (existing) {
                existing.amount += item.amount;
              } else {
                itemChartBreakdown[chartIdx].push({ name: item.name, amount: item.amount });
              }
            }
          }
        }
      }

      // Aggregate all phases EXCEPT land into chartAmounts for totals
      // Land/paid amounts are already paid and should not appear in the monthly schedule
      const chartAmounts: Record<number, number> = {};
      for (const phase of phaseTypes) {
        if (phase === "land") continue; // Skip paid amounts
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
        itemChartBreakdown,
        ...delay,
      };
    });
  }, [baseColumns, delays, hiddenProjects]);

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

  // Determine the BASE phase for a given chart index (design, construction, handover)
  // Off-plan is treated as an overlay, not a base phase
  function getBasePhaseAtIndex(col: typeof effectiveColumns[0], chartIdx: number): PhaseType | null {
    // Check base phases (everything except offplan) for actual amounts
    const basePhases: PhaseType[] = ["design", "construction", "handover"];
    const phasesWithAmounts: { phase: PhaseType; amount: number }[] = [];
    for (const phase of basePhases) {
      const amt = col.phaseChartAmounts[phase]?.[chartIdx] || 0;
      if (amt > 0) phasesWithAmounts.push({ phase, amount: amt });
    }
    if (phasesWithAmounts.length > 0) {
      phasesWithAmounts.sort((a, b) => b.amount - a.amount);
      return phasesWithAmounts[0].phase;
    }
    // If only offplan has amounts here, determine underlying base phase from geometric ranges
    const offplanAmt = col.phaseChartAmounts.offplan?.[chartIdx] || 0;
    if (offplanAmt > 0) {
      // Off-plan overlaps: determine which base phase is underneath
      const { phaseRanges } = col;
      if (chartIdx >= phaseRanges.design.start && chartIdx <= phaseRanges.design.end) return "design";
      if (chartIdx >= phaseRanges.construction.start && chartIdx <= phaseRanges.construction.end) return "construction";
      // Between design and construction
      if (chartIdx > phaseRanges.design.end && chartIdx < phaseRanges.construction.start) return "offplan";
      return "offplan"; // standalone offplan
    }
    // Fallback: geometric ranges for light-colored background cells
    const { phaseRanges } = col;
    if (chartIdx >= phaseRanges.design.start && chartIdx <= phaseRanges.design.end) return "design";
    if (chartIdx >= phaseRanges.construction.start && chartIdx <= phaseRanges.construction.end) return "construction";
    if (chartIdx >= phaseRanges.handover.start && chartIdx <= phaseRanges.handover.end) return "handover";
    // Check if in offplan-only zone (between design and construction)
    if (chartIdx >= phaseRanges.offplan.start && chartIdx <= phaseRanges.offplan.end && col.offplanMonths > 0) return "offplan";
    return null;
  }

  // Check if off-plan overlay exists at this chart index
  function hasOffplanAtIndex(col: typeof effectiveColumns[0], chartIdx: number): boolean {
    // Check actual amounts
    const offplanAmt = col.phaseChartAmounts.offplan?.[chartIdx] || 0;
    if (offplanAmt > 0) return true;
    // Check geometric range
    const { phaseRanges } = col;
    return chartIdx >= phaseRanges.offplan.start && chartIdx <= phaseRanges.offplan.end && col.offplanMonths > 0;
  }

  // Legacy wrapper for backward compatibility
  function getPhaseAtIndex(col: typeof effectiveColumns[0], chartIdx: number): PhaseType | null {
    return getBasePhaseAtIndex(col, chartIdx);
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
        // Check if offplan overlay exists at this row
        const offplanOverlay = hasOffplanAtIndex(col, midIdx);
        // Offplan overlay position (for rounded corners on overlay)
        const prevHasOffplan = startIdx > 0 ? hasOffplanAtIndex(col, startIdx - 1) : false;
        const nextHasOffplan = endIdx < TOTAL_MONTHS - 1 ? hasOffplanAtIndex(col, endIdx + 1) : false;
        const isOffplanFirst = offplanOverlay && !prevHasOffplan;
        const isOffplanLast = offplanOverlay && !nextHasOffplan;
        return { colId: col.projectId, amount, phase, isFirst, isLast, offplanOverlay, isOffplanFirst, isOffplanLast };
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
          <div className="w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto" />
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
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
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
              background: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(13,148,136,0.3)",
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
              { phase: "design" as const, label: "التصاميم" },
              { phase: "construction" as const, label: "الإنشاء" },
              { phase: "handover" as const, label: "التسليم" },
            ]).map(({ phase, label }) => (
              <div key={phase} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: PHASE_COLORS[phase].solid }} />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
            ))}
            {/* Off-plan overlay indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 4,
                background: `linear-gradient(135deg, ${PHASE_COLORS.design.solid} 50%, ${PHASE_COLORS.construction.solid} 50%)`,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(192, 139, 74, 0.3)",
                  borderRadius: 4,
                }} />
              </div>
              <span style={{ fontWeight: 600 }}>أوف بلان</span>
            </div>
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showSettings ? "#0d9488" : "#ffffff",
              color: showSettings ? "#fff" : "#64748b",
              border: "1px solid " + (showSettings ? "#0d9488" : "#e2e8f0"),
              borderRadius: 10, padding: "6px 14px", cursor: "pointer",
              fontSize: 12, fontWeight: 700, transition: "all 0.2s",
            }}
          >
            <Settings style={{ width: 14, height: 14 }} />
            إعدادات المشاريع
          </button>

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
                  color: groupBy === g ? "#fff" : "#94a3b8",
                }}
              >
                {g === 1 ? "شهري" : g === 3 ? "ربع سنوي" : "نصف سنوي"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Project Settings Panel ───────────────────────────────────── */}
      {showSettings && (
        <div style={{
          background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb",
          padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Settings style={{ width: 16, height: 16, color: "#0d9488" }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>إعدادات المشاريع — تواريخ البداية والمدد</span>
            </div>
            <button onClick={() => setShowSettings(false)} style={{
              background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, color: "#64748b", fontWeight: 700,
            }}>
              <X style={{ width: 12, height: 12 }} /> إغلاق
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f5f3f0" }}>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>المشروع</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Calendar style={{ width: 12, height: 12 }} /> تاريخ البداية
                    </div>
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: PHASE_COLORS.design.text, borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Clock style={{ width: 12, height: 12 }} /> التصاميم (شهر)
                    </div>
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: PHASE_COLORS.construction.text, borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Clock style={{ width: 12, height: 12 }} /> الإنشاء (شهر)
                    </div>
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Clock style={{ width: 12, height: 12 }} /> التسليم (شهر)
                    </div>
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>إظهار</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {baseColumns.map((col) => {
                  const isEditing = editingProject !== null && editingProject === col.projectId;
                  return (
                    <tr key={col.projectId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: hiddenProjects.has(col.projectId) ? "#94a3b8" : "#1e293b", maxWidth: 200, opacity: hiddenProjects.has(col.projectId) ? 0.5 : 1 }}>{col.name}</td>
                      {isEditing ? (
                        <>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <input type="month" value={editForm.startDate}
                              onChange={(e) => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                              style={{ padding: "4px 8px", borderRadius: 8, border: "2px solid #2b7a8e", fontSize: 12, textAlign: "center", width: 130, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <input type="number" min={1} max={36} value={editForm.preDevMonths}
                              onChange={(e) => setEditForm(f => ({ ...f, preDevMonths: parseInt(e.target.value) || 1 }))}
                              style={{ padding: "4px 8px", borderRadius: 8, border: `2px solid ${PHASE_COLORS.design.solid}`, fontSize: 12, textAlign: "center", width: 60, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <input type="number" min={1} max={60} value={editForm.constructionMonths}
                              onChange={(e) => setEditForm(f => ({ ...f, constructionMonths: parseInt(e.target.value) || 1 }))}
                              style={{ padding: "4px 8px", borderRadius: 8, border: `2px solid ${PHASE_COLORS.construction.solid}`, fontSize: 12, textAlign: "center", width: 60, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <input type="number" min={1} max={12} value={editForm.handoverMonths}
                              onChange={(e) => setEditForm(f => ({ ...f, handoverMonths: parseInt(e.target.value) || 1 }))}
                              style={{ padding: "4px 8px", borderRadius: 8, border: "2px solid #94a3b8", fontSize: 12, textAlign: "center", width: 60, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <button
                              onClick={() => {
                                setHiddenProjects(prev => {
                                  const next = new Set(prev);
                                  if (next.has(col.projectId)) next.delete(col.projectId);
                                  else next.add(col.projectId);
                                  return next;
                                });
                              }}
                              style={{
                                background: hiddenProjects.has(col.projectId) ? "#fee2e2" : "#dcfce7",
                                color: hiddenProjects.has(col.projectId) ? "#dc2626" : "#16a34a",
                                border: `1px solid ${hiddenProjects.has(col.projectId) ? "#fca5a5" : "#86efac"}`,
                                borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                            >
                              {hiddenProjects.has(col.projectId) ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                              {hiddenProjects.has(col.projectId) ? "مخفي" : "ظاهر"}
                            </button>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button
                                onClick={() => {
                                  updateProjectMutation.mutate({
                                    projectId: col.projectId,
                                    startDate: editForm.startDate,
                                    preConMonths: editForm.preDevMonths,
                                    constructionMonths: editForm.constructionMonths,
                                    handoverMonths: editForm.handoverMonths,
                                  });
                                }}
                                disabled={updateProjectMutation.isPending}
                                style={{
                                  background: "#10B981", color: "#fff", border: "none", borderRadius: 8,
                                  padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                  display: "flex", alignItems: "center", gap: 4, opacity: updateProjectMutation.isPending ? 0.6 : 1,
                                }}
                              >
                                <Save style={{ width: 11, height: 11 }} /> حفظ
                              </button>
                              <button
                                onClick={() => setEditingProject(null)}
                                style={{
                                  background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8,
                                  padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                }}
                              >
                                إلغاء
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "#334155", fontWeight: 600 }}>{col.startDate}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <span style={{ background: PHASE_COLORS.design.light, color: PHASE_COLORS.design.text, padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{col.preDevMonths}</span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <span style={{ background: PHASE_COLORS.construction.light, color: PHASE_COLORS.construction.text, padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{col.constructionMonths}</span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <span style={{ background: "#f5f3f0", color: "#475569", padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{col.handoverMonths}</span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => {
                                setHiddenProjects(prev => {
                                  const next = new Set(prev);
                                  if (next.has(col.projectId)) next.delete(col.projectId);
                                  else next.add(col.projectId);
                                  return next;
                                });
                              }}
                              style={{
                                background: hiddenProjects.has(col.projectId) ? "#fee2e2" : "#dcfce7",
                                color: hiddenProjects.has(col.projectId) ? "#dc2626" : "#16a34a",
                                border: `1px solid ${hiddenProjects.has(col.projectId) ? "#fca5a5" : "#86efac"}`,
                                borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                            >
                              {hiddenProjects.has(col.projectId) ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                              {hiddenProjects.has(col.projectId) ? "مخفي" : "ظاهر"}
                            </button>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => {
                                setEditingProject(col.projectId);
                                setEditForm({
                                  startDate: col.startDate,
                                  preDevMonths: col.preDevMonths,
                                  constructionMonths: col.constructionMonths,
                                  handoverMonths: col.handoverMonths,
                                });
                              }}
                              style={{
                                background: "#ccfbf1", color: "#0f766e", border: "1px solid #5eead4", borderRadius: 8,
                                padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                            >
                              <Settings style={{ width: 11, height: 11 }} /> تعديل
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Gantt Table ──────────────────────────────────────────────────── */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "75vh",
          borderRadius: 16,
          background: "#fafbfc",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)",
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
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f5f3f0` : "none",
                      padding: 0,
                      verticalAlign: "top",
                      background: "#f5f3f0",
                    }}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        borderRadius: 14,
                        padding: "8px 6px 8px",
                        border: "1px solid #d1d5db",
                        borderTop: "3px solid #0d9488",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                      }}
                    >
                      {/* Project name - fixed height for alignment */}
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: "#0f172a",
                        textAlign: "center", lineHeight: 1.4,
                        height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 2px",
                        wordBreak: "break-word",
                      }}>
                        {col.name}
                      </div>

                      {/* الإجمالي row - fixed height for alignment */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        height: 22,
                        background: "#0d9488", borderRadius: 6,
                        padding: "0 6px", marginTop: 4,
                        fontSize: 9,
                      }}>
                        <span style={{ color: "#ccfbf1", fontWeight: 600 }}>الإجمالي</span>
                        <span style={{ fontWeight: 800, color: "#ffffff" }}>{fmtFull(col.grandTotal)}</span>
                      </div>

                      {/* المطلوب row - fixed height for alignment */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        height: 22,
                        background: "#10b981", borderRadius: 6,
                        padding: "0 6px", marginTop: 3, marginBottom: 6,
                        fontSize: 9,
                      }}>
                        <span style={{ color: "#d1fae5", fontWeight: 600 }}>المطلوب</span>
                        <span style={{ fontWeight: 800, color: "#ffffff" }}>{fmtFull(col.upcomingTotal)}</span>
                      </div>

                      {/* Delay badge */}
                      {hasDelay && (
                        <div style={{
                          background: "#0d9488", borderRadius: 6,
                          padding: "2px 4px", marginBottom: 4, textAlign: "center",
                          fontSize: 8, color: "#ccfbf1", fontWeight: 700,
                          border: "1px solid #14b8a6",
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
                        color="#1d4ed8"
                        lightBg="#dbeafe"
                        borderColor="#3b82f6"
                        value={delay.designDelay}
                        onUp={() => adjustDelay(col.projectId, "designDelay", -1)}
                        onDown={() => adjustDelay(col.projectId, "designDelay", 1)}
                      />

                      {/* Offplan delay controls */}
                      <DelayControl
                        label="أوف بلان"
                        color="#b45309"
                        lightBg="#fef3c7"
                        borderColor="#f59e0b"
                        value={delay.offplanDelay}
                        onUp={() => adjustDelay(col.projectId, "offplanDelay", -1)}
                        onDown={() => adjustDelay(col.projectId, "offplanDelay", 1)}
                      />

                      {/* Construction delay controls */}
                      <DelayControl
                        label="الإنشاء"
                        color="#047857"
                        lightBg="#d1fae5"
                        borderColor="#10b981"
                        value={delay.constructionDelay}
                        onUp={() => adjustDelay(col.projectId, "constructionDelay", -1)}
                        onDown={() => adjustDelay(col.projectId, "constructionDelay", 1)}
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
                  borderLeft: `${GAP}px solid #f5f3f0`,
                  borderRight: `${GAP}px solid #f5f3f0`,
                  verticalAlign: "bottom",
                  background: "#f5f3f0",
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
                  borderTop: "3px solid #64748b",
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
                  background: "#f5f3f0",
                }}
              >
                <div style={{
                  background: "#0f766e",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "1px solid #14b8a6",
                  borderTop: "3px solid #0d9488",
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
                  background: "#f5f3f0",
                }}
              >
                <div style={{
                  background: "#3b82f6",
                  borderRadius: 14,
                  padding: "14px 6px",
                  textAlign: "center",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 800,
                  border: "1px solid #60a5fa",
                  borderTop: "3px solid #2563eb",
                }}>
                  التراكمي
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ── Paid Summary Row ─────────────────────────── */}
            <tr>
              {effectiveColumns.map((col, ci) => (
                <td
                  key={`paid-${col.projectId}`}
                  style={{
                    width: COL_W,
                    minWidth: COL_W,
                    height: ROW_H + 4,
                    padding: 0,
                    borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f5f3f0` : "none",
                    background: "#f5f3f0",
                  }}
                >
                  <CellTooltip lines={col.paidTotal > 0 ? (() => {
                    const lines: string[] = [
                      `💰 المدفوع: ${fmtTooltipNum(col.paidTotal)}`,
                      "───────────────",
                    ];
                    // Show land items from itemBreakdown month 0
                    const landItems = col.itemBreakdown?.["0"] || col.itemBreakdown?.[0 as any];
                    if (landItems && Array.isArray(landItems)) {
                      const sorted = [...landItems].filter(i => i.amount > 0).sort((a, b) => b.amount - a.amount);
                      for (const item of sorted) {
                        lines.push(`${item.name}: ${fmtTooltipNum(item.amount)}`);
                      }
                    }
                    return lines;
                  })() : []}>
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: col.paidTotal > 0 ? "#134e4a" : "#fafbfc",
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        border: col.paidTotal > 0 ? "1px solid #0d9488" : "none",
                        cursor: col.paidTotal > 0 ? "default" : undefined,
                      }}
                    >
                      {col.paidTotal > 0 && (
                        <>
                          <span style={{ fontSize: 7, color: "#5eead4", fontWeight: 600 }}>المدفوع</span>
                          <span style={{ fontSize: 11, color: "#ffffff", fontWeight: 800 }}>{fmtCell(col.paidTotal)}</span>
                        </>
                      )}
                    </div>
                  </CellTooltip>
                </td>
              ))}
              {/* Date cell */}
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                fontSize: 10, fontWeight: 700, color: "#ffffff",
                textAlign: "center", background: "#0f766e",
                borderLeft: `${GAP}px solid #f5f3f0`,
                borderRight: `${GAP}px solid #f5f3f0`,
              }}>
                المدفوع
              </td>
              {/* Total paid cell */}
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#0f766e", textAlign: "center",
                fontSize: 11, fontWeight: 800, color: "#ffffff",
                border: "1px solid #14b8a6", borderRadius: 8,
                padding: 0,
              }}>
                <CellTooltip lines={(() => {
                  const total = effectiveColumns.reduce((s, c) => s + c.paidTotal, 0);
                  const lines: string[] = [
                    `💰 إجمالي المدفوع: ${fmtTooltipNum(total)}`,
                    "─── توزيع حسب المشروع ───",
                  ];
                  for (const c of effectiveColumns) {
                    if (c.paidTotal <= 0) continue;
                    lines.push(`${c.name.split(" ").slice(0, 3).join(" ")}: ${fmtTooltipNum(c.paidTotal)}`);
                  }
                  return lines;
                })()}>
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fmtCell(effectiveColumns.reduce((s, c) => s + c.paidTotal, 0))}
                  </div>
                </CellTooltip>
              </td>
              {/* Empty cumulative cell */}
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#f5f3f0", paddingRight: GAP,
              }} />
            </tr>

            {/* ── Separator Row ─────────────────────────── */}
            <tr>
              <td colSpan={effectiveColumns.length + 3} style={{ height: 6, background: "#f5f3f0" }} />
            </tr>

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
                      textColor = cd.amount > 0 ? "#000000" : colors.text;
                      fontW     = cd.amount > 0 ? 800 : 500;
                      if (cd.isFirst) { tl = CURVE; tr = CURVE; }
                      if (cd.isLast) { bl = CURVE; br = CURVE; }
                    }

                    const borderRadiusStyle = `${tl}px ${tr}px ${br}px ${bl}px`;

                    // Off-plan overlay: transparent pink layer on top
                    const showOffplanOverlay = cd.offplanOverlay && phase !== "offplan";
                    const offplanOverlayTl = cd.isOffplanFirst ? CURVE : 0;
                    const offplanOverlayTr = cd.isOffplanFirst ? CURVE : 0;
                    const offplanOverlayBl = cd.isOffplanLast ? CURVE : 0;
                    const offplanOverlayBr = cd.isOffplanLast ? CURVE : 0;
                    const offplanOverlayRadius = `${offplanOverlayTl}px ${offplanOverlayTr}px ${offplanOverlayBr}px ${offplanOverlayBl}px`;

                    return (
                      <td
                        key={`col-${cd.colId}`}
                        style={{
                          width: COL_W,
                          minWidth: COL_W,
                          height: ROW_H,
                          padding: 0,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f5f3f0` : "none",
                          background: "#f5f3f0",
                        }}
                      >
                        <CellTooltip lines={cd.amount > 0 ? (() => {
                          const col = effectiveColumns[ci];
                          const lines: string[] = [
                            `💰 ${fmtTooltipNum(cd.amount)}`,
                            "───────────────",
                          ];
                          // Collect item breakdown for all months in this grouped row
                          const mergedItems: Record<string, number> = {};
                          for (let idx = row.startIdx; idx <= row.endIdx; idx++) {
                            const items = col.itemChartBreakdown?.[idx];
                            if (items) {
                              for (const item of items) {
                                mergedItems[item.name] = (mergedItems[item.name] || 0) + item.amount;
                              }
                            }
                          }
                          // Sort by amount descending
                          const sorted = Object.entries(mergedItems)
                            .filter(([, v]) => v > 0)
                            .sort((a, b) => b[1] - a[1]);
                          if (sorted.length > 0) {
                            for (const [name, amt] of sorted) {
                              lines.push(`${name}: ${fmtTooltipNum(amt)}`);
                            }
                          } else {
                            lines.push("لا يوجد تفصيل");
                          }
                          return lines;
                        })() : []}>
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
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {cd.amount > 0 ? fmtCell(cd.amount) : ""}
                            {/* Off-plan transparent overlay */}
                            {showOffplanOverlay && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background: "rgba(245, 158, 11, 0.2)",
                                  borderRadius: offplanOverlayRadius,
                                  pointerEvents: "none",
                                  borderTop: cd.isOffplanFirst ? "2px solid rgba(245, 158, 11, 0.5)" : "none",
                                  borderBottom: cd.isOffplanLast ? "2px solid rgba(245, 158, 11, 0.25)" : "none",
                                  borderRight: "1.5px solid rgba(245, 158, 11, 0.35)",
                                  borderLeft: "1.5px solid rgba(245, 158, 11, 0.4)",
                                }}
                              />
                            )}
                          </div>
                        </CellTooltip>
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
                      borderLeft: `${GAP}px solid #f5f3f0`,
                      borderRight: `${GAP}px solid #f5f3f0`,
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
                      background: row.total > 0 ? "#0f766e" : (isEven ? "#ffffff" : "#f8fafc"),
                      padding: 0,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: row.total > 0 ? 800 : 400,
                      color: row.total > 0 ? "#000000" : "#94a3b8",
                    }}
                  >
                    <CellTooltip lines={row.total > 0 ? (() => {
                      const lines: string[] = [
                        `💰 الإجمالي: ${fmtTooltipNum(row.total)}`,
                        "─── توزيع حسب المشروع ───",
                      ];
                      for (const cd of row.colData) {
                        if (cd.amount <= 0) continue;
                        const col = effectiveColumns.find(c => c.projectId === cd.colId);
                        const shortName = col?.name?.split(" ").slice(0, 3).join(" ") || "مشروع";
                        lines.push(`${shortName}: ${fmtTooltipNum(cd.amount)}`);
                      }
                      return lines;
                    })() : []}>
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                        {row.total > 0 ? fmtCell(row.total) : ""}
                      </div>
                    </CellTooltip>
                  </td>

                  {/* Cumulative total cell */}
                  <td
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      height: ROW_H,
                      background: cumulativeTotals[row.gi] > 0 ? "#3b82f6" : (isEven ? "#ffffff" : "#f8fafc"),
                      padding: 0,
                      paddingRight: GAP,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: cumulativeTotals[row.gi] > 0 ? 800 : 400,
                      color: cumulativeTotals[row.gi] > 0 ? "#000000" : "#94a3b8",
                    }}
                  >
                    <CellTooltip lines={cumulativeTotals[row.gi] > 0 ? [
                      `📊 التراكمي: ${fmtTooltipNum(cumulativeTotals[row.gi])}`,
                      `💰 هذا الشهر: ${fmtTooltipNum(row.total)}`,
                    ] : []}>
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                        {cumulativeTotals[row.gi] > 0 ? fmtCell(cumulativeTotals[row.gi]) : ""}
                      </div>
                    </CellTooltip>
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
        title={`تقديم ${label} شهر واحد`}
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
        title={`تأجيل ${label} شهر واحد`}
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
