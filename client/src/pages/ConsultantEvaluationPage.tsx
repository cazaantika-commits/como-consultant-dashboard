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

// Evaluation criteria - exact match from consultant-dashboard.html
const CRITERIA = [
  { id: 0, name: 'الهوية المعمارية وجودة التصميم', weight: 12.75, options: [
    { score: 10, label: '10 نقاط: مستوى معلم بارز — هوية أيقونية قوية، عامل تمييز في السوق، عمارة لا تُنسى' },
    { score: 8, label: '8 نقاط: جودة عالية — هوية مميزة، سرد تصميمي واضح، حضور سوقي فوق المتوسط' },
    { score: 6, label: '6 نقاط: جودة متوسطة — كفء لكن عام، لا يوجد تمييز قوي' },
    { score: 4, label: '4 نقاط: هوية ضعيفة — يفتقر للوضوح، جاذبية سوقية محدودة' },
    { score: 2, label: '2 نقاط: تصميم ضعيف — لا توجد هوية متماسكة، ضعيف بصرياً' },
  ]},
  { id: 1, name: 'القدرات التقنية والتكامل مع BIM', weight: 12.75, options: [
    { score: 10, label: '10 نقاط: ممارسة BIM متقدمة — سير عمل BIM كامل، تنسيق تصميم LOD 300-350، إدارة تضارب قوية، مخرجات رقمية منظمة' },
    { score: 8, label: '8 نقاط: ممارسة BIM جيدة — استخدام BIM بشكل متسق، تنسيق جيد' },
    { score: 6, label: '6 نقاط: استخدام BIM أساسي — BIM محدود في النمذجة فقط' },
    { score: 4, label: '4 نقاط: تكامل BIM ضئيل — تنسيق معتمد على 2D في الغالب' },
    { score: 2, label: '2 نقاط: لا توجد قدرة BIM' },
  ]},
  { id: 2, name: 'الأتعاب المهنية', weight: 12.75, options: [
    { score: 10, label: '10 نقاط: قيمة ممتازة — أتعاب تنافسية للغاية ومبررة' },
    { score: 8, label: '8 نقاط: تنافسية' },
    { score: 6, label: '6 نقاط: متوسط السوق' },
    { score: 4, label: '4 نقاط: أتعاب مرتفعة' },
    { score: 2, label: '2 نقاط: أتعاب مفرطة' },
  ]},
  { id: 3, name: 'كفاءة التخطيط وتحسين المساحات', weight: 11.9, options: [
    { score: 10, label: '10 نقاط: كفاءة استثنائية — منطق تخطيط ممتاز، استخدام أمثل للمساحة، الحد الأدنى من الفراغات الميتة، تخطيط خدمات قوي، وعي مالي واضح' },
    { score: 8, label: '8 نقاط: كفاءة قوية — تخطيط مساحات جيد جداً، عدم كفاءة طفيف لكن فهم تجاري قوي بشكل عام' },
    { score: 6, label: '6 نقاط: كفاءة مقبولة — تخطيط وظيفي لكن تقليدي، بعض المساحات المفقودة، حساسية مالية محدودة' },
    { score: 4, label: '4 نقاط: كفاءة ضعيفة — منطق حركة ضعيف، مساحات مهدرة ملحوظة، تخطيط خدمات ضعيف' },
    { score: 2, label: '2 نقاط: كفاءة ضعيفة جداً — تخطيط غير فعال، فقدان كبير في المساحة القابلة للاستخدام، تخطيط مضر مالياً' },
  ]},
  { id: 4, name: 'التحكم في التكاليف والوعي بالميزانية', weight: 9.35, options: [
    { score: 10, label: '10 نقاط: ذكاء تكلفة قوي — قرارات التصميم تعكس الوعي بالميزانية' },
    { score: 8, label: '8 نقاط: حساسية تكلفة جيدة' },
    { score: 6, label: '6 نقاط: محايد' },
    { score: 4, label: '4 نقاط: وعي تكلفة ضعيف' },
    { score: 2, label: '2 نقاط: مخاطر تصميم مكلفة' },
  ]},
  { id: 5, name: 'الخبرة في مشاريع مشابهة', weight: 8.5, options: [
    { score: 10, label: '10 نقاط: خبرة واسعة ذات صلة — مشاريع متعددة مكتملة بنفس الحجم والنوع' },
    { score: 8, label: '8 نقاط: خبرة قوية — محفظة جيدة ذات صلة مع تسليم مثبت' },
    { score: 6, label: '6 نقاط: خبرة متوسطة — بعض المشاريع ذات الصلة لكن ليست قابلة للمقارنة بالكامل' },
    { score: 4, label: '4 نقاط: خبرة محدودة — مراجع مشابهة قليلة' },
    { score: 2, label: '2 نقاط: لا توجد خبرة ذات صلة' },
  ]},
  { id: 6, name: 'قوة فريق المشروع', weight: 8.5, options: [
    { score: 10, label: '10 نقاط: فريق مخصص ذو خبرة عالية — قيادة عليا مشاركة مباشرة' },
    { score: 8, label: '8 نقاط: فريق قوي — خبرة جيدة مع دعم قادر' },
    { score: 6, label: '6 نقاط: فريق متوسط' },
    { score: 4, label: '4 نقاط: تكليف ضعيف' },
    { score: 2, label: '2 نقاط: فريق غير واضح أو عديم الخبرة' },
  ]},
  { id: 7, name: 'إدارة الوقت والتحكم في البرنامج', weight: 8.5, options: [
    { score: 10, label: '10 نقاط: سجل ممتاز — انضباط جدولة قوي، موافقات سريعة مثبتة' },
    { score: 8, label: '8 نقاط: تحكم جيد' },
    { score: 6, label: '6 نقاط: مقبول' },
    { score: 4, label: '4 نقاط: تأخيرات محتملة' },
    { score: 2, label: '2 نقاط: تحكم ضعيف' },
  ]},
  { id: 8, name: 'الاهتمام الخاص بالمشروع ومرونة التعامل', weight: 8, options: [
    { score: 10, label: '10 نقاط: المشروع أولوية قصوى لدى الاستشاري، اهتمام خاص جداً، متابعة مستمرة، ومرونة عالية في التعامل' },
    { score: 8, label: '8 نقاط: المشروع ذو أهمية خاصة، اهتمام واضح، وتواصل جيد ومرن' },
    { score: 6, label: '6 نقاط: المشروع يلقى اهتمام جيد، استجابة مقبولة وتعاون معقول' },
    { score: 4, label: '4 نقاط: المشروع أحد مشاريع الشركة العادية، اهتمام محدود دون تميّز' },
    { score: 2, label: '2 نقاط: المشروع ليس ذو أهمية لديهم، استجابة ضعيفة واهتمام منخفض' },
  ]},
  { id: 9, name: 'مرونة التعاقد', weight: 7, options: [
    { score: 10, label: '10 نقاط: لا أعمال إضافية غير مبررة، ومرونة ممتازة جداً في التعديلات ضمن نطاق العمل، مع شروط عادلة وواضحة' },
    { score: 8, label: '8 نقاط: مرونة ممتازة في التعديلات، مع بعض القيود المنطقية على الأعمال الإضافية' },
    { score: 6, label: '6 نقاط: مرونة متوسطة، يقبل التعديلات لكن بإجراءات رسمية وشروط عديدة' },
    { score: 4, label: '4 نقاط: رسمي في التعاقد، يميل لتقييد التعديلات ولا يبدي مرونة إلا في نطاق ضيق' },
    { score: 2, label: '2 نقاط: مبالغ في تكاليف التعديلات والأعمال الإضافية، ويربط معظم التغييرات بمطالبات مالية مرهقة للمشروع' },
  ]},
];

const EVALUATORS = [
  { id: 'sheikh_issa', name: 'الشيخ عيسى' },
  { id: 'wael', name: 'وائل' },
  { id: 'abdulrahman', name: 'عبدالرحمن' },
];

// BUA/Price fields with local state - saves on blur
function BuaPriceFields({ project, updateProjectMutation }: { project: any; updateProjectMutation: any }) {
  const [localBua, setLocalBua] = useState(String(project.bua || ''));
  const [localPrice, setLocalPrice] = useState(String(project.pricePerSqft || ''));
  const prevProjectId = useRef(project.id);

  // Sync when project changes
  useEffect(() => {
    if (project.id !== prevProjectId.current) {
      prevProjectId.current = project.id;
      setLocalBua(String(project.bua || ''));
      setLocalPrice(String(project.pricePerSqft || ''));
    }
  }, [project.id, project.bua, project.pricePerSqft]);

  const buaNum = parseFloat(localBua) || 0;
  const priceNum = parseFloat(localPrice) || 0;
  const total = buaNum * priceNum;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="text-sm text-gray-600 block mb-1">مساحة البناء (قدم²)</label>
        <Input
          type="number"
          value={localBua}
          onChange={(e) => setLocalBua(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localBua) || 0;
            updateProjectMutation.mutate({ id: project.id, bua: val });
          }}
          placeholder="مثلاً: 500000"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600 block mb-1">سعر القدم المربع (AED)</label>
        <Input
          type="number"
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localPrice) || 0;
            updateProjectMutation.mutate({ id: project.id, pricePerSqft: val });
          }}
          placeholder="مثلاً: 100"
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-1">إجمالي تكلفة البناء</p>
        <p className="text-lg font-bold text-stone-800">
          {total.toLocaleString()} AED
        </p>
      </div>
    </div>
  );
}

export default function ConsultantEvaluationPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newConsultantName, setNewConsultantName] = useState("");
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

  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      projectDetailsQuery.refetch();
    },
  });

  const addConsultantMutation = trpc.projectConsultants.add.useMutation({
    onSuccess: () => {
      projectDetailsQuery.refetch();
    },
  });

  const removeConsultantFromProjectMutation = trpc.projectConsultants.remove.useMutation({
    onSuccess: () => {
      projectDetailsQuery.refetch();
    },
  });

  const createConsultantMutation = trpc.consultants.create.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
      setNewConsultantName("");
    },
  });

  const deleteConsultantMutation = trpc.consultants.delete.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
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
                <BuaPriceFields
                  project={selectedProject}
                  updateProjectMutation={updateProjectMutation}
                />
              </CardContent>
            </Card>

            {/* Consultants Management */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-stone-600" /> إدارة الاستشاريين للمشروع</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add existing consultant to project */}
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
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="أضف استشاري للمشروع" />
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
                {/* Project consultants with remove button */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {projectConsultants.map((consultant) => (
                    <div
                      key={consultant.id}
                      className="bg-stone-100 text-stone-800 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    >
                      {consultant.name}
                      <button
                        onClick={() => {
                          if (confirm(`هل تريد إزالة ${consultant.name} من هذا المشروع؟`)) {
                            removeConsultantFromProjectMutation.mutate({
                              projectId: selectedProject.id,
                              consultantId: consultant.id,
                            });
                          }
                        }}
                        className="mr-1 text-red-400 hover:text-red-600 transition-colors"
                        title="إزالة من المشروع"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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

                    {/* Evaluation Table for Active Evaluator - Transposed: consultants as rows, criteria as columns */}
                    <div className="overflow-x-auto border rounded-lg" style={{ maxWidth: '100%' }}>
                      <table className="border-collapse w-full table-fixed">
                        <thead>
                          <tr className="bg-stone-800 text-white">
                            <th className="border border-stone-600 p-2 text-right sticky right-0 bg-stone-800 z-10" style={{ width: '120px', minWidth: '120px' }}>الاستشاري</th>
                            {CRITERIA.map((criterion) => (
                              <th key={criterion.id} className="border border-stone-600 p-1 text-center text-[10px] leading-tight" style={{ width: `${(100 - 12) / CRITERIA.length}%` }}>
                                <div className="truncate" title={criterion.name}>{criterion.name}</div>
                                <div className="text-stone-400 text-[9px]">({criterion.weight}%)</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {projectConsultants.map((consultant) => (
                            <tr key={consultant.id} className="border-b hover:bg-stone-50/50">
                              <td className="border p-2 bg-gray-50 font-semibold text-right text-sm sticky right-0 z-10" style={{ width: '120px', minWidth: '120px' }}>
                                {consultant.name}
                              </td>
                              {CRITERIA.map((criterion) => {
                                const currentScore = (evaluatorScoresQuery.data || []).find(
                                  (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === activeEvaluator
                                );
                                return (
                                  <td key={criterion.id} className="border p-1 text-center">
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
                                      <SelectTrigger className="w-full h-8 text-xs px-1">
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {criterion.options.map((option: { score: number; label: string }) => (
                                          <SelectItem
                                            key={option.score}
                                            value={option.score.toString()}
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

                    {/* Average Results Table - Transposed */}
                    <div className="mt-6">
                      <h3 className="font-bold text-stone-800 mb-3">المتوسط النهائي (من المقيّمين الثلاثة)</h3>
                      <div className="overflow-x-auto border rounded-lg" style={{ maxWidth: '100%' }}>
                        <table className="border-collapse w-full table-fixed">
                          <thead>
                            <tr className="bg-amber-100">
                              <th className="border p-2 text-right font-semibold text-amber-800 sticky right-0 bg-amber-100 z-10" style={{ width: '120px', minWidth: '120px' }}>الاستشاري</th>
                              {CRITERIA.map((criterion) => (
                                <th key={criterion.id} className="border p-1 text-center font-semibold text-amber-800 text-[10px] leading-tight" style={{ width: `${(100 - 12) / (CRITERIA.length + 1)}%` }}>
                                  <div className="truncate" title={criterion.name}>{criterion.name}</div>
                                  <div className="text-amber-600 text-[9px]">({criterion.weight}%)</div>
                                </th>
                              ))}
                              <th className="border p-1 text-center font-bold text-amber-900 text-xs" style={{ width: `${(100 - 12) / (CRITERIA.length + 1)}%` }}>المجموع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectConsultants.map((consultant) => (
                              <tr key={consultant.id} className="border-b hover:bg-amber-50/50">
                                <td className="border p-2 bg-gray-50 font-semibold text-right text-sm sticky right-0 z-10" style={{ width: '120px', minWidth: '120px' }}>
                                  {consultant.name}
                                </td>
                                {CRITERIA.map((criterion, critIdx) => {
                                  const avgScore = consultantScores[consultant.id]?.scores[critIdx] || 0;
                                  return (
                                    <td key={criterion.id} className="border p-1 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
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
                                <td className="border p-1 text-center font-bold text-lg">
                                  {consultantScores[consultant.id]?.weighted.toFixed(1) || 0}
                                </td>
                              </tr>
                            ))}
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
                      <table className="w-full border-collapse table-fixed">
                        <thead>
                          <tr className="bg-stone-700 text-white">
                            <th className="border p-2 text-right" style={{ width: '15%' }}>الاستشاري</th>
                            <th className="border p-2 text-center" style={{ width: '10%' }}>نوع التصميم</th>
                            <th className="border p-2 text-center" style={{ width: '15%' }}>قيمة التصميم</th>
                            <th className="border p-2 text-center" style={{ width: '10%' }}>نوع الإشراف</th>
                            <th className="border p-2 text-center" style={{ width: '15%' }}>قيمة الإشراف</th>
                            <th className="border p-2 text-center" style={{ width: '15%' }}>المجموع</th>
                            <th className="border p-2 text-center" style={{ width: '20%' }}>📎 رابط عرض السعر</th>
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
