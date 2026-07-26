import { useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

const DESIGN_MONTHS = 8;
const CONSTRUCTION_MONTHS = 30;
const POST_MONTHS = 13;

// ═══════════════════════════════════════════════════════════════
// بنود كشف تدفقات المستثمر — فقط ما يدفعه المستثمر من جيبه
// لا يوجد أي بند من حساب الضمان هنا
// ═══════════════════════════════════════════════════════════════

// ─── الأرض (مدفوعة بالكامل — لا توزيع شهري) ───
const LAND_ITEMS = [
  { id: "land_price", name: "سعر الأرض" },
  { id: "land_registration", name: "رسوم تسجيل الأرض" },
  { id: "land_broker", name: "عمولة وسيط الأرض" },
];

// ─── المصروفات (Debit) — فقط ما يدفعه المستثمر ───
const DEBIT_ITEMS = [
  // التصاميم والإشراف
  { id: "design_fee", name: "أتعاب التصاميم", section: "التصاميم والإشراف" },
  // الدراسات والمسوحات
  { id: "soil_test", name: "فحص التربة", section: "الدراسات والمسوحات" },
  { id: "topography", name: "المسح الطبوغرافي", section: "الدراسات والمسوحات" },
  // الرسوم الحكومية والتنظيمية
  { id: "community_fee", name: "رسوم المجتمع", section: "الرسوم الحكومية والتنظيمية" },
  { id: "gov_fees_investor", name: "رسوم الجهات الحكومية (10%)", section: "الرسوم الحكومية والتنظيمية" },
  { id: "sorting_fee", name: "رسوم الفرز", section: "الرسوم الحكومية والتنظيمية" },
  { id: "noc_fee", name: "رسوم NOC المطور", section: "الرسوم الحكومية والتنظيمية" },
  // ريرا (التنظيم العقاري)
  { id: "rera_project_reg", name: "تسجيل المشروع — ريرا", section: "ريرا (التنظيم العقاري)" },
  { id: "rera_units_reg", name: "تسجيل الوحدات — ريرا", section: "ريرا (التنظيم العقاري)" },
  { id: "escrow_fee", name: "حساب الضمان (رسوم فتح)", section: "ريرا (التنظيم العقاري)" },
  { id: "bank_fees", name: "رسوم البنك", section: "ريرا (التنظيم العقاري)" },
  // المبيعات والتسويق
  { id: "marketing", name: "التسويق (2%)", section: "المبيعات والتسويق" },
  { id: "developer_fee", name: "أتعاب المطور (15%)", section: "المبيعات والتسويق" },
  // الإنشاء (حصة المستثمر فقط)
  { id: "construction_advance", name: "دفعة مقدمة المقاول (10%)", section: "الإنشاء" },
  { id: "construction_deposit", name: "إيداع حساب الضمان (20%)", section: "الإنشاء" },
  { id: "construction_completion", name: "دفعة إنجاز المقاول (5%)", section: "الإنشاء" },
];

// ─── الإيرادات (Credit) — ما يستلمه المستثمر ───
const CREDIT_ITEMS = [
  { id: "direct_revenue", name: "إيرادات مباشرة (20%)" },
  { id: "escrow_liq_1", name: "تصفية حساب الضمان (دفعة 1)" },
  { id: "escrow_liq_2", name: "تصفية حساب الضمان (دفعة 2 — صافي الاحتجاز)" },
];

function dummyRow(totalMonths: number, startMonth?: number): number[] {
  return Array.from({ length: totalMonths }, (_, i) => {
    if (startMonth !== undefined && i < startMonth) return 0;
    return Math.round(Math.random() * 2_000_000);
  });
}

export default function V2InvestorCashFlow() {
  const [, navigate] = useLocation();
  const totalMonths = DESIGN_MONTHS + CONSTRUCTION_MONTHS + POST_MONTHS;

  const [debitData] = useState(() =>
    DEBIT_ITEMS.map((item) => ({
      ...item,
      values: dummyRow(totalMonths),
    }))
  );

  const [creditData] = useState(() =>
    CREDIT_ITEMS.map((item) => ({
      ...item,
      values: Array.from({ length: totalMonths }, (_, i) =>
        i >= DESIGN_MONTHS + CONSTRUCTION_MONTHS ? Math.round(Math.random() * 5_000_000) : 0
      ),
    }))
  );

  // Totals
  const debitTotals = Array.from({ length: totalMonths }, (_, i) =>
    debitData.reduce((s, r) => s + r.values[i], 0)
  );
  const creditTotals = Array.from({ length: totalMonths }, (_, i) =>
    creditData.reduce((s, r) => s + r.values[i], 0)
  );
  const netFlow = debitTotals.map((d, i) => creditTotals[i] - d);
  const cumulative = netFlow.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] || 0) + v);
    return acc;
  }, []);

  const totalDebit = debitTotals.reduce((s, v) => s + v, 0);
  const totalCredit = creditTotals.reduce((s, v) => s + v, 0);
  const profit = totalCredit - totalDebit;

  const fmt = (n: number) => {
    if (n === 0) return "-";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toLocaleString();
  };

  // Month headers
  const months: { label: string; phase: "design" | "construction" | "post" }[] = [];
  for (let i = 0; i < DESIGN_MONTHS; i++) months.push({ label: `الشهر ${i + 1}`, phase: "design" });
  for (let i = 0; i < CONSTRUCTION_MONTHS; i++) months.push({ label: `الشهر ${i + 1}`, phase: "construction" });
  for (let i = 0; i < POST_MONTHS; i++) months.push({ label: `الشهر ${i + 1}`, phase: "post" });

  const phaseColors = {
    design: "bg-blue-50 text-blue-700 border-blue-100",
    construction: "bg-amber-50 text-amber-700 border-amber-100",
    post: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  // Group debit items by section
  const sections: { name: string; items: typeof debitData }[] = [];
  let currentSection = "";
  for (const item of debitData) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ name: currentSection, items: [] });
    }
    sections[sections.length - 1].items.push(item);
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-full mx-auto px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/v2")} className="p-1 rounded hover:bg-gray-100">
              <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-gray-900">التدفقات النقدية للمستثمر</h1>
              <p className="text-[9px] text-gray-500">مجان متعدد الاستخدامات — سيناريو 1</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-red-600 font-medium">المصروفات: {fmt(totalDebit)}</span>
              <span className="text-green-600 font-medium">الإيرادات: {fmt(totalCredit)}</span>
              <span className={`font-bold ${profit >= 0 ? "text-blue-700" : "text-red-700"}`}>الأرباح: {fmt(profit)}</span>
            </div>
            <button className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-900 text-white text-[9px]">
              <Download className="w-3 h-3" /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Phase Legend */}
      <div className="bg-white border-b border-gray-100 px-3 py-1 flex items-center gap-3 text-[9px]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200"></span> تصميم ({DESIGN_MONTHS} أشهر)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-200"></span> إنشاء ({CONSTRUCTION_MONTHS} شهر)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200"></span> ما بعد الإنجاز ({POST_MONTHS} شهر)</span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] border-collapse min-w-max">
          <thead className="sticky top-[52px] z-20">
            <tr>
              <th className="sticky right-0 z-30 bg-gray-100 border-b border-gray-200 px-2 py-[3px] text-right w-[180px] min-w-[180px] text-[8px]">البند</th>
              {months.map((m, i) => (
                <th key={i} className={`px-0.5 py-[2px] text-center border-b ${phaseColors[m.phase]} font-normal text-[7px] min-w-[42px]`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── الأرض (مدفوعة بالكامل) ─── */}
            <tr className="bg-gray-200/60">
              <td colSpan={totalMonths + 1} className="px-2 py-[2px] font-bold text-gray-600 text-[8px]">
                الأرض (مدفوعة بالكامل — لا توزيع شهري)
              </td>
            </tr>
            {LAND_ITEMS.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 opacity-50">
                <td className="sticky right-0 z-10 bg-gray-50 px-2 py-[2px] text-gray-500 border-l border-gray-100 w-[180px] min-w-[180px] text-[8px]">
                  {item.name}
                </td>
                {months.map((_, j) => (
                  <td key={j} className="px-0.5 py-[2px] text-center text-gray-300 text-[8px]">—</td>
                ))}
              </tr>
            ))}

            {/* ─── المصروفات (Debit) ─── */}
            <tr className="bg-red-50/80">
              <td colSpan={totalMonths + 1} className="px-2 py-[2px] font-bold text-red-700 text-[8px] border-t border-red-100">
                المصروفات (Debit)
              </td>
            </tr>
            {sections.map((section, sIdx) => (
              <tbody key={`sec-${sIdx}`}>
                <tr className="bg-gray-50/70">
                  <td colSpan={totalMonths + 1} className="px-2 py-[1px] text-[7px] font-bold text-gray-500 pr-3 border-b border-gray-100">
                    {section.name}
                  </td>
                </tr>
                {section.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="sticky right-0 z-10 bg-white px-2 py-[2px] text-gray-800 border-l border-gray-100 w-[180px] min-w-[180px] text-[8px]">
                      {item.name}
                    </td>
                    {item.values.map((v, j) => (
                      <td key={j} className={`px-0.5 py-[2px] text-center tabular-nums text-[8px] ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                        {v > 0 ? fmt(v) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
            {/* Total Debit */}
            <tr className="bg-red-100/60 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-2 py-[2px] text-red-800 border-l border-red-200 w-[180px] min-w-[180px] text-[8px]">
                إجمالي المصروفات
              </td>
              {debitTotals.map((v, i) => (
                <td key={i} className="px-0.5 py-[2px] text-center tabular-nums text-red-700 font-bold text-[8px]">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── الإيرادات (Credit) ─── */}
            <tr className="bg-green-50/80">
              <td colSpan={totalMonths + 1} className="px-2 py-[2px] font-bold text-green-700 text-[8px] border-t border-green-100">
                الإيرادات (Credit)
              </td>
            </tr>
            {creditData.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-green-50/30">
                <td className="sticky right-0 z-10 bg-white px-2 py-[2px] text-gray-800 border-l border-gray-100 w-[180px] min-w-[180px] text-[8px]">
                  {item.name}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-0.5 py-[2px] text-center tabular-nums text-[8px] ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
            {/* Total Credit */}
            <tr className="bg-green-100/60 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[2px] text-green-800 border-l border-green-200 w-[180px] min-w-[180px] text-[8px]">
                إجمالي الإيرادات
              </td>
              {creditTotals.map((v, i) => (
                <td key={i} className="px-0.5 py-[2px] text-center tabular-nums text-green-700 font-bold text-[8px]">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-blue-50/60 font-bold border-t-2 border-blue-200">
              <td className="sticky right-0 z-10 bg-blue-50 px-2 py-[2px] text-blue-800 border-l border-blue-200 w-[180px] min-w-[180px] text-[8px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-0.5 py-[2px] text-center tabular-nums font-medium text-[8px] ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التراكمي ─── */}
            <tr className="bg-blue-100/60 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-2 py-[2px] text-blue-900 border-l border-blue-200 w-[180px] min-w-[180px] text-[8px]">
                التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-0.5 py-[2px] text-center tabular-nums font-bold text-[8px] ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
