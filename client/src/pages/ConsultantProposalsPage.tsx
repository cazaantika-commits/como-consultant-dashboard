import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, ExternalLink, TrendingDown, TrendingUp, Minus, BarChart3 } from "lucide-react";

export default function ConsultantProposalsPage() {
  const { isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const projectsQuery = trpc.projects.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const financialQuery = trpc.financial.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  const projects = projectsQuery.data || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];
  const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);

  const proposals = useMemo(() => {
    if (!financialQuery.data || !projectConsultants.length) return [];
    return projectConsultants.map((consultant) => {
      const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
      if (!fin) return { consultant, designAmount: 0, supervisionAmount: 0, total: 0, designType: 'pct', supervisionType: 'pct', designValue: 0, supervisionValue: 0, proposalLink: '' };
      const dv = parseFloat(fin.designValue as any) || 0;
      const sv = parseFloat(fin.supervisionValue as any) || 0;
      const designAmount = fin.designType === 'pct' ? buildingCost * (dv / 100) : dv;
      const supervisionAmount = fin.supervisionType === 'pct' ? buildingCost * (sv / 100) : sv;
      return {
        consultant,
        designAmount,
        supervisionAmount,
        total: designAmount + supervisionAmount,
        designType: fin.designType || 'pct',
        supervisionType: fin.supervisionType || 'pct',
        designValue: dv,
        supervisionValue: sv,
        proposalLink: (fin as any)?.proposalLink || '',
      };
    }).sort((a, b) => a.total - b.total);
  }, [financialQuery.data, projectConsultants, buildingCost]);

  const cheapest = proposals.length > 0 ? proposals[0] : null;
  const mostExpensive = proposals.length > 0 ? proposals[proposals.length - 1] : null;
  const avgCost = proposals.length > 0 ? proposals.reduce((s, p) => s + p.total, 0) / proposals.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">عروض الاستشاريين</h1>
              <p className="text-stone-400 text-sm">تحليل مقارن للأتعاب المالية وعروض الأسعار</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Project Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
          <label className="text-sm font-medium text-stone-600 mb-2 block">اختر المشروع</label>
          <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => setSelectedProjectId(parseInt(v))}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="اختر مشروعاً" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <>
            {/* Project Info */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
              <h2 className="font-bold text-stone-800 mb-3">{selectedProject.name}</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-500">مساحة البناء</p>
                  <p className="font-bold text-stone-800">{(selectedProject.bua || 0).toLocaleString()} قدم²</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-500">سعر القدم</p>
                  <p className="font-bold text-stone-800">{(selectedProject.pricePerSqft || 0).toLocaleString()} AED</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-500">تكلفة البناء</p>
                  <p className="font-bold text-stone-800">{buildingCost.toLocaleString()} AED</p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            {proposals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">الأقل تكلفة</span>
                  </div>
                  <p className="font-bold text-emerald-800">{cheapest?.consultant.name}</p>
                  <p className="text-lg font-bold text-emerald-600">{cheapest?.total.toLocaleString()} AED</p>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="w-5 h-5 text-stone-600" />
                    <span className="text-sm font-medium text-stone-700">المتوسط</span>
                  </div>
                  <p className="font-bold text-stone-800">جميع الاستشاريين</p>
                  <p className="text-lg font-bold text-stone-600">{Math.round(avgCost).toLocaleString()} AED</p>
                </div>
                <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-rose-600" />
                    <span className="text-sm font-medium text-rose-700">الأعلى تكلفة</span>
                  </div>
                  <p className="font-bold text-rose-800">{mostExpensive?.consultant.name}</p>
                  <p className="text-lg font-bold text-rose-600">{mostExpensive?.total.toLocaleString()} AED</p>
                </div>
              </div>
            )}

            {/* Proposals Table */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-stone-100">
                <h2 className="font-bold text-stone-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  تفاصيل العروض (مرتبة من الأقل للأعلى)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-stone-50 text-stone-600 text-sm">
                      <th className="p-3 text-right font-semibold">#</th>
                      <th className="p-3 text-right font-semibold">الاستشاري</th>
                      <th className="p-3 text-center font-semibold">التصميم</th>
                      <th className="p-3 text-center font-semibold">الإشراف</th>
                      <th className="p-3 text-center font-semibold">المجموع</th>
                      <th className="p-3 text-center font-semibold">% من تكلفة البناء</th>
                      <th className="p-3 text-center font-semibold">عرض السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((p, idx) => (
                      <tr key={p.consultant.id} className={`border-t border-stone-100 transition-colors hover:bg-stone-50 ${idx === 0 ? 'bg-emerald-50/30' : ''}`}>
                        <td className="p-3 text-right">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                            idx === 0 ? 'bg-emerald-100 text-emerald-700' :
                            idx === proposals.length - 1 ? 'bg-rose-100 text-rose-700' :
                            'bg-stone-100 text-stone-600'
                          }`}>{idx + 1}</span>
                        </td>
                        <td className="p-3 text-right font-semibold text-stone-800">{p.consultant.name}</td>
                        <td className="p-3 text-center">
                          <span className="text-sm text-stone-600">
                            {p.designType === 'pct' ? `${p.designValue}%` : 'مقطوع'}
                          </span>
                          <br />
                          <span className="font-semibold text-stone-800">{p.designAmount.toLocaleString()}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm text-stone-600">
                            {p.supervisionType === 'pct' ? `${p.supervisionValue}%` : 'مقطوع'}
                          </span>
                          <br />
                          <span className="font-semibold text-stone-800">{p.supervisionAmount.toLocaleString()}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-bold text-lg ${
                            idx === 0 ? 'text-emerald-700' :
                            idx === proposals.length - 1 ? 'text-rose-700' :
                            'text-stone-800'
                          }`}>{p.total.toLocaleString()}</span>
                          <span className="text-xs text-stone-500 block">AED</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-medium text-stone-600">
                            {buildingCost > 0 ? ((p.total / buildingCost) * 100).toFixed(2) : 0}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {p.proposalLink ? (
                            <a href={p.proposalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-sm font-medium">
                              <ExternalLink className="w-4 h-4" />
                              عرض
                            </a>
                          ) : (
                            <span className="text-stone-400 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {proposals.length === 0 && (
                <div className="p-10 text-center text-stone-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد عروض مالية لهذا المشروع بعد</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
