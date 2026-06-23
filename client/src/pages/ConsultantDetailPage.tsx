import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2, ChevronLeft, Building2, Globe, Users, Award, Calendar,
  FileText, Plus, Pencil, Trash2, Save, MessageSquare, Shield, Star,
  AlertTriangle, ExternalLink, MapPin, Phone, Mail, Briefcase,
  Image as ImageIcon, Layout, Eye
} from "lucide-react";
import { Link, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
      {...props}
    />
  );
}

const NOTE_CATEGORIES = [
  { value: "general", label: "عام", icon: "📋" },
  { value: "meeting", label: "اجتماع", icon: "🤝" },
  { value: "feedback", label: "ملاحظة أداء", icon: "📝" },
  { value: "issue", label: "مشكلة", icon: "⚠️" },
  { value: "recommendation", label: "توصية", icon: "⭐" },
];

export default function ConsultantDetailPage() {
  const params = useParams<{ id: string }>();
  const consultantId = parseInt(params.id || "0");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.profiles.getDetail.useQuery(
    { consultantId },
    { enabled: isAuthenticated && consultantId > 0 }
  );

  const upsertProfile = trpc.profiles.upsertProfile.useMutation({
    onSuccess: () => {
      utils.profiles.getDetail.invalidate({ consultantId });
      toast.success("تم حفظ الملف التعريفي بنجاح");
      setEditingProfile(false);
    },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  const addNote = trpc.profiles.addNote.useMutation({
    onSuccess: () => {
      utils.profiles.getDetail.invalidate({ consultantId });
      toast.success("تم إضافة الملاحظة");
      setNoteDialogOpen(false);
      resetNoteForm();
    },
    onError: () => toast.error("حدث خطأ أثناء الإضافة"),
  });

  const deleteNote = trpc.profiles.deleteNote.useMutation({
    onSuccess: () => {
      utils.profiles.getDetail.invalidate({ consultantId });
      toast.success("تم حذف الملاحظة");
    },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });

  const addPortfolio = trpc.profiles.addPortfolioItem.useMutation({
    onSuccess: () => {
      utils.profiles.getDetail.invalidate({ consultantId });
      toast.success("تم إضافة المشروع للمعرض");
      setPortfolioDialogOpen(false);
      resetPortfolioForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deletePortfolio = trpc.profiles.deletePortfolioItem.useMutation({
    onSuccess: () => {
      utils.profiles.getDetail.invalidate({ consultantId });
      toast.success("تم الحذف");
    },
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [showWebsite, setShowWebsite] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "portfolio" | "notes">("overview");

  const [profileForm, setProfileForm] = useState({
    companyNameAr: "", founded: "", headquarters: "", website: "",
    employeeCount: "", specializations: "", keyProjects: "",
    certifications: "", overview: "", strengths: "", weaknesses: "",
  });
  const [noteForm, setNoteForm] = useState({ title: "", content: "", category: "general" });
  const [portfolioForm, setPortfolioForm] = useState({
    title: "", description: "", imageUrl: "", projectType: "", location: "", year: "", area: "",
  });

  const resetNoteForm = () => setNoteForm({ title: "", content: "", category: "general" });
  const resetPortfolioForm = () => setPortfolioForm({ title: "", description: "", imageUrl: "", projectType: "", location: "", year: "", area: "" });

  const startEditProfile = () => {
    if (data?.profile) {
      setProfileForm({
        companyNameAr: data.profile.companyNameAr || "",
        founded: data.profile.founded || "",
        headquarters: data.profile.headquarters || "",
        website: data.profile.website || "",
        employeeCount: data.profile.employeeCount || "",
        specializations: data.profile.specializations || "",
        keyProjects: data.profile.keyProjects || "",
        certifications: data.profile.certifications || "",
        overview: data.profile.overview || "",
        strengths: data.profile.strengths || "",
        weaknesses: data.profile.weaknesses || "",
      });
    }
    setEditingProfile(true);
  };

  const saveProfile = () => {
    upsertProfile.mutate({ consultantId, ...profileForm });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" dir="rtl">
        <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" dir="rtl">
        <Card className="w-96 text-center">
          <CardContent className="pt-6">
            <p className="mb-4 text-gray-600">يرجى تسجيل الدخول</p>
            <a href={getLoginUrl()}><Button>تسجيل الدخول</Button></a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" dir="rtl">
        <Card className="w-96 text-center">
          <CardContent className="pt-6">
            <p className="text-gray-600">الاستشاري غير موجود</p>
            <Link href="/consultant-profiles"><Button className="mt-4">العودة للقائمة</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { consultant, profile, notes, details, portfolio } = data;
  const websiteUrl = profile?.website
    ? (profile.website.startsWith("http") ? profile.website : `https://${profile.website}`)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-purple-800 to-indigo-900" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.4\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }} />
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/consultant-know" className="inline-flex items-center gap-2 text-violet-200 hover:text-white transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" />
              العودة لقائمة الاستشاريين
            </Link>
            <span className="text-violet-400">|</span>
            <Link href="/consultant-portal" className="text-violet-200 hover:text-white transition-colors text-sm">
              مكاتب الاستشارات
            </Link>
          </div>

          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-4xl font-bold shadow-2xl shrink-0">
              {consultant.name?.charAt(0) || "?"}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">{consultant.name}</h1>
              {profile?.companyNameAr && (
                <p className="text-violet-200 text-lg mb-3">{profile.companyNameAr}</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                {consultant.email && (
                  <span className="flex items-center gap-1.5 text-violet-200">
                    <Mail className="w-4 h-4" /> {consultant.email}
                  </span>
                )}
                {consultant.phone && (
                  <span className="flex items-center gap-1.5 text-violet-200">
                    <Phone className="w-4 h-4" /> {consultant.phone}
                  </span>
                )}
                {profile?.headquarters && (
                  <span className="flex items-center gap-1.5 text-violet-200">
                    <MapPin className="w-4 h-4" /> {profile.headquarters}
                  </span>
                )}
                {profile?.founded && (
                  <span className="flex items-center gap-1.5 text-violet-200">
                    <Calendar className="w-4 h-4" /> تأسس {profile.founded}
                  </span>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-3 mt-4">
                {profile?.employeeCount && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-white border border-white/10">
                    <Users className="w-3.5 h-3.5 inline ml-1" /> {profile.employeeCount} موظف
                  </div>
                )}
                {details?.yearsOfExperience && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-white border border-white/10">
                    <Briefcase className="w-3.5 h-3.5 inline ml-1" /> {details.yearsOfExperience} سنة خبرة
                  </div>
                )}
                {details?.numberOfEngineers && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-white border border-white/10">
                    <Users className="w-3.5 h-3.5 inline ml-1" /> {details.numberOfEngineers} مهندس
                  </div>
                )}
                {profile?.certifications && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-white border border-white/10">
                    <Shield className="w-3.5 h-3.5 inline ml-1" /> {profile.certifications}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              {websiteUrl && (
                <Button
                  onClick={() => setShowWebsite(!showWebsite)}
                  className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  variant="outline"
                >
                  <Globe className="w-4 h-4" />
                  {showWebsite ? "إخفاء الموقع" : "عرض الموقع"}
                </Button>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2 w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">
                    <ExternalLink className="w-4 h-4" />
                    فتح في تبويب جديد
                  </Button>
                </a>
              )}
              <Button onClick={startEditProfile} variant="outline" className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <Pencil className="w-4 h-4" />
                {profile ? "تعديل البروفايل" : "إضافة بروفايل"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Website Embed */}
      {showWebsite && websiteUrl && (
        <div className="max-w-6xl mx-auto px-6 -mt-2 mb-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden">
            <div className="bg-stone-100 px-4 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Globe className="w-4 h-4" />
                <span className="truncate max-w-md">{websiteUrl}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowWebsite(false)} className="text-stone-400 hover:text-stone-600">
                إغلاق
              </Button>
            </div>
            <iframe
              src={websiteUrl}
              className="w-full border-0"
              style={{ height: "600px" }}
              sandbox="allow-scripts allow-same-origin allow-popups"
              title={`موقع ${consultant.name}`}
            />
          </div>
        </div>
      )}

      {/* Specializations Bar */}
      {profile?.specializations && (
        <div className="max-w-6xl mx-auto px-6 -mt-4 mb-6 relative z-10">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-stone-500">التخصصات:</span>
            {profile.specializations.split(",").map((s, i) => (
              <Badge key={i} className="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100">
                {s.trim()}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6 mb-6">
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
          {[
            { id: "overview" as const, label: "نظرة عامة", icon: <Eye className="w-4 h-4" /> },
            { id: "portfolio" as const, label: `معرض الأعمال (${portfolio?.length || 0})`, icon: <Layout className="w-4 h-4" /> },
            { id: "notes" as const, label: `الملاحظات (${notes?.length || 0})`, icon: <MessageSquare className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {editingProfile ? (
              <Card className="border-violet-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-violet-700">
                    <Pencil className="h-5 w-5" /> تعديل الملف التعريفي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>الاسم بالعربية</Label><Input value={profileForm.companyNameAr} onChange={e => setProfileForm(p => ({ ...p, companyNameAr: e.target.value }))} placeholder="مثال: شركة أوسس الدولية" /></div>
                      <div><Label>سنة التأسيس</Label><Input value={profileForm.founded} onChange={e => setProfileForm(p => ({ ...p, founded: e.target.value }))} placeholder="مثال: 2005" /></div>
                      <div><Label>المقر الرئيسي</Label><Input value={profileForm.headquarters} onChange={e => setProfileForm(p => ({ ...p, headquarters: e.target.value }))} placeholder="مثال: دبي، الإمارات" /></div>
                      <div><Label>الموقع الإلكتروني</Label><Input value={profileForm.website} onChange={e => setProfileForm(p => ({ ...p, website: e.target.value }))} placeholder="مثال: www.example.com" /></div>
                      <div><Label>عدد الموظفين</Label><Input value={profileForm.employeeCount} onChange={e => setProfileForm(p => ({ ...p, employeeCount: e.target.value }))} placeholder="مثال: 150" /></div>
                      <div><Label>الشهادات والاعتمادات</Label><Input value={profileForm.certifications} onChange={e => setProfileForm(p => ({ ...p, certifications: e.target.value }))} placeholder="مثال: ISO 9001, LEED" /></div>
                    </div>
                    <div><Label>التخصصات (مفصولة بفواصل)</Label><Input value={profileForm.specializations} onChange={e => setProfileForm(p => ({ ...p, specializations: e.target.value }))} placeholder="تصميم معماري, تصميم إنشائي, إدارة مشاريع" /></div>
                    <div><Label>نبذة عامة</Label><Textarea value={profileForm.overview} onChange={e => setProfileForm(p => ({ ...p, overview: e.target.value }))} placeholder="وصف عام عن الشركة وخبراتها..." rows={3} /></div>
                    <div><Label>المشاريع البارزة</Label><Textarea value={profileForm.keyProjects} onChange={e => setProfileForm(p => ({ ...p, keyProjects: e.target.value }))} placeholder="أبرز المشاريع المنجزة..." rows={3} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label className="flex items-center gap-1"><Star className="h-4 w-4 text-green-500" /> نقاط القوة</Label><Textarea value={profileForm.strengths} onChange={e => setProfileForm(p => ({ ...p, strengths: e.target.value }))} rows={3} /></div>
                      <div><Label className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-500" /> نقاط الضعف</Label><Textarea value={profileForm.weaknesses} onChange={e => setProfileForm(p => ({ ...p, weaknesses: e.target.value }))} rows={3} /></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveProfile} disabled={upsertProfile.isPending} className="bg-violet-600 hover:bg-violet-700">
                        {upsertProfile.isPending ? <Loader2 className="animate-spin h-4 w-4 ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                        حفظ
                      </Button>
                      <Button variant="outline" onClick={() => setEditingProfile(false)}>إلغاء</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Overview & Key Projects */}
                {profile?.overview && (
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-violet-600" /> نبذة عامة
                    </h3>
                    <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{profile.overview}</p>
                  </div>
                )}

                {profile?.keyProjects && (
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-violet-600" /> المشاريع البارزة
                    </h3>
                    <p className="text-stone-600 leading-relaxed whitespace-pre-wrap bg-violet-50 rounded-xl p-4">{profile.keyProjects}</p>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                {(profile?.strengths || profile?.weaknesses) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profile.strengths && (
                      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
                        <h3 className="text-lg font-bold text-emerald-800 mb-3 flex items-center gap-2">
                          <Star className="w-5 h-5" /> نقاط القوة
                        </h3>
                        <p className="text-emerald-700 leading-relaxed whitespace-pre-wrap">{profile.strengths}</p>
                      </div>
                    )}
                    {profile.weaknesses && (
                      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
                        <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" /> نقاط الضعف
                        </h3>
                        <p className="text-amber-700 leading-relaxed whitespace-pre-wrap">{profile.weaknesses}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Details */}
                {details && (
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-violet-600" /> معلومات التواصل التفصيلية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {details.contactPerson && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <p className="text-xs text-stone-400 mb-1">مسؤول التواصل</p>
                          <p className="font-medium text-stone-800">{details.contactPerson}</p>
                        </div>
                      )}
                      {details.contactPersonPhone && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <p className="text-xs text-stone-400 mb-1">هاتف المسؤول</p>
                          <p className="font-medium text-stone-800">{details.contactPersonPhone}</p>
                        </div>
                      )}
                      {details.contactPersonEmail && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <p className="text-xs text-stone-400 mb-1">بريد المسؤول</p>
                          <p className="font-medium text-stone-800">{details.contactPersonEmail}</p>
                        </div>
                      )}
                      {details.classification && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <p className="text-xs text-stone-400 mb-1">التصنيف</p>
                          <p className="font-medium text-stone-800">{details.classification}</p>
                        </div>
                      )}
                      {details.location && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <p className="text-xs text-stone-400 mb-1">الموقع</p>
                          <p className="font-medium text-stone-800">{details.location}</p>
                        </div>
                      )}
                      {details.notableClients && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 md:col-span-3">
                          <p className="text-xs text-stone-400 mb-1">عملاء بارزون</p>
                          <p className="font-medium text-stone-800 whitespace-pre-wrap">{details.notableClients}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!profile && !details && (
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
                    <Building2 className="w-16 h-16 mx-auto text-stone-200 mb-4" />
                    <h3 className="text-lg font-medium text-stone-500 mb-2">لم يتم إضافة ملف تعريفي بعد</h3>
                    <p className="text-stone-400 mb-4">أضف معلومات الاستشاري لعرض بروفايل شامل</p>
                    <Button onClick={startEditProfile} className="bg-violet-600 hover:bg-violet-700">
                      <Plus className="w-4 h-4 ml-1" /> إضافة ملف تعريفي
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <Layout className="w-5 h-5 text-violet-600" /> معرض الأعمال
              </h3>
              <Dialog open={portfolioDialogOpen} onOpenChange={setPortfolioDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={resetPortfolioForm}>
                    <Plus className="w-4 h-4" /> إضافة مشروع
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl" className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>إضافة مشروع للمعرض</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div><Label>اسم المشروع</Label><Input value={portfolioForm.title} onChange={e => setPortfolioForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: برج الخليج التجاري" /></div>
                    <div><Label>الوصف</Label><Textarea value={portfolioForm.description} onChange={e => setPortfolioForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف المشروع..." rows={2} /></div>
                    <div><Label>رابط الصورة</Label><Input value={portfolioForm.imageUrl} onChange={e => setPortfolioForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>نوع المشروع</Label><Input value={portfolioForm.projectType} onChange={e => setPortfolioForm(p => ({ ...p, projectType: e.target.value }))} placeholder="سكني / تجاري / مختلط" /></div>
                      <div><Label>الموقع</Label><Input value={portfolioForm.location} onChange={e => setPortfolioForm(p => ({ ...p, location: e.target.value }))} placeholder="دبي" /></div>
                      <div><Label>السنة</Label><Input value={portfolioForm.year} onChange={e => setPortfolioForm(p => ({ ...p, year: e.target.value }))} placeholder="2024" /></div>
                      <div><Label>المساحة</Label><Input value={portfolioForm.area} onChange={e => setPortfolioForm(p => ({ ...p, area: e.target.value }))} placeholder="50,000 sqft" /></div>
                    </div>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700"
                      onClick={() => addPortfolio.mutate({ consultantId, ...portfolioForm })}
                      disabled={!portfolioForm.title.trim() || addPortfolio.isPending}
                    >
                      {addPortfolio.isPending ? <Loader2 className="animate-spin h-4 w-4 ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                      حفظ المشروع
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {portfolio && portfolio.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolio.map((item: any) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-lg transition-all group">
                    {/* Image */}
                    <div className="aspect-video bg-gradient-to-br from-violet-100 to-purple-50 relative overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-violet-200" />
                        </div>
                      )}
                      {item.projectType && (
                        <Badge className="absolute top-3 right-3 bg-violet-600 text-white">{item.projectType}</Badge>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا المشروع؟")) {
                            deletePortfolio.mutate({ id: item.id });
                          }
                        }}
                        className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <h4 className="font-bold text-stone-800 mb-1">{item.title}</h4>
                      {item.description && (
                        <p className="text-sm text-stone-500 mb-3 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-stone-400">
                        {item.location && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location}</span>
                        )}
                        {item.year && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.year}</span>
                        )}
                        {item.area && (
                          <span className="flex items-center gap-1"><Layout className="w-3 h-3" /> {item.area}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
                <Layout className="w-16 h-16 mx-auto text-stone-200 mb-4" />
                <h3 className="text-lg font-medium text-stone-500 mb-2">لا توجد مشاريع في المعرض</h3>
                <p className="text-stone-400 mb-4">أضف مشاريع الاستشاري السابقة لعرض إمكانياته</p>
                <Button onClick={() => { resetPortfolioForm(); setPortfolioDialogOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 ml-1" /> إضافة أول مشروع
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-600" /> الملاحظات الخاصة
              </h3>
              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={resetNoteForm}>
                    <Plus className="w-4 h-4" /> إضافة ملاحظة
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة ملاحظة جديدة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>التصنيف</Label>
                      <Select value={noteForm.category} onValueChange={v => setNoteForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NOTE_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>العنوان (اختياري)</Label><Input value={noteForm.title} onChange={e => setNoteForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان مختصر" /></div>
                    <div><Label>المحتوى</Label><Textarea value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} placeholder="اكتب ملاحظتك هنا..." rows={4} /></div>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700"
                      onClick={() => addNote.mutate({ consultantId, ...noteForm })}
                      disabled={!noteForm.content.trim() || addNote.isPending}
                    >
                      {addNote.isPending ? <Loader2 className="animate-spin h-4 w-4 ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                      حفظ الملاحظة
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {notes && notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note: any) => {
                  const cat = NOTE_CATEGORIES.find(c => c.value === note.category);
                  return (
                    <div key={note.id} className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{cat?.icon} {cat?.label || note.category}</Badge>
                            {note.title && <span className="font-medium text-sm text-stone-800">{note.title}</span>}
                          </div>
                          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-stone-400 mt-3">
                            {new Date(note.createdAt).toLocaleDateString("ar-AE", {
                              year: "numeric", month: "long", day: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) deleteNote.mutate({ noteId: note.id }); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-stone-200 mb-4" />
                <h3 className="text-lg font-medium text-stone-500 mb-2">لا توجد ملاحظات بعد</h3>
                <p className="text-stone-400">أضف ملاحظاتك الخاصة حول هذا الاستشاري</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
