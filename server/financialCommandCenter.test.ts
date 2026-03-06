/**
 * Tests for Financial Command Center paid/remaining/next3months calculation logic.
 * 
 * These tests verify the client-side cashFlowEngine functions that power
 * the Financial Command Center's paid vs remaining breakdown.
 */
import { describe, expect, it } from "vitest";

// We import the shared engine functions used by FinancialCommandCenter.tsx
import {
  calculatePhases,
  getTotalMonths,
  getInvestorExpenses,
  getEscrowExpenses,
  getDefaultRevenue,
  getDefaultCustomDistribution,
  distributeExpense,
  isMonthPaid,
  getMonthDate,
  fmt,
  DEFAULT_DURATIONS,
  CONSTRUCTION_COST,
  type PhaseDurations,
  type ProjectCosts,
} from "../client/src/lib/cashFlowEngine";

// ─── Helper: replicate the paid/remaining logic from FinancialCommandCenter ───

function calculateInvestorBreakdown(
  durations: PhaseDurations,
  startOffsetMonths: number,
  costs?: ProjectCosts
) {
  const phases = calculatePhases(durations);
  const totalMonths = getTotalMonths(durations);

  // Project start date (same as FinancialCommandCenter)
  const BASE_START = new Date(2026, 3, 1); // April 2026
  const projectStart = new Date(BASE_START);
  projectStart.setMonth(projectStart.getMonth() + startOffsetMonths);

  const investorExpenses = getInvestorExpenses(costs);
  const defaultRevenue = getDefaultRevenue(phases, durations, costs?.totalRevenue);

  const investorMonthlyLocal: { [month: number]: number } = {};
  let investorTotal = 0;
  let landTotal = 0;

  for (const item of investorExpenses) {
    let monthlyData: { [month: number]: number };
    if (item.behavior === "CUSTOM") {
      monthlyData = getDefaultCustomDistribution(item.id, phases, durations, costs);
    } else {
      monthlyData = distributeExpense(item, phases, durations, defaultRevenue);
    }
    if (item.phase === "land" && item.behavior === "FIXED_ABSOLUTE") {
      investorTotal += item.total;
      landTotal += item.total;
    }
    for (const [mStr, val] of Object.entries(monthlyData)) {
      const localMonth = parseInt(mStr);
      investorMonthlyLocal[localMonth] = (investorMonthlyLocal[localMonth] || 0) + val;
      investorTotal += val;
    }
  }

  // Calculate paid vs remaining
  let investorPaid = landTotal;
  const now = new Date();
  let investorNext3Months = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const monthVal = investorMonthlyLocal[m] || 0;
    if (monthVal <= 0) continue;
    if (isMonthPaid(m, projectStart)) {
      investorPaid += monthVal;
    }
    const d = getMonthDate(m, projectStart);
    if (d >= now) {
      const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
      if (diffMonths >= 0 && diffMonths < 3) {
        investorNext3Months += monthVal;
      }
    }
  }
  const investorRemaining = investorTotal - investorPaid;

  return {
    investorTotal,
    investorPaid,
    investorRemaining,
    investorNext3Months,
    landTotal,
    totalMonths,
  };
}

// ─── Tests ───

describe("Financial Command Center — paid/remaining calculation", () => {
  it("should calculate investorTotal > 0 with default durations", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    expect(result.investorTotal).toBeGreaterThan(0);
  });

  it("should have paid + remaining = total", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    expect(Math.round(result.investorPaid + result.investorRemaining)).toBe(
      Math.round(result.investorTotal)
    );
  });

  it("should include land costs in total", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    // Default land costs: 18M + 180K + 720K = 18,900,000
    expect(result.landTotal).toBeGreaterThan(0);
    expect(result.investorTotal).toBeGreaterThan(result.landTotal);
  });

  it("should count land as paid (historical)", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    // Land is always counted as paid
    expect(result.investorPaid).toBeGreaterThanOrEqual(result.landTotal);
  });

  it("should have next3Months <= remaining", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    expect(result.investorNext3Months).toBeLessThanOrEqual(result.investorRemaining + 1); // +1 for rounding
  });

  it("should have correct total months for default durations", () => {
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0);
    expect(result.totalMonths).toBe(24); // 6 + 16 + 2
  });

  it("should handle shifted project start (future project)", () => {
    // Project starting 24 months from now — mostly unpaid
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 24);
    // Land is always paid, but monthly expenses are in the future
    expect(result.investorPaid).toBe(result.landTotal);
    expect(result.investorRemaining).toBe(result.investorTotal - result.landTotal);
  });

  it("should handle shifted project start (past project)", () => {
    // Project starting 48 months ago — mostly paid
    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, -48);
    // All months should be in the past
    expect(result.investorPaid).toBeCloseTo(result.investorTotal, -2);
    expect(result.investorRemaining).toBeLessThan(1);
  });

  it("should handle custom durations", () => {
    const customDurations: PhaseDurations = { preCon: 8, construction: 20, handover: 4 };
    const result = calculateInvestorBreakdown(customDurations, 0);
    expect(result.totalMonths).toBe(32);
    expect(result.investorTotal).toBeGreaterThan(0);
    expect(Math.round(result.investorPaid + result.investorRemaining)).toBe(
      Math.round(result.investorTotal)
    );
  });

  it("should handle dynamic project costs", () => {
    const costs: ProjectCosts = {
      landPrice: 10000000,
      agentCommissionLand: 100000,
      landRegistration: 400000,
      soilTestFee: 20000,
      topographicSurveyFee: 5000,
      officialBodiesFees: 500000,
      designFee: 300000,
      supervisionFee: 300000,
      separationFee: 1000000,
      constructionCost: 20000000,
      communityFees: 10000,
      contingencies: 400000,
      developerFee: 2500000,
      salesCommission: 2500000,
      marketingCost: 1000000,
      reraUnitRegFee: 30000,
      reraProjectRegFee: 100000,
      developerNocFee: 15000,
      escrowAccountFee: 80000,
      bankFees: 15000,
      surveyorFees: 20000,
      reraAuditReportFee: 15000,
      reraInspectionReportFee: 80000,
      totalRevenue: 50000000,
    };

    const result = calculateInvestorBreakdown(DEFAULT_DURATIONS, 0, costs);
    expect(result.investorTotal).toBeGreaterThan(0);
    expect(result.landTotal).toBe(10000000 + 100000 + 400000); // land + broker + registration
    expect(Math.round(result.investorPaid + result.investorRemaining)).toBe(
      Math.round(result.investorTotal)
    );
  });
});

describe("Financial Command Center — fmt helper", () => {
  it("should format large numbers with commas", () => {
    expect(fmt(1234567)).toBe("1,234,567");
  });

  it("should return dash for zero", () => {
    expect(fmt(0)).toBe("-");
  });

  it("should return dash for very small numbers", () => {
    expect(fmt(0.5)).toBe("-");
  });

  it("should round to nearest integer", () => {
    expect(fmt(1234.7)).toBe("1,235");
  });
});

describe("Financial Command Center — isMonthPaid", () => {
  it("should return true for months in the past", () => {
    const pastStart = new Date(2020, 0, 1);
    expect(isMonthPaid(1, pastStart)).toBe(true);
    expect(isMonthPaid(12, pastStart)).toBe(true);
  });

  it("should return false for months far in the future", () => {
    const futureStart = new Date(2030, 0, 1);
    expect(isMonthPaid(1, futureStart)).toBe(false);
  });
});
