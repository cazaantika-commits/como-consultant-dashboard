import { useEffect, useRef, useState } from "react";
import { LiveAvatarSession, SessionEvent, SessionState } from "@heygen/liveavatar-web-sdk";
import { Radio } from "lucide-react";
import { silenceSaraAvatarVideo } from "@/lib/saraAvatarSilence";

type Props = {
  portrait: string;
  sessionToken: string | null;
  isSpeaking?: boolean;
};

/**
 * Visual-only. WebRTC remains the single audible source; this component never
 * receives, forwards, chunks, or waits for its audio. `isSpeaking` drives only
 * an intentionally approximate mouth-motion cue, not lip-sync.
 */
export function SaraLiveAvatarView({ portrait, sessionToken, isSpeaking = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [liveVideoPlaying, setLiveVideoPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showLiveVideo = connected && streamReady && liveVideoPlaying && !error;

  useEffect(() => {
    if (!sessionToken) {
      setConnected(false);
      setStreamReady(false);
      setLiveVideoPlaying(false);
      setError(null);
      return;
    }
    const session = new LiveAvatarSession(sessionToken, { voiceChat: false, autoKeepAlive: true });
    setError(null);
    const onSessionState = (state: SessionState) => setConnected(state === SessionState.CONNECTED);
    const onStreamReady = () => {
      setStreamReady(true);
      if (videoRef.current) {
        // Set these before attaching the SDK's media tracks. The video is
        // visual-only even if the SDK session happens to expose remote audio.
        silenceSaraAvatarVideo(videoRef.current);
        session.attach(videoRef.current);
        // LiveAvatar/LiveKit may clear `muted` while attaching its audio track.
        // Reassert silence immediately and on subsequent element events below.
        silenceSaraAvatarVideo(videoRef.current);
      }
    };
    const onDisconnected = () => {
      setConnected(false);
      setStreamReady(false);
      setLiveVideoPlaying(false);
    };
    session.on(SessionEvent.SESSION_STATE_CHANGED, onSessionState);
    session.on(SessionEvent.SESSION_STREAM_READY, onStreamReady);
    session.on(SessionEvent.SESSION_DISCONNECTED, onDisconnected);
    void session.start().catch(reason => {
      setError(reason instanceof Error ? reason.message : "تعذر تشغيل الصورة الحية لسارة");
    });
    return () => {
      session.removeAllListeners();
      void session.stop().catch(() => undefined);
    };
  }, [sessionToken]);

  return (
    <div className="relative h-full min-h-[170px] overflow-hidden rounded-[20px] bg-[#071522] shadow-[0_24px_70px_rgba(2,12,24,.38)] sm:min-h-[260px] sm:rounded-[26px]">
      <img src={portrait} alt="سارة" className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-200 ${showLiveVideo ? "opacity-0" : "opacity-100"}`} />
      <video
        ref={videoRef}
        poster={portrait}
        autoPlay
        muted
        playsInline
        onVolumeChange={event => silenceSaraAvatarVideo(event.currentTarget)}
        onLoadedMetadata={event => silenceSaraAvatarVideo(event.currentTarget)}
        onPlaying={event => {
          silenceSaraAvatarVideo(event.currentTarget);
          setLiveVideoPlaying(true);
        }}
        className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-200 ${showLiveVideo ? "opacity-100" : "opacity-0"}`}
      />
      {/* A state-led visual cue, deliberately not an audio analysis or sync promise. */}
      <span
        aria-hidden="true"
        className={`sara-approx-mouth ${isSpeaking ? "sara-approx-mouth--speaking" : ""} ${showLiveVideo ? "sara-approx-mouth--over-live-video" : ""}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05101d]/95 via-transparent to-[#05101d]/10" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
        <div><p className="text-xl font-black">سارة</p><p className="mt-1 text-[11px] text-white/65">الواجهة المرئية لـ COMO</p></div>
        <div className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-bold backdrop-blur-md">
          <span className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${isSpeaking ? "bg-amber-300 animate-pulse" : showLiveVideo ? "bg-emerald-400" : "bg-slate-400"}`} />
          {isSpeaking ? "تتحدث · حركة تقريبية" : showLiveVideo ? "متصلة" : sessionToken ? "تتصل" : "جاهزة"}
        </div>
      </div>
      {error && <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-200/70 bg-white/95 p-3 text-xs leading-5 text-red-700 shadow-xl"><Radio className="ml-1 inline h-3.5 w-3.5" /> تعذرت الصورة الحية، والصوت المباشر لا يتأثر.</div>}
    </div>
  );
}
