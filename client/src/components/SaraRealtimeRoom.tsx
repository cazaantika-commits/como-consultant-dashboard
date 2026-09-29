import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import saraPortrait from "@/assets/como/sara.webp";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BellRing, ListChecks, Mic, MicOff, Newspaper, Phone, PhoneOff, Send, Sparkles, Video, VideoOff, X } from "lucide-react";
import { SaraLiveAvatarView, type SaraVisualAudioDelta } from "./SaraLiveAvatarView";
import { ComoPrimaryNav } from "./ComoPrimaryNav";

const SARA_PORTRAIT = saraPortrait;

type TranscriptEntry = { id: string; role: "member" | "sara" | "system"; text: string };
type VoicePhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
type BriefingMode = "auto" | "full" | "today" | "changes";

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

function float32ToPcmBase64(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

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

export function SaraRealtimeRoom({ token, memberName, isOpen, onClose, autoStart = false, streamlined = false }: { token: string; memberName: string; isOpen: boolean; onClose: () => void; autoStart?: boolean; streamlined?: boolean }) {
  const status = trpc.saraRealtime.status.useQuery({ token }, { enabled: isOpen && Boolean(token), staleTime: 60_000 });
  const briefingStatus = trpc.saraRealtime.briefingStatus.useQuery({ token }, { enabled: isOpen && Boolean(token), staleTime: 20_000 });
  const createSession = trpc.saraRealtime.createSession.useMutation();
  const runTool = trpc.saraRealtime.runTool.useMutation();
  const recordTranscript = trpc.saraRealtime.recordTranscript.useMutation();
  const createAvatarToken = trpc.saraRealtime.createAvatarToken.useMutation();
  const prepareBriefing = trpc.saraRealtime.prepareBriefing.useMutation();
  const completeBriefing = trpc.saraRealtime.completeBriefing.useMutation();

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [muted, setMuted] = useState(false);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userSpeechSeconds, setUserSpeechSeconds] = useState(0);
  const [assistantSpeechSeconds, setAssistantSpeechSeconds] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [avatarAudioDelta, setAvatarAudioDelta] = useState<SaraVisualAudioDelta | null>(null);
  const [avatarCommitId, setAvatarCommitId] = useState(0);
  const [avatarInterruptId, setAvatarInterruptId] = useState(0);
  const [avatarOwnsPlayback, setAvatarOwnsPlayback] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const avatarCommitTimerRef = useRef<number | null>(null);
  const outputItemIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cueCounterRef = useRef(0);
  const assistantDraftRef = useRef("");
  const lastMemberTextRef = useRef("");
  const avatarTokenRef = useRef<string | null>(null);
  const avatarConnectedRef = useRef(false);
  const avatarResponseStreamingRef = useRef<boolean | null>(null);
  const autoStartedRef = useRef(false);
  const briefingStartedRef = useRef(false);
  const pendingBriefingDeliveryRef = useRef<number | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const live = phase !== "idle" && phase !== "error";
  const estimatedUsd = useMemo(() => (
    (userSpeechSeconds / 60) * 0.0192 + (assistantSpeechSeconds / 60) * 0.0768
  ), [assistantSpeechSeconds, userSpeechSeconds]);

  const stopOutputCapture = useCallback(() => {
    if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
    avatarCommitTimerRef.current = null;
    try { audioProcessorRef.current?.disconnect(); } catch { /* ignore */ }
    audioProcessorRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  const stopSession = useCallback(() => {
    stopOutputCapture();
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
    sessionIdRef.current = null;
    outputItemIdRef.current = null;
    assistantDraftRef.current = "";
    lastMemberTextRef.current = "";
    briefingStartedRef.current = false;
    pendingBriefingDeliveryRef.current = null;
    setPhase("idle");
    setMuted(false);
    setMicrophoneAvailable(true);
    setElapsedSeconds(0);
    setUserSpeechSeconds(0);
    setAssistantSpeechSeconds(0);
    setAvatarToken(null);
    avatarConnectedRef.current = false;
    avatarResponseStreamingRef.current = null;
    setAvatarOwnsPlayback(false);
    setAvatarAudioDelta(null);
    setAvatarCommitId(value => value + 1);
    setAvatarInterruptId(value => value + 1);
    setAudioBlocked(false);
  }, [stopOutputCapture]);

  useEffect(() => () => stopSession(), [stopSession]);

  useEffect(() => {
    const panel = transcriptScrollRef.current;
    if (!panel) return;
    panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  }, [transcript]);

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

  const finishPendingBriefing = useCallback((completed: boolean) => {
    const deliveryId = pendingBriefingDeliveryRef.current;
    if (!deliveryId) return;
    pendingBriefingDeliveryRef.current = null;
    completeBriefing.mutate({ token, deliveryId, completed }, {
      onSuccess: () => { void briefingStatus.refetch(); },
    });
  }, [briefingStatus, completeBriefing, token]);

  const playBriefing = useCallback(async (mode: BriefingMode) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      if (mode !== "auto") toast.info("لحظة، سارة بعدها عم تتصل");
      return;
    }
    try {
      if (pendingBriefingDeliveryRef.current) {
        try { sendRealtimeEvent({ type: "response.cancel" }); } catch { /* no active response */ }
        finishPendingBriefing(false);
      }
      setPhase("thinking");
      const briefing = await prepareBriefing.mutateAsync({ token, mode, sessionId: sessionIdRef.current });
      pendingBriefingDeliveryRef.current = briefing.deliveryId;
      setTranscript(items => mergeTranscript(items, {
        id: `briefing-${briefing.deliveryId}`,
        role: "system",
        text: `${briefing.title} · أعدّها Manus من COMO الآن`,
      }));
      sendRealtimeEvent({
        type: "response.create",
        response: {
          instructions: `هذه نشرة أعدّها Manus من COMO Next الحالي فقط. قدّمي محتواها بالترتيب نفسه ومن دون حذف حقيقة أو إضافة معلومة. لا تقرئي العلامة ---؛ استخدميها كوقفة قصيرة طبيعية واتركي مجالًا لعبد الرحمن أن يقاطعك أو يعلّق. تكلمي بلبنانية لطيفة ومحترمة، أسرع بدرجة واحدة فقط من الطبيعي، ومن دون ألقاب أو تملق زائد.\n\nالنشرة:\n${briefing.text}`,
        },
      });
    } catch (reason) {
      setPhase("listening");
      toast.error(reason instanceof Error ? reason.message : "تعذر تجهيز نشرة سارة");
    }
  }, [finishPendingBriefing, prepareBriefing, sendRealtimeEvent, token]);

  const handleToolCall = useCallback(async (event: RealtimeEvent) => {
    if (!event.call_id || !event.name) return;
    if (event.name !== "lookup_executive_workspace" && event.name !== "direct_manus_in_work_file") {
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ found: false, reason: "الأداة المطلوبة غير مسموحة" }) },
      });
      sendRealtimeEvent({ type: "response.create" });
      return;
    }
    try {
      const result = await runTool.mutateAsync({
        token,
        toolName: event.name,
        arguments: event.arguments || "{}",
        sessionId: sessionIdRef.current,
        eventId: event.call_id,
      });
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
        if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
        avatarCommitTimerRef.current = null;
        avatarResponseStreamingRef.current = null;
        setAvatarOwnsPlayback(false);
        setAvatarInterruptId(value => value + 1);
        finishPendingBriefing(false);
        break;
      case "input_audio_buffer.speech_stopped":
        setPhase("thinking");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = event.transcript?.trim();
        if (!text) break;
        const id = event.item_id || event.event_id || `member-${Date.now()}`;
        lastMemberTextRef.current = text;
        setTranscript(items => mergeTranscript(items, { id, role: "member", text }));
        persistTranscript("member", text, id);
        break;
      }
      case "response.created":
        if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
        avatarCommitTimerRef.current = null;
        avatarResponseStreamingRef.current = Boolean(avatarTokenRef.current && avatarConnectedRef.current);
        if (avatarResponseStreamingRef.current) setAvatarOwnsPlayback(true);
        break;
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
          if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
          avatarCommitTimerRef.current = null;
          avatarResponseStreamingRef.current = null;
          setAvatarOwnsPlayback(false);
          setAvatarInterruptId(value => value + 1);
          finishPendingBriefing(false);
          setPhase("error");
          toast.error(event.response.status_details?.error?.message || "تعذر إكمال رد سارة");
        } else {
          if (avatarResponseStreamingRef.current) {
            if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
            avatarCommitTimerRef.current = window.setTimeout(() => {
              setAvatarCommitId(value => value + 1);
              avatarResponseStreamingRef.current = null;
              avatarCommitTimerRef.current = null;
            }, 250);
          } else {
            avatarResponseStreamingRef.current = null;
          }
          finishPendingBriefing(event.response?.status === "completed");
          setPhase("listening");
        }
        break;
      case "error":
        if (avatarCommitTimerRef.current !== null) window.clearTimeout(avatarCommitTimerRef.current);
        avatarCommitTimerRef.current = null;
        avatarResponseStreamingRef.current = null;
        setAvatarOwnsPlayback(false);
        setAvatarInterruptId(value => value + 1);
        setPhase("error");
        toast.error(event.error?.message || "حدث خطأ في جلسة سارة");
        break;
    }
  }, [finishPendingBriefing, handleToolCall, persistTranscript]);

  useEffect(() => { avatarTokenRef.current = avatarToken; }, [avatarToken]);

  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = avatarOwnsPlayback;
    audio.volume = avatarOwnsPlayback ? 0 : 1;
    if (!avatarOwnsPlayback && live) {
      void audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    }
  }, [avatarOwnsPlayback, live]);

  const handleAvatarStateChange = useCallback((state: { connected: boolean; speaking: boolean; error: string | null }) => {
    avatarConnectedRef.current = state.connected;
    if (!state.connected) setAvatarOwnsPlayback(false);
  }, []);

  const handleAvatarAudioRouteFailure = useCallback(() => {
    setAvatarOwnsPlayback(false);
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
    void audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, []);

  const handleAvatarPlaybackComplete = useCallback(() => {
    setAvatarOwnsPlayback(false);
  }, []);

  const startOutputCapture = useCallback((stream: MediaStream) => {
    stopOutputCapture();
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass({ sampleRate: 24_000 });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silence = context.createGain();
      silence.gain.value = 0;
      processor.onaudioprocess = event => {
        if (!avatarResponseStreamingRef.current) return;
        cueCounterRef.current += 1;
        setAvatarAudioDelta({
          id: cueCounterRef.current,
          pcmBase64: float32ToPcmBase64(event.inputBuffer.getChannelData(0)),
        });
      };
      source.connect(processor);
      processor.connect(silence);
      silence.connect(context.destination);
      audioContextRef.current = context;
      audioProcessorRef.current = processor;
      void context.resume().catch(() => undefined);
    } catch {
      setAvatarOwnsPlayback(false);
    }
  }, [stopOutputCapture]);

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
        void remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
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
        if (!briefingStartedRef.current) {
          briefingStartedRef.current = true;
          void playBriefing("auto");
        }
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
  }, [createSession, handleRealtimeEvent, live, playBriefing, startOutputCapture, stopSession, token]);

  const startAvatar = useCallback(async (quiet = false) => {
    if (avatarTokenRef.current || createAvatarToken.isPending) return true;
    try {
      const result = await createAvatarToken.mutateAsync({ token, isSandbox: false });
      setAvatarToken(result.sessionToken);
      if (!quiet) toast.success("سارة تتحرك الآن مع صوتها");
      return true;
    } catch (reason) {
      if (!quiet) toast.error(reason instanceof Error ? reason.message : "تعذر تشغيل الصورة الحية لسارة");
      return false;
    }
  }, [createAvatarToken, token]);

  useEffect(() => {
    if (!isOpen) {
      autoStartedRef.current = false;
      return;
    }
    if (!autoStart || !status.data || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void (async () => {
      if (status.data.liveAvatarConfigured) await startAvatar(true);
      if (status.data.realtimeConfigured) await startSession();
      else setPhase("error");
    })();
  }, [autoStart, isOpen, startAvatar, startSession, status.data]);

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
      lastMemberTextRef.current = text;
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
      avatarConnectedRef.current = false;
      avatarResponseStreamingRef.current = null;
      setAvatarOwnsPlayback(false);
      setAvatarAudioDelta(null);
      setAvatarCommitId(value => value + 1);
      toast.info("تم إيقاف الصورة الحية؛ الصوت ما زال يعمل");
      return;
    }
    await startAvatar();
  }, [avatarToken, startAvatar]);

  if (!isOpen) return null;

  const phaseLabel: Record<VoicePhase, string> = {
    idle: "جاهزة",
    connecting: "جارٍ الاتصال",
    listening: !microphoneAvailable ? "وضع الكتابة" : muted ? "الميكروفون مكتوم" : "تستمع إليك",
    thinking: "تفكر وتراجع المصدر",
    speaking: "تتحدث الآن",
    error: "الاتصال متوقف",
  };
  const briefingButtonDisabled = !live || prepareBriefing.isPending || phase === "connecting" || phase === "thinking" || phase === "speaking";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-slate-950/70 p-0 backdrop-blur-sm sm:p-5"
      dir="rtl"
      onPointerDown={() => {
        if (audioContextRef.current?.state === "suspended") void audioContextRef.current.resume().catch(() => undefined);
        if (!audioBlocked || !remoteAudioRef.current) return;
        void remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => undefined);
      }}
    >
      <div className="relative grid h-[100dvh] w-full max-w-6xl grid-rows-[42%_58%] overflow-hidden border border-white/15 bg-[#071522] shadow-[0_40px_120px_rgba(0,0,0,.55)] sm:h-[94dvh] sm:rounded-[30px] lg:grid-cols-[0.9fr_1.1fr] lg:grid-rows-1">
        {streamlined ? <div className="absolute inset-x-3 top-3 z-30 mx-auto max-w-xl sm:inset-x-auto sm:left-1/2 sm:top-5 sm:w-[min(560px,calc(100%-40px))] sm:-translate-x-1/2"><ComoPrimaryNav active="sara" beforeNavigate={stopSession} dark /></div> : null}

        <section className={`relative min-h-0 bg-[#071522] p-1.5 sm:p-4 ${streamlined ? "sm:pt-20" : ""}`}>
          <SaraLiveAvatarView
            portrait={SARA_PORTRAIT}
            sessionToken={avatarToken}
            audioDelta={avatarAudioDelta}
            commitId={avatarCommitId}
            interruptId={avatarInterruptId}
            playAudio={avatarOwnsPlayback}
            onStateChange={handleAvatarStateChange}
            onAudioRouteFailure={handleAvatarAudioRouteFailure}
            onPlaybackComplete={handleAvatarPlaybackComplete}
          />
          {!streamlined && !avatarToken ? (
            <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-right text-white backdrop-blur-xl sm:inset-x-8 sm:bottom-10 sm:p-4">
              <p className="text-sm font-bold sm:text-base">سارة أمامك بحركتها المحلية</p>
              <p className="mt-1 hidden text-xs leading-5 text-slate-300 sm:block">الحركة الهادئة تعمل تلقائيًا. شغّل الصورة الحية فقط عندما تحتاج مزامنة الشفاه.</p>
              <Button onClick={toggleAvatar} disabled={createAvatarToken.isPending} className="mt-2 h-8 bg-amber-400 text-xs text-slate-950 hover:bg-amber-300 sm:mt-3 sm:h-9 sm:text-sm"><Video className="ml-2 h-4 w-4" /> تشغيل الصورة الحية</Button>
            </div>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_top_right,#fff7e6_0,#ffffff_36%,#f7f8fb_100%)]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-2.5 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-slate-900 sm:text-xl">المحادثة</h2>
                {streamlined ? <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-800">{phaseLabel[phase]}</Badge> : <><Badge className="border-0 bg-slate-900 text-[10px] text-white">واجهة COMO</Badge><Badge className="border-0 bg-amber-100 text-[10px] text-amber-900">Manus للتنفيذ العميق</Badge></>}
              </div>
              <p className="mt-1 hidden text-xs text-slate-500 sm:block">{streamlined ? "تكلم بطبيعتك؛ سارة تسمعك وتقرأ مكتبك." : "محادثة مباشرة عبر WebRTC · القراءة فورية · الحفظ كمقترح للمراجعة فقط"}</p>
            </div>
            {!streamlined ? <Button variant="ghost" size="icon" onClick={() => { stopSession(); setAvatarToken(null); onClose(); }} className="rounded-xl"><X className="h-5 w-5" /></Button> : null}
          </header>

          {!streamlined ? <div className="grid grid-cols-3 gap-2 border-b border-slate-200/80 px-4 py-3 sm:px-6">
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">الحالة</p><p className="mt-0.5 text-xs font-black text-slate-800">{phaseLabel[phase]}</p></div>
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">المدة</p><p className="mt-0.5 font-mono text-xs font-black text-slate-800">{formatClock(elapsedSeconds)}</p></div>
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><p className="text-[10px] font-bold text-slate-400">تقدير OpenAI</p><p className="mt-0.5 text-xs font-black text-slate-800">${estimatedUsd.toFixed(3)}</p></div>
          </div> : null}

          <div ref={transcriptScrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-3 sm:px-6 sm:py-5">
            {transcript.length === 0 ? (
              <div className="mx-auto mt-6 max-w-md text-center sm:mt-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg"><Sparkles className="h-6 w-6" /></div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{phase === "connecting" ? "سارة تتصل الآن" : phase === "thinking" ? "سارة تراجع أولوياتك" : "سارة جاهزة معك"}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">تكلم مباشرة. ستعطيك الزبدة، وتستمع لتحديثاتك، وتحفظ ما تطلبه كمقترح للمراجعة.</p>
              </div>
            ) : null}
            {transcript.map(entry => (
              <div key={entry.id} className={`flex ${entry.role === "member" ? "justify-start" : entry.role === "sara" ? "justify-end" : "justify-center"}`}>
                {entry.role === "system" ? <p className="max-w-[94%] rounded-full bg-slate-200/70 px-3 py-2 text-center text-[10px] font-bold leading-4 text-slate-500 sm:text-[11px]">{entry.text}</p> : <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 shadow-sm sm:max-w-[88%] sm:px-4 sm:py-3 sm:text-sm sm:leading-7 ${entry.role === "member" ? "rounded-br-md bg-white text-slate-800 ring-1 ring-slate-200" : "rounded-bl-md bg-gradient-to-l from-amber-300 to-amber-400 text-slate-950"}`}><p className="mb-1 text-[10px] font-black opacity-60">{entry.role === "member" ? memberName : "سارة"}</p><p className="whitespace-pre-wrap break-words">{entry.text}</p></div>}
              </div>
            ))}
          </div>

          <footer className={`shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4 ${streamlined ? "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-4" : ""}`}>
            {!streamlined ? <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              {!live ? <Button onClick={startSession} disabled={createSession.isPending || !status.data?.realtimeConfigured} className="h-12 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"><Phone className="ml-2 h-5 w-5" /> ابدأ الحديث مع سارة</Button> : <><Button onClick={toggleMute} variant="outline" className="h-11 rounded-2xl bg-white">{!microphoneAvailable ? <MicOff className="ml-2 h-4 w-4 text-slate-400" /> : muted ? <MicOff className="ml-2 h-4 w-4 text-red-500" /> : <Mic className="ml-2 h-4 w-4 text-emerald-600" />}{!microphoneAvailable ? "كتابة فقط" : muted ? "فتح الميكروفون" : "كتم الميكروفون"}</Button><Button onClick={stopSession} variant="outline" className="h-11 rounded-2xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100"><PhoneOff className="ml-2 h-4 w-4" /> إنهاء</Button></>}
              <Button onClick={toggleAvatar} disabled={createAvatarToken.isPending} variant="outline" className="h-11 rounded-2xl bg-white lg:hidden">{avatarToken ? <VideoOff className="ml-2 h-4 w-4" /> : <Video className="ml-2 h-4 w-4" />}{avatarToken ? "إيقاف الصورة" : "صورة حية"}</Button>
            </div> : phase === "error" ? <Button onClick={() => { autoStartedRef.current = false; void startSession(); void startAvatar(true); }} className="mb-3 h-10 w-full rounded-xl bg-slate-900 text-white">إعادة الاتصال بسارة</Button> : null}
            <div className="mb-2 grid grid-cols-3 gap-1.5 sm:mb-3 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { void playBriefing("full"); }}
                disabled={briefingButtonDisabled}
                title="تعمل تلقائيًا عند أول فتح صباحًا، ومرة أخرى كخلاصة مسائية"
                className="h-10 min-w-0 rounded-xl border-amber-200 bg-amber-50 px-2 text-[10px] font-black text-amber-950 hover:bg-amber-100 sm:h-11 sm:text-xs"
              >
                <Newspaper className="ml-1 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">الموجز الشامل</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void playBriefing("today"); }}
                disabled={briefingButtonDisabled}
                title="ما يحتاج حركة اليوم، مرتبًا حسب التوقيت والأثر"
                className="h-10 min-w-0 rounded-xl border-sky-200 bg-sky-50 px-2 text-[10px] font-black text-sky-950 hover:bg-sky-100 sm:h-11 sm:text-xs"
              >
                <ListChecks className="ml-1 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">أعمال اليوم</span>
                {briefingStatus.data ? <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] shadow-sm">{briefingStatus.data.todayCount}</span> : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void playBriefing("changes"); }}
                disabled={briefingButtonDisabled}
                title="فقط ما تغير منذ آخر نشرة اكتمل سماعها"
                className="h-10 min-w-0 rounded-xl border-emerald-200 bg-emerald-50 px-2 text-[10px] font-black text-emerald-950 hover:bg-emerald-100 sm:h-11 sm:text-xs"
              >
                <BellRing className="ml-1 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">ما الجديد؟</span>
                {briefingStatus.data?.hasHeardBriefing && briefingStatus.data.changesCount > 0 ? <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] shadow-sm">{briefingStatus.data.changesCount}</span> : null}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={textInput} onChange={event => setTextInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") sendText(); }} placeholder="اكتب لسارة…" disabled={!live} className="h-11 rounded-xl bg-white" />
              {streamlined && live ? <Button onClick={toggleMute} variant="outline" size="icon" className="h-11 w-11 flex-none rounded-xl bg-white">{!microphoneAvailable || muted ? <MicOff className="h-4 w-4 text-rose-500" /> : <Mic className="h-4 w-4 text-emerald-600" />}</Button> : null}
              <Button onClick={sendText} disabled={!live || !textInput.trim()} size="icon" className="h-11 w-11 flex-none rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400"><Send className="h-4 w-4" /></Button>
            </div>
            {!streamlined ? <div className="mt-2 flex items-center justify-end text-[10px] text-slate-400"><span>المقترح ليس تنفيذًا · لا إرسال خارجي</span></div> : null}
          </footer>
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        </section>
        {streamlined && audioBlocked ? <div className="absolute inset-x-4 bottom-24 z-[130] mx-auto max-w-sm rounded-full bg-slate-950/92 px-4 py-2 text-center text-xs font-bold text-white shadow-xl sm:bottom-5">المس الشاشة مرة واحدة لسماع سارة</div> : null}
      </div>
    </div>
  );
}
