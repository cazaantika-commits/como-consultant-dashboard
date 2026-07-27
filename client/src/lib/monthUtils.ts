/**
 * Arabic month abbreviations and utility functions for month labeling across all pages.
 * All pages should import from here instead of defining their own.
 */

export const MONTH_NAMES_AR = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

/**
 * Get the Arabic month abbreviation for a given absolute month index (0-based from project start).
 * @param monthIndex - 0-based month index from project start
 * @param projectStartDate - ISO date string like "2026-08" or "2026-08-01"
 * @returns Arabic month abbreviation or empty string if no startDate
 */
export function getMonthLabel(monthIndex: number, projectStartDate?: string): string {
  if (!projectStartDate) return "";
  const parts = projectStartDate.split("-");
  const startMonth = parseInt(parts[1]) - 1; // 0-based
  const idx = (startMonth + monthIndex) % 12;
  return MONTH_NAMES_AR[idx];
}

/**
 * Get month label for a specific phase-relative month.
 * @param phaseRelativeIndex - 0-based index within the phase
 * @param phaseStartAbsoluteMonth - 0-based absolute month where this phase starts
 * @param projectStartDate - ISO date string like "2026-08"
 */
export function getPhaseMonthLabel(phaseRelativeIndex: number, phaseStartAbsoluteMonth: number, projectStartDate?: string): string {
  return getMonthLabel(phaseStartAbsoluteMonth + phaseRelativeIndex, projectStartDate);
}
