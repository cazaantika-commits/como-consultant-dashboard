import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CreditCard, Plus, Search, Eye, CheckCircle, XCircle, Clock,
  AlertCircle, Upload, FileText, Building2, DollarSign, Send,
  ChevronRight, RotateCcw, Mail, ExternalLink, Banknote
} from "lucide-react";

type PaymentRequest = {
  id: number;
  requestNumber: string;
  partnerId: number;
  partnerName?: string | null;
  projectName?: string | null;
  description: string;
  amount: string;
  currency: string;
  status: "new" | "pending_wael" | "pending_sheikh" | "approved" | "rejected" | "needs_revision";
  waelDecision?: string | null;
  sheikhDecision?: string | null;
  financeEmailSentAt?: string | null;
  createdAt: string;
  approvedQuoteUrl?: string | null;
  approvedQuoteName?: string | null;
};

const STATUS_CONFIG = {
  new: { label: "جديد", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock },
  pending_wael: { label: "بانتظار وائل", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  pending_sheikh: { label: "بانتظار الشيخ عيسى", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Clock },
  approved: { label: "معتمد", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  needs_revision: { label: "يحتاج مراجعة", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: RotateCcw },
};

function WorkflowStep({ label, status, active, done }: { label: string; status: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${done ? "bg-green-100 text-green-700" : active ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-100 text-gray-400"}`}>
      {done ? <CheckCircle className="w-3 h-3" /> : active ? <Clock className="w-3 h-3 animate-pulse" /> : <div className="w-3 h-3 rounded-full border-2 border-current opacity-40" />}
      {label}
    </div>
  );
}

export default function PaymentRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<PaymentRequest | null>(null);
  const [reviewMode, setReviewMode] = useState<"wael" | "sheikh" | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [quoteFile, setQuoteFile] = useState<{ url: string; name: string } | null>(null);
  const quoteInputRef = useRef<HTMLInputElement>(null);

  const [createForm, setCreateForm] = useState({
    partnerId: "",
    projectName: "",
    description: "",
    amount: "",
    currency: "AED",
  });

  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.paymentRequests.list.useQuery();
  const { data: partners = [] } = trpc.businessPartners.list.useQuery();

  const createMutation = trpc.paymentRequests.create.useMutation({
    onSuccess: (data) => {
      utils.paymentRequests.list.invalidate();
      setShowCreate(false);
      setCreateForm({ partnerId: "", projectName: "", description: "", amount: "", currency: "AED" });
      setQuoteFile(null);
      toast.success(`تم إنشاء طلب الصرف ${data.requestNumber}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadQuoteMutation = trpc.paymentRequests.uploadQuote.useMutation({
    onSuccess: (data) => { setQuoteFile({ url: data.url, name: data.fileName }); toast.success("تم رفع العرض المعتمد"); },
    onError: () => toast.error("فشل رفع الملف"),
  });

  const waelReviewMutation = trpc.paymentRequests.waelReview.useMutation({
    onSuccess: () => {
      utils.paymentRequests.list.invalidate();
      setViewingRequest(null);
      setReviewMode(null);
      setReviewDecision("");
      setReviewNotes("");
      toast.success("تم تسجيل قرار وائل");
    },
    onError: (e) => toast.error(e.message),
  });

  const sheikhReviewMutation = trpc.paymentRequests.sheikhReview.useMutation({
    onSuccess: () => {
      utils.paymentRequests.list.invalidate();
      setViewingRequest(null);
      setReviewMode(null);
      setReviewDecision("");
      setReviewNotes("");
      toast.success("تم تسجيل قرار الشيخ عيسى وإرسال أمر الصرف للمالية");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleQuoteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadQuoteMutation.mutate({ fileName: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!createForm.partnerId) { toast.error("اختر الشريك / المتعامل"); return; }
    if (!createForm.description.trim()) { toast.error("وصف الطلب مطلوب"); return; }
    if (!createForm.amount || isNaN(Number(createForm.amount))) { toast.error("المبلغ غير صحيح"); return; }
    createMutation.mutate({
      partnerId: Number(createForm.partnerId),
      projectName: createForm.projectName || undefined,
      description: createForm.description,
      amount: createForm.amount,
      currency: createForm.currency,
      approvedQuoteUrl: quoteFile?.url,
      approvedQuoteName: quoteFile?.name,
    });
  };

  const handleWaelReview = () => {
    if (!viewingRequest || !reviewDecision) return;
    waelReviewMutation.mutate({
      id: viewingRequest.id,
      decision: reviewDecision as any,
      notes: reviewNotes || undefined,
    });
  };

  const handleSheikhReview = () => {
    if (!viewingRequest || !reviewDecision) return;
    sheikhReviewMutation.mutate({
      id: viewingRequest.id,
      decision: reviewDecision as any,
      notes: reviewNotes || undefined,
    });
  };

  const filtered = requests.filter(r => {
    const matchSearch = !search ||
      r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.partnerName || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.projectName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: requests.length,
    pending_wael: requests.filter(r => r.status === "pending_wael").length,
    pending_sheikh: requests.filter(r => r.status === "pending_sheikh").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
    needs_revision: requests.filter(r => r.status === "needs_revision").length,
  };

  const getWorkflowSteps = (status: string) => {
    const steps = [
      { label: "تقديم الطلب", done: true, active: false },
      { label: "مراجعة وائل", done: ["pending_sheikh", "approved", "rejected"].includes(status), active: status === "pending_wael" },
      { label: "اعتماد الشيخ عيسى", done: status === "approved", active: status === "pending_sheikh" },
      { label: "إشعار المالية", done: status === "approved", active: false },
    ];
    return steps;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">طلبات الصرف</h1>
            <p className="text-sm text-gray-500">إدارة أوامر الدفع مع سير الموافقة الكامل</p>
          </div>
        </div>
      </div>

      {/* Stats */}
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
            className={`p-3 rounded-xl border-2 transition-all text-right ${statusFilter === s.key ? "border-emerald-500 bg-white shadow-md" : "border-transparent bg-white/60 hover:bg-white"}`}>
            <div className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
              {counts[s.key as keyof typeof counts] ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="بحث برقم الطلب أو الشريك أو المشروع..." value={search}
            onChange={e => setSearch(e.target.value)} className="pr-10 bg-white" />
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md">
          <Plus className="w-4 h-4 ml-2" />
          طلب صرف جديد
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">لا توجد طلبات صرف</p>
          <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 ml-2" /> إنشاء أول طلب
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">رقم الطلب</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الشريك</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">المشروع</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">المبلغ</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">سير الموافقة</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الحالة</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const StatusIcon = STATUS_CONFIG[r.status].icon;
                  return (
                    <tr key={r.id} className={`border-b border-gray-50 hover:bg-emerald-50/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="p-4">
                        <div className="font-mono font-semibold text-gray-900 text-sm">{r.requestNumber}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString("ar-AE")}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-700">{r.partnerName || "—"}</span>
                        </div>
                      </td>
                      <td className="p-4"><span className="text-sm text-gray-600">{r.projectName || "—"}</span></td>
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}</div>
                        <div className="text-xs text-gray-500">{r.currency}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {getWorkflowSteps(r.status).map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                              <WorkflowStep {...step} status={r.status} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[r.status].color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_CONFIG[r.status].label}
                        </span>
                        {r.financeEmailSentAt && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <Mail className="w-3 h-3" />أُرسل للمالية
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setViewingRequest(r); setReviewMode(null); }}
                            className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {r.status === "pending_wael" && (
                            <Button variant="ghost" size="sm" onClick={() => { setViewingRequest(r); setReviewMode("wael"); setReviewDecision(""); setReviewNotes(""); }}
                              className="h-8 px-2 text-xs hover:bg-blue-100 hover:text-blue-600">
                              مراجعة وائل
                            </Button>
                          )}
                          {r.status === "pending_sheikh" && (
                            <Button variant="ghost" size="sm" onClick={() => { setViewingRequest(r); setReviewMode("sheikh"); setReviewDecision(""); setReviewNotes(""); }}
                              className="h-8 px-2 text-xs hover:bg-purple-100 hover:text-purple-600">
                              قرار الشيخ
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              طلب صرف جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-700 flex items-start gap-2">
              <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>بعد الإنشاء، سيمر الطلب على: وائل ← الشيخ عيسى ← إشعار فريق المالية تلقائياً</span>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">الشريك / المتعامل *</label>
              <Select value={createForm.partnerId} onValueChange={v => setCreateForm(p => ({ ...p, partnerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشركة أو المتعامل" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        {p.companyName}
                        {p.bankName && <span className="text-xs text-gray-400">({p.bankName})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.partnerId && (() => {
                const p = partners.find(x => String(x.id) === createForm.partnerId);
                if (!p) return null;
                const hasBank = p.beneficiaryName && p.iban;
                return (
                  <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${hasBank ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {hasBank ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {hasBank ? `المستفيد: ${p.beneficiaryName} | IBAN: ${p.iban}` : "تحذير: البيانات البنكية غير مكتملة لهذا الشريك"}
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">المشروع</label>
              <Input value={createForm.projectName} onChange={e => setCreateForm(p => ({ ...p, projectName: e.target.value }))}
                placeholder="اسم المشروع (اختياري)" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">وصف الطلب *</label>
              <Textarea value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                placeholder="وصف تفصيلي للمدفوعات المطلوبة..." rows={3} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 block">المبلغ *</label>
                <Input value={createForm.amount} onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" type="number" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">العملة</label>
                <Select value={createForm.currency} onValueChange={v => setCreateForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                العرض المعتمد (PDF أو صورة)
              </label>
              {quoteFile ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 flex-1 truncate">{quoteFile.name}</span>
                  <a href={quoteFile.url} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => setQuoteFile(null)} className="h-6 w-6 p-0 text-gray-400">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => quoteInputRef.current?.click()}
                  disabled={uploadQuoteMutation.isPending} className="w-full border-dashed">
                  <Upload className="w-4 h-4 ml-2" />
                  {uploadQuoteMutation.isPending ? "جاري الرفع..." : "رفع العرض المعتمد"}
                </Button>
              )}
              <input ref={quoteInputRef} type="file" className="hidden" onChange={handleQuoteUpload}
                accept=".pdf,.jpg,.jpeg,.png" />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء طلب الصرف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View / Review Dialog */}
      {viewingRequest && (
        <Dialog open={!!viewingRequest} onOpenChange={() => { setViewingRequest(null); setReviewMode(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                {viewingRequest.requestNumber}
                <span className={`mr-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[viewingRequest.status].color}`}>
                  {STATUS_CONFIG[viewingRequest.status].label}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Workflow */}
              <div className="flex items-center gap-1 flex-wrap p-3 bg-gray-50 rounded-xl">
                {getWorkflowSteps(viewingRequest.status).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    <WorkflowStep {...step} status={viewingRequest.status} />
                  </div>
                ))}
              </div>

              {/* Details */}
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">الشريك:</span> <span className="font-semibold">{viewingRequest.partnerName || "—"}</span></div>
                  <div><span className="text-gray-500">المشروع:</span> <span>{viewingRequest.projectName || "—"}</span></div>
                  <div className="col-span-2">
                    <span className="text-gray-500">الوصف:</span>
                    <p className="mt-1 text-gray-800">{viewingRequest.description}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">المبلغ:</span>
                    <div className="text-2xl font-bold text-gray-900 mt-0.5">
                      {Number(viewingRequest.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {viewingRequest.currency}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">تاريخ الطلب:</span>
                    <div className="font-medium">{new Date(viewingRequest.createdAt).toLocaleDateString("ar-AE")}</div>
                  </div>
                  {viewingRequest.approvedQuoteUrl && (
                    <div className="col-span-2">
                      <a href={viewingRequest.approvedQuoteUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm hover:bg-blue-100">
                        <FileText className="w-4 h-4" />
                        <span className="flex-1">{viewingRequest.approvedQuoteName || "العرض المعتمد"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {viewingRequest.financeEmailSentAt && (
                    <div className="col-span-2 flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                      <Mail className="w-4 h-4" />
                      أُرسل أمر الصرف لفريق المالية في {new Date(viewingRequest.financeEmailSentAt).toLocaleDateString("ar-AE")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Review Panel */}
              {reviewMode && (
                <Card className={`border-2 ${reviewMode === "wael" ? "border-blue-200 bg-blue-50/50" : "border-purple-200 bg-purple-50/50"}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {reviewMode === "wael" ? (
                        <><CheckCircle className="w-4 h-4 text-blue-600" />قرار وائل</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 text-purple-600" />قرار الشيخ عيسى</>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">القرار *</label>
                      <div className="flex gap-2">
                        {reviewMode === "wael" ? (
                          <>
                            <button onClick={() => setReviewDecision("approved")}
                              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === "approved" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-green-300"}`}>
                              <CheckCircle className="w-4 h-4 inline ml-1" />موافق
                            </button>
                            <button onClick={() => setReviewDecision("needs_revision")}
                              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === "needs_revision" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-gray-200 hover:border-yellow-300"}`}>
                              <RotateCcw className="w-4 h-4 inline ml-1" />يحتاج مراجعة
                            </button>
                            <button onClick={() => setReviewDecision("rejected")}
                              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === "rejected" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 hover:border-red-300"}`}>
                              <XCircle className="w-4 h-4 inline ml-1" />رفض
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setReviewDecision("approved")}
                              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === "approved" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-green-300"}`}>
                              <CheckCircle className="w-4 h-4 inline ml-1" />اعتماد وإرسال للمالية
                            </button>
                            <button onClick={() => setReviewDecision("rejected")}
                              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${reviewDecision === "rejected" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 hover:border-red-300"}`}>
                              <XCircle className="w-4 h-4 inline ml-1" />رفض
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">ملاحظات (اختياري)</label>
                      <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                        placeholder="أي ملاحظات أو تعليقات..." rows={2} />
                    </div>
                    {reviewDecision === "approved" && reviewMode === "sheikh" && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700 flex items-start gap-2">
                        <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>سيتم إرسال أمر الصرف تلقائياً لفريق المالية بالبريد الإلكتروني</span>
                      </div>
                    )}
                    <Button onClick={reviewMode === "wael" ? handleWaelReview : handleSheikhReview}
                      disabled={!reviewDecision || waelReviewMutation.isPending || sheikhReviewMutation.isPending}
                      className={`w-full ${reviewDecision === "approved" ? "bg-green-600 hover:bg-green-700" : reviewDecision === "rejected" ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"} text-white`}>
                      {waelReviewMutation.isPending || sheikhReviewMutation.isPending ? "جاري التسجيل..." : "تأكيد القرار"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
              {!reviewMode && viewingRequest.status === "pending_wael" && (
                <Button onClick={() => { setReviewMode("wael"); setReviewDecision(""); setReviewNotes(""); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white">
                  مراجعة وائل
                </Button>
              )}
              {!reviewMode && viewingRequest.status === "pending_sheikh" && (
                <Button onClick={() => { setReviewMode("sheikh"); setReviewDecision(""); setReviewNotes(""); }}
                  className="bg-purple-600 hover:bg-purple-700 text-white">
                  قرار الشيخ عيسى
                </Button>
              )}
              <Button variant="outline" onClick={() => { setViewingRequest(null); setReviewMode(null); }}>إغلاق</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
