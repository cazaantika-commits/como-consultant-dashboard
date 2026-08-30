import { useMemo, useState, type ReactNode } from "react";
import { default as Layers3 } from "lucide-react/dist/esm/icons/layers-3.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as TrendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { default as TrendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { trpc } from "@/lib/trpc";
import { FinancialSourceValue } from "@/components/FinancialSourceTrace";
import { combineFinancialTraceBreakdowns } from "@/lib/financialTraceBreakdown";
import { formatFullNumber } from "@/lib/numberFormat";
import {
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

  const totals = useMemo(() => {
    if (!report) return { paidBefore: 0, debit: 0, credit: 0, net: 0 };
    return {
      paidBefore: report.paidBeforeScheduleTotal,
      debit: report.paidBeforeScheduleTotal + report.debitTotals.reduce((sum, value) => sum + value, 0),
      credit: report.creditTotals.reduce((sum, value) => sum + value, 0),
      net: -report.paidBeforeScheduleTotal + report.totals.reduce((sum, value) => sum + value, 0),
    };
  }, [report]);

  if (reportQuery.isLoading) {
    return <div className="min-h-[420px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500" dir="rtl">جاري تحميل التدفقات النقدية الموحدة...</div>;
  }

  if (!report || report.rows.length === 0 || report.monthDates.length === 0) {
    return <div className="min-h-[420px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500" dir="rtl">لا توجد تدفقات شهرية معتمدة لعرضها حاليًا.</div>;
  }

  const commercialCenter = report.rows.find((row) => row.sourceKind === "commercial_development");

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

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<Landmark className="h-4 w-4" />} tone="slate" label="مدفوع مسبقًا" value={unsignedAmount(totals.paidBefore)} />
          <SummaryCard icon={<TrendingDown className="h-4 w-4" />} tone="red" label="إجمالي الصرف من المصدر" value={unsignedAmount(totals.debit)} />
          <SummaryCard icon={<TrendingUp className="h-4 w-4" />} tone="emerald" label="إجمالي الاستلام من المصدر" value={unsignedAmount(totals.credit)} />
          <SummaryCard icon={<WalletCards className="h-4 w-4" />} tone={totals.net >= 0 ? "emerald" : "amber"} label={totals.net >= 0 ? "صافي العائد في النطاق" : "صافي التمويل في النطاق"} value={signedAmount(totals.net)} />
        </section>

        {liquidity && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-l from-amber-50 via-white to-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-black text-slate-900">قراءة القرار القريب</p><p className="mt-0.5 text-[10px] text-slate-500">مشتقة من خلايا التقرير أعلاه فقط؛ لا تُضيف حركات جديدة.</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setHorizon(3)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${horizon === 3 ? "bg-slate-900 text-white" : "text-slate-600"}`}>3 أشهر</button><button onClick={() => setHorizon(4)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${horizon === 4 ? "bg-slate-900 text-white" : "text-slate-600"}`}>4 أشهر</button></div>
            </div>
            <div className="grid gap-3 p-3 md:grid-cols-4">
              {liquidity.months.map((month) => <div key={month.monthDate} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-xs font-black text-slate-800">{formatMonth(month.monthDate)}</p><p className={`mt-2 text-base font-black tabular-nums ${month.total < 0 ? "text-red-700" : month.total > 0 ? "text-emerald-700" : "text-slate-500"}`}>{signedAmount(month.total)} <span className="text-[10px]">درهم</span></p><p className="mt-1 text-[10px] font-semibold text-slate-500">{month.drivers.length} مشاريع مؤثرة</p></div>)}
            </div>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b-2 border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-slate-950">الحركة الشهرية الموحّدة</h2><p className="mt-0.5 text-[10px] text-slate-500">السالب = تمويل مطلوب، والموجب = استلام. انقر على الرقم لمصدر الحركة وتفصيلها.</p></div><div className="flex gap-2 text-[10px] font-bold"><span className="rounded-full bg-red-50 px-2 py-1 text-red-700">− مطلوب</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">+ مستلم</span></div></div>
          <div className="overflow-x-auto lg:overflow-x-hidden">
            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-[clamp(8px,0.55vw,10px)]">
              <colgroup><col className="w-[8%]" />{report.rows.map((row) => <col key={row.projectId} className="w-[10.5%]" />)}<col className="w-[14%]" /><col className="w-[15%]" /></colgroup>
              <thead><tr className="bg-slate-900 text-white"><th className="sticky right-0 z-20 border-l border-slate-600 bg-slate-900 px-2 py-2.5 text-right font-black">الشهر</th>{report.rows.map((row) => <th key={row.projectId} title={row.name} className={`border-l border-slate-600 px-1.5 py-2.5 text-center font-black ${row.sourceKind === "commercial_development" ? "bg-cyan-900" : ""}`}><span className="block whitespace-nowrap leading-4">{shortProjectName(row.name)}</span>{row.sourceKind === "commercial_development" && <span className="mt-1 inline-block rounded bg-cyan-50/15 px-1 py-0.5 text-[8px] font-bold text-cyan-100">قبل التشغيل</span>}</th>)}<th className="border-r-2 border-slate-400 bg-teal-800 px-2 py-2.5 text-center font-black">إجمالي المجموعة</th><th className="border-r border-slate-600 bg-slate-800 px-2 py-2.5 text-center font-black">التراكمي</th></tr></thead>
              <tbody>
                <tr className="border-b-2 border-slate-700 bg-slate-100"><td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-300 bg-slate-100 px-2 py-2 text-right font-black text-slate-900">مدفوع مسبقًا</td>{report.rows.map((row) => { const paid = report.projects.find((project) => project.projectId === row.projectId)?.paidBeforeSchedule || 0; return <td key={row.projectId} className="whitespace-nowrap border-l border-slate-200 px-1 py-2 text-center font-black tabular-nums text-red-800">{paid > 0 ? `−${unsignedAmount(paid)}` : "—"}</td>; })}<td className="whitespace-nowrap border-r-2 border-slate-400 bg-slate-200 px-2 py-2 text-center font-black tabular-nums text-red-900">{report.paidBeforeScheduleTotal > 0 ? `−${unsignedAmount(report.paidBeforeScheduleTotal)}` : "—"}</td><td className="whitespace-nowrap border-r border-slate-300 bg-slate-200 px-2 py-2 text-center font-black tabular-nums text-red-900">{report.paidBeforeScheduleTotal > 0 ? `−${unsignedAmount(report.paidBeforeScheduleTotal)}` : "—"}</td></tr>
                {report.monthDates.map((monthDate, monthIndex) => {
                  const total = report.totals[monthIndex] || 0;
                  const cumulative = report.cumulativeTotals[monthIndex] || 0;
                  const groupTrace = combineFinancialTraceBreakdowns(report.rows.map((row) => row.monthlyTrace?.[monthIndex]));
                  return <tr key={monthDate} className="even:bg-slate-50"><td className="sticky right-0 z-10 whitespace-nowrap border-b border-l border-slate-300 bg-inherit px-2 py-2 text-right font-black text-slate-800">{formatMonth(monthDate)}</td>{report.rows.map((row) => { const value = row.values[monthIndex] || 0; const kind = flowKind(value); const trace = row.monthlyTrace?.[monthIndex]; return <td key={row.projectId} className={`whitespace-nowrap border-b border-l border-slate-200 px-1 py-2 text-center font-bold tabular-nums ${kind === "required" ? "text-red-700" : kind === "returned" ? "text-emerald-700" : "text-slate-300"}`}>{kind === "zero" ? "—" : <FinancialSourceValue testId={`unified-group-trace-project-${row.projectId}-${monthIndex}`} trace={{ report: "التدفقات النقدية الموحدة للمجموعة", project: row.name, row: row.sourceLabel, period: formatMonth(monthDate), rule: row.sourceKind === "commercial_development" ? "نسخ صافي التدفقات المعتمدة لتطوير المركز التجاري قبل التشغيل، بلا إيجارات أو مصاريف تشغيل مقدّرة." : "نسخ صف صافي الشهر النهائي المعتمد من تقرير تدفقات المستثمر بعد محاذاة التاريخ.", value, expenses: trace?.expenses, receipts: trace?.receipts }}>{signedAmount(value)}</FinancialSourceValue>}</td>; })}<td className={`whitespace-nowrap border-b border-r-2 border-slate-300 bg-teal-50 px-2 py-2 text-center font-black tabular-nums ${flowKind(total) === "required" ? "text-red-800" : flowKind(total) === "returned" ? "text-emerald-800" : "text-slate-400"}`}>{flowKind(total) === "zero" ? "—" : <FinancialSourceValue testId={`unified-group-trace-total-${monthIndex}`} trace={{ report: "التدفقات النقدية الموحدة للمجموعة", project: "جميع المشاريع", row: "إجمالي المجموعة", period: formatMonth(monthDate), rule: "مجموع صفوف صافي الشهر المنسوخة للمشاريع كافة في الشهر نفسه.", value: total, expenses: groupTrace.expenses, receipts: groupTrace.receipts, contributors: report.rows.map((row) => ({ name: row.name, value: row.values[monthIndex] || 0 })) }}>{signedAmount(total)}</FinancialSourceValue>}</td><td className={`whitespace-nowrap border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-black tabular-nums ${flowKind(cumulative) === "required" ? "text-red-800" : flowKind(cumulative) === "returned" ? "text-emerald-800" : "text-slate-500"}`}>{signedAmount(cumulative)}</td></tr>;
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

function SummaryCard({ icon, tone, label, value, valueClassName = "", unit = "درهم" }: { icon: ReactNode; tone: "red" | "emerald" | "amber" | "slate"; label: string; value: string; valueClassName?: string; unit?: string }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-white text-slate-900",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><div className="flex items-center gap-2 text-[11px] font-bold opacity-80">{icon}{label}</div><p className={`mt-2 text-xl font-black tabular-nums ${valueClassName}`}>{value}</p>{unit && <span className="text-[10px] font-bold opacity-70">{unit}</span>}</div>;
}
