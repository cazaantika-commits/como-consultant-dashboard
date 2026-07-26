import { useState } from "react";
import { ArrowRight, AlertTriangle, CheckCircle, DollarSign, PieChart, BarChart3, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA — structure only =====
const PROJECT_NAME = "مجان متعدد الاستخدامات — G+4P+25";

const UNIT_TYPES = [
  { id: "studio", name: "استوديو", area: 400, count: 50 },
  { id: "1br", name: "غرفة وصالة", area: 700, count: 80 },
  { id: "2br", name: "غرفتين وصالة", area: 1050, count: 60 },
  { id: "3br", name: "ثلاث غرف وصالة", area: 1400, count: 30 },
  { id: "retail", name: "محلات تجارية", area: 600, count: 15 },
  { id: "office", name: "مكاتب", area: 900, count: 20 },
];

const PAYMENT_STAGES = [
  { id: "booking", name: "دفعة الحجز" },
  { id: "first", name: "الدفعة الأولى" },
  { id: "construction1", name: "قسط البناء 1" },
  { id: "construction2", name: "قسط البناء 2" },
  { id: "construction3", name: "قسط البناء 3" },
  { id: "handover", name: "دفعة التسليم" },
];

const SALES_MONTHS = 30;
const TOTAL_UNITS = UNIT_TYPES.reduce((a, b) => a + b.count, 0);

// Templates for sales curves
const SALES_TEMPLATES: Record<string, { name: string; desc: string; gen: () => number[] }> = {
  fast: {
    name: "سريع",
    desc: "70% أول 10 أشهر",
    gen: () => Array.from({ length: SALES_MONTHS }, (_, i) => i < 10 ? Math.round(12 - i * 0.8) : Math.round(3 - Math.min((i - 10) * 0.1, 2))),
  },
  gradual: {
    name: "تدريجي",
    desc: "توزيع متساوي",
    gen: () => Array.from({ length: SALES_MONTHS }, () => Math.round(TOTAL_UNITS / SALES_MONTHS)),
  },
  late: {
    name: "متأخر",
    desc: "التركيز على النصف الثاني",
    gen: () => Array.from({ length: SALES_MONTHS }, (_, i) => i < 15 ? Math.round(3 + i * 0.3) : Math.round(8 + (i - 15) * 0.5)),
  },
  bell: {
    name: "جرس",
    desc: "يرتفع بالمنتصف وينخفض",
    gen: () => Array.from({ length: SALES_MONTHS }, (_, i) => Math.max(1, Math.round(Math.sin((i / SALES_MONTHS) * Math.PI) * 15 + 2))),
  },
};

type SalesMode = "template" | "manual" | "detailed";

export default function V2WaelSales() {
  const [, navigate] = useLocation();

  // Pricing & payment state
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

  // Sales curve state
  const [salesMode, setSalesMode] = useState<SalesMode>("template");
  const [selectedTemplate, setSelectedTemplate] = useState("bell");
  const [manualUnits, setManualUnits] = useState<number[]>(() => SALES_TEMPLATES.bell.gen());
  const [detailedExpanded, setDetailedExpanded] = useState(false);
  const [detailedUnits] = useState<Record<string, number[]>>(() => {
    const result: Record<string, number[]> = {};
    UNIT_TYPES.forEach(u => {
      result[u.id] = Array.from({ length: SALES_MONTHS }, (_, i) =>
        Math.max(0, Math.round(Math.sin((i / SALES_MONTHS) * Math.PI) * (u.count / SALES_MONTHS) * 2))
      );
    });
    return result;
  });

  // Active curve
  const getActiveCurve = (): number[] => {
    if (salesMode === "template") return SALES_TEMPLATES[selectedTemplate].gen();
    if (salesMode === "manual") return manualUnits;
    return Array.from({ length: SALES_MONTHS }, (_, i) =>
      UNIT_TYPES.reduce((sum, u) => sum + (detailedUnits[u.id]?.[i] || 0), 0)
    );
  };
  const activeCurve = getActiveCurve();
  const totalSold = activeCurve.reduce((a, b) => a + b, 0);

  // Dummy KPIs
  const totalRevenue = 622500000;
  const escrowStatus = "deficit" as "ok" | "deficit";
  const deficitMonths = "الشهر 4 — الشهر 9";

  // Dummy escrow balance
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
        {/* KPI Cards */}
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

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-2">

          {/* Left: Inputs (5 cols) */}
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
                          <span className="text-[9px] bg-indigo-50 border border-indigo-200 rounded px-1 font-medium text-indigo-800">{price.toLocaleString()}</span>
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

            {/* ═══ Sales Curve — Flexible 3-Mode ═══ */}
            <div className="bg-white rounded border border-gray-200">
              <div className="bg-violet-50 px-2 py-[4px] border-b border-violet-100 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-violet-800">منحنى المبيعات</h3>
                <div className="flex items-center gap-[2px]">
                  {(["template", "manual", "detailed"] as SalesMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSalesMode(mode)}
                      className={`text-[8px] px-2 py-[2px] rounded transition-all ${
                        salesMode === mode
                          ? "bg-violet-600 text-white font-bold"
                          : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      }`}
                    >
                      {mode === "template" ? "قالب" : mode === "manual" ? "يدوي" : "تفصيلي"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Mode */}
              {salesMode === "template" && (
                <div className="p-2">
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {Object.entries(SALES_TEMPLATES).map(([key, tmpl]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTemplate(key)}
                        className={`text-right p-[6px] rounded border transition-all ${
                          selectedTemplate === key
                            ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
                            : "border-gray-200 hover:border-violet-200"
                        }`}
                      >
                        <div className="text-[9px] font-bold text-violet-800">{tmpl.name}</div>
                        <div className="text-[7px] text-gray-500">{tmpl.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-end gap-[1px] h-[35px] bg-gray-50 rounded p-1">
                    {SALES_TEMPLATES[selectedTemplate].gen().map((val, i) => {
                      const max = Math.max(...SALES_TEMPLATES[selectedTemplate].gen());
                      return (
                        <div key={i} className="flex-1 bg-violet-400 rounded-t-[1px]" style={{ height: `${(val / Math.max(max, 1)) * 100}%` }} title={`شهر ${i + 1}: ${val} وحدة`} />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[7px] text-gray-400 mt-[2px]">
                    <span>شهر 1</span>
                    <span className="text-violet-600 font-medium">إجمالي: {SALES_TEMPLATES[selectedTemplate].gen().reduce((a, b) => a + b, 0)} وحدة من {TOTAL_UNITS}</span>
                    <span>شهر {SALES_MONTHS}</span>
                  </div>
                </div>
              )}

              {/* Manual Mode */}
              {salesMode === "manual" && (
                <div className="p-2">
                  <div className="text-[8px] text-gray-500 mb-1">عدد الوحدات المباعة كل شهر — الإجمالي المتاح: {TOTAL_UNITS} وحدة</div>
                  <div className="overflow-x-auto">
                    <div className="flex gap-[2px] min-w-[500px]">
                      {manualUnits.map((val, i) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const arr = [...manualUnits];
                              arr[i] = Math.max(0, parseInt(e.target.value) || 0);
                              setManualUnits(arr);
                            }}
                            className="w-full text-[8px] text-center border border-gray-200 rounded py-[1px] focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
                          />
                          <span className="text-[6px] text-gray-400 mt-[1px]">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end gap-[1px] h-[30px] mt-2 bg-gray-50 rounded p-1">
                    {manualUnits.map((val, i) => {
                      const max = Math.max(...manualUnits, 1);
                      return <div key={i} className="flex-1 bg-violet-400 rounded-t-[1px]" style={{ height: `${(val / max) * 100}%` }} />;
                    })}
                  </div>
                  <div className="flex justify-between text-[7px] mt-[2px]">
                    <span className="text-gray-400">شهر 1</span>
                    <span className={`font-medium ${totalSold > TOTAL_UNITS ? "text-red-600" : "text-violet-600"}`}>
                      المجموع: {totalSold} / {TOTAL_UNITS}
                      {totalSold > TOTAL_UNITS && " ⚠️ تجاوز!"}
                    </span>
                    <span className="text-gray-400">شهر {SALES_MONTHS}</span>
                  </div>
                </div>
              )}

              {/* Detailed Mode */}
              {salesMode === "detailed" && (
                <div className="p-2">
                  <div className="text-[8px] text-gray-500 mb-1">تحديد المبيعات لكل نوع وحدة في كل شهر</div>
                  <div className="flex items-end gap-[1px] h-[30px] bg-gray-50 rounded p-1 mb-2">
                    {activeCurve.map((val, i) => {
                      const max = Math.max(...activeCurve, 1);
                      return <div key={i} className="flex-1 bg-violet-400 rounded-t-[1px]" style={{ height: `${(val / max) * 100}%` }} title={`شهر ${i + 1}: ${val}`} />;
                    })}
                  </div>
                  <div className="flex justify-between text-[7px] mb-2">
                    <span className="text-gray-400">شهر 1</span>
                    <span className="text-violet-600 font-medium">المجموع: {totalSold} / {TOTAL_UNITS}</span>
                    <span className="text-gray-400">شهر {SALES_MONTHS}</span>
                  </div>

                  <button
                    onClick={() => setDetailedExpanded(!detailedExpanded)}
                    className="w-full flex items-center justify-between px-2 py-[4px] bg-violet-50 rounded border border-violet-200 hover:bg-violet-100 transition-all"
                  >
                    <span className="text-[9px] font-medium text-violet-800">
                      {detailedExpanded ? "إخفاء الجدول التفصيلي" : "عرض الجدول التفصيلي (نوع × شهر)"}
                    </span>
                    {detailedExpanded ? <ChevronUp className="w-3 h-3 text-violet-600" /> : <ChevronDown className="w-3 h-3 text-violet-600" />}
                  </button>

                  {detailedExpanded && (
                    <div className="mt-2 overflow-x-auto border border-gray-200 rounded">
                      <table className="w-full" style={{ minWidth: SALES_MONTHS * 28 + 100 }}>
                        <thead>
                          <tr className="bg-violet-50">
                            <th className="sticky right-0 z-10 bg-violet-50 text-[7px] text-violet-800 px-1 py-[2px] text-right border-l border-violet-200 min-w-[70px]">النوع</th>
                            {Array.from({ length: SALES_MONTHS }, (_, i) => (
                              <th key={i} className="text-[6px] text-violet-600 px-[2px] py-[2px] text-center min-w-[24px]">{i + 1}</th>
                            ))}
                            <th className="text-[7px] text-violet-800 px-1 py-[2px] text-center border-r border-violet-200 min-w-[35px]">مج</th>
                          </tr>
                        </thead>
                        <tbody>
                          {UNIT_TYPES.map((unit) => {
                            const row = detailedUnits[unit.id] || [];
                            const rowTotal = row.reduce((a, b) => a + b, 0);
                            return (
                              <tr key={unit.id} className="border-t border-gray-100">
                                <td className="sticky right-0 z-10 bg-white text-[8px] font-medium text-gray-700 px-1 py-[2px] border-l border-gray-200">
                                  {unit.name} <span className="text-[6px] text-gray-400">({unit.count})</span>
                                </td>
                                {row.map((val, i) => (
                                  <td key={i} className="text-[7px] text-center text-gray-600 px-[1px] py-[2px]">
                                    <input type="number" value={val} readOnly className="w-full text-[7px] text-center bg-transparent border-0 p-0" />
                                  </td>
                                ))}
                                <td className={`text-[8px] text-center font-bold px-1 py-[2px] border-r border-gray-200 ${rowTotal > unit.count ? "text-red-600" : "text-violet-700"}`}>
                                  {rowTotal}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-violet-50 border-t border-violet-200">
                            <td className="sticky right-0 z-10 bg-violet-50 text-[8px] font-bold text-violet-800 px-1 py-[2px] border-l border-violet-200">الإجمالي</td>
                            {Array.from({ length: SALES_MONTHS }, (_, i) => (
                              <td key={i} className="text-[7px] text-center font-bold text-violet-800 px-[1px] py-[2px]">
                                {UNIT_TYPES.reduce((s, u) => s + (detailedUnits[u.id]?.[i] || 0), 0)}
                              </td>
                            ))}
                            <td className="text-[8px] text-center font-bold text-violet-800 px-1 py-[2px] border-r border-violet-200">{totalSold}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Results (7 cols) */}
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
                    const isNeg = val < 0;
                    return (
                      <div key={i} className="flex-1 relative h-full">
                        <div
                          className={`w-full rounded-[1px] ${isNeg ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ height: `${heightPct}%`, position: "absolute", ...(isNeg ? { top: "50%" } : { bottom: "50%" }) }}
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
                    <td className="px-1 py-[2px] text-[9px] text-center font-bold text-indigo-800">{TOTAL_UNITS}</td>
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
