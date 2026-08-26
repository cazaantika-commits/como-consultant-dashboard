import { describe, expect, it } from "vitest";
import { alignPortfolioMonthlyNetFlows, groupCalendarAlignedPortfolio } from "./portfolioAggregation";

describe("portfolio investor cash-flow aggregation", () => {
  const projects = [
    {
      projectId: 1,
      name: "مشروع أ",
      financingScenario: "offplan_escrow",
      startDate: "2027-01",
      monthDates: ["2027-01", "2027-02", "2027-03"],
      monthlyDebit: [100, 20, 0],
      monthlyCredit: [0, 50, 200],
      monthlyNet: [-100, 30, 200],
    },
    {
      projectId: 2,
      name: "مشروع ب",
      financingScenario: "build_for_sale",
      startDate: "2027-02",
      monthDates: ["2027-02", "2027-03"],
      monthlyDebit: [40, 0],
      monthlyCredit: [0, 80],
      monthlyNet: [-40, 80],
    },
  ];

  it("keeps debit, credit, net, and cumulative totals on the same real calendar", () => {
    const portfolio = alignPortfolioMonthlyNetFlows(projects);

    expect(portfolio.monthDates).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(portfolio.debitTotals).toEqual([100, 60, 0]);
    expect(portfolio.creditTotals).toEqual([0, 50, 280]);
    expect(portfolio.totals).toEqual([-100, -10, 280]);
    expect(portfolio.cumulativeTotals).toEqual([-100, -110, 170]);
  });

  it("groups debit and credit without losing the period-end cumulative balance", () => {
    const grouped = groupCalendarAlignedPortfolio(alignPortfolioMonthlyNetFlows(projects), 3);

    expect(grouped.debitTotals).toEqual([160]);
    expect(grouped.creditTotals).toEqual([330]);
    expect(grouped.totals).toEqual([170]);
    expect(grouped.cumulativeTotals).toEqual([170]);
  });
});
