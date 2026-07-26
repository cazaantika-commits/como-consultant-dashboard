import { useState, useMemo } from "react";
import {
  ArrowRight, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Zap, Shield, DollarSign, BarChart3, Sliders, Target, Activity
} from "lucide-react";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════════════════════════════
   COMO — Sales Operations Room (Premium Interactive Dashboard)
   وائل يغيّر المدخلات ← يرى الأثر فوراً
   ═══════════════════════════════════════════════════════════════ */

// ─── Data Constants ───
const UNIT_TYPES = [
  { id: "studio", name: "استوديو", area: 400, count: 50, color: "#6366f1" },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80, color: "#8b5cf6" },
  { id: "2br", name: "غرفتين وصالة", area: 1050, count: 60, color: "#a855f7" },
  { id: "3br", name: "ثلاث غرف", area: 1400, count: 30, color: "#d946ef" },
  { id: "retail", name: "محلات", area: 600, count: 15, color: "#f59e0b" },
  { id: "office", name: "مكاتب", area: 900, count: 20, color: "#10b981" },
];

const PAYMENT_PLAN = [
  { name: "حجز", pct: 10 },
  { name: "أولى", pct: 10 },
  { name: "بناء 1", pct: 15 },
  { name: "بناء 2", pct: 15 },
  { name: "بناء 3", pct: 15 },
  { name: "تسليم", pct: 35 },
];

const MONTHS = 30;

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // ─── Interactive Inputs (Wael changes these) ───
  const [prices, setPrices] = useState<Record<string, number>>({
    studio: 1350, "1br": 1250, "2br": 1200, "3br": 1150, retail: 1800, office: 1400,
  });
  const [offPlan, setOffPlan] = useState(75);
  const [salesSpeed, setSalesSpeed] = useState(50); // 0=slow, 100=fast
  const [marketingPct, setMarketingPct] = useState(2);
  const [commissionPct, setCommissionPct] = useState(5);

  // ─── Computed Results (React to inputs) ───
  const results = useMemo(() => {
    // Total revenue
    const revenue = UNIT_TYPES.reduce((sum, u) => sum + (prices[u.id] || 0) * u.area * u.count, 0);
    
    // Off-plan revenue
    const offPlanRevenue = revenue * (offPlan / 100);
    const postCompletionRevenue = revenue - offPlanRevenue;
    
    // Escrow (80% of off-plan goes to escrow)
    const escrowInflow = offPlanRevenue * 0.8;
    const directRevenue = offPlanRevenue * 0.2;
    
    // Costs
    const marketingCost = revenue * (marketingPct / 100);
    const commissionCost = revenue * (commissionPct / 100);
    const totalSalesCost = marketingCost + commissionCost + 850000;
    
    // Construction cost (dummy: 70% of revenue)
    const constructionCost = revenue * 0.70;
    const profit = revenue - constructionCost - totalSalesCost;
    const roi = constructionCost > 0 ? ((profit / constructionCost) * 100) : 0;
    
    // Peak capital (simplified)
    const peakCapital = constructionCost * 0.35;
    
    // Escrow balance simulation
    const speedFactor = salesSpeed / 100;
    const monthlyEscrow: number[] = [];
    let cumulativeIn = 0;
    let cumulativeOut = 0;
    
    for (let m = 0; m < MONTHS; m++) {
      // Sales distribution based on speed
      const salesPct = speedFactor > 0.5
        ? (m < 10 ? 0.07 : 0.02)
        : (m < 10 ? 0.02 : 0.05);
      cumulativeIn += escrowInflow * salesPct;
      
      // Construction draws (linear)
      cumulativeOut += constructionCost / MONTHS;
      
      monthlyEscrow.push(cumulativeIn - cumulativeOut);
    }
    
    const minEscrow = Math.min(...monthlyEscrow);
    const hasDeficit = minEscrow < 0;
    const deficitAmount = hasDeficit ? Math.abs(minEscrow) : 0;
    const deficitMonth = hasDeficit ? monthlyEscrow.findIndex(v => v < 0) + 1 : 0;
    
    return {
      revenue, offPlanRevenue, postCompletionRevenue,
      escrowInflow, directRevenue,
      marketingCost, commissionCost, totalSalesCost,
      profit, roi, peakCapital,
      monthlyEscrow, hasDeficit, deficitAmount, deficitMonth,
    };
  }, [prices, offPlan, salesSpeed, marketingPct, commissionPct]);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return n.toFixed(0);
  };

  return (
    <div className="min-h-screen bg-[#0f1629] text-white" dir="rtl">
      
      {/* ═══ Top Bar ═══ */}
      <div className="bg-gradient-to-l from-[#1a1f3a] to-[#0f1629] border-b border-white/10 px-6 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/v2")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10">
              <ArrowRight className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h1 className="text-lg font-bold bg-gradient-to-l from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  غرفة عمليات المبيعات
                </h1>
              </div>
              <p className="text-xs text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-gradient-to-l from-indigo-600/30 to-purple-600/30 border border-indigo-500/30">
              <span className="text-xs text-indigo-300">وائل — مدير المبيعات</span>
            </div>
            <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${results.hasDeficit ? "bg-red-500/20 border border-red-500/40" : "bg-emerald-500/20 border border-emerald-500/40"}`}>
              {results.hasDeficit ? <AlertTriangle className="w-3 h-3 text-red-400" /> : <Shield className="w-3 h-3 text-emerald-400" />}
              <span className={`text-xs font-bold ${results.hasDeficit ? "text-red-400" : "text-emerald-400"}`}>
                {results.hasDeficit ? `عجز ضمان: ${fmt(results.deficitAmount)}` : "الضمان متوازن"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4">
        <div className="grid grid-cols-12 gap-4">

          {/* ═══════════════════════════════════════════
              LEFT PANEL — Controls (Wael's Inputs)
              ═══════════════════════════════════════════ */}
          <div className="col-span-4 space-y-4">

            {/* ─── Pricing Controls ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">تسعير الوحدات</h3>
                  <p className="text-[10px] text-gray-500">سعر القدم المربع — غيّر وشاهد الأثر</p>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {UNIT_TYPES.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-2 group">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: unit.color }} />
                    <span className="text-xs text-gray-400 w-20 truncate">{unit.name}</span>
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min={800}
                        max={2500}
                        step={50}
                        value={prices[unit.id]}
                        onChange={(e) => setPrices(p => ({ ...p, [unit.id]: +e.target.value }))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/50 [&::-webkit-slider-thumb]:cursor-grab"
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-300 w-14 text-left">{prices[unit.id]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Sales Strategy Controls ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">استراتيجية البيع</h3>
                  <p className="text-[10px] text-gray-500">حرّك المؤشرات وراقب التأثير</p>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Off-plan % */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">نسبة البيع أوف بلان</span>
                    <span className="text-xs font-bold text-purple-300">{offPlan}%</span>
                  </div>
                  <input
                    type="range" min={30} max={100} value={offPlan}
                    onChange={(e) => setOffPlan(+e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/50 [&::-webkit-slider-thumb]:cursor-grab"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>30%</span><span>100%</span>
                  </div>
                </div>

                {/* Sales Speed */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">سرعة المبيعات</span>
                    <span className="text-xs font-bold text-amber-300">{salesSpeed < 30 ? "بطيء" : salesSpeed < 70 ? "متوسط" : "سريع"}</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={salesSpeed}
                    onChange={(e) => setSalesSpeed(+e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-amber-500/50 [&::-webkit-slider-thumb]:cursor-grab"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>بطيء</span><span>سريع</span>
                  </div>
                </div>

                {/* Marketing & Commission */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-gray-400">تسويق</span>
                      <span className="text-[10px] font-bold text-cyan-300">{marketingPct}%</span>
                    </div>
                    <input
                      type="range" min={0} max={8} step={0.5} value={marketingPct}
                      onChange={(e) => setMarketingPct(+e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-gray-400">عمولة</span>
                      <span className="text-[10px] font-bold text-rose-300">{commissionPct}%</span>
                    </div>
                    <input
                      type="range" min={0} max={10} step={0.5} value={commissionPct}
                      onChange={(e) => setCommissionPct(+e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Payment Plan (Display) ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">خطة الدفع</h3>
              </div>
              <div className="p-3">
                <div className="flex gap-1">
                  {PAYMENT_PLAN.map((p, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div
                        className="rounded-md bg-gradient-to-t from-emerald-600/30 to-emerald-400/10 border border-emerald-500/20 mb-1 flex items-end justify-center"
                        style={{ height: `${p.pct * 1.5 + 20}px` }}
                      >
                        <span className="text-[10px] font-bold text-emerald-300 pb-1">{p.pct}%</span>
                      </div>
                      <span className="text-[8px] text-gray-500">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              RIGHT PANEL — Live Results (Impact)
              ═══════════════════════════════════════════ */}
          <div className="col-span-8 space-y-4">

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border border-emerald-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-emerald-400 to-emerald-600" />
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300/70">إجمالي الإيرادات</span>
                </div>
                <div className="text-2xl font-black text-emerald-300">{fmt(results.revenue)}</div>
                <div className="text-[9px] text-emerald-500/60 mt-1">من {UNIT_TYPES.reduce((a, b) => a + b.count, 0)} وحدة</div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-900/10 border border-blue-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-blue-400 to-blue-600" />
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] text-blue-300/70">صافي الربح</span>
                </div>
                <div className="text-2xl font-black text-blue-300">{fmt(results.profit)}</div>
                <div className="text-[9px] text-blue-500/60 mt-1">هامش: {((results.profit / results.revenue) * 100).toFixed(1)}%</div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-900/10 border border-purple-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-purple-400 to-purple-600" />
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] text-purple-300/70">عائد الاستثمار</span>
                </div>
                <div className="text-2xl font-black text-purple-300">{results.roi.toFixed(1)}%</div>
                <div className="text-[9px] text-purple-500/60 mt-1">على رأس المال</div>
              </div>

              <div className={`rounded-xl p-4 relative overflow-hidden border ${results.hasDeficit ? "bg-gradient-to-br from-red-600/20 to-red-900/10 border-red-500/30" : "bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border-emerald-500/30"}`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${results.hasDeficit ? "bg-gradient-to-l from-red-400 to-red-600 animate-pulse" : "bg-gradient-to-l from-emerald-400 to-emerald-600"}`} />
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 ${results.hasDeficit ? "text-red-400" : "text-emerald-400"}`} />
                  <span className={`text-[10px] ${results.hasDeficit ? "text-red-300/70" : "text-emerald-300/70"}`}>حساب الضمان</span>
                </div>
                {results.hasDeficit ? (
                  <>
                    <div className="text-2xl font-black text-red-300">-{fmt(results.deficitAmount)}</div>
                    <div className="text-[9px] text-red-500/60 mt-1">عجز يبدأ الشهر {results.deficitMonth}</div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-black text-emerald-300">متوازن</div>
                    <div className="text-[9px] text-emerald-500/60 mt-1">لا يوجد عجز</div>
                  </>
                )}
              </div>
            </div>

            {/* ─── Escrow Chart ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">رصيد الضمان الشهري</h3>
                    <p className="text-[9px] text-gray-500">الأثر المباشر لسرعة البيع على رصيد الضمان</p>
                  </div>
                </div>
                {results.hasDeficit && (
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-400">تحذير: عجز {fmt(results.deficitAmount)}</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-end gap-[3px] h-[140px] relative">
                  {/* Zero line */}
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/20 z-10" />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 z-20">0</div>
                  
                  {results.monthlyEscrow.map((val, i) => {
                    const maxAbs = Math.max(...results.monthlyEscrow.map(Math.abs), 1);
                    const heightPct = (Math.abs(val) / maxAbs) * 45;
                    const isNeg = val < 0;
                    return (
                      <div key={i} className="flex-1 relative h-full group cursor-pointer">
                        <div
                          className={`w-full rounded-sm transition-all group-hover:opacity-80 ${isNeg ? "bg-gradient-to-b from-red-500 to-red-700" : "bg-gradient-to-t from-emerald-600 to-emerald-400"}`}
                          style={{
                            height: `${heightPct}%`,
                            position: "absolute",
                            ...(isNeg ? { top: "50%" } : { bottom: "50%" }),
                          }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
                          <div className="bg-gray-900 border border-white/20 rounded px-2 py-1 text-[8px] whitespace-nowrap shadow-xl">
                            <div className="text-gray-400">شهر {i + 1}</div>
                            <div className={`font-bold ${isNeg ? "text-red-400" : "text-emerald-400"}`}>{fmt(val)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-gray-500 mt-2 px-1">
                  <span>الشهر 1</span>
                  <span>الشهر 15</span>
                  <span>الشهر 30</span>
                </div>
              </div>
            </div>

            {/* ─── Impact Flow (Cause → Effect) ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">أثر قراراتك على التدفقات</h3>
                  <p className="text-[9px] text-gray-500">كيف تتوزع الإيرادات بناءً على إعداداتك الحالية</p>
                </div>
              </div>
              <div className="p-4">
                {/* Flow visualization */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Source */}
                  <div className="text-center">
                    <div className="rounded-xl bg-gradient-to-b from-indigo-500/20 to-indigo-900/10 border border-indigo-500/30 p-3">
                      <div className="text-[9px] text-indigo-300/70 mb-1">إجمالي المبيعات</div>
                      <div className="text-xl font-black text-indigo-300">{fmt(results.revenue)}</div>
                    </div>
                    <div className="w-px h-4 bg-gradient-to-b from-indigo-500 to-transparent mx-auto" />
                  </div>
                  
                  {/* Split */}
                  <div className="space-y-2">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                      <div className="text-[8px] text-emerald-400/70">يدخل الضمان ({offPlan}% × 80%)</div>
                      <div className="text-base font-bold text-emerald-300">{fmt(results.escrowInflow)}</div>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center">
                      <div className="text-[8px] text-blue-400/70">إيرادات مباشرة ({offPlan}% × 20%)</div>
                      <div className="text-base font-bold text-blue-300">{fmt(results.directRevenue)}</div>
                    </div>
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-center">
                      <div className="text-[8px] text-purple-400/70">بعد الإنجاز ({100 - offPlan}%)</div>
                      <div className="text-base font-bold text-purple-300">{fmt(results.postCompletionRevenue)}</div>
                    </div>
                  </div>

                  {/* Costs */}
                  <div className="space-y-2">
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-center">
                      <div className="text-[8px] text-rose-400/70">تكلفة التسويق ({marketingPct}%)</div>
                      <div className="text-base font-bold text-rose-300">{fmt(results.marketingCost)}</div>
                    </div>
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-center">
                      <div className="text-[8px] text-orange-400/70">عمولة المبيعات ({commissionPct}%)</div>
                      <div className="text-base font-bold text-orange-300">{fmt(results.commissionCost)}</div>
                    </div>
                    <div className="rounded-lg bg-gray-500/10 border border-gray-500/20 p-2 text-center">
                      <div className="text-[8px] text-gray-400/70">إجمالي تكاليف البيع</div>
                      <div className="text-base font-bold text-gray-300">{fmt(results.totalSalesCost)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Revenue by Unit Type ─── */}
            <div className="rounded-xl bg-gradient-to-b from-[#1a2040] to-[#151b35] border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                </div>
                <h3 className="text-sm font-bold">مساهمة كل نوع في الإيرادات</h3>
              </div>
              <div className="p-4 space-y-2">
                {UNIT_TYPES.map((unit) => {
                  const unitRev = (prices[unit.id] || 0) * unit.area * unit.count;
                  const pct = (unitRev / results.revenue) * 100;
                  return (
                    <div key={unit.id} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: unit.color }} />
                      <span className="text-xs text-gray-400 w-24">{unit.name}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: unit.color }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-gray-300 w-16 text-left">{fmt(unitRev)}</span>
                      <span className="text-[10px] text-gray-500 w-10 text-left">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
