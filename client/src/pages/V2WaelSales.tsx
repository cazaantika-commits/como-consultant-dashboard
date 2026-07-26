import { useState } from "react";
import { ArrowRight, AlertTriangle, CheckCircle, DollarSign, PieChart, BarChart3, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA — structure only =====
const PROJECT_NAME = "مجان متعدد الاستخدامات — G+4P+25";

// Unit types
const UNIT_TYPES = [
  { id: "studio", name: "استوديو", area: 400, count: 50 },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80 },
  { id: "2br", name: "غرفتين وصالة", area: 1050, count: 60 },
  { id: "3br", name: "ثلاث غرف وصالة", area: 1400, count: 30 },
  { id: "retail", name: "محلات تجارية", area: 600, count: 15 },
  { id: "office", name: "مكاتب", area: 900, count: 20 },
];

// Payment plan stages
const PAYMENT_STAGES = [
  { id: "booking", name: "دفعة الحجز" },
  { id: "first", name: "الدفعة الأولى" },
  { id: "construction1", name: "قسط البناء 1" },
  { id: "construction2", name: "قسط البناء 2" },
  { id: "construction3", name: "قسط البناء 3" },
  { id: "handover", name: "دفعة التسليم" },
];

const SALES_MONTHS = 30;

export default function V2WaelSales() {
  const [, navigate] = useLocation();
  
  // Dummy state for inputs
  const [prices] = useState<Record<string, number>>({
    studio: 1350, "1br": 1250, "2br": 1200, "3br": 1150, retail: 1800, office: 1400
  });
  const [paymentPlan] = useState<Record<string, number>>({
    booking: 10, first: 10, construction1: 15, construction2: 15, construction3: 15, handover: 35
  });
  const [offPlanPercent] = useState(75);
  const [marketingBudget] = useState(2);
  const [salesCommission] = useState(5);
  const [marketingPrep] = useState(850000);
  
  // Dummy calculated results
  const totalRevenue = 622500000;
  const projectProfit = 185000000;
  const peakCapital = 48000000;
  const investorROI = 32;
  const escrowStatus = "deficit" as "ok" | "deficit";
  const escrowDeficit = 4200000;
  const deficitMonths = "الشهر 4 — الشهر 9";

  // Dummy escrow monthly balance
  const escrowBalance = Array.from({ length: SALES_MONTHS }, (_, i) => {
    if (i < 3) return 2000000 + i * 500000;
    if (i < 6) return -1000000 - (i - 3) * 1200000;
    if (i < 10) return -4200000 + (i - 6) * 1500000;
    return 1000000 + (i - 10) * 800000;
  });

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-purple-900 text-white px-4 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1 hover:bg-white/10 rounded">
              <ArrowRight className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base font-bold">مركز عمليات المبيعات</h1>
              <p className="text-indigo-200 text-[10px]">{PROJECT_NAME}</p>
            </div>
          </div>
          <div className="text-[10px] text-indigo-200">وائل — مدير المبيعات والتسويق</div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-2">
        {/* ═══ KPI Cards ═══ */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          <div className="bg-white rounded border border-gray-200 p-2">
            <div className="flex items-center gap-1 mb-[2px]">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              <span className="text-[8px] text-gray-500">إجمالي الإيرادات</span>
            </div>
            <div className="text-sm font-bold text-emerald-700">622.5M</div>
          </div>
          <div className="bg-white rounded border border-gray-200 p-2">
            <div className="flex items-center gap-1 mb-[2px]">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span className="text-[8px] text-gray-500">ربح المشروع</span>
            </div>
            <div className="text-sm font-bold text-blue-700">185M</div>
          </div>
          <div className="bg-white rounded border border-gray-200 p-2">
            <div className="flex items-center gap-1 mb-[2px]">
              <BarChart3 className="w-3 h-3 text-orange-600" />
              <span className="text-[8px] text-gray-500">ذروة رأس المال</span>
            </div>
            <div className="text-sm font-bold text-orange-700">48M</div>
          </div>
          <div className="bg-white rounded border border-gray-200 p-2">
            <div className="flex items-center gap-1 mb-[2px]">
              <PieChart className="w-3 h-3 text-purple-600" />
              <span className="text-[8px] text-gray-500">عائد المستثمر</span>
            </div>
            <div className="text-sm font-bold text-purple-700">32%</div>
          </div>
          <div className={`rounded border-2 p-2 ${escrowStatus === "deficit" ? "bg-red-50 border-red-400" : "bg-green-50 border-green-300"}`}>
            <div className="flex items-center gap-1 mb-[2px]">
              {escrowStatus === "deficit" ? <AlertTriangle className="w-3 h-3 text-red-600" /> : <CheckCircle className="w-3 h-3 text-green-600" />}
              <span className="text-[8px] text-gray-600">حالة الضمان</span>
            </div>
            {escrowStatus === "deficit" ? (
              <div>
                <div className="text-sm font-bold text-red-700">عجز: 4.2M</div>
                <div className="text-[7px] text-red-600">{deficitMonths}</div>
              </div>
            ) : (
              <div className="text-sm font-bold text-green-700">متوازن ✓</div>
            )}
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div className="grid grid-cols-12 gap-2">
          
          {/* ─── Left: Inputs (5 cols) ─── */}
          <div className="col-span-5 space-y-2">
            
            {/* Unit Pricing */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-indigo-50 px-2 py-[4px] border-b border-indigo-100">
                <h3 className="text-[10px] font-bold text-indigo-800">تسعير الوحدات (سعر القدم²)</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-[8px] text-gray-500 px-2 py-[2px] text-right">النوع</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">المساحة</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">العدد</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">السعر/قدم²</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">إجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {UNIT_TYPES.map((unit) => {
                    const price = prices[unit.id] || 0;
                    const unitTotal = price * unit.area * unit.count;
                    return (
                      <tr key={unit.id} className="border-b border-gray-50 hover:bg-indigo-50/30">
                        <td className="px-2 py-[2px] text-[9px] font-medium text-gray-800">{unit.name}</td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{unit.area}</td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{unit.count}</td>
                        <td className="px-1 py-[2px] text-center">
                          <span className="text-[9px] bg-indigo-50 border border-indigo-200 rounded px-1 py-[0px] font-medium text-indigo-800">{price.toLocaleString()}</span>
                        </td>
                        <td className="px-1 py-[2px] text-[9px] text-center font-medium text-gray-700">{(unitTotal / 1000000).toFixed(1)}M</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Payment Plan */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-emerald-50 px-2 py-[4px] border-b border-emerald-100">
                <h3 className="text-[10px] font-bold text-emerald-800">خطة الدفع</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-[8px] text-gray-500 px-2 py-[2px] text-right">المرحلة</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">النسبة</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYMENT_STAGES.map((stage) => {
                    const pct = paymentPlan[stage.id] || 0;
                    return (
                      <tr key={stage.id} className="border-b border-gray-50 hover:bg-emerald-50/30">
                        <td className="px-2 py-[2px] text-[9px] font-medium text-gray-800">{stage.name}</td>
                        <td className="px-1 py-[2px] text-center">
                          <span className="text-[9px] bg-emerald-50 border border-emerald-200 rounded px-1 font-medium text-emerald-800">{pct}%</span>
                        </td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{((pct / 100) * totalRevenue / 1000000).toFixed(1)}M</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-emerald-50">
                    <td className="px-2 py-[2px] text-[9px] font-bold text-emerald-800">المجموع</td>
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-emerald-800">100%</td>
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-emerald-800">{(totalRevenue / 1000000).toFixed(1)}M</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sales & Marketing Settings */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-amber-50 px-2 py-[4px] border-b border-amber-100">
                <h3 className="text-[10px] font-bold text-amber-800">إعدادات المبيعات والتسويق</h3>
              </div>
              <div className="p-2 space-y-[4px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-700">نسبة المبيعات أوف بلان</span>
                  <span className="text-[9px] bg-amber-50 border border-amber-200 rounded px-2 font-medium text-amber-800">{offPlanPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-700">ميزانية التسويق</span>
                  <span className="text-[9px] bg-amber-50 border border-amber-200 rounded px-2 font-medium text-amber-800">{marketingBudget}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-700">عمولة المبيعات</span>
                  <span className="text-[9px] bg-amber-50 border border-amber-200 rounded px-2 font-medium text-amber-800">{salesCommission}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-700">تحضير مواد التسويق</span>
                  <span className="text-[9px] bg-amber-50 border border-amber-200 rounded px-2 font-medium text-amber-800">{(marketingPrep / 1000).toLocaleString()}K</span>
                </div>
              </div>
            </div>

            {/* Sales Curve Mini */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-violet-50 px-2 py-[4px] border-b border-violet-100">
                <h3 className="text-[10px] font-bold text-violet-800">منحنى المبيعات (توزيع شهري)</h3>
              </div>
              <div className="p-2 flex items-end gap-[1px] h-[40px]">
                {Array.from({ length: SALES_MONTHS }, (_, i) => {
                  const height = Math.max(8, Math.sin((i / SALES_MONTHS) * Math.PI) * 100);
                  return (
                    <div key={i} className="flex-1 bg-violet-400 rounded-t-[1px] hover:bg-violet-600 transition-colors" style={{ height: `${height}%` }} title={`الشهر ${i + 1}`} />
                  );
                })}
              </div>
              <div className="px-2 pb-1 flex justify-between text-[7px] text-gray-400">
                <span>الشهر 1</span>
                <span>الشهر {SALES_MONTHS}</span>
              </div>
            </div>
          </div>

          {/* ─── Right: Results (7 cols) ─── */}
          <div className="col-span-7 space-y-2">
            
            {/* Escrow Balance Chart */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-slate-100 px-2 py-[4px] border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-800">رصيد حساب الضمان الشهري</h3>
                {escrowStatus === "deficit" && (
                  <span className="text-[8px] bg-red-100 text-red-700 px-2 py-[1px] rounded-full font-bold">⚠️ عجز: 4.2M</span>
                )}
              </div>
              <div className="p-2">
                <div className="flex items-end gap-[2px] h-[100px] relative">
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-300 z-0" />
                  {escrowBalance.map((val, i) => {
                    const maxAbs = Math.max(...escrowBalance.map(Math.abs));
                    const heightPct = Math.abs(val) / maxAbs * 45;
                    const isNegative = val < 0;
                    return (
                      <div key={i} className="flex-1 relative h-full">
                        <div 
                          className={`w-full rounded-[1px] ${isNegative ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ height: `${heightPct}%`, position: "absolute", ...(isNegative ? { top: "50%" } : { bottom: "50%" }) }}
                          title={`الشهر ${i + 1}: ${(val / 1000000).toFixed(1)}M`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[7px] text-gray-400 mt-1">
                  <span>الشهر 1</span>
                  <span className="text-red-500 font-bold">منطقة العجز</span>
                  <span>الشهر {SALES_MONTHS}</span>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-slate-100 px-2 py-[4px] border-b border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-800">تفصيل الإيرادات حسب النوع</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-[8px] text-gray-500 px-2 py-[2px] text-right">النوع</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">العدد</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">سعر الوحدة</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">إجمالي</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] text-center">%</th>
                    <th className="text-[8px] text-gray-500 px-1 py-[2px] w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {UNIT_TYPES.map((unit) => {
                    const price = prices[unit.id] || 0;
                    const typeTotal = price * unit.area * unit.count;
                    const pct = (typeTotal / totalRevenue) * 100;
                    return (
                      <tr key={unit.id} className="border-b border-gray-50">
                        <td className="px-2 py-[2px] text-[9px] font-medium text-gray-800">{unit.name}</td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{unit.count}</td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{(price * unit.area / 1000000).toFixed(2)}M</td>
                        <td className="px-1 py-[2px] text-[9px] text-center font-medium text-gray-800">{(typeTotal / 1000000).toFixed(1)}M</td>
                        <td className="px-1 py-[2px] text-[9px] text-center text-gray-600">{pct.toFixed(0)}%</td>
                        <td className="px-1 py-[2px]">
                          <div className="w-full bg-gray-100 rounded-full h-[4px]">
                            <div className="bg-indigo-500 h-[4px] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-indigo-50">
                    <td className="px-2 py-[2px] text-[9px] font-bold text-indigo-800">الإجمالي</td>
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-indigo-800">{UNIT_TYPES.reduce((s, u) => s + u.count, 0)}</td>
                    <td></td>
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-indigo-800">{(totalRevenue / 1000000).toFixed(1)}M</td>
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-indigo-800">100%</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cash Flow Impact */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-slate-100 px-2 py-[4px] border-b border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-800">أثر المبيعات على التدفقات</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100" dir="ltr">
                <div className="p-2 text-center" dir="rtl">
                  <div className="text-[8px] text-gray-500 mb-[2px]">يدخل الضمان (80%)</div>
                  <div className="text-sm font-bold text-emerald-700">{(totalRevenue * 0.8 * offPlanPercent / 100 / 1000000).toFixed(0)}M</div>
                </div>
                <div className="p-2 text-center" dir="rtl">
                  <div className="text-[8px] text-gray-500 mb-[2px]">إيرادات مباشرة (20%)</div>
                  <div className="text-sm font-bold text-blue-700">{(totalRevenue * 0.2 * offPlanPercent / 100 / 1000000).toFixed(0)}M</div>
                </div>
                <div className="p-2 text-center" dir="rtl">
                  <div className="text-[8px] text-gray-500 mb-[2px]">مبيعات بعد الإنجاز</div>
                  <div className="text-sm font-bold text-purple-700">{(totalRevenue * (1 - offPlanPercent / 100) / 1000000).toFixed(0)}M</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
