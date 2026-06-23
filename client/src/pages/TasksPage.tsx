import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Plus,
  ArrowRight,
  Pencil,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ListTodo,
  Clock,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Pause,
  Bot,
  User,
  Terminal,
  Search,
  Activity,
  Mail,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { Settings } from "lucide-react";

// Fallback defaults (used while loading from DB)
const DEFAULT_PROJECTS = [
  "إداري",
  "ند الشبا",
  "الجداف",
  "الفلل",
  "المول",
  "مبنى مجان",
];

const DEFAULT_CATEGORIES = [
  "تصميم",
  "تراخيص",
  "قانوني",
  "مالي",
  "مقاولين",
  "مبيعات / تسويق",
  "تشغيل",
];

type TaskFormData = {
  title: string;
  description: string;
  project: string;
  customProject: string;
  category: string;
  owner: string;
  priority: "high" | "medium" | "low";
  status: "new" | "progress" | "hold" | "done" | "cancelled";
  progress: number;
  dueDate: string;
  attachment: string;
  source: "manual" | "agent" | "command";
  sourceAgent: string;
};

const emptyForm: TaskFormData = {
  title: "",
  description: "",
  project: "",
  customProject: "",
  category: "",
  owner: "",
  priority: "medium",
  status: "new",
  progress: 0,
  dueDate: "",
  attachment: "",
  source: "manual",
  sourceAgent: "",
};

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskFormData>({ ...emptyForm });

  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const utils = trpc.useUtils();
  const { data: allTasks = [], isLoading } = trpc.tasks.list.useQuery();
  const { data: stats } = trpc.tasks.stats.useQuery();
  const { data: agentStats } = trpc.tasks.agentStats.useQuery();
  const { data: agentActivity = [] } = trpc.tasks.agentActivity.useQuery();

  // Dynamic projects & categories from DB
  const { data: dbProjects } = trpc.taskSettings.listProjects.useQuery();
  const { data: dbCategories } = trpc.taskSettings.listCategories.useQuery();
  const PROJECTS = (dbProjects && dbProjects.length > 0)
    ? dbProjects.filter((p: any) => p.isActive === 'true').map((p: any) => p.name)
    : DEFAULT_PROJECTS;
  const CATEGORIES = (dbCategories && dbCategories.length > 0)
    ? dbCategories.filter((c: any) => c.isActive === 'true').map((c: any) => c.name)
    : DEFAULT_CATEGORIES;

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.stats.invalidate();
      setIsModalOpen(false);
      toast.success("تم إضافة المهمة بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء إضافة المهمة"),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.stats.invalidate();
      setIsModalOpen(false);
      setEditingId(null);
      toast.success("تم تحديث المهمة بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء تحديث المهمة"),
  });

  const markDoneMutation = trpc.tasks.markDone.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.stats.invalidate();
      toast.success("تم إنهاء المهمة");
    },
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.stats.invalidate();
      toast.success("تم حذف المهمة");
    },
  });

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (filterStatus && filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterProject && filterProject !== "all") {
        if (filterProject === "مشروع آخر") {
          if (PROJECTS.includes(task.project)) return false;
        } else if (task.project !== filterProject) {
          return false;
        }
      }
      if (filterPriority && filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterOwner && !task.owner.toLowerCase().includes(filterOwner.toLowerCase())) return false;
      if (filterSearch) {
        const text = `${task.title} ${task.description || ""}`.toLowerCase();
        if (!text.includes(filterSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [allTasks, filterStatus, filterProject, filterPriority, filterOwner, filterSearch]);

  const isOverdue = (task: { dueDate: string | null; status: string }) => {
    if (!task.dueDate) return false;
    if (task.status === "done" || task.status === "cancelled") return false;
    const today = new Date().toISOString().split("T")[0];
    return task.dueDate < today;
  };

  const openNewTask = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  const openEditTask = (task: any) => {
    setEditingId(task.id);
    const isCustomProject = !PROJECTS.includes(task.project);
    setForm({
      title: task.title,
      description: task.description || "",
      project: isCustomProject ? "مشروع آخر" : task.project,
      customProject: isCustomProject ? task.project : "",
      category: task.category || "",
      owner: task.owner,
      priority: task.priority,
      status: task.status,
      progress: task.progress,
      dueDate: task.dueDate || "",
      attachment: task.attachment || "",
      source: task.source || "manual",
      sourceAgent: task.sourceAgent || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const projectValue = form.project === "مشروع آخر" ? form.customProject : form.project;
    if (!form.title || !projectValue || !form.owner) {
      toast.error("الرجاء تعبئة الحقول الإلزامية (العنوان، المشروع، المسؤول)");
      return;
    }

    const data = {
      title: form.title,
      description: form.description || null,
      project: projectValue,
      category: form.category || null,
      owner: form.owner,
      priority: form.priority,
      status: form.status,
      progress: form.progress,
      dueDate: form.dueDate || null,
      attachment: form.attachment || null,
      source: form.source,
      sourceAgent: form.sourceAgent || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("هل تريد حذف هذه المهمة؟")) {
      deleteMutation.mutate(id);
    }
  };

  const resetFilters = () => {
    setFilterStatus("");
    setFilterProject("");
    setFilterPriority("");
    setFilterOwner("");
    setFilterSearch("");
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">عالية</Badge>;
      case "medium":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">متوسطة</Badge>;
      case "low":
        return <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">منخفضة</Badge>;
      default:
        return null;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="secondary" className="bg-gray-500 text-white hover:bg-gray-600 text-xs">لم تبدأ</Badge>;
      case "progress":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs">قيد التنفيذ</Badge>;
      case "hold":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs">معلقة</Badge>;
      case "done":
        return <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">مكتملة</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">ملغاة</Badge>;
      default:
        return null;
    }
  };

  const sourceBadge = (source: string, agent?: string | null) => {
    switch (source) {
      case "agent":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-purple-600">
            <Bot className="w-3 h-3" />
            {agent || "وكيل"}
          </span>
        );
      case "command":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
            <Terminal className="w-3 h-3" />
            أمر
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <User className="w-3 h-3" />
            يدوي
          </span>
        );
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-lg">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">لوحة المهام</h1>
            <p className="text-blue-100 text-sm">
              متابعة مهام المشاريع — إدخال يدوي وذكي من الوكلاء
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={openNewTask}
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold"
              size="sm"
            >
              <Plus className="w-4 h-4 ml-1" />
              مهمة جديدة
            </Button>
            <Link href="/task-settings">
              <Button
                variant="outline"
                className="text-white border-white/50 hover:bg-white/10"
                size="sm"
              >
                <Settings className="w-4 h-4 ml-1" />
                إعدادات
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="text-white border-white/50 hover:bg-white/10"
              size="sm"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              الرئيسية
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 space-y-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="border-r-4 border-r-gray-400">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <ListTodo className="w-3 h-3" /> الكل
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-gray-500">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.new}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> لم تبدأ
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.progress}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3" /> قيد التنفيذ
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-yellow-500">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.hold}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Pause className="w-3 h-3" /> معلقة
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.done}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <CheckCheck className="w-3 h-3" /> مكتملة
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-red-400">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-500">{stats.cancelled}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3" /> ملغاة
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-red-600">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> متأخرة
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الحالة</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="new">لم تبدأ</SelectItem>
                    <SelectItem value="progress">قيد التنفيذ</SelectItem>
                    <SelectItem value="hold">معلقة</SelectItem>
                    <SelectItem value="done">مكتملة</SelectItem>
                    <SelectItem value="cancelled">ملغاة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">المشروع</Label>
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="كل المشاريع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المشاريع</SelectItem>
                    {PROJECTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="مشروع آخر">مشاريع أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الأولوية</Label>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="high">عاجلة / عالية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="low">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">المسؤول</Label>
                <Input
                  value={filterOwner}
                  onChange={(e) => setFilterOwner(e.target.value)}
                  placeholder="بحث بالاسم"
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">بحث</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="جزء من العنوان أو الوصف"
                    className="h-9 pr-8"
                  />
                </div>
              </div>

              <div>
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="w-full h-9"
                  size="sm"
                >
                  مسح الفلاتر
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">#</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">عنوان المهمة</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">المشروع</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">النوع</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">المسؤول</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">الموعد</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">الأولوية</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">الحالة</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">التقدم</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">المصدر</th>
                    <th className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>لا توجد مهام</p>
                        <Button onClick={openNewTask} variant="link" className="mt-2">
                          إضافة مهمة جديدة
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task, index) => (
                      <tr
                        key={task.id}
                        className={`border-b hover:bg-slate-50/50 transition-colors ${
                          isOverdue(task) ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="p-3 text-muted-foreground">{index + 1}</td>
                        <td className="p-3 max-w-[250px]">
                          <div className={task.status === "done" ? "line-through opacity-60" : ""}>
                            <span className="font-medium">{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{task.project || "-"}</td>
                        <td className="p-3 whitespace-nowrap">{task.category || "-"}</td>
                        <td className="p-3 whitespace-nowrap">{task.owner || "-"}</td>
                        <td className="p-3 whitespace-nowrap">
                          {task.dueDate ? (
                            <span className={isOverdue(task) ? "text-red-600 font-medium" : ""}>
                              {task.dueDate}
                              {isOverdue(task) && (
                                <AlertTriangle className="w-3 h-3 inline mr-1 text-red-500" />
                              )}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-3">{priorityBadge(task.priority)}</td>
                        <td className="p-3">{statusBadge(task.status)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <span className="text-xs w-8">{task.progress}%</span>
                            <Progress value={task.progress} className="h-1.5 flex-1" />
                          </div>
                        </td>
                        <td className="p-3">{sourceBadge(task.source, task.sourceAgent)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditTask(task)}
                              title="تعديل"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            </Button>
                            {task.status !== "done" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => markDoneMutation.mutate(task.id)}
                                title="إنهاء"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              </Button>
                            )}
                            {task.attachment && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => window.open(task.attachment!, "_blank")}
                                title="فتح الملف"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDelete(task.id)}
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* Agent Activity Panel */}
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
          <CardContent className="p-4">
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-800">نشاط الوكلاء</h3>
                {agentStats && agentStats.totalAgentTasks > 0 && (
                  <Badge className="bg-purple-600 text-white text-xs">
                    {agentStats.totalAgentTasks} مهمة
                  </Badge>
                )}
              </div>
              {showAgentPanel ? (
                <ChevronUp className="w-5 h-5 text-purple-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-purple-600" />
              )}
            </button>

            {showAgentPanel && (
              <div className="mt-4 space-y-4">
                {/* Agent Stats Cards */}
                {agentStats && Object.keys(agentStats.byAgent).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(agentStats.byAgent).map(([name, data]) => (
                      <Card key={name} className="border-purple-100">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <span className="font-bold text-sm">{name}</span>
                              <span className="text-xs text-muted-foreground block">
                                {name === "ألينا" ? "المديرة المالية" : name === "سلوى" ? "المنسقة" : "وكيل"}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-center text-xs">
                            <div>
                              <div className="font-bold text-purple-700">{data.total}</div>
                              <div className="text-muted-foreground">الكل</div>
                            </div>
                            <div>
                              <div className="font-bold text-gray-600">{data.new}</div>
                              <div className="text-muted-foreground">جديدة</div>
                            </div>
                            <div>
                              <div className="font-bold text-blue-600">{data.progress}</div>
                              <div className="text-muted-foreground">تنفيذ</div>
                            </div>
                            <div>
                              <div className="font-bold text-green-600">{data.done}</div>
                              <div className="text-muted-foreground">مكتملة</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>لم يقم أي وكيل بإنشاء مهام بعد</p>
                    <p className="text-xs mt-1">الوكلاء (ألينا، سلوى) سيبدأون بإنشاء المهام تلقائياً من رسائل البريد الإلكتروني</p>
                  </div>
                )}

                {/* Recent Agent Activity Log */}
                {agentActivity.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      آخر الأنشطة
                    </h4>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {agentActivity.slice(0, 10).map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs bg-white rounded-md p-2 border border-purple-100">
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {a.action === "email_parsed" ? (
                              <Mail className="w-3 h-3 text-purple-600" />
                            ) : a.action === "task_created" ? (
                              <Zap className="w-3 h-3 text-purple-600" />
                            ) : (
                              <Activity className="w-3 h-3 text-purple-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-purple-700">{a.agentName}</span>
                              <span className="text-muted-foreground">
                                {a.action === "email_parsed" ? "حلّل بريد إلكتروني" :
                                 a.action === "task_created" ? "أنشأ مهمة" :
                                 a.action === "bulk_tasks_created" ? "أنشأ مهام متعددة" : a.action}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5">{a.details}</p>
                            {a.createdAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(a.createdAt).toLocaleString("ar-SA")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* API Info */}
                <div className="bg-white rounded-md p-3 border border-purple-100 text-xs">
                  <h4 className="font-bold text-purple-700 mb-1">نقاط الاتصال (API Endpoints)</h4>
                  <div className="space-y-1 font-mono text-[11px] text-slate-600">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 text-white text-[10px] px-1.5">POST</Badge>
                      <span>/api/agent/task</span>
                      <span className="text-muted-foreground">— إنشاء مهمة مباشرة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 text-white text-[10px] px-1.5">POST</Badge>
                      <span>/api/agent/email-to-task</span>
                      <span className="text-muted-foreground">— تحليل إيميل وإنشاء مهام</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 text-white text-[10px] px-1.5">POST</Badge>
                      <span>/api/agent/bulk-tasks</span>
                      <span className="text-muted-foreground">— إنشاء مهام متعددة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-[10px] px-1.5">GET</Badge>
                      <span>/api/agent/tasks</span>
                      <span className="text-muted-foreground">— قائمة مهام الوكيل</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-[10px] px-1.5">GET</Badge>
                      <span>/api/agent/activity</span>
                      <span className="text-muted-foreground">— سجل النشاط</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "تعديل مهمة" : "إضافة مهمة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>عنوان المهمة *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="أدخل عنوان المهمة"
              />
            </div>

            <div>
              <Label>المشروع *</Label>
              <Select
                value={form.project}
                onValueChange={(v) => setForm({ ...form, project: v, customProject: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المشروع" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                  <SelectItem value="مشروع آخر">مشروع آخر...</SelectItem>
                </SelectContent>
              </Select>
              {form.project === "مشروع آخر" && (
                <Input
                  className="mt-2"
                  value={form.customProject}
                  onChange={(e) => setForm({ ...form, customProject: e.target.value })}
                  placeholder="اكتب اسم المشروع الجديد"
                />
              )}
            </div>

            <div>
              <Label>نوع المهمة</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="غير محدد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير محدد</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>المسؤول *</Label>
              <Input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                placeholder="اسم المسؤول"
              />
            </div>

            <div>
              <Label>الموعد المتوقع</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <div>
              <Label>الأولوية</Label>
              <Select
                value={form.priority}
                onValueChange={(v: any) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">عاجلة / عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>الحالة</Label>
              <Select
                value={form.status}
                onValueChange={(v: any) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">لم تبدأ</SelectItem>
                  <SelectItem value="progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="hold">معلقة</SelectItem>
                  <SelectItem value="done">مكتملة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>نسبة الإنجاز ({form.progress}%)</Label>
              <Input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>رابط ملف / مرفق</Label>
              <Input
                value={form.attachment}
                onChange={(e) => setForm({ ...form, attachment: e.target.value })}
                placeholder="رابط Google Drive أو أي ملف آخر"
              />
            </div>

            <div>
              <Label>مصدر المهمة</Label>
              <Select
                value={form.source}
                onValueChange={(v: any) => setForm({ ...form, source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">يدوي</SelectItem>
                  <SelectItem value="agent">وكيل (Agent)</SelectItem>
                  <SelectItem value="command">أمر (Command)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.source !== "manual" && (
              <div>
                <Label>اسم المنشئ / الوكيل</Label>
                <Input
                  value={form.sourceAgent}
                  onChange={(e) => setForm({ ...form, sourceAgent: e.target.value })}
                  placeholder={form.source === "agent" ? "مثال: ألينا، سلوى" : "اسم المنشئ"}
                />
              </div>
            )}

            <div className="md:col-span-2">
              <Label>وصف / ملاحظات</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="تفاصيل إضافية عن المهمة..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              )}
              حفظ المهمة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
