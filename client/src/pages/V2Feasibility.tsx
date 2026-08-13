/**
 * V2Feasibility — دراسة الجدوى المالية (Bateekha tab)
 * Professional compact two-column layout with real project data
 * Includes: revenues, costs, profits, ratios, developer/investor split,
 * break-even, scenario comparison, IRR estimate, cost/sqft vs selling price
 */
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { getProjectDesignTiming } from "@/lib/projectTiming";
import { ProjectSelector } from "@/components/ProjectSelector";
import {
  DollarSign, TrendingUp, BarChart2, Briefcase, Building2,
  Percent, Users, Sparkles, Target, Landmark, Info, ArrowDownCircle,
  Scale, Activity, Layers, CheckCircle2
} from "lucide-react";

const fmt = (n: number) =>
  n === 0 ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtPct = (n: number) =>
  n === 0 ? "—" : `${n.toFixed(1)}%`;

const fmtM = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
};

export default function V2Feasibility() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const project = projectQuery.data;
  const costs = project ? calculateProjectCosts(project) : null;
  const designDuration = getProjectDesignTiming(project).designMonths;

  // Computed values
  const totalRevenue = costs?.totalRevenue || 0;
  const totalCosts = costs?.totalCosts || 0;
  const profit = totalRevenue - totalCosts;
  const profitOnCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const profitOnCapital = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const comoFee = profit > 0 ? profit * 0.15 : 0;
  const investorProfit = profit - comoFee;
  const investorROI = totalCosts > 0 ? (investorProfit / totalCosts) * 100 : 0;

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

  // ═══ BREAK-EVEN ═══
  // Average revenue per sqft sold
  const gfaResSqft = parseFloat(project?.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(project?.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(project?.gfaOfficesSqft || "0");
  const saleableResPct = parseFloat(project?.saleableResidentialPct ?? "95") / 100;
  const saleableRetPct = parseFloat(project?.saleableRetailPct ?? "97") / 100;
  const saleableOffPct = parseFloat(project?.saleableOfficesPct ?? "95") / 100;
  const totalSellableSqft = (gfaResSqft * saleableResPct) + (gfaRetSqft * saleableRetPct) + (gfaOffSqft * saleableOffPct);
  const avgRevenuePerSqft = totalSellableSqft > 0 ? totalRevenue / totalSellableSqft : 0;
  const breakEvenSqft = avgRevenuePerSqft > 0 ? totalCosts / avgRevenuePerSqft : 0;
  const breakEvenPct = totalSellableSqft > 0 ? (breakEvenSqft / totalSellableSqft) * 100 : 0;

  // ═══ SCENARIO COMPARISON ═══
  const scenarioCalc = (factor: number) => {
    const rev = totalRevenue * factor;
    const p = rev - totalCosts;
    const como = p > 0 ? p * 0.15 : 0;
    const invP = p - como;
    const roi = totalCosts > 0 ? (invP / totalCosts) * 100 : 0;
    return { revenue: rev, profit: p, margin: rev > 0 ? (p / rev) * 100 : 0, investorProfit: invP, roi };
  };
  const optimistic = scenarioCalc(1.10);
  const base = scenarioCalc(1.00);
  const conservative = scenarioCalc(0.90);

  // ═══ IRR ESTIMATE ═══
  // Simple annualized ROI based on project duration
  const totalMonths = designDuration + parseInt(project?.constructionMonths || "18");
  const totalYears = totalMonths / 12;
  const annualizedROI = totalYears > 0 && investorROI > 0 ? investorROI / totalYears : 0;

  // ═══ COST/SQFT vs SELLING PRICE ═══
  const buaSqft = parseFloat(project?.manualBuaSqft || "0");
  const costPerSqft = buaSqft > 0 ? totalCosts / buaSqft : 0;
  const sellingPricePerSqft = totalSellableSqft > 0 ? totalRevenue / totalSellableSqft : 0;
  const spreadPerSqft = sellingPricePerSqft - costPerSqft;

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
        <div className="mr-auto w-56">
          <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />
        </div>
      </div>

      {!selectedProjectId && (
        <div className="text-center py-16 text-gray-400 text-sm">اختر مشروعاً لعرض دراسة الجدوى</div>
      )}

      {selectedProjectId && !costs && (
        <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل البيانات...</div>
      )}

      {costs && project && (
        <div className="max-w-[1100px] mx-auto px-4 py-3 space-y-3">

          {/* ═══ KPI STRIP ═══ */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            <KpiMini label="الإيرادات" value={fmtM(totalRevenue)} color="teal" icon={<TrendingUp className="w-3 h-3" />} />
            <KpiMini label="التكاليف" value={fmtM(totalCosts)} color="slate" icon={<DollarSign className="w-3 h-3" />} />
            <KpiMini label="صافي الربح" value={fmtM(profit)} color={profit >= 0 ? "gold" : "red"} icon={<BarChart2 className="w-3 h-3" />} />
            <KpiMini label="ربح/تكلفة" value={fmtPct(profitOnCost)} color="teal" icon={<Percent className="w-3 h-3" />} />
            <KpiMini label="ROI المستثمر" value={fmtPct(investorROI)} color="gold" icon={<Sparkles className="w-3 h-3" />} />
            <KpiMini label="نقطة التعادل" value={breakEvenPct > 0 ? `${breakEvenPct.toFixed(0)}%` : "—"} color="slate" icon={<Scale className="w-3 h-3" />} />
          </div>

          {/* ═══ TWO COLUMNS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

            {/* ─── LEFT: FINANCIALS ─── */}
            <div className="space-y-3">

              {/* Revenue */}
              <SectionCard title="الإيرادات" icon={<TrendingUp className="w-3.5 h-3.5 text-white" />} gradient="from-teal-600 to-teal-800" borderColor="border-teal-200/60">
                <div className="space-y-1">
                  <Row label="سكني" value={fmt(revRes)} pct={totalRevenue > 0 ? (revRes / totalRevenue * 100) : 0} color="text-teal-700" />
                  <Row label="تجزئة" value={fmt(revRet)} pct={totalRevenue > 0 ? (revRet / totalRevenue * 100) : 0} color="text-teal-700" />
                  <Row label="مكاتب" value={fmt(revOff)} pct={totalRevenue > 0 ? (revOff / totalRevenue * 100) : 0} color="text-teal-700" />
                  <TotalRow label="إجمالي الإيرادات" value={fmt(totalRevenue)} bgColor="bg-teal-50" textColor="text-teal-800" />
                </div>
              </SectionCard>

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
                  <Row label="تسجيل الوحدات (ريرا)" value={fmt(costs?.reraUnitRegFee || 0)} pct={totalCosts > 0 ? ((costs?.reraUnitRegFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="تسجيل المشروع (ريرا)" value={fmt(costs?.reraProjectRegFee || 0)} pct={totalCosts > 0 ? ((costs?.reraProjectRegFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="NOC المطور" value={fmt(costs?.developerNocFee || 0)} pct={totalCosts > 0 ? ((costs?.developerNocFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="حساب الضمان" value={fmt(costs?.escrowAccountFee || 0)} pct={totalCosts > 0 ? ((costs?.escrowAccountFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="رسوم البنك" value={fmt(costs?.bankFees || 0)} pct={totalCosts > 0 ? ((costs?.bankFees || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="تقرير مدقق ريرا" value={fmt(costs?.reraAuditReportFee || 0)} pct={totalCosts > 0 ? ((costs?.reraAuditReportFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="تقارير فحص ريرا" value={fmt(costs?.reraInspectionReportFee || 0)} pct={totalCosts > 0 ? ((costs?.reraInspectionReportFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {/* المبيعات */}
                  <div className="text-[9px] font-bold text-gray-500 pt-1.5 pb-0.5 border-b border-gray-100">المبيعات والتسويق</div>
                  <Row label="أتعاب المطور" value={fmt(costs?.developerFee || 0)} pct={totalCosts > 0 ? ((costs?.developerFee || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="عمولة المبيعات" value={fmt(costs?.salesCommission || 0)} pct={totalCosts > 0 ? ((costs?.salesCommission || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="التسويق" value={fmt(costs?.marketingCost || 0)} pct={totalCosts > 0 ? ((costs?.marketingCost || 0) / totalCosts * 100) : 0} color="text-gray-700" />
                  {/* الإجمالي */}
                  <TotalRow label="إجمالي التكاليف" value={fmt(totalCosts)} bgColor="bg-slate-100" textColor="text-slate-800" />
                </div>
              </SectionCard>

              {/* Profit & Ratios */}
              <SectionCard title="الأرباح والعوائد" icon={<BarChart2 className="w-3.5 h-3.5 text-amber-300" />} gradient="from-teal-700 to-teal-900" borderColor="border-teal-200/60">
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-[11px] font-bold text-gray-700">صافي الربح</span>
                    <span className={`text-lg font-black tabular-nums ${profit >= 0 ? 'text-teal-700' : 'text-red-700'}`} dir="ltr">{fmt(profit)} <span className="text-[9px] text-gray-400">AED</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <RatioBox label="ربح/تكلفة" value={fmtPct(profitOnCost)} color="teal" />
                    <RatioBox label="ربح/رأس المال" value={fmtPct(profitOnCapital)} color="gold" />
                    <RatioBox label="هامش الربح" value={fmtPct(profitMargin)} color="slate" />
                  </div>
                  {/* Developer / Investor split */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-800">أتعاب المطور (15%)</span>
                      </div>
                      <div className="text-sm font-black text-amber-900 tabular-nums" dir="ltr">{fmt(comoFee)}</div>
                    </div>
                    <div className="bg-teal-50/80 border border-teal-200/60 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Users className="w-3 h-3 text-teal-600" />
                        <span className="text-[10px] font-bold text-teal-800">ربح المستثمر (85%)</span>
                      </div>
                      <div className="text-sm font-black text-teal-900 tabular-nums" dir="ltr">{fmt(investorProfit)}</div>
                      <div className="text-[9px] text-teal-600 mt-0.5">ROI: {fmtPct(investorROI)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ═══ SCENARIO COMPARISON ═══ */}
              <SectionCard title="مقارنة السيناريوهات" icon={<Layers className="w-3.5 h-3.5 text-white" />} gradient="from-indigo-600 to-violet-700" borderColor="border-indigo-200/60">
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500">
                        <th className="py-1.5 px-2 text-right font-medium">السيناريو</th>
                        <th className="py-1.5 px-2 text-center font-medium">الإيرادات</th>
                        <th className="py-1.5 px-2 text-center font-medium">الربح</th>
                        <th className="py-1.5 px-2 text-center font-medium">ROI المستثمر</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-50 bg-green-50/30">
                        <td className="py-1.5 px-2 font-bold text-green-700">متفائل (+10%)</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(optimistic.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-green-700" dir="ltr">{fmtM(optimistic.profit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-green-700">{fmtPct(optimistic.roi)}</td>
                      </tr>
                      <tr className="border-t border-gray-100 bg-blue-50/30">
                        <td className="py-1.5 px-2 font-bold text-blue-700">أساسي</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(base.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-blue-700" dir="ltr">{fmtM(base.profit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-blue-700">{fmtPct(base.roi)}</td>
                      </tr>
                      <tr className="border-t border-gray-100 bg-orange-50/30">
                        <td className="py-1.5 px-2 font-bold text-orange-700">متحفظ (-10%)</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums" dir="ltr">{fmtM(conservative.revenue)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-orange-700" dir="ltr">{fmtM(conservative.profit)}</td>
                        <td className="py-1.5 px-2 text-center font-bold tabular-nums text-orange-700">{fmtPct(conservative.roi)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>
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

                  <DetailRow label="أتعاب المطور" value={project.developerFeePct ? `${project.developerFeePct}%` : "—"} />
                  <DetailRow label="عمولة المبيعات" value={project.salesCommissionPct ? `${project.salesCommissionPct}%` : "—"} />
                  <DetailRow label="أتعاب التصميم" value={project.designFeePct ? `${project.designFeePct}%` : "—"} />
                  <DetailRow label="أتعاب الإشراف" value={project.supervisionFeePct ? `${project.supervisionFeePct}%` : "—"} />
                  <DetailRow label="الملكية" value={project.ownershipType || "—"} />
                  <DetailRow label="سيناريو التمويل" value={
                    project.financingScenario === 'offplan_escrow' ? 'أوف بلان + ضمان' :
                    project.financingScenario === 'offplan_construction' ? 'أوف بلان + بناء' :
                    project.financingScenario === 'no_offplan' ? 'بدون أوف بلان' :
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

              {/* ═══ BREAK-EVEN ═══ */}
              <SectionCard title="نقطة التعادل (Break-even)" icon={<Scale className="w-3.5 h-3.5 text-white" />} gradient="from-amber-500 to-amber-700" borderColor="border-amber-200/60">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">المساحة المطلوب بيعها لتغطية التكاليف</span>
                    <span className="font-black text-amber-800 tabular-nums" dir="ltr">{breakEvenSqft > 0 ? `${fmt(breakEvenSqft)} قدم²` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">نسبة التعادل من إجمالي القابل للبيع</span>
                    <span className="font-black text-amber-800 tabular-nums">{breakEvenPct > 0 ? `${breakEvenPct.toFixed(1)}%` : "—"}</span>
                  </div>
                  {/* Visual bar */}
                  {breakEvenPct > 0 && (
                    <div className="mt-1">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all" style={{ width: `${Math.min(breakEvenPct, 100)}%` }} />
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-700">
                          {breakEvenPct.toFixed(0)}% من المبيعات = تغطية التكاليف
                        </div>
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                        <span>0%</span>
                        <span>100% مباع</span>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* ═══ COST/SQFT vs SELLING PRICE ═══ */}
              <SectionCard title="تكلفة القدم² مقابل سعر البيع" icon={<Activity className="w-3.5 h-3.5 text-white" />} gradient="from-cyan-600 to-sky-700" borderColor="border-sky-200/60">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">تكلفة القدم² (إجمالي التكاليف / BUA)</span>
                    <span className="font-bold text-gray-800 tabular-nums" dir="ltr">{costPerSqft > 0 ? `${costPerSqft.toFixed(0)} AED` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">متوسط سعر البيع/قدم²</span>
                    <span className="font-bold text-teal-700 tabular-nums" dir="ltr">{sellingPricePerSqft > 0 ? `${sellingPricePerSqft.toFixed(0)} AED` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] bg-teal-50/60 rounded px-2 py-1 -mx-1">
                    <span className="font-bold text-teal-800">الفارق (Spread)</span>
                    <span className={`font-black tabular-nums ${spreadPerSqft >= 0 ? 'text-teal-700' : 'text-red-700'}`} dir="ltr">{spreadPerSqft !== 0 ? `${spreadPerSqft.toFixed(0)} AED/sqft` : "—"}</span>
                  </div>
                </div>
              </SectionCard>

              {/* ═══ IRR / ANNUALIZED ═══ */}
              <SectionCard title="العائد السنوي التقديري" icon={<Target className="w-3.5 h-3.5 text-white" />} gradient="from-violet-600 to-purple-700" borderColor="border-violet-200/60">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">مدة المشروع الإجمالية</span>
                    <span className="font-bold text-gray-800">{totalMonths} شهر ({totalYears.toFixed(1)} سنة)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">ROI إجمالي للمستثمر</span>
                    <span className="font-bold text-violet-700 tabular-nums">{fmtPct(investorROI)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] bg-violet-50/60 rounded px-2 py-1 -mx-1">
                    <span className="font-bold text-violet-800">العائد السنوي التقديري (IRR مبسط)</span>
                    <span className="font-black text-violet-700 tabular-nums text-sm">{fmtPct(annualizedROI)}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 mt-1">* تقدير مبسط = ROI المستثمر ÷ عدد السنوات</div>
                </div>
              </SectionCard>
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
    teal: "bg-teal-50 border-teal-200/60 text-teal-800",
    gold: "bg-amber-50 border-amber-200/60 text-amber-800",
    red: "bg-red-50 border-red-200/60 text-red-700",
    slate: "bg-slate-50 border-slate-200/60 text-slate-700",
  };
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${colorMap[color] || colorMap.teal}`}>
      <div className="flex items-center gap-1 mb-0.5 opacity-70">{icon}<span className="text-[8px] font-medium">{label}</span></div>
      <div className="text-sm font-black tabular-nums" dir="ltr">{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, gradient, borderColor, children }: { title: string; icon: React.ReactNode; gradient: string; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl bg-white border ${borderColor} shadow-sm overflow-hidden`}>
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
