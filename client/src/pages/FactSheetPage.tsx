import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Building2,
  MapPin,
  FileText,
  Users,
  Zap,
  Car,
  Calendar,
  ShieldAlert,
  Landmark,
  Scale,
  Save,
  Loader2,
  ChevronLeft,
  Bot,
  CheckCircle2,
  AlertCircle,
  Percent,
  Ruler,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// Field component for consistent styling
function Field({ label, value, onChange, type = "text", placeholder, readOnly = false, suffix }: {
  label: string;
  value: string | number | null | undefined;
  onChange?: (val: string) => void;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  readOnly?: boolean;
  suffix?: string;
}) {
  const displayVal = value === null || value === undefined ? "" : String(value);

  if (type === "textarea") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <Textarea
          value={displayVal}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder || label}
          readOnly={readOnly}
          className="min-h-[80px] text-sm bg-white/50 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          type={type}
          value={displayVal}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder || label}
          readOnly={readOnly}
          className="text-sm bg-white/50 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// Section wrapper component
function Section({ title, icon: Icon, children, color = "amber" }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const iconColorMap: Record<string, string> = {
    amber: "text-amber-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    purple: "text-purple-600",
    rose: "text-rose-600",
    orange: "text-orange-600",
    slate: "text-slate-600",
  };

  return (
    <Card className="border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <CardHeader className={`py-3 px-5 border-b ${colorMap[color]}`}>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColorMap[color]}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {children}
      </CardContent>
    </Card>
  );
}

export default function FactSheetPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [khazenLoading, setKhazenLoading] = useState(false);
  const [khazenStatus, setKhazenStatus] = useState<"idle" | "analyzing" | "done" | "error">("idle");
  const [khazenMessage, setKhazenMessage] = useState("");
  const [khazenDialogOpen, setKhazenDialogOpen] = useState(false);
  const [khazenProgress, setKhazenProgress] = useState(0);

  // Queries
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const projectQuery = trpc.projects.getById.useQuery(
    { id: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Mutation
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ بطاقة البيانات بنجاح");
      setHasChanges(false);
      projectQuery.refetch();
    },
    onError: (err) => toast.error("خطأ في الحفظ: " + err.message),
  });

  // Khazen agent chat mutation
  const khazenChat = trpc.agents.chat.useMutation();

  const handleKhazenAutoFill = async () => {
    if (!selectedProjectId || !projectQuery.data) return;
    setKhazenDialogOpen(true);
    setKhazenLoading(true);
    setKhazenStatus("analyzing");
    setKhazenMessage("جاري إرسال الطلب لخازن...");
    setKhazenProgress(10);

    try {
      const projectName = projectQuery.data.name;
      const prompt = `أنا بحاجة لتعبئة بطاقة بيانات المشروع "${projectName}" (معرف المشروع: ${selectedProjectId}). ` +
        `أرجو منك البحث في Google Drive عن مستندات هذا المشروع (Affection Plan, Title Deed, Plots Guidelines, Site Plan, DDA) ` +
        `واستخراج البيانات التالية وتحديث بطاقة البيانات مباشرة باستخدام أداة update_project_fact_sheet:\n\n` +
        `- أرقام التعريف: رقم القطعة، كود المنطقة، رقم سند الملكية، رقم DDA، الرقم المرجعي للمطور\n` +
        `- المساحات: مساحة الأرض (م²/قدم²)، GFA (م²/قدم²)، BUA\n` +
        `- الاستخدام: الاستخدام المسموح، نوع الملكية، قيود التقسيم\n` +
        `- المطور الرئيسي: الاسم والعنوان\n` +
        `- البائع: الاسم والعنوان\n` +
        `- البنية التحتية: تخصيص الكهرباء والمياه والصرف الصحي\n` +
        `- حركة المرور: الرحلات الصباحية والظهيرة والمسائية\n` +
        `- الجدول الزمني: تاريخ السريان، فترة البناء، تاريخ البدء والانتهاء\n` +
        `- القيود: قيود البيع، شروط إعادة البيع، رسوم المجتمع\n` +
        `- الرسوم: جهة التسجيل، الرسوم الإدارية، رسوم المخالصة\n` +
        `- القانون: القانون الحاكم، آلية حل النزاعات\n\n` +
        `ابحث في كل المستندات المتاحة واستخرج أكبر قدر ممكن من البيانات.`;

      setKhazenProgress(30);
      setKhazenMessage("خازن يبحث في مستندات المشروع على Google Drive...");

      const result = await khazenChat.mutateAsync({
        agent: "khazen",
        message: prompt,
      });

      setKhazenProgress(90);
      setKhazenMessage("خازن أنهى التحليل. جاري تحديث البيانات...");

      // Refetch project data to get updated fields
      await projectQuery.refetch();

      setKhazenProgress(100);
      setKhazenStatus("done");
      setKhazenMessage(result.text || "تم تعبئة البيانات بنجاح");
      toast.success("تم تعبئة بطاقة البيانات من خازن بنجاح");
    } catch (err: any) {
      setKhazenStatus("error");
      setKhazenMessage("حدث خطأ أثناء التعبئة: " + (err.message || "خطأ غير معروف"));
      toast.error("فشل في تعبئة البيانات من خازن");
    } finally {
      setKhazenLoading(false);
    }
  };

  // Load project data into form
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data;
      setFormData({
        // Section 1: Identification
        titleDeedNumber: p.titleDeedNumber || "",
        ddaNumber: p.ddaNumber || "",
        masterDevRef: p.masterDevRef || "",
        plotNumber: p.plotNumber || "",
        areaCode: p.areaCode || "",
        // Section 1: Areas
        plotAreaSqm: p.plotAreaSqm || "",
        plotAreaSqft: p.plotAreaSqft || "",
        gfaSqm: p.gfaSqm || "",
        gfaSqft: p.gfaSqft || "",
        bua: p.bua || "",
        // Section 1: Usage
        permittedUse: p.permittedUse || "",
        ownershipType: p.ownershipType || "",
        subdivisionRestrictions: p.subdivisionRestrictions || "",
        // Section 2: Master Developer
        masterDevName: p.masterDevName || "",
        masterDevAddress: p.masterDevAddress || "",
        // Section 2: Seller
        sellerName: p.sellerName || "",
        sellerAddress: p.sellerAddress || "",
        // Section 2: Buyer
        buyerName: p.buyerName || "",
        buyerNationality: p.buyerNationality || "",
        buyerPassport: p.buyerPassport || "",
        buyerAddress: p.buyerAddress || "",
        buyerPhone: p.buyerPhone || "",
        buyerEmail: p.buyerEmail || "",
        // Section 3: Infrastructure
        electricityAllocation: p.electricityAllocation || "",
        waterAllocation: p.waterAllocation || "",
        sewageAllocation: p.sewageAllocation || "",
        // Section 3: Traffic
        tripAM: p.tripAM || "",
        tripLT: p.tripLT || "",
        tripPM: p.tripPM || "",
        // Section 4: Timeline
        effectiveDate: p.effectiveDate || "",
        constructionPeriod: p.constructionPeriod || "",
        constructionStartDate: p.constructionStartDate || "",
        completionDate: p.completionDate || "",
        constructionConditions: p.constructionConditions || "",
        // Section 5: Restrictions
        saleRestrictions: p.saleRestrictions || "",
        resaleConditions: p.resaleConditions || "",
        communityCharges: p.communityCharges || "",
        // Section 6: Registration
        registrationAuthority: p.registrationAuthority || "",
        adminFee: p.adminFee || "",
        clearanceFee: p.clearanceFee || "",
        compensationAmount: p.compensationAmount || "",
        // Section 7: Legal
        governingLaw: p.governingLaw || "",
        disputeResolution: p.disputeResolution || "",
        // Notes
        notes: p.notes || "",
      });
      setHasChanges(false);
    }
  }, [projectQuery.data]);

  const updateField = (key: string, value: string) => {
    setFormData((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedProjectId) return;
    const payload: Record<string, any> = { id: selectedProjectId };
    for (const [key, value] of Object.entries(formData)) {
      if (["bua", "adminFee", "clearanceFee", "compensationAmount"].includes(key)) {
        payload[key] = value ? Number(value) : undefined;
      } else {
        payload[key] = value || undefined;
      }
    }
    updateProject.mutate(payload as any);
  };

  // Calculate completeness
  const FACT_SHEET_KEYS = [
    "titleDeedNumber", "ddaNumber", "masterDevRef",
    "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
    "permittedUse", "ownershipType", "subdivisionRestrictions",
    "masterDevName", "masterDevAddress",
    "sellerName", "sellerAddress",
    "buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail",
    "electricityAllocation", "waterAllocation", "sewageAllocation",
    "tripAM", "tripLT", "tripPM",
    "effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions",
    "saleRestrictions", "resaleConditions", "communityCharges",
    "registrationAuthority", "adminFee", "clearanceFee", "compensationAmount",
    "governingLaw", "disputeResolution",
  ];

  const filledCount = FACT_SHEET_KEYS.filter(k => formData[k] && String(formData[k]).trim() !== "").length;
  const totalCount = FACT_SHEET_KEYS.length;
  const completeness = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  // Auth check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" dir="rtl">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-amber-600" />
            <h2 className="text-xl font-bold">بطاقة بيانات المشروع</h2>
            <p className="text-muted-foreground text-sm">يرجى تسجيل الدخول للوصول إلى بطاقة البيانات</p>
            <Button onClick={() => window.location.href = getLoginUrl("/fact-sheet")} className="bg-amber-600 hover:bg-amber-700">
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4 ml-1" />
                الرئيسية
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-stone-800">بطاقة بيانات المشروع</h1>
                  <p className="text-[11px] text-muted-foreground">Fact Sheet</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Project selector */}
              <Select
                value={selectedProjectId ? String(selectedProjectId) : ""}
                onValueChange={(val) => setSelectedProjectId(Number(val))}
              >
                <SelectTrigger className="w-[220px] bg-white border-stone-200">
                  <SelectValue placeholder="اختر المشروع..." />
                </SelectTrigger>
                <SelectContent>
                  {projectsQuery.data?.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProjectId && (
                <>
                  {/* Completeness badge */}
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 ${
                      completeness >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      completeness >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {completeness >= 80 ? <CheckCircle2 className="h-3 w-3 ml-1" /> : <AlertCircle className="h-3 w-3 ml-1" />}
                    {completeness}% مكتمل ({filledCount}/{totalCount})
                  </Badge>

                  {/* Khazen auto-fill button */}
                  <Button
                    onClick={handleKhazenAutoFill}
                    disabled={khazenLoading}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                  >
                    {khazenLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <Sparkles className="h-4 w-4 ml-1" />
                    )}
                    تعبئة تلقائية من خازن
                  </Button>

                  {/* Save button */}
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updateProject.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    size="sm"
                  >
                    {updateProject.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <Save className="h-4 w-4 ml-1" />
                    )}
                    حفظ التعديلات
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!selectedProjectId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
              <Building2 className="h-10 w-10 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-stone-700 mb-2">اختر مشروعاً لعرض بطاقة البيانات</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              استخدم القائمة المنسدلة في الأعلى لاختيار المشروع الذي تريد عرض أو تعديل بطاقة بياناته
            </p>
          </div>
        ) : projectQuery.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Project Name Banner */}
            <div className="bg-gradient-to-l from-amber-50 via-white to-amber-50 rounded-xl border border-amber-200/50 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-stone-800">{projectQuery.data?.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {projectQuery.data?.plotNumber && `قطعة ${projectQuery.data.plotNumber}`}
                    {projectQuery.data?.areaCode && ` • ${projectQuery.data.areaCode}`}
                  </p>
                </div>
              </div>

              {/* Completeness Progress */}
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <div className="text-2xl font-bold text-amber-700">{completeness}%</div>
                  <div className="text-[11px] text-muted-foreground">اكتمال البيانات</div>
                </div>
                <div className="w-32 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completeness >= 80 ? "bg-emerald-500" :
                      completeness >= 40 ? "bg-amber-500" :
                      "bg-rose-500"
                    }`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Grid layout - 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Section 1: Identification Numbers */}
              <Section title="أرقام التعريف والتسجيل" icon={FileText} color="amber">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="رقم القطعة" value={formData.plotNumber} onChange={v => updateField("plotNumber", v)} placeholder="مثال: 6185392" />
                  <Field label="كود المنطقة" value={formData.areaCode} onChange={v => updateField("areaCode", v)} placeholder="مثال: Nas-R" />
                  <Field label="رقم سند الملكية (Title Deed)" value={formData.titleDeedNumber} onChange={v => updateField("titleDeedNumber", v)} />
                  <Field label="رقم DDA" value={formData.ddaNumber} onChange={v => updateField("ddaNumber", v)} />
                  <Field label="الرقم المرجعي للمطور الرئيسي" value={formData.masterDevRef} onChange={v => updateField("masterDevRef", v)} />
                </div>
              </Section>

              {/* Section 2: Areas */}
              <Section title="المساحات" icon={Ruler} color="blue">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="مساحة الأرض (م²)" value={formData.plotAreaSqm} onChange={v => updateField("plotAreaSqm", v)} placeholder="بالمتر المربع" />
                  <Field label="مساحة الأرض (قدم²)" value={formData.plotAreaSqft} onChange={v => updateField("plotAreaSqft", v)} placeholder="بالقدم المربع" />
                  <Field label="GFA المسموح (م²)" value={formData.gfaSqm} onChange={v => updateField("gfaSqm", v)} placeholder="المساحة الإجمالية" />
                  <Field label="GFA المسموح (قدم²)" value={formData.gfaSqft} onChange={v => updateField("gfaSqft", v)} placeholder="المساحة الإجمالية" />
                  <Field label="مساحة البناء BUA (قدم²)" value={formData.bua} onChange={v => updateField("bua", v)} type="number" />
                </div>
              </Section>

              {/* Section 3: Usage & Ownership */}
              <Section title="الاستخدام ونوع الملكية" icon={Landmark} color="purple">
                <div className="space-y-4">
                  <Field label="الاستخدام المسموح" value={formData.permittedUse} onChange={v => updateField("permittedUse", v)} placeholder="سكني، تجاري، مختلط..." />
                  <Field label="نوع الملكية" value={formData.ownershipType} onChange={v => updateField("ownershipType", v)} placeholder="تملك حر، إيجار طويل..." />
                  <Field label="قيود التجزئة" value={formData.subdivisionRestrictions} onChange={v => updateField("subdivisionRestrictions", v)} type="textarea" />
                </div>
              </Section>

              {/* Section 4: Master Developer */}
              <Section title="المطور الرئيسي" icon={Building2} color="emerald">
                <div className="space-y-4">
                  <Field label="اسم المطور الرئيسي" value={formData.masterDevName} onChange={v => updateField("masterDevName", v)} />
                  <Field label="عنوان المطور" value={formData.masterDevAddress} onChange={v => updateField("masterDevAddress", v)} />
                </div>
              </Section>

              {/* Section 5: Seller */}
              <Section title="البائع (المالك السابق)" icon={Users} color="orange">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="اسم البائع" value={formData.sellerName} onChange={v => updateField("sellerName", v)} />
                  <Field label="عنوان البائع" value={formData.sellerAddress} onChange={v => updateField("sellerAddress", v)} />
                </div>
              </Section>

              {/* Section 6: Buyer */}
              <Section title="المشتري (المالك الحالي)" icon={Users} color="blue">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="اسم المشتري" value={formData.buyerName} onChange={v => updateField("buyerName", v)} />
                  <Field label="الجنسية" value={formData.buyerNationality} onChange={v => updateField("buyerNationality", v)} />
                  <Field label="رقم جواز السفر" value={formData.buyerPassport} onChange={v => updateField("buyerPassport", v)} />
                  <Field label="العنوان" value={formData.buyerAddress} onChange={v => updateField("buyerAddress", v)} />
                  <Field label="رقم الهاتف" value={formData.buyerPhone} onChange={v => updateField("buyerPhone", v)} />
                  <Field label="البريد الإلكتروني" value={formData.buyerEmail} onChange={v => updateField("buyerEmail", v)} />
                </div>
              </Section>

              {/* Section 7: Infrastructure */}
              <Section title="البنية التحتية والمرافق" icon={Zap} color="amber">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">تخصيصات المرافق</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="الكهرباء (كيلوواط)" value={formData.electricityAllocation} onChange={v => updateField("electricityAllocation", v)} />
                    <Field label="المياه (م³/يوم)" value={formData.waterAllocation} onChange={v => updateField("waterAllocation", v)} />
                    <Field label="الصرف الصحي (م³/يوم)" value={formData.sewageAllocation} onChange={v => updateField("sewageAllocation", v)} />
                  </div>
                  <Separator className="my-2" />
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">تخصيصات الحركة المرورية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="رحلات صباحية (AM)" value={formData.tripAM} onChange={v => updateField("tripAM", v)} />
                    <Field label="رحلات نهارية (LT)" value={formData.tripLT} onChange={v => updateField("tripLT", v)} />
                    <Field label="رحلات مسائية (PM)" value={formData.tripPM} onChange={v => updateField("tripPM", v)} />
                  </div>
                </div>
              </Section>

              {/* Section 8: Construction Timeline */}
              <Section title="الجدول الزمني للإنشاءات" icon={Calendar} color="emerald">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="تاريخ السريان" value={formData.effectiveDate} onChange={v => updateField("effectiveDate", v)} />
                    <Field label="فترة البناء الإجمالية" value={formData.constructionPeriod} onChange={v => updateField("constructionPeriod", v)} />
                    <Field label="تاريخ بدء الإنشاء" value={formData.constructionStartDate} onChange={v => updateField("constructionStartDate", v)} />
                    <Field label="تاريخ الإنجاز المتوقع" value={formData.completionDate} onChange={v => updateField("completionDate", v)} />
                  </div>
                  <Field label="شروط بدء الإنشاء" value={formData.constructionConditions} onChange={v => updateField("constructionConditions", v)} type="textarea" />
                </div>
              </Section>

              {/* Section 9: Restrictions & Obligations */}
              <Section title="الالتزامات والقيود" icon={ShieldAlert} color="rose">
                <div className="space-y-4">
                  <Field label="قيود البيع والتصرف" value={formData.saleRestrictions} onChange={v => updateField("saleRestrictions", v)} type="textarea" />
                  <Field label="شروط إعادة البيع" value={formData.resaleConditions} onChange={v => updateField("resaleConditions", v)} type="textarea" />
                  <Field label="رسوم المجتمع" value={formData.communityCharges} onChange={v => updateField("communityCharges", v)} type="textarea" />
                </div>
              </Section>

              {/* Section 10: Registration & Fees */}
              <Section title="المستندات والرسوم" icon={Landmark} color="slate">
                <div className="space-y-4">
                  <Field label="جهة التسجيل" value={formData.registrationAuthority} onChange={v => updateField("registrationAuthority", v)} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="رسوم إدارية (AED)" value={formData.adminFee} onChange={v => updateField("adminFee", v)} type="number" />
                    <Field label="رسوم شهادة التخليص (AED)" value={formData.clearanceFee} onChange={v => updateField("clearanceFee", v)} type="number" />
                    <Field label="مبلغ التعويض (AED)" value={formData.compensationAmount} onChange={v => updateField("compensationAmount", v)} type="number" />
                  </div>
                </div>
              </Section>

              {/* Section 11: Governing Law */}
              <Section title="القانون الحاكم وتسوية النزاعات" icon={Scale} color="purple">
                <div className="space-y-4">
                  <Field label="القانون الساري" value={formData.governingLaw} onChange={v => updateField("governingLaw", v)} type="textarea" />
                  <Field label="آلية تسوية النزاعات" value={formData.disputeResolution} onChange={v => updateField("disputeResolution", v)} type="textarea" />
                </div>
              </Section>

              {/* Section 12: Notes */}
              <Section title="ملاحظات إضافية" icon={FileText} color="slate">
                <Field label="ملاحظات" value={formData.notes} onChange={v => updateField("notes", v)} type="textarea" placeholder="أي ملاحظات إضافية حول المشروع..." />
              </Section>
            </div>

            {/* Bottom Save Bar */}
            {hasChanges && (
              <div className="sticky bottom-4 z-10">
                <div className="bg-amber-600 text-white rounded-xl shadow-lg p-4 flex items-center justify-between max-w-lg mx-auto">
                  <span className="text-sm font-medium">لديك تعديلات غير محفوظة</span>
                  <Button
                    onClick={handleSave}
                    disabled={updateProject.isPending}
                    variant="outline"
                    size="sm"
                    className="bg-white text-amber-700 hover:bg-amber-50 border-white/30"
                  >
                    {updateProject.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <Save className="h-4 w-4 ml-1" />
                    )}
                    حفظ الآن
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Khazen Auto-Fill Dialog */}
      <Dialog open={khazenDialogOpen} onOpenChange={(open) => {
        if (!khazenLoading) {
          setKhazenDialogOpen(open);
          if (!open) {
            setKhazenStatus("idle");
            setKhazenProgress(0);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-700" />
              </div>
              تعبئة تلقائية من خازن
            </DialogTitle>
            <DialogDescription className="text-right">
              خازن يبحث في مستندات المشروع ويستخرج البيانات تلقائياً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              {khazenStatus === "analyzing" && (
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                </div>
              )}
              {khazenStatus === "done" && (
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              )}
              {khazenStatus === "error" && (
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {khazenStatus === "analyzing" ? "جاري التحليل..." :
                   khazenStatus === "done" ? "اكتمل بنجاح" :
                   khazenStatus === "error" ? "حدث خطأ" : ""}
                </p>
                <p className="text-xs text-muted-foreground">{khazenMessage}</p>
              </div>
            </div>

            {/* Progress bar */}
            {khazenStatus === "analyzing" && (
              <Progress value={khazenProgress} className="h-2" />
            )}

            {/* Success details */}
            {khazenStatus === "done" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {khazenMessage}
                </p>
              </div>
            )}

            {/* Error details */}
            {khazenStatus === "error" && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-xs text-rose-700">{khazenMessage}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-start">
            {khazenStatus === "done" && (
              <Button
                onClick={() => {
                  setKhazenDialogOpen(false);
                  setKhazenStatus("idle");
                  setKhazenProgress(0);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 ml-1" />
                تم
              </Button>
            )}
            {khazenStatus === "error" && (
              <Button
                onClick={handleKhazenAutoFill}
                variant="outline"
                size="sm"
                className="border-purple-300 text-purple-700"
              >
                <RefreshCw className="h-4 w-4 ml-1" />
                إعادة المحاولة
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
