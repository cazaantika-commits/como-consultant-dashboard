import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Sparkles, ShieldCheck, DollarSign, FileWarning,
  TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, Building2, BarChart3, CreditCard, Save, Zap, CheckCircle2
} from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

/* ─── Inline editable number ─── */
function EditableNum({ value, onChange, suffix, disabled }: { value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value ? fmt(value) : "");
  return (
    <div className="relative">
      <Input type="text" value={displayVal}
        onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n)) onChange(n); }}
        onChange={(e) => setLocalVal(e.target.value)} className="h-8 text-sm text-center" disabled={disabled} dir="ltr" />
      {suffix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function EditableText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm text-center" dir="rtl" />;
}

function MissingDataWarning({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
      <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold text-amber-700 mb-1">بيانات ناقصة:</p>
        <ul className="text-xs text-amber-600 space-y-0.5">{items.map((item, i) => <li key={i}>• {item}</li>)}</ul>
      </div>
    </div>
  );
}

function ProfitIndicator({ margin }: { margin: number }) {
  if (margin >= 20) return (<div className="flex items-center gap-1.5"><div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><ArrowUpRight className="w-3.5 h-3.5" /><span className="text-xs font-bold">{margin.toFixed(1)}%</span></div><span className="text-[10px] text-emerald-600 font-medium">ممتاز</span></div>);
  if (margin >= 15) return (<div className="flex items-center gap-1.5"><div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full"><TrendingUp className="w-3.5 h-3.5" /><span className="text-xs font-bold">{margin.toFixed(1)}%</span></div><span className="text-[10px] text-emerald-500 font-medium">جيد</span></div>);
  if (margin >= 10) return (<div className="flex items-center gap-1.5"><div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Minus className="w-3.5 h-3.5" /><span className="text-xs font-bold">{margin.toFixed(1)}%</span></div><span className="text-[10px] text-amber-600 font-medium">متوسط</span></div>);
  return (<div className="flex items-center gap-1.5"><div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full"><ArrowDownRight className="w-3.5 h-3.5" /><span className="text-xs font-bold">{margin.toFixed(1)}%</span></div><span className="text-[10px] text-red-600 font-medium">ضعيف</span></div>);
}

function SectionHeader({ title, icon: Icon, isOpen, onToggle, badge, extra }: { title: string; icon: any; isOpen: boolean; onToggle: () => void; badge?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onToggle} className="flex-1 flex items-center justify-between px-4 py-3 bg-gradient-to-l from-muted/40 to-muted/10 border border-border/50 rounded-xl hover:bg-muted/50 transition-all">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {extra}
    </div>
  );
}

const DOT_COLORS = ["bg-red-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-purple-500","bg-pink-500","bg-cyan-500","bg-orange-500","bg-teal-500","bg-indigo-500","bg-lime-500","bg-rose-500","bg-sky-500","bg-violet-500","bg-fuchsia-500","bg-yellow-500","bg-green-500","bg-blue-400","bg-red-400","bg-emerald-400","bg-amber-400","bg-purple-400","bg-pink-400","bg-cyan-400","bg-orange-400","bg-teal-400"];

type ScenarioKey = "optimistic" | "base" | "conservative";

interface CostsCashFlowTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CostsCashFlowTab({ projectId, studyId }: CostsCashFlowTabProps) {
  // ═══ Section visibility ═══
  const [showDistribution, setShowDistribution] = useState(true);
  const [showPricing, setShowPricing] = useState(true);
  const [showCosts, setShowCosts] = useState(true);

  // ═══ Data queries ═══
  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000, refetchOnWindowFocus: true });
  const project = projectQuery.data;
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000, refetchOnWindowFocus: true });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 2000, refetchOnWindowFocus: true, refetchInterval: 5000 });
  const costsQuery = trpc.costsCashFlow.getByProject.useQuery(projectId || 0, { enabled: !!projectId });

  // ═══ Joelle Engine auto-populate status ═══
  const joelleStatusQuery = trpc.joelleEngine.getAutoPopulateStatus.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 10000 });
  const applyJoelleMutation = trpc.joelleEngine.applyJoelleOutputs.useMutation({
    onSuccess: (data) => {
      moQuery.refetch();
      cpQuery.refetch();
      joelleStatusQuery.refetch();
      if (data.marketOverview && data.competitionPricing) {
        toast.success("تم تطبيق مخرجات جويل بنجاح — توزيع الوحدات + التسعير");
      } else if (data.marketOverview) {
        toast.success("تم تطبيق توزيع الوحدات من محرك جويل");
      } else if (data.competitionPricing) {
        toast.success("تم تطبيق التسعير من محرك جويل");
      } else {
        toast.info("لا توجد مخرجات جاهزة من محرك جويل — شغّل المحركات أولاً");
      }
    },
    onError: (err) => toast.error(err.message || "فشل في تطبيق مخرجات جويل"),
  });

  // ═══════════════════════════════════════════
  // SECTION 1: توزيع الوحدات (Market Overview fields)
  // ═══════════════════════════════════════════
  const [moFields, setMoFields] = useState({
    residentialStudioPct: 0, residentialStudioAvgArea: 0,
    residential1brPct: 0, residential1brAvgArea: 0,
    residential2brPct: 0, residential2brAvgArea: 0,
    residential3brPct: 0, residential3brAvgArea: 0,
    retailSmallPct: 0, retailSmallAvgArea: 0,
    retailMediumPct: 0, retailMediumAvgArea: 0,
    retailLargePct: 0, retailLargeAvgArea: 0,
    officeSmallPct: 0, officeSmallAvgArea: 0,
    officeMediumPct: 0, officeMediumAvgArea: 0,
    officeLargePct: 0, officeLargeAvgArea: 0,
    finishingQuality: "standard",
  });
  const [moDirty, setMoDirty] = useState(false);
  const [moJoelleSource, setMoJoelleSource] = useState(false);

  const moSaveMutation = trpc.marketOverview.save.useMutation({
    onSuccess: () => { moQuery.refetch(); toast.success("تم حفظ توزيع الوحدات"); setMoDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  useEffect(() => {
    if (moQuery.data) {
      const d = moQuery.data;
      setMoFields({
        residentialStudioPct: parseFloat(d.residentialStudioPct || "0"),
        residentialStudioAvgArea: d.residentialStudioAvgArea || 0,
        residential1brPct: parseFloat(d.residential1brPct || "0"),
        residential1brAvgArea: d.residential1brAvgArea || 0,
        residential2brPct: parseFloat(d.residential2brPct || "0"),
        residential2brAvgArea: d.residential2brAvgArea || 0,
        residential3brPct: parseFloat(d.residential3brPct || "0"),
        residential3brAvgArea: d.residential3brAvgArea || 0,
        retailSmallPct: parseFloat(d.retailSmallPct || "0"),
        retailSmallAvgArea: d.retailSmallAvgArea || 0,
        retailMediumPct: parseFloat(d.retailMediumPct || "0"),
        retailMediumAvgArea: d.retailMediumAvgArea || 0,
        retailLargePct: parseFloat(d.retailLargePct || "0"),
        retailLargeAvgArea: d.retailLargeAvgArea || 0,
        officeSmallPct: parseFloat(d.officeSmallPct || "0"),
        officeSmallAvgArea: d.officeSmallAvgArea || 0,
        officeMediumPct: parseFloat(d.officeMediumPct || "0"),
        officeMediumAvgArea: d.officeMediumAvgArea || 0,
        officeLargePct: parseFloat(d.officeLargePct || "0"),
        officeLargeAvgArea: d.officeLargeAvgArea || 0,
        finishingQuality: d.finishingQuality || "standard",
      });
      // Fix: check aiRecommendationsJson (the actual Drizzle property name)
      if (d.aiRecommendationsJson) setMoJoelleSource(true);
    }
  }, [moQuery.data]);

  const updateMoField = useCallback((key: string, value: number | string) => {
    setMoFields(prev => ({ ...prev, [key]: value }));
    setMoDirty(true);
  }, []);

  const handleSaveMo = () => {
    if (!projectId) return;
    moSaveMutation.mutate({ projectId, ...moFields });
  };

  // ═══════════════════════════════════════════
  // SECTION 2: التسعير وخطة السداد (Competition & Pricing fields)
  // ═══════════════════════════════════════════
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");
  const [scenarios, setScenarios] = useState({
    optimistic: { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 },
    base: { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 },
    conservative: { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 },
  });
  const [payment, setPayment] = useState({
    bookingPct: 10, bookingTiming: "عند التوقيع",
    constructionPct: 60, constructionTiming: "أثناء الإنشاء",
    handoverPct: 30, handoverTiming: "عند التسليم",
    deferredPct: 0, deferredTiming: "",
  });
  const [cpDirty, setCpDirty] = useState(false);
  const [cpJoelleSource, setCpJoelleSource] = useState(false);

  const cpSaveMutation = trpc.competitionPricing.save.useMutation({
    onSuccess: () => { cpQuery.refetch(); toast.success("تم حفظ التسعير"); setCpDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  useEffect(() => {
    if (cpQuery.data) {
      const d = cpQuery.data;
      setScenarios({
        optimistic: {
          studioPrice: d.optStudioPrice || 0, oneBrPrice: d.opt1brPrice || 0, twoBrPrice: d.opt2brPrice || 0, threeBrPrice: d.opt3brPrice || 0,
          retailSmallPrice: d.optRetailSmallPrice || 0, retailMediumPrice: d.optRetailMediumPrice || 0, retailLargePrice: d.optRetailLargePrice || 0,
          officeSmallPrice: d.optOfficeSmallPrice || 0, officeMediumPrice: d.optOfficeMediumPrice || 0, officeLargePrice: d.optOfficeLargePrice || 0,
        },
        base: {
          studioPrice: d.baseStudioPrice || 0, oneBrPrice: d.base1brPrice || 0, twoBrPrice: d.base2brPrice || 0, threeBrPrice: d.base3brPrice || 0,
          retailSmallPrice: d.baseRetailSmallPrice || 0, retailMediumPrice: d.baseRetailMediumPrice || 0, retailLargePrice: d.baseRetailLargePrice || 0,
          officeSmallPrice: d.baseOfficeSmallPrice || 0, officeMediumPrice: d.baseOfficeMediumPrice || 0, officeLargePrice: d.baseOfficeLargePrice || 0,
        },
        conservative: {
          studioPrice: d.consStudioPrice || 0, oneBrPrice: d.cons1brPrice || 0, twoBrPrice: d.cons2brPrice || 0, threeBrPrice: d.cons3brPrice || 0,
          retailSmallPrice: d.consRetailSmallPrice || 0, retailMediumPrice: d.consRetailMediumPrice || 0, retailLargePrice: d.consRetailLargePrice || 0,
          officeSmallPrice: d.consOfficeSmallPrice || 0, officeMediumPrice: d.consOfficeMediumPrice || 0, officeLargePrice: d.consOfficeLargePrice || 0,
        },
      });
      if (d.paymentBookingPct) setPayment({
        bookingPct: d.paymentBookingPct || 10, bookingTiming: d.paymentBookingTiming || "عند التوقيع",
        constructionPct: d.paymentConstructionPct || 60, constructionTiming: d.paymentConstructionTiming || "أثناء الإنشاء",
        handoverPct: d.paymentHandoverPct || 30, handoverTiming: d.paymentHandoverTiming || "عند التسليم",
        deferredPct: d.paymentDeferredPct || 0, deferredTiming: d.paymentDeferredTiming || "",
      });
      if (d.activeScenario) setActiveScenario(d.activeScenario as ScenarioKey);
      // Fix: check aiRecommendationsJson (the actual Drizzle property name)
      if (d.aiRecommendationsJson) setCpJoelleSource(true);
    }
  }, [cpQuery.data]);

  const setScenarioField = useCallback((sc: ScenarioKey, key: string, value: number) => {
    setScenarios(prev => ({ ...prev, [sc]: { ...prev[sc], [key]: value } }));
    setCpDirty(true);
  }, []);

  const setPaymentField = useCallback((key: string, value: number | string) => {
    setPayment(prev => ({ ...prev, [key]: value }));
    setCpDirty(true);
  }, []);

  const handleSaveCp = () => {
    if (!projectId) return;
    cpSaveMutation.mutate({
      projectId,
      optStudioPrice: scenarios.optimistic.studioPrice, opt1brPrice: scenarios.optimistic.oneBrPrice, opt2brPrice: scenarios.optimistic.twoBrPrice, opt3brPrice: scenarios.optimistic.threeBrPrice,
      optRetailSmallPrice: scenarios.optimistic.retailSmallPrice, optRetailMediumPrice: scenarios.optimistic.retailMediumPrice, optRetailLargePrice: scenarios.optimistic.retailLargePrice,
      optOfficeSmallPrice: scenarios.optimistic.officeSmallPrice, optOfficeMediumPrice: scenarios.optimistic.officeMediumPrice, optOfficeLargePrice: scenarios.optimistic.officeLargePrice,
      baseStudioPrice: scenarios.base.studioPrice, base1brPrice: scenarios.base.oneBrPrice, base2brPrice: scenarios.base.twoBrPrice, base3brPrice: scenarios.base.threeBrPrice,
      baseRetailSmallPrice: scenarios.base.retailSmallPrice, baseRetailMediumPrice: scenarios.base.retailMediumPrice, baseRetailLargePrice: scenarios.base.retailLargePrice,
      baseOfficeSmallPrice: scenarios.base.officeSmallPrice, baseOfficeMediumPrice: scenarios.base.officeMediumPrice, baseOfficeLargePrice: scenarios.base.officeLargePrice,
      consStudioPrice: scenarios.conservative.studioPrice, cons1brPrice: scenarios.conservative.oneBrPrice, cons2brPrice: scenarios.conservative.twoBrPrice, cons3brPrice: scenarios.conservative.threeBrPrice,
      consRetailSmallPrice: scenarios.conservative.retailSmallPrice, consRetailMediumPrice: scenarios.conservative.retailMediumPrice, consRetailLargePrice: scenarios.conservative.retailLargePrice,
      consOfficeSmallPrice: scenarios.conservative.officeSmallPrice, consOfficeMediumPrice: scenarios.conservative.officeMediumPrice, consOfficeLargePrice: scenarios.conservative.officeLargePrice,
      paymentBookingPct: payment.bookingPct, paymentBookingTiming: payment.bookingTiming,
      paymentConstructionPct: payment.constructionPct, paymentConstructionTiming: payment.constructionTiming,
      paymentHandoverPct: payment.handoverPct, paymentHandoverTiming: payment.handoverTiming,
      paymentDeferredPct: payment.deferredPct, paymentDeferredTiming: payment.deferredTiming,
      activeScenario,
    });
  };

  // ═══════════════════════════════════════════
  // SECTION 3: التكاليف (Costs & Cash Flow)
  // ═══════════════════════════════════════════
  const [smartReport, setSmartReport] = useState("");
  const smartReportMutation = trpc.costsCashFlow.generateSmartReport.useMutation({
    onSuccess: (data) => { costsQuery.refetch(); setSmartReport(data.smartReport); toast.success("تم إنشاء تقرير التكاليف"); },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const approvalMutation = trpc.costsCashFlow.toggleApproval.useMutation({
    onSuccess: () => { costsQuery.refetch(); toast.success("تم تحديث حالة الاعتماد"); },
  });
  const syncMutation = trpc.cashFlowProgram.syncFromFeasibility.useMutation({
    onSuccess: () => toast.success("تم تحديث التدفقات النقدية"),
    onError: (err) => toast.error(err.message || "فشل في التحديث"),
  });

  useEffect(() => {
    if (costsQuery.data?.aiSmartReport) setSmartReport(costsQuery.data.aiSmartReport);
  }, [costsQuery.data]);

  // ═══ Helper ═══
  const getAvg = useCallback((pctKey: string, avgVal: number | null | undefined) => {
    const v = avgVal || 0;
    if (v > 0) return v;
    const mapping = DEFAULT_AVG_AREAS[pctKey];
    return mapping ? mapping.defaultArea : 0;
  }, []);

  // ═══ Cost calculations using LOCAL state (real-time) ═══
  const calcForScenario = useCallback((scenario: ScenarioKey) => {
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

    // Use LOCAL scenario state for real-time calculation
    const prices = scenarios[scenario];

    const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
      const allocated = saleable * (pct / 100);
      const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
      return avgArea * pricePerSqft * units;
    };

    // Use LOCAL moFields for real-time calculation
    const revenueRes =
      calcTypeRevenue(moFields.residentialStudioPct, getAvg("residentialStudioPct", moFields.residentialStudioAvgArea), prices.studioPrice, saleableRes) +
      calcTypeRevenue(moFields.residential1brPct, getAvg("residential1brPct", moFields.residential1brAvgArea), prices.oneBrPrice, saleableRes) +
      calcTypeRevenue(moFields.residential2brPct, getAvg("residential2brPct", moFields.residential2brAvgArea), prices.twoBrPrice, saleableRes) +
      calcTypeRevenue(moFields.residential3brPct, getAvg("residential3brPct", moFields.residential3brAvgArea), prices.threeBrPrice, saleableRes);
    const revenueRet =
      calcTypeRevenue(moFields.retailSmallPct, getAvg("retailSmallPct", moFields.retailSmallAvgArea), prices.retailSmallPrice, saleableRet) +
      calcTypeRevenue(moFields.retailMediumPct, getAvg("retailMediumPct", moFields.retailMediumAvgArea), prices.retailMediumPrice, saleableRet) +
      calcTypeRevenue(moFields.retailLargePct, getAvg("retailLargePct", moFields.retailLargeAvgArea), prices.retailLargePrice, saleableRet);
    const revenueOff =
      calcTypeRevenue(moFields.officeSmallPct, getAvg("officeSmallPct", moFields.officeSmallAvgArea), prices.officeSmallPrice, saleableOff) +
      calcTypeRevenue(moFields.officeMediumPct, getAvg("officeMediumPct", moFields.officeMediumAvgArea), prices.officeMediumPrice, saleableOff) +
      calcTypeRevenue(moFields.officeLargePct, getAvg("officeLargePct", moFields.officeLargeAvgArea), prices.officeLargePrice, saleableOff);
    const totalRevenue = revenueRes + revenueRet + revenueOff;

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
    const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + communityFees + contingencies + developerFee + salesCommission + marketingCost + totalRegulatory;
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
      agentCommissionLand, landRegistration, constructionCost, designFee, supervisionFee, separationFee,
      contingencies, developerFee, salesCommission, marketingCost,
      totalRegulatory, totalCosts, totalRevenue, profit, profitMargin, roi,
    };
  }, [project, scenarios, moFields, getAvg]);

  const scenarioResults = useMemo(() => ({
    optimistic: calcForScenario("optimistic"),
    base: calcForScenario("base"),
    conservative: calcForScenario("conservative"),
  }), [calcForScenario]);

  const costs = scenarioResults[activeScenario];
  const missing: string[] = [];
  if (!costs.landPrice) missing.push("سعر الأرض (بطاقة المشروع)");
  if (!costs.estimatedConstructionPricePerSqft) missing.push("السعر التقديري للقدم² (بطاقة المشروع)");
  if (!costs.bua) missing.push("مساحة البناء BUA (بطاقة المشروع)");

  // ═══ Revenue detail rows ═══
  const gfaResSqft = parseFloat(project?.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(project?.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(project?.gfaOfficesSqft || "0");
  const saleableRes = gfaResSqft * 0.95;
  const saleableRet = gfaRetSqft * 0.97;
  const saleableOff = gfaOffSqft * 0.95;

  const makeRevRows = (types: { key: string; label: string; pct: number; avg: number; priceKey: string }[], saleable: number) =>
    types.filter(r => r.pct > 0).map(r => {
      const allocated = saleable * (r.pct / 100);
      const units = r.avg > 0 ? Math.floor(allocated / r.avg) : 0;
      const pricePerSqft = (scenarios[activeScenario] as any)[r.priceKey] || 0;
      const unitPrice = r.avg * pricePerSqft;
      const revenue = unitPrice * units;
      return { ...r, allocated, units, pricePerSqft, unitPrice, revenue };
    });

  const resRevRows = makeRevRows([
    { key: "studio", label: "استديو", pct: moFields.residentialStudioPct, avg: getAvg("residentialStudioPct", moFields.residentialStudioAvgArea), priceKey: "studioPrice" },
    { key: "1br", label: "غرفة وصالة", pct: moFields.residential1brPct, avg: getAvg("residential1brPct", moFields.residential1brAvgArea), priceKey: "oneBrPrice" },
    { key: "2br", label: "غرفتان وصالة", pct: moFields.residential2brPct, avg: getAvg("residential2brPct", moFields.residential2brAvgArea), priceKey: "twoBrPrice" },
    { key: "3br", label: "ثلاث غرف وصالة", pct: moFields.residential3brPct, avg: getAvg("residential3brPct", moFields.residential3brAvgArea), priceKey: "threeBrPrice" },
  ], saleableRes);
  const retRevRows = makeRevRows([
    { key: "small", label: "صغيرة", pct: moFields.retailSmallPct, avg: getAvg("retailSmallPct", moFields.retailSmallAvgArea), priceKey: "retailSmallPrice" },
    { key: "medium", label: "متوسطة", pct: moFields.retailMediumPct, avg: getAvg("retailMediumPct", moFields.retailMediumAvgArea), priceKey: "retailMediumPrice" },
    { key: "large", label: "كبيرة", pct: moFields.retailLargePct, avg: getAvg("retailLargePct", moFields.retailLargeAvgArea), priceKey: "retailLargePrice" },
  ], saleableRet);
  const offRevRows = makeRevRows([
    { key: "small", label: "صغيرة", pct: moFields.officeSmallPct, avg: getAvg("officeSmallPct", moFields.officeSmallAvgArea), priceKey: "officeSmallPrice" },
    { key: "medium", label: "متوسطة", pct: moFields.officeMediumPct, avg: getAvg("officeMediumPct", moFields.officeMediumAvgArea), priceKey: "officeMediumPrice" },
    { key: "large", label: "كبيرة", pct: moFields.officeLargePct, avg: getAvg("officeLargePct", moFields.officeLargeAvgArea), priceKey: "officeLargePrice" },
  ], saleableOff);

  const totalResRev = resRevRows.reduce((s, r) => s + r.revenue, 0);
  const totalRetRev = retRevRows.reduce((s, r) => s + r.revenue, 0);
  const totalOffRev = offRevRows.reduce((s, r) => s + r.revenue, 0);
  const totalRevenue = totalResRev + totalRetRev + totalOffRev;
  const totalUnits = resRevRows.reduce((s, r) => s + r.units, 0) + retRevRows.reduce((s, r) => s + r.units, 0) + offRevRows.reduce((s, r) => s + r.units, 0);
  const paymentTotal = payment.bookingPct + payment.constructionPct + payment.handoverPct + payment.deferredPct;

  // Distribution totals
  const resTotalPct = moFields.residentialStudioPct + moFields.residential1brPct + moFields.residential2brPct + moFields.residential3brPct;
  const retTotalPct = moFields.retailSmallPct + moFields.retailMediumPct + moFields.retailLargePct;
  const offTotalPct = moFields.officeSmallPct + moFields.officeMediumPct + moFields.officeLargePct;

  const distRows = [
    { title: "الوحدات السكنية", totalPct: resTotalPct, gfa: gfaResSqft, rows: [
      { key: "studio", label: "استديو", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea" },
      { key: "1br", label: "غرفة وصالة", pctKey: "residential1brPct", avgKey: "residential1brAvgArea" },
      { key: "2br", label: "غرفتان وصالة", pctKey: "residential2brPct", avgKey: "residential2brAvgArea" },
      { key: "3br", label: "ثلاث غرف وصالة", pctKey: "residential3brPct", avgKey: "residential3brAvgArea" },
    ]},
    { title: "وحدات التجزئة", totalPct: retTotalPct, gfa: gfaRetSqft, rows: [
      { key: "small", label: "صغيرة", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea" },
      { key: "medium", label: "متوسطة", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea" },
      { key: "large", label: "كبيرة", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea" },
    ]},
    { title: "المكاتب", totalPct: offTotalPct, gfa: gfaOffSqft, rows: [
      { key: "small", label: "صغيرة", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea" },
      { key: "medium", label: "متوسطة", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea" },
      { key: "large", label: "كبيرة", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea" },
    ]},
  ];

  const scenarioConfig: Record<ScenarioKey, { label: string; color: string; bg: string; border: string; icon: any }> = {
    optimistic: { label: "المتفائل", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", icon: TrendingUp },
    base: { label: "الأساسي", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", icon: BarChart3 },
    conservative: { label: "المتحفظ", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", icon: TrendingDown },
  };

  // ═══ Revenue table sub-component ═══
  const RevenueTable = ({ title, rows, totalRev }: { title: string; rows: typeof resRevRows; totalRev: number }) => {
    if (rows.length === 0) return null;
    return (
      <div className="bg-white rounded-lg border border-border/40 overflow-hidden">
        <div className="px-3 py-2 bg-muted/20 border-b border-border/30"><h4 className="text-xs font-bold">{title}</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-muted/10 border-b border-border/20">
              <th className="px-3 py-1.5 text-right font-medium">النوع</th>
              <th className="px-2 py-1.5 text-center font-medium">%</th>
              <th className="px-2 py-1.5 text-center font-medium">المساحة</th>
              <th className="px-2 py-1.5 text-center font-medium">سعر/قدم²</th>
              <th className="px-2 py-1.5 text-center font-medium">الوحدات</th>
              <th className="px-2 py-1.5 text-center font-medium">سعر الوحدة</th>
              <th className="px-3 py-1.5 text-center font-medium">الإيراد</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border/10">
                  <td className="px-3 py-1.5 font-medium">{r.label}</td>
                  <td className="px-2 py-1.5 text-center">{r.pct}%</td>
                  <td className="px-2 py-1.5 text-center" dir="ltr">{fmt(r.avg)}</td>
                  <td className="px-2 py-1.5"><EditableNum value={r.pricePerSqft} onChange={(v) => setScenarioField(activeScenario, r.priceKey, v)} /></td>
                  <td className="px-2 py-1.5 text-center font-mono">{fmt(r.units)}</td>
                  <td className="px-2 py-1.5 text-center font-mono" dir="ltr">{fmt(r.unitPrice)}</td>
                  <td className="px-3 py-1.5 text-center font-mono font-bold" dir="ltr">{fmt(r.revenue)}</td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-bold">
                <td colSpan={6} className="px-3 py-1.5 text-right">الإجمالي</td>
                <td className="px-3 py-1.5 text-center font-mono" dir="ltr">{fmt(totalRev)} AED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══ Joelle auto-populate status ═══
  const joelleStatus = joelleStatusQuery.data;
  const hasAnyJoelleData = joelleStatus?.engine6Ready || joelleStatus?.engine7Ready;
  const alreadyApplied = joelleStatus?.moHasJoelleData && joelleStatus?.cpHasJoelleData;

  // ═══ RENDER ═══
  if (!projectId) return (<div className="text-center py-12 text-muted-foreground"><DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>اختر مشروعاً لعرض البيانات</p></div>);
  if (projectQuery.isLoading) return (<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">جاري تحميل البيانات...</p></div>);

  const isApproved = costsQuery.data?.isApproved === 1;
  const allCostItems = [
    { label: "سعر الأرض", value: costs.landPrice },
    { label: "عمولة وسيط الأرض", value: costs.agentCommissionLand, note: `${costs.agentCommissionLandPct}%` },
    { label: "رسوم تسجيل الأرض", value: costs.landRegistration, note: "4%" },
    { label: "فحص التربة", value: costs.soilTestFee },
    { label: "المسح الطبوغرافي", value: costs.topographicSurveyFee },
    { label: "رسوم الجهات الرسمية", value: costs.officialBodiesFees },
    { label: "أتعاب التصميم", value: costs.designFee, note: `${costs.designFeePct}%` },
    { label: "أتعاب الإشراف", value: costs.supervisionFee, note: `${costs.supervisionFeePct}%` },
    { label: "رسوم الفرز", value: costs.separationFee, note: `${costs.separationFeePerM2} AED/م²` },
    { label: "تكلفة البناء", value: costs.constructionCost, note: `${fmt(costs.bua)} قدم²` },
    { label: "رسوم المجتمع", value: costs.communityFees },
    { label: "احتياطي وطوارئ", value: costs.contingencies, note: "2%" },
    { label: "أتعاب المطور", value: costs.developerFee, note: `${costs.developerFeePct}%` },
    { label: "عمولة البيع", value: costs.salesCommission, note: `${costs.salesCommissionPct}%` },
    { label: "التسويق", value: costs.marketingCost, note: `${costs.marketingPct}%` },
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
    <div className="space-y-4" dir="rtl">

      {/* ═══ JOELLE AUTO-POPULATE BANNER ═══ */}
      {hasAnyJoelleData && (
        <div className="bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <img src={JOEL_AVATAR} className="w-10 h-10 rounded-full border-2 border-purple-200" alt="جويل" />
              <div>
                <h3 className="text-sm font-bold text-purple-800">مخرجات محرك جويل جاهزة</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${joelleStatus?.engine6Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {joelleStatus?.engine6Ready ? "✓" : "○"} محرك 6: استراتيجية المنتج
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${joelleStatus?.engine7Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {joelleStatus?.engine7Ready ? "✓" : "○"} محرك 7: ذكاء التسعير
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => { if (projectId) applyJoelleMutation.mutate(projectId); }}
              disabled={applyJoelleMutation.isPending}
              className={`gap-2 ${alreadyApplied ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-to-l from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"}`}
            >
              {applyJoelleMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : alreadyApplied ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {alreadyApplied ? "إعادة تطبيق مخرجات جويل" : "تعبئة تلقائية من جويل"}
            </Button>
          </div>
          {alreadyApplied && (
            <p className="text-[10px] text-purple-600 mt-2 mr-13">تم تطبيق المخرجات سابقاً — يمكنك إعادة التطبيق لتحديث البيانات أو التعديل يدوياً</p>
          )}
        </div>
      )}

      {/* ═══ SECTION 1: توزيع الوحدات ═══ */}
      <SectionHeader title="توزيع الوحدات والمساحات" icon={Building2} isOpen={showDistribution} onToggle={() => setShowDistribution(!showDistribution)} badge={moJoelleSource ? "مُعبأ من جويل" : undefined} />
      {showDistribution && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-4">
            {moJoelleSource && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                <img src={JOEL_AVATAR} className="w-5 h-5 rounded-full" alt="" />
                <span>تم تعبئة هذه الحقول تلقائياً من محرك جويل — يمكنك التعديل يدوياً</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {distRows.filter(d => d.gfa > 0).map(dist => (
                <div key={dist.title} className="bg-white rounded-lg border border-border/40 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/20 border-b border-border/30 flex items-center justify-between">
                    <h4 className="text-xs font-bold">{dist.title}</h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${Math.abs(dist.totalPct - 100) < 0.1 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{dist.totalPct.toFixed(1)}%</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/10 border-b border-border/20">
                      <th className="px-3 py-1.5 text-right font-medium">النوع</th>
                      <th className="px-2 py-1.5 text-center font-medium">النسبة %</th>
                      <th className="px-2 py-1.5 text-center font-medium">المساحة (sqft)</th>
                    </tr></thead>
                    <tbody>
                      {dist.rows.map(r => (
                        <tr key={r.key} className="border-b border-border/10">
                          <td className="px-3 py-1.5 font-medium">{r.label}</td>
                          <td className="px-2 py-1.5"><EditableNum value={(moFields as any)[r.pctKey]} onChange={(v) => updateMoField(r.pctKey, v)} suffix="%" /></td>
                          <td className="px-2 py-1.5"><EditableNum value={(moFields as any)[r.avgKey]} onChange={(v) => updateMoField(r.avgKey, v)} suffix="sqft" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <Label className="text-xs font-medium">جودة التشطيب:</Label>
              <Select value={moFields.finishingQuality} onValueChange={(v) => updateMoField("finishingQuality", v)}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">قياسي (Standard)</SelectItem>
                  <SelectItem value="premium">ممتاز (Premium)</SelectItem>
                  <SelectItem value="luxury">فاخر (Luxury)</SelectItem>
                  <SelectItem value="ultra_luxury">فائق الفخامة (Ultra Luxury)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {moDirty && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveMo} disabled={moSaveMutation.isPending} className="gap-1.5">
                  {moSaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ توزيع الوحدات
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 2: التسعير وخطة السداد ═══ */}
      <SectionHeader title="التسعير وخطة السداد" icon={DollarSign} isOpen={showPricing} onToggle={() => setShowPricing(!showPricing)} badge={cpJoelleSource ? "مُعبأ من جويل" : undefined} />
      {showPricing && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-4">
            {cpJoelleSource && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                <img src={JOEL_AVATAR} className="w-5 h-5 rounded-full" alt="" />
                <span>تم تعبئة الأسعار تلقائياً من محرك جويل — يمكنك التعديل يدوياً</span>
              </div>
            )}
            {/* Scenario selector */}
            <div className="flex gap-2">
              {(["optimistic", "base", "conservative"] as const).map(sc => {
                const cfg = scenarioConfig[sc];
                const Icon = cfg.icon;
                return (
                  <button key={sc} onClick={() => { setActiveScenario(sc); setCpDirty(true); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${activeScenario === sc ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40"}`}>
                    <Icon className="w-3.5 h-3.5" />{cfg.label}
                  </button>
                );
              })}
            </div>
            {/* Revenue tables */}
            <div className="space-y-3">
              <RevenueTable title="الإيرادات السكنية" rows={resRevRows} totalRev={totalResRev} />
              <RevenueTable title="إيرادات التجزئة" rows={retRevRows} totalRev={totalRetRev} />
              <RevenueTable title="إيرادات المكاتب" rows={offRevRows} totalRev={totalOffRev} />
            </div>
            {/* Revenue summary */}
            <div className="bg-gradient-to-l from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">إجمالي الإيرادات ({scenarioConfig[activeScenario].label})</span>
                <span className="text-lg font-bold font-mono" dir="ltr">AED {fmt(totalRevenue)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي الوحدات: {fmt(totalUnits)}</div>
            </div>
            {/* Payment plan */}
            <div className="bg-white rounded-lg border border-border/40 overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b border-border/30 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold">خطة السداد</h4>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full mr-auto ${Math.abs(paymentTotal - 100) < 0.1 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{paymentTotal}%</span>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "الحجز", pctKey: "bookingPct", timingKey: "bookingTiming" },
                  { label: "أثناء الإنشاء", pctKey: "constructionPct", timingKey: "constructionTiming" },
                  { label: "عند التسليم", pctKey: "handoverPct", timingKey: "handoverTiming" },
                  { label: "مؤجل", pctKey: "deferredPct", timingKey: "deferredTiming" },
                ].map(item => (
                  <div key={item.pctKey} className="space-y-1">
                    <Label className="text-[10px] font-medium">{item.label}</Label>
                    <EditableNum value={(payment as any)[item.pctKey]} onChange={(v) => setPaymentField(item.pctKey, v)} suffix="%" />
                    <EditableText value={(payment as any)[item.timingKey]} onChange={(v) => setPaymentField(item.timingKey, v)} placeholder="التوقيت" />
                  </div>
                ))}
              </div>
            </div>
            {cpDirty && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveCp} disabled={cpSaveMutation.isPending} className="gap-1.5">
                  {cpSaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ التسعير
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 3: التكاليف والأرباح ═══ */}
      <SectionHeader title="التكاليف والأرباح" icon={BarChart3} isOpen={showCosts} onToggle={() => setShowCosts(!showCosts)} />
      {showCosts && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => smartReportMutation.mutate({ projectId })} disabled={smartReportMutation.isPending}>
                {smartReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                تقرير جويل
              </Button>
              <Button size="sm" variant={isApproved ? "default" : "outline"} className="gap-1.5"
                onClick={() => approvalMutation.mutate({ projectId, approved: !isApproved })}>
                <ShieldCheck className="w-4 h-4" />{isApproved ? "معتمد ✓" : "اعتماد"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => { if (studyId) syncMutation.mutate({ projectId: projectId! }); else toast.error("لا توجد دراسة جدوى"); }}
                disabled={syncMutation.isPending}>
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                مزامنة التدفقات
              </Button>
            </div>
          </div>

          <MissingDataWarning items={missing} />

          {smartReport && (
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <img src={JOEL_AVATAR} className="w-7 h-7 rounded-full" alt="" />
                  <span className="font-bold text-amber-800">تقرير جويل – تحليل التكاليف</span>
                </div>
                <div className="prose prose-sm max-w-none text-right" dir="rtl"><Streamdown>{smartReport}</Streamdown></div>
              </CardContent>
            </Card>
          )}

          {/* Cost items flat list */}
          <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
            {allCostItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-1.5 border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <span className="text-[13px] text-foreground/90 whitespace-nowrap">{item.label}</span>
                {item.note && <span className="text-[10px] text-muted-foreground bg-muted/40 px-1 py-0 rounded whitespace-nowrap">{item.note}</span>}
                <span className="flex-1 border-b border-dotted border-border/30 mx-1 min-w-[20px]" />
                <span className="text-[13px] font-mono text-foreground/80 whitespace-nowrap tabular-nums" dir="ltr">{fmt(item.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-slate-800 to-slate-900">
              <span className="w-2 h-2 rounded-full shrink-0 bg-white/80" />
              <span className="text-[13px] font-bold text-white/90 flex-1">إجمالي تكاليف المشروع</span>
              <span className="text-sm font-bold font-mono text-white tabular-nums" dir="ltr">{fmt(costs.totalCosts)} <span className="text-[10px] font-normal opacity-60">AED</span></span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-sky-600 to-sky-700">
              <span className="w-2 h-2 rounded-full shrink-0 bg-white/80" />
              <span className="text-[13px] font-bold text-white/90 flex-1">إجمالي المبيعات</span>
              <span className="text-sm font-bold font-mono text-white tabular-nums" dir="ltr">{fmt(costs.totalRevenue)} <span className="text-[10px] font-normal opacity-60">AED</span></span>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2.5 ${costs.profit >= 0 ? "bg-gradient-to-l from-emerald-600 to-emerald-700" : "bg-gradient-to-l from-red-600 to-red-700"}`}>
              <span className="w-2 h-2 rounded-full shrink-0 bg-white/80" />
              <span className="text-[13px] font-bold text-white/90 flex-1">صافي الربح</span>
              <span className="text-sm font-bold font-mono text-white tabular-nums" dir="ltr">{fmt(costs.profit)} <span className="text-[10px] font-normal opacity-60">AED</span></span>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-b-xl ${costs.profitMargin >= 15 ? "bg-gradient-to-l from-teal-700 to-teal-800" : costs.profitMargin >= 10 ? "bg-gradient-to-l from-amber-600 to-amber-700" : "bg-gradient-to-l from-rose-700 to-rose-800"}`}>
              <span className="w-2 h-2 rounded-full shrink-0 bg-white/80" />
              <span className="text-[13px] font-bold text-white/90 flex-1">نسبة الربح</span>
              <ProfitIndicator margin={costs.profitMargin} />
            </div>
          </div>

          {/* Scenario comparison */}
          <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 bg-gradient-to-l from-muted/30">
              <h3 className="text-sm font-bold">مقارنة السيناريوهات</h3>
            </div>
            <div className="grid grid-cols-4 gap-0 border-b border-border/40 bg-muted/20">
              <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground">البند</div>
              <div className="px-3 py-2 text-[11px] font-bold text-center text-emerald-700 border-x border-border/20"><TrendingUp className="w-3 h-3 inline ml-1" />المتفائل</div>
              <div className={`px-3 py-2 text-[11px] font-bold text-center border-l border-border/20 ${activeScenario === "base" ? "text-blue-700 bg-blue-50/50" : "text-blue-600"}`}>الأساسي</div>
              <div className="px-3 py-2 text-[11px] font-bold text-center text-amber-700"><TrendingDown className="w-3 h-3 inline ml-1" />المتحفظ</div>
            </div>
            {[
              { label: "إجمالي المبيعات", key: "totalRevenue" as const },
              { label: "إجمالي التكاليف", key: "totalCosts" as const },
              { label: "صافي الربح", key: "profit" as const },
              { label: "نسبة الربح", key: "profitMargin" as const },
              { label: "العائد على الاستثمار", key: "roi" as const },
            ].map((row, i) => (
              <div key={row.key} className={`grid grid-cols-4 gap-0 border-b border-border/20 last:border-b-0 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                <div className="px-3 py-2 text-[13px] text-foreground/80 font-medium">{row.label}</div>
                {(["optimistic", "base", "conservative"] as const).map(sc => {
                  const val = scenarioResults[sc][row.key];
                  const isPct = row.key === "profitMargin" || row.key === "roi";
                  const isProfit = row.key === "profit";
                  const isActive = sc === activeScenario;
                  return (
                    <div key={sc} className={`px-3 py-2 text-center text-[13px] font-mono ${isActive ? "bg-blue-50/30" : ""} ${sc !== "conservative" ? "border-x border-border/10" : ""}`}>
                      {isPct ? <span className={val >= 15 ? "text-emerald-600 font-bold" : val >= 10 ? "text-amber-600 font-bold" : "text-red-600 font-bold"}>{val.toFixed(1)}%</span>
                        : <span className={isProfit ? (val >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold") : "text-foreground/80"} dir="ltr">{fmt(val)}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="grid grid-cols-4 gap-0 bg-muted/10 border-t border-border/30">
              <div className="px-3 py-2 text-[13px] text-foreground/80 font-medium">التقييم</div>
              {(["optimistic", "base", "conservative"] as const).map(sc => (
                <div key={sc} className="px-3 py-2 flex justify-center"><ProfitIndicator margin={scenarioResults[sc].profitMargin} /></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
