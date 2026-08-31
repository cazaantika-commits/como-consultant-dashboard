let activeLaylaAudio: HTMLAudioElement | null = null;
let activeLaylaAudioUrl: string | null = null;

function releaseActiveUrl() {
  if (activeLaylaAudioUrl) URL.revokeObjectURL(activeLaylaAudioUrl);
  activeLaylaAudioUrl = null;
}

export function stopLaylaGeneratedAudio() {
  if (activeLaylaAudio) {
    activeLaylaAudio.pause();
    activeLaylaAudio.currentTime = 0;
  }
  activeLaylaAudio = null;
  releaseActiveUrl();
}

export async function playLaylaGeneratedAudio(
  audioBase64: string,
  mimeType: string,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void } = {},
) {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    handlers.onError?.();
    return false;
  }

  stopLaylaGeneratedAudio();
  try {
    const bytes = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType || "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeLaylaAudio = audio;
    activeLaylaAudioUrl = url;

    let started = false;
    const markStarted = () => {
      if (started) return;
      started = true;
      handlers.onStart?.();
    };
    audio.onplay = markStarted;
    audio.onended = () => {
      handlers.onEnd?.();
      stopLaylaGeneratedAudio();
    };
    audio.onerror = () => {
      handlers.onError?.();
      stopLaylaGeneratedAudio();
    };

    const playPromise = audio.play();
    await playPromise;
    markStarted();
    return true;
  } catch (error) {
    console.warn("[Layla TTS] Audio playback failed:", error);
    handlers.onError?.();
    stopLaylaGeneratedAudio();
    return false;
  }
}
