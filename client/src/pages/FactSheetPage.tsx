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
  Ruler,
  Sparkles,
  RefreshCw,
  Calculator,
  PenLine,
  Database,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// ─────────────────────────────────────────────
// Field component - compact with source badge
// ─────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
  suffix,
  formula,
  source,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange?: (val: string) => void;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  readOnly?: boolean;
  suffix?: string;
  formula?: string;      // e.g. "40 AED × GFA م²"
  source?: "ai" | "manual" | "calc";
}) {
  const displayVal = value === null || value === undefined ? "" : String(value);

  const sourceBadge = source ? (
    <span className={`text-[9px] px-1 py-0.5 rounded font-medium ml-1 ${
      source === "ai" ? "bg-purple-100 text-purple-600" :
      source === "manual" ? "bg-amber-100 text-amber-600" :
      "bg-emerald-100 text-emerald-600"
    }`}>
      {source === "ai" ? "AI" : source === "manual" ? "يدوي" : "محسوب"}
    </span>
  ) : null;

  if (type === "textarea") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
          {sourceBadge}
        </div>
        <Textarea
          value={displayVal}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder || label}
          readOnly={readOnly}
          className={`min-h-[60px] text-xs border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none py-1.5 px-2.5 ${
            readOnly ? "bg-stone-50 text-stone-600" : "bg-white/50"
          }`}
        />
        {formula && (
          <div className="text-[10px] text-blue-500 flex items-center gap-1">
            <Calculator className="h-2.5 w-2.5" />
            <span dir="ltr">{formula}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
        {sourceBadge}
      </div>
      <div className="relative">
        <Input
          type={type}
          value={displayVal}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder || label}
          readOnly={readOnly}
          className={`text-xs h-8 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 py-1 px-2.5 ${
            readOnly ? "bg-stone-50 text-stone-600 cursor-default" : "bg-white/50"
          } ${suffix ? "pl-12" : ""}`}
        />
        {suffix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
      {formula && (
        <div className="text-[10px] text-blue-500 flex items-center gap-1">
          <Calculator className="h-2.5 w-2.5" />
          <span dir="ltr">{formula}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CalcRow - shows a calculated value with formula
// ─────────────────────────────────────────────
function CalcRow({ label, formula, value, unit = "AED", highlight = false }: {
  label: string;
  formula: string;
  value: number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-3 rounded-lg ${highlight ? "bg-emerald-50 border border-emerald-200" : "bg-stone-50 border border-stone-100"}`}>
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${highlight ? "text-emerald-800" : "text-stone-700"}`}>{label}</span>
        <span className="text-[10px] text-blue-500 font-mono" dir="ltr">{formula}</span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-bold font-mono ${highlight ? "text-emerald-700" : "text-stone-800"}`} dir="ltr">
          {value.toLocaleString("en-US")}
        </span>
        <span className="text-[10px] text-muted-foreground mr-1">{unit}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section wrapper with collapsible support
// ─────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  children,
  color = "amber",
  badge,
  defaultOpen = true,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  color?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  const iconColorMap: Record<string, string> = {
    amber: "text-amber-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    purple: "text-purple-600",
    rose: "text-rose-600",
    orange: "text-orange-600",
    slate: "text-slate-600",
    indigo: "text-indigo-600",
  };

  return (
    <Card className="border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <CardHeader
        className={`py-2 px-4 border-b ${colorMap[color]} cursor-pointer select-none`}
        onClick={() => setOpen(o => !o)}
      >
        <CardTitle className="text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 ${iconColorMap[color]}`} />
            {title}
            {badge && <span className="mr-1">{badge}</span>}
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5 opacity-50" /> : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="p-2.5">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// GroupHeader - sub-section label inside a card
// ─────────────────────────────────────────────
function GroupHeader({ label, color = "stone" }: { label: string; color?: string }) {
  const cls: Record<string, string> = {
    stone: "text-stone-500 border-stone-200",
    purple: "text-purple-600 border-purple-200",
    amber: "text-amber-600 border-amber-200",
    emerald: "text-emerald-600 border-emerald-200",
    blue: "text-blue-600 border-blue-200",
  };
  return (
    <div className={`flex items-center gap-2 pt-1 pb-0.5 border-b ${cls[color]}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${cls[color].split(" ")[0]}`}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function FactSheetPage({ embedded = false, initialProjectId, onBack }: { embedded?: boolean; initialProjectId?: number | null; onBack?: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
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
    selectedProjectId!,
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

  // Salwa notification mutation
  const salwaChat = trpc.agents.chat.useMutation();

  // ── FACT_SHEET_KEYS for completeness tracking ──
  const FACT_SHEET_KEYS = [
    // AI-extracted
    "plotNumber", "areaCode", "titleDeedNumber", "ddaNumber", "masterDevRef",
    "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
    "gfaResidentialSqft", "gfaRetailSqft", "gfaOfficesSqft",
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
    // Manual inputs
    "landPrice", "agentCommissionLandPct",
    "estimatedConstructionPricePerSqft", "manualBuaSqft",
    "designFeePct", "supervisionFeePct", "separationFeePerM2",
    "salesCommissionPct", "marketingPct", "developerFeePct",
    "soilTestFee", "topographicSurveyFee", "officialBodiesFees",
    "reraUnitRegFee", "reraProjectRegFee", "developerNocFee", "escrowAccountFee",
    "bankFees", "communityFees", "surveyorFees", "reraAuditReportFee", "reraInspectionReportFee",
    "preConMonths", "constructionMonths",
  ];

  const FIELD_LABELS: Record<string, string> = {
    titleDeedNumber: "رقم سند الملكية", ddaNumber: "رقم DDA", masterDevRef: "الرقم المرجعي للمطور",
    plotNumber: "رقم القطعة", areaCode: "كود المنطقة",
    plotAreaSqm: "مساحة الأرض (م²)", plotAreaSqft: "مساحة الأرض (قدم²)",
    gfaSqm: "GFA (م²)", gfaSqft: "GFA (قدم²)", bua: "BUA",
    gfaResidentialSqft: "GFA سكني", gfaRetailSqft: "GFA محلات", gfaOfficesSqft: "GFA مكاتب",
    permittedUse: "الاستخدام المسموح", ownershipType: "نوع الملكية", subdivisionRestrictions: "قيود التقسيم",
    masterDevName: "اسم المطور الرئيسي", masterDevAddress: "عنوان المطور الرئيسي",
    sellerName: "اسم البائع", sellerAddress: "عنوان البائع",
    buyerName: "اسم المشتري", buyerNationality: "جنسية المشتري", buyerPassport: "جواز المشتري",
    buyerAddress: "عنوان المشتري", buyerPhone: "هاتف المشتري", buyerEmail: "إيميل المشتري",
    electricityAllocation: "تخصيص الكهرباء", waterAllocation: "تخصيص المياه", sewageAllocation: "تخصيص الصرف",
    tripAM: "رحلات صباحية", tripLT: "رحلات ظهيرة", tripPM: "رحلات مسائية",
    effectiveDate: "تاريخ السريان", constructionPeriod: "فترة البناء",
    constructionStartDate: "تاريخ بدء البناء", completionDate: "تاريخ الانتهاء",
    constructionConditions: "شروط البناء",
    saleRestrictions: "قيود البيع", resaleConditions: "شروط إعادة البيع", communityCharges: "رسوم المجتمع",
    registrationAuthority: "جهة التسجيل", adminFee: "الرسوم الإدارية",
    clearanceFee: "رسوم المخالصة", compensationAmount: "مبلغ التعويض",
    governingLaw: "القانون الحاكم", disputeResolution: "آلية حل النزاعات",
    landPrice: "سعر الأرض", agentCommissionLandPct: "عمولة وسيط الأرض",
    estimatedConstructionPricePerSqft: "سعر القدم² التقديري", manualBuaSqft: "مساحة البناء (إدخال يدوي)",
    designFeePct: "أتعاب التصميم%", supervisionFeePct: "أتعاب الإشراف%",
    separationFeePerM2: "رسوم الفرز/قدم²", salesCommissionPct: "عمولة وسيط البيع%",
    marketingPct: "التسويق%", developerFeePct: "أتعاب المطور%",
    soilTestFee: "فحص التربة", topographicSurveyFee: "الرفع المساحي",
    officialBodiesFees: "رسوم الجهات", reraUnitRegFee: "تسجيل ريرا وحدات",
    reraProjectRegFee: "تسجيل ريرا مشروع", developerNocFee: "رسوم NOC",
    escrowAccountFee: "حساب الضمان", bankFees: "الرسوم البنكية",
    communityFees: "رسوم المجتمع", surveyorFees: "أتعاب المساح",
    reraAuditReportFee: "تدقيق ريرا", reraInspectionReportFee: "تفتيش ريرا",
    preConMonths: "مدة ما قبل التنفيذ", constructionMonths: "مدة الإنشاء",
  };

  // Report state
  const [khazenReport, setKhazenReport] = useState<{
    filledFields: string[];
    emptyFields: string[];
    newlyFilled: string[];
    beforeCount: number;
    afterCount: number;
  } | null>(null);

  const handleKhazenAutoFill = async () => {
    if (!selectedProjectId || !projectQuery.data) return;
    setKhazenDialogOpen(true);
    setKhazenLoading(true);
    setKhazenStatus("analyzing");
    setKhazenMessage("جاري إرسال الطلب لخازن...");
    setKhazenProgress(10);
    setKhazenReport(null);

    const beforeSnapshot: Record<string, boolean> = {};
    for (const key of FACT_SHEET_KEYS) {
      beforeSnapshot[key] = !!(formData[key] && String(formData[key]).trim() !== "");
    }
    const beforeCount = Object.values(beforeSnapshot).filter(Boolean).length;

    try {
      const projectName = projectQuery.data.name;
      const prompt =
        `أنا بحاجة لتعبئة بطاقة بيانات المشروع "${projectName}" (معرف المشروع: ${selectedProjectId}). ` +
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

      const result = await khazenChat.mutateAsync({ agent: "khazen", message: prompt });

      setKhazenProgress(80);
      setKhazenMessage("خازن أنهى التحليل. جاري تحديث البيانات...");

      const refetched = await projectQuery.refetch();
      const updatedProject = refetched.data;

      const filledFields: string[] = [];
      const emptyFields: string[] = [];
      const newlyFilled: string[] = [];

      if (updatedProject) {
        for (const key of FACT_SHEET_KEYS) {
          const val = (updatedProject as any)[key];
          const isFilled = !!(val && String(val).trim() !== "");
          if (isFilled) {
            filledFields.push(key);
            if (!beforeSnapshot[key]) newlyFilled.push(key);
          } else {
            emptyFields.push(key);
          }
        }
      }

      const afterCount = filledFields.length;
      setKhazenReport({ filledFields, emptyFields, newlyFilled, beforeCount, afterCount });
      setKhazenProgress(100);
      setKhazenStatus("done");
      setKhazenMessage(result.response || "تم تعبئة البيانات بنجاح");

      const notifMessage =
        `خازن أنهى تعبئة بطاقة بيانات المشروع "${projectName}".\n` +
        `📊 النتيجة: ${afterCount}/${FACT_SHEET_KEYS.length} حقل مكتمل (${Math.round((afterCount / FACT_SHEET_KEYS.length) * 100)}%)\n` +
        `✅ حقول جديدة: ${newlyFilled.length}\n` +
        (emptyFields.length > 0 ? `⚠️ حقول فارغة (${emptyFields.length}): ${emptyFields.slice(0, 5).map(k => FIELD_LABELS[k] || k).join("، ")}${emptyFields.length > 5 ? " وغيرها..." : ""}` : "");

      salwaChat.mutateAsync({ agent: "salwa", message: `أبلغي المستخدم بالتالي: ${notifMessage}` }).catch(() => {});
      toast.success(`تم تعبئة ${newlyFilled.length} حقل جديد من خازن`);
    } catch (err: any) {
      setKhazenStatus("error");
      setKhazenMessage("حدث خطأ أثناء التعبئة: " + (err.message || "خطأ غير معروف"));
      toast.error("فشل في تعبئة البيانات من خازن");
      salwaChat.mutateAsync({ agent: "salwa", message: `أبلغي المستخدم أن خازن واجه مشكلة: ${err.message || "خطأ غير معروف"}` }).catch(() => {});
    } finally {
      setKhazenLoading(false);
    }
  };

  // Load project data into form
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data;
      setFormData({
        // AI-extracted: Identification
        titleDeedNumber: p.titleDeedNumber || "",
        ddaNumber: p.ddaNumber || "",
        masterDevRef: p.masterDevRef || "",
        plotNumber: p.plotNumber || "",
        areaCode: p.areaCode || "",
        // AI-extracted: Areas
        plotAreaSqm: p.plotAreaSqm || "",
        plotAreaSqft: p.plotAreaSqft || "",
        gfaSqm: p.gfaSqm || "",
        gfaSqft: p.gfaSqft || "",
        bua: p.bua || "",
        gfaResidentialSqft: p.gfaResidentialSqft || "",
        gfaRetailSqft: p.gfaRetailSqft || "",
        gfaOfficesSqft: p.gfaOfficesSqft || "",
        // AI-extracted: Usage
        permittedUse: p.permittedUse || "",
        ownershipType: p.ownershipType || "",
        subdivisionRestrictions: p.subdivisionRestrictions || "",
        // AI-extracted: Parties
        masterDevName: p.masterDevName || "",
        masterDevAddress: p.masterDevAddress || "",
        sellerName: p.sellerName || "",
        sellerAddress: p.sellerAddress || "",
        buyerName: p.buyerName || "",
        buyerNationality: p.buyerNationality || "",
        buyerPassport: p.buyerPassport || "",
        buyerAddress: p.buyerAddress || "",
        buyerPhone: p.buyerPhone || "",
        buyerEmail: p.buyerEmail || "",
        // AI-extracted: Infrastructure
        electricityAllocation: p.electricityAllocation || "",
        waterAllocation: p.waterAllocation || "",
        sewageAllocation: p.sewageAllocation || "",
        tripAM: p.tripAM || "",
        tripLT: p.tripLT || "",
        tripPM: p.tripPM || "",
        // AI-extracted: Timeline
        effectiveDate: p.effectiveDate || "",
        constructionPeriod: p.constructionPeriod || "",
        constructionStartDate: p.constructionStartDate || "",
        completionDate: p.completionDate || "",
        constructionConditions: p.constructionConditions || "",
        // AI-extracted: Restrictions
        saleRestrictions: p.saleRestrictions || "",
        resaleConditions: p.resaleConditions || "",
        communityCharges: p.communityCharges || "",
        // AI-extracted: Registration
        registrationAuthority: p.registrationAuthority || "",
        adminFee: p.adminFee || "",
        clearanceFee: p.clearanceFee || "",
        compensationAmount: p.compensationAmount || "",
        // AI-extracted: Legal
        governingLaw: p.governingLaw || "",
        disputeResolution: p.disputeResolution || "",
        // Manual: Land purchase
        landPrice: p.landPrice || "",
        agentCommissionLandPct: p.agentCommissionLandPct ? String(p.agentCommissionLandPct) : "",
        // Manual: Construction
        manualBuaSqft: p.manualBuaSqft || "",
        estimatedConstructionPricePerSqft: p.estimatedConstructionPricePerSqft || "",
        // Manual: Pre-construction fees (fixed amounts)
        soilTestFee: p.soilTestFee || "",
        topographicSurveyFee: p.topographicSurveyFee || "",
        officialBodiesFees: p.officialBodiesFees || "",
        // Manual: Regulatory fees (fixed amounts)
        reraUnitRegFee: p.reraUnitRegFee || "",
        reraProjectRegFee: p.reraProjectRegFee || "",
        developerNocFee: p.developerNocFee || "",
        escrowAccountFee: p.escrowAccountFee || "",
        bankFees: p.bankFees || "",
        communityFees: p.communityFees || "",
        surveyorFees: p.surveyorFees || "",
        reraAuditReportFee: p.reraAuditReportFee || "",
        reraInspectionReportFee: p.reraInspectionReportFee || "",
        // Manual: Variable cost percentages
        designFeePct: p.designFeePct ? String(p.designFeePct) : "2",
        supervisionFeePct: p.supervisionFeePct ? String(p.supervisionFeePct) : "2",
        separationFeePerM2: p.separationFeePerM2 ? String(p.separationFeePerM2) : "40",
        // Manual: Revenue-based percentages (amount calculated after feasibility)
        salesCommissionPct: p.salesCommissionPct ? String(p.salesCommissionPct) : "5",
        marketingPct: p.marketingPct ? String(p.marketingPct) : "2",
        developerFeePct: p.developerFeePct ? String(p.developerFeePct) : "5",
        // Manual: Phase durations (sourced from regulatory compliance pathway)
        preConMonths: p.preConMonths ? String(p.preConMonths) : "6",
        constructionMonths: p.constructionMonths ? String(p.constructionMonths) : "18",
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
    const numericIntFields = ["bua", "adminFee", "clearanceFee", "compensationAmount", "preConMonths", "constructionMonths"];
    for (const [key, value] of Object.entries(formData)) {
      if (numericIntFields.includes(key)) {
        payload[key] = value ? Number(value) : undefined;
      } else {
        payload[key] = (value !== null && value !== undefined && String(value).trim() !== "") ? value : undefined;
      }
    }
    updateProject.mutate(payload as any);
  };

  // ── Derived calculations ──
  const n = (k: string, fallback = 0) => parseFloat(formData[k] || String(fallback)) || 0;

  const gfaSqm = n("gfaSqm");
  const gfaSqft = n("gfaSqft");
  const manualBuaSqft = n("manualBuaSqft");
  const landPrice = n("landPrice");
  const agentCommLandPct = n("agentCommissionLandPct", 1);
  const constructionPricePerSqft = n("estimatedConstructionPricePerSqft", 350);
  const designFeePct = n("designFeePct", 2);
  const supervisionFeePct = n("supervisionFeePct", 2);
  const separationFeePerM2 = n("separationFeePerM2", 40);

  const agentCommLand = landPrice * (agentCommLandPct / 100);
  const constructionCost = manualBuaSqft * constructionPricePerSqft;
  const designFee = constructionCost * (designFeePct / 100);
  const supervisionFee = constructionCost * (supervisionFeePct / 100);
  const separationFee = gfaSqft * separationFeePerM2;

  const fixedFees =
    n("soilTestFee") + n("topographicSurveyFee") + n("officialBodiesFees") +
    n("reraUnitRegFee") + n("reraProjectRegFee") + n("developerNocFee") +
    n("escrowAccountFee") + n("bankFees") + n("communityFees") +
    n("surveyorFees") + n("reraAuditReportFee") + n("reraInspectionReportFee");

  const totalKnownCosts = landPrice + agentCommLand + constructionCost + designFee + supervisionFee + separationFee + fixedFees;

  // Completeness
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
    <div className={embedded ? "bg-gradient-to-b from-stone-50 to-white" : "min-h-screen bg-gradient-to-b from-stone-50 to-white"} dir="rtl">
      {/* ── Header ── */}
      <div className={`sticky ${embedded ? "top-[105px]" : "top-0"} z-20 bg-white/80 backdrop-blur-md border-b border-stone-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!embedded && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 ml-1" />
                    الرئيسية
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
              {embedded && onBack && (
                <>
                  <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 ml-1" />
                    العودة
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
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
              {!initialProjectId && (
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
              )}

              {selectedProjectId && (
                <>
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

                  <Button
                    onClick={handleKhazenAutoFill}
                    disabled={khazenLoading}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    {khazenLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Sparkles className="h-4 w-4 ml-1" />}
                    تعبئة تلقائية من خازن
                  </Button>

                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updateProject.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    size="sm"
                  >
                    {updateProject.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                    حفظ التعديلات
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
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
          <div className="space-y-4">

            {/* ── Project Banner ── */}
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
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <div className="text-2xl font-bold text-amber-700">{completeness}%</div>
                  <div className="text-[11px] text-muted-foreground">اكتمال البيانات</div>
                </div>
                <div className="w-32 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completeness >= 80 ? "bg-emerald-500" :
                      completeness >= 40 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex items-center gap-4 px-1">
              <span className="text-[10px] text-stone-500 font-medium">مصدر البيانات:</span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">AI</span>
                <span className="text-stone-500">يستخرجه خازن من الوثائق</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">يدوي</span>
                <span className="text-stone-500">تُدخله يدوياً</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-medium">محسوب</span>
                <span className="text-stone-500">يُحسب تلقائياً</span>
              </span>
            </div>

            {/* ══════════════════════════════════════════════
                SECTION A — AI-EXTRACTED DATA
            ══════════════════════════════════════════════ */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Database className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-800">أ — بيانات مستخرجة من الوثائق (AI)</h3>
                <p className="text-[10px] text-purple-500">يسحبها خازن تلقائياً من Affection Plan / Title Deed / DDA</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">

              {/* A1: Identification */}
              <Section title="أرقام التعريف والتسجيل" icon={FileText} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field label="رقم القطعة" value={formData.plotNumber} onChange={v => updateField("plotNumber", v)} placeholder="مثال: 6185392" source="ai" />
                  <Field label="كود المنطقة" value={formData.areaCode} onChange={v => updateField("areaCode", v)} placeholder="مثال: Nas-R" source="ai" />
                  <Field label="رقم سند الملكية (Title Deed)" value={formData.titleDeedNumber} onChange={v => updateField("titleDeedNumber", v)} source="ai" />
                  <Field label="رقم DDA" value={formData.ddaNumber} onChange={v => updateField("ddaNumber", v)} source="ai" />
                  <Field label="الرقم المرجعي للمطور الرئيسي" value={formData.masterDevRef} onChange={v => updateField("masterDevRef", v)} source="ai" />
                </div>
              </Section>

              {/* A2: Areas */}
              <Section title="المساحات" icon={Ruler} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="مساحة الأرض (م²)" value={formData.plotAreaSqm} onChange={v => updateField("plotAreaSqm", v)} source="ai" />
                    <Field label="مساحة الأرض (قدم²)" value={formData.plotAreaSqft} onChange={v => updateField("plotAreaSqft", v)} source="ai" />
                    <Field label="GFA المسموح (م²)" value={formData.gfaSqm} onChange={v => updateField("gfaSqm", v)} source="ai" />
                    <Field label="GFA المسموح (قدم²)" value={formData.gfaSqft} onChange={v => updateField("gfaSqft", v)} source="ai" />
                  </div>
                  <GroupHeader label="GFA حسب النوع (قدم²)" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="GFA سكني" value={formData.gfaResidentialSqft} onChange={v => updateField("gfaResidentialSqft", v)} type="number" suffix="sqft" source="ai" />
                    <Field label="GFA محلات" value={formData.gfaRetailSqft} onChange={v => updateField("gfaRetailSqft", v)} type="number" suffix="sqft" source="ai" />
                    <Field label="GFA مكاتب" value={formData.gfaOfficesSqft} onChange={v => updateField("gfaOfficesSqft", v)} type="number" suffix="sqft" source="ai" />
                  </div>
                  {/* Auto-calculated sellable areas */}
                  {(n("gfaResidentialSqft") > 0 || n("gfaRetailSqft") > 0 || n("gfaOfficesSqft") > 0) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-2">
                        <Calculator className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] font-semibold text-emerald-700">المساحات القابلة للبيع (محسوب)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {n("gfaResidentialSqft") > 0 && (
                          <div>
                            <div className="text-[10px] text-emerald-500">سكني × 95%</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono" dir="ltr">
                              {Math.round(n("gfaResidentialSqft") * 0.95).toLocaleString("en-US")}
                            </div>
                          </div>
                        )}
                        {n("gfaRetailSqft") > 0 && (
                          <div>
                            <div className="text-[10px] text-emerald-500">محلات × 97%</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono" dir="ltr">
                              {Math.round(n("gfaRetailSqft") * 0.97).toLocaleString("en-US")}
                            </div>
                          </div>
                        )}
                        {n("gfaOfficesSqft") > 0 && (
                          <div>
                            <div className="text-[10px] text-emerald-500">مكاتب × 95%</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono" dir="ltr">
                              {Math.round(n("gfaOfficesSqft") * 0.95).toLocaleString("en-US")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* A3: Usage */}
              <Section title="الاستخدام ونوع الملكية" icon={Landmark} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-2.5">
                  <Field label="الاستخدام المسموح" value={formData.permittedUse} onChange={v => updateField("permittedUse", v)} source="ai" />
                  <Field label="نوع الملكية" value={formData.ownershipType} onChange={v => updateField("ownershipType", v)} source="ai" />
                  <Field label="قيود التجزئة" value={formData.subdivisionRestrictions} onChange={v => updateField("subdivisionRestrictions", v)} type="textarea" source="ai" />
                </div>
              </Section>

              {/* A4: Master Developer & Seller */}
              <Section title="الأطراف (المطور / البائع / المشتري)" icon={Users} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-3">
                  <GroupHeader label="المطور الرئيسي" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="اسم المطور" value={formData.masterDevName} onChange={v => updateField("masterDevName", v)} source="ai" />
                    <Field label="عنوان المطور" value={formData.masterDevAddress} onChange={v => updateField("masterDevAddress", v)} source="ai" />
                  </div>
                  <GroupHeader label="البائع" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="اسم البائع" value={formData.sellerName} onChange={v => updateField("sellerName", v)} source="ai" />
                    <Field label="عنوان البائع" value={formData.sellerAddress} onChange={v => updateField("sellerAddress", v)} source="ai" />
                  </div>
                  <GroupHeader label="المشتري" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="اسم المشتري" value={formData.buyerName} onChange={v => updateField("buyerName", v)} source="ai" />
                    <Field label="الجنسية" value={formData.buyerNationality} onChange={v => updateField("buyerNationality", v)} source="ai" />
                    <Field label="رقم الجواز" value={formData.buyerPassport} onChange={v => updateField("buyerPassport", v)} source="ai" />
                    <Field label="العنوان" value={formData.buyerAddress} onChange={v => updateField("buyerAddress", v)} source="ai" />
                    <Field label="الهاتف" value={formData.buyerPhone} onChange={v => updateField("buyerPhone", v)} source="ai" />
                    <Field label="البريد الإلكتروني" value={formData.buyerEmail} onChange={v => updateField("buyerEmail", v)} source="ai" />
                  </div>
                </div>
              </Section>

              {/* A5: Infrastructure */}
              <Section title="البنية التحتية وحركة المرور" icon={Zap} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-3">
                  <GroupHeader label="التخصيصات" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="الكهرباء (كيلوواط)" value={formData.electricityAllocation} onChange={v => updateField("electricityAllocation", v)} source="ai" />
                    <Field label="المياه (م³/يوم)" value={formData.waterAllocation} onChange={v => updateField("waterAllocation", v)} source="ai" />
                    <Field label="الصرف الصحي (م³/يوم)" value={formData.sewageAllocation} onChange={v => updateField("sewageAllocation", v)} source="ai" />
                  </div>
                  <GroupHeader label="حركة المرور" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="رحلات صباحية (AM)" value={formData.tripAM} onChange={v => updateField("tripAM", v)} source="ai" />
                    <Field label="رحلات نهارية (LT)" value={formData.tripLT} onChange={v => updateField("tripLT", v)} source="ai" />
                    <Field label="رحلات مسائية (PM)" value={formData.tripPM} onChange={v => updateField("tripPM", v)} source="ai" />
                  </div>
                </div>
              </Section>

              {/* A6: Timeline */}
              <Section title="الجدول الزمني (من العقد)" icon={Calendar} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field label="تاريخ السريان" value={formData.effectiveDate} onChange={v => updateField("effectiveDate", v)} source="ai" />
                  <Field label="فترة البناء الإجمالية" value={formData.constructionPeriod} onChange={v => updateField("constructionPeriod", v)} source="ai" />
                  <Field label="تاريخ بدء الإنشاء" value={formData.constructionStartDate} onChange={v => updateField("constructionStartDate", v)} source="ai" />
                  <Field label="تاريخ الإنجاز المتوقع" value={formData.completionDate} onChange={v => updateField("completionDate", v)} source="ai" />
                  <Field label="شروط بدء الإنشاء" value={formData.constructionConditions} onChange={v => updateField("constructionConditions", v)} type="textarea" source="ai" />
                </div>
              </Section>

              {/* A7: Restrictions */}
              <Section title="الالتزامات والقيود" icon={ShieldAlert} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-2.5">
                  <Field label="قيود البيع والتصرف" value={formData.saleRestrictions} onChange={v => updateField("saleRestrictions", v)} type="textarea" source="ai" />
                  <Field label="شروط إعادة البيع" value={formData.resaleConditions} onChange={v => updateField("resaleConditions", v)} type="textarea" source="ai" />
                  <Field label="رسوم المجتمع" value={formData.communityCharges} onChange={v => updateField("communityCharges", v)} type="textarea" source="ai" />
                </div>
              </Section>

              {/* A8: Registration & Legal */}
              <Section title="التسجيل والقانون" icon={Scale} color="purple"
                badge={<Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 py-0">AI</Badge>}>
                <div className="space-y-3">
                  <GroupHeader label="التسجيل والرسوم" color="purple" />
                  <Field label="جهة التسجيل" value={formData.registrationAuthority} onChange={v => updateField("registrationAuthority", v)} source="ai" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="رسوم إدارية (AED)" value={formData.adminFee} onChange={v => updateField("adminFee", v)} type="number" source="ai" />
                    <Field label="رسوم شهادة التخليص (AED)" value={formData.clearanceFee} onChange={v => updateField("clearanceFee", v)} type="number" source="ai" />
                    <Field label="مبلغ التعويض (AED)" value={formData.compensationAmount} onChange={v => updateField("compensationAmount", v)} type="number" source="ai" />
                  </div>
                  <GroupHeader label="القانون الحاكم" color="purple" />
                  <Field label="القانون الساري" value={formData.governingLaw} onChange={v => updateField("governingLaw", v)} type="textarea" source="ai" />
                  <Field label="آلية تسوية النزاعات" value={formData.disputeResolution} onChange={v => updateField("disputeResolution", v)} type="textarea" source="ai" />
                </div>
              </Section>

            </div>{/* end AI grid */}

            {/* ══════════════════════════════════════════════
                SECTION B — MANUAL INPUTS
            ══════════════════════════════════════════════ */}
            <div className="flex items-center gap-3 pt-4">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <PenLine className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-800">ب — الإدخالات اليدوية</h3>
                <p className="text-[10px] text-amber-500">قيم تُدخلها يدوياً — تُستخدم في الحسابات التلقائية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">

              {/* B1: Land Purchase */}
              <Section title="بيانات شراء الأرض" icon={Landmark} color="amber"
                badge={<Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 py-0">يدوي</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="سعر الأرض (AED)" value={formData.landPrice} onChange={v => updateField("landPrice", v)} type="number" suffix="AED" source="manual" />
                  <Field
                    label="عمولة وسيط الأرض (%)"
                    value={formData.agentCommissionLandPct}
                    onChange={v => updateField("agentCommissionLandPct", v)}
                    type="number"
                    suffix="%"
                    source="manual"
                    formula={`${agentCommLandPct}% × سعر الأرض`}
                  />
                </div>
              </Section>

              {/* B2: Construction */}
              <Section title="تكلفة البناء التقديرية" icon={Building2} color="amber"
                badge={<Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 py-0">يدوي</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="مساحة البناء BUA (قدم²)" value={formData.manualBuaSqft} onChange={v => updateField("manualBuaSqft", v)} type="number" suffix="sqft" source="manual" />
                  <Field
                    label="السعر التقديري للقدم² (AED)"
                    value={formData.estimatedConstructionPricePerSqft}
                    onChange={v => updateField("estimatedConstructionPricePerSqft", v)}
                    type="number"
                    suffix="AED"
                    source="manual"
                    formula={`BUA × سعر القدم²`}
                  />
                </div>
              </Section>

              {/* B3: Pre-construction fixed fees */}
              <Section title="رسوم ما قبل البناء (مبالغ ثابتة)" icon={FileText} color="amber"
                badge={<Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 py-0">يدوي</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field label="فحص التربة" value={formData.soilTestFee} onChange={v => updateField("soilTestFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="الرفع المساحي الطبوغرافي" value={formData.topographicSurveyFee} onChange={v => updateField("topographicSurveyFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="رسوم الجهات الرسمية" value={formData.officialBodiesFees} onChange={v => updateField("officialBodiesFees", v)} type="number" suffix="AED" source="manual" />
                </div>
              </Section>

              {/* B4: Regulatory fees */}
              <Section title="الرسوم التنظيمية (مبالغ ثابتة)" icon={Landmark} color="amber"
                badge={<Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 py-0">يدوي</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field label="تسجيل الوحدات — ريرا" value={formData.reraUnitRegFee} onChange={v => updateField("reraUnitRegFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="تسجيل المشروع — ريرا" value={formData.reraProjectRegFee} onChange={v => updateField("reraProjectRegFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="رسوم NOC للبيع — المطور" value={formData.developerNocFee} onChange={v => updateField("developerNocFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="فتح حساب الضمان" value={formData.escrowAccountFee} onChange={v => updateField("escrowAccountFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="الرسوم البنكية" value={formData.bankFees} onChange={v => updateField("bankFees", v)} type="number" suffix="AED" source="manual" />
                  <Field label="رسوم المجتمع" value={formData.communityFees} onChange={v => updateField("communityFees", v)} type="number" suffix="AED" source="manual" />
                  <Field label="أتعاب المساح (تأكيد المساحات)" value={formData.surveyorFees} onChange={v => updateField("surveyorFees", v)} type="number" suffix="AED" source="manual" />
                  <Field label="تقارير تدقيق ريرا الدورية" value={formData.reraAuditReportFee} onChange={v => updateField("reraAuditReportFee", v)} type="number" suffix="AED" source="manual" />
                  <Field label="تقارير تفتيش ريرا الدورية" value={formData.reraInspectionReportFee} onChange={v => updateField("reraInspectionReportFee", v)} type="number" suffix="AED" source="manual" />
                </div>
              </Section>

              {/* B5: Variable cost percentages (construction-based) */}
              <Section title="نسب التكاليف المتغيرة (مرتبطة بتكلفة البناء)" icon={Calculator} color="amber"
                badge={<Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 py-0">يدوي</Badge>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field
                    label="أتعاب التصميم (%)"
                    value={formData.designFeePct}
                    onChange={v => updateField("designFeePct", v)}
                    type="number"
                    suffix="%"
                    source="manual"
                    formula={`${designFeePct}% × تكلفة البناء`}
                  />
                  <Field
                    label="أتعاب الإشراف (%)"
                    value={formData.supervisionFeePct}
                    onChange={v => updateField("supervisionFeePct", v)}
                    type="number"
                    suffix="%"
                    source="manual"
                    formula={`${supervisionFeePct}% × تكلفة البناء`}
                  />
                  {/* رسوم الفرز - حقل مخصص */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <label className="text-[11px] font-medium text-muted-foreground">رسوم الفرز (AED/قدم²)</label>
                      <span className="text-[9px] px-1 py-0.5 rounded font-medium ml-1 bg-amber-100 text-amber-600">يدوي</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.separationFeePerM2 || "40"}
                        onChange={e => updateField("separationFeePerM2", e.target.value)}
                        placeholder="40"
                        className="text-xs h-8 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 py-1 px-2.5 bg-white/50 pl-14"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">قدم²/AED</span>
                    </div>
                    <div className="bg-blue-50/60 border border-blue-100 rounded-md p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-blue-600 font-medium">GFA (قدم²)</span>
                        <span className="text-blue-800 font-bold font-mono" dir="ltr">{gfaSqft.toLocaleString("en-US")} sqft</span>
                      </div>
                      <div className="border-t border-blue-200 pt-1 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-blue-500">
                          <Calculator className="h-2.5 w-2.5" />
                          <span dir="ltr">{separationFeePerM2} AED × {gfaSqft.toLocaleString("en-US")} قدم²</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 font-mono" dir="ltr">{separationFee.toLocaleString("en-US")} AED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* B6: Revenue-based percentages */}
              <Section
                title="نسب التكاليف المرتبطة بالإيرادات"
                icon={Calculator}
                color="orange"
                badge={<Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-600 border-orange-200 py-0">يدوي — نسبة فقط</Badge>}
              >
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-700">
                      هذه الرسوم تُحسب كنسبة من إجمالي الإيرادات. المبالغ الفعلية تُحسب بعد دراسة الجدوى وتحديد سعر البيع.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="عمولة وسيط البيع (%)"
                      value={formData.salesCommissionPct}
                      onChange={v => updateField("salesCommissionPct", v)}
                      type="number"
                      suffix="%"
                      source="manual"
                      formula={`${n("salesCommissionPct", 5)}% × إجمالي الإيرادات`}
                    />
                    <Field
                      label="التسويق والإعلان (%)"
                      value={formData.marketingPct}
                      onChange={v => updateField("marketingPct", v)}
                      type="number"
                      suffix="%"
                      source="manual"
                      formula={`${n("marketingPct", 2)}% × إجمالي الإيرادات`}
                    />
                    <Field
                      label="أتعاب المطور (%)"
                      value={formData.developerFeePct}
                      onChange={v => updateField("developerFeePct", v)}
                      type="number"
                      suffix="%"
                      source="manual"
                      formula={`${n("developerFeePct", 5)}% × إجمالي الإيرادات`}
                    />
                  </div>
                </div>
              </Section>

              {/* B7: Phase durations */}
              <Section
                title="مدد المراحل الزمنية"
                icon={Calendar}
                color="indigo"
                badge={<Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-600 border-indigo-200 py-0">يدوي — من مسار الامتثال</Badge>}
              >
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-700">
                      المصدر الأصلي: <strong>مسار الامتثال التنظيمي</strong>. القيم هنا تُستخدم في جدول الرأسمال الشهري.
                      يُنصح بمطابقتها مع المسار قبل توليد الجدول.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">مرحلة التصميم (شهر)</label>
                      <div className="text-[10px] text-indigo-500 mb-1">تعيين الاستشاري + التصميم</div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.preConMonths || "6"}
                          onChange={e => updateField("preConMonths", e.target.value)}
                          className="text-xs h-8 bg-white/50 border-stone-200 focus:border-indigo-400 pl-10"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">شهر</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">مرحلة ما قبل البيع (شهر)</label>
                      <div className="text-[10px] text-indigo-500 mb-1">تسجيل ريرا + Off-plan</div>
                      <div className="relative">
                        <Input
                          type="number"
                          defaultValue="3"
                          readOnly
                          className="text-xs h-8 bg-stone-50 border-stone-200 text-stone-500 cursor-default pl-10"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">شهر</span>
                      </div>
                      <div className="text-[9px] text-stone-400">ثابت من ريرا</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">مرحلة الإنشاء (شهر)</label>
                      <div className="text-[10px] text-indigo-500 mb-1">تنفيذ البناء</div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.constructionMonths || "18"}
                          onChange={e => updateField("constructionMonths", e.target.value)}
                          className="text-xs h-8 bg-white/50 border-stone-200 focus:border-indigo-400 pl-10"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">شهر</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[11px] text-stone-600">إجمالي مدة المشروع</span>
                    <span className="text-sm font-bold text-stone-800 font-mono" dir="ltr">
                      {(n("preConMonths", 6) + 3 + n("constructionMonths", 18))} شهر
                    </span>
                  </div>
                </div>
              </Section>

              {/* B8: Notes */}
              <Section title="ملاحظات إضافية" icon={FileText} color="slate">
                <Field label="ملاحظات" value={formData.notes} onChange={v => updateField("notes", v)} type="textarea" placeholder="أي ملاحظات إضافية حول المشروع..." />
              </Section>

            </div>{/* end Manual grid */}

            {/* ══════════════════════════════════════════════
                SECTION C — AUTO-CALCULATED SUMMARY
            ══════════════════════════════════════════════ */}
            <div className="flex items-center gap-3 pt-4">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Calculator className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-800">ج — القيم المحسوبة تلقائياً</h3>
                <p className="text-[10px] text-emerald-500">تُحسب من البيانات المدخلة — للمراجعة فقط</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">

              {/* C1: Cost calculations */}
              <Section title="ملخص التكاليف المحسوبة" icon={Calculator} color="emerald"
                badge={<Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 py-0">محسوب</Badge>}>
                <div className="space-y-1.5">
                  <CalcRow
                    label="سعر الأرض"
                    formula="إدخال يدوي"
                    value={landPrice}
                  />
                  <CalcRow
                    label="عمولة وسيط الأرض"
                    formula={`${agentCommLandPct}% × ${landPrice.toLocaleString("en-US")}`}
                    value={agentCommLand}
                  />
                  <CalcRow
                    label="تكلفة البناء التقديرية"
                    formula={`${manualBuaSqft.toLocaleString("en-US")} sqft × ${constructionPricePerSqft} AED`}
                    value={constructionCost}
                  />
                  <CalcRow
                    label="أتعاب التصميم"
                    formula={`${designFeePct}% × تكلفة البناء`}
                    value={designFee}
                  />
                  <CalcRow
                    label="أتعاب الإشراف"
                    formula={`${supervisionFeePct}% × تكلفة البناء`}
                    value={supervisionFee}
                  />
                  <CalcRow
                    label="رسوم الفرز"
                    formula={`${separationFeePerM2} AED × ${gfaSqft.toLocaleString("en-US")} قدم²`}
                    value={separationFee}
                  />
                  <CalcRow
                    label="إجمالي الرسوم الثابتة"
                    formula="مجموع كل الرسوم المدخلة يدوياً"
                    value={fixedFees}
                  />
                  <Separator className="my-1" />
                  <CalcRow
                    label="إجمالي التكاليف المعروفة"
                    formula="الأرض + البناء + التصميم + الإشراف + الفرز + الرسوم"
                    value={totalKnownCosts}
                    highlight
                  />
                </div>
              </Section>

              {/* C2: Revenue-based fees note */}
              <Section title="التكاليف المرتبطة بالإيرادات (تُحسب لاحقاً)" icon={Info} color="emerald"
                badge={<Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 py-0">محسوب</Badge>}>
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-[10px] text-amber-700 mb-2">
                      المبالغ التالية تعتمد على إجمالي الإيرادات الذي يُحدد في دراسة الجدوى. النسب محفوظة وجاهزة للتطبيق.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-stone-50 border border-stone-100">
                      <div>
                        <span className="text-xs font-medium text-stone-700">عمولة وسيط البيع</span>
                        <div className="text-[10px] text-blue-500 font-mono" dir="ltr">{n("salesCommissionPct", 5)}% × إجمالي الإيرادات</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                        {n("salesCommissionPct", 5)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-stone-50 border border-stone-100">
                      <div>
                        <span className="text-xs font-medium text-stone-700">التسويق والإعلان</span>
                        <div className="text-[10px] text-blue-500 font-mono" dir="ltr">{n("marketingPct", 2)}% × إجمالي الإيرادات</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                        {n("marketingPct", 2)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-stone-50 border border-stone-100">
                      <div>
                        <span className="text-xs font-medium text-stone-700">أتعاب المطور</span>
                        <div className="text-[10px] text-blue-500 font-mono" dir="ltr">{n("developerFeePct", 5)}% × إجمالي الإيرادات</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                        {n("developerFeePct", 5)}%
                      </Badge>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-xs font-medium text-stone-700">إجمالي نسبة التكاليف الإيرادية</span>
                      <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                        {(n("salesCommissionPct", 5) + n("marketingPct", 2) + n("developerFeePct", 5)).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </Section>

              {/* C3: Phase timeline summary */}
              <Section title="ملخص الجدول الزمني للمراحل" icon={Calendar} color="emerald"
                badge={<Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 py-0">محسوب</Badge>}>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-[10px] text-blue-500 mb-1">المرحلة 1</div>
                      <div className="text-base font-bold text-blue-700">{n("preConMonths", 6)}</div>
                      <div className="text-[10px] text-blue-600">شهر</div>
                      <div className="text-[9px] text-blue-400 mt-1">تصميم</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-[10px] text-amber-500 mb-1">المرحلة 2</div>
                      <div className="text-base font-bold text-amber-700">3</div>
                      <div className="text-[10px] text-amber-600">شهر</div>
                      <div className="text-[9px] text-amber-400 mt-1">ريرا / Off-plan</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="text-[10px] text-emerald-500 mb-1">المرحلة 3</div>
                      <div className="text-base font-bold text-emerald-700">{n("constructionMonths", 18)}</div>
                      <div className="text-[10px] text-emerald-600">شهر</div>
                      <div className="text-[9px] text-emerald-400 mt-1">إنشاء</div>
                    </div>
                  </div>
                  <div className="bg-stone-100 rounded-lg p-2.5 flex items-center justify-between">
                    <span className="text-xs text-stone-600">إجمالي مدة المشروع</span>
                    <span className="text-sm font-bold text-stone-800 font-mono">
                      {n("preConMonths", 6) + 3 + n("constructionMonths", 18)} شهراً
                    </span>
                  </div>
                </div>
              </Section>

            </div>{/* end Calc grid */}

            {/* ── Bottom Save Bar ── */}
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
                    {updateProject.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                    حفظ الآن
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Khazen Auto-Fill Dialog ── */}
      <Dialog open={khazenDialogOpen} onOpenChange={(open) => {
        if (!khazenLoading) {
          setKhazenDialogOpen(open);
          if (!open) { setKhazenStatus("idle"); setKhazenProgress(0); }
        }
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-purple-600" />
              تعبئة تلقائية من خازن
            </DialogTitle>
            <DialogDescription className="text-xs">
              خازن يبحث في مستندات Google Drive ويستخرج بيانات المشروع تلقائياً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Progress */}
            {(khazenStatus === "analyzing") && (
              <div className="space-y-2">
                <Progress value={khazenProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{khazenMessage}</p>
              </div>
            )}

            {/* Done report */}
            {khazenStatus === "done" && khazenReport && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-emerald-700">{khazenReport.afterCount}</div>
                    <div className="text-[10px] text-emerald-600">حقل مكتمل</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-700">{khazenReport.newlyFilled.length}</div>
                    <div className="text-[10px] text-blue-600">حقل جديد</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-amber-700">{khazenReport.emptyFields.length}</div>
                    <div className="text-[10px] text-amber-600">حقل فارغ</div>
                  </div>
                </div>

                {khazenReport.newlyFilled.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      حقول تم تعبئتها ({khazenReport.newlyFilled.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {khazenReport.newlyFilled.map(key => (
                        <Badge key={key} variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                          {FIELD_LABELS[key] || key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {khazenReport.emptyFields.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      حقول لم يتم تعبئتها ({khazenReport.emptyFields.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {khazenReport.emptyFields.map(key => (
                        <Badge key={key} variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                          {FIELD_LABELS[key] || key}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2">
                      💡 السبب المحتمل: البيانات غير متوفرة في مستندات Drive أو تحتاج إدخال يدوي
                    </p>
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <p className="text-[10px] text-purple-700">تم إرسال تقرير النتائج لسلوى لإبلاغك بالتفاصيل</p>
                </div>
              </div>
            )}

            {khazenStatus === "done" && !khazenReport && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{khazenMessage}</p>
              </div>
            )}

            {khazenStatus === "error" && (
              <div className="space-y-2">
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs text-rose-700">{khazenMessage}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <p className="text-[10px] text-purple-700">تم إبلاغ سلوى بالمشكلة للمتابعة</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-start">
            {khazenStatus === "done" && (
              <Button
                onClick={() => { setKhazenDialogOpen(false); setKhazenStatus("idle"); setKhazenProgress(0); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 ml-1" />
                تم
              </Button>
            )}
            {khazenStatus === "error" && (
              <Button onClick={handleKhazenAutoFill} variant="outline" size="sm" className="border-purple-300 text-purple-700">
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
