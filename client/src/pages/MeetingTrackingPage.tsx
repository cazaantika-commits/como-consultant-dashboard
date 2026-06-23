import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { 
  ArrowRight, Calendar, CheckCircle2, XCircle, Clock, 
  Users, FileText, AlertTriangle, BarChart3, ChevronDown, 
  ChevronUp, Loader2, ArrowLeft, Target, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Agent colors map
const AGENT_COLORS: Record<string, string> = {
  "سلوى": "#8B5CF6",
  "فاروق": "#DC2626",
  "خازن": "#059669",
  "براق": "#D97706",
  "خالد": "#2563EB",
  "ألينا": "#EC4899",
  "الينا": "#EC4899",
  "باز": "#7C3AED",
  "جويل": "#0891B2",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">مكتمل</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">جاري</Badge>;
    case "preparing":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">تحضير</Badge>;
    case "cancelled":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">ملغي</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getTaskStatusIcon(status: string) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "progress":
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case "new":
      return <Clock className="w-4 h-4 text-amber-400" />;
    case "hold":
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getTaskStatusText(status: string) {
  switch (status) {
    case "done": return "مكتمل";
    case "progress": return "قيد التنفيذ";
    case "new": return "جديد";
    case "hold": return "معلّق";
    case "review": return "مراجعة";
    default: return status;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">عالي</Badge>;
    case "medium":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">متوسط</Badge>;
    case "low":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">منخفض</Badge>;
    default:
      return null;
  }
}

export default function MeetingTrackingPage() {
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress" | "preparing">("all");

  // Fetch all meetings
  const { data: meetingsData, isLoading: meetingsLoading } = trpc.meetings.list.useQuery({
    limit: 50,
  });

  // Fetch all tasks that came from meetings
  const { data: tasksData, isLoading: tasksLoading } = trpc.tasks.list.useQuery({});

  // Filter meeting tasks
  const meetingTasks = useMemo(() => {
    if (!tasksData) return [];
    const allTasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks || [];
    return allTasks.filter((t: any) => 
      t.sourceAgent?.startsWith("meeting-") || t.category === "meeting-task"
    );
  }, [tasksData]);

  // Calculate stats
  const stats = useMemo(() => {
    const meetings = meetingsData || [];
    const totalMeetings = meetings.length;
    const completedMeetings = meetings.filter((m: any) => m.status === "completed").length;
    const totalTasks = meetingTasks.length;
    const completedTasks = meetingTasks.filter((t: any) => t.status === "done").length;
    const failedTasks = meetingTasks.filter((t: any) => t.status === "hold").length;
    const inProgressTasks = meetingTasks.filter((t: any) => t.status === "progress").length;
    const executionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalMeetings, completedMeetings, totalTasks, completedTasks, failedTasks, inProgressTasks, executionRate };
  }, [meetingsData, meetingTasks]);

  // Group tasks by meeting
  const tasksByMeeting = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const task of meetingTasks) {
      const meetingKey = task.sourceAgent || "unknown";
      if (!grouped[meetingKey]) grouped[meetingKey] = [];
      grouped[meetingKey].push(task);
    }
    return grouped;
  }, [meetingTasks]);

  // Filter meetings
  const filteredMeetings = useMemo(() => {
    const meetings = meetingsData || [];
    if (filter === "all") return meetings;
    return meetings.filter((m: any) => m.status === filter);
  }, [meetingsData, filter]);

  // Get tasks for a specific meeting
  const getTasksForMeeting = (meetingId: number) => {
    return tasksByMeeting[`meeting-${meetingId}`] || [];
  };

  // Calculate meeting execution progress
  const getMeetingProgress = (meetingId: number) => {
    const tasks = getTasksForMeeting(meetingId);
    if (tasks.length === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = tasks.filter((t: any) => t.status === "done").length;
    return { total: tasks.length, completed, percentage: Math.round((completed / tasks.length) * 100) };
  };

  if (meetingsLoading || tasksLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">جاري تحميل بيانات الاجتماعات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/meetings">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  لوحة متابعة تنفيذ الاجتماعات
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  متابعة المهام المستخرجة من الاجتماعات ونسبة تنفيذها
                </p>
              </div>
            </div>
            <Link href="/meetings/new">
              <Button>
                <Users className="w-4 h-4 ml-2" />
                اجتماع جديد
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي الاجتماعات</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.totalMeetings}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.completedMeetings} مكتمل
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المهام</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.totalTasks}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.completedTasks} مكتمل · {stats.inProgressTasks} قيد التنفيذ
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">نسبة التنفيذ</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.executionRate}%</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <Progress value={stats.executionRate} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">مهام معلّقة</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.failedTasks}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                تحتاج متابعة يدوية
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: "all", label: "الكل" },
            { key: "completed", label: "مكتمل" },
            { key: "in_progress", label: "جاري" },
            { key: "preparing", label: "تحضير" },
          ].map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key as any)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Meetings List with Tasks */}
        <div className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <Card className="bg-card/80 border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">لا توجد اجتماعات في هذا التصنيف</p>
              </CardContent>
            </Card>
          ) : (
            filteredMeetings.map((meeting: any) => {
              const progress = getMeetingProgress(meeting.id);
              const tasks = getTasksForMeeting(meeting.id);
              const isExpanded = expandedMeeting === meeting.id;

              return (
                <Card key={meeting.id} className="bg-card/80 border-border/50 overflow-hidden">
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{meeting.title}</CardTitle>
                            {getStatusBadge(meeting.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(meeting.createdAt).toLocaleDateString("ar-SA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {meeting.participants && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {meeting.participants.length} مشارك
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {progress.total} مهمة
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Progress indicator */}
                        {progress.total > 0 && (
                          <div className="hidden md:flex items-center gap-3 min-w-[200px]">
                            <Progress value={progress.percentage} className="h-2 flex-1" />
                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                              {progress.percentage}%
                            </span>
                          </div>
                        )}

                        {/* Participant avatars */}
                        {meeting.participants && (
                          <div className="hidden md:flex -space-x-2 space-x-reverse">
                            {meeting.participants.slice(0, 4).map((p: any, i: number) => (
                              <div
                                key={i}
                                className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ backgroundColor: AGENT_COLORS[p.agentName] || "#6B7280" }}
                                title={p.agentName}
                              >
                                {p.agentName?.charAt(0)}
                              </div>
                            ))}
                            {meeting.participants.length > 4 && (
                              <div className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                +{meeting.participants.length - 4}
                              </div>
                            )}
                          </div>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="border-t border-border/50 pt-4">
                      {/* Mobile progress */}
                      {progress.total > 0 && (
                        <div className="md:hidden flex items-center gap-3 mb-4">
                          <Progress value={progress.percentage} className="h-2 flex-1" />
                          <span className="text-sm font-medium">{progress.percentage}%</span>
                        </div>
                      )}

                      {tasks.length === 0 ? (
                        <div className="text-center py-6">
                          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            لا توجد مهام مستخرجة من هذا الاجتماع
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            يتم استخراج المهام تلقائياً عند إنهاء الاجتماع
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-foreground">
                              المهام ({tasks.length})
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {tasks.filter((t: any) => t.status === "done").length}
                              </span>
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 text-blue-400" />
                                {tasks.filter((t: any) => t.status === "progress").length}
                              </span>
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-red-400" />
                                {tasks.filter((t: any) => t.status === "hold").length}
                              </span>
                            </div>
                          </div>

                          {tasks.map((task: any) => (
                            <div
                              key={task.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              {getTaskStatusIcon(task.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                                  {getPriorityBadge(task.priority)}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span 
                                    className="font-medium"
                                    style={{ color: AGENT_COLORS[task.owner] || "#6B7280" }}
                                  >
                                    {task.owner}
                                  </span>
                                  <span>{getTaskStatusText(task.status)}</span>
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {task.dueDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0">
                                <Progress value={task.progress || 0} className="w-16 h-1.5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
                        <Link href={`/meetings/${meeting.id}`}>
                          <Button variant="outline" size="sm">
                            <ArrowRight className="w-4 h-4 ml-2" />
                            فتح الاجتماع
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
