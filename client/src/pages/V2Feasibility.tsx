/**
 * V2Feasibility — دراسة الجدوى المالية (Bateekha tab)
 * Professional compact two-column layout with real project data
 */
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { ProjectSelector } from "@/components/ProjectSelector";
import {
  DollarSign, TrendingUp, BarChart2, Briefcase, Building2,
  Percent, Users, Sparkles, Target, Landmark, Info, ArrowDownCircle
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

  // Computed values
  const totalRevenue = costs?.totalRevenue || 0;
  const totalCosts = costs?.totalCosts || 0;
  const profit = totalRevenue - totalCosts;
  const profitOnCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const profitOnCapital = totalCosts > 0 ? (profit / totalCosts) * 100 : 0; // simplified — investor capital ≈ total costs
  const comoFee = profit > 0 ? profit * 0.15 : 0;
  const investorProfit = profit - comoFee;
  const investorROI = totalCosts > 0 ? (investorProfit / totalCosts) * 100 : 0;

  // Revenue breakdown
  const revRes = costs?.revenueRes || 0;
  const revRet = costs?.revenueRet || 0;
  const revOff = costs?.revenueOff || 0;

  // Cost breakdown groups
  const landCosts = (costs?.landPrice || 0) + (costs?.agentCommissionLand || 0) + (costs?.landRegistration || 0);
  const designCosts = (costs?.designFee || 0) + (costs?.soilTestFee || 0) + (costs?.topographicSurveyFee || 0) + (costs?.surveyorFees || 0);
  const constructionCosts = (costs?.constructionCost || 0) + (costs?.supervisionFee || 0) + (costs?.contingencies || 0);
  const regulatoryCosts = (costs?.communityFees || 0) + (costs?.officialBodiesFees || 0) + (costs?.reraUnitRegFee || 0) + (costs?.reraProjectRegFee || 0) + (costs?.developerNocFee || 0) + (costs?.escrowAccountFee || 0) + (costs?.bankFees || 0) + (costs?.reraAuditReportFee || 0) + (costs?.reraInspectionReportFee || 0);
  const salesCosts = (costs?.developerFee || 0) + (costs?.salesCommission || 0) + (costs?.marketingCost || 0);

  return (
    <div className="bg-gray-50 min-h-[400px]" dir="rtl">
      {/* Header with project selector */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center shadow-sm">
            <BarChart2 className="w-3.5 h-3.5 text-white" />
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
            <KpiMini label="الإيرادات" value={fmtM(totalRevenue)} color="emerald" icon={<TrendingUp className="w-3 h-3" />} />
            <KpiMini label="التكاليف" value={fmtM(totalCosts)} color="red" icon={<DollarSign className="w-3 h-3" />} />
            <KpiMini label="صافي الربح" value={fmtM(profit)} color={profit >= 0 ? "teal" : "red"} icon={<BarChart2 className="w-3 h-3" />} />
            <KpiMini label="ربح/تكلفة" value={fmtPct(profitOnCost)} color="violet" icon={<Percent className="w-3 h-3" />} />
            <KpiMini label="ربح/رأس المال" value={fmtPct(profitOnCapital)} color="blue" icon={<Target className="w-3 h-3" />} />
            <KpiMini label="ROI المستثمر" value={fmtPct(investorROI)} color="amber" icon={<Sparkles className="w-3 h-3" />} />
          </div>

          {/* ═══ TWO COLUMNS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

            {/* ─── LEFT: FINANCIALS ─── */}
            <div className="space-y-3">

              {/* Revenue */}
              <SectionCard title="الإيرادات" icon={<TrendingUp className="w-3.5 h-3.5 text-white" />} gradient="from-emerald-500 to-green-600" borderColor="border-emerald-200/60">
                <div className="space-y-1">
                  <Row label="سكني" value={fmt(revRes)} pct={totalRevenue > 0 ? (revRes / totalRevenue * 100) : 0} color="text-emerald-700" />
                  <Row label="تجزئة" value={fmt(revRet)} pct={totalRevenue > 0 ? (revRet / totalRevenue * 100) : 0} color="text-emerald-700" />
                  <Row label="مكاتب" value={fmt(revOff)} pct={totalRevenue > 0 ? (revOff / totalRevenue * 100) : 0} color="text-emerald-700" />
                  <TotalRow label="إجمالي الإيرادات" value={fmt(totalRevenue)} bgColor="bg-emerald-50" textColor="text-emerald-800" />
                </div>
              </SectionCard>

              {/* Costs */}
              <SectionCard title="التكاليف" icon={<DollarSign className="w-3.5 h-3.5 text-white" />} gradient="from-red-500 to-rose-600" borderColor="border-red-200/60">
                <div className="space-y-1">
                  <Row label="الأرض" value={fmt(landCosts)} pct={totalCosts > 0 ? (landCosts / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="التصاميم والدراسات" value={fmt(designCosts)} pct={totalCosts > 0 ? (designCosts / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="الإنشاء والإشراف" value={fmt(constructionCosts)} pct={totalCosts > 0 ? (constructionCosts / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="الرسوم التنظيمية" value={fmt(regulatoryCosts)} pct={totalCosts > 0 ? (regulatoryCosts / totalCosts * 100) : 0} color="text-gray-700" />
                  <Row label="المبيعات والتسويق" value={fmt(salesCosts)} pct={totalCosts > 0 ? (salesCosts / totalCosts * 100) : 0} color="text-gray-700" />
                  <TotalRow label="إجمالي التكاليف" value={fmt(totalCosts)} bgColor="bg-red-50" textColor="text-red-800" />
                </div>
              </SectionCard>

              {/* Profit & Ratios */}
              <SectionCard title="الأرباح والعوائد" icon={<BarChart2 className="w-3.5 h-3.5 text-white" />} gradient="from-teal-500 to-emerald-600" borderColor="border-teal-200/60">
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-[11px] font-bold text-gray-700">صافي الربح</span>
                    <span className={`text-lg font-black tabular-nums ${profit >= 0 ? 'text-teal-700' : 'text-red-700'}`} dir="ltr">{fmt(profit)} <span className="text-[9px] text-gray-400">AED</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <RatioBox label="ربح/تكلفة" value={fmtPct(profitOnCost)} color="violet" />
                    <RatioBox label="ربح/رأس المال" value={fmtPct(profitOnCapital)} color="blue" />
                    <RatioBox label="هامش الربح" value={fmtPct(totalRevenue > 0 ? (profit / totalRevenue * 100) : 0)} color="amber" />
                  </div>
                  {/* Developer / Investor split */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div className="bg-orange-50/70 border border-orange-200/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Sparkles className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-bold text-orange-800">أتعاب المطور (15%)</span>
                      </div>
                      <div className="text-sm font-black text-orange-800 tabular-nums" dir="ltr">{fmt(comoFee)}</div>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Users className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-800">ربح المستثمر (85%)</span>
                      </div>
                      <div className="text-sm font-black text-emerald-800 tabular-nums" dir="ltr">{fmt(investorProfit)}</div>
                      <div className="text-[9px] text-emerald-600 mt-0.5">ROI: {fmtPct(investorROI)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ─── RIGHT: PROJECT DETAILS ─── */}
            <div className="space-y-3">

              {/* Project Details */}
              <SectionCard title="تفاصيل المشروع" icon={<Building2 className="w-3.5 h-3.5 text-white" />} gradient="from-slate-600 to-gray-700" borderColor="border-gray-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                  <DetailRow label="اسم المشروع" value={project.name || "—"} />
                  <DetailRow label="المنطقة" value={project.community || project.areaCode || "—"} />
                  <DetailRow label="مساحة الأرض" value={project.plotAreaSqft ? `${fmt(parseFloat(project.plotAreaSqft))} قدم²` : "—"} />
                  <DetailRow label="مساحة البناء (BUA)" value={project.manualBuaSqft ? `${fmt(parseFloat(project.manualBuaSqft))} قدم²` : "—"} />
                  <DetailRow label="سعر الأرض" value={project.landPrice ? `${fmt(parseFloat(project.landPrice))} AED` : "—"} />
                  <DetailRow label="تكلفة الإنشاء/قدم²" value={project.estimatedConstructionPricePerSqft ? `${parseFloat(project.estimatedConstructionPricePerSqft).toFixed(0)} AED` : "—"} />
                  <DetailRow label="مدة التصاميم" value={project.preConMonths ? `${project.preConMonths} شهر` : "—"} />
                  <DetailRow label="مدة الإنشاء" value={project.constructionMonths ? `${project.constructionMonths} شهر` : "—"} />
                  <DetailRow label="مدة التسليم" value={project.handoverMonths ? `${project.handoverMonths} شهر` : "—"} />
                  <DetailRow label="أتعاب المطور" value={project.developerFeePct ? `${project.developerFeePct}%` : "—"} />
                  <DetailRow label="عمولة المبيعات" value={project.salesCommissionPct ? `${project.salesCommissionPct}%` : "—"} />
                  <DetailRow label="التسويق" value={project.marketingPct ? `${project.marketingPct}%` : "—"} />
                  <DetailRow label="أتعاب التصميم" value={project.designFeePct ? `${project.designFeePct}%` : "—"} />
                  <DetailRow label="أتعاب الإشراف" value={project.supervisionFeePct ? `${project.supervisionFeePct}%` : "—"} />
                  <DetailRow label="الملكية" value={project.ownershipType || "—"} />
                  <DetailRow label="سيناريو التمويل" value={
                    project.financingScenario === 'offplan_escrow' ? 'أوف بلان + ضمان' :
                    project.financingScenario === 'offplan_construction' ? 'أوف بلان + بناء' :
                    project.financingScenario === 'no_offplan' ? 'بدون أوف بلان' :
                    project.financingScenario || "—"
                  } />
                </div>
              </SectionCard>

              {/* Areas */}
              <SectionCard title="المساحات" icon={<Landmark className="w-3.5 h-3.5 text-white" />} gradient="from-sky-500 to-blue-600" borderColor="border-sky-200/60">
                <div className="space-y-1.5">
                  <AreaRow label="GFA سكني" value={project.gfaResidentialSqft ? `${fmt(parseFloat(project.gfaResidentialSqft))} قدم²` : "—"} />
                  <AreaRow label="GFA تجزئة" value={project.gfaRetailSqft ? `${fmt(parseFloat(project.gfaRetailSqft))} قدم²` : "—"} />
                  <AreaRow label="GFA مكاتب" value={project.gfaOfficesSqft ? `${fmt(parseFloat(project.gfaOfficesSqft))} قدم²` : "—"} />
                  <div className="border-t border-gray-100 pt-1.5">
                    <AreaRow label="إجمالي GFA" value={
                      (parseFloat(project.gfaResidentialSqft || "0") + parseFloat(project.gfaRetailSqft || "0") + parseFloat(project.gfaOfficesSqft || "0")) > 0
                        ? `${fmt(parseFloat(project.gfaResidentialSqft || "0") + parseFloat(project.gfaRetailSqft || "0") + parseFloat(project.gfaOfficesSqft || "0"))} قدم²`
                        : "—"
                    } bold />
                  </div>
                </div>
              </SectionCard>

              {/* Key Metrics Summary */}
              <SectionCard title="ملخص المؤشرات" icon={<Info className="w-3.5 h-3.5 text-white" />} gradient="from-indigo-500 to-violet-600" borderColor="border-indigo-200/60">
                <div className="space-y-1.5 text-[11px]">
                  <MetricRow label="تكلفة الإنشاء" value={`${fmt(costs?.constructionCost || 0)} AED`} />
                  <MetricRow label="رأس المال المطلوب (المستثمر)" value={`${fmt(totalCosts)} AED`} />
                  <MetricRow label="أتعاب المطور من الأرباح" value={`${fmt(comoFee)} AED (15%)`} highlight />
                  <MetricRow label="صافي ربح المستثمر" value={`${fmt(investorProfit)} AED (85%)`} highlight />
                  <MetricRow label="نسبة ربح المستثمر من رأس المال" value={fmtPct(investorROI)} highlight />
                  <MetricRow label="فترة الاسترداد التقديرية" value={`${parseInt(project.preConMonths || "6") + parseInt(project.constructionMonths || "18") + parseInt(project.handoverMonths || "2")} شهر`} />
                  <MetricRow label="تكلفة القدم المربع (إجمالي)" value={
                    parseFloat(project.manualBuaSqft || "0") > 0
                      ? `${(totalCosts / parseFloat(project.manualBuaSqft)).toFixed(0)} AED/sqft`
                      : "—"
                  } />
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
    emerald: "bg-emerald-50 border-emerald-200/60 text-emerald-700",
    red: "bg-red-50 border-red-200/60 text-red-700",
    teal: "bg-teal-50 border-teal-200/60 text-teal-700",
    violet: "bg-violet-50 border-violet-200/60 text-violet-700",
    blue: "bg-blue-50 border-blue-200/60 text-blue-700",
    amber: "bg-amber-50 border-amber-200/60 text-amber-700",
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
    violet: "bg-violet-50/80 border-violet-200/60 text-violet-700",
    blue: "bg-blue-50/80 border-blue-200/60 text-blue-700",
    amber: "bg-amber-50/80 border-amber-200/60 text-amber-700",
  };
  return (
    <div className={`border rounded-lg p-1.5 text-center ${colorMap[color] || colorMap.violet}`}>
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
      <span className={`tabular-nums ${bold ? 'font-black text-sky-800' : 'font-bold text-gray-700'}`} dir="ltr">{value}</span>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${highlight ? 'bg-indigo-50/50 rounded px-1.5 -mx-1.5' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`font-bold tabular-nums ${highlight ? 'text-indigo-700' : 'text-gray-800'}`} dir="ltr">{value}</span>
    </div>
  );
}
