import { calculateEscrowSettlement } from "@/lib/escrowSettlement";
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
 * Produces the same final “صافي الشهر” row shown in Investor Cash Flow.
 * This is the only permissible row for Project Aggregation.
 */
export function calculateInvestorMonthlyNet(
  cashFlow: CashFlowResult,
  fallbackSalesResult?: SalesResult,
): InvestorMonthlyNetResult {
  const getRowValues = (row: CostRow): number[] => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ];
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const postStartIndex = cashFlow.designDuration + cashFlow.constructionDuration;
  const firstSettlementIndex = postStartIndex + 2;
  const finalSettlementIndex = postStartIndex + 12;
  const escrowOutflows = cashFlow.rows.filter((row) => row.funder === "escrow" && !row.isRevenue);
  const transferRow = cashFlow.rows.find((row) => row.isTransfer);
  const depositValues = new Array(totalMonths).fill(0);
  if (transferRow) {
    getRowValues(transferRow).slice(0, totalMonths).forEach((value, index) => { depositValues[index] = value; });
  }

  const effectiveSalesResult = cashFlow.usedSalesResult || fallbackSalesResult;
  const salesIncomeValues = new Array(totalMonths).fill(0);
  const savedCashInflow = effectiveSalesResult?.actualCashInflow;
  if (savedCashInflow && savedCashInflow.length > 0) {
    savedCashInflow.slice(0, totalMonths).forEach((value, index) => { salesIncomeValues[index] = value || 0; });
  } else {
    for (const entry of effectiveSalesResult?.escrowData || []) {
      const index = entry.month - 1;
      if (index >= 0 && index < totalMonths) salesIncomeValues[index] += entry.income;
    }
  }

  const cumulativeWithoutLiquidation = Array.from({ length: totalMonths }, (_, index) =>
    depositValues[index] + salesIncomeValues[index] - escrowOutflows.reduce((sum, row) => sum + (getRowValues(row)[index] || 0), 0),
  ).reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] || 0) + value);
    return all;
  }, []);
  const { firstLiquidation, finalLiquidation } = calculateEscrowSettlement({
    cumulativeWithoutLiquidation,
    firstLiquidationIndex: firstSettlementIndex,
    finalLiquidationIndex: finalSettlementIndex,
    actualSalesCashInflow: salesIncomeValues,
  });

  const settlementCredits = cashFlow.rows
    .filter((row) => row.isRevenue && row.label.includes("تصفية حساب الضمان"))
    .map((template) => {
      const isFirstSettlement = template.label.includes("دفعة 1");
      const monthIndex = isFirstSettlement ? firstSettlementIndex : finalSettlementIndex;
      const postConstructionMonths = new Array(cashFlow.postDuration).fill(0);
      postConstructionMonths[monthIndex - postStartIndex] = isFirstSettlement ? firstLiquidation : finalLiquidation;
      return {
        ...template,
        totalCost: isFirstSettlement ? firstLiquidation : finalLiquidation,
        investorAmount: isFirstSettlement ? firstLiquidation : finalLiquidation,
        paid: 0,
        unpaid: isFirstSettlement ? firstLiquidation : finalLiquidation,
        postConstructionMonths,
      };
    });

  const debitRows = cashFlow.rows.filter((row) => !row.isRevenue && row.funder === "investor" && !(row.paid > 0 && row.unpaid === 0));
  const creditRows = [
    ...cashFlow.rows.filter((row) => row.isRevenue && !row.label.includes("تصفية حساب الضمان")),
    ...settlementCredits,
  ];
  const paidRows = cashFlow.rows.filter((row) => row.paid > 0 && !row.isRevenue);
  const paidBeforeSchedule = paidRows.reduce((sum, row) => sum + row.paid, 0);
  const debitTotals = Array.from({ length: totalMonths }, (_, index) =>
    debitRows.reduce((sum, row) => sum + (getRowValues(row)[index] || 0), 0),
  );
  const creditTotals = Array.from({ length: totalMonths }, (_, index) => creditRows.reduce((sum, row) => sum + (getRowValues(row)[index] || 0), 0));
  const netFlow = debitTotals.map((debit, index) => creditTotals[index] - debit);
  const cumulative = netFlow.reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] ?? -paidBeforeSchedule) + value);
    return all;
  }, []);

  return { debitRows, creditRows, paidRows, paidBeforeSchedule, debitTotals, creditTotals, netFlow, cumulative };
}
