export type LaylaVoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang"> & Partial<Pick<SpeechSynthesisVoice, "default" | "localService" | "voiceURI">>;

const FEMALE_VOICE_HINT = /female|woman|hoda|laila|layla|salma|zariyah|maryam|mariam|nora|noor|zeina|zaina|zahra|amira|amina|reem|farah|rana|rania|amal/i;
const MALE_VOICE_HINT = /male|man|naayf|nayef|majed|maged|hamed|tarik|tariq|omar/i;
const QUALITY_VOICE_HINT = /natural|neural|premium|enhanced|online|google|microsoft/i;
let laylaSpeechRequestId = 0;

export const LAYLA_SPEECH_LANGUAGE = "ar-AE";
export const LAYLA_SPEECH_RATE = 1.12;
export const LAYLA_SPEECH_PITCH = 1.08;

function arabicVoiceScore(voice: LaylaVoiceLike) {
  const lang = voice.lang.toLowerCase();
  const identity = `${voice.name} ${voice.voiceURI || ""}`;
  let score = 0;
  if (FEMALE_VOICE_HINT.test(identity)) score += 1_000;
  if (MALE_VOICE_HINT.test(identity)) score -= 1_000;
  if (QUALITY_VOICE_HINT.test(identity)) score += 300;
  if (lang === "ar-ae") score += 180;
  else if (lang === "ar-sa") score += 160;
  else if (lang === "ar-eg") score += 140;
  else if (lang.startsWith("ar-")) score += 100;
  if (voice.localService === false) score += 40;
  if (voice.default) score += 10;
  return score;
}

/** Never select a non-Arabic voice. Prefer the best Arabic female/natural voice exposed by the device. */
export function selectLaylaBrowserVoice<T extends LaylaVoiceLike>(voices: T[]): T | undefined {
  const arabicVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ar"));
  const nonMaleArabicVoices = arabicVoices.filter((voice) => !MALE_VOICE_HINT.test(`${voice.name} ${voice.voiceURI || ""}`));
  return nonMaleArabicVoices
    .map((voice, index) => ({ voice, index, score: arabicVoiceScore(voice) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice;
}

export function stopLaylaBrowserVoice() {
  laylaSpeechRequestId += 1;
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
  const requestId = laylaSpeechRequestId;

  const startArabicSpeech = () => {
    if (requestId !== laylaSpeechRequestId) return false;
    const voice = selectLaylaBrowserVoice(window.speechSynthesis.getVoices());
    if (!voice) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || LAYLA_SPEECH_LANGUAGE;
    utterance.rate = LAYLA_SPEECH_RATE;
    utterance.pitch = LAYLA_SPEECH_PITCH;
    utterance.volume = 1;
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = () => handlers.onEnd?.();
    utterance.onerror = () => handlers.onError?.();
    window.speechSynthesis.speak(utterance);
    return true;
  };

  if (startArabicSpeech()) return true;

  let completed = false;
  const cleanup = () => window.speechSynthesis.removeEventListener?.("voiceschanged", handleVoicesChanged);
  const handleVoicesChanged = () => {
    if (requestId !== laylaSpeechRequestId) {
      completed = true;
      cleanup();
      return;
    }
    if (completed || !startArabicSpeech()) return;
    completed = true;
    cleanup();
  };
  window.speechSynthesis.addEventListener?.("voiceschanged", handleVoicesChanged);
  window.setTimeout(() => {
    if (completed || requestId !== laylaSpeechRequestId) return;
    completed = true;
    cleanup();
    handlers.onError?.();
  }, 1800);
  return true;
}
