import { describe, expect, it } from "vitest";
import { selectLaylaBrowserVoice } from "./laylaBrowserVoice";

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
});
