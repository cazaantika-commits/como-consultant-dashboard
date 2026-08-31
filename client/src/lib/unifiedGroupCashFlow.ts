import type { FinancialTraceBreakdown } from "./financialTraceBreakdown";
import {
  alignPortfolioMonthlyNetFlows,
  type CalendarAlignedPortfolio,
  type CalendarAlignedRow,
  type PortfolioProjectMonthlyNet,
} from "./portfolioAggregation";

export type GroupCashFlowSourceKind = "investor_cash_flow" | "commercial_development";

/**
 * A source row prepared by the existing final project cash-flow engine.
 * This type intentionally contains no revenue, cost, escrow, or profit formula.
 */
export type GroupCashFlowProjectMonthlyNet = PortfolioProjectMonthlyNet & {
  /** Opening investor outflow copied from the project's final cash-flow report. */
  paidBeforeSchedule: number;
  /** Running balance copied from the project's final Investor Cash Flow report. */
  monthlyCumulative?: number[];
  /** Summary values already displayed by the project's final Investor Cash Flow report. */
  cashFlowSummary?: {
    requiredCapital: number;
    paidCapital: number;
    remainingCapital: number;
    totalInvestorPayments: number;
    totalInvestorReceipts: number;
    finalNet: number;
  };
  sourceKind: GroupCashFlowSourceKind;
  sourceLabel: string;
  scopeNote?: string;
  includesOperatingCashFlows: boolean;
};

export type UnifiedGroupCashFlowRow = CalendarAlignedRow & {
  sourceKind: GroupCashFlowSourceKind;
  sourceLabel: string;
  scopeNote?: string;
  includesOperatingCashFlows: boolean;
};

export type UnifiedGroupCashFlow = Omit<CalendarAlignedPortfolio, "rows"> & {
  rows: UnifiedGroupCashFlowRow[];
  projects: GroupCashFlowProjectMonthlyNet[];
  /** Sum of the distinct opening "مدفوع مسبقًا" source column across projects. */
  paidBeforeScheduleTotal: number;
};

export type UnifiedGroupLiquidityMonth = {
  monthDate: string;
  total: number;
  /** Signed net copied from sale/investment project rows for the month. */
  saleInvestmentNet: number;
  /** Signed net copied from Commercial Center development rows for the month. */
  commercialDevelopmentNet: number;
  spend: number;
  receipts: number;
  required: number;
  returned: number;
  netFunding: number;
  drivers: Array<{
    projectId: number;
    name: string;
    value: number;
    sourceKind: GroupCashFlowSourceKind;
  }>;
};

export type UnifiedGroupLiquidity = {
  months: UnifiedGroupLiquidityMonth[];
  summary: {
    required: number;
    returned: number;
    netFunding: number;
  };
  peakMonth: UnifiedGroupLiquidityMonth | null;
  peakKind: "required" | "returned" | null;
};

export type UnifiedGroupProjectFundingAtPeak = {
  projectId: number;
  name: string;
  sourceKind: GroupCashFlowSourceKind;
  paidBefore: number;
  monthlyNetToGroupPeak: number;
  capitalAtGroupPeak: number;
  shareOfGroupPeak: number;
};

export type UnifiedGroupExecutiveSummary = {
  paidBefore: number;
  remainingNewFunding: number;
  peakCapital: number;
  peakMonthDate: string | null;
  firstRecoveryMonthDate: string | null;
  totalSpend: number;
  totalReceipts: number;
  recycledCash: number;
  closingNet: number;
  projectsAtPeak: UnifiedGroupProjectFundingAtPeak[];
};

/**
 * Calendar-aligns and sums only the already-final monthly project rows supplied
 * by the caller. It never recalculates revenue, expenses, escrow, capital, or profit.
 */
export function buildUnifiedGroupCashFlow(
  projects: GroupCashFlowProjectMonthlyNet[],
): UnifiedGroupCashFlow {
  const aligned = alignPortfolioMonthlyNetFlows(projects);
  const projectById = new Map(projects.map((project) => [project.projectId, project]));
  const paidBeforeScheduleTotal = projects.reduce((sum, project) => sum + (Number(project.paidBeforeSchedule) || 0), 0);
  const cumulativeTotals = aligned.totals.reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] ?? 0) + value);
    return all;
  }, []);

  return {
    ...aligned,
    projects,
    paidBeforeScheduleTotal,
    cumulativeTotals,
    rows: aligned.rows.map((row) => {
      const source = projectById.get(row.projectId);
      return {
        ...row,
        sourceKind: source?.sourceKind || "investor_cash_flow",
        sourceLabel: source?.sourceLabel || "صف التدفق النهائي للمشروع",
        scopeNote: source?.scopeNote,
        includesOperatingCashFlows: Boolean(source?.includesOperatingCashFlows),
      };
    }),
  };
}

/**
 * Builds the executive capital view from the exact copied report cells.
 * "Paid previously" remains a separate opening component; the monthly running
 * balance begins at zero so its deepest deficit is the additional new funding
 * required after the visible schedule starts.
 */
export function buildUnifiedGroupExecutiveSummary(
  report: UnifiedGroupCashFlow,
): UnifiedGroupExecutiveSummary {
  let peakIndex = -1;
  let lowestFutureCumulative = 0;

  report.cumulativeTotals.forEach((value, index) => {
    if (value < lowestFutureCumulative) {
      lowestFutureCumulative = value;
      peakIndex = index;
    }
  });

  const paidBefore = report.paidBeforeScheduleTotal;
  const remainingNewFunding = Math.max(-lowestFutureCumulative, 0);
  const peakCapital = paidBefore + remainingNewFunding;
  const totalFutureSpend = report.debitTotals.reduce((sum, value) => sum + value, 0);
  const totalReceipts = report.creditTotals.reduce((sum, value) => sum + value, 0);
  const totalSpend = paidBefore + totalFutureSpend;
  const recycledCash = Math.max(Math.min(totalFutureSpend - remainingNewFunding, totalReceipts), 0);
  const closingNet = -paidBefore + report.totals.reduce((sum, value) => sum + value, 0);
  const firstRecoveryIndex = peakIndex >= 0
    ? report.cumulativeTotals.findIndex((value, index) => index > peakIndex && value > lowestFutureCumulative + 0.000001)
    : -1;

  const projectsAtPeak = report.rows
    .map((row) => {
      const source = report.projects.find((project) => project.projectId === row.projectId);
      const paidBeforeForProject = Number(source?.paidBeforeSchedule) || 0;
      const monthlyNetToGroupPeak = peakIndex >= 0
        ? row.values.slice(0, peakIndex + 1).reduce((sum, value) => sum + value, 0)
        : 0;
      const capitalAtGroupPeak = paidBeforeForProject - monthlyNetToGroupPeak;

      return {
        projectId: row.projectId,
        name: row.name,
        sourceKind: row.sourceKind,
        paidBefore: paidBeforeForProject,
        monthlyNetToGroupPeak,
        capitalAtGroupPeak,
        shareOfGroupPeak: peakCapital > 0 ? capitalAtGroupPeak / peakCapital : 0,
      };
    })
    .sort((left, right) => right.capitalAtGroupPeak - left.capitalAtGroupPeak);

  return {
    paidBefore,
    remainingNewFunding,
    peakCapital,
    peakMonthDate: peakIndex >= 0 ? report.monthDates[peakIndex] || null : null,
    firstRecoveryMonthDate: firstRecoveryIndex >= 0 ? report.monthDates[firstRecoveryIndex] || null : null,
    totalSpend,
    totalReceipts,
    recycledCash,
    closingNet,
    projectsAtPeak,
  };
}

function currentMonthDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A decision view derived from the completed group report. The calculation is
 * limited to selecting, sorting, and summing already-aligned report cells.
 */
export function buildUnifiedGroupLiquidity(
  report: UnifiedGroupCashFlow,
  options: { horizon?: number; asOfMonth?: string } = {},
): UnifiedGroupLiquidity {
  const horizon = options.horizon ?? 4;
  const asOfMonth = options.asOfMonth ?? currentMonthDate();
  const firstFutureIndex = report.monthDates.findIndex((monthDate) => monthDate >= asOfMonth);
  const startIndex = firstFutureIndex >= 0 ? firstFutureIndex : Math.max(report.monthDates.length - horizon, 0);

  const months = report.monthDates.slice(startIndex, startIndex + horizon).map((monthDate, offset) => {
    const index = startIndex + offset;
    const total = report.totals[index] || 0;
    const drivers = report.rows
      .map((row) => ({
        projectId: row.projectId,
        name: row.name,
        value: row.values[index] || 0,
        sourceKind: row.sourceKind,
      }))
      .filter((row) => Math.abs(row.value) > 0.000001)
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
    const saleInvestmentNet = drivers
      .filter((driver) => driver.sourceKind === "investor_cash_flow")
      .reduce((sum, driver) => sum + driver.value, 0);
    const commercialDevelopmentNet = drivers
      .filter((driver) => driver.sourceKind === "commercial_development")
      .reduce((sum, driver) => sum + driver.value, 0);

    return {
      monthDate,
      total,
      saleInvestmentNet,
      commercialDevelopmentNet,
      spend: report.debitTotals[index] || 0,
      receipts: report.creditTotals[index] || 0,
      required: Math.max(-total, 0),
      returned: Math.max(total, 0),
      netFunding: Math.max(-total, 0) - Math.max(total, 0),
      drivers,
    };
  });

  const summary = months.reduce(
    (accumulator, month) => ({
      required: accumulator.required + month.required,
      returned: accumulator.returned + month.returned,
      netFunding: accumulator.netFunding + month.netFunding,
    }),
    { required: 0, returned: 0, netFunding: 0 },
  );
  const hasRequired = months.some((month) => month.required > 0.000001);
  const peakMonth = months.reduce<UnifiedGroupLiquidityMonth | null>((peak, month) => {
    if (!peak) return month;
    const currentValue = hasRequired ? month.required : month.returned;
    const peakValue = hasRequired ? peak.required : peak.returned;
    return currentValue > peakValue ? month : peak;
  }, null);

  return {
    months,
    summary,
    peakMonth,
    peakKind: peakMonth ? (hasRequired ? "required" : "returned") : null,
  };
}

export type UnifiedGroupTrace = FinancialTraceBreakdown;
