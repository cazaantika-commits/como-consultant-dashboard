/**
 * Fee selection is intentionally local to the legacy calculation path.  An
 * explicit setting is authoritative; in its absence each legacy report keeps
 * the behaviour it had before fee modes were introduced.
 */
export type ConsultantFeeMode = "amount" | "percentage" | "percentage_minimum" | "none";
export type LegacyConsultantFeeRule = "fixed_override" | "percentage";

export type ConsultantFeeSpec = {
  mode: ConsultantFeeMode;
  amount?: number;
  percentage?: number;
  minimum?: number;
};

export type ConsultantFeeSpecs = {
  design?: ConsultantFeeSpec;
  supervision?: ConsultantFeeSpec;
};

const FEE_MODES = new Set<ConsultantFeeMode>([
  "amount",
  "percentage",
  "percentage_minimum",
  "none",
]);

/** Preserve an explicitly entered zero; missing and malformed values use only the caller's legacy fallback. */
export function readConsultantFeePercentage(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Reads only the additive project-card setting.  It deliberately does not
 * infer a mode from existing fixed/pct fields: those fields have different
 * historic precedence in different reports.
 */
export function readConsultantFeeSpecs(constructionScheduleJson: unknown): ConsultantFeeSpecs {
  let schedule: unknown = constructionScheduleJson;
  if (typeof constructionScheduleJson === "string") {
    try {
      schedule = JSON.parse(constructionScheduleJson);
    } catch {
      return {};
    }
  }

  const fees = (schedule as { settings?: { consultantFees?: unknown } } | null)?.settings?.consultantFees;
  if (!fees || typeof fees !== "object") return {};
  const finiteNonNegative = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === "") return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
  };
  const readSpec = (value: unknown): ConsultantFeeSpec | undefined => {
    const candidate = typeof value === "string"
      ? value
      : (value as { mode?: unknown; activeCalculationMode?: unknown } | null)?.mode
        ?? (value as { activeCalculationMode?: unknown } | null)?.activeCalculationMode;
    if (typeof candidate !== "string" || !FEE_MODES.has(candidate as ConsultantFeeMode)) return undefined;
    const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
    return {
      mode: candidate as ConsultantFeeMode,
      amount: finiteNonNegative(raw.amount),
      percentage: finiteNonNegative(raw.percentage),
      minimum: finiteNonNegative(raw.minimum),
    };
  };
  const settings = fees as { design?: unknown; supervision?: unknown };
  return { design: readSpec(settings.design), supervision: readSpec(settings.supervision) };
}

/** Compatibility convenience for callers that need only the chosen modes. */
export function readConsultantFeeModes(constructionScheduleJson: unknown): {
  design?: ConsultantFeeMode;
  supervision?: ConsultantFeeMode;
} {
  const specs = readConsultantFeeSpecs(constructionScheduleJson);
  return { design: specs.design?.mode, supervision: specs.supervision?.mode };
}

/**
 * Resolves one consultant fee without silently choosing a fixed amount over a
 * percentage.  In explicit modes, a zero is valid and no fallback is applied.
 * `fixedFee` is the amount (and, only for percentage_minimum, the floor).
 */
export function resolveConsultantFee(
  constructionCost: number,
  percentage: number,
  fixedFee?: unknown,
  mode?: ConsultantFeeMode,
  legacyRule: LegacyConsultantFeeRule = "fixed_override",
): number {
  const base = Number.isFinite(constructionCost) ? constructionCost : 0;
  const pct = Number.isFinite(percentage) ? percentage : 0;
  const fixed = Number(fixedFee);
  const amount = Number.isFinite(fixed) && fixed >= 0 ? fixed : 0;
  const percentageAmount = base * pct / 100;

  if (mode === "amount") return amount;
  if (mode === "percentage") return percentageAmount;
  if (mode === "percentage_minimum") return Math.max(percentageAmount, amount);
  if (mode === "none") return 0;

  // Legacy Project Costs cards treated a positive fixed value as an override;
  // the original project-data engine always used the percentage instead.
  return legacyRule === "fixed_override" && amount > 0 ? amount : percentageAmount;
}
