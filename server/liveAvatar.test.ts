import { describe, expect, it } from "vitest";
import { buildLaylaLiveAvatarEmbedRequest, buildSalwaLiveAvatarLiteTokenRequest, buildSaraLiveAvatarTokenRequest, LAYLA_LIVE_AVATAR_ID, LAYLA_LIVE_CONTEXT_ID, SALWA_LIVE_AVATAR_ID, SARA_LIVE_AVATAR_ID } from "./liveAvatar";

describe("Layla LiveAvatar configuration", () => {
  it("uses the selected elegant preset, Arabic default language, and short session limit", () => {
    expect(buildLaylaLiveAvatarEmbedRequest({ isSandbox: false })).toEqual({
      avatar_id: LAYLA_LIVE_AVATAR_ID,
      context_id: LAYLA_LIVE_CONTEXT_ID,
      type: "DEFAULT",
      default_language: "ar",
      max_session_duration: 180,
      is_sandbox: false,
      orientation: "horizontal",
    });
  });

  it("preserves sandbox mode for safe integration checks", () => {
    expect(buildLaylaLiveAvatarEmbedRequest({ isSandbox: true }).is_sandbox).toBe(true);
  });

  it("builds a modern LITE request for the selected avatar without opening a session", () => {
    expect(buildSalwaLiveAvatarLiteTokenRequest({ isSandbox: true })).toEqual({
      mode: "LITE",
      avatar_id: SALWA_LIVE_AVATAR_ID,
      is_sandbox: true,
    });
  });

  it("uses Sara's verified active avatar and keeps session start under an explicit user action", () => {
    expect(SARA_LIVE_AVATAR_ID).toBe("351b2a7d-f048-4e50-952b-120a335e5ec5");
    expect(buildSaraLiveAvatarTokenRequest({ isSandbox: false })).toEqual({
      mode: "LITE",
      avatar_id: SARA_LIVE_AVATAR_ID,
      is_sandbox: false,
      video_settings: { quality: "high", encoding: "H264" },
      max_session_duration: 900,
    });
  });
});
