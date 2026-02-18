import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  AlertTriangle
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

  const [editingProfile, setEditingProfile] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    companyNameAr: "",
    founded: "",
    headquarters: "",
    website: "",
    employeeCount: "",
    specializations: "",
    keyProjects: "",
    certifications: "",
    overview: "",
    strengths: "",
    weaknesses: "",
  });
  const [noteForm, setNoteForm] = useState({ title: "", content: "", category: "general" });

  const resetNoteForm = () => setNoteForm({ title: "", content: "", category: "general" });

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Card className="w-96 text-center">
          <CardContent className="pt-6">
            <p className="text-gray-600">الاستشاري غير موجود</p>
            <Link href="/consultant-profiles">
              <Button className="mt-4">العودة للقائمة</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { consultant, profile, notes } = data;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-blue-700 to-blue-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{consultant.name}</h1>
            {profile?.companyNameAr && (
              <p className="text-sm opacity-80 mt-1">{profile.companyNameAr}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/consultant-profiles">
              <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                <ChevronLeft className="h-4 w-4 ml-1" />
                القائمة
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                الرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              الملف التعريفي
            </CardTitle>
            {!editingProfile && (
              <Button variant="outline" size="sm" onClick={startEditProfile}>
                <Pencil className="h-4 w-4 ml-1" />
                {profile ? "تعديل" : "إضافة ملف تعريفي"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>الاسم بالعربية</Label>
                    <Input value={profileForm.companyNameAr} onChange={e => setProfileForm(p => ({ ...p, companyNameAr: e.target.value }))} placeholder="مثال: شركة أوسس الدولية" />
                  </div>
                  <div>
                    <Label>سنة التأسيس</Label>
                    <Input value={profileForm.founded} onChange={e => setProfileForm(p => ({ ...p, founded: e.target.value }))} placeholder="مثال: 2005" />
                  </div>
                  <div>
                    <Label>المقر الرئيسي</Label>
                    <Input value={profileForm.headquarters} onChange={e => setProfileForm(p => ({ ...p, headquarters: e.target.value }))} placeholder="مثال: دبي، الإمارات" />
                  </div>
                  <div>
                    <Label>الموقع الإلكتروني</Label>
                    <Input value={profileForm.website} onChange={e => setProfileForm(p => ({ ...p, website: e.target.value }))} placeholder="مثال: www.example.com" />
                  </div>
                  <div>
                    <Label>عدد الموظفين</Label>
                    <Input value={profileForm.employeeCount} onChange={e => setProfileForm(p => ({ ...p, employeeCount: e.target.value }))} placeholder="مثال: 150" />
                  </div>
                  <div>
                    <Label>الشهادات والاعتمادات</Label>
                    <Input value={profileForm.certifications} onChange={e => setProfileForm(p => ({ ...p, certifications: e.target.value }))} placeholder="مثال: ISO 9001, LEED" />
                  </div>
                </div>
                <div>
                  <Label>التخصصات (مفصولة بفواصل)</Label>
                  <Input value={profileForm.specializations} onChange={e => setProfileForm(p => ({ ...p, specializations: e.target.value }))} placeholder="مثال: تصميم معماري, تصميم إنشائي, إدارة مشاريع" />
                </div>
                <div>
                  <Label>نبذة عامة</Label>
                  <Textarea value={profileForm.overview} onChange={e => setProfileForm(p => ({ ...p, overview: e.target.value }))} placeholder="وصف عام عن الشركة وخبراتها..." rows={3} />
                </div>
                <div>
                  <Label>المشاريع البارزة</Label>
                  <Textarea value={profileForm.keyProjects} onChange={e => setProfileForm(p => ({ ...p, keyProjects: e.target.value }))} placeholder="أبرز المشاريع المنجزة..." rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1"><Star className="h-4 w-4 text-green-500" /> نقاط القوة</Label>
                    <Textarea value={profileForm.strengths} onChange={e => setProfileForm(p => ({ ...p, strengths: e.target.value }))} placeholder="نقاط القوة الرئيسية..." rows={3} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-500" /> نقاط الضعف</Label>
                    <Textarea value={profileForm.weaknesses} onChange={e => setProfileForm(p => ({ ...p, weaknesses: e.target.value }))} placeholder="نقاط الضعف أو المخاطر..." rows={3} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={saveProfile} disabled={upsertProfile.isPending}>
                    {upsertProfile.isPending ? <Loader2 className="animate-spin h-4 w-4 ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                    حفظ
                  </Button>
                  <Button variant="outline" onClick={() => setEditingProfile(false)}>إلغاء</Button>
                </div>
              </div>
            ) : profile ? (
              <div className="space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {profile.headquarters && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">المقر:</span>
                      <span>{profile.headquarters}</span>
                    </div>
                  )}
                  {profile.founded && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">التأسيس:</span>
                      <span>{profile.founded}</span>
                    </div>
                  )}
                  {profile.employeeCount && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">الموظفون:</span>
                      <span>{profile.employeeCount}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">الموقع:</span>
                      <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{profile.website}</a>
                    </div>
                  )}
                  {profile.certifications && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">الشهادات:</span>
                      <span>{profile.certifications}</span>
                    </div>
                  )}
                </div>

                {/* Specializations */}
                {profile.specializations && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">التخصصات:</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.specializations.split(",").map((s, i) => (
                        <Badge key={i} variant="secondary">{s.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overview */}
                {profile.overview && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">نبذة عامة:</p>
                    <p className="text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">{profile.overview}</p>
                  </div>
                )}

                {/* Key Projects */}
                {profile.keyProjects && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">المشاريع البارزة:</p>
                    <p className="text-sm leading-relaxed bg-blue-50 p-3 rounded-lg">{profile.keyProjects}</p>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.strengths && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
                        <Star className="h-4 w-4" /> نقاط القوة
                      </p>
                      <p className="text-sm text-green-800">{profile.strengths}</p>
                    </div>
                  )}
                  {profile.weaknesses && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-amber-700 mb-1 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> نقاط الضعف
                      </p>
                      <p className="text-sm text-amber-800">{profile.weaknesses}</p>
                    </div>
                  )}
                </div>

                {/* Contact */}
                <div className="pt-2 border-t flex gap-6 text-sm text-gray-500">
                  {consultant.email && <span>📧 {consultant.email}</span>}
                  {consultant.phone && <span>📞 {consultant.phone}</span>}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">لم يتم إضافة ملف تعريفي بعد</p>
                <Button className="mt-3" onClick={startEditProfile}>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة ملف تعريفي
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              الملاحظات الخاصة
              {notes.length > 0 && (
                <Badge variant="secondary" className="mr-2">{notes.length}</Badge>
              )}
            </CardTitle>
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetNoteForm}>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة ملاحظة
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>العنوان (اختياري)</Label>
                    <Input value={noteForm.title} onChange={e => setNoteForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان مختصر للملاحظة" />
                  </div>
                  <div>
                    <Label>المحتوى</Label>
                    <Textarea value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} placeholder="اكتب ملاحظتك هنا..." rows={4} />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addNote.mutate({ consultantId, ...noteForm })}
                    disabled={!noteForm.content.trim() || addNote.isPending}
                  >
                    {addNote.isPending ? <Loader2 className="animate-spin h-4 w-4 ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                    حفظ الملاحظة
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">لا توجد ملاحظات بعد</p>
                <p className="text-gray-400 text-sm mt-1">أضف ملاحظاتك الخاصة حول هذا الاستشاري</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => {
                  const cat = NOTE_CATEGORIES.find(c => c.value === note.category);
                  return (
                    <div key={note.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {cat?.icon} {cat?.label || note.category}
                            </Badge>
                            {note.title && (
                              <span className="font-medium text-sm">{note.title}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(note.createdAt).toLocaleDateString("ar-AE", {
                              year: "numeric", month: "long", day: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) {
                              deleteNote.mutate({ noteId: note.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
