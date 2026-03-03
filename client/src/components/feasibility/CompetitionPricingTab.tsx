import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, RotateCcw, Save, ShieldCheck, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

function fmtAED(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "AED 0";
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

function EditableNum({ value, onChange, suffix, disabled }: { value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value ? fmt(value) : "");
  return (
    <div className="relative">
      <Input
        type="text"
        value={displayVal}
        onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n)) onChange(n); }}
        onChange={(e) => setLocalVal(e.target.value)}
        className="h-8 text-sm text-center"
        disabled={disabled}
        dir="ltr"
      />
      {suffix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function EditableText({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-sm text-center"
      disabled={disabled}
      dir="rtl"
    />
  );
}

type ScenarioKey = "optimistic" | "base" | "conservative";

interface CompetitionPricingTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CompetitionPricingTab({ projectId, studyId, form: feasForm, computed }: CompetitionPricingTabProps) {
  // Data queries
  const pricingQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId });
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId });

  const saveMutation = trpc.competitionPricing.save.useMutation({
    onSuccess: () => { pricingQuery.refetch(); toast.success("تم حفظ البيانات"); setIsDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const smartReportMutation = trpc.competitionPricing.generateSmartReport.useMutation({
    onSuccess: (data) => {
      pricingQuery.refetch();
      setSmartReport(data.smartReport);
      try {
        const recs = JSON.parse(data.recommendations);
        setRecommendations(recs);
        setRecsApplied(false);
      } catch { /* ignore */ }
      toast.success("تم إنشاء تقرير المنافسة والتسعير");
    },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const approvalMutation = trpc.competitionPricing.toggleApproval.useMutation({
    onSuccess: () => { pricingQuery.refetch(); toast.success("تم تحديث حالة الاعتماد"); },
    onError: () => toast.error("خطأ في تحديث الاعتماد"),
  });

  // Local state
  const [smartReport, setSmartReport] = useState<string>("");
  const [recommendations, setRecommendations] = useState<any>(null);
  const [recsApplied, setRecsApplied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");

  // Pricing fields state - 3 scenarios
  const [scenarios, setScenarios] = useState({
    optimistic: {
      studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0,
      retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0,
      officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0,
    },
    base: {
      studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0,
      retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0,
      officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0,
    },
    conservative: {
      studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0,
      retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0,
      officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0,
    },
  });

  // Payment plan state
  const [payment, setPayment] = useState({
    bookingPct: 10, bookingTiming: "عند التوقيع",
    constructionPct: 60, constructionTiming: "أثناء الإنشاء",
    handoverPct: 30, handoverTiming: "عند التسليم",
    deferredPct: 0, deferredTiming: "",
  });

  // Load data from query
  useEffect(() => {
    if (pricingQuery.data) {
      const d = pricingQuery.data;
      setScenarios({
        optimistic: {
          studioPrice: d.optStudioPrice || 0, oneBrPrice: d.opt1brPrice || 0,
          twoBrPrice: d.opt2brPrice || 0, threeBrPrice: d.opt3brPrice || 0,
          retailSmallPrice: d.optRetailSmallPrice || 0, retailMediumPrice: d.optRetailMediumPrice || 0,
          retailLargePrice: d.optRetailLargePrice || 0,
          officeSmallPrice: d.optOfficeSmallPrice || 0, officeMediumPrice: d.optOfficeMediumPrice || 0,
          officeLargePrice: d.optOfficeLargePrice || 0,
        },
        base: {
          studioPrice: d.baseStudioPrice || 0, oneBrPrice: d.base1brPrice || 0,
          twoBrPrice: d.base2brPrice || 0, threeBrPrice: d.base3brPrice || 0,
          retailSmallPrice: d.baseRetailSmallPrice || 0, retailMediumPrice: d.baseRetailMediumPrice || 0,
          retailLargePrice: d.baseRetailLargePrice || 0,
          officeSmallPrice: d.baseOfficeSmallPrice || 0, officeMediumPrice: d.baseOfficeMediumPrice || 0,
          officeLargePrice: d.baseOfficeLargePrice || 0,
        },
        conservative: {
          studioPrice: d.consStudioPrice || 0, oneBrPrice: d.cons1brPrice || 0,
          twoBrPrice: d.cons2brPrice || 0, threeBrPrice: d.cons3brPrice || 0,
          retailSmallPrice: d.consRetailSmallPrice || 0, retailMediumPrice: d.consRetailMediumPrice || 0,
          retailLargePrice: d.consRetailLargePrice || 0,
          officeSmallPrice: d.consOfficeSmallPrice || 0, officeMediumPrice: d.consOfficeMediumPrice || 0,
          officeLargePrice: d.consOfficeLargePrice || 0,
        },
      });
      setPayment({
        bookingPct: parseFloat(d.paymentBookingPct || "10"),
        bookingTiming: d.paymentBookingTiming || "عند التوقيع",
        constructionPct: parseFloat(d.paymentConstructionPct || "60"),
        constructionTiming: d.paymentConstructionTiming || "أثناء الإنشاء",
        handoverPct: parseFloat(d.paymentHandoverPct || "30"),
        handoverTiming: d.paymentHandoverTiming || "عند التسليم",
        deferredPct: parseFloat(d.paymentDeferredPct || "0"),
        deferredTiming: d.paymentDeferredTiming || "",
      });
      if (d.activeScenario) setActiveScenario(d.activeScenario as ScenarioKey);
      if (d.aiSmartReport) setSmartReport(d.aiSmartReport);
      if (d.aiRecommendationsJson) {
        try { setRecommendations(JSON.parse(d.aiRecommendationsJson)); setRecsApplied(true); } catch { /* ignore */ }
      }
      setIsDirty(false);
    }
  }, [pricingQuery.data]);

  const setScenarioField = useCallback((scenario: ScenarioKey, key: string, value: number) => {
    setScenarios(prev => ({ ...prev, [scenario]: { ...prev[scenario], [key]: value } }));
    setIsDirty(true);
  }, []);

  const setPaymentField = useCallback((key: string, value: any) => {
    setPayment(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Data from Tab 1 (Market Overview)
  const mo = moQuery.data;
  const resData = useMemo(() => {
    if (!mo) return [];
    return [
      { key: "studio", label: "استديو", pct: parseFloat(mo.residentialStudioPct || "0"), avg: mo.residentialStudioAvgArea || 0, priceKey: "studioPrice" },
      { key: "1br", label: "غرفة وصالة", pct: parseFloat(mo.residential1brPct || "0"), avg: mo.residential1brAvgArea || 0, priceKey: "oneBrPrice" },
      { key: "2br", label: "غرفتان وصالة", pct: parseFloat(mo.residential2brPct || "0"), avg: mo.residential2brAvgArea || 0, priceKey: "twoBrPrice" },
      { key: "3br", label: "ثلاث غرف وصالة", pct: parseFloat(mo.residential3brPct || "0"), avg: mo.residential3brAvgArea || 0, priceKey: "threeBrPrice" },
    ].filter(r => r.pct > 0);
  }, [mo]);

  const retData = useMemo(() => {
    if (!mo) return [];
    return [
      { key: "small", label: "صغيرة", pct: parseFloat(mo.retailSmallPct || "0"), avg: mo.retailSmallAvgArea || 0, priceKey: "retailSmallPrice" },
      { key: "medium", label: "متوسطة", pct: parseFloat(mo.retailMediumPct || "0"), avg: mo.retailMediumAvgArea || 0, priceKey: "retailMediumPrice" },
      { key: "large", label: "كبيرة", pct: parseFloat(mo.retailLargePct || "0"), avg: mo.retailLargeAvgArea || 0, priceKey: "retailLargePrice" },
    ].filter(r => r.pct > 0);
  }, [mo]);

  const offData = useMemo(() => {
    if (!mo) return [];
    return [
      { key: "small", label: "صغيرة", pct: parseFloat(mo.officeSmallPct || "0"), avg: mo.officeSmallAvgArea || 0, priceKey: "officeSmallPrice" },
      { key: "medium", label: "متوسطة", pct: parseFloat(mo.officeMediumPct || "0"), avg: mo.officeMediumAvgArea || 0, priceKey: "officeMediumPrice" },
      { key: "large", label: "كبيرة", pct: parseFloat(mo.officeLargePct || "0"), avg: mo.officeLargeAvgArea || 0, priceKey: "officeLargePrice" },
    ].filter(r => r.pct > 0);
  }, [mo]);

  const saleableRes = computed.saleableRes || 0;
  const saleableRet = computed.saleableRet || 0;
  const saleableOff = computed.saleableOff || 0;

  // Current scenario prices
  const currentPrices = scenarios[activeScenario];

  // Revenue calculations
  const calcRevenue = (rows: typeof resData, saleable: number, priceGetter: (key: string) => number) => {
    return rows.map(r => {
      const allocated = saleable * (r.pct / 100);
      const units = r.avg > 0 ? Math.floor(allocated / r.avg) : 0;
      const pricePerSqft = priceGetter(r.priceKey);
      const unitPrice = r.avg * pricePerSqft;
      const revenue = unitPrice * units;
      return { ...r, allocated, units, pricePerSqft, unitPrice, revenue };
    });
  };

  const resRevenue = useMemo(() => calcRevenue(resData, saleableRes, (k) => (currentPrices as any)[k] || 0), [resData, saleableRes, currentPrices]);
  const retRevenue = useMemo(() => calcRevenue(retData, saleableRet, (k) => (currentPrices as any)[k] || 0), [retData, saleableRet, currentPrices]);
  const offRevenue = useMemo(() => calcRevenue(offData, saleableOff, (k) => (currentPrices as any)[k] || 0), [offData, saleableOff, currentPrices]);

  const totalResRevenue = resRevenue.reduce((s, r) => s + r.revenue, 0);
  const totalRetRevenue = retRevenue.reduce((s, r) => s + r.revenue, 0);
  const totalOffRevenue = offRevenue.reduce((s, r) => s + r.revenue, 0);
  const totalRevenue = totalResRevenue + totalRetRevenue + totalOffRevenue;
  const totalUnits = resRevenue.reduce((s, r) => s + r.units, 0) + retRevenue.reduce((s, r) => s + r.units, 0) + offRevenue.reduce((s, r) => s + r.units, 0);

  // Average price per sqft
  const totalSaleable = saleableRes + saleableRet + saleableOff;
  const avgPricePerSqft = totalSaleable > 0 ? totalRevenue / totalSaleable : 0;

  const paymentTotal = payment.bookingPct + payment.constructionPct + payment.handoverPct + payment.deferredPct;

  // Apply recommendations
  const handleApplyRecs = () => {
    if (!recommendations) return;
    const recs = recommendations;
    try {
      setScenarios({
        optimistic: {
          studioPrice: recs.scenarios?.optimistic?.residential?.studio || 0,
          oneBrPrice: recs.scenarios?.optimistic?.residential?.oneBr || 0,
          twoBrPrice: recs.scenarios?.optimistic?.residential?.twoBr || 0,
          threeBrPrice: recs.scenarios?.optimistic?.residential?.threeBr || 0,
          retailSmallPrice: recs.scenarios?.optimistic?.retail?.small || 0,
          retailMediumPrice: recs.scenarios?.optimistic?.retail?.medium || 0,
          retailLargePrice: recs.scenarios?.optimistic?.retail?.large || 0,
          officeSmallPrice: recs.scenarios?.optimistic?.offices?.small || 0,
          officeMediumPrice: recs.scenarios?.optimistic?.offices?.medium || 0,
          officeLargePrice: recs.scenarios?.optimistic?.offices?.large || 0,
        },
        base: {
          studioPrice: recs.scenarios?.base?.residential?.studio || 0,
          oneBrPrice: recs.scenarios?.base?.residential?.oneBr || 0,
          twoBrPrice: recs.scenarios?.base?.residential?.twoBr || 0,
          threeBrPrice: recs.scenarios?.base?.residential?.threeBr || 0,
          retailSmallPrice: recs.scenarios?.base?.retail?.small || 0,
          retailMediumPrice: recs.scenarios?.base?.retail?.medium || 0,
          retailLargePrice: recs.scenarios?.base?.retail?.large || 0,
          officeSmallPrice: recs.scenarios?.base?.offices?.small || 0,
          officeMediumPrice: recs.scenarios?.base?.offices?.medium || 0,
          officeLargePrice: recs.scenarios?.base?.offices?.large || 0,
        },
        conservative: {
          studioPrice: recs.scenarios?.conservative?.residential?.studio || 0,
          oneBrPrice: recs.scenarios?.conservative?.residential?.oneBr || 0,
          twoBrPrice: recs.scenarios?.conservative?.residential?.twoBr || 0,
          threeBrPrice: recs.scenarios?.conservative?.residential?.threeBr || 0,
          retailSmallPrice: recs.scenarios?.conservative?.retail?.small || 0,
          retailMediumPrice: recs.scenarios?.conservative?.retail?.medium || 0,
          retailLargePrice: recs.scenarios?.conservative?.retail?.large || 0,
          officeSmallPrice: recs.scenarios?.conservative?.offices?.small || 0,
          officeMediumPrice: recs.scenarios?.conservative?.offices?.medium || 0,
          officeLargePrice: recs.scenarios?.conservative?.offices?.large || 0,
        },
      });
      if (recs.paymentPlan) {
        setPayment({
          bookingPct: recs.paymentPlan.booking?.pct || 10,
          bookingTiming: recs.paymentPlan.booking?.timing || "عند التوقيع",
          constructionPct: recs.paymentPlan.construction?.pct || 60,
          constructionTiming: recs.paymentPlan.construction?.timing || "أثناء الإنشاء",
          handoverPct: recs.paymentPlan.handover?.pct || 30,
          handoverTiming: recs.paymentPlan.handover?.timing || "عند التسليم",
          deferredPct: recs.paymentPlan.deferred?.pct || 0,
          deferredTiming: recs.paymentPlan.deferred?.timing || "",
        });
      }
      setRecsApplied(true);
      setIsDirty(true);
      toast.success("تم تطبيق التوصيات على الحقول");
    } catch { toast.error("خطأ في تطبيق التوصيات"); }
  };

  const handleSave = () => {
    if (!projectId) return;
    saveMutation.mutate({
      projectId,
      optStudioPrice: scenarios.optimistic.studioPrice,
      opt1brPrice: scenarios.optimistic.oneBrPrice,
      opt2brPrice: scenarios.optimistic.twoBrPrice,
      opt3brPrice: scenarios.optimistic.threeBrPrice,
      optRetailSmallPrice: scenarios.optimistic.retailSmallPrice,
      optRetailMediumPrice: scenarios.optimistic.retailMediumPrice,
      optRetailLargePrice: scenarios.optimistic.retailLargePrice,
      optOfficeSmallPrice: scenarios.optimistic.officeSmallPrice,
      optOfficeMediumPrice: scenarios.optimistic.officeMediumPrice,
      optOfficeLargePrice: scenarios.optimistic.officeLargePrice,
      baseStudioPrice: scenarios.base.studioPrice,
      base1brPrice: scenarios.base.oneBrPrice,
      base2brPrice: scenarios.base.twoBrPrice,
      base3brPrice: scenarios.base.threeBrPrice,
      baseRetailSmallPrice: scenarios.base.retailSmallPrice,
      baseRetailMediumPrice: scenarios.base.retailMediumPrice,
      baseRetailLargePrice: scenarios.base.retailLargePrice,
      baseOfficeSmallPrice: scenarios.base.officeSmallPrice,
      baseOfficeMediumPrice: scenarios.base.officeMediumPrice,
      baseOfficeLargePrice: scenarios.base.officeLargePrice,
      consStudioPrice: scenarios.conservative.studioPrice,
      cons1brPrice: scenarios.conservative.oneBrPrice,
      cons2brPrice: scenarios.conservative.twoBrPrice,
      cons3brPrice: scenarios.conservative.threeBrPrice,
      consRetailSmallPrice: scenarios.conservative.retailSmallPrice,
      consRetailMediumPrice: scenarios.conservative.retailMediumPrice,
      consRetailLargePrice: scenarios.conservative.retailLargePrice,
      consOfficeSmallPrice: scenarios.conservative.officeSmallPrice,
      consOfficeMediumPrice: scenarios.conservative.officeMediumPrice,
      consOfficeLargePrice: scenarios.conservative.officeLargePrice,
      paymentBookingPct: payment.bookingPct,
      paymentBookingTiming: payment.bookingTiming,
      paymentConstructionPct: payment.constructionPct,
      paymentConstructionTiming: payment.constructionTiming,
      paymentHandoverPct: payment.handoverPct,
      paymentHandoverTiming: payment.handoverTiming,
      paymentDeferredPct: payment.deferredPct,
      paymentDeferredTiming: payment.deferredTiming,
      activeScenario,
    });
  };

  if (!projectId) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">يرجى اختيار مشروع أولاً</p>
      </div>
    );
  }

  const isApproved = pricingQuery.data?.isApproved === 1;

  const scenarioConfig: Record<ScenarioKey, { label: string; color: string; bgColor: string; borderColor: string; icon: any }> = {
    optimistic: { label: "السيناريو المتفائل", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", icon: TrendingUp },
    base: { label: "السيناريو الأساسي", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-300", icon: Target },
    conservative: { label: "السيناريو المتحفظ", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-300", icon: TrendingDown },
  };

  // Revenue table component
  const RevenueTable = ({ title, emoji, rows, totalRevenue: tRev }: { title: string; emoji: string; rows: typeof resRevenue; totalRevenue: number }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">{emoji} {title}</h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{fmtAED(tRev)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-2 font-bold text-muted-foreground">نوع الوحدة</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">متوسط المساحة</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">سعر القدم²</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">سعر الوحدة</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">عدد</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium">{r.label}</td>
                  <td className="py-1.5 px-2 text-center font-mono">{fmt(r.avg)}</td>
                  <td className="py-1.5 px-2">
                    <EditableNum value={r.pricePerSqft} onChange={(v) => setScenarioField(activeScenario, r.priceKey, v)} />
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono">{fmtAED(r.unitPrice)}</td>
                  <td className="py-1.5 px-2 text-center font-bold text-primary">{r.units}</td>
                  <td className="py-1.5 px-2 text-center font-mono">{fmtAED(r.revenue)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/30 font-bold">
                <td className="py-2 px-2" colSpan={2}>إجمالي {title}</td>
                <td className="py-2 px-2 text-center">—</td>
                <td className="py-2 px-2 text-center">—</td>
                <td className="py-2 px-2 text-center text-primary">{rows.reduce((s, r) => s + r.units, 0)}</td>
                <td className="py-2 px-2 text-center text-emerald-600">{fmtAED(tRev)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* ═══════════════════════════════════════════ */}
      {/* القسم الأول: جويل + التقرير الذكي */}
      {/* ═══════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-l from-cyan-50 to-blue-50 border-b border-cyan-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={JOEL_AVATAR} alt="جويل" className="w-12 h-12 rounded-full border-2 border-cyan-200 shadow-sm" />
              <div>
                <h3 className="font-bold text-sm text-cyan-900">جويل — تحليل المنافسة والتسعير</h3>
                <p className="text-xs text-cyan-600">تحليل ذكي لأسعار البيع وخطة السداد</p>
              </div>
            </div>
            <Button
              onClick={() => { if (projectId) smartReportMutation.mutate(projectId); }}
              disabled={smartReportMutation.isPending}
              className="gap-2 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-md"
            >
              {smartReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {smartReportMutation.isPending ? "جويل تحلل..." : "طلب تقرير ذكي"}
            </Button>
          </div>

          <div className="p-4">
            {smartReport ? (
              <div className="prose prose-sm max-w-none bg-muted/20 rounded-xl p-5 border border-border" dir="rtl">
                <Streamdown>{smartReport}</Streamdown>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed border-border">
                <img src={JOEL_AVATAR} alt="جويل" className="w-16 h-16 rounded-full mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-muted-foreground">لم يُنشأ تقرير المنافسة والتسعير بعد</p>
                <p className="text-xs text-muted-foreground/70 mt-1">اضغط "طلب تقرير ذكي" لتحليل الأسعار والمنافسة</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الثاني: مستطيل التوصيات */}
      {/* ═══════════════════════════════════════════ */}
      {recommendations && (
        <Card className="border-2 border-sky-200 bg-gradient-to-l from-sky-50/80 to-blue-50/80 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h3 className="font-bold text-sm text-sky-800">توصيات جويل — أسعار البيع وخطة السداد</h3>
                {recsApplied && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                {recsApplied && <span className="text-xs text-sky-600">تم التطبيق على السيناريوهات</span>}
              </div>
              <div className="flex gap-2">
                {!recsApplied && (
                  <Button size="sm" variant="outline" onClick={handleApplyRecs} className="gap-1.5 text-xs border-sky-300 text-sky-700 hover:bg-sky-100">
                    <CheckCircle2 className="w-3 h-3" />
                    تطبيق التوصيات
                  </Button>
                )}
                {recsApplied && (
                  <Button size="sm" variant="ghost" onClick={handleApplyRecs} className="gap-1.5 text-xs text-sky-600 hover:bg-sky-100">
                    <RotateCcw className="w-3 h-3" />
                    إعادة تطبيق
                  </Button>
                )}
              </div>
            </div>

            {/* Scenarios Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* السيناريو المتفائل */}
              <div className="bg-white/80 rounded-lg p-3 border border-sky-100">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">السيناريو المتفائل</h4>
                <div className="space-y-1 text-xs">
                  {recommendations.scenarios?.optimistic?.residential && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mb-1">سكني (AED/قدم²)</div>
                      {recommendations.scenarios.optimistic.residential.studio > 0 && <div className="flex justify-between"><span>استديو</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.residential.studio)}</span></div>}
                      {recommendations.scenarios.optimistic.residential.oneBr > 0 && <div className="flex justify-between"><span>غرفة وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.residential.oneBr)}</span></div>}
                      {recommendations.scenarios.optimistic.residential.twoBr > 0 && <div className="flex justify-between"><span>غرفتان وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.residential.twoBr)}</span></div>}
                      {recommendations.scenarios.optimistic.residential.threeBr > 0 && <div className="flex justify-between"><span>ثلاث غرف وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.residential.threeBr)}</span></div>}
                    </>
                  )}
                  {recommendations.scenarios?.optimistic?.retail && Object.values(recommendations.scenarios.optimistic.retail).some((v: any) => v > 0) && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mt-2 mb-1">تجاري (AED/قدم²)</div>
                      {recommendations.scenarios.optimistic.retail.small > 0 && <div className="flex justify-between"><span>صغيرة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.retail.small)}</span></div>}
                      {recommendations.scenarios.optimistic.retail.medium > 0 && <div className="flex justify-between"><span>متوسطة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.retail.medium)}</span></div>}
                      {recommendations.scenarios.optimistic.retail.large > 0 && <div className="flex justify-between"><span>كبيرة</span><span className="font-bold">{fmt(recommendations.scenarios.optimistic.retail.large)}</span></div>}
                    </>
                  )}
                </div>
              </div>

              {/* السيناريو الأساسي */}
              <div className="bg-white/80 rounded-lg p-3 border border-sky-100">
                <h4 className="text-xs font-bold text-blue-700 mb-2 text-center">السيناريو الأساسي</h4>
                <div className="space-y-1 text-xs">
                  {recommendations.scenarios?.base?.residential && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mb-1">سكني (AED/قدم²)</div>
                      {recommendations.scenarios.base.residential.studio > 0 && <div className="flex justify-between"><span>استديو</span><span className="font-bold">{fmt(recommendations.scenarios.base.residential.studio)}</span></div>}
                      {recommendations.scenarios.base.residential.oneBr > 0 && <div className="flex justify-between"><span>غرفة وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.base.residential.oneBr)}</span></div>}
                      {recommendations.scenarios.base.residential.twoBr > 0 && <div className="flex justify-between"><span>غرفتان وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.base.residential.twoBr)}</span></div>}
                      {recommendations.scenarios.base.residential.threeBr > 0 && <div className="flex justify-between"><span>ثلاث غرف وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.base.residential.threeBr)}</span></div>}
                    </>
                  )}
                  {recommendations.scenarios?.base?.retail && Object.values(recommendations.scenarios.base.retail).some((v: any) => v > 0) && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mt-2 mb-1">تجاري (AED/قدم²)</div>
                      {recommendations.scenarios.base.retail.small > 0 && <div className="flex justify-between"><span>صغيرة</span><span className="font-bold">{fmt(recommendations.scenarios.base.retail.small)}</span></div>}
                      {recommendations.scenarios.base.retail.medium > 0 && <div className="flex justify-between"><span>متوسطة</span><span className="font-bold">{fmt(recommendations.scenarios.base.retail.medium)}</span></div>}
                      {recommendations.scenarios.base.retail.large > 0 && <div className="flex justify-between"><span>كبيرة</span><span className="font-bold">{fmt(recommendations.scenarios.base.retail.large)}</span></div>}
                    </>
                  )}
                </div>
              </div>

              {/* السيناريو المتحفظ */}
              <div className="bg-white/80 rounded-lg p-3 border border-sky-100">
                <h4 className="text-xs font-bold text-amber-700 mb-2 text-center">السيناريو المتحفظ</h4>
                <div className="space-y-1 text-xs">
                  {recommendations.scenarios?.conservative?.residential && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mb-1">سكني (AED/قدم²)</div>
                      {recommendations.scenarios.conservative.residential.studio > 0 && <div className="flex justify-between"><span>استديو</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.residential.studio)}</span></div>}
                      {recommendations.scenarios.conservative.residential.oneBr > 0 && <div className="flex justify-between"><span>غرفة وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.residential.oneBr)}</span></div>}
                      {recommendations.scenarios.conservative.residential.twoBr > 0 && <div className="flex justify-between"><span>غرفتان وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.residential.twoBr)}</span></div>}
                      {recommendations.scenarios.conservative.residential.threeBr > 0 && <div className="flex justify-between"><span>ثلاث غرف وصالة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.residential.threeBr)}</span></div>}
                    </>
                  )}
                  {recommendations.scenarios?.conservative?.retail && Object.values(recommendations.scenarios.conservative.retail).some((v: any) => v > 0) && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground mt-2 mb-1">تجاري (AED/قدم²)</div>
                      {recommendations.scenarios.conservative.retail.small > 0 && <div className="flex justify-between"><span>صغيرة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.retail.small)}</span></div>}
                      {recommendations.scenarios.conservative.retail.medium > 0 && <div className="flex justify-between"><span>متوسطة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.retail.medium)}</span></div>}
                      {recommendations.scenarios.conservative.retail.large > 0 && <div className="flex justify-between"><span>كبيرة</span><span className="font-bold">{fmt(recommendations.scenarios.conservative.retail.large)}</span></div>}
                    </>
                  )}
                </div>
              </div>

              {/* خطة السداد */}
              <div className="bg-white/80 rounded-lg p-3 border border-sky-100">
                <h4 className="text-xs font-bold text-sky-700 mb-2 text-center">خطة السداد المقترحة</h4>
                <div className="space-y-1.5 text-xs">
                  {recommendations.paymentPlan?.booking?.pct > 0 && (
                    <div className="flex justify-between"><span>الحجز</span><span className="font-bold text-sky-700">{recommendations.paymentPlan.booking.pct}%</span></div>
                  )}
                  {recommendations.paymentPlan?.construction?.pct > 0 && (
                    <div className="flex justify-between"><span>أثناء البناء</span><span className="font-bold text-sky-700">{recommendations.paymentPlan.construction.pct}%</span></div>
                  )}
                  {recommendations.paymentPlan?.handover?.pct > 0 && (
                    <div className="flex justify-between"><span>عند التسليم</span><span className="font-bold text-sky-700">{recommendations.paymentPlan.handover.pct}%</span></div>
                  )}
                  {recommendations.paymentPlan?.deferred?.pct > 0 && (
                    <div className="flex justify-between"><span>مؤجلة</span><span className="font-bold text-sky-700">{recommendations.paymentPlan.deferred.pct}%</span></div>
                  )}
                  <div className="flex justify-between border-t border-sky-100 pt-1 font-bold text-sky-800">
                    <span>الإجمالي</span><span className="text-sky-600">100%</span>
                  </div>
                </div>
              </div>
            </div>

            {recommendations.summary && (
              <div className="mt-3 p-2.5 bg-white/60 rounded-lg border border-sky-100 text-xs text-sky-700">
                {recommendations.summary}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الثالث: اختيار السيناريو */}
      {/* ═══════════════════════════════════════════ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3">📊 اختيار السيناريو</h3>
          <div className="grid grid-cols-3 gap-3">
            {(["optimistic", "base", "conservative"] as ScenarioKey[]).map(key => {
              const cfg = scenarioConfig[key];
              const Icon = cfg.icon;
              const isActive = activeScenario === key;
              return (
                <button
                  key={key}
                  onClick={() => { setActiveScenario(key); setIsDirty(true); }}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${isActive ? `${cfg.borderColor} ${cfg.bgColor} shadow-md` : "border-border hover:border-muted-foreground/30"}`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? cfg.color : "text-muted-foreground"}`} />
                  <div className={`text-xs font-bold ${isActive ? cfg.color : "text-muted-foreground"}`}>{cfg.label}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* القسم 3.5: حقول أسعار السيناريو المختار */}
      {/* ═══════════════════════════════════════════ */}
      <Card className={`border-2 ${scenarioConfig[activeScenario].borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-bold text-sm flex items-center gap-2 ${scenarioConfig[activeScenario].color}`}>
              💰 أسعار القدم² — {scenarioConfig[activeScenario].label}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* أسعار السكني */}
            <div className="bg-muted/20 rounded-lg p-3 border border-border">
              <h4 className="text-xs font-bold text-muted-foreground mb-2 text-center">سكني (AED/قدم²)</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">استديو</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.studioPrice} onChange={(v) => setScenarioField(activeScenario, 'studioPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">غرفة وصالة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.oneBrPrice} onChange={(v) => setScenarioField(activeScenario, 'oneBrPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">غرفتان وصالة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.twoBrPrice} onChange={(v) => setScenarioField(activeScenario, 'twoBrPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">ثلاث غرف وصالة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.threeBrPrice} onChange={(v) => setScenarioField(activeScenario, 'threeBrPrice', v)} />
                  </div>
                </div>
              </div>
            </div>

            {/* أسعار المحلات */}
            <div className="bg-muted/20 rounded-lg p-3 border border-border">
              <h4 className="text-xs font-bold text-muted-foreground mb-2 text-center">تجاري (AED/قدم²)</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">صغيرة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.retailSmallPrice} onChange={(v) => setScenarioField(activeScenario, 'retailSmallPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">متوسطة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.retailMediumPrice} onChange={(v) => setScenarioField(activeScenario, 'retailMediumPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">كبيرة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.retailLargePrice} onChange={(v) => setScenarioField(activeScenario, 'retailLargePrice', v)} />
                  </div>
                </div>
              </div>
            </div>

            {/* أسعار المكاتب */}
            <div className="bg-muted/20 rounded-lg p-3 border border-border">
              <h4 className="text-xs font-bold text-muted-foreground mb-2 text-center">مكاتب (AED/قدم²)</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">صغيرة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.officeSmallPrice} onChange={(v) => setScenarioField(activeScenario, 'officeSmallPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">متوسطة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.officeMediumPrice} onChange={(v) => setScenarioField(activeScenario, 'officeMediumPrice', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium min-w-[80px]">كبيرة</span>
                  <div className="w-28">
                    <EditableNum value={currentPrices.officeLargePrice} onChange={(v) => setScenarioField(activeScenario, 'officeLargePrice', v)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الرابع: جداول الإيرادات */}
      {/* ═══════════════════════════════════════════ */}
      {resData.length > 0 && (
        <RevenueTable title="الإيراد السكني" emoji="🏠" rows={resRevenue} totalRevenue={totalResRevenue} />
      )}

      {retData.length > 0 && (
        <RevenueTable title="إيراد المحلات" emoji="🏪" rows={retRevenue} totalRevenue={totalRetRevenue} />
      )}

      {offData.length > 0 && (
        <RevenueTable title="إيراد المكاتب" emoji="🏢" rows={offRevenue} totalRevenue={totalOffRevenue} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الخامس: خطة السداد */}
      {/* ═══════════════════════════════════════════ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">💳 خطة السداد</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">المرحلة</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">النسبة %</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">التوقيت</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium">دفعة حجز</td>
                  <td className="py-1.5 px-2 w-28">
                    <div className="flex items-center gap-1 justify-center">
                      <EditableNum value={payment.bookingPct} onChange={(v) => setPaymentField("bookingPct", v)} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 w-48">
                    <EditableText value={payment.bookingTiming} onChange={(v) => setPaymentField("bookingTiming", v)} placeholder="مثال عند التوقيع" />
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium">دفعات أثناء الإنشاء</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1 justify-center">
                      <EditableNum value={payment.constructionPct} onChange={(v) => setPaymentField("constructionPct", v)} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <EditableText value={payment.constructionTiming} onChange={(v) => setPaymentField("constructionTiming", v)} placeholder="مثال عند التوقيع" />
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium">دفعة عند التسليم</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1 justify-center">
                      <EditableNum value={payment.handoverPct} onChange={(v) => setPaymentField("handoverPct", v)} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <EditableText value={payment.handoverTiming} onChange={(v) => setPaymentField("handoverTiming", v)} placeholder="مثال عند التوقيع" />
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium">دفعة مؤجلة (إن وجدت)</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1 justify-center">
                      <EditableNum value={payment.deferredPct} onChange={(v) => setPaymentField("deferredPct", v)} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <EditableText value={payment.deferredTiming} onChange={(v) => setPaymentField("deferredTiming", v)} placeholder="مثال عند التوقيع" />
                  </td>
                </tr>
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2 px-2">الإجمالي</td>
                  <td className={`py-2 px-2 text-center ${paymentTotal === 100 ? "text-emerald-600" : "text-red-600"}`}>{paymentTotal}%</td>
                  <td className="py-2 px-2 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* القسم السادس: ملخص الإيرادات */}
      {/* ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-600 mb-1">إجمالي عدد الوحدات</p>
            <p className="text-2xl font-bold text-blue-800">{totalUnits}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-600 mb-1">متوسط سعر القدم²</p>
            <p className="text-2xl font-bold text-amber-800">{fmtAED(avgPricePerSqft)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 mb-1">إجمالي الإيرادات المتوقعة</p>
            <p className="text-2xl font-bold text-emerald-800">{fmtAED(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* أزرار الحفظ والاعتماد */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !isDirty}
          className="gap-2"
          variant={isDirty ? "default" : "outline"}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isDirty ? "حفظ التغييرات" : "محفوظ"}
        </Button>

        <Button
          onClick={() => { if (projectId) approvalMutation.mutate({ projectId, approved: !isApproved }); }}
          disabled={approvalMutation.isPending}
          variant={isApproved ? "outline" : "default"}
          className={`gap-2 ${isApproved ? "border-emerald-300 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
        >
          {approvalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {isApproved ? "✓ تم اعتماد المرحلة" : "اعتماد المرحلة"}
        </Button>
      </div>
    </div>
  );
}
