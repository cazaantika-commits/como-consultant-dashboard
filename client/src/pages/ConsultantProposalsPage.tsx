import { useState, useMemo, Fragment } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
    // Check if array of objects or strings
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
    // Array of objects
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
  items: "البنود",
  phases: "المراحل",
  notes: "ملاحظات",
  risks: "المخاطر",
  work: "العمل",
  cost: "التكلفة",
  condition: "الشرط",
  included: "مشمول",
  type: "النوع",
  value: "القيمة",
  scope: "النطاق",
  duration: "المدة",
  team: "الفريق",
  method: "الطريقة",
  schedule: "الجدول",
  retainer: "دفعة مقدمة",
  general: "عامة",
  special: "خاصة",
  termination: "الإنهاء",
  liability: "المسؤولية",
  insurance: "التأمين",
  members: "الأعضاء",
  totalSize: "حجم الفريق",
  role: "الدور",
  name: "الاسم",
  experience: "الخبرة",
  deliverable: "المخرج",
  format: "الصيغة",
  copies: "النسخ",
  milestone: "المرحلة",
  percentage: "النسبة",
  deliverables: "المخرجات",
  phase: "المرحلة",
  totalDuration: "المدة الإجمالية",
  summary: "الملخص",
  details: "التفاصيل",
  highlights: "أبرز النقاط",
  findings: "النتائج",
  aspect: "الجانب",
  consultant: "الاستشاري",
  status: "الحالة",
  detail: "التفصيل",
  terms: "الشروط",
  unusualTerms: "شروط غير معتادة",
  term: "الشرط",
  warnings: "تحذيرات",
  overallSummary: "الملخص الشامل",
  recommendation: "التوصية",
  bestProposalIndex: "العرض الأفضل",
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
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
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
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery();
  const consultantsQuery = trpc.consultants.list.useQuery();
  const proposalsQuery = trpc.proposals.list.useQuery(
    selectedProjectId !== "all" ? { projectId: parseInt(selectedProjectId) } : {}
  );

  const uploadMutation = trpc.proposals.upload.useMutation();
  const analyzeMutation = trpc.proposals.analyze.useMutation();
  const compareMutation = trpc.proposals.compare.useMutation();

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

  // Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
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
    setUploadProgress(10);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });
      const base64Data = (reader.result as string).split(",")[1];
      setUploadProgress(30);

      // Upload file
      const uploadResult = await uploadMutation.mutateAsync({
        title: uploadTitle,
        fileName: selectedFile.name,
        fileData: base64Data,
        mimeType: selectedFile.type,
        consultantId: uploadConsultantId ? parseInt(uploadConsultantId) : undefined,
        projectId: uploadProjectId ? parseInt(uploadProjectId) : undefined,
      });
      setUploadProgress(50);

      toast.success("تم رفع الملف بنجاح، جاري التحليل...");

      // Extract text from PDF
      const extractedText = await extractTextFromPDF(selectedFile);
      setUploadProgress(70);

      // Analyze proposal
      await analyzeMutation.mutateAsync({
        proposalId: uploadResult.proposalId,
        extractedText,
      });
      setUploadProgress(100);

      toast.success("تم تحليل العرض بنجاح");

      // Refresh list
      utils.proposals.list.invalidate();

      // Reset form
      setSelectedFile(null);
      setUploadTitle("");
      setUploadConsultantId("");
      setUploadProjectId("");
      setIsUploadOpen(false);
      setUploadProgress(0);
    } catch (error: any) {
      toast.error("خطأ: " + (error.message || "فشل رفع أو تحليل الملف"));
    } finally {
      setIsUploading(false);
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
                <p className="text-stone-400 text-sm mt-1">تحليل شامل وحيادي لعروض الاستشاريين بند ببند باستخدام الذكاء الاصطناعي</p>
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
                  <DialogDescription>ارفع ملف PDF للعرض وسيتم تحليله تلقائياً بالذكاء الاصطناعي</DialogDescription>
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
                        <span>جاري الرفع والتحليل...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>إلغاء</Button>
                  <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !uploadTitle} className="bg-teal-600 hover:bg-teal-700">
                    {isUploading ? (
                      <Fragment>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري التحليل...
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
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6 shadow-sm flex items-center gap-4">
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
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-stone-800">{proposals.filter((p) => p.analysisStatus === "pending" || p.analysisStatus === "processing").length}</p>
                        <p className="text-xs text-stone-500">قيد التحليل</p>
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

                    return (
                      <div
                        key={proposal.id}
                        className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer ${
                          isSelected ? "border-teal-500 shadow-teal-100" : isInCompare ? "border-purple-400 shadow-purple-50" : "border-stone-200"
                        }`}
                        onClick={() => {
                          setSelectedProposalId(proposal.id);
                          if (proposal.analysisStatus === "completed") {
                            setActiveTab("analysis");
                          }
                        }}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${proposal.analysisStatus === "completed" ? "bg-emerald-500" : proposal.analysisStatus === "processing" ? "bg-blue-500 animate-pulse" : proposal.analysisStatus === "failed" ? "bg-red-500" : "bg-stone-400"}`} />
                              <Badge className={`${status.bg} ${status.color} border-0 text-xs`}>
                                <StatusIcon className={`w-3 h-3 ml-1 ${proposal.analysisStatus === "processing" ? "animate-spin" : ""}`} />
                                {status.label}
                              </Badge>
                              {proposal.aiScore && proposal.aiScore > 0 && (
                                <ScoreRing score={proposal.aiScore} size={40} />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {proposal.analysisStatus === "completed" && (
                                <Checkbox
                                  checked={isInCompare}
                                  onCheckedChange={() => toggleCompare(proposal.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                />
                              )}
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(proposal.fileUrl, "_blank"); }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <h3 className="font-bold text-stone-800 text-lg mb-1">{proposal.title}</h3>

                          <div className="flex items-center gap-3 text-xs text-stone-500 mb-3">
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
                            <p className="text-sm text-stone-600 leading-relaxed line-clamp-2 mb-3">{proposal.aiSummary}</p>
                          )}

                          {proposal.analysisStatus === "completed" && (
                            <div className="flex flex-wrap gap-1.5">
                              {proposal.aiScope && <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">نطاق الأعمال</Badge>}
                              {proposal.aiExclusions && <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">استثناءات</Badge>}
                              {proposal.aiSupervisionTerms && <Badge variant="outline" className="text-xs border-teal-200 text-teal-700 bg-teal-50">إشراف</Badge>}
                              {proposal.aiTimeline && <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">جدول زمني</Badge>}
                              {proposal.aiPaymentTerms && <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">شروط دفع</Badge>}
                              {proposal.aiConditions && <Badge variant="outline" className="text-xs border-rose-200 text-rose-700 bg-rose-50">شروط</Badge>}
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
                      <Button variant="outline" size="sm" onClick={() => window.open(selectedProposal.fileUrl, "_blank")}>
                        <FileText className="w-4 h-4 ml-1" />
                        الملف الأصلي
                      </Button>
                    </div>
                  </div>

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
                    const isExpanded = expandedSections[section.key] !== false; // default expanded
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
                    <p className="text-stone-400">{selectedProposal.analysisError || "حدث خطأ أثناء تحليل العرض"}</p>
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
                  <ComparisonSection
                    title="مقارنة نطاق الأعمال"
                    icon={Layers}
                    color="from-blue-500 to-blue-600"
                    data={comparisonResult.scopeComparison}
                  />
                )}
                {comparisonResult.exclusionsComparison && (
                  <ComparisonSection
                    title="مقارنة الاستثناءات"
                    icon={AlertTriangle}
                    color="from-amber-500 to-orange-500"
                    data={comparisonResult.exclusionsComparison}
                  />
                )}
                {comparisonResult.supervisionComparison && (
                  <ComparisonSection
                    title="مقارنة أتعاب الإشراف"
                    icon={Eye}
                    color="from-teal-500 to-teal-600"
                    data={comparisonResult.supervisionComparison}
                  />
                )}
                {comparisonResult.additionalWorksComparison && (
                  <ComparisonSection
                    title="مقارنة الأعمال الإضافية"
                    icon={ClipboardList}
                    color="from-purple-500 to-purple-600"
                    data={comparisonResult.additionalWorksComparison}
                  />
                )}
                {comparisonResult.conditionsComparison && (
                  <ComparisonSection
                    title="مقارنة الشروط"
                    icon={Shield}
                    color="from-rose-500 to-rose-600"
                    data={comparisonResult.conditionsComparison}
                  />
                )}
                {comparisonResult.timelineComparison && (
                  <ComparisonSection
                    title="مقارنة الجدول الزمني"
                    icon={Calendar}
                    color="from-indigo-500 to-indigo-600"
                    data={comparisonResult.timelineComparison}
                  />
                )}
                {comparisonResult.paymentComparison && (
                  <ComparisonSection
                    title="مقارنة شروط الدفع"
                    icon={CreditCard}
                    color="from-green-500 to-green-600"
                    data={comparisonResult.paymentComparison}
                  />
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
