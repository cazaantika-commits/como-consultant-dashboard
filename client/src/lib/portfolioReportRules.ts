import type { Scenario } from "@/lib/investorCashFlowEngine";

/** The detailed investment Capital Portfolio intentionally excludes no-revenue build-for-rent projects. */
export function isCapitalPortfolioEligibleScenario(scenario: Scenario): boolean {
  return scenario !== "build_for_rent";
}
