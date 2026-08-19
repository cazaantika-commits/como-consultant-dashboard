export type ParkingCategory = "residential" | "retail" | "office";

export type ParkingRules = {
  residential?: {
    thresholdSqft?: number;
    spacesAtOrBelow?: number;
    spacesAbove?: number;
  };
  retail?: { sqftPerSpace?: number };
  office?: { sqftPerSpace?: number };
  visitorPct?: number;
  accessiblePct?: number;
};

export type ParkingSummary = {
  baseRequired: number | null;
  visitorRequired: number | null;
  accessibleRequired: number | null;
  totalRequired: number | null;
  available: number | null;
  variance: number | null;
  missingCategories: ParkingCategory[];
  perCategory: Record<ParkingCategory, number | null>;
  ruleLines: string[];
};

const validNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

export function parseParkingRules(raw: unknown): ParkingRules | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ParkingRules;
  } catch {
    return null;
  }
}

export function calculateUnitParking(category: ParkingCategory, areaSqft: number, count: number, rules: ParkingRules | null): number | null {
  if (count === 0) return 0;
  if (!rules) return null;

  if (category === "residential") {
    const threshold = validNumber(rules.residential?.thresholdSqft);
    const atOrBelow = validNumber(rules.residential?.spacesAtOrBelow);
    const above = validNumber(rules.residential?.spacesAbove);
    if (threshold === null || atOrBelow === null || above === null) return null;
    return count * (areaSqft <= threshold ? atOrBelow : above);
  }

  const sqftPerSpace = validNumber(rules[category]?.sqftPerSpace);
  if (sqftPerSpace === null || sqftPerSpace === 0) return null;
  return Math.ceil((areaSqft * count) / sqftPerSpace);
}

export function calculateParkingSummary(
  rows: Array<{ category: ParkingCategory; areaSqft: number; count: number }>,
  rules: ParkingRules | null,
  availableSpaces: unknown,
): ParkingSummary {
  const categories: ParkingCategory[] = ["residential", "retail", "office"];
  const perCategory = Object.fromEntries(categories.map(category => [category, 0])) as Record<ParkingCategory, number | null>;
  const missingCategories: ParkingCategory[] = [];

  for (const category of categories) {
    const activeRows = rows.filter(row => row.category === category && row.count > 0);
    if (!activeRows.length) continue;
    let subtotal = 0;
    for (const row of activeRows) {
      const calculated = calculateUnitParking(category, row.areaSqft, row.count, rules);
      if (calculated === null) {
        perCategory[category] = null;
        missingCategories.push(category);
        break;
      }
      subtotal += calculated;
    }
    if (perCategory[category] !== null) perCategory[category] = subtotal;
  }

  const baseRequired = missingCategories.length
    ? null
    : categories.reduce((sum, category) => sum + (perCategory[category] || 0), 0);
  const visitorPct = validNumber(rules?.visitorPct);
  const accessiblePct = validNumber(rules?.accessiblePct);
  // Visitor and accessibility percentages are optional additions. Their absence must not hide
  // a fully calculable base requirement from the official project rule.
  const visitorRequired = baseRequired === null ? null : visitorPct === null ? 0 : Math.ceil(baseRequired * visitorPct / 100);
  const accessibleRequired = baseRequired === null ? null : accessiblePct === null ? 0 : Math.ceil(baseRequired * accessiblePct / 100);
  const totalRequired = baseRequired === null ? null : baseRequired + (visitorRequired ?? 0) + (accessibleRequired ?? 0);
  const available = validNumber(availableSpaces);
  const variance = totalRequired === null || available === null ? null : available - totalRequired;

  const ruleLines: string[] = [];
  const threshold = validNumber(rules?.residential?.thresholdSqft);
  const atOrBelow = validNumber(rules?.residential?.spacesAtOrBelow);
  const above = validNumber(rules?.residential?.spacesAbove);
  if (threshold !== null && atOrBelow !== null && above !== null) {
    ruleLines.push(`سكني: ${atOrBelow} موقف حتى ${threshold.toLocaleString("en-US")} قدم²، ثم ${above} موقف`);
  }
  const retailRate = validNumber(rules?.retail?.sqftPerSpace);
  if (retailRate !== null && retailRate > 0) ruleLines.push(`تجزئة: موقف لكل ${retailRate.toLocaleString("en-US")} قدم²`);
  const officeRate = validNumber(rules?.office?.sqftPerSpace);
  if (officeRate !== null && officeRate > 0) ruleLines.push(`مكاتب: موقف لكل ${officeRate.toLocaleString("en-US")} قدم²`);
  if (visitorPct !== null) ruleLines.push(`زوار: ${visitorPct}% من المواقف الأساسية`);
  if (accessiblePct !== null) ruleLines.push(`ذوو الإعاقة: ${accessiblePct}% من المواقف الأساسية`);

  return {
    baseRequired,
    visitorRequired,
    accessibleRequired,
    totalRequired,
    available,
    variance,
    missingCategories,
    perCategory,
    ruleLines,
  };
}
