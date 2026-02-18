import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, BarChart3, ClipboardList, TrendingUp, FileText, Building2, HardDrive, Bot, Crown, Archive, Scale, Gauge, ShieldCheck, Calculator, Rocket, BarChart2, ArrowLeft, LogOut, ChevronLeft, Sparkles, Send } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useMemo } from "react";

// Agent icon mapping
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
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { data: agentsList = [] } = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: taskStats } = trpc.tasks.stats.useQuery(undefined, { enabled: isAuthenticated });

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 pattern-overlay" dir="rtl">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] right-[10%] w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] left-[15%] w-96 h-96 bg-primary/3 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Logo area */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-gold-gradient mb-3">COMO</h1>
            <p className="text-lg text-muted-foreground">مركز القيادة الذكي</p>
          </div>

          {/* Login card */}
          <div className="glass-card p-8">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground mb-2">مرحباً بك</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  منظومة إدارة رقمية متكاملة لمشاريع التطوير العقاري
                  <br />
                  مدعومة بفريق من الوكلاء الذكيين
                </p>
              </div>
              <Button
                onClick={() => (window.location.href = getLoginUrl())}
                className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                size="lg"
              >
                تسجيل الدخول
              </Button>
              <div className="flex items-center gap-3 justify-center text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>مدعوم بالذكاء الاصطناعي</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      title: "تقييم الاستشاريين",
      description: "مقارنة وتقييم الاستشاريين الهندسيين — الأتعاب والتقييم الفني",
      icon: BarChart3,
      path: "/consultant-dashboard",
      color: "#60a5fa",
      active: true,
    },
    {
      title: "الملفات التعريفية",
      description: "عرض تفصيلي لكل استشاري مع ملاحظات ونقاط القوة والضعف",
      icon: Building2,
      path: "/consultant-profiles",
      color: "#34d399",
      active: true,
    },
    {
      title: "مستعرض الملفات",
      description: "تصفح وإدارة ملفات Google Drive — المجلدات والمستندات",
      icon: HardDrive,
      path: "/drive",
      color: "#a78bfa",
      active: true,
    },
    {
      title: "لوحة المهام",
      description: "إدارة ومتابعة مهام المشاريع — إدخال يدوي وذكي",
      icon: ClipboardList,
      path: "/tasks",
      color: "#fbbf24",
      active: true,
    },
    {
      title: "لوحة تحكم الوكلاء",
      description: "متابعة مهام الوكلاء الذكيين — فلترة وسجل النشاط",
      icon: Bot,
      path: "/agent-dashboard",
      color: "#f472b6",
      active: true,
    },
    {
      title: "دراسات الجدوى",
      description: "تحليل الجدوى المالية للمشاريع — قريباً",
      icon: TrendingUp,
      path: "#",
      color: "#6b7280",
      active: false,
    },
    {
      title: "دراسة السوق",
      description: "تحليل السوق العقاري — قريباً",
      icon: FileText,
      path: "#",
      color: "#6b7280",
      active: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-primary/3 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-8">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gold-gradient">COMO Developments</h2>
                <p className="text-xs text-muted-foreground">مركز القيادة الذكي</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border border-border/50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-muted-foreground">{user?.name || "مستخدم"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 bg-transparent"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Welcome section */}
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              مرحباً، <span className="text-gold-gradient">{user?.name || "بك"}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              منظومة إدارة رقمية متكاملة لمشاريع التطوير العقاري — مدعومة بفريق من {agentsList.length} وكلاء ذكيين
            </p>
          </div>

          {/* Quick Stats */}
          {taskStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "إجمالي المهام", value: taskStats.total, color: "text-primary" },
                { label: "قيد التنفيذ", value: taskStats.progress, color: "text-blue-400" },
                { label: "مكتملة", value: taskStats.done, color: "text-green-400" },
                { label: "متأخرة", value: taskStats.overdue, color: "text-red-400" },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-4 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-16">
        {/* Navigation Cards */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h2 className="text-xl font-bold text-foreground">الأقسام الرئيسية</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navItems.map((item, i) => (
              <div
                key={i}
                onClick={() => item.active && navigate(item.path)}
                className={`glass-card p-6 group ${item.active ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  {item.active && (
                    <ChevronLeft className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-1" />
                  )}
                </div>
                {!item.active && (
                  <div className="mt-3 text-xs text-muted-foreground/50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    قريباً
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AI Team Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h2 className="text-xl font-bold text-foreground">فريق الوكلاء الذكيين</h2>
            <span className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full border border-border/50">
              {agentsList.length} وكيل
            </span>
          </div>

          {/* Coordinator Card - Salwa */}
          {coordinator && (
            <div className="mb-6">
              <div className="glass-card p-6 border-primary/20 gold-glow">
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
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        المنسقة
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        تيليجرام
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{coordinator.role}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">{coordinator.description}</p>
                  </div>
                </div>
                {coordinator.capabilities && coordinator.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/30">
                    {coordinator.capabilities.map((cap: string, idx: number) => (
                      <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-primary/5 text-primary/80 border border-primary/10">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teamAgents.map((agent: any) => {
              const IconComp = AGENT_ICONS[agent.icon || "bot"] || Bot;
              return (
                <div key={agent.id} className="glass-card p-5 group">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                    >
                      <IconComp className="w-5 h-5" style={{ color: agent.color }} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{agent.nameEn}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                    {agent.role}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-green-500" : agent.status === "maintenance" ? "bg-amber-500" : "bg-gray-500"}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {agent.status === "active" ? "نشط" : agent.status === "maintenance" ? "صيانة" : "غير نشط"}
                    </span>
                    {agent.gender === "female" && (
                      <span className="text-xs text-muted-foreground/50 mr-auto">♀</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground/50">
            COMO Developments &copy; {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary/50" />
            مدعوم بالذكاء الاصطناعي
          </p>
        </div>
      </footer>
    </div>
  );
}
