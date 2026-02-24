import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Download, Star, BarChart3, DollarSign, Users, Award, ExternalLink, Link2, TrendingUp, Target, CheckCircle2, Building, FileDown, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, Shield, Info, Gavel, Brain, ArrowLeft } from "lucide-react";
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
  const editingRef = useRef(false);
  const initRef = useRef(fin?.id);

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
            <SelectItem value="pct">%</SelectItem>
            <SelectItem value="fixed">مبلغ</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border border-slate-200 p-2">
        <Input
          type="number"
          value={designValue}
          onChange={(e) => { editingRef.current = true; setDesignValue(e.target.value); }}
          onBlur={() => doSave()}
          className="text-center bg-white border-slate-300"
        />
        {designType === 'pct' && constructionCost > 0 && (
          <p className="text-xs text-slate-500 mt-1 text-center">{designAmount.toLocaleString()} AED</p>
        )}
      </td>
      <td className="border border-slate-200 p-2 text-center">
        <Select value={supervisionType} onValueChange={(v: any) => {
          setSupervisionType(v);
          doSave({ supervisionType: v });
        }}>
          <SelectTrigger className="w-full bg-white border-slate-300"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">%</SelectItem>
            <SelectItem value="fixed">مبلغ</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="border border-slate-200 p-2">
        <Input
          type="number"
          value={supervisionValue}
          onChange={(e) => { editingRef.current = true; setSupervisionValue(e.target.value); }}
          onBlur={() => doSave()}
          className="text-center bg-white border-slate-300"
        />
        {supervisionType === 'pct' && constructionCost > 0 && (
          <p className="text-xs text-slate-500 mt-1 text-center">{supervisionAmount.toLocaleString()} AED</p>
        )}
      </td>
      <td className="border border-slate-200 p-4 text-center font-bold text-lg bg-gradient-to-l from-emerald-50 to-white text-emerald-700" style={{ minWidth: '160px' }}>
        {total.toLocaleString()} AED
      </td>
      <td className="border border-slate-200 p-2">
        <div className="flex items-center gap-1">
          <Input
            value={proposalLink}
            onChange={(e) => { editingRef.current = true; setProposalLink(e.target.value); }}
            onBlur={() => doSave()}
            placeholder="رابط العرض"
            className="text-sm bg-white border-slate-300"
          />
          {proposalLink && (
            <a
              href={proposalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 p-1"
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

// TECHNICAL Evaluation criteria - FEES REMOVED (Item 1: Separate fees from technical scoring)
// Weights redistributed proportionally from original 87.25% to 100%
const CRITERIA = [
  { id: 0, name: 'الهوية المعمارية وجودة التصميم', weight: 14.6, description: 'تقييم جودة التصميم المعماري والهوية البصرية للمشروع ومدى تميزه في السوق', options: [
    { score: 100, label: '100 نقطة: مستوى معلم بارز — هوية أيقونية قوية، عامل تمييز في السوق، عمارة لا تُنسى' },
    { score: 75, label: '75 نقطة: جودة عالية — هوية مميزة، سرد تصميمي واضح، حضور سوقي فوق المتوسط' },
    { score: 50, label: '50 نقطة: جودة متوسطة — كفء لكن عام، لا يوجد تمييز قوي' },
    { score: 25, label: '25 نقطة: هوية ضعيفة — يفتقر للوضوح، جاذبية سوقية محدودة' },
    { score: 0, label: '0 نقطة: تصميم ضعيف — لا توجد هوية متماسكة، ضعيف بصرياً' },
  ]},
  { id: 1, name: 'القدرات التقنية والتكامل مع BIM', weight: 14.6, description: 'تقييم مستوى استخدام تقنيات BIM والقدرات التقنية الرقمية في التصميم والتنسيق', options: [
    { score: 100, label: '100 نقطة: ممارسة BIM متقدمة — سير عمل BIM كامل، تنسيق تصميم LOD 300-350، إدارة تضارب قوية' },
    { score: 75, label: '75 نقطة: ممارسة BIM جيدة — استخدام BIM بشكل متسق، تنسيق جيد' },
    { score: 50, label: '50 نقطة: استخدام BIM أساسي — BIM محدود في النمذجة فقط' },
    { score: 25, label: '25 نقطة: تكامل BIM ضئيل — تنسيق معتمد على 2D في الغالب' },
    { score: 0, label: '0 نقطة: لا توجد قدرة BIM' },
  ]},
  { id: 3, name: 'كفاءة التخطيط وتحسين المساحات', weight: 13.6, description: 'تقييم مدى كفاءة استخدام المساحات وتحسين التخطيط الداخلي والخارجي', options: [
    { score: 100, label: '100 نقطة: كفاءة استثنائية — منطق تخطيط ممتاز، استخدام أمثل للمساحة، الحد الأدنى من الفراغات الميتة' },
    { score: 75, label: '75 نقطة: كفاءة قوية — تخطيط مساحات جيد جداً، عدم كفاءة طفيف' },
    { score: 50, label: '50 نقطة: كفاءة مقبولة — تخطيط وظيفي لكن تقليدي، بعض المساحات المفقودة' },
    { score: 25, label: '25 نقطة: كفاءة ضعيفة — منطق حركة ضعيف، مساحات مهدرة ملحوظة' },
    { score: 0, label: '0 نقطة: كفاءة ضعيفة جداً — تخطيط غير فعال، فقدان كبير في المساحة' },
  ]},
  { id: 4, name: 'التحكم في التكاليف والوعي بالميزانية', weight: 10.7, description: 'تقييم مدى وعي الاستشاري بالتكاليف وقدرته على التصميم ضمن الميزانية', options: [
    { score: 100, label: '100 نقطة: ذكاء تكلفة قوي — قرارات التصميم تعكس الوعي بالميزانية' },
    { score: 75, label: '75 نقطة: حساسية تكلفة جيدة' },
    { score: 50, label: '50 نقطة: محايد' },
    { score: 25, label: '25 نقطة: وعي تكلفة ضعيف' },
    { score: 0, label: '0 نقطة: مخاطر تصميم مكلفة' },
  ]},
  { id: 5, name: 'الخبرة في مشاريع مشابهة', weight: 9.7, description: 'تقييم سجل الاستشاري في تنفيذ مشاريع مشابهة من حيث الحجم والنوع', options: [
    { score: 100, label: '100 نقطة: خبرة واسعة ذات صلة — مشاريع متعددة مكتملة بنفس الحجم والنوع' },
    { score: 75, label: '75 نقطة: خبرة قوية — محفظة جيدة ذات صلة مع تسليم مثبت' },
    { score: 50, label: '50 نقطة: خبرة متوسطة — بعض المشاريع ذات الصلة لكن ليست قابلة للمقارنة بالكامل' },
    { score: 25, label: '25 نقطة: خبرة محدودة — مراجع مشابهة قليلة' },
    { score: 0, label: '0 نقطة: لا توجد خبرة ذات صلة' },
  ]},
  { id: 6, name: 'قوة فريق المشروع', weight: 9.7, description: 'تقييم كفاءة وخبرة الفريق المخصص للمشروع ومستوى القيادة', options: [
    { score: 100, label: '100 نقطة: فريق مخصص ذو خبرة عالية — قيادة عليا مشاركة مباشرة' },
    { score: 75, label: '75 نقطة: فريق قوي — خبرة جيدة مع دعم قادر' },
    { score: 50, label: '50 نقطة: فريق متوسط' },
    { score: 25, label: '25 نقطة: تكليف ضعيف' },
    { score: 0, label: '0 نقطة: فريق غير واضح أو عديم الخبرة' },
  ]},
  { id: 7, name: 'إدارة الوقت والتحكم في البرنامج', weight: 9.7, description: 'تقييم سجل الاستشاري في الالتزام بالجداول الزمنية وسرعة الاستجابة', options: [
    { score: 100, label: '100 نقطة: سجل ممتاز — انضباط جدولة قوي، موافقات سريعة مثبتة' },
    { score: 75, label: '75 نقطة: تحكم جيد' },
    { score: 50, label: '50 نقطة: مقبول' },
    { score: 25, label: '25 نقطة: تأخيرات محتملة' },
    { score: 0, label: '0 نقطة: تحكم ضعيف' },
  ]},
  { id: 8, name: 'الاهتمام الخاص بالمشروع ومرونة التعامل', weight: 9.2, description: 'تقييم مدى اهتمام الاستشاري بالمشروع ومرونته في التواصل والاستجابة', options: [
    { score: 100, label: '100 نقطة: المشروع أولوية قصوى، اهتمام خاص جداً، متابعة مستمرة، ومرونة عالية' },
    { score: 75, label: '75 نقطة: المشروع ذو أهمية خاصة، اهتمام واضح، وتواصل جيد ومرن' },
    { score: 50, label: '50 نقطة: المشروع يلقى اهتمام جيد، استجابة مقبولة وتعاون معقول' },
    { score: 25, label: '25 نقطة: المشروع أحد مشاريع الشركة العادية، اهتمام محدود' },
    { score: 0, label: '0 نقطة: المشروع ليس ذو أهمية، استجابة ضعيفة واهتمام منخفض' },
  ]},
  { id: 9, name: 'مرونة التعاقد', weight: 8.2, description: 'تقييم مرونة الاستشاري في شروط التعاقد والتعديلات والأعمال الإضافية', options: [
    { score: 100, label: '100 نقطة: لا أعمال إضافية غير مبررة، مرونة ممتازة في التعديلات، شروط عادلة وواضحة' },
    { score: 75, label: '75 نقطة: مرونة ممتازة في التعديلات، مع بعض القيود المنطقية' },
    { score: 50, label: '50 نقطة: مرونة متوسطة، يقبل التعديلات لكن بإجراءات رسمية' },
    { score: 25, label: '25 نقطة: رسمي في التعاقد، يميل لتقييد التعديلات' },
    { score: 0, label: '0 نقطة: مبالغ في تكاليف التعديلات والأعمال الإضافية' },
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

  useEffect(() => {
    if (project.id !== prevProjectId.current) {
      prevProjectId.current = project.id;
      setLocalBua(String(project.bua || ''));
      setLocalPrice(String(project.pricePerSqft || ''));
    }
  }, [project.id, project.bua, project.pricePerSqft]);

  const bua = parseFloat(localBua) || 0;
  const price = parseFloat(localPrice) || 0;
  const total = bua * price;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-200">
        <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Building className="w-4 h-4" />
          مساحة البناء (BUA)
        </p>
        <Input
          type="number"
          value={localBua}
          onChange={(e) => setLocalBua(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localBua) || 0;
            updateProjectMutation.mutate({ id: project.id, bua: val });
          }}
          placeholder="مثلاً: 50000"
          className="text-lg font-bold bg-white border-blue-300"
        />
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-200">
        <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          سعر القدم المربع
        </p>
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

// Fee Deviation Zone Badge (Item 10)
function FeeDeviationBadge({ deviation, zone, flag }: { deviation: number; zone: string; flag: string | null }) {
  const zoneStyles: Record<string, string> = {
    normal: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    moderate_high: 'bg-amber-100 text-amber-800 border-amber-300',
    extreme_high: 'bg-red-100 text-red-800 border-red-300',
    extreme_low: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const zoneIcons: Record<string, any> = {
    normal: <CheckCircle2 className="w-3.5 h-3.5" />,
    moderate_high: <AlertTriangle className="w-3.5 h-3.5" />,
    extreme_high: <AlertTriangle className="w-3.5 h-3.5" />,
    extreme_low: <Shield className="w-3.5 h-3.5" />,
  };
  const zoneLabels: Record<string, string> = {
    normal: 'نطاق طبيعي',
    moderate_high: 'انحراف مرتفع معتدل',
    extreme_high: 'انحراف مرتفع جداً',
    extreme_low: 'انحراف منخفض جداً',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${zoneStyles[zone] || zoneStyles.normal}`}>
        {zoneIcons[zone]}
        {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
      </span>
      <span className="text-[10px] text-slate-500">{zoneLabels[zone]}</span>
      {flag && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${zone === 'extreme_high' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
          {flag}
        </span>
      )}
    </div>
  );
}

// Scoring Guide Dialog (Item 3)
function ScoringGuide({ criterion }: { criterion: typeof CRITERIA[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-blue-500 hover:text-blue-700 transition-colors" title="دليل التقييم">
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" dir="rtl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{criterion.name}</h3>
            <p className="text-sm text-slate-600 mb-4">{criterion.description}</p>
            <p className="text-xs font-semibold text-slate-500 mb-2">الوزن: {criterion.weight}%</p>
            <div className="space-y-2">
              {criterion.options.map(opt => {
                const parts = opt.label.match(/^(\d+)\s*(نقطة|نقاط):\s*(.*)$/);
                const bgColor = opt.score >= 75 ? 'bg-emerald-50 border-emerald-200' : opt.score >= 50 ? 'bg-amber-50 border-amber-200' : opt.score >= 25 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';
                return (
                  <div key={opt.score} className={`p-3 rounded-xl border ${bgColor}`}>
                    <span className="font-bold text-blue-700">{parts ? `${parts[1]} ${parts[2]}` : opt.score}</span>
                    <span className="text-sm text-slate-700 mr-2">{parts ? parts[3] : opt.label}</span>
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setOpen(false)} className="w-full mt-4">إغلاق</Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ConsultantEvaluationPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newConsultantName, setNewConsultantName] = useState("");
  const [activeEvaluator, setActiveEvaluator] = useState('sheikh_issa');
  // Item 2: Criterion-by-criterion navigation
  const [evaluationMode, setEvaluationMode] = useState<'table' | 'criterion'>('table');
  const [currentCriterionIdx, setCurrentCriterionIdx] = useState(0);
  // Item 5: Committee Decision tab
  const [activeTab, setActiveTab] = useState('evaluation');
  // Committee decision state
  const [decisionType, setDecisionType] = useState('');
  const [decisionBasis, setDecisionBasis] = useState('');
  const [selectedConsultantId, setSelectedConsultantId] = useState<number | null>(null);
  const [justification, setJustification] = useState('');
  const [negotiationTarget, setNegotiationTarget] = useState('');
  const [negotiationConditions, setNegotiationConditions] = useState('');
  const [committeeNotes, setCommitteeNotes] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGettingRecommendation, setIsGettingRecommendation] = useState(false);
  const [isGeneratingAdvisory, setIsGeneratingAdvisory] = useState(false);
  const [postDecisionAnalysis, setPostDecisionAnalysis] = useState('');
  const [isPostAnalyzing, setIsPostAnalyzing] = useState(false);

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
  const committeeQuery = trpc.committee.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const aiAdvisoryQuery = trpc.committee.getAiAdvisory.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  // Load committee decision when it changes
  useEffect(() => {
    if (committeeQuery.data) {
      const d = committeeQuery.data;
      setDecisionType(d.decisionType || '');
      setDecisionBasis(d.decisionBasis || '');
      setSelectedConsultantId(d.selectedConsultantId || null);
      setJustification(d.justification || '');
      setNegotiationTarget(d.negotiationTarget || '');
      setNegotiationConditions(d.negotiationConditions || '');
      setCommitteeNotes(d.committeeNotes || '');
      setAiAnalysis(d.aiAnalysis || '');
      setAiRecommendation(d.aiRecommendation || '');
      setPostDecisionAnalysis(d.aiPostDecisionAnalysis || '');
    }
  }, [committeeQuery.data]);

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

  const upsertCommitteeMutation = trpc.committee.upsert.useMutation({
    onSuccess: () => committeeQuery.refetch(),
  });

  const confirmDecisionMutation = trpc.committee.confirmDecision.useMutation({
    onSuccess: () => committeeQuery.refetch(),
  });

  const analyzeDecisionMutation = trpc.committee.analyzeDecision.useMutation();
  const postDecisionMutation = trpc.committee.postDecisionAnalysis.useMutation();
  const recommendationMutation = trpc.committee.getRecommendation.useMutation();
  const generateAdvisoryMutation = trpc.committee.generateAiAdvisory.useMutation({
    onSuccess: () => aiAdvisoryQuery.refetch(),
  });

  // Calculate scores - ONLY technical criteria (fees excluded)
  const consultantScores = useMemo(() => {
    if (!selectedProjectId) return {};

    const scores: Record<number, { scores: number[]; total: number; weighted: number; evaluatorScores: Record<string, number[]> }> = {};

    const pConsultants = projectDetailsQuery.data?.consultants || [];
    const allScores = evaluatorScoresQuery.data || [];

    pConsultants.forEach((consultant: any) => {
      const evaluatorScores: Record<string, number[]> = {};
      
      EVALUATORS.forEach((ev) => {
        const evScores = CRITERIA.map((criterion) => {
          const scoreRecord = allScores.find(
            (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === ev.id
          );
          return scoreRecord?.score || 0;
        });
        evaluatorScores[ev.id] = evScores;
      });

      const avgScores = CRITERIA.map((_criterion, idx) => {
        const sum = EVALUATORS.reduce((acc, ev) => acc + (evaluatorScores[ev.id][idx] || 0), 0);
        return sum / EVALUATORS.length;
      });

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

  // Fee Deviation Analysis (Item 10)
  const feeDeviations = useMemo(() => {
    const fees = Object.entries(financialTotals).filter(([_, v]) => v > 0);
    if (fees.length === 0) return { average: 0, consultants: {} as Record<number, { deviation: number; zone: string; zoneLabel: string; penalty: number; flag: string | null }> };
    
    const average = fees.reduce((sum, [_, v]) => sum + v, 0) / fees.length;
    const consultants: Record<number, { deviation: number; zone: string; zoneLabel: string; penalty: number; flag: string | null }> = {};
    
    fees.forEach(([id, fee]) => {
      const deviation = ((fee - average) / average) * 100;
      let zone = 'normal';
      let zoneLabel = 'النطاق الطبيعي';
      let penalty = 0;
      let flag: string | null = null;

      if (deviation > 30) {
        zone = 'extreme_high';
        zoneLabel = 'انحراف مرتفع جداً';
        penalty = 0.15;
        flag = 'مخاطر تكلفة عالية';
      } else if (deviation > 15) {
        zone = 'moderate_high';
        zoneLabel = 'انحراف مرتفع معتدل';
        penalty = 0.07;
      } else if (deviation < -30) {
        zone = 'extreme_low';
        zoneLabel = 'انحراف منخفض جداً';
        flag = 'مخاطر سعر منخفض';
      }

      consultants[parseInt(id)] = { deviation: Math.round(deviation * 10) / 10, zone, zoneLabel, penalty, flag };
    });

    return { average: Math.round(average), consultants };
  }, [financialTotals]);

  // Rankings (Item 9: Technical ranking is reference only)
  const rankings = useMemo(() => {
    const pConsultants = projectDetailsQuery.data?.consultants || [];
    return pConsultants
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        technicalScore: consultantScores[c.id]?.weighted || 0,
        totalFee: financialTotals[c.id] || 0,
        feeDeviation: feeDeviations.consultants[c.id]?.deviation || 0,
        feeZone: feeDeviations.consultants[c.id]?.zone || 'normal',
        feeFlag: feeDeviations.consultants[c.id]?.flag || null,
      }))
      .sort((a, b) => b.technicalScore - a.technicalScore);
  }, [projectDetailsQuery.data, consultantScores, financialTotals, feeDeviations]);

  // Evaluation progress (Item 7)
  const evaluationProgress = useMemo(() => {
    if (!selectedProjectId) return 0;
    const pConsultants = projectDetailsQuery.data?.consultants || [];
    const allScores = evaluatorScoresQuery.data || [];
    const totalPossible = pConsultants.length * CRITERIA.length * EVALUATORS.length;
    if (totalPossible === 0) return 0;
    const filled = allScores.filter((s: any) => s.score > 0).length;
    return Math.round((filled / totalPossible) * 100);
  }, [selectedProjectId, projectDetailsQuery.data, evaluatorScoresQuery.data]);

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];
  const isDecisionConfirmed = committeeQuery.data?.isConfirmed === 1;

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
      return { consultantName: c.name, designValue: String(dv), designType: dt, designAmount, supervisionValue: String(sv), supervisionType: st, supervisionAmount, total: designAmount + supervisionAmount };
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

  // AI Advisory for current criterion (Item 4)
  const handleGenerateAdvisory = async () => {
    if (!selectedProjectId || !selectedProject) return;
    const criterion = CRITERIA[currentCriterionIdx];
    setIsGeneratingAdvisory(true);
    try {
      await generateAdvisoryMutation.mutateAsync({
        projectId: selectedProjectId,
        projectName: selectedProject.name,
        criterionName: criterion.name,
        criterionId: criterion.id,
        criterionWeight: criterion.weight,
        criterionDescription: criterion.description,
        scoreGuide: criterion.options.map(o => o.label).join('\n'),
        consultants: projectConsultants.map((c: any) => ({
          id: c.id,
          name: c.name,
          profile: '',
        })),
      });
    } finally {
      setIsGeneratingAdvisory(false);
    }
  };

  // AI Recommendation (Item 5)
  const handleGetRecommendation = async () => {
    if (!selectedProjectId || !selectedProject) return;
    setIsGettingRecommendation(true);
    try {
      const result = await recommendationMutation.mutateAsync({
        projectName: selectedProject.name,
        projectBua: selectedProject.bua || 0,
        projectPricePerSqft: selectedProject.pricePerSqft || 0,
        consultants: rankings.map(r => ({
          name: r.name,
          technicalScore: r.technicalScore,
          totalFee: r.totalFee,
          feeDeviation: r.feeDeviation,
          feeZone: r.feeZone,
        })),
      });
      setAiRecommendation(result.recommendation);
      upsertCommitteeMutation.mutate({
        projectId: selectedProjectId,
        aiRecommendation: result.recommendation,
      });
    } finally {
      setIsGettingRecommendation(false);
    }
  };

  // AI Analysis of decision (Item 6)
  const handleAnalyzeDecision = async () => {
    if (!selectedProjectId || !selectedProject || !selectedConsultantId) return;
    const selectedName = projectConsultants.find((c: any) => c.id === selectedConsultantId)?.name || '';
    setIsAnalyzing(true);
    try {
      const result = await analyzeDecisionMutation.mutateAsync({
        projectName: selectedProject.name,
        selectedConsultantName: selectedName,
        decisionType,
        decisionBasis,
        rankings: rankings.map((r, i) => ({
          name: r.name,
          rank: i + 1,
          technicalScore: r.technicalScore,
          totalFee: r.totalFee,
          feeDeviation: r.feeDeviation,
          feeZone: r.feeZone,
        })),
        negotiationTarget,
        negotiationConditions,
      });
      setAiAnalysis(result.analysis);
      upsertCommitteeMutation.mutate({
        projectId: selectedProjectId,
        aiAnalysis: result.analysis,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Post-decision analysis (Item 6)
  const handlePostDecisionAnalysis = async () => {
    if (!selectedProjectId || !selectedProject || !selectedConsultantId) return;
    const selectedName = projectConsultants.find((c: any) => c.id === selectedConsultantId)?.name || '';
    setIsPostAnalyzing(true);
    try {
      const result = await postDecisionMutation.mutateAsync({
        projectId: selectedProjectId,
        projectName: selectedProject.name,
        selectedConsultantName: selectedName,
        decisionType,
        decisionBasis,
        justification,
        rankings: rankings.map((r, i) => ({
          name: r.name,
          rank: i + 1,
          technicalScore: r.technicalScore,
          totalFee: r.totalFee,
        })),
        negotiationTarget,
        negotiationConditions,
      });
      setPostDecisionAnalysis(result.analysis);
    } finally {
      setIsPostAnalyzing(false);
    }
  };

  // Save committee decision
  const handleSaveDecision = () => {
    if (!selectedProjectId) return;
    upsertCommitteeMutation.mutate({
      projectId: selectedProjectId,
      selectedConsultantId: selectedConsultantId || undefined,
      decisionType,
      decisionBasis,
      justification,
      negotiationTarget,
      negotiationConditions,
      committeeNotes,
      aiAnalysis,
      aiRecommendation,
    });
  };

  // Confirm decision
  const handleConfirmDecision = () => {
    if (!selectedProjectId || !user) return;
    if (!confirm('هل أنت متأكد من تأكيد القرار؟ لا يمكن التراجع بعد التأكيد.')) return;
    confirmDecisionMutation.mutate({
      projectId: selectedProjectId,
      confirmedBy: user.name,
    });
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
          <div className="relative px-8 py-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">تقييم الاستشاريين</h1>
                <p className="text-blue-100">التقييم الفني مستقل 100% — الأتعاب تُحلل منفصلة — القرار النهائي للجنة</p>
              </div>
            </div>
            {/* Progress Bar (Item 7) */}
            {selectedProjectId && (
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1 bg-white/20 rounded-full h-3">
                  <div className="bg-white rounded-full h-3 transition-all duration-500" style={{ width: `${evaluationProgress}%` }} />
                </div>
                <span className="text-white font-bold text-sm">{evaluationProgress}% مكتمل</span>
                <div className="flex gap-2 mr-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>9 معايير فنية</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>الأتعاب منفصلة</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs flex items-center gap-1">
                    <Gavel className="w-3 h-3" />
                    <span>قرار اللجنة سيادي</span>
                  </div>
                </div>
              </div>
            )}
            {/* PDF Export */}
            {selectedProjectId && projectConsultants.length > 0 && (
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl gap-2 backdrop-blur-sm text-xs" onClick={() => handleExportPDF('technical')}>
                  <FileDown className="w-4 h-4" /> تصدير فني PDF
                </Button>
                <Button variant="ghost" className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl gap-2 backdrop-blur-sm text-xs" onClick={() => handleExportPDF('financial')}>
                  <FileDown className="w-4 h-4" /> تصدير مالي PDF
                </Button>
                <Button variant="ghost" className="bg-emerald-500/80 hover:bg-emerald-500 text-white border border-emerald-400/30 rounded-xl gap-2 backdrop-blur-sm font-bold text-xs" onClick={() => handleExportPDF('full')}>
                  <FileDown className="w-4 h-4" /> تقرير شامل PDF
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Project Selector */}
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b py-4">
            <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
              <Building className="w-5 h-5 text-blue-600" />
              اختر المشروع
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Select value={selectedProjectId?.toString() || ""} onValueChange={(value) => setSelectedProjectId(parseInt(value))}>
                <SelectTrigger className="flex-1 h-12 bg-white border-slate-300 text-lg">
                  <SelectValue placeholder="اختر مشروعاً للتقييم" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>
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
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b py-4">
                <CardTitle className="text-xl text-slate-800">{selectedProject.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <BuaPriceFields project={selectedProject} updateProjectMutation={updateProjectMutation} />
              </CardContent>
            </Card>

            {/* Consultants Management */}
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b py-4">
                <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
                  <Users className="w-5 h-5 text-purple-600" />
                  إدارة الاستشاريين للمشروع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2 mb-4">
                  <Select onValueChange={(value) => {
                    const consultantId = parseInt(value);
                    if (!projectConsultants.find((c: any) => c.id === consultantId)) {
                      addConsultantMutation.mutate({ projectId: selectedProject.id, consultantId });
                    }
                  }}>
                    <SelectTrigger className="flex-1 bg-white border-slate-300">
                      <SelectValue placeholder="أضف استشاري للمشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.filter((c: any) => !projectConsultants.find((pc: any) => pc.id === c.id)).map((consultant: any) => (
                        <SelectItem key={consultant.id} value={consultant.id.toString()}>{consultant.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-3">
                  {projectConsultants.map((consultant: any) => (
                    <div key={consultant.id} className="bg-gradient-to-r from-blue-100 to-purple-100 text-slate-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm">
                      {consultant.name}
                      <button onClick={() => {
                        if (confirm(`هل تريد إزالة ${consultant.name} من هذا المشروع؟`)) {
                          removeConsultantFromProjectMutation.mutate({ projectId: selectedProject.id, consultantId: consultant.id });
                        }
                      }} className="mr-1 text-red-500 hover:text-red-700 transition-colors" title="إزالة من المشروع">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Main Tabs: Technical | Financial | Committee Decision */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 h-14 bg-white shadow-lg rounded-xl border-0">
                <TabsTrigger value="evaluation" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                  التقييم الفني
                </TabsTrigger>
                <TabsTrigger value="financial" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg">
                  <DollarSign className="w-4 h-4" />
                  الأتعاب المالية
                </TabsTrigger>
                <TabsTrigger value="decision" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-lg">
                  <Gavel className="w-4 h-4" />
                  قرار اللجنة
                </TabsTrigger>
              </TabsList>

              {/* ============ EVALUATION TAB ============ */}
              <TabsContent value="evaluation">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                        <Star className="w-5 h-5 text-amber-500" />
                        التقييم الفني (9 معايير — بدون الأتعاب)
                      </CardTitle>
                      {/* Mode Toggle (Item 2) */}
                      <div className="flex gap-2">
                        <Button variant={evaluationMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setEvaluationMode('table')} className="text-xs">
                          عرض الجدول
                        </Button>
                        <Button variant={evaluationMode === 'criterion' ? 'default' : 'outline'} size="sm" onClick={() => setEvaluationMode('criterion')} className="text-xs">
                          معيار بمعيار
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Evaluator Selector */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                      {EVALUATORS.map((ev) => (
                        <button key={ev.id} onClick={() => setActiveEvaluator(ev.id)} className={`px-6 py-3 rounded-xl text-base font-bold transition-all shadow-md ${activeEvaluator === ev.id ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-105' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                          {ev.name}
                        </button>
                      ))}
                      <div className="mr-auto bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 px-4 py-3 rounded-xl text-sm font-semibold border border-amber-200">
                        المتوسط يُحسب تلقائياً من تقييمات الثلاثة
                      </div>
                    </div>

                    {/* ===== TABLE MODE ===== */}
                    {evaluationMode === 'table' && (
                      <>
                        {projectConsultants.length > 2 && (
                          <p className="text-xs text-slate-500 mb-2 font-medium">← اسحب لليسار لرؤية باقي الاستشاريين</p>
                        )}
                        <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg" style={{ maxWidth: '100%' }}>
                          <table className="border-collapse w-max">
                            <thead>
                              <tr className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white">
                                <th className="border border-slate-600 p-4 text-right sticky right-0 bg-slate-800 z-10 font-bold" style={{ minWidth: '200px' }}>
                                  المعيار (الوزن)
                                </th>
                                {projectConsultants.map((consultant: any) => (
                                  <th key={consultant.id} className="border border-slate-600 p-4 text-center font-bold" style={{ minWidth: '200px' }}>
                                    <span className="whitespace-normal leading-tight text-base">{consultant.name}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {CRITERIA.map((criterion) => (
                                <tr key={criterion.id} className="border-b hover:bg-blue-50/50 transition-colors">
                                  <td className="border border-slate-200 p-4 py-5 bg-gradient-to-l from-slate-50 to-white font-bold text-right sticky right-0 z-10 whitespace-normal leading-relaxed" style={{ minWidth: '200px' }}>
                                    <div className="flex items-center gap-2">
                                      <ScoringGuide criterion={criterion} />
                                      <div>
                                        {criterion.name}
                                        <br />
                                        <small className="text-slate-600 font-semibold">(وزن: {criterion.weight}%)</small>
                                      </div>
                                    </div>
                                  </td>
                                  {projectConsultants.map((consultant: any) => {
                                    const currentScore = (evaluatorScoresQuery.data || []).find(
                                      (s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id && s.evaluatorName === activeEvaluator
                                    );
                                    return (
                                      <td key={consultant.id} className="border border-slate-200 p-3 py-4 text-center" style={{ minWidth: '200px' }}>
                                        <Select value={currentScore?.score?.toString() || ""} onValueChange={(value) => {
                                          updateEvaluatorScoreMutation.mutate({
                                            projectId: selectedProject.id,
                                            consultantId: consultant.id,
                                            criterionId: criterion.id,
                                            evaluatorName: activeEvaluator,
                                            score: parseInt(value),
                                          });
                                        }}>
                                          <SelectTrigger className="w-full text-sm h-auto min-h-[3.5rem] py-3 whitespace-normal leading-relaxed text-right cursor-pointer bg-white border-slate-300 font-medium">
                                            <SelectValue placeholder="اختر التقييم" />
                                          </SelectTrigger>
                                          <SelectContent className="w-[500px] max-w-[90vw]">
                                            {criterion.options.map((option) => {
                                              const parts = option.label.match(/^(\d+)\s*(نقطة|نقاط):\s*(.*)$/);
                                              return (
                                                <SelectItem key={option.score} value={option.score.toString()} className="whitespace-normal text-sm leading-relaxed py-3">
                                                  {parts ? (
                                                    <span>
                                                      <span className="font-bold text-blue-700 inline-block">
                                                        <span className="whitespace-nowrap">{parts[1]} {parts[2]}:</span>
                                                      </span>
                                                      {' '}{parts[3]}
                                                    </span>
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
                      </>
                    )}

                    {/* ===== CRITERION-BY-CRITERION MODE (Item 2) ===== */}
                    {evaluationMode === 'criterion' && (
                      <div>
                        {/* Navigation */}
                        <div className="flex items-center justify-between mb-6 bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-2xl border border-blue-200">
                          <Button variant="outline" size="lg" onClick={() => setCurrentCriterionIdx(Math.max(0, currentCriterionIdx - 1))} disabled={currentCriterionIdx === 0} className="gap-2">
                            <ChevronRight className="w-5 h-5" /> المعيار السابق
                          </Button>
                          <div className="text-center">
                            <p className="text-sm text-slate-500">المعيار {currentCriterionIdx + 1} من {CRITERIA.length}</p>
                            <p className="text-lg font-bold text-slate-800">{CRITERIA[currentCriterionIdx].name}</p>
                            <p className="text-sm text-blue-600 font-semibold">الوزن: {CRITERIA[currentCriterionIdx].weight}%</p>
                          </div>
                          <Button variant="outline" size="lg" onClick={() => setCurrentCriterionIdx(Math.min(CRITERIA.length - 1, currentCriterionIdx + 1))} disabled={currentCriterionIdx === CRITERIA.length - 1} className="gap-2">
                            المعيار التالي <ChevronLeft className="w-5 h-5" />
                          </Button>
                        </div>

                        {/* Criterion progress dots */}
                        <div className="flex gap-1 justify-center mb-6">
                          {CRITERIA.map((_, idx) => (
                            <button key={idx} onClick={() => setCurrentCriterionIdx(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentCriterionIdx ? 'bg-blue-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'}`} />
                          ))}
                        </div>

                        {/* Description & Guide */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
                          <p className="text-sm text-slate-600 mb-3">{CRITERIA[currentCriterionIdx].description}</p>
                          <div className="grid grid-cols-5 gap-2">
                            {CRITERIA[currentCriterionIdx].options.map(opt => {
                              const bgColor = opt.score >= 75 ? 'bg-emerald-50 border-emerald-200' : opt.score >= 50 ? 'bg-amber-50 border-amber-200' : opt.score >= 25 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';
                              return (
                                <div key={opt.score} className={`p-2 rounded-lg border text-xs ${bgColor}`}>
                                  <span className="font-bold text-blue-700">{opt.score}</span>
                                  <p className="text-slate-600 mt-1 leading-tight">{opt.label.split(':')[1]?.trim()}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* AI Advisory Button (Item 4) */}
                        <div className="flex justify-end mb-4">
                          <Button variant="outline" size="sm" onClick={handleGenerateAdvisory} disabled={isGeneratingAdvisory} className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50">
                            {isGeneratingAdvisory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                            رأي AI الاستشاري
                          </Button>
                        </div>

                        {/* Horizontal comparison for this criterion */}
                        <div className="grid gap-4">
                          {projectConsultants.map((consultant: any) => {
                            const currentScore = (evaluatorScoresQuery.data || []).find(
                              (s: any) => s.consultantId === consultant.id && s.criterionId === CRITERIA[currentCriterionIdx].id && s.evaluatorName === activeEvaluator
                            );
                            const aiScore = (aiAdvisoryQuery.data || []).find(
                              (s: any) => s.consultantId === consultant.id && s.criterionId === CRITERIA[currentCriterionIdx].id
                            );
                            return (
                              <div key={consultant.id} className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-md hover:shadow-lg transition-all">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-lg font-bold text-slate-800">{consultant.name}</h4>
                                  {aiScore && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs">
                                      <span className="text-purple-600 font-bold">AI يقترح: {aiScore.suggestedScore}</span>
                                      {aiScore.reasoning && <p className="text-purple-500 mt-0.5">{aiScore.reasoning}</p>}
                                    </div>
                                  )}
                                </div>
                                <Select value={currentScore?.score?.toString() || ""} onValueChange={(value) => {
                                  updateEvaluatorScoreMutation.mutate({
                                    projectId: selectedProject.id,
                                    consultantId: consultant.id,
                                    criterionId: CRITERIA[currentCriterionIdx].id,
                                    evaluatorName: activeEvaluator,
                                    score: parseInt(value),
                                  });
                                }}>
                                  <SelectTrigger className="w-full text-base h-auto min-h-[4rem] py-4 whitespace-normal leading-relaxed text-right cursor-pointer bg-slate-50 border-slate-300 font-medium">
                                    <SelectValue placeholder="اختر التقييم لهذا المعيار" />
                                  </SelectTrigger>
                                  <SelectContent className="w-[500px] max-w-[90vw]">
                                    {CRITERIA[currentCriterionIdx].options.map((option) => {
                                      const parts = option.label.match(/^(\d+)\s*(نقطة|نقاط):\s*(.*)$/);
                                      return (
                                        <SelectItem key={option.score} value={option.score.toString()} className="whitespace-normal text-sm leading-relaxed py-3">
                                          {parts ? (
                                            <span>
                                              <span className="font-bold text-blue-700"><span className="whitespace-nowrap">{parts[1]} {parts[2]}:</span></span>
                                              {' '}{parts[3]}
                                            </span>
                                          ) : option.label}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Average Results Table */}
                    <div className="mt-8">
                      <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        المتوسط النهائي (من المقيّمين الثلاثة) — فني فقط
                      </h3>
                      <div className="overflow-x-auto border-2 border-amber-200 rounded-2xl shadow-lg">
                        <table className="border-collapse w-max">
                          <thead>
                            <tr className="bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50">
                              <th className="border border-amber-200 p-3 text-right font-bold text-amber-900 sticky right-0 bg-amber-100 z-10" style={{ minWidth: '200px' }}>المعيار</th>
                              {projectConsultants.map((consultant: any) => (
                                <th key={consultant.id} className="border border-amber-200 p-3 text-center font-bold text-amber-900" style={{ minWidth: '180px' }}>
                                  <span className="whitespace-normal leading-tight">{consultant.name}</span>
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
                                {projectConsultants.map((consultant: any) => {
                                  const avgScore = consultantScores[consultant.id]?.scores[critIdx] || 0;
                                  return (
                                    <td key={consultant.id} className="border border-amber-200 p-3 text-center">
                                      <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm ${
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
                              <td className="border border-amber-200 p-4 text-right sticky right-0 bg-slate-200 z-10 text-lg">المجموع المرجح</td>
                              {projectConsultants.map((consultant: any) => (
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

              {/* ============ FINANCIAL TAB ============ */}
              <TabsContent value="financial">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      الأتعاب المالية (منفصلة عن التقييم الفني)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Fee Deviation Legend (Item 10) */}
                    <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-4 rounded-xl border border-slate-200 mb-6">
                      <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        مناطق انحراف الأتعاب (Safety First)
                      </h4>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                          <span className="font-bold text-emerald-800">النطاق الطبيعي</span>
                          <p className="text-emerald-600">±15% من المتوسط</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                          <span className="font-bold text-amber-800">انحراف مرتفع معتدل</span>
                          <p className="text-amber-600">+15% إلى +30%</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 p-2 rounded-lg">
                          <span className="font-bold text-red-800">انحراف مرتفع جداً</span>
                          <p className="text-red-600">أكثر من +30%</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg">
                          <span className="font-bold text-blue-800">انحراف منخفض جداً</span>
                          <p className="text-blue-600">أقل من -30%</p>
                        </div>
                      </div>
                      {feeDeviations.average > 0 && (
                        <p className="mt-2 text-sm text-slate-600">متوسط الأتعاب: <span className="font-bold text-slate-800">{feeDeviations.average.toLocaleString()} AED</span></p>
                      )}
                    </div>

                    <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg">
                      <table className="border-collapse w-max min-w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
                            <th className="border border-emerald-700 p-3 text-right text-sm font-bold" style={{ width: '13%' }}>الاستشاري</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '8%' }}>نوع التصميم</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '12%' }}>قيمة التصميم</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '8%' }}>نوع الإشراف</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '12%' }}>قيمة الإشراف</th>
                            <th className="border border-emerald-700 p-3 text-center text-sm font-bold" style={{ width: '13%' }}>المجموع</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '10%' }}>الانحراف</th>
                            <th className="border border-emerald-700 p-3 text-center text-xs font-bold" style={{ width: '14%' }}>رابط العرض</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {[...projectConsultants]
                            .sort((a: any, b: any) => (financialTotals[a.id] || 0) - (financialTotals[b.id] || 0))
                            .map((consultant: any) => {
                              const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
                              const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);
                              const dev = feeDeviations.consultants[consultant.id];
                              return (
                                <React.Fragment key={consultant.id}>
                                  <FinancialRow
                                    consultant={consultant}
                                    fin={fin}
                                    selectedProjectId={selectedProjectId!}
                                    constructionCost={buildingCost}
                                    updateFinancialMutation={updateFinancialMutation}
                                    onTotalChange={() => {}}
                                  />
                                </React.Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Fee Deviation Summary Cards */}
                    {feeDeviations.average > 0 && (
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {rankings.map((r) => {
                          const dev = feeDeviations.consultants[r.id];
                          if (!dev) return null;
                          return (
                            <div key={r.id} className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-md">
                              <h4 className="font-bold text-slate-800 text-sm mb-2">{r.name}</h4>
                              <p className="text-lg font-bold text-emerald-700">{r.totalFee.toLocaleString()} AED</p>
                              <FeeDeviationBadge deviation={dev.deviation} zone={dev.zone} flag={dev.flag} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ============ COMMITTEE DECISION TAB (Item 5, 6, 9) ============ */}
              <TabsContent value="decision">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                        <Gavel className="w-5 h-5 text-amber-600" />
                        قرار اللجنة النهائي
                        {isDecisionConfirmed && (
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">مؤكد</span>
                        )}
                      </CardTitle>
                      <a href="/committee-decision" className="text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 flex items-center gap-1 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                        الصفحة الكاملة
                      </a>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Decision Philosophy Notice (Item 9) */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200 mb-6">
                      <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        فلسفة القرار
                      </h4>
                      <ul className="text-xs text-indigo-700 space-y-1">
                        <li>• التقييم الفني مستقل 100% عن الأتعاب</li>
                        <li>• الترتيب مرجعي وليس ملزماً — النظام لا يختار الفائز تلقائياً</li>
                        <li>• للجنة حرية اختيار: الأعلى فنياً، أفضل قيمة، الأقل تكلفة، أو حتى الأعلى تكلفة مع شروط تفاوض</li>
                        <li>• قرار اللجنة سيادي — الذكاء الاصطناعي يدعم التحليل ولا يفرض أو يلغي</li>
                      </ul>
                    </div>

                    {/* Rankings Summary */}
                    <div className="mb-6">
                      <h4 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        الترتيب المرجعي (فني)
                      </h4>
                      <div className="space-y-3">
                        {rankings.map((r, index) => {
                          const dev = feeDeviations.consultants[r.id];
                          return (
                            <div key={r.id} className={`p-4 rounded-2xl border-2 shadow-md transition-all hover:scale-[1.01] ${
                              selectedConsultantId === r.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' :
                              index === 0 ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50' :
                              index === 1 ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50' :
                              'border-slate-200 bg-white'
                            }`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-md ${
                                    index === 0 ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' :
                                    index === 1 ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white' :
                                    'bg-gradient-to-br from-slate-400 to-gray-500 text-white'
                                  }`}>{index + 1}</div>
                                  <div>
                                    <p className="text-base font-bold text-slate-800">{r.name}</p>
                                    <p className="text-sm text-slate-600">فني: <span className="font-bold text-blue-700">{r.technicalScore.toFixed(1)}/100</span></p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-emerald-700">{r.totalFee.toLocaleString()} AED</p>
                                    {dev && <FeeDeviationBadge deviation={dev.deviation} zone={dev.zone} flag={dev.flag} />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    <div className="mb-6">
                      <Button onClick={handleGetRecommendation} disabled={isGettingRecommendation || rankings.length === 0} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 mb-3">
                        {isGettingRecommendation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                        تحليل وتوصية AI
                      </Button>
                      {aiRecommendation && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
                          <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            توصية الذكاء الاصطناعي (استشارية فقط)
                          </h4>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiRecommendation}</div>
                        </div>
                      )}
                    </div>

                    {/* Committee Decision Form */}
                    <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-lg">
                      <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-amber-600" />
                        قرار اللجنة
                      </h4>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Select Consultant */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700 mb-1 block">الاستشاري المختار</label>
                          <Select value={selectedConsultantId?.toString() || ""} onValueChange={(v) => setSelectedConsultantId(parseInt(v))} disabled={isDecisionConfirmed}>
                            <SelectTrigger className="bg-white border-slate-300">
                              <SelectValue placeholder="اختر الاستشاري" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectConsultants.map((c: any) => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Decision Type */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700 mb-1 block">نوع القرار</label>
                          <Select value={decisionType} onValueChange={setDecisionType} disabled={isDecisionConfirmed}>
                            <SelectTrigger className="bg-white border-slate-300">
                              <SelectValue placeholder="اختر نوع القرار" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="selected">اختيار مباشر</SelectItem>
                              <SelectItem value="negotiate">التفاوض أولاً</SelectItem>
                              <SelectItem value="pending">قيد الدراسة</SelectItem>
                              <SelectItem value="rejected_all">رفض جميع العروض</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Decision Basis (Item 9) */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700 mb-1 block">أساس القرار</label>
                          <Select value={decisionBasis} onValueChange={setDecisionBasis} disabled={isDecisionConfirmed}>
                            <SelectTrigger className="bg-white border-slate-300">
                              <SelectValue placeholder="أساس الاختيار" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="highest_technical">الأعلى فنياً</SelectItem>
                              <SelectItem value="best_value">أفضل قيمة (فني + مالي)</SelectItem>
                              <SelectItem value="lowest_fee">الأقل تكلفة</SelectItem>
                              <SelectItem value="highest_fee_with_negotiation">الأعلى تكلفة مع تفاوض</SelectItem>
                              <SelectItem value="other">أسباب أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Negotiation Target */}
                        {(decisionType === 'negotiate' || decisionBasis === 'highest_fee_with_negotiation') && (
                          <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1 block">التارجت المالي</label>
                            <Input value={negotiationTarget} onChange={(e) => setNegotiationTarget(e.target.value)} placeholder="مثلاً: 2,000,000 AED" disabled={isDecisionConfirmed} className="bg-white border-slate-300" />
                          </div>
                        )}
                      </div>

                      {/* Negotiation Conditions */}
                      {(decisionType === 'negotiate' || decisionBasis === 'highest_fee_with_negotiation') && (
                        <div className="mb-4">
                          <label className="text-sm font-semibold text-slate-700 mb-1 block">شروط التفاوض</label>
                          <Textarea value={negotiationConditions} onChange={(e) => setNegotiationConditions(e.target.value)} placeholder="حدد شروط التفاوض..." disabled={isDecisionConfirmed} className="bg-white border-slate-300" rows={3} />
                        </div>
                      )}

                      {/* Justification */}
                      <div className="mb-4">
                        <label className="text-sm font-semibold text-slate-700 mb-1 block">مبررات القرار</label>
                        <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="اكتب مبررات اللجنة لهذا القرار..." disabled={isDecisionConfirmed} className="bg-white border-slate-300" rows={4} />
                      </div>

                      {/* Committee Notes */}
                      <div className="mb-4">
                        <label className="text-sm font-semibold text-slate-700 mb-1 block">ملاحظات اللجنة</label>
                        <Textarea value={committeeNotes} onChange={(e) => setCommitteeNotes(e.target.value)} placeholder="ملاحظات إضافية..." disabled={isDecisionConfirmed} className="bg-white border-slate-300" rows={3} />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-6">
                        {!isDecisionConfirmed && (
                          <>
                            <Button onClick={handleSaveDecision} className="gap-2 bg-blue-600 hover:bg-blue-700">
                              <CheckCircle2 className="w-4 h-4" /> حفظ القرار
                            </Button>
                            <Button onClick={handleAnalyzeDecision} disabled={isAnalyzing || !selectedConsultantId} variant="outline" className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50">
                              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                              تحليل AI للقرار
                            </Button>
                            <Button onClick={handleConfirmDecision} disabled={!selectedConsultantId || !decisionType} className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 mr-auto">
                              <Gavel className="w-4 h-4" /> تأكيد القرار النهائي
                            </Button>
                          </>
                        )}
                        {isDecisionConfirmed && (
                          <Button onClick={handlePostDecisionAnalysis} disabled={isPostAnalyzing} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                            {isPostAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                            تحليل ما بعد القرار
                          </Button>
                        )}
                      </div>

                      {/* AI Analysis */}
                      {aiAnalysis && (
                        <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
                          <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            تحليل AI للقرار
                          </h4>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                        </div>
                      )}

                      {/* Post-Decision Analysis (Item 6) */}
                      {postDecisionAnalysis && (
                        <div className="mt-6 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
                          <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            تحليل ما بعد القرار
                          </h4>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{postDecisionAnalysis}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
