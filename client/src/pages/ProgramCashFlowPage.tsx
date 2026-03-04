import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CalendarDays, Plus, Trash2, Edit, DollarSign, TrendingDown, TrendingUp,
  BarChart3, ArrowRight, Building2, Layers, Settings2, FolderOpen,
  ChevronLeft, Save, RefreshCw, Download, AlertTriangle, CheckCircle2,
  Clock, Landmark, Briefcase, Hammer, Eye, FileText, Percent
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface PaymentParams {
  paymentMonth?: number;
  milestones?: Array<{ percent: number; description: string; monthOffset: number }>;
  startMonth?: number;
  endMonth?: number;
  mobilizationPct?: number;
  progressDistribution?: 'linear' | 'scurve';
  retentionPct?: number;
  retentionReleaseMonth?: number;
  salesPct?: number;
  salesTiming?: 'booking' | 'construction' | 'handover';
}

const CATEGORY_LABELS: Record<string, string> = {
  land: 'الأرض',
  consultant_design: 'أتعاب التصميم',
  authority_fees: 'رسوم حكومية',
  contractor: 'المقاول الرئيسي',
  supervision: 'الإشراف',
  marketing_sales: 'التسويق والبيع',
  developer_fee: 'أتعاب المطور',
  contingency: 'احتياطي',
  other: 'أخرى',
};

const CATEGORY_COLORS: Record<string, string> = {
  land: '#059669',
  consultant_design: '#2563eb',
  authority_fees: '#7c3aed',
  contractor: '#dc2626',
  supervision: '#ea580c',
  marketing_sales: '#0891b2',
  developer_fee: '#ca8a04',
  contingency: '#6b7280',
  other: '#9333ea',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  lump_sum: 'دفعة واحدة',
  milestone: 'مراحل إنجاز',
  monthly_fixed: 'شهري ثابت',
  progress_based: 'حسب التقدم (مقاول)',
  sales_linked: 'مرتبط بالمبيعات',
};

const formatAED = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

const formatAEDFull = (n: number) => new Intl.NumberFormat('en-AE').format(Math.round(n));

// ═══════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════

export default function ProgramCashFlowPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);

  const projectsQuery = trpc.cashFlowProgram.listProjects.useQuery();
  const existingProjects = trpc.projects.getAll.useQuery();

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        cfProjectId={selectedProjectId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedScenarioId={selectedScenarioId}
        setSelectedScenarioId={setSelectedScenarioId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">برنامج العمل والتدفقات النقدية</h1>
              <p className="text-emerald-100 mt-1">Program & Cash Flow</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-emerald-700">المشاريع</p>
                  <p className="text-2xl font-bold text-emerald-900">{projectsQuery.data?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-700">إجمالي التكاليف</p>
                  <p className="text-2xl font-bold text-blue-900">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-amber-700">أقصى تعرض</p>
                  <p className="text-2xl font-bold text-amber-900">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-700">عرض المحفظة</p>
                  <Button variant="link" className="p-0 h-auto text-purple-600" onClick={() => setActiveTab("portfolio")}>
                    عرض التفاصيل
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">المشاريع</h2>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 ml-2" />
                مشروع جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" dir="rtl">
              <CreateProjectDialog
                existingProjects={existingProjects.data || []}
                onCreated={(id) => {
                  setShowCreateDialog(false);
                  projectsQuery.refetch();
                  setSelectedProjectId(id);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 pb-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projectsQuery.data?.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="py-16 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">لا توجد مشاريع بعد</h3>
              <p className="text-gray-400 mb-4">أنشئ مشروعاً جديداً لبدء تخطيط التدفقات النقدية</p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 ml-2" />
                إنشاء أول مشروع
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsQuery.data?.map(project => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-emerald-300 group"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setActiveTab("timeline");
                }}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors rotate-180" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">بداية: {project.startDate}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 ml-1" />
                      {project.designApprovalMonths + project.reraSetupMonths + project.constructionMonths + project.handoverMonths} شهر
                    </Badge>
                    {project.salesEnabled && (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                        <TrendingUp className="w-3 h-3 ml-1" />
                        مبيعات مفعّلة
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Create Project Dialog
// ═══════════════════════════════════════════════════════════════

function CreateProjectDialog({
  existingProjects,
  onCreated,
}: {
  existingProjects: any[];
  onCreated: (id: number) => void;
}) {
  const [mode, setMode] = useState<'manual' | 'feasibility'>('feasibility');
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("2026-01");
  const [linkedProjectId, setLinkedProjectId] = useState<string>("none");
  const [designMonths, setDesignMonths] = useState(6);
  const [reraMonths, setReraMonths] = useState(3);
  const [constructionMonths, setConstructionMonths] = useState(24);
  const [handoverMonths, setHandoverMonths] = useState(3);
  const [selectedFeasibilityId, setSelectedFeasibilityId] = useState<string>("none");

  const feasibilityStudies = trpc.feasibility.list.useQuery();
  const createMutation = trpc.cashFlowProgram.createProject.useMutation();
  const createFromFeasMutation = trpc.cashFlowProgram.createFromFeasibility.useMutation();

  // When a feasibility study is selected, auto-fill the name
  const selectedStudy = feasibilityStudies.data?.find(s => s.id.toString() === selectedFeasibilityId);

  const handleCreate = async () => {
    if (mode === 'feasibility') {
      if (selectedFeasibilityId === 'none' || !selectedStudy) {
        toast.error("يرجى اختيار دراسة جدوى");
        return;
      }
      try {
        const result = await createFromFeasMutation.mutateAsync({
          feasibilityStudyId: parseInt(selectedFeasibilityId),
          startDate,
          designApprovalMonths: designMonths,
          reraSetupMonths: reraMonths,
          constructionMonths,
          handoverMonths,
        });
        toast.success(
          `تم إنشاء المشروع واستيراد ${result.costItemsCount} بند تكلفة تلقائياً`,
          { description: `إجمالي التكاليف: ${formatAEDFull(result.totalCost)} AED` }
        );
        onCreated(result.cfProjectId);
      } catch (e: any) {
        toast.error(e.message || "فشل في إنشاء المشروع");
      }
    } else {
      if (!name.trim()) {
        toast.error("يرجى إدخال اسم المشروع");
        return;
      }
      try {
        const result = await createMutation.mutateAsync({
          name: name.trim(),
          startDate,
          projectId: linkedProjectId !== "none" ? parseInt(linkedProjectId) : null,
          designApprovalMonths: designMonths,
          reraSetupMonths: reraMonths,
          constructionMonths,
          handoverMonths,
        });
        toast.success("تم إنشاء المشروع بنجاح");
        onCreated(result.id);
      } catch (e: any) {
        toast.error(e.message || "فشل في إنشاء المشروع");
      }
    }
  };

  const isPending = createMutation.isPending || createFromFeasMutation.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>مشروع تدفق نقدي جديد</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('feasibility')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
              mode === 'feasibility'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            استيراد من دراسة جدوى
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
              mode === 'manual'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <Edit className="w-4 h-4" />
            إدخال يدوي
          </button>
        </div>

        {mode === 'feasibility' ? (
          <>
            {/* Feasibility Study Selector */}
            <div>
              <Label className="text-sm font-semibold">اختر دراسة الجدوى *</Label>
              <Select value={selectedFeasibilityId} onValueChange={setSelectedFeasibilityId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر دراسة جدوى..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">اختر دراسة جدوى...</SelectItem>
                  {(feasibilityStudies.data || []).map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.projectName}{s.scenarioName ? ` (${s.scenarioName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview of selected study */}
            {selectedStudy && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  سيتم استيراد التكاليف تلقائياً
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  {selectedStudy.landPrice ? (
                    <div>الأرض: <span className="font-medium text-gray-900">{formatAEDFull(selectedStudy.landPrice)} AED</span></div>
                  ) : null}
                  {selectedStudy.constructionCostPerSqft && selectedStudy.estimatedBua ? (
                    <div>البناء: <span className="font-medium text-gray-900">{formatAEDFull(selectedStudy.estimatedBua * selectedStudy.constructionCostPerSqft)} AED</span></div>
                  ) : null}
                  {selectedStudy.numberOfUnits ? (
                    <div>الوحدات: <span className="font-medium text-gray-900">{selectedStudy.numberOfUnits}</span></div>
                  ) : null}
                  {selectedStudy.plotArea ? (
                    <div>مساحة الأرض: <span className="font-medium text-gray-900">{formatAEDFull(selectedStudy.plotArea)} sqft</span></div>
                  ) : null}
                  {selectedStudy.designFeePct ? (
                    <div>التصميم: <span className="font-medium text-gray-900">{selectedStudy.designFeePct}%</span></div>
                  ) : null}
                  {selectedStudy.supervisionFeePct ? (
                    <div>الإشراف: <span className="font-medium text-gray-900">{selectedStudy.supervisionFeePct}%</span></div>
                  ) : null}
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">
                  سيتم إنشاء بنود التكلفة مع منطق الدفع المناسب لكل بند (أرض: دفعة واحدة، تصميم: مراحل، مقاول: حسب التقدم، ...)
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Manual mode */}
            <div>
              <Label>اسم المشروع *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: مركز مجان التجاري" />
            </div>
            {existingProjects.length > 0 && (
              <div>
                <Label>ربط بمشروع قائم (اختياري)</Label>
                <Select value={linkedProjectId} onValueChange={setLinkedProjectId}>
                  <SelectTrigger><SelectValue placeholder="اختر مشروع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون ربط</SelectItem>
                    {existingProjects.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        <Separator />

        {/* Common fields: start date and phase durations */}
        <div>
          <Label>تاريخ البداية</Label>
          <Input type="month" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <p className="text-sm font-semibold text-gray-700">مدة المراحل (بالأشهر)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">التصميم والموافقات</Label>
            <Input type="number" min={1} value={designMonths} onChange={e => setDesignMonths(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <Label className="text-xs">تسجيل ريرا والمبيعات</Label>
            <Input type="number" min={1} value={reraMonths} onChange={e => setReraMonths(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <Label className="text-xs">البناء</Label>
            <Input type="number" min={1} value={constructionMonths} onChange={e => setConstructionMonths(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <Label className="text-xs">التسليم</Label>
            <Input type="number" min={1} value={handoverMonths} onChange={e => setHandoverMonths(parseInt(e.target.value) || 1)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">إلغاء</Button>
        </DialogClose>
        <Button onClick={handleCreate} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
          {isPending ? "جاري الإنشاء..." : mode === 'feasibility' ? "إنشاء واستيراد التكاليف" : "إنشاء"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Project Detail View
// ═══════════════════════════════════════════════════════════════

function ProjectDetailView({
  cfProjectId,
  activeTab,
  setActiveTab,
  selectedScenarioId,
  setSelectedScenarioId,
  onBack,
}: {
  cfProjectId: number;
  activeTab: string;
  setActiveTab: (t: string) => void;
  selectedScenarioId: number | null;
  setSelectedScenarioId: (id: number | null) => void;
  onBack: () => void;
}) {
  const projectQuery = trpc.cashFlowProgram.getProject.useQuery(cfProjectId);
  const costItemsQuery = trpc.cashFlowProgram.getCostItems.useQuery(cfProjectId);
  const scenariosQuery = trpc.cashFlowProgram.getScenarios.useQuery(cfProjectId);
  const cashFlowQuery = trpc.cashFlowProgram.calculateCashFlow.useQuery({
    cfProjectId,
    scenarioId: selectedScenarioId,
  });

  const project = projectQuery.data;
  const costItems = costItemsQuery.data || [];
  const cashFlow = cashFlowQuery.data;

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalDuration = project.designApprovalMonths + project.reraSetupMonths + project.constructionMonths + project.handoverMonths;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-white hover:bg-white/20">
              <ChevronLeft className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-emerald-100">
                <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {project.startDate}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {totalDuration} شهر</span>
              </div>
            </div>
            {cashFlow?.keyNumbers && (
              <div className="flex gap-4">
                <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                  <p className="text-xs text-emerald-200">إجمالي التكاليف</p>
                  <p className="text-lg font-bold">{formatAED(cashFlow.keyNumbers.totalCost)} د.إ</p>
                </div>
                <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                  <p className="text-xs text-emerald-200">أقصى تعرض</p>
                  <p className="text-lg font-bold text-amber-300">{formatAED(cashFlow.keyNumbers.peakExposure)} د.إ</p>
                </div>
                {cashFlow.keyNumbers.totalSales > 0 && (
                  <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                    <p className="text-xs text-emerald-200">صافي الربح</p>
                    <p className={`text-lg font-bold ${cashFlow.keyNumbers.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {formatAED(cashFlow.keyNumbers.netProfit)} د.إ
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="timeline" className="flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              الجدول الزمني
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              هيكل التكاليف
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              التدفق النقدي
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="flex items-center gap-1">
              <Settings2 className="w-4 h-4" />
              السيناريوهات
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              لوحة الأرقام
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <TimelineTab project={project} onRefresh={() => {
              projectQuery.refetch();
              cashFlowQuery.refetch();
            }} />
          </TabsContent>

          <TabsContent value="costs">
            <CostStructureTab
              cfProjectId={cfProjectId}
              costItems={costItems}
              onRefresh={() => {
                costItemsQuery.refetch();
                cashFlowQuery.refetch();
              }}
              project={project}
            />
          </TabsContent>

          <TabsContent value="cashflow">
            <CashFlowTab cashFlow={cashFlow} costItems={costItems} isLoading={cashFlowQuery.isLoading} />
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenariosTab
              cfProjectId={cfProjectId}
              scenarios={scenariosQuery.data || []}
              selectedScenarioId={selectedScenarioId}
              onSelectScenario={(id) => {
                setSelectedScenarioId(id);
                cashFlowQuery.refetch();
              }}
              onRefresh={() => scenariosQuery.refetch()}
            />
          </TabsContent>

          <TabsContent value="dashboard">
            <DashboardTab cashFlow={cashFlow} project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Timeline Tab - Gantt Chart
// ═══════════════════════════════════════════════════════════════

function TimelineTab({ project, onRefresh }: { project: any; onRefresh: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState(project.startDate);
  const [editDesign, setEditDesign] = useState(project.designApprovalMonths);
  const [editRera, setEditRera] = useState(project.reraSetupMonths);
  const [editConstruction, setEditConstruction] = useState(project.constructionMonths);
  const [editHandover, setEditHandover] = useState(project.handoverMonths);

  const updateMutation = trpc.cashFlowProgram.updateProject.useMutation();

  // Sync local state when project data changes
  useEffect(() => {
    setEditStartDate(project.startDate);
    setEditDesign(project.designApprovalMonths);
    setEditRera(project.reraSetupMonths);
    setEditConstruction(project.constructionMonths);
    setEditHandover(project.handoverMonths);
  }, [project]);

  const displayDesign = isEditing ? editDesign : project.designApprovalMonths;
  const displayRera = isEditing ? editRera : project.reraSetupMonths;
  const displayConstruction = isEditing ? editConstruction : project.constructionMonths;
  const displayHandover = isEditing ? editHandover : project.handoverMonths;
  const displayStartDate = isEditing ? editStartDate : project.startDate;

  const totalDuration = displayDesign + displayRera + displayConstruction + displayHandover;

  const phases = [
    { name: 'التصميم والموافقات', months: displayDesign, color: 'bg-blue-500', icon: <Edit className="w-4 h-4" />, key: 'design' },
    { name: 'تسجيل ريرا والمبيعات', months: displayRera, color: 'bg-purple-500', icon: <Landmark className="w-4 h-4" />, key: 'rera' },
    { name: 'البناء', months: displayConstruction, color: 'bg-amber-500', icon: <Hammer className="w-4 h-4" />, key: 'construction' },
    { name: 'التسليم', months: displayHandover, color: 'bg-emerald-500', icon: <CheckCircle2 className="w-4 h-4" />, key: 'handover' },
  ];

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: project.id,
        name: project.name,
        startDate: editStartDate,
        designApprovalMonths: editDesign,
        reraSetupMonths: editRera,
        constructionMonths: editConstruction,
        handoverMonths: editHandover,
        salesEnabled: project.salesEnabled || false,
        salesVelocityType: project.salesVelocityType || 'aed',
        buyerPlanBookingPct: parseFloat(project.buyerPlanBookingPct) || 20,
        buyerPlanConstructionPct: parseFloat(project.buyerPlanConstructionPct) || 30,
        buyerPlanHandoverPct: parseFloat(project.buyerPlanHandoverPct) || 50,
      });
      toast.success("تم تحديث الجدول الزمني بنجاح", {
        description: `المدة الإجمالية: ${totalDuration} شهر — سيتم إعادة حساب التدفق النقدي`,
      });
      setIsEditing(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "فشل في تحديث الجدول الزمني");
    }
  };

  const handleCancel = () => {
    setEditStartDate(project.startDate);
    setEditDesign(project.designApprovalMonths);
    setEditRera(project.reraSetupMonths);
    setEditConstruction(project.constructionMonths);
    setEditHandover(project.handoverMonths);
    setIsEditing(false);
  };

  const handlePhaseChange = (key: string, value: number) => {
    const v = Math.max(1, value);
    switch (key) {
      case 'design': setEditDesign(v); break;
      case 'rera': setEditRera(v); break;
      case 'construction': setEditConstruction(v); break;
      case 'handover': setEditHandover(v); break;
    }
  };

  const hasChanges = isEditing && (
    editStartDate !== project.startDate ||
    editDesign !== project.designApprovalMonths ||
    editRera !== project.reraSetupMonths ||
    editConstruction !== project.constructionMonths ||
    editHandover !== project.handoverMonths
  );

  let cumMonth = 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                الجدول الزمني للمشروع
              </CardTitle>
              <CardDescription>المدة الإجمالية: {totalDuration} شهر — بداية من {displayStartDate}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateMutation.isPending}>
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending || !hasChanges}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updateMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin ml-1" />
                    ) : (
                      <Save className="w-4 h-4 ml-1" />
                    )}
                    {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 ml-1" />
                  تعديل المدد
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Start Date Editor */}
          {isEditing && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-semibold text-blue-700 whitespace-nowrap">تاريخ البداية:</Label>
                <Input
                  type="month"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="w-48 bg-white"
                />
              </div>
            </div>
          )}

          {/* Gantt Chart */}
          <div className="space-y-3">
            {phases.map((phase, idx) => {
              const startPct = (cumMonth / totalDuration) * 100;
              const widthPct = (phase.months / totalDuration) * 100;
              cumMonth += phase.months;

              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-48 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <div className={`w-8 h-8 rounded-lg ${phase.color} text-white flex items-center justify-center`}>
                      {phase.icon}
                    </div>
                    {phase.name}
                  </div>
                  <div className="flex-1 relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`absolute top-0 h-full ${phase.color} rounded-lg flex items-center justify-center text-white text-xs font-bold transition-all`}
                      style={{ right: `${startPct}%`, width: `${widthPct}%` }}
                    >
                      {phase.months} شهر
                    </div>
                  </div>
                  <div className="w-20 text-left text-sm text-gray-500">
                    ش{cumMonth - phase.months + 1} — ش{cumMonth}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Month markers */}
          <div className="mt-6 flex items-center">
            <div className="w-48" />
            <div className="flex-1 relative h-6">
              {Array.from({ length: Math.min(totalDuration + 1, 40) }, (_, i) => {
                if (i % (totalDuration > 24 ? 6 : 3) !== 0 && i !== totalDuration) return null;
                const pct = (i / totalDuration) * 100;
                return (
                  <div key={i} className="absolute text-xs text-gray-400" style={{ right: `${pct}%`, transform: 'translateX(50%)' }}>
                    ش{i || 1}
                  </div>
                );
              })}
            </div>
            <div className="w-20" />
          </div>

          {/* Change indicator */}
          {hasChanges && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700">لديك تعديلات غير محفوظة — اضغط "حفظ التعديلات" لإعادة حساب التدفق النقدي</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Details - Editable Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {phases.map((phase, idx) => (
          <Card key={idx} className={`text-center transition-all ${isEditing ? 'ring-2 ring-emerald-200 shadow-md' : ''}`}>
            <CardContent className="pt-5 pb-4">
              <div className={`w-12 h-12 rounded-xl ${phase.color} text-white flex items-center justify-center mx-auto mb-3`}>
                {phase.icon}
              </div>
              <p className="font-semibold text-gray-900 text-sm">{phase.name}</p>
              {isEditing ? (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handlePhaseChange(phase.key, phase.months - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors"
                    disabled={phase.months <= 1}
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min={1}
                    value={phase.months}
                    onChange={e => handlePhaseChange(phase.key, parseInt(e.target.value) || 1)}
                    className="w-16 text-center text-xl font-bold h-10"
                  />
                  <button
                    onClick={() => handlePhaseChange(phase.key, phase.months + 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-700 mt-1">{phase.months}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">شهر</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cost Structure Tab
// ═══════════════════════════════════════════════════════════════

function CostStructureTab({
  cfProjectId,
  costItems,
  onRefresh,
  project,
}: {
  cfProjectId: number;
  costItems: any[];
  onRefresh: () => void;
  project: any;
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const deleteMutation = trpc.cashFlowProgram.deleteCostItem.useMutation();
  const importQuery = trpc.cashFlowProgram.importFromFeasibility.useQuery(
    { projectId: project.projectId! },
    { enabled: false }
  );
  const saveMutation = trpc.cashFlowProgram.saveCostItem.useMutation();

  const totalCost = costItems.reduce((s, item) => s + item.totalAmount, 0);
  const categoryTotals = costItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم الحذف");
      onRefresh();
    } catch { toast.error("فشل في الحذف"); }
  };

  const handleImport = async () => {
    if (!project.projectId) {
      toast.error("هذا المشروع غير مرتبط بمشروع قائم");
      return;
    }
    try {
      const result = await importQuery.refetch();
      if (result.data?.costItems) {
        for (const item of result.data.costItems) {
          await saveMutation.mutateAsync({
            cfProjectId,
            name: item.name,
            category: item.category as any,
            totalAmount: item.totalAmount,
            paymentType: item.paymentType as any,
            paymentParams: item.paymentParams,
          });
        }
        toast.success(`تم استيراد ${result.data.costItems.length} عنصر تكلفة من دراسة الجدوى`);
        onRefresh();
      } else {
        toast.error("لا توجد دراسة جدوى مرتبطة بهذا المشروع");
      }
    } catch (e: any) {
      toast.error(e.message || "فشل في الاستيراد");
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <Card className="bg-gradient-to-l from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700">إجمالي التكاليف</p>
              <p className="text-3xl font-bold text-emerald-900">{formatAEDFull(totalCost)} <span className="text-sm font-normal">د.إ</span></p>
            </div>
            <div className="flex gap-2">
              {project.projectId && (
                <Button variant="outline" size="sm" onClick={handleImport} disabled={importQuery.isFetching || saveMutation.isPending}>
                  <Download className="w-4 h-4 ml-1" />
                  استيراد من الجدوى
                </Button>
              )}
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة بند
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg" dir="rtl">
                  <CostItemDialog
                    cfProjectId={cfProjectId}
                    item={editingItem}
                    project={project}
                    onSaved={() => {
                      setShowAddDialog(false);
                      setEditingItem(null);
                      onRefresh();
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
            <Card key={cat} className="border-r-4" style={{ borderRightColor: CATEGORY_COLORS[cat] || '#6b7280' }}>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-gray-500">{CATEGORY_LABELS[cat] || cat}</p>
                <p className="text-lg font-bold text-gray-900">{formatAED(amount)}</p>
                <p className="text-xs text-gray-400">{totalCost > 0 ? ((amount / totalCost) * 100).toFixed(1) : 0}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cost Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>بنود التكلفة ({costItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {costItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد بنود تكلفة بعد</p>
              <p className="text-sm mt-1">أضف بنوداً يدوياً أو استوردها من دراسة الجدوى</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-right py-2 px-3">البند</th>
                    <th className="text-right py-2 px-3">الفئة</th>
                    <th className="text-right py-2 px-3">المبلغ</th>
                    <th className="text-right py-2 px-3">نوع الدفع</th>
                    <th className="text-right py-2 px-3">%</th>
                    <th className="text-center py-2 px-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {costItems.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{item.name}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" style={{ borderColor: CATEGORY_COLORS[item.category], color: CATEGORY_COLORS[item.category] }}>
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono">{formatAEDFull(item.totalAmount)}</td>
                      <td className="py-2 px-3 text-gray-600">{PAYMENT_TYPE_LABELS[item.paymentType] || item.paymentType}</td>
                      <td className="py-2 px-3 text-gray-500">{totalCost > 0 ? ((item.totalAmount / totalCost) * 100).toFixed(1) : 0}%</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingItem(item);
                              setShowAddDialog(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50">
                    <td className="py-2 px-3" colSpan={2}>الإجمالي</td>
                    <td className="py-2 px-3 font-mono">{formatAEDFull(totalCost)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cost Item Dialog
// ═══════════════════════════════════════════════════════════════

function CostItemDialog({
  cfProjectId,
  item,
  project,
  onSaved,
}: {
  cfProjectId: number;
  item?: any;
  project: any;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState(item?.category || "other");
  const [totalAmount, setTotalAmount] = useState(item?.totalAmount?.toString() || "");
  const [paymentType, setPaymentType] = useState(item?.paymentType || "lump_sum");
  const [paymentParams, setPaymentParams] = useState<PaymentParams>(
    item?.paymentParams ? (typeof item.paymentParams === 'string' ? JSON.parse(item.paymentParams) : item.paymentParams) : {}
  );

  const saveMutation = trpc.cashFlowProgram.saveCostItem.useMutation();

  const totalDuration = project.designApprovalMonths + project.reraSetupMonths + project.constructionMonths + project.handoverMonths;

  const handleSave = async () => {
    if (!name.trim() || !totalAmount) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    try {
      await saveMutation.mutateAsync({
        id: item?.id,
        cfProjectId,
        name: name.trim(),
        category: category as any,
        totalAmount: parseInt(totalAmount),
        paymentType: paymentType as any,
        paymentParams,
      });
      toast.success(item ? "تم التحديث" : "تم الإضافة");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "فشل في الحفظ");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? "تعديل بند التكلفة" : "إضافة بند تكلفة"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div>
          <Label>اسم البند *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: أتعاب التصميم" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>الفئة *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المبلغ الإجمالي (د.إ) *</Label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <Separator />
        <div>
          <Label>نوع الدفع *</Label>
          <Select value={paymentType} onValueChange={(v) => { setPaymentType(v); setPaymentParams({}); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Type Specific Parameters */}
        {paymentType === 'lump_sum' && (
          <div>
            <Label>شهر الدفع (1 - {totalDuration})</Label>
            <Input
              type="number"
              min={1}
              max={totalDuration}
              value={paymentParams.paymentMonth || 1}
              onChange={e => setPaymentParams({ ...paymentParams, paymentMonth: parseInt(e.target.value) || 1 })}
            />
          </div>
        )}

        {paymentType === 'milestone' && (
          <MilestoneEditor
            milestones={paymentParams.milestones || []}
            onChange={ms => setPaymentParams({ ...paymentParams, milestones: ms })}
            maxMonth={totalDuration}
          />
        )}

        {paymentType === 'monthly_fixed' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>شهر البداية</Label>
              <Input
                type="number"
                min={1}
                value={paymentParams.startMonth || 1}
                onChange={e => setPaymentParams({ ...paymentParams, startMonth: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>شهر النهاية</Label>
              <Input
                type="number"
                min={1}
                value={paymentParams.endMonth || totalDuration}
                onChange={e => setPaymentParams({ ...paymentParams, endMonth: parseInt(e.target.value) || totalDuration })}
              />
            </div>
          </div>
        )}

        {paymentType === 'progress_based' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>نسبة التعبئة %</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={paymentParams.mobilizationPct || 10}
                  onChange={e => setPaymentParams({ ...paymentParams, mobilizationPct: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label>نسبة الاحتفاظ %</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={paymentParams.retentionPct || 5}
                  onChange={e => setPaymentParams({ ...paymentParams, retentionPct: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
            <div>
              <Label>توزيع التقدم</Label>
              <Select
                value={paymentParams.progressDistribution || 'scurve'}
                onValueChange={v => setPaymentParams({ ...paymentParams, progressDistribution: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">خطي</SelectItem>
                  <SelectItem value="scurve">منحنى S</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {paymentType === 'sales_linked' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>النسبة من المبيعات %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={paymentParams.salesPct || 100}
                onChange={e => setPaymentParams({ ...paymentParams, salesPct: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div>
              <Label>توقيت الدفع</Label>
              <Select
                value={paymentParams.salesTiming || 'construction'}
                onValueChange={v => setPaymentParams({ ...paymentParams, salesTiming: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking">عند الحجز</SelectItem>
                  <SelectItem value="construction">أثناء البناء</SelectItem>
                  <SelectItem value="handover">عند التسليم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">إلغاء</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
          {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Milestone Editor
// ═══════════════════════════════════════════════════════════════

function MilestoneEditor({
  milestones,
  onChange,
  maxMonth,
}: {
  milestones: Array<{ percent: number; description: string; monthOffset: number }>;
  onChange: (ms: Array<{ percent: number; description: string; monthOffset: number }>) => void;
  maxMonth: number;
}) {
  const addMilestone = () => {
    onChange([...milestones, { percent: 20, description: '', monthOffset: 1 }]);
  };

  const removeMilestone = (idx: number) => {
    onChange(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: string, value: any) => {
    const updated = [...milestones];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };

  const totalPct = milestones.reduce((s, m) => s + m.percent, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>مراحل الإنجاز</Label>
        <div className="flex items-center gap-2">
          <Badge variant={totalPct === 100 ? "default" : "destructive"} className="text-xs">
            {totalPct}% من 100%
          </Badge>
          <Button variant="outline" size="sm" onClick={addMilestone}>
            <Plus className="w-3 h-3 ml-1" />
            إضافة
          </Button>
        </div>
      </div>
      {milestones.map((ms, idx) => (
        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
          <Input
            className="w-16"
            type="number"
            min={0}
            max={100}
            value={ms.percent}
            onChange={e => updateMilestone(idx, 'percent', parseInt(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-500">%</span>
          <Input
            className="flex-1"
            placeholder="وصف المرحلة"
            value={ms.description}
            onChange={e => updateMilestone(idx, 'description', e.target.value)}
          />
          <Input
            className="w-16"
            type="number"
            min={1}
            max={maxMonth}
            value={ms.monthOffset}
            onChange={e => updateMilestone(idx, 'monthOffset', parseInt(e.target.value) || 1)}
          />
          <span className="text-xs text-gray-500">شهر</span>
          <Button variant="ghost" size="sm" onClick={() => removeMilestone(idx)} className="text-red-500">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      {milestones.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">أضف مراحل إنجاز للدفع</p>
      )}

      {/* Quick Templates */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onChange([
            { percent: 20, description: 'توقيع العقد', monthOffset: 1 },
            { percent: 20, description: 'إنهاء المفهوم', monthOffset: 2 },
            { percent: 25, description: 'التصميم التفصيلي', monthOffset: 4 },
            { percent: 20, description: 'حزمة المناقصة', monthOffset: 5 },
            { percent: 15, description: 'رخصة البناء', monthOffset: 6 },
          ])}
        >
          قالب: أتعاب التصميم
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cash Flow Tab
// ═══════════════════════════════════════════════════════════════

function CashFlowTab({
  cashFlow,
  costItems,
  isLoading,
}: {
  cashFlow: any;
  costItems: any[];
  isLoading: boolean;
}) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">جاري حساب التدفقات النقدية...</p>
        </CardContent>
      </Card>
    );
  }

  if (!cashFlow || costItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">لا توجد بيانات كافية</h3>
          <p className="text-gray-400">أضف بنود تكلفة أولاً في تبويب "هيكل التكاليف"</p>
        </CardContent>
      </Card>
    );
  }

  const { monthLabels, totalOutflow, salesInflow, cumulativeOutflow, cumulativeInflow, cumulativeNet } = cashFlow;

  // Find max values for chart scaling
  const maxOutflow = Math.max(...totalOutflow, 1);
  const maxCumulative = Math.max(...cumulativeOutflow, ...cumulativeInflow.map(Math.abs), 1);

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <Button
            variant={viewMode === 'chart' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('chart')}
            className={viewMode === 'chart' ? 'bg-emerald-600' : ''}
          >
            <BarChart3 className="w-4 h-4 ml-1" />
            رسم بياني
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'bg-emerald-600' : ''}
          >
            <FileText className="w-4 h-4 ml-1" />
            جدول
          </Button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <>
          {/* Monthly Outflow Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>التدفق النقدي الشهري (المصروفات)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex items-end gap-1 h-48">
                    {totalOutflow.map((val: number, idx: number) => (
                      <div
                        key={idx}
                        className="flex-1 bg-red-400 hover:bg-red-500 rounded-t transition-colors cursor-pointer group relative"
                        style={{ height: `${(val / maxOutflow) * 100}%`, minHeight: val > 0 ? '2px' : '0' }}
                        title={`${monthLabels[idx]}: ${formatAEDFull(val)} د.إ`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          {formatAED(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* X-axis labels */}
                  <div className="flex gap-1 mt-2">
                    {monthLabels.map((label: string, idx: number) => (
                      <div key={idx} className="flex-1 text-center">
                        {idx % (monthLabels.length > 24 ? 6 : 3) === 0 && (
                          <span className="text-[10px] text-gray-400 block truncate">{label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cumulative Chart */}
          <Card>
            <CardHeader>
              <CardTitle>التدفق التراكمي (التكاليف مقابل الإيرادات)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px] relative h-64">
                  {/* SVG Line Chart */}
                  <svg viewBox={`0 0 ${monthLabels.length * 20} 200`} className="w-full h-full" preserveAspectRatio="none">
                    {/* Cost line */}
                    <polyline
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                      points={cumulativeOutflow.map((v: number, i: number) =>
                        `${i * 20 + 10},${200 - (v / maxCumulative) * 180}`
                      ).join(' ')}
                    />
                    {/* Revenue line */}
                    {cumulativeInflow.some((v: number) => v > 0) && (
                      <polyline
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2"
                        points={cumulativeInflow.map((v: number, i: number) =>
                          `${i * 20 + 10},${200 - (v / maxCumulative) * 180}`
                        ).join(' ')}
                      />
                    )}
                  </svg>
                  {/* Legend */}
                  <div className="absolute top-2 left-2 flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-600 rounded" /> التكاليف التراكمية</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-1 bg-emerald-600 rounded" /> الإيرادات التراكمية</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Table View */
        <Card>
          <CardHeader>
            <CardTitle>جدول التدفق النقدي الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b text-gray-500">
                    <th className="text-right py-2 px-3 sticky right-0 bg-white">الشهر</th>
                    {Object.keys(cashFlow.outflowByCategory).filter(k => k !== 'total').map(cat => (
                      <th key={cat} className="text-right py-2 px-3 whitespace-nowrap">{CATEGORY_LABELS[cat] || cat}</th>
                    ))}
                    <th className="text-right py-2 px-3 font-bold">إجمالي المصروفات</th>
                    <th className="text-right py-2 px-3">الإيرادات</th>
                    <th className="text-right py-2 px-3">صافي</th>
                    <th className="text-right py-2 px-3">تراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {monthLabels.map((label: string, idx: number) => {
                    const net = salesInflow[idx] - totalOutflow[idx];
                    return (
                      <tr key={idx} className={`border-b hover:bg-gray-50 ${idx === cashFlow.keyNumbers.peakMonth - 1 ? 'bg-amber-50' : ''}`}>
                        <td className="py-1.5 px-3 sticky right-0 bg-white text-xs font-medium whitespace-nowrap">{label}</td>
                        {Object.keys(cashFlow.outflowByCategory).filter(k => k !== 'total').map(cat => (
                          <td key={cat} className="py-1.5 px-3 font-mono text-xs">
                            {cashFlow.outflowByCategory[cat][idx] > 0 ? formatAED(cashFlow.outflowByCategory[cat][idx]) : '—'}
                          </td>
                        ))}
                        <td className="py-1.5 px-3 font-mono text-xs font-bold text-red-600">
                          {totalOutflow[idx] > 0 ? formatAED(totalOutflow[idx]) : '—'}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-xs text-emerald-600">
                          {salesInflow[idx] > 0 ? formatAED(salesInflow[idx]) : '—'}
                        </td>
                        <td className={`py-1.5 px-3 font-mono text-xs ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatAED(net)}
                        </td>
                        <td className={`py-1.5 px-3 font-mono text-xs font-bold ${cumulativeNet[idx] >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatAED(cumulativeNet[idx])}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Scenarios Tab
// ═══════════════════════════════════════════════════════════════

function ScenariosTab({
  cfProjectId,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onRefresh,
}: {
  cfProjectId: number;
  scenarios: any[];
  selectedScenarioId: number | null;
  onSelectScenario: (id: number | null) => void;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [salesDelta, setSalesDelta] = useState(0);
  const [constructionDelta, setConstructionDelta] = useState(0);
  const [mobPct, setMobPct] = useState<string>("");
  const [bookingPct, setBookingPct] = useState<string>("");
  const [constructionPct, setConstructionPct] = useState<string>("");
  const [handoverPct, setHandoverPct] = useState<string>("");

  const saveMutation = trpc.cashFlowProgram.saveScenario.useMutation();
  const deleteMutation = trpc.cashFlowProgram.deleteScenario.useMutation();

  const handleSave = async () => {
    if (!name.trim()) { toast.error("يرجى إدخال اسم السيناريو"); return; }
    try {
      await saveMutation.mutateAsync({
        cfProjectId,
        name: name.trim(),
        salesStartMonthDelta: salesDelta,
        constructionDurationDelta: constructionDelta,
        mobilizationPctOverride: mobPct ? parseFloat(mobPct) : null,
        buyerPlanBookingPct: bookingPct ? parseFloat(bookingPct) : null,
        buyerPlanConstructionPct: constructionPct ? parseFloat(constructionPct) : null,
        buyerPlanHandoverPct: handoverPct ? parseFloat(handoverPct) : null,
      });
      toast.success("تم حفظ السيناريو");
      setShowCreate(false);
      setName("");
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      if (selectedScenarioId === id) onSelectScenario(null);
      toast.success("تم الحذف");
      onRefresh();
    } catch { toast.error("فشل في الحذف"); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-600" />
                محاكي السيناريوهات
              </CardTitle>
              <CardDescription>أنشئ سيناريوهات مختلفة لمقارنة التدفقات النقدية</CardDescription>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 ml-1" />
              سيناريو جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active Scenario Selector */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-medium text-gray-700">السيناريو النشط:</span>
            <Button
              variant={selectedScenarioId === null ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectScenario(null)}
              className={selectedScenarioId === null ? "bg-emerald-600" : ""}
            >
              الأساسي
            </Button>
            {scenarios.map(s => (
              <Button
                key={s.id}
                variant={selectedScenarioId === s.id ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectScenario(s.id)}
                className={selectedScenarioId === s.id ? "bg-emerald-600" : ""}
              >
                {s.name}
              </Button>
            ))}
          </div>

          {/* Create Form */}
          {showCreate && (
            <Card className="border-dashed border-emerald-300 bg-emerald-50/30 mb-6">
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label>اسم السيناريو *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: سيناريو متفائل" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>تأخير/تقديم بدء المبيعات (أشهر)</Label>
                    <Input type="number" value={salesDelta} onChange={e => setSalesDelta(parseInt(e.target.value) || 0)} />
                    <p className="text-xs text-gray-400 mt-1">+ تأخير / - تقديم</p>
                  </div>
                  <div>
                    <Label>تغيير مدة البناء (أشهر)</Label>
                    <Input type="number" value={constructionDelta} onChange={e => setConstructionDelta(parseInt(e.target.value) || 0)} />
                    <p className="text-xs text-gray-400 mt-1">+ تمديد / - تقصير</p>
                  </div>
                </div>
                <div>
                  <Label>نسبة التعبئة للمقاول (اختياري)</Label>
                  <Input type="number" value={mobPct} onChange={e => setMobPct(e.target.value)} placeholder="مثال: 10" />
                </div>
                <Separator />
                <p className="text-sm font-semibold text-gray-700">خطة دفع المشتري (اختياري)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">عند الحجز %</Label>
                    <Input type="number" value={bookingPct} onChange={e => setBookingPct(e.target.value)} placeholder="20" />
                  </div>
                  <div>
                    <Label className="text-xs">أثناء البناء %</Label>
                    <Input type="number" value={constructionPct} onChange={e => setConstructionPct(e.target.value)} placeholder="30" />
                  </div>
                  <div>
                    <Label className="text-xs">عند التسليم %</Label>
                    <Input type="number" value={handoverPct} onChange={e => setHandoverPct(e.target.value)} placeholder="50" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-emerald-600">
                    {saveMutation.isPending ? "جاري الحفظ..." : "حفظ السيناريو"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scenarios List */}
          {scenarios.length === 0 && !showCreate ? (
            <div className="text-center py-8 text-gray-400">
              <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد سيناريوهات بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarios.map(s => (
                <Card key={s.id} className={`${selectedScenarioId === s.id ? 'border-emerald-500 bg-emerald-50/30' : ''}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{s.name}</h4>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onSelectScenario(s.id)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs">
                      {s.salesStartMonthDelta !== 0 && (
                        <Badge variant="outline">مبيعات: {s.salesStartMonthDelta > 0 ? '+' : ''}{s.salesStartMonthDelta} شهر</Badge>
                      )}
                      {s.constructionDurationDelta !== 0 && (
                        <Badge variant="outline">بناء: {s.constructionDurationDelta > 0 ? '+' : ''}{s.constructionDurationDelta} شهر</Badge>
                      )}
                      {s.mobilizationPctOverride && (
                        <Badge variant="outline">تعبئة: {s.mobilizationPctOverride}%</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Tab - Key Numbers
// ═══════════════════════════════════════════════════════════════

function DashboardTab({ cashFlow, project }: { cashFlow: any; project: any }) {
  if (!cashFlow?.keyNumbers) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">لا توجد بيانات</h3>
          <p className="text-gray-400">أضف بنود تكلفة لعرض لوحة الأرقام الرئيسية</p>
        </CardContent>
      </Card>
    );
  }

  const kn = cashFlow.keyNumbers;

  return (
    <div className="space-y-6">
      {/* Key Numbers Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-5 pb-4 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-red-600" />
            <p className="text-sm text-red-700">إجمالي التكاليف</p>
            <p className="text-2xl font-bold text-red-900">{formatAEDFull(kn.totalCost)}</p>
            <p className="text-xs text-red-600">د.إ</p>
          </CardContent>
        </Card>

        {kn.totalSales > 0 && (
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="pt-5 pb-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
              <p className="text-sm text-emerald-700">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-emerald-900">{formatAEDFull(kn.totalSales)}</p>
              <p className="text-xs text-emerald-600">د.إ</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-5 pb-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-600" />
            <p className="text-sm text-amber-700">أقصى تعرض رأسمالي</p>
            <p className="text-2xl font-bold text-amber-900">{formatAEDFull(kn.peakExposure)}</p>
            <p className="text-xs text-amber-600">د.إ</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-5 pb-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-blue-700">شهر الذروة</p>
            <p className="text-2xl font-bold text-blue-900">{kn.peakMonth}</p>
            <p className="text-xs text-blue-600">{kn.peakMonthLabel}</p>
          </CardContent>
        </Card>
      </div>

      {kn.totalSales > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className={`${kn.netProfit >= 0 ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'}`}>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-sm text-gray-700">صافي الربح</p>
              <p className={`text-3xl font-bold ${kn.netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {formatAEDFull(kn.netProfit)} <span className="text-sm font-normal">د.إ</span>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-sm text-purple-700">العائد على الاستثمار</p>
              <p className="text-3xl font-bold text-purple-900">{kn.roi.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>توزيع التكاليف حسب المرحلة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cashFlow.phases.map((phase: any) => {
              const phaseOutflow = cashFlow.totalOutflow
                .slice(phase.startMonth - 1, phase.endMonth)
                .reduce((s: number, v: number) => s + v, 0);
              const pct = kn.totalCost > 0 ? (phaseOutflow / kn.totalCost) * 100 : 0;
              const phaseNames: Record<string, string> = {
                design: 'التصميم والموافقات',
                rera: 'تسجيل ريرا',
                construction: 'البناء',
                handover: 'التسليم',
              };

              return (
                <div key={phase.name} className="flex items-center gap-4">
                  <div className="w-36 text-sm font-medium text-gray-700">{phaseNames[phase.name] || phase.name}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-32 text-left text-sm">
                    <span className="font-bold">{formatAED(phaseOutflow)}</span>
                    <span className="text-gray-400 mr-1">({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
