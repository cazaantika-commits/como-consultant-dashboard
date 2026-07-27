# V2InvestorCashFlow Rewrite Plan

## Current State
- V2InvestorCashFlow.tsx (288 lines) uses DUMMY DATA (dummyRow with random numbers)
- It has static DEBIT_ITEMS and CREDIT_ITEMS lists with correct names
- It does NOT call computeInvestorCashFlow engine at all
- It does NOT use useProjectContext or trpc queries
- V2EscrowCashFlow.tsx also uses dummy data (similar pattern)

## What Needs to Happen
1. V2InvestorCashFlow must:
   - Use `useProjectContext()` to get selectedProjectId
   - Query `trpc.projects.getById` for project data
   - Query `trpc.waelSalesPlan.getByProject` for sales results (resultsJson)
   - Read `constructionScheduleJson` from project for timingRules + paymentTimingRules
   - Call `computeInvestorCashFlow(projectData, scenario, timingRules)` with salesResult
   - Display real month dates from engine result `monthDates[]`

2. The engine must accept salesResult as parameter:
   - `resultsJson` contains: `{ escrowData, salesDistribution }`
   - `escrowData` is array of: `{ month, units, income, downPayment, installments, withdrawal, balance, cumulativeSold }`
   - `salesDistribution` is array of numbers (units sold per month)
   - The engine currently computes revenue independently - must change to read from salesResult

3. V2EscrowCashFlow must:
   - Same pattern as V2InvestorCashFlow but filter for escrow rows only
   - Opening balance = 20% of construction cost (escrowInitial)
   - Show inflows from sales (from escrowData.income) and outflows (construction S-Curve + other escrow items)

## Key Data Sources (Single Source of Truth)
- Revenue/Sales → from `waelSalesPlans.resultsJson` (saved by V2WaelSales page)
- Project costs/inputs → from `projects` table (project data card)
- Timing rules → from `projects.constructionScheduleJson.paymentTimingRules`
- Unit prices → from `waelSalesPlans` (pricing table in V2WaelSales)

## Engine Function Signature (current)
```ts
export function computeInvestorCashFlow(
  projectData: any, 
  scenario: Scenario, 
  timingRules?: TimingRules
): CashFlowResult
```

## What to Add to Engine
- New parameter: `salesResult?: { escrowData: any[], salesDistribution: number[] }`
- Use salesResult for revenue timing instead of computing independently
- The revenue section (lines ~900-980) currently computes:
  - directRevenue = totalRevenue * advancePayment (20%)
  - escrowLiquidation = totalEscrow (month 3 post)
  - month13ToInvestor = retention amount (month 13 post)
- Should instead read from salesResult.escrowData for actual monthly income

## InvestorCashFlowSchedulePage Pattern (reference)
```tsx
const { selectedProjectId } = useProjectContext();
const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId });
const result = useMemo(() => computeInvestorCashFlow(projectQuery.data, scenario), [projectQuery.data, scenario]);
```

## waelSalesPlan Router
- `trpc.waelSalesPlan.getByProject({ projectId })` → returns array of plans
- Each plan has: `resultsJson` (string), `salesAbsorptionJson` (string)
- Parse resultsJson: `JSON.parse(plan.resultsJson)` → `{ escrowData, salesDistribution }`

## Timeline from V2WaelSales
- `timeline.salesStart = designMonths - 1` (sales start 1 month before design ends)
- `escrowData[i].month = i + timeline.salesStart` (absolute month from project start)
- `salesMonths = projectEnd - salesStart + 1`
