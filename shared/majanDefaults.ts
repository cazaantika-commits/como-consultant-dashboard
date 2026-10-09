/**
 * Majan-only editable planning defaults. These values are **Indicative
 * assumptions**, never a bank approval, lease schedule, supplier quotation,
 * tax opinion, or financing term sheet.
 */
import type { MajanBaseline, MajanInputs, Provenance } from "./majanFinanceTypes";
import { MAJAN_ORIGINAL_BASELINE } from "./majanBaselineSnapshot";
export { MAJAN_COLLIERS_FLOOR_GLA, MAJAN_COLLIERS_TOTAL_GLA, MAJAN_GFA_SQFT } from "./majanAreaConstants";

export { MAJAN_ORIGINAL_BASELINE } from "./majanBaselineSnapshot";

export const MAJAN_RECORDED_AS_OF = "2026-10-09";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Isolated copy: calculations must never mutate the recorded development schedule. */
export function createMajanOriginalBaseline(): MajanBaseline {
  return clone(MAJAN_ORIGINAL_BASELINE);
}

function addMonths(month: string, months: number): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new RangeError(`Invalid YYYY-MM month: ${month}`);
  const serial = Number(match[1]) * 12 + Number(match[2]) - 1 + months;
  return `${Math.floor(serial / 12)}-${String((serial % 12) + 1).padStart(2, "0")}`;
}

function assumption(source: string, rationale: string): Provenance {
  return { source, asOf: MAJAN_RECORDED_AS_OF, status: "assumption", rationale };
}

const colliersAreaSource = assumption(
  "Colliers Majan Retail Study Draft V.02, floor-area recommendation",
  "Concept-stage floor allocation only; editable planning anchor, not a final plan, rent roll, or contractual area.",
);
const retailRentSource = assumption(
  "Colliers Majan Retail Study Draft V.02 / planning assumption",
  "AED 223/sqft/year is used only for illustrative leased-retail rows. It is not applied to all categories and is not an executed rent.",
);
const operatingSource = assumption(
  "Independent operating-budget planning allowance",
  "Editable budget allowance, not a supplier quotation, service-charge contract, or approved operating budget.",
);

/**
 * Complete editable planning case. All leasing, OPEX, tax and facility fields
 * are clearly attributable assumptions. No legacy unit count is used.
 */
export function createDefaultMajanInputs(baseline: MajanBaseline = createMajanOriginalBaseline()): MajanInputs {
  const openingMonth = addMonths(baseline.startMonth, baseline.designMonths + baseline.constructionMonths + 2);
  const drawStartMonth = addMonths(baseline.startMonth, baseline.designMonths);
  const drawEndMonth = addMonths(drawStartMonth, baseline.constructionMonths - 1);
  const repaymentStartMonth = addMonths(drawEndMonth, 3);
  const commonLease = {
    treatment: "leased" as const,
    rentRule: "base" as const,
    openingMonth,
    initialOccupancyPct: 40,
    stabilisedOccupancyPct: 90,
    rampMonths: 24,
    rentFreeMonths: 3,
    escalationPct: 2,
    collectionPct: 98,
    collectionLagMonths: 1,
    annualSalesPsf: null,
    turnoverPct: null,
  };
  return {
    schemaVersion: 1,
    projectId: 1,
    plot: "6457956",
    caseName: "Majan — indicative planning case",
    asOf: MAJAN_RECORDED_AS_OF,
    // Planning horizon intentionally extends beyond the example facility maturity and is editable.
    horizonMonth: "2042-12",
    development: {
      buaSqft: baseline.buaSqft,
      constructionRate: baseline.constructionRate,
      designFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      supervisionFee: { mode: "percentage", amount: null, percentage: 2.5, minimum: null },
      source: {
        source: "Application Snapshot 2026-10-09, recorded development schedule",
        asOf: MAJAN_RECORDED_AS_OF,
        status: "recorded",
        rationale: "Recorded 2.5% calculation path retained. Fixed AED 7.9m / AED 8.5m alternatives remain an explicit unresolved issue.",
      },
    },
    leasing: [
      { id: "g-supermarket-anchor", floor: "G", nameEn: "Supermarket anchor", nameAr: "متجر سوبرماركت رئيسي", areaSqft: 43000, annualRentPsf: 150, ...commonLease, source: { ...colliersAreaSource, rationale: "Manus illustrative anchor split within Colliers Ground-floor area; AED 150 is a planning assumption, not a Colliers rent claim." } },
      { id: "g-retail-dining", floor: "G", nameEn: "Retail, dining and lifestyle", nameAr: "تجزئة ومطاعم ونمط حياة", areaSqft: 43111, annualRentPsf: 223, ...commonLease, source: { ...retailRentSource, rationale: "Manus illustrative residual split within Colliers Ground-floor area; AED 223 benchmark applied to this leased-retail row only." } },
      { id: "l1-fec", floor: "L1", nameEn: "Family entertainment centre", nameAr: "مركز ترفيه عائلي", areaSqft: 46000, annualRentPsf: 100, ...commonLease, source: { ...colliersAreaSource, rationale: "Manus illustrative FEC split within Colliers L1 area; AED 100 is a planning assumption, not a Colliers rent claim." } },
      { id: "l1-dining-lifestyle", floor: "L1", nameEn: "Dining and lifestyle", nameAr: "مطاعم ونمط حياة", areaSqft: 34729, annualRentPsf: 223, ...commonLease, source: { ...retailRentSource, rationale: "Manus illustrative residual split within Colliers L1 area; AED 223 benchmark applied to this leased-retail row only." } },
      { id: "l2-wellness", floor: "L2", nameEn: "Health and wellness", nameAr: "صحة وعافية", areaSqft: 59201, annualRentPsf: 180, ...commonLease, source: { ...colliersAreaSource, rationale: "Manus illustrative use allocation; AED 180 is a planning assumption, not a Colliers rent claim." } },
      { id: "l3-sport", floor: "L3", nameEn: "Sport and fitness", nameAr: "رياضة ولياقة", areaSqft: 53820, annualRentPsf: 100, ...commonLease, source: { ...colliersAreaSource, rationale: "Manus illustrative use allocation; AED 100 is a planning assumption, not a Colliers rent claim." } },
      { id: "l4-workspace", floor: "L4", nameEn: "Workspace", nameAr: "مساحات عمل", areaSqft: 45208, annualRentPsf: 120, ...commonLease, source: { ...colliersAreaSource, rationale: "Manus illustrative use allocation; AED 120 is a planning assumption, not a Colliers rent claim." } },
    ],
    opex: [
      { id: "utilities", nameEn: "Utilities", nameAr: "المرافق", mode: "per_gla", value: 10, escalationPct: 2, recoverablePct: 80, recoveryCollectionPct: 95, source: operatingSource },
      { id: "maintenance", nameEn: "Maintenance", nameAr: "الصيانة", mode: "per_gla", value: 8, escalationPct: 2, recoverablePct: 80, recoveryCollectionPct: 95, source: operatingSource },
      { id: "security", nameEn: "Security", nameAr: "الأمن", mode: "per_gla", value: 4, escalationPct: 2, recoverablePct: 80, recoveryCollectionPct: 95, source: operatingSource },
      { id: "cleaning", nameEn: "Cleaning", nameAr: "النظافة", mode: "per_gla", value: 4, escalationPct: 2, recoverablePct: 80, recoveryCollectionPct: 95, source: operatingSource },
      { id: "management", nameEn: "Management", nameAr: "الإدارة", mode: "percent_collected_rent", value: 5, escalationPct: 0, recoverablePct: 0, recoveryCollectionPct: 95, source: operatingSource },
      { id: "insurance", nameEn: "Insurance", nameAr: "التأمين", mode: "per_gla", value: 2, escalationPct: 2, recoverablePct: 0, recoveryCollectionPct: 95, source: operatingSource },
      { id: "marketing", nameEn: "Marketing", nameAr: "التسويق", mode: "per_gla", value: 3, escalationPct: 2, recoverablePct: 0, recoveryCollectionPct: 95, source: operatingSource },
    ],
    operations: {
      openingMonth,
      maintenanceCapexAnnual: 1500000,
      capexEscalationPct: 2,
      reserveAnnual: 500000,
      reserveReleaseAnnual: 0,
      cashTaxAnnual: 0,
      taxRationale: "Pre-tax indicative planning case: cash tax explicitly AED 0 pending entity-level tax review; this is not a tax estimate.",
      otherIncomeAnnual: 0,
      vatMode: "excluded_net_model",
      source: operatingSource,
    },
    finance: {
      enabled: false,
      status: "indicative",
      structure: "istisna_forward_ijara",
      lender: "",
      commitment: 250000000,
      financeSharePct: 60,
      profitRatePct: 6.5,
      drawStartMonth,
      drawEndMonth,
      repaymentStartMonth,
      repaymentMonths: 120,
      repaymentMode: "level_payment",
      constructionProfit: "capitalise",
      arrangementFeePct: 1,
      dsraMonths: 6,
      targetDscr: 1.3,
      balloonPct: 0,
      eligibleCategories: ["construction", "design", "supervision"],
      source: assumption(
        "Illustrative Islamic-finance planning case",
        "No lender is named or evidenced. Inputs are editable indicative assumptions for discussion only, not a bank offer, covenant, approval, contract or Shari’ah/legal opinion.",
      ),
    },
    notes: "Indicative planning model. The recorded development schedule is preserved. No unit count is used; operating, tax and financing outputs are assumptions, not approvals.",
  };
}
