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
  TrendingUp,
  Filter,
  FileText,
  RefreshCw,
  Crown,
  Archive,
  Scale,
  Gauge,
  ShieldCheck,
  Calculator,
  Rocket,
  BarChart2,
  Send,
  Building2,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "لم تبدأ", color: "bg-slate-100 text-slate-600 border-slate-200", icon: ListTodo },
  progress: { label: "قيد التنفيذ", color: "bg-amber-50 text-amber-600 border-amber-200", icon: Clock },
  hold: { label: "معلقة", color: "bg-amber-50 text-amber-600 border-amber-200", icon: Pause },
  done: { label: "مكتملة", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "ملغاة", color: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "عالية", color: "bg-red-50 text-red-600" },
  medium: { label: "متوسطة", color: "bg-amber-50 text-amber-600" },
  low: { label: "منخفضة", color: "bg-emerald-50 text-emerald-600" },
};

const AGENT_ICONS: Record<string, any> = {
  crown: Crown,
  archive: Archive,
  scale: Scale,
  gauge: Gauge,
  "shield-check": ShieldCheck,
  calculator: Calculator,
  rocket: Rocket,
  "bar-chart-2": BarChart2,
};

export default function AgentDashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("agents");

  const { data: allTasks = [], isLoading } = trpc.tasks.list.useQuery();
  const { data: agentStats } = trpc.tasks.agentStats.useQuery();
  const { data: agentActivity = [] } = trpc.tasks.agentActivity.useQuery();
  const { data: agentsList = [] } = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const agentTasks = useMemo(() => {
    return allTasks.filter((t: any) => t.source === "agent");
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    let result = agentTasks;
    if (filterAgent !== "all") result = result.filter((t: any) => t.sourceAgent === filterAgent);
    if (filterStatus !== "all") result = result.filter((t: any) => t.status === filterStatus);
    if (filterPriority !== "all") result = result.filter((t: any) => t.priority === filterPriority);
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

  const uniqueAgents = useMemo(() => {
    const agents = new Set(agentTasks.map((t: any) => t.sourceAgent).filter(Boolean));
    return Array.from(agents) as string[];
  }, [agentTasks]);

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

  const projectDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    agentTasks.forEach((t: any) => { dist[t.project] = (dist[t.project] || 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [agentTasks]);

  const coordinator = useMemo(() => agentsList.find((a: any) => a.isCoordinator === 1), [agentsList]);
  const teamAgents = useMemo(() => agentsList.filter((a: any) => a.isCoordinator !== 1), [agentsList]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">لوحة تحكم الوكلاء</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">متابعة وإدارة فريق الوكلاء الذكيين</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                utils.tasks.list.invalidate();
                utils.tasks.agentStats.invalidate();
                utils.tasks.agentActivity.invalidate();
                utils.agents.list.invalidate();
                toast.success("تم تحديث البيانات");
              }}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="text-xs gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              الرئيسية
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "إجمالي المهام", value: statsData.total, color: "text-primary", accent: "oklch(0.45 0.12 255)" },
            { label: "لم تبدأ", value: statsData.new, color: "text-slate-600", accent: "oklch(0.55 0.01 260)" },
            { label: "قيد التنفيذ", value: statsData.progress, color: "text-amber-600", accent: "oklch(0.65 0.15 60)" },
            { label: "معلقة", value: statsData.hold, color: "text-amber-600", accent: "oklch(0.65 0.18 70)" },
            { label: "مكتملة", value: statsData.done, color: "text-emerald-600", accent: "oklch(0.55 0.17 155)" },
            { label: "ملغاة", value: statsData.cancelled, color: "text-red-600", accent: "oklch(0.55 0.2 25)" },
            { label: "متأخرة", value: statsData.overdue, color: "text-orange-600", accent: "oklch(0.6 0.18 45)" },
            { label: "نسبة الإنجاز", value: `${statsData.completionRate}%`, color: "text-emerald-600", accent: "oklch(0.55 0.17 155)" },
          ].map((stat, i) => (
            <div key={i} className="kpi-card text-center" style={{ '--kpi-accent': stat.accent } as any}>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="agents" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Bot className="w-4 h-4" />
              الوكلاء ({agentsList.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <ListTodo className="w-4 h-4" />
              المهام ({filteredTasks.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Activity className="w-4 h-4" />
              سجل النشاط ({(agentActivity as any[]).length})
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <BarChart3 className="w-4 h-4" />
              المشاريع
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="mt-4">
            {/* Coordinator */}
            {coordinator && (
              <div className="mb-6">
                <div className="premium-card p-6 gold-glow">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${coordinator.color}20`, border: `2px solid ${coordinator.color}50` }}>
                      {(() => {
                        const IconComp = AGENT_ICONS[coordinator.icon || "crown"] || Crown;
                        return <IconComp className="w-8 h-8" style={{ color: coordinator.color }} />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gold-gradient">{coordinator.name}</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">المنسقة</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1 font-medium">
                          <Send className="w-3 h-3" />
                          تيليجرام
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{coordinator.role}</p>
                      <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">{coordinator.description}</p>
                    </div>
                  </div>
                  {coordinator.capabilities && coordinator.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                      {coordinator.capabilities.map((cap: string, idx: number) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-primary/5 text-primary/80 border border-primary/10">{cap}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Team Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teamAgents.map((agent: any) => {
                const IconComp = AGENT_ICONS[agent.icon || "bot"] || Bot;
                const agentData = agentStats?.byAgent?.[agent.name];
                const agentTaskCount = agentData?.total || 0;
                const agentDoneCount = agentData?.done || 0;
                const agentCompletionRate = agentTaskCount > 0 ? Math.round((agentDoneCount / agentTaskCount) * 100) : 0;

                return (
                  <div key={agent.id} className="premium-card p-5 group hover-lift">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `color-mix(in oklch, ${agent.color || '#6366f1'} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${agent.color || '#6366f1'} 15%, transparent)` }}
                      >
                        <IconComp className="w-5 h-5" style={{ color: agent.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-foreground">{agent.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${agent.status === "active" ? "bg-emerald-500" : agent.status === "maintenance" ? "bg-amber-500" : "bg-gray-400"}`} />
                    </div>

                    <p className="text-xs text-muted-foreground/80 leading-relaxed mb-3 line-clamp-2">{agent.description}</p>

                    {agentTaskCount > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-muted/50 rounded-lg p-1.5 border border-border">
                            <div className="font-bold text-foreground">{agentTaskCount}</div>
                            <div className="text-muted-foreground/80 text-[10px]">مهام</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-1.5 border border-border">
                            <div className="font-bold text-emerald-600">{agentDoneCount}</div>
                            <div className="text-muted-foreground/80 text-[10px]">مكتملة</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-1.5 border border-border">
                            <div className="font-bold text-primary">{agentCompletionRate}%</div>
                            <div className="text-muted-foreground/80 text-[10px]">إنجاز</div>
                          </div>
                        </div>
                        <Progress value={agentCompletionRate} className="h-1" />
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-muted-foreground/50">
                        في انتظار أول مهمة...
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-xs"
                      onClick={() => {
                        setFilterAgent(agent.name);
                        setActiveTab("tasks");
                      }}
                    >
                      <Filter className="w-3 h-3 ml-1" />
                      عرض مهام {agent.name}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* API Documentation */}
            <div className="premium-card p-5 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">نقاط اتصال الوكلاء (API)</h3>
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
                  <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border flex items-center gap-2">
                    <Badge className={`text-[10px] px-1.5 ${api.method === "POST" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                      {api.method}
                    </Badge>
                    <code className="text-[11px] text-muted-foreground font-mono">{api.path}</code>
                    <span className="text-[10px] text-muted-foreground/80 mr-auto">{api.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            {/* Filters */}
            <div className="premium-card p-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Filter className="w-4 h-4" />
                  فلترة:
                </div>

                <Select value={filterAgent} onValueChange={setFilterAgent}>
                  <SelectTrigger className="w-[160px] h-9 text-sm bg-card border-border">
                    <SelectValue placeholder="الوكيل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الوكلاء</SelectItem>
                    {agentsList.map((agent: any) => (
                      <SelectItem key={agent.name} value={agent.name}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px] h-9 text-sm bg-card border-border">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[140px] h-9 text-sm bg-card border-border">
                    <SelectValue placeholder="الأولوية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأولويات</SelectItem>
                    {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في المهام..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 h-9 text-sm bg-card border-border"
                  />
                </div>

                {(filterAgent !== "all" || filterStatus !== "all" || filterPriority !== "all" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilterAgent("all"); setFilterStatus("all"); setFilterPriority("all"); setSearchQuery(""); }}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </div>

            {/* Tasks Table */}
            <div className="premium-card overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">لا توجد مهام مطابقة</p>
                  <p className="text-sm text-muted-foreground/80 mt-1">
                    {agentTasks.length === 0 ? "لم يقم أي وكيل بإنشاء مهام بعد" : "جرب تغيير معايير الفلترة"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
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
                        const agent = agentsList.find((a: any) => a.name === task.sourceAgent);
                        const IconComp = agent?.icon ? (AGENT_ICONS[agent.icon] || Bot) : Bot;
                        const today = new Date().toISOString().split("T")[0];
                        const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done" && task.status !== "cancelled";

                        return (
                          <tr key={task.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isOverdue ? "bg-red-50" : ""}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={agent?.color ? { backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` } : {}}
                                >
                                  <IconComp className="w-3.5 h-3.5" style={agent?.color ? { color: agent.color } : {}} />
                                </div>
                                <span className="font-medium text-xs text-foreground">{task.sourceAgent || "—"}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="max-w-[250px]">
                                <p className="font-medium text-sm truncate text-foreground">{task.title}</p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs font-normal border-border text-muted-foreground">{task.project}</Badge>
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-muted-foreground">{task.owner}</span>
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={`text-[10px] ${priorityInfo.color} border`}>{priorityInfo.label}</Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={`text-[10px] ${statusInfo.color} border`}>{statusInfo.label}</Badge>
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
                                <span className="text-xs text-muted-foreground/40">—</span>
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
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            <div className="premium-card p-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                سجل نشاط الوكلاء
              </h3>
              {(agentActivity as any[]).length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">لا يوجد نشاط مسجل بعد</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {(agentActivity as any[]).map((a: any, i: number) => {
                      const agent = agentsList.find((ag: any) => ag.name === a.agentName);
                      const IconComp = agent?.icon ? (AGENT_ICONS[agent.icon] || Bot) : Bot;
                      return (
                        <div key={i} className="relative flex gap-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center z-10 flex-shrink-0"
                            style={agent?.color ? { backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` } : { backgroundColor: 'var(--card)' }}
                          >
                            {a.action === "email_parsed" ? (
                              <Mail className="w-4 h-4" style={agent?.color ? { color: agent.color } : {}} />
                            ) : a.action === "task_created" ? (
                              <Zap className="w-4 h-4" style={agent?.color ? { color: agent.color } : {}} />
                            ) : (
                              <Activity className="w-4 h-4" style={agent?.color ? { color: agent.color } : {}} />
                            )}
                          </div>
                          <div className="flex-1 bg-card rounded-lg border border-border p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm" style={agent?.color ? { color: agent.color } : {}}>{a.agentName}</span>
                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                  {a.action === "email_parsed" ? "تحليل بريد" : a.action === "task_created" ? "إنشاء مهمة" : a.action === "bulk_tasks_created" ? "مهام متعددة" : a.action}
                                </Badge>
                              </div>
                              {a.createdAt && (
                                <span className="text-[10px] text-muted-foreground/80">
                                  {new Date(a.createdAt).toLocaleString("ar-SA")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{a.details}</p>
                            {a.project && (
                              <Badge variant="outline" className="text-[10px] mt-1.5 border-border text-muted-foreground">{a.project}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            <div className="premium-card p-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-primary" />
                توزيع المهام حسب المشروع
              </h3>
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
                    const colors = ["text-primary", "text-amber-400", "text-purple-400", "text-green-400", "text-amber-400", "text-pink-400"];

                    return (
                      <div key={project} className="bg-card rounded-lg p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className={`w-4 h-4 ${colors[i % colors.length]}`} />
                            <span className="font-medium text-foreground">{project}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{count} مهمة</span>
                            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{percentage}%</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={projectCompletion} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-16 text-left">إنجاز {projectCompletion}%</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground/80">
                          <span>جديدة: {projectTasks.filter((t: any) => t.status === "new").length}</span>
                          <span>تنفيذ: {projectTasks.filter((t: any) => t.status === "progress").length}</span>
                          <span>مكتملة: {doneTasks}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
