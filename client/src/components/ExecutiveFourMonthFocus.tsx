import { AlertTriangle, CalendarDays, Landmark, TrendingDown, TrendingUp, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { PortfolioProjectMonthlyNet } from "@/lib/portfolioAggregation";
import { buildExecutivePortfolioLiquidity } from "@/lib/executivePortfolioLiquidity";
import { formatFullNumber } from "@/lib/numberFormat";
import { EXECUTIVE_PORTFOLIO_HORIZON_MONTHS } from "@/lib/executivePortfolioReports";

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function monthLabel(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function amount(value: number) {
  return formatFullNumber(Math.abs(value), "0");
}

type FocusProps = {
  variant: "brief" | "panel";
  onClose?: () => void;
};

/**
 * Read-only executive lens over the same canonical signed monthly rows used by
 * Project Aggregation and the existing Command Center obligations alert.
 */
export function ExecutiveFourMonthFocus({ variant, onClose }: FocusProps) {
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, { staleTime: 0 });
  const escrowQuery = trpc.cashFlowSettings.getPortfolioEscrowLiquidity.useQuery(undefined, { staleTime: 0 });
  const projects = (portfolioQuery.data || []) as PortfolioProjectMonthlyNet[];
  const liquidity = buildExecutivePortfolioLiquidity(projects, { horizon: EXECUTIVE_PORTFOLIO_HORIZON_MONTHS });
  const deficit = (escrowQuery.data || [])
    .filter((project: any) => project.liquidity?.hasDeficit)
    .map((project: any) => ({ project, index: project.liquidity.firstDeficitIndex as number }))
    .sort((left, right) => left.project.monthDates[left.index].localeCompare(right.project.monthDates[right.index]))[0];

  if (portfolioQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">جاري تجهيز ملخص الأشهر الأربعة القادمة…</div>;
  }

  const isPanel = variant === "panel";
  const summaryCards = (
    <div className={`grid gap-3 ${isPanel ? "sm:grid-cols-3" : "sm:grid-cols-3"}`}>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5"><div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700"><TrendingDown className="h-3.5 w-3.5" /> مطلوب من المستثمرين</div><p className="mt-2 text-lg font-black text-red-800">{amount(liquidity.summary.required)} <span className="text-[11px]">درهم</span></p></div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5"><div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><TrendingUp className="h-3.5 w-3.5" /> صافي المستلم</div><p className="mt-2 text-lg font-black text-emerald-800">{amount(liquidity.summary.returned)} <span className="text-[11px]">درهم</span></p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5"><div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800"><Landmark className="h-3.5 w-3.5" /> {liquidity.summary.netFunding >= 0 ? "صافي التمويل" : "صافي العائد"}</div><p className="mt-2 text-lg font-black text-amber-900">{amount(liquidity.summary.netFunding)} <span className="text-[11px]">درهم</span></p></div>
    </div>
  );

  const monthCards = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {liquidity.months.map((month) => (
        <div key={month.monthDate} className={`rounded-xl border p-3 ${month.required > 0 ? "border-red-100 bg-red-50/65" : month.returned > 0 ? "border-emerald-100 bg-emerald-50/65" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-xs font-black text-slate-800">{monthLabel(month.monthDate)}</p>
          <p className={`mt-2 text-sm font-black ${month.required > 0 ? "text-red-700" : month.returned > 0 ? "text-emerald-700" : "text-slate-500"}`}>{month.required > 0 ? `مطلوب ${amount(month.required)}` : month.returned > 0 ? `مستلم ${amount(month.returned)}` : "لا التزام صافٍ"}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">{month.drivers.length} مشاريع مؤثرة</p>
          {isPanel && month.drivers.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">{month.drivers.slice(0, 4).map((driver) => <div key={driver.projectId} className="flex items-center justify-between gap-2 text-[10px]"><span className="line-clamp-1 text-slate-600">{driver.name}</span><span className={driver.value < 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>{amount(driver.value)}</span></div>)}</div>}
        </div>
      ))}
    </div>
  );

  if (!isPanel) {
    return (
      <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-indigo-50 p-5 shadow-sm" dir="rtl" data-testid="sheikh-executive-briefing">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Landmark className="h-5 w-5" /></span><div><p className="text-[11px] font-black text-amber-700">ملخص افتتاحي</p><h2 className="mt-1 text-lg font-black text-slate-950">يا مرحبا شيخ عيسى</h2><p className="mt-1 text-xs leading-5 text-slate-600">هذه هي القرارات والأرقام الأقرب قبل الدخول إلى التفاصيل.</p></div></div><span className="self-start rounded-full border border-amber-200 bg-white px-3 py-1 text-[10px] font-black text-amber-800">الأشهر الأربعة القادمة</span></div>
        <div className="mt-4">{summaryCards}</div>
        <div className="mt-3">{monthCards}</div>
        {deficit && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>تنبيه سيولة:</strong> أول عجز متوقع في <strong>{deficit.project.name}</strong> خلال {monthLabel(deficit.project.monthDates[deficit.index])}.</span></div>}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 sm:items-center" dir="rtl" role="dialog" aria-modal="true" aria-label="الأشهر الأربعة القادمة">
      <section className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur"><div className="flex items-start gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><CalendarDays className="h-5 w-5" /></span><div><h2 className="text-base font-black text-slate-950">الأشهر الأربعة القادمة</h2><p className="mt-1 text-[11px] text-slate-600">ملخص تنفيذي موحّد من صف صافي الشهر المعتمد نفسه.</p></div></div><button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100" aria-label="إغلاق"><X className="h-5 w-5" /></button></div>
        <div className="space-y-4 p-5">{summaryCards}{monthCards}{deficit && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>تنبيه سيولة:</strong> أول عجز متوقع في <strong>{deficit.project.name}</strong> خلال {monthLabel(deficit.project.monthDates[deficit.index])}.</span></div>}</div>
      </section>
    </div>
  );
}
