import { useState, useMemo } from "react";
import {
  ArrowRight, AlertTriangle, CheckCircle, TrendingUp,
  DollarSign, BarChart3, Sliders, Target, Zap, Calendar
} from "lucide-react";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════════════════════════
   غرفة عمليات المبيعات — وائل
   تصميم إبداعي: gradient + glassmorphism + compact
   المدة مرنة (salesStart → projectEnd)
   ═══════════════════════════════════════════════════════════ */

const UNITS = [
  { id: "studio", name: "استوديو", area: 400, count: 50, color: "#6366f1" },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80, color: "#8b5cf6" },
  { id: "2br", name: "غرفتين", area: 1050, count: 60, color: "#a855f7" },
  { id: "3br", name: "ثلاث غرف", area: 1400, count: 30, color: "#d946ef" },
  { id: "retail", name: "محلات", area: 600, count: 15, color: "#f59e0b" },
  { id: "office", name: "مكاتب", area: 900, count: 20, color: "#10b981" },
];
const TOTAL_UNITS = UNITS.reduce((s, u) => s + u.count, 0);

function bellCurve(months: number, speed: number): number[] {
  const peak = speed > 60 ? months * 0.25 : speed > 40 ? months * 0.5 : months * 0.75;
  const sigma = months * 0.25;
  const raw = Array.from({ length: months }, (_, i) => Math.exp(-0.5 * ((i - peak) / sigma) ** 2));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / sum);
}

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // ─── Timeline (مرن — سيأتي من فورمولات لاحقاً) ───
  const [salesStart, setSalesStart] = useState(1);
  const [projectEnd, setProjectEnd] = useState(30);
  const salesMonths = Math.max(1, projectEnd - salesStart + 1);

  // ─── Controls ───
  const [prices, setPrices] = useState<Record<string, number>>({
    studio: 1350, "1br": 1250, "2br": 1200, "3br": 1150, retail: 1800, office: 1400,
  });
  const [offPlan, setOffPlan] = useState(75);
  const [salesMode, setSalesMode] = useState<"auto" | "manual" | "detail">("auto");
  const [salesSpeed, setSalesSpeed] = useState(50);
  const [manualUnits, setManualUnits] = useState<number[]>(() => {
    const dist = bellCurve(30, 50);
    return dist.map(d => Math.round(d * TOTAL_UNITS * 0.75));
  });
  const [detailUnits, setDetailUnits] = useState<number[][]>(() =>
    UNITS.map(u => {
      const dist = bellCurve(30, 50);
      return dist.map(d => Math.round(d * u.count * 0.75));
    })
  );

  // ─── Computed ───
  const results = useMemo(() => {
    const revenue = UNITS.reduce((s, u) => s + (prices[u.id] || 0) * u.area * u.count, 0);

    let monthlySales: number[];
    if (salesMode === "auto") {
      const dist = bellCurve(salesMonths, salesSpeed);
      monthlySales = dist.map(d => Math.round(d * TOTAL_UNITS * (offPlan / 100)));
    } else if (salesMode === "manual") {
      monthlySales = manualUnits.slice(0, salesMonths);
    } else {
      monthlySales = Array(salesMonths).fill(0).map((_, m) => detailUnits.reduce((s, row) => s + (row[m] || 0), 0));
    }

    const avgUnitPrice = revenue / TOTAL_UNITS;
    const constructionCost = revenue * 0.70;
    const monthlyDraw = constructionCost / salesMonths;

    const escrowData = monthlySales.map((units, i) => {
      const salesRevenue = units * avgUnitPrice;
      const escrowIn = salesRevenue * 0.8;
      return { month: salesStart + i, units, escrowIn, escrowOut: monthlyDraw, balance: 0 };
    });

    let runningBalance = 0;
    escrowData.forEach(row => {
      runningBalance += row.escrowIn - row.escrowOut;
      row.balance = runningBalance;
    });

    const minBalance = Math.min(...escrowData.map(r => r.balance));
    const hasDeficit = minBalance < 0;
    const deficitAmount = hasDeficit ? Math.abs(minBalance) : 0;
    const totalSold = monthlySales.reduce((a, b) => a + b, 0);

    return { revenue, escrowData, hasDeficit, deficitAmount, totalSold, monthlySales, avgUnitPrice };
  }, [prices, offPlan, salesMode, salesSpeed, manualUnits, detailUnits, salesMonths, salesStart]);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return n.toFixed(0);
  };

  const updateManual = (i: number, val: number) => {
    const arr = [...manualUnits];
    arr[i] = Math.max(0, val);
    setManualUnits(arr);
  };

  const updateDetail = (unitIdx: number, monthIdx: number, val: number) => {
    const arr = detailUnits.map(r => [...r]);
    arr[unitIdx][monthIdx] = Math.max(0, val);
    setDetailUnits(arr);
  };

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 30%, #fff7ed 60%, #f0fdf4 100%)" }}>

      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/50 shadow-sm px-4 py-2">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-xl bg-white/80 hover:bg-white shadow-sm border border-gray-200/50 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-300" />
              <h1 className="text-sm font-black text-gray-800">غرفة عمليات المبيعات</h1>
              <span className="text-[10px] text-gray-400 bg-gray-100/80 px-2 py-0.5 rounded-full">مجان — G+4P+25</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">وائل — مدير المبيعات</span>
            <div className={`px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold shadow-sm ${results.hasDeficit ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
              {results.hasDeficit ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {results.hasDeficit ? `عجز: ${fmt(results.deficitAmount)}` : "متوازن ✓"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-3">
        <div className="grid grid-cols-12 gap-3">

          {/* ═══ LEFT — Controls ═══ */}
          <div className="col-span-4 space-y-3">

            {/* Timeline */}
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl border border-white/80 shadow-lg shadow-gray-200/30 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-100/50 flex items-center gap-2 bg-gradient-to-l from-blue-50/50 to-transparent">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-bold text-gray-700">نطاق المبيعات</span>
              </div>
              <div className="p-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-gray-400 block mb-0.5">بداية البيع (شهر)</label>
                  <input type="number" min={1} max={projectEnd - 1} value={salesStart}
                    onChange={e => setSalesStart(Math.max(1, +e.target.value))}
                    className="w-full h-6 text-[11px] text-center font-bold rounded-lg border border-gray-200/80 bg-white/80 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400 block mb-0.5">اكتمال المشروع (شهر)</label>
                  <input type="number" min={salesStart + 1} max={60} value={projectEnd}
                    onChange={e => setProjectEnd(Math.max(salesStart + 1, +e.target.value))}
                    className="w-full h-6 text-[11px] text-center font-bold rounded-lg border border-gray-200/80 bg-white/80 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[9px] text-blue-600 font-bold bg-blue-50/80 px-2 py-0.5 rounded-full">مدة البيع: {salesMonths} شهر</span>
                </div>
              </div>
            </div>

            {/* Sales Mode + Strategy — moved up */}
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl border border-white/80 shadow-lg shadow-gray-200/30 overflow-hidden">
              <div className="px-3 py-1 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-l from-amber-50/50 to-transparent">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold text-gray-700">منحنى المبيعات</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-purple-600 font-bold">أوف بلان: {offPlan}%</span>
                  <div className="flex gap-0.5 bg-white/80 rounded-full p-0.5 shadow-inner">
                    {(["auto", "manual", "detail"] as const).map(m => (
                      <button key={m} onClick={() => setSalesMode(m)}
                        className={`px-2 py-0.5 rounded-full text-[8px] font-bold transition-all ${salesMode === m ? "bg-amber-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1.5">
                {/* Off-plan slider */}
                <div className="flex items-center gap-2 h-5">
                  <span className="text-[9px] text-gray-500">نسبة أوف بلان</span>
                  <input
                    type="range" min={30} max={100} value={offPlan}
                    onChange={e => setOffPlan(+e.target.value)}
                    className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-purple-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                  />
                  <span className="text-[9px] font-black text-purple-600 w-7">{offPlan}%</span>
                </div>
                {salesMode === "auto" && (
                  <div className="flex items-center gap-2 h-5">
                    <span className="text-[9px] text-gray-500">سرعة البيع</span>
                    <input
                      type="range" min={0} max={100} value={salesSpeed}
                      onChange={e => setSalesSpeed(+e.target.value)}
                      className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-amber-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                    />
                    <span className="text-[8px] font-bold text-amber-600 w-10">{salesSpeed < 30 ? "بطيء" : salesSpeed < 70 ? "متوسط" : "سريع"}</span>
                  </div>
                )}
                {salesMode === "manual" && (
                  <div>
                    <div className="text-[8px] text-gray-500 mb-0.5">عدد الوحدات لكل شهر ({results.totalSold} / {TOTAL_UNITS})</div>
                    <div className="grid grid-cols-10 gap-0.5 max-h-[100px] overflow-y-auto">
                      {Array.from({ length: salesMonths }, (_, i) => (
                        <div key={i} className="text-center">
                          <div className="text-[7px] text-gray-400">{salesStart + i}</div>
                          <input
                            type="number" min={0} max={30} value={manualUnits[i] || 0}
                            onChange={e => updateManual(i, +e.target.value)}
                            className="w-full h-4 text-[8px] text-center border border-gray-200/80 rounded bg-white/80 focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {salesMode === "detail" && (
                  <div>
                    <div className="text-[8px] text-gray-500 mb-0.5">عدد الوحدات لكل نوع × شهر</div>
                    <div className="overflow-x-auto max-h-[130px] overflow-y-auto rounded-lg border border-gray-100/50">
                      <table className="w-full text-[7px]">
                        <thead className="sticky top-0 bg-white/90 backdrop-blur-sm">
                          <tr>
                            <th className="text-right text-gray-500 px-1 py-0.5 w-12">النوع</th>
                            {Array.from({ length: salesMonths }, (_, i) => (
                              <th key={i} className="text-center text-gray-400 px-0 py-0.5 w-4">{salesStart + i}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {UNITS.map((u, ui) => (
                            <tr key={u.id} className="border-t border-gray-50">
                              <td className="text-right px-1 py-0.5">
                                <span className="text-gray-600 font-bold text-[7px]">{u.name}</span>
                              </td>
                              {Array.from({ length: salesMonths }, (_, mi) => (
                                <td key={mi} className="px-0 py-0">
                                  <input
                                    type="number" min={0} max={u.count} value={detailUnits[ui]?.[mi] || 0}
                                    onChange={e => updateDetail(ui, mi, +e.target.value)}
                                    className="w-4 h-3.5 text-[6px] text-center border border-gray-200/50 rounded bg-white/60 focus:border-indigo-400 focus:outline-none"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing + Revenue Contribution — merged */}
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl border border-white/80 shadow-lg shadow-gray-200/30 overflow-hidden">
              <div className="px-3 py-1 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-l from-indigo-50/50 to-transparent">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3 h-3 text-indigo-500" />
                  <span className="text-[10px] font-bold text-gray-700">تسعير الوحدات والإيرادات</span>
                </div>
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{fmt(results.revenue)}</span>
              </div>
              <div className="p-1.5 space-y-0">
                {UNITS.map(u => {
                  const totalArea = u.area * u.count;
                  const totalPrice = totalArea * (prices[u.id] || 0);
                  const pct = results.revenue > 0 ? (totalPrice / results.revenue) * 100 : 0;
                  return (
                    <div key={u.id} className="border-b border-gray-50 last:border-0 py-0.5">
                      <div className="flex items-center gap-1 h-5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                        <span className="text-[9px] font-bold text-gray-600 w-12 truncate">{u.name}</span>
                        <input
                          type="range" min={800} max={2500} step={50} value={prices[u.id]}
                          onChange={e => setPrices(p => ({ ...p, [u.id]: +e.target.value }))}
                          className="flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                          style={{ background: `linear-gradient(to left, ${u.color}40, ${u.color}15)` } as any}
                        />
                        <span className="text-[9px] font-mono font-black w-8 text-left" style={{ color: u.color }}>{prices[u.id]}</span>
                      </div>
                      <div className="flex items-center gap-1 mr-4 h-3">
                        <div className="flex-1 h-2 bg-gray-100/80 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(to left, ${u.color}, ${u.color}80)` }} />
                        </div>
                        <span className="text-[8px] font-mono font-black text-gray-700 w-9 text-left">{fmt(totalPrice)}</span>
                        <span className="text-[7px] text-gray-400 w-5 text-left">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue */}
            <div className="backdrop-blur-sm bg-gradient-to-bl from-emerald-50/80 to-white/60 rounded-2xl border border-emerald-100/50 shadow-lg shadow-emerald-100/20 p-3">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold text-gray-700">إجمالي الإيرادات</span>
              </div>
              <div className="text-2xl font-black text-emerald-600">{fmt(results.revenue)}</div>
              <div className="text-[9px] text-gray-400">{TOTAL_UNITS} وحدة × متوسط {fmt(results.avgUnitPrice)}/وحدة</div>
            </div>
          </div>

          {/* ═══ RIGHT — Impact ═══ */}
          <div className="col-span-8 space-y-3">

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "إجمالي الإيرادات", value: fmt(results.revenue), color: "from-indigo-500 to-purple-500", icon: DollarSign },
                { label: "وحدات أوف بلان", value: results.totalSold.toString(), color: "from-blue-500 to-cyan-500", icon: Target },
                { label: "يدخل الضمان", value: fmt(results.escrowData.reduce((s, r) => s + r.escrowIn, 0)), color: "from-emerald-500 to-teal-500", icon: TrendingUp },
                { label: "حالة الضمان", value: results.hasDeficit ? `-${fmt(results.deficitAmount)}` : "متوازن", color: results.hasDeficit ? "from-red-500 to-rose-500" : "from-emerald-500 to-green-500", icon: results.hasDeficit ? AlertTriangle : CheckCircle },
              ].map((kpi, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl p-2.5 shadow-lg">
                  <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-10`} />
                  <div className="relative">
                    <kpi.icon className="w-3.5 h-3.5 text-gray-500 mb-0.5" />
                    <div className="text-[9px] text-gray-500">{kpi.label}</div>
                    <div className="text-lg font-black text-gray-800">{kpi.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Escrow Chart */}
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl border border-white/80 shadow-lg shadow-gray-200/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-l from-blue-50/30 to-transparent">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-bold text-gray-700">أثر المبيعات على رصيد الضمان</span>
                </div>
                {results.hasDeficit && (
                  <span className="text-[9px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full shadow-sm">
                    عجز {fmt(results.deficitAmount)}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-end gap-[2px] h-[90px] relative">
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-300/60" />
                  {results.escrowData.map((row, i) => {
                    const maxAbs = Math.max(...results.escrowData.map(r => Math.abs(r.balance)), 1);
                    const hPct = (Math.abs(row.balance) / maxAbs) * 45;
                    const isNeg = row.balance < 0;
                    return (
                      <div key={i} className="flex-1 relative h-full group cursor-pointer">
                        <div
                          className={`w-full rounded-sm transition-all duration-200 ${isNeg ? "bg-gradient-to-t from-red-500 to-red-300" : "bg-gradient-to-b from-emerald-300 to-emerald-500"}`}
                          style={{
                            height: `${hPct}%`,
                            position: "absolute",
                            ...(isNeg ? { top: "50%" } : { bottom: "50%" }),
                          }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
                          <div className="bg-gray-800 text-white rounded-lg px-2 py-1 text-[8px] whitespace-nowrap shadow-xl">
                            شهر {row.month}: <b>{fmt(row.balance)}</b>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-gray-400 mt-1">
                  <span>شهر {salesStart}</span>
                  <span>شهر {Math.round((salesStart + projectEnd) / 2)}</span>
                  <span>شهر {projectEnd}</span>
                </div>
              </div>
            </div>

            {/* Escrow Table */}
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl border border-white/80 shadow-lg shadow-gray-200/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100/50 flex items-center gap-2 bg-gradient-to-l from-amber-50/30 to-transparent">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-bold text-gray-700">تفصيل أثر البيع على الضمان — شهر بشهر</span>
              </div>
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-[9px]">
                  <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm">
                    <tr className="border-b border-gray-200/50">
                      <th className="text-right px-2 py-1 text-gray-500 font-medium">الشهر</th>
                      <th className="text-center px-2 py-1 text-gray-500 font-medium">وحدات</th>
                      <th className="text-center px-2 py-1 text-gray-400 font-medium">%</th>
                      <th className="text-center px-2 py-1 text-emerald-600 font-medium">↓ دخول</th>
                      <th className="text-center px-2 py-1 text-red-500 font-medium">↑ سحب</th>
                      <th className="text-center px-2 py-1 text-gray-700 font-bold">الرصيد</th>
                      <th className="text-center px-2 py-1 text-gray-500 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.escrowData.map((row) => (
                      <tr key={row.month} className={`border-b border-gray-100/30 h-6 transition-colors ${row.balance < 0 ? "bg-red-50/40" : "hover:bg-emerald-50/20"}`}>
                        <td className="text-right px-2 py-0.5 font-bold text-gray-600">{row.month}</td>
                        <td className="text-center px-2 py-0.5 text-gray-700 font-mono">{row.units}</td>
                        <td className="text-center px-2 py-0.5 text-gray-400 font-mono text-[8px]">{results.totalSold > 0 ? ((row.units / results.totalSold) * 100).toFixed(0) + "%" : "0%"}</td>
                        <td className="text-center px-2 py-0.5 text-emerald-600 font-mono font-bold">{fmt(row.escrowIn)}</td>
                        <td className="text-center px-2 py-0.5 text-red-500 font-mono">{fmt(row.escrowOut)}</td>
                        <td className={`text-center px-2 py-0.5 font-black font-mono ${row.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {row.balance < 0 ? "-" : ""}{fmt(Math.abs(row.balance))}
                        </td>
                        <td className="text-center px-2 py-0.5">
                          {row.balance < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[8px] text-white bg-red-500 px-1.5 py-0.5 rounded-full font-bold">عجز</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[8px] text-white bg-emerald-500 px-1.5 py-0.5 rounded-full font-bold">آمن</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
