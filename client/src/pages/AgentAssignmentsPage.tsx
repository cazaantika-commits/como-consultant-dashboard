import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  ClipboardList,
  Bot,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
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

const AGENT_COLORS: Record<string, string> = {
  salwa: "bg-amber-100 text-amber-700 border-amber-200",
  farouq: "bg-purple-100 text-purple-700 border-purple-200",
  khazen: "bg-blue-100 text-blue-700 border-blue-200",
  buraq: "bg-emerald-100 text-emerald-700 border-emerald-200",
  khaled: "bg-cyan-100 text-cyan-700 border-cyan-200",
  alina: "bg-pink-100 text-pink-700 border-pink-200",
  baz: "bg-orange-100 text-orange-700 border-orange-200",
  joelle: "bg-indigo-100 text-indigo-700 border-indigo-200",
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
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  completed: { label: "مكتمل", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  executing: { label: "قيد التنفيذ", color: "bg-amber-50 text-amber-600 border-amber-200", icon: Clock },
  failed: { label: "فشل", color: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
};

export default function AgentAssignmentsPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: assignments, isLoading: assignmentsLoading, refetch } = trpc.agents.listAssignments.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  const { data: stats } = trpc.agents.assignmentStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const deleteMutation = trpc.agents.deleteAssignment.useMutation({
    onSuccess: () => {
      toast.success("تم حذف التكليف");
      refetch();
    },
    onError: () => toast.error("فشل حذف التكليف"),
  });

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter((a: any) => {
      if (agentFilter !== "all" && a.agent !== agentFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [assignments, agentFilter, statusFilter]);

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
            <Bot className="h-12 w-12 mx-auto mb-4 text-amber-600" />
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
              تكليفات الوكلاء
            </h2>
            <p className="text-muted-foreground mb-4">سجّل دخولك لعرض تكليفات الوكلاء</p>
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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseToolArgs = (argsStr: string) => {
    try {
      return JSON.parse(argsStr);
    } catch {
      return {};
    }
  };

  const parseToolResult = (resultStr: string) => {
    try {
      return JSON.parse(resultStr);
    } catch {
      return { message: resultStr };
    }
  };

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
              <ClipboardList className="h-5 w-5 text-amber-600" />
              <h1 className="text-lg font-bold" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
                تكليفات الوكلاء
              </h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4 ml-1" />
            تحديث
          </Button>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-stone-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي التكليفات</p>
                  <p className="text-2xl font-bold text-stone-800">{stats?.total || 0}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-stone-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600">مكتمل</p>
                  <p className="text-2xl font-bold text-emerald-700">{stats?.completed || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">قيد التنفيذ</p>
                  <p className="text-2xl font-bold text-amber-700">{stats?.executing || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">فشل</p>
                  <p className="text-2xl font-bold text-red-700">{stats?.failed || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent breakdown */}
        {stats?.byAgent && Object.keys(stats.byAgent).length > 0 && (
          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-600" />
                توزيع التكليفات حسب الوكيل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.byAgent as Record<string, number>).map(([agent, count]) => (
                  <div
                    key={agent}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${AGENT_COLORS[agent] || "bg-stone-100 text-stone-600 border-stone-200"}`}
                  >
                    <span className="font-medium">{AGENT_NAMES[agent] || agent}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="الوكيل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الوكلاء</SelectItem>
              {Object.entries(AGENT_NAMES).map(([key, name]) => (
                <SelectItem key={key} value={key}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="executing">قيد التنفيذ</SelectItem>
              <SelectItem value="failed">فشل</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            {filteredAssignments.length} تكليف
          </span>
        </div>

        {/* Assignments List */}
        {assignmentsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card className="border-stone-200">
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-stone-300" />
              <p className="text-lg font-medium text-stone-500">لا توجد تكليفات</p>
              <p className="text-sm text-muted-foreground mt-1">
                عندما تطلب من وكيل إضافة أو تعديل بيانات، سيتم تسجيل التكليف هنا تلقائياً
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((assignment: any) => {
              const statusInfo = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.executing;
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedId === assignment.id;
              const args = parseToolArgs(assignment.toolArgs || "{}");
              const result = assignment.toolResult ? parseToolResult(assignment.toolResult) : null;

              return (
                <Card key={assignment.id} className="border-stone-200 hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    {/* Main row */}
                    <div className="flex items-start gap-3">
                      {/* Agent badge */}
                      <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-sm font-medium ${AGENT_COLORS[assignment.agent] || "bg-stone-100 text-stone-600 border-stone-200"}`}>
                        {AGENT_NAMES[assignment.agent] || assignment.agent}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {statusInfo.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {TOOL_LABELS[assignment.toolUsed] || assignment.toolUsed}
                          </Badge>
                        </div>

                        {/* User message */}
                        <p className="text-sm text-stone-700 line-clamp-2 mt-1">
                          {assignment.userMessage}
                        </p>

                        {/* Timestamp */}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(assignment.createdAt)}
                          {assignment.completedAt && (
                            <span className="mr-3">
                              → اكتمل: {formatDate(assignment.completedAt)}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("هل تريد حذف هذا التكليف؟")) {
                              deleteMutation.mutate(assignment.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                        {/* Tool Args */}
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-1">المعاملات المرسلة:</p>
                          <div className="bg-stone-50 rounded-lg p-3 text-sm font-mono text-stone-700 overflow-x-auto" dir="ltr">
                            {Object.entries(args).length > 0 ? (
                              <div className="space-y-1">
                                {Object.entries(args).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="text-amber-600">{key}</span>: <span className="text-stone-800">{JSON.stringify(value)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-stone-400">لا توجد معاملات</span>
                            )}
                          </div>
                        </div>

                        {/* Tool Result */}
                        {result && (
                          <div>
                            <p className="text-xs font-medium text-stone-500 mb-1">النتيجة:</p>
                            <div className={`rounded-lg p-3 text-sm ${result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {result.error ? (
                                <p>❌ {result.error}</p>
                              ) : (
                                <p>✅ {result.message || "تم بنجاح"}</p>
                              )}
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
        )}
      </main>
    </div>
  );
}
