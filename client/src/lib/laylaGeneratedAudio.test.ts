import { afterEach, describe, expect, it, vi } from "vitest";
import { playLaylaGeneratedAudio, stopLaylaGeneratedAudio } from "./laylaGeneratedAudio";

describe("Layla generated audio playback", () => {
  afterEach(() => {
    stopLaylaGeneratedAudio();
    vi.unstubAllGlobals();
  });

  it("creates and plays an audio element from a returned WAV payload", async () => {
    const createObjectURL = vi.fn(() => "blob:layla-audio");
    const revokeObjectURL = vi.fn();
    let createdAudio: any;
    class MockAudio {
      currentTime = 0;
      onplay?: () => void;
      onended?: () => void;
      onerror?: () => void;
      pause = vi.fn();
      constructor(public src: string) { createdAudio = this; }
      async play() { this.onplay?.(); }
    }
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("window", {});

    const onStart = vi.fn();
    const played = await playLaylaGeneratedAudio(btoa("RIFFtest"), "audio/wav", { onStart });

    expect(played).toBe(true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createdAudio.src).toBe("blob:layla-audio");
    expect(onStart).toHaveBeenCalledOnce();
  });
});
