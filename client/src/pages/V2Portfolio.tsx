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
  
  // Fetch portfolio data with all scenarios
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioAllScenarios.useQuery(undefined, {
    staleTime: 60000
  });
  
  const projects = useMemo(() => portfolioQuery.data || [], [portfolioQuery.data]);
  const [selected, setSelected] = useState<number[]>([]);
  
  // Initialize selected projects on first load
  useMemo(() => {
    if (projects.length > 0 && selected.length === 0) {
      setSelected(projects.map((p: any) => p.projectId));
    }
  }, [projects.length]);

  // Get selected projects
  const selectedProjects = useMemo(() => 
    projects.filter((p: any) => selected.includes(p.projectId)),
    [projects, selected]
  );

  // Build table data from portfolio data - use O1 scenario (offplan_escrow)
  const tableData = useMemo(() => {
    if (selectedProjects.length === 0) return { rows: [], maxMonths: 0 };

    // Get max months across all selected projects
    const maxMonths = Math.max(
      ...selectedProjects.map((p: any) => {
        const scenario = p.scenarios?.offplan_escrow;
        return scenario?.monthlyInvestor?.length || 0;
      }),
      0
    );

    if (maxMonths === 0) return { rows: [], maxMonths: 0 };

    // Build rows for each project
    const rows = selectedProjects.map((project: any) => {
      const scenario = project.scenarios?.offplan_escrow;
      const monthlyValues = scenario?.monthlyInvestor || [];
      
      // Calculate cumulative
      const cumulative: number[] = [];
      let cum = 0;
      for (let i = 0; i < maxMonths; i++) {
        cum += monthlyValues[i] || 0;
        cumulative.push(cum);
      }

      return {
        id: project.projectId,
        name: project.name,
        cumulative,
        color: "#0d9488"
      };
    });

    return { rows, maxMonths };
  }, [selectedProjects]);

  // Calculate combined totals
  const combined = useMemo(() => {
    if (tableData.maxMonths === 0) return [];
    
    const totals: number[] = [];
    for (let month = 0; month < tableData.maxMonths; month++) {
      let monthTotal = 0;
      tableData.rows.forEach(row => {
        monthTotal += row.cumulative[month] || 0;
      });
      totals.push(monthTotal);
    }
    return totals;
  }, [tableData]);

  const peakNegative = Math.min(...combined, 0);
  const finalValue = combined[combined.length - 1] || 0;

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toFixed(0);
  };

  const toggleProject = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isLoading = portfolioQuery.isLoading;

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">لا توجد مشاريع</div>
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
            {projects.map((p: any, idx: number) => {
              const isSelected = selected.includes(p.projectId);
              const colors = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899"];
              const color = colors[idx % colors.length];
              return (
                <button
                  key={p.projectId}
                  onClick={() => toggleProject(p.projectId)}
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
            <table className="w-full text-[11px]" style={{ minWidth: tableData.maxMonths * 65 + 180 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky right-0 z-10 bg-gray-50 px-3 py-1.5 text-right font-bold text-gray-700 border-b border-l border-gray-200 min-w-[160px] text-xs">
                    المشروع
                  </th>
                  {Array.from({ length: tableData.maxMonths }, (_, i) => (
                    <th key={i} className="px-2 py-1.5 text-center border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap">
                      {getMonthName(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Each project's cumulative row */}
                {tableData.rows.map((p, idx) => {
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
