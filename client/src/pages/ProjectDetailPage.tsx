import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation, useRoute } from "wouter";
import { useMemo } from "react";
import {
  ArrowRight, Building2, MapPin, FileText, Users, Zap, Calendar,
  Shield, Loader2, FolderOpen, Hash, Ruler, Home as HomeIcon, User,
  Phone, Mail, Globe, Landmark, Clock, Gavel, ExternalLink, Pencil,
  DollarSign, BarChart3, CheckCircle2, AlertCircle, Percent
} from "lucide-react";

// Fact Sheet field groups - mirrors the database schema sections
const FIELD_GROUPS = [
  {
    id: "identification",
    title: "أرقام التعريف",
    titleEn: "Identification Numbers",
    icon: Hash,
    color: "from-violet-500 to-purple-600",
    fields: [
      { key: "titleDeedNumber", label: "رقم سند الملكية", labelEn: "Title Deed Number" },
      { key: "ddaNumber", label: "رقم DDA", labelEn: "DDA Number" },
      { key: "masterDevRef", label: "الرقم المرجعي للمطور الرئيسي", labelEn: "Master Developer Ref" },
    ]
  },
  {
    id: "areas",
    title: "المساحات",
    titleEn: "Areas",
    icon: Ruler,
    color: "from-emerald-500 to-green-600",
    fields: [
      { key: "plotAreaSqm", label: "مساحة الأرض (م²)", labelEn: "Plot Area (sqm)" },
      { key: "plotAreaSqft", label: "مساحة الأرض (قدم²)", labelEn: "Plot Area (sqft)" },
      { key: "gfaSqm", label: "المساحة الإجمالية GFA (م²)", labelEn: "GFA (sqm)" },
      { key: "gfaSqft", label: "المساحة الإجمالية GFA (قدم²)", labelEn: "GFA (sqft)" },
    ]
  },
  {
    id: "usage",
    title: "الاستخدام والملكية",
    titleEn: "Usage & Ownership",
    icon: HomeIcon,
    color: "from-cyan-500 to-teal-600",
    fields: [
      { key: "permittedUse", label: "الاستخدام المسموح", labelEn: "Permitted Use" },
      { key: "ownershipType", label: "نوع الملكية", labelEn: "Ownership Type" },
      { key: "subdivisionRestrictions", label: "قيود التجزئة", labelEn: "Subdivision Restrictions", long: true },
    ]
  },
  {
    id: "parties",
    title: "الأطراف الرئيسية",
    titleEn: "Key Parties",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    fields: [
      { key: "masterDevName", label: "اسم المطور الرئيسي", labelEn: "Master Developer" },
      { key: "masterDevAddress", label: "عنوان المطور", labelEn: "Developer Address", long: true },
      { key: "sellerName", label: "اسم البائع", labelEn: "Seller Name" },
      { key: "sellerAddress", label: "عنوان البائع", labelEn: "Seller Address", long: true },
      { key: "buyerName", label: "اسم المشتري", labelEn: "Buyer Name" },
      { key: "buyerNationality", label: "جنسية المشتري", labelEn: "Buyer Nationality" },
      { key: "buyerPassport", label: "رقم جواز المشتري", labelEn: "Buyer Passport" },
      { key: "buyerAddress", label: "عنوان المشتري", labelEn: "Buyer Address", long: true },
      { key: "buyerPhone", label: "هاتف المشتري", labelEn: "Buyer Phone" },
      { key: "buyerEmail", label: "بريد المشتري", labelEn: "Buyer Email" },
    ]
  },
  {
    id: "infrastructure",
    title: "البنية التحتية",
    titleEn: "Infrastructure",
    icon: Zap,
    color: "from-yellow-500 to-amber-600",
    fields: [
      { key: "electricityAllocation", label: "تخصيص الكهرباء", labelEn: "Electricity Allocation" },
      { key: "waterAllocation", label: "تخصيص المياه", labelEn: "Water Allocation" },
      { key: "sewageAllocation", label: "تخصيص الصرف الصحي", labelEn: "Sewage Allocation" },
      { key: "tripAM", label: "حركة مرور صباحاً (AM)", labelEn: "Trip AM" },
      { key: "tripLT", label: "حركة مرور نهاراً (LT)", labelEn: "Trip LT" },
      { key: "tripPM", label: "حركة مرور مساءً (PM)", labelEn: "Trip PM" },
    ]
  },
  {
    id: "timeline",
    title: "الجدول الزمني",
    titleEn: "Timeline",
    icon: Calendar,
    color: "from-rose-500 to-pink-600",
    fields: [
      { key: "effectiveDate", label: "تاريخ السريان", labelEn: "Effective Date" },
      { key: "constructionPeriod", label: "فترة البناء الإجمالية", labelEn: "Construction Period" },
      { key: "constructionStartDate", label: "تاريخ بدء الإنشاء", labelEn: "Construction Start" },
      { key: "completionDate", label: "تاريخ الإنجاز", labelEn: "Completion Date" },
      { key: "constructionConditions", label: "شروط بدء الإنشاء", labelEn: "Construction Conditions", long: true },
    ]
  },
  {
    id: "restrictions",
    title: "الالتزامات والقيود",
    titleEn: "Obligations & Restrictions",
    icon: Shield,
    color: "from-red-500 to-rose-600",
    fields: [
      { key: "saleRestrictions", label: "قيود البيع والتصرف", labelEn: "Sale Restrictions", long: true },
      { key: "resaleConditions", label: "شروط إعادة البيع", labelEn: "Resale Conditions", long: true },
      { key: "communityCharges", label: "رسوم المجتمع", labelEn: "Community Charges", long: true },
    ]
  },
  {
    id: "registration",
    title: "المستندات والتسجيل",
    titleEn: "Documents & Registration",
    icon: Landmark,
    color: "from-slate-500 to-gray-600",
    fields: [
      { key: "registrationAuthority", label: "جهة التسجيل", labelEn: "Registration Authority" },
      { key: "adminFee", label: "رسوم إدارية (AED)", labelEn: "Admin Fee (AED)" },
      { key: "clearanceFee", label: "رسوم شهادة التخليص (AED)", labelEn: "Clearance Fee (AED)" },
      { key: "compensationAmount", label: "مبلغ التعويض (AED)", labelEn: "Compensation Amount (AED)" },
    ]
  },
  {
    id: "legal",
    title: "القانون الحاكم",
    titleEn: "Governing Law",
    icon: Gavel,
    color: "from-indigo-500 to-blue-600",
    fields: [
      { key: "governingLaw", label: "القانون الساري", labelEn: "Governing Law", long: true },
      { key: "disputeResolution", label: "تسوية النزاعات", labelEn: "Dispute Resolution", long: true },
    ]
  },
];

function FieldValue({ value, placeholder }: { value: any; placeholder?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 italic text-xs">{placeholder || "لم يتم التعبئة بعد"}</span>;
  }
  // Format numbers with commas
  if (typeof value === "number") {
    return <span className="font-semibold">{value.toLocaleString()} AED</span>;
  }
  return <span className="font-medium">{value}</span>;
}

function FactSheetSection({ group, project }: { group: typeof FIELD_GROUPS[0]; project: any }) {
  const Icon = group.icon;
  const filledCount = group.fields.filter(f => {
    const v = project[f.key];
    return v !== null && v !== undefined && v !== "";
  }).length;
  const isEmpty = filledCount === 0;

  return (
    <Card className={`border-border/50 ${isEmpty ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${group.color} flex items-center justify-center shadow-sm`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">{group.title}</CardTitle>
              <span className="text-[10px] text-muted-foreground">{group.titleEn}</span>
            </div>
          </div>
          <Badge variant={filledCount === group.fields.length ? "default" : "secondary"} className="text-[10px]">
            {filledCount}/{group.fields.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {group.fields.map(field => (
            <div key={field.key} className={field.long ? "md:col-span-2" : ""}>
              <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1.5">
                {project[field.key] ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                )}
                {field.label}
              </div>
              <div className="text-sm bg-muted/30 rounded-lg px-3 py-2 min-h-[36px] flex items-center">
                <FieldValue value={project[field.key]} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsultantsPanel({ consultants, financialData }: { consultants: any[]; financialData: any[] }) {
  if (consultants.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">لا يوجد استشاريين مرتبطين</h3>
          <p className="text-xs text-muted-foreground">سيتم ربط الاستشاريين تلقائياً عند تحليل العروض بواسطة خازن</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {consultants.map((consultant: any) => {
        const fd = financialData.find((f: any) => f.consultantId === consultant.id);
        const hasFinancial = fd && (
          (fd.designValue && parseFloat(fd.designValue) > 0) ||
          (fd.supervisionValue && parseFloat(fd.supervisionValue) > 0)
        );

        return (
          <Card key={consultant.id} className="border-border/50 hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {consultant.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{consultant.name}</h4>
                    {consultant.specialization && (
                      <span className="text-xs text-muted-foreground">{consultant.specialization}</span>
                    )}
                  </div>
                </div>
                {hasFinancial ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    <DollarSign className="w-3 h-3 ml-0.5" />
                    بيانات مالية
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    بدون بيانات مالية
                  </Badge>
                )}
              </div>

              {hasFinancial && fd && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-blue-600 mb-0.5 flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        أتعاب التصميم
                      </div>
                      <div className="font-bold text-sm text-blue-800">
                        {fd.designType === "pct" ? (
                          <span className="flex items-center gap-1">
                            {parseFloat(fd.designValue).toFixed(1)}
                            <Percent className="w-3 h-3" />
                          </span>
                        ) : (
                          <span>{parseFloat(fd.designValue).toLocaleString()} AED</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-amber-600 mb-0.5 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        أتعاب الإشراف
                      </div>
                      <div className="font-bold text-sm text-amber-800">
                        {fd.supervisionType === "pct" ? (
                          <span className="flex items-center gap-1">
                            {parseFloat(fd.supervisionValue).toFixed(1)}
                            <Percent className="w-3 h-3" />
                          </span>
                        ) : (
                          <span>{parseFloat(fd.supervisionValue).toLocaleString()} AED</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {fd.proposalLink && (
                    <a href={fd.proposalLink} target="_blank" rel="noopener noreferrer"
                      className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      رابط العرض
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/project/:id");
  const projectId = params?.id ? parseInt(params.id) : null;

  const projectQuery = trpc.projects.getWithDetails.useQuery(
    projectId!,
    { enabled: isAuthenticated && projectId !== null }
  );

  const project = projectQuery.data;

  // Calculate overall completeness
  const completeness = useMemo(() => {
    if (!project) return { filled: 0, total: 0, percentage: 0 };
    return project.factSheetCompleteness || { filled: 0, total: 0, percentage: 0 };
  }, [project]);

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

  if (projectQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">المشروع غير موجود</h2>
        <Button onClick={() => navigate("/project-management")} variant="outline">
          <ArrowRight className="w-4 h-4 ml-1" />
          العودة لإدارة المشاريع
        </Button>
      </div>
    );
  }

  const totalCost = project.bua && project.pricePerSqft
    ? (project.bua * project.pricePerSqft).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/project-management")}
              className="text-white hover:bg-white/20"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              إدارة المشاريع
            </Button>
            <Separator orientation="vertical" className="h-5 bg-white/20" />
            <span className="text-stone-400 text-sm">تفاصيل المشروع</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                {project.areaCode && (
                  <span className="text-stone-300 text-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {project.areaCode}
                  </span>
                )}
                {project.plotNumber && (
                  <span className="text-stone-300 text-sm flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" /> قطعة {project.plotNumber}
                  </span>
                )}
                {project.driveFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${project.driveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 text-sm flex items-center gap-1 hover:text-emerald-200 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Google Drive
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/project-management")}
              className="bg-white/10 hover:bg-white/20 text-white gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              تعديل
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Fact Sheet Completeness */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground">اكتمال الفاكت شيت</div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{completeness.percentage}%</span>
                  <Progress value={completeness.percentage} className="h-1.5 flex-1" />
                </div>
                <div className="text-[10px] text-muted-foreground">{completeness.filled}/{completeness.total} حقل</div>
              </div>
            </div>

            {/* Consultants */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">الاستشاريين</div>
                <div className="font-bold text-lg">{project.consultants?.length || 0}</div>
              </div>
            </div>

            {/* BUA */}
            {project.bua && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Ruler className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">مساحة البناء</div>
                  <div className="font-bold text-sm">{Number(project.bua).toLocaleString()} قدم²</div>
                </div>
              </div>
            )}

            {/* Price per sqft */}
            {project.pricePerSqft && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">سعر القدم</div>
                  <div className="font-bold text-sm">{Number(project.pricePerSqft).toLocaleString()} AED</div>
                </div>
              </div>
            )}

            {/* Total Cost */}
            {totalCost && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">إجمالي التكلفة</div>
                  <div className="font-bold text-sm">{totalCost} AED</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="factsheet" dir="rtl">
          <TabsList className="mb-6 bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="factsheet" className="gap-1.5 text-sm">
              <FileText className="w-4 h-4" />
              الفاكت شيت
            </TabsTrigger>
            <TabsTrigger value="consultants" className="gap-1.5 text-sm">
              <Users className="w-4 h-4" />
              الاستشاريين ({project.consultants?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5 text-sm">
              <DollarSign className="w-4 h-4" />
              البيانات المالية
            </TabsTrigger>
          </TabsList>

          {/* Fact Sheet Tab */}
          <TabsContent value="factsheet">
            {project.description && (
              <Card className="mb-6 border-border/50">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">وصف المشروع</div>
                  <p className="text-sm leading-relaxed">{project.description}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {FIELD_GROUPS.map(group => (
                <FactSheetSection key={group.id} group={group} project={project} />
              ))}
            </div>

            {project.notes && (
              <Card className="mt-4 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-500" />
                    ملاحظات عامة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Consultants Tab */}
          <TabsContent value="consultants">
            <ConsultantsPanel
              consultants={project.consultants || []}
              financialData={project.financialData || []}
            />
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial">
            {(!project.financialData || project.financialData.length === 0) ? (
              <Card className="border-dashed border-2">
                <CardContent className="p-8 text-center">
                  <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">لا توجد بيانات مالية</h3>
                  <p className="text-xs text-muted-foreground">
                    اطلب من خازن استخراج الأتعاب من العروض: "خازن، استخرج أتعاب استشاريي {project.name}"
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Summary Table */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      ملخص الأتعاب
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">الاستشاري</th>
                            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">نوع التصميم</th>
                            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">أتعاب التصميم</th>
                            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">نوع الإشراف</th>
                            <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">أتعاب الإشراف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.financialData.map((fd: any) => (
                            <tr key={fd.id} className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-2.5 px-3 font-medium">{fd.consultantName}</td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant="secondary" className="text-[10px]">
                                  {fd.designType === "pct" ? "نسبة %" : "مبلغ مقطوع"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold">
                                {fd.designValue && parseFloat(fd.designValue) > 0 ? (
                                  fd.designType === "pct"
                                    ? `${parseFloat(fd.designValue).toFixed(1)}%`
                                    : `${parseFloat(fd.designValue).toLocaleString()} AED`
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant="secondary" className="text-[10px]">
                                  {fd.supervisionType === "pct" ? "نسبة %" : "مبلغ مقطوع"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold">
                                {fd.supervisionValue && parseFloat(fd.supervisionValue) > 0 ? (
                                  fd.supervisionType === "pct"
                                    ? `${parseFloat(fd.supervisionValue).toFixed(1)}%`
                                    : `${parseFloat(fd.supervisionValue).toLocaleString()} AED`
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
