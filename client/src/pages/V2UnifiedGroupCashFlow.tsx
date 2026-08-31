import { useMemo, type ReactNode } from "react";
import { default as Layers3 } from "lucide-react/dist/esm/icons/layers-3.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
import { trpc } from "@/lib/trpc";
import { FinancialSourceValue } from "@/components/FinancialSourceTrace";
import { combineFinancialTraceBreakdowns } from "@/lib/financialTraceBreakdown";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  buildUnifiedGroupExecutiveSummary,
  type UnifiedGroupCashFlow,
} from "@/lib/unifiedGroupCashFlow";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function shortProjectName(name: string) {
  if (name.includes("6180578") || name.includes("قطعة 3")) return "ند الشبا 3";
  if (name.includes("6182776") || name.includes("قطعة 2")) return "ند الشبا 2";
  if (name.includes("6185392") || name.includes("قطعة 1")) return "ند الشبا 1";
  if (name.includes("الجداف")) return "الجداف";
  if (name.includes("مركز مجان")) return "مركز مجان";
  if (name.includes("مجان متعدد")) return "مجان متعدد";
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function flowKind(value: number) {
  if (value < -0.000001) return "required";
  if (value > 0.000001) return "returned";
  return "zero";
}

function signedAmount(value: number) {
  if (Math.abs(value) < 0.000001) return "—";
  return `${value > 0 ? "+" : "−"}${formatFullNumber(Math.abs(value), "0")}`;
}

function unsignedAmount(value: number) {
  return formatFullNumber(Math.abs(value), "0");
}

type V2UnifiedGroupCashFlowProps = {
  memberToken?: string;
};

export default function V2UnifiedGroupCashFlow({ memberToken }: V2UnifiedGroupCashFlowProps = {}) {
  const reportQuery = trpc.cashFlowSettings.getUnifiedGroupCashFlows.useQuery(
    memberToken ? { commandCenterToken: memberToken } : undefined,
    { staleTime: 0 },
  );
  const report = reportQuery.data as UnifiedGroupCashFlow | null | undefined;
  const executive = useMemo(
    () => report ? buildUnifiedGroupExecutiveSummary(report) : null,
    [report],
  );

  if (reportQuery.isLoading) {
    return <div className="min-h-[420px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500" dir="rtl">جاري تحميل التدفقات النقدية الموحدة...</div>;
  }

  if (!report || !executive || report.rows.length === 0 || report.monthDates.length === 0) {
    return <div className="min-h-[420px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500" dir="rtl">لا توجد تدفقات شهرية معتمدة لعرضها حاليًا.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4" dir="rtl" data-testid="unified-group-cash-flow-report">
      <div className="mx-auto w-full lg:w-[75vw] lg:max-w-[1420px]">
        <header className="overflow-hidden rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-[0_15px_36px_rgba(15,23,42,0.16)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-300/30 bg-teal-500/15 text-teal-200"><Layers3 className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-teal-200">التقرير المجمع للمجموعة</p>
                <h1 className="mt-1 text-xl font-black">التدفقات النقدية الموحدة للمجموعة</h1>
                <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-300">التجميع الشهري المعتمد لجميع المشاريع في جدول واحد.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{report.rows.length} مشاريع</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{report.monthDates.length} شهرًا فعليًا</span>
            </div>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="unified-executive-summary-row">
          <CompactMetric icon={<Landmark className="h-4 w-4" />} label="مدفوع حتى الآن" value={unsignedAmount(executive.paidBefore)} tone="slate" title="المبلغ المدفوع قبل أول شهر ظاهر في الجدول." />
          <CompactMetric icon={<WalletCards className="h-4 w-4" />} label="المتبقي حتى الذروة" value={unsignedAmount(executive.remainingNewFunding)} tone="amber" title="أقصى تمويل جديد مطلوب بعد المدفوع السابق." />
          <CompactMetric icon={<Layers3 className="h-4 w-4" />} label="رأس المال عند الذروة" value={unsignedAmount(executive.peakCapital)} tone="teal" title={`${unsignedAmount(executive.paidBefore)} مدفوع + ${unsignedAmount(executive.remainingNewFunding)} متبقٍ.`} />
          <CompactMetric icon={<CalendarClock className="h-4 w-4" />} label="شهر الذروة" value={executive.peakMonthDate ? formatMonth(executive.peakMonthDate) : "لا توجد ذروة"} tone="navy" unit="" title="الشهر الذي يصل فيه عجز التمويل الجديد إلى أعلى مستوى." />
        </section>

        <section className="mt-3 overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b-2 border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-slate-950">الحركة الشهرية الموحّدة</h2><p className="mt-0.5 text-[10px] text-slate-500">السالب = تمويل مطلوب، والموجب = استلام. انقر على الرقم لمصدر الحركة وتفصيلها.</p></div><div className="flex gap-2 text-[10px] font-bold"><span className="rounded-full bg-red-50 px-2 py-1 text-red-700">− مطلوب</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">+ مستلم</span></div></div>
          <div className="relative max-h-[72vh] overflow-auto overscroll-contain [scrollbar-gutter:stable] lg:overflow-x-hidden">
            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-[clamp(10px,0.66vw,12px)]">
              <colgroup><col className="w-[8%]" />{report.rows.map((row) => <col key={row.projectId} className="w-[10.5%]" />)}<col className="w-[14%]" /><col className="w-[15%]" /></colgroup>
              <thead><tr className="bg-slate-900 text-white shadow-[0_3px_8px_rgba(15,23,42,0.28)]"><th className="sticky right-0 top-0 z-40 border-l border-slate-600 bg-slate-900 px-2 py-2.5 text-right font-black">الشهر</th>{report.rows.map((row) => <th key={row.projectId} title={row.name} className="sticky top-0 z-30 border-l border-slate-600 bg-slate-900 px-1.5 py-2.5 text-center font-black"><span className="block whitespace-nowrap leading-4">{shortProjectName(row.name)}</span></th>)}<th className="sticky top-0 z-30 border-r-2 border-slate-400 bg-teal-800 px-2 py-2.5 text-center font-black">إجمالي المجموعة</th><th className="sticky top-0 z-30 border-r border-slate-600 bg-slate-800 px-2 py-2.5 text-center font-black">تراكمي التمويل الجديد</th></tr></thead>
              <tbody>
                <tr className="border-b-2 border-slate-700 bg-slate-100"><td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-300 bg-slate-100 px-2 py-2 text-right font-black text-slate-900">مدفوع مسبقًا</td>{report.rows.map((row) => { const paid = report.projects.find((project) => project.projectId === row.projectId)?.paidBeforeSchedule || 0; return <td key={row.projectId} className="whitespace-nowrap border-l border-slate-200 px-1 py-2 text-center font-black tabular-nums text-red-800">{paid > 0 ? `−${unsignedAmount(paid)}` : "—"}</td>; })}<td className="whitespace-nowrap border-r-2 border-slate-400 bg-slate-200 px-2 py-2 text-center font-black tabular-nums text-red-900">{report.paidBeforeScheduleTotal > 0 ? `−${unsignedAmount(report.paidBeforeScheduleTotal)}` : "—"}</td><td className="whitespace-nowrap border-r border-slate-300 bg-slate-200 px-2 py-2 text-center font-black text-slate-500" title="المدفوع السابق منفصل ولا يدخل في تراكمي التمويل الجديد">—</td></tr>
                {report.monthDates.map((monthDate, monthIndex) => {
                  const total = report.totals[monthIndex] || 0;
                  const cumulative = report.cumulativeTotals[monthIndex] || 0;
                  const groupTrace = combineFinancialTraceBreakdowns(report.rows.map((row) => row.monthlyTrace?.[monthIndex]));
                  const isPeakMonth = executive.peakMonthDate === monthDate;
                  return <tr
                    key={monthDate}
                    id={isPeakMonth ? "unified-peak-month-row" : undefined}
                    data-testid={isPeakMonth ? "unified-peak-month-row" : undefined}
                    aria-label={isPeakMonth ? `شهر الذروة: ${formatMonth(monthDate)}` : undefined}
                    className={isPeakMonth ? "bg-amber-50 shadow-[inset_0_2px_0_#f59e0b,inset_0_-2px_0_#f59e0b]" : "even:bg-slate-50"}
                  >
                    <td className={`sticky right-0 z-10 whitespace-nowrap border-b border-l px-2 py-2 text-right font-black ${isPeakMonth ? "border-amber-400 bg-amber-200 text-amber-950" : "border-slate-300 bg-inherit text-slate-800"}`}>
                      <span className="block">{formatMonth(monthDate)}</span>
                      {isPeakMonth && <span className="mt-1 inline-flex rounded-full bg-amber-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm">شهر الذروة</span>}
                    </td>
                    {report.rows.map((row) => {
                      const value = row.values[monthIndex] || 0;
                      const kind = flowKind(value);
                      const trace = row.monthlyTrace?.[monthIndex];
                      return <td key={row.projectId} className={`whitespace-nowrap border-b border-l px-1 py-2 text-center font-bold tabular-nums ${isPeakMonth ? "border-amber-300 bg-amber-50/80" : "border-slate-200"} ${kind === "required" ? "text-red-700" : kind === "returned" ? "text-emerald-700" : "text-slate-300"}`}>
                        {kind === "zero" ? "—" : <FinancialSourceValue testId={`unified-group-trace-project-${row.projectId}-${monthIndex}`} trace={{ report: "التدفقات النقدية الموحدة للمجموعة", project: row.name, row: row.sourceLabel, period: formatMonth(monthDate), rule: row.sourceKind === "commercial_development" ? "نسخ صافي التدفقات المعتمدة لتطوير المركز التجاري قبل التشغيل، بلا إيجارات أو مصاريف تشغيل مقدّرة." : "نسخ صف صافي الشهر النهائي المعتمد من تقرير تدفقات المستثمر بعد محاذاة التاريخ.", value, expenses: trace?.expenses, receipts: trace?.receipts }}>{signedAmount(value)}</FinancialSourceValue>}
                      </td>;
                    })}
                    <td className={`whitespace-nowrap border-b border-r-2 px-2 py-2 text-center font-black tabular-nums ${isPeakMonth ? "border-amber-400 bg-amber-100" : "border-slate-300 bg-teal-50"} ${flowKind(total) === "required" ? "text-red-800" : flowKind(total) === "returned" ? "text-emerald-800" : "text-slate-400"}`}>
                      {flowKind(total) === "zero" ? "—" : <FinancialSourceValue testId={`unified-group-trace-total-${monthIndex}`} trace={{ report: "التدفقات النقدية الموحدة للمجموعة", project: "جميع المشاريع", row: "إجمالي المجموعة", period: formatMonth(monthDate), rule: "مجموع صفوف صافي الشهر المنسوخة للمشاريع كافة في الشهر نفسه.", value: total, expenses: groupTrace.expenses, receipts: groupTrace.receipts, contributors: report.rows.map((row) => ({ name: row.name, value: row.values[monthIndex] || 0 })) }}>{signedAmount(total)}</FinancialSourceValue>}
                    </td>
                    <td className={`whitespace-nowrap border-b border-r px-2 py-2 text-center font-black tabular-nums ${isPeakMonth ? "border-amber-400 bg-amber-200" : "border-slate-200 bg-slate-100"} ${flowKind(cumulative) === "required" ? "text-red-800" : flowKind(cumulative) === "returned" ? "text-emerald-800" : "text-slate-500"}`} title={isPeakMonth ? "أكبر عجز تراكمي للتمويل الجديد في النطاق الحالي" : undefined}>{signedAmount(cumulative)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] leading-5 text-slate-500">جميع الخلايا من صفوف صافي الشهر المعتمدة للمشاريع بعد محاذاة التاريخ.</div>
        </section>
      </div>
    </div>
  );
}

function CompactMetric({ icon, tone, label, value, unit = "درهم", title }: { icon: ReactNode; tone: "slate" | "amber" | "teal" | "navy"; label: string; value: string; unit?: string; title: string }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    teal: "border-teal-200 bg-teal-50 text-teal-950",
    navy: "border-slate-800 bg-slate-900 text-white",
  };
  return <div className={`rounded-xl border px-3 py-2.5 shadow-sm ${tones[tone]}`} title={title}><div className="flex items-center gap-1.5 text-[10px] font-black opacity-75">{icon}{label}</div><p className="mt-1 whitespace-nowrap text-base font-black tabular-nums sm:text-lg">{value}{unit && <span className="mr-1 text-[9px] font-bold opacity-65">{unit}</span>}</p></div>;
}
