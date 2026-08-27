import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as BarChart3 } from "lucide-react/dist/esm/icons/chart-column.js";
import { default as Download } from "lucide-react/dist/esm/icons/download.js";
import { default as FileSpreadsheet } from "lucide-react/dist/esm/icons/file-spreadsheet.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FinancialSourceValue } from "@/components/FinancialSourceTrace";
import {
  alignPortfolioMonthlyNetFlows,
  groupCalendarAlignedPortfolio,
  type PortfolioProjectMonthlyNet,
} from "@/lib/portfolioAggregation";
import { formatFullNumber } from "@/lib/numberFormat";
import type { FinancialTraceBreakdown, FinancialTraceLineItem } from "@/lib/financialTraceBreakdown";
import { resolveReturnPath } from "@/lib/returnNavigation";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PERIOD_OPTIONS: Array<{ value: 1 | 3 | 4 | 6; label: string }> = [
  { value: 1, label: "شهري" },
  { value: 3, label: "كل 3 أشهر" },
  { value: 4, label: "كل 4 أشهر" },
  { value: 6, label: "كل 6 أشهر" },
];

const PROJECT_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];

type CapitalProject = {
  projectId: number;
  name: string | null;
  financingScenario: string;
  startDate: string;
  monthDates: string[];
  monthlyFunding: number[];
  monthlyFundingTrace: FinancialTraceBreakdown[];
  costLineItems: FinancialTraceLineItem[];
  totalRevenue: number;
  totalCosts: number;
  grossProfitBeforeDeveloperShare: number;
  feasibilityProjectProfit: number;
  feasibilityInvestorProfit: number;
  requiredCapital: number;
  paidCapital: number;
  remainingCapital: number;
};

function formatAmount(value: number): string {
  return formatFullNumber(Math.abs(value), "0");
}

export function formatCashFlowAmount(value: number): string {
  if (Math.abs(value) <= 0.000001) return "0";
  return `${value > 0 ? "+" : "−"}${formatFullNumber(Math.abs(value), "0")}`;
}

export function calculateFinalCashFlowProfit(monthlyValues: number[]): number {
  return monthlyValues.reduce((sum, value) => sum + value, 0);
}

/**
 * The cash-flow profit is calculated only from the investor movements: payments
 * made before the visible calendar are a debit, then every visible final monthly
 * movement is added with its real sign. The feasibility figure is never copied.
 */
export function calculateCompleteInvestorCashFlowProfit(paidCapital: number, monthlyValues: number[]): number {
  return calculateFinalCashFlowProfit(monthlyValues) - paidCapital;
}

export function calculateProfitReconciliationDifference(cashFlowProfit: number, feasibilityProfit: number): number {
  return cashFlowProfit - feasibilityProfit;
}

export function calculateProfitPercentage(profit: number, basis: number): number {
  return basis > 0 ? (profit / basis) * 100 : 0;
}

export function compactCapitalProjectName(name: string | null): string {
  const value = name || "مشروع";
  if (value.includes("مجان")) return "مجان";
  if (value.includes("الجداف")) return "الجداف";
  if (value.includes("قطعة 1")) return "ند الشبا 1";
  if (value.includes("قطعة 2")) return "ند الشبا 2";
  if (value.includes("الفلل")) return "الفلل";
  return value.replace(/\([^)]*\)/g, "").trim().slice(0, 18);
}

export function transposeLiteralMatrix<T>(matrix: T[][]): T[][] {
  const columnCount = matrix[0]?.length || 0;
  return Array.from({ length: columnCount }, (_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function formatMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatPeriod(startDate: string, endDate: string): string {
  return startDate === endDate ? formatMonth(startDate) : `${formatMonth(startDate)} – ${formatMonth(endDate)}`;
}

function scenarioLabel(scenario: string): string {
  if (scenario === "build_for_sale") return "بناء للبيع";
  if (scenario === "offplan_escrow") return "أوف بلان";
  if (scenario === "offplan_construction") return "أوف بلان — إنشاء";
  return "بدون أوف بلان";
}

export default function V2CapitalPortfolio({ embedded = false, onBack }: { embedded?: boolean; onBack?: () => void }) {
  const [location, navigate] = useLocation();
  const portfolioQuery = trpc.cashFlowSettings.getFinancialStudiesCapitalPortfolio.useQuery(undefined, { staleTime: 0 });
  const investorFlowsQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, { staleTime: 0 });
  const projects = (portfolioQuery.data || []) as CapitalProject[];
  const investorFlowProjects = (investorFlowsQuery.data || []) as PortfolioProjectMonthlyNet[];
  const [selected, setSelected] = useState<number[]>([]);
  const [groupSize, setGroupSize] = useState<1 | 3 | 4 | 6>(1);
  const [viewMode, setViewMode] = useState<"standard" | "transposed">(() => (
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("portfolioView") === "transposed"
      ? "transposed"
      : "standard"
  ));

  useEffect(() => {
    if (projects.length > 0 && selected.length === 0) setSelected(projects.map((project) => project.projectId));
  }, [projects, selected.length]);

  const selectedProjects = useMemo(() => projects.filter((project) => selected.includes(project.projectId)), [projects, selected]);
  const calendarSource = useMemo<PortfolioProjectMonthlyNet[]>(() => selectedProjects.flatMap((project) => {
    const investorFlow = investorFlowProjects.find((flow) => flow.projectId === project.projectId);
    return investorFlow ? [investorFlow] : [];
  }), [selectedProjects, investorFlowProjects]);
  const monthlyPortfolio = useMemo(() => alignPortfolioMonthlyNetFlows(calendarSource), [calendarSource]);
  const groupedPortfolio = useMemo(() => groupCalendarAlignedPortfolio(monthlyPortfolio, groupSize), [monthlyPortfolio, groupSize]);

  const totals = useMemo(() => selectedProjects.reduce((sum, project) => ({
    revenue: sum.revenue + project.totalRevenue,
    cost: sum.cost + project.totalCosts,
    profit: sum.profit + project.grossProfitBeforeDeveloperShare,
    feasibilityInvestorProfit: sum.feasibilityInvestorProfit + project.feasibilityInvestorProfit,
    capital: sum.capital + project.requiredCapital,
    paid: sum.paid + project.paidCapital,
    remaining: sum.remaining + project.remainingCapital,
  }), { revenue: 0, cost: 0, profit: 0, feasibilityInvestorProfit: 0, capital: 0, paid: 0, remaining: 0 }), [selectedProjects]);
  const investorProfitSummary = calculateCompleteInvestorCashFlowProfit(totals.paid, groupedPortfolio.totals);
  const investorProfitOnCost = calculateProfitPercentage(investorProfitSummary, totals.cost);
  const investorProfitOnCapital = calculateProfitPercentage(investorProfitSummary, totals.capital);
  const projectDisplayRows = useMemo(() => selectedProjects.map((project) => {
    const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId);
    const finalCashFlow = flowRow?.values || new Array(groupedPortfolio.periods.length).fill(0);
    const profit = calculateCompleteInvestorCashFlowProfit(project.paidCapital, finalCashFlow);
    const reconciliationDifference = calculateProfitReconciliationDifference(profit, project.feasibilityInvestorProfit);
    return { project, finalCashFlow, profit, reconciliationDifference };
  }), [selectedProjects, groupedPortfolio.rows, groupedPortfolio.periods.length]);
  const totalReconciliationDifference = calculateProfitReconciliationDifference(investorProfitSummary, totals.feasibilityInvestorProfit);
  const originalColumnLabels = useMemo(() => [
    "الخيار", "إجمالي الإيرادات", "التكلفة الكلية", "رأس المال", "المدفوع", "المتبقي", "مدفوع سابقًا",
    ...groupedPortfolio.periods.map((period) => formatPeriod(period.startDate, period.endDate)),
    "الأرباح", "فرق مقابل دراسة الجدوى",
  ], [groupedPortfolio.periods]);
  const originalFormattedMatrix = useMemo(() => [
    ...projectDisplayRows.map(({ project, finalCashFlow, profit, reconciliationDifference }) => [
      scenarioLabel(project.financingScenario),
      formatAmount(project.totalRevenue),
      formatAmount(project.totalCosts),
      formatAmount(project.requiredCapital),
      formatAmount(project.paidCapital),
      formatAmount(project.remainingCapital),
      project.paidCapital === 0 ? "—" : formatCashFlowAmount(-project.paidCapital),
      ...finalCashFlow.map((value) => Math.abs(value) > 0.000001 ? formatCashFlowAmount(value) : "—"),
      formatCashFlowAmount(profit),
      Math.abs(reconciliationDifference) <= 0.5 ? "0" : formatCashFlowAmount(reconciliationDifference),
    ]),
    [
      "",
      formatAmount(totals.revenue),
      formatAmount(totals.cost),
      formatAmount(totals.capital),
      formatAmount(totals.paid),
      formatAmount(totals.remaining),
      totals.paid === 0 ? "—" : formatCashFlowAmount(-totals.paid),
      ...groupedPortfolio.totals.map((value) => Math.abs(value) > 0.000001 ? formatCashFlowAmount(value) : "—"),
      formatCashFlowAmount(investorProfitSummary),
      Math.abs(totalReconciliationDifference) <= 0.5 ? "0" : formatCashFlowAmount(totalReconciliationDifference),
    ],
  ], [projectDisplayRows, groupedPortfolio.totals, totals, investorProfitSummary, totalReconciliationDifference]);
  const literalTransposedMatrix = useMemo(() => transposeLiteralMatrix(originalFormattedMatrix), [originalFormattedMatrix]);

  const toggleProject = (projectId: number) => setSelected((current) => current.includes(projectId)
    ? current.filter((id) => id !== projectId)
    : [...current, projectId]);

  const exportTable = () => {
    if (viewMode === "transposed") {
      const headers = ["البند / الشهر", ...selectedProjects.map((project) => compactCapitalProjectName(project.name)), "الإجمالي"];
      const rows = originalColumnLabels.map((label, index) => [label, ...(literalTransposedMatrix[index] || [])]);
      const cell = (value: string, header = false, total = false) => `<${header ? "th" : "td"}${total ? ' class="total-column"' : ""}>${value}</${header ? "th" : "td"}>`;
      return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>محفظة رأس المال — العرض المعكوس</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}.header{background:#0f172a;color:#fff;padding:14px 18px;border-radius:8px;max-width:980px;margin-right:0}.table-wrap{width:max-content;max-width:980px;margin:16px 0 16px auto;overflow:auto;box-shadow:0 8px 24px rgba(15,23,42,.08)}table{border-collapse:collapse;font-size:10px;width:auto}th{background:#0f172a;color:#fff;padding:7px 10px;border:1px solid #334155;white-space:nowrap}td{padding:6px 10px;border:1px solid #cbd5e1;text-align:center;white-space:nowrap}tr:nth-child(even) td{background:#f8fafc}tr.month-start td{border-top:3px solid #0f172a!important}.total-column{background:linear-gradient(180deg,#0f766e,#115e59)!important;color:#fff!important;font-weight:700;border-right:2px solid #2dd4bf!important;border-left:2px solid #2dd4bf!important}</style></head><body><div class="header"><h1>محفظة رأس المال — العرض المعكوس</h1><p>نسخة من التدفقات الحالية · التجميع: ${PERIOD_OPTIONS.find((item) => item.value === groupSize)?.label}</p></div><div class="table-wrap"><table><thead><tr>${headers.map((value, index) => cell(value, true, index === headers.length - 1)).join("")}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr${rowIndex === 7 ? ' class="month-start"' : ""}>${row.map((value, index) => cell(value, false, index === row.length - 1)).join("")}</tr>`).join("")}</tbody></table></div></body></html>`;
    }
    const headers = ["المشروع", "الخيار", "إجمالي الإيرادات", "التكلفة الكلية", "رأس المال", "المدفوع", "المتبقي", "مدفوع سابقًا", ...groupedPortfolio.periods.map((period) => formatPeriod(period.startDate, period.endDate)), "الأرباح", "فرق مقابل دراسة الجدوى"];
    const detailRows = selectedProjects.map((project) => {
      const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId);
      const finalCashFlow = flowRow?.values || new Array(groupedPortfolio.periods.length).fill(0);
      const cashFlowProfit = calculateCompleteInvestorCashFlowProfit(project.paidCapital, finalCashFlow);
      const reconciliationDifference = calculateProfitReconciliationDifference(cashFlowProfit, project.feasibilityInvestorProfit);
      return [project.name || "", scenarioLabel(project.financingScenario), formatAmount(project.totalRevenue), formatAmount(project.totalCosts), formatAmount(project.requiredCapital), formatAmount(project.paidCapital), formatAmount(project.remainingCapital), project.paidCapital === 0 ? "—" : formatCashFlowAmount(-project.paidCapital), ...finalCashFlow.map((value) => value === 0 ? "—" : formatCashFlowAmount(value)), formatCashFlowAmount(cashFlowProfit), reconciliationDifference === 0 ? "0" : formatCashFlowAmount(reconciliationDifference)];
    });
    const totalCashFlowProfit = calculateCompleteInvestorCashFlowProfit(totals.paid, groupedPortfolio.totals);
    const totalReconciliationDifference = calculateProfitReconciliationDifference(totalCashFlowProfit, totals.feasibilityInvestorProfit);
    const totalRow = ["الإجمالي", "", formatAmount(totals.revenue), formatAmount(totals.cost), formatAmount(totals.capital), formatAmount(totals.paid), formatAmount(totals.remaining), totals.paid === 0 ? "—" : formatCashFlowAmount(-totals.paid), ...groupedPortfolio.totals.map((value) => value === 0 ? "—" : formatCashFlowAmount(value)), formatCashFlowAmount(totalCashFlowProfit), totalReconciliationDifference === 0 ? "0" : formatCashFlowAmount(totalReconciliationDifference)];
    const cell = (value: string, header = false) => `<${header ? "th" : "td"}>${value}</${header ? "th" : "td"}>`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير محفظة رأس المال</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}.header{background:#0f172a;color:#fff;padding:16px 20px;border-radius:8px}.header p{color:#cbd5e1;font-size:12px}.summary{background:#f8fafc;border:2px solid #0f172a;border-radius:8px;padding:16px;margin:16px 0}.cards{display:flex;gap:10px}.card{flex:1;background:#fff;border-right:4px solid #0ea5e9;padding:10px;border-radius:4px}.card b{display:block;font-size:16px;margin-top:4px}.card small{display:block;margin-top:4px;font-size:9px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#0f172a;color:#fff;padding:7px 4px;border:1px solid #334155}td{padding:6px 4px;border:1px solid #cbd5e1;text-align:center;white-space:nowrap}tr:nth-child(even) td{background:#f8fafc}.total td{background:#1e293b!important;color:#fff;font-weight:700}@media print{body{padding:8px}}</style></head><body><div class="header"><h1>تقرير محفظة رأس المال</h1><p>من مخرجات الدراسات والتخطيط المالي · التجميع: ${PERIOD_OPTIONS.find((item) => item.value === groupSize)?.label}</p></div><div class="summary"><h2>الملخص الإحصائي</h2><div class="cards"><div class="card">إجمالي الإيرادات<b>${formatAmount(totals.revenue)}</b></div><div class="card">إجمالي التكلفة<b>${formatAmount(totals.cost)}</b></div><div class="card">الأرباح<b>${formatAmount(investorProfitSummary)}</b><small>من التكلفة ${formatFullNumber(investorProfitOnCost, "2")}% · من رأس المال ${formatFullNumber(investorProfitOnCapital, "2")}%</small></div><div class="card">رأس المال<b>${formatAmount(totals.capital)}</b><small>مدفوع ${formatAmount(totals.paid)} · متبقٍ ${formatAmount(totals.remaining)}</small></div></div></div><table><thead><tr>${headers.map((value) => cell(value, true)).join("")}</tr></thead><tbody>${detailRows.map((row) => `<tr>${row.map((value) => cell(value)).join("")}</tr>`).join("")}<tr class="total">${totalRow.map((value) => cell(value)).join("")}</tr></tbody></table></body></html>`;
  };

  const exportHtml = () => {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(exportTable());
    reportWindow.document.close();
  };

  const exportExcel = () => {
    const blob = new Blob([`\ufeff${exportTable()}`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = viewMode === "transposed" ? "محفظة-رأس-المال-العرض-المعكوس.xls" : "تقرير-محفظة-رأس-المال.xls";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (portfolioQuery.isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">جاري تحميل محفظة رأس المال...</div>;
  if (projects.length === 0) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">لا توجد مشاريع استثمارية مؤهلة للعرض</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4" dir="rtl">
      <div className="max-w-[1800px] mx-auto">
        <div className="fs-card fs-card-violet px-5 py-4 text-slate-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {!embedded && <button onClick={() => onBack ? onBack() : navigate(resolveReturnPath(location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search, "/bateekha"))} className="mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-teal-300 bg-teal-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-teal-500" aria-label="العودة إلى الصفحة السابقة"><ArrowRight className="h-4 w-4" />العودة إلى الصفحة السابقة</button>}
            <div><h1 className="text-base font-extrabold">تقرير محفظة رأس المال</h1><p className="mt-1 text-[11px] text-slate-600">من مخرجات الدراسات والتخطيط المالي — يستثني مشاريع البناء للتأجير من مؤشرات الإيرادات والأرباح</p></div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600"><button onClick={exportExcel} className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white/80 px-2.5 py-1.5 font-bold hover:bg-violet-50"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</button><button onClick={exportHtml} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 font-bold text-white hover:bg-teal-500"><Download className="h-3.5 w-3.5" />HTML</button><Landmark className="h-4 w-4 text-sky-600" />{selectedProjects.length} مشاريع استثمارية</div>
        </div>

        <section className="fs-card fs-card-blue mt-4 p-4">
          <h2 className="border-b-2 border-slate-300 pb-2 text-sm font-extrabold text-slate-900">الملخص الإحصائي</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="fs-card fs-card-emerald rounded-md p-3"><p className="text-[10px] text-slate-500">إجمالي الإيرادات</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-revenue" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "إجمالي الإيرادات", rule: "مجموع الإيرادات المعتمدة من محرك تدفق المستثمر للمشاريع المختارة.", value: totals.revenue, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.totalRevenue })) }}>{formatAmount(totals.revenue)}</FinancialSourceValue></p><span className="text-[9px] text-slate-400">درهم</span></div>
            <div className="fs-card fs-card-orange rounded-md p-3"><p className="text-[10px] text-slate-500">إجمالي التكلفة</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-cost" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "إجمالي التكلفة", rule: "مجموع صفوف التكلفة غير الإيرادية وغير التحويلية من تدفقات المستثمر الفردية.", value: totals.cost, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.totalCosts })) }}>{formatAmount(totals.cost)}</FinancialSourceValue></p><span className="text-[9px] text-slate-400">درهم</span></div>
            <div className="fs-card fs-card-cyan rounded-md p-3"><p className="text-[10px] text-slate-500">الأرباح</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-profit" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "صافي أرباح المستثمر", rule: "مدفوع سابقًا وجميع صافي الحركات الشهرية المنسوخة من تدفقات المستثمر؛ بعد حصة كومو.", value: investorProfitSummary, contributors: selectedProjects.map((project) => { const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId); return { name: project.name || "مشروع", value: calculateCompleteInvestorCashFlowProfit(project.paidCapital, flowRow?.values || []) }; }) }}>{formatAmount(investorProfitSummary)}</FinancialSourceValue></p><div className="mt-1 flex gap-2 text-[9px]"><span className="text-cyan-700">من التكلفة {formatFullNumber(investorProfitOnCost, "2")}%</span><span className="text-violet-700">من رأس المال {formatFullNumber(investorProfitOnCapital, "2")}%</span></div></div>
            <div className="fs-card fs-card-rose rounded-md p-3"><p className="text-[10px] text-slate-500">رأس المال الكلي</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-required" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "رأس المال المطلوب", rule: "ذروة رأس المال الصافي لكل مشروع بعد العوائد، مجمعة للمشاريع المختارة.", value: totals.capital, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.requiredCapital })) }}>{formatAmount(totals.capital)}</FinancialSourceValue></p><div className="mt-1 flex gap-2 text-[9px]"><span className="text-emerald-700">مدفوع {formatAmount(totals.paid)}</span><span className="text-rose-700">متبقٍ {formatAmount(totals.remaining)}</span></div></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {projects.map((project, index) => {
                const active = selected.includes(project.projectId);
                const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
                return <button key={project.projectId} onClick={() => toggleProject(project.projectId)} className={`inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-[11px] font-bold ${active ? "bg-white" : "border-slate-200 bg-slate-100 text-slate-400"}`} style={active ? { borderColor: color, color } : undefined}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: active ? color : "#cbd5e1" }} />{project.name}</button>;
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-md border border-teal-300 bg-white p-0.5">
                <button onClick={() => setViewMode("standard")} className={`rounded px-3 py-1.5 text-[10px] font-bold ${viewMode === "standard" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-teal-50"}`}>العرض الحالي</button>
                <button onClick={() => setViewMode("transposed")} className={`rounded px-3 py-1.5 text-[10px] font-bold ${viewMode === "transposed" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-teal-50"}`}>العرض المعكوس</button>
              </div>
              <div className="flex items-center rounded-md border border-slate-300 bg-white p-0.5">
                {PERIOD_OPTIONS.map((option) => <button key={option.value} onClick={() => setGroupSize(option.value)} className={`rounded px-3 py-1.5 text-[10px] font-bold ${groupSize === option.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{option.label}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section className="fs-card fs-card-violet mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><BarChart3 className="h-4 w-4 text-slate-700" /><h2 className="text-sm font-extrabold text-slate-900">{viewMode === "standard" ? "تفاصيل رأس المال حسب المشروع" : "تفاصيل التدفقات حسب الشهر والمشروع"}</h2></div>
          <div className={`${viewMode === "standard" ? "block" : "hidden"} overflow-x-auto border-y-2 border-slate-400`}>
            <table className="w-max min-w-[860px] border-separate border-spacing-0 text-[11px]" style={{ minWidth: 730 + groupedPortfolio.periods.length * 84 }}>
              <thead><tr className="bg-slate-900 text-white">
                <th className="sticky right-0 z-20 min-w-[155px] border-l border-slate-600 bg-slate-900 px-3 py-2.5 text-right font-extrabold">المشروع</th>
                <th className="min-w-[70px] border-l border-slate-600 px-2 py-2.5 font-extrabold">الخيار</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">إجمالي الإيرادات</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">التكلفة الكلية</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">رأس المال</th>
                <th className="min-w-[78px] border-l border-slate-600 px-2 py-2.5 font-extrabold">المدفوع</th>
                <th className="min-w-[78px] border-l border-slate-600 px-2 py-2.5 font-extrabold">المتبقي</th>
                <th className="min-w-[88px] border-l border-slate-600 bg-slate-800 px-2 py-2.5 font-extrabold">مدفوع سابقًا</th>
                {groupedPortfolio.periods.map((period) => <th key={period.startDate} className="min-w-[84px] border-l border-slate-600 px-2 py-2.5 font-extrabold">{formatPeriod(period.startDate, period.endDate)}</th>)}
                <th className="min-w-[96px] border-r-2 border-slate-400 bg-slate-800 px-2 py-2.5 font-extrabold">الأرباح</th>
                <th className="min-w-[104px] border-r-2 border-slate-400 bg-slate-800 px-2 py-2.5 font-extrabold">فرق مقابل دراسة الجدوى</th>
              </tr></thead>
              <tbody>
                {selectedProjects.map((project, index) => {
                  const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId);
                  const finalCashFlow = flowRow?.values || new Array(groupedPortfolio.periods.length).fill(0);
                  const profit = calculateCompleteInvestorCashFlowProfit(project.paidCapital, finalCashFlow);
                  const reconciliationDifference = calculateProfitReconciliationDifference(profit, project.feasibilityInvestorProfit);
                  return <tr key={project.projectId} className="border-b border-slate-300 even:bg-slate-50">
                    <td className="sticky right-0 z-10 border-l border-slate-300 bg-inherit px-3 py-2 text-right font-extrabold text-slate-900"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }} />{project.name}</span></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-700">{scenarioLabel(project.financingScenario)}</td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-emerald-700"><FinancialSourceValue testId={`capital-trace-revenue-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "إجمالي الإيرادات", rule: "إجمالي الإيراد من محرك تدفق المستثمر وتسعير الوحدات المعتمد.", value: project.totalRevenue }}>{formatAmount(project.totalRevenue)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-800"><FinancialSourceValue testId={`capital-trace-cost-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "التكلفة الكلية", rule: "جمع صفوف تكلفة تدفق المستثمر؛ لا يشمل التحويلات أو صفوف الإيراد أو حصة الربح.", value: project.totalCosts, movement: "expense", expenses: project.costLineItems }}>{formatAmount(project.totalCosts)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-extrabold text-slate-950"><FinancialSourceValue testId={`capital-trace-required-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "رأس المال المطلوب", rule: "الحد الأدنى التراكمي لصافي المستثمر، أي ذروة التمويل بعد العوائد.", value: project.requiredCapital }}>{formatAmount(project.requiredCapital)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-emerald-700">{formatAmount(project.paidCapital)}</td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-rose-700">{formatAmount(project.remainingCapital)}</td>
                    <td className="border-l border-slate-200 bg-rose-50 px-2 py-2 text-center font-bold text-rose-700">{project.paidCapital > 0 ? <FinancialSourceValue testId={`capital-trace-paid-before-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "مدفوع سابقًا", rule: "المدفوع من المستثمر قبل بداية التسلسل الشهري الظاهر؛ يدخل كحركة سالبة عند احتساب الأرباح النقدية.", value: -project.paidCapital, movement: "expense" }}>{formatCashFlowAmount(-project.paidCapital)}</FinancialSourceValue> : "—"}</td>
                    {finalCashFlow.map((value, monthIndex) => { const detail = flowRow?.monthlyTrace?.[monthIndex]; const tone = value < -0.000001 ? "bg-rose-50 text-rose-700" : value > 0.000001 ? "bg-emerald-50 text-emerald-700" : "text-slate-300"; return <td key={monthIndex} className={`border-l border-slate-200 px-2 py-2 text-center font-bold ${tone}`}>{Math.abs(value) > 0.000001 ? <FinancialSourceValue testId={`capital-trace-final-flow-${project.projectId}-${monthIndex}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "صافي تدفقات المستثمر", period: formatPeriod(groupedPortfolio.periods[monthIndex].startDate, groupedPortfolio.periods[monthIndex].endDate), rule: "السطر النهائي من تقرير تدفقات المستثمر للمشروع: الكريديت ناقص الديبت في الفترة نفسها.", value, expenses: detail?.expenses, receipts: detail?.receipts }}>{formatCashFlowAmount(value)}</FinancialSourceValue> : "—"}</td>; })}
                    <td className="border-r-2 border-slate-400 bg-slate-100 px-2 py-2 text-center font-extrabold text-slate-950">{formatCashFlowAmount(profit)}</td>
                    <td className={`border-r-2 border-slate-400 px-2 py-2 text-center font-extrabold ${Math.abs(reconciliationDifference) <= 0.5 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{Math.abs(reconciliationDifference) <= 0.5 ? "0" : formatCashFlowAmount(reconciliationDifference)}</td>
                  </tr>;
                })}
                <tr className="bg-slate-800 text-white">
                  <td className="sticky right-0 z-20 border-l border-slate-600 bg-slate-800 px-3 py-2.5 text-right font-extrabold">الإجمالي</td><td className="border-l border-slate-600" />
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-emerald-300">{formatAmount(totals.revenue)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold">{formatAmount(totals.cost)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold">{formatAmount(totals.capital)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-emerald-300">{formatAmount(totals.paid)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-rose-300">{formatAmount(totals.remaining)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-rose-300">{totals.paid === 0 ? "—" : formatCashFlowAmount(-totals.paid)}</td>
                  {groupedPortfolio.totals.map((value, index) => <td key={index} className={`border-l border-slate-700 px-2 py-2 text-center font-extrabold ${value < -0.000001 ? "text-rose-300" : value > 0.000001 ? "text-emerald-300" : "text-slate-500"}`}>{Math.abs(value) > 0.000001 ? formatCashFlowAmount(value) : "—"}</td>)}
                  {(() => {
                    const totalCashFlowProfit = calculateCompleteInvestorCashFlowProfit(totals.paid, groupedPortfolio.totals);
                    const totalReconciliationDifference = calculateProfitReconciliationDifference(totalCashFlowProfit, totals.feasibilityInvestorProfit);
                    return <><td className="border-r-2 border-slate-400 bg-slate-700 px-2 py-2.5 text-center font-extrabold">{formatCashFlowAmount(totalCashFlowProfit)}</td><td className={`border-r-2 border-slate-400 px-2 py-2.5 text-center font-extrabold ${Math.abs(totalReconciliationDifference) <= 0.5 ? "bg-emerald-800 text-emerald-100" : "bg-rose-800 text-rose-100"}`}>{Math.abs(totalReconciliationDifference) <= 0.5 ? "0" : formatCashFlowAmount(totalReconciliationDifference)}</td></>;
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
          {viewMode === "transposed" && <div className="overflow-x-auto border-y-2 border-slate-400 bg-linear-to-b from-slate-50 to-white py-3">
            <div className="ml-auto mr-0 w-max max-w-full pr-3 pl-0">
              <table className="w-max border-separate border-spacing-0 overflow-hidden rounded-lg text-[11px] shadow-[0_10px_28px_rgba(15,23,42,0.12)]" data-testid="capital-portfolio-transposed">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="min-w-[122px] border-l border-slate-600 px-3 py-2.5 text-right font-extrabold">البند / الشهر</th>
                  {selectedProjects.map((project, index) => <th key={project.projectId} className="min-w-[108px] border-l border-slate-600 px-2 py-2.5 font-extrabold"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }} />{compactCapitalProjectName(project.name)}</span></th>)}
                  <th className="relative -translate-y-0.5 min-w-[148px] border-x-2 border-t-2 border-teal-300 bg-linear-to-b from-teal-700 to-emerald-800 px-3 py-3 font-extrabold text-white shadow-sm">الإجمالي</th>
                </tr></thead>
                <tbody>
                  {originalColumnLabels.map((label, rowIndex) => {
                    const rowValues = literalTransposedMatrix[rowIndex] || [];
                    const isLastRow = rowIndex === originalColumnLabels.length - 1;
                    const isFirstMonthlyRow = rowIndex === 7;
                    const dividerClass = isFirstMonthlyRow ? "border-t-[3px] border-t-slate-800" : "";
                    return <tr key={label} className={isLastRow ? "bg-slate-800 text-white" : isFirstMonthlyRow ? "bg-slate-50" : "even:bg-slate-50"}>
                      <td className={`border-b border-l px-3 py-2 text-right font-extrabold ${dividerClass} ${isLastRow ? "border-slate-600 bg-slate-800 text-white" : isFirstMonthlyRow ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-slate-100 text-slate-800"}`}>{label}</td>
                      {rowValues.slice(0, -1).map((display, projectIndex) => {
                        const tone = display.startsWith("−") ? "bg-rose-50 text-rose-700" : display.startsWith("+") ? "bg-emerald-50 text-emerald-700" : label === "إجمالي الإيرادات" || label === "المدفوع" ? "text-emerald-700" : label === "المتبقي" || label === "مدفوع سابقًا" ? "text-rose-700" : "text-slate-800";
                        return <td key={`${label}-${selectedProjects[projectIndex]?.projectId}`} className={`border-b border-l px-2 py-2 text-center font-bold tabular-nums ${dividerClass} ${isLastRow ? "border-slate-600 text-white" : `border-slate-200 ${tone}`}`}>{display || "—"}</td>;
                      })}
                      <td className={`relative -translate-y-0.5 min-w-[148px] border-x-2 border-b border-teal-300 bg-linear-to-b from-teal-700 to-emerald-800 px-3 py-2.5 text-center font-extrabold text-white tabular-nums shadow-sm ${dividerClass}`}>{rowValues.at(-1) || "—"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>}
          <div className="flex gap-5 px-4 py-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" />دفعات مستقبلية مطلوبة من المستثمر</span><span>مشاريع البناء للتأجير مستثناة من هذا التقرير الاستثماري</span></div>
        </section>
      </div>
    </div>
  );
}
