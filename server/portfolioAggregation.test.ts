import { describe, expect, it } from "vitest";
import {
  alignPortfolioMonthlyNetFlows,
  groupCalendarAlignedPortfolio,
} from "../client/src/lib/portfolioAggregation";
import {
  buildUnifiedGroupExecutiveSummary,
  buildUnifiedGroupCashFlow,
  buildUnifiedGroupLiquidity,
} from "../client/src/lib/unifiedGroupCashFlow";
import V2UnifiedGroupCashFlow from "../client/src/pages/V2UnifiedGroupCashFlow";
import ExecutiveCashFlowAlert from "../client/src/components/ExecutiveCashFlowAlert";
import fs from "node:fs";
import path from "node:path";
import { buildInvestorMonthlyTrace, combineFinancialTraceBreakdowns } from "../client/src/lib/financialTraceBreakdown";
import { reconcileTraceRounding } from "../client/src/lib/financialTraceRounding";
import type { CashFlowResult, CostRow } from "../client/src/lib/investorCashFlowEngine";

describe("Project Aggregation calendar-aligned net investor flows", () => {
  it("uses the real earliest and latest active months while preserving a zero month between them", () => {
    const portfolio = alignPortfolioMonthlyNetFlows([
      {
        projectId: 1,
        name: "مشروع أوف بلان",
        financingScenario: "offplan_escrow",
        startDate: "2026-08",
        monthDates: ["2026-08", "2026-09", "2026-10"],
        monthlyNet: [10_000, 0, 20_000],
      },
      {
        projectId: 2,
        name: "مشروع بناء للبيع",
        financingScenario: "build_for_sale",
        startDate: "2026-09",
        monthDates: ["2026-09", "2026-10"],
        monthlyNet: [-5_000, 7_000],
      },
    ]);

    expect(portfolio.monthDates).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(portfolio.rows[0].values).toEqual([10_000, 0, 20_000]);
    expect(portfolio.rows[1].values).toEqual([0, -5_000, 7_000]);
    expect(portfolio.totals).toEqual([10_000, -5_000, 27_000]);
  });

  it("sums only adjacent named calendar months for each grouping option without changing source values", () => {
    const portfolio = alignPortfolioMonthlyNetFlows([
      {
        projectId: 1,
        name: "مشروع أول",
        financingScenario: "offplan_escrow",
        startDate: "2026-08",
        monthDates: ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"],
        monthlyNet: [10, 0, 20, 0, 0, 0, 30],
      },
      {
        projectId: 2,
        name: "مشروع ثان",
        financingScenario: "build_for_rent",
        startDate: "2026-09",
        monthDates: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"],
        monthlyNet: [5, 5, 5, 5, 5, 5],
      },
    ]);

    const quarterly = groupCalendarAlignedPortfolio(portfolio, 3);
    expect(quarterly.periods.map((period) => [period.startDate, period.endDate])).toEqual([
      ["2026-08", "2026-10"],
      ["2026-11", "2027-01"],
      ["2027-02", "2027-02"],
    ]);
    expect(quarterly.rows[0].values).toEqual([30, 0, 30]);
    expect(quarterly.rows[1].values).toEqual([10, 15, 5]);
    expect(quarterly.totals).toEqual([40, 15, 35]);

    const semiAnnual = groupCalendarAlignedPortfolio(portfolio, 6);
    expect(semiAnnual.periods.map((period) => [period.startDate, period.endDate])).toEqual([
      ["2026-08", "2027-01"],
      ["2027-02", "2027-02"],
    ]);
    expect(semiAnnual.totals).toEqual([55, 35]);
  });
});

describe("Unified Group Cash Flow copy-only aggregation", () => {
  const report = buildUnifiedGroupCashFlow([
    {
      projectId: 101,
      name: "مشروع بيع",
      financingScenario: "offplan_escrow",
      startDate: "2026-09",
      monthDates: ["2026-09", "2026-10", "2026-11"],
      monthlyDebit: [100, 0, 0],
      monthlyCredit: [0, 40, 0],
      monthlyNet: [-100, 40, 0],
      paidBeforeSchedule: 25,
      sourceKind: "investor_cash_flow",
      sourceLabel: "صف صافي الشهر النهائي من تدفقات المستثمر",
      includesOperatingCashFlows: false,
    },
    {
      projectId: 1,
      name: "مركز مجان التجاري (G+4)",
      financingScenario: "build_for_rent",
      startDate: "2026-09",
      monthDates: ["2026-09", "2026-10", "2026-11"],
      monthlyDebit: [30, 20, 10],
      monthlyCredit: [0, 0, 0],
      monthlyNet: [-30, -20, -10],
      paidBeforeSchedule: 5,
      sourceKind: "commercial_development",
      sourceLabel: "صف تدفقات تطوير المركز التجاري قبل التشغيل",
      scopeNote: "يشمل تكاليف التطوير المعتمدة فقط؛ لا توجد توقعات إيجار أو مصروفات تشغيل في هذا التقرير.",
      includesOperatingCashFlows: false,
    },
  ]);

  it("copies each final source cell, including Commercial Center development spending, without creating rental credits", () => {
    expect(report.rows.find((row) => row.projectId === 101)?.values).toEqual([-100, 40, 0]);
    expect(report.rows.find((row) => row.projectId === 1)?.values).toEqual([-30, -20, -10]);
    expect(report.rows.find((row) => row.projectId === 1)?.creditValues).toEqual([0, 0, 0]);
    expect(report.rows.find((row) => row.projectId === 1)?.sourceKind).toBe("commercial_development");
    expect(report.rows.find((row) => row.projectId === 1)?.includesOperatingCashFlows).toBe(false);
    expect(report.paidBeforeScheduleTotal).toBe(30);
  });

  it("sets group totals to the exact monthly sum and starts future cumulative funding at the first visible month", () => {
    expect(report.totals).toEqual([-130, 20, -10]);
    expect(report.cumulativeTotals).toEqual([-130, -110, -120]);
    report.monthDates.forEach((_, index) => {
      expect(report.totals[index]).toBe(report.rows.reduce((sum, row) => sum + row.values[index], 0));
    });
  });

  it("derives the decision view from the report rows only", () => {
    const liquidity = buildUnifiedGroupLiquidity(report, { horizon: 3, asOfMonth: "2026-09" });
    expect(liquidity.months.map((month) => month.total)).toEqual([-130, 20, -10]);
    expect(liquidity.months.map((month) => [month.spend, month.receipts])).toEqual([[130, 0], [20, 40], [10, 0]]);
    expect(liquidity.summary).toEqual({ required: 140, returned: 20, netFunding: 120 });
    expect(liquidity.months[0].drivers.map((driver) => driver.projectId)).toEqual([101, 1]);
  });

  it("separates paid previously from new funding while preserving the peak-capital equation", () => {
    const executive = buildUnifiedGroupExecutiveSummary(report);
    expect(executive.paidBefore).toBe(30);
    expect(executive.remainingNewFunding).toBe(130);
    expect(executive.peakCapital).toBe(160);
    expect(executive.peakMonthDate).toBe("2026-09");
    expect(executive.firstRecoveryMonthDate).toBe("2026-10");
    expect(executive.totalSpend).toBe(190);
    expect(executive.totalReceipts).toBe(40);
    expect(executive.recycledCash).toBe(30);
    expect(executive.closingNet).toBe(-150);
    expect(executive.projectsAtPeak.map((project) => [project.projectId, project.capitalAtGroupPeak])).toEqual([[101, 125], [1, 35]]);
    expect(executive.projectsAtPeak.reduce((sum, project) => sum + project.capitalAtGroupPeak, 0)).toBe(executive.peakCapital);
  });

  it("moves the peak month when the approved monthly source inputs change", () => {
    const shiftedReport = buildUnifiedGroupCashFlow([
      {
        projectId: 201,
        name: "مشروع متغير",
        financingScenario: "offplan_escrow",
        startDate: "2026-09",
        monthDates: ["2026-09", "2026-10", "2026-11"],
        monthlyDebit: [20, 20, 90],
        monthlyCredit: [0, 50, 0],
        monthlyNet: [-20, 30, -90],
        paidBeforeSchedule: 10,
        sourceKind: "investor_cash_flow",
        sourceLabel: "صف صافي الشهر النهائي من تدفقات المستثمر",
        includesOperatingCashFlows: false,
      },
    ]);

    expect(buildUnifiedGroupExecutiveSummary(shiftedReport).peakMonthDate).toBe("2026-11");
  });
});

describe("Consolidated report source trace", () => {
  const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

  it("keeps every consolidated report connected to the shared clickable source-trace dialog", () => {
    const traceSource = readSource("client/src/components/FinancialSourceTrace.tsx");
    const capitalSource = readSource("client/src/pages/V2CapitalPortfolio.tsx");
    const unifiedSource = readSource("client/src/pages/V2UnifiedGroupCashFlow.tsx");
    const commandCenterSource = readSource("client/src/components/ExecutiveCashFlowAlert.tsx");
    const cashFlowRouterSource = readSource("server/routers/cashFlowSettings.ts");

    expect(traceSource).toContain("مصدر الرقم");
    expect(traceSource).toContain("تفصيل التجميع");
    expect(traceSource).toContain("تفصيل بنود الحركة");
    expect(traceSource).toContain("التحصيلات − المصاريف = صافي الشهر");
    expect(capitalSource).toContain("FinancialSourceValue");
    expect(capitalSource).toContain("إجمالي الإيرادات");
    expect(capitalSource).toContain("التكلفة الكلية");
    expect(unifiedSource).toContain("FinancialSourceValue");
    expect(unifiedSource).toContain("تطوير قبل التشغيل");
    expect(unifiedSource).toContain("لا يعرض التقرير توقعات إيجار");
    expect(unifiedSource).toContain("المتبقي المطلوب منك حتى الذروة");
    expect(unifiedSource).toContain("معادلة رأس المال عند الذروة");
    expect(unifiedSource).toContain("تراكمي التمويل الجديد");
    expect(unifiedSource).toContain("أين يتركز رأس المال عند ذروة المجموعة؟");
    expect(unifiedSource).toContain("لماذا هذه هي الذروة؟");
    expect(unifiedSource).toContain("const isPeakMonth = executive.peakMonthDate === monthDate");
    expect(unifiedSource).toContain('id={isPeakMonth ? "unified-peak-month-row" : undefined}');
    expect(unifiedSource).toContain('data-testid={isPeakMonth ? "unified-peak-month-row" : undefined}');
    expect(unifiedSource).toContain("شهر الذروة");
    expect(commandCenterSource).toContain("getUnifiedGroupCashFlows");
    expect(commandCenterSource).toContain("buildUnifiedGroupLiquidity");
    expect(cashFlowRouterSource).toContain("getUnifiedGroupCashFlows");
    expect(cashFlowRouterSource).toContain('sourceKind: isCommercialDevelopment ? "commercial_development"');
    expect(cashFlowRouterSource).toContain("لا توجد توقعات إيجار أو مصروفات تشغيل في هذا التقرير");
  });

  it("compiles the Unified Group Cash Flow report and Command Center decision component", () => {
    expect(typeof V2UnifiedGroupCashFlow).toBe("function");
    expect(typeof ExecutiveCashFlowAlert).toBe("function");
  });

  it("fits the desktop monthly table inside a compact page without horizontal scrolling", () => {
    const unifiedSource = readSource("client/src/pages/V2UnifiedGroupCashFlow.tsx");
    expect(unifiedSource).toContain('lg:w-[75vw]');
    expect(unifiedSource).toContain('lg:overflow-x-hidden');
    expect(unifiedSource).toContain('table-fixed');
    expect(unifiedSource).toContain('className="w-[10.5%]"');
    expect(unifiedSource).toContain('className="w-[14%]"');
    expect(unifiedSource).toContain('className="w-[15%]"');
    expect(unifiedSource).toContain('return "ند الشبا 1"');
    expect(unifiedSource).toContain('return "مجان متعدد"');
  });

  it("keeps larger figures readable and the monthly column headers fixed while scrolling", () => {
    const unifiedSource = readSource("client/src/pages/V2UnifiedGroupCashFlow.tsx");
    expect(unifiedSource).toContain("text-[clamp(10px,0.66vw,12px)]");
    expect(unifiedSource).toContain("max-h-[72vh] overflow-auto");
    expect(unifiedSource).toContain("sticky right-0 top-0 z-40");
    expect(unifiedSource).toContain("sticky top-0 z-30");
  });

  it("keeps the Capital Portfolio transposed figures larger and its project header fixed", () => {
    const capitalSource = readSource("client/src/pages/V2CapitalPortfolio.tsx");
    expect(capitalSource).toContain('data-testid="capital-portfolio-transposed"');
    expect(capitalSource).toContain("text-[clamp(12px,0.9vw,14px)]");
    expect(capitalSource).toContain("max-h-[72vh] overflow-auto");
    expect(capitalSource).toContain("sticky top-0 z-40");
    expect(capitalSource).toContain("sticky top-0 z-30");
  });
});

describe("Financial source expense and receipt breakdown", () => {
  const row = (overrides: Partial<CostRow>): CostRow => ({
    label: "بند",
    totalCost: 0,
    investorAmount: 0,
    paid: 0,
    unpaid: 0,
    funder: "investor",
    section: "design",
    designMonths: [0],
    constructionMonths: [],
    postConstructionMonths: [],
    ...overrides,
  });

  it("shows the exact expense and receipt rows whose difference is the displayed net amount", () => {
    const cashFlow = {
      rows: [
        row({ label: "أتعاب التصميم", totalCost: 100, investorAmount: 100, unpaid: 100, designMonths: [100] }),
        row({ label: "تحصيل مبيعات", totalCost: 250, investorAmount: 250, unpaid: 250, isRevenue: true, designMonths: [250] }),
      ],
      designDuration: 1,
      constructionDuration: 0,
      postDuration: 0,
    } as unknown as CashFlowResult;

    const detail = buildInvestorMonthlyTrace(cashFlow)[0];
    expect(detail?.expenses).toEqual([{ name: "أتعاب التصميم", value: 100 }]);
    expect(detail?.receipts).toEqual([{ name: "تحصيل مبيعات", value: 250 }]);
    expect(detail?.expenseTotal).toBe(100);
    expect(detail?.receiptTotal).toBe(250);
    expect(detail?.net).toBe(150);

    const combined = combineFinancialTraceBreakdowns([detail, detail]);
    expect(combined.expenseTotal).toBe(200);
    expect(combined.receiptTotal).toBe(500);
    expect(combined.net).toBe(300);
  });

  it("states a display-only rounding reconciliation when rounded line items differ from the rounded source total", () => {
    const rounding = reconcileTraceRounding([{ value: 10.6 }, { value: 10.6 }], 21);
    expect(rounding.displayedLineItemsTotal).toBe(22);
    expect(rounding.displayedTotal).toBe(21);
    expect(rounding.roundingDifference).toBe(-1);
  });
});
