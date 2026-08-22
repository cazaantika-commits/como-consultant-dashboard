import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EXECUTIVE_PORTFOLIO_HORIZON_MONTHS,
  EXECUTIVE_PORTFOLIO_REPORTS,
  canOpenExecutivePortfolioReports,
} from "../client/src/lib/executivePortfolioReports";

const executiveReportsSource = readFileSync("client/src/components/ExecutivePortfolioReports.tsx", "utf8");

describe("Executive portfolio report access", () => {
  it("keeps the Command Center executive portfolio section available to every known member", () => {
    expect(canOpenExecutivePortfolioReports("sheikh_issa")).toBe(true);
    expect(canOpenExecutivePortfolioReports("wael")).toBe(true);
    expect(canOpenExecutivePortfolioReports("abdulrahman")).toBe(true);
    expect(canOpenExecutivePortfolioReports(undefined)).toBe(true);
  });

  it("keeps exactly the four consolidated executive reports in the section", () => {
    expect(EXECUTIVE_PORTFOLIO_REPORTS.map((report) => report.id)).toEqual([
      "portfolio",
      "portfolio_monthly",
      "portfolio_escrow_liquidity",
      "capital_portfolio",
    ]);
  });

  it("uses a fixed four-month executive horizon for the opening briefing and every report control", () => {
    expect(EXECUTIVE_PORTFOLIO_HORIZON_MONTHS).toBe(4);
    expect(executiveReportsSource).toContain('<ExecutiveFourMonthFocus variant="brief" />');
    expect(executiveReportsSource).toContain("الأشهر الأربعة القادمة");
    expect(executiveReportsSource).toContain('<ExecutiveFourMonthFocus variant="panel"');
  });
});
