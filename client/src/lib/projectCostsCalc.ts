/**
 * Shared cost calculation logic — same as CostsCashFlowTab.
 * Used by ExcelCashFlowPage and EscrowCashFlowPage to get dynamic costs
 * from بطاقة المشروع + دراسة الجدوى data.
 */
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import type { ProjectCosts } from "@/lib/cashFlowEngine";

/**
 * Helper: get average area with fallback to DEFAULT_AVG_AREAS
 */
function getAvg(pctKey: string, avgVal: number | null | undefined): number {
  const v = avgVal || 0;
  if (v > 0) return v;
  const mapping = DEFAULT_AVG_AREAS[pctKey];
  return mapping ? mapping.defaultArea : 0;
}

/**
 * Calculate all project costs from raw data.
 * This mirrors the exact logic in CostsCashFlowTab.calcForScenario.
 */
export function calculateProjectCosts(
  project: any,
  marketOverview: any,
  competitionPricing: any,
  scenario?: "optimistic" | "base" | "conservative"
): ProjectCosts | null {
  if (!project) return null;

  const p = project;
  const mo = marketOverview;
  const cp = competitionPricing;
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
  const communityFees = parseFloat(p.communityFees || "0");
  const surveyorFees = parseFloat(p.surveyorFees || "0");
  const reraAuditReportFee = parseFloat(p.reraAuditReportFee || "0");
  const reraInspectionReportFee = parseFloat(p.reraInspectionReportFee || "0");
  const designFeePct = parseFloat(p.designFeePct ?? "2");
  const supervisionFeePct = parseFloat(p.supervisionFeePct ?? "2");
  const separationFeePerM2 = parseFloat(p.separationFeePerM2 ?? "40");
  const salesCommissionPct = parseFloat(p.salesCommissionPct ?? "5");
  const marketingPct = parseFloat(p.marketingPct ?? "2");
  const developerFeePct = parseFloat(p.developerFeePct ?? "5");

  const bua = manualBuaSqft;
  const plotAreaSqft = parseFloat(p.plotAreaSqft || "0");
  const plotAreaM2 = plotAreaSqft * 0.0929;

  const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
  const saleableRes = gfaResSqft * 0.95;
  const saleableRet = gfaRetSqft * 0.97;
  const saleableOff = gfaOffSqft * 0.95;

  // Get prices for the specific scenario
  const getPrices = () => {
    if (!cp) return { studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0, retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0, officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0 };
    if (activeScenario === "optimistic") return {
      studioPrice: cp.optStudioPrice || 0, oneBrPrice: cp.opt1brPrice || 0, twoBrPrice: cp.opt2brPrice || 0, threeBrPrice: cp.opt3brPrice || 0,
      retailSmallPrice: cp.optRetailSmallPrice || 0, retailMediumPrice: cp.optRetailMediumPrice || 0, retailLargePrice: cp.optRetailLargePrice || 0,
      officeSmallPrice: cp.optOfficeSmallPrice || 0, officeMediumPrice: cp.optOfficeMediumPrice || 0, officeLargePrice: cp.optOfficeLargePrice || 0,
    };
    if (activeScenario === "conservative") return {
      studioPrice: cp.consStudioPrice || 0, oneBrPrice: cp.cons1brPrice || 0, twoBrPrice: cp.cons2brPrice || 0, threeBrPrice: cp.cons3brPrice || 0,
      retailSmallPrice: cp.consRetailSmallPrice || 0, retailMediumPrice: cp.consRetailMediumPrice || 0, retailLargePrice: cp.consRetailLargePrice || 0,
      officeSmallPrice: cp.consOfficeSmallPrice || 0, officeMediumPrice: cp.consOfficeMediumPrice || 0, officeLargePrice: cp.consOfficeLargePrice || 0,
    };
    return {
      studioPrice: cp.baseStudioPrice || 0, oneBrPrice: cp.base1brPrice || 0, twoBrPrice: cp.base2brPrice || 0, threeBrPrice: cp.base3brPrice || 0,
      retailSmallPrice: cp.baseRetailSmallPrice || 0, retailMediumPrice: cp.baseRetailMediumPrice || 0, retailLargePrice: cp.baseRetailLargePrice || 0,
      officeSmallPrice: cp.baseOfficeSmallPrice || 0, officeMediumPrice: cp.baseOfficeMediumPrice || 0, officeLargePrice: cp.baseOfficeLargePrice || 0,
    };
  };
  const prices = getPrices();

  const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
    const allocated = saleable * (pct / 100);
    const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
    return avgArea * pricePerSqft * units;
  };

  let revenueRes = 0, revenueRet = 0, revenueOff = 0;

  if (mo) {
    revenueRes += calcTypeRevenue(parseFloat(mo.residentialStudioPct || "0"), getAvg("residentialStudioPct", mo.residentialStudioAvgArea), prices.studioPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential1brPct || "0"), getAvg("residential1brPct", mo.residential1brAvgArea), prices.oneBrPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential2brPct || "0"), getAvg("residential2brPct", mo.residential2brAvgArea), prices.twoBrPrice, saleableRes);
    revenueRes += calcTypeRevenue(parseFloat(mo.residential3brPct || "0"), getAvg("residential3brPct", mo.residential3brAvgArea), prices.threeBrPrice, saleableRes);

    revenueRet += calcTypeRevenue(parseFloat(mo.retailSmallPct || "0"), getAvg("retailSmallPct", mo.retailSmallAvgArea), prices.retailSmallPrice, saleableRet);
    revenueRet += calcTypeRevenue(parseFloat(mo.retailMediumPct || "0"), getAvg("retailMediumPct", mo.retailMediumAvgArea), prices.retailMediumPrice, saleableRet);
    revenueRet += calcTypeRevenue(parseFloat(mo.retailLargePct || "0"), getAvg("retailLargePct", mo.retailLargeAvgArea), prices.retailLargePrice, saleableRet);

    revenueOff += calcTypeRevenue(parseFloat(mo.officeSmallPct || "0"), getAvg("officeSmallPct", mo.officeSmallAvgArea), prices.officeSmallPrice, saleableOff);
    revenueOff += calcTypeRevenue(parseFloat(mo.officeMediumPct || "0"), getAvg("officeMediumPct", mo.officeMediumAvgArea), prices.officeMediumPrice, saleableOff);
    revenueOff += calcTypeRevenue(parseFloat(mo.officeLargePct || "0"), getAvg("officeLargePct", mo.officeLargeAvgArea), prices.officeLargePrice, saleableOff);
  }

  const totalRevenue = revenueRes + revenueRet + revenueOff;

  // CALCULATED COSTS
  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = constructionCost * (designFeePct / 100);
  const supervisionFee = constructionCost * (supervisionFeePct / 100);
  const separationFee = plotAreaM2 * separationFeePerM2;
  const contingencies = constructionCost * 0.02;
  const developerFee = totalRevenue * (developerFeePct / 100);
  const salesCommission = totalRevenue * (salesCommissionPct / 100);
  const marketingCost = totalRevenue * (marketingPct / 100);

  const totalRegulatory = reraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + reraInspectionReportFee;
  const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + communityFees + contingencies + developerFee + salesCommission + marketingCost + totalRegulatory;

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
    communityFees,
    contingencies,
    developerFee,
    salesCommission,
    marketingCost,
    reraUnitRegFee,
    reraProjectRegFee,
    developerNocFee,
    escrowAccountFee,
    bankFees,
    surveyorFees,
    reraAuditReportFee,
    reraInspectionReportFee,
    totalRevenue,
    totalCosts,
  };
}
