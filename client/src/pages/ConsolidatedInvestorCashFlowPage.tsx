import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CashFlowResult,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import {
  dbProjectToInputs,
  dbProjectToRates,
  calculateProjectFormulas,
  calculateCosts,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";
import { buildPricingUnits } from "@/lib/investorCashFlowEngine";
import { calculatePricingFormulas } from "@/lib/projectData";
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
  escrowSurplusMonth3: number;
  escrowSurplusMonth13: number;
  rows: CostRow[]; // raw rows for breakdown popup
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

function getMonthLabel(offset: number, globalStartYear: number, globalStartMonth: number): string {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const absMonth = (globalStartYear * 12 + globalStartMonth - 1) + offset;
  const year = Math.floor(absMonth / 12);
  const monthIdx = absMonth % 12;
  return `${months[monthIdx]} ${year}`;
}

// ═══════════════════════════════════════════
// COMPUTE PROJECT CASH FLOW FOR CONSOLIDATED VIEW
// Uses the shared engine, then flattens to a single timeline
// ═══════════════════════════════════════════
function computeProjectForConsolidated(project: any, scenario: Scenario): ProjectCashFlow {
  // Call the shared engine (same logic as InvestorCashFlowSchedulePage)
  const result = computeInvestorCashFlow(project, scenario);

  const i: ProjectInputs = dbProjectToInputs(project);
  const r: ProjectRates = dbProjectToRates(project);
  const projectFormulas = calculateProjectFormulas(i, r);
  const pricingUnits = buildPricingUnits(project, i);
  const pricingFormulas = calculatePricingFormulas(pricingUnits);
  const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

  const { constructionCost } = projectFormulas;
  const { totalRevenue } = pricingFormulas;
  const { designDuration, constructionDuration, postDuration } = result;

  const isScenario2 = scenario === "offplan_construction";
  const isScenario3 = scenario === "no_offplan";
  const isScenario4 = scenario === "rental";

  // For consolidated view, S1/S2 need 13 months post-completion for escrow recovery
  const consolidatedPostDuration = (isScenario3 || isScenario4) ? postDuration : 13;

  // Flatten expenses from the engine result (design + construction + post)
  const totalMonths = designDuration + constructionDuration + consolidatedPostDuration;
  const monthlyExpenses = new Array(totalMonths).fill(0);
  const monthlyRevenue2 = new Array(totalMonths).fill(0);

  // Design expenses
  for (let idx = 0; idx < designDuration; idx++) {
    monthlyExpenses[idx] = result.designMonthlyTotals[idx];
  }
  // Construction expenses
  for (let idx = 0; idx < constructionDuration; idx++) {
    monthlyExpenses[designDuration + idx] = result.constructionMonthlyTotals[idx];
  }
  // Post expenses (from engine's postMonthlyTotals)
  for (let idx = 0; idx < result.postDuration && idx < consolidatedPostDuration; idx++) {
    monthlyExpenses[designDuration + constructionDuration + idx] = result.postMonthlyTotals[idx];
  }

  // Revenue from engine's revenuePostTotals
  for (let idx = 0; idx < result.postDuration && idx < consolidatedPostDuration; idx++) {
    monthlyRevenue2[designDuration + constructionDuration + idx] = result.revenuePostTotals[idx];
  }

  // ─── Escrow surplus recovery (S1/S2 only) ───
  let escrowSurplusMonth3 = 0;
  let escrowSurplusMonth13 = 0;
  if (!isScenario3 && !isScenario4) {
    // Calculate what escrow received (80% of revenue via S-Curve + 20% deposit in S1)
    const escrowReceived80 = totalRevenue * 0.80;
    const escrowDepositAmt = isScenario2 ? 0 : constructionCost * r.escrowDeposit;
    const totalEscrowIn = escrowReceived80 + escrowDepositAmt;

    // Calculate what escrow paid out
    let escrowPaidOut = 0;
    if (isScenario2) {
      // S2: escrow pays from month 5 (60% S-Curve + 5% + 5% = 70%)
      escrowPaidOut += constructionCost * 0.70;
    } else {
      // S1: escrow pays from month 2 (4%+7%+9%+60%+5%+5% = 90%)
      escrowPaidOut += constructionCost * 0.90;
    }
    // Supervision from escrow
    escrowPaidOut += costs.supervisionFee;
    // Surveyor from escrow
    escrowPaidOut += i.surveyorFee;
    // Gov fees 90% from escrow
    escrowPaidOut += i.govFeesTotal * 0.90;
    // Sales commission from escrow
    escrowPaidOut += costs.salesCommission;
    // RERA auditor from escrow
    escrowPaidOut += i.reraAuditorReport;
    // RERA inspection from escrow
    escrowPaidOut += i.reraInspection;

    const escrowSurplus = totalEscrowIn - escrowPaidOut;
    const retention5pct = totalRevenue * 0.05;

    // Month 3 post: surplus minus 5% retention
    escrowSurplusMonth3 = Math.max(0, escrowSurplus - retention5pct);
    // Month 13 post: the 5% retention
    escrowSurplusMonth13 = retention5pct;

    // Add to revenue timeline
    const postStart = designDuration + constructionDuration;
    if (consolidatedPostDuration > 2) monthlyRevenue2[postStart + 2] += escrowSurplusMonth3;
    if (consolidatedPostDuration > 12) monthlyRevenue2[postStart + 12] += escrowSurplusMonth13;
  }

  const monthlyNet = monthlyRevenue2.map((rev, idx) => rev - monthlyExpenses[idx]);

  // startMonthOffset is calculated in the useMemo below (after we know the global start)
  const startDate = i.startDate || "2026-08";
  const [startYear, startMonth] = startDate.split("-").map(Number);
  // Placeholder offset — will be recalculated in useMemo with actual globalStart
  const startMonthOffset = 0; // overridden below

  return {
    id: project.id,
    name: project.name || "مشروع بدون اسم",
    scenario,
    startMonthOffset,
    designDuration,
    constructionDuration,
    postDuration: consolidatedPostDuration,
    totalMonths,
    monthlyExpenses,
    monthlyRevenue: monthlyRevenue2,
    monthlyNet,
    totalExpenses: monthlyExpenses.reduce((s, v) => s + v, 0),
    totalRevenue: monthlyRevenue2.reduce((s, v) => s + v, 0),
    escrowSurplusMonth3,
    escrowSurplusMonth13,
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

  // Per-project scenario overrides (what-if)
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<number, Scenario>>({});
  // Cell detail popup state
  const [cellDetail, setCellDetail] = useState<CellDetail | null>(null);
  // Per-project start date overrides
  const [startDateOverrides, setStartDateOverrides] = useState<Record<number, string>>({});
  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getScenario = (project: any): Scenario => {
    if (scenarioOverrides[project.id]) return scenarioOverrides[project.id];
    const dbScenario = project.financingScenario || "offplan_escrow";
    if (dbScenario === "rental") return "rental";
    if (dbScenario === "no_offplan") return "no_offplan";
    if (dbScenario === "offplan_construction") return "offplan_construction";
    return "offplan_escrow";
  };

  const consolidated = useMemo(() => {
    if (!projectsQuery.data || projectsQuery.data.length === 0) return null;

    // Step 1: Determine the global start date (earliest project start)
    let globalStartYear = 2099;
    let globalStartMonth = 12;
    for (const proj of projectsQuery.data) {
      const sd = (proj as any).startDate || "2026-08";
      const [y, m] = sd.split("-").map(Number);
      if (y < globalStartYear || (y === globalStartYear && m < globalStartMonth)) {
        globalStartYear = y;
        globalStartMonth = m;
      }
    }

    // Step 2: Compute each project's cash flow and its correct offset
    const projectFlows: ProjectCashFlow[] = projectsQuery.data.map((proj: any) => {
      const scenario = getScenario(proj);
      const pf = computeProjectForConsolidated(proj, scenario);
      // Recalculate startMonthOffset relative to the dynamic global start
      const sd = proj.startDate || "2026-08";
      const [y, m] = sd.split("-").map(Number);
      const correctOffset = (y - globalStartYear) * 12 + (m - globalStartMonth);
      return { ...pf, startMonthOffset: correctOffset };
    });

    // Step 3: Find global timeline range
    let maxGlobalMonth = 0;
    for (const pf of projectFlows) {
      const end = pf.startMonthOffset + pf.totalMonths;
      if (end > maxGlobalMonth) maxGlobalMonth = end;
    }

    // Step 4: Build consolidated arrays
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

    // Step 6: Month labels using dynamic global start
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
  }, [projectsQuery.data, scenarioOverrides]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">يرجى تسجيل الدخول</p>
      </div>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (!consolidated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">لا توجد مشاريع</p>
      </div>
    );
  }

  // ─── Financial Summary (excluding rental/commercial projects from revenue) ───
  const saleProjects = consolidated.projectFlows.filter(pf => pf.scenario !== "rental");
  const rentalProjects = consolidated.projectFlows.filter(pf => pf.scenario === "rental");

  // Total revenue from sale projects only
  const totalRevenueSales = saleProjects.reduce((s, pf) => s + pf.totalRevenue, 0);
  // Total cost = all projects (including rental)
  const totalCostAll = consolidated.projectFlows.reduce((s, pf) => s + pf.totalExpenses, 0);
  // Total cost of sale projects only (for profit calculation)
  const totalCostSales = saleProjects.reduce((s, pf) => s + pf.totalExpenses, 0);
  // Investor capital = what investor actually pays (grandInvestor from engine)
  // We need to get this from the engine result. For now, totalExpenses is what investor pays monthly.
  // In the consolidated view, monthlyExpenses already excludes escrow-funded items (funder !== escrow)
  const investorCapital = saleProjects.reduce((s, pf) => s + pf.totalExpenses, 0);
  // Profit = revenue - cost (sale projects)
  const profit = totalRevenueSales - totalCostSales;
  // Profit % of total cost
  const profitPctCost = totalCostSales > 0 ? (profit / totalCostSales) * 100 : 0;
  // Profit % of investor capital
  const profitPctInvestor = investorCapital > 0 ? (profit / investorCapital) * 100 : 0;
  // Developer share (15% of profit)
  const developerShare = profit * 0.15;
  // Net investor profit after developer share
  const netInvestorProfit = profit - developerShare;
  // Net investor profit % of investor capital
  const netProfitPctInvestor = investorCapital > 0 ? (netInvestorProfit / investorCapital) * 100 : 0;

  // Peak capital (for reference)
  const peakExpense = Math.max(...consolidated.cumulative.map(v => Math.abs(v)));
  const peakMonth = consolidated.cumulative.indexOf(-peakExpense) >= 0
    ? consolidated.monthLabels[consolidated.cumulative.indexOf(-peakExpense)]
    : consolidated.monthLabels[consolidated.cumulative.indexOf(Math.min(...consolidated.cumulative))];

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            التدفقات النقدية المجمّعة — جميع المشاريع
          </h1>
          <p className="text-sm text-gray-500">
            بداية {consolidated.monthLabels[0]} | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Financial Summary */}
        <div className="bg-gradient-to-l from-gray-50 to-white border rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">الملخص المالي (بدون المركز التجاري)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-[10px] text-green-600 mb-1">إجمالي الإيرادات</div>
              <div className="text-base font-bold text-green-700">{fmt(totalRevenueSales)}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-[10px] text-red-600 mb-1">إجمالي التكلفة</div>
              <div className="text-base font-bold text-red-700">{fmt(totalCostSales)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-[10px] text-blue-600 mb-1">الأرباح</div>
              <div className={`text-base font-bold ${profit >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmt(profit)}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-[10px] text-amber-600 mb-1">ذروة رأس المال المطلوب</div>
              <div className="text-base font-bold text-amber-700">{fmt(peakExpense)}</div>
              <div className="text-[9px] text-amber-500">{peakMonth}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border rounded-lg p-2.5">
              <div className="text-[10px] text-gray-500 mb-0.5">رأس مال المستثمر</div>
              <div className="text-sm font-bold text-gray-800">{fmt(investorCapital)}</div>
            </div>
            <div className="bg-white border rounded-lg p-2.5">
              <div className="text-[10px] text-gray-500 mb-0.5">نسبة الربح من التكلفة</div>
              <div className="text-sm font-bold text-gray-800">{profitPctCost.toFixed(1)}%</div>
            </div>
            <div className="bg-white border rounded-lg p-2.5">
              <div className="text-[10px] text-gray-500 mb-0.5">نسبة الربح من رأس المال</div>
              <div className="text-sm font-bold text-gray-800">{profitPctInvestor.toFixed(1)}%</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
              <div className="text-[10px] text-purple-600 mb-0.5">حصة المطور (15%)</div>
              <div className="text-sm font-bold text-purple-700">{fmt(developerShare)}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <div className="text-[10px] text-emerald-600 mb-0.5">صافي ربح المستثمر</div>
              <div className="text-sm font-bold text-emerald-700">{fmt(netInvestorProfit)}</div>
              <div className="text-[9px] text-emerald-500">{netProfitPctInvestor.toFixed(1)}% من رأس المال</div>
            </div>
          </div>
          {rentalProjects.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400 border-t pt-2">
              * المركز التجاري ({rentalProjects.map(p => p.name).join("، ")}) مستبعد من حسبة الأرباح — سيناريو إيجار
            </div>
          )}
        </div>

        {/* Project Scenario & Start Date Selector */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-700">إعدادات المشاريع (السيناريو وتاريخ البداية)</h2>
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
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-1.5 rounded-md disabled:opacity-50 transition-colors"
              >
                {isSaving ? "جاري الحفظ..." : "💾 حفظ التغييرات"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {consolidated.projectFlows.map((pf) => {
              const projData = projectsQuery.data?.find((p: any) => p.id === pf.id);
              const currentStartDate = startDateOverrides[pf.id] || (projData as any)?.startDate || "2026-08";
              return (
                <div key={pf.id} className="flex flex-col gap-1 bg-white rounded p-2 border">
                  <span className="text-xs font-medium text-gray-700 truncate">{pf.name}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={scenarioOverrides[pf.id] || pf.scenario}
                      onChange={(e) => {
                        setScenarioOverrides(prev => ({ ...prev, [pf.id]: e.target.value as Scenario }));
                        setHasChanges(true);
                      }}
                      className="text-[10px] border rounded px-1 py-0.5 bg-white flex-1"
                    >
                      <option value="offplan_escrow">س1 — أوف بلان + ضمان</option>
                      <option value="offplan_construction">س2 — أوف بلان بدون إيداع</option>
                      <option value="no_offplan">س3 — بيع بعد الإنجاز</option>
                      <option value="rental">س4 — تطوير للتأجير</option>
                    </select>
                    <input
                      type="month"
                      value={currentStartDate}
                      onChange={(e) => {
                        setStartDateOverrides(prev => ({ ...prev, [pf.id]: e.target.value }));
                        setHasChanges(true);
                      }}
                      className="text-[10px] border rounded px-1 py-0.5 bg-white w-[110px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Projects Summary Table */}
        <div className="bg-gray-50 border rounded-lg overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-3 border-b">ملخص المشاريع</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-right py-2 px-3 text-gray-600">المشروع</th>
                  <th className="text-center py-2 px-3 text-gray-600">السيناريو</th>
                  <th className="text-center py-2 px-3 text-gray-600">مدة التصميم</th>
                  <th className="text-center py-2 px-3 text-gray-600">مدة الإنشاء</th>
                  <th className="text-left py-2 px-3 text-red-600">المصروفات</th>
                  <th className="text-left py-2 px-3 text-green-600">الإيرادات</th>
                  <th className="text-left py-2 px-3 text-blue-600">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.projectFlows.map((pf) => (
                  <tr key={pf.id} className="border-b hover:bg-white">
                    <td className="py-2 px-3 font-medium text-gray-800">{pf.name}</td>
                    <td className="py-2 px-3 text-center text-gray-500">
                      {pf.scenario === "offplan_escrow" ? "س1" : pf.scenario === "offplan_construction" ? "س2" : pf.scenario === "no_offplan" ? "س3" : "س4"}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-500">{pf.designDuration} شهر</td>
                    <td className="py-2 px-3 text-center text-gray-500">{pf.constructionDuration} شهر</td>
                    <td className="py-2 px-3 text-red-600">{fmt(pf.totalExpenses)}</td>
                    <td className="py-2 px-3 text-green-600">{fmt(pf.totalRevenue)}</td>
                    <td className="py-2 px-3 text-blue-600 font-medium">{fmt(pf.totalRevenue - pf.totalExpenses)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2">
                  <td className="py-2 px-3 text-gray-800">الإجمالي</td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-red-700">{fmt(totalCostAll)}</td>
                  <td className="py-2 px-3 text-green-700">{fmt(totalRevenueSales)}</td>
                  <td className="py-2 px-3 text-blue-700">{fmt(totalRevenueSales - totalCostAll)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Monthly Cash Flow Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-3 border-b">التدفقات النقدية الشهرية</h2>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="sticky right-0 bg-gray-50 z-20 text-right py-2 px-2 border-b text-gray-600 min-w-[100px]">
                    الشهر
                  </th>
                  {consolidated.projectFlows.map((pf) => (
                    <th key={pf.id} className="text-center py-2 px-1 border-b text-gray-600 min-w-[80px]">
                      {pf.name.length > 12 ? pf.name.substring(0, 12) + "…" : pf.name}
                    </th>
                  ))}
                  <th className="text-center py-2 px-1 border-b text-red-600 min-w-[80px] font-bold">المصروفات</th>
                  <th className="text-center py-2 px-1 border-b text-green-600 min-w-[80px] font-bold">الإيرادات</th>
                  <th className="text-center py-2 px-1 border-b text-blue-600 min-w-[80px] font-bold">صافي الشهر</th>
                  <th className="text-center py-2 px-1 border-b text-amber-600 min-w-[90px] font-bold">التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.monthLabels.map((label, idx) => {
                  // Skip empty months
                  const hasData = consolidated.consolidatedExpenses[idx] !== 0 || consolidated.consolidatedRevenue[idx] !== 0;
                  if (!hasData && idx > 0 && Math.abs(consolidated.cumulative[idx] - consolidated.cumulative[idx - 1]) < 1) return null;

                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="sticky right-0 bg-white py-1 px-2 text-gray-700 font-medium border-l text-[10px]">
                        {label}
                      </td>
                      {consolidated.projectFlows.map((pf) => {
                        const val = consolidated.perProjectMonthly[pf.id]?.[idx] || 0;
                        const isClickable = Math.abs(val) > 1;
                        return (
                          <td
                            key={pf.id}
                            className={`text-center py-1 px-1 ${val > 0 ? "text-green-600" : val < 0 ? "text-red-600" : "text-gray-300"} ${isClickable ? "cursor-pointer hover:bg-blue-50 hover:underline" : ""}`}
                            onClick={() => {
                              if (!isClickable) return;
                              // Determine which local month this global idx corresponds to
                              const localMonth = idx - pf.startMonthOffset;
                              if (localMonth < 0 || localMonth >= pf.totalMonths) return;
                              // Determine phase and phase-local index
                              let phase: "design" | "construction" | "post";
                              let phaseIdx: number;
                              if (localMonth < pf.designDuration) {
                                phase = "design";
                                phaseIdx = localMonth;
                              } else if (localMonth < pf.designDuration + pf.constructionDuration) {
                                phase = "construction";
                                phaseIdx = localMonth - pf.designDuration;
                              } else {
                                phase = "post";
                                phaseIdx = localMonth - pf.designDuration - pf.constructionDuration;
                              }
                              // Get breakdown from rows
                              const items: { label: string; section: string; amount: number }[] = [];
                              let expTotal = 0;
                              let revTotal = 0;
                              for (const row of pf.rows) {
                                let amount = 0;
                                if (phase === "design") amount = row.designMonths[phaseIdx] || 0;
                                else if (phase === "construction") amount = row.constructionMonths[phaseIdx] || 0;
                                else amount = row.postConstructionMonths[phaseIdx] || 0;
                                if (Math.abs(amount) > 0.5) {
                                  // Skip escrow-funded items for investor view
                                  if (row.funder === "escrow" && !row.isRevenue) continue;
                                  items.push({ label: row.label, section: row.section, amount });
                                  if (row.isRevenue) revTotal += amount;
                                  else expTotal += amount;
                                }
                              }
                              setCellDetail({
                                projectName: pf.name,
                                monthLabel: label,
                                items,
                                totalExpenses: expTotal,
                                totalRevenue: revTotal,
                                net: revTotal - expTotal,
                              });
                            }}
                          >
                            {isClickable ? fmt(val) : "–"}
                          </td>
                        );
                      })}
                      <td className="text-center py-1 px-1 text-red-600 font-medium">
                        {consolidated.consolidatedExpenses[idx] > 1 ? fmt(consolidated.consolidatedExpenses[idx]) : "–"}
                      </td>
                      <td className="text-center py-1 px-1 text-green-600 font-medium">
                        {consolidated.consolidatedRevenue[idx] > 1 ? fmt(consolidated.consolidatedRevenue[idx]) : "–"}
                      </td>
                      <td className="text-center py-1 px-1 text-blue-600 font-medium">
                        {Math.abs(consolidated.consolidatedNet[idx]) > 1 ? fmt(consolidated.consolidatedNet[idx]) : "–"}
                      </td>
                      <td className={`text-center py-1 px-1 font-bold ${consolidated.cumulative[idx] >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {fmt(consolidated.cumulative[idx])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100">
                <tr className="border-t-2 border-gray-400">
                  <td className="sticky right-0 bg-gray-100 py-2 px-2 font-bold text-gray-800">الإجمالي</td>
                  {consolidated.projectFlows.map((pf) => (
                    <td key={pf.id} className="text-center py-2 px-1 font-bold text-gray-700">
                      {fmt(pf.totalRevenue - pf.totalExpenses)}
                    </td>
                  ))}
                  <td className="text-center py-2 px-1 font-bold text-red-700">{fmt(totalCostAll)}</td>
                  <td className="text-center py-2 px-1 font-bold text-green-700">{fmt(totalRevenueSales)}</td>
                  <td className="text-center py-2 px-1 font-bold text-blue-700">{fmt(totalRevenueSales - totalCostAll)}</td>
                  <td className="text-center py-2 px-1 font-bold text-amber-700">
                    {fmt(consolidated.cumulative[consolidated.cumulative.length - 1] || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

      {/* Cell Detail Popup */}
      <Dialog open={!!cellDetail} onOpenChange={(open) => { if (!open) setCellDetail(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-sm">
              {cellDetail?.projectName} — {cellDetail?.monthLabel}
            </DialogTitle>
          </DialogHeader>
          {cellDetail && (
            <div className="space-y-3">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-right py-1.5 px-2 text-gray-600">البند</th>
                      <th className="text-right py-1.5 px-2 text-gray-600">القسم</th>
                      <th className="text-left py-1.5 px-2 text-gray-600">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cellDetail.items.map((item, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-1.5 px-2 text-gray-800">{item.label}</td>
                        <td className="py-1.5 px-2 text-gray-500 text-[10px]">{item.section}</td>
                        <td className={`py-1.5 px-2 text-left font-medium ${item.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(Math.abs(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">إجمالي المصروفات:</span>
                  <span className="text-red-600 font-medium">{fmt(cellDetail.totalExpenses)}</span>
                </div>
                {cellDetail.totalRevenue > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">إجمالي الإيرادات:</span>
                    <span className="text-green-600 font-medium">{fmt(cellDetail.totalRevenue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-800">الصافي:</span>
                  <span className={cellDetail.net >= 0 ? "text-green-700" : "text-red-700"}>{fmt(cellDetail.net)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
