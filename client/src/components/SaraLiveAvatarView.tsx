import { useEffect, useRef, useState } from "react";
import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";
import { Radio } from "lucide-react";
import { patchLiveAvatarPcmTransport } from "@shared/liveAvatarAudio";

export type SaraVisualSpeechCue = {
  id: number;
  text?: string;
  pcmBinary?: string;
  interruptBefore?: boolean;
};

type Props = {
  portrait: string;
  idleVideo: string;
  sessionToken: string | null;
  speechCue: SaraVisualSpeechCue | null;
  interruptId: number;
  onStateChange?: (state: { connected: boolean; speaking: boolean; error: string | null }) => void;
};

export function SaraLiveAvatarView({ portrait, idleVideo, sessionToken, speechCue, interruptId, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const lastCueRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStateChange?.({ connected: connected && streamReady && !error, speaking, error });
  }, [connected, error, onStateChange, speaking, streamReady]);

  useEffect(() => {
    if (!sessionToken) {
      setConnected(false);
      setStreamReady(false);
      setSpeaking(false);
      setError(null);
      return;
    }
    const session = new LiveAvatarSession(sessionToken, { voiceChat: false, autoKeepAlive: true });
    sessionRef.current = session;
    setError(null);

    const onSessionState = (state: SessionState) => {
      if (state === SessionState.CONNECTED && !patchLiveAvatarPcmTransport(session)) {
        setError("تعذر تجهيز مزامنة الصوت مع الصورة");
      }
      setConnected(state === SessionState.CONNECTED);
    };
    const onStreamReady = () => {
      setStreamReady(true);
      if (videoRef.current) {
        session.attach(videoRef.current);
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      }
    };
    const onDisconnected = () => {
      setConnected(false);
      setStreamReady(false);
      setSpeaking(false);
    };
    const onSpeakStarted = () => setSpeaking(true);
    const onSpeakEnded = () => setSpeaking(false);

    session.on(SessionEvent.SESSION_STATE_CHANGED, onSessionState);
    session.on(SessionEvent.SESSION_STREAM_READY, onStreamReady);
    session.on(SessionEvent.SESSION_DISCONNECTED, onDisconnected);
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onSpeakStarted);
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onSpeakEnded);
    void session.start().catch(reason => {
      setError(reason instanceof Error ? reason.message : "تعذر تشغيل الصورة الحية لسارة");
    });

    return () => {
      session.removeAllListeners();
      void session.stop().catch(() => undefined);
      sessionRef.current = null;
      setConnected(false);
      setStreamReady(false);
      setSpeaking(false);
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!speechCue || lastCueRef.current === speechCue.id) return;
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.CONNECTED || !streamReady) return;
    lastCueRef.current = speechCue.id;
    try {
      if (speechCue.interruptBefore) session.interrupt();
      if (speechCue.pcmBinary) session.repeatAudio(speechCue.pcmBinary);
      else if (speechCue.text) session.repeat(speechCue.text.slice(0, 1_800));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحريك سارة مع الرد الصوتي");
    }
  }, [speechCue, streamReady]);

  useEffect(() => {
    if (!interruptId) return;
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.CONNECTED) return;
    try {
      session.interrupt();
      setSpeaking(false);
    } catch {
      // The remote stream may have ended just before the interruption.
    }
  }, [interruptId]);

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-[26px] bg-[#071522] shadow-[0_24px_70px_rgba(2,12,24,.38)]">
      <video
        src={idleVideo}
        poster={portrait}
        autoPlay
        muted
        loop
        playsInline
        className={`absolute inset-0 h-full w-full object-cover object-[center_18%] transition-opacity duration-300 ${streamReady ? "opacity-0" : "opacity-100"}`}
      />
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onVolumeChange={event => {
          event.currentTarget.muted = true;
          event.currentTarget.volume = 0;
        }}
        className={`absolute inset-0 h-full w-full object-cover object-[center_18%] transition-opacity duration-300 ${streamReady ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05101d]/95 via-transparent to-[#05101d]/10" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
        <div>
          <p className="text-xl font-black">سارة</p>
          <p className="mt-1 text-[11px] text-white/65">الواجهة المرئية لـ COMO</p>
        </div>
        <div className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-bold backdrop-blur-md">
          <span className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${speaking ? "bg-amber-300 animate-pulse" : streamReady ? "bg-emerald-400" : "bg-slate-400"}`} />
          {speaking ? "تتحدث" : streamReady ? "متصلة" : sessionToken ? "تتصل" : "جاهزة"}
        </div>
      </div>
      {error && (
        <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-200/70 bg-white/95 p-3 text-xs leading-5 text-red-700 shadow-xl">
          <Radio className="ml-1 inline h-3.5 w-3.5" />
          بقي الصوت المباشر متاحًا، لكن تعذر تحريك الصورة الآن.
        </div>
      )}
    </div>
  );
}
