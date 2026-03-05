import React, { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import PortfolioView from "./PortfolioView";
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
  Clock, Landmark, Briefcase, Hammer, Eye, FileText, Percent, FileSpreadsheet,
  GitCompare, Wallet, Building, ShieldCheck, ArrowUpDown, Info, ListChecks,
  CircleDollarSign, LayoutDashboard
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  land: 'الأرض',
  land_registration: 'تسجيل الأرض',
  development_setup: 'إعداد التطوير',
  design_engineering: 'التصميم والهندسة',
  consultants: 'الاستشاريون',
  authority_fees: 'رسوم حكومية',
  contractor: 'المقاول الرئيسي',
  marketing_sales: 'التسويق والبيع',
  administration: 'إدارة',
  developer_fee: 'أتعاب المطور',
  contingency: 'احتياطي',
  other: 'أخرى',
};

const CATEGORY_COLORS: Record<string, string> = {
  land: '#059669',
  land_registration: '#047857',
  development_setup: '#0d9488',
  design_engineering: '#2563eb',
  consultants: '#4f46e5',
  authority_fees: '#7c3aed',
  contractor: '#dc2626',
  marketing_sales: '#0891b2',
  administration: '#64748b',
  developer_fee: '#ca8a04',
  contingency: '#6b7280',
  other: '#9333ea',
};

const PHASE_LABELS: Record<string, string> = {
  pre_dev: 'ما قبل البناء',
  construction: 'البناء',
  handover: 'التسليم',
  all: 'كل المراحل',
};

const PHASE_COLORS: Record<string, string> = {
  pre_dev: '#f59e0b',
  construction: '#3b82f6',
  handover: '#10b981',
};

const FUNDING_LABELS: Record<string, string> = {
  developer: 'المستثمر',
  escrow: 'الإسكرو',
  mixed: 'مختلط',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  lump_sum: 'دفعة واحدة',
  milestone: 'مراحل إنجاز',
  monthly_fixed: 'شهري ثابت',
  progress_based: 'حسب التقدم',
  sales_linked: 'مرتبط بالمبيعات',
};

function formatAED(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toLocaleString('en-US');
}

function formatFullAED(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════

export default function ProgramCashFlowPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);

  const projectsQuery = trpc.cashFlowProgram.listProjects.useQuery();
  const deleteMutation = trpc.cashFlowProgram.deleteProject.useMutation({
    onSuccess: () => {
      toast.success('تم حذف المشروع');
      projectsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const projects = projectsQuery.data || [];

  if (showPortfolio) {
    return <PortfolioView onBack={() => setShowPortfolio(false)} />;
  }

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        cfProjectId={selectedProjectId}
        onBack={() => { setSelectedProjectId(null); projectsQuery.refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 pt-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white mb-2">
          <Wallet className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">برنامج العمل والتدفقات النقدية</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          أداة لإدارة التدفقات النقدية لمشاريعك العقارية — تتبع التكاليف، المبيعات، وحسابات الإسكرو
        </p>
      </div>

      {/* How it works - only show when few or no projects */}
      {projects.length < 3 && (
        <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardContent className="p-6">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-600" />
              كيف تستخدم هذه الأداة؟
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <div className="font-medium text-sm">أنشئ مشروع</div>
                  <div className="text-xs text-muted-foreground mt-0.5">حدد اسم المشروع، تاريخ البدء، ومدة كل مرحلة (ما قبل البناء، البناء، التسليم)</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <div className="font-medium text-sm">أضف بنود التكاليف</div>
                  <div className="text-xs text-muted-foreground mt-0.5">أضف تكاليف الأرض، المقاول، الاستشاريين، وغيرها مع تحديد مصدر التمويل ونوع الدفع</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <div className="font-medium text-sm">شاهد التدفق النقدي</div>
                  <div className="text-xs text-muted-foreground mt-0.5">النظام يحسب تلقائياً التدفق النقدي الشهري مع الرسوم البيانية والجداول التفصيلية</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">مشاريعي</h2>
          <Badge variant="secondary" className="text-xs">{projects.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setShowPortfolio(true)}>
              <LayoutDashboard className="h-4 w-4 ml-2" />
              محفظة المشاريع
            </Button>
          )}
          <CreateProjectDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onCreated={() => projectsQuery.refetch()}
          />
        </div>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-medium mb-1">لا توجد مشاريع بعد</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
              ابدأ بإنشاء مشروعك الأول — يمكنك الاستيراد من دراسة الجدوى أو إنشاء مشروع يدوياً
            </p>
            <Button size="lg" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-5 w-5 ml-2" />
              إنشاء أول مشروع
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p: any) => {
            const totalMonths = (p.preDevMonths || p.designApprovalMonths + p.reraSetupMonths) + p.constructionMonths + p.handoverMonths;
            return (
              <Card
                key={p.id}
                className="group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative"
                onClick={() => setSelectedProjectId(p.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{p.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>بدء: {p.startDate}</span>
                        <span>·</span>
                        <span>{totalMonths} شهر</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع البيانات المرتبطة.')) {
                          deleteMutation.mutate({ id: p.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Phase Timeline Mini */}
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="rounded-full bg-amber-500"
                      style={{ width: `${((p.preDevMonths || p.designApprovalMonths + p.reraSetupMonths) / totalMonths) * 100}%` }}
                    />
                    <div
                      className="rounded-full bg-blue-500"
                      style={{ width: `${(p.constructionMonths / totalMonths) * 100}%` }}
                    />
                    <div
                      className="rounded-full bg-green-500"
                      style={{ width: `${(p.handoverMonths / totalMonths) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="text-amber-600">ما قبل البناء {p.preDevMonths || p.designApprovalMonths + p.reraSetupMonths}ش</span>
                    <span className="text-blue-600">البناء {p.constructionMonths}ش</span>
                    <span className="text-green-600">التسليم {p.handoverMonths}ش</span>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 pt-1 border-t">
                    <div className="flex items-center gap-1.5 text-xs">
                      <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">بنود التكاليف:</span>
                      <span className="font-semibold">{p.costItemCount || 0}</span>
                    </div>
                    {(p.totalCost > 0) && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">إجمالي:</span>
                        <span className="font-semibold text-red-600">{formatAED(p.totalCost)} AED</span>
                      </div>
                    )}
                    {p.totalSalesRevenue > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                        <span className="font-semibold text-green-600">{formatAED(p.totalSalesRevenue)} AED</span>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  {p.costItemCount === 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-400">لم تتم إضافة بنود تكاليف بعد — اضغط لإضافتها</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Create Project Dialog
// ═══════════════════════════════════════════════════════════════

function CreateProjectDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<'manual' | 'feasibility'>('feasibility');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('2026-01');
  const [preDevMonths, setPreDevMonths] = useState(6);
  const [constructionMonths, setConstructionMonths] = useState(16);
  const [handoverMonths, setHandoverMonths] = useState(2);
  const [selectedFeasId, setSelectedFeasId] = useState<number | null>(null);

  const feasListQuery = trpc.cashFlowProgram.importFromFeasibility.useQuery(
    { projectId: 0 },
    { enabled: open && mode === 'feasibility' }
  );

  const createMutation = trpc.cashFlowProgram.createProject.useMutation({
    onSuccess: () => {
      toast.success('تم إنشاء المشروع بنجاح');
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const createFromFeasMutation = trpc.cashFlowProgram.createFromFeasibility.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء المشروع: ${data?.projectName} (${data?.costItemsCount} بند تكلفة)`);
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          مشروع جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إنشاء مشروع تدفق نقدي جديد</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="feasibility" className="flex-1">
              <FileText className="h-3.5 w-3.5 ml-1" />
              من دراسة الجدوى
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              <Edit className="h-3.5 w-3.5 ml-1" />
              يدوي
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feasibility" className="space-y-4 mt-4">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-3.5 w-3.5 inline ml-1" />
              سيتم استيراد بنود التكاليف تلقائياً من دراسة الجدوى المختارة
            </div>
            <div>
              <Label>اختر دراسة الجدوى</Label>
              <Select onValueChange={(v) => setSelectedFeasId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="اختر دراسة جدوى..." /></SelectTrigger>
                <SelectContent>
                  {(feasListQuery.data as any)?.studies?.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البدء</Label>
                <Input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>ما قبل البناء (أشهر)</Label>
                <Input type="number" value={preDevMonths} onChange={(e) => setPreDevMonths(Number(e.target.value))} min={1} />
              </div>
              <div>
                <Label>البناء (أشهر)</Label>
                <Input type="number" value={constructionMonths} onChange={(e) => setConstructionMonths(Number(e.target.value))} min={1} />
              </div>
              <div>
                <Label>التسليم (أشهر)</Label>
                <Input type="number" value={handoverMonths} onChange={(e) => setHandoverMonths(Number(e.target.value))} min={1} />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!selectedFeasId || createFromFeasMutation.isPending}
              onClick={() => selectedFeasId && createFromFeasMutation.mutate({
                feasibilityStudyId: selectedFeasId,
                startDate,
                designApprovalMonths: preDevMonths,
                reraSetupMonths: 0,
                constructionMonths,
                handoverMonths,
              })}
            >
              {createFromFeasMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء من دراسة الجدوى'}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div>
              <Label>اسم المشروع</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مشروع ند الشبا السكني" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البدء</Label>
                <Input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>ما قبل البناء (أشهر)</Label>
                <Input type="number" value={preDevMonths} onChange={(e) => setPreDevMonths(Number(e.target.value))} min={1} />
              </div>
              <div>
                <Label>البناء (أشهر)</Label>
                <Input type="number" value={constructionMonths} onChange={(e) => setConstructionMonths(Number(e.target.value))} min={1} />
              </div>
              <div>
                <Label>التسليم (أشهر)</Label>
                <Input type="number" value={handoverMonths} onChange={(e) => setHandoverMonths(Number(e.target.value))} min={1} />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!name || createMutation.isPending}
              onClick={() => createMutation.mutate({
                name,
                startDate,
                designApprovalMonths: preDevMonths,
                reraSetupMonths: 0,
                constructionMonths,
                handoverMonths,
              })}
            >
              {createMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Project Detail View
// ═══════════════════════════════════════════════════════════════

function ProjectDetailView({ cfProjectId, onBack }: { cfProjectId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');

  const projectQuery = trpc.cashFlowProgram.getProject.useQuery({ id: cfProjectId });
  const costItemsQuery = trpc.cashFlowProgram.getCostItems.useQuery({ cfProjectId });
  const cashFlowQuery = trpc.cashFlowProgram.calculateCashFlow.useQuery({ cfProjectId });

  const project = projectQuery.data;
  const costItems = costItemsQuery.data || [];
  const cashFlow = cashFlowQuery.data;
  const dual = cashFlow?.dualCashFlow;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalMonths = (project.preDevMonths || project.designApprovalMonths + project.reraSetupMonths) + project.constructionMonths + project.handoverMonths;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            بدء: {project.startDate} · {totalMonths} شهر إجمالي
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          cashFlowQuery.refetch();
          costItemsQuery.refetch();
        }}>
          <RefreshCw className="h-4 w-4 ml-1" />
          تحديث
        </Button>
        <ExportExcelButton cfProjectId={cfProjectId} />
      </div>

      {/* Quick Start Guide - show when no cost items */}
      {costItems.length === 0 && (
        <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">الخطوة التالية: أضف بنود التكاليف</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  اذهب إلى تبويب <strong>"بنود التكاليف"</strong> وأضف تكاليف المشروع (الأرض، المقاول، الاستشاريين...) لتفعيل حسابات التدفق النقدي
                </p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('costs')}>
                  <Plus className="h-4 w-4 ml-1" />
                  اذهب لبنود التكاليف
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Numbers Cards */}
      {dual && <KeyNumbersCards dual={dual} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            الجدول الزمني
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-1 relative">
            <DollarSign className="h-3.5 w-3.5" />
            بنود التكاليف
            {costItems.length === 0 && (
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            الجدول الشهري
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings2 className="h-3.5 w-3.5" />
            الإعدادات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {dual ? <OverviewTab dual={dual} /> : <LoadingState />}
        </TabsContent>

        <TabsContent value="timeline">
          {dual ? <TimelineTab dual={dual} project={project} /> : <LoadingState />}
        </TabsContent>

        <TabsContent value="costs">
          <CostItemsTab
            cfProjectId={cfProjectId}
            costItems={costItems}
            onRefresh={() => { costItemsQuery.refetch(); cashFlowQuery.refetch(); }}
          />
        </TabsContent>

        <TabsContent value="monthly">
          {dual ? <MonthlyTableTab dual={dual} /> : <LoadingState />}
        </TabsContent>

        <TabsContent value="settings">
          <ProjectSettingsTab
            cfProjectId={cfProjectId}
            project={project}
            onRefresh={() => { projectQuery.refetch(); cashFlowQuery.refetch(); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Key Numbers Cards
// ═══════════════════════════════════════════════════════════════

function KeyNumbersCards({ dual }: { dual: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">إجمالي التكاليف</span>
          </div>
          <div className="text-lg font-bold text-red-600">{formatAED(dual.totalProjectCost)} AED</div>
          <div className="flex gap-2 mt-1 text-xs">
            <span className="text-amber-600">مستثمر: {formatAED(dual.developerCosts)}</span>
            <span className="text-blue-600">إسكرو: {formatAED(dual.escrowCosts)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
          </div>
          <div className="text-lg font-bold text-green-600">{formatAED(dual.totalSalesRevenue)} AED</div>
          <div className="text-xs mt-1 text-muted-foreground">
            صافي الربح: <span className="font-semibold text-green-600">{formatAED(dual.netProfit)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">أقصى تعرض للمستثمر</span>
          </div>
          <div className="text-lg font-bold text-amber-600">{formatAED(dual.developerMaxExposure)} AED</div>
          <div className="text-xs mt-1 text-muted-foreground">
            الشهر: {dual.developerMaxExposureLabel}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">العائد على الاستثمار</span>
          </div>
          <div className="text-lg font-bold text-blue-600">{dual.roi.toFixed(1)}%</div>
          <div className="text-xs mt-1 text-muted-foreground">
            البناء: {formatAED(dual.constructionCost)} AED
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Overview Tab - Charts & Summary
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ dual }: { dual: any }) {
  const table = dual.monthlyTable || [];

  return (
    <div className="space-y-6">
      {/* Funding Structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            هيكل التمويل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">إيداع الإسكرو</div>
              <div className="font-bold text-amber-600">{formatAED(dual.fundingStructure.escrowDeposit)}</div>
              <div className="text-xs text-muted-foreground">20%</div>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">دفعة مقدمة للمقاول</div>
              <div className="font-bold text-orange-600">{formatAED(dual.fundingStructure.contractorAdvance)}</div>
              <div className="text-xs text-muted-foreground">10%</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">هامش سيولة</div>
              <div className="font-bold text-yellow-600">{formatAED(dual.fundingStructure.liquidityBuffer)}</div>
              <div className="text-xs text-muted-foreground">5%</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200">
              <div className="text-xs text-muted-foreground mb-1">إجمالي المستثمر (بناء)</div>
              <div className="font-bold text-red-600">{formatAED(dual.fundingStructure.totalDeveloperConstruction)}</div>
              <div className="text-xs text-muted-foreground">35%</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200">
              <div className="text-xs text-muted-foreground mb-1">من الإسكرو (بناء)</div>
              <div className="font-bold text-blue-600">{formatAED(dual.fundingStructure.escrowConstruction)}</div>
              <div className="text-xs text-muted-foreground">65%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Chart (SVG) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            التدفق النقدي المزدوج
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1 ml-3"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> تراكمي المستثمر</span>
            <span className="inline-flex items-center gap-1 ml-3"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> رصيد الإسكرو</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> صافي تراكمي</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DualCashFlowChart table={table} phases={dual.phases} />
        </CardContent>
      </Card>

      {/* Cost by Category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            توزيع التكاليف حسب الفئة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(dual.costByCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">أضف بنود تكاليف لعرض التوزيع</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(dual.costByCategory)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([cat, amount]: [string, any]) => {
                  const pct = dual.totalProjectCost > 0 ? (amount / dual.totalProjectCost) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="w-32 text-sm truncate">{CATEGORY_LABELS[cat] || cat}</div>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] || '#6b7280' }}
                        />
                      </div>
                      <div className="w-24 text-sm text-left font-mono">{formatAED(amount)}</div>
                      <div className="w-12 text-xs text-muted-foreground text-left">{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dual Cash Flow Chart (SVG)
// ═══════════════════════════════════════════════════════════════

function DualCashFlowChart({ table, phases }: { table: any[]; phases: any }) {
  if (!table.length) return null;

  const W = 800, H = 350, PAD = { top: 20, right: 20, bottom: 40, left: 80 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = table.flatMap((r: any) => [
    -r.developerCumulative, r.escrowBalance, r.cumulativeNet
  ]);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(0, ...allVals);
  const range = maxVal - minVal || 1;

  const x = (i: number) => PAD.left + (i / (table.length - 1)) * chartW;
  const y = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const buildPath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const devPath = buildPath(table.map((r: any) => -r.developerCumulative));
  const escPath = buildPath(table.map((r: any) => r.escrowBalance));
  const netPath = buildPath(table.map((r: any) => r.cumulativeNet));

  // Phase backgrounds
  const phaseRects = [
    { start: 0, end: phases.preDev.months - 1, color: '#f59e0b', label: 'ما قبل البناء' },
    { start: phases.preDev.months, end: phases.preDev.months + phases.construction.months - 1, color: '#3b82f6', label: 'البناء' },
    { start: phases.preDev.months + phases.construction.months, end: table.length - 1, color: '#10b981', label: 'التسليم' },
  ];

  // Y-axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => minVal + (range / tickCount) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 350 }}>
      {/* Phase backgrounds */}
      {phaseRects.map((p, i) => (
        <g key={i}>
          <rect
            x={x(p.start)}
            y={PAD.top}
            width={x(p.end) - x(p.start)}
            height={chartH}
            fill={p.color}
            opacity={0.05}
          />
          <text
            x={(x(p.start) + x(p.end)) / 2}
            y={H - 5}
            textAnchor="middle"
            className="text-[10px] fill-muted-foreground"
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Grid lines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="currentColor" opacity={0.1} />
          <text x={PAD.left - 5} y={y(t) + 4} textAnchor="end" className="text-[9px] fill-muted-foreground">
            {formatAED(t)}
          </text>
        </g>
      ))}

      {/* Zero line */}
      <line x1={PAD.left} y1={y(0)} x2={W - PAD.right} y2={y(0)} stroke="currentColor" opacity={0.3} strokeDasharray="4,4" />

      {/* Lines */}
      <path d={devPath} fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0.8} />
      <path d={escPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} opacity={0.8} />
      <path d={netPath} fill="none" stroke="#10b981" strokeWidth={2.5} opacity={0.8} />

      {/* Month labels (every 3rd) */}
      {table.map((r: any, i: number) => i % 3 === 0 ? (
        <text key={i} x={x(i)} y={H - 22} textAnchor="middle" className="text-[8px] fill-muted-foreground">
          {r.label}
        </text>
      ) : null)}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Timeline Tab - Interactive Gantt
// ═══════════════════════════════════════════════════════════════

function TimelineTab({ dual, project }: { dual: any; project: any }) {
  const phases = dual.phases;
  const totalMonths = dual.totalMonths;
  const monthLabels = dual.monthLabels;

  return (
    <div className="space-y-6">
      {/* Interactive Gantt Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            الجدول الزمني التفاعلي
          </CardTitle>
          <CardDescription>3 مراحل: ما قبل البناء → البناء → التسليم</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Phase bars */}
            {[
              { key: 'preDev', label: 'ما قبل البناء', phase: phases.preDev, color: '#f59e0b', icon: '📐' },
              { key: 'construction', label: 'البناء', phase: phases.construction, color: '#3b82f6', icon: '🔨' },
              { key: 'handover', label: 'التسليم', phase: phases.handover, color: '#10b981', icon: '✅' },
            ].map(({ key, label, phase, color, icon }) => {
              const startPct = ((phase.start - 1) / totalMonths) * 100;
              const widthPct = (phase.months / totalMonths) * 100;
              const startLabel = monthLabels[phase.start - 1] || '';
              const endLabel = monthLabels[phase.end - 1] || '';

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{icon} {label}</span>
                    <span className="text-muted-foreground text-xs">
                      {startLabel} → {endLabel} ({phase.months} شهر)
                    </span>
                  </div>
                  <div className="relative h-10 bg-muted rounded-lg overflow-hidden">
                    <div
                      className="absolute h-full rounded-lg flex items-center justify-center text-white text-xs font-bold transition-all"
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: color,
                      }}
                    >
                      {phase.months} شهر
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Month ruler */}
            <div className="relative h-6 mt-2">
              {monthLabels.map((label: string, i: number) => {
                if (i % 3 !== 0) return null;
                const leftPct = (i / totalMonths) * 100;
                return (
                  <div
                    key={i}
                    className="absolute text-[9px] text-muted-foreground"
                    style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'ما قبل البناء', phase: phases.preDev, color: 'amber', icon: '📐',
            desc: 'شراء الأرض، التصميم، الموافقات، تسجيل ريرا، تعبئة المقاول' },
          { label: 'البناء', phase: phases.construction, color: 'blue', icon: '🔨',
            desc: 'أعمال البناء، الإشراف، دفعات المقاول من الإسكرو' },
          { label: 'التسليم', phase: phases.handover, color: 'green', icon: '✅',
            desc: 'تسليم الوحدات، الدفعات النهائية، إغلاق الحسابات' },
        ].map(({ label, phase, color, icon, desc }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="font-bold">{label}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">{desc}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">البدء:</span>{' '}
                  <span className="font-medium">{monthLabels[phase.start - 1]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">الانتهاء:</span>{' '}
                  <span className="font-medium">{monthLabels[phase.end - 1]}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">المدة:</span>{' '}
                  <span className="font-bold">{phase.months} شهر</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cost Items Tab
// ═══════════════════════════════════════════════════════════════

function CostItemsTab({ cfProjectId, costItems, onRefresh }: {
  cfProjectId: number;
  costItems: any[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const deleteMutation = trpc.cashFlowProgram.deleteCostItem.useMutation({
    onSuccess: () => { toast.success('تم الحذف'); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  // Group by funding source
  const developerItems = costItems.filter((i: any) => i.fundingSource !== 'escrow');
  const escrowItems = costItems.filter((i: any) => i.fundingSource === 'escrow');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">بنود التكاليف ({costItems.length})</h3>
        <CostItemDialog
          cfProjectId={cfProjectId}
          open={showAdd}
          onOpenChange={(v) => { setShowAdd(v); if (!v) setEditItem(null); }}
          onSaved={onRefresh}
          editItem={editItem}
        />
      </div>

      {costItems.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <DollarSign className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-medium mb-1">لا توجد بنود تكاليف</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm text-center">
              أضف بنود التكاليف مثل: تكلفة الأرض، أتعاب المقاول، رسوم الاستشاريين، وغيرها
            </p>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 ml-1" />
              إضافة أول بند
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Developer-funded items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-500" />
                تمويل المستثمر
                <Badge variant="outline" className="mr-auto">{developerItems.length} بند</Badge>
                <span className="text-muted-foreground font-normal">
                  {formatFullAED(developerItems.reduce((s: number, i: any) => s + i.totalAmount, 0))} AED
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CostItemsList
                items={developerItems}
                onEdit={(item) => { setEditItem(item); setShowAdd(true); }}
                onDelete={(id) => deleteMutation.mutate({ id })}
              />
            </CardContent>
          </Card>

          {/* Escrow-funded items */}
          {escrowItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  تمويل الإسكرو
                  <Badge variant="outline" className="mr-auto">{escrowItems.length} بند</Badge>
                  <span className="text-muted-foreground font-normal">
                    {formatFullAED(escrowItems.reduce((s: number, i: any) => s + i.totalAmount, 0))} AED
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CostItemsList
                  items={escrowItems}
                  onEdit={(item) => { setEditItem(item); setShowAdd(true); }}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function CostItemsList({ items, onEdit, onDelete }: {
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">لا توجد بنود</p>;
  }

  return (
    <div className="space-y-1">
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#6b7280' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{CATEGORY_LABELS[item.category] || item.category}</span>
              <span>·</span>
              <span>{PAYMENT_TYPE_LABELS[item.paymentType] || item.paymentType}</span>
              {item.phaseTag && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {PHASE_LABELS[item.phaseTag] || item.phaseTag}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="text-sm font-mono font-semibold">{formatFullAED(item.totalAmount)}</div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cost Item Dialog
// ═══════════════════════════════════════════════════════════════

function CostItemDialog({ cfProjectId, open, onOpenChange, onSaved, editItem }: {
  cfProjectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editItem?: any;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('lump_sum');
  const [fundingSource, setFundingSource] = useState('developer');
  const [phaseTag, setPhaseTag] = useState('pre_dev');
  const [paymentMonth, setPaymentMonth] = useState(1);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setCategory(editItem.category);
      setTotalAmount(editItem.totalAmount);
      setPaymentType(editItem.paymentType);
      setFundingSource(editItem.fundingSource || 'developer');
      setPhaseTag(editItem.phaseTag || 'pre_dev');
      const params = editItem.paymentParams ? (typeof editItem.paymentParams === 'string' ? JSON.parse(editItem.paymentParams) : editItem.paymentParams) : {};
      setPaymentMonth(params.paymentMonth || 1);
    } else {
      setName('');
      setCategory('other');
      setTotalAmount(0);
      setPaymentType('lump_sum');
      setFundingSource('developer');
      setPhaseTag('pre_dev');
      setPaymentMonth(1);
    }
  }, [editItem, open]);

  const saveMutation = trpc.cashFlowProgram.saveCostItem.useMutation({
    onSuccess: () => {
      toast.success(editItem ? 'تم التحديث' : 'تم الإضافة');
      onOpenChange(false);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const paymentParams: any = {};
    if (paymentType === 'lump_sum') paymentParams.paymentMonth = paymentMonth;

    saveMutation.mutate({
      id: editItem?.id,
      cfProjectId,
      name,
      category: category as any,
      totalAmount,
      paymentType: paymentType as any,
      paymentParams: JSON.stringify(paymentParams),
      sortOrder: editItem?.sortOrder || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 ml-1" />
          إضافة بند
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'تعديل بند' : 'إضافة بند تكلفة'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>اسم البند</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تكلفة شراء الأرض" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الفئة</Label>
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
              <Label>المبلغ (AED)</Label>
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} placeholder="مثال: 5000000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>نوع الدفع</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>مصدر التمويل</Label>
              <Select value={fundingSource} onValueChange={setFundingSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNDING_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المرحلة</Label>
              <Select value={phaseTag} onValueChange={setPhaseTag}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PHASE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentType === 'lump_sum' && (
              <div>
                <Label>شهر الدفع</Label>
                <Input type="number" value={paymentMonth} onChange={(e) => setPaymentMonth(Number(e.target.value))} min={1} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">إلغاء</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!name || saveMutation.isPending}>
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Monthly Table Tab
// ═══════════════════════════════════════════════════════════════

function MonthlyTableTab({ dual }: { dual: any }) {
  const table = dual.monthlyTable || [];
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  // Calculate phase subtotals
  const phaseSubtotals = {
    pre_dev: { devOut: 0, devCum: 0, escIn: 0, escOut: 0, escBal: 0, net: 0, cumNet: 0 },
    construction: { devOut: 0, devCum: 0, escIn: 0, escOut: 0, escBal: 0, net: 0, cumNet: 0 },
    handover: { devOut: 0, devCum: 0, escIn: 0, escOut: 0, escBal: 0, net: 0, cumNet: 0 },
  };
  let lastRow: any = null;
  for (const row of table) {
    const p = phaseSubtotals[row.phase as keyof typeof phaseSubtotals];
    if (p) {
      p.devOut += row.developerOutflow;
      p.escIn += row.escrowInflow;
      p.escOut += row.escrowOutflow;
      p.net += row.netCashFlow;
    }
    lastRow = row;
  }

  // Find phase boundaries for separator rows
  const phaseBoundaries: Record<string, number> = {};
  for (let i = 0; i < table.length; i++) {
    if (!phaseBoundaries[table[i].phase]) {
      phaseBoundaries[table[i].phase] = i;
    }
  }

  const totalDevOut = table.reduce((s: number, r: any) => s + r.developerOutflow, 0);
  const totalEscIn = table.reduce((s: number, r: any) => s + r.escrowInflow, 0);
  const totalEscOut = table.reduce((s: number, r: any) => s + r.escrowOutflow, 0);

  return (
    <div className="space-y-4">
      {/* Header with summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-lg p-3">
          <div className="text-[10px] text-amber-600 font-medium mb-0.5">إجمالي تمويل المستثمر</div>
          <div className="text-base font-bold text-amber-700 font-mono">{formatFullAED(totalDevOut)}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200/50 rounded-lg p-3">
          <div className="text-[10px] text-green-600 font-medium mb-0.5">إجمالي إيرادات المبيعات</div>
          <div className="text-base font-bold text-green-700 font-mono">{formatFullAED(totalEscIn)}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 rounded-lg p-3">
          <div className="text-[10px] text-red-600 font-medium mb-0.5">إجمالي مدفوعات الإسكرو</div>
          <div className="text-base font-bold text-red-700 font-mono">{formatFullAED(totalEscOut)}</div>
        </div>
        <div className={`border rounded-lg p-3 ${(lastRow?.cumulativeNet || 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50' : 'bg-red-50 dark:bg-red-950/20 border-red-200/50'}`}>
          <div className="text-[10px] text-muted-foreground font-medium mb-0.5">صافي التدفق النقدي</div>
          <div className={`text-base font-bold font-mono ${(lastRow?.cumulativeNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatFullAED(lastRow?.cumulativeNet || 0)}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          الجدول الشهري التفصيلي
          <Badge variant="secondary" className="text-xs">{table.length} شهر</Badge>
        </h3>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'summary' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('summary')}
          >
            ملخص
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
          >
            تفصيلي
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse" dir="rtl">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="py-2.5 px-3 text-right font-semibold sticky right-0 bg-slate-800 z-10 min-w-[50px]">#</th>
                  <th className="py-2.5 px-3 text-right font-semibold sticky right-[50px] bg-slate-800 z-10 min-w-[90px]">الشهر</th>
                  <th className="py-2.5 px-3 text-center font-semibold min-w-[80px]">المرحلة</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[120px]" style={{ color: '#fbbf24' }}>مصروفات المستثمر</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[130px]" style={{ color: '#fbbf24' }}>تراكمي المستثمر</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[120px]" style={{ color: '#4ade80' }}>إيرادات (إسكرو)</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[120px]" style={{ color: '#f87171' }}>مدفوعات (إسكرو)</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[120px]" style={{ color: '#60a5fa' }}>رصيد الإسكرو</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[110px]">صافي الشهر</th>
                  <th className="py-2.5 px-3 text-left font-semibold min-w-[130px]">صافي تراكمي</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row: any, i: number) => {
                  // Phase separator row
                  const isPhaseStart = phaseBoundaries[row.phase] === i && i > 0;
                  const phaseColor = row.phase === 'pre_dev' ? 'bg-amber-100/80 dark:bg-amber-900/20' :
                    row.phase === 'construction' ? 'bg-blue-100/80 dark:bg-blue-900/20' :
                    'bg-emerald-100/80 dark:bg-emerald-900/20';
                  const prevPhase = i > 0 ? table[i - 1].phase : null;

                  return (
                    <React.Fragment key={`row-group-${i}`}>
                      {/* Phase subtotal row */}
                      {isPhaseStart && prevPhase && (
                        <tr key={`sub-${prevPhase}`} className="bg-slate-100 dark:bg-slate-800/50 border-y-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={3} className="py-2 px-3 font-bold text-right text-slate-700 dark:text-slate-300 sticky right-0 bg-slate-100 dark:bg-slate-800/50 z-10">
                            إجمالي {PHASE_LABELS[prevPhase]}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-amber-700">
                            {formatFullAED(phaseSubtotals[prevPhase as keyof typeof phaseSubtotals]?.devOut || 0)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-amber-800">
                            {formatFullAED(table[i - 1].developerCumulative)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-green-700">
                            {formatFullAED(phaseSubtotals[prevPhase as keyof typeof phaseSubtotals]?.escIn || 0)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-red-700">
                            {formatFullAED(phaseSubtotals[prevPhase as keyof typeof phaseSubtotals]?.escOut || 0)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-blue-700">
                            {formatFullAED(table[i - 1].escrowBalance)}
                          </td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 text-left font-mono font-bold">
                            {formatFullAED(table[i - 1].cumulativeNet)}
                          </td>
                        </tr>
                      )}
                      {/* Phase header row */}
                      {isPhaseStart && (
                        <tr key={`header-${row.phase}`} className={`${phaseColor}`}>
                          <td colSpan={10} className="py-1.5 px-3 font-bold text-sm">
                            {row.phase === 'construction' ? '🔨' : row.phase === 'handover' ? '✅' : '📐'}
                            {' '}{PHASE_LABELS[row.phase]}
                          </td>
                        </tr>
                      )}
                      {/* Data row */}
                      <tr
                        key={i}
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                          i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-2 px-3 text-right text-slate-400 text-xs sticky right-0 bg-inherit z-10">{row.month}</td>
                        <td className="py-2 px-3 text-right font-medium text-xs sticky right-[50px] bg-inherit z-10">{row.label}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: (PHASE_COLORS[row.phase] || '#6b7280') + '15',
                              color: PHASE_COLORS[row.phase] || '#6b7280',
                              border: `1px solid ${(PHASE_COLORS[row.phase] || '#6b7280')}30`,
                            }}
                          >
                            {PHASE_LABELS[row.phase]}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-xs">
                          {row.developerOutflow > 0 ? (
                            <span className="text-amber-600">{formatFullAED(row.developerOutflow)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-xs font-semibold text-amber-700">
                          {formatFullAED(row.developerCumulative)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-xs">
                          {row.escrowInflow > 0 ? (
                            <span className="text-green-600">+{formatFullAED(row.escrowInflow)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-xs">
                          {row.escrowOutflow > 0 ? (
                            <span className="text-red-600">-{formatFullAED(row.escrowOutflow)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className={`py-2 px-3 text-left font-mono text-xs font-semibold ${
                          row.escrowBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatFullAED(row.escrowBalance)}
                        </td>
                        <td className={`py-2 px-3 text-left font-mono text-xs font-medium ${
                          row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {row.netCashFlow >= 0 ? '+' : ''}{formatFullAED(row.netCashFlow)}
                        </td>
                        <td className={`py-2 px-3 text-left font-mono text-xs font-bold ${
                          row.cumulativeNet >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {formatFullAED(row.cumulativeNet)}
                        </td>
                      </tr>

                      {/* Detailed breakdown rows */}
                      {viewMode === 'detailed' && (row.developerOutflow > 0 || row.escrowOutflow > 0) && (
                        <tr key={`detail-${i}`} className="bg-slate-50/80 dark:bg-slate-800/20">
                          <td colSpan={10} className="py-1 px-6">
                            <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-[10px] text-muted-foreground">
                              {Object.entries(row.developerBreakdown || {}).map(([name, val]: [string, any]) => (
                                <span key={name} className="text-amber-600">
                                  {name}: {formatFullAED(val)}
                                </span>
                              ))}
                              {Object.entries(row.escrowBreakdown || {}).map(([name, val]: [string, any]) => (
                                <span key={name} className="text-blue-600">
                                  {name}: {formatFullAED(val)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Last phase subtotal */}
                {table.length > 0 && (
                  <tr className="bg-slate-100 dark:bg-slate-800/50 border-y-2 border-slate-300 dark:border-slate-600">
                    <td colSpan={3} className="py-2 px-3 font-bold text-right text-slate-700 dark:text-slate-300 sticky right-0 bg-slate-100 dark:bg-slate-800/50 z-10">
                      إجمالي {PHASE_LABELS[table[table.length - 1].phase]}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-amber-700">
                      {formatFullAED(phaseSubtotals[table[table.length - 1].phase as keyof typeof phaseSubtotals]?.devOut || 0)}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-amber-800">
                      {formatFullAED(lastRow?.developerCumulative || 0)}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-green-700">
                      {formatFullAED(phaseSubtotals[table[table.length - 1].phase as keyof typeof phaseSubtotals]?.escIn || 0)}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-red-700">
                      {formatFullAED(phaseSubtotals[table[table.length - 1].phase as keyof typeof phaseSubtotals]?.escOut || 0)}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-blue-700">
                      {formatFullAED(lastRow?.escrowBalance || 0)}
                    </td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3 text-left font-mono font-bold">
                      {formatFullAED(lastRow?.cumulativeNet || 0)}
                    </td>
                  </tr>
                )}
                {/* Grand total */}
                <tr className="bg-slate-800 text-white">
                  <td colSpan={3} className="py-3 px-3 font-bold text-right sticky right-0 bg-slate-800 z-10 text-base">
                    الإجمالي الكلي
                  </td>
                  <td className="py-3 px-3 text-left font-mono font-bold text-amber-300 text-sm">
                    {formatFullAED(totalDevOut)}
                  </td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-left font-mono font-bold text-green-300 text-sm">
                    {formatFullAED(totalEscIn)}
                  </td>
                  <td className="py-3 px-3 text-left font-mono font-bold text-red-300 text-sm">
                    {formatFullAED(totalEscOut)}
                  </td>
                  <td className="py-3 px-3 text-left font-mono font-bold text-blue-300 text-sm">
                    {formatFullAED(lastRow?.escrowBalance || 0)}
                  </td>
                  <td className="py-3 px-3"></td>
                  <td className={`py-3 px-3 text-left font-mono font-bold text-sm ${
                    (lastRow?.cumulativeNet || 0) >= 0 ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {formatFullAED(lastRow?.cumulativeNet || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Phase Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            ملخص المراحل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm border-collapse" dir="rtl">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="py-2 px-3 text-right font-semibold">المرحلة</th>
                <th className="py-2 px-3 text-left font-semibold text-amber-600">تمويل المستثمر</th>
                <th className="py-2 px-3 text-left font-semibold text-green-600">إيرادات الإسكرو</th>
                <th className="py-2 px-3 text-left font-semibold text-red-600">مدفوعات الإسكرو</th>
                <th className="py-2 px-3 text-left font-semibold">صافي المرحلة</th>
              </tr>
            </thead>
            <tbody>
              {(['pre_dev', 'construction', 'handover'] as const).map((phase) => {
                const sub = phaseSubtotals[phase];
                const net = sub.escIn - sub.devOut - sub.escOut;
                return (
                  <tr key={phase} className="border-b hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full ml-2" style={{ backgroundColor: PHASE_COLORS[phase] }} />
                      {PHASE_LABELS[phase]}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono text-amber-700">{formatFullAED(sub.devOut)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-green-700">{formatFullAED(sub.escIn)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-red-700">{formatFullAED(sub.escOut)}</td>
                    <td className={`py-2.5 px-3 text-left font-mono font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatFullAED(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 dark:bg-slate-800/30 font-bold">
                <td className="py-2.5 px-3">الإجمالي</td>
                <td className="py-2.5 px-3 text-left font-mono text-amber-700">{formatFullAED(totalDevOut)}</td>
                <td className="py-2.5 px-3 text-left font-mono text-green-700">{formatFullAED(totalEscIn)}</td>
                <td className="py-2.5 px-3 text-left font-mono text-red-700">{formatFullAED(totalEscOut)}</td>
                <td className={`py-2.5 px-3 text-left font-mono ${(lastRow?.cumulativeNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatFullAED(lastRow?.cumulativeNet || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Project Settings Tab
// ═══════════════════════════════════════════════════════════════

function ProjectSettingsTab({ cfProjectId, project, onRefresh }: {
  cfProjectId: number;
  project: any;
  onRefresh: () => void;
}) {
  const [startDate, setStartDate] = useState(project.startDate);
  const [preDevMonths, setPreDevMonths] = useState(project.preDevMonths || project.designApprovalMonths + project.reraSetupMonths);
  const [constructionMonths, setConstructionMonths] = useState(project.constructionMonths);
  const [handoverMonths, setHandoverMonths] = useState(project.handoverMonths);
  const [salesEnabled, setSalesEnabled] = useState(!!project.salesEnabled);
  const [salesStartMonth, setSalesStartMonth] = useState(project.salesStartMonth || 7);
  const [totalSalesRevenue, setTotalSalesRevenue] = useState(project.totalSalesRevenue || 0);
  const [bookingPct, setBookingPct] = useState(parseFloat(project.buyerPlanBookingPct || '20'));
  const [constructionPct, setConstructionPct] = useState(parseFloat(project.buyerPlanConstructionPct || '30'));
  const [handoverPct, setHandoverPct] = useState(parseFloat(project.buyerPlanHandoverPct || '50'));
  const [escrowDepositPct, setEscrowDepositPct] = useState(parseFloat(project.escrowDepositPct || '20'));
  const [contractorAdvancePct, setContractorAdvancePct] = useState(parseFloat(project.contractorAdvancePct || '10'));
  const [liquidityBufferPct, setLiquidityBufferPct] = useState(parseFloat(project.liquidityBufferPct || '5'));

  const updateMutation = trpc.cashFlowProgram.updateProject.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث الإعدادات');
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: cfProjectId,
      startDate,
      preDevMonths,
      constructionMonths,
      handoverMonths,
      salesEnabled,
      salesStartMonth,
      totalSalesRevenue,
      buyerPlanBookingPct: bookingPct,
      buyerPlanConstructionPct: constructionPct,
      buyerPlanHandoverPct: handoverPct,
      escrowDepositPct,
      contractorAdvancePct,
      liquidityBufferPct,
    });
  };

  return (
    <div className="space-y-6">
      {/* Phase Durations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            المراحل والمدد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>تاريخ البدء</Label>
              <Input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>ما قبل البناء (أشهر)</Label>
              <Input type="number" value={preDevMonths} onChange={(e) => setPreDevMonths(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>البناء (أشهر)</Label>
              <Input type="number" value={constructionMonths} onChange={(e) => setConstructionMonths(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>التسليم (أشهر)</Label>
              <Input type="number" value={handoverMonths} onChange={(e) => setHandoverMonths(Number(e.target.value))} min={1} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            إعدادات المبيعات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={salesEnabled} onCheckedChange={setSalesEnabled} />
            <Label>تفعيل المبيعات</Label>
          </div>
          {salesEnabled && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>إجمالي الإيرادات (AED)</Label>
                <Input type="number" value={totalSalesRevenue} onChange={(e) => setTotalSalesRevenue(Number(e.target.value))} />
              </div>
              <div>
                <Label>شهر بدء المبيعات</Label>
                <Input type="number" value={salesStartMonth} onChange={(e) => setSalesStartMonth(Number(e.target.value))} min={1} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label>خطة الدفع للمشتري</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div>
                    <Label className="text-xs">حجز %</Label>
                    <Input type="number" value={bookingPct} onChange={(e) => setBookingPct(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">بناء %</Label>
                    <Input type="number" value={constructionPct} onChange={(e) => setConstructionPct(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">تسليم %</Label>
                    <Input type="number" value={handoverPct} onChange={(e) => setHandoverPct(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escrow Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            إعدادات الإسكرو والتمويل
          </CardTitle>
          <CardDescription>نسب تمويل المستثمر من تكلفة البناء (35% افتراضي)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>إيداع الإسكرو %</Label>
              <Input type="number" value={escrowDepositPct} onChange={(e) => setEscrowDepositPct(Number(e.target.value))} />
            </div>
            <div>
              <Label>دفعة مقدمة للمقاول %</Label>
              <Input type="number" value={contractorAdvancePct} onChange={(e) => setContractorAdvancePct(Number(e.target.value))} />
            </div>
            <div>
              <Label>هامش سيولة %</Label>
              <Input type="number" value={liquidityBufferPct} onChange={(e) => setLiquidityBufferPct(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
            <span className="font-semibold">إجمالي تمويل المستثمر من البناء: </span>
            <span className="text-amber-600 font-bold">{escrowDepositPct + contractorAdvancePct + liquidityBufferPct}%</span>
            <span className="text-muted-foreground"> · الباقي من الإسكرو: </span>
            <span className="text-blue-600 font-bold">{100 - escrowDepositPct - contractorAdvancePct - liquidityBufferPct}%</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
        <Save className="h-4 w-4 ml-2" />
        {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Export Excel Button
// ═══════════════════════════════════════════════════════════════

function ExportExcelButton({ cfProjectId }: { cfProjectId: number }) {
  const exportMutation = trpc.cashFlowProgram.exportCashFlowExcel.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('تم تصدير التقرير بنجاح');
    },
    onError: (err) => {
      toast.error('فشل التصدير: ' + err.message);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportMutation.mutate({ cfProjectId })}
      disabled={exportMutation.isPending}
    >
      <Download className="h-4 w-4 ml-1" />
      {exportMutation.isPending ? 'جاري التصدير...' : 'تصدير Excel'}
    </Button>
  );
}
