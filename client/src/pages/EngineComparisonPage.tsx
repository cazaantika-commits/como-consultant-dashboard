import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useLocation } from "wouter";

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function getDiffPct(oldVal: number, newVal: number): number {
  if (oldVal === 0 && newVal === 0) return 0;
  if (oldVal === 0) return 100;
  return Math.abs((newVal - oldVal) / oldVal) * 100;
}

function DiffBadge({ oldVal, newVal }: { oldVal: number; newVal: number }) {
  const pct = getDiffPct(oldVal, newVal);
  if (pct < 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle2 className="w-3 h-3" />
        متطابق
      </span>
    );
  }
  if (pct < 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertTriangle className="w-3 h-3" />
        {pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <XCircle className="w-3 h-3" />
      {pct.toFixed(1)}%
    </span>
  );
}

const SECTION_LABELS: Record<string, string> = {
  paid: "مدفوع (الأرض)",
  design: "التصاميم",
  offplan: "أوف بلان",
  construction: "الإنشاء",
  escrow: "حساب الضمان",
  revenue: "الإيرادات",
};

const SCENARIO_LABELS: Record<string, string> = {
  offplan_escrow: "O1 — أوف بلان (ضمان)",
  offplan_construction: "O2 — أوف بلان (إنجاز)",
  no_offplan: "O3 — بدون أوف بلان",
};

export default function EngineComparisonPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.cashFlowSettings.getEngineComparison.useQuery();
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 ml-2" />
            رجوع
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">مقارنة المحرك المالي</h1>
            <p className="text-sm text-gray-500">المحرك القديم vs المحرك الجديد — تحقق من صحة الأرقام</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3" /> متطابق (&lt;1%)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3" /> فرق بسيط (1-5%)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" /> فرق كبير (&gt;5%)
          </span>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">جاري تحميل البيانات...</p>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-700">خطأ: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {data && data.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">لا توجد مشاريع للمقارنة</p>
            </CardContent>
          </Card>
        )}

        {data && data.length > 0 && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500">عدد المشاريع</p>
                  <p className="text-3xl font-bold text-gray-900">{data.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500">متطابق (&lt;1%)</p>
                  <p className="text-3xl font-bold text-green-600">
                    {data.filter(p => getDiffPct(p.old.grandTotal, p.new.grandTotal) < 1).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500">يحتاج مراجعة (&gt;5%)</p>
                  <p className="text-3xl font-bold text-red-600">
                    {data.filter(p => getDiffPct(p.old.grandTotal, p.new.grandTotal) >= 5).length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Projects Table */}
            <Card>
              <CardHeader>
                <CardTitle>المشاريع</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="text-right p-3 font-medium">المشروع</th>
                        <th className="text-right p-3 font-medium">السيناريو</th>
                        <th className="text-right p-3 font-medium">المحرك القديم</th>
                        <th className="text-right p-3 font-medium">المحرك الجديد</th>
                        <th className="text-center p-3 font-medium">الفرق</th>
                        <th className="text-center p-3 font-medium">تفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((project) => (
                        <>
                          <tr key={project.projectId} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{project.name}</td>
                            <td className="p-3 text-gray-600">{SCENARIO_LABELS[project.scenario] || project.scenario}</td>
                            <td className="p-3 font-mono">{formatNumber(project.old.grandTotal)}</td>
                            <td className="p-3 font-mono">{formatNumber(project.new.grandTotal)}</td>
                            <td className="p-3 text-center">
                              <DiffBadge oldVal={project.old.grandTotal} newVal={project.new.grandTotal} />
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedProject(
                                  expandedProject === project.projectId ? null : project.projectId
                                )}
                              >
                                {expandedProject === project.projectId ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                          {expandedProject === project.projectId && (
                            <tr key={`${project.projectId}-detail`}>
                              <td colSpan={6} className="p-0">
                                <ProjectDetail project={project} />
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectDetail({ project }: { project: any }) {
  return (
    <div className="bg-blue-50/50 p-4 border-t">
      {/* Section Totals Comparison */}
      <h4 className="font-bold text-sm mb-3">مقارنة الأقسام</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Investor vs Escrow */}
        <div className="bg-white rounded-lg p-3 border">
          <h5 className="text-xs font-medium text-gray-500 mb-2">تمويل المستثمر</h5>
          <div className="flex justify-between items-center">
            <span className="text-sm">القديم: <span className="font-mono">{formatNumber(project.old.investorTotal)}</span></span>
            <span className="text-sm">الجديد: <span className="font-mono">{formatNumber(project.new.investorTotal)}</span></span>
            <DiffBadge oldVal={project.old.investorTotal} newVal={project.new.investorTotal} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border">
          <h5 className="text-xs font-medium text-gray-500 mb-2">حساب الضمان</h5>
          <div className="flex justify-between items-center">
            <span className="text-sm">القديم: <span className="font-mono">{formatNumber(project.old.escrowTotal)}</span></span>
            <span className="text-sm">الجديد: <span className="font-mono">{formatNumber(project.new.escrowTotal)}</span></span>
            <DiffBadge oldVal={project.old.escrowTotal} newVal={project.new.escrowTotal} />
          </div>
        </div>
      </div>

      {/* Section-by-section */}
      <h4 className="font-bold text-sm mb-3">مقارنة حسب القسم</h4>
      <table className="w-full text-xs bg-white rounded-lg border">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-right p-2">القسم</th>
            <th className="text-right p-2">القديم</th>
            <th className="text-right p-2">الجديد</th>
            <th className="text-center p-2">الفرق</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(SECTION_LABELS).filter(s => s !== "revenue").map(section => {
            const oldVal = project.old.sectionTotals[section] || 0;
            const newVal = project.new.sectionTotals[section] || 0;
            if (oldVal === 0 && newVal === 0) return null;
            return (
              <tr key={section} className="border-t">
                <td className="p-2 font-medium">{SECTION_LABELS[section]}</td>
                <td className="p-2 font-mono">{formatNumber(oldVal)}</td>
                <td className="p-2 font-mono">{formatNumber(newVal)}</td>
                <td className="p-2 text-center"><DiffBadge oldVal={oldVal} newVal={newVal} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Item-level comparison */}
      <h4 className="font-bold text-sm mt-4 mb-3">مقارنة البنود (المحرك القديم)</h4>
      <table className="w-full text-xs bg-white rounded-lg border">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-right p-2">البند</th>
            <th className="text-right p-2">المبلغ</th>
            <th className="text-right p-2">المصدر</th>
            <th className="text-right p-2">القسم</th>
          </tr>
        </thead>
        <tbody>
          {project.old.items.map((item: any, idx: number) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{item.name}</td>
              <td className="p-2 font-mono">{formatNumber(item.amount)}</td>
              <td className="p-2">{item.source === "investor" ? "مستثمر" : "ضمان"}</td>
              <td className="p-2">{SECTION_LABELS[item.section] || item.section}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="font-bold text-sm mt-4 mb-3">مقارنة البنود (المحرك الجديد)</h4>
      <table className="w-full text-xs bg-white rounded-lg border">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-right p-2">البند</th>
            <th className="text-right p-2">المبلغ</th>
            <th className="text-right p-2">المصدر</th>
          </tr>
        </thead>
        <tbody>
          {project.new.items.map((item: any, idx: number) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{item.name}</td>
              <td className="p-2 font-mono">{formatNumber(item.amount)}</td>
              <td className="p-2">{item.source === "investor" ? "مستثمر" : "ضمان"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Revenue comparison */}
      <div className="mt-4 bg-white rounded-lg p-3 border">
        <h5 className="text-xs font-medium text-gray-500 mb-2">الإيرادات</h5>
        <div className="flex justify-between items-center">
          <span className="text-sm">القديم: <span className="font-mono">{formatNumber(project.old.totalRevenue)}</span></span>
          <span className="text-sm">الجديد: <span className="font-mono">{formatNumber(project.new.totalRevenue)}</span></span>
          <DiffBadge oldVal={project.old.totalRevenue} newVal={project.new.totalRevenue} />
        </div>
      </div>
    </div>
  );
}
