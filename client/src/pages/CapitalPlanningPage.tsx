import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  BarChart3,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Constants ───
const PHASES = [
  { num: 1, name: "دراسة السوق والجدوى", nameEn: "Market & Feasibility", color: "#f59e0b", bg: "#fef3c7" },
  { num: 2, name: "الاستشاري والتصميم", nameEn: "Consultant & Design", color: "#8b5cf6", bg: "#ede9fe" },
  { num: 3, name: "الموافقات الحكومية", nameEn: "Authority Approvals", color: "#06b6d4", bg: "#cffafe" },
  { num: 4, name: "تعيين المقاول", nameEn: "Contractor Appointment", color: "#f97316", bg: "#ffedd5" },
  { num: 5, name: "البناء والتسليم", nameEn: "Construction & Delivery", color: "#10b981", bg: "#d1fae5" },
];

// ─── Helpers ───
function formatAED(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(value) + " AED";
}

function formatAEDShort(value: number): string {
  if (value === 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

function getMonthLabel(startDate: string, monthOffset: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const d = new Date(year, month - 1 + monthOffset, 1);
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthShort(startDate: string, monthOffset: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const d = new Date(year, month - 1 + monthOffset, 1);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// ─── Types ───
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

// ═══════════════════════════════════════════════
// Project Card - Shows one project with editable phases
// ═══════════════════════════════════════════════
function ProjectCard({
  project,
  onSave,
  isSaving,
  isExpanded,
  onToggle,
}: {
  project: ProjectData;
  onSave: (projectId: number, phases: PhaseData[], startDate: string) => void;
  isSaving: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [phases, setPhases] = useState<PhaseData[]>(
    project.phases.length > 0
      ? project.phases.map((p) => ({ ...p }))
      : PHASES.map((ph) => ({
          phaseNumber: ph.num,
          phaseName: ph.name,
          startMonth: ph.num === 1 ? 0 : ph.num === 2 ? 3 : ph.num === 3 ? 9 : ph.num === 4 ? 12 : 15,
          durationMonths: ph.num === 2 ? 6 : ph.num === 5 ? 18 : 3,
          estimatedCost: "0",
          delayMonths: 0,
        }))
  );
  const [startDate, setStartDate] = useState(project.settings?.startDate || "2025-06");
  const [hasChanges, setHasChanges] = useState(false);

  const totalCost = useMemo(
    () => phases.reduce((sum, p) => sum + (parseFloat(p.estimatedCost) || 0), 0),
    [phases]
  );

  const totalMonths = useMemo(() => {
    let max = 0;
    phases.forEach((p) => {
      const end = p.startMonth + p.delayMonths + p.durationMonths;
      if (end > max) max = end;
    });
    return max;
  }, [phases]);

  const updatePhase = (idx: number, field: string, value: any) => {
    setPhases((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setHasChanges(true);
  };

  const handleDelay = (idx: number, delta: number) => {
    setPhases((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], delayMonths: next[idx].delayMonths + delta };
      return next;
    });
    setHasChanges(true);
  };

  const handleReset = () => {
    if (project.phases.length > 0) {
      setPhases(project.phases.map((p) => ({ ...p })));
    }
    setStartDate(project.settings?.startDate || "2025-06");
    setHasChanges(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden">
      {/* Project Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-stone-50/50 transition-colors text-right"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center shadow-md shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-800">{project.name}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-stone-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {project.settings ? getMonthLabel(project.settings.startDate, 0) : "لم يُحدد"}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {totalCost > 0 ? formatAED(totalCost) : "لم تُدخل التكاليف"}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {totalMonths} شهر
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Phase status dots */}
          <div className="hidden md:flex items-center gap-1">
            {phases.map((p, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: PHASES[i]?.color }}
                title={PHASES[i]?.name}
              />
            ))}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-stone-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-stone-100 p-5 space-y-5">
          {/* Start Date */}
          <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl">
            <Calendar className="w-5 h-5 text-stone-500" />
            <div>
              <label className="text-sm font-semibold text-stone-700">تاريخ بداية المشروع</label>
              <p className="text-xs text-stone-500 mt-0.5">الشهر الذي تبدأ فيه أول مرحلة</p>
            </div>
            <input
              type="month"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setHasChanges(true);
              }}
              className="mr-auto px-4 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Instruction */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">كيفية الاستخدام:</p>
              <p>
                عدّل <strong>المدة</strong> (بالأشهر) و<strong>التكلفة</strong> (بالدرهم) لكل مرحلة.
                استخدم أزرار <strong className="text-red-600">تأخير ←</strong> و<strong className="text-emerald-600">→ تسريع</strong> لزحزحة المرحلة شهراً واحداً.
                اضغط <strong>حفظ التغييرات</strong> عند الانتهاء.
              </p>
            </div>
          </div>

          {/* Phases Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b-2 border-stone-200">
                  <th className="text-right py-3 px-3 font-bold text-stone-700 w-56">المرحلة</th>
                  <th className="text-center py-3 px-3 font-bold text-stone-700 w-28">البداية (شهر)</th>
                  <th className="text-center py-3 px-3 font-bold text-stone-700 w-28">المدة (شهر)</th>
                  <th className="text-center py-3 px-3 font-bold text-stone-700 w-44">التكلفة (AED)</th>
                  <th className="text-center py-3 px-3 font-bold text-stone-700 w-44">تأخير / تسريع</th>
                  <th className="text-center py-3 px-3 font-bold text-stone-700 w-48">الفترة الفعلية</th>
                </tr>
              </thead>
              <tbody>
                {phases
                  .sort((a, b) => a.phaseNumber - b.phaseNumber)
                  .map((phase, idx) => {
                    const phaseInfo = PHASES[phase.phaseNumber - 1];
                    const effectiveStart = phase.startMonth + phase.delayMonths;
                    const effectiveEnd = effectiveStart + phase.durationMonths;

                    return (
                      <tr
                        key={phase.phaseNumber}
                        className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors"
                      >
                        {/* Phase Name */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: phaseInfo?.color }}
                            />
                            <div>
                              <div className="font-semibold text-stone-800">{phaseInfo?.name}</div>
                              <div className="text-xs text-stone-400">{phaseInfo?.nameEn}</div>
                            </div>
                          </div>
                        </td>

                        {/* Start Month */}
                        <td className="py-4 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={phase.startMonth}
                            onChange={(e) =>
                              updatePhase(idx, "startMonth", parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-center py-2 px-2 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
                          />
                        </td>

                        {/* Duration */}
                        <td className="py-4 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={phase.durationMonths}
                            onChange={(e) =>
                              updatePhase(idx, "durationMonths", parseInt(e.target.value) || 1)
                            }
                            className="w-20 text-center py-2 px-2 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
                          />
                        </td>

                        {/* Cost */}
                        <td className="py-4 px-3 text-center">
                          <input
                            type="text"
                            value={
                              parseFloat(phase.estimatedCost) > 0
                                ? new Intl.NumberFormat("en-AE").format(parseFloat(phase.estimatedCost))
                                : ""
                            }
                            placeholder="أدخل التكلفة"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, "");
                              updatePhase(idx, "estimatedCost", raw || "0");
                            }}
                            className="w-36 text-center py-2 px-2 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm placeholder:text-stone-300"
                          />
                        </td>

                        {/* Delay/Speed Controls */}
                        <td className="py-4 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDelay(idx, -1)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold transition-colors"
                              title="تسريع شهر واحد"
                            >
                              → تسريع
                            </button>
                            <span
                              className={`w-12 text-center text-sm font-bold ${
                                phase.delayMonths > 0
                                  ? "text-red-600"
                                  : phase.delayMonths < 0
                                  ? "text-emerald-600"
                                  : "text-stone-400"
                              }`}
                            >
                              {phase.delayMonths > 0 ? `+${phase.delayMonths}` : phase.delayMonths === 0 ? "0" : phase.delayMonths}
                            </span>
                            <button
                              onClick={() => handleDelay(idx, 1)}
                              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold transition-colors"
                              title="تأخير شهر واحد"
                            >
                              تأخير ←
                            </button>
                          </div>
                        </td>

                        {/* Actual Period */}
                        <td className="py-4 px-3 text-center">
                          <div className="text-xs text-stone-600 font-medium">
                            {getMonthLabel(startDate, effectiveStart)}
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5">↓</div>
                          <div className="text-xs text-stone-600 font-medium">
                            {getMonthLabel(startDate, effectiveEnd - 1)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 bg-stone-50">
                  <td className="py-3 px-3 font-bold text-stone-800">الإجمالي</td>
                  <td className="py-3 px-3 text-center text-stone-500">—</td>
                  <td className="py-3 px-3 text-center font-bold text-stone-800">{totalMonths} شهر</td>
                  <td className="py-3 px-3 text-center font-bold text-stone-800">
                    {totalCost > 0 ? formatAED(totalCost) : "—"}
                  </td>
                  <td className="py-3 px-3 text-center text-stone-500">—</td>
                  <td className="py-3 px-3 text-center text-xs text-stone-500">
                    {getMonthLabel(startDate, 0)} → {getMonthLabel(startDate, totalMonths - 1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Timeline Visual - Simple horizontal bars */}
          <div className="p-4 bg-stone-50 rounded-xl">
            <h4 className="text-sm font-bold text-stone-700 mb-3">الجدول الزمني</h4>
            <div className="space-y-2">
              {phases
                .sort((a, b) => a.phaseNumber - b.phaseNumber)
                .map((phase) => {
                  const phaseInfo = PHASES[phase.phaseNumber - 1];
                  const effectiveStart = phase.startMonth + phase.delayMonths;
                  const maxEnd = totalMonths || 33;
                  const leftPct = (effectiveStart / maxEnd) * 100;
                  const widthPct = (phase.durationMonths / maxEnd) * 100;

                  return (
                    <div key={phase.phaseNumber} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-stone-600 font-medium text-right shrink-0 truncate">
                        {phaseInfo?.name}
                      </div>
                      <div className="flex-1 relative h-8 bg-white rounded-lg border border-stone-200">
                        <div
                          className="absolute top-1 bottom-1 rounded-md flex items-center justify-center transition-all"
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(widthPct, 3)}%`,
                            backgroundColor: phaseInfo?.color,
                          }}
                        >
                          <span className="text-[10px] font-bold text-white truncate px-1">
                            {phase.durationMonths} شهر
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {/* Month markers */}
            <div className="flex items-center gap-3 mt-2">
              <div className="w-32 shrink-0" />
              <div className="flex-1 flex justify-between text-[10px] text-stone-400 px-1">
                <span>{getMonthShort(startDate, 0)}</span>
                <span>{getMonthShort(startDate, Math.floor(totalMonths / 4))}</span>
                <span>{getMonthShort(startDate, Math.floor(totalMonths / 2))}</span>
                <span>{getMonthShort(startDate, Math.floor((totalMonths * 3) / 4))}</span>
                <span>{getMonthShort(startDate, totalMonths)}</span>
              </div>
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          {hasChanges && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                إلغاء التغييرات
              </Button>
              <Button
                onClick={() => onSave(project.id, phases, startDate)}
                disabled={isSaving}
                className="gap-2 text-sm bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950 text-white"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          )}

          {!hasChanges && project.settings === null && (
            <div className="flex items-center justify-end pt-2">
              <Button
                onClick={() => {
                  setHasChanges(true);
                  onSave(project.id, phases, startDate);
                }}
                disabled={isSaving}
                className="gap-2 text-sm bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              >
                <Check className="w-4 h-4" />
                {isSaving ? "جاري الإعداد..." : "إعداد المراحل الافتراضية"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Portfolio Summary Chart - Monthly cashflow across all projects
// ═══════════════════════════════════════════════
function PortfolioChart({ projects }: { projects: ProjectData[] }) {
  const configuredProjects = projects.filter((p) => p.settings && p.phases.length > 0);

  const chartData = useMemo(() => {
    if (configuredProjects.length === 0) return [];

    let maxMonth = 0;
    configuredProjects.forEach((p) => {
      p.phases.forEach((ph) => {
        const end = ph.startMonth + ph.delayMonths + ph.durationMonths;
        if (end > maxMonth) maxMonth = end;
      });
    });
    maxMonth = Math.max(maxMonth, 12);

    const startDate = configuredProjects[0]?.settings?.startDate || "2025-01";
    const data: any[] = [];

    for (let m = 0; m < maxMonth; m++) {
      const entry: any = {
        month: getMonthShort(startDate, m),
        total: 0,
      };

      configuredProjects.forEach((project) => {
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
        entry[project.name] = Math.round(projectMonthly);
        entry.total += Math.round(projectMonthly);
      });

      data.push(entry);
    }

    return data;
  }, [configuredProjects]);

  const projectColors = ["#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#ef4444"];

  if (configuredProjects.length === 0 || chartData.every((d) => d.total === 0)) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-8 text-center">
        <BarChart3 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-stone-600 mb-2">التدفق النقدي الشهري</h3>
        <p className="text-sm text-stone-400">
          أدخل تكاليف المراحل في المشاريع أعلاه لعرض الرسم البياني للتدفق النقدي
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-800">التدفق النقدي الشهري — جميع المشاريع</h2>
          <p className="text-xs text-stone-500">
            المبالغ المطلوبة كل شهر موزعة حسب المشروع (بالدرهم الإماراتي)
          </p>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#78716c" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#78716c" }}
              tickFormatter={(v: number) => formatAEDShort(v)}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatAED(value), name]}
              labelStyle={{ fontWeight: "bold" }}
              contentStyle={{ borderRadius: "12px", border: "1px solid #e7e5e4" }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {configuredProjects.map((project, i) => (
              <Bar
                key={project.id}
                dataKey={project.name}
                stackId="a"
                fill={projectColors[i % projectColors.length]}
                radius={i === configuredProjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Portfolio Summary Table
// ═══════════════════════════════════════════════
function PortfolioSummary({ projects }: { projects: ProjectData[] }) {
  const configuredProjects = projects.filter((p) => p.settings && p.phases.length > 0);
  if (configuredProjects.length === 0) return null;

  const grandTotal = configuredProjects.reduce((sum, p) => {
    return sum + p.phases.reduce((s, ph) => s + (parseFloat(ph.estimatedCost) || 0), 0);
  }, 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-800">ملخص المحفظة</h2>
          <p className="text-xs text-stone-500">مقارنة سريعة لجميع المشاريع</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b-2 border-stone-200">
              <th className="text-right py-3 px-3 font-bold text-stone-700">المشروع</th>
              <th className="text-center py-3 px-3 font-bold text-stone-700">تاريخ البداية</th>
              <th className="text-center py-3 px-3 font-bold text-stone-700">المدة الكلية</th>
              <th className="text-center py-3 px-3 font-bold text-stone-700">التكلفة الكلية</th>
              <th className="text-center py-3 px-3 font-bold text-stone-700">مراحل متأخرة</th>
              <th className="text-center py-3 px-3 font-bold text-stone-700">تاريخ الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {configuredProjects.map((project) => {
              const cost = project.phases.reduce(
                (s, ph) => s + (parseFloat(ph.estimatedCost) || 0),
                0
              );
              let maxEnd = 0;
              let delayed = 0;
              project.phases.forEach((ph) => {
                const end = ph.startMonth + ph.delayMonths + ph.durationMonths;
                if (end > maxEnd) maxEnd = end;
                if (ph.delayMonths > 0) delayed++;
              });

              return (
                <tr key={project.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="py-3 px-3 font-semibold text-stone-800">{project.name}</td>
                  <td className="py-3 px-3 text-center text-stone-600">
                    {getMonthLabel(project.settings!.startDate, 0)}
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-stone-700">{maxEnd} شهر</td>
                  <td className="py-3 px-3 text-center font-medium text-stone-700">
                    {cost > 0 ? formatAED(cost) : "—"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {delayed > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        {delayed}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                        <Check className="w-3 h-3" /> لا يوجد
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-stone-600">
                    {getMonthLabel(project.settings!.startDate, maxEnd - 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 bg-stone-50">
              <td className="py-3 px-3 font-bold text-stone-800">الإجمالي</td>
              <td className="py-3 px-3 text-center text-stone-500">—</td>
              <td className="py-3 px-3 text-center text-stone-500">—</td>
              <td className="py-3 px-3 text-center font-bold text-lg text-stone-800">
                {grandTotal > 0 ? formatAED(grandTotal) : "—"}
              </td>
              <td className="py-3 px-3 text-center text-stone-500">—</td>
              <td className="py-3 px-3 text-center text-stone-500">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════
export default function CapitalPlanningPage() {
  const { isAuthenticated } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  const handleSavePhases = useCallback(
    async (projectId: number, phases: PhaseData[], startDate: string) => {
      setIsSaving(true);

      // Check if project needs initialization
      const project = projects.find((p) => p.id === projectId);
      if (!project?.settings) {
        await initMutation.mutateAsync({ projectId, startDate });
      } else {
        await updateSettingsMutation.mutateAsync({ projectId, startDate });
      }

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
    [projects, initMutation, updateSettingsMutation, bulkUpdateMutation]
  );

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
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">لوحة التخطيط الرأسمالي</h1>
              <p className="text-amber-300 font-medium text-sm mb-1">Strategic Capital Planning Board</p>
              <p className="text-stone-400 text-sm">
                حدد مراحل وتكاليف كل مشروع، ثم شاهد الصورة الكاملة للتدفقات النقدية
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Step 1: Projects */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-bold">
              ١
            </div>
            <h2 className="text-xl font-bold text-stone-800">المشاريع — اضغط على أي مشروع لتعديل مراحله</h2>
          </div>

          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSave={handleSavePhases}
                isSaving={isSaving}
                isExpanded={expandedId === project.id}
                onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
              />
            ))}
          </div>

          {projects.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-12 text-center">
              <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">لا توجد مشاريع. أضف مشاريع من لوحة التحكم أولاً.</p>
            </div>
          )}
        </div>

        {/* Step 2: Portfolio Summary */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-bold">
              ٢
            </div>
            <h2 className="text-xl font-bold text-stone-800">الصورة الكاملة — جميع المشاريع معاً</h2>
          </div>

          <div className="space-y-6">
            <PortfolioSummary projects={projects} />
            <PortfolioChart projects={projects} />
          </div>
        </div>
      </div>
    </div>
  );
}
