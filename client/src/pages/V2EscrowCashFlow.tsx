import { useMemo } from "react";
import { default as AlertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
import { default as Download } from "lucide-react/dist/esm/icons/download.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { useLocation } from "wouter";
import { resolveReturnPath } from "@/lib/returnNavigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import { calculateEscrowMonthlyBalance } from "@/lib/escrowSettlement";
import { formatFullNumber } from "@/lib/numberFormat";
import { buildSalesResultFromSavedPlan } from "@/lib/salesPlanCashFlow";
import { formatCashFlowMonthYear, sumCashFlowPeriod } from "@/lib/cashFlowReadability";
import { getJointVentureInputReadiness, hasApprovedWaelSalesIndicator } from "@/lib/jointVentureInputReadiness";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "-";
  return formatFullNumber(n, "-");
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function V2EscrowCashFlow({ embedded = false }: { embedded?: boolean } = {}) {
  const [location, navigate] = useLocation();
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
  const inputReadiness = useMemo(() => getJointVentureInputReadiness(projectQuery.data), [projectQuery.data]);
  const hasApprovedSalesIndicator = useMemo(
    () => hasApprovedWaelSalesIndicator(plansQuery.data?.[0]),
    [plansQuery.data],
  );
  const hasIncompleteJointVentureInputs = inputReadiness.applies
    && (!inputReadiness.financialModelReady || !hasApprovedSalesIndicator);

  // One canonical saved-plan adapter keeps Escrow Cash Flow aligned with every
  // Sales, Settings, Investor Cash Flow, and Feasibility timing correction.
  const salesResult = useMemo(() => {
    const plan = plansQuery.data?.[0] as any;
    if (!plan || !projectQuery.data) return undefined;
    return buildSalesResultFromSavedPlan(plan, projectQuery.data, scenario);
  }, [plansQuery.data, projectQuery.data, scenario]);

  // ─── Compute cash flow from engine ─────────────────────────────────────
  const data = useMemo(() => {
    return computeInvestorCashFlow(projectQuery.data || null, scenario, undefined, salesResult);
  }, [projectQuery.data, scenario, salesResult]);

  const {
    rows,
    designDuration,
    constructionDuration,
    postDuration,
    monthDates,
  } = data;

  const totalMonths = designDuration + constructionDuration + postDuration;
  const projectName = projectQuery.data?.name || "—";
  const postStartIdx = designDuration + constructionDuration;
  const liq1MonthIdx = postStartIdx + 2;
  const liq2MonthIdx = postStartIdx + 12;

  // ─── Separate escrow rows: outflows (funder=escrow) and inflows ────────
  // Escrow outflows = items paid FROM escrow (funder=escrow, not revenue)
  const escrowOutflows = rows.filter((r) => r.funder === "escrow" && !r.isRevenue);
  // Templates supply the two settlement row labels; their live values come from
  // the shared monthly-balance result below.
  const liquidationRows = rows.filter((r) => r.isRevenue && r.label.includes("تصفية حساب الضمان"));
  // Escrow inflows = investor deposit (20% construction) + buyer payments from sales
  // The engine doesn't have a separate "escrow inflow" row, so we compute it:
  // - Opening deposit: 20% of construction cost at start of construction
  // - Sales income: from salesResult escrowData (monthly income during sales)

  // Build flat monthly arrays for each row
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];

  // Sales income from the engine's used Sales Plan (including its generated fallback).
  const effectiveSalesResult = data.usedSalesResult || salesResult;
  const escrowBalance = useMemo(() => calculateEscrowMonthlyBalance({
    rows,
    designDuration,
    constructionDuration,
    postDuration,
    salesResult: effectiveSalesResult,
  }), [rows, designDuration, constructionDuration, postDuration, effectiveSalesResult]);
  const depositRow = { label: escrowBalance.depositLabel, values: escrowBalance.depositValues };
  const salesIncomeRow = { label: "مبيعات أوف بلان (أقساط المشترين)", values: escrowBalance.salesIncomeValues };

  const inflowRows = [depositRow, salesIncomeRow];
  const inflowTotals = escrowBalance.inflowTotals;
  const actualLiq1 = escrowBalance.firstLiquidation;
  const actualLiq2 = escrowBalance.finalLiquidation;
  const finalOutflowTotals = escrowBalance.outflowTotals;
  const netFlow = escrowBalance.netFlow;
  const cumulative = escrowBalance.cumulative;
  const totalOutflow = finalOutflowTotals.reduce((s, v) => s + v, 0);
  const totalInflow = inflowTotals.reduce((s, v) => s + v, 0);
  const finalBalance = cumulative[cumulative.length - 1] || 0;
  const escrowMatrixStart = formatCashFlowMonthYear(monthDates[0] || "");
  const escrowMatrixEnd = formatCashFlowMonthYear(monthDates[totalMonths - 1] || "");
  const escrowMatrixSummary = {
    outflow: sumCashFlowPeriod(finalOutflowTotals),
    inflow: sumCashFlowPeriod(inflowTotals),
    closing: finalBalance,
  };

  // ─── Month headers ─────────────────────────────────────────────────────
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

  const firstBuyerReceiptIndex = salesIncomeRow.values.findIndex((value) => value > 0);
  const peakBalance = cumulative.reduce(
    (current, value, index) => value > current.value ? { value, index } : current,
    { value: Number.NEGATIVE_INFINITY, index: -1 },
  );
  const firstFundingIndex = inflowTotals.findIndex((value) => value > 0);
  const workingEndIndex = Math.min(Math.max(liq1MonthIdx, 0), totalMonths - 1);
  const activeBalances = cumulative.slice(Math.max(firstFundingIndex, 0), workingEndIndex + 1);
  const lowestWorkingBalance = activeBalances.reduce(
    (current, value, offset) => value < current.value ? { value, index: Math.max(firstFundingIndex, 0) + offset } : current,
    { value: Number.POSITIVE_INFINITY, index: -1 },
  );
  const balancePulseScale = Math.max(...cumulative.map((value) => Math.abs(value)), 1);
  const hasEscrowDeficit = lowestWorkingBalance.value < 0;

  // ─── Loading state ─────────────────────────────────────────────────────
  if (projectQuery.isLoading || plansQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="mr-2 text-gray-500 text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  if (scenario === "no_offplan" || scenario === "build_for_sale" || scenario === "build_for_rent") {
    return (
      <div className="min-h-[320px] bg-gray-50 p-6" dir="rtl">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <h1 className="text-base font-bold text-amber-950">حساب الضمان غير منطبق</h1>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            هذا المشروع من نوع البناء للبيع؛ لذلك يمول المستثمر الإنشاء مباشرة وتدخل حصيلة بيع الوحدات إلى حسابه بعد الإنجاز، من دون حساب ضمان.
          </p>
        </div>
      </div>
    );
  }

  if (hasIncompleteJointVentureInputs) {
    const missing = [...inputReadiness.missingLabels];
    if (!hasApprovedSalesIndicator) missing.push("مؤشر توزيع المبيعات المعتمد من وائل");
    return (
      <div className="min-h-[320px] bg-gray-50 p-6" dir="rtl">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-amber-300 bg-amber-50 p-8 text-center shadow-sm">
          <Landmark className="mx-auto h-9 w-9 text-amber-700" />
          <h1 className="mt-3 text-base font-black text-slate-950">حساب الضمان بانتظار مدخلات المشروع</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
            لا يمكن عرض رصيد أو مصروفات أو تحصيلات أو تسويات قبل اكتمال: {Array.from(new Set(missing)).join("، ")}.
          </p>
          <p className="mt-2 text-xs font-bold text-amber-800">لن يستخدم النظام مددًا أو تكاليف أو تحصيلات افتراضية لهذا المشروع التجريبي.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!embedded && <button onClick={() => navigate(resolveReturnPath(location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search, "/v2"))} className="p-1.5 rounded-lg hover:bg-gray-100 transition" aria-label="العودة إلى الصفحة السابقة">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>}
            <div>
              <h1 className="text-[10px] font-bold text-gray-900">التدفقات النقدية — حساب الضمان (Escrow)</h1>
              <p className="text-[10px] text-gray-500">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalOutflow)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalInflow)}</span>
              <span className={`font-bold ${finalBalance >= 0 ? "text-green-700" : "text-red-600"}`}>الرصيد: {fmt(finalBalance)}</span>
            </div>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-[10px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>



      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-1 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> تصميم ({designDuration} أشهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({constructionDuration} شهر)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({postDuration} شهر)</span>
      </div>

      {/* Decision layer — derived only from the existing escrow arrays and settlement logic above. */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="fs-card fs-card-teal p-5 text-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700"><Landmark className="h-4 w-4 text-teal-600" /> حساب الضمان — موقف السيولة</div>
            <div className="mt-4 flex items-center gap-3">
              {hasEscrowDeficit ? <AlertTriangle className="h-7 w-7 text-rose-300" /> : <ShieldCheck className="h-7 w-7 text-emerald-300" />}
              <div>
                <p className="text-lg font-bold">{hasEscrowDeficit ? "تنبيه سيولة" : "سيولة الإسكرو مريحة"}</p>
                <p className="text-xs text-slate-600">{hasEscrowDeficit ? "الرصيد يهبط تحت الصفر في المسار الحالي" : "لا يوجد عجز في الرصيد التشغيلي"}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-teal-200 pt-4">
              <p className="text-xs font-semibold text-slate-700">أدنى رصيد عامل قبل التصفية</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${hasEscrowDeficit ? "text-rose-700" : "text-emerald-700"}`}>{fmt(lowestWorkingBalance.value)}</p>
              <p className="mt-1 text-[11px] text-slate-600">{lowestWorkingBalance.index >= 0 ? monthCaption(lowestWorkingBalance.index) : "—"}</p>
            </div>
          </aside>

          <div className="fs-card fs-card-cyan p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-semibold text-cyan-700">لوحة القرار</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">كيف يتكوّن رصيد الإسكرو، ومتى يُفرج عنه؟</h2>
                <p className="mt-1 text-xs text-slate-500">ملخص سيولة واضح فوق سجل الحركة الشهري الكامل، من دون تعديل أي قاعدة تسوية أو تحصيل.</p>
              </div>
              <div className="fs-pill fs-pill-teal">{totalMonths} شهرًا ماليًا</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="fs-card fs-card-emerald p-3">
                <p className="text-xs font-semibold text-emerald-700">إجمالي ما دخل الإسكرو</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-950">{fmt(totalInflow)}</p>
                <p className="mt-1 text-[11px] text-emerald-700">أول تحصيل مشترين: {firstBuyerReceiptIndex >= 0 ? monthCaption(firstBuyerReceiptIndex) : "—"}</p>
              </div>
              <div className="fs-card fs-card-rose p-3">
                <p className="text-xs font-semibold text-rose-700">إجمالي ما خرج من الإسكرو</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-rose-950">{fmt(totalOutflow)}</p>
                <p className="mt-1 text-[11px] text-rose-700">يشمل مصروفات التنفيذ والتصفية النظامية</p>
              </div>
              <div className="fs-card fs-card-violet p-3">
                <p className="text-xs font-semibold text-violet-700">أعلى رصيد في الحساب</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-violet-950">{fmt(peakBalance.value)}</p>
                <p className="mt-1 text-[11px] text-violet-700">{peakBalance.index >= 0 ? monthCaption(peakBalance.index) : "—"}</p>
              </div>
              <div className="fs-card fs-card-cyan p-3">
                <p className="text-xs font-semibold text-cyan-700">إغلاق الحساب</p>
                <p className="mt-2 text-2xl font-bold text-cyan-950">{Math.abs(finalBalance) < 1 ? "مغلق" : fmt(finalBalance)}</p>
                <p className="mt-1 text-[11px] text-cyan-700">بعد الاحتجاز والتسوية النهائية</p>
              </div>
            </div>

            <div className="fs-card fs-card-cyan mt-4 px-4 py-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CalendarClock className="h-4 w-4 text-cyan-700" /> مسار الرصيد ومحطات التصفية</div>
                <span className="text-[11px] text-slate-500">يرتفع بالتحصيل وينخفض بالصرف والتحويلات</span>
              </div>
              <div className="mt-3 flex h-12 items-end gap-px" aria-label="مسار الرصيد التراكمي لحساب الضمان">
                {cumulative.map((value, index) => {
                  const height = Math.max(8, Math.round((Math.abs(value) / balancePulseScale) * 100));
                  const isSettlement = index === liq1MonthIdx || index === liq2MonthIdx;
                  return (
                    <div key={index} className="group relative flex h-full flex-1 items-end" title={`${monthCaption(index)}: ${fmt(value)}`}>
                      <div className={`w-full rounded-t-sm ${value < 0 ? "bg-rose-400" : isSettlement ? "bg-violet-500" : "bg-emerald-400"}`} style={{ height: `${height}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                <div className="fs-card fs-card-violet rounded-lg px-3 py-2 text-slate-600"><span className="font-semibold text-violet-700">تحويل 1:</span> {fmt(actualLiq1)} · {monthCaption(liq1MonthIdx)}</div>
                <div className="fs-card fs-card-violet rounded-lg px-3 py-2 text-slate-600"><span className="font-semibold text-violet-700">تحويل الاحتجاز:</span> {fmt(actualLiq2)} · {monthCaption(liq2MonthIdx)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Table */}
      <section className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1800px] flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold text-slate-900">ملخص الفترة المالية في المصفوفة</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{escrowMatrixStart.month} {escrowMatrixStart.year} — {escrowMatrixEnd.month} {escrowMatrixEnd.year} · تحرّك داخل الجدول مع بقاء الأشهر والبنود ثابتة</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"><span className="block text-rose-700">الخارج</span><strong className="text-rose-950">{fmt(escrowMatrixSummary.outflow)}</strong></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><span className="block text-emerald-700">الداخل</span><strong className="text-emerald-950">{fmt(escrowMatrixSummary.inflow)}</strong></div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2"><span className="block text-cyan-700">رصيد الإغلاق</span><strong className="text-cyan-950">{fmt(escrowMatrixSummary.closing)}</strong></div>
          </div>
        </div>
      </section>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-[10px] border-collapse min-w-max">
          <thead className="sticky top-0 z-30 bg-white shadow-md">
            {/* Date row */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-0.5 text-right w-[200px] min-w-[200px] text-[8px] text-gray-400">التاريخ</th>
              {months.map((m, i) => (
                <th key={i} className="min-w-[62px] border-b border-slate-200 px-1 py-1.5 text-center text-[10px] font-black leading-4 text-slate-800">
                  {m.date && <><span className="block">{formatCashFlowMonthYear(m.date).month}</span><span className="block text-[9px] font-semibold text-slate-500">{formatCashFlowMonthYear(m.date).year}</span></>}
                </th>
              ))}
            </tr>
            {/* Phase band */}
            <tr>
              <th className="sticky right-0 z-20 bg-gray-100 border-b border-gray-200 px-2 py-1 text-right w-[200px] min-w-[200px]"></th>
              {months.map((m, i) => (
                <th key={i} className={`min-w-[62px] border-b border-slate-300 px-1 py-1.5 text-center ${phaseColors[m.phase]} text-[10px] font-black text-slate-900`}>
                  <span className="block">{phaseNames[m.phase]}</span><span className="block text-[9px] opacity-70">شهر {m.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── المصروفات (Outflows) ─── */}
            <tr className="bg-red-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-red-700 text-[9px] border-b border-red-100">
                المصروفات من حساب الضمان (Outflows)
              </td>
            </tr>
            {escrowOutflows.map((item, i) => {
              const values = getRowValues(item);
              return (
                <tr key={`out-${i}`} className="border-b border-gray-50 hover:bg-red-50/30">
                  <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                    {item.label}
                  </td>
                  {values.map((v, j) => (
                    <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                      {v > 0 ? fmt(v) : "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Total Outflows */}
            <tr className="bg-red-100/70 font-bold border-y-2 border-red-300">
              <td className="sticky right-0 z-20 bg-red-100 px-2 py-1.5 text-red-900 border-l border-red-300 w-[200px] min-w-[200px]">
                إجمالي المصروفات
              </td>
              {finalOutflowTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-red-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Inflows) ─── */}
            <tr className="bg-green-50">
              <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-green-700 text-[9px] border-b border-green-100">
                الإيرادات إلى حساب الضمان (Inflows)
              </td>
            </tr>
            {inflowRows.map((item, i) => (
              <tr key={`in-${i}`} className="border-b border-gray-50 hover:bg-green-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                  {item.label}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
            {/* Total Inflows */}
            <tr className="bg-green-100/70 font-bold border-y-2 border-green-300">
              <td className="sticky right-0 z-20 bg-green-100 px-2 py-1.5 text-green-900 border-l border-green-300 w-[200px] min-w-[200px]">
                إجمالي الإيرادات
              </td>
              {inflowTotals.map((v, i) => (
                <td key={i} className="px-1 py-[3px] text-center tabular-nums text-green-700">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-cyan-100/80 font-bold border-y-2 border-cyan-400">
              <td className="sticky right-0 z-20 bg-cyan-100 px-2 py-1.5 text-cyan-950 border-l border-cyan-400 w-[200px] min-w-[200px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-medium ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── الرصيد التراكمي ─── */}
            <tr className="bg-violet-100/80 font-bold border-y-2 border-violet-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <td className="sticky right-0 z-20 bg-violet-100 px-2 py-1.5 text-violet-950 border-l border-violet-400 w-[200px] min-w-[200px]">
                الرصيد التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-1 py-[3px] text-center tabular-nums font-bold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التصفية (بعد الإنجاز) ─── */}
            {liquidationRows.length > 0 && (
              <>
                <tr className="bg-purple-50">
                  <td colSpan={totalMonths + 1} className="px-2 py-[3px] font-bold text-purple-700 text-[9px] border-b border-purple-100 border-t-2 border-t-purple-200">
                    التصفية (تحويل للمالك بعد الإنجاز)
                  </td>
                </tr>
                {liquidationRows.map((item, i) => {
                  const values = new Array(totalMonths).fill(0);
                  if (item.label.includes("دفعة 1")) values[liq1MonthIdx] = actualLiq1;
                  if (item.label.includes("دفعة 2")) values[liq2MonthIdx] = actualLiq2;
                  return (
                    <tr key={`liq-${i}`} className="border-b border-gray-50 hover:bg-purple-50/30">
                      <td className="sticky right-0 z-10 bg-white px-2 py-[3px] text-gray-800 font-medium border-l border-gray-100 w-[200px] min-w-[200px]">
                        {item.label}
                      </td>
                      {values.map((v, j) => (
                        <td key={j} className={`px-1 py-[3px] text-center tabular-nums ${v > 0 ? "text-purple-600" : "text-gray-300"}`}>
                          {v > 0 ? fmt(v) : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
