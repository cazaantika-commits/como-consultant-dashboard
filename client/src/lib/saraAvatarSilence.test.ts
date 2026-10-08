import { describe, expect, it } from "vitest";
import { silenceSaraAvatarVideo } from "./saraAvatarSilence";

describe("Sara visual-only video", () => {
  it("silences video after the SDK attaches and unmutes its audio track", () => {
    const video = { muted: false, defaultMuted: false, volume: 1 };
    silenceSaraAvatarVideo(video);
    expect(video).toEqual({ muted: true, defaultMuted: true, volume: 0 });
  });

  it("reasserts silence if the SDK changes the video volume again", () => {
    const video = { muted: true, defaultMuted: true, volume: 0 };
    video.muted = false;
    video.volume = 0.8;
    silenceSaraAvatarVideo(video);
    expect(video).toEqual({ muted: true, defaultMuted: true, volume: 0 });
  });
});
