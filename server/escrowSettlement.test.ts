import { describe, expect, it } from "vitest";
import { calculateEscrowMonthlyBalance, calculateEscrowSettlement, summarizeEscrowLiquidity } from "../client/src/lib/escrowSettlement";
import { calculateDirectSaleProfitAllocation, calculateEscrowProfitAllocation, calculateInvestorCapitalSummary, calculateSequentialInvestorProfitAllocation, computeInvestorCashFlow, type CashFlowResult } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";
import { buildDefaultOffPlanSalesResult, buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";

describe("calculateEscrowSettlement", () => {
  it("pays broker commission, then restores capital before splitting direct villa-sale profit", () => {
    const allocation = calculateDirectSaleProfitAllocation([10_000_000, 10_000_000], [500_000, 500_000], 17_000_000, 15);

    expect(allocation.developerShares).toEqual([0, 300_000]);
    expect(allocation.investorProfitShares).toEqual([0, 1_700_000]);
    expect(allocation.totalDeveloperShare).toBe(300_000);
    expect(allocation.totalInvestorProfit).toBe(1_700_000);
  });

  it("reimburses the investor before splitting each escrow-release surplus with COMO", () => {
    const allocation = calculateEscrowProfitAllocation(
      47_180_091,
      41_572_742,
      2_108_552,
      15,
    );

    expect(allocation.firstSettlementProfit).toBe(5_607_349);
    expect(allocation.firstDeveloperShare).toBe(841_102.35);
    expect(allocation.finalSettlementProfit).toBe(2_108_552);
    expect(allocation.finalDeveloperShare).toBe(316_282.8);
    expect(allocation.totalDeveloperShare).toBe(1_157_385.15);
  });

  it("transfers the full final buyer-sales retention and pays contractor retention separately before splitting its surplus", () => {
    const allocation = calculateSequentialInvestorProfitAllocation({
      investorDebits: [400, 0, 50],
      investorReceipts: [500, 0, 100],
      paidCapital: 0,
      developerSharePct: 15,
    });

    // The last 100 is the full escrow retention transfer; the 50 contractor
    // final retention is an investor debit in that same later month.
    expect(allocation.recoveredCapital).toEqual([400, 0, 50]);
    expect(allocation.realisedProfit).toEqual([100, 0, 50]);
    expect(allocation.developerShares).toEqual([15, 0, 7.5]);
    expect(allocation.endingUnrecoveredCapital).toBe(0);
  });

  it("identifies the first and deepest genuine liquidity deficit from the shared monthly escrow balance", () => {
    expect(summarizeEscrowLiquidity([0, 20, -10, -35, -5])).toEqual({
      hasDeficit: true,
      firstDeficitIndex: 2,
      firstDeficit: -10,
      minimumBalanceIndex: 3,
      minimumBalance: -35,
    });
  });
  it("uses the same default first buyer receipt as the interactive Off-Plan Sales workspace before a plan is saved", () => {
    const defaultPlan = buildDefaultOffPlanSalesResult({
      totalRevenue: 12_000_000,
      totalUnits: 80,
      salesStartMonth: 7,
      constructionStartMonth: 7,
      constructionMonths: 18,
      projectEndMonth: 24,
    });

    expect(defaultPlan.actualCashInflow?.[6]).toBeGreaterThan(0);
    expect(defaultPlan.escrowData[0].month).toBe(7);
    expect(defaultPlan.escrowData[0].income).toBe(defaultPlan.actualCashInflow?.[6]);
  });
  it("uses the engine rows and actual buyer collections as the only source of a displayed escrow balance", () => {
    const rows = [
      { label: "إيداع حساب الضمان (20%)", funder: "investor", isTransfer: true, designMonths: [100], constructionMonths: [0], postConstructionMonths: Array(13).fill(0) },
      { label: "مصروف إسكرو", funder: "escrow", designMonths: [10], constructionMonths: [20], postConstructionMonths: Array(13).fill(0) },
      { label: "تصفية حساب الضمان (دفعة 1)", funder: "investor", isRevenue: true, designMonths: [0], constructionMonths: [0], postConstructionMonths: Array.from({ length: 13 }, (_, index) => index === 2 ? 117.5 : 0) },
      { label: "تصفية حساب الضمان (دفعة 2 - احتجاز المبيعات بالكامل)", funder: "investor", isRevenue: true, designMonths: [0], constructionMonths: [0], postConstructionMonths: Array.from({ length: 13 }, (_, index) => index === 12 ? 2.5 : 0) },
    ];
    const balance = calculateEscrowMonthlyBalance({
      rows,
      designDuration: 1,
      constructionDuration: 1,
      postDuration: 13,
      salesResult: {
        actualCashInflow: [0, 50],
        // A legacy presentation balance must never affect the shared balance.
        escrowData: [{ month: 2, income: 999_999, balance: -999_999 } as any],
      },
    });

    expect(balance.depositValues.slice(0, 2)).toEqual([100, 0]);
    expect(balance.salesIncomeValues.slice(0, 2)).toEqual([0, 50]);
    expect(balance.cumulativeWithoutLiquidation.slice(0, 2)).toEqual([90, 120]);
    expect(balance.cumulative[balance.cumulative.length - 1]).toBe(0);
  });
  it("holds only five percent of buyer collections and transfers that full amount in month thirteen", () => {
    const baseline = [0, 500, 700, 700, 700];
    const result = calculateEscrowSettlement({
      cumulativeWithoutLiquidation: baseline,
      firstLiquidationIndex: 2,
      finalLiquidationIndex: 4,
      actualSalesCashInflow: [800],
    });

    expect(result.retainedSalesAmount).toBe(40);
    expect(result.firstLiquidation).toBe(660);
    expect(result.finalLiquidation).toBe(40);
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

  it("uses one direct-receipt row when the saved plan already provides an investor channel", () => {
    const result = computeInvestorCashFlow(null, "offplan_escrow", undefined, {
      escrowData: [{ month: 1, units: 1, income: 100, downPayment: 10, installments: 90, withdrawal: 0, balance: 0, cumulativeSold: 1 }],
      salesDistribution: [1],
      actualEscrowCashInflow: [100],
      actualInvestorCashInflow: [0, 0, 0, 0, 75],
      offplanPct: 80,
    });

    const directRows = result.rows.filter((row) => row.isRevenue && row.label.includes("تحصيلات مبيعات مباشرة"));
    expect(directRows).toHaveLength(1);
    expect(directRows[0].totalCost).toBeGreaterThanOrEqual(75);
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
    expect(paymentMonths[0].month).toBe(11);
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

  it("keeps Build-for-Rent free of sale-specific regulatory fees, sales, and escrow rows", () => {
    const result = computeInvestorCashFlow({
      constructionMonths: 3,
      manualBuaSqft: 10_000,
      estimatedConstructionPricePerSqft: 400,
      residential1brCount: 10,
      residential1brArea: 750,
      residential1brPrice: 1_500,
    }, "build_for_rent");

    const labels = result.rows.map((row) => row.label);
    expect(labels).not.toContain("رسوم الفرز");
    expect(labels).not.toContain("رسوم NOC المطور");
    expect(labels).not.toContain("تسجيل الوحدات — دائرة الأراضي والأملاك");
    expect(result.rows.some((row) => row.funder === "escrow")).toBe(false);
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

    const sorting = result.rows.find((row) => row.label === "رسوم الفرز")!;
    const noc = result.rows.find((row) => row.label === "رسوم NOC المطور")!;
    expect(sorting.designMonths.reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(noc.designMonths.reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(sorting.constructionMonths[1]).toBe(sorting.totalCost);
    expect(noc.constructionMonths[1]).toBe(noc.totalCost);

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
    const comoAllocation = result.rows.find((row) => row.label.includes("حصة كومو"))!;
    const projectSpendBeforeAllocation = result.rows
      .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation && row.funder === "investor")
      .reduce((sum, row) => sum + row.totalCost, 0);
    expect(comoAllocation.isProfitAllocation).toBe(true);
    expect(calculateInvestorCapitalSummary(result).investorProjectSpend).toBe(projectSpendBeforeAllocation);
  });

  it("uses saved build-for-sale direct receipts for investor revenue and parallel commission timing", () => {
    const expectedRevenue = 10 * 750 * 5000;
    const result = computeInvestorCashFlow({
      financingScenario: "build_for_sale",
      preConMonths: 2,
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      residential1brCount: 10,
      residential1brArea: 750,
      residential1brPrice: 5000,
    }, "build_for_sale", undefined, {
      escrowData: [],
      salesDistribution: [3, 7],
      actualCashInflow: [
        ...Array(10).fill(0),
        expectedRevenue * 0.3,
        expectedRevenue * 0.7,
      ],
    });

    const sales = result.rows.find((row) => row.label === "إيرادات المبيعات")!;
    const commission = result.rows.find((row) => row.label.includes("بعد تحصيل كامل"))!;
    const comoShare = result.rows.find((row) => row.label.includes("حصة كومو"))!;

    expect(sales.postConstructionMonths.slice(0, 3)).toEqual([
      expectedRevenue * 0.3,
      expectedRevenue * 0.7,
      0,
    ]);
    expect(commission.postConstructionMonths.slice(0, 3)).toEqual([
      expectedRevenue * 0.3 * 0.05,
      expectedRevenue * 0.7 * 0.05,
      0,
    ]);
    expect(comoShare.postConstructionMonths[0]).toBe(0);
    expect(comoShare.postConstructionMonths[1]).toBe(comoShare.totalCost);
  });

  it("uses the saved RERA or DLD unit-registration fee for every project type", () => {
    const result = computeInvestorCashFlow({
      financingScenario: "build_for_sale",
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      residential1brCount: 4,
      residential1brArea: 750,
      residential1brPrice: 5000,
      constructionScheduleJson: JSON.stringify({
        settings: { configurableRates: { reraUnitRegistrationFee: 520 } },
      }),
    }, "build_for_sale");

    const unitRegistration = result.rows.find((row) => row.label === "تسجيل الوحدات — دائرة الأراضي والأملاك")!;
    expect(unitRegistration.totalCost).toBe(4 * 520);
    expect(unitRegistration.constructionMonths[1]).toBe(4 * 520);
  });

  it("uses the saved seven design-stage percentages and durations for monthly design fees", () => {
    const stages = {
      mobilization: { pct: 5, durationWeeks: 1 },
      concept: { pct: 5, durationWeeks: 1 },
      schematic: { pct: 5, durationWeeks: 1 },
      dd: { pct: 5, durationWeeks: 1 },
      authorities: { pct: 5, durationWeeks: 1 },
      tender: { pct: 35, durationWeeks: 1 },
      ifc: { pct: 40, durationWeeks: 1 },
    };
    const result = computeInvestorCashFlow({
      financingScenario: "build_for_sale",
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
      designFeePct: 2,
      constructionScheduleJson: JSON.stringify({ settings: { designPayments: stages } }),
    }, "build_for_sale");

    const designFee = result.rows.find((row) => row.label === "أتعاب التصاميم")!;
    expect(designFee.designMonths).toHaveLength(2);
    expect(designFee.designMonths[0]).toBeCloseTo(designFee.totalCost * 0.2165, 6);
    expect(designFee.designMonths[1]).toBeCloseTo(designFee.totalCost * 0.7835, 6);
  });

  it("uses the saved escrow-deposit percentage in both the investor transfer and the escrow settlement", () => {
    const baseProject = {
      financingScenario: "offplan_escrow",
      constructionMonths: 3,
      manualBuaSqft: 10000,
      estimatedConstructionPricePerSqft: 400,
    };
    const withTwentyPct = computeInvestorCashFlow({
      ...baseProject,
      constructionScheduleJson: JSON.stringify({ settings: { configurableRates: { escrowDepositPct: 20 } } }),
    }, "offplan_escrow");
    const withTwentyFivePct = computeInvestorCashFlow({
      ...baseProject,
      constructionScheduleJson: JSON.stringify({ settings: { configurableRates: { escrowDepositPct: 25 } } }),
    }, "offplan_escrow");

    const getRow = (result: CashFlowResult, label: string) => result.rows.find((row) => row.label === label)!;
    const getDeposit = (result: CashFlowResult) => result.rows.find((row) => row.label.startsWith("إيداع حساب الضمان"))!;
    const deposit20 = getDeposit(withTwentyPct);
    const deposit25 = getDeposit(withTwentyFivePct);
    const settlement20 = getRow(withTwentyPct, "تصفية حساب الضمان (دفعة 1)");
    const settlement25 = getRow(withTwentyFivePct, "تصفية حساب الضمان (دفعة 1)");

    expect(deposit25.label).toBe("إيداع حساب الضمان (25%)");
    expect(deposit25.totalCost).toBe(10000 * 400 * 0.25);
    expect(deposit25.totalCost - deposit20.totalCost).toBe(10000 * 400 * 0.05);
    expect(settlement25.totalCost - settlement20.totalCost).toBe(10000 * 400 * 0.05);
  });

  it("rebases Build-for-Sale receipts to the current completion month when a saved plan used an earlier design duration", () => {
    const previousDesignMonths = 7;
    const constructionMonths = 14;
    const previousProjectEnd = previousDesignMonths + constructionMonths;
    const receiptWeights = [18_620_000, 37_240_000, 18_620_000];
    const savedPlan = {
      designMonths: previousDesignMonths,
      constructionMonths,
      resultsJson: JSON.stringify({
        actualCashInflowVersion: 2,
        actualCashInflow: [
          ...Array(previousProjectEnd).fill(0),
          ...receiptWeights,
        ],
        buildForSaleMonthlyUnits: [1, 2, 1],
      }),
      salesAbsorptionJson: JSON.stringify({ buildForSaleMonthlyUnits: [1, 2, 1] }),
    };
    const currentProject = {
      financingScenario: "build_for_sale",
      constructionMonths,
      constructionScheduleJson: JSON.stringify({
        settings: {
          designPayments: {
            mobilization: { pct: 5, durationWeeks: 1 },
            concept: { pct: 15, durationWeeks: 2 },
            schematic: { pct: 20, durationWeeks: 3 },
            dd: { pct: 25, durationWeeks: 4 },
            authorities: { pct: 10, durationWeeks: 3 },
            tender: { pct: 15, durationWeeks: 3 },
            ifc: { pct: 10, durationWeeks: 1 },
          },
        },
      }),
    };

    const sales = buildSalesResultFromSavedPlan(savedPlan, currentProject, "build_for_sale")!;
    const currentProjectEnd = 4 + constructionMonths;
    expect(sales.actualCashInflow?.slice(currentProjectEnd, currentProjectEnd + 3)).toEqual(receiptWeights);
    expect(sales.actualCashInflow?.slice(previousProjectEnd, previousProjectEnd + 3)).not.toEqual(receiptWeights);
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
    expect(labels).not.toContain("رسوم الفرز");
    expect(labels).not.toContain("رسوم NOC المطور");
    expect(labels).not.toContain("تسجيل الوحدات — دائرة الأراضي والأملاك");

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
