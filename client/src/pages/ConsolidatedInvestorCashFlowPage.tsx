import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import {
  dbProjectToInputs,
} from "@/lib/projectData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
interface ProjectCashFlow {
  id: number;
  name: string;
  scenario: Scenario;
  startMonthOffset: number;
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
  totalMonths: number;
  monthlyExpenses: number[];
  monthlyRevenue: number[];
  monthlyNet: number[];
  totalExpenses: number;
  totalRevenue: number;
  rows: CostRow[];
}

interface CellDetail {
  projectName: string;
  monthLabel: string;
  items: { label: string; section: string; amount: number }[];
  totalExpenses: number;
  totalRevenue: number;
  net: number;
}

// ═══════════════════════════════════════════
// FORMAT
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (Math.abs(n) < 1) return "–";
  return Math.round(n).toLocaleString("en-US");
}

function fmtM(n: number): string {
  if (Math.abs(n) < 1000) return fmt(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return (n / 1e3).toFixed(0) + "K";
}

function getMonthLabel(offset: number, globalStartYear: number, globalStartMonth: number): string {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const absMonth = (globalStartYear * 12 + globalStartMonth - 1) + offset;
  const year = Math.floor(absMonth / 12);
  const monthIdx = absMonth % 12;
  return `${months[monthIdx]} ${year}`;
}

// ═══════════════════════════════════════════
// COMPUTE PROJECT CASH FLOW FOR CONSOLIDATED VIEW
// ═══════════════════════════════════════════
function computeProjectForConsolidated(project: any, scenario: Scenario): ProjectCashFlow {
  const result = computeInvestorCashFlow(project, scenario);
  const { designDuration, constructionDuration, postDuration } = result;

  const totalMonths = designDuration + constructionDuration + postDuration;
  const monthlyExpenses = new Array(totalMonths).fill(0);
  const monthlyRevenue2 = new Array(totalMonths).fill(0);

  for (let idx = 0; idx < designDuration; idx++) {
    monthlyExpenses[idx] = result.designMonthlyTotals[idx];
  }
  for (let idx = 0; idx < constructionDuration; idx++) {
    monthlyExpenses[designDuration + idx] = result.constructionMonthlyTotals[idx];
  }
  for (let idx = 0; idx < postDuration; idx++) {
    monthlyExpenses[designDuration + constructionDuration + idx] = result.postMonthlyTotals[idx];
  }
  for (let idx = 0; idx < postDuration; idx++) {
    monthlyRevenue2[designDuration + constructionDuration + idx] = result.revenuePostTotals[idx];
  }

  const monthlyNet = monthlyRevenue2.map((rev, idx) => rev - monthlyExpenses[idx]);

  const i = dbProjectToInputs(project);
  const startDate = i.startDate || "2026-08";

  return {
    id: project.id,
    name: project.name || "مشروع بدون اسم",
    scenario,
    startMonthOffset: 0,
    designDuration,
    constructionDuration,
    postDuration,
    totalMonths,
    monthlyExpenses,
    monthlyRevenue: monthlyRevenue2,
    monthlyNet,
    totalExpenses: monthlyExpenses.reduce((s, v) => s + v, 0),
    totalRevenue: monthlyRevenue2.reduce((s, v) => s + v, 0),
    rows: result.rows,
  };
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ConsolidatedInvestorCashFlowPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  // ─── State ───
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<number, Scenario>>({});
  const [cellDetail, setCellDetail] = useState<CellDetail | null>(null);
  const [startDateOverrides, setStartDateOverrides] = useState<Record<number, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Project selection
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number> | null>(null); // null = all selected
  const [showSettings, setShowSettings] = useState(false);

  const getScenario = (project: any): Scenario => {
    if (scenarioOverrides[project.id]) return scenarioOverrides[project.id];
    const dbScenario = project.financingScenario || "offplan_escrow";
    if (dbScenario === "rental") return "rental";
    if (dbScenario === "no_offplan") return "no_offplan";
    if (dbScenario === "offplan_construction") return "offplan_construction";
    return "offplan_escrow";
  };

  // Initialize selection when data loads
  const allProjects = projectsQuery.data || [];
  const activeProjectIds = useMemo(() => {
    if (selectedProjectIds === null) return new Set(allProjects.map((p: any) => p.id));
    return selectedProjectIds;
  }, [selectedProjectIds, allProjects]);

  const toggleProject = (id: number) => {
    setSelectedProjectIds(prev => {
      const current = prev === null ? new Set(allProjects.map((p: any) => p.id)) : new Set(prev);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      return current;
    });
  };

  const selectAll = () => setSelectedProjectIds(null);
  const deselectAll = () => setSelectedProjectIds(new Set());

  const consolidated = useMemo(() => {
    if (!projectsQuery.data || projectsQuery.data.length === 0) return null;

    // Filter by selected projects
    const filteredProjects = projectsQuery.data.filter((p: any) => activeProjectIds.has(p.id));
    if (filteredProjects.length === 0) return null;

    // Step 1: Global start date
    let globalStartYear = 2099;
    let globalStartMonth = 12;
    for (const proj of filteredProjects) {
      const sd = (proj as any).startDate || "2026-08";
      const [y, m] = sd.split("-").map(Number);
      if (y < globalStartYear || (y === globalStartYear && m < globalStartMonth)) {
        globalStartYear = y;
        globalStartMonth = m;
      }
    }

    // Step 2: Compute each project
    const projectFlows: ProjectCashFlow[] = filteredProjects.map((proj: any) => {
      const scenario = getScenario(proj);
      const pf = computeProjectForConsolidated(proj, scenario);
      const sd = proj.startDate || "2026-08";
      const [y, m] = sd.split("-").map(Number);
      const correctOffset = (y - globalStartYear) * 12 + (m - globalStartMonth);
      return { ...pf, startMonthOffset: correctOffset };
    });

    // Step 3: Global timeline range
    let maxGlobalMonth = 0;
    for (const pf of projectFlows) {
      const end = pf.startMonthOffset + pf.totalMonths;
      if (end > maxGlobalMonth) maxGlobalMonth = end;
    }

    // Step 4: Consolidated arrays
    const totalMonths = maxGlobalMonth;
    const consolidatedExpenses = new Array(totalMonths).fill(0);
    const consolidatedRevenue = new Array(totalMonths).fill(0);
    const consolidatedNet = new Array(totalMonths).fill(0);
    const perProjectMonthly: Record<number, number[]> = {};

    for (const pf of projectFlows) {
      perProjectMonthly[pf.id] = new Array(totalMonths).fill(0);
      for (let m = 0; m < pf.totalMonths; m++) {
        const globalIdx = pf.startMonthOffset + m;
        if (globalIdx >= 0 && globalIdx < totalMonths) {
          consolidatedExpenses[globalIdx] += pf.monthlyExpenses[m];
          consolidatedRevenue[globalIdx] += pf.monthlyRevenue[m];
          consolidatedNet[globalIdx] += pf.monthlyNet[m];
          perProjectMonthly[pf.id][globalIdx] = pf.monthlyNet[m];
        }
      }
    }

    // Step 5: Cumulative
    const cumulative = new Array(totalMonths).fill(0);
    let running = 0;
    for (let idx = 0; idx < totalMonths; idx++) {
      running += consolidatedNet[idx];
      cumulative[idx] = running;
    }

    // Step 6: Month labels
    const monthLabels = Array.from({ length: totalMonths }, (_, idx) => getMonthLabel(idx, globalStartYear, globalStartMonth));

    return {
      projectFlows,
      totalMonths,
      consolidatedExpenses,
      consolidatedRevenue,
      consolidatedNet,
      cumulative,
      monthLabels,
      perProjectMonthly,
      globalStartYear,
      globalStartMonth,
    };
  }, [projectsQuery.data, scenarioOverrides, activeProjectIds]);

  // ─── Loading / Auth States ───
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <p className="text-slate-600 text-sm">يرجى تسجيل الدخول للوصول إلى المحفظة</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin" />
          <p className="text-slate-500 text-sm font-medium">جاري تحميل بيانات المحفظة...</p>
        </div>
      </div>
    );
  }

  if (!consolidated) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <p className="text-slate-500 text-sm">لا توجد مشاريع محددة — اختر مشاريع من القائمة</p>
          <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">تحديد جميع المشاريع</button>
        </div>
      </div>
    );
  }

  // ─── Financial Summary ───
  const saleProjects = consolidated.projectFlows.filter(pf => pf.scenario !== "rental");
  const rentalProjects = consolidated.projectFlows.filter(pf => pf.scenario === "rental");
  const totalRevenueSales = saleProjects.reduce((s, pf) => s + pf.totalRevenue, 0);
  const totalCostAll = consolidated.projectFlows.reduce((s, pf) => s + pf.totalExpenses, 0);
  const totalCostSales = saleProjects.reduce((s, pf) => s + pf.totalExpenses, 0);
  const investorCapital = saleProjects.reduce((s, pf) => s + pf.totalExpenses, 0);
  const profit = totalRevenueSales - totalCostSales;
  const profitPctCost = totalCostSales > 0 ? (profit / totalCostSales) * 100 : 0;
  const developerShare = profit * 0.15;
  const netInvestorProfit = profit - developerShare;
  const netProfitPctInvestor = investorCapital > 0 ? (netInvestorProfit / investorCapital) * 100 : 0;
  const peakNegative = Math.min(...consolidated.cumulative);
  const peakCapital = Math.abs(peakNegative);
  const peakIdx = consolidated.cumulative.indexOf(peakNegative);
  const peakMonth = peakIdx >= 0 ? consolidated.monthLabels[peakIdx] : "";

  return (
    <div className="min-h-screen bg-[#fafbfc]" dir="rtl">
      {/* ═══ TOP BAR ═══ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">المحفظة الاستثمارية</h1>
              <p className="text-[11px] text-slate-500">
                {consolidated.projectFlows.length} مشاريع محددة · بداية {consolidated.monthLabels[0]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${showSettings ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              إعدادات المحفظة
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-5">

        {/* ═══ PROJECT SELECTION & SETTINGS PANEL ═══ */}
        {showSettings && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">اختيار المشاريع وإعداداتها</h2>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-[11px] text-blue-600 hover:underline">تحديد الكل</button>
                <span className="text-slate-300">|</span>
                <button onClick={deselectAll} className="text-[11px] text-red-500 hover:underline">إلغاء الكل</button>
                {hasChanges && (
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const promises: Promise<any>[] = [];
                        for (const pf of consolidated.projectFlows) {
                          const scenarioChanged = scenarioOverrides[pf.id] && scenarioOverrides[pf.id] !== pf.scenario;
                          const dateChanged = startDateOverrides[pf.id];
                          if (scenarioChanged || dateChanged) {
                            const updateData: any = { id: pf.id };
                            if (scenarioChanged) updateData.financingScenario = scenarioOverrides[pf.id];
                            if (dateChanged) updateData.startDate = startDateOverrides[pf.id];
                            promises.push(updateProject.mutateAsync(updateData));
                          }
                        }
                        await Promise.all(promises);
                        setHasChanges(false);
                        setScenarioOverrides({});
                        setStartDateOverrides({});
                        toast({ title: "تم الحفظ", description: "تم حفظ التغييرات بنجاح" });
                      } catch (err) {
                        toast({ title: "خطأ", description: "فشل حفظ التغييرات", variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors mr-2"
                  >
                    {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allProjects.map((proj: any) => {
                const isSelected = activeProjectIds.has(proj.id);
                const currentStartDate = startDateOverrides[proj.id] || proj.startDate || "2026-08";
                return (
                  <div
                    key={proj.id}
                    className={`relative rounded-xl border-2 p-3 transition-all cursor-pointer ${isSelected ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-200 bg-white opacity-60"}`}
                    onClick={() => toggleProject(proj.id)}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-3 left-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-slate-800 border-slate-800" : "border-slate-300 bg-white"}`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <div className="pr-0 pl-7">
                      <div className="text-sm font-bold text-slate-800 mb-2 truncate">{proj.name}</div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          value={scenarioOverrides[proj.id] || proj.financingScenario || "offplan_escrow"}
                          onChange={(e) => {
                            setScenarioOverrides(prev => ({ ...prev, [proj.id]: e.target.value as Scenario }));
                            setHasChanges(true);
                          }}
                          className="text-[10px] border border-slate-200 rounded-md px-2 py-1 bg-white flex-1"
                        >
                          <option value="offplan_escrow">أوف بلان + ضمان</option>
                          <option value="offplan_construction">أوف بلان بدون إيداع</option>
                          <option value="no_offplan">بيع بعد الإنجاز</option>
                          <option value="rental">تطوير للتأجير</option>
                        </select>
                        <input
                          type="month"
                          value={currentStartDate}
                          onChange={(e) => {
                            setStartDateOverrides(prev => ({ ...prev, [proj.id]: e.target.value }));
                            setHasChanges(true);
                          }}
                          className="text-[10px] border border-slate-200 rounded-md px-2 py-1 bg-white w-[110px]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ FINANCIAL SUMMARY CARDS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="إجمالي الإيرادات" value={fmtM(totalRevenueSales)} color="emerald" />
          <SummaryCard label="إجمالي التكلفة" value={fmtM(totalCostAll)} color="red" />
          <SummaryCard label="صافي الأرباح" value={fmtM(profit)} color="blue" sub={`${profitPctCost.toFixed(0)}% من التكلفة`} />
          <SummaryCard label="حصة المطور (15%)" value={fmtM(developerShare)} color="purple" />
          <SummaryCard label="صافي ربح المستثمر" value={fmtM(netInvestorProfit)} color="teal" sub={`${netProfitPctInvestor.toFixed(0)}% عائد`} />
          <SummaryCard label="ذروة رأس المال" value={fmtM(peakCapital)} color="amber" sub={peakMonth} />
        </div>

        {rentalProjects.length > 0 && (
          <p className="text-[10px] text-slate-400 -mt-2 px-1">
            * المشاريع التجارية ({rentalProjects.map(p => p.name).join("، ")}) مستبعدة من حسبة الأرباح
          </p>
        )}

        {/* ═══ PROJECTS SUMMARY TABLE ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">ملخص المشاريع</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-right py-3 px-4 text-slate-600 font-semibold">المشروع</th>
                  <th className="text-center py-3 px-3 text-slate-600 font-semibold">السيناريو</th>
                  <th className="text-center py-3 px-3 text-slate-600 font-semibold">المدة</th>
                  <th className="text-left py-3 px-3 text-red-600 font-semibold">التكلفة</th>
                  <th className="text-left py-3 px-3 text-emerald-600 font-semibold">الإيرادات</th>
                  <th className="text-left py-3 px-3 text-blue-600 font-semibold">الربح</th>
                  <th className="text-left py-3 px-3 text-slate-600 font-semibold">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.projectFlows.map((pf) => {
                  const projProfit = pf.totalRevenue - pf.totalExpenses;
                  const projPct = pf.totalExpenses > 0 ? (projProfit / pf.totalExpenses * 100) : 0;
                  const scenarioLabel = pf.scenario === "offplan_escrow" ? "أوف بلان + ضمان" : pf.scenario === "offplan_construction" ? "أوف بلان" : pf.scenario === "no_offplan" ? "بعد الإنجاز" : "تأجير";
                  return (
                    <tr key={pf.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{pf.name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">{scenarioLabel}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">{pf.totalMonths} شهر</td>
                      <td className="py-3 px-3 text-red-600 font-medium">{fmtM(pf.totalExpenses)}</td>
                      <td className="py-3 px-3 text-emerald-600 font-medium">{pf.scenario === "rental" ? "–" : fmtM(pf.totalRevenue)}</td>
                      <td className={`py-3 px-3 font-bold ${projProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>{pf.scenario === "rental" ? "–" : fmtM(projProfit)}</td>
                      <td className="py-3 px-3 text-slate-500">{pf.scenario === "rental" ? "–" : `${projPct.toFixed(0)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td className="py-3 px-4 font-bold">الإجمالي</td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 font-bold">{fmtM(totalCostAll)}</td>
                  <td className="py-3 px-3 font-bold">{fmtM(totalRevenueSales)}</td>
                  <td className="py-3 px-3 font-bold">{fmtM(profit)}</td>
                  <td className="py-3 px-3 font-bold">{profitPctCost.toFixed(0)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ═══ CUMULATIVE CASH FLOW CHART (Simple SVG) ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">التدفق النقدي التراكمي</h2>
          </div>
          <div className="p-4">
            <CumulativeChart data={consolidated.cumulative} labels={consolidated.monthLabels} />
          </div>
        </div>

        {/* ═══ MONTHLY CASH FLOW TABLE ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">التدفقات النقدية الشهرية</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">اضغط على أي خلية لعرض التفاصيل</p>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th className="sticky right-0 bg-slate-50 z-20 text-right py-2.5 px-3 border-b border-slate-200 text-slate-600 font-semibold min-w-[100px]">
                    الشهر
                  </th>
                  {consolidated.projectFlows.map((pf) => (
                    <th key={pf.id} className="text-center py-2.5 px-2 border-b border-slate-200 text-slate-600 font-semibold min-w-[85px]">
                      {pf.name.length > 14 ? pf.name.substring(0, 14) + "…" : pf.name}
                    </th>
                  ))}
                  <th className="text-center py-2.5 px-2 border-b border-slate-200 text-red-600 font-bold min-w-[80px] bg-red-50/50">المصروفات</th>
                  <th className="text-center py-2.5 px-2 border-b border-slate-200 text-emerald-600 font-bold min-w-[80px] bg-emerald-50/50">الإيرادات</th>
                  <th className="text-center py-2.5 px-2 border-b border-slate-200 text-blue-600 font-bold min-w-[80px] bg-blue-50/50">الصافي</th>
                  <th className="text-center py-2.5 px-2 border-b border-slate-200 text-slate-800 font-bold min-w-[90px] bg-slate-100">التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.monthLabels.map((label, idx) => {
                  const hasData = consolidated.consolidatedExpenses[idx] !== 0 || consolidated.consolidatedRevenue[idx] !== 0;
                  if (!hasData && idx > 0 && Math.abs(consolidated.cumulative[idx] - consolidated.cumulative[idx - 1]) < 1) return null;

                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="sticky right-0 bg-white py-2 px-3 text-slate-700 font-medium border-l border-slate-100 text-[11px]">
                        {label}
                      </td>
                      {consolidated.projectFlows.map((pf) => {
                        const val = consolidated.perProjectMonthly[pf.id]?.[idx] || 0;
                        const isClickable = Math.abs(val) > 1;
                        return (
                          <td
                            key={pf.id}
                            className={`text-center py-2 px-1 ${val > 0 ? "text-emerald-600" : val < 0 ? "text-red-600" : "text-slate-300"} ${isClickable ? "cursor-pointer hover:bg-blue-50 hover:underline" : ""}`}
                            onClick={() => {
                              if (!isClickable) return;
                              const localMonth = idx - pf.startMonthOffset;
                              if (localMonth < 0 || localMonth >= pf.totalMonths) return;
                              let phase: "design" | "construction" | "post";
                              let phaseIdx: number;
                              if (localMonth < pf.designDuration) {
                                phase = "design"; phaseIdx = localMonth;
                              } else if (localMonth < pf.designDuration + pf.constructionDuration) {
                                phase = "construction"; phaseIdx = localMonth - pf.designDuration;
                              } else {
                                phase = "post"; phaseIdx = localMonth - pf.designDuration - pf.constructionDuration;
                              }
                              const items: { label: string; section: string; amount: number }[] = [];
                              let expTotal = 0, revTotal = 0;
                              for (const row of pf.rows) {
                                let amount = 0;
                                if (phase === "design") amount = row.designMonths[phaseIdx] || 0;
                                else if (phase === "construction") amount = row.constructionMonths[phaseIdx] || 0;
                                else amount = row.postConstructionMonths[phaseIdx] || 0;
                                if (Math.abs(amount) > 0.5) {
                                  if (row.funder === "escrow" && !row.isRevenue) continue;
                                  items.push({ label: row.label, section: row.section, amount });
                                  if (row.isRevenue) revTotal += amount;
                                  else expTotal += amount;
                                }
                              }
                              setCellDetail({ projectName: pf.name, monthLabel: label, items, totalExpenses: expTotal, totalRevenue: revTotal, net: revTotal - expTotal });
                            }}
                          >
                            {isClickable ? fmt(val) : "–"}
                          </td>
                        );
                      })}
                      <td className="text-center py-2 px-1 text-red-600 font-medium bg-red-50/30">
                        {consolidated.consolidatedExpenses[idx] > 1 ? fmt(consolidated.consolidatedExpenses[idx]) : "–"}
                      </td>
                      <td className="text-center py-2 px-1 text-emerald-600 font-medium bg-emerald-50/30">
                        {consolidated.consolidatedRevenue[idx] > 1 ? fmt(consolidated.consolidatedRevenue[idx]) : "–"}
                      </td>
                      <td className="text-center py-2 px-1 text-blue-600 font-medium bg-blue-50/30">
                        {Math.abs(consolidated.consolidatedNet[idx]) > 1 ? fmt(consolidated.consolidatedNet[idx]) : "–"}
                      </td>
                      <td className={`text-center py-2 px-1 font-bold bg-slate-50/50 ${consolidated.cumulative[idx] >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmt(consolidated.cumulative[idx])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-800 text-white">
                <tr>
                  <td className="sticky right-0 bg-slate-800 py-3 px-3 font-bold">الإجمالي</td>
                  {consolidated.projectFlows.map((pf) => (
                    <td key={pf.id} className="text-center py-3 px-1 font-bold">
                      {fmtM(pf.totalRevenue - pf.totalExpenses)}
                    </td>
                  ))}
                  <td className="text-center py-3 px-1 font-bold text-red-300">{fmtM(totalCostAll)}</td>
                  <td className="text-center py-3 px-1 font-bold text-emerald-300">{fmtM(totalRevenueSales)}</td>
                  <td className="text-center py-3 px-1 font-bold text-blue-300">{fmtM(profit)}</td>
                  <td className="text-center py-3 px-1 font-bold text-amber-300">
                    {fmtM(consolidated.cumulative[consolidated.cumulative.length - 1] || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ CELL DETAIL DIALOG ═══ */}
      <Dialog open={!!cellDetail} onOpenChange={(open) => { if (!open) setCellDetail(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-sm font-bold">
              {cellDetail?.projectName} — {cellDetail?.monthLabel}
            </DialogTitle>
          </DialogHeader>
          {cellDetail && (
            <div className="space-y-3">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-right py-2 px-2 text-slate-600">البند</th>
                      <th className="text-left py-2 px-2 text-slate-600">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cellDetail.items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-2 text-slate-800">{item.label}</td>
                        <td className={`py-2 px-2 text-left font-medium ${item.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(Math.abs(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">المصروفات:</span>
                  <span className="text-red-600 font-bold">{fmt(cellDetail.totalExpenses)}</span>
                </div>
                {cellDetail.totalRevenue > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">الإيرادات:</span>
                    <span className="text-emerald-600 font-bold">{fmt(cellDetail.totalRevenue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span className="text-slate-800">الصافي:</span>
                  <span className={cellDetail.net >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(cellDetail.net)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// SUMMARY CARD COMPONENT
// ═══════════════════════════════════════════
function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3`}>
      <div className="text-[10px] text-slate-500 mb-1 font-medium">{label}</div>
      <div className={`text-lg font-bold ${c.text}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════
// CUMULATIVE CHART (Simple SVG)
// ═══════════════════════════════════════════
function CumulativeChart({ data, labels }: { data: number[]; labels: string[] }) {
  const width = 900;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(Math.abs), 1);
  const minVal = Math.min(...data, 0);
  const range = Math.max(maxVal, Math.abs(minVal)) * 1.1;

  const points = data.map((val, idx) => {
    const x = padding.left + (idx / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH / 2 - (val / range) * (chartH / 2);
    return { x, y };
  });

  const zeroY = padding.top + chartH / 2;
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = pathD + ` L ${points[points.length - 1].x.toFixed(1)} ${zeroY} L ${points[0].x.toFixed(1)} ${zeroY} Z`;

  // Find breakeven point
  let breakevenIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1] < 0 && data[i] >= 0) { breakevenIdx = i; break; }
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 200 }}>
        {/* Zero line */}
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 2" />
        {/* Area fill */}
        <path d={areaD} fill="url(#chartGradient)" opacity={0.3} />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#334155" strokeWidth={2} />
        {/* Breakeven marker */}
        {breakevenIdx >= 0 && (
          <>
            <circle cx={points[breakevenIdx].x} cy={points[breakevenIdx].y} r={4} fill="#10b981" stroke="white" strokeWidth={2} />
            <text x={points[breakevenIdx].x} y={points[breakevenIdx].y - 10} textAnchor="middle" className="text-[9px] fill-emerald-600 font-medium">نقطة التعادل</text>
          </>
        )}
        {/* Peak negative */}
        {peakIdx(data) >= 0 && (
          <>
            <circle cx={points[peakIdx(data)].x} cy={points[peakIdx(data)].y} r={4} fill="#ef4444" stroke="white" strokeWidth={2} />
          </>
        )}
        {/* Y-axis labels */}
        <text x={padding.left - 5} y={padding.top + 4} textAnchor="end" className="text-[9px] fill-slate-400">{fmtM(range)}</text>
        <text x={padding.left - 5} y={zeroY + 3} textAnchor="end" className="text-[9px] fill-slate-400">0</text>
        <text x={padding.left - 5} y={height - padding.bottom + 4} textAnchor="end" className="text-[9px] fill-slate-400">{fmtM(-range)}</text>
        {/* X-axis labels (every 6 months) */}
        {labels.filter((_, i) => i % 6 === 0).map((lbl, i) => {
          const idx = i * 6;
          const x = padding.left + (idx / Math.max(data.length - 1, 1)) * chartW;
          return <text key={i} x={x} y={height - 5} textAnchor="middle" className="text-[8px] fill-slate-400">{lbl}</text>;
        })}
        {/* Gradient def */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#f1f5f9" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function peakIdx(data: number[]): number {
  let minVal = 0;
  let minIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < minVal) { minVal = data[i]; minIdx = i; }
  }
  return minIdx;
}
