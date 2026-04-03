import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Plus, Search, Edit2, Trash2, Eye, Upload, FileText,
  Globe, Phone, Mail, CheckCircle, AlertCircle, Banknote, Shield,
  ExternalLink, User, CreditCard,
} from "lucide-react";
import { useLocation } from "wouter";

type Partner = {
  id: number;
  companyName: string;
  category?: string | null;
  contactPerson?: string | null;
  mobileNumber?: string | null;
  emailAddress?: string | null;
  website?: string | null;
  status: "quoted_only" | "under_review" | "appointed" | "not_selected";
  notes?: string | null;
  commercialLicenseUrl?: string | null;
  commercialLicenseName?: string | null;
  vatCertificateUrl?: string | null;
  vatCertificateName?: string | null;
  authorizedSignatoryDocUrl?: string | null;
  authorizedSignatoryDocName?: string | null;
  otherDocumentsJson?: string | null;
  beneficiaryName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  currency?: string | null;
  bankNotes?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryEmail?: string | null;
  signatoryPhone?: string | null;
  signatoryImageUrl?: string | null;
  createdAt: string;
};

const STATUS_CONFIG = {
  quoted_only: { label: "عرض سعر فقط", color: "bg-blue-100 text-blue-800 border-blue-200" },
  under_review: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  appointed: { label: "معين", color: "bg-green-100 text-green-800 border-green-200" },
  not_selected: { label: "لم يُختر", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

const CATEGORIES = [
  "مقاول إنشاءات", "مستشار هندسي", "مورد مواد", "خدمات قانونية",
  "خدمات محاسبية", "تصميم داخلي", "مقاول كهرباء", "مقاول ميكانيكا",
  "خدمات تسويقية", "مطور برمجيات", "خدمات أمنية", "أخرى"
];

function DocBadge({ url, name, label }: { url?: string | null; name?: string | null; label: string }) {
  if (!url) return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-400 text-sm">
      <AlertCircle className="w-4 h-4" />
      <span>{label} - غير مرفق</span>
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm hover:bg-green-100 transition-colors">
      <CheckCircle className="w-4 h-4" />
      <span className="flex-1 truncate">{name || label}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );
}

function FileUploadButton({
  label, fieldType, partnerId, currentUrl, currentName, onUploaded
}: {
  label: string; fieldType: string; partnerId: number;
  currentUrl?: string | null; currentName?: string | null;
  onUploaded: (url: string, name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.businessPartners.uploadDocument.useMutation({
    onSuccess: (data) => { onUploaded(data.url, data.fileName); toast.success(`تم رفع ${label} بنجاح`); },
    onError: () => toast.error(`فشل رفع ${label}`),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({ partnerId, fieldType: fieldType as any, fileName: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {currentUrl ? (
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm hover:bg-green-100">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{currentName || label}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 ml-auto" />
          </a>
        ) : (
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>لم يُرفق بعد</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending} className="flex-shrink-0">
          <Upload className="w-3 h-3 mr-1" />
          {uploadMutation.isPending ? "جاري الرفع..." : "رفع"}
        </Button>
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
    </div>
  );
}

type FormData = {
  companyName: string; category: string; contactPerson: string; mobileNumber: string;
  emailAddress: string; website: string; status: "quoted_only" | "under_review" | "appointed" | "not_selected";
  notes: string; beneficiaryName: string; accountNumber: string; iban: string;
  bankName: string; branchName: string; currency: string; bankNotes: string;
  signatoryName: string; signatoryTitle: string; signatoryEmail: string; signatoryPhone: string;
};

const EMPTY_FORM: FormData = {
  companyName: "", category: "", contactPerson: "", mobileNumber: "", emailAddress: "",
  website: "", status: "quoted_only", notes: "", beneficiaryName: "", accountNumber: "",
  iban: "", bankName: "", branchName: "", currency: "AED", bankNotes: "",
  signatoryName: "", signatoryTitle: "", signatoryEmail: "", signatoryPhone: "",
};

export default function BusinessPartnersRegistry() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [viewingPartner, setViewingPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("company");

  const utils = trpc.useUtils();
  const { data: partners = [], isLoading } = trpc.businessPartners.list.useQuery();

  const createMutation = trpc.businessPartners.create.useMutation({
    onSuccess: () => { utils.businessPartners.list.invalidate(); setShowForm(false); setForm(EMPTY_FORM); toast.success("تم إضافة الشريك بنجاح"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.businessPartners.update.useMutation({
    onSuccess: () => { utils.businessPartners.list.invalidate(); setEditingPartner(null); setShowForm(false); setForm(EMPTY_FORM); toast.success("تم تحديث البيانات بنجاح"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.businessPartners.delete.useMutation({
    onSuccess: () => { utils.businessPartners.list.invalidate(); toast.success("تم حذف الشريك"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = partners.filter(p => {
    const matchSearch = !search || p.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (p.contactPerson || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => { setEditingPartner(null); setForm(EMPTY_FORM); setActiveTab("company"); setShowForm(true); };

  const openEdit = (p: Partner) => {
    setEditingPartner(p);
    setForm({
      companyName: p.companyName, category: p.category || "", contactPerson: p.contactPerson || "",
      mobileNumber: p.mobileNumber || "", emailAddress: p.emailAddress || "", website: p.website || "",
      status: p.status, notes: p.notes || "", beneficiaryName: p.beneficiaryName || "",
      accountNumber: p.accountNumber || "", iban: p.iban || "", bankName: p.bankName || "",
      branchName: p.branchName || "", currency: p.currency || "AED", bankNotes: p.bankNotes || "",
      signatoryName: p.signatoryName || "", signatoryTitle: p.signatoryTitle || "",
      signatoryEmail: p.signatoryEmail || "", signatoryPhone: p.signatoryPhone || "",
    });
    setActiveTab("company"); setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.companyName.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    if (editingPartner) { updateMutation.mutate({ id: editingPartner.id, ...form }); }
    else { createMutation.mutate(form); }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`هل أنت متأكد من حذف "${name}"؟`)) { deleteMutation.mutate({ id }); }
  };

  const setField = (key: keyof FormData, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const counts = {
    all: partners.length,
    appointed: partners.filter(p => p.status === "appointed").length,
    under_review: partners.filter(p => p.status === "under_review").length,
    quoted_only: partners.filter(p => p.status === "quoted_only").length,
    not_selected: partners.filter(p => p.status === "not_selected").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">سجل الشركاء والمتعاملين</h1>
            <p className="text-sm text-gray-500">إدارة شاملة للموردين والمقاولين والمستشارين</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { key: "all", label: "الكل", color: "from-gray-500 to-gray-600" },
          { key: "appointed", label: "معين", color: "from-green-500 to-emerald-600" },
          { key: "under_review", label: "قيد المراجعة", color: "from-yellow-500 to-amber-600" },
          { key: "quoted_only", label: "عرض سعر", color: "from-blue-500 to-indigo-600" },
          { key: "not_selected", label: "لم يُختر", color: "from-gray-400 to-gray-500" },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`p-3 rounded-xl border-2 transition-all text-right ${statusFilter === s.key ? "border-blue-500 bg-white shadow-md" : "border-transparent bg-white/60 hover:bg-white"}`}>
            <div className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
              {counts[s.key as keyof typeof counts]}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="بحث بالاسم أو الفئة أو المسؤول..." value={search}
            onChange={e => setSearch(e.target.value)} className="pr-10 bg-white" />
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md">
          <Plus className="w-4 h-4 ml-2" />
          إضافة شريك
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">لا توجد نتائج</p>
          <Button onClick={openCreate} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 ml-2" /> إضافة أول شريك
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الشركة</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الفئة</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">المسؤول</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">التواصل</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الوثائق</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">الحالة</th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const docCount = [p.commercialLicenseUrl, p.vatCertificateUrl, p.authorizedSignatoryDocUrl].filter(Boolean).length;
                  return (
                    <tr key={p.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{p.companyName}</div>
                        {p.website && (
                          <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                            <Globe className="w-3 h-3" />{p.website}
                          </a>
                        )}
                      </td>
                      <td className="p-4"><span className="text-sm text-gray-600">{p.category || "—"}</span></td>
                      <td className="p-4"><div className="text-sm text-gray-700">{p.contactPerson || "—"}</div></td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {p.mobileNumber && <div className="flex items-center gap-1 text-xs text-gray-600"><Phone className="w-3 h-3" />{p.mobileNumber}</div>}
                          {p.emailAddress && <div className="flex items-center gap-1 text-xs text-gray-600"><Mail className="w-3 h-3" />{p.emailAddress}</div>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${docCount === 3 ? "bg-green-500" : docCount > 0 ? "bg-yellow-500" : "bg-gray-300"}`} />
                          <span className="text-xs text-gray-500">{docCount}/3 وثائق</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[p.status].color}`}>
                          {STATUS_CONFIG[p.status].label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewingPartner(p)} className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-8 w-8 p-0 hover:bg-amber-100 hover:text-amber-600"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.companyName)} className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingPartner(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editingPartner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="company" className="text-xs"><Building2 className="w-3 h-3 ml-1" />بيانات الشركة</TabsTrigger>
              <TabsTrigger value="bank" className="text-xs"><Banknote className="w-3 h-3 ml-1" />الحساب البنكي</TabsTrigger>
              <TabsTrigger value="signatory" className="text-xs"><Shield className="w-3 h-3 ml-1" />المخول بالتوقيع</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs" disabled={!editingPartner}><FileText className="w-3 h-3 ml-1" />الوثائق</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">اسم الشركة *</label>
                  <Input value={form.companyName} onChange={e => setField("companyName", e.target.value)} placeholder="اسم الشركة أو المؤسسة" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">الفئة</label>
                  <Select value={form.category} onValueChange={v => setField("category", v)}>
                    <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">الحالة</label>
                  <Select value={form.status} onValueChange={v => setField("status", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">المسؤول / جهة الاتصال</label>
                  <Input value={form.contactPerson} onChange={e => setField("contactPerson", e.target.value)} placeholder="اسم المسؤول" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">رقم الجوال</label>
                  <Input value={form.mobileNumber} onChange={e => setField("mobileNumber", e.target.value)} placeholder="+971 50 000 0000" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">البريد الإلكتروني</label>
                  <Input value={form.emailAddress} onChange={e => setField("emailAddress", e.target.value)} placeholder="email@company.com" dir="ltr" type="email" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">الموقع الإلكتروني</label>
                  <Input value={form.website} onChange={e => setField("website", e.target.value)} placeholder="www.company.com" dir="ltr" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">ملاحظات</label>
                  <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-start gap-2">
                <Banknote className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>هذه البيانات ستُستخدم تلقائياً في أوامر الصرف المرسلة لفريق المالية</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">اسم المستفيد (كما في البنك)</label>
                  <Input value={form.beneficiaryName} onChange={e => setField("beneficiaryName", e.target.value)} placeholder="Beneficiary Name" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">رقم الحساب</label>
                  <Input value={form.accountNumber} onChange={e => setField("accountNumber", e.target.value)} placeholder="Account Number" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">IBAN</label>
                  <Input value={form.iban} onChange={e => setField("iban", e.target.value)} placeholder="AE00 0000 0000 0000 0000 000" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">اسم البنك</label>
                  <Input value={form.bankName} onChange={e => setField("bankName", e.target.value)} placeholder="Bank Name" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">الفرع</label>
                  <Input value={form.branchName} onChange={e => setField("branchName", e.target.value)} placeholder="Branch Name" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">العملة</label>
                  <Select value={form.currency} onValueChange={v => setField("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED - درهم إماراتي</SelectItem>
                      <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
                      <SelectItem value="EUR">EUR - يورو</SelectItem>
                      <SelectItem value="GBP">GBP - جنيه إسترليني</SelectItem>
                      <SelectItem value="SAR">SAR - ريال سعودي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">ملاحظات بنكية</label>
                  <Textarea value={form.bankNotes} onChange={e => setField("bankNotes", e.target.value)} placeholder="أي تعليمات خاصة بالتحويل..." rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signatory" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">اسم المخول بالتوقيع</label>
                  <Input value={form.signatoryName} onChange={e => setField("signatoryName", e.target.value)} placeholder="الاسم الكامل" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">المسمى الوظيفي</label>
                  <Input value={form.signatoryTitle} onChange={e => setField("signatoryTitle", e.target.value)} placeholder="المدير التنفيذي، المفوض..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">البريد الإلكتروني</label>
                  <Input value={form.signatoryEmail} onChange={e => setField("signatoryEmail", e.target.value)} placeholder="email@company.com" dir="ltr" type="email" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">رقم الهاتف</label>
                  <Input value={form.signatoryPhone} onChange={e => setField("signatoryPhone", e.target.value)} placeholder="+971 50 000 0000" dir="ltr" />
                </div>
              </div>
              {!editingPartner && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-700">
                  يمكنك رفع صورة المخول بالتوقيع بعد حفظ السجل من تبويب "الوثائق"
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              {editingPartner ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />الرخصة التجارية
                    </label>
                    <FileUploadButton label="الرخصة التجارية" fieldType="commercialLicense" partnerId={editingPartner.id}
                      currentUrl={editingPartner.commercialLicenseUrl} currentName={editingPartner.commercialLicenseName}
                      onUploaded={(url, name) => { setEditingPartner(prev => prev ? { ...prev, commercialLicenseUrl: url, commercialLicenseName: name } : null); utils.businessPartners.list.invalidate(); }} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />شهادة ضريبة القيمة المضافة (VAT)
                    </label>
                    <FileUploadButton label="شهادة VAT" fieldType="vatCertificate" partnerId={editingPartner.id}
                      currentUrl={editingPartner.vatCertificateUrl} currentName={editingPartner.vatCertificateName}
                      onUploaded={(url, name) => { setEditingPartner(prev => prev ? { ...prev, vatCertificateUrl: url, vatCertificateName: name } : null); utils.businessPartners.list.invalidate(); }} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />وثيقة المخول بالتوقيع
                    </label>
                    <FileUploadButton label="وثيقة التوقيع" fieldType="authorizedSignatoryDoc" partnerId={editingPartner.id}
                      currentUrl={editingPartner.authorizedSignatoryDocUrl} currentName={editingPartner.authorizedSignatoryDocName}
                      onUploaded={(url, name) => { setEditingPartner(prev => prev ? { ...prev, authorizedSignatoryDocUrl: url, authorizedSignatoryDocName: name } : null); utils.businessPartners.list.invalidate(); }} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-600" />صورة المخول بالتوقيع
                    </label>
                    <FileUploadButton label="صورة المخول" fieldType="signatoryImage" partnerId={editingPartner.id}
                      currentUrl={editingPartner.signatoryImageUrl} currentName="صورة المخول"
                      onUploaded={(url, _) => { setEditingPartner(prev => prev ? { ...prev, signatoryImageUrl: url } : null); utils.businessPartners.list.invalidate(); }} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>احفظ السجل أولاً ثم ارفع الوثائق</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingPartner(null); }}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingPartner ? "حفظ التعديلات" : "إضافة الشريك"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      {viewingPartner && (
        <Dialog open={!!viewingPartner} onOpenChange={() => setViewingPartner(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {viewingPartner.companyName}
                <span className={`mr-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[viewingPartner.status].color}`}>
                  {STATUS_CONFIG[viewingPartner.status].label}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2"><Building2 className="w-4 h-4" />بيانات الشركة</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">الفئة:</span> <span className="font-medium">{viewingPartner.category || "—"}</span></div>
                  <div><span className="text-gray-500">المسؤول:</span> <span className="font-medium">{viewingPartner.contactPerson || "—"}</span></div>
                  <div><span className="text-gray-500">الجوال:</span> <span className="font-medium" dir="ltr">{viewingPartner.mobileNumber || "—"}</span></div>
                  <div><span className="text-gray-500">البريد:</span> <span className="font-medium" dir="ltr">{viewingPartner.emailAddress || "—"}</span></div>
                  {viewingPartner.website && <div className="col-span-2"><span className="text-gray-500">الموقع:</span> <a href={viewingPartner.website.startsWith("http") ? viewingPartner.website : `https://${viewingPartner.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" dir="ltr">{viewingPartner.website}</a></div>}
                  {viewingPartner.notes && <div className="col-span-2"><span className="text-gray-500">ملاحظات:</span> <span>{viewingPartner.notes}</span></div>}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-blue-50/50">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2"><Banknote className="w-4 h-4 text-blue-600" />بيانات الحساب البنكي</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2"><span className="text-gray-500">اسم المستفيد:</span> <span className="font-semibold" dir="ltr">{viewingPartner.beneficiaryName || "—"}</span></div>
                  <div><span className="text-gray-500">رقم الحساب:</span> <span className="font-mono" dir="ltr">{viewingPartner.accountNumber || "—"}</span></div>
                  <div><span className="text-gray-500">IBAN:</span> <span className="font-mono text-xs" dir="ltr">{viewingPartner.iban || "—"}</span></div>
                  <div><span className="text-gray-500">البنك:</span> <span dir="ltr">{viewingPartner.bankName || "—"}</span></div>
                  <div><span className="text-gray-500">الفرع:</span> <span dir="ltr">{viewingPartner.branchName || "—"}</span></div>
                  <div><span className="text-gray-500">العملة:</span> <span className="font-semibold">{viewingPartner.currency || "AED"}</span></div>
                </CardContent>
              </Card>
              {viewingPartner.signatoryName && (
                <Card className="border-0 shadow-sm bg-purple-50/50">
                  <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2"><Shield className="w-4 h-4 text-purple-600" />المخول بالتوقيع</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                    {viewingPartner.signatoryImageUrl && <div className="col-span-2 flex justify-center"><img src={viewingPartner.signatoryImageUrl} alt="المخول" className="w-20 h-20 rounded-full object-cover border-2 border-purple-200" /></div>}
                    <div><span className="text-gray-500">الاسم:</span> <span className="font-medium">{viewingPartner.signatoryName}</span></div>
                    <div><span className="text-gray-500">المسمى:</span> <span>{viewingPartner.signatoryTitle || "—"}</span></div>
                    <div><span className="text-gray-500">البريد:</span> <span dir="ltr">{viewingPartner.signatoryEmail || "—"}</span></div>
                    <div><span className="text-gray-500">الهاتف:</span> <span dir="ltr">{viewingPartner.signatoryPhone || "—"}</span></div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-0 shadow-sm bg-green-50/50">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2"><FileText className="w-4 h-4 text-green-600" />الوثائق</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <DocBadge url={viewingPartner.commercialLicenseUrl} name={viewingPartner.commercialLicenseName} label="الرخصة التجارية" />
                  <DocBadge url={viewingPartner.vatCertificateUrl} name={viewingPartner.vatCertificateName} label="شهادة VAT" />
                  <DocBadge url={viewingPartner.authorizedSignatoryDocUrl} name={viewingPartner.authorizedSignatoryDocName} label="وثيقة المخول بالتوقيع" />
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <Button
                variant="default"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                onClick={() => {
                  setViewingPartner(null);
                  navigate(`/payment-requests?partnerId=${viewingPartner.id}&partnerName=${encodeURIComponent(viewingPartner.companyName)}`);
                }}
              >
                <CreditCard className="w-4 h-4" />
                إنشاء طلب صرف
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setViewingPartner(null); openEdit(viewingPartner); }}><Edit2 className="w-4 h-4 ml-2" />تعديل</Button>
                <Button onClick={() => setViewingPartner(null)}>إغلاق</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
