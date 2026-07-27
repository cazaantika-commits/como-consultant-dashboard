# V2InvestorCashFlow Rewrite Notes

## Current State
- V2InvestorCashFlow.tsx (288 lines) is a PURE PLACEHOLDER with dummy random data
- It uses hardcoded DEBIT_ITEMS and CREDIT_ITEMS with `dummyRow()` generating random numbers
- The UI structure (table with sticky row names, phase columns, sections) is good and should be preserved

## Existing Engine: investorCashFlowEngine.ts
- Has `computeInvestorCashFlow(projectData, scenario)` that returns `CashFlowResult`
- Uses `dbProjectToInputs(projectData)` and `dbProjectToRates(projectData)` from `@/lib/projectData`
- Returns rows with: label, totalCost, investorAmount, paid, unpaid, funder, section, designMonths[], constructionMonths[], postConstructionMonths[]
- Already handles all expense distribution logic per scenario
- Already reads from DB project data

## What V2InvestorCashFlow Needs
1. Import `computeInvestorCashFlow` from investorCashFlowEngine
2. Read project data via `trpc.projects.getById` (same as other V2 pages)
3. Read payment timing rules from `constructionScheduleJson.settings.paymentTimingRules`
4. Call `computeInvestorCashFlow(projectData, scenario)` to get real numbers
5. Map the CashFlowResult rows into the table format

## Payment Timing Rules (from settings, editable)
Stored in `constructionScheduleJson.settings.paymentTimingRules`:
```json
{
  "developerFee": { "developerFeePct": 15, "developerFeeRetentionPct": 15, "developerFeeDelayMonths": 1, "developerFeeRetentionMonth": 13 },
  "sortingFees": { "sortingFeeMonth": 1, "sortingFeePerSqft": 40 },
  "salesCommission": { "salesCommissionPct": 5, "salesCommissionTriggerPct": 20 },
  "surveyorAsbuilt": { "surveyorAsbuiltMonthFromEnd": 1 }
}
```

## Key Data Sources
- `trpc.projects.getById` → project with all fields (landPrice, constructionMonths, etc.)
- `calculateProjectCosts(project)` from `@/lib/projectCostsCalc.ts` → ProjectCosts object
- `computeInvestorCashFlow(projectData, scenario)` from `@/lib/investorCashFlowEngine.ts` → CashFlowResult

## Simplest Approach
Replace V2InvestorCashFlow to:
1. Use `useProjectContext()` to get selectedProjectId
2. Query project via tRPC
3. Call `computeInvestorCashFlow(project, "offplan_escrow")` 
4. Map result.rows into the existing table UI structure
5. The engine already handles timing — we just need to pass project data

## ProjectCosts interface (from cashFlowEngine.ts)
```ts
interface ProjectCosts {
  landPrice, agentCommissionLand, landRegistration,
  soilTestFee, topographicSurveyFee, officialBodiesFees,
  designFee, supervisionFee, separationFee, constructionCost,
  communityFees, contingencies, developerFee, salesCommission,
  marketingCost, reraUnitRegFee, reraProjectRegFee, developerNocFee,
  escrowAccountFee, bankFees, surveyorDwgFee, surveyorAsbuiltFee,
  reraAuditReportFee, reraInspectionReportFee,
  revenueRes, revenueRet, revenueOff, totalRevenue, totalCosts
}
```

## CashFlowResult (from investorCashFlowEngine.ts)
```ts
interface CashFlowResult {
  rows: CostRow[];  // each row has designMonths[], constructionMonths[], postConstructionMonths[]
  sections: string[];
  grandTotalCost, grandInvestor, grandPaid, grandUnpaid,
  designMonthlyTotals[], constructionMonthlyTotals[], postMonthlyTotals[],
  revenuePostTotals[],
  cumulativeDesign[], cumulativeConstruction[], cumulativePost[],
  designDuration, constructionDuration, postDuration,
  totalRevenue
}
```
