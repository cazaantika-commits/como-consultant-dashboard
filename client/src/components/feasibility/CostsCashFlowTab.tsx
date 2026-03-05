import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, DollarSign, TrendingUp, FileWarning } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
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
    const developerFeePct = parseFloat(p.developerFeePct ?? "5");

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
      revenueRes += calcTypeRevenue(parseFloat(mo.residentialStudioPct || "0"), mo.residentialStudioAvgArea || 0, prices.studioPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential1brPct || "0"), mo.residential1brAvgArea || 0, prices.oneBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential2brPct || "0"), mo.residential2brAvgArea || 0, prices.twoBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential3brPct || "0"), mo.residential3brAvgArea || 0, prices.threeBrPrice, saleableRes);

      revenueRet += calcTypeRevenue(parseFloat(mo.retailSmallPct || "0"), mo.retailSmallAvgArea || 0, prices.retailSmallPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailMediumPct || "0"), mo.retailMediumAvgArea || 0, prices.retailMediumPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailLargePct || "0"), mo.retailLargeAvgArea || 0, prices.retailLargePrice, saleableRet);

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
    const landRegistration = landPrice * 0.04;
    const totalLandCosts = landPrice + agentCommissionLand + landRegistration;

    // تكاليف ما قبل البناء
    const constructionCost = bua * estimatedConstructionPricePerSqft;
    const designFee = constructionCost * (designFeePct / 100);
    const supervisionFee = constructionCost * (supervisionFeePct / 100);
    const separationFee = plotAreaM2 * separationFeePerM2;
    const totalPreConstruction = soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee;

    // تكاليف البناء
    const contingencies = constructionCost * 0.02;
    const totalConstruction = constructionCost + communityFees + contingencies;

    // تكاليف البيع والتسويق (نسب من إجمالي المبيعات)
    const developerFee = totalRevenue * (developerFeePct / 100);
    const salesCommission = totalRevenue * (salesCommissionPct / 100);
    const marketingCost = totalRevenue * (marketingPct / 100);
    const totalSalesMarketing = developerFee + salesCommission + marketingCost;

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
      landPrice, agentCommissionLandPct, manualBuaSqft: bua, estimatedConstructionPricePerSqft,
      soilTestFee, topographicSurveyFee, officialBodiesFees,
      reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee,
      bankFees, communityFees, surveyorFees, reraAuditReportFee, reraInspectionReportFee,
      designFeePct, supervisionFeePct, separationFeePerM2,
      salesCommissionPct, marketingPct, developerFeePct,
      bua, plotAreaM2, totalUnits, totalRevenue, revenueRes, revenueRet, revenueOff,
      agentCommissionLand, landRegistration, totalLandCosts,
      constructionCost, designFee, supervisionFee, separationFee, totalPreConstruction,
      contingencies, totalConstruction,
      developerFee, salesCommission, marketingCost, totalSalesMarketing,
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

  // Build the comprehensive cost list
  type CostLine = { label: string; value: number; isSubtotal?: boolean; isGroupHeader?: boolean; pctLabel?: string };

  const costLines: CostLine[] = [
    // ─── تكاليف الأرض ───
    { label: "تكاليف الأرض", value: 0, isGroupHeader: true },
    { label: "سعر الأرض", value: costs.landPrice },
    { label: "عمولة وسيط الأرض", value: costs.agentCommissionLand, pctLabel: `${costs.agentCommissionLandPct}%` },
    { label: "رسوم تسجيل الأرض", value: costs.landRegistration, pctLabel: "4%" },
    { label: "إجمالي تكاليف الأرض", value: costs.totalLandCosts, isSubtotal: true },

    // ─── تكاليف ما قبل البناء ───
    { label: "تكاليف ما قبل البناء", value: 0, isGroupHeader: true },
    { label: "فحص التربة", value: costs.soilTestFee },
    { label: "المسح الطبوغرافي", value: costs.topographicSurveyFee },
    { label: "رسوم الجهات الرسمية", value: costs.officialBodiesFees },
    { label: "أتعاب التصميم", value: costs.designFee, pctLabel: `${costs.designFeePct}% من البناء` },
    { label: "أتعاب الإشراف", value: costs.supervisionFee, pctLabel: `${costs.supervisionFeePct}% من البناء` },
    { label: "رسوم الفرز", value: costs.separationFee, pctLabel: `${costs.separationFeePerM2} AED/م²` },
    { label: "إجمالي ما قبل البناء", value: costs.totalPreConstruction, isSubtotal: true },

    // ─── تكاليف البناء ───
    { label: "تكاليف البناء", value: 0, isGroupHeader: true },
    { label: "تكلفة البناء", value: costs.constructionCost, pctLabel: `${fmt(costs.bua)} قدم² × ${fmt(costs.estimatedConstructionPricePerSqft)}` },
    { label: "رسوم المجتمع", value: costs.communityFees },
    { label: "احتياطي وطوارئ", value: costs.contingencies, pctLabel: "2%" },
    { label: "إجمالي تكاليف البناء", value: costs.totalConstruction, isSubtotal: true },

    // ─── تكاليف البيع والتسويق ───
    { label: "تكاليف البيع والتسويق", value: 0, isGroupHeader: true },
    { label: "أتعاب المطور", value: costs.developerFee, pctLabel: `${costs.developerFeePct}% من المبيعات` },
    { label: "عمولة البيع", value: costs.salesCommission, pctLabel: `${costs.salesCommissionPct}% من المبيعات` },
    { label: "التسويق", value: costs.marketingCost, pctLabel: `${costs.marketingPct}% من المبيعات` },
    { label: "إجمالي البيع والتسويق", value: costs.totalSalesMarketing, isSubtotal: true },

    // ─── الرسوم التنظيمية ───
    { label: "الرسوم التنظيمية والإدارية", value: 0, isGroupHeader: true },
    { label: "رسوم تسجيل الوحدات — ريرا", value: costs.reraUnitRegFee },
    { label: "رسوم تسجيل المشروع — ريرا", value: costs.reraProjectRegFee },
    { label: "رسوم عدم ممانعة — المطور", value: costs.developerNocFee },
    { label: "حساب الضمان (Escrow)", value: costs.escrowAccountFee },
    { label: "الرسوم البنكية", value: costs.bankFees },
    { label: "أتعاب المسّاح", value: costs.surveyorFees },
    { label: "تدقيق ريرا", value: costs.reraAuditReportFee },
    { label: "تفتيش ريرا", value: costs.reraInspectionReportFee },
    { label: "إجمالي الرسوم التنظيمية", value: costs.totalRegulatory, isSubtotal: true },
  ];

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
          تقرير مُحتسب تلقائياً — لتعديل البيانات ارجع لبطاقة المشروع
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

      {/* القائمة الشاملة للتكاليف */}
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-gradient-to-l from-slate-800 to-slate-900 px-5 py-4">
          <h2 className="text-white font-bold text-base">بيان التكاليف التفصيلي</h2>
          <p className="text-slate-400 text-xs mt-0.5">جميع بنود التكاليف المحتسبة من بطاقة المشروع ودراسة الجدوى</p>
        </div>
        <div className="divide-y divide-border/40">
          {costLines.map((line, i) => {
            if (line.isGroupHeader) {
              return (
                <div key={i} className="bg-muted/40 px-5 py-2.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{line.label}</span>
                </div>
              );
            }
            if (line.isSubtotal) {
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3 bg-primary/5 border-t border-primary/10">
                  <span className="text-sm font-bold text-primary">{line.label}</span>
                  <span className="text-sm font-bold font-mono text-primary" dir="ltr">{fmt(line.value)} AED</span>
                </div>
              );
            }
            return (
              <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground/80">{line.label}</span>
                  {line.pctLabel && (
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{line.pctLabel}</span>
                  )}
                </div>
                <span className="text-sm font-mono text-foreground/70" dir="ltr">{fmt(line.value)} AED</span>
              </div>
            );
          })}
        </div>

        {/* الإجمالي الكلي */}
        <div className="bg-gradient-to-l from-slate-800 to-slate-900 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base">إجمالي تكاليف المشروع</span>
            <span className="text-xl font-bold font-mono text-white" dir="ltr">{fmt(costs.totalCosts)} AED</span>
          </div>
        </div>
      </Card>

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

      {/* تفصيل الإيرادات */}
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-gradient-to-l from-blue-700 to-blue-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-200" />
            <h3 className="text-white font-bold text-sm">تفصيل الإيرادات (من تبويب المنافسة والتسعير)</h3>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-foreground/80">إيرادات سكنية</span>
            <span className="text-sm font-mono text-foreground/70" dir="ltr">{fmt(costs.revenueRes)} AED</span>
          </div>
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-foreground/80">إيرادات محلات تجارية</span>
            <span className="text-sm font-mono text-foreground/70" dir="ltr">{fmt(costs.revenueRet)} AED</span>
          </div>
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-foreground/80">إيرادات مكاتب</span>
            <span className="text-sm font-mono text-foreground/70" dir="ltr">{fmt(costs.revenueOff)} AED</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3 bg-blue-50">
            <span className="text-sm font-bold text-blue-700">إجمالي الإيرادات</span>
            <span className="text-sm font-bold font-mono text-blue-700" dir="ltr">{fmt(costs.totalRevenue)} AED</span>
          </div>
        </div>
      </Card>

      {/* ملخص الربحية */}
      <Card className="overflow-hidden shadow-sm">
        <div className={`px-5 py-4 ${costs.profit >= 0 ? "bg-gradient-to-l from-emerald-700 to-emerald-800" : "bg-gradient-to-l from-red-700 to-red-800"}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white">
            <div>
              <p className="text-xs opacity-80 mb-1">إجمالي الإيرادات</p>
              <p className="text-lg font-bold font-mono" dir="ltr">{fmt(costs.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">إجمالي التكاليف</p>
              <p className="text-lg font-bold font-mono" dir="ltr">{fmt(costs.totalCosts)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">صافي الربح</p>
              <p className="text-lg font-bold font-mono" dir="ltr">{fmt(costs.profit)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">التكلفة / قدم²</p>
              <p className="text-lg font-bold font-mono" dir="ltr">{fmt(costs.costPerSqft)} AED</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
