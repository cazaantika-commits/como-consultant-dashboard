import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, Trophy, Medal, Award, Loader2, Sparkles, Save } from "lucide-react";
import { Streamdown } from "streamdown";

const CRITERIA = [
  { id: 0, name: "الخبرة والسابقة", weight: 20 },
  { id: 4, name: "جودة المخططات", weight: 20 },
  { id: 1, name: "جودة الكادر الفني", weight: 20 },
  { id: 2, name: "سابقة الأعمال", weight: 15 },
  { id: 3, name: "الالتزام الزمني", weight: 15 },
  { id: 5, name: "السمعة والاستقرار", weight: 10 },
];

export default function ConsultantCommitteePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
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

  const saveMutation = trpc.committee.upsert.useMutation({
    onSuccess: () => {
      committeeQuery.refetch();
      toast.success("تم حفظ قرار اللجنة بنجاح");
    },
    onError: () => toast.error("حدث خطأ في الحفظ"),
  });

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

  const handleSave = () => {
    if (!selectedProjectId) return;
    saveMutation.mutate({
      projectId: selectedProjectId,
      selectedConsultantId: selectedConsultantId ? parseInt(selectedConsultantId) : undefined,
      decisionType,
      negotiationTarget,
      committeeNotes,
      aiAnalysis: aiAnalysis || undefined,
    });
  };

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
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shrink-0">
              <ClipboardCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">قرارات اللجنة</h1>
              <p className="text-stone-400 text-sm">القرارات النهائية مع تحليل ذكي لأسباب الاختيار</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Project Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
          <label className="text-sm font-medium text-stone-600 mb-2 block">اختر المشروع</label>
          <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => { setSelectedProjectId(parseInt(v)); setAiAnalysis(null); }}>
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

            {/* Committee Decision Form */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
              <h2 className="font-bold text-stone-800 mb-4">قرار اللجنة</h2>
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
                  <Button onClick={handleSave} className="bg-stone-800 hover:bg-stone-900 text-white gap-2">
                    <Save className="w-4 h-4" /> حفظ القرار
                  </Button>
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
