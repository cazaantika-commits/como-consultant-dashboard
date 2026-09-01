import { isJointVentureLandForUnits } from "./jointVentureLandForUnits";

const UNIT_FIELDS = [
  ["studioCount", "studioArea", "studioPrice"],
  ["residential1brCount", "residential1brArea", "residential1brPrice"],
  ["residential2brCount", "residential2brArea", "residential2brPrice"],
  ["residential2brMaidCount", "residential2brMaidArea", "residential2brMaidPrice"],
  ["residential3brCount", "residential3brArea", "residential3brPrice"],
  ["residential3brMaidCount", "residential3brMaidArea", "residential3brMaidPrice"],
  ["villaCount", "villaArea", "villaPrice"],
  ["townhouseCount", "townhouseArea", "townhousePrice"],
  ["retailSmallCount", "retailSmallArea", "retailSmallPrice"],
  ["retailMediumCount", "retailMediumArea", "retailMediumPrice"],
  ["retailLargeCount", "retailLargeArea", "retailLargePrice"],
  ["officeSmallCount", "officeSmallArea", "officeSmallPrice"],
  ["officeMediumCount", "officeMediumArea", "officeMediumPrice"],
  ["officeLargeCount", "officeLargeArea", "officeLargePrice"],
] as const;

export type JointVentureInputReadiness = {
  applies: boolean;
  hasUnitMix: boolean;
  hasPricing: boolean;
  hasConstructionBasis: boolean;
  hasTimeline: boolean;
  salesWorkspaceReady: boolean;
  financialModelReady: boolean;
  missingLabels: string[];
};

export function getJointVentureInputReadiness(project: any): JointVentureInputReadiness {
  const applies = Boolean(project?.isTestProject) && isJointVentureLandForUnits(project?.financingScenario);
  if (!applies) {
    return {
      applies: false,
      hasUnitMix: true,
      hasPricing: true,
      hasConstructionBasis: true,
      hasTimeline: true,
      salesWorkspaceReady: true,
      financialModelReady: true,
      missingLabels: [],
    };
  }

  const activeUnits = UNIT_FIELDS.filter(([countKey]) => Math.max(0, Number(project?.[countKey]) || 0) > 0);
  const hasUnitMix = activeUnits.length > 0;
  const hasPricing = hasUnitMix && activeUnits.every(([, areaKey, priceKey]) =>
    Number(project?.[areaKey]) > 0 && Number(project?.[priceKey]) > 0,
  );
  const hasConstructionBasis = Number(project?.manualBuaSqft ?? project?.bua) > 0
    && Number(project?.estimatedConstructionPricePerSqft) > 0;

  let settings: any = {};
  try { settings = JSON.parse(project?.constructionScheduleJson || "{}")?.settings || {}; } catch {}
  const designPayments = settings.designPayments;
  const projectPhases = settings.projectPhases;
  const hasDesignSchedule = designPayments
    && typeof designPayments === "object"
    && Object.keys(designPayments).length > 0;
  const requiredPhaseIds = ["marketingPrep", "reraApprovals", "marketingLaunch", "salesStart", "construction"];
  const hasProjectPhaseSchedule = projectPhases
    && requiredPhaseIds.every((phaseId) => projectPhases[phaseId]);
  const hasTimeline = Boolean(project?.startDate)
    && Number(project?.constructionMonths) > 0
    && Boolean(hasDesignSchedule)
    && Boolean(hasProjectPhaseSchedule);

  const missingLabels: string[] = [];
  if (!hasUnitMix) missingLabels.push("توزيع الوحدات");
  else if (!hasPricing) missingLabels.push("مساحات وأسعار أنواع الوحدات المستخدمة");
  if (!hasConstructionBasis) missingLabels.push("المساحة المبنية وتكلفة الإنشاء");
  if (!hasTimeline) missingLabels.push("تاريخ البداية ومدد التصميم وإجراءات الأوف بلان والإنشاء");

  return {
    applies,
    hasUnitMix,
    hasPricing,
    hasConstructionBasis,
    hasTimeline,
    salesWorkspaceReady: hasUnitMix && hasPricing && hasTimeline,
    financialModelReady: hasUnitMix && hasPricing && hasConstructionBasis && hasTimeline,
    missingLabels,
  };
}

export function hasApprovedWaelSalesIndicator(plan: any): boolean {
  if (!plan) return false;
  let results: any = {};
  try { results = JSON.parse(plan.resultsJson || "{}"); } catch {}
  const salesDistribution = Array.isArray(results.salesDistribution) ? results.salesDistribution : [];
  const escrowReceipts = Array.isArray(results.actualEscrowCashInflow) ? results.actualEscrowCashInflow : [];
  return salesDistribution.some((value: unknown) => Number(value) > 0)
    && escrowReceipts.some((value: unknown) => Number(value) > 0);
}

export function isJointVentureFinancialResultReady(project: any, plan: any): boolean {
  const readiness = getJointVentureInputReadiness(project);
  return !readiness.applies
    || (readiness.financialModelReady && hasApprovedWaelSalesIndicator(plan));
}
