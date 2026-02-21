import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Clock, Wrench, 
  ArrowRight, ChevronDown, ChevronUp, RefreshCw, BarChart3, Zap,
  ArrowLeft, Shield, Target, TrendingUp
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    completed: { label: "مكتمل", variant: "default" },
    partial: { label: "جزئي", variant: "secondary" },
    failed: { label: "فشل", variant: "destructive" },
    executing: { label: "قيد التنفيذ", variant: "outline" },
    planning: { label: "تخطيط", variant: "outline" },
    verifying: { label: "تحقق", variant: "outline" },
    retrying: { label: "إعادة محاولة", variant: "secondary" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function StatCard({ title, value, icon: Icon, subtitle, color }: { title: string; value: string | number; icon: any; subtitle?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1" style={color ? { color } : {}}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionLogRow({ log, onExpand }: { log: any; onExpand: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <StatusBadge status={log.status} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{log.taskTitle}</p>
            <p className="text-xs text-muted-foreground">
              الوكيل: {log.agent} | 
              الأدوات: {log.toolCallCount} ({log.writeToolCount} كتابة) | 
              المحاولة: {log.attempt}/{log.maxAttempts}
              {log.durationMs ? ` | المدة: ${(log.durationMs / 1000).toFixed(1)}ث` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {log.verified === 1 && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Shield className="h-3 w-3 ml-1" />
              تم التحقق
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {/* Action Plan */}
          {log.actionPlan && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">📋 خطة العمل ({log.actionPlan.steps?.length || 0} خطوات)</p>
              <p className="text-xs text-muted-foreground mb-1">السبب: {log.actionPlan.reasoning}</p>
              <div className="space-y-1">
                {log.actionPlan.steps?.map((step: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                    <span className="font-mono text-muted-foreground">{step.stepNumber}.</span>
                    <span>{step.description}</span>
                    <Badge variant="outline" className="text-xs">{step.toolName}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step Results */}
          {log.stepResults && log.stepResults.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">📊 نتائج التنفيذ</p>
              <div className="space-y-1">
                {log.stepResults.map((step: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {step.success ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <Badge variant="outline" className="text-xs">{step.toolName}</Badge>
                    <span className="text-muted-foreground truncate">{step.toolOutput?.substring(0, 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools Used */}
          {log.toolsUsed && log.toolsUsed.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">🔧 الأدوات المستخدمة</p>
              <div className="flex flex-wrap gap-1">
                {log.toolsUsed.map((tool: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tool}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Agent Response */}
          {log.agentResponse && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">💬 رد الوكيل</p>
              <p className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {log.agentResponse.substring(0, 500)}
                {log.agentResponse.length > 500 && "..."}
              </p>
            </div>
          )}

          {/* Error */}
          {log.errorMessage && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">❌ الخطأ</p>
              <p className="text-xs bg-red-50 dark:bg-red-900/20 rounded p-2 text-red-600 dark:text-red-400">
                {log.errorMessage}
              </p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground">
            {log.startedAt && `بدأ: ${new Date(log.startedAt).toLocaleString("ar-AE")}`}
            {log.completedAt && ` | انتهى: ${new Date(log.completedAt).toLocaleString("ar-AE")}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ExecutionDashboardPage() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.executionDashboard.getStats.useQuery();
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = trpc.executionDashboard.getRecentLogs.useQuery({
    limit: 50,
    status: statusFilter as any,
    agent: agentFilter !== "all" ? agentFilter : undefined,
  });

  const handleRefresh = () => {
    refetchStats();
    refetchLogs();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  غرفة العمليات - مراقبة التنفيذ
                </h1>
                <p className="text-sm text-muted-foreground">مراقبة تنفيذ المهام بواسطة الوكلاء في الوقت الفعلي</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            title="إجمالي التنفيذات"
            value={stats?.total || 0}
            icon={BarChart3}
          />
          <StatCard
            title="مكتملة"
            value={stats?.completed || 0}
            icon={CheckCircle2}
            color="#22c55e"
          />
          <StatCard
            title="فشلت"
            value={stats?.failed || 0}
            icon={XCircle}
            color="#ef4444"
          />
          <StatCard
            title="نسبة النجاح"
            value={`${stats?.successRate || 0}%`}
            icon={Target}
            color={stats?.successRate && stats.successRate >= 70 ? "#22c55e" : "#f59e0b"}
          />
          <StatCard
            title="استدعاءات الأدوات"
            value={stats?.totalToolCalls || 0}
            icon={Wrench}
            subtitle={`${stats?.totalWriteTools || 0} كتابة`}
          />
          <StatCard
            title="متوسط المدة"
            value={stats?.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(0)}ث` : "—"}
            icon={Clock}
          />
        </div>

        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs">سجل التنفيذ</TabsTrigger>
            <TabsTrigger value="agents">أداء الوكلاء</TabsTrigger>
            <TabsTrigger value="tools">استخدام الأدوات</TabsTrigger>
          </TabsList>

          {/* Execution Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="failed">فشل</SelectItem>
                  <SelectItem value="executing">قيد التنفيذ</SelectItem>
                </SelectContent>
              </Select>

              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الوكيل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="salwa">سلوى</SelectItem>
                  <SelectItem value="farouq">فاروق</SelectItem>
                  <SelectItem value="khaled">خالد</SelectItem>
                  <SelectItem value="alina">ألينا</SelectItem>
                  <SelectItem value="buraq">براق</SelectItem>
                  <SelectItem value="khazen">خازن</SelectItem>
                  <SelectItem value="baz">باز</SelectItem>
                  <SelectItem value="joelle">جويل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logs List */}
            {logsLoading ? (
              <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
            ) : !logs || logs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">لا توجد سجلات تنفيذ بعد</p>
                  <p className="text-sm text-muted-foreground mt-1">ستظهر هنا سجلات تنفيذ المهام عند إنهاء الاجتماعات</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <ExecutionLogRow key={log.id} log={log} onExpand={() => {}} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Agent Performance Tab */}
          <TabsContent value="agents" className="space-y-4">
            {stats?.agentStats && stats.agentStats.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stats.agentStats.map((agent: any) => (
                  <Card key={agent.agent}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{agent.agent}</span>
                        <Badge variant={agent.successRate >= 70 ? "default" : agent.successRate >= 40 ? "secondary" : "destructive"}>
                          {agent.successRate}% نجاح
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">إجمالي المهام</span>
                          <span className="font-medium">{agent.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">مكتملة</span>
                          <span className="font-medium">{agent.completed}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">فشلت</span>
                          <span className="font-medium">{agent.failed}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">متوسط المدة</span>
                          <span className="font-medium">{agent.avgDuration ? `${(agent.avgDuration / 1000).toFixed(0)}ث` : "—"}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${agent.successRate}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">لا توجد بيانات أداء بعد</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tool Usage Tab */}
          <TabsContent value="tools" className="space-y-4">
            {stats?.topTools && stats.topTools.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">أكثر الأدوات استخداماً</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topTools.map((tool: any, i: number) => {
                      const maxCount = stats.topTools[0]?.count || 1;
                      const pct = Math.round((tool.count / maxCount) * 100);
                      return (
                        <div key={tool.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground font-mono text-xs">{i + 1}.</span>
                              <Badge variant="outline">{tool.name}</Badge>
                            </div>
                            <span className="font-medium">{tool.count} مرة</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary/60 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">لا توجد بيانات استخدام أدوات بعد</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
