import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Download } from "lucide-react";

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

export default function ConsultantEvaluationPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

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

  // Calculate scores
  const consultantScores = useMemo(() => {
    if (!selectedProjectId || !evaluationQuery.data) return {};

    const scores: Record<number, { scores: number[]; total: number; weighted: number }> = {};

    const projectConsultants = projectDetailsQuery.data?.consultants || [];
    projectConsultants.forEach((consultant) => {
      const consultantEvals = evaluationQuery.data.filter(
        (e) => e.consultantId === consultant.id
      );

      const criteriaScores = CRITERIA.map((crit) => {
        const eval_ = consultantEvals.find((e) => e.criterionId === crit.id);
        return eval_?.score || 0;
      });

      const totalScore = criteriaScores.reduce((a, b) => a + b, 0) / CRITERIA.length;
      const weightedScore = CRITERIA.reduce((sum, crit, idx) => {
        return sum + (criteriaScores[idx] * crit.weight) / 100;
      }, 0);

      scores[consultant.id] = {
        scores: criteriaScores,
        total: totalScore,
        weighted: weightedScore,
      };
    });

    return scores;
  }, [selectedProjectId, evaluationQuery.data, projectDetailsQuery.data]);

  // Calculate financial totals
  const financialTotals = useMemo(() => {
    if (!financialQuery.data || !projectDetailsQuery.data) return {};

    const totals: Record<number, number> = {};
    const project = projectDetailsQuery.data;
    const buildingCost = (project.bua || 0) * (project.pricePerSqft || 0);

    financialQuery.data.forEach((fin) => {
      const designAmount =
        fin.designType === "pct"
          ? (fin.designValue || 0) * buildingCost / 100
          : fin.designValue || 0;
      const supervisionAmount =
        fin.supervisionType === "pct"
          ? (fin.supervisionValue || 0) * buildingCost / 100
          : fin.supervisionValue || 0;

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
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-lg mb-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-2">⭐ نظام التقييم الفني والمقارنة</h1>
          <p className="text-blue-100">تقييم شامل للاستشاريين مع المقارنة المالية</p>
        </div>

        {/* Project Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>اختر المشروع</CardTitle>
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
                <CardTitle>إدارة الاستشاريين للمشروع</CardTitle>
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
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
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
                <TabsTrigger value="evaluation">التقييم الفني</TabsTrigger>
                <TabsTrigger value="financial">الأتعاب المالية</TabsTrigger>
              </TabsList>

              {/* Evaluation Tab */}
              <TabsContent value="evaluation">
                <Card>
                  <CardHeader>
                    <CardTitle>نموذج التقييم الفني</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-blue-600 text-white">
                            <th className="border p-2 text-right">المعيار (الوزن)</th>
                            {projectConsultants.map((consultant) => (
                              <th key={consultant.id} className="border p-2 text-center">
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
                              {projectConsultants.map((consultant) => (
                                <td key={consultant.id} className="border p-2 text-center">
                                  <Select
                                    onValueChange={(value) => {
                                      updateEvaluationMutation.mutate({
                                        projectId: selectedProject.id,
                                        consultantId: consultant.id,
                                        criterionId: criterion.id,
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
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-blue-50 font-bold">
                            <td className="border p-2 text-right">المجموع المرجح</td>
                            {projectConsultants.map((consultant) => (
                              <td key={consultant.id} className="border p-2 text-center">
                                {consultantScores[consultant.id]?.weighted.toFixed(1) || 0} / 100
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financial">
                <Card>
                  <CardHeader>
                    <CardTitle>الأتعاب المالية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-blue-600 text-white">
                            <th className="border p-2 text-right">الاستشاري</th>
                            <th className="border p-2 text-center">نوع التصميم</th>
                            <th className="border p-2 text-center">قيمة التصميم</th>
                            <th className="border p-2 text-center">نوع الإشراف</th>
                            <th className="border p-2 text-center">قيمة الإشراف</th>
                            <th className="border p-2 text-center">المجموع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectConsultants.map((consultant) => {
                            const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
                            const designType = fin?.designType || 'pct';
                            const designValue = fin ? (designType === 'pct' ? (fin.designValue || 0) / 100 : fin.designValue || 0) : 0;
                            const supervisionType = fin?.supervisionType || 'pct';
                            const supervisionValue = fin ? (supervisionType === 'pct' ? (fin.supervisionValue || 0) / 100 : fin.supervisionValue || 0) : 0;
                            return (
                            <tr key={consultant.id} className="border-b">
                              <td className="border p-2 font-semibold">{consultant.name}</td>
                              <td className="border p-2 text-center">
                                <Select value={designType} onValueChange={(v: any) => {
                                  updateFinancialMutation.mutate({ projectId: selectedProjectId!, consultantId: consultant.id, designType: v, designValue: designType === 'pct' ? Math.round(designValue * 100) : designValue, supervisionType: supervisionType as any, supervisionValue: supervisionType === 'pct' ? Math.round(supervisionValue * 100) : supervisionValue });
                                }}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pct">نسبة %</SelectItem>
                                    <SelectItem value="lumpsum">مقطوع</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border p-2">
                                <Input type="number" value={designValue || ''} placeholder="0" className="w-full" onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateFinancialMutation.mutate({ projectId: selectedProjectId!, consultantId: consultant.id, designType: designType as any, designValue: designType === 'pct' ? Math.round(val * 100) : val, supervisionType: supervisionType as any, supervisionValue: supervisionType === 'pct' ? Math.round(supervisionValue * 100) : supervisionValue });
                                }} />
                              </td>
                              <td className="border p-2 text-center">
                                <Select value={supervisionType} onValueChange={(v: any) => {
                                  updateFinancialMutation.mutate({ projectId: selectedProjectId!, consultantId: consultant.id, designType: designType as any, designValue: designType === 'pct' ? Math.round(designValue * 100) : designValue, supervisionType: v, supervisionValue: supervisionType === 'pct' ? Math.round(supervisionValue * 100) : supervisionValue });
                                }}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pct">نسبة %</SelectItem>
                                    <SelectItem value="lumpsum">مقطوع</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border p-2">
                                <Input type="number" value={supervisionValue || ''} placeholder="0" className="w-full" onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateFinancialMutation.mutate({ projectId: selectedProjectId!, consultantId: consultant.id, designType: designType as any, designValue: designType === 'pct' ? Math.round(designValue * 100) : designValue, supervisionType: supervisionType as any, supervisionValue: supervisionType === 'pct' ? Math.round(val * 100) : val });
                                }} />
                              </td>
                              <td className="border p-2 text-center font-bold">
                                {financialTotals[consultant.id]?.toLocaleString() || 0} AED
                              </td>
                            </tr>
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
                <CardTitle>ملخص المقارنة والترتيب</CardTitle>
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
                              ? "border-blue-500 bg-blue-50"
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
