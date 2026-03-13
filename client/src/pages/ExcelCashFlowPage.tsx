import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  type PhaseDurations,
  type ExpenseItem,
  type QuarterDef,
  type ProjectCosts,
  DEFAULT_DURATIONS,
  calculatePhases,
  getTotalMonths,
  distributeExpense,
  buildQuarters,
  getInvestorExpenses,
  getDefaultCustomDistribution,
  getDefaultRevenue,
  fmt,
  getMonthDate,
  isMonthPaid,
  isCurrentMonth,
} from "@/lib/cashFlowEngine";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";

// Import the CashFlowContext directly
import { useCashFlow } from "@/contexts/CashFlowContext";

// Safe wrapper that returns null when not inside provider
function useCashFlowSafe() {
  try {
    return useCashFlow();
  } catch {
    return null;
  }
}

// ===== PHASE COLORS =====
const PHASE_COLORS: Record<string, { bg: string; header: string; text: string; border: string }> = {
  land: { bg: "bg-stone-100", header: "bg-stone-700 text-white", text: "text-stone-800", border: "border-stone-300" },
  preCon: { bg: "bg-amber-50", header: "bg-amber-700 text-white", text: "text-amber-900", border: "border-amber-200" },
  construction: { bg: "bg-sky-50", header: "bg-sky-800 text-white", text: "text-sky-900", border: "border-sky-200" },
  handover: { bg: "bg-emerald-50", header: "bg-emerald-700 text-white", text: "text-emerald-900", border: "border-emerald-200" },
};

const PROJECT_START = new Date(2026, 3, 1); // April 2026
const TODAY = new Date();

// ===== COMPONENT =====
export default function ExcelCashFlowPage({ embedded }: { embedded?: boolean } = {}) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  // Try shared context first
  const shared = useCashFlowSafe();

  // Local state fallbacks
  const [localProjectId, setLocalProjectId] = useState<number | null>(null);
  const [localDurations, setLocalDurations] = useState<PhaseDurations>({ ...DEFAULT_DURATIONS });
  const [localOverrides, setLocalOverrides] = useState<Record<string, { [month: number]: number }>>({});
  const [localShifts, setLocalShifts] = useState<Record<string, number>>({});

  // Use shared or local
  const selectedProjectId = shared ? shared.selectedProjectId : localProjectId;
  const setSelectedProjectId = shared ? shared.setSelectedProjectId : setLocalProjectId;
  const durations = shared ? shared.durations : localDurations;
  const setDurations = shared ? shared.setDurations : setLocalDurations;
  const expenseOverrides = shared ? shared.investorOverrides : localOverrides;
  const setExpenseOverrides = shared ? shared.setInvestorOverrides : setLocalOverrides;
  const expenseShifts = shared ? shared.investorShifts : localShifts;
  const setExpenseShifts = shared ? shared.setInvestorShifts : setLocalShifts;

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  // Fetch market overview and competition pricing for dynamic costs
  const moQuery = trpc.marketOverview.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId, staleTime: 5000 });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId, staleTime: 5000 });

  // Calculate dynamic costs from project card + market overview + competition pricing
  const projectCosts = useMemo<ProjectCosts | null>(() => {
    if (!selectedProject) return null;
    return calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data);
  }, [selectedProject, moQuery.data, cpQuery.data]);

  const [showControls, setShowControls] = useState(false);
  const [editingCell, setEditingCell] = useState<{ itemId: string; qi: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Calculate phases
  const phases = useMemo(() => calculatePhases(durations), [durations]);
  const totalMonths = useMemo(() => getTotalMonths(durations), [durations]);

  // Build quarters for investor table (includes land)
  const quarters = useMemo(() =>
    buildQuarters(phases, durations, PROJECT_START, false, true),
    [phases, durations]
  );

  // Get base expenses — now dynamic from project data
  const baseExpenses = useMemo(() => getInvestorExpenses(projectCosts || undefined), [projectCosts]);

  // Default revenue for sales-linked items — now dynamic
  const defaultRevenue = useMemo(() => getDefaultRevenue(phases, durations, projectCosts?.totalRevenue), [phases, durations, projectCosts]);

  // Calculate monthly distributions for each expense
  const monthlyDistributions = useMemo(() => {
    return baseExpenses.map(item => {
      const itemWithOverrides: ExpenseItem = {
        ...item,
        overrides: expenseOverrides[item.id],
        shiftMonths: expenseShifts[item.id] || 0,
      };

      if (item.behavior === "CUSTOM") {
        const customDist = getDefaultCustomDistribution(item.id, phases, durations, projectCosts || undefined);
        const merged = { ...customDist };
        if (expenseOverrides[item.id]) {
          for (const [m, v] of Object.entries(expenseOverrides[item.id])) {
            merged[parseInt(m)] = v;
          }
        }
        if (expenseShifts[item.id]) {
          const shifted: { [month: number]: number } = {};
          for (const [m, v] of Object.entries(merged)) {
            const newM = parseInt(m) + (expenseShifts[item.id] || 0);
            if (newM >= 1 && newM <= totalMonths) shifted[newM] = v;
          }
          return shifted;
        }
        return merged;
      }

      return distributeExpense(itemWithOverrides, phases, durations, defaultRevenue);
    });
  }, [baseExpenses, phases, durations, expenseOverrides, expenseShifts, defaultRevenue, totalMonths]);

  // Aggregate to quarters
  const quarterlyData = useMemo(() => {
    return monthlyDistributions.map((monthly, idx) => {
      const qTotals = quarters.map((q, qi) => {
        if (qi === 0) return baseExpenses[idx].behavior === "FIXED_ABSOLUTE" ? baseExpenses[idx].total : 0;
        return q.months.reduce((sum, m) => sum + (monthly[m] || 0), 0);
      });
      return qTotals;
    });
  }, [monthlyDistributions, quarters, baseExpenses]);

  // Row totals
  const rowTotals = useMemo(() => {
    return quarterlyData.map(row => row.reduce((s, v) => s + v, 0));
  }, [quarterlyData]);

  // Column totals
  const colTotals = useMemo(() => {
    return quarters.map((_, qi) => quarterlyData.reduce((sum, row) => sum + row[qi], 0));
  }, [quarterlyData, quarters]);

  // Grand total
  const grandTotal = useMemo(() => rowTotals.reduce((s, v) => s + v, 0), [rowTotals]);

  // Paid vs upcoming
  const paidTotal = useMemo(() => {
    let paid = 0;
    quarters.forEach((q, qi) => {
      if (qi === 0) { paid += colTotals[0]; return; }
      const lastMonth = q.months[q.months.length - 1];
      if (isMonthPaid(lastMonth, PROJECT_START)) {
        paid += colTotals[qi];
      }
    });
    return paid;
  }, [colTotals, quarters]);

  const upcomingTotal = grandTotal - paidTotal;

  // Next 3 months total
  const next3MonthsTotal = useMemo(() => {
    let total = 0;
    const now = new Date();
    for (let m = 1; m <= totalMonths; m++) {
      const d = getMonthDate(m, PROJECT_START);
      if (d >= now) {
        const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
        if (diffMonths >= 0 && diffMonths < 3) {
          monthlyDistributions.forEach((monthly, idx) => {
            if (baseExpenses[idx].behavior !== "FIXED_ABSOLUTE") {
              total += (monthly[m] || 0);
            }
          });
        }
      }
    }
    return total;
  }, [monthlyDistributions, baseExpenses, totalMonths]);

  const next3Label = useMemo(() => {
    const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const s = new Date(TODAY);
    const e = new Date(TODAY);
    e.setMonth(e.getMonth() + 2);
    return `${months[s.getMonth()]} - ${months[e.getMonth()]} ${e.getFullYear()}`;
  }, []);

  // Phase spans for header
  const phaseSpans = useMemo(() => {
    const spans: { phase: string; label: string; count: number }[] = [];
    let current = "";
    quarters.forEach(q => {
      if (q.phaseLabel !== current) {
        spans.push({ phase: q.phase, label: q.phaseLabel, count: 1 });
        current = q.phaseLabel;
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [quarters]);

  // Is quarter paid/current
  const isQPaid = useCallback((q: QuarterDef, qi: number) => {
    if (qi === 0) return true;
    const lastMonth = q.months[q.months.length - 1];
    return isMonthPaid(lastMonth, PROJECT_START);
  }, []);

  const isQCurrent = useCallback((q: QuarterDef, qi: number) => {
    if (qi === 0) return false;
    return q.months.some(m => isCurrentMonth(m, PROJECT_START));
  }, []);

  // Handle cell edit
  const startEdit = (itemId: string, qi: number, currentVal: number) => {
    setEditingCell({ itemId, qi });
    setEditValue(currentVal > 0 ? Math.round(currentVal).toString() : "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { itemId, qi } = editingCell;
    const q = quarters[qi];
    const newVal = parseFloat(editValue.replace(/,/g, "")) || 0;

    const newOverrides = { ...expenseOverrides };
    if (!newOverrides[itemId]) newOverrides[itemId] = {};

    if (q.months.length > 0) {
      const perMonth = newVal / q.months.length;
      q.months.forEach(m => {
        newOverrides[itemId][m] = perMonth;
      });
    }

    setExpenseOverrides(newOverrides);
    setEditingCell(null);
    setEditValue("");
  };

  // Handle shift
  const handleShift = (itemId: string, delta: number) => {
    setExpenseShifts((prev: Record<string, number>) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + delta,
    }));
  };

  // Reset all
  const resetAll = () => {
    if (shared) {
      shared.resetAll();
    } else {
      setDurations({ ...DEFAULT_DURATIONS });
      setExpenseOverrides({});
      setExpenseShifts({});
    }
  };

  const hasChanges = shared ? shared.hasChanges : (
    Object.keys(expenseOverrides).length > 0 || 
    Object.keys(expenseShifts).length > 0 || 
    JSON.stringify(durations) !== JSON.stringify(DEFAULT_DURATIONS)
  );

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gray-50 p-4`} dir="rtl">
      {/* Project Selector */}
      <div className="mb-3 bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-gray-500">اختر المشروع</label>
            <select
              className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium"
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— اختر مشروع —</option>
              {(projectsQuery.data || []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-30">📊</div>
          <h2 className="text-xl font-bold text-gray-400 mb-2">اختر مشروع لعرض التدفقات النقدية</h2>
          <p className="text-sm text-gray-400">اختر مشروع من القائمة أعلاه</p>
        </div>
      ) : (
      <div>
      {/* Title */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900">{selectedProject?.name || "المشروع"} — جدول مصاريف المستثمر</h1>
          <p className="text-xs text-gray-500 mt-0.5">التمويل المباشر من المستثمر (لا يشمل مصاريف حساب الضمان)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>⚙️</span>
            <span>{showControls ? "إخفاء التحكم" : "تعديل المدد والتواريخ"}</span>
          </button>
          {hasChanges && (
            <button
              onClick={resetAll}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              إعادة تعيين الكل
            </button>
          )}
        </div>
      </div>

      {/* === DURATION CONTROLS === */}
      {showControls && (
        <div className="mb-4 bg-gradient-to-l from-indigo-50 to-white rounded-lg border-2 border-indigo-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-700 text-white px-4 py-2 flex items-center gap-2">
            <span>⚙️</span>
            <span className="text-xs font-bold">لوحة التحكم — تعديل مدد المراحل</span>
            {shared && <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded mr-2">🔗 مشترك مع الإسكرو</span>}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Pre-construction duration */}
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                <div className="text-[10px] font-bold text-amber-800 mb-2">ما قبل البناء</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, preCon: Math.max(3, d.preCon - 1) }))}
                    className="w-7 h-7 rounded bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-amber-900">{durations.preCon}</span>
                    <span className="text-[10px] text-amber-600 mr-1">شهر</span>
                  </div>
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, preCon: Math.min(12, d.preCon + 1) }))}
                    className="w-7 h-7 rounded bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold text-sm flex items-center justify-center"
                  >+</button>
                </div>
                {durations.preCon !== DEFAULT_DURATIONS.preCon && (
                  <div className="text-[9px] text-amber-600 text-center mt-1">
                    الأصل: {DEFAULT_DURATIONS.preCon} شهر
                  </div>
                )}
              </div>

              {/* Construction duration */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 p-3">
                <div className="text-[10px] font-bold text-sky-800 mb-2">البناء</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, construction: Math.max(6, d.construction - 1) }))}
                    className="w-7 h-7 rounded bg-sky-200 hover:bg-sky-300 text-sky-800 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-sky-900">{durations.construction}</span>
                    <span className="text-[10px] text-sky-600 mr-1">شهر</span>
                  </div>
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, construction: Math.min(36, d.construction + 1) }))}
                    className="w-7 h-7 rounded bg-sky-200 hover:bg-sky-300 text-sky-800 font-bold text-sm flex items-center justify-center"
                  >+</button>
                </div>
                {durations.construction !== DEFAULT_DURATIONS.construction && (
                  <div className="text-[9px] text-sky-600 text-center mt-1">
                    الأصل: {DEFAULT_DURATIONS.construction} شهر
                  </div>
                )}
              </div>

              {/* Handover duration */}
              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3">
                <div className="text-[10px] font-bold text-emerald-800 mb-2">التسليم</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, handover: Math.max(1, d.handover - 1) }))}
                    className="w-7 h-7 rounded bg-emerald-200 hover:bg-emerald-300 text-emerald-800 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-emerald-900">{durations.handover}</span>
                    <span className="text-[10px] text-emerald-600 mr-1">شهر</span>
                  </div>
                  <button
                    onClick={() => setDurations((d: PhaseDurations) => ({ ...d, handover: Math.min(6, d.handover + 1) }))}
                    className="w-7 h-7 rounded bg-emerald-200 hover:bg-emerald-300 text-emerald-800 font-bold text-sm flex items-center justify-center"
                  >+</button>
                </div>
                {durations.handover !== DEFAULT_DURATIONS.handover && (
                  <div className="text-[9px] text-emerald-600 text-center mt-1">
                    الأصل: {DEFAULT_DURATIONS.handover} شهر
                  </div>
                )}
              </div>
            </div>

            {/* Total duration info */}
            <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-600">
                إجمالي المدة: <span className="font-bold text-gray-900">{totalMonths} شهر</span>
                <span className="text-gray-400 mx-2">|</span>
                الأصل: <span className="text-gray-500">{getTotalMonths(DEFAULT_DURATIONS)} شهر</span>
              </div>
              <div className="text-[10px] text-gray-500">
                تغيير المدة يعيد توزيع المصاريف تلقائياً حسب طبيعة كل بند
                {shared && <span className="text-indigo-600 mr-2">• التغييرات تنعكس على جدول الإسكرو</span>}
              </div>
            </div>

            {/* Expense shift controls */}
            {Object.keys(expenseShifts).filter(k => expenseShifts[k] !== 0).length > 0 && (
              <div className="mt-3 bg-orange-50 rounded-lg border border-orange-200 px-3 py-2">
                <div className="text-[10px] font-bold text-orange-800 mb-1">التحريك (Shift) النشط:</div>
                {Object.entries(expenseShifts).filter(([_, v]) => v !== 0).map(([id, shift]) => {
                  const item = baseExpenses.find(e => e.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-[10px] py-0.5">
                      <span className="text-gray-700">{item?.name}</span>
                      <div className="flex items-center gap-1">
                        <span className={shift > 0 ? "text-red-600" : "text-green-600"}>
                          {shift > 0 ? `تأخير ${shift} شهر` : `تبكير ${Math.abs(shift)} شهر`}
                        </span>
                        <button
                          onClick={() => setExpenseShifts((prev: Record<string, number>) => { const n = { ...prev }; delete n[id]; return n; })}
                          className="text-gray-400 hover:text-red-500 mr-1"
                        >✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-gray-500">إجمالي المصاريف</div>
          <div className="text-sm font-bold text-gray-900">{fmt(grandTotal)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-green-600">تم دفعه ✓</div>
          <div className="text-sm font-bold text-green-700">{fmt(paidTotal)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border border-orange-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-orange-600">المتبقي</div>
          <div className="text-sm font-bold text-orange-700">{fmt(upcomingTotal)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border-2 border-red-300 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-red-600 font-medium">المطلوب للـ 3 أشهر القادمة</div>
          <div className="text-[9px] text-red-400">{next3Label}</div>
          <div className="text-sm font-bold text-red-700">{fmt(next3MonthsTotal)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            {/* Phase header */}
            <tr>
              <th className="bg-gray-800 text-white px-1 py-1.5 text-right font-medium border-l border-gray-600 w-[140px] text-[10px] sticky right-0 z-10">البند</th>
              <th className="bg-gray-800 text-white px-1 py-1.5 text-center font-medium border-l border-gray-600 w-[70px] text-[10px]">الإجمالي</th>
              {showControls && (
                <th className="bg-gray-800 text-white px-1 py-1.5 text-center font-medium border-l border-gray-600 w-[50px] text-[10px]">تحريك</th>
              )}
              {phaseSpans.map((span, i) => (
                <th
                  key={i}
                  colSpan={span.count}
                  className={`${PHASE_COLORS[span.phase]?.header || "bg-gray-700 text-white"} px-1 py-1.5 text-center font-medium border-l border-gray-600 text-[10px]`}
                >
                  {span.label}
                </th>
              ))}
            </tr>
            {/* Quarter labels */}
            <tr className="bg-gray-100">
              <th className="bg-gray-100 px-1 py-1 text-right text-gray-500 border-l border-gray-200 text-[9px] sticky right-0 z-10">الفترة</th>
              <th className="bg-gray-100 px-1 py-1 text-center text-gray-500 border-l border-gray-200 text-[9px]">(درهم)</th>
              {showControls && <th className="bg-gray-100 px-1 py-1 text-center text-gray-400 border-l border-gray-200 text-[8px]">◄ ►</th>}
              {quarters.map((q, qi) => {
                const isPaid = isQPaid(q, qi);
                const isCurrent = isQCurrent(q, qi);
                return (
                  <th
                    key={qi}
                    className={`px-1 py-1 text-center border-l border-gray-200 text-[9px] ${
                      isCurrent ? "bg-yellow-100 font-bold text-yellow-800" :
                      isPaid ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {q.label}
                    {isCurrent && <div className="text-[8px] text-yellow-600">◄ الآن</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {baseExpenses.map((item, idx) => (
              <tr key={item.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors`}>
                <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-inherit">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] opacity-40">
                      {item.behavior === "DISTRIBUTED" ? "📊" :
                       item.behavior === "FIXED_RELATIVE" ? "📌" :
                       item.behavior === "FIXED_ABSOLUTE" ? "🔒" :
                       item.behavior === "PERIODIC" ? "🔄" :
                       item.behavior === "SALES_LINKED" ? "💰" : "⚙️"}
                    </span>
                    <span>{item.name}</span>
                  </div>
                </td>
                <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                  {fmt(rowTotals[idx])}
                </td>
                {showControls && (
                  <td className="px-1 py-1 text-center border-l border-gray-100 text-[10px]">
                    {item.behavior !== "FIXED_ABSOLUTE" && (
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleShift(item.id, -1)}
                          className="w-4 h-4 rounded bg-green-100 hover:bg-green-200 text-green-700 text-[9px] flex items-center justify-center"
                          title="تبكير شهر"
                        >◄</button>
                        <button
                          onClick={() => handleShift(item.id, 1)}
                          className="w-4 h-4 rounded bg-red-100 hover:bg-red-200 text-red-700 text-[9px] flex items-center justify-center"
                          title="تأخير شهر"
                        >►</button>
                      </div>
                    )}
                  </td>
                )}
                {quarters.map((q, qi) => {
                  const val = quarterlyData[idx][qi];
                  const isPaid = isQPaid(q, qi);
                  const isCurrent = isQCurrent(q, qi);
                  const colors = PHASE_COLORS[q.phase] || PHASE_COLORS.land;
                  const isEditing = editingCell?.itemId === item.id && editingCell?.qi === qi;
                  const hasOverride = item.id in expenseOverrides && q.months.some(m => m in (expenseOverrides[item.id] || {}));

                  return (
                    <td
                      key={qi}
                      className={`px-1 py-1 text-center border-l tabular-nums text-[10px] cursor-pointer ${
                        val === 0 ? "text-gray-300" :
                        isPaid ? "bg-gray-100 text-gray-400 line-through" :
                        isCurrent ? `bg-yellow-50 font-bold ${colors.text}` :
                        `${colors.bg} ${colors.text}`
                      } ${colors.border} ${hasOverride ? "ring-1 ring-orange-400" : ""}`}
                      onDoubleClick={() => {
                        if (item.behavior !== "FIXED_ABSOLUTE" && qi > 0) {
                          startEdit(item.id, qi, val);
                        }
                      }}
                      title={item.behavior !== "FIXED_ABSOLUTE" && qi > 0 ? "انقر مرتين للتعديل" : ""}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                          className="w-full text-center text-[10px] border border-indigo-400 rounded px-0.5 py-0 outline-none bg-white"
                          autoFocus
                        />
                      ) : (
                        val === 0 ? "-" : fmt(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Total row */}
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="px-1 py-1 text-right border-l border-gray-200 font-medium text-gray-700 text-[10px] sticky right-0 z-10 bg-gray-100">إجمالي رأس مال المشروع</td>
              <td className="px-1 py-1 text-center border-l border-gray-200 font-bold text-gray-800 tabular-nums text-[10px]">{fmt(grandTotal)}</td>
              {showControls && <td className="border-l border-gray-200"></td>}
              {quarters.map((_, qi) => (
                <td key={qi} className="px-1 py-1 text-center border-l border-gray-200 tabular-nums text-gray-600 text-[10px]">
                  {colTotals[qi] === 0 ? "-" : fmt(colTotals[qi])}
                </td>
              ))}
            </tr>

            {/* Paid row */}
            <tr className="bg-green-50 border-t border-gray-200">
              <td className="px-1 py-1 text-right border-l border-gray-200 font-medium text-green-700 text-[10px] sticky right-0 z-10 bg-green-50">المبالغ المدفوعة</td>
              <td className="px-1 py-1 text-center border-l border-gray-200 font-bold text-green-700 tabular-nums text-[10px]">{fmt(paidTotal)}</td>
              {showControls && <td className="border-l border-gray-200"></td>}
              {quarters.map((q, qi) => {
                const val = colTotals[qi];
                const isPaid = isQPaid(q, qi);
                return (
                  <td key={qi} className="px-1 py-1 text-center border-l border-gray-200 tabular-nums text-[10px] text-green-600">
                    {isPaid && val > 0 ? fmt(val) : "-"}
                  </td>
                );
              })}
            </tr>

            {/* Remaining row */}
            <tr className="bg-indigo-700 text-white font-bold border-t-2 border-indigo-500">
              <td className="px-2 py-2 text-right border-l border-indigo-500 text-xs sticky right-0 z-10 bg-indigo-700">رأس المال المطلوب سداده</td>
              <td className="px-2 py-2 text-center border-l border-indigo-500 tabular-nums text-xs">{fmt(upcomingTotal)}</td>
              {showControls && <td className="border-l border-indigo-500"></td>}
              {quarters.map((q, qi) => {
                const val = colTotals[qi];
                const isPaid = isQPaid(q, qi);
                const isCurrent = isQCurrent(q, qi);
                return (
                  <td
                    key={qi}
                    className={`px-2 py-2 text-center border-l border-indigo-500 tabular-nums text-xs ${
                      isPaid ? "text-indigo-300" : isCurrent ? "text-yellow-300" : ""
                    }`}
                  >
                    {isPaid ? "-" : val === 0 ? "-" : fmt(val)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-200 rounded-sm border border-gray-300 inline-block"></span>
          <span className="line-through text-gray-400">تم الدفع</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-100 rounded-sm border border-yellow-300 inline-block"></span>
          الفترة الحالية
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-stone-100 rounded-sm border border-stone-300 inline-block"></span>
          شراء الأرض
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-amber-50 rounded-sm border border-amber-200 inline-block"></span>
          ما قبل البناء
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-sky-50 rounded-sm border border-sky-200 inline-block"></span>
          البناء
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-emerald-50 rounded-sm border border-emerald-200 inline-block"></span>
          التسليم
        </div>
        <div className="border-r border-gray-300 h-3 mx-1"></div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">🔒</span> ثابت
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">📌</span> نسبي
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">📊</span> موزع
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">🔄</span> دوري
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">💰</span> مبيعات
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">⚙️</span> مخصص
        </div>
        {showControls && (
          <div className="flex items-center gap-1 text-orange-500">
            <span className="w-3 h-3 rounded-sm ring-1 ring-orange-400 inline-block"></span>
            معدّل يدوياً
          </div>
        )}
      </div>

      {showControls && (
        <div className="mt-2 text-[9px] text-gray-400">
          💡 انقر مرتين على أي خلية لتعديل قيمتها يدوياً | استخدم أزرار ◄ ► لتحريك المصروف بشهر
        </div>
      )}
      </div>
      )}
    </div>
  );
}
