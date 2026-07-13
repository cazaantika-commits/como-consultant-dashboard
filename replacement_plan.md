# Plan: Replace Old Engine with New Engine

## What to do:
Replace the old calculation code in `getPortfolioAllScenarios` and `getProjectMonthlyReport` 
(in server/routers/cashFlowSettings.ts) with calls to the new engine (server/financialEngine.ts + server/financialEngineAdapter.ts).

## Key files:
- **New engine**: `server/financialEngine.ts` — pure functions, 67 tests passing
- **Adapter**: `server/financialEngineAdapter.ts` — maps engine output to existing API shape
  - `buildPortfolioProjectV2(project, overrides, totalUnits, calculatedRevenue)` → returns PortfolioProjectV2
  - `adaptToPortfolioShape(result, inputs)` → returns ScenarioSummaryV2
- **Target**: `server/routers/cashFlowSettings.ts` — lines 1846-2390 contain old getPortfolioAllScenarios and getProjectMonthlyReport

## The adapter already produces:
- `investorTotal`, `escrowTotal`, `grandTotal`, `totalProjectCost`
- `monthlyInvestor[]`, `monthlyEscrow[]`, `monthlyTotal[]`
- `sectionTotals` (paid/design/offplan/construction/escrow)
- `monthlyBySection`, `monthlyInvestorBySection`
- Phase info (design/offplan/construction/handover start+duration)

## What the old getPortfolioAllScenarios returns (must match):
For each project: { projectId, name, startDate, totalMonths, scenarios: { o1, o2, o3 } }
Each scenario: { investorTotal, escrowTotal, grandTotal, monthlyInvestor[], monthlyEscrow[], monthlyTotal[], sectionTotals, monthlyBySection, monthlyInvestorBySection }

## What the old getProjectMonthlyReport returns:
- items[] with { key, name, total, monthlyAmounts[], section, source }
- totalMonths, startDate, phases
- escrowRevenue, settlement

## Strategy:
1. In getPortfolioAllScenarios: replace the ~200 lines of manual calculation with a call to `buildPortfolioProjectV2` for each project
2. In getProjectMonthlyReport: replace with `computeFullFinancials` + format items
3. Keep the DB queries (projects, market_overview, competition_pricing) — just replace the calculation logic

## Important: 
- The old code also reads `project_cash_flow_settings` for user overrides (amountOverride, delays, is_active)
- The new engine does NOT handle user overrides from DB yet
- Need to pass overrides from DB to projectToInputs OR apply them after computation

## User overrides from project_cash_flow_settings:
- `amount_override`: user manually set a different amount for an item
- `start_month` / `end_month`: user delayed/advanced an item
- `is_active`: user disabled an item
- `distribution_format`: how the item is spread across months

## Decision: 
For phase 1, the simplest approach is:
1. Use `buildPortfolioProjectV2` for the BASE calculation
2. Then apply user overrides (amount_override, delays) on top of the result
3. This preserves the user's manual adjustments while using the new engine for defaults
