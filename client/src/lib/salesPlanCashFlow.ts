import type { SalesResult, Scenario } from "@/lib/investorCashFlowEngine";
import { clampMarketingDistributionToStart, getProjectMarketingTiming } from "@/lib/projectTiming";
import {
  buildPaymentReceiptEvents,
  cloneFlexiblePaymentPlan,
  getPaymentPlanPostHandoverMonths,
  normalizeFlexiblePaymentPlan,
} from "@/lib/flexiblePaymentPlan";

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
            const savedPostCompletionReceipts = normalizedCashInflow
              .slice(savedProjectEnd)
              .map((amount: unknown) => Math.max(0, Number(amount) || 0));
            if (savedPostCompletionReceipts.some((amount) => amount > 0)) {
              actualCashInflow = new Array(currentProjectEnd + savedPostCompletionReceipts.length).fill(0);
              savedPostCompletionReceipts.forEach((amount, index) => {
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
