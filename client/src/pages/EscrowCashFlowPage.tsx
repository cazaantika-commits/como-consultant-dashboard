import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ===== DATES =====
// Month 1 = April 2026, Pre-construction: M1-M6 (Apr-Sep 2026)
// Construction: M7-M22 (Oct 2026 - Jan 2028) = 16 months
// Handover: M23-M24 (Feb-Mar 2028)
const PROJECT_START = new Date(2026, 3, 1); // April 2026
const TODAY = new Date();

function getMonthDate(monthNum: number): Date {
  const d = new Date(PROJECT_START);
  d.setMonth(d.getMonth() + monthNum - 1);
  return d;
}

function formatQuarter(startMonth: number): string {
  const d = getMonthDate(startMonth);
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isQuarterPaid(endMonth: number): boolean {
  const endDate = getMonthDate(endMonth);
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate <= TODAY;
}

function isCurrentQuarter(startMonth: number, endMonth: number): boolean {
  for (let m = startMonth; m <= endMonth; m++) {
    const d = getMonthDate(m);
    if (d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()) return true;
  }
  return false;
}

// ===== QUARTERLY STRUCTURE (Construction + Handover only for Escrow) =====
interface Quarter {
  label: string;
  months: number[];
  phase: "opening" | "construction" | "handover";
  phaseLabel: string;
}

// Escrow starts at construction (M7) with opening balance from M6
const ESCROW_QUARTERS: Quarter[] = [
  // Opening balance column
  { label: "رصيد افتتاحي", months: [], phase: "opening", phaseLabel: "الرصيد الافتتاحي" },
  // Construction: M7-M22
  { label: formatQuarter(7), months: [7,8,9], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(10), months: [10,11,12], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(13), months: [13,14,15], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(16), months: [16,17,18], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(19), months: [19,20,21], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(22), months: [22], phase: "construction", phaseLabel: "البناء" },
  // Handover: M23-M24
  { label: formatQuarter(23), months: [23,24], phase: "handover", phaseLabel: "التسليم" },
];

// ===== PHASE COLORS =====
const PHASE_COLORS: Record<string, { bg: string; header: string; text: string; border: string }> = {
  opening: { bg: "bg-indigo-50", header: "bg-indigo-800 text-white", text: "text-indigo-900", border: "border-indigo-200" },
  construction: { bg: "bg-sky-50", header: "bg-sky-800 text-white", text: "text-sky-900", border: "border-sky-200" },
  handover: { bg: "bg-emerald-50", header: "bg-emerald-700 text-white", text: "text-emerald-900", border: "border-emerald-200" },
};

// ===== ESCROW EXPENSE ITEMS (from Excel) =====
type MonthData = { [month: number]: number };

interface EscrowItem {
  name: string;
  total: number;
  monthly: MonthData;
}

// Construction cost base = 39,427,980
const CONSTRUCTION_COST = 39427980;
const SALES_VALUE = 93765000;

const ESCROW_EXPENSES: EscrowItem[] = [
  {
    name: "رسوم الجهات الحكومية",
    total: 1000000,
    monthly: { 9: 800000, 10: 50000, 14: 50000, 18: 50000, 22: 50000 }
  },
  {
    name: "دفعات المقاول (85%)",
    total: 33513783,
    monthly: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i + 7, 1861876.83])
    )
  },
  {
    name: "أتعاب الإشراف (2%)",
    total: 788559.6,
    monthly: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i + 7, 43808.87])
    )
  },
  {
    name: "عمولة وكيل المبيعات (5%)",
    total: 4688250,
    monthly: { 9: 703237.5, 10: 937650, 11: 937650, 12: 468825, 13: 468825, 14: 468825, 15: 703237.5 }
  },
  {
    name: "تقارير تدقيق ريرا",
    total: 18000,
    monthly: { 9: 3000, 12: 3000, 15: 3000, 18: 3000, 21: 3000, 24: 3000 }
  },
  {
    name: "تقارير تفتيش ريرا",
    total: 105000,
    monthly: { 9: 15000, 12: 15000, 15: 15000, 18: 15000, 21: 15000, 24: 15000 }
  },
];

// ===== DEFAULT REVENUE PLAN =====
// Revenue from unit sales - distributed across construction period
// Total sales = 93,765,000 AED
// Default plan: sales start M9 (3 months into construction) with typical payment schedule
const DEFAULT_REVENUE: MonthData = {
  // Off-plan sales start M9 (Dec 2026) - booking deposits
  9: 9376500,    // 10% - initial launch
  10: 9376500,   // 10%
  11: 4688250,   // 5%
  12: 4688250,   // 5%
  // Construction progress payments
  13: 4688250,   // 5%
  14: 4688250,   // 5%
  15: 4688250,   // 5%
  16: 4688250,   // 5%
  17: 4688250,   // 5%
  18: 4688250,   // 5%
  19: 4688250,   // 5%
  20: 4688250,   // 5%
  21: 4688250,   // 5%
  // Final payments at handover
  22: 4688250,   // 5%
  23: 9376500,   // 10%
  24: 9376500,   // 10%
};

// ===== FORMAT =====
function fmt(n: number): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("en-US");
}

function fmtSigned(n: number): string {
  if (Math.abs(n) < 1) return "-";
  const formatted = Math.round(Math.abs(n)).toLocaleString("en-US");
  if (n < 0) return `(${formatted})`;
  return formatted;
}

// ===== COMPONENT =====
export default function EscrowCashFlowPage() {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  // Opening balance = 20% of construction cost
  const openingBalance = CONSTRUCTION_COST * 0.20; // 7,885,596

  // Revenue state (editable)
  const [revenueData, setRevenueData] = useState<MonthData>({ ...DEFAULT_REVENUE });

  // Calculate quarterly expense totals
  const quarterlyExpenses = useMemo(() => {
    return ESCROW_EXPENSES.map(item => {
      return ESCROW_QUARTERS.map((q, qi) => {
        if (qi === 0) return 0; // opening balance column - no expenses
        return q.months.reduce((sum, m) => sum + (item.monthly[m] || 0), 0);
      });
    });
  }, []);

  // Quarterly expense column totals
  const expenseColTotals = useMemo(() => {
    return ESCROW_QUARTERS.map((_, qi) => {
      return quarterlyExpenses.reduce((sum, row) => sum + row[qi], 0);
    });
  }, [quarterlyExpenses]);

  // Quarterly revenue totals
  const quarterlyRevenue = useMemo(() => {
    return ESCROW_QUARTERS.map((q, qi) => {
      if (qi === 0) return 0;
      return q.months.reduce((sum, m) => sum + (revenueData[m] || 0), 0);
    });
  }, [revenueData]);

  // Total revenue
  const totalRevenue = useMemo(() => {
    return Object.values(revenueData).reduce((s, v) => s + v, 0);
  }, [revenueData]);

  // Total expenses
  const totalExpenses = ESCROW_EXPENSES.reduce((s, i) => s + i.total, 0);

  // Running escrow balance
  const escrowBalance = useMemo(() => {
    const balances: number[] = [];
    let running = openingBalance;
    ESCROW_QUARTERS.forEach((q, qi) => {
      if (qi === 0) {
        balances.push(running);
      } else {
        running = running + quarterlyRevenue[qi] - expenseColTotals[qi];
        balances.push(running);
      }
    });
    return balances;
  }, [openingBalance, quarterlyRevenue, expenseColTotals]);

  // Net flow per quarter (revenue - expenses)
  const netFlow = useMemo(() => {
    return ESCROW_QUARTERS.map((_, qi) => {
      if (qi === 0) return openingBalance;
      return quarterlyRevenue[qi] - expenseColTotals[qi];
    });
  }, [quarterlyRevenue, expenseColTotals, openingBalance]);

  // Phase spans for header
  const phaseSpans = useMemo(() => {
    const spans: { phase: string; label: string; count: number }[] = [];
    let current = "";
    ESCROW_QUARTERS.forEach(q => {
      if (q.phaseLabel !== current) {
        spans.push({ phase: q.phase, label: q.phaseLabel, count: 1 });
        current = q.phaseLabel;
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, []);

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
      <div className="mb-3">
        <h1 className="text-base font-bold text-gray-900">{selectedProject?.name || "المشروع"} — حساب الضمان (الإسكرو)</h1>
        <p className="text-xs text-gray-500 mt-0.5">مصاريف البناء + إيرادات المبيعات + رصيد حساب الضمان</p>
      </div>

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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Phase header */}
            <tr>
              <th className="bg-gray-800 text-white px-1 py-1.5 text-right font-medium border-l border-gray-600 w-[160px] text-[10px]">البند</th>
              <th className="bg-gray-800 text-white px-1 py-1.5 text-center font-medium border-l border-gray-600 w-[80px] text-[10px]">الإجمالي</th>
              {phaseSpans.map((span, i) => (
                <th
                  key={i}
                  colSpan={span.count}
                  className={`${PHASE_COLORS[span.phase].header} px-1 py-1.5 text-center font-medium border-l border-gray-600 text-[10px]`}
                >
                  {span.label}
                </th>
              ))}
            </tr>
            {/* Quarter labels */}
            <tr className="bg-gray-100">
              <th className="bg-gray-100 px-1 py-1 text-right text-gray-500 border-l border-gray-200 text-[9px]">الفترة</th>
              <th className="bg-gray-100 px-1 py-1 text-center text-gray-500 border-l border-gray-200 text-[9px]">(درهم)</th>
              {ESCROW_QUARTERS.map((q, qi) => {
                const isPaid = qi > 0 && isQuarterPaid(q.months[q.months.length - 1] || 0);
                const isCurrent = qi > 0 && isCurrentQuarter(q.months[0], q.months[q.months.length - 1]);
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
              <td colSpan={2 + ESCROW_QUARTERS.length} className="px-2 py-1 text-right font-bold text-red-800 text-[10px] border-b border-red-200">
                📤 المصاريف (خصم من حساب الضمان)
              </td>
            </tr>
            {ESCROW_EXPENSES.map((item, idx) => (
              <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-red-50/30 transition-colors`}>
                <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px]">
                  {item.name}
                </td>
                <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                  {fmt(item.total)}
                </td>
                {ESCROW_QUARTERS.map((q, qi) => {
                  const val = quarterlyExpenses[idx][qi];
                  const isPaid = qi > 0 && isQuarterPaid(q.months[q.months.length - 1] || 0);
                  const isCurrent = qi > 0 && isCurrentQuarter(q.months[0], q.months[q.months.length - 1]);
                  const colors = PHASE_COLORS[q.phase];
                  return (
                    <td
                      key={qi}
                      className={`px-1 py-1 text-center border-l tabular-nums text-[10px] ${
                        val === 0 ? "text-gray-300" :
                        isPaid ? "bg-gray-100 text-gray-400 line-through" :
                        isCurrent ? `bg-yellow-50 font-bold ${colors.text}` :
                        `${colors.bg} ${colors.text}`
                      } ${colors.border}`}
                    >
                      {val === 0 ? "-" : fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Expense totals row */}
            <tr className="bg-red-100 border-t-2 border-red-300">
              <td className="px-1 py-1 text-right border-l border-red-200 font-bold text-red-800 text-[10px]">إجمالي المصاريف</td>
              <td className="px-1 py-1 text-center border-l border-red-200 font-bold text-red-800 tabular-nums text-[10px]">{fmt(totalExpenses)}</td>
              {ESCROW_QUARTERS.map((_, qi) => (
                <td key={qi} className="px-1 py-1 text-center border-l border-red-200 tabular-nums font-bold text-red-700 text-[10px]">
                  {expenseColTotals[qi] === 0 ? "-" : fmt(expenseColTotals[qi])}
                </td>
              ))}
            </tr>

            {/* ===== REVENUE SECTION ===== */}
            <tr className="bg-green-50 border-t-2 border-green-300">
              <td colSpan={2 + ESCROW_QUARTERS.length} className="px-2 py-1 text-right font-bold text-green-800 text-[10px] border-b border-green-200">
                📥 الإيرادات (إيداع في حساب الضمان)
              </td>
            </tr>
            <tr className="bg-white hover:bg-green-50/30 transition-colors">
              <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px]">
                إيرادات المبيعات
              </td>
              <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-green-700 tabular-nums text-[10px]">
                {fmt(totalRevenue)}
              </td>
              {ESCROW_QUARTERS.map((q, qi) => {
                const val = quarterlyRevenue[qi];
                const colors = PHASE_COLORS[q.phase];
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
              <td className="px-1 py-1 text-right border-l border-blue-200 font-bold text-blue-800 text-[10px]">صافي التدفق</td>
              <td className="px-1 py-1 text-center border-l border-blue-200 font-bold text-blue-800 tabular-nums text-[10px]">
                {fmtSigned(openingBalance + totalRevenue - totalExpenses)}
              </td>
              {ESCROW_QUARTERS.map((_, qi) => (
                <td key={qi} className={`px-1 py-1 text-center border-l border-blue-200 tabular-nums font-bold text-[10px] ${
                  netFlow[qi] > 0 ? "text-green-700" : netFlow[qi] < 0 ? "text-red-700" : "text-gray-400"
                }`}>
                  {fmtSigned(netFlow[qi])}
                </td>
              ))}
            </tr>

            {/* ===== ESCROW BALANCE ===== */}
            <tr className="bg-gray-800 text-white font-bold border-t border-gray-600">
              <td className="px-1 py-1.5 text-right border-l border-gray-600 text-[10px]">🏦 رصيد حساب الضمان</td>
              <td className="px-1 py-1.5 text-center border-l border-gray-600 tabular-nums text-[10px]">—</td>
              {ESCROW_QUARTERS.map((_, qi) => (
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
              onClick={() => setRevenueData({ ...DEFAULT_REVENUE })}
              className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-9 gap-2">
            {ESCROW_QUARTERS.slice(1).map((q, i) => {
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
                      // Distribute evenly across months in this quarter
                      const newData = { ...revenueData };
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
      <div className="mt-3 flex items-center gap-6 text-[10px] text-gray-500">
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
      </div>
      </div>
      )}
    </div>
  );
}
