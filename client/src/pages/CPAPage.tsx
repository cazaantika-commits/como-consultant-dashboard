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

import { useState, useMemo } from "react";
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
  Home,
  Calculator,
  Shield,
  Layers,
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
            <div>
              <Label>المشروع *</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>BUA (قدم مربع) *</Label>
                <Input type="number" value={form.buaSqft} onChange={(e) => setForm({ ...form, buaSqft: e.target.value })} placeholder="مثال: 50000" />
              </div>
              <div>
                <Label>تكلفة الإنشاء / قدم² *</Label>
                <Input type="number" value={form.constructionCostPerSqft} onChange={(e) => setForm({ ...form, constructionCostPerSqft: e.target.value })} placeholder="مثال: 350" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>مدة الإشراف (شهر) *</Label>
                <Input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} placeholder="مثال: 24" />
              </div>
              <div>
                <Label>فئة المبنى</Label>
                <Select value={form.buildingCategoryId} onValueChange={(v) => setForm({ ...form, buildingCategoryId: v })}>
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
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState("");

  const project = projectQuery.data;
  const consultants = consultantsQuery.data ?? [];
  const masterList = masterQuery.data ?? [];
  const totalCost = project ? project.bua_sqft * project.construction_cost_per_sqft : 0;

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
      </div>

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
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5 ml-1" />
                إضافة
              </Button>
              {consultants.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => evalMutation.mutate({ cpaProjectId: projectId })}
                  disabled={evalMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                >
                  <Calculator className="w-3.5 h-3.5 ml-1" />
                  {evalMutation.isPending ? "جاري الحساب..." : "احسب التكلفة الحقيقية"}
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
                    <div className="flex gap-1.5 shrink-0">
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

  const importMutation = trpc.cpa.consultants.importJson.useMutation({
    onSuccess: () => {
      toast({ title: "تم استيراد البيانات بنجاح" });
      setJsonText("");
      onBack();
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
      { item_code: "ARCH_DESIGN", status: "INCLUDED" },
      { item_code: "STRUCTURAL_DESIGN", status: "INCLUDED" },
      { item_code: "MEP_DESIGN", status: "EXCLUDED" },
      { item_code: "INTERIOR_DESIGN", status: "NOT_MENTIONED" },
      { item_code: "LANDSCAPE_DESIGN", status: "EXCLUDED" },
      { item_code: "BIM", status: "NOT_MENTIONED" },
      { item_code: "PERMIT_DRAWINGS", status: "INCLUDED" },
      { item_code: "SHOP_DRAWINGS", status: "INCLUDED" },
      { item_code: "SITE_SUPERVISION", status: "INCLUDED" },
      { item_code: "STRUCTURAL_AUDIT", status: "NOT_MENTIONED" },
      { item_code: "GREEN_BUILDING", status: "NOT_MENTIONED" },
      { item_code: "SECURITY_SIRA", status: "NOT_MENTIONED" },
      { item_code: "VERTICAL_TRANSPORT", status: "NOT_MENTIONED" },
      { item_code: "AV_ELV", status: "NOT_MENTIONED" },
      { item_code: "FACADE_LIGHTING", status: "NOT_MENTIONED" },
      { item_code: "FLS", status: "NOT_MENTIONED" },
      { item_code: "TESTING_COMMISSIONING", status: "INCLUDED" },
      { item_code: "AS_BUILT", status: "INCLUDED" }
    ],
    supervision_team: [
      { role_code: "PM", allocation_pct: 100, monthly_rate: 25000 },
      { role_code: "ARCH_SUP", allocation_pct: 50, monthly_rate: 18000 },
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
          <div>
            <Label>الصق JSON هنا</Label>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{"consultant_code": "...", "design_fee": {...}, ...}'
              className="font-mono text-xs min-h-48 mt-1"
              dir="ltr"
            />
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
    </div>
  );
}

// ---- Screen 4: Scope Review -----------------------------------------------

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
  const [activeTab, setActiveTab] = useState("categories");
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
  const [categoryForm, setCategoryForm] = useState({ code: "", label: "", buaMinSqft: "", buaMaxSqft: "" });

  const [showAddRole, setShowAddRole] = useState(false);
  const [roleForm, setRoleForm] = useState({ code: "", label: "", grade: "", teamType: "SITE", monthlyRateAed: "" });

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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="categories">فئات المباني</TabsTrigger>
          <TabsTrigger value="roles">أدوار الإشراف</TabsTrigger>
          <TabsTrigger value="consultants">قائمة الاستشاريين</TabsTrigger>
          <TabsTrigger value="scope">بنود النطاق</TabsTrigger>
        </TabsList>

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
              <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">({c.code})</span>
                  {(c.bua_min_sqft || c.bua_max_sqft) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {c.bua_min_sqft ?? 0} - {c.bua_max_sqft ?? "∞"} قدم²
                    </span>
                  )}
                </div>
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "نشط" : "غير نشط"}
                </Badge>
              </div>
            ))}
          </div>
          <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة فئة مبنى</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الكود *</Label><Input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} /></div>
                  <div><Label>الاسم *</Label><Input value={categoryForm.label} onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>BUA الأدنى (قدم²)</Label><Input type="number" value={categoryForm.buaMinSqft} onChange={(e) => setCategoryForm({ ...categoryForm, buaMinSqft: e.target.value })} /></div>
                  <div><Label>BUA الأقصى (قدم²)</Label><Input type="number" value={categoryForm.buaMaxSqft} onChange={(e) => setCategoryForm({ ...categoryForm, buaMaxSqft: e.target.value })} /></div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => upsertCategoryMutation.mutate({
                    code: categoryForm.code, label: categoryForm.label,
                    buaMinSqft: categoryForm.buaMinSqft ? Number(categoryForm.buaMinSqft) : null,
                    buaMaxSqft: categoryForm.buaMaxSqft ? Number(categoryForm.buaMaxSqft) : null,
                  })}>حفظ</Button>
                  <Button variant="outline" onClick={() => setShowAddCategory(false)}>إلغاء</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Supervision Roles */}
        <TabsContent value="roles" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">أدوار فريق الإشراف</h3>
            <Button size="sm" onClick={() => setShowAddRole(true)}>
              <Plus className="w-3.5 h-3.5 ml-1" />
              إضافة دور
            </Button>
          </div>
          <div className="space-y-2">
            {(rolesQuery.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">({r.code})</span>
                  {r.grade && <span className="text-xs text-muted-foreground ml-1">· {r.grade}</span>}
                </div>
                <div className="text-sm font-semibold text-sky-700">{fmtAED(r.monthly_rate_aed)} / شهر</div>
              </div>
            ))}
          </div>
          <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة دور إشراف</DialogTitle></DialogHeader>
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
                  <Button className="flex-1" onClick={() => upsertRoleMutation.mutate({
                    code: roleForm.code, label: roleForm.label, grade: roleForm.grade || undefined,
                    teamType: roleForm.teamType as any, monthlyRateAed: Number(roleForm.monthlyRateAed),
                  })}>حفظ</Button>
                  <Button variant="outline" onClick={() => setShowAddRole(false)}>إلغاء</Button>
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
          <h3 className="font-semibold text-sm">بنود النطاق المعياري</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {(scopeItemsQuery.data ?? []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 text-center">{item.item_number}</span>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">({item.code})</span>
                </div>
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
              </div>
            ))}
          </div>
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
