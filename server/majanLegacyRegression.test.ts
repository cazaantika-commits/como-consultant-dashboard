import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  readConsultantFeeSpecs,
  resolveConsultantFee,
} from "../client/src/lib/consultantFees";
import {
  calculateCosts,
  calculatePricingFormulas,
  calculateProjectFormulas,
  dbProjectToRates,
} from "../client/src/lib/projectData";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { MAJAN_ORIGINAL_BASELINE } from "../shared/majanBaselineSnapshot";

const MAJAN_SNAPSHOT = "/home/ubuntu/reports/majan-financing-review-2026-10-09/Application_Snapshot_2026-10-09.json";

type Snapshot = { project: Record<string, unknown> };

function readMajanProject() {
  return (JSON.parse(readFileSync(MAJAN_SNAPSHOT, "utf8")) as Snapshot).project;
}

function rowMonthlyTotal(row: {
  designMonths: number[];
  constructionMonths: number[];
  postConstructionMonths: number[];
}) {
  return [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths]
    .reduce((sum, amount) => sum + amount, 0);
}

function minimalCostProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 99001,
    name: "Legacy fee regression",
    financingScenario: "build_for_rent",
    landPrice: "0",
    agentCommissionLandPct: "0",
    manualBuaSqft: "1000",
    estimatedConstructionPricePerSqft: "100",
    gfaSqft: "0",
    gfaResidentialSqft: "0",
    gfaRetailSqft: "0",
    gfaOfficesSqft: "0",
    designFeePct: "2",
    designFeeFixed: "7900",
    supervisionFeePct: "2",
    supervisionFeeFixed: "8500",
    constructionMonths: 1,
    preConMonths: 1,
    startDate: "2026-01",
    constructionScheduleJson: "{}",
    ...overrides,
  };
}

describe("Majan legacy regression — fee consistency and As-Built survey", () => {
  it("retains the immutable Majan baseline and repairs only the AED 45,000 row reconciliation", () => {
    const result = computeInvestorCashFlow(readMajanProject(), "build_for_rent");
    const baselineByName = new Map(MAJAN_ORIGINAL_BASELINE.rows.map((row) => [row.nameAr, row]));

    expect(result.grandTotalCost).toBeCloseTo(MAJAN_ORIGINAL_BASELINE.totalCost, 6);
    expect(result.grandInvestor).toBeCloseTo(MAJAN_ORIGINAL_BASELINE.totalCost, 6);
    expect(result.grandPaid).toBe(MAJAN_ORIGINAL_BASELINE.taggedPaid);
    expect(result.grandUnpaid).toBeCloseTo(
      MAJAN_ORIGINAL_BASELINE.totalCost - MAJAN_ORIGINAL_BASELINE.taggedPaid,
      6,
    );
    expect(result.totalRevenue).toBe(0);
    expect(result.monthDates).toEqual(MAJAN_ORIGINAL_BASELINE.periods);

    for (const row of result.rows) {
      const baseline = baselineByName.get(row.label);
      expect(baseline, `unexpected legacy row: ${row.label}`).toBeDefined();
      expect(row.totalCost).toBeCloseTo(baseline!.total, 6);
      expect(rowMonthlyTotal(row)).toBeCloseTo(
        baseline!.monthly.reduce((sum, amount) => sum + amount, 0),
        6,
      );
    }

    const asBuilt = result.rows.find((row) => row.label === "رسوم المساح (As-Built)");
    expect(asBuilt).toBeDefined();
    expect(asBuilt).toMatchObject({
      totalCost: 45_000,
      investorAmount: 45_000,
      paid: 0,
      unpaid: 45_000,
      funder: "investor",
    });
    expect(rowMonthlyTotal(asBuilt!)).toBe(45_000);
    expect(asBuilt!.paid + asBuilt!.unpaid).toBe(asBuilt!.totalCost);
  });

  it("keeps each historic fee path when no explicit consultantFees mode exists", () => {
    const legacyProject = minimalCostProject();
    const rates = dbProjectToRates(legacyProject);
    const formulas = calculateProjectFormulas(
      {
        name: "Legacy fee regression",
        landArea: 0,
        bua: 1_000,
        constructionCostPerSqft: 100,
        landPricePerSqft: 0,
        landPriceTotal: 0,
        designDuration: 1,
        constructionDuration: 1,
        startDate: "2026-01",
        gfaTotal: 0,
        gfaResidential: 0,
        gfaRetail: 0,
        gfaOffice: 0,
        efficiencyResidential: 0,
        efficiencyRetail: 0,
        efficiencyOffice: 0,
        soilTest: 0,
        topography: 0,
        surveyorFee: 0,
        surveyorDwgFee: 0,
        nocSale: 0,
        escrowAccountFee: 0,
        bankFees: 0,
        communityFee: 0,
        reraProjectReg: 0,
        reraAuditorReport: 0,
        reraInspection: 0,
        govFeesTotal: 0,
      },
      rates,
    );
    const engineCosts = calculateCosts(formulas, calculatePricingFormulas([]), {
      name: "Legacy fee regression",
      landArea: 0,
      bua: 1_000,
      constructionCostPerSqft: 100,
      landPricePerSqft: 0,
      landPriceTotal: 0,
      designDuration: 1,
      constructionDuration: 1,
      startDate: "2026-01",
      gfaTotal: 0,
      gfaResidential: 0,
      gfaRetail: 0,
      gfaOffice: 0,
      efficiencyResidential: 0,
      efficiencyRetail: 0,
      efficiencyOffice: 0,
      soilTest: 0,
      topography: 0,
      surveyorFee: 0,
      surveyorDwgFee: 0,
      nocSale: 0,
      escrowAccountFee: 0,
      bankFees: 0,
      communityFee: 0,
      reraProjectReg: 0,
      reraAuditorReport: 0,
      reraInspection: 0,
      govFeesTotal: 0,
    }, rates);

    // The original project-data engine was percentage-only, while the Project
    // Costs report historically gave a positive fixed input precedence.
    expect(engineCosts.designFee).toBe(2_000);
    expect(engineCosts.supervisionFee).toBe(2_000);
    expect(calculateProjectCosts(legacyProject)!.designFee).toBe(7_900);
    expect(calculateProjectCosts(legacyProject)!.supervisionFee).toBe(8_500);

    const noPctProject = minimalCostProject({
      designFeePct: "",
      supervisionFeePct: "",
      designFeeFixed: "0",
      supervisionFeeFixed: "0",
    });
    const noPctRates = dbProjectToRates(noPctProject);
    expect(noPctRates.designFee).toBeCloseTo(0.018, 12);
    expect(noPctRates.supervisionFee).toBeCloseTo(0.02, 12);
    expect(calculateProjectCosts({ ...noPctProject, designFeePct: "0", supervisionFeePct: "0" })!.designFee).toBe(0);
  });

  it("uses an explicit per-fee mode and value without applying a hidden legacy precedence", () => {
    const modesJson = JSON.stringify({
      settings: {
        consultantFees: {
          design: { mode: "amount", amount: 7_900, percentage: 2, minimum: 0 },
          supervision: { mode: "percentage_minimum", amount: 0, percentage: 2, minimum: 8_500 },
        },
      },
    });
    expect(readConsultantFeeSpecs(modesJson)).toEqual({
      design: { mode: "amount", amount: 7_900, percentage: 2, minimum: 0 },
      supervision: { mode: "percentage_minimum", amount: 0, percentage: 2, minimum: 8_500 },
    });

    const explicitProject = minimalCostProject({ constructionScheduleJson: modesJson });
    const projectCosts = calculateProjectCosts(explicitProject)!;
    expect(projectCosts.designFee).toBe(7_900);
    expect(projectCosts.supervisionFee).toBe(8_500);

    expect(resolveConsultantFee(100_000, 0, 7_900, "amount")).toBe(7_900);
    expect(resolveConsultantFee(100_000, 2, 7_900, "percentage")).toBe(2_000);
    expect(resolveConsultantFee(100_000, 2, 7_900, "percentage_minimum")).toBe(7_900);
    expect(resolveConsultantFee(100_000, 2, 7_900, "none")).toBe(0);
  });
});
