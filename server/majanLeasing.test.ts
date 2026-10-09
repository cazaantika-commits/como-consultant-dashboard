import { describe, expect, it } from "vitest";
import { calculateMajanLeasing } from "../shared/majanLeasing";
import type {
  MajanInputs,
  LeasingRow,
  OpexRow,
  Provenance,
} from "../shared/majanFinanceTypes";

const source: Provenance = {
  source: "Test Draft Assumption",
  asOf: "2026-10-09",
  status: "assumption",
  rationale: "Deterministic engine test only",
};

function leasingRow(overrides: Partial<LeasingRow> = {}): LeasingRow {
  return {
    id: "retail-g",
    floor: "G",
    nameEn: "Test retail",
    nameAr: "تجزئة اختبارية",
    areaSqft: 100,
    treatment: "leased",
    annualRentPsf: 120,
    rentRule: "base",
    annualSalesPsf: null,
    turnoverPct: null,
    openingMonth: "2029-12",
    initialOccupancyPct: 100,
    stabilisedOccupancyPct: 100,
    rampMonths: 0,
    rentFreeMonths: 0,
    escalationPct: 0,
    collectionPct: 100,
    collectionLagMonths: 0,
    source,
    ...overrides,
  };
}

function opexRow(overrides: Partial<OpexRow> = {}): OpexRow {
  return {
    id: "utilities",
    nameEn: "Utilities",
    nameAr: "مرافق",
    mode: "annual_amount",
    value: 1_200,
    escalationPct: 0,
    recoverablePct: 0,
    recoveryCollectionPct: 100,
    source,
    ...overrides,
  };
}

function inputs(overrides: Partial<MajanInputs> = {}): MajanInputs {
  return {
    schemaVersion: 1,
    projectId: 1,
    plot: "6457956",
    caseName: "Deterministic test case",
    asOf: "2026-10-09",
    horizonMonth: "2030-12",
    development: {
      buaSqft: 1,
      constructionRate: 1,
      designFee: {
        mode: "none",
        amount: null,
        percentage: null,
        minimum: null,
      },
      supervisionFee: {
        mode: "none",
        amount: null,
        percentage: null,
        minimum: null,
      },
      source,
    },
    leasing: [leasingRow()],
    opex: [opexRow()],
    operations: {
      openingMonth: "2029-12",
      maintenanceCapexAnnual: 0,
      capexEscalationPct: 0,
      reserveAnnual: 0,
      reserveReleaseAnnual: 0,
      cashTaxAnnual: 0,
      taxRationale: "Not yet estimated; pre-tax indicative test",
      otherIncomeAnnual: 0,
      vatMode: "excluded_net_model",
      source,
    },
    finance: {
      enabled: false,
      status: "terms_pending",
      structure: "istisna_forward_ijara",
      lender: "",
      commitment: null,
      financeSharePct: null,
      profitRatePct: null,
      drawStartMonth: "2027-04",
      drawEndMonth: "2029-09",
      repaymentStartMonth: "2029-12",
      repaymentMonths: null,
      repaymentMode: "level_payment",
      constructionProfit: "capitalise",
      arrangementFeePct: 0,
      dsraMonths: 0,
      targetDscr: null,
      balloonPct: 0,
      eligibleCategories: [],
      source,
    },
    notes: "Test only",
    ...overrides,
  };
}

function run(input: MajanInputs, periods = ["2029-11", "2029-12", "2030-01"]) {
  return calculateMajanLeasing(input, periods);
}

describe("calculateMajanLeasing", () => {
  it("calculates stable monthly rent, operating cash NOI and cash-route CFADS without an AR adjustment twice", () => {
    const result = run(inputs());

    expect(result.totalGla).toBe(100);
    expect(result.floorGla).toMatchObject({
      G: 100,
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    });
    expect(result.blendedRentPsf).toBe(120);
    expect(result.months[0]).toMatchObject({
      billedRent: 0,
      collectedRent: 0,
      cashNoi: 0,
      cfads: 0,
    });
    expect(result.months[1]).toMatchObject({
      potentialRent: 1_000,
      billedRent: 1_000,
      collectedRent: 1_000,
      openingAr: 0,
      closingAr: 0,
      badDebt: 0,
      opex: 100,
      cashNoi: 900,
      cfads: 900,
    });
    expect(
      result.issues.some(entry => entry.code === "CASH_TAX_NOT_YET_ESTIMATED")
    ).toBe(true);
    expect(
      result.issues.some(
        entry => entry.code === "VAT_EXCLUDED_NO_LIQUIDITY_FORECAST"
      )
    ).toBe(true);
  });

  it("keeps physical occupancy and recoveries during rent-free months without billing rent", () => {
    const result = run(
      inputs({
        leasing: [leasingRow({ rentFreeMonths: 1 })],
        opex: [opexRow({ recoverablePct: 100, recoveryCollectionPct: 100 })],
      })
    );
    const firstOperatingMonth = result.months[1];

    expect(firstOperatingMonth).toMatchObject({
      potentialRent: 1_000,
      billedRent: 0,
      collectedRent: 0,
      serviceChargeBilled: 100,
      serviceChargeCollected: 100,
      opex: 100,
      cashNoi: 0,
      cfads: 0,
    });
  });

  it("preserves explicit zero rents and costs as calculated zero rather than missing", () => {
    const result = run(
      inputs({
        leasing: [leasingRow({ annualRentPsf: 0 })],
        opex: [opexRow({ value: 0 })],
      })
    );

    expect(result.months[1]).toMatchObject({
      potentialRent: 0,
      billedRent: 0,
      collectedRent: 0,
      opex: 0,
      cashNoi: 0,
      cfads: 0,
    });
    expect(
      result.issues.some(entry => entry.code === "RENT_INPUT_MISSING")
    ).toBe(false);
    expect(
      result.issues.some(entry => entry.code === "OPEX_INPUT_MISSING")
    ).toBe(false);
  });

  it("blocks only rent-dependent outputs when required turnover inputs are missing while preserving GLA", () => {
    const result = run(
      inputs({
        leasing: [
          leasingRow({
            rentRule: "max_base_turnover",
            annualSalesPsf: null,
            turnoverPct: 8,
          }),
        ],
      })
    );

    expect(result.totalGla).toBe(100);
    expect(result.floorGla.G).toBe(100);
    expect(result.months[1]).toMatchObject({
      potentialRent: null,
      billedRent: null,
      collectedRent: null,
      openingAr: null,
      closingAr: null,
      cashNoi: null,
      cfads: null,
    });
    expect(
      result.issues.some(entry => entry.code === "TURNOVER_SALES_INPUT_MISSING")
    ).toBe(true);
  });

  it("applies explicit maximum and additive turnover-rent rules without inventing a rent rule", () => {
    const maximum = run(
      inputs({
        leasing: [
          leasingRow({
            rentRule: "max_base_turnover",
            annualSalesPsf: 2_000,
            turnoverPct: 10,
          }),
        ],
      })
    );
    const additive = run(
      inputs({
        leasing: [
          leasingRow({
            rentRule: "base_plus_turnover",
            annualSalesPsf: 2_000,
            turnoverPct: 10,
          }),
        ],
      })
    );

    // Base is AED 1,000/month; turnover is AED 1,666.67/month.
    expect(maximum.months[1]?.potentialRent).toBeCloseTo(1_666.66666667, 8);
    expect(additive.months[1]?.potentialRent).toBeCloseTo(2_666.66666667, 8);
  });

  it("rolls AR once from billing to lagged collections and recognises collection loss on billing", () => {
    const result = run(
      inputs({
        leasing: [leasingRow({ collectionPct: 80, collectionLagMonths: 1 })],
      })
    );

    expect(result.months[1]).toMatchObject({
      billedRent: 1_000,
      collectedRent: 0,
      openingAr: 0,
      closingAr: 800,
    });
    expect(result.months[1]?.badDebt).toBeCloseTo(200, 8);
    expect(result.months[2]).toMatchObject({
      billedRent: 1_000,
      collectedRent: 800,
      openingAr: 800,
      closingAr: 800,
    });
    expect(result.months[2]?.badDebt).toBeCloseTo(200, 8);
  });

  it("limits reserve release to actual capex and available restricted cash, leaving it separate from OPEX", () => {
    const result = run(
      inputs({
        operations: {
          ...inputs().operations,
          maintenanceCapexAnnual: 1_200,
          reserveAnnual: 120,
          reserveReleaseAnnual: 1_200,
        },
      })
    );
    const firstOperatingMonth = result.months[1];

    expect(firstOperatingMonth).toMatchObject({
      opex: 100,
      capex: 100,
      reserveDeposit: 10,
      reserveRelease: 10,
      restrictedCash: 0,
      cashNoi: 900,
      cfads: 800,
    });
  });

  it("does not let an owner-operated row become automatic revenue or recovery occupancy", () => {
    const result = run(
      inputs({
        leasing: [
          leasingRow({ treatment: "owner_operated", annualRentPsf: null }),
        ],
        opex: [opexRow({ recoverablePct: 100 })],
      })
    );

    expect(result.totalGla).toBe(100);
    expect(result.months[1]).toMatchObject({
      billedRent: 0,
      collectedRent: 0,
      serviceChargeBilled: 0,
      serviceChargeCollected: 0,
      opex: 100,
      cashNoi: -100,
    });
  });

  it("flags invalid numeric inputs rather than emitting negative or non-finite forecast output", () => {
    const result = run(
      inputs({
        leasing: [leasingRow({ areaSqft: -1, initialOccupancyPct: 110 })],
      })
    );

    expect(
      result.issues.some(entry => entry.code === "INVALID_LEASING_AREA")
    ).toBe(true);
    expect(
      result.issues.some(entry => entry.code === "OCCUPANCY_OUT_OF_RANGE")
    ).toBe(true);
    for (const month of result.months) {
      for (const value of Object.values(month)) {
        expect(typeof value === "number" ? Number.isFinite(value) : true).toBe(
          true
        );
      }
    }
  });
});
