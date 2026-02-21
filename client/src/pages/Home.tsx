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
} from "lucide-react";
import { useLocation } from "wouter";
import { AgentChatBox, AgentType } from "@/components/AgentChatBox";

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

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const { data: agentsList = [] } = trpc.agents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const coordinator = agentsList.find((a: any) => a.isCoordinator === 1);
  const teamAgents = agentsList.filter((a: any) => a.isCoordinator !== 1);

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
        {/* ── Hero Section ── */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          {/* Colorful background blobs */}
          <div className="absolute inset-0 pattern-overlay opacity-40" />
          <div className="absolute top-10 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/8 blur-[100px]" />
          <div className="absolute bottom-10 left-1/4 w-[300px] h-[300px] rounded-full bg-stone-500/8 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />

          <div className="relative max-w-7xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-stone-500/10 border border-amber-500/20 text-primary text-xs font-medium mb-6 fade-in">
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
                {isAuthenticated ? (
                  <>
                    <Button
                      size="lg"
                      onClick={() => navigate("/agent-dashboard")}
                      className="gap-2 px-6 shadow-lg shadow-primary/20 bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950"
                    >
                      <Bot className="w-4 h-4" />
                      لوحة تحكم الوكلاء
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate("/tasks")}
                      className="gap-2 px-6"
                    >
                      <FileText className="w-4 h-4" />
                      المهام
                    </Button>
                  </>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => (window.location.href = getLoginUrl())}
                    className="gap-2 px-8 shadow-lg shadow-primary/20 bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950"
                  >
                    ابدأ الآن
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

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
                  borderColor: "#6366f1",
                },
                {
                  icon: Shield,
                  title: "تدقيق العقود",
                  desc: "مراجعة قانونية ذكية للعقود واكتشاف المخاطر",
                  gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  shadow: "rgba(6, 182, 212, 0.3)",
                  emoji: "🛡️",
                  borderColor: "#06b6d4",
                },
                {
                  icon: TrendingUp,
                  title: "تحليل مالي",
                  desc: "تحليل الميزانيات والمستخلصات المالية بدقة",
                  gradient: "linear-gradient(135deg, #10b981, #059669)",
                  shadow: "rgba(16, 185, 129, 0.3)",
                  emoji: "💰",
                  borderColor: "#10b981",
                },
                {
                  icon: Layers,
                  title: "أرشفة ذكية",
                  desc: "تنظيم وأرشفة الملفات تلقائياً بتسمية احترافية",
                  gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
                  shadow: "rgba(245, 158, 11, 0.3)",
                  emoji: "📁",
                  borderColor: "#f59e0b",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="premium-card p-6 hover-lift fade-in group relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {/* Colored top accent bar */}
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
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

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
                  { label: "لوحة الوكلاء", emoji: "🤖", icon: Bot, path: "/agent-dashboard", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)", shadow: "rgba(99, 102, 241, 0.25)" },
                  { label: "المهام", emoji: "📝", icon: FileText, path: "/tasks", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)", shadow: "rgba(6, 182, 212, 0.25)" },
                  { label: "ملفات Drive", emoji: "📂", icon: Archive, path: "/drive", gradient: "linear-gradient(135deg, #10b981, #059669)", shadow: "rgba(16, 185, 129, 0.25)" },
                  { label: "المكاتب الاستشارية", emoji: "🏛️", icon: Users, path: "/consultant-portal", gradient: "linear-gradient(135deg, #78716c, #57534e)", shadow: "rgba(120, 113, 108, 0.25)" },
                  { label: "دراسة الجدوى", emoji: "📊", icon: Calculator, path: "/feasibility-study", gradient: "linear-gradient(135deg, #ef4444, #dc2626)", shadow: "rgba(239, 68, 68, 0.25)" },
                  { label: "تكليفات الوكلاء", emoji: "📋", icon: ClipboardList, path: "/agent-assignments", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245, 158, 11, 0.25)" },
                  { label: "سجل المحادثات", emoji: "💬", icon: MessageSquare, path: "/conversation-history", gradient: "linear-gradient(135deg, #ec4899, #db2777)", shadow: "rgba(236, 72, 153, 0.25)" },
                  { label: "قاعدة المعرفة", emoji: "📚", icon: BookOpen, path: "/knowledge-base", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "rgba(139, 92, 246, 0.25)" },
                  { label: "عروض الاستشاريين", emoji: "📄", icon: FileText, path: "/proposals", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", shadow: "rgba(59, 130, 246, 0.25)" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(item.path)}
                    className="premium-card p-5 text-right hover-lift group relative overflow-hidden"
                  >
                    {/* Subtle gradient overlay on hover */}
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

        {/* ── Agent Team Section ── */}
        {isAuthenticated && agentsList.length > 0 && (
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
                      {agentsList.length} وكيل متخصص يعملون تحت إشراف سلوى
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

              {/* Coordinator Card */}
              {coordinator && (
                <button
                  onClick={() => setActiveAgent("salwa" as AgentType)}
                  className="premium-card p-6 mb-6 gold-glow fade-in relative overflow-hidden cursor-pointer text-right w-full"
                >
                  {/* Gold accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
                  <div className="flex items-center gap-5">
                    {/* Salwa's Avatar */}
                    <div className="relative shrink-0">
                      {coordinator.avatarUrl ? (
                        <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-amber-400 ring-offset-2 ring-offset-background shadow-xl transition-all duration-300 hover:scale-110">
                          <img src={coordinator.avatarUrl} alt={coordinator.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div
                          className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${coordinator.color || '#6366f1'}, ${coordinator.color || '#6366f1'}cc)`,
                          }}
                        >
                          {(() => {
                            const IconComp = AGENT_ICONS[coordinator.icon || "crown"] || Crown;
                            return <IconComp className="w-10 h-10 text-white" />;
                          })()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-3 border-background shadow-md" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-foreground">{coordinator.name}</h3>
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-stone-500/10 text-amber-700 font-semibold border border-amber-200">
                          👑 المنسقة
                        </span>
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 border border-emerald-200 flex items-center gap-1 font-semibold">
                          <Send className="w-3 h-3" />
                          تيليجرام
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{coordinator.role}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">{coordinator.description}</p>
                      {coordinator.capabilities && coordinator.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                          {coordinator.capabilities.map((cap: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )}

              {/* Team Agents Grid - with avatars */}
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
                      <div className="flex items-center gap-2">
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
          agent={activeAgent}
          agentData={agentsList.find((a: any) => (a.nameEn || a.name).toLowerCase() === activeAgent)}
          onClose={() => setActiveAgent(null)}
        />
      )}
    </div>
  );
}
