import { describe, expect, it } from "vitest";
import {
  createLiveAvatarPcmStream,
  LIVE_AVATAR_FIRST_CHUNK_MS,
  LIVE_AVATAR_FOLLOWING_CHUNK_MS,
} from "../shared/liveAvatarAudio";

const bytesFor = (milliseconds: number) => Math.floor(24_000 * 2 * milliseconds / 1_000);
const audio = (milliseconds: number) => Buffer.alloc(bytesFor(milliseconds), 7).toString("base64");

function harness() {
  const messages: Array<Record<string, any>> = [];
  const socket = {
    readyState: 1,
    send(data: string) {
      messages.push(JSON.parse(data));
    },
  };
  const stream = createLiveAvatarPcmStream({ _sessionEventSocket: socket });
  if (!stream) throw new Error("stream unavailable");
  return { stream, messages };
}

describe("LiveAvatar PCM streaming", () => {
  it("keeps one OpenAI response as one avatar utterance and commits only once", () => {
    const { stream, messages } = harness();

    stream.appendBase64(audio(200));
    expect(messages).toHaveLength(0);

    stream.appendBase64(audio(200));
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("agent.speak");
    expect(Buffer.from(messages[0].audio, "base64")).toHaveLength(bytesFor(LIVE_AVATAR_FIRST_CHUNK_MS));

    stream.appendBase64(audio(1_000));
    expect(messages).toHaveLength(2);
    expect(messages[1].type).toBe("agent.speak");
    expect(messages[1].event_id).toBe(messages[0].event_id);
    expect(Buffer.from(messages[1].audio, "base64")).toHaveLength(bytesFor(LIVE_AVATAR_FOLLOWING_CHUNK_MS));
    expect(messages.some(message => message.type === "agent.speak_end")).toBe(false);

    stream.commit();
    expect(messages.at(-1)).toMatchObject({ type: "agent.speak_end", event_id: messages[0].event_id });
    expect(stream.hasPendingAudio()).toBe(false);
  });

  it("clears buffered audio immediately on barge-in without playing a stale tail", () => {
    const { stream, messages } = harness();
    stream.appendBase64(audio(250));
    expect(stream.hasPendingAudio()).toBe(true);

    stream.interrupt();
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("agent.interrupt");
    expect(stream.hasPendingAudio()).toBe(false);

    stream.commit();
    expect(messages).toHaveLength(1);
  });
});
