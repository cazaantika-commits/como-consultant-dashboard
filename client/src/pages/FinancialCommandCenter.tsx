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
  Wallet,
  ArrowDownCircle,
  Clock,
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
  startOffsetMonths: number;
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
  // Monthly data indexed by global month offset from BASE_START
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

  // Get expenses — dynamic from project data when available
  const investorExpenses = getInvestorExpenses(costs);
  const escrowExpenses = getEscrowExpenses(costs);
  const defaultRevenue = getDefaultRevenue(phases, durations, costs?.totalRevenue);

  // Calculate investor monthly (local months)
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
    // Add land costs at month 0
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

  // Calculate paid vs remaining using same logic as ExcelCashFlowPage
  let investorPaid = landTotal; // Land is always "paid"
  const now = new Date();
  let investorNext3Months = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const monthVal = investorMonthlyLocal[m] || 0;
    if (monthVal <= 0) continue;
    if (isMonthPaid(m, projectStart)) {
      investorPaid += monthVal;
    }
    // Next 3 months
    const d = getMonthDate(m, projectStart);
    if (d >= now) {
      const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
      if (diffMonths >= 0 && diffMonths < 3) {
        investorNext3Months += monthVal;
      }
    }
  }
  const investorRemaining = investorTotal - investorPaid;

  // Calculate escrow monthly
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

  // Revenue
  for (const [mStr, val] of Object.entries(defaultRevenue)) {
    const localMonth = parseInt(mStr);
    const globalMonth = config.startOffsetMonths + localMonth;
    escrowRevenueMonthly[globalMonth] = (escrowRevenueMonthly[globalMonth] || 0) + val;
  }

  // Escrow balance (opening = 20% of construction cost)
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
    investorTotal,
    investorPaid,
    investorRemaining,
    investorNext3Months,
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

  // Fetch market overview and competition pricing for ALL projects via batch endpoint
  const allMoQuery = trpc.marketOverview.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10000 });
  const allCpQuery = trpc.competitionPricing.getAllByUser.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10000 });

  // Build a map of projectId -> ProjectCosts using ALL project data
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
        result: calculateProjectCashFlow(config, projectCostsMap[config.projectId]),
        colorSet: PROJECT_COLORS[projectConfigs.indexOf(config) % PROJECT_COLORS.length],
      }));
  }, [projectConfigs, projectCostsMap]);

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
    const totalPaid = projectResults.reduce((s, pr) => s + pr.result.investorPaid, 0);
    const totalRemaining = projectResults.reduce((s, pr) => s + pr.result.investorRemaining, 0);
    const totalNext3Months = projectResults.reduce((s, pr) => s + pr.result.investorNext3Months, 0);
    const totalEscrowExp = projectResults.reduce((s, pr) => s + pr.result.escrowTotal, 0);
    const peakQuarter = Math.max(...aggregatedData.investorPerQ);
    const peakQuarterIdx = aggregatedData.investorPerQ.indexOf(peakQuarter);
    const peakLabel = globalQuarters[peakQuarterIdx]?.label || "";

    return {
      totalInvestor,
      totalPaid,
      totalRemaining,
      totalNext3Months,
      totalEscrowExp,
      peakQuarter,
      peakLabel,
      enabledCount: projectResults.length,
      totalCount: projectConfigs.length,
    };
  }, [projectResults, aggregatedData, globalQuarters, projectConfigs]);

  // Next 3 months label
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

        {/* ========== INVESTOR SUMMARY — PAID / REMAINING / REQUIRED ========== */}
        <div className="bg-gradient-to-l from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold">ملخص رأس المال — المستثمر</h2>
            <span className="text-[10px] text-gray-400 mr-2">{summary.enabledCount} مشاريع مفعّلة</span>
          </div>

          {/* Main 4 numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-gray-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                إجمالي رأس المال المطلوب
              </div>
              <div className="text-xl font-bold text-white">{fmt(summary.totalInvestor)}</div>
              <div className="text-[9px] text-gray-400">درهم</div>
            </div>

            <div className="bg-emerald-500/20 rounded-xl p-3 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-300 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                تم دفعه
              </div>
              <div className="text-xl font-bold text-emerald-400">{fmt(summary.totalPaid)}</div>
              <div className="text-[9px] text-emerald-300/60">
                {summary.totalInvestor > 0 ? `${Math.round((summary.totalPaid / summary.totalInvestor) * 100)}%` : "0%"} من الإجمالي
              </div>
            </div>

            <div className="bg-orange-500/20 rounded-xl p-3 border border-orange-500/30">
              <div className="text-[10px] text-orange-300 mb-1 flex items-center gap-1">
                <ArrowDownCircle className="w-3 h-3" />
                المتبقي (المطلوب تأمينه)
              </div>
              <div className="text-xl font-bold text-orange-400">{fmt(summary.totalRemaining)}</div>
              <div className="text-[9px] text-orange-300/60">
                {summary.totalInvestor > 0 ? `${Math.round((summary.totalRemaining / summary.totalInvestor) * 100)}%` : "0%"} من الإجمالي
              </div>
            </div>

            <div className="bg-red-500/20 rounded-xl p-3 border border-red-500/30">
              <div className="text-[10px] text-red-300 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                المطلوب خلال 3 أشهر
              </div>
              <div className="text-xl font-bold text-red-400">{fmt(summary.totalNext3Months)}</div>
              <div className="text-[9px] text-red-300/60">{next3Label}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-gray-300 mb-1.5">
              <span>التقدم في الدفع</span>
              <span>{summary.totalInvestor > 0 ? `${Math.round((summary.totalPaid / summary.totalInvestor) * 100)}%` : "0%"}</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${summary.totalInvestor > 0 ? Math.min(100, (summary.totalPaid / summary.totalInvestor) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Per-project breakdown */}
          <div className="space-y-2">
            <div className="text-[10px] text-gray-400 font-medium mb-1">تفصيل لكل مشروع:</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-right py-1.5 px-2 font-medium">المشروع</th>
                    <th className="text-center py-1.5 px-2 font-medium">إجمالي رأس المال</th>
                    <th className="text-center py-1.5 px-2 font-medium">تم دفعه ✓</th>
                    <th className="text-center py-1.5 px-2 font-medium">المتبقي المطلوب</th>
                    <th className="text-center py-1.5 px-2 font-medium">المطلوب 3 أشهر</th>
                    <th className="text-center py-1.5 px-2 font-medium">التقدم</th>
                  </tr>
                </thead>
                <tbody>
                  {projectResults.map((pr, idx) => {
                    const paidPct = pr.result.investorTotal > 0 ? Math.round((pr.result.investorPaid / pr.result.investorTotal) * 100) : 0;
                    return (
                      <tr key={pr.config.projectId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pr.colorSet.bar }} />
                            <span className="font-medium text-white truncate max-w-[180px]">{pr.config.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-white">{fmt(pr.result.investorTotal)}</td>
                        <td className="py-2 px-2 text-center text-emerald-400 font-medium">{fmt(pr.result.investorPaid)}</td>
                        <td className="py-2 px-2 text-center text-orange-400 font-bold">{fmt(pr.result.investorRemaining)}</td>
                        <td className="py-2 px-2 text-center text-red-400 font-medium">
                          {pr.result.investorNext3Months > 0 ? fmt(pr.result.investorNext3Months) : <span className="text-gray-500">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                            <span className="text-gray-300 text-[9px] w-8 text-left">{paidPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-white/20 font-bold">
                    <td className="py-2.5 px-2 text-right text-amber-400">الإجمالي</td>
                    <td className="py-2.5 px-2 text-center text-white">{fmt(summary.totalInvestor)}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400">{fmt(summary.totalPaid)}</td>
                    <td className="py-2.5 px-2 text-center text-orange-400">{fmt(summary.totalRemaining)}</td>
                    <td className="py-2.5 px-2 text-center text-red-400">{fmt(summary.totalNext3Months)}</td>
                    <td className="py-2.5 px-2 text-center text-gray-300">
                      {summary.totalInvestor > 0 ? `${Math.round((summary.totalPaid / summary.totalInvestor) * 100)}%` : "0%"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-medium text-amber-700">إجمالي الإيرادات المتوقعة</span>
            </div>
            <div className="text-lg font-bold text-amber-900">
              {fmt(projectResults.reduce((s, pr) => s + (projectCostsMap[pr.config.projectId]?.totalRevenue || 0), 0))}
              <span className="text-xs font-normal"> درهم</span>
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
              const pr = projectResults.find(r => r.config.projectId === config.projectId);

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

                    {/* Totals: Total / Paid / Remaining */}
                    <div className="text-left min-w-[220px] flex items-center gap-3">
                      <div>
                        <div className={`text-[10px] ${config.enabled ? "text-gray-500" : "text-gray-400"}`}>الإجمالي</div>
                        <div className={`text-xs font-bold ${config.enabled ? colorSet.text : "text-gray-400"}`}>
                          {fmt(pr?.result.investorTotal || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-600">مدفوع</div>
                        <div className="text-xs font-bold text-emerald-700">
                          {fmt(pr?.result.investorPaid || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-orange-600">متبقي</div>
                        <div className="text-xs font-bold text-orange-700">
                          {fmt(pr?.result.investorRemaining || 0)}
                        </div>
                      </div>
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
                    <th className="px-2 py-2 text-center bg-emerald-700 min-w-[80px]">مدفوع ✓</th>
                    <th className="px-2 py-2 text-center bg-orange-700 min-w-[80px]">المتبقي</th>
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
                        <td className="px-2 py-2 text-center font-medium text-emerald-700 border-b border-gray-100 bg-emerald-50">
                          {fmt(pr.result.investorPaid)}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-orange-700 border-b border-gray-100 bg-orange-50">
                          {fmt(pr.result.investorRemaining)}
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
                    <td className="px-2 py-2.5 text-center bg-emerald-800 text-emerald-200">
                      {fmt(summary.totalPaid)}
                    </td>
                    <td className="px-2 py-2.5 text-center bg-orange-800 text-orange-200">
                      {fmt(summary.totalRemaining)}
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
                    <td className="px-2 py-2 text-center bg-red-100" colSpan={1}>-</td>
                    <td className="px-2 py-2 text-center bg-red-100" colSpan={1}>-</td>
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
              المطلوب لأقرب 3 أشهر — {next3Label}
            </h3>

            {/* Overall next 3 months */}
            <div className="bg-white rounded-xl p-4 border-2 border-red-200 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-red-600 font-medium">إجمالي المطلوب تأمينه خلال 3 أشهر</div>
                  <div className="text-2xl font-bold text-red-800">{fmt(summary.totalNext3Months)} <span className="text-sm font-normal">درهم</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500">من إجمالي المتبقي</div>
                  <div className="text-sm font-bold text-gray-700">{fmt(summary.totalRemaining)} درهم</div>
                </div>
              </div>
            </div>

            {/* Per project next 3 months */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectResults.map(pr => {
                if (pr.result.investorNext3Months <= 0) return null;
                return (
                  <div key={pr.config.projectId} className="bg-white rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pr.colorSet.bar }} />
                      <span className="text-[10px] font-bold text-gray-800 truncate">{pr.config.name}</span>
                    </div>
                    <div className="text-lg font-bold text-red-800">{fmt(pr.result.investorNext3Months)} <span className="text-xs font-normal">درهم</span></div>
                    <div className="text-[9px] text-gray-500 mt-1">
                      من إجمالي متبقي {fmt(pr.result.investorRemaining)} درهم
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Quarterly breakdown */}
        {projectResults.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              أقرب 3 أرباع سنوية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {globalQuarters.slice(0, 3).map((q, qi) => (
                <div key={qi} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-[10px] text-muted-foreground mb-1">{q.label}</div>
                  <div className="text-lg font-bold text-gray-800">{fmt(aggregatedData.investorPerQ[qi])} <span className="text-xs font-normal">درهم</span></div>
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
