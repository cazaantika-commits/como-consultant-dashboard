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

/**
 * Settles the escrow account in two stages. The month-three transfer leaves
 * five percent of actual buyer collections, as well as any amount needed for
 * obligations falling due before month thirteen. The final transfer drains the
 * remaining balance at month thirteen.
 */
export function calculateEscrowSettlement({
  cumulativeWithoutLiquidation,
  firstLiquidationIndex,
  finalLiquidationIndex,
  actualSalesCashInflow,
}: EscrowSettlementInput): EscrowSettlementResult {
  const balanceAtFirstLiquidation = cumulativeWithoutLiquidation[firstLiquidationIndex] || 0;
  const lastRelevantIndex = Math.min(finalLiquidationIndex, cumulativeWithoutLiquidation.length - 1);
  const balancesUntilFinalSettlement = cumulativeWithoutLiquidation.slice(firstLiquidationIndex, lastRelevantIndex + 1);
  const minimumBalanceBeforeFinalSettlement = balancesUntilFinalSettlement.length > 0
    ? Math.min(...balancesUntilFinalSettlement)
    : 0;

  const reserveForPostCompletionObligations = Math.max(
    0,
    balanceAtFirstLiquidation - minimumBalanceBeforeFinalSettlement,
  );
  const retainedSalesAmount = actualSalesCashInflow.reduce((sum, value) => sum + value, 0) * 0.05;
  const reserveAtFirstLiquidation = Math.max(retainedSalesAmount, reserveForPostCompletionObligations);
  const firstLiquidation = Math.max(0, balanceAtFirstLiquidation - reserveAtFirstLiquidation);
  const balanceAtFinalSettlement = cumulativeWithoutLiquidation[finalLiquidationIndex] || 0;
  const finalLiquidation = Math.max(0, balanceAtFinalSettlement - firstLiquidation);

  return { firstLiquidation, finalLiquidation, retainedSalesAmount };
}
