/**
 * waelRevenueEngine.ts - Extract monthly revenue from Wael sales plan data
 * 
 * Uses the pre-computed monthly revenue array from V2WaelSales (resultsJson.monthlyRevenue)
 * instead of recalculating it. This ensures consistency between the sales plan page
 * and all cash flow reports.
 */

export interface WaelRevenueInput {
  waelPlan: any; // waelSalesPlans row
  totalMonths: number; // total project months
}

export function calculateWaelMonthlyRevenue(input: WaelRevenueInput): number[] {
  const { waelPlan, totalMonths } = input;
  const revenuePerMonth = new Array(totalMonths).fill(0);

  if (!waelPlan || !waelPlan.resultsJson) {
    return revenuePerMonth;
  }

  try {
    const results = JSON.parse(waelPlan.resultsJson);
    
    // Use pre-computed actual cash inflow from V2WaelSales if available
    if (results.actualCashInflow && Array.isArray(results.actualCashInflow)) {
      for (let m = 0; m < Math.min(totalMonths, results.actualCashInflow.length); m++) {
        revenuePerMonth[m] = results.actualCashInflow[m] || 0;
      }
      return revenuePerMonth;
    }
    
    // Fallback: try old monthlyRevenue field for backward compatibility
    if (results.monthlyRevenue && Array.isArray(results.monthlyRevenue)) {
      for (let m = 0; m < Math.min(totalMonths, results.monthlyRevenue.length); m++) {
        revenuePerMonth[m] = results.monthlyRevenue[m] || 0;
      }
      return revenuePerMonth;
    }

    // Fallback: use escrowData if monthlyRevenue not available
    if (results.escrowData && Array.isArray(results.escrowData)) {
      for (let i = 0; i < results.escrowData.length; i++) {
        const escrowRow = results.escrowData[i];
        if (escrowRow && escrowRow.month >= 0 && escrowRow.month < totalMonths) {
          revenuePerMonth[escrowRow.month] = escrowRow.income || 0;
        }
      }
      return revenuePerMonth;
    }

    return revenuePerMonth;
  } catch (e) {
    console.warn("Failed to parse Wael sales plan revenue data", e);
    return revenuePerMonth;
  }
}
