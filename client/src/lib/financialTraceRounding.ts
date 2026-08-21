export type TraceRoundingReconciliation = {
  displayedTotal: number;
  displayedLineItemsTotal: number;
  roundingDifference: number;
};

/**
 * Reconciles display-only whole-number rounding. It never changes source values;
 * any unavoidable difference is shown as a separate "تسوية التقريب" line.
 */
export function reconcileTraceRounding(
  items: Array<{ value: number }>,
  total: number,
): TraceRoundingReconciliation {
  const displayedTotal = Math.round(Math.abs(total));
  const displayedLineItemsTotal = items.reduce((sum, item) => sum + Math.round(Math.abs(item.value)), 0);
  return {
    displayedTotal,
    displayedLineItemsTotal,
    roundingDifference: displayedTotal - displayedLineItemsTotal,
  };
}
