import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowLeft,
  FolderOpen,
  Tag,
  GripVertical,
  Eye,
  EyeOff,
  Palette,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
  "#0ea5e9", "#84cc16", "#a855f7", "#e11d48", "#059669",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute top-10 right-0 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border p-3 grid grid-cols-5 gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-7 h-7 rounded-md cursor-pointer hover:scale-110 transition-transform ${value === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ItemType = {
  id: number;
  name: string;
  color: string | null;
  isActive: string;
  sortOrder: number | null;
};

function ManageSection({
  title,
  icon: Icon,
  items,
  isLoading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string;
  icon: any;
  items: ItemType[];
  isLoading: boolean;
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: number, data: { name?: string; color?: string; isActive?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("الرجاء إدخال الاسم");
      return;
    }
    setAdding(true);
    try {
      await onAdd(newName.trim(), newColor);
      setNewName("");
      setNewColor("#6366f1");
      toast.success("تمت الإضافة بنجاح");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    }
    setAdding(false);
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) {
      toast.error("الرجاء إدخال الاسم");
      return;
    }
    try {
      await onUpdate(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
      toast.success("تم التحديث بنجاح");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    }
  };

  const handleToggleActive = async (item: ItemType) => {
    try {
      await onUpdate(item.id, { isActive: item.isActive === "true" ? "false" : "true" });
      toast.success(item.isActive === "true" ? "تم الإخفاء" : "تم التفعيل");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
      await onDelete(id);
      toast.success("تم الحذف بنجاح");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Icon className="w-5 h-5 text-amber-700" />
          </div>
          {title}
          <span className="text-sm font-normal text-muted-foreground mr-auto">
            ({items.length} عنصر)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new item */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`اسم ${title === "المشاريع" ? "المشروع" : "التصنيف"} الجديد...`}
            className="flex-1 border-0 bg-white dark:bg-slate-700 shadow-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            dir="rtl"
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
          >
            <Plus className="w-4 h-4" />
            إضافة
          </Button>
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">لا توجد عناصر</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.isActive === "false"
                    ? "opacity-50 bg-slate-50 dark:bg-slate-800/30 border-dashed"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md"
                }`}
              >
                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                
                {editingId === item.id ? (
                  <>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border-0 bg-slate-50 dark:bg-slate-700 shadow-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)}
                      dir="rtl"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:bg-green-50"
                      onClick={() => handleUpdate(item.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:bg-slate-50"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: item.color || "#6366f1" }}
                    />
                    <span className="flex-1 font-medium text-sm" dir="rtl">
                      {item.name}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-amber-600"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                        setEditColor(item.color || "#6366f1");
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-blue-600"
                      onClick={() => handleToggleActive(item)}
                      title={item.isActive === "true" ? "إخفاء" : "تفعيل"}
                    >
                      {item.isActive === "true" ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();

  const projectsQuery = trpc.taskSettings.listProjects.useQuery();
  const categoriesQuery = trpc.taskSettings.listCategories.useQuery();
  const utils = trpc.useUtils();

  const addProjectMut = trpc.taskSettings.addProject.useMutation({
    onSuccess: () => utils.taskSettings.listProjects.invalidate(),
  });
  const updateProjectMut = trpc.taskSettings.updateProject.useMutation({
    onSuccess: () => utils.taskSettings.listProjects.invalidate(),
  });
  const deleteProjectMut = trpc.taskSettings.deleteProject.useMutation({
    onSuccess: () => utils.taskSettings.listProjects.invalidate(),
  });

  const addCategoryMut = trpc.taskSettings.addCategory.useMutation({
    onSuccess: () => utils.taskSettings.listCategories.invalidate(),
  });
  const updateCategoryMut = trpc.taskSettings.updateCategory.useMutation({
    onSuccess: () => utils.taskSettings.listCategories.invalidate(),
  });
  const deleteCategoryMut = trpc.taskSettings.deleteCategory.useMutation({
    onSuccess: () => utils.taskSettings.listCategories.invalidate(),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white">
        <div className="animate-pulse text-amber-700">جاري التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white">
        <Card className="p-8 text-center">
          <p className="mb-4 text-muted-foreground">يرجى تسجيل الدخول</p>
          <Button asChild className="bg-amber-600 hover:bg-amber-700">
            <a href={getLoginUrl("/task-settings")}>تسجيل الدخول</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/50 via-white to-slate-50" dir="rtl">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tasks">
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-amber-600" />
                  إعدادات المهام
                </h1>
                <p className="text-sm text-muted-foreground">إدارة المشاريع والتصنيفات</p>
              </div>
            </div>
            <Link href="/tasks">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                العودة للمهام
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <ManageSection
            title="المشاريع"
            icon={FolderOpen}
            items={(projectsQuery.data || []) as ItemType[]}
            isLoading={projectsQuery.isLoading}
            onAdd={async (name, color) => {
              await addProjectMut.mutateAsync({ name, color });
            }}
            onUpdate={async (id, data) => {
              await updateProjectMut.mutateAsync({ id, ...data });
            }}
            onDelete={async (id) => {
              await deleteProjectMut.mutateAsync({ id });
            }}
          />

          <ManageSection
            title="التصنيفات"
            icon={Tag}
            items={(categoriesQuery.data || []) as ItemType[]}
            isLoading={categoriesQuery.isLoading}
            onAdd={async (name, color) => {
              await addCategoryMut.mutateAsync({ name, color });
            }}
            onUpdate={async (id, data) => {
              await updateCategoryMut.mutateAsync({ id, ...data });
            }}
            onDelete={async (id) => {
              await deleteCategoryMut.mutateAsync({ id });
            }}
          />
        </div>

        {/* Help text */}
        <div className="max-w-5xl mx-auto mt-8">
          <Card className="border-0 bg-amber-50/50 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-semibold text-amber-800 mb-2">ملاحظات:</h3>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>المشاريع والتصنيفات المخفية (عين مغلقة) لن تظهر في قائمة المهام</li>
                <li>حذف مشروع أو تصنيف لن يحذف المهام المرتبطة به</li>
                <li>يمكنك تغيير اللون لتمييز كل مشروع أو تصنيف بصرياً</li>
                <li>خيار "مشروع آخر" سيبقى متاحاً دائماً لإضافة مشاريع مخصصة</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
