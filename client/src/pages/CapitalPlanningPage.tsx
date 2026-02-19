import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  TrendingUp,
  Layers,
  Settings2,
  BarChart3,
  PieChart,
  Clock,
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Save,
  RotateCcw,
  Eye,
  Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

// Phase colors
const PHASE_COLORS = [
  { bg: "#f59e0b", light: "#fef3c7", text: "#92400e", name: "دراسة السوق والجدوى" },
  { bg: "#8b5cf6", light: "#ede9fe", text: "#5b21b6", name: "الاستشاري والتصميم" },
  { bg: "#06b6d4", light: "#cffafe", text: "#155e75", name: "الموافقات الحكومية" },
  { bg: "#f97316", light: "#ffedd5", text: "#9a3412", name: "تعيين المقاول" },
  { bg: "#10b981", light: "#d1fae5", text: "#065f46", name: "البناء والتسليم" },
];

const PHASE_NAMES_EN = [
  "Market & Feasibility",
  "Consultant & Design",
  "Authority Approvals",
  "Contractor Appointment",
  "Construction & Delivery",
];

// Format number as AED
function formatAED(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

function formatFullAED(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(value) + " AED";
}

// Get month label from offset
function getMonthLabel(startDate: string, monthOffset: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const date = new Date(year, month - 1 + monthOffset, 1);
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthLabelShort(startDate: string, monthOffset: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const date = new Date(year, month - 1 + monthOffset, 1);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

interface PhaseData {
  phaseNumber: number;
  phaseName: string;
  startMonth: number;
  durationMonths: number;
  estimatedCost: string;
  delayMonths: number;
  notes?: string;
}

interface ProjectData {
  id: number;
  name: string;
  phases: PhaseData[];
  settings: { startDate: string; totalBudget?: string; notes?: string } | null;
}

// ─── Gantt Chart Component ───
function GanttChart({
  projects,
  selectedProjectId,
}: {
  projects: ProjectData[];
  selectedProjectId: number | null;
}) {
  const visibleProjects = selectedProjectId
    ? projects.filter((p) => p.id === selectedProjectId)
    : projects;

  // Calculate total months needed
  const maxMonth = useMemo(() => {
    let max = 0;
    visibleProjects.forEach((p) => {
      p.phases.forEach((ph) => {
        const end = ph.startMonth + ph.delayMonths + ph.durationMonths;
        if (end > max) max = end;
      });
    });
    return Math.max(max + 2, 24);
  }, [visibleProjects]);

  const startDate = visibleProjects[0]?.settings?.startDate || "2025-01";

  // Month headers
  const months = Array.from({ length: maxMonth }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(900, maxMonth * 44)}px` }}>
        {/* Month headers */}
        <div className="flex border-b border-stone-200 mb-1">
          <div className="w-48 shrink-0 px-3 py-2 text-xs font-semibold text-stone-500">
            المشروع / المرحلة
          </div>
          <div className="flex-1 flex">
            {months.map((m) => (
              <div
                key={m}
                className="flex-1 min-w-[42px] text-center text-[10px] text-stone-400 py-2 border-l border-stone-100"
              >
                {getMonthLabelShort(startDate, m)}
              </div>
            ))}
          </div>
        </div>

        {/* Project rows */}
        {visibleProjects.map((project) => (
          <div key={project.id} className="mb-4">
            {/* Project name */}
            <div className="flex items-center px-3 py-2 bg-stone-50 rounded-lg mb-1">
              <div className="w-48 shrink-0">
                <span className="text-sm font-bold text-stone-800">{project.name}</span>
              </div>
              <div className="flex-1" />
            </div>

            {/* Phase bars */}
            {project.phases
              .sort((a, b) => a.phaseNumber - b.phaseNumber)
              .map((phase) => {
                const color = PHASE_COLORS[phase.phaseNumber - 1];
                const effectiveStart = phase.startMonth + phase.delayMonths;
                const leftPct = (effectiveStart / maxMonth) * 100;
                const widthPct = (phase.durationMonths / maxMonth) * 100;
                const cost = parseFloat(phase.estimatedCost) || 0;

                return (
                  <div key={phase.phaseNumber} className="flex items-center mb-0.5">
                    <div className="w-48 shrink-0 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color.bg }}
                        />
                        <span className="text-xs text-stone-600 truncate">{color.name}</span>
                      </div>
                    </div>
                    <div className="flex-1 relative h-8">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {months.map((m) => (
                          <div
                            key={m}
                            className="flex-1 min-w-[42px] border-l border-stone-50"
                          />
                        ))}
                      </div>
                      {/* Phase bar */}
                      <div
                        className="absolute top-1 h-6 rounded-md flex items-center justify-center transition-all duration-300 cursor-default group"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: color.bg,
                          minWidth: "40px",
                        }}
                      >
                        <span className="text-[10px] font-semibold text-white truncate px-1">
                          {cost > 0 ? formatAED(cost) : `${phase.durationMonths}m`}
                        </span>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                          <div className="font-semibold">{color.name}</div>
                          <div className="text-stone-300 mt-0.5">
                            {getMonthLabel(project.settings?.startDate || "2025-01", effectiveStart)} →{" "}
                            {getMonthLabel(
                              project.settings?.startDate || "2025-01",
                              effectiveStart + phase.durationMonths - 1
                            )}
                          </div>
                          {cost > 0 && (
                            <div className="text-amber-300 mt-0.5">{formatFullAED(cost)}</div>
                          )}
                          {phase.delayMonths !== 0 && (
                            <div className="text-red-300 mt-0.5">
                              {phase.delayMonths > 0 ? `تأخير ${phase.delayMonths} شهر` : `تسريع ${Math.abs(phase.delayMonths)} شهر`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Cashflow Chart ───
function CashflowChart({
  projects,
  selectedProjectId,
}: {
  projects: ProjectData[];
  selectedProjectId: number | null;
}) {
  const visibleProjects = selectedProjectId
    ? projects.filter((p) => p.id === selectedProjectId)
    : projects;

  const chartData = useMemo(() => {
    // Find max month across all visible projects
    let maxMonth = 0;
    visibleProjects.forEach((p) => {
      p.phases.forEach((ph) => {
        const end = ph.startMonth + ph.delayMonths + ph.durationMonths;
        if (end > maxMonth) maxMonth = end;
      });
    });
    maxMonth = Math.max(maxMonth, 12);

    const startDate = visibleProjects[0]?.settings?.startDate || "2025-01";
    const data: any[] = [];

    for (let m = 0; m < maxMonth; m++) {
      const entry: any = {
        month: getMonthLabelShort(startDate, m),
        monthFull: getMonthLabel(startDate, m),
        total: 0,
      };

      visibleProjects.forEach((project) => {
        let projectMonthly = 0;
        project.phases.forEach((phase) => {
          const cost = parseFloat(phase.estimatedCost) || 0;
          if (cost <= 0) return;
          const effectiveStart = phase.startMonth + phase.delayMonths;
          const effectiveEnd = effectiveStart + phase.durationMonths;
          if (m >= effectiveStart && m < effectiveEnd) {
            projectMonthly += cost / phase.durationMonths;
          }
        });
        entry[`project_${project.id}`] = Math.round(projectMonthly);
        entry.total += Math.round(projectMonthly);
      });

      data.push(entry);
    }

    return data;
  }, [visibleProjects]);

  const projectColors = ["#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#ec4899"];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          {visibleProjects.map((p, i) => (
            <linearGradient key={p.id} id={`color_${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={projectColors[i % projectColors.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={projectColors[i % projectColors.length]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          interval={Math.max(0, Math.floor(chartData.length / 12))}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatAED(v)}
          width={60}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-white border border-stone-200 rounded-xl shadow-xl p-3 text-right" dir="rtl">
                <div className="text-xs font-semibold text-stone-700 mb-2">{payload[0]?.payload?.monthFull}</div>
                {payload.map((entry: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-4 text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-stone-600">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-stone-800">{formatFullAED(entry.value)}</span>
                  </div>
                ))}
                <div className="border-t border-stone-100 mt-1.5 pt-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700">الإجمالي</span>
                  <span className="font-bold text-stone-900">
                    {formatFullAED(payload.reduce((sum: number, e: any) => sum + (e.value || 0), 0))}
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Legend
          content={({ payload }) => (
            <div className="flex flex-wrap justify-center gap-4 mt-2" dir="rtl">
              {payload?.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.value}
                </div>
              ))}
            </div>
          )}
        />
        {visibleProjects.map((p, i) => (
          <Area
            key={p.id}
            type="monotone"
            dataKey={`project_${p.id}`}
            name={p.name}
            stroke={projectColors[i % projectColors.length]}
            strokeWidth={2}
            fill={`url(#color_${p.id})`}
            stackId="1"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Phase Editor ───
function PhaseEditor({
  project,
  onSave,
  isSaving,
}: {
  project: ProjectData;
  onSave: (projectId: number, phases: PhaseData[], startDate: string) => void;
  isSaving: boolean;
}) {
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [startDate, setStartDate] = useState(project.settings?.startDate || "2025-01");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (project.phases.length > 0) {
      setPhases(project.phases.map(p => ({ ...p })));
    } else {
      // Default phases
      setPhases([
        { phaseNumber: 1, phaseName: "دراسة السوق والجدوى", startMonth: 0, durationMonths: 3, estimatedCost: "0", delayMonths: 0 },
        { phaseNumber: 2, phaseName: "الاستشاري والتصميم", startMonth: 3, durationMonths: 6, estimatedCost: "0", delayMonths: 0 },
        { phaseNumber: 3, phaseName: "الموافقات الحكومية", startMonth: 9, durationMonths: 3, estimatedCost: "0", delayMonths: 0 },
        { phaseNumber: 4, phaseName: "تعيين المقاول", startMonth: 12, durationMonths: 3, estimatedCost: "0", delayMonths: 0 },
        { phaseNumber: 5, phaseName: "البناء والتسليم", startMonth: 15, durationMonths: 18, estimatedCost: "0", delayMonths: 0 },
      ]);
    }
    setStartDate(project.settings?.startDate || "2025-01");
    setHasChanges(false);
  }, [project]);

  const updatePhase = (idx: number, field: string, value: any) => {
    setPhases((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const shiftPhase = (idx: number, delta: number) => {
    setPhases((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], delayMonths: updated[idx].delayMonths + delta };
      return updated;
    });
    setHasChanges(true);
  };

  const totalCost = phases.reduce((sum, p) => sum + (parseFloat(p.estimatedCost) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Start date */}
      <div className="flex items-center gap-4 bg-stone-50 rounded-xl p-4">
        <Calendar className="w-5 h-5 text-stone-400" />
        <div>
          <label className="text-xs text-stone-500 block mb-1">تاريخ بداية المشروع</label>
          <input
            type="month"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setHasChanges(true); }}
            className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <div className="mr-auto text-left">
          <div className="text-xs text-stone-500">إجمالي التكلفة</div>
          <div className="text-lg font-bold text-stone-800">{formatFullAED(totalCost)}</div>
        </div>
      </div>

      {/* Phases table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 w-48">المرحلة</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 w-24">البداية (شهر)</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 w-24">المدة (شهر)</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 w-40">التكلفة (AED)</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 w-36">تأخير / تسريع</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 w-28">الفترة الفعلية</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase, idx) => {
              const color = PHASE_COLORS[idx];
              const effectiveStart = phase.startMonth + phase.delayMonths;
              return (
                <tr key={phase.phaseNumber} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.bg }} />
                      <span className="font-medium text-stone-700 text-xs">{color.name}</span>
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5 mr-5">{PHASE_NAMES_EN[idx]}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      value={phase.startMonth}
                      onChange={(e) => updatePhase(idx, "startMonth", parseInt(e.target.value) || 0)}
                      className="w-16 text-center bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      value={phase.durationMonths}
                      onChange={(e) => updatePhase(idx, "durationMonths", parseInt(e.target.value) || 1)}
                      className="w-16 text-center bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="text"
                      value={phase.estimatedCost}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        updatePhase(idx, "estimatedCost", val);
                      }}
                      className="w-32 text-center bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => shiftPhase(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                        title="تسريع شهر"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className={`w-10 text-center text-xs font-semibold ${
                        phase.delayMonths > 0 ? "text-red-600" : phase.delayMonths < 0 ? "text-emerald-600" : "text-stone-400"
                      }`}>
                        {phase.delayMonths > 0 ? `+${phase.delayMonths}` : phase.delayMonths}
                      </span>
                      <button
                        onClick={() => shiftPhase(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                        title="تأخير شهر"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="text-[10px] text-stone-500">
                      {getMonthLabelShort(startDate, effectiveStart)} → {getMonthLabelShort(startDate, effectiveStart + phase.durationMonths - 1)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (project.phases.length > 0) {
                setPhases(project.phases.map(p => ({ ...p })));
              }
              setStartDate(project.settings?.startDate || "2025-01");
              setHasChanges(false);
            }}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(project.id, phases, startDate)}
            disabled={isSaving}
            className="gap-1.5 text-xs bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Summary Cards ───
function SummaryCards({ projects }: { projects: ProjectData[] }) {
  const stats = useMemo(() => {
    let totalCost = 0;
    let totalMonths = 0;
    let activePhases = 0;
    let delayedPhases = 0;

    projects.forEach((p) => {
      let projectMax = 0;
      p.phases.forEach((ph) => {
        totalCost += parseFloat(ph.estimatedCost) || 0;
        const end = ph.startMonth + ph.delayMonths + ph.durationMonths;
        if (end > projectMax) projectMax = end;
        activePhases++;
        if (ph.delayMonths > 0) delayedPhases++;
      });
      if (projectMax > totalMonths) totalMonths = projectMax;
    });

    return { totalCost, totalMonths, activePhases, delayedPhases, projectCount: projects.length };
  }, [projects]);

  const cards = [
    {
      label: "إجمالي الاستثمار",
      value: formatFullAED(stats.totalCost),
      icon: DollarSign,
      color: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/20",
    },
    {
      label: "عدد المشاريع",
      value: stats.projectCount.toString(),
      icon: Building2,
      color: "from-violet-500 to-purple-600",
      shadow: "shadow-violet-500/20",
    },
    {
      label: "أطول فترة",
      value: `${stats.totalMonths} شهر`,
      icon: Clock,
      color: "from-cyan-500 to-teal-600",
      shadow: "shadow-cyan-500/20",
    },
    {
      label: "مراحل متأخرة",
      value: stats.delayedPhases.toString(),
      icon: AlertTriangle,
      color: stats.delayedPhases > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600",
      shadow: stats.delayedPhases > 0 ? "shadow-red-500/20" : "shadow-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-2xl border border-stone-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center ${card.shadow} shadow-lg`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-stone-500">{card.label}</span>
          </div>
          <div className="text-xl font-bold text-stone-800">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───
export default function CapitalPlanningPage() {
  const { isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "edit">("overview");
  const [isSaving, setIsSaving] = useState(false);

  const { data: portfolio = [], refetch } = trpc.capitalPlanning.getPortfolio.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const initMutation = trpc.capitalPlanning.initializePhases.useMutation({
    onSuccess: () => refetch(),
  });

  const bulkUpdateMutation = trpc.capitalPlanning.bulkUpdatePhases.useMutation({
    onSuccess: () => {
      refetch();
      setIsSaving(false);
    },
    onError: () => setIsSaving(false),
  });

  const updateSettingsMutation = trpc.capitalPlanning.updateSettings.useMutation({
    onSuccess: () => refetch(),
  });

  // Transform portfolio data
  const projects: ProjectData[] = useMemo(() => {
    return portfolio.map((p: any) => ({
      id: p.id,
      name: p.name,
      phases: (p.phases || []).map((ph: any) => ({
        phaseNumber: ph.phaseNumber,
        phaseName: ph.phaseName,
        startMonth: ph.startMonth,
        durationMonths: ph.durationMonths,
        estimatedCost: ph.estimatedCost || "0",
        delayMonths: ph.delayMonths || 0,
        notes: ph.notes,
      })),
      settings: p.settings
        ? {
            startDate: p.settings.startDate,
            totalBudget: p.settings.totalBudget,
            notes: p.settings.notes,
          }
        : null,
    }));
  }, [portfolio]);

  const configuredProjects = projects.filter((p) => p.settings !== null && p.phases.length > 0);
  const unconfiguredProjects = projects.filter((p) => p.settings === null || p.phases.length === 0);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  const handleSavePhases = useCallback(
    async (projectId: number, phases: PhaseData[], startDate: string) => {
      setIsSaving(true);
      await updateSettingsMutation.mutateAsync({ projectId, startDate });
      await bulkUpdateMutation.mutateAsync({
        projectId,
        phases: phases.map((p) => ({
          phaseNumber: p.phaseNumber,
          startMonth: p.startMonth,
          durationMonths: p.durationMonths,
          estimatedCost: p.estimatedCost,
          delayMonths: p.delayMonths,
          notes: p.notes,
        })),
      });
    },
    [updateSettingsMutation, bulkUpdateMutation]
  );

  const handleInitProject = async (projectId: number) => {
    await initMutation.mutateAsync({ projectId, startDate: "2025-06" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-neutral-900" />
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-6 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                لوحة التخطيط الرأسمالي
              </h1>
              <p className="text-lg text-amber-300 font-medium mb-1">Strategic Capital Planning Board</p>
              <p className="text-stone-400 text-sm max-w-2xl">
                رؤية شاملة لجدول المشاريع والتدفقات النقدية المطلوبة — أداة لاتخاذ القرارات الاستراتيجية
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-4 pb-12">
        {/* Summary Cards */}
        {configuredProjects.length > 0 && (
          <div className="mb-6">
            <SummaryCards projects={configuredProjects} />
          </div>
        )}

        {/* View Controls */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Project filter */}
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-stone-400" />
              <span className="text-xs text-stone-500">عرض:</span>
            </div>
            <button
              onClick={() => setSelectedProjectId(null)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedProjectId === null
                  ? "bg-stone-800 text-white shadow-md"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5 inline ml-1.5" />
              جميع المشاريع
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  selectedProjectId === p.id
                    ? "bg-stone-800 text-white shadow-md"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {p.name}
              </button>
            ))}

            <div className="mr-auto flex items-center gap-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === "overview"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                نظرة عامة
              </button>
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === "edit"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                تعديل المراحل
              </button>
            </div>
          </div>
        </div>

        {/* Unconfigured projects notice */}
        {unconfiguredProjects.length > 0 && activeTab === "edit" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-800 mb-2">مشاريع لم يتم إعدادها بعد</h3>
                <div className="flex flex-wrap gap-2">
                  {unconfiguredProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleInitProject(p.id)}
                      disabled={initMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {activeTab === "overview" ? (
          <div className="space-y-6">
            {/* Gantt Chart */}
            {configuredProjects.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800">الجدول الزمني للمشاريع</h2>
                    <p className="text-xs text-stone-500">عرض المراحل الخمس لكل مشروع على خط زمني واحد</p>
                  </div>
                </div>
                <GanttChart projects={configuredProjects} selectedProjectId={selectedProjectId} />
              </div>
            )}

            {/* Cashflow Chart */}
            {configuredProjects.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800">التدفق النقدي الشهري</h2>
                    <p className="text-xs text-stone-500">
                      {selectedProjectId
                        ? "المبالغ المطلوبة شهرياً لهذا المشروع"
                        : "إجمالي المبالغ المطلوبة شهرياً لجميع المشاريع"}
                    </p>
                  </div>
                </div>
                <CashflowChart projects={configuredProjects} selectedProjectId={selectedProjectId} />
              </div>
            )}

            {/* Phase Legend */}
            <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
              <h3 className="text-sm font-bold text-stone-700 mb-4">دليل المراحل</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {PHASE_COLORS.map((phase, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: phase.light }}>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: phase.bg }} />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: phase.text }}>{phase.name}</div>
                      <div className="text-[10px] text-stone-500">{PHASE_NAMES_EN[i]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty state */}
            {configuredProjects.length === 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-bold text-stone-700 mb-2">لا توجد مشاريع مُعدّة</h3>
                <p className="text-sm text-stone-500 mb-4">
                  انتقل إلى تبويب "تعديل المراحل" لإعداد المراحل والتكاليف لكل مشروع
                </p>
                <Button
                  onClick={() => setActiveTab("edit")}
                  className="gap-1.5 bg-gradient-to-r from-stone-700 to-stone-900"
                >
                  <Settings2 className="w-4 h-4" />
                  إعداد المشاريع
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Edit Tab */
          <div className="space-y-6">
            {selectedProject ? (
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-md">
                    <Settings2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800">{selectedProject.name}</h2>
                    <p className="text-xs text-stone-500">تعديل المراحل والتكاليف والجدول الزمني</p>
                  </div>
                </div>
                <PhaseEditor
                  project={selectedProject}
                  onSave={handleSavePhases}
                  isSaving={isSaving}
                />
              </div>
            ) : (
              /* All projects edit */
              configuredProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-md">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-stone-800">{project.name}</h2>
                      <p className="text-xs text-stone-500">تعديل المراحل والتكاليف</p>
                    </div>
                  </div>
                  <PhaseEditor
                    project={project}
                    onSave={handleSavePhases}
                    isSaving={isSaving}
                  />
                </div>
              ))
            )}

            {configuredProjects.length === 0 && unconfiguredProjects.length === 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-12 text-center">
                <p className="text-stone-500">لا توجد مشاريع. أضف مشاريع من لوحة التحكم أولاً.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
