import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ClipboardList,
  CalendarDays,
  FileSignature,
  Plus,
  Pencil,
  ChevronUp,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/_core/hooks/useAuth";
import ProjectLifecyclePage from "./ProjectLifecyclePage";
import WorkSchedulePage from "./WorkSchedulePage";

type View = "icons" | "compliance" | "schedule" | "contracts";

interface Stage {
  id: number;
  stageCode: string;
  nameAr: string;
  nameEn: string | null;
  category: string | null;
  isActive: number;
  sortOrder: number;
}

function StageSettingsView() {
  const { isReadOnly } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: stages = [], isLoading } = trpc.lifecycle.getAllStages.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [addingNew, setAddingNew] = useState(false);
  const [newNameAr, setNewNameAr] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Position input state: stageId -> draft position string
  const [posInputs, setPosInputs] = useState<Record<number, string>>({});

  const updateStage = trpc.lifecycle.updateStage.useMutation({
    onSuccess: () => {
      utils.lifecycle.getAllStages.invalidate();
      utils.lifecycle.getStages.invalidate();
      setEditingId(null);
      toast({ title: "تم التحديث بنجاح" });
    },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const createStage = trpc.lifecycle.createStage.useMutation({
    onSuccess: () => {
      utils.lifecycle.getAllStages.invalidate();
      utils.lifecycle.getStages.invalidate();
      setAddingNew(false);
      setNewNameAr("");
      setNewNameEn("");
      setNewCategory("");
      toast({ title: "تمت إضافة المرحلة بنجاح" });
    },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const reorderStages = trpc.lifecycle.reorderStages.useMutation({
    onSuccess: () => {
      utils.lifecycle.getAllStages.invalidate();
      utils.lifecycle.getStages.invalidate();
    },
  });

  const sortedStages = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);

  const startEdit = (stage: Stage) => {
    setEditingId(stage.id);
    setEditNameAr(stage.nameAr);
    setEditNameEn(stage.nameEn ?? "");
    setEditCategory(stage.category ?? "");
  };

  const saveEdit = (id: number) => {
    if (!editNameAr.trim()) return;
    updateStage.mutate({
      id,
      nameAr: editNameAr.trim(),
      nameEn: editNameEn.trim() || undefined,
      category: editCategory.trim() || undefined,
    });
  };

  const toggleActive = (stage: Stage) => {
    updateStage.mutate({
      id: stage.id,
      isActive: stage.isActive === 1 ? 0 : 1,
    });
  };

  // Move one step up or down
  const moveStage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedStages.length) return;
    const current = sortedStages[index];
    const target = sortedStages[targetIndex];
    reorderStages.mutate({
      stages: [
        { id: current.id, sortOrder: target.sortOrder },
        { id: target.id, sortOrder: current.sortOrder },
      ],
    });
  };

  // Move stage to a specific 1-based position, shifting others automatically
  const moveToPosition = (stageId: number, newPos: number) => {
    const total = sortedStages.length;
    if (newPos < 1 || newPos > total) {
      toast({ title: "رقم غير صالح", description: `أدخل رقماً بين 1 و ${total}`, variant: "destructive" });
      return;
    }
    const currentIndex = sortedStages.findIndex((s) => s.id === stageId);
    if (currentIndex === -1 || currentIndex === newPos - 1) return;

    // Build new ordered array
    const reordered = [...sortedStages];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newPos - 1, 0, moved);

    // Assign sequential sortOrder values (10, 20, 30, …) to keep gaps
    const updates = reordered.map((s, i) => ({ id: s.id, sortOrder: (i + 1) * 10 }));
    reorderStages.mutate({ stages: updates });

    // Clear the input
    setPosInputs((prev) => { const n = { ...prev }; delete n[stageId]; return n; });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">إعدادات المراحل</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة مراحل مسار الامتثال التنظيمي — الترتيب والأسماء والتفعيل
          </p>
        </div>
        {!isReadOnly && <Button
          size="sm"
          onClick={() => setAddingNew(true)}
          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4" />
          إضافة مرحلة
        </Button>}
      </div>

      {addingNew && (
        <div className="mb-4 p-4 rounded-xl border-2 border-amber-500/50 bg-amber-500/5 space-y-3">
          <p className="text-sm font-semibold text-amber-400">مرحلة جديدة</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم المرحلة بالعربية *</label>
              <Input value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} placeholder="مثال: مرحلة الإنشاء والبناء" className="text-sm" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم المرحلة بالإنجليزية (اختياري)</label>
              <Input value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} placeholder="e.g. Construction Phase" className="text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">التصنيف (اختياري)</label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="مثال: RERA، DLD، بلدية..." className="text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setAddingNew(false); setNewNameAr(""); setNewNameEn(""); setNewCategory(""); }}>
              <X className="w-4 h-4 ml-1" />إلغاء
            </Button>
            <Button size="sm" disabled={!newNameAr.trim() || createStage.isPending}
              onClick={() => createStage.mutate({ nameAr: newNameAr.trim(), nameEn: newNameEn.trim() || undefined, category: newCategory.trim() || undefined })}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              {createStage.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              حفظ
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sortedStages.map((stage, index) => (
          <div key={stage.id} className={`rounded-xl border transition-all duration-200 ${stage.isActive === 1 ? "bg-card border-border" : "bg-muted/30 border-border/50 opacity-60"}`}>
            {editingId === stage.id ? (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">الاسم بالعربية *</label>
                    <Input value={editNameAr} onChange={(e) => setEditNameAr(e.target.value)} className="text-sm" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">الاسم بالإنجليزية</label>
                    <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className="text-sm" placeholder="اختياري" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">التصنيف</label>
                  <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="text-sm" placeholder="اختياري" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4 ml-1" />إلغاء
                  </Button>
                  <Button size="sm" disabled={!editNameAr.trim() || updateStage.isPending} onClick={() => saveEdit(stage.id)} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {updateStage.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
                    حفظ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 px-4">
                {/* Position badge + input */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-400">{index + 1}</span>
                  </div>
                  {/* Direct position input */}
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      min={1}
                      max={sortedStages.length}
                      value={posInputs[stage.id] ?? ""}
                      placeholder="#"
                      className="w-10 h-6 text-center text-xs px-1 py-0"
                      onChange={(e) => setPosInputs((prev) => ({ ...prev, [stage.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(posInputs[stage.id] ?? "", 10);
                          if (!isNaN(val)) moveToPosition(stage.id, val);
                        }
                        if (e.key === "Escape") setPosInputs((prev) => { const n = { ...prev }; delete n[stage.id]; return n; });
                      }}
                    />
                    {posInputs[stage.id] && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-amber-500 hover:text-amber-600"
                        disabled={reorderStages.isPending}
                        onClick={() => {
                          const val = parseInt(posInputs[stage.id] ?? "", 10);
                          if (!isNaN(val)) moveToPosition(stage.id, val);
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{stage.nameAr}</span>
                    {stage.nameEn && <span className="text-xs text-muted-foreground">({stage.nameEn})</span>}
                    {stage.category && <Badge variant="secondary" className="text-xs py-0">{stage.category}</Badge>}
                    {stage.isActive === 0 && <Badge variant="outline" className="text-xs py-0 text-muted-foreground">موقوفة</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.stageCode}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="w-7 h-7" disabled={index === 0 || reorderStages.isPending} onClick={() => moveStage(index, "up")}>
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" disabled={index === sortedStages.length - 1 || reorderStages.isPending} onClick={() => moveStage(index, "down")}>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(stage)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className={`w-7 h-7 ${stage.isActive === 1 ? "text-green-500 hover:text-green-600" : "text-muted-foreground"}`} onClick={() => toggleActive(stage)} disabled={updateStage.isPending}>
                    {stage.isActive === 1 ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400">
        <strong>ملاحظة:</strong> لتغيير موضع مرحلة، اكتب رقم الترتيب الجديد في الحقل الصغير تحت رقمها واضغط Enter أو زر ✓ — سيُعاد ترقيم جميع المراحل تلقائياً. إيقاف مرحلة لن يحذفها من قاعدة البيانات، بل سيخفيها فقط من شاشة مسار الامتثال التنظيمي.
      </div>
    </div>
  );
}

function ContractsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/20">
        <FileSignature className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">العقود والاتفاقيات</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        هذا القسم قيد الإعداد. سيتيح لك إدارة عقود المشاريع واتفاقيات المقاولين والموردين بشكل متكامل.
      </p>
      <Badge variant="outline" className="mt-4 text-xs">قريباً</Badge>
    </div>
  );
}

const SECTIONS = [
  {
    id: "compliance" as View,
    label: "مسار الامتثال التنظيمي",
    description: "مراحل DLD/RERA — الخدمات والمتطلبات",
    icon: ClipboardList,
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    shadow: "rgba(139, 92, 246, 0.35)",
    borderColor: "#8b5cf6",
  },
  {
    id: "schedule" as View,
    label: "جدول العمل التنظيمي",
    description: "مخطط غانت لمسار الامتثال التنظيمي",
    icon: CalendarDays,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.35)",
    borderColor: "#f59e0b",
  },
  {
    id: "contracts" as View,
    label: "العقود والاتفاقيات",
    description: "إدارة العقود والاتفاقيات",
    icon: FileSignature,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    shadow: "rgba(16, 185, 129, 0.35)",
    borderColor: "#10b981",
  },
];

export default function DevelopmentPhasesPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");
  const [sharedProjectId, setSharedProjectId] = useState<number | null>(null);
  const activeSection = SECTIONS.find((s) => s.id === activeView);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          {activeView === "icons" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                الرئيسية
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                  <ClipboardList className="w-3.5 h-3.5 text-white" />
                </div>
                <h1 className="text-sm font-bold text-foreground">جولة في مراحل التطوير</h1>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setActiveView("icons")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                العودة
              </Button>
              <div className="h-5 w-px bg-border" />
              {activeSection && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: activeSection.gradient }}>
                    <activeSection.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h1 className="text-sm font-bold text-foreground">{activeSection.label}</h1>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {activeView === "icons" && (
        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 mb-4 shadow-xl shadow-violet-500/25">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">جولة في مراحل التطوير</h2>
            <p className="text-sm text-muted-foreground">متابعة الامتثال التنظيمي وإدارة المراحل والعقود</p>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {SECTIONS.map((item) => (
              <button key={item.id} onClick={() => setActiveView(item.id)}
                className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ backgroundColor: item.borderColor }} />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${item.shadow} 0%, transparent 70%)` }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}>
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="relative text-sm font-bold text-foreground leading-tight mb-1">{item.label}</h3>
                <p className="relative text-xs text-muted-foreground leading-snug">{item.description}</p>
              </button>
            ))}
          </div>
        </main>
      )}

      {activeView === "compliance" && <ProjectLifecyclePage embedded onProjectChange={setSharedProjectId} />}
      {activeView === "schedule" && <WorkSchedulePage initialProjectId={sharedProjectId} onProjectChange={setSharedProjectId} />}
      {activeView === "contracts" && <ContractsPlaceholder />}
    </div>
  );
}
