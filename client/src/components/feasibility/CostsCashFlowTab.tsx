import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, DollarSign, TrendingUp, BarChart3, Building2, Percent, FileWarning } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

/* ─── Read-only cost row ─── */
function CostRow({ label, value, suffix, highlight, indent, pct }: {
  label: string; value: number; suffix?: string; highlight?: boolean; indent?: boolean; pct?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 ${highlight ? "bg-primary/5 rounded-lg font-bold" : ""} ${indent ? "pr-8" : ""}`}>
      <span className={`text-sm text-right flex-1 ${indent ? "text-muted-foreground" : ""}`}>
        {indent && "← "}{label}
      </span>
      <span className={`text-sm font-mono ${highlight ? "text-primary text-base" : "text-muted-foreground"}`} dir="ltr">
        {pct ? `${value.toFixed(1)}%` : `${fmt(value)} ${suffix || "AED"}`}
      </span>
    </div>
  );
}

/* ─── Section Card ─── */
function CostSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3 border-b pb-2">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        <div className="space-y-0.5 divide-y divide-border/30">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Missing data warning ─── */
function MissingDataWarning({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
      <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold text-amber-700 mb-1">بيانات ناقصة - يرجى إكمالها في بطاقة المشروع:</p>
        <ul className="text-xs text-amber-600 space-y-0.5">
          {items.map((item, i) => <li key={i}>• {item}</li>)}
        </ul>
      </div>
    </div>
  );
}

interface CostsCashFlowTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CostsCashFlowTab({ projectId, studyId, form: feasForm, computed: feasComputed }: CostsCashFlowTabProps) {
  const [smartReport, setSmartReport] = useState("");

  // Fetch project data (Fact Sheet) for cost fields
  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId });
  const project = projectQuery.data;

  // Fetch Tab 1 (Market Overview) data for unit distribution & areas
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId });
  const mo = moQuery.data;

  // Fetch Tab 2 (Competition Pricing) data for prices
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId });
  const cp = cpQuery.data;

  // Fetch costs data (for smart report and approval status only)
  const costsQuery = trpc.costsCashFlow.getByProject.useQuery(projectId || 0, { enabled: !!projectId });

  const smartReportMutation = trpc.costsCashFlow.generateSmartReport.useMutation({
    onSuccess: (data) => {
      costsQuery.refetch();
      setSmartReport(data.smartReport);
      toast.success("تم إنشاء تقرير التكاليف");
    },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const approvalMutation = trpc.costsCashFlow.toggleApproval.useMutation({
    onSuccess: () => { costsQuery.refetch(); toast.success("تم تحديث حالة الاعتماد"); },
  });

  // Load smart report from DB
  useEffect(() => {
    if (costsQuery.data?.aiSmartReport) setSmartReport(costsQuery.data.aiSmartReport);
  }, [costsQuery.data]);

  // ═══════════════════════════════════════════
  // PULL ALL DATA FROM SOURCES (READ ONLY)
  // ═══════════════════════════════════════════
  const costs = useMemo(() => {
    const p = project || {} as any;

    // --- Source 1: Fact Sheet (بطاقة البيانات) ---
    const landPrice = parseFloat(p.landPrice || "0");
    const agentCommissionLandPct = parseFloat(p.agentCommissionLandPct || "0");
    const manualBuaSqft = parseFloat(p.manualBuaSqft || "0");
    const estimatedConstructionPricePerSqft = parseFloat(p.estimatedConstructionPricePerSqft || "0");
    const soilTestFee = parseFloat(p.soilTestFee || "0");
    const topographicSurveyFee = parseFloat(p.topographicSurveyFee || "0");
    const officialBodiesFees = parseFloat(p.officialBodiesFees || "0");
    const reraUnitRegFee = parseFloat(p.reraUnitRegFee || "0");
    const reraProjectRegFee = parseFloat(p.reraProjectRegFee || "0");
    const developerNocFee = parseFloat(p.developerNocFee || "0");
    const escrowAccountFee = parseFloat(p.escrowAccountFee || "0");
    const bankFees = parseFloat(p.bankFees || "0");
    const communityFees = parseFloat(p.communityFees || "0");
    const surveyorFees = parseFloat(p.surveyorFees || "0");
    const reraAuditReportFee = parseFloat(p.reraAuditReportFee || "0");
    const reraInspectionReportFee = parseFloat(p.reraInspectionReportFee || "0");
    const designFeePct = parseFloat(p.designFeePct ?? "2");
    const supervisionFeePct = parseFloat(p.supervisionFeePct ?? "2");
    const separationFeePerM2 = parseFloat(p.separationFeePerM2 ?? "40");
    const salesCommissionPct = parseFloat(p.salesCommissionPct ?? "5");
    const marketingPct = parseFloat(p.marketingPct ?? "2");
    const developerFeePhase1Pct = parseFloat(p.developerFeePhase1Pct ?? "2");
    const developerFeePhase2Pct = parseFloat(p.developerFeePhase2Pct ?? "3");

    // --- Source 2: Fact Sheet areas ---
    const bua = manualBuaSqft;
    const plotAreaSqft = parseFloat(p.plotAreaSqft || "0");
    const plotAreaM2 = plotAreaSqft * 0.0929;

    // --- Saleable areas from GFA by type (Fact Sheet) ---
    const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
    const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
    const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
    const saleableRes = gfaResSqft * 0.95;
    const saleableRet = gfaRetSqft * 0.97;
    const saleableOff = gfaOffSqft * 0.95;

    // Total units from Tab 1 distribution
    let totalUnits = 0;

    // Get active scenario prices from competitionPricing
    const activeScenario = cp?.activeScenario || "base";
    const getPrices = () => {
      if (!cp) return { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 };
      if (activeScenario === "optimistic") return {
        studioPrice: cp.optStudioPrice || 0, oneBrPrice: cp.opt1brPrice || 0, twoBrPrice: cp.opt2brPrice || 0, threeBrPrice: cp.opt3brPrice || 0,
        retailSmallPrice: cp.optRetailSmallPrice || 0, retailMediumPrice: cp.optRetailMediumPrice || 0, retailLargePrice: cp.optRetailLargePrice || 0,
        officeSmallPrice: cp.optOfficeSmallPrice || 0, officeMediumPrice: cp.optOfficeMediumPrice || 0, officeLargePrice: cp.optOfficeLargePrice || 0,
      };
      if (activeScenario === "conservative") return {
        studioPrice: cp.consStudioPrice || 0, oneBrPrice: cp.cons1brPrice || 0, twoBrPrice: cp.cons2brPrice || 0, threeBrPrice: cp.cons3brPrice || 0,
        retailSmallPrice: cp.consRetailSmallPrice || 0, retailMediumPrice: cp.consRetailMediumPrice || 0, retailLargePrice: cp.consRetailLargePrice || 0,
        officeSmallPrice: cp.consOfficeSmallPrice || 0, officeMediumPrice: cp.consOfficeMediumPrice || 0, officeLargePrice: cp.consOfficeLargePrice || 0,
      };
      return {
        studioPrice: cp.baseStudioPrice || 0, oneBrPrice: cp.base1brPrice || 0, twoBrPrice: cp.base2brPrice || 0, threeBrPrice: cp.base3brPrice || 0,
        retailSmallPrice: cp.baseRetailSmallPrice || 0, retailMediumPrice: cp.baseRetailMediumPrice || 0, retailLargePrice: cp.baseRetailLargePrice || 0,
        officeSmallPrice: cp.baseOfficeSmallPrice || 0, officeMediumPrice: cp.baseOfficeMediumPrice || 0, officeLargePrice: cp.baseOfficeLargePrice || 0,
      };
    };
    const prices = getPrices();

    // Calculate revenue from unit distribution (Tab 1) × prices (Tab 2)
    const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
      const allocated = saleable * (pct / 100);
      const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
      return avgArea * pricePerSqft * units;
    };

    let revenueRes = 0;
    let revenueRet = 0;
    let revenueOff = 0;

    if (mo) {
      // Residential revenue
      revenueRes += calcTypeRevenue(parseFloat(mo.residentialStudioPct || "0"), mo.residentialStudioAvgArea || 0, prices.studioPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential1brPct || "0"), mo.residential1brAvgArea || 0, prices.oneBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential2brPct || "0"), mo.residential2brAvgArea || 0, prices.twoBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential3brPct || "0"), mo.residential3brAvgArea || 0, prices.threeBrPrice, saleableRes);

      // Retail revenue
      revenueRet += calcTypeRevenue(parseFloat(mo.retailSmallPct || "0"), mo.retailSmallAvgArea || 0, prices.retailSmallPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailMediumPct || "0"), mo.retailMediumAvgArea || 0, prices.retailMediumPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailLargePct || "0"), mo.retailLargeAvgArea || 0, prices.retailLargePrice, saleableRet);

      // Office revenue
      revenueOff += calcTypeRevenue(parseFloat(mo.officeSmallPct || "0"), mo.officeSmallAvgArea || 0, prices.officeSmallPrice, saleableOff);
      revenueOff += calcTypeRevenue(parseFloat(mo.officeMediumPct || "0"), mo.officeMediumAvgArea || 0, prices.officeMediumPrice, saleableOff);
      revenueOff += calcTypeRevenue(parseFloat(mo.officeLargePct || "0"), mo.officeLargeAvgArea || 0, prices.officeLargePrice, saleableOff);
    }

    const totalRevenue = revenueRes + revenueRet + revenueOff;

    // Calculate total units from Tab 1 distribution
    if (mo) {
      const calcUnits = (pct: number, avgArea: number, saleable: number) => {
        const allocated = saleable * (pct / 100);
        return avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
      };
      totalUnits += calcUnits(parseFloat(mo.residentialStudioPct || "0"), mo.residentialStudioAvgArea || 0, saleableRes);
      totalUnits += calcUnits(parseFloat(mo.residential1brPct || "0"), mo.residential1brAvgArea || 0, saleableRes);
      totalUnits += calcUnits(parseFloat(mo.residential2brPct || "0"), mo.residential2brAvgArea || 0, saleableRes);
      totalUnits += calcUnits(parseFloat(mo.residential3brPct || "0"), mo.residential3brAvgArea || 0, saleableRes);
      totalUnits += calcUnits(parseFloat(mo.retailSmallPct || "0"), mo.retailSmallAvgArea || 0, saleableRet);
      totalUnits += calcUnits(parseFloat(mo.retailMediumPct || "0"), mo.retailMediumAvgArea || 0, saleableRet);
      totalUnits += calcUnits(parseFloat(mo.retailLargePct || "0"), mo.retailLargeAvgArea || 0, saleableRet);
      totalUnits += calcUnits(parseFloat(mo.officeSmallPct || "0"), mo.officeSmallAvgArea || 0, saleableOff);
      totalUnits += calcUnits(parseFloat(mo.officeMediumPct || "0"), mo.officeMediumAvgArea || 0, saleableOff);
      totalUnits += calcUnits(parseFloat(mo.officeLargePct || "0"), mo.officeLargeAvgArea || 0, saleableOff);
    }

    // ═══════════════════════════════════════════
    // CALCULATED COSTS
    // ═══════════════════════════════════════════

    // تكاليف الأرض
    const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
    const landRegistration = landPrice * 0.04; // 4% ثابتة
    const totalLandCosts = landPrice + agentCommissionLand + landRegistration;

    // تكاليف ما قبل البناء
    const constructionCost = bua * estimatedConstructionPricePerSqft;
    const designFee = constructionCost * (designFeePct / 100);
    const supervisionFee = constructionCost * (supervisionFeePct / 100);
    const separationFee = plotAreaM2 * separationFeePerM2;
    const totalPreConstruction = soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee;

    // تكاليف البناء
    const contingencies = constructionCost * 0.02; // 2% ثابتة
    const totalConstruction = constructionCost + communityFees + contingencies;

    // تكاليف البيع والتسويق (نسب من إجمالي المبيعات)
    const developerFeePhase1 = totalRevenue * (developerFeePhase1Pct / 100);
    const developerFeePhase2 = totalRevenue * (developerFeePhase2Pct / 100);
    const totalDeveloperFee = developerFeePhase1 + developerFeePhase2;
    const salesCommission = totalRevenue * (salesCommissionPct / 100);
    const marketingCost = totalRevenue * (marketingPct / 100);
    const totalSalesMarketing = totalDeveloperFee + salesCommission + marketingCost;

    // الرسوم التنظيمية
    const totalRegulatory = reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;

    // الإجماليات
    const totalCosts = totalLandCosts + totalPreConstruction + totalConstruction + totalSalesMarketing + totalRegulatory;
    const profit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
    const costPerSqft = bua > 0 ? totalCosts / bua : 0;
    const profitPerSqft = bua > 0 ? profit / bua : 0;

    // بيانات ناقصة
    const missing: string[] = [];
    if (!landPrice) missing.push("سعر الأرض (بطاقة المشروع)");
    if (!estimatedConstructionPricePerSqft) missing.push("السعر التقديري للقدم² (بطاقة المشروع)");
    if (!bua) missing.push("مساحة البناء BUA (بطاقة المشروع)");
    if (!gfaResSqft && !gfaRetSqft && !gfaOffSqft) missing.push("GFA حسب النوع (بطاقة المشروع → قسم المساحات)");
    if (!totalRevenue) missing.push("إجمالي الإيرادات (أكمل Tab 1 و Tab 2)");

    return {
      // Sources
      landPrice, agentCommissionLandPct, manualBuaSqft, estimatedConstructionPricePerSqft,
      soilTestFee, topographicSurveyFee, officialBodiesFees,
      reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee,
      bankFees, communityFees, surveyorFees, reraAuditReportFee, reraInspectionReportFee,
      designFeePct, supervisionFeePct, separationFeePerM2,
      salesCommissionPct, marketingPct, developerFeePhase1Pct, developerFeePhase2Pct,
      bua, plotAreaM2, totalUnits, totalRevenue, revenueRes, revenueRet, revenueOff,
      // Calculated
      agentCommissionLand, landRegistration, totalLandCosts,
      constructionCost, designFee, supervisionFee, separationFee, totalPreConstruction,
      contingencies, totalConstruction,
      developerFeePhase1, developerFeePhase2, totalDeveloperFee, salesCommission, marketingCost, totalSalesMarketing,
      totalRegulatory,
      totalCosts, profit, profitMargin, roi, costPerSqft, profitPerSqft,
      missing,
    };
  }, [project, mo, cp]);

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>اختر مشروعاً لعرض التكاليف والتدفقات النقدية</p>
      </div>
    );
  }

  if (projectQuery.isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">جاري تحميل البيانات...</p>
      </div>
    );
  }

  const isApproved = costsQuery.data?.isApproved === 1;

  return (
    <div className="space-y-6" dir="rtl">
      {/* شريط الأدوات */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => smartReportMutation.mutate({ projectId })} disabled={smartReportMutation.isPending}>
            {smartReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تقرير جويل الذكي
          </Button>
          <Button size="sm" variant={isApproved ? "default" : "outline"} className="gap-1.5"
            onClick={() => approvalMutation.mutate({ projectId, approved: !isApproved })}>
            <ShieldCheck className="w-4 h-4" />
            {isApproved ? "معتمد ✓" : "اعتماد"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          📋 تقرير مُحتسب تلقائياً — لتعديل البيانات ارجع لبطاقة المشروع
        </div>
      </div>

      {/* تحذير البيانات الناقصة */}
      <MissingDataWarning items={costs.missing} />

      {/* تقرير جويل */}
      {smartReport && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <img src={JOEL_AVATAR} className="w-7 h-7 rounded-full" alt="Joel" />
              <span className="font-bold text-amber-800">تقرير جويل – تحليل التكاليف</span>
            </div>
            <div className="prose prose-sm max-w-none text-right" dir="rtl">
              <Streamdown>{smartReport}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-blue-600 mb-1">إجمالي الإيرادات</p>
            <p className="text-lg font-bold font-mono text-blue-700" dir="ltr">{fmt(costs.totalRevenue)}</p>
            <p className="text-[10px] text-blue-500">AED</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-red-600 mb-1">إجمالي التكاليف</p>
            <p className="text-lg font-bold font-mono text-red-700" dir="ltr">{fmt(costs.totalCosts)}</p>
            <p className="text-[10px] text-red-500">AED</p>
          </CardContent>
        </Card>
        <Card className={costs.profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className={`text-xs mb-1 ${costs.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>صافي الربح</p>
            <p className={`text-lg font-bold font-mono ${costs.profit >= 0 ? "text-emerald-700" : "text-red-700"}`} dir="ltr">{fmt(costs.profit)}</p>
            <p className={`text-[10px] ${costs.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>AED</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-purple-600 mb-1">هامش الربح</p>
            <p className={`text-lg font-bold font-mono ${costs.profitMargin >= 0 ? "text-purple-700" : "text-red-700"}`}>{costs.profitMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-amber-600 mb-1">العائد على الاستثمار</p>
            <p className="text-lg font-bold font-mono text-amber-700">{costs.roi.toFixed(1)}%</p>
            <p className="text-[10px] text-amber-500">ROI</p>
          </CardContent>
        </Card>
      </div>

      {/* جدول التكاليف التفصيلي */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* تكاليف الأرض */}
          <CostSection title="تكاليف الأرض" icon={Building2}>
            <CostRow label="سعر الأرض" value={costs.landPrice} />
            <CostRow label={`عمولة وسيط الأرض (${costs.agentCommissionLandPct}%)`} value={costs.agentCommissionLand} indent />
            <CostRow label="رسوم تسجيل الأرض (4%)" value={costs.landRegistration} indent />
            <CostRow label="إجمالي تكاليف الأرض" value={costs.totalLandCosts} highlight />
          </CostSection>

          {/* تكاليف ما قبل البناء */}
          <CostSection title="تكاليف ما قبل البناء" icon={BarChart3}>
            <CostRow label="فحص التربة" value={costs.soilTestFee} />
            <CostRow label="المسح الطبوغرافي" value={costs.topographicSurveyFee} />
            <CostRow label="رسوم الجهات الرسمية" value={costs.officialBodiesFees} />
            <CostRow label={`أتعاب التصميم (${costs.designFeePct}% من البناء)`} value={costs.designFee} indent />
            <CostRow label={`أتعاب الإشراف (${costs.supervisionFeePct}% من البناء)`} value={costs.supervisionFee} indent />
            <CostRow label={`رسوم الفرز (${costs.separationFeePerM2} AED/م²)`} value={costs.separationFee} indent />
            <CostRow label="إجمالي ما قبل البناء" value={costs.totalPreConstruction} highlight />
          </CostSection>

          {/* تكاليف البناء */}
          <CostSection title="تكاليف البناء" icon={DollarSign}>
            <CostRow label={`تكلفة البناء (${fmt(costs.bua)} قدم² × ${fmt(costs.estimatedConstructionPricePerSqft)} AED)`} value={costs.constructionCost} />
            <CostRow label="رسوم المجتمع" value={costs.communityFees} />
            <CostRow label="احتياطي وطوارئ (2%)" value={costs.contingencies} indent />
            <CostRow label="إجمالي تكاليف البناء" value={costs.totalConstruction} highlight />
          </CostSection>
        </div>

        <div className="space-y-4">
          {/* تكاليف البيع والتسويق */}
          <CostSection title="تكاليف البيع والتسويق" icon={TrendingUp}>
            <CostRow label={`أتعاب المطور - المرحلة الأولى (${costs.developerFeePhase1Pct}%)`} value={costs.developerFeePhase1} indent />
            <CostRow label={`أتعاب المطور - المرحلة الثانية (${costs.developerFeePhase2Pct}%)`} value={costs.developerFeePhase2} indent />
            <CostRow label="إجمالي أتعاب المطور" value={costs.totalDeveloperFee} />
            <CostRow label={`عمولة البيع (${costs.salesCommissionPct}%)`} value={costs.salesCommission} indent />
            <CostRow label={`التسويق (${costs.marketingPct}%)`} value={costs.marketingCost} indent />
            <CostRow label="إجمالي البيع والتسويق" value={costs.totalSalesMarketing} highlight />
          </CostSection>

          {/* الرسوم التنظيمية */}
          <CostSection title="الرسوم التنظيمية والإدارية" icon={Percent}>
            <CostRow label="رسوم تسجيل الوحدات — ريرا" value={costs.reraUnitRegFee} />
            <CostRow label="رسوم تسجيل المشروع — ريرا" value={costs.reraProjectRegFee} />
            <CostRow label="رسوم عدم ممانعة — المطور" value={costs.developerNocFee} />
            <CostRow label="حساب الضمان (Escrow)" value={costs.escrowAccountFee} />
            <CostRow label="الرسوم البنكية" value={costs.bankFees} />
            <CostRow label="أتعاب المسّاح" value={costs.surveyorFees} />
            <CostRow label="تدقيق ريرا" value={costs.reraAuditReportFee} />
            <CostRow label="تفتيش ريرا" value={costs.reraInspectionReportFee} />
            <CostRow label="إجمالي الرسوم التنظيمية" value={costs.totalRegulatory} highlight />
          </CostSection>
        </div>
      </div>

      {/* ملخص إجمالي التكاليف */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">إجمالي تكاليف المشروع</span>
            <span className="text-2xl font-bold font-mono text-primary" dir="ltr">{fmt(costs.totalCosts)} AED</span>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm border-t pt-3">
            <div>
              <p className="text-muted-foreground text-xs">هامش الربح</p>
              <p className={`font-bold ${costs.profitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>{costs.profitMargin.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">التكلفة / قدم² (BUA)</p>
              <p className="font-bold text-primary" dir="ltr">{fmt(costs.costPerSqft)} AED</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">الربح / قدم² (BUA)</p>
              <p className={`font-bold ${costs.profitPerSqft >= 0 ? "text-emerald-600" : "text-red-600"}`} dir="ltr">{fmt(costs.profitPerSqft)} AED</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">العائد ROI</p>
              <p className="font-bold text-amber-600">{costs.roi.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* تفصيل الإيرادات */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3 border-b pb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm">تفصيل الإيرادات (من تبويب المنافسة والتسعير)</h3>
          </div>
          <div className="space-y-0.5 divide-y divide-border/30">
            <CostRow label="إيرادات سكنية" value={costs.revenueRes} />
            <CostRow label="إيرادات محلات تجارية" value={costs.revenueRet} />
            <CostRow label="إيرادات مكاتب" value={costs.revenueOff} />
            <CostRow label="إجمالي الإيرادات" value={costs.totalRevenue} highlight />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
