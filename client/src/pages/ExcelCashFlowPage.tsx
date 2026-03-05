import { useMemo } from "react";

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
  endDate.setMonth(endDate.getMonth() + 1); // end of that month
  return endDate <= TODAY;
}

function isCurrentQuarter(startMonth: number, endMonth: number): boolean {
  for (let m = startMonth; m <= endMonth; m++) {
    const d = getMonthDate(m);
    if (d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()) return true;
  }
  return false;
}

// ===== QUARTERLY STRUCTURE =====
interface Quarter {
  label: string;
  months: number[];
  phase: "land" | "preCon" | "construction" | "handover";
  phaseLabel: string;
}

const QUARTERS: Quarter[] = [
  // Land purchase - single column
  { label: "تم الشراء", months: [], phase: "land", phaseLabel: "شراء الأرض" },
  // Pre-construction: 6 months = 2 quarters
  { label: formatQuarter(1), months: [1,2,3], phase: "preCon", phaseLabel: "ما قبل البناء" },
  { label: formatQuarter(4), months: [4,5,6], phase: "preCon", phaseLabel: "ما قبل البناء" },
  // Construction: 16 months ≈ 5 quarters + 1 month
  { label: formatQuarter(7), months: [7,8,9], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(10), months: [10,11,12], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(13), months: [13,14,15], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(16), months: [16,17,18], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(19), months: [19,20,21], phase: "construction", phaseLabel: "البناء" },
  { label: formatQuarter(22), months: [22], phase: "construction", phaseLabel: "البناء" },
  // Handover: 2 months
  { label: formatQuarter(23), months: [23,24], phase: "handover", phaseLabel: "التسليم" },
];

// ===== PHASE COLORS =====
const PHASE_COLORS: Record<string, { bg: string; header: string; text: string; border: string }> = {
  land: { bg: "bg-stone-100", header: "bg-stone-700 text-white", text: "text-stone-800", border: "border-stone-300" },
  preCon: { bg: "bg-amber-50", header: "bg-amber-700 text-white", text: "text-amber-900", border: "border-amber-200" },
  construction: { bg: "bg-sky-50", header: "bg-sky-800 text-white", text: "text-sky-900", border: "border-sky-200" },
  handover: { bg: "bg-emerald-50", header: "bg-emerald-700 text-white", text: "text-emerald-900", border: "border-emerald-200" },
};

// ===== MONTHLY DATA (from Excel) =====
type MonthData = { [month: number]: number };

interface InvestorItem {
  name: string;
  total: number;
  isLand: boolean; // true = paid at land purchase (before M1)
  monthly: MonthData;
}

const ITEMS: InvestorItem[] = [
  { name: "سعر الأرض", total: 18000000, isLand: true, monthly: {} },
  { name: "عمولة وسيط الأرض", total: 180000, isLand: true, monthly: {} },
  { name: "رسوم تسجيل الأرض", total: 720000, isLand: true, monthly: {} },
  { name: "فحص التربة", total: 25000, isLand: false, monthly: { 1: 25000 } },
  { name: "المسح الطبوغرافي", total: 8000, isLand: false, monthly: { 1: 8000 } },
  { name: "أتعاب المطور (5%)", total: 4688250, isLand: false, monthly: { 1: 703237.5, 2: 234412.5, 3: 234412.5, 4: 234412.5, 5: 234412.5, 6: 234412.5, 7: 156275, 8: 156275, 9: 156275, 10: 156275, 11: 156275, 12: 156275, 13: 156275, 14: 156275, 15: 156275, 16: 156275, 17: 156275, 18: 156275, 19: 156275, 20: 156275, 21: 156275, 22: 156275, 23: 156275, 24: 156275 } },
  { name: "أتعاب التصميم (2%)", total: 788559.6, isLand: false, monthly: { 1: 157711.92, 2: 78855.96, 3: 157711.92, 4: 157711.92, 5: 157711.92, 6: 78855.96 } },
  { name: "رسوم الفرز", total: 2033044.4, isLand: false, monthly: { 2: 2033044.4 } },
  { name: "تسجيل بيع على الخارطة - ريرا", total: 150000, isLand: false, monthly: { 4: 150000 } },
  { name: "تسجيل الوحدات - ريرا", total: 39100, isLand: false, monthly: { 5: 39100 } },
  { name: "رسوم المساح", total: 24000, isLand: false, monthly: { 4: 12000 } },
  { name: "رسوم NOC للبيع", total: 10000, isLand: false, monthly: { 5: 10000, 23: 12000 } },
  { name: "رسوم حساب الضمان", total: 140000, isLand: false, monthly: { 4: 140000 } },
  { name: "إيداع حساب الضمان (20%)", total: 7885596, isLand: false, monthly: { 5: 7885596 } },
  { name: "دفعة مقدمة للمقاول (10%)", total: 3942798, isLand: false, monthly: { 6: 3942798 } },
  { name: "احتياطي وطوارئ (2%)", total: 788559.6, isLand: false, monthly: { 6: 788559.6, 13: 394279.8, 22: 394279.8 } },
  { name: "التسويق والإعلان (2%)", total: 1875300, isLand: false, monthly: { 6: 375060, 8: 375060, 9: 281295, 10: 281295, 11: 93765, 12: 93765, 13: 93765, 14: 93765, 15: 93765, 16: 93765 } },
  { name: "رسوم بنكية", total: 20000, isLand: false, monthly: { 7: 1111.11, 8: 1111.11, 9: 1111.11, 10: 1111.11, 11: 1111.11, 12: 1111.11, 13: 1111.11, 14: 1111.11, 15: 1111.11, 16: 1111.11, 17: 1111.11, 18: 1111.11, 19: 1111.11, 20: 1111.11, 21: 1111.11, 22: 1111.11, 23: 1111.11, 24: 1111.11 } },
  { name: "رسوم المجتمع", total: 16000, isLand: false, monthly: { 6: 16000 } },
];

// ===== FORMAT =====
function fmt(n: number): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("en-US");
}

// ===== COMPONENT =====
export default function ExcelCashFlowPage() {
  // Calculate quarterly totals for each item
  const quarterlyData = useMemo(() => {
    return ITEMS.map(item => {
      const qTotals = QUARTERS.map((q, qi) => {
        if (qi === 0) return item.isLand ? item.total : 0; // land column
        return q.months.reduce((sum, m) => sum + (item.monthly[m] || 0), 0);
      });
      return qTotals;
    });
  }, []);

  // Column totals
  const colTotals = useMemo(() => {
    return QUARTERS.map((_, qi) => {
      return quarterlyData.reduce((sum, row) => sum + row[qi], 0);
    });
  }, [quarterlyData]);

  // Grand total
  const grandTotal = ITEMS.reduce((s, i) => s + i.total, 0);

  // Paid vs upcoming
  const paidTotal = useMemo(() => {
    let paid = 0;
    // Land is always paid
    ITEMS.forEach(item => { if (item.isLand) paid += item.total; });
    // Check each quarter
    QUARTERS.forEach((q, qi) => {
      if (qi === 0) return; // land handled above
      const lastMonth = q.months[q.months.length - 1];
      if (isQuarterPaid(lastMonth)) {
        paid += colTotals[qi];
      }
    });
    return paid;
  }, [colTotals]);

  const upcomingTotal = grandTotal - paidTotal;

  // Next 3 months total
  const next3MonthsTotal = useMemo(() => {
    let total = 0;
    const now = new Date();
    for (let m = 1; m <= 24; m++) {
      const d = getMonthDate(m);
      if (d >= now) {
        const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
        if (diffMonths >= 0 && diffMonths < 3) {
          ITEMS.forEach(item => {
            if (!item.isLand) total += (item.monthly[m] || 0);
          });
        }
      }
    }
    return total;
  }, []);

  // Next 3 months date range
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
    QUARTERS.forEach(q => {
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
      {/* Title */}
      <div className="mb-3">
        <h1 className="text-base font-bold text-gray-900">مشروع ند الشبا جاردنز — جدول مصاريف المستثمر</h1>
        <p className="text-xs text-gray-500 mt-0.5">التمويل المباشر من المستثمر (لا يشمل مصاريف حساب الضمان)</p>
      </div>

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
              {QUARTERS.map((q, qi) => {
                const isPaid = qi === 0 || isQuarterPaid(q.months[q.months.length - 1] || 0);
                const isCurrent = qi > 0 && isCurrentQuarter(q.months[0], q.months[q.months.length - 1]);
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
            {ITEMS.map((item, idx) => (
              <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors`}>
                <td className="px-1 py-1 text-right border-l border-gray-100 font-medium text-gray-800 text-[10px]">
                  {item.name}
                </td>
                <td className="px-1 py-1 text-center border-l border-gray-100 font-bold text-gray-900 tabular-nums text-[10px]">
                  {fmt(item.total)}
                </td>
                {QUARTERS.map((q, qi) => {
                  const val = quarterlyData[idx][qi];
                  const isPaid = qi === 0 || isQuarterPaid(q.months[q.months.length - 1] || 0);
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

            {/* ROW 1: إجمالي رأس مال المشروع */}
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="px-1 py-1 text-right border-l border-gray-200 font-medium text-gray-700 text-[10px]">إجمالي رأس مال المشروع</td>
              <td className="px-1 py-1 text-center border-l border-gray-200 font-bold text-gray-800 tabular-nums text-[10px]">{fmt(grandTotal)}</td>
              {QUARTERS.map((q, qi) => {
                const val = colTotals[qi];
                return (
                  <td key={qi} className="px-1 py-1 text-center border-l border-gray-200 tabular-nums text-gray-600 text-[10px]">
                    {val === 0 ? "-" : fmt(val)}
                  </td>
                );
              })}
            </tr>
            {/* ROW 2: المبالغ المدفوعة */}
            <tr className="bg-green-50 border-t border-gray-200">
              <td className="px-1 py-1 text-right border-l border-gray-200 font-medium text-green-700 text-[10px]">المبالغ المدفوعة</td>
              <td className="px-1 py-1 text-center border-l border-gray-200 font-bold text-green-700 tabular-nums text-[10px]">{fmt(paidTotal)}</td>
              {QUARTERS.map((q, qi) => {
                const val = colTotals[qi];
                const isPaid = qi === 0 || isQuarterPaid(q.months[q.months.length - 1] || 0);
                return (
                  <td key={qi} className="px-1 py-1 text-center border-l border-gray-200 tabular-nums text-[10px] text-green-600">
                    {isPaid && val > 0 ? fmt(val) : "-"}
                  </td>
                );
              })}
            </tr>
            {/* ROW 3: رأس المال المطلوب سداده */}
            <tr className="bg-gray-800 text-white font-bold border-t border-gray-600">
              <td className="px-1 py-1.5 text-right border-l border-gray-600 text-[10px]">رأس المال المطلوب سداده</td>
              <td className="px-1 py-1.5 text-center border-l border-gray-600 tabular-nums text-[10px]">{fmt(upcomingTotal)}</td>
              {QUARTERS.map((q, qi) => {
                const val = colTotals[qi];
                const isPaid = qi === 0 || isQuarterPaid(q.months[q.months.length - 1] || 0);
                const isCurrent = qi > 0 && isCurrentQuarter(q.months[0], q.months[q.months.length - 1]);
                return (
                  <td
                    key={qi}
                    className={`px-1 py-1.5 text-center border-l border-gray-600 tabular-nums text-[10px] ${
                      isPaid ? "text-gray-500" : isCurrent ? "text-yellow-300" : ""
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
      <div className="mt-4 flex items-center gap-6 text-[10px] text-gray-500">
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
      </div>
    </div>
  );
}
