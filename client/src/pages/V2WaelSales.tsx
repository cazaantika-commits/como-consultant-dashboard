import { useState, useMemo } from "react";
import { ArrowRight, AlertTriangle, CheckCircle, DollarSign, Target, Zap, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════════════════════════
   غرفة عمليات المبيعات — وائل
   أداة تفكير: تسعير → منحنى بيع → أثر على الضمان
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

  // Timeline
  const [salesStart, setSalesStart] = useState(1);
  const [projectEnd, setProjectEnd] = useState(30);
  const salesMonths = Math.max(1, projectEnd - salesStart + 1);

  // Controls
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

  // Computed
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
      const escrowIn = units * avgUnitPrice * 0.8;
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
    <div className="min-h-screen bg-slate-50" dir="rtl">

      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ArrowRight className="w-4 h-4 text-slate-600" />
            </button>
            <h1 className="text-sm font-black text-slate-800">غرفة عمليات المبيعات</h1>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">مجان — G+4P+25</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-indigo-600 font-bold">وائل — مدير المبيعات</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-slate-500">بداية:</span>
              <input type="number" min={1} max={projectEnd - 1} value={salesStart}
                onChange={e => setSalesStart(Math.max(1, +e.target.value))}
                className="w-8 h-5 text-[10px] text-center font-bold rounded border border-slate-200 bg-white" />
              <span className="text-slate-500">نهاية:</span>
              <input type="number" min={salesStart + 1} max={60} value={projectEnd}
                onChange={e => setProjectEnd(Math.max(salesStart + 1, +e.target.value))}
                className="w-8 h-5 text-[10px] text-center font-bold rounded border border-slate-200 bg-white" />
              <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[9px]">{salesMonths} شهر</span>
            </div>
            <div className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold ${results.hasDeficit ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
              {results.hasDeficit ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {results.hasDeficit ? `عجز: ${fmt(results.deficitAmount)}` : "متوازن ✓"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* ═══════════════════════════════════════════════════════
           القسم 1: التسعير — بارز ومستقل بعرض كامل
           ═══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-700">تسعير الوحدات</span>
              <span className="text-[9px] text-slate-400">(سعر / قدم²)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-emerald-600">إجمالي الإيرادات: {fmt(results.revenue)}</span>
            </div>
          </div>
          <div className="p-3">
            {/* Header row */}
            <div className="grid grid-cols-[120px_1fr_60px_100px_80px_70px] gap-2 items-center text-[9px] text-slate-400 font-medium mb-1 px-1">
              <span>النوع</span>
              <span className="text-center">السعر / قدم²</span>
              <span className="text-center">السعر</span>
              <span className="text-center">المساحة الإجمالية</span>
              <span className="text-center">إجمالي النوع</span>
              <span className="text-center">النسبة</span>
            </div>
            {UNITS.map(u => {
              const totalArea = u.area * u.count;
              const totalPrice = totalArea * (prices[u.id] || 0);
              const pct = results.revenue > 0 ? (totalPrice / results.revenue) * 100 : 0;
              return (
                <div key={u.id} className="grid grid-cols-[120px_1fr_60px_100px_80px_70px] gap-2 items-center py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition rounded">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: u.color }} />
                    <span className="text-[11px] font-bold text-slate-700">{u.name}</span>
                    <span className="text-[8px] text-slate-400">{u.count} وحدة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={800} max={2500} step={50} value={prices[u.id]}
                      onChange={e => setPrices(p => ({ ...p, [u.id]: +e.target.value }))}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                      style={{ background: `linear-gradient(to left, ${u.color}30, ${u.color}08)`, accentColor: u.color } as any}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-black text-center" style={{ color: u.color }}>{prices[u.id]}</span>
                  <span className="text-[10px] text-slate-500 text-center font-mono">{u.count}×{u.area} = {totalArea.toLocaleString()} ft²</span>
                  <span className="text-[11px] font-black text-emerald-600 text-center">{fmt(totalPrice)}</span>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: u.color }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 w-7">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           القسم 2: منحنى المبيعات — كيف ومتى نبيع
           ═══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700">منحنى المبيعات</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500">أوف بلان:</span>
                <input
                  type="range" min={30} max={100} value={offPlan}
                  onChange={e => setOffPlan(+e.target.value)}
                  className="w-20 h-1 rounded-full appearance-none cursor-pointer bg-purple-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                />
                <span className="text-[10px] font-black text-purple-600">{offPlan}%</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                {(["auto", "manual", "detail"] as const).map(m => (
                  <button key={m} onClick={() => setSalesMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all ${salesMode === m ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3">
            {salesMode === "auto" && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 w-16">سرعة البيع</span>
                <input
                  type="range" min={0} max={100} value={salesSpeed}
                  onChange={e => setSalesSpeed(+e.target.value)}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-amber-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                />
                <span className="text-[10px] font-bold text-amber-600 w-12">{salesSpeed < 30 ? "بطيء" : salesSpeed < 70 ? "متوسط" : "سريع"}</span>
                <span className="text-[9px] text-slate-400">({results.totalSold} وحدة أوف بلان)</span>
              </div>
            )}
            {salesMode === "manual" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500">عدد الوحدات لكل شهر</span>
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{results.totalSold} / {TOTAL_UNITS}</span>
                </div>
                <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.min(salesMonths, 15)}, 1fr)` }}>
                  {Array.from({ length: salesMonths }, (_, i) => (
                    <div key={i} className="text-center">
                      <div className="text-[7px] text-slate-400 mb-0.5">{salesStart + i}</div>
                      <input
                        type="number" min={0} max={30} value={manualUnits[i] || 0}
                        onChange={e => updateManual(i, +e.target.value)}
                        className="w-full h-6 text-[10px] text-center font-bold border border-slate-200 rounded bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-100 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                {salesMonths > 15 && (
                  <div className="grid gap-px mt-1" style={{ gridTemplateColumns: `repeat(${salesMonths - 15}, 1fr)` }}>
                    {Array.from({ length: salesMonths - 15 }, (_, i) => (
                      <div key={i + 15} className="text-center">
                        <div className="text-[7px] text-slate-400 mb-0.5">{salesStart + i + 15}</div>
                        <input
                          type="number" min={0} max={30} value={manualUnits[i + 15] || 0}
                          onChange={e => updateManual(i + 15, +e.target.value)}
                          className="w-full h-6 text-[10px] text-center font-bold border border-slate-200 rounded bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-100 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {salesMode === "detail" && (
              <div className="overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500">عدد الوحدات لكل نوع × شهر</span>
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{results.totalSold} / {TOTAL_UNITS}</span>
                </div>
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-right px-2 py-1 text-slate-500 font-medium sticky right-0 bg-slate-50 z-10 w-20">النوع</th>
                      {Array.from({ length: salesMonths }, (_, i) => (
                        <th key={i} className="text-center px-0.5 py-1 text-slate-400 font-normal min-w-[28px]">{salesStart + i}</th>
                      ))}
                      <th className="text-center px-2 py-1 text-slate-600 font-bold sticky left-0 bg-slate-50 z-10">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UNITS.map((u, ui) => {
                      const rowTotal = detailUnits[ui]?.reduce((s, v) => s + v, 0) || 0;
                      return (
                        <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="text-right px-2 py-1 sticky right-0 bg-white z-10">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: u.color }} />
                              <span className="font-bold text-slate-700">{u.name}</span>
                              <span className="text-[7px] text-slate-400">({u.count})</span>
                            </div>
                          </td>
                          {Array.from({ length: salesMonths }, (_, mi) => (
                            <td key={mi} className="text-center px-0 py-0.5">
                              <input
                                type="number" min={0} max={u.count} value={detailUnits[ui]?.[mi] || 0}
                                onChange={e => updateDetail(ui, mi, +e.target.value)}
                                className="w-7 h-5 text-[9px] text-center font-mono font-bold border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none"
                              />
                            </td>
                          ))}
                          <td className="text-center px-2 py-1 sticky left-0 bg-white z-10">
                            <span className={`font-black ${rowTotal > u.count ? "text-red-500" : "text-slate-700"}`}>{rowTotal}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           القسم 3: أثر البيع على الضمان — الرسم + الجدول
           ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4">

          {/* Chart */}
          <div className="col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-700">رصيد الضمان</span>
              </div>
              {results.hasDeficit && (
                <span className="text-[9px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">عجز {fmt(results.deficitAmount)}</span>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-end gap-[2px] h-[140px] relative">
                <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-300" />
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
                        <div className="bg-slate-800 text-white rounded px-1.5 py-0.5 text-[8px] whitespace-nowrap shadow-lg">
                          شهر {row.month}: {fmt(row.balance)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-slate-400 mt-1">
                <span>شهر {salesStart}</span>
                <span>شهر {projectEnd}</span>
              </div>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-[8px] text-slate-400">إيرادات</div>
                  <div className="text-[11px] font-black text-emerald-600">{fmt(results.revenue)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-slate-400">يدخل الضمان</div>
                  <div className="text-[11px] font-black text-blue-600">{fmt(results.escrowData.reduce((s, r) => s + r.escrowIn, 0))}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-slate-400">وحدات مباعة</div>
                  <div className="text-[11px] font-black text-slate-700">{results.totalSold}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700">تفصيل أثر البيع على الضمان — شهر بشهر</span>
            </div>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-right px-3 py-1.5 text-slate-500 font-medium w-12">الشهر</th>
                    <th className="text-center px-2 py-1.5 text-slate-500 font-medium">وحدات</th>
                    <th className="text-center px-2 py-1.5 text-slate-400 font-medium">%</th>
                    <th className="text-center px-2 py-1.5 text-emerald-600 font-medium">↓ دخول</th>
                    <th className="text-center px-2 py-1.5 text-red-500 font-medium">↑ سحب</th>
                    <th className="text-center px-2 py-1.5 text-slate-700 font-bold">الرصيد</th>
                    <th className="text-center px-2 py-1.5 text-slate-500 font-medium w-14">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {results.escrowData.map((row) => (
                    <tr key={row.month} className={`border-b border-slate-50 h-7 ${row.balance < 0 ? "bg-red-50/30" : "hover:bg-slate-50/50"}`}>
                      <td className="text-right px-3 py-0.5 font-bold text-slate-600">{row.month}</td>
                      <td className="text-center px-2 py-0.5 font-mono text-slate-700">{row.units}</td>
                      <td className="text-center px-2 py-0.5 font-mono text-slate-400 text-[9px]">{results.totalSold > 0 ? ((row.units / results.totalSold) * 100).toFixed(0) + "%" : "—"}</td>
                      <td className="text-center px-2 py-0.5 font-mono font-bold text-emerald-600">{fmt(row.escrowIn)}</td>
                      <td className="text-center px-2 py-0.5 font-mono text-red-500">{fmt(row.escrowOut)}</td>
                      <td className={`text-center px-2 py-0.5 font-mono font-black ${row.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {row.balance < 0 ? "-" : ""}{fmt(Math.abs(row.balance))}
                      </td>
                      <td className="text-center px-2 py-0.5">
                        {row.balance < 0 ? (
                          <span className="text-[8px] text-white bg-red-500 px-1.5 py-0.5 rounded font-bold">عجز</span>
                        ) : (
                          <span className="text-[8px] text-white bg-emerald-500 px-1.5 py-0.5 rounded font-bold">آمن</span>
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
  );
}
