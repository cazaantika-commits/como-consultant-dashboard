import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Download, Star, BarChart3, DollarSign, Users, Award, ExternalLink, Link2 } from "lucide-react";

// FinancialRow component with local state - saves ONLY on blur
function FinancialRow({ consultant, fin, selectedProjectId, constructionCost, updateFinancialMutation, onTotalChange }: {
  consultant: any;
  fin: any;
  selectedProjectId: number;
  constructionCost: number;
  updateFinancialMutation: any;
  onTotalChange: (consultantId: number, total: number) => void;
}) {
  const [designType, setDesignType] = useState(fin?.designType || 'pct');
  const [designValue, setDesignValue] = useState(fin ? String(parseFloat(String(fin.designValue)) || 0) : '0');
  const [supervisionType, setSupervisionType] = useState(fin?.supervisionType || 'pct');
  const [supervisionValue, setSupervisionValue] = useState(fin ? String(parseFloat(String(fin.supervisionValue)) || 0) : '0');
  const [proposalLink, setProposalLink] = useState((fin as any)?.proposalLink || '');
  const editingRef = useRef(false); // prevents server sync while user is editing
  const initRef = useRef(fin?.id); // track which record we initialized from

  // Sync from server ONLY on initial load or when a different record loads
  useEffect(() => {
    if (fin && fin.id !== initRef.current) {
      initRef.current = fin.id;
      setDesignType(fin.designType || 'pct');
      setDesignValue(String(parseFloat(String(fin.designValue)) || 0));
      setSupervisionType(fin.supervisionType || 'pct');
      setSupervisionValue(String(parseFloat(String(fin.supervisionValue)) || 0));
      setProposalLink((fin as any)?.proposalLink || '');
    }
  }, [fin?.id]);

  // Calculate total
  const dv = parseFloat(designValue) || 0;
  const sv = parseFloat(supervisionValue) || 0;
  const designAmount = designType === 'pct' ? constructionCost * (dv / 100) : dv;
  const supervisionAmount = supervisionType === 'pct' ? constructionCost * (sv / 100) : sv;
  const total = designAmount + supervisionAmount;

  const totalRef = useRef(total);
  useEffect(() => {
    if (totalRef.current !== total) {
      totalRef.current = total;
      onTotalChange(consultant.id, total);
    }
  }, [total, consultant.id, onTotalChange]);

  const doSave = (overrides: any = {}) => {
    editingRef.current = false;
    const data = {
      projectId: selectedProjectId,
      consultantId: consultant.id,
      designType: overrides.designType ?? designType,
      designValue: overrides.designValue !== undefined ? overrides.designValue : (parseFloat(designValue) || 0),
      supervisionType: overrides.supervisionType ?? supervisionType,
      supervisionValue: overrides.supervisionValue !== undefined ? overrides.supervisionValue : (parseFloat(supervisionValue) || 0),
      proposalLink: overrides.proposalLink ?? proposalLink,
    };
    updateFinancialMutation.mutate(data);
  };

  return (
    <tr className="border-b hover:bg-stone-50/50 transition-colors">
      <td className="border p-2 font-semibold">{consultant.name}</td>
      <td className="border p-2 text-center">
        <Select value={designType} onValueChange={(v: any) => {
          setDesignType(v);
          doSave({ designType: v });
        }}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">نسبة %</SelectItem>
            <SelectItem value="lumpsum">مقطوع</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border p-2">
        <Input type="number" step="0.01" value={designValue} placeholder="0" className="w-full"
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => { editingRef.current = true; setDesignValue(e.target.value); }}
          onBlur={() => doSave({ designValue: parseFloat(designValue) || 0 })} />
      </td>
      <td className="border p-2 text-center">
        <Select value={supervisionType} onValueChange={(v: any) => {
          setSupervisionType(v);
          doSave({ supervisionType: v });
        }}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">نسبة %</SelectItem>
            <SelectItem value="lumpsum">مقطوع</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border p-2">
        <Input type="number" step="0.01" value={supervisionValue} placeholder="0" className="w-full"
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => { editingRef.current = true; setSupervisionValue(e.target.value); }}
          onBlur={() => doSave({ supervisionValue: parseFloat(supervisionValue) || 0 })} />
      </td>
      <td className="border p-2 text-center font-bold text-stone-700">
        {total.toLocaleString()} AED
      </td>
      <td className="border p-2 text-center">
        <div className="flex items-center gap-1">
          <Input type="url" value={proposalLink} placeholder="رابط عرض السعر" className="w-full text-sm"
            onFocus={() => { editingRef.current = true; }}
            onChange={(e) => { editingRef.current = true; setProposalLink(e.target.value); }}
            onBlur={() => doSave({ proposalLink })} />
          {proposalLink && (
            <a href={proposalLink} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// Evaluation criteria
const CRITERIA = [
  { id: 0, name: "الخبرة والسابقة", weight: 20 },
  { id: 1, name: "جودة الكادر الفني", weight: 20 },
  { id: 2, name: "سابقة الأعمال", weight: 15 },
  { id: 3, name: "الالتزام الزمني", weight: 15 },
  { id: 4, name: "جودة المخططات", weight: 20 },
  { id: 5, name: "السمعة والاستقرار", weight: 10 },
];

const SCORE_OPTIONS = [
  { value: 0, label: "ضعيف جداً" },
  { value: 25, label: "ضعيف" },
  { value: 50, label: "متوسط" },
  { value: 75, label: "جيد" },
  { value: 100, label: "ممتاز" },
];

const EVALUATORS = [
  { id: 'sheikh_issa', name: 'الشيخ عيسى' },
  { id: 'wael', name: 'وائل' },
  { id: 'abdulrahman', name: 'عبدالرحمن' },
];

export default function ConsultantEvaluationPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [activeEvaluator, setActiveEvaluator] = useState('sheikh_issa');

  // Queries
  const projectsQuery = trpc.projects.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const consultantsQuery = trpc.consultants.list.useQuery();
  const evaluationQuery = trpc.evaluation.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const financialQuery = trpc.financial.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const evaluatorScoresQuery = trpc.evaluatorScores.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const updateEvaluatorScoreMutation = trpc.evaluatorScores.upsert.useMutation({
    onSuccess: () => evaluatorScoresQuery.refetch(),
  });

  // Mutations
  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setNewProjectName("");
    },
  });

  const addConsultantMutation = trpc.projectConsultants.add.useMutation({
    onSuccess: () => {
      projectDetailsQuery.refetch();
    },
  });

  const updateEvaluationMutation = trpc.evaluation.upsert.useMutation({
    onSuccess: () => {
      evaluationQuery.refetch();
    },
  });

  const updateFinancialMutation = trpc.financial.upsert.useMutation({
    onSuccess: () => {
      financialQuery.refetch();
    },
  });

  // Calculate scores - now uses evaluator scores (3-evaluator system)
  const consultantScores = useMemo(() => {
    if (!selectedProjectId) return {};

    const scores: Record<number, { scores: number[]; total: number; weighted: number; evaluatorScores: Record<string, number[]> }> = {};

    const pConsultants = projectDetailsQuery.data?.consultants || [];
    const evalScores = evaluatorScoresQuery.data || [];
    const oldEvals = evaluationQuery.data || [];

    pConsultants.forEach((consultant) => {
      const evaluatorCriteriaScores: Record<string, number[]> = {};

      EVALUATORS.forEach((ev) => {
        evaluatorCriteriaScores[ev.id] = CRITERIA.map((crit) => {
          const s = evalScores.find(
            (es: any) => es.consultantId === consultant.id && es.criterionId === crit.id && es.evaluatorName === ev.id
          );
          return s?.score || 0;
        });
      });

      // Average across evaluators for each criterion
      const avgCriteriaScores = CRITERIA.map((crit, idx) => {
        const allScores = EVALUATORS.map((ev) => evaluatorCriteriaScores[ev.id][idx]).filter(s => s > 0);
        if (allScores.length === 0) {
          // Fallback to old single-evaluator scores
          const oldEval = oldEvals.find((e: any) => e.consultantId === consultant.id && e.criterionId === crit.id);
          return oldEval?.score || 0;
        }
        return allScores.reduce((a, b) => a + b, 0) / allScores.length;
      });

      const totalScore = avgCriteriaScores.reduce((a, b) => a + b, 0) / CRITERIA.length;
      const weightedScore = CRITERIA.reduce((sum, crit, idx) => {
        return sum + (avgCriteriaScores[idx] * crit.weight) / 100;
      }, 0);

      scores[consultant.id] = {
        scores: avgCriteriaScores,
        total: totalScore,
        weighted: weightedScore,
        evaluatorScores: evaluatorCriteriaScores,
      };
    });

    return scores;
  }, [selectedProjectId, evaluatorScoresQuery.data, evaluationQuery.data, projectDetailsQuery.data]);

  // Calculate financial totals
  // DB stores pct values directly (1.5 = 1.5%, 2 = 2%)
  const financialTotals = useMemo(() => {
    if (!financialQuery.data || !projectDetailsQuery.data) return {};

    const totals: Record<number, number> = {};
    const project = projectDetailsQuery.data;
    const buildingCost = (project.bua || 0) * (project.pricePerSqft || 0);

    financialQuery.data.forEach((fin: any) => {
      const dv = parseFloat(fin.designValue) || 0;
      const sv = parseFloat(fin.supervisionValue) || 0;
      const designAmount =
        fin.designType === "pct"
          ? (dv / 100) * buildingCost
          : dv;
      const supervisionAmount =
        fin.supervisionType === "pct"
          ? (sv / 100) * buildingCost
          : sv;

      totals[fin.consultantId] = designAmount + supervisionAmount;
    });

    return totals;
  }, [financialQuery.data, projectDetailsQuery.data]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p>يرجى تسجيل الدخول للمتابعة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-700 to-stone-900 text-white p-8 rounded-lg mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-10 h-10 text-yellow-300 fill-yellow-300" />
            <h1 className="text-4xl font-bold">نظام التقييم الفني والمقارنة</h1>
          </div>
          <p className="text-stone-300">تقييم شامل للاستشاريين مع المقارنة المالية</p>
        </div>

        {/* Project Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">📂 اختر المشروع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(value) => setSelectedProjectId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر مشروعاً" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedProject && (
          <>
            {/* Project Info */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{selectedProject.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">مساحة البناء</p>
                    <p className="text-lg font-bold">{selectedProject.bua || 0} قدم²</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">سعر القدم المربع</p>
                    <p className="text-lg font-bold">{selectedProject.pricePerSqft || 0} AED</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">إجمالي تكلفة البناء</p>
                    <p className="text-lg font-bold">
                      {((selectedProject.bua || 0) * (selectedProject.pricePerSqft || 0)).toLocaleString()} AED
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consultants Management */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-stone-600" /> إدارة الاستشاريين للمشروع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Select
                    onValueChange={(value) => {
                      const consultantId = parseInt(value);
                      if (!projectConsultants.find((c) => c.id === consultantId)) {
                        addConsultantMutation.mutate({
                          projectId: selectedProject.id,
                          consultantId,
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="أضف استشاري" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants
                        .filter((c) => !projectConsultants.find((pc) => pc.id === c.id))
                        .map((consultant) => (
                          <SelectItem key={consultant.id} value={consultant.id.toString()}>
                            {consultant.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {projectConsultants.map((consultant) => (
                    <div
                      key={consultant.id}
                      className="bg-stone-100 text-stone-800 px-3 py-1 rounded-full text-sm"
                    >
                      {consultant.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Evaluation & Financial Tabs */}
            <Tabs defaultValue="evaluation" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="evaluation" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> التقييم الفني</TabsTrigger>
                <TabsTrigger value="financial" className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> الأتعاب المالية</TabsTrigger>
              </TabsList>

              {/* Evaluation Tab - 3 Evaluators */}
              <TabsContent value="evaluation">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">📊 نموذج التقييم الفني (3 مقيّمين)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Evaluator Selector */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {EVALUATORS.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setActiveEvaluator(ev.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeEvaluator === ev.id
                              ? 'bg-stone-800 text-white shadow-md'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {ev.name}
                        </button>
                      ))}
                      <div className="mr-auto bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-xs font-medium">
                        المتوسط يُحسب تلقائياً من تقييمات الثلاثة
                      </div>
                    </div>

                    {/* Evaluation Table for Active Evaluator */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-stone-800 text-white">
                            <th className="border border-stone-600 p-2 text-right">المعيار (الوزن)</th>
                            {projectConsultants.map((consultant) => (
                              <th key={consultant.id} className="border border-stone-600 p-2 text-center">
                                {consultant.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {CRITERIA.map((criterion) => (
                            <tr key={criterion.id} className="border-b">
                              <td className="border p-2 bg-gray-50 font-semibold text-right">
                                {criterion.name}
                                <br />
                                <small className="text-gray-600">(وزن: {criterion.weight}%)</small>
                              </td>
                              {projectConsultants.map((consultant) => {
                                const currentScore = (evaluatorScoresQuery.data || []).find(
                                  (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === activeEvaluator
                                );
                                return (
                                  <td key={consultant.id} className="border p-2 text-center">
                                    <Select
                                      value={currentScore?.score?.toString() || ""}
                                      onValueChange={(value) => {
                                        updateEvaluatorScoreMutation.mutate({
                                          projectId: selectedProject.id,
                                          consultantId: consultant.id,
                                          criterionId: criterion.id,
                                          evaluatorName: activeEvaluator,
                                          score: parseInt(value),
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="اختر" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SCORE_OPTIONS.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value.toString()}
                                          >
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Average Results Table */}
                    <div className="mt-6">
                      <h3 className="font-bold text-stone-800 mb-3">المتوسط النهائي (من المقيّمين الثلاثة)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-amber-100">
                              <th className="border p-2 text-right font-semibold text-amber-800">المعيار</th>
                              {projectConsultants.map((consultant) => (
                                <th key={consultant.id} className="border p-2 text-center font-semibold text-amber-800">
                                  {consultant.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {CRITERIA.map((criterion, critIdx) => (
                              <tr key={criterion.id} className="border-b">
                                <td className="border p-2 bg-gray-50 font-semibold text-right text-sm">
                                  {criterion.name} ({criterion.weight}%)
                                </td>
                                {projectConsultants.map((consultant) => {
                                  const avgScore = consultantScores[consultant.id]?.scores[critIdx] || 0;
                                  return (
                                    <td key={consultant.id} className="border p-2 text-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-bold ${
                                        avgScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                                        avgScore >= 50 ? 'bg-amber-100 text-amber-700' :
                                        avgScore > 0 ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-400'
                                      }`}>
                                        {avgScore > 0 ? avgScore.toFixed(0) : '—'}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            <tr className="bg-stone-100 font-bold">
                              <td className="border p-2 text-right">المجموع المرجح</td>
                              {projectConsultants.map((consultant) => (
                                <td key={consultant.id} className="border p-2 text-center text-lg">
                                  {consultantScores[consultant.id]?.weighted.toFixed(1) || 0} / 100
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financial">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">💰 الأتعاب المالية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-stone-700 text-white">
                            <th className="border p-2 text-right">الاستشاري</th>
                            <th className="border p-2 text-center">نوع التصميم</th>
                            <th className="border p-2 text-center">قيمة التصميم</th>
                            <th className="border p-2 text-center">نوع الإشراف</th>
                            <th className="border p-2 text-center">قيمة الإشراف</th>
                            <th className="border p-2 text-center">المجموع</th>
                            <th className="border p-2 text-center">📎 رابط عرض السعر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectConsultants.map((consultant) => {
                            const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
                            const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);
                            return (
                              <FinancialRow
                                key={consultant.id}
                                consultant={consultant}
                                fin={fin}
                                selectedProjectId={selectedProjectId!}
                                constructionCost={buildingCost}
                                updateFinancialMutation={updateFinancialMutation}
                                onTotalChange={(cId, total) => {
                                  // totals are also calculated in useMemo, this is for live preview
                                }}
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Results Summary */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> ملخص المقارنة والترتيب</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectConsultants
                    .map((consultant) => ({
                      consultant,
                      score: consultantScores[consultant.id]?.weighted || 0,
                      cost: financialTotals[consultant.id] || 0,
                    }))
                    .sort((a, b) => b.score - a.score)
                    .map((item, index) => (
                      <div
                        key={item.consultant.id}
                        className={`p-4 rounded-lg border-2 ${
                          index === 0
                            ? "border-green-500 bg-green-50"
                            : index === 1
                              ? "border-amber-500 bg-amber-50"
                              : "border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-lg font-bold">
                              {index + 1}. {item.consultant.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              التقييم الفني: {item.score.toFixed(1)} / 100
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {item.cost.toLocaleString()} AED
                            </p>
                            <p className="text-sm text-gray-600">الأتعاب الإجمالية</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
