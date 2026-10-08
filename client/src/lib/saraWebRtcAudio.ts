export type SaraAudioElement = Pick<
  HTMLAudioElement,
  "muted" | "volume" | "paused" | "play" | "pause" | "srcObject"
>;

export type SaraAudioDiagnosticEvent =
  | "source_attached"
  | "source_reused"
  | "playback_started"
  | "autoplay_blocked"
  | "playback_failed"
  | "source_detached";

export type SaraAudioDiagnostic = {
  event: SaraAudioDiagnosticEvent;
  /** A browser error name only; never includes provider data, text, token, or stream IDs. */
  errorCode?: string;
};

export type SaraAudioPlaybackResult = "playing" | "blocked" | "failed";

/** A deliberate, medium grace period for transient WebRTC network changes. */
export const SARA_WEBRTC_DISCONNECT_GRACE_MS = 6_000;

export type SaraPeerConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";

export type SaraWebRtcDisconnectGuardCallbacks = {
  onGraceStarted: () => void;
  onRecovered: () => void;
  onExpired: (reason: "disconnected" | "failed" | "closed") => void;
};

/**
 * Delays escalation of a transient `disconnected` state while still failing a
 * definitively failed/closed peer immediately. The caller owns reconnection;
 * this guard only prevents the UI from discarding a live session too quickly.
 */
export class SaraWebRtcDisconnectGuard {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly callbacks: SaraWebRtcDisconnectGuardCallbacks,
    private readonly graceMs = SARA_WEBRTC_DISCONNECT_GRACE_MS,
  ) {}

  handle(state: SaraPeerConnectionState) {
    if (this.disposed) return;
    if (state === "disconnected") {
      if (this.timeout) return;
      this.callbacks.onGraceStarted();
      this.timeout = setTimeout(() => {
        this.timeout = null;
        this.callbacks.onExpired("disconnected");
      }, this.graceMs);
      return;
    }

    if (state === "failed" || state === "closed") {
      this.clearGrace();
      this.callbacks.onExpired(state);
      return;
    }

    if (this.clearGrace()) this.callbacks.onRecovered();
  }

  dispose() {
    this.disposed = true;
    this.clearGrace();
  }

  private clearGrace() {
    if (!this.timeout) return false;
    clearTimeout(this.timeout);
    this.timeout = null;
    return true;
  }
}

function safePlaybackErrorCode(reason: unknown) {
  if (!reason || typeof reason !== "object" || !("name" in reason)) return "unknown";
  const name = String((reason as { name?: unknown }).name || "unknown");
  return /^[A-Za-z]+Error$/.test(name) ? name.slice(0, 48) : "unknown";
}

/**
 * Keeps OpenAI Realtime's WebRTC stream as the only audible source.
 *
 * This intentionally owns neither tracks nor an HTMLAudioElement lifecycle: callers
 * create both once and pass them in. LiveAvatar can be started/stopped separately
 * without a source swap, an AudioContext, or PCM chunk forwarding.
 */
export class SaraWebRtcAudioTransport {
  private stream: MediaStream | null = null;

  constructor(private readonly onDiagnostic: (diagnostic: SaraAudioDiagnostic) => void = () => undefined) {}

  async attach(audio: SaraAudioElement, stream: MediaStream): Promise<SaraAudioPlaybackResult> {
    const sourceChanged = !this.stream || !this.hasSameAudioTrack(this.stream, stream);
    if (sourceChanged) this.stream = stream;

    // The element remains unmuted even if a visual avatar is connected. It is the
    // single WebRTC audio sink and is never replaced by LiveAvatar audio.
    audio.muted = false;
    audio.volume = 1;

    if (sourceChanged) {
      audio.srcObject = stream;
      this.onDiagnostic({ event: "source_attached" });
    } else if (!audio.paused) {
      this.onDiagnostic({ event: "source_reused" });
      return "playing";
    } else {
      this.onDiagnostic({ event: "source_reused" });
    }

    return this.resume(audio);
  }

  private hasSameAudioTrack(first: MediaStream, second: MediaStream) {
    const firstTracks = first.getAudioTracks();
    const secondTracks = second.getAudioTracks();
    return firstTracks.length > 0 && firstTracks.some(track => secondTracks.includes(track));
  }

  async resume(audio: SaraAudioElement): Promise<SaraAudioPlaybackResult> {
    // A user gesture retry must preserve the original WebRTC stream, not create a
    // new audio element or renegotiate/re-route any track.
    if (!this.stream || audio.srcObject !== this.stream) return "failed";
    audio.muted = false;
    audio.volume = 1;

    try {
      await audio.play();
      this.onDiagnostic({ event: "playback_started" });
      return "playing";
    } catch (reason) {
      const errorCode = safePlaybackErrorCode(reason);
      const event = errorCode === "NotAllowedError" ? "autoplay_blocked" : "playback_failed";
      this.onDiagnostic({ event, errorCode });
      return event === "autoplay_blocked" ? "blocked" : "failed";
    }
  }

  detach(audio: SaraAudioElement) {
    if (audio.srcObject === this.stream) {
      audio.pause();
      audio.srcObject = null;
    }
    this.stream = null;
    this.onDiagnostic({ event: "source_detached" });
  }
}
