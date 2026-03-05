import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  calculatePhases,
  getTotalMonths,
  buildQuarters,
  getInvestorExpenses,
  getEscrowExpenses,
  getDefaultRevenue,
  getDefaultCustomDistribution,
  distributeExpense,
  aggregateToQuarters,
  fmt,
  type PhaseDurations,
  type ExpenseItem,
  type QuarterDef,
  DEFAULT_DURATIONS,
  CONSTRUCTION_COST,
  SALES_VALUE,
} from "@/lib/cashFlowEngine";
import {
  ArrowRight,
  Building2,
  Plus,
  Minus,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  Layers,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Landmark,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ===== TYPES =====

interface ProjectConfig {
  projectId: number;
  name: string;
  enabled: boolean;
  startOffsetMonths: number; // shift from base start (0 = original, +3 = delayed 3 months)
  durations: PhaseDurations;
  color: string;
}

// ===== COLORS =====
const PROJECT_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", bar: "#3b82f6", light: "#dbeafe" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", bar: "#10b981", light: "#d1fae5" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800", bar: "#f59e0b", light: "#fef3c7" },
  { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800", bar: "#8b5cf6", light: "#ede9fe" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800", bar: "#f43f5e", light: "#ffe4e6" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800", bar: "#06b6d4", light: "#cffafe" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", bar: "#f97316", light: "#ffedd5" },
  { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-800", bar: "#6366f1", light: "#e0e7ff" },
  { bg: "bg-teal-100", border: "border-teal-300", text: "text-teal-800", bar: "#14b8a6", light: "#ccfbf1" },
];

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

// ===== BASE DATE =====
const BASE_START = new Date(2026, 3, 1); // April 2026

function getProjectStart(offsetMonths: number): Date {
  const d = new Date(BASE_START);
  d.setMonth(d.getMonth() + offsetMonths);
  return d;
}

function formatMonthYear(d: Date): string {
  return `${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

// ===== CALCULATE PROJECT CASH FLOW =====

interface ProjectCashFlowResult {
  investorTotal: number;
  escrowTotal: number;
  // Monthly data indexed by global month offset from BASE_START
  investorMonthly: { [globalMonth: number]: number };
  escrowExpenseMonthly: { [globalMonth: number]: number };
  escrowRevenueMonthly: { [globalMonth: number]: number };
  escrowBalanceMonthly: { [globalMonth: number]: number };
  totalMonths: number;
  startGlobalMonth: number;
  endGlobalMonth: number;
}

function calculateProjectCashFlow(config: ProjectConfig): ProjectCashFlowResult {
  const durations = config.durations;
  const phases = calculatePhases(durations);
  const totalMonths = getTotalMonths(durations);
  const projectStart = getProjectStart(config.startOffsetMonths);

  // Get expenses
  const investorExpenses = getInvestorExpenses();
  const escrowExpenses = getEscrowExpenses();
  const defaultRevenue = getDefaultRevenue(phases, durations);

  // Calculate investor monthly
  const investorMonthly: { [globalMonth: number]: number } = {};
  let investorTotal = 0;

  for (const item of investorExpenses) {
    let monthlyData: { [month: number]: number };
    if (item.behavior === "CUSTOM") {
      monthlyData = getDefaultCustomDistribution(item.id, phases, durations);
    } else {
      monthlyData = distributeExpense(item, phases, durations, defaultRevenue);
    }
    // Add land costs at month 0
    if (item.phase === "land" && item.behavior === "FIXED_ABSOLUTE") {
      const globalMonth = config.startOffsetMonths;
      investorMonthly[globalMonth] = (investorMonthly[globalMonth] || 0) + item.total;
      investorTotal += item.total;
    }
    for (const [mStr, val] of Object.entries(monthlyData)) {
      const localMonth = parseInt(mStr);
      const globalMonth = config.startOffsetMonths + localMonth;
      investorMonthly[globalMonth] = (investorMonthly[globalMonth] || 0) + val;
      investorTotal += val;
    }
  }

  // Calculate escrow monthly
  const escrowExpenseMonthly: { [globalMonth: number]: number } = {};
  const escrowRevenueMonthly: { [globalMonth: number]: number } = {};
  let escrowTotal = 0;

  for (const item of escrowExpenses) {
    let monthlyData: { [month: number]: number };
    if (item.behavior === "CUSTOM") {
      monthlyData = getDefaultCustomDistribution(item.id, phases, durations);
    } else {
      monthlyData = distributeExpense(item, phases, durations, defaultRevenue);
    }
    for (const [mStr, val] of Object.entries(monthlyData)) {
      const localMonth = parseInt(mStr);
      const globalMonth = config.startOffsetMonths + localMonth;
      escrowExpenseMonthly[globalMonth] = (escrowExpenseMonthly[globalMonth] || 0) + val;
      escrowTotal += val;
    }
  }

  // Revenue
  for (const [mStr, val] of Object.entries(defaultRevenue)) {
    const localMonth = parseInt(mStr);
    const globalMonth = config.startOffsetMonths + localMonth;
    escrowRevenueMonthly[globalMonth] = (escrowRevenueMonthly[globalMonth] || 0) + val;
  }

  // Escrow balance (opening = 20% of construction cost)
  const openingBalance = CONSTRUCTION_COST * 0.20;
  const escrowBalanceMonthly: { [globalMonth: number]: number } = {};
  const startGlobalMonth = config.startOffsetMonths;
  const endGlobalMonth = config.startOffsetMonths + totalMonths;

  // Opening balance at start of construction
  const conStartGlobal = config.startOffsetMonths + durations.preCon + 1;
  let balance = openingBalance;
  for (let gm = conStartGlobal; gm <= endGlobalMonth; gm++) {
    balance += (escrowRevenueMonthly[gm] || 0) - (escrowExpenseMonthly[gm] || 0);
    escrowBalanceMonthly[gm] = balance;
  }

  return {
    investorTotal,
    escrowTotal,
    investorMonthly,
    escrowExpenseMonthly,
    escrowRevenueMonthly,
    escrowBalanceMonthly,
    totalMonths,
    startGlobalMonth,
    endGlobalMonth,
  };
}

// ===== BUILD GLOBAL QUARTERS =====

function buildGlobalQuarters(
  minMonth: number,
  maxMonth: number,
): { label: string; months: number[] }[] {
  const quarters: { label: string; months: number[] }[] = [];
  for (let m = minMonth; m <= maxMonth; m += 3) {
    const d = new Date(BASE_START);
    d.setMonth(d.getMonth() + m);
    const qMonths: number[] = [];
    for (let i = 0; i < 3 && m + i <= maxMonth; i++) {
      qMonths.push(m + i);
    }
    quarters.push({
      label: formatMonthYear(d),
      months: qMonths,
    });
  }
  return quarters;
}

// ===== COMPONENT =====

export default function FinancialCommandCenter() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const projects = projectsQuery.data || [];

  // Project configurations
  const [projectConfigs, setProjectConfigs] = useState<ProjectConfig[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [viewMode, setViewMode] = useState<"investor" | "escrow" | "combined">("investor");

  // Initialize project configs when projects load
  const initializeProjects = useCallback(() => {
    if (projects.length > 0 && projectConfigs.length === 0) {
      const configs = projects.map((p: any, i: number) => ({
        projectId: p.id,
        name: p.name,
        enabled: true,
        startOffsetMonths: 0,
        durations: { ...DEFAULT_DURATIONS },
        color: PROJECT_COLORS[i % PROJECT_COLORS.length].bar,
      }));
      setProjectConfigs(configs);
    }
  }, [projects, projectConfigs.length]);

  // Auto-initialize
  if (projects.length > 0 && projectConfigs.length === 0) {
    initializeProjects();
  }

  // Calculate cash flows for all enabled projects
  const projectResults = useMemo(() => {
    return projectConfigs
      .filter(c => c.enabled)
      .map(config => ({
        config,
        result: calculateProjectCashFlow(config),
        colorSet: PROJECT_COLORS[projectConfigs.indexOf(config) % PROJECT_COLORS.length],
      }));
  }, [projectConfigs]);

  // Find global min/max months
  const { minMonth, maxMonth } = useMemo(() => {
    if (projectResults.length === 0) return { minMonth: 0, maxMonth: 24 };
    let min = Infinity, max = -Infinity;
    for (const pr of projectResults) {
      min = Math.min(min, pr.result.startGlobalMonth);
      max = Math.max(max, pr.result.endGlobalMonth);
    }
    return { minMonth: min, maxMonth: max };
  }, [projectResults]);

  // Build global quarters
  const globalQuarters = useMemo(() =>
    buildGlobalQuarters(minMonth, maxMonth),
    [minMonth, maxMonth]
  );

  // Aggregate data per quarter
  const aggregatedData = useMemo(() => {
    const investorPerQ: number[] = globalQuarters.map(() => 0);
    const escrowExpPerQ: number[] = globalQuarters.map(() => 0);
    const escrowRevPerQ: number[] = globalQuarters.map(() => 0);
    const perProjectInvestorPerQ: { [projectId: number]: number[] } = {};

    for (const pr of projectResults) {
      const pInvestor: number[] = globalQuarters.map(() => 0);
      for (let qi = 0; qi < globalQuarters.length; qi++) {
        const q = globalQuarters[qi];
        for (const m of q.months) {
          investorPerQ[qi] += pr.result.investorMonthly[m] || 0;
          escrowExpPerQ[qi] += pr.result.escrowExpenseMonthly[m] || 0;
          escrowRevPerQ[qi] += pr.result.escrowRevenueMonthly[m] || 0;
          pInvestor[qi] += pr.result.investorMonthly[m] || 0;
        }
      }
      perProjectInvestorPerQ[pr.config.projectId] = pInvestor;
    }

    // Cumulative investor
    const cumulativeInvestor: number[] = [];
    let cumInv = 0;
    for (const v of investorPerQ) {
      cumInv += v;
      cumulativeInvestor.push(cumInv);
    }

    // Net escrow per quarter
    const netEscrowPerQ = escrowRevPerQ.map((r, i) => r - escrowExpPerQ[i]);

    return {
      investorPerQ,
      escrowExpPerQ,
      escrowRevPerQ,
      netEscrowPerQ,
      cumulativeInvestor,
      perProjectInvestorPerQ,
    };
  }, [projectResults, globalQuarters]);

  // Summary stats
  const summary = useMemo(() => {
    const totalInvestor = projectResults.reduce((s, pr) => s + pr.result.investorTotal, 0);
    const totalEscrowExp = projectResults.reduce((s, pr) => s + pr.result.escrowTotal, 0);
    const peakQuarter = Math.max(...aggregatedData.investorPerQ);
    const peakQuarterIdx = aggregatedData.investorPerQ.indexOf(peakQuarter);
    const peakLabel = globalQuarters[peakQuarterIdx]?.label || "";

    // Find max 3-month requirement
    let max3Month = 0;
    let max3MonthLabel = "";
    for (let i = 0; i < aggregatedData.investorPerQ.length; i++) {
      if (aggregatedData.investorPerQ[i] > max3Month) {
        max3Month = aggregatedData.investorPerQ[i];
        max3MonthLabel = globalQuarters[i]?.label || "";
      }
    }

    return {
      totalInvestor,
      totalEscrowExp,
      peakQuarter: max3Month,
      peakLabel: max3MonthLabel,
      enabledCount: projectResults.length,
      totalCount: projectConfigs.length,
    };
  }, [projectResults, aggregatedData, globalQuarters, projectConfigs]);

  // Handlers
  const toggleProject = (projectId: number) => {
    setProjectConfigs(prev => prev.map(c =>
      c.projectId === projectId ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const shiftProject = (projectId: number, delta: number) => {
    setProjectConfigs(prev => prev.map(c =>
      c.projectId === projectId ? { ...c, startOffsetMonths: c.startOffsetMonths + delta } : c
    ));
  };

  const changeDuration = (projectId: number, phase: keyof PhaseDurations, delta: number) => {
    setProjectConfigs(prev => prev.map(c => {
      if (c.projectId !== projectId) return c;
      const newDurations = { ...c.durations };
      newDurations[phase] = Math.max(1, newDurations[phase] + delta);
      return { ...c, durations: newDurations };
    }));
  };

  const resetAll = () => {
    setProjectConfigs(prev => prev.map(c => ({
      ...c,
      enabled: true,
      startOffsetMonths: 0,
      durations: { ...DEFAULT_DURATIONS },
    })));
    toast.success("تم إعادة تعيين جميع المشاريع");
  };

  const hasChanges = projectConfigs.some(c =>
    c.startOffsetMonths !== 0 ||
    !c.enabled ||
    JSON.stringify(c.durations) !== JSON.stringify(DEFAULT_DURATIONS)
  );

  // Chart dimensions
  const chartHeight = 200;
  const barWidth = Math.max(20, Math.min(60, 800 / Math.max(globalQuarters.length, 1)));
  const chartWidth = globalQuarters.length * (barWidth + 4) + 60;
  const maxVal = Math.max(...aggregatedData.investorPerQ, 1);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[98%] mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/project-management")} className="gap-1.5">
            <ArrowRight className="w-4 h-4" />
            إدارة المشاريع
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-foreground">مركز القيادة المالي</h1>
          </div>
          <div className="mr-auto flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("investor")}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === "investor" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                💰 مصاريف المستثمر
              </button>
              <button
                onClick={() => setViewMode("escrow")}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === "escrow" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                🏦 الإسكرو
              </button>
              <button
                onClick={() => setViewMode("combined")}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === "combined" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                📊 مدمج
              </button>
            </div>
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={resetAll} className="gap-1 text-xs">
                <RotateCcw className="w-3 h-3" />
                إعادة تعيين
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[98%] mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-medium text-emerald-700">إجمالي مصاريف المستثمر</span>
            </div>
            <div className="text-lg font-bold text-emerald-900">{fmt(summary.totalInvestor)} <span className="text-xs font-normal">درهم</span></div>
            <div className="text-[10px] text-emerald-600 mt-1">{summary.enabledCount} من {summary.totalCount} مشاريع</div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-[10px] font-medium text-red-700">أعلى ربع سنوي</span>
            </div>
            <div className="text-lg font-bold text-red-900">{fmt(summary.peakQuarter)} <span className="text-xs font-normal">درهم</span></div>
            <div className="text-[10px] text-red-600 mt-1">{summary.peakLabel}</div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-indigo-600" />
              <span className="text-[10px] font-medium text-indigo-700">إجمالي مصاريف الإسكرو</span>
            </div>
            <div className="text-lg font-bold text-indigo-900">{fmt(summary.totalEscrowExp)} <span className="text-xs font-normal">درهم</span></div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-medium text-blue-700">المشاريع المفعّلة</span>
            </div>
            <div className="text-lg font-bold text-blue-900">{summary.enabledCount} / {summary.totalCount}</div>
            <div className="text-[10px] text-blue-600 mt-1">
              {hasChanges ? "تم تعديل التواريخ" : "الوضع الأصلي"}
            </div>
          </Card>
        </div>

        {/* Project Controls */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              التحكم بالمشاريع
            </h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? "إخفاء التفاصيل" : "عرض التفاصيل"}
            </button>
          </div>

          <div className="space-y-2">
            {projectConfigs.map((config, idx) => {
              const colorSet = PROJECT_COLORS[idx % PROJECT_COLORS.length];
              const projectStart = getProjectStart(config.startOffsetMonths);
              const totalDuration = getTotalMonths(config.durations);

              return (
                <div
                  key={config.projectId}
                  className={`rounded-xl border-2 transition-all ${
                    config.enabled
                      ? `${colorSet.bg} ${colorSet.border}`
                      : "bg-gray-50 border-gray-200 opacity-60"
                  }`}
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleProject(config.projectId)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        config.enabled
                          ? `bg-white shadow-sm ${colorSet.text}`
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {config.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colorSet.bar }}
                    />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${config.enabled ? colorSet.text : "text-gray-400"}`}>
                        {config.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatMonthYear(projectStart)} — {totalDuration} شهر
                        {config.startOffsetMonths !== 0 && (
                          <span className={config.startOffsetMonths > 0 ? "text-amber-600 mr-1" : "text-blue-600 mr-1"}>
                            ({config.startOffsetMonths > 0 ? "+" : ""}{config.startOffsetMonths} شهر)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shift Controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground ml-1">تحريك:</span>
                      <button
                        onClick={() => shiftProject(config.projectId, -3)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-xs hover:bg-gray-50"
                        title="تبكير 3 أشهر"
                      >
                        ◄◄
                      </button>
                      <button
                        onClick={() => shiftProject(config.projectId, -1)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-xs hover:bg-gray-50"
                        title="تبكير شهر"
                      >
                        ◄
                      </button>
                      <span className={`w-8 text-center text-[10px] font-mono font-bold ${
                        config.startOffsetMonths === 0 ? "text-gray-400" :
                        config.startOffsetMonths > 0 ? "text-amber-600" : "text-blue-600"
                      }`}>
                        {config.startOffsetMonths === 0 ? "0" : (config.startOffsetMonths > 0 ? `+${config.startOffsetMonths}` : config.startOffsetMonths)}
                      </span>
                      <button
                        onClick={() => shiftProject(config.projectId, 1)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-xs hover:bg-gray-50"
                        title="تأخير شهر"
                      >
                        ►
                      </button>
                      <button
                        onClick={() => shiftProject(config.projectId, 3)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-xs hover:bg-gray-50"
                        title="تأخير 3 أشهر"
                      >
                        ►►
                      </button>
                    </div>

                    {/* Total */}
                    <div className="text-left min-w-[100px]">
                      <div className={`text-xs font-bold ${config.enabled ? colorSet.text : "text-gray-400"}`}>
                        {fmt(projectResults.find(pr => pr.config.projectId === config.projectId)?.result.investorTotal || 0)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">درهم</div>
                    </div>
                  </div>

                  {/* Duration Details (expandable) */}
                  {showDetails && config.enabled && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="flex items-center gap-4 bg-white/60 rounded-lg p-2">
                        {(["preCon", "construction", "handover"] as const).map(phase => {
                          const labels = { preCon: "ما قبل البناء", construction: "البناء", handover: "التسليم" };
                          return (
                            <div key={phase} className="flex items-center gap-1.5">
                              <span className="text-[9px] text-muted-foreground">{labels[phase]}:</span>
                              <button
                                onClick={() => changeDuration(config.projectId, phase, -1)}
                                className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[10px] hover:bg-gray-200"
                              >
                                −
                              </button>
                              <span className="text-[10px] font-bold w-5 text-center">
                                {config.durations[phase]}
                              </span>
                              <button
                                onClick={() => changeDuration(config.projectId, phase, 1)}
                                className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[10px] hover:bg-gray-200"
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Stacked Bar Chart */}
        {projectResults.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {viewMode === "investor" ? "مصاريف المستثمر — كل المشاريع" :
               viewMode === "escrow" ? "صافي الإسكرو — كل المشاريع" :
               "الرؤية المدمجة — مصاريف المستثمر + الإسكرو"}
            </h3>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {projectResults.map(pr => (
                <div key={pr.config.projectId} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: pr.colorSet.bar }} />
                  <span className="text-[10px] text-muted-foreground">{pr.config.name}</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="overflow-x-auto">
              <svg width={chartWidth} height={chartHeight + 60} className="min-w-full">
                {/* Y-axis labels */}
                <text x="0" y="15" className="text-[8px] fill-gray-400">{fmt(maxVal)}</text>
                <text x="0" y={chartHeight / 2 + 5} className="text-[8px] fill-gray-400">{fmt(maxVal / 2)}</text>
                <text x="0" y={chartHeight} className="text-[8px] fill-gray-400">0</text>

                {/* Grid lines */}
                <line x1="50" y1="10" x2={chartWidth} y2="10" stroke="#e5e7eb" strokeWidth="0.5" />
                <line x1="50" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4" />
                <line x1="50" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#e5e7eb" strokeWidth="0.5" />

                {/* Bars */}
                {globalQuarters.map((q, qi) => {
                  const x = 55 + qi * (barWidth + 4);
                  let yOffset = 0;

                  return (
                    <g key={qi}>
                      {projectResults.map(pr => {
                        const val = (aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [])[qi] || 0;
                        const barH = (val / maxVal) * (chartHeight - 20);
                        const y = chartHeight - barH - yOffset;
                        yOffset += barH;

                        return (
                          <rect
                            key={pr.config.projectId}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(0, barH)}
                            fill={pr.colorSet.bar}
                            rx="2"
                            opacity="0.85"
                          >
                            <title>{pr.config.name}: {fmt(val)} درهم</title>
                          </rect>
                        );
                      })}

                      {/* X-axis label */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 15}
                        textAnchor="middle"
                        className="text-[7px] fill-gray-500"
                        transform={`rotate(-45, ${x + barWidth / 2}, ${chartHeight + 15})`}
                      >
                        {q.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>
        )}

        {/* Combined Table */}
        {projectResults.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              جدول التدفقات المجمّع — مصاريف المستثمر
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="sticky right-0 bg-gray-800 z-10 px-3 py-2 text-right min-w-[160px]">البند</th>
                    <th className="px-2 py-2 text-center bg-gray-700 min-w-[90px]">الإجمالي</th>
                    {globalQuarters.map((q, qi) => (
                      <th key={qi} className="px-2 py-2 text-center min-w-[80px] whitespace-nowrap">
                        {q.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Per-project rows */}
                  {projectResults.map((pr, prIdx) => {
                    const perQ = aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [];
                    const total = perQ.reduce((s, v) => s + v, 0);

                    return (
                      <tr key={pr.config.projectId} className={prIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="sticky right-0 z-10 px-3 py-2 font-bold border-b border-gray-100" style={{ backgroundColor: pr.colorSet.light }}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pr.colorSet.bar }} />
                            <span className={pr.colorSet.text}>{pr.config.name}</span>
                          </div>
                          {pr.config.startOffsetMonths !== 0 && (
                            <div className="text-[8px] text-amber-600 mt-0.5">
                              تحريك: {pr.config.startOffsetMonths > 0 ? "+" : ""}{pr.config.startOffsetMonths} شهر
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center font-bold border-b border-gray-100" style={{ backgroundColor: pr.colorSet.light }}>
                          {fmt(total)}
                        </td>
                        {globalQuarters.map((_, qi) => (
                          <td key={qi} className="px-2 py-2 text-center border-b border-gray-100">
                            {perQ[qi] > 0 ? fmt(perQ[qi]) : <span className="text-gray-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className="bg-gray-900 text-white font-bold">
                    <td className="sticky right-0 bg-gray-900 z-10 px-3 py-2.5">
                      إجمالي مصاريف المستثمر
                    </td>
                    <td className="px-2 py-2.5 text-center bg-gray-800">
                      {fmt(aggregatedData.investorPerQ.reduce((s, v) => s + v, 0))}
                    </td>
                    {aggregatedData.investorPerQ.map((val, qi) => (
                      <td key={qi} className="px-2 py-2.5 text-center">
                        {val > 0 ? fmt(val) : <span className="text-gray-500">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Cumulative row */}
                  <tr className="bg-red-50 text-red-900 font-bold">
                    <td className="sticky right-0 bg-red-50 z-10 px-3 py-2">
                      التراكمي
                    </td>
                    <td className="px-2 py-2 text-center bg-red-100">
                      {fmt(aggregatedData.cumulativeInvestor[aggregatedData.cumulativeInvestor.length - 1] || 0)}
                    </td>
                    {aggregatedData.cumulativeInvestor.map((val, qi) => (
                      <td key={qi} className="px-2 py-2 text-center">
                        {val > 0 ? fmt(val) : <span className="text-red-300">-</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 3-Month Requirement Card */}
        {projectResults.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-red-50 to-amber-50 border-red-200">
            <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              المطلوب لأقرب 3 أشهر
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {globalQuarters.slice(0, 3).map((q, qi) => (
                <div key={qi} className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="text-[10px] text-muted-foreground mb-1">{q.label}</div>
                  <div className="text-lg font-bold text-red-800">{fmt(aggregatedData.investorPerQ[qi])} <span className="text-xs font-normal">درهم</span></div>
                  <div className="mt-2 space-y-1">
                    {projectResults.map(pr => {
                      const val = (aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [])[qi] || 0;
                      if (val <= 0) return null;
                      return (
                        <div key={pr.config.projectId} className="flex items-center justify-between text-[9px]">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.colorSet.bar }} />
                            <span className="text-muted-foreground truncate max-w-[120px]">{pr.config.name}</span>
                          </div>
                          <span className="font-medium">{fmt(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty state */}
        {projectConfigs.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">لا توجد مشاريع</h3>
            <p className="text-sm text-muted-foreground">أضف مشاريع في إدارة المشاريع أولاً</p>
          </Card>
        )}
      </main>
    </div>
  );
}
