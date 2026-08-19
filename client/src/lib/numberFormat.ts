/**
 * Presentation-only financial number formatting.
 *
 * Examples:
 *   122000000.00 -> 122,000,000
 *   755555.56    -> 755,555.56
 *   "1.415"      -> 1.415
 *
 * This helper never emits compact K/M/ك/م labels. It must not be used to
 * prepare values for saving or for financial calculations.
 */
export function formatFullNumber(
  value: number | string | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;

  const isStoredText = typeof value === "string";
  const supplied = isStoredText ? value.replace(/,/g, "").trim() : String(value);
  if (!supplied || !/^-?\d+(?:\.\d+)?$/.test(supplied)) return fallback;

  const negative = supplied.startsWith("-");
  const unsigned = negative ? supplied.slice(1) : supplied;
  // Saved input text keeps its meaningful precision. Computed JS numbers are
  // normalized to two decimal places so binary floating-point artifacts stay hidden.
  const normalized = isStoredText ? unsigned : Number(unsigned).toFixed(2);
  const [wholePart, decimalPart] = normalized.split(".");
  const groupedWhole = Number(wholePart).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const meaningfulDecimal = decimalPart?.replace(/0+$/, "");

  return `${negative ? "-" : ""}${groupedWhole}${meaningfulDecimal ? `.${meaningfulDecimal}` : ""}`;
}

/** Accept a raw text entry by removing grouping commas before it is saved. */
export function unformatNumberInput(value: string): string {
  return value.replace(/,/g, "");
}
