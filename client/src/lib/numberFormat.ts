/**
 * Presentation-only financial number formatting.
 *
 * Examples:
 *   122000000.00 -> 122,000,000
 *   755555.56    -> 755,556
 *
 * This helper never emits compact K/M/ك/م labels. It must not be used to
 * prepare values for saving or for financial calculations.
 */
export function formatFullNumber(
  value: number | string | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;

  const supplied = typeof value === "string" ? value.replace(/,/g, "").trim() : String(value);
  if (!supplied || !/^-?\d+(?:\.\d+)?$/.test(supplied)) return fallback;

  const negative = supplied.startsWith("-");
  const unsigned = negative ? supplied.slice(1) : supplied;
  const roundedWhole = Math.round(Number(unsigned));
  const groupedWhole = roundedWhole.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${negative ? "-" : ""}${groupedWhole}`;
}

/** Use only for rates and percentages where fractional precision is meaningful. */
export function formatRateOrPercent(
  value: number | string | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const supplied = typeof value === "string" ? value.replace(/,/g, "").trim() : String(value);
  if (!supplied || !/^-?\d+(?:\.\d+)?$/.test(supplied)) return fallback;
  const numberValue = Number(supplied);
  return numberValue.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Accept a raw text entry by removing grouping commas before it is saved. */
export function unformatNumberInput(value: string): string {
  return value.replace(/,/g, "");
}
