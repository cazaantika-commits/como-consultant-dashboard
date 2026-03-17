import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Newspaper,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";

const COLOR_OPTIONS = [
  { label: "أخضر", value: "#10b981" },
  { label: "بنفسجي", value: "#6366f1" },
  { label: "برتقالي", value: "#f59e0b" },
  { label: "أزرق سماوي", value: "#06b6d4" },
  { label: "أحمر", value: "#ef4444" },
  { label: "وردي", value: "#ec4899" },
  { label: "أزرق", value: "#3b82f6" },
  { label: "رمادي", value: "#6b7280" },
];

export default function NewsTickerManagePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("#f59e0b");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: newsItems, refetch } = trpc.newsTicker.getAll.useQuery();
  const createMutation = trpc.newsTicker.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewTitle("");
      toast({ title: "تمت الإضافة", description: "تم إضافة الخبر بنجاح" });
    },
  });
  const updateMutation = trpc.newsTicker.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
      toast({ title: "تم التحديث", description: "تم تحديث الخبر بنجاح" });
    },
  });
  const deleteMutation = trpc.newsTicker.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast({ title: "تم الحذف", description: "تم حذف الخبر بنجاح" });
    },
  });
  const toggleMutation = trpc.newsTicker.toggleActive.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({ title: newTitle.trim(), color: newColor });
  };

  const handleStartEdit = (item: { id: number; title: string; color: string | null }) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditColor(item.color || "#f59e0b");
  };

  const handleSaveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    updateMutation.mutate({ id: editingId, title: editTitle.trim(), color: editColor });
  };

  const handleMoveUp = (item: { id: number; sortOrder: number }, index: number) => {
    if (!newsItems || index === 0) return;
    const prevItem = newsItems[index - 1];
    updateMutation.mutate({ id: item.id, sortOrder: prevItem.sortOrder });
    updateMutation.mutate({ id: prevItem.id, sortOrder: item.sortOrder });
  };

  const handleMoveDown = (item: { id: number; sortOrder: number }, index: number) => {
    if (!newsItems || index === newsItems.length - 1) return;
    const nextItem = newsItems[index + 1];
    updateMutation.mutate({ id: item.id, sortOrder: nextItem.sortOrder });
    updateMutation.mutate({ id: nextItem.id, sortOrder: item.sortOrder });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Newspaper className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">إدارة شريط الأخبار</h1>
              <p className="text-sm text-slate-500">إضافة وتعديل وحذف الأخبار المتحركة</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            الرئيسية
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Add New News Item */}
        <Card className="border-dashed border-2 border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <Plus className="w-5 h-5" />
              إضافة خبر جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="اكتب نص الخبر هنا..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="text-right"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-600 ml-2">اللون:</span>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    newColor === c.value
                      ? "border-slate-800 scale-110 shadow-md"
                      : "border-transparent hover:border-slate-300"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-2 rounded-full"
                style={{ backgroundColor: newColor + "30" }}
              >
                <div
                  className="h-full rounded-full w-1/3"
                  style={{ backgroundColor: newColor }}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newTitle.trim() || createMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing News Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-700">
              الأخبار الحالية ({newsItems?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!newsItems || newsItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد أخبار بعد. أضف أول خبر!</p>
              </div>
            ) : (
              newsItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    item.isActive === 1
                      ? "bg-white border-slate-200"
                      : "bg-slate-50 border-slate-100 opacity-60"
                  }`}
                >
                  {/* Color indicator */}
                  <div
                    className="w-3 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color || "#f59e0b" }}
                  />

                  {/* Content */}
                  {editingId === item.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-right"
                        autoFocus
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setEditColor(c.value)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              editColor === c.value
                                ? "border-slate-800 scale-110"
                                : "border-transparent hover:border-slate-300"
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm font-medium text-slate-700 truncate">
                      {item.title}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingId === item.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={handleSaveEdit}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => handleMoveUp(item, index)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => handleMoveDown(item, index)}
                          disabled={index === (newsItems?.length || 0) - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleStartEdit(item)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => toggleMutation.mutate({ id: item.id })}
                        >
                          {item.isActive === 1 ? (
                            <Eye className="w-4 h-4 text-green-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذا الخبر؟")) {
                              deleteMutation.mutate({ id: item.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {newsItems && newsItems.filter((i) => i.isActive === 1).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-700">معاينة الشريط</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-l from-amber-50 to-orange-50 rounded-xl border border-amber-200 py-3 overflow-hidden">
                <div className="flex animate-marquee whitespace-nowrap gap-8">
                  {[...Array(2)].map((_, rep) =>
                    newsItems
                      .filter((i) => i.isActive === 1)
                      .map((item) => (
                        <span
                          key={`${rep}-${item.id}`}
                          className="inline-flex items-center gap-2 text-sm font-medium"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color || "#f59e0b" }}
                          />
                          <span className="text-slate-700">{item.title}</span>
                        </span>
                      ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
