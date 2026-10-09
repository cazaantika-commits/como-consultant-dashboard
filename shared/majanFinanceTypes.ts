/** Majan-only, additive bank discussion model. No writes to legacy project cost rows. */
export type MajanLocale = 'ar' | 'en';
export type Provenance = { source: string; asOf: string; status: 'recorded' | 'assumption' | 'contractual'; rationale?: string };
export type FeeSpec = { mode: 'amount' | 'percentage' | 'percentage_minimum' | 'none'; amount: number | null; percentage: number | null; minimum: number | null };
export type DevelopmentInputs = {
 buaSqft: number; constructionRate: number; designFee: FeeSpec; supervisionFee: FeeSpec; source: Provenance;
 startMonth?: string; designMonths?: number; constructionMonths?: number; handoverMonths?: number;
 costOverrides?: { rowId: string; amount: number; source: Provenance }[];
};
export type LeasingRow = {
 id: string; floor: 'G' | 'L1' | 'L2' | 'L3' | 'L4'; nameEn: string; nameAr: string;
 areaSqft: number; treatment: 'leased' | 'owner_operated'; annualRentPsf: number | null;
 rentRule: 'base' | 'max_base_turnover' | 'base_plus_turnover'; annualSalesPsf: number | null; turnoverPct: number | null;
 openingMonth: string; initialOccupancyPct: number; stabilisedOccupancyPct: number; rampMonths: number;
 rentFreeMonths: number; escalationPct: number; collectionPct: number; collectionLagMonths: number;
 source: Provenance;
};
export type OpexRow = { id: string; nameEn: string; nameAr: string; mode: 'annual_amount' | 'per_gla' | 'percent_collected_rent'; value: number | null; escalationPct: number; recoverablePct: number; recoveryCollectionPct: number; source: Provenance };
export type OperationsInputs = { openingMonth: string; maintenanceCapexAnnual: number | null; capexEscalationPct: number; reserveAnnual: number | null; reserveReleaseAnnual: number; cashTaxAnnual: number | null; taxRationale: string; otherIncomeAnnual: number; vatMode: 'excluded_net_model'; source: Provenance };
export type FinanceInputs = {
 enabled: boolean; status: 'indicative' | 'terms_pending'; structure: 'istisna_forward_ijara' | 'ijara' | 'diminishing_musharaka'; lender: string;
 commitment: number | null; financeSharePct: number | null; profitRatePct: number | null;
 drawStartMonth: string; drawEndMonth: string; repaymentStartMonth: string; repaymentMonths: number | null;
 repaymentMode: 'equal_principal' | 'level_payment' | 'bullet'; constructionProfit: 'capitalise' | 'pay';
 arrangementFeePct: number; dsraMonths: number; targetDscr: number | null; balloonPct: number;
 eligibleCategories: string[]; source: Provenance;
};
export type MajanInputs = {
 schemaVersion: 1; projectId: 1; plot: '6457956'; caseName: string; asOf: string;
 horizonMonth: string; development: DevelopmentInputs; leasing: LeasingRow[]; opex: OpexRow[];
 operations: OperationsInputs; finance: FinanceInputs; notes: string;
};
export type BaselineCostRow = { id: string; category: string; nameAr: string; nameEn: string; total: number; taggedPaid: number; monthly: number[] };
export type MajanBaseline = {
 id: string; capturedAt: string; sourceHash: string; startMonth: string; periods: string[];
 totalCost: number; taggedPaid: number; rows: BaselineCostRow[];
 constructionCost: number; designFee: number; supervisionFee: number; buaSqft: number; constructionRate: number;
 designMonths: number; constructionMonths: number; handoverMonths: number;
 rawProject: { buaSqft: number; manualBuaSqft: number; gfaSqft: number; designPct: number; designFixed: number; supervisionPct: number; supervisionFixed: number; legacyUnitCount: number };
};
export type ModelIssue = { code: string; severity: 'error' | 'warning' | 'info'; field: string; messageEn: string; messageAr: string };
export type LeasingMonth = { period: string; potentialRent: number | null; billedRent: number | null; collectedRent: number | null; openingAr: number | null; closingAr: number | null; badDebt: number | null; opex: number | null; serviceChargeBilled: number | null; serviceChargeCollected: number | null; cashNoi: number | null; capex: number | null; reserveDeposit: number | null; reserveRelease: number; restrictedCash: number | null; cashTax: number | null; otherIncome: number | null; cfads: number | null };
export type LeasingResult = { months: LeasingMonth[]; issues: ModelIssue[]; totalGla: number; blendedRentPsf: number | null; floorGla: Record<string, number> };
export type DevelopmentResult = { periods: string[]; uses: number[]; rows: BaselineCostRow[]; totalCost: number; taggedPaid: number; constructionCost: number; designFee: number; supervisionFee: number; issues: ModelIssue[]; baselineDelta: number };
export type FinanceMonth = { period: string; openingBalance: number | null; draw: number | null; profitCapitalised: number | null; profitPaid: number | null; capitalPaid: number | null; totalPayment: number | null; closingBalance: number | null; fee: number | null; dsraDeposit: number | null; dsraRelease: number | null; dsraBalance: number | null; dscr: number | null; ownerContribution: number | null; ownerDistribution: number | null; cumulativeOwnerContribution: number | null; unleveredNet: number | null; fundedNet: number | null; fundingGap: number | null };
export type FinanceResult = { months: FinanceMonth[]; issues: ModelIssue[]; totalDraw: number | null; totalProfit: number | null; totalFees: number | null; closingBalance: number | null; peakOwnerFunding: number | null; minDscr: number | null; financeComplete: boolean; maturityMonth: string | null };
export type AnnualResult = { year: string; developmentUses: number; billedRent: number | null; collectedRent: number | null; opex: number | null; recoveries: number | null; cashNoi: number | null; cfads: number | null; draw: number | null; profit: number | null; capital: number | null; debtService: number | null; closingBalance: number | null; dscr: number | null; ownerContribution: number | null; ownerDistribution: number | null };
export type ModelCheck = { code: string; status: 'pass' | 'fail' | 'not_calculable'; messageEn: string; messageAr: string; difference?: number };
export type MajanModelResult = { version: string; inputHash: string; generatedAt: string; development: DevelopmentResult; leasing: LeasingResult; financing: FinanceResult; annual: AnnualResult[]; issues: ModelIssue[]; checks: ModelCheck[]; sensitivity: { nameEn: string; nameAr: string; rentChangePct: number; occupancyChangePp: number; annualCfads: number | null; annualDscr: number | null }[] };
export type SavedMajanCase = { id: number; revision: number; inputs: MajanInputs; baseline: MajanBaseline; updatedAt: string; updatedBy: number; result?: MajanModelResult };
