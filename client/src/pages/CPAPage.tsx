/**
 * CPA -- Consultant Proposal Analysis
 * تحليل عروض الاستشاريين
 *
 * 6 screens:
 *  1. Project list (home)
 *  2. Project detail + consultant list
 *  3. Import JSON for a consultant
 *  4. Scope coverage review
 *  5. Evaluation results & ranking
 *  6. Settings (admin)
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { ScopeMatrixTable, ReferenceCostsTable, SupervisionBaselineTable } from "./CPASettingsMatrices";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Plus,
  FileJson,
  BarChart3,
  Settings,
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  Trophy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Home,
  Calculator,
  Shield,
  Layers,
  Loader2,
  Copy,
  MessageSquare,
} from "lucide-react";

// ---- Types ----------------------------------------------------------------

type Screen =
  | "home"
  | "project-detail"
  | "import-json"
  | "scope-review"
  | "results"
  | "settings";

// ---- Helpers ---------------------------------------------------------------

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "--";
  return new Intl.NumberFormat("ar-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtAED(n: number | null | undefined): string {
  if (n === null || n === undefined) return "--";
  return `AED ${fmt(n)}`;
}

// ---- Sub-components -------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "مسودة", className: "bg-gray-100 text-gray-700" },
    CONFIRMED: { label: "مؤكد", className: "bg-blue-100 text-blue-700" },
    EVALUATED: { label: "مُقيَّم", className: "bg-emerald-100 text-emerald-700" },
    ACTIVE: { label: "نشط", className: "bg-emerald-100 text-emerald-700" },
    COMPLETED: { label: "مكتمل", className: "bg-gray-100 text-gray-700" },
    CANCELLED: { label: "ملغى", className: "bg-red-100 text-red-700" },
  };
  const info = map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return <span className="text-muted-foreground text-xs">غير مرتب</span>;
  const colors = ["bg-yellow-400 text-yellow-900", "bg-gray-300 text-gray-800", "bg-amber-600 text-white"];
  const icons = ["🥇", "🥈", "🥉"];
  const cls = colors[rank - 1] ?? "bg-blue-100 text-blue-800";
  const icon = icons[rank - 1] ?? `#${rank}`;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {icon} المركز {rank}
    </span>
  );
}

// ---- Screen 1: Project List -----------------------------------------------

function ProjectListScreen({
  onSelectProject,
  onSettings,
}: {
  onSelectProject: (id: number) => void;
  onSettings: () => void;
}) {
  const { toast } = useToast();
  const projectsQuery = trpc.cpa.projects.list.useQuery();
  const sysProjectsQuery = trpc.cpa.getSystemProjects.useQuery();
  const categoriesQuery = trpc.cpa.settings.getBuildingCategories.useQuery();
  const createMutation = trpc.cpa.projects.create.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setShowCreate(false);
      toast({ title: "تم إنشاء المشروع بنجاح" });
    },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    plotNumber: "",
    location: "",
    projectType: "RESIDENTIAL",
    buaSqft: "",
    buildingCategoryId: "",
    constructionCostPerSqft: "",
    durationMonths: "",
    description: "",
  });

  const projects = projectsQuery.data ?? [];
  const sysProjects = sysProjectsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  // Map permittedUse text to project type enum
  function detectProjectType(permittedUse: string | null | undefined): string {
    if (!permittedUse) return "RESIDENTIAL";
    const u = permittedUse.toLowerCase();
    if (u.includes("تجار") || u.includes("commercial") || u.includes("retail") || u.includes("مكاتب") || u.includes("office")) return "COMMERCIAL";
    if (u.includes("متعدد") || u.includes("mixed") || u.includes("سكني تجاري")) return "MIXED_USE";
    if (u.includes("سكن") || u.includes("residential") || u.includes("villa") || u.includes("فيلا")) return "RESIDENTIAL";
    return "RESIDENTIAL";
  }

  // Auto-detect building category from BUA
  function detectCategoryFromBUA(buaStr: string): string {
    const bua = Number(buaStr);
    if (!bua || !categories.length) return "";
    const match = (categories as any[]).find((c) => {
      const minOk = c.bua_min_sqft == null || bua >= Number(c.bua_min_sqft);
      const maxOk = c.bua_max_sqft == null || bua <= Number(c.bua_max_sqft);
      return minOk && maxOk && c.is_active;
    });
    return match ? String(match.id) : "";
  }

  function handleCreate() {
    if (!form.projectId || !form.plotNumber || !form.buaSqft || !form.constructionCostPerSqft || !form.durationMonths) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      projectId: Number(form.projectId),
      plotNumber: form.plotNumber,
      location: form.location || undefined,
      projectType: form.projectType as any,
      description: form.description || undefined,
      buaSqft: Number(form.buaSqft),
      buildingCategoryId: form.buildingCategoryId ? Number(form.buildingCategoryId) : undefined,
      constructionCostPerSqft: Number(form.constructionCostPerSqft),
      durationMonths: Number(form.durationMonths),
    });
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f4c75 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="relative px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)" }}>
                <Calculator className="w-7 h-7 text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">التحليل المالي لعروض الاستشاريين</h1>
                <p className="text-sky-300 text-sm mt-0.5">حساب التكلفة الحقيقية الإجمالية لكل استشاري</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSettings}
                className="border-white/20 text-white hover:bg-white/10 bg-transparent"
              >
                <Settings className="w-4 h-4 ml-1" />
                الإعدادات
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                className="bg-sky-500 hover:bg-sky-400 text-white border-0"
              >
                <Plus className="w-4 h-4 ml-1" />
                مشروع جديد
              </Button>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: "إجمالي المشاريع", value: projects.length },
              { label: "مشاريع نشطة", value: projects.filter((p: any) => p.status === "ACTIVE").length },
              { label: "إجمالي الاستشاريين", value: projects.reduce((s: number, p: any) => s + (p.consultant_count ?? 0), 0) },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-sky-300 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Cards */}
      {projectsQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Calculator className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد مشاريع تحليل بعد</p>
          <p className="text-muted-foreground/60 text-sm mt-1">ابدأ بإنشاء مشروع تحليل جديد</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 ml-1" />
            إنشاء مشروع
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project: any) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="w-full text-right group"
            >
              <Card className="hover:shadow-md transition-all hover:border-sky-300 cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={project.status ?? "ACTIVE"} />
                        {project.category_label && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {project.category_label}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-foreground group-hover:text-sky-600 transition-colors">
                        {project.project_name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        قطعة: {project.plot_number}
                        {project.location && ` · ${project.location}`}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                      <div>
                        <div className="text-sm font-bold text-foreground">{fmt(project.bua_sqft)}</div>
                        <div className="text-[10px] text-muted-foreground">BUA (قدم²)</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{fmt(project.duration_months)}</div>
                        <div className="text-[10px] text-muted-foreground">شهر إشراف</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-sky-600">{project.consultant_count ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">استشاري</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>تكلفة الإنشاء: {fmtAED(project.bua_sqft * project.construction_cost_per_sqft)}</span>
                    <span className="text-sky-600 font-medium group-hover:underline">فتح التحليل ←</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-600" />
              إنشاء مشروع تحليل جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Project selector — auto-fills all fields */}
            <div>
              <Label>المشروع *</Label>
              <Select
                value={form.projectId}
                onValueChange={(v) => {
                  const sp = (sysProjects as any[]).find((p) => String(p.id) === v);
                  if (!sp) { setForm({ ...form, projectId: v }); return; }
                  const rawBua = sp.manual_bua_sqft ?? sp.gfa_sqft ?? sp.bua ?? "";
                  const buaStr = rawBua ? String(Math.round(Number(rawBua))) : "";
                  const detectedCatId = detectCategoryFromBUA(buaStr);
                  const detectedCat = (categories as any[]).find((c) => String(c.id) === detectedCatId);
                  const durationFromCat = detectedCat?.supervision_duration_months
                    ? String(detectedCat.supervision_duration_months)
                    : "";
                  const constructionCost = sp.construction_cost_per_sqft ? String(Math.round(Number(sp.construction_cost_per_sqft))) : "";
                  setForm({
                    ...form,
                    projectId: v,
                    plotNumber: sp.plot_number ?? "",
                    location: sp.area_code ?? "",
                    buaSqft: buaStr,
                    constructionCostPerSqft: constructionCost,
                    buildingCategoryId: detectedCatId,
                    durationMonths: durationFromCat,
                    projectType: detectProjectType(sp.permitted_use),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر مشروعاً من النظام..." />
                </SelectTrigger>
                <SelectContent>
                  {sysProjects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} {p.plot_number ? `(${p.plot_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-filled summary — shown after project selected */}
            {form.projectId && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2 text-sm">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  تم سحب البيانات تلقائياً من بطاقة المشروع
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">رقم القطعة: </span><strong>{form.plotNumber || "—"}</strong></div>
                  <div><span className="text-muted-foreground">الموقع: </span><strong>{form.location || "—"}</strong></div>
                  <div><span className="text-muted-foreground">BUA: </span><strong>{form.buaSqft ? Number(form.buaSqft).toLocaleString() + " قدم²" : "—"}</strong></div>
                  <div><span className="text-muted-foreground">تكلفة الإنشاء: </span><strong>{form.constructionCostPerSqft ? form.constructionCostPerSqft + " AED/قدم²" : "—"}</strong></div>
                  <div><span className="text-muted-foreground">الفئة: </span><strong>{(categories as any[]).find((c) => String(c.id) === form.buildingCategoryId)?.label || "—"}</strong></div>
                  <div><span className="text-muted-foreground">مدة الإشراف: </span><strong>{form.durationMonths ? form.durationMonths + " شهر" : "—"}</strong></div>
                </div>
              </div>
            )}

            {/* Editable overrides */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>BUA (قدم مربع) *</Label>
                <Input
                  type="number"
                  value={form.buaSqft}
                  onChange={(e) => {
                    const newBua = e.target.value;
                    const detectedCatId = detectCategoryFromBUA(newBua);
                    const detectedCat = (categories as any[]).find((c) => String(c.id) === detectedCatId);
                    const durationFromCat = detectedCat?.supervision_duration_months
                      ? String(detectedCat.supervision_duration_months)
                      : form.durationMonths;
                    setForm({ ...form, buaSqft: newBua, buildingCategoryId: detectedCatId || form.buildingCategoryId, durationMonths: durationFromCat });
                  }}
                  placeholder="مثال: 50000"
                />
                {form.buaSqft && (() => {
                  const detectedId = detectCategoryFromBUA(form.buaSqft);
                  const cat = (categories as any[]).find((c) => String(c.id) === detectedId);
                  return cat ? (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      الفئة: <strong>{cat.label}</strong> · الإشراف: <strong>{cat.supervision_duration_months} شهر</strong>
                    </p>
                  ) : null;
                })()}
              </div>
              <div>
                <Label>تكلفة الإنشاء / قدم² *</Label>
                <Input type="number" value={form.constructionCostPerSqft} onChange={(e) => setForm({ ...form, constructionCostPerSqft: e.target.value })} placeholder="مثال: 350" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>فئة المبنى</Label>
                <Select value={form.buildingCategoryId} onValueChange={(v) => {
                  const cat = (categories as any[]).find((c) => String(c.id) === v);
                  const dur = cat?.supervision_duration_months
                    ? String(cat.supervision_duration_months)
                    : form.durationMonths;
                  setForm({ ...form, buildingCategoryId: v, durationMonths: dur });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="تلقائي..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>مدة الإشراف (شهر)</Label>
                <Input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} placeholder="من الفئة تلقائياً" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم القطعة *</Label>
                <Input value={form.plotNumber} onChange={(e) => setForm({ ...form, plotNumber: e.target.value })} placeholder="مثال: 123-456" />
              </div>
              <div>
                <Label>الموقع</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="دبي، الإمارات" />
              </div>
            </div>
            <div>
              <Label>نوع المشروع</Label>
              <Select value={form.projectType} onValueChange={(v) => setForm({ ...form, projectType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESIDENTIAL">سكني</SelectItem>
                  <SelectItem value="COMMERCIAL">تجاري</SelectItem>
                  <SelectItem value="MIXED_USE">متعدد الاستخدامات</SelectItem>
                  <SelectItem value="OTHER">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المشروع"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Screen 2: Project Detail + Consultant List ----------------------------

function ProjectDetailScreen({
  projectId,
  onBack,
  onImportJson,
  onScopeReview,
  onResults,
}: {
  projectId: number;
  onBack: () => void;
  onImportJson: (pcId: number, consultantName: string) => void;
  onScopeReview: (pcId: number, consultantName: string) => void;
  onResults: () => void;
}) {
  const { toast } = useToast();
  const projectQuery = trpc.cpa.projects.getById.useQuery({ id: projectId });
  const consultantsQuery = trpc.cpa.consultants.listByProject.useQuery({ cpaProjectId: projectId });
  const masterQuery = trpc.cpa.settings.getConsultantsMaster.useQuery();
  const evalMutation = trpc.cpa.evaluation.runEvaluation.useMutation({
    onSuccess: (data) => {
      consultantsQuery.refetch();
      toast({ title: `تم حساب التكلفة لـ ${data.length} استشاري` });
      onResults();
    },
    onError: (e) => toast({ title: "خطأ في الحساب", description: e.message, variant: "destructive" }),
  });
  const addMutation = trpc.cpa.consultants.addConsultant.useMutation({
    onSuccess: () => { consultantsQuery.refetch(); setShowAdd(false); toast({ title: "تم إضافة الاستشاري" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const removeMutation = trpc.cpa.consultants.removeConsultant.useMutation({
    onSuccess: () => { consultantsQuery.refetch(); toast({ title: "تم حذف الاستشاري" }); },
    onError: (e) => toast({ title: "خطأ في الحذف", description: e.message, variant: "destructive" }),
  });
  const deleteProjectMutation = trpc.cpa.projects.delete.useMutation({
    onSuccess: () => { toast({ title: "تم حذف المشروع بنجاح" }); onBack(); },
    onError: (e) => toast({ title: "خطأ في الحذف", description: e.message, variant: "destructive" }),
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdd, setShowAdd] = useState(false);;
  const [selectedMasterId, setSelectedMasterId] = useState("");

  const project = projectQuery.data;
  const consultants = consultantsQuery.data ?? [];
  const masterList = masterQuery.data ?? [];
  const totalCost = project ? project.bua_sqft * project.construction_cost_per_sqft : 0;

  // Auto-run calculation when data is loaded but no results exist yet
  const [autoCalcTriggered, setAutoCalcTriggered] = useState(false);
  useEffect(() => {
    if (
      !autoCalcTriggered &&
      !consultantsQuery.isLoading &&
      !projectQuery.isLoading &&
      consultants.length > 0 &&
      !evalMutation.isPending &&
      consultants.some((c: any) => c.design_fee_method && !c.total_true_cost)
    ) {
      setAutoCalcTriggered(true);
      evalMutation.mutate({ cpaProjectId: projectId });
    }
  }, [consultantsQuery.isLoading, projectQuery.isLoading, consultants.length, autoCalcTriggered]);

  if (projectQuery.isLoading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  if (!project) return <div className="text-center py-12 text-red-500">المشروع غير موجود</div>;

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1">
          <h2 className="font-bold text-lg">{project.project_name}</h2>
          <p className="text-sm text-muted-foreground">قطعة: {project.plot_number}</p>
        </div>
         <StatusBadge status={project.status ?? "ACTIVE"} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف المشروع
        </Button>
      </div>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">تأكيد حذف المشروع</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم حذف مشروع <strong>{project.project_name}</strong> مع جميع بياناته (الاستشاريين، النتائج، الملفات المستوردة). هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>إلغاء</Button>
              <Button
                variant="destructive"
                onClick={() => { deleteProjectMutation.mutate({ id: projectId }); setShowDeleteConfirm(false); }}
                disabled={deleteProjectMutation.isPending}
              >
                {deleteProjectMutation.isPending ? "جاري الحذف..." : "حذف نهائياً"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Project Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "BUA", value: `${fmt(project.bua_sqft)} قدم²` },
          { label: "تكلفة الإنشاء", value: fmtAED(totalCost) },
          { label: "مدة الإشراف", value: `${project.duration_months} شهر` },
          { label: "فئة المبنى", value: project.category_label ?? "غير محدد" },
        ].map((s, i) => (
          <Card key={i} className="text-center">
            <CardContent className="p-3">
              <div className="font-bold text-sm text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Consultants Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              الاستشاريون ({consultants.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                onClick={() => {
                  const catLabel = project.category_label ?? "غير محدد";
                  const totalCostFmt = (project.bua_sqft * project.construction_cost_per_sqft).toLocaleString("en-US", { maximumFractionDigits: 0 });
                  const consultantList = consultants.map((c: any, i: number) => `${i + 1}. ${c.trade_name ?? c.legal_name} (consultant_code: "${c.consultant_code}")`).join("\n");
                  const scopeItems = [
                    "29. Green Building / Sustainability",
                    "30. 3rd Party Structural Audit",
                    "31. Security Design / SIRA",
                    "32. Vertical Transportation",
                    "33. BMU — Facade Maintenance",
                    "34. Facade Engineering",
                    "35. Wind Tunnel Study",
                    "36. AV & ELV Design",
                    "37. FLS Specialist",
                    "38. Facade Lighting",
                    "39. Traffic Impact Study (TIS)",
                    "40. Acoustic & Vibration",
                    "41. LEED Certification",
                    "42. Cost Management",
                    "43. Value Engineering",
                  ].join("\n");
                  const msg = `طلب قراءة عروض استشارية — نظام كومو للتقييم المالي

بيانات المشروع:
- اسم المشروع: ${project.project_name}
- رقم القطعة: ${project.plot_number ?? "—"}
- فئة المبنى: ${catLabel}
- المساحة الإجمالية (BUA): ${Number(project.bua_sqft).toLocaleString("en-US")} قدم²
- تكلفة الإنشاء الإجمالية: AED ${totalCostFmt}
- مدة المشروع: ${project.duration_months} شهر

الاستشاريون المطلوب تقييمهم:
${consultantList}

المطلوب:
لكل استشاري من القائمة أعلاه، اقرأ عرضه وأرجع ملف JSON بالتنسيق التالي:

{
  "consultant_code": "كود_الاستشاري",
  "proposal_date": "YYYY-MM-DD",
  "proposal_reference": "رقم المرجع",
  "design_fee": {
    "method": "LUMP_SUM أو PERCENTAGE أو MONTHLY_RATE",
    "amount": 0,
    "percentage": null
  },
  "supervision_fee": {
    "submitted": true,
    "method": "LUMP_SUM أو PERCENTAGE أو MONTHLY_RATE",
    "amount": 0,
    "stated_duration_months": ${project.duration_months}
  },
  "scope_coverage": [
    { "item_number": 29, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 30, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 31, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 32, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 33, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 34, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 35, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 36, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 37, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 38, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 39, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 40, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 41, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 42, "status": "INCLUDED أو EXCLUDED" },
    { "item_number": 43, "status": "INCLUDED أو EXCLUDED" }
  ]
}

قائمة البنود المتخصصة للمراجعة:
${scopeItems}

ملاحظات:
- status = INCLUDED: الاستشاري يشمل هذا البند في عرضه
- status = EXCLUDED: الاستشاري استثنى هذا البند أو لم يذكره
- إذا لم يقدم الاستشاري عرض إشراف: supervision_fee.submitted = false
- لا تحسب أي أرقام — فقط استخرج البيانات من العرض كما هي`;
                  navigator.clipboard.writeText(msg).then(() => {
                    toast({ title: "✅ تم نسخ الطلب", description: "الصقه في Claude الآن" });
                  });
                }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                نسخ طلب Claude
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5 ml-1" />
                إضافة
              </Button>
              {consultants.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => evalMutation.mutate({ cpaProjectId: projectId })}
                  disabled={evalMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 min-w-[160px]"
                >
                  {evalMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
                      جاري الحساب...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-3.5 h-3.5 ml-1" />
                      احسب التكلفة الحقيقية
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {consultants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>لا يوجد استشاريون. أضف استشاريين للبدء.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultants.map((c: any) => (
                <div key={c.id} className="border border-border rounded-xl p-4 hover:border-sky-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{c.trade_name || c.legal_name}</span>
                        <StatusBadge status={c.status ?? "DRAFT"} />
                        {c.result_rank && <RankBadge rank={c.result_rank} />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.consultant_code}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      <Button size="sm" variant="outline" onClick={() => onImportJson(c.id, c.trade_name || c.legal_name)}>
                        <FileJson className="w-3.5 h-3.5 ml-1" />
                        JSON
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onScopeReview(c.id, c.trade_name || c.legal_name)}>
                        <Eye className="w-3.5 h-3.5 ml-1" />
                        النطاق
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("هل تريد حذف هذا الاستشاري من المشروع؟")) {
                            removeMutation.mutate({ id: c.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {/* Fee summary */}
                  {(c.quoted_design_fee || c.total_true_cost) && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">أتعاب التصميم المقتبسة</span>
                        <div className="font-semibold mt-0.5">{fmtAED(c.quoted_design_fee)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">فجوة النطاق</span>
                        <div className="font-semibold mt-0.5 text-orange-600">{fmtAED(c.design_scope_gap_cost)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">التكلفة الحقيقية الإجمالية</span>
                        <div className="font-bold mt-0.5 text-sky-700">{fmtAED(c.total_true_cost)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Button */}
      {consultants.some((c: any) => c.result_rank) && (
        <Button className="w-full bg-sky-600 hover:bg-sky-500 text-white" onClick={onResults}>
          <BarChart3 className="w-4 h-4 ml-2" />
          عرض نتائج التقييم والترتيب
        </Button>
      )}

      {/* Add Consultant Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة استشاري للمشروع</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>اختر الاستشاري</Label>
              <Select value={selectedMasterId} onValueChange={setSelectedMasterId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر من القائمة الرئيسية..." />
                </SelectTrigger>
                <SelectContent>
                  {masterList.map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.trade_name || m.legal_name} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!selectedMasterId || addMutation.isPending}
                onClick={() => addMutation.mutate({ cpaProjectId: projectId, consultantId: Number(selectedMasterId) })}
              >
                إضافة
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Screen 3: Import JSON ------------------------------------------------

function ImportJsonScreen({
  projectConsultantId,
  cpaProjectId,
  consultantName,
  onBack,
}: {
  projectConsultantId: number;
  cpaProjectId: number;
  consultantName: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    if (!file.name.endsWith(".json")) {
      toast({ title: "الملف غير صالح", description: "يرجى اختيار ملف JSON فقط", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        JSON.parse(text); // validate
        setJsonText(text);
        setFileName(file.name);
        toast({ title: "تم تحميل الملف", description: file.name });
      } catch {
        toast({ title: "ملف JSON غير صالح", description: "تأكد من صحة تنسيق الملف", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  const [importSummary, setImportSummary] = useState<null | {
    scopeIncluded: number;
    scopeExcluded: number;
    scopeNotMentioned: number;
    scopeTotal: number;
    supervisionRolesImported: number;
  }>(null);

  const importMutation = trpc.cpa.consultants.importJson.useMutation({
    onSuccess: (data) => {
      setJsonText("");
      setFileName("");
      if (data?.summary) {
        setImportSummary(data.summary);
      } else {
        toast({ title: "تم استيراد البيانات بنجاح" });
        onBack();
      }
    },
    onError: (e) => toast({ title: "خطأ في الاستيراد", description: e.message, variant: "destructive" }),
  });

  const template = JSON.stringify({
    consultant_code: "CONS-001",
    proposal_date: "2025-01-15",
    proposal_reference: "REF-2025-001",
    design_fee: {
      method: "LUMP_SUM",
      amount: 500000,
    },
    supervision_fee: {
      submitted: true,
      method: "MONTHLY_RATE",
      stated_duration_months: 24,
    },
    scope_coverage: [
      // === Section 1: Core Design Services ===
      { item_code: "CONCEPT_DESIGN", status: "INCLUDED" },
      { item_code: "SCHEMATIC_DESIGN", status: "INCLUDED" },
      { item_code: "DETAILED_DESIGN", status: "INCLUDED" },
      { item_code: "ARCH_DESIGN", status: "INCLUDED" },
      { item_code: "STRUCTURAL_CIVIL", status: "INCLUDED" },
      { item_code: "MEP_ENGINEERING", status: "INCLUDED" },
      { item_code: "FLS", status: "INCLUDED" },
      { item_code: "BIM", status: "NOT_MENTIONED" },
      { item_code: "QS_BOQ", status: "INCLUDED" },
      { item_code: "PARKING_STRATEGY", status: "INCLUDED" },
      { item_code: "WASTE_MANAGEMENT", status: "NOT_MENTIONED" },
      { item_code: "SIGNAGE_WAYFINDING", status: "NOT_MENTIONED" },
      { item_code: "INFRASTRUCTURE", status: "INCLUDED" },
      // === Section 1: Documentation & Deliverables ===
      { item_code: "AUTHORITY_SUBMISSIONS", status: "INCLUDED" },
      { item_code: "BUILDING_PERMIT", status: "INCLUDED" },
      { item_code: "IFC_PACKAGE", status: "INCLUDED" },
      { item_code: "TENDER_DOCS", status: "INCLUDED" },
      { item_code: "TENDER_EVAL", status: "NOT_MENTIONED" },
      // === Section 1: Contract Framework ===
      { item_code: "FIDIC_CONTRACT", status: "INCLUDED" },
      { item_code: "DIAC", status: "NOT_MENTIONED" },
      { item_code: "PI_INSURANCE", status: "NOT_MENTIONED" },
      { item_code: "PL_INSURANCE", status: "NOT_MENTIONED" },
      { item_code: "GOVERNING_LAW", status: "INCLUDED" },
      { item_code: "RETENTION", status: "INCLUDED" },
      { item_code: "FEE_CAP", status: "NOT_MENTIONED" },
      { item_code: "CONFIDENTIALITY", status: "INCLUDED" },
      { item_code: "IP", status: "INCLUDED" },
      { item_code: "TERMINATION", status: "INCLUDED" },
      // === Section 2: Specialized Mandatory GREEN ===
      { item_code: "GREEN_BUILDING", status: "NOT_MENTIONED" },
      { item_code: "STRUCTURAL_AUDIT", status: "NOT_MENTIONED" },
      { item_code: "SECURITY_SIRA", status: "NOT_MENTIONED" },
      { item_code: "VERTICAL_TRANSPORT", status: "NOT_MENTIONED" },
      { item_code: "BMU", status: "NOT_MENTIONED" },
      { item_code: "FACADE_ENGINEERING", status: "NOT_MENTIONED" },
      { item_code: "WIND_TUNNEL", status: "NOT_MENTIONED" },
      { item_code: "AV_ELV", status: "NOT_MENTIONED" },
      { item_code: "FLS_SPECIALIST", status: "NOT_MENTIONED" },
      { item_code: "FACADE_LIGHTING", status: "NOT_MENTIONED" },
      { item_code: "TIS", status: "NOT_MENTIONED" },
      { item_code: "ACOUSTIC", status: "NOT_MENTIONED" },
      { item_code: "LEED", status: "NOT_MENTIONED" },
      { item_code: "COST_MANAGEMENT", status: "NOT_MENTIONED" },
      { item_code: "VALUE_ENGINEERING", status: "NOT_MENTIONED" },
      // === Section 3: Mandatory RED ===
      { item_code: "ID_COMMON_AREAS", status: "NOT_MENTIONED" },
      { item_code: "ID_UNIT_PROTOTYPES", status: "NOT_MENTIONED" },
      { item_code: "LANDSCAPE", status: "NOT_MENTIONED" },
      { item_code: "WATER_FEATURES", status: "NOT_MENTIONED" }
    ],
    supervision_team: [
      { role_code: "RE", allocation_pct: 100, monthly_rate: 45000 },
      { role_code: "DEPUTY_RE", allocation_pct: 0, monthly_rate: 40000 },
      { role_code: "CIVIL_INSPECTOR", allocation_pct: 70, monthly_rate: 18000 },
      { role_code: "MEP_INSPECTOR", allocation_pct: 60, monthly_rate: 20000 },
      { role_code: "HSE_OFFICER", allocation_pct: 100, monthly_rate: 18000 },
      { role_code: "DOC_CONTROLLER", allocation_pct: 50, monthly_rate: 12000 },
      { role_code: "QA_QC", allocation_pct: 40, monthly_rate: 28000 },
      { role_code: "HO_STRUCTURAL", allocation_pct: 30, monthly_rate: 35000 },
      { role_code: "HO_ARCH", allocation_pct: 30, monthly_rate: 32000 },
      { role_code: "HO_MECHANICAL", allocation_pct: 30, monthly_rate: 35000 },
      { role_code: "HO_ELECTRICAL", allocation_pct: 30, monthly_rate: 35000 }
    ],
  }, null, 2);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div>
          <h2 className="font-bold text-lg">استيراد عرض الاستشاري</h2>
          <p className="text-sm text-muted-foreground">{consultantName}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="w-4 h-4 text-sky-600" />
              بيانات JSON من Claude
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowTemplate(!showTemplate)}>
              {showTemplate ? "إخفاء" : "عرض"} القالب
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showTemplate && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">قالب JSON المطلوب:</p>
              <pre className="text-xs overflow-auto max-h-48 text-foreground/80">{template}</pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => { setJsonText(template); setShowTemplate(false); }}
              >
                نسخ القالب للمحرر
              </Button>
            </div>
          )}
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-sky-500 bg-sky-50" : jsonText ? "border-green-400 bg-green-50" : "border-muted-foreground/30 hover:border-sky-400 hover:bg-sky-50/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
            />
            {jsonText ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <FileJson className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium text-green-700">{fileName}</p>
                <p className="text-xs text-green-600">تم تحميل الملف بنجاح — اضغط للتغيير</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center mx-auto">
                  <FileJson className="w-6 h-6 text-sky-600" />
                </div>
                <p className="font-medium text-foreground">اسحب ملف JSON هنا أو اضغط للاختيار</p>
                <p className="text-xs text-muted-foreground">يقبل ملفات .json فقط</p>
              </div>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">تعليمات:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>استخدم Claude لقراءة عرض الاستشاري وتحويله إلى JSON</li>
              <li>تأكد من صحة <code>consultant_code</code> (يجب أن يكون موجوداً في القائمة الرئيسية)</li>
              <li>طريقة الأتعاب: <code>LUMP_SUM</code> أو <code>PERCENTAGE</code> أو <code>MONTHLY_RATE</code></li>
              <li>حالة النطاق: <code>INCLUDED</code> أو <code>EXCLUDED</code> أو <code>NOT_MENTIONED</code></li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white"
              disabled={!jsonText.trim() || importMutation.isPending}
              onClick={() => importMutation.mutate({ cpaProjectId, jsonText })}
            >
              {importMutation.isPending ? "جاري الاستيراد..." : "استيراد البيانات"}
            </Button>
            <Button variant="outline" onClick={onBack}>إلغاء</Button>
          </div>
        </CardContent>
      </Card>

      {/* Post-Import Summary Dialog */}
      <Dialog open={!!importSummary} onOpenChange={(open) => { if (!open) { setImportSummary(null); onBack(); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-5 h-5" />
              تم الاستيراد بنجاح
            </DialogTitle>
          </DialogHeader>
          {importSummary && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">ملخص بيانات عرض <strong>{consultantName}</strong>:</p>
              {/* Scope Summary */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  تغطية بنود النطاق ({importSummary.scopeTotal} بند)
                </div>
                <div className="grid grid-cols-3 divide-x divide-x-reverse">
                  <div className="p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{importSummary.scopeIncluded}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">مشمول</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-2xl font-bold text-red-500">{importSummary.scopeExcluded}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">مستثنى</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-2xl font-bold text-amber-500">{importSummary.scopeNotMentioned}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">غير مذكور</div>
                  </div>
                </div>
              </div>
              {/* Supervision Summary */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">أدوار الإشراف المستوردة</span>
                <span className="font-bold text-sky-700">{importSummary.supervisionRolesImported} دور</span>
              </div>
              <Button className="w-full" onClick={() => { setImportSummary(null); onBack(); }}>
                متابعة ← العودة للمشروع
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ---- Screen 4: Scope Revieww -----------------------------------------------

function ScopeReviewScreen({
  projectConsultantId,
  consultantName,
  onBack,
}: {
  projectConsultantId: number;
  consultantName: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const coverageQuery = trpc.cpa.consultants.getScopeCoverage.useQuery({ projectConsultantId });
  const updateMutation = trpc.cpa.consultants.updateScopeCoverage.useMutation({
    onSuccess: () => coverageQuery.refetch(),
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const coverage = coverageQuery.data ?? [];

  const statusIcon = (status: string) => {
    if (status === "INCLUDED") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === "EXCLUDED") return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  };

  const statusLabel = (status: string) => {
    if (status === "INCLUDED") return "مشمول";
    if (status === "EXCLUDED") return "مستثنى";
    return "غير مذكور";
  };

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of coverage) {
      const key = item.section_label ?? "عام";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [coverage]);

  const stats = useMemo(() => ({
    included: coverage.filter((c: any) => c.coverage_status === "INCLUDED").length,
    excluded: coverage.filter((c: any) => c.coverage_status === "EXCLUDED").length,
    notMentioned: coverage.filter((c: any) => c.coverage_status === "NOT_MENTIONED").length,
  }), [coverage]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div>
          <h2 className="font-bold text-lg">مراجعة تغطية النطاق</h2>
          <p className="text-sm text-muted-foreground">{consultantName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "مشمول", value: stats.included, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "مستثنى", value: stats.excluded, color: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "غير مذكور", value: stats.notMentioned, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl p-3 text-center border ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {coverageQuery.isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : coverage.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد بيانات تغطية. استورد JSON أولاً.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([section, items]) => (
            <Card key={section}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{section}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {statusIcon(item.coverage_status)}
                      <span className="text-sm font-medium">{item.item_label}</span>
                      <span className="text-xs text-muted-foreground">({item.item_code})</span>
                    </div>
                    <Select
                      value={item.coverage_status}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          projectConsultantId,
                          scopeItemId: item.scope_item_id,
                          coverageStatus: v as any,
                        })
                      }
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCLUDED">مشمول</SelectItem>
                        <SelectItem value="EXCLUDED">مستثنى</SelectItem>
                        <SelectItem value="NOT_MENTIONED">غير مذكور</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Screen 5: Evaluation Results -----------------------------------------

function ResultsScreen({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const resultsQuery = trpc.cpa.evaluation.getResults.useQuery({ cpaProjectId: projectId });
  const projectQuery = trpc.cpa.projects.getById.useQuery({ id: projectId });
  const evalMutation = trpc.cpa.evaluation.runEvaluation.useMutation({
    onSuccess: () => { resultsQuery.refetch(); toast({ title: "تم إعادة الحساب" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const results = resultsQuery.data ?? [];
  const project = projectQuery.data;

  const rankable = results.filter((r: any) => r.can_rank === 1);
  const unrankable = results.filter((r: any) => r.can_rank !== 1);
  const lowestCost = rankable.length > 0 ? Math.min(...rankable.map((r: any) => r.total_true_cost)) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1">
          <h2 className="font-bold text-lg">نتائج التقييم والترتيب</h2>
          <p className="text-sm text-muted-foreground">{project?.project_name}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => evalMutation.mutate({ cpaProjectId: projectId })}
          disabled={evalMutation.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ml-1 ${evalMutation.isPending ? "animate-spin" : ""}`} />
          إعادة الحساب
        </Button>
      </div>

      {resultsQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد نتائج. اضغط "احسب التكلفة الحقيقية" أولاً.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ranked */}
          {rankable.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h3 className="font-semibold text-sm">الترتيب النهائي ({rankable.length} استشاري)</h3>
              </div>
              <div className="space-y-3">
                {rankable.map((r: any) => {
                  const premium = lowestCost > 0 ? ((r.total_true_cost - lowestCost) / lowestCost) * 100 : 0;
                  const isExpanded = expandedId === r.project_consultant_id;
                  return (
                    <Card
                      key={r.project_consultant_id}
                      className={`border-2 ${r.result_rank === 1 ? "border-yellow-300 bg-yellow-50/30" : r.result_rank === 2 ? "border-gray-300" : "border-border"}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <RankBadge rank={r.result_rank} />
                            <div className="min-w-0">
                              <div className="font-bold text-foreground">{r.trade_name || r.legal_name}</div>
                              <div className="text-xs text-muted-foreground">{r.consultant_code}</div>
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <div className="font-bold text-sky-700 text-lg">{fmtAED(r.total_true_cost)}</div>
                            {premium > 0.01 && (
                              <div className="text-xs text-orange-600">+{premium.toFixed(1)}% فوق الأقل</div>
                            )}
                          </div>
                        </div>

                        {/* Cost breakdown bar */}
                        <div className="mt-3 space-y-1.5">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">أتعاب التصميم</span>
                              <div className="font-semibold">{fmtAED(r.quoted_design_fee)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">فجوة النطاق</span>
                              <div className="font-semibold text-orange-600">+{fmtAED(r.design_scope_gap_cost)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">التصميم الحقيقي</span>
                              <div className="font-semibold text-sky-600">{fmtAED(r.true_design_fee)}</div>
                            </div>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">أتعاب الإشراف</span>
                              <div className="font-semibold">{fmtAED(r.quoted_supervision_fee)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">فجوة الإشراف</span>
                              <div className="font-semibold text-orange-600">+{fmtAED(r.supervision_gap_cost)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">الإشراف الحقيقي</span>
                              <div className="font-semibold text-sky-600">{fmtAED(r.adjusted_supervision_fee)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Expand for gap details */}
                        {r.calculationNotes && (
                          <button
                            className="mt-3 text-xs text-sky-600 flex items-center gap-1 hover:underline"
                            onClick={() => setExpandedId(isExpanded ? null : r.project_consultant_id)}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {isExpanded ? "إخفاء" : "عرض"} تفاصيل الفجوات
                          </button>
                        )}
                        {isExpanded && r.calculationNotes && (
                          <div className="mt-3 space-y-2">
                            {r.calculationNotes.scopeGaps?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-orange-700 mb-1">فجوات النطاق:</p>
                                <div className="space-y-1">
                                  {r.calculationNotes.scopeGaps.map((g: any, i: number) => (
                                    <div key={i} className="flex justify-between text-xs bg-orange-50 rounded px-2 py-1">
                                      <span>{g.itemLabel} ({g.itemCode})</span>
                                      <span className="font-semibold text-orange-700">{fmtAED(g.gapCost)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {r.calculationNotes.supervisionGaps?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-orange-700 mb-1">فجوات فريق الإشراف:</p>
                                <div className="space-y-1">
                                  {r.calculationNotes.supervisionGaps.map((g: any, i: number) => (
                                    <div key={i} className="flex justify-between text-xs bg-orange-50 rounded px-2 py-1">
                                      <span>{g.roleLabel} ({g.gapPct}% فجوة)</span>
                                      <span className="font-semibold text-orange-700">{fmtAED(g.gapCost)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {r.calculationNotes.durationWarning && (
                              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                <span className="text-amber-600 text-base leading-none mt-0.5">⚠️</span>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-amber-800">تحذير: مدة الإشراف المقدمة أقل من مدة المشروع</p>
                                  <p className="text-xs text-amber-700 mt-0.5">{r.calculationNotes.durationWarning.message}</p>
                                  {r.calculationNotes.durationWarning.originalFee > 0 && (
                                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-white/60 rounded px-2 py-1">
                                        <span className="text-amber-600">سعر العرض ({r.calculationNotes.durationWarning.statedMonths} شهر)</span>
                                        <p className="font-semibold text-amber-700 line-through">{fmtAED(r.calculationNotes.durationWarning.originalFee)}</p>
                                      </div>
                                      <div className="bg-amber-100 rounded px-2 py-1">
                                        <span className="text-amber-700">سعر معدَّل ({r.calculationNotes.durationWarning.projectMonths} شهر)</span>
                                        <p className="font-bold text-amber-900">{fmtAED(r.calculationNotes.durationWarning.originalFee * r.calculationNotes.durationWarning.adjustmentFactor)}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unrankable */}
          {unrankable.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-sm text-muted-foreground">غير مرتبون (لم يقدموا عرض إشراف)</h3>
              </div>
              <div className="space-y-2">
                {unrankable.map((r: any) => (
                  <Card key={r.project_consultant_id} className="border-dashed">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{r.trade_name || r.legal_name}</div>
                        <div className="text-xs text-muted-foreground">لم يقدم عرض إشراف كامل</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        أتعاب التصميم: {fmtAED(r.quoted_design_fee)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Screen 6: Settings ---------------------------------------------------

function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("scope-matrix");
  const { toast } = useToast();

  const categoriesQuery = trpc.cpa.settings.getBuildingCategories.useQuery();
  const scopeItemsQuery = trpc.cpa.settings.getScopeItems.useQuery();
  const rolesQuery = trpc.cpa.settings.getSupervisionRoles.useQuery();
  const masterQuery = trpc.cpa.settings.getConsultantsMaster.useQuery();

  const upsertCategoryMutation = trpc.cpa.settings.upsertBuildingCategory.useMutation({
    onSuccess: () => { categoriesQuery.refetch(); toast({ title: "تم الحفظ" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const upsertRoleMutation = trpc.cpa.settings.upsertSupervisionRole.useMutation({
    onSuccess: () => { rolesQuery.refetch(); toast({ title: "تم الحفظ" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const upsertConsultantMutation = trpc.cpa.settings.upsertConsultantMaster.useMutation({
    onSuccess: () => { masterQuery.refetch(); setShowAddConsultant(false); toast({ title: "تم الحفظ" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteConsultantMutation = trpc.cpa.settings.deleteConsultantMaster.useMutation({
    onSuccess: () => { masterQuery.refetch(); toast({ title: "تم الحذف" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [showAddConsultant, setShowAddConsultant] = useState(false);
  const [consultantForm, setConsultantForm] = useState({
    code: "", legalName: "", tradeName: "", registrationNo: "", specialties: "", contactEmail: "", contactPhone: "",
  });

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ code: "", label: "", buaMinSqft: "", buaMaxSqft: "", description: "", supervisionDurationMonths: "" });

  const deleteCategoryMutation = trpc.cpa.settings.upsertBuildingCategory.useMutation({
    onSuccess: () => { categoriesQuery.refetch(); toast({ title: "تم التحديث" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" });

  const upsertScopeItemMutation = trpc.cpa.settings.upsertScopeItem.useMutation({
    onSuccess: () => { scopeItemsQuery.refetch(); setShowScopeItemDialog(false); toast({ title: "تم الحفظ" }); },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const sectionsQuery = trpc.cpa.settings.getScopeSections.useQuery();
  const [showScopeItemDialog, setShowScopeItemDialog] = useState(false);
  const [editingScopeItem, setEditingScopeItem] = useState<any>(null);
  const [scopeItemForm, setScopeItemForm] = useState({ itemNumber: "", code: "", label: "", sectionId: "", defaultType: "CORE", description: "" });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div>
          <h2 className="font-bold text-lg">إعدادات النظام</h2>
          <p className="text-sm text-muted-foreground">إدارة فئات المباني، أدوار الإشراف، والاستشاريين</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="scope-matrix" className="text-xs">مصفوفة النطاق</TabsTrigger>
          <TabsTrigger value="ref-costs" className="text-xs">الأسعار المرجعية</TabsTrigger>
          <TabsTrigger value="supervision-matrix" className="text-xs">مصفوفة الإشراف</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs">فئات المباني</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">أدوار الإشراف</TabsTrigger>
          <TabsTrigger value="consultants" className="text-xs">الاستشاريون</TabsTrigger>
          <TabsTrigger value="scope" className="text-xs">بنود النطاق</TabsTrigger>
        </TabsList>

        {/* Scope Category Matrix */}
        <TabsContent value="scope-matrix" className="mt-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">مصفوفة النطاق (47 بند × 5 فئات)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">اضغط على أي خلية لتغيير حالة البند في تلك الفئة. التغييرات تُحفظ فوراً.</p>
            </div>
            <ScopeMatrixTable />
          </div>
        </TabsContent>

        {/* Reference Costs */}
        <TabsContent value="ref-costs" className="mt-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">الأسعار المرجعية للبنود المتخصصة (AED)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">هذه الأسعار تُستخدم لحساب تكلفة الفجوات عند مقارنة عروض الاستشاريين. اضغط على أي خلية للتعديل.</p>
            </div>
            <ReferenceCostsTable />
          </div>
        </TabsContent>

        {/* Supervision Baseline Matrix */}
        <TabsContent value="supervision-matrix" className="mt-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">مصفوفة الإشراف — نسب التخصيص المطلوبة</h3>
              <p className="text-xs text-muted-foreground mt-0.5">نسبة التخصيص لكل دور في كل فئة. 0 = غير مطلوب، 100 = دوام كامل. اضغط على أي خلية للتعديل.</p>
            </div>
            <SupervisionBaselineTable />
          </div>
        </TabsContent>

        {/* Building Categories */}
        <TabsContent value="categories" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">فئات المباني</h3>
            <Button size="sm" onClick={() => setShowAddCategory(true)}>
              <Plus className="w-3.5 h-3.5 ml-1" />
              إضافة فئة
            </Button>
          </div>
          <div className="space-y-2">
            {(categoriesQuery.data ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{c.code}</span>
                    <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                      {c.is_active ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                  {(c.bua_min_sqft != null || c.bua_max_sqft != null) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      النطاق: {c.bua_min_sqft != null ? c.bua_min_sqft.toLocaleString() : "0"} — {c.bua_max_sqft != null ? c.bua_max_sqft.toLocaleString() : "∞"} قدم²
                    </p>
                  )}
                  {c.supervision_duration_months != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      مدة الإشراف: <span className="font-semibold text-foreground">{c.supervision_duration_months} شهر</span>
                    </p>
                  )}
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1 mr-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    setEditingCategory(c);
                    setCategoryForm({ code: c.code, label: c.label, buaMinSqft: c.bua_min_sqft ?? "", buaMaxSqft: c.bua_max_sqft ?? "", description: c.description ?? "", supervisionDurationMonths: c.supervision_duration_months ?? "" });
                    setShowAddCategory(true);
                  }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => {
                    if (confirm(`هل تريد ${c.is_active ? 'تعطيل' : 'تفعيل'} فئة "${c.label}"؟`)) {
                      upsertCategoryMutation.mutate({ id: c.id, code: c.code, label: c.label, buaMinSqft: c.bua_min_sqft, buaMaxSqft: c.bua_max_sqft, description: c.description, isActive: c.is_active ? 0 : 1 });
                    }
                  }}>
                    {c.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-green-600" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Dialog open={showAddCategory} onOpenChange={(open) => { setShowAddCategory(open); if (!open) { setEditingCategory(null); setCategoryForm({ code: "", label: "", buaMinSqft: "", buaMaxSqft: "", description: "", supervisionDurationMonths: "" }); } }}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingCategory ? `تعديل: ${editingCategory.label}` : "إضافة فئة مبنى جديدة"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الكود *</Label><Input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} placeholder="مثال: VILLA" /></div>
                  <div><Label>الاسم *</Label><Input value={categoryForm.label} onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })} placeholder="مثال: فيلا" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>BUA الأدنى (قدم²)</Label><Input type="number" value={categoryForm.buaMinSqft} onChange={(e) => setCategoryForm({ ...categoryForm, buaMinSqft: e.target.value })} placeholder="اتركه فارغاً = بلا حد أدنى" /></div>
                  <div><Label>BUA الأقصى (قدم²)</Label><Input type="number" value={categoryForm.buaMaxSqft} onChange={(e) => setCategoryForm({ ...categoryForm, buaMaxSqft: e.target.value })} placeholder="اتركه فارغاً = بلا حد أقصى" /></div>
                </div>
                <div><Label>مدة الإشراف (شهر) *</Label><Input type="number" min="1" max="120" value={categoryForm.supervisionDurationMonths} onChange={(e) => setCategoryForm({ ...categoryForm, supervisionDurationMonths: e.target.value })} placeholder="مثال: 24" /></div>
                <div><Label>وصف (اختياري)</Label><Input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /></div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" disabled={!categoryForm.code || !categoryForm.label} onClick={() => {
                    upsertCategoryMutation.mutate({
                      id: editingCategory?.id,
                      code: categoryForm.code,
                      label: categoryForm.label,
                      buaMinSqft: categoryForm.buaMinSqft !== "" ? Number(categoryForm.buaMinSqft) : null,
                      buaMaxSqft: categoryForm.buaMaxSqft !== "" ? Number(categoryForm.buaMaxSqft) : null,
                      description: categoryForm.description || undefined,
                      isActive: editingCategory?.is_active ?? 1,
                      supervisionDurationMonths: categoryForm.supervisionDurationMonths !== "" ? Number(categoryForm.supervisionDurationMonths) : undefined,
                    });
                    setShowAddCategory(false);
                    setEditingCategory(null);
                    setCategoryForm({ code: "", label: "", buaMinSqft: "", buaMaxSqft: "", description: "", supervisionDurationMonths: "" });
                  }}>{editingCategory ? "حفظ التعديلات" : "إضافة"}</Button>
                  <Button variant="outline" onClick={() => { setShowAddCategory(false); setEditingCategory(null); setCategoryForm({ code: "", label: "", buaMinSqft: "", buaMaxSqft: "", description: "", supervisionDurationMonths: "" }); }}>إلغاء</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Supervision Roles */}
        <TabsContent value="roles" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">أدوار فريق الإشراف</h3>
            <Button size="sm" onClick={() => { setEditingRole(null); setRoleForm({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" }); setShowAddRole(true); }}>
              <Plus className="w-3.5 h-3.5 ml-1" />
              إضافة دور
            </Button>
          </div>
          <div className="space-y-2">
            {(rolesQuery.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{r.code}</span>
                    {r.grade && <span className="text-xs text-muted-foreground">· {r.grade}</span>}
                    <Badge variant="outline" className="text-xs">{r.team_type === 'SITE' ? 'موقع' : 'مكتب رئيسي'}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-sky-700 mt-0.5">{fmtAED(r.monthly_rate_aed)} / شهر</p>
                </div>
                <div className="flex items-center gap-1 mr-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    setEditingRole(r);
                    setRoleForm({ code: r.code, label: r.label, grade: r.grade ?? "", teamType: r.team_type, monthlyRateAed: String(r.monthly_rate_aed) });
                    setShowAddRole(true);
                  }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => {
                    if (confirm(`هل تريد ${r.is_active ? 'تعطيل' : 'تفعيل'} دور "${r.label}"؟`)) {
                      upsertRoleMutation.mutate({ id: r.id, code: r.code, label: r.label, grade: r.grade || undefined, teamType: r.team_type, monthlyRateAed: Number(r.monthly_rate_aed), isActive: r.is_active ? 0 : 1 });
                    }
                  }}>
                    {r.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-green-600" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Dialog open={showAddRole} onOpenChange={(open) => { setShowAddRole(open); if (!open) { setEditingRole(null); setRoleForm({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" }); } }}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>{editingRole ? `تعديل: ${editingRole.label}` : "إضافة دور إشراف"}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الكود *</Label><Input value={roleForm.code} onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })} /></div>
                  <div><Label>الاسم *</Label><Input value={roleForm.label} onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الدرجة</Label><Input value={roleForm.grade} onChange={(e) => setRoleForm({ ...roleForm, grade: e.target.value })} /></div>
                  <div>
                    <Label>نوع الفريق</Label>
                    <Select value={roleForm.teamType} onValueChange={(v) => setRoleForm({ ...roleForm, teamType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SITE">موقع</SelectItem>
                        <SelectItem value="HEAD_OFFICE">مكتب رئيسي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>المعدل الشهري (AED) *</Label><Input type="number" value={roleForm.monthlyRateAed} onChange={(e) => setRoleForm({ ...roleForm, monthlyRateAed: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={!roleForm.code || !roleForm.label || !roleForm.monthlyRateAed} onClick={() => {
                    upsertRoleMutation.mutate({
                      id: editingRole?.id,
                      code: roleForm.code, label: roleForm.label, grade: roleForm.grade || undefined,
                      teamType: roleForm.teamType as any, monthlyRateAed: Number(roleForm.monthlyRateAed),
                      isActive: editingRole?.is_active ?? 1,
                    });
                    setShowAddRole(false);
                    setEditingRole(null);
                    setRoleForm({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" });
                  }}>{editingRole ? "حفظ التعديلات" : "إضافة"}</Button>
                  <Button variant="outline" onClick={() => { setShowAddRole(false); setEditingRole(null); setRoleForm({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" }); }}>إلغاء</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Consultants Master */}
        <TabsContent value="consultants" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">قائمة الاستشاريين الرئيسية</h3>
            <Button size="sm" onClick={() => setShowAddConsultant(true)}>
              <Plus className="w-3.5 h-3.5 ml-1" />
              إضافة استشاري
            </Button>
          </div>
          <div className="space-y-2">
            {(masterQuery.data ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{c.trade_name || c.legal_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({c.code})</span>
                  {c.contact_email && <span className="text-xs text-muted-foreground ml-2">· {c.contact_email}</span>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    if (confirm("هل تريد حذف هذا الاستشاري؟")) {
                      deleteConsultantMutation.mutate({ id: c.id });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Dialog open={showAddConsultant} onOpenChange={setShowAddConsultant}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة استشاري جديد</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الكود *</Label><Input value={consultantForm.code} onChange={(e) => setConsultantForm({ ...consultantForm, code: e.target.value })} placeholder="CONS-001" /></div>
                  <div><Label>الاسم القانوني *</Label><Input value={consultantForm.legalName} onChange={(e) => setConsultantForm({ ...consultantForm, legalName: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الاسم التجاري</Label><Input value={consultantForm.tradeName} onChange={(e) => setConsultantForm({ ...consultantForm, tradeName: e.target.value })} /></div>
                  <div><Label>رقم التسجيل</Label><Input value={consultantForm.registrationNo} onChange={(e) => setConsultantForm({ ...consultantForm, registrationNo: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>البريد الإلكتروني</Label><Input value={consultantForm.contactEmail} onChange={(e) => setConsultantForm({ ...consultantForm, contactEmail: e.target.value })} /></div>
                  <div><Label>الهاتف</Label><Input value={consultantForm.contactPhone} onChange={(e) => setConsultantForm({ ...consultantForm, contactPhone: e.target.value })} /></div>
                </div>
                <div><Label>التخصصات</Label><Input value={consultantForm.specialties} onChange={(e) => setConsultantForm({ ...consultantForm, specialties: e.target.value })} placeholder="معماري، إنشائي، MEP..." /></div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => upsertConsultantMutation.mutate({
                    code: consultantForm.code, legalName: consultantForm.legalName,
                    tradeName: consultantForm.tradeName || undefined,
                    registrationNo: consultantForm.registrationNo || undefined,
                    specialties: consultantForm.specialties || undefined,
                    contactEmail: consultantForm.contactEmail || undefined,
                    contactPhone: consultantForm.contactPhone || undefined,
                  })}>حفظ</Button>
                  <Button variant="outline" onClick={() => setShowAddConsultant(false)}>إلغاء</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Scope Items */}
        <TabsContent value="scope" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">بنود النطاق المعياري ({scopeItemsQuery.data?.length ?? 0} بند)</h3>
            <Button size="sm" onClick={() => { setEditingScopeItem(null); setScopeItemForm({ itemNumber: "", code: "", label: "", sectionId: "", defaultType: "CORE", description: "" }); setShowScopeItemDialog(true); }}>
              <Plus className="w-3.5 h-3.5 ml-1" />
              إضافة بند
            </Button>
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {(scopeItemsQuery.data ?? []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-6 text-center font-mono">{item.item_number}</span>
                  <div className="min-w-0">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">({item.code})</span>
                    {item.section_label && <span className="text-xs text-muted-foreground block">{item.section_label}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <Badge
                    variant="outline"
                    className={
                      item.default_type === "CORE" ? "border-sky-300 text-sky-700" :
                      item.default_type === "GREEN" ? "border-emerald-300 text-emerald-700" :
                      item.default_type === "RED" ? "border-red-300 text-red-700" :
                      "border-gray-300 text-gray-700"
                    }
                  >
                    {item.default_type}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    setEditingScopeItem(item);
                    setScopeItemForm({ itemNumber: String(item.item_number), code: item.code, label: item.label, sectionId: String(item.section_id ?? ""), defaultType: item.default_type, description: item.description ?? "" });
                    setShowScopeItemDialog(true);
                  }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    if (confirm(`هل تريد ${item.is_active ? 'تعطيل' : 'تفعيل'} بند "${item.label}"؟`)) {
                      upsertScopeItemMutation.mutate({ id: item.id, itemNumber: item.item_number, code: item.code, label: item.label, sectionId: item.section_id, defaultType: item.default_type, isActive: item.is_active ? 0 : 1 });
                    }
                  }}>
                    {item.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-green-600" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Dialog open={showScopeItemDialog} onOpenChange={(open) => { setShowScopeItemDialog(open); if (!open) { setEditingScopeItem(null); setScopeItemForm({ itemNumber: "", code: "", label: "", sectionId: "", defaultType: "CORE", description: "" }); } }}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>{editingScopeItem ? `تعديل: ${editingScopeItem.label}` : "إضافة بند نطاق"}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>رقم البند *</Label><Input type="number" value={scopeItemForm.itemNumber} onChange={(e) => setScopeItemForm({ ...scopeItemForm, itemNumber: e.target.value })} /></div>
                  <div className="col-span-2"><Label>الكود *</Label><Input value={scopeItemForm.code} onChange={(e) => setScopeItemForm({ ...scopeItemForm, code: e.target.value })} placeholder="مثال: ARCH_DESIGN" /></div>
                </div>
                <div><Label>الاسم *</Label><Input value={scopeItemForm.label} onChange={(e) => setScopeItemForm({ ...scopeItemForm, label: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>القسم</Label>
                    <Select value={scopeItemForm.sectionId} onValueChange={(v) => setScopeItemForm({ ...scopeItemForm, sectionId: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>نوع البند *</Label>
                    <Select value={scopeItemForm.defaultType} onValueChange={(v) => setScopeItemForm({ ...scopeItemForm, defaultType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CORE">أساسي (CORE)</SelectItem>
                        <SelectItem value="GREEN">أخضر (GREEN)</SelectItem>
                        <SelectItem value="RED">أحمر (RED)</SelectItem>
                        <SelectItem value="CONTRACTOR">مقاول (CONTRACTOR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>وصف (اختياري)</Label><Input value={scopeItemForm.description} onChange={(e) => setScopeItemForm({ ...scopeItemForm, description: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={!scopeItemForm.itemNumber || !scopeItemForm.code || !scopeItemForm.label} onClick={() => {
                    upsertScopeItemMutation.mutate({
                      id: editingScopeItem?.id,
                      itemNumber: Number(scopeItemForm.itemNumber),
                      code: scopeItemForm.code,
                      label: scopeItemForm.label,
                      sectionId: scopeItemForm.sectionId ? Number(scopeItemForm.sectionId) : null,
                      defaultType: scopeItemForm.defaultType as any,
                      description: scopeItemForm.description || undefined,
                      isActive: editingScopeItem?.is_active ?? 1,
                    });
                  }}>{editingScopeItem ? "حفظ التعديلات" : "إضافة"}</Button>
                  <Button variant="outline" onClick={() => { setShowScopeItemDialog(false); setEditingScopeItem(null); setScopeItemForm({ itemNumber: "", code: "", label: "", sectionId: "", defaultType: "CORE", description: "" }); }}>إلغاء</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Main Page ------------------------------------------------------------

export default function CPAPage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPcId, setSelectedPcId] = useState<number | null>(null);
  const [selectedConsultantName, setSelectedConsultantName] = useState("");

  function goHome() { setScreen("home"); setSelectedProjectId(null); setSelectedPcId(null); }
  function goProject(id: number) { setSelectedProjectId(id); setScreen("project-detail"); }
  function goImportJson(pcId: number, name: string) { setSelectedPcId(pcId); setSelectedConsultantName(name); setScreen("import-json"); }
  function goScopeReview(pcId: number, name: string) { setSelectedPcId(pcId); setSelectedConsultantName(name); setScreen("scope-review"); }
  function goResults() { setScreen("results"); }
  function goSettings() { setScreen("settings"); }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={goHome} className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" />
            التحليل المالي
          </button>
          {screen === "settings" && (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">الإعدادات</span>
            </>
          )}
          {(screen === "project-detail" || screen === "import-json" || screen === "scope-review" || screen === "results") && selectedProjectId && (
            <>
              <span>/</span>
              <button onClick={() => { setScreen("project-detail"); }} className="hover:text-foreground transition-colors">
                تفاصيل المشروع
              </button>
            </>
          )}
          {screen === "import-json" && (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">استيراد JSON</span>
            </>
          )}
          {screen === "scope-review" && (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">مراجعة النطاق</span>
            </>
          )}
          {screen === "results" && (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">النتائج والترتيب</span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {screen === "home" && (
          <ProjectListScreen onSelectProject={goProject} onSettings={goSettings} />
        )}
        {screen === "project-detail" && selectedProjectId && (
          <ProjectDetailScreen
            projectId={selectedProjectId}
            onBack={goHome}
            onImportJson={goImportJson}
            onScopeReview={goScopeReview}
            onResults={goResults}
          />
        )}
        {screen === "import-json" && selectedPcId && selectedProjectId && (
          <ImportJsonScreen
            projectConsultantId={selectedPcId}
            cpaProjectId={selectedProjectId}
            consultantName={selectedConsultantName}
            onBack={() => setScreen("project-detail")}
          />
        )}
        {screen === "scope-review" && selectedPcId && (
          <ScopeReviewScreen
            projectConsultantId={selectedPcId}
            consultantName={selectedConsultantName}
            onBack={() => setScreen("project-detail")}
          />
        )}
        {screen === "results" && selectedProjectId && (
          <ResultsScreen
            projectId={selectedProjectId}
            onBack={() => setScreen("project-detail")}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen onBack={goHome} />
        )}
      </div>
    </div>
  );
}
