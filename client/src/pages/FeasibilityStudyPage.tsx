import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Save, Plus, Trash2, Calculator, DollarSign, BarChart3,
  FileText, MapPin, Ruler, TrendingUp, PieChart, Loader2,
  Sparkles, Copy, Brain, Globe, FolderOpen, ShieldCheck, Users,
  Landmark, Percent, ChevronDown, BookOpen, Scale, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import CostsCashFlowTab from "@/components/feasibility/CostsCashFlowTab";
import JoelleEngineTab from "@/components/feasibility/JoelleEngineTab";
import JoelleDataManager from "@/components/feasibility/JoelleDataManager";
import CashFlowSettingsPage from "@/pages/CashFlowSettingsPage";
import CapitalScheduleTablePage from "@/pages/CapitalScheduleTablePage";

// ═══════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString("en-US");
}

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// Editable number input with local state for decimal support
function NumInput({
  label, value, onChange, suffix, hint, disabled,
}: {
  label: string; value: number | null | undefined;
  onChange: (v: number | null) => void; suffix?: string;
  hint?: string; disabled?: boolean;
}) {
  const [localVal, setLocalVal] = useState<string>("");
  const [focused, setFocused] = useState(false);

  const displayVal = focused ? localVal : (value != null ? fmt(value) : "");

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="text"
          value={displayVal}
          onFocus={() => {
            setFocused(true);
            setLocalVal(value != null ? String(value) : "");
          }}
          onBlur={() => {
            setFocused(false);
            const parsed = parseNum(localVal);
            onChange(parsed);
          }}
          onChange={(e) => {
            setLocalVal(e.target.value);
          }}
          className={`text-sm h-9 text-right ${suffix ? "pl-12" : ""} ${disabled ? "bg-muted/50" : ""}`}
          placeholder="0"
          disabled={disabled}
          dir="ltr"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

// Read-only computed value display
function ReadOnlyValue({
  label, value, suffix, highlight, large,
}: {
  label: string; value: number | null | undefined;
  suffix?: string; highlight?: boolean; large?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${large ? "py-3" : ""}`}>
      <span className={`text-sm ${highlight ? "font-bold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span
        className={`font-mono ${large ? "text-lg font-bold" : "text-sm font-semibold"} ${
          highlight ? ((value ?? 0) >= 0 ? "text-emerald-600" : "text-red-600") : "text-foreground"
        }`}
        dir="ltr"
      >
        {fmt(value)} {suffix || "AED"}
      </span>
    </div>
  );
}

// Section header
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// Joelle placeholder (when content not generated yet)
function JoellePlaceholder({ message, subMessage }: { message: string; subMessage: string }) {
  return (
    <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl font-bold text-purple-400">ج</span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{subMessage}</p>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export default function FeasibilityStudyPage({ embedded, initialProjectId }: { embedded?: boolean; initialProjectId?: number | null } = {}) {
  const { user, loading, isAuthenticated, isReadOnly } = useAuth();
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("tab5");
  const [form, setForm] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  // Projects query
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  // Studies query - get studies for selected project
  const studiesByProjectQuery = trpc.feasibility.listByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const studyQuery = trpc.feasibility.getById.useQuery(selectedStudyId || 0, { enabled: !!selectedStudyId });
  const syncStatusQuery = trpc.costsCashFlow.getSyncStatus.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
    refetchInterval: 60000,
  });

  // Auto-load or auto-create study when project is selected
  useEffect(() => {
    if (!selectedProjectId || studiesByProjectQuery.isLoading) return;
    const studies = studiesByProjectQuery.data || [];
    if (studies.length > 0) {
      // Study exists - load it
      setSelectedStudyId(studies[0].id);
      setAutoCreating(false);
    } else if (!autoCreating) {
      // No study - auto-create one
      const project = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
      if (project) {
        setAutoCreating(true);
        createMutation.mutate({
          projectName: project.name,
          projectId: selectedProjectId,
          separationFeePerM2: project.separationFeePerM2 ? parseFloat(project.separationFeePerM2) : 40,
          landPrice: project.landPrice ? parseFloat(project.landPrice) : null,
          agentCommissionLandPct: project.agentCommissionLandPct ? parseFloat(project.agentCommissionLandPct) : null,
          estimatedBua: project.manualBuaSqft ? parseFloat(project.manualBuaSqft) : null,
          constructionCostPerSqft: project.estimatedConstructionPricePerSqft ? parseFloat(project.estimatedConstructionPricePerSqft) : null,
        });
      }
    }
  }, [selectedProjectId, studiesByProjectQuery.data, studiesByProjectQuery.isLoading]);

  // Mutations
  const createMutation = trpc.feasibility.create.useMutation({
    onSuccess: (data) => { studiesByProjectQuery.refetch(); setSelectedStudyId(data.id); setAutoCreating(false); toast.success("تم إنشاء الدراسة بنجاح"); },
    onError: () => { setAutoCreating(false); toast.error("خطأ في إنشاء الدراسة"); },
  });
  const updateMutation = trpc.feasibility.update.useMutation({
    onSuccess: () => { studiesByProjectQuery.refetch(); studyQuery.refetch(); setIsDirty(false); toast.success("تم حفظ التغييرات"); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const deleteMutation = trpc.feasibility.delete.useMutation({
    onSuccess: () => { studiesByProjectQuery.refetch(); setSelectedStudyId(null); setForm({}); toast.success("تم حذف الدراسة"); },
  });
  // AI mutations removed - now handled by Joelle Engine

  // Load study data into form
  const loadedStudyId = studyQuery.data?.id;
  useMemo(() => {
    if (studyQuery.data && studyQuery.data.id === selectedStudyId) {
      setForm({ ...studyQuery.data });
      setIsDirty(false);
    }
  }, [loadedStudyId, selectedStudyId]);

  // Update form field
  const setField = useCallback((key: string, value: any) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // ═══════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════
  const computed = useMemo(() => {
    const f = form;
    const gfaRes = f.gfaResidential || 0;
    const gfaRet = f.gfaRetail || 0;
    const gfaOff = f.gfaOffices || 0;
    const totalGfa = gfaRes + gfaRet + gfaOff;

    const saleableRes = gfaRes * ((f.saleableResidentialPct || 95) / 100);
    const saleableRet = gfaRet * ((f.saleableRetailPct || 97) / 100);
    const saleableOff = gfaOff * ((f.saleableOfficesPct || 95) / 100);
    const totalSaleable = saleableRes + saleableRet + saleableOff;

    const bua = f.estimatedBua || 0;
    const constructionCost = bua * (f.constructionCostPerSqft || 0);
    const landRegistration = (f.landPrice || 0) * 0.04;
    const agentCommissionLand = (f.landPrice || 0) * ((f.agentCommissionLandPct || 1) / 100);
    const designFee = constructionCost * ((f.designFeePct || 2) / 100);
    const supervisionFee = constructionCost * ((f.supervisionFeePct || 2) / 100);
    const separationFee = totalGfa * (f.separationFeePerM2 || 40);
    const contingencies = constructionCost * ((f.contingenciesPct || 2) / 100);
    const reraUnitTotal = (f.numberOfUnits || 0) * (f.reraUnitFee || 850);

    const revenueRes = saleableRes * (f.residentialSalePrice || 0);
    const revenueRet = saleableRet * (f.retailSalePrice || 0);
    const revenueOff = saleableOff * (f.officesSalePrice || 0);
    const totalRevenue = revenueRes + revenueRet + revenueOff;

    const developerFee = totalRevenue * ((f.developerFeePct || 5) / 100);
    const agentCommissionSale = totalRevenue * ((f.agentCommissionSalePct || 5) / 100);
    const marketing = totalRevenue * ((f.marketingPct || 2) / 100);

    const totalCosts =
      (f.landPrice || 0) + agentCommissionLand + landRegistration +
      (f.soilInvestigation || 0) + (f.topographySurvey || 0) +
      designFee + supervisionFee + (f.authoritiesFee || 0) + separationFee +
      constructionCost + (f.communityFee || 0) + contingencies +
      developerFee + agentCommissionSale + marketing +
      (f.reraOffplanFee || 150000) + reraUnitTotal +
      (f.nocFee || 10000) + (f.escrowFee || 140000) +
      (f.bankCharges || 20000) + (f.surveyorFees || 12000) +
      (f.reraAuditFees || 18000) + (f.reraInspectionFees || 70000);

    const profit = totalRevenue - totalCosts;
    const offplanCoverage = constructionCost * 0.65;
    const fundingRequired = totalCosts - offplanCoverage;
    const comoProfit = profit * ((f.comoProfitSharePct || 15) / 100);
    const investorProfit = profit - comoProfit;
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalGfa, saleableRes, saleableRet, saleableOff, totalSaleable,
      constructionCost, landRegistration, agentCommissionLand,
      designFee, supervisionFee, separationFee, contingencies, reraUnitTotal,
      revenueRes, revenueRet, revenueOff, totalRevenue,
      developerFee, agentCommissionSale, marketing,
      totalCosts, profit, offplanCoverage, fundingRequired,
      comoProfit, investorProfit, roi, profitMargin,
    };
  }, [form]);

  // Save handler
  const handleSave = () => {
    if (!selectedStudyId) return;
    const { id, createdAt, updatedAt, userId, ...data } = form;
    updateMutation.mutate({ id: selectedStudyId, ...data });
  };

  // Auth check
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      <Button onClick={() => window.location.href = getLoginUrl()}>تسجيل الدخول</Button>
    </div>
  );

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-gradient-to-b from-muted/30 to-background"} dir="rtl">
      <div className="container max-w-7xl py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {!embedded && <h1 className="text-2xl font-bold text-foreground">📊 دراسة الجدوى</h1>}
            {!embedded && <p className="text-sm text-muted-foreground">تحليل شامل لجدوى المشاريع العقارية</p>}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && selectedStudyId && (
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </Button>
            )}
            {selectedStudyId && !isReadOnly && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الدراسة؟")) deleteMutation.mutate(selectedStudyId); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Project Selector - only show when NOT embedded from hub */}
        {!initialProjectId && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">اختر المشروع</Label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium"
                    value={selectedProjectId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setSelectedProjectId(val);
                      setSelectedStudyId(null);
                      setForm({});
                      setActiveTab("tab1");
                    }}
                  >
                    <option value="">— اختر مشروع —</option>
                    {(projectsQuery.data || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {autoCreating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري إنشاء الدراسة...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!selectedProjectId ? (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2">اختر مشروع لبدء دراسة الجدوى</h2>
            <p className="text-sm text-muted-foreground/70">اختر مشروع من القائمة أعلاه وستفتح الدراسة تلقائياً</p>
          </div>
        ) : !selectedStudyId ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="mt-3 text-sm text-muted-foreground">جاري تحميل الدراسة...</p></div>
        ) : studyQuery.isLoading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : (
          <>
            {/* Project Name Display */}
            <div className="px-4 py-3 bg-primary/5 rounded-xl border border-primary/10">
              <span className="text-xs text-muted-foreground">المشروع: </span>
              <span className="text-sm font-bold text-primary">{form.projectName || "—"}</span>
              {form.scenarioName && (
                <span className="mr-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{form.scenarioName}</span>
              )}
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* 3 TABS - الهيكل الجديد المبسط */}
            {/* ═══════════════════════════════════════════ */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start mb-4 bg-card border border-border h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="tab10" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">
                  📦 البيانات والمصادر
                </TabsTrigger>
                <TabsTrigger value="tab9" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white">
                  🧠 الدراسات والأبحاث
                </TabsTrigger>
                <TabsTrigger value="tab5" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
                  💰 التسعير والإيرادات
                  {syncStatusQuery.data?.isOutOfSync && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white" title="بيانات غير متزامنة" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="tab_cf_settings" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
                  ⚙️ إعدادات التدفق
                </TabsTrigger>
                <TabsTrigger value="tab_cf_reflection" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-emerald-700 data-[state=active]:to-teal-700 data-[state=active]:text-white">
                  📊 التكاليف الكلية للمشروع والجدول الزمني
                </TabsTrigger>
              </TabsList>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب الموحد: التسعير والإيرادات */}
              {/* يشمل: توزيع الوحدات + التسعير + التكاليف */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab5">
                <CostsCashFlowTab projectId={selectedProjectId} studyId={selectedStudyId} form={form} computed={computed} />
              </TabsContent>




              <TabsContent value="tab10">
                <JoelleDataManager projectId={selectedProjectId} community={form.community || ''} />
              </TabsContent>
              <TabsContent value="tab9">
                <JoelleEngineTab projectId={selectedProjectId} studyId={selectedStudyId} />
              </TabsContent>
              <TabsContent value="tab_cf_settings">
                <CashFlowSettingsPage
                  embedded
                  initialProjectId={selectedProjectId}
                  onNavigateToReflection={() => setActiveTab("tab_cf_reflection")}
                />
              </TabsContent>
              <TabsContent value="tab_cf_reflection">
                <CapitalScheduleTablePage
                  embedded
                  initialProjectId={selectedProjectId}
                />
              </TabsContent>


            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
