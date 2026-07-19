import { useState, useMemo } from "react";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  ReferenceLine,
} from "recharts";
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
} from "lucide-react";

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
  { id: "digital", name: "التسويق الرقمي", nameEn: "Digital Marketing", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", nameEn: "Outdoor & OOH", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", nameEn: "Events & Exhibitions", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", nameEn: "Broker Network", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", nameEn: "PR & Media", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والعلامة", nameEn: "Content & Branding", defaultPct: 5, color: "#06b6d4" },
];

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
}

function formatAED(n: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(n) + " AED";
}

export default function WaelSalesPlan() {
  // ═══════════════════════════════════════════
  // PROJECT INPUTS (what Wael enters)
  // ═══════════════════════════════════════════
  const [totalRevenue, setTotalRevenue] = useState(765_000_000);
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [startMonth, setStartMonth] = useState(1); // January
  const [startYear, setStartYear] = useState(2026);
  const [marketingBudgetPct, setMarketingBudgetPct] = useState(2.0);
  const [salesCommissionPct, setSalesCommissionPct] = useState(5.0);
  const [offplanPct, setOffplanPct] = useState(80); // % sold during construction (off-plan)

  // Monthly sales absorption percentages (for the sales period only)
  const salesPeriodLength = useMemo(() => {
    // Sales start: month before last of design = designMonths - 1
    // Sales end: end of construction = designMonths + constructionMonths
    // Sales period = from (designMonths - 1) to (designMonths + constructionMonths) = constructionMonths + 1 months
    return constructionMonths + 1;
  }, [constructionMonths]);

  const [salesAbsorption, setSalesAbsorption] = useState<number[]>(() => {
    const len = 31; // constructionMonths + 1
    const base = 80 / len;
    return Array.from({ length: len }, () => parseFloat(base.toFixed(2)));
  });

  // Marketing monthly distribution (for marketing period)
  const marketingPeriodLength = useMemo(() => {
    // Marketing starts: 3 months before design ends = designMonths - 3
    // Marketing ends: end of construction = designMonths + constructionMonths
    // Marketing period = from (designMonths - 3) to (designMonths + constructionMonths) = constructionMonths + 3 months
    return constructionMonths + 3;
  }, [constructionMonths]);

  const [marketingDist, setMarketingDist] = useState<number[]>(() => {
    const len = 33; // constructionMonths + 3
    const base = 100 / len;
    return Array.from({ length: len }, () => parseFloat(base.toFixed(2)));
  });

  // Marketing channels
  const [channels, setChannels] = useState(DEFAULT_CHANNELS.map(c => ({ ...c, pct: c.defaultPct })));

  // ═══════════════════════════════════════════
  // COMPUTED VALUES (auto-calculated)
  // ═══════════════════════════════════════════

  // Key timeline milestones (all relative to project start month 0)
  const timeline = useMemo(() => {
    const projectStart = 0;
    const designEnd = designMonths;
    const constructionEnd = designMonths + constructionMonths;
    const marketingStart = Math.max(0, designMonths - 3); // 3 months before design ends
    const salesStart = Math.max(0, designMonths - 1); // month before last of design
    const totalProjectMonths = constructionEnd;

    return {
      projectStart,
      designEnd,
      constructionEnd,
      marketingStart,
      salesStart,
      totalProjectMonths,
      marketingPeriod: constructionEnd - marketingStart, // = constructionMonths + 3
      salesPeriod: constructionEnd - salesStart, // = constructionMonths + 1
    };
  }, [designMonths, constructionMonths]);

  const marketingBudget = useMemo(() => totalRevenue * (marketingBudgetPct / 100), [totalRevenue, marketingBudgetPct]);
  const salesCommission = useMemo(() => totalRevenue * (salesCommissionPct / 100), [totalRevenue, salesCommissionPct]);
  const offplanRevenue = useMemo(() => totalRevenue * (offplanPct / 100), [totalRevenue, offplanPct]);

  // Ensure arrays match period lengths
  const effectiveSalesAbsorption = useMemo(() => {
    if (salesAbsorption.length === timeline.salesPeriod) return salesAbsorption;
    const arr = Array.from({ length: timeline.salesPeriod }, (_, i) => salesAbsorption[i] ?? (offplanPct / timeline.salesPeriod));
    return arr;
  }, [salesAbsorption, timeline.salesPeriod, offplanPct]);

  const effectiveMarketingDist = useMemo(() => {
    if (marketingDist.length === timeline.marketingPeriod) return marketingDist;
    const arr = Array.from({ length: timeline.marketingPeriod }, (_, i) => marketingDist[i] ?? (100 / timeline.marketingPeriod));
    return arr;
  }, [marketingDist, timeline.marketingPeriod]);

  const totalSalesAbsorption = useMemo(() => effectiveSalesAbsorption.reduce((s, v) => s + v, 0), [effectiveSalesAbsorption]);
  const totalChannelPct = useMemo(() => channels.reduce((s, c) => s + c.pct, 0), [channels]);
  const totalMarketingDist = useMemo(() => effectiveMarketingDist.reduce((s, v) => s + v, 0), [effectiveMarketingDist]);

  // Get calendar month for any project month index (0-based)
  const getCalendarMonth = (projectMonthIndex: number) => {
    return ((startMonth - 1 + projectMonthIndex) % 12) + 1;
  };

  const getCalendarYear = (projectMonthIndex: number) => {
    return startYear + Math.floor((startMonth - 1 + projectMonthIndex) / 12);
  };

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

  // Full timeline chart data (one row per project month)
  const fullTimelineData = useMemo(() => {
    const data = [];
    for (let m = 0; m < timeline.totalProjectMonths; m++) {
      const calMonth = getCalendarMonth(m);
      const seasonFactor = DUBAI_SEASONALITY[calMonth].factor;

      // Determine phase
      let phase: "design" | "construction" = m < designMonths ? "design" : "construction";

      // Sales (only during sales period)
      let salesTarget = 0;
      let salesPct = 0;
      if (m >= timeline.salesStart) {
        const salesIdx = m - timeline.salesStart;
        if (salesIdx < effectiveSalesAbsorption.length) {
          salesPct = effectiveSalesAbsorption[salesIdx];
          salesTarget = (salesPct / 100) * totalRevenue;
        }
      }

      // Marketing (only during marketing period)
      let marketingSpend = 0;
      let marketingPct = 0;
      if (m >= timeline.marketingStart) {
        const mktIdx = m - timeline.marketingStart;
        if (mktIdx < effectiveMarketingDist.length) {
          marketingPct = effectiveMarketingDist[mktIdx];
          marketingSpend = (marketingPct / 100) * marketingBudget;
        }
      }

      data.push({
        monthIndex: m,
        label: getMonthLabelShort(m),
        labelAr: getMonthLabel(m),
        phase,
        calMonth,
        seasonFactor,
        salesTarget,
        salesPct,
        marketingSpend,
        marketingPct,
        isMarketingActive: m >= timeline.marketingStart,
        isSalesActive: m >= timeline.salesStart,
      });
    }
    return data;
  }, [timeline, designMonths, effectiveSalesAbsorption, effectiveMarketingDist, totalRevenue, marketingBudget, startMonth, startYear]);

  // Cumulative sales
  const cumulativeSalesData = useMemo(() => {
    let cum = 0;
    return fullTimelineData.map(d => {
      cum += d.salesTarget;
      return { ...d, cumSales: cum };
    });
  }, [fullTimelineData]);

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
    // Check high sales during weak season
    effectiveSalesAbsorption.forEach((pct, i) => {
      const projectMonth = timeline.salesStart + i;
      const calMonth = getCalendarMonth(projectMonth);
      const season = DUBAI_SEASONALITY[calMonth];
      if (pct > 4 && season.factor < 0.4) {
        w.push({ type: "warning", message: `شهر ${i + 1} من المبيعات (${MONTH_NAMES_AR[calMonth - 1]}): هدف مرتفع (${pct}%) في موسم ضعيف جداً` });
      }
    });
    return w;
  }, [totalSalesAbsorption, totalChannelPct, totalMarketingDist, effectiveSalesAbsorption, timeline, designMonths, offplanPct]);

  // Handlers
  const handleDesignMonthsChange = (months: number) => {
    setDesignMonths(months);
  };

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
    const arr = factors.map(f => parseFloat(((f / totalFactor) * offplanPct).toFixed(2)));
    setSalesAbsorption(arr);
  };

  const distributeMktEven = () => {
    const base = 100 / timeline.marketingPeriod;
    setMarketingDist(Array.from({ length: timeline.marketingPeriod }, () => parseFloat(base.toFixed(2))));
  };

  const distributeMktFrontLoaded = () => {
    // First 3 months (prep) get 20%, rest gets 80%
    const prepMonths = 3;
    const restMonths = timeline.marketingPeriod - prepMonths;
    const prepPct = 20 / prepMonths;
    const restPct = 80 / restMonths;
    const arr = Array.from({ length: timeline.marketingPeriod }, (_, i) =>
      parseFloat((i < prepMonths ? prepPct : restPct).toFixed(2))
    );
    setMarketingDist(arr);
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
              <p className="text-xs text-gray-500">أداة تخطيط تفاعلية — النتائج تتحدث فوراً</p>
            </div>
          </div>
          {/* Timeline summary badge */}
          <div className="hidden md:flex items-center gap-3 text-xs">
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
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

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
                    onChange={(e) => handleDesignMonthsChange(Number(e.target.value))}
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
                  محسوب تلقائياً
                </h4>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">بداية تحضير التسويق:</span>
                    <Badge variant="outline" className="text-xs bg-blue-50">{getMonthLabel(timeline.marketingStart)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">بداية المبيعات:</span>
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

          {/* Timeline Visual */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                </div>
                خريطة المراحل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Design Phase Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-purple-700 flex items-center gap-1"><Paintbrush className="w-3 h-3" /> التصاميم</span>
                    <span className="text-gray-400">{designMonths} شهر</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-l from-purple-400 to-purple-500 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ width: `${(designMonths / timeline.totalProjectMonths) * 100}%` }}
                    >
                      {designMonths}m
                    </div>
                  </div>
                </div>

                {/* Construction Phase Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-emerald-700 flex items-center gap-1"><HardHat className="w-3 h-3" /> البناء</span>
                    <span className="text-gray-400">{constructionMonths} شهر</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                      style={{
                        width: `${(constructionMonths / timeline.totalProjectMonths) * 100}%`,
                        marginRight: `${(designMonths / timeline.totalProjectMonths) * 100}%`,
                      }}
                    >
                      {constructionMonths}m
                    </div>
                  </div>
                </div>

                {/* Marketing Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-blue-700 flex items-center gap-1"><Megaphone className="w-3 h-3" /> التسويق</span>
                    <span className="text-gray-400">{timeline.marketingPeriod} شهر</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                      style={{
                        width: `${(timeline.marketingPeriod / timeline.totalProjectMonths) * 100}%`,
                        marginRight: `${(timeline.marketingStart / timeline.totalProjectMonths) * 100}%`,
                      }}
                    >
                      {timeline.marketingPeriod}m
                    </div>
                  </div>
                </div>

                {/* Sales Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-amber-700 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> المبيعات</span>
                    <span className="text-gray-400">{timeline.salesPeriod} شهر</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-l from-amber-400 to-amber-500 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                      style={{
                        width: `${(timeline.salesPeriod / timeline.totalProjectMonths) * 100}%`,
                        marginRight: `${(timeline.salesStart / timeline.totalProjectMonths) * 100}%`,
                      }}
                    >
                      {timeline.salesPeriod}m
                    </div>
                  </div>
                </div>
              </div>

              {/* Seasonality reference */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <h4 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  موسمية سوق دبي
                </h4>
                <div className="grid grid-cols-6 gap-1">
                  {Object.entries(DUBAI_SEASONALITY).map(([month, data]) => (
                    <div
                      key={month}
                      className={`text-center p-1 rounded text-[10px] ${
                        data.factor >= 1.0
                          ? "bg-emerald-100 text-emerald-700"
                          : data.factor >= 0.7
                          ? "bg-yellow-100 text-yellow-700"
                          : data.factor >= 0.5
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span>{data.icon}</span>
                      <p className="font-bold">{(data.factor * 100).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
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
                <span className="text-xs text-gray-400 font-normal">({timeline.salesPeriod} شهر — من {getMonthLabel(timeline.salesStart)} إلى {getMonthLabel(timeline.constructionEnd - 1)})</span>
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
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b-2 border-gray-200">
                  <tr>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium w-12">#</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">الشهر</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-14">المرحلة</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-12">الموسم</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium w-24">نسبة البيع %</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">المبلغ المستهدف</th>
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
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
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
        {/* SECTION 4: RESULTS DASHBOARD */}
        {/* ═══════════════════════════════════════════ */}
        <div className="space-y-6">
          {/* Full Timeline Chart */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                الجدول الزمني الكامل — المبيعات والتسويق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cumulativeSalesData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatAED(value), name]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Legend />
                    {/* Reference lines for phase transitions */}
                    <ReferenceLine x={getMonthLabelShort(timeline.marketingStart)} yAxisId="left" stroke="#3b82f6" strokeDasharray="5 5" label={{ value: "تسويق", position: "top", fontSize: 10 }} />
                    <ReferenceLine x={getMonthLabelShort(timeline.salesStart)} yAxisId="left" stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "مبيعات", position: "top", fontSize: 10 }} />
                    <ReferenceLine x={getMonthLabelShort(designMonths)} yAxisId="left" stroke="#8b5cf6" strokeDasharray="5 5" label={{ value: "نهاية التصاميم", position: "top", fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="salesTarget" name="مبيعات شهرية" fill="#10b981" opacity={0.7} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="marketingSpend" name="إنفاق تسويقي" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="cumSales" name="مبيعات تراكمية" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
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
              <p className="text-xs text-gray-500">متوسط مبيعات شهري</p>
              <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(offplanRevenue / timeline.salesPeriod)}</p>
              <p className="text-[10px] text-gray-400">{timeline.salesPeriod} شهر</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">متوسط تسويق شهري</p>
              <p className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(marketingBudget / timeline.marketingPeriod)}</p>
              <p className="text-[10px] text-gray-400">{timeline.marketingPeriod} شهر</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">عائد التسويق المستهدف</p>
              <p className="text-lg font-bold text-indigo-700 mt-1">{(offplanRevenue / marketingBudget).toFixed(1)}x</p>
              <p className="text-[10px] text-gray-400">إيرادات / تسويق</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
