import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText,
  ClipboardList,
  BookOpen,
  Star,
  Megaphone,
  Bell,
  Send,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageCircle,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  User,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── Token Management ───
function getStoredToken(): string | null {
  return localStorage.getItem("cc_token");
}
function setStoredToken(token: string) {
  localStorage.setItem("cc_token", token);
}
function clearStoredToken() {
  localStorage.removeItem("cc_token");
}

// ─── Evaluation Criteria (same as platform) ───
const CRITERIA = [
  { id: 0, name: "الهوية المعمارية وجودة التصميم", weight: 14.6, options: [
    { score: 95, label: "طرح معماري مرجعي ذو هوية واضحة ومتماسكة بالكامل" },
    { score: 93, label: "هوية قوية جداً — فكرة واضحة ومترابطة" },
    { score: 90, label: "هوية واضحة ومنظمة — تصميم متماسك" },
    { score: 85, label: "تصميم جيد بفكرة مفهومة مع بعض التحفظات" },
    { score: 80, label: "تصميم مقبول يفي بالأساسيات دون تميز" },
    { score: 68, label: "طرح تقليدي أو غير مكتمل" },
    { score: 50, label: "غياب واضح للهوية أو طرح غير مقنع" },
  ]},
  { id: 1, name: "القدرات التقنية والتكامل مع BIM", weight: 14.6, options: [
    { score: 95, label: "BIM متكامل لكافة التخصصات — LOD 350+" },
    { score: 91, label: "BIM متقدم — LOD 300–350" },
    { score: 84, label: "BIM جيد — LOD 300 مع تنسيق أساسي" },
    { score: 72, label: "استخدام BIM جزئي أو غير مكتمل" },
    { score: 45, label: "نمذجة شكلية دون تكامل فعلي" },
  ]},
  { id: 3, name: "كفاءة التخطيط وتحسين المساحات", weight: 13.6, options: [
    { score: 95, label: "تخطيط استثنائي يعظم العائد" },
    { score: 92, label: "تخطيط ممتاز جداً بعائد قوي" },
    { score: 87, label: "تخطيط قوي ومنطقي" },
    { score: 82, label: "تخطيط جيد مع بعض التحسينات الممكنة" },
    { score: 76, label: "تخطيط مقبول وظيفياً" },
    { score: 58, label: "تخطيط ضعيف أو هدر ملحوظ" },
  ]},
  { id: 4, name: "التحكم في التكاليف والوعي بالميزانية", weight: 10.7, options: [
    { score: 95, label: "قرارات تصميم تحقق أعلى جودة بأقل تكلفة" },
    { score: 91, label: "وعي قوي جداً بالتكلفة مع بدائل واضحة" },
    { score: 85, label: "التزام جيد بالميزانية" },
    { score: 74, label: "التزام عام دون تحسينات قوية" },
    { score: 52, label: "قرارات قد ترفع التكلفة" },
  ]},
  { id: 5, name: "الخبرة في مشاريع مشابهة", weight: 9.7, options: [
    { score: 95, label: "عدة مشاريع مماثلة بالحجم والتعقيد" },
    { score: 89, label: "مشروعان قريبان جداً" },
    { score: 82, label: "مشروع واحد مماثل بالحجم" },
    { score: 74, label: "خبرة في مشاريع أقل حجماً" },
    { score: 58, label: "خبرة عامة غير مماثلة" },
  ]},
  { id: 6, name: "قوة فريق المشروع", weight: 9.7, options: [
    { score: 95, label: "فريق خبير متكامل بقيادة مباشرة" },
    { score: 92, label: "فريق قوي جداً متعدد التخصصات" },
    { score: 86, label: "فريق مكتمل وجيد" },
    { score: 80, label: "فريق متوسط جيد" },
    { score: 74, label: "فريق مقبول بخبرة محدودة" },
  ]},
  { id: 7, name: "إدارة الوقت والانضباط بالبرنامج", weight: 9.7, options: [
    { score: 95, label: "سجل ممتاز في الالتزام بالجداول الزمنية" },
    { score: 91, label: "سجل قوي مع تأخيرات طفيفة" },
    { score: 85, label: "التزام جيد إجمالاً" },
    { score: 74, label: "تأخيرات محدودة" },
    { score: 55, label: "تأخيرات متكررة" },
  ]},
  { id: 8, name: "الاهتمام بالمشروع", weight: 9.2, options: [
    { score: 95, label: "أولوية قصوى — مشاركة الإدارة العليا" },
    { score: 90, label: "اهتمام خاص واضح وتفاعل سريع" },
    { score: 82, label: "اهتمام عادي مقبول" },
    { score: 70, label: "تفاعل محدود أو بطيء" },
  ]},
  { id: 9, name: "مرونة التعاقد", weight: 8.2, options: [
    { score: 95, label: "مرونة عالية جداً واستعداد لتعديل الشروط" },
    { score: 90, label: "مرونة جيدة" },
    { score: 82, label: "موقف تعاقدي قياسي" },
    { score: 72, label: "تشدد نسبي في بعض البنود" },
    { score: 60, label: "جمود واضح وصعوبة تفاوض" },
  ]},
];

// ─── Bubble Config ───
const BUBBLES = [
  { type: "reports" as const, label: "التقارير", icon: FileText, color: "from-blue-600 to-blue-800", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { type: "requests" as const, label: "الطلبات", icon: ClipboardList, color: "from-amber-600 to-amber-800", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  { type: "meeting_minutes" as const, label: "محاضر الاجتماعات", icon: BookOpen, color: "from-emerald-600 to-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { type: "evaluations" as const, label: "تقييم الاستشاريين", icon: Star, color: "from-purple-600 to-purple-800", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  { type: "announcements" as const, label: "الإعلانات", icon: Megaphone, color: "from-rose-600 to-rose-800", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
];

const BUBBLE_LABELS: Record<string, string> = {
  reports: "التقارير",
  requests: "الطلبات",
  meeting_minutes: "محاضر الاجتماعات",
  evaluations: "تقييم الاستشاريين",
  announcements: "الإعلانات",
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgent: { label: "عاجل", color: "bg-red-100 text-red-700 border-red-200" },
  important: { label: "مهم", color: "bg-amber-100 text-amber-700 border-amber-200" },
  normal: { label: "عادي", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

// ═══════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    onLogin(token.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 mb-4">
            <span className="text-3xl font-bold text-white">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">مركز القيادة</h1>
          <p className="text-slate-400 text-sm mt-1">COMO Developments — Command Center</p>
        </div>

        {/* Login Card */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10 p-8 rounded-2xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">رمز الدخول</label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="أدخل رمز الدخول الخاص بك"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 text-base rounded-xl focus:border-amber-400/50 focus:ring-amber-400/20"
                dir="ltr"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "دخول"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          الوصول مقتصر على الأعضاء المصرح لهم فقط
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SALWA CHAT PANEL
// ═══════════════════════════════════════════════════════
function SalwaChat({ token, memberName, isOpen, onClose }: { token: string; memberName: string; isOpen: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatHistory = trpc.commandCenter.getChatHistory.useQuery({ token }, { enabled: isOpen });
  const chatMutation = trpc.commandCenter.chatWithSalwa.useMutation();
  const clearMutation = trpc.commandCenter.clearChatHistory.useMutation();
  const utils = trpc.useUtils();

  const messages = chatHistory.data || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;
    const msg = message.trim();
    setMessage("");
    setIsLoading(true);

    try {
      await chatMutation.mutateAsync({ token, message: msg });
      utils.commandCenter.getChatHistory.invalidate({ token });
    } catch (err: any) {
      toast.error("خطأ في الاتصال بسلوى");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    await clearMutation.mutateAsync({ token });
    utils.commandCenter.getChatHistory.invalidate({ token });
    toast.success("تم مسح المحادثة");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg h-[85vh] sm:h-[70vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-l from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/sFWezOzuQFJxzpKl.png"
                alt="سلوى"
                className="w-10 h-10 rounded-full object-cover"
              />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">سلوى</h3>
              <p className="text-xs text-slate-500">السكرتيرة التنفيذية الذكية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-400 hover:text-red-500 h-8 w-8 p-0">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-amber-600" />
              </div>
              <p className="text-slate-600 font-medium mb-1">مرحباً {memberName}</p>
              <p className="text-slate-400 text-sm">كيف يمكنني مساعدتك اليوم؟</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex ${msg.role === "member" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "member"
                  ? "bg-slate-100 text-slate-800 rounded-br-md"
                  : "bg-gradient-to-l from-amber-500 to-amber-600 text-white rounded-bl-md shadow-md"
              }`}>
                {msg.role === "salwa" ? (
                  <Streamdown>{msg.content}</Streamdown>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white rounded-2xl rounded-bl-md px-4 py-3 shadow-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-white/70">سلوى تفكر...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-white p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك لسلوى..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-xl border-slate-200 text-sm focus:border-amber-400 focus:ring-amber-400/20"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isLoading}
              className="h-11 w-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md p-0 flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BUBBLE DETAIL VIEW
// ═══════════════════════════════════════════════════════
function BubbleDetail({ token, bubbleType, onBack, memberRole }: { token: string; bubbleType: string; onBack: () => void; memberRole: string }) {
  const bubble = BUBBLES.find(b => b.type === bubbleType);
  const items = trpc.commandCenter.getItems.useQuery({ token, bubbleType: bubbleType as any, status: "active" });

  if (!bubble) return null;

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700 -mr-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bubble.color} flex items-center justify-center shadow-md`}>
          <bubble.icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{bubble.label}</h2>
          <p className="text-xs text-slate-500">{items.data?.length || 0} عنصر</p>
        </div>
      </div>

      {/* Items */}
      {items.isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 rounded-xl shimmer" />
          ))}
        </div>
      ) : items.data?.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl ${bubble.bg} flex items-center justify-center mx-auto mb-4`}>
            <bubble.icon className={`w-7 h-7 ${bubble.text}`} />
          </div>
          <p className="text-slate-500 font-medium">لا توجد عناصر حالياً</p>
          <p className="text-slate-400 text-sm mt-1">ستظهر العناصر هنا عندما تضيفها سلوى</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.data?.map((item) => (
            <ItemCard key={item.id} item={item} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, token }: { item: any; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS.normal;
  const responses = trpc.commandCenter.getResponses.useQuery(
    { token, itemId: item.id },
    { enabled: expanded }
  );

  return (
    <Card className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priority.color}`}>
              {priority.label}
            </Badge>
            {item.requiresResponse === 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                يحتاج رد
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 text-sm leading-relaxed">{item.title}</h3>
          {item.summary && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.summary}</p>
          )}
        </div>
        <div className="text-xs text-slate-400 flex-shrink-0">
          {new Date(item.createdAt).toLocaleDateString("ar-AE", { month: "short", day: "numeric" })}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          {item.content && (
            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">
              <Streamdown>{item.content}</Streamdown>
            </div>
          )}
          {responses.data && responses.data.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">الردود:</p>
              {responses.data.map((r: any) => (
                <div key={r.id} className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-blue-700 text-xs">{r.memberId}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{r.responseType}</Badge>
                  </div>
                  <p className="text-slate-700">{r.responseText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// EVALUATION VIEW
// ═══════════════════════════════════════════════════════
function EvaluationView({ token, memberRole, memberId }: { token: string; memberRole: string; memberId: string }) {
  const sessions = trpc.commandCenter.getEvaluationSessions.useQuery({ token });
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  if (selectedSession) {
    return (
      <EvaluationForm
        token={token}
        sessionId={selectedSession}
        memberId={memberId}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <h3 className="font-bold text-slate-800">جلسات التقييم</h3>
      
      {sessions.isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 rounded-xl shimmer" />)}
        </div>
      ) : sessions.data?.length === 0 ? (
        <div className="text-center py-12">
          <Star className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">لا توجد جلسات تقييم حالياً</p>
        </div>
      ) : (
        sessions.data?.map((session: any) => (
          <Card
            key={session.id}
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 transition-all cursor-pointer hover:shadow-md"
            onClick={() => setSelectedSession(session.sessionId)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">{session.title}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {session.completedCount}/{session.requiredCount} أكملوا التقييم
                </p>
              </div>
              <div className="flex items-center gap-2">
                {session.myEvaluationComplete ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 ml-1" />
                    مكتمل
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                    <Clock className="w-3 h-3 ml-1" />
                    بانتظار تقييمك
                  </Badge>
                )}
                {session.canViewResults && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                    <Eye className="w-3 h-3 ml-1" />
                    النتائج متاحة
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function EvaluationForm({ token, sessionId, memberId, onBack }: { token: string; sessionId: string; memberId: string; onBack: () => void }) {
  const results = trpc.commandCenter.getEvaluationResults.useQuery({ token, sessionId });
  const submitMutation = trpc.commandCenter.submitEvaluation.useMutation();
  const utils = trpc.useUtils();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const session = results.data?.session;
  const myEval = results.data?.myEvaluation;
  const isRevealed = results.data?.isRevealed;
  const allEvals = results.data?.allEvaluations;

  // Calculate total
  const totalScore = useMemo(() => {
    let total = 0;
    CRITERIA.forEach(c => {
      const s = scores[String(c.id)];
      if (s !== undefined) {
        total += (s * c.weight) / 100;
      }
    });
    return Math.round(total * 100) / 100;
  }, [scores]);

  const handleSubmit = async () => {
    const unanswered = CRITERIA.filter(c => scores[String(c.id)] === undefined);
    if (unanswered.length > 0) {
      toast.error(`يرجى تقييم جميع المعايير (${unanswered.length} متبقي)`);
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        token,
        sessionId,
        scores,
        totalScore,
        notes: notes || undefined,
      });
      toast.success("تم حفظ التقييم بنجاح");
      if (result.isRevealed) {
        toast.success("جميع الأعضاء أكملوا التقييم — النتائج متاحة الآن");
      }
      utils.commandCenter.getEvaluationSessions.invalidate({ token });
      utils.commandCenter.getEvaluationResults.invalidate({ token, sessionId });
    } catch (err: any) {
      toast.error(err.message || "خطأ في حفظ التقييم");
    }
  };

  if (results.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  // If already completed and not revealed
  if (myEval?.isComplete === 1 && !isRevealed) {
    return (
      <div className="space-y-6 fade-in" dir="rtl">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> رجوع
        </Button>
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="font-bold text-slate-800 text-lg mb-2">تم حفظ تقييمك</h3>
          <p className="text-slate-500">
            بانتظار اكتمال تقييمات باقي الأعضاء ({results.data?.completedCount}/3)
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <EyeOff className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">النتائج مخفية حتى يكمل الجميع</span>
          </div>
        </div>
      </div>
    );
  }

  // If revealed - show all results
  if (isRevealed && allEvals) {
    return (
      <div className="space-y-6 fade-in" dir="rtl">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> رجوع
        </Button>
        <div className="text-center mb-6">
          <Eye className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-lg">نتائج التقييم المكشوفة</h3>
          <p className="text-slate-500 text-sm">{session?.title}</p>
        </div>

        {/* Summary table */}
        <Card className="p-4 rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2 px-3 text-slate-500 font-medium">المعيار</th>
                {allEvals.map((e: any) => (
                  <th key={e.memberId} className="text-center py-2 px-3 text-slate-500 font-medium">{e.memberName}</th>
                ))}
                <th className="text-center py-2 px-3 text-purple-600 font-bold">المتوسط</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map(c => {
                const memberScores = allEvals.map((e: any) => e.scores[String(c.id)] || 0);
                const avg = memberScores.reduce((a: number, b: number) => a + b, 0) / memberScores.length;
                return (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2 px-3 text-slate-700 text-xs">{c.name}</td>
                    {memberScores.map((s: number, i: number) => (
                      <td key={i} className="text-center py-2 px-3 font-medium">{s}</td>
                    ))}
                    <td className="text-center py-2 px-3 font-bold text-purple-700">{avg.toFixed(0)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold">
                <td className="py-3 px-3 text-slate-800">المجموع المرجح</td>
                {allEvals.map((e: any) => (
                  <td key={e.memberId} className="text-center py-3 px-3 text-slate-800">
                    {Number(e.totalScore).toFixed(1)}%
                  </td>
                ))}
                <td className="text-center py-3 px-3 text-purple-700">
                  {(allEvals.reduce((a: number, e: any) => a + Number(e.totalScore), 0) / allEvals.length).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // Evaluation form
  return (
    <div className="space-y-6 fade-in" dir="rtl">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
        <ArrowLeft className="w-4 h-4 ml-1" /> رجوع
      </Button>
      
      <div>
        <h3 className="font-bold text-slate-800 text-lg">{session?.title}</h3>
        <p className="text-sm text-slate-500 mt-1">قيّم كل معيار بشكل مستقل — النتائج مخفية حتى يكمل الجميع</p>
      </div>

      <div className="space-y-4">
        {CRITERIA.map(criterion => (
          <Card key={criterion.id} className="p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800 text-sm">{criterion.name}</h4>
              <span className="text-xs text-slate-400">الوزن: {criterion.weight}%</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {criterion.options.map(opt => (
                <button
                  key={opt.score}
                  onClick={() => setScores(prev => ({ ...prev, [String(criterion.id)]: opt.score }))}
                  className={`text-right px-3 py-2 rounded-lg text-xs transition-all border ${
                    scores[String(criterion.id)] === opt.score
                      ? "bg-purple-50 border-purple-300 text-purple-800 font-medium shadow-sm"
                      : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  <span className="font-bold ml-2">{opt.score}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">ملاحظات (اختياري)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أضف ملاحظاتك هنا..."
          className="rounded-xl border-slate-200 text-sm"
          rows={3}
        />
      </div>

      {/* Total & Submit */}
      <div className="sticky bottom-0 bg-white border-t pt-4 pb-2 flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-500">المجموع المرجح:</span>
          <span className="text-xl font-bold text-purple-700 mr-2">{totalScore.toFixed(1)}%</span>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl px-6 shadow-md"
        >
          {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التقييم"}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════
function Dashboard({ token, member, onLogout }: { token: string; member: any; onLogout: () => void }) {
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const [showSalwa, setShowSalwa] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const counts = trpc.commandCenter.getBubbleCounts.useQuery({ token });
  const notifications = trpc.commandCenter.getNotifications.useQuery({ token });
  const markAllRead = trpc.commandCenter.markAllNotificationsRead.useMutation();
  const utils = trpc.useUtils();

  const unreadCount = notifications.data?.filter((n: any) => !n.isRead).length || 0;

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync({ token });
    utils.commandCenter.getNotifications.invalidate({ token });
  };

  // If viewing a specific bubble
  if (activeBubble === "evaluations" && showEvaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <EvaluationView
            token={token}
            memberRole={member.role}
            memberId={member.memberId}
          />
          <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowEvaluation(false); }} className="mt-4 text-slate-500">
            <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
          </Button>
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  if (activeBubble) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <BubbleDetail
            token={token}
            bubbleType={activeBubble}
            onBack={() => setActiveBubble(null)}
            memberRole={member.role}
          />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
      <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">{member.greeting}</h1>
          <p className="text-slate-500 text-sm">
            {new Date().toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Smart Bubbles Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {BUBBLES.map(bubble => {
            const count = counts.data?.[bubble.type as keyof typeof counts.data] || 0;
            return (
              <button
                key={bubble.type}
                onClick={() => {
                  if (bubble.type === "evaluations") {
                    setActiveBubble("evaluations");
                    setShowEvaluation(true);
                  } else {
                    setActiveBubble(bubble.type);
                  }
                }}
                className="group relative bg-white rounded-2xl border border-slate-200 p-5 text-center transition-all duration-300 hover:shadow-lg hover:border-slate-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${bubble.color} flex items-center justify-center mx-auto mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                  <bubble.icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-semibold text-slate-700 text-sm mb-1">{bubble.label}</p>
                <p className="text-xs text-slate-400">
                  {counts.isLoading ? "..." : `${count} عنصر`}
                </p>
                {typeof count === "number" && count > 0 && (
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent Notifications */}
        {notifications.data && notifications.data.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                آخر الإشعارات
              </h2>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs text-slate-500">
                  تعليم الكل كمقروء
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {notifications.data.slice(0, 5).map((n: any) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    n.isRead ? "bg-white border-slate-100" : "bg-amber-50/50 border-amber-200/50"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? "bg-slate-300" : "bg-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{n.title}</p>
                    {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.message}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {new Date(n.createdAt).toLocaleDateString("ar-AE", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Salwa Button */}
      <button
        onClick={() => setShowSalwa(true)}
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center hover:scale-110 transition-all z-40 group"
      >
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/sFWezOzuQFJxzpKl.png"
          alt="سلوى"
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
      </button>

      <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
    </div>
  );
}

function DashboardHeader({ member, onLogout, unreadCount, onNotifications, onSalwa }: {
  member: any; onLogout: () => void; unreadCount: number; onNotifications: () => void; onSalwa: () => void;
}) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm">مركز القيادة</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button onClick={onNotifications} className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="w-4.5 h-4.5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Member name */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">{member.nameAr}</span>
          </div>

          {/* Logout */}
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════
export default function CommandCenterPage() {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [member, setMember] = useState<any>(null);
  const [authError, setAuthError] = useState("");
  const { user } = useAuth();

  // Check URL for token parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
      setStoredToken(urlToken);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Verify token
  const verification = trpc.commandCenter.verifyAccess.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      retry: false,
    }
  );

  useEffect(() => {
    if (verification.data) {
      setMember(verification.data);
      setAuthError("");
    }
  }, [verification.data]);

  useEffect(() => {
    if (verification.error) {
      setAuthError("رمز الدخول غير صالح");
      clearStoredToken();
      setToken(null);
      setMember(null);
    }
  }, [verification.error]);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    setStoredToken(newToken);
    setAuthError("");
  };

  const handleLogout = () => {
    clearStoredToken();
    setToken(null);
    setMember(null);
  };

  // Also allow admin access via platform login
  useEffect(() => {
    if (user && user.role === "admin" && !token) {
      // Admin can access without token - we'll handle this in the backend
    }
  }, [user, token]);

  // Loading state
  if (token && verification.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!token || !member) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Authenticated - show dashboard
  return <Dashboard token={token} member={member} onLogout={handleLogout} />;
}
