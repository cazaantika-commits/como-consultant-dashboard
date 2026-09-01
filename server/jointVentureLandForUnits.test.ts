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
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { isFinancialStudiesTabVisible } from "../client/src/lib/financialStudiesNavigation";
import {
  buildSalesResultFromSavedPlan,
  rebuildOffPlanSalesResultsFromPaymentPlan,
} from "../client/src/lib/salesPlanCashFlow";

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
    const legacy = JSON.stringify({ settings: { jointVenture: { landOwnerResidentialSharePct: 35, landOwnerCommercialSharePct: 0, sourceIntegrityResetVersion: 1 } } });
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
    expect(JSON.parse(revisedJson).settings.jointVenture.sourceIntegrityResetVersion).toBe(1);
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

  it("calculates the owner allocation from saleable area and weighted price per sqft, never from unit count", () => {
    const terms = getJointVentureTerms({
      constructionScheduleJson: saveJointVentureTerms("{}", { landOwnerProjectSharePct: 30 }),
    });
    const result = calculateJointVentureRevenueShare({
      grossResidentialRevenue: 9_000_000,
      grossRetailRevenue: 3_000_000,
      grossOfficeRevenue: 0,
      pricedResidentialArea: 6_000,
      pricedRetailArea: 1_000,
      pricedOfficeArea: 0,
      saleableResidentialArea: 8_000,
      saleableRetailArea: 1_200,
      saleableOfficeArea: 0,
      terms,
    });
    const agreement = calculateJointVentureAgreementCosts(result.landOwnerTotalValue, terms);

    expect(result.calculationBasis).toBe("saleable_area_weighted_price");
    expect(result.residentialAveragePricePerSqft).toBe(1_500);
    expect(result.retailAveragePricePerSqft).toBe(3_000);
    expect(result.landOwnerResidentialArea).toBe(2_400);
    expect(result.landOwnerCommercialArea).toBe(360);
    expect(result.landOwnerResidentialValue).toBe(3_600_000);
    expect(result.landOwnerCommercialValue).toBe(1_080_000);
    expect(result.landOwnerTotalValue).toBe(4_680_000);
    expect(result.developerResidentialArea).toBe(5_600);
    expect(result.developerCommercialArea).toBe(840);
    expect(result.developerTotalRevenue).toBe(10_920_000);
    expect(agreement.landOwnerUnitsRegistrationCost).toBe(187_200);
  });

  it("keeps the landowner percentage independent in each project JSON", () => {
    const projectOne = saveJointVentureTerms("{}", { landOwnerProjectSharePct: 35 });
    const projectTwo = saveJointVentureTerms("{}", { landOwnerProjectSharePct: 30 });

    expect(getJointVentureTerms({ constructionScheduleJson: projectOne }).landOwnerProjectSharePct).toBe(35);
    expect(getJointVentureTerms({ constructionScheduleJson: projectTwo }).landOwnerProjectSharePct).toBe(30);
  });

  it("treats land as non-cash, routes developer-share sales through off-plan escrow, and excludes COMO profit share", () => {
    const paymentPlanJson = JSON.stringify({
      version: 2,
      stages: [
        { id: "booking", label: "دفعة الحجز", trigger: "sale", percentage: 100, recipient: "escrow" },
      ],
    });
    const rebuilt = rebuildOffPlanSalesResultsFromPaymentPlan({
      project,
      totalRevenue: 9_100_000,
      offplanPct: 65,
      salesAbsorptionJson: JSON.stringify({ mode: "auto", speed: 50, template: "bell" }),
      paymentPlanJson,
    });
    const salesResult = buildSalesResultFromSavedPlan({
      offplanPct: 65,
      paymentPlanJson,
      salesAbsorptionJson: rebuilt.salesAbsorptionJson,
      resultsJson: rebuilt.resultsJson,
    }, project, "joint_venture_land_for_units");
    const result = computeInvestorCashFlow(project, "joint_venture_land_for_units", undefined, salesResult);

    expect(result.totalRevenue).toBe(9_100_000);
    expect(salesResult?.offplanPct).toBe(100);
    expect(salesResult?.salesDistribution.reduce((sum, units) => sum + units, 0)).toBe(8);
    expect(result.rows.some((row) => row.label === "سعر الأرض")).toBe(false);
    expect(result.rows.some((row) => row.label.includes("مساهمة مالك الأرض") && row.totalCost === 0)).toBe(true);
    expect(result.rows.some((row) => row.label.includes("إيداع حساب الضمان") && row.isTransfer)).toBe(true);
    expect(result.rows.some((row) => row.funder === "escrow" && row.section === "الإنشاء")).toBe(true);
    expect(result.rows.some((row) => row.label.includes("تصفية حساب الضمان"))).toBe(true);
    expect(result.rows.some((row) => row.label.includes("أتعاب المطور"))).toBe(false);
    expect(result.rows.some((row) => row.label.includes("حصة كومو"))).toBe(false);
    expect(result.rows.some((row) => row.label.includes("تحصيلات مبيعات مباشرة بعد الإنجاز"))).toBe(false);
    expect(result.usedSalesResult?.escrowData.some((entry) => entry.income > 0)).toBe(true);
    const firstEscrowReceipt = result.usedSalesResult?.actualEscrowCashInflow?.findIndex((amount) => amount > 0) ?? -1;
    expect(firstEscrowReceipt).toBeGreaterThanOrEqual(0);
    expect(firstEscrowReceipt).toBeLessThan(result.designDuration + result.constructionDuration);
    const costs = calculateProjectCosts(project)!;
    const monthlyNet = calculateInvestorMonthlyNet(result, salesResult);
    const investorDebits = monthlyNet.paidBeforeSchedule + monthlyNet.debitTotals.reduce((sum, amount) => sum + amount, 0);
    const investorCredits = monthlyNet.creditTotals.reduce((sum, amount) => sum + amount, 0);
    expect(result.grandTotalCost).toBeCloseTo(costs.totalCosts ?? 0, 6);
    expect(investorCredits - investorDebits).toBeCloseTo(costs.totalRevenue - (costs.totalCosts ?? 0), 6);
  });

  it("does not invent a sales schedule when Wael has not saved his sales indicator", () => {
    const result = computeInvestorCashFlow(project, "joint_venture_land_for_units");

    expect(result.usedSalesResult).toBeUndefined();
    expect(result.rows.some((row) => row.label.includes("تحصيلات مبيعات مباشرة بعد الإنجاز"))).toBe(false);
    expect(result.rows.some((row) => row.isRevenue && row.totalCost > 0)).toBe(false);
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
    const timeline = fs.readFileSync(path.join(ROOT, "client/src/pages/TimelinePage.tsx"), "utf8");
    const salesRouter = fs.readFileSync(path.join(ROOT, "server/routers/waelSalesPlan.ts"), "utf8");

    expect(isFinancialStudiesTabVisible("escrow", "joint_venture_land_for_units")).toBe(true);
    expect(projectRouter).toContain('"joint_venture_land_for_units"');
    expect(isolatedProject).toContain("landOwnerProjectSharePct: landOwnerSharePct");
    expect(isolatedProject).toContain("landOwnerCommercialSharePct: landOwnerSharePct");
    expect(isolatedProject).toContain("landOwnerUnitsRegistrationFeePct: 4");
    expect(feasibility).toContain("حصة صاحب الأرض من المساحة القابلة للبيع");
    expect(feasibility).toContain("residentialAveragePricePerSqft");
    expect(feasibility).toContain("commercialAveragePricePerSqft");
    expect(feasibility).toContain("ربح / خسارة المطور");
    expect(timeline).toContain('const isBuildForSale = projectType === "build_for_sale";');
    expect(timeline).toContain("مؤشر وائل المحفوظ في صفحة المبيعات");
    expect(timeline).toContain("لا توجد مدد أو تواريخ مفترضة لهذا المشروع التجريبي");
    expect(salesRouter).toContain('"joint_venture_land_for_units"');
    expect(isolatedProject).not.toContain("DELETE FROM wael_sales_plans");
    expect(isolatedProject).not.toContain("manualBuaSqft = NULL");
  });
});
