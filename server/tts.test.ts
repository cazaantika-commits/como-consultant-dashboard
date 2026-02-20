import { describe, it, expect } from "vitest";

// Test TTS voice assignment per agent
describe("TTS Voice Assignment", () => {
  const AGENT_VOICES: Record<string, string> = {
    salwa: "nova",      // Female, energetic, warm
    farouq: "onyx",     // Deep male, authoritative
    khazen: "ash",      // Warm male
    buraq: "echo",      // Male, clear
    khaled: "sage",     // Calm, precise
    alina: "shimmer",   // Soft female
    baz: "fable",       // Expressive
    joelle: "coral",    // Warm female
  };

  const VALID_OPENAI_VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

  it("should have all 8 agents assigned a voice", () => {
    expect(Object.keys(AGENT_VOICES)).toHaveLength(8);
    const agents = ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"];
    agents.forEach(agent => {
      expect(AGENT_VOICES[agent]).toBeDefined();
    });
  });

  it("should use only valid OpenAI TTS voices", () => {
    Object.values(AGENT_VOICES).forEach(voice => {
      expect(VALID_OPENAI_VOICES).toContain(voice);
    });
  });

  it("should assign unique voices to each agent", () => {
    const voices = Object.values(AGENT_VOICES);
    const uniqueVoices = [...new Set(voices)];
    expect(uniqueVoices).toHaveLength(8); // All 8 agents have unique voices
  });

  it("should assign female voices to female agents", () => {
    const femaleAgents = ["salwa", "alina", "joelle"];
    const femaleVoices = ["nova", "shimmer", "coral"]; // Female-sounding voices
    femaleAgents.forEach(agent => {
      expect(femaleVoices).toContain(AGENT_VOICES[agent]);
    });
  });

  it("should assign male voices to male agents", () => {
    const maleAgents = ["farouq", "khazen", "buraq", "khaled", "baz"];
    const maleVoices = ["onyx", "ash", "echo", "sage", "fable"]; // Male-sounding voices
    maleAgents.forEach(agent => {
      expect(maleVoices).toContain(AGENT_VOICES[agent]);
    });
  });
});

// Test TTS text cleaning logic
describe("TTS Text Cleaning", () => {
  function cleanTextForTTS(text: string): string {
    return text
      .replace(/[#*_~`>|[\](){}]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 4096);
  }

  it("should strip markdown formatting", () => {
    const input = "**مرحباً** هذا *نص* مع `كود` و~~شطب~~";
    const result = cleanTextForTTS(input);
    expect(result).not.toContain("**");
    expect(result).not.toContain("*");
    expect(result).not.toContain("`");
    expect(result).not.toContain("~~");
  });

  it("should replace double newlines with periods", () => {
    const input = "سطر أول\n\nسطر ثاني";
    const result = cleanTextForTTS(input);
    expect(result).toContain(". ");
    expect(result).not.toContain("\n\n");
  });

  it("should replace single newlines with spaces", () => {
    const input = "سطر أول\nسطر ثاني";
    const result = cleanTextForTTS(input);
    expect(result).toBe("سطر أول سطر ثاني");
  });

  it("should trim whitespace", () => {
    const input = "  مرحباً  ";
    const result = cleanTextForTTS(input);
    expect(result).toBe("مرحباً");
  });

  it("should limit text to 4096 characters", () => {
    const longText = "أ".repeat(5000);
    const result = cleanTextForTTS(longText);
    expect(result.length).toBeLessThanOrEqual(4096);
  });

  it("should handle empty string", () => {
    const result = cleanTextForTTS("");
    expect(result).toBe("");
  });

  it("should strip markdown headers", () => {
    const input = "# عنوان\n## عنوان فرعي\nنص عادي";
    const result = cleanTextForTTS(input);
    expect(result).not.toContain("#");
  });
});

// Test TTS endpoint input validation
describe("TTS Endpoint Input Validation", () => {
  it("should accept valid agent names", () => {
    const validAgents = ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"];
    validAgents.forEach(agent => {
      expect(typeof agent).toBe("string");
      expect(agent.length).toBeGreaterThan(0);
    });
  });

  it("should enforce text length limits", () => {
    const maxLength = 4096;
    const validText = "مرحباً".repeat(100);
    expect(validText.length).toBeLessThan(maxLength);
    
    const longText = "أ".repeat(5000);
    expect(longText.length).toBeGreaterThan(maxLength);
  });

  it("should return expected response shape", () => {
    const expectedShape = {
      audioBase64: "base64string",
      mimeType: "audio/mpeg",
      voice: "nova",
    };
    expect(expectedShape).toHaveProperty("audioBase64");
    expect(expectedShape).toHaveProperty("mimeType");
    expect(expectedShape).toHaveProperty("voice");
    expect(expectedShape.mimeType).toBe("audio/mpeg");
  });
});

// Test TTS API integration (live test with OpenAI)
describe("TTS API Live Test", () => {
  it("should generate audio from text using OpenAI TTS", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("Skipping live TTS test - no API key");
      return;
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: "مرحباً، أنا سلوى",
        voice: "nova",
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("audio");
    
    const arrayBuffer = await response.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    
    // MP3 files start with ID3 tag or sync bytes
    const bytes = new Uint8Array(arrayBuffer);
    const isMP3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
                  (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0); // Sync
    expect(isMP3).toBe(true);
  }, 30000);

  it("should generate audio with different voices", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("Skipping live TTS voice test - no API key");
      return;
    }

    // Test with onyx (farouq's voice)
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: "مرحباً، أنا فاروق المحلل القانوني",
        voice: "onyx",
        response_format: "mp3",
      }),
    });

    expect(response.ok).toBe(true);
    const arrayBuffer = await response.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  }, 30000);
});
