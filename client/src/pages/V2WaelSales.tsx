import { useState, useMemo } from "react";
import {
  ArrowRight, AlertTriangle, CheckCircle, TrendingUp,
  DollarSign, BarChart3, Sliders, Target, Zap, Shield
} from "lucide-react";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════════════════════════
   غرفة عمليات المبيعات — وائل
   خلفية فاتحة، أسطر مضغوطة، أثر البيع على الضمان واضح
   ═══════════════════════════════════════════════════════════ */

const UNITS = [
  { id: "studio", name: "استوديو", area: 400, count: 50, color: "#6366f1" },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80, color: "#8b5cf6" },
  { id: "2br", name: "غرفتين", area: 1050, count: 60, color: "#a855f7" },
  { id: "3br", name: "ثلاث غرف", area: 1400, count: 30, color: "#d946ef" },
  { id: "retail", name: "محلات", area: 600, count: 15, color: "#f59e0b" },
  { id: "office", name: "مكاتب", area: 900, count: 20, color: "#10b981" },
];
const TOTAL_UNITS = UNITS.reduce((s, u) => s + u.count, 0); // 255
const MONTHS = 30;

// Generate bell curve distribution
function bellCurve(months: number, speed: number): number[] {
  const peak = speed > 60 ? months * 0.25 : speed > 40 ? months * 0.5 : months * 0.75;
  const sigma = months * 0.25;
  const raw = Array.from({ length: months }, (_, i) => Math.exp(-0.5 * ((i - peak) / sigma) ** 2));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / sum);
}

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // ─── Controls ───
  const [prices, setPrices] = useState<Record<string, number>>({
    studio: 1350, "1br": 1250, "2br": 1200, "3br": 1150, retail: 1800, office: 1400,
  });
  const [offPlan, setOffPlan] = useState(75);
  const [salesMode, setSalesMode] = useState<"auto" | "manual" | "detail">("auto");
  const [salesSpeed, setSalesSpeed] = useState(50);
  const [manualUnits, setManualUnits] = useState<number[]>(Array(MONTHS).fill(0).map((_, i) => {
    const dist = bellCurve(MONTHS, 50);
    return Math.round(dist[i] * TOTAL_UNITS * 0.75);
  }));
  const [detailUnits, setDetailUnits] = useState<number[][]>(
    UNITS.map(u => Array(MONTHS).fill(0).map((_, i) => {
      const dist = bellCurve(MONTHS, 50);
      return Math.round(dist[i] * u.count * 0.75);
    }))
  );

  // ─── Computed ───
  const results = useMemo(() => {
    const revenue = UNITS.reduce((s, u) => s + (prices[u.id] || 0) * u.area * u.count, 0);
    const offPlanRevenue = revenue * (offPlan / 100);

    // Monthly sales units
    let monthlySales: number[];
    if (salesMode === "auto") {
      const dist = bellCurve(MONTHS, salesSpeed);
      monthlySales = dist.map(d => Math.round(d * TOTAL_UNITS * (offPlan / 100)));
    } else if (salesMode === "manual") {
      monthlySales = [...manualUnits];
    } else {
      monthlySales = Array(MONTHS).fill(0).map((_, m) => detailUnits.reduce((s, row) => s + (row[m] || 0), 0));
    }

    // Average unit price
    const avgUnitPrice = revenue / TOTAL_UNITS;

    // Monthly escrow calculation
    const constructionCost = revenue * 0.70;
    const monthlyDraw = constructionCost / MONTHS; // monthly construction draw from escrow
    
    const escrowData = monthlySales.map((units, i) => {
      const salesRevenue = units * avgUnitPrice;
      const escrowIn = salesRevenue * 0.8; // 80% goes to escrow
      return { month: i + 1, units, escrowIn, escrowOut: monthlyDraw, balance: 0 };
    });

    // Calculate running balance
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
  }, [prices, offPlan, salesMode, salesSpeed, manualUnits, detailUnits]);

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
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* ═══ Header ═══ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm font-bold text-gray-800">غرفة عمليات المبيعات</h1>
              <span className="text-[10px] text-gray-400">مجان — G+4P+25</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">وائل — مدير المبيعات</span>
            <div className={`px-2 py-0.5 rounded flex items-center gap-1 text-[10px] font-bold ${results.hasDeficit ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
              {results.hasDeficit ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {results.hasDeficit ? `عجز: ${fmt(results.deficitAmount)}` : "متوازن"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-3">
        <div className="grid grid-cols-12 gap-3">

          {/* ═══ LEFT — Controls ═══ */}
          <div className="col-span-4 space-y-3">

            {/* Pricing */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-gray-700">تسعير الوحدات (سعر/قدم²)</span>
              </div>
              <div className="p-2 space-y-1">
                {UNITS.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 h-6">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                    <span className="text-[10px] text-gray-500 w-14 truncate">{u.name}</span>
                    <input
                      type="range" min={800} max={2500} step={50} value={prices[u.id]}
                      onChange={e => setPrices(p => ({ ...p, [u.id]: +e.target.value }))}
                      className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-grab"
                    />
                    <span className="text-[10px] font-mono font-bold text-indigo-600 w-10 text-left">{prices[u.id]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-bold text-gray-700">استراتيجية البيع</span>
              </div>
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between h-5">
                  <span className="text-[10px] text-gray-500">أوف بلان</span>
                  <span className="text-[10px] font-bold text-purple-600">{offPlan}%</span>
                </div>
                <input
                  type="range" min={30} max={100} value={offPlan}
                  onChange={e => setOffPlan(+e.target.value)}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-grab"
                />
              </div>
            </div>

            {/* Sales Input Mode */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-gray-700">منحنى المبيعات الشهري</span>
                </div>
                <div className="flex gap-0.5 bg-gray-100 rounded p-0.5">
                  {(["auto", "manual", "detail"] as const).map(m => (
                    <button key={m} onClick={() => setSalesMode(m)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${salesMode === m ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-2">
                {salesMode === "auto" && (
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1">
                      <span className="text-[10px] text-gray-500">سرعة البيع</span>
                      <span className="text-[10px] font-bold text-amber-600">{salesSpeed < 30 ? "بطيء" : salesSpeed < 70 ? "متوسط" : "سريع"}</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={salesSpeed}
                      onChange={e => setSalesSpeed(+e.target.value)}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:cursor-grab"
                    />
                    <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                      <span>بطيء</span><span>سريع</span>
                    </div>
                  </div>
                )}
                {salesMode === "manual" && (
                  <div>
                    <div className="text-[9px] text-gray-500 mb-1">عدد الوحدات لكل شهر (الإجمالي: {results.totalSold} / {TOTAL_UNITS})</div>
                    <div className="grid grid-cols-10 gap-0.5">
                      {manualUnits.map((v, i) => (
                        <div key={i} className="text-center">
                          <div className="text-[7px] text-gray-400">{i + 1}</div>
                          <input
                            type="number" min={0} max={30} value={v}
                            onChange={e => updateManual(i, +e.target.value)}
                            className="w-full h-5 text-[9px] text-center border border-gray-200 rounded bg-gray-50 focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {salesMode === "detail" && (
                  <div>
                    <div className="text-[9px] text-gray-500 mb-1">عدد الوحدات لكل نوع في كل شهر</div>
                    <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                      <table className="w-full text-[8px]">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            <th className="text-right text-gray-500 px-1 py-0.5 w-16">النوع</th>
                            {Array.from({ length: MONTHS }, (_, i) => (
                              <th key={i} className="text-center text-gray-400 px-0 py-0.5 w-5">{i + 1}</th>
                            ))}
                            <th className="text-center text-gray-500 px-1 py-0.5">مج</th>
                          </tr>
                        </thead>
                        <tbody>
                          {UNITS.map((u, ui) => (
                            <tr key={u.id}>
                              <td className="text-right px-1 py-0.5">
                                <div className="flex items-center gap-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                                  <span className="text-gray-600">{u.name}</span>
                                </div>
                              </td>
                              {detailUnits[ui].map((v, mi) => (
                                <td key={mi} className="px-0 py-0.5">
                                  <input
                                    type="number" min={0} max={u.count} value={v}
                                    onChange={e => updateDetail(ui, mi, +e.target.value)}
                                    className="w-5 h-4 text-[7px] text-center border border-gray-200 rounded bg-gray-50 focus:border-indigo-400 focus:outline-none"
                                  />
                                </td>
                              ))}
                              <td className="text-center font-bold text-gray-700 px-1">
                                {detailUnits[ui].reduce((a, b) => a + b, 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-gray-700">ملخص الإيرادات</span>
              </div>
              <div className="text-xl font-black text-emerald-600">{fmt(results.revenue)}</div>
              <div className="text-[9px] text-gray-400">{TOTAL_UNITS} وحدة × متوسط {fmt(results.avgUnitPrice)}/وحدة</div>
            </div>
          </div>

          {/* ═══ RIGHT — Impact (Escrow) ═══ */}
          <div className="col-span-8 space-y-3">

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
                <div className="text-[9px] text-gray-500">إجمالي الإيرادات</div>
                <div className="text-lg font-black text-gray-800">{fmt(results.revenue)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
                <div className="text-[9px] text-gray-500">وحدات مباعة (أوف بلان)</div>
                <div className="text-lg font-black text-indigo-600">{results.totalSold}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
                <div className="text-[9px] text-gray-500">يدخل الضمان</div>
                <div className="text-lg font-black text-blue-600">{fmt(results.escrowData.reduce((s, r) => s + r.escrowIn, 0))}</div>
              </div>
              <div className={`rounded-lg border shadow-sm p-2 ${results.hasDeficit ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className={`text-[9px] ${results.hasDeficit ? "text-red-500" : "text-emerald-500"}`}>حالة الضمان</div>
                <div className={`text-lg font-black ${results.hasDeficit ? "text-red-600" : "text-emerald-600"}`}>
                  {results.hasDeficit ? `-${fmt(results.deficitAmount)}` : "متوازن ✓"}
                </div>
              </div>
            </div>

            {/* Escrow Chart */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-bold text-gray-700">أثر المبيعات على رصيد الضمان</span>
                </div>
                {results.hasDeficit && (
                  <div className="flex items-center gap-1 text-[9px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <AlertTriangle className="w-3 h-3" /> عجز {fmt(results.deficitAmount)}
                  </div>
                )}
              </div>
              <div className="p-3">
                {/* Chart */}
                <div className="flex items-end gap-[2px] h-[100px] relative mb-1">
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-300 z-10" />
                  {results.escrowData.map((row, i) => {
                    const maxAbs = Math.max(...results.escrowData.map(r => Math.abs(r.balance)), 1);
                    const hPct = (Math.abs(row.balance) / maxAbs) * 45;
                    const isNeg = row.balance < 0;
                    return (
                      <div key={i} className="flex-1 relative h-full group cursor-pointer">
                        <div
                          className={`w-full rounded-sm transition-all ${isNeg ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{
                            height: `${hPct}%`,
                            position: "absolute",
                            ...(isNeg ? { top: "50%" } : { bottom: "50%" }),
                          }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
                          <div className="bg-gray-800 text-white rounded px-1.5 py-0.5 text-[7px] whitespace-nowrap shadow">
                            شهر {i + 1}: {fmt(row.balance)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-gray-400 px-1">
                  <span>شهر 1</span><span>شهر 15</span><span>شهر 30</span>
                </div>
              </div>
            </div>

            {/* ═══ ESCROW TABLE — The Key Impact View ═══ */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-gray-700">تفصيل أثر البيع على الضمان — شهر بشهر</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-right px-2 py-1 text-gray-500 font-medium">الشهر</th>
                      <th className="text-center px-2 py-1 text-gray-500 font-medium">وحدات مباعة</th>
                      <th className="text-center px-2 py-1 text-emerald-600 font-medium">↓ دخول الضمان</th>
                      <th className="text-center px-2 py-1 text-red-500 font-medium">↑ سحب بناء</th>
                      <th className="text-center px-2 py-1 text-gray-700 font-bold">الرصيد</th>
                      <th className="text-center px-2 py-1 text-gray-500 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.escrowData.map((row) => (
                      <tr key={row.month} className={`border-b border-gray-100 h-6 ${row.balance < 0 ? "bg-red-50/50" : ""}`}>
                        <td className="text-right px-2 py-0.5 font-bold text-gray-600">{row.month}</td>
                        <td className="text-center px-2 py-0.5 text-gray-700">{row.units}</td>
                        <td className="text-center px-2 py-0.5 text-emerald-600 font-mono">{fmt(row.escrowIn)}</td>
                        <td className="text-center px-2 py-0.5 text-red-500 font-mono">{fmt(row.escrowOut)}</td>
                        <td className={`text-center px-2 py-0.5 font-bold font-mono ${row.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {row.balance < 0 ? "-" : ""}{fmt(Math.abs(row.balance))}
                        </td>
                        <td className="text-center px-2 py-0.5">
                          {row.balance < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-red-500"><AlertTriangle className="w-2.5 h-2.5" /> عجز</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-emerald-500"><CheckCircle className="w-2.5 h-2.5" /> آمن</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revenue by type */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-bold text-gray-700">مساهمة كل نوع</span>
              </div>
              <div className="p-2 space-y-1">
                {UNITS.map(u => {
                  const rev = (prices[u.id] || 0) * u.area * u.count;
                  const pct = (rev / results.revenue) * 100;
                  return (
                    <div key={u.id} className="flex items-center gap-2 h-5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                      <span className="text-[9px] text-gray-500 w-14">{u.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: u.color }} />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-gray-700 w-12 text-left">{fmt(rev)}</span>
                      <span className="text-[8px] text-gray-400 w-7 text-left">{pct.toFixed(0)}%</span>
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
