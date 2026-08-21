import { describe, expect, it } from "vitest";
import {
  EXECUTIVE_PORTFOLIO_REPORTS,
  canOpenExecutivePortfolioReports,
} from "../client/src/lib/executivePortfolioReports";

describe("Executive portfolio report access", () => {
  it("reserves the Command Center executive portfolio section for Sheikh Issa", () => {
    expect(canOpenExecutivePortfolioReports("sheikh_issa")).toBe(true);
    expect(canOpenExecutivePortfolioReports("wael")).toBe(false);
    expect(canOpenExecutivePortfolioReports("abdulrahman")).toBe(false);
    expect(canOpenExecutivePortfolioReports(undefined)).toBe(false);
  });

  it("keeps exactly the four consolidated executive reports in the section", () => {
    expect(EXECUTIVE_PORTFOLIO_REPORTS.map((report) => report.id)).toEqual([
      "portfolio",
      "portfolio_monthly",
      "portfolio_escrow_liquidity",
      "capital_portfolio",
    ]);
  });
});
