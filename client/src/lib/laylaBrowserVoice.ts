export type LaylaVoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang">;

const FEMALE_VOICE_HINT = /female|woman|hoda|laila|layla|salma|maryam|mariam|nora|noor|zeina|zaina|samantha|zira|hazel|susan|victoria|karen|moira|tessa/i;

/** Prefer an installed Arabic female voice; the platform does not expose a gender field. */
export function selectLaylaBrowserVoice<T extends LaylaVoiceLike>(voices: T[]): T | undefined {
  const arabicVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ar"));
  return arabicVoices.find((voice) => FEMALE_VOICE_HINT.test(voice.name))
    || voices.find((voice) => FEMALE_VOICE_HINT.test(voice.name))
    || arabicVoices[0]
    || voices[0];
}

export function stopLaylaBrowserVoice() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function speakWithLaylaBrowserVoice(
  text: string,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    handlers.onError?.();
    return false;
  }
  stopLaylaBrowserVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-AE";
  utterance.rate = 0.94;
  utterance.pitch = 1.15;
  const voice = selectLaylaBrowserVoice(window.speechSynthesis.getVoices());
  if (voice) utterance.voice = voice;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.();
  window.speechSynthesis.speak(utterance);
  return true;
}
