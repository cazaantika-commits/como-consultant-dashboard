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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const SALWA_AVATAR_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/dKjNMGCYtHDQQPse.png";

// ─── Voice Recording Hook ───
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
  { type: "milestones_kpis" as const, label: "المراحل والأداء", icon: Target, color: "from-cyan-600 to-teal-700", bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  { type: "announcements" as const, label: "الإعلانات", icon: Megaphone, color: "from-rose-600 to-rose-800", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
];

const BUBBLE_LABELS: Record<string, string> = {
  reports: "التقارير",
  requests: "الطلبات",
  meeting_minutes: "محاضر الاجتماعات",
  evaluations: "تقييم الاستشاريين",
  milestones_kpis: "المراحل والأداء",
  announcements: "الإعلانات",
};

// ─── Milestone/KPI Helpers ───
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

// ─── Milestone Form ───
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

// ─── KPI Form ───
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
  const items = trpc.commandCenter.getItems.useQuery({ token, bubbleType: "announcements" as any, status: "active" });
  const newsItems = items.data || [];
  
  // Default news if no announcements exist
  const defaultNews = [
    "مرحباً بكم في مركز القيادة — COMO Developments Command Center",
    "تابعوا آخر التطورات في مشاريعنا العقارية",
    "للتواصل مع سلوى اضغط على الزر العائم",
  ];
  
  const tickerItems = newsItems.length > 0
    ? newsItems.map((n: any) => n.title)
    : defaultNews;
  
  return (
    <div className="bg-gradient-to-l from-slate-800 via-slate-900 to-slate-800 text-white overflow-hidden border-b border-slate-700">
      <div className="flex items-center h-9">
        <div className="flex-shrink-0 bg-amber-500 text-white px-4 h-full flex items-center gap-1.5 text-xs font-bold z-10 shadow-md">
          <Megaphone className="w-3.5 h-3.5" />
          أخبار
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap flex items-center h-9">
            {[...tickerItems, ...tickerItems].map((text, i) => (
              <span key={i} className="inline-flex items-center text-xs text-slate-200 mx-8">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-3 flex-shrink-0" />
                {text}
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
  const [activeTab, setActiveTab] = useState<'financial' | 'technical' | 'committee' | null>(null);

  if (selectedProject && activeTab === 'financial') {
    return <FinancialEvaluationView token={token} projectId={selectedProject} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'technical') {
    return <TechnicalEvaluationView token={token} projectId={selectedProject} memberId={memberId} onBack={() => setActiveTab(null)} />;
  }
  if (selectedProject && activeTab === 'committee') {
    return <CommitteeDecisionView token={token} projectId={selectedProject} memberId={memberId} onBack={() => setActiveTab(null)} />;
  }

  if (selectedProject) {
    const project = projectsQuery.data?.find((p: any) => p.id === selectedProject);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="text-slate-500">
            <ArrowLeft className="w-4 h-4 ml-1" /> العودة
          </Button>
          <h2 className="text-xl font-bold text-slate-800">{project?.name}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-purple-100 text-sm">التقرير الشامل والقرار</p>
              {project?.isDecisionConfirmed && <Badge className="mt-2 bg-white/20 text-white border-0">مؤكد ✅</Badge>}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projectsQuery.data?.map((project: any) => {
          const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
            not_started: { label: 'لم يبدأ', color: 'bg-slate-100 text-slate-600', icon: Lock },
            in_progress: { label: 'قيد التقييم', color: 'bg-amber-100 text-amber-700', icon: Loader2 },
            evaluation_complete: { label: 'التقييم مكتمل', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
            decided: { label: 'تم اتخاذ القرار', color: 'bg-green-100 text-green-700', icon: Trophy },
          };
          const st = statusConfig[project.status] || statusConfig.not_started;
          const StatusIcon = st.icon;
          return (
            <button key={project.id} onClick={() => setSelectedProject(project.id)} className="group text-right bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:border-purple-300 hover:scale-[1.01]">
              <div className="flex items-start justify-between mb-3">
                <Badge className={`${st.color} border-0 text-xs`}>
                  <StatusIcon className={`w-3 h-3 ml-1 ${project.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  {st.label}
                </Badge>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-1 group-hover:text-purple-700 transition-colors">{project.name}</h3>
              <p className="text-sm text-slate-500">{project.consultantCount} استشاري</p>
              <div className="mt-3 flex gap-1">
                {project.evaluatorStatus?.map((e: any) => (
                  <div key={e.name} className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${e.isComplete ? 'bg-green-500' : e.completed > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <span className="text-[10px] text-slate-400">{e.name === 'sheikh_issa' ? 'ش.ع' : e.name === 'wael' ? 'و' : 'ع'}</span>
                  </div>
                ))}
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
  
  if (data.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  
  const project = data.data?.project;
  const consultantsList = data.data?.consultants || [];
  const sorted = [...consultantsList].sort((a, b) => b.financialScore - a.financialScore);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Button>
        <DollarSign className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-800">التقييم المالي - {project?.name}</h2>
      </div>
      
      {project && (
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-emerald-600">المساحة (BUA)</p>
              <p className="font-bold text-emerald-800">{project.bua?.toLocaleString()} قدم²</p>
            </div>
            <div>
              <p className="text-xs text-emerald-600">سعر القدم</p>
              <p className="font-bold text-emerald-800">{project.pricePerSqft?.toLocaleString()} د.إ</p>
            </div>
            <div>
              <p className="text-xs text-emerald-600">تكلفة البناء</p>
              <p className="font-bold text-emerald-800">{project.constructionCost?.toLocaleString()} د.إ</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((c, i) => (
          <div key={c.id} className={`bg-white rounded-xl border p-4 ${i === 0 ? 'border-emerald-300 shadow-md' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {i === 0 && <Trophy className="w-5 h-5 text-emerald-500" />}
                <span className="font-bold text-slate-800">{c.name}</span>
              </div>
              <Badge className={`${i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} border-0`}>
                سكور: {c.financialScore}%
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500">التصميم</p>
                <p className="font-semibold text-slate-700">{c.designAmount?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500">الإشراف</p>
                <p className="font-semibold text-slate-700">{c.supervisionAmount?.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-emerald-600">الإجمالي</p>
                <p className="font-bold text-emerald-700">{c.totalFees?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Technical Evaluation View (Blind) ═══
function TechnicalEvaluationView({ token, projectId, memberId, onBack }: { token: string; projectId: number; memberId: string; onBack: () => void }) {
  const data = trpc.commandCenter.getProjectTechnicalEvaluation.useQuery({ token, projectId });
  const submitScore = trpc.commandCenter.submitTechnicalScore.useMutation();
  const utils = trpc.useUtils();
  const [expandedConsultant, setExpandedConsultant] = useState<number | null>(null);

  if (data.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  const evalData = data.data;
  if (!evalData) return <div className="text-center py-12 text-slate-400">لا توجد بيانات</div>;

  const { project, consultants: consultantsList, evaluatorStatus, allComplete, myEvaluatorName, myStatus } = evalData;

  const handleScore = async (consultantId: number, criterionId: number, score: number) => {
    await submitScore.mutateAsync({ token, projectId, consultantId, criterionId, score });
    utils.commandCenter.getProjectTechnicalEvaluation.invalidate({ token, projectId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Button>
        <Award className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-800">التقييم الفني - {project?.name}</h2>
      </div>

      {/* Evaluator Status Bar */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm font-semibold text-blue-800 mb-3">حالة التقييم</p>
        <div className="flex gap-4">
          {evaluatorStatus?.map((e: any) => (
            <div key={e.name} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${e.isComplete ? 'bg-green-500' : e.completed > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
              <span className="text-sm text-slate-700">{e.nameAr}</span>
              {e.isComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
            </div>
          ))}
        </div>
        {!allComplete && (
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <Lock className="w-3 h-3" /> النتائج ستظهر بعد اكتمال تقييم جميع الأعضاء
          </p>
        )}
        {allComplete && (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <Unlock className="w-3 h-3" /> اكتمل التقييم - النتائج متاحة
          </p>
        )}
      </div>

      {/* My Evaluation Form */}
      {!myStatus?.isComplete && (
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> تقييمك الفني
          </h3>
          {consultantsList?.map((consultant: any) => (
            <div key={consultant.id} className="mb-4">
              <button onClick={() => setExpandedConsultant(expandedConsultant === consultant.id ? null : consultant.id)} className="w-full text-right bg-slate-50 rounded-lg p-3 flex items-center justify-between hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-800">{consultant.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{consultant.myScores?.filter((s: any) => s.score).length || 0}/9</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedConsultant === consultant.id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expandedConsultant === consultant.id && (
                <div className="mt-2 space-y-2 pr-4">
                  {CRITERIA.map((criterion) => {
                    const myScore = consultant.myScores?.find((s: any) => s.criterionId === criterion.id);
                    return (
                      <div key={criterion.id} className="bg-white border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">{criterion.name}</span>
                          <span className="text-xs text-slate-400">الوزن: {criterion.weight}%</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {criterion.options.map((opt) => (
                            <button key={opt.score} onClick={() => handleScore(consultant.id, criterion.id, opt.score)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-all ${myScore?.score === opt.score ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                              title={opt.label}>
                              {opt.score}
                            </button>
                          ))}
                        </div>
                        {myScore?.score && (
                          <p className="text-[10px] text-blue-600 mt-1">{criterion.options.find(o => o.score === myScore.score)?.label}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {myStatus?.isComplete && !allComplete && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-bold text-green-800">تم إكمال تقييمك الفني</p>
          <p className="text-sm text-green-600 mt-1">في انتظار اكتمال تقييم باقي الأعضاء</p>
        </div>
      )}

      {/* Results - Only shown when ALL evaluators complete */}
      {allComplete && evalData.allEvaluatorData && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> نتائج التقييم الفني
          </h3>
          {consultantsList?.map((consultant: any) => {
            let totalWeighted = 0;
            return (
              <div key={consultant.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-bold text-slate-800 mb-3">{consultant.name}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-right py-2 text-slate-600">المعيار</th>
                        <th className="text-center py-2 text-slate-600">الوزن</th>
                        {evalData.allEvaluatorData.map((ev: any) => (
                          <th key={ev.evaluatorName} className="text-center py-2 text-slate-600">{ev.nameAr}</th>
                        ))}
                        <th className="text-center py-2 text-blue-700 font-bold">المتوسط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CRITERIA.map((criterion) => {
                        const scores = evalData.allEvaluatorData.map((ev: any) => {
                          const s = ev.scores.find((s: any) => s.consultantId === consultant.id && s.criterionId === criterion.id);
                          return s?.score || 0;
                        });
                        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
                        totalWeighted += (avg * criterion.weight) / 100;
                        return (
                          <tr key={criterion.id} className="border-b border-slate-100">
                            <td className="py-2 text-slate-700 text-xs">{criterion.name}</td>
                            <td className="text-center py-2 text-slate-500 text-xs">{criterion.weight}%</td>
                            {scores.map((s: number, i: number) => (
                              <td key={i} className="text-center py-2 font-medium">{s}</td>
                            ))}
                            <td className="text-center py-2 font-bold text-blue-700">{avg.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50">
                        <td colSpan={2 + evalData.allEvaluatorData.length} className="py-2 font-bold text-blue-800 text-right">المجموع المرجح</td>
                        <td className="text-center py-2 font-bold text-blue-800">{totalWeighted.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ Committee Decision View ═══
function CommitteeDecisionView({ token, projectId, memberId, onBack }: { token: string; projectId: number; memberId: string; onBack: () => void }) {
  const report = trpc.commandCenter.getComprehensiveReport.useQuery({ token, projectId });
  const decision = trpc.commandCenter.getProjectCommitteeDecision.useQuery({ token, projectId });
  const saveDecision = trpc.commandCenter.saveCommitteeDecision.useMutation();
  const confirmDecision = trpc.commandCenter.confirmDecision.useMutation();
  const utils = trpc.useUtils();
  const [selectedConsultant, setSelectedConsultant] = useState<number | null>(null);
  const [decisionType, setDecisionType] = useState('approve');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');

  if (report.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

  const reportData = report.data;
  const decisionData = decision.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Button>
        <Gavel className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-bold text-slate-800">قرار اللجنة - {reportData?.project?.name}</h2>
      </div>

      {/* Comprehensive Report */}
      {!reportData?.isReady ? (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-amber-800">التقرير الشامل غير متاح</p>
          <p className="text-sm text-amber-600 mt-1">يجب اكتمال التقييم الفني من جميع الأعضاء أولاً</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" /> التقرير الشامل
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-purple-200 bg-purple-50">
                    <th className="text-right py-3 px-2 text-purple-800">المركز</th>
                    <th className="text-right py-3 px-2 text-purple-800">الاستشاري</th>
                    <th className="text-center py-3 px-2 text-purple-800">الفني (20%)</th>
                    <th className="text-center py-3 px-2 text-purple-800">المالي (80%)</th>
                    <th className="text-center py-3 px-2 text-purple-800">النتيجة النهائية</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.results?.map((r: any) => (
                    <tr key={r.id} className={`border-b border-slate-100 ${r.rank === 1 ? 'bg-green-50' : ''}`}>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {r.rank === 1 && <Trophy className="w-4 h-4 text-yellow-500" />}
                          <span className={`font-bold ${r.rank === 1 ? 'text-green-700' : 'text-slate-600'}`}>#{r.rank}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800">{r.name}</td>
                      <td className="text-center py-3 px-2 text-blue-700 font-medium">{r.technicalScore}</td>
                      <td className="text-center py-3 px-2 text-emerald-700 font-medium">{r.financialScore}%</td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-bold text-lg ${r.rank === 1 ? 'text-green-700' : 'text-slate-700'}`}>{r.finalScore}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Advisory */}
          {decisionData?.aiScores && decisionData.aiScores.length > 0 && (
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
              <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                <Star className="w-4 h-4" /> رأي الوكيل الذكي
              </h3>
              {decisionData.aiScores.map((ai: any) => (
                <div key={ai.id} className="text-sm text-indigo-700 mb-1">
                  <span className="font-medium">{ai.consultantId}:</span> {ai.recommendation || 'لا توجد توصية'}
                </div>
              ))}
            </div>
          )}

          {/* Committee Decision Form */}
          {!decisionData?.decision?.isConfirmed && (
            <div className="bg-white rounded-xl border border-purple-200 p-4">
              <h3 className="font-bold text-purple-800 mb-4">اتخاذ القرار</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">اختيار الاستشاري</label>
                  <div className="flex flex-wrap gap-2">
                    {reportData.results?.map((r: any) => (
                      <button key={r.id} onClick={() => setSelectedConsultant(r.id)}
                        className={`px-4 py-2 rounded-lg border text-sm transition-all ${selectedConsultant === r.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}>
                        {r.name} (#{r.rank})
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">المبررات</label>
                  <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="أدخل مبررات القرار..." className="min-h-[80px]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">ملاحظات اللجنة</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="min-h-[60px]" />
                </div>
                <Button onClick={async () => {
                  if (!selectedConsultant) { toast.error('اختر استشاري أولاً'); return; }
                  await saveDecision.mutateAsync({ token, projectId, selectedConsultantId: selectedConsultant, decisionType, justification, committeeNotes: notes });
                  utils.commandCenter.getProjectCommitteeDecision.invalidate({ token, projectId });
                  toast.success('تم حفظ القرار');
                }} className="w-full bg-purple-600 hover:bg-purple-700" disabled={saveDecision.isPending}>
                  {saveDecision.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ قرار اللجنة'}
                </Button>
              </div>
            </div>
          )}

          {/* Sheikh Issa Confirmation */}
          {decisionData?.decision && !decisionData.decision.isConfirmed && memberId === 'sheikh_issa' && (
            <div className="bg-amber-50 rounded-xl border border-amber-300 p-4">
              <h3 className="font-bold text-amber-800 mb-3">تأكيد القرار - الشيخ عيسى</h3>
              <p className="text-sm text-amber-700 mb-4">قرار اللجنة بانتظار تأكيدكم</p>
              <Button onClick={async () => {
                await confirmDecision.mutateAsync({ token, projectId });
                utils.commandCenter.getProjectCommitteeDecision.invalidate({ token, projectId });
                utils.commandCenter.getProjectsForEvaluation.invalidate({ token });
                toast.success('تم تأكيد القرار');
              }} className="w-full bg-amber-600 hover:bg-amber-700" disabled={confirmDecision.isPending}>
                {confirmDecision.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد القرار النهائي'}
              </Button>
            </div>
          )}

          {decisionData?.decision?.isConfirmed && (
            <div className="bg-green-50 rounded-xl border border-green-300 p-6 text-center">
              <Trophy className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-800 text-lg">تم تأكيد القرار</p>
              <p className="text-sm text-green-600 mt-1">تم التأكيد بواسطة {decisionData.decision.confirmedBy}</p>
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
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const [showSalwa, setShowSalwa] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showMilestonesKpis, setShowMilestonesKpis] = useState(false);

  const counts = trpc.commandCenter.getBubbleCounts.useQuery({ token });
  const notifications = trpc.commandCenter.getNotifications.useQuery({ token });
  const markAllRead = trpc.commandCenter.markAllNotificationsRead.useMutation();
  const utils = trpc.useUtils();

  const unreadCount = notifications.data?.filter((n: any) => !n.isRead).length || 0;

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync({ token });
    utils.commandCenter.getNotifications.invalidate({ token });
  };

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

      {/* News Ticker */}
      <NewsTicker token={token} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ─── Salwa Hero Section (same as main platform) ─── */}
        <div className="bg-gradient-to-l from-amber-50 via-white to-amber-50/30 rounded-2xl border border-amber-200/50 p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Salwa Large Image */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-amber-400/40 shadow-xl shadow-amber-500/20">
                <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-400 rounded-full border-3 border-white animate-pulse" />
            </div>

            {/* Salwa Info + Actions */}
            <div className="flex-1 text-center sm:text-right">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-0.5">{member.greeting}</h2>
              <p className="text-slate-500 text-sm mb-1">
                {new Date().toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-amber-700 text-sm font-medium mb-4">سلوى — المنسقة الرئيسية لمشاريع COMO</p>

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  onClick={() => setShowSalwa(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold shadow-md shadow-amber-500/20 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  تحدث مع سلوى
                </button>
                <button
                  onClick={() => setShowSalwa(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Mic className="w-4 h-4" />
                  رسالة صوتية
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Smart Bubbles Grid (mobile-friendly) ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {BUBBLES.map(bubble => {
            const count = counts.data?.[bubble.type as keyof typeof counts.data] || 0;
            return (
              <button
                key={bubble.type}
                onClick={() => {
                  if (bubble.type === "milestones_kpis") {
                    setActiveBubble("milestones_kpis");
                    setShowMilestonesKpis(true);
                  } else if (bubble.type === "evaluations") {
                    setActiveBubble("evaluations");
                    setShowEvaluation(true);
                  } else {
                    setActiveBubble(bubble.type);
                  }
                }}
                className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 text-center transition-all duration-300 hover:shadow-lg hover:border-slate-300 active:scale-[0.97]"
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${bubble.color} flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                  <bubble.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <p className="font-semibold text-slate-700 text-xs sm:text-sm mb-0.5">{bubble.label}</p>
                <p className="text-[10px] sm:text-xs text-slate-400">
                  {counts.isLoading ? "..." : `${count} عنصر`}
                </p>
                {typeof count === "number" && count > 0 && (
                  <div className="absolute -top-1 -left-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-md">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Recent Notifications ─── */}
        {notifications.data && notifications.data.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
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

      {/* Floating Salwa Button (large, prominent, mobile-friendly) */}
      <button
        onClick={() => setShowSalwa(true)}
        className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 w-16 h-16 sm:w-18 sm:h-18 rounded-full shadow-xl shadow-amber-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group overflow-hidden ring-3 ring-amber-400/50 ring-offset-2 ring-offset-white"
      >
        <img src={SALWA_AVATAR_URL} alt="سلوى" className="w-full h-full object-cover" />
        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
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
