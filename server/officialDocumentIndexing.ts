export const OFFICIAL_LAND_FOLDERS = [
  { id: "15qDneHo86eWsk3WsVC49Y1zh4Zl5KFj4", name: "01. Plots Affection Plans", type: "affection_plan" },
  { id: "1ejZO7bVAV5OWUaKK5WZm3pEhdHSVg83W", name: "02. Lands Tittle Deed & Documents", type: "title_deed" },
  { id: "1lhBxdkKGGIJ03guV8LgqOItwrp7qBBXu", name: "03. Plots Guidelines", type: "plot_guidelines" },
  { id: "1dRZ7OuTktOFZhkFsVZJOjmGgEXgQQgdl", name: "04. Site Plan", type: "site_plan" },
] as const;

const PREFIX_BY_AREA_CODE: Array<[RegExp, string]> = [
  [/^MAJ/i, "MAJ"],
  [/^JAD/i, "JAD"],
  [/^(NAS|NAD)/i, "NAD"],
];

export function projectDocumentPrefix(areaCode: string | null | undefined): string | null {
  if (!areaCode) return null;
  return PREFIX_BY_AREA_CODE.find(([pattern]) => pattern.test(areaCode))?.[1] ?? null;
}

export function parseOfficialProjectDocumentFilename(fileName: string): {
  areaPrefix: string;
  plotNumber: string;
  documentType: string;
} | null {
  const match = fileName.match(/^([A-Z]{3})_(\d+)_([A-Z]+)_V[\d.]+\.pdf$/i);
  if (!match) return null;
  return {
    areaPrefix: match[1].toUpperCase(),
    plotNumber: match[2],
    documentType: match[3].toUpperCase(),
  };
}

export function officialDocumentProjectKey(areaPrefix: string, plotNumber: string): string {
  return `${areaPrefix.toUpperCase()}_${plotNumber}`;
}

export type OfficialParkingFacts = {
  requirementsText: string;
  sourceReference: string;
  rules: {
    residential: { thresholdSqft: number; spacesAtOrBelow: number; spacesAbove: number };
    retail: { sqftPerSpace: number };
    office: { sqftPerSpace: number };
  };
};

const SQM_TO_SQFT = 10.7639104167;
const toSqft = (sqm: number) => Math.round(sqm * SQM_TO_SQFT * 100) / 100;

function officialDocumentContent(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { content?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
  } catch {
    // Indexed text is occasionally stored as plain text.
  }
  return raw;
}

export function extractOfficialParkingFacts(rawText: string | null, sourceName: string): OfficialParkingFacts | null {
  const content = officialDocumentContent(rawText);
  const match = content.match(
    /PARKING:\s*FOR APARTMENT,\s*ONE BAY FOR EACH UNIT LESS THAN OR EQUAL TO\s*([\d.]+)\s*SQ\.M\s*GFA\s*AND TWO BAYS FOR EACH UNIT EXCEEDING\s*([\d.]+)\s*SQ\.M\s*GFA;\s*FOR OFFICES,\s*ONE BAY FOR EACH\s*([\d.]+)\s*SQ\.M\s*OF OFFICE NET AREA;\s*FOR RETAIL,\s*ONE BAY FOR EACH\s*([\d.]+)\s*SQ\.M\s*OF RETAIL NET AREA\./i,
  );
  if (!match) return null;

  const [thresholdSqm, aboveSqm, officeSqm, retailSqm] = match.slice(1).map(Number);
  if (![thresholdSqm, aboveSqm, officeSqm, retailSqm].every(Number.isFinite)) return null;

  return {
    requirementsText: match[0].replace(/\s+/g, " ").trim(),
    sourceReference: `${sourceName} — GENERAL NOTES / PARKING`,
    rules: {
      residential: { thresholdSqft: toSqft(thresholdSqm), spacesAtOrBelow: 1, spacesAbove: 2 },
      office: { sqftPerSpace: toSqft(officeSqm) },
      retail: { sqftPerSpace: toSqft(retailSqm) },
    },
  };
}
