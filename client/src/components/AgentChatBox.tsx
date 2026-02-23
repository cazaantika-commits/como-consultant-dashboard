import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Trash2, History, Mic, MicOff, Square, Volume2, VolumeX, Pause } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { SalwaAvatar, SalwaSpeakingIndicator } from "./SalwaAvatar";

export type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

interface AgentChatBoxProps {
  agent: AgentType;
  agentData?: {
    name: string;
    role: string;
    avatarUrl?: string | null;
    color?: string | null;
    description?: string | null;
  };
  onClose: () => void;
}

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  model?: string;
}

// Model badge styling
const MODEL_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  "GPT-4o": { label: "GPT-4o", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", icon: "🟢" },
  "Claude Sonnet 4": { label: "Claude", bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", icon: "🟣" },
  "Gemini 2.5 Pro": { label: "Gemini", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", icon: "🔵" },
  "Manus LLM": { label: "Manus", bg: "bg-gray-100 dark:bg-gray-800/40", text: "text-gray-700 dark:text-gray-300", icon: "⚪" },
};

// Default model per agent
const AGENT_DEFAULT_MODEL: Record<AgentType, string> = {
  salwa: "GPT-4o",
  alina: "GPT-4o",
  khazen: "GPT-4o",
  buraq: "GPT-4o",
  farouq: "Claude Sonnet 4",
  khaled: "Claude Sonnet 4",
  baz: "Claude Sonnet 4",
  joelle: "Gemini 2.5 Pro",
};

const agentDefaults: Record<AgentType, { name: string; title: string; description: string; gradient: string; avatar: string }> = {
  salwa: {
    name: "سلوى",
    title: "المنسقة والمساعدة التنفيذية",
    description: "فحص الإيميل وإدارة المراسلات والتنسيق",
    gradient: "from-amber-500 to-yellow-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/sFWezOzuQFJxzpKl.png"
  },
  farouq: {
    name: "فاروق",
    title: "المحلل القانوني والمالي",
    description: "تحليل العروض والعقود والمستندات القانونية",
    gradient: "from-purple-500 to-violet-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/UphyyKbtnxhtJDDy.png"
  },
  khazen: {
    name: "خازن",
    title: "مدير الأرشفة والتخزين",
    description: "أرشفة المستندات وتنظيم الملفات",
    gradient: "from-blue-500 to-cyan-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/pTwUciwtTCWHPghO.png"
  },
  buraq: {
    name: "براق",
    title: "مراقب التنفيذ والجدول الزمني",
    description: "متابعة تنفيذ المشاريع والمواعيد",
    gradient: "from-orange-500 to-red-500",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/fsUKhyALKYaTfnMj.png"
  },
  khaled: {
    name: "خالد",
    title: "مدقق الجودة والامتثال الفني",
    description: "فحص الجودة والمعايير الفنية",
    gradient: "from-emerald-500 to-green-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/gFGfLWvLCJrhamTj.png"
  },
  alina: {
    name: "ألينا",
    title: "المديرة المالية ومراقبة التكاليف",
    description: "مراقبة الميزانيات والتحليل المالي",
    gradient: "from-yellow-500 to-amber-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/qJSwoNSavgDflAVc.png"
  },
  baz: {
    name: "باز",
    title: "المستشار الاستراتيجي",
    description: "استراتيجيات الابتكار والتحسين",
    gradient: "from-pink-500 to-rose-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/GorWfdugNGIAdkOm.png"
  },
  joelle: {
    name: "جويل",
    title: "محللة دراسات الجدوى والسوق",
    description: "تحليل السوق ودراسات الجدوى",
    gradient: "from-cyan-500 to-blue-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png"
  }
};

function ModelBadge({ model }: { model: string }) {
  const badge = MODEL_BADGES[model] || MODEL_BADGES["Manus LLM"];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${badge.bg} ${badge.text} leading-none`}>
      <span className="text-[8px]">{badge.icon}</span>
      {badge.label}
    </span>
  );
}

// TTS Audio playback hook - now returns speaking state for avatar animation
function useTTSPlayer() {
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [loadingMessageIdx, setLoadingMessageIdx] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsMutation = trpc.agents.textToSpeech.useMutation();

  const playAudio = useCallback(async (text: string, agent: AgentType, messageIdx: number) => {
    // If already playing this message, stop it
    if (playingMessageIdx === messageIdx) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingMessageIdx(null);
      setIsSpeaking(false);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLoadingMessageIdx(messageIdx);

    try {
      // Strip markdown formatting for cleaner speech
      const cleanText = text
        .replace(/[#*_~`>|[\](){}]/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 4096); // API limit

      const result = await ttsMutation.mutateAsync({ text: cleanText, agent });

      // Create audio from base64
      const audioBlob = new Blob(
        [Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
      };

      audio.onended = () => {
        setPlayingMessageIdx(null);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onpause = () => {
        setIsSpeaking(false);
      };

      audio.onerror = () => {
        setPlayingMessageIdx(null);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPlayingMessageIdx(messageIdx);
    } catch (err) {
      console.error("[TTS] Playback error:", err);
      setIsSpeaking(false);
    } finally {
      setLoadingMessageIdx(null);
    }
  }, [playingMessageIdx, ttsMutation]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingMessageIdx(null);
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { playingMessageIdx, loadingMessageIdx, isSpeaking, playAudio, stopAudio };
}

// Voice recording hook
function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcribeMutation = trpc.agents.transcribeVoice.useMutation();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("[Voice] Microphone access denied:", err);
      throw new Error("لم يتم السماح بالوصول للميكروفون");
    }
  }, []);

  const stopRecording = useCallback((): Promise<{ text: string }> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        reject(new Error("No active recording"));
        return;
      }

      mediaRecorder.onstop = async () => {
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);

          const result = await transcribeMutation.mutateAsync({
            audioBase64: base64,
            mimeType: "audio/webm",
            language: "ar",
          });

          setIsTranscribing(false);
          resolve({ text: result.text });
        } catch (err) {
          setIsTranscribing(false);
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, [transcribeMutation]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    chunksRef.current = [];
  }, []);

  return { isRecording, recordingTime, isTranscribing, startRecording, stopRecording, cancelRecording };
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Speaker button component for each agent message
function SpeakerButton({ 
  message, agent, messageIdx, playingIdx, loadingIdx, onPlay 
}: { 
  message: Message; agent: AgentType; messageIdx: number; 
  playingIdx: number | null; loadingIdx: number | null;
  onPlay: (text: string, agent: AgentType, idx: number) => void;
}) {
  const isPlaying = playingIdx === messageIdx;
  const isLoading = loadingIdx === messageIdx;

  return (
    <button
      onClick={() => onPlay(message.content, agent, messageIdx)}
      disabled={isLoading || (loadingIdx !== null && loadingIdx !== messageIdx)}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
        isPlaying 
          ? "bg-primary/20 text-primary hover:bg-primary/30" 
          : isLoading
            ? "bg-muted text-muted-foreground"
            : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
      }`}
      title={isPlaying ? "إيقاف الصوت" : "تشغيل الصوت"}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </button>
  );
}

export function AgentChatBox({ agent, agentData, onClose }: AgentChatBoxProps) {
  const defaults = agentDefaults[agent];
  const agentName = agentData?.name || defaults.name;
  const agentTitle = agentData?.role || defaults.title;
  const agentAvatar = agentData?.avatarUrl || defaults.avatar;
  const agentDesc = defaults.description;
  const defaultModel = AGENT_DEFAULT_MODEL[agent];
  const isSalwa = agent === "salwa";

  const welcomeMsg = `مرحباً! أنا ${agentName}، ${agentTitle}. كيف يمكنني مساعدتك؟`;

  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: welcomeMsg, timestamp: new Date(), model: defaultModel }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.agents.chat.useMutation();
  const clearHistoryMutation = trpc.agents.clearChatHistory.useMutation();
  const { isRecording, recordingTime, isTranscribing, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const { playingMessageIdx, loadingMessageIdx, isSpeaking, playAudio, stopAudio } = useTTSPlayer();

  // Load chat history - always refetch on mount to get latest messages
  const { data: chatHistoryData } = trpc.agents.getChatHistory.useQuery(
    { agent, limit: 100 },
    { enabled: !historyLoaded, staleTime: 0, refetchOnMount: 'always' as const, gcTime: 0 }
  );

  useEffect(() => {
    if (chatHistoryData && chatHistoryData.length > 0 && !historyLoaded) {
      const loadedMessages: Message[] = chatHistoryData.map(h => ({
        role: h.role === "user" ? "user" as const : "agent" as const,
        content: h.content,
        timestamp: new Date(h.createdAt),
        model: h.role === "assistant" ? defaultModel : undefined
      }));
      setMessages([
        { role: "agent", content: welcomeMsg, timestamp: new Date(chatHistoryData[0].createdAt), model: defaultModel },
        ...loadedMessages
      ]);
      setHistoryLoaded(true);
    } else if (chatHistoryData && chatHistoryData.length === 0) {
      setHistoryLoaded(true);
    }
  }, [chatHistoryData, historyLoaded, welcomeMsg, defaultModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearHistory = async () => {
    stopAudio();
    try {
      await clearHistoryMutation.mutateAsync({ agent });
      setMessages([
        { role: "agent", content: welcomeMsg, timestamp: new Date(), model: defaultModel }
      ]);
    } catch {
      // silently fail
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.content !== welcomeMsg)
        .map(m => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content
        }));

      const response = await chatMutation.mutateAsync({
        agent,
        message: text.trim(),
        conversationHistory
      });

      const newMessageIdx = messages.length + 1; // +1 because we added user message
      const agentMessage: Message = {
        role: "agent",
        content: response.response,
        timestamp: new Date(),
        model: response.model || defaultModel
      };

      setMessages(prev => [...prev, agentMessage]);

      // Auto-speak if enabled
      if (autoSpeak) {
        setTimeout(() => {
          playAudio(response.response, agent, newMessageIdx);
        }, 300);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "agent",
        content: "⚠️ عذراً، حدث خطأ. حاول مرة أخرى.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = async () => {
    setMicError(null);
    if (isRecording) {
      try {
        const result = await stopRecording();
        if (result.text.trim()) {
          await sendMessage(result.text);
        }
      } catch (err: any) {
        setMicError(err.message || "فشل التحويل الصوتي");
        setTimeout(() => setMicError(null), 3000);
      }
    } else {
      try {
        await startRecording();
      } catch (err: any) {
        setMicError(err.message || "لم يتم السماح بالوصول للميكروفون");
        setTimeout(() => setMicError(null), 3000);
      }
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  return (
    <Card className="fixed bottom-4 left-4 w-[420px] h-[650px] shadow-2xl flex flex-col z-50 overflow-hidden border-0 rounded-2xl">
      {/* Header */}
      <div className={`bg-gradient-to-r ${defaults.gradient} text-white p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {isSalwa ? (
            /* Salwa gets the animated avatar */
            <div className="relative -my-2 -ml-2">
              <SalwaAvatar
                avatarUrl={agentAvatar}
                isSpeaking={isSpeaking}
                isLoading={loadingMessageIdx !== null}
                size="sm"
                className=""
              />
            </div>
          ) : (
            <div className="relative">
              <img src={agentAvatar} alt={agentName} className="w-12 h-12 rounded-full object-cover border-2 border-white/40 shadow-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-lg leading-tight">{agentName}</h3>
            <p className="text-sm opacity-90 leading-tight">{agentTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Auto-speak toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setAutoSpeak(!autoSpeak); if (autoSpeak) stopAudio(); }}
            className={`text-white hover:bg-white/20 rounded-full ${autoSpeak ? "bg-white/25" : ""}`}
            title={autoSpeak ? "إيقاف الرد الصوتي التلقائي" : "تفعيل الرد الصوتي التلقائي"}
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {messages.length > 1 && (
            <Button variant="ghost" size="icon" onClick={handleClearHistory} className="text-white hover:bg-white/20 rounded-full" title="مسح المحادثة">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Salwa speaking indicator bar */}
      {isSalwa && isSpeaking && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-center">
          <SalwaSpeakingIndicator isSpeaking={isSpeaking} />
        </div>
      )}

      {/* Auto-speak indicator */}
      {autoSpeak && !isSpeaking && (
        <div className="bg-primary/10 px-3 py-1 flex items-center justify-center gap-1.5 text-xs text-primary border-b">
          <Volume2 className="h-3 w-3" />
          <span>الرد الصوتي التلقائي مفعّل {isSalwa ? "(HD)" : ""}</span>
        </div>
      )}

      {/* History indicator */}
      {chatHistoryData && chatHistoryData.length > 0 && historyLoaded && (
        <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground border-b">
          <History className="h-3 w-3" />
          <span>تم تحميل {chatHistoryData.length} رسالة سابقة</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20" dir="rtl">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "agent" && (
              isSalwa ? (
                /* Salwa messages: show animated mini avatar when that message is playing */
                <div className="relative shrink-0 mt-1">
                  {playingMessageIdx === idx ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-400 ring-offset-1 animate-pulse">
                      <img src={agentAvatar} alt={agentName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <img src={agentAvatar} alt={agentName} className="w-8 h-8 rounded-full object-cover" />
                  )}
                </div>
              ) : (
                <img src={agentAvatar} alt={agentName} className="w-8 h-8 rounded-full object-cover shrink-0 mt-1" />
              )
            )}
            <div className={`max-w-[78%] rounded-2xl p-3 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tl-sm"
                : isSalwa && playingMessageIdx === idx
                  ? "bg-amber-50 border-2 border-amber-300 shadow-md shadow-amber-100 rounded-tr-sm"
                  : "bg-card border shadow-sm rounded-tr-sm"
            }`}>
              {msg.role === "agent" ? (
                <div className="text-sm"><Streamdown>{msg.content}</Streamdown></div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] opacity-50">
                    {msg.timestamp.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {msg.role === "agent" && msg.model && <ModelBadge model={msg.model} />}
                </div>
                {msg.role === "agent" && msg.content !== welcomeMsg && (
                  <SpeakerButton
                    message={msg}
                    agent={agent}
                    messageIdx={idx}
                    playingIdx={playingMessageIdx}
                    loadingIdx={loadingMessageIdx}
                    onPlay={playAudio}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            {isSalwa ? (
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-amber-300 ring-offset-1">
                <img src={agentAvatar} alt={agentName} className="w-full h-full object-cover animate-pulse" />
              </div>
            ) : (
              <img src={agentAvatar} alt={agentName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            )}
            <div className="bg-card border rounded-2xl rounded-tr-sm p-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{agentName} {isSalwa ? "تفكر..." : "يكتب..."}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording indicator */}
      {(isRecording || isTranscribing) && (
        <div className="px-3 py-2 border-t bg-red-50 dark:bg-red-950/30 flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-2">
            {isRecording && (
              <>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  جاري التسجيل... {formatRecordingTime(recordingTime)}
                </span>
              </>
            )}
            {isTranscribing && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">جاري تحويل الصوت لنص...</span>
              </>
            )}
          </div>
          {isRecording && (
            <Button variant="ghost" size="sm" onClick={handleCancelRecording} className="text-red-500 hover:text-red-700 h-7 px-2">
              <Square className="h-3 w-3 ml-1" />
              إلغاء
            </Button>
          )}
        </div>
      )}

      {/* Mic error */}
      {micError && (
        <div className="px-3 py-1.5 bg-destructive/10 text-destructive text-xs text-center border-t">
          {micError}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isRecording ? "اضغط الميكروفون لإيقاف التسجيل..." : `تحدث مع ${agentName}...`}
            disabled={isLoading || isRecording || isTranscribing}
            className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
            dir="rtl"
          />
          
          {/* Mic button */}
          <Button
            onClick={handleMicClick}
            disabled={isLoading || isTranscribing}
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            className={`rounded-full shrink-0 transition-all ${isRecording ? "animate-pulse" : ""}`}
            title={isRecording ? "إيقاف التسجيل وإرسال" : "تسجيل صوتي"}
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isRecording}
            size="icon"
            className="rounded-full shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          مدعوم بالذكاء الاصطناعي • {agentDesc} • 🎤 صوتي • 🔊 HD
        </p>
      </div>
    </Card>
  );
}
