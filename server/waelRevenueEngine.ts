/**
 * waelRevenueEngine.ts - Calculate monthly revenue from Wael sales plan data
 * 
 * Converts Wael sales plan (monthly sales distribution + payment plan) into
 * monthly cash inflow amounts for use in cash flow reports.
 */

export interface WaelRevenueInput {
  waelPlan: any; // waelSalesPlans row
  totalRevenue: number; // fallback total revenue
  totalMonths: number; // total project months
  phases: Array<{ type: string; startMonth: number; duration: number }>;
}

export function calculateWaelMonthlyRevenue(input: WaelRevenueInput): number[] {
  const { waelPlan, totalRevenue, totalMonths, phases } = input;
  const revenuePerMonth = new Array(totalMonths).fill(0);

  if (!waelPlan || !waelPlan.resultsJson) {
    return revenuePerMonth;
  }

  try {
    const results = JSON.parse(waelPlan.resultsJson);
    const salesDistribution = results.salesDistribution || [];

    if (!Array.isArray(salesDistribution) || salesDistribution.length === 0) {
      return revenuePerMonth;
    }

    // Parse payment plan percentages
    let ppDownPct = 10;
    let ppSecondPct = 0;
    let ppSecondAfterMonths = 0;
    let ppDuringTotal = 60;
    let ppInstallmentEvery = 1;
    let ppHandoverPct = 30;

    if (waelPlan.salesAbsorptionJson) {
      try {
        const absorption = JSON.parse(waelPlan.salesAbsorptionJson);
        ppDownPct = absorption.ppDownPct ?? 10;
        ppSecondPct = absorption.ppSecondPct ?? 0;
        ppSecondAfterMonths = absorption.ppSecondAfterMonths ?? 0;
        ppDuringTotal = absorption.ppDuringTotal ?? 60;
        ppInstallmentEvery = absorption.ppInstallmentEvery ?? 1;
        ppHandoverPct = absorption.ppHandoverPct ?? 30;
      } catch (e) {
        // Use defaults if parse fails
      }
    }

    // Calculate average unit price
    const planTotalRevenue = waelPlan.totalRevenue || totalRevenue;
    const totalUnits = salesDistribution.reduce((s: number, v: number) => s + v, 0);
    const avgUnitPrice = totalUnits > 0 ? planTotalRevenue / totalUnits : 0;

    // Get phase boundaries
    const constructionPhase = phases.find((p) => p.type === "construction");
    const handoverPhase = phases.find((p) => p.type === "handover");
    const designPhase = phases.find((p) => p.type === "design");

    const constructionEndMonth = constructionPhase
      ? constructionPhase.startMonth + constructionPhase.duration - 1
      : totalMonths - 3;

    const handoverStartMonth = handoverPhase ? handoverPhase.startMonth : totalMonths - 2;

    // Calculate sales start month
    // Sales typically start after design phase completes
    const designMonths = waelPlan.designMonths || 6;
    const salesStartMonth = (designPhase?.startMonth ?? 0) + designMonths;

    // Apply monthly sales distribution with payment plan
    for (let i = 0; i < salesDistribution.length; i++) {
      const saleMonth = salesStartMonth + i;
      if (saleMonth >= totalMonths) break;

      const unitsSold = salesDistribution[i] || 0;
      const saleAmount = unitsSold * avgUnitPrice;

      if (saleAmount <= 0) continue;

      // Down payment at sale month
      const downAmount = saleAmount * (ppDownPct / 100);
      if (saleMonth < totalMonths) {
        revenuePerMonth[saleMonth] += downAmount;
      }

      // Second payment
      if (ppSecondPct > 0) {
        const secondMonth = saleMonth + ppSecondAfterMonths;
        const secondAmount = saleAmount * (ppSecondPct / 100);
        if (secondMonth < totalMonths) {
          revenuePerMonth[secondMonth] += secondAmount;
        }
      }

      // Construction installments
      if (ppDuringTotal > 0) {
        const installmentTotal = saleAmount * (ppDuringTotal / 100);
        const installmentStart = saleMonth + 1;
        const installmentEnd = Math.min(constructionEndMonth, totalMonths - 1);
        const installmentMonths = Math.max(1, installmentEnd - installmentStart + 1);
        const monthlyInstallment = installmentTotal / installmentMonths;
        for (let m = installmentStart; m <= installmentEnd && m < totalMonths; m++) {
          revenuePerMonth[m] += monthlyInstallment;
        }
      }

      // Handover payment
      if (ppHandoverPct > 0) {
        const handoverAmount = saleAmount * (ppHandoverPct / 100);
        const hMonth = Math.min(handoverStartMonth, totalMonths - 1);
        if (hMonth < totalMonths) {
          revenuePerMonth[hMonth] += handoverAmount;
        }
      }
    }

    return revenuePerMonth;
  } catch (e) {
    console.warn("Failed to parse Wael sales plan revenue data", e);
    return revenuePerMonth;
  }
}
