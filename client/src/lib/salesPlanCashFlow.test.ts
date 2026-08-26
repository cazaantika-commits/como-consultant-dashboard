import { describe, expect, it } from "vitest";
import { rebuildOffPlanSalesResultsFromPaymentPlan } from "./salesPlanCashFlow";

const paymentPlanJson = JSON.stringify({
  version: 2,
  stages: [
    { id: "booking", label: "دفعة الحجز", milestone: "booking", trigger: "sale", percentage: 10, recipient: "escrow", installmentCount: 1 },
    { id: "contract", label: "دفعة توقيع العقد", milestone: "contract", trigger: "months_after_sale", percentage: 10, recipient: "escrow", offsetMonths: 1, installmentCount: 1 },
    { id: "construction", label: "دفعات أثناء الإنشاء", milestone: "construction", trigger: "months_after_sale", percentage: 40, recipient: "escrow", offsetMonths: 4, everyMonths: 4, installmentCount: 4, untilHandover: true },
    { id: "handover", label: "دفعة التسليم", milestone: "handover", trigger: "handover", percentage: 40, recipient: "escrow", installmentCount: 1 },
  ],
  calendarEntries: [
    { id: "booking", label: "دفعة الحجز", milestone: "booking", percentage: 10, recipient: "escrow", sequence: 1, timingRule: "booking" },
    { id: "contract", label: "دفعة توقيع العقد", milestone: "contract", offsetMonths: 1, percentage: 10, recipient: "escrow", sequence: 2, timingRule: "after_previous" },
    { id: "construction-1", label: "قسط الإنشاء 1", milestone: "construction", offsetMonths: 3, percentage: 10, recipient: "escrow", sequence: 3, timingRule: "after_previous" },
    { id: "construction-2", label: "قسط الإنشاء 2", milestone: "construction", offsetMonths: 4, percentage: 10, recipient: "escrow", sequence: 4, timingRule: "after_previous" },
    { id: "construction-3", label: "قسط الإنشاء 3", milestone: "construction", offsetMonths: 4, percentage: 10, recipient: "escrow", sequence: 5, timingRule: "after_previous" },
    { id: "construction-4", label: "قسط الإنشاء 4", milestone: "construction", offsetMonths: 4, percentage: 10, recipient: "escrow", sequence: 6, timingRule: "after_previous" },
    { id: "handover", label: "دفعة التسليم", milestone: "handover", percentage: 40, recipient: "escrow", sequence: 7, timingRule: "handover" },
  ],
});

describe("rebuildOffPlanSalesResultsFromPaymentPlan", () => {
  it("rebuilds Plot 2 within the current 19-month sales window and removes stale post-closure receipts", () => {
    const result = rebuildOffPlanSalesResultsFromPaymentPlan({
      project: {
        startDate: "2026-10",
        constructionMonths: 20,
        studioCount: 83,
        constructionScheduleJson: JSON.stringify({
          settings: {
            projectPhases: {
              marketingPrep: { durationMonths: 2, startOffsetMonths: 0 },
              reraApprovals: { durationMonths: 2, startOffsetMonths: 1 },
              marketingLaunch: { durationMonths: 0, startOffsetMonths: 0 },
              salesStart: { durationMonths: 0, startOffsetMonths: 1 },
              construction: { durationMonths: 0, startOffsetMonths: 1 },
            },
            designPayments: {
              mobilization: { pct: 5, durationWeeks: 1 },
              concept: { pct: 15, durationWeeks: 4 },
              schematic: { pct: 20, durationWeeks: 4 },
              dd: { pct: 25, durationWeeks: 4 },
              authorities: { pct: 10, durationWeeks: 4 },
              tender: { pct: 15, durationWeeks: 3 },
              ifc: { pct: 10, durationWeeks: 2 },
            },
          },
        }),
      },
      totalRevenue: 152_377_100,
      offplanPct: 100,
      salesAbsorptionJson: JSON.stringify({ mode: "auto", speed: 50, template: "bell", manual: [] }),
      paymentPlanJson,
      existingResultsJson: JSON.stringify({
        preservedMarker: "keep",
        actualEscrowCashInflow: new Array(34).fill(734_347.47),
      }),
    });

    const parsed = JSON.parse(result.resultsJson);
    expect(result.salesStartMonth).toBe(8);
    expect(result.projectEndMonth).toBe(26);
    expect(result.salesDistribution).toHaveLength(19);
    expect(result.salesDistribution.reduce((sum, units) => sum + units, 0)).toBe(83);
    expect(result.actualEscrowCashInflow.slice(26).reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(result.actualEscrowCashInflow.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(152_377_100, 6);
    expect(parsed.preservedMarker).toBe("keep");
  });
});
