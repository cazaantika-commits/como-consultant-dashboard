/**
 * Default average areas for each unit type in the feasibility study.
 * Maps percentage field keys to their corresponding avg area keys and default values.
 */
export const DEFAULT_AVG_AREAS: Record<string, { avgKey: string; defaultArea: number }> = {
  residentialStudioPct: { avgKey: "residentialStudioAvgArea", defaultArea: 400 },
  residential1brPct: { avgKey: "residential1brAvgArea", defaultArea: 700 },
  residential2brPct: { avgKey: "residential2brAvgArea", defaultArea: 1000 },
  residential3brPct: { avgKey: "residential3brAvgArea", defaultArea: 1400 },
  retailSmallPct: { avgKey: "retailSmallAvgArea", defaultArea: 300 },
  retailMediumPct: { avgKey: "retailMediumAvgArea", defaultArea: 600 },
  retailLargePct: { avgKey: "retailLargeAvgArea", defaultArea: 1200 },
  officeSmallPct: { avgKey: "officeSmallAvgArea", defaultArea: 400 },
  officeMediumPct: { avgKey: "officeMediumAvgArea", defaultArea: 800 },
  officeLargePct: { avgKey: "officeLargeAvgArea", defaultArea: 1500 },
};

/**
 * Auto-populate missing average areas where percentage > 0 but avgArea is 0 or missing.
 * This ensures that when data is loaded from the database with a non-zero percentage
 * but a missing average area, the default area is automatically filled in.
 */
export function autoPopulateAvgAreas(
  fieldsObj: Record<string, any>,
  defaults: Record<string, { avgKey: string; defaultArea: number }> = DEFAULT_AVG_AREAS
): Record<string, any> {
  const result = { ...fieldsObj };
  for (const [pctKey, mapping] of Object.entries(defaults)) {
    const pctVal = result[pctKey];
    const avgVal = result[mapping.avgKey];
    if (pctVal > 0 && (!avgVal || avgVal === 0)) {
      result[mapping.avgKey] = mapping.defaultArea;
    }
  }
  return result;
}
