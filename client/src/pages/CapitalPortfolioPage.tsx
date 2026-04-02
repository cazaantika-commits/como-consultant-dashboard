import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "@/contexts/CCAuthContext";
import {
  Layers, ArrowRight, ChevronDown, ChevronUp,
  RotateCcw, Settings, Calendar, Clock, Save, X,
  Eye, EyeOff, LayoutGrid, Rows3, Download,
} from "lucide-react";


// ── Types ────────────────────────────────────────────────────────────────────
type ScenarioKey = "offplan_escrow" | "offplan_construction" | "no_offplan";
type OptionKey = "o1" | "o2" | "o3";

const OPTION_TO_SCENARIO: Record<OptionKey, ScenarioKey> = {
  o1: "offplan_escrow",
  o2: "offplan_construction",
  o3: "no_offplan",
};

const OPTION_LABELS: Record<OptionKey, string> = {
  o1: "O1",
  o2: "O2",
  o3: "O3",
};

const OPTION_COLORS: Record<OptionKey, { bg: string; text: string; border: string; activeBg: string }> = {
  o1: { bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff", activeBg: "#7c3aed" },
  o2: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe", activeBg: "#2563eb" },
  o3: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", activeBg: "#16a34a" },
};

const TOTAL_MONTHS = 48;
const CHART_START = new Date(2026, 3, 1); // April 2026

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ── Phase colors (same as CapitalSchedulingPage) ─────────────────────────────
const PHASE_COLORS = {
  land:         { solid: "#6b7280", light: "#f9fafb", text: "#4b5563" },
  design:       { solid: "#fb923c", light: "#fff7ed", text: "#c2410c" },
  offplan:      { solid: "#db2777", light: "#fdf2f8", text: "#9d174d" },
  construction: { solid: "#7c3aed", light: "#f5f3ff", text: "#5b21b6" },
  handover:     { solid: "#64748b", light: "#f8fafc", text: "#334155" },
} as const;

type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

// ── Helpers ──────────────────────────────────────────────────────────────────
function getMonthLabel(offset: number): string {
  const d = new Date(CHART_START);
  d.setMonth(d.getMonth() + offset);
  return `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtCell(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("en-US");
}

function fmtFull(n: number): string {
  if (n === 0) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function fmtTooltipNum(n: number): string {
  if (n === 0) return "0";
  return `${Math.round(n).toLocaleString("en-US")} AED`;
}

function projectMonthToChartIndex(
  startDate: string,
  relativeMonth: number,
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

// ── Tooltip ──────────────────────────────────────────────────────────────────
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
          padding: "8px 12px", fontSize: 11, fontWeight: 600, lineHeight: 1.7,
          whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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

// ── Delay Control ────────────────────────────────────────────────────────────
function DelayControl({
  label, color, lightBg, borderColor, value, onUp, onDown, minValue = 0,
}: {
  label: string; color: string; lightBg: string; borderColor: string;
  value: number; onUp: () => void; onDown: () => void; minValue?: number;
}) {
  const upDisabled = value <= minValue;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 3 }}>
      <button
        onClick={onUp}
        disabled={upDisabled}
        title={`تقديم ${label} شهر واحد`}
        style={{
          width: 20, height: 20, borderRadius: 5,
          background: upDisabled ? "#f1f5f9" : lightBg,
          border: `1px solid ${upDisabled ? "#e2e8f0" : borderColor}`,
          cursor: upDisabled ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: upDisabled ? "#cbd5e1" : color, transition: "all 0.2s",
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
          background: lightBg, border: `1px solid ${borderColor}`, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: color, transition: "all 0.2s",
        }}
      >
        <ChevronDown style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
}

// ── Option Selector ──────────────────────────────────────────────────────────
function OptionSelector({
  selected,
  onChange,
}: {
  selected: OptionKey;
  onChange: (opt: OptionKey) => void;
}) {
  const options: OptionKey[] = ["o1", "o2", "o3"];
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "center", marginBottom: 4 }}>
      {options.map((opt) => {
        const isActive = selected === opt;
        const colors = OPTION_COLORS[opt];
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "2px 8px", borderRadius: 5, fontSize: 8, fontWeight: 800,
              cursor: "pointer", transition: "all 0.2s", border: `1.5px solid ${colors.border}`,
              background: isActive ? colors.activeBg : colors.bg,
              color: isActive ? "#fff" : colors.text,
            }}
          >
            {OPTION_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}

// ── PDF Export (browser-side via html2pdf.js) ─────────────────────────
async function exportToPDF(
  effectiveColumns: any[],
  groupedRows: any[],
  rawProjects: any[],
  setExporting: (v: boolean) => void
) {
  setExporting(true);
  try {
    const html2pdf = (await import("html2pdf.js")).default;
    const fmt = (n: number) => n === 0 ? "—" : Math.round(n).toLocaleString("ar-AE");
    const optionLabel: Record<string, string> = { o1: "الخيار 1", o2: "الخيار 2", o3: "الخيار 3" };
    const grandTotalAll = effectiveColumns.reduce((s, c) => s + c.investorTotal, 0);
    const paidAll = effectiveColumns.reduce((s, c) => s + c.paidTotal, 0);
    const upcomingAll = effectiveColumns.reduce((s, c) => s + c.upcomingTotal, 0);
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    // Build quarters
    const quarters: { label: string; indices: number[] }[] = [];
    for (let q = 0; q < 16; q++) {
      const qStart = q * 3;
      const indices = [qStart, qStart + 1, qStart + 2].filter(i => i < 48);
      const hasData = effectiveColumns.some((c: any) =>
        indices.some(idx => (c.chartAmounts[idx] || 0) > 0)
      );
      if (hasData) {
        const d = new Date(2026, 3 + qStart, 1);
        const year = d.getFullYear();
        const qNum = Math.floor(qStart / 3) + 1;
        quarters.push({ label: `ربع ${qNum} - ${year}`, indices });
      }
    }

    // Build table rows HTML
    const rowsHtml = effectiveColumns.map((col: any) => {
      const qCells = quarters.map(({ indices }) => {
        const total = indices.reduce((s, idx) => s + (col.chartAmounts[idx] || 0), 0);
        return `<td>${fmt(total)}</td>`;
      }).join("");
      return `<tr>
        <td style="text-align:right;font-weight:600">${col.name}</td>
        <td>${optionLabel[col.option] || col.option}</td>
        <td>${fmt(col.grandTotal)}</td>
        <td>${fmt(col.investorTotal)}</td>
        <td>${fmt(col.paidTotal)}</td>
        <td>${fmt(col.upcomingTotal)}</td>
        ${qCells}
        <td style="font-weight:700">${fmt(col.investorTotal)}</td>
      </tr>`;
    }).join("");

    const totalQCells = quarters.map(({ indices }) => {
      const total = effectiveColumns.reduce((s, c) => s + indices.reduce((ss, idx) => ss + (c.chartAmounts[idx] || 0), 0), 0);
      return `<td style="font-weight:700">${fmt(total)}</td>`;
    }).join("");

    const qHeaders = quarters.map(q => `<th>${q.label}</th>`).join("");

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; direction:rtl; padding:16px; font-size:11px; }
  .header { background:#0f172a; color:#fff; padding:16px 20px; border-radius:8px; margin-bottom:16px; }
  .header h1 { font-size:20px; font-weight:800; margin-bottom:4px; }
  .header .sub { font-size:11px; color:#94a3b8; }
  .cards { display:flex; gap:12px; margin-bottom:16px; }
  .card { flex:1; background:#f8fafc; border-right:4px solid #0f172a; padding:12px; border-radius:6px; }
  .card .lbl { font-size:9px; color:#64748b; margin-bottom:4px; }
  .card .val { font-size:15px; font-weight:800; color:#0f172a; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#0f172a; color:#fff; padding:8px 6px; border:1px solid #334155; font-weight:700; text-align:center; }
  td { padding:7px 6px; border:1px solid #cbd5e1; text-align:center; }
  tr:nth-child(even) td { background:#f8fafc; }
  .total-row td { background:#1e293b !important; color:#fff; font-weight:700; }
  .footer { text-align:center; font-size:9px; color:#94a3b8; margin-top:14px; padding-top:10px; border-top:1px solid #e2e8f0; }
  .legend { display:flex; gap:16px; margin-top:12px; font-size:9px; color:#64748b; }
  .legend-dot { width:12px; height:12px; border-radius:3px; display:inline-block; margin-left:5px; }
</style>
</head>
<body>
  <div class="header">
    <h1>تقرير محفظة رأس المال</h1>
    <div class="sub">Como Developments &middot; تاريخ التصدير: ${dateStr}</div>
  </div>
  <div class="cards">
    <div class="card"><div class="lbl">عدد المشاريع</div><div class="val">${effectiveColumns.length}</div></div>
    <div class="card"><div class="lbl">الإجمالي الكلي (درهم)</div><div class="val">${fmt(grandTotalAll)}</div></div>
    <div class="card"><div class="lbl">المدفوع (درهم)</div><div class="val">${fmt(paidAll)}</div></div>
    <div class="card"><div class="lbl">المتبقي (درهم)</div><div class="val">${fmt(upcomingAll)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="min-width:160px">المشروع</th>
        <th>الخيار</th>
        <th>التكلفة الكلية</th>
        <th>رأس المال</th>
        <th>المدفوع</th>
        <th>المتبقي</th>
        ${qHeaders}
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td style="text-align:right">الإجمالي</td>
        <td></td>
        <td>${fmt(effectiveColumns.reduce((s, c) => s + c.grandTotal, 0))}</td>
        <td>${fmt(grandTotalAll)}</td>
        <td>${fmt(paidAll)}</td>
        <td>${fmt(upcomingAll)}</td>
        ${totalQCells}
        <td>${fmt(grandTotalAll)}</td>
      </tr>
    </tbody>
  </table>
  <div class="legend">
    <span><span class="legend-dot" style="background:#fb923c"></span>التصاميم</span>
    <span><span class="legend-dot" style="background:#db2777"></span>التسجيل</span>
    <span><span class="legend-dot" style="background:#7c3aed"></span>الإنشاء</span>
    <span><span class="legend-dot" style="background:#64748b"></span>التسليم</span>
  </div>
  <div class="footer">Como Developments &middot; سري &middot; للاستخدام الداخلي فقط</div>
</body>
</html>`;

    const fileDate = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    // Render inside an isolated iframe to avoid oklch CSS from the host page
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1400px;height:900px;border:none;";
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();
    // Wait for fonts
    await new Promise(r => setTimeout(r, 1500));
    const el = iDoc.body;
    await html2pdf().set({
      margin: 8,
      filename: `Capital-Portfolio-${fileDate}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: true },
      jsPDF: { unit: "mm", format: "a3", orientation: "landscape" },
    }).from(el).save();
    document.body.removeChild(iframe);
  } catch (err) {
    console.error("PDF export error:", err);
    alert("حدث خطأ أثناء توليد الـ PDF. يرجى المحاولة مرة أخرى.");
  } finally {
    setExporting(false);
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

interface DelayState {
  designDelay: number;
  offplanDelay: number;
  constructionDelay: number;
}

export default function CapitalPortfolioPage({ onBack }: Props) {
  const { isAuthenticated } = useAuth();
  const { isCCAuth, isOwner: isCCOwner } = useCCAuth();
  const canEdit = isAuthenticated || isCCOwner; // only Manus-auth or CC owner can edit

  // Fetch ALL projects with ALL 3 scenarios
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioAllScenarios.useQuery(
    undefined,
    { enabled: isAuthenticated || isCCAuth, staleTime: 60000 }
  );

  const rawProjects = useMemo(() => portfolioQuery.data || [], [portfolioQuery.data]);

  // Per-project option selection (default: o1)
  const [projectOptions, setProjectOptions] = useState<Record<number, OptionKey>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [hiddenProjects, setHiddenProjects] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<1 | 3 | 6>(1);
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");

  // Per-project delays (local state)
  const [delays, setDelays] = useState<Record<number, DelayState>>({});
  const [isExporting, setIsExporting] = useState(false);

  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
  }

  function adjustDelay(projectId: number, phase: keyof DelayState, delta: number) {
    const cur = getDelay(projectId);
    // For offplan, allow negative delays (to move registration earlier into design)
    // For design and construction, minimum is 0
    const newVal = phase === 'offplanDelay' ? cur[phase] + delta : Math.max(0, cur[phase] + delta);
    const updated = { ...cur, [phase]: newVal };

    // Get project info for constraint enforcement
    const project = rawProjects.find(p => p.projectId === projectId);
    const option = getProjectOption(projectId);
    const hasOffplan = option !== "o3";

    if (hasOffplan && project) {
      const durations = project.durations as { design: number; offplan: number; construction: number; handover: number };
      const offplanDuration = durations.offplan || 2;
      const designDuration = durations.design || 5;
      const scenario = OPTION_TO_SCENARIO[option];

      // Scenario-aware constraints:
      // O1 (offplan_escrow): offplanStart = designStart + 2 + offplanDelay
      //   Constraint: offplanStart >= designStart + 2 => offplanDelay >= 0 (can't go earlier than month 3)
      //   Constraint: offplanEnd <= constructionStart + 3
      //     designStart + 2 + offplanDelay + offplanDuration - 1 <= designDuration + constructionDelay + 3
      //     offplanDelay <= designDuration - 2 + constructionDelay + 3 - offplanDuration + 1
      //     offplanDelay <= designDuration + constructionDelay + 2 - offplanDuration
      // O2 (offplan_construction): offplanStart = constructionStart + offplanDelay
      //   Constraint: offplanStart >= designStart + 2 => constructionDelay + offplanDelay >= -(designDuration - 2)
      //     offplanDelay >= -(designDuration - 2) - constructionDelay
      //   Constraint: offplanEnd <= constructionStart + 3
      //     constructionDelay + offplanDelay + offplanDuration - 1 <= constructionDelay + 3
      //     offplanDelay <= 4 - offplanDuration
      let minOffplanDelay: number;
      let maxOffplanDelay: number;
      if (scenario === "offplan_escrow") {
        minOffplanDelay = 0; // Can't move earlier than month 3 of design
        maxOffplanDelay = designDuration + updated.constructionDelay + 2 - offplanDuration;
      } else {
        minOffplanDelay = -(designDuration - 2) - updated.constructionDelay;
        maxOffplanDelay = 4 - offplanDuration;
      }

      if (updated.offplanDelay < minOffplanDelay) {
        updated.offplanDelay = minOffplanDelay;
      }
      if (updated.offplanDelay > maxOffplanDelay) {
        updated.offplanDelay = maxOffplanDelay;
      }
    } else if (phase === 'offplanDelay') {
      // No offplan for o3, keep at 0
      updated.offplanDelay = 0;
    }

    setDelays(prev => ({ ...prev, [projectId]: updated }));
  }

  function resetDelay(projectId: number) {
    setDelays(prev => ({ ...prev, [projectId]: { designDelay: 0, offplanDelay: 0, constructionDelay: 0 } }));
  }

  function getProjectOption(projectId: number): OptionKey {
    return projectOptions[projectId] || "o1";
  }

  function setProjectOption(projectId: number, opt: OptionKey) {
    setProjectOptions(prev => ({ ...prev, [projectId]: opt }));
  }

  // ── Build effective columns from portfolio data ────────────────────────────
  // Each project column uses the selected option's monthly investor data
  const effectiveColumns = useMemo(() => {
    return rawProjects
      .filter(p => !hiddenProjects.has(p.projectId))
      .map((project) => {
        const option = getProjectOption(project.projectId);
        const scenario = OPTION_TO_SCENARIO[option];
        const scenarioData = (project.scenarios as any)?.[scenario];
        if (!scenarioData) return null;

        const delay = getDelay(project.projectId);
        const hasDelay = delay.designDelay > 0 || delay.offplanDelay > 0 || delay.constructionDelay > 0;

        // Phase durations from project
        const durations = project.durations as { design: number; offplan: number; construction: number; handover: number };
        const phaseInfo = project.phaseInfo as {
          design: { duration: number; start: number };
          offplan: { duration: number; start: number };
          construction: { duration: number; start: number };
          handover: { duration: number; start: number };
        };

        // Use monthlyInvestorBySection from API — investor-only amounts per section (excludes escrow/buyer-funded)
        // This ensures portfolio numbers match the O1/O2/O3 investor column in capital planning
        const monthlyBySection: Record<string, number[]> = scenarioData.monthlyInvestorBySection || scenarioData.monthlyBySection || {};
        const totalMonths = project.totalMonths || (scenarioData.monthlyInvestor?.length || 24);

        const hasOffplan = option !== "o3";

        // Phase start positions (0-indexed) — sequential: design → offplan → construction
        const designStartRel = (phaseInfo.design.start || 1) - 1;

        // Build chart-level amounts using section-level data
        // CONSTRAINT SYSTEM:
        //   paid → no delay (already paid)
        //   design → shifts by designDelay (free movement)
        //   offplan → scenario-aware:
        //     O1 (offplan_escrow): starts at month 3 of design (designStart + 2)
        //     O2 (offplan_construction): starts at constructionStart
        //     offplanDelay shifts the position further
        //   construction → shifts by designDelay + constructionDelay (follows design directly)
        //   escrow → same as construction
        const constructionEffectiveDelay = delay.designDelay + delay.constructionDelay;
        const offplanEffectiveDelay = delay.designDelay + delay.offplanDelay;
        const sectionDelayMap: Record<string, number> = {
          paid: 0,
          design: delay.designDelay,
          offplan: offplanEffectiveDelay,
          construction: constructionEffectiveDelay,
          escrow: constructionEffectiveDelay,
        };

        // Map sections to visual phase types for coloring
        const sectionToPhaseType: Record<string, PhaseType> = {
          paid: "land",
          design: "design",
          offplan: "offplan",
          construction: "construction",
          escrow: "construction",
        };

        const chartAmounts: Record<number, number> = {};
        const phaseChartAmounts: Record<PhaseType, Record<number, number>> = {
          land: {}, design: {}, offplan: {}, construction: {}, handover: {},
        };

        let paidTotal = 0;
        let upcomingTotal = 0;

        for (const [section, monthlyArr] of Object.entries(monthlyBySection)) {
          if (!monthlyArr || !Array.isArray(monthlyArr)) continue;
          const delayMonths = sectionDelayMap[section] ?? 0;
          const phaseType = sectionToPhaseType[section] ?? "construction";

          for (let m = 0; m < totalMonths; m++) {
            const val = monthlyArr[m] || 0;
            if (val <= 0) continue;

            const chartIdx = projectMonthToChartIndex(project.startDate, m) + delayMonths;

            if (section === "paid") {
              // Paid/land amounts — no delay, separate tracking
              const landIdx = projectMonthToChartIndex(project.startDate, m);
              paidTotal += val;
              phaseChartAmounts.land[landIdx] = (phaseChartAmounts.land[landIdx] || 0) + val;
              continue;
            }

            if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
              chartAmounts[chartIdx] = (chartAmounts[chartIdx] || 0) + val;
              phaseChartAmounts[phaseType][chartIdx] = (phaseChartAmounts[phaseType][chartIdx] || 0) + val;
              upcomingTotal += val;
            }
          }
        }

        const grandTotal = paidTotal + upcomingTotal;

        // Compute phase ranges for visual display
        // NEW CONSTRAINT SYSTEM:
        //   Design: moves freely
        //   Construction: starts immediately after Design ends, then adds its own delay
        //   Registration (offplan): floats independently, starts at month 3 of Design + offplanDelay
        //     Constraint: registration cannot start before month 3 of Design
        //     Constraint: registration cannot end after month 4 of Construction
        const baseStart = projectMonthToChartIndex(project.startDate, designStartRel);
        const designStart = baseStart + delay.designDelay;
        const designEnd = designStart + durations.design - 1;

        // Construction starts AFTER design ends (NOT after registration) + its own delay
        const constructionStart = designEnd + 1 + delay.constructionDelay;
        const constructionEnd = constructionStart + durations.construction - 1;

        // Registration (offplan) default position — scenario-aware (matching server logic):
        //   O1 (offplan_escrow): starts at month 3 of design (designStart + 2)
        //   O2 (offplan_construction): starts at constructionStart
        //   offplanDelay shifts position further
        const offplanDuration = durations.offplan || 2;
        let offplanStart: number;
        let offplanEnd: number;
        if (!hasOffplan) {
          offplanStart = -1;
          offplanEnd = -1;
        } else if (scenario === "offplan_escrow") {
          // O1: starts at month 3 of design (0-indexed: designStart + 2) + offplanDelay
          offplanStart = designStart + 2 + delay.offplanDelay;
          offplanEnd = offplanStart + offplanDuration - 1;
        } else {
          // O2: starts at constructionStart + offplanDelay
          offplanStart = constructionStart + delay.offplanDelay;
          offplanEnd = offplanStart + offplanDuration - 1;
        }

        // Enforce constraints — ALWAYS exactly offplanDuration months
        if (hasOffplan) {
          // O1: min start = month 3 of design; O2: min start = constructionStart
          const minStart = scenario === "offplan_escrow" ? designStart + 2 : constructionStart;
          const maxStart = constructionStart + 3 - (offplanDuration - 1); // so last month doesn't exceed month 4 of construction
          if (offplanStart < minStart) offplanStart = minStart;
          if (offplanStart > maxStart) offplanStart = maxStart;
          offplanEnd = offplanStart + offplanDuration - 1;
        }

        const handoverStart = constructionEnd + 1;
        const handoverEnd = handoverStart + (durations.handover || 2) - 1;

        const landIdx = projectMonthToChartIndex(project.startDate, 0);

        const phaseRanges = {
          land: { start: landIdx, end: landIdx },
          design: { start: designStart, end: designEnd },
          offplan: { start: offplanStart, end: offplanEnd },
          construction: { start: constructionStart, end: constructionEnd },
          handover: { start: handoverStart, end: handoverEnd },
        };

        return {
          projectId: project.projectId,
          name: project.name,
          startDate: project.startDate,
          option,
          scenario,
          durations,
          phaseInfo,
          investorTotal: scenarioData.investorTotal || 0,
          escrowTotal: scenarioData.escrowTotal || 0,
          grandTotal,
          paidTotal,
          upcomingTotal,
          chartAmounts,
          phaseChartAmounts,
          phaseRanges,
          hasOffplan,
          ...delay,
        };
      })
      .filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[0]>[];
  }, [rawProjects, projectOptions, hiddenProjects, delays]);

  // Monthly totals across all visible projects
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

  // Phase detection helpers
  function getBasePhaseAtIndex(col: typeof effectiveColumns[0], chartIdx: number): PhaseType | null {
    // 1. Check if there are actual amounts in any phase at this index
    const hasDesignAmt = (col.phaseChartAmounts.design?.[chartIdx] || 0) > 0;
    const hasConstructionAmt = (col.phaseChartAmounts.construction?.[chartIdx] || 0) > 0;
    const hasOffplanAmt = (col.phaseChartAmounts.offplan?.[chartIdx] || 0) > 0;
    const hasHandoverAmt = (col.phaseChartAmounts.handover?.[chartIdx] || 0) > 0;

    // 2. Geometric ranges (single source of truth for phase boundaries)
    const inDesign = chartIdx >= col.phaseRanges.design.start && chartIdx <= col.phaseRanges.design.end;
    const inConstruction = chartIdx >= col.phaseRanges.construction.start && chartIdx <= col.phaseRanges.construction.end;
    const inOffplan = col.hasOffplan && chartIdx >= col.phaseRanges.offplan.start && chartIdx <= col.phaseRanges.offplan.end;
    const inHandover = chartIdx >= col.phaseRanges.handover.start && chartIdx <= col.phaseRanges.handover.end;

    // 3. Geometric ranges are the SINGLE SOURCE OF TRUTH for base phase.
    //    If a cell is inside design or construction range, it's ALWAYS that phase.
    //    Offplan is only the base phase when geometrically OUTSIDE both design and construction.
    //    This ensures the offplan overlay always shows as transparent over design/construction.
    if (inDesign) return "design";
    if (inConstruction) return "construction";
    if (inHandover || hasHandoverAmt) return "handover";
    // Offplan is base phase ONLY when it's alone (not overlapping design/construction)
    if (hasOffplanAmt || inOffplan) return "offplan";

    return null;
  }

  function hasOffplanAtIndex(col: typeof effectiveColumns[0], chartIdx: number): boolean {
    if (!col.hasOffplan) return false;
    // Use ONLY geometric range for overlay position — amounts may be at different positions
    return chartIdx >= col.phaseRanges.offplan.start && chartIdx <= col.phaseRanges.offplan.end;
  }

  function getPhasePosition(col: typeof effectiveColumns[0], chartIdx: number): { isFirst: boolean; isLast: boolean } {
    const phase = getBasePhaseAtIndex(col, chartIdx);
    if (!phase) return { isFirst: false, isLast: false };
    const prevPhase = chartIdx > 0 ? getBasePhaseAtIndex(col, chartIdx - 1) : null;
    const nextPhase = chartIdx < TOTAL_MONTHS - 1 ? getBasePhaseAtIndex(col, chartIdx + 1) : null;
    return { isFirst: prevPhase !== phase, isLast: nextPhase !== phase };
  }

  // Grouped rows
  const groupedRows = useMemo(() => {
    const numGroups = Math.ceil(TOTAL_MONTHS / groupBy);
    return Array.from({ length: numGroups }, (_, gi) => {
      const startIdx = gi * groupBy;
      const endIdx = Math.min(startIdx + groupBy - 1, TOTAL_MONTHS - 1);
      const label = groupBy === 1
        ? getMonthLabel(startIdx)
        : `${getMonthLabel(startIdx)} — ${getMonthLabel(endIdx)}`;
      const total = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => monthlyTotals[startIdx + i] || 0)
        .reduce((s, v) => s + v, 0);
      const colData = effectiveColumns.map((col) => {
        const amount = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => col.chartAmounts[startIdx + i] || 0)
          .reduce((s, v) => s + v, 0);
        const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);
        const phase = getBasePhaseAtIndex(col, midIdx);
        const { isFirst, isLast } = getPhasePosition(col, midIdx);
        const offplanOverlay = hasOffplanAtIndex(col, midIdx);
        const prevHasOffplan = startIdx > 0 ? hasOffplanAtIndex(col, startIdx - 1) : false;
        const nextHasOffplan = endIdx < TOTAL_MONTHS - 1 ? hasOffplanAtIndex(col, endIdx + 1) : false;
        const isOffplanFirst = offplanOverlay && !prevHasOffplan;
        const isOffplanLast = offplanOverlay && !nextHasOffplan;
        // Check if this cell is within a geometric phase range (should always be solid colored)
        // NOTE: offplan is intentionally EXCLUDED — it only shows when it has actual amounts
        // This prevents empty offplan rectangles from appearing
        const inGeometricRange = (
          (midIdx >= col.phaseRanges.design.start && midIdx <= col.phaseRanges.design.end) ||
          (midIdx >= col.phaseRanges.construction.start && midIdx <= col.phaseRanges.construction.end) ||
          (midIdx >= col.phaseRanges.handover.start && midIdx <= col.phaseRanges.handover.end)
        );
        return { colId: col.projectId, amount, phase, isFirst, isLast, offplanOverlay, isOffplanFirst, isOffplanLast, inGeometricRange };
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

  const isLoading = portfolioQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-orange-700 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل بيانات المشاريع...</p>
        </div>
      </div>
    );
  }

  if (rawProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400" dir="rtl">
        <Layers className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">لا توجد مشاريع مسجلة</p>
      </div>
    );
  }

  const COL_W = 130;
  const GAP = 10;
  const ROW_H = groupBy === 1 ? 34 : groupBy === 3 ? 46 : 56;
  const CURVE = 14;

  const totalCols = effectiveColumns.length + 3;
  const tableW = totalCols * COL_W + (totalCols - 1) * GAP;

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
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#ffffff", border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "6px 14px", color: "#475569", fontSize: 13, cursor: "pointer",
            }}>
              <ArrowRight style={{ width: 14, height: 14 }} /> رجوع
            </button>
          )}
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "linear-gradient(135deg, #4b5563 0%, #6b7280 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(75,85,99,0.25)",
          }}>
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              محفظة رأس المال للمشاريع
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              {TOTAL_MONTHS} شهراً · أبريل 2026 — مارس 2030 · {rawProjects.length} مشاريع · بيانات من خطة رأس المال
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
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 4,
                background: `linear-gradient(135deg, ${PHASE_COLORS.design.solid} 50%, ${PHASE_COLORS.construction.solid} 50%)`,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", inset: 0, background: "rgba(196, 185, 154, 0.3)", borderRadius: 4 }} />
              </div>
              <span style={{ fontWeight: 600 }}>التسجيل</span>
            </div>
          </div>

          {/* Export PDF button */}
          <button
            onClick={() => exportToPDF(effectiveColumns, groupedRows, rawProjects, setIsExporting)}
            disabled={isExporting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#10b981",
              color: "#fff",
              border: "1px solid #10b981",
              borderRadius: 10, padding: "6px 14px", cursor: "pointer",
              fontSize: 12, fontWeight: 700, transition: "all 0.2s",
            }}
          >
            <Download style={{ width: 14, height: 14 }} /> {isExporting ? "جاري التوليد..." : "تصدير PDF"}
          </button>

          {/* Settings toggle — owner only */}
          {canEdit && <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showSettings ? "#4b5563" : "#ffffff",
              color: showSettings ? "#fff" : "#64748b",
              border: "1px solid " + (showSettings ? "#4b5563" : "#e2e8f0"),
              borderRadius: 10, padding: "6px 14px", cursor: "pointer",
              fontSize: 12, fontWeight: 700, transition: "all 0.2s",
            }}
          >
            <Settings style={{ width: 14, height: 14 }} /> إعدادات المشاريع
          </button>}
          {/* Grouping buttons */}
          <div style={{ display: "flex", gap: 4, background: "#ffffff", borderRadius: 12, padding: 3, border: "1px solid #e2e8f0" }}>
            {([1, 3, 6] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: "5px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s", border: "none",
                  background: groupBy === g ? "#374151" : "transparent",
                  color: groupBy === g ? "#fff" : "#94a3b8",
                }}
              >
                {g === 1 ? "شهري" : g === 3 ? "ربع سنوي" : "نصف سنوي"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Settings Panel ─────────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb",
          padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Settings style={{ width: 16, height: 16, color: "#4b5563" }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>إعدادات المشاريع</span>
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
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>المشروع</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>الأوبشن</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>رأس المال</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>التصاميم</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>الإنشاء</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb" }}>إظهار</th>
                </tr>
              </thead>
              <tbody>
                {rawProjects.map((p) => {
                  const opt = getProjectOption(p.projectId);
                  const sc = OPTION_TO_SCENARIO[opt];
                  const scenarioData = (p.scenarios as any)?.[sc];
                  const durations = p.durations as any;
                  const isHidden = hiddenProjects.has(p.projectId);
                  return (
                    <tr key={p.projectId} style={{ borderBottom: "1px solid #f1f5f9", opacity: isHidden ? 0.5 : 1 }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: "#1e293b", maxWidth: 200 }}>
                        {p.name}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          {(["o1", "o2", "o3"] as OptionKey[]).map((o) => {
                            const isActive = opt === o;
                            const colors = OPTION_COLORS[o];
                            return (
                              <button
                                key={o}
                                onClick={() => setProjectOption(p.projectId, o)}
                                style={{
                                  padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  cursor: "pointer", border: `1.5px solid ${colors.border}`,
                                  background: isActive ? colors.activeBg : colors.bg,
                                  color: isActive ? "#fff" : colors.text,
                                  transition: "all 0.2s",
                                }}
                              >
                                {OPTION_LABELS[o]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#0f172a", fontFamily: "'Courier New', monospace" }}>
                        {fmtFull(scenarioData?.investorTotal || 0)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#64748b" }}>
                        {durations?.design || 5} شهر
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#64748b" }}>
                        {durations?.construction || 18} شهر
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <button
                          onClick={() => {
                            setHiddenProjects(prev => {
                              const next = new Set(prev);
                              if (next.has(p.projectId)) next.delete(p.projectId);
                              else next.add(p.projectId);
                              return next;
                            });
                          }}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: isHidden ? "#94a3b8" : "#4b5563",
                          }}
                        >
                          {isHidden ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vertical Table ────────────────────────────────────────── */}
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
                      width: COL_W, minWidth: COL_W,
                      borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f3f4f6` : "none",
                      padding: 0, verticalAlign: "top", background: "#f3f4f6",
                    }}
                  >
                    <div style={{
                      background: "#ffffff", borderRadius: 14,
                      padding: "8px 6px 8px",
                      border: "1px solid #d1d5db",
                      borderTop: "3px solid #9ca3af",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                    }}>
                      {/* Project name */}
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: "#0f172a",
                        textAlign: "center", lineHeight: 1.4,
                        height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 2px", wordBreak: "break-word",
                      }}>
                        {col.name}
                      </div>

                      {/* Option selector */}
                      <OptionSelector
                        selected={col.option as OptionKey}
                        onChange={(opt) => setProjectOption(col.projectId, opt)}
                      />

                      {/* رأس المال المطلوب */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        height: 22, background: "#4b5563", borderRadius: 6,
                        padding: "0 6px", marginTop: 4, fontSize: 9,
                      }}>
                        <span style={{ color: "#d1d5db", fontWeight: 600 }}>رأس المال المطلوب</span>
                        <span style={{ fontWeight: 800, color: "#ffffff" }}>{fmtFull(col.investorTotal)}</span>
                      </div>

                      {/* المتبقي */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        height: 22, background: "#6b7280", borderRadius: 6,
                        padding: "0 6px", marginTop: 3, marginBottom: 6, fontSize: 9,
                      }}>
                        <span style={{ color: "#d1d5db", fontWeight: 600 }}>المتبقي</span>
                        <span style={{ fontWeight: 800, color: "#ffffff" }}>{fmtFull(col.investorTotal - col.paidTotal)}</span>
                      </div>

                      {/* Delay badge */}
                      {hasDelay && (
                        <div style={{
                          background: "#374151", borderRadius: 6,
                          padding: "2px 4px", marginBottom: 4, textAlign: "center",
                          fontSize: 8, color: "#e5e7eb", fontWeight: 700,
                          border: "1px solid #4b5563",
                        }}>
                          {delay.designDelay > 0 && `تصاميم +${delay.designDelay}ش`}
                          {delay.designDelay > 0 && (delay.offplanDelay > 0 || delay.constructionDelay > 0) && " · "}
                          {delay.offplanDelay > 0 && `تسجيل +${delay.offplanDelay}ش`}
                          {delay.offplanDelay > 0 && delay.constructionDelay > 0 && " · "}
                          {delay.constructionDelay > 0 && `إنشاء +${delay.constructionDelay}ش`}
                        </div>
                      )}

                      {/* Delay controls */}
                      <DelayControl label="التصاميم" color="#fb923c" lightBg="#fff7ed" borderColor="#fed7aa"
                        value={delay.designDelay}
                        onUp={() => adjustDelay(col.projectId, "designDelay", -1)}
                        onDown={() => adjustDelay(col.projectId, "designDelay", 1)}
                      />
                      {col.hasOffplan && (() => {
                        const designDur = col.durations?.design || 5;
                        const minOffplan = -(designDur - 2);
                        return (
                          <DelayControl label="التسجيل" color="#db2777" lightBg="#fdf2f8" borderColor="#f472b6"
                            value={delay.offplanDelay}
                            minValue={minOffplan}
                            onUp={() => adjustDelay(col.projectId, "offplanDelay", -1)}
                            onDown={() => adjustDelay(col.projectId, "offplanDelay", 1)}
                          />
                        );
                      })()}
                      <DelayControl label="الإنشاء" color="#7c3aed" lightBg="#f5f3ff" borderColor="#a78bfa"
                        value={delay.constructionDelay}
                        onUp={() => adjustDelay(col.projectId, "constructionDelay", -1)}
                        onDown={() => adjustDelay(col.projectId, "constructionDelay", 1)}
                      />

                      {/* Reset */}
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
                            <RotateCcw style={{ width: 8, height: 8 }} /> إعادة
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Date column header */}
              <th style={{
                width: COL_W, minWidth: COL_W, padding: 0,
                borderLeft: `${GAP}px solid #f3f4f6`, borderRight: `${GAP}px solid #f3f4f6`,
                verticalAlign: "bottom", background: "#f3f4f6",
              }}>
                <div style={{
                  background: "#ffffff", borderRadius: 14, padding: "14px 6px",
                  textAlign: "center", color: "#334155", fontSize: 11, fontWeight: 800,
                  border: "1px solid #e5e7eb", borderTop: "3px solid #9ca3af",
                }}>
                  الشهر
                </div>
              </th>

              {/* Total column header */}
              <th style={{
                width: COL_W, minWidth: COL_W, padding: 0,
                verticalAlign: "bottom", background: "#f3f4f6",
              }}>
                <div style={{
                  background: "#fef3c7", borderRadius: 14, padding: "14px 6px",
                  textAlign: "center", color: "#92400e", fontSize: 11, fontWeight: 800,
                  border: "1px solid #fcd34d", borderTop: "3px solid #f59e0b",
                }}>
                  الإجمالي الشهري
                </div>
              </th>

              {/* Cumulative column header */}
              <th style={{
                width: COL_W, minWidth: COL_W, padding: 0, paddingRight: GAP,
                verticalAlign: "bottom", background: "#f3f4f6",
              }}>
                <div style={{
                  background: "#ffedd5", borderRadius: 14, padding: "14px 6px",
                  textAlign: "center", color: "#9a3412", fontSize: 10, fontWeight: 800,
                  border: "1px solid #fdba74", borderTop: "3px solid #f97316",
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
                <td key={`paid-${col.projectId}`} style={{
                  width: COL_W, minWidth: COL_W, height: ROW_H + 4, padding: 0,
                  borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f3f4f6` : "none",
                  background: "#f3f4f6",
                }}>
                  <div style={{
                    width: "100%", height: "100%",
                    background: col.paidTotal > 0 ? "#374151" : "#fafbfc",
                    borderRadius: 10,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                    border: col.paidTotal > 0 ? "1px solid #4b5563" : "none",
                  }}>
                    {col.paidTotal > 0 && (
                      <>
                        <span style={{ fontSize: 7, color: "#d1d5db", fontWeight: 600 }}>المدفوع</span>
                        <span style={{ fontSize: 11, color: "#ffffff", fontWeight: 800 }}>{fmtCell(col.paidTotal)}</span>
                      </>
                    )}
                  </div>
                </td>
              ))}
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                fontSize: 10, fontWeight: 700, color: "#ffffff",
                textAlign: "center", background: "#374151",
                borderLeft: `${GAP}px solid #f3f4f6`, borderRight: `${GAP}px solid #f3f4f6`,
              }}>
                المدفوع
              </td>
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#374151", textAlign: "center",
                fontSize: 11, fontWeight: 800, color: "#ffffff",
                border: "1px solid #4b5563", borderRadius: 8, padding: 0,
              }}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {fmtCell(effectiveColumns.reduce((s, c) => s + c.paidTotal, 0))}
                </div>
              </td>
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#f3f4f6", paddingRight: GAP,
              }} />
            </tr>

            {/* ── Separator ─────────────────────────── */}
            <tr>
              <td colSpan={effectiveColumns.length + 3} style={{ height: 6, background: "#f3f4f6" }} />
            </tr>

            {/* ── Monthly Rows ─────────────────────────── */}
            {groupedRows.map((row) => {
              const isEven = row.gi % 2 === 0;
              return (
                <tr key={row.gi}>
                  {row.colData.map((cd, ci) => {
                    let bg = "#fafbfc";
                    let textColor = "#cbd5e1";
                    let fontW = 400;
                    let tl = 0, tr = 0, br = 0, bl = 0;

                    const phase = cd.phase as PhaseType | null;
                    if (phase && PHASE_COLORS[phase] && phase !== "handover") {
                      const colors = PHASE_COLORS[phase];
                      // If cell is within a geometric phase range, ALWAYS use solid color
                      // This prevents "white gaps" when amounts shift due to delay adjustments
                      const useSolid = cd.amount > 0 || cd.inGeometricRange;
                      bg = useSolid ? colors.solid : colors.light;
                      textColor = useSolid ? "#1a1a2e" : colors.text;
                      fontW = cd.amount > 0 ? 800 : 500;
                      if (cd.isFirst) { tl = CURVE; tr = CURVE; }
                      if (cd.isLast) { bl = CURVE; br = CURVE; }
                    }

                    const borderRadiusStyle = `${tl}px ${tr}px ${br}px ${bl}px`;
                    // Show transparent overlay when offplan overlaps with design or construction
                    // When offplan is alone (phase === "offplan"), it shows its own solid color naturally
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
                          width: COL_W, minWidth: COL_W, height: ROW_H, padding: 0,
                          borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f3f4f6` : "none",
                          background: "#f3f4f6",
                        }}
                      >
                        <div style={{
                          width: "100%", height: "100%",
                          background: bg, borderRadius: borderRadiusStyle,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: fontW, color: textColor,
                          transition: "all 0.15s ease",
                          position: "relative", overflow: "hidden",
                        }}>
                          {cd.amount > 0 ? fmtCell(cd.amount) : ""}
                          {showOffplanOverlay && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(219, 39, 119, 0.18)",
                              borderRadius: offplanOverlayRadius,
                              pointerEvents: "none",
                              borderTop: cd.isOffplanFirst ? "2px solid rgba(219, 39, 119, 0.5)" : "none",
                              borderBottom: cd.isOffplanLast ? "2px solid rgba(196, 185, 154, 0.25)" : "none",
                              borderRight: "1.5px solid rgba(196, 185, 154, 0.35)",
                              borderLeft: "1.5px solid rgba(196, 185, 154, 0.4)",
                            }} />
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Date cell */}
                  <td style={{
                    width: COL_W, minWidth: COL_W, height: ROW_H,
                    fontSize: groupBy === 1 ? 10 : 9, fontWeight: 600, color: "#475569",
                    padding: "0 6px", textAlign: "center",
                    borderLeft: `${GAP}px solid #f3f4f6`, borderRight: `${GAP}px solid #f3f4f6`,
                    background: isEven ? "#ffffff" : "#f8fafc",
                    whiteSpace: groupBy === 1 ? "nowrap" : "normal", lineHeight: 1.3,
                  }}>
                    {row.label}
                  </td>

                  {/* Total cell */}
                  <td style={{
                    width: COL_W, minWidth: COL_W, height: ROW_H,
                    background: row.total > 0 ? "#fef9e7" : (isEven ? "#ffffff" : "#fafafa"),
                    padding: 0, textAlign: "center",
                    fontSize: 11, fontWeight: row.total > 0 ? 800 : 400,
                    color: row.total > 0 ? "#92400e" : "#94a3b8",
                  }}>
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {row.total > 0 ? fmtCell(row.total) : ""}
                    </div>
                  </td>

                  {/* Cumulative cell */}
                  <td style={{
                    width: COL_W, minWidth: COL_W, height: ROW_H,
                    background: cumulativeTotals[row.gi] > 0 ? "#fff7ed" : (isEven ? "#ffffff" : "#fafafa"),
                    padding: 0, paddingRight: GAP, textAlign: "center",
                    fontSize: 11, fontWeight: cumulativeTotals[row.gi] > 0 ? 800 : 400,
                    color: cumulativeTotals[row.gi] > 0 ? "#9a3412" : "#94a3b8",
                  }}>
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                      {cumulativeTotals[row.gi] > 0 ? fmtCell(cumulativeTotals[row.gi]) : ""}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* ── Separator ─────────────────────────── */}
            <tr>
              <td colSpan={effectiveColumns.length + 3} style={{ height: 6, background: "#f3f4f6" }} />
            </tr>

            {/* ── Column Totals Row ─────────────────────────── */}
            <tr>
              {effectiveColumns.map((col, ci) => (
                <td key={`total-${col.projectId}`} style={{
                  width: COL_W, minWidth: COL_W, height: ROW_H + 4, padding: 0,
                  borderLeft: ci < effectiveColumns.length - 1 ? `${GAP}px solid #f3f4f6` : "none",
                  background: "#f3f4f6",
                }}>
                  <div style={{
                    width: "100%", height: "100%",
                    background: "#1e293b",
                    borderRadius: 10,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                    border: "1px solid #334155",
                  }}>
                    <span style={{ fontSize: 7, color: "#94a3b8", fontWeight: 600 }}>الإجمالي</span>
                    <span style={{ fontSize: 11, color: "#ffffff", fontWeight: 800 }}>{fmtCell(col.investorTotal)}</span>
                  </div>
                </td>
              ))}
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                fontSize: 10, fontWeight: 700, color: "#ffffff",
                textAlign: "center", background: "#1e293b",
                borderLeft: `${GAP}px solid #f3f4f6`, borderRight: `${GAP}px solid #f3f4f6`,
              }}>
                الإجمالي
              </td>
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#1e293b", textAlign: "center",
                fontSize: 11, fontWeight: 800, color: "#ffffff",
                border: "1px solid #334155", borderRadius: 8, padding: 0,
              }}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {fmtCell(effectiveColumns.reduce((s, c) => s + c.investorTotal, 0))}
                </div>
              </td>
              <td style={{
                width: COL_W, minWidth: COL_W, height: ROW_H + 4,
                background: "#f3f4f6", paddingRight: GAP,
              }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
