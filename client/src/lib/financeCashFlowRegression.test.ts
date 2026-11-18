import { describe, expect, it } from "vitest";
import {
  calculateCalendarFundingPeak, calculateInvestorCapitalSummary,
  calculateInvestorMonthlyFundingRequirements, computeInvestorCashFlow,
} from "./investorCashFlowEngine";
import { alignPortfolioMonthlyNetFlows, groupCalendarAlignedPortfolio } from "./portfolioAggregation";

const project = {
  name: "isolated fixture", startDate: "2020-01", landPrice: "1000",
  manualBuaSqft: "1000", estimatedConstructionPricePerSqft: "100",
  gfaResidentialSqft: "1000", gfaRetailSqft: "0", gfaOfficesSqft: "0",
  preConMonths: 3, constructionMonths: 4, handoverMonths: 1,
};

describe("shared finance engine regression — estimates are not disbursements", () => {
  it.each(["2020-01", "2040-01"])("does not infer land payment from category or elapsed start date %s", startDate => {
    const result = computeInvestorCashFlow({ ...project, startDate }, "build_for_rent");
    const land = result.rows.filter(row => row.section === "الأرض");
    expect(land).toHaveLength(3);
    for (const row of land) {
      expect(row.paid).toBe(0);
      expect(row.unpaid).toBe(row.totalCost);
      expect(row.designMonths[0]).toBe(row.totalCost);
      expect(row.designMonths.reduce((sum, amount) => sum + amount, 0)).toBe(row.totalCost);
    }
    expect(result.grandPaid).toBe(0);
    expect(calculateInvestorCapitalSummary(result).paidCapital).toBe(0);
    expect(calculateInvestorMonthlyFundingRequirements(result)[0]).toBeGreaterThanOrEqual(land.reduce((sum, row) => sum + row.totalCost, 0));
  });
  it("retains the existing explicit row-level actual source in summary without date inference", () => {
    const result = computeInvestorCashFlow(project, "build_for_rent");
    const land = result.rows.find(row => row.label === "سعر الأرض")!;
    land.paid = land.totalCost;
    land.unpaid = 0;
    land.designMonths.fill(0);
    expect(calculateInvestorCapitalSummary(result).paidCapital).toBe(1000);
    expect(calculateInvestorCapitalSummary(result).totalProjectSpend).toBeCloseTo(result.grandTotalCost, 6);
  });
  it("keeps transfer funding out of project gross cost but in funding requirements", () => {
    const result = computeInvestorCashFlow(project, "offplan_escrow");
    const summary = calculateInvestorCapitalSummary(result);
    const transfers = result.rows.filter(row => row.isTransfer && row.funder === "investor" && !row.isRevenue);
    expect(transfers.length).toBeGreaterThan(0);
    const investorSpend = result.rows.filter(row => !row.isRevenue && !row.isProfitAllocation && row.funder === "investor" && !row.isTransfer).reduce((sum, row) => sum + row.totalCost, 0);
    const grossFunding = calculateInvestorMonthlyFundingRequirements(result).reduce((sum, value) => sum + value, 0);
    expect(summary.investorProjectSpend).toBeCloseTo(investorSpend, 6);
    const scheduled = (rows: typeof result.rows) => rows.reduce((sum, row) => sum + [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths].reduce((total, value) => total + value, 0), 0);
    const debitRows = result.rows.filter(row => !row.isRevenue && !row.isProfitAllocation && row.funder === "investor");
    expect(grossFunding).toBeCloseTo(scheduled(debitRows), 5);
    expect(grossFunding - scheduled(debitRows.filter(row => !row.isTransfer))).toBeCloseTo(scheduled(transfers), 5);
  });
  it("calculates portfolio peak after calendar alignment, not from independent peaks", () => {
    const projects = [
      { projectId: 1, name: "A", financingScenario: "build_for_sale", startDate: "2028-01", monthDates: ["2028-01", "2028-02"], monthlyNet: [-100, 100] },
      { projectId: 2, name: "B", financingScenario: "build_for_sale", startDate: "2028-02", monthDates: ["2028-02", "2028-03"], monthlyNet: [-100, 100] },
    ];
    const calendar = alignPortfolioMonthlyNetFlows(projects);
    expect(calendar.monthDates).toEqual(["2028-01", "2028-02", "2028-03"]);
    expect(calendar.totals).toEqual([-100, 0, 100]);
    expect(calculateCalendarFundingPeak(calendar.totals).requiredCapital).toBe(100);
    expect(projects.reduce((sum, item) => sum + calculateCalendarFundingPeak(item.monthlyNet).requiredCapital, 0)).toBe(200);
    // Display grouping must not replace the monthly peak source.
    expect(groupCalendarAlignedPortfolio(calendar, 3).totals).toEqual([0]);
    expect(calculateCalendarFundingPeak(calendar.totals, 10)).toMatchObject({ requiredCapital: 110, remainingCapital: 100, peakMonthIndex: 0 });
  });
  it("handles empty, positive, intentional-zero and repeated troughs deterministically", () => {
    expect(calculateCalendarFundingPeak([])).toMatchObject({ requiredCapital: 0, peakMonthIndex: null });
    expect(calculateCalendarFundingPeak([0, 20, -10])).toMatchObject({ requiredCapital: 0, peakMonthIndex: null });
    expect(calculateCalendarFundingPeak([-5, 5, -5])).toMatchObject({ requiredCapital: 5, peakMonthIndex: 0 });
  });
  it.each([NaN, Infinity, -Infinity])("rejects a missing/invalid month rather than a blanket zero %j", value => {
    expect(() => calculateCalendarFundingPeak([value])).toThrow(RangeError);
  });
});
