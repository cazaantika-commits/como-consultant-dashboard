import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Plus, Edit2, Trash2, Save, X, BookOpen, Scale, Building2, 
  Hammer, DollarSign, Users, Star, RefreshCw, Briefcase, Ruler, FileText,
  BarChart3, Eye, ChevronDown, ChevronUp
} from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const DOMAIN_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  rera_law: { label: "قوانين RERA", icon: Scale, color: "bg-red-500/10 text-red-600 border-red-200" },
  dubai_municipality: { label: "بلدية دبي", icon: Building2, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  building_codes: { label: "كودات البناء", icon: Hammer, color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  market_prices: { label: "أسعار السوق", icon: DollarSign, color: "bg-green-500/10 text-green-600 border-green-200" },
  como_context: { label: "سياق COMO", icon: Briefcase, color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  como_people: { label: "فريق COMO", icon: Users, color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
  como_preferences: { label: "تفضيلات COMO", icon: Star, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  como_workflow: { label: "طريقة عمل COMO", icon: RefreshCw, color: "bg-teal-500/10 text-teal-600 border-teal-200" },
  consultant_info: { label: "الاستشاريون", icon: Users, color: "bg-cyan-500/10 text-cyan-600 border-cyan-200" },
  project_standards: { label: "معايير المشاريع", icon: Ruler, color: "bg-pink-500/10 text-pink-600 border-pink-200" },
  general: { label: "عام", icon: FileText, color: "bg-gray-500/10 text-gray-600 border-gray-200" },
};

const DOMAINS = Object.keys(DOMAIN_CONFIG);

interface KnowledgeItem {
  id: number;
  domain: string;
  category: string;
  title: string;
  content: string;
  keywords?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  addedBy?: string | null;
  useCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface FormData {
  domain: string;
  category: string;
  title: string;
  content: string;
  keywords: string;
  source: string;
  sourceUrl: string;
}

const emptyForm: FormData = {
  domain: "general",
  category: "",
  title: "",
  content: "",
  keywords: "",
  source: "",
  sourceUrl: "",
};

export default function SpecialistKnowledgePage() {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.specialistKnowledge.list.useQuery({
    domain: selectedDomain !== "all" ? selectedDomain : undefined,
    search: searchTerm.length > 1 ? searchTerm : undefined,
    limit: 100,
  });

  const { data: stats } = trpc.specialistKnowledge.stats.useQuery();

  const createMutation = trpc.specialistKnowledge.create.useMutation({
    onSuccess: () => {
      toast.success("تمت الإضافة بنجاح");
      setShowCreateDialog(false);
      setFormData(emptyForm);
      utils.specialistKnowledge.list.invalidate();
      utils.specialistKnowledge.stats.invalidate();
    },
    onError: (err) => {
      toast.error("خطأ في الإضافة", { description: err.message });
    },
  });

  const updateMutation = trpc.specialistKnowledge.update.useMutation({
    onSuccess: () => {
      toast.success("تم التحديث بنجاح");
      setEditingId(null);
      utils.specialistKnowledge.list.invalidate();
    },
    onError: (err) => {
      toast.error("خطأ في التحديث", { description: err.message });
    },
  });

  const deactivateMutation = trpc.specialistKnowledge.deactivate.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف بنجاح");
      setShowDeleteDialog(null);
      utils.specialistKnowledge.list.invalidate();
      utils.specialistKnowledge.stats.invalidate();
    },
    onError: (err) => {
      toast.error("خطأ في الحذف", { description: err.message });
    },
  });

  const handleCreate = () => {
    if (!formData.title || !formData.content || !formData.category) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }
    createMutation.mutate({
      domain: formData.domain as any,
      category: formData.category,
      title: formData.title,
      content: formData.content,
      keywords: formData.keywords ? formData.keywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      source: formData.source || undefined,
      sourceUrl: formData.sourceUrl || undefined,
    });
  };

  const handleUpdate = (item: KnowledgeItem) => {
    updateMutation.mutate({
      id: item.id,
      title: formData.title || undefined,
      content: formData.content || undefined,
      category: formData.category || undefined,
      keywords: formData.keywords ? formData.keywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      source: formData.source || undefined,
    });
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    let kw = "";
    try {
      const parsed = item.keywords ? JSON.parse(item.keywords) : [];
      kw = Array.isArray(parsed) ? parsed.join(", ") : "";
    } catch { kw = item.keywords || ""; }
    setFormData({
      domain: item.domain,
      category: item.category,
      title: item.title,
      content: item.content,
      keywords: kw,
      source: item.source || "",
      sourceUrl: item.sourceUrl || "",
    });
  };

  const itemsList = useMemo(() => {
    if (!items) return [];
    return items as KnowledgeItem[];
  }, [items]);

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">قاعدة المعرفة المتخصصة</h1>
          <p className="text-muted-foreground">
            المعرفة التي يستخدمها الوكلاء: قوانين، معايير، أسعار، سياق الشركة
          </p>
        </div>
        <Button onClick={() => { setFormData(emptyForm); setShowCreateDialog(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة معرفة
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {stats.byDomain?.map((d: any) => {
            const config = DOMAIN_CONFIG[d.domain] || DOMAIN_CONFIG.general;
            const Icon = config.icon;
            return (
              <Card 
                key={d.domain} 
                className={`cursor-pointer transition-all hover:shadow-md ${selectedDomain === d.domain ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedDomain(selectedDomain === d.domain ? "all" : d.domain)}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${config.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{config.label}</div>
                    <div className="font-bold text-lg leading-tight">{d.count}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card className={`cursor-pointer transition-all hover:shadow-md ${selectedDomain === "all" ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedDomain("all")}>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <BarChart3 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">الكل</div>
                <div className="font-bold text-lg leading-tight">{stats.totalEntries || 0}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث في المعرفة المتخصصة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل المجالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المجالات</SelectItem>
            {DOMAINS.map(d => (
              <SelectItem key={d} value={d}>{DOMAIN_CONFIG[d].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        )}

        {!isLoading && itemsList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">لا توجد نتائج</p>
              <p className="text-sm">جرب تغيير الفلتر أو أضف معرفة جديدة</p>
            </CardContent>
          </Card>
        )}

        {itemsList.map((item) => {
          const config = DOMAIN_CONFIG[item.domain] || DOMAIN_CONFIG.general;
          const Icon = config.icon;
          const isExpanded = expandedId === item.id;
          const isEditing = editingId === item.id;
          let parsedKeywords: string[] = [];
          try {
            const parsed = item.keywords ? JSON.parse(item.keywords) : [];
            parsedKeywords = Array.isArray(parsed) ? parsed : [];
          } catch { /* ignore */ }

          return (
            <Card key={item.id} className={`transition-all ${isEditing ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <Input
                          value={formData.title}
                          onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                          className="font-bold text-lg mb-1"
                        />
                      ) : (
                        <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={config.color}>{config.label}</Badge>
                        <Badge variant="secondary">{item.category}</Badge>
                        {item.source && <Badge variant="outline" className="text-xs">{item.source}</Badge>}
                        {item.useCount ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {item.useCount} استخدام
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { handleUpdate(item); }}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShowDeleteDialog(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">الفئة</label>
                        <Input
                          value={formData.category}
                          onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                          placeholder="الفئة الفرعية"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">المصدر</label>
                        <Input
                          value={formData.source}
                          onChange={(e) => setFormData(p => ({ ...p, source: e.target.value }))}
                          placeholder="المصدر"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">المحتوى</label>
                      <Textarea
                        value={formData.content}
                        onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">كلمات مفتاحية (مفصولة بفاصلة)</label>
                      <Input
                        value={formData.keywords}
                        onChange={(e) => setFormData(p => ({ ...p, keywords: e.target.value }))}
                        placeholder="RERA, تسجيل, رسوم"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {item.content}
                    </p>
                    {parsedKeywords.length > 0 && isExpanded && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {parsedKeywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    )}
                    {isExpanded && item.addedBy && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        أضافه: {item.addedBy} • {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : ''}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة معرفة جديدة</DialogTitle>
            <DialogDescription>أضف معلومة متخصصة ليستخدمها الوكلاء في عملهم</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">المجال *</label>
                <Select value={formData.domain} onValueChange={(v) => setFormData(p => ({ ...p, domain: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map(d => (
                      <SelectItem key={d} value={d}>{DOMAIN_CONFIG[d].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">الفئة *</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                  placeholder="مثال: رسوم التسجيل، معايير المواقف"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">العنوان *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="عنوان واضح ومختصر"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">المحتوى *</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                rows={8}
                placeholder="المعلومة التفصيلية التي سيستخدمها الوكلاء..."
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">كلمات مفتاحية</label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData(p => ({ ...p, keywords: e.target.value }))}
                  placeholder="RERA, تسجيل, رسوم (مفصولة بفاصلة)"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">المصدر</label>
                <Input
                  value={formData.source}
                  onChange={(e) => setFormData(p => ({ ...p, source: e.target.value }))}
                  placeholder="قانون رقم X، موقع RERA، إلخ"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه المعرفة؟ يمكن استعادتها لاحقاً.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>إلغاء</Button>
            <Button 
              variant="destructive" 
              onClick={() => showDeleteDialog && deactivateMutation.mutate({ id: showDeleteDialog })}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
