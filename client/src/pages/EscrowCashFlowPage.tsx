import { useMemo, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  type PhaseDurations,
  type ExpenseItem,
  type QuarterDef,
  DEFAULT_DURATIONS,
  calculatePhases,
  getTotalMonths,
  getPhaseMonthRange,
  distributeExpense,
  buildQuarters,
  getEscrowExpenses,
  getDefaultCustomDistribution,
  getDefaultRevenue,
  fmt,
  fmtSigned,
  getMonthDate,
  isMonthPaid,
  isCurrentMonth,
  CONSTRUCTION_COST,
  SALES_VALUE,
} from "@/lib/cashFlowEngine";

// ===== PHASE COLORS =====
const PHASE_COLORS: Record<string, { bg: string; header: string; text: string; border: string }> = {
  opening: { bg: "bg-indigo-50", header: "bg-indigo-800 text-white", text: "text-indigo-900", border: "border-indigo-200" },
  construction: { bg: "bg-sky-50", header: "bg-sky-800 text-white", text: "text-sky-900", border: "border-sky-200" },
  handover: { bg: "bg-emerald-50", header: "bg-emerald-700 text-white", text: "text-emerald-900", border: "border-emerald-200" },
};

const PROJECT_START = new Date(2026, 3, 1); // April 2026

// ===== COMPONENT =====
export default function EscrowCashFlowPage() {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  // === DYNAMIC DURATIONS ===
  const [durations, setDurations] = useState<PhaseDurations>({ ...DEFAULT_DURATIONS });
  const [showControls, setShowControls] = useState(false);

  // === EXPENSE OVERRIDES & SHIFTS ===
  const [expenseOverrides, setExpenseOverrides] = useState<Record<string, { [month: number]: number }>>({});
  const [expenseShifts, setExpenseShifts] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<{ itemId: string; qi: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Calculate phases
  const phases = useMemo(() => calculatePhases(durations), [durations]);
  const totalMonths = useMemo(() => getTotalMonths(durations), [durations]);

  // Opening balance = 20% of construction cost
  const openingBalance = CONSTRUCTION_COST * 0.20;

  // Build quarters for escrow (includes opening, skips land & preCon)
  const quarters = useMemo(() =>
    buildQuarters(phases, durations, PROJECT_START, true, false),
    [phases, durations]
  );

  // Get base expenses
  const baseExpenses = useMemo(() => getEscrowExpenses(), []);

  // Revenue state (editable)
  const defaultRevenue = useMemo(() => getDefaultRevenue(phases, durations), [phases, durations]);
  const [revenueData, setRevenueData] = useState<{ [month: number]: number }>({});
  const activeRevenue = useMemo(() => {
    return Object.keys(revenueData).length > 0 ? revenueData : defaultRevenue;
  }, [revenueData, defaultRevenue]);

  // Calculate monthly distributions for each expense
  const monthlyDistributions = useMemo(() => {
    return baseExpenses.map(item => {
      const itemWithOverrides: ExpenseItem = {
        ...item,
        overrides: expenseOverrides[item.id],
        shiftMonths: expenseShifts[item.id] || 0,
      };

      if (item.behavior === "CUSTOM") {
        const customDist = getDefaultCustomDistribution(item.id, phases, durations);
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

      return distributeExpense(itemWithOverrides, phases, durations, activeRevenue);
    });
  }, [baseExpenses, phases, durations, expenseOverrides, expenseShifts, activeRevenue, totalMonths]);

  // Aggregate expenses to quarters
  const quarterlyExpenses = useMemo(() => {
    return monthlyDistributions.map(monthly => {
      return quarters.map((q, qi) => {
        if (qi === 0) return 0; // opening balance column
        return q.months.reduce((sum, m) => sum + (monthly[m] || 0), 0);
      });
    });
  }, [monthlyDistributions, quarters]);

  // Row totals
  const expenseRowTotals = useMemo(() => {
    return quarterlyExpenses.map(row => row.reduce((s, v) => s + v, 0));
  }, [quarterlyExpenses]);

  // Expense column totals
  const expenseColTotals = useMemo(() => {
    return quarters.map((_, qi) => quarterlyExpenses.reduce((sum, row) => sum + row[qi], 0));
  }, [quarterlyExpenses, quarters]);

  // Quarterly revenue totals
  const quarterlyRevenue = useMemo(() => {
    return quarters.map((q, qi) => {
      if (qi === 0) return 0;
      return q.months.reduce((sum, m) => sum + (activeRevenue[m] || 0), 0);
    });
  }, [activeRevenue, quarters]);

  // Total revenue & expenses
  const totalRevenue = useMemo(() => Object.values(activeRevenue).reduce((s, v) => s + v, 0), [activeRevenue]);
  const totalExpenses = useMemo(() => expenseRowTotals.reduce((s, v) => s + v, 0), [expenseRowTotals]);

  // Running escrow balance
  const escrowBalance = useMemo(() => {
    const balances: number[] = [];
    let running = openingBalance;
    quarters.forEach((q, qi) => {
      if (qi === 0) {
        balances.push(running);
      } else {
        running = running + quarterlyRevenue[qi] - expenseColTotals[qi];
        balances.push(running);
      }
    });
    return balances;
  }, [openingBalance, quarterlyRevenue, expenseColTotals, quarters]);

  // Net flow per quarter
  const netFlow = useMemo(() => {
    return quarters.map((_, qi) => {
      if (qi === 0) return openingBalance;
      return quarterlyRevenue[qi] - expenseColTotals[qi];
    });
  }, [quarterlyRevenue, expenseColTotals, openingBalance, quarters]);

  // Phase spans for header
  const phaseSpans = useMemo(() => {
    const spans: { phase: string; label: string; count: number }[] = [];
    let current = "";
    quarters.forEach(q => {
      if (q.phaseLabel !== current) {
        spans.push({ phase: q.phase as string, label: q.phaseLabel, count: 1 });
        current = q.phaseLabel;
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [quarters]);

  // Is quarter paid/current
  const isQPaid = useCallback((q: QuarterDef, qi: number) => {
    if (qi === 0) return false;
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
    setExpenseShifts(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + delta,
    }));
  };

  // Reset all
  const resetAll = () => {
    setDurations({ ...DEFAULT_DURATIONS });
    setExpenseOverrides({});
    setExpenseShifts({});
    setRevenueData({});
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
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
          <div className="text-5xl mb-4 opacity-30">🏦</div>
          <h2 className="text-xl font-bold text-gray-400 mb-2">اختر مشروع لعرض حساب الضمان</h2>
          <p className="text-sm text-gray-400">اختر مشروع من القائمة أعلاه</p>
        </div>
      ) : (
      <div>
      {/* Title */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900">{selectedProject?.name || "المشروع"} — حساب الضمان (الإسكرو)</h1>
          <p className="text-xs text-gray-500 mt-0.5">مصاريف البناء + إيرادات المبيعات + رصيد حساب الضمان</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>⚙️</span>
            <span>{showControls ? "إخفاء التحكم" : "تعديل المدد والتواريخ"}</span>
          </button>
          {(Object.keys(expenseOverrides).length > 0 || Object.keys(expenseShifts).length > 0 || Object.keys(revenueData).length > 0 || JSON.stringify(durations) !== JSON.stringify(DEFAULT_DURATIONS)) && (
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
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Construction duration */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 p-3">
                <div className="text-[10px] font-bold text-sky-800 mb-2">مدة البناء</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDurations(d => ({ ...d, construction: Math.max(6, d.construction - 1) }))}
                    className="w-7 h-7 rounded bg-sky-200 hover:bg-sky-300 text-sky-800 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-sky-900">{durations.construction}</span>
                    <span className="text-[10px] text-sky-600 mr-1">شهر</span>
                  </div>
                  <button
                    onClick={() => setDurations(d => ({ ...d, construction: Math.min(36, d.construction + 1) }))}
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
                <div className="text-[10px] font-bold text-emerald-800 mb-2">مدة التسليم</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDurations(d => ({ ...d, handover: Math.max(1, d.handover - 1) }))}
                    className="w-7 h-7 rounded bg-emerald-200 hover:bg-emerald-300 text-emerald-800 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-emerald-900">{durations.handover}</span>
                    <span className="text-[10px] text-emerald-600 mr-1">شهر</span>
                  </div>
                  <button
                    onClick={() => setDurations(d => ({ ...d, handover: Math.min(6, d.handover + 1) }))}
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

            {/* Info bar */}
            <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-600">
                مدة الإسكرو: <span className="font-bold text-gray-900">{durations.construction + durations.handover} شهر</span>
              </div>
              <div className="text-[10px] text-gray-500">
                تغيير المدة يعيد توزيع المصاريف والإيرادات تلقائياً
              </div>
            </div>

            {/* Active shifts */}
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
                          onClick={() => setExpenseShifts(prev => { const n = { ...prev }; delete n[id]; return n; })}
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
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="bg-white rounded-lg border border-indigo-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-indigo-600">الرصيد الافتتاحي (20%)</div>
          <div className="text-sm font-bold text-indigo-800">{fmt(openingBalance)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-red-600">إجمالي المصاريف</div>
          <div className="text-sm font-bold text-red-700">{fmt(totalExpenses)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-green-600">إجمالي الإيرادات المخططة</div>
          <div className="text-sm font-bold text-green-700">{fmt(totalRevenue)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className="bg-white rounded-lg border border-blue-200 px-3 py-2 shadow-sm">
          <div className="text-[10px] text-blue-600">قيمة المبيعات الكلية</div>
          <div className="text-sm font-bold text-blue-700">{fmt(SALES_VALUE)} <span className="text-[10px] font-normal text-gray-400">درهم</span></div>
        </div>
        <div className={`bg-white rounded-lg border-2 px-3 py-2 shadow-sm ${escrowBalance[escrowBalance.length - 1] >= 0 ? 'border-green-300' : 'border-red-300'}`}>
          <div className="text-[10px] text-gray-600">الرصيد النهائي</div>
          <div className={`text-sm font-bold ${escrowBalance[escrowBalance.length - 1] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmtSigned(escrowBalance[escrowBalance.length - 1])} <span className="text-[10px] font-normal text-gray-400">درهم</span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
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
                      qi === 0 ? "bg-indigo-50 text-indigo-700 font-bold" :
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
            {/* ===== EXPENSES SECTION ===== */}
            <tr className="bg-red-50">
              <td colSpan={2 + quarters.length + (showControls ? 1 : 0)} className="px-2 py-1 text-right font-bold text-red-800 text-[10px] border-b border-red-200">
                📤 المصاريف (خصم من حساب الضمان)
              </td>
            </tr>
            {baseExpenses.map((item, idx) => (
              <tr key={item.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-red-50/30 transition-colors`}>
                <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-inherit">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] opacity-40">
                      {item.behavior === "DISTRIBUTED" ? "📊" :
                       item.behavior === "PERIODIC" ? "🔄" :
                       item.behavior === "SALES_LINKED" ? "💰" : "⚙️"}
                    </span>
                    <span>{item.name}</span>
                  </div>
                </td>
                <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                  {fmt(expenseRowTotals[idx])}
                </td>
                {showControls && (
                  <td className="px-1 py-1 text-center border-l border-gray-100 text-[10px]">
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
                  </td>
                )}
                {quarters.map((q, qi) => {
                  const val = quarterlyExpenses[idx][qi];
                  const isPaid = isQPaid(q, qi);
                  const isCurrent = isQCurrent(q, qi);
                  const colors = PHASE_COLORS[q.phase as string] || PHASE_COLORS.construction;
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
                        if (qi > 0) startEdit(item.id, qi, val);
                      }}
                      title={qi > 0 ? "انقر مرتين للتعديل" : ""}
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

            {/* Expense totals row */}
            <tr className="bg-red-100 border-t-2 border-red-300">
              <td className="px-1 py-1 text-right border-l border-red-200 font-bold text-red-800 text-[10px] sticky right-0 z-10 bg-red-100">إجمالي المصاريف</td>
              <td className="px-1 py-1 text-center border-l border-red-200 font-bold text-red-800 tabular-nums text-[10px]">{fmt(totalExpenses)}</td>
              {showControls && <td className="border-l border-red-200"></td>}
              {quarters.map((_, qi) => (
                <td key={qi} className="px-1 py-1 text-center border-l border-red-200 tabular-nums font-bold text-red-700 text-[10px]">
                  {expenseColTotals[qi] === 0 ? "-" : fmt(expenseColTotals[qi])}
                </td>
              ))}
            </tr>

            {/* ===== REVENUE SECTION ===== */}
            <tr className="bg-green-50 border-t-2 border-green-300">
              <td colSpan={2 + quarters.length + (showControls ? 1 : 0)} className="px-2 py-1 text-right font-bold text-green-800 text-[10px] border-b border-green-200">
                📥 الإيرادات (إيداع في حساب الضمان)
              </td>
            </tr>
            <tr className="bg-white hover:bg-green-50/30 transition-colors">
              <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px] sticky right-0 z-10 bg-white">
                إيرادات المبيعات
              </td>
              <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-green-700 tabular-nums text-[10px]">
                {fmt(totalRevenue)}
              </td>
              {showControls && <td className="border-l border-gray-100"></td>}
              {quarters.map((q, qi) => {
                const val = quarterlyRevenue[qi];
                const colors = PHASE_COLORS[q.phase as string] || PHASE_COLORS.construction;
                return (
                  <td
                    key={qi}
                    className={`px-1 py-1 text-center border-l tabular-nums text-[10px] ${
                      val === 0 ? "text-gray-300" : `${colors.bg} text-green-700 font-medium`
                    } ${colors.border}`}
                  >
                    {val === 0 ? "-" : fmt(val)}
                  </td>
                );
              })}
            </tr>

            {/* ===== NET FLOW ===== */}
            <tr className="bg-blue-50 border-t-2 border-blue-300">
              <td className="px-1 py-1 text-right border-l border-blue-200 font-bold text-blue-800 text-[10px] sticky right-0 z-10 bg-blue-50">صافي التدفق</td>
              <td className="px-1 py-1 text-center border-l border-blue-200 font-bold text-blue-800 tabular-nums text-[10px]">
                {fmtSigned(openingBalance + totalRevenue - totalExpenses)}
              </td>
              {showControls && <td className="border-l border-blue-200"></td>}
              {quarters.map((_, qi) => (
                <td key={qi} className={`px-1 py-1 text-center border-l border-blue-200 tabular-nums font-bold text-[10px] ${
                  netFlow[qi] > 0 ? "text-green-700" : netFlow[qi] < 0 ? "text-red-700" : "text-gray-400"
                }`}>
                  {fmtSigned(netFlow[qi])}
                </td>
              ))}
            </tr>

            {/* ===== ESCROW BALANCE ===== */}
            <tr className="bg-gray-800 text-white font-bold border-t border-gray-600">
              <td className="px-1 py-1.5 text-right border-l border-gray-600 text-[10px] sticky right-0 z-10 bg-gray-800">🏦 رصيد حساب الضمان</td>
              <td className="px-1 py-1.5 text-center border-l border-gray-600 tabular-nums text-[10px]">—</td>
              {showControls && <td className="border-l border-gray-600"></td>}
              {quarters.map((_, qi) => (
                <td
                  key={qi}
                  className={`px-1 py-1.5 text-center border-l border-gray-600 tabular-nums text-[10px] ${
                    escrowBalance[qi] < 0 ? "text-red-400 bg-red-900/30" : "text-green-400"
                  }`}
                >
                  {fmtSigned(escrowBalance[qi])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Warning if balance goes negative */}
      {escrowBalance.some(b => b < 0) && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-sm font-bold text-red-800">تحذير: رصيد حساب الضمان سالب</div>
              <div className="text-xs text-red-600 mt-1">
                حساب الضمان يحتاج إيرادات إضافية لتغطية المصاريف. يمكنك تعديل خطة المبيعات أدناه لموازنة الحساب.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Planning Section */}
      <div className="mt-4 bg-white rounded-lg border border-green-200 shadow-sm overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <span className="text-xs font-bold">تخطيط الإيرادات — توزيع المبيعات على الفترات</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] opacity-80">إجمالي المبيعات: {fmt(SALES_VALUE)} درهم</span>
            <span className="text-[10px] opacity-80">|</span>
            <span className="text-[10px] opacity-80">المخطط: {fmt(totalRevenue)} درهم</span>
            <span className={`text-[10px] font-bold ${totalRevenue >= totalExpenses - openingBalance ? 'text-green-200' : 'text-red-300'}`}>
              ({Math.round(totalRevenue / SALES_VALUE * 100)}%)
            </span>
            <button
              onClick={() => setRevenueData({})}
              className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
        <div className="p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quarters.length - 1}, minmax(0, 1fr))` }}>
            {quarters.slice(1).map((q, i) => {
              const qi = i + 1;
              const qRevenue = quarterlyRevenue[qi];
              const pct = SALES_VALUE > 0 ? Math.round(qRevenue / SALES_VALUE * 100) : 0;
              return (
                <div key={qi} className="text-center">
                  <div className="text-[9px] text-gray-500 mb-1">{q.label}</div>
                  <input
                    type="text"
                    value={qRevenue > 0 ? Math.round(qRevenue).toLocaleString("en-US") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const num = parseFloat(raw) || 0;
                      const newData = { ...activeRevenue };
                      q.months.forEach(m => {
                        newData[m] = num / q.months.length;
                      });
                      setRevenueData(newData);
                    }}
                    className="w-full text-center text-[10px] border border-gray-200 rounded px-1 py-1.5 tabular-nums focus:border-green-400 focus:ring-1 focus:ring-green-200 outline-none"
                    placeholder="0"
                  />
                  <div className="text-[8px] text-gray-400 mt-0.5">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-indigo-100 rounded-sm border border-indigo-200 inline-block"></span>
          الرصيد الافتتاحي
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-sky-50 rounded-sm border border-sky-200 inline-block"></span>
          البناء
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-emerald-50 rounded-sm border border-emerald-200 inline-block"></span>
          التسليم
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-100 rounded-sm border border-red-300 inline-block"></span>
          <span className="text-red-600">رصيد سالب (تحذير)</span>
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
