import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Bot,
  ArrowRight,
  Search,
  Activity,
  Mail,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Pause,
  XCircle,
  BarChart3,
  Users,
  TrendingUp,
  Filter,
  CalendarDays,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "لم تبدأ", color: "bg-gray-100 text-gray-700 border-gray-300", icon: ListTodo },
  progress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock },
  hold: { label: "معلقة", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Pause },
  done: { label: "مكتملة", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
  cancelled: { label: "ملغاة", color: "bg-red-100 text-red-700 border-red-300", icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "عالية", color: "bg-red-100 text-red-700" },
  medium: { label: "متوسطة", color: "bg-amber-100 text-amber-700" },
  low: { label: "منخفضة", color: "bg-green-100 text-green-700" },
};

const AGENT_INFO: Record<string, { role: string; color: string; bgColor: string }> = {
  "قاسم": { role: "وكيل الأرشفة والتنظيم", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  "سلوى": { role: "وكيلة التقييم والتحليل", color: "text-pink-700", bgColor: "bg-pink-100" },
};

export default function AgentDashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");

  // Data
  const { data: allTasks = [], isLoading } = trpc.tasks.list.useQuery();
  const { data: agentStats } = trpc.tasks.agentStats.useQuery();
  const { data: agentActivity = [] } = trpc.tasks.agentActivity.useQuery();
  const utils = trpc.useUtils();

  // Filter only agent tasks
  const agentTasks = useMemo(() => {
    return allTasks.filter((t: any) => t.source === "agent");
  }, [allTasks]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = agentTasks;

    if (filterAgent !== "all") {
      result = result.filter((t: any) => t.sourceAgent === filterAgent);
    }
    if (filterStatus !== "all") {
      result = result.filter((t: any) => t.status === filterStatus);
    }
    if (filterPriority !== "all") {
      result = result.filter((t: any) => t.priority === filterPriority);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t: any) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.project?.toLowerCase().includes(q) ||
          t.owner?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [agentTasks, filterAgent, filterStatus, filterPriority, searchQuery]);

  // Get unique agents
  const uniqueAgents = useMemo(() => {
    const agents = new Set(agentTasks.map((t: any) => t.sourceAgent).filter(Boolean));
    return Array.from(agents) as string[];
  }, [agentTasks]);

  // Stats calculations
  const statsData = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const total = agentTasks.length;
    const newCount = agentTasks.filter((t: any) => t.status === "new").length;
    const progressCount = agentTasks.filter((t: any) => t.status === "progress").length;
    const holdCount = agentTasks.filter((t: any) => t.status === "hold").length;
    const doneCount = agentTasks.filter((t: any) => t.status === "done").length;
    const cancelledCount = agentTasks.filter((t: any) => t.status === "cancelled").length;
    const overdueCount = agentTasks.filter(
      (t: any) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
    ).length;
    const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    return { total, new: newCount, progress: progressCount, hold: holdCount, done: doneCount, cancelled: cancelledCount, overdue: overdueCount, completionRate };
  }, [agentTasks]);

  // Project distribution
  const projectDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    agentTasks.forEach((t: any) => {
      dist[t.project] = (dist[t.project] || 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [agentTasks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">لوحة تحكم الوكلاء</h1>
                <p className="text-indigo-200 text-sm">متابعة وإدارة جميع مهام الوكلاء الذكية</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  utils.tasks.list.invalidate();
                  utils.tasks.agentStats.invalidate();
                  utils.tasks.agentActivity.invalidate();
                  toast.success("تم تحديث البيانات");
                }}
                className="text-white border-white/40 hover:bg-white/20 bg-transparent"
              >
                <RefreshCw className="w-4 h-4 ml-1" />
                تحديث
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="text-white border-white/40 hover:bg-white/20 bg-transparent"
              >
                <ArrowRight className="w-4 h-4 ml-1" />
                الرئيسية
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "إجمالي المهام", value: statsData.total, color: "bg-indigo-500", icon: ListTodo },
            { label: "لم تبدأ", value: statsData.new, color: "bg-gray-500", icon: ListTodo },
            { label: "قيد التنفيذ", value: statsData.progress, color: "bg-blue-500", icon: Clock },
            { label: "معلقة", value: statsData.hold, color: "bg-amber-500", icon: Pause },
            { label: "مكتملة", value: statsData.done, color: "bg-green-500", icon: CheckCircle2 },
            { label: "ملغاة", value: statsData.cancelled, color: "bg-red-500", icon: XCircle },
            { label: "متأخرة", value: statsData.overdue, color: "bg-orange-500", icon: AlertTriangle },
            { label: "نسبة الإنجاز", value: `${statsData.completionRate}%`, color: "bg-emerald-500", icon: TrendingUp },
          ].map((stat, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg ${stat.color} text-white flex items-center justify-center mx-auto mb-1.5`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Known agents */}
          {Object.entries(AGENT_INFO).map(([name, info]) => {
            const agentData = agentStats?.byAgent?.[name];
            const agentTaskCount = agentData?.total || 0;
            const agentDoneCount = agentData?.done || 0;
            const agentCompletionRate = agentTaskCount > 0 ? Math.round((agentDoneCount / agentTaskCount) * 100) : 0;
            const recentActivities = (agentActivity as any[]).filter((a: any) => a.agentName === name).slice(0, 3);

            return (
              <Card key={name} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${info.bgColor} flex items-center justify-center`}>
                      <Bot className={`w-6 h-6 ${info.color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{name}</h3>
                      <p className="text-sm text-muted-foreground">{info.role}</p>
                    </div>
                    <Badge className={`mr-auto ${agentTaskCount > 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                      {agentTaskCount > 0 ? `${agentTaskCount} مهمة` : "لا مهام"}
                    </Badge>
                  </div>

                  {agentTaskCount > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="font-bold text-gray-700">{agentData?.new || 0}</div>
                          <div className="text-muted-foreground">جديدة</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2">
                          <div className="font-bold text-blue-700">{agentData?.progress || 0}</div>
                          <div className="text-muted-foreground">تنفيذ</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2">
                          <div className="font-bold text-green-700">{agentData?.done || 0}</div>
                          <div className="text-muted-foreground">مكتملة</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-2">
                          <div className="font-bold text-indigo-700">{agentCompletionRate}%</div>
                          <div className="text-muted-foreground">إنجاز</div>
                        </div>
                      </div>
                      <Progress value={agentCompletionRate} className="h-1.5 mb-3" />
                    </>
                  ) : (
                    <div className="text-center py-3 text-sm text-muted-foreground">
                      في انتظار أول مهمة...
                    </div>
                  )}

                  {recentActivities.length > 0 && (
                    <div className="border-t pt-3 mt-1 space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground mb-1">آخر النشاطات</p>
                      {recentActivities.map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {a.action === "email_parsed" ? (
                            <Mail className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          ) : a.action === "task_created" ? (
                            <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          ) : (
                            <Activity className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{a.details}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs"
                    onClick={() => {
                      setFilterAgent(name);
                      setActiveTab("tasks");
                    }}
                  >
                    <Filter className="w-3 h-3 ml-1" />
                    عرض مهام {name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Dynamic agents not in AGENT_INFO */}
          {uniqueAgents
            .filter((name) => !AGENT_INFO[name])
            .map((name) => {
              const agentData = agentStats?.byAgent?.[name];
              return (
                <Card key={name} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{name}</h3>
                        <p className="text-sm text-muted-foreground">وكيل</p>
                      </div>
                      <Badge className="mr-auto bg-slate-100 text-slate-700">
                        {agentData?.total || 0} مهمة
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setFilterAgent(name);
                        setActiveTab("tasks");
                      }}
                    >
                      <Filter className="w-3 h-3 ml-1" />
                      عرض المهام
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Tabs: Tasks / Activity / Projects */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="tasks" className="gap-1.5">
              <ListTodo className="w-4 h-4" />
              المهام ({filteredTasks.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="w-4 h-4" />
              سجل النشاط ({(agentActivity as any[]).length})
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5">
              <BarChart3 className="w-4 h-4" />
              توزيع المشاريع
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            {/* Filters Bar */}
            <Card className="border-0 shadow-sm mb-4">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    فلترة:
                  </div>

                  <Select value={filterAgent} onValueChange={setFilterAgent}>
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                      <SelectValue placeholder="الوكيل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الوكلاء</SelectItem>
                      {uniqueAgents.map((agent) => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                      {/* Show known agents even if no tasks yet */}
                      {Object.keys(AGENT_INFO)
                        .filter((name) => !uniqueAgents.includes(name))
                        .map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          {val.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-[140px] h-9 text-sm">
                      <SelectValue placeholder="الأولوية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأولويات</SelectItem>
                      {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          {val.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث في المهام..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-9 h-9 text-sm"
                    />
                  </div>

                  {(filterAgent !== "all" || filterStatus !== "all" || filterPriority !== "all" || searchQuery) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterAgent("all");
                        setFilterStatus("all");
                        setFilterPriority("all");
                        setSearchQuery("");
                      }}
                      className="text-xs text-muted-foreground"
                    >
                      مسح الفلاتر
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tasks Table */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Bot className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground font-medium">لا توجد مهام مطابقة</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {agentTasks.length === 0
                        ? "لم يقم أي وكيل بإنشاء مهام بعد"
                        : "جرب تغيير معايير الفلترة"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50/80">
                          <th className="text-right p-3 font-medium text-muted-foreground">الوكيل</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">المهمة</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">المشروع</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">المسؤول</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">الأولوية</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">الحالة</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">التقدم</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">الموعد</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">تاريخ الإنشاء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((task: any) => {
                          const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.new;
                          const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                          const agentInfo = AGENT_INFO[task.sourceAgent] || { color: "text-slate-700", bgColor: "bg-slate-100" };
                          const today = new Date().toISOString().split("T")[0];
                          const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done" && task.status !== "cancelled";

                          return (
                            <tr key={task.id} className={`border-b hover:bg-slate-50/50 transition-colors ${isOverdue ? "bg-red-50/30" : ""}`}>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg ${agentInfo.bgColor} flex items-center justify-center`}>
                                    <Bot className={`w-3.5 h-3.5 ${agentInfo.color}`} />
                                  </div>
                                  <span className="font-medium text-xs">{task.sourceAgent || "—"}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="max-w-[250px]">
                                  <p className="font-medium text-sm truncate">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-xs font-normal">
                                  {task.project}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <span className="text-xs">{task.owner}</span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge className={`text-[10px] ${priorityInfo.color} border`}>
                                  {priorityInfo.label}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge className={`text-[10px] ${statusInfo.color} border`}>
                                  {statusInfo.label}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center gap-1.5 justify-center">
                                  <Progress value={task.progress || 0} className="h-1.5 w-12" />
                                  <span className="text-[10px] text-muted-foreground">{task.progress || 0}%</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {task.dueDate ? (
                                  <span className={`text-xs ${isOverdue ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                                    {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-0.5" />}
                                    {task.dueDate}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-xs text-muted-foreground">
                                  {task.createdAt ? new Date(task.createdAt).toLocaleDateString("ar-SA") : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  سجل نشاط الوكلاء
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(agentActivity as any[]).length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">لا يوجد نشاط مسجل بعد</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-indigo-100" />

                    <div className="space-y-4">
                      {(agentActivity as any[]).map((a: any, i: number) => {
                        const agentInfo = AGENT_INFO[a.agentName] || { color: "text-slate-700", bgColor: "bg-slate-100" };
                        return (
                          <div key={i} className="relative flex gap-4">
                            {/* Timeline dot */}
                            <div className={`w-10 h-10 rounded-xl ${agentInfo.bgColor} flex items-center justify-center z-10 flex-shrink-0`}>
                              {a.action === "email_parsed" ? (
                                <Mail className={`w-4 h-4 ${agentInfo.color}`} />
                              ) : a.action === "task_created" ? (
                                <Zap className={`w-4 h-4 ${agentInfo.color}`} />
                              ) : a.action === "bulk_tasks_created" ? (
                                <ListTodo className={`w-4 h-4 ${agentInfo.color}`} />
                              ) : (
                                <Activity className={`w-4 h-4 ${agentInfo.color}`} />
                              )}
                            </div>

                            <div className="flex-1 bg-white rounded-lg border p-3 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-sm ${agentInfo.color}`}>{a.agentName}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {a.action === "email_parsed"
                                      ? "تحليل بريد"
                                      : a.action === "task_created"
                                      ? "إنشاء مهمة"
                                      : a.action === "bulk_tasks_created"
                                      ? "مهام متعددة"
                                      : a.action}
                                  </Badge>
                                </div>
                                {a.createdAt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(a.createdAt).toLocaleString("ar-SA")}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{a.details}</p>
                              {a.project && (
                                <Badge variant="outline" className="text-[10px] mt-1.5">
                                  {a.project}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  توزيع المهام حسب المشروع
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projectDistribution.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">لا توجد بيانات بعد</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectDistribution.map(([project, count], i) => {
                      const percentage = statsData.total > 0 ? Math.round((count / statsData.total) * 100) : 0;
                      const projectTasks = agentTasks.filter((t: any) => t.project === project);
                      const doneTasks = projectTasks.filter((t: any) => t.status === "done").length;
                      const projectCompletion = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;

                      const colors = [
                        "bg-indigo-500",
                        "bg-purple-500",
                        "bg-blue-500",
                        "bg-emerald-500",
                        "bg-amber-500",
                        "bg-pink-500",
                      ];

                      return (
                        <div key={project} className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                              <span className="font-medium">{project}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">{count} مهمة</span>
                              <Badge variant="outline" className="text-[10px]">
                                {percentage}%
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={projectCompletion} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-16 text-left">
                              إنجاز {projectCompletion}%
                            </span>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>جديدة: {projectTasks.filter((t: any) => t.status === "new").length}</span>
                            <span>تنفيذ: {projectTasks.filter((t: any) => t.status === "progress").length}</span>
                            <span>مكتملة: {doneTasks}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* API Documentation Card */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-indigo-800">نقاط اتصال الوكلاء (API)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { method: "POST", path: "/api/agent/task", desc: "إنشاء مهمة مباشرة" },
                { method: "POST", path: "/api/agent/email-to-task", desc: "تحليل إيميل → مهام" },
                { method: "POST", path: "/api/agent/bulk-tasks", desc: "إنشاء مهام متعددة" },
                { method: "GET", path: "/api/agent/tasks", desc: "قائمة مهام الوكيل" },
                { method: "GET", path: "/api/agent/activity", desc: "سجل النشاط" },
                { method: "POST", path: "/api/agent/notify", desc: "إرسال إشعار للمدير" },
              ].map((api, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-indigo-100 flex items-center gap-2">
                  <Badge className={`text-[10px] px-1.5 ${api.method === "POST" ? "bg-green-600" : "bg-blue-600"} text-white`}>
                    {api.method}
                  </Badge>
                  <code className="text-[11px] text-slate-600 font-mono">{api.path}</code>
                  <span className="text-[10px] text-muted-foreground mr-auto">{api.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
