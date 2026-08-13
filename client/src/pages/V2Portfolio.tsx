import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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

export default function V2Portfolio() {
  const [, navigate] = useLocation();
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, {
    staleTime: 0,
  });
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

  const exportHtml = () => {
    const periodLabels = groupedPortfolio.periods.map((period) => formatPeriod(period.startDate, period.endDate));
    const rows = groupedPortfolio.rows.map((project, index) => {
      const cells = project.values.map((value) => {
        const kind = cellKind(value);
        const className = kind === "required" ? "required" : kind === "returned" ? "returned" : "zero";
        const label = kind === "required" ? `مطلوب ${formatAmount(value)}` : kind === "returned" ? `مستلم ${formatAmount(value)}` : "—";
        return `<td class="${className}">${label}</td>`;
      }).join("");
      return `<tr><th><span class="dot" style="background:${PROJECT_COLORS[index % PROJECT_COLORS.length]}"></span>${project.name}</th>${cells}</tr>`;
    }).join("");
    const totals = groupedPortfolio.totals.map((value) => {
      const kind = cellKind(value);
      const label = kind === "required" ? `مطلوب ${formatAmount(value)}` : kind === "returned" ? `مستلم ${formatAmount(value)}` : "—";
      return `<td class="${kind}">${label}</td>`;
    }).join("");

    const report = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>التدفقات النقدية المجمّعة</title><style>
      body{font-family:Tahoma,Arial,sans-serif;margin:32px;color:#172033;background:#fff} h1{font-size:22px;margin:0 0 4px}p{color:#64748b;margin:0 0 22px}.meta{display:flex;gap:12px;margin:0 0 20px}.card{border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:180px}.card b{display:block;font-size:18px;margin-top:5px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #e2e8f0;padding:9px;text-align:center;white-space:nowrap}thead th{background:#f8fafc;color:#475569}tbody th{text-align:right;background:#fff}.total th,.total td{background:#f0fdfa;font-weight:700}.required{color:#b91c1c}.returned{color:#047857}.zero{color:#94a3b8}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px}@media print{body{margin:12px}table{font-size:10px}}</style></head><body>
      <h1>التدفقات النقدية المجمّعة</h1><p>مصدر كل صف هو صافي الشهر من تدفقات المستثمر للمشروع، ومحاذاة الأعمدة حسب الأشهر الفعلية.</p>
      <div class="meta"><div class="card">أكبر مبلغ مطلوب<b>${formatAmount(largestRequired)} درهم</b></div><div class="card">إجمالي المستلم<b>${formatAmount(totalReturned)} درهم</b></div><div class="card">عدد المشاريع<b>${selectedProjects.length}</b></div></div>
      <table><thead><tr><th>المشروع</th>${periodLabels.map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${rows}<tr class="total"><th>الإجمالي المجمّع</th>${totals}</tr></tbody></table>
      </body></html>`;
    const exportWindow = window.open("", "_blank");
    if (!exportWindow) return;
    exportWindow.document.open();
    exportWindow.document.write(report);
    exportWindow.document.close();
  };

  if (portfolioQuery.isLoading) {
    return <div className="bg-gray-50 min-h-screen flex items-center justify-center"><div className="text-gray-600">جاري التحميل...</div></div>;
  }

  if (projects.length === 0) {
    return <div className="bg-gray-50 min-h-screen flex items-center justify-center"><div className="text-gray-600">لا توجد مشاريع</div></div>;
  }

  return (
    <div className="bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><ArrowRight className="w-4 h-4 text-gray-600" /></button>
            <div><h1 className="text-xs font-bold text-gray-900">المحفظة الاستثمارية</h1><p className="text-xs text-gray-500">صافي التدفقات النقدية المجمّعة — {selectedProjects.length} مشاريع</p><p className="mt-0.5 text-[9px]"><span className="text-red-600">الأحمر: مبلغ مطلوب من المستثمر</span><span className="mx-1 text-gray-300">|</span><span className="text-teal-700">الأخضر: مبلغ مستلم للمستثمر</span></p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              {PERIOD_OPTIONS.map((option) => <button key={option.value} onClick={() => setGroupSize(option.value)} className={`rounded-md px-2.5 py-1 text-[10px] transition ${groupSize === option.value ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{option.label}</button>)}
            </div>
            <button onClick={exportHtml} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs"><Download className="w-3.5 h-3.5" /> تصدير HTML</button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-1">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 mb-4">
          <h3 className="text-xs font-bold text-gray-700 mb-2">اختر المشاريع</h3>
          <div className="flex flex-wrap gap-2">
            {projects.map((project, index) => {
              const isSelected = selected.includes(project.projectId);
              const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
              return <button key={project.projectId} onClick={() => toggleProject(project.projectId)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition text-xs font-medium ${isSelected ? "border-current bg-opacity-10" : "border-gray-200 text-gray-400 bg-gray-50"}`} style={isSelected ? { color, borderColor: color, backgroundColor: `${color}15` } : {}}><span className={`w-4 h-4 rounded flex items-center justify-center text-white ${isSelected ? "bg-current" : "bg-gray-200"}`}>{isSelected ? "✓" : ""}</span>{project.name}</button>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-red-100 shadow-sm"><p className="text-[10px] text-red-600 mb-0.5">أكبر مبلغ مطلوب من المستثمر</p><p className="text-base font-bold text-red-700">{formatAmount(largestRequired)}</p></div>
          <div className="bg-white rounded-lg p-3 border border-teal-100 shadow-sm"><p className="text-[10px] text-teal-600 mb-0.5">إجمالي المستلم للمستثمر</p><p className="text-base font-bold text-teal-700">{formatAmount(totalReturned)}</p></div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm"><p className="text-[10px] text-gray-600 mb-0.5">عدد المشاريع</p><p className="text-base font-bold text-gray-800">{selectedProjects.length} / {projects.length}</p></div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-[11px]" style={{ minWidth: groupedPortfolio.periods.length * 105 + 180 }}><thead><tr className="bg-gray-50"><th className="sticky right-0 z-10 bg-gray-50 px-3 py-1.5 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[160px] text-xs">المشروع</th>{groupedPortfolio.periods.map((period) => <th key={period.startDate} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap">{formatPeriod(period.startDate, period.endDate)}</th>)}</tr></thead><tbody>{groupedPortfolio.rows.map((project, index) => <tr key={project.projectId} className="hover:bg-gray-50/50 border-b border-gray-50"><td className="sticky right-0 z-10 bg-white px-3 py-[5px] text-right border-l border-gray-100 whitespace-nowrap"><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }} /><span className="font-medium text-gray-800">{project.name}</span></div></td>{project.values.map((value, valueIndex) => { const kind = cellKind(value); return <td key={valueIndex} className={`px-1.5 py-[5px] text-center tabular-nums ${kind === "required" ? "text-red-700" : kind === "returned" ? "text-teal-700" : "text-gray-300"}`}>{kind === "zero" ? "—" : formatAmount(value)}</td>; })}</tr>)}<tr className="bg-teal-50 font-bold border-t-2 border-teal-200"><td className="sticky right-0 z-10 bg-teal-50 px-3 py-1.5 text-right text-teal-800 border-l border-teal-200">الإجمالي المجمّع</td>{groupedPortfolio.totals.map((value, index) => { const kind = cellKind(value); return <td key={index} className={`px-1.5 py-1.5 text-center tabular-nums ${kind === "required" ? "text-red-700" : kind === "returned" ? "text-teal-700" : "text-gray-300"}`}>{kind === "zero" ? "—" : formatAmount(value)}</td>; })}</tr></tbody></table></div></div>
      </div>
    </div>
  );
}
