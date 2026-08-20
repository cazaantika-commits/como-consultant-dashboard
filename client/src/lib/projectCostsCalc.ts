/**
 * Shared cost calculation logic — same as CostsCashFlowTab.
 * Used by ExcelCashFlowPage and EscrowCashFlowPage to get dynamic costs
 * from بطاقة المشروع + دراسة الجدوى data.
 */
import type { ProjectCosts } from "@/lib/cashFlowEngine";
import {
  calculateCommunityFeeSchedule,
  getProjectCommunityFeeSettings,
} from "@/lib/communityFee";
import { getProjectDesignTiming, getProjectReraQuarterlyFeeSettings } from "@/lib/projectTiming";
import { buildPricingUnits } from "@/lib/investorCashFlowEngine";
import { calculatePricingFormulas, dbProjectToInputs } from "@/lib/projectData";

/**
 * Calculate all project costs from raw data.
 * This mirrors the exact logic in CostsCashFlowTab.calcForScenario.
 */
export function calculateProjectCosts(
  project: any,
  marketOverview?: any,
  competitionPricing?: any,
  scenario?: "optimistic" | "base" | "conservative"
): ProjectCosts | null {
  if (!project) return null;

  const p = project;
  // Prefer reading unit data from project record directly (new dynamic model)
  // Fall back to marketOverview/competitionPricing for backward compatibility
  const mo = marketOverview || p;
  const cp = competitionPricing || p;
  const activeScenario = scenario || (cp?.activeScenario || "base") as "optimistic" | "base" | "conservative";

  const landPrice = parseFloat(p.landPrice || "0");
  const agentCommissionLandPct = parseFloat(p.agentCommissionLandPct || "0");
  const manualBuaSqft = parseFloat(p.manualBuaSqft || "0");
  const estimatedConstructionPricePerSqft = parseFloat(p.estimatedConstructionPricePerSqft || "0");
  const soilTestFee = parseFloat(p.soilTestFee || "0");
  const topographicSurveyFee = parseFloat(p.topographicSurveyFee || "0");
  const officialBodiesFees = parseFloat(p.officialBodiesFees || "0");
  const reraUnitRegFee = parseFloat(p.reraUnitRegFee || "0");
  const reraProjectRegFee = parseFloat(p.reraProjectRegFee || "0");
  const developerNocFee = parseFloat(p.developerNocFee || "0");
  const escrowAccountFee = parseFloat(p.escrowAccountFee || "0");
  const bankFees = parseFloat(p.bankFees || "0");

  const designFeePct = parseFloat(p.designFeePct ?? "2");
  const designFeeFixed = parseFloat(p.designFeeFixed || "0");
  const supervisionFeePct = parseFloat(p.supervisionFeePct ?? "2");
  const supervisionFeeFixed = parseFloat(p.supervisionFeeFixed || "0");
  const separationFeePerM2 = parseFloat(p.separationFeePerSqft ?? "40");
  const salesCommissionPct = parseFloat(p.salesCommissionPct ?? "5");
  const marketingPct = parseFloat(p.marketingPct ?? "2");
  const developerFeePct = parseFloat(p.developerFeePct ?? "5");

  const bua = manualBuaSqft;
  const plotAreaSqft = parseFloat(p.plotAreaSqft || "0");
  const plotAreaM2 = plotAreaSqft * 0.0929;

  const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
  const saleableResPct = parseFloat(p.saleableResidentialPct ?? "95") / 100;
  const saleableRetPct = parseFloat(p.saleableRetailPct ?? "97") / 100;
  const saleableOffPct = parseFloat(p.saleableOfficesPct ?? "95") / 100;
  const saleableRes = gfaResSqft * saleableResPct;
  const saleableRet = gfaRetSqft * saleableRetPct;
  const saleableOff = gfaOffSqft * saleableOffPct;

  // Get base prices - prefer project-level fields, fall back to cp fields
  const scenarioMultiplier = activeScenario === "optimistic" ? 1.10 : activeScenario === "conservative" ? 0.90 : 1.00;
  const valueOrFallback = (value: unknown, fallback: number) => value === undefined || value === null || value === "" ? fallback : Number(value);
  const basePrices = {
    studioPrice: (cp?.baseStudioPrice || 0) * scenarioMultiplier,
    oneBrPrice: valueOrFallback(p.residential1brPrice, cp?.base1brPrice || 0) * scenarioMultiplier,
    twoBrPrice: valueOrFallback(p.residential2brPrice, cp?.base2brPrice || 0) * scenarioMultiplier,
    threeBrPrice: valueOrFallback(p.residential3brPrice, cp?.base3brPrice || 0) * scenarioMultiplier,
    villaPrice: valueOrFallback(p.villaPrice, 0) * scenarioMultiplier,
    townhousePrice: valueOrFallback(p.townhousePrice, 0) * scenarioMultiplier,
    retailSmallPrice: (p.retailSmallPrice || cp?.baseRetailSmallPrice || 0) * scenarioMultiplier,
    retailMediumPrice: (p.retailMediumPrice || cp?.baseRetailMediumPrice || 0) * scenarioMultiplier,
    retailLargePrice: (p.retailLargePrice || cp?.baseRetailLargePrice || 0) * scenarioMultiplier,
    officeSmallPrice: (p.officeSmallPrice || cp?.baseOfficeSmallPrice || 0) * scenarioMultiplier,
    officeMediumPrice: (p.officeMediumPrice || cp?.baseOfficeMediumPrice || 0) * scenarioMultiplier,
    officeLargePrice: (p.officeLargePrice || cp?.baseOfficeLargePrice || 0) * scenarioMultiplier,
  };
  const prices = basePrices;

  // Revenue calculation — UNIFIED with investorCashFlowEngine:
  // Simple: count × area × price (same as buildPricingUnits + calculatePricingFormulas)
  // This ensures V2Feasibility shows the SAME revenue as ProjectCardOffplanPage and V2InvestorCashFlow
  const sharedPricing = calculatePricingFormulas(buildPricingUnits(p, dbProjectToInputs(p)));
  const revenueRes = sharedPricing.revenueResidential;
  const revenueRet = sharedPricing.revenueRetail;
  const revenueOff = sharedPricing.revenueOffice;
  const calculatedRevenue = sharedPricing.totalRevenue;

  // CALCULATED COSTS (using corrected formulas from new engine)
  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = designFeeFixed > 0 ? designFeeFixed : constructionCost * (designFeePct / 100);
  const supervisionFee = supervisionFeeFixed > 0 ? supervisionFeeFixed : constructionCost * (supervisionFeePct / 100);
  const totalGfaSqft = gfaResSqft + gfaRetSqft + gfaOffSqft;
  const financingScenario = p.financingScenario || "offplan_escrow";
  const isBuildForSale = financingScenario === "build_for_sale";
  const isBuildForRent = financingScenario === "build_for_rent";
  const isIndependentNoOffPlan = isBuildForSale || isBuildForRent;
  const separationFee = isBuildForRent ? 0 : totalGfaSqft * separationFeePerM2;
  const surveyorFees = parseFloat(p.surveyorFees || "0");
  const surveyorDwgFees = parseFloat(p.surveyorDwgFees || "0") || 12000;

  let buildForSaleMarketingRate = 1;
  let buildForRentDeveloperFeeDesignRate = 1.5;
  let buildForRentDeveloperFeeSupervisionRate = 2.5;
  let reraUnitRegistrationFee = 520;
  try {
    const savedRates = JSON.parse(p.constructionScheduleJson || "{}")?.settings?.configurableRates || {};
    buildForSaleMarketingRate = Number(savedRates.buildForSaleMarketingRate ?? 1);
    buildForRentDeveloperFeeDesignRate = Number(savedRates.buildForRentDeveloperFeeDesignRate ?? 1.5);
    buildForRentDeveloperFeeSupervisionRate = Number(savedRates.buildForRentDeveloperFeeSupervisionRate ?? 2.5);
    const configuredUnitRate = Number(savedRates.reraUnitRegistrationFee);
    if (Number.isFinite(configuredUnitRate)) reraUnitRegistrationFee = configuredUnitRate;
  } catch { /* use the approved 1% default */ }
  const effectiveDeveloperFeePct = isIndependentNoOffPlan ? 3 : financingScenario === "no_offplan"
    ? Math.min(developerFeePct, 3) : developerFeePct;
  const effectiveMarketingPct = isBuildForRent ? 0 : isBuildForSale ? buildForSaleMarketingRate : marketingPct;
  const developerFee = isBuildForRent
    ? constructionCost * ((buildForRentDeveloperFeeDesignRate + buildForRentDeveloperFeeSupervisionRate) / 100)
    : calculatedRevenue * (effectiveDeveloperFeePct / 100);
  const salesCommission = isBuildForRent ? 0 : calculatedRevenue * (salesCommissionPct / 100);
  const marketingCost = isBuildForRent ? 0 : calculatedRevenue * (effectiveMarketingPct / 100);
  const totalRevenue = isBuildForRent ? 0 : calculatedRevenue;

  // رسوم ريرا المحسوبة (الصيغ الجديدة)
  const totalUnits = sharedPricing.totalUnits;
  const computedReraUnitRegFee = totalUnits > 0 ? totalUnits * reraUnitRegistrationFee : reraUnitRegFee;
  const designDuration = getProjectDesignTiming(p).designMonths;
  const communitySchedule = calculateCommunityFeeSchedule(
    totalGfaSqft,
    designDuration + parseInt(p.constructionMonths || "16"),
    getProjectCommunityFeeSettings(p),
  );
  const computedCommunityFees = communitySchedule.total;
  const reraQuarterlyFees = getProjectReraQuarterlyFeeSettings(p);
  const computedReraAuditReportFee = reraQuarterlyFees.auditorTotal;
  const computedReraInspectionFee = reraQuarterlyFees.inspectionTotal;

  const totalRegulatory = isBuildForRent
    ? 0
    : isBuildForSale
    ? computedReraUnitRegFee + developerNocFee
    : computedReraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + computedReraAuditReportFee + computedReraInspectionFee;
  const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + computedCommunityFees + surveyorFees + (isIndependentNoOffPlan ? 0 : surveyorDwgFees) + developerFee + salesCommission + marketingCost + totalRegulatory;

  return {
    landPrice,
    agentCommissionLand,
    landRegistration,
    soilTestFee,
    topographicSurveyFee,
    officialBodiesFees,
    designFee,
    supervisionFee,
    separationFee,
    constructionCost,
    communityFees: computedCommunityFees,
    surveyorFees,
    surveyorDwgFees: isIndependentNoOffPlan ? 0 : surveyorDwgFees,
    developerFee,
    salesCommission,
    marketingCost,
    reraUnitRegFee: isBuildForRent ? 0 : computedReraUnitRegFee,
    reraProjectRegFee: isIndependentNoOffPlan ? 0 : reraProjectRegFee,
    developerNocFee: isBuildForRent ? 0 : developerNocFee,
    escrowAccountFee: isIndependentNoOffPlan ? 0 : escrowAccountFee,
    bankFees: isIndependentNoOffPlan ? 0 : bankFees,
    reraAuditReportFee: isIndependentNoOffPlan ? 0 : computedReraAuditReportFee,
    reraInspectionReportFee: isIndependentNoOffPlan ? 0 : computedReraInspectionFee,
    revenueRes: isBuildForRent ? 0 : revenueRes,
    revenueRet: isBuildForRent ? 0 : revenueRet,
    revenueOff: isBuildForRent ? 0 : revenueOff,
    totalRevenue,
    totalCosts,
  };
}
