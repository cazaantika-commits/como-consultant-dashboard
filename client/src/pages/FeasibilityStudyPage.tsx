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
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";
import MarketOverviewTab from "@/components/feasibility/MarketOverviewTab";
import CompetitionPricingTab from "@/components/feasibility/CompetitionPricingTab";
import CostsCashFlowTab from "@/components/feasibility/CostsCashFlowTab";
import JoelleEngineTab from "@/components/feasibility/JoelleEngineTab";
import JoelleDataManager from "@/components/feasibility/JoelleDataManager";

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

export default function FeasibilityStudyPage({ embedded }: { embedded?: boolean } = {}) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("tab3");
  const [form, setForm] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  // Projects query
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  // Studies query - get studies for selected project
  const studiesByProjectQuery = trpc.feasibility.listByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const studyQuery = trpc.feasibility.getById.useQuery(selectedStudyId || 0, { enabled: !!selectedStudyId });

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
        createMutation.mutate({ projectName: project.name, projectId: selectedProjectId });
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
  const aiSummaryMutation = trpc.feasibility.generateAiSummary.useMutation({
    onSuccess: (data) => { studyQuery.refetch(); setForm((prev: Record<string, any>) => ({ ...prev, aiSummary: data.summary })); toast.success("تم إنشاء التحليل بنجاح"); },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التحليل"),
  });
  const marketAnalysisMutation = trpc.feasibility.generateMarketAnalysis.useMutation({
    onSuccess: (data) => { studyQuery.refetch(); setForm((prev: Record<string, any>) => ({ ...prev, marketAnalysis: data.analysis })); toast.success("تم تحليل السوق بنجاح"); },
    onError: (err) => toast.error(err.message || "فشل في تحليل السوق"),
  });
  const comprehensiveReportMutation = trpc.feasibility.generateComprehensiveReport.useMutation({
    onSuccess: (data) => { studyQuery.refetch(); setForm((prev: Record<string, any>) => ({ ...prev, competitorAnalysis: data.report })); toast.success("تم إنشاء التقرير الشامل"); },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const executiveReportMutation = trpc.feasibility.generateExecutiveReport.useMutation({
    onSuccess: (data) => { studyQuery.refetch(); setForm((prev: Record<string, any>) => ({ ...prev, priceRecommendation: data.report })); toast.success("تم إنشاء تقرير المجلس"); },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });

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

    const saleableRes = gfaRes * ((f.saleableResidentialPct || 90) / 100);
    const saleableRet = gfaRet * ((f.saleableRetailPct || 99) / 100);
    const saleableOff = gfaOff * ((f.saleableOfficesPct || 90) / 100);
    const totalSaleable = saleableRes + saleableRet + saleableOff;

    const bua = f.estimatedBua || 0;
    const constructionCost = bua * (f.constructionCostPerSqft || 0);
    const landRegistration = (f.landPrice || 0) * 0.04;
    const agentCommissionLand = (f.landPrice || 0) * ((f.agentCommissionLandPct || 1) / 100);
    const designFee = constructionCost * ((f.designFeePct || 2) / 100);
    const supervisionFee = constructionCost * ((f.supervisionFeePct || 2) / 100);
    const separationFee = (f.plotAreaM2 || 0) * (f.separationFeePerM2 || 40);
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
            {selectedStudyId && (
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

        {/* Project Selector - قائمة منسدلة واحدة فقط */}
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
            {/* 8 TABS - حسب تعليمات المستخدم بالضبط */}
            {/* ═══════════════════════════════════════════ */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start mb-4 bg-card border border-border h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="tab10" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">
                  📦 بيانات جويل
                </TabsTrigger>
                <TabsTrigger value="tab9" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white">
                  🧠 محرك جويل
                </TabsTrigger>
                <TabsTrigger value="tab8" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  👔 ٦. تقرير المجلس
                </TabsTrigger>
                <TabsTrigger value="tab7" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  📋 ٥. التقرير الشامل
                </TabsTrigger>
                <TabsTrigger value="tab6" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  📊 ٤. التحليل والسيناريوهات
                </TabsTrigger>
                <TabsTrigger value="tab5" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  💰 ٣. التكاليف والتدفقات
                </TabsTrigger>
                <TabsTrigger value="tab4" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  ⚔️ ٢. المنافسة والتسعير
                </TabsTrigger>
                <TabsTrigger value="tab3" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  🌍 ١. النظرة العامة والسوق
                </TabsTrigger>
              </TabsList>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 1: النظرة العامة والسوق */}
              {/* توصيات جويل + حقول قابلة للتعديل */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab3">
                <MarketOverviewTab projectId={selectedProjectId} studyId={selectedStudyId} form={form} computed={computed} />
              </TabsContent>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 4: المنافسة والتسعير */}
              {/* 3 سيناريوهات + خطة السداد */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab4">
                <CompetitionPricingTab projectId={selectedProjectId} studyId={selectedStudyId} form={form} computed={computed} />
              </TabsContent>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 5: التكاليف والتدفقات */}
              {/* حقل واحد قابل للتعديل (سعر القدم) + تقرير READ ONLY */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab5">
                <CostsCashFlowTab projectId={selectedProjectId} studyId={selectedStudyId} form={form} computed={computed} />
              </TabsContent>



              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 6: التحليل والسيناريوهات */}
              {/* تقرير من جويل: تحليل + مخاطر + توصيات + سجل المصادر + أوزان الترجيح */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab6">
                <div className="space-y-4">
                  {/* التحليل والمخاطر والتوصيات */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <SectionHeader icon={AlertTriangle} title="التحليل والمخاطر والتوصيات" />
                        <Button
                          onClick={() => { if (selectedStudyId) aiSummaryMutation.mutate(selectedStudyId); }}
                          disabled={aiSummaryMutation.isPending}
                          className="gap-2"
                        >
                          {aiSummaryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {aiSummaryMutation.isPending ? "جويل تحلل..." : "اطلب من جويل"}
                        </Button>
                      </div>
                      {form.aiSummary ? (
                        <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                          <Streamdown>{form.aiSummary}</Streamdown>
                        </div>
                      ) : (
                        <JoellePlaceholder message="لم يُنشأ هذا القسم بعد" subMessage="اضغط زر جويل أعلاه لإنشاء المحتوى" />
                      )}
                    </CardContent>
                  </Card>

                  {/* تحليل السيناريوهات */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={BarChart3} title="تحليل السيناريوهات" subtitle="مقارنة بين السيناريوهات الثلاثة" />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-border bg-muted/30">
                              <th className="text-right py-3 px-4 font-bold">المؤشر</th>
                              <th className="text-center py-3 px-4 font-bold text-emerald-600">🟢 متفائل (+15%)</th>
                              <th className="text-center py-3 px-4 font-bold text-blue-600">🔵 أساسي</th>
                              <th className="text-center py-3 px-4 font-bold text-orange-600">🟠 محافظ (-15%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: "إجمالي الإيرادات", opt: computed.totalRevenue * 1.15, base: computed.totalRevenue, cons: computed.totalRevenue * 0.85 },
                              { label: "إجمالي التكاليف", opt: computed.totalCosts, base: computed.totalCosts, cons: computed.totalCosts },
                              { label: "صافي الربح", opt: computed.totalRevenue * 1.15 - computed.totalCosts, base: computed.profit, cons: computed.totalRevenue * 0.85 - computed.totalCosts },
                              { label: "هامش الربح %", opt: computed.totalRevenue * 1.15 > 0 ? ((computed.totalRevenue * 1.15 - computed.totalCosts) / (computed.totalRevenue * 1.15)) * 100 : 0, base: computed.profitMargin, cons: computed.totalRevenue * 0.85 > 0 ? ((computed.totalRevenue * 0.85 - computed.totalCosts) / (computed.totalRevenue * 0.85)) * 100 : 0 },
                            ].map((row, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-3 px-4 font-medium">{row.label}</td>
                                <td className="py-3 px-4 text-center font-mono text-emerald-600">{i === 3 ? `${row.opt.toFixed(1)}%` : fmt(row.opt)}</td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">{i === 3 ? `${row.base.toFixed(1)}%` : fmt(row.base)}</td>
                                <td className="py-3 px-4 text-center font-mono text-orange-600">{i === 3 ? `${row.cons.toFixed(1)}%` : fmt(row.cons)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* سجل المصادر */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={BookOpen} title="سجل المصادر" subtitle="12 مصدر مسجل — 5 طبقات حسب الموثوقية" />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-border bg-muted/30">
                              <th className="text-right py-3 px-3 font-bold">المصدر</th>
                              <th className="text-center py-3 px-3 font-bold">الطبقة</th>
                              <th className="text-right py-3 px-3 font-bold">البيانات المتاحة</th>
                              <th className="text-center py-3 px-3 font-bold">التحديث</th>
                              <th className="text-center py-3 px-3 font-bold">الطريقة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { name: "Dubai REST", tier: "طبقة 1 — حكومي رسمي", tierColor: "bg-emerald-100 text-emerald-700", data: "e_status, noc_status, escrow_accounts", update: "Real-time", method: "api" },
                              { name: "DubaiNow", tier: "طبقة 1 — حكومي رسمي", tierColor: "bg-emerald-100 text-emerald-700", data: "bills, government_fees, service_requests", update: "Real-time", method: "api" },
                              { name: "Data.Dubai (Smart Dubai)", tier: "طبقة 1 — حكومي رسمي", tierColor: "bg-emerald-100 text-emerald-700", data: "density, land_use_data, utility_connections", update: "Monthly", method: "api" },
                              { name: "Dubai Statistics Center (DSC/DDSE)", tier: "طبقة 1 — حكومي رسمي", tierColor: "bg-emerald-100 text-emerald-700", data: "data, construction_permits, trade_data", update: "Quarterly", method: "manual_file" },
                              { name: "Bayut", tier: "طبقة 4 — بوابات إعلانات", tierColor: "bg-amber-100 text-amber-700", data: "areas, price_per_sqft, inventory_levels", update: "Real-time", method: "scrape" },
                              { name: "Property Finder (PF)", tier: "طبقة 4 — بوابات إعلانات", tierColor: "bg-amber-100 text-amber-700", data: "market, agent_listings, area_coverage", update: "Real-time", method: "scrape" },
                              { name: "Knight Frank (KF)", tier: "طبقة 3 — استشاري مهني", tierColor: "bg-blue-100 text-blue-700", data: "health_report, rental_analysis, capital_values", update: "Quarterly", method: "manual_file" },
                              { name: "CBRE", tier: "طبقة 3 — استشاري مهني", tierColor: "bg-blue-100 text-blue-700", data: "occupancy_rates, development_pipeline", update: "Quarterly", method: "manual_file" },
                              { name: "JLL (Jones Lang LaSalle)", tier: "طبقة 3 — استشاري مهني", tierColor: "bg-blue-100 text-blue-700", data: "rates, vacancy_rates, investment_volumes", update: "Quarterly", method: "manual_file" },
                              { name: "REIDIN", tier: "طبقة 2 — مزود بيانات أولي", tierColor: "bg-purple-100 text-purple-700", data: "historical_trends, comparable_transactions", update: "Monthly", method: "manual_file" },
                              { name: "Property Monitor (PM)", tier: "طبقة 2 — مزود بيانات أولي", tierColor: "bg-purple-100 text-purple-700", data: "rption_rate, rental_yields, market_trends", update: "Monthly", method: "manual_file" },
                              { name: "Dubai Land Department (DLD)", tier: "طبقة 1 — حكومي رسمي", tierColor: "bg-emerald-100 text-emerald-700", data: "mber, buyer_nationality, mortgage_data", update: "Daily", method: "manual_file" },
                            ].map((src, i) => (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                                <td className="py-2.5 px-3 font-medium">{src.name}</td>
                                <td className="py-2.5 px-3 text-center"><span className={`text-[10px] px-2 py-1 rounded-full font-bold ${src.tierColor}`}>{src.tier}</span></td>
                                <td className="py-2.5 px-3 text-xs text-muted-foreground">{src.data}</td>
                                <td className="py-2.5 px-3 text-center text-xs">{src.update}</td>
                                <td className="py-2.5 px-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded font-mono ${src.method === 'api' ? 'text-emerald-600' : src.method === 'scrape' ? 'text-amber-600' : 'text-blue-600'}`}>{src.method}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* جدول أوزان الترجيح */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={Scale} title="جدول أوزان الترجيح" subtitle="يُطبّق تلقائياً عند مصالحة بيانات من مصادر متعددة" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {[
                          { title: "المعاملات المسجلة", weights: "DLD 80% · PM 15% · REIDIN 5%", bg: "bg-stone-50" },
                          { title: "الإيجارات المسجلة", weights: "DLD 80% · PM 15% · Portals 5%", bg: "bg-stone-50" },
                          { title: "خط الإمداد والمعروض", weights: "PM 45% · REIDIN 45% · DLD 10%", bg: "bg-stone-50" },
                          { title: "أسعار الطلب", weights: "Brochure 60% · Portals 35% · Calls 5%", bg: "bg-stone-50" },
                          { title: "البيانات السكانية", weights: "DDSE 80% · Research 20%", bg: "bg-stone-50" },
                          { title: "التنظيمي / القانوني", weights: "Official 100%", bg: "bg-stone-50" },
                        ].map((cat, i) => (
                          <div key={i} className={`p-4 rounded-xl ${cat.bg} border border-border`}>
                            <h4 className="font-bold text-sm mb-1">{cat.title}</h4>
                            <p className="text-xs text-muted-foreground font-mono">{cat.weights}</p>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                        <h4 className="font-bold text-sm text-red-700 mb-1">حدود التباين المسموح</h4>
                        <p className="text-xs text-red-600 font-mono">الإجماليات ±5% · الأسعار الوسطية ±3% · خط الإمداد ±10% · أسعار الطلب ±7%</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 7: التقرير الشامل المهني الاحترافي */}
              {/* تقرير من جويل - READ ONLY */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab7">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <SectionHeader icon={FileText} title="التقرير الشامل المهني الاحترافي" subtitle="تقرير مفصل من جويل يتضمن جميع جوانب المشروع" />
                      <Button
                        onClick={() => { if (selectedStudyId) comprehensiveReportMutation.mutate({ id: selectedStudyId }); }}
                        disabled={comprehensiveReportMutation.isPending}
                        className="gap-2"
                      >
                        {comprehensiveReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {comprehensiveReportMutation.isPending ? "جويل تكتب..." : "إنشاء التقرير"}
                      </Button>
                    </div>
                    {form.competitorAnalysis ? (
                      <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                        <Streamdown>{form.competitorAnalysis}</Streamdown>
                      </div>
                    ) : (
                      <JoellePlaceholder message="لم يُنشأ هذا القسم بعد" subMessage="اضغط زر جويل أعلاه لإنشاء التقرير الشامل" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══════════════════════════════════════════ */}
              {/* التبويب 8: التقرير المختصر لمجلس الإدارة */}
              {/* تقرير من جويل - READ ONLY */}
              {/* ═══════════════════════════════════════════ */}
              <TabsContent value="tab10">
                <JoelleDataManager projectId={selectedProjectId} community={form.community || ''} />
              </TabsContent>
              <TabsContent value="tab9">
                <JoelleEngineTab projectId={selectedProjectId} studyId={selectedStudyId} />
              </TabsContent>

              <TabsContent value="tab8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <SectionHeader icon={Users} title="التقرير المختصر لمجلس الإدارة" subtitle="ملخص موجز وفعال من جويل للقيادة العليا" />
                      <Button
                        onClick={() => { if (selectedStudyId) executiveReportMutation.mutate({ id: selectedStudyId }); }}
                        disabled={executiveReportMutation.isPending}
                        className="gap-2"
                      >
                        {executiveReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {executiveReportMutation.isPending ? "جويل تكتب..." : "إنشاء التقرير"}
                      </Button>
                    </div>
                    {form.priceRecommendation ? (
                      <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                        <Streamdown>{form.priceRecommendation}</Streamdown>
                      </div>
                    ) : (
                      <JoellePlaceholder message="لم يُنشأ هذا القسم بعد" subMessage="اضغط زر جويل أعلاه لإنشاء تقرير مجلس الإدارة" />
                    )}
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
