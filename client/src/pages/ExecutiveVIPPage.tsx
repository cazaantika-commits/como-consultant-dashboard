import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Star,
  Building2,
  FileText,
  BarChart3,
  DollarSign,
  Briefcase,
  MessageCircle,
  ChevronLeft,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  CalendarDays,
  Mail,
} from "lucide-react";
import { AgentChatBox } from "@/components/AgentChatBox";

/* ─── animated floating particles background ─── */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      w: Math.random() * 24 + 6,
      hue: Math.random() * 60 + 20,
      left: Math.random() * 100,
      top: Math.random() * 100,
      dur: Math.random() * 12 + 18,
      delay: Math.random() * 8,
    })), []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: `${p.w}px`,
            height: `${p.w}px`,
            background: `hsl(${p.hue}, 80%, 65%)`,
            opacity: 0.15,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animation: `floatParticle ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── news ticker ─── */
function NewsTicker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 backdrop-blur-sm border border-amber-200/50 rounded-2xl py-3 px-4 mb-8">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
          آخر الأخبار
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex whitespace-nowrap" style={{ animation: "ticker 45s linear infinite" }}>
            {doubled.map((item, i) => (
              <span key={i} className="mx-8 text-sm text-amber-900 font-medium">
                {item} ◆
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── main bubble component ─── */
interface BubbleProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
  color: string;
  glowColor: string;
  size: "large" | "medium" | "small";
  onClick: () => void;
  pulse?: boolean;
  animDelay?: number;
}

function Bubble({ icon, title, subtitle, count, color, glowColor, size, onClick, pulse, animDelay = 0 }: BubbleProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay * 120);
    return () => clearTimeout(t);
  }, [animDelay]);

  const sizeClasses = {
    large: "w-36 h-36 sm:w-44 sm:h-44",
    medium: "w-28 h-28 sm:w-34 sm:h-34",
    small: "w-22 h-22 sm:w-26 sm:h-26",
  };
  const iconSize = size === "large" ? "w-10 h-10" : size === "medium" ? "w-7 h-7" : "w-5 h-5";
  const titleSize = size === "large" ? "text-sm sm:text-base" : size === "medium" ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs";

  return (
    <button
      onClick={onClick}
      className={`
        group relative ${sizeClasses[size]} rounded-full
        flex flex-col items-center justify-center gap-1.5
        cursor-pointer select-none
        hover:scale-110 active:scale-95
        ${color}
        transition-all duration-500
      `}
      style={{
        boxShadow: `0 0 30px ${glowColor}, 0 10px 40px rgba(0,0,0,0.12)`,
        animation: visible ? `floatBubble ${3.5 + animDelay * 0.4}s ease-in-out infinite` : "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
        transitionProperty: "opacity, transform",
        transitionDuration: "0.6s",
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* pulse ring */}
      {pulse && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: glowColor, opacity: 0.15 }}
        />
      )}
      {/* count badge */}
      {count !== undefined && count > 0 && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg z-10 animate-bounce">
          {count}
        </div>
      )}
      {/* icon */}
      <div className={`${iconSize} text-white drop-shadow-lg transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      {/* title */}
      <span className={`${titleSize} font-bold text-white drop-shadow-md text-center leading-tight px-2`}>
        {title}
      </span>
      {subtitle && (
        <span className="text-[10px] text-white/80 drop-shadow-sm text-center px-2">
          {subtitle}
        </span>
      )}
      {/* hover glow */}
      <div
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"
        style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
      />
    </button>
  );
}

/* ─── Salwa greeting ─── */
function SalwaGreeting({ onChatClick }: { onChatClick: () => void }) {
  const [greeting, setGreeting] = useState("");
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء النور";

  useEffect(() => {
    const greetings = [
      `${timeGreeting}! أنا جاهزة لأي سؤال أو طلب.`,
      `${timeGreeting}! كل شيء تحت السيطرة. تفضل اسأل.`,
      `${timeGreeting}! عندي تحديثات جديدة لك اليوم.`,
    ];
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  return (
    <div className="relative mb-6">
      <div
        className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-4 shadow-lg backdrop-blur-sm cursor-pointer hover:shadow-xl transition-shadow"
        onClick={onChatClick}
      >
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
            <span className="text-2xl sm:text-3xl">👩‍💼</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-amber-900">
            سلوى <span className="text-xs font-normal text-amber-600">• المنسقة الرئيسية</span>
          </h2>
          <p className="text-sm text-amber-800 mt-0.5">{greeting}</p>
        </div>
        <div className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full p-2.5 shadow-lg">
          <MessageCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/* ─── sub-page view ─── */
function SubPage({ title, icon, color, onBack, children }: {
  title: string; icon: React.ReactNode; color: string; onBack: () => void; children: React.ReactNode;
}) {
  return (
    <div className="animate-in slide-in-from-right duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm">العودة</span>
      </button>
      <div className={`${color} rounded-3xl p-5 mb-6 text-white shadow-xl`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">{icon}</div>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── stat card ─── */
function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: React.ReactNode; trend?: "up" | "down" | "neutral" }) {
  return (
    <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-600">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
      {trend && (
        <div className={`text-xs font-medium ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-gray-400"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   ─── MAIN PAGE ───
   ═══════════════════════════════════════════════════ */
export default function ExecutiveVIPPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Fetch data from platform
  const { data: tasks } = trpc.tasks.list.useQuery();
  const { data: projects } = trpc.projects.listWithStats.useQuery();
  const { data: taskStats } = trpc.tasks.stats.useQuery();

  // Derive counts
  const urgentTasks = useMemo(() => tasks?.filter(t => t.priority === "urgent" && t.status !== "done") || [], [tasks]);
  const importantTasks = useMemo(() => tasks?.filter(t => t.priority === "high" && t.status !== "done") || [], [tasks]);

  // Derive news ticker items from real data
  const tickerItems = useMemo(() => {
    const items: string[] = [];
    if (taskStats) {
      items.push(`📋 إجمالي المهام: ${taskStats.total} | مكتملة: ${taskStats.completed || 0} | قيد التنفيذ: ${taskStats.inProgress || 0}`);
    }
    if (projects?.length) {
      items.push(`🏗️ عدد المشاريع النشطة: ${projects.length} مشروع`);
      projects.slice(0, 3).forEach(p => {
        items.push(`🏢 ${p.name}: اكتمال ${p.completionPercentage || 0}%`);
      });
    }
    if (urgentTasks.length) {
      items.push(`🔴 مهام عاجلة: ${urgentTasks.length} تحتاج اهتمام فوري`);
    }
    if (!items.length) {
      items.push("مرحباً بك في لوحة القيادة التنفيذية ◆ جميع الأنظمة تعمل بشكل طبيعي");
    }
    return items;
  }, [taskStats, projects, urgentTasks]);

  const firstName = user?.name?.split(" ")[0] || "سيدي";

  // ─── sub-page content renderers ───
  const renderUrgent = () => (
    <SubPage title="عاجل" icon={<AlertTriangle className="w-6 h-6" />} color="bg-gradient-to-r from-red-500 to-rose-600" onBack={() => setActiveSection(null)}>
      <div className="space-y-3">
        {urgentTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-green-700">لا توجد أمور عاجلة</p>
            <p className="text-sm text-muted-foreground mt-1">كل شيء تحت السيطرة</p>
          </Card>
        ) : urgentTasks.map(task => (
          <Card key={task.id} className="p-4 border-r-4 border-r-red-500 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div><p className="font-bold text-sm">{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
              </div>
              <Badge variant="destructive" className="text-xs flex-shrink-0">عاجل</Badge>
            </div>
            {task.assignedAgent && <p className="text-xs text-muted-foreground mt-2">المسؤول: {task.assignedAgent}</p>}
          </Card>
        ))}
      </div>
    </SubPage>
  );

  const renderImportant = () => (
    <SubPage title="هام" icon={<Star className="w-6 h-6" />} color="bg-gradient-to-r from-amber-500 to-yellow-600" onBack={() => setActiveSection(null)}>
      <div className="space-y-3">
        {importantTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-green-700">لا توجد أمور هامة معلقة</p>
          </Card>
        ) : importantTasks.map(task => (
          <Card key={task.id} className="p-4 border-r-4 border-r-amber-500 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div><p className="font-bold text-sm">{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
              </div>
              <Badge className="bg-amber-100 text-amber-800 text-xs flex-shrink-0">هام</Badge>
            </div>
          </Card>
        ))}
      </div>
    </SubPage>
  );

  const renderCommercialCenter = () => {
    const cp = projects?.find(p => p.name?.includes("تجاري") || p.name?.includes("Commercial") || p.name?.includes("مركز"));
    return (
      <SubPage title="المركز التجاري" icon={<Building2 className="w-6 h-6" />} color="bg-gradient-to-r from-blue-500 to-indigo-600" onBack={() => setActiveSection(null)}>
        {cp ? (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-bold text-lg mb-3">{cp.name}</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="نسبة الإنجاز" value={`${cp.completionPercentage || 0}%`} icon={<TrendingUp className="w-5 h-5" />} />
                <StatCard label="الحالة" value={cp.status === "active" ? "نشط" : "متوقف"} icon={<Clock className="w-5 h-5" />} />
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Building2 className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-lg font-bold">تقارير المركز التجاري</p>
            <p className="text-sm text-muted-foreground mt-1">سيتم إضافة التفاصيل قريباً</p>
          </Card>
        )}
      </SubPage>
    );
  };

  const renderMeetingMinutes = () => (
    <SubPage title="محضر الاجتماع السابق" icon={<FileText className="w-6 h-6" />} color="bg-gradient-to-r from-purple-500 to-violet-600" onBack={() => setActiveSection(null)}>
      <Card className="p-6 text-center">
        <FileText className="w-12 h-12 text-purple-400 mx-auto mb-3" />
        <p className="text-lg font-bold">محاضر الاجتماعات</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">اضغط لعرض آخر محضر اجتماع</p>
        <button onClick={() => navigate("/meetings")} className="bg-gradient-to-r from-purple-500 to-violet-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:shadow-lg transition-all">
          عرض الاجتماعات <ArrowRight className="w-4 h-4 inline mr-1" />
        </button>
      </Card>
    </SubPage>
  );

  const renderProjects = () => (
    <SubPage title="المشاريع" icon={<Briefcase className="w-6 h-6" />} color="bg-gradient-to-r from-emerald-500 to-teal-600" onBack={() => setActiveSection(null)}>
      <div className="space-y-3">
        {projects?.map(p => (
          <Card key={p.id} className="p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]" onClick={() => navigate(`/project/${p.id}`)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.location || "—"}</p>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold text-emerald-600">{p.completionPercentage || 0}%</div>
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" style={{ width: `${p.completionPercentage || 0}%` }} />
                </div>
              </div>
            </div>
          </Card>
        )) || <Card className="p-8 text-center"><p className="text-muted-foreground">جاري التحميل...</p></Card>}
      </div>
    </SubPage>
  );

  const renderWorkProgram = () => (
    <SubPage title="برامج العمل" icon={<BarChart3 className="w-6 h-6" />} color="bg-gradient-to-r from-cyan-500 to-blue-600" onBack={() => setActiveSection(null)}>
      <Card className="p-6 text-center">
        <BarChart3 className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
        <p className="text-lg font-bold">برامج العمل والجداول الزمنية</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">تتبع تقدم المشاريع والمراحل</p>
        <button onClick={() => navigate("/execution-dashboard")} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:shadow-lg transition-all">
          عرض لوحة التنفيذ <ArrowRight className="w-4 h-4 inline mr-1" />
        </button>
      </Card>
    </SubPage>
  );

  const renderCashFlow = () => (
    <SubPage title="التدفقات النقدية" icon={<DollarSign className="w-6 h-6" />} color="bg-gradient-to-r from-green-500 to-emerald-600" onBack={() => setActiveSection(null)}>
      <Card className="p-6 text-center">
        <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-lg font-bold">التدفقات النقدية</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">تحليل مالي شامل للمشاريع</p>
        <button onClick={() => navigate("/feasibility-study")} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:shadow-lg transition-all">
          عرض التحليل المالي <ArrowRight className="w-4 h-4 inline mr-1" />
        </button>
      </Card>
    </SubPage>
  );

  const renderEmails = () => (
    <SubPage title="البريد الإلكتروني" icon={<Mail className="w-6 h-6" />} color="bg-gradient-to-r from-pink-500 to-rose-600" onBack={() => setActiveSection(null)}>
      <Card className="p-6 text-center">
        <Mail className="w-12 h-12 text-pink-400 mx-auto mb-3" />
        <p className="text-lg font-bold">البريد الإلكتروني</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">إدارة الرسائل والمراسلات</p>
        <button onClick={() => navigate("/sent-emails")} className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:shadow-lg transition-all">
          عرض الرسائل <ArrowRight className="w-4 h-4 inline mr-1" />
        </button>
      </Card>
    </SubPage>
  );

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    urgent: renderUrgent,
    important: renderImportant,
    commercial: renderCommercialCenter,
    minutes: renderMeetingMinutes,
    projects: renderProjects,
    workProgram: renderWorkProgram,
    cashFlow: renderCashFlow,
    emails: renderEmails,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 relative overflow-hidden" dir="rtl">
      <FloatingParticles />

      {/* CSS animations */}
      <style>{`
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.12; }
          25% { transform: translate(30px, -40px) scale(1.2); opacity: 0.22; }
          50% { transform: translate(-20px, -60px) scale(0.8); opacity: 0.08; }
          75% { transform: translate(40px, -20px) scale(1.1); opacity: 0.18; }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 sm:py-8">
        {/* header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-l from-amber-700 to-orange-600 bg-clip-text text-transparent">
              مرحباً، {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
        </div>

        {/* Salwa greeting */}
        <SalwaGreeting onChatClick={() => setShowChat(true)} />

        {activeSection ? (
          sectionRenderers[activeSection]?.() || null
        ) : (
          <>
            {/* news ticker */}
            <NewsTicker items={tickerItems} />

            {/* ─── 4 large priority bubbles ─── */}
            <div className="grid grid-cols-2 gap-5 justify-items-center mb-8">
              <Bubble
                icon={<AlertTriangle className="w-full h-full" />}
                title="عاجل"
                subtitle={urgentTasks.length > 0 ? `${urgentTasks.length} بند` : "لا يوجد"}
                count={urgentTasks.length}
                color="bg-gradient-to-br from-red-400 to-rose-600"
                glowColor="rgba(239,68,68,0.35)"
                size="large"
                onClick={() => setActiveSection("urgent")}
                pulse={urgentTasks.length > 0}
                animDelay={0}
              />
              <Bubble
                icon={<Star className="w-full h-full" />}
                title="هام"
                subtitle={importantTasks.length > 0 ? `${importantTasks.length} بند` : "لا يوجد"}
                count={importantTasks.length}
                color="bg-gradient-to-br from-amber-400 to-yellow-600"
                glowColor="rgba(245,158,11,0.35)"
                size="large"
                onClick={() => setActiveSection("important")}
                pulse={importantTasks.length > 0}
                animDelay={1}
              />
              <Bubble
                icon={<Building2 className="w-full h-full" />}
                title="المركز التجاري"
                color="bg-gradient-to-br from-blue-400 to-indigo-600"
                glowColor="rgba(59,130,246,0.35)"
                size="large"
                onClick={() => setActiveSection("commercial")}
                animDelay={2}
              />
              <Bubble
                icon={<FileText className="w-full h-full" />}
                title="محضر الاجتماع"
                subtitle="السابق"
                color="bg-gradient-to-br from-purple-400 to-violet-600"
                glowColor="rgba(139,92,246,0.35)"
                size="large"
                onClick={() => setActiveSection("minutes")}
                animDelay={3}
              />
            </div>

            {/* ─── medium secondary bubbles ─── */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Bubble
                icon={<Briefcase className="w-full h-full" />}
                title="المشاريع"
                count={projects?.length}
                color="bg-gradient-to-br from-emerald-400 to-teal-600"
                glowColor="rgba(16,185,129,0.3)"
                size="medium"
                onClick={() => setActiveSection("projects")}
                animDelay={4}
              />
              <Bubble
                icon={<BarChart3 className="w-full h-full" />}
                title="برامج العمل"
                color="bg-gradient-to-br from-cyan-400 to-blue-600"
                glowColor="rgba(6,182,212,0.3)"
                size="medium"
                onClick={() => setActiveSection("workProgram")}
                animDelay={5}
              />
              <Bubble
                icon={<DollarSign className="w-full h-full" />}
                title="التدفقات النقدية"
                color="bg-gradient-to-br from-green-400 to-emerald-600"
                glowColor="rgba(34,197,94,0.3)"
                size="medium"
                onClick={() => setActiveSection("cashFlow")}
                animDelay={6}
              />
              <Bubble
                icon={<Mail className="w-full h-full" />}
                title="البريد"
                color="bg-gradient-to-br from-pink-400 to-rose-600"
                glowColor="rgba(236,72,153,0.3)"
                size="medium"
                onClick={() => setActiveSection("emails")}
                animDelay={7}
              />
            </div>

            {/* ─── quick stats bar ─── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="p-3 text-center bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <p className="text-2xl font-bold text-amber-600">{taskStats?.total || 0}</p>
                <p className="text-[10px] text-muted-foreground">إجمالي المهام</p>
              </Card>
              <Card className="p-3 text-center bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <p className="text-2xl font-bold text-green-600">{taskStats?.completed || 0}</p>
                <p className="text-[10px] text-muted-foreground">مكتملة</p>
              </Card>
              <Card className="p-3 text-center bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <p className="text-2xl font-bold text-red-500">{urgentTasks.length}</p>
                <p className="text-[10px] text-muted-foreground">عاجلة</p>
              </Card>
            </div>
          </>
        )}

        {/* floating Salwa chat button */}
        {!showChat && (
          <div className="fixed bottom-6 left-6 z-50">
            <button
              onClick={() => setShowChat(true)}
              className="group relative bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl hover:shadow-amber-500/30 transition-all hover:scale-110 active:scale-95"
            >
              <MessageCircle className="w-6 h-6" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                تحدث مع سلوى
              </span>
            </button>
          </div>
        )}

        {/* Salwa chat overlay */}
        {showChat && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-lg h-[85vh] sm:h-[80vh] sm:rounded-3xl overflow-hidden shadow-2xl">
              <AgentChatBox
                agent="salwa"
                agentData={{
                  name: "سلوى",
                  role: "المنسقة الرئيسية",
                  color: "#f59e0b",
                  description: "المساعدة التنفيذية الذكية",
                }}
                onClose={() => setShowChat(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
