type LiveAvatarAudioSocket = {
  readyState?: number;
  send: (data: string) => unknown;
};

type SessionWithAudioSocket = {
  _sessionEventSocket?: LiveAvatarAudioSocket;
};

const PCM_SAMPLE_RATE = 24_000;
const PCM_BYTES_PER_SAMPLE = 2;
export const LIVE_AVATAR_FIRST_CHUNK_MS = 240;
export const LIVE_AVATAR_FOLLOWING_CHUNK_MS = 240;

function chunkBytes(milliseconds: number) {
  return Math.floor((PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * milliseconds) / 1_000);
}

function makeEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `como-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function pcmBase64ToBinaryString(audioBase64: string) {
  return globalThis.atob(audioBase64);
}

export function pcmBinaryToBase64(binary: string) {
  return globalThis.btoa(binary);
}

export function pcm24kBinaryDurationMs(binary: string) {
  return (binary.length / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE)) * 1_000;
}

export type LiveAvatarPcmStream = {
  appendBase64: (audioBase64: string) => boolean;
  commit: () => boolean;
  interrupt: () => boolean;
  hasPendingAudio: () => boolean;
};

/**
 * Streams one OpenAI response to LiveAvatar as one utterance.
 * The old path called repeatAudio once per second; the SDK sealed every call with
 * agent.speak_end, so the avatar restarted its mouth animation every second.
 */
export function createLiveAvatarPcmStream(session: unknown): LiveAvatarPcmStream | null {
  const socket = (session as SessionWithAudioSocket | null)?._sessionEventSocket;
  if (!socket) return null;

  let pendingBinary = "";
  let utteranceId: string | null = null;
  let firstChunk = true;

  const socketOpen = () => socket.readyState === undefined || socket.readyState === 1;
  const send = (payload: Record<string, unknown>) => {
    if (!socketOpen()) return false;
    socket.send(JSON.stringify(payload));
    return true;
  };

  const appendChunk = (binary: string) => {
    if (!binary) return true;
    utteranceId ||= makeEventId();
    return send({
      type: "agent.speak",
      event_id: utteranceId,
      audio: pcmBinaryToBase64(binary),
    });
  };

  return {
    appendBase64(audioBase64) {
      if (!audioBase64 || !socketOpen()) return false;
      pendingBinary += pcmBase64ToBinaryString(audioBase64);
      let targetBytes = chunkBytes(firstChunk ? LIVE_AVATAR_FIRST_CHUNK_MS : LIVE_AVATAR_FOLLOWING_CHUNK_MS);
      while (pendingBinary.length >= targetBytes) {
        const chunk = pendingBinary.slice(0, targetBytes);
        pendingBinary = pendingBinary.slice(targetBytes);
        if (!appendChunk(chunk)) return false;
        firstChunk = false;
        targetBytes = chunkBytes(LIVE_AVATAR_FOLLOWING_CHUNK_MS);
      }
      return true;
    },
    commit() {
      if (!socketOpen()) return false;
      if (!utteranceId && pendingBinary) {
        if (!appendChunk(pendingBinary)) return false;
        pendingBinary = "";
      }
      if (!utteranceId) return true;
      const finalAudio = pendingBinary ? pcmBinaryToBase64(pendingBinary) : undefined;
      const committed = send({
        type: "agent.speak_end",
        event_id: utteranceId,
        ...(finalAudio ? { audio: finalAudio } : {}),
      });
      pendingBinary = "";
      utteranceId = null;
      firstChunk = true;
      return committed;
    },
    interrupt() {
      pendingBinary = "";
      utteranceId = null;
      firstChunk = true;
      return send({ type: "agent.interrupt", event_id: makeEventId() });
    },
    hasPendingAudio() {
      return Boolean(utteranceId || pendingBinary);
    },
  };
}
