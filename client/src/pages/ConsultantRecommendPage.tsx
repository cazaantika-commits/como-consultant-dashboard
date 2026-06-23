import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";

const CRITERIA = [
  { id: 0, name: "الخبرة والسابقة", weight: 20 },
  { id: 4, name: "جودة المخططات", weight: 20 },
  { id: 1, name: "جودة الكادر الفني", weight: 20 },
  { id: 2, name: "سابقة الأعمال", weight: 15 },
  { id: 3, name: "الالتزام الزمني", weight: 15 },
  { id: 5, name: "السمعة والاستقرار", weight: 10 },
];

export default function ConsultantRecommendPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const projectsQuery = trpc.projects.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const financialQuery = trpc.financial.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const evaluatorScoresQuery = trpc.evaluatorScores.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const evaluationQuery = trpc.evaluation.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  const getRecommendation = trpc.committee.getRecommendation.useMutation({
    onSuccess: (data) => {
      const content = data.recommendation;
      setRecommendation(typeof content === 'string' ? content : '');
      setLoading(false);
    },
    onError: () => {
      setRecommendation("حدث خطأ في الحصول على التوصية. يرجى المحاولة لاحقاً.");
      setLoading(false);
    },
  });

  const projects = projectsQuery.data || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];
  const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);

  const getConsultantScore = (consultantId: number) => {
    // First try evaluator scores (3-evaluator system)
    const evalScores = evaluatorScoresQuery.data || [];
    const consultantEvalScores = evalScores.filter((s: any) => s.consultantId === consultantId);
    
    if (consultantEvalScores.length > 0) {
      let totalWeighted = 0;
      let totalWeight = 0;
      CRITERIA.forEach((criterion) => {
        const scores = consultantEvalScores.filter((s: any) => s.criterionId === criterion.id);
        if (scores.length > 0) {
          const avg = scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length;
          totalWeighted += avg * (criterion.weight / 100);
          totalWeight += criterion.weight;
        }
      });
      return totalWeight > 0 ? totalWeighted / (totalWeight / 100) : 0;
    }

    // Fallback to old evaluation scores
    const oldScores = evaluationQuery.data || [];
    const consultantOldScores = oldScores.filter((s: any) => s.consultantId === consultantId);
    if (consultantOldScores.length > 0) {
      let totalWeighted = 0;
      let totalWeight = 0;
      CRITERIA.forEach((criterion) => {
        const score = consultantOldScores.find((s: any) => s.criterionId === criterion.id);
        if (score) {
          totalWeighted += (score.score || 0) * (criterion.weight / 100);
          totalWeight += criterion.weight;
        }
      });
      return totalWeight > 0 ? totalWeighted / (totalWeight / 100) : 0;
    }
    return 0;
  };

  const getConsultantCost = (consultantId: number) => {
    const fin = (financialQuery.data || []).find((f: any) => f.consultantId === consultantId);
    if (!fin) return 0;
    const dv = parseFloat(fin.designValue as any) || 0;
    const sv = parseFloat(fin.supervisionValue as any) || 0;
    const designAmount = fin.designType === 'pct' ? buildingCost * (dv / 100) : dv;
    const supervisionAmount = fin.supervisionType === 'pct' ? buildingCost * (sv / 100) : sv;
    return designAmount + supervisionAmount;
  };

  const handleGetRecommendation = () => {
    if (!selectedProject) return;
    setLoading(true);
    setRecommendation(null);

    const consultantsData = projectConsultants.map((c: any) => ({
      name: c.name,
      score: getConsultantScore(c.id),
      cost: getConsultantCost(c.id),
    }));

    getRecommendation.mutate({
      projectName: selectedProject.name,
      projectBua: selectedProject.bua || 0,
      projectPricePerSqft: selectedProject.pricePerSqft || 0,
      consultants: consultantsData,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="relative max-w-4xl mx-auto px-6 py-10">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shrink-0">
              <Lightbulb className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">ماذا تقترح؟</h1>
              <p className="text-stone-400 text-sm">توصيات ذكية مبنية على بيانات التقييم والأتعاب حسب طبيعة المشروع</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Project Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
          <label className="text-sm font-medium text-stone-600 mb-2 block">اختر المشروع</label>
          <div className="flex gap-3 items-end">
            <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => { setSelectedProjectId(parseInt(v)); setRecommendation(null); }}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="اختر مشروعاً" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGetRecommendation}
              disabled={!selectedProjectId || loading}
              className="bg-gradient-to-l from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              احصل على التوصية
            </Button>
          </div>
        </div>

        {/* Consultants Summary */}
        {selectedProject && projectConsultants.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
            <h2 className="font-bold text-stone-800 mb-4">ملخص الاستشاريين — {selectedProject.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 text-sm">
                    <th className="p-3 text-right font-semibold">الاستشاري</th>
                    <th className="p-3 text-center font-semibold">التقييم</th>
                    <th className="p-3 text-center font-semibold">الأتعاب</th>
                    <th className="p-3 text-center font-semibold">% من تكلفة البناء</th>
                  </tr>
                </thead>
                <tbody>
                  {projectConsultants.map((c: any) => {
                    const score = getConsultantScore(c.id);
                    const cost = getConsultantCost(c.id);
                    return (
                      <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                        <td className="p-3 text-right font-semibold text-stone-800">{c.name}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-sm font-bold ${
                            score >= 75 ? 'bg-emerald-100 text-emerald-700' :
                            score >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {score.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold text-stone-800">{cost.toLocaleString()} AED</td>
                        <td className="p-3 text-center text-stone-600 text-sm">
                          {buildingCost > 0 ? ((cost / buildingCost) * 100).toFixed(2) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Recommendation */}
        {loading && (
          <div className="bg-white rounded-2xl border border-sky-200 p-8 text-center shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin text-sky-500 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">جاري تحليل البيانات وإعداد التوصية...</p>
            <p className="text-sm text-stone-400 mt-1">قد يستغرق هذا بضع ثوانٍ</p>
          </div>
        )}

        {recommendation && (
          <div className="bg-white rounded-2xl border border-sky-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-l from-sky-50 to-white p-5 border-b border-sky-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-stone-800">التوصية الذكية</h2>
                <p className="text-xs text-stone-500">مبنية على بيانات التقييم والأتعاب المالية</p>
              </div>
            </div>
            <div className="p-6 prose prose-sm max-w-none prose-stone">
              <Streamdown>{recommendation}</Streamdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
