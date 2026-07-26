import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, DollarSign, TrendingUp, BarChart3, Target,
  Megaphone, Users, Calendar, Zap, AlertTriangle, CheckCircle2,
  Building2, ShieldCheck, Palette, Rocket, HardHat, FileCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// DATA MODEL
// ═══════════════════════════════════════════════════════════════════════════════

const UNIT_TYPES = [
  { id: "studio", name: "استوديو", count: 0, area: 400, color: "#6366f1", defaultPrice: 1800 },
  { id: "1br", name: "غرفة وصالة", count: 30, area: 750, color: "#3b82f6", defaultPrice: 1650 },
  { id: "2br", name: "غرفتين وصالة", count: 30, area: 1300, color: "#8b5cf6", defaultPrice: 1550 },
  { id: "3br", name: "ثلاث غرف", count: 15, area: 1650, color: "#d946ef", defaultPrice: 1450 },
  { id: "retail_s", name: "تجزئة صغير", count: 18, area: 850, color: "#f59e0b", defaultPrice: 3000 },
  { id: "retail_m", name: "تجزئة متوسط", count: 12, area: 1200, color: "#f97316", defaultPrice: 2500 },
  { id: "retail_l", name: "تجزئة كبير", count: 4, area: 1800, color: "#ef4444", defaultPrice: 2000 },
  { id: "office_s", name: "مكاتب صغير", count: 49, area: 1200, color: "#10b981", defaultPrice: 1900 },
  { id: "office_m", name: "مكاتب متوسط", count: 51, area: 2000, color: "#14b8a6", defaultPrice: 1800 },
  { id: "office_l", name: "مكاتب كبير", count: 20, area: 3500, color: "#06b6d4", defaultPrice: 1700 },
];

const TOTAL_UNITS = UNIT_TYPES.reduce((s, u) => s + u.count, 0);

const MARKETING_CHANNELS = [
  { id: "digital", name: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والعلامة", defaultPct: 5, color: "#06b6d4" },
];

const PROJECT_PHASES = [
  { id: "design", name: "التصميم المعماري", color: "#3b82f6", icon: Palette },
  { id: "materials", name: "تحضير مواد التسويق", color: "#f59e0b", icon: Rocket },
  { id: "rera", name: "ريرا + اعتمادات البيع", color: "#8b5cf6", icon: FileCheck },
  { id: "marketing", name: "إطلاق التسويق", color: "#ec4899", icon: Megaphone },
  { id: "sales", name: "بدء المبيعات", color: "#10b981", icon: Target },
  { id: "construction", name: "الإنشاء", color: "#64748b", icon: HardHat },
];

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
}

function fmtFull(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // ─── State: Pricing ───────────────────────────────────────────────────────
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(UNIT_TYPES.map((u) => [u.id, u.defaultPrice]))
  );

  // ─── State: Timeline ──────────────────────────────────────────────────────
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [marketingPrepLead, setMarketingPrepLead] = useState(3); // months before design end
  const [reraLead, setReraLead] = useState(2); // months before sales start

  // Computed timeline
  const timeline = useMemo(() => {
    const designEnd = designMonths;
    const materialsStart = Math.max(1, designEnd - marketingPrepLead);
    const salesStart = designEnd - 1; // one month before design end
    const reraStart = Math.max(1, salesStart - reraLead);
    const marketingStart = Math.max(1, materialsStart + 1);
    const constructionStart = designEnd + 1;
    const projectEnd = constructionStart + constructionMonths - 1;
    return { designEnd, materialsStart, reraStart, marketingStart, salesStart, constructionStart, projectEnd };
  }, [designMonths, constructionMonths, marketingPrepLead, reraLead]);

  const salesMonths = timeline.projectEnd - timeline.salesStart + 1;

  // ─── State: Costs ─────────────────────────────────────────────────────────
  const [marketingPct, setMarketingPct] = useState(2);
  const [commissionPct, setCommissionPct] = useState(5);
  const [materialsCost, setMaterialsCost] = useState(2); // in millions
  const [channelPcts, setChannelPcts] = useState<Record<string, number>>(
    Object.fromEntries(MARKETING_CHANNELS.map((c) => [c.id, c.defaultPct]))
  );

  // ─── State: Sales Curve ───────────────────────────────────────────────────
  const [salesMode, setSalesMode] = useState<"auto" | "manual" | "detail">("auto");
  const [offPlan, setOffPlan] = useState(80);
  const [speed, setSpeed] = useState(50);
  const [curveTemplate, setCurveTemplate] = useState<"bell" | "fast" | "gradual" | "late">("bell");
  const [manualUnits, setManualUnits] = useState<number[]>([]);

  // ─── Computed: Revenue ────────────────────────────────────────────────────
  const unitRevenues = useMemo(
    () => UNIT_TYPES.map((u) => ({
      ...u,
      total: u.count * u.area * prices[u.id],
      totalArea: u.count * u.area,
    })),
    [prices]
  );

  const totalRevenue = unitRevenues.reduce((s, u) => s + u.total, 0);
  const totalArea = unitRevenues.reduce((s, u) => s + u.totalArea, 0);

  // ─── Computed: Costs ──────────────────────────────────────────────────────
  const constructionCost = totalArea * 400; // 400 AED/sqft
  const marketingCost = totalRevenue * (marketingPct / 100);
  const commissionCost = totalRevenue * (commissionPct / 100);
  const materialsTotal = materialsCost * 1e6;
  const totalCosts = constructionCost + marketingCost + commissionCost + materialsTotal;
  const profit = totalRevenue - totalCosts;
  const roiCapital = ((profit / constructionCost) * 100).toFixed(0);
  const roiCosts = ((profit / totalCosts) * 100).toFixed(0);

  // ─── Computed: Sales Distribution ─────────────────────────────────────────
  const offPlanUnits = Math.round((TOTAL_UNITS * offPlan) / 100);

  const salesDistribution = useMemo(() => {
    if (salesMode === "manual" && manualUnits.length === salesMonths) {
      return manualUnits;
    }
    const n = salesMonths;
    if (n <= 0) return [];

    let raw: number[];
    if (curveTemplate === "fast") {
      raw = Array.from({ length: n }, (_, i) => Math.exp(-i / (n * 0.3)));
    } else if (curveTemplate === "gradual") {
      raw = Array.from({ length: n }, (_, i) => 1 + i * 0.5);
    } else if (curveTemplate === "late") {
      raw = Array.from({ length: n }, (_, i) => Math.exp(-(n - 1 - i) / (n * 0.3)));
    } else {
      // bell curve with speed factor
      const mid = n * (1 - speed / 100) + (n / 2) * (speed / 100);
      const sigma = n / (3 + (speed / 100) * 3);
      raw = Array.from({ length: n }, (_, i) =>
        Math.exp(-0.5 * Math.pow((i - mid + n / 2) / sigma, 2))
      );
    }

    const sum = raw.reduce((a, b) => a + b, 0);
    const scaled = raw.map((v) => Math.max(1, Math.round((v / sum) * offPlanUnits)));
    const diff = offPlanUnits - scaled.reduce((a, b) => a + b, 0);
    if (diff !== 0) scaled[Math.floor(n / 2)] += diff;
    return scaled;
  }, [salesMonths, offPlanUnits, speed, salesMode, manualUnits, curveTemplate]);

  const totalSold = salesDistribution.reduce((a, b) => a + b, 0);
  const avgUnitPrice = TOTAL_UNITS > 0 ? totalRevenue / TOTAL_UNITS : 0;

  // ─── Computed: Escrow ─────────────────────────────────────────────────────
  const escrowInitial = constructionCost * 0.2;
  const monthlySiphon = salesMonths > 0 ? constructionCost / salesMonths : 0;

  const escrowData = useMemo(() => {
    let balance = escrowInitial;
    return salesDistribution.map((units, i) => {
      const income = units * avgUnitPrice * 0.8 * 0.3; // 80% escrow share, 30% first payment
      const withdrawal = monthlySiphon;
      balance = balance + income - withdrawal;
      const pct = constructionCost > 0 ? (balance / constructionCost) * 100 : 0;
      return { month: i + timeline.salesStart, units, income, withdrawal, balance, pct };
    });
  }, [salesDistribution, escrowInitial, avgUnitPrice, monthlySiphon, timeline.salesStart, constructionCost]);

  const maxDeficit = escrowData.length > 0 ? Math.min(...escrowData.map((d) => d.balance)) : 0;
  const hasDeficit = maxDeficit < 0;
  const deficitMonths = escrowData.filter((d) => d.balance < 0).length;
  const totalEscrowIn = escrowData.reduce((s, d) => s + d.income, 0);
  const totalEscrowOut = escrowData.reduce((s, d) => s + d.withdrawal, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-200">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">غرفة عمليات المبيعات</h1>
              <p className="text-[10px] text-gray-500">مجان — G+4P+25 • أداة قرار تفاعلية لوائل</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Timeline badges */}
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-[10px]">
              <Calendar className="w-3 h-3" />
              مبيعات: شهر {timeline.salesStart} → {timeline.projectEnd}
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1 text-[10px]">
              {salesMonths} شهر بيع
            </Badge>
            {/* Status indicator */}
            {hasDeficit ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-700">عجز {fmt(Math.abs(maxDeficit))}</span>
                <span className="text-[9px] text-red-400">({deficitMonths} شهر)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700">الضمان آمن</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-5 py-4 space-y-4">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: UNIT PRICING TABLE                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-indigo-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">تسعير الوحدات</h2>
              <span className="text-[9px] text-gray-400 mr-2">{TOTAL_UNITS} وحدة • {fmtFull(totalArea)} قدم²</span>
            </div>
            <div className="text-xs font-bold text-indigo-600">
              إجمالي الإيرادات: {fmt(totalRevenue)} AED
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-[10px]">
                  <th className="py-1.5 px-3 text-right font-medium">النوع</th>
                  <th className="py-1.5 px-2 text-center font-medium w-12">العدد</th>
                  <th className="py-1.5 px-2 text-center font-medium w-20">مساحة الوحدة</th>
                  <th className="py-1.5 px-2 text-center font-medium w-24">المساحة الكلية</th>
                  <th className="py-1.5 px-2 text-center font-medium" style={{ width: 260 }}>السعر / قدم²</th>
                  <th className="py-1.5 px-2 text-center font-medium w-24">إجمالي النوع</th>
                  <th className="py-1.5 px-2 text-center font-medium w-14">النسبة</th>
                  <th className="py-1.5 px-2 text-center font-medium w-28">المساهمة</th>
                </tr>
              </thead>
              <tbody>
                {unitRevenues.map((u) => {
                  const pct = totalRevenue > 0 ? ((u.total / totalRevenue) * 100).toFixed(0) : "0";
                  if (u.count === 0) return null;
                  return (
                    <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-[5px] px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                          <span className="font-medium text-gray-700">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-[5px] px-2 text-center font-bold text-gray-800">{u.count}</td>
                      <td className="py-[5px] px-2 text-center text-gray-500">{fmtFull(u.area)}</td>
                      <td className="py-[5px] px-2 text-center font-medium text-gray-600">{fmtFull(u.totalArea)}</td>
                      <td className="py-[5px] px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={800}
                            max={4000}
                            step={50}
                            value={prices[u.id]}
                            onChange={(e) => setPrices((p) => ({ ...p, [u.id]: +e.target.value }))}
                            className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                          />
                          <span className="w-12 text-center font-bold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 text-[10px]">
                            {prices[u.id]}
                          </span>
                        </div>
                      </td>
                      <td className="py-[5px] px-2 text-center font-bold text-gray-800">{fmt(u.total)}</td>
                      <td className="py-[5px] px-2 text-center text-gray-500">{pct}%</td>
                      <td className="py-[5px] px-2">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: u.color }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                  <td className="py-2 px-3 text-gray-700">الإجمالي</td>
                  <td className="py-2 px-2 text-center text-gray-800">{TOTAL_UNITS}</td>
                  <td className="py-2 px-2 text-center text-gray-400">—</td>
                  <td className="py-2 px-2 text-center text-gray-700">{fmtFull(totalArea)}</td>
                  <td className="py-2 px-2 text-center text-gray-400">—</td>
                  <td className="py-2 px-2 text-center text-indigo-600">{fmt(totalRevenue)}</td>
                  <td className="py-2 px-2 text-center">100%</td>
                  <td className="py-2 px-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: FINANCIAL SUMMARY (5 KPI Cards)                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-[9px] text-blue-600">إجمالي الإيرادات</p>
            </div>
            <p className="text-lg font-black text-blue-700">{fmt(totalRevenue)}</p>
            <p className="text-[8px] text-gray-400">{fmtFull(totalRevenue)} AED</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-orange-100 flex items-center justify-center">
                <Building2 className="w-3 h-3 text-orange-600" />
              </div>
              <p className="text-[9px] text-orange-600">إجمالي التكاليف</p>
            </div>
            <p className="text-lg font-black text-orange-700">{fmt(totalCosts)}</p>
            <p className="text-[8px] text-gray-400">{fmtFull(totalCosts)} AED</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              </div>
              <p className="text-[9px] text-emerald-600">صافي الأرباح</p>
            </div>
            <p className={`text-lg font-black ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(profit)}</p>
            <p className="text-[8px] text-gray-400">{fmtFull(profit)} AED</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-purple-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-purple-600" />
              </div>
              <p className="text-[9px] text-purple-600">ربح ÷ رأس المال</p>
            </div>
            <p className="text-lg font-black text-purple-700">{roiCapital}%</p>
            <p className="text-[8px] text-gray-400">العائد على الاستثمار</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-pink-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-pink-100 flex items-center justify-center">
                <Zap className="w-3 h-3 text-pink-600" />
              </div>
              <p className="text-[9px] text-pink-600">ربح ÷ التكاليف</p>
            </div>
            <p className="text-lg font-black text-pink-700">{roiCosts}%</p>
            <p className="text-[8px] text-gray-400">هامش الربح</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: OPERATION COSTS + MARKETING DISTRIBUTION                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-12 gap-3">
          {/* Cost Controls */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                <Megaphone className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">تكاليف العملية</h2>
            </div>
            <div className="space-y-3">
              {/* Marketing % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">ميزانية التسويق</span>
                  <span className="text-[10px] font-bold text-amber-600">{fmt(marketingCost)} AED</span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[marketingPct]}
                    onValueChange={([v]) => setMarketingPct(v)}
                    min={0}
                    max={5}
                    step={0.5}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="font-mono min-w-[40px] justify-center text-[10px]">{marketingPct}%</Badge>
                </div>
              </div>
              {/* Commission % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">عمولة المبيعات</span>
                  <span className="text-[10px] font-bold text-violet-600">{fmt(commissionCost)} AED</span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[commissionPct]}
                    onValueChange={([v]) => setCommissionPct(v)}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="font-mono min-w-[40px] justify-center text-[10px]">{commissionPct}%</Badge>
                </div>
              </div>
              {/* Materials */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">مواد التسويق</span>
                  <span className="text-[10px] font-bold text-rose-600">{fmt(materialsTotal)} AED</span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[materialsCost]}
                    onValueChange={([v]) => setMaterialsCost(v)}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="font-mono min-w-[40px] justify-center text-[10px]">{materialsCost}M</Badge>
                </div>
              </div>
              {/* Cost breakdown bar */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-gray-400 rounded-full" style={{ width: `${(constructionCost / totalCosts) * 100}%` }} title="إنشاء" />
                  <div className="bg-amber-400 rounded-full" style={{ width: `${(marketingCost / totalCosts) * 100}%` }} title="تسويق" />
                  <div className="bg-violet-400 rounded-full" style={{ width: `${(commissionCost / totalCosts) * 100}%` }} title="عمولة" />
                  <div className="bg-rose-400 rounded-full" style={{ width: `${(materialsTotal / totalCosts) * 100}%` }} title="مواد" />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />إنشاء {((constructionCost / totalCosts) * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />تسويق {((marketingCost / totalCosts) * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" />عمولة {((commissionCost / totalCosts) * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />مواد {((materialsTotal / totalCosts) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Marketing Distribution */}
          <div className="col-span-7 bg-white rounded-xl border border-gray-100 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">توزيع ميزانية التسويق</h2>
              <span className="text-[9px] text-gray-400 mr-2">الإجمالي: {fmt(marketingCost)}</span>
            </div>
            <div className="space-y-2">
              {MARKETING_CHANNELS.map((ch) => {
                const amount = marketingCost * (channelPcts[ch.id] / 100);
                return (
                  <div key={ch.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                    <span className="text-[10px] text-gray-600 w-28 flex-shrink-0">{ch.name}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <Slider
                        value={[channelPcts[ch.id]]}
                        onValueChange={([v]) => setChannelPcts((p) => ({ ...p, [ch.id]: v }))}
                        min={0}
                        max={60}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-[10px] font-bold w-8 text-center" style={{ color: ch.color }}>{channelPcts[ch.id]}%</span>
                      <span className="text-[9px] text-gray-400 w-14 text-left">{fmt(amount)}</span>
                    </div>
                  </div>
                );
              })}
              {/* Visual bar */}
              <div className="flex h-4 rounded-lg overflow-hidden mt-2">
                {MARKETING_CHANNELS.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-center text-[8px] text-white font-bold transition-all duration-300"
                    style={{ width: `${channelPcts[ch.id]}%`, backgroundColor: ch.color }}
                  >
                    {channelPcts[ch.id] >= 10 ? `${channelPcts[ch.id]}%` : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: PROJECT PHASES TIMELINE (Gantt Mini)                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-purple-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">الجدول الزمني للمراحل</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-gray-400">تصاميم:</span>
                <input type="number" min={4} max={24} value={designMonths}
                  onChange={(e) => setDesignMonths(Math.max(4, +e.target.value))}
                  className="w-10 text-center text-[10px] border border-gray-200 rounded py-0.5 focus:ring-1 focus:ring-purple-200 outline-none font-bold text-purple-700" />
                <span className="text-gray-400">شهر</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-gray-400">بناء:</span>
                <input type="number" min={12} max={60} value={constructionMonths}
                  onChange={(e) => setConstructionMonths(Math.max(12, +e.target.value))}
                  className="w-10 text-center text-[10px] border border-gray-200 rounded py-0.5 focus:ring-1 focus:ring-emerald-200 outline-none font-bold text-emerald-700" />
                <span className="text-gray-400">شهر</span>
              </div>
            </div>
          </div>
          <div className="p-4">
            {(() => {
              const totalProjectMonths = timeline.projectEnd;
              const phases = [
                { name: "التصميم", start: 1, end: timeline.designEnd, color: "#3b82f6" },
                { name: "تحضير مواد التسويق", start: timeline.materialsStart, end: timeline.designEnd, color: "#f59e0b" },
                { name: "ريرا + اعتمادات", start: timeline.reraStart, end: timeline.salesStart, color: "#8b5cf6" },
                { name: "التسويق", start: timeline.marketingStart, end: timeline.projectEnd, color: "#ec4899" },
                { name: "المبيعات", start: timeline.salesStart, end: timeline.projectEnd, color: "#10b981" },
                { name: "الإنشاء", start: timeline.constructionStart, end: timeline.projectEnd, color: "#64748b" },
              ];
              return (
                <div className="space-y-1.5">
                  {/* Month scale */}
                  <div className="flex items-center mr-28">
                    <div className="flex-1 flex">
                      {Array.from({ length: Math.min(totalProjectMonths, 40) }, (_, i) => (
                        <div key={i} className="flex-1 text-center text-[8px] text-gray-300">
                          {(i + 1) % 5 === 0 ? i + 1 : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Phase bars */}
                  {phases.map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-28 text-left flex-shrink-0 truncate">{phase.name}</span>
                      <div className="flex-1 relative h-5 bg-gray-50 rounded">
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded-full flex items-center justify-center text-[8px] text-white font-bold transition-all duration-300"
                          style={{
                            right: `${((phase.start - 1) / totalProjectMonths) * 100}%`,
                            width: `${((phase.end - phase.start + 1) / totalProjectMonths) * 100}%`,
                            backgroundColor: phase.color,
                          }}
                        >
                          {phase.end - phase.start + 1 > 3 ? `${phase.start}→${phase.end}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Dependency note */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] text-amber-600">
                      تأخير تحضير المواد يؤخر التسويق → يؤخر المبيعات → يزيد عجز الضمان
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5: SALES CURVE                                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">منحنى المبيعات</h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] mr-2">
                {totalSold} / {TOTAL_UNITS} وحدة ({Math.round((totalSold / TOTAL_UNITS) * 100)}%)
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {/* Off-plan slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-400">أوف بلان:</span>
                <Slider
                  value={[offPlan]}
                  onValueChange={([v]) => setOffPlan(v)}
                  min={50}
                  max={100}
                  step={5}
                  className="w-20"
                />
                <Badge variant="secondary" className="font-mono text-[9px] min-w-[32px] justify-center">{offPlan}%</Badge>
              </div>
              {/* Mode tabs */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(["auto", "manual", "detail"] as const).map((m) => (
                  <button key={m} onClick={() => setSalesMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      salesMode === m ? "bg-white shadow-sm text-emerald-700" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* AUTO MODE */}
            {salesMode === "auto" && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  {/* Template selector */}
                  <div className="flex items-center gap-1.5">
                    {(["bell", "fast", "gradual", "late"] as const).map((t) => (
                      <button key={t} onClick={() => setCurveTemplate(t)}
                        className={`px-2 py-1 rounded-md text-[10px] border transition-all ${
                          curveTemplate === t
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        {t === "bell" ? "جرس" : t === "fast" ? "سريع" : t === "gradual" ? "تدريجي" : "متأخر"}
                      </button>
                    ))}
                  </div>
                  {/* Speed slider */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-gray-400">السرعة:</span>
                    <Slider
                      value={[speed]}
                      onValueChange={([v]) => setSpeed(v)}
                      min={10}
                      max={90}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {speed < 33 ? "بطيء" : speed < 66 ? "متوسط" : "سريع"}
                    </span>
                  </div>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-[2px] h-20 px-1 bg-gray-50/50 rounded-lg py-2">
                  {salesDistribution.map((units, i) => {
                    const maxU = Math.max(...salesDistribution, 1);
                    const h = (units / maxU) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          className="w-full rounded-t transition-all duration-300"
                          style={{
                            height: `${h}%`,
                            backgroundColor: escrowData[i]?.balance < 0 ? "#f87171" : "#34d399",
                            minHeight: "2px",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 px-1">
                  <span>شهر {timeline.salesStart}</span>
                  <span>شهر {timeline.projectEnd}</span>
                </div>
              </div>
            )}

            {/* MANUAL MODE */}
            {salesMode === "manual" && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-gray-500">أدخل عدد الوحدات لكل شهر</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
                    {totalSold} / {offPlanUnits} وحدة
                  </Badge>
                  {totalSold > offPlanUnits && (
                    <Badge variant="destructive" className="text-[9px]">تجاوز!</Badge>
                  )}
                </div>
                <div className="grid grid-cols-10 gap-1.5 max-h-48 overflow-y-auto">
                  {Array.from({ length: salesMonths }, (_, i) => {
                    const val = manualUnits[i] ?? salesDistribution[i] ?? 0;
                    const pct = TOTAL_UNITS > 0 ? ((val / TOTAL_UNITS) * 100).toFixed(0) : "0";
                    return (
                      <div key={i} className="flex flex-col items-center bg-gray-50 rounded-lg p-1">
                        <span className="text-[8px] text-gray-400 mb-0.5">شهر {i + timeline.salesStart}</span>
                        <input
                          type="number" min={0} max={50} value={val}
                          onChange={(e) => {
                            const arr = [...(manualUnits.length === salesMonths ? manualUnits : salesDistribution)];
                            arr[i] = Math.max(0, +e.target.value);
                            setManualUnits(arr);
                          }}
                          className="w-full text-center text-[11px] font-bold border border-gray-200 rounded py-0.5 focus:ring-1 focus:ring-emerald-200 outline-none bg-white"
                        />
                        <span className="text-[9px] text-emerald-600 font-medium mt-0.5">{val}/{TOTAL_UNITS}</span>
                        <span className="text-[8px] text-gray-400">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DETAIL MODE */}
            {salesMode === "detail" && (
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400">مصفوفة: نوع الوحدة × الشهر</p>
                <div className="overflow-x-auto max-h-56">
                  <table className="text-[9px] w-full">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-gray-400">
                        <th className="py-1 px-2 text-right sticky right-0 bg-white z-20 w-24 border-b border-gray-100">النوع</th>
                        {Array.from({ length: Math.min(salesMonths, 36) }, (_, i) => (
                          <th key={i} className="py-1 px-0.5 text-center w-7 border-b border-gray-100">{i + timeline.salesStart}</th>
                        ))}
                        <th className="py-1 px-2 text-center border-b border-gray-100">Σ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {UNIT_TYPES.filter(u => u.count > 0).map((u) => (
                        <tr key={u.id} className="border-t border-gray-50">
                          <td className="py-0.5 px-2 sticky right-0 bg-white z-10">
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.color }} />
                              <span className="font-medium text-gray-700 truncate">{u.name}</span>
                              <span className="text-gray-300">({u.count})</span>
                            </div>
                          </td>
                          {Array.from({ length: Math.min(salesMonths, 36) }, (_, i) => {
                            const val = TOTAL_UNITS > 0 ? Math.round(salesDistribution[i] * (u.count / TOTAL_UNITS)) : 0;
                            return (
                              <td key={i} className="py-0.5 px-0.5 text-center text-gray-600">
                                {val > 0 ? val : <span className="text-gray-200">·</span>}
                              </td>
                            );
                          })}
                          <td className="py-0.5 px-2 text-center font-bold text-gray-700">
                            {Math.round(totalSold * (u.count / TOTAL_UNITS))}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-200 font-bold bg-gray-50">
                        <td className="py-1 px-2 sticky right-0 bg-gray-50 z-10 text-gray-700">المجموع</td>
                        {Array.from({ length: Math.min(salesMonths, 36) }, (_, i) => (
                          <td key={i} className="py-1 px-0.5 text-center text-gray-800">{salesDistribution[i] ?? 0}</td>
                        ))}
                        <td className="py-1 px-2 text-center text-emerald-700">{totalSold}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 6: ESCROW IMPACT                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-teal-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <h2 className="text-xs font-bold text-gray-800">تأثير على حساب الضمان (الإسكرو)</h2>
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[9px] mr-2">
                يبدأ بـ {fmt(escrowInitial)} (20% من الإنشاء)
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-gray-400">دخول: <b className="text-emerald-600">{fmt(totalEscrowIn)}</b></span>
              <span className="text-gray-400">سحب: <b className="text-red-500">{fmt(totalEscrowOut)}</b></span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-12 gap-4">
            {/* Chart - wider */}
            <div className="col-span-8">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={escrowData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    formatter={(value: number) => [fmtFull(value) + " AED", "الرصيد"]}
                    labelFormatter={(label) => `شهر ${label}`}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Bar dataKey="balance" radius={[3, 3, 0, 0]}>
                    {escrowData.map((entry, index) => (
                      <Cell key={index} fill={entry.balance >= 0 ? "#34d399" : "#f87171"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Numbers below chart */}
              <div className="flex gap-[1px] px-2 mt-1">
                {escrowData.map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <p className={`text-[7px] font-bold leading-tight ${d.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {fmt(d.balance)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Table - compact */}
            <div className="col-span-4 overflow-y-auto max-h-60 border border-gray-100 rounded-xl">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-gray-400">
                    <th className="py-1.5 px-1.5 text-center">الشهر</th>
                    <th className="py-1.5 px-1 text-center">وحدات</th>
                    <th className="py-1.5 px-1 text-center text-emerald-500">دخول</th>
                    <th className="py-1.5 px-1 text-center text-red-400">سحب</th>
                    <th className="py-1.5 px-1 text-center">الرصيد</th>
                    <th className="py-1.5 px-1 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {escrowData.map((d) => (
                    <tr key={d.month} className={`border-t border-gray-50 ${d.balance < 0 ? "bg-red-50/30" : ""}`}>
                      <td className="py-[3px] px-1.5 text-center font-medium text-gray-600">{d.month}</td>
                      <td className="py-[3px] px-1 text-center text-gray-700">{d.units}</td>
                      <td className="py-[3px] px-1 text-center text-emerald-600 font-medium">{fmt(d.income)}</td>
                      <td className="py-[3px] px-1 text-center text-red-400">{fmt(d.withdrawal)}</td>
                      <td className={`py-[3px] px-1 text-center font-bold ${d.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(d.balance)}
                      </td>
                      <td className="py-[3px] px-1 text-center">
                        {d.balance < 0 ? (
                          <span className="text-[8px] text-red-500 font-bold">⚠️</span>
                        ) : (
                          <span className="text-[8px] text-emerald-500">{d.pct.toFixed(0)}%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
