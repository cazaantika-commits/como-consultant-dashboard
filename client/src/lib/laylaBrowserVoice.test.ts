import { describe, expect, it } from "vitest";
import {
  LAYLA_SPEECH_LANGUAGE,
  LAYLA_SPEECH_PITCH,
  LAYLA_SPEECH_RATE,
  selectLaylaBrowserVoice,
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

  it("never falls back to an English female voice when no Arabic voice exists", () => {
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
