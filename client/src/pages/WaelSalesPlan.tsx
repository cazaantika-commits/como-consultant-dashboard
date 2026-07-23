import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Target,
  Megaphone,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  BarChart3,
  Paintbrush,
  HardHat,
  Info,
  RefreshCw,
  Zap,
  Save,
  CreditCard,
  Table2,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

// Dubai seasonality factors (1.0 = average, >1 = strong, <1 = weak)
const DUBAI_SEASONALITY: Record<number, { factor: number; label: string; icon: string }> = {
  1: { factor: 0.85, label: "معتدل", icon: "❄️" },
  2: { factor: 0.90, label: "معتدل", icon: "🌤️" },
  3: { factor: 0.95, label: "جيد", icon: "🌸" },
  4: { factor: 0.80, label: "معتدل", icon: "🌷" },
  5: { factor: 0.60, label: "بطيء", icon: "☀️" },
  6: { factor: 0.40, label: "ضعيف جداً", icon: "🔥" },
  7: { factor: 0.30, label: "الأضعف", icon: "🔥" },
  8: { factor: 0.35, label: "ضعيف جداً", icon: "🔥" },
  9: { factor: 0.70, label: "تعافي", icon: "🍂" },
  10: { factor: 1.20, label: "قوي", icon: "🚀" },
  11: { factor: 1.30, label: "الأقوى", icon: "🚀" },
  12: { factor: 1.00, label: "جيد", icon: "🎄" },
};

const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Marketing channels
const DEFAULT_CHANNELS = [
  { id: "digital", name: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والعلامة", defaultPct: 5, color: "#06b6d4" },
];

// Default payment plan milestones (from Excel model)
const DEFAULT_PAYMENT_PLAN = [
  { id: 1, name: "دفعة الحجز", pct: 10, trigger: "signing", lag: 0, description: "عند التوقيع" },
  { id: 2, name: "دفعة SPA", pct: 10, trigger: "spa", lag: 1, description: "شهر بعد التوقيع" },
  { id: 3, name: "أقساط البناء", pct: 50, trigger: "construction", lag: 0, description: "موزعة على فترة البناء" },
  { id: 4, name: "دفعة التسليم", pct: 30, trigger: "handover", lag: 0, description: "عند التسليم" },
];

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
}

function formatAED(n: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(n) + " AED";
}

export default function WaelSalesPlan() {
  const { toast } = useToast();

  // ═══════════════════════════════════════════
  // PROJECT SELECTION
  // ═══════════════════════════════════════════
  const { data: projects } = trpc.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // ═══════════════════════════════════════════
  // PROJECT INPUTS (what Wael enters)
  // ═══════════════════════════════════════════
  const [totalRevenue, setTotalRevenue] = useState(765_000_000);
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(2026);
  const [marketingBudgetPct, setMarketingBudgetPct] = useState(2.0);
  const [salesCommissionPct, setSalesCommissionPct] = useState(5.0);
  const [offplanPct, setOffplanPct] = useState(80);

  // Payment Plan
  const [paymentPlan, setPaymentPlan] = useState(DEFAULT_PAYMENT_PLAN);

  // Monthly sales absorption percentages
  const salesPeriodLength = useMemo(() => constructionMonths + 1, [constructionMonths]);

  const [salesAbsorption, setSalesAbsorption] = useState<number[]>(() => {
    const len = 31;
    const base = 80 / len;
    return Array.from({ length: len }, () => parseFloat(base.toFixed(2)));
  });

  // Marketing monthly distribution
  const marketingPeriodLength = useMemo(() => constructionMonths + 3, [constructionMonths]);

  const [marketingDist, setMarketingDist] = useState<number[]>(() => {
    const len = 33;
    const base = 100 / len;
    return Array.from({ length: len }, () => parseFloat(base.toFixed(2)));
  });

  // Marketing channels
  const [channels, setChannels] = useState(DEFAULT_CHANNELS.map(c => ({ ...c, pct: c.defaultPct })));

  // ═══════════════════════════════════════════
  // DB SAVE/LOAD
  // ═══════════════════════════════════════════
  const saveMutation = trpc.waelSalesPlan.save.useMutation();
  const { data: existingPlans } = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Load existing plan when project changes
  useEffect(() => {
    if (existingPlans && existingPlans.length > 0) {
      const plan = existingPlans[0];
      setPlanId(plan.id);
      if (plan.totalRevenue) setTotalRevenue(plan.totalRevenue);
      if (plan.designMonths) setDesignMonths(plan.designMonths);
      if (plan.constructionMonths) setConstructionMonths(plan.constructionMonths);
      if (plan.offplanPct) setOffplanPct(plan.offplanPct);
      if (plan.marketingBudgetPct) setMarketingBudgetPct(parseFloat(plan.marketingBudgetPct));
      if (plan.salesCommissionPct) setSalesCommissionPct(parseFloat(plan.salesCommissionPct));
      if (plan.salesAbsorptionJson) {
        try { setSalesAbsorption(JSON.parse(plan.salesAbsorptionJson)); } catch {}
      }
      if (plan.marketingDistJson) {
        try { setMarketingDist(JSON.parse(plan.marketingDistJson)); } catch {}
      }
      if (plan.channelsJson) {
        try { setChannels(JSON.parse(plan.channelsJson)); } catch {}
      }
      if (plan.paymentPlanJson) {
        try { setPaymentPlan(JSON.parse(plan.paymentPlanJson)); } catch {}
      }
    } else {
      setPlanId(undefined);
    }
  }, [existingPlans]);

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast({ title: "اختر مشروعاً أولاً", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveMutation.mutateAsync({
        id: planId,
        projectId: selectedProjectId,
        totalRevenue,
        designMonths,
        constructionMonths,
        offplanPct,
        marketingBudgetPct: marketingBudgetPct.toString(),
        salesCommissionPct: salesCommissionPct.toString(),
        salesAbsorptionJson: JSON.stringify(salesAbsorption),
        marketingDistJson: JSON.stringify(marketingDist),
        channelsJson: JSON.stringify(channels),
        paymentPlanJson: JSON.stringify(paymentPlan),
        resultsJson: JSON.stringify({ cashInflowData }),
      });
      if (!planId) setPlanId(result.id);
      toast({ title: "تم الحفظ بنجاح ✓" });
    } catch (e: any) {
      toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ═══════════════════════════════════════════
  // COMPUTED VALUES (auto-calculated)
  // ═══════════════════════════════════════════

  const timeline = useMemo(() => {
    const projectStart = 0;
    const designEnd = designMonths;
    const constructionEnd = designMonths + constructionMonths;
    const marketingStart = Math.max(0, designMonths - 3);
    const salesStart = Math.max(0, designMonths - 1);
    const totalProjectMonths = constructionEnd;

    return {
      projectStart,
      designEnd,
      constructionEnd,
      marketingStart,
      salesStart,
      totalProjectMonths,
      marketingPeriod: constructionEnd - marketingStart,
      salesPeriod: constructionEnd - salesStart,
    };
  }, [designMonths, constructionMonths]);

  const marketingBudget = useMemo(() => totalRevenue * (marketingBudgetPct / 100), [totalRevenue, marketingBudgetPct]);
  const salesCommission = useMemo(() => totalRevenue * (salesCommissionPct / 100), [totalRevenue, salesCommissionPct]);
  const offplanRevenue = useMemo(() => totalRevenue * (offplanPct / 100), [totalRevenue, offplanPct]);

  const effectiveSalesAbsorption = useMemo(() => {
    if (salesAbsorption.length === timeline.salesPeriod) return salesAbsorption;
    return Array.from({ length: timeline.salesPeriod }, (_, i) => salesAbsorption[i] ?? (offplanPct / timeline.salesPeriod));
  }, [salesAbsorption, timeline.salesPeriod, offplanPct]);

  const effectiveMarketingDist = useMemo(() => {
    if (marketingDist.length === timeline.marketingPeriod) return marketingDist;
    return Array.from({ length: timeline.marketingPeriod }, (_, i) => marketingDist[i] ?? (100 / timeline.marketingPeriod));
  }, [marketingDist, timeline.marketingPeriod]);

  const totalSalesAbsorption = useMemo(() => effectiveSalesAbsorption.reduce((s, v) => s + v, 0), [effectiveSalesAbsorption]);
  const totalChannelPct = useMemo(() => channels.reduce((s, c) => s + c.pct, 0), [channels]);
  const totalMarketingDist = useMemo(() => effectiveMarketingDist.reduce((s, v) => s + v, 0), [effectiveMarketingDist]);
  const totalPaymentPlanPct = useMemo(() => paymentPlan.reduce((s, m) => s + m.pct, 0), [paymentPlan]);

  const getCalendarMonth = (projectMonthIndex: number) => ((startMonth - 1 + projectMonthIndex) % 12) + 1;
  const getCalendarYear = (projectMonthIndex: number) => startYear + Math.floor((startMonth - 1 + projectMonthIndex) / 12);
  const getMonthLabel = (projectMonthIndex: number) => {
    const cm = getCalendarMonth(projectMonthIndex);
    const yr = getCalendarYear(projectMonthIndex);
    return `${MONTH_NAMES_AR[cm - 1]} ${yr}`;
  };
  const getMonthLabelShort = (projectMonthIndex: number) => {
    const cm = getCalendarMonth(projectMonthIndex);
    const yr = getCalendarYear(projectMonthIndex);
    return `${MONTH_NAMES_EN[cm - 1]} ${yr.toString().slice(2)}`;
  };

  // ═══════════════════════════════════════════
  // CASH INFLOW CALCULATION (Payment Plan × Sales)
  // This is the KEY output — actual cash received per month
  // ═══════════════════════════════════════════
  const cashInflowData = useMemo(() => {
    // For each month in the project, calculate:
    // 1. Sales that happen this month (from absorption plan)
    // 2. Cash received this month (from all previous sales × their payment schedule)
    const totalMonths = timeline.totalProjectMonths;
    const data: Array<{
      monthIndex: number;
      label: string;
      labelShort: string;
      phase: string;
      salesThisMonth: number;
      salesPct: number;
      cashInflow: number;
      marketingSpend: number;
      cumSales: number;
      cumCash: number;
    }> = [];

    // First, compute monthly sales amounts
    const monthlySales: number[] = Array(totalMonths).fill(0);
    for (let i = 0; i < effectiveSalesAbsorption.length; i++) {
      const m = timeline.salesStart + i;
      if (m < totalMonths) {
        monthlySales[m] = (effectiveSalesAbsorption[i] / 100) * totalRevenue;
      }
    }

    // Now compute cash inflow per month based on payment plan
    // For each sale in month S, the buyer pays:
    //   - Booking (e.g. 10%) in month S + lag
    //   - SPA (e.g. 10%) in month S + lag
    //   - Construction installments spread over construction period
    //   - Handover payment at construction end
    const cashPerMonth: number[] = Array(totalMonths + 24).fill(0); // extra months for post-completion payments

    for (let saleMonth = 0; saleMonth < totalMonths; saleMonth++) {
      const saleAmount = monthlySales[saleMonth];
      if (saleAmount <= 0) continue;

      for (const milestone of paymentPlan) {
        const milestoneAmount = saleAmount * (milestone.pct / 100);
        let payMonth = saleMonth;

        if (milestone.trigger === "signing") {
          payMonth = saleMonth + milestone.lag;
        } else if (milestone.trigger === "spa") {
          payMonth = saleMonth + milestone.lag;
        } else if (milestone.trigger === "construction") {
          // Spread evenly over remaining construction months from sale date
          const remainingConstruction = Math.max(1, timeline.constructionEnd - saleMonth);
          const monthlyInstallment = milestoneAmount / remainingConstruction;
          for (let cm = saleMonth; cm < timeline.constructionEnd; cm++) {
            if (cm < cashPerMonth.length) cashPerMonth[cm] += monthlyInstallment;
          }
          continue; // already distributed
        } else if (milestone.trigger === "handover") {
          payMonth = timeline.constructionEnd + milestone.lag;
        }

        if (payMonth >= 0 && payMonth < cashPerMonth.length) {
          cashPerMonth[payMonth] += milestoneAmount;
        }
      }
    }

    // Build the results table
    let cumSales = 0;
    let cumCash = 0;
    for (let m = 0; m < totalMonths; m++) {
      const salesThisMonth = monthlySales[m];
      const cashInflow = cashPerMonth[m];
      cumSales += salesThisMonth;
      cumCash += cashInflow;

      // Marketing spend
      let marketingSpend = 0;
      if (m >= timeline.marketingStart) {
        const mktIdx = m - timeline.marketingStart;
        if (mktIdx < effectiveMarketingDist.length) {
          marketingSpend = (effectiveMarketingDist[mktIdx] / 100) * marketingBudget;
        }
      }

      const phase = m < designMonths ? "تصاميم" : "بناء";
      const salesPct = salesThisMonth > 0 ? (salesThisMonth / totalRevenue) * 100 : 0;

      data.push({
        monthIndex: m,
        label: getMonthLabel(m),
        labelShort: getMonthLabelShort(m),
        phase,
        salesThisMonth,
        salesPct,
        cashInflow,
        marketingSpend,
        cumSales,
        cumCash,
      });
    }

    return data;
  }, [timeline, effectiveSalesAbsorption, effectiveMarketingDist, totalRevenue, marketingBudget, paymentPlan, designMonths, startMonth, startYear]);

  // Warnings
  const warnings = useMemo(() => {
    const w: { type: "error" | "warning" | "info"; message: string }[] = [];
    if (designMonths < 3) {
      w.push({ type: "error", message: `فترة التصاميم (${designMonths} أشهر) أقل من 3 أشهر — لا يمكن بدء التحضيرات التسويقية` });
    }
    if (Math.abs(totalSalesAbsorption - offplanPct) > 1) {
      w.push({ type: "error", message: `مجموع نسب المبيعات (${totalSalesAbsorption.toFixed(1)}%) لا يساوي هدف الأوف بلان (${offplanPct}%)` });
    }
    if (Math.abs(totalChannelPct - 100) > 1) {
      w.push({ type: "error", message: `مجموع القنوات التسويقية (${totalChannelPct}%) يجب أن يساوي 100%` });
    }
    if (Math.abs(totalMarketingDist - 100) > 2) {
      w.push({ type: "warning", message: `مجموع التوزيع الشهري للتسويق (${totalMarketingDist.toFixed(1)}%) يجب أن يساوي 100%` });
    }
    if (Math.abs(totalPaymentPlanPct - 100) > 0.5) {
      w.push({ type: "error", message: `مجموع خطة الدفع (${totalPaymentPlanPct}%) يجب أن يساوي 100%` });
    }
    effectiveSalesAbsorption.forEach((pct, i) => {
      const projectMonth = timeline.salesStart + i;
      const calMonth = getCalendarMonth(projectMonth);
      const season = DUBAI_SEASONALITY[calMonth];
      if (pct > 4 && season.factor < 0.4) {
        w.push({ type: "warning", message: `شهر ${i + 1} من المبيعات (${MONTH_NAMES_AR[calMonth - 1]}): هدف مرتفع (${pct}%) في موسم ضعيف جداً` });
      }
    });
    return w;
  }, [totalSalesAbsorption, totalChannelPct, totalMarketingDist, totalPaymentPlanPct, effectiveSalesAbsorption, timeline, designMonths, offplanPct]);

  // Handlers
  const handleConstructionMonthsChange = (months: number) => {
    setConstructionMonths(months);
    const newSalesPeriod = months + 1;
    const base = offplanPct / newSalesPeriod;
    setSalesAbsorption(Array.from({ length: newSalesPeriod }, () => parseFloat(base.toFixed(2))));
    const newMktPeriod = months + 3;
    const mktBase = 100 / newMktPeriod;
    setMarketingDist(Array.from({ length: newMktPeriod }, () => parseFloat(mktBase.toFixed(2))));
  };

  const handleSalesChange = (index: number, value: number) => {
    const arr = [...effectiveSalesAbsorption];
    arr[index] = value;
    setSalesAbsorption(arr);
  };

  const handleMarketingDistChange = (index: number, value: number) => {
    const arr = [...effectiveMarketingDist];
    arr[index] = value;
    setMarketingDist(arr);
  };

  const handleChannelChange = (index: number, value: number) => {
    const newChannels = [...channels];
    newChannels[index] = { ...newChannels[index], pct: value };
    setChannels(newChannels);
  };

  const handlePaymentPlanChange = (index: number, pct: number) => {
    const newPlan = [...paymentPlan];
    newPlan[index] = { ...newPlan[index], pct };
    setPaymentPlan(newPlan);
  };

  const distributeEven = () => {
    const base = offplanPct / timeline.salesPeriod;
    setSalesAbsorption(Array.from({ length: timeline.salesPeriod }, () => parseFloat(base.toFixed(2))));
  };

  const distributeSeasonal = () => {
    const factors = Array.from({ length: timeline.salesPeriod }, (_, i) => {
      const projectMonth = timeline.salesStart + i;
      const calMonth = getCalendarMonth(projectMonth);
      return DUBAI_SEASONALITY[calMonth].factor;
    });
    const totalFactor = factors.reduce((s, f) => s + f, 0);
    setSalesAbsorption(factors.map(f => parseFloat(((f / totalFactor) * offplanPct).toFixed(2))));
  };

  const distributeMktEven = () => {
    const base = 100 / timeline.marketingPeriod;
    setMarketingDist(Array.from({ length: timeline.marketingPeriod }, () => parseFloat(base.toFixed(2))));
  };

  const distributeMktFrontLoaded = () => {
    const prepMonths = 3;
    const restMonths = timeline.marketingPeriod - prepMonths;
    const prepPct = 20 / prepMonths;
    const restPct = 80 / restMonths;
    setMarketingDist(Array.from({ length: timeline.marketingPeriod }, (_, i) =>
      parseFloat((i < prepMonths ? prepPct : restPct).toFixed(2))
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">خطة المبيعات والتسويق</h1>
              <p className="text-xs text-gray-500">أداة تخطيط تفاعلية — النتائج تتحدث فوراً مع حفظ تلقائي</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Project Selector */}
            <Select
              value={selectedProjectId?.toString() ?? ""}
              onValueChange={(v) => setSelectedProjectId(Number(v))}
            >
              <SelectTrigger className="w-[200px] bg-white border-gray-200">
                <SelectValue placeholder="اختر المشروع" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedProjectId}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* Timeline summary badges */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
            <Paintbrush className="w-3 h-3" />
            تصاميم: {designMonths} شهر
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
            <HardHat className="w-3 h-3" />
            بناء: {constructionMonths} شهر
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <Megaphone className="w-3 h-3" />
            تسويق يبدأ: شهر {timeline.marketingStart + 1}
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <TrendingUp className="w-3 h-3" />
            مبيعات تبدأ: شهر {timeline.salesStart + 1}
          </Badge>
          {planId && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              محفوظ
            </Badge>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  w.type === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : w.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 1: PROJECT INPUTS */}
        {/* ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Financial Inputs */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                المدخلات المالية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">إجمالي إيرادات المشروع (AED)</Label>
                <Input
                  type="number"
                  value={totalRevenue}
                  onChange={(e) => setTotalRevenue(Number(e.target.value))}
                  className="mt-1 bg-gray-50 border-gray-200 font-mono text-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-gray-600">ميزانية التسويق %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={marketingBudgetPct}
                    onChange={(e) => setMarketingBudgetPct(Number(e.target.value))}
                    className="mt-1 bg-gray-50 border-gray-200"
                  />
                  <p className="text-xs text-emerald-600 mt-1 font-medium">{formatAED(marketingBudget)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">عمولة المبيعات %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={salesCommissionPct}
                    onChange={(e) => setSalesCommissionPct(Number(e.target.value))}
                    className="mt-1 bg-gray-50 border-gray-200"
                  />
                  <p className="text-xs text-emerald-600 mt-1 font-medium">{formatAED(salesCommission)}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-600">نسبة البيع أوف بلان %</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Slider
                    value={[offplanPct]}
                    onValueChange={([v]) => setOffplanPct(v)}
                    min={50}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Badge variant="secondary" className="font-mono min-w-[50px] justify-center">{offplanPct}%</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">هدف: {formatAED(offplanRevenue)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Inputs */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-purple-600" />
                </div>
                الجدول الزمني
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-gray-600">فترة التصاميم (أشهر)</Label>
                  <Input
                    type="number"
                    min={3}
                    max={24}
                    value={designMonths}
                    onChange={(e) => setDesignMonths(Number(e.target.value))}
                    className="mt-1 bg-purple-50 border-purple-200 text-lg font-bold text-purple-700"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">فترة البناء (أشهر)</Label>
                  <Input
                    type="number"
                    min={12}
                    max={60}
                    value={constructionMonths}
                    onChange={(e) => handleConstructionMonthsChange(Number(e.target.value))}
                    className="mt-1 bg-emerald-50 border-emerald-200 text-lg font-bold text-emerald-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-gray-600">شهر البداية</Label>
                  <Select value={startMonth.toString()} onValueChange={(v) => setStartMonth(Number(v))}>
                    <SelectTrigger className="mt-1 bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES_AR.map((m, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">سنة البداية</Label>
                  <Select value={startYear.toString()} onValueChange={(v) => setStartYear(Number(v))}>
                    <SelectTrigger className="mt-1 bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auto-calculated milestones */}
              <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 space-y-2">
                <h4 className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  محسوب تلقائياً (قواعد نسبية)
                </h4>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">بداية تحضير التسويق (3 أشهر قبل نهاية التصاميم):</span>
                    <Badge variant="outline" className="text-xs bg-blue-50">{getMonthLabel(timeline.marketingStart)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">بداية المبيعات (الشهر قبل الأخير من التصاميم):</span>
                    <Badge variant="outline" className="text-xs bg-amber-50">{getMonthLabel(timeline.salesStart)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">انتهاء التصاميم:</span>
                    <Badge variant="outline" className="text-xs bg-purple-50">{getMonthLabel(timeline.designEnd)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">انتهاء البناء:</span>
                    <Badge variant="outline" className="text-xs bg-emerald-50">{getMonthLabel(timeline.constructionEnd)}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Plan */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-orange-600" />
                </div>
                خطة الدفع للمشتري
              </CardTitle>
              <Badge variant={Math.abs(totalPaymentPlanPct - 100) < 1 ? "default" : "destructive"} className="w-fit">
                المجموع: {totalPaymentPlanPct}%
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentPlan.map((milestone, i) => (
                <div key={milestone.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{milestone.name}</span>
                    <span className="text-xs text-gray-400">{milestone.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[milestone.pct]}
                      onValueChange={([v]) => handlePaymentPlanChange(i, v)}
                      min={0}
                      max={60}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={milestone.pct}
                      onChange={(e) => handlePaymentPlanChange(i, Number(e.target.value))}
                      className="w-16 h-8 text-center text-sm bg-white border-gray-200"
                    />
                    <span className="text-xs text-gray-400 w-8">%</span>
                  </div>
                  <p className="text-xs text-orange-600 mt-1 font-medium">{formatAED(offplanRevenue * milestone.pct / 100)}</p>
                </div>
              ))}
              {/* Visual bar */}
              <div className="flex h-4 rounded-lg overflow-hidden mt-2">
                {paymentPlan.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-center text-[9px] text-white font-bold"
                    style={{
                      width: `${m.pct}%`,
                      backgroundColor: ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"][i] || "#6b7280",
                    }}
                  >
                    {m.pct > 8 ? `${m.pct}%` : ""}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {paymentPlan.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"][i] || "#6b7280" }} />
                    {m.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 2: SALES ABSORPTION TABLE */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                خطة الامتصاص الشهرية للمبيعات
                <span className="text-xs text-gray-400 font-normal">({timeline.salesPeriod} شهر)</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={distributeEven} className="text-xs gap-1">
                  <RefreshCw className="w-3 h-3" /> توزيع متساوي
                </Button>
                <Button variant="outline" size="sm" onClick={distributeSeasonal} className="text-xs gap-1 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                  <Zap className="w-3 h-3" /> توزيع موسمي
                </Button>
                <Badge variant={Math.abs(totalSalesAbsorption - offplanPct) < 1 ? "default" : "destructive"}>
                  {totalSalesAbsorption.toFixed(1)}% / {offplanPct}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b-2 border-gray-200">
                  <tr>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium w-12">#</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">الشهر</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-14">المرحلة</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-12">الموسم</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-24">نسبة البيع %</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">المبلغ</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveSalesAbsorption.map((pct, i) => {
                    const projectMonth = timeline.salesStart + i;
                    const calMonth = getCalendarMonth(projectMonth);
                    const season = DUBAI_SEASONALITY[calMonth];
                    const target = (pct / 100) * totalRevenue;
                    const cumTarget = effectiveSalesAbsorption.slice(0, i + 1).reduce((s, v) => s + (v / 100) * totalRevenue, 0);
                    const isDesign = projectMonth < designMonths;

                    return (
                      <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 ${season.factor < 0.4 ? "bg-red-50/20" : season.factor >= 1.0 ? "bg-emerald-50/20" : ""}`}>
                        <td className="py-1.5 px-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="py-1.5 px-2 font-medium text-gray-700 text-xs">{getMonthLabel(projectMonth)}</td>
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${isDesign ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                            {isDesign ? "تصاميم" : "بناء"}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-center text-base" title={season.label}>{season.icon}</td>
                        <td className="py-1.5 px-2">
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            max={20}
                            value={pct}
                            onChange={(e) => handleSalesChange(i, Number(e.target.value))}
                            className="h-7 text-center text-sm bg-gray-50 border-gray-200 w-20 mx-auto"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-left font-mono text-gray-700 text-xs">{formatCurrency(target)}</td>
                        <td className="py-1.5 px-2 text-left font-mono text-indigo-600 font-medium text-xs">{formatCurrency(cumTarget)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3: MARKETING */}
        {/* ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Channel Allocation */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-blue-600" />
                </div>
                توزيع القنوات
              </CardTitle>
              <Badge variant={Math.abs(totalChannelPct - 100) < 1 ? "default" : "destructive"} className="w-fit">
                المجموع: {totalChannelPct}%
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {channels.map((ch, i) => (
                <div key={ch.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color }} />
                      {ch.name}
                    </Label>
                    <span className="text-xs text-gray-400">{formatAED(marketingBudget * ch.pct / 100)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ch.pct]}
                      onValueChange={([v]) => handleChannelChange(i, v)}
                      min={0}
                      max={60}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={ch.pct}
                      onChange={(e) => handleChannelChange(i, Number(e.target.value))}
                      className="w-14 h-7 text-center text-sm bg-gray-50 border-gray-200"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Monthly Marketing Distribution */}
          <Card className="border-0 shadow-md bg-white lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                  </div>
                  التوزيع الشهري للتسويق
                  <span className="text-xs text-gray-400 font-normal">({timeline.marketingPeriod} شهر)</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={distributeMktEven} className="text-xs gap-1">
                    <RefreshCw className="w-3 h-3" /> متساوي
                  </Button>
                  <Button variant="outline" size="sm" onClick={distributeMktFrontLoaded} className="text-xs gap-1 bg-blue-50 border-blue-200 text-blue-700">
                    مكثف بالبداية
                  </Button>
                  <Badge variant={Math.abs(totalMarketingDist - 100) < 2 ? "default" : "destructive"}>
                    {totalMarketingDist.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium w-12">#</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">الشهر</th>
                      <th className="text-center py-2 px-2 text-gray-500 font-medium w-14">المرحلة</th>
                      <th className="text-center py-2 px-2 text-gray-500 font-medium w-24">النسبة %</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveMarketingDist.map((pct, i) => {
                      const projectMonth = timeline.marketingStart + i;
                      const isDesign = projectMonth < designMonths;
                      const amount = (pct / 100) * marketingBudget;
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-1.5 px-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                          <td className="py-1.5 px-2 font-medium text-gray-700 text-xs">{getMonthLabel(projectMonth)}</td>
                          <td className="py-1.5 px-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${isDesign ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                              {isDesign ? "تصاميم" : "بناء"}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={30}
                              value={pct}
                              onChange={(e) => handleMarketingDistChange(i, Number(e.target.value))}
                              className="h-7 text-center text-sm bg-gray-50 border-gray-200 w-20 mx-auto"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-left font-mono text-gray-700 text-xs">{formatAED(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 4: RESULTS TABLE (replaces chart) */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Table2 className="w-4 h-4 text-indigo-600" />
                </div>
                جدول النتائج — التدفق النقدي الفعلي للإيرادات
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Info className="w-3 h-3" />
                يحسب متى تدخل الأموال فعلياً بناءً على خطة الدفع
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b-2 border-gray-200">
                  <tr>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium w-12">#</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">الشهر</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-14">المرحلة</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">مبيعات الشهر</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">تحصيل فعلي</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">إنفاق تسويقي</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">مبيعات تراكمية</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">تحصيل تراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {cashInflowData.map((row, i) => {
                    const isActive = row.salesThisMonth > 0 || row.cashInflow > 0 || row.marketingSpend > 0;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-50 ${
                          !isActive ? "opacity-40" : "hover:bg-blue-50/30"
                        } ${row.monthIndex === timeline.salesStart ? "border-t-2 border-t-amber-300" : ""} ${row.monthIndex === timeline.marketingStart ? "border-t-2 border-t-blue-300" : ""}`}
                      >
                        <td className="py-1.5 px-2 text-gray-400 font-mono text-xs">{row.monthIndex + 1}</td>
                        <td className="py-1.5 px-2 font-medium text-gray-700 text-xs">{row.label}</td>
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${row.phase === "تصاميم" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                            {row.phase}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-left font-mono text-xs">
                          {row.salesThisMonth > 0 ? (
                            <span className="text-emerald-700 font-medium">{formatCurrency(row.salesThisMonth)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-left font-mono text-xs">
                          {row.cashInflow > 0 ? (
                            <span className="text-blue-700 font-bold">{formatCurrency(row.cashInflow)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-left font-mono text-xs">
                          {row.marketingSpend > 0 ? (
                            <span className="text-orange-600">{formatCurrency(row.marketingSpend)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-left font-mono text-xs text-indigo-600">{row.cumSales > 0 ? formatCurrency(row.cumSales) : "—"}</td>
                        <td className="py-1.5 px-2 text-left font-mono text-xs text-blue-600 font-medium">{row.cumCash > 0 ? formatCurrency(row.cumCash) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={3} className="py-2 px-2 text-right text-gray-700">الإجمالي</td>
                    <td className="py-2 px-2 text-left font-mono text-emerald-700">{formatCurrency(cashInflowData.reduce((s, r) => s + r.salesThisMonth, 0))}</td>
                    <td className="py-2 px-2 text-left font-mono text-blue-700">{formatCurrency(cashInflowData.reduce((s, r) => s + r.cashInflow, 0))}</td>
                    <td className="py-2 px-2 text-left font-mono text-orange-600">{formatCurrency(cashInflowData.reduce((s, r) => s + r.marketingSpend, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">إيرادات الأوف بلان</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(offplanRevenue)}</p>
            <p className="text-[10px] text-gray-400">{offplanPct}% من الإجمالي</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">ميزانية التسويق</p>
            <p className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(marketingBudget)}</p>
            <p className="text-[10px] text-gray-400">{marketingBudgetPct}%</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">عمولة المبيعات</p>
            <p className="text-lg font-bold text-purple-700 mt-1">{formatCurrency(salesCommission)}</p>
            <p className="text-[10px] text-gray-400">{salesCommissionPct}%</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">تحصيل خلال المشروع</p>
            <p className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(cashInflowData.reduce((s, r) => s + r.cashInflow, 0))}</p>
            <p className="text-[10px] text-gray-400">من إجمالي {formatCurrency(offplanRevenue)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">متوسط تحصيل شهري</p>
            <p className="text-lg font-bold text-amber-700 mt-1">
              {formatCurrency(cashInflowData.reduce((s, r) => s + r.cashInflow, 0) / Math.max(1, cashInflowData.filter(r => r.cashInflow > 0).length))}
            </p>
            <p className="text-[10px] text-gray-400">{cashInflowData.filter(r => r.cashInflow > 0).length} شهر نشط</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">عائد التسويق</p>
            <p className="text-lg font-bold text-indigo-700 mt-1">{(offplanRevenue / marketingBudget).toFixed(1)}x</p>
            <p className="text-[10px] text-gray-400">إيرادات / تسويق</p>
          </div>
        </div>
      </div>
    </div>
  );
}
