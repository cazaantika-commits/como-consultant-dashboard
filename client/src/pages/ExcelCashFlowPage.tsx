import { useState } from "react";

// ===== STATIC DATA FROM EXCEL =====
// Phase structure: Feasibility (C7-C9), Pre-Construction (C10-C15), Construction (C17-C32), Handover (C33-C34)
// Month mapping: C10=M1, C11=M2, ..., C15=M6, C17=M7, ..., C34=M24

const PHASES = [
  { label: "شراء الأرض", cols: ["F1","F2","F3"], monthLabels: ["","",""] },
  { label: "ما قبل البناء", cols: ["M1","M2","M3","M4","M5","M6"], monthLabels: ["1","2","3","4","5","6"] },
  { label: "مرحلة البناء", cols: ["M7","M8","M9","M10","M11","M12","M13","M14","M15","M16","M17","M18","M19","M20","M21","M22"], monthLabels: ["7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22"] },
  { label: "التسليم", cols: ["M23","M24"], monthLabels: ["23","24"] },
];

const ALL_COLS = PHASES.flatMap(p => p.cols);

type RowData = { [col: string]: number };

interface ItemRow {
  name: string;
  nameEn: string;
  base?: number;
  pct?: string;
  total: number;
  data: RowData;
}

// ===== TABLE 1: INVESTOR EXPENSES (Yellow) =====
const investorItems: ItemRow[] = [
  { name: "سعر الأرض", nameEn: "Land Cost", total: 18000000, data: { F1: 18000000 } },
  { name: "عمولة الوسيط", nameEn: "Agent Commissions", base: 18000000, pct: "1%", total: 180000, data: { F1: 180000 } },
  { name: "رسوم تسجيل الأرض", nameEn: "Land Registration Fee", pct: "4%", total: 720000, data: { F1: 720000 } },
  { name: "فحص التربة", nameEn: "Soil Investigation", total: 25000, data: { M1: 25000 } },
  { name: "المسح الطبوغرافي", nameEn: "Topography Survey", total: 8000, data: { M1: 8000 } },
  { name: "أتعاب المطور", nameEn: "Developer Fixed Fee", base: 93765000, pct: "5%", total: 4688250, data: { M1: 703237.5, M2: 234412.5, M3: 234412.5, M4: 234412.5, M5: 234412.5, M6: 234412.5, M7: 156275, M8: 156275, M9: 156275, M10: 156275, M11: 156275, M12: 156275, M13: 156275, M14: 156275, M15: 156275, M16: 156275, M17: 156275, M18: 156275, M19: 156275, M20: 156275, M21: 156275, M22: 156275, M23: 156275, M24: 156275 } },
  { name: "أتعاب التصميم", nameEn: "Project Design Fee", base: 39427980, pct: "2%", total: 788559.6, data: { M1: 157711.92, M2: 78855.96, M3: 157711.92, M4: 157711.92, M5: 157711.92, M6: 78855.96 } },
  { name: "رسوم الفرز", nameEn: "Separation Fee", base: 50826.11, pct: "40/sqft", total: 2033044.4, data: { M2: 2033044.4 } },
  { name: "تسجيل بيع على الخارطة - ريرا", nameEn: "RERA Off-Plan Registration", total: 150000, data: { M4: 150000 } },
  { name: "تسجيل الوحدات - ريرا", nameEn: "RERA Unit Registration", total: 39100, data: { M5: 39100 } },
  { name: "رسوم المساح", nameEn: "Surveyor Fees", total: 24000, data: { M4: 12000 } },
  { name: "رسوم NOC للبيع", nameEn: "NOC to Sell Fees", total: 10000, data: { M5: 10000, M23: 12000 } },
  { name: "رسوم حساب الضمان", nameEn: "Escrow Bank Account", total: 140000, data: { M4: 140000 } },
  { name: "إيداع حساب الضمان", nameEn: "Deposit to Escrow", base: 39427980, pct: "20%", total: 7885596, data: { M5: 7885596 } },
  { name: "دفعة مقدمة للمقاول", nameEn: "Contractors Advance", base: 39427980, pct: "10%", total: 3942798, data: { M6: 3942798 } },
  { name: "احتياطي وطوارئ", nameEn: "Contingencies", base: 39427980, pct: "2%", total: 788559.6, data: { M6: 788559.6, M13: 394279.8, M22: 394279.8 } },
  { name: "التسويق والإعلان", nameEn: "Marketing & Advertisement", base: 93765000, pct: "2%", total: 1875300, data: { M6: 375060, M7: 0, M8: 375060, M9: 281295, M10: 281295, M11: 93765, M12: 93765, M13: 93765, M14: 93765, M15: 93765, M16: 93765 } },
  { name: "رسوم بنكية", nameEn: "Bank Charges", total: 20000, data: { M7: 1111.11, M8: 1111.11, M9: 1111.11, M10: 1111.11, M11: 1111.11, M12: 1111.11, M13: 1111.11, M14: 1111.11, M15: 1111.11, M16: 1111.11, M17: 1111.11, M18: 1111.11, M19: 1111.11, M20: 1111.11, M21: 1111.11, M22: 1111.11, M23: 1111.11, M24: 1111.11 } },
  { name: "رسوم المجتمع", nameEn: "Community Fee", total: 16000, data: { M6: 16000 } },
];

// R42: Investor monthly totals
const investorTotals: RowData = {
  F1: 18900000, F2: 0, F3: 0,
  M1: 893949.42, M2: 2346312.86, M3: 392124.42, M4: 694124.42, M5: 8326820.42, M6: 5435686.06,
  M7: 532446.11, M8: 438681.11, M9: 438681.11, M10: 251151.11, M11: 251151.11, M12: 251151.11,
  M13: 645430.91, M14: 251151.11, M15: 251151.11, M16: 157386.11, M17: 157386.11, M18: 157386.11,
  M19: 157386.11, M20: 157386.11, M21: 157386.11, M22: 551665.91, M23: 169386.11, M24: 157386.11,
};

// ===== TABLE 2: ESCROW EXPENSES =====
const escrowItems: ItemRow[] = [
  { name: "رسوم الجهات الحكومية", nameEn: "Authorities Fee", total: 1000000, data: { M9: 800000, M10: 50000, M14: 50000, M18: 50000, M22: 50000 } },
  { name: "دفعات المقاول", nameEn: "Contractor Payments", base: 39427980, pct: "85%", total: 33513783, data: { M7: 1861876.83, M8: 1861876.83, M9: 1861876.83, M10: 1861876.83, M11: 1861876.83, M12: 1861876.83, M13: 1861876.83, M14: 1861876.83, M15: 1861876.83, M16: 1861876.83, M17: 1861876.83, M18: 1861876.83, M19: 1861876.83, M20: 1861876.83, M21: 1861876.83, M22: 1861876.83, M23: 1861876.83, M24: 1861876.83 } },
  { name: "أتعاب الإشراف", nameEn: "Supervision Fee", base: 39427980, pct: "2%", total: 788559.6, data: { M7: 43808.87, M8: 43808.87, M9: 43808.87, M10: 43808.87, M11: 43808.87, M12: 43808.87, M13: 43808.87, M14: 43808.87, M15: 43808.87, M16: 43808.87, M17: 43808.87, M18: 43808.87, M19: 43808.87, M20: 43808.87, M21: 43808.87, M22: 43808.87, M23: 43808.87, M24: 43808.87 } },
  { name: "عمولة البيع", nameEn: "Agent Commissions", base: 93765000, pct: "5%", total: 4688250, data: { M9: 703237.5, M10: 937650, M11: 937650, M12: 468825, M13: 468825, M14: 468825, M15: 703237.5 } },
  { name: "تقارير تدقيق ريرا", nameEn: "RERA Audit Reports", total: 18000, data: { M9: 3000, M12: 3000, M15: 3000, M18: 3000, M21: 3000, M24: 3000 } },
  { name: "تقارير تفتيش ريرا", nameEn: "RERA Inspection Reports", total: 105000, data: { M9: 15000, M12: 15000, M15: 15000, M18: 15000, M21: 15000, M24: 15000 } },
];

// R53: Escrow running balance
const escrowBalance: RowData = {
  M7: 5979910.3, M8: 4074224.6, M9: 647301.4, M10: -2246034.3, M11: -5089370, M12: -7481880.7,
  M13: -9856391.4, M14: -12280902.1, M15: -14907825.3, M16: -16813511, M17: -18719196.7, M18: -20692882.4,
  M19: -22598568.1, M20: -24504253.8, M21: -26427939.5, M22: -28383625.2, M23: -30289310.9, M24: -32212996.6,
};

// Revenue summary
const revenue = {
  residential: { area: 45000, price: 1817, total: 81765000 },
  retail: { area: 4000, price: 3000, total: 12000000 },
  projectSaleValue: 93765000,
};

// Escrow opening balance
const escrowOpeningBalance = 7885596;

// ===== FORMATTING =====
function fmt(n: number | undefined): string {
  if (n === undefined || n === 0) return "";
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n < 0 ? "-" : "") + (abs / 1000000).toFixed(2) + "M";
  if (abs >= 1000) return (n < 0 ? "-" : "") + Math.round(abs).toLocaleString("en-US");
  return Math.round(n).toLocaleString("en-US");
}

function fmtFull(n: number): string {
  if (n === 0) return "0";
  return Math.round(n).toLocaleString("en-US");
}

// ===== COMPONENT =====
export default function ExcelCashFlowPage() {
  const [showEnglish, setShowEnglish] = useState(false);

  const investorGrandTotal = investorItems.reduce((s, i) => s + i.total, 0);
  const escrowGrandTotal = escrowItems.reduce((s, i) => s + i.total, 0);

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      {/* Header */}
      <div className="mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">دراسة الجدوى المبدئية — ند الشبا جاردنز</h1>
            <p className="text-sm text-gray-600 mt-1">Initial Feasibility Study — Nad Al Sheba Gardens</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEnglish(!showEnglish)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              {showEnglish ? "عربي فقط" : "عربي + English"}
            </button>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">الموقع:</span>
            <span className="font-medium mr-1">ند الشبا الأولى، دبي</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">رقم القطعة:</span>
            <span className="font-medium mr-1">6185392</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">سعر الأرض:</span>
            <span className="font-medium mr-1">18,000,000 درهم</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">قيمة المبيعات:</span>
            <span className="font-medium mr-1">93,765,000 درهم</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">الوصف:</span>
            <span className="font-medium mr-1">أرضي + 2 بوديوم + 6 طوابق سكنية</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">الوحدات:</span>
            <span className="font-medium mr-1">(12) 2BHK + (36) 1BHK</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">مرحلة التصميم:</span>
            <span className="font-medium mr-1">6 أشهر</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-500">مرحلة البناء:</span>
            <span className="font-medium mr-1">18 شهر</span>
          </div>
        </div>

        {/* Area Info */}
        <div className="grid grid-cols-6 gap-3 mt-2 text-xs">
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">مساحة الأرض</div>
            <div className="font-bold">16,942 sqft</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">مساحة البناء</div>
            <div className="font-bold">114,284 sqft</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">GFA سكني</div>
            <div className="font-bold">46,736 sqft</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">GFA تجاري</div>
            <div className="font-bold">4,090 sqft</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">قابل للبيع سكني</div>
            <div className="font-bold">45,000 sqft</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="text-gray-500">قابل للبيع تجاري</div>
            <div className="font-bold">4,000 sqft</div>
          </div>
        </div>
      </div>

      {/* TABLE 1: INVESTOR EXPENSES */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-4 h-4 bg-amber-400 rounded-sm inline-block"></span>
          جدول (1): مصاريف المستثمر — التمويل المباشر
        </h2>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-max text-xs border-collapse" style={{ direction: "ltr" }}>
            <thead>
              {/* Phase header row */}
              <tr className="bg-gray-800 text-white">
                <th className="sticky right-0 z-20 bg-gray-800 px-3 py-2 text-right border-l border-gray-600 min-w-[200px]">البند</th>
                <th className="sticky right-[200px] z-20 bg-gray-800 px-2 py-2 text-center border-l border-gray-600 min-w-[90px]">الإجمالي</th>
                <th className="sticky right-[290px] z-20 bg-gray-800 px-2 py-2 text-center border-l border-gray-600 min-w-[50px]">%</th>
                {PHASES.map((phase, pi) => (
                  <th
                    key={pi}
                    colSpan={phase.cols.length}
                    className={`px-2 py-2 text-center border-l border-gray-600 ${
                      pi === 0 ? "bg-gray-700" : pi === 1 ? "bg-amber-700" : pi === 2 ? "bg-blue-800" : "bg-green-800"
                    }`}
                  >
                    {phase.label}
                  </th>
                ))}
              </tr>
              {/* Month number row */}
              <tr className="bg-gray-100 text-gray-700 font-medium">
                <th className="sticky right-0 z-20 bg-gray-100 px-3 py-1 text-right border-l border-gray-300"></th>
                <th className="sticky right-[200px] z-20 bg-gray-100 px-2 py-1 text-center border-l border-gray-300">(AED)</th>
                <th className="sticky right-[290px] z-20 bg-gray-100 px-2 py-1 text-center border-l border-gray-300"></th>
                {PHASES.map((phase) =>
                  phase.monthLabels.map((ml, mi) => (
                    <th key={`${phase.label}-${mi}`} className="px-2 py-1 text-center border-l border-gray-200 min-w-[85px]">
                      {ml}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {investorItems.map((item, idx) => (
                <tr key={idx} className={`${idx % 2 === 0 ? "bg-amber-50" : "bg-white"} hover:bg-amber-100 transition-colors`}>
                  <td className="sticky right-0 z-10 px-3 py-1.5 text-right border-l border-gray-200 font-medium bg-inherit">
                    {item.name}
                    {showEnglish && <div className="text-[10px] text-gray-400">{item.nameEn}</div>}
                  </td>
                  <td className="sticky right-[200px] z-10 px-2 py-1.5 text-center border-l border-gray-200 font-bold bg-inherit text-gray-900">
                    {fmtFull(item.total)}
                  </td>
                  <td className="sticky right-[290px] z-10 px-2 py-1.5 text-center border-l border-gray-200 text-gray-500 bg-inherit">
                    {item.pct || ""}
                  </td>
                  {ALL_COLS.map((col) => (
                    <td key={col} className="px-2 py-1.5 text-center border-l border-gray-100 tabular-nums">
                      {fmt(item.data[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {/* INVESTOR TOTAL ROW */}
              <tr className="bg-amber-300 font-bold text-gray-900 border-t-2 border-amber-500">
                <td className="sticky right-0 z-10 px-3 py-2 text-right border-l border-amber-400 bg-amber-300">
                  إجمالي مصاريف المستثمر
                </td>
                <td className="sticky right-[200px] z-10 px-2 py-2 text-center border-l border-amber-400 bg-amber-300">
                  {fmtFull(Math.round(investorGrandTotal))}
                </td>
                <td className="sticky right-[290px] z-10 px-2 py-2 text-center border-l border-amber-400 bg-amber-300"></td>
                {ALL_COLS.map((col) => (
                  <td key={col} className="px-2 py-2 text-center border-l border-amber-400 tabular-nums">
                    {fmt(investorTotals[col])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 2: ESCROW EXPENSES */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-4 h-4 bg-blue-500 rounded-sm inline-block"></span>
          جدول (2): مصاريف حساب الضمان (الإسكرو)
        </h2>

        {/* Escrow opening balance note */}
        <div className="mb-2 text-sm text-gray-600 bg-blue-50 p-2 rounded inline-block">
          رصيد افتتاحي لحساب الضمان: <span className="font-bold text-blue-800">{fmtFull(escrowOpeningBalance)} درهم</span>
          <span className="text-gray-400 mr-2">(إيداع الضمان 20% من تكلفة البناء)</span>
        </div>

        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-max text-xs border-collapse" style={{ direction: "ltr" }}>
            <thead>
              {/* Phase header row */}
              <tr className="bg-gray-800 text-white">
                <th className="sticky right-0 z-20 bg-gray-800 px-3 py-2 text-right border-l border-gray-600 min-w-[200px]">البند</th>
                <th className="sticky right-[200px] z-20 bg-gray-800 px-2 py-2 text-center border-l border-gray-600 min-w-[90px]">الإجمالي</th>
                <th className="sticky right-[290px] z-20 bg-gray-800 px-2 py-2 text-center border-l border-gray-600 min-w-[50px]">%</th>
                {PHASES.map((phase, pi) => (
                  <th
                    key={pi}
                    colSpan={phase.cols.length}
                    className={`px-2 py-2 text-center border-l border-gray-600 ${
                      pi === 0 ? "bg-gray-700" : pi === 1 ? "bg-amber-700" : pi === 2 ? "bg-blue-800" : "bg-green-800"
                    }`}
                  >
                    {phase.label}
                  </th>
                ))}
              </tr>
              {/* Month number row */}
              <tr className="bg-gray-100 text-gray-700 font-medium">
                <th className="sticky right-0 z-20 bg-gray-100 px-3 py-1 text-right border-l border-gray-300"></th>
                <th className="sticky right-[200px] z-20 bg-gray-100 px-2 py-1 text-center border-l border-gray-300">(AED)</th>
                <th className="sticky right-[290px] z-20 bg-gray-100 px-2 py-1 text-center border-l border-gray-300"></th>
                {PHASES.map((phase) =>
                  phase.monthLabels.map((ml, mi) => (
                    <th key={`${phase.label}-${mi}`} className="px-2 py-1 text-center border-l border-gray-200 min-w-[85px]">
                      {ml}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {escrowItems.map((item, idx) => (
                <tr key={idx} className={`${idx % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}>
                  <td className="sticky right-0 z-10 px-3 py-1.5 text-right border-l border-gray-200 font-medium bg-inherit">
                    {item.name}
                    {showEnglish && <div className="text-[10px] text-gray-400">{item.nameEn}</div>}
                  </td>
                  <td className="sticky right-[200px] z-10 px-2 py-1.5 text-center border-l border-gray-200 font-bold bg-inherit text-gray-900">
                    {fmtFull(item.total)}
                  </td>
                  <td className="sticky right-[290px] z-10 px-2 py-1.5 text-center border-l border-gray-200 text-gray-500 bg-inherit">
                    {item.pct || ""}
                  </td>
                  {ALL_COLS.map((col) => (
                    <td key={col} className="px-2 py-1.5 text-center border-l border-gray-100 tabular-nums">
                      {fmt(item.data[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {/* ESCROW TOTAL ROW */}
              <tr className="bg-blue-300 font-bold text-gray-900 border-t-2 border-blue-500">
                <td className="sticky right-0 z-10 px-3 py-2 text-right border-l border-blue-400 bg-blue-300">
                  إجمالي مصاريف الإسكرو
                </td>
                <td className="sticky right-[200px] z-10 px-2 py-2 text-center border-l border-blue-400 bg-blue-300">
                  {fmtFull(Math.round(escrowGrandTotal))}
                </td>
                <td className="sticky right-[290px] z-10 px-2 py-2 text-center border-l border-blue-400 bg-blue-300"></td>
                {ALL_COLS.map((col) => {
                  const total = escrowItems.reduce((s, item) => s + (item.data[col] || 0), 0);
                  return (
                    <td key={col} className="px-2 py-2 text-center border-l border-blue-400 tabular-nums">
                      {fmt(total)}
                    </td>
                  );
                })}
              </tr>
              {/* ESCROW BALANCE ROW */}
              <tr className="bg-green-100 font-bold text-gray-900 border-t-2 border-green-400">
                <td className="sticky right-0 z-10 px-3 py-2 text-right border-l border-green-300 bg-green-100">
                  رصيد حساب الضمان
                </td>
                <td className="sticky right-[200px] z-10 px-2 py-2 text-center border-l border-green-300 bg-green-100"></td>
                <td className="sticky right-[290px] z-10 px-2 py-2 text-center border-l border-green-300 bg-green-100"></td>
                {ALL_COLS.map((col) => {
                  const val = escrowBalance[col];
                  return (
                    <td key={col} className={`px-2 py-2 text-center border-l border-green-300 tabular-nums ${val !== undefined && val < 0 ? "text-red-600" : "text-green-700"}`}>
                      {val !== undefined ? fmt(val) : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* REVENUE SUMMARY */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-4 h-4 bg-green-500 rounded-sm inline-block"></span>
          ملخص الإيرادات
        </h2>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2 text-right">البند</th>
                <th className="px-4 py-2 text-center">المساحة (sqft)</th>
                <th className="px-4 py-2 text-center">سعر القدم (AED)</th>
                <th className="px-4 py-2 text-center">الإجمالي (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50">
                <td className="px-4 py-2 text-right font-medium">مبيعات سكنية</td>
                <td className="px-4 py-2 text-center">{revenue.residential.area.toLocaleString()}</td>
                <td className="px-4 py-2 text-center">{revenue.residential.price.toLocaleString()}</td>
                <td className="px-4 py-2 text-center font-bold">{revenue.residential.total.toLocaleString()}</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-2 text-right font-medium">مبيعات تجارية</td>
                <td className="px-4 py-2 text-center">{revenue.retail.area.toLocaleString()}</td>
                <td className="px-4 py-2 text-center">{revenue.retail.price.toLocaleString()}</td>
                <td className="px-4 py-2 text-center font-bold">{revenue.retail.total.toLocaleString()}</td>
              </tr>
              <tr className="bg-green-200 font-bold border-t-2 border-green-400">
                <td className="px-4 py-2 text-right">إجمالي قيمة المبيعات</td>
                <td className="px-4 py-2 text-center">{(revenue.residential.area + revenue.retail.area).toLocaleString()}</td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center">{revenue.projectSaleValue.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY BOX */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <div className="text-sm text-gray-600">إجمالي مصاريف المستثمر</div>
          <div className="text-xl font-bold text-amber-800">{fmtFull(Math.round(investorGrandTotal))} AED</div>
        </div>
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="text-sm text-gray-600">إجمالي مصاريف الإسكرو</div>
          <div className="text-xl font-bold text-blue-800">{fmtFull(Math.round(escrowGrandTotal))} AED</div>
        </div>
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <div className="text-sm text-gray-600">إجمالي قيمة المبيعات</div>
          <div className="text-xl font-bold text-green-800">{revenue.projectSaleValue.toLocaleString()} AED</div>
        </div>
      </div>
    </div>
  );
}
