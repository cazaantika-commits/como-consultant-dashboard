export type SaraAvatarVideoElement = Pick<HTMLVideoElement, "muted" | "defaultMuted" | "volume">;

/**
 * The avatar is visual-only. Its SDK may clear `muted` when it attaches a
 * remote audio track, so silence must be reasserted after attach and whenever
 * the element reports a volume change. OpenAI WebRTC owns all audible output.
 */
export function silenceSaraAvatarVideo(video: SaraAvatarVideoElement): void {
  if (!video.defaultMuted) video.defaultMuted = true;
  if (!video.muted) video.muted = true;
  if (video.volume !== 0) video.volume = 0;
}
