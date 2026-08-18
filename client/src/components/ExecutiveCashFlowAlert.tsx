import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { PortfolioProjectMonthlyNet } from "@/lib/portfolioAggregation";
import { buildExecutivePortfolioLiquidity } from "@/lib/executivePortfolioLiquidity";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function monthLabel(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatAmount(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(absolute / 1_000_000).toFixed(1)} مليون`;
  if (absolute >= 1_000) return `${(absolute / 1_000).toFixed(0)} ألف`;
  return Math.round(absolute).toLocaleString("en-US");
}

type ExecutiveCashFlowAlertProps = {
  onOpenFullReport: () => void;
};

/**
 * Read-only decision surface for the Command Center.
 * It deliberately consumes the same signed net monthly rows as the frozen
 * Project Aggregation report: negative = investor funding required, positive = returned.
 */
export default function ExecutiveCashFlowAlert({ onOpenFullReport }: ExecutiveCashFlowAlertProps) {
  const [horizon, setHorizon] = useState<3 | 4>(4);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioInvestorNetCashFlows.useQuery(undefined, { staleTime: 0 });
  const projects = (portfolioQuery.data || []) as PortfolioProjectMonthlyNet[];

  const liquidity = useMemo(() => buildExecutivePortfolioLiquidity(projects, { horizon }), [projects, horizon]);
  const alertMonths = liquidity.months;
  const summary = liquidity.summary;

  if (portfolioQuery.isLoading) {
    return <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">جاري تجهيز ملخص التدفقات للمحفظة...</div>;
  }

  if (alertMonths.length === 0) {
    return <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">لا توجد تدفقات مستقبلية متاحة لعرضها حاليًا.</div>;
  }

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" dir="rtl" data-testid="executive-cash-flow-alert">
      <div className="relative overflow-hidden bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 text-white sm:px-7">
        <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/15 text-amber-300">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-200">لِلْقَرار التنفيذي</p>
              <h2 className="mt-1 text-xl font-black">التزامات المحفظة القادمة</h2>
              <p className="mt-1 text-xs text-slate-300">ما المطلوب، متى، ومن أي مشروع خلال الأشهر القادمة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 p-1">
            {([3, 4] as const).map((value) => <button key={value} onClick={() => setHorizon(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${horizon === value ? "bg-white text-slate-900 shadow" : "text-slate-200 hover:bg-white/10"}`}>{value} أشهر قادمة</button>)}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4">
            <div className="flex items-center gap-2 text-xs text-red-100"><TrendingDown className="h-4 w-4" /> مطلوب من المستثمرين خلال الفترة</div>
            <p className="mt-2 text-2xl font-black text-white">{formatAmount(summary.required)} <span className="text-sm font-semibold text-red-100">درهم</span></p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <div className="flex items-center gap-2 text-xs text-emerald-100"><TrendingUp className="h-4 w-4" /> صافي المستلم للمستثمرين</div>
            <p className="mt-2 text-2xl font-black text-white">{formatAmount(summary.returned)} <span className="text-sm font-semibold text-emerald-100">درهم</span></p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
            <div className="flex items-center gap-2 text-xs text-amber-100"><Landmark className="h-4 w-4" /> {summary.netFunding > 0 ? "صافي التمويل بعد العوائد" : "صافي العائد بعد الالتزامات"}</div>
            <p className="mt-2 text-2xl font-black text-white">{formatAmount(summary.netFunding)} <span className="text-sm font-semibold text-amber-100">درهم</span></p>
          </div>
        </div>
        {liquidity.peakMonth && <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs"><span className="font-bold text-amber-200">{liquidity.peakKind === "required" ? "أعلى ضغط تمويلي:" : "أعلى عائد متوقع:"}</span><span className="font-black text-white">{monthLabel(liquidity.peakMonth.monthDate)}</span><span className={liquidity.peakKind === "required" ? "font-black text-red-200" : "font-black text-emerald-200"}>{formatAmount(liquidity.peakKind === "required" ? liquidity.peakMonth.required : liquidity.peakMonth.returned)} درهم</span></div>}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        {alertMonths.map((month) => {
          const required = month.required;
          const returned = month.returned;
          const isOpen = openMonth === month.monthDate;
          return <div key={month.monthDate} className={`rounded-2xl border p-4 transition ${required > 0 ? "border-red-100 bg-red-50/60" : returned > 0 ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100 bg-slate-50"}`}>
            <button className="w-full text-right" onClick={() => setOpenMonth(isOpen ? null : month.monthDate)}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-slate-800">{monthLabel(month.monthDate)}</span>{isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}</div>
              {required > 0 ? <><p className="mt-4 text-[11px] font-bold text-red-600">مطلوب من المستثمرين</p><p className="mt-1 text-xl font-black text-red-700">{formatAmount(required)} <span className="text-[11px]">درهم</span></p></> : returned > 0 ? <><p className="mt-4 text-[11px] font-bold text-emerald-600">صافي مستلم للمستثمرين</p><p className="mt-1 text-xl font-black text-emerald-700">{formatAmount(returned)} <span className="text-[11px]">درهم</span></p></> : <p className="mt-4 text-sm font-bold text-slate-400">لا التزام صافٍ</p>}
              <p className={`mt-3 text-[10px] font-semibold ${month.netFunding > 0 ? "text-red-600" : month.netFunding < 0 ? "text-emerald-600" : "text-slate-500"}`}>{month.netFunding > 0 ? "صافي تمويل " : month.netFunding < 0 ? "صافي عائد " : "لا التزام صافٍ"}{month.netFunding !== 0 ? formatAmount(month.netFunding) : ""} — {month.drivers.length} مشاريع مؤثرة</p>
            </button>
            {isOpen && <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
              {month.drivers.map((driver) => <div key={driver.projectId} className="flex items-center justify-between gap-2 text-[11px]"><span className="line-clamp-1 text-slate-600">{driver.name}</span><span className={`font-bold ${driver.value < 0 ? "text-red-700" : "text-emerald-700"}`}>{driver.value < 0 ? "مطلوب " : "مستلم "}{formatAmount(driver.value)}</span></div>)}
            </div>}
          </div>;
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">المصدر هو صف «صافي الشهر» المعتمد نفسه في تقرير تجميع المشاريع؛ لا توجد أي حسابات جديدة هنا.</p>
        <button onClick={onOpenFullReport} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> فتح التقرير المجمّع الكامل</button>
      </div>
    </section>
  );
}
