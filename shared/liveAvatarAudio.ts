type PatchableAudioSocket = {
  send: (data: unknown) => unknown;
  __comoPcmBase64Patched?: boolean;
};

type SessionWithAudioSocket = {
  _sessionEventSocket?: PatchableAudioSocket;
};

export const LIVE_AVATAR_PCM_SEGMENT_SECONDS = 1;
const PCM_SAMPLE_RATE = 24_000;
const PCM_BYTES_PER_SAMPLE = 2;

export function pcmBase64ToBinaryString(audioBase64: string) {
  return globalThis.atob(audioBase64);
}

export function splitPcm24kBase64ForLiveAvatar(audioBase64: string, segmentSeconds = LIVE_AVATAR_PCM_SEGMENT_SECONDS) {
  const binary = pcmBase64ToBinaryString(audioBase64);
  const requestedBytes = Math.max(PCM_BYTES_PER_SAMPLE, Math.floor(segmentSeconds * PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE));
  const bytesPerSegment = requestedBytes - (requestedBytes % PCM_BYTES_PER_SAMPLE);
  const segments: string[] = [];
  for (let offset = 0; offset < binary.length; offset += bytesPerSegment) {
    segments.push(binary.slice(offset, offset + bytesPerSegment));
  }
  return segments;
}

export function pcm24kBinaryDurationMs(binary: string) {
  return (binary.length / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE)) * 1000;
}

export function patchLiveAvatarPcmTransport(session: unknown) {
  const socket = (session as SessionWithAudioSocket | null)?._sessionEventSocket;
  if (!socket || socket.__comoPcmBase64Patched) return Boolean(socket);
  const originalSend = socket.send.bind(socket);
  socket.send = (data: unknown) => {
    if (typeof data !== "string") return originalSend(data);
    try {
      const event = JSON.parse(data) as { type?: string; audio?: unknown };
      if (event.type === "agent.speak" && typeof event.audio === "string") {
        event.audio = globalThis.btoa(event.audio);
        return originalSend(JSON.stringify(event));
      }
    } catch {
      // Non-JSON WebSocket traffic must pass through unchanged.
    }
    return originalSend(data);
  };
  socket.__comoPcmBase64Patched = true;
  return true;
}
