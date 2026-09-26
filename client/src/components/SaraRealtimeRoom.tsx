import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mic, MicOff, Phone, PhoneOff, Send, Sparkles, Video, VideoOff, Volume2, X } from "lucide-react";
import { SaraLiveAvatarView, type SaraVisualSpeechCue } from "./SaraLiveAvatarView";

const SARA_PORTRAIT = "/sara/sara-approved-5256847d.webp";
const SARA_IDLE_VIDEO = "/sara/sara-idle-540p.webm";

type TranscriptEntry = { id: string; role: "member" | "sara" | "system"; text: string };
type VoicePhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

type RealtimeEvent = {
  type?: string;
  event_id?: string;
  item_id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  transcript?: string;
  delta?: string;
  error?: { message?: string };
  response?: { status?: string; status_details?: { error?: { message?: string } } };
};

function mergeTranscript(entries: TranscriptEntry[], next: TranscriptEntry) {
  const existing = entries.findIndex(item => item.id === next.id);
  if (existing === -1) return [...entries, next].slice(-30);
  return entries.map((item, index) => index === existing ? next : item);
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function float32ToPcmBinary(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return binary;
}

export function SaraRealtimeRoom({ token, memberName, isOpen, onClose }: { token: string; memberName: string; isOpen: boolean; onClose: () => void }) {
  const status = trpc.saraRealtime.status.useQuery({ token }, { enabled: isOpen && Boolean(token), staleTime: 60_000 });
  const createSession = trpc.saraRealtime.createSession.useMutation();
  const runTool = trpc.saraRealtime.runTool.useMutation();
  const recordTranscript = trpc.saraRealtime.recordTranscript.useMutation();
  const createAvatarToken = trpc.saraRealtime.createAvatarToken.useMutation();

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [muted, setMuted] = useState(false);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userSpeechSeconds, setUserSpeechSeconds] = useState(0);
  const [assistantSpeechSeconds, setAssistantSpeechSeconds] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [avatarConnected, setAvatarConnected] = useState(false);
  const [avatarCue, setAvatarCue] = useState<SaraVisualSpeechCue | null>(null);
  const [avatarInterruptId, setAvatarInterruptId] = useState(0);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputItemIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cueCounterRef = useRef(0);
  const assistantDraftRef = useRef("");
  const avatarTokenRef = useRef<string | null>(null);
  const avatarConnectedRef = useRef(false);

  const live = phase !== "idle" && phase !== "error";
  const estimatedUsd = useMemo(() => (
    (userSpeechSeconds / 60) * 0.0192 + (assistantSpeechSeconds / 60) * 0.0768
  ), [assistantSpeechSeconds, userSpeechSeconds]);

  const stopOutputCapture = useCallback(() => {
    try { audioProcessorRef.current?.disconnect(); } catch { /* ignore */ }
    audioProcessorRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  const stopSession = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.pause();
    }
    stopOutputCapture();
    sessionIdRef.current = null;
    outputItemIdRef.current = null;
    assistantDraftRef.current = "";
    setPhase("idle");
    setMuted(false);
    setMicrophoneAvailable(true);
    setElapsedSeconds(0);
    setUserSpeechSeconds(0);
    setAssistantSpeechSeconds(0);
    setAvatarToken(null);
    setAvatarConnected(false);
    setAvatarCue(null);
    setAvatarInterruptId(value => value + 1);
  }, [stopOutputCapture]);

  useEffect(() => () => stopSession(), [stopSession]);

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds(value => value + 1);
      if (phase === "listening") setUserSpeechSeconds(value => value + 1);
      if (phase === "speaking") setAssistantSpeechSeconds(value => value + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [live, phase]);

  const persistTranscript = useCallback((role: "member" | "sara", content: string, eventId: string) => {
    if (!content.trim()) return;
    recordTranscript.mutate({ token, role, content: content.trim(), sessionId: sessionIdRef.current, eventId });
  }, [recordTranscript, token]);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") throw new Error("قناة سارة الصوتية ليست جاهزة");
    channel.send(JSON.stringify(event));
  }, []);

  const handleToolCall = useCallback(async (event: RealtimeEvent) => {
    if (!event.call_id || !event.name) return;
    if (event.name !== "lookup_command_center" && event.name !== "lookup_executive_workspace") {
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ found: false, reason: "الأداة المطلوبة غير مسموحة" }) },
      });
      sendRealtimeEvent({ type: "response.create" });
      return;
    }
    try {
      const result = await runTool.mutateAsync({ token, toolName: event.name, arguments: event.arguments || "{}" });
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(result) },
      });
    } catch (reason) {
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ found: false, reason: reason instanceof Error ? reason.message : "تعذر قراءة المصدر" }) },
      });
    }
    sendRealtimeEvent({ type: "response.create" });
  }, [runTool, sendRealtimeEvent, token]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case "session.created":
      case "session.updated":
        setPhase("listening");
        break;
      case "input_audio_buffer.speech_started":
        setPhase("listening");
        setAvatarInterruptId(value => value + 1);
        break;
      case "input_audio_buffer.speech_stopped":
        setPhase("thinking");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = event.transcript?.trim();
        if (!text) break;
        const id = event.item_id || event.event_id || `member-${Date.now()}`;
        setTranscript(items => mergeTranscript(items, { id, role: "member", text }));
        persistTranscript("member", text, id);
        break;
      }
      case "response.output_audio_transcript.delta": {
        const delta = event.delta || "";
        if (!delta) break;
        setPhase("speaking");
        outputItemIdRef.current = event.item_id || outputItemIdRef.current || `sara-${Date.now()}`;
        assistantDraftRef.current += delta;
        setTranscript(items => mergeTranscript(items, { id: outputItemIdRef.current!, role: "sara", text: assistantDraftRef.current }));
        break;
      }
      case "response.output_audio_transcript.done": {
        const text = event.transcript?.trim() || assistantDraftRef.current.trim();
        const id = event.item_id || outputItemIdRef.current || event.event_id || `sara-${Date.now()}`;
        if (text) {
          setTranscript(items => mergeTranscript(items, { id, role: "sara", text }));
          persistTranscript("sara", text, id);
        }
        assistantDraftRef.current = "";
        outputItemIdRef.current = null;
        break;
      }
      case "response.function_call_arguments.done":
        setPhase("thinking");
        void handleToolCall(event);
        break;
      case "response.done":
        if (event.response?.status === "failed") {
          setPhase("error");
          toast.error(event.response.status_details?.error?.message || "تعذر إكمال رد سارة");
        } else {
          setPhase("listening");
        }
        break;
      case "error":
        setPhase("error");
        toast.error(event.error?.message || "حدث خطأ في جلسة سارة");
        break;
    }
  }, [handleToolCall, persistTranscript]);

  useEffect(() => { avatarTokenRef.current = avatarToken; }, [avatarToken]);
  useEffect(() => { avatarConnectedRef.current = avatarConnected; }, [avatarConnected]);

  const startOutputCapture = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass({ sampleRate: 24_000 });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silence = context.createGain();
      silence.gain.value = 0;
      let pending = "";
      processor.onaudioprocess = event => {
        if (!avatarTokenRef.current || !avatarConnectedRef.current) {
          pending = "";
          return;
        }
        pending += float32ToPcmBinary(event.inputBuffer.getChannelData(0));
        const bytesPerSegment = 24_000 * 2;
        while (pending.length >= bytesPerSegment) {
          const segment = pending.slice(0, bytesPerSegment);
          pending = pending.slice(bytesPerSegment);
          cueCounterRef.current += 1;
          setAvatarCue({ id: cueCounterRef.current, pcmBinary: segment });
        }
      };
      source.connect(processor);
      processor.connect(silence);
      silence.connect(context.destination);
      audioContextRef.current = context;
      audioProcessorRef.current = processor;
    } catch {
      // OpenAI audio continues even if browser-side visual synchronization is unavailable.
    }
  }, []);

  const startSession = useCallback(async () => {
    if (live || createSession.isPending) return;
    setPhase("connecting");
    setTranscript([{ id: "system-start", role: "system", text: "جارٍ فتح قناة سارة الصوتية الآمنة…" }]);
    try {
      const session = await createSession.mutateAsync({ token });
      sessionIdRef.current = session.sessionId;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      try {
        const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        localStreamRef.current = microphone;
        microphone.getTracks().forEach(track => peer.addTrack(track, microphone));
        setMicrophoneAvailable(true);
        setMuted(false);
      } catch {
        peer.addTransceiver("audio", { direction: "recvonly" });
        setMicrophoneAvailable(false);
        setMuted(true);
        setTranscript(items => mergeTranscript(items, { id: "system-microphone", role: "system", text: "لم يتوفر ميكروفون في هذا المتصفح؛ فتحت سارة وضع الكتابة مع بقاء الرد الصوتي." }));
      }

      peer.ontrack = ({ streams }) => {
        const remoteStream = streams[0];
        if (!remoteStream || !remoteAudioRef.current) return;
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        void remoteAudioRef.current.play().catch(() => toast.info("اضغط داخل النافذة للسماح بتشغيل صوت سارة"));
        startOutputCapture(remoteStream);
      };
      peer.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(peer.connectionState)) setPhase("error");
      };

      const channel = peer.createDataChannel("oai-events");
      dataChannelRef.current = channel;
      channel.onmessage = message => {
        try { handleRealtimeEvent(JSON.parse(message.data)); } catch { /* ignore malformed provider events */ }
      };
      channel.onopen = () => {
        setTranscript(items => mergeTranscript(items, { id: "system-start", role: "system", text: "سارة تستمع الآن. يمكنك مقاطعتها في أي لحظة." }));
        setPhase("thinking");
        channel.send(JSON.stringify({
          type: "response.create",
          response: { instructions: `ابدئي الآن بتحية قصيرة جدًا لـ${memberName} ثم اسأليه: شو بتحب نبدأ فيه؟` },
        }));
      };
      channel.onclose = () => setPhase("idle");

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!response.ok) throw new Error((await response.text()).slice(0, 300) || "تعذر الاتصال بـOpenAI Realtime");
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (reason) {
      stopSession();
      setPhase("error");
      toast.error(reason instanceof Error ? reason.message : "تعذر تشغيل سارة الصوتية");
    }
  }, [createSession, handleRealtimeEvent, live, memberName, startOutputCapture, stopSession, token]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) {
      toast.info("لا يوجد ميكروفون متاح في هذا المتصفح؛ استخدم الكتابة لسارة");
      return;
    }
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const sendText = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    if (!live) {
      toast.info("شغّل المحادثة الصوتية أولًا");
      return;
    }
    const id = `typed-${Date.now()}`;
    try {
      sendRealtimeEvent({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
      sendRealtimeEvent({ type: "response.create" });
      setTranscript(items => mergeTranscript(items, { id, role: "member", text }));
      persistTranscript("member", text, id);
      setTextInput("");
      setPhase("thinking");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر إرسال النص إلى سارة");
    }
  }, [live, persistTranscript, sendRealtimeEvent, textInput]);

  const toggleAvatar = useCallback(async () => {
    if (avatarToken) {
      setAvatarToken(null);
      setAvatarConnected(false);
      setAvatarCue(null);
      toast.info("تم إيقاف الصورة الحية؛ الصوت ما زال يعمل");
      return;
    }
    try {
      const result = await createAvatarToken.mutateAsync({ token, isSandbox: false });
      setAvatarToken(result.sessionToken);
      toast.success("جارٍ تشغيل صورة سارة الحية؛ يبدأ احتساب LiveAvatar عند اتصال الفيديو");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر تشغيل الصورة الحية لسارة");
    }
  }, [avatarToken, createAvatarToken, token]);

  if (!isOpen) return null;

  const phaseLabel: Record<VoicePhase, string> = {
    idle: "جاهزة",
    connecting: "جارٍ الاتصال",
    listening: !microphoneAvailable ? "وضع الكتابة" : muted ? "الميكروفون مكتوم" : "تستمع إليك",
    thinking: "تفكر وتراجع المصدر",
    speaking: "تتحدث الآن",
    error: "الاتصال متوقف",
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5" dir="rtl">
      <div className="grid h-[94dvh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/15 bg-[#071522] shadow-[0_40px_120px_rgba(0,0,0,.55)] lg:grid-cols-[0.88fr_1.12fr]">
        <section className="relative hidden min-h-0 bg-[#071522] p-4 lg:block">
          <SaraLiveAvatarView
            portrait={SARA_PORTRAIT}
            idleVideo={SARA_IDLE_VIDEO}
            sessionToken={avatarToken}
            speechCue={avatarCue}
            interruptId={avatarInterruptId}
            onStateChange={state => setAvatarConnected(state.connected)}
          />
          {!avatarToken && (
            <div className="absolute inset-x-8 bottom-10 rounded-2xl border border-white/10 bg-slate-950/75 p-4 text-right text-white backdrop-blur-xl">
              <p className="font-bold">سارة جاهزة بصورتها المعتمدة</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">شغّل الصورة الحية فقط عندما تحتاج حركة الشفاه؛ الصوت المباشر يعمل مستقلًا لتقليل التكلفة.</p>
              <Button onClick={toggleAvatar} disabled={createAvatarToken.isPending} className="mt-3 h-9 bg-amber-400 text-slate-950 hover:bg-amber-300">
                <Video className="ml-2 h-4 w-4" /> تشغيل الصورة الحية
              </Button>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_top_right,#fff7e6_0,#ffffff_36%,#f7f8fb_100%)]">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl ring-2 ring-amber-300/70 lg:hidden"><img src={SARA_PORTRAIT} alt="سارة" className="h-full w-full object-cover object-[center_18%]" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">سارة</h2>
                  <Badge className="border-0 bg-slate-900 text-[10px] text-white">واجهة COMO</Badge>
                  <Badge className="border-0 bg-amber-100 text-[10px] text-amber-900">Manus للتنفيذ العميق</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">محادثة مباشرة عبر WebRTC · أدوات البيانات للقراءة فقط</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { stopSession(); setAvatarToken(null); onClose(); }} className="rounded-xl"><X className="h-5 w-5" /></Button>
          </header>

          <div className="grid grid-cols-3 gap-2 border-b border-slate-200/80 px-4 py-3 sm:px-6">
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">الحالة</p><p className="mt-0.5 text-xs font-black text-slate-800">{phaseLabel[phase]}</p></div>
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">المدة</p><p className="mt-0.5 font-mono text-xs font-black text-slate-800">{formatClock(elapsedSeconds)}</p></div>
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">تقدير OpenAI</p><p className="mt-0.5 text-xs font-black text-slate-800">${estimatedUsd.toFixed(3)}</p></div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
            {transcript.length === 0 && (
              <div className="mx-auto mt-10 max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg"><Sparkles className="h-7 w-7" /></div>
                <h3 className="mt-4 text-lg font-black text-slate-900">صوت سارة أصبح مباشرًا</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">ابدأ الجلسة ثم تحدث بطبيعتك. تستطيع مقاطعتها، وهي تقرأ مصادر COMO المسموح بها دون تنفيذ أو إرسال خارجي.</p>
              </div>
            )}
            {transcript.map(entry => (
              <div key={entry.id} className={`flex ${entry.role === "member" ? "justify-start" : entry.role === "sara" ? "justify-end" : "justify-center"}`}>
                {entry.role === "system" ? (
                  <p className="rounded-full bg-slate-200/70 px-4 py-2 text-[11px] font-bold text-slate-500">{entry.text}</p>
                ) : (
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${entry.role === "member" ? "rounded-br-md bg-white text-slate-800 ring-1 ring-slate-200" : "rounded-bl-md bg-gradient-to-l from-amber-400 to-amber-500 text-slate-950"}`}>
                    <p className="mb-1 text-[10px] font-black opacity-60">{entry.role === "member" ? memberName : "سارة"}</p>
                    <p className="whitespace-pre-wrap">{entry.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <footer className="border-t border-slate-200/80 bg-white/90 p-4 backdrop-blur-xl sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              {!live ? (
                <Button onClick={startSession} disabled={createSession.isPending || !status.data?.realtimeConfigured} className="h-12 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800">
                  <Phone className="ml-2 h-5 w-5" /> ابدأ الحديث مع سارة
                </Button>
              ) : (
                <>
                  <Button onClick={toggleMute} variant="outline" className="h-11 rounded-2xl bg-white">
                    {!microphoneAvailable ? <MicOff className="ml-2 h-4 w-4 text-slate-400" /> : muted ? <MicOff className="ml-2 h-4 w-4 text-red-500" /> : <Mic className="ml-2 h-4 w-4 text-emerald-600" />}{!microphoneAvailable ? "كتابة فقط" : muted ? "فتح الميكروفون" : "كتم الميكروفون"}
                  </Button>
                  <Button onClick={stopSession} variant="outline" className="h-11 rounded-2xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100"><PhoneOff className="ml-2 h-4 w-4" /> إنهاء</Button>
                </>
              )}
              <Button onClick={toggleAvatar} disabled={createAvatarToken.isPending} variant="outline" className="h-11 rounded-2xl bg-white lg:hidden">
                {avatarToken ? <VideoOff className="ml-2 h-4 w-4" /> : <Video className="ml-2 h-4 w-4" />}{avatarToken ? "إيقاف الصورة" : "صورة حية"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={textInput} onChange={event => setTextInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") sendText(); }} placeholder="أو اكتب لسارة…" disabled={!live} className="h-11 rounded-xl bg-white" />
              <Button onClick={sendText} disabled={!live || !textInput.trim()} size="icon" className="h-11 w-11 flex-none rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400"><Send className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400">
              <span><Volume2 className="ml-1 inline h-3 w-3" /> التقدير لا يشمل تفريغ الصوت أو LiveAvatar</span>
              <span>لا إرسال خارجي · لا تنفيذ تلقائي</span>
            </div>
          </footer>
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        </section>
      </div>
    </div>
  );
}
