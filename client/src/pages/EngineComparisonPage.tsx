import React, { useState } from "react";
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

const SCENARIO_LABELS: Record<string, string> = {
  offplan_escrow: "O1 — أوف بلان (ضمان)",
  offplan_construction: "O2 — أوف بلان (إنجاز)",
  no_offplan: "O3 — بدون أوف بلان",
};

// Cost item labels for comparison
const COST_ITEM_LABELS: Record<string, string> = {
  landPrice: "سعر الأرض",
  agentCommissionLand: "عمولة الوسيط (الأرض)",
  landRegistration: "رسوم تسجيل الأرض",
  soilTestFee: "فحص التربة",
  topographicSurveyFee: "المسح الطبوغرافي",
  officialBodiesFees: "رسوم الجهات الرسمية",
  designFee: "أتعاب التصاميم",
  supervisionFee: "أتعاب الإشراف",
  separationFee: "رسوم الفرز",
  constructionCost: "تكلفة البناء",
  communityFees: "رسوم المجتمع",
  contingencies: "الاحتياطي",
  developerFee: "أتعاب المطور",
  salesCommission: "عمولة المبيعات",
  marketingCost: "تكاليف التسويق",
  reraUnitRegFee: "رسوم تسجيل الوحدات (ريرا)",
  reraProjectRegFee: "رسوم تسجيل المشروع (ريرا)",
  developerNocFee: "شهادة عدم ممانعة المطور",
  escrowAccountFee: "رسوم حساب الضمان",
  bankFees: "رسوم بنكية",
  surveyorFees: "رسوم المساح",
  reraAuditReportFee: "رسوم تقرير تدقيق ريرا",
  reraInspectionReportFee: "رسوم تقرير فحص ريرا",
  totalRevenue: "إجمالي الإيرادات",
  totalCosts: "إجمالي التكاليف",
  grossProfit: "الربح الإجمالي",
};

export default function EngineComparisonPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.cashFlowSettings.getEngineComparison.useQuery();
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  const matchCount = data?.filter(p => getDiffPct(p.old.totalCosts, p.new.totalCosts) < 1).length || 0;
  const reviewCount = data?.filter(p => getDiffPct(p.old.totalCosts, p.new.totalCosts) >= 5).length || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 ml-2" />
            رجوع
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">مقارنة المحرك المالي</h1>
            <p className="text-sm text-gray-500">المحرك القديم vs المحرك الجديد — مقارنة إجمالي التكاليف وكل بند على حدة</p>
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
                  <p className="text-3xl font-bold text-green-600">{matchCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500">يحتاج مراجعة (&gt;5%)</p>
                  <p className="text-3xl font-bold text-red-600">{reviewCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* Projects Table */}
            <Card>
              <CardHeader>
                <CardTitle>المشاريع — مقارنة إجمالي التكاليف</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="text-right p-3 font-medium">المشروع</th>
                        <th className="text-right p-3 font-medium">السيناريو</th>
                        <th className="text-right p-3 font-medium">التكاليف (قديم)</th>
                        <th className="text-right p-3 font-medium">التكاليف (جديد)</th>
                        <th className="text-center p-3 font-medium">الفرق</th>
                        <th className="text-center p-3 font-medium">تفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((project) => (
                        <React.Fragment key={project.projectId}>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{project.name}</td>
                            <td className="p-3 text-gray-600">{SCENARIO_LABELS[project.scenario] || project.scenario}</td>
                            <td className="p-3 font-mono">{formatNumber(project.old.totalCosts)}</td>
                            <td className="p-3 font-mono">{formatNumber(project.new.totalCosts)}</td>
                            <td className="p-3 text-center">
                              <DiffBadge oldVal={project.old.totalCosts} newVal={project.new.totalCosts} />
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
                        </React.Fragment>
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
  // Compare individual cost items
  const costItems = [
    "landPrice", "agentCommissionLand", "landRegistration",
    "soilTestFee", "topographicSurveyFee", "officialBodiesFees",
    "designFee", "supervisionFee", "separationFee",
    "constructionCost", "communityFees", "contingencies",
    "developerFee", "salesCommission", "marketingCost",
    "reraUnitRegFee", "reraProjectRegFee", "developerNocFee",
    "escrowAccountFee", "bankFees", "surveyorFees",
    "reraAuditReportFee", "reraInspectionReportFee",
  ];

  const summaryItems = ["totalCosts", "totalRevenue", "grossProfit"];

  return (
    <div className="bg-blue-50/50 p-4 border-t">
      {/* Summary comparison */}
      <h4 className="font-bold text-sm mb-3">الملخص</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {summaryItems.map(key => {
          const oldVal = project.old.costBreakdown?.[key] || 0;
          const newVal = project.new.costBreakdown?.[key] || 0;
          return (
            <div key={key} className="bg-white rounded-lg p-3 border">
              <h5 className="text-xs font-medium text-gray-500 mb-1">{COST_ITEM_LABELS[key] || key}</h5>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">القديم:</span>
                  <span className="font-mono">{formatNumber(oldVal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">الجديد:</span>
                  <span className="font-mono">{formatNumber(newVal)}</span>
                </div>
                <div className="flex justify-end">
                  <DiffBadge oldVal={oldVal} newVal={newVal} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Item-by-item comparison table */}
      <h4 className="font-bold text-sm mb-3">مقارنة البنود تفصيلياً</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs bg-white rounded-lg border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-right p-2 font-medium">البند</th>
              <th className="text-right p-2 font-medium">القديم</th>
              <th className="text-right p-2 font-medium">الجديد</th>
              <th className="text-center p-2 font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody>
            {costItems.map(key => {
              const oldVal = project.old.costBreakdown?.[key] || 0;
              const newVal = project.new.costBreakdown?.[key] || 0;
              if (oldVal === 0 && newVal === 0) return null;
              const pct = getDiffPct(oldVal, newVal);
              return (
                <tr key={key} className={`border-t ${pct >= 5 ? "bg-red-50" : pct >= 1 ? "bg-yellow-50" : ""}`}>
                  <td className="p-2 font-medium">{COST_ITEM_LABELS[key] || key}</td>
                  <td className="p-2 font-mono">{formatNumber(oldVal)}</td>
                  <td className="p-2 font-mono">{formatNumber(newVal)}</td>
                  <td className="p-2 text-center"><DiffBadge oldVal={oldVal} newVal={newVal} /></td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
              <td className="p-2">إجمالي التكاليف</td>
              <td className="p-2 font-mono">{formatNumber(project.old.totalCosts)}</td>
              <td className="p-2 font-mono">{formatNumber(project.new.totalCosts)}</td>
              <td className="p-2 text-center"><DiffBadge oldVal={project.old.totalCosts} newVal={project.new.totalCosts} /></td>
            </tr>
            <tr className="border-t bg-green-50 font-bold">
              <td className="p-2">إجمالي الإيرادات</td>
              <td className="p-2 font-mono">{formatNumber(project.old.costBreakdown?.totalRevenue || 0)}</td>
              <td className="p-2 font-mono">{formatNumber(project.new.costBreakdown?.totalRevenue || 0)}</td>
              <td className="p-2 text-center"><DiffBadge oldVal={project.old.costBreakdown?.totalRevenue || 0} newVal={project.new.costBreakdown?.totalRevenue || 0} /></td>
            </tr>
            <tr className="border-t bg-blue-50 font-bold">
              <td className="p-2">الربح الإجمالي</td>
              <td className="p-2 font-mono">{formatNumber(project.old.costBreakdown?.grossProfit || 0)}</td>
              <td className="p-2 font-mono">{formatNumber(project.new.costBreakdown?.grossProfit || 0)}</td>
              <td className="p-2 text-center"><DiffBadge oldVal={project.old.costBreakdown?.grossProfit || 0} newVal={project.new.costBreakdown?.grossProfit || 0} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
