import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SARA_WEBRTC_DISCONNECT_GRACE_MS,
  SaraWebRtcAudioTransport,
  SaraWebRtcDisconnectGuard,
  type SaraAudioElement,
} from "./saraWebRtcAudio";

type FakeAudio = SaraAudioElement & { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };

function makeAudio(overrides: Partial<FakeAudio> = {}): FakeAudio {
  return {
    muted: true,
    volume: 0,
    paused: true,
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    ...overrides,
  };
}

function makeStream(track: object) {
  return { getAudioTracks: () => [track] } as unknown as MediaStream;
}

afterEach(() => vi.useRealTimers());

describe("SaraWebRtcAudioTransport", () => {
  it("keeps the WebRTC audio element as the sole source when the same track is announced again", async () => {
    const audio = makeAudio();
    const diagnostics: string[] = [];
    const transport = new SaraWebRtcAudioTransport(item => diagnostics.push(item.event));
    const track = {};
    const firstStream = makeStream(track);
    const reannouncedStream = makeStream(track);

    await expect(transport.attach(audio, firstStream)).resolves.toBe("playing");
    audio.paused = false;
    await expect(transport.attach(audio, reannouncedStream)).resolves.toBe("playing");

    expect(audio.srcObject).toBe(firstStream);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBe(1);
    expect(diagnostics).toEqual(["source_attached", "playback_started", "source_reused"]);
  });

  it("recovers autoplay from a user retry without replacing the stream or element", async () => {
    const blocked = Object.assign(new Error("gesture required"), { name: "NotAllowedError" });
    const audio = makeAudio({ play: vi.fn().mockRejectedValueOnce(blocked).mockResolvedValueOnce(undefined) });
    const transport = new SaraWebRtcAudioTransport();
    const stream = makeStream({});

    await expect(transport.attach(audio, stream)).resolves.toBe("blocked");
    await expect(transport.resume(audio)).resolves.toBe("playing");

    expect(audio.srcObject).toBe(stream);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("detaches only when a Sara session ends", async () => {
    const audio = makeAudio();
    const transport = new SaraWebRtcAudioTransport();
    const stream = makeStream({});
    await transport.attach(audio, stream);

    transport.detach(audio);

    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.srcObject).toBeNull();
  });
});

describe("SaraWebRtcDisconnectGuard", () => {
  it("lets a transient disconnect recover during the medium grace period", () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const guard = new SaraWebRtcDisconnectGuard({
      onGraceStarted: () => events.push("grace"),
      onRecovered: () => events.push("recovered"),
      onExpired: reason => events.push(`expired:${reason}`),
    });

    guard.handle("disconnected");
    vi.advanceTimersByTime(SARA_WEBRTC_DISCONNECT_GRACE_MS - 1);
    guard.handle("connected");
    vi.advanceTimersByTime(1);

    expect(events).toEqual(["grace", "recovered"]);
  });

  it("escalates a sustained disconnect only after the medium grace period", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const guard = new SaraWebRtcDisconnectGuard({ onGraceStarted: vi.fn(), onRecovered: vi.fn(), onExpired: expired });

    guard.handle("disconnected");
    vi.advanceTimersByTime(SARA_WEBRTC_DISCONNECT_GRACE_MS - 1);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(expired).toHaveBeenCalledWith("disconnected");
  });

  it("escalates terminal peer failure immediately", () => {
    const expired = vi.fn();
    const guard = new SaraWebRtcDisconnectGuard({ onGraceStarted: vi.fn(), onRecovered: vi.fn(), onExpired: expired });

    guard.handle("failed");

    expect(expired).toHaveBeenCalledWith("failed");
  });
});
