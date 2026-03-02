import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2,
  ArrowRight,
  Save,
  Plus,
  Trash2,
  Calculator,
  DollarSign,
  BarChart3,
  FileText,
  MapPin,
  Ruler,
  TrendingUp,
  PieChart,
  Loader2,
  ChevronLeft,
  Sparkles,
  Copy,
  Brain,
  Globe,
  FolderOpen,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper to format numbers with commas
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  // Preserve decimals for small numbers (percentages), round large numbers
  if (n < 100 && n % 1 !== 0) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString("en-US");
}

// Helper to parse number from input
function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// Editable number input component - uses local string state to preserve decimal point while typing
function NumInput({
  label,
  value,
  onChange,
  suffix,
  prefix,
  disabled,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  suffix?: string;
  prefix?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [localValue, setLocalValue] = useState(value != null ? fmt(value) : "");
  const isFocused = useRef(false);
  const prevExternalValue = useRef(value);

  // Sync from external value only when NOT focused (i.e., not typing)
  useEffect(() => {
    if (!isFocused.current && value !== prevExternalValue.current) {
      prevExternalValue.current = value;
      setLocalValue(value != null ? fmt(value) : "");
    }
  }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute right-3 text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          type="text"
          value={localValue}
          onFocus={() => {
            isFocused.current = true;
            // Remove formatting on focus so user can edit raw number
            if (value != null) {
              setLocalValue(String(value));
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setLocalValue(raw);
            // Update parent immediately for live calculations, but keep raw string locally
            const parsed = parseNum(raw);
            onChange(parsed);
          }}
          onBlur={() => {
            isFocused.current = false;
            // Format the display value on blur
            const parsed = parseNum(localValue);
            if (parsed != null) {
              setLocalValue(fmt(parsed));
              onChange(parsed);
            } else {
              setLocalValue("");
              onChange(null);
            }
            prevExternalValue.current = parsed;
          }}
          className={`text-left font-mono text-sm h-9 ${prefix ? "pr-14" : ""} ${suffix ? "pl-12" : ""}`}
          disabled={disabled}
          dir="ltr"
        />
        {suffix && (
          <span className="absolute left-3 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

// Computed value display
function ComputedValue({
  label,
  value,
  suffix,
  highlight,
  large,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${large ? "py-3" : ""}`}>
      <span className={`text-sm ${highlight ? "font-bold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span
        className={`font-mono ${large ? "text-lg font-bold" : "text-sm font-semibold"} ${
          highlight
            ? (value ?? 0) >= 0
              ? "text-emerald-600"
              : "text-red-600"
            : "text-foreground"
        }`}
        dir="ltr"
      >
        {fmt(value)} {suffix || "AED"}
      </span>
    </div>
  );
}

// Section header
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
    </div>
  );
}

export default function FeasibilityStudyPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("info");

  // Form state
  const [form, setForm] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Projects query for linking
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Queries
  const studiesQuery = trpc.feasibility2.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const studyQuery = trpc.feasibility2.getById.useQuery(selectedStudyId || 0, {
    enabled: !!selectedStudyId,
  });

  // Filter studies by project
  const filteredStudies = useMemo(() => {
    const studies = studiesQuery.data || [];
    if (selectedProjectId === "all") return studies;
    if (selectedProjectId === "unlinked") return studies.filter((s: any) => !s.projectId);
    return studies.filter((s: any) => s.projectId === Number(selectedProjectId));
  }, [studiesQuery.data, selectedProjectId]);

  // Mutations
  const createMutation = trpc.feasibility2.create.useMutation({
    onSuccess: (data) => {
      studiesQuery.refetch();
      setSelectedStudyId(data.id);
      toast.success("تم إنشاء الدراسة بنجاح");
    },
    onError: () => toast.error("خطأ في إنشاء الدراسة"),
  });

  const updateMutation = trpc.feasibility2.update.useMutation({
    onSuccess: () => {
      studiesQuery.refetch();
      studyQuery.refetch();
      setIsDirty(false);
      toast.success("تم حفظ التغييرات");
    },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  const deleteMutation = trpc.feasibility2.delete.useMutation({
    onSuccess: () => {
      studiesQuery.refetch();
      setSelectedStudyId(null);
      setForm({});
      toast.success("تم حذف الدراسة");
    },
  });

  // Joelle AI Summary
  const aiSummaryMutation = trpc.feasibility2.generateAiSummary.useMutation({
    onSuccess: (data) => {
      studyQuery.refetch();
      setForm((prev: Record<string, any>) => ({ ...prev, aiSummary: data.summary }));
      toast.success("تم إنشاء الملخص الذكي بنجاح");
    },
    onError: (err) => toast.error(err.message || "فشل في إنشاء الملخص"),
  });

  // Joelle Market Analysis
  const marketAnalysisMutation = trpc.feasibility2.generateMarketAnalysis.useMutation({
    onSuccess: (data) => {
      studyQuery.refetch();
      setForm((prev: Record<string, any>) => ({ ...prev, marketAnalysis: data.analysis }));
      toast.success("تم تحليل السوق بنجاح");
    },
    onError: (err) => toast.error(err.message || "فشل في تحليل السوق"),
  });

  // Duplicate as scenario
  const duplicateScenarioMutation = trpc.feasibility2.duplicateAsScenario.useMutation({
    onSuccess: (data) => {
      studiesQuery.refetch();
      setSelectedStudyId(data.id);
      toast.success("تم إنشاء السيناريو الجديد");
    },
    onError: () => toast.error("خطأ في إنشاء السيناريو"),
  });

  // Load study data into form when selected
  const loadedStudyId = studyQuery.data?.id;
  useMemo(() => {
    if (studyQuery.data && studyQuery.data.id === selectedStudyId) {
      const d = studyQuery.data;
      setForm({ ...d });
      setIsDirty(false);
    }
  }, [loadedStudyId, selectedStudyId]);

  // Update form field
  const setField = useCallback((key: string, value: any) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // ═══════════════════════════════════════════
  // COMPUTED VALUES - All auto-calculations
  // ═══════════════════════════════════════════
  const computed = useMemo(() => {
    const f = form;
    const gfaRes = f.gfaResidential || 0;
    const gfaRet = f.gfaRetail || 0;
    const gfaOff = f.gfaOffices || 0;
    const totalGfa = gfaRes + gfaRet + gfaOff;

    // Saleable areas
    const saleableRes = gfaRes * ((f.saleableResidentialPct || 90) / 100);
    const saleableRet = gfaRet * ((f.saleableRetailPct || 99) / 100);
    const saleableOff = gfaOff * ((f.saleableOfficesPct || 90) / 100);
    const totalSaleable = saleableRes + saleableRet + saleableOff;

    // BUA (manual input)
    const bua = f.estimatedBua || 0;

    // Construction cost (based on BUA, not GFA)
    const constructionCost = bua * (f.constructionCostPerSqft || 0);

    // Land registration (4% of land price)
    const landRegistration = (f.landPrice || 0) * 0.04;

    // Agent commission on land
    const agentCommissionLand = (f.landPrice || 0) * ((f.agentCommissionLandPct || 1) / 100);

    // Design fee
    const designFee = constructionCost * ((f.designFeePct || 2) / 100);

    // Supervision fee
    const supervisionFee = constructionCost * ((f.supervisionFeePct || 2) / 100);

    // Separation fee
    const separationFee = (f.plotAreaM2 || 0) * (f.separationFeePerM2 || 40);

    // Contingencies
    const contingencies = constructionCost * ((f.contingenciesPct || 2) / 100);

    // RERA fees
    const reraUnitTotal = (f.numberOfUnits || 0) * (f.reraUnitFee || 850);

    // Revenue
    const revenueRes = saleableRes * (f.residentialSalePrice || 0);
    const revenueRet = saleableRet * (f.retailSalePrice || 0);
    const revenueOff = saleableOff * (f.officesSalePrice || 0);
    const totalRevenue = revenueRes + revenueRet + revenueOff;

    // Developer fee (% of total sales)
    const developerFee = totalRevenue * ((f.developerFeePct || 5) / 100);

    // Agent commission on sale
    const agentCommissionSale = totalRevenue * ((f.agentCommissionSalePct || 5) / 100);

    // Marketing
    const marketing = totalRevenue * ((f.marketingPct || 2) / 100);

    // Total costs
    const totalCosts =
      (f.landPrice || 0) +
      agentCommissionLand +
      landRegistration +
      (f.soilInvestigation || 0) +
      (f.topographySurvey || 0) +
      designFee +
      supervisionFee +
      (f.authoritiesFee || 0) +
      separationFee +
      constructionCost +
      (f.communityFee || 0) +
      contingencies +
      developerFee +
      agentCommissionSale +
      marketing +
      (f.reraOffplanFee || 150000) +
      reraUnitTotal +
      (f.nocFee || 10000) +
      (f.escrowFee || 140000) +
      (f.bankCharges || 20000) +
      (f.surveyorFees || 12000) +
      (f.reraAuditFees || 18000) +
      (f.reraInspectionFees || 70000);

    // Profit
    const profit = totalRevenue - totalCosts;

    // Funding required = total cost - 65% of construction cost (covered by off-plan sales)
    const offplanCoverage = constructionCost * 0.65;
    const fundingRequired = totalCosts - offplanCoverage;

    // COMO profit share
    const comoProfit = profit * ((f.comoProfitSharePct || 15) / 100);
    const investorProfit = profit - comoProfit;

    // ROI
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;

    // Profit margin
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalGfa,
      saleableRes,
      saleableRet,
      saleableOff,
      totalSaleable,
      constructionCost,
      landRegistration,
      agentCommissionLand,
      designFee,
      supervisionFee,
      separationFee,
      contingencies,
      reraUnitTotal,
      revenueRes,
      revenueRet,
      revenueOff,
      totalRevenue,
      developerFee,
      agentCommissionSale,
      marketing,
      totalCosts,
      profit,
      offplanCoverage,
      fundingRequired,
      comoProfit,
      investorProfit,
      roi,
      profitMargin,
    };
  }, [form]);

  // Save handler
  const handleSave = () => {
    if (!selectedStudyId) return;
    const { id, userId, createdAt, updatedAt, ...data } = form;
    updateMutation.mutate({ id: selectedStudyId, ...data });
  };

  // Create new study
  const handleCreate = () => {
    createMutation.mutate({
      projectName: "دراسة جديدة",
    });
  };

  // Login screen
  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">دراسة الجدوى المالية</h2>
            <p className="text-muted-foreground mb-6">يرجى تسجيل الدخول للوصول</p>
            <Button onClick={() => (window.location.href = getLoginUrl())} className="w-full">
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
              <ArrowRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <h1 className="text-base font-bold text-foreground">📊 دراسة الجدوى المالية</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && selectedStudyId && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="gap-1.5 text-xs"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                حفظ
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCreate} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              دراسة جديدة
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Project filter + Study selector */}
        <div className="space-y-3 mb-6">
          {/* Project filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4" />
              فلتر حسب المشروع:
            </Label>
            <select
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedStudyId(null);
              }}
            >
              <option value="all">كل الدراسات</option>
              <option value="unlinked">غير مربوطة بمشروع</option>
              {(projectsQuery.data || []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Study selector */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium whitespace-nowrap">اختر الدراسة:</Label>
            <select
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={selectedStudyId || ""}
              onChange={(e) => setSelectedStudyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- اختر دراسة جدوى --</option>
              {filteredStudies.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.projectName}{s.scenarioName ? ` (سيناريو: ${s.scenarioName})` : ""}
                </option>
              ))}
            </select>
            {selectedStudyId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    const name = prompt("اسم السيناريو الجديد (مثل: متفائل، متشائم، متوسط):");
                    if (name) {
                      duplicateScenarioMutation.mutate({ studyId: selectedStudyId, scenarioName: name });
                    }
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  نسخ كسيناريو
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من حذف هذه الدراسة؟")) {
                      deleteMutation.mutate(selectedStudyId);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!selectedStudyId ? (
          <div className="text-center py-20">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2">📄 اختر دراسة جدوى أو أنشئ واحدة جديدة</h2>
            <p className="text-sm text-muted-foreground/70">
              يمكنك إنشاء دراسات جدوى متعددة لمشاريع مختلفة
            </p>
          </div>
        ) : studyQuery.isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <>
            {/* Project Link + Scenario */}
            <Card className="mb-4">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ربط بمشروع</Label>
                    <select
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                      value={form.projectId || ""}
                      onChange={(e) => setField("projectId", e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">غير مربوطة</option>
                      {(projectsQuery.data || []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">اسم السيناريو (اختياري)</Label>
                    <Input
                      value={form.scenarioName || ""}
                      onChange={(e) => setField("scenarioName", e.target.value)}
                      placeholder="مثال: متفائل، متشائم، متوسط"
                      className="text-sm h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">المنطقة</Label>
                    <Input
                      value={form.community || ""}
                      onChange={(e) => {
                        setField("community", e.target.value);
                        setField("projectName", `${e.target.value} _ ${form.projectDescription || ""} _ ${form.plotNumber || ""}`);
                      }}
                      placeholder="مثال: ند الشبا الأولى"
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">الوصف المصرح</Label>
                    <Input
                      value={form.projectDescription || ""}
                      onChange={(e) => {
                        setField("projectDescription", e.target.value);
                        setField("projectName", `${form.community || ""} _ ${e.target.value} _ ${form.plotNumber || ""}`);
                      }}
                      placeholder="مثال: G+2P+6"
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">رقم القطعة</Label>
                    <Input
                      value={form.plotNumber || ""}
                      onChange={(e) => {
                        setField("plotNumber", e.target.value);
                        setField("projectName", `${form.community || ""} _ ${form.projectDescription || ""} _ ${e.target.value}`);
                      }}
                      placeholder="مثال: 6185392"
                      className="text-sm h-9"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="mt-2 px-3 py-2 bg-primary/5 rounded-lg">
                  <span className="text-xs text-muted-foreground">اسم المشروع: </span>
                  <span className="text-sm font-bold text-primary">{form.projectName || "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start mb-4 bg-card border border-border h-auto flex-wrap">
                <TabsTrigger value="info" className="gap-1.5 text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  📍 معلومات المشروع
                </TabsTrigger>
                <TabsTrigger value="areas" className="gap-1.5 text-xs">
                  <Ruler className="w-3.5 h-3.5" />
                  📐 المساحات
                </TabsTrigger>
                <TabsTrigger value="costs" className="gap-1.5 text-xs">
                  <DollarSign className="w-3.5 h-3.5" />
                  💵 التكاليف
                </TabsTrigger>
                <TabsTrigger value="revenue" className="gap-1.5 text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  📈 الإيرادات
                </TabsTrigger>
                <TabsTrigger value="summary" className="gap-1.5 text-xs">
                  <PieChart className="w-3.5 h-3.5" />
                  🎯 الملخص والربحية
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  🧠 تحليل جويل
                </TabsTrigger>
                <TabsTrigger value="market" className="gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5" />
                  🌍 تحليل السوق
                </TabsTrigger>
                <TabsTrigger value="comprehensive" className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  📄 التقرير الشامل
                </TabsTrigger>
                <TabsTrigger value="executive" className="gap-1.5 text-xs">
                  <Brain className="w-3.5 h-3.5" />
                  👔 تقرير المجلس
                </TabsTrigger>
              </TabsList>

              {/* ═══ Tab 1: Project Info ═══ */}
              <TabsContent value="info">
                <Card>
                  <CardContent className="pt-6">
                    <SectionHeader icon={MapPin} title="معلومات المشروع من الـ Affection Plan" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">الاستعمال</Label>
                        <Input
                          value={form.landUse || ""}
                          onChange={(e) => setField("landUse", e.target.value)}
                          placeholder="مثال: Residential: Apartment + Retail"
                          className="text-sm h-9"
                        />
                      </div>
                      <NumInput
                        label="عدد الوحدات"
                        value={form.numberOfUnits}
                        onChange={(v) => setField("numberOfUnits", v)}
                        suffix="وحدة"
                      />
                      <NumInput
                        label="مساحة الأرض (م²)"
                        value={form.plotAreaM2}
                        onChange={(v) => {
                          setField("plotAreaM2", v);
                          if (v) setField("plotArea", Math.round(v * 10.764));
                        }}
                        suffix="م²"
                      />
                      <NumInput
                        label="مساحة الأرض (قدم²)"
                        value={form.plotArea}
                        onChange={(v) => setField("plotArea", v)}
                        suffix="sqft"
                        disabled
                        hint="يُحسب تلقائياً من المتر²"
                      />
                    </div>
                    <div className="mt-6">
                      <Label className="text-xs text-muted-foreground">ملاحظات</Label>
                      <textarea
                        className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                        value={form.notes || ""}
                        onChange={(e) => setField("notes", e.target.value)}
                        placeholder="ملاحظات إضافية..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ Tab 2: Areas ═══ */}
              <TabsContent value="areas">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={Ruler} title="المساحة الطابقية الإجمالية (GFA)" />
                      <div className="space-y-4">
                        <NumInput
                          label="GFA سكني (قدم²)"
                          value={form.gfaResidential}
                          onChange={(v) => setField("gfaResidential", v)}
                          suffix="sqft"
                        />
                        <NumInput
                          label="GFA تجاري / محلات (قدم²)"
                          value={form.gfaRetail}
                          onChange={(v) => setField("gfaRetail", v)}
                          suffix="sqft"
                        />
                        <NumInput
                          label="GFA مكاتب (قدم²)"
                          value={form.gfaOffices}
                          onChange={(v) => setField("gfaOffices", v)}
                          suffix="sqft"
                        />
                        <div className="pt-3 border-t border-border">
                          <ComputedValue label="إجمالي GFA" value={computed.totalGfa} suffix="sqft" highlight />
                        </div>
                        <NumInput
                          label="مساحة البناء التقديرية BUA (قدم²)"
                          value={form.estimatedBua}
                          onChange={(v) => setField("estimatedBua", v)}
                          suffix="sqft"
                          hint="مساحة البناء الفعلية - تُستخدم لحساب تكلفة البناء"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={Building2} title="المساحات القابلة للبيع (Saleable Area)" />
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <NumInput
                            label="نسبة البيع سكني %"
                            value={form.saleableResidentialPct}
                            onChange={(v) => setField("saleableResidentialPct", v)}
                            suffix="%"
                          />
                          <div className="flex items-end pb-1">
                            <ComputedValue label="=" value={computed.saleableRes} suffix="sqft" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <NumInput
                            label="نسبة البيع تجاري %"
                            value={form.saleableRetailPct}
                            onChange={(v) => setField("saleableRetailPct", v)}
                            suffix="%"
                          />
                          <div className="flex items-end pb-1">
                            <ComputedValue label="=" value={computed.saleableRet} suffix="sqft" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <NumInput
                            label="نسبة البيع مكاتب %"
                            value={form.saleableOfficesPct}
                            onChange={(v) => setField("saleableOfficesPct", v)}
                            suffix="%"
                          />
                          <div className="flex items-end pb-1">
                            <ComputedValue label="=" value={computed.saleableOff} suffix="sqft" />
                          </div>
                        </div>
                        <div className="pt-3 border-t border-border">
                          <ComputedValue label="إجمالي المساحة القابلة للبيع" value={computed.totalSaleable} suffix="sqft" highlight />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ═══ Tab 3: Costs ═══ */}
              <TabsContent value="costs">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Land & Pre-construction */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={MapPin} title="تكاليف الأرض وما قبل البناء" />
                      <div className="space-y-3">
                        <NumInput
                          label="سعر الأرض"
                          value={form.landPrice}
                          onChange={(v) => setField("landPrice", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="عمولة وسيط الأرض %"
                          value={form.agentCommissionLandPct}
                          onChange={(v) => setField("agentCommissionLandPct", v)}
                          suffix="%"
                        />
                        <ComputedValue label="عمولة الوسيط" value={computed.agentCommissionLand} />
                        <ComputedValue label="رسوم تسجيل الأرض (4%)" value={computed.landRegistration} />
                        <NumInput
                          label="فحص التربة"
                          value={form.soilInvestigation}
                          onChange={(v) => setField("soilInvestigation", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="المسح الطبوغرافي"
                          value={form.topographySurvey}
                          onChange={(v) => setField("topographySurvey", v)}
                          suffix="AED"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Design & Supervision */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={FileText} title="أتعاب التصميم والإشراف" />
                      <div className="space-y-3">
                        <NumInput
                          label="أتعاب التصميم %"
                          value={form.designFeePct}
                          onChange={(v) => setField("designFeePct", v)}
                          suffix="%"
                          hint="من تكلفة البناء"
                        />
                        <ComputedValue label="أتعاب التصميم" value={computed.designFee} />
                        <NumInput
                          label="أتعاب الإشراف %"
                          value={form.supervisionFeePct}
                          onChange={(v) => setField("supervisionFeePct", v)}
                          suffix="%"
                          hint="من تكلفة البناء"
                        />
                        <ComputedValue label="أتعاب الإشراف" value={computed.supervisionFee} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Construction & Government */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={Building2} title="تكاليف البناء والجهات الحكومية" />
                      <div className="space-y-3">
                        <NumInput
                          label="تكلفة البناء لكل قدم²"
                          value={form.constructionCostPerSqft}
                          onChange={(v) => setField("constructionCostPerSqft", v)}
                          suffix="AED/sqft"
                        />
                        <ComputedValue
                          label={`تكلفة البناء الإجمالية (BUA: ${fmt(form.estimatedBua || 0)} sqft)`}
                          value={computed.constructionCost}
                          highlight
                        />
                        <NumInput
                          label="رسوم الجهات الحكومية"
                          value={form.authoritiesFee}
                          onChange={(v) => setField("authoritiesFee", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم الفصل (لكل م²)"
                          value={form.separationFeePerM2}
                          onChange={(v) => setField("separationFeePerM2", v)}
                          suffix="AED/م²"
                        />
                        <ComputedValue label="رسوم الفصل الإجمالية" value={computed.separationFee} />
                        <NumInput
                          label="رسوم المجتمع"
                          value={form.communityFee}
                          onChange={(v) => setField("communityFee", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="احتياطي وطوارئ %"
                          value={form.contingenciesPct}
                          onChange={(v) => setField("contingenciesPct", v)}
                          suffix="%"
                        />
                        <ComputedValue label="الاحتياطي" value={computed.contingencies} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* RERA & Fixed Fees */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={DollarSign} title="رسوم RERA والرسوم الثابتة" />
                      <div className="space-y-3">
                        <NumInput
                          label="رسوم RERA Offplan"
                          value={form.reraOffplanFee}
                          onChange={(v) => setField("reraOffplanFee", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم تسجيل الوحدة"
                          value={form.reraUnitFee}
                          onChange={(v) => setField("reraUnitFee", v)}
                          suffix="AED/وحدة"
                        />
                        <ComputedValue
                          label={`إجمالي رسوم الوحدات (${form.numberOfUnits || 0} وحدة)`}
                          value={computed.reraUnitTotal}
                        />
                        <NumInput
                          label="رسوم NOC"
                          value={form.nocFee}
                          onChange={(v) => setField("nocFee", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم حساب الضمان (Escrow)"
                          value={form.escrowFee}
                          onChange={(v) => setField("escrowFee", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم البنك"
                          value={form.bankCharges}
                          onChange={(v) => setField("bankCharges", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="أتعاب المساح"
                          value={form.surveyorFees}
                          onChange={(v) => setField("surveyorFees", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم تدقيق RERA"
                          value={form.reraAuditFees}
                          onChange={(v) => setField("reraAuditFees", v)}
                          suffix="AED"
                        />
                        <NumInput
                          label="رسوم تفتيش RERA"
                          value={form.reraInspectionFees}
                          onChange={(v) => setField("reraInspectionFees", v)}
                          suffix="AED"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales-based costs */}
                  <Card className="lg:col-span-2">
                    <CardContent className="pt-6">
                      <SectionHeader icon={BarChart3} title="تكاليف مبنية على المبيعات" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-3">
                          <NumInput
                            label="أتعاب المطور (COMO) %"
                            value={form.developerFeePct}
                            onChange={(v) => setField("developerFeePct", v)}
                            suffix="%"
                            hint="من إجمالي المبيعات"
                          />
                          <ComputedValue label="أتعاب المطور" value={computed.developerFee} />
                        </div>
                        <div className="space-y-3">
                          <NumInput
                            label="عمولة البيع %"
                            value={form.agentCommissionSalePct}
                            onChange={(v) => setField("agentCommissionSalePct", v)}
                            suffix="%"
                            hint="من إجمالي المبيعات"
                          />
                          <ComputedValue label="عمولة البيع" value={computed.agentCommissionSale} />
                        </div>
                        <div className="space-y-3">
                          <NumInput
                            label="التسويق %"
                            value={form.marketingPct}
                            onChange={(v) => setField("marketingPct", v)}
                            suffix="%"
                            hint="من إجمالي المبيعات"
                          />
                          <ComputedValue label="تكلفة التسويق" value={computed.marketing} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ═══ Tab 4: Revenue ═══ */}
              <TabsContent value="revenue">
                <Card>
                  <CardContent className="pt-6">
                    <SectionHeader icon={TrendingUp} title="الإيرادات - أسعار البيع" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Residential */}
                      <div className="space-y-3 p-4 rounded-xl bg-stone-50/50 border border-stone-200">
                        <h4 className="font-bold text-sm text-stone-700">سكني</h4>
                        <NumInput
                          label="سعر البيع لكل قدم²"
                          value={form.residentialSalePrice}
                          onChange={(v) => setField("residentialSalePrice", v)}
                          suffix="AED"
                        />
                        <div className="text-xs text-muted-foreground">
                          المساحة القابلة للبيع: <span className="font-mono font-bold">{fmt(computed.saleableRes)}</span> sqft
                        </div>
                        <ComputedValue label="إيراد سكني" value={computed.revenueRes} highlight />
                      </div>

                      {/* Retail */}
                      <div className="space-y-3 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                        <h4 className="font-bold text-sm text-emerald-700">تجاري / محلات</h4>
                        <NumInput
                          label="سعر البيع لكل قدم²"
                          value={form.retailSalePrice}
                          onChange={(v) => setField("retailSalePrice", v)}
                          suffix="AED"
                        />
                        <div className="text-xs text-muted-foreground">
                          المساحة القابلة للبيع: <span className="font-mono font-bold">{fmt(computed.saleableRet)}</span> sqft
                        </div>
                        <ComputedValue label="إيراد تجاري" value={computed.revenueRet} highlight />
                      </div>

                      {/* Offices */}
                      <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                        <h4 className="font-bold text-sm text-amber-700">مكاتب</h4>
                        <NumInput
                          label="سعر البيع لكل قدم²"
                          value={form.officesSalePrice}
                          onChange={(v) => setField("officesSalePrice", v)}
                          suffix="AED"
                        />
                        <div className="text-xs text-muted-foreground">
                          المساحة القابلة للبيع: <span className="font-mono font-bold">{fmt(computed.saleableOff)}</span> sqft
                        </div>
                        <ComputedValue label="إيراد مكاتب" value={computed.revenueOff} highlight />
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-primary/20">
                      <ComputedValue label="إجمالي الإيرادات" value={computed.totalRevenue} highlight large />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ Tab 5: Summary ═══ */}
              <TabsContent value="summary">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cost Summary */}
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeader icon={DollarSign} title="ملخص التكاليف" />
                      <div className="space-y-1 divide-y divide-border/50">
                        <ComputedValue label="سعر الأرض" value={form.landPrice} />
                        <ComputedValue label="عمولة وسيط الأرض" value={computed.agentCommissionLand} />
                        <ComputedValue label="رسوم تسجيل الأرض" value={computed.landRegistration} />
                        <ComputedValue label="فحص التربة" value={form.soilInvestigation} />
                        <ComputedValue label="المسح الطبوغرافي" value={form.topographySurvey} />
                        <ComputedValue label="أتعاب التصميم" value={computed.designFee} />
                        <ComputedValue label="أتعاب الإشراف" value={computed.supervisionFee} />
                        <ComputedValue label="رسوم الجهات الحكومية" value={form.authoritiesFee} />
                        <ComputedValue label="رسوم الفصل" value={computed.separationFee} />
                        <ComputedValue label="تكلفة البناء" value={computed.constructionCost} />
                        <ComputedValue label="رسوم المجتمع" value={form.communityFee} />
                        <ComputedValue label="الاحتياطي والطوارئ" value={computed.contingencies} />
                        <ComputedValue label="أتعاب المطور" value={computed.developerFee} />
                        <ComputedValue label="عمولة البيع" value={computed.agentCommissionSale} />
                        <ComputedValue label="التسويق" value={computed.marketing} />
                        <ComputedValue label="رسوم RERA Offplan" value={form.reraOffplanFee} />
                        <ComputedValue label="رسوم تسجيل الوحدات" value={computed.reraUnitTotal} />
                        <ComputedValue label="رسوم NOC" value={form.nocFee} />
                        <ComputedValue label="حساب الضمان" value={form.escrowFee} />
                        <ComputedValue label="رسوم البنك" value={form.bankCharges} />
                        <ComputedValue label="أتعاب المساح" value={form.surveyorFees} />
                        <ComputedValue label="تدقيق RERA" value={form.reraAuditFees} />
                        <ComputedValue label="تفتيش RERA" value={form.reraInspectionFees} />
                      </div>
                      <div className="mt-3 pt-3 border-t-2 border-destructive/20">
                        <ComputedValue label="إجمالي التكاليف" value={computed.totalCosts} highlight large />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profitability */}
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="pt-6">
                        <SectionHeader icon={TrendingUp} title="الربحية" />
                        <div className="space-y-1 divide-y divide-border/50">
                          <ComputedValue label="إجمالي الإيرادات" value={computed.totalRevenue} />
                          <ComputedValue label="إجمالي التكاليف" value={computed.totalCosts} />
                        </div>
                        <div className="mt-3 pt-3 border-t-2 border-primary/20">
                          <ComputedValue label="صافي الربح" value={computed.profit} highlight large />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          هامش الربح: <span className="font-mono font-bold text-foreground">{computed.profitMargin.toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <SectionHeader icon={PieChart} title="التمويل المطلوب" />
                        <div className="space-y-1 divide-y divide-border/50">
                          <ComputedValue label="إجمالي التكاليف" value={computed.totalCosts} />
                          <ComputedValue label="تغطية مبيعات الخارطة (65% من البناء)" value={computed.offplanCoverage} />
                        </div>
                        <div className="mt-3 pt-3 border-t-2 border-amber-300">
                          <ComputedValue label="التمويل المطلوب من المستثمر" value={computed.fundingRequired} highlight large />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="pt-6">
                        <SectionHeader icon={Calculator} title="توزيع الأرباح" />
                        <div className="space-y-3">
                          <NumInput
                            label="حصة COMO من الربح %"
                            value={form.comoProfitSharePct}
                            onChange={(v) => setField("comoProfitSharePct", v)}
                            suffix="%"
                          />
                          <div className="space-y-1 divide-y divide-border/50">
                            <ComputedValue label="أرباح COMO" value={computed.comoProfit} highlight />
                            <ComputedValue label="أرباح المستثمر" value={computed.investorProfit} highlight />
                          </div>
                          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                            <div className="text-xs text-emerald-600 mb-1">العائد على الاستثمار (ROI)</div>
                            <div className="text-3xl font-bold text-emerald-700 font-mono">
                              {computed.roi.toFixed(1)}%
                            </div>
                            <div className="text-xs text-emerald-600 mt-1">
                              ربح المستثمر / التمويل المطلوب
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              {/* ═══ Tab 6: Joelle AI Summary ═══ */}
              <TabsContent value="ai">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <SectionHeader icon={Sparkles} title="ملخص جويل الذكي" />
                        <Button
                          onClick={() => {
                            if (selectedStudyId) {
                              aiSummaryMutation.mutate(selectedStudyId);
                            }
                          }}
                          disabled={aiSummaryMutation.isPending}
                          className="gap-2"
                        >
                          {aiSummaryMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Brain className="w-4 h-4" />
                          )}
                          {aiSummaryMutation.isPending ? "جويل تحلل..." : "اطلب من جويل تحليل"}
                        </Button>
                      </div>
                      {form.aiSummary ? (
                        <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                          <Streamdown>{form.aiSummary}</Streamdown>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                          <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">لم يتم إنشاء ملخص بعد</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">اضغط "اطلب من جويل تحليل" لإنشاء ملخص ذكي للدراسة</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ═══ Tab 7: Market Analysis ═══ */}
              <TabsContent value="market">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <SectionHeader icon={Globe} title="تحليل السوق العقاري" />
                        <Button
                          onClick={() => {
                            if (selectedStudyId && form.community) {
                              marketAnalysisMutation.mutate({
                                studyId: selectedStudyId,
                                community: form.community,
                              });
                            } else {
                              toast.error("يرجى تحديد المنطقة أولاً في تبويب معلومات المشروع");
                            }
                          }}
                          disabled={marketAnalysisMutation.isPending}
                          className="gap-2"
                        >
                          {marketAnalysisMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                          {marketAnalysisMutation.isPending ? "جويل تحلل السوق..." : "تحليل السوق"}
                        </Button>
                      </div>
                      {form.community && (
                        <div className="mb-4 px-3 py-2 bg-primary/5 rounded-lg">
                          <span className="text-xs text-muted-foreground">المنطقة المستهدفة: </span>
                          <span className="text-sm font-bold text-primary">{form.community}</span>
                        </div>
                      )}
                      {form.marketAnalysis ? (
                        <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                          <Streamdown>{form.marketAnalysis}</Streamdown>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                          <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">لم يتم تحليل السوق بعد</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">اضغط "تحليل السوق" ليقوم جويل بتحليل أسعار ومنافسي المنطقة</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ═══ Tab 8: Comprehensive Report ═══ */}
              <TabsContent value="comprehensive">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">التقرير الشامل المهني الاحترافي</h3>
                          <p className="text-xs text-muted-foreground">تقرير مفصل من جويل يتضمن جميع جوانب المشروع</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (selectedStudyId) {
                            trpc.feasibility.generateComprehensiveReport.useMutation({
                              onSuccess: (data) => {
                                studyQuery.refetch();
                                setForm((prev: Record<string, any>) => ({ ...prev, competitorAnalysis: data.report }));
                                toast.success("تم إنشاء التقرير الشامل بنجاح");
                              },
                              onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
                            }).mutate({ id: selectedStudyId });
                          }
                        }}
                        className="gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        إنشاء التقرير
                      </Button>
                    </div>
                    {form.competitorAnalysis ? (
                      <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                        <Streamdown>{form.competitorAnalysis}</Streamdown>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">لم يتم إنشاء التقرير الشامل بعد</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">اضغط "إنشاء التقرير" ليقوم جويل بإعداد تقرير شامل واحترافي</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ Tab 9: Executive Report ═══ */}
              <TabsContent value="executive">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">التقرير المختصر لمجلس الإدارة</h3>
                          <p className="text-xs text-muted-foreground">ملخص موجز وفعال من جويل للقيادة العليا</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (selectedStudyId) {
                            trpc.feasibility.generateExecutiveReport.useMutation({
                              onSuccess: (data) => {
                                studyQuery.refetch();
                                setForm((prev: Record<string, any>) => ({ ...prev, priceRecommendation: data.report }));
                                toast.success("تم إنشاء تقرير المجلس بنجاح");
                              },
                              onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
                            }).mutate({ id: selectedStudyId });
                          }
                        }}
                        className="gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        إنشاء التقرير
                      </Button>
                    </div>
                    {form.priceRecommendation ? (
                      <div className="prose prose-sm max-w-none bg-muted/30 rounded-xl p-6 border border-border" dir="rtl">
                        <Streamdown>{form.priceRecommendation}</Streamdown>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                        <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">لم يتم إنشاء تقرير المجلس بعد</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">اضغط "إنشاء التقرير" ليقوم جويل بإعداد ملخص موجز للقيادة العليا</p>
                      </div>
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
