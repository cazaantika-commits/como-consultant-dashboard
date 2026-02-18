import { useAuth } from "@/_core/hooks/useAuth";
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
  Rocket,
  BarChart2,
  Send,
  ChevronLeft,
  Building2,
  LogOut,
} from "lucide-react";
import { useLocation } from "wouter";

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

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
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
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
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
          {/* Subtle background pattern */}
          <div className="absolute inset-0 pattern-overlay opacity-40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

          <div className="relative max-w-7xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-medium mb-6 fade-in">
                <Sparkles className="w-3.5 h-3.5" />
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
                      className="gap-2 px-6 shadow-lg shadow-primary/20"
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
                    className="gap-2 px-8 shadow-lg shadow-primary/20"
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
              <h2 className="text-2xl font-bold text-foreground mb-3">قدرات المنصة</h2>
              <p className="text-muted-foreground">أدوات متقدمة لإدارة كل جانب من جوانب مشاريعك</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: Bot,
                  title: "وكلاء ذكيون",
                  desc: "فريق من الوكلاء المتخصصين يعملون على مدار الساعة",
                  color: "oklch(0.50 0.18 255)",
                },
                {
                  icon: Shield,
                  title: "تدقيق العقود",
                  desc: "مراجعة قانونية ذكية للعقود واكتشاف المخاطر",
                  color: "oklch(0.55 0.20 175)",
                },
                {
                  icon: BarChart3,
                  title: "تحليل مالي",
                  desc: "تحليل الميزانيات والمستخلصات المالية بدقة",
                  color: "oklch(0.55 0.22 145)",
                },
                {
                  icon: FileText,
                  title: "أرشفة ذكية",
                  desc: "تنظيم وأرشفة الملفات تلقائياً بتسمية احترافية",
                  color: "oklch(0.55 0.18 45)",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="premium-card p-6 hover-lift fade-in group"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                    style={{ 
                      backgroundColor: `color-mix(in oklch, ${feature.color} 15%, transparent)`,
                      boxShadow: `0 0 0 0 ${feature.color}20`
                    }}
                  >
                    <feature.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" style={{ color: feature.color }} />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Quick Navigation (Authenticated) ── */}
        {isAuthenticated && (
          <section className="py-12 border-t border-border/50">
            <div className="max-w-7xl mx-auto px-6">
              <h2 className="text-lg font-bold text-foreground mb-5">الوصول السريع</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "لوحة الوكلاء", icon: Bot, path: "/agent-dashboard", color: "oklch(0.50 0.18 255)" },
                  { label: "المهام", icon: FileText, path: "/tasks", color: "oklch(0.55 0.20 175)" },
                  { label: "ملفات Drive", icon: Archive, path: "/drive", color: "oklch(0.55 0.22 145)" },
                  { label: "تقييم الاستشاريين", icon: Users, path: "/consultant-dashboard", color: "oklch(0.55 0.18 45)" },
                  { label: "دراسة الجدوى", icon: Calculator, path: "/feasibility-study", color: "oklch(0.50 0.20 30)" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(item.path)}
                    className="premium-card p-5 text-right hover-lift group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                      style={{ backgroundColor: `color-mix(in oklch, ${item.color} 18%, transparent)` }}
                    >
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <span className="font-semibold text-sm text-foreground">{item.label}</span>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground mt-2 transition-transform group-hover:-translate-x-1" />
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
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">فريق الوكلاء</h2>
                  <p className="text-muted-foreground text-sm">
                    {agentsList.length} وكيل متخصص يعملون تحت إشراف سلوى
                  </p>
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
                <div className="premium-card p-6 mb-6 gold-glow fade-in">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${coordinator.color || '#6366f1'} 10%, transparent)`,
                        border: `2px solid color-mix(in oklch, ${coordinator.color || '#6366f1'} 20%, transparent)`,
                      }}
                    >
                      {(() => {
                        const IconComp = AGENT_ICONS[coordinator.icon || "crown"] || Crown;
                        return <IconComp className="w-7 h-7" style={{ color: coordinator.color }} />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-foreground">{coordinator.name}</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          المنسقة
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1 font-medium">
                          <Send className="w-3 h-3" />
                          تيليجرام
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{coordinator.role}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">{coordinator.description}</p>
                    </div>
                  </div>
                  {coordinator.capabilities && coordinator.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
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
              )}

              {/* Team Agents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {teamAgents.map((agent: any, i: number) => {
                  const IconComp = AGENT_ICONS[agent.icon || "bot"] || Bot;
                  return (
                    <div
                      key={agent.id}
                      className="premium-card p-5 group fade-in"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${agent.color || '#6366f1'} 10%, transparent)`,
                            border: `1px solid color-mix(in oklch, ${agent.color || '#6366f1'} 15%, transparent)`,
                          }}
                        >
                          <IconComp className="w-5 h-5" style={{ color: agent.color }} />
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
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === "active"
                              ? "bg-emerald-500"
                              : agent.status === "maintenance"
                              ? "bg-amber-500"
                              : "bg-gray-400"
                          }`}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {agent.status === "active"
                            ? "نشط"
                            : agent.status === "maintenance"
                            ? "صيانة"
                            : "غير نشط"}
                        </span>
                      </div>
                    </div>
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
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary/50" />
            مدعوم بالذكاء الاصطناعي
          </p>
        </div>
      </footer>
    </div>
  );
}
