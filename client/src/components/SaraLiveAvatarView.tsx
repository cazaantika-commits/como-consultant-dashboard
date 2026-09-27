import { useEffect, useRef, useState } from "react";
import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";
import { Radio } from "lucide-react";
import { createLiveAvatarPcmStream, type LiveAvatarPcmStream } from "@shared/liveAvatarAudio";

export type SaraVisualAudioDelta = {
  id: number;
  pcmBase64: string;
};

type Props = {
  portrait: string;
  sessionToken: string | null;
  audioDelta: SaraVisualAudioDelta | null;
  commitId: number;
  interruptId: number;
  playAudio: boolean;
  onStateChange?: (state: { connected: boolean; speaking: boolean; error: string | null }) => void;
  onAudioRouteFailure?: () => void;
  onPlaybackComplete?: () => void;
};

export function SaraLiveAvatarView({ portrait, sessionToken, audioDelta, commitId, interruptId, playAudio, onStateChange, onAudioRouteFailure, onPlaybackComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const pcmStreamRef = useRef<LiveAvatarPcmStream | null>(null);
  const lastDeltaRef = useRef<number | null>(null);
  const lastCommitRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [liveVideoPlaying, setLiveVideoPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showLiveVideo = streamReady && liveVideoPlaying && !error;

  useEffect(() => {
    onStateChange?.({ connected: connected && streamReady && !error, speaking, error });
  }, [connected, error, onStateChange, speaking, streamReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !playAudio;
    video.volume = playAudio ? 1 : 0;
    if (playAudio) void video.play().catch(() => onAudioRouteFailure?.());
  }, [onAudioRouteFailure, playAudio]);

  useEffect(() => {
    if (!sessionToken) {
      setConnected(false);
      setStreamReady(false);
      setLiveVideoPlaying(false);
      setSpeaking(false);
      setError(null);
      pcmStreamRef.current = null;
      return;
    }
    const session = new LiveAvatarSession(sessionToken, { voiceChat: false, autoKeepAlive: true });
    sessionRef.current = session;
    setError(null);

    const onSessionState = (state: SessionState) => {
      if (state === SessionState.CONNECTED) {
        const stream = createLiveAvatarPcmStream(session);
        pcmStreamRef.current = stream;
        if (!stream) setError("تعذر تجهيز مزامنة الصوت مع الصورة");
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
      setLiveVideoPlaying(false);
      setSpeaking(false);
      pcmStreamRef.current = null;
    };
    const onSpeakStarted = () => setSpeaking(true);
    const onSpeakEnded = () => {
      setSpeaking(false);
      onPlaybackComplete?.();
    };

    session.on(SessionEvent.SESSION_STATE_CHANGED, onSessionState);
    session.on(SessionEvent.SESSION_STREAM_READY, onStreamReady);
    session.on(SessionEvent.SESSION_DISCONNECTED, onDisconnected);
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onSpeakStarted);
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onSpeakEnded);
    void session.start().catch(reason => {
      setError(reason instanceof Error ? reason.message : "تعذر تشغيل الصورة الحية لسارة");
    });

    return () => {
      pcmStreamRef.current?.interrupt();
      pcmStreamRef.current = null;
      session.removeAllListeners();
      void session.stop().catch(() => undefined);
      sessionRef.current = null;
      setConnected(false);
      setStreamReady(false);
      setLiveVideoPlaying(false);
      setSpeaking(false);
    };
  }, [onPlaybackComplete, sessionToken]);

  useEffect(() => {
    if (!audioDelta || lastDeltaRef.current === audioDelta.id || !streamReady) return;
    const stream = pcmStreamRef.current;
    if (!stream) return;
    lastDeltaRef.current = audioDelta.id;
    try {
      if (!stream.appendBase64(audioDelta.pcmBase64)) setError("تعذر تمرير صوت سارة إلى الصورة الحية");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحريك سارة مع الرد الصوتي");
    }
  }, [audioDelta, streamReady]);

  useEffect(() => {
    if (!commitId || commitId === lastCommitRef.current) return;
    lastCommitRef.current = commitId;
    try {
      pcmStreamRef.current?.commit();
    } catch {
      // OpenAI audio continues even if the visual stream has already ended.
    }
  }, [commitId]);

  useEffect(() => {
    if (!interruptId) return;
    try {
      pcmStreamRef.current?.interrupt();
      setSpeaking(false);
    } catch {
      // The remote stream may have ended just before the interruption.
    }
  }, [interruptId]);

  return (
    <div className="relative h-full min-h-[170px] overflow-hidden rounded-[20px] bg-[#071522] shadow-[0_24px_70px_rgba(2,12,24,.38)] sm:min-h-[260px] sm:rounded-[26px]">
      <img
        src={portrait}
        alt="سارة"
        className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-200 ${showLiveVideo ? "opacity-0" : "opacity-100"}`}
      />
      <video
        ref={videoRef}
        poster={portrait}
        autoPlay
        muted
        playsInline
        onPlaying={() => setLiveVideoPlaying(true)}
        className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-200 ${showLiveVideo ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05101d]/95 via-transparent to-[#05101d]/10" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
        <div>
          <p className="text-xl font-black">سارة</p>
          <p className="mt-1 text-[11px] text-white/65">الواجهة المرئية لـ COMO</p>
        </div>
        <div className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-bold backdrop-blur-md">
          <span className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${speaking ? "bg-amber-300 animate-pulse" : showLiveVideo ? "bg-emerald-400" : "bg-slate-400"}`} />
          {speaking ? "تتحدث" : showLiveVideo ? "متصلة" : sessionToken ? "تتصل" : "جاهزة"}
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
