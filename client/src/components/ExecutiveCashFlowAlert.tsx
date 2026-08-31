import { useMemo, useState } from "react";
import { default as CalendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
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

function flowLabel(value: number) {
  if (value < -0.000001) return { label: "مطلوب", amount: formatAmount(value), tone: "text-red-700" };
  if (value > 0.000001) return { label: "مستلم", amount: formatAmount(value), tone: "text-emerald-700" };
  return { label: "لا حركة", amount: "—", tone: "text-slate-400" };
}

/**
 * Read-only four-month decision surface. It only groups the completed Unified
 * Group Cash Flow cells by their existing source kind; no cash-flow formula is
 * recalculated here. Negative = funding required, positive = money returned.
 * The two parts always reconcile to the displayed month.
 */
type ExecutiveCashFlowAlertProps = {
  memberToken?: string;
};

export default function ExecutiveCashFlowAlert({ memberToken }: ExecutiveCashFlowAlertProps) {
  const [horizon, setHorizon] = useState<3 | 4>(4);
  const unifiedReportQuery = trpc.cashFlowSettings.getUnifiedGroupCashFlows.useQuery(
    memberToken ? { commandCenterToken: memberToken } : undefined,
    { staleTime: 0 },
  );
  const report = unifiedReportQuery.data as UnifiedGroupCashFlow | null | undefined;
  const liquidity = useMemo(() => report ? buildUnifiedGroupLiquidity(report, { horizon }) : null, [report, horizon]);
  const alertMonths = liquidity?.months || [];
  const summary = liquidity?.summary || { required: 0, returned: 0, netFunding: 0 };

  if (unifiedReportQuery.isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">جاري تجهيز احتياج المجموعة...</div>;
  }

  if (alertMonths.length === 0) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">لا توجد تدفقات مستقبلية متاحة حاليًا.</div>;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)]" dir="rtl" data-testid="executive-cash-flow-alert">
      <div className="grid gap-4 border-b border-slate-200 bg-gradient-to-l from-slate-50 via-white to-amber-50/60 px-4 py-4 sm:px-5 lg:grid-cols-[1fr_300px] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-950">احتياج المجموعة خلال الأشهر القادمة</h2>
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                {([3, 4] as const).map((value) => (
                  <button key={value} onClick={() => setHorizon(value)} className={`rounded-md px-2.5 py-1 text-[10px] font-black transition ${horizon === value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                    {value} أشهر
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">إجمالي المجموعة، ثم تقسيم كل شهر بين المشاريع والمركز التجاري.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 px-5 py-3.5 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300"><Landmark className="h-4 w-4" /> إجمالي المطلوب خلال {horizon} أشهر</div>
          <p className="mt-1 text-2xl font-black tabular-nums">{formatAmount(summary.required)} <span className="text-xs font-bold text-slate-300">درهم</span></p>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="hidden grid-cols-[0.8fr_1fr_1.25fr_1.05fr] gap-3 border-b border-slate-200 px-3 pb-2 text-[10px] font-black text-slate-500 md:grid">
          <span>الشهر</span>
          <span>إجمالي الشهر</span>
          <span>مشاريع البيع والاستثمار</span>
          <span>تطوير المركز التجاري</span>
        </div>
        <div className="divide-y divide-slate-100">
          {alertMonths.map((month) => {
            const total = flowLabel(month.total);
            const projects = flowLabel(month.saleInvestmentNet);
            const commercial = flowLabel(month.commercialDevelopmentNet);

            return (
              <div key={month.monthDate} data-testid={`executive-cash-flow-month-${month.monthDate}`} className="grid gap-2 px-3 py-3 md:grid-cols-[0.8fr_1fr_1.25fr_1.05fr] md:items-center md:gap-3">
                <div className="flex items-center justify-between md:block">
                  <span className="text-sm font-black text-slate-900">{monthLabel(month.monthDate)}</span>
                  <span className="text-[10px] font-bold text-slate-400 md:hidden">الشهر</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 md:block md:bg-transparent md:px-0 md:py-0">
                  <span className="text-[10px] font-bold text-slate-500 md:hidden">إجمالي الشهر</span>
                  <span className={`text-sm font-black tabular-nums ${total.tone}`}>{total.label} {total.amount}{total.amount !== "—" ? " درهم" : ""}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/55 px-3 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0">
                  <span className="text-[10px] font-bold text-violet-700 md:hidden">مشاريع البيع والاستثمار</span>
                  <span className={`text-xs font-black tabular-nums ${projects.tone}`}>{projects.label} {projects.amount}{projects.amount !== "—" ? " درهم" : ""}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-100 bg-teal-50/55 px-3 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0">
                  <span className="text-[10px] font-bold text-teal-700 md:hidden">تطوير المركز التجاري</span>
                  <span className={`text-xs font-black tabular-nums ${commercial.tone}`}>{commercial.label} {commercial.amount}{commercial.amount !== "—" ? " درهم" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
