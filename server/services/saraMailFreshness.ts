// COMO mail import, analysis and executive stages each run every 30 minutes.
// Allow for scheduling jitter and one missed cycle before describing mail as stale.
export const COMO_MAIL_STAGE_STALE_MS = 90 * 60_000;
