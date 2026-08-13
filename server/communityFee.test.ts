import { describe, expect, it } from "vitest";
import {
  calculateCommunityFeeSchedule,
  getProjectCommunityFeeSettings,
} from "../client/src/lib/communityFee";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";

const project = {
  preConMonths: 4,
  constructionMonths: 6,
  manualBuaSqft: 1_000,
  estimatedConstructionPricePerSqft: 400,
  gfaResidentialSqft: 1_000,
  residential1brCount: 1,
  residential1brArea: 750,
  residential1brPrice: 1_550,
  constructionScheduleJson: JSON.stringify({
    settings: {
      configurableRates: {
        communityFeePerSqft: 0.5,
        communityFeeFrequency: 4,
      },
    },
  }),
};

describe("project community-fee settings", () => {
  it("distributes GFA × the saved rate every saved frequency month through completion", () => {
    const settings = getProjectCommunityFeeSettings(project);
    const schedule = calculateCommunityFeeSchedule(1_000, 10, settings);

    expect(schedule.perPayment).toBe(500);
    expect(schedule.monthlyAmounts).toEqual([500, 0, 0, 0, 500, 0, 0, 0, 500, 0]);
    expect(schedule.total).toBe(1_500);
  });

  it("uses the same distributed community-fee total in Investor Cash Flow and Feasibility costs", () => {
    const cashFlow = computeInvestorCashFlow(project, "offplan_escrow");
    const communityRow = cashFlow.rows.find((row) => row.label === "رسوم المجتمع");
    const rowTotal = [
      ...(communityRow?.designMonths || []),
      ...(communityRow?.constructionMonths || []),
    ].reduce((sum, amount) => sum + amount, 0);
    const feasibilityCosts = calculateProjectCosts(project);

    expect(rowTotal).toBe(1_500);
    expect(feasibilityCosts?.communityFees).toBe(rowTotal);
  });
});
