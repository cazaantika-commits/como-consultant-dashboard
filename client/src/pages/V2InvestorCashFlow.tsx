import { useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

const DESIGN_MONTHS = 8;
const CONSTRUCTION_MONTHS = 30;
const POST_MONTHS = 13;

// ─── مدفوع سابقاً (الأرض — مدفوعة ولا توزيع شهري) ───
const PAID_ITEMS = [
  { name: "سعر الأرض" },
  { name: "رسوم تسجيل الأرض" },
  { name: "عمولة وسيط الأرض" },
];

// ─── المصروفات — بالترتيب الصحيح من النظام ───
// funder: "investor" = يدفعها المستثمر (تظهر أرقام)
// funder: "escrow" = يدفعها الضمان (تظهر "من الضمان")
const DEBIT_ITEMS = [
  { id: "design_fee", name: "أتعاب التصاميم", section: "التصاميم والإشراف", funder: "investor" },
  { id: "supervision_fee", name: "أتعاب الإشراف", section: "التصاميم والإشراف", funder: "escrow" },
  { id: "soil_test", name: "فحص التربة", section: "الدراسات والمسوحات", funder: "investor" },
  { id: "topography", name: "المسح الطبوغرافي", section: "الدراسات والمسوحات", funder: "investor" },
  { id: "surveyor_fee", name: "رسوم المساح", section: "الدراسات والمسوحات", funder: "escrow" },
  { id: "community_fee", name: "رسوم المجتمع", section: "الرسوم الحكومية والتنظيمية", funder: "investor" },
  { id: "gov_fees", name: "رسوم الجهات الحكومية", section: "الرسوم الحكومية والتنظيمية", funder: "investor" },
  { id: "sorting_fee", name: "رسوم الفرز", section: "الرسوم الحكومية والتنظيمية", funder: "investor" },
  { id: "noc_fee", name: "رسوم NOC المطور", section: "الرسوم الحكومية والتنظيمية", funder: "investor" },
  { id: "rera_project_reg", name: "تسجيل المشروع — ريرا", section: "ريرا (التنظيم العقاري)", funder: "investor" },
  { id: "rera_units_reg", name: "تسجيل الوحدات — ريرا", section: "ريرا (التنظيم العقاري)", funder: "investor" },
  { id: "escrow_fee", name: "حساب الضمان (رسوم فتح)", section: "ريرا (التنظيم العقاري)", funder: "investor" },
  { id: "bank_fees", name: "رسوم البنك", section: "ريرا (التنظيم العقاري)", funder: "investor" },
  { id: "rera_audit", name: "تقرير مدقق ريرا", section: "ريرا (التنظيم العقاري)", funder: "escrow" },
  { id: "rera_inspect", name: "فحص ريرا", section: "ريرا (التنظيم العقاري)", funder: "escrow" },
  { id: "sales_commission", name: "عمولة المبيعات", section: "المبيعات والتسويق", funder: "escrow" },
  { id: "marketing", name: "التسويق (2%)", section: "المبيعات والتسويق", funder: "investor" },
  { id: "developer_fee", name: "أتعاب المطور", section: "المبيعات والتسويق", funder: "investor" },
  { id: "construction", name: "تكلفة الإنشاء", section: "الإنشاء", funder: "investor" },
];

// ─── الإيرادات (Credit) — ما يستلمه المستثمر ───
const CREDIT_ITEMS = [
  { id: "direct_revenue", name: "إيرادات مباشرة (20%)" },
  { id: "escrow_liq_1", name: "تصفية حساب الضمان (دفعة 1)" },
  { id: "escrow_liq_2", name: "تصفية حساب الضمان (دفعة 2 - صافي الاحتجاز)" },
];

function dummyRow(totalMonths: number): number[] {
  return Array.from({ length: totalMonths }, () => Math.round(Math.random() * 2_000_000));
}

export default function V2InvestorCashFlow() {
  const [, navigate] = useLocation();
  const totalMonths = DESIGN_MONTHS + CONSTRUCTION_MONTHS + POST_MONTHS;

  const [debitData] = useState(() =>
    DEBIT_ITEMS.map((item) => ({
      ...item,
      values: item.funder === "investor" ? dummyRow(totalMonths) : [],
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

  // Totals (investor-funded only)
  const investorDebitItems = debitData.filter((d) => d.funder === "investor");
  const debitTotals = Array.from({ length: totalMonths }, (_, i) =>
    investorDebitItems.reduce((s, r) => s + r.values[i], 0)
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
              <span className="text-blue-700 font-bold">الأرباح: {fmt(profit)}</span>
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
              <th className="sticky right-0 z-30 bg-gray-100 border-b border-gray-200 px-2 py-[3px] text-right w-[160px] min-w-[160px] text-[8px]">البند</th>
              {months.map((m, i) => (
                <th key={i} className={`px-0.5 py-[2px] text-center border-b ${phaseColors[m.phase]} font-normal text-[8px] min-w-[45px]`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ─── مدفوع سابقاً ─── */}
            <tr className="bg-gray-200/50">
              <td colSpan={totalMonths + 1} className="px-2 py-[2px] font-bold text-gray-500 text-[8px]">
                مدفوع سابقاً (لا يؤثر على التدفقات)
              </td>
            </tr>
            {PAID_ITEMS.map((item, i) => (
              <tr key={`paid-${i}`} className="border-b border-gray-50 opacity-50">
                <td className="sticky right-0 z-10 bg-gray-50 px-2 py-[2px] text-gray-500 border-l border-gray-100 w-[160px] min-w-[160px]">
                  {item.name}
                </td>
                {months.map((_, j) => (
                  <td key={j} className="px-0.5 py-[2px] text-center text-gray-300">-</td>
                ))}
              </tr>
            ))}

            {/* ─── المصروفات (Debit) ─── */}
            <tr className="bg-red-50/80">
              <td colSpan={totalMonths + 1} className="px-2 py-[2px] font-bold text-red-700 text-[8px] border-t border-red-100">
                المصروفات (Debit)
              </td>
            </tr>
            {sections.map((section) => (
              <>
                <tr key={`sec-${section.name}`} className="bg-gray-50/60">
                  <td colSpan={totalMonths + 1} className="px-2 py-[1px] text-[8px] font-bold text-gray-500 pr-3">
                    {section.name}
                  </td>
                </tr>
                {section.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="sticky right-0 z-10 bg-white px-2 py-[2px] text-gray-800 border-l border-gray-100 w-[160px] min-w-[160px]">
                      {item.name}
                    </td>
                    {item.funder === "escrow" ? (
                      <>
                        <td colSpan={totalMonths} className="px-2 py-[2px] text-center text-gray-400 italic text-[8px]">
                          من الضمان
                        </td>
                      </>
                    ) : (
                      item.values.map((v, j) => (
                        <td key={j} className={`px-0.5 py-[2px] text-center tabular-nums ${v > 0 ? "text-red-600" : "text-gray-300"}`}>
                          {v > 0 ? fmt(v) : "-"}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </>
            ))}
            {/* Total Debit */}
            <tr className="bg-red-100/60 font-bold border-t border-red-200">
              <td className="sticky right-0 z-10 bg-red-50 px-2 py-[2px] text-red-800 border-l border-red-200 w-[160px] min-w-[160px]">
                إجمالي المصروفات
              </td>
              {debitTotals.map((v, i) => (
                <td key={i} className="px-0.5 py-[2px] text-center tabular-nums text-red-700 font-bold">
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
                <td className="sticky right-0 z-10 bg-white px-2 py-[2px] text-gray-800 border-l border-gray-100 w-[160px] min-w-[160px]">
                  {item.name}
                </td>
                {item.values.map((v, j) => (
                  <td key={j} className={`px-0.5 py-[2px] text-center tabular-nums ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                    {v > 0 ? fmt(v) : "-"}
                  </td>
                ))}
              </tr>
            ))}
            {/* Total Credit */}
            <tr className="bg-green-100/60 font-bold border-t border-green-200">
              <td className="sticky right-0 z-10 bg-green-50 px-2 py-[2px] text-green-800 border-l border-green-200 w-[160px] min-w-[160px]">
                إجمالي الإيرادات
              </td>
              {creditTotals.map((v, i) => (
                <td key={i} className="px-0.5 py-[2px] text-center tabular-nums text-green-700 font-bold">
                  {v > 0 ? fmt(v) : "-"}
                </td>
              ))}
            </tr>

            {/* ─── صافي الشهر ─── */}
            <tr className="bg-blue-50/60 font-bold border-t-2 border-blue-200">
              <td className="sticky right-0 z-10 bg-blue-50 px-2 py-[2px] text-blue-800 border-l border-blue-200 w-[160px] min-w-[160px]">
                صافي الشهر
              </td>
              {netFlow.map((v, i) => (
                <td key={i} className={`px-0.5 py-[2px] text-center tabular-nums font-medium ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>

            {/* ─── التراكمي ─── */}
            <tr className="bg-blue-100/60 font-bold">
              <td className="sticky right-0 z-10 bg-blue-100 px-2 py-[2px] text-blue-900 border-l border-blue-200 w-[160px] min-w-[160px]">
                التراكمي
              </td>
              {cumulative.map((v, i) => (
                <td key={i} className={`px-0.5 py-[2px] text-center tabular-nums font-bold ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
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
