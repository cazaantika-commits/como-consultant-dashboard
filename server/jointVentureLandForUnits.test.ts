import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calculateJointVentureAgreementCosts,
  calculateJointVentureAreaShare,
  calculateJointVentureRevenueShare,
  getJointVentureTerms,
  saveJointVentureTerms,
} from "../client/src/lib/jointVentureLandForUnits";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { isFinancialStudiesTabVisible } from "../client/src/lib/financialStudiesNavigation";

const ROOT = path.resolve(import.meta.dirname, "..");

const project = {
  financingScenario: "joint_venture_land_for_units",
  constructionScheduleJson: JSON.stringify({
    settings: {
      jointVenture: {
        landOwnerProjectSharePct: 35,
        landOwnerResidentialSharePct: 35,
        landOwnerCommercialSharePct: 35,
        developmentLicenseCost: 100_000,
        waelLicenseRegistrationCost: 50_000,
        landOwnerLicenseRegistrationCost: 25_000,
        landOwnerUnitsRegistrationFeePct: 4,
      },
    },
  }),
  landPrice: "25000000",
  agentCommissionLandPct: "2",
  gfaResidentialSqft: "10000",
  gfaRetailSqft: "2000",
  gfaOfficesSqft: "0",
  saleableResidentialPct: "100",
  saleableRetailPct: "100",
  saleableOfficesPct: "100",
  manualBuaSqft: "12000",
  estimatedConstructionPricePerSqft: "500",
  residential1brCount: 10,
  residential1brArea: 1000,
  residential1brPrice: 1000,
  retailSmallCount: 2,
  retailSmallArea: 1000,
  retailSmallPrice: 2000,
  studioCount: 0,
  residential2brCount: 0,
  residential2brMaidCount: 0,
  residential3brCount: 0,
  residential3brMaidCount: 0,
  villaCount: 0,
  townhouseCount: 0,
  retailMediumCount: 0,
  retailLargeCount: 0,
  officeSmallCount: 0,
  officeMediumCount: 0,
  officeLargeCount: 0,
  preConMonths: 2,
  constructionMonths: 12,
  handoverMonths: 1,
  startDate: "2026-09",
  designFeePct: "0",
  supervisionFeePct: "0",
  separationFeePerSqft: "0",
  salesCommissionPct: "0",
  marketingPct: "0",
  developerFeePct: "5",
  officialBodiesFees: "0",
  communityFees: "0",
  soilTestFee: "0",
  topographicSurveyFee: "0",
  surveyorFees: "0",
  surveyorDwgFees: "0",
  reraUnitRegFee: "0",
  reraProjectRegFee: "0",
  developerNocFee: "0",
  escrowAccountFee: "0",
  bankFees: "0",
  reraAuditReportFee: "0",
  reraInspectionReportFee: "0",
};

describe("Joint Venture Off-Plan — land for all-unit share", () => {
  it("allocates the editable 35% landowner share across residential and commercial units", () => {
    const terms = getJointVentureTerms(project);
    const result = calculateJointVentureRevenueShare({
      grossResidentialRevenue: 10_000_000,
      grossRetailRevenue: 4_000_000,
      grossOfficeRevenue: 0,
      terms,
    });

    expect(terms.landOwnerResidentialSharePct).toBe(35);
    expect(terms.landOwnerCommercialSharePct).toBe(35);
    expect(result.landOwnerResidentialValue).toBe(3_500_000);
    expect(result.landOwnerCommercialValue).toBe(1_400_000);
    expect(result.developerResidentialRevenue).toBe(6_500_000);
    expect(result.developerCommercialRevenue).toBe(2_600_000);
    expect(result.developerTotalRevenue).toBe(9_100_000);
    expect(result.landOwnerTotalValue + result.developerTotalRevenue).toBe(result.grossTotalRevenue);
  });

  it("normalizes legacy separate shares and applies one changed percentage to both categories", () => {
    const legacy = JSON.stringify({ settings: { jointVenture: { landOwnerResidentialSharePct: 35, landOwnerCommercialSharePct: 0 } } });
    expect(getJointVentureTerms({ constructionScheduleJson: legacy }).landOwnerCommercialSharePct).toBe(35);

    const revisedJson = saveJointVentureTerms(legacy, { landOwnerResidentialSharePct: 25 });
    const revisedTerms = getJointVentureTerms({ constructionScheduleJson: revisedJson });
    const areas = calculateJointVentureAreaShare(project, revisedTerms);
    const revenues = calculateJointVentureRevenueShare({
      grossResidentialRevenue: 10_000_000,
      grossRetailRevenue: 4_000_000,
      grossOfficeRevenue: 0,
      terms: revisedTerms,
    });

    expect(revisedTerms.landOwnerResidentialSharePct).toBe(25);
    expect(revisedTerms.landOwnerCommercialSharePct).toBe(25);
    expect(areas.landOwnerResidentialArea).toBe(2_500);
    expect(areas.landOwnerCommercialArea).toBe(500);
    expect(revenues.landOwnerTotalValue).toBe(3_500_000);
    expect(revenues.developerTotalRevenue).toBe(10_500_000);
  });

  it("calculates the three upfront agreement costs and final 4% registration from owner-unit value", () => {
    const terms = getJointVentureTerms(project);
    const agreement = calculateJointVentureAgreementCosts(4_900_000, terms);

    expect(agreement.initialAgreementCosts).toBe(175_000);
    expect(agreement.landOwnerUnitsRegistrationFeePct).toBe(4);
    expect(agreement.landOwnerUnitsRegistrationCost).toBe(196_000);
    expect(agreement.totalAgreementCosts).toBe(371_000);
  });

  it("treats land as non-cash, routes developer-share sales through off-plan escrow, and excludes COMO profit share", () => {
    const result = computeInvestorCashFlow(project, "joint_venture_land_for_units");

    expect(result.totalRevenue).toBe(9_100_000);
    expect(result.rows.some((row) => row.label === "سعر الأرض")).toBe(false);
    expect(result.rows.some((row) => row.label.includes("مساهمة مالك الأرض") && row.totalCost === 0)).toBe(true);
    expect(result.rows.some((row) => row.label.includes("إيداع حساب الضمان") && row.isTransfer)).toBe(true);
    expect(result.rows.some((row) => row.funder === "escrow" && row.section === "الإنشاء")).toBe(true);
    expect(result.rows.some((row) => row.label.includes("تصفية حساب الضمان"))).toBe(true);
    expect(result.rows.some((row) => row.label.includes("أتعاب المطور"))).toBe(false);
    expect(result.rows.some((row) => row.label.includes("حصة كومو"))).toBe(false);
    expect(result.usedSalesResult?.escrowData.some((entry) => entry.income > 0)).toBe(true);
    const firstEscrowReceipt = result.usedSalesResult?.actualEscrowCashInflow?.findIndex((amount) => amount > 0) ?? -1;
    expect(firstEscrowReceipt).toBeGreaterThanOrEqual(0);
    expect(firstEscrowReceipt).toBeLessThan(result.designDuration + result.constructionDuration);
  });

  it("charges all JV agreement rows to Wael outside escrow and reconciles engine cost with feasibility", () => {
    const result = computeInvestorCashFlow(project, "joint_venture_land_for_units");
    const costs = calculateProjectCosts(project)!;
    const agreementRows = result.rows.filter((row) => row.section === "اتفاق الشراكة والتسجيل");
    const finalRegistration = agreementRows.find((row) => row.label.includes("عند الإنجاز"));

    expect(costs.landPrice).toBe(0);
    expect(costs.landRegistration).toBe(0);
    expect(costs.agentCommissionLand).toBe(0);
    expect(costs.developerFee).toBe(0);
    expect(costs.grossTotalRevenue).toBe(14_000_000);
    expect(costs.landOwnerResidentialValue).toBe(3_500_000);
    expect(costs.landOwnerCommercialValue).toBe(1_400_000);
    expect(costs.landOwnerUnitsRegistrationCost).toBe(196_000);
    expect(agreementRows).toHaveLength(4);
    expect(agreementRows.every((row) => row.funder === "investor")).toBe(true);
    expect(finalRegistration?.postConstructionMonths[0]).toBe(196_000);
    expect(result.grandTotalCost).toBeCloseTo(costs.totalCosts ?? 0, 6);
  });

  it("does not fabricate revenue, costs, profit, or saleable area before financial inputs are entered", () => {
    const emptyProject = {
      financingScenario: "joint_venture_land_for_units",
      constructionScheduleJson: JSON.stringify({ settings: { jointVenture: { landOwnerProjectSharePct: 35, landOwnerUnitsRegistrationFeePct: 4 } } }),
      gfaResidentialSqft: "10000",
      gfaRetailSqft: "2000",
      manualBuaSqft: null,
      estimatedConstructionPricePerSqft: null,
      constructionMonths: null,
      startDate: null,
    };
    const result = computeInvestorCashFlow(emptyProject, "joint_venture_land_for_units");
    const costs = calculateProjectCosts(emptyProject)!;
    const areas = calculateJointVentureAreaShare(emptyProject, getJointVentureTerms(emptyProject));

    expect(result.totalRevenue).toBe(0);
    expect(result.grandTotalCost).toBe(0);
    expect(costs.totalRevenue).toBe(0);
    expect(costs.totalCosts).toBe(0);
    expect(areas.saleableResidentialArea).toBe(0);
    expect(areas.saleableCommercialArea).toBe(0);
  });

  it("keeps escrow navigation visible and the model confined to the isolated test-project workflow", () => {
    const projectRouter = fs.readFileSync(path.join(ROOT, "server/routers/projects.ts"), "utf8");
    const isolatedProject = fs.readFileSync(path.join(ROOT, "server/isolatedTestProject.ts"), "utf8");
    const feasibility = fs.readFileSync(path.join(ROOT, "client/src/pages/V2Feasibility.tsx"), "utf8");

    expect(isFinancialStudiesTabVisible("escrow", "joint_venture_land_for_units")).toBe(true);
    expect(projectRouter).toContain('"joint_venture_land_for_units"');
    expect(isolatedProject).toContain('"landOwnerProjectSharePct":35');
    expect(isolatedProject).toContain('"landOwnerCommercialSharePct":35');
    expect(isolatedProject).toContain('"landOwnerUnitsRegistrationFeePct":4');
    expect(feasibility).toContain("حصة صاحب الأرض من جميع الوحدات");
    expect(feasibility).toContain("ربح / خسارة المطور");
  });
});
