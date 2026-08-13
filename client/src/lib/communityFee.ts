/**
 * Community-fee settings and distribution shared by Financial Studies reports.
 * One payment equals GFA × the configured AED-per-square-foot rate.
 */
export interface CommunityFeeSettings {
  ratePerSqft: number;
  frequencyMonths: number;
}

export interface CommunityFeeSchedule extends CommunityFeeSettings {
  monthlyAmounts: number[];
  perPayment: number;
  total: number;
}

export const DEFAULT_COMMUNITY_FEE_SETTINGS: CommunityFeeSettings = {
  ratePerSqft: 0.25,
  frequencyMonths: 6,
};

function asNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function asPositiveWholeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : fallback;
}

export function getProjectCommunityFeeSettings(project: any): CommunityFeeSettings {
  try {
    const schedule = JSON.parse(project?.constructionScheduleJson || "{}");
    const rates = schedule?.settings?.configurableRates || {};
    return {
      ratePerSqft: asNonNegativeNumber(rates.communityFeePerSqft, DEFAULT_COMMUNITY_FEE_SETTINGS.ratePerSqft),
      frequencyMonths: asPositiveWholeNumber(rates.communityFeeFrequency, DEFAULT_COMMUNITY_FEE_SETTINGS.frequencyMonths),
    };
  } catch {
    return DEFAULT_COMMUNITY_FEE_SETTINGS;
  }
}

export function calculateCommunityFeeSchedule(
  gfaTotal: number,
  totalProjectMonths: number,
  settings: CommunityFeeSettings,
): CommunityFeeSchedule {
  const safeGfa = Math.max(0, Number(gfaTotal) || 0);
  const safeMonths = Math.max(0, Math.round(Number(totalProjectMonths) || 0));
  const perPayment = safeGfa * settings.ratePerSqft;
  const monthlyAmounts = new Array(safeMonths).fill(0);

  for (let monthIndex = 0; monthIndex < safeMonths; monthIndex += settings.frequencyMonths) {
    monthlyAmounts[monthIndex] = perPayment;
  }

  return {
    ...settings,
    monthlyAmounts,
    perPayment,
    total: monthlyAmounts.reduce((sum, amount) => sum + amount, 0),
  };
}
