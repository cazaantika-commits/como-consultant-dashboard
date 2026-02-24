import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  ClipboardList,
  Bot,
  RotateCcw,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const AGENT_NAMES: Record<string, string> = {
  salwa: "سلوى",
  farouq: "فاروق",
  khazen: "خازن",
  buraq: "براق",
  khaled: "خالد",
  alina: "ألينا",
  baz: "باز",
  joelle: "جويل",
};

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  salwa: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", gradient: "from-amber-400 to-orange-500" },
  farouq: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", gradient: "from-purple-400 to-violet-500" },
  khazen: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", gradient: "from-blue-400 to-cyan-500" },
  buraq: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", gradient: "from-emerald-400 to-green-500" },
  khaled: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", gradient: "from-cyan-400 to-teal-500" },
  alina: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", gradient: "from-pink-400 to-rose-500" },
  baz: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", gradient: "from-orange-400 to-red-500" },
  joelle: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", gradient: "from-indigo-400 to-blue-500" },
};

const TOOL_LABELS: Record<string, string> = {
  add_consultant: "إضافة استشاري",
  update_consultant: "تحديث استشاري",
  add_consultant_to_project: "ربط استشاري بمشروع",
  remove_consultant_from_project: "إزالة استشاري من مشروع",
  set_evaluation_score: "تعيين تقييم",
  set_financial_data: "إدخال بيانات مالية",
  add_project: "إضافة مشروع",
  add_task: "إضافة مهمة",
  update_task_status: "تحديث حالة مهمة",
  update_consultant_profile: "تحديث بروفايل استشاري",
  add_consultant_note: "إضافة ملاحظة",
  check_email: "فحص الإيميل",
  read_email: "قراءة إيميل",
  reply_email: "الرد على إيميل",
  compose_email: "إرسال إيميل",
  download_email_attachments: "تنزيل مرفقات",
  copy_drive_file: "نسخ ملف Drive",
  create_drive_folder: "إنشاء مجلد Drive",
  search_drive: "بحث في Drive",
};

export default function AgentAssignmentsSummaryPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: assignments, isLoading: assignmentsLoading, refetch } = trpc.agents.listAssignments.useQuery(
    { limit: 200 },
    { enabled: isAuthenticated }
  );

  const { data: stats } = trpc.agents.assignmentStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Compute agent-level summaries
  const agentSummaries = useMemo(() => {
    if (!assignments) return [];
    const map: Record<string, { total: number; completed: number; failed: number; executing: number; lastActivity: string; topTools: Record<string, number> }> = {};
    
    for (const a of assignments as any[]) {
      if (!map[a.agent]) {
        map[a.agent] = { total: 0, completed: 0, failed: 0, executing: 0, lastActivity: "", topTools: {} };
      }
      const s = map[a.agent];
      s.total++;
      if (a.status === "completed") s.completed++;
      else if (a.status === "failed") s.failed++;
      else s.executing++;
      
      if (!s.lastActivity || new Date(a.createdAt) > new Date(s.lastActivity)) {
        s.lastActivity = a.createdAt;
      }
      
      const toolName = a.toolUsed || "unknown";
      s.topTools[toolName] = (s.topTools[toolName] || 0) + 1;
    }

    return Object.entries(map)
      .map(([agent, data]) => ({
        agent,
        ...data,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        topTool: Object.entries(data.topTools).sort((a, b) => b[1] - a[1])[0],
      }))
      .sort((a, b) => b.total - a.total);
  }, [assignments]);

  // Recent failed assignments
  const recentFailed = useMemo(() => {
    if (!assignments) return [];
    return (assignments as any[])
      .filter((a: any) => a.status === "failed")
      .slice(0, 5);
  }, [assignments]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-amber-600" />
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
              ملخص تكليفات الوكلاء
            </h2>
            <p className="text-muted-foreground mb-4">سجّل دخولك لعرض ملخص التكليفات</p>
            <Button onClick={() => window.location.href = getLoginUrl()} className="bg-amber-600 hover:bg-amber-700">
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: any) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("ar-AE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalSuccessRate = stats?.total ? Math.round(((stats?.completed || 0) / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAF8]" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-stone-500">
              <ArrowRight className="h-4 w-4 ml-1" />
              الرئيسية
            </Button>
            <div className="h-6 w-px bg-stone-200" />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-600" />
              <h1 className="text-lg font-bold" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
                ملخص تكليفات الوكلاء
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/agent-assignments")}>
              <ClipboardList className="h-4 w-4 ml-1" />
              السجل التفصيلي
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {assignmentsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-stone-200 bg-white">
                <CardContent className="pt-5 pb-5">
                  <div className="text-center">
                    <ClipboardList className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-stone-800">{stats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">إجمالي التكليفات</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="pt-5 pb-5">
                  <div className="text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-emerald-700">{stats?.completed || 0}</p>
                    <p className="text-xs text-emerald-600 mt-1">مكتمل</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-5 pb-5">
                  <div className="text-center">
                    <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-amber-700">{stats?.executing || 0}</p>
                    <p className="text-xs text-amber-600 mt-1">قيد التنفيذ</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-5 pb-5">
                  <div className="text-center">
                    <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-red-700">{stats?.failed || 0}</p>
                    <p className="text-xs text-red-600 mt-1">فشل</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-5 pb-5">
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-blue-700">{totalSuccessRate}%</p>
                    <p className="text-xs text-blue-600 mt-1">نسبة النجاح</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Cards */}
            <div>
              <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                <Bot className="h-5 w-5 text-amber-600" />
                أداء كل وكيل
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {agentSummaries.map((summary) => {
                  const colors = AGENT_COLORS[summary.agent] || { bg: "bg-stone-50", text: "text-stone-700", border: "border-stone-200", gradient: "from-stone-400 to-stone-500" };
                  return (
                    <Card key={summary.agent} className={`${colors.border} hover:shadow-md transition-shadow`}>
                      <CardContent className="p-5">
                        {/* Agent Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-md`}>
                            <Bot className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className={`font-bold text-base ${colors.text}`}>
                              {AGENT_NAMES[summary.agent] || summary.agent}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              آخر نشاط: {formatDate(summary.lastActivity)}
                            </p>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div className="text-center p-2 rounded-lg bg-stone-50">
                            <p className="text-lg font-bold text-stone-700">{summary.total}</p>
                            <p className="text-[10px] text-muted-foreground">إجمالي</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-emerald-50">
                            <p className="text-lg font-bold text-emerald-700">{summary.completed}</p>
                            <p className="text-[10px] text-emerald-600">نجاح</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-red-50">
                            <p className="text-lg font-bold text-red-700">{summary.failed}</p>
                            <p className="text-[10px] text-red-600">فشل</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-blue-50">
                            <p className="text-lg font-bold text-blue-700">{summary.successRate}%</p>
                            <p className="text-[10px] text-blue-600">نجاح</p>
                          </div>
                        </div>

                        {/* Success Rate Bar */}
                        <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                            style={{ width: `${summary.successRate}%` }}
                          />
                        </div>

                        {/* Top Tool */}
                        {summary.topTool && (
                          <div className={`flex items-center gap-2 text-xs ${colors.bg} ${colors.text} rounded-lg px-3 py-2 ${colors.border} border`}>
                            <Zap className="w-3.5 h-3.5" />
                            <span>الأكثر استخداماً: <strong>{TOOL_LABELS[summary.topTool[0]] || summary.topTool[0]}</strong></span>
                            <Badge variant="secondary" className="text-[10px] mr-auto">{summary.topTool[1]}×</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Recent Failures */}
            {recentFailed.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  آخر التكليفات الفاشلة
                </h2>
                <Card className="border-red-200">
                  <CardContent className="p-0">
                    <div className="divide-y divide-red-100">
                      {recentFailed.map((a: any) => (
                        <div key={a.id} className="p-4 flex items-start gap-3">
                          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                            AGENT_COLORS[a.agent] ? `${AGENT_COLORS[a.agent].bg} ${AGENT_COLORS[a.agent].text} ${AGENT_COLORS[a.agent].border}` : "bg-stone-100 text-stone-600 border-stone-200"
                          }`}>
                            {AGENT_NAMES[a.agent] || a.agent}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                                <XCircle className="h-3 w-3 ml-1" />
                                فشل
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {TOOL_LABELS[a.toolUsed] || a.toolUsed}
                              </Badge>
                            </div>
                            <p className="text-xs text-stone-600 line-clamp-1">{a.userMessage}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{formatDate(a.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Link to detailed view */}
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/agent-assignments")}
                className="gap-2"
              >
                <ClipboardList className="h-4 w-4" />
                عرض السجل التفصيلي الكامل
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
