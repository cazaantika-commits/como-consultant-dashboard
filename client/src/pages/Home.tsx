import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Bot,
  ArrowLeft,
  Sparkles,
  Shield,
  BarChart3,
  FileText,
  Users,
  Zap,
  Crown,
  Archive,
  Scale,
  Gauge,
  ShieldCheck,
  Calculator,
  MessageSquare,
  Rocket,
  BarChart2,
  Send,
  ChevronLeft,
  Building2,
  LogOut,
  TrendingUp,
  BrainCircuit,
  Layers,
  Target,
  Activity,
  ClipboardList,
  BookOpen,
  Mail,
  Mic,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { AgentChatBox, AgentType } from "@/components/AgentChatBox";
import { Streamdown } from "streamdown";
import NotificationBell from "@/components/NotificationBell";

const SALWA_AVATAR_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/dKjNMGCYtHDQQPse.png";

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

/* Colored emoji-style icon wrapper */
function ColorIcon({ children, bg, shadow }: { children: React.ReactNode; bg: string; shadow: string }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
      style={{
        background: bg,
        boxShadow: `0 8px 24px ${shadow}`,
      }}
    >
      {children}
    </div>
  );
}

/* Quick Action Button */
function QuickActionButton({
  icon: Icon,
  label,
  color,
  borderColor,
  isLoading,
  onClick,
}: {
  icon: any;
  label: string;
  color: string;
  borderColor: string;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait ${color} ${borderColor}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {label}
    </button>
  );
}

/* Quick Action Result Panel */
function QuickActionResult({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <div className="mt-6 bg-white dark:bg-card rounded-2xl border border-amber-200/60 dark:border-amber-800/30 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-b border-amber-200/40">
        <div className="flex items-center gap-2">
          <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-7 h-7 rounded-full ring-2 ring-amber-400/50" />
          <span className="font-bold text-sm text-foreground">{title}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-amber-200/30 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="p-5 text-sm text-foreground leading-relaxed max-h-[400px] overflow-y-auto" dir="rtl">
        <Streamdown>{content}</Streamdown>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [quickActionResult, setQuickActionResult] = useState<{ title: string; content: string } | null>(null);
  const { data: agentsList = [] } = trpc.agents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const chatMutation = trpc.agents.chat.useMutation();

  const coordinator = agentsList.find((a: any) => a.isCoordinator === 1);
  const teamAgents = agentsList.filter((a: any) => a.isCoordinator !== 1);

  const executeQuickAction = async (actionId: string, message: string, title: string) => {
    setQuickActionLoading(actionId);
    setQuickActionResult(null);
    try {
      const result = await chatMutation.mutateAsync({
        agent: "salwa",
        message,
        conversationHistory: [],
      });
      setQuickActionResult({ title, content: (result as any).response || result.text || "" });
    } catch (err: any) {
      setQuickActionResult({ title: "خطأ", content: `حدث خطأ: ${err.message || "حاول مرة أخرى"}` });
    } finally {
      setQuickActionLoading(null);
    }
  };

  const QUICK_ACTIONS = [
    {
      id: "check-email",
      icon: Mail,
      label: "شيكي على الإيميل",
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
      borderColor: "border-blue-200 dark:border-blue-800",
      message: "شيكي على الإيميل",
      resultTitle: "📧 فحص الإيميل",
    },
    {
      id: "task-summary",
      icon: FileText,
      label: "ملخص المهام",
      color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400",
      borderColor: "border-cyan-200 dark:border-cyan-800",
      message: "لخصي لي وضع المهام الحالية",
      resultTitle: "📝 ملخص المهام",
    },
    {
      id: "agent-tasks-summary",
      icon: Bot,
      label: "ملخص تكليفات الوكلاء",
      color: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
      borderColor: "border-purple-200 dark:border-purple-800",
      message: "لخصي لي وضع مهام وتكليفات الوكلاء",
      resultTitle: "🤖 ملخص تكليفات الوكلاء",
    },
    {
      id: "schedule-meeting",
      icon: CalendarPlus,
      label: "حجز موعد",
      color: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
      borderColor: "border-green-200 dark:border-green-800",
      message: "أريد حجز موعد اجتماع عبر Google Calendar",
      resultTitle: "📅 حجز موعد",
    },
    {
      id: "drive-status",
      icon: Archive,
      label: "وضع ملفات Drive",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      borderColor: "border-amber-200 dark:border-amber-800",
      message: "شو وضع ملفات Drive؟ لخصي لي آخر الملفات",
      resultTitle: "📂 ملفات Drive",
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center shadow-lg shadow-stone-600/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">COMO Developments</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">منصة إدارة المشاريع الذكية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <div className="w-20 h-8 rounded-md shimmer" />
            ) : isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  مرحباً، <span className="font-medium text-foreground">{user?.name}</span>
                </span>
                <NotificationBell />
                <Button
                  size="sm"
                  onClick={() => navigate("/executive")}
                  className="text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white border-0 shadow-lg shadow-amber-500/25"
                >
                  <Crown className="w-3.5 h-3.5" />
                  مركز القيادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/agent-dashboard")}
                  className="text-xs gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" />
                  لوحة التحكم
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => (window.location.href = getLoginUrl())}
                className="text-xs gap-1.5"
              >
                تسجيل الدخول
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero Section (for non-authenticated) ── */}
        {!isAuthenticated && (
          <section className="relative py-20 lg:py-28 overflow-hidden">
            <div className="absolute inset-0 pattern-overlay opacity-40" />
            <div className="absolute top-10 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/8 blur-[100px]" />
            <div className="absolute bottom-10 left-1/4 w-[300px] h-[300px] rounded-full bg-stone-500/8 blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />

            <div className="relative max-w-7xl mx-auto px-6">
              <div className="max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-medium mb-6">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  مدعوم بالذكاء الاصطناعي
                </div>

                <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-5 fade-in">
                  إدارة مشاريع كومو بذكاء
                  <br />
                  <span className="text-gold-gradient">مع فريق الوكلاء الفنيين</span>
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto fade-in">
                  منصة متكاملة تجمع بين الذكاء الاصطناعي وإدارة المشاريع لتقديم تجربة
                  احترافية لفريق التطوير العقاري
                </p>

                <div className="flex items-center justify-center gap-3 fade-in">
                  <Button
                    size="lg"
                    onClick={() => (window.location.href = getLoginUrl())}
                    className="gap-2 px-8 shadow-lg shadow-primary/20 bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950"
                  >
                    ابدأ الآن
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Features Grid ── */}
        <section className="py-16 border-t border-border/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 shadow-lg shadow-orange-500/25 mb-4">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">قدرات المنصة</h2>
              <p className="text-muted-foreground">أدوات متقدمة لإدارة كل جانب من جوانب مشاريعك</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: BrainCircuit,
                  title: "وكلاء ذكيون",
                  desc: "فريق من الوكلاء المتخصصين يعملون على مدار الساعة",
                  gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  shadow: "rgba(99, 102, 241, 0.3)",
                  emoji: "🤖",
                },
                {
                  icon: Shield,
                  title: "تدقيق العقود",
                  desc: "مراجعة قانونية ذكية للعقود واكتشاف المخاطر",
                  gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  shadow: "rgba(6, 182, 212, 0.3)",
                  emoji: "🛡️",
                },
                {
                  icon: TrendingUp,
                  title: "تحليل مالي",
                  desc: "تحليل الميزانيات والمستخلصات المالية بدقة",
                  gradient: "linear-gradient(135deg, #10b981, #059669)",
                  shadow: "rgba(16, 185, 129, 0.3)",
                  emoji: "💰",
                },
                {
                  icon: Layers,
                  title: "أرشفة ذكية",
                  desc: "تنظيم وأرشفة الملفات تلقائياً بتسمية احترافية",
                  gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
                  shadow: "rgba(245, 158, 11, 0.3)",
                  emoji: "📁",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="premium-card p-6 hover-lift fade-in group relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ background: feature.gradient }}
                  />
                  <div className="flex items-start gap-4">
                    <ColorIcon bg={feature.gradient} shadow={feature.shadow}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </ColorIcon>
                    <div className="flex-1 pt-1">
                      <h3 className="font-bold text-foreground mb-1.5 text-base">
                        <span className="ml-1.5">{feature.emoji}</span>
                        {feature.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SALWA - Below Capabilities with Quick Actions ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {isAuthenticated && (
          <section className="py-12 border-t border-border/50">
            <div className="max-w-5xl mx-auto px-6">
              <div className="relative bg-gradient-to-br from-white to-amber-50/50 dark:from-card dark:to-amber-950/10 rounded-3xl border border-amber-200/60 dark:border-amber-800/30 shadow-xl shadow-amber-500/10 p-8 lg:p-10 overflow-hidden">
                {/* Gold accent bar at top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />

                <div className="flex flex-col lg:flex-row items-center gap-8">
                  {/* Salwa's Avatar - no crown */}
                  <div className="relative shrink-0">
                    <div className="w-44 h-44 lg:w-52 lg:h-52 rounded-full overflow-hidden ring-4 ring-amber-400/60 ring-offset-4 ring-offset-background shadow-2xl shadow-amber-500/20">
                      <img
                        src={SALWA_AVATAR_URL}
                        alt="سلوى"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Online indicator */}
                    <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white dark:border-card shadow-lg">
                      <span className="absolute inset-0 w-full h-full rounded-full bg-emerald-500 animate-ping opacity-40" />
                    </span>
                  </div>

                  {/* Salwa's Info & Quick Actions */}
                  <div className="flex-1 text-center lg:text-right">
                    <div className="flex items-center justify-center lg:justify-start gap-3 mb-2 flex-wrap">
                      <h2 className="text-2xl lg:text-3xl font-extrabold text-foreground">سلوى</h2>
                      <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-300/40">
                        المنسقة الرئيسية
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xl">
                      المساعدة التنفيذية الذكية — نفذي أوامر سريعة أو تحدث معها مباشرة
                    </p>

                    {/* Quick Action Buttons - Real commands */}
                    <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-5">
                      {QUICK_ACTIONS.map((action) => (
                        <QuickActionButton
                          key={action.id}
                          icon={action.icon}
                          label={action.label}
                          color={action.color}
                          borderColor={action.borderColor}
                          isLoading={quickActionLoading === action.id}
                          onClick={() => executeQuickAction(action.id, action.message, action.resultTitle)}
                        />
                      ))}
                    </div>

                    {/* Chat with Salwa button */}
                    <button
                      onClick={() => setActiveAgent("salwa" as AgentType)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg shadow-amber-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/35 hover:from-amber-600 hover:to-amber-700 text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      تحدث مع سلوى
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Action Result */}
                {quickActionResult && (
                  <QuickActionResult
                    title={quickActionResult.title}
                    content={quickActionResult.content}
                    onClose={() => setQuickActionResult(null)}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Quick Navigation (Authenticated) ── */}
        {isAuthenticated && (
          <section className="py-12 border-t border-border/50">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-foreground">الوصول السريع</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "إدارة المشاريع", emoji: "🏗️", icon: Building2, path: "/project-management", gradient: "linear-gradient(135deg, #059669, #047857)", shadow: "rgba(5, 150, 105, 0.25)" },
                  { label: "لوحة الوكلاء", emoji: "🤖", icon: Bot, path: "/agent-dashboard", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)", shadow: "rgba(99, 102, 241, 0.25)" },
                  { label: "المهام", emoji: "📝", icon: FileText, path: "/tasks", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)", shadow: "rgba(6, 182, 212, 0.25)" },
                  { label: "ملفات Drive", emoji: "📂", icon: Archive, path: "/drive", gradient: "linear-gradient(135deg, #10b981, #059669)", shadow: "rgba(16, 185, 129, 0.25)" },
                  { label: "المكاتب الاستشارية", emoji: "🏛️", icon: Users, path: "/consultant-portal", gradient: "linear-gradient(135deg, #78716c, #57534e)", shadow: "rgba(120, 113, 108, 0.25)" },
                  { label: "دراسة الجدوى", emoji: "📊", icon: Calculator, path: "/feasibility-study", gradient: "linear-gradient(135deg, #ef4444, #dc2626)", shadow: "rgba(239, 68, 68, 0.25)" },
                  { label: "ملخص التكليفات", emoji: "📊", icon: BarChart3, path: "/agent-assignments-summary", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245, 158, 11, 0.25)" },
                  { label: "سجل التكليفات", emoji: "📋", icon: ClipboardList, path: "/agent-assignments", gradient: "linear-gradient(135deg, #78716c, #57534e)", shadow: "rgba(120, 113, 108, 0.25)" },
                  { label: "سجل المحادثات", emoji: "💬", icon: MessageSquare, path: "/conversation-history", gradient: "linear-gradient(135deg, #ec4899, #db2777)", shadow: "rgba(236, 72, 153, 0.25)" },
                  { label: "قاعدة المعرفة", emoji: "📚", icon: BookOpen, path: "/knowledge-base", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "rgba(139, 92, 246, 0.25)" },
                  { label: "غرفة الاجتماعات", emoji: "🎙️", icon: Users, path: "/meetings", gradient: "linear-gradient(135deg, #a855f7, #7c3aed)", shadow: "rgba(168, 85, 247, 0.25)" },
                  { label: "سجل العقود", emoji: "⚖️", icon: Scale, path: "/contracts", gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)", shadow: "rgba(14, 165, 233, 0.25)" },
                  { label: "مراقبة التنفيذ", emoji: "⚡", icon: Activity, path: "/execution-dashboard", gradient: "linear-gradient(135deg, #f97316, #ea580c)", shadow: "rgba(249, 115, 22, 0.25)" },
                  { label: "سجل الإيميلات المرسلة", emoji: "✉️", icon: Send, path: "/sent-emails", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", shadow: "rgba(59, 130, 246, 0.25)" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(item.path)}
                    className="premium-card p-5 text-right hover-lift group relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-xl"
                      style={{ background: item.gradient }}
                    />
                    <div className="relative">
                      <ColorIcon bg={item.gradient} shadow={item.shadow}>
                        <item.icon className="w-6 h-6 text-white" />
                      </ColorIcon>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-lg">{item.emoji}</span>
                        <span className="font-semibold text-sm text-foreground">{item.label}</span>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground mt-2 transition-transform group-hover:-translate-x-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Agent Team Section (without Salwa) ── */}
        {isAuthenticated && teamAgents.length > 0 && (
          <section className="py-16 border-t border-border/50 bg-muted/30">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">فريق الوكلاء</h2>
                    <p className="text-muted-foreground text-sm">
                      {teamAgents.length} وكيل متخصص يعملون تحت إشراف سلوى
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/agent-dashboard")}
                  className="gap-1.5 text-xs"
                >
                  عرض التفاصيل
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Team Agents Grid - without Salwa */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
                {teamAgents.map((agent: any, i: number) => {
                  const IconComp = AGENT_ICONS[agent.icon || "bot"] || Bot;
                  const agentColor = agent.color || '#6366f1';
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setActiveAgent((agent.nameEn || agent.name).toLowerCase() as AgentType)}
                      className="premium-card p-6 group fade-in relative overflow-hidden hover-lift text-center cursor-pointer"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      {/* Avatar */}
                      {agent.avatarUrl && (
                        <div className="mx-auto mb-4 relative">
                          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-offset-2 ring-offset-background shadow-xl mx-auto transition-all duration-300 group-hover:scale-110 group-hover:ring-6" style={{ borderColor: agentColor }}>
                            <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                          </div>
                          <span className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1 w-4 h-4 bg-emerald-500 rounded-full border-3 border-background shadow-md" />
                        </div>
                      )}
                      {/* Colored top accent bar */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                        style={{ background: agentColor }}
                      />
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
                            boxShadow: `0 6px 16px ${agentColor}35`,
                          }}
                        >
                          <IconComp className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-foreground text-sm">{agent.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{agent.nameEn}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                        {agent.role}
                      </p>
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="relative">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              agent.status === "active"
                                ? "bg-emerald-500"
                                : agent.status === "maintenance"
                                ? "bg-amber-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {agent.status === "active" && (
                            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
                          )}
                        </div>
                        <span className={`text-[11px] font-medium ${
                          agent.status === "active"
                            ? "text-emerald-600"
                            : agent.status === "maintenance"
                            ? "text-amber-600"
                            : "text-gray-400"
                        }`}>
                          {agent.status === "active"
                            ? "نشط"
                            : agent.status === "maintenance"
                            ? "صيانة"
                            : "غير نشط"}
                        </span>
                      </div>
                      <div
                        className="w-full mt-4 gap-2 text-xs flex items-center justify-center rounded-md border border-input bg-transparent px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        تحدث مع {agent.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            COMO Developments &copy; {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-flex w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </span>
            مدعوم بالذكاء الاصطناعي
          </p>
        </div>
      </footer>

      {/* ── Agent Chat Box ── */}
      {activeAgent && (
        <AgentChatBox
          key={activeAgent}
          agent={activeAgent}
          agentData={agentsList.find((a: any) => (a.nameEn || a.name).toLowerCase() === activeAgent)}
          onClose={() => setActiveAgent(null)}
        />
      )}
    </div>
  );
}
