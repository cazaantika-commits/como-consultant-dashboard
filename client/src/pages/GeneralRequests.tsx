import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ClipboardList, Plus, Search, Eye, CheckCircle, XCircle, Clock,
  AlertCircle, Upload, FileText, Send, ChevronRight, RotateCcw,
  ExternalLink, Settings, Archive, ArchiveRestore, ArrowRight, Paperclip,
  Users, Calendar, Video, HelpCircle, Gavel, FileCheck, Download
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type RequestType = "proposal_approval" | "contract_approval" | "meeting_request" | "zoom_meeting" | "inquiry" | "decision_request" | "other";
type RequestStatus = "new" | "pending_wael" | "pending_sheikh" | "approved" | "rejected" | "needs_revision";

type GeneralRequest = {
  id: number;
  requestNumber: string;
  requestType: RequestType;
  subject: string;
  description: string;
  projectName?: string | null;
  relatedParty?: string | null;
  proposedDate?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: RequestStatus;
  waelDecision?: string | null;
  waelNotes?: string | null;
  sheikhDecision?: string | null;
  sheikhNotes?: string | null;
  financeEmailSentAt?: string | null;
  createdAt: string;
  isArchived?: number | boolean;
};

// ── Config ─────────────────────────────────────────────────────────────────────
const REQUEST_TYPE_CONFIG: Record<RequestType, { label: string; icon: any; color: string }> = {
  proposal_approval: { label: "اعتماد عرض", icon: FileCheck, color: "bg-blue-50 text-blue-700 border-blue-200" },
  contract_approval: { label: "اعتماد عقد", icon: FileText, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  meeting_request:   { label: "طلب اجتماع", icon: Users, color: "bg-orange-50 text-orange-700 border-orange-200" },
  zoom_meeting:      { label: "اجتماع زووم", icon: Video, color: "bg-sky-50 text-sky-700 border-sky-200" },
  inquiry:           { label: "استفسار", icon: HelpCircle, color: "bg-amber-50 text-amber-700 border-amber-200" },
  decision_request:  { label: "طلب قرار", icon: Gavel, color: "bg-purple-50 text-purple-700 border-purple-200" },
  other:             { label: "أخرى", icon: ClipboardList, color: "bg-gray-50 text-gray-700 border-gray-200" },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: any }> = {
  new:             { label: "جديد", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock },
  pending_wael:    { label: "بانتظار وائل", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  pending_sheikh:  { label: "بانتظار الشيخ عيسى", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Clock },
  approved:        { label: "معتمد", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  rejected:        { label: "مرفوض", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  needs_revision:  { label: "يحتاج مراجعة", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: RotateCcw },
};

const STATUS_BORDER: Record<RequestStatus, string> = {
  new: "#d1d5db",
  pending_wael: "#60a5fa",
  pending_sheikh: "#a78bfa",
  approved: "#34d399",
  rejected: "#f87171",
  needs_revision: "#fbbf24",
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GeneralRequests() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<GeneralRequest | null>(null);
  const [reviewMode, setReviewMode] = useState<"wael" | "sheikh" | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ subject: "", description: "", projectName: "", relatedParty: "", proposedDate: "" });
  const [attachFile, setAttachFile] = useState<{ url: string; name: string } | null>(null);
  const [editAttachFile, setEditAttachFile] = useState<{ url: string; name: string } | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const editAttachInputRef = useRef<HTMLInputElement>(null);
  const viewAttachInputRef = useRef<HTMLInputElement>(null);

  const [createForm, setCreateForm] = useState({
    requestType: "" as RequestType | "",
    subject: "",
    description: "",
    projectName: "",
    relatedParty: "",
    proposedDate: "",
  });

  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.generalRequests.list.useQuery({ showArchived });
  const { data: counts = { all: 0, pending_wael: 0, pending_sheikh: 0, approved: 0, rejected: 0, needs_revision: 0 } } = trpc.generalRequests.counts.useQuery();

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = trpc.generalRequests.create.useMutation({
    onSuccess: (data) => {
      utils.generalRequests.list.invalidate();
      utils.generalRequests.counts.invalidate();
      setShowCreate(false);
      setCreateForm({ requestType: "", subject: "", description: "", projectName: "", relatedParty: "", proposedDate: "" });
      setAttachFile(null);
      toast.success(`تم إنشاء الطلب ${data.requestNumber}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadMutation = trpc.generalRequests.uploadAttachment.useMutation({
    onSuccess: (data) => { setAttachFile({ url: data.url, name: data.fileName }); toast.success("تم رفع المرفق"); },
    onError: () => toast.error("فشل رفع الملف"),
  });

  const uploadEditMutation = trpc.generalRequests.uploadAttachment.useMutation({
    onSuccess: (data) => { setEditAttachFile({ url: data.url, name: data.fileName }); toast.success("تم رفع المرفق"); },
    onError: () => toast.error("فشل رفع الملف"),
  });

  const uploadViewMutation = trpc.generalRequests.uploadAttachment.useMutation({
    onSuccess: (data) => {
      utils.generalRequests.list.invalidate();
      toast.success("تم رفع المرفق وحفظه");
    },
    onError: () => toast.error("فشل رفع الملف"),
  });

  const waelReviewMutation = trpc.generalRequests.waelReview.useMutation({
    onSuccess: () => {
      utils.generalRequests.list.invalidate();
      utils.generalRequests.counts.invalidate();
      setViewingRequest(null);
      setReviewMode(null);
      setReviewDecision("");
      setReviewNotes("");
      toast.success("تم تسجيل قرار وائل");
    },
    onError: (e) => toast.error(e.message),
  });

  const sheikhReviewMutation = trpc.generalRequests.sheikhReview.useMutation({
    onSuccess: (_, vars) => {
      utils.generalRequests.list.invalidate();
      utils.generalRequests.counts.invalidate();
      setViewingRequest(null);
      setReviewMode(null);
      setReviewDecision("");
      setReviewNotes("");
      const msg = vars.decision === "approved" ? "تم اعتماد الطلب وإشعار المالية"
        : vars.decision === "needs_revision" ? "تم إعادة الطلب للمراجعة"
        : "تم رفض الطلب";
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.generalRequests.update.useMutation({
    onSuccess: () => {
      utils.generalRequests.list.invalidate();
      utils.generalRequests.counts.invalidate();
      setViewingRequest(null);
      setEditMode(false);
      setEditAttachFile(null);
      toast.success("تم تحديث الطلب وإعادة إرساله لوائل");
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.generalRequests.archive.useMutation({
    onSuccess: () => {
      utils.generalRequests.list.invalidate();
      utils.generalRequests.counts.invalidate();
      setViewingRequest(null);
      toast.success("تم أرشفة الطلب");
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAttachUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: "create" | "edit" | "view") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const requestId = mode === "view" && viewingRequest ? viewingRequest.id : undefined;
      if (mode === "create") uploadMutation.mutate({ fileName: file.name, fileData: base64, mimeType: file.type });
      else if (mode === "edit") uploadEditMutation.mutate({ fileName: file.name, fileData: base64, mimeType: file.type });
      else uploadViewMutation.mutate({ requestId, fileName: file.name, fileData: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!createForm.requestType) { toast.error("اختر نوع الطلب"); return; }
    if (!createForm.subject.trim()) { toast.error("موضوع الطلب مطلوب"); return; }
    if (!createForm.description.trim()) { toast.error("تفاصيل الطلب مطلوبة"); return; }
    createMutation.mutate({
      requestType: createForm.requestType as RequestType,
      subject: createForm.subject,
      description: createForm.description,
      projectName: createForm.projectName || undefined,
      relatedParty: createForm.relatedParty || undefined,
      proposedDate: createForm.proposedDate || undefined,
      attachmentUrl: attachFile?.url,
      attachmentName: attachFile?.name,
    });
  };

  const handleWaelReview = () => {
    if (!viewingRequest || !reviewDecision) return;
    waelReviewMutation.mutate({ id: viewingRequest.id, decision: reviewDecision as any, notes: reviewNotes || undefined });
  };

  const handleSheikhReview = () => {
    if (!viewingRequest || !reviewDecision) return;
    sheikhReviewMutation.mutate({ id: viewingRequest.id, decision: reviewDecision as any, notes: reviewNotes || undefined });
  };

  const handleUpdate = () => {
    if (!viewingRequest) return;
    updateMutation.mutate({
      id: viewingRequest.id,
      subject: editForm.subject || undefined,
      description: editForm.description || undefined,
      projectName: editForm.projectName || undefined,
      relatedParty: editForm.relatedParty || undefined,
      proposedDate: editForm.proposedDate || undefined,
      attachmentUrl: editAttachFile?.url || undefined,
      attachmentName: editAttachFile?.name || undefined,
    });
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = (requests as GeneralRequest[]).filter((r) => {
    const isArchived = r.isArchived === 1 || r.isArchived === true;
    if (!showArchived && isArchived) return false;
    if (showArchived && !isArchived) return false;
    const matchSearch = !search ||
      r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      (r.projectName || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.relatedParty || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchType = typeFilter === "all" || r.requestType === typeFilter;
    const rDate = r.createdAt ? new Date(r.createdAt) : null;
    const matchDateFrom = !dateFrom || (rDate && rDate >= new Date(dateFrom));
    const matchDateTo = !dateTo || (rDate && rDate <= new Date(dateTo + "T23:59:59"));
    return matchSearch && matchStatus && matchType && matchDateFrom && matchDateTo;
  });

  // ── Summary stats ────────────────────────────────────────────────────────────
  const summaryStats = {
    total: (requests as GeneralRequest[]).filter(r => !r.isArchived).length,
    approved: (requests as GeneralRequest[]).filter(r => r.status === "approved" && !r.isArchived).length,
    pending: (requests as GeneralRequest[]).filter(r => ["pending_wael", "pending_sheikh", "new"].includes(r.status) && !r.isArchived).length,
    rejected: (requests as GeneralRequest[]).filter(r => r.status === "rejected" && !r.isArchived).length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-gray-500 hover:text-gray-800 -mr-1">
              <ArrowRight className="w-4 h-4" />
              الرئيسية
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">الطلبات والاستفسارات</h1>
              <p className="text-sm text-gray-500">إدارة الطلبات غير المالية مع سير الموافقة الكامل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={`gap-2 text-sm ${showArchived ? "bg-amber-50 border-amber-300 text-amber-700" : ""}`}
            >
              {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {showArchived ? "عرض النشطة" : "الأرشيف"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/approval-settings")} className="gap-2 text-sm">
              <Settings className="w-4 h-4" />
              إعدادات الموافقة
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "إجمالي الطلبات", value: summaryStats.total, color: "from-slate-600 to-gray-700", bg: "bg-slate-50", border: "border-slate-200", icon: ClipboardList },
          { label: "الطلبات المعتمدة", value: summaryStats.approved, color: "from-green-600 to-emerald-700", bg: "bg-green-50", border: "border-green-200", icon: CheckCircle },
          { label: "الطلبات المعلقة", value: summaryStats.pending, color: "from-blue-600 to-indigo-700", bg: "bg-blue-50", border: "border-blue-200", icon: Clock },
          { label: "الطلبات المرفوضة", value: summaryStats.rejected, color: "from-red-600 to-rose-700", bg: "bg-red-50", border: "border-red-200", icon: XCircle },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} border ${stat.border} rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-gray-400" />
            </div>
            <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
              {stat.value}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">طلب</div>
          </div>
        ))}
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { key: "all", label: "الكل", color: "from-gray-500 to-gray-600" },
          { key: "pending_wael", label: "بانتظار وائل", color: "from-blue-500 to-indigo-600" },
          { key: "pending_sheikh", label: "بانتظار الشيخ", color: "from-purple-500 to-violet-600" },
          { key: "approved", label: "معتمد", color: "from-green-500 to-emerald-600" },
          { key: "needs_revision", label: "مراجعة", color: "from-yellow-500 to-amber-600" },
          { key: "rejected", label: "مرفوض", color: "from-red-500 to-rose-600" },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`p-3 rounded-xl border-2 transition-all text-right ${statusFilter === s.key ? "border-violet-500 bg-white shadow-md" : "border-transparent bg-white/60 hover:bg-white"}`}>
            <div className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
              {(counts as any)[s.key] ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search + Filter + Add */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="بحث برقم الطلب أو الموضوع أو المشروع..." value={search}
            onChange={e => setSearch(e.target.value)} className="pr-10 bg-white" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="نوع الطلب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            {Object.entries(REQUEST_TYPE_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            const rows = filtered.map((r: any) => ({
              "رقم الطلب": r.requestNumber,
              "التاريخ": r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-AE") : "",
              "نوع الطلب": r.requestType,
              "الموضوع": r.subject || "",
              "المشروع": r.projectName || "",
              "الجهة ذات الصلة": r.relatedParty || "",
              "الوصف": r.description || "",
              "التاريخ المقترح": r.proposedDate || "",
              "الحالة": r.status,
              "قرار وائل": r.waelDecision || "",
              "قرار الشيخ عيسى": r.sheikhDecision || "",
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "الطلبات والاستفسارات");
            XLSX.writeFile(wb, `طلبات-واستفسارات-${new Date().toISOString().slice(0,10)}.xlsx`);
          }}
          className="bg-white border-violet-200 text-violet-700 hover:bg-violet-50"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير Excel
        </Button>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white shadow-md">
          <Plus className="w-4 h-4 ml-2" />
          طلب جديد
        </Button>
      </div>
      {/* Date Range Filter */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">من:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">إلى:</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100">
            مسح الفلتر
          </button>
        )}
        {(dateFrom || dateTo) && (
          <span className="text-xs text-violet-600 font-medium">
            النتائج: {filtered.length} طلب
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-28" />
                <div className="h-4 bg-gray-100 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">لا توجد طلبات</p>
          <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 ml-2" /> إنشاء أول طلب
          </Button>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {/* Table Header */}
          <div
            className="grid bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500"
            style={{ gridTemplateColumns: "120px 1px 140px 1px 1fr 1px 160px 1px 420px 1px 140px 100px" }}
          >
            <div>رقم الطلب</div>
            <div />
            <div>النوع</div>
            <div />
            <div>الموضوع / المشروع</div>
            <div />
            <div>الجهة المعنية</div>
            <div />
            <div>سير الموافقة</div>
            <div />
            <div>الحالة</div>
            <div className="text-left">إجراء</div>
          </div>

          {/* Rows */}
          {filtered.map((r) => {
            const StatusIcon = STATUS_CONFIG[r.status]?.icon || Clock;
            const TypeIcon = REQUEST_TYPE_CONFIG[r.requestType]?.icon || ClipboardList;
            const borderColor = STATUS_BORDER[r.status] || "#d1d5db";
            return (
              <div
                key={r.id}
                className="grid items-center bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                style={{
                  gridTemplateColumns: "120px 1px 140px 1px 1fr 1px 160px 1px 420px 1px 140px 100px",
                  borderRight: `4px solid ${borderColor}`,
                }}
              >
                {/* Col 1: Request number */}
                <div className="px-4 py-3">
                  <div className="font-mono font-bold text-gray-900 text-sm leading-tight">{r.requestNumber}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString("ar-AE", { year: "numeric", month: "short", day: "numeric" })}</div>
                </div>
                <div className="h-full w-px bg-gray-100" />

                {/* Col 2: Type */}
                <div className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${REQUEST_TYPE_CONFIG[r.requestType]?.color || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                    <TypeIcon className="w-3 h-3" />
                    {REQUEST_TYPE_CONFIG[r.requestType]?.label || r.requestType}
                  </span>
                </div>
                <div className="h-full w-px bg-gray-100" />

                {/* Col 3: Subject + Project */}
                <div className="px-3 py-3">
                  <div className="text-sm font-medium text-gray-800 leading-snug truncate">{r.subject}</div>
                  {r.projectName && <div className="text-xs text-gray-400 mt-0.5 truncate">{r.projectName}</div>}
                  {r.attachmentUrl && <Paperclip className="w-3 h-3 text-gray-400 mt-0.5 inline" />}
                </div>
                <div className="h-full w-px bg-gray-100" />

                {/* Col 4: Related party */}
                <div className="px-3 py-3">
                  <div className="text-sm text-gray-600 leading-snug">{r.relatedParty || "—"}</div>
                  {r.proposedDate && <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{r.proposedDate}</div>}
                </div>
                <div className="h-full w-px bg-gray-100" />

                {/* Col 5: Workflow steps */}
                <div className="px-3 py-3 flex items-center gap-1">
                  {[
                    { label: "تقديم الطلب", done: true, active: false },
                    { label: "مراجعة وائل", done: ["pending_sheikh", "approved", "rejected"].includes(r.status), active: r.status === "pending_wael" },
                    { label: "الشيخ عيسى", done: r.status === "approved", active: r.status === "pending_sheikh" },
                    { label: "إشعار المالية", done: r.status === "approved", active: false },
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center gap-0.5">
                      {idx > 0 && <ChevronRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />}
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${
                        step.done ? "bg-emerald-50 text-emerald-600 font-medium" :
                        step.active ? "bg-blue-100 text-blue-700 font-bold ring-1 ring-blue-300" :
                        "text-gray-300"
                      }`}>
                        {step.done
                          ? <CheckCircle className="w-2.5 h-2.5" />
                          : step.active
                          ? <Clock className="w-2.5 h-2.5" />
                          : <div className="w-2 h-2 rounded-full border border-current opacity-30" />}
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-full w-px bg-gray-100" />

                {/* Col 6: Status */}
                <div className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_CONFIG[r.status]?.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {STATUS_CONFIG[r.status]?.label}
                  </span>
                </div>

                {/* Col 7: Actions */}
                <div className="px-3 py-3 flex items-center gap-1.5 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setViewingRequest(r); setReviewMode(null); setEditMode(false); }}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  {r.status === "pending_wael" && (
                    <Button size="sm" onClick={() => { setViewingRequest(r); setReviewMode("wael"); setReviewDecision(""); setReviewNotes(""); }}
                      className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                      مراجعة
                    </Button>
                  )}
                  {r.status === "pending_sheikh" && (
                    <Button size="sm" onClick={() => { setViewingRequest(r); setReviewMode("sheikh"); setReviewDecision(""); setReviewNotes(""); }}
                      className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white">
                      قرار
                    </Button>
                  )}
                  {r.status === "needs_revision" && (
                    <Button size="sm" onClick={() => {
                      setViewingRequest(r);
                      setEditMode(true);
                      setEditForm({ subject: r.subject, description: r.description, projectName: r.projectName || "", relatedParty: r.relatedParty || "", proposedDate: r.proposedDate || "" });
                    }}
                      className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                      تعديل
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-violet-600" />
              طلب / استفسار جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-violet-50 rounded-lg border border-violet-100 text-sm text-violet-700 flex items-start gap-2">
              <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>بعد الإنشاء، سيمر الطلب على: وائل ← الشيخ عيسى ← إشعار فريق المالية تلقائياً</span>
            </div>

            {/* Request Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">نوع الطلب *</label>
              <Select value={createForm.requestType} onValueChange={v => setCreateForm(p => ({ ...p, requestType: v as RequestType }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الطلب" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <v.icon className="w-4 h-4" />
                        {v.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">موضوع الطلب *</label>
              <Input placeholder="مثال: اعتماد عرض مكتب المعمار للمرحلة الثانية" value={createForm.subject}
                onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))} />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">التفاصيل *</label>
              <Textarea placeholder="وصف تفصيلي للطلب أو الاستفسار..." rows={3} value={createForm.description}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Project + Related Party */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">المشروع</label>
                <Input placeholder="اسم المشروع (اختياري)" value={createForm.projectName}
                  onChange={e => setCreateForm(p => ({ ...p, projectName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">الجهة المعنية</label>
                <Input placeholder="مثال: مكتب المعمار، المقاول..." value={createForm.relatedParty}
                  onChange={e => setCreateForm(p => ({ ...p, relatedParty: e.target.value }))} />
              </div>
            </div>

            {/* Proposed Date (for meetings) */}
            {(createForm.requestType === "meeting_request" || createForm.requestType === "zoom_meeting") && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">التاريخ والوقت المقترح</label>
                <Input placeholder="مثال: الأحد 10 أبريل 2026 الساعة 10:00 صباحاً" value={createForm.proposedDate}
                  onChange={e => setCreateForm(p => ({ ...p, proposedDate: e.target.value }))} />
              </div>
            )}

            {/* Attachment */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">مرفق (اختياري)</label>
              <input type="file" ref={attachInputRef} className="hidden" onChange={e => handleAttachUpload(e, "create")} />
              {attachFile ? (
                <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-200 text-sm">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <span className="flex-1 text-violet-700 truncate">{attachFile.name}</span>
                  <a href={attachFile.url} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline text-xs flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> فتح
                  </a>
                  <button onClick={() => setAttachFile(null)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => attachInputRef.current?.click()} disabled={uploadMutation.isPending} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {uploadMutation.isPending ? "جاري الرفع..." : "رفع مرفق"}
                </Button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white">
                {createMutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View / Review / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={!!viewingRequest} onOpenChange={(o) => { if (!o) { setViewingRequest(null); setReviewMode(null); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          {viewingRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {editMode ? <RotateCcw className="w-5 h-5 text-amber-600" /> : reviewMode ? <CheckCircle className="w-5 h-5 text-violet-600" /> : <Eye className="w-5 h-5 text-violet-600" />}
                  {editMode ? "تعديل الطلب" : reviewMode === "wael" ? "مراجعة وائل" : reviewMode === "sheikh" ? "قرار الشيخ عيسى" : "تفاصيل الطلب"}
                  <span className="text-sm font-normal text-gray-400 mr-2">{viewingRequest.requestNumber}</span>
                </DialogTitle>
              </DialogHeader>

              {/* View mode */}
              {!editMode && !reviewMode && (
                <div className="space-y-4 mt-2">
                  {/* Type badge */}
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${REQUEST_TYPE_CONFIG[viewingRequest.requestType]?.color}`}>
                      {(() => { const Icon = REQUEST_TYPE_CONFIG[viewingRequest.requestType]?.icon || ClipboardList; return <Icon className="w-4 h-4" />; })()}
                      {REQUEST_TYPE_CONFIG[viewingRequest.requestType]?.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_CONFIG[viewingRequest.status]?.color}`}>
                      {STATUS_CONFIG[viewingRequest.status]?.label}
                    </span>
                  </div>

                  {/* Details card */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">الموضوع</div>
                      <div className="font-semibold text-gray-900">{viewingRequest.subject}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">التفاصيل</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{viewingRequest.description}</div>
                    </div>
                    {viewingRequest.projectName && (
                      <div className="flex gap-6">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">المشروع</div>
                          <div className="text-sm font-medium">{viewingRequest.projectName}</div>
                        </div>
                      </div>
                    )}
                    {viewingRequest.relatedParty && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">الجهة المعنية</div>
                        <div className="text-sm font-medium">{viewingRequest.relatedParty}</div>
                      </div>
                    )}
                    {viewingRequest.proposedDate && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">التاريخ المقترح</div>
                        <div className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{viewingRequest.proposedDate}</div>
                      </div>
                    )}
                  </div>

                  {/* Attachment */}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">المرفق</div>
                    {viewingRequest.attachmentUrl ? (
                      <a href={viewingRequest.attachmentUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700 hover:bg-violet-100 transition-colors">
                        <FileText className="w-4 h-4" />
                        {viewingRequest.attachmentName || "فتح المرفق"}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">لا يوجد مرفق</span>
                        <input type="file" ref={viewAttachInputRef} className="hidden" onChange={e => handleAttachUpload(e, "view")} />
                        <Button variant="outline" size="sm" onClick={() => viewAttachInputRef.current?.click()} disabled={uploadViewMutation.isPending} className="gap-1.5 text-xs">
                          <Upload className="w-3 h-3" />
                          {uploadViewMutation.isPending ? "جاري الرفع..." : "رفع مرفق"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Wael notes */}
                  {viewingRequest.waelNotes && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-xs font-medium text-blue-600 mb-1">ملاحظات وائل</div>
                      <div className="text-sm text-blue-800">{viewingRequest.waelNotes}</div>
                    </div>
                  )}

                  {/* Sheikh notes */}
                  {viewingRequest.sheikhNotes && (
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="text-xs font-medium text-purple-600 mb-1">ملاحظات الشيخ عيسى</div>
                      <div className="text-sm text-purple-800">{viewingRequest.sheikhNotes}</div>
                    </div>
                  )}

                  {/* Finance notification */}
                  {viewingRequest.financeEmailSentAt && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">تم إشعار فريق المالية تلقائياً عند الاعتماد</span>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {viewingRequest.status === "pending_wael" && (
                      <Button onClick={() => { setReviewMode("wael"); setReviewDecision(""); setReviewNotes(""); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                        <CheckCircle className="w-4 h-4" /> مراجعة وائل
                      </Button>
                    )}
                    {viewingRequest.status === "pending_sheikh" && (
                      <Button onClick={() => { setReviewMode("sheikh"); setReviewDecision(""); setReviewNotes(""); }}
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                        <Gavel className="w-4 h-4" /> قرار الشيخ عيسى
                      </Button>
                    )}
                    {viewingRequest.status === "needs_revision" && (
                      <Button onClick={() => {
                        setEditMode(true);
                        setEditForm({ subject: viewingRequest.subject, description: viewingRequest.description, projectName: viewingRequest.projectName || "", relatedParty: viewingRequest.relatedParty || "", proposedDate: viewingRequest.proposedDate || "" });
                      }} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                        <RotateCcw className="w-4 h-4" /> تعديل وإعادة الإرسال
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => archiveMutation.mutate({ id: viewingRequest.id, archive: true })}
                      className="gap-1.5 text-gray-500 mr-auto">
                      <Archive className="w-3.5 h-3.5" /> أرشفة
                    </Button>
                  </div>
                </div>
              )}

              {/* Review mode */}
              {reviewMode && !editMode && (
                <div className="space-y-4 mt-2">
                  <div className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${reviewMode === "wael" ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-purple-50 border-purple-100 text-purple-700"}`}>
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{reviewMode === "wael" ? "أنت تراجع هذا الطلب بصفتك وائل. قرارك سيُرسل للشيخ عيسى إذا وافقت." : "أنت تعتمد هذا الطلب بصفتك الشيخ عيسى. الاعتماد سيُشعر فريق المالية تلقائياً."}</span>
                  </div>

                  {/* Request summary */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="font-semibold text-gray-800">{viewingRequest.subject}</div>
                    <div className="text-gray-500 mt-1 text-xs">{viewingRequest.description}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">القرار *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: "approved", label: "موافقة", color: "border-green-300 bg-green-50 text-green-700" },
                        { v: "needs_revision", label: "يحتاج تعديل", color: "border-yellow-300 bg-yellow-50 text-yellow-700" },
                        { v: "rejected", label: "رفض", color: "border-red-300 bg-red-50 text-red-700" },
                      ].map(opt => (
                        <button key={opt.v} onClick={() => setReviewDecision(opt.v)}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === opt.v ? opt.color + " ring-2 ring-offset-1" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">ملاحظات (اختياري)</label>
                    <Textarea placeholder="أي ملاحظات أو توجيهات..." rows={3} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={reviewMode === "wael" ? handleWaelReview : handleSheikhReview}
                      disabled={(reviewMode === "wael" ? waelReviewMutation : sheikhReviewMutation).isPending || !reviewDecision}
                      className={`flex-1 text-white ${reviewMode === "wael" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                      {(reviewMode === "wael" ? waelReviewMutation : sheikhReviewMutation).isPending ? "جاري الحفظ..." : "تأكيد القرار"}
                    </Button>
                    <Button variant="outline" onClick={() => setReviewMode(null)}>رجوع</Button>
                  </div>
                </div>
              )}

              {/* Edit mode */}
              {editMode && (
                <div className="space-y-4 mt-2">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>بعد التعديل سيُعاد إرسال الطلب لوائل من البداية.</span>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">الموضوع</label>
                    <Input value={editForm.subject} onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">التفاصيل</label>
                    <Textarea rows={3} value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">المشروع</label>
                      <Input value={editForm.projectName} onChange={e => setEditForm(p => ({ ...p, projectName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">الجهة المعنية</label>
                      <Input value={editForm.relatedParty} onChange={e => setEditForm(p => ({ ...p, relatedParty: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">التاريخ المقترح</label>
                    <Input value={editForm.proposedDate} onChange={e => setEditForm(p => ({ ...p, proposedDate: e.target.value }))} />
                  </div>

                  {/* Attachment */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">مرفق جديد (اختياري)</label>
                    <input type="file" ref={editAttachInputRef} className="hidden" onChange={e => handleAttachUpload(e, "edit")} />
                    {editAttachFile ? (
                      <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-200 text-sm">
                        <FileText className="w-4 h-4 text-violet-600" />
                        <span className="flex-1 truncate text-violet-700">{editAttachFile.name}</span>
                        <button onClick={() => setEditAttachFile(null)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => editAttachInputRef.current?.click()} disabled={uploadEditMutation.isPending} className="gap-2">
                        <Upload className="w-4 h-4" />
                        {uploadEditMutation.isPending ? "جاري الرفع..." : "رفع مرفق"}
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleUpdate} disabled={updateMutation.isPending}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                      {updateMutation.isPending ? "جاري الإرسال..." : "حفظ وإعادة الإرسال"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>رجوع</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
