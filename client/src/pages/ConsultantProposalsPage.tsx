import { useState, useMemo, Fragment, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Shield,
  AlertTriangle,
  Users,
  Calendar,
  CreditCard,
  FileCheck,
  Layers,
  Scale,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Trash2,
  GitCompare,
  Star,
  Info,
  ClipboardList,
  Building2,
  Briefcase,
  RefreshCw,
  DollarSign,
  Filter,
  Zap,
  TrendingDown,
  ShieldAlert,
  CircleAlert,
  CheckCircle2,
  Pencil,
  Save,
  X,
} from "lucide-react";

import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  pending: { color: "text-stone-500", bg: "bg-stone-100", label: "قيد الانتظار", icon: Clock },
  processing: { color: "text-blue-600", bg: "bg-blue-100", label: "جاري التحليل", icon: Loader2 },
  completed: { color: "text-emerald-600", bg: "bg-emerald-100", label: "مكتمل", icon: CheckCircle },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "فشل", icon: XCircle },
};

// Warning level config
const warningLevelConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  high: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: ShieldAlert },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: CircleAlert },
  low: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Info },
};

// Analysis section config for display
const analysisSections = [
  { key: "aiScope", title: "نطاق الأعمال", icon: Layers, color: "from-blue-500 to-blue-600" },
  { key: "aiExclusions", title: "الاستثناءات", icon: AlertTriangle, color: "from-amber-500 to-orange-500" },
  { key: "aiAdditionalWorks", title: "الأعمال الإضافية", icon: ClipboardList, color: "from-purple-500 to-purple-600" },
  { key: "aiSupervisionTerms", title: "أتعاب الإشراف", icon: Eye, color: "from-teal-500 to-teal-600" },
  { key: "aiTimeline", title: "الجدول الزمني", icon: Calendar, color: "from-indigo-500 to-indigo-600" },
  { key: "aiPaymentTerms", title: "شروط الدفع", icon: CreditCard, color: "from-green-500 to-green-600" },
  { key: "aiConditions", title: "الشروط العامة والخاصة", icon: Shield, color: "from-rose-500 to-rose-600" },
  { key: "aiTeamComposition", title: "تكوين الفريق", icon: Users, color: "from-cyan-500 to-cyan-600" },
  { key: "aiDeliverables", title: "المخرجات والتسليمات", icon: FileCheck, color: "from-emerald-500 to-emerald-600" },
];

// Helper to render nested data
function RenderValue({ value, depth = 0 }: { value: any; depth?: number }) {
  if (value === null || value === undefined || value === "غير مذكور في العرض") {
    return <span className="text-stone-400 italic text-sm">غير مذكور في العرض</span>;
  }
  if (typeof value === "string") {
    return <span className="text-stone-700 text-sm leading-relaxed">{value}</span>;
  }
  if (typeof value === "boolean") {
    return value ? (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">نعم</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700 border-red-200">لا</Badge>
    );
  }
  if (typeof value === "number") {
    return <span className="font-semibold text-stone-800">{value.toLocaleString()}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-stone-400 italic text-sm">لا توجد بيانات</span>;
    if (typeof value[0] === "string") {
      return (
        <ul className="space-y-1.5">
          {value.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-stone-700">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-2 shrink-0" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={idx} className={`${depth === 0 ? "bg-stone-50 rounded-lg p-3 border border-stone-100" : "pr-3 border-r-2 border-stone-200"}`}>
            <RenderObject obj={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return <RenderObject obj={value} depth={depth} />;
  }
  return <span className="text-sm">{String(value)}</span>;
}

const fieldLabels: Record<string, string> = {
  items: "البنود", phases: "المراحل", notes: "ملاحظات", risks: "المخاطر",
  work: "العمل", cost: "التكلفة", condition: "الشرط", included: "مشمول",
  type: "النوع", value: "القيمة", scope: "النطاق", duration: "المدة",
  team: "الفريق", method: "الطريقة", schedule: "الجدول", retainer: "دفعة مقدمة",
  general: "عامة", special: "خاصة", termination: "الإنهاء", liability: "المسؤولية",
  insurance: "التأمين", members: "الأعضاء", totalSize: "حجم الفريق",
  role: "الدور", name: "الاسم", experience: "الخبرة", deliverable: "المخرج",
  format: "الصيغة", copies: "النسخ", milestone: "المرحلة", percentage: "النسبة",
  deliverables: "المخرجات", phase: "المرحلة", totalDuration: "المدة الإجمالية",
  summary: "الملخص", details: "التفاصيل", highlights: "أبرز النقاط",
  findings: "النتائج", aspect: "الجانب", consultant: "الاستشاري",
  status: "الحالة", detail: "التفصيل", terms: "الشروط",
  unusualTerms: "شروط غير معتادة", term: "الشرط", warnings: "تحذيرات",
  overallSummary: "الملخص الشامل", recommendation: "التوصية",
  bestProposalIndex: "العرض الأفضل", count: "العدد",
  totalFees: "إجمالي الأتعاب", totalFeesFormatted: "الأتعاب (منسق)",
  currency: "العملة", feeType: "نوع الأتعاب", vatIncluded: "شامل الضريبة",
  supervisionFees: "أتعاب الإشراف", supervisionType: "نوع الإشراف",
  priceValidity: "صلاحية الأسعار", optionalItems: "بنود اختيارية",
  item: "البند", amount: "المبلغ", level: "المستوى", category: "الفئة",
  title: "العنوان", impact: "الأثر",
};

function RenderObject({ obj, depth = 0 }: { obj: Record<string, any>; depth?: number }) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj).filter(([k, v]) => v !== null && v !== undefined && k !== "bestProposalIndex");
  if (entries.length === 0) return <span className="text-stone-400 italic text-sm">لا توجد بيانات</span>;

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <div key={key}>
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            {fieldLabels[key] || key}
          </span>
          <div className="mt-0.5">
            <RenderValue value={val} depth={depth} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Score ring component
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#059669" : score >= 60 ? "#d97706" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Financial Summary Card Component
// ═══════════════════════════════════════════════════
function FinancialSummaryCard({ financial }: { financial: any }) {
  if (!financial) return null;
  
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-bold text-emerald-700">الملخص المالي</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {financial.totalFeesFormatted && (
          <div className="bg-white rounded-lg p-2 border border-emerald-100">
            <p className="text-[10px] text-stone-500">إجمالي الأتعاب</p>
            <p className="text-sm font-bold text-emerald-800">{financial.totalFeesFormatted}</p>
          </div>
        )}
        {financial.feeType && (
          <div className="bg-white rounded-lg p-2 border border-emerald-100">
            <p className="text-[10px] text-stone-500">نوع الأتعاب</p>
            <p className="text-sm font-semibold text-stone-700">{financial.feeType}</p>
          </div>
        )}
        {financial.supervisionType && (
          <div className="bg-white rounded-lg p-2 border border-emerald-100">
            <p className="text-[10px] text-stone-500">الإشراف</p>
            <p className="text-sm font-semibold text-stone-700">{financial.supervisionType}</p>
          </div>
        )}
        {financial.vatIncluded !== undefined && (
          <div className="bg-white rounded-lg p-2 border border-emerald-100">
            <p className="text-[10px] text-stone-500">شامل الضريبة</p>
            <p className="text-sm font-semibold text-stone-700">{financial.vatIncluded ? "نعم" : "لا"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Warnings Display Component
// ═══════════════════════════════════════════════════
function WarningsDisplay({ warnings, compact = false }: { warnings: any[]; compact?: boolean }) {
  if (!warnings || warnings.length === 0) return null;
  
  // Sort by severity: high > medium > low
  const sorted = [...warnings].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.level] ?? 2) - (order[b.level] ?? 2);
  });
  
  if (compact) {
    const highCount = sorted.filter(w => w.level === "high").length;
    const medCount = sorted.filter(w => w.level === "medium").length;
    const lowCount = sorted.filter(w => w.level === "low").length;
    
    return (
      <div className="flex items-center gap-1.5 mt-2">
        {highCount > 0 && (
          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] gap-1">
            <ShieldAlert className="w-3 h-3" />
            {highCount} خطر
          </Badge>
        )}
        {medCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1">
            <CircleAlert className="w-3 h-3" />
            {medCount} تنبيه
          </Badge>
        )}
        {lowCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] gap-1">
            <Info className="w-3 h-3" />
            {lowCount} ملاحظة
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {sorted.map((warning, idx) => {
        const config = warningLevelConfig[warning.level] || warningLevelConfig.low;
        const WarnIcon = config.icon;
        return (
          <div key={idx} className={`${config.bg} ${config.border} border rounded-xl p-3`}>
            <div className="flex items-start gap-2">
              <WarnIcon className={`w-4 h-4 ${config.color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-bold ${config.color}`}>{warning.title || "تحذير"}</span>
                  <Badge className={`${config.bg} ${config.color} border-0 text-[10px]`}>
                    {warning.level === "high" ? "خطر عالي" : warning.level === "medium" ? "متوسط" : "منخفض"}
                  </Badge>
                </div>
                {warning.detail && <p className="text-xs text-stone-600 leading-relaxed">{warning.detail}</p>}
                {warning.impact && <p className="text-xs text-stone-500 mt-1">الأثر: {warning.impact}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Pre-Processing Stats Display
// ═══════════════════════════════════════════════════
function PreprocessingStats({ stats }: { stats: any }) {
  if (!stats) return null;
  
  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-bold text-violet-700">وكيل التصفية الذكي</span>
        {stats.savingsPercent > 0 && (
          <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
            <TrendingDown className="w-3 h-3 ml-1" />
            وفّر {stats.savingsPercent}% من التوكنز
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-2.5 border border-violet-100 text-center">
          <p className="text-lg font-bold text-stone-800">{stats.totalPages}</p>
          <p className="text-[10px] text-stone-500">إجمالي الصفحات</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100 text-center">
          <p className="text-lg font-bold text-emerald-700">{stats.relevantPages}</p>
          <p className="text-[10px] text-stone-500">صفحات مفيدة</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-stone-100 text-center">
          <p className="text-lg font-bold text-stone-400">{stats.skippedPages}</p>
          <p className="text-[10px] text-stone-500">تم تجاوزها</p>
        </div>
      </div>
    </div>
  );
}

export default function ConsultantProposalsPage() {
  const { isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("proposals");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadConsultantId, setUploadConsultantId] = useState<string>("");
  const [uploadProjectId, setUploadProjectId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [preprocessingResult, setPreprocessingResult] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewProposalId, setReviewProposalId] = useState<number | null>(null);
  const [editingFinancials, setEditingFinancials] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editProposalId, setEditProposalId] = useState<number | null>(null);
  const [editProposalData, setEditProposalData] = useState<{ title: string; consultantId: string; projectId: string }>({ title: "", consultantId: "", projectId: "" });

  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery();
  const consultantsQuery = trpc.consultants.list.useQuery();
  const proposalsQuery = trpc.proposals.list.useQuery(
    selectedProjectId !== "all" ? { projectId: parseInt(selectedProjectId) } : {}
  );

  const uploadMutation = trpc.proposals.upload.useMutation();
  const analyzeMutation = trpc.proposals.analyze.useMutation();
  const reanalyzeMutation = trpc.proposals.reanalyze.useMutation();
  const deleteMutation = trpc.proposals.delete.useMutation();
  const preprocessMutation = trpc.proposals.preprocess.useMutation();
  const compareMutation = trpc.proposals.compare.useMutation();
  const updateFinancialsMutation = trpc.proposals.updateFinancials.useMutation();
  const updateMetaMutation = trpc.proposals.updateMeta.useMutation();

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const proposals = proposalsQuery.data || [];

  const selectedProposal = useMemo(() => {
    if (!selectedProposalId) return null;
    return proposals.find((p) => p.id === selectedProposalId) || null;
  }, [selectedProposalId, proposals]);

  const analyzedProposals = useMemo(() => {
    return proposals.filter((p) => p.analysisStatus === "completed");
  }, [proposals]);

  // Extract text from PDF — page by page with separators
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n\n"; // Triple newline as page separator
    }
    return fullText;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("يرجى اختيار ملف PDF فقط");
        return;
      }
      if (file.size > 16 * 1024 * 1024) {
        toast.error("حجم الملف يجب أن يكون أقل من 16 ميجابايت");
        return;
      }
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(".pdf", ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle) {
      toast.error("يرجى اختيار ملف وإدخال عنوان");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStage("جاري رفع الملف...");

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });
      const base64Data = (reader.result as string).split(",")[1];
      setUploadProgress(15);

      // Upload file
      setUploadStage("جاري رفع الملف إلى السحابة...");
      const uploadResult = await uploadMutation.mutateAsync({
        title: uploadTitle,
        fileName: selectedFile.name,
        fileData: base64Data,
        mimeType: selectedFile.type,
        consultantId: uploadConsultantId ? parseInt(uploadConsultantId) : undefined,
        projectId: uploadProjectId ? parseInt(uploadProjectId) : undefined,
      });
      setUploadProgress(30);

      // Extract text from PDF
      setUploadStage("جاري استخراج النص من PDF...");
      const extractedText = await extractTextFromPDF(selectedFile);
      setUploadProgress(45);

      // Pre-process: classify and filter pages
      setUploadStage("وكيل التصفية الذكي: تصنيف الصفحات...");
      let filteredText = extractedText;
      let ppResult = null;
      
      try {
        ppResult = await preprocessMutation.mutateAsync({
          extractedText,
        });
        filteredText = ppResult.filteredText;
        setPreprocessingResult(ppResult);
        
        if (ppResult.savingsPercent > 0) {
          toast.info(`وكيل التصفية: تم تجاوز ${ppResult.skippedPages} صفحة ترويجية من أصل ${ppResult.totalPages} (وفّر ${ppResult.savingsPercent}% من التوكنز)`);
        }
      } catch (e) {
        console.warn("Pre-processing failed, using full text:", e);
      }
      setUploadProgress(60);

      // Analyze proposal with AI
      setUploadStage("الذكاء الاصطناعي: تحليل العرض...");
      await analyzeMutation.mutateAsync({
        proposalId: uploadResult.proposalId,
        extractedText,
        filteredText,
      });
      setUploadProgress(95);

      setUploadStage("اكتمل التحليل!");
      setUploadProgress(100);

      toast.success("تم تحليل العرض بنجاح");

      // Refresh list
      utils.proposals.list.invalidate();

      // Reset form
      setTimeout(() => {
        setSelectedFile(null);
        setUploadTitle("");
        setUploadConsultantId("");
        setUploadProjectId("");
        setIsUploadOpen(false);
        setUploadProgress(0);
        setUploadStage("");
      }, 500);
    } catch (error: any) {
      toast.error("خطأ: " + (error.message || "فشل رفع أو تحليل الملف"));
    } finally {
      setIsUploading(false);
    }
  };

  // Delete proposal
  const handleDelete = async (proposalId: number) => {
    try {
      await deleteMutation.mutateAsync({ proposalId });
      toast.success("تم حذف العرض بنجاح");
      if (selectedProposalId === proposalId) {
        setSelectedProposalId(null);
      }
      setCompareIds(prev => prev.filter(id => id !== proposalId));
      utils.proposals.list.invalidate();
    } catch (error: any) {
      toast.error("خطأ في الحذف: " + (error.message || "فشل حذف العرض"));
    }
    setDeleteConfirmId(null);
  };

  // Re-analyze proposal
  const handleReanalyze = async (proposalId: number) => {
    try {
      toast.info("جاري إعادة تحليل العرض...");
      await reanalyzeMutation.mutateAsync({ proposalId });
      toast.success("تم إعادة تحليل العرض بنجاح");
      utils.proposals.list.invalidate();
    } catch (error: any) {
      toast.error("خطأ: " + (error.message || "فشلت إعادة التحليل"));
    }
  };

  // Save edited financials
  const handleSaveFinancials = async () => {
    if (!reviewProposalId || !editingFinancials) return;
    try {
      await updateFinancialsMutation.mutateAsync({
        proposalId: reviewProposalId,
        financialSummary: editingFinancials,
      });
      toast.success("تم تحديث الملخص المالي بنجاح");
      utils.proposals.list.invalidate();
      setShowReviewDialog(false);
      setEditingFinancials(null);
      setReviewProposalId(null);
    } catch (error: any) {
      toast.error("خطأ: " + (error.message || "فشل التحديث"));
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleCompare = async () => {
    if (compareIds.length < 2) {
      toast.error("يجب اختيار عرضين على الأقل للمقارنة");
      return;
    }

    setIsComparing(true);
    try {
      const result = await compareMutation.mutateAsync({
        title: `مقارنة ${compareIds.length} عروض`,
        proposalIds: compareIds,
        projectId: selectedProjectId !== "all" ? parseInt(selectedProjectId) : undefined,
      });
      setComparisonResult(result.comparisonResult);
      setActiveTab("comparison");
      toast.success("تمت المقارنة بنجاح");
    } catch (error: any) {
      toast.error("خطأ في المقارنة: " + (error.message || "فشلت المقارنة"));
    } finally {
      setIsComparing(false);
    }
  };

  const getConsultantName = (consultantId: number | null) => {
    if (!consultantId) return "غير محدد";
    const c = consultants.find((c) => c.id === consultantId);
    return c?.name || "غير معروف";
  };

  // Open edit proposal dialog
  const openEditProposal = (proposal: any) => {
    setEditProposalId(proposal.id);
    setEditProposalData({
      title: proposal.title || "",
      consultantId: proposal.consultantId ? String(proposal.consultantId) : "",
      projectId: proposal.projectId ? String(proposal.projectId) : "",
    });
  };

  const handleSaveEditProposal = async () => {
    if (!editProposalId || !editProposalData.title.trim()) return;
    try {
      await updateMetaMutation.mutateAsync({
        proposalId: editProposalId,
        title: editProposalData.title.trim(),
        consultantId: editProposalData.consultantId ? parseInt(editProposalData.consultantId) : null,
        projectId: editProposalData.projectId ? parseInt(editProposalData.projectId) : null,
      });
      toast.success("تم تحديث بيانات العرض بنجاح");
      setEditProposalId(null);
      utils.proposals.list.invalidate();
    } catch (e) {
      toast.error("فشل تحديث البيانات");
    }
  };

  // Open review dialog for a proposal
  const openReview = (proposal: any) => {
    setReviewProposalId(proposal.id);
    setEditingFinancials(proposal.aiFinancialSummary ? { ...proposal.aiFinancialSummary } : {
      totalFees: "", totalFeesFormatted: "", currency: "AED", feeType: "",
      vatIncluded: false, supervisionFees: "", supervisionType: "", priceValidity: "",
    });
    setShowReviewDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shrink-0">
                <Scale className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">تحليل ومقارنة عروض الاستشاريين</h1>
                <p className="text-stone-400 text-sm mt-1">تحليل شامل وحيادي مع تصفية ذكية للصفحات وتحذيرات فورية</p>
              </div>
            </div>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg">
                  <Upload className="w-4 h-4 ml-2" />
                  رفع عرض جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>رفع عرض استشاري</DialogTitle>
                  <DialogDescription>ارفع ملف PDF وسيتم تصفيته ذكياً ثم تحليله بالذكاء الاصطناعي</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>عنوان العرض *</Label>
                    <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="مثال: عرض شركة ABC للمشروع XYZ" />
                  </div>
                  <div className="space-y-2">
                    <Label>المشروع</Label>
                    <Select value={uploadProjectId} onValueChange={setUploadProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المشروع (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الاستشاري</Label>
                    <Select value={uploadConsultantId} onValueChange={setUploadConsultantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الاستشاري (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        {consultants.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ملف PDF *</Label>
                    <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer relative">
                      <input type="file" accept=".pdf" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {selectedFile ? (
                        <div>
                          <FileText className="w-10 h-10 mx-auto mb-2 text-teal-600" />
                          <p className="font-medium text-stone-800">{selectedFile.name}</p>
                          <p className="text-sm text-stone-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                          <p className="text-stone-500">اضغط أو اسحب ملف PDF هنا</p>
                          <p className="text-xs text-stone-400 mt-1">الحد الأقصى: 16 ميجابايت</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-stone-600">
                        <span>{uploadStage}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                      {preprocessingResult && preprocessingResult.savingsPercent > 0 && (
                        <div className="bg-violet-50 rounded-lg p-2 border border-violet-200 text-xs text-violet-700">
                          <Zap className="w-3 h-3 inline ml-1" />
                          تم تصفية {preprocessingResult.skippedPages} صفحة ترويجية — وفّر {preprocessingResult.savingsPercent}% من التوكنز
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>إلغاء</Button>
                  <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !uploadTitle} className="bg-teal-600 hover:bg-teal-700">
                    {isUploading ? (
                      <Fragment>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        {uploadStage}
                      </Fragment>
                    ) : (
                      <Fragment>
                        <Upload className="w-4 h-4 ml-2" />
                        رفع وتحليل
                      </Fragment>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Project Filter */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6 shadow-sm flex items-center gap-4 flex-wrap">
          <Building2 className="w-5 h-5 text-stone-500" />
          <Label className="text-sm font-medium text-stone-600 whitespace-nowrap">تصفية حسب المشروع:</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="جميع المشاريع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المشاريع</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {compareIds.length >= 2 && (
            <Button onClick={handleCompare} disabled={isComparing} className="mr-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white">
              {isComparing ? (
                <Fragment>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري المقارنة...
                </Fragment>
              ) : (
                <Fragment>
                  <GitCompare className="w-4 h-4 ml-2" />
                  قارن {compareIds.length} عروض
                </Fragment>
              )}
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-stone-200 p-1 mb-6 rounded-xl shadow-sm">
            <TabsTrigger value="proposals" className="rounded-lg data-[state=active]:bg-stone-800 data-[state=active]:text-white px-6">
              <FileText className="w-4 h-4 ml-2" />
              العروض ({proposals.length})
            </TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-lg data-[state=active]:bg-stone-800 data-[state=active]:text-white px-6" disabled={!selectedProposal}>
              <BarChart3 className="w-4 h-4 ml-2" />
              تحليل تفصيلي
            </TabsTrigger>
            <TabsTrigger value="comparison" className="rounded-lg data-[state=active]:bg-stone-800 data-[state=active]:text-white px-6" disabled={!comparisonResult}>
              <GitCompare className="w-4 h-4 ml-2" />
              المقارنة
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB 1: Proposals List ==================== */}
          <TabsContent value="proposals">
            {proposalsQuery.isLoading ? (
              <div className="text-center py-16">
                <Loader2 className="w-10 h-10 mx-auto mb-4 text-stone-400 animate-spin" />
                <p className="text-stone-500">جاري التحميل...</p>
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm">
                <Scale className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                <h3 className="text-xl font-bold text-stone-600 mb-2">لا توجد عروض بعد</h3>
                <p className="text-stone-400 mb-6">ابدأ برفع عروض الاستشاريين لتحليلها ومقارنتها</p>
                <Button onClick={() => setIsUploadOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Upload className="w-4 h-4 ml-2" />
                  رفع أول عرض
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-stone-800">{proposals.length}</p>
                        <p className="text-xs text-stone-500">إجمالي العروض</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-stone-800">{analyzedProposals.length}</p>
                        <p className="text-xs text-stone-500">تم تحليلها</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-stone-800">
                          {analyzedProposals.reduce((sum, p) => sum + ((p as any).aiWarnings?.filter((w: any) => w.level === "high")?.length || 0), 0)}
                        </p>
                        <p className="text-xs text-stone-500">تحذيرات عالية</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <GitCompare className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-stone-800">{compareIds.length}</p>
                        <p className="text-xs text-stone-500">محددة للمقارنة</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proposals Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {proposals.map((proposal) => {
                    const status = statusConfig[proposal.analysisStatus] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    const isSelected = selectedProposalId === proposal.id;
                    const isInCompare = compareIds.includes(proposal.id);
                    const financial = (proposal as any).aiFinancialSummary;
                    const warnings = (proposal as any).aiWarnings || [];

                    return (
                      <div
                        key={proposal.id}
                        className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${
                          isSelected ? "border-teal-500 shadow-teal-100" : isInCompare ? "border-purple-400 shadow-purple-50" : "border-stone-200"
                        }`}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                              setSelectedProposalId(proposal.id);
                              if (proposal.analysisStatus === "completed") setActiveTab("analysis");
                            }}>
                              <div className={`w-2 h-2 rounded-full ${proposal.analysisStatus === "completed" ? "bg-emerald-500" : proposal.analysisStatus === "processing" ? "bg-blue-500 animate-pulse" : proposal.analysisStatus === "failed" ? "bg-red-500" : "bg-stone-400"}`} />
                              <Badge className={`${status.bg} ${status.color} border-0 text-xs`}>
                                <StatusIcon className={`w-3 h-3 ml-1 ${proposal.analysisStatus === "processing" ? "animate-spin" : ""}`} />
                                {status.label}
                              </Badge>
                              {proposal.aiScore && proposal.aiScore > 0 && (
                                <ScoreRing score={proposal.aiScore} size={40} />
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {proposal.analysisStatus === "completed" && (
                                <Checkbox
                                  checked={isInCompare}
                                  onCheckedChange={() => toggleCompare(proposal.id)}
                                  className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                />
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(proposal.fileUrl, "_blank")} title="عرض الملف">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-700 hover:bg-orange-50" onClick={() => openEditProposal(proposal)} title="تعديل بيانات العرض">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {proposal.analysisStatus === "completed" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openReview(proposal)} title="مراجعة وتأكيد الأرقام">
                                  <Save className="w-4 h-4" />
                                </Button>
                              )}
                              {(proposal.analysisStatus === "completed" || proposal.analysisStatus === "failed") && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => handleReanalyze(proposal.id)} disabled={reanalyzeMutation.isPending} title="إعادة التحليل">
                                  <RefreshCw className={`w-4 h-4 ${reanalyzeMutation.isPending ? "animate-spin" : ""}`} />
                                </Button>
                              )}
                              <AlertDialog open={deleteConfirmId === proposal.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirmId(proposal.id)} title="حذف">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>حذف العرض</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف عرض "{proposal.title}"؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="flex-row-reverse gap-2">
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(proposal.id)}>
                                      حذف نهائي
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          <h3 className="font-bold text-stone-800 text-lg mb-1 cursor-pointer" onClick={() => {
                            setSelectedProposalId(proposal.id);
                            if (proposal.analysisStatus === "completed") setActiveTab("analysis");
                          }}>{proposal.title}</h3>

                          <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
                            {proposal.consultantId && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {getConsultantName(proposal.consultantId)}
                              </span>
                            )}
                            {proposal.projectId && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {projects.find((p) => p.id === proposal.projectId)?.name || "—"}
                              </span>
                            )}
                            <span>{new Date(proposal.createdAt).toLocaleDateString("ar-SA")}</span>
                          </div>

                          {proposal.aiSummary && (
                            <p className="text-sm text-stone-600 leading-relaxed line-clamp-2 mb-2">{proposal.aiSummary}</p>
                          )}

                          {/* Financial Summary Card on proposal card */}
                          {financial && <FinancialSummaryCard financial={financial} />}

                          {/* Compact Warnings */}
                          {warnings.length > 0 && <WarningsDisplay warnings={warnings} compact={true} />}

                          {proposal.analysisStatus === "completed" && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {proposal.aiScope && <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">نطاق الأعمال</Badge>}
                              {proposal.aiExclusions && <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">استثناءات</Badge>}
                              {proposal.aiSupervisionTerms && <Badge variant="outline" className="text-xs border-teal-200 text-teal-700 bg-teal-50">إشراف</Badge>}
                              {proposal.aiPaymentTerms && <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">شروط دفع</Badge>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== TAB 2: Detailed Analysis ==================== */}
          <TabsContent value="analysis">
            {selectedProposal && selectedProposal.analysisStatus === "completed" ? (
              <div className="space-y-6">
                {/* Proposal Header */}
                <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-stone-800 mb-1">{selectedProposal.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-stone-500">
                        {selectedProposal.consultantId && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {getConsultantName(selectedProposal.consultantId)}
                          </span>
                        )}
                        {selectedProposal.projectId && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {projects.find((p) => p.id === selectedProposal.projectId)?.name}
                          </span>
                        )}
                        <span>{new Date(selectedProposal.createdAt).toLocaleDateString("ar-SA")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedProposal.aiScore && <ScoreRing score={selectedProposal.aiScore} size={72} />}
                      <div className="flex flex-col gap-1">
                        <Button variant="outline" size="sm" onClick={() => window.open(selectedProposal.fileUrl, "_blank")}>
                          <FileText className="w-4 h-4 ml-1" />
                          الملف الأصلي
                        </Button>
                        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openReview(selectedProposal)}>
                          <Pencil className="w-4 h-4 ml-1" />
                          مراجعة الأرقام
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary - Prominent */}
                  {(selectedProposal as any).aiFinancialSummary && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                          <h3 className="font-bold text-emerald-800">الملخص المالي</h3>
                        </div>
                        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs" onClick={() => openReview(selectedProposal)}>
                          <Pencil className="w-3 h-3 ml-1" />
                          تعديل
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(() => {
                          const fin = (selectedProposal as any).aiFinancialSummary;
                          return (
                            <>
                              {fin.totalFeesFormatted && (
                                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                  <p className="text-xs text-stone-500 mb-1">إجمالي الأتعاب</p>
                                  <p className="text-lg font-bold text-emerald-800">{fin.totalFeesFormatted}</p>
                                </div>
                              )}
                              {fin.feeType && (
                                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                  <p className="text-xs text-stone-500 mb-1">نوع الأتعاب</p>
                                  <p className="text-sm font-semibold text-stone-700">{fin.feeType}</p>
                                </div>
                              )}
                              {fin.supervisionType && (
                                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                  <p className="text-xs text-stone-500 mb-1">الإشراف</p>
                                  <p className="text-sm font-semibold text-stone-700">{fin.supervisionType}</p>
                                  {fin.supervisionFees && <p className="text-xs text-stone-500">{fin.supervisionFees}</p>}
                                </div>
                              )}
                              {fin.priceValidity && (
                                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                  <p className="text-xs text-stone-500 mb-1">صلاحية الأسعار</p>
                                  <p className="text-sm font-semibold text-stone-700">{fin.priceValidity}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Smart Warnings */}
                  {(selectedProposal as any).aiWarnings && (selectedProposal as any).aiWarnings.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-bold text-stone-700 mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        تحذيرات ذكية ({(selectedProposal as any).aiWarnings.length})
                      </h3>
                      <WarningsDisplay warnings={(selectedProposal as any).aiWarnings} />
                    </div>
                  )}

                  {/* Summary */}
                  {selectedProposal.aiSummary && (
                    <div className="bg-gradient-to-r from-stone-50 to-stone-100 rounded-xl p-4 mb-4">
                      <h3 className="font-semibold text-stone-700 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        الملخص
                      </h3>
                      <p className="text-stone-600 text-sm leading-relaxed">{selectedProposal.aiSummary}</p>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedProposal.aiStrengths && selectedProposal.aiStrengths.length > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <h3 className="font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          نقاط القوة
                        </h3>
                        <ul className="space-y-1.5">
                          {selectedProposal.aiStrengths.map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedProposal.aiWeaknesses && selectedProposal.aiWeaknesses.length > 0 && (
                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          نقاط الضعف
                        </h3>
                        <ul className="space-y-1.5">
                          {selectedProposal.aiWeaknesses.map((w: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Recommendation */}
                  {selectedProposal.aiRecommendation && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mt-4">
                      <h3 className="font-semibold text-blue-700 mb-2">التوصية</h3>
                      <p className="text-sm text-blue-800 leading-relaxed">{selectedProposal.aiRecommendation}</p>
                    </div>
                  )}
                </div>

                {/* Detailed Analysis Sections */}
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-600" />
                    التحليل التفصيلي
                  </h2>
                  {analysisSections.map((section) => {
                    const data = (selectedProposal as any)[section.key];
                    const isExpanded = expandedSections[section.key] !== false;
                    const SectionIcon = section.icon;

                    return (
                      <div key={section.key} className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                        <button
                          className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
                          onClick={() => toggleSection(section.key)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center`}>
                              <SectionIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-stone-800">{section.title}</span>
                            {!data && <Badge variant="outline" className="text-xs text-stone-400 border-stone-200">غير متوفر</Badge>}
                          </div>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
                        </button>
                        {isExpanded && data && (
                          <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                            <RenderValue value={data} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : selectedProposal ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
                {selectedProposal.analysisStatus === "processing" ? (
                  <Fragment>
                    <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
                    <h3 className="text-xl font-bold text-stone-600 mb-2">جاري تحليل العرض...</h3>
                    <p className="text-stone-400">يرجى الانتظار، قد يستغرق التحليل بضع دقائق</p>
                  </Fragment>
                ) : selectedProposal.analysisStatus === "failed" ? (
                  <Fragment>
                    <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                    <h3 className="text-xl font-bold text-stone-600 mb-2">فشل التحليل</h3>
                    <p className="text-stone-400 mb-4">{selectedProposal.analysisError || "حدث خطأ أثناء تحليل العرض"}</p>
                    <Button onClick={() => handleReanalyze(selectedProposal.id)} className="bg-amber-600 hover:bg-amber-700">
                      <RefreshCw className="w-4 h-4 ml-2" />
                      إعادة التحليل
                    </Button>
                  </Fragment>
                ) : (
                  <Fragment>
                    <Clock className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                    <h3 className="text-xl font-bold text-stone-600 mb-2">العرض قيد الانتظار</h3>
                    <p className="text-stone-400">لم يتم تحليل هذا العرض بعد</p>
                  </Fragment>
                )}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                <h3 className="text-xl font-bold text-stone-600 mb-2">اختر عرضاً لعرض التحليل</h3>
                <p className="text-stone-400">اضغط على أي عرض من القائمة لعرض تحليله التفصيلي</p>
              </div>
            )}
          </TabsContent>

          {/* ==================== TAB 3: Comparison ==================== */}
          <TabsContent value="comparison">
            {comparisonResult ? (
              <div className="space-y-6">
                {/* Comparison Header */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <GitCompare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-stone-800">المقارنة الحيادية بين العروض</h2>
                      <p className="text-sm text-stone-500">
                        مقارنة {compareIds.length} عروض بند ببند
                      </p>
                    </div>
                  </div>

                  {/* Quick Comparison Matrix */}
                  {comparisonResult.financialComparison?.matrix && comparisonResult.financialComparison.matrix.length > 0 && (
                    <div className="bg-white rounded-xl p-4 border border-purple-100 mt-4 overflow-x-auto">
                      <h3 className="font-bold text-purple-700 mb-3 flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        مصفوفة المقارنة المالية
                      </h3>
                      <table className="w-full text-sm" dir="rtl">
                        <thead>
                          <tr className="border-b border-stone-200">
                            <th className="text-right py-2 px-3 font-bold text-stone-700">البند</th>
                            {comparisonResult.financialComparison.matrix[0]?.values?.map((v: any, i: number) => (
                              <th key={i} className="text-center py-2 px-3 font-bold text-stone-700">{v.consultant || `استشاري ${i+1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonResult.financialComparison.matrix.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b border-stone-100">
                              <td className="py-2 px-3 font-medium text-stone-700">{row.aspect}</td>
                              {row.values?.map((v: any, i: number) => (
                                <td key={i} className="text-center py-2 px-3">
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                                    v.status === "أفضل" ? "text-emerald-700" : v.status === "أسوأ" ? "text-red-700" : "text-stone-600"
                                  }`}>
                                    {v.status === "أفضل" && <CheckCircle2 className="w-3 h-3" />}
                                    {v.status === "أسوأ" && <XCircle className="w-3 h-3" />}
                                    {v.value}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Overall Summary */}
                  {comparisonResult.overallSummary && (
                    <div className="bg-white rounded-xl p-4 border border-purple-100 mt-4">
                      <h3 className="font-semibold text-purple-700 mb-2">الملخص الشامل</h3>
                      <p className="text-sm text-stone-700 leading-relaxed">{comparisonResult.overallSummary}</p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {comparisonResult.recommendation && (
                    <div className="bg-white rounded-xl p-4 border border-indigo-100 mt-3">
                      <h3 className="font-semibold text-indigo-700 mb-2">التوصية</h3>
                      <p className="text-sm text-stone-700 leading-relaxed">{comparisonResult.recommendation}</p>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {comparisonResult.warnings && comparisonResult.warnings.length > 0 && (
                  <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 shadow-sm">
                    <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      تحذيرات مهمة
                    </h3>
                    <ul className="space-y-2">
                      {comparisonResult.warnings.map((w: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
                          <span className="leading-relaxed">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Comparison Sections */}
                {comparisonResult.scopeComparison && (
                  <ComparisonSection title="مقارنة نطاق الأعمال" icon={Layers} color="from-blue-500 to-blue-600" data={comparisonResult.scopeComparison} />
                )}
                {comparisonResult.exclusionsComparison && (
                  <ComparisonSection title="مقارنة الاستثناءات" icon={AlertTriangle} color="from-amber-500 to-orange-500" data={comparisonResult.exclusionsComparison} />
                )}
                {comparisonResult.supervisionComparison && (
                  <ComparisonSection title="مقارنة أتعاب الإشراف" icon={Eye} color="from-teal-500 to-teal-600" data={comparisonResult.supervisionComparison} />
                )}
                {comparisonResult.additionalWorksComparison && (
                  <ComparisonSection title="مقارنة الأعمال الإضافية" icon={ClipboardList} color="from-purple-500 to-purple-600" data={comparisonResult.additionalWorksComparison} />
                )}
                {comparisonResult.conditionsComparison && (
                  <ComparisonSection title="مقارنة الشروط" icon={Shield} color="from-rose-500 to-rose-600" data={comparisonResult.conditionsComparison} />
                )}
                {comparisonResult.timelineComparison && (
                  <ComparisonSection title="مقارنة الجدول الزمني" icon={Calendar} color="from-indigo-500 to-indigo-600" data={comparisonResult.timelineComparison} />
                )}
                {comparisonResult.paymentComparison && (
                  <ComparisonSection title="مقارنة شروط الدفع" icon={CreditCard} color="from-green-500 to-green-600" data={comparisonResult.paymentComparison} />
                )}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
                <GitCompare className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                <h3 className="text-xl font-bold text-stone-600 mb-2">لا توجد مقارنة بعد</h3>
                <p className="text-stone-400 mb-6">اختر عرضين أو أكثر من القائمة ثم اضغط "قارن"</p>
                <Button variant="outline" onClick={() => setActiveTab("proposals")}>
                  العودة للعروض
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== Review & Confirm Dialog ==================== */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              مراجعة وتأكيد الأرقام المالية
            </DialogTitle>
            <DialogDescription>
              راجع الأرقام المستخرجة من الذكاء الاصطناعي وعدّل ما يلزم قبل الاعتماد
            </DialogDescription>
          </DialogHeader>
          {editingFinancials && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">إجمالي الأتعاب (رقم)</Label>
                  <Input
                    value={editingFinancials.totalFees || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, totalFees: e.target.value })}
                    placeholder="مثال: 7856068"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">إجمالي الأتعاب (منسق)</Label>
                  <Input
                    value={editingFinancials.totalFeesFormatted || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, totalFeesFormatted: e.target.value })}
                    placeholder="مثال: 7,856,068 AED"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">العملة</Label>
                  <Select value={editingFinancials.currency || "AED"} onValueChange={(v) => setEditingFinancials({ ...editingFinancials, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">نوع الأتعاب</Label>
                  <Input
                    value={editingFinancials.feeType || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, feeType: e.target.value })}
                    placeholder="مبلغ مقطوع / نسبة / man-month"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">أتعاب الإشراف</Label>
                  <Input
                    value={editingFinancials.supervisionFees || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, supervisionFees: e.target.value })}
                    placeholder="المبلغ أو النسبة"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">نوع الإشراف</Label>
                  <Input
                    value={editingFinancials.supervisionType || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, supervisionType: e.target.value })}
                    placeholder="مشمول / منفصل / man-month"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">صلاحية الأسعار</Label>
                  <Input
                    value={editingFinancials.priceValidity || ""}
                    onChange={(e) => setEditingFinancials({ ...editingFinancials, priceValidity: e.target.value })}
                    placeholder="مثال: 90 يوم"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    checked={editingFinancials.vatIncluded || false}
                    onCheckedChange={(checked) => setEditingFinancials({ ...editingFinancials, vatIncluded: !!checked })}
                  />
                  <Label className="text-xs">شامل ضريبة القيمة المضافة</Label>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-xs text-amber-700">
                <AlertTriangle className="w-3 h-3 inline ml-1" />
                تأكد من مطابقة الأرقام مع العرض الأصلي قبل الحفظ. هذه الأرقام ستُستخدم في المقارنات والتقييم المالي.
              </div>
            </div>
          )}
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => { setShowReviewDialog(false); setEditingFinancials(null); }}>
              إلغاء
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveFinancials} disabled={updateFinancialsMutation.isPending}>
              {updateFinancialsMutation.isPending ? (
                <Fragment><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الحفظ...</Fragment>
              ) : (
                <Fragment><Save className="w-4 h-4 ml-2" />حفظ واعتماد</Fragment>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Metadata Dialog */}
      <Dialog open={editProposalId !== null} onOpenChange={(open) => { if (!open) setEditProposalId(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-orange-500" />
              تعديل بيانات العرض
            </DialogTitle>
            <DialogDescription>تعديل اسم العرض والاستشاري والمشروع المرتبط به</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-sm font-medium">اسم العرض *</Label>
              <Input
                value={editProposalData.title}
                onChange={(e) => setEditProposalData({ ...editProposalData, title: e.target.value })}
                placeholder="أدخل اسم العرض"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">الاستشاري</Label>
              <Select
                value={editProposalData.consultantId || "none"}
                onValueChange={(v) => setEditProposalData({ ...editProposalData, consultantId: v === "none" ? "" : v })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر الاستشاري" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون استشاري</SelectItem>
                  {consultants.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">المشروع</Label>
              <Select
                value={editProposalData.projectId || "none"}
                onValueChange={(v) => setEditProposalData({ ...editProposalData, projectId: v === "none" ? "" : v })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر المشروع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون مشروع</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setEditProposalId(null)}>إلغاء</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleSaveEditProposal}
              disabled={updateMetaMutation.isPending || !editProposalData.title.trim()}
            >
              {updateMetaMutation.isPending ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الحفظ...</>
              ) : (
                <><Save className="w-4 h-4 ml-2" />حفظ التعديلات</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Comparison Section Component
function ComparisonSection({ title, icon: Icon, color, data }: { title: string; icon: any; color: string; data: any }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-stone-800 text-lg">{title}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
      </button>
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4">
          <RenderValue value={data} />
        </div>
      )}
    </div>
  );
}
