import React, { useMemo } from "react";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
import { default as Download } from "lucide-react/dist/esm/icons/download.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as TrendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { default as TrendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import {
  calculateInvestorCapitalSummary,
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import { buildSalesResultFromSavedPlan } from "@/lib/salesPlanCashFlow";
import { calculateInvestorMonthlyNet } from "@/lib/investorCashFlowNet";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { formatFullNumber } from "@/lib/numberFormat";
import { formatCashFlowMonthYear, sumCashFlowPeriod } from "@/lib/cashFlowReadability";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "-";
  return formatFullNumber(n, "-");
}

function formatDate(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${monthNames[parseInt(m) - 1]} ${y}`;
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2InvestorCashFlow({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const scenario = ((projectQuery.data as any)?.financingScenario || "offplan_escrow") as Scenario;

  // ─── Parse salesResult from saved plan ─────────────────────────────────
  const salesResult = useMemo(
    () => buildSalesResultFromSavedPlan(plansQuery.data?.[0] as any, projectQuery.data, scenario),
    [plansQuery.data, projectQuery.data, scenario],
  );

  // ─── Compute cash flow from engine ─────────────────────────────────────
  const data = useMemo(() => {
    return computeInvestorCashFlow(projectQuery.data || null, scenario, undefined, salesResult);
  }, [projectQuery.data, scenario, salesResult]);

  const {
    rows,
    designDuration,
    constructionDuration,
    postDuration,
    designMonthlyTotals,
    constructionMonthlyTotals,
    postMonthlyTotals,
    revenuePostTotals,
    cumulativeDesign,
    cumulativeConstruction,
    cumulativePost,
    grandPaid,
    grandInvestor,
    totalRevenue,
    monthDates,
  } = data;

  const totalMonths = designDuration + constructionDuration + postDuration;
  const projectName = projectQuery.data?.name || "—";

  // ─── Build flat monthly arrays for each row ────────────────────────────
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  const { debitRows, creditRows, paidRows, paidBeforeSchedule, debitTotals, creditTotals, netFlow, cumulative } = calculateInvestorMonthlyNet(data, salesResult);

  const totalDebit = paidBeforeSchedule + debitTotals.reduce((s, v) => s + v, 0);
  const totalCredit = creditTotals.reduce((s, v) => s + v, 0);
  const profit = totalCredit - totalDebit;
  const capital = useMemo(() => calculateInvestorCapitalSummary(data), [data]);
  const feasibilityInvestorProfit = useMemo<number | null>(() => {
    const costs = calculateProjectCosts(projectQuery.data);
    if (!costs) return null;
    const feasibilityTotalCosts = scenario === "build_for_sale" || scenario === "build_for_rent"
      ? data.rows
        .filter((row) => !row.isRevenue && !row.isTransfer && !row.label.includes("حصة كومو"))
        .reduce((sum, row) => sum + row.totalCost, 0)
      : costs.totalCosts;
    const projectProfit = costs.totalRevenue - feasibilityTotalCosts;
    const comoShare = projectProfit > 0 ? projectProfit * 0.15 : 0;
    return projectProfit - comoShare;
  }, [data.rows, projectQuery.data, scenario]);
  const feasibilityDifference = feasibilityInvestorProfit === null ? null : profit - feasibilityInvestorProfit;
  const reconcilesWithFeasibility = feasibilityDifference !== null && Math.abs(feasibilityDifference) < 0.001;
  const matrixStart = formatDate(monthDates[0] || "");
  const matrixEnd = formatDate(monthDates[totalMonths - 1] || "");
  const matrixSummary = {
    debit: paidBeforeSchedule + sumCashFlowPeriod(debitTotals),
    credit: sumCashFlowPeriod(creditTotals),
    net: sumCashFlowPeriod(netFlow) - paidBeforeSchedule,
  };

  // ─── Month headers with phase info ─────────────────────────────────────
  const months: { label: string; date: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < designDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[i] || "", phase: "design" });
  for (let i = 0; i < constructionDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + i] || "", phase: "construction" });
  for (let i = 0; i < postDuration; i++) months.push({ label: `${i + 1}`, date: monthDates[designDuration + constructionDuration + i] || "", phase: "post" });

  const phaseColors = {
    design: "bg-blue-50 text-blue-700",
    construction: "bg-amber-50 text-amber-700",
    post: "bg-emerald-50 text-emerald-700",
  };

  const phaseNames = {
    design: "تصميم",
    construction: "إنشاء",
    post: "ما بعد الإنجاز",
  };

  const monthCaption = (index: number) => {
    const month = months[index];
    return month ? `${phaseNames[month.phase]} ${month.label}` : "—";
  };

  const deepestFundingPoint = cumulative.reduce(
    (current, value, index) => value < current.value ? { value, index } : current,
    { value: 0, index: -1 },
  );
  const firstReceiptIndex = creditTotals.findIndex((value) => value > 0);
  const pulseScale = Math.max(...netFlow.map((value) => Math.abs(value)), 1);

  // ─── Loading state ─────────────────────────────────────────────────────
  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="mr-2 text-gray-500 text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b-2 border-slate-300 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-full flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5 lg:flex-nowrap lg:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!embedded && <button onClick={() => navigate("/bateekha")} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700 bg-teal-700 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-teal-800">
              <ArrowRight className="w-4 h-4" />العودة إلى دليل الدراسات
            </button>}
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-slate-950">التدفقات النقدية للمستثمر</h1>
              <p className="text-xs font-medium text-slate-600 truncate">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden items-center gap-3 text-xs 2xl:flex">
              <span className="text-amber-700 font-semibold">رأس المال عند الذروة: {fmt(capital.requiredCapital)}</span>
              <span className="text-red-600 font-semibold">إجمالي المدفوعات: {fmt(totalDebit)}</span>
              <span className="text-green-600 font-semibold">مستلم للمستثمر: {fmt(totalCredit)}</span>
              <span className="text-blue-700 font-bold">الربح: {fmt(profit)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold">
              <Download className="w-3.5 h-3.5" /> تصدير
            </button>
          </div>
        </div>
      </div>



      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-4 text-xs font-medium text-gray-700">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-200"></span> تصميم ({designDuration} أشهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({constructionDuration} شهر)</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({postDuration} شهر)</span>
      </div>

      {/* Decision layer — all values are derived from the existing monthly arrays above. */}
      <section className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="fs-card fs-card-violet p-5 text-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
              <WalletCards className="h-4 w-4 text-violet-600" />
              موقف المستثمر — مباشر
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{fmt(profit)}</p>
            <p className="mt-1 text-xs text-slate-600">صافي النتيجة المتوقعة بعد جميع التدفقات</p>
            <div className="mt-5 border-t border-violet-200 pt-4">
              <div className="flex items-start gap-2">
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">أعلى ضغط تمويلي</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-rose-700">{fmt(Math.abs(deepestFundingPoint.value))}</p>
                  <p className="text-[11px] text-slate-600">{deepestFundingPoint.index >= 0 ? monthCaption(deepestFundingPoint.index) : "لا يوجد عجز تراكمي"}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="fs-card fs-card-blue p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-semibold text-cyan-700">لوحة القرار</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">متى يحتاج المشروع إلى رأس مال، ومتى يعيده؟</h2>
                <p className="mt-1 text-xs text-slate-500">تُقرأ الأرقام التنفيذية هنا أولًا؛ ويبقى جدول الأشهر أدناه مرجع التدقيق الكامل.</p>
              </div>
              <div className="fs-pill fs-pill-blue">{totalMonths} شهرًا ماليًا</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <div className="fs-card fs-card-amber p-3">
                <p className="text-xs font-semibold text-amber-700">رأس المال المطلوب عند الذروة</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-amber-950">{fmt(capital.requiredCapital)}</p>
                <p className="mt-1 text-[11px] text-amber-700">أقصى سيولة مطلوبة قبل استرداد الأموال</p>
              </div>
              <div className="fs-card p-3">
                <p className="text-xs font-semibold text-slate-700">مدفوع سابقًا</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{fmt(capital.paidCapital)}</p>
                <p className="mt-1 text-[11px] text-slate-600">ضمن رأس المال المطلوب</p>
              </div>
              <div className="fs-card fs-card-blue p-3">
                <p className="text-xs font-semibold text-blue-700">المتبقي للتمويل</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-blue-950">{fmt(capital.remainingCapital)}</p>
                <p className="mt-1 text-[11px] text-blue-700">حتى الوصول إلى ذروة السيولة</p>
              </div>
              <div className="fs-card fs-card-rose p-3">
                <p className="text-xs font-semibold text-rose-700">إجمالي مدفوعات المستثمر طوال المشروع</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-rose-950">{fmt(totalDebit)}</p>
                <p className="mt-1 text-[11px] text-rose-700">ليست رأس المال؛ تشمل مدفوعات بعد بدء الاسترداد</p>
              </div>
              <div className="fs-card fs-card-emerald p-3">
                <p className="text-xs font-semibold text-emerald-700">إجمالي ما يستلمه المستثمر</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-950">{fmt(totalCredit)}</p>
                <p className="mt-1 text-[11px] text-emerald-700">أول استلام: {firstReceiptIndex >= 0 ? monthCaption(firstReceiptIndex) : "—"}</p>
              </div>
              <div className="fs-card fs-card-cyan p-3">
                <p className="text-xs font-semibold text-cyan-700">صافي ربح المستثمر</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-950">{fmt(profit)}</p>
                <p className={`mt-1 text-[11px] font-bold ${feasibilityDifference === null ? "text-slate-500" : reconcilesWithFeasibility ? "text-emerald-700" : "text-rose-700"}`}>
                  {feasibilityDifference === null
                    ? "اختر مشروعًا لإجراء المطابقة"
                    : reconcilesWithFeasibility
                      ? "مطابق لدراسة الجدوى — الفرق 0 فلس"
                      : `فرق عن دراسة الجدوى: ${fmt(feasibilityDifference)}`}
                </p>
              </div>
            </div>

            <div className="fs-card fs-card-cyan mt-4 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CalendarClock className="h-4 w-4 text-cyan-700" /> نبض الضغط والعودة الشهري</div>
                <span className="text-[11px] text-slate-500">أحمر = تمويل مطلوب · أخضر = تدفق عائد</span>
              </div>
              <div className="mt-3 flex h-12 items-end gap-px" aria-label="نبض صافي التدفق الشهري">
                {netFlow.map((value, index) => {
                  const height = Math.max(8, Math.round((Math.abs(value) / pulseScale) * 100));
                  return (
                    <div key={index} className="group relative flex h-full flex-1 items-end" title={`${monthCaption(index)}: ${fmt(value)}`}>
                      <div className={`w-full rounded-t-sm ${value >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} style={{ height: `${height}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{monthCaption(0)}</span><span>{monthCaption(totalMonths - 1)}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Table */}
      <section className="border-t border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-[1800px] flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold text-slate-900">ملخص الفترة المالية في المصفوفة</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{matrixStart} — {matrixEnd} · تحرّك داخل الجدول مع بقاء الأشهر والبنود ثابتة</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"><span className="block text-rose-700">المطلوب</span><strong className="text-rose-950">{fmt(matrixSummary.debit)}</strong></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><span className="block text-emerald-700">المستلم</span><strong className="text-emerald-950">{fmt(matrixSummary.credit)}</strong></div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2"><span className="block text-cyan-700">الصافي</span><strong className="text-cyan-950">{fmt(matrixSummary.net)}</strong></div>
          </div>
        </div>
      </section>
      <div className="investor-cashflow-table-wrap max-h-[70vh] overflow-auto border-y-2 border-slate-400 bg-white">
        <table className="investor-cashflow-table w-max min-w-[860px] text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-30 bg-white shadow-md">
            {/* Date row */}
            <tr>
              <th className="sticky right-0 z-20 w-[190px] min-w-[190px] border-b-2 border-slate-400 bg-slate-200 px-3 py-2 text-right text-[11px] font-extrabold text-slate-900">التاريخ</th>
              <th className="min-w-[88px] border-s border-b-2 border-amber-500 bg-amber-100 px-1 py-2 text-center text-[10px] font-extrabold leading-4 text-amber-950"><span className="block">المدفوع</span><span className="block">مسبقًا</span></th>
              {months.map((m, i) => (
                <th key={i} className="min-w-[54px] border-s border-b-2 border-slate-400 bg-slate-100 px-1 py-2 text-center text-[10px] font-extrabold leading-4 text-slate-950">
                  {m.date && <><span className="block">{formatCashFlowMonthYear(m.date).month}</span><span className="block text-[9px] font-bold text-slate-600">{formatCashFlowMonthYear(m.date).year}</span></>}
                </th>
              ))}
            </tr>
            {/* Phase band */}
            <tr>
              <th className="sticky right-0 z-20 w-[190px] min-w-[190px] border-b-2 border-slate-400 bg-slate-200 px-3 py-1.5 text-right"></th>
              <th className="min-w-[88px] border-s border-b-2 border-amber-500 bg-amber-50 px-1 py-1.5 text-center text-[9px] font-bold text-amber-800">قبل أول شهر</th>
              {months.map((m, i) => (
                <th key={i} className={`min-w-[54px] border-s border-b-2 border-slate-400 px-1 py-1.5 text-center ${phaseColors[m.phase]} font-extrabold text-[10px] text-slate-950`}>
                  <span className="block">{phaseNames[m.phase]}</span><span className="block text-[9px] font-bold text-slate-700">شهر {m.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── مدفوع سابقاً ─── */}
            {paidRows.length > 0 && (
              <>
                <tr className="bg-gray-100">
                  <td colSpan={totalMonths + 2} className="px-3 py-1 font-bold text-gray-700 text-[11px] border-b border-gray-200">
                    مدفوع سابقاً — يدخل صافي وتراكمي التدفقات
                  </td>
                </tr>
                {paidRows.map((item, i) => (
                  <tr key={`paid-${i}`} className="border-b border-gray-100 bg-gray-50">
                    <td className="sticky right-0 z-10 w-[190px] min-w-[190px] border-l border-slate-300 bg-gray-50 px-3 py-1.5 font-bold text-slate-800">
                      {item.label}
                    </td>
                    <td className="min-w-[88px] border-s border-amber-300 bg-amber-50 px-1 py-1.5 text-center font-extrabold tabular-nums text-amber-950">{fmt(item.paid)}</td>
                    {months.map((_, monthIndex) => <td key={monthIndex} className="border-s border-slate-200 px-1 py-1.5 text-center text-slate-300">-</td>)}
                  </tr>
                ))}
              </>
            )}

            {/* ─── المصروفات (Debit) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المبالغ المطلوبة من المستثمر
              </td>
            </tr>
            {debitRows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`debit-${i}`} className={`border-b border-slate-200 hover:bg-red-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                  <td className="sticky right-0 z-10 w-[190px] min-w-[190px] border-l border-slate-300 bg-inherit px-3 py-1.5 font-bold text-slate-900">
                    {item.label}
                  </td>
                  <td className="min-w-[88px] border-s border-amber-200 bg-amber-50/60 px-1 py-1.5 text-center text-slate-300">-</td>
                  {values.map((v, j) => (
                    <td key={j} className={`border-s border-slate-200 px-1 py-1.5 text-center tabular-nums ${v > 0 ? "font-semibold text-red-700" : "text-slate-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Debit */}
            <tr className="bg-red-100/70 font-bold border-y-2 border-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <td className="sticky right-0 z-20 w-[190px] min-w-[190px] border-l border-red-400 bg-red-100 px-3 py-2 text-red-950">
                إجمالي المصروفات
              </td>
              <td className="min-w-[88px] border-s border-amber-400 bg-amber-100 px-1 py-2 text-center font-extrabold tabular-nums text-amber-950">{paidBeforeSchedule > 0 ? fmt(paidBeforeSchedule) : "-"}</td>
              {debitTotals.map((v, i) => (
                <td key={i} className="border-s border-red-200 px-1 py-2 text-center font-extrabold tabular-nums text-red-800">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Credit) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 2} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                المبالغ المستلمة للمستثمر
              </td>
            </tr>
            {creditRows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`credit-${i}`} className={`border-b border-slate-200 hover:bg-green-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                  <td className="sticky right-0 z-10 w-[190px] min-w-[190px] border-l border-slate-300 bg-inherit px-3 py-1.5 font-bold text-slate-900">
                    {item.label}
                  </td>
                  <td className="min-w-[88px] border-s border-amber-200 bg-amber-50/60 px-1 py-1.5 text-center text-slate-300">-</td>
                  {values.map((v, j) => (
                    <td key={j} className={`border-s border-slate-200 px-1 py-1.5 text-center tabular-nums ${v > 0 ? "font-semibold text-emerald-700" : "text-slate-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Credit */}
            <tr className="bg-green-100/70 font-bold border-y-2 border-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <td className="sticky right-0 z-20 w-[190px] min-w-[190px] border-l border-emerald-400 bg-emerald-100 px-3 py-2 text-emerald-950">
                إجمالي الإيرادات
              </td>
              <td className="min-w-[88px] border-s border-amber-400 bg-amber-100 px-1 py-2 text-center text-slate-400">-</td>
              {creditTotals.map((v, i) => (
                <td key={i} className="border-s border-emerald-200 px-1 py-2 text-center font-extrabold tabular-nums text-emerald-800">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-cyan-100/80 font-bold border-y-2 border-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <td className="sticky right-0 z-20 w-[190px] min-w-[190px] border-l border-cyan-500 bg-cyan-100 px-3 py-2 text-cyan-950">
                صافي الشهر
              </td>
              <td className="min-w-[88px] border-s border-amber-400 bg-amber-100 px-1 py-2 text-center tabular-nums font-extrabold text-red-700">{paidBeforeSchedule > 0 ? `-${fmt(paidBeforeSchedule)}` : "-"}</td>
              {netFlow.map((v, i) => (
                <td key={i} className={`border-s border-cyan-200 px-1 py-2 text-center tabular-nums font-extrabold ${v >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التراكمي ─── */}
            <tr className="bg-violet-100/70 font-bold border-y-2 border-violet-300">
              <td className="sticky right-0 z-20 w-[190px] min-w-[190px] border-l border-violet-400 bg-violet-100 px-3 py-2 text-violet-950">
                التراكمي
              </td>
              <td className="min-w-[88px] border-s border-amber-400 bg-amber-100 px-1 py-2 text-center tabular-nums font-extrabold text-red-700">{paidBeforeSchedule > 0 ? `-${fmt(paidBeforeSchedule)}` : "-"}</td>
              {cumulative.map((v, i) => (
                <td key={i} className={`border-s border-violet-200 px-1 py-2 text-center tabular-nums font-extrabold ${v >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
