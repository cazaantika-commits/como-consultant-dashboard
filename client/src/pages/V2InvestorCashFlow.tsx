import { useState } from "react";
import { ArrowRight, Settings2, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA — will be replaced with real calculations later =====
const DESIGN_MONTHS = 8;
const CONSTRUCTION_MONTHS = 24;

const PAID_ITEMS = [
  { name: "الأرض", amount: 125_000_000 },
  { name: "رسوم التسجيل (4%)", amount: 5_000_000 },
  { name: "عمولة الأرض (2%)", amount: 2_500_000 },
];

const DEBIT_ITEMS = [
  { id: "consultant", name: "أتعاب الاستشاري" },
  { id: "approvals", name: "رسوم الاعتمادات والتصاريح" },
  { id: "contractor", name: "المقاول" },
  { id: "supervision", name: "إشراف هندسي" },
  { id: "marketing", name: "تسويق ومبيعات" },
  { id: "developer_fee", name: "أتعاب المطور (15%)" },
  { id: "offplan_reg", name: "رسوم تسجيل أوف بلان" },
  { id: "insurance", name: "تأمين" },
  { id: "admin", name: "إدارية ومصاريف عامة" },
];

const CREDIT_ITEMS = [
  { id: "escrow_release", name: "تحرير الضمان (Escrow)" },
  { id: "post_sales", name: "مبيعات مباشرة بعد الإنجاز" },
  { id: "retention_release", name: "تحرير الاحتجاز (بعد 13 شهر)" },
];

// Generate dummy monthly values
function dummyDebitRow(totalMonths: number): number[] {
  return Array.from({ length: totalMonths }, () => Math.round(Math.random() * 2_000_000));
}

function dummyCreditRow(totalMonths: number, startMonth: number): number[] {
  return Array.from({ length: totalMonths }, (_, i) =>
    i >= startMonth ? Math.round(Math.random() * 5_000_000) : 0
  );
}

export default function V2InvestorCashFlow() {
  const [, navigate] = useLocation();
  const totalMonths = DESIGN_MONTHS + CONSTRUCTION_MONTHS;

  // Generate dummy data
  const [debitData] = useState(() =>
    DEBIT_ITEMS.map((item) => ({
      ...item,
      values: dummyDebitRow(totalMonths),
    }))
  );

  const [creditData] = useState(() =>
    CREDIT_ITEMS.map((item) => ({
      ...item,
      values: dummyCreditRow(totalMonths, DESIGN_MONTHS + CONSTRUCTION_MONTHS - 2),
    }))
  );

  // Totals
  const monthlyDebitTotals = Array.from({ length: totalMonths }, (_, m) =>
    debitData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyCreditTotals = Array.from({ length: totalMonths }, (_, m) =>
    creditData.reduce((sum, row) => sum + row.values[m], 0)
  );
  const monthlyNet = monthlyDebitTotals.map((d, i) => monthlyCreditTotals[i] - d);
  const cumulative = monthlyNet.reduce<number[]>((acc, val) => {
    acc.push((acc[acc.length - 1] || 0) + val);
    return acc;
  }, []);

  const totalDebit = monthlyDebitTotals.reduce((a, b) => a + b, 0);
  const totalCredit = monthlyCreditTotals.reduce((a, b) => a + b, 0);
  const totalPaid = PAID_ITEMS.reduce((a, b) => a + b.amount, 0);
  const profit = totalCredit - totalDebit - totalPaid;

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };

  const fmtFull = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">تدفقات المستثمر النقدية</h1>
              <p className="text-sm text-gray-500">مجان متعدد الاستخدامات — G+4P+25</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700">
              <Settings2 className="w-4 h-4" />
              إعدادات
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm">
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Paid Previously */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">مدفوع سابقاً (لا يؤثر)</p>
            <p className="text-2xl font-bold text-gray-400">{fmt(totalPaid)}</p>
            <div className="mt-2 text-xs text-gray-400">
              {PAID_ITEMS.map((item) => (
                <div key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span>{fmtFull(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Total Debit */}
          <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
            <p className="text-sm text-red-600 mb-1">إجمالي المصروفات (Debit)</p>
            <p className="text-2xl font-bold text-red-700">{fmt(totalDebit)}</p>
          </div>
          {/* Total Credit */}
          <div className="bg-white rounded-xl p-5 border border-green-100 shadow-sm">
            <p className="text-sm text-green-600 mb-1">إجمالي الإيرادات (Credit)</p>
            <p className="text-2xl font-bold text-green-700">{fmt(totalCredit)}</p>
          </div>
          {/* Profit */}
          <div className="bg-white rounded-xl p-5 border border-teal-100 shadow-sm">
            <p className="text-sm text-teal-600 mb-1">الأرباح</p>
            <p className="text-2xl font-bold text-teal-700">{fmt(profit)}</p>
            <p className="text-xs text-gray-400 mt-1">Credit - Debit - المدفوع</p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: totalMonths * 90 + 200 }}>
              {/* Column Headers */}
              <thead>
                {/* Phase Row */}
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-4 py-2 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[180px]">
                    البند
                  </th>
                  {/* Design months */}
                  {Array.from({ length: DESIGN_MONTHS }, (_, i) => (
                    <th
                      key={`d-${i}`}
                      className="px-3 py-2 text-center border-b border-gray-200 font-medium text-blue-700 bg-blue-50 whitespace-nowrap"
                    >
                      تصميم {i + 1}
                    </th>
                  ))}
                  {/* Construction months */}
                  {Array.from({ length: CONSTRUCTION_MONTHS }, (_, i) => (
                    <th
                      key={`c-${i}`}
                      className="px-3 py-2 text-center border-b border-gray-200 font-medium text-amber-700 bg-amber-50 whitespace-nowrap"
                    >
                      إنشاء {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* === DEBIT SECTION === */}
                <tr className="bg-red-50/50">
                  <td
                    colSpan={totalMonths + 1}
                    className="px-4 py-2 font-bold text-red-800 text-sm border-b border-red-100"
                  >
                    المصروفات (Debit)
                  </td>
                </tr>
                {debitData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td
                        key={i}
                        className="px-3 py-2 text-center text-gray-700 tabular-nums"
                      >
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Debit Total Row */}
                <tr className="bg-red-50 font-bold border-b-2 border-red-200">
                  <td className="sticky right-0 z-10 bg-red-50 px-4 py-2 text-right text-red-800 border-l border-red-200">
                    إجمالي Debit
                  </td>
                  {monthlyDebitTotals.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-red-800 tabular-nums">
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  ))}
                </tr>

                {/* === CREDIT SECTION === */}
                <tr className="bg-green-50/50">
                  <td
                    colSpan={totalMonths + 1}
                    className="px-4 py-2 font-bold text-green-800 text-sm border-b border-green-100"
                  >
                    الإيرادات (Credit)
                  </td>
                </tr>
                {creditData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <td className="sticky right-0 z-10 bg-white px-4 py-2 text-right text-gray-800 font-medium border-l border-gray-100 whitespace-nowrap">
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td
                        key={i}
                        className="px-3 py-2 text-center text-gray-700 tabular-nums"
                      >
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Credit Total Row */}
                <tr className="bg-green-50 font-bold border-b-2 border-green-200">
                  <td className="sticky right-0 z-10 bg-green-50 px-4 py-2 text-right text-green-800 border-l border-green-200">
                    إجمالي Credit
                  </td>
                  {monthlyCreditTotals.map((val, i) => (
                    <td key={i} className="px-3 py-2 text-center text-green-800 tabular-nums">
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  ))}
                </tr>

                {/* === NET ROW === */}
                <tr className="bg-gray-100 font-bold border-b border-gray-300">
                  <td className="sticky right-0 z-10 bg-gray-100 px-4 py-2 text-right text-gray-800 border-l border-gray-200">
                    صافي الشهر
                  </td>
                  {monthlyNet.map((val, i) => (
                    <td
                      key={i}
                      className={`px-3 py-2 text-center tabular-nums ${
                        val >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {fmt(val)}
                    </td>
                  ))}
                </tr>

                {/* === CUMULATIVE ROW === */}
                <tr className="bg-teal-50 font-bold">
                  <td className="sticky right-0 z-10 bg-teal-50 px-4 py-3 text-right text-teal-800 border-l border-teal-200">
                    التراكمي
                  </td>
                  {cumulative.map((val, i) => (
                    <td
                      key={i}
                      className={`px-3 py-3 text-center tabular-nums ${
                        val >= 0 ? "text-teal-700" : "text-red-700"
                      }`}
                    >
                      {fmt(val)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
