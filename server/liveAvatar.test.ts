import { describe, expect, it } from "vitest";
import { buildLaylaLiveAvatarEmbedRequest, LAYLA_LIVE_AVATAR_ID, LAYLA_LIVE_CONTEXT_ID } from "./liveAvatar";

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
});
