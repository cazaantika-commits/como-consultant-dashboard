import { useProjectContext } from "@/contexts/ProjectContext";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as ClipboardCheck } from "lucide-react/dist/esm/icons/clipboard-check.js";
import { default as Trophy } from "lucide-react/dist/esm/icons/trophy.js";
import { default as Medal } from "lucide-react/dist/esm/icons/medal.js";
import { default as Award } from "lucide-react/dist/esm/icons/award.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { default as Gavel } from "lucide-react/dist/esm/icons/gavel.js";
import { Streamdown } from "streamdown";
import { resolveReturnPath } from "@/lib/returnNavigation";

const CRITERIA = [
  { id: 0, name: "الخبرة والسابقة", weight: 20 },
  { id: 4, name: "جودة المخططات", weight: 20 },
  { id: 1, name: "جودة الكادر الفني", weight: 20 },
  { id: 2, name: "سابقة الأعمال", weight: 15 },
  { id: 3, name: "الالتزام الزمني", weight: 15 },
  { id: 5, name: "السمعة والاستقرار", weight: 10 },
];

export default function ConsultantCommitteePage() {
  const [location] = useLocation();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const [decisionType, setDecisionType] = useState<string>("");
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const [negotiationTarget, setNegotiationTarget] = useState("");
  const [committeeNotes, setCommitteeNotes] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const projectsQuery = trpc.projects.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const financialQuery = trpc.financial.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const evaluatorScoresQuery = trpc.evaluatorScores.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const evaluationQuery = trpc.evaluation.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const committeeQuery = trpc.committee.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  const analyzeMutation = trpc.committee.analyzeDecision.useMutation({
    onSuccess: (data) => {
      const content = data.analysis;
      const text = typeof content === 'string' ? content : '';
      setAiAnalysis(text);
      setAnalyzing(false);
    },
    onError: () => {
      setAiAnalysis("حدث خطأ في التحليل.");
      setAnalyzing(false);
    },
  });

  const projects = projectsQuery.data || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];
  const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);

  // Load saved decision
  const savedDecision = committeeQuery.data;
  useState(() => {
    if (savedDecision) {
      setDecisionType(savedDecision.decisionType || "");
      setSelectedConsultantId(savedDecision.selectedConsultantId?.toString() || "");
      setNegotiationTarget(savedDecision.negotiationTarget || "");
      setCommitteeNotes(savedDecision.committeeNotes || "");
      if (savedDecision.aiAnalysis) setAiAnalysis(savedDecision.aiAnalysis);
    }
  });

  const getConsultantScore = (consultantId: number) => {
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

  const rankings = useMemo(() => {
    return projectConsultants
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        score: getConsultantScore(c.id),
        cost: getConsultantCost(c.id),
      }))
      .sort((a, b) => b.score - a.score)
      .map((c, idx) => ({ ...c, rank: idx + 1 }));
  }, [projectConsultants, evaluatorScoresQuery.data, evaluationQuery.data, financialQuery.data]);

  const top3 = rankings.slice(0, 3);

  const handleAnalyze = () => {
    if (!selectedProject || !selectedConsultantId) {
      toast.error("يرجى اختيار الاستشاري أولاً");
      return;
    }
    setAnalyzing(true);
    setAiAnalysis(null);
    const selectedName = projectConsultants.find((c: any) => c.id === parseInt(selectedConsultantId))?.name || "";
    analyzeMutation.mutate({
      projectName: selectedProject.name,
      selectedConsultantName: selectedName,
      decisionType,
      rankings: rankings.map(r => ({ name: r.name, rank: r.rank, score: r.score, cost: r.cost })),
      negotiationTarget,
    });
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-stone-50" dir="rtl">
      {/* Header */}
      <div className="w-full border-b border-stone-200 bg-white">
        <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-8 sm:px-6">
          <Link href={resolveReturnPath(location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search, "/consultant-portal")} className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-stone-900">مرجع قرار اللجنة</h1>
              <p className="text-stone-500 text-sm">مقارنة وتحليل فقط؛ القرار النهائي الرسمي داخل مركز القيادة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-violet-950">القرار الرسمي في مركز القيادة</h2>
              <p className="mt-1 text-sm text-violet-800">تبقى هذه الصفحة مرجعًا للمقارنة والتحليل. التسجيل والتأكيد الرسميان لا يتمان إلا من واجهة التقييم داخل مركز القيادة.</p>
            </div>
            <Link href="/command-center" className="inline-flex w-fit items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-800">
              <Gavel className="w-4 h-4" />
              فتح القرار الرسمي في مركز القيادة
            </Link>
          </div>
        </div>
        {/* Project Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
          <label className="text-sm font-medium text-stone-600 mb-2 block">اختر المشروع</label>
          <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => { setSelectedProjectId(parseInt(v)); setAiAnalysis(null); }}>
            <SelectTrigger className="w-full max-w-md">
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
            {/* Rankings - Top 3 */}
            {top3.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
                <h2 className="font-bold text-stone-800 mb-4">نتائج التقييم — أفضل ثلاثة استشاريين</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {top3.map((c, idx) => {
                    const icons = [
                      <Trophy className="w-6 h-6 text-amber-500" />,
                      <Medal className="w-6 h-6 text-stone-400" />,
                      <Award className="w-6 h-6 text-amber-700" />,
                    ];
                    const bgColors = ['bg-amber-50 border-amber-200', 'bg-stone-50 border-stone-200', 'bg-orange-50 border-orange-200'];
                    const labels = ['المركز الأول 🥇', 'المركز الثاني 🥈', 'المركز الثالث 🥉'];
                    return (
                      <div key={c.id} className={`rounded-xl border p-4 ${bgColors[idx]}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {icons[idx]}
                          <span className="text-sm font-medium text-stone-600">{labels[idx]}</span>
                        </div>
                        <p className="font-bold text-stone-800 text-lg">{c.name}</p>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <p className="text-xs text-stone-500">التقييم</p>
                            <p className="font-bold text-stone-700">{c.score.toFixed(1)}/100</p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">الأتعاب</p>
                            <p className="font-bold text-stone-700">{c.cost.toLocaleString()} AED</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Full Rankings Table */}
                {rankings.length > 3 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50 text-stone-600">
                          <th className="p-2 text-right font-semibold">الترتيب</th>
                          <th className="p-2 text-right font-semibold">الاستشاري</th>
                          <th className="p-2 text-center font-semibold">التقييم</th>
                          <th className="p-2 text-center font-semibold">الأتعاب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.slice(3).map((c) => (
                          <tr key={c.id} className="border-t border-stone-100">
                            <td className="p-2 text-right">{c.rank}</td>
                            <td className="p-2 text-right font-medium">{c.name}</td>
                            <td className="p-2 text-center">{c.score.toFixed(1)}</td>
                            <td className="p-2 text-center">{c.cost.toLocaleString()} AED</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Read-only decision analysis */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
              <h2 className="font-bold text-stone-800 mb-1">محاكاة تحليلية للقرار</h2>
              <p className="mb-4 text-sm text-stone-500">لا تحفظ هذه المحاكاة قرارًا. استخدم مركز القيادة لتسجيل أو تأكيد القرار الرسمي.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-stone-600 mb-1 block">نوع القرار</label>
                    <Select value={decisionType} onValueChange={setDecisionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع القرار" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selected">اختيار استشاري</SelectItem>
                        <SelectItem value="negotiate">التفاوض مع استشاري</SelectItem>
                        <SelectItem value="pending">قيد الدراسة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-stone-600 mb-1 block">الاستشاري المختار</label>
                    <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الاستشاري" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectConsultants.map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {decisionType === 'negotiate' && (
                  <div>
                    <label className="text-sm font-medium text-stone-600 mb-1 block">التارجت / أهداف التفاوض</label>
                    <Input
                      value={negotiationTarget}
                      onChange={(e) => setNegotiationTarget(e.target.value)}
                      placeholder="مثال: تخفيض الأتعاب بنسبة 10% أو تعديل شروط الدفع"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">ملاحظات اللجنة</label>
                  <Textarea
                    value={committeeNotes}
                    onChange={(e) => setCommitteeNotes(e.target.value)}
                    placeholder="ملاحظات إضافية من اللجنة..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing || !selectedConsultantId}
                    variant="outline"
                    className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    تحليل ذكي للقرار
                  </Button>
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            {analyzing && (
              <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
                <Loader2 className="w-10 h-10 animate-spin text-rose-500 mx-auto mb-3" />
                <p className="text-stone-600 font-medium">جاري تحليل قرار اللجنة...</p>
              </div>
            )}

            {aiAnalysis && !analyzing && (
              <div className="bg-white rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-l from-rose-50 to-white p-5 border-b border-rose-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-stone-800">التحليل الذكي</h2>
                    <p className="text-xs text-stone-500">تحليل أسباب اختيار اللجنة</p>
                  </div>
                </div>
                <div className="p-6 prose prose-sm max-w-none prose-stone">
                  <Streamdown>{aiAnalysis}</Streamdown>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
