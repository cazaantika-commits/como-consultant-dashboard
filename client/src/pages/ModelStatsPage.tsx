import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Clock, CheckCircle, AlertTriangle, Zap, Brain, Cpu, Loader2 } from "lucide-react";
import { useMemo } from "react";

// Model color mapping
const MODEL_COLORS: Record<string, { bg: string; border: string; text: string; fill: string; label: string }> = {
  "GPT-4o": { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300", text: "text-emerald-700 dark:text-emerald-300", fill: "#10b981", label: "GPT-4o (OpenAI)" },
  "Claude Sonnet 4": { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300", text: "text-purple-700 dark:text-purple-300", fill: "#8b5cf6", label: "Claude Sonnet 4 (Anthropic)" },
  "Gemini 2.5 Pro": { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300", text: "text-blue-700 dark:text-blue-300", fill: "#3b82f6", label: "Gemini 2.5 Pro (Google)" },
  "Manus LLM": { bg: "bg-gray-100 dark:bg-gray-800/30", border: "border-gray-300", text: "text-gray-700 dark:text-gray-300", fill: "#6b7280", label: "Manus LLM (Fallback)" },
};

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

export default function ModelStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = trpc.agents.modelUsageStats.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30s
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const totals = stats?.totals || { totalCalls: 0, avgResponseTime: 0, successRate: 0 };
  const byModel = stats?.byModel || [];
  const byAgent = stats?.byAgent || [];

  // Calculate max calls for bar chart scaling
  const maxModelCalls = useMemo(() => {
    return Math.max(...byModel.map((m: any) => Number(m.totalCalls) || 0), 1);
  }, [byModel]);

  const maxAgentCalls = useMemo(() => {
    return Math.max(...byAgent.map((a: any) => Number(a.totalCalls) || 0), 1);
  }, [byAgent]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/agent-dashboard")} className="rounded-full">
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">إحصائيات النماذج الذكية</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            الرئيسية
          </Button>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الاستدعاءات</p>
                      <p className="text-2xl font-bold">{Number(totals.totalCalls).toLocaleString("ar-AE")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">متوسط وقت الاستجابة</p>
                      <p className="text-2xl font-bold">{(Number(totals.avgResponseTime) / 1000).toFixed(1)}ث</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">نسبة النجاح</p>
                      <p className="text-2xl font-bold">{Number(totals.successRate).toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Brain className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">النماذج النشطة</p>
                      <p className="text-2xl font-bold">{byModel.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Model Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  أداء النماذج
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byModel.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">لا توجد بيانات بعد</p>
                    <p className="text-sm mt-1">ابدأ محادثة مع أي وكيل لتظهر الإحصائيات هنا</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {byModel.map((model: any, idx: number) => {
                      const colors = MODEL_COLORS[model.model] || MODEL_COLORS["Manus LLM"];
                      const calls = Number(model.totalCalls);
                      const avgTime = Number(model.avgResponseTime);
                      const successCount = Number(model.successCount);
                      const fallbackCount = Number(model.fallbackCount);
                      const successRate = calls > 0 ? (successCount / calls * 100) : 0;
                      const barWidth = (calls / maxModelCalls) * 100;

                      return (
                        <div key={idx} className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.fill }} />
                              <span className={`font-bold ${colors.text}`}>{colors.label}</span>
                            </div>
                            <span className="text-sm font-medium">{calls} استدعاء</span>
                          </div>

                          {/* Bar chart */}
                          <div className="h-6 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden mb-3">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${barWidth}%`, backgroundColor: colors.fill }}
                            />
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 opacity-60" />
                              <span>متوسط: <strong>{(avgTime / 1000).toFixed(1)}ث</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 opacity-60" />
                              <span>نجاح: <strong>{successRate.toFixed(0)}%</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 opacity-60" />
                              <span>احتياطي: <strong>{fallbackCount}</strong></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent-Model Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  توزيع النماذج على الوكلاء
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byAgent.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>لا توجد بيانات بعد</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {byAgent.map((item: any, idx: number) => {
                      const colors = MODEL_COLORS[item.model] || MODEL_COLORS["Manus LLM"];
                      const calls = Number(item.totalCalls);
                      const avgTime = Number(item.avgResponseTime);
                      const barWidth = (calls / maxAgentCalls) * 100;

                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-16 text-left font-medium text-sm">
                            {AGENT_NAMES[item.agent] || item.agent}
                          </div>
                          <div className="flex-1">
                            <div className="h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                              <div
                                className="h-full rounded-lg transition-all duration-700 flex items-center px-3"
                                style={{ width: `${Math.max(barWidth, 15)}%`, backgroundColor: colors.fill }}
                              >
                                <span className="text-white text-xs font-medium whitespace-nowrap">
                                  {calls} • {(avgTime / 1000).toFixed(1)}ث
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text} whitespace-nowrap`}>
                            {item.model}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Legend */}
            <Card>
              <CardHeader>
                <CardTitle>دليل النماذج</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(MODEL_COLORS).map(([model, colors]) => (
                    <div key={model} className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.fill }} />
                        <span className={`font-bold text-sm ${colors.text}`}>{model}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{colors.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
