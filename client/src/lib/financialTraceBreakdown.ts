import { calculateInvestorMonthlyNet } from "@/lib/investorCashFlowNet";
import type { CashFlowResult, CostRow, SalesResult } from "@/lib/investorCashFlowEngine";

export type FinancialTraceLineItem = {
  name: string;
  value: number;
};

export type FinancialTraceBreakdown = {
  expenses: FinancialTraceLineItem[];
  receipts: FinancialTraceLineItem[];
  expenseTotal: number;
  receiptTotal: number;
  net: number;
};

const EPSILON = 0.000001;

function rowValues(row: CostRow): number[] {
  return [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths];
}

function valuesToItems(rows: CostRow[], monthIndex: number): FinancialTraceLineItem[] {
  return rows
    .map((row) => ({ name: row.label, value: Number(rowValues(row)[monthIndex]) || 0 }))
    .filter((item) => Math.abs(item.value) > EPSILON);
}

function sumItems(items: FinancialTraceLineItem[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

function mergeItems(groups: FinancialTraceLineItem[][]): FinancialTraceLineItem[] {
  const valuesByName = new Map<string, number>();
  for (const group of groups) {
    for (const item of group) valuesByName.set(item.name, (valuesByName.get(item.name) || 0) + item.value);
  }
  return [...valuesByName.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => Math.abs(item.value) > EPSILON);
}

export function combineFinancialTraceBreakdowns(
  details: Array<FinancialTraceBreakdown | undefined>,
): FinancialTraceBreakdown {
  const expenses = mergeItems(details.map((detail) => detail?.expenses || []));
  const receipts = mergeItems(details.map((detail) => detail?.receipts || []));
  const expenseTotal = sumItems(expenses);
  const receiptTotal = sumItems(receipts);
  return { expenses, receipts, expenseTotal, receiptTotal, net: receiptTotal - expenseTotal };
}

/**
 * Builds a display-only trace from the exact rows used in "صافي الشهر".
 * It does not alter the financial engine or produce a second calculation path.
 */
export function buildInvestorMonthlyTrace(
  cashFlow: CashFlowResult,
  salesResult?: SalesResult,
): FinancialTraceBreakdown[] {
  const monthlyNet = calculateInvestorMonthlyNet(cashFlow, salesResult);
  return monthlyNet.netFlow.map((net, monthIndex) => {
    const expenses = valuesToItems(monthlyNet.debitRows, monthIndex);
    const receipts = valuesToItems(monthlyNet.creditRows, monthIndex);
    return {
      expenses,
      receipts,
      expenseTotal: monthlyNet.debitTotals[monthIndex] || 0,
      receiptTotal: monthlyNet.creditTotals[monthIndex] || 0,
      net,
    };
  });
}

/** The exact unpaid investor debit rows used in the Capital Portfolio monthly funding view. */
export function buildInvestorMonthlyFundingTrace(cashFlow: CashFlowResult): FinancialTraceBreakdown[] {
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const fundingRows = cashFlow.rows.filter((row) =>
    !row.isRevenue && !row.isProfitAllocation && row.funder === "investor" && !(row.paid > 0 && row.unpaid === 0),
  );

  return Array.from({ length: totalMonths }, (_, monthIndex) => {
    const expenses = valuesToItems(fundingRows, monthIndex);
    const expenseTotal = sumItems(expenses);
    return { expenses, receipts: [], expenseTotal, receiptTotal: 0, net: -expenseTotal };
  });
}
