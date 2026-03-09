import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  ShieldAlert,
  Brain,
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
  HardHat,
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
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait ${color} ${borderColor}`}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
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
    <div className="mt-4 bg-white dark:bg-card rounded-2xl border border-amber-200/60 dark:border-amber-800/30 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-b border-amber-200/40">
        <div className="flex items-center gap-2">
          <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-6 h-6 rounded-full ring-2 ring-amber-400/50" />
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

/* ── Sortable Main Card (big cards) ── */
type NavItem = { id: string; label: string; icon: any; path: string; borderColor: string; iconBg: string; shadow: string };

function SortableMainCard({ item, onNavigate }: { item: NavItem; onNavigate: (path: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
    background: `linear-gradient(180deg, ${item.borderColor}08 0%, transparent 60%)`,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onNavigate(item.path)}
      className={`group relative rounded-2xl border border-border/40 py-7 px-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none ${isDragging ? 'shadow-2xl scale-105 ring-2 ring-primary/30' : ''}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[4px] rounded-t-2xl" style={{ background: item.iconBg }} />
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.07] blur-2xl" style={{ background: item.borderColor }} />
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ring-4 ring-white/80 dark:ring-card/80"
          style={{ background: item.iconBg, boxShadow: `0 6px 20px ${item.shadow}` }}
        >
          <item.icon className="w-7 h-7 text-white" />
        </div>
        <span className="text-[15px] font-bold text-foreground">{item.label}</span>
      </div>
    </div>
  );
}

/* ── Sortable Tool Card (smaller cards) ── */
function SortableToolCard({ item, onNavigate }: { item: NavItem; onNavigate: (path: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onNavigate(item.path)}
      className={`group relative bg-card hover:bg-card/90 rounded-xl border border-border/50 p-4 text-right transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none ${isDragging ? 'shadow-2xl scale-105 ring-2 ring-primary/30' : ''}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ backgroundColor: item.borderColor }} />
      <div className="flex items-center gap-3 flex-row-reverse">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{ background: item.iconBg, boxShadow: `0 4px 14px ${item.shadow}` }}
        >
          <item.icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-foreground block">{item.label}</span>
        </div>
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /* ── Drag & Drop order state ── */
  const [mainOrder, setMainOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("como_main_order");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [toolsOrder, setToolsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("como_tools_order");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );
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

  /* ── Navigation items organized in groups ── */
  const NAV_MAIN = [
    { id: "main-projects", label: "إدارة المشاريع", icon: Building2, path: "/project-management", borderColor: "#059669", iconBg: "linear-gradient(135deg, #059669, #047857)", shadow: "rgba(5, 150, 105, 0.25)" },
    { id: "main-dev", label: "مراحل التطوير", icon: HardHat, path: "/development-phases", borderColor: "#8b5cf6", iconBg: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "rgba(139, 92, 246, 0.25)" },
    { id: "main-cmd", label: "مركز القيادة", icon: Crown, path: "/command-center", borderColor: "#d97706", iconBg: "linear-gradient(135deg, #d97706, #b45309)", shadow: "rgba(217, 119, 6, 0.25)" },
    { id: "main-consult", label: "المكاتب الاستشارية", icon: Users, path: "/consultant-portal", borderColor: "#78716c", iconBg: "linear-gradient(135deg, #78716c, #57534e)", shadow: "rgba(120, 113, 108, 0.25)" },
    { id: "main-agents", label: "لوحة الوكلاء", icon: Bot, path: "/agent-dashboard", borderColor: "#6366f1", iconBg: "linear-gradient(135deg, #6366f1, #8b5cf6)", shadow: "rgba(99, 102, 241, 0.25)" },
  ];

  const NAV_TOOLS = [
    { id: "tool-tasks", label: "المهام", icon: FileText, path: "/tasks", borderColor: "#06b6d4", iconBg: "linear-gradient(135deg, #06b6d4, #0891b2)", shadow: "rgba(6, 182, 212, 0.25)" },
    { id: "tool-drive", label: "ملفات Drive", icon: Archive, path: "/drive", borderColor: "#10b981", iconBg: "linear-gradient(135deg, #10b981, #059669)", shadow: "rgba(16, 185, 129, 0.25)" },
    { id: "tool-meetings", label: "غرفة الاجتماعات", icon: Users, path: "/meetings", borderColor: "#a855f7", iconBg: "linear-gradient(135deg, #a855f7, #7c3aed)", shadow: "rgba(168, 85, 247, 0.25)" },
    { id: "tool-kb", label: "قاعدة المعرفة", icon: BookOpen, path: "/knowledge-base", borderColor: "#8b5cf6", iconBg: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "rgba(139, 92, 246, 0.25)" },
    { id: "tool-market", label: "تقارير السوق", icon: BarChart3, path: "/market-reports", borderColor: "#0891b2", iconBg: "linear-gradient(135deg, #0891b2, #06b6d4)", shadow: "rgba(8, 145, 178, 0.25)" },
    { id: "tool-assign", label: "ملخص التكليفات", icon: ClipboardList, path: "/agent-assignments-summary", borderColor: "#f59e0b", iconBg: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245, 158, 11, 0.25)" },
    { id: "tool-learn", label: "التعلم الذاتي", icon: Brain, path: "/self-learning", borderColor: "#ec4899", iconBg: "linear-gradient(135deg, #ec4899, #db2777)", shadow: "rgba(236, 72, 153, 0.25)" },
  ];

  /* ── Sorted arrays based on saved order ── */
  const sortedMain = useMemo(() => {
    if (!mainOrder.length) return NAV_MAIN;
    const map = new Map(NAV_MAIN.map(item => [item.id, item]));
    const ordered = mainOrder.filter(id => map.has(id)).map(id => map.get(id)!);
    NAV_MAIN.forEach(item => { if (!mainOrder.includes(item.id)) ordered.push(item); });
    return ordered;
  }, [mainOrder]);

  const sortedTools = useMemo(() => {
    if (!toolsOrder.length) return NAV_TOOLS;
    const map = new Map(NAV_TOOLS.map(item => [item.id, item]));
    const ordered = toolsOrder.filter(id => map.has(id)).map(id => map.get(id)!);
    NAV_TOOLS.forEach(item => { if (!toolsOrder.includes(item.id)) ordered.push(item); });
    return ordered;
  }, [toolsOrder]);

  const handleMainDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedMain.findIndex(i => i.id === active.id);
    const newIndex = sortedMain.findIndex(i => i.id === over.id);
    const newArr = arrayMove(sortedMain, oldIndex, newIndex);
    const newOrder = newArr.map(i => i.id);
    setMainOrder(newOrder);
    localStorage.setItem("como_main_order", JSON.stringify(newOrder));
  }, [sortedMain]);

  const handleToolsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedTools.findIndex(i => i.id === active.id);
    const newIndex = sortedTools.findIndex(i => i.id === over.id);
    const newArr = arrayMove(sortedTools, oldIndex, newIndex);
    const newOrder = newArr.map(i => i.id);
    setToolsOrder(newOrder);
    localStorage.setItem("como_tools_order", JSON.stringify(newOrder));
  }, [sortedTools]);

  const NAV_RECORDS = [
    { label: "سجل التكليفات", path: "/agent-assignments" },
    { label: "سجل المحادثات", path: "/conversation-history" },
    { label: "سجل العقود", path: "/contracts" },
    { label: "سجل الإيميلات المرسلة", path: "/sent-emails" },
    { label: "سجل الاستشاريين", path: "/consultants-registry" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Header ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center shadow-md">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">COMO Developments</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">منصة إدارة المشاريع الذكية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <div className="w-20 h-8 rounded-md shimmer" />
            ) : isAuthenticated ? (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  مرحباً، <span className="font-medium text-foreground">{user?.name}</span>
                </span>
                <NotificationBell />
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

      <main className="max-w-7xl mx-auto px-6">

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── Hero Section (for non-authenticated) ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {!isAuthenticated && (
          <section className="relative py-20 lg:py-28 overflow-hidden">
            <div className="absolute inset-0 pattern-overlay opacity-40" />
            <div className="absolute top-10 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/8 blur-[100px]" />
            <div className="absolute bottom-10 left-1/4 w-[300px] h-[300px] rounded-full bg-stone-500/8 blur-[100px]" />

            <div className="relative max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-medium mb-6">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <Sparkles className="w-3.5 h-3.5" />
                منصة ذكية لإدارة المشاريع
              </div>

              <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-5">
                إدارة مشاريع كومو بذكاء
                <br />
                <span className="text-gold-gradient">مع فريق الوكلاء الفنيين</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
                منصة متكاملة تجمع بين الذكاء الاصطناعي وإدارة المشاريع لتقديم تجربة
                احترافية لفريق التطوير العقاري
              </p>

              <Button
                size="lg"
                onClick={() => (window.location.href = getLoginUrl())}
                className="gap-2 px-8 shadow-lg shadow-primary/20 bg-gradient-to-r from-stone-700 to-stone-900 hover:from-stone-800 hover:to-stone-950"
              >
                ابدأ الآن
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SALWA - TOP OF PAGE (Authenticated) ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {isAuthenticated && (
          <section className="pt-8 pb-6">
            <div className="relative rounded-2xl bg-gradient-to-l from-amber-50/80 via-white to-yellow-50/50 dark:from-amber-950/15 dark:via-card dark:to-yellow-950/10 border border-amber-200/40 dark:border-amber-800/20 shadow-sm overflow-hidden">
              {/* Subtle gold accent */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300" />

              <div className="flex items-center gap-5 p-5 lg:p-6">
                {/* Avatar - compact */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full overflow-hidden ring-3 ring-amber-300/50 ring-offset-2 ring-offset-background shadow-lg">
                    <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-card shadow-sm">
                    <span className="absolute inset-0 w-full h-full rounded-full bg-emerald-500 animate-ping opacity-40" />
                  </span>
                </div>

                {/* Info + Quick Actions */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <h2 className="text-xl lg:text-2xl font-extrabold text-foreground">سلوى</h2>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-300/40">
                      المنسقة الرئيسية
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    المساعدة التنفيذية الذكية — نفذي أوامر سريعة أو تحدثي معها مباشرة
                  </p>

                  {/* Quick Actions Row */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
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

                  {/* Chat button */}
                  <button
                    onClick={() => setActiveAgent("salwa" as AgentType)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-md shadow-amber-500/20 transition-all duration-200 hover:shadow-lg hover:from-amber-600 hover:to-amber-700 text-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    تحدث مع سلوى
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Quick Action Result */}
              {quickActionResult && (
                <div className="px-5 pb-5">
                  <QuickActionResult
                    title={quickActionResult.title}
                    content={quickActionResult.content}
                    onClose={() => setQuickActionResult(null)}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── MAIN NAVIGATION - Big Cards (Authenticated) ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {isAuthenticated && (
          <section className="pb-8">
            {/* Section Title */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-foreground">الأقسام الرئيسية</h2>
            </div>

            {/* 5 Main Cards - Draggable */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMainDragEnd}>
              <SortableContext items={sortedMain.map(i => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                  {sortedMain.map((item) => (
                    <SortableMainCard key={item.id} item={item} onNavigate={navigate} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── TOOLS & REPORTS - White cards with colored top border ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {isAuthenticated && (
          <section className="pb-8">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-foreground">الأدوات والتقارير</h2>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleToolsDragEnd}>
              <SortableContext items={sortedTools.map(i => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {sortedTools.map((item) => (
                    <SortableToolCard key={item.id} item={item} onNavigate={navigate} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Records dropdown row */}
            <div className="mt-4">
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === "records" ? null : "records")}
                  className="group relative bg-card hover:bg-card/90 rounded-xl border border-border/50 p-4 text-right transition-all duration-200 hover:shadow-lg overflow-hidden w-full"
                >
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl bg-gradient-to-r from-sky-500 to-blue-600" />
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-sky-500 to-blue-600" style={{ boxShadow: "0 4px 14px rgba(14, 165, 233, 0.25)" }}>
                      <ClipboardList className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-foreground flex-1">السجلات والأرشيف</span>
                    <ChevronLeft className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openDropdown === "records" ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {openDropdown === "records" && (
                  <div className="mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    {NAV_RECORDS.map((item, j) => (
                      <button
                        key={j}
                        onClick={() => { navigate(item.path); setOpenDropdown(null); }}
                        className="w-full text-right px-5 py-3 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground border-b border-border/30 last:border-b-0 flex items-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── CAPABILITIES (for all users) ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="py-10 border-t border-border/30">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 shadow-md shadow-orange-500/20 mb-3">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">قدرات المنصة</h2>
            <p className="text-sm text-muted-foreground">أدوات متقدمة لإدارة كل جانب من جوانب مشاريعك</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: BrainCircuit,
                title: "وكلاء ذكيون",
                desc: "فريق من الوكلاء المتخصصين يعملون على مدار الساعة",
                borderColor: "#6366f1",
                iconBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                shadow: "rgba(99, 102, 241, 0.3)",
              },
              {
                icon: Shield,
                title: "تدقيق العقود",
                desc: "مراجعة قانونية ذكية للعقود واكتشاف المخاطر",
                borderColor: "#06b6d4",
                iconBg: "linear-gradient(135deg, #06b6d4, #0891b2)",
                shadow: "rgba(6, 182, 212, 0.3)",
              },
              {
                icon: TrendingUp,
                title: "تحليل مالي",
                desc: "تحليل الميزانيات والمستخلصات المالية بدقة",
                borderColor: "#10b981",
                iconBg: "linear-gradient(135deg, #10b981, #059669)",
                shadow: "rgba(16, 185, 129, 0.3)",
              },
              {
                icon: Layers,
                title: "أرشفة ذكية",
                desc: "تنظيم وأرشفة الملفات تلقائياً بتسمية احترافية",
                borderColor: "#f59e0b",
                iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
                shadow: "rgba(245, 158, 11, 0.3)",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="relative bg-card rounded-xl border border-border/50 p-5 overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
                  style={{ backgroundColor: feature.borderColor }}
                />
                <div className="flex items-center gap-3.5 flex-row-reverse">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: feature.iconBg,
                      boxShadow: `0 4px 14px ${feature.shadow}`,
                    }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="font-bold text-foreground mb-1 text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── Agent Team Section ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {isAuthenticated && teamAgents.length > 0 && (
          <section className="py-10 border-t border-border/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">فريق الوكلاء</h2>
                  <p className="text-[10px] text-muted-foreground">{teamAgents.length} وكيل متخصص تحت إشراف سلوى</p>
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

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
              {teamAgents.map((agent: any, i: number) => {
                const IconComp = AGENT_ICONS[agent.icon || "bot"] || Bot;
                const agentColor = agent.color || '#6366f1';
                return (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgent((agent.nameEn || agent.name).toLowerCase() as AgentType)}
                    className="group relative bg-card rounded-xl border border-border/50 p-4 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
                  >
                    {/* Top accent */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: agentColor }} />

                    {/* Avatar */}
                    {agent.avatarUrl && (
                      <div className="mx-auto mb-3 relative">
                        <div className="w-16 h-16 rounded-full overflow-hidden ring-3 ring-offset-2 ring-offset-background shadow-md mx-auto transition-transform duration-200 group-hover:scale-105" style={{ borderColor: agentColor }}>
                          <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background shadow-sm" />
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
                          boxShadow: `0 4px 12px ${agentColor}30`,
                        }}
                      >
                        <IconComp className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="min-w-0 text-right">
                        <h4 className="font-bold text-foreground text-xs">{agent.name}</h4>
                        <p className="text-[10px] text-muted-foreground truncate">{agent.nameEn}</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-2 line-clamp-2">{agent.role}</p>

                    <div className="flex items-center gap-1.5 justify-center mb-2">
                      <div className="relative">
                        <div className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-emerald-500" : agent.status === "maintenance" ? "bg-amber-500" : "bg-gray-400"}`} />
                        {agent.status === "active" && <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-50" />}
                      </div>
                      <span className={`text-[10px] font-medium ${agent.status === "active" ? "text-emerald-600" : agent.status === "maintenance" ? "text-amber-600" : "text-gray-400"}`}>
                        {agent.status === "active" ? "نشط" : agent.status === "maintenance" ? "صيانة" : "غير نشط"}
                      </span>
                    </div>

                    <div className="w-full gap-1.5 text-[10px] flex items-center justify-center rounded-lg border border-input bg-transparent px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                      <Send className="w-3 h-3" />
                      تحدث مع {agent.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-5 mt-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            COMO Developments &copy; {new Date().getFullYear()}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <span className="inline-flex w-3.5 h-3.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 items-center justify-center">
              <Sparkles className="w-2 h-2 text-white" />
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
