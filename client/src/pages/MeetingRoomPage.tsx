import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation, useRoute } from "wouter";
import {
  Users, ArrowRight, Send, Mic, MicOff, Volume2, FileText,
  Upload, Play, Square, Loader2, CheckCircle, Clock,
  FileUp, X, ChevronDown, ChevronUp, Sparkles, Download
} from "lucide-react";

type Message = {
  id: number;
  speakerId: string;
  speakerType: string;
  messageText: string;
  audioUrl?: string | null;
  createdAt: string;
};

type Participant = {
  id: number;
  agentId: number;
  agentName: string;
  agentNameEn: string;
  agentRole: string;
  agentAvatar: string | null;
  agentColor: string | null;
};

export default function MeetingRoomPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/meetings/:id");
  const meetingId = params?.id ? Number(params.id) : 0;

  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAskingAgents, setIsAskingAgents] = useState(false);
  const [targetAgent, setTargetAgent] = useState<string>("all");
  const [showFiles, setShowFiles] = useState(false);
  const [showOutputs, setShowOutputs] = useState(false);
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: meeting, refetch: refetchMeeting } = trpc.meetings.get.useQuery(meetingId, {
    enabled: meetingId > 0,
  });

  const { data: messages, refetch: refetchMessages } = trpc.meetings.getMessages.useQuery(
    { meetingId },
    { enabled: meetingId > 0, refetchInterval: 3000 }
  );

  const startMeeting = trpc.meetings.start.useMutation({
    onSuccess: () => { refetchMeeting(); refetchMessages(); },
  });
  const endMeeting = trpc.meetings.end.useMutation({
    onSuccess: () => { refetchMeeting(); refetchMessages(); },
  });
  const sendMessage = trpc.meetings.sendMessage.useMutation();
  const askAgents = trpc.meetings.askAgents.useMutation();
  const transcribeVoice = trpc.meetings.transcribeVoice.useMutation();
  const uploadFile = trpc.meetings.uploadFile.useMutation({
    onSuccess: () => refetchMeeting(),
  });
  const analyzeFile = trpc.meetings.analyzeFile.useMutation({
    onSuccess: () => refetchMeeting(),
  });
  const generateMinutes = trpc.meetings.generateMinutes.useMutation();
  const retryTaskExecution = trpc.meetings.retryTaskExecution.useMutation();
  const saveToKnowledge = trpc.meetings.saveToKnowledge.useMutation();
  const [isRetryingTasks, setIsRetryingTasks] = useState(false);
  const textToSpeech = trpc.agents.textToSpeech.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get agent info by name
  const getAgentInfo = useCallback((speakerId: string): Participant | undefined => {
    return meeting?.participants.find(
      (p: Participant) => p.agentNameEn?.toLowerCase() === speakerId.toLowerCase() || p.agentName === speakerId
    );
  }, [meeting?.participants]);

  // Send text message and ask agents
  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    const msg = message.trim();
    setMessage("");
    setIsSending(true);
    setIsAskingAgents(true);

    try {
      // Send user message
      await sendMessage.mutateAsync({ meetingId, message: msg });
      await refetchMessages();

      // Ask agents to respond
      await askAgents.mutateAsync({
        meetingId,
        userMessage: msg,
        targetAgent: targetAgent === "all" ? undefined : targetAgent,
      });
      await refetchMessages();

      // Auto TTS for agent responses if enabled
      if (autoVoice) {
        const latestMessages = await refetchMessages();
        const agentMsgs = (latestMessages.data || []).filter(
          (m: Message) => m.speakerType === "agent" && m.speakerId !== "system"
        ).slice(-meeting!.participants.length);

        for (const agentMsg of agentMsgs) {
          try {
            const agentInfo = getAgentInfo(agentMsg.speakerId);
            if (agentInfo) {
              const ttsResult = await textToSpeech.mutateAsync({
                text: agentMsg.messageText.substring(0, 4096),
                agent: agentInfo.agentNameEn?.toLowerCase() as any,
              });
              const audio = new Audio(`data:audio/mpeg;base64,${ttsResult.audioBase64}`);
              await new Promise<void>((resolve) => {
                audio.onended = () => resolve();
                audio.onerror = () => resolve();
                audio.play();
              });
            }
          } catch (err) {
            console.error("TTS error:", err);
          }
        }
      }
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setIsSending(false);
      setIsAskingAgents(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const result = await transcribeVoice.mutateAsync({
              meetingId,
              audioBase64: base64,
              mimeType: "audio/webm",
            });
            if (result.text) {
              setMessage(result.text);
            }
          } catch (err) {
            console.error("Transcription error:", err);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      alert("لم يتم السماح بالوصول إلى الميكروفون");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // Play agent voice
  const playAgentVoice = async (msg: Message) => {
    const agentInfo = getAgentInfo(msg.speakerId);
    if (!agentInfo) return;

    setPlayingAudio(msg.speakerId);
    try {
      const result = await textToSpeech.mutateAsync({
        text: msg.messageText.substring(0, 4096),
        agent: agentInfo.agentNameEn?.toLowerCase() as any,
      });
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingAudio(null);
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setPlayingAudio(null);
    }
  };

  // File upload in meeting
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadFile.mutateAsync({
          meetingId,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "application/octet-stream",
        });
        await refetchMessages();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  // Generate minutes
  const handleGenerateMinutes = async () => {
    setIsGeneratingMinutes(true);
    try {
      await generateMinutes.mutateAsync(meetingId);
      await refetchMeeting();
      setShowOutputs(true);
    } catch (err) {
      console.error("Minutes error:", err);
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  // Save to knowledge base
  const handleSaveKnowledge = async () => {
    if (!meeting?.knowledgeItemsJson?.length) return;
    try {
      await saveToKnowledge.mutateAsync({
        meetingId,
        items: meeting.knowledgeItemsJson.map((item: any) => ({
          type: item.type === "lesson" ? "lesson" : item.type === "pattern" ? "pattern" : "insight",
          title: item.title,
          content: item.content,
          importance: "medium",
        })),
      });
      alert("تم حفظ المعرفة المؤسسية بنجاح ✅");
    } catch (err) {
      console.error("Save knowledge error:", err);
    }
  };

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const isActive = meeting.status === "in_progress";
  const isPreparing = meeting.status === "preparing";
  const isCompleted = meeting.status === "completed";

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex flex-col" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/meetings")} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
              <ArrowRight className="w-5 h-5 text-stone-500" />
            </button>
            <div>
              <h1 className="text-base font-bold text-stone-800">{meeting.title}</h1>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${
                  isActive ? "bg-emerald-100 text-emerald-700" :
                  isPreparing ? "bg-amber-100 text-amber-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {isActive ? "🟢 جاري" : isPreparing ? "⏳ تحضير" : "✅ مكتمل"}
                </Badge>
                <span className="text-xs text-stone-400">
                  {meeting.participants.length} مشارك
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto voice toggle */}
            <button
              onClick={() => setAutoVoice(!autoVoice)}
              className={`p-2 rounded-lg transition-colors ${autoVoice ? "bg-violet-100 text-violet-600" : "bg-stone-100 text-stone-400"}`}
              title={autoVoice ? "إيقاف الرد الصوتي التلقائي" : "تفعيل الرد الصوتي التلقائي"}
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {isPreparing && (
              <Button
                onClick={() => startMeeting.mutate(meetingId)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm"
                disabled={startMeeting.isPending}
              >
                <Play className="w-4 h-4 ml-1" />
                بدء الاجتماع
              </Button>
            )}
            {isActive && (
              <>
                <Button
                  onClick={handleGenerateMinutes}
                  variant="outline"
                  className="text-sm border-violet-200 text-violet-600 hover:bg-violet-50"
                  disabled={isGeneratingMinutes}
                >
                  {isGeneratingMinutes ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Sparkles className="w-4 h-4 ml-1" />}
                  محضر ذكي
                </Button>
                <Button
                  onClick={() => endMeeting.mutate(meetingId)}
                  className="bg-red-500 hover:bg-red-600 text-white text-sm"
                  disabled={endMeeting.isPending}
                >
                  <Square className="w-4 h-4 ml-1" />
                  إنهاء
                </Button>
              </>
            )}
            {isCompleted && (
              <Button
                onClick={() => setShowOutputs(!showOutputs)}
                variant="outline"
                className="text-sm border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <FileText className="w-4 h-4 ml-1" />
                المخرجات
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar - Participants & Files */}
        <aside className="w-64 border-l border-stone-200/60 bg-white/50 p-3 hidden lg:block overflow-y-auto">
          {/* Participants */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">المشاركون</h3>
            <div className="space-y-1.5">
              {/* User */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-50 border border-violet-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  أنت
                </div>
                <div>
                  <div className="text-sm font-bold text-stone-800">المدير</div>
                  <div className="text-[10px] text-stone-500">عبدالرحمن</div>
                </div>
              </div>
              {meeting.participants.map((p: Participant) => (
                <button
                  key={p.id}
                  onClick={() => setTargetAgent(
                    targetAgent === p.agentNameEn?.toLowerCase() ? "all" : p.agentNameEn?.toLowerCase() || "all"
                  )}
                  className={`flex items-center gap-2 p-2 rounded-lg w-full transition-colors ${
                    targetAgent === p.agentNameEn?.toLowerCase()
                      ? "bg-violet-50 border border-violet-200"
                      : "hover:bg-stone-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
                    {p.agentAvatar ? (
                      <img src={p.agentAvatar} alt={p.agentName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: p.agentColor || "#6366f1" }}>
                        {p.agentName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-stone-800">{p.agentName}</div>
                    <div className="text-[10px] text-stone-500">{p.agentRole}</div>
                  </div>
                </button>
              ))}
            </div>
            {targetAgent !== "all" && (
              <button
                onClick={() => setTargetAgent("all")}
                className="text-xs text-violet-500 hover:text-violet-700 mt-2 w-full text-center"
              >
                ← مخاطبة الجميع
              </button>
            )}
          </div>

          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">الملفات</h3>
              {(isActive || isPreparing) && (
                <label className="p-1 rounded-md hover:bg-stone-100 cursor-pointer">
                  <FileUp className="w-4 h-4 text-stone-400" />
                  <input type="file" multiple onChange={handleFileUpload} className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
                </label>
              )}
            </div>
            {meeting.files.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-3">لا توجد ملفات</p>
            ) : (
              <div className="space-y-1.5">
                {meeting.files.map((f: any) => (
                  <div key={f.id} className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-xs text-stone-700 truncate flex-1">{f.fileName}</span>
                    </div>
                    <div className="flex gap-1">
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline">
                        تحميل
                      </a>
                      {!f.extractedText && (isActive || isPreparing) && (
                        <button
                          onClick={() => analyzeFile.mutate({ meetingId, fileId: f.id })}
                          className="text-[10px] text-violet-500 hover:underline mr-2"
                          disabled={analyzeFile.isPending}
                        >
                          {analyzeFile.isPending ? "جاري التحليل..." : "تحليل"}
                        </button>
                      )}
                      {f.extractedText && (
                        <span className="text-[10px] text-emerald-500">✅ تم التحليل</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(messages || meeting.messages)?.map((msg: Message) => {
              const isUser = msg.speakerType === "user" || msg.speakerId === "user";
              const isSystem = msg.speakerId === "system";
              const agentInfo = !isUser && !isSystem ? getAgentInfo(msg.speakerId) : null;

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-xs text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                      {msg.messageText}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {isUser ? (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        أنت
                      </div>
                    ) : agentInfo ? (
                      <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm">
                        {agentInfo.agentAvatar ? (
                          <img src={agentInfo.agentAvatar} alt={agentInfo.agentName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: agentInfo.agentColor || "#6366f1" }}>
                            {agentInfo.agentName?.charAt(0)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xs">
                        🤖
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
                    {!isUser && agentInfo && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold" style={{ color: agentInfo.agentColor || "#6366f1" }}>
                          {agentInfo.agentName}
                        </span>
                        <span className="text-[10px] text-stone-400">{agentInfo.agentRole}</span>
                      </div>
                    )}
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tl-md"
                        : "bg-white border border-stone-200/60 text-stone-700 rounded-tr-md shadow-sm"
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.messageText}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-stone-400">
                        {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {!isUser && agentInfo && (
                        <button
                          onClick={() => playAgentVoice(msg)}
                          className={`p-1 rounded-md transition-colors ${
                            playingAudio === msg.speakerId
                              ? "bg-violet-100 text-violet-600"
                              : "hover:bg-stone-100 text-stone-400"
                          }`}
                          disabled={playingAudio === msg.speakerId}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isAskingAgents && (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-600 px-4 py-2 rounded-full text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  الوكلاء يفكرون ويحللون...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {(isActive || isPreparing) && (
            <div className="border-t border-stone-200/60 bg-white p-3">
              {/* Target indicator */}
              {targetAgent !== "all" && (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg">
                  <span>مخاطبة:</span>
                  <span className="font-bold">
                    {meeting.participants.find((p: Participant) => p.agentNameEn?.toLowerCase() === targetAgent)?.agentName || targetAgent}
                  </span>
                  <button onClick={() => setTargetAgent("all")} className="mr-auto text-violet-400 hover:text-violet-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Mobile file upload */}
              <div className="flex items-center gap-2 mb-2 lg:hidden">
                <label className="p-2 rounded-lg hover:bg-stone-100 cursor-pointer text-stone-400">
                  <Upload className="w-5 h-5" />
                  <input type="file" multiple onChange={handleFileUpload} className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
                </label>
                <span className="text-xs text-stone-400">{meeting.files.length} ملف</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2.5 rounded-xl transition-all ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text input */}
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={isPreparing ? "ابدأ الاجتماع أولاً للنقاش..." : "اكتب رسالتك أو تحدث بالصوت..."}
                  disabled={isPreparing || isSending}
                  className="flex-1 text-right"
                />

                {/* Send button */}
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || isSending || isPreparing}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>

              {transcribeVoice.isPending && (
                <div className="flex items-center gap-2 mt-2 text-xs text-violet-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري تحويل الصوت إلى نص...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Outputs Panel (Slide from bottom) */}
      {showOutputs && meeting.minutesSummary && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setShowOutputs(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="sticky top-0 bg-white border-b border-stone-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                مخرجات الاجتماع
              </h2>
              <button onClick={() => setShowOutputs(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                  📋 الملخص التنفيذي
                </h3>
                <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-xl leading-relaxed">
                  {meeting.minutesSummary}
                </p>
              </div>

              {/* Decisions */}
              {meeting.decisionsJson?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                    ✅ القرارات
                  </h3>
                  <div className="space-y-2">
                    {meeting.decisionsJson.map((d: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-stone-700">{d.decision}</div>
                          <div className="text-xs text-stone-500 mt-0.5">المسؤول: {d.responsible}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks - with execution status */}
              {meeting.extractedTasksJson?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                    📌 المهام المستخرجة وحالة التنفيذ
                  </h3>
                  <div className="mb-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="text-xs text-amber-700 flex items-center gap-1">
                      ⚙️ المهام يتم إنشاؤها تلقائياً في نظام المهام ويتم تنفيذها بواسطة الوكلاء المسؤولين. راجع لوحة المهام للتفاصيل.
                    </div>
                  </div>
                  <div className="space-y-2">
                    {meeting.extractedTasksJson.map((t: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="mt-0.5 flex-shrink-0">
                          {meeting.status === "completed" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-stone-700">{t.task}</div>
                          <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>المسؤول: <strong>{t.assignee}</strong></span>
                            <span>|الموعد: {t.deadline}</span>
                            <span>| الأولوية: {t.priority}</span>
                          </div>
                          {meeting.status === "completed" && (
                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              ✅ تم إنشاء المهمة وإسنادها للتنفيذ
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {meeting.status === "completed" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() => setLocation("/tasks")}
                        variant="outline"
                        className="text-sm border-blue-200 text-blue-600 hover:bg-blue-50 flex-1"
                      >
                        📋 عرض المهام في لوحة المهام
                      </Button>
                      <Button
                        onClick={async () => {
                          setIsRetryingTasks(true);
                          try {
                            const result = await retryTaskExecution.mutateAsync(meetingId);
                            await refetchMessages();
                            alert(`تم إنشاء ${result.createdCount} مهام من أصل ${result.totalTasks} وجاري تنفيذها`);
                          } catch (err: any) {
                            alert(err?.message || "فشل إعادة إنشاء المهام");
                          } finally {
                            setIsRetryingTasks(false);
                          }
                        }}
                        variant="outline"
                        className="text-sm border-amber-200 text-amber-600 hover:bg-amber-50 flex-1"
                        disabled={isRetryingTasks}
                      >
                        {isRetryingTasks ? (
                          <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                        ) : (
                          <span>🔄</span>
                        )}
                        إعادة تنفيذ المهام
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Knowledge Items */}
              {meeting.knowledgeItemsJson?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                    🧠 المعرفة المؤسسية
                  </h3>
                  <div className="space-y-2">
                    {meeting.knowledgeItemsJson.map((k: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-violet-50 border border-violet-100">
                        <div className="text-sm font-medium text-stone-700">{k.title}</div>
                        <div className="text-xs text-stone-500 mt-1">{k.content}</div>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleSaveKnowledge}
                    variant="outline"
                    className="mt-3 text-sm border-violet-200 text-violet-600 hover:bg-violet-50 w-full"
                    disabled={saveToKnowledge.isPending}
                  >
                    {saveToKnowledge.isPending ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 ml-2" />
                    )}
                    حفظ في قاعدة المعرفة
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
