const LAYLA_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const LAYLA_TTS_VOICE = "Aoede";
const LAYLA_TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

function pcm16ToWav(pcm: Buffer, sampleRate: number, channels: number) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function findAudioPart(payload: any) {
  for (const step of payload?.steps || []) {
    for (const part of step?.content || []) {
      if (part?.type === "audio" && typeof part.data === "string") return part;
    }
  }
  return null;
}

export async function generateLaylaSpeechAudio(text: string) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

  const transcript = text.replace(/[#*_~`>\[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!transcript) throw new Error("Layla speech transcript is empty");

  const response = await fetch(LAYLA_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LAYLA_TTS_MODEL,
      input: `اقرئي النص التالي بصوت امرأة عربية ناضجة، واثقة، دافئة وواضحة، وبسرعة نشطة دون استعجال. انطقي النص فقط من دون مقدمات أو إضافات:\n\n${transcript}`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: LAYLA_TTS_VOICE }] },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini TTS failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const payload = await response.json();
  const audioPart = findAudioPart(payload);
  if (!audioPart) throw new Error("Gemini TTS response did not include audio");

  const pcm = Buffer.from(audioPart.data, "base64");
  const sampleRate = Number(audioPart.sample_rate) || 24_000;
  const channels = Number(audioPart.channels) || 1;
  if (pcm.length === 0) throw new Error("Gemini TTS returned empty audio");

  const wav = pcm16ToWav(pcm, sampleRate, channels);
  return {
    audioBase64: wav.toString("base64"),
    mimeType: "audio/wav" as const,
    model: LAYLA_TTS_MODEL,
    voice: LAYLA_TTS_VOICE,
    sampleRate,
    channels,
  };
}

export const laylaSpeechInternals = { pcm16ToWav, findAudioPart };
