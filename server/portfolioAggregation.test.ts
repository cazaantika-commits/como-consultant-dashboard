import { describe, expect, it } from "vitest";
import {
  alignPortfolioMonthlyNetFlows,
  groupCalendarAlignedPortfolio,
} from "../client/src/lib/portfolioAggregation";
import fs from "node:fs";
import path from "node:path";

describe("Project Aggregation calendar-aligned net investor flows", () => {
  it("uses the real earliest and latest active months while preserving a zero month between them", () => {
    const portfolio = alignPortfolioMonthlyNetFlows([
      {
        projectId: 1,
        name: "مشروع أوف بلان",
        financingScenario: "offplan_escrow",
        startDate: "2026-08",
        monthDates: ["2026-08", "2026-09", "2026-10"],
        monthlyNet: [10_000, 0, 20_000],
      },
      {
        projectId: 2,
        name: "مشروع بناء للبيع",
        financingScenario: "build_for_sale",
        startDate: "2026-09",
        monthDates: ["2026-09", "2026-10"],
        monthlyNet: [-5_000, 7_000],
      },
    ]);

    expect(portfolio.monthDates).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(portfolio.rows[0].values).toEqual([10_000, 0, 20_000]);
    expect(portfolio.rows[1].values).toEqual([0, -5_000, 7_000]);
    expect(portfolio.totals).toEqual([10_000, -5_000, 27_000]);
  });

  it("sums only adjacent named calendar months for each grouping option without changing source values", () => {
    const portfolio = alignPortfolioMonthlyNetFlows([
      {
        projectId: 1,
        name: "مشروع أول",
        financingScenario: "offplan_escrow",
        startDate: "2026-08",
        monthDates: ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"],
        monthlyNet: [10, 0, 20, 0, 0, 0, 30],
      },
      {
        projectId: 2,
        name: "مشروع ثان",
        financingScenario: "build_for_rent",
        startDate: "2026-09",
        monthDates: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"],
        monthlyNet: [5, 5, 5, 5, 5, 5],
      },
    ]);

    const quarterly = groupCalendarAlignedPortfolio(portfolio, 3);
    expect(quarterly.periods.map((period) => [period.startDate, period.endDate])).toEqual([
      ["2026-08", "2026-10"],
      ["2026-11", "2027-01"],
      ["2027-02", "2027-02"],
    ]);
    expect(quarterly.rows[0].values).toEqual([30, 0, 30]);
    expect(quarterly.rows[1].values).toEqual([10, 15, 5]);
    expect(quarterly.totals).toEqual([40, 15, 35]);

    const semiAnnual = groupCalendarAlignedPortfolio(portfolio, 6);
    expect(semiAnnual.periods.map((period) => [period.startDate, period.endDate])).toEqual([
      ["2026-08", "2027-01"],
      ["2027-02", "2027-02"],
    ]);
    expect(semiAnnual.totals).toEqual([55, 35]);
  });
});

describe("Consolidated report source trace", () => {
  const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

  it("keeps every consolidated report connected to the shared clickable source-trace dialog", () => {
    const traceSource = readSource("client/src/components/FinancialSourceTrace.tsx");
    const aggregationSource = readSource("client/src/pages/V2Portfolio.tsx");
    const monthlySource = readSource("client/src/pages/V2PortfolioMonthly.tsx");
    const capitalSource = readSource("client/src/pages/V2CapitalPortfolio.tsx");

    expect(traceSource).toContain("مصدر الرقم");
    expect(traceSource).toContain("تفصيل التجميع");
    expect(aggregationSource).toContain("FinancialSourceValue");
    expect(aggregationSource).toContain("صافي الشهر من تدفقات المستثمر");
    expect(monthlySource).toContain("FinancialSourceValue");
    expect(monthlySource).toContain("صافي الشهر من تدفقات المستثمر");
    expect(capitalSource).toContain("FinancialSourceValue");
    expect(capitalSource).toContain("إجمالي الإيرادات");
    expect(capitalSource).toContain("التكلفة الكلية");
  });
});
