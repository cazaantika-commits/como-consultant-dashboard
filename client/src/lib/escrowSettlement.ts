export interface EscrowSettlementInput {
  cumulativeWithoutLiquidation: number[];
  firstLiquidationIndex: number;
  finalLiquidationIndex: number;
  actualSalesCashInflow: number[];
}

export interface EscrowSettlementResult {
  firstLiquidation: number;
  finalLiquidation: number;
  retainedSalesAmount: number;
}

type EscrowBalanceRow = {
  label: string;
  funder: string;
  isRevenue?: boolean;
  isTransfer?: boolean;
  designMonths: number[];
  constructionMonths: number[];
  postConstructionMonths: number[];
};

type EscrowBalanceSalesResult = {
  actualCashInflow?: number[];
  actualEscrowCashInflow?: number[];
  escrowData?: Array<{ month: number; income: number }>;
};

export interface EscrowMonthlyBalanceInput {
  rows: EscrowBalanceRow[];
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
  salesResult?: EscrowBalanceSalesResult;
}

export interface EscrowMonthlyBalanceResult {
  depositLabel: string;
  depositValues: number[];
  salesIncomeValues: number[];
  inflowTotals: number[];
  regularOutflowTotals: number[];
  outflowTotals: number[];
  netFlow: number[];
  cumulativeWithoutLiquidation: number[];
  cumulative: number[];
  firstLiquidation: number;
  finalLiquidation: number;
}

export interface EscrowLiquidityAlertSummary {
  hasDeficit: boolean;
  firstDeficitIndex: number | null;
  firstDeficit: number;
  minimumBalanceIndex: number | null;
  minimumBalance: number;
}

/** Read-only liquidity signal derived only from the shared monthly escrow balance. */
export function summarizeEscrowLiquidity(cumulative: number[]): EscrowLiquidityAlertSummary {
  const firstDeficitIndex = cumulative.findIndex((value) => value < -0.5);
  const minimumBalance = cumulative.length > 0 ? Math.min(...cumulative) : 0;
  const minimumBalanceIndex = cumulative.length > 0 ? cumulative.indexOf(minimumBalance) : -1;
  return {
    hasDeficit: firstDeficitIndex >= 0,
    firstDeficitIndex: firstDeficitIndex >= 0 ? firstDeficitIndex : null,
    firstDeficit: firstDeficitIndex >= 0 ? cumulative[firstDeficitIndex] : 0,
    minimumBalanceIndex: minimumBalanceIndex >= 0 ? minimumBalanceIndex : null,
    minimumBalance,
  };
}

/**
 * Settles an off-plan escrow account under the approved cash-motion rule.
 * The first closure sends every available dirham except the 5% buyer-sales
 * retention to the investor. The month-13 closure sends that full retained
 * buyer-sales amount to the investor. Contractor final retention is an
 * investor-account debit and is deliberately never netted from this transfer.
 */
export function calculateEscrowSettlement({
  cumulativeWithoutLiquidation,
  firstLiquidationIndex,
  finalLiquidationIndex,
  actualSalesCashInflow,
}: EscrowSettlementInput): EscrowSettlementResult {
  const balanceAtFirstLiquidation = cumulativeWithoutLiquidation[firstLiquidationIndex] || 0;
  const retainedSalesAmount = actualSalesCashInflow.reduce((sum, value) => sum + value, 0) * 0.05;
  const firstLiquidation = Math.max(0, balanceAtFirstLiquidation - retainedSalesAmount);
  const finalLiquidation = Math.max(0, retainedSalesAmount);

  return { firstLiquidation, finalLiquidation, retainedSalesAmount };
}

/**
 * Builds the complete monthly account balance from the cash-flow engine rows.
 * It is intentionally shared by the Sales workspace and Escrow Cash Flow so a
 * month can never show two different account balances in the two reports.
 */
export function calculateEscrowMonthlyBalance({
  rows,
  designDuration,
  constructionDuration,
  postDuration,
  salesResult,
}: EscrowMonthlyBalanceInput): EscrowMonthlyBalanceResult {
  const totalMonths = designDuration + constructionDuration + postDuration;
  const valuesForRow = (row: EscrowBalanceRow) => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ].slice(0, totalMonths);
  const transferRow = rows.find((row) => row.isTransfer);
  const depositValues = new Array(totalMonths).fill(0);
  if (transferRow) {
    valuesForRow(transferRow).forEach((value, index) => { depositValues[index] = value || 0; });
  }

  const salesIncomeValues = new Array(totalMonths).fill(0);
  const rawEscrowReceipts = salesResult?.actualEscrowCashInflow?.length
    ? salesResult.actualEscrowCashInflow
    : salesResult?.actualCashInflow;
  if (rawEscrowReceipts?.length) {
    rawEscrowReceipts.slice(0, totalMonths).forEach((value, index) => {
      salesIncomeValues[index] = value || 0;
    });
  } else {
    for (const entry of salesResult?.escrowData || []) {
      const index = entry.month - 1;
      if (index >= 0 && index < totalMonths) salesIncomeValues[index] += entry.income || 0;
    }
  }

  const escrowOutflowRows = rows.filter((row) => row.funder === "escrow" && !row.isRevenue);
  const regularOutflowTotals = Array.from({ length: totalMonths }, (_, index) =>
    escrowOutflowRows.reduce((sum, row) => sum + (valuesForRow(row)[index] || 0), 0),
  );
  const inflowTotals = depositValues.map((value, index) => value + salesIncomeValues[index]);
  const cumulativeWithoutLiquidation = inflowTotals.map((inflow, index) => inflow - regularOutflowTotals[index]).reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] || 0) + value);
    return all;
  }, []);

  const postStartIndex = designDuration + constructionDuration;
  const firstLiquidationIndex = postStartIndex + 2;
  const finalLiquidationIndex = postStartIndex + 12;
  const settlementRows = rows.filter((row) => row.isRevenue && row.label.includes("تصفية حساب الضمان"));
  const firstSettlementRow = settlementRows.find((row) => row.label.includes("دفعة 1"));
  const finalSettlementRow = settlementRows.find((row) => row.label.includes("دفعة 2"));
  const firstLiquidation = firstSettlementRow ? (valuesForRow(firstSettlementRow)[firstLiquidationIndex] || 0) : 0;
  const finalLiquidation = finalSettlementRow ? (valuesForRow(finalSettlementRow)[finalLiquidationIndex] || 0) : 0;
  const outflowTotals = regularOutflowTotals.map((outflow, index) =>
    outflow + (index === firstLiquidationIndex ? firstLiquidation : 0) + (index === finalLiquidationIndex ? finalLiquidation : 0),
  );
  const netFlow = inflowTotals.map((inflow, index) => inflow - outflowTotals[index]);
  const cumulative = netFlow.reduce<number[]>((all, value) => {
    all.push((all[all.length - 1] || 0) + value);
    return all;
  }, []);

  return {
    depositLabel: transferRow?.label || "إيداع المستثمر",
    depositValues,
    salesIncomeValues,
    inflowTotals,
    regularOutflowTotals,
    outflowTotals,
    netFlow,
    cumulativeWithoutLiquidation,
    cumulative,
    firstLiquidation,
    finalLiquidation,
  };
}
