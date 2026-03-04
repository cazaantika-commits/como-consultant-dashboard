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
  Clock, Landmark, Briefcase, Hammer, Eye, FileText, Percent, FileSpreadsheet,
  GitCompare, Wallet, Building, ShieldCheck, ArrowUpDown
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
  supervision: 'الإشراف',
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
  supervision: '#ea580c',
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

  const projectsQuery = trpc.cashFlowProgram.listProjects.useQuery();
  const feasibilityQuery = trpc.cashFlowProgram.importFromFeasibility.useQuery(
    { projectId: 0 },
    { enabled: false }
  );

  const projects = projectsQuery.data || [];

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        cfProjectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            برنامج العمل والتدفقات النقدية
          </h1>
          <p className="text-muted-foreground mt-1">
            نموذج تدفق نقدي مزدوج — تمويل المستثمر + حساب الإسكرو
          </p>
        </div>
        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={() => projectsQuery.refetch()}
        />
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">لا توجد مشاريع</p>
            <p className="text-sm text-muted-foreground mb-4">أنشئ مشروعاً جديداً أو استورد من دراسة الجدوى</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              مشروع جديد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedProjectId(p.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {p.startDate}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-amber-500/10 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">ما قبل البناء</div>
                    <div className="font-bold text-amber-600">{p.preDevMonths || p.designApprovalMonths + p.reraSetupMonths} شهر</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">البناء</div>
                    <div className="font-bold text-blue-600">{p.constructionMonths} شهر</div>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">التسليم</div>
                    <div className="font-bold text-green-600">{p.handoverMonths} شهر</div>
                  </div>
                </div>
                {p.totalSalesRevenue && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    الإيرادات: <span className="font-semibold text-foreground">{formatAED(p.totalSalesRevenue)} AED</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
      toast.success('تم إنشاء المشروع');
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
          <DialogTitle>إنشاء مشروع تدفق نقدي</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="feasibility" className="flex-1">من دراسة الجدوى</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">يدوي</TabsTrigger>
          </TabsList>

          <TabsContent value="feasibility" className="space-y-4 mt-4">
            <div>
              <Label>اختر دراسة الجدوى</Label>
              <Select onValueChange={(v) => setSelectedFeasId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مشروع ند الشبا" />
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            بدء: {project.startDate} · {(project.preDevMonths || project.designApprovalMonths + project.reraSetupMonths) + project.constructionMonths + project.handoverMonths} شهر إجمالي
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          cashFlowQuery.refetch();
          costItemsQuery.refetch();
        }}>
          <RefreshCw className="h-4 w-4 ml-1" />
          تحديث
        </Button>
      </div>

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
          <TabsTrigger value="costs" className="gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            بنود التكاليف
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

  // Build chart data
  const maxVal = Math.max(
    ...table.map((r: any) => Math.max(Math.abs(r.developerCumulative), Math.abs(r.escrowBalance), Math.abs(r.cumulativeNet)))
  );

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
          onOpenChange={setShowAdd}
          onSaved={onRefresh}
          editItem={editItem}
        />
      </div>

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
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} />
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
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">الجدول الشهري ({table.length} شهر)</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
            <Eye className="h-4 w-4 ml-1" />
            {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-right sticky right-0 bg-muted/50 z-10">الشهر</th>
                  <th className="p-2 text-center">المرحلة</th>
                  <th className="p-2 text-left text-amber-600">مصروفات المستثمر</th>
                  <th className="p-2 text-left text-amber-600">تراكمي المستثمر</th>
                  <th className="p-2 text-left text-green-600">إيرادات الإسكرو</th>
                  <th className="p-2 text-left text-red-600">مصروفات الإسكرو</th>
                  <th className="p-2 text-left text-blue-600">رصيد الإسكرو</th>
                  <th className="p-2 text-left font-bold">صافي الشهر</th>
                  <th className="p-2 text-left font-bold">صافي تراكمي</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row: any, i: number) => (
                  <tr
                    key={i}
                    className={`border-b hover:bg-muted/30 ${
                      row.phase === 'pre_dev' ? 'bg-amber-500/5' :
                      row.phase === 'construction' ? 'bg-blue-500/5' :
                      'bg-green-500/5'
                    }`}
                  >
                    <td className="p-2 font-medium sticky right-0 bg-inherit z-10 text-xs">{row.label}</td>
                    <td className="p-2 text-center">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: PHASE_COLORS[row.phase], color: PHASE_COLORS[row.phase] }}
                      >
                        {PHASE_LABELS[row.phase]}
                      </Badge>
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-amber-600">
                      {row.developerOutflow > 0 ? formatFullAED(row.developerOutflow) : '-'}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-amber-700 font-semibold">
                      {formatFullAED(row.developerCumulative)}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-green-600">
                      {row.escrowInflow > 0 ? formatFullAED(row.escrowInflow) : '-'}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-red-600">
                      {row.escrowOutflow > 0 ? formatFullAED(row.escrowOutflow) : '-'}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-blue-600 font-semibold">
                      {formatFullAED(row.escrowBalance)}
                    </td>
                    <td className={`p-2 text-left font-mono text-xs font-semibold ${row.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatFullAED(row.netCashFlow)}
                    </td>
                    <td className={`p-2 text-left font-mono text-xs font-bold ${row.cumulativeNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatFullAED(row.cumulativeNet)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-bold">
                  <td className="p-2 sticky right-0 bg-muted/30 z-10">الإجمالي</td>
                  <td className="p-2"></td>
                  <td className="p-2 text-left font-mono text-amber-700">
                    {formatFullAED(table.reduce((s: number, r: any) => s + r.developerOutflow, 0))}
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2 text-left font-mono text-green-700">
                    {formatFullAED(table.reduce((s: number, r: any) => s + r.escrowInflow, 0))}
                  </td>
                  <td className="p-2 text-left font-mono text-red-700">
                    {formatFullAED(table.reduce((s: number, r: any) => s + r.escrowOutflow, 0))}
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2 text-left font-mono">
                    {formatFullAED(table[table.length - 1]?.cumulativeNet || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
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
      designApprovalMonths: preDevMonths,
      reraSetupMonths: 0,
      constructionMonths,
      handoverMonths,
      salesEnabled,
      salesStartMonth,
      totalSalesRevenue,
      buyerPlanBookingPct: bookingPct,
      buyerPlanConstructionPct: constructionPct,
      buyerPlanHandoverPct: handoverPct,
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
