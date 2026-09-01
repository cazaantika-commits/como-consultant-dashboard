import { describe, expect, it } from "vitest";
import {
  getJointVentureInputReadiness,
  hasApprovedWaelSalesIndicator,
  isJointVentureFinancialResultReady,
} from "../client/src/lib/jointVentureInputReadiness";

const emptyJointVenture = {
  isTestProject: true,
  financingScenario: "joint_venture_land_for_units",
  constructionScheduleJson: JSON.stringify({
    settings: {
      jointVenture: {
        landOwnerProjectSharePct: 35,
        landOwnerUnitsRegistrationFeePct: 4,
      },
    },
  }),
  startDate: null,
  constructionMonths: null,
  manualBuaSqft: null,
  estimatedConstructionPricePerSqft: null,
  residential1brCount: 0,
};

describe("isolated Joint Venture input readiness", () => {
  it("blocks sales and escrow results while actual project inputs are absent", () => {
    const readiness = getJointVentureInputReadiness(emptyJointVenture);

    expect(readiness.applies).toBe(true);
    expect(readiness.salesWorkspaceReady).toBe(false);
    expect(readiness.missingLabels).toContain("توزيع الوحدات");
    expect(readiness.missingLabels).toContain("المساحة المبنية وتكلفة الإنشاء");
    expect(readiness.missingLabels).toContain("تاريخ البداية ومدد التصميم وإجراءات الأوف بلان والإنشاء");
  });

  it("opens Wael's sales workspace after unit, price, and timeline inputs while keeping financial results gated by construction cost", () => {
    const complete = {
      ...emptyJointVenture,
      startDate: "2027-01",
      constructionMonths: 18,
      manualBuaSqft: 20_000,
      estimatedConstructionPricePerSqft: null,
      residential1brCount: 10,
      residential1brArea: 900,
      residential1brPrice: 1_200,
      constructionScheduleJson: JSON.stringify({
        settings: {
          jointVenture: { landOwnerProjectSharePct: 35, landOwnerUnitsRegistrationFeePct: 4 },
          designPayments: { concept: { durationWeeks: 4 } },
          projectPhases: {
            marketingPrep: { startMonth: 1, endMonth: 2 },
            reraApprovals: { startMonth: 2, endMonth: 3 },
            marketingLaunch: { startMonth: 3, endMonth: 4 },
            salesStart: { startMonth: 4, endMonth: 4 },
            construction: { startMonth: 5, endMonth: 22 },
          },
        },
      }),
    };

    const readiness = getJointVentureInputReadiness(complete);
    expect(readiness.salesWorkspaceReady).toBe(true);
    expect(readiness.financialModelReady).toBe(false);
    expect(isJointVentureFinancialResultReady(complete, undefined)).toBe(false);

    const financialComplete = { ...complete, estimatedConstructionPricePerSqft: 500 };
    const approvedPlan = {
      resultsJson: JSON.stringify({
        salesDistribution: [2, 3, 5],
        actualEscrowCashInflow: [200_000, 300_000, 500_000],
      }),
    };
    expect(getJointVentureInputReadiness(financialComplete).financialModelReady).toBe(true);
    expect(isJointVentureFinancialResultReady(financialComplete, approvedPlan)).toBe(true);
  });

  it("requires an actual saved Wael distribution and escrow receipt before opening the escrow report", () => {
    expect(hasApprovedWaelSalesIndicator(undefined)).toBe(false);
    expect(hasApprovedWaelSalesIndicator({ resultsJson: JSON.stringify({ salesDistribution: [], actualEscrowCashInflow: [] }) })).toBe(false);
    expect(hasApprovedWaelSalesIndicator({
      resultsJson: JSON.stringify({
        salesDistribution: [1, 0, 2],
        actualEscrowCashInflow: [100_000, 0, 200_000],
      }),
    })).toBe(true);
  });
});
