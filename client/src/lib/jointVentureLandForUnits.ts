export const JOINT_VENTURE_LAND_FOR_UNITS = "joint_venture_land_for_units" as const;

export type JointVentureTerms = {
  landOwnerProjectSharePct: number;
  landOwnerResidentialSharePct: number;
  landOwnerCommercialSharePct: number;
  developmentLicenseCost: number;
  waelLicenseRegistrationCost: number;
  landOwnerLicenseRegistrationCost: number;
  landOwnerUnitsRegistrationFeePct: number;
};

export const DEFAULT_JOINT_VENTURE_TERMS: JointVentureTerms = {
  landOwnerProjectSharePct: 35,
  landOwnerResidentialSharePct: 35,
  landOwnerCommercialSharePct: 35,
  developmentLicenseCost: 0,
  waelLicenseRegistrationCost: 0,
  landOwnerLicenseRegistrationCost: 0,
  landOwnerUnitsRegistrationFeePct: 4,
};

export function clampSharePct(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
}

export function isJointVentureLandForUnits(scenario: unknown): boolean {
  return scenario === JOINT_VENTURE_LAND_FOR_UNITS;
}

export function getJointVentureTerms(project: any): JointVentureTerms {
  let stored: any = {};
  try {
    stored = JSON.parse(project?.constructionScheduleJson || "{}")?.settings?.jointVenture || {};
  } catch {
    stored = {};
  }

  const landOwnerProjectSharePct = clampSharePct(
    stored.landOwnerProjectSharePct ?? stored.landOwnerResidentialSharePct ?? stored.landOwnerCommercialSharePct,
    DEFAULT_JOINT_VENTURE_TERMS.landOwnerProjectSharePct,
  );

  return {
    landOwnerProjectSharePct,
    landOwnerResidentialSharePct: landOwnerProjectSharePct,
    landOwnerCommercialSharePct: landOwnerProjectSharePct,
    developmentLicenseCost: Math.max(0, Number(stored.developmentLicenseCost) || 0),
    waelLicenseRegistrationCost: Math.max(0, Number(stored.waelLicenseRegistrationCost) || 0),
    landOwnerLicenseRegistrationCost: Math.max(0, Number(stored.landOwnerLicenseRegistrationCost) || 0),
    landOwnerUnitsRegistrationFeePct: clampSharePct(
      stored.landOwnerUnitsRegistrationFeePct,
      DEFAULT_JOINT_VENTURE_TERMS.landOwnerUnitsRegistrationFeePct,
    ),
  };
}

export function saveJointVentureTerms(
  constructionScheduleJson: unknown,
  terms: Partial<JointVentureTerms>,
): string {
  let stored: any = {};
  try {
    stored = JSON.parse(typeof constructionScheduleJson === "string" ? constructionScheduleJson : "{}") || {};
  } catch {
    stored = {};
  }
  stored.settings ||= {};
  const existingTerms = stored.settings.jointVenture || {};
  const previous = getJointVentureTerms({ constructionScheduleJson: JSON.stringify(stored) });
  const normalizedShare = clampSharePct(
    terms.landOwnerProjectSharePct ?? terms.landOwnerResidentialSharePct ?? terms.landOwnerCommercialSharePct,
    previous.landOwnerProjectSharePct,
  );
  stored.settings.jointVenture = {
    ...existingTerms,
    ...previous,
    ...terms,
    landOwnerProjectSharePct: normalizedShare,
    landOwnerResidentialSharePct: normalizedShare,
    landOwnerCommercialSharePct: normalizedShare,
    developmentLicenseCost: Math.max(0, Number(terms.developmentLicenseCost ?? previous.developmentLicenseCost) || 0),
    waelLicenseRegistrationCost: Math.max(0, Number(terms.waelLicenseRegistrationCost ?? previous.waelLicenseRegistrationCost) || 0),
    landOwnerLicenseRegistrationCost: Math.max(0, Number(terms.landOwnerLicenseRegistrationCost ?? previous.landOwnerLicenseRegistrationCost) || 0),
    landOwnerUnitsRegistrationFeePct: clampSharePct(
      terms.landOwnerUnitsRegistrationFeePct,
      previous.landOwnerUnitsRegistrationFeePct,
    ),
  };
  return JSON.stringify(stored);
}

export function calculateJointVentureAgreementCosts(
  landOwnerUnitsValue: number,
  terms: JointVentureTerms,
) {
  const developmentLicenseCost = Math.max(0, terms.developmentLicenseCost);
  const waelLicenseRegistrationCost = Math.max(0, terms.waelLicenseRegistrationCost);
  const landOwnerLicenseRegistrationCost = Math.max(0, terms.landOwnerLicenseRegistrationCost);
  const initialAgreementCosts = developmentLicenseCost
    + waelLicenseRegistrationCost
    + landOwnerLicenseRegistrationCost;
  const landOwnerUnitsRegistrationFeePct = clampSharePct(
    terms.landOwnerUnitsRegistrationFeePct,
    DEFAULT_JOINT_VENTURE_TERMS.landOwnerUnitsRegistrationFeePct,
  );
  const landOwnerUnitsRegistrationCost = Math.max(0, landOwnerUnitsValue)
    * landOwnerUnitsRegistrationFeePct / 100;

  return {
    developmentLicenseCost,
    waelLicenseRegistrationCost,
    landOwnerLicenseRegistrationCost,
    initialAgreementCosts,
    landOwnerUnitsRegistrationFeePct,
    landOwnerUnitsRegistrationCost,
    totalAgreementCosts: initialAgreementCosts + landOwnerUnitsRegistrationCost,
  };
}

export function calculateJointVentureRevenueShare(input: {
  grossResidentialRevenue: number;
  grossRetailRevenue: number;
  grossOfficeRevenue: number;
  terms: JointVentureTerms;
  saleableResidentialArea?: number;
  saleableRetailArea?: number;
  saleableOfficeArea?: number;
  pricedResidentialArea?: number;
  pricedRetailArea?: number;
  pricedOfficeArea?: number;
}) {
  const residentialRate = input.terms.landOwnerResidentialSharePct / 100;
  const commercialRate = input.terms.landOwnerCommercialSharePct / 100;
  const hasExplicitAreaBasis = [
    input.saleableResidentialArea,
    input.saleableRetailArea,
    input.saleableOfficeArea,
    input.pricedResidentialArea,
    input.pricedRetailArea,
    input.pricedOfficeArea,
  ].some((value) => value !== undefined);
  const nonNegative = (value: unknown) => Math.max(0, Number(value) || 0);
  const weightedAveragePrice = (revenue: number, pricedArea: number) => pricedArea > 0 ? revenue / pricedArea : 0;

  const pricedResidentialArea = nonNegative(input.pricedResidentialArea);
  const pricedRetailArea = nonNegative(input.pricedRetailArea);
  const pricedOfficeArea = nonNegative(input.pricedOfficeArea);
  const saleableResidentialArea = hasExplicitAreaBasis ? nonNegative(input.saleableResidentialArea) : 0;
  const saleableRetailArea = hasExplicitAreaBasis ? nonNegative(input.saleableRetailArea) : 0;
  const saleableOfficeArea = hasExplicitAreaBasis ? nonNegative(input.saleableOfficeArea) : 0;
  const residentialAveragePricePerSqft = hasExplicitAreaBasis
    ? weightedAveragePrice(input.grossResidentialRevenue, pricedResidentialArea)
    : 0;
  const retailAveragePricePerSqft = hasExplicitAreaBasis
    ? weightedAveragePrice(input.grossRetailRevenue, pricedRetailArea)
    : 0;
  const officeAveragePricePerSqft = hasExplicitAreaBasis
    ? weightedAveragePrice(input.grossOfficeRevenue, pricedOfficeArea)
    : 0;

  const grossResidentialRevenue = hasExplicitAreaBasis
    ? saleableResidentialArea * residentialAveragePricePerSqft
    : input.grossResidentialRevenue;
  const grossRetailRevenue = hasExplicitAreaBasis
    ? saleableRetailArea * retailAveragePricePerSqft
    : input.grossRetailRevenue;
  const grossOfficeRevenue = hasExplicitAreaBasis
    ? saleableOfficeArea * officeAveragePricePerSqft
    : input.grossOfficeRevenue;
  const grossCommercialRevenue = grossRetailRevenue + grossOfficeRevenue;
  const saleableCommercialArea = saleableRetailArea + saleableOfficeArea;
  const commercialAveragePricePerSqft = saleableCommercialArea > 0
    ? grossCommercialRevenue / saleableCommercialArea
    : 0;
  const landOwnerResidentialArea = saleableResidentialArea * residentialRate;
  const landOwnerRetailArea = saleableRetailArea * commercialRate;
  const landOwnerOfficeArea = saleableOfficeArea * commercialRate;
  const landOwnerCommercialArea = landOwnerRetailArea + landOwnerOfficeArea;
  const developerResidentialArea = saleableResidentialArea - landOwnerResidentialArea;
  const developerRetailArea = saleableRetailArea - landOwnerRetailArea;
  const developerOfficeArea = saleableOfficeArea - landOwnerOfficeArea;
  const developerCommercialArea = developerRetailArea + developerOfficeArea;

  const landOwnerResidentialValue = hasExplicitAreaBasis
    ? landOwnerResidentialArea * residentialAveragePricePerSqft
    : grossResidentialRevenue * residentialRate;
  const landOwnerRetailValue = hasExplicitAreaBasis
    ? landOwnerRetailArea * retailAveragePricePerSqft
    : grossRetailRevenue * commercialRate;
  const landOwnerOfficeValue = hasExplicitAreaBasis
    ? landOwnerOfficeArea * officeAveragePricePerSqft
    : grossOfficeRevenue * commercialRate;
  const landOwnerCommercialValue = landOwnerRetailValue + landOwnerOfficeValue;
  const developerResidentialRevenue = grossResidentialRevenue - landOwnerResidentialValue;
  const developerRetailRevenue = grossRetailRevenue - landOwnerRetailValue;
  const developerOfficeRevenue = grossOfficeRevenue - landOwnerOfficeValue;
  const developerCommercialRevenue = developerRetailRevenue + developerOfficeRevenue;
  const developerTotalRevenue = developerResidentialRevenue + developerCommercialRevenue;
  const grossTotalRevenue = grossResidentialRevenue + grossCommercialRevenue;

  return {
    calculationBasis: hasExplicitAreaBasis ? "saleable_area_weighted_price" as const : "gross_revenue_share" as const,
    grossResidentialRevenue,
    grossRetailRevenue,
    grossOfficeRevenue,
    grossCommercialRevenue,
    grossTotalRevenue,
    saleableResidentialArea,
    saleableRetailArea,
    saleableOfficeArea,
    saleableCommercialArea,
    residentialAveragePricePerSqft,
    retailAveragePricePerSqft,
    officeAveragePricePerSqft,
    commercialAveragePricePerSqft,
    landOwnerResidentialArea,
    landOwnerRetailArea,
    landOwnerOfficeArea,
    landOwnerCommercialArea,
    developerResidentialArea,
    developerRetailArea,
    developerOfficeArea,
    developerCommercialArea,
    landOwnerResidentialValue,
    landOwnerRetailValue,
    landOwnerOfficeValue,
    landOwnerCommercialValue,
    landOwnerTotalValue: landOwnerResidentialValue + landOwnerCommercialValue,
    developerResidentialRevenue,
    developerRetailRevenue,
    developerOfficeRevenue,
    developerCommercialRevenue,
    developerTotalRevenue,
  };
}

export function calculateDeveloperRevenueShare(
  pricing: {
    revenueResidential: number;
    revenueRetail: number;
    revenueOffice: number;
    totalRevenue: number;
    areaResidential?: number;
    areaRetail?: number;
    areaOffice?: number;
  },
  projectType: string,
  terms: JointVentureTerms,
  saleableAreas?: {
    residential: number;
    retail: number;
    office: number;
  },
) {
  if (!isJointVentureLandForUnits(projectType)) {
    const pricedResidentialArea = Math.max(0, Number(pricing.areaResidential) || 0);
    const pricedRetailArea = Math.max(0, Number(pricing.areaRetail) || 0);
    const pricedOfficeArea = Math.max(0, Number(pricing.areaOffice) || 0);
    return {
      calculationBasis: "gross_revenue_share" as const,
      grossResidentialRevenue: pricing.revenueResidential,
      grossRetailRevenue: pricing.revenueRetail,
      grossOfficeRevenue: pricing.revenueOffice,
      grossCommercialRevenue: pricing.revenueRetail + pricing.revenueOffice,
      grossTotalRevenue: pricing.totalRevenue,
      saleableResidentialArea: pricedResidentialArea,
      saleableRetailArea: pricedRetailArea,
      saleableOfficeArea: pricedOfficeArea,
      saleableCommercialArea: pricedRetailArea + pricedOfficeArea,
      residentialAveragePricePerSqft: pricedResidentialArea > 0 ? pricing.revenueResidential / pricedResidentialArea : 0,
      retailAveragePricePerSqft: pricedRetailArea > 0 ? pricing.revenueRetail / pricedRetailArea : 0,
      officeAveragePricePerSqft: pricedOfficeArea > 0 ? pricing.revenueOffice / pricedOfficeArea : 0,
      commercialAveragePricePerSqft: pricedRetailArea + pricedOfficeArea > 0 ? (pricing.revenueRetail + pricing.revenueOffice) / (pricedRetailArea + pricedOfficeArea) : 0,
      landOwnerResidentialArea: 0,
      landOwnerRetailArea: 0,
      landOwnerOfficeArea: 0,
      landOwnerCommercialArea: 0,
      developerResidentialArea: pricedResidentialArea,
      developerRetailArea: pricedRetailArea,
      developerOfficeArea: pricedOfficeArea,
      developerCommercialArea: pricedRetailArea + pricedOfficeArea,
      landOwnerResidentialValue: 0,
      landOwnerRetailValue: 0,
      landOwnerOfficeValue: 0,
      landOwnerCommercialValue: 0,
      landOwnerTotalValue: 0,
      developerResidentialRevenue: pricing.revenueResidential,
      developerRetailRevenue: pricing.revenueRetail,
      developerOfficeRevenue: pricing.revenueOffice,
      developerCommercialRevenue: pricing.revenueRetail + pricing.revenueOffice,
      developerTotalRevenue: pricing.totalRevenue,
    };
  }
  return calculateJointVentureRevenueShare({
    grossResidentialRevenue: pricing.revenueResidential,
    grossRetailRevenue: pricing.revenueRetail,
    grossOfficeRevenue: pricing.revenueOffice,
    terms,
    saleableResidentialArea: saleableAreas?.residential,
    saleableRetailArea: saleableAreas?.retail,
    saleableOfficeArea: saleableAreas?.office,
    pricedResidentialArea: pricing.areaResidential,
    pricedRetailArea: pricing.areaRetail,
    pricedOfficeArea: pricing.areaOffice,
  });
}

export function calculateJointVentureAreaShare(project: any, terms: JointVentureTerms) {
  const saleableResidentialArea = Math.max(0, Number(project?.gfaResidentialSqft || 0))
    * clampSharePct(project?.saleableResidentialPct, 0) / 100;
  const saleableRetailArea = Math.max(0, Number(project?.gfaRetailSqft || 0))
    * clampSharePct(project?.saleableRetailPct, 0) / 100;
  const saleableOfficeArea = Math.max(0, Number(project?.gfaOfficesSqft || 0))
    * clampSharePct(project?.saleableOfficesPct, 0) / 100;
  const landOwnerResidentialArea = saleableResidentialArea * terms.landOwnerResidentialSharePct / 100;
  const commercialArea = saleableRetailArea + saleableOfficeArea;
  const landOwnerCommercialArea = commercialArea * terms.landOwnerCommercialSharePct / 100;

  return {
    saleableResidentialArea,
    landOwnerResidentialArea,
    developerResidentialArea: saleableResidentialArea - landOwnerResidentialArea,
    saleableCommercialArea: commercialArea,
    landOwnerCommercialArea,
    developerCommercialArea: commercialArea - landOwnerCommercialArea,
  };
}
