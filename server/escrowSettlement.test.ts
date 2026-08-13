import { describe, expect, it } from "vitest";
import { calculateEscrowSettlement } from "../client/src/lib/escrowSettlement";
import { calculateInvestorCapitalSummary, computeInvestorCashFlow, type CashFlowResult } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";

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

  it("pays every escrow-funded construction certificate one month after the corresponding work", () => {
    const project = {
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      constructionScheduleJson: JSON.stringify({ monthlyProgress: [10, 20, 70] }),
    };
    const result = computeInvestorCashFlow(project, "offplan_escrow");
    const contractorProgress = result.rows.find((row) => row.label.startsWith("مستخلصات المقاول"));

    expect(contractorProgress).toBeDefined();
    const progressTotal = contractorProgress!.totalCost;
    expect(contractorProgress!.constructionMonths).toEqual([
      0,
      progressTotal * 0.1,
      progressTotal * 0.2,
    ]);
    expect(contractorProgress!.postConstructionMonths[0]).toBe(progressTotal * 0.7);

    const investorAdvance = result.rows.find((row) => row.label === "دفعة مقدمة المقاول (10%)");
    expect(investorAdvance!.constructionMonths[0]).toBeGreaterThan(0);
  });

  it("uses saved quarterly RERA rates and the same payment count in Feasibility and Escrow Cash Flow", () => {
    const project = {
      constructionMonths: 30,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      constructionScheduleJson: JSON.stringify({
        settings: {
          configurableRates: {
            reraAuditorQuarterlyFee: 4500,
            reraInspectionQuarterlyFee: 18000,
          },
        },
      }),
    };
    const feasibility = calculateProjectCosts(project)!;
    const cashFlow = computeInvestorCashFlow(project, "offplan_escrow");
    const auditor = cashFlow.rows.find((row) => row.label === "تقرير مدقق ريرا")!;
    const inspection = cashFlow.rows.find((row) => row.label === "فحص ريرا")!;

    expect(auditor.totalCost).toBe(45000);
    expect(inspection.totalCost).toBe(180000);
    expect(auditor.constructionMonths.filter((amount) => amount > 0)).toEqual(Array(10).fill(4500));
    expect(inspection.constructionMonths.filter((amount) => amount > 0)).toEqual(Array(10).fill(18000));
    expect(feasibility.reraAuditReportFee).toBe(auditor.totalCost);
    expect(feasibility.reraInspectionReportFee).toBe(inspection.totalCost);
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
    expect(designMonthOf("تسجيل الوحدات — دائرة الأراضي والأملاك")).toBe(5);
    expect(designMonthOf("حساب الضمان (رسوم فتح)")).toBe(5);
    expect(designMonthOf("إيداع حساب الضمان (20%)")).toBe(5);
  });

  it("defines required capital as paid capital plus the maximum future investor deficit", () => {
    const empty = [0, 0];
    const cashFlow = {
      rows: [
        { label: "مدفوع سابقاً", totalCost: 100, investorAmount: 100, paid: 100, unpaid: 0, funder: "investor", section: "الأرض", designMonths: empty, constructionMonths: [], postConstructionMonths: [] },
        { label: "إيداع حساب الضمان (20%)", totalCost: 20, investorAmount: 20, paid: 0, unpaid: 20, funder: "investor", section: "الإنشاء", designMonths: [20, 0], constructionMonths: [], postConstructionMonths: [], isTransfer: true },
        { label: "مصروف المستثمر", totalCost: 30, investorAmount: 30, paid: 0, unpaid: 30, funder: "investor", section: "الإنشاء", designMonths: [0, 30], constructionMonths: [], postConstructionMonths: [] },
        { label: "مصروف الضمان", totalCost: 50, investorAmount: 0, paid: 0, unpaid: 50, funder: "escrow", section: "الإنشاء", designMonths: empty, constructionMonths: [], postConstructionMonths: [] },
        { label: "إيراد المستثمر", totalCost: 10, investorAmount: 10, paid: 0, unpaid: 10, funder: "investor", section: "الإيرادات", designMonths: [0, 10], constructionMonths: [], postConstructionMonths: [], isRevenue: true },
      ],
      designDuration: 2, constructionDuration: 0, postDuration: 0, monthDates: ["2026-01", "2026-02"],
    } as CashFlowResult;

    const summary = calculateInvestorCapitalSummary(cashFlow);
    expect(summary.paidCapital).toBe(100);
    expect(summary.remainingCapital).toBe(40);
    expect(summary.requiredCapital).toBe(140);
    expect(summary.investorProjectSpend).toBe(130);
    expect(summary.escrowProjectSpend).toBe(50);
    expect(summary.totalProjectSpend).toBe(180);
  });

  it("applies the approved build-for-sale rules without an escrow account", () => {
    const project = {
      financingScenario: "build_for_sale",
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      gfaResidentialSqft: 9000,
      residential1brCount: 10,
      residential1brArea: 750,
      residential1brPrice: 5000,
      constructionScheduleJson: JSON.stringify({
        monthlyProgress: [10, 20, 70],
        settings: {
          configurableRates: {
            buildForSaleMarketingRate: 2,
            buildForSaleMarketingStartMonthsBeforeCompletion: 1,
            buildForSaleMarketingDurationMonths: 3,
          },
        },
      }),
    };
    const result = computeInvestorCashFlow(project, "build_for_sale", undefined, {
      escrowData: [],
      salesDistribution: [],
      buildForSaleMonthlyUnits: [3, 7],
    });

    expect(result.rows.some((row) => row.label.includes("حساب الضمان"))).toBe(false);
    expect(result.rows.some((row) => row.label === "تسجيل المشروع — ريرا")).toBe(false);
    expect(result.rows.some((row) => row.label === "تقرير مدقق ريرا")).toBe(false);
    expect(result.rows.some((row) => row.funder === "escrow")).toBe(false);

    const contractor = result.rows.find((row) => row.label.startsWith("مستخلصات المقاول"))!;
    expect(contractor.funder).toBe("investor");
    expect(contractor.constructionMonths[0]).toBe(0);
    expect(contractor.postConstructionMonths[0]).toBeGreaterThan(0);

    const sales = result.rows.find((row) => row.label === "إيرادات المبيعات")!;
    const commission = result.rows.find((row) => row.label.includes("بعد تحصيل كامل"))!;
    const marketing = result.rows.find((row) => row.label === "التسويق")!;
    expect(sales.postConstructionMonths.slice(0, 2)).toEqual([
      sales.totalCost * 0.3,
      sales.totalCost * 0.7,
    ]);
    expect(commission.postConstructionMonths.slice(0, 2)).toEqual([
      commission.totalCost * 0.3,
      commission.totalCost * 0.7,
    ]);
    expect(marketing.totalCost).toBe(sales.totalCost * 0.02);
    expect(marketing.constructionMonths).toEqual([0, marketing.totalCost / 3, marketing.totalCost / 3]);
    expect(marketing.postConstructionMonths[0]).toBe(marketing.totalCost / 3);
    expect(result.rows.some((row) => row.label.includes("حصة كومو") && row.postConstructionMonths[1] > 0)).toBe(true);

    const feasibility = calculateProjectCosts({
      ...project,
      reraProjectRegFee: 150000,
      escrowAccountFee: 180000,
      bankFees: 35000,
      surveyorDwgFees: 12000,
    })!;
    expect(feasibility.reraProjectRegFee).toBe(0);
    expect(feasibility.escrowAccountFee).toBe(0);
    expect(feasibility.bankFees).toBe(0);
    expect(feasibility.reraAuditReportFee).toBe(0);
    expect(feasibility.reraInspectionReportFee).toBe(0);
    expect(feasibility.surveyorDwgFees).toBe(0);
    expect(feasibility.developerFee).toBe(feasibility.totalRevenue * 0.03);
    expect(feasibility.marketingCost).toBe(feasibility.totalRevenue * 0.02);
  });

  it("applies the approved build-for-rent rules with no sales, marketing, commissions, revenue, or escrow", () => {
    const project = {
      financingScenario: "build_for_rent",
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      gfaResidentialSqft: 9000,
      residential1brCount: 10,
      residential1brArea: 750,
      residential1brPrice: 5000,
      constructionScheduleJson: JSON.stringify({
        monthlyProgress: [10, 20, 70],
        settings: { configurableRates: { buildForRentDeveloperFeeDesignRate: 1.5, buildForRentDeveloperFeeSupervisionRate: 2.5 } },
      }),
    };
    const result = computeInvestorCashFlow(project, "build_for_rent");
    const labels = result.rows.map((row) => row.label);

    expect(labels.some((label) => label.includes("حساب الضمان"))).toBe(false);
    expect(labels.some((label) => label.includes("تسجيل المشروع — ريرا"))).toBe(false);
    expect(labels.some((label) => label.includes("إيرادات المبيعات"))).toBe(false);
    expect(labels.some((label) => label.includes("عمولة المبيعات"))).toBe(false);
    expect(labels).not.toContain("التسويق");
    expect(result.rows.some((row) => row.funder === "escrow")).toBe(false);
    expect(result.rows.find((row) => row.label.startsWith("مستخلصات المقاول"))?.funder).toBe("investor");
    expect(result.rows.find((row) => row.label === "تسجيل الوحدات — دائرة الأراضي والأملاك")?.constructionMonths[1]).toBeGreaterThan(0);

    const feasibility = calculateProjectCosts(project)!;
    expect(feasibility.totalRevenue).toBe(0);
    expect(feasibility.salesCommission).toBe(0);
    expect(feasibility.marketingCost).toBe(0);
    expect(feasibility.escrowAccountFee).toBe(0);
    expect(feasibility.bankFees).toBe(0);
    expect(feasibility.developerFee).toBe(160000);
    const developerFee = result.rows.find((row) => row.label === "أتعاب المطور")!;
    expect(developerFee.designMonths.reduce((sum, amount) => sum + amount, 0)).toBe(60000);
    expect(developerFee.constructionMonths.reduce((sum, amount) => sum + amount, 0)).toBe(100000);
  });

});
