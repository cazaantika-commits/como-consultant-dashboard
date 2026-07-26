import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowRight, DollarSign, Target, BarChart3, Zap, TrendingUp, Calculator } from "lucide-react";

/* ═══════════════════════════════════════
   بيانات الوحدات
   ═══════════════════════════════════════ */
const UNITS = [
  { id: "studio", name: "استوديو", area: 400, count: 50, color: "#6366f1" },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80, color: "#8b5cf6" },
  { id: "2br", name: "غرفتين", area: 1050, count: 60, color: "#a855f7" },
  { id: "3br", name: "ثلاث غرف", area: 1400, count: 30, color: "#d946ef" },
  { id: "retail", name: "محلات", area: 600, count: 15, color: "#f59e0b" },
  { id: "office", name: "مكاتب", area: 900, count: 20, color: "#10b981" },
];
const TOTAL_UNITS = UNITS.reduce((s, u) => s + u.count, 0);

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
};

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // ═══ State: Timeline ═══
  const [salesStart, setSalesStart] = useState(1);
  const [projectEnd, setProjectEnd] = useState(30);
  const salesMonths = projectEnd - salesStart + 1;

  // ═══ State: Pricing ═══
  const [prices, setPrices] = useState<Record<string, number>>({
    studio: 1350, "1br": 1250, "2br": 1200, "3br": 1150, retail: 1800, office: 1400,
  });

  // ═══ State: Costs ═══
  const [marketingPct, setMarketingPct] = useState(2);
  const [salesCommPct, setSalesCommPct] = useState(5);
  const [materialsCost, setMaterialsCost] = useState(2); // M

  // ═══ State: Sales Mode ═══
  const [salesMode, setSalesMode] = useState<"auto" | "manual" | "detail">("auto");
  const [offPlan, setOffPlan] = useState(75);
  const [salesSpeed, setSalesSpeed] = useState(50);
  const [manualUnits, setManualUnits] = useState<number[]>(Array(60).fill(0));
  const [detailUnits, setDetailUnits] = useState<number[][]>(UNITS.map(() => Array(60).fill(0)));

  // ═══ Computed ═══
  const results = useMemo(() => {
    // Revenue per unit type
    const revenueByType = UNITS.map(u => ({
      ...u,
      totalArea: u.area * u.count,
      totalRevenue: u.area * u.count * (prices[u.id] || 0),
    }));
    const revenue = revenueByType.reduce((s, r) => s + r.totalRevenue, 0);

    // Costs
    const marketing = revenue * (marketingPct / 100);
    const salesComm = revenue * (salesCommPct / 100);
    const materials = materialsCost * 1e6;
    const constructionCost = UNITS.reduce((s, u) => s + u.area * u.count, 0) * 450; // ~450/sqft construction
    const totalCosts = constructionCost + marketing + salesComm + materials;
    const profit = revenue - totalCosts;
    const capitalBase = constructionCost * 0.3 + materials; // peak capital = 30% construction + materials
    const roiCapital = capitalBase > 0 ? (profit / capitalBase) * 100 : 0;
    const marginPct = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    // Sales distribution
    const offPlanUnits = Math.round(TOTAL_UNITS * offPlan / 100);
    let monthlyUnits: number[] = Array(salesMonths).fill(0);

    if (salesMode === "auto") {
      // Bell curve based on speed
      const peak = salesSpeed < 30 ? salesMonths * 0.7 : salesSpeed < 70 ? salesMonths * 0.5 : salesMonths * 0.3;
      const sigma = salesMonths / 4;
      let raw = Array.from({ length: salesMonths }, (_, i) => Math.exp(-0.5 * ((i - peak) / sigma) ** 2));
      const rawSum = raw.reduce((s, v) => s + v, 0);
      monthlyUnits = raw.map(v => Math.round((v / rawSum) * offPlanUnits));
      // Adjust rounding
      const diff = offPlanUnits - monthlyUnits.reduce((s, v) => s + v, 0);
      if (diff !== 0) monthlyUnits[Math.floor(peak)] += diff;
    } else if (salesMode === "manual") {
      monthlyUnits = manualUnits.slice(0, salesMonths);
    } else {
      monthlyUnits = Array.from({ length: salesMonths }, (_, mi) =>
        UNITS.reduce((s, _, ui) => s + (detailUnits[ui]?.[mi] || 0), 0)
      );
    }

    const totalSold = monthlyUnits.reduce((s, v) => s + v, 0);

    // Escrow calculation
    const avgPricePerUnit = revenue / TOTAL_UNITS;
    const monthlyConstCost = constructionCost / salesMonths;
    let balance = 0;
    let maxDeficit = 0;
    const escrowData = monthlyUnits.map((units, i) => {
      const escrowIn = units * avgPricePerUnit * 0.80; // 80% enters escrow
      const escrowOut = monthlyConstCost;
      balance += escrowIn - escrowOut;
      if (balance < maxDeficit) maxDeficit = balance;
      return { month: salesStart + i, units, escrowIn, escrowOut, balance };
    });

    return {
      revenueByType, revenue, marketing, salesComm, materials, constructionCost,
      totalCosts, profit, capitalBase, roiCapital, marginPct,
      monthlyUnits, totalSold, offPlanUnits,
      escrowData, hasDeficit: maxDeficit < 0, deficitAmount: Math.abs(maxDeficit),
    };
  }, [prices, marketingPct, salesCommPct, materialsCost, salesMode, offPlan, salesSpeed, manualUnits, detailUnits, salesStart, projectEnd, salesMonths]);

  const updateManual = (idx: number, val: number) => {
    const arr = [...manualUnits];
    arr[idx] = Math.max(0, val);
    setManualUnits(arr);
  };
  const updateDetail = (unitIdx: number, monthIdx: number, val: number) => {
    const arr = detailUnits.map(r => [...r]);
    arr[unitIdx][monthIdx] = Math.max(0, val);
    setDetailUnits(arr);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" dir="rtl">

      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/v2")} className="p-1 rounded hover:bg-slate-100">
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <h1 className="text-xs font-black text-slate-800">غرفة عمليات المبيعات</h1>
            <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">مجان — G+4P+25</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-slate-400">بداية:</span>
              <input type="number" min={1} max={projectEnd-1} value={salesStart}
                onChange={e => setSalesStart(Math.max(1,+e.target.value))}
                className="w-7 h-4 text-[9px] text-center font-bold rounded border border-slate-200" />
              <span className="text-slate-400">نهاية:</span>
              <input type="number" min={salesStart+1} max={60} value={projectEnd}
                onChange={e => setProjectEnd(Math.max(salesStart+1,+e.target.value))}
                className="w-7 h-4 text-[9px] text-center font-bold rounded border border-slate-200" />
              <span className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded text-[8px] font-bold">{salesMonths} شهر</span>
            </div>
            <div className={`px-2 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold ${results.hasDeficit ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
              {results.hasDeficit ? `⚠ عجز: ${fmt(results.deficitAmount)}` : "✓ متوازن"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-3 space-y-3">

        {/* ═══════════════════════════════════════
           القسم 1: التسعير
           ═══════════════════════════════════════ */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[11px] font-bold text-slate-700">تسعير الوحدات</span>
            </div>
            <span className="text-[10px] font-black text-emerald-600">إجمالي: {fmt(results.revenue)}</span>
          </div>
          <div className="p-2">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-right px-1.5 py-0.5 text-slate-500 w-20">النوع</th>
                  <th className="text-center px-1 py-0.5 text-slate-500">العدد</th>
                  <th className="text-center px-1 py-0.5 text-slate-500">مساحة الوحدة</th>
                  <th className="text-center px-1 py-0.5 text-slate-500">المساحة الكلية</th>
                  <th className="text-center px-1 py-0.5 text-slate-500 w-[140px]">السعر / قدم²</th>
                  <th className="text-center px-1 py-0.5 text-slate-500">إجمالي النوع</th>
                  <th className="text-center px-1 py-0.5 text-slate-500 w-16">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {results.revenueByType.map(u => {
                  const pct = results.revenue > 0 ? (u.totalRevenue / results.revenue) * 100 : 0;
                  return (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/30 h-6">
                      <td className="px-1.5 py-0">
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                          <span className="font-bold text-slate-700">{u.name}</span>
                        </div>
                      </td>
                      <td className="text-center px-1 py-0 font-mono font-bold text-slate-700">{u.count}</td>
                      <td className="text-center px-1 py-0 font-mono text-slate-500">{u.area}</td>
                      <td className="text-center px-1 py-0 font-mono font-bold text-slate-600">{u.totalArea.toLocaleString()}</td>
                      <td className="text-center px-1 py-0">
                        <div className="flex items-center gap-1">
                          <input type="range" min={800} max={2500} step={50} value={prices[u.id]}
                            onChange={e => setPrices(p => ({ ...p, [u.id]: +e.target.value }))}
                            className="flex-1 h-0.5 rounded appearance-none cursor-pointer"
                            style={{ accentColor: u.color } as any} />
                          <span className="font-mono font-black w-8 text-left text-[9px]" style={{ color: u.color }}>{prices[u.id]}</span>
                        </div>
                      </td>
                      <td className="text-center px-1 py-0 font-mono font-black text-emerald-600">{fmt(u.totalRevenue)}</td>
                      <td className="text-center px-1 py-0">
                        <div className="flex items-center gap-0.5">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: u.color }} />
                          </div>
                          <span className="text-[8px] text-slate-500 w-5">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60 font-bold h-6">
                  <td className="px-1.5 py-0 text-slate-700">الإجمالي</td>
                  <td className="text-center px-1 py-0 font-mono text-slate-700">{TOTAL_UNITS}</td>
                  <td className="text-center px-1 py-0 text-slate-400">—</td>
                  <td className="text-center px-1 py-0 font-mono text-slate-700">{UNITS.reduce((s,u) => s + u.area*u.count, 0).toLocaleString()}</td>
                  <td className="text-center px-1 py-0 text-slate-400">—</td>
                  <td className="text-center px-1 py-0 font-mono font-black text-emerald-600">{fmt(results.revenue)}</td>
                  <td className="text-center px-1 py-0 text-slate-700">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════
           القسم 2: الملخص المالي + التكاليف
           ═══════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-3">
          {/* Financial Summary */}
          <div className="col-span-7 bg-white rounded-lg border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Calculator className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-slate-700">الملخص المالي</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-emerald-50 rounded-lg px-2 py-1.5 text-center border border-emerald-100">
                <div className="text-[7px] text-emerald-500 font-medium">الإيرادات</div>
                <div className="text-[13px] font-black text-emerald-700">{fmt(results.revenue)}</div>
              </div>
              <div className="bg-red-50 rounded-lg px-2 py-1.5 text-center border border-red-100">
                <div className="text-[7px] text-red-500 font-medium">التكاليف</div>
                <div className="text-[13px] font-black text-red-600">{fmt(results.totalCosts)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center border border-blue-100">
                <div className="text-[7px] text-blue-500 font-medium">الأرباح</div>
                <div className="text-[13px] font-black text-blue-700">{fmt(results.profit)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-center border border-purple-100">
                <div className="text-[7px] text-purple-500 font-medium">الربح / رأس المال</div>
                <div className="text-[13px] font-black text-purple-700">{results.roiCapital.toFixed(0)}%</div>
              </div>
              <div className="bg-indigo-50 rounded-lg px-2 py-1.5 text-center border border-indigo-100">
                <div className="text-[7px] text-indigo-500 font-medium">الربح / التكاليف</div>
                <div className="text-[13px] font-black text-indigo-700">{results.marginPct.toFixed(0)}%</div>
              </div>
            </div>
          </div>

          {/* Cost Inputs */}
          <div className="col-span-5 bg-white rounded-lg border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-bold text-slate-700">تكاليف العملية</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-20">تسويق</span>
                <input type="range" min={0} max={10} step={0.5} value={marketingPct}
                  onChange={e => setMarketingPct(+e.target.value)}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer bg-amber-100" style={{ accentColor: "#f59e0b" } as any} />
                <span className="text-[9px] font-black text-amber-600 w-7">{marketingPct}%</span>
                <span className="text-[8px] text-slate-400 w-12">{fmt(results.marketing)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-20">عمولة مبيعات</span>
                <input type="range" min={0} max={10} step={0.5} value={salesCommPct}
                  onChange={e => setSalesCommPct(+e.target.value)}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer bg-orange-100" style={{ accentColor: "#ea580c" } as any} />
                <span className="text-[9px] font-black text-orange-600 w-7">{salesCommPct}%</span>
                <span className="text-[8px] text-slate-400 w-12">{fmt(results.salesComm)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-20">مواد تسويق</span>
                <input type="range" min={0} max={10} step={0.5} value={materialsCost}
                  onChange={e => setMaterialsCost(+e.target.value)}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer bg-pink-100" style={{ accentColor: "#db2777" } as any} />
                <span className="text-[9px] font-black text-pink-600 w-7">{materialsCost}M</span>
                <span className="text-[8px] text-slate-400 w-12">{fmt(results.materials)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
           القسم 3: منحنى المبيعات
           ═══════════════════════════════════════ */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-bold text-slate-700">منحنى المبيعات</span>
              <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {results.totalSold} / {TOTAL_UNITS} وحدة
                ({((results.totalSold / TOTAL_UNITS) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-slate-400">أوف بلان:</span>
                <input type="range" min={30} max={100} value={offPlan}
                  onChange={e => setOffPlan(+e.target.value)}
                  className="w-16 h-0.5 rounded appearance-none cursor-pointer" style={{ accentColor: "#7c3aed" } as any} />
                <span className="text-[9px] font-black text-purple-600">{offPlan}%</span>
              </div>
              <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                {(["auto","manual","detail"] as const).map(m => (
                  <button key={m} onClick={() => setSalesMode(m)}
                    className={`px-2 py-0.5 rounded text-[8px] font-bold transition ${salesMode === m ? "bg-amber-500 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                    {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-2">
            {salesMode === "auto" && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-14">سرعة البيع</span>
                <input type="range" min={0} max={100} value={salesSpeed}
                  onChange={e => setSalesSpeed(+e.target.value)}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer bg-amber-100" style={{ accentColor: "#f59e0b" } as any} />
                <span className="text-[9px] font-bold text-amber-600 w-10">{salesSpeed < 30 ? "بطيء" : salesSpeed < 70 ? "متوسط" : "سريع"}</span>
                <span className="text-[8px] text-slate-400">({results.offPlanUnits} وحدة أوف بلان)</span>
              </div>
            )}
            {salesMode === "manual" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-500">عدد الوحدات لكل شهر</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${results.totalSold > TOTAL_UNITS ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                    {results.totalSold} / {TOTAL_UNITS}
                    {results.totalSold > 0 && ` (${((results.totalSold/TOTAL_UNITS)*100).toFixed(0)}%)`}
                  </span>
                </div>
                <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.min(salesMonths, 15)}, 1fr)` }}>
                  {Array.from({ length: Math.min(salesMonths, 15) }, (_, i) => (
                    <div key={i} className="text-center">
                      <div className="text-[7px] text-slate-400">{salesStart + i}</div>
                      <input type="number" min={0} max={50} value={manualUnits[i] || 0}
                        onChange={e => updateManual(i, +e.target.value)}
                        className="w-full h-5 text-[9px] text-center font-bold border border-slate-200 rounded bg-white focus:border-amber-400 focus:outline-none" />
                      <div className="text-[6px] text-slate-300">{manualUnits[i] > 0 && TOTAL_UNITS > 0 ? ((manualUnits[i]/TOTAL_UNITS)*100).toFixed(0)+"%" : ""}</div>
                    </div>
                  ))}
                </div>
                {salesMonths > 15 && (
                  <div className="grid gap-px mt-1" style={{ gridTemplateColumns: `repeat(${salesMonths - 15}, 1fr)` }}>
                    {Array.from({ length: salesMonths - 15 }, (_, i) => (
                      <div key={i+15} className="text-center">
                        <div className="text-[7px] text-slate-400">{salesStart + i + 15}</div>
                        <input type="number" min={0} max={50} value={manualUnits[i+15] || 0}
                          onChange={e => updateManual(i+15, +e.target.value)}
                          className="w-full h-5 text-[9px] text-center font-bold border border-slate-200 rounded bg-white focus:border-amber-400 focus:outline-none" />
                        <div className="text-[6px] text-slate-300">{manualUnits[i+15] > 0 && TOTAL_UNITS > 0 ? ((manualUnits[i+15]/TOTAL_UNITS)*100).toFixed(0)+"%" : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {salesMode === "detail" && (
              <div className="overflow-x-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-500">عدد الوحدات لكل نوع × شهر</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${results.totalSold > TOTAL_UNITS ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                    {results.totalSold} / {TOTAL_UNITS}
                  </span>
                </div>
                <table className="w-full text-[8px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-right px-1 py-0.5 text-slate-500 sticky right-0 bg-slate-50 z-10 w-16">النوع</th>
                      {Array.from({ length: salesMonths }, (_, i) => (
                        <th key={i} className="text-center px-0 py-0.5 text-slate-400 min-w-[26px]">{salesStart+i}</th>
                      ))}
                      <th className="text-center px-1 py-0.5 text-slate-600 font-bold sticky left-0 bg-slate-50 z-10 w-12">مجموع</th>
                      <th className="text-center px-1 py-0.5 text-slate-400 sticky left-12 bg-slate-50 z-10 w-10">من</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UNITS.map((u, ui) => {
                      const rowTotal = detailUnits[ui]?.slice(0, salesMonths).reduce((s,v) => s+v, 0) || 0;
                      return (
                        <tr key={u.id} className="border-t border-slate-100">
                          <td className="text-right px-1 py-0.5 sticky right-0 bg-white z-10">
                            <div className="flex items-center gap-0.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.color }} />
                              <span className="font-bold text-slate-700 text-[8px]">{u.name}</span>
                            </div>
                          </td>
                          {Array.from({ length: salesMonths }, (_, mi) => (
                            <td key={mi} className="text-center px-0 py-0">
                              <input type="number" min={0} max={u.count} value={detailUnits[ui]?.[mi] || 0}
                                onChange={e => updateDetail(ui, mi, +e.target.value)}
                                className="w-6 h-4 text-[8px] text-center font-mono font-bold border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none" />
                            </td>
                          ))}
                          <td className="text-center px-1 py-0.5 sticky left-0 bg-white z-10">
                            <span className={`font-black text-[9px] ${rowTotal > u.count ? "text-red-500" : "text-slate-700"}`}>{rowTotal}</span>
                          </td>
                          <td className="text-center px-1 py-0.5 sticky left-12 bg-white z-10">
                            <span className="text-[8px] text-slate-400">{u.count}</span>
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

        {/* ═══════════════════════════════════════
           القسم 4: أثر البيع على الضمان
           ═══════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-3">

          {/* Chart - wider */}
          <div className="col-span-8 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-bold text-slate-700">رصيد الضمان — شهر بشهر</span>
              </div>
              {results.hasDeficit && (
                <span className="text-[8px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">عجز {fmt(results.deficitAmount)}</span>
              )}
            </div>
            <div className="p-3">
              {/* Bar chart */}
              <div className="flex items-end gap-[1px] h-[100px] relative">
                <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-300 z-0" />
                {results.escrowData.map((row, i) => {
                  const maxAbs = Math.max(...results.escrowData.map(r => Math.abs(r.balance)), 1);
                  const hPct = (Math.abs(row.balance) / maxAbs) * 45;
                  const isNeg = row.balance < 0;
                  return (
                    <div key={i} className="flex-1 relative h-full group cursor-pointer z-10">
                      <div className={`w-full rounded-sm ${isNeg ? "bg-red-400" : "bg-emerald-400"}`}
                        style={{ height: `${hPct}%`, position: "absolute", ...(isNeg ? { top: "50%" } : { bottom: "50%" }) }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
                        <div className="bg-slate-800 text-white rounded px-1.5 py-0.5 text-[7px] whitespace-nowrap shadow-lg">
                          شهر {row.month}: {fmt(row.balance)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Numbers below bars */}
              <div className="flex gap-[1px] mt-0.5">
                {results.escrowData.map((row, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className={`text-[6px] font-mono font-bold leading-tight ${row.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {fmt(row.balance)}
                    </div>
                  </div>
                ))}
              </div>
              {/* Month labels */}
              <div className="flex gap-[1px] mt-0">
                {results.escrowData.map((row, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-[5px] text-slate-400">{row.month}</div>
                  </div>
                ))}
              </div>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-[7px] text-slate-400">إيرادات</div>
                  <div className="text-[10px] font-black text-emerald-600">{fmt(results.revenue)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[7px] text-slate-400">يدخل الضمان</div>
                  <div className="text-[10px] font-black text-blue-600">{fmt(results.escrowData.reduce((s,r) => s + r.escrowIn, 0))}</div>
                </div>
                <div className="text-center">
                  <div className="text-[7px] text-slate-400">سحب بناء</div>
                  <div className="text-[10px] font-black text-red-500">{fmt(results.escrowData.reduce((s,r) => s + r.escrowOut, 0))}</div>
                </div>
                <div className="text-center">
                  <div className="text-[7px] text-slate-400">وحدات مباعة</div>
                  <div className="text-[10px] font-black text-slate-700">{results.totalSold}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Table - compressed */}
          <div className="col-span-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-bold text-slate-700">التفصيل الشهري</span>
            </div>
            <div className="overflow-y-auto max-h-[220px]">
              <table className="w-full text-[8px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-right px-1 py-0.5 text-slate-500 w-6">م</th>
                    <th className="text-center px-0.5 py-0.5 text-slate-500">وحدات</th>
                    <th className="text-center px-0.5 py-0.5 text-emerald-600">دخول</th>
                    <th className="text-center px-0.5 py-0.5 text-red-500">سحب</th>
                    <th className="text-center px-0.5 py-0.5 text-slate-700 font-bold">رصيد</th>
                    <th className="text-center px-0.5 py-0.5 w-5">⚡</th>
                  </tr>
                </thead>
                <tbody>
                  {results.escrowData.map((row) => (
                    <tr key={row.month} className={`border-b border-slate-50 h-5 ${row.balance < 0 ? "bg-red-50/40" : ""}`}>
                      <td className="text-right px-1 py-0 font-bold text-slate-500">{row.month}</td>
                      <td className="text-center px-0.5 py-0 font-mono text-slate-600">{row.units}</td>
                      <td className="text-center px-0.5 py-0 font-mono text-emerald-600">{fmt(row.escrowIn)}</td>
                      <td className="text-center px-0.5 py-0 font-mono text-red-500">{fmt(row.escrowOut)}</td>
                      <td className={`text-center px-0.5 py-0 font-mono font-black ${row.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(row.balance)}
                      </td>
                      <td className="text-center px-0.5 py-0">
                        {row.balance < 0 ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
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
