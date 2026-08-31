import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LAYLA_DEFAULT_VOICE_WAIT_MS,
  LAYLA_SPEECH_LANGUAGE,
  LAYLA_SPEECH_PITCH,
  LAYLA_SPEECH_RATE,
  selectLaylaBrowserVoice,
  speakWithLaylaBrowserVoice,
  stopLaylaBrowserVoice,
} from "./laylaBrowserVoice";

describe("Layla browser voice selection", () => {
  it("prefers an Arabic voice whose installed name indicates a female voice", () => {
    const voice = selectLaylaBrowserVoice([
      { name: "Microsoft Naayf - Arabic", lang: "ar-SA" },
      { name: "Microsoft Hoda - Arabic", lang: "ar-SA" },
      { name: "English Voice", lang: "en-US" },
    ]);
    expect(voice?.name).toBe("Microsoft Hoda - Arabic");
  });

  it("uses any installed Arabic voice before a non-Arabic fallback", () => {
    const voice = selectLaylaBrowserVoice([
      { name: "English Voice", lang: "en-US" },
      { name: "Arabic device voice", lang: "ar-AE" },
    ]);
    expect(voice?.lang).toBe("ar-AE");
  });

  it("never explicitly selects an English female voice when no Arabic voice exists", () => {
    const voice = selectLaylaBrowserVoice([
      { name: "Microsoft Zira - English", lang: "en-US" },
      { name: "Samantha", lang: "en-US" },
    ]);
    expect(voice).toBeUndefined();
  });

  it("does not select a known Arabic male voice for Layla", () => {
    const voice = selectLaylaBrowserVoice([
      { name: "Microsoft Naayf - Arabic", lang: "ar-SA" },
      { name: "Microsoft Majed - Arabic", lang: "ar-SA" },
    ]);
    expect(voice).toBeUndefined();
  });

  it("prefers a natural Arabic female voice over a generic or male Arabic voice", () => {
    const voice = selectLaylaBrowserVoice([
      { name: "Microsoft Naayf - Arabic", lang: "ar-SA", localService: true },
      { name: "Arabic device voice", lang: "ar-AE", localService: true },
      { name: "Microsoft Salma Online (Natural) - Arabic", lang: "ar-EG", localService: false },
    ]);
    expect(voice?.name).toContain("Salma");
  });

  it("uses the approved Arabic language and faster natural female settings", () => {
    expect(LAYLA_SPEECH_LANGUAGE).toBe("ar-AE");
    expect(LAYLA_SPEECH_RATE).toBeGreaterThan(1);
    expect(LAYLA_SPEECH_RATE).toBeLessThanOrEqual(1.2);
    expect(LAYLA_SPEECH_PITCH).toBeGreaterThanOrEqual(1);
    expect(LAYLA_SPEECH_PITCH).toBeLessThanOrEqual(1.1);
  });
});

describe("Layla browser speech playback", () => {
  afterEach(() => {
    stopLaylaBrowserVoice();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queues an ar-AE utterance through the browser default engine when no voice list is exposed", () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const cancel = vi.fn();
    const resume = vi.fn();
    class MockUtterance {
      voice?: SpeechSynthesisVoice;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    }
    const speechSynthesis = {
      getVoices: () => [],
      cancel,
      resume,
      speak,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("window", {
      speechSynthesis,
      SpeechSynthesisUtterance: MockUtterance,
      setTimeout,
    });

    expect(speakWithLaylaBrowserVoice("مرحباً بكم")).toBe(true);
    vi.advanceTimersByTime(LAYLA_DEFAULT_VOICE_WAIT_MS + 50);

    expect(resume).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.lang).toBe("ar-AE");
    expect(utterance.voice).toBeUndefined();
  });

  it("uses an exposed Arabic female voice and avoids cancel/speak in the same browser task", () => {
    vi.useFakeTimers();
    const arabicVoice = { name: "Microsoft Salma Online (Natural)", lang: "ar-EG", voiceURI: "salma" } as SpeechSynthesisVoice;
    const speak = vi.fn();
    class MockUtterance {
      voice?: SpeechSynthesisVoice;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    }
    const speechSynthesis = {
      getVoices: () => [arabicVoice],
      cancel: vi.fn(),
      resume: vi.fn(),
      speak,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("window", {
      speechSynthesis,
      SpeechSynthesisUtterance: MockUtterance,
      setTimeout,
    });

    expect(speakWithLaylaBrowserVoice("أهلاً بكم")).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.voice).toBe(arabicVoice);
    expect(utterance.lang).toBe("ar-AE");
  });
});
