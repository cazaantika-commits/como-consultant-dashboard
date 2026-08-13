import { describe, expect, it } from "vitest";
import { calculateEscrowSettlement } from "../client/src/lib/escrowSettlement";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";

describe("calculateEscrowSettlement", () => {
  it("retains five percent of buyer collections, covers later obligations, and closes at zero in month thirteen", () => {
    const baseline = [0, 500, 700, 685, 670];
    const result = calculateEscrowSettlement({
      cumulativeWithoutLiquidation: baseline,
      firstLiquidationIndex: 2,
      finalLiquidationIndex: 4,
      actualSalesCashInflow: [800],
    });

    expect(result.retainedSalesAmount).toBe(40);
    expect(result.firstLiquidation).toBe(660);
    expect(result.finalLiquidation).toBe(10);
    expect(baseline[4] - result.firstLiquidation - result.finalLiquidation).toBe(0);
  });

  it("does not classify buyer collections held in escrow as direct investor revenue before settlement", () => {
    const result = computeInvestorCashFlow(null, "offplan_escrow", undefined, {
      escrowData: [{ month: 1, units: 1, income: 100, downPayment: 10, installments: 90, withdrawal: 0, balance: 0, cumulativeSold: 1 }],
      salesDistribution: [1],
      actualCashInflow: [100],
      offplanPct: 80,
    });

    expect(result.rows.some((row) => row.label.startsWith("Monthly Revenue M"))).toBe(false);
    expect(result.rows.filter((row) => row.label.includes("تصفية حساب الضمان"))).toHaveLength(2);
    const directSalesRow = result.rows.find((row) => row.label.includes("مبيعات مباشرة بعد الإنجاز"));
    const expectedMonthlyDirectSale = (directSalesRow?.totalCost || 0) / 6;
    expect(directSalesRow?.postConstructionMonths.slice(0, 3)).toEqual([0, 0, 0]);
    expect(directSalesRow?.postConstructionMonths.slice(3, 9)).toEqual([
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
      expectedMonthlyDirectSale,
    ]);
    const directSalesCommission = result.rows.find((row) => row.label === "عمولة مبيعات مباشرة بعد الإنجاز");
    expect(directSalesCommission?.totalCost).toBe((directSalesRow?.totalCost || 0) * 0.05);
    expect(directSalesCommission?.postConstructionMonths.slice(3, 9)).toEqual(
      Array(6).fill((directSalesCommission?.totalCost || 0) / 6)
    );
  });

  it("uses each project’s configured direct-sale start month and equal installment count", () => {
    const result = computeInvestorCashFlow(null, "offplan_escrow", undefined, {
      escrowData: [{ month: 1, units: 1, income: 100, downPayment: 10, installments: 90, withdrawal: 0, balance: 0, cumulativeSold: 1 }],
      salesDistribution: [1],
      actualCashInflow: [100],
      offplanPct: 80,
      directSalesStartMonth: 2,
      directSalesInstallmentCount: 4,
    });

    const directSalesRow = result.rows.find((row) => row.label.includes("مبيعات مباشرة بعد الإنجاز"));
    const directSalesCommission = result.rows.find((row) => row.label === "عمولة مبيعات مباشرة بعد الإنجاز");
    const expectedRevenueInstallment = (directSalesRow?.totalCost || 0) / 4;
    const expectedCommissionInstallment = (directSalesCommission?.totalCost || 0) / 4;

    expect(directSalesRow?.postConstructionMonths.slice(0, 6)).toEqual([
      0,
      expectedRevenueInstallment,
      expectedRevenueInstallment,
      expectedRevenueInstallment,
      expectedRevenueInstallment,
      0,
    ]);
    expect(directSalesCommission?.postConstructionMonths.slice(0, 6)).toEqual([
      0,
      expectedCommissionInstallment,
      expectedCommissionInstallment,
      expectedCommissionInstallment,
      expectedCommissionInstallment,
      0,
    ]);
  });

  it("pays pre-completion sales commission only when actual buyer receipts reach 20 percent", () => {
    const result = computeInvestorCashFlow({
      preConMonths: 8,
      constructionMonths: 30,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      residential1brCount: 100,
      residential1brArea: 750,
      residential1brPrice: 1550,
      salesCommissionPct: 5,
    }, "offplan_escrow", undefined, {
      escrowData: [{ month: 9, units: 10, income: 100000, downPayment: 0, installments: 0, withdrawal: 0, balance: 0, cumulativeSold: 10 }],
      salesDistribution: [10],
      paymentPlan: {
        downPct: 10,
        secondPct: 5,
        secondAfterMonths: 2,
        duringTotalPct: 45,
        installmentEveryMonths: 3,
        handoverPct: 40,
      },
    });

    const commission = result.rows.find((row) => row.label === "عمولة المبيعات");
    expect(commission).toBeDefined();
    const allMonths = [
      ...commission!.designMonths,
      ...commission!.constructionMonths,
      ...commission!.postConstructionMonths,
    ];
    const paymentMonths = allMonths
      .map((amount, month) => ({ amount, month }))
      .filter(({ amount }) => amount > 0);

    // 10% is received at sale, 5% two months later, then the first 15%
    // installment takes receipts past the 20% trigger. The commission is not
    // payable before that actual receipt month.
    expect(paymentMonths).toHaveLength(1);
    expect(paymentMonths[0].month).toBe(13);
    expect(paymentMonths[0].amount).toBe(commission!.totalCost);
  });

  it("splits RERA-linked expenses between the first and second saved RERA months", () => {
    const project = {
      constructionMonths: 30,
      manualBuaSqft: 100000,
      estimatedConstructionPricePerSqft: 400,
      gfaResidentialSqft: 90000,
      residential1brCount: 10,
      residential1brArea: 750,
      residential1brPrice: 1550,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: {
            mobilization: { durationWeeks: 2 }, concept: { durationWeeks: 4 }, schematic: { durationWeeks: 4 },
            dd: { durationWeeks: 6 }, authorities: { durationWeeks: 4 }, tender: { durationWeeks: 4 }, ifc: { durationWeeks: 2 },
          },
          projectPhases: {
            marketingPrep: { durationMonths: 2, startOffsetMonths: 0 },
            reraApprovals: { durationMonths: 2, startOffsetMonths: 1 },
            marketingLaunch: { durationMonths: 0, startOffsetMonths: 0 },
            salesStart: { durationMonths: 0, startOffsetMonths: 1 },
            construction: { durationMonths: 0, startOffsetMonths: 1 },
          },
        },
      }),
    };
    const result = computeInvestorCashFlow(project, "offplan_escrow");
    const designMonthOf = (label: string) => {
      const row = result.rows.find((item) => item.label === label);
      return row?.designMonths.findIndex((amount) => amount > 0);
    };

    // RERA begins in project/design month 5 and ends in month 6.
    expect(designMonthOf("رسوم الفرز")).toBe(4);
    expect(designMonthOf("رسوم NOC المطور")).toBe(4);
    expect(designMonthOf("تسجيل المشروع — ريرا")).toBe(4);
    expect(designMonthOf("تسجيل الوحدات — ريرا")).toBe(5);
    expect(designMonthOf("حساب الضمان (رسوم فتح)")).toBe(5);
    expect(designMonthOf("إيداع حساب الضمان (20%)")).toBe(5);
  });
});
