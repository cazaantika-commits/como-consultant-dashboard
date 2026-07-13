# Comparison Page Plan

## Goal
Build a page that shows OLD engine vs NEW engine numbers side-by-side for each project.

## Backend Approach
- Add a new tRPC procedure `cashFlowSettings.getEngineComparison` that:
  1. Fetches all projects from DB (same as getPortfolioAllScenarios)
  2. For each project, runs BOTH:
     - Old engine: reuses existing `calculateProjectCosts` + `getDefaultItemDefs` + `computeItemAmount` logic
     - New engine: uses `projectToInputs` + `computeFullFinancials` + `adaptToPortfolioShape`
  3. Returns both results side-by-side with diff percentages

## Key Data Shape (per project, per scenario)
```ts
{
  projectId: number;
  name: string;
  old: { investorTotal, escrowTotal, grandTotal, sectionTotals }
  new: { investorTotal, escrowTotal, grandTotal, sectionTotals }
  diff: { investorTotal, escrowTotal, grandTotal } // percentage difference
}
```

## Frontend Approach
- New page: `/engine-comparison`
- Reuse patterns from `CashFlowComparisonPage.tsx` (project picker, summary cards, diff table)
- Table: rows = cost items, columns = old value | new value | diff %
- Color-code diffs: green if match (<1%), yellow if close (1-5%), red if mismatch (>5%)

## Files to Create/Edit
1. `server/routers/cashFlowSettings.ts` — add `getEngineComparison` procedure
2. `client/src/pages/EngineComparisonPage.tsx` — new page
3. `client/src/App.tsx` — add route `/engine-comparison`

## Important
- The old engine uses `calculateProjectCosts` which needs `marketOverview` and `competitionPricing` data
- The new engine uses `projectToInputs` which reads directly from project fields
- Revenue calculation differs: old uses `mo.approvedRevenue || cp.calculatedRevenue`, new uses `inputs.approvedRevenue || inputs.calculatedRevenue`
- Need to pass same revenue to both for fair comparison
