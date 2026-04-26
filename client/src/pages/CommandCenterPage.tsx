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
  CreditCard,
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
  ArrowRight,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Plus,
  Pencil,
  Flag,
  Activity,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  MessageSquare,
  DollarSign,
  Award,
  Gavel,
  Building,
  Scale,
  Trophy,
  Lock,
  Unlock,
  Brain,
  Sparkles,
  SlidersHorizontal,
  ShieldCheck,
  BookText,
  Paperclip,
  LinkIcon,
  Upload,
  ExternalLink,
  FileUp,
  HelpCircle,
  Layers,
  Wallet,
  FileBarChart2,
  PieChart,
  BarChart2,
  Briefcase,
  FolderOpen,
  CalendarDays,
  ClipboardCheck,
  Users,
  LineChart,
  Building2,
  FileSearch,
  BellRing,
  Landmark,
  LayoutDashboard,
  Gauge,
  Map,
  Handshake,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Streamdown } from "streamdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Lazy imports for embedded pages
import WorkSchedulePage from "./WorkSchedulePage";
import CapitalPortfolioPage from "./CapitalPortfolioPage";
import PaymentRequestsPage from "./PaymentRequests";
import GeneralRequestsPage from "./GeneralRequests";
import InternalMessagesPage from "./InternalMessages";
// Old financial components removed - now using iframe embeds

// --- Financial Reports View (read-only, embedded in Command Center) ---
const CC_REPORTS_TABS = [
  { id: "feasibility", label: "ملخص الجدوى المالية", src: "/feasibility-summary.html" },
  { id: "capital", label: "خطة رأس مال المشروع", src: "/capital-plan.html" },
  { id: "escrow", label: "التدفقات النقدية وحساب الضمان", src: "/escrow-cashflow.html" },
] as const;
type CCFinancialTab = (typeof CC_REPORTS_TABS)[number]["id"];

function FinancialReportsView({ onBack, projectsList }: { onBack: () => void; projectsList: any[] }) {
  const [activeTab, setActiveTab] = useState<CCFinancialTab>("feasibility");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const tabSrc = CC_REPORTS_TABS.find((t) => t.id === activeTab)?.src;
  const currentSrc = tabSrc && selectedProjectId ? `${tabSrc}?projectId=${selectedProjectId}` : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 shrink-0">
            <ArrowLeft className="w-4 h-4" /> العودة
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm font-bold text-foreground">تقارير التخطيط المالي</h1>
          <div className="mr-auto">
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              className="text-xs h-8 px-2 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="">اختر المشروع...</option>
              {projectsList?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {CC_REPORTS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      {currentSrc ? (
        <iframe
          key={currentSrc}
          src={currentSrc}
          className="flex-1 w-full border-0"
          style={{ minHeight: "calc(100vh - 7rem)" }}
          title="تقارير التخطيط المالي"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm font-medium">اختر مشروعاً من القائمة أعلاه أولاً</p>
          </div>
        </div>
      )}
    </div>
  );
}

const SALWA_AVATAR_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663200809965/Q366eAYG4Q7iaM8VuAmmFX/salwa-enhanced_0251b1a8.png";

// --- Voice Recording Hook ---
function getSupportedMimeType(): string {
  // Safari/iOS prefers mp4, Chrome/Firefox prefer webm
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "", // fallback: let browser decide
  ];
  for (const t of types) {
    if (t === "") return "";
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* skip */ }
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to convert audio to base64"));
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      console.log("[Voice] Starting recording, mimeType:", mimeType || "browser-default");
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onerror = (e) => {
        console.error("[Voice] MediaRecorder error:", e);
      };
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      console.log("[Voice] Recording started successfully");
    } catch (err: any) {
      console.error("[Voice] Failed to start recording:", err);
      throw new Error(err.message || "لم يتم السماح بالوصول للميكروفون");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        console.error("[Voice] No active recording to stop");
        reject(new Error("No active recording")); return;
      }
      mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        const actualMime = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        console.log("[Voice] Recording stopped, blob size:", blob.size, "type:", actualMime, "chunks:", chunksRef.current.length);
        if (blob.size < 100) {
          reject(new Error("التسجيل قصير جداً، حاول مرة أخرى")); return;
        }
        resolve(blob);
      };
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { isRecording, recordingTime, isTranscribing, setIsTranscribing, startRecording, stopRecording, cancelRecording };
}

// --- Token Management ---
function getStoredToken(): string | null {
  return localStorage.getItem("cc_token");
}
function setStoredToken(token: string) {
  localStorage.setItem("cc_token", token);
}
function clearStoredToken() {
  localStorage.removeItem("cc_token");
}

// --- Evaluation Criteria (same as platform) ---
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

// --- Bubble Config ---
const BUBBLES = [
  // ── PRIORITY 1: Financial Core (Hero cards) ──
  { type: "capital_portfolio" as const, label: "محفظة رأس المال", icon: Wallet, color: "from-indigo-600 to-indigo-800", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
  { type: "financial_reports" as const, label: "التقارير المالية", icon: BarChart2, color: "from-emerald-500 to-teal-700", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { type: "payment_requests" as const, label: "طلبات الصرف", icon: CreditCard, color: "from-amber-500 to-orange-700", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },

  // ── PRIORITY 2: Operations & Evaluation ──
  { type: "evaluations" as const, label: "تقييم الاستشاريين", icon: Star, color: "from-violet-600 to-purple-800", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  { type: "milestones_kpis" as const, label: "المراحل والأداء", icon: Target, color: "from-cyan-500 to-sky-700", bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },

  // ── PRIORITY 3: Communication & Requests ──
  { type: "requests" as const, label: "الاعتمادات الرسمية", icon: Send, color: "from-orange-500 to-amber-700", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  { type: "reports" as const, label: "التقارير", icon: FileBarChart2, color: "from-blue-500 to-blue-700", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { type: "meeting_minutes" as const, label: "محاضر الاجتماعات", icon: BookText, color: "from-rose-500 to-pink-700", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },

  // ── PRIORITY 4: Planning & Studies ──
  { type: "work_schedule" as const, label: "برنامج العمل", icon: CalendarDays, color: "from-teal-500 to-teal-700", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
  { type: "feasibility_study" as const, label: "دراسة الجدوى", icon: TrendingUp, color: "from-fuchsia-500 to-violet-700", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  { type: "announcements" as const, label: "الإعلانات", icon: Megaphone, color: "from-red-500 to-rose-700", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  // ── PRIORITY 5: Internal Communication ──
  { type: "internal_messages" as const, label: "التواصل الداخلي", icon: MessageSquare, color: "from-indigo-500 to-violet-700", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
];

const BUBBLE_LABELS: Record<string, string> = {
  reports: "التقارير",
  requests: "الاعتمادات الرسمية",
  meeting_minutes: "محاضر الاجتماعات",
  evaluations: "تقييم الاستشاريين",
  milestones_kpis: "المراحل والأداء",
  announcements: "الإعلانات",
};

// --- Milestone/KPI Helpers ---
const MILESTONE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "لم تبدأ", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
  in_progress: { label: "جارية", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Activity },
  delayed: { label: "متأخرة", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  completed: { label: "مكتملة", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  on_hold: { label: "معلقة", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  cancelled: { label: "ملغاة", color: "bg-gray-100 text-gray-500 border-gray-200", icon: X },
};

const KPI_STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  on_track: { label: "على المسار", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dotColor: "bg-emerald-500" },
  at_risk: { label: "في خطر", color: "bg-amber-100 text-amber-700 border-amber-200", dotColor: "bg-amber-500" },
  off_track: { label: "خارج المسار", color: "bg-red-100 text-red-700 border-red-200", dotColor: "bg-red-500" },
  achieved: { label: "تم تحقيقه", color: "bg-blue-100 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
  not_started: { label: "لم يبدأ", color: "bg-slate-100 text-slate-600 border-slate-200", dotColor: "bg-slate-400" },
};

const MILESTONE_CATEGORY_LABELS: Record<string, string> = {
  planning: "التخطيط",
  design: "التصميم",
  permits: "التراخيص",
  construction: "البناء",
  handover: "التسليم",
  sales: "المبيعات",
  other: "أخرى",
};

const KPI_CATEGORY_LABELS: Record<string, string> = {
  financial: "مالي",
  timeline: "زمني",
  quality: "جودة",
  safety: "سلامة",
  sales: "مبيعات",
  customer: "رضا العملاء",
  operational: "تشغيلي",
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
// SALWA CHAT PANEL (with Voice)
// ═══════════════════════════════════════════════════════
function SalwaChat({ token, memberName, isOpen, onClose }: { token: string; memberName: string; isOpen: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { isRecording, recordingTime, isTranscribing, setIsTranscribing, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatHistory = trpc.commandCenter.getChatHistory.useQuery({ token }, { enabled: isOpen });
  const chatMutation = trpc.commandCenter.chatWithSalwa.useMutation();
  const clearMutation = trpc.commandCenter.clearChatHistory.useMutation();
  const transcribeMutation = trpc.commandCenter.transcribeVoice.useMutation();
  const ttsMutation = trpc.commandCenter.textToSpeech.useMutation();
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

  // Stop audio on close
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const msg = (text || message).trim();
    if (!msg || isLoading) return;
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
    if (audioRef.current) { audioRef.current.pause(); setIsSpeaking(false); }
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

  // Voice: Process recorded audio blob
  const processVoiceBlob = async (blob: Blob) => {
    try {
      console.log("[Voice] Got blob:", blob.size, "bytes, type:", blob.type);
      setIsTranscribing(true);
      toast.info("جاري تحويل الصوت إلى نص...");
      
      // Convert blob to base64
      const base64 = await blobToBase64(blob);
      console.log("[Voice] Base64 length:", base64.length);
      
      const mimeType = blob.type || "audio/webm";
      console.log("[Voice] Sending to transcription, mimeType:", mimeType);
      
      const result = await transcribeMutation.mutateAsync({
        token,
        audioBase64: base64,
        mimeType,
        language: "ar",
      });
      
      console.log("[Voice] Transcription result:", result);
      setIsTranscribing(false);
      
      if (result.text && result.text.trim()) {
        toast.success(`تم التعرف: "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`);
        // Set the message in the input so user can see it
        setMessage(result.text);
        // Auto-send after brief delay
        setTimeout(() => {
          handleSend(result.text);
        }, 300);
      } else {
        setMicError("لم يتم التعرف على كلام، حاول مرة أخرى");
        toast.error("لم يتم التعرف على كلام");
        setTimeout(() => setMicError(null), 4000);
      }
    } catch (err: any) {
      console.error("[Voice] Error in voice flow:", err);
      setIsTranscribing(false);
      const errMsg = err.message || "فشل التحويل الصوتي";
      setMicError(errMsg);
      toast.error(errMsg);
      setTimeout(() => setMicError(null), 4000);
    }
  };

  // Voice: Mic click handler
  const handleMicClick = async () => {
    setMicError(null);
    if (isRecording) {
      // Clear auto-stop timer
      if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
      try {
        console.log("[Voice] Stopping recording...");
        const blob = await stopRecording();
        await processVoiceBlob(blob);
      } catch (err: any) {
        console.error("[Voice] Stop error:", err);
        setIsTranscribing(false);
        setMicError(err.message || "فشل التحويل الصوتي");
        setTimeout(() => setMicError(null), 4000);
      }
    } else {
      try {
        console.log("[Voice] Starting recording...");
        await startRecording();
        toast.info("جاري التسجيل... اضغط مرة أخرى للإيقاف");
        // Auto-stop after 30 seconds
        autoStopRef.current = setTimeout(async () => {
          console.log("[Voice] Auto-stopping after 30s");
          try {
            const blob = await stopRecording();
            toast.info("تم إيقاف التسجيل تلقائياً (30 ثانية)");
            await processVoiceBlob(blob);
          } catch (e) {
            console.error("[Voice] Auto-stop error:", e);
          }
        }, 30000);
      } catch (err: any) {
        console.error("[Voice] Failed to start:", err);
        setMicError(err.message || "لم يتم السماح بالوصول للميكروفون");
        toast.error("لم يتم السماح بالوصول للميكروفون. تأكد من الإعدادات.");
        setTimeout(() => setMicError(null), 4000);
      }
    }
  };

  // TTS: Play Salwa's response
  const handlePlayResponse = async (text: string) => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      return;
    }
    try {
      const stripped = text.replace(/[#*_~`>\[\]()]/g, "").slice(0, 4096);
      const result = await ttsMutation.mutateAsync({ token, text: stripped });
      const audioBlob = new Blob(
        [Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      audio.play();
    } catch {
      toast.error("فشل تشغيل الصوت");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg h-[90vh] sm:h-[75vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-l from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-amber-400/50 shadow-md">
              <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">سلوى</h3>
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                متصلة الآن
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-400 hover:text-red-500 h-8 w-8 p-0">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-10">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-3 ring-amber-400/40 mx-auto mb-4 shadow-lg">
                <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
              </div>
              <p className="text-slate-700 font-semibold mb-1">مرحباً {memberName}</p>
              <p className="text-slate-400 text-sm">كيف يمكنني مساعدتك اليوم؟</p>
              <p className="text-slate-400 text-xs mt-2">يمكنك الكتابة أو استخدام الميكروفون 🎙️</p>
            </div>
          )}

          {messages.map((msg: any, i: number) => (
            <div key={msg.id || i} className={`flex ${msg.role === "member" ? "justify-start" : "justify-end"} gap-2`}>
              {msg.role === "salwa" && (
                <button
                  onClick={() => handlePlayResponse(msg.content)}
                  className="self-end mb-1 p-1.5 rounded-full hover:bg-amber-100 transition-colors flex-shrink-0"
                  title="استمع للرد"
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-amber-600" /> : <Volume2 className="w-3.5 h-3.5 text-amber-500" />}
                </button>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

        {/* Recording indicator */}
        {(isRecording || isTranscribing) && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-xs text-red-600 font-medium">
                {isTranscribing ? "جاري التحويل..." : `تسجيل... ${recordingTime}ث`}
              </span>
            </div>
            {isRecording && (
              <button onClick={cancelRecording} className="text-xs text-red-500 hover:text-red-700">إلغاء</button>
            )}
          </div>
        )}

        {/* Mic error */}
        {micError && (
          <div className="px-4 py-1.5 bg-red-50 text-xs text-red-600 text-center">{micError}</div>
        )}

        {/* Input */}
        <div className="border-t bg-white p-3">
          <div className="flex items-end gap-2">
            {/* Mic button */}
            <button
              onClick={handleMicClick}
              disabled={isLoading || isTranscribing}
              className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all border ${
                isRecording
                  ? "bg-red-500 text-white border-red-500 animate-pulse"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-amber-600"
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "اضغط الميكروفون لإيقاف التسجيل..." : "اكتب رسالتك لسلوى..."}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-xl border-slate-200 text-sm focus:border-amber-400 focus:ring-amber-400/20"
              rows={1}
              disabled={isRecording || isTranscribing}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!message.trim() || isLoading || isRecording}
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
// REQUESTS & INQUIRIES (Interactive)
// ═══════════════════════════════════════════════════════
const MEMBERS_MAP: Record<string, string> = {
  abdulrahman: "عبدالرحمن",
  wael: "وائل",
  sheikh_issa: "الشيخ عيسى",
};

const REQUEST_TYPE_CONFIG = {
  approval: { label: "موافقة", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejection: { label: "رفض", color: "bg-red-100 text-red-700 border-red-200", icon: X },
  comment: { label: "تعليق", color: "bg-blue-100 text-blue-700 border-blue-200", icon: MessageSquare },
  question: { label: "استفسار", color: "bg-amber-100 text-amber-700 border-amber-200", icon: HelpCircle },
};

const STATUS_CONFIG = {
  active: { label: "جديد", color: "bg-blue-100 text-blue-700 border-blue-200" },
  pending_response: { label: "بانتظار رد", color: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "تم الحل", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  archived: { label: "مؤرشف", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

function RequestConversation({ token, item, memberId, memberNameAr, onClose }: {
  token: string;
  item: any;
  memberId: string;
  memberNameAr: string;
  onClose: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [replyType, setReplyType] = useState<"approval" | "rejection" | "comment" | "question">("comment");
  const [replyAttachment, setReplyAttachment] = useState<{ url: string; name: string } | null>(null);
  const [replyUploading, setReplyUploading] = useState(false);
  const responses = trpc.commandCenter.getResponses.useQuery({ token, itemId: item.id });
  const respondMutation = trpc.commandCenter.respondToItem.useMutation();
  const updateStatus = trpc.commandCenter.updateItemStatus.useMutation();
  const utils = trpc.useUtils();

  const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/command-center", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setReplyAttachment({ url: data.url, name: file.name });
      else toast.error("فشل رفع الملف");
    } catch { toast.error("خطأ في رفع الملف"); }
    finally { setReplyUploading(false); e.target.value = ""; }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await respondMutation.mutateAsync({ token, itemId: item.id, responseText: replyText, responseType: replyType, attachmentUrl: replyAttachment?.url, attachmentName: replyAttachment?.name });
    // Auto-update status based on reply type
    if (replyType === "approval") {
      await updateStatus.mutateAsync({ token, itemId: item.id, status: "resolved" });
    } else if (replyType === "rejection") {
      await updateStatus.mutateAsync({ token, itemId: item.id, status: "resolved" });
    } else {
      await updateStatus.mutateAsync({ token, itemId: item.id, status: "pending_response" });
    }
    setReplyText("");
    setReplyAttachment(null);
    utils.commandCenter.getResponses.invalidate({ token, itemId: item.id });
    utils.commandCenter.getItems.invalidate();
  };

  const targetIds: string[] = (() => { try { return item.targetMemberIds ? JSON.parse(item.targetMemberIds) : []; } catch { return []; } })();
  const isRecipient = targetIds.includes(memberId);
  const isSender = item.createdByMemberId === memberId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CONFIG[item.itemStatus as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.active.color}`}>
                {STATUS_CONFIG[item.itemStatus as keyof typeof STATUS_CONFIG]?.label || "جديد"}
              </span>
              {item.itemPriority === "urgent" && <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-red-100 text-red-700 border-red-200">عاجل</span>}
            </div>
            <h3 className="font-bold text-slate-800 text-lg truncate">{item.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              من: <span className="font-medium text-slate-700">{MEMBERS_MAP[item.createdByMemberId] || item.createdByMemberId}</span>
              {targetIds.length > 0 && <> → إلى: <span className="font-medium text-slate-700">{targetIds.map(t => MEMBERS_MAP[t] || t).join("، ")}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Original message */}
        <div className="p-5 bg-amber-50/50 border-b border-amber-100">
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{item.content || item.summary || "لا يوجد وصف"}</p>
          {(() => { try { const atts = item.attachments ? JSON.parse(item.attachments) : []; return atts.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700">مرفقات الطلب:</p>
              {atts.map((att: any, idx: number) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 bg-amber-100 rounded-lg px-3 py-2 hover:bg-amber-200 transition-colors">
                  {att.type === "link" ? <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> : <FileUp className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate">{att.name}</span>
                </a>
              ))}
            </div>
          ) : null; } catch { return null; } })()} 
          <p className="text-xs text-slate-400 mt-2">{new Date(item.createdAt).toLocaleString("ar-SA")}</p>
        </div>

        {/* Conversation thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {responses.isLoading && <div className="text-center text-slate-400 text-sm py-4">جاري التحميل...</div>}
          {responses.data?.length === 0 && !responses.isLoading && (
            <div className="text-center text-slate-400 text-sm py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>لا توجد ردود بعد</p>
            </div>
          )}
          {responses.data?.map((resp: any) => {
            const cfg = REQUEST_TYPE_CONFIG[resp.responseType as keyof typeof REQUEST_TYPE_CONFIG] || REQUEST_TYPE_CONFIG.comment;
            const RespIcon = cfg.icon;
            const isMe = resp.memberId === memberId;
            return (
              <div key={resp.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {(MEMBERS_MAP[resp.memberId] || resp.memberId).charAt(0)}
                </div>
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{MEMBERS_MAP[resp.memberId] || resp.memberId}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${cfg.color}`}>
                      <RespIcon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMe ? "bg-amber-500 text-white rounded-tr-sm" : "bg-slate-100 text-slate-700 rounded-tl-sm"}`}>
                    {resp.responseText}
                    {resp.attachmentUrl && (
                      <a href={resp.attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className={`mt-2 flex items-center gap-1.5 text-xs underline ${isMe ? "text-amber-100" : "text-blue-600"}`}>
                        <FileUp className="w-3 h-3" />{resp.attachmentName || "مرفق"}
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{new Date(resp.createdAt).toLocaleString("ar-SA")}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply area */}
        {(isRecipient || isSender) && item.itemStatus !== "resolved" && item.itemStatus !== "archived" && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            {/* Reply type selector */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {(Object.entries(REQUEST_TYPE_CONFIG) as [string, any][]).map(([type, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setReplyType(type as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      replyType === type ? cfg.color + " ring-2 ring-offset-1 ring-current" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />{cfg.label}
                  </button>
                );
              })}
            </div>
            {/* Reply attachment preview */}
            {replyAttachment && (
              <div className="flex items-center gap-2 mb-2 bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
                <FileUp className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{replyAttachment.name}</span>
                <button onClick={() => setReplyAttachment(null)} className="text-blue-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-1.5 justify-center" title="إرفاق ملف">
                  {replyUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onChange={handleReplyFileChange} disabled={replyUploading} />
                </label>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || respondMutation.isPending}
                  className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  إرسال
                </button>
              </div>
            </div>
          </div>
        )}
        {item.itemStatus === "resolved" && (
          <div className="p-3 border-t border-emerald-100 bg-emerald-50 text-center text-sm text-emerald-700 font-medium">✅ تم حل هذا الطلب</div>
        )}
      </div>
    </div>
  );
}

function RequestsAndInquiries({ token, memberId, memberNameAr, memberRole, onBack }: {
  token: string;
  memberId: string;
  memberNameAr: string;
  memberRole: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"inbox" | "sent" | "all">("inbox");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending_response" | "resolved">("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [newTargets, setNewTargets] = useState<string[]>([]);
  const [reqUploading, setReqUploading] = useState(false);
  const [reqAttachment, setReqAttachment] = useState<{ name: string; url: string; type: string } | null>(null);
  const allItems = trpc.commandCenter.getItems.useQuery({ token, bubbleType: "requests" });
  const members = trpc.commandCenter.getMembers.useQuery({ token });
  const createItem = trpc.commandCenter.createItem.useMutation();
  const deleteItem = trpc.commandCenter.deleteItem.useMutation();
  const utils = trpc.useUtils();

  const handleReqFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReqUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bubbleType", "requests");
      const res = await fetch("/api/upload/command-center", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الملف");
      setReqAttachment({ name: data.name, url: data.url, type: data.type });
      toast.success("تم رفع الملف بنجاح ✔️");
    } catch (err: any) {
      toast.error(err.message || "خطأ في رفع الملف");
    } finally {
      setReqUploading(false);
      e.target.value = "";
    }
  };

  const items = allItems.data || [];

  const inboxItems = items.filter((item: any) => {
    try {
      const targets = item.targetMemberIds ? JSON.parse(item.targetMemberIds) : [];
      return targets.includes(memberId) && item.createdByMemberId !== memberId;
    } catch { return false; }
  });

  const sentItems = items.filter((item: any) => item.createdByMemberId === memberId);

  const tabItems = tab === "inbox" ? inboxItems : tab === "sent" ? sentItems : items;
  const displayItems = statusFilter === "all" ? tabItems : tabItems.filter((item: any) => item.itemStatus === statusFilter);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createItem.mutateAsync({
      token,
      bubbleType: "requests",
      title: newTitle,
      content: newContent,
      priority: newPriority,
      targetMemberIds: newTargets.length > 0 ? newTargets : undefined,
      requiresResponse: true,
      attachments: reqAttachment ? JSON.stringify([reqAttachment]) : undefined,
    });
    setNewTitle(""); setNewContent(""); setNewTargets([]); setNewPriority("normal"); setReqAttachment(null);
    setShowNewModal(false);
    utils.commandCenter.getItems.invalidate();
  };

  const handleDelete = async (id: number) => {
    await deleteItem.mutateAsync({ token, itemId: id });
    utils.commandCenter.getItems.invalidate();
  };

  const otherMembers = (members.data || []).filter((m: any) => m.memberId !== memberId);

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">الاعتمادات الرسمية</h2>
            <p className="text-sm text-slate-500">تواصل تفاعلي بين أعضاء مركز القيادة</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          طلب / استفسار جديد
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-3">
        {(["inbox", "sent", "all"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "inbox" ? `الوارد (${inboxItems.length})` : t === "sent" ? `المرسل (${sentItems.length})` : `الكل (${items.length})`}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          { value: "all", label: "جميع الحالات", color: "bg-slate-100 text-slate-700 border-slate-200" },
          { value: "active", label: "جديد", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { value: "pending_response", label: "قيد الانتظار", color: "bg-amber-50 text-amber-700 border-amber-200" },
          { value: "resolved", label: "منجز", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === opt.value ? opt.color + " ring-2 ring-offset-1 ring-current" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      {allItems.isLoading && <div className="text-center py-12 text-slate-400">جاري التحميل...</div>}
      {!allItems.isLoading && displayItems.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{tab === "inbox" ? "لا توجد طلبات واردة" : tab === "sent" ? "لم ترسل أي طلبات بعد" : "لا توجد طلبات"}</p>
        </div>
      )}
      <div className="space-y-3">
        {displayItems.map((item: any) => {
          const targetIds: string[] = (() => { try { return item.targetMemberIds ? JSON.parse(item.targetMemberIds) : []; } catch { return []; } })();
          const statusCfg = STATUS_CONFIG[item.itemStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
          const priorityCfg = PRIORITY_LABELS[item.itemPriority] || PRIORITY_LABELS.normal;
          const isMyItem = item.createdByMemberId === memberId;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedItem(item)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isMyItem ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {(MEMBERS_MAP[item.createdByMemberId] || item.createdByMemberId).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    {!isMyItem && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">وارد إليك</span>}
                    {isMyItem && <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">مرسل منك</span>}
                  </div>
                  <h4 className="font-semibold text-slate-800 truncate">{item.title}</h4>
                  {item.content && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{item.content}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>من: {MEMBERS_MAP[item.createdByMemberId] || item.createdByMemberId}</span>
                    {targetIds.length > 0 && <span>→ {targetIds.map(t => MEMBERS_MAP[t] || t).join("، ")}</span>}
                    <span>{new Date(item.createdAt).toLocaleDateString("ar-SA")}</span>
                  </div>
                </div>
                {isMyItem && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">طلب / استفسار جديد</h3>
              <button onClick={() => setShowNewModal(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الموضوع <span className="text-red-500">*</span></label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="موضوع الطلب أو الاستفسار..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">التفاصيل</label>
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="اشرح طلبك أو استفسارك بالتفصيل..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">إرسال إلى</label>
                <div className="flex gap-2 flex-wrap">
                  {otherMembers.map((m: any) => (
                    <button
                      key={m.memberId}
                      onClick={() => setNewTargets(prev =>
                        prev.includes(m.memberId) ? prev.filter(x => x !== m.memberId) : [...prev, m.memberId]
                      )}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        newTargets.includes(m.memberId)
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      {m.nameAr}
                    </button>
                  ))}
                  {otherMembers.length === 0 && <span className="text-sm text-slate-400">جاري التحميل...</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">إذا لم تختر أحداً سيتم إرساله لجميع الأعضاء</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الأولوية</label>
                <div className="flex gap-2">
                  {(["normal", "important", "urgent"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                        newPriority === p ? PRIORITY_LABELS[p].color + " ring-2 ring-offset-1 ring-current" : "bg-white text-slate-500 border-slate-200"
                      }`}
                    >
                      {PRIORITY_LABELS[p].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  مرفق (PDF, Word, Excel, صورة) — اختياري
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-amber-300 transition-colors">
                  {reqAttachment ? (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <FileUp className="w-4 h-4" />
                        <span className="truncate max-w-[240px]">{reqAttachment.name}</span>
                      </div>
                      <button onClick={() => setReqAttachment(null)} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : reqUploading ? (
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">جاري الرفع...</span>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                      <span className="text-sm text-slate-500">اضغط لاختيار ملف</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                        onChange={handleReqFileChange}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || createItem.isPending || reqUploading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {createItem.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Modal */}
      {selectedItem && (
        <RequestConversation
          token={token}
          item={selectedItem}
          memberId={memberId}
          memberNameAr={memberNameAr}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------
// BUBBLE DETAIL VIEW
// ---------------------------------------------------
function BubbleDetail({ token, bubbleType, onBack, memberRole }: { token: string; bubbleType: string; onBack: () => void; memberRole: string }) {
  const bubble = BUBBLES.find(b => b.type === bubbleType);
  const items = trpc.commandCenter.getItems.useQuery({ token, bubbleType: bubbleType as any, status: "active" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkName, setNewLinkName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedAttachment, setUploadedAttachment] = useState<{ name: string; url: string; type: string } | null>(null);
  const createItem = trpc.commandCenter.createItem.useMutation();
  const deleteItem = trpc.commandCenter.deleteItem.useMutation();
  const utils = trpc.useUtils();

  const canCreate = ["announcements", "meeting_minutes", "reports", "requests"].includes(bubbleType);
  const canDelete = ["announcements", "meeting_minutes", "reports", "requests"].includes(bubbleType);
  const hasFileUpload = ["meeting_minutes", "reports", "requests"].includes(bubbleType);
  const hasLinkField = ["meeting_minutes", "reports", "requests"].includes(bubbleType);

  const labels: Record<string, { btn: string; modal: string; success: string }> = {
    announcements: { btn: "إضافة إعلان", modal: "إضافة إعلان جديد", success: "تم إضافة الإعلان بنجاح" },
    meeting_minutes: { btn: "إضافة محضر", modal: "إضافة محضر اجتماع", success: "تم إضافة المحضر بنجاح" },
    reports: { btn: "رفع تقرير", modal: "رفع تقرير جديد", success: "تم رفع التقرير بنجاح" },
    requests: { btn: "تقديم طلب", modal: "تقديم طلب جديد", success: "تم تقديم الطلب بنجاح" },
  };
  const lbl = labels[bubbleType] || labels.announcements;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bubbleType", bubbleType);
      const res = await fetch("/api/upload/command-center", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الملف");
      setUploadedAttachment({ name: data.name, url: data.url, type: data.type });
      toast.success("تم رفع الملف بنجاح ✔️");
    } catch (err: any) {
      toast.error(err.message || "خطأ في رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setNewTitle(""); setNewContent(""); setNewLinkUrl(""); setNewLinkName("");
    setUploadedAttachment(null); setShowAddModal(false);
  };

  const handleAddItem = async () => {
    if (!newTitle.trim()) { toast.error("الرجاء إدخال عنوان"); return; }
    const attachments: { name: string; url: string; type: string }[] = [];
    if (uploadedAttachment) attachments.push(uploadedAttachment);
    if (newLinkUrl.trim()) attachments.push({ name: newLinkName.trim() || newLinkUrl, url: newLinkUrl.trim(), type: "link" });
    try {
      await createItem.mutateAsync({
        token, bubbleType: bubbleType as any, title: newTitle, content: newContent,
        priority: "normal", summary: newContent.substring(0, 100),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      resetModal();
      utils.commandCenter.getItems.invalidate({ token, bubbleType: bubbleType as any, status: "active" });
      toast.success(lbl.success);
    } catch { toast.error("خطأ في الإضافة"); }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await deleteItem.mutateAsync({ token, itemId });
      utils.commandCenter.getItems.invalidate({ token, bubbleType: bubbleType as any, status: "active" });
      toast.success("تم الحذف بنجاح");
    } catch (error: any) {
      if (error?.data?.code === "NOT_FOUND") {
        utils.commandCenter.getItems.invalidate({ token, bubbleType: bubbleType as any, status: "active" });
        return;
      }
      toast.error("خطأ في الحذف");
    }
  };

  if (!bubble) return null;

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
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
        {canCreate && (
          <Button size="sm" onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:shadow-md">
            <Plus className="w-4 h-4 ml-1" />{lbl.btn}
          </Button>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6 space-y-4" dir="rtl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">{lbl.modal}</h3>
                <button onClick={resetModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {bubbleType === "requests" ? "موضوع الطلب" : "العنوان"} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder={bubbleType === "requests" ? "موضوع الطلب" : bubbleType === "meeting_minutes" ? "عنوان الاجتماع" : "عنوان التقرير"}
                    value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {bubbleType === "requests" ? "تفاصيل الطلب" : "وصف مختصر"}
                  </label>
                  <Textarea
                    placeholder={bubbleType === "requests" ? "اشرح طلبك بالتفصيل..." : "وصف مختصر..."}
                    value={newContent} onChange={(e) => setNewContent(e.target.value)}
                    className="w-full h-24 resize-none" />
                </div>

                {/* File Upload — meetings & reports */}
                {hasFileUpload && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <Paperclip className="w-3.5 h-3.5 inline ml-1" />رفع ملف (PDF, Word, Excel)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-slate-400 transition-colors">
                      {uploadedAttachment ? (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <FileUp className="w-4 h-4" />
                            <span className="truncate max-w-[220px]">{uploadedAttachment.name}</span>
                          </div>
                          <button onClick={() => setUploadedAttachment(null)} className="text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : uploading ? (
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">جاري الرفع...</span>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                          <span className="text-sm text-slate-500">اضغط لاختيار ملف</span>
                          <input type="file" className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                            onChange={handleFileChange} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* External Link — meetings & reports */}
                {hasLinkField && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <LinkIcon className="w-3.5 h-3.5 inline ml-1" />رابط خارجي (اختياري)
                    </label>
                    <div className="flex gap-2">
                      <Input placeholder="https://..." value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)} className="flex-1 text-sm" dir="ltr" />
                      <Input placeholder="اسم الرابط" value={newLinkName}
                        onChange={(e) => setNewLinkName(e.target.value)} className="w-32 text-sm" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={resetModal} className="px-4">إلغاء</Button>
                <Button onClick={handleAddItem} disabled={createItem.isPending || !newTitle.trim() || uploading}
                  className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4">
                  {createItem.isPending ? <><Loader2 className="w-4 h-4 ml-1 animate-spin" />جاري...</> : lbl.btn}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Items */}
      {items.isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl shimmer" />)}</div>
      ) : items.data?.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl ${bubble.bg} flex items-center justify-center mx-auto mb-4`}>
            <bubble.icon className={`w-7 h-7 ${bubble.text}`} />
          </div>
          <p className="text-slate-500 font-medium">لا توجد عناصر حالياً</p>
          {canCreate && (
            <button onClick={() => setShowAddModal(true)}
              className="mt-3 text-sm text-slate-400 hover:text-slate-600 underline">{lbl.btn} الآن</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.data?.map((item) => (
            <ItemCard key={item.id} item={item} token={token} bubbleType={bubbleType}
              onDelete={canDelete ? handleDeleteItem : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, token, onDelete, bubbleType }: { item: any; token: string; onDelete?: (id: number) => void; bubbleType?: string }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS.normal;
  const responses = trpc.commandCenter.getResponses.useQuery(
    { token, itemId: item.id },
    { enabled: expanded }
  );

  const attachments: { name: string; url: string; type: string }[] = (() => {
    try { return item.attachments ? JSON.parse(item.attachments) : []; }
    catch { return []; }
  })();

  const deleteLabels: Record<string, string> = {
    announcements: "حذف الإعلان", meeting_minutes: "حذف المحضر",
    reports: "حذف التقرير", requests: "حذف الطلب",
  };

  return (
    <Card className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priority.color}`}>
              {priority.label}
            </Badge>
            {item.requiresResponse === 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                يحتاج رد
              </Badge>
            )}
            {attachments.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">
                <Paperclip className="w-2.5 h-2.5 ml-0.5" />{attachments.length} مرفق
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 text-sm leading-relaxed">{item.title}</h3>
          {item.summary && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs text-slate-400">
            {new Date(item.createdAt).toLocaleDateString("ar-AE", { month: "short", day: "numeric" })}
          </div>
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>{deleteLabels[bubbleType || ""] || "حذف"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(item.id)} className="bg-red-500 hover:bg-red-600">حذف</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          {item.content && (
            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">
              <Streamdown>{item.content}</Streamdown>
            </div>
          )}
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500">المرفقات:</p>
              {attachments.map((att, idx) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors">
                  {att.type === "link" ? <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> : <FileUp className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate">{att.name}</span>
                </a>
              ))}
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
// MILESTONES & KPIs VIEW
// ═══════════════════════════════════════════════════════
function MilestonesKpisView({ token, onBack }: { token: string; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'milestones' | 'kpis'>('milestones');
  const [selectedProject, setSelectedProject] = useState<number | undefined>(undefined);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [editingKpi, setEditingKpi] = useState<any>(null);

  const milestoneSummary = trpc.commandCenter.getMilestonesSummary.useQuery({ token });
  const kpiSummary = trpc.commandCenter.getKpisSummary.useQuery({ token });
  const milestones = trpc.commandCenter.getMilestones.useQuery({ token, projectId: selectedProject });
  const kpis = trpc.commandCenter.getKpis.useQuery({ token, projectId: selectedProject });
  const projectsData = trpc.commandCenter.getProjectsWithConsultants.useQuery({ token });
  const utils = trpc.useUtils();

  const deleteMilestoneMut = trpc.commandCenter.deleteMilestone.useMutation({
    onSuccess: () => {
      utils.commandCenter.getMilestones.invalidate();
      utils.commandCenter.getMilestonesSummary.invalidate();
      utils.commandCenter.getBubbleCounts.invalidate();
      toast.success("تم حذف المرحلة");
    },
  });

  const deleteKpiMut = trpc.commandCenter.deleteKpi.useMutation({
    onSuccess: () => {
      utils.commandCenter.getKpis.invalidate();
      utils.commandCenter.getKpisSummary.invalidate();
      utils.commandCenter.getBubbleCounts.invalidate();
      toast.success("تم حذف المؤشر");
    },
  });

  const mSummary = milestoneSummary.data;
  const kSummary = kpiSummary.data;

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700 -mr-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 flex items-center justify-center shadow-md">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">مراحل المشاريع ومؤشرات الأداء</h2>
          <p className="text-xs text-slate-500">Project Milestones & KPIs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 rounded-xl border border-slate-200 text-center">
          <p className="text-2xl font-bold text-cyan-700">{mSummary?.total || 0}</p>
          <p className="text-[11px] text-slate-500">إجمالي المراحل</p>
        </Card>
        <Card className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-center">
          <p className="text-2xl font-bold text-emerald-700">{mSummary?.completed || 0}</p>
          <p className="text-[11px] text-emerald-600">مكتملة</p>
        </Card>
        <Card className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
          <p className="text-2xl font-bold text-blue-700">{mSummary?.inProgress || 0}</p>
          <p className="text-[11px] text-blue-600">جارية</p>
        </Card>
        <Card className="p-3 rounded-xl border border-red-200 bg-red-50/50 text-center">
          <p className="text-2xl font-bold text-red-700">{mSummary?.delayed || 0}</p>
          <p className="text-[11px] text-red-600">متأخرة</p>
        </Card>
      </div>

      {/* Overall Progress */}
      {mSummary && mSummary.total > 0 && (
        <Card className="p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">التقدم العام</span>
            <span className="text-sm font-bold text-cyan-700">{mSummary.overallProgress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-cyan-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${mSummary.overallProgress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'milestones'
              ? 'bg-cyan-50 text-cyan-700 border-b-2 border-cyan-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Flag className="w-4 h-4 inline ml-1.5" />
          المراحل ({milestones.data?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('kpis')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'kpis'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline ml-1.5" />
          مؤشرات الأداء ({kpis.data?.length || 0})
        </button>
      </div>

      {/* Project Filter */}
      <div className="flex items-center gap-3">
        <select
          value={selectedProject ?? ''}
          onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : undefined)}
          className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-sm px-3 text-slate-700 focus:border-cyan-400 focus:ring-cyan-400/20"
        >
          <option value="">جميع المشاريع</option>
          {projectsData.data?.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {activeTab === 'milestones' ? (
          <Button
            size="sm"
            onClick={() => { setEditingMilestone(null); setShowAddMilestone(true); }}
            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg shadow-sm h-9 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 ml-1" /> إضافة مرحلة
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => { setEditingKpi(null); setShowAddKpi(true); }}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg shadow-sm h-9 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 ml-1" /> إضافة مؤشر
          </Button>
        )}
      </div>

      {/* Milestones Tab */}
      {activeTab === 'milestones' && (
        <div className="space-y-3">
          {milestones.isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl shimmer" />)}
            </div>
          ) : milestones.data?.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">لا توجد مراحل حالياً</p>
              <p className="text-slate-400 text-sm mt-1">أضف مرحلة جديدة لتتبع تقدم المشروع</p>
            </div>
          ) : (
            milestones.data?.map((m: any) => {
              const statusConf = MILESTONE_STATUS_CONFIG[m.status] || MILESTONE_STATUS_CONFIG.not_started;
              const StatusIcon = statusConf.icon;
              const projectName = projectsData.data?.find((p: any) => p.id === m.projectId)?.name;
              return (
                <Card key={m.id} className="p-4 rounded-xl border border-slate-200 hover:border-cyan-200 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConf.color}`}>
                          <StatusIcon className="w-3 h-3 ml-0.5" />
                          {statusConf.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                          {MILESTONE_CATEGORY_LABELS[m.category] || m.category}
                        </Badge>
                        {m.priority === 'critical' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">حرج</Badge>
                        )}
                        {m.priority === 'high' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200">مرتفع</Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">{m.titleAr || m.title}</h4>
                      {projectName && <p className="text-[11px] text-slate-400 mt-0.5">{projectName}</p>}
                      {m.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>}
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400">التقدم</span>
                          <span className="text-[10px] font-bold text-cyan-700">{m.progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              m.status === 'delayed' ? 'bg-red-500' :
                              m.status === 'completed' ? 'bg-emerald-500' :
                              'bg-gradient-to-l from-cyan-500 to-teal-500'
                            }`}
                            style={{ width: `${m.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Dates */}
                      {(m.plannedStartDate || m.plannedEndDate) && (
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {m.plannedStartDate && <span>بداية: {m.plannedStartDate}</span>}
                          {m.plannedEndDate && <span>نهاية: {m.plannedEndDate}</span>}
                        </div>
                      )}
                      {m.assignedTo && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          <User className="w-3 h-3" />
                          <span>{m.assignedTo}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-600" onClick={() => { setEditingMilestone(m); setShowAddMilestone(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteMilestoneMut.mutate({ token, id: m.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* KPIs Tab */}
      {activeTab === 'kpis' && (
        <div className="space-y-3">
          {/* KPI Summary Bar */}
          {kSummary && kSummary.total > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(KPI_STATUS_CONFIG).map(([key, conf]) => {
                const count = key === 'on_track' ? kSummary.onTrack :
                              key === 'at_risk' ? kSummary.atRisk :
                              key === 'off_track' ? kSummary.offTrack :
                              key === 'achieved' ? kSummary.achieved :
                              (kSummary as any).notStarted || 0;
                if (!count) return null;
                return (
                  <Badge key={key} variant="outline" className={`text-[10px] px-2 py-0.5 ${conf.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${conf.dotColor} inline-block ml-1`} />
                    {conf.label}: {count}
                  </Badge>
                );
              })}
            </div>
          )}

          {kpis.isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl shimmer" />)}
            </div>
          ) : kpis.data?.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">لا توجد مؤشرات أداء حالياً</p>
              <p className="text-slate-400 text-sm mt-1">أضف مؤشر أداء لتتبع الأهداف</p>
            </div>
          ) : (
            kpis.data?.map((k: any) => {
              const statusConf = KPI_STATUS_CONFIG[k.status] || KPI_STATUS_CONFIG.not_started;
              const projectName = projectsData.data?.find((p: any) => p.id === k.projectId)?.name;
              const target = parseFloat(k.targetValue) || 0;
              const current = parseFloat(k.currentValue) || 0;
              const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
              const TrendIcon = k.trend === 'up' ? TrendingUp : k.trend === 'down' ? TrendingDown : Minus;
              const trendColor = k.trend === 'up' ? 'text-emerald-600' : k.trend === 'down' ? 'text-red-600' : 'text-slate-400';

              return (
                <Card key={k.id} className="p-4 rounded-xl border border-slate-200 hover:border-teal-200 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConf.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor} inline-block ml-0.5`} />
                          {statusConf.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                          {KPI_CATEGORY_LABELS[k.category] || k.category}
                        </Badge>
                        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">{k.nameAr || k.name}</h4>
                      {projectName && <p className="text-[11px] text-slate-400 mt-0.5">{projectName}</p>}
                      {k.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{k.description}</p>}

                      {/* Value bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400">
                            الحالي: <span className="font-bold text-slate-700">{current}{k.unit ? ` ${k.unit}` : ''}</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            المستهدف: <span className="font-bold text-teal-700">{target}{k.unit ? ` ${k.unit}` : ''}</span>
                          </span>
                        </div>
                        {target > 0 && (
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                k.status === 'off_track' ? 'bg-red-500' :
                                k.status === 'at_risk' ? 'bg-amber-500' :
                                k.status === 'achieved' ? 'bg-blue-500' :
                                'bg-gradient-to-l from-teal-500 to-emerald-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {k.lastUpdatedBy && (
                        <p className="text-[10px] text-slate-400 mt-2">آخر تحديث: {k.lastUpdatedBy}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-teal-600" onClick={() => { setEditingKpi(k); setShowAddKpi(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteKpiMut.mutate({ token, id: k.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Milestone Modal */}
      {showAddMilestone && (
        <MilestoneForm
          token={token}
          milestone={editingMilestone}
          projects={projectsData.data || []}
          onClose={() => { setShowAddMilestone(false); setEditingMilestone(null); }}
          onSuccess={() => {
            setShowAddMilestone(false);
            setEditingMilestone(null);
            utils.commandCenter.getMilestones.invalidate();
            utils.commandCenter.getMilestonesSummary.invalidate();
            utils.commandCenter.getBubbleCounts.invalidate();
          }}
        />
      )}

      {/* Add/Edit KPI Modal */}
      {showAddKpi && (
        <KpiForm
          token={token}
          kpi={editingKpi}
          projects={projectsData.data || []}
          onClose={() => { setShowAddKpi(false); setEditingKpi(null); }}
          onSuccess={() => {
            setShowAddKpi(false);
            setEditingKpi(null);
            utils.commandCenter.getKpis.invalidate();
            utils.commandCenter.getKpisSummary.invalidate();
            utils.commandCenter.getBubbleCounts.invalidate();
          }}
        />
      )}
    </div>
  );
}

// --- Milestone Form ---
function MilestoneForm({ token, milestone, projects, onClose, onSuccess }: {
  token: string; milestone: any; projects: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const isEdit = !!milestone;
  const [form, setForm] = useState({
    projectId: milestone?.projectId || (projects[0]?.id || 0),
    title: milestone?.title || '',
    titleAr: milestone?.titleAr || '',
    description: milestone?.description || '',
    category: milestone?.category || 'other',
    plannedStartDate: milestone?.plannedStartDate || '',
    plannedEndDate: milestone?.plannedEndDate || '',
    actualStartDate: milestone?.actualStartDate || '',
    actualEndDate: milestone?.actualEndDate || '',
    progressPercent: milestone?.progressPercent ?? 0,
    status: milestone?.status || 'not_started',
    priority: milestone?.priority || 'medium',
    assignedTo: milestone?.assignedTo || '',
    notes: milestone?.notes || '',
    sortOrder: milestone?.sortOrder ?? 0,
  });

  const createMut = trpc.commandCenter.createMilestone.useMutation({ onSuccess });
  const updateMut = trpc.commandCenter.updateMilestone.useMutation({ onSuccess });

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("يرجى إدخال عنوان المرحلة"); return; }
    if (!form.projectId) { toast.error("يرجى اختيار المشروع"); return; }
    if (isEdit) {
      updateMut.mutate({ token, id: milestone.id, ...form });
    } else {
      createMut.mutate({ token, ...form } as any);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-6" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{isEdit ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">المشروع *</label>
            <select value={form.projectId} onChange={e => setForm(f => ({...f, projectId: Number(e.target.value)}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-3">
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">العنوان (EN) *</label>
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">العنوان (عربي)</label>
              <Input value={form.titleAr} onChange={e => setForm(f => ({...f, titleAr: e.target.value}))} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">الوصف</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الفئة</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                {Object.entries(MILESTONE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الحالة</label>
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                {Object.entries(MILESTONE_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الأولوية</label>
              <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                <option value="low">منخفض</option>
                <option value="medium">متوسط</option>
                <option value="high">مرتفع</option>
                <option value="critical">حرج</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">بداية مخططة</label>
              <Input type="date" value={form.plannedStartDate} onChange={e => setForm(f => ({...f, plannedStartDate: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">نهاية مخططة</label>
              <Input type="date" value={form.plannedEndDate} onChange={e => setForm(f => ({...f, plannedEndDate: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
          </div>
          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">بداية فعلية</label>
                <Input type="date" value={form.actualStartDate} onChange={e => setForm(f => ({...f, actualStartDate: e.target.value}))} className="h-9 text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">نهاية فعلية</label>
                <Input type="date" value={form.actualEndDate} onChange={e => setForm(f => ({...f, actualEndDate: e.target.value}))} className="h-9 text-sm" dir="ltr" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">نسبة الإنجاز: {form.progressPercent}%</label>
            <input type="range" min="0" max="100" step="5" value={form.progressPercent} onChange={e => setForm(f => ({...f, progressPercent: Number(e.target.value)}))} className="w-full accent-cyan-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">المسؤول</label>
            <Input value={form.assignedTo} onChange={e => setForm(f => ({...f, assignedTo: e.target.value}))} className="h-9 text-sm" placeholder="اسم المسؤول" />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSubmit} disabled={isPending} className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-xl h-10">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'تحديث' : 'إضافة'}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl h-10">إلغاء</Button>
        </div>
      </div>
    </div>
  );
}

// --- KPI Form ---
function KpiForm({ token, kpi, projects, onClose, onSuccess }: {
  token: string; kpi: any; projects: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const isEdit = !!kpi;
  const [form, setForm] = useState({
    projectId: kpi?.projectId || (projects[0]?.id || 0),
    name: kpi?.name || '',
    nameAr: kpi?.nameAr || '',
    description: kpi?.description || '',
    category: kpi?.category || 'operational',
    targetValue: kpi?.targetValue || '',
    currentValue: kpi?.currentValue || '',
    unit: kpi?.unit || '',
    trend: kpi?.trend || 'na',
    status: kpi?.status || 'not_started',
    notes: kpi?.notes || '',
  });

  const createMut = trpc.commandCenter.createKpi.useMutation({ onSuccess });
  const updateMut = trpc.commandCenter.updateKpi.useMutation({ onSuccess });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("يرجى إدخال اسم المؤشر"); return; }
    if (!form.projectId) { toast.error("يرجى اختيار المشروع"); return; }
    if (isEdit) {
      updateMut.mutate({ token, id: kpi.id, ...form });
    } else {
      createMut.mutate({ token, ...form } as any);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-6" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{isEdit ? 'تعديل المؤشر' : 'إضافة مؤشر أداء جديد'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">المشروع *</label>
            <select value={form.projectId} onChange={e => setForm(f => ({...f, projectId: Number(e.target.value)}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-3">
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">اسم المؤشر (EN) *</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">اسم المؤشر (عربي)</label>
              <Input value={form.nameAr} onChange={e => setForm(f => ({...f, nameAr: e.target.value}))} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">الوصف</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الفئة</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                {Object.entries(KPI_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الحالة</label>
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                {Object.entries(KPI_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">القيمة المستهدفة</label>
              <Input type="number" value={form.targetValue} onChange={e => setForm(f => ({...f, targetValue: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">القيمة الحالية</label>
              <Input type="number" value={form.currentValue} onChange={e => setForm(f => ({...f, currentValue: e.target.value}))} className="h-9 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الوحدة</label>
              <Input value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} className="h-9 text-sm" dir="ltr" placeholder="%, AED, days" />
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الاتجاه</label>
              <select value={form.trend} onChange={e => setForm(f => ({...f, trend: e.target.value}))} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm px-2">
                <option value="na">غير محدد</option>
                <option value="up">↑ صاعد</option>
                <option value="down">↓ هابط</option>
                <option value="stable">↔ مستقر</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSubmit} disabled={isPending} className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl h-10">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'تحديث' : 'إضافة'}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl h-10">إلغاء</Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EVALUATION VIEW
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// NEWS TICKER
// ═══════════════════════════════════════════════════════
function NewsTicker({ token }: { token: string }) {
  const liveQuery = trpc.commandCenter.getLiveTickerItems.useQuery(
    { token },
    { refetchInterval: 60_000 } // refresh every 60s
  );
  const liveItems = liveQuery.data || [];

  // Default news if no items exist
  const defaultItems = [
    { id: -1, label: 'مركز القيادة', text: 'مرحباً بكم في مركز القيادة — COMO Developments Command Center', isUrgent: false, needsResponse: false },
    { id: -2, label: 'مركز القيادة', text: 'تابعوا آخر التطورات في مشاريعنا العقارية', isUrgent: false, needsResponse: false },
    { id: -3, label: 'مركز القيادة', text: 'للتواصل مع سلوى اضغط على الزر العائم', isUrgent: false, needsResponse: false },
  ];

  const displayItems = liveItems.length > 0 ? liveItems : defaultItems;
  const doubled = [...displayItems, ...displayItems];

  return (
    <div className="overflow-hidden" style={{background: 'rgba(30,27,75,0.96)', borderBottom: '1px solid rgba(99,102,241,0.2)'}}>
      <div className="flex items-center h-9">
        <div className="flex-shrink-0 px-4 h-full flex items-center gap-1.5 text-xs font-bold z-10" style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white'}}>
          <Megaphone className="w-3.5 h-3.5" />
          أخر الأخبار
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap flex items-center h-9">
            {doubled.map((item: any, i: number) => (
              <span key={i} className="inline-flex items-center text-xs mx-6">
                {/* Category badge */}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 flex-shrink-0 ${
                  item.isUrgent
                    ? 'bg-red-500 text-white'
                    : item.needsResponse
                    ? 'bg-orange-400 text-white'
                    : 'bg-slate-600 text-slate-200'
                }`}>
                  {item.label}
                </span>
                {/* Urgent indicator */}
                {item.isUrgent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 ml-1.5 flex-shrink-0 animate-pulse" />
                )}
                {!item.isUrgent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1.5 flex-shrink-0" />
                )}
                <span style={{color: item.isUrgent ? '#fca5a5' : item.needsResponse ? '#fdba74' : 'rgba(255,255,255,0.75)'}}>
                  {item.text}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluationView({ token, memberRole, memberId }: { token: string; memberRole: string; memberId: string }) {
  const projectsQuery = trpc.commandCenter.getProjectsForEvaluation.useQuery({ token });
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'financial' | 'technical' | 'committee' | 'value' | 'scope' | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionConsultantId, setSessionConsultantId] = useState<number | null>(null);
  const createSession = trpc.commandCenter.createEvaluationSession.useMutation({
    onSuccess: () => { toast.success('تم إنشاء جلسة التقييم بنجاح ✔️'); setShowCreateSession(false); setSessionTitle(''); setSessionConsultantId(null); projectsQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const consultantsForProject = projectsQuery.data?.find((p: any) => p.id === selectedProject)?.consultants || [];

  if (selectedProject && activeTab === 'financial') {
    return <FinancialEvaluationView token={token} projectId={selectedProject} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'technical') {
    return <TechnicalEvaluationView token={token} projectId={selectedProject} memberId={memberId} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'value') {
    return <ValueAnalysisView token={token} projectId={selectedProject} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'committee') {
    return <CommitteeDecisionView token={token} projectId={selectedProject} memberId={memberId} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'scope') {
    return <DesignScopeReportView token={token} projectId={selectedProject} onBack={() => setActiveTab(null)} />;
  }

  if (selectedProject) {
    const project = projectsQuery.data?.find((p: any) => p.id === selectedProject);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة
            </Button>
            <h2 className="text-xl font-bold text-slate-800">{project?.name}</h2>
          </div>
          {memberRole === 'admin' && (
            <Button onClick={() => setShowCreateSession(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-sm gap-2">
              <Plus className="w-4 h-4" /> إنشاء جلسة تقييم
            </Button>
          )}
        </div>

        {/* Create Session Modal */}
        {showCreateSession && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-lg">إنشاء جلسة تقييم جديدة</h3>
                <button onClick={() => setShowCreateSession(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">عنوان الجلسة <span className="text-red-500">*</span></label>
                  <input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="مثال: تقييم استشاريي مشروع ند الشيبا" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">الاستشاري <span className="text-red-500">*</span></label>
                  <select value={sessionConsultantId ?? ''} onChange={e => setSessionConsultantId(Number(e.target.value) || null)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">— اختر الاستشاري —</option>
                    {consultantsForProject.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-slate-100">
                <button onClick={() => setShowCreateSession(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
                <button
                  onClick={() => selectedProject && sessionConsultantId && createSession.mutate({ token, projectId: selectedProject, consultantId: sessionConsultantId, title: sessionTitle || 'جلسة تقييم' })}
                  disabled={!sessionTitle.trim() || !sessionConsultantId || createSession.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >{createSession.isPending ? 'جاري الإنشاء...' : 'إنشاء الجلسة'}</button>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* التقييم المالي */}
          <button onClick={() => setActiveTab('financial')} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <DollarSign className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">التقييم المالي</h3>
              <p className="text-emerald-100 text-sm">الأتعاب والسكور المالي</p>
              {project?.hasFinancial && <Badge className="mt-2 bg-white/20 text-white border-0">بيانات متوفرة</Badge>}
            </div>
          </button>

          {/* دليل التقييم */}
          <button onClick={() => { window.location.href = '/consultant-guide'; }} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <BookText className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <BookText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">دليل التقييم</h3>
              <p className="text-teal-100 text-sm">المرجع الشامل للمنهجية</p>
            </div>
          </button>

          {/* التقييم الفني */}
          <button onClick={() => setActiveTab('technical')} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <Award className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">التقييم الفني</h3>
              <p className="text-blue-100 text-sm">تقييم المعايير الفنية</p>
              <div className="mt-2 flex gap-1">
                {project?.evaluatorStatus?.map((e: any) => (
                  <span key={e.name} className={`inline-block w-3 h-3 rounded-full ${e.isComplete ? 'bg-green-400' : e.completed > 0 ? 'bg-yellow-400' : 'bg-white/30'}`} title={e.name} />
                ))}
              </div>
            </div>
          </button>

          {/* تحليل القيمة */}
          <button onClick={() => setActiveTab('value')} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <SlidersHorizontal className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">تحليل القيمة</h3>
              <p className="text-amber-100 text-sm">فني × مالي مع الانحرافات</p>
            </div>
          </button>

          {/* قرار اللجنة */}
          <button onClick={() => setActiveTab('committee')} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <Gavel className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <Gavel className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">قرار اللجنة</h3>
              <p className="text-purple-100 text-sm">التقرير الشامل + التحليل الذكي</p>
              {project?.isDecisionConfirmed && <Badge className="mt-2 bg-white/20 text-white border-0">مؤكد ✅</Badge>}
            </div>
          </button>

          {/* تقرير نطاق التصاميم */}
          <button onClick={() => setActiveTab('scope')} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-right">
            <div className="absolute top-3 left-3 opacity-20 group-hover:opacity-30 transition-opacity">
              <ClipboardList className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1">تقرير نطاق التصاميم</h3>
              <p className="text-indigo-100 text-sm">مقارنة نطاق الاستشاريين</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Project list view
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Star className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold text-slate-800">تقييم الاستشاريين</h2>
      </div>
      {projectsQuery.isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      )}
      {projectsQuery.data?.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>لا توجد مشاريع للتقييم</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projectsQuery.data?.map((project: any) => {
          const statusConfig: Record<string, { label: string; color: string; icon: any; topColor: string; bgColor: string; iconBg: string }> = {
            not_started: { label: 'لم يبدأ', color: 'bg-slate-100 text-slate-600', icon: Lock, topColor: 'border-t-4 border-t-slate-400', bgColor: 'bg-slate-50', iconBg: 'bg-slate-500' },
            in_progress: { label: 'قيد التقييم', color: 'bg-amber-100 text-amber-700', icon: Loader2, topColor: 'border-t-4 border-t-amber-400', bgColor: 'bg-amber-50', iconBg: 'bg-amber-500' },
            evaluation_complete: { label: 'التقييم مكتمل', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2, topColor: 'border-t-4 border-t-blue-400', bgColor: 'bg-blue-50', iconBg: 'bg-blue-500' },
            decided: { label: 'تم اتخاذ القرار', color: 'bg-green-100 text-green-700', icon: Trophy, topColor: 'border-t-4 border-t-green-400', bgColor: 'bg-green-50', iconBg: 'bg-green-500' },
          };
          const st = statusConfig[project.status] || statusConfig.not_started;
          const StatusIcon = st.icon;
          return (
            <button key={project.id} onClick={() => setSelectedProject(project.id)} className={`group text-right rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:scale-[1.02] ${st.topColor} ${st.bgColor} border border-slate-200 hover:border-slate-300`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Badge className={`${st.color} border-0 text-xs font-medium`}>
                    <StatusIcon className={`w-3 h-3 ml-1 ${project.status === 'in_progress' ? 'animate-spin' : ''}`} />
                    {st.label}
                  </Badge>
                  <div className={`w-14 h-14 rounded-2xl ${st.iconBg} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                    <Building className="w-7 h-7 text-white" />
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg group-hover:text-slate-900 transition-colors">{project.name}</h3>
                <p className="text-sm text-slate-600 mb-4">{project.consultantCount} استشاري</p>
                <div className="flex gap-2">
                  {project.evaluatorStatus?.map((e: any) => (
                    <div key={e.name} className="flex items-center gap-1">
                      <span className={`w-3 h-3 rounded-full ${e.isComplete ? 'bg-green-500' : e.completed > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                      <span className="text-[11px] text-slate-500 font-medium">{e.name === 'sheikh_issa' ? 'ش.ع' : e.name === 'wael' ? 'و' : 'ع'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══ Financial Evaluation View ═══
function FinancialEvaluationView({ token, projectId, onBack }: { token: string; projectId: number; onBack: () => void }) {
  const data = trpc.commandCenter.getProjectFinancialEvaluation.useQuery({ token, projectId });
  
  if (data.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  
  const project = data.data?.project;
  const consultantsList = data.data?.consultants || [];
  const sorted = [...consultantsList].sort((a, b) => b.financialScore - a.financialScore);
  const avgFees = sorted.length > 0 ? sorted.reduce((sum, c) => sum + c.totalFees, 0) / sorted.filter(c => c.totalFees > 0).length : 0;

  const feeTypeLabel = (type: string, value: number) => {
    if (type === 'pct') return `${value}%`;
    return 'Lump Sum';
  };

  const getDevColor = (fees: number) => {
    if (fees === 0 || avgFees === 0) return 'text-slate-400';
    const dev = ((fees - avgFees) / avgFees) * 100;
    if (dev > 25) return 'text-red-600';
    if (dev > 10) return 'text-amber-600';
    if (dev < -25) return 'text-emerald-600';
    return 'text-slate-500';
  };

  const getDevPct = (fees: number) => {
    if (fees === 0 || avgFees === 0) return '—';
    const dev = ((fees - avgFees) / avgFees) * 100;
    return `${dev > 0 ? '+' : ''}${dev.toFixed(1)}%`;
  };

  return (
    <div dir="ltr" className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-bold text-slate-900">Financial Evaluation</h2>
        <span className="text-sm text-slate-500">— {project?.name}</span>
      </div>
      
      {/* Project Metrics - compact */}
      {project && (
        <div className="flex gap-6 px-1 text-sm">
          <div><span className="text-slate-500">BUA:</span> <span className="font-semibold text-slate-800">{project.bua?.toLocaleString()} sqft</span></div>
          <div><span className="text-slate-500">Price/sqft:</span> <span className="font-semibold text-slate-800">{project.pricePerSqft?.toLocaleString()} AED</span></div>
          <div><span className="text-slate-500">Construction Cost:</span> <span className="font-semibold text-slate-800">{project.constructionCost?.toLocaleString()} AED</span></div>
        </div>
      )}

      {/* Table Layout */}
      <div className="bg-white rounded-xl border border-slate-200 w-full">
        <table className="w-full" style={{tableLayout:'fixed'}}>
          <thead>
            {/* Group header row */}
            <tr className="bg-slate-100 border-b border-slate-200 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-2 px-3 text-left" rowSpan={2} style={{width:'22%'}}>CONSULTANT</th>
              <th className="py-2 px-2 bg-blue-50 text-blue-700 border-x border-blue-200" colSpan={3}>DESIGN</th>
              <th className="py-2 px-2 bg-teal-50 text-teal-700 border-x border-teal-200" colSpan={3}>SUPERVISION</th>
              <th className="py-2 px-2 bg-amber-50 text-amber-700 border-x-2 border-amber-300" rowSpan={2} style={{width:'10%'}}>TOTAL (AED)</th>
              <th className="py-2 px-2" rowSpan={2} style={{width:'7%'}}>VS AVG</th>
              <th className="py-2 px-2" rowSpan={2} style={{width:'7%'}}>SCORE</th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider">
              <th className="py-2 px-2 text-right text-blue-600 bg-blue-50" style={{width:'9%'}}>أتعاب</th>
              <th className="py-2 px-2 text-right text-orange-500 bg-orange-50" style={{width:'9%'}}>فجوة</th>
              <th className="py-2 px-2 text-right text-blue-800 bg-blue-100" style={{width:'9%'}}>مجموع</th>
              <th className="py-2 px-2 text-right text-teal-600 bg-teal-50" style={{width:'9%'}}>أتعاب</th>
              <th className="py-2 px-2 text-right text-purple-500 bg-purple-50" style={{width:'9%'}}>فجوة</th>
              <th className="py-2 px-2 text-right text-teal-800 bg-teal-100" style={{width:'9%'}}>مجموع</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const designGap = Number(c.designScopeGapCost) || 0;
              const supervisionGap = Number(c.supervisionScopeGapCost) || 0;
              const designTotal = (c.designAmount || 0) + designGap;
              const supervisionTotal = (c.supervisionAmount || 0) + supervisionGap;
              return (
              <tr key={c.id} className={`border-b border-slate-100 transition-colors ${
                i === 0 ? 'bg-emerald-50/70' : 'hover:bg-slate-50/50'
              }`}>
                {/* Rank + Name */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-emerald-600 text-white' : i === 1 ? 'bg-slate-700 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>{i + 1}</span>
                    <div>
                      <p className="font-semibold text-slate-900 text-[13px] leading-tight">{c.name}</p>
                      {i === 0 && <p className="text-[10px] text-emerald-600 font-medium">Best Offer</p>}
                    </div>
                  </div>
                </td>
                {/* Design fees */}
                <td className="py-2 px-2 text-right bg-blue-50/40">
                  <p className="text-[12px] font-semibold text-slate-800">{c.designAmount?.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">{feeTypeLabel(c.designType, c.designValue)}</p>
                </td>
                {/* Design Gap */}
                <td className="py-2 px-2 text-right bg-orange-50/40">
                  {designGap > 0
                    ? <p className="text-[12px] font-semibold text-orange-600">+{designGap.toLocaleString()}</p>
                    : <p className="text-[11px] text-slate-300">—</p>}
                </td>
                {/* Design Total */}
                <td className="py-2 px-2 text-right bg-blue-100/60">
                  <p className="text-[12px] font-bold text-blue-800">{designTotal.toLocaleString()}</p>
                </td>
                {/* Supervision fees */}
                <td className="py-2 px-2 text-right bg-teal-50/40">
                  <p className="text-[12px] font-semibold text-slate-800">{c.supervisionAmount?.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">{feeTypeLabel(c.supervisionType, c.supervisionValue)}</p>
                </td>
                {/* Supervision Gap */}
                <td className="py-2 px-2 text-right bg-purple-50/40">
                  {supervisionGap > 0
                    ? <p className="text-[12px] font-semibold text-purple-600">+{supervisionGap.toLocaleString()}</p>
                    : <p className="text-[11px] text-slate-300">—</p>}
                </td>
                {/* Supervision Total */}
                <td className="py-2 px-2 text-right bg-teal-100/60">
                  <p className="text-[12px] font-bold text-teal-800">{supervisionTotal.toLocaleString()}</p>
                </td>
                {/* Grand Total */}
                <td className="py-2 px-3 text-right bg-amber-50 border-x-2 border-amber-200">
                  <p className="text-[13px] font-bold text-amber-900">{c.totalFees?.toLocaleString()}</p>
                </td>
                {/* vs Avg */}
                <td className="py-2 px-3 text-center">
                  <span className={`text-xs font-semibold ${getDevColor(c.totalFees)}`}>{getDevPct(c.totalFees)}</span>
                </td>
                {/* Score */}
                <td className="py-2 px-3 text-center">
                  <span className={`text-base font-black ${
                    i === 0 ? 'text-emerald-600' : c.financialScore >= 80 ? 'text-slate-800' : c.financialScore >= 60 ? 'text-amber-600' : 'text-slate-400'
                  }`}>{c.financialScore}%</span>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td className="py-2 px-3 text-[11px] font-semibold text-slate-600">Average</td>
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-3 text-right text-[13px] font-bold text-slate-700">{avgFees > 0 ? `${Math.round(avgFees).toLocaleString()}` : '—'}</td>
              <td className="py-2 px-3" />
              <td className="py-2 px-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[10px] text-slate-500 px-1">
        <span>Score = Lowest ÷ Fee × 100</span>
        <span className="text-emerald-600 font-medium">● &gt;25% below avg</span>
        <span className="text-amber-600 font-medium">● 10–25% above</span>
        <span className="text-red-600 font-medium">● &gt;25% above</span>
      </div>
    </div>
  );
}

// ═══ Technical Evaluation View (Wizard - 3 Fixed Columns) ═══
function TechnicalEvaluationView({ token, projectId, memberId, onBack }: { token: string; projectId: number; memberId: string; onBack: () => void }) {
  const data = trpc.commandCenter.getProjectTechnicalEvaluation.useQuery({ token, projectId });
  const submitScore = trpc.commandCenter.submitTechnicalScore.useMutation();
  const utils = trpc.useUtils();
  const [currentStep, setCurrentStep] = useState(0);

  // Click sound effect using Web Audio API
  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05); // quick rise
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch { /* silent fallback */ }
  };

  const approveMutation = trpc.commandCenter.approveTechnicalEvaluation.useMutation({
    onSuccess: () => {
      toast.success('تم اعتماد التقييم بنجاح. لا يمكن تعديله بعد الآن.');
      utils.commandCenter.getProjectTechnicalEvaluation.invalidate({ token, projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (data.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  const evalData = data.data;
  if (!evalData) return <div className="text-center py-12 text-slate-400">لا توجد بيانات</div>;

  const { project, consultants: consultantsList, evaluatorStatus, allComplete, myEvaluatorName, myStatus, isMyEvaluationApproved, allApprovals } = evalData;

  const handleScore = async (consultantId: number, criterionId: number, score: number) => {
    if (isMyEvaluationApproved) {
      toast.error('التقييم معتمد ولا يمكن تعديله');
      return;
    }
    playClickSound();
    await submitScore.mutateAsync({ token, projectId, consultantId, criterionId, score });
    utils.commandCenter.getProjectTechnicalEvaluation.invalidate({ token, projectId });
  };

  const getScoreLabel = (score: number) => {
    if (score >= 93) return { label: 'ممتاز', color: 'text-violet-700 bg-violet-50' };
    if (score >= 88) return { label: 'جيد جداً', color: 'text-blue-700 bg-blue-50' };
    if (score >= 82) return { label: 'جيد', color: 'text-sky-700 bg-sky-50' };
    if (score >= 74) return { label: 'مقبول', color: 'text-amber-700 bg-amber-50' };
    if (score >= 60) return { label: 'ضعيف', color: 'text-orange-700 bg-orange-50' };
    return { label: 'غير مقبول', color: 'text-red-700 bg-red-50' };
  };

  // Each score gets its own unique color (NO GREEN)
  const SCORE_COLORS: Record<number, { normal: string; selected: string }> = {
    95: { normal: 'border-violet-300 text-violet-600 bg-violet-50 hover:bg-violet-100', selected: 'bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-200 scale-110' },
    93: { normal: 'border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100', selected: 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-200 scale-110' },
    92: { normal: 'border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100', selected: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200 scale-110' },
    91: { normal: 'border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100', selected: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200 scale-110' },
    90: { normal: 'border-sky-300 text-sky-600 bg-sky-50 hover:bg-sky-100', selected: 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-200 scale-110' },
    89: { normal: 'border-sky-300 text-sky-600 bg-sky-50 hover:bg-sky-100', selected: 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-200 scale-110' },
    87: { normal: 'border-cyan-300 text-cyan-600 bg-cyan-50 hover:bg-cyan-100', selected: 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-200 scale-110' },
    86: { normal: 'border-cyan-300 text-cyan-600 bg-cyan-50 hover:bg-cyan-100', selected: 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-200 scale-110' },
    85: { normal: 'border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100', selected: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200 scale-110' },
    84: { normal: 'border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100', selected: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200 scale-110' },
    82: { normal: 'border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100', selected: 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200 scale-110' },
    80: { normal: 'border-rose-300 text-rose-500 bg-rose-50 hover:bg-rose-100', selected: 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200 scale-110' },
    76: { normal: 'border-rose-300 text-rose-500 bg-rose-50 hover:bg-rose-100', selected: 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200 scale-110' },
    74: { normal: 'border-pink-300 text-pink-500 bg-pink-50 hover:bg-pink-100', selected: 'bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200 scale-110' },
    72: { normal: 'border-pink-300 text-pink-500 bg-pink-50 hover:bg-pink-100', selected: 'bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200 scale-110' },
    70: { normal: 'border-red-300 text-red-500 bg-red-50 hover:bg-red-100', selected: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-200 scale-110' },
    68: { normal: 'border-red-300 text-red-500 bg-red-50 hover:bg-red-100', selected: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-200 scale-110' },
    60: { normal: 'border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100', selected: 'bg-slate-600 text-white border-slate-600 shadow-lg shadow-slate-200 scale-110' },
    58: { normal: 'border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100', selected: 'bg-slate-600 text-white border-slate-600 shadow-lg shadow-slate-200 scale-110' },
    55: { normal: 'border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100', selected: 'bg-slate-600 text-white border-slate-600 shadow-lg shadow-slate-200 scale-110' },
    52: { normal: 'border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100', selected: 'bg-slate-600 text-white border-slate-600 shadow-lg shadow-slate-200 scale-110' },
    50: { normal: 'border-slate-400 text-slate-500 bg-slate-100 hover:bg-slate-200', selected: 'bg-slate-700 text-white border-slate-700 shadow-lg shadow-slate-300 scale-110' },
    45: { normal: 'border-slate-400 text-slate-500 bg-slate-100 hover:bg-slate-200', selected: 'bg-slate-700 text-white border-slate-700 shadow-lg shadow-slate-300 scale-110' },
  };

  const getScoreButtonColor = (score: number, isSelected: boolean) => {
    const colors = SCORE_COLORS[score] || { normal: 'border-slate-300 text-slate-500 bg-white hover:bg-slate-50', selected: 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-200 scale-110' };
    return isSelected ? colors.selected : colors.normal;
  };

  const sortedCriteria = [...CRITERIA].sort((a, b) => b.weight - a.weight);
  const totalSteps = sortedCriteria.length;
  const isResultsPage = currentStep >= totalSteps;
  const criterion = !isResultsPage ? sortedCriteria[currentStep] : null;

  const getCompletedCount = () => {
    let count = 0;
    sortedCriteria.forEach((crit) => {
      const allScored = consultantsList?.every((c: any) => c.myScores?.find((s: any) => s.criterionId === crit.id)?.score > 0);
      if (allScored) count++;
    });
    return count;
  };

  const computeTotals = () => {
    if (!allComplete || !evalData.allEvaluatorData) return [];
    return (consultantsList?.map((consultant: any) => {
      let totalWeighted = 0;
      CRITERIA.forEach((crit) => {
        const scores = evalData.allEvaluatorData.map((ev: any) => {
          const s = ev.scores.find((s: any) => s.consultantId === consultant.id && s.criterionId === crit.id);
          return s?.score || 0;
        });
        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        totalWeighted += (avg * crit.weight) / 100;
      });
      return { id: consultant.id, name: consultant.name, total: totalWeighted };
    }) || []).sort((a, b) => b.total - a.total);
  };

  const sortedTotals = computeTotals();
  const completedCount = getCompletedCount();

  // Step header colors (no green)
  const STEP_HEADER_COLORS = [
    'bg-gradient-to-l from-indigo-600 to-indigo-700',
    'bg-gradient-to-l from-violet-600 to-violet-700',
    'bg-gradient-to-l from-blue-600 to-blue-700',
    'bg-gradient-to-l from-rose-600 to-rose-700',
    'bg-gradient-to-l from-amber-600 to-amber-700',
    'bg-gradient-to-l from-cyan-600 to-cyan-700',
    'bg-gradient-to-l from-pink-600 to-pink-700',
    'bg-gradient-to-l from-orange-600 to-orange-700',
    'bg-gradient-to-l from-sky-600 to-sky-700',
  ];
  const stepHeaderColor = STEP_HEADER_COLORS[currentStep % STEP_HEADER_COLORS.length];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
            <ArrowRight className="w-4 h-4 ml-1" /> العودة
          </Button>
          <h2 className="text-lg font-bold text-slate-800">التقييم الفني — {project?.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {evaluatorStatus?.map((e: any) => (
            <div key={e.name} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${e.isComplete ? 'bg-violet-500' : e.completed > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
              <span className="text-[11px] text-slate-500">{e.nameAr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600">التقدم: {completedCount} / {totalSteps} معايير</span>
          <span className="text-xs text-slate-400">المعيار {Math.min(currentStep + 1, totalSteps)} من {totalSteps}</span>
        </div>
        <div className="flex gap-1">
          {sortedCriteria.map((_, i) => {
            const allScored = consultantsList?.every((c: any) => c.myScores?.find((s: any) => s.criterionId === sortedCriteria[i].id)?.score > 0);
            return (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2.5 flex-1 rounded-full transition-all cursor-pointer ${
                  i === currentStep ? 'bg-indigo-600 scale-y-125' : allScored ? 'bg-violet-400' : 'bg-slate-200 hover:bg-slate-300'
                }`}
              />
            );
          })}
        </div>
      </div>

      {myStatus?.isComplete && !allComplete && (
        <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-violet-500 mx-auto mb-1" />
          <p className="font-semibold text-violet-800 text-sm">تم إكمال تقييمك الفني</p>
          <p className="text-xs text-violet-600 mt-0.5">في انتظار اكتمال تقييم باقي الأعضاء</p>
        </div>
      )}

      {/* ═══ SINGLE CRITERION PAGE ═══ */}
      {!isResultsPage && criterion && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* Criterion Title */}
          <div className={`${stepHeaderColor} text-white px-5 py-3.5 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base font-bold">{currentStep + 1}</span>
              <div>
                <h3 className="font-bold text-base">{criterion.name}</h3>
                <p className="text-white/70 text-xs">الوزن: {criterion.weight}%</p>
              </div>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[220px_1fr_250px] border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="text-xs font-bold text-slate-500 text-right">معنى النسبة</div>
            <div className="text-xs font-bold text-slate-500 text-center">النسبة</div>
            <div className="text-xs font-bold text-slate-500 text-left">الاستشاري</div>
          </div>

          {/* Consultant Rows - 3 FIXED COLUMNS */}
          <div className="divide-y divide-slate-100">
            {consultantsList?.map((consultant: any) => {
              const myScore = consultant.myScores?.find((s: any) => s.criterionId === criterion.id);
              const selectedLabel = myScore?.score ? criterion.options.find(o => o.score === myScore.score)?.label : null;

              let avgScore = 0;
              let evaluatorScores: { name: string; score: number }[] = [];
              if (allComplete && evalData.allEvaluatorData) {
                evaluatorScores = evalData.allEvaluatorData.map((ev: any) => {
                  const s = ev.scores.find((s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id);
                  return { name: ev.nameAr, score: s?.score || 0 };
                });
                avgScore = evaluatorScores.reduce((sum, e) => sum + e.score, 0) / evaluatorScores.length;
              }
              const scoreInfo = getScoreLabel(avgScore);

              return (
                <div key={consultant.id} className="grid grid-cols-[220px_1fr_250px] items-center px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {/* COL 1 (RIGHT in RTL): Meaning of selected score */}
                  <div className="text-right pr-2 overflow-hidden">
                    {!myStatus?.isComplete && (
                      selectedLabel ? (
                        <span className="text-xs font-medium text-indigo-700 leading-tight block">{selectedLabel}</span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">اختر التقييم</span>
                      )
                    )}
                    {allComplete && (
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${scoreInfo.color}`}>{avgScore.toFixed(0)}</span>
                        {evaluatorScores.map((ev) => (
                          <span key={ev.name} className="text-[10px] text-slate-400">{ev.name}: {ev.score}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* COL 2 (CENTER): Score buttons - each with unique color + tooltip */}
                  <div className="flex items-center gap-1.5 justify-center" dir="ltr">
                    {!myStatus?.isComplete && criterion.options.map((opt) => (
                      <Tooltip key={opt.score}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleScore(consultant.id, criterion.id, opt.score)}
                            className={`text-xs w-10 h-10 rounded-full border-2 transition-all font-bold ${
                              getScoreButtonColor(opt.score, myScore?.score === opt.score)
                            }`}
                          >
                            {opt.score}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-center text-[11px] leading-snug">
                          {opt.label}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {myStatus?.isComplete && !allComplete && (
                      <span className="text-sm font-bold text-indigo-600">{myScore?.score || '—'}</span>
                    )}
                  </div>

                  {/* COL 3 (LEFT in RTL): Consultant Name */}
                  <div className="flex items-center gap-2.5 justify-end pl-2">
                    <span className="text-sm font-bold text-slate-800 text-left">{consultant.name}</span>
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {consultant.name?.charAt(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ArrowRight className="w-4 h-4" /> السابق
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.success('تم حفظ التقييم كمسودة — يمكنك العودة لإكماله لاحقاً', { duration: 3000 });
                  onBack();
                }}
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Clock className="w-3.5 h-3.5" /> حفظ كمسودة
              </Button>
              <span className="text-xs text-slate-500 font-medium">{currentStep + 1} / {totalSteps}</span>
            </div>

            <Button
              size="sm"
              onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
              className={`gap-1 ${stepHeaderColor} text-white hover:opacity-90`}
            >
              {currentStep < totalSteps - 1 ? 'التالي' : 'عرض النتائج'} <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ RESULTS PAGE ═══ */}
      {isResultsPage && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-l from-indigo-700 to-violet-700 text-white px-5 py-3">
              <h3 className="font-bold text-base">ملخص التقييم</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-right py-2 text-slate-600 font-semibold">المعيار</th>
                    <th className="text-center py-2 text-slate-400 text-xs">الوزن</th>
                    {consultantsList?.map((c: any) => (
                      <th key={c.id} className="text-center py-2 text-slate-600 font-semibold text-xs">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCriteria.map((crit, i) => (
                    <tr key={crit.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-2 text-slate-700 text-xs font-medium">
                        <button onClick={() => setCurrentStep(i)} className="hover:text-indigo-600 hover:underline cursor-pointer">
                          {crit.name}
                        </button>
                      </td>
                      <td className="text-center py-2 text-slate-400 text-xs">{crit.weight}%</td>
                      {consultantsList?.map((c: any) => {
                        const score = c.myScores?.find((s: any) => s.criterionId === crit.id)?.score;
                        const sInfo = score ? getScoreLabel(score) : null;
                        return (
                          <td key={c.id} className="text-center py-2">
                            {score ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${sInfo?.color}`}>{score}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {allComplete && sortedTotals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white px-5 py-3 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                <h3 className="font-bold text-base">الترتيب الفني النهائي</h3>
              </div>
              <div className="p-4 space-y-3">
                {sortedTotals.map((c, i) => {
                  const scoreInfo = getScoreLabel(c.total);
                  const barWidth = sortedTotals[0].total > 0 ? (c.total / sortedTotals[0].total) * 100 : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>{i + 1}</span>
                      <span className="text-sm font-bold text-slate-800 min-w-[160px]">{c.name}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            i === 0 ? 'bg-gradient-to-l from-violet-400 to-indigo-600' : i === 1 ? 'bg-gradient-to-l from-blue-400 to-blue-600' : i === 2 ? 'bg-gradient-to-l from-sky-400 to-sky-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-base font-black text-slate-800 min-w-[50px] text-center">{c.total.toFixed(1)}</span>
                      <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allComplete && evalData.allEvaluatorData && (
            <details className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <summary className="p-4 text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-50 rounded-2xl">تفاصيل تقييم كل عضو على حدة</summary>
              <div className="p-4 pt-0 space-y-3">
                {consultantsList?.map((consultant: any) => {
                  // Build per-evaluator weighted totals alongside the average
                  const evalWeightedTotals: number[] = evalData.allEvaluatorData.map(() => 0);
                  let totalWeightedAvg = 0;
                  const criteriaRows = CRITERIA.map((crit) => {
                    const scores: number[] = evalData.allEvaluatorData.map((ev: any) => {
                      const s = ev.scores.find((s: any) => s.consultantId === consultant.id && s.criterionId === crit.id);
                      return s?.score || 0;
                    });
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    scores.forEach((sc, si) => { evalWeightedTotals[si] += (sc * crit.weight) / 100; });
                    totalWeightedAvg += (avg * crit.weight) / 100;
                    return { crit, scores, avg };
                  });
                  return (
                    <div key={consultant.id} className="border border-slate-100 rounded-xl p-3">
                      <h5 className="text-sm font-bold text-slate-700 mb-2">{consultant.name}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-right py-1.5 text-slate-500 font-medium">المعيار</th>
                              <th className="text-center py-1.5 text-slate-400">الوزن</th>
                              {evalData.allEvaluatorData.map((ev: any) => (
                                <th key={ev.evaluatorName} className="text-center py-1.5 text-slate-500">{ev.nameAr}</th>
                              ))}
                              <th className="text-center py-1.5 text-slate-700 font-semibold">المتوسط</th>
                            </tr>
                          </thead>
                          <tbody>
                            {criteriaRows.map(({ crit, scores, avg }) => (
                              <tr key={crit.id} className="border-b border-slate-50">
                                <td className="py-1 text-slate-600">{crit.name}</td>
                                <td className="text-center py-1 text-slate-400">{crit.weight}%</td>
                                {scores.map((s, si) => (
                                  <td key={si} className="text-center py-1 font-medium text-slate-600">{s}</td>
                                ))}
                                <td className="text-center py-1 font-semibold text-slate-700">{avg.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                              <td className="py-2 pr-1 font-bold text-slate-700 text-right">المجموع المرجح</td>
                              <td className="text-center py-2 text-slate-400 text-[10px]">100%</td>
                              {evalWeightedTotals.map((wt, wi) => (
                                <td key={wi} className="text-center py-2 font-bold text-indigo-700">{wt.toFixed(2)}</td>
                              ))}
                              <td className="text-center py-2 font-bold text-slate-800 bg-indigo-100">{totalWeightedAvg.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Approval Status Banner */}
          {isMyEvaluationApproved && (
            <div className="bg-gradient-to-l from-violet-500 to-indigo-600 rounded-2xl p-4 flex items-center gap-3 text-white shadow-lg">
              <ShieldCheck className="w-7 h-7" />
              <div>
                <p className="font-bold text-base">تم اعتماد تقييمك</p>
                <p className="text-sm text-white/80">التقييم مقفل ولا يمكن تعديله</p>
              </div>
            </div>
          )}

          {/* Approval Status for All Evaluators */}
          {allApprovals && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /> حالة اعتماد المقيّمين</h4>
              <div className="flex gap-3">
                {allApprovals.map((ap: any) => (
                  <div key={ap.name} className={`flex-1 rounded-xl p-3 text-center border ${
                    ap.isApproved ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <p className="text-xs font-medium text-slate-600">{ap.name === 'sheikh_issa' ? 'الشيخ عيسى' : ap.name === 'wael' ? 'وائل' : 'عبدالرحمن'}</p>
                    {ap.isApproved ? (
                      <span className="text-xs font-bold text-violet-600 flex items-center justify-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> معتمد</span>
                    ) : (
                      <span className="text-xs text-slate-400 mt-1 block">مسودة</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)} className="gap-1">
              <ArrowRight className="w-4 h-4" /> العودة للمعايير
            </Button>

            {!isMyEvaluationApproved && myStatus?.isComplete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="gap-1 bg-gradient-to-l from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white">
                    <ShieldCheck className="w-4 h-4" /> اعتماد التقييم
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="w-5 h-5" /> تحذير: اعتماد التقييم
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-right text-slate-600 leading-relaxed">
                      <span className="block mb-2 font-semibold text-red-600">هذا الإجراء لا يمكن التراجع عنه!</span>
                      بعد الاعتماد لن تتمكن من تعديل أي درجة في التقييم الفني لهذا المشروع. تأكد من مراجعة جميع الدرجات قبل المتابعة.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex gap-2 sm:justify-start">
                    <AlertDialogCancel>حفظ كمسودة</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => approveMutation.mutate({ token, projectId })}
                      className="bg-gradient-to-l from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <ShieldCheck className="w-4 h-4 ml-1" />}
                      أوافق - اعتمد التقييم
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Value Analysis View ═══
function ValueAnalysisView({ token, projectId, onBack }: { token: string; projectId: number; onBack: () => void }) {
  const report = trpc.commandCenter.getComprehensiveReport.useQuery({ token, projectId });
  const financialData = trpc.commandCenter.getProjectFinancialEvaluation.useQuery({ token, projectId });
  const [technicalWeight, setTechnicalWeight] = useState(80);
  const financialWeight = 100 - technicalWeight;

  if (report.isLoading || financialData.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

  const reportData = report.data;
  const finData = financialData.data;
  if (!reportData?.isReady) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500"><ArrowLeft className="w-4 h-4 ml-1" /> العودة</Button>
          <SlidersHorizontal className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-800">تحليل القيمة</h2>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-amber-800">تحليل القيمة غير متاح</p>
          <p className="text-sm text-amber-600 mt-1">يجب اكتمال التقييم الفني والمالي أولاً</p>
        </div>
      </div>
    );
  }

  const results = reportData.results || [];
  const consultantsFin = finData?.consultants || [];
  const feesArr = consultantsFin.filter((c: any) => c.totalFees > 0).map((c: any) => c.totalFees);
  const avgFee = feesArr.length > 0 ? feesArr.reduce((a: number, b: number) => a + b, 0) / feesArr.length : 0;
  const lowestFee = feesArr.length > 0 ? Math.min(...feesArr) : 1;

  // Compute value analysis
  const valueResults = results.map((r: any) => {
    const fin = consultantsFin.find((c: any) => c.id === r.id);
    const totalFees = fin?.totalFees || 0;
    const deviation = avgFee > 0 ? ((totalFees - avgFee) / avgFee) * 100 : 0;
    let zone = 'النطاق الطبيعي';
    let zoneColor = 'text-green-700 bg-green-50';
    let penalty = 0;
    if (deviation > 30) { zone = 'انحراف مرتفع جداً'; zoneColor = 'text-red-700 bg-red-50'; penalty = 15; }
    else if (deviation > 15) { zone = 'انحراف مرتفع معتدل'; zoneColor = 'text-amber-700 bg-amber-50'; penalty = 7; }
    else if (deviation < -30) { zone = 'انحراف منخفض جداً'; zoneColor = 'text-blue-700 bg-blue-50'; }
    const financialScore = totalFees > 0 ? (lowestFee / totalFees) * 100 : 0;
    const adjustedFinancialScore = Math.max(0, financialScore - penalty);
    const valueScore = (r.technicalScore * technicalWeight / 100) + (adjustedFinancialScore * financialWeight / 100);
    return { ...r, totalFees, deviation: Math.round(deviation * 10) / 10, zone, zoneColor, penalty, financialScore: Math.round(financialScore * 10) / 10, adjustedFinancialScore: Math.round(adjustedFinancialScore * 10) / 10, valueScore: Math.round(valueScore * 10) / 10 };
  }).sort((a: any, b: any) => b.valueScore - a.valueScore);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500"><ArrowLeft className="w-4 h-4 ml-1" /> العودة</Button>
        <SlidersHorizontal className="w-5 h-5 text-amber-600" />
        <h2 className="text-lg font-bold text-slate-800">تحليل القيمة - {reportData.project?.name}</h2>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <p className="text-sm text-amber-800"><span className="font-bold">تنبيه:</span> تحليل القيمة هو <span className="font-bold">مرجع استرشادي فقط</span> ولا يُلزم اللجنة باتخاذ أي قرار بناءً عليه.</p>
      </div>

      {/* Weight Sliders */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-amber-600" /> أوزان تحليل القيمة</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-700 font-medium">الفني: {technicalWeight}%</span>
              <span className="text-emerald-700 font-medium">المالي: {financialWeight}%</span>
            </div>
            <input type="range" min={10} max={90} value={technicalWeight} onChange={e => setTechnicalWeight(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
        </div>
      </div>

      {/* Value Rankings Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-600" /> ترتيب القيمة</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-amber-200 bg-amber-50">
                <th className="text-right py-3 px-2 text-amber-800">#</th>
                <th className="text-right py-3 px-2 text-amber-800">الاستشاري</th>
                <th className="text-center py-3 px-2 text-blue-800">الفني</th>
                <th className="text-center py-3 px-2 text-emerald-800">المالي</th>
                <th className="text-center py-3 px-2 text-red-800">الخصم</th>
                <th className="text-center py-3 px-2 text-emerald-800">المالي المعدل</th>
                <th className="text-center py-3 px-2 text-amber-800">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {valueResults.map((r: any, idx: number) => (
                <tr key={r.id} className={`border-b border-slate-100 ${idx === 0 ? 'bg-green-50' : ''}`}>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1">
                      {idx === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                      <span className={`font-bold ${idx === 0 ? 'text-green-700' : 'text-slate-600'}`}>#{idx + 1}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium text-slate-800">{r.name}</td>
                  <td className="text-center py-3 px-2 text-blue-700 font-medium">{r.technicalScore}</td>
                  <td className="text-center py-3 px-2 text-emerald-700">{r.financialScore}%</td>
                  <td className="text-center py-3 px-2 text-red-600">{r.penalty > 0 ? `-${r.penalty}` : '-'}</td>
                  <td className="text-center py-3 px-2 text-emerald-700 font-medium">{r.adjustedFinancialScore}%</td>
                  <td className="text-center py-3 px-2"><span className={`font-bold text-lg ${idx === 0 ? 'text-green-700' : 'text-slate-700'}`}>{r.valueScore}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fee Deviation Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-amber-600" /> تحليل انحراف الأتعاب</h3>
        <p className="text-sm text-slate-500 mb-3">متوسط الأتعاب: <span className="font-bold text-slate-800">{Math.round(avgFee).toLocaleString()} د.إ</span></p>
        <div className="space-y-2">
          {valueResults.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <span className="font-medium text-slate-700">{r.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{r.totalFees?.toLocaleString()} د.إ</span>
                <Badge className={`${r.zoneColor} border-0 text-xs`}>
                  {r.deviation > 0 ? '+' : ''}{r.deviation}% • {r.zone}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {valueResults.length >= 2 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
          <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> ملخص تنفيذي</h3>
          <div className="space-y-2 text-sm text-indigo-700">
            <p>الأفضل قيمة: <span className="font-bold">{valueResults[0].name}</span> بنتيجة {valueResults[0].valueScore}</p>
            {valueResults[0].name !== results.sort((a: any, b: any) => b.technicalScore - a.technicalScore)[0]?.name && (
              <p>الأعلى فنياً: <span className="font-bold">{results.sort((a: any, b: any) => b.technicalScore - a.technicalScore)[0]?.name}</span> — الميزة المالية لـ {valueResults[0].name} تعوض الفارق الفني</p>
            )}
            {valueResults.length > 1 && <p>الفارق بين الأول والثاني: <span className="font-bold">{(valueResults[0].valueScore - valueResults[1].valueScore).toFixed(1)} نقطة</span></p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Design Scope Report View ═══
function DesignScopeReportView({ token, projectId, onBack }: { token: string; projectId: number; onBack: () => void }) {
  const { data, isLoading, error } = trpc.commandCenter.getDesignScopeReport.useQuery({ token, projectId });
  const [showGapsOnly, setShowGapsOnly] = useState(false);

  // Format number compactly: 125,000 → 125K
  const fmtK = (n: number) => {
    if (n === 0) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(Math.round(n));
  };
  const fmtFull = (n: number) => n > 0 ? n.toLocaleString('ar-AE', { maximumFractionDigits: 0 }) : '—';

  // Abbreviate consultant name: take first letter of each word, max 6 chars
  const shortName = (name: string) => {
    const cleaned = name.trim()
      .replace(/\b(Architectural|Engineering|Consultants?|Consulting|&|and|of|the|for|LLC|Co\.|Ltd\.?)\b/gi, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return name.slice(0, 6);
    // If single word, take first 6 chars
    if (words.length === 1) return words[0].slice(0, 8);
    // If 2 words, show both shortened
    if (words.length === 2) return words.map(w => w.slice(0, 5)).join(' ');
    // 3+ words: initials
    return words.map(w => w[0].toUpperCase()).join('');
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
  if (error) return <div className="p-6 text-center text-red-500">{error.message}</div>;

  const scopeItems = data?.scopeItems || [];
  const consultants = data?.consultants || [];
  const itemGaps = data?.itemGaps || {};       // consultantId -> scopeItemId -> gapCost (null=included)
  const coverageStatus = data?.coverageStatus || {}; // consultantId -> scopeItemId -> status
  const designFees = data?.designFees || {};
  const designGaps = data?.designGaps || {};

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Button>
        <h2 className="text-xl font-bold text-slate-800">تقرير نطاق التصاميم</h2>
        {scopeItems.length > 0 && <span className="text-sm text-slate-500">({scopeItems.length} بند)</span>}
        <div className="mr-auto">
          <Button
            size="sm"
            variant={showGapsOnly ? 'default' : 'outline'}
            onClick={() => setShowGapsOnly(v => !v)}
            className={showGapsOnly ? 'bg-red-600 hover:bg-red-700 text-white border-0' : 'border-red-300 text-red-600 hover:bg-red-50'}
          >
            {showGapsOnly ? '⚠ الفجوات فقط' : '⚠ إظهار الفجوات فقط'}
          </Button>
        </div>
      </div>

      {consultants.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد استشاريون مرتبطون بهذا المشروع</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ direction: 'rtl', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '180px' }} />
                {consultants.map((c: any) => <col key={c.id} style={{ width: '68px' }} />)}
              </colgroup>
              <thead>
                <tr className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white">
                  <th className="px-2 py-2 text-right font-semibold sticky right-0 bg-indigo-600 z-10 border-l border-indigo-400">نطاق التصاميم</th>
                  {consultants.map((c: any) => (
                    <th key={c.id} className="px-1 py-2 text-center font-bold leading-tight border-r border-indigo-400" title={c.name}>
                      <div className="truncate text-[10px]">{shortName(c.name)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopeItems.filter((item: any) => {
                  if (!showGapsOnly) return true;
                  // Show item only if at least one consultant does NOT include it
                  return consultants.some((c: any) => {
                    const gapVal = (itemGaps as any)[c.id]?.[item.id];
                    const status = (coverageStatus as any)[c.id]?.[item.id] || 'NOT_MENTIONED';
                    return !(gapVal === null || status === 'INCLUDED');
                  });
                }).map((item: any, idx: number) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    <td className="px-2 py-1 text-right font-medium text-slate-700 sticky right-0 bg-inherit border-l border-slate-300 border-b border-b-slate-200 truncate" title={item.label}>
                      <span className="text-slate-400 ml-1 text-[10px]">{item.itemNumber}.</span>
                      {item.label}
                    </td>
                    {consultants.map((c: any) => {
                      const gapVal = (itemGaps as any)[c.id]?.[item.id];
                      const status = (coverageStatus as any)[c.id]?.[item.id] || 'NOT_MENTIONED';
                      const isIncluded = gapVal === null || status === 'INCLUDED';
                      const gapCost = typeof gapVal === 'number' ? gapVal : 0;
                      return (
                        <td key={c.id} className="px-0.5 py-1 text-center border-r border-slate-300 border-b border-b-slate-200">
                          {isIncluded ? (
                            <span className="text-emerald-600 font-bold">✓</span>
                          ) : gapCost > 0 ? (
                            <span className="text-red-500 font-semibold">{fmtK(gapCost)}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr><td colSpan={consultants.length + 1} className="h-0.5 bg-indigo-400" /></tr>
                <tr className="bg-red-50 font-bold">
                  <td className="px-2 py-1.5 text-right text-red-700 sticky right-0 bg-red-50 border-l border-slate-400 border-b border-b-slate-300">فجوة النطاق</td>
                  {consultants.map((c: any) => (
                    <td key={c.id} className="px-0.5 py-1.5 text-center text-red-600 border-r border-slate-300 border-b border-b-slate-300 text-[10px]">{fmtK((designGaps as any)[c.id] || 0)}</td>
                  ))}
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td className="px-2 py-1.5 text-right text-slate-700 sticky right-0 bg-slate-100 border-l border-slate-400 border-b border-b-slate-300">أتعاب التصميم</td>
                  {consultants.map((c: any) => (
                    <td key={c.id} className="px-0.5 py-1.5 text-center text-slate-700 border-r border-slate-300 border-b border-b-slate-300 text-[10px]">{fmtK((designFees as any)[c.id] || 0)}</td>
                  ))}
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className="px-2 py-1.5 text-right text-amber-800 sticky right-0 bg-amber-50 border-l border-slate-400">المجموع الكلي</td>
                  {consultants.map((c: any) => {
                    const total = ((designFees as any)[c.id] || 0) + ((designGaps as any)[c.id] || 0);
                    return <td key={c.id} className="px-0.5 py-1.5 text-center text-amber-700 border-r border-slate-300 text-[10px] font-bold">{fmtK(total)}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 text-center">✓ = مشمول • الأرقام بالدرهم الإماراتي (K = ألف)</p>
    </div>
  );
}

// ═══ Committee Decision View (Enhanced with AI) ═══
function CommitteeDecisionView({ token, projectId, memberId, onBack }: { token: string; projectId: number; memberId: string; onBack: () => void }) {
  const report = trpc.commandCenter.getComprehensiveReport.useQuery({ token, projectId });
  const decision = trpc.commandCenter.getProjectCommitteeDecision.useQuery({ token, projectId });
  const financialData = trpc.commandCenter.getProjectFinancialEvaluation.useQuery({ token, projectId });
  const saveDecision = trpc.commandCenter.saveCommitteeDecision.useMutation();
  const confirmDecision = trpc.commandCenter.confirmDecision.useMutation();
  const recommendationMutation = trpc.committee.getRecommendation.useMutation();
  const analyzeDecisionMutation = trpc.committee.analyzeDecision.useMutation();
  const postDecisionMutation = trpc.committee.postDecisionAnalysis.useMutation();
  const utils = trpc.useUtils();
  const [selectedConsultant, setSelectedConsultant] = useState<number | null>(null);
  const [decisionType, setDecisionType] = useState('selected');
  const [decisionBasis, setDecisionBasis] = useState('best_value');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');
  const [negotiationTarget, setNegotiationTarget] = useState('');
  const [negotiationConditions, setNegotiationConditions] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [postDecisionAnalysis, setPostDecisionAnalysis] = useState('');
  const [isGettingRecommendation, setIsGettingRecommendation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPostAnalyzing, setIsPostAnalyzing] = useState(false);

  // Load existing decision data
  useEffect(() => {
    if (decision.data?.decision) {
      const d = decision.data.decision;
      if (d.selectedConsultantId) setSelectedConsultant(d.selectedConsultantId);
      if (d.decisionType) setDecisionType(d.decisionType);
      if (d.decisionBasis) setDecisionBasis(d.decisionBasis);
      if (d.justification) setJustification(d.justification);
      if (d.committeeNotes) setNotes(d.committeeNotes);
      if (d.negotiationTarget) setNegotiationTarget(d.negotiationTarget);
      if (d.negotiationConditions) setNegotiationConditions(d.negotiationConditions);
      if (d.aiRecommendation) setAiRecommendation(d.aiRecommendation);
      if (d.aiAnalysis) setAiAnalysis(d.aiAnalysis);
      if (d.aiPostDecisionAnalysis) setPostDecisionAnalysis(d.aiPostDecisionAnalysis);
    }
  }, [decision.data]);

  if (report.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

  const reportData = report.data;
  const decisionData = decision.data;
  const consultantsFin = financialData.data?.consultants || [];
  const isDecisionConfirmed = decisionData?.decision?.isConfirmed === 1;

  // Build rankings for AI
  const rankings = (reportData?.results || []).map((r: any, i: number) => {
    const fin = consultantsFin.find((c: any) => c.id === r.id);
    return { id: r.id, name: r.name, rank: i + 1, technicalScore: r.technicalScore, totalFee: fin?.totalFees || 0, feeDeviation: 0, feeZone: 'normal' };
  });

  const handleGetRecommendation = async () => {
    if (!reportData?.project) return;
    setIsGettingRecommendation(true);
    try {
      const result = await recommendationMutation.mutateAsync({
        projectName: reportData.project.name,
        projectBua: financialData.data?.project?.bua || 0,
        projectPricePerSqft: financialData.data?.project?.pricePerSqft || 0,
        consultants: rankings.map((r: any) => ({ name: r.name, technicalScore: r.technicalScore, totalFee: r.totalFee, feeDeviation: r.feeDeviation, feeZone: r.feeZone })),
      });
      setAiRecommendation(result.recommendation);
      await saveDecision.mutateAsync({ token, projectId, selectedConsultantId: selectedConsultant || undefined, decisionType, aiRecommendation: result.recommendation });
    } catch { toast.error('فشل في الحصول على التوصية'); } finally { setIsGettingRecommendation(false); }
  };

  const handleAnalyzeDecision = async () => {
    if (!reportData?.project || !selectedConsultant) return;
    const selectedName = rankings.find((r: any) => r.id === selectedConsultant)?.name || '';
    setIsAnalyzing(true);
    try {
      const result = await analyzeDecisionMutation.mutateAsync({
        projectName: reportData.project.name,
        selectedConsultantName: selectedName,
        decisionType, decisionBasis,
        rankings: rankings.map((r: any) => ({ name: r.name, rank: r.rank, technicalScore: r.technicalScore, totalFee: r.totalFee, feeDeviation: r.feeDeviation, feeZone: r.feeZone })),
        negotiationTarget, negotiationConditions,
      });
      setAiAnalysis(result.analysis);
      await saveDecision.mutateAsync({ token, projectId, selectedConsultantId: selectedConsultant, decisionType, aiAnalysis: result.analysis });
    } catch { toast.error('فشل في التحليل'); } finally { setIsAnalyzing(false); }
  };

  const handlePostDecisionAnalysis = async () => {
    if (!reportData?.project || !selectedConsultant) return;
    const selectedName = rankings.find((r: any) => r.id === selectedConsultant)?.name || '';
    setIsPostAnalyzing(true);
    try {
      const result = await postDecisionMutation.mutateAsync({
        projectId, projectName: reportData.project.name,
        selectedConsultantName: selectedName,
        decisionType, decisionBasis, justification,
        rankings: rankings.map((r: any) => ({ name: r.name, rank: r.rank, technicalScore: r.technicalScore, totalFee: r.totalFee })),
        negotiationTarget, negotiationConditions,
      });
      setPostDecisionAnalysis(result.analysis);
    } catch { toast.error('فشل في التحليل'); } finally { setIsPostAnalyzing(false); }
  };

  const handleSaveDecision = async () => {
    if (!selectedConsultant) { toast.error('اختر استشاري أولاً'); return; }
    await saveDecision.mutateAsync({ token, projectId, selectedConsultantId: selectedConsultant, decisionType, decisionBasis, justification, committeeNotes: notes, negotiationTarget, negotiationConditions, aiAnalysis, aiRecommendation });
    utils.commandCenter.getProjectCommitteeDecision.invalidate({ token, projectId });
    toast.success('تم حفظ القرار');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Button>
        <Gavel className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-bold text-slate-800">قرار اللجنة - {reportData?.project?.name}</h2>
      </div>

      {!reportData?.isReady ? (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-amber-800">التقرير الشامل غير متاح</p>
          <p className="text-sm text-amber-600 mt-1">يجب اكتمال التقييم الفني من جميع الأعضاء أولاً</p>
        </div>
      ) : (
        <>
          {/* Comprehensive Report Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" /> التقرير الشامل (مرجع)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-purple-200 bg-purple-50">
                    <th className="text-right py-2 px-2 text-purple-800">#</th>
                    <th className="text-right py-2 px-2 text-purple-800">الاستشاري</th>
                    <th className="text-center py-2 px-2 text-purple-800">الفني</th>
                    <th className="text-center py-2 px-2 text-purple-800">الأتعاب</th>
                    <th className="text-center py-2 px-2 text-purple-800">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.results?.map((r: any) => {
                    const fin = consultantsFin.find((c: any) => c.id === r.id);
                    return (
                      <tr key={r.id} className={`border-b border-slate-100 ${r.rank === 1 ? 'bg-green-50' : ''}`}>
                        <td className="py-2 px-2"><span className={`font-bold ${r.rank === 1 ? 'text-green-700' : 'text-slate-600'}`}>#{r.rank}</span></td>
                        <td className="py-2 px-2 font-medium text-slate-800">{r.name}</td>
                        <td className="text-center py-2 px-2 text-blue-700">{r.technicalScore}</td>
                        <td className="text-center py-2 px-2 text-emerald-700">{fin?.totalFees?.toLocaleString() || '-'} د.إ</td>
                        <td className="text-center py-2 px-2"><span className={`font-bold ${r.rank === 1 ? 'text-green-700' : 'text-slate-700'}`}>{r.finalScore}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-purple-800 flex items-center gap-2"><Brain className="w-5 h-5" /> تحليل وتوصية AI</h3>
              {!isDecisionConfirmed && (
                <Button onClick={handleGetRecommendation} disabled={isGettingRecommendation || rankings.length === 0} size="sm" className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                  {isGettingRecommendation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  طلب توصية
                </Button>
              )}
            </div>
            {aiRecommendation ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white/50 rounded-lg p-3">{aiRecommendation}</div>
            ) : (
              <p className="text-sm text-purple-400">اضغط "طلب توصية" للحصول على تحليل ذكي شامل</p>
            )}
          </div>

          {/* Committee Decision Form */}
          {!isDecisionConfirmed && (
            <div className="bg-white rounded-xl border-2 border-purple-200 p-5 shadow-lg">
              <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Gavel className="w-5 h-5 text-amber-600" /> اتخاذ القرار</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1 block">الاستشاري المختار</label>
                  <Select value={selectedConsultant?.toString() || ''} onValueChange={v => setSelectedConsultant(parseInt(v))}>
                    <SelectTrigger className="bg-white border-slate-300"><SelectValue placeholder="اختر الاستشاري" /></SelectTrigger>
                    <SelectContent>
                      {reportData.results?.map((r: any) => (
                        <SelectItem key={r.id} value={r.id.toString()}>{r.name} (#{r.rank})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1 block">نوع القرار</label>
                  <Select value={decisionType} onValueChange={setDecisionType}>
                    <SelectTrigger className="bg-white border-slate-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="selected">اختيار مباشر</SelectItem>
                      <SelectItem value="negotiate">التفاوض أولاً</SelectItem>
                      <SelectItem value="pending">قيد الدراسة</SelectItem>
                      <SelectItem value="rejected_all">رفض جميع العروض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1 block">أساس القرار</label>
                  <Select value={decisionBasis} onValueChange={setDecisionBasis}>
                    <SelectTrigger className="bg-white border-slate-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highest_technical">الأعلى فنياً</SelectItem>
                      <SelectItem value="best_value">أفضل قيمة (فني + مالي)</SelectItem>
                      <SelectItem value="lowest_fee">الأقل تكلفة</SelectItem>
                      <SelectItem value="highest_fee_with_negotiation">الأعلى تكلفة مع تفاوض</SelectItem>
                      <SelectItem value="other">أسباب أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(decisionType === 'negotiate' || decisionBasis === 'highest_fee_with_negotiation') && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">التارجت المالي</label>
                    <Input value={negotiationTarget} onChange={e => setNegotiationTarget(e.target.value)} placeholder="مثلاً: 2,000,000 AED" className="bg-white border-slate-300" />
                  </div>
                )}
              </div>
              {(decisionType === 'negotiate' || decisionBasis === 'highest_fee_with_negotiation') && (
                <div className="mb-4">
                  <label className="text-sm font-semibold text-slate-700 mb-1 block">شروط التفاوض</label>
                  <Textarea value={negotiationConditions} onChange={e => setNegotiationConditions(e.target.value)} placeholder="حدد شروط التفاوض..." className="bg-white border-slate-300" rows={3} />
                </div>
              )}
              <div className="mb-4">
                <label className="text-sm font-semibold text-slate-700 mb-1 block">مبررات القرار</label>
                <Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="اكتب مبررات اللجنة..." className="bg-white border-slate-300" rows={3} />
              </div>
              <div className="mb-4">
                <label className="text-sm font-semibold text-slate-700 mb-1 block">ملاحظات اللجنة</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="bg-white border-slate-300" rows={2} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={handleSaveDecision} className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={saveDecision.isPending}>
                  {saveDecision.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} حفظ القرار
                </Button>
                <Button onClick={handleAnalyzeDecision} disabled={isAnalyzing || !selectedConsultant} variant="outline" className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} تحليل AI للقرار
                </Button>
                <Button onClick={async () => {
                  if (!selectedConsultant || !decisionType) { toast.error('اختر استشاري ونوع القرار'); return; }
                  if (!confirm('هل أنت متأكد من تأكيد القرار؟ لا يمكن التراجع بعد التأكيد.')) return;
                  await handleSaveDecision();
                  await confirmDecision.mutateAsync({ token, projectId });
                  utils.commandCenter.getProjectCommitteeDecision.invalidate({ token, projectId });
                  utils.commandCenter.getProjectsForEvaluation.invalidate({ token });
                  toast.success('تم تأكيد القرار');
                }} disabled={!selectedConsultant || !decisionType || confirmDecision.isPending} className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 mr-auto">
                  {confirmDecision.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />} تأكيد القرار النهائي
                </Button>
              </div>
            </div>
          )}

          {/* AI Analysis Display */}
          {aiAnalysis && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-4">
              <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2"><Brain className="w-4 h-4" /> تحليل AI للقرار</h4>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
            </div>
          )}

          {/* Post-Decision Analysis */}
          {isDecisionConfirmed && (
            <div className="space-y-4">
              <Button onClick={handlePostDecisionAnalysis} disabled={isPostAnalyzing} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                {isPostAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} تحليل ما بعد القرار
              </Button>
              {postDecisionAnalysis && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
                  <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><Brain className="w-4 h-4" /> تحليل ما بعد القرار</h4>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{postDecisionAnalysis}</div>
                </div>
              )}
            </div>
          )}

          {/* Confirmed Decision Banner */}
          {isDecisionConfirmed && (
            <div className="bg-green-50 rounded-xl border border-green-300 p-6 text-center">
              <Trophy className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-800 text-lg">تم تأكيد القرار</p>
              <p className="text-sm text-green-600 mt-1">تم التأكيد بواسطة {decisionData?.decision?.confirmedBy}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════
function Dashboard({ token, member, onLogout }: { token: string; member: any; onLogout: () => void }) {
  const [, navigate] = useLocation();
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const [showSalwa, setShowSalwa] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showMilestonesKpis, setShowMilestonesKpis] = useState(false);
  const [showWorkSchedule, setShowWorkSchedule] = useState(false);
  const [showFeasibilityStudy, setShowFeasibilityStudy] = useState(false);
  const [showFinancialReports, setShowFinancialReports] = useState(false);
  const [showCapitalPortfolio, setShowCapitalPortfolio] = useState(false);
  const [showPaymentRequests, setShowPaymentRequests] = useState(false);
  const [showGeneralRequests, setShowGeneralRequests] = useState(false);
  const [showInternalMessages, setShowInternalMessages] = useState(false);
  const projectsList = trpc.projects.list.useQuery();

  const counts = trpc.commandCenter.getBubbleCounts.useQuery({ token });
  const notifications = trpc.commandCenter.getNotifications.useQuery({ token });
  const markAllRead = trpc.commandCenter.markAllNotificationsRead.useMutation();
  const checkReminders = trpc.commandCenter.checkPendingReminders.useMutation();
  const utils = trpc.useUtils();

  const unreadCount = notifications.data?.filter((n: any) => !n.isRead).length || 0;

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync({ token });
    utils.commandCenter.getNotifications.invalidate({ token });
  };

  // Auto-check for 48-hour reminders every 30 minutes
  useEffect(() => {
    const runCheck = () => checkReminders.mutate({ token });
    runCheck(); // run once on mount
    const interval = setInterval(runCheck, 30 * 60 * 1000); // every 30 min
    return () => clearInterval(interval);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // If viewing work schedule (read-only)
  if (activeBubble === "work_schedule" && showWorkSchedule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-2 py-4">
          <div className="flex items-center gap-2 mb-4 px-4">
            <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowWorkSchedule(false); }} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
            </Button>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">عرض فقط</span>
          </div>
          <div className="pointer-events-none opacity-90">
            <WorkSchedulePage />
          </div>
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }


  // If viewing financial reports (read-only)
  if (activeBubble === "financial_reports" && showFinancialReports) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <FinancialReportsView
          onBack={() => { setActiveBubble(null); setShowFinancialReports(false); }}
          projectsList={projectsList.data || []}
        />
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing payment requests
  if (activeBubble === "payment_requests" && showPaymentRequests) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-0 py-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowPaymentRequests(false); utils.commandCenter.getBubbleCounts.invalidate({ token }); }} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
            </Button>
          </div>
          <PaymentRequestsPage embedded={true} />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing internal messages
  if (activeBubble === "internal_messages" && showInternalMessages) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-0 py-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowInternalMessages(false); }} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
            </Button>
          </div>
          <InternalMessagesPage ccTokenProp={token} memberIdProp={member?.memberId} />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }
  // If viewing general requests
  if (activeBubble === "general_requests" && showGeneralRequests) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-0 py-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowGeneralRequests(false); utils.commandCenter.getBubbleCounts.invalidate({ token }); }} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
            </Button>
          </div>
          <GeneralRequestsPage embedded={true} />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing capital portfolio (interactive, no persistence)
  if (activeBubble === "capital_portfolio" && showCapitalPortfolio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-2 py-4">
          <div className="flex items-center justify-between mb-4 px-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowCapitalPortfolio(false); }} className="text-slate-500">
                <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
              </Button>
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">تحريك متاح • لا يحفظ</span>
            </div>
          </div>
          <CapitalPortfolioPage />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing feasibility study
  if (activeBubble === "feasibility_study" && showFeasibilityStudy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="px-2 py-4">
          <div className="flex items-center gap-2 mb-4 px-4">
            <Button variant="ghost" size="sm" onClick={() => { setActiveBubble(null); setShowFeasibilityStudy(false); }} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 ml-1" /> العودة للرئيسية
            </Button>
          </div>
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400 text-lg">صفحة فارغة — جاهزة للمحتوى الجديد</p>
          </div>
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing milestones & KPIs
  if (activeBubble === "milestones_kpis" && showMilestonesKpis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <MilestonesKpisView
            token={token}
            onBack={() => { setActiveBubble(null); setShowMilestonesKpis(false); }}
          />
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // If viewing evaluations
  if (activeBubble === "evaluations" && showEvaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
        <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} />
        <div className="w-full px-4 py-6">
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
          {activeBubble === "requests" ? (
            <RequestsAndInquiries
              token={token}
              memberId={member.memberId}
              memberNameAr={member.nameAr}
              memberRole={member.role}
              onBack={() => setActiveBubble(null)}
            />
          ) : (
            <BubbleDetail
              token={token}
              bubbleType={activeBubble}
              onBack={() => setActiveBubble(null)}
              memberRole={member.role}
            />
          )}
        </div>
        <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen" dir="rtl" style={{background: 'linear-gradient(160deg, #f8f6ff 0%, #fff7ed 55%, #f0fdf4 100%)'}}>
      <DashboardHeader member={member} onLogout={onLogout} unreadCount={unreadCount} onNotifications={handleMarkAllRead} onSalwa={() => setShowSalwa(true)} onNavigateHome={() => navigate("/")} />
      <NewsTicker token={token} />
      <div className="w-full px-4 py-4">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl mb-4 shadow-lg"
          style={{background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 60%, #f8f6ff 100%)', border: '1.5px solid #e5e7eb'}}>
          {/* Subtle decorative blobs */}
          <div className="absolute top-0 left-0 w-72 h-72 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-10"
            style={{background: 'radial-gradient(circle, #f59e0b, transparent)'}} />
          <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full translate-x-1/3 translate-y-1/3 opacity-10"
            style={{background: 'radial-gradient(circle, #6366f1, transparent)'}} />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-7">
            {/* Salwa image - larger with warm gold ring */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden"
                style={{boxShadow: '0 0 0 3px rgba(245,158,11,0.5), 0 8px 28px rgba(245,158,11,0.2)'}}>
                <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div className="flex-1 text-center sm:text-right">
              {/* Date badge - dark text */}
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-2"
                style={{background: 'rgba(0,0,0,0.06)', color: '#374151', border: '1px solid rgba(0,0,0,0.1)'}}>
                {new Date().toLocaleDateString("ar-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              {/* Greeting - black bold */}
              <h2 className="text-2xl sm:text-3xl font-black mb-1 leading-tight" style={{color:"#111827"}}>{member.greeting}</h2>
              {/* Subtitle - dark gray */}
              <p className="text-sm mb-3" style={{color: '#374151'}}>&#x633;&#x644;&#x648;&#x649; &mdash; &#x627;&#x644;&#x645;&#x646;&#x633;&#x642;&#x629; &#x627;&#x644;&#x630;&#x643;&#x64a;&#x629; &#x644;&#x645;&#x634;&#x627;&#x631;&#x64a;&#x639; COMO Developments</p>
              {/* Personalized stats chips - clickable */}
              {counts.data && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(counts.data.requests ?? 0) > 0 && (
                    <button onClick={() => setActiveBubble("requests")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                      style={{background:'rgba(239,68,68,0.1)',color:'#b91c1c',border:'1px solid rgba(239,68,68,0.25)'}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                      لديك {counts.data.requests} طلب{counts.data.requests > 1 ? ' معلقة' : ' معلق'}
                    </button>
                  )}
                  {(counts.data.evaluations ?? 0) > 0 && (
                    <button onClick={() => { setActiveBubble("evaluations"); setShowEvaluation(true); }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                      style={{background:'rgba(124,58,237,0.1)',color:'#5b21b6',border:'1px solid rgba(124,58,237,0.25)'}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
                      {counts.data.evaluations} جلسة تقييم بانتظارك
                    </button>
                  )}
                  {(counts.data.reports ?? 0) > 0 && (
                    <button onClick={() => setActiveBubble("reports")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                      style={{background:'rgba(37,99,235,0.1)',color:'#1e40af',border:'1px solid rgba(37,99,235,0.25)'}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      {counts.data.reports} تقرير جديد
                    </button>
                  )}
                  {(counts.data.meeting_minutes ?? 0) > 0 && (
                    <button onClick={() => setActiveBubble("meeting_minutes")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                      style={{background:'rgba(245,158,11,0.1)',color:'#92400e',border:'1px solid rgba(245,158,11,0.3)'}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      {counts.data.meeting_minutes} محضر جديد
                    </button>
                  )}
                  {(counts.data.requests ?? 0) === 0 && (counts.data.evaluations ?? 0) === 0 && (counts.data.reports ?? 0) === 0 && (counts.data.meeting_minutes ?? 0) === 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{background:'rgba(16,185,129,0.1)',color:'#065f46',border:'1px solid rgba(16,185,129,0.25)'}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      كل شيء على ما يرام ✓
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                <button onClick={() => setShowSalwa(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', boxShadow: '0 4px 20px rgba(245,158,11,0.45)'}}>
                  <MessageSquare className="w-4 h-4" />
                  &#x62a;&#x62d;&#x62f;&#x62b; &#x645;&#x639; &#x633;&#x644;&#x648;&#x649;
                </button>
                <button onClick={() => setShowSalwa(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{background: 'rgba(0,0,0,0.05)', color: '#111827', border: '1px solid rgba(0,0,0,0.12)'}}>
                  <Mic className="w-4 h-4" />
                  &#x631;&#x633;&#x627;&#x644;&#x629; &#x635;&#x648;&#x62a;&#x64a;&#x629;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        {(() => {
          const handleBubbleClick = (type: string) => {
            if (type === "milestones_kpis") { setActiveBubble("milestones_kpis"); setShowMilestonesKpis(true); }
            else if (type === "evaluations") { setActiveBubble("evaluations"); setShowEvaluation(true); }
            else if (type === "work_schedule") { setActiveBubble("work_schedule"); setShowWorkSchedule(true); }
            else if (type === "feasibility_study") { setActiveBubble("feasibility_study"); setShowFeasibilityStudy(true); }
            else if (type === "financial_reports") { setActiveBubble("financial_reports"); setShowFinancialReports(true); }
            else if (type === "capital_portfolio") { setActiveBubble("capital_portfolio"); setShowCapitalPortfolio(true); }
            else if (type === "payment_requests") { setActiveBubble("payment_requests"); setShowPaymentRequests(true); }
            else if (type === "requests") { setActiveBubble("general_requests"); setShowGeneralRequests(true); }
            else if (type === "internal_messages") { setActiveBubble("internal_messages"); setShowInternalMessages(true); }
            else { setActiveBubble(type); }
          };

          // Bold solid-color theme map — each card is a vivid solid color with white text
          const solidColorMap: Record<string, {solid:string;shadow:string}> = {
            'from-indigo-600 to-indigo-800':  {solid:'#6366f1', shadow:'rgba(99,102,241,0.45)'},
            'from-emerald-600 to-emerald-800':{solid:'#10b981', shadow:'rgba(16,185,129,0.45)'},
            'from-emerald-500 to-teal-700':   {solid:'#059669', shadow:'rgba(5,150,105,0.45)'},
            'from-purple-600 to-purple-800':  {solid:'#9333ea', shadow:'rgba(147,51,234,0.45)'},
            'from-violet-600 to-purple-800':  {solid:'#7c3aed', shadow:'rgba(124,58,237,0.45)'},
            'from-cyan-600 to-teal-700':      {solid:'#06b6d4', shadow:'rgba(6,182,212,0.45)'},
            'from-cyan-500 to-sky-700':       {solid:'#0891b2', shadow:'rgba(8,145,178,0.45)'},
            'from-amber-600 to-amber-800':    {solid:'#f59e0b', shadow:'rgba(245,158,11,0.45)'},
            'from-orange-500 to-amber-700':   {solid:'#f97316', shadow:'rgba(249,115,22,0.45)'},
            'from-amber-500 to-orange-700':   {solid:'#f59e0b', shadow:'rgba(245,158,11,0.45)'},
            'from-blue-600 to-blue-800':      {solid:'#3b82f6', shadow:'rgba(59,130,246,0.45)'},
            'from-blue-500 to-blue-700':      {solid:'#2563eb', shadow:'rgba(37,99,235,0.45)'},
            'from-rose-600 to-rose-800':      {solid:'#f43f5e', shadow:'rgba(244,63,94,0.45)'},
            'from-rose-500 to-pink-700':      {solid:'#e11d48', shadow:'rgba(225,29,72,0.45)'},
            'from-red-500 to-rose-700':       {solid:'#ef4444', shadow:'rgba(239,68,68,0.45)'},
            'from-teal-600 to-teal-800':      {solid:'#14b8a6', shadow:'rgba(20,184,166,0.45)'},
            'from-teal-500 to-teal-700':      {solid:'#0d9488', shadow:'rgba(13,148,136,0.45)'},
            'from-violet-600 to-violet-800':  {solid:'#7c3aed', shadow:'rgba(124,58,237,0.45)'},
            'from-fuchsia-500 to-violet-700': {solid:'#a21caf', shadow:'rgba(162,28,175,0.45)'},
          };
          // Keep themeMap for backward compat (not used in new BentoCard)
          const themeMap: Record<string, {bg:string;iconBg:string;accent:string;textColor:string;glow:string}> = {
            'from-blue-600 to-blue-800':      {bg:'#eff6ff',iconBg:'linear-gradient(135deg,#3b82f6,#1d4ed8)',accent:'#bfdbfe',textColor:'#1e40af',glow:'rgba(59,130,246,0.18)'},
            'from-amber-600 to-amber-800':    {bg:'#fffbeb',iconBg:'linear-gradient(135deg,#f59e0b,#b45309)',accent:'#fde68a',textColor:'#92400e',glow:'rgba(245,158,11,0.18)'},
            'from-emerald-600 to-emerald-800':{bg:'#f0fdf4',iconBg:'linear-gradient(135deg,#10b981,#065f46)',accent:'#a7f3d0',textColor:'#065f46',glow:'rgba(16,185,129,0.18)'},
            'from-purple-600 to-purple-800':  {bg:'#faf5ff',iconBg:'linear-gradient(135deg,#9333ea,#581c87)',accent:'#e9d5ff',textColor:'#6b21a8',glow:'rgba(147,51,234,0.18)'},
            'from-cyan-600 to-teal-700':      {bg:'#ecfeff',iconBg:'linear-gradient(135deg,#06b6d4,#0f766e)',accent:'#a5f3fc',textColor:'#164e63',glow:'rgba(6,182,212,0.18)'},
            'from-rose-600 to-rose-800':      {bg:'#fff1f2',iconBg:'linear-gradient(135deg,#f43f5e,#9f1239)',accent:'#fecdd3',textColor:'#9f1239',glow:'rgba(244,63,94,0.18)'},
            'from-teal-600 to-teal-800':      {bg:'#f0fdfa',iconBg:'linear-gradient(135deg,#14b8a6,#134e4a)',accent:'#99f6e4',textColor:'#134e4a',glow:'rgba(20,184,166,0.18)'},
            'from-indigo-600 to-indigo-800':  {bg:'#eef2ff',iconBg:'linear-gradient(135deg,#6366f1,#3730a3)',accent:'#c7d2fe',textColor:'#3730a3',glow:'rgba(99,102,241,0.18)'},
            'from-violet-600 to-violet-800':  {bg:'#f5f3ff',iconBg:'linear-gradient(135deg,#7c3aed,#4c1d95)',accent:'#ddd6fe',textColor:'#4c1d95',glow:'rgba(124,58,237,0.18)'},
          };

          const subtitles: Record<string,string> = {
            capital_portfolio: 'تحريك وتعديل رأس المال عبر المشاريع والمراحل',
            financial_reports: 'تقارير الجدوى والتدفقات وحساب الضمان',
            payment_requests: 'إنشاء ومتابعة طلبات الصرف وسير الموافقة',
            evaluations: 'تقييم الاستشاريين الفنيين',
            milestones_kpis: 'متابعة المراحل ومؤشرات الأداء',
            reports: 'عرض وإدارة جميع التقارير المرفوعة',
            requests: 'إنشاء ومتابعة الاعتمادات والتوقيعات الرسمية',
            internal_messages: 'التواصل المباشر بين أعضاء فريق القيادة',
            meeting_minutes: 'محاضر الاجتماعات والقرارات',
          };

          // Card-style tile (white card + colored square icon + badge) — used for 4 specific icons
          const CardTile = ({ bubble, size = 'md' }: { bubble: typeof BUBBLES[0]; size?: 'lg' | 'md' | 'sm' }) => {
            const count = counts.data?.[bubble.type as keyof typeof counts.data] || 0;
            const hasCount = typeof count === 'number' && count > 0;
            const sc = solidColorMap[bubble.color] || {solid:'#64748b', shadow:'rgba(100,116,139,0.45)'};
            const iconBoxSize = size === 'lg' ? 72 : size === 'md' ? 60 : 52;
            const iconSize = size === 'lg' ? 30 : size === 'md' ? 26 : 22;
            const fontSize = size === 'lg' ? '0.85rem' : size === 'md' ? '0.78rem' : '0.72rem';
            return (
              <button
                onClick={() => handleBubbleClick(bubble.type)}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 w-full"
                style={{background:'#ffffff', border:'1px solid rgba(0,0,0,0.07)'}}
              >
                <div className="relative" style={{width: iconBoxSize, height: iconBoxSize}}>
                  <div
                    className="flex items-center justify-center w-full h-full transition-transform duration-200 group-hover:scale-105"
                    style={{
                      background: sc.solid,
                      borderRadius: size === 'lg' ? '20px' : '16px',
                      boxShadow: `0 4px 14px ${sc.shadow}`,
                    }}
                  >
                    <bubble.icon style={{width: iconSize, height: iconSize, color:'white', filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'}} />
                  </div>
                  {hasCount && (
                    <div
                      className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{background:'#ef4444', color:'white', boxShadow:'0 2px 8px rgba(239,68,68,0.55)', zIndex:10}}
                    >
                      {count}
                    </div>
                  )}
                </div>
                <span
                  className="font-semibold text-center leading-tight text-slate-700 group-hover:text-slate-900 transition-colors"
                  style={{fontSize, maxWidth: iconBoxSize + 24, display:'block'}}
                >
                  {bubble.label}
                </span>
              </button>
            );
          };

          // Clean icon-tile card — large icon + label below
          const IconTile = ({ bubble, size = 'md' }: { bubble: typeof BUBBLES[0]; size?: 'lg' | 'md' | 'sm' }) => {
            const count = counts.data?.[bubble.type as keyof typeof counts.data] || 0;
            const hasCount = typeof count === "number" && count > 0;
            const sc = solidColorMap[bubble.color] || {solid:'#64748b', shadow:'rgba(100,116,139,0.45)'};
            const tileSize = size === 'lg' ? 80 : size === 'md' ? 64 : 52;
            const iconSize = size === 'lg' ? 32 : size === 'md' ? 26 : 22;
            const fontSize = size === 'lg' ? '0.82rem' : size === 'md' ? '0.72rem' : '0.65rem';

            return (
              <button
                onClick={() => handleBubbleClick(bubble.type)}
                className="group flex flex-col items-center gap-2 transition-all duration-200 hover:-translate-y-1 active:scale-95"
                style={{background:'transparent', border:'none', cursor:'pointer'}}
              >
                <div
                  className="relative flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl"
                  style={{
                    width: tileSize, height: tileSize,
                    background: sc.solid,
                    boxShadow: `0 4px 16px ${sc.shadow}`,
                    borderRadius: size === 'lg' ? '22px' : '18px',
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{background:'linear-gradient(135deg,rgba(255,255,255,0.28) 0%,transparent 60%)', borderRadius: 'inherit'}} />
                  <bubble.icon style={{width:iconSize, height:iconSize, color:'white', filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.25))'}} />
                  {hasCount && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{background:'#ef4444', color:'white', boxShadow:'0 2px 6px rgba(239,68,68,0.5)'}}>
                      {count}
                    </div>
                  )}
                </div>
                <span className="font-semibold text-center leading-tight text-slate-700 group-hover:text-slate-900 transition-colors"
                  style={{fontSize, maxWidth: tileSize + 16, display:'block'}}>
                  {bubble.label}
                </span>
              </button>
            );
          };

          // BUBBLES index reference:
          // 0=محفظة رأس المال, 1=التقارير المالية, 2=طلبات الصرف, 3=تقييم الاستشاريين
          // 4=المراحل والأداء, 5=الاعتمادات الرسمية, 6=التقارير, 7=محاضر الاجتماعات
          // 8=برنامج العمل, 9=دراسة الجدوى, 10=الإعلانات

          // Hero priority card — large horizontal card for payment/general requests
          const HeroPriorityCard = ({ bubble, accentColor, gradientFrom, gradientTo }: {
            bubble: typeof BUBBLES[0];
            accentColor: string;
            gradientFrom: string;
            gradientTo: string;
          }) => {
            const count = counts.data?.[bubble.type as keyof typeof counts.data] || 0;
            const hasCount = typeof count === 'number' && count > 0;
            const sc = solidColorMap[bubble.color] || {solid:'#64748b', shadow:'rgba(100,116,139,0.45)'};
            return (
              <button
                onClick={() => handleBubbleClick(bubble.type)}
                className="group relative overflow-hidden flex items-center gap-5 p-5 rounded-2xl w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
                  boxShadow: `0 6px 28px ${sc.shadow}`,
                  border: `1.5px solid rgba(255,255,255,0.25)`,
                }}
              >
                {/* Decorative shimmer */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{background:'linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%)', borderRadius:'inherit'}} />
                {/* Icon box */}
                <div className="relative flex-shrink-0 flex items-center justify-center rounded-2xl"
                  style={{width:64, height:64, background:'rgba(255,255,255,0.2)', backdropFilter:'blur(8px)', border:'1.5px solid rgba(255,255,255,0.3)'}}>
                  <bubble.icon style={{width:30, height:30, color:'white', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'}} />
                  {hasCount && (
                    <div className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center text-xs font-black animate-pulse"
                      style={{background:'#ef4444', color:'white', boxShadow:'0 3px 10px rgba(239,68,68,0.7)', border:'2px solid white'}}>
                      {count}
                    </div>
                  )}
                </div>
                {/* Text */}
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {hasCount ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{background:'rgba(239,68,68,0.2)', color:'#fecaca', border:'1px solid rgba(239,68,68,0.35)'}}>
                          {count} معلق
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{background:'rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.8)'}}>
                          لا يوجد معلق
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-white tracking-tight">{bubble.label}</h3>
                  </div>
                  <p className="text-sm text-right" style={{color:'rgba(255,255,255,0.75)'}}>
                    {subtitles[bubble.type] || ''}
                  </p>
                </div>
                {/* Arrow */}
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-transform group-hover:-translate-x-1"
                  style={{background:'rgba(255,255,255,0.15)'}}>
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </button>
            );
          };

          return (
            <div className="mb-4 space-y-4">
              {/* ═══ PRIORITY SECTION ═══ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#f59e0b,#ef4444)'}} />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">الأولوية القصوى</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <HeroPriorityCard bubble={BUBBLES[2]} accentColor="#f59e0b" gradientFrom="#f59e0b" gradientTo="#d97706" />
                  <HeroPriorityCard bubble={BUBBLES[5]} accentColor="#f97316" gradientFrom="#ea580c" gradientTo="#c2410c" />
                </div>
              </div>

              {/* ═══ SECONDARY SECTION ═══ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#6366f1,#10b981)'}} />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">المالية والتشغيل</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <CardTile bubble={BUBBLES[0]} size="md" />
                  <CardTile bubble={BUBBLES[1]} size="md" />
                  <CardTile bubble={BUBBLES[3]} size="md" />
                  <CardTile bubble={BUBBLES[4]} size="md" />
                </div>
              </div>

              {/* ═══ OTHER SECTION ═══ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#3b82f6,#ec4899)'}} />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">أدوات أخرى</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <IconTile bubble={BUBBLES[6]} size="md" />
                  <IconTile bubble={BUBBLES[7]} size="md" />
                  <IconTile bubble={BUBBLES[11]} size="md" />
                  <IconTile bubble={BUBBLES[8]} size="sm" />
                  <IconTile bubble={BUBBLES[9]} size="sm" />
                  <IconTile bubble={BUBBLES[10]} size="sm" />
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      <button
        onClick={() => setShowSalwa(true)}
        className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 overflow-hidden"
        style={{boxShadow: '0 0 0 3px rgba(245,158,11,0.4), 0 8px 32px rgba(245,158,11,0.3)'}}
      >
        <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
      </button>
      <SalwaChat token={token} memberName={member.nameAr} isOpen={showSalwa} onClose={() => setShowSalwa(false)} />
    </div>
  );
}


function DashboardHeader({ member, onLogout, unreadCount, onNotifications, onSalwa, onNavigateHome }: {
  member: any; onLogout: () => void; unreadCount: number; onNotifications: () => void; onSalwa: () => void; onNavigateHome?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30" style={{background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(99,102,241,0.12)', boxShadow: '0 1px 20px rgba(99,102,241,0.08)'}}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo + back button */}
        <div className="flex items-center gap-3">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="العودة للرئيسية"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              الرئيسية
            </button>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.4)'}}>
            <span className="text-sm font-black text-white">C</span>
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm tracking-wide">مركز القيادة</span>
            <p className="text-[10px] text-slate-400">COMO Developments</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button onClick={onNotifications} className="relative p-2 rounded-xl transition-all hover:scale-105" style={{background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)'}}>
            <Bell className="w-4 h-4" style={{color: 'rgba(255,255,255,0.7)'}} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center" style={{boxShadow: '0 2px 6px rgba(239,68,68,0.5)'}}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Member name */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)'}}>
            <User className="w-3.5 h-3.5" style={{color: 'rgba(255,255,255,0.5)'}} />
            <span className="text-xs font-semibold" style={{color: 'rgba(255,255,255,0.85)'}}>{member.nameAr}</span>
          </div>

          {/* Logout */}
          <button onClick={onLogout} className="p-2 rounded-xl transition-all hover:scale-105" style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)'}}>
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
