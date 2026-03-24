import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Layers, BarChart3, Calendar, Table2,
  ArrowRight, TrendingUp, DollarSign, Wallet, Landmark,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type ScenarioKey = "offplan_escrow" | "offplan_construction" | "no_offplan";

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  offplan_escrow: "O1 — أوف بلان (ضمان)",
  offplan_construction: "O2 — أوف بلان (إنجاز)",
  no_offplan: "O3 — بدون أوف بلان",
};

const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  offplan_escrow: "#2563eb",
  offplan_construction: "#7c3aed",
  no_offplan: "#059669",
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PHASE_COLORS: Record<string, string> = {
  design: "#f59e0b",
  offplan: "#8b5cf6",
  construction: "#ef4444",
  handover: "#22c55e",
};

const PHASE_LABELS: Record<string, string> = {
  design: "التصاميم",
  offplan: "أوف بلان",
  construction: "الإنشاء ودفعي",
  handover: "التسليم ودفعي",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toFixed(0);
}

function fmtFull(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function getAbsoluteMonth(startDate: string, relMonth: number): { year: number; month: number } {
  const [yearStr, monthStr] = startDate.split("-");
  const startYear = parseInt(yearStr) || 2026;
  const startMonth = parseInt(monthStr) || 4;
  const totalMonth = (startYear * 12 + startMonth - 1) + relMonth;
  return { year: Math.floor(totalMonth / 12), month: (totalMonth % 12) + 1 };
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void;
}

export default function PortfolioAllScenariosPage({ onBack }: Props) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "comparison">("overview");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("offplan_escrow");

  const portfolioQuery = trpc.cashFlowSettings.getPortfolioAllScenarios.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 60000 }
  );

  const projects = useMemo(() => portfolioQuery.data || [], [portfolioQuery.data]);

  const scenarios: ScenarioKey[] = ["offplan_escrow", "offplan_construction", "no_offplan"];

  // Per-scenario portfolio totals
  const portfolioTotals = useMemo(() => {
    const totals: Record<ScenarioKey, { investor: number; escrow: number; grand: number; revenue: number }> = {
      offplan_escrow: { investor: 0, escrow: 0, grand: 0, revenue: 0 },
      offplan_construction: { investor: 0, escrow: 0, grand: 0, revenue: 0 },
      no_offplan: { investor: 0, escrow: 0, grand: 0, revenue: 0 },
    };
    for (const p of projects) {
      for (const sc of scenarios) {
        const s = (p.scenarios as any)?.[sc];
        if (!s) continue;
        totals[sc].investor += s.investorTotal || 0;
        totals[sc].escrow += s.escrowTotal || 0;
        totals[sc].grand += s.grandTotal || 0;
        totals[sc].revenue += p.totalRevenue || 0;
      }
    }
    return totals;
  }, [projects]);

  // Cumulative monthly data for chart
  const chartData = useMemo(() => {
    const CHART_START_YEAR = 2026;
    const CHART_START_MONTH = 4;
    const TOTAL_CHART_MONTHS = 48;

    const monthlyTotals = new Array(TOTAL_CHART_MONTHS).fill(0);

    for (const p of projects) {
      const s = (p.scenarios as any)?.[selectedScenario];
      if (!s) continue;
      const monthlyArr: number[] = s.monthlyTotal || [];
      for (let m = 0; m < monthlyArr.length; m++) {
        const val = monthlyArr[m] || 0;
        if (val <= 0) continue;
        const abs = getAbsoluteMonth(p.startDate, m);
        const chartIdx = (abs.year - CHART_START_YEAR) * 12 + (abs.month - CHART_START_MONTH);
        if (chartIdx >= 0 && chartIdx < TOTAL_CHART_MONTHS) {
          monthlyTotals[chartIdx] += val;
        }
      }
    }

    const cumulative: number[] = [];
    let running = 0;
    for (let i = 0; i < TOTAL_CHART_MONTHS; i++) {
      running += monthlyTotals[i];
      cumulative.push(running);
    }

    const labels: string[] = [];
    for (let i = 0; i < TOTAL_CHART_MONTHS; i++) {
      const y = CHART_START_YEAR + Math.floor((CHART_START_MONTH - 1 + i) / 12);
      const m = ((CHART_START_MONTH - 1 + i) % 12) + 1;
      labels.push(`${ARABIC_MONTHS[m - 1]} ${y}`);
    }

    return { monthlyTotals, cumulative, labels, maxCumulative: running };
  }, [projects, selectedScenario]);

  const tabs = [
    { id: "overview" as const, label: "نظرة عامة", icon: BarChart3 },
    { id: "timeline" as const, label: "الجدول الزمني", icon: Calendar },
    { id: "comparison" as const, label: "المقارنة", icon: Table2 },
  ];

  // Loading / Empty states (after all hooks)
  if (portfolioQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-orange-700 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل بيانات المحفظة...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400" dir="rtl">
        <Layers className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">لا توجد مشاريع</p>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100%", background: "#ffffff", padding: "20px 16px", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 14px", color: "#475569", fontSize: 13, cursor: "pointer" }}>
              <ArrowRight style={{ width: 14, height: 14 }} /> رجوع
            </button>
          )}
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #4b5563 0%, #6b7280 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(75,85,99,0.25)" }}>
            <Layers style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              محفظة المشاريع — السيناريوهات الثلاثة
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              {projects.length} مشاريع · 3 سيناريوهات · بيانات محدّثة من إعدادات التدفق
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 3 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: isActive ? "#0f172a" : "transparent",
                  color: isActive ? "#fff" : "#64748b",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {scenarios.map((sc) => (
          <button
            key={sc}
            onClick={() => setSelectedScenario(sc)}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "2px solid",
              borderColor: selectedScenario === sc ? SCENARIO_COLORS[sc] : "#e2e8f0",
              background: selectedScenario === sc ? SCENARIO_COLORS[sc] + "10" : "#fff",
              color: selectedScenario === sc ? SCENARIO_COLORS[sc] : "#64748b",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {SCENARIO_LABELS[sc]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          projects={projects}
          portfolioTotals={portfolioTotals}
          selectedScenario={selectedScenario}
          chartData={chartData}
          scenarios={scenarios}
        />
      )}
      {activeTab === "timeline" && (
        <TimelineTab
          projects={projects}
          selectedScenario={selectedScenario}
        />
      )}
      {activeTab === "comparison" && (
        <ComparisonTab
          projects={projects}
          portfolioTotals={portfolioTotals}
          scenarios={scenarios}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab({
  projects, portfolioTotals, selectedScenario, chartData, scenarios,
}: {
  projects: any[];
  portfolioTotals: Record<ScenarioKey, { investor: number; escrow: number; grand: number; revenue: number }>;
  selectedScenario: ScenarioKey;
  chartData: { monthlyTotals: number[]; cumulative: number[]; labels: string[]; maxCumulative: number };
  scenarios: ScenarioKey[];
}) {
  const totals = portfolioTotals[selectedScenario];
  const profit = totals.revenue - totals.grand;
  const roi = totals.grand > 0 ? ((totals.revenue - totals.grand) / totals.grand) * 100 : 0;

  const summaryCards = [
    { label: "إجمالي التكاليف", value: fmtNum(totals.grand), icon: DollarSign, color: "#dc2626", bg: "#fef2f2" },
    { label: "رأس مال المستثمر", value: fmtNum(totals.investor), icon: Wallet, color: "#2563eb", bg: "#eff6ff" },
    { label: "من حساب الضمان", value: fmtNum(totals.escrow), icon: Landmark, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "إجمالي الإيرادات", value: fmtNum(totals.revenue), icon: TrendingUp, color: "#22c55e", bg: "#f0fdf4" },
    { label: "الربح المتوقع", value: fmtNum(profit), icon: BarChart3, color: profit >= 0 ? "#059669" : "#dc2626", bg: profit >= 0 ? "#ecfdf5" : "#fef2f2" },
    { label: "العائد على الاستثمار", value: fmtPct(roi), icon: TrendingUp, color: roi >= 0 ? "#059669" : "#dc2626", bg: roi >= 0 ? "#ecfdf5" : "#fef2f2" },
  ];

  // SVG Chart
  const W = 800, H = 200, PAD = 50;
  const max = chartData.maxCumulative || 1;
  const points = chartData.cumulative.map((v, i) => ({
    x: PAD + (i / (chartData.cumulative.length - 1)) * (W - PAD * 2),
    y: H - PAD - (v / max) * (H - PAD * 2),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pathD + ` L ${points[points.length - 1].x} ${H - PAD} L ${PAD} ${H - PAD} Z`;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${card.color}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Icon style={{ width: 14, height: 14, color: card.color }} />
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: card.color, fontFamily: "monospace" }}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ background: "#fafbfc", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#334155" }}>
          التدفق النقدي التراكمي — {SCENARIO_LABELS[selectedScenario]}
        </h3>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = H - PAD - frac * (H - PAD * 2);
            return (
              <g key={frac}>
                <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
                <text x={PAD - 4} y={y + 3} textAnchor="end" fontSize={7} fill="#94a3b8">
                  {fmtNum(max * frac)}
                </text>
              </g>
            );
          })}
          {/* X labels */}
          {chartData.labels.filter((_, i) => i % 3 === 0).map((label, idx) => {
            const i = idx * 3;
            const x = PAD + (i / (chartData.cumulative.length - 1)) * (W - PAD * 2);
            return (
              <text key={i} x={x} y={H - PAD + 14} textAnchor="middle" fontSize={5} fill="#94a3b8">
                {label}
              </text>
            );
          })}
          {/* Area + Line */}
          <path d={areaD} fill={SCENARIO_COLORS[selectedScenario] + "15"} />
          <path d={pathD} fill="none" stroke={SCENARIO_COLORS[selectedScenario]} strokeWidth={2} />
        </svg>
      </div>

      {/* Project table */}
      <div style={{ background: "#fafbfc", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#334155" }}>
          ملخص المشاريع — {SCENARIO_LABELS[selectedScenario]}
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["المشروع", "رأس مال المستثمر", "حساب الضمان", "إجمالي التكاليف", "الإيرادات", "الربح", "ROI", "المدة"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p: any) => {
                const s = p.scenarios?.[selectedScenario];
                if (!s) return null;
                const pProfit = (p.totalRevenue || 0) - s.grandTotal;
                const pRoi = s.grandTotal > 0 ? ((p.totalRevenue - s.grandTotal) / s.grandTotal) * 100 : 0;
                return (
                  <tr key={p.projectId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#2563eb" }}>{fmtFull(s.investorTotal)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#7c3aed" }}>{fmtFull(s.escrowTotal)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#0f172a" }}>{fmtFull(s.grandTotal)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#059669" }}>
                      {p.totalRevenue > 0 ? fmtFull(p.totalRevenue) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: pProfit >= 0 ? "#059669" : "#dc2626", fontWeight: 700 }}>
                      {fmtFull(pProfit)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: pRoi >= 0 ? "#059669" : "#dc2626" }}>
                      {fmtPct(pRoi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{p.totalMonths} شهر</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                <td style={{ padding: "12px", fontWeight: 800, color: "#0f172a", borderTop: "2px solid #e5e7eb" }}>الإجمالي</td>
                <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#2563eb", borderTop: "2px solid #e5e7eb" }}>{fmtFull(totals.investor)}</td>
                <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#7c3aed", borderTop: "2px solid #e5e7eb" }}>{fmtFull(totals.escrow)}</td>
                <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#0f172a", borderTop: "2px solid #e5e7eb" }}>{fmtFull(totals.grand)}</td>
                <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#059669", borderTop: "2px solid #e5e7eb" }}>{fmtFull(totals.revenue)}</td>
                <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: profit >= 0 ? "#059669" : "#dc2626", borderTop: "2px solid #e5e7eb" }}>{fmtFull(profit)}</td>
                <td style={{ padding: "12px", textAlign: "center", color: roi >= 0 ? "#059669" : "#dc2626", borderTop: "2px solid #e5e7eb" }}>{fmtPct(roi)}</td>
                <td style={{ padding: "12px", textAlign: "center", color: "#64748b", borderTop: "2px solid #e5e7eb" }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: TIMELINE (Gantt)
// ═══════════════════════════════════════════════════════════════════════════════
function TimelineTab({
  projects, selectedScenario,
}: {
  projects: any[];
  selectedScenario: ScenarioKey;
}) {
  // Find global timeline range
  const globalStart = useMemo(() => {
    let minYear = 2030, minMonth = 12;
    for (const p of projects) {
      const [y, m] = (p.startDate || "2026-04").split("-").map(Number);
      if (y < minYear || (y === minYear && m < minMonth)) {
        minYear = y; minMonth = m;
      }
    }
    return { year: minYear, month: minMonth };
  }, [projects]);

  const globalEnd = useMemo(() => {
    let maxAbs = 0;
    for (const p of projects) {
      const [y, m] = (p.startDate || "2026-04").split("-").map(Number);
      const abs = y * 12 + m + p.totalMonths;
      if (abs > maxAbs) maxAbs = abs;
    }
    return { year: Math.floor(maxAbs / 12), month: (maxAbs % 12) || 12 };
  }, [projects]);

  const totalMonthsGlobal = (globalEnd.year - globalStart.year) * 12 + (globalEnd.month - globalStart.month) + 2;

  // Year markers
  const yearMarkers: { label: string; offset: number }[] = [];
  for (let y = globalStart.year; y <= globalEnd.year + 1; y++) {
    const offset = (y - globalStart.year) * 12 - (globalStart.month - 1);
    if (offset >= 0 && offset < totalMonthsGlobal) {
      yearMarkers.push({ label: String(y), offset });
    }
  }

  // Month markers (every 1 month)
  const monthMarkers: { label: string; offset: number }[] = [];
  for (let i = 0; i < totalMonthsGlobal; i++) {
    const mIdx = ((globalStart.month - 1 + i) % 12);
    const y = globalStart.year + Math.floor((globalStart.month - 1 + i) / 12);
    monthMarkers.push({ label: ARABIC_MONTHS[mIdx].substring(0, 3), offset: i });
  }

  const BAR_H = 28;
  const ROW_H = 50;
  const LABEL_W = 200;
  const MONTH_W = 22;
  const chartW = totalMonthsGlobal * MONTH_W;

  return (
    <div style={{ background: "#fafbfc", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155" }}>
          الجدول الزمني — {SCENARIO_LABELS[selectedScenario]}
        </h3>
        <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
          {Object.entries(PHASE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: PHASE_COLORS[key] }} />
              <span style={{ color: "#64748b" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: LABEL_W + chartW }}>
          {/* Labels column */}
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            {/* Year header spacer */}
            <div style={{ height: 20 }} />
            {/* Month header spacer */}
            <div style={{ height: 16 }} />
            {projects.map((p: any) => (
              <div key={p.projectId} style={{ height: ROW_H, display: "flex", alignItems: "center", paddingRight: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Year headers */}
            <div style={{ height: 20, display: "flex", position: "relative" }}>
              {yearMarkers.map((ym) => (
                <div key={ym.label} style={{ position: "absolute", left: ym.offset * MONTH_W, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                  {ym.label}
                </div>
              ))}
            </div>
            {/* Month headers */}
            <div style={{ height: 16, display: "flex" }}>
              {monthMarkers.map((mm, i) => (
                <div key={i} style={{ width: MONTH_W, fontSize: 7, color: "#94a3b8", textAlign: "center", flexShrink: 0 }}>
                  {mm.label}
                </div>
              ))}
            </div>
            {/* Bars */}
            {projects.map((p: any) => {
              const [pY, pM] = (p.startDate || "2026-04").split("-").map(Number);
              const projectOffset = (pY - globalStart.year) * 12 + (pM - globalStart.month);
              const phases = [
                { key: "design", ...p.phaseInfo.design },
                { key: "offplan", ...p.phaseInfo.offplan },
                { key: "construction", ...p.phaseInfo.construction },
                { key: "handover", ...p.phaseInfo.handover },
              ];

              return (
                <div key={p.projectId} style={{ height: ROW_H, position: "relative", borderBottom: "1px solid #f1f5f9" }}>
                  {phases.map((phase) => {
                    if (phase.duration <= 0) return null;
                    const left = (projectOffset + phase.start - 1) * MONTH_W;
                    const width = phase.duration * MONTH_W;
                    return (
                      <div
                        key={phase.key}
                        style={{
                          position: "absolute",
                          left,
                          top: (ROW_H - BAR_H) / 2,
                          width,
                          height: BAR_H,
                          background: PHASE_COLORS[phase.key],
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          fontWeight: 700,
                          color: "#fff",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                        title={`${PHASE_LABELS[phase.key]}: ${phase.duration} شهر`}
                      >
                        {width > 40 ? PHASE_LABELS[phase.key] : ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════
function ComparisonTab({
  projects, portfolioTotals, scenarios,
}: {
  projects: any[];
  portfolioTotals: Record<ScenarioKey, { investor: number; escrow: number; grand: number; revenue: number }>;
  scenarios: ScenarioKey[];
}) {
  return (
    <div style={{ background: "#fafbfc", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#334155" }}>
        مقارنة السيناريوهات الثلاثة — جميع المشاريع
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th rowSpan={2} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>المشروع</th>
              {scenarios.map((sc) => (
                <th key={sc} colSpan={4} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: SCENARIO_COLORS[sc], borderBottom: "1px solid #e5e7eb", background: SCENARIO_COLORS[sc] + "08" }}>
                  {SCENARIO_LABELS[sc].split(" — ")[0]}
                </th>
              ))}
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              {scenarios.map((sc) => (
                ["المستثمر", "الضمان", "الإجمالي", "ROI"].map((h) => (
                  <th key={`${sc}-${h}`} style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: "#64748b", borderBottom: "2px solid #e5e7eb", fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any) => (
              <tr key={p.projectId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 6px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", fontSize: 10 }}>{p.name}</td>
                {scenarios.map((sc) => {
                  const s = p.scenarios?.[sc];
                  if (!s) return (
                    <>
                      <td key={`${sc}-inv`} style={{ padding: "8px 6px", textAlign: "center", color: "#cbd5e1" }}>—</td>
                      <td key={`${sc}-esc`} style={{ padding: "8px 6px", textAlign: "center", color: "#cbd5e1" }}>—</td>
                      <td key={`${sc}-tot`} style={{ padding: "8px 6px", textAlign: "center", color: "#cbd5e1" }}>—</td>
                      <td key={`${sc}-roi`} style={{ padding: "8px 6px", textAlign: "center", color: "#cbd5e1" }}>—</td>
                    </>
                  );
                  const pRoi = s.grandTotal > 0 ? ((p.totalRevenue - s.grandTotal) / s.grandTotal) * 100 : 0;
                  return (
                    <>
                      <td key={`${sc}-inv`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#2563eb", borderBottom: "1px solid #f1f5f9" }}>
                        {fmtNum(s.investorTotal)}
                      </td>
                      <td key={`${sc}-esc`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#7c3aed", borderBottom: "1px solid #f1f5f9" }}>
                        {fmtNum(s.escrowTotal)}
                      </td>
                      <td key={`${sc}-tot`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#0f172a", fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}>
                        {fmtNum(s.grandTotal)}
                      </td>
                      <td key={`${sc}-roi`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: pRoi >= 0 ? "#059669" : "#dc2626", borderBottom: "1px solid #f1f5f9" }}>
                        {fmtPct(pRoi)}
                      </td>
                    </>
                  );
                })}
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
              <td style={{ padding: "10px 6px", fontWeight: 800, color: "#0f172a", borderTop: "2px solid #e5e7eb" }}>إجمالي المحفظة</td>
              {scenarios.map((sc) => {
                const t = portfolioTotals[sc];
                const tRoi = t.grand > 0 ? ((t.revenue - t.grand) / t.grand) * 100 : 0;
                return (
                  <>
                    <td key={`${sc}-inv-t`} style={{ padding: "10px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#2563eb", fontWeight: 800, borderTop: "2px solid #e5e7eb" }}>
                      {fmtNum(t.investor)}
                    </td>
                    <td key={`${sc}-esc-t`} style={{ padding: "10px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#7c3aed", fontWeight: 800, borderTop: "2px solid #e5e7eb" }}>
                      {fmtNum(t.escrow)}
                    </td>
                    <td key={`${sc}-tot-t`} style={{ padding: "10px 6px", textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#0f172a", fontWeight: 800, borderTop: "2px solid #e5e7eb" }}>
                      {fmtNum(t.grand)}
                    </td>
                    <td key={`${sc}-roi-t`} style={{ padding: "10px 6px", textAlign: "center", fontSize: 10, fontWeight: 800, color: tRoi >= 0 ? "#059669" : "#dc2626", borderTop: "2px solid #e5e7eb" }}>
                      {fmtPct(tRoi)}
                    </td>
                  </>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
