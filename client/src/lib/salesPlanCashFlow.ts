import type { SalesResult, Scenario } from "@/lib/investorCashFlowEngine";
import { clampMarketingDistributionToStart, getProjectMarketingTiming } from "@/lib/projectTiming";

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

  let marketingMonthlyAmounts: number[] | undefined;
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
        const channels = Object.values(distribution) as number[][];
        if (channels.length > 0) {
          const maxLen = Math.max(...channels.map((channel) => channel.length));
          marketingMonthlyAmounts = new Array(actualStart - 1 + maxLen).fill(0);
          for (const channel of channels) {
            for (let month = 0; month < channel.length; month++) {
              marketingMonthlyAmounts[actualStart - 1 + month] += channel[month] || 0;
            }
          }
        }
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
      paymentPlan = JSON.parse(plan.paymentPlanJson);
      ppDownPct = paymentPlan?.downPct;
    } catch {
      // Preserve the engine's defaults for malformed legacy plans.
    }
  }
  if (plan.salesAbsorptionJson) {
    try {
      const absorption = JSON.parse(plan.salesAbsorptionJson);
      ppDownPct = ppDownPct ?? absorption.ppDownPct;
      paymentPlan = paymentPlan ?? {
        downPct: Number(absorption.ppDownPct ?? 10),
        secondPct: Number(absorption.ppSecondPct ?? 0),
        secondAfterMonths: Number(absorption.ppSecondAfterMonths ?? 0),
        duringTotalPct: 100 - Number(absorption.ppDownPct ?? 10) - Number(absorption.ppSecondPct ?? 0) - Number(absorption.ppHandoverPct ?? 0),
        installmentEveryMonths: Number(absorption.ppInstallmentEvery ?? 1),
        handoverPct: Number(absorption.ppHandoverPct ?? 0),
      };
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
        return {
          escrowData: Array.isArray(parsed.escrowData) ? parsed.escrowData : [],
          salesDistribution: Array.isArray(parsed.salesDistribution) ? parsed.salesDistribution : [],
          marketingMonthlyAmounts,
          ppDownPct,
          paymentPlan,
          actualCashInflow: parsed.actualCashInflowVersion === 2
            ? storedCashInflow
            : (storedCashInflow.length > 0 && storedCashInflow[0] === 0 ? storedCashInflow.slice(1) : storedCashInflow),
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

  if (marketingMonthlyAmounts && marketingMonthlyAmounts.length > 0) {
    return { escrowData: [], salesDistribution: [], marketingMonthlyAmounts, ppDownPct, buildForSaleMonthlyUnits };
  }

  return undefined;
}
