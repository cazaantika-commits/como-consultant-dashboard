import { describe, expect, it } from "vitest";
import { calculateMajanFinance } from "../shared/majanFinancing";
import type {
  DevelopmentResult,
  LeasingResult,
  MajanInputs,
  ModelIssue,
} from "../shared/majanFinanceTypes";

const provenance = {
  source: "Deterministic finance test assumption",
  asOf: "2026-10-09",
  status: "assumption" as const,
  rationale: "Test-only scenario; not facility terms.",
};

const periods = ["2027-04", "2027-05", "2027-06", "2027-07", "2027-08"];

function makeInputs(overrides: Partial<MajanInputs["finance"]> = {}): MajanInputs {
  return {
    schemaVersion: 1,
    projectId: 1,
    plot: "6457956",
    caseName: "Deterministic Finance Test",
    asOf: "2026-10-09",
    horizonMonth: "2027-08",
    development: {
      buaSqft: 900_000,
      constructionRate: 500,
      designFee: { mode: "none", amount: null, percentage: null, minimum: null },
      supervisionFee: { mode: "none", amount: null, percentage: null, minimum: null },
      source: provenance,
    },
    leasing: [],
    opex: [],
    operations: {
      openingMonth: "2027-04",
      maintenanceCapexAnnual: 0,
      capexEscalationPct: 0,
      reserveAnnual: 0,
      reserveReleaseAnnual: 0,
      cashTaxAnnual: 0,
      taxRationale: "Pre-tax deterministic test.",
      otherIncomeAnnual: 0,
      vatMode: "excluded_net_model",
      source: provenance,
    },
    finance: {
      enabled: true,
      status: "indicative",
      structure: "istisna_forward_ijara",
      lender: "",
      commitment: 150,
      financeSharePct: 100,
      profitRatePct: 12,
      drawStartMonth: "2027-04",
      drawEndMonth: "2027-05",
      repaymentStartMonth: "2027-06",
      repaymentMonths: 2,
      repaymentMode: "equal_principal",
      constructionProfit: "capitalise",
      arrangementFeePct: 1,
      dsraMonths: 0,
      targetDscr: 1.3,
      balloonPct: 0,
      eligibleCategories: ["construction"],
      source: provenance,
      ...overrides,
    },
    notes: "Test only.",
  };
}

function makeDevelopment(
  monthly = [100, 100, 0, 0, 0],
  taggedPaid = 65.1,
): DevelopmentResult {
  return {
    periods,
    uses: monthly,
    rows: [{
      id: "construction",
      category: "construction",
      nameAr: "إنشاء",
      nameEn: "Construction",
      total: monthly.reduce((total, value) => total + value, 0),
      taggedPaid,
      monthly,
    }],
    totalCost: monthly.reduce((total, value) => total + value, 0),
    taggedPaid,
    constructionCost: monthly.reduce((total, value) => total + value, 0),
    designFee: 0,
    supervisionFee: 0,
    issues: [],
    baselineDelta: 0,
  };
}

function makeLeasing(cfads: Array<number | null> = [0, 0, 200, 200, 200]): LeasingResult {
  return {
    months: periods.map((period, index) => ({
      period,
      potentialRent: 0,
      billedRent: 0,
      collectedRent: 0,
      openingAr: 0,
      closingAr: 0,
      badDebt: 0,
      opex: 0,
      serviceChargeBilled: 0,
      serviceChargeCollected: 0,
      cashNoi: cfads[index],
      capex: 0,
      reserveDeposit: 0,
      reserveRelease: 0,
      restrictedCash: 0,
      cashTax: 0,
      otherIncome: 0,
      cfads: cfads[index],
    })),
    issues: [],
    totalGla: 0,
    blendedRentPsf: null,
    floorGla: {},
  };
}

function hasIssue(issues: ModelIssue[], code: string): boolean {
  return issues.some(item => item.code === code);
}

describe("calculateMajanFinance", () => {
  it("keeps the no-finance / terms-pending overlay at zero without changing unlevered cash", () => {
    const inputs = makeInputs({ enabled: false, status: "terms_pending", commitment: null, financeSharePct: null, profitRatePct: null, repaymentMonths: null });
    const development = makeDevelopment();
    const leasing = makeLeasing([10, 20, 30, 40, 50]);

    const result = calculateMajanFinance(inputs, development, leasing);

    expect(result.totalDraw).toBe(0);
    expect(result.totalProfit).toBe(0);
    expect(result.totalFees).toBe(0);
    expect(result.closingBalance).toBe(0);
    expect(result.months.map(month => month.unleveredNet)).toEqual([-90, -80, 30, 40, 50]);
    expect(result.months.map(month => month.draw)).toEqual([0, 0, 0, 0, 0]);
    expect(hasIssue(result.issues, "FINANCE_TERMS_PENDING_NO_OVERLAY")).toBe(true);
  });

  it("caps funding principal while preserving an economic debt roll-forward", () => {
    const result = calculateMajanFinance(makeInputs(), makeDevelopment(), makeLeasing());

    expect(result.months.map(month => month.draw)).toEqual([100, 50, 0, 0, 0]);
    expect(result.totalDraw).toBe(150);
    result.months.forEach(month => {
      expect((month.openingBalance ?? 0) + (month.draw ?? 0) + (month.profitCapitalised ?? 0) - (month.capitalPaid ?? 0))
        .toBeCloseTo(month.closingBalance ?? 0, 9);
    });
  });

  it("includes the explicit final balloon in debt service and settles the economic balance", () => {
    const result = calculateMajanFinance(
      makeInputs({ repaymentMode: "bullet", balloonPct: 100, dsraMonths: 0 }),
      makeDevelopment([100, 0, 0, 0, 0], 0),
      makeLeasing(),
    );
    const maturity = result.months.find(month => month.period === "2027-07");

    expect(maturity?.capitalPaid).toBeGreaterThan(100);
    expect(maturity?.totalPayment).toBeCloseTo((maturity?.profitPaid ?? 0) + (maturity?.capitalPaid ?? 0), 9);
    expect(result.closingBalance).toBe(0);
    expect(result.financeComplete).toBe(true);
  });

  it("models DSRA as a cash transfer and releases it at maturity rather than as OPEX", () => {
    const result = calculateMajanFinance(
      makeInputs({ dsraMonths: 1, repaymentMode: "bullet", balloonPct: 100 }),
      makeDevelopment([100, 0, 0, 0, 0], 0),
      makeLeasing([0, 0, 0, 0, 0]),
    );
    const withoutDsra = calculateMajanFinance(
      makeInputs({ dsraMonths: 0, repaymentMode: "bullet", balloonPct: 100 }),
      makeDevelopment([100, 0, 0, 0, 0], 0),
      makeLeasing([0, 0, 0, 0, 0]),
    );
    const depositMonth = result.months.find(month => (month.dsraDeposit ?? 0) > 0);
    const sameMonthWithoutDsra = withoutDsra.months.find(month => month.period === depositMonth?.period);
    const maturity = result.months.find(month => month.period === "2027-07");

    expect(depositMonth?.dsraDeposit).toBeGreaterThan(0);
    expect(maturity?.dsraRelease).toBeCloseTo(depositMonth?.dsraDeposit ?? 0, 9);
    expect(maturity?.dsraBalance).toBe(0);
    expect(depositMonth?.fundedNet).toBeCloseTo(
      (sameMonthWithoutDsra?.fundedNet ?? 0) - (depositMonth?.dsraDeposit ?? 0),
      9,
    );
  });

  it("blocks only facility outputs when enabled finance terms are missing", () => {
    const result = calculateMajanFinance(
      makeInputs({ commitment: null, financeSharePct: null, repaymentMonths: null }),
      makeDevelopment(),
      makeLeasing([10, 20, 30, 40, 50]),
    );

    expect(result.totalDraw).toBeNull();
    expect(result.closingBalance).toBeNull();
    expect(result.months.map(month => month.unleveredNet)).toEqual([-90, -80, 30, 40, 50]);
    expect(hasIssue(result.issues, "FINANCE_TERM_MISSING")).toBe(true);
  });

  it("flags economic exposure above commitment when construction profit is capitalised", () => {
    const result = calculateMajanFinance(
      makeInputs({ commitment: 100, profitRatePct: 120, repaymentStartMonth: "2027-08", repaymentMonths: 1, drawEndMonth: "2027-05" }),
      makeDevelopment([100, 0, 0, 0, 0], 0),
      makeLeasing(),
    );

    expect(result.months[0]?.closingBalance).toBeGreaterThan(100);
    expect(hasIssue(result.issues, "FINANCE_CAPITALISED_EXPOSURE_ABOVE_COMMITMENT")).toBe(true);
  });

  it("keeps all repayment-mode / structure / profit / balloon combinations finite and reconciled", () => {
    const repaymentModes = ["equal_principal", "level_payment", "bullet"] as const;
    const structures = ["istisna_forward_ijara", "ijara", "diminishing_musharaka"] as const;
    const profitRates = [0, 12];
    const constructionProfitModes = ["capitalise", "pay"] as const;
    const balloons = [0, 30, 100];

    for (const repaymentMode of repaymentModes) {
      for (const structure of structures) {
        for (const profitRatePct of profitRates) {
          for (const constructionProfit of constructionProfitModes) {
            for (const balloonPct of balloons) {
              const result = calculateMajanFinance(
                makeInputs({ repaymentMode, structure, profitRatePct, constructionProfit, balloonPct, targetDscr: null }),
                makeDevelopment([100, 100, 0, 0, 0], 0),
                makeLeasing([0, 0, 200, 200, 200]),
              );
              const values = result.months.flatMap(month => Object.values(month).filter(value => typeof value === "number"));
              expect(values.every(Number.isFinite)).toBe(true);

              result.months.forEach(month => {
                expect((month.openingBalance ?? 0) + (month.draw ?? 0) + (month.profitCapitalised ?? 0) - (month.capitalPaid ?? 0))
                  .toBeCloseTo(month.closingBalance ?? 0, 8);
                expect((month.totalPayment ?? 0)).toBeCloseTo((month.profitPaid ?? 0) + (month.capitalPaid ?? 0), 8);
                if (month.fundedNet !== null) {
                  expect((month.ownerContribution ?? 0) - (month.ownerDistribution ?? 0))
                    .toBeCloseTo(-(month.fundedNet ?? 0), 8);
                }
              });

              const totalCapital = result.months.reduce((total, month) => total + (month.capitalPaid ?? 0), 0);
              const totalDrawAndCapitalisedProfit = result.months.reduce(
                (total, month) => total + (month.draw ?? 0) + (month.profitCapitalised ?? 0),
                0,
              );
              expect(totalCapital + (result.closingBalance ?? 0)).toBeCloseTo(totalDrawAndCapitalisedProfit, 8);
            }
          }
        }
      }
    }
  });
});
