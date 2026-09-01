import type { SalesResult, Scenario } from "@/lib/investorCashFlowEngine";
import { clampMarketingDistributionToStart, getProjectMarketingTiming } from "./projectTiming";
import {
  buildPaymentReceiptEvents,
  cloneFlexiblePaymentPlan,
  getPaymentPlanPostHandoverMonths,
  normalizeFlexiblePaymentPlan,
} from "./flexiblePaymentPlan";
import {
  buildPaymentCalendar,
  buyerDueCalendar,
  calendarEntriesFromPlan,
  expandPaymentCalendarEntries,
} from "./paymentPlanCalendar";
import { getJointVentureTerms, isJointVentureLandForUnits } from "./jointVentureLandForUnits";

export interface DefaultOffPlanSalesInput {
  totalRevenue: number;
  totalUnits: number;
  salesStartMonth: number;
  constructionStartMonth: number;
  constructionMonths: number;
  projectEndMonth: number;
}

export function buildMarketingMonthlyWeights(
  distribution: Record<string, number[]> | undefined,
  startMonth: number,
): number[] | undefined {
  const channels = Object.values(distribution || {}).filter(Array.isArray) as number[][];
  if (channels.length === 0) return undefined;
  const maxLength = Math.max(...channels.map((channel) => channel.length));
  const combined = new Array(Math.max(0, startMonth - 1) + maxLength).fill(0);
  for (const channel of channels) {
    for (let month = 0; month < channel.length; month++) {
      combined[Math.max(0, startMonth - 1) + month] += Math.max(0, Number(channel[month]) || 0);
    }
  }
  const total = combined.reduce((sum, amount) => sum + amount, 0);
  return total > 0 ? combined.map((amount) => amount / total) : undefined;
}

const PROJECT_UNIT_COUNT_KEYS = [
  "studioCount", "residential1brCount", "residential2brCount", "residential2brMaidCount",
  "residential3brCount", "residential3brMaidCount", "villaCount", "townhouseCount",
  "retailSmallCount", "retailMediumCount", "retailLargeCount",
  "officeSmallCount", "officeMediumCount", "officeLargeCount",
] as const;

export function getSavedProjectUnitCount(project: any): number {
  return PROJECT_UNIT_COUNT_KEYS.reduce((sum, key) => sum + Math.max(0, Number(project?.[key]) || 0), 0);
}

function distributeUnitsAcrossSalesWindow({
  totalUnits,
  months,
  mode,
  speed,
  template,
  manual,
}: {
  totalUnits: number;
  months: number;
  mode?: string;
  speed?: number;
  template?: string;
  manual?: unknown[];
}): number[] {
  const safeMonths = Math.max(1, Math.floor(months));
  const target = Math.max(0, Math.round(totalUnits));
  if (mode === "manual" && Array.isArray(manual) && manual.length === safeMonths) {
    const values = manual.map((value) => Math.max(0, Math.round(Number(value) || 0)));
    const difference = target - values.reduce((sum, value) => sum + value, 0);
    if (values.length > 0) values[Math.floor(values.length / 2)] = Math.max(0, values[Math.floor(values.length / 2)] + difference);
    return values;
  }

  const safeSpeed = Math.min(100, Math.max(0, Number(speed) || 50));
  let raw: number[];
  if (template === "fast") raw = Array.from({ length: safeMonths }, (_, index) => Math.exp(-index / (safeMonths * 0.3)));
  else if (template === "gradual") raw = Array.from({ length: safeMonths }, (_, index) => 1 + index * 0.5);
  else if (template === "late") raw = Array.from({ length: safeMonths }, (_, index) => Math.exp(-(safeMonths - 1 - index) / (safeMonths * 0.3)));
  else {
    const midpoint = safeMonths * (1 - safeSpeed / 100) + (safeMonths / 2) * (safeSpeed / 100);
    const sigma = safeMonths / (3 + (safeSpeed / 100) * 3);
    raw = Array.from({ length: safeMonths }, (_, index) =>
      Math.exp(-0.5 * Math.pow((index - midpoint + safeMonths / 2) / sigma, 2)),
    );
  }
  const rawTotal = raw.reduce((sum, value) => sum + value, 0) || 1;
  const distribution = raw.map((value) => Math.max(1, Math.round((value / rawTotal) * target)));
  if (distribution.length > 0) {
    distribution[Math.floor(distribution.length / 2)] += target - distribution.reduce((sum, value) => sum + value, 0);
  }
  return distribution.map((value) => Math.max(0, value));
}

export function rebuildOffPlanSalesResultsFromPaymentPlan({
  project,
  totalRevenue,
  offplanPct,
  salesAbsorptionJson,
  paymentPlanJson,
  existingResultsJson,
}: {
  project: any;
  totalRevenue: number;
  offplanPct: number;
  salesAbsorptionJson?: string | null;
  paymentPlanJson: string;
  existingResultsJson?: string | null;
}) {
  let absorption: any = {};
  let existingResults: any = {};
  try { absorption = JSON.parse(salesAbsorptionJson || "{}"); } catch { absorption = {}; }
  try { existingResults = JSON.parse(existingResultsJson || "{}"); } catch { existingResults = {}; }

  const paymentPlan = normalizeFlexiblePaymentPlan(JSON.parse(paymentPlanJson));
  const timing = getProjectMarketingTiming(project);
  const grossTotalUnits = getSavedProjectUnitCount(project);
  const jointVentureTerms = getJointVentureTerms(project);
  const totalUnits = isJointVentureLandForUnits(project?.financingScenario)
    ? grossTotalUnits * (1 - jointVentureTerms.landOwnerResidentialSharePct / 100)
    : grossTotalUnits;
  const offPlanUnits = Math.min(totalUnits, Math.max(0, Math.round(totalUnits * Math.min(100, Math.max(0, offplanPct)) / 100)));
  const salesMonths = Math.max(1, timing.projectEndMonth - timing.salesStartMonth + 1);
  const salesDistribution = distributeUnitsAcrossSalesWindow({
    totalUnits: offPlanUnits,
    months: salesMonths,
    mode: absorption.mode,
    speed: absorption.speed,
    template: absorption.template,
    manual: absorption.manual,
  });
  const context = {
    projectSalesStartMonth: timing.salesStartMonth,
    constructionStartMonth: timing.constructionStartMonth,
    constructionEndMonth: timing.projectEndMonth,
    projectStartDate: project?.startDate,
  };
  const calendar = buildPaymentCalendar(
    expandPaymentCalendarEntries(calendarEntriesFromPlan(paymentPlan), context),
    context,
  );
  const finalCalendarMonth = calendar.reduce((maximum, row) => Math.max(maximum, row.month), timing.projectEndMonth);
  const horizon = Math.max(timing.projectEndMonth + 13, finalCalendarMonth);
  const cashByMonth = new Array(horizon + 1).fill(0);
  const escrowByMonth = new Array(horizon + 1).fill(0);
  const investorByMonth = new Array(horizon + 1).fill(0);
  const bookingByMonth = new Array(horizon + 1).fill(0);
  const averageUnitRevenue = totalUnits > 0 ? Math.max(0, totalRevenue) / totalUnits : 0;

  salesDistribution.forEach((units, index) => {
    const saleMonth = timing.salesStartMonth + index;
    const saleRevenue = units * averageUnitRevenue;
    buyerDueCalendar(calendar, saleMonth).forEach((event) => {
      if (event.month > horizon) return;
      const amount = saleRevenue * event.percentage / 100;
      cashByMonth[event.month] += amount;
      if (event.recipient === "investor") investorByMonth[event.month] += amount;
      else {
        escrowByMonth[event.month] += amount;
        if (event.id === "booking") bookingByMonth[event.month] += amount;
      }
    });
  });

  const actualCashInflow = Array.from({ length: horizon }, (_, index) => cashByMonth[index + 1] || 0);
  const actualEscrowCashInflow = Array.from({ length: horizon }, (_, index) => escrowByMonth[index + 1] || 0);
  const actualInvestorCashInflow = Array.from({ length: horizon }, (_, index) => investorByMonth[index + 1] || 0);
  const escrowData = salesDistribution.map((units, index) => {
    const month = timing.salesStartMonth + index;
    const income = actualEscrowCashInflow[month - 1] || 0;
    const downPayment = bookingByMonth[month] || 0;
    return {
      month,
      units,
      income,
      downPayment,
      installments: income - downPayment,
      withdrawal: 0,
      balance: 0,
      cumulativeSold: salesDistribution.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
    };
  });

  return {
    paymentPlan,
    salesAbsorptionJson: JSON.stringify({
      ...absorption,
      manual: absorption.mode === "manual" ? salesDistribution : (Array.isArray(absorption.manual) ? absorption.manual.slice(0, salesMonths) : []),
      paymentPlanVersion: 2,
      paymentPlan,
    }),
    resultsJson: JSON.stringify({
      ...existingResults,
      escrowData,
      salesDistribution,
      actualCashInflow,
      actualEscrowCashInflow,
      actualInvestorCashInflow,
      actualCashInflowVersion: 2,
    }),
    salesDistribution,
    actualCashInflow,
    actualEscrowCashInflow,
    actualInvestorCashInflow,
    salesStartMonth: timing.salesStartMonth,
    projectEndMonth: timing.projectEndMonth,
  };
}

/**
 * The first view of an Off-Plan project has no saved Wael plan yet. This
 * default mirrors the interactive Sales workspace so the Escrow report starts
 * from the same sales curve and buyer-payment schedule before the first save.
 */
export function buildDefaultOffPlanSalesResult({
  totalRevenue,
  totalUnits,
  salesStartMonth,
  constructionStartMonth,
  constructionMonths,
  projectEndMonth,
}: DefaultOffPlanSalesInput): SalesResult {
  const offplanPct = 80;
  const offPlanUnits = Math.round(Math.max(0, totalUnits) * offplanPct / 100);
  const salesMonths = Math.max(1, projectEndMonth - salesStartMonth + 1);
  const speed = 50;
  const mid = salesMonths * (1 - speed / 100) + (salesMonths / 2) * (speed / 100);
  const sigma = salesMonths / (3 + (speed / 100) * 3);
  const rawCurve = Array.from({ length: salesMonths }, (_, index) =>
    Math.exp(-0.5 * Math.pow((index - mid + salesMonths / 2) / sigma, 2)),
  );
  const rawTotal = rawCurve.reduce((sum, value) => sum + value, 0) || 1;
  const salesDistribution = rawCurve.map((value) => Math.max(1, Math.round((value / rawTotal) * offPlanUnits)));
  salesDistribution[Math.floor(salesMonths / 2)] += offPlanUnits - salesDistribution.reduce((sum, value) => sum + value, 0);

  const averageUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
  const paymentPlan = cloneFlexiblePaymentPlan();
  const downPct = paymentPlan.stages.find((stage) => stage.trigger === "sale")?.percentage ?? 10;
  const constructionEndMonth = constructionStartMonth + constructionMonths - 1;
  const cashFlowHorizon = projectEndMonth + Math.max(13, getPaymentPlanPostHandoverMonths(paymentPlan));
  const cashPerMonth = new Array(cashFlowHorizon + 1).fill(0);
  const escrowCashPerMonth = new Array(cashFlowHorizon + 1).fill(0);
  const investorCashPerMonth = new Array(cashFlowHorizon + 1).fill(0);
  const escrowData = salesDistribution.map((units, index) => ({
    month: salesStartMonth + index,
    units,
    income: 0,
    downPayment: units * averageUnitPrice * (downPct / 100),
    installments: 0,
    withdrawal: 0,
    balance: 0,
    cumulativeSold: salesDistribution.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
  }));

  salesDistribution.forEach((units, index) => {
    const saleMonth = salesStartMonth + index;
    const saleAmount = units * averageUnitPrice;
    for (const event of buildPaymentReceiptEvents({ plan: paymentPlan, saleMonth, constructionStartMonth, constructionEndMonth })) {
      if (event.month >= cashPerMonth.length) continue;
      const amount = saleAmount * (event.pct / 100);
      cashPerMonth[event.month] += amount;
      if (event.recipient === "escrow") escrowCashPerMonth[event.month] += amount;
      else investorCashPerMonth[event.month] += amount;
    }
  });

  const actualCashInflow = Array.from({ length: cashFlowHorizon }, (_, index) => cashPerMonth[index + 1] || 0);
  const actualEscrowCashInflow = Array.from({ length: cashFlowHorizon }, (_, index) => escrowCashPerMonth[index + 1] || 0);
  const actualInvestorCashInflow = Array.from({ length: cashFlowHorizon }, (_, index) => investorCashPerMonth[index + 1] || 0);
  escrowData.forEach((entry) => { entry.income = actualEscrowCashInflow[entry.month - 1] || 0; });
  return {
    escrowData,
    salesDistribution,
    actualCashInflow,
    offplanPct,
    ppDownPct: downPct,
    paymentPlan,
    actualEscrowCashInflow,
    actualInvestorCashInflow,
  };
}

/**
 * Converts the saved Sales Plan payload into the exact input consumed by the
 * investor cash-flow engine. Keeping this mapping shared prevents the Project
 * Aggregation page from inventing a second sales or marketing schedule.
 */
export function buildSalesResultFromSavedPlan(
  plan: any | undefined,
  project: any | undefined,
  scenario: Scenario,
): SalesResult | undefined {
  if (!plan) return undefined;

  let marketingMonthlyWeights: number[] | undefined;
  if (plan.salesAbsorptionJson) {
    try {
      const absorption = JSON.parse(plan.salesAbsorptionJson);
      if (absorption.marketingDistribution) {
        const minimumMarketingStart = getProjectMarketingTiming(project).marketingStartMonth;
        const savedStart = Number(absorption.marketingActualStart || minimumMarketingStart);
        const actualStart = Math.max(savedStart, minimumMarketingStart);
        const distribution = clampMarketingDistributionToStart(
          absorption.marketingDistribution,
          savedStart,
          minimumMarketingStart,
        );
        marketingMonthlyWeights = buildMarketingMonthlyWeights(distribution, actualStart);
      }
    } catch {
      // A missing or malformed legacy marketing payload falls back to engine defaults.
    }
  }

  let ppDownPct: number | undefined;
  let paymentPlan: SalesResult["paymentPlan"];
  let buildForSaleMonthlyUnits: number[] | undefined;
  if (plan.paymentPlanJson) {
    try {
      paymentPlan = normalizeFlexiblePaymentPlan(JSON.parse(plan.paymentPlanJson));
      ppDownPct = paymentPlan.stages.find((stage) => stage.trigger === "sale")?.percentage;
    } catch {
      // Preserve the engine's defaults for malformed legacy plans.
    }
  }
  if (plan.salesAbsorptionJson) {
    try {
      const absorption = JSON.parse(plan.salesAbsorptionJson);
      ppDownPct = ppDownPct ?? absorption.ppDownPct;
      paymentPlan = paymentPlan ?? normalizeFlexiblePaymentPlan({
        downPct: Number(absorption.ppDownPct ?? 10),
        secondPct: Number(absorption.ppSecondPct ?? 0),
        secondAfterMonths: Number(absorption.ppSecondAfterMonths ?? 0),
        duringTotalPct: 100 - Number(absorption.ppDownPct ?? 10) - Number(absorption.ppSecondPct ?? 0) - Number(absorption.ppHandoverPct ?? 0),
        installmentEveryMonths: Number(absorption.ppInstallmentEvery ?? 1),
        handoverPct: Number(absorption.ppHandoverPct ?? 0),
      });
      if (Array.isArray(absorption.buildForSaleMonthlyUnits)) {
        buildForSaleMonthlyUnits = absorption.buildForSaleMonthlyUnits.map((value: unknown) => Math.max(0, Number(value) || 0));
      }
    } catch {
      // Preserve the engine's defaults for malformed legacy plans.
    }
  }

  let directSalesStartMonth = 4;
  let directSalesInstallmentCount = 6;
  try {
    const schedule = JSON.parse(project?.constructionScheduleJson || "{}");
    const directSalesSettings = schedule?.settings?.directPostCompletionSales;
    directSalesStartMonth = Number(directSalesSettings?.startMonth ?? directSalesStartMonth);
    directSalesInstallmentCount = Number(directSalesSettings?.installmentCount ?? directSalesInstallmentCount);
  } catch {
    // Keep the approved direct-sale defaults when no project setting exists.
  }

  if (plan.resultsJson) {
    try {
      const parsed = JSON.parse(plan.resultsJson);
      const parsedBuildForSaleUnits = Array.isArray(parsed.buildForSaleMonthlyUnits)
        ? parsed.buildForSaleMonthlyUnits.map((value: unknown) => Math.max(0, Number(value) || 0))
        : undefined;
      const resolvedBuildForSaleUnits = parsedBuildForSaleUnits
        || buildForSaleMonthlyUnits
        || (scenario === "build_for_sale" && Array.isArray(parsed.salesDistribution)
          ? parsed.salesDistribution.map((value: unknown) => Math.max(0, Number(value) || 0))
          : undefined);
      const hasSavedSalesResult = scenario === "build_for_sale"
        ? Array.isArray(parsed.actualCashInflow) || Array.isArray(parsed.salesDistribution) || Array.isArray(parsedBuildForSaleUnits)
        : Array.isArray(parsed.escrowData) && Array.isArray(parsed.salesDistribution);
      if (hasSavedSalesResult) {
        const storedCashInflow = parsed.actualCashInflow || [];
        const normalizedCashInflow = parsed.actualCashInflowVersion === 2
          ? storedCashInflow
          : (storedCashInflow.length > 0 && storedCashInflow[0] === 0 ? storedCashInflow.slice(1) : storedCashInflow);
        let actualCashInflow = normalizedCashInflow;

        // Build-for-Sale receipt arrays are persisted against absolute project
        // months. If Settings later changes the design or construction duration,
        // keep the saved receipt weights but move their post-completion window
        // to the current project end instead of leaving it at the retired end.
        if (scenario === "build_for_sale" && normalizedCashInflow.length > 0) {
          const currentDesignMonths = getProjectMarketingTiming(project).designMonths;
          const currentConstructionMonths = Math.max(1, Number(project?.constructionMonths ?? plan.constructionMonths ?? 0));
          const savedDesignMonths = Math.max(0, Number(plan.designMonths ?? currentDesignMonths));
          const savedConstructionMonths = Math.max(1, Number(plan.constructionMonths ?? currentConstructionMonths));
          const savedProjectEnd = savedDesignMonths + savedConstructionMonths;
          const currentProjectEnd = currentDesignMonths + currentConstructionMonths;

          if (savedProjectEnd !== currentProjectEnd) {
            const savedPostCompletionReceipts: number[] = normalizedCashInflow
              .slice(savedProjectEnd)
              .map((amount: unknown) => Math.max(0, Number(amount) || 0));
            if (savedPostCompletionReceipts.some((amount) => amount > 0)) {
              actualCashInflow = new Array(currentProjectEnd + savedPostCompletionReceipts.length).fill(0);
              savedPostCompletionReceipts.forEach((amount: number, index: number) => {
                actualCashInflow[currentProjectEnd + index] = amount;
              });
            }
          }
        }
        return {
          escrowData: Array.isArray(parsed.escrowData) ? parsed.escrowData : [],
          salesDistribution: Array.isArray(parsed.salesDistribution) ? parsed.salesDistribution : [],
          marketingMonthlyWeights,
          ppDownPct,
          paymentPlan,
          actualCashInflow,
          actualEscrowCashInflow: Array.isArray(parsed.actualEscrowCashInflow) ? parsed.actualEscrowCashInflow : undefined,
          actualInvestorCashInflow: Array.isArray(parsed.actualInvestorCashInflow) ? parsed.actualInvestorCashInflow : undefined,
          offplanPct: Number(plan.offplanPct ?? 80),
          directSalesStartMonth,
          directSalesInstallmentCount,
          buildForSaleMonthlyUnits: resolvedBuildForSaleUnits,
        };
      }
    } catch {
      // Continue with saved marketing-only information, if available.
    }
  }

  if (marketingMonthlyWeights && marketingMonthlyWeights.length > 0) {
    return { escrowData: [], salesDistribution: [], marketingMonthlyWeights, ppDownPct, buildForSaleMonthlyUnits };
  }

  return undefined;
}
