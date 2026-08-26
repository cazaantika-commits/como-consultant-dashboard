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
  const [, navigate] = useLocation();
  const portfolioQuery = trpc.cashFlowSettings.getFinancialStudiesCapitalPortfolio.useQuery(undefined, { staleTime: 0 });
  const investorFlowsQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, { staleTime: 0 });
  const projects = (portfolioQuery.data || []) as CapitalProject[];
  const investorFlowProjects = (investorFlowsQuery.data || []) as PortfolioProjectMonthlyNet[];
  const [selected, setSelected] = useState<number[]>([]);
  const [groupSize, setGroupSize] = useState<1 | 3 | 4 | 6>(1);

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
    capital: sum.capital + project.requiredCapital,
    paid: sum.paid + project.paidCapital,
    remaining: sum.remaining + project.remainingCapital,
  }), { revenue: 0, cost: 0, profit: 0, capital: 0, paid: 0, remaining: 0 }), [selectedProjects]);

  const toggleProject = (projectId: number) => setSelected((current) => current.includes(projectId)
    ? current.filter((id) => id !== projectId)
    : [...current, projectId]);

  const exportTable = () => {
    const headers = ["المشروع", "الخيار", "إجمالي الإيرادات", "التكلفة الكلية", "رأس المال", "المدفوع", "المتبقي", ...groupedPortfolio.periods.map((period) => formatPeriod(period.startDate, period.endDate)), "إجمالي التمويل المطلوب"];
    const detailRows = selectedProjects.map((project) => {
      const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId);
      const finalCashFlow = flowRow?.values || new Array(groupedPortfolio.periods.length).fill(0);
      return [project.name || "", scenarioLabel(project.financingScenario), formatAmount(project.totalRevenue), formatAmount(project.totalCosts), formatAmount(project.requiredCapital), formatAmount(project.paidCapital), formatAmount(project.remainingCapital), ...finalCashFlow.map((value) => value === 0 ? "—" : formatCashFlowAmount(value)), formatCashFlowAmount(finalCashFlow.reduce((sum, value) => sum + value, 0))];
    });
    const totalRow = ["الإجمالي", "", formatAmount(totals.revenue), formatAmount(totals.cost), formatAmount(totals.capital), formatAmount(totals.paid), formatAmount(totals.remaining), ...groupedPortfolio.totals.map((value) => value === 0 ? "—" : formatCashFlowAmount(value)), formatCashFlowAmount(groupedPortfolio.totals.reduce((sum, value) => sum + value, 0))];
    const cell = (value: string, header = false) => `<${header ? "th" : "td"}>${value}</${header ? "th" : "td"}>`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير محفظة رأس المال</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}.header{background:#0f172a;color:#fff;padding:16px 20px;border-radius:8px}.header p{color:#cbd5e1;font-size:12px}.summary{background:#f8fafc;border:2px solid #0f172a;border-radius:8px;padding:16px;margin:16px 0}.cards{display:flex;gap:10px}.card{flex:1;background:#fff;border-right:4px solid #0ea5e9;padding:10px;border-radius:4px}.card b{display:block;font-size:16px;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#0f172a;color:#fff;padding:7px 4px;border:1px solid #334155}td{padding:6px 4px;border:1px solid #cbd5e1;text-align:center;white-space:nowrap}tr:nth-child(even) td{background:#f8fafc}.total td{background:#1e293b!important;color:#fff;font-weight:700}@media print{body{padding:8px}}</style></head><body><div class="header"><h1>تقرير محفظة رأس المال</h1><p>من مخرجات الدراسات والتخطيط المالي · التجميع: ${PERIOD_OPTIONS.find((item) => item.value === groupSize)?.label}</p></div><div class="summary"><h2>الملخص الإحصائي</h2><div class="cards"><div class="card">إجمالي الإيرادات<b>${formatAmount(totals.revenue)}</b></div><div class="card">إجمالي التكلفة<b>${formatAmount(totals.cost)}</b></div><div class="card">الأرباح قبل حصة المطور<b>${formatAmount(totals.profit)}</b></div><div class="card">رأس المال<b>${formatAmount(totals.capital)}</b><small>مدفوع ${formatAmount(totals.paid)} · متبقٍ ${formatAmount(totals.remaining)}</small></div></div></div><table><thead><tr>${headers.map((value) => cell(value, true)).join("")}</tr></thead><tbody>${detailRows.map((row) => `<tr>${row.map((value) => cell(value)).join("")}</tr>`).join("")}<tr class="total">${totalRow.map((value) => cell(value)).join("")}</tr></tbody></table></body></html>`;
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
    anchor.download = "تقرير-محفظة-رأس-المال.xls";
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
            {!embedded && <button onClick={() => onBack ? onBack() : navigate("/bateekha")} className="mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-teal-300 bg-teal-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-teal-500" aria-label="العودة إلى دليل الدراسات"><ArrowRight className="h-4 w-4" />العودة إلى دليل الدراسات</button>}
            <div><h1 className="text-base font-extrabold">تقرير محفظة رأس المال</h1><p className="mt-1 text-[11px] text-slate-600">من مخرجات الدراسات والتخطيط المالي — يستثني مشاريع البناء للتأجير من مؤشرات الإيرادات والأرباح</p></div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600"><button onClick={exportExcel} className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white/80 px-2.5 py-1.5 font-bold hover:bg-violet-50"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</button><button onClick={exportHtml} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 font-bold text-white hover:bg-teal-500"><Download className="h-3.5 w-3.5" />HTML</button><Landmark className="h-4 w-4 text-sky-600" />{selectedProjects.length} مشاريع استثمارية</div>
        </div>

        <section className="fs-card fs-card-blue mt-4 p-4">
          <h2 className="border-b-2 border-slate-300 pb-2 text-sm font-extrabold text-slate-900">الملخص الإحصائي</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="fs-card fs-card-emerald rounded-md p-3"><p className="text-[10px] text-slate-500">إجمالي الإيرادات</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-revenue" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "إجمالي الإيرادات", rule: "مجموع الإيرادات المعتمدة من محرك تدفق المستثمر للمشاريع المختارة.", value: totals.revenue, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.totalRevenue })) }}>{formatAmount(totals.revenue)}</FinancialSourceValue></p><span className="text-[9px] text-slate-400">درهم</span></div>
            <div className="fs-card fs-card-orange rounded-md p-3"><p className="text-[10px] text-slate-500">إجمالي التكلفة</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-cost" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "إجمالي التكلفة", rule: "مجموع صفوف التكلفة غير الإيرادية وغير التحويلية من تدفقات المستثمر الفردية.", value: totals.cost, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.totalCosts })) }}>{formatAmount(totals.cost)}</FinancialSourceValue></p><span className="text-[9px] text-slate-400">درهم</span></div>
            <div className="fs-card fs-card-cyan rounded-md p-3"><p className="text-[10px] text-slate-500">الأرباح قبل حصة المطور</p><p className="mt-1 text-lg font-extrabold text-slate-900"><FinancialSourceValue testId="capital-trace-summary-profit" trace={{ report: "محفظة رأس المال", project: "المشاريع الاستثمارية الخمسة", row: "الأرباح قبل حصة المطور", rule: "الإيراد ناقص التكلفة من المصدر المالي الموحد لكل مشروع.", value: totals.profit, contributors: selectedProjects.map((project) => ({ name: project.name || "مشروع", value: project.grossProfitBeforeDeveloperShare })) }}>{formatAmount(totals.profit)}</FinancialSourceValue></p><span className="text-[9px] text-slate-400">درهم</span></div>
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
            <div className="flex items-center rounded-md border border-slate-300 bg-white p-0.5">
              {PERIOD_OPTIONS.map((option) => <button key={option.value} onClick={() => setGroupSize(option.value)} className={`rounded px-3 py-1.5 text-[10px] font-bold ${groupSize === option.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{option.label}</button>)}
            </div>
          </div>
        </section>

        <section className="fs-card fs-card-violet mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><BarChart3 className="h-4 w-4 text-slate-700" /><h2 className="text-sm font-extrabold text-slate-900">تفاصيل رأس المال حسب المشروع</h2></div>
          <div className="overflow-x-auto border-y-2 border-slate-400">
            <table className="w-max min-w-[860px] border-separate border-spacing-0 text-[11px]" style={{ minWidth: 730 + groupedPortfolio.periods.length * 84 }}>
              <thead><tr className="bg-slate-900 text-white">
                <th className="sticky right-0 z-20 min-w-[155px] border-l border-slate-600 bg-slate-900 px-3 py-2.5 text-right font-extrabold">المشروع</th>
                <th className="min-w-[70px] border-l border-slate-600 px-2 py-2.5 font-extrabold">الخيار</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">إجمالي الإيرادات</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">التكلفة الكلية</th>
                <th className="min-w-[88px] border-l border-slate-600 px-2 py-2.5 font-extrabold">رأس المال</th>
                <th className="min-w-[78px] border-l border-slate-600 px-2 py-2.5 font-extrabold">المدفوع</th>
                <th className="min-w-[78px] border-l border-slate-600 px-2 py-2.5 font-extrabold">المتبقي</th>
                {groupedPortfolio.periods.map((period) => <th key={period.startDate} className="min-w-[84px] border-l border-slate-600 px-2 py-2.5 font-extrabold">{formatPeriod(period.startDate, period.endDate)}</th>)}
                <th className="min-w-[96px] border-r-2 border-slate-400 bg-slate-800 px-2 py-2.5 font-extrabold">إجمالي التمويل المطلوب</th>
              </tr></thead>
              <tbody>
                {selectedProjects.map((project, index) => {
                  const flowRow = groupedPortfolio.rows.find((row) => row.projectId === project.projectId);
                  const finalCashFlow = flowRow?.values || new Array(groupedPortfolio.periods.length).fill(0);
                  const cashFlowTotal = finalCashFlow.reduce((sum, value) => sum + value, 0);
                  return <tr key={project.projectId} className="border-b border-slate-300 even:bg-slate-50">
                    <td className="sticky right-0 z-10 border-l border-slate-300 bg-inherit px-3 py-2 text-right font-extrabold text-slate-900"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }} />{project.name}</span></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-700">{scenarioLabel(project.financingScenario)}</td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-emerald-700"><FinancialSourceValue testId={`capital-trace-revenue-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "إجمالي الإيرادات", rule: "إجمالي الإيراد من محرك تدفق المستثمر وتسعير الوحدات المعتمد.", value: project.totalRevenue }}>{formatAmount(project.totalRevenue)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-800"><FinancialSourceValue testId={`capital-trace-cost-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "التكلفة الكلية", rule: "جمع صفوف تكلفة تدفق المستثمر؛ لا يشمل التحويلات أو صفوف الإيراد أو حصة الربح.", value: project.totalCosts, movement: "expense", expenses: project.costLineItems }}>{formatAmount(project.totalCosts)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-extrabold text-slate-950"><FinancialSourceValue testId={`capital-trace-required-${project.projectId}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "رأس المال المطلوب", rule: "الحد الأدنى التراكمي لصافي المستثمر، أي ذروة التمويل بعد العوائد.", value: project.requiredCapital }}>{formatAmount(project.requiredCapital)}</FinancialSourceValue></td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-emerald-700">{formatAmount(project.paidCapital)}</td>
                    <td className="border-l border-slate-200 px-2 py-2 text-center font-bold text-rose-700">{formatAmount(project.remainingCapital)}</td>
                    {finalCashFlow.map((value, monthIndex) => { const detail = flowRow?.monthlyTrace?.[monthIndex]; const tone = value < -0.000001 ? "bg-rose-50 text-rose-700" : value > 0.000001 ? "bg-emerald-50 text-emerald-700" : "text-slate-300"; return <td key={monthIndex} className={`border-l border-slate-200 px-2 py-2 text-center font-bold ${tone}`}>{Math.abs(value) > 0.000001 ? <FinancialSourceValue testId={`capital-trace-final-flow-${project.projectId}-${monthIndex}`} trace={{ report: "محفظة رأس المال", project: project.name || "مشروع", row: "صافي تدفقات المستثمر", period: formatPeriod(groupedPortfolio.periods[monthIndex].startDate, groupedPortfolio.periods[monthIndex].endDate), rule: "السطر النهائي من تقرير تدفقات المستثمر للمشروع: الكريديت ناقص الديبت في الفترة نفسها.", value, expenses: detail?.expenses, receipts: detail?.receipts }}>{formatCashFlowAmount(value)}</FinancialSourceValue> : "—"}</td>; })}
                    <td className="border-r-2 border-slate-400 bg-slate-100 px-2 py-2 text-center font-extrabold text-slate-950">{formatCashFlowAmount(cashFlowTotal)}</td>
                  </tr>;
                })}
                <tr className="bg-slate-800 text-white">
                  <td className="sticky right-0 z-20 border-l border-slate-600 bg-slate-800 px-3 py-2.5 text-right font-extrabold">الإجمالي</td><td className="border-l border-slate-600" />
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-emerald-300">{formatAmount(totals.revenue)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold">{formatAmount(totals.cost)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold">{formatAmount(totals.capital)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-emerald-300">{formatAmount(totals.paid)}</td>
                  <td className="border-l border-slate-700 px-2 py-2 text-center font-extrabold text-rose-300">{formatAmount(totals.remaining)}</td>
                  {groupedPortfolio.totals.map((value, index) => <td key={index} className={`border-l border-slate-700 px-2 py-2 text-center font-extrabold ${value < -0.000001 ? "text-rose-300" : value > 0.000001 ? "text-emerald-300" : "text-slate-500"}`}>{Math.abs(value) > 0.000001 ? formatCashFlowAmount(value) : "—"}</td>)}
                  <td className="border-r-2 border-slate-400 bg-slate-700 px-2 py-2.5 text-center font-extrabold">{formatCashFlowAmount(groupedPortfolio.totals.reduce((sum, value) => sum + value, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-5 px-4 py-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" />دفعات مستقبلية مطلوبة من المستثمر</span><span>مشاريع البناء للتأجير مستثناة من هذا التقرير الاستثماري</span></div>
        </section>
      </div>
    </div>
  );
}
