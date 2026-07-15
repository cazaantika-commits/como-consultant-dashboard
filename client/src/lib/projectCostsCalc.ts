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
  const communityFees = parseFloat(p.communityFees || "0");
  const surveyorFees = parseFloat(p.surveyorFees || "0");
  const reraAuditReportFee = parseFloat(p.reraAuditReportFee || "0");
  const reraInspectionReportFee = parseFloat(p.reraInspectionReportFee || "0");
  const designFeePct = parseFloat(p.designFeePct ?? "2");
  const supervisionFeePct = parseFloat(p.supervisionFeePct ?? "2");
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
    retailSmallPrice: (p.retailSmallPrice || cp?.baseRetailSmallPrice || 0) * scenarioMultiplier,
    retailMediumPrice: (p.retailMediumPrice || cp?.baseRetailMediumPrice || 0) * scenarioMultiplier,
    retailLargePrice: (p.retailLargePrice || cp?.baseRetailLargePrice || 0) * scenarioMultiplier,
    officeSmallPrice: (p.officeSmallPrice || cp?.baseOfficeSmallPrice || 0) * scenarioMultiplier,
    officeMediumPrice: (p.officeMediumPrice || cp?.baseOfficeMediumPrice || 0) * scenarioMultiplier,
    officeLargePrice: (p.officeLargePrice || cp?.baseOfficeLargePrice || 0) * scenarioMultiplier,
  };
  const prices = basePrices;

  // Revenue calculation — mirrors CostsCashFlowTab logic:
  // 1. Use saved counts if available, otherwise compute from pct
  // 2. Absorb surplus into the largest unit type (2BR for residential) via effectiveAvg
  const UNIT_DEFS = [
    { cat: "residential", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", countKey: "residentialStudioCount", priceField: "studioPrice" as const, is2br: false },
    { cat: "residential", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", countKey: "residential1brCount", priceField: "oneBrPrice" as const, is2br: false },
    { cat: "residential", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", countKey: "residential2brCount", priceField: "twoBrPrice" as const, is2br: true },
    { cat: "residential", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", countKey: "residential3brCount", priceField: "threeBrPrice" as const, is2br: false },
    { cat: "retail", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", countKey: "retailSmallCount", priceField: "retailSmallPrice" as const, is2br: false },
    { cat: "retail", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", countKey: "retailMediumCount", priceField: "retailMediumPrice" as const, is2br: false },
    { cat: "retail", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", countKey: "retailLargeCount", priceField: "retailLargePrice" as const, is2br: false },
    { cat: "offices", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", countKey: "officeSmallCount", priceField: "officeSmallPrice" as const, is2br: false },
    { cat: "offices", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", countKey: "officeMediumCount", priceField: "officeMediumPrice" as const, is2br: false },
    { cat: "offices", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", countKey: "officeLargeCount", priceField: "officeLargePrice" as const, is2br: false },
  ];

  const getSellable = (cat: string) => cat === "residential" ? saleableRes : cat === "retail" ? saleableRet : saleableOff;

  // Step 1: compute count and avg for each unit type
  // Prefer project-level fields (new model), fall back to mo fields (old model)
  const unitData = UNIT_DEFS.map(def => {
    // Try project-level area fields first (new: residential1brArea, retailSmallArea, etc.)
    const projectAreaKey = def.countKey.replace('Count', 'Area');
    const projectArea = p[projectAreaKey] || 0;
    const avgArea = projectArea > 0 ? projectArea : (mo ? getAvg(def.pctKey, (mo as any)[def.avgKey]) : 0);
    
    // Try project-level count first
    const projectCount = p[def.countKey] || 0;
    const savedCount = projectCount > 0 ? projectCount : (mo ? (mo as any)[def.countKey] : null);
    let count = 0;
    if (savedCount != null && savedCount > 0) {
      count = savedCount;
    } else if (mo) {
      const pct = parseFloat((mo as any)[def.pctKey] || "0");
      const sellable = getSellable(def.cat);
      if (pct > 0 && avgArea > 0 && sellable > 0) {
        count = Math.floor((sellable * pct / 100) / avgArea);
      }
    }
    const price = prices[def.priceField] || 0;
    return { ...def, count, avgArea, price, totalArea: count * avgArea };
  });

  // Step 2: absorb surplus into the is2br unit type per category (same as CostsCashFlowTab)
  const categories = ["residential", "retail", "offices"];
  let revenueRes = 0, revenueRet = 0, revenueOff = 0;

  for (const cat of categories) {
    const catUnits = unitData.filter(u => u.cat === cat);
    const sellable = getSellable(cat);
    const catTotalArea = catUnits.reduce((s, u) => s + u.totalArea, 0);
    const surplus = sellable - catTotalArea;

    let catRevenue = 0;
    for (const u of catUnits) {
      let effectiveAvg = u.avgArea;
      // Absorb surplus into the designated absorber (is2br)
      if (u.is2br && surplus > 0 && u.count > 0) {
        effectiveAvg = u.avgArea + (surplus / u.count);
      }
      catRevenue += u.count * effectiveAvg * u.price;
    }

    if (cat === "residential") revenueRes = catRevenue;
    else if (cat === "retail") revenueRet = catRevenue;
    else revenueOff = catRevenue;
  }

  const totalRevenue = revenueRes + revenueRet + revenueOff;

  // CALCULATED COSTS (using corrected formulas from new engine)
  const agentCommissionLand = landPrice * (agentCommissionLandPct / 100);
  const landRegistration = landPrice * 0.04;
  const constructionCost = bua * estimatedConstructionPricePerSqft;
  const designFee = constructionCost * (designFeePct / 100);
  const supervisionFee = constructionCost * (supervisionFeePct / 100);
  const totalGfaSqft = gfaResSqft + gfaRetSqft + gfaOffSqft;
  const separationFee = totalGfaSqft * separationFeePerM2;
  const contingencies = constructionCost * 0.02;

  // أتعاب المطور حسب السيناريو: O3 (no_offplan) = 3% max
  const financingScenario = p.financingScenario || "offplan_escrow";
  const effectiveDeveloperFeePct = financingScenario === "no_offplan" 
    ? Math.min(developerFeePct, 3) : developerFeePct;
  const developerFee = totalRevenue * (effectiveDeveloperFeePct / 100);
  const salesCommission = totalRevenue * (salesCommissionPct / 100);
  const marketingCost = totalRevenue * (marketingPct / 100);

  // رسوم ريرا المحسوبة (الصيغ الجديدة)
  const totalUnits = unitData.reduce((s, u) => s + u.count, 0);
  const computedReraUnitRegFee = totalUnits > 0 ? totalUnits * 800 : reraUnitRegFee;
  const computedCommunityFees = totalGfaSqft > 0 ? totalGfaSqft * (communityFees > 0 && totalGfaSqft > 0 ? communityFees / totalGfaSqft : 1) : communityFees;
  const constructionMonths = parseInt(p.constructionMonths || "16");
  const inspectionVisits = Math.floor(constructionMonths / 3) + 1;
  const computedReraInspectionFee = inspectionVisits * 15000;

  const totalRegulatory = computedReraUnitRegFee + reraProjectRegFee + developerNocFee + escrowAccountFee + bankFees + surveyorFees + reraAuditReportFee + computedReraInspectionFee;
  const totalCosts = landPrice + agentCommissionLand + landRegistration + soilTestFee + topographicSurveyFee + officialBodiesFees + designFee + supervisionFee + separationFee + constructionCost + computedCommunityFees + contingencies + developerFee + salesCommission + marketingCost + totalRegulatory;

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
    contingencies,
    developerFee,
    salesCommission,
    marketingCost,
    reraUnitRegFee: computedReraUnitRegFee,
    reraProjectRegFee,
    developerNocFee,
    escrowAccountFee,
    bankFees,
    surveyorFees,
    reraAuditReportFee,
    reraInspectionReportFee: computedReraInspectionFee,
    revenueRes,
    revenueRet,
    revenueOff,
    totalRevenue,
    totalCosts,
  };
}
