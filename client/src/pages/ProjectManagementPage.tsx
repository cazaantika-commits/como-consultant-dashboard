import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  ArrowRight, Plus, Pencil, Trash2, Building2, MapPin, FileText,
  Users, Zap, Calendar, Shield, Loader2, ChevronDown, ChevronUp,
  FolderOpen, Hash, Ruler, Home as HomeIcon, User, Phone, Mail, Globe,
  Landmark, Clock, AlertTriangle, Gavel, Eye, DollarSign, BarChart3,
  ExternalLink
} from "lucide-react";

// Field group definition for organized form layout
const FIELD_GROUPS = [
  {
    id: "basic",
    title: "البيانات الأساسية",
    icon: Building2,
    color: "from-blue-500 to-indigo-600",
    fields: [
      { key: "name", label: "اسم المشروع", type: "text", required: true, placeholder: "مثال: مبنى الجداف السكني (G+7)" },
      { key: "description", label: "وصف المشروع", type: "textarea", placeholder: "وصف مختصر للمشروع" },
      { key: "plotNumber", label: "رقم القطعة", type: "text", placeholder: "مثال: 6185392" },
      { key: "areaCode", label: "كود المنطقة", type: "text", placeholder: "مثال: Jadaf, Nas-R, Maj-M" },
      { key: "driveFolderId", label: "معرّف مجلد Drive", type: "text", placeholder: "معرّف مجلد Google Drive للمشروع" },
      { key: "bua", label: "مساحة البناء (قدم²)", type: "number", placeholder: "مثال: 105000" },
      { key: "pricePerSqft", label: "سعر القدم المربع (AED)", type: "number", placeholder: "مثال: 350" },
    ]
  },
  {
    id: "identification",
    title: "أرقام التعريف",
    icon: Hash,
    color: "from-violet-500 to-purple-600",
    fields: [
      { key: "titleDeedNumber", label: "رقم سند الملكية", type: "text", placeholder: "مثال: 437 الجداف" },
      { key: "ddaNumber", label: "رقم DDA", type: "text", placeholder: "مثال: 326-0885" },
      { key: "masterDevRef", label: "الرقم المرجعي للمطور الرئيسي", type: "text", placeholder: "مثال: CV-P1-A-15" },
    ]
  },
  {
    id: "areas",
    title: "المساحات",
    icon: Ruler,
    color: "from-emerald-500 to-green-600",
    fields: [
      { key: "plotAreaSqm", label: "مساحة الأرض (م²)", type: "text", placeholder: "مثال: 1,136.05" },
      { key: "plotAreaSqft", label: "مساحة الأرض (قدم²)", type: "text", placeholder: "مثال: 12,228.34" },
      { key: "gfaSqm", label: "المساحة الإجمالية GFA (م²)", type: "text", placeholder: "مثال: 4,698.11" },
      { key: "gfaSqft", label: "المساحة الإجمالية GFA (قدم²)", type: "text", placeholder: "مثال: 50,570.04" },
    ]
  },
  {
    id: "usage",
    title: "الاستخدام والملكية",
    icon: HomeIcon,
    color: "from-cyan-500 to-teal-600",
    fields: [
      { key: "permittedUse", label: "الاستخدام المسموح", type: "text", placeholder: "مثال: سكني - شقق (Residential: Apartment)" },
      { key: "ownershipType", label: "نوع الملكية", type: "text", placeholder: "مثال: ملكية فردية" },
      { key: "subdivisionRestrictions", label: "قيود التجزئة", type: "textarea", placeholder: "قيود التجزئة إن وجدت" },
    ]
  },
  {
    id: "parties",
    title: "الأطراف الرئيسية",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    fields: [
      { key: "masterDevName", label: "اسم المطور الرئيسي", type: "text", placeholder: "مثال: JADDAF WATERFRONT LLC" },
      { key: "masterDevAddress", label: "عنوان المطور", type: "text", placeholder: "مثال: P.O. Box 500272, Dubai, UAE" },
      { key: "sellerName", label: "اسم البائع", type: "text", placeholder: "اسم البائع (المالك السابق)" },
      { key: "sellerAddress", label: "عنوان البائع", type: "text", placeholder: "عنوان البائع" },
      { key: "buyerName", label: "اسم المشتري", type: "text", placeholder: "اسم المشتري (المالك الحالي)" },
      { key: "buyerNationality", label: "جنسية المشتري", type: "text", placeholder: "الجنسية" },
      { key: "buyerPassport", label: "رقم جواز المشتري", type: "text", placeholder: "رقم الجواز" },
      { key: "buyerAddress", label: "عنوان المشتري", type: "text", placeholder: "العنوان" },
      { key: "buyerPhone", label: "هاتف المشتري", type: "text", placeholder: "رقم الهاتف" },
      { key: "buyerEmail", label: "بريد المشتري", type: "text", placeholder: "البريد الإلكتروني" },
    ]
  },
  {
    id: "infrastructure",
    title: "البنية التحتية",
    icon: Zap,
    color: "from-yellow-500 to-amber-600",
    fields: [
      { key: "electricityAllocation", label: "تخصيص الكهرباء", type: "text", placeholder: "مثال: 1,061.97 كيلوواط" },
      { key: "waterAllocation", label: "تخصيص المياه", type: "text", placeholder: "مثال: 34.13 م³/يوم" },
      { key: "sewageAllocation", label: "تخصيص الصرف الصحي", type: "text", placeholder: "مثال: 31.86 م³/يوم" },
      { key: "tripAM", label: "حركة مرور صباحاً (AM)", type: "text", placeholder: "مثال: 27 مركبة" },
      { key: "tripLT", label: "حركة مرور نهاراً (LT)", type: "text", placeholder: "مثال: 18 مركبة" },
      { key: "tripPM", label: "حركة مرور مساءً (PM)", type: "text", placeholder: "مثال: 24 مركبة" },
    ]
  },
  {
    id: "timeline",
    title: "الجدول الزمني",
    icon: Calendar,
    color: "from-rose-500 to-pink-600",
    fields: [
      { key: "effectiveDate", label: "تاريخ السريان", type: "text", placeholder: "مثال: 15 مارس 2024" },
      { key: "constructionPeriod", label: "فترة البناء الإجمالية", type: "text", placeholder: "مثال: 3 سنوات من تاريخ بدء الإنشاء" },
      { key: "constructionStartDate", label: "تاريخ بدء الإنشاء", type: "text", placeholder: "التاريخ أو الشروط" },
      { key: "completionDate", label: "تاريخ الإنجاز", type: "text", placeholder: "التاريخ المتوقع" },
      { key: "constructionConditions", label: "شروط بدء الإنشاء", type: "textarea", placeholder: "الشروط المطلوبة قبل بدء الإنشاء" },
    ]
  },
  {
    id: "restrictions",
    title: "الالتزامات والقيود",
    icon: Shield,
    color: "from-red-500 to-rose-600",
    fields: [
      { key: "saleRestrictions", label: "قيود البيع والتصرف", type: "textarea", placeholder: "قيود البيع" },
      { key: "resaleConditions", label: "شروط إعادة البيع", type: "textarea", placeholder: "شروط إعادة البيع المستقبلية" },
      { key: "communityCharges", label: "رسوم المجتمع", type: "textarea", placeholder: "رسوم المجتمع والخدمات" },
    ]
  },
  {
    id: "registration",
    title: "المستندات والتسجيل",
    icon: Landmark,
    color: "from-slate-500 to-gray-600",
    fields: [
      { key: "registrationAuthority", label: "جهة التسجيل", type: "text", placeholder: "مثال: دائرة الأراضي والأملاك في دبي" },
      { key: "adminFee", label: "رسوم إدارية (AED)", type: "number", placeholder: "مثال: 10000" },
      { key: "clearanceFee", label: "رسوم شهادة التخليص (AED)", type: "number", placeholder: "مثال: 500" },
      { key: "compensationAmount", label: "مبلغ التعويض (AED)", type: "number", placeholder: "مثال: 1000000" },
    ]
  },
  {
    id: "legal",
    title: "القانون الحاكم",
    icon: Gavel,
    color: "from-indigo-500 to-blue-600",
    fields: [
      { key: "governingLaw", label: "القانون الساري", type: "textarea", placeholder: "القانون الحاكم للعقد" },
      { key: "disputeResolution", label: "تسوية النزاعات", type: "textarea", placeholder: "آلية تسوية النزاعات" },
    ]
  },
  {
    id: "notes",
    title: "ملاحظات",
    icon: FileText,
    color: "from-stone-500 to-stone-600",
    fields: [
      { key: "notes", label: "ملاحظات عامة", type: "textarea", placeholder: "ملاحظات إضافية عن المشروع" },
    ]
  },
];

function ProjectForm({ project, onSave, onCancel, saving }: {
  project?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["basic"]));

  useEffect(() => {
    if (project) {
      setForm({ ...project });
      const expanded = new Set(["basic"]);
      FIELD_GROUPS.forEach(g => {
        if (g.fields.some(f => project[f.key])) expanded.add(g.id);
      });
      setExpandedGroups(expanded);
    } else {
      setForm({});
      setExpandedGroups(new Set(["basic"]));
    }
  }, [project]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      toast.error("اسم المشروع مطلوب");
      return;
    }
    const data = { ...form };
    ["bua", "pricePerSqft", "adminFee", "clearanceFee", "compensationAmount"].forEach(k => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") {
        data[k] = Number(data[k]);
      } else {
        delete data[k];
      }
    });
    onSave(data);
  };

  const filledCount = (groupId: string) => {
    const group = FIELD_GROUPS.find(g => g.id === groupId);
    if (!group) return 0;
    return group.fields.filter(f => form[f.key]).length;
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      {FIELD_GROUPS.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        const filled = filledCount(group.id);
        const total = group.fields.length;
        const Icon = group.icon;

        return (
          <div key={group.id} className="border border-border/60 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${group.color} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sm">{group.title}</span>
                {filled > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filled}/{total}
                  </Badge>
                )}
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map(field => (
                  <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {field.label}
                      {field.required && <span className="text-red-500 mr-1">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <Textarea
                        value={form[field.key] ?? ""}
                        onChange={e => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-sm min-h-[80px]"
                      />
                    ) : (
                      <Input
                        type={field.type === "number" ? "number" : "text"}
                        value={form[field.key] ?? ""}
                        onChange={e => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 pt-4 sticky bottom-0 bg-background pb-2">
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {project ? "حفظ التعديلات" : "إنشاء المشروع"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}

export default function ProjectManagementPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const projectsQuery = trpc.projects.listWithStats.useQuery(undefined, { enabled: isAuthenticated });
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المشروع بنجاح");
      projectsQuery.refetch();
      setShowCreateDialog(false);
    },
    onError: (err) => toast.error("خطأ: " + err.message),
  });
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المشروع بنجاح");
      projectsQuery.refetch();
      setEditingProject(null);
    },
    onError: (err) => toast.error("خطأ: " + err.message),
  });
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المشروع");
      projectsQuery.refetch();
      setDeletingId(null);
    },
    onError: (err) => toast.error("خطأ: " + err.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const projects = projectsQuery.data || [];

  const totalCost = (p: any) => {
    if (p.bua && p.pricePerSqft) return (p.bua * p.pricePerSqft).toLocaleString();
    return null;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/20"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              الرئيسية
            </Button>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              <span className="text-lg font-bold">إدارة المشاريع</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-300 text-sm">{user?.name}</span>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4" />
                  مشروع جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-right flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-600" />
                    إنشاء مشروع جديد
                  </DialogTitle>
                </DialogHeader>
                <ProjectForm
                  onSave={(data) => createMutation.mutate(data)}
                  onCancel={() => setShowCreateDialog(false)}
                  saving={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{projects.length}</div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي المشاريع</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {projects.filter((p: any) => p.driveFolderId).length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">مربوطة بـ Drive</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {projects.filter((p: any) => p.factSheetCompleteness?.percentage > 0).length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">فاكت شيت (جزئي+)</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">
                {projects.reduce((sum: number, p: any) => sum + (p.consultantCount || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي الاستشاريين</div>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        {projectsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد مشاريع بعد</h3>
              <p className="text-muted-foreground text-sm mb-4">أنشئ مشروعك الأول لبدء إدارة بيانات الفاكت شيت</p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                إنشاء مشروع جديد
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project: any) => (
              <Card key={project.id} className="border-border/50 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="p-5">
                  {/* Project Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex items-start gap-3 flex-1 cursor-pointer"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-sm shrink-0">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-base group-hover:text-blue-700 transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {project.areaCode && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {project.areaCode}
                            </span>
                          )}
                          {project.plotNumber && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" /> {project.plotNumber}
                            </span>
                          )}
                          {project.driveFolderId && (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">
                              <FolderOpen className="w-3 h-3 ml-1" /> Drive
                            </Badge>
                          )}
                          {project.consultantCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                              <Users className="w-3 h-3 ml-1" /> {project.consultantCount} استشاري
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/project/${project.id}`)}
                        className="text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingProject(project)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeletingId(project.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="flex gap-3 mt-3 flex-wrap items-center">
                    {/* Fact Sheet Progress */}
                    {project.factSheetCompleteness && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2 min-w-[160px]">
                        <div className="text-[10px] text-muted-foreground mb-1">الفاكت شيت</div>
                        <div className="flex items-center gap-2">
                          <Progress value={project.factSheetCompleteness.percentage} className="h-1.5 flex-1" />
                          <span className="text-xs font-bold">{project.factSheetCompleteness.percentage}%</span>
                        </div>
                      </div>
                    )}

                    {project.bua && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2 text-center min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground">مساحة البناء</div>
                        <div className="font-bold text-xs">{Number(project.bua).toLocaleString()} قدم²</div>
                      </div>
                    )}
                    {project.pricePerSqft && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2 text-center min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground">سعر القدم</div>
                        <div className="font-bold text-xs">{Number(project.pricePerSqft).toLocaleString()} AED</div>
                      </div>
                    )}
                    {totalCost(project) && (
                      <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center min-w-[120px] border border-emerald-200">
                        <div className="text-[10px] text-emerald-600">إجمالي التكلفة</div>
                        <div className="font-bold text-xs text-emerald-700">{totalCost(project)} AED</div>
                      </div>
                    )}

                    {/* Consultant names */}
                    {project.consultantNames && project.consultantNames.length > 0 && (
                      <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 flex-1 min-w-[200px]">
                        <div className="text-[10px] text-amber-600 mb-0.5">الاستشاريين</div>
                        <div className="text-xs font-medium text-amber-800 truncate">
                          {project.consultantNames.join(" · ")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              تعديل المشروع: {editingProject?.name}
            </DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={editingProject}
            onSave={(data) => updateMutation.mutate({ id: editingProject.id, ...data })}
            onCancel={() => setEditingProject(null)}
            saving={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع البيانات المرتبطة به بشكل نهائي.
          </p>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              حذف المشروع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
