export const KHAZEN_DOCUMENT_FACT_SHEET_FIELDS = [
  "plotNumber", "areaCode", "titleDeedNumber", "ddaNumber", "masterDevRef",
  "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
  "permittedUse", "ownershipType", "subdivisionRestrictions",
  "masterDevName", "masterDevAddress", "sellerName", "sellerAddress",
  "buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail",
  "electricityAllocation", "waterAllocation", "sewageAllocation",
  "tripAM", "tripLT", "tripPM",
  "effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions",
  "saleRestrictions", "resaleConditions", "communityCharges",
  "registrationAuthority", "adminFee", "clearanceFee", "compensationAmount",
  "governingLaw", "disputeResolution",
  "parkingRequirementsText", "parkingRulesJson", "parkingSourceReference", "parkingAvailableSpaces",
] as const;

const DECIMAL_DOCUMENT_FIELDS = new Set(["plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft"]);
const INTEGER_DOCUMENT_FIELDS = new Set(["adminFee", "clearanceFee", "compensationAmount", "parkingAvailableSpaces"]);

function normalizeDocumentNumber(value: unknown, wholeNumber: boolean): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (wholeNumber && !Number.isInteger(value))) return undefined;
    return value;
  }

  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/,/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || (wholeNumber && !Number.isInteger(parsed))) return undefined;
  return parsed;
}

/**
 * Accept only document-derived fields for Khazen. Financial planning BUA is
 * deliberately excluded: the fact sheet holds documentary GFA separately,
 * while BUA remains a controlled financial input.
 */
export function buildKhazenFactSheetUpdate(fields: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  for (const key of KHAZEN_DOCUMENT_FACT_SHEET_FIELDS) {
    const value = fields[key];
    if (value === undefined || value === null || value === "") continue;

    if (DECIMAL_DOCUMENT_FIELDS.has(key)) {
      const normalized = normalizeDocumentNumber(value, false);
      if (normalized !== undefined) updateData[key] = normalized;
      continue;
    }

    if (INTEGER_DOCUMENT_FIELDS.has(key)) {
      const normalized = normalizeDocumentNumber(value, true);
      if (normalized !== undefined) updateData[key] = normalized;
      continue;
    }

    updateData[key] = value;
  }

  return updateData;
}
