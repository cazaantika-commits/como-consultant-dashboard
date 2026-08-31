const FEMALE_VOICE_HINT = /female|woman|hoda|laila|layla|salma|zariyah|maryam|mariam|nora|noor|zeina|zaina|zahra|amira|amina|reem|farah|rana|rania|amal/i;
const MALE_VOICE_HINT = /male|man|naayf|nayef|majed|maged|hamed|tarik|tariq|omar/i;
const QUALITY_VOICE_HINT = /natural|neural|premium|enhanced|online|google|microsoft/i;
let laylaSpeechRequestId = 0;

export const LAYLA_SPEECH_LANGUAGE = "ar-AE";
export const LAYLA_SPEECH_RATE = 1.12;
export const LAYLA_SPEECH_PITCH = 1.05;
export const LAYLA_DEFAULT_VOICE_WAIT_MS = 900;

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

/** Never explicitly assign a non-Arabic voice. Prefer the best Arabic female/natural voice exposed by the device. */
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
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: (error?: unknown) => void } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    handlers.onError?.(new Error("speechSynthesis unavailable"));
    return false;
  }

  stopLaylaBrowserVoice();
  const requestId = laylaSpeechRequestId;
  const synth = window.speechSynthesis;
  let speechQueued = false;
  let voicesListener: (() => void) | null = null;

  const cleanup = () => {
    if (voicesListener) synth.removeEventListener?.("voiceschanged", voicesListener);
    voicesListener = null;
  };

  const queueArabicSpeech = (voice?: SpeechSynthesisVoice) => {
    if (speechQueued || requestId !== laylaSpeechRequestId) return false;
    speechQueued = true;
    cleanup();

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    // Always request Arabic pronunciation. When the browser exposes no voice list,
    // leaving `voice` unset lets the device choose its Arabic engine instead of failing silently.
    utterance.lang = LAYLA_SPEECH_LANGUAGE;
    utterance.rate = LAYLA_SPEECH_RATE;
    utterance.pitch = LAYLA_SPEECH_PITCH;
    utterance.volume = 1;
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = () => handlers.onEnd?.();
    utterance.onerror = (event) => handlers.onError?.(new Error(event.error || "speech synthesis error"));

    // Chrome can drop a new utterance when cancel() and speak() happen in the same task.
    window.setTimeout(() => {
      if (requestId !== laylaSpeechRequestId) return;
      synth.resume();
      synth.speak(utterance);
    }, 40);
    return true;
  };

  const startWithAvailableVoice = () => {
    const voices = synth.getVoices();
    const arabicVoice = selectLaylaBrowserVoice(voices);
    if (arabicVoice) return queueArabicSpeech(arabicVoice);
    // A populated list without Arabic must not block speech entirely. Do not assign
    // an English voice explicitly; let the browser resolve ar-AE through its default engine.
    if (voices.length > 0) return queueArabicSpeech();
    return false;
  };

  if (startWithAvailableVoice()) return true;

  voicesListener = () => {
    if (requestId !== laylaSpeechRequestId) return cleanup();
    startWithAvailableVoice();
  };
  synth.addEventListener?.("voiceschanged", voicesListener);

  // Android/Chromium may keep getVoices() empty even though speech works. After a
  // short wait, queue an ar-AE utterance with no explicit voice instead of returning silence.
  window.setTimeout(() => {
    if (speechQueued || requestId !== laylaSpeechRequestId) return;
    queueArabicSpeech();
  }, LAYLA_DEFAULT_VOICE_WAIT_MS);

  return true;
}
