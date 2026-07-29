import { useState, useMemo } from "react";
import { ArrowRight, Settings2, Download, Check } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// Month names in Arabic
const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex % 12];
}

export default function V2Portfolio() {
  const [, navigate] = useLocation();
  
  // Fetch all projects
  const projectsQuery = trpc.projects.list.useQuery();
  const projects = projectsQuery.data || [];
  
  // Fetch investor cash flow data for each project
  const [selected, setSelected] = useState<string[]>([]);
  
  // Initialize selected projects on first load
  useMemo(() => {
    if (projects.length > 0 && selected.length === 0) {
      setSelected(projects.map(p => p.id));
    }
  }, [projects.length]);

  // Fetch cash flow data for each project
  const cashFlowQueries = projects.map(project =>
    trpc.projects.getInvestorCashFlow.useQuery(
      { projectId: project.id },
      { enabled: selected.includes(project.id) }
    )
  );

  // Build project data with cumulative values
  const selectedProjects = projects.filter(p => selected.includes(p.id));
  
  const projectDataWithCumulative = useMemo(() => {
    return selectedProjects.map((project, idx) => {
      const cashFlowData = cashFlowQueries[projects.findIndex(p => p.id === project.id)]?.data;
      
      if (!cashFlowData || !cashFlowData.rows) {
        return { ...project, cumulative: [] };
      }

      // Extract monthly values from cash flow rows
      // Sum all rows for each month to get total monthly cash flow
      const monthlyValues: number[] = [];
      const totalMonths = project.designDuration + project.constructionDuration;
      
      for (let month = 0; month < totalMonths; month++) {
        let monthTotal = 0;
        cashFlowData.rows.forEach(row => {
          if (row.designMonths && row.designMonths[month] !== undefined) {
            monthTotal += row.designMonths[month];
          }
          if (row.constructionMonths && row.constructionMonths[month] !== undefined) {
            monthTotal += row.constructionMonths[month];
          }
          if (row.postConstructionMonths && row.postConstructionMonths[month] !== undefined) {
            monthTotal += row.postConstructionMonths[month];
          }
        });
        monthlyValues.push(monthTotal);
      }

      // Calculate cumulative
      const cumulative: number[] = [];
      let cum = 0;
      monthlyValues.forEach(val => {
        cum += val;
        cumulative.push(cum);
      });

      return { ...project, cumulative };
    });
  }, [selectedProjects, cashFlowQueries]);

  // Find max months
  const maxMonths = Math.max(
    ...selectedProjects.map(p => p.designDuration + p.constructionDuration),
    0
  );

  // Pad shorter projects
  const paddedData = projectDataWithCumulative.map(p => {
    const padded = [...p.cumulative];
    while (padded.length < maxMonths) {
      padded.push(padded[padded.length - 1] || 0);
    }
    return { ...p, cumulative: padded };
  });

  // Combined cumulative
  const combined = Array.from({ length: maxMonths }, (_, m) =>
    paddedData.reduce((sum, p) => sum + (p.cumulative[m] || 0), 0)
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

  const isLoading = projectsQuery.isLoading || cashFlowQueries.some(q => q.isLoading);

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/v2")} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-gray-900">المحفظة الاستثمارية</h1>
              <p className="text-xs text-gray-500">
                التدفقات النقدية المجمّعة — {selectedProjects.length} مشاريع
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-700">
              <Settings2 className="w-3.5 h-3.5" /> إعدادات
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs">
              <Download className="w-3.5 h-3.5" /> تصدير
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-1">
        {/* Project Selection */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 mb-4">
          <h3 className="text-xs font-bold text-gray-700 mb-2">اختر المشاريع</h3>
          <div className="flex flex-wrap gap-2">
            {projects.map((p, idx) => {
              const isSelected = selected.includes(p.id);
              const colors = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899"];
              const color = colors[idx % colors.length];
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition text-xs font-medium ${
                    isSelected
                      ? "border-current bg-opacity-10"
                      : "border-gray-200 text-gray-400 bg-gray-50"
                  }`}
                  style={isSelected ? { color, borderColor: color, backgroundColor: color + "15" } : {}}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      isSelected ? "bg-current" : "bg-gray-200"
                    }`}
                    style={isSelected ? { backgroundColor: color } : {}}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-red-100 shadow-sm">
            <p className="text-[10px] text-red-600 mb-0.5">ذروة رأس المال المطلوب</p>
            <p className="text-base font-bold text-red-700">{fmt(peakNegative)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-teal-100 shadow-sm">
            <p className="text-[10px] text-teal-600 mb-0.5">العائد النهائي</p>
            <p className={`text-base font-bold ${finalValue >= 0 ? "text-teal-700" : "text-red-700"}`}>{fmt(finalValue)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-600 mb-0.5">عدد المشاريع</p>
            <p className="text-base font-bold text-gray-800">{selectedProjects.length} / {projects.length}</p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: maxMonths * 65 + 180 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-3 py-1.5 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[160px] text-xs">
                    المشروع
                  </th>
                  {Array.from({ length: maxMonths }, (_, i) => (
                    <th key={i} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap">
                      {getMonthName(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Each project's cumulative row */}
                {paddedData.map((p, idx) => {
                  const colors = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899"];
                  const color = colors[idx % colors.length];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                      <td className="sticky right-0 z-10 bg-white px-3 py-[5px] text-right border-l border-gray-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-gray-800">{p.name}</span>
                        </div>
                      </td>
                      {p.cumulative.map((val, i) => (
                        <td key={i} className={`px-1.5 py-[5px] text-center tabular-nums ${val >= 0 ? "text-teal-700" : "text-red-700"}`}>
                          {fmt(val)}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Combined Total Row */}
                <tr className="bg-teal-50 font-bold border-t-2 border-teal-200">
                  <td className="sticky right-0 z-10 bg-teal-50 px-3 py-1.5 text-right text-teal-800 border-l border-teal-200">
                    الإجمالي المجمّع
                  </td>
                  {combined.map((val, i) => (
                    <td key={i} className={`px-1.5 py-1.5 text-center tabular-nums ${val >= 0 ? "text-teal-700" : "text-red-700"}`}>
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
