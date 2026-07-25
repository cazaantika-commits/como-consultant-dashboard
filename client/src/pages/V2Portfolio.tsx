import { useState } from "react";
import { ArrowRight, Settings2, Download, Check } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA — will be replaced with real calculations later =====
const PROJECTS = [
  {
    id: "majan",
    name: "مجان متعدد الاستخدامات",
    designMonths: 8,
    constructionMonths: 24,
    color: "#0d9488",
  },
  {
    id: "jaddaf",
    name: "الجداف السكني",
    designMonths: 6,
    constructionMonths: 18,
    color: "#6366f1",
  },
  {
    id: "nad1",
    name: "ند الشبا — قطعة 1",
    designMonths: 6,
    constructionMonths: 18,
    color: "#f59e0b",
  },
  {
    id: "nad3",
    name: "ند الشبا — قطعة 3 (فلل)",
    designMonths: 5,
    constructionMonths: 14,
    color: "#ec4899",
  },
];

// Generate dummy cumulative row for a project
function dummyCumulative(totalMonths: number): number[] {
  const result: number[] = [];
  let cum = 0;
  for (let i = 0; i < totalMonths; i++) {
    cum -= Math.round(Math.random() * 3_000_000 + 500_000);
    // Last 2 months get credit
    if (i >= totalMonths - 2) cum += Math.round(Math.random() * 15_000_000 + 5_000_000);
    result.push(cum);
  }
  return result;
}

export default function V2Portfolio() {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<string[]>(PROJECTS.map((p) => p.id));

  // Find the max total months across selected projects
  const selectedProjects = PROJECTS.filter((p) => selected.includes(p.id));
  const maxMonths = Math.max(...selectedProjects.map((p) => p.designMonths + p.constructionMonths), 0);

  // Generate dummy data for each project
  const [projectData] = useState(() =>
    PROJECTS.reduce<Record<string, number[]>>((acc, p) => {
      acc[p.id] = dummyCumulative(p.designMonths + p.constructionMonths);
      return acc;
    }, {})
  );

  // Pad shorter projects with their final value
  const paddedData = selectedProjects.map((p) => {
    const data = projectData[p.id];
    const padded = [...data];
    while (padded.length < maxMonths) padded.push(padded[padded.length - 1]);
    return { ...p, cumulative: padded };
  });

  // Combined cumulative (sum of all selected)
  const combined = Array.from({ length: maxMonths }, (_, m) =>
    paddedData.reduce((sum, p) => sum + p.cumulative[m], 0)
  );

  const peakNegative = Math.min(...combined, 0);
  const finalValue = combined[combined.length - 1] || 0;

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };

  const toggleProject = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
              <h1 className="text-xl font-bold text-gray-900">المحفظة الاستثمارية</h1>
              <p className="text-sm text-gray-500">
                التدفقات النقدية المجمّعة — {selectedProjects.length} مشاريع
              </p>
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

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Project Selection */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">اختر المشاريع</h3>
          <div className="flex flex-wrap gap-3">
            {PROJECTS.map((p) => {
              const isSelected = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition text-sm font-medium ${
                    isSelected
                      ? "border-current bg-opacity-10"
                      : "border-gray-200 text-gray-400 bg-gray-50"
                  }`}
                  style={isSelected ? { color: p.color, borderColor: p.color, backgroundColor: p.color + "15" } : {}}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      isSelected ? "bg-current" : "bg-gray-200"
                    }`}
                    style={isSelected ? { backgroundColor: p.color } : {}}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
            <p className="text-sm text-red-600 mb-1">ذروة رأس المال المطلوب</p>
            <p className="text-2xl font-bold text-red-700">{fmt(peakNegative)}</p>
            <p className="text-xs text-gray-400 mt-1">أقصى سحب تراكمي</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-teal-100 shadow-sm">
            <p className="text-sm text-teal-600 mb-1">العائد النهائي</p>
            <p className={`text-2xl font-bold ${finalValue >= 0 ? "text-teal-700" : "text-red-700"}`}>
              {fmt(finalValue)}
            </p>
            <p className="text-xs text-gray-400 mt-1">القيمة التراكمية النهائية</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">عدد المشاريع</p>
            <p className="text-2xl font-bold text-gray-800">{selectedProjects.length}</p>
            <p className="text-xs text-gray-400 mt-1">من أصل {PROJECTS.length}</p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: maxMonths * 80 + 200 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[180px]">
                    المشروع
                  </th>
                  {Array.from({ length: maxMonths }, (_, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-center border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap"
                    >
                      شهر {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Each project's cumulative row */}
                {paddedData.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <td className="sticky right-0 z-10 bg-white px-4 py-3 text-right border-l border-gray-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-medium text-gray-800">{p.name}</span>
                      </div>
                    </td>
                    {p.cumulative.map((val, i) => (
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
                ))}

                {/* Combined Total Row */}
                <tr className="bg-teal-50 font-bold border-t-2 border-teal-200">
                  <td className="sticky right-0 z-10 bg-teal-50 px-4 py-3 text-right text-teal-800 border-l border-teal-200">
                    الإجمالي المجمّع
                  </td>
                  {combined.map((val, i) => (
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
