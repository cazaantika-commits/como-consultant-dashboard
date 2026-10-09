import { calculateInvestorCapitalSummary, type CashFlowResult } from "@/lib/investorCashFlowEngine";

/** Stage-one development cash uses. No lease, opex or bank terms are inferred. */
export function buildRentalDevelopmentSummary(data: CashFlowResult) {
  const capital = calculateInvestorCapitalSummary(data);
  return {
    totalDevelopmentCost: data.grandTotalCost,
    assumedPriorContribution: capital.paidCapital,
    futureDevelopmentSpend: capital.remainingCapital,
    peakMonthDate: capital.peakMonthDate,
    canShowDevelopmentSpend: data.rows.some(row => row.section === "الإنشاء" && row.totalCost > 0),
    rentalCashFlowAvailable: false,
    cfads: null,
    dscr: null,
    requestedBankFinance: null,
  };
}
