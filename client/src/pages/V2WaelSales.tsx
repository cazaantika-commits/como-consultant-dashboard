import { useState, useMemo } from "react";

// ─── Data Model ───────────────────────────────────────────────────────────────
const UNIT_TYPES = [
  { id: "studio", name: "استوديو", count: 50, area: 400, color: "#6366f1", defaultPrice: 1350 },
  { id: "1br", name: "غرفة وصالة", count: 80, area: 700, color: "#8b5cf6", defaultPrice: 1250 },
  { id: "2br", name: "غرفتين", count: 60, area: 1050, color: "#a855f7", defaultPrice: 1200 },
  { id: "3br", name: "ثلاث غرف", count: 30, area: 1400, color: "#d946ef", defaultPrice: 1150 },
  { id: "retail", name: "محلات", count: 15, area: 600, color: "#f59e0b", defaultPrice: 1800 },
  { id: "office", name: "مكاتب", count: 20, area: 900, color: "#10b981", defaultPrice: 1400 },
];

const TOTAL_UNITS = UNIT_TYPES.reduce((s, u) => s + u.count, 0);

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
}

// Bell curve distribution
function bellCurve(months: number, total: number): number[] {
  const mid = months / 2;
  const sigma = months / 5;
  const raw = Array.from({ length: months }, (_, i) =>
    Math.exp(-0.5 * Math.pow((i - mid) / sigma, 2))
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  const scaled = raw.map((v) => Math.round((v / sum) * total));
  const diff = total - scaled.reduce((a, b) => a + b, 0);
  if (diff !== 0) scaled[Math.floor(mid)] += diff;
  return scaled;
}

export default function V2WaelSales() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(UNIT_TYPES.map((u) => [u.id, u.defaultPrice]))
  );
  const [salesStart, setSalesStart] = useState(1);
  const [projectEnd, setProjectEnd] = useState(30);
  const [offPlan, setOffPlan] = useState(75);
  const [marketingPct, setMarketingPct] = useState(2);
  const [commissionPct, setCommissionPct] = useState(5);
  const [materialsCost, setMaterialsCost] = useState(2); // in millions
  const [salesMode, setSalesMode] = useState<"auto" | "manual" | "detail">("auto");
  const [manualUnits, setManualUnits] = useState<number[]>([]);
  const [speed, setSpeed] = useState(50);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const months = projectEnd - salesStart + 1;

  const unitRevenues = useMemo(
    () => UNIT_TYPES.map((u) => ({ ...u, total: u.count * u.area * prices[u.id], totalArea: u.count * u.area })),
    [prices]
  );

  const totalRevenue = unitRevenues.reduce((s, u) => s + u.total, 0);
  const totalArea = unitRevenues.reduce((s, u) => s + u.totalArea, 0);

  const constructionCost = totalArea * 450; // 450 AED/sqft construction
  const marketingCost = totalRevenue * (marketingPct / 100);
  const commissionCost = totalRevenue * (commissionPct / 100);
  const materialsTotal = materialsCost * 1e6;
  const totalCosts = constructionCost + marketingCost + commissionCost + materialsTotal;
  const profit = totalRevenue - totalCosts;
  const roiPct = ((profit / constructionCost) * 100).toFixed(0);
  const marginPct = ((profit / totalCosts) * 100).toFixed(0);

  // Escrow starts at 20% of construction cost
  const escrowInitial = constructionCost * 0.2;
  const monthlySiphon = constructionCost / months;

  const offPlanUnits = Math.round((TOTAL_UNITS * offPlan) / 100);

  const salesDistribution = useMemo(() => {
    if (salesMode === "manual" && manualUnits.length === months) {
      return manualUnits;
    }
    // Auto mode with speed factor
    const mid = months * (1 - speed / 100) + (months / 2) * (speed / 100);
    const sigma = months / (3 + (speed / 100) * 3);
    const raw = Array.from({ length: months }, (_, i) =>
      Math.exp(-0.5 * Math.pow((i - mid + months / 2) / sigma, 2))
    );
    const sum = raw.reduce((a, b) => a + b, 0);
    const scaled = raw.map((v) => Math.max(1, Math.round((v / sum) * offPlanUnits)));
    const diff = offPlanUnits - scaled.reduce((a, b) => a + b, 0);
    if (diff !== 0) scaled[Math.floor(months / 2)] += diff;
    return scaled;
  }, [months, offPlanUnits, speed, salesMode, manualUnits]);

  const avgUnitPrice = totalRevenue / TOTAL_UNITS;

  // Escrow monthly calculation
  const escrowData = useMemo(() => {
    let balance = escrowInitial;
    return salesDistribution.map((units, i) => {
      const income = units * avgUnitPrice * 0.8 * 0.3; // 80% goes to escrow, 30% first payment
      const withdrawal = monthlySiphon;
      balance = balance + income - withdrawal;
      return { month: i + 1 + salesStart - 1, units, income, withdrawal, balance };
    });
  }, [salesDistribution, escrowInitial, avgUnitPrice, monthlySiphon, salesStart]);

  const maxDeficit = Math.min(...escrowData.map((d) => d.balance));
  const maxBalance = Math.max(...escrowData.map((d) => d.balance));
  const chartMax = Math.max(Math.abs(maxDeficit), Math.abs(maxBalance));
  const hasDeficit = maxDeficit < 0;
  const deficitMonths = escrowData.filter((d) => d.balance < 0).length;

  const totalSold = salesDistribution.reduce((a, b) => a + b, 0);
  const totalEscrowIn = escrowData.reduce((s, d) => s + d.income, 0);
  const totalEscrowOut = escrowData.reduce((s, d) => s + d.withdrawal, 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white text-sm font-bold">W</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">غرفة عمليات المبيعات</h1>
              <p className="text-[11px] text-slate-400">مجان — G+4P+25 • وائل</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>الشهر {salesStart}</span>
              <span className="text-slate-300">→</span>
              <span>الشهر {projectEnd}</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-medium">{months} شهر</span>
            </div>
            {hasDeficit && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-700">عجز {fmt(Math.abs(maxDeficit))}</span>
                <span className="text-[10px] text-red-400">({deficitMonths} شهر)</span>
              </div>
            )}
            {!hasDeficit && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-700">الضمان آمن</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-5 space-y-5">
        {/* ═══ SECTION 1: PRICING ═══ */}
        <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                <span className="text-indigo-600 text-xs">💰</span>
              </div>
              <h2 className="text-sm font-bold text-slate-700">تسعير الوحدات</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">إجمالي المساحة:</span>
              <span className="font-bold text-slate-700">{totalArea.toLocaleString()} قدم²</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">إجمالي الإيرادات:</span>
              <span className="font-bold text-indigo-600">{fmt(totalRevenue)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-[11px]">
                  <th className="py-2 px-3 text-right font-medium w-24">النوع</th>
                  <th className="py-2 px-2 text-center font-medium w-14">العدد</th>
                  <th className="py-2 px-2 text-center font-medium w-20">مساحة الوحدة</th>
                  <th className="py-2 px-2 text-center font-medium w-24">المساحة الكلية</th>
                  <th className="py-2 px-2 text-center font-medium w-64">السعر / قدم²</th>
                  <th className="py-2 px-2 text-center font-medium w-24">إجمالي النوع</th>
                  <th className="py-2 px-2 text-center font-medium w-16">النسبة</th>
                  <th className="py-2 px-2 text-center font-medium w-32">المساهمة</th>
                </tr>
              </thead>
              <tbody>
                {unitRevenues.map((u) => {
                  const pct = ((u.total / totalRevenue) * 100).toFixed(0);
                  return (
                    <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                          <span className="font-medium text-slate-700">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800">{u.count}</td>
                      <td className="py-1.5 px-2 text-center text-slate-500">{u.area} ft²</td>
                      <td className="py-1.5 px-2 text-center font-medium text-slate-600">{u.totalArea.toLocaleString()}</td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={800}
                            max={2500}
                            step={50}
                            value={prices[u.id]}
                            onChange={(e) => setPrices((p) => ({ ...p, [u.id]: +e.target.value }))}
                            className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                          />
                          <span className="w-12 text-center font-bold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 text-[11px]">
                            {prices[u.id]}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800">{fmt(u.total)}</td>
                      <td className="py-1.5 px-2 text-center text-slate-500">{pct}%</td>
                      <td className="py-1.5 px-2">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="py-2 px-3 font-bold text-slate-700">الإجمالي</td>
                  <td className="py-2 px-2 text-center font-bold text-slate-800">{TOTAL_UNITS}</td>
                  <td className="py-2 px-2 text-center text-slate-400">—</td>
                  <td className="py-2 px-2 text-center font-bold text-slate-700">{totalArea.toLocaleString()}</td>
                  <td className="py-2 px-2 text-center text-slate-400">—</td>
                  <td className="py-2 px-2 text-center font-bold text-indigo-600">{fmt(totalRevenue)}</td>
                  <td className="py-2 px-2 text-center font-bold">100%</td>
                  <td className="py-2 px-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ═══ SECTION 2: FINANCIAL SUMMARY + COSTS ═══ */}
        <div className="grid grid-cols-12 gap-4">
          {/* Financial Summary */}
          <div className="col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <span className="text-emerald-600 text-xs">📊</span>
              </div>
              <h2 className="text-sm font-bold text-slate-700">الملخص المالي</h2>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 text-center border border-blue-100">
                <p className="text-[10px] text-blue-500 mb-0.5">الإيرادات</p>
                <p className="text-lg font-black text-blue-700">{fmt(totalRevenue)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3 text-center border border-orange-100">
                <p className="text-[10px] text-orange-500 mb-0.5">التكاليف</p>
                <p className="text-lg font-black text-orange-700">{fmt(totalCosts)}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 text-center border border-emerald-100">
                <p className="text-[10px] text-emerald-500 mb-0.5">الأرباح</p>
                <p className="text-lg font-black text-emerald-700">{fmt(profit)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-3 text-center border border-purple-100">
                <p className="text-[10px] text-purple-500 mb-0.5">ربح / رأس المال</p>
                <p className="text-lg font-black text-purple-700">{roiPct}%</p>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-3 text-center border border-pink-100">
                <p className="text-[10px] text-pink-500 mb-0.5">ربح / التكاليف</p>
                <p className="text-lg font-black text-pink-700">{marginPct}%</p>
              </div>
            </div>
            {/* Cost breakdown bar */}
            <div className="mt-3 bg-slate-50 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                <span>توزيع التكاليف</span>
                <span>{fmt(totalCosts)}</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div className="bg-slate-400 rounded-full" style={{ width: `${(constructionCost / totalCosts) * 100}%` }} title="إنشاء" />
                <div className="bg-amber-400 rounded-full" style={{ width: `${(marketingCost / totalCosts) * 100}%` }} title="تسويق" />
                <div className="bg-violet-400 rounded-full" style={{ width: `${(commissionCost / totalCosts) * 100}%` }} title="عمولة" />
                <div className="bg-rose-400 rounded-full" style={{ width: `${(materialsTotal / totalCosts) * 100}%` }} title="مواد" />
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />إنشاء {fmt(constructionCost)}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />تسويق {fmt(marketingCost)}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" />عمولة {fmt(commissionCost)}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />مواد {fmt(materialsTotal)}</span>
              </div>
            </div>
          </div>

          {/* Operations Costs Controls */}
          <div className="col-span-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <span className="text-amber-600 text-xs">⚙️</span>
              </div>
              <h2 className="text-sm font-bold text-slate-700">تكاليف العملية</h2>
            </div>
            <div className="space-y-3">
              {/* Marketing */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-20">تسويق</span>
                <input type="range" min={0} max={5} step={0.5} value={marketingPct}
                  onChange={(e) => setMarketingPct(+e.target.value)}
                  className="flex-1 h-1.5 accent-amber-500" />
                <span className="bg-amber-50 text-amber-700 font-bold text-[11px] px-2 py-0.5 rounded w-12 text-center">{marketingPct}%</span>
                <span className="text-[10px] text-slate-400 w-14 text-left">{fmt(marketingCost)}</span>
              </div>
              {/* Commission */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-20">عمولة مبيعات</span>
                <input type="range" min={0} max={10} step={0.5} value={commissionPct}
                  onChange={(e) => setCommissionPct(+e.target.value)}
                  className="flex-1 h-1.5 accent-violet-500" />
                <span className="bg-violet-50 text-violet-700 font-bold text-[11px] px-2 py-0.5 rounded w-12 text-center">{commissionPct}%</span>
                <span className="text-[10px] text-slate-400 w-14 text-left">{fmt(commissionCost)}</span>
              </div>
              {/* Materials */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-20">مواد تسويق</span>
                <input type="range" min={0} max={10} step={0.5} value={materialsCost}
                  onChange={(e) => setMaterialsCost(+e.target.value)}
                  className="flex-1 h-1.5 accent-rose-500" />
                <span className="bg-rose-50 text-rose-700 font-bold text-[11px] px-2 py-0.5 rounded w-12 text-center">{materialsCost}M</span>
                <span className="text-[10px] text-slate-400 w-14 text-left">{fmt(materialsTotal)}</span>
              </div>
              {/* Timeline */}
              <div className="border-t border-slate-100 pt-3 mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 w-20">بداية البيع</span>
                  <input type="number" min={1} max={projectEnd - 1} value={salesStart}
                    onChange={(e) => setSalesStart(Math.max(1, +e.target.value))}
                    className="w-14 text-center text-xs border border-slate-200 rounded-lg py-1 focus:ring-2 focus:ring-indigo-200 outline-none" />
                  <span className="text-[11px] text-slate-500 w-20 text-center">نهاية المشروع</span>
                  <input type="number" min={salesStart + 1} max={60} value={projectEnd}
                    onChange={(e) => setProjectEnd(Math.max(salesStart + 1, +e.target.value))}
                    className="w-14 text-center text-xs border border-slate-200 rounded-lg py-1 focus:ring-2 focus:ring-indigo-200 outline-none" />
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{months} شهر</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: SALES CURVE ═══ */}
        <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center">
                <span className="text-purple-600 text-xs">📈</span>
              </div>
              <h2 className="text-sm font-bold text-slate-700">منحنى المبيعات</h2>
              <span className="text-[10px] bg-purple-50 text-purple-600 font-medium px-2 py-0.5 rounded-full">
                {totalSold} / {TOTAL_UNITS} وحدة ({Math.round((totalSold / TOTAL_UNITS) * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-indigo-50 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-indigo-500">أوف بلان:</span>
                <span className="text-[11px] font-bold text-indigo-700">{offPlan}%</span>
              </div>
              <input type="range" min={50} max={100} value={offPlan}
                onChange={(e) => setOffPlan(+e.target.value)}
                className="w-20 h-1.5 accent-indigo-500" />
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {(["auto", "manual", "detail"] as const).map((m) => (
                  <button key={m} onClick={() => setSalesMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      salesMode === m ? "bg-white shadow-sm text-indigo-700" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {m === "auto" ? "تلقائي" : m === "manual" ? "يدوي" : "تفصيلي"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4">
            {salesMode === "auto" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">سرعة البيع</span>
                  <input type="range" min={10} max={90} value={speed}
                    onChange={(e) => setSpeed(+e.target.value)}
                    className="flex-1 h-1.5 accent-purple-500" />
                  <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                    {speed < 33 ? "بطيء" : speed < 66 ? "متوسط" : "سريع"}
                  </span>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-[2px] h-16 px-1">
                  {salesDistribution.map((units, i) => {
                    const maxU = Math.max(...salesDistribution);
                    const h = (units / maxU) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-t transition-all duration-300"
                          style={{
                            height: `${h}%`,
                            backgroundColor: escrowData[i]?.balance < 0 ? "#f87171" : "#818cf8",
                            minHeight: "2px",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 px-1">
                  <span>شهر {salesStart}</span>
                  <span>شهر {projectEnd}</span>
                </div>
              </div>
            )}

            {salesMode === "manual" && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400">عدد الوحدات لكل شهر — الإجمالي: {totalSold} / {offPlanUnits}</p>
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: months }, (_, i) => {
                    const val = manualUnits[i] ?? salesDistribution[i] ?? 0;
                    const pct = ((val / TOTAL_UNITS) * 100).toFixed(0);
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <span className="text-[8px] text-slate-400 mb-0.5">{i + salesStart}</span>
                        <input
                          type="number" min={0} max={30} value={val}
                          onChange={(e) => {
                            const arr = [...(manualUnits.length === months ? manualUnits : salesDistribution)];
                            arr[i] = Math.max(0, +e.target.value);
                            setManualUnits(arr);
                          }}
                          className="w-full text-center text-[11px] font-bold border border-slate-200 rounded-lg py-1 focus:ring-2 focus:ring-purple-200 outline-none bg-white"
                        />
                        <span className="text-[8px] text-slate-300 mt-0.5">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {salesMode === "detail" && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400">عدد الوحدات لكل نوع × شهر</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] w-full">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-1 px-2 text-right sticky right-0 bg-white z-10 w-24">النوع (المتاح)</th>
                        {Array.from({ length: Math.min(months, 30) }, (_, i) => (
                          <th key={i} className="py-1 px-1 text-center w-8">{i + salesStart}</th>
                        ))}
                        <th className="py-1 px-2 text-center">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {UNIT_TYPES.map((u) => {
                        const perMonth = Math.max(1, Math.round(salesDistribution[0] * (u.count / TOTAL_UNITS)));
                        return (
                          <tr key={u.id} className="border-t border-slate-50">
                            <td className="py-1 px-2 sticky right-0 bg-white z-10">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                                <span className="font-medium">{u.name}</span>
                                <span className="text-slate-300">({u.count})</span>
                              </div>
                            </td>
                            {Array.from({ length: Math.min(months, 30) }, (_, i) => {
                              const val = Math.round(salesDistribution[i] * (u.count / TOTAL_UNITS));
                              return (
                                <td key={i} className="py-1 px-1 text-center text-slate-600">{val}</td>
                              );
                            })}
                            <td className="py-1 px-2 text-center font-bold text-slate-700">
                              {Math.round(totalSold * (u.count / TOTAL_UNITS))}/{u.count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ SECTION 4: ESCROW IMPACT ═══ */}
        <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center">
                <span className="text-teal-600 text-xs">🏦</span>
              </div>
              <h2 className="text-sm font-bold text-slate-700">رصيد الضمان — شهر بشهر</h2>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                يبدأ بـ {fmt(escrowInitial)} (20% من الإنشاء)
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-slate-400">وحدات مباعة: <b className="text-slate-700">{totalSold}</b></span>
              <span className="text-slate-400">دخول الضمان: <b className="text-emerald-600">{fmt(totalEscrowIn)}</b></span>
              <span className="text-slate-400">سحب بناء: <b className="text-red-500">{fmt(totalEscrowOut)}</b></span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-12 gap-4">
            {/* Chart - wider */}
            <div className="col-span-8">
              <div className="relative h-48 flex items-end gap-[2px] px-2">
                {/* Zero line */}
                <div className="absolute left-0 right-0 border-t border-dashed border-slate-300" style={{ bottom: `${(chartMax / (chartMax * 2)) * 100}%` }} />
                {escrowData.map((d, i) => {
                  const isNeg = d.balance < 0;
                  const h = (Math.abs(d.balance) / (chartMax * 1.1)) * 50;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center relative" style={{ height: "100%" }}>
                      <div className="absolute flex flex-col items-center" style={{
                        bottom: isNeg ? `${50 - h}%` : "50%",
                        height: `${h}%`,
                        width: "100%",
                      }}>
                        <div
                          className={`w-full rounded-sm transition-all duration-300 ${isNeg ? "rounded-b" : "rounded-t"}`}
                          style={{
                            height: "100%",
                            backgroundColor: isNeg ? "#f87171" : "#34d399",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Numbers below chart */}
              <div className="flex gap-[2px] px-2 mt-1">
                {escrowData.map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <p className={`text-[7px] font-bold ${d.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {fmt(d.balance)}
                    </p>
                    <p className="text-[7px] text-slate-300">{d.month}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Table - compact */}
            <div className="col-span-4 overflow-y-auto max-h-56 border border-slate-100 rounded-xl">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-slate-400">
                    <th className="py-1.5 px-1.5 text-center">م</th>
                    <th className="py-1.5 px-1 text-center">وحدات</th>
                    <th className="py-1.5 px-1 text-center text-emerald-500">↓ دخول</th>
                    <th className="py-1.5 px-1 text-center text-red-400">↑ سحب</th>
                    <th className="py-1.5 px-1 text-center">رصيد</th>
                    <th className="py-1.5 px-1 text-center">⚡</th>
                  </tr>
                </thead>
                <tbody>
                  {escrowData.map((d) => (
                    <tr key={d.month} className="border-t border-slate-50">
                      <td className="py-1 px-1.5 text-center font-medium text-slate-600">{d.month}</td>
                      <td className="py-1 px-1 text-center text-slate-700">{d.units}</td>
                      <td className="py-1 px-1 text-center text-emerald-600 font-medium">{fmt(d.income)}</td>
                      <td className="py-1 px-1 text-center text-red-400">{fmt(d.withdrawal)}</td>
                      <td className={`py-1 px-1 text-center font-bold ${d.balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(d.balance)}
                      </td>
                      <td className="py-1 px-1 text-center">
                        {d.balance < 0 ? (
                          <span className="inline-block w-4 h-4 leading-4 text-[8px] bg-red-100 text-red-600 rounded-full font-bold">!</span>
                        ) : (
                          <span className="inline-block w-4 h-4 leading-4 text-[8px] bg-emerald-100 text-emerald-600 rounded-full">✓</span>
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
