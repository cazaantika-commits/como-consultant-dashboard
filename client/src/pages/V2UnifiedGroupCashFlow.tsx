import { useMemo, useState, type ReactNode } from "react";
import { default as Layers3 } from "lucide-react/dist/esm/icons/layers-3.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as TrendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { default as TrendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
import { default as RefreshCw } from "lucide-react/dist/esm/icons/refresh-cw.js";
import { trpc } from "@/lib/trpc";
import { FinancialSourceValue } from "@/components/FinancialSourceTrace";
import { combineFinancialTraceBreakdowns } from "@/lib/financialTraceBreakdown";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  buildUnifiedGroupExecutiveSummary,
  buildUnifiedGroupLiquidity,
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
  const [horizon, setHorizon] = useState<3 | 4>(4);
  const liquidity = useMemo(
    () => report ? buildUnifiedGroupLiquidity(report, { horizon }) : null,
    [report, horizon],
  );
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

  const commercialCenter = report.rows.find((row) => row.sourceKind === "commercial_development");
  const peakDriverNames = executive.projectsAtPeak
    .filter((project) => project.capitalAtGroupPeak > 0.000001)
    .slice(0, 3)
    .map((project) => shortProjectName(project.name))
    .join("، ");
  const peakExplanation = executive.peakMonthDate
    ? `بلغ التمويل الجديد أعلى مستوى في ${formatMonth(executive.peakMonthDate)} بقيمة ${unsignedAmount(executive.remainingNewFunding)} درهم. تركزت أكبر مساهمات رأس المال في ${peakDriverNames || "المشاريع المعروضة"}.${executive.firstRecoveryMonthDate ? ` وبدأت الاستلامات بخفض العجز التراكمي في ${formatMonth(executive.firstRecoveryMonthDate)}.` : " ولا يظهر بعد ذلك شهر استرداد صافٍ ضمن النطاق الحالي."}`
    : "لا يحتاج الجدول إلى تمويل جديد بعد المدفوع السابق؛ الاستلامات المتاحة تغطي المصروفات الشهرية ضمن النطاق الحالي.";

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
                <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-300">نسخ ومحاذاة لسطر التدفق النهائي لكل مشروع حسب الشهر الفعلي. لا يعيد التقرير احتساب الإيراد أو التكلفة أو الضمان أو الربح.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{report.rows.length} مشاريع</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{report.monthDates.length} شهرًا فعليًا</span>
            </div>
          </div>
        </header>

        {commercialCenter && (
          <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800"><Building2 className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-black text-cyan-950">{commercialCenter.name} — تطوير قبل التشغيل</p>
                <p className="mt-0.5 text-[11px] leading-5 text-cyan-800">{commercialCenter.scopeNote}</p>
              </div>
            </div>
            <span className="shrink-0 self-start rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-black text-cyan-800">تكاليف تطوير مؤكدة فقط</span>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm" data-testid="unified-executive-capital-answer">
          <div className="border-b border-amber-200 bg-gradient-to-l from-amber-50 via-white to-teal-50 px-4 py-3">
            <p className="text-[10px] font-black tracking-[0.12em] text-amber-700">الجواب التنفيذي الأول</p>
            <h2 className="mt-0.5 text-base font-black text-slate-950">كم دفعنا وكم بقي مطلوبًا من أموال جديدة؟</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">المدفوع السابق منفصل عن التراكمي الشهري؛ المتبقي هو أعمق عجز جديد قبل أن تبدأ الاستلامات بتغطية الصرف اللاحق.</p>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700"><Landmark className="h-4 w-4" />دفعنا حتى الآن</div>
              <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{unsignedAmount(executive.paidBefore)} <span className="text-[11px] text-slate-500">درهم</span></p>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">أموال خرجت فعليًا قبل بداية أول شهر ظاهر في الجدول.</p>
            </div>
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-[0_8px_22px_rgba(245,158,11,0.12)]">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900"><WalletCards className="h-4 w-4" />المتبقي المطلوب منك حتى الذروة</div>
              <p className="mt-2 text-2xl font-black tabular-nums text-amber-950">{unsignedAmount(executive.remainingNewFunding)} <span className="text-[11px] text-amber-700">درهم</span></p>
              <p className="mt-1 text-[10px] leading-5 text-amber-800">أقصى تمويل إضافي جديد يحتاجه الجدول بعد المدفوع السابق.</p>
            </div>
          </div>
          <div className="mx-4 mb-4 grid gap-3 rounded-2xl bg-slate-950 px-4 py-4 text-white sm:grid-cols-[1fr_auto] sm:items-center" data-testid="peak-capital-equation">
            <div>
              <p className="text-[10px] font-bold text-slate-300">معادلة رأس المال عند الذروة</p>
              <p className="mt-1 text-sm font-black tabular-nums sm:text-base">{unsignedAmount(executive.paidBefore)} مدفوع + {unsignedAmount(executive.remainingNewFunding)} متبقٍ = <span className="text-amber-300">{unsignedAmount(executive.peakCapital)} درهم</span></p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-300"><CalendarClock className="h-3.5 w-3.5" />موعد الذروة</div>
              <p className="mt-1 text-xs font-black text-white">{executive.peakMonthDate ? formatMonth(executive.peakMonthDate) : "لا توجد ذروة جديدة"}</p>
            </div>
          </div>
        </section>

        {liquidity && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-l from-amber-50 via-white to-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-black text-slate-900">ماذا سيحدث خلال الأشهر القادمة؟</p><p className="mt-0.5 text-[10px] text-slate-500">الصرف والاستلام وصافي التمويل ومحركات كل شهر، من خلايا التقرير نفسها فقط.</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setHorizon(3)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${horizon === 3 ? "bg-slate-900 text-white" : "text-slate-600"}`}>3 أشهر</button><button onClick={() => setHorizon(4)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${horizon === 4 ? "bg-slate-900 text-white" : "text-slate-600"}`}>4 أشهر</button></div>
            </div>
            <div className="grid gap-3 p-3 md:grid-cols-4">
              {liquidity.months.map((month) => <div key={month.monthDate} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-xs font-black text-slate-800">{formatMonth(month.monthDate)}</p><div className="mt-2 space-y-1 text-[10px]"><div className="flex items-center justify-between text-red-700"><span>الصرف</span><span className="font-black tabular-nums">{unsignedAmount(month.spend)}</span></div><div className="flex items-center justify-between text-emerald-700"><span>الاستلام</span><span className="font-black tabular-nums">{unsignedAmount(month.receipts)}</span></div></div><div className="mt-2 border-t border-slate-200 pt-2"><p className="text-[9px] font-bold text-slate-500">{month.total < 0 ? "تمويل جديد مطلوب" : month.total > 0 ? "فائض نقدي للشهر" : "صافي الشهر"}</p><p className={`mt-0.5 text-sm font-black tabular-nums ${month.total < 0 ? "text-red-700" : month.total > 0 ? "text-emerald-700" : "text-slate-500"}`}>{signedAmount(month.total)} <span className="text-[9px]">درهم</span></p></div><p className="mt-2 border-t border-dashed border-slate-200 pt-2 text-[9px] leading-4 text-slate-500">المحرك: {month.drivers.slice(0, 2).map((driver) => shortProjectName(driver.name)).join("، ") || "لا توجد حركة"}</p></div>)}
            </div>
          </section>
        )}

        <section className="mt-4" data-testid="unified-cash-cycle-metrics">
          <div className="mb-2"><h2 className="text-sm font-black text-slate-950">دورة الأموال الكاملة</h2><p className="mt-0.5 text-[10px] text-slate-500">معلومات المستوى الثاني التي تشرح لماذا قد يتجاوز إجمالي الصرف رأس مال الذروة.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard icon={<TrendingDown className="h-4 w-4" />} tone="red" label="إجمالي مصروفات المشاريع" value={unsignedAmount(executive.totalSpend)} description="كل الصرف عبر النطاق؛ قد يكون أكبر من رأس المال لأن الاستلامات تُستخدم لاحقًا." />
            <SummaryCard icon={<TrendingUp className="h-4 w-4" />} tone="emerald" label="إجمالي الأموال المستلمة" value={unsignedAmount(executive.totalReceipts)} description="كل ما عاد فعليًا من الضمان أو المبيعات في تدفقات المشاريع." />
            <SummaryCard icon={<RefreshCw className="h-4 w-4" />} tone="teal" label="مصروفات غطتها الاستلامات" value={unsignedAmount(executive.recycledCash)} description="صرف لاحق لم يرفع رأس المال المطلوب لأن الأموال الداخلة غطته." />
            <SummaryCard icon={<WalletCards className="h-4 w-4" />} tone={executive.closingNet >= 0 ? "emerald" : "amber"} label="صافي نهاية التقرير" value={signedAmount(executive.closingNet)} description="الاستلام ناقص المصروف حتى آخر شهر؛ وضع نقدي وليس تعريفًا للربح." />
            <SummaryCard icon={<CalendarClock className="h-4 w-4" />} tone="slate" label="بداية تخفيف الاحتياج" value={executive.firstRecoveryMonthDate ? formatMonth(executive.firstRecoveryMonthDate) : "لا يظهر ضمن النطاق"} unit="" description="أول شهر بعد الذروة تنخفض فيه فجوة التمويل الجديدة." />
            <SummaryCard icon={<Layers3 className="h-4 w-4" />} tone="slate" label="نطاق التقرير" value={`${report.rows.length} مشاريع / ${report.monthDates.length} شهر`} unit="" description="المركز التجاري مشمول بتطوير ما قبل التشغيل فقط." />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="unified-project-funding-distribution">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-black text-slate-950">أين يتركز رأس المال عند ذروة المجموعة؟</h2><p className="mt-0.5 text-[10px] text-slate-500">مساهمة كل مشروع في نفس شهر ذروة المجموعة، وليست ذروة مستقلة جديدة للمشروع.</p></div>
          <div className="divide-y divide-slate-100 px-4">
            {executive.projectsAtPeak.map((project) => {
              const futureFundingToPeak = -project.monthlyNetToGroupPeak;
              const positiveShare = Math.max(project.shareOfGroupPeak * 100, 0);
              return <div key={project.projectId} className="py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-black text-slate-900">{shortProjectName(project.name)}</p><p className="mt-0.5 text-[9px] text-slate-500">مدفوع سابقًا {unsignedAmount(project.paidBefore)} · بعد بداية الجدول {signedAmount(futureFundingToPeak)}</p></div><div className="text-left"><p className={`text-sm font-black tabular-nums ${project.capitalAtGroupPeak >= 0 ? "text-slate-900" : "text-emerald-700"}`}>{signedAmount(project.capitalAtGroupPeak)} <span className="text-[9px] text-slate-500">درهم</span></p><p className="text-[9px] text-slate-500">{project.shareOfGroupPeak >= 0 ? `${formatFullNumber(project.shareOfGroupPeak * 100, "1")}٪ من الذروة` : "يخفّض احتياج المجموعة"}</p></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-400" style={{ width: `${Math.min(positiveShare, 100)}%` }} /></div></div>;
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3" data-testid="unified-peak-explanation">
          <p className="text-[10px] font-black tracking-[0.1em] text-indigo-700">لماذا هذه هي الذروة؟</p>
          <p className="mt-1 text-[11px] font-semibold leading-6 text-indigo-950">{peakExplanation}</p>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b-2 border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-slate-950">الحركة الشهرية الموحّدة</h2><p className="mt-0.5 text-[10px] text-slate-500">السالب = تمويل مطلوب، والموجب = استلام. انقر على الرقم لمصدر الحركة وتفصيلها.</p></div><div className="flex gap-2 text-[10px] font-bold"><span className="rounded-full bg-red-50 px-2 py-1 text-red-700">− مطلوب</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">+ مستلم</span></div></div>
          <div className="relative max-h-[72vh] overflow-auto overscroll-contain [scrollbar-gutter:stable] lg:overflow-x-hidden">
            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-[clamp(10px,0.66vw,12px)]">
              <colgroup><col className="w-[8%]" />{report.rows.map((row) => <col key={row.projectId} className="w-[10.5%]" />)}<col className="w-[14%]" /><col className="w-[15%]" /></colgroup>
              <thead><tr className="bg-slate-900 text-white shadow-[0_3px_8px_rgba(15,23,42,0.28)]"><th className="sticky right-0 top-0 z-40 border-l border-slate-600 bg-slate-900 px-2 py-2.5 text-right font-black">الشهر</th>{report.rows.map((row) => <th key={row.projectId} title={row.name} className={`sticky top-0 z-30 border-l border-slate-600 px-1.5 py-2.5 text-center font-black ${row.sourceKind === "commercial_development" ? "bg-cyan-900" : "bg-slate-900"}`}><span className="block whitespace-nowrap leading-4">{shortProjectName(row.name)}</span>{row.sourceKind === "commercial_development" && <span className="mt-1 inline-block rounded bg-cyan-50/15 px-1 py-0.5 text-[8px] font-bold text-cyan-100">قبل التشغيل</span>}</th>)}<th className="sticky top-0 z-30 border-r-2 border-slate-400 bg-teal-800 px-2 py-2.5 text-center font-black">إجمالي المجموعة</th><th className="sticky top-0 z-30 border-r border-slate-600 bg-slate-800 px-2 py-2.5 text-center font-black">تراكمي التمويل الجديد</th></tr></thead>
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
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-500">المركز التجاري يدخل في هذا التقرير فقط بالحركات المعتمدة لتطويره حتى نهاية نطاق المصدر الحالي. لا يعرض التقرير توقعات إيجار أو تشغيل لسنوات مستقبلية.</div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, tone, label, value, valueClassName = "", unit = "درهم", description }: { icon: ReactNode; tone: "red" | "emerald" | "amber" | "slate" | "teal"; label: string; value: string; valueClassName?: string; unit?: string; description?: string }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-white text-slate-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><div className="flex items-center gap-2 text-[11px] font-bold opacity-80">{icon}{label}</div><p className={`mt-2 text-xl font-black tabular-nums ${valueClassName}`}>{value}</p>{unit && <span className="text-[10px] font-bold opacity-70">{unit}</span>}{description && <p className="mt-2 text-[10px] font-semibold leading-5 opacity-75">{description}</p>}</div>;
}
