import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, DollarSign, FileWarning, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

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

/* ─── Colored dot colors cycling ─── */
const DOT_COLORS = [
  "bg-red-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-orange-500",
  "bg-teal-500", "bg-indigo-500", "bg-lime-500", "bg-rose-500",
  "bg-sky-500", "bg-violet-500", "bg-fuchsia-500", "bg-yellow-500",
  "bg-green-500", "bg-blue-400", "bg-red-400", "bg-emerald-400",
  "bg-amber-400", "bg-purple-400", "bg-pink-400", "bg-cyan-400",
  "bg-orange-400", "bg-teal-400",
];

/* ─── Profit Indicator Component ─── */
function ProfitIndicator({ margin }: { margin: number }) {
  if (margin >= 20) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
          <ArrowUpRight className="w-5 h-5" />
          <span className="text-sm font-bold">{margin.toFixed(1)}%</span>
        </div>
        <span className="text-xs text-emerald-600 font-medium">ممتاز</span>
      </div>
    );
  }
  if (margin >= 15) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm font-bold">{margin.toFixed(1)}%</span>
        </div>
        <span className="text-xs text-emerald-500 font-medium">جيد</span>
      </div>
    );
  }
  if (margin >= 10) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
          <Minus className="w-5 h-5" />
          <span className="text-sm font-bold">{margin.toFixed(1)}%</span>
        </div>
        <span className="text-xs text-amber-600 font-medium">متوسط</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-full">
        <ArrowDownRight className="w-5 h-5" />
        <span className="text-sm font-bold">{margin.toFixed(1)}%</span>
      </div>
      <span className="text-xs text-red-600 font-medium">ضعيف</span>
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

  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000, refetchOnWindowFocus: true });
  const project = projectQuery.data;

  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000, refetchOnWindowFocus: true });
  const mo = moQuery.data;

  const cpQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 2000, refetchOnWindowFocus: true, refetchInterval: 5000 });
  const cp = cpQuery.data;

  const costsQuery = trpc.costsCashFlow.getByProject.useQuery(projectId || 0, { enabled: !!projectId });

  const getAvg = useCallback((pctKey: string, avgVal: number | null | undefined) => {
    const v = avgVal || 0;
    if (v > 0) return v;
    const mapping = DEFAULT_AVG_AREAS[pctKey];
    return mapping ? mapping.defaultArea : 0;
  }, []);

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

  useEffect(() => {
    if (costsQuery.data?.aiSmartReport) setSmartReport(costsQuery.data.aiSmartReport);
  }, [costsQuery.data]);

  // ═══════════════════════════════════════════
  // Calculate costs for a given scenario
  // ═══════════════════════════════════════════
  const calcForScenario = useCallback((scenario: "optimistic" | "base" | "conservative") => {
    const p = project || {} as any;

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

    const bua = manualBuaSqft;
    const plotAreaSqft = parseFloat(p.plotAreaSqft || "0");
    const plotAreaM2 = plotAreaSqft * 0.0929;

    const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
    const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
    const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
    const saleableRes = gfaResSqft * 0.95;
    const saleableRet = gfaRetSqft * 0.97;
    const saleableOff = gfaOffSqft * 0.95;

    // Get prices for the specific scenario
    const getPrices = () => {
      if (!cp) return { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 };
      if (scenario === "optimistic") return {
        studioPrice: cp.optStudioPrice || 0, oneBrPrice: cp.opt1brPrice || 0, twoBrPrice: cp.opt2brPrice || 0, threeBrPrice: cp.opt3brPrice || 0,
        retailSmallPrice: cp.optRetailSmallPrice || 0, retailMediumPrice: cp.optRetailMediumPrice || 0, retailLargePrice: cp.optRetailLargePrice || 0,
        officeSmallPrice: cp.optOfficeSmallPrice || 0, officeMediumPrice: cp.optOfficeMediumPrice || 0, officeLargePrice: cp.optOfficeLargePrice || 0,
      };
      if (scenario === "conservative") return {
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

    const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
      const allocated = saleable * (pct / 100);
      const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
      return avgArea * pricePerSqft * units;
    };

    let revenueRes = 0, revenueRet = 0, revenueOff = 0;

    if (mo) {
      revenueRes += calcTypeRevenue(parseFloat(mo.residentialStudioPct || "0"), getAvg("residentialStudioPct", mo.residentialStudioAvgArea), prices.studioPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential1brPct || "0"), getAvg("residential1brPct", mo.residential1brAvgArea), prices.oneBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential2brPct || "0"), getAvg("residential2brPct", mo.residential2brAvgArea), prices.twoBrPrice, saleableRes);
      revenueRes += calcTypeRevenue(parseFloat(mo.residential3brPct || "0"), getAvg("residential3brPct", mo.residential3brAvgArea), prices.threeBrPrice, saleableRes);

      revenueRet += calcTypeRevenue(parseFloat(mo.retailSmallPct || "0"), getAvg("retailSmallPct", mo.retailSmallAvgArea), prices.retailSmallPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailMediumPct || "0"), getAvg("retailMediumPct", mo.retailMediumAvgArea), prices.retailMediumPrice, saleableRet);
      revenueRet += calcTypeRevenue(parseFloat(mo.retailLargePct || "0"), getAvg("retailLargePct", mo.retailLargeAvgArea), prices.retailLargePrice, saleableRet);

      revenueOff += calcTypeRevenue(parseFloat(mo.officeSmallPct || "0"), getAvg("officeSmallPct", mo.officeSmallAvgArea), prices.officeSmallPrice, saleableOff);
      revenueOff += calcTypeRevenue(parseFloat(mo.officeMediumPct || "0"), getAvg("officeMediumPct", mo.officeMediumAvgArea), prices.officeMediumPrice, saleableOff);
      revenueOff += calcTypeRevenue(parseFloat(mo.officeLargePct || "0"), getAvg("officeLargePct", mo.officeLargeAvgArea), prices.officeLargePrice, saleableOff);
    }

    const totalRevenue = revenueRes + revenueRet + revenueOff;

    // CALCULATED COSTS
    const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
    const landRegistration = landPrice * 0.04;
    const constructionCost = bua * estimatedConstructionPricePerSqft;
    const designFee = constructionCost * (designFeePct / 100);
    const supervisionFee = constructionCost * (supervisionFeePct / 100);
    const separationFee = plotAreaM2 * separationFeePerM2;
    const contingencies = constructionCost * 0.02;
    const developerFee = totalRevenue * (developerFeePct / 100);
    const salesCommission = totalRevenue * (salesCommissionPct / 100);
    const marketingCost = totalRevenue * (marketingPct / 100);

    const totalRegulatory = reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;
    const totalCosts = landPrice + agentCommissionLand + landRegistration
      + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee
      + constructionCost + communityFees + contingencies
      + developerFee + salesCommission + marketingCost
      + totalRegulatory;

    const profit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    return {
      landPrice, agentCommissionLandPct, estimatedConstructionPricePerSqft,
      soilTestFee, topographicSurveyFee, officialBodiesFees,
      reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee,
      bankFees, communityFees, surveyorFees, reraAuditReportFee, reraInspectionReportFee,
      designFeePct, supervisionFeePct, separationFeePerM2,
      salesCommissionPct, marketingPct, developerFeePct,
      bua, plotAreaM2,
      agentCommissionLand, landRegistration,
      constructionCost, designFee, supervisionFee, separationFee,
      contingencies,
      developerFee, salesCommission, marketingCost,
      totalRegulatory, totalCosts, totalRevenue, profit, profitMargin, roi,
    };
  }, [project, mo, cp, getAvg]);

  // Active scenario costs (for the main list)
  const costs = useMemo(() => {
    const activeScenario = (cp?.activeScenario || "base") as "optimistic" | "base" | "conservative";
    const c = calcForScenario(activeScenario);

    const missing: string[] = [];
    if (!c.landPrice) missing.push("سعر الأرض (بطاقة المشروع)");
    if (!c.estimatedConstructionPricePerSqft) missing.push("السعر التقديري للقدم² (بطاقة المشروع)");
    if (!c.bua) missing.push("مساحة البناء BUA (بطاقة المشروع)");
    if (!c.totalRevenue) missing.push("إجمالي الإيرادات (أكمل Tab 1 و Tab 2)");

    return { ...c, missing };
  }, [calcForScenario, cp]);

  // All 3 scenarios for comparison
  const scenarios = useMemo(() => ({
    optimistic: calcForScenario("optimistic"),
    base: calcForScenario("base"),
    conservative: calcForScenario("conservative"),
  }), [calcForScenario]);

  // ─── Sync to Cash Flow ───
  const syncMutation = trpc.cashFlowProgram.syncFromFeasibility.useMutation({
    onSuccess: () => toast.success("تم تحديث التدفقات النقدية بنجاح"),
    onError: (err) => toast.error(err.message || "فشل في تحديث التدفقات النقدية"),
  });

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
  const activeScenario = cp?.activeScenario || "base";

  // ═══════════════════════════════════════════
  // FLAT LIST — every cost item in one continuous list
  // ═══════════════════════════════════════════
  type CostLine = { label: string; value: number; note?: string };

  const allCostItems: CostLine[] = [
    { label: "سعر الأرض", value: costs.landPrice },
    { label: "عمولة وسيط الأرض", value: costs.agentCommissionLand, note: `${costs.agentCommissionLandPct}%` },
    { label: "رسوم تسجيل الأرض", value: costs.landRegistration, note: "4%" },
    { label: "فحص التربة", value: costs.soilTestFee },
    { label: "المسح الطبوغرافي", value: costs.topographicSurveyFee },
    { label: "رسوم الجهات الرسمية", value: costs.officialBodiesFees },
    { label: "أتعاب التصميم", value: costs.designFee, note: `${costs.designFeePct}% من تكلفة البناء` },
    { label: "أتعاب الإشراف", value: costs.supervisionFee, note: `${costs.supervisionFeePct}% من تكلفة البناء` },
    { label: "رسوم الفرز", value: costs.separationFee, note: `${costs.separationFeePerM2} AED/م²` },
    { label: "تكلفة البناء", value: costs.constructionCost, note: `${fmt(costs.bua)} قدم² × ${fmt(costs.estimatedConstructionPricePerSqft)}` },
    { label: "رسوم المجتمع", value: costs.communityFees },
    { label: "احتياطي وطوارئ", value: costs.contingencies, note: "2% من البناء" },
    { label: "أتعاب المطور", value: costs.developerFee, note: `${costs.developerFeePct}% من المبيعات` },
    { label: "عمولة البيع", value: costs.salesCommission, note: `${costs.salesCommissionPct}% من المبيعات` },
    { label: "التسويق", value: costs.marketingCost, note: `${costs.marketingPct}% من المبيعات` },
    { label: "رسوم تسجيل الوحدات — ريرا", value: costs.reraUnitRegFee },
    { label: "رسوم تسجيل المشروع — ريرا", value: costs.reraProjectRegFee },
    { label: "رسوم عدم ممانعة — المطور", value: costs.developerNocFee },
    { label: "حساب الضمان (Escrow)", value: costs.escrowAccountFee },
    { label: "الرسوم البنكية", value: costs.bankFees },
    { label: "أتعاب المسّاح", value: costs.surveyorFees },
    { label: "تدقيق ريرا", value: costs.reraAuditReportFee },
    { label: "تفتيش ريرا", value: costs.reraInspectionReportFee },
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
          <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => {
              if (!studyId) { toast.error("لا توجد دراسة جدوى مرتبطة"); return; }
              syncMutation.mutate({ projectId: projectId! });
            }}
            disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            تحديث التدفقات النقدية
          </Button>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          انعكاس تلقائي — لتعديل البيانات ارجع لبطاقة المشروع أو التبويبات السابقة
        </div>
      </div>

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

      {/* ═══ القائمة المسطحة الشاملة ═══ */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {allCostItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/10 transition-colors">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[i % DOT_COLORS.length]}`} />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-foreground/90">{item.label}</span>
              {item.note && (
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap">{item.note}</span>
              )}
            </div>
            <span className="text-sm font-mono text-foreground/80 whitespace-nowrap" dir="ltr">{fmt(item.value)}</span>
          </div>
        ))}

        {/* ─── إجمالي التكاليف ─── */}
        <div className="flex items-center gap-3 px-5 py-4 bg-slate-900">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white" />
          <span className="text-sm font-bold text-white flex-1">إجمالي تكاليف المشروع</span>
          <span className="text-base font-bold font-mono text-white" dir="ltr">{fmt(costs.totalCosts)} <span className="text-xs font-normal opacity-70">درهم</span></span>
        </div>

        {/* ─── إجمالي المبيعات ─── */}
        <div className="flex items-center gap-3 px-5 py-4 bg-blue-700">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white" />
          <span className="text-sm font-bold text-white flex-1">إجمالي المبيعات</span>
          <span className="text-base font-bold font-mono text-white" dir="ltr">{fmt(costs.totalRevenue)} <span className="text-xs font-normal opacity-70">درهم</span></span>
        </div>

        {/* ─── صافي الربح ─── */}
        <div className={`flex items-center gap-3 px-5 py-4 ${costs.profit >= 0 ? "bg-emerald-700" : "bg-red-700"}`}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white" />
          <span className="text-sm font-bold text-white flex-1">صافي الربح</span>
          <span className="text-base font-bold font-mono text-white" dir="ltr">{fmt(costs.profit)} <span className="text-xs font-normal opacity-70">درهم</span></span>
        </div>

        {/* ─── نسبة الربح مع المؤشر البصري ─── */}
        <div className={`flex items-center gap-3 px-5 py-4 ${costs.profitMargin >= 15 ? "bg-emerald-800" : costs.profitMargin >= 10 ? "bg-amber-700" : "bg-red-800"} rounded-b-xl`}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white" />
          <span className="text-sm font-bold text-white flex-1">نسبة الربح</span>
          <ProfitIndicator margin={costs.profitMargin} />
        </div>
      </div>

      {/* ═══ مقارنة السيناريوهات الثلاثة ═══ */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30 bg-gradient-to-l from-muted/30">
          <h3 className="text-sm font-bold text-foreground">مقارنة السيناريوهات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">مقارنة الأداء المالي بين السيناريوهات الثلاثة</p>
        </div>

        {/* Header */}
        <div className="grid grid-cols-4 gap-0 border-b border-border/40 bg-muted/20">
          <div className="px-4 py-3 text-xs font-bold text-muted-foreground">البند</div>
          <div className="px-4 py-3 text-xs font-bold text-center text-emerald-700 border-x border-border/20">
            <TrendingUp className="w-3.5 h-3.5 inline ml-1" />
            المتفائل
          </div>
          <div className={`px-4 py-3 text-xs font-bold text-center border-l border-border/20 ${activeScenario === "base" ? "text-blue-700 bg-blue-50/50" : "text-blue-600"}`}>
            السيناريو الأساسي
            {activeScenario === "base" && <span className="mr-1 text-[9px] bg-blue-100 px-1 rounded">نشط</span>}
          </div>
          <div className="px-4 py-3 text-xs font-bold text-center text-amber-700">
            <TrendingDown className="w-3.5 h-3.5 inline ml-1" />
            المتحفظ
          </div>
        </div>

        {/* Rows */}
        {[
          { label: "إجمالي المبيعات", key: "totalRevenue" as const },
          { label: "إجمالي التكاليف", key: "totalCosts" as const },
          { label: "صافي الربح", key: "profit" as const },
          { label: "نسبة الربح", key: "profitMargin" as const },
          { label: "العائد على الاستثمار", key: "roi" as const },
        ].map((row, i) => (
          <div key={row.key} className={`grid grid-cols-4 gap-0 border-b border-border/20 last:border-b-0 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
            <div className="px-4 py-3 text-sm text-foreground/80 font-medium">{row.label}</div>
            {(["optimistic", "base", "conservative"] as const).map((sc) => {
              const val = scenarios[sc][row.key];
              const isPct = row.key === "profitMargin" || row.key === "roi";
              const isProfit = row.key === "profit";
              const isActive = sc === activeScenario;
              return (
                <div key={sc} className={`px-4 py-3 text-center text-sm font-mono ${isActive ? "bg-blue-50/30" : ""} ${sc !== "conservative" ? "border-x border-border/10" : ""}`}>
                  {isPct ? (
                    <span className={val >= 15 ? "text-emerald-600 font-bold" : val >= 10 ? "text-amber-600 font-bold" : "text-red-600 font-bold"}>
                      {val.toFixed(1)}%
                    </span>
                  ) : (
                    <span className={isProfit ? (val >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold") : "text-foreground/80"} dir="ltr">
                      {fmt(val)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Profit indicator row */}
        <div className="grid grid-cols-4 gap-0 bg-muted/10 border-t border-border/30">
          <div className="px-4 py-3 text-sm text-foreground/80 font-medium">التقييم</div>
          {(["optimistic", "base", "conservative"] as const).map((sc) => {
            const m = scenarios[sc].profitMargin;
            return (
              <div key={sc} className="px-4 py-3 flex justify-center">
                <ProfitIndicator margin={m} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
