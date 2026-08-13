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
  const basePrices = {
    studioPrice: (cp?.baseStudioPrice || 0) * scenarioMultiplier,
    oneBrPrice: (p.residential1brPrice || cp?.base1brPrice || 0) * scenarioMultiplier,
    twoBrPrice: (p.residential2brPrice || cp?.base2brPrice || 0) * scenarioMultiplier,
    threeBrPrice: (p.residential3brPrice || cp?.base3brPrice || 0) * scenarioMultiplier,
    villaPrice: (p.villaPrice || 0) * scenarioMultiplier,
    townhousePrice: (p.townhousePrice || 0) * scenarioMultiplier,
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
  const UNIT_DEFS = [
    { cat: "residential", countKey: "residential1brCount", areaKey: "residential1brArea", priceField: "oneBrPrice" as const, defArea: 750, defPrice: 1650 },
    { cat: "residential", countKey: "residential2brCount", areaKey: "residential2brArea", priceField: "twoBrPrice" as const, defArea: 1300, defPrice: 1550 },
    { cat: "residential", countKey: "residential3brCount", areaKey: "residential3brArea", priceField: "threeBrPrice" as const, defArea: 1650, defPrice: 1450 },
    { cat: "residential", countKey: "villaCount", areaKey: "villaArea", priceField: "villaPrice" as const, defArea: 0, defPrice: 0 },
    { cat: "residential", countKey: "townhouseCount", areaKey: "townhouseArea", priceField: "townhousePrice" as const, defArea: 0, defPrice: 0 },
    { cat: "retail", countKey: "retailSmallCount", areaKey: "retailSmallArea", priceField: "retailSmallPrice" as const, defArea: 850, defPrice: 3000 },
    { cat: "retail", countKey: "retailMediumCount", areaKey: "retailMediumArea", priceField: "retailMediumPrice" as const, defArea: 1200, defPrice: 2500 },
    { cat: "retail", countKey: "retailLargeCount", areaKey: "retailLargeArea", priceField: "retailLargePrice" as const, defArea: 1800, defPrice: 2000 },
    { cat: "offices", countKey: "officeSmallCount", areaKey: "officeSmallArea", priceField: "officeSmallPrice" as const, defArea: 1200, defPrice: 1900 },
    { cat: "offices", countKey: "officeMediumCount", areaKey: "officeMediumArea", priceField: "officeMediumPrice" as const, defArea: 2000, defPrice: 1800 },
    { cat: "offices", countKey: "officeLargeCount", areaKey: "officeLargeArea", priceField: "officeLargePrice" as const, defArea: 3500, defPrice: 1700 },
  ];

  const unitData = UNIT_DEFS.map(def => {
    const count = Number(p[def.countKey]) || 0;
    const area = Number(p[def.areaKey]) || def.defArea;
    const price = prices[def.priceField] || def.defPrice;
    return { ...def, count, area, price, revenue: count * area * price };
  });

  let revenueRes = 0, revenueRet = 0, revenueOff = 0;
  for (const u of unitData) {
    if (u.cat === "residential") revenueRes += u.revenue;
    else if (u.cat === "retail") revenueRet += u.revenue;
    else revenueOff += u.revenue;
  }

  const totalRevenue = revenueRes + revenueRet + revenueOff;

  // CALCULATED COSTS (using corrected formulas from new engine)
  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = designFeeFixed > 0 ? designFeeFixed : constructionCost * (designFeePct / 100);
  const supervisionFee = supervisionFeeFixed > 0 ? supervisionFeeFixed : constructionCost * (supervisionFeePct / 100);
  const totalGfaSqft = gfaResSqft + gfaRetSqft + gfaOffSqft;
  const separationFee = totalGfaSqft * separationFeePerM2;
  const surveyorFees = parseFloat(p.surveyorFees || "0");
  const surveyorDwgFees = parseFloat(p.surveyorDwgFees || "0") || 12000;

  const financingScenario = p.financingScenario || "offplan_escrow";
  const isBuildForSale = financingScenario === "build_for_sale";
  let buildForSaleMarketingRate = 1;
  try {
    buildForSaleMarketingRate = Number(JSON.parse(p.constructionScheduleJson || "{}")?.settings?.configurableRates?.buildForSaleMarketingRate ?? 1);
  } catch { /* use the approved 1% default */ }
  const effectiveDeveloperFeePct = isBuildForSale ? 3 : financingScenario === "no_offplan"
    ? Math.min(developerFeePct, 3) : developerFeePct;
  const effectiveMarketingPct = isBuildForSale ? buildForSaleMarketingRate : marketingPct;
  const developerFee = totalRevenue * (effectiveDeveloperFeePct / 100);
  const salesCommission = totalRevenue * (salesCommissionPct / 100);
  const marketingCost = totalRevenue * (effectiveMarketingPct / 100);

  // رسوم ريرا المحسوبة (الصيغ الجديدة)
  const totalUnits = unitData.reduce((s, u) => s + u.count, 0);
  const computedReraUnitRegFee = totalUnits > 0 ? totalUnits * 800 : reraUnitRegFee;
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

  const totalRegulatory = isBuildForSale
    ? computedReraUnitRegFee + developerNocFee
    : computedReraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + computedReraAuditReportFee + computedReraInspectionFee;
  const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + computedCommunityFees + surveyorFees + (isBuildForSale ? 0 : surveyorDwgFees) + developerFee + salesCommission + marketingCost + totalRegulatory;

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
    surveyorDwgFees: isBuildForSale ? 0 : surveyorDwgFees,
    developerFee,
    salesCommission,
    marketingCost,
    reraUnitRegFee: computedReraUnitRegFee,
    reraProjectRegFee: isBuildForSale ? 0 : reraProjectRegFee,
    developerNocFee,
    escrowAccountFee: isBuildForSale ? 0 : escrowAccountFee,
    bankFees: isBuildForSale ? 0 : bankFees,
    reraAuditReportFee: isBuildForSale ? 0 : computedReraAuditReportFee,
    reraInspectionReportFee: isBuildForSale ? 0 : computedReraInspectionFee,
    revenueRes,
    revenueRet,
    revenueOff,
    totalRevenue,
    totalCosts,
  };
}
