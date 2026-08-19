/**
 * V2Feasibility — دراسة الجدوى المالية (Bateekha tab)
 * Professional compact two-column layout with real project data
 * Includes investor-focused revenues, spending, capital, profit allocation,
 * funding sources, and economics per saleable square foot.
 */
import { useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { clampMarketingDistributionToStart, getProjectDesignTiming, getProjectMarketingTiming } from "@/lib/projectTiming";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow, type SalesResult, type Scenario } from "@/lib/investorCashFlowEngine";
import { ProjectSelector } from "@/components/ProjectSelector";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  DollarSign, TrendingUp, BarChart2, Briefcase, Building2,
  Users, Sparkles, Landmark, Activity, Layers, CalendarClock, ShieldCheck
} from "lucide-react";

const fmt = (n: number) =>
  n === 0 ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const fmtM = (n: number) => formatFullNumber(n, "0");

export default function V2Feasibility({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user },
  );
  const project = projectQuery.data;
  const scenario = ((project as any)?.financingScenario || "offplan_escrow") as Scenario;
  const isBuildForSale = scenario === "build_for_sale";
  const isBuildForRent = scenario === "build_for_rent";
  const costs = project ? calculateProjectCosts(project) : null;
  const designDuration = getProjectDesignTiming(project).designMonths;
  const buildForRentDeveloperFees = useMemo(() => {
    let designRate = 1.5;
    let supervisionRate = 2.5;
    try {
      const savedRates = JSON.parse((project as any)?.constructionScheduleJson || "{}")?.settings?.configurableRates || {};
      designRate = Number(savedRates.buildForRentDeveloperFeeDesignRate ?? designRate);
      supervisionRate = Number(savedRates.buildForRentDeveloperFeeSupervisionRate ?? supervisionRate);
    } catch { /* retain approved defaults when historic settings JSON is absent */ }
    return { designRate, supervisionRate, totalRate: designRate + supervisionRate };
  }, [project]);

  // Use the saved Sales Plan inputs so the Feasibility Study's capital number
  // has the same cash-flow source as Investor and Escrow Cash Flow.
  const salesResult = useMemo<SalesResult | undefined>(() => {
    const plan = plansQuery.data?.[0] as any;
    if (!plan || !project) return undefined;
    let marketingMonthlyAmounts: number[] | undefined;
    let paymentPlan: SalesResult["paymentPlan"];
    let ppDownPct: number | undefined;
    let buildForSaleMonthlyUnits: number[] | undefined;

    try {
      const absorption = plan.salesAbsorptionJson ? JSON.parse(plan.salesAbsorptionJson) : null;
      if (absorption?.marketingDistribution) {
        const minimumStart = getProjectMarketingTiming(project).marketingStartMonth;
        const savedStart = Number(absorption.marketingActualStart || minimumStart);
        const actualStart = Math.max(savedStart, minimumStart);
        const distribution = clampMarketingDistributionToStart(absorption.marketingDistribution, savedStart, minimumStart);
        const channels = Object.values(distribution) as number[][];
        if (channels.length) {
          marketingMonthlyAmounts = new Array(actualStart - 1 + Math.max(...channels.map((channel) => channel.length))).fill(0);
          for (const channel of channels) {
            channel.forEach((value, index) => { marketingMonthlyAmounts![actualStart - 1 + index] += Number(value || 0); });
          }
        }
      }
      ppDownPct = absorption?.ppDownPct;
      if (Array.isArray(absorption?.buildForSaleMonthlyUnits)) {
        buildForSaleMonthlyUnits = absorption.buildForSaleMonthlyUnits.map((value: unknown) => Math.max(0, Number(value) || 0));
      }
      paymentPlan = absorption ? {
        downPct: Number(absorption.ppDownPct ?? 10),
        secondPct: Number(absorption.ppSecondPct ?? 0),
        secondAfterMonths: Number(absorption.ppSecondAfterMonths ?? 0),
        duringTotalPct: 100 - Number(absorption.ppDownPct ?? 10) - Number(absorption.ppSecondPct ?? 0) - Number(absorption.ppHandoverPct ?? 0),
        installmentEveryMonths: Number(absorption.ppInstallmentEvery ?? 1),
        handoverPct: Number(absorption.ppHandoverPct ?? 0),
      } : undefined;
    } catch {}

    try {
      if (plan.paymentPlanJson) {
        paymentPlan = JSON.parse(plan.paymentPlanJson);
        ppDownPct = paymentPlan?.downPct;
      }
      const results = plan.resultsJson ? JSON.parse(plan.resultsJson) : null;
      const parsedBuildForSaleUnits = Array.isArray(results?.buildForSaleMonthlyUnits)
        ? results.buildForSaleMonthlyUnits.map((value: unknown) => Math.max(0, Number(value) || 0))
        : undefined;
      const resolvedBuildForSaleUnits = parsedBuildForSaleUnits
        || buildForSaleMonthlyUnits
        || (isBuildForSale && Array.isArray(results?.salesDistribution)
          ? results.salesDistribution.map((value: unknown) => Math.max(0, Number(value) || 0))
          : undefined);
      const hasSavedSalesResult = isBuildForSale
        ? Array.isArray(results?.actualCashInflow) || Array.isArray(results?.salesDistribution) || Array.isArray(parsedBuildForSaleUnits)
        : Array.isArray(results?.escrowData) && Array.isArray(results?.salesDistribution);
      if (!hasSavedSalesResult) return (marketingMonthlyAmounts || buildForSaleMonthlyUnits)
        ? { escrowData: [], salesDistribution: [], marketingMonthlyAmounts, ppDownPct, paymentPlan, buildForSaleMonthlyUnits }
        : undefined;
      const storedCash = results.actualCashInflow || [];
      const actualCashInflow = results.actualCashInflowVersion === 2
        ? storedCash
        : (storedCash.length > 0 && storedCash[0] === 0 ? storedCash.slice(1) : storedCash);
      const directSales = JSON.parse((project as any).constructionScheduleJson || "{}")?.settings?.directPostCompletionSales || {};
      return {
        escrowData: Array.isArray(results.escrowData) ? results.escrowData : [],
        salesDistribution: Array.isArray(results.salesDistribution) ? results.salesDistribution : [],
        marketingMonthlyAmounts,
        ppDownPct,
        paymentPlan,
        actualCashInflow,
        offplanPct: Number(plan.offplanPct ?? 80),
        directSalesStartMonth: Number(directSales.startMonth ?? 4),
        directSalesInstallmentCount: Number(directSales.installmentCount ?? 6),
        buildForSaleMonthlyUnits: resolvedBuildForSaleUnits,
      };
    } catch {
      return undefined;
    }
  }, [plansQuery.data, project]);

  const cashFlow = useMemo(
    () => computeInvestorCashFlow(project || null, scenario, undefined, salesResult),
    [project, scenario, salesResult],
  );
  const capital = useMemo(() => calculateInvestorCapitalSummary(cashFlow), [cashFlow]);

  // Computed values
  const totalRevenue = costs?.totalRevenue || 0;
  const totalCosts = (isBuildForSale || isBuildForRent)
    ? cashFlow.rows
      .filter((row) => !row.isRevenue && !row.isTransfer && !row.label.includes("حصة كومو"))
      .reduce((sum, row) => sum + row.totalCost, 0)
    : costs?.totalCosts || 0;
  const profit = totalRevenue - totalCosts;
  const comoFee = profit > 0 ? profit * 0.15 : 0;
  const investorProfit = profit - comoFee;
  // Keep the two investor questions separate: project economics before Como's
  // share, then the investor's own return after that share on cash committed.
  const projectMarginOnCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const investorReturnOnCapital = capital.requiredCapital > 0 ? (investorProfit / capital.requiredCapital) * 100 : 0;
  const capitalCommittedPct = capital.requiredCapital > 0 ? Math.min(100, (capital.paidCapital / capital.requiredCapital) * 100) : 0;
  const investorOutcomePositive = investorProfit >= 0 && projectMarginOnCost >= 0;

  // Revenue breakdown
  const revRes = costs?.revenueRes || 0;
  const revRet = costs?.revenueRet || 0;
  const revOff = costs?.revenueOff || 0;

  // Cost breakdown groups
  const landCosts = (costs?.landPrice || 0) + (costs?.agentCommissionLand || 0) + (costs?.landRegistration || 0);
  const designCosts = (costs?.designFee || 0) + (costs?.soilTestFee || 0) + (costs?.topographicSurveyFee || 0);
  const constructionCosts = (costs?.constructionCost || 0) + (costs?.supervisionFee || 0);
  const regulatoryCosts = (costs?.communityFees || 0) + (costs?.officialBodiesFees || 0) + (costs?.reraUnitRegFee || 0) + (costs?.reraProjectRegFee || 0) + (costs?.developerNocFee || 0) + (costs?.escrowAccountFee || 0) + (costs?.bankFees || 0) + (costs?.reraAuditReportFee || 0) + (costs?.reraInspectionReportFee || 0);
  const salesCosts = (costs?.developerFee || 0) + (costs?.salesCommission || 0) + (costs?.marketingCost || 0);

  // ═══ SALEABLE-AREA ECONOMICS ═══
  const gfaResSqft = parseFloat(project?.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(project?.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(project?.gfaOfficesSqft || "0");
  const saleableResPct = parseFloat(project?.saleableResidentialPct ?? "95") / 100;
  const saleableRetPct = parseFloat(project?.saleableRetailPct ?? "97") / 100;
  const saleableOffPct = parseFloat(project?.saleableOfficesPct ?? "95") / 100;
  const totalSellableSqft = (gfaResSqft * saleableResPct) + (gfaRetSqft * saleableRetPct) + (gfaOffSqft * saleableOffPct);
  const costPerSaleableSqft = totalSellableSqft > 0 ? totalCosts / totalSellableSqft : 0;
  const sellingPricePerSqft = totalSellableSqft > 0 ? totalRevenue / totalSellableSqft : 0;
  const profitPerSaleableSqft = sellingPricePerSqft - costPerSaleableSqft;

  // ═══ SCENARIO COMPARISON ═══
  const scenarioCalc = (factor: number) => {
    const rev = totalRevenue * factor;
    const p = rev - totalCosts;
    const como = p > 0 ? p * 0.15 : 0;
    const invP = p - como;
    const marginOnCost = totalCosts > 0 ? (p / totalCosts) * 100 : 0;
    return { revenue: rev, investorProfit: invP, marginOnCost };
  };
  const optimistic = scenarioCalc(1.10);
  const base = scenarioCalc(1.00);
  const conservative = scenarioCalc(0.90);

  const totalMonths = designDuration + parseInt(project?.constructionMonths || "18");
  const totalYears = totalMonths / 12;

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white min-h-[400px]" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-teal-100/60 px-4 py-2 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center shadow-sm">
            <BarChart2 className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <span className="text-xs font-bold text-gray-800">دراسة الجدوى المالية</span>
        </div>
        {!embedded && <div className="mr-auto w-56">
          <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />
        </div>}
      </div>

      {!selectedProjectId && (
        <div className="text-center py-16 text-gray-400 text-sm">اختر مشروعاً من دليل الدراسات لعرض دراسة الجدوى</div>
      )}

      {selectedProjectId && !costs && (
        <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل البيانات...</div>
      )}

      {costs && project && (
        <div className="max-w-[1100px] mx-auto px-4 py-3 space-y-3">

          {/* ═══ INVESTOR DECISION CANVAS ═══ */}
          {!isBuildForRent && (
            <section className="fs-card fs-card-blue overflow-hidden">
              <div className="grid xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="fs-card fs-card-violet m-3 px-5 py-5 text-slate-900">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
                    <ShieldCheck className="h-4 w-4 text-violet-600" />
                    قرار المستثمر
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-600">صافي عائدك المتوقع بعد حصة كومو</p>
                  <p className={`mt-1 text-3xl font-black tracking-tight tabular-nums ${investorOutcomePositive ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{fmtM(investorProfit)} AED</p>
                  <p className="mt-1 text-[11px] text-slate-600">مدة المشروع: {totalMonths} شهرًا · {totalYears.toFixed(1)} سنة</p>
                  <div className="mt-5 border-t border-violet-200 pt-4">
                    <p className="text-xs font-semibold text-slate-700">ذروة السيولة المطلوبة</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-amber-700" dir="ltr">{fmtM(capital.requiredCapital)} AED</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-600"><CalendarClock className="h-3 w-3" /> {capital.peakMonthDate || "يُحدَّد من تدفق المستثمر"}</p>
                  </div>
                </aside>

                <div className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-semibold text-cyan-700">ملخص الاستثمار</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">كم يكلّف المشروع، وكم يعيد للمستثمر؟</h2>
                      <p className="mt-1 text-xs text-slate-500">تُعرض اقتصاديات المشروع أولًا، ثم يظهر رأس المال وتوقيته، وتبقى التفاصيل أدناه للتدقيق.</p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">مصدر الإيراد: التسعير المعتمد</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <DecisionMetric label="إيرادات البيع المعتمدة" value={fmtM(totalRevenue)} tone="teal" detail="من صفحة التسعير فقط" />
                    <DecisionMetric label="إجمالي تكلفة المشروع" value={fmtM(totalCosts)} tone="slate" detail="مدفوع ومستقبلي" />
                    <DecisionMetric label="ربح المشروع قبل حصة كومو" value={fmtM(profit)} tone={profit >= 0 ? "violet" : "rose"} detail="الإيرادات ناقص إجمالي التكلفة" />
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <RatioDecisionCard
                      label="هامش ربح المشروع على التكلفة الكلية"
                      value={fmtPct(projectMarginOnCost)}
                      formula={`${fmtM(profit)} ربح ÷ ${fmtM(totalCosts)} تكلفة`}
                      explanation="يقيس اقتصاديات المشروع قبل حصة كومو"
                      tone="teal"
                    />
                    <RatioDecisionCard
                      label="عائد المستثمر على رأس المال المستخدم"
                      value={fmtPct(investorReturnOnCapital)}
                      formula={`${fmtM(investorProfit)} صافي ربح ÷ ${fmtM(capital.requiredCapital)} رأس مال`}
                      explanation="بعد حصة كومو وعلى ذروة رأس المال المطلوبة"
                      tone="amber"
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800"><Briefcase className="h-4 w-4 text-amber-700" /> التزام رأس المال للمستثمر</div>
                      <span className="text-[11px] text-slate-500">القيمة القصوى المطلوبة من تدفقات المستثمر</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <CapitalFact label="المطلوب عند الذروة" value={fmtM(capital.requiredCapital)} tone="slate" />
                      <CapitalFact label="تم دفعه" value={fmtM(capital.paidCapital)} tone="slate" />
                      <CapitalFact label="المتبقي للتمويل" value={fmtM(capital.remainingCapital)} tone="amber" />
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" aria-label="نسبة رأس المال المدفوع من رأس المال المطلوب">
                      <div className="h-full rounded-full bg-gradient-to-l from-amber-500 to-cyan-500" style={{ width: `${capitalCommittedPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══ BUILD-FOR-RENT SUMMARY ═══ */}
          {isBuildForRent ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <KpiMini label="إجمالي تكاليف البناء للتأجير" value={fmtM(totalCosts)} color="slate" icon={<DollarSign className="w-3 h-3" />} />
              <KpiMini label="رأس المال المطلوب" value={fmtM(capital.requiredCapital)} color="slate" icon={<Briefcase className="w-3 h-3" />} />
              <KpiMini label="الإيرادات والإيجار" value="غير مدرج حالياً" color="teal" icon={<TrendingUp className="w-3 h-3" />} />
            </div>
          ) : null}

          {/* ═══ TWO COLUMNS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

            {/* ─── LEFT: FINANCIALS ─── */}
            <div className="space-y-3">

              {/* Revenue */}
              {!isBuildForRent && <SectionCard title="الإيرادات" icon={<TrendingUp className="w-3.5 h-3.5 text-white" />} gradient="from-teal-600 to-teal-800" borderColor="border-teal-200/60">
                <div className="space-y-1">
                  <Row label="سكني" value={fmt(revRes)} pct={totalRevenue > 0 ? (revRes / totalRevenue * 100) : 0} color="text-teal-700" />
                  <Row label="تجزئة" value={fmt(revRet)} pct={totalRevenue > 0 ? (revRet / totalRevenue * 100) : 0} color="text-teal-700" />
                  <Row label="مكاتب" value={fmt(revOff)} pct={totalRevenue > 0 ? (revOff / totalRevenue * 100) : 0} color="text-teal-700" />
                  <TotalRow label="إجمالي الإيرادات" value={fmt(totalRevenue)} bgColor="bg-teal-50" textColor="text-teal-800" />
                </div>
              </SectionCard>}

              {/* Costs - كل بند مفصل */}
              <SectionCard title="التكاليف" icon={<DollarSign className="w-3.5 h-3.5 text-white" />} gradient="from-slate-600 to-slate-800" borderColor="border-slate-200/60">
                <div className="space-y-0.5">
                  {/* الأرض */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1 pb-0.5 border-b border-gray-100">الأرض</div>
                  <Row label="سعر الأرض" value={fmt(costs?.landPrice || 0)} pct={totalCosts > 0 ? ((costs?.landPrice || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="عمولة وسيط الأرض" value={fmt(costs?.agentCommissionLand || 0)} pct={totalCosts > 0 ? ((costs?.agentCommissionLand || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم تسجيل الأرض (4%)" value={fmt(costs?.landRegistration || 0)} pct={totalCosts > 0 ? ((costs?.landRegistration || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {/* التصاميم والدراسات */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1.5 pb-0.5 border-b border-gray-100">التصاميم والدراسات</div>
                  <Row label="أتعاب التصميم" value={fmt(costs?.designFee || 0)} pct={totalCosts > 0 ? ((costs?.designFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="فحص التربة" value={fmt(costs?.soilTestFee || 0)} pct={totalCosts > 0 ? ((costs?.soilTestFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="المسح الطبوغرافي" value={fmt(costs?.topographicSurveyFee || 0)} pct={totalCosts > 0 ? ((costs?.topographicSurveyFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {/* الإنشاء */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1.5 pb-0.5 border-b border-gray-100">الإنشاء</div>
                  <Row label="تكلفة الإنشاء" value={fmt(costs?.constructionCost || 0)} pct={totalCosts > 0 ? ((costs?.constructionCost || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="أتعاب الإشراف" value={fmt(costs?.supervisionFee || 0)} pct={totalCosts > 0 ? ((costs?.supervisionFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم المساح (As-Built)" value={fmt(costs?.surveyorFees || 0)} pct={totalCosts > 0 ? ((costs?.surveyorFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم المساح (DWG)" value={fmt((costs as any)?.surveyorDwgFees || 0)} pct={totalCosts > 0 ? (((costs as any)?.surveyorDwgFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {/* الرسوم */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1.5 pb-0.5 border-b border-gray-100">الرسوم والجهات</div>
                  <Row label="رسوم الفرز" value={fmt(costs?.separationFee || 0)} pct={totalCosts > 0 ? ((costs?.separationFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم المجتمع" value={fmt(costs?.communityFees || 0)} pct={totalCosts > 0 ? ((costs?.communityFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم الجهات الحكومية" value={fmt(costs?.officialBodiesFees || 0)} pct={totalCosts > 0 ? ((costs?.officialBodiesFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="تسجيل الوحدات (دائرة الأراضي والأملاك)" value={fmt(costs?.reraUnitRegFee || 0)} pct={totalCosts > 0 ? ((costs?.reraUnitRegFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {!isBuildForSale && !isBuildForRent && <Row label="تسجيل المشروع (ريرا)" value={fmt(costs?.reraProjectRegFee || 0)} pct={totalCosts > 0 ? ((costs?.reraProjectRegFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  <Row label="NOC المطور" value={fmt(costs?.developerNocFee || 0)} pct={totalCosts > 0 ? ((costs?.developerNocFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {!isBuildForSale && !isBuildForRent && <Row label="حساب الضمان" value={fmt(costs?.escrowAccountFee || 0)} pct={totalCosts > 0 ? ((costs?.escrowAccountFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {!isBuildForSale && !isBuildForRent && <Row label="رسوم البنك" value={fmt(costs?.bankFees || 0)} pct={totalCosts > 0 ? ((costs?.bankFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {!isBuildForSale && !isBuildForRent && <Row label="تقرير مدقق ريرا" value={fmt(costs?.reraAuditReportFee || 0)} pct={totalCosts > 0 ? ((costs?.reraAuditReportFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {!isBuildForSale && !isBuildForRent && <Row label="تقارير فحص ريرا" value={fmt(costs?.reraInspectionReportFee || 0)} pct={totalCosts > 0 ? ((costs?.reraInspectionReportFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {/* المبيعات */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1.5 pb-0.5 border-b border-gray-100">{isBuildForRent ? "أتعاب التطوير" : "المبيعات والتسويق"}</div>
                  <Row label="أتعاب المطور" value={fmt(costs?.developerFee || 0)} pct={totalCosts > 0 ? ((costs?.developerFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {!isBuildForRent && <Row label="عمولة المبيعات" value={fmt(costs?.salesCommission || 0)} pct={totalCosts > 0 ? ((costs?.salesCommission || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {!isBuildForRent && <Row label="التسويق" value={fmt(costs?.marketingCost || 0)} pct={totalCosts > 0 ? ((costs?.marketingCost || 0) / totalCosts * 100) : 0} color="text-gray-700" />}
                  {/* الإجمالي */}
                  <TotalRow label="إجمالي التكاليف" value={fmt(totalCosts)} bgColor="bg-slate-100" textColor="text-slate-800" />
                </div>
              </SectionCard>

              {/* Investor return: a transparent calculation trail below the decision canvas. */}
              {!isBuildForRent && <SectionCard title="تسلسل العائد للمستثمر" icon={<BarChart2 className="w-3.5 h-3.5 text-amber-300" />} gradient="from-teal-700 to-teal-900" borderColor="border-teal-200/60">
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-700">الربح الإجمالي للمشروع</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">الإيرادات ناقص إجمالي التكاليف</p>
                      </div>
                      <span className={`text-base font-black tabular-nums ${profit >= 0 ? 'text-slate-800' : 'text-red-700'}`} dir="ltr">{fmt(profit)} AED</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-amber-100 pb-2 px-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>حصة كومو من الربح (15%)</span>
                    </div>
                    <span className="text-sm font-black text-amber-800 tabular-nums" dir="ltr">{fmt(comoFee)} AED</span>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
                    <div className="flex items-end justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-teal-700" />
                        <div>
                          <p className="text-[11px] font-black text-teal-900">صافي ربح المستثمر</p>
                      <p className="text-[9px] text-teal-700 mt-0.5">بعد خصم حصة كومو</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-teal-800 tabular-nums" dir="ltr">{fmt(investorProfit)} AED</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-md bg-gray-50 px-2 py-1.5">
                      <p className="text-[9px] text-gray-500">هامش ربح المشروع على التكلفة</p>
                      <p className="text-sm font-black text-slate-800 tabular-nums mt-0.5">{fmtPct(projectMarginOnCost)}</p>
                      <p className="mt-0.5 text-[8px] text-gray-400">قبل حصة كومو</p>
                    </div>
                    <div className="rounded-md bg-gray-50 px-2 py-1.5">
                      <p className="text-[9px] text-gray-500">عائد المستثمر على رأس المال</p>
                      <p className="text-sm font-black text-slate-800 tabular-nums mt-0.5">{fmtPct(investorReturnOnCapital)}</p>
                      <p className="mt-0.5 text-[8px] text-gray-400">بعد حصة كومو</p>
                    </div>
                  </div>
                </div>
              </SectionCard>}

              {/* ═══ SCENARIO COMPARISON ═══ */}
              {!isBuildForRent && <SectionCard title="مقارنة السيناريوهات" icon={<Layers className="w-3.5 h-3.5 text-white" />} gradient="from-indigo-600 to-violet-700" borderColor="border-indigo-200/60">
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500">
                        <th className="py-1.5 px-2 text-right font-medium">السيناريو</th>
                        <th className="py-1.5 px-2 text-center font-medium">الإيرادات</th>
                        <th className="py-1.5 px-2 text-center font-medium">ربح المستثمر</th>
                        <th className="py-1.5 px-2 text-center font-medium">هامش المشروع</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-50 bg-green-50/30">
                        <td className="py-1.5 px-2 font-bold text-green-700">متفائل (+10%)</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(optimistic.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-green-700" dir="ltr">{fmtM(optimistic.investorProfit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-green-700">{fmtPct(optimistic.marginOnCost)}</td>
                      </tr>
                      <tr className="border-t border-gray-100 bg-blue-50/30">
                        <td className="py-1.5 px-2 font-bold text-blue-700">أساسي</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(base.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-blue-700" dir="ltr">{fmtM(base.investorProfit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-blue-700">{fmtPct(base.marginOnCost)}</td>
                      </tr>
                      <tr className="border-t border-gray-100 bg-orange-50/30">
                        <td className="py-1.5 px-2 font-bold text-orange-700">متحفظ (-10%)</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(conservative.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-orange-700" dir="ltr">{fmtM(conservative.investorProfit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-orange-700">{fmtPct(conservative.marginOnCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>}
            </div>

            {/* ─── RIGHT: PROJECT DETAILS ─── */}
            <div className="space-y-3">

              {/* Project Details */}
              <SectionCard title="تفاصيل المشروع" icon={<Building2 className="w-3.5 h-3.5 text-white" />} gradient="from-slate-700 to-gray-800" borderColor="border-gray-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                  <DetailRow label="اسم المشروع" value={project.name || "—"} />
                  <DetailRow label="المنطقة" value={project.community || project.areaCode || "—"} />
                  <DetailRow label="مساحة الأرض" value={project.plotAreaSqft ? `${fmt(parseFloat(project.plotAreaSqft))} قدم²` : "—"} />
                  <DetailRow label="مساحة البناء (BUA)" value={project.manualBuaSqft ? `${fmt(parseFloat(project.manualBuaSqft))} قدم²` : "—"} />
                  <DetailRow label="سعر الأرض" value={project.landPrice ? `${fmt(parseFloat(project.landPrice))} AED` : "—"} />
                  <DetailRow label="تكلفة الإنشاء/قدم²" value={project.estimatedConstructionPricePerSqft ? `${parseFloat(project.estimatedConstructionPricePerSqft).toFixed(0)} AED` : "—"} />
                  <DetailRow label="مدة التصاميم" value={`${designDuration} شهر`} />
                  <DetailRow label="مدة الإنشاء" value={project.constructionMonths ? `${project.constructionMonths} شهر` : "—"} />

                  <DetailRow
                    label={isBuildForRent ? "أتعاب المطور (تصميم + إشراف)" : isBuildForSale ? "أتعاب المطور (تصميم + تنفيذ)" : "أتعاب المطور"}
                    value={isBuildForRent
                      ? `${buildForRentDeveloperFees.totalRate.toFixed(2)}% من تكلفة الإنشاء (${buildForRentDeveloperFees.designRate}% + ${buildForRentDeveloperFees.supervisionRate}%)`
                      : isBuildForSale ? "3% من الإيرادات (1% + 2%)"
                      : project.developerFeePct ? `${project.developerFeePct}%` : "—"}
                  />
                  <DetailRow label="عمولة المبيعات" value={project.salesCommissionPct ? `${project.salesCommissionPct}%` : "—"} />
                  <DetailRow label="أتعاب التصميم" value={project.designFeePct ? `${project.designFeePct}%` : "—"} />
                  <DetailRow label="أتعاب الإشراف" value={project.supervisionFeePct ? `${project.supervisionFeePct}%` : "—"} />
                  <DetailRow label="الملكية" value={project.ownershipType || "—"} />
                  <DetailRow label="سيناريو التمويل" value={
                    project.financingScenario === 'offplan_escrow' ? 'أوف بلان + ضمان' :
                    project.financingScenario === 'offplan_construction' ? 'أوف بلان + بناء' :
                    project.financingScenario === 'no_offplan' ? 'بدون أوف بلان' :
                    project.financingScenario === 'build_for_sale' ? 'بناء للبيع' :
                    project.financingScenario === 'build_for_rent' ? 'بناء للتأجير' :
                    project.financingScenario || "—"
                  } />
                  <DetailRow label="المدة الإجمالية" value={`${totalMonths} شهر (${totalYears.toFixed(1)} سنة)`} />
                </div>
              </SectionCard>

              {/* Areas */}
              <SectionCard title="المساحات" icon={<Landmark className="w-3.5 h-3.5 text-white" />} gradient="from-teal-500 to-teal-700" borderColor="border-teal-200/60">
                <div className="space-y-1.5">
                  <AreaRow label="GFA سكني" value={gfaResSqft > 0 ? `${fmt(gfaResSqft)} قدم²` : "—"} />
                  <AreaRow label="GFA تجزئة" value={gfaRetSqft > 0 ? `${fmt(gfaRetSqft)} قدم²` : "—"} />
                  <AreaRow label="GFA مكاتب" value={gfaOffSqft > 0 ? `${fmt(gfaOffSqft)} قدم²` : "—"} />
                  <div className="border-t border-gray-100 pt-1.5">
                    <AreaRow label="إجمالي GFA" value={(gfaResSqft + gfaRetSqft + gfaOffSqft) > 0 ? `${fmt(gfaResSqft + gfaRetSqft + gfaOffSqft)} قدم²` : "—"} bold />
                    <AreaRow label="القابل للبيع" value={totalSellableSqft > 0 ? `${fmt(totalSellableSqft)} قدم²` : "—"} bold />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="رأس المال المطلوب" icon={<Briefcase className="w-3.5 h-3.5 text-white" />} gradient="from-amber-500 to-amber-700" borderColor="border-amber-200/60">
                <div className="space-y-2.5">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-amber-900">السيولة القصوى التي يحتاجها المستثمر</p>
                    <p className="text-lg font-black text-amber-900 tabular-nums mt-1" dir="ltr">{fmt(capital.requiredCapital)} AED</p>
                    <p className="text-[9px] text-amber-700 mt-1">تصل الذروة في {capital.peakMonthDate || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <p className="text-[9px] text-slate-500">مدفوع حتى الآن</p>
                      <p className="text-sm font-black text-slate-800 tabular-nums mt-0.5" dir="ltr">{fmt(capital.paidCapital)} AED</p>
                    </div>
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2">
                      <p className="text-[9px] text-amber-700">المتبقي للتمويل</p>
                      <p className="text-sm font-black text-amber-900 tabular-nums mt-0.5" dir="ltr">{fmt(capital.remainingCapital)} AED</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 flex" title="توزيع رأس المال بين المدفوع والمتبقي">
                    <div className="bg-slate-500" style={{ width: `${capital.requiredCapital > 0 ? (capital.paidCapital / capital.requiredCapital) * 100 : 0}%` }} />
                    <div className="bg-amber-500" style={{ width: `${capital.requiredCapital > 0 ? (capital.remainingCapital / capital.requiredCapital) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[8px] leading-relaxed text-gray-500">
                    {isBuildForRent || isBuildForSale
                      ? `لا يوجد حساب ضمان في ${isBuildForSale ? "البناء للبيع" : "البناء للتأجير"}؛ رأس المال المطلوب يمثل مصروفات المستثمر فقط.`
                      : "يشمل هذا الرقم إيداع حساب الضمان، لأنه سيولة يلتزم بها المستثمر."}
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="تمويل تكلفة المشروع" icon={<Landmark className="w-3.5 h-3.5 text-white" />} gradient="from-slate-600 to-slate-800" borderColor="border-slate-200">
                <div className="space-y-2">
                  <div className="flex items-end justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-700">إجمالي مصروفات المشروع</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">مطابق لإجمالي التكاليف في الدراسة</p>
                    </div>
                    <span className="text-sm font-black text-slate-800 tabular-nums" dir="ltr">{fmt(capital.totalProjectSpend)} AED</span>
                  </div>
                  {isBuildForRent || isBuildForSale ? (
                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                      <p className="text-[9px] text-slate-500">يدفعه المستثمر</p>
                      <p className="text-[11px] font-black text-slate-800 tabular-nums mt-0.5" dir="ltr">{fmt(capital.investorProjectSpend)} AED</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-slate-50 px-2.5 py-2">
                        <p className="text-[9px] text-slate-500">يدفعه المستثمر</p>
                        <p className="text-[11px] font-black text-slate-800 tabular-nums mt-0.5" dir="ltr">{fmt(capital.investorProjectSpend)} AED</p>
                      </div>
                      <div className="rounded-md bg-cyan-50 px-2.5 py-2">
                        <p className="text-[9px] text-cyan-700">يدفعه حساب الضمان</p>
                        <p className="text-[11px] font-black text-cyan-800 tabular-nums mt-0.5" dir="ltr">{fmt(capital.escrowProjectSpend)} AED</p>
                      </div>
                    </div>
                  )}
                  <p className="text-[8px] leading-relaxed text-gray-500">هذا توزيع لمصروفات المشروع، وليس رأس المال المطلوب من المستثمر.</p>
                </div>
              </SectionCard>

              {isBuildForRent ? (
                <SectionCard title="مؤشرات تكلفة البناء للتأجير" icon={<Activity className="w-3.5 h-3.5 text-white" />} gradient="from-cyan-600 to-sky-700" borderColor="border-sky-200/60">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600">تكلفة القدم² من BUA</span>
                      <span className="font-bold text-gray-800 tabular-nums" dir="ltr">{project.manualBuaSqft && totalCosts > 0 ? `${(totalCosts / Number(project.manualBuaSqft)).toFixed(0)} AED` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600">تكلفة الإنشاء/قدم²</span>
                      <span className="font-bold text-slate-700 tabular-nums" dir="ltr">{costs?.constructionCost && project.manualBuaSqft ? `${(costs.constructionCost / Number(project.manualBuaSqft)).toFixed(0)} AED` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] bg-cyan-50/60 rounded px-2 py-1 -mx-1">
                      <span className="font-bold text-cyan-800">مساحة البناء (BUA)</span>
                      <span className="font-black text-cyan-700 tabular-nums" dir="ltr">{project.manualBuaSqft ? `${fmt(Number(project.manualBuaSqft))} قدم²` : "—"}</span>
                    </div>
                  </div>
                </SectionCard>
              ) : (
                <SectionCard title="اقتصاديات القدم² القابل للبيع" icon={<Activity className="w-3.5 h-3.5 text-white" />} gradient="from-cyan-600 to-sky-700" borderColor="border-sky-200/60">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600">تكلفة القدم² القابل للبيع</span>
                      <span className="font-bold text-gray-800 tabular-nums" dir="ltr">{costPerSaleableSqft > 0 ? `${costPerSaleableSqft.toFixed(0)} AED` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600">متوسط سعر البيع/قدم²</span>
                      <span className="font-bold text-teal-700 tabular-nums" dir="ltr">{sellingPricePerSqft > 0 ? `${sellingPricePerSqft.toFixed(0)} AED` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] bg-teal-50/60 rounded px-2 py-1 -mx-1">
                      <span className="font-bold text-teal-800">الربح لكل قدم²</span>
                      <span className={`font-black tabular-nums ${profitPerSaleableSqft >= 0 ? 'text-teal-700' : 'text-red-700'}`} dir="ltr">{profitPerSaleableSqft !== 0 ? `${profitPerSaleableSqft.toFixed(0)} AED` : "—"}</span>
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ SUB-COMPONENTS ═══════════════════ */

function KpiMini({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    teal: "fs-card fs-card-teal text-teal-800",
    gold: "fs-card fs-card-amber text-amber-800",
    red: "fs-card fs-card-rose text-rose-700",
    slate: "fs-card fs-card-violet text-violet-700",
  };
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${colorMap[color] || colorMap.teal}`}>
      <div className="flex items-center gap-1 mb-0.5 opacity-70">{icon}<span className="text-[8px] font-medium">{label}</span></div>
      <div className="text-sm font-black tabular-nums" dir="ltr">{value}</div>
    </div>
  );
}

function DecisionMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "teal" | "slate" | "violet" | "rose" }) {
  const tones = {
    teal: "fs-card fs-card-teal text-teal-950",
    slate: "fs-card fs-card-blue text-slate-950",
    violet: "fs-card fs-card-violet text-violet-950",
    rose: "fs-card fs-card-rose text-rose-950",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight tabular-nums" dir="ltr">{value} AED</p>
      <p className="mt-1 text-[11px] opacity-70">{detail}</p>
    </div>
  );
}

function RatioDecisionCard({ label, value, formula, explanation, tone }: { label: string; value: string; formula: string; explanation: string; tone: "teal" | "amber" }) {
  const tones = {
    teal: "fs-card fs-card-teal text-teal-950",
    amber: "fs-card fs-card-amber text-amber-950",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight tabular-nums" dir="ltr">{value}</p>
      <p className="mt-2 rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold tabular-nums" dir="ltr">{formula}</p>
      <p className="mt-1.5 text-[11px] opacity-75">{explanation}</p>
    </div>
  );
}

function CapitalFact({ label, value, tone }: { label: string; value: string; tone: "slate" | "amber" }) {
  const tones = {
    slate: "text-slate-900",
    amber: "text-amber-800",
  };
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${tones[tone]}`} dir="ltr">{value} AED</p>
    </div>
  );
}

function SectionCard({ title, icon, gradient, borderColor, children }: { title: string; icon: React.ReactNode; gradient: string; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={`fs-card rounded-xl ${borderColor} overflow-hidden`}>
      <div className={`px-3 py-1.5 border-b border-gray-100 flex items-center gap-2`}>
        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>{icon}</div>
        <h3 className="text-[11px] font-bold text-gray-800">{title}</h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function Row({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`font-bold tabular-nums ${color}`} dir="ltr">{value}</span>
        <span className="text-[9px] text-gray-400 w-8 text-left">{pct > 0 ? `${pct.toFixed(0)}%` : ""}</span>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bgColor, textColor }: { label: string; value: string; bgColor: string; textColor: string }) {
  return (
    <div className={`flex items-center justify-between text-[11px] font-bold ${bgColor} rounded-md px-2 py-1 mt-1`}>
      <span className={textColor}>{label}</span>
      <span className={`tabular-nums ${textColor}`} dir="ltr">{value}</span>
    </div>
  );
}

function RatioBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50/80 border-teal-200/60 text-teal-700",
    gold: "bg-amber-50/80 border-amber-200/60 text-amber-800",
    slate: "bg-slate-50/80 border-slate-200/60 text-slate-700",
  };
  return (
    <div className={`border rounded-lg p-1.5 text-center ${colorMap[color] || colorMap.teal}`}>
      <div className="text-[9px] font-medium opacity-70 mb-0.5">{label}</div>
      <div className="text-base font-black tabular-nums">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400 font-medium whitespace-nowrap">{label}:</span>
      <span className="font-bold text-gray-800 truncate" dir="auto">{value}</span>
    </div>
  );
}

function AreaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className={`${bold ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-black text-teal-800' : 'font-bold text-gray-700'}`} dir="ltr">{value}</span>
    </div>
  );
}
