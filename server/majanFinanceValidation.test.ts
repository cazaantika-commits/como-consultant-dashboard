import { describe, expect, it } from "vitest";
import { MAJAN_ORIGINAL_BASELINE } from "../shared/majanBaselineSnapshot";
import { majanInputsSchema, monthDistance } from "./routers/majanFinance";
import type { MajanInputs } from "../shared/majanFinanceTypes";

const source = { source: "Test planning assumption", asOf: "2026-10-09", status: "assumption" as const, rationale: "Deterministic validation test" };

function inputs(overrides: Partial<MajanInputs> = {}): MajanInputs {
  return {
    schemaVersion: 1,
    projectId: 1,
    plot: "6457956",
    caseName: "Validation draft",
    asOf: "2026-10-09",
    horizonMonth: "2042-12",
    development: {
      buaSqft: 1_000_000,
      constructionRate: 500,
      designFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      supervisionFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      source,
    },
    leasing: [{
      id: "g-retail",
      floor: "G",
      nameEn: "Retail", nameAr: "تجزئة", areaSqft: 86_111,
      treatment: "leased", annualRentPsf: 223, rentRule: "base", annualSalesPsf: null, turnoverPct: null,
      openingMonth: "2029-12", initialOccupancyPct: 40, stabilisedOccupancyPct: 90, rampMonths: 24,
      rentFreeMonths: 3, escalationPct: 2, collectionPct: 98, collectionLagMonths: 1, source,
    }],
    opex: [{
      id: "utilities", nameEn: "Utilities", nameAr: "مرافق", mode: "per_gla", value: 10,
      escalationPct: 0, recoverablePct: 80, recoveryCollectionPct: 95, source,
    }],
    operations: {
      openingMonth: "2029-12", maintenanceCapexAnnual: 1_500_000, capexEscalationPct: 0,
      reserveAnnual: 500_000, reserveReleaseAnnual: 0, cashTaxAnnual: 0,
      taxRationale: "Pre-tax planning scenario; entity tax not estimated.", otherIncomeAnnual: 0,
      vatMode: "excluded_net_model", source,
    },
    finance: {
      enabled: false, status: "terms_pending", structure: "istisna_forward_ijara", lender: "",
      commitment: null, financeSharePct: null, profitRatePct: null,
      drawStartMonth: "2027-04", drawEndMonth: "2029-09", repaymentStartMonth: "2029-12",
      repaymentMonths: null, repaymentMode: "level_payment", constructionProfit: "capitalise",
      arrangementFeePct: 0, dsraMonths: 0, targetDscr: null, balloonPct: 0,
      eligibleCategories: [], source,
    },
    notes: "Draft / indicative planning assumptions only; not bank approval or financing terms.",
    ...overrides,
  };
}

describe("Majan finance input validation", () => {
  it("accepts an explicit zero tax assumption without coercing null to zero", () => {
    const parsed = majanInputsSchema.parse(inputs());
    expect(parsed.operations.cashTaxAnnual).toBe(0);

    const draft = inputs();
    draft.operations.cashTaxAnnual = null;
    expect(majanInputsSchema.parse(draft).operations.cashTaxAnnual).toBeNull();
  });

  it("rejects wrong project/plot, non-finite numbers, and excess rows", () => {
    expect(() => majanInputsSchema.parse(inputs({ projectId: 2 as 1 }))).toThrow();
    expect(() => majanInputsSchema.parse(inputs({ plot: "other" as "6457956" }))).toThrow();

    const invalidNumber = inputs();
    invalidNumber.development.constructionRate = Number.NaN;
    expect(() => majanInputsSchema.parse(invalidNumber)).toThrow();

    const tooMany = inputs();
    tooMany.opex = Array.from({ length: 101 }, (_, index) => ({ ...tooMany.opex[0], id: `opex-${index}` }));
    expect(() => majanInputsSchema.parse(tooMany)).toThrow();
  });

  it("enforces the GFA allowance, 360-month horizon, and non-overlapping enabled finance dates", () => {
    const areaExceeded = inputs();
    areaExceeded.leasing = [
      { ...areaExceeded.leasing[0], id: "a", areaSqft: 300_000 },
      { ...areaExceeded.leasing[0], id: "b", areaSqft: 300_000 },
    ];
    expect(() => majanInputsSchema.parse(areaExceeded)).toThrow(/Grouped leasing area/);

    expect(monthDistance(MAJAN_ORIGINAL_BASELINE.startMonth, "2056-09")).toBe(360);
    expect(() => majanInputsSchema.parse(inputs({ horizonMonth: "2056-09" }))).toThrow(/Horizon/);

    const overlapping = inputs();
    overlapping.finance = { ...overlapping.finance, enabled: true, drawEndMonth: "2029-12", repaymentStartMonth: "2029-12" };
    expect(() => majanInputsSchema.parse(overlapping)).toThrow(/Repayment must start after/);
  });

  it("allows incomplete draft finance terms but rejects negative values", () => {
    const incomplete = inputs();
    incomplete.finance = { ...incomplete.finance, enabled: true, status: "indicative", commitment: null, financeSharePct: null, profitRatePct: null, repaymentMonths: null };
    expect(majanInputsSchema.parse(incomplete).finance.commitment).toBeNull();

    const negative = inputs();
    negative.finance.arrangementFeePct = -0.01;
    expect(() => majanInputsSchema.parse(negative)).toThrow();
  });
});
