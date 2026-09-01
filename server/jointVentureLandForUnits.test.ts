import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calculateJointVentureAreaShare,
  calculateJointVentureRevenueShare,
  getJointVentureTerms,
  saveJointVentureTerms,
} from "../client/src/lib/jointVentureLandForUnits";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";

const ROOT = path.resolve(import.meta.dirname, "..");

const project = {
  financingScenario: "joint_venture_land_for_units",
  constructionScheduleJson: JSON.stringify({
    settings: {
      jointVenture: {
        landOwnerResidentialSharePct: 35,
        landOwnerCommercialSharePct: 0,
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
  preConMonths: 1,
  constructionMonths: 1,
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
  reraUnitRegFee: "0",
  reraProjectRegFee: "0",
  developerNocFee: "0",
  escrowAccountFee: "0",
  bankFees: "0",
  reraAuditReportFee: "0",
  reraInspectionReportFee: "0",
};

describe("Joint Venture — land for residential units", () => {
  it("assigns the editable residential share to the landowner and keeps commercial revenue with the developer", () => {
    const result = calculateJointVentureRevenueShare({
      grossResidentialRevenue: 10_000_000,
      grossRetailRevenue: 4_000_000,
      grossOfficeRevenue: 0,
      terms: { landOwnerResidentialSharePct: 35, landOwnerCommercialSharePct: 0 },
    });

    expect(result.landOwnerResidentialValue).toBe(3_500_000);
    expect(result.landOwnerCommercialValue).toBe(0);
    expect(result.developerResidentialRevenue).toBe(6_500_000);
    expect(result.developerCommercialRevenue).toBe(4_000_000);
    expect(result.developerTotalRevenue).toBe(10_500_000);
    expect(result.landOwnerTotalValue + result.developerTotalRevenue).toBe(result.grossTotalRevenue);
  });

  it("recalculates area and revenue immediately when the landowner percentage changes", () => {
    const revisedJson = saveJointVentureTerms(project.constructionScheduleJson, {
      landOwnerResidentialSharePct: 25,
    });
    const revisedTerms = getJointVentureTerms({ constructionScheduleJson: revisedJson });
    const areas = calculateJointVentureAreaShare(project, revisedTerms);
    const revenues = calculateJointVentureRevenueShare({
      grossResidentialRevenue: 10_000_000,
      grossRetailRevenue: 4_000_000,
      grossOfficeRevenue: 0,
      terms: revisedTerms,
    });

    expect(revisedTerms.landOwnerResidentialSharePct).toBe(25);
    expect(areas.landOwnerResidentialArea).toBe(2_500);
    expect(areas.developerResidentialArea).toBe(7_500);
    expect(revenues.landOwnerResidentialValue).toBe(2_500_000);
    expect(revenues.developerTotalRevenue).toBe(11_500_000);
  });

  it("treats land as a non-cash contribution and uses only the developer share as sales revenue", () => {
    const result = computeInvestorCashFlow(project, "joint_venture_land_for_units");

    expect(result.totalRevenue).toBe(10_500_000);
    expect(result.rows.some((row) => row.label === "سعر الأرض")).toBe(false);
    expect(result.rows.some((row) => row.label.includes("مساهمة مالك الأرض") && row.totalCost === 0)).toBe(true);
    expect(result.rows.some((row) => row.label.includes("أتعاب المطور"))).toBe(false);
    expect(result.rows.some((row) => row.label.includes("حصة كومو"))).toBe(false);
    expect(result.rows.find((row) => row.isRevenue)?.label).toBe("إيراد حصة المطور من المبيعات");
  });

  it("reports developer revenue and excludes land price, registration, and broker commission from project cash costs", () => {
    const costs = calculateProjectCosts(project)!;

    expect(costs.landPrice).toBe(0);
    expect(costs.landRegistration).toBe(0);
    expect(costs.agentCommissionLand).toBe(0);
    expect(costs.developerFee).toBe(0);
    expect(costs.grossTotalRevenue).toBe(14_000_000);
    expect(costs.landOwnerResidentialValue).toBe(3_500_000);
    expect(costs.totalRevenue).toBe(10_500_000);
    expect((costs.totalRevenue ?? 0) - (costs.totalCosts ?? 0)).toBeTypeOf("number");
  });

  it("does not fabricate revenue, costs, profit, or loss before financial inputs are entered", () => {
    const emptyProject = {
      ...project,
      manualBuaSqft: null,
      estimatedConstructionPricePerSqft: null,
      designFeePct: null,
      supervisionFeePct: null,
      salesCommissionPct: null,
      marketingPct: null,
      developerFeePct: null,
      saleableResidentialPct: null,
      saleableRetailPct: null,
      saleableOfficesPct: null,
      studioCount: 0,
      residential1brCount: 0,
      residential2brCount: 0,
      residential2brMaidCount: 0,
      residential3brCount: 0,
      residential3brMaidCount: 0,
      retailSmallCount: 0,
      retailMediumCount: 0,
      retailLargeCount: 0,
      residential1brPrice: 0,
      residential2brPrice: 0,
      residential2brMaidPrice: 0,
      residential3brPrice: 0,
      residential3brMaidPrice: 0,
      retailSmallPrice: 0,
      retailMediumPrice: 0,
      retailLargePrice: 0,
    };
    const result = computeInvestorCashFlow(emptyProject, "joint_venture_land_for_units");
    const costs = calculateProjectCosts(emptyProject)!;

    expect(result.totalRevenue).toBe(0);
    expect(result.grandTotalCost).toBe(0);
    expect(result.totalRevenue - result.grandTotalCost).toBe(0);
    expect(costs.totalRevenue).toBe(0);
    expect(costs.totalCosts).toBe(0);
    expect((costs.totalRevenue ?? 0) - (costs.totalCosts ?? 0)).toBe(0);
  });

  it("exposes the model only through the test-project-compatible project and financial routes", () => {
    const projectRouter = fs.readFileSync(path.join(ROOT, "server/routers/projects.ts"), "utf8");
    const navigation = fs.readFileSync(path.join(ROOT, "client/src/lib/financialStudiesNavigation.ts"), "utf8");
    const feasibility = fs.readFileSync(path.join(ROOT, "client/src/pages/V2Feasibility.tsx"), "utf8");

    expect(projectRouter).toContain('"joint_venture_land_for_units"');
    expect(navigation).toContain('projectType === "joint_venture_land_for_units"');
    expect(feasibility).toContain("حصة مالك الأرض من السكني");
    expect(feasibility).toContain("ربح / خسارة المطور");
  });
});
