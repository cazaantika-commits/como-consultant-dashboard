import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Download, Star, BarChart3, DollarSign, Users, Award, ExternalLink, Link2, TrendingUp, Target, CheckCircle2, Building, FileDown } from "lucide-react";
import { generateEvaluationPDF } from "@/lib/pdfExport";

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
    <tr className="border-b hover:bg-gradient-to-l hover:from-blue-50/30 hover:to-transparent transition-all duration-200">
      <td className="border border-slate-200 p-3 font-semibold text-sm whitespace-normal leading-tight bg-gradient-to-l from-slate-50 to-white">
        {consultant.name}
      </td>
      <td className="border border-slate-200 p-2 text-center">
        <Select value={designType} onValueChange={(v: any) => {
          setDesignType(v);
          doSave({ designType: v });
        }}>
          <SelectTrigger className="w-full bg-white border-slate-300"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">نسبة %</SelectItem>
            <SelectItem value="lumpsum">مقطوع</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border border-slate-200 p-2">
        <Input type="number" step="0.01" value={designValue} placeholder="0" className="w-full bg-white border-slate-300"
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => { editingRef.current = true; setDesignValue(e.target.value); }}
          onBlur={() => doSave({ designValue: parseFloat(designValue) || 0 })} />
      </td>
      <td className="border border-slate-200 p-2 text-center">
        <Select value={supervisionType} onValueChange={(v: any) => {
          setSupervisionType(v);
          doSave({ supervisionType: v });
        }}>
          <SelectTrigger className="w-full bg-white border-slate-300"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">نسبة %</SelectItem>
            <SelectItem value="lumpsum">مقطوع</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border border-slate-200 p-2">
        <Input type="number" step="0.01" value={supervisionValue} placeholder="0" className="w-full bg-white border-slate-300"
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => { editingRef.current = true; setSupervisionValue(e.target.value); }}
          onBlur={() => doSave({ supervisionValue: parseFloat(supervisionValue) || 0 })} />
      </td>
      <td className="border border-slate-200 p-3 text-center font-bold text-lg bg-gradient-to-r from-emerald-50 to-transparent">
        <span className="text-emerald-700">{total.toLocaleString()}</span>
        <span className="text-xs text-slate-500 block">AED</span>
      </td>
      <td className="border border-slate-200 p-2">
        <div className="flex gap-1">
          <Input
            type="url"
            value={proposalLink}
            onChange={(e) => { editingRef.current = true; setProposalLink(e.target.value); }}
            onBlur={() => doSave({ proposalLink })}
            placeholder="https://..."
            className="flex-1 text-xs bg-white border-slate-300"
          />
          {proposalLink && (
            <a
              href={proposalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
              title="فتح العرض"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ORIGINAL Evaluation criteria - DO NOT CHANGE
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-200">
        <label className="text-sm font-semibold text-blue-900 block mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          مساحة البناء (قدم²)
        </label>
        <Input
          type="number"
          value={localBua}
          onChange={(e) => setLocalBua(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localBua) || 0;
            updateProjectMutation.mutate({ id: project.id, bua: val });
          }}
          placeholder="مثلاً: 500000"
          className="text-lg font-bold bg-white border-blue-300"
        />
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-200">
        <label className="text-sm font-semibold text-purple-900 block mb-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          سعر القدم المربع (AED)
        </label>
        <Input
          type="number"
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localPrice) || 0;
            updateProjectMutation.mutate({ id: project.id, pricePerSqft: val });
          }}
          placeholder="مثلاً: 100"
          className="text-lg font-bold bg-white border-purple-300"
        />
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-200">
        <p className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          إجمالي تكلفة البناء
        </p>
        <p className="text-2xl font-bold text-emerald-700">
          {total.toLocaleString()}
        </p>
        <p className="text-xs text-emerald-600 mt-1">AED</p>
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
    const allScores = evaluatorScoresQuery.data || [];

    pConsultants.forEach((consultant: any) => {
      const evaluatorScores: Record<string, number[]> = {};
      
      // For each evaluator, collect their scores for this consultant
      EVALUATORS.forEach((ev) => {
        const evScores = CRITERIA.map((criterion) => {
          const scoreRecord = allScores.find(
            (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === ev.id
          );
          return scoreRecord?.score || 0;
        });
        evaluatorScores[ev.id] = evScores;
      });

      // Calculate average scores across all 3 evaluators for each criterion
      const avgScores = CRITERIA.map((criterion, idx) => {
        const sum = EVALUATORS.reduce((acc, ev) => acc + (evaluatorScores[ev.id][idx] || 0), 0);
        return sum / EVALUATORS.length;
      });

      // Calculate weighted total
      const weightedTotal = CRITERIA.reduce((acc, criterion, idx) => {
        return acc + (avgScores[idx] * criterion.weight / 100);
      }, 0);

      scores[consultant.id] = {
        scores: avgScores,
        total: avgScores.reduce((a, b) => a + b, 0),
        weighted: weightedTotal,
        evaluatorScores,
      };
    });

    return scores;
  }, [selectedProjectId, projectDetailsQuery.data, evaluatorScoresQuery.data]);

  // Calculate financial totals
  const financialTotals = useMemo(() => {
    if (!selectedProjectId) return {};
    const totals: Record<number, number> = {};
    const pConsultants = projectDetailsQuery.data?.consultants || [];
    const buildingCost = (projectDetailsQuery.data?.bua || 0) * (projectDetailsQuery.data?.pricePerSqft || 0);

    pConsultants.forEach((consultant: any) => {
      const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
      if (fin) {
        const dv = parseFloat(String(fin.designValue)) || 0;
        const sv = parseFloat(String(fin.supervisionValue)) || 0;
        const designAmount = fin.designType === 'pct' ? buildingCost * (dv / 100) : dv;
        const supervisionAmount = fin.supervisionType === 'pct' ? buildingCost * (sv / 100) : sv;
        totals[consultant.id] = designAmount + supervisionAmount;
      }
    });

    return totals;
  }, [selectedProjectId, projectDetailsQuery.data, financialQuery.data]);

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];

  // PDF Export handler
  const handleExportPDF = (type: 'technical' | 'financial' | 'full') => {
    if (!selectedProject || projectConsultants.length === 0) return;

    const buildingCost = (projectDetailsQuery.data?.bua || 0) * (projectDetailsQuery.data?.pricePerSqft || 0);

    const pdfConsultants = projectConsultants.map((c: any) => ({
      name: c.name,
      scores: consultantScores[c.id]?.scores || CRITERIA.map(() => 0),
      weightedTotal: consultantScores[c.id]?.weighted || 0,
    }));

    const pdfFinancials = projectConsultants.map((c: any) => {
      const fin = financialQuery.data?.find((f: any) => f.consultantId === c.id);
      const dv = fin ? parseFloat(String(fin.designValue)) || 0 : 0;
      const sv = fin ? parseFloat(String(fin.supervisionValue)) || 0 : 0;
      const dt = fin?.designType || 'pct';
      const st = fin?.supervisionType || 'pct';
      const designAmount = dt === 'pct' ? buildingCost * (dv / 100) : dv;
      const supervisionAmount = st === 'pct' ? buildingCost * (sv / 100) : sv;
      return {
        consultantName: c.name,
        designValue: String(dv),
        designType: dt,
        designAmount,
        supervisionValue: String(sv),
        supervisionType: st,
        supervisionAmount,
        total: designAmount + supervisionAmount,
      };
    });

    generateEvaluationPDF({
      projectName: selectedProject.name,
      bua: projectDetailsQuery.data?.bua || 0,
      pricePerSqft: projectDetailsQuery.data?.pricePerSqft || 0,
      constructionCost: buildingCost,
      consultants: pdfConsultants,
      criteria: CRITERIA.map(c => ({ name: c.name, weight: c.weight })),
      evaluators: EVALUATORS.map(e => ({ name: e.name })),
      financials: pdfFinancials,
    }, type);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="w-96 shadow-2xl border-0">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">جارٍ التحميل...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
          <div className="relative px-8 py-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">تقييم الاستشاريين</h1>
                <p className="text-blue-100 text-lg">نظام تقييم شامل للاستشاريين - فني ومالي</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-6">
              <div className="flex gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>3 مقيّمين مستقلين</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>10 معايير تقييم</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>مقارنة مالية شاملة</span>
                </div>
              </div>
              {selectedProjectId && projectConsultants.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl gap-2 backdrop-blur-sm"
                    onClick={() => handleExportPDF('technical')}
                  >
                    <FileDown className="w-4 h-4" />
                    تصدير التقييم الفني PDF
                  </Button>
                  <Button
                    variant="ghost"
                    className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl gap-2 backdrop-blur-sm"
                    onClick={() => handleExportPDF('financial')}
                  >
                    <FileDown className="w-4 h-4" />
                    تصدير الأتعاب PDF
                  </Button>
                  <Button
                    variant="ghost"
                    className="bg-emerald-500/80 hover:bg-emerald-500 text-white border border-emerald-400/30 rounded-xl gap-2 backdrop-blur-sm font-bold"
                    onClick={() => handleExportPDF('full')}
                  >
                    <FileDown className="w-4 h-4" />
                    تقرير شامل PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Building className="w-5 h-5 text-blue-600" />
              اختر المشروع
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-3">
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(value) => setSelectedProjectId(parseInt(value))}
              >
                <SelectTrigger className="flex-1 h-12 bg-white border-slate-300 text-lg">
                  <SelectValue placeholder="اختر مشروعاً للتقييم" />
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
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                <CardTitle className="text-2xl text-slate-800">{selectedProject.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <BuaPriceFields
                  project={selectedProject}
                  updateProjectMutation={updateProjectMutation}
                />
              </CardContent>
            </Card>

            {/* Consultants Management */}
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Users className="w-5 h-5 text-purple-600" />
                  إدارة الاستشاريين للمشروع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
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
                    <SelectTrigger className="flex-1 bg-white border-slate-300">
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
                <div className="flex flex-wrap gap-3 mb-6">
                  {projectConsultants.map((consultant) => (
                    <div
                      key={consultant.id}
                      className="bg-gradient-to-r from-blue-100 to-purple-100 text-slate-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm"
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
                        className="mr-1 text-red-500 hover:text-red-700 transition-colors"
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
              <TabsList className="grid w-full grid-cols-2 mb-6 h-14 bg-white shadow-lg rounded-xl border-0">
                <TabsTrigger 
                  value="evaluation" 
                  className="flex items-center gap-2 text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg"
                >
                  <BarChart3 className="w-5 h-5" />
                  التقييم الفني
                </TabsTrigger>
                <TabsTrigger 
                  value="financial" 
                  className="flex items-center gap-2 text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg"
                >
                  <DollarSign className="w-5 h-5" />
                  الأتعاب المالية
                </TabsTrigger>
              </TabsList>

              {/* Evaluation Tab - 3 Evaluators */}
              <TabsContent value="evaluation">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-slate-800 text-xl">
                      <Star className="w-6 h-6 text-amber-500" />
                      نموذج التقييم الفني (3 مقيّمين)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Evaluator Selector */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                      {EVALUATORS.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setActiveEvaluator(ev.id)}
                          className={`px-6 py-3 rounded-xl text-base font-bold transition-all shadow-md ${
                            activeEvaluator === ev.id
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-105'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {ev.name}
                        </button>
                      ))}
                      <div className="mr-auto bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 px-4 py-3 rounded-xl text-sm font-semibold border border-amber-200">
                        المتوسط يُحسب تلقائياً من تقييمات الثلاثة
                      </div>
                    </div>

                    {/* Evaluation Table for Active Evaluator */}
                    {projectConsultants.length > 2 && (
                      <p className="text-xs text-slate-500 mb-2 font-medium">← اسحب لليسار لرؤية باقي الاستشاريين</p>
                    )}
                    <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg" style={{ maxWidth: '100%' }}>
                      <table className="border-collapse w-max">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white">
                            <th className="border border-slate-600 p-4 text-right sticky right-0 bg-slate-800 z-10 font-bold" style={{ minWidth: '160px', maxWidth: '190px' }}>
                              المعيار (الوزن)
                            </th>
                            {projectConsultants.map((consultant) => (
                              <th key={consultant.id} className="border border-slate-600 p-4 text-center font-bold" style={{ minWidth: '180px', maxWidth: '240px' }}>
                                <span className="whitespace-normal leading-tight text-base">{consultant.name}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {CRITERIA.map((criterion) => (
                            <tr key={criterion.id} className="border-b hover:bg-blue-50/50 transition-colors" style={{ minHeight: '80px' }}>
                              <td className="border border-slate-200 p-4 py-5 bg-gradient-to-l from-slate-50 to-white font-bold text-right sticky right-0 z-10 whitespace-normal leading-relaxed" style={{ minWidth: '160px', maxWidth: '190px' }}>
                                {criterion.name}
                                <br />
                                <small className="text-slate-600 font-semibold">(وزن: {criterion.weight}%)</small>
                              </td>
                              {projectConsultants.map((consultant) => {
                                const currentScore = (evaluatorScoresQuery.data || []).find(
                                  (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === activeEvaluator
                                );
                                return (
                                  <td key={consultant.id} className="border border-slate-200 p-3 py-4 text-center overflow-visible" style={{ minWidth: '180px', maxWidth: '240px' }}>
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
                                      <SelectTrigger className="w-full text-sm h-auto min-h-[3.5rem] py-3 whitespace-normal leading-relaxed text-right cursor-pointer bg-white border-slate-300 font-medium">
                                        <SelectValue placeholder="اختر التقييم" />
                                      </SelectTrigger>
                                      <SelectContent className="w-[500px] max-w-[90vw]">
                                        {criterion.options.map((option: { score: number; label: string }) => {
                                          const parts = option.label.match(/^(\d+\s*\u0646\u0642\u0627\u0637):\s*(.*)$/);
                                          return (
                                            <SelectItem
                                              key={option.score}
                                              value={option.score.toString()}
                                              className="whitespace-normal text-sm leading-relaxed py-3"
                                            >
                                              {parts ? (
                                                <span><span className="font-bold whitespace-nowrap text-blue-700">{parts[1]}:</span> {parts[2]}</span>
                                              ) : option.label}
                                            </SelectItem>
                                          );
                                        })}
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
                    <div className="mt-8">
                      <h3 className="font-bold text-slate-800 mb-4 text-xl flex items-center gap-2">
                        <Award className="w-6 h-6 text-amber-500" />
                        المتوسط النهائي (من المقيّمين الثلاثة)
                      </h3>
                      <div className="overflow-x-auto border-2 border-amber-200 rounded-2xl shadow-lg" style={{ maxWidth: '100%' }}>
                        <table className="border-collapse w-max">
                          <thead>
                            <tr className="bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50">
                              <th className="border border-amber-200 p-4 text-right font-bold text-amber-900 sticky right-0 bg-amber-100 z-10" style={{ minWidth: '180px', maxWidth: '220px' }}>
                                المعيار
                              </th>
                              {projectConsultants.map((consultant) => (
                                <th key={consultant.id} className="border border-amber-200 p-4 text-center font-bold text-amber-900" style={{ minWidth: '220px', maxWidth: '300px' }}>
                                  <span className="whitespace-normal leading-tight text-base">{consultant.name}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {CRITERIA.map((criterion, critIdx) => (
                              <tr key={criterion.id} className="border-b hover:bg-amber-50/30 transition-colors">
                                <td className="border border-amber-200 p-3 bg-gradient-to-l from-amber-50 to-white font-bold text-right text-sm sticky right-0 z-10" style={{ minWidth: '200px' }}>
                                  {criterion.name} ({criterion.weight}%)
                                </td>
                                {projectConsultants.map((consultant) => {
                                  const avgScore = consultantScores[consultant.id]?.scores[critIdx] || 0;
                                  return (
                                    <td key={consultant.id} className="border border-amber-200 p-3 text-center">
                                      <span className={`inline-flex items-center px-4 py-2 rounded-xl text-base font-bold shadow-sm ${
                                        avgScore >= 75 ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800' :
                                        avgScore >= 50 ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800' :
                                        avgScore > 0 ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800' :
                                        'bg-gray-100 text-gray-400'
                                      }`}>
                                        {avgScore > 0 ? avgScore.toFixed(0) : '—'}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            <tr className="bg-gradient-to-r from-slate-100 to-slate-200 font-bold">
                              <td className="border border-amber-200 p-4 text-right sticky right-0 bg-slate-200 z-10 text-lg">
                                المجموع المرجح
                              </td>
                              {projectConsultants.map((consultant) => (
                                <td key={consultant.id} className="border border-amber-200 p-4 text-center text-xl font-bold text-slate-800">
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
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-slate-800 text-xl">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                      الأتعاب المالية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg">
                      <table className="border-collapse w-max min-w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
                            <th className="border border-emerald-700 p-4 text-right text-base font-bold whitespace-normal leading-tight" style={{ width: '14%' }}>
                              الاستشاري
                            </th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold whitespace-normal leading-tight" style={{ width: '9%' }}>
                              نوع<br/>التصميم
                            </th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold whitespace-normal leading-tight" style={{ width: '13%' }}>
                              قيمة<br/>التصميم
                            </th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold whitespace-normal leading-tight" style={{ width: '9%' }}>
                              نوع<br/>الإشراف
                            </th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold whitespace-normal leading-tight" style={{ width: '13%' }}>
                              قيمة<br/>الإشراف
                            </th>
                            <th className="border border-emerald-700 p-4 text-center text-base font-bold whitespace-normal leading-tight" style={{ width: '14%' }}>
                              المجموع
                            </th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold whitespace-normal leading-tight" style={{ width: '18%' }}>
                              📎 رابط<br/>عرض السعر
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {[...projectConsultants]
                            .sort((a, b) => (financialTotals[a.id] || 0) - (financialTotals[b.id] || 0))
                            .map((consultant) => {
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
            <Card className="mt-8 shadow-2xl border-0">
              <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-b">
                <CardTitle className="flex items-center gap-2 text-slate-800 text-xl">
                  <Award className="w-6 h-6 text-amber-600" />
                  ملخص المقارنة والترتيب النهائي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
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
                        className={`p-6 rounded-2xl border-2 shadow-lg transition-all hover:scale-[1.02] ${
                          index === 0
                            ? "border-emerald-400 bg-gradient-to-r from-emerald-50 to-green-50"
                            : index === 1
                              ? "border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50"
                              : "border-slate-300 bg-gradient-to-r from-slate-50 to-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold shadow-md ${
                              index === 0 ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' :
                              index === 1 ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white' :
                              'bg-gradient-to-br from-slate-400 to-gray-500 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-xl font-bold text-slate-800">
                                {item.consultant.name}
                              </p>
                              <p className="text-base text-slate-600 font-medium mt-1">
                                التقييم الفني: <span className="font-bold text-blue-700">{item.score.toFixed(1)} / 100</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-700">
                              {item.cost.toLocaleString()}
                            </p>
                            <p className="text-sm text-slate-600 font-medium">AED - الأتعاب الإجمالية</p>
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
