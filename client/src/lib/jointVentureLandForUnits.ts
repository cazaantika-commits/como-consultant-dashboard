export const JOINT_VENTURE_LAND_FOR_UNITS = "joint_venture_land_for_units" as const;

export type JointVentureTerms = {
  landOwnerResidentialSharePct: number;
  landOwnerCommercialSharePct: number;
  developmentLicenseCost: number;
  waelLicenseRegistrationCost: number;
  landOwnerLicenseRegistrationCost: number;
  landOwnerUnitsRegistrationFeePct: number;
};

export const DEFAULT_JOINT_VENTURE_TERMS: JointVentureTerms = {
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

  return {
    landOwnerResidentialSharePct: clampSharePct(
      stored.landOwnerProjectSharePct ?? stored.landOwnerResidentialSharePct,
      DEFAULT_JOINT_VENTURE_TERMS.landOwnerResidentialSharePct,
    ),
    landOwnerCommercialSharePct: clampSharePct(
      stored.landOwnerProjectSharePct ?? stored.landOwnerResidentialSharePct ?? stored.landOwnerCommercialSharePct,
      DEFAULT_JOINT_VENTURE_TERMS.landOwnerCommercialSharePct,
    ),
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
  const previous = getJointVentureTerms({ constructionScheduleJson: JSON.stringify(stored) });
  const normalizedShare = clampSharePct(
    terms.landOwnerResidentialSharePct ?? terms.landOwnerCommercialSharePct,
    previous.landOwnerResidentialSharePct,
  );
  stored.settings.jointVenture = {
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
}) {
  const residentialRate = input.terms.landOwnerResidentialSharePct / 100;
  const commercialRate = input.terms.landOwnerCommercialSharePct / 100;
  const grossCommercialRevenue = input.grossRetailRevenue + input.grossOfficeRevenue;
  const landOwnerResidentialValue = input.grossResidentialRevenue * residentialRate;
  const landOwnerCommercialValue = grossCommercialRevenue * commercialRate;
  const developerResidentialRevenue = input.grossResidentialRevenue - landOwnerResidentialValue;
  const developerRetailRevenue = input.grossRetailRevenue * (1 - commercialRate);
  const developerOfficeRevenue = input.grossOfficeRevenue * (1 - commercialRate);
  const developerCommercialRevenue = developerRetailRevenue + developerOfficeRevenue;
  const developerTotalRevenue = developerResidentialRevenue + developerCommercialRevenue;
  const grossTotalRevenue = input.grossResidentialRevenue + grossCommercialRevenue;

  return {
    grossResidentialRevenue: input.grossResidentialRevenue,
    grossCommercialRevenue,
    grossTotalRevenue,
    landOwnerResidentialValue,
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
  },
  projectType: string,
  terms: JointVentureTerms,
) {
  if (!isJointVentureLandForUnits(projectType)) {
    return {
      grossResidentialRevenue: pricing.revenueResidential,
      grossCommercialRevenue: pricing.revenueRetail + pricing.revenueOffice,
      grossTotalRevenue: pricing.totalRevenue,
      landOwnerResidentialValue: 0,
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
