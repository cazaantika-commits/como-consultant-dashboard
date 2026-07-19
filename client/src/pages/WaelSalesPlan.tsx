import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sun,
  Leaf,
  Info,
  RefreshCw,
} from "lucide-react";

// Dubai seasonality factors (1.0 = average, >1 = strong, <1 = weak)
const DUBAI_SEASONALITY: Record<number, { factor: number; label: string; icon: string }> = {
  1: { factor: 0.85, label: "Jan - Moderate", icon: "❄️" },
  2: { factor: 0.90, label: "Feb - Moderate", icon: "🌤️" },
  3: { factor: 0.95, label: "Mar - Good", icon: "🌸" },
  4: { factor: 0.80, label: "Apr - Moderate", icon: "🌷" },
  5: { factor: 0.60, label: "May - Slow", icon: "☀️" },
  6: { factor: 0.40, label: "Jun - Very Slow", icon: "🔥" },
  7: { factor: 0.30, label: "Jul - Weakest", icon: "🔥" },
  8: { factor: 0.35, label: "Aug - Very Slow", icon: "🔥" },
  9: { factor: 0.70, label: "Sep - Recovery", icon: "🍂" },
  10: { factor: 1.20, label: "Oct - Strong", icon: "🚀" },
  11: { factor: 1.30, label: "Nov - Strongest", icon: "🚀" },
  12: { factor: 1.00, label: "Dec - Good", icon: "🎄" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

// Marketing channels
const DEFAULT_CHANNELS = [
  { id: "digital", name: "Digital Marketing", nameAr: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "Outdoor & OOH", nameAr: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "Events & Exhibitions", nameAr: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "Broker Network", nameAr: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "PR & Media", nameAr: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "Content & Branding", nameAr: "المحتوى والعلامة", defaultPct: 5, color: "#06b6d4" },
];

// Default payment plan milestones
const DEFAULT_PAYMENT_PLAN = [
  { label: "Booking / Signing", labelAr: "الحجز / التوقيع", pct: 10 },
  { label: "Within 30 days", labelAr: "خلال 30 يوم", pct: 10 },
  { label: "30% Construction", labelAr: "إنجاز 30% بناء", pct: 10 },
  { label: "50% Construction", labelAr: "إنجاز 50% بناء", pct: 10 },
  { label: "70% Construction", labelAr: "إنجاز 70% بناء", pct: 10 },
  { label: "100% Construction", labelAr: "إنجاز 100% بناء", pct: 10 },
  { label: "Handover", labelAr: "التسليم", pct: 40 },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
}

export default function WaelSalesPlan() {
  // === PROJECT SETUP ===
  const [totalRevenue, setTotalRevenue] = useState(765_000_000);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [startMonth, setStartMonth] = useState(8); // August
  const [startYear, setStartYear] = useState(2026);
  const [marketingBudgetPct, setMarketingBudgetPct] = useState(2.0);
  const [salesCommissionPct, setSalesCommissionPct] = useState(5.0);
  const [offplanPct, setOffplanPct] = useState(80);

  // === SALES ABSORPTION ===
  const [salesAbsorption, setSalesAbsorption] = useState<number[]>(() => {
    const months = 30;
    const base = 80 / months;
    return Array.from({ length: months }, () => parseFloat(base.toFixed(1)));
  });

  // === MARKETING CHANNELS ===
  const [channels, setChannels] = useState(DEFAULT_CHANNELS.map(c => ({ ...c, pct: c.defaultPct })));

  // === MARKETING MONTHLY DISTRIBUTION ===
  const [marketingMonthlyDist, setMarketingMonthlyDist] = useState<number[]>(() => {
    const months = 30;
    const base = 100 / months;
    return Array.from({ length: months }, () => parseFloat(base.toFixed(1)));
  });

  // === PAYMENT PLAN ===
  const [paymentPlan, setPaymentPlan] = useState(DEFAULT_PAYMENT_PLAN.map(p => ({ ...p })));

  // === COMPUTED VALUES ===
  const marketingBudget = useMemo(() => totalRevenue * (marketingBudgetPct / 100), [totalRevenue, marketingBudgetPct]);
  const salesCommission = useMemo(() => totalRevenue * (salesCommissionPct / 100), [totalRevenue, salesCommissionPct]);
  const totalSalesAbsorption = useMemo(() => salesAbsorption.reduce((s, v) => s + v, 0), [salesAbsorption]);
  const totalChannelPct = useMemo(() => channels.reduce((s, c) => s + c.pct, 0), [channels]);
  const totalMarketingDist = useMemo(() => marketingMonthlyDist.reduce((s, v) => s + v, 0), [marketingMonthlyDist]);
  const totalPaymentPlan = useMemo(() => paymentPlan.reduce((s, p) => s + p.pct, 0), [paymentPlan]);

  // Monthly sales targets (AED)
  const monthlySalesTargets = useMemo(() => {
    return salesAbsorption.map((pct) => (pct / 100) * totalRevenue);
  }, [salesAbsorption, totalRevenue]);

  // Monthly marketing spend (AED)
  const monthlyMarketingSpend = useMemo(() => {
    return marketingMonthlyDist.map((pct) => (pct / 100) * marketingBudget);
  }, [marketingMonthlyDist, marketingBudget]);

  // Cumulative sales
  const cumulativeSales = useMemo(() => {
    let cum = 0;
    return monthlySalesTargets.map((v) => { cum += v; return cum; });
  }, [monthlySalesTargets]);

  // Get calendar month for each construction month
  const getCalendarMonth = useCallback((constructionMonthIndex: number) => {
    const totalMonth = (startMonth - 1) + constructionMonthIndex;
    return (totalMonth % 12) + 1;
  }, [startMonth]);

  // Seasonality-adjusted targets
  const seasonalityAdjustedTargets = useMemo(() => {
    return monthlySalesTargets.map((target, i) => {
      const calMonth = getCalendarMonth(i);
      return target * DUBAI_SEASONALITY[calMonth].factor;
    });
  }, [monthlySalesTargets, getCalendarMonth]);

  // Chart data
  const chartData = useMemo(() => {
    return salesAbsorption.map((_, i) => {
      const calMonth = getCalendarMonth(i);
      const monthLabel = MONTH_NAMES[calMonth - 1];
      const year = startYear + Math.floor(((startMonth - 1) + i) / 12);
      return {
        name: `${monthLabel} ${year.toString().slice(2)}`,
        month: i + 1,
        salesTarget: monthlySalesTargets[i],
        adjustedTarget: seasonalityAdjustedTargets[i],
        marketingSpend: monthlyMarketingSpend[i],
        cumSales: cumulativeSales[i],
        seasonality: DUBAI_SEASONALITY[calMonth].factor,
      };
    });
  }, [salesAbsorption, monthlySalesTargets, seasonalityAdjustedTargets, monthlyMarketingSpend, cumulativeSales, getCalendarMonth, startMonth, startYear]);

  // Warnings
  const warnings = useMemo(() => {
    const w: { type: "error" | "warning" | "info"; message: string }[] = [];
    if (Math.abs(totalSalesAbsorption - offplanPct) > 1) {
      w.push({ type: "error", message: `Sales absorption total (${totalSalesAbsorption.toFixed(1)}%) doesn't match off-plan target (${offplanPct}%). Difference: ${(totalSalesAbsorption - offplanPct).toFixed(1)}%` });
    }
    if (Math.abs(totalChannelPct - 100) > 1) {
      w.push({ type: "error", message: `Marketing channels total (${totalChannelPct}%) must equal 100%` });
    }
    if (Math.abs(totalMarketingDist - 100) > 2) {
      w.push({ type: "warning", message: `Marketing monthly distribution total (${totalMarketingDist.toFixed(1)}%) should equal 100%` });
    }
    if (Math.abs(totalPaymentPlan - 100) > 0.1) {
      w.push({ type: "error", message: `Payment plan total (${totalPaymentPlan}%) must equal 100%` });
    }
    salesAbsorption.forEach((pct, i) => {
      const calMonth = getCalendarMonth(i);
      const season = DUBAI_SEASONALITY[calMonth];
      if (pct > 5 && season.factor < 0.5) {
        w.push({ type: "warning", message: `Month ${i + 1} (${MONTH_NAMES[calMonth - 1]}): High sales target (${pct}%) during weak season (factor ${season.factor})` });
      }
    });
    return w;
  }, [totalSalesAbsorption, totalChannelPct, totalMarketingDist, totalPaymentPlan, salesAbsorption, getCalendarMonth, offplanPct]);

  // Handlers
  const handleSalesAbsorptionChange = (index: number, value: number) => {
    const newArr = [...salesAbsorption];
    newArr[index] = value;
    setSalesAbsorption(newArr);
  };

  const handleChannelChange = (index: number, value: number) => {
    const newChannels = [...channels];
    newChannels[index] = { ...newChannels[index], pct: value };
    setChannels(newChannels);
  };

  const handleMarketingDistChange = (index: number, value: number) => {
    const newDist = [...marketingMonthlyDist];
    newDist[index] = value;
    setMarketingMonthlyDist(newDist);
  };

  const handlePaymentPlanChange = (index: number, value: number) => {
    const newPlan = [...paymentPlan];
    newPlan[index] = { ...newPlan[index], pct: value };
    setPaymentPlan(newPlan);
  };

  const distributeEvenly = () => {
    const target = offplanPct / constructionMonths;
    setSalesAbsorption(Array.from({ length: constructionMonths }, () => parseFloat(target.toFixed(2))));
  };

  const distributeWithSeasonality = () => {
    const factors = Array.from({ length: constructionMonths }, (_, i) => {
      const calMonth = getCalendarMonth(i);
      return DUBAI_SEASONALITY[calMonth].factor;
    });
    const totalFactor = factors.reduce((s, f) => s + f, 0);
    const newAbsorption = factors.map(f => parseFloat(((f / totalFactor) * offplanPct).toFixed(2)));
    setSalesAbsorption(newAbsorption);
  };

  const distributeMarketingEvenly = () => {
    const target = 100 / constructionMonths;
    setMarketingMonthlyDist(Array.from({ length: constructionMonths }, () => parseFloat(target.toFixed(2))));
  };

  const distributeMarketingFrontLoaded = () => {
    const firstHalf = Math.ceil(constructionMonths / 2);
    const secondHalf = constructionMonths - firstHalf;
    const firstPct = 60 / firstHalf;
    const secondPct = 40 / secondHalf;
    const newDist = Array.from({ length: constructionMonths }, (_, i) =>
      parseFloat((i < firstHalf ? firstPct : secondPct).toFixed(2))
    );
    setMarketingMonthlyDist(newDist);
  };

  const handleConstructionMonthsChange = (months: number) => {
    setConstructionMonths(months);
    const target = offplanPct / months;
    setSalesAbsorption(Array.from({ length: months }, () => parseFloat(target.toFixed(2))));
    const mktTarget = 100 / months;
    setMarketingMonthlyDist(Array.from({ length: months }, () => parseFloat(mktTarget.toFixed(2))));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-[1600px] mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales & Marketing Planning</h1>
            <p className="text-sm text-gray-500">Interactive planning tool for sales absorption & marketing budget allocation</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">Total Revenue</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Marketing Budget</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(marketingBudget)}</p>
            <p className="text-xs text-gray-400">{marketingBudgetPct}% of revenue</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500">Sales Commission</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(salesCommission)}</p>
            <p className="text-xs text-gray-400">{salesCommissionPct}% of revenue</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-gray-500">Construction Period</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{constructionMonths} months</p>
            <p className="text-xs text-gray-400">{MONTH_NAMES[startMonth - 1]} {startYear}</p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="max-w-[1600px] mx-auto mb-6">
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
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
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <Tabs defaultValue="setup" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm p-1 rounded-xl">
            <TabsTrigger value="setup" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
              <Calendar className="w-4 h-4 mr-2" />
              Project Setup
            </TabsTrigger>
            <TabsTrigger value="sales" className="rounded-lg data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              Sales Plan
            </TabsTrigger>
            <TabsTrigger value="marketing" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <Megaphone className="w-4 h-4 mr-2" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
              <DollarSign className="w-4 h-4 mr-2" />
              Payment Plan
            </TabsTrigger>
            <TabsTrigger value="results" className="rounded-lg data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
              <BarChart3 className="w-4 h-4 mr-2" />
              Results
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROJECT SETUP */}
          <TabsContent value="setup">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-indigo-600" />
                    </div>
                    Financial Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Total Project Revenue (AED)</Label>
                    <Input
                      type="number"
                      value={totalRevenue}
                      onChange={(e) => setTotalRevenue(Number(e.target.value))}
                      className="mt-1.5 bg-gray-50 border-gray-200 focus:border-indigo-400 font-mono text-lg"
                    />
                    <p className="text-xs text-gray-400 mt-1">From approved pricing scenario</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Marketing Budget %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={marketingBudgetPct}
                        onChange={(e) => setMarketingBudgetPct(Number(e.target.value))}
                        className="mt-1.5 bg-gray-50 border-gray-200 focus:border-indigo-400"
                      />
                      <p className="text-xs text-emerald-600 mt-1 font-medium">= {formatCurrency(marketingBudget)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Sales Commission %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={salesCommissionPct}
                        onChange={(e) => setSalesCommissionPct(Number(e.target.value))}
                        className="mt-1.5 bg-gray-50 border-gray-200 focus:border-indigo-400"
                      />
                      <p className="text-xs text-emerald-600 mt-1 font-medium">= {formatCurrency(salesCommission)}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Off-Plan Sales Target %</Label>
                    <div className="flex items-center gap-4 mt-1.5">
                      <Slider
                        value={[offplanPct]}
                        onValueChange={([v]) => setOffplanPct(v)}
                        min={50}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <Badge variant="secondary" className="text-sm font-mono min-w-[60px] justify-center">
                        {offplanPct}%
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{100 - offplanPct}% sold post-completion</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-amber-600" />
                    </div>
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Construction Duration (months)</Label>
                    <Input
                      type="number"
                      min={12}
                      max={60}
                      value={constructionMonths}
                      onChange={(e) => handleConstructionMonthsChange(Number(e.target.value))}
                      className="mt-1.5 bg-gray-50 border-gray-200 focus:border-amber-400 text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Start Month</Label>
                      <Select value={startMonth.toString()} onValueChange={(v) => setStartMonth(Number(v))}>
                        <SelectTrigger className="mt-1.5 bg-gray-50 border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_NAMES.map((m, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {m} - {MONTH_NAMES_AR[i]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Start Year</Label>
                      <Select value={startYear.toString()} onValueChange={(v) => setStartYear(Number(v))}>
                        <SelectTrigger className="mt-1.5 bg-gray-50 border-gray-200">
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

                  {/* Seasonality Preview */}
                  <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      Dubai Market Seasonality
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(DUBAI_SEASONALITY).map(([month, data]) => (
                        <div
                          key={month}
                          className={`text-center p-2 rounded-lg text-xs ${
                            data.factor >= 1.0
                              ? "bg-emerald-100 text-emerald-700"
                              : data.factor >= 0.7
                              ? "bg-yellow-100 text-yellow-700"
                              : data.factor >= 0.5
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          <span className="text-base">{data.icon}</span>
                          <p className="font-medium mt-0.5">{MONTH_NAMES[Number(month) - 1]}</p>
                          <p className="font-bold">{(data.factor * 100).toFixed(0)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: SALES PLAN */}
          <TabsContent value="sales">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    Monthly Sales Absorption Plan
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={distributeEvenly} className="text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Even
                    </Button>
                    <Button variant="outline" size="sm" onClick={distributeWithSeasonality} className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                      <Leaf className="w-3 h-3 mr-1" />
                      Seasonal
                    </Button>
                    <Badge
                      variant={Math.abs(totalSalesAbsorption - offplanPct) < 1 ? "default" : "destructive"}
                      className="ml-2"
                    >
                      Total: {totalSalesAbsorption.toFixed(1)}% / {offplanPct}%
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-gray-500 font-medium w-16">#</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium w-24">Month</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium w-16">Season</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium w-32">Sales %</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">Target (AED)</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">Adjusted</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesAbsorption.map((pct, i) => {
                        const calMonth = getCalendarMonth(i);
                        const season = DUBAI_SEASONALITY[calMonth];
                        const year = startYear + Math.floor(((startMonth - 1) + i) / 12);
                        return (
                          <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 ${season.factor < 0.5 ? "bg-red-50/30" : season.factor >= 1.0 ? "bg-emerald-50/30" : ""}`}>
                            <td className="py-1.5 px-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                            <td className="py-1.5 px-2 font-medium text-gray-700">
                              {MONTH_NAMES[calMonth - 1]} {year.toString().slice(2)}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="text-base" title={season.label}>{season.icon}</span>
                            </td>
                            <td className="py-1.5 px-2">
                              <Input
                                type="number"
                                step="0.1"
                                min={0}
                                max={20}
                                value={pct}
                                onChange={(e) => handleSalesAbsorptionChange(i, Number(e.target.value))}
                                className="h-7 text-center text-sm bg-gray-50 border-gray-200 focus:border-emerald-400 w-20 mx-auto"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-700">
                              {formatNumber(monthlySalesTargets[i])}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-500">
                              {formatNumber(seasonalityAdjustedTargets[i])}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-indigo-600 font-medium">
                              {formatNumber(cumulativeSales[i])}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                        <td colSpan={3} className="py-2 px-2 text-gray-700">Total</td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={Math.abs(totalSalesAbsorption - offplanPct) < 1 ? "default" : "destructive"}>
                            {totalSalesAbsorption.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(monthlySalesTargets.reduce((s, v) => s + v, 0))}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(seasonalityAdjustedTargets.reduce((s, v) => s + v, 0))}</td>
                        <td className="py-2 px-2 text-right font-mono text-indigo-600">{formatCurrency(cumulativeSales[cumulativeSales.length - 1] || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: MARKETING */}
          <TabsContent value="marketing">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Channel Allocation */}
              <Card className="border-0 shadow-md bg-white lg:col-span-1">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-blue-600" />
                    </div>
                    Channel Allocation
                  </CardTitle>
                  <Badge variant={Math.abs(totalChannelPct - 100) < 1 ? "default" : "destructive"} className="w-fit">
                    Total: {totalChannelPct}%
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {channels.map((ch, i) => (
                    <div key={ch.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color }} />
                          {ch.name}
                        </Label>
                        <span className="text-xs text-gray-400">{ch.nameAr}</span>
                      </div>
                      <div className="flex items-center gap-3">
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
                          className="w-16 h-7 text-center text-sm bg-gray-50 border-gray-200"
                        />
                        <span className="text-xs text-gray-400 w-16 text-right">{formatCurrency(marketingBudget * ch.pct / 100)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Monthly Distribution */}
              <Card className="border-0 shadow-md bg-white lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                      </div>
                      Monthly Marketing Distribution
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={distributeMarketingEvenly} className="text-xs">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Even
                      </Button>
                      <Button variant="outline" size="sm" onClick={distributeMarketingFrontLoaded} className="text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100">
                        Front-loaded
                      </Button>
                      <Badge variant={Math.abs(totalMarketingDist - 100) < 2 ? "default" : "destructive"}>
                        {totalMarketingDist.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium w-16">#</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Month</th>
                          <th className="text-center py-2 px-2 text-gray-500 font-medium">Season</th>
                          <th className="text-center py-2 px-2 text-gray-500 font-medium">Distribution %</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">Amount (AED)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketingMonthlyDist.map((pct, i) => {
                          const calMonth = getCalendarMonth(i);
                          const season = DUBAI_SEASONALITY[calMonth];
                          const year = startYear + Math.floor(((startMonth - 1) + i) / 12);
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="py-1.5 px-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                              <td className="py-1.5 px-2 font-medium text-gray-700">
                                {MONTH_NAMES[calMonth - 1]} {year.toString().slice(2)}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className="text-base">{season.icon}</span>
                              </td>
                              <td className="py-1.5 px-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  max={30}
                                  value={pct}
                                  onChange={(e) => handleMarketingDistChange(i, Number(e.target.value))}
                                  className="h-7 text-center text-sm bg-gray-50 border-gray-200 focus:border-purple-400 w-20 mx-auto"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono text-gray-700">
                                {formatCurrency(monthlyMarketingSpend[i])}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-white">
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <td colSpan={3} className="py-2 px-2 text-gray-700">Total</td>
                          <td className="py-2 px-2 text-center">
                            <Badge variant={Math.abs(totalMarketingDist - 100) < 2 ? "default" : "destructive"}>
                              {totalMarketingDist.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(marketingBudget)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: PAYMENT PLAN */}
          <TabsContent value="payment">
            <Card className="border-0 shadow-md bg-white max-w-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                  </div>
                  Payment Plan Configuration
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">Define buyer payment milestones (must total 100%)</p>
                <Badge variant={Math.abs(totalPaymentPlan - 100) < 0.1 ? "default" : "destructive"} className="w-fit mt-2">
                  Total: {totalPaymentPlan}%
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentPlan.map((milestone, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{milestone.label}</p>
                        <p className="text-xs text-gray-400">{milestone.labelAr}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step={5}
                          min={0}
                          max={100}
                          value={milestone.pct}
                          onChange={(e) => handlePaymentPlanChange(i, Number(e.target.value))}
                          className="w-20 h-8 text-center bg-gray-50 border-gray-200 focus:border-purple-400 font-mono"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                      <p className="text-sm font-mono text-gray-600 w-28 text-right">
                        {formatCurrency(totalRevenue * milestone.pct / 100)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Visual bar */}
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Flow Visualization</h4>
                  <div className="flex h-8 rounded-lg overflow-hidden">
                    {paymentPlan.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center text-white text-xs font-bold transition-all"
                        style={{
                          width: `${m.pct}%`,
                          backgroundColor: `hsl(${260 + i * 20}, 60%, ${45 + i * 5}%)`,
                        }}
                        title={`${m.label}: ${m.pct}%`}
                      >
                        {m.pct >= 8 && `${m.pct}%`}
                      </div>
                    ))}
                  </div>
                  <div className="flex mt-2 text-xs text-gray-500">
                    {paymentPlan.map((m, i) => (
                      <div key={i} style={{ width: `${m.pct}%` }} className="text-center truncate px-0.5">
                        {m.pct >= 8 && m.label.split(" ")[0]}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: RESULTS DASHBOARD */}
          <TabsContent value="results">
            <div className="space-y-6">
              {/* Sales vs Marketing Chart */}
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-amber-600" />
                    </div>
                    Sales Targets vs Marketing Spend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatNumber(v)}
                          label={{ value: "Sales (AED)", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatNumber(v)}
                          label={{ value: "Marketing (AED)", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          labelStyle={{ fontWeight: "bold" }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="salesTarget" name="Sales Target" fill="#10b981" opacity={0.7} radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="adjustedTarget" name="Seasonality Adjusted" fill="#059669" opacity={0.4} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="marketingSpend" name="Marketing Spend" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cumulative Sales Chart */}
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    Cumulative Sales Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatNumber(v)}
                        />
                        <Tooltip formatter={(value: number) => [formatCurrency(value)]} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="cumSales"
                          name="Cumulative Sales"
                          fill="#6366f1"
                          fillOpacity={0.1}
                          stroke="#6366f1"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Seasonality Factor Chart */}
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                      <Sun className="w-4 h-4 text-rose-600" />
                    </div>
                    Seasonality Impact on Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 1.5]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                        <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(0)}%`, "Seasonality Factor"]} />
                        <Bar dataKey="seasonality" name="Seasonality Factor" radius={[4, 4, 0, 0]} fill="#f43f5e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Table */}
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    Plan Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-600 font-medium">Off-Plan Revenue Target</p>
                      <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(totalRevenue * offplanPct / 100)}</p>
                      <p className="text-xs text-emerald-500 mt-0.5">{offplanPct}% of total revenue</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-600 font-medium">Total Marketing Budget</p>
                      <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(marketingBudget)}</p>
                      <p className="text-xs text-blue-500 mt-0.5">{marketingBudgetPct}% x {formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <p className="text-sm text-purple-600 font-medium">Total Sales Commission</p>
                      <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(salesCommission)}</p>
                      <p className="text-xs text-purple-500 mt-0.5">{salesCommissionPct}% x {formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-sm text-amber-600 font-medium">Avg Monthly Sales Target</p>
                      <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(totalRevenue * offplanPct / 100 / constructionMonths)}</p>
                      <p className="text-xs text-amber-500 mt-0.5">Over {constructionMonths} months</p>
                    </div>
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <p className="text-sm text-rose-600 font-medium">Avg Monthly Marketing</p>
                      <p className="text-xl font-bold text-rose-700 mt-1">{formatCurrency(marketingBudget / constructionMonths)}</p>
                      <p className="text-xs text-rose-500 mt-0.5">Over {constructionMonths} months</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-sm text-indigo-600 font-medium">Marketing ROI Target</p>
                      <p className="text-xl font-bold text-indigo-700 mt-1">{((totalRevenue * offplanPct / 100) / marketingBudget).toFixed(1)}x</p>
                      <p className="text-xs text-indigo-500 mt-0.5">Revenue / Marketing spend</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
