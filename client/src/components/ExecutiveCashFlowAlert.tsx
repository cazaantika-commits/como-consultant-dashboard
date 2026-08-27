import { useMemo, useState } from "react";
import { default as AlertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { default as ChevronUp } from "lucide-react/dist/esm/icons/chevron-up.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as TrendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { default as TrendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { trpc } from "@/lib/trpc";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  buildUnifiedGroupLiquidity,
  type UnifiedGroupCashFlow,
} from "@/lib/unifiedGroupCashFlow";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function monthLabel(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatAmount(value: number) {
  return formatFullNumber(Math.abs(value), "0");
}

type ExecutiveCashFlowAlertProps = {
  onOpenFullReport: () => void;
  onOpenLiquidityReport?: () => void;
};

/**
 * Read-only decision surface for the Command Center. It deliberately consumes
 * the completed Unified Group Cash Flow report: negative = funding required,
 * positive = money returned. No cash-flow engine is duplicated here.
 */
export default function ExecutiveCashFlowAlert({ onOpenFullReport, onOpenLiquidityReport }: ExecutiveCashFlowAlertProps) {
  const [horizon, setHorizon] = useState<3 | 4>(4);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const unifiedReportQuery = trpc.cashFlowSettings.getUnifiedGroupCashFlows.useQuery(undefined, { staleTime: 0 });
  const escrowLiquidityQuery = trpc.cashFlowSettings.getPortfolioEscrowLiquidity.useQuery(undefined, { staleTime: 0 });
  const report = unifiedReportQuery.data as UnifiedGroupCashFlow | null | undefined;

  const liquidity = useMemo(() => report ? buildUnifiedGroupLiquidity(report, { horizon }) : null, [report, horizon]);
  const alertMonths = liquidity?.months || [];
  const summary = liquidity?.summary || { required: 0, returned: 0, netFunding: 0 };
  const escrowDeficits = (escrowLiquidityQuery.data || []).filter((project: any) => project.liquidity?.hasDeficit);
  const earliestEscrowDeficit = escrowDeficits
    .map((project: any) => ({ project, index: project.liquidity.firstDeficitIndex as number }))
    .sort((left, right) => left.project.monthDates[left.index].localeCompare(right.project.monthDates[right.index]))[0];

  if (unifiedReportQuery.isLoading) {
    return <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">جاري تجهيز ملخص التدفقات الموحدة...</div>;
  }

  if (alertMonths.length === 0) {
    return <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">لا توجد تدفقات مستقبلية متاحة لعرضها حاليًا.</div>;
  }

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" dir="rtl" data-testid="executive-cash-flow-alert">
      <div className="relative overflow-hidden border-b border-indigo-100 bg-gradient-to-l from-indigo-50 via-white to-amber-50 px-5 py-5 sm:px-7">
        <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-amber-700">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-700">لِلْقَرار التنفيذي</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">التزامات المجموعة القادمة</h2>
              <p className="mt-1 text-xs text-slate-600">ما المطلوب، متى، ومن أي مشروع خلال الأشهر القادمة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white/85 p-1 shadow-sm">
            {([3, 4] as const).map((value) => <button key={value} onClick={() => setHorizon(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${horizon === value ? "bg-slate-800 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>{value} أشهر قادمة</button>)}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-200 bg-red-50/85 p-4">
            <div className="flex items-center gap-2 text-xs text-red-700"><TrendingDown className="h-4 w-4" /> مطلوب من المستثمرين خلال الفترة</div>
            <p className="mt-2 text-2xl font-black text-red-800">{formatAmount(summary.required)} <span className="text-sm font-semibold text-red-700">درهم</span></p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/85 p-4">
            <div className="flex items-center gap-2 text-xs text-emerald-700"><TrendingUp className="h-4 w-4" /> صافي المستلم للمستثمرين</div>
            <p className="mt-2 text-2xl font-black text-emerald-800">{formatAmount(summary.returned)} <span className="text-sm font-semibold text-emerald-700">درهم</span></p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
            <div className="flex items-center gap-2 text-xs text-amber-800"><Landmark className="h-4 w-4" /> {summary.netFunding > 0 ? "صافي التمويل بعد العوائد" : "صافي العائد بعد الالتزامات"}</div>
            <p className="mt-2 text-2xl font-black text-amber-900">{formatAmount(summary.netFunding)} <span className="text-sm font-semibold text-amber-800">درهم</span></p>
          </div>
        </div>
        {liquidity?.peakMonth && <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/75 px-4 py-2.5 text-xs"><span className="font-bold text-amber-800">{liquidity.peakKind === "required" ? "أعلى ضغط تمويلي:" : "أعلى عائد متوقع:"}</span><span className="font-black text-slate-900">{monthLabel(liquidity.peakMonth.monthDate)}</span><span className={liquidity.peakKind === "required" ? "font-black text-red-700" : "font-black text-emerald-700"}>{formatAmount(liquidity.peakKind === "required" ? liquidity.peakMonth.required : liquidity.peakMonth.returned)} درهم</span></div>}
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

      {earliestEscrowDeficit && <div className="mx-5 mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="executive-escrow-deficit-alert">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><AlertTriangle className="h-4 w-4" /></span><div><p className="text-xs font-black text-red-800">إنذار مبكر: عجز سيولة في حسابات الضمان</p><p className="mt-1 text-xs leading-5 text-red-700">{escrowDeficits.length} مشاريع تحتاج قراراً. أول عجز: <strong>{earliestEscrowDeficit.project.name}</strong> في {monthLabel(earliestEscrowDeficit.project.monthDates[earliestEscrowDeficit.index])} بقيمة {formatAmount(earliestEscrowDeficit.project.liquidity.firstDeficit)} درهم.</p></div></div>
        {onOpenLiquidityReport && <button onClick={onOpenLiquidityReport} className="shrink-0 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100">فتح مقارنة سيولة الإسكرو</button>}
      </div>}

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">المصدر هو التقرير الموحد نفسه: صف صافي الشهر النهائي لكل مشروع، مع المركز التجاري كتطوير قبل التشغيل فقط؛ لا توجد أي حسابات أو إيجارات جديدة هنا.</p>
        <button onClick={onOpenFullReport} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> فتح تقرير التدفقات الموحد</button>
      </div>
    </section>
  );
}
