import type { CashFlowResult, CostRow, SalesResult } from "@/lib/investorCashFlowEngine";

export type InvestorMonthlyNetResult = {
  debitRows: CostRow[];
  creditRows: CostRow[];
  paidRows: CostRow[];
  /** Amount already paid before the monthly schedule, carried as opening investor capital. */
  paidBeforeSchedule: number;
  debitTotals: number[];
  creditTotals: number[];
  /** Exact signed final row: positive means investor receipt; negative means investor funding required. */
  netFlow: number[];
  cumulative: number[];
};

/**
 * Produces the final “صافي الشهر” row shown in Investor Cash Flow.
 * The visible revenue rows, including both escrow-closure rows, are the only
 * credit source. This prevents a downstream settlement recalculation from
 * disagreeing with the cash movements displayed to the owner.
 */
export function calculateInvestorMonthlyNet(
  cashFlow: CashFlowResult,
  _fallbackSalesResult?: SalesResult,
): InvestorMonthlyNetResult {
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const debitRows = cashFlow.rows.filter((row) =>
    !row.isRevenue && row.funder === "investor" && !(row.paid > 0 && row.unpaid === 0),
  );
  const creditRows = cashFlow.rows.filter((row) => row.isRevenue);
  const paidRows = cashFlow.rows.filter((row) => row.paid > 0 && !row.isRevenue);
  const paidBeforeSchedule = paidRows.reduce((sum, row) => sum + row.paid, 0);
  const debitTotals = Array.from({ length: totalMonths }, (_, index) =>
    debitRows.reduce((sum, row) => sum + (getRowValues(row)[index] || 0), 0),
  );
  const creditTotals = Array.from({ length: totalMonths }, (_, index) =>
    creditRows.reduce((sum, row) => sum + (getRowValues(row)[index] || 0), 0),
  );
  const netFlow = debitTotals.map((debit, index) => creditTotals[index] - debit);
  const cumulative = netFlow.reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] ?? -paidBeforeSchedule) + value);
    return all;
  }, []);

  return { debitRows, creditRows, paidRows, paidBeforeSchedule, debitTotals, creditTotals, netFlow, cumulative };
}
