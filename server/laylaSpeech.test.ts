import { describe, expect, it } from "vitest";
import { generateLaylaSpeechAudio, laylaSpeechInternals } from "./laylaSpeech";

describe("Layla Gemini speech", () => {
  it("wraps PCM16 audio in a valid mono WAV header", () => {
    const pcm = Buffer.from([0, 0, 1, 0, 255, 255, 2, 0]);
    const wav = laylaSpeechInternals.pcm16ToWav(pcm, 24_000, 1);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it("finds the audio payload returned by the Gemini interactions API", () => {
    const part = laylaSpeechInternals.findAudioPart({
      steps: [{ type: "model_output", content: [{ type: "audio", data: "AQID", sample_rate: 24_000, channels: 1 }] }],
    });
    expect(part).toMatchObject({ type: "audio", data: "AQID", sample_rate: 24_000, channels: 1 });
  });

  it("generates a non-empty Arabic WAV file through the live Gemini TTS service", async () => {
    if (!process.env.GOOGLE_GEMINI_API_KEY) return;
    const result = await generateLaylaSpeechAudio("أهلاً عبدالرحمن، أنا ليلى. هذا ملخص سريع لأهم النقاط.");
    const wav = Buffer.from(result.audioBase64, "base64");
    expect(result.mimeType).toBe("audio/wav");
    expect(result.model).toContain("tts");
    expect(result.voice).toBeTruthy();
    expect(wav.length).toBeGreaterThan(10_000);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24_000);
  }, 60_000);
});
