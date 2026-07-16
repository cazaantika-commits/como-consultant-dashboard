import { useProjectContext } from "@/contexts/ProjectContext";
import { useState, useMemo, useRef } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  computeInvestorCashFlow,
  type Scenario,
  type CostRow,
} from "@/lib/investorCashFlowEngine";
import {
  exportToExcel,
  exportToHTML,
  exportToPDF,
  extractTableFromDOM,
} from "@/lib/tableExport";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (n === 0) return "–";
  return Math.round(n).toLocaleString("en-US");
}

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20% من الإنشاء",
  no_offplan: "تطوير بدون بيع على الخارطة",
  rental: "تطوير للتأجير",
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function InvestorCashFlowSchedulePage() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const tableRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    return computeInvestorCashFlow(projectQuery.data || null, scenario);
  }, [scenario, projectQuery.data]);

  const projectName = projectQuery.data?.name || "مجان متعدد الاستخدامات";

  // ─── Export Handlers ───
  const handleExportExcel = () => {
    const tableData = extractTableFromDOM(
      tableRef,
      "جدولة رأس المال — المستثمر",
      projectName,
      SCENARIO_LABELS[scenario],
      "توزيع المصاريف على المراحل الزمنية حسب إعدادات التدفق | المبالغ بالدرهم الإماراتي"
    );
    if (tableData) {
      exportToExcel(tableData, `جدولة_المستثمر_${projectName}_${scenario}`);
    }
  };

  const handleExportHTML = () => {
    const tableData = extractTableFromDOM(
      tableRef,
      "جدولة رأس المال — المستثمر",
      projectName,
      SCENARIO_LABELS[scenario],
      "توزيع المصاريف على المراحل الزمنية حسب إعدادات التدفق | المبالغ بالدرهم الإماراتي"
    );
    if (tableData) {
      exportToHTML(tableData, `جدولة_المستثمر_${projectName}_${scenario}`);
    }
  };

  const handleExportPDF = () => {
    exportToPDF();
  };

  return (
    <div className="min-h-screen bg-white p-4" dir="rtl">
      <div className="max-w-full mx-auto space-y-4">

        {/* Project Selector */}
        <div data-hide-print>
          <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />
        </div>

        {/* Header */}
        <div className="text-right space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            جدولة رأس المال – {projectName}
          </h1>
          <p className="text-sm text-gray-500">
            توزيع المصاريف على المراحل الزمنية حسب إعدادات التدفق | المبالغ بالدرهم الإماراتي
          </p>
        </div>

        {/* Scenario Tabs */}
        <div className="flex gap-2 flex-wrap" data-hide-print>
          <button
            onClick={() => setScenario("offplan_escrow")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "offplan_escrow"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            أوف بلان مع إيداع في حساب الضمان
          </button>
          <button
            onClick={() => setScenario("offplan_construction")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "offplan_construction"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            أوف بلان بعد إنجاز 20% من الإنشاء
          </button>
          <button
            onClick={() => setScenario("no_offplan")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "no_offplan"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            تطوير بدون بيع على الخارطة
          </button>
          <button
            onClick={() => setScenario("rental")}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              scenario === "rental"
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            تطوير للتأجير
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 flex-wrap" data-hide-print>
          <button
            onClick={handleExportPDF}
            data-show-print
            className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            📄 تصدير PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            📊 تصدير Excel
          </button>
          <button
            onClick={handleExportHTML}
            className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            🌐 تصدير HTML
          </button>
        </div>

        {/* Table */}
        <div ref={tableRef} className="overflow-x-auto border rounded-lg">
          <table className="w-max min-w-full text-xs border-collapse">
            <thead>
              {/* Header Row 1 — Groups */}
              <tr className="bg-gray-800 text-white">
                <th className="sticky right-0 z-30 bg-gray-800 border border-gray-600 px-2 py-2 text-right min-w-[180px]" rowSpan={2}>
                  الوصف
                </th>
                <th className="border border-gray-600 px-2 py-2 text-center" rowSpan={2}>إجمالي التكاليف</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-blue-900" rowSpan={2}>إجمالي المستثمر</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-green-900" rowSpan={2}>مدفوع</th>
                <th className="border border-gray-600 px-2 py-2 text-center bg-red-900" rowSpan={2}>غير مدفوع</th>
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-purple-800"
                  colSpan={data.designDuration}
                >
                  التصاميم ({data.designDuration} أشهر)
                </th>
                <th
                  className="border border-gray-600 px-2 py-2 text-center bg-green-800"
                  colSpan={data.constructionDuration}
                >
                  الإنشاء ({data.constructionDuration} شهر)
                </th>
                {data.postDuration > 0 && (
                  <th
                    className="border border-gray-600 px-2 py-2 text-center bg-orange-700"
                    colSpan={data.postDuration}
                  >
                    بعد الإنجاز ({data.postDuration} أشهر)
                  </th>
                )}
                <th className="border border-gray-600 px-2 py-2 text-center bg-yellow-700" rowSpan={2}>تحقق</th>
              </tr>
              {/* Header Row 2 — Month Numbers */}
              <tr className="bg-gray-700 text-white">
                {Array.from({ length: data.designDuration }, (_, i) => (
                  <th key={`dh${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-purple-700">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: data.constructionDuration }, (_, i) => (
                  <th key={`ch${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-green-700">
                    ش{i + 1}
                  </th>
                ))}
                {Array.from({ length: data.postDuration }, (_, i) => (
                  <th key={`ph${i}`} className="border border-gray-600 px-1 py-1 text-center min-w-[70px] bg-orange-600">
                    ش{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sections.map((section) => {
                const sectionRows = data.rows.filter(r => r.section === section);
                if (sectionRows.length === 0) return null;
                return (
                  <SectionGroup
                    key={section}
                    title={section}
                    rows={sectionRows}
                    designDuration={data.designDuration}
                    constructionDuration={data.constructionDuration}
                    postDuration={data.postDuration}
                  />
                );
              })}
            </tbody>
            {/* Footer — Totals + Cumulative */}
            <tfoot>
              <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-300">
                <td className="sticky right-0 z-20 bg-indigo-50 border border-gray-200 px-2 py-2 text-right text-indigo-900">إجمالي</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-indigo-900">{fmt(data.grandTotalCost)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-blue-800">{fmt(data.grandInvestor)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-green-800">{fmt(data.grandPaid)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center text-red-800">{fmt(data.grandUnpaid)}</td>
                {data.designMonthlyTotals.map((v, i) => (
                  <td key={`dt${i}`} className="border border-gray-200 px-1 py-2 text-center text-indigo-800">{fmt(v)}</td>
                ))}
                {data.constructionMonthlyTotals.map((v, i) => (
                  <td key={`ct${i}`} className="border border-gray-200 px-1 py-2 text-center text-indigo-800">{fmt(v)}</td>
                ))}
                {data.postMonthlyTotals.map((v, i) => (
                  <td key={`pt${i}`} className="border border-gray-200 px-1 py-2 text-center text-indigo-800">{fmt(v)}</td>
                ))}
                <td className="border border-gray-200 px-2 py-2 text-center"></td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="sticky right-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-right text-gray-700">إجمالي تراكمي (مستثمر)</td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                <td className="border border-gray-200"></td>
                {data.cumulativeDesign.map((v, i) => (
                  <td key={`cd${i}`} className="border border-gray-200 px-1 py-2 text-center text-gray-700">{fmt(v)}</td>
                ))}
                {data.cumulativeConstruction.map((v, i) => (
                  <td key={`cc${i}`} className="border border-gray-200 px-1 py-2 text-center text-gray-700">{fmt(v)}</td>
                ))}
                {data.cumulativePost.map((v, i) => (
                  <td key={`cp${i}`} className="border border-gray-200 px-1 py-2 text-center text-gray-700">{fmt(v)}</td>
                ))}
                <td className="border border-gray-200"></td>
              </tr>
              {/* Revenue totals row */}
              {data.postDuration > 0 && data.revenuePostTotals.some(v => v > 0) && (
                <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                  <td className="sticky right-0 z-20 bg-green-50 border border-gray-200 px-2 py-2 text-right text-green-900">إجمالي الإيرادات</td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  {data.designMonthlyTotals.map((_, i) => (
                    <td key={`rd${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">–</td>
                  ))}
                  {data.constructionMonthlyTotals.map((_, i) => (
                    <td key={`rc${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">–</td>
                  ))}
                  {data.revenuePostTotals.map((v, i) => (
                    <td key={`rp${i}`} className="border border-gray-200 px-1 py-2 text-center text-green-800">{fmt(v)}</td>
                  ))}
                  <td className="border border-gray-200"></td>
                </tr>
              )}
              {/* Net cash flow row (expenses - revenue) */}
              {data.postDuration > 0 && data.revenuePostTotals.some(v => v > 0) && (
                <tr className="bg-amber-50 font-bold border-t-2 border-amber-300">
                  <td className="sticky right-0 z-20 bg-amber-50 border border-gray-200 px-2 py-2 text-right text-amber-900">صافي التدفق الشهري</td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  <td className="border border-gray-200"></td>
                  {data.designMonthlyTotals.map((v, i) => (
                    <td key={`nd${i}`} className="border border-gray-200 px-1 py-2 text-center text-amber-800">{fmt(v)}</td>
                  ))}
                  {data.constructionMonthlyTotals.map((v, i) => (
                    <td key={`nc${i}`} className="border border-gray-200 px-1 py-2 text-center text-amber-800">{fmt(v)}</td>
                  ))}
                  {data.postMonthlyTotals.map((v, i) => (
                    <td key={`np${i}`} className="border border-gray-200 px-1 py-2 text-center text-amber-800">{fmt(v - data.revenuePostTotals[i])}</td>
                  ))}
                  <td className="border border-gray-200"></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SECTION GROUP COMPONENT
// ═══════════════════════════════════════════
function SectionGroup({
  title,
  rows,
  designDuration,
  constructionDuration,
  postDuration,
}: {
  title: string;
  rows: CostRow[];
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
}) {
  return (
    <>
      {/* Section Rows */}
      {rows.map((row, idx) => (
        <tr key={idx} className={`hover:bg-blue-50/30 ${row.isRevenue ? 'bg-green-50/50' : ''}`}>
          <td className={`sticky right-0 z-10 border border-gray-200 px-2 py-1.5 text-right whitespace-nowrap ${row.isRevenue ? 'bg-green-50 text-green-800 font-semibold' : 'bg-white text-gray-800'}`}>
            {row.label}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-800">{fmt(row.totalCost)}</td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-blue-700">
            {row.funder === "escrow" ? (
              <span className="text-gray-400">من الضمان</span>
            ) : (
              fmt(row.investorAmount)
            )}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-green-700">
            {row.paid > 0 ? fmt(row.paid) : "–"}
          </td>
          <td className="border border-gray-200 px-2 py-1.5 text-center text-red-700">
            {row.funder === "escrow" ? (
              <span className="text-gray-400">من الضمان</span>
            ) : row.unpaid > 0 ? (
              fmt(row.unpaid)
            ) : (
              "–"
            )}
          </td>
          {/* Design Months */}
          {row.designMonths.map((v, i) => (
            <td key={`d${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
              {row.funder === "escrow" ? (
                <span className="text-gray-300">–</span>
              ) : v > 0 ? (
                fmt(v)
              ) : (
                "–"
              )}
            </td>
          ))}
          {/* Construction Months */}
          {row.constructionMonths.map((v, i) => (
            <td key={`c${i}`} className="border border-gray-200 px-1 py-1.5 text-center text-gray-700">
              {row.funder === "escrow" ? (
                <span className="text-gray-300">–</span>
              ) : v > 0 ? (
                fmt(v)
              ) : (
                "–"
              )}
            </td>
          ))}
          {/* Post-Construction Months */}
          {row.postConstructionMonths.map((v, i) => (
            <td key={`p${i}`} className={`border border-gray-200 px-1 py-1.5 text-center ${row.isRevenue ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
              {v > 0 ? fmt(v) : "–"}
            </td>
          ))}
          {/* Validation Column */}
          {(() => {
            if (row.funder === "escrow" || row.paid >= row.totalCost || row.isRevenue) {
              return <td className="border border-gray-200 px-1 py-1.5 text-center text-gray-400">–</td>;
            }
            const distributedSum = row.designMonths.reduce((s, v) => s + v, 0) +
              row.constructionMonths.reduce((s, v) => s + v, 0) +
              row.postConstructionMonths.reduce((s, v) => s + v, 0);
            const expected = row.investorAmount;
            const diff = Math.abs(distributedSum - expected);
            const isMatch = diff < 1;
            return (
              <td className={`border border-gray-200 px-1 py-1.5 text-center font-bold ${isMatch ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-100'}`}>
                {isMatch ? "✓" : <span title={`الفرق: ${fmt(diff)}`}>✗ {fmt(diff)}</span>}
              </td>
            );
          })()}
        </tr>
      ))}
    </>
  );
}
