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
  isMonthPaid,
  getMonthDate,
  type PhaseDurations,
  type ExpenseItem,
  type QuarterDef,
  type ProjectCosts,
  DEFAULT_DURATIONS,
  CONSTRUCTION_COST,
} from "@/lib/cashFlowEngine";
import { calculateProjectCosts as calcCosts } from "@/lib/projectCostsCalc";
import {
  ArrowRight,
  Building2,
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
  Wallet,
  ArrowDownCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PieChart,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ===== TYPES =====

interface ProjectConfig {
  projectId: number;
  name: string;
  enabled: boolean;
  startOffsetMonths: number;
  durations: PhaseDurations;
  color: string;
}

// ===== PREMIUM COLORS =====
const PROJECT_COLORS = [
  { bg: "#EFF6FF", border: "#93C5FD", text: "#1E40AF", bar: "#3B82F6", light: "#DBEAFE", accent: "#2563EB" },
  { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46", bar: "#10B981", light: "#D1FAE5", accent: "#059669" },
  { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E", bar: "#F59E0B", light: "#FEF3C7", accent: "#D97706" },
  { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6", bar: "#8B5CF6", light: "#EDE9FE", accent: "#7C3AED" },
  { bg: "#FFF1F2", border: "#FDA4AF", text: "#9F1239", bar: "#F43F5E", light: "#FFE4E6", accent: "#E11D48" },
  { bg: "#ECFEFF", border: "#67E8F9", text: "#155E75", bar: "#06B6D4", light: "#CFFAFE", accent: "#0891B2" },
  { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412", bar: "#F97316", light: "#FFEDD5", accent: "#EA580C" },
  { bg: "#EEF2FF", border: "#A5B4FC", text: "#3730A3", bar: "#6366F1", light: "#E0E7FF", accent: "#4F46E5" },
  { bg: "#F0FDFA", border: "#5EEAD4", text: "#134E4A", bar: "#14B8A6", light: "#CCFBF1", accent: "#0D9488" },
];

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

// ===== BASE DATE =====
const BASE_START = new Date(2026, 3, 1); // April 2026
const TODAY = new Date();

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
  investorPaid: number;
  investorRemaining: number;
  investorNext3Months: number;
  escrowTotal: number;
  investorMonthly: { [globalMonth: number]: number };
  escrowExpenseMonthly: { [globalMonth: number]: number };
  escrowRevenueMonthly: { [globalMonth: number]: number };
  escrowBalanceMonthly: { [globalMonth: number]: number };
  totalMonths: number;
  startGlobalMonth: number;
  endGlobalMonth: number;
}

function calculateProjectCashFlow(config: ProjectConfig, costs?: ProjectCosts): ProjectCashFlowResult {
  const durations = config.durations;
  const phases = calculatePhases(durations);
  const totalMonths = getTotalMonths(durations);
  const projectStart = getProjectStart(config.startOffsetMonths);

  const investorExpenses = getInvestorExpenses(costs);
  const escrowExpenses = getEscrowExpenses(costs);
  const defaultRevenue = getDefaultRevenue(phases, durations, costs?.totalRevenue);

  const investorMonthlyLocal: { [month: number]: number } = {};
  const investorMonthly: { [globalMonth: number]: number } = {};
  let investorTotal = 0;
  let landTotal = 0;

  for (const item of investorExpenses) {
    let monthlyData: { [month: number]: number };
    if (item.behavior === "CUSTOM") {
      monthlyData = getDefaultCustomDistribution(item.id, phases, durations, costs);
    } else {
      monthlyData = distributeExpense(item, phases, durations, defaultRevenue);
    }
    if (item.phase === "land" && item.behavior === "FIXED_ABSOLUTE") {
      const globalMonth = config.startOffsetMonths;
      investorMonthly[globalMonth] = (investorMonthly[globalMonth] || 0) + item.total;
      investorTotal += item.total;
      landTotal += item.total;
    }
    for (const [mStr, val] of Object.entries(monthlyData)) {
      const localMonth = parseInt(mStr);
      const globalMonth = config.startOffsetMonths + localMonth;
      investorMonthlyLocal[localMonth] = (investorMonthlyLocal[localMonth] || 0) + val;
      investorMonthly[globalMonth] = (investorMonthly[globalMonth] || 0) + val;
      investorTotal += val;
    }
  }

  let investorPaid = landTotal;
  const now = new Date();
  let investorNext3Months = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const monthVal = investorMonthlyLocal[m] || 0;
    if (monthVal <= 0) continue;
    if (isMonthPaid(m, projectStart)) {
      investorPaid += monthVal;
    }
    const d = getMonthDate(m, projectStart);
    if (d >= now) {
      const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
      if (diffMonths >= 0 && diffMonths < 3) {
        investorNext3Months += monthVal;
      }
    }
  }
  const investorRemaining = investorTotal - investorPaid;

  const escrowExpenseMonthly: { [globalMonth: number]: number } = {};
  const escrowRevenueMonthly: { [globalMonth: number]: number } = {};
  let escrowTotal = 0;

  for (const item of escrowExpenses) {
    let monthlyData: { [month: number]: number };
    if (item.behavior === "CUSTOM") {
      monthlyData = getDefaultCustomDistribution(item.id, phases, durations, costs);
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

  for (const [mStr, val] of Object.entries(defaultRevenue)) {
    const localMonth = parseInt(mStr);
    const globalMonth = config.startOffsetMonths + localMonth;
    escrowRevenueMonthly[globalMonth] = (escrowRevenueMonthly[globalMonth] || 0) + val;
  }

  const constructionCostVal = costs ? costs.constructionCost : CONSTRUCTION_COST;
  const openingBalance = constructionCostVal * 0.20;
  const escrowBalanceMonthly: { [globalMonth: number]: number } = {};
  const startGlobalMonth = config.startOffsetMonths;
  const endGlobalMonth = config.startOffsetMonths + totalMonths;

  const conStartGlobal = config.startOffsetMonths + durations.preCon + 1;
  let balance = openingBalance;
  for (let gm = conStartGlobal; gm <= endGlobalMonth; gm++) {
    balance += (escrowRevenueMonthly[gm] || 0) - (escrowExpenseMonthly[gm] || 0);
    escrowBalanceMonthly[gm] = balance;
  }

  return {
    investorTotal, investorPaid, investorRemaining, investorNext3Months,
    escrowTotal, investorMonthly, escrowExpenseMonthly, escrowRevenueMonthly,
    escrowBalanceMonthly, totalMonths, startGlobalMonth, endGlobalMonth,
  };
}

// ===== BUILD GLOBAL QUARTERS =====

function buildGlobalQuarters(minMonth: number, maxMonth: number): { label: string; months: number[] }[] {
  const quarters: { label: string; months: number[] }[] = [];
  for (let m = minMonth; m <= maxMonth; m += 3) {
    const d = new Date(BASE_START);
    d.setMonth(d.getMonth() + m);
    const qMonths: number[] = [];
    for (let i = 0; i < 3 && m + i <= maxMonth; i++) qMonths.push(m + i);
    quarters.push({ label: formatMonthYear(d), months: qMonths });
  }
  return quarters;
}

// ===== ANIMATED NUMBER =====
function AnimNum({ value, className = "" }: { value: string; className?: string }) {
  return <span className={`tabular-nums transition-all duration-500 ${className}`}>{value}</span>;
}

// ===== COMPONENT =====

export default function FinancialCommandCenter({ embedded }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const projects = projectsQuery.data || [];

  const allMoQuery = trpc.marketOverview.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10000 });
  const allCpQuery = trpc.competitionPricing.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10000 });

  const projectCostsMap = useMemo<Record<number, ProjectCosts>>(() => {
    const map: Record<number, ProjectCosts> = {};
    const moList = allMoQuery.data || [];
    const cpList = allCpQuery.data || [];
    for (const p of projects) {
      const mo = moList.find((m: any) => m.projectId === p.id) || null;
      const cp = cpList.find((c: any) => c.projectId === p.id) || null;
      const costs = calcCosts(p, mo, cp);
      if (costs) map[p.id] = costs;
    }
    return map;
  }, [projects, allMoQuery.data, allCpQuery.data]);

  const [projectConfigs, setProjectConfigs] = useState<ProjectConfig[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [viewMode, setViewMode] = useState<"investor" | "escrow" | "combined">("investor");

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

  if (projects.length > 0 && projectConfigs.length === 0) {
    initializeProjects();
  }

  // Calculate cash flows for ALL projects (for reference), but filter enabled for display
  const allProjectResults = useMemo(() => {
    return projectConfigs.map((config, idx) => ({
      config,
      result: calculateProjectCashFlow(config, projectCostsMap[config.projectId]),
      colorSet: PROJECT_COLORS[idx % PROJECT_COLORS.length],
    }));
  }, [projectConfigs, projectCostsMap]);

  // Only enabled projects for summaries
  const projectResults = useMemo(() => {
    return allProjectResults.filter(pr => pr.config.enabled);
  }, [allProjectResults]);

  const { minMonth, maxMonth } = useMemo(() => {
    if (projectResults.length === 0) return { minMonth: 0, maxMonth: 24 };
    let min = Infinity, max = -Infinity;
    for (const pr of projectResults) {
      min = Math.min(min, pr.result.startGlobalMonth);
      max = Math.max(max, pr.result.endGlobalMonth);
    }
    return { minMonth: min, maxMonth: max };
  }, [projectResults]);

  const globalQuarters = useMemo(() => buildGlobalQuarters(minMonth, maxMonth), [minMonth, maxMonth]);

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

    const cumulativeInvestor: number[] = [];
    let cumInv = 0;
    for (const v of investorPerQ) { cumInv += v; cumulativeInvestor.push(cumInv); }

    const netEscrowPerQ = escrowRevPerQ.map((r, i) => r - escrowExpPerQ[i]);

    return { investorPerQ, escrowExpPerQ, escrowRevPerQ, netEscrowPerQ, cumulativeInvestor, perProjectInvestorPerQ };
  }, [projectResults, globalQuarters]);

  // Summary stats — REACTIVE to enabled projects only
  const summary = useMemo(() => {
    const totalInvestor = projectResults.reduce((s, pr) => s + pr.result.investorTotal, 0);
    const totalPaid = projectResults.reduce((s, pr) => s + pr.result.investorPaid, 0);
    const totalRemaining = projectResults.reduce((s, pr) => s + pr.result.investorRemaining, 0);
    const totalNext3Months = projectResults.reduce((s, pr) => s + pr.result.investorNext3Months, 0);
    const totalEscrowExp = projectResults.reduce((s, pr) => s + pr.result.escrowTotal, 0);
    const totalRevenue = projectResults.reduce((s, pr) => s + (projectCostsMap[pr.config.projectId]?.totalRevenue || 0), 0);
    const peakQuarter = Math.max(...(aggregatedData.investorPerQ.length > 0 ? aggregatedData.investorPerQ : [0]));
    const peakQuarterIdx = aggregatedData.investorPerQ.indexOf(peakQuarter);
    const peakLabel = globalQuarters[peakQuarterIdx]?.label || "";

    return {
      totalInvestor, totalPaid, totalRemaining, totalNext3Months,
      totalEscrowExp, totalRevenue, peakQuarter, peakLabel,
      enabledCount: projectResults.length,
      totalCount: projectConfigs.length,
      paidPct: totalInvestor > 0 ? Math.round((totalPaid / totalInvestor) * 100) : 0,
    };
  }, [projectResults, aggregatedData, globalQuarters, projectConfigs, projectCostsMap]);

  const next3Label = useMemo(() => {
    const s = new Date(TODAY);
    const e = new Date(TODAY);
    e.setMonth(e.getMonth() + 2);
    return `${MONTHS_AR[s.getMonth()]} - ${MONTHS_AR[e.getMonth()]} ${e.getFullYear()}`;
  }, []);

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
      ...c, enabled: true, startOffsetMonths: 0, durations: { ...DEFAULT_DURATIONS },
    })));
    toast.success("تم إعادة تعيين جميع المشاريع");
  };

  const enableAll = () => {
    setProjectConfigs(prev => prev.map(c => ({ ...c, enabled: true })));
  };

  const disableAll = () => {
    setProjectConfigs(prev => prev.map(c => ({ ...c, enabled: false })));
  };

  const hasChanges = projectConfigs.some(c =>
    c.startOffsetMonths !== 0 || !c.enabled ||
    JSON.stringify(c.durations) !== JSON.stringify(DEFAULT_DURATIONS)
  );

  // Chart dimensions
  const chartHeight = 220;
  const barWidth = Math.max(24, Math.min(60, 800 / Math.max(globalQuarters.length, 1)));
  const maxVal = Math.max(...(aggregatedData.investorPerQ.length > 0 ? aggregatedData.investorPerQ : [1]), 1);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20`} dir="rtl">
      {/* ===== HEADER (hidden when embedded) ===== */}
      {!embedded && (
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-[98%] mx-auto px-6 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/project-management")} className="gap-2 text-slate-600 hover:text-slate-900">
            <ArrowRight className="w-4 h-4" />
            <span className="text-sm">إدارة المشاريع</span>
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">مركز القيادة المالي</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">Financial Command Center</p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shadow-inner">
              {[
                { key: "investor" as const, label: "مصاريف المستثمر", icon: Wallet, color: "from-emerald-500 to-emerald-700" },
                { key: "escrow" as const, label: "الإسكرو", icon: Landmark, color: "from-indigo-500 to-indigo-700" },
                { key: "combined" as const, label: "مدمج", icon: PieChart, color: "from-purple-500 to-purple-700" },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg transition-all duration-300 flex items-center gap-1.5 font-medium ${
                    viewMode === v.key
                      ? `bg-gradient-to-r ${v.color} text-white shadow-md`
                      : "text-slate-500 hover:text-slate-700 hover:bg-white"
                  }`}
                >
                  <v.icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              ))}
            </div>
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={resetAll} className="gap-1.5 text-xs border-slate-300 hover:border-red-300 hover:text-red-600">
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة تعيين
              </Button>
            )}
          </div>
        </div>
      </header>
      )}

      <main className="max-w-[98%] mx-auto px-6 py-8 space-y-8">

        {/* ===== EXECUTIVE SUMMARY HERO ===== */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-8 shadow-xl border border-slate-200/80">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full -translate-y-48 translate-x-48" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-100/30 to-transparent rounded-full translate-y-32 -translate-x-32" />
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-radial from-amber-50/20 to-transparent rounded-full -translate-x-1/2 -translate-y-1/2" />

          <div className="relative z-10">
            {/* Title row */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                  <Wallet className="w-5.5 h-5.5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">ملخص رأس المال</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {summary.enabledCount === summary.totalCount
                      ? `جميع المشاريع (${summary.totalCount})`
                      : `${summary.enabledCount} من ${summary.totalCount} مشاريع مفعّلة`
                    }
                  </p>
                </div>
              </div>
              {summary.enabledCount < summary.totalCount && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 shadow-sm">
                  <Filter className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-amber-700 font-medium">
                    تم تصفية {summary.totalCount - summary.enabledCount} مشاريع
                  </span>
                </div>
              )}
            </div>

            {/* Main 4 KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Total Required */}
              <div className="group relative bg-white hover:bg-blue-50/30 rounded-2xl p-5 border border-blue-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
                      <DollarSign className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-[11px] text-slate-600 font-semibold">إجمالي رأس المال المطلوب</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    <AnimNum value={fmt(summary.totalInvestor)} />
                  </div>
                  <div className="text-[10px] text-slate-500">درهم إماراتي</div>
                </div>
              </div>

              {/* Paid */}
              <div className="group relative bg-white hover:bg-emerald-50/30 rounded-2xl p-5 border border-emerald-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-[11px] text-emerald-700 font-semibold">تم دفعه</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mb-1">
                    <AnimNum value={fmt(summary.totalPaid)} />
                  </div>
                  <div className="text-[10px] text-emerald-600/70">{summary.paidPct}% من الإجمالي</div>
                </div>
              </div>

              {/* Remaining */}
              <div className="group relative bg-white hover:bg-amber-50/30 rounded-2xl p-5 border border-amber-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
                      <ArrowDownCircle className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-[11px] text-amber-700 font-semibold">المتبقي المطلوب تأمينه</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mb-1">
                    <AnimNum value={fmt(summary.totalRemaining)} />
                  </div>
                  <div className="text-[10px] text-amber-600/70">
                    {summary.totalInvestor > 0 ? `${100 - summary.paidPct}%` : "0%"} من الإجمالي
                  </div>
                </div>
              </div>

              {/* Next 3 months */}
              <div className="group relative bg-white hover:bg-red-50/30 rounded-2xl p-5 border border-red-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-red-200">
                      <Clock className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-[11px] text-red-700 font-semibold">المطلوب خلال 3 أشهر</span>
                  </div>
                  <div className="text-2xl font-bold text-red-700 mb-1">
                    <AnimNum value={fmt(summary.totalNext3Months)} />
                  </div>
                  <div className="text-[10px] text-red-600/70">{next3Label}</div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-gradient-to-l from-slate-50 to-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">تقدم الدفع الإجمالي</span>
                <span className="text-sm font-bold text-slate-900">{summary.paidPct}%</span>
              </div>
              <div className="h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-l from-emerald-400 via-emerald-500 to-teal-600 rounded-full transition-all duration-700 ease-out relative"
                  style={{ width: `${Math.min(100, summary.paidPct)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 text-[11px]">
                <span className="text-emerald-700 font-medium">المدفوع: {fmt(summary.totalPaid)} درهم</span>
                <span className="text-amber-700 font-medium">المتبقي: {fmt(summary.totalRemaining)} درهم</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECONDARY KPI ROW ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">أعلى ربع سنوي</span>
            </div>
            <div className="text-xl font-bold text-slate-900"><AnimNum value={fmt(summary.peakQuarter)} /></div>
            <div className="text-[10px] text-red-600 mt-1 font-medium">{summary.peakLabel}</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                <Landmark className="w-4.5 h-4.5 text-indigo-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">إجمالي مصاريف الإسكرو</span>
            </div>
            <div className="text-xl font-bold text-slate-900"><AnimNum value={fmt(summary.totalEscrowExp)} /></div>
            <div className="text-[10px] text-slate-500 mt-1">درهم إماراتي</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <Layers className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">المشاريع المفعّلة</span>
            </div>
            <div className="text-xl font-bold text-slate-900">{summary.enabledCount} / {summary.totalCount}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {hasChanges ? "تم تعديل التواريخ" : "الوضع الأصلي"}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">إجمالي الإيرادات المتوقعة</span>
            </div>
            <div className="text-xl font-bold text-slate-900"><AnimNum value={fmt(summary.totalRevenue)} /></div>
            <div className="text-[10px] text-slate-500 mt-1">درهم إماراتي</div>
          </div>
        </div>

        {/* ===== PROJECT CONTROL PANEL ===== */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              </div>
              التحكم بالمشاريع
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={enableAll}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
              >
                إظهار الكل
              </button>
              <button
                onClick={disableAll}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium"
              >
                إخفاء الكل
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium"
              >
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showDetails ? "إخفاء التفاصيل" : "عرض التفاصيل"}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {allProjectResults.map((pr, idx) => {
              const config = pr.config;
              const colorSet = pr.colorSet;
              const projectStart = getProjectStart(config.startOffsetMonths);
              const totalDuration = getTotalMonths(config.durations);
              const paidPct = pr.result.investorTotal > 0 ? Math.round((pr.result.investorPaid / pr.result.investorTotal) * 100) : 0;

              return (
                <div
                  key={config.projectId}
                  className={`transition-all duration-300 ${config.enabled ? "bg-white" : "bg-slate-50/50"}`}
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-4 px-6 py-4">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleProject(config.projectId)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                        config.enabled
                          ? "bg-white border-2 hover:shadow-md"
                          : "bg-slate-200 border-2 border-slate-300"
                      }`}
                      style={config.enabled ? { borderColor: colorSet.border } : undefined}
                    >
                      {config.enabled
                        ? <Eye className="w-4.5 h-4.5" style={{ color: colorSet.accent }} />
                        : <EyeOff className="w-4.5 h-4.5 text-slate-400" />
                      }
                    </button>

                    {/* Color indicator + Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: colorSet.bar }} />
                        <span className={`text-sm font-bold truncate ${config.enabled ? "text-slate-900" : "text-slate-400"}`}>
                          {config.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 mr-5">
                        {formatMonthYear(projectStart)} — {totalDuration} شهر
                        {config.startOffsetMonths !== 0 && (
                          <span className={`mr-2 font-medium ${config.startOffsetMonths > 0 ? "text-amber-600" : "text-blue-600"}`}>
                            ({config.startOffsetMonths > 0 ? "+" : ""}{config.startOffsetMonths} شهر)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shift Controls */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 ml-2 font-medium">تحريك:</span>
                      <button onClick={() => shiftProject(config.projectId, -3)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="تبكير 3 أشهر">
                        <ChevronsRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => shiftProject(config.projectId, -1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="تبكير شهر">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <span className={`w-10 text-center text-xs font-mono font-bold rounded-lg py-1 ${
                        config.startOffsetMonths === 0 ? "text-slate-400 bg-slate-50" :
                        config.startOffsetMonths > 0 ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
                      }`}>
                        {config.startOffsetMonths === 0 ? "0" : (config.startOffsetMonths > 0 ? `+${config.startOffsetMonths}` : config.startOffsetMonths)}
                      </span>
                      <button onClick={() => shiftProject(config.projectId, 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="تأخير شهر">
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => shiftProject(config.projectId, 3)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="تأخير 3 أشهر">
                        <ChevronsLeft className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>

                    {/* Financial summary per project */}
                    <div className={`flex items-center gap-5 min-w-[340px] transition-opacity duration-300 ${config.enabled ? "opacity-100" : "opacity-40"}`}>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 mb-0.5">الإجمالي</div>
                        <div className="text-xs font-bold text-slate-900">{fmt(pr.result.investorTotal)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-emerald-600 mb-0.5">مدفوع</div>
                        <div className="text-xs font-bold text-emerald-700">{fmt(pr.result.investorPaid)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-amber-600 mb-0.5">متبقي</div>
                        <div className="text-xs font-bold text-amber-700">{fmt(pr.result.investorRemaining)}</div>
                      </div>
                      {/* Mini progress */}
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${paidPct}%`, backgroundColor: colorSet.bar }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 w-8">{paidPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Duration Details (expandable) */}
                  {showDetails && config.enabled && (
                    <div className="px-6 pb-4 pt-0">
                      <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                        {(["preCon", "construction", "handover"] as const).map(phase => {
                          const labels = { preCon: "ما قبل البناء", construction: "البناء", handover: "التسليم" };
                          return (
                            <div key={phase} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-medium">{labels[phase]}:</span>
                              <button
                                onClick={() => changeDuration(config.projectId, phase, -1)}
                                className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                              >
                                <span className="text-xs font-bold">−</span>
                              </button>
                              <span className="text-xs font-bold text-slate-800 w-6 text-center">{config.durations[phase]}</span>
                              <button
                                onClick={() => changeDuration(config.projectId, phase, 1)}
                                className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                              >
                                <span className="text-xs font-bold">+</span>
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
        </div>

        {/* ===== STACKED BAR CHART ===== */}
        {projectResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              التدفقات النقدية الربع سنوية
            </h3>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-5 flex-wrap">
              {projectResults.map(pr => (
                <div key={pr.config.projectId} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: pr.colorSet.bar }} />
                  <span className="text-[10px] text-slate-600 font-medium">{pr.config.name}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto pb-2">
              <svg
                width={Math.max(globalQuarters.length * (barWidth + 8) + 80, 400)}
                height={chartHeight + 60}
                className="mx-auto"
              >
                {/* Y-axis grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                  const y = chartHeight - chartHeight * pct;
                  return (
                    <g key={pct}>
                      <line x1="50" y1={y} x2={globalQuarters.length * (barWidth + 8) + 60} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
                      <text x="45" y={y + 4} textAnchor="end" className="text-[9px] fill-slate-400">
                        {fmt(maxVal * pct)}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {globalQuarters.map((q, qi) => {
                  const x = 55 + qi * (barWidth + 8);
                  let stackY = chartHeight;

                  return (
                    <g key={qi}>
                      {projectResults.map(pr => {
                        const val = (aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [])[qi] || 0;
                        const barH = (val / maxVal) * chartHeight;
                        stackY -= barH;
                        return (
                          <rect
                            key={pr.config.projectId}
                            x={x}
                            y={Math.max(0, stackY)}
                            width={barWidth}
                            height={Math.max(0, barH)}
                            fill={pr.colorSet.bar}
                            rx="3"
                            opacity="0.9"
                            className="hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <title>{pr.config.name}: {fmt(val)} درهم</title>
                          </rect>
                        );
                      })}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 18}
                        textAnchor="middle"
                        className="text-[8px] fill-slate-500 font-medium"
                        transform={`rotate(-35, ${x + barWidth / 2}, ${chartHeight + 18})`}
                      >
                        {q.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* ===== COMBINED TABLE ===== */}
        {projectResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                جدول التدفقات المجمّع — مصاريف المستثمر
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-gradient-to-l from-slate-100 to-slate-200 text-slate-800">
                    <th className="sticky right-0 bg-slate-200 z-10 px-4 py-3.5 text-right min-w-[180px] font-bold">المشروع</th>
                    <th className="px-3 py-3.5 text-center bg-slate-200 min-w-[100px] font-bold">الإجمالي</th>
                    <th className="px-3 py-3.5 text-center min-w-[90px] font-bold bg-emerald-100 text-emerald-800">مدفوع</th>
                    <th className="px-3 py-3.5 text-center min-w-[90px] font-bold bg-amber-100 text-amber-800">المتبقي</th>
                    {globalQuarters.map((q, qi) => (
                      <th key={qi} className="px-3 py-3 text-center min-w-[90px] whitespace-nowrap font-medium">{q.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectResults.map((pr, prIdx) => {
                    const perQ = aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [];
                    return (
                      <tr key={pr.config.projectId} className={`${prIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50 transition-colors`}>
                        <td className="sticky right-0 z-10 px-4 py-3 font-bold border-b border-slate-100" style={{ backgroundColor: pr.colorSet.light }}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: pr.colorSet.bar }} />
                            <span style={{ color: pr.colorSet.text }}>{pr.config.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-bold border-b border-slate-100 text-slate-900" style={{ backgroundColor: pr.colorSet.light }}>
                          {fmt(pr.result.investorTotal)}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-emerald-700 border-b border-slate-100 bg-emerald-50/50">
                          {fmt(pr.result.investorPaid)}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-amber-700 border-b border-slate-100 bg-amber-50/50">
                          {fmt(pr.result.investorRemaining)}
                        </td>
                        {globalQuarters.map((_, qi) => (
                          <td key={qi} className="px-3 py-3 text-center border-b border-slate-100 text-slate-700">
                            {(perQ[qi] || 0) > 0 ? fmt(perQ[qi]) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className="bg-gradient-to-l from-slate-200 to-slate-300 text-slate-900 font-bold">
                    <td className="sticky right-0 bg-slate-300 z-10 px-4 py-3.5 text-sm font-extrabold">
                      إجمالي مصاريف المستثمر
                    </td>
                    <td className="px-3 py-3.5 text-center bg-slate-200 text-sm font-extrabold">
                      {fmt(summary.totalInvestor)}
                    </td>
                    <td className="px-3 py-3.5 text-center text-emerald-800 text-sm bg-emerald-100 font-extrabold">
                      {fmt(summary.totalPaid)}
                    </td>
                    <td className="px-3 py-3.5 text-center text-amber-800 text-sm bg-amber-100 font-extrabold">
                      {fmt(summary.totalRemaining)}
                    </td>
                    {aggregatedData.investorPerQ.map((val, qi) => (
                      <td key={qi} className="px-3 py-3.5 text-center">
                        {val > 0 ? fmt(val) : <span className="text-slate-400">—</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Cumulative row */}
                  <tr className="bg-indigo-50 text-indigo-900 font-bold">
                    <td className="sticky right-0 bg-indigo-50 z-10 px-4 py-3">التراكمي</td>
                    <td className="px-3 py-3 text-center bg-indigo-100 font-bold">
                      {fmt(aggregatedData.cumulativeInvestor[aggregatedData.cumulativeInvestor.length - 1] || 0)}
                    </td>
                    <td className="px-3 py-3 text-center bg-indigo-100">—</td>
                    <td className="px-3 py-3 text-center bg-indigo-100">—</td>
                    {aggregatedData.cumulativeInvestor.map((val, qi) => (
                      <td key={qi} className="px-3 py-3 text-center">
                        {val > 0 ? fmt(val) : <span className="text-indigo-300">—</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== 3-MONTH REQUIREMENT ===== */}
        {projectResults.length > 0 && summary.totalNext3Months > 0 && (
          <div className="bg-white rounded-2xl border border-red-200/60 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-l from-red-50 to-amber-50 px-6 py-4 border-b border-red-100">
              <h3 className="text-sm font-bold text-red-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-200 to-red-300 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-700" />
                </div>
                المطلوب لأقرب 3 أشهر — {next3Label}
              </h3>
            </div>

            <div className="p-6">
              {/* Overall */}
              <div className="bg-gradient-to-l from-red-50 to-white rounded-2xl p-5 border border-red-200 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-red-600 font-medium mb-1">إجمالي المطلوب تأمينه خلال 3 أشهر</div>
                    <div className="text-3xl font-bold text-red-800">
                      <AnimNum value={fmt(summary.totalNext3Months)} />
                      <span className="text-sm font-normal text-red-600 mr-2">درهم</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500">من إجمالي المتبقي</div>
                    <div className="text-base font-bold text-slate-700">{fmt(summary.totalRemaining)} درهم</div>
                  </div>
                </div>
              </div>

              {/* Per project */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectResults.map(pr => {
                  if (pr.result.investorNext3Months <= 0) return null;
                  return (
                    <div key={pr.config.projectId} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: pr.colorSet.bar }} />
                        <span className="text-xs font-bold text-slate-800 truncate">{pr.config.name}</span>
                      </div>
                      <div className="text-xl font-bold text-red-800">
                        {fmt(pr.result.investorNext3Months)}
                        <span className="text-xs font-normal text-slate-500 mr-1">درهم</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1.5">
                        من إجمالي متبقي {fmt(pr.result.investorRemaining)} درهم
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== NEAREST 3 QUARTERS ===== */}
        {projectResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-slate-600" />
                </div>
                أقرب 3 أرباع سنوية
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {globalQuarters.slice(0, 3).map((q, qi) => (
                  <div key={qi} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="text-xs text-slate-500 mb-2 font-medium">{q.label}</div>
                    <div className="text-2xl font-bold text-slate-900 mb-4">
                      {fmt(aggregatedData.investorPerQ[qi])}
                      <span className="text-xs font-normal text-slate-500 mr-1">درهم</span>
                    </div>
                    <div className="space-y-2">
                      {projectResults.map(pr => {
                        const val = (aggregatedData.perProjectInvestorPerQ[pr.config.projectId] || [])[qi] || 0;
                        if (val <= 0) return null;
                        const pct = aggregatedData.investorPerQ[qi] > 0 ? (val / aggregatedData.investorPerQ[qi]) * 100 : 0;
                        return (
                          <div key={pr.config.projectId}>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: pr.colorSet.bar }} />
                                <span className="text-slate-600 truncate max-w-[140px]">{pr.config.name}</span>
                              </div>
                              <span className="font-bold text-slate-800">{fmt(val)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pr.colorSet.bar }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {projectConfigs.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">لا توجد مشاريع</h3>
            <p className="text-sm text-slate-500">أضف مشاريع في إدارة المشاريع أولاً</p>
          </div>
        )}
      </main>
    </div>
  );
}
