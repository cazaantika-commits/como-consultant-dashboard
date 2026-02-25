import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Download, Star, BarChart3, DollarSign, Users, Award, ExternalLink, Link2, TrendingUp, Target, CheckCircle2, Building, FileDown, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, Shield, Info, Gavel, Brain, ArrowLeft, Scale, Calculator, SlidersHorizontal, Eye } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { generateEvaluationPDF } from "@/lib/pdfExport";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ScatterChart, Scatter, ZAxis, Cell, ReferenceLine } from 'recharts';

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
    { score: 95, label: 'طرح معماري مرجعي ذو هوية واضحة ومتماسكة بالكامل — فكرة تصميمية عميقة — لغة معمارية قابلة للتسويق والتميّز' },
    { score: 93, label: 'هوية قوية جداً — فكرة واضحة ومترابطة — معالجة الكتل والواجهات مدروسة' },
    { score: 90, label: 'هوية واضحة ومنظمة — تصميم متماسك' },
    { score: 85, label: 'تصميم جيد بفكرة مفهومة مع بعض التحفظات' },
    { score: 80, label: 'تصميم مقبول يفي بالأساسيات دون تميز' },
    { score: 68, label: 'طرح تقليدي أو غير مكتمل' },
    { score: 50, label: 'غياب واضح للهوية أو طرح غير مقنع' },
  ]},
  { id: 1, name: 'القدرات التقنية والتكامل مع BIM', weight: 14.6, description: 'تقييم مستوى استخدام تقنيات BIM والقدرات التقنية الرقمية في التصميم والتنسيق', options: [
    { score: 95, label: 'BIM متكامل لكافة التخصصات — LOD 350+ — تقارير Clash Detection — BEP موثقة' },
    { score: 91, label: 'BIM متقدم — LOD 300–350 — تنسيق فعال بين التخصصات' },
    { score: 84, label: 'BIM جيد — LOD 300 مع تنسيق أساسي' },
    { score: 72, label: 'استخدام BIM جزئي أو غير مكتمل' },
    { score: 45, label: 'نمذجة شكلية دون تكامل فعلي' },
    { score: 15, label: 'لا يوجد استخدام حقيقي لـ BIM' },
  ]},
  { id: 3, name: 'كفاءة التخطيط وتحسين المساحات', weight: 13.6, description: 'تقييم مدى كفاءة استخدام المساحات وتحسين التخطيط الداخلي والخارجي', options: [
    { score: 95, label: 'تخطيط استثنائي يعظم العائد والمساحات القابلة للبيع' },
    { score: 92, label: 'تخطيط ممتاز جداً بعائد قوي' },
    { score: 87, label: 'تخطيط قوي ومنطقي' },
    { score: 82, label: 'تخطيط جيد مع بعض التحسينات الممكنة' },
    { score: 76, label: 'تخطيط مقبول وظيفياً' },
    { score: 58, label: 'تخطيط ضعيف أو هدر ملحوظ' },
    { score: 35, label: 'تخطيط غير مناسب يؤثر على الجدوى' },
  ]},
  { id: 4, name: 'التحكم في التكاليف والوعي بالميزانية', weight: 10.7, description: 'تقييم مدى وعي الاستشاري بالتكاليف وقدرته على التصميم ضمن الميزانية', options: [
    { score: 95, label: 'قرارات تصميم تحقق أعلى جودة بأقل تكلفة — تطبيق Value Engineering فعلي' },
    { score: 91, label: 'وعي قوي جداً بالتكلفة مع بدائل واضحة' },
    { score: 85, label: 'التزام جيد بالميزانية' },
    { score: 74, label: 'التزام عام دون تحسينات قوية' },
    { score: 52, label: 'قرارات قد ترفع التكلفة دون دراسة كافية' },
    { score: 30, label: 'تجاهل واضح للميزانية — تضخم مالي خطير' },
  ]},
  { id: 5, name: 'الخبرة في مشاريع مشابهة', weight: 9.7, description: 'تقييم سجل الاستشاري في تنفيذ مشاريع مشابهة من حيث الحجم والنوع', options: [
    { score: 95, label: 'تنفيذ عدة مشاريع مماثلة بالحجم والتعقيد مثبتة النتائج' },
    { score: 89, label: 'مشروعان قريبان جداً من حيث الحجم والتعقيد' },
    { score: 82, label: 'مشروع واحد مماثل بالحجم' },
    { score: 74, label: 'خبرة في مشاريع أقل حجماً من نفس الفئة' },
    { score: 58, label: 'خبرة عامة غير مماثلة' },
    { score: 30, label: 'لا يوجد Evidence حقيقي مناسب' },
  ]},
  { id: 6, name: 'قوة فريق المشروع', weight: 9.7, description: 'تقييم كفاءة وخبرة الفريق المخصص للمشروع ومستوى القيادة', options: [
    { score: 95, label: 'فريق خبير متكامل بقيادة مباشرة من الشركاء' },
    { score: 92, label: 'فريق قوي جداً متعدد التخصصات' },
    { score: 86, label: 'فريق مكتمل وجيد' },
    { score: 80, label: 'فريق متوسط جيد' },
    { score: 74, label: 'فريق مقبول بخبرة محدودة' },
    { score: 58, label: 'نقص واضح في التخصصات أو الخبرة' },
    { score: 35, label: 'فريق غير مؤهل لإدارة مشروع بالحجم المطلوب' },
  ]},
  { id: 7, name: 'إدارة الوقت والانضباط بالبرنامج', weight: 9.7, description: 'تقييم سجل الاستشاري في الالتزام بالجداول الزمنية وسرعة الاستجابة', options: [
    { score: 95, label: 'سجل ممتاز جداً في الالتزام بالجداول الزمنية' },
    { score: 91, label: 'سجل قوي مع تأخيرات طفيفة' },
    { score: 85, label: 'التزام جيد إجمالاً' },
    { score: 74, label: 'تأخيرات محدودة يمكن السيطرة عليها' },
    { score: 55, label: 'تأخيرات متكررة' },
    { score: 30, label: 'سجل خطير في عدم الالتزام' },
  ]},
  { id: 8, name: 'الاهتمام بالمشروع', weight: 9.2, description: 'تقييم مدى اهتمام الاستشاري بالمشروع ومستوى مشاركة الإدارة العليا', options: [
    { score: 95, label: 'اعتبار المشروع أولوية قصوى — مشاركة الإدارة العليا' },
    { score: 90, label: 'اهتمام خاص واضح وتفاعل سريع' },
    { score: 82, label: 'اهتمام عادي مقبول' },
    { score: 70, label: 'تفاعل محدود أو بطيء' },
    { score: 55, label: 'ضعف واضح في الاهتمام' },
  ]},
  { id: 9, name: 'مرونة التعاقد', weight: 8.2, description: 'تقييم مرونة الاستشاري في شروط التعاقد والتعديلات والأعمال الإضافية', options: [
    { score: 95, label: 'مرونة عالية جداً واستعداد لتعديل الشروط' },
    { score: 90, label: 'مرونة جيدة' },
    { score: 82, label: 'موقف تعاقدي قياسي' },
    { score: 72, label: 'تشدد نسبي في بعض البنود' },
    { score: 60, label: 'جمود واضح وصعوبة تفاوض' },
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
                const bgColor = opt.score >= 85 ? 'bg-emerald-50 border-emerald-200' : opt.score >= 70 ? 'bg-amber-50 border-amber-200' : opt.score >= 50 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';
                return (
                  <div key={opt.score} className={`p-3 rounded-xl border ${bgColor}`}>
                    <span className="font-bold text-blue-700 inline-block min-w-[3rem]">{opt.score}%</span>
                    <span className="text-sm text-slate-700 mr-2">{opt.label}</span>
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
  // Value Analysis weights (Item 5: adjustable T%/F%)
  const [technicalWeight, setTechnicalWeight] = useState(80);
  const financialWeight = 100 - technicalWeight;
  const [showValueFormulas, setShowValueFormulas] = useState(false);

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

  // Value Analysis (Item 5: Financial Score + Adjusted Financial Score + Value Score)
  const valueAnalysis = useMemo(() => {
    const fees = Object.entries(financialTotals).filter(([_, v]) => v > 0);
    if (fees.length === 0) return { lowestFee: 0, consultants: {} as Record<number, { financialScore: number; penalty: number; adjustedFinancialScore: number; valueScore: number }> };

    const lowestFee = Math.min(...fees.map(([_, v]) => v));
    const result: Record<number, { financialScore: number; penalty: number; adjustedFinancialScore: number; valueScore: number }> = {};

    fees.forEach(([id, fee]) => {
      // Financial Score = (Lowest Fee / Consultant Fee) × 100
      const financialScore = (lowestFee / fee) * 100;

      // Penalty from fee deviation zones (in points, not percentage)
      const dev = feeDeviations.consultants[parseInt(id)];
      let penalty = 0;
      if (dev) {
        if (dev.zone === 'extreme_high') penalty = 15;
        else if (dev.zone === 'moderate_high') penalty = 7;
        // extreme_low and normal: no penalty
      }

      // Adjusted Financial Score = Financial Score - Penalty
      const adjustedFinancialScore = Math.max(0, financialScore - penalty);

      // Technical Score for this consultant
      const techScore = consultantScores[parseInt(id)]?.weighted || 0;

      // Value Score = (Technical Score × T%) + (Adjusted Financial Score × F%)
      const valueScore = (techScore * technicalWeight / 100) + (adjustedFinancialScore * financialWeight / 100);

      result[parseInt(id)] = {
        financialScore: Math.round(financialScore * 10) / 10,
        penalty,
        adjustedFinancialScore: Math.round(adjustedFinancialScore * 10) / 10,
        valueScore: Math.round(valueScore * 10) / 10,
      };
    });

    return { lowestFee, consultants: result };
  }, [financialTotals, feeDeviations, consultantScores, technicalWeight, financialWeight]);

  // Value Rankings (sorted by Value Score)
  const valueRankings = useMemo(() => {
    return [...rankings].map(r => ({
      ...r,
      financialScore: valueAnalysis.consultants[r.id]?.financialScore || 0,
      penalty: valueAnalysis.consultants[r.id]?.penalty || 0,
      adjustedFinancialScore: valueAnalysis.consultants[r.id]?.adjustedFinancialScore || 0,
      valueScore: valueAnalysis.consultants[r.id]?.valueScore || 0,
    })).sort((a, b) => b.valueScore - a.valueScore);
  }, [rankings, valueAnalysis]);

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
              <TabsList className="grid w-full grid-cols-4 mb-6 h-14 bg-white shadow-lg rounded-xl border-0">
                <TabsTrigger value="evaluation" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                  التقييم الفني
                </TabsTrigger>
                <TabsTrigger value="financial" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg">
                  <DollarSign className="w-4 h-4" />
                  الأتعاب المالية
                </TabsTrigger>
                <TabsTrigger value="value" className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg">
                  <Scale className="w-4 h-4" />
                  تحليل القيمة
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
                                            {criterion.options.map((option) => (
                                                <SelectItem key={option.score} value={option.score.toString()} className="whitespace-normal text-sm leading-relaxed py-3">
                                                  <span>
                                                    <span className="font-bold text-blue-700 inline-block whitespace-nowrap">{option.score}%</span>
                                                    {' — '}{option.label}
                                                  </span>
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
                                    {CRITERIA[currentCriterionIdx].options.map((option) => (
                                        <SelectItem key={option.score} value={option.score.toString()} className="whitespace-normal text-sm leading-relaxed py-3">
                                          <span>
                                            <span className="font-bold text-blue-700 inline-block whitespace-nowrap">{option.score}%</span>
                                            {' — '}{option.label}
                                          </span>
                                        </SelectItem>
                                    ))}
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
                                  {consultantScores[consultant.id]?.weighted.toFixed(1) || 0}%
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
                                <Fragment key={consultant.id}>
                                  <FinancialRow
                                    consultant={consultant}
                                    fin={fin}
                                    selectedProjectId={selectedProjectId!}
                                    constructionCost={buildingCost}
                                    updateFinancialMutation={updateFinancialMutation}
                                    onTotalChange={() => {}}
                                  />
                                </Fragment>
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

              {/* ============ VALUE ANALYSIS TAB (Item 5) ============ */}
              <TabsContent value="value">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                        <Scale className="w-5 h-5 text-cyan-600" />
                        تحليل القيمة (مرجع فقط — ليس ملزماً)
                      </CardTitle>
                      <button onClick={() => setShowValueFormulas(!showValueFormulas)} className="flex items-center gap-1.5 text-xs text-cyan-700 bg-cyan-100 hover:bg-cyan-200 px-3 py-1.5 rounded-lg border border-cyan-300 transition-colors">
                        <Calculator className="w-3.5 h-3.5" />
                        {showValueFormulas ? 'إخفاء المعادلات' : 'عرض المعادلات'}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Philosophy Notice */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200 mb-6">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-amber-900 mb-1">تنبيه مهم</p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            تحليل القيمة هو <span className="font-bold">مرجع استرشادي فقط</span> ولا يُلزم اللجنة باتخاذ أي قرار بناءً عليه.
                            حتى لو رتّب Value Score الاستشاري (أ) أولاً، يمكن للجنة اختيار الاستشاري (ب) مع توثيق المبررات.
                            الهدف هو تقديم صورة شفافة عن العلاقة بين الجودة والتكلفة.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Formulas Section */}
                    {showValueFormulas && (
                      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-5 rounded-xl border border-slate-200 mb-6">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-slate-600" />
                          المعادلات المستخدمة
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <p className="font-mono text-blue-800 font-bold">Financial Score = (Lowest Fee ÷ Consultant Fee) × 100</p>
                            <p className="text-slate-500 text-xs mt-1">كلما كانت الأتعاب أقرب لأقل عرض، كلما ارتفعت الدرجة المالية</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <p className="font-mono text-purple-800 font-bold">Adjusted Financial Score = Financial Score − Penalty</p>
                            <p className="text-slate-500 text-xs mt-1">العقوبة تُطبق فقط على الدرجة المالية (لا تمس الدرجة الفنية أبداً)</p>
                            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                              <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded text-center">
                                <p className="font-bold text-emerald-700">طبيعي</p>
                                <p className="text-emerald-600">0 نقطة</p>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 p-1.5 rounded text-center">
                                <p className="font-bold text-amber-700">مرتفع معتدل</p>
                                <p className="text-amber-600">−7 نقاط</p>
                              </div>
                              <div className="bg-red-50 border border-red-200 p-1.5 rounded text-center">
                                <p className="font-bold text-red-700">مرتفع شديد</p>
                                <p className="text-red-600">−15 نقطة</p>
                              </div>
                              <div className="bg-blue-50 border border-blue-200 p-1.5 rounded text-center">
                                <p className="font-bold text-blue-700">منخفض شديد</p>
                                <p className="text-blue-600">0 + تحذير</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border-2 border-cyan-200">
                            <p className="font-mono text-cyan-800 font-bold">Value Score = (Technical × {technicalWeight}%) + (Adjusted Financial × {financialWeight}%)</p>
                            <p className="text-slate-500 text-xs mt-1">مؤشر مركب يجمع الجودة والتكلفة — الأوزان قابلة للتعديل أدناه</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weight Adjustment Slider */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-5 rounded-xl border border-cyan-200 mb-6">
                      <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
                        أوزان تحليل القيمة
                      </h4>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-bold text-blue-700">الجودة الفنية: {technicalWeight}%</span>
                            <span className="text-sm font-bold text-emerald-700">الانضباط المالي: {financialWeight}%</span>
                          </div>
                          <Slider
                            value={[technicalWeight]}
                            onValueChange={(v) => setTechnicalWeight(v[0])}
                            min={30}
                            max={90}
                            step={5}
                            className="w-full"
                          />
                          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                            <span>30%</span>
                            <span>50%</span>
                            <span>65% (افتراضي)</span>
                            <span>80%</span>
                            <span>90%</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setTechnicalWeight(80)} className="text-xs whitespace-nowrap">
                          إعادة للافتراضي
                        </Button>
                      </div>
                    </div>

                    {/* No financial data warning */}
                    {Object.keys(valueAnalysis.consultants).length === 0 && (
                      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                        <DollarSign className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 text-lg font-semibold">لا توجد بيانات مالية بعد</p>
                        <p className="text-slate-400 text-sm mt-1">أدخل الأتعاب في تبويب "الأتعاب المالية" أولاً</p>
                      </div>
                    )}

                    {/* Value Analysis Table */}
                    {Object.keys(valueAnalysis.consultants).length > 0 && (
                      <>
                        <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg mb-6">
                          <table className="border-collapse w-full min-w-[900px]">
                            <thead>
                              <tr className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white">
                                <th className="border border-cyan-700 p-3 text-right text-sm font-bold" style={{ width: '14%' }}>الاستشاري</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '12%' }}>الدرجة الفنية</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '12%' }}>الأتعاب</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '12%' }}>الدرجة المالية</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '8%' }}>العقوبة</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '14%' }}>المالية المعدلة</th>
                                <th className="border border-cyan-700 p-3 text-center text-sm font-bold bg-cyan-700" style={{ width: '14%' }}>Value Score</th>
                                <th className="border border-cyan-700 p-3 text-center text-xs font-bold" style={{ width: '8%' }}>الترتيب</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {valueRankings.map((r, idx) => {
                                const dev = feeDeviations.consultants[r.id];
                                return (
                                  <tr key={r.id} className={`border-b transition-colors ${
                                    idx === 0 ? 'bg-gradient-to-r from-cyan-50 to-blue-50' : 'hover:bg-slate-50'
                                  }`}>
                                    <td className="border border-slate-200 p-3 text-right font-bold text-slate-800">{r.name}</td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-100 text-blue-800">
                                        {r.technicalScore.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      <div className="text-sm font-bold text-slate-700">{r.totalFee.toLocaleString()}</div>
                                      <div className="text-[10px] text-slate-400">AED</div>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-800">
                                        {r.financialScore.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      {r.penalty > 0 ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700">
                                          −{r.penalty}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                                        r.penalty > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {r.adjustedFinancialScore.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center bg-gradient-to-r from-cyan-50 to-blue-50">
                                      <span className="text-xl font-bold text-cyan-700">{r.valueScore.toFixed(1)}</span>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-center">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto shadow-md ${
                                        idx === 0 ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' :
                                        idx === 1 ? 'bg-gradient-to-br from-slate-400 to-gray-500 text-white' :
                                        'bg-slate-200 text-slate-600'
                                      }`}>{idx + 1}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Lowest Fee Reference */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-6 text-sm text-slate-600">
                          <span className="font-semibold">أقل أتعاب (مرجع الحساب):</span> {valueAnalysis.lowestFee.toLocaleString()} AED
                          <span className="mx-2">|</span>
                          <span className="font-semibold">متوسط الأتعاب:</span> {feeDeviations.average.toLocaleString()} AED
                        </div>

                        {/* Visual Comparison Cards */}
                        <h4 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <Eye className="w-5 h-5 text-cyan-600" />
                          المقارنة البصرية
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          {valueRankings.map((r, idx) => {
                            const dev = feeDeviations.consultants[r.id];
                            const maxValueScore = valueRankings[0]?.valueScore || 1;
                            const barWidth = (r.valueScore / maxValueScore) * 100;
                            return (
                              <div key={r.id} className={`bg-white p-4 rounded-2xl border-2 shadow-md transition-all hover:shadow-lg ${
                                idx === 0 ? 'border-cyan-400 ring-2 ring-cyan-200' : 'border-slate-200'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      idx === 0 ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-600'
                                    }`}>{idx + 1}</div>
                                    <h5 className="font-bold text-slate-800 text-sm">{r.name}</h5>
                                  </div>
                                  {dev?.flag && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      dev.zone === 'extreme_high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                    }`}>{dev.flag}</span>
                                  )}
                                </div>
                                {/* Value Score Bar */}
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">Value Score</span>
                                    <span className="font-bold text-cyan-700">{r.valueScore.toFixed(1)}</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                                  </div>
                                </div>
                                {/* Breakdown */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-blue-50 p-2 rounded-lg text-center">
                                    <p className="text-blue-500 font-medium">فني</p>
                                    <p className="text-blue-800 font-bold text-sm">{r.technicalScore.toFixed(1)}</p>
                                    <p className="text-blue-400 text-[10px]">× {technicalWeight}%</p>
                                  </div>
                                  <div className="bg-emerald-50 p-2 rounded-lg text-center">
                                    <p className="text-emerald-500 font-medium">مالي معدل</p>
                                    <p className="text-emerald-800 font-bold text-sm">{r.adjustedFinancialScore.toFixed(1)}</p>
                                    <p className="text-emerald-400 text-[10px]">× {financialWeight}%</p>
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                                  <span>الأتعاب: {r.totalFee.toLocaleString()} AED</span>
                                  {r.penalty > 0 && <span className="text-red-500 font-bold">عقوبة: −{r.penalty}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Trade-off Analysis */}
                        {valueRankings.length >= 2 && (
                          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-200">
                            <h4 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              تحليل المقايضات
                            </h4>
                            <div className="space-y-3 text-sm text-indigo-700">
                              {(() => {
                                const techBest = [...valueRankings].sort((a, b) => b.technicalScore - a.technicalScore)[0];
                                const feeBest = [...valueRankings].sort((a, b) => a.totalFee - b.totalFee)[0];
                                const valueBest = valueRankings[0];
                                const insights: string[] = [];

                                if (techBest.id === feeBest.id) {
                                  insights.push(`✅ ${techBest.name} هو الأعلى فنياً والأقل تكلفة — لا مقايضة مطلوبة.`);
                                } else {
                                  const techDiff = techBest.technicalScore - feeBest.technicalScore;
                                  const feeDiff = techBest.totalFee - feeBest.totalFee;
                                  insights.push(`📊 الأعلى فنياً: ${techBest.name} (${techBest.technicalScore.toFixed(1)}) — الأقل تكلفة: ${feeBest.name} (${feeBest.totalFee.toLocaleString()} AED)`);
                                  insights.push(`⚖️ فرق الجودة: ${techDiff.toFixed(1)}% — فرق التكلفة: ${Math.abs(feeDiff).toLocaleString()} AED`);
                                  if (techDiff > 5 && feeDiff > 0) {
                                    insights.push(`💡 الفارق الفني (${techDiff.toFixed(1)}%) ملحوظ. اختيار الأقل تكلفة يعني التنازل عن جودة واضحة.`);
                                  } else if (techDiff <= 2 && feeDiff > 0) {
                                    insights.push(`💡 الفارق الفني ضئيل (${techDiff.toFixed(1)}%). الأقل تكلفة قد يكون خياراً عملياً.`);
                                  }
                                }

                                if (valueBest.id !== techBest.id) {
                                  insights.push(`📈 تحليل القيمة يرتب ${valueBest.name} أولاً بينما الأعلى فنياً هو ${techBest.name}. هذا يعني أن الميزة المالية لـ ${valueBest.name} تعوض الفارق الفني.`);
                                }

                                // Check for extreme deviations
                                valueRankings.forEach(r => {
                                  const dev = feeDeviations.consultants[r.id];
                                  if (dev?.zone === 'extreme_high') {
                                    insights.push(`⚠️ ${r.name}: أتعاب مرتفعة جداً (+${dev.deviation}%). يجب التفاوض قبل الاعتماد.`);
                                  }
                                  if (dev?.zone === 'extreme_low') {
                                    insights.push(`⚠️ ${r.name}: أتعاب منخفضة جداً (${dev.deviation}%). يجب التحقق من شمولية نطاق العمل.`);
                                  }
                                });

                                return insights.map((insight, i) => (
                                  <p key={i} className="leading-relaxed">{insight}</p>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* ============ PERFORMANCE COMPARISON CHARTS ============ */}
                {valueRankings.length > 0 && (
                  <Card className="shadow-xl border-0 mt-6">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b">
                      <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        مقارنة الأداء الفني والمالي — رسوم بيانية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">

                      {/* === 1. Grouped Bar Chart: Technical vs Financial vs Value Score === */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                          <Target className="w-4 h-4 text-indigo-500" />
                          مقارنة الدرجات: الفنية — المالية — القيمة المركبة
                        </h4>
                        <p className="text-xs text-slate-500 mb-4">كل عمود يمثل درجة الاستشاري في المحور المحدد (من 100)</p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4" style={{ direction: 'ltr' }}>
                          <ResponsiveContainer width="100%" height={Math.max(320, valueRankings.length * 60)}>
                            <BarChart
                              data={valueRankings.map(r => ({
                                name: r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name,
                                fullName: r.name,
                                technical: Math.round(r.technicalScore * 10) / 10,
                                financial: r.adjustedFinancialScore,
                                value: r.valueScore,
                              }))}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                              <RechartsTooltip
                                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', direction: 'rtl', textAlign: 'right' }}
                                formatter={(value: number, name: string) => {
                                  const labels: Record<string, string> = { technical: 'الدرجة الفنية', financial: 'الدرجة المالية المعدلة', value: 'درجة القيمة المركبة' };
                                  return [`${value}%`, labels[name] || name];
                                }}
                                labelFormatter={(label) => {
                                  const item = valueRankings.find(r => (r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name) === label);
                                  return item?.name || label;
                                }}
                              />
                              <Legend
                                formatter={(value: string) => {
                                  const labels: Record<string, string> = { technical: 'الدرجة الفنية', financial: 'المالية المعدلة', value: 'القيمة المركبة' };
                                  return <span style={{ fontSize: 12, color: '#475569' }}>{labels[value] || value}</span>;
                                }}
                              />
                              <Bar dataKey="technical" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={14} name="technical" />
                              <Bar dataKey="financial" fill="#10b981" radius={[0, 6, 6, 0]} barSize={14} name="financial" />
                              <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={14} name="value" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* === 2. Radar Chart: Technical Criteria Breakdown === */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                          <Star className="w-4 h-4 text-purple-500" />
                          البصمة الفنية — مقارنة المعايير التسعة
                        </h4>
                        <p className="text-xs text-slate-500 mb-4">كل محور يمثل معياراً فنياً — المساحة الأكبر تعني أداءً أشمل</p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4" style={{ direction: 'ltr' }}>
                          <ResponsiveContainer width="100%" height={420}>
                            <RadarChart
                              data={CRITERIA.map((criterion, idx) => {
                                const entry: Record<string, any> = {
                                  criterion: criterion.name.length > 12 ? criterion.name.substring(0, 12) + '…' : criterion.name,
                                  fullName: criterion.name,
                                  weight: criterion.weight,
                                };
                                valueRankings.forEach(r => {
                                  const scores = consultantScores[r.id];
                                  entry[r.name] = scores ? Math.round(scores.scores[idx] * 10) / 10 : 0;
                                });
                                return entry;
                              })}
                            >
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis
                                dataKey="criterion"
                                tick={{ fontSize: 10, fill: '#475569' }}
                              />
                              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                              <RechartsTooltip
                                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', direction: 'rtl', textAlign: 'right' }}
                                formatter={(value: number, name: string) => [`${value}%`, name]}
                                labelFormatter={(label) => {
                                  const item = CRITERIA.find(c => (c.name.length > 12 ? c.name.substring(0, 12) + '…' : c.name) === label);
                                  return item ? `${item.name} (وزن: ${item.weight}%)` : label;
                                }}
                              />
                              <Legend
                                formatter={(value: string) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>}
                              />
                              {(() => {
                                const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
                                return valueRankings.map((r, i) => (
                                  <Radar
                                    key={r.id}
                                    name={r.name}
                                    dataKey={r.name}
                                    stroke={colors[i % colors.length]}
                                    fill={colors[i % colors.length]}
                                    fillOpacity={0.12}
                                    strokeWidth={2}
                                  />
                                ));
                              })()}
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* === 3. Scatter Chart: Quality vs Cost === */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-teal-500" />
                          خريطة الجودة مقابل التكلفة
                        </h4>
                        <p className="text-xs text-slate-500 mb-4">الموقع الأمثل: أعلى يسار (جودة عالية + تكلفة منخفضة)</p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4" style={{ direction: 'ltr' }}>
                          <ResponsiveContainer width="100%" height={380}>
                            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                type="number"
                                dataKey="fee"
                                name="الأتعاب"
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                                label={{ value: 'إجمالي الأتعاب (AED)', position: 'bottom', offset: 0, style: { fontSize: 11, fill: '#64748b' } }}
                              />
                              <YAxis
                                type="number"
                                dataKey="technical"
                                name="الدرجة الفنية"
                                domain={[0, 100]}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                label={{ value: 'الدرجة الفنية %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                              />
                              <ZAxis type="number" dataKey="value" range={[200, 600]} name="القيمة" />
                              <RechartsTooltip
                                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', direction: 'rtl', textAlign: 'right' }}
                                content={({ payload }) => {
                                  if (!payload || payload.length === 0) return null;
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg text-right" dir="rtl">
                                      <p className="font-bold text-sm text-slate-800 mb-2">{d.name}</p>
                                      <p className="text-xs text-slate-600">الدرجة الفنية: <span className="font-bold text-indigo-600">{d.technical}%</span></p>
                                      <p className="text-xs text-slate-600">الأتعاب: <span className="font-bold text-emerald-600">{d.fee?.toLocaleString()} AED</span></p>
                                      <p className="text-xs text-slate-600">درجة القيمة: <span className="font-bold text-amber-600">{d.value}%</span></p>
                                      <p className="text-xs mt-1 text-slate-500">منطقة الانحراف: <span className={`font-bold ${d.zone === 'normal' ? 'text-emerald-600' : d.zone === 'moderate_high' ? 'text-amber-600' : 'text-red-600'}`}>{d.zoneLabel}</span></p>
                                    </div>
                                  );
                                }}
                              />
                              {/* Average fee reference line */}
                              {feeDeviations.average > 0 && (
                                <ReferenceLine x={feeDeviations.average} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'متوسط الأتعاب', position: 'top', style: { fontSize: 10, fill: '#94a3b8' } }} />
                              )}
                              <Scatter
                                data={valueRankings.map(r => ({
                                  name: r.name,
                                  fee: r.totalFee,
                                  technical: Math.round(r.technicalScore * 10) / 10,
                                  value: r.valueScore,
                                  zone: feeDeviations.consultants[r.id]?.zone || 'normal',
                                  zoneLabel: feeDeviations.consultants[r.id]?.zoneLabel || 'طبيعي',
                                }))}
                              >
                                {valueRankings.map((r, i) => {
                                  const zone = feeDeviations.consultants[r.id]?.zone || 'normal';
                                  const color = zone === 'normal' ? '#10b981' : zone === 'moderate_high' ? '#f59e0b' : zone === 'extreme_high' ? '#ef4444' : zone === 'extreme_low' ? '#3b82f6' : '#6366f1';
                                  return <Cell key={r.id} fill={color} stroke={color} strokeWidth={2} />;
                                })}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                          {/* Legend for scatter colors */}
                          <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> النطاق الطبيعي</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> انحراف معتدل</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> انحراف مرتفع</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> انحراف منخفض</span>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                )}
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
                                    <p className="text-sm text-slate-600">فني: <span className="font-bold text-blue-700">{r.technicalScore.toFixed(1)}%</span></p>
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
