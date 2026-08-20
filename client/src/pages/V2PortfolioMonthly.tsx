import { ArrowRight, CalendarDays, Download, FileSpreadsheet, Layers3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FinancialSourceValue } from "@/components/FinancialSourceTrace";
import {
  alignPortfolioMonthlyNetFlows,
  groupCalendarAlignedPortfolio,
  type PortfolioProjectMonthlyNet,
} from "@/lib/portfolioAggregation";

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

function formatAmount(value: number): string {
  const amount = Math.abs(value);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return Math.round(amount).toLocaleString("en-US");
}

function formatMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatPeriod(startDate: string, endDate: string): string {
  return startDate === endDate ? formatMonth(startDate) : `${formatMonth(startDate)} – ${formatMonth(endDate)}`;
}

function cellKind(value: number): "required" | "returned" | "zero" {
  if (value < -0.000001) return "required";
  if (value > 0.000001) return "returned";
  return "zero";
}

export default function V2PortfolioMonthly() {
  const [, navigate] = useLocation();
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, { staleTime: 0 });
  const projects = (portfolioQuery.data || []) as PortfolioProjectMonthlyNet[];
  const [selected, setSelected] = useState<number[]>([]);
  const [groupSize, setGroupSize] = useState<1 | 3 | 4 | 6>(1);

  useEffect(() => {
    if (projects.length > 0 && selected.length === 0) {
      setSelected(projects.map((project) => project.projectId));
    }
  }, [projects, selected.length]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selected.includes(project.projectId)),
    [projects, selected],
  );
  const monthlyPortfolio = useMemo(
    () => alignPortfolioMonthlyNetFlows(selectedProjects),
    [selectedProjects],
  );
  const groupedPortfolio = useMemo(
    () => groupCalendarAlignedPortfolio(monthlyPortfolio, groupSize),
    [monthlyPortfolio, groupSize],
  );

  const largestRequired = Math.max(...groupedPortfolio.totals.map((value) => Math.max(-value, 0)), 0);
  const totalReturned = groupedPortfolio.totals
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);

  const toggleProject = (projectId: number) => {
    setSelected((previous) => previous.includes(projectId)
      ? previous.filter((id) => id !== projectId)
      : [...previous, projectId]);
  };

  const exportTable = (forExcel: boolean) => {
    const headers = ["الفترة", ...groupedPortfolio.rows.map((project) => project.name), "الإجمالي"];
    const rows = groupedPortfolio.periods.map((period, periodIndex) => [
      formatPeriod(period.startDate, period.endDate),
      ...period.values.map((value) => value === 0 ? "—" : formatAmount(value)),
      groupedPortfolio.totals[periodIndex] === 0 ? "—" : formatAmount(groupedPortfolio.totals[periodIndex]),
    ]);
    const finalRow = [
      "الإجمالي",
      ...groupedPortfolio.rows.map((project) => formatAmount(project.values.reduce((sum, value) => sum + value, 0))),
      formatAmount(groupedPortfolio.totals.reduce((sum, value) => sum + value, 0)),
    ];
    const cell = (value: string, header = false) => `<${header ? "th" : "td"}>${value}</${header ? "th" : "td"}>`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المحفظة الاستثمارية — العرض الشهري للتدفقات</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}.header{background:#0f172a;color:#fff;padding:16px 20px;border-radius:8px}.header p{color:#cbd5e1;font-size:12px}.cards{display:flex;gap:12px;margin:16px 0}.card{flex:1;background:#f8fafc;border-right:4px solid #0ea5e9;padding:12px;border-radius:6px}.card b{display:block;font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0f172a;color:#fff;padding:8px;border:1px solid #334155}td{padding:7px;border:1px solid #cbd5e1;text-align:center}tr:nth-child(even) td{background:#f8fafc}.total td{background:#1e293b!important;color:#fff;font-weight:700}@media print{body{padding:8px}}</style></head><body><div class="header"><h1>المحفظة الاستثمارية — العرض الشهري للتدفقات</h1><p>التجميع: ${PERIOD_OPTIONS.find((item) => item.value === groupSize)?.label} · ${selectedProjects.length} مشاريع</p></div><div class="cards"><div class="card">أكبر مبلغ مطلوب<b>${formatAmount(largestRequired)} درهم</b></div><div class="card">إجمالي المستلم<b>${formatAmount(totalReturned)} درهم</b></div><div class="card">عدد المشاريع<b>${selectedProjects.length}</b></div></div><table><thead><tr>${headers.map((value) => cell(value, true)).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => cell(value)).join("")}</tr>`).join("")}<tr class="total">${finalRow.map((value) => cell(value)).join("")}</tr></tbody></table></body></html>`;
  };

  const exportHtml = () => {
    const report = exportTable(false);
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(report);
    reportWindow.document.close();
  };

  const exportExcel = () => {
    const blob = new Blob([`\ufeff${exportTable(true)}`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "المحفظة-الاستثمارية-العرض-الشهري.xls";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (portfolioQuery.isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">جاري تحميل التقرير...</div>;
  }

  if (projects.length === 0) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">لا توجد مشاريع لعرضها</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4" dir="rtl">
      <div className="max-w-[1800px] mx-auto">
        <div className="rounded-lg bg-slate-900 px-5 py-4 text-white shadow-sm flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/v2")} className="mt-0.5 rounded-md p-1 hover:bg-white/10" aria-label="العودة">
              <ArrowRight className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-extrabold">المحفظة الاستثمارية — العرض الشهري للتدفقات</h1>
              <p className="mt-1 text-[11px] text-slate-300">صافي الشهر من تدفقات المستثمر لكل مشروع، مجمّع حسب الأشهر الفعلية</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-300">
            <button onClick={exportExcel} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 font-bold hover:bg-white/20"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</button>
            <button onClick={exportHtml} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 font-bold hover:bg-teal-500"><Download className="h-3.5 w-3.5" />HTML</button>
            <CalendarDays className="h-4 w-4 text-teal-300" />
            <span>{selectedProjects.length} مشاريع مختارة</span>
          </div>
        </div>

        <div className="fs-card fs-card-blue mt-4 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">المشاريع الداخلة في التقرير</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">تظهر النقطة نفسها بجانب المشروع في الجدول لتسهيل المتابعة</p>
            </div>
            <div className="flex items-center rounded-md border border-slate-300 bg-white p-0.5">
              {PERIOD_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => setGroupSize(option.value)} className={`rounded px-3 py-1.5 text-[10px] font-bold transition ${groupSize === option.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {projects.map((project, index) => {
              const active = selected.includes(project.projectId);
              const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
              return (
                <button key={project.projectId} onClick={() => toggleProject(project.projectId)} className={`inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-[11px] font-bold transition ${active ? "bg-white" : "border-slate-200 bg-slate-100 text-slate-400"}`} style={active ? { borderColor: color, color } : undefined}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: active ? color : "#cbd5e1" }} />
                  {project.name || `مشروع ${project.projectId}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="fs-card fs-card-orange rounded-md p-3"><p className="text-[10px] text-slate-500">أكبر مبلغ مطلوب من المستثمر</p><p className="mt-1 text-lg font-extrabold text-slate-900">{formatAmount(largestRequired)}</p><span className="text-[9px] text-slate-400">درهم</span></div>
          <div className="fs-card fs-card-emerald rounded-md p-3"><p className="text-[10px] text-slate-500">إجمالي المستلم للمستثمر</p><p className="mt-1 text-lg font-extrabold text-slate-900">{formatAmount(totalReturned)}</p><span className="text-[9px] text-slate-400">درهم</span></div>
          <div className="fs-card fs-card-cyan rounded-md p-3"><p className="text-[10px] text-slate-500">عدد المشاريع</p><p className="mt-1 text-lg font-extrabold text-slate-900">{selectedProjects.length} / {projects.length}</p><span className="text-[9px] text-slate-400">مشاريع مختارة</span></div>
        </div>

        <div className="fs-card fs-card-violet mt-4 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-extrabold text-slate-900">التوزيع الزمني للتدفقات</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: Math.max(900, selectedProjects.length * 140 + 260) }}>
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="sticky right-0 z-10 min-w-[155px] border-l border-slate-700 bg-slate-900 px-3 py-2 text-right">الفترة</th>
                  {groupedPortfolio.rows.map((project, index) => <th key={project.projectId} className="min-w-[125px] border-l border-slate-700 px-2 py-2 text-center"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }} />{project.name}</span></th>)}
                  <th className="min-w-[120px] px-2 py-2 text-center">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {groupedPortfolio.periods.map((period, periodIndex) => (
                  <tr key={period.startDate} className="border-b border-slate-100 even:bg-slate-50/80">
                    <td className="sticky right-0 z-10 border-l border-slate-200 bg-inherit px-3 py-2 text-right font-bold text-slate-700">{formatPeriod(period.startDate, period.endDate)}</td>
                    {period.values.map((value, projectIndex) => {
                      const kind = cellKind(value);
                      const project = groupedPortfolio.rows[projectIndex];
                      return <td key={projectIndex} className={`px-2 py-2 text-center font-semibold tabular-nums ${kind === "required" ? "text-red-700" : kind === "returned" ? "text-emerald-700" : "text-slate-300"}`}>{kind === "zero" ? "—" : <FinancialSourceValue testId={`portfolio-monthly-trace-project-${project.projectId}-${periodIndex}`} trace={{ report: "العرض الشهري", project: project.name, row: "صافي الشهر من تدفقات المستثمر", period: formatPeriod(period.startDate, period.endDate), rule: "صف صافي الشهر المعتمد من تقرير تدفقات المستثمر، بعد محاذاة التقويم الفعلي.", value }}>{formatAmount(value)}</FinancialSourceValue>}</td>;
                    })}
                    {(() => {
                      const total = groupedPortfolio.totals[periodIndex] || 0;
                      const kind = cellKind(total);
                      return <td className={`px-2 py-2 text-center font-extrabold tabular-nums ${kind === "required" ? "bg-red-50 text-red-700" : kind === "returned" ? "bg-emerald-50 text-emerald-700" : "text-slate-300"}`}>{kind === "zero" ? "—" : <FinancialSourceValue testId={`portfolio-monthly-trace-total-${periodIndex}`} trace={{ report: "العرض الشهري", project: "جميع المشاريع المختارة", row: "الإجمالي", period: formatPeriod(period.startDate, period.endDate), rule: "مجموع صف صافي الشهر لجميع المشاريع المختارة في الفترة نفسها.", value: total, contributors: groupedPortfolio.rows.map((row) => ({ name: row.name, value: row.values[periodIndex] || 0 })) }}>{formatAmount(total)}</FinancialSourceValue>}</td>;
                    })()}
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white">
                  <td className="sticky right-0 z-10 border-l border-slate-700 bg-slate-800 px-3 py-2 text-right font-extrabold">الإجمالي</td>
                  {groupedPortfolio.rows.map((project, index) => {
                    const total = project.values.reduce((sum, value) => sum + value, 0);
                    const kind = cellKind(total);
                    return <td key={project.projectId} className={`px-2 py-2 text-center font-extrabold ${kind === "required" ? "text-red-300" : kind === "returned" ? "text-emerald-300" : "text-slate-400"}`}>{kind === "zero" ? "—" : formatAmount(total)}</td>;
                  })}
                  {(() => {
                    const total = groupedPortfolio.totals.reduce((sum, value) => sum + value, 0);
                    const kind = cellKind(total);
                    return <td className={`px-2 py-2 text-center font-extrabold ${kind === "required" ? "text-red-300" : kind === "returned" ? "text-emerald-300" : "text-slate-400"}`}>{kind === "zero" ? "—" : formatAmount(total)}</td>;
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-5 px-4 py-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" />مطلوب من المستثمر</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />مستلم للمستثمر</span></div>
        </div>
      </div>
    </div>
  );
}
