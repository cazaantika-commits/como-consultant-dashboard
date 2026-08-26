/**
 * investorCashFlowEngine.ts
 * ═══════════════════════════════════════════
 * Shared computation engine for Investor Cash Flow Schedule.
 * Used by both InvestorCashFlowSchedulePage and ConsolidatedInvestorCashFlowPage
 * to guarantee identical numbers.
 * ═══════════════════════════════════════════
 */

import {
  PROJECT_INPUTS,
  RATES,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";
import {
  calculateCommunityFeeSchedule,
  getProjectCommunityFeeSettings,
} from "@/lib/communityFee";
import { getProjectMarketingTiming, getProjectReraQuarterlyFeeSettings } from "@/lib/projectTiming";
import { calculateEscrowSettlement } from "@/lib/escrowSettlement";
import { buildDefaultOffPlanSalesResult } from "@/lib/salesPlanCashFlow";
import {
  buildPaymentReceiptEvents,
  getPaymentPlanPostHandoverMonths,
  normalizeFlexiblePaymentPlan,
  type FlexiblePaymentPlan,
} from "@/lib/flexiblePaymentPlan";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
export type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan" | "build_for_sale" | "build_for_rent" | "rental";
export type Funder = "investor" | "escrow" | "split";

export interface CostRow {
  label: string;
  totalCost: number;
  investorAmount: number;
  paid: number;
  unpaid: number;
  funder: Funder;
  section: string;
  designMonths: number[];
  constructionMonths: number[];
  postConstructionMonths: number[];
  isRevenue?: boolean;
  isTransfer?: boolean;
  /** A post-sale profit allocation, which stays in the cash flow but is excluded from project costs and capital. */
  isProfitAllocation?: boolean;
}

export interface TimingRules {
  developerFeePct: number;
  developerFeeRetentionPct: number;
  developerFeeDelayMonths: number;
  developerFeeRetentionMonth: number;
  sortingFeeMonth: number;
  sortingFeePerSqft: number;
  salesCommissionPct: number;
  salesCommissionTriggerPct: number;
  surveyorAsbuiltMonthFromEnd: number;
  // Configurable per-payment amounts from settings
  reraAuditorQuarterlyFee: number;
  reraInspectionQuarterlyFee: number;
  communityFeePerSqft: number;
  communityFeeFrequency: number;
}

export const DEFAULT_TIMING_RULES: TimingRules = {
  developerFeePct: 15,
  developerFeeRetentionPct: 15,
  developerFeeDelayMonths: 1,
  developerFeeRetentionMonth: 13,
  sortingFeeMonth: 1,
  sortingFeePerSqft: 40,
  salesCommissionPct: 5,
  salesCommissionTriggerPct: 20,
  surveyorAsbuiltMonthFromEnd: 1,
  reraAuditorQuarterlyFee: 3500,
  reraInspectionQuarterlyFee: 15020,
  communityFeePerSqft: 0.25,
  communityFeeFrequency: 6,
};

export interface SalesResult {
  escrowData: Array<{
    month: number;
    units: number;
    income: number;
    downPayment: number;
    installments: number;
    withdrawal: number;
    balance: number;
    cumulativeSold: number;
  }>;
  salesDistribution: number[];
  marketingMonthlyAmounts?: number[]; // Monthly marketing amounts from marketing page (indexed from project month 1)
  ppDownPct?: number; // Down payment percentage from payment plan
  paymentPlan?: FlexiblePaymentPlan; // Exact staged buyer payment schedule saved from Sales Plan
  actualCashInflow?: number[]; // Actual monthly cash inflow from payment plan (indexed from project month 1)
  actualEscrowCashInflow?: number[]; // Buyer receipts routed to escrow (indexed from project month 1)
  actualInvestorCashInflow?: number[]; // Buyer receipts routed directly to investor (indexed from project month 1)
  offplanPct?: number; // Share of project revenue sold during construction and received through escrow
  directSalesStartMonth?: number; // Post-completion month for the first direct sale receipt
  directSalesInstallmentCount?: number; // Number of equal direct-sale receipts
  /** Build-for-sale only: units sold in each post-completion month, paid in full upon sale. */
  buildForSaleMonthlyUnits?: number[];
}

export interface CashFlowResult {
  rows: CostRow[];
  sections: string[];
  grandTotalCost: number;
  grandInvestor: number;
  grandPaid: number;
  grandUnpaid: number;
  designMonthlyTotals: number[];
  constructionMonthlyTotals: number[];
  postMonthlyTotals: number[];
  revenuePostTotals: number[];
  cumulativeDesign: number[];
  cumulativeConstruction: number[];
  cumulativePost: number[];
  designDuration: number;
  constructionDuration: number;
  postDuration: number;
  totalRevenue: number;
  monthDates: string[];
  startDate: string;
  usedSalesResult?: SalesResult;
}

export interface InvestorCapitalSummary {
  /** Capital already paid before the monthly investor schedule starts. */
  paidCapital: number;
  /** Largest remaining monthly funding deficit before later investor credits. */
  remainingCapital: number;
  /** Paid capital plus the maximum future funding deficit. */
  requiredCapital: number;
  /** Zero-based project-month index when funding reaches its peak. */
  peakMonthIndex: number;
  peakMonthDate: string;
  investorProjectSpend: number;
  escrowProjectSpend: number;
  totalProjectSpend: number;
}

export interface EscrowProfitAllocation {
  firstSettlementProfit: number;
  finalSettlementProfit: number;
  firstDeveloperShare: number;
  finalDeveloperShare: number;
  totalDeveloperShare: number;
}

/**
 * The first escrow release reimburses the investor's actual paid capital first.
 * Only the excess is realised profit. The final release is already net of the
 * contractor's retention, so it is realised profit in full.
 */
export function calculateEscrowProfitAllocation(
  firstEscrowTransfer: number,
  investorSpentBeforeFirstSettlement: number,
  finalEscrowTransfer: number,
  developerSharePct: number,
): EscrowProfitAllocation {
  const rate = Math.max(0, developerSharePct) / 100;
  const firstSettlementProfit = Math.max(0, firstEscrowTransfer - investorSpentBeforeFirstSettlement);
  const finalSettlementProfit = Math.max(0, finalEscrowTransfer);
  const firstDeveloperShare = firstSettlementProfit * rate;
  const finalDeveloperShare = finalSettlementProfit * rate;
  return {
    firstSettlementProfit,
    finalSettlementProfit,
    firstDeveloperShare,
    finalDeveloperShare,
    totalDeveloperShare: firstDeveloperShare + finalDeveloperShare,
  };
}

/**
 * Returns the monthly investor funding requirements used by the capital view.
 * Revenue and Como's post-sale profit allocation are intentionally excluded.
 */
export function calculateInvestorMonthlyFundingRequirements(cashFlow: CashFlowResult): number[] {
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const monthValues = (row: CostRow) => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ].slice(0, totalMonths);
  const futureInvestorDebitRows = cashFlow.rows.filter((row) =>
    !row.isRevenue && !row.isProfitAllocation && row.funder === "investor" && !(row.paid > 0 && row.unpaid === 0),
  );

  return Array.from({ length: totalMonths }, (_, month) =>
    futureInvestorDebitRows.reduce((sum, row) => sum + (monthValues(row)[month] || 0), 0),
  );
}

/**
 * Produces the investor-capital view from the same cash-flow rows used by the
 * Investor Cash Flow report. Escrow deposits remain capital requirements but
 * are excluded from project spending because they are transfers, not costs.
 */
export function calculateInvestorCapitalSummary(cashFlow: CashFlowResult): InvestorCapitalSummary {
  const totalMonths = cashFlow.designDuration + cashFlow.constructionDuration + cashFlow.postDuration;
  const monthValues = (row: CostRow) => [
    ...row.designMonths,
    ...row.constructionMonths,
    ...row.postConstructionMonths,
  ].slice(0, totalMonths);

  const paidCapital = cashFlow.rows
    .filter((row) => row.paid > 0 && !row.isRevenue)
    .reduce((sum, row) => sum + row.paid, 0);

  const futureInvestorDebitRows = cashFlow.rows.filter((row) =>
    !row.isRevenue && !row.isProfitAllocation && row.funder === "investor" && !(row.paid > 0 && row.unpaid === 0)
  );
  const investorCreditRows = cashFlow.rows.filter((row) => row.isRevenue && !row.label.includes("تصفية حساب الضمان"));

  // Match the two dynamic settlement credits displayed in Investor Cash Flow.
  // The engine's legacy settlement rows are only templates; their amounts must
  // be recalculated from the actual escrow inflows and outflows.
  const postStartIndex = cashFlow.designDuration + cashFlow.constructionDuration;
  const firstSettlementIndex = postStartIndex + 2;
  const finalSettlementIndex = postStartIndex + 12;
  const transferRow = cashFlow.rows.find((row) => row.isTransfer);
  const depositValues = transferRow ? monthValues(transferRow) : new Array(totalMonths).fill(0);
  const savedCashInflow = cashFlow.usedSalesResult?.actualCashInflow;
  const salesCashInflow = new Array(totalMonths).fill(0);
  if (savedCashInflow && savedCashInflow.length > 0) {
    savedCashInflow.slice(0, totalMonths).forEach((value, index) => { salesCashInflow[index] = value || 0; });
  } else {
    for (const entry of cashFlow.usedSalesResult?.escrowData || []) {
      const index = entry.month - 1;
      if (index >= 0 && index < totalMonths) salesCashInflow[index] += entry.income;
    }
  }
  const escrowOutflowRows = cashFlow.rows.filter((row) => row.funder === "escrow" && !row.isRevenue);
  const cumulativeWithoutLiquidation: number[] = [];
  let escrowRunningBalance = 0;
  for (let month = 0; month < totalMonths; month++) {
    const outflow = escrowOutflowRows.reduce((sum, row) => sum + (monthValues(row)[month] || 0), 0);
    escrowRunningBalance += (depositValues[month] || 0) + salesCashInflow[month] - outflow;
    cumulativeWithoutLiquidation.push(escrowRunningBalance);
  }
  const settlement = calculateEscrowSettlement({
    cumulativeWithoutLiquidation,
    firstLiquidationIndex: firstSettlementIndex,
    finalLiquidationIndex: finalSettlementIndex,
    actualSalesCashInflow: salesCashInflow,
  });

  let runningBalance = 0;
  let minimumBalance = 0;
  let peakMonthIndex = 0;
  for (let month = 0; month < totalMonths; month++) {
    const debit = futureInvestorDebitRows.reduce((sum, row) => sum + (monthValues(row)[month] || 0), 0);
    const settlementCredit = month === firstSettlementIndex
      ? settlement.firstLiquidation
      : month === finalSettlementIndex
        ? settlement.finalLiquidation
        : 0;
    const credit = investorCreditRows.reduce((sum, row) => sum + (monthValues(row)[month] || 0), 0) + settlementCredit;
    runningBalance += credit - debit;
    if (runningBalance < minimumBalance) {
      minimumBalance = runningBalance;
      peakMonthIndex = month;
    }
  }

  const investorProjectSpend = cashFlow.rows
    .filter((row) => !row.isRevenue && !row.isProfitAllocation && row.funder === "investor" && !row.isTransfer)
    .reduce((sum, row) => sum + row.totalCost, 0);
  const escrowProjectSpend = cashFlow.rows
    .filter((row) => !row.isRevenue && row.funder === "escrow")
    .reduce((sum, row) => sum + row.totalCost, 0);

  return {
    paidCapital,
    remainingCapital: -minimumBalance,
    requiredCapital: paidCapital - minimumBalance,
    peakMonthIndex,
    peakMonthDate: cashFlow.monthDates[peakMonthIndex] || "",
    investorProjectSpend,
    escrowProjectSpend,
    totalProjectSpend: investorProjectSpend + escrowProjectSpend,
  };
}

// ═══════════════════════════════════════════
// DISTRIBUTION HELPERS
// ═══════════════════════════════════════════

/**
 * S-Curve distribution
 */
export function generateSCurve(months: number): number[] {
  const k = 6;
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-k * (t - 0.5)));
  const cumValues: number[] = [];
  for (let i = 0; i <= months; i++) {
    cumValues.push(sigmoid(i / months));
  }
  const raw: number[] = [];
  for (let i = 1; i <= months; i++) {
    raw.push(cumValues[i] - cumValues[i - 1]);
  }
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => v / sum);
}

/**
 * Distributes the design fee from the seven editable stages saved in Settings
 * and Rules. A stage can span two calendar months, so its own percentage is
 * split by the actual weeks that overlap each month. Percentages are normalized
 * only as a safeguard when a user has temporarily saved a total other than 100.
 */
export function distributeDesignFee(
  totalFee: number,
  months: number,
  savedStages?: Array<{ pct: number; durationWeeks: number }>,
): number[] {
  const fallbackStages = [
    { pct: 5, durationWeeks: 2 },
    { pct: 15, durationWeeks: 4 },
    { pct: 20, durationWeeks: 4 },
    { pct: 25, durationWeeks: 6 },
    { pct: 10, durationWeeks: 4 },
    { pct: 15, durationWeeks: 4 },
    { pct: 10, durationWeeks: 2 },
  ];
  const stages = (savedStages?.length ? savedStages : fallbackStages)
    .map((stage) => ({
      pct: Math.max(0, Number(stage.pct) || 0),
      durationWeeks: Math.max(1, Number(stage.durationWeeks) || 1),
    }));
  const totalPct = stages.reduce((sum, stage) => sum + stage.pct, 0);
  const normalizedStages = totalPct > 0
    ? stages.map((stage) => ({ ...stage, share: stage.pct / totalPct }))
    : fallbackStages.map((stage) => ({ ...stage, share: stage.pct / 100 }));
  const result = new Array(Math.max(1, months)).fill(0);
  const weeksPerCalendarMonth = 4.33;
  let stageStartWeek = 0;

  for (const stage of normalizedStages) {
    const stageEndWeek = stageStartWeek + stage.durationWeeks;
    const stageFee = totalFee * stage.share;
    for (let monthIndex = 0; monthIndex < result.length; monthIndex++) {
      const monthStartWeek = monthIndex * weeksPerCalendarMonth;
      const monthEndWeek = (monthIndex + 1) * weeksPerCalendarMonth;
      const overlapWeeks = Math.max(0, Math.min(stageEndWeek, monthEndWeek) - Math.max(stageStartWeek, monthStartWeek));
      if (overlapWeeks > 0) result[monthIndex] += stageFee * (overlapWeeks / stage.durationWeeks);
    }
    stageStartWeek = stageEndWeek;
  }

  const distributed = result.reduce((sum, amount) => sum + amount, 0);
  if (result.length > 0) result[result.length - 1] += totalFee - distributed;
  return result;
}

/**
 * توزيع بالتساوي على عدد أشهر محدد
 */
export function distributeEqual(total: number, months: number, arr: number[], startIndex: number = 0) {
  const perMonth = total / months;
  for (let i = startIndex; i < startIndex + months && i < arr.length; i++) {
    arr[i] = perMonth;
  }
}

/**
 * توزيع رسوم المجتمع: كل 6 أشهر بدءاً من شهر 1
 */
export function distributeCommunityFee(
  total: number,
  designMonths: number,
  constructionMonths: number
): { design: number[]; construction: number[] } {
  const totalMonths = designMonths + constructionMonths;
  const paymentMonths: number[] = [];
  for (let m = 0; m < totalMonths; m += 6) {
    paymentMonths.push(m);
  }
  const paymentAmount = total / paymentMonths.length;

  const design = new Array(designMonths).fill(0);
  const construction = new Array(constructionMonths).fill(0);

  for (const m of paymentMonths) {
    if (m < designMonths) {
      design[m] = paymentAmount;
    } else {
      construction[m - designMonths] = paymentAmount;
    }
  }

  return { design, construction };
}

// ═══════════════════════════════════════════
// PRICING UNITS BUILDER
// ═══════════════════════════════════════════
const DEF_AREAS = { studio: 0, res1: 750, res2: 1300, res2Maid: 0, res3: 1650, res3Maid: 0, villa: 0, townhouse: 0, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
const DEF_PRICES = { studio: 0, res1: 1550, res2: 1500, res2Maid: 0, res3: 1450, res3Maid: 0, villa: 0, townhouse: 0, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };

export function buildPricingUnits(project: any, inputs: ProjectInputs) {
  const p = project;
  const countKeys = ["studioCount", "residential1brCount", "residential2brCount", "residential2brMaidCount", "residential3brCount", "residential3brMaidCount", "villaCount", "townhouseCount", "retailSmallCount", "retailMediumCount", "retailLargeCount", "officeSmallCount", "officeMediumCount", "officeLargeCount"];
  const isBuildForSale = p?.financingScenario === "build_for_sale";
  // Build-for-sale uses the user-entered unit distribution exactly, including an
  // explicit all-zero distribution. Legacy Off-Plan fallback behavior is retained.
  const hasSavedCounts = isBuildForSale
    ? countKeys.some((key) => p?.[key] !== undefined && p?.[key] !== null)
    : countKeys.some((key) => Number(p?.[key]) > 0);
  const valueOrDefault = (key: string, fallback: number) => {
    const value = p?.[key];
    return value === undefined || value === null || value === "" ? fallback : Number(value);
  };
  const cStudio = Number(p?.studioCount) || 0;
  let c1 = Number(p?.residential1brCount) || 0;
  let c2 = Number(p?.residential2brCount) || 0;
  const c2Maid = Number(p?.residential2brMaidCount) || 0;
  let c3 = Number(p?.residential3brCount) || 0;
  const c3Maid = Number(p?.residential3brMaidCount) || 0;
  const cVilla = Number(p?.villaCount) || 0;
  const cTownhouse = Number(p?.townhouseCount) || 0;
  let cRS = Number(p?.retailSmallCount) || 0;
  let cRM = Number(p?.retailMediumCount) || 0;
  let cRL = Number(p?.retailLargeCount) || 0;
  let cOS = Number(p?.officeSmallCount) || 0;
  let cOM = Number(p?.officeMediumCount) || 0;
  let cOL = Number(p?.officeLargeCount) || 0;
  if (!hasSavedCounts) {
    const sellRes = inputs.gfaResidential * inputs.efficiencyResidential;
    const sellRet = inputs.gfaRetail * inputs.efficiencyRetail;
    const sellOff = inputs.gfaOffice * inputs.efficiencyOffice;
    if (sellRes > 0) { c1 = Math.round(sellRes * 0.4 / DEF_AREAS.res1); c2 = Math.round(sellRes * 0.4 / DEF_AREAS.res2); c3 = Math.round(sellRes * 0.2 / DEF_AREAS.res3); }
    if (sellRet > 0) { cRS = Math.round(sellRet * 0.4 / DEF_AREAS.retS); cRM = Math.round(sellRet * 0.4 / DEF_AREAS.retM); cRL = Math.round(sellRet * 0.2 / DEF_AREAS.retL); }
    if (sellOff > 0) { cOS = Math.round(sellOff * 0.4 / DEF_AREAS.offS); cOM = Math.round(sellOff * 0.4 / DEF_AREAS.offM); cOL = Math.round(sellOff * 0.2 / DEF_AREAS.offL); }
  }
  return [
    { name: "استوديو", category: "residential" as const, area: valueOrDefault("studioArea", DEF_AREAS.studio), price: valueOrDefault("studioPrice", DEF_PRICES.studio), count: cStudio },
    { name: "غرفة وصالة", category: "residential" as const, area: valueOrDefault("residential1brArea", DEF_AREAS.res1), price: valueOrDefault("residential1brPrice", DEF_PRICES.res1), count: c1 },
    { name: "غرفتين وصالة", category: "residential" as const, area: valueOrDefault("residential2brArea", DEF_AREAS.res2), price: valueOrDefault("residential2brPrice", DEF_PRICES.res2), count: c2 },
    { name: "غرفتين وصالة مع غرفة خادمة", category: "residential" as const, area: valueOrDefault("residential2brMaidArea", DEF_AREAS.res2Maid), price: valueOrDefault("residential2brMaidPrice", DEF_PRICES.res2Maid), count: c2Maid },
    { name: "ثلاث غرف وصالة", category: "residential" as const, area: valueOrDefault("residential3brArea", DEF_AREAS.res3), price: valueOrDefault("residential3brPrice", DEF_PRICES.res3), count: c3 },
    { name: "ثلاث غرف وصالة مع غرفة خادمة", category: "residential" as const, area: valueOrDefault("residential3brMaidArea", DEF_AREAS.res3Maid), price: valueOrDefault("residential3brMaidPrice", DEF_PRICES.res3Maid), count: c3Maid },
    { name: "فيلا", category: "residential" as const, area: valueOrDefault("villaArea", DEF_AREAS.villa), price: valueOrDefault("villaPrice", DEF_PRICES.villa), count: cVilla },
    { name: "تاون هاوس", category: "residential" as const, area: valueOrDefault("townhouseArea", DEF_AREAS.townhouse), price: valueOrDefault("townhousePrice", DEF_PRICES.townhouse), count: cTownhouse },
    { name: "تجزئة / صغير", category: "retail" as const, area: valueOrDefault("retailSmallArea", DEF_AREAS.retS), price: valueOrDefault("retailSmallPrice", DEF_PRICES.retS), count: cRS },
    { name: "تجزئة / متوسط", category: "retail" as const, area: valueOrDefault("retailMediumArea", DEF_AREAS.retM), price: valueOrDefault("retailMediumPrice", DEF_PRICES.retM), count: cRM },
    { name: "تجزئة / كبير", category: "retail" as const, area: valueOrDefault("retailLargeArea", DEF_AREAS.retL), price: valueOrDefault("retailLargePrice", DEF_PRICES.retL), count: cRL },
    { name: "مكاتب / صغير", category: "office" as const, area: valueOrDefault("officeSmallArea", DEF_AREAS.offS), price: valueOrDefault("officeSmallPrice", DEF_PRICES.offS), count: cOS },
    { name: "مكاتب / متوسط", category: "office" as const, area: valueOrDefault("officeMediumArea", DEF_AREAS.offM), price: valueOrDefault("officeMediumPrice", DEF_PRICES.offM), count: cOM },
    { name: "مكاتب / كبير", category: "office" as const, area: valueOrDefault("officeLargeArea", DEF_AREAS.offL), price: valueOrDefault("officeLargePrice", DEF_PRICES.offL), count: cOL },
  ];
}

// ═══════════════════════════════════════════
// MAIN COMPUTATION FUNCTION
// ═══════════════════════════════════════════

/**
 * Computes the full investor cash flow schedule for a given project and scenario.
 * This is the single source of truth used by both the individual investor page
 * and the consolidated page.
 *
 * @param projectData - The raw project record from DB (or null for defaults)
 * @param scenario - The financing scenario to compute
 * @returns CashFlowResult with all rows, totals, and monthly distributions
 */
export function computeInvestorCashFlow(projectData: any, scenario: Scenario, timingRules?: TimingRules, salesResult?: SalesResult): CashFlowResult {
  const communityFeeSettings = getProjectCommunityFeeSettings(projectData);
  const savedReraFees = getProjectReraQuarterlyFeeSettings(projectData);
  const tr = timingRules || {
    ...DEFAULT_TIMING_RULES,
    communityFeePerSqft: communityFeeSettings.ratePerSqft,
    communityFeeFrequency: communityFeeSettings.frequencyMonths,
    reraAuditorQuarterlyFee: savedReraFees.auditorPerPayment,
    reraInspectionQuarterlyFee: savedReraFees.inspectionPerPayment,
  };
  const baseInputs: ProjectInputs = projectData ? dbProjectToInputs(projectData) : PROJECT_INPUTS;
  const quarterlyPaymentCount = Math.ceil(Math.max(1, Number(baseInputs.constructionMonths || savedReraFees.constructionMonths)) / 3);
  const i: ProjectInputs = {
    ...baseInputs,
    reraAuditorReport: tr.reraAuditorQuarterlyFee * quarterlyPaymentCount,
    reraInspection: tr.reraInspectionQuarterlyFee * quarterlyPaymentCount,
  };
  const r: ProjectRates = projectData ? dbProjectToRates(projectData) : RATES;
  const projectFormulas = calculateProjectFormulas(i, r);

  const pricingUnits = buildPricingUnits(projectData || {}, i);
  const pricingFormulas = calculatePricingFormulas(pricingUnits);
  const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

  const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
  const { totalRevenue, totalUnits } = pricingFormulas;
  const designDuration = i.designDuration;
  const constructionDuration = i.constructionDuration;
  const phaseTiming = getProjectMarketingTiming(projectData);
  const reraStartInDesign = Math.min(designDuration - 1, Math.max(0, phaseTiming.reraStartMonth - 1));
  const reraPaymentInDesign = Math.min(designDuration - 1, Math.max(0, phaseTiming.reraPaymentMonth - 1));
  const penultimateDesign = designDuration - 2;
  const penultimateConstruction = constructionDuration - 2;

  const isScenario2 = scenario === "offplan_construction";
  const isScenario3 = scenario === "no_offplan";
  const isBuildForSale = scenario === "build_for_sale";
  const isBuildForRent = scenario === "build_for_rent";
  const isScenario4 = scenario === "rental" || scenario === "build_for_rent";

  // Post-construction months:
  // All scenarios: 13 months post-construction
  // Month 2: 5% completion payment to contractor
  // Month 13: 5% retention payment to contractor
  // S1/S2: also 12 months of 20% direct revenue
  // S3: revenue split in months 2-3
  const flexiblePostHandoverMonths = salesResult?.paymentPlan
    ? getPaymentPlanPostHandoverMonths(normalizeFlexiblePaymentPlan(salesResult.paymentPlan))
    : 0;
  const postDuration = isScenario3
    ? Math.max(13, salesResult?.buildForSaleMonthlyUnits?.length || 1)
    : Math.max(13, flexiblePostHandoverMonths);

  // Helper: empty month arrays
  const emptyDesign = () => new Array(designDuration).fill(0);
  const emptyConstruction = () => new Array(constructionDuration).fill(0);
  const emptyPost = () => new Array(postDuration).fill(0);
  const buildForSaleRevenuePost = (() => {
    const revenuePost = emptyPost();
    if (!isBuildForSale) return revenuePost;

    // The Sales page saves actualCashInflow by absolute project month. Reuse it
    // directly for the build-for-sale receipt schedule, scaled only to protect
    // the Feasibility Study's shared total-revenue source from stale rounding.
    const postStartIndex = designDuration + constructionDuration;
    const savedReceipts = (salesResult?.actualCashInflow || [])
      .slice(postStartIndex, postStartIndex + postDuration)
      .map((amount) => Math.max(0, Number(amount) || 0));
    const savedReceiptTotal = savedReceipts.reduce((sum, amount) => sum + amount, 0);
    if (savedReceiptTotal > 0) {
      const scale = totalRevenue / savedReceiptTotal;
      savedReceipts.forEach((amount, index) => {
        revenuePost[index] = amount * scale;
      });
      return revenuePost;
    }

    const averageUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
    const monthlyUnits = salesResult?.buildForSaleMonthlyUnits || [];
    if (monthlyUnits.some((units) => units > 0)) {
      monthlyUnits.forEach((units, index) => {
        if (index < revenuePost.length && units > 0) revenuePost[index] = units * averageUnitPrice;
      });
    } else {
      // A plan has not yet been saved: retain the documented full-payment fallback.
      revenuePost[0] = totalRevenue;
    }
    return revenuePost;
  })();

  // ─── Generate default salesResult when not provided or empty (for offplan scenarios) ───
  // This ensures commission distribution and revenue inflows work even without a saved V2WaelSales plan
  const hasValidSalesData = salesResult && salesResult.escrowData && salesResult.escrowData.length > 0 && salesResult.escrowData.some(e => e.income > 0);
  if (!hasValidSalesData && !isScenario3 && !isScenario4 && !isBuildForSale && totalUnits > 0 && totalRevenue > 0) {
    salesResult = {
      ...buildDefaultOffPlanSalesResult({
        totalRevenue,
        totalUnits,
        salesStartMonth: phaseTiming.salesStartMonth,
        constructionStartMonth: phaseTiming.constructionStartMonth,
        constructionMonths: i.constructionMonths,
        projectEndMonth: phaseTiming.projectEndMonth,
      }),
      // Preserve marketing data from an existing marketing-only payload.
      marketingMonthlyAmounts: salesResult?.marketingMonthlyAmounts,
    };
  }

  // ═════════════════════════════════════════════
  // BUILD ROWS
  // ═════════════════════════════════════════════
  const rows: CostRow[] = [];

  // ─── الأرض (مدفوعة — لا توزيع) ───
  rows.push({
    label: "سعر الأرض",
    totalCost: landPrice,
    investorAmount: landPrice,
    paid: landPrice,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  rows.push({
    label: "رسوم تسجيل الأرض",
    totalCost: landRegistration,
    investorAmount: landRegistration,
    paid: landRegistration,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  rows.push({
    label: "عمولة وسيط الأرض",
    totalCost: landBroker,
    investorAmount: landBroker,
    paid: landBroker,
    unpaid: 0,
    funder: "investor",
    section: "الأرض",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── أتعاب التصاميم (توزيع حسب المراحل) ───
  const designFeeDistribution = distributeDesignFee(costs.designFee, designDuration, phaseTiming.stages);
  rows.push({
    label: "أتعاب التصاميم",
    totalCost: costs.designFee,
    investorAmount: costs.designFee,
    paid: 0,
    unpaid: costs.designFee,
    funder: "investor",
    section: "التصاميم والإشراف",
    designMonths: designFeeDistribution,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // أتعاب الإشراف — تتبع نسبة الإنجاز (نفس توزيع المستخلصات)
  // Will be filled after construction section where monthlyProgressPcts is available
  // Placeholder: push later after construction progress is computed
  const supervisionFeeTotal = costs.supervisionFee;
  const supervisionFunder = (isScenario3 || isScenario4 || isBuildForSale) ? "investor" : "escrow";
  const supervisionInvestorAmount = (isScenario3 || isScenario4 || isBuildForSale) ? supervisionFeeTotal : 0;

  // ─── فحص التربة (شهر 2 تصاميم) ───
  const soilDesign = emptyDesign();
  soilDesign[1] = i.soilTest;
  rows.push({
    label: "فحص التربة",
    totalCost: i.soilTest,
    investorAmount: i.soilTest,
    paid: 0,
    unpaid: i.soilTest,
    funder: "investor",
    section: "الدراسات والمسوحات",
    designMonths: soilDesign,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── المسح الطبوغرافي (شهر 2 تصاميم) ───
  const topoDesign = emptyDesign();
  topoDesign[1] = i.topography;
  rows.push({
    label: "المسح الطبوغرافي",
    totalCost: i.topography,
    investorAmount: i.topography,
    paid: 0,
    unpaid: i.topography,
    funder: "investor",
    section: "الدراسات والمسوحات",
    designMonths: topoDesign,
    constructionMonths: emptyConstruction(),
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم المساح DWG: غير منطبقة في البناء للبيع أو التأجير ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const surveyorDwgDesign = emptyDesign();
    surveyorDwgDesign[reraStartInDesign] = i.surveyorDwgFee;
    rows.push({
      label: "رسوم المساح (DWG)",
      totalCost: i.surveyorDwgFee,
      investorAmount: i.surveyorDwgFee,
      paid: 0,
      unpaid: i.surveyorDwgFee,
      funder: "investor",
      section: "الدراسات والمسوحات",
      designMonths: surveyorDwgDesign,
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });
  }
  // ─── رسوم المساح As-Built (شهر قبل الأخير من الإنشاء) ───
  const surveyorAsbuiltConst = emptyConstruction();
  surveyorAsbuiltConst[penultimateConstruction] = i.surveyorFee;
  rows.push({
    label: "رسوم المساح (As-Built)",
    totalCost: i.surveyorFee,
    investorAmount: (isScenario3 || isScenario4 || isBuildForSale) ? i.surveyorFee : 0,
    paid: 0,
    unpaid: 0,
    funder: (isScenario3 || isScenario4 || isBuildForSale) ? "investor" : "escrow",
    section: "الدراسات والمسوحات",
    designMonths: emptyDesign(),
    constructionMonths: surveyorAsbuiltConst,
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم المجتمع (من إعدادات المشروع) ───
  const communityTotalMonths = designDuration + constructionDuration;
  const communitySchedule = calculateCommunityFeeSchedule(
    gfaTotal || 0,
    communityTotalMonths,
    {
      ratePerSqft: tr.communityFeePerSqft,
      frequencyMonths: tr.communityFeeFrequency,
    },
  );
  const communityTotal = communitySchedule.total;
  const communityDesign = new Array(designDuration).fill(0);
  const communityConstruction = new Array(constructionDuration).fill(0);
  for (let m = 0; m < communitySchedule.monthlyAmounts.length; m++) {
    const amount = communitySchedule.monthlyAmounts[m];
    if (!amount) continue;
    if (m < designDuration) {
      communityDesign[m] = amount;
    } else {
      communityConstruction[m - designDuration] = amount;
    }
  }
  rows.push({
    label: "رسوم المجتمع",
    totalCost: communityTotal,
    investorAmount: communityTotal,
    paid: 0,
    unpaid: communityTotal,
    funder: "investor",
    section: "الرسوم الحكومية والتنظيمية",
    designMonths: communityDesign,
    constructionMonths: communityConstruction,
    postConstructionMonths: emptyPost(),
  });

  // ─── رسوم الجهات الحكومية ───
  if (isScenario3 || isScenario4 || isBuildForSale) {
    const govDesign = emptyDesign();
    const govConst = emptyConstruction();
    const month80pct = Math.max(0, Math.round(constructionDuration * 0.8) - 1);
    const month90pct = Math.max(0, Math.round(constructionDuration * 0.9) - 1);
    govDesign[Math.min(2, designDuration - 1)] = i.govFeesTotal * 0.10;
    govConst[month80pct] = i.govFeesTotal * 0.45;
    govConst[month90pct] += i.govFeesTotal * 0.45;
    rows.push({
      label: "رسوم الجهات الحكومية",
      totalCost: i.govFeesTotal,
      investorAmount: i.govFeesTotal,
      paid: 0,
      unpaid: i.govFeesTotal,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: govDesign,
      constructionMonths: govConst,
      postConstructionMonths: emptyPost(),
    });
  } else {
    // Investor portion: 10% at completion of schematic design
    const govDesign = emptyDesign();
    govDesign[2] = costs.govFeesInvestor;
    rows.push({
      label: "رسوم الجهات الحكومية (10%)",
      totalCost: costs.govFeesInvestor,
      investorAmount: costs.govFeesInvestor,
      paid: 0,
      unpaid: costs.govFeesInvestor,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: govDesign,
      constructionMonths: emptyConstruction(),
      postConstructionMonths: emptyPost(),
    });

    // Escrow portion: 45% at 80% completion + 45% at 90% completion
    const govEscrowConst = emptyConstruction();
    const govEscrowPortion = i.govFeesTotal * r.govFeesEscrowShare; // 90% total
    const govEscrowHalf = govEscrowPortion / 2; // 45% each
    const month80pct = Math.max(0, Math.round(constructionDuration * 0.8) - 1);
    const month90pct = Math.max(0, Math.round(constructionDuration * 0.9) - 1);
    govEscrowConst[month80pct] = govEscrowHalf;
    govEscrowConst[month90pct] += govEscrowHalf;
    rows.push({
      label: "رسوم الجهات الحكومية (45%+45%)",
      totalCost: govEscrowPortion,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: emptyDesign(),
      constructionMonths: govEscrowConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم الفرز (لا تنطبق على البناء للتأجير) ───
  if (!isBuildForRent) {
    const sortingDesign = emptyDesign();
    const sortingConstruction = emptyConstruction();
    // Independent Build-for-Sale projects pay sorting in the penultimate construction month.
    const sortingMonthInDesign = reraStartInDesign;
    if (isScenario3 || isBuildForSale) {
      sortingConstruction[penultimateConstruction] = costs.sortingFee;
    } else if (isScenario2) {
      sortingConstruction[Math.min(phaseTiming.reraPaymentMonth - 1, constructionDuration - 1)] = costs.sortingFee;
    } else {
      sortingDesign[sortingMonthInDesign] = costs.sortingFee;
    }
    rows.push({
      label: "رسوم الفرز",
      totalCost: costs.sortingFee,
      investorAmount: costs.sortingFee,
      paid: 0,
      unpaid: costs.sortingFee,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: sortingDesign,
      constructionMonths: sortingConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم NOC (لا تنطبق على البناء للتأجير) ───
  if (!isBuildForRent) {
    const nocDesign = emptyDesign();
    const nocConstruction = emptyConstruction();
    // Independent Build-for-Sale projects pay developer NOC in the penultimate construction month.
    const nocMonthInDesign = reraStartInDesign;
    if (isScenario3 || isBuildForSale) {
      nocConstruction[penultimateConstruction] = i.nocSale;
    } else if (isScenario2) {
      nocConstruction[Math.min(phaseTiming.reraPaymentMonth - 1, constructionDuration - 1)] = i.nocSale;
    } else {
      nocDesign[nocMonthInDesign] = i.nocSale;
    }
    rows.push({
      label: "رسوم NOC المطور",
      totalCost: i.nocSale,
      investorAmount: i.nocSale,
      paid: 0,
      unpaid: i.nocSale,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: nocDesign,
      constructionMonths: nocConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── تسجيل المشروع — ريرا (غير منطبق في البناء للبيع المستقل) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const reraRegDesign = emptyDesign();
    const reraRegConstruction = emptyConstruction();
    // Project registration is due in the first month of the saved RERA phase.
    const reraMonthInDesign = reraStartInDesign;
    if (isScenario2) {
      reraRegConstruction[Math.min(phaseTiming.reraPaymentMonth - 1, constructionDuration - 1)] = i.reraProjectReg;
    } else {
      reraRegDesign[reraMonthInDesign] = i.reraProjectReg;
    }
    rows.push({
      label: "تسجيل المشروع — ريرا",
      totalCost: i.reraProjectReg,
      investorAmount: i.reraProjectReg,
      paid: 0,
      unpaid: i.reraProjectReg,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: reraRegDesign,
      constructionMonths: reraRegConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── تسجيل الوحدات — ريرا (لا ينطبق على البناء للتأجير) ───
  if (!isBuildForRent) {
    const reraUnitsDesign = emptyDesign();
    const reraUnitsConstruction = emptyConstruction();
    // RERA unit registration is paid in the final month of the saved RERA phase.
    const reraMonthInDesign2 = reraPaymentInDesign;
    if (isScenario3 || isBuildForSale) {
      reraUnitsConstruction[penultimateConstruction] = costs.reraUnits;
    } else if (isScenario2) {
      reraUnitsConstruction[Math.min(phaseTiming.reraPaymentMonth - 1, constructionDuration - 1)] = costs.reraUnits;
    } else {
      reraUnitsDesign[reraMonthInDesign2] = costs.reraUnits;
    }
    rows.push({
      label: "تسجيل الوحدات — دائرة الأراضي والأملاك",
      totalCost: costs.reraUnits,
      investorAmount: costs.reraUnits,
      paid: 0,
      unpaid: costs.reraUnits,
      funder: "investor",
      section: "الرسوم الحكومية والتنظيمية",
      designMonths: reraUnitsDesign,
      constructionMonths: reraUnitsConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── حساب الضمان (غير منطبق في البناء للبيع المستقل) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const escrowFeeDesign = emptyDesign();
    const escrowFeeConstruction = emptyConstruction();
    // Escrow account opens in the final month of the saved RERA phase.
    const escrowMonthInDesign = reraPaymentInDesign;
    if (isScenario2) {
      escrowFeeConstruction[Math.min(phaseTiming.reraPaymentMonth - 1, constructionDuration - 1)] = i.escrowAccountFee;
    } else {
      escrowFeeDesign[escrowMonthInDesign] = i.escrowAccountFee;
    }
    rows.push({
      label: "حساب الضمان (رسوم فتح)",
      totalCost: i.escrowAccountFee,
      investorAmount: i.escrowAccountFee,
      paid: 0,
      unpaid: i.escrowAccountFee,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: escrowFeeDesign,
      constructionMonths: escrowFeeConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── رسوم البنك (غير منطبقة في البناء للبيع المستقل) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const bankDesign = emptyDesign();
    const bankConstruction = emptyConstruction();
    // Bank fees start in the final month of the saved RERA phase until construction completes.
    const bankStartInDesign = reraPaymentInDesign;
    const remainingDesignMonths = designDuration - bankStartInDesign;
    const totalBankMonths = remainingDesignMonths + constructionDuration;
    const bankPerMonth = i.bankFees / totalBankMonths;
    for (let m = bankStartInDesign; m < designDuration; m++) {
      bankDesign[m] = bankPerMonth;
    }
    for (let m = 0; m < constructionDuration; m++) {
      bankConstruction[m] = bankPerMonth;
    }
    rows.push({
      label: "رسوم البنك",
      totalCost: i.bankFees,
      investorAmount: i.bankFees,
      paid: 0,
      unpaid: i.bankFees,
      funder: "investor",
      section: "ريرا (التنظيم العقاري)",
      designMonths: bankDesign,
      constructionMonths: bankConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

    // ─── تقرير مدقق ريرا (غير منطبق في البناء للبيع المستقل) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const auditorConst = emptyConstruction();
    // Per-payment amount from settings (default 3500 AED)
    const auditorPerPayment = tr.reraAuditorQuarterlyFee;
    const auditorPayments: number[] = [];
    for (let m = 0; m < constructionDuration; m += 3) {
      auditorPayments.push(m);
    }
    for (const m of auditorPayments) {
      auditorConst[m] = auditorPerPayment;
    }
    const auditorTotal = auditorPerPayment * auditorPayments.length;
    rows.push({
      label: "تقرير مدقق ريرا",
      totalCost: auditorTotal,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: auditorConst,
      postConstructionMonths: emptyPost(),
    });
  }
  // ─── فحص ريرا (غير منطبق في البناء للبيع المستقل) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const inspConst = emptyConstruction();
    // Per-payment amount from settings (default 15020 AED)
    const inspPerPayment = tr.reraInspectionQuarterlyFee;
    const inspPayments: number[] = [];
    for (let m = 0; m < constructionDuration; m += 3) {
      inspPayments.push(m);
    }
    for (const m of inspPayments) {
      inspConst[m] = inspPerPayment;
    }
    const inspTotal = inspPerPayment * inspPayments.length;
    rows.push({
      label: "فحص ريرا",
      totalCost: inspTotal,
      investorAmount: 0,
      paid: 0,
      unpaid: 0,
      funder: "escrow",
      section: "ريرا (التنظيم العقاري)",
      designMonths: emptyDesign(),
      constructionMonths: inspConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── عمولة المبيعات (نسبة العمولة × مبيعات كل شهر، تُصرف عند سداد المشتري 20%) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const commDesign = emptyDesign();
    const commConst = emptyConstruction();
    const commPost = emptyPost();
    let commTotal = 0;

    if (salesResult && salesResult.escrowData.length > 0) {
      // A sales commission becomes payable only in the month where the buyer's
      // actual receipts for that unit batch reach the configured trigger.
      // The dates and percentages come from the exact Sales Plan payment schedule.
      const paymentPlan = salesResult.paymentPlan;
      const triggerPct = tr.salesCommissionTriggerPct; // 20%
      const commPct = r.salesCommission; // e.g. 0.05
      const avgUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
      const constructionEndMonth = designDuration + constructionDuration - 1;
      
      for (const entry of salesResult.escrowData) {
        if (entry.units <= 0) continue;
        const saleMonth = entry.month - 1; // convert from 1-indexed (V2WaelSales) to 0-indexed array position
        const commAmount = entry.units * avgUnitPrice * commPct; // commission = units sold × avg price × rate

        const receiptEvents = paymentPlan
          ? buildPaymentReceiptEvents({
              plan: normalizeFlexiblePaymentPlan(paymentPlan),
              saleMonth,
              constructionStartMonth: designDuration,
              constructionEndMonth,
            })
          : [];
        if (receiptEvents.length === 0) {
          // Legacy plans without paymentPlanJson retain a transparent fallback.
          receiptEvents.push({ month: saleMonth, pct: salesResult.ppDownPct || 10 });
        }

        let cumulativeReceiptsPct = 0;
        let paymentMonth: number | undefined;
        for (const event of receiptEvents.sort((a, b) => a.month - b.month)) {
          cumulativeReceiptsPct += event.pct;
          if (cumulativeReceiptsPct + 1e-9 >= triggerPct) {
            paymentMonth = event.month;
            break;
          }
        }
        if (paymentMonth === undefined) continue;
        
        // Place commission in the correct phase array
        if (paymentMonth < designDuration) {
          commDesign[paymentMonth] = (commDesign[paymentMonth] || 0) + commAmount;
        } else if (paymentMonth - designDuration < constructionDuration) {
          commConst[paymentMonth - designDuration] = (commConst[paymentMonth - designDuration] || 0) + commAmount;
        } else {
          const postIdx = paymentMonth - designDuration - constructionDuration;
          if (postIdx < commPost.length) {
            commPost[postIdx] = (commPost[postIdx] || 0) + commAmount;
          }
        }
        commTotal += commAmount;
      }
    } else {
      // Fallback: total commission at month 3 of construction
      commTotal = costs.salesCommission;
      const commMonth = Math.min(2, constructionDuration - 1);
      commConst[commMonth] = commTotal;
    }

    if (salesResult && salesResult.escrowData.length > 0 && commTotal > 0) {
      // Saved unit batches can contain rounded unit quantities. Keep the
      // receipt-trigger timing from those batches, but scale their commission
      // amounts to the project revenue source used by Feasibility Study.
      const offplanShare = Math.max(0, Math.min(1, Number(salesResult.offplanPct ?? 80) / 100));
      const targetOffplanCommission = costs.salesCommission * offplanShare;
      const scale = targetOffplanCommission / commTotal;
      [commDesign, commConst, commPost].forEach((months) => {
        for (let index = 0; index < months.length; index++) months[index] *= scale;
      });
      commTotal = targetOffplanCommission;
    }

    if (commTotal > 0) {
      rows.push({
        label: "عمولة المبيعات",
        totalCost: commTotal,
        investorAmount: 0,
        paid: 0,
        unpaid: 0,
        funder: "escrow",
        section: "المبيعات والتسويق",
        designMonths: commDesign,
        constructionMonths: commConst,
        postConstructionMonths: commPost,
      });
    }
  }

  // ─── عمولة مبيعات البناء للبيع: تدفع عند تحصيل كامل قيمة الوحدة ───
  if (isBuildForSale) {
    const commPost = buildForSaleRevenuePost.map((receipt) => receipt * r.salesCommission);
    const commissionTotal = commPost.reduce((sum, amount) => sum + amount, 0);
    rows.push({
      label: "عمولة المبيعات (بعد تحصيل كامل قيمة الوحدة)",
      totalCost: commissionTotal,
      investorAmount: commissionTotal,
      paid: 0,
      unpaid: commissionTotal,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: commPost,
    });
  }

  // ─── التسويق (يُنسخ مباشرة من صفحة التسويق) ───
  {
    const marketingDesign = emptyDesign();
    const marketingConstruction = emptyConstruction();
    const marketingPost = emptyPost();
    let marketingTotal = 0;

    if (isBuildForSale) {
      // Build-for-sale: 1% of estimated revenue, three equal months beginning
      // in the penultimate construction month. The Settings page will expose
      // the percentage, start, and duration as project-level controls.
      marketingTotal = costs.marketing;
      const duration = Math.max(1, Math.round(r.buildForSaleMarketingDurationMonths));
      const monthlyAmount = marketingTotal / duration;
      const firstConstructionMonth = Math.max(0, constructionDuration - 1 - Math.round(r.buildForSaleMarketingStartMonthsBeforeCompletion));
      for (let offset = 0; offset < duration; offset++) {
        const projectConstructionMonth = firstConstructionMonth + offset;
        if (projectConstructionMonth < constructionDuration) {
          marketingConstruction[projectConstructionMonth] += monthlyAmount;
        } else if (projectConstructionMonth - constructionDuration < marketingPost.length) {
          marketingPost[projectConstructionMonth - constructionDuration] += monthlyAmount;
        }
      }
    } else if (salesResult?.marketingMonthlyAmounts && salesResult.marketingMonthlyAmounts.length > 0) {
      // Use the monthly amounts directly from marketing page
      // marketingMonthlyAmounts is indexed by project month (0 = month 1 of design)
      const amounts = salesResult.marketingMonthlyAmounts;
      for (let m = 0; m < amounts.length; m++) {
        if (amounts[m] && amounts[m] > 0) {
          if (m < designDuration) {
            marketingDesign[m] = amounts[m];
          } else if (m - designDuration < constructionDuration) {
            marketingConstruction[m - designDuration] = amounts[m];
          }
          marketingTotal += amounts[m];
        }
      }
    } else {
      // Fallback: distribute after the Settings-defined marketing launch month.
      marketingTotal = costs.marketing;
      if (marketingTotal > 0) {
        const marketingPerMonth = marketingTotal / 12;
        const startIndex = Math.max(0, phaseTiming.marketingStartMonth - 1);
        for (let offset = 0; offset < 12; offset++) {
          const projectMonthIndex = startIndex + offset;
          if (projectMonthIndex < designDuration) {
            marketingDesign[projectMonthIndex] = marketingPerMonth;
          } else if (projectMonthIndex - designDuration < constructionDuration) {
            marketingConstruction[projectMonthIndex - designDuration] = marketingPerMonth;
          }
        }
      }
    }

    if (marketingTotal > 0) {
      rows.push({
        label: "التسويق",
        totalCost: marketingTotal,
        investorAmount: marketingTotal,
        paid: 0,
        unpaid: marketingTotal,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: marketingDesign,
        constructionMonths: marketingConstruction,
        postConstructionMonths: marketingPost,
      });
    }
  }

  // ─── أتعاب المطور: البناء للبيع من الإيراد، والبناء للتأجير من تكلفة الإنشاء ───
  {
    const devFeeDesign = emptyDesign();
    const devFeeConstruction = emptyConstruction();
    const totalDevFee = costs.developerFee;
    let buildForRentDesignShare = 1.5 / 4;
    if (isBuildForRent && projectData?.constructionScheduleJson) {
      try {
        const savedRates = JSON.parse(projectData.constructionScheduleJson)?.settings?.configurableRates || {};
        const designRate = Number(savedRates.buildForRentDeveloperFeeDesignRate ?? 1.5);
        const supervisionRate = Number(savedRates.buildForRentDeveloperFeeSupervisionRate ?? 2.5);
        buildForRentDesignShare = designRate / Math.max(designRate + supervisionRate, 0.0001);
      } catch { /* retain approved defaults */ }
    }
    const devFeeDesignTotal = totalDevFee * (isBuildForRent ? buildForRentDesignShare : isBuildForSale ? (1 / 3) : 0.4);
    const devFeeConstructionTotal = totalDevFee - devFeeDesignTotal;
    distributeEqual(devFeeDesignTotal, designDuration, devFeeDesign, 0);
    distributeEqual(devFeeConstructionTotal, constructionDuration, devFeeConstruction, 0);
    rows.push({
      label: "أتعاب المطور",
      totalCost: totalDevFee,
      investorAmount: totalDevFee,
      paid: 0,
      unpaid: totalDevFee,
      funder: "investor",
      section: "أتعاب المطور",
      designMonths: devFeeDesign,
      constructionMonths: devFeeConstruction,
      postConstructionMonths: emptyPost(),
    });
  }

  // ─── الإنشاء (5 بنود مستقلة حسب الإعدادات) ───
  {
    // Parse monthly progress from constructionScheduleJson if available
    let monthlyProgressPcts: number[] | null = null;
    if (projectData?.constructionScheduleJson) {
      try {
        const schedule = JSON.parse(projectData.constructionScheduleJson);
        if (schedule.monthlyProgress && schedule.monthlyProgress.length === constructionDuration) {
          monthlyProgressPcts = schedule.monthlyProgress;
        }
      } catch {}
    }

    // 1. دفعة مقدمة المقاول (10%) — المستثمر — شهر 1 من الإنشاء
    const mobDesign = emptyDesign();
    const mobConst = emptyConstruction();
    const mobPost = emptyPost();
    const mobilizationAmount = constructionCost * r.advancePayment;
    mobConst[0] = mobilizationAmount;
    rows.push({
      label: "دفعة مقدمة المقاول (10%)",
      totalCost: mobilizationAmount,
      investorAmount: mobilizationAmount,
      paid: 0,
      unpaid: mobilizationAmount,
      funder: "investor",
      section: "الإنشاء",
      designMonths: mobDesign,
      constructionMonths: mobConst,
      postConstructionMonths: mobPost,
    });

    // 2. إيداع حساب الضمان: غير منطبق في البناء للبيع المستقل.
    // Build-for-rent has no escrow account or deposit.
    if (!isScenario3 && !isScenario4 && !isBuildForSale) {
      const depositDesign = emptyDesign();
      const depositConst = emptyConstruction();
      const depositPost = emptyPost();
      const escrowDepositAmount = constructionCost * r.escrowDeposit;
      depositDesign[reraPaymentInDesign] = escrowDepositAmount;
      rows.push({
        label: `إيداع حساب الضمان (${r.escrowDeposit * 100}%)`,
        totalCost: escrowDepositAmount,
        investorAmount: escrowDepositAmount,
        paid: 0,
        unpaid: escrowDepositAmount,
        funder: "investor",
        section: "الإنشاء",
        designMonths: depositDesign,
        constructionMonths: depositConst,
        postConstructionMonths: depositPost,
        isTransfer: true,
      });
    }

    // 3. مستخلصات المقاول (80%) — تستحق في الشهر التالي لكل إنجاز
    const progressDesign = emptyDesign();
    const progressConst = emptyConstruction();
    const progressPost = emptyPost();
    const progressTotal = constructionCost * 0.80;
    const recordDeferredProgressPayment = (workMonth: number, amount: number) => {
      const paymentMonth = workMonth + 1;
      if (paymentMonth < constructionDuration) {
        progressConst[paymentMonth] += amount;
      } else {
        // The final construction-month certificate is paid in post-completion month 1.
        progressPost[paymentMonth - constructionDuration] += amount;
      }
    };
    if (monthlyProgressPcts) {
      // Work completed in each construction month is paid in the following month.
      const totalPct = monthlyProgressPcts.reduce((s, v) => s + v, 0);
      for (let m = 0; m < constructionDuration; m++) {
        const pct = monthlyProgressPcts[m] || 0;
        recordDeferredProgressPayment(m, totalPct > 0 ? progressTotal * (pct / totalPct) : 0);
      }
    } else {
      // Fallback: defer the S-Curve payment schedule by the same one-month rule.
      const sCurveWeights = generateSCurve(constructionDuration);
      for (let m = 0; m < constructionDuration; m++) {
        recordDeferredProgressPayment(m, progressTotal * sCurveWeights[m]);
      }
    }
    rows.push({
      label: "مستخلصات المقاول (80% — بعد شهر من الإنجاز)",
      totalCost: progressTotal,
      investorAmount: (isScenario3 || isScenario4 || isBuildForSale) ? progressTotal : 0,
      paid: 0,
      unpaid: progressTotal,
      funder: (isScenario3 || isScenario4 || isBuildForSale) ? "investor" : "escrow",
      section: "الإنشاء",
      designMonths: progressDesign,
      constructionMonths: progressConst,
      postConstructionMonths: progressPost,
    });

    // 4. ريتنشن المقاول الأولى (5%) — شهر +2 بعد الإنجاز
    const ret1Design = emptyDesign();
    const ret1Const = emptyConstruction();
    const ret1Post = emptyPost();
    const retention1Amount = constructionCost * 0.05;
    ret1Post[1] = retention1Amount;
    rows.push({
      label: "ريتنشن المقاول الأولى (5%)",
      totalCost: retention1Amount,
      investorAmount: (isScenario3 || isScenario4 || isBuildForSale) ? retention1Amount : 0,
      paid: 0,
      unpaid: retention1Amount,
      funder: (isScenario3 || isScenario4 || isBuildForSale) ? "investor" : "escrow",
      section: "الإنشاء",
      designMonths: ret1Design,
      constructionMonths: ret1Const,
      postConstructionMonths: ret1Post,
    });

    // 5. ريتنشن أخيرة المقاول (5%) — المستثمر — شهر +13 بعد الإنجاز
    const ret2Design = emptyDesign();
    const ret2Const = emptyConstruction();
    const ret2Post = emptyPost();
    const retentionFinalAmount = constructionCost * 0.05;
    ret2Post[12] = retentionFinalAmount;
    rows.push({
      label: "ريتنشن أخيرة المقاول (5%)",
      totalCost: retentionFinalAmount,
      investorAmount: retentionFinalAmount,
      paid: 0,
      unpaid: retentionFinalAmount,
      funder: "investor",
      section: "الإنشاء",
      designMonths: ret2Design,
      constructionMonths: ret2Const,
      postConstructionMonths: ret2Post,
    });
  }

  // ─── أتعاب الإشراف — تتبع نسبة الإنجاز (نفس توزيع المستخلصات) ───
  {
    const supervisionConst = emptyConstruction();
    // Parse monthly progress (same logic as contractor payments)
    let supProgressPcts: number[] | null = null;
    if (projectData?.constructionScheduleJson) {
      try {
        const schedule = JSON.parse(projectData.constructionScheduleJson);
        if (schedule.monthlyProgress && schedule.monthlyProgress.length === constructionDuration) {
          supProgressPcts = schedule.monthlyProgress;
        }
      } catch {}
    }
    if (supProgressPcts) {
      const totalPct = supProgressPcts.reduce((s: number, v: number) => s + v, 0);
      for (let m = 0; m < constructionDuration; m++) {
        const pct = supProgressPcts[m] || 0;
        supervisionConst[m] = totalPct > 0 ? supervisionFeeTotal * (pct / totalPct) : 0;
      }
    } else {
      // Fallback: S-Curve distribution (same as contractor)
      const sCurveW = generateSCurve(constructionDuration);
      for (let m = 0; m < constructionDuration; m++) {
        supervisionConst[m] = supervisionFeeTotal * sCurveW[m];
      }
    }
    rows.push({
      label: "أتعاب الإشراف",
      totalCost: supervisionFeeTotal,
      investorAmount: supervisionInvestorAmount,
      paid: 0,
      unpaid: supervisionFeeTotal,
      funder: supervisionFunder as "investor" | "escrow",
      section: "التصاميم والإشراف",
      designMonths: emptyDesign(),
      constructionMonths: supervisionConst,
      postConstructionMonths: emptyPost(),
    });
  }

  // Pre-compute revenue variables for S1/S2 (needed by profit share section)
  let directRevenue = 0;
  let escrowLiquidation = 0;
  let month13ToInvestor = 0;

  // ─── الإيرادات ───
  if (isScenario3 || isBuildForSale) {
    const revenuePost = isBuildForSale ? [...buildForSaleRevenuePost] : emptyPost();
    if (isScenario3) {
      const averageUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
      const monthlyUnits = salesResult?.buildForSaleMonthlyUnits || [];
      if (monthlyUnits.some((units) => units > 0)) {
        monthlyUnits.forEach((units, index) => {
          if (index < revenuePost.length && units > 0) revenuePost[index] = units * averageUnitPrice;
        });
      } else {
      // Approved default: sales begin in the first month after completion and
      // every sold unit is received as one full payment.
        revenuePost[0] = totalRevenue;
      }
    }
    rows.push({
      label: "إيرادات المبيعات",
      totalCost: totalRevenue,
      investorAmount: totalRevenue,
      paid: 0,
      unpaid: totalRevenue,
      funder: "investor",
      section: "الإيرادات",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: revenuePost,
      isRevenue: true,
    });
  } else if (!isScenario4) {
    // S1/S2: Revenue comes from sales
    // When salesResult is provided, use actual monthly income from escrowData
    // Otherwise fall back to the simplified 20%/80% split
    
    if (salesResult && salesResult.escrowData.length > 0) {
      // ─── إيرادات من خطة المبيعات الفعلية ───
      // Direct revenue to investor = down payments (20% of each sale)
      // These flow during sales months (design + construction period)
      const revenueDesign = emptyDesign();
      const revenueConstruction = emptyConstruction();
      const revenuePost = emptyPost();
      
      let totalDirectToInvestor = 0;
      for (const entry of salesResult.escrowData) {
        // entry.month is absolute month from project start (1-indexed)
        // entry.downPayment = amount paid directly by buyer at signing (goes to investor as advance)
        // For S1: down payment goes to escrow, but 20% of total revenue goes directly to investor
        // Actually in the escrow model: ALL buyer payments go to escrow account
        // Investor gets money back only at liquidation
        // So "direct revenue" in S1 = 0 during construction
        // Revenue comes back at liquidation (month 3 post) and retention (month 13 post)
      }
      
      // Buyer payments for units sold during construction go to escrow. The remaining
      // unsold share is sold after completion and is a direct investor credit, spread
      // over the project-specific post-completion receipt schedule.
      const escrowBuyerReceipts = salesResult.actualEscrowCashInflow?.length
        ? salesResult.actualEscrowCashInflow
        : (salesResult.actualCashInflow || salesResult.escrowData.map((entry) => entry.income));
      const totalSalesIncome = escrowBuyerReceipts.reduce((sum, amount) => sum + Math.max(0, amount || 0), 0);
      const directBuyerReceipts = salesResult.actualInvestorCashInflow || [];
      const directBuyerTotal = directBuyerReceipts.reduce((sum, amount) => sum + Math.max(0, amount || 0), 0);
      if (directBuyerTotal > 0) {
        const directBuyerDesign = emptyDesign();
        const directBuyerConstruction = emptyConstruction();
        const directBuyerPost = emptyPost();
        directBuyerReceipts.forEach((amount, index) => {
          const value = Math.max(0, amount || 0);
          if (index < designDuration) directBuyerDesign[index] += value;
          else if (index < designDuration + constructionDuration) directBuyerConstruction[index - designDuration] += value;
          else if (index < designDuration + constructionDuration + postDuration) directBuyerPost[index - designDuration - constructionDuration] += value;
        });
        rows.push({
          label: "تحصيلات مشترين مباشرة حسب خطة السداد",
          totalCost: directBuyerTotal,
          investorAmount: directBuyerTotal,
          paid: 0,
          unpaid: directBuyerTotal,
          funder: "investor",
          section: "الإيرادات",
          designMonths: directBuyerDesign,
          constructionMonths: directBuyerConstruction,
          postConstructionMonths: directBuyerPost,
          isRevenue: true,
        });
      }
      const offplanPct = Math.max(0, Math.min(100, salesResult.offplanPct ?? 80));
      directRevenue = totalRevenue * ((100 - offplanPct) / 100);
      const directRevenuePost = emptyPost();
      const directSalesStartMonth = Math.max(1, Math.min(postDuration, salesResult.directSalesStartMonth ?? 4));
      const directSalesInstallmentCount = Math.max(1, Math.min(postDuration - directSalesStartMonth + 1, salesResult.directSalesInstallmentCount ?? 6));
      const directRevenuePerMonth = directRevenue / directSalesInstallmentCount;
      for (let idx = directSalesStartMonth - 1; idx < directSalesStartMonth - 1 + directSalesInstallmentCount; idx++) {
        directRevenuePost[idx] = directRevenuePerMonth;
      }
      rows.push({
        label: `مبيعات مباشرة بعد الإنجاز (${100 - offplanPct}%)`,
        totalCost: directRevenue,
        investorAmount: directRevenue,
        paid: 0,
        unpaid: directRevenue,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: directRevenuePost,
        isRevenue: true,
      });
      const directSalesCommission = directRevenue * r.salesCommission;
      const directSalesCommissionPost = emptyPost();
      const directSalesCommissionPerMonth = directSalesCommission / directSalesInstallmentCount;
      for (let idx = directSalesStartMonth - 1; idx < directSalesStartMonth - 1 + directSalesInstallmentCount; idx++) {
        directSalesCommissionPost[idx] = directSalesCommissionPerMonth;
      }
      rows.push({
        label: "عمولة مبيعات مباشرة بعد الإنجاز",
        totalCost: directSalesCommission,
        investorAmount: directSalesCommission,
        paid: 0,
        unpaid: directSalesCommission,
        funder: "investor",
        section: "المبيعات والتسويق",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: directSalesCommissionPost,
      });

      // ─── تصفية حساب الضمان (دفعة 1: شهر 3 بعد الإنجاز) ───
      const escrowRevenue = totalSalesIncome; // Total collected from buyers through escrow
      const revenueRetention = escrowRevenue * 0.05; // Retention applies only to receipts held in escrow
      const completionPayment = constructionCost * 0.05;
      const openingBalance = constructionCost * r.escrowDeposit;
      const actualEscrowExpenses = (constructionCost * 0.80) + costs.supervisionFee +
        (i.govFeesTotal * r.govFeesEscrowShare) + costs.salesCommission +
        i.reraAuditorReport + i.reraInspection + i.surveyorFee;
      escrowLiquidation = openingBalance + escrowRevenue - actualEscrowExpenses - revenueRetention - completionPayment;
      const escrowLiqPost = emptyPost();
      escrowLiqPost[2] = escrowLiquidation; // شهر 3 (index 2)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 1)",
        totalCost: escrowLiquidation,
        investorAmount: escrowLiquidation,
        paid: 0,
        unpaid: escrowLiquidation,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowLiqPost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 2: شهر 13 بعد الإنجاز) ───
      const constructionRetention = constructionCost * 0.05;
      month13ToInvestor = revenueRetention - constructionRetention;
      const escrowRetPost = emptyPost();
      escrowRetPost[12] = month13ToInvestor; // شهر 13 (index 12)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 2 - صافي الاحتجاز)",
        totalCost: month13ToInvestor,
        investorAmount: month13ToInvestor,
        paid: 0,
        unpaid: month13ToInvestor,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowRetPost,
        isRevenue: true,
      });
    } else {
      // ─── Fallback: simplified revenue (no salesResult) ───
      directRevenue = totalRevenue * 0.20;
      const revenuePost = emptyPost();
      const perMonth = directRevenue / 6;
      for (let idx = 3; idx < 9; idx++) {
        revenuePost[idx] = perMonth;
      }
      rows.push({
        label: "إيرادات مباشرة (20%)",
        totalCost: directRevenue,
        investorAmount: directRevenue,
        paid: 0,
        unpaid: directRevenue,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: revenuePost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 1: شهر 3 بعد الإنجاز) ───
      const escrowRevenue = totalRevenue * 0.80;
      const revenueRetention = escrowRevenue * 0.05; // Retention applies only to receipts held in escrow
      const completionPayment = constructionCost * 0.05;
      const openingBalance = constructionCost * r.escrowDeposit;
      const actualEscrowExpenses = (constructionCost * 0.80) + costs.supervisionFee +
        (i.govFeesTotal * r.govFeesEscrowShare) + costs.salesCommission +
        i.reraAuditorReport + i.reraInspection + i.surveyorFee;
      escrowLiquidation = openingBalance + escrowRevenue - actualEscrowExpenses - revenueRetention - completionPayment;
      const escrowLiqPost = emptyPost();
      escrowLiqPost[2] = escrowLiquidation; // شهر 3 (index 2)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 1)",
        totalCost: escrowLiquidation,
        investorAmount: escrowLiquidation,
        paid: 0,
        unpaid: escrowLiquidation,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowLiqPost,
        isRevenue: true,
      });

      // ─── تصفية حساب الضمان (دفعة 2: شهر 13 بعد الإنجاز) ───
      const constructionRetention = constructionCost * 0.05;
      month13ToInvestor = revenueRetention - constructionRetention;
      const escrowRetPost = emptyPost();
      escrowRetPost[12] = month13ToInvestor; // شهر 13 (index 12)
      rows.push({
        label: "تصفية حساب الضمان (دفعة 2 - صافي الاحتجاز)",
        totalCost: month13ToInvestor,
        investorAmount: month13ToInvestor,
        paid: 0,
        unpaid: month13ToInvestor,
        funder: "investor",
        section: "الإيرادات",
        designMonths: emptyDesign(),
        constructionMonths: emptyConstruction(),
        postConstructionMonths: escrowRetPost,
        isRevenue: true,
      });
    }
  }

  // ─── حصة المطور من فائض إقفالي الضمان (15%) ───
  if (!isScenario3 && !isScenario4 && !isBuildForSale) {
    const firstSettlementIndex = designDuration + constructionDuration + 2;
    const investorSpentBeforeFirstSettlement = rows
      .filter((row) => !row.isRevenue && !row.isProfitAllocation && row.funder === "investor")
      .reduce((sum, row) => {
        const values = [...row.designMonths, ...row.constructionMonths, ...row.postConstructionMonths];
        const paidBeforeSchedule = row.paid > 0 ? row.paid : 0;
        const scheduledSpend = row.paid > 0 && row.unpaid === 0
          ? 0
          : values.slice(0, firstSettlementIndex + 1).reduce((total, value) => total + (value || 0), 0);
        return sum + paidBeforeSchedule + scheduledSpend;
      }, 0);
    const allocation = calculateEscrowProfitAllocation(
      escrowLiquidation,
      investorSpentBeforeFirstSettlement,
      month13ToInvestor,
      tr.developerFeePct,
    );
    
    const devProfitPost = emptyPost();
    devProfitPost[2] = allocation.firstDeveloperShare;
    devProfitPost[12] = allocation.finalDeveloperShare;
    
    rows.push({
      label: "حصة المطور من الأرباح (15%)",
      totalCost: allocation.totalDeveloperShare,
      investorAmount: allocation.totalDeveloperShare,
      paid: 0,
      unpaid: allocation.totalDeveloperShare,
      funder: "investor",
      section: "المبيعات والتسويق",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: devProfitPost,
      isProfitAllocation: true,
    });
  } else if (isScenario3 || isBuildForSale) {
    // Build-for-sale: Como's 15% share is due only once all sales receipts are in.
    const costsBeforeProfitShare = rows
      .filter(row => !row.isRevenue && !row.isTransfer)
      .reduce((sum, row) => sum + row.totalCost, 0);
    const comoProfitShare = Math.max(0, totalRevenue - costsBeforeProfitShare) * (tr.developerFeePct / 100);
    const devProfitPost = emptyPost();
    const salesRevenueRow = rows.find(row => row.label === "إيرادات المبيعات");
    const lastSaleMonth = salesRevenueRow
      ? salesRevenueRow.postConstructionMonths.reduce((last, amount, index) => amount > 0 ? index : last, 0)
      : 0;
    devProfitPost[lastSaleMonth] = comoProfitShare;
    rows.push({
      label: "حصة كومو من الأرباح (15% بعد اكتمال المبيعات)",
      totalCost: comoProfitShare,
      investorAmount: comoProfitShare,
      paid: 0,
      unpaid: comoProfitShare,
      funder: "investor",
      section: "أتعاب المطور",
      designMonths: emptyDesign(),
      constructionMonths: emptyConstruction(),
      postConstructionMonths: devProfitPost,
      isProfitAllocation: isBuildForSale,
    });
  }

  // ═══════════════════════════════════════════
  // TOTALS
  // ═══════════════════════════════════════════
  const expenseRows = rows.filter(r => !r.isRevenue);
  const revenueRows = rows.filter(r => r.isRevenue);

  const grandTotalCost = (isScenario3 || isScenario4 || isBuildForSale)
    ? expenseRows.reduce((s, r) => s + r.investorAmount, 0)
    : costs.totalCosts;
  const grandInvestor = (isScenario3 || isScenario4 || isBuildForSale)
    ? expenseRows.reduce((s, r) => s + r.investorAmount, 0)
    : costs.totalInvestor;
  const grandPaid = expenseRows.reduce((s, r) => s + r.paid, 0);
  const grandUnpaid = grandInvestor - grandPaid;

  // Monthly totals (investor only, expenses)
  const designMonthlyTotals = new Array(designDuration).fill(0);
  const constructionMonthlyTotals = new Array(constructionDuration).fill(0);
  const postMonthlyTotals = new Array(postDuration).fill(0);
  for (const row of expenseRows) {
    if (row.funder === "escrow") continue;
    for (let idx = 0; idx < designDuration; idx++) designMonthlyTotals[idx] += row.designMonths[idx];
    for (let idx = 0; idx < constructionDuration; idx++) constructionMonthlyTotals[idx] += row.constructionMonths[idx];
    for (let idx = 0; idx < postDuration; idx++) postMonthlyTotals[idx] += row.postConstructionMonths[idx];
  }

  // Revenue monthly totals
  const revenuePostTotals = new Array(postDuration).fill(0);
  for (const row of revenueRows) {
    for (let idx = 0; idx < postDuration; idx++) revenuePostTotals[idx] += row.postConstructionMonths[idx];
  }

  // Cumulative (investor) — revenue reduces net withdrawals
  const cumulativeDesign = new Array(designDuration).fill(0);
  const cumulativeConstruction = new Array(constructionDuration).fill(0);
  const cumulativePost = new Array(postDuration).fill(0);
  let running = grandPaid;
  for (let idx = 0; idx < designDuration; idx++) {
    running += designMonthlyTotals[idx];
    cumulativeDesign[idx] = running;
  }
  for (let idx = 0; idx < constructionDuration; idx++) {
    running += constructionMonthlyTotals[idx];
    cumulativeConstruction[idx] = running;
  }
  for (let idx = 0; idx < postDuration; idx++) {
    running += postMonthlyTotals[idx] - revenuePostTotals[idx];
    cumulativePost[idx] = running;
  }

  // Sections
  const sections = isScenario4
    ? [
        "الأرض",
        "التصاميم والإشراف",
        "الدراسات والمسوحات",
        "الرسوم الحكومية والتنظيمية",
        "ريرا (التنظيم العقاري)",
        "أتعاب المطور",
        "الإنشاء",
      ]
    : [
        "الأرض",
        "التصاميم والإشراف",
        "الدراسات والمسوحات",
        "الرسوم الحكومية والتنظيمية",
        "ريرا (التنظيم العقاري)",
        "المبيعات والتسويق",
        "الإنشاء",
        "الإيرادات",
      ];

  // ─── حساب التواريخ الحقيقية ───
  const startDateStr = i.startDate || "2026-08";
  const monthDates: string[] = [];
  const totalMonthCount = designDuration + constructionDuration + postDuration;
  const [startY, startMo] = startDateStr.split("-").map(Number);
  for (let idx = 0; idx < totalMonthCount; idx++) {
    const absMonth = (startY * 12 + (startMo - 1)) + idx;
    const y = Math.floor(absMonth / 12);
    const m = (absMonth % 12) + 1;
    monthDates.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return {
    rows,
    sections,
    grandTotalCost,
    grandInvestor,
    grandPaid,
    grandUnpaid,
    designMonthlyTotals,
    constructionMonthlyTotals,
    postMonthlyTotals,
    revenuePostTotals,
    cumulativeDesign,
    cumulativeConstruction,
    cumulativePost,
    designDuration,
    constructionDuration,
    postDuration,
    totalRevenue,
    monthDates,
    startDate: startDateStr,
    usedSalesResult: salesResult,
  };
}
